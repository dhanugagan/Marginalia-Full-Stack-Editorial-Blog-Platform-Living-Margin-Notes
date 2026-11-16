import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  clearSessionCookie,
  hashPassword,
  optionalAuth,
  requireAuth,
  setSessionCookie,
  signAuthToken,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { calculateReadingTime, db, initDatabase, slugify } from './server/db.ts';

initDatabase();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: 'sqlite', timestamp: new Date().toISOString() });
});

// ==================== AUTHENTICATION REST API ====================

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, username, email, password, bio } = req.body as {
      name?: string;
      username?: string;
      email?: string;
      password?: string;
      bio?: string;
    };

    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username?.trim() || cleanEmail.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    if (!cleanUsername) {
      res.status(400).json({ error: 'Please provide a valid username.' });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM users WHERE email = ? OR username = ?')
      .get(cleanEmail, cleanUsername);

    if (existing) {
      res.status(409).json({ error: 'An account with that email or username already exists.' });
      return;
    }

    const passwordHash = hashPassword(password);
    const result = db
      .prepare(
        `INSERT INTO users (name, username, email, password_hash, bio, role)
         VALUES (?, ?, ?, ?, ?, 'writer')`
      )
      .run(name.trim(), cleanUsername, cleanEmail, passwordHash, bio?.trim() || '');

    const userId = Number(result.lastInsertRowid);
    const user = db
      .prepare('SELECT id, name, username, email, bio, avatar_url, role, created_at FROM users WHERE id = ?')
      .get(userId) as {
      id: number;
      name: string;
      username: string;
      email: string;
      bio: string;
      avatar_url: string;
      role: string;
      created_at: string;
    };

    const token = signAuthToken(user);
    setSessionCookie(res, token);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const row = db
      .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
      .get(cleanEmail, cleanEmail) as
      | {
          id: number;
          name: string;
          username: string;
          email: string;
          password_hash: string;
          bio: string;
          avatar_url: string;
          role: string;
          created_at: string;
        }
      | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user = {
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      bio: row.bio,
      avatar_url: row.avatar_url,
      role: row.role,
      created_at: row.created_at,
    };

    const token = signAuthToken(user);
    setSessionCookie(res, token);
    res.json({ user, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to authenticate.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', optionalAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  const user = db
    .prepare('SELECT id, name, username, email, bio, avatar_url, role, created_at FROM users WHERE id = ?')
    .get(req.user.userId);
  res.json({ user: user || null });
});

// ==================== BLOG POSTS REST API ====================

app.get('/api/posts', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { category, q, status, author, sort } = req.query as Record<string, string | undefined>;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status === 'draft') {
      if (!req.user) {
        res.status(401).json({ error: 'Sign in to view your drafts.' });
        return;
      }
      conditions.push("p.status = 'draft' AND p.author_id = ?");
      params.push(req.user.userId);
    } else if (status === 'all' && req.user) {
      conditions.push("(p.status = 'published' OR p.author_id = ?)");
      params.push(req.user.userId);
    } else {
      conditions.push("p.status = 'published'");
    }

    if (category && category !== 'All') {
      conditions.push('p.category = ?');
      params.push(category);
    }

    if (author) {
      conditions.push('u.username = ?');
      params.push(author);
    }

    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      conditions.push('(p.title LIKE ? OR p.subtitle LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)');
      params.push(like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    let orderClause = 'ORDER BY p.created_at DESC';
    if (sort === 'popular') orderClause = 'ORDER BY p.views_count DESC, p.created_at DESC';
    if (sort === 'discussed') orderClause = 'ORDER BY (comment_count + annotation_count) DESC, p.created_at DESC';

    const posts = db
      .prepare(
        `SELECT
          p.id, p.slug, p.title, p.subtitle, p.excerpt, p.content, p.cover_image,
          p.category, p.reading_time_min, p.status, p.author_id, p.views_count,
          p.created_at, p.updated_at,
          u.name as author_name, u.username as author_username, u.bio as author_bio, u.avatar_url as author_avatar,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
          (SELECT COUNT(*) FROM paragraph_annotations a WHERE a.post_id = p.id) as annotation_count,
          (SELECT COUNT(*) FROM post_revisions r WHERE r.post_id = p.id) as revision_count,
          (SELECT COUNT(*) FROM paragraph_sparks s WHERE s.post_id = p.id) as spark_count
        FROM posts p
        JOIN users u ON p.author_id = u.id
        ${whereClause}
        ${orderClause}`
      )
      .all(...params);

    res.json({ posts });
  } catch (err) {
    console.error('List posts error:', err);
    res.status(500).json({ error: 'Failed to load essays.' });
  }
});

app.get('/api/posts/:idOrSlug', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const key = req.params.idOrSlug;
    const isNumeric = /^\d+$/.test(key);
    const post = db
      .prepare(
        `SELECT
          p.*,
          u.name as author_name, u.username as author_username, u.bio as author_bio, u.avatar_url as author_avatar,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
          (SELECT COUNT(*) FROM paragraph_annotations a WHERE a.post_id = p.id) as annotation_count,
          (SELECT COUNT(*) FROM post_revisions r WHERE r.post_id = p.id) as revision_count
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE ${isNumeric ? 'p.id = ?' : 'p.slug = ?'}`
      )
      .get(isNumeric ? Number(key) : key) as Record<string, unknown> | undefined;

    if (!post) {
      res.status(404).json({ error: 'Essay not found.' });
      return;
    }

    if (post.status === 'draft' && post.author_id !== req.user?.userId) {
      res.status(403).json({ error: 'This draft is private.' });
      return;
    }

    db.prepare('UPDATE posts SET views_count = views_count + 1 WHERE id = ?').run(post.id);

    const sparksRows = db
      .prepare(
        `SELECT paragraph_index, COUNT(*) as count
         FROM paragraph_sparks
         WHERE post_id = ?
         GROUP BY paragraph_index`
      )
      .all(post.id) as Array<{ paragraph_index: number; count: number }>;

    const sparksByParagraph: Record<number, number> = {};
    for (const row of sparksRows) {
      sparksByParagraph[row.paragraph_index] = row.count;
    }

    res.json({
      post: { ...post, views_count: Number(post.views_count || 0) + 1 },
      sparksByParagraph,
    });
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ error: 'Failed to fetch essay.' });
  }
});

app.post('/api/posts', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { title, subtitle, excerpt, content, cover_image, category, status } = req.body as {
      title?: string;
      subtitle?: string;
      excerpt?: string;
      content?: string;
      cover_image?: string;
      category?: string;
      status?: 'published' | 'draft';
    };

    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ error: 'Title and essay content are required.' });
      return;
    }

    const baseSlug = slugify(title) || `essay-${Date.now()}`;
    let uniqueSlug = baseSlug;
    let suffix = 1;
    while (db.prepare('SELECT id FROM posts WHERE slug = ?').get(uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${suffix++}`;
    }

    const cleanContent = content.trim();
    const derivedExcerpt =
      excerpt?.trim() ||
      cleanContent
        .replace(/^#+\s.*$/gm, '')
        .replace(/[*_`>]/g, '')
        .trim()
        .slice(0, 180) + (cleanContent.length > 180 ? '...' : '');

    const readingTime = calculateReadingTime(cleanContent);
    const postStatus = status === 'draft' ? 'draft' : 'published';

    const insertTx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO posts (slug, title, subtitle, excerpt, content, cover_image, category, reading_time_min, status, author_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          uniqueSlug,
          title.trim(),
          subtitle?.trim() || '',
          derivedExcerpt,
          cleanContent,
          cover_image?.trim() || '',
          category?.trim() || 'Essays',
          readingTime,
          postStatus,
          req.user!.userId
        );

      const postId = Number(result.lastInsertRowid);
      db.prepare(
        `INSERT INTO post_revisions (post_id, version_num, title, content, change_summary, editor_id)
         VALUES (?, 1, ?, ?, ?, ?)`
      ).run(
        postId,
        title.trim(),
        cleanContent,
        postStatus === 'draft' ? 'Initial draft created' : 'Initial publication',
        req.user!.userId
      );

      return postId;
    });

    const postId = insertTx();
    const created = db
      .prepare(
        `SELECT p.*, u.name as author_name, u.username as author_username, u.bio as author_bio, u.avatar_url as author_avatar
         FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?`
      )
      .get(postId);

    res.status(201).json({ post: created });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create essay.' });
  }
});

app.put('/api/posts/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const postId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId) as
      | { id: number; author_id: number; title: string; content: string }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Essay not found.' });
      return;
    }
    if (existing.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only edit your own essays.' });
      return;
    }

    const { title, subtitle, excerpt, content, cover_image, category, status, change_summary } =
      req.body as {
        title?: string;
        subtitle?: string;
        excerpt?: string;
        content?: string;
        cover_image?: string;
        category?: string;
        status?: 'published' | 'draft';
        change_summary?: string;
      };

    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ error: 'Title and content cannot be empty.' });
      return;
    }

    const cleanContent = content.trim();
    const readingTime = calculateReadingTime(cleanContent);
    const derivedExcerpt =
      excerpt?.trim() ||
      cleanContent
        .replace(/^#+\s.*$/gm, '')
        .replace(/[*_`>]/g, '')
        .trim()
        .slice(0, 180) + (cleanContent.length > 180 ? '...' : '');

    const updateTx = db.transaction(() => {
      db.prepare(
        `UPDATE posts
         SET title = ?, subtitle = ?, excerpt = ?, content = ?, cover_image = ?, category = ?, reading_time_min = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        title.trim(),
        subtitle?.trim() || '',
        derivedExcerpt,
        cleanContent,
        cover_image?.trim() || '',
        category?.trim() || 'Essays',
        readingTime,
        status === 'draft' ? 'draft' : 'published',
        postId
      );

      if (existing.title !== title.trim() || existing.content !== cleanContent) {
        const lastRev = db
          .prepare('SELECT MAX(version_num) as maxVer FROM post_revisions WHERE post_id = ?')
          .get(postId) as { maxVer: number | null };
        const nextVersion = (lastRev?.maxVer || 0) + 1;
        db.prepare(
          `INSERT INTO post_revisions (post_id, version_num, title, content, change_summary, editor_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          postId,
          nextVersion,
          title.trim(),
          cleanContent,
          change_summary?.trim() || `Revision v${nextVersion}`,
          req.user!.userId
        );
      }
    });

    updateTx();
    const updated = db
      .prepare(
        `SELECT p.*, u.name as author_name, u.username as author_username, u.bio as author_bio, u.avatar_url as author_avatar
         FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?`
      )
      .get(postId);

    res.json({ post: updated });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ error: 'Failed to update essay.' });
  }
});

app.delete('/api/posts/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const postId = Number(req.params.id);
    const existing = db.prepare('SELECT id, author_id FROM posts WHERE id = ?').get(postId) as
      | { id: number; author_id: number }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Essay not found.' });
      return;
    }
    if (existing.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only delete your own essays.' });
      return;
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
    res.json({ ok: true, deletedId: postId });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Failed to delete essay.' });
  }
});

// ==================== REVISION HISTORY REST API ====================

app.get('/api/posts/:id/revisions', (req, res) => {
  try {
    const postId = Number(req.params.id);
    const revisions = db
      .prepare(
        `SELECT r.*, u.name as editor_name, u.username as editor_username
         FROM post_revisions r
         JOIN users u ON r.editor_id = u.id
         WHERE r.post_id = ?
         ORDER BY r.version_num DESC`
      )
      .all(postId);
    res.json({ revisions });
  } catch (err) {
    console.error('Revisions error:', err);
    res.status(500).json({ error: 'Failed to load revision history.' });
  }
});

// ==================== THREADED COMMENTS REST API ====================

app.get('/api/posts/:id/comments', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const postId = Number(req.params.id);
    const currentUserId = req.user?.userId || 0;
    const comments = db
      .prepare(
        `SELECT
          c.*,
          u.name as author_name, u.username as author_username, u.avatar_url as author_avatar,
          EXISTS(SELECT 1 FROM comment_votes cv WHERE cv.comment_id = c.id AND cv.user_id = ?) as user_upvoted
        FROM comments c
        JOIN users u ON c.author_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC`
      )
      .all(currentUserId, postId);

    res.json({ comments });
  } catch (err) {
    console.error('Load comments error:', err);
    res.status(500).json({ error: 'Failed to load discussion.' });
  }
});

app.post('/api/posts/:id/comments', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const postId = Number(req.params.id);
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      res.status(404).json({ error: 'Essay not found.' });
      return;
    }

    const { content, parent_id, stance } = req.body as {
      content?: string;
      parent_id?: number | null;
      stance?: 'insight' | 'question' | 'counterpoint' | 'note';
    };

    if (!content?.trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty.' });
      return;
    }

    const validStance = ['insight', 'question', 'counterpoint', 'note'].includes(stance || '')
      ? stance
      : 'insight';

    if (parent_id) {
      const parent = db
        .prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?')
        .get(parent_id, postId);
      if (!parent) {
        res.status(400).json({ error: 'Parent comment not found.' });
        return;
      }
    }

    const result = db
      .prepare(
        `INSERT INTO comments (post_id, author_id, parent_id, stance, content)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(postId, req.user!.userId, parent_id || null, validStance, content.trim());

    const created = db
      .prepare(
        `SELECT c.*, u.name as author_name, u.username as author_username, u.avatar_url as author_avatar, 0 as user_upvoted
         FROM comments c JOIN users u ON c.author_id = u.id WHERE c.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    res.status(201).json({ comment: created });
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});

app.post('/api/comments/:id/upvote', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const commentId = Number(req.params.id);
    const comment = db.prepare('SELECT id, upvotes FROM comments WHERE id = ?').get(commentId) as
      | { id: number; upvotes: number }
      | undefined;
    if (!comment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    const voteTx = db.transaction(() => {
      const existingVote = db
        .prepare('SELECT 1 FROM comment_votes WHERE comment_id = ? AND user_id = ?')
        .get(commentId, req.user!.userId);

      if (existingVote) {
        db.prepare('DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?').run(
          commentId,
          req.user!.userId
        );
        db.prepare('UPDATE comments SET upvotes = MAX(0, upvotes - 1) WHERE id = ?').run(commentId);
        return false;
      } else {
        db.prepare('INSERT INTO comment_votes (comment_id, user_id) VALUES (?, ?)').run(
          commentId,
          req.user!.userId
        );
        db.prepare('UPDATE comments SET upvotes = upvotes + 1 WHERE id = ?').run(commentId);
        return true;
      }
    });

    const upvoted = voteTx();
    const updated = db.prepare('SELECT upvotes FROM comments WHERE id = ?').get(commentId) as {
      upvotes: number;
    };
    res.json({ upvotes: updated.upvotes, upvoted });
  } catch (err) {
    console.error('Upvote error:', err);
    res.status(500).json({ error: 'Failed to toggle upvote.' });
  }
});

app.delete('/api/comments/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const commentId = Number(req.params.id);
    const comment = db
      .prepare(
        `SELECT c.id, c.author_id, p.author_id as post_author_id
         FROM comments c JOIN posts p ON c.post_id = p.id
         WHERE c.id = ?`
      )
      .get(commentId) as { id: number; author_id: number; post_author_id: number } | undefined;

    if (!comment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }
    if (comment.author_id !== req.user!.userId && comment.post_author_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to delete this comment.' });
      return;
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    res.json({ ok: true, deletedId: commentId });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

// ==================== MARGIN ANNOTATIONS & RESONANCE SPARKS REST API ====================

app.get('/api/annotations/recent', (_req, res) => {
  try {
    const annotations = db
      .prepare(
        `SELECT a.*, u.name as author_name, u.username as author_username,
                p.title as post_title, p.slug as post_slug, p.category as post_category
         FROM paragraph_annotations a
         JOIN users u ON a.author_id = u.id
         JOIN posts p ON a.post_id = p.id
         WHERE p.status = 'published'
         ORDER BY a.created_at DESC
         LIMIT 40`
      )
      .all();
    res.json({ annotations });
  } catch (err) {
    console.error('Recent annotations error:', err);
    res.status(500).json({ error: 'Failed to load recent annotations.' });
  }
});

app.get('/api/posts/:id/annotations', (req, res) => {
  try {
    const postId = Number(req.params.id);
    const annotations = db
      .prepare(
        `SELECT a.*, u.name as author_name, u.username as author_username
         FROM paragraph_annotations a
         JOIN users u ON a.author_id = u.id
         WHERE a.post_id = ?
         ORDER BY a.paragraph_index ASC, a.created_at ASC`
      )
      .all(postId);
    res.json({ annotations });
  } catch (err) {
    console.error('Annotations error:', err);
    res.status(500).json({ error: 'Failed to load margin notes.' });
  }
});

app.post('/api/posts/:id/annotations', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const postId = Number(req.params.id);
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      res.status(404).json({ error: 'Essay not found.' });
      return;
    }

    const { paragraph_index, selected_quote, note, highlight_color } = req.body as {
      paragraph_index?: number;
      selected_quote?: string;
      note?: string;
      highlight_color?: string;
    };

    if (typeof paragraph_index !== 'number' || paragraph_index < 0 || !note?.trim()) {
      res.status(400).json({ error: 'Valid paragraph index and margin note text are required.' });
      return;
    }

    const color = ['lapis', 'amber', 'forest'].includes(highlight_color || '')
      ? highlight_color
      : 'lapis';

    const result = db
      .prepare(
        `INSERT INTO paragraph_annotations (post_id, paragraph_index, selected_quote, note, highlight_color, author_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        postId,
        paragraph_index,
        (selected_quote || '').trim().slice(0, 220),
        note.trim(),
        color,
        req.user!.userId
      );

    const created = db
      .prepare(
        `SELECT a.*, u.name as author_name, u.username as author_username
         FROM paragraph_annotations a JOIN users u ON a.author_id = u.id WHERE a.id = ?`
      )
      .get(Number(result.lastInsertRowid));

    res.status(201).json({ annotation: created });
  } catch (err) {
    console.error('Create annotation error:', err);
    res.status(500).json({ error: 'Failed to save margin note.' });
  }
});

app.delete('/api/annotations/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const annotationId = Number(req.params.id);
    const ann = db
      .prepare('SELECT id, author_id FROM paragraph_annotations WHERE id = ?')
      .get(annotationId) as { id: number; author_id: number } | undefined;
    if (!ann) {
      res.status(404).json({ error: 'Annotation not found.' });
      return;
    }
    if (ann.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only remove your own margin notes.' });
      return;
    }
    db.prepare('DELETE FROM paragraph_annotations WHERE id = ?').run(annotationId);
    res.json({ ok: true, deletedId: annotationId });
  } catch (err) {
    console.error('Delete annotation error:', err);
    res.status(500).json({ error: 'Failed to delete margin note.' });
  }
});

app.post('/api/posts/:id/sparks', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const postId = Number(req.params.id);
    const { paragraph_index, reaction_type } = req.body as {
      paragraph_index?: number;
      reaction_type?: 'resonant' | 'insightful' | 'bookmark';
    };

    if (typeof paragraph_index !== 'number' || paragraph_index < 0) {
      res.status(400).json({ error: 'Valid paragraph index required.' });
      return;
    }

    const type = ['resonant', 'insightful', 'bookmark'].includes(reaction_type || '')
      ? reaction_type
      : 'resonant';
    const actorKey = req.user ? `user-${req.user.userId}` : `guest-${req.ip || 'reader'}`;

    db.prepare(
      `INSERT INTO paragraph_sparks (post_id, paragraph_index, reaction_type, actor_key)
       VALUES (?, ?, ?, ?)`
    ).run(postId, paragraph_index, type, actorKey);

    const sparksRows = db
      .prepare(
        `SELECT paragraph_index, COUNT(*) as count
         FROM paragraph_sparks
         WHERE post_id = ?
         GROUP BY paragraph_index`
      )
      .all(postId) as Array<{ paragraph_index: number; count: number }>;

    const sparksByParagraph: Record<number, number> = {};
    for (const row of sparksRows) {
      sparksByParagraph[row.paragraph_index] = row.count;
    }

    res.json({ sparksByParagraph });
  } catch (err) {
    console.error('Spark error:', err);
    res.status(500).json({ error: 'Failed to record paragraph resonance.' });
  }
});

// ==================== SERVER STARTUP (DEV VITE / PROD STATIC) ====================

async function startServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Marginalia full-stack server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
