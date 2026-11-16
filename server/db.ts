import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { hashPassword } from './auth.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'marginalia.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'writer',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      cover_image TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Essays',
      reading_time_min INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published', 'draft')),
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      views_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      version_num INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      change_summary TEXT NOT NULL DEFAULT 'Initial draft',
      editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      stance TEXT NOT NULL DEFAULT 'insight' CHECK(stance IN ('insight', 'question', 'counterpoint', 'note')),
      content TEXT NOT NULL,
      upvotes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comment_votes (
      comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (comment_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS paragraph_annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      paragraph_index INTEGER NOT NULL,
      selected_quote TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL,
      highlight_color TEXT NOT NULL DEFAULT 'lapis',
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS paragraph_sparks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      paragraph_index INTEGER NOT NULL,
      reaction_type TEXT NOT NULL DEFAULT 'resonant' CHECK(reaction_type IN ('resonant', 'insightful', 'bookmark')),
      actor_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
    CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_post ON paragraph_annotations(post_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_post ON post_revisions(post_id);
  `);

  seedInitialData();
}

export function calculateReadingTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72);
}

function seedInitialData(): void {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount > 0) return;

  const insertUser = db.prepare(`
    INSERT INTO users (name, username, email, password_hash, bio, avatar_url, role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const claraPass = hashPassword('marginalia2026');
  const julianPass = hashPassword('marginalia2026');

  const claraRes = insertUser.run(
    'Clara Vance',
    'claravance',
    'clara@marginalia.press',
    claraPass,
    'Architectural essayist & software craft researcher studying calm tools, typographic space, and durable systems.',
    '/src/assets/images/author_editorial_portrait_1794846805058.jpg',
    'editor'
  );
  const julianRes = insertUser.run(
    'Julian Mercer',
    'jmercer',
    'julian@marginalia.press',
    julianPass,
    'Acoustic ecologist and hardware interaction designer writing on urban silence and physical interfaces.',
    '',
    'writer'
  );

  const claraId = Number(claraRes.lastInsertRowid);
  const julianId = Number(julianRes.lastInsertRowid);

  const insertPost = db.prepare(`
    INSERT INTO posts (slug, title, subtitle, excerpt, content, cover_image, category, reading_time_min, status, author_id, views_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)
  `);

  const insertRevision = db.prepare(`
    INSERT INTO post_revisions (post_id, version_num, title, content, change_summary, editor_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const essay1V1Content = `Most software today arrives shouting. It greets every morning with notification badges, insistent onboarding tours, and dashboards crowded with telemetry nobody asked to monitor.

Yet the physical spaces we cherish most—a limestone courtyard at seven in the morning, a reading room with high clerestory windows, a workbench wiped clean before the day begins—are designed around the opposite conviction: generosity of void.

## Designing for Unhurried Attention

When an architect shapes concrete and glass around natural light, nothing is decorative. The column exists to hold the roof; the overhang exists to temper noon glare; the empty stone floor exists so the shadow can move across it visibly from hour to hour.

In software, our equivalent of limestone and shadow is typographic restraint. A line measure of sixty-eight characters lets the eye return smoothly without fatigue. Hairline dividers separate ideas without enclosing every paragraph inside a miniature fortress of borders.

> Calm tools do not compete for the foreground of your mind; they hold a steady frame around the work you came to do.

## Why Frictionless Isn't Always Better

We spent a decade worshipping frictionless velocity. Click once, publish instantly, scroll endlessly. What we lost in that race was deliberate cadence—the brief pause where a writer rereads a paragraph, notices an imprecise verb, and sharpens the claim before sending it into the world.

Good editorial tools reintroduce healthy friction: margin space to question an assumption, revision trails that honor how thought matures over time, and calm typography that rewards slow reading.`;

  const essay1V2Content = `Most software today arrives shouting. It greets every morning with notification badges, insistent onboarding tours, and dashboards crowded with telemetry nobody asked to monitor.

Yet the physical spaces we cherish most—a limestone courtyard at seven in the morning, a reading room with high clerestory windows, a workbench wiped clean before the day begins—are designed around the opposite conviction: generosity of void.

## Designing for Unhurried Attention

When an architect shapes concrete and glass around natural light, nothing is decorative. The column exists to hold the roof; the overhang exists to temper noon glare; the empty stone floor exists so the shadow can move across it visibly from hour to hour.

In software, our equivalent of limestone and shadow is typographic restraint. A line measure of sixty-eight characters lets the eye return smoothly without fatigue. Hairline dividers separate ideas without enclosing every paragraph inside a miniature fortress of borders.

> Calm tools do not compete for the foreground of your mind; they hold a steady frame around the work you came to do.

## Why Frictionless Isn't Always Better

We spent a decade worshipping frictionless velocity. Click once, publish instantly, scroll endlessly. What we lost in that race was deliberate cadence—the brief pause where a writer rereads a paragraph, notices an imprecise verb, and sharpens the claim before sending it into the world.

Good editorial tools reintroduce healthy friction: margin space to question an assumption, revision trails that honor how thought matures over time, and calm typography that rewards slow reading.

## The Courtyard Principle

Consider how you feel entering a quiet room versus a crowded concourse. Digital publishing belongs to the courtyard: durable archives, legible prose, and conversations anchored directly beside the sentences that provoked them.`;

  const post1Res = insertPost.run(
    'architecture-of-quiet-software',
    'The Architecture of Quiet Software',
    'WHAT BRUTALIST COURTYARDS TEACH US ABOUT LEGIBLE INTERFACES AND UNHURRIED PROSE',
    'Most software arrives shouting. By borrowing spatial discipline from limestone courtyards and daylight architecture, digital publishing can recover calm attention.',
    essay1V2Content,
    '/src/assets/images/lead_architecture_light_1794846803963.jpg',
    'Design',
    calculateReadingTime(essay1V2Content),
    claraId,
    418,
    '2026-11-10T09:15:00Z',
    '2026-11-12T14:30:00Z'
  );
  const post1Id = Number(post1Res.lastInsertRowid);

  insertRevision.run(
    post1Id,
    1,
    'The Architecture of Quiet Software',
    essay1V1Content,
    'Initial published manuscript',
    claraId,
    '2026-11-10T09:15:00Z'
  );
  insertRevision.run(
    post1Id,
    2,
    'The Architecture of Quiet Software',
    essay1V2Content,
    'Added concluding section on The Courtyard Principle and tightened margin metaphor',
    claraId,
    '2026-11-12T14:30:00Z'
  );

  const essay2Content = `For five hundred years, the printed book was not a monologue. Readers argued with Aristotle in pencil, sketched botanical corrections beside natural history plates, and left dates in the margins to remember who they were when a sentence first struck them.

When text moved to the web, the margin vanished. Comments were exiled to a basement far below the article—disconnected from the exact clause that sparked a reader's insight or objection.

## Restoring Spatial Context to Dialogue

Imagine asking a friend about a novel, and instead of pointing to page forty-two, you both had to shout across a gymnasium after finishing the final chapter. That is what flat comment threads do to long-form essays.

> When a note sits directly beside the paragraph that provoked it, reading transforms from passive consumption into a quiet seminar across time.

## How Annotators Read Differently

Readers who know they can anchor a thought in the margin read more actively. They notice contradictions, cross-reference earlier claims, and surface concrete examples that the original author overlooked.

Try selecting any sentence in this paragraph or clicking the margin marker on the right—you are participating in the oldest collaborative technology in intellectual history.`;

  const post2Res = insertPost.run(
    'why-writing-in-margins-changed-how-we-think',
    'Why Writing in Margins Changed How We Think',
    'RECLAIMING THE CONVERSATION BETWEEN TEXT AND READER ON THE OPEN WEB',
    'For centuries, readers debated authors directly in the white space beside the text. Moving comments back to the margin turns solitary reading into a living seminar.',
    essay2Content,
    '/src/assets/images/feature_margin_notes_1794846804409.jpg',
    'Essays',
    calculateReadingTime(essay2Content),
    claraId,
    294,
    '2026-11-11T11:00:00Z',
    '2026-11-11T11:00:00Z'
  );
  const post2Id = Number(post2Res.lastInsertRowid);
  insertRevision.run(post2Id, 1, 'Why Writing in Margins Changed How We Think', essay2Content, 'Initial manuscript', claraId, '2026-11-11T11:00:00Z');

  const essay3Content = `Stand inside a deep transit concourse at five-thirty in the morning, before the first commuter rush arrives, and you can hear the geometry of the building. Footsteps carry across terrazzo; steel roof trusses return a crisp three-second decay.

Acoustic engineers call this the impulse response of a room. Urban planners rarely budget for it, yet sound shapes civic calm just as decisively as daylight or tree canopy.

## Soundscapes as Civic Infrastructure

We measure air quality in parts per million and traffic in vehicles per hour, while treating urban noise as an unavoidable byproduct of density. Yet cities that introduce sound-absorbing timber baffles, porous asphalt, and quiet pedestrian alleys consistently report lower cardiovascular stress among residents.

> Silence is not the absence of life; it is the acoustic clarity that lets human conversation carry without strain.

## Listening to Early-Morning Architecture

Recording empty stations at dawn reveals where reflections sharpen into fatigue and where vaulted glass creates unexpected serenity. Good civic spaces sound hospitable long before they fill with crowds.`;

  const post3Res = insertPost.run(
    'acoustic-ecology-of-modern-cities',
    'Acoustic Ecology of Modern Cities',
    'WHAT EMPTY TRANSIT ATRIUMS AT DAWN REVEAL ABOUT CIVIC SOUND AND URBAN CALM',
    'Before the morning rush begins, empty concrete and steel stations reveal their true acoustic signature—and offer clues for designing gentler cities.',
    essay3Content,
    '/src/assets/images/feature_urban_acoustics_1794846804284.jpg',
    'Architecture',
    calculateReadingTime(essay3Content),
    julianId,
    212,
    '2026-11-13T08:45:00Z',
    '2026-11-13T08:45:00Z'
  );
  const post3Id = Number(post3Res.lastInsertRowid);
  insertRevision.run(post3Id, 1, 'Acoustic Ecology of Modern Cities', essay3Content, 'Initial manuscript', julianId, '2026-11-13T08:45:00Z');

  const essay4Content = `Turn a knurled aluminum gain dial on a well-built studio preamp and your fingertips receive twenty subtle pieces of feedback before your eyes even check the meter.

Resistance, detents, thermal coolness, and mechanical travel turn an abstract parameter into muscle memory. By contrast, sliding a glass pane feels identical whether you are adjusting speaker volume or deleting an archive.

## The Case for Physical Detents

Hardware designers have begun rediscovering what instrument makers never forgot: precision requires mechanical resistance. A toggle switch with a decisive throw creates an unmistakable boundary between states.

> Tactile controls respect peripheral attention—your hands confirm the action while your eyes stay on the craft.

## Bridging Analog Craft and Software Systems

Modern software does not need faux-skeuomorphic bevels to honor physical craft. It needs keyboard-first ergonomics, predictable state transitions, and crisp auditory or visual micro-confirmations that settle immediately.`;

  const post4Res = insertPost.run(
    'tactile-computing-and-physical-interfaces',
    'Tactile Computing & Physical Interfaces',
    'WHY KNURLED ALUMINUM DIALS AND MECHANICAL SWITCHES OUTLAST GLASS SLIDERS',
    'Mechanical resistance and physical detents turn digital adjustments into durable muscle memory—lessons software interfaces can still learn from studio hardware.',
    essay4Content,
    '/src/assets/images/feature_tactile_hardware_1794846804779.jpg',
    'Engineering',
    calculateReadingTime(essay4Content),
    julianId,
    176,
    '2026-11-14T16:20:00Z',
    '2026-11-14T16:20:00Z'
  );
  const post4Id = Number(post4Res.lastInsertRowid);
  insertRevision.run(post4Id, 1, 'Tactile Computing & Physical Interfaces', essay4Content, 'Initial manuscript', julianId, '2026-11-14T16:20:00Z');

  // Seed paragraph margin annotations
  const insertAnnotation = db.prepare(`
    INSERT INTO paragraph_annotations (post_id, paragraph_index, selected_quote, note, highlight_color, author_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAnnotation.run(
    post1Id,
    1,
    'generosity of void',
    'Louis Kahn famously spoke of "measurable and unmeasurable" space—this captures the exact discipline missing in modern SaaS dashboards.',
    'lapis',
    julianId,
    '2026-11-11T10:12:00Z'
  );
  insertAnnotation.run(
    post1Id,
    3,
    'sixty-eight characters',
    'Bringhurst recommends 45–75 characters in The Elements of Typographic Style; 68ch hits the sweet spot for serif long-form.',
    'amber',
    claraId,
    '2026-11-12T15:05:00Z'
  );
  insertAnnotation.run(
    post2Id,
    2,
    'shout across a gymnasium',
    'Inline anchoring preserves the exact rhetorical context—essential for technical and literary criticism alike.',
    'lapis',
    julianId,
    '2026-11-12T09:40:00Z'
  );

  // Seed paragraph resonance sparks
  const insertSpark = db.prepare(`
    INSERT INTO paragraph_sparks (post_id, paragraph_index, reaction_type, actor_key)
    VALUES (?, ?, ?, ?)
  `);
  [0, 1, 1, 1, 3, 3, 4, 4, 4, 4, 6].forEach((pIdx, idx) => {
    insertSpark.run(post1Id, pIdx, idx % 2 === 0 ? 'resonant' : 'insightful', `seed-${idx}`);
  });
  [0, 2, 2, 3, 3, 3].forEach((pIdx, idx) => {
    insertSpark.run(post2Id, pIdx, 'resonant', `seed-p2-${idx}`);
  });

  // Seed threaded stance-tagged comments
  const insertComment = db.prepare(`
    INSERT INTO comments (post_id, author_id, parent_id, stance, content, upvotes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const c1 = insertComment.run(
    post1Id,
    julianId,
    null,
    'insight',
    'The comparison between clerestory daylight and typographic line measure is spot-on. Even hardware interfaces benefit when every visual element earns its place.',
    7,
    '2026-11-11T14:20:00Z'
  );
  insertComment.run(
    post1Id,
    claraId,
    Number(c1.lastInsertRowid),
    'note',
    'Thank you Julian—your essay on physical detents actually pushed me to add the concluding courtyard section in v2.',
    4,
    '2026-11-12T15:00:00Z'
  );
  insertComment.run(
    post1Id,
    julianId,
    null,
    'question',
    'How do you balance healthy editorial friction with collaborative teams that need rapid drafting cycles?',
    3,
    '2026-11-13T09:10:00Z'
  );
  insertComment.run(
    post2Id,
    julianId,
    null,
    'counterpoint',
    'One caveat with margin notes: if too many readers annotate the same opening sentence, the gutter needs clean visual grouping so the prose stays serene.',
    5,
    '2026-11-12T11:30:00Z'
  );
}
