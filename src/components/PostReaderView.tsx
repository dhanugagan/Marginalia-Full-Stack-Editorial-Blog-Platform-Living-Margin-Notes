import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Edit3,
  History,
  MessageSquare,
  Moon,
  Pause,
  Play,
  Reply,
  Square,
  Sun,
  Trash2,
  Volume2,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatEditorialDate, formatRelativeTime } from '../lib/diff';
import type {
  Comment,
  CommentStance,
  HighlightColor,
  MarginAnnotation,
  Post,
  User,
} from '../types';
import { EditorialMarkdown, parseMarkdownBlocks } from './EditorialMarkdown';
import { RevisionDiffDrawer } from './RevisionDiffDrawer';

interface PostReaderViewProps {
  postSlugOrId: string | number;
  initialParagraphFocus?: number | null;
  currentUser: User | null;
  isDark: boolean;
  onToggleTheme: () => void;
  onBack: () => void;
  onEdit: (post: Post) => void;
  onDeleted: (postId: number) => void;
  onRequireAuth: () => void;
}

const STANCE_LABELS: Record<CommentStance, string> = {
  insight: 'Insight',
  question: 'Question',
  counterpoint: 'Counterpoint',
  note: 'Note',
};

export const PostReaderView: React.FC<PostReaderViewProps> = ({
  postSlugOrId,
  initialParagraphFocus = null,
  currentUser,
  isDark,
  onToggleTheme,
  onBack,
  onEdit,
  onDeleted,
  onRequireAuth,
}) => {
  const [post, setPost] = useState<Post | null>(null);
  const [sparksByParagraph, setSparksByParagraph] = useState<Record<number, number>>({});
  const [annotations, setAnnotations] = useState<MarginAnnotation[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reader workspace states
  const [fontSize, setFontSize] = useState<'compact' | 'standard' | 'large'>('standard');
  const [focusMode, setFocusMode] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [revisionDrawerOpen, setRevisionDrawerOpen] = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);

  // Margin annotation composer
  const [activeParagraph, setActiveParagraph] = useState<number | null>(initialParagraphFocus);
  const [selectedQuote, setSelectedQuote] = useState('');
  const [annotationNote, setAnnotationNote] = useState('');
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('lapis');
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // Comment composer & filters
  const [stanceFilter, setStanceFilter] = useState<'all' | CommentStance>('all');
  const [commentStance, setCommentStance] = useState<CommentStance>('insight');
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [postingComment, setPostingComment] = useState(false);

  // Sync-Read Audio Narration (Web Speech API)
  const [audioStatus, setAudioStatus] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [narratingParagraph, setNarratingParagraph] = useState<number | null>(null);
  const speechActiveRef = useRef(false);

  const blocks = useMemo(() => (post ? parseMarkdownBlocks(post.content) : []), [post]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.posts
      .get(postSlugOrId)
      .then(async (res) => {
        if (!active) return;
        setPost(res.post);
        setSparksByParagraph(res.sparksByParagraph || {});
        const [annRes, comRes] = await Promise.all([
          api.annotations.list(res.post.id),
          api.comments.list(res.post.id),
        ]);
        if (!active) return;
        setAnnotations(annRes.annotations);
        setComments(comRes.comments);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load essay.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      speechActiveRef.current = false;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [postSlugOrId]);

  useEffect(() => {
    if (initialParagraphFocus !== null && !loading) {
      const el = document.getElementById(`para-${initialParagraphFocus}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [initialParagraphFocus, loading]);

  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(100, Math.max(0, (window.scrollY / docHeight) * 100)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const speakParagraphFrom = (startIndex: number, rate: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const readableBlocks = blocks.filter((b) => b.text.trim().length > 0 && b.type !== 'code');
    const queue = readableBlocks.filter((b) => b.index >= startIndex);
    if (queue.length === 0) {
      speechActiveRef.current = false;
      setAudioStatus('idle');
      setNarratingParagraph(null);
      return;
    }

    window.speechSynthesis.cancel();
    speechActiveRef.current = true;
    setAudioStatus('playing');

    let cursor = 0;
    const speakNext = () => {
      if (!speechActiveRef.current || cursor >= queue.length) {
        speechActiveRef.current = false;
        setAudioStatus('idle');
        setNarratingParagraph(null);
        return;
      }
      const block = queue[cursor++];
      setNarratingParagraph(block.index);
      const el = document.getElementById(`para-${block.index}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const utterance = new SpeechSynthesisUtterance(block.text.replace(/[*_`[\]()]/g, ''));
      utterance.rate = rate;
      utterance.onend = () => {
        if (speechActiveRef.current) speakNext();
      };
      utterance.onerror = () => {
        speechActiveRef.current = false;
        setAudioStatus('idle');
        setNarratingParagraph(null);
      };
      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  const handleAudioToggle = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (audioStatus === 'idle') {
      speakParagraphFrom(0, playbackRate);
    } else if (audioStatus === 'playing') {
      window.speechSynthesis.pause();
      setAudioStatus('paused');
    } else {
      window.speechSynthesis.resume();
      setAudioStatus('playing');
    }
  };

  const handleAudioStop = () => {
    speechActiveRef.current = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAudioStatus('idle');
    setNarratingParagraph(null);
  };

  const handleParagraphSelect = (paragraphIndex: number, quote?: string) => {
    setActiveParagraph(paragraphIndex);
    if (quote) setSelectedQuote(quote);
  };

  const handleSparkParagraph = async (paragraphIndex: number) => {
    if (!post) return;
    try {
      const res = await api.posts.spark(post.id, paragraphIndex, 'resonant');
      setSparksByParagraph(res.sparksByParagraph);
    } catch {
      // ignore transient error
    }
  };

  const handleCreateAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (activeParagraph === null || !annotationNote.trim()) return;
    setSavingAnnotation(true);
    try {
      const res = await api.annotations.create(post.id, {
        paragraph_index: activeParagraph,
        selected_quote: selectedQuote,
        note: annotationNote,
        highlight_color: highlightColor,
      });
      setAnnotations((prev) => [...prev, res.annotation]);
      setAnnotationNote('');
      setSelectedQuote('');
    } finally {
      setSavingAnnotation(false);
    }
  };

  const handleDeleteAnnotation = async (annotationId: number) => {
    await api.annotations.delete(annotationId);
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      const res = await api.comments.create(post.id, {
        content: commentText,
        parent_id: replyingTo?.id || null,
        stance: commentStance,
      });
      setComments((prev) => [...prev, res.comment]);
      setCommentText('');
      setReplyingTo(null);
    } finally {
      setPostingComment(false);
    }
  };

  const handleUpvoteComment = async (commentId: number) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const res = await api.comments.upvote(commentId);
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, upvotes: res.upvotes, user_upvoted: res.upvoted } : c
      )
    );
  };

  const handleDeleteComment = async (commentId: number) => {
    await api.comments.delete(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
  };

  const handleDeletePost = async () => {
    if (!post) return;
    setDeletingPost(true);
    try {
      await api.posts.delete(post.id);
      onDeleted(post.id);
    } finally {
      setDeletingPost(false);
    }
  };

  const filteredTopComments = useMemo(() => {
    const roots = comments.filter((c) => !c.parent_id);
    if (stanceFilter === 'all') return roots;
    return roots.filter((c) => c.stance === stanceFilter);
  }, [comments, stanceFilter]);

  const repliesByParent = useMemo(() => {
    const map: Record<number, Comment[]> = {};
    for (const c of comments) {
      if (c.parent_id) {
        if (!map[c.parent_id]) map[c.parent_id] = [];
        map[c.parent_id].push(c);
      }
    }
    return map;
  }, [comments]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 space-y-6 animate-pulse">
        <div className="h-4 w-32 bg-[#EFEAE0] dark:bg-[#24211D] rounded" />
        <div className="h-12 w-3/4 bg-[#EFEAE0] dark:bg-[#24211D] rounded" />
        <div className="h-80 w-full bg-[#EFEAE0] dark:bg-[#24211D] rounded-lg" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-4">
        <p className="font-serif-display text-2xl text-[#181614] dark:text-[#F5F0E8]">
          {error || 'Essay not found'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] cursor-pointer"
        >
          Return to Edition
        </button>
      </div>
    );
  }

  const isAuthor = currentUser?.id === post.author_id;
  const maxSpark = Math.max(
    1,
    ...blocks.map((b) => (sparksByParagraph[b.index] || 0) + annotations.filter((a) => a.paragraph_index === b.index).length)
  );
  const supportsSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <div className="relative">
      {/* Razor-thin reading depth bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-[2px] bg-transparent pointer-events-none">
        <div
          className="h-full bg-[#1E3A8A] dark:bg-[#60A5FA] transition-[width] duration-75"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        {/* Reader Workspace Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E4DDD0] dark:border-[#2E2924]">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#181614] dark:hover:text-[#F5F0E8] cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Edition</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {supportsSpeech && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EFEAE0] dark:bg-[#24211D] text-xs">
                <Volume2 className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#93C5FD]" />
                <button
                  type="button"
                  onClick={handleAudioToggle}
                  className="inline-flex items-center gap-1 font-medium text-[#181614] dark:text-[#F5F0E8] cursor-pointer whitespace-nowrap"
                >
                  {audioStatus === 'playing' ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Audio</span>
                    </>
                  ) : audioStatus === 'paused' ? (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Listen</span>
                    </>
                  )}
                </button>
                {audioStatus !== 'idle' && (
                  <button
                    type="button"
                    onClick={handleAudioStop}
                    aria-label="Stop narration"
                    className="p-1 text-[#78716C] hover:text-[#181614] dark:hover:text-[#F5F0E8] cursor-pointer"
                  >
                    <Square className="w-3 h-3" />
                  </button>
                )}
                <select
                  aria-label="Audio playback speed"
                  value={playbackRate}
                  onChange={(e) => {
                    const nextRate = Number(e.target.value);
                    setPlaybackRate(nextRate);
                    if (audioStatus === 'playing' && narratingParagraph !== null) {
                      speakParagraphFrom(narratingParagraph, nextRate);
                    }
                  }}
                  className="bg-transparent font-mono-code text-[11px] text-[#57534E] dark:text-[#A8A29E] focus:outline-none cursor-pointer"
                >
                  <option value={0.9}>0.9x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setRevisionDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D6CEBE] dark:border-[#332E29] text-[#44403C] dark:text-[#D6D3D1] hover:bg-[#EFEAE0] dark:hover:bg-[#24211D] cursor-pointer whitespace-nowrap"
            >
              <History className="w-3.5 h-3.5" />
              <span className="font-mono-code">History (v{post.revision_count || 1})</span>
            </button>

            <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-[#EFEAE0] dark:bg-[#24211D]">
              {(['compact', 'standard', 'large'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize cursor-pointer whitespace-nowrap ${
                    fontSize === sz
                      ? 'bg-[#FBF9F5] dark:bg-[#141210] text-[#181614] dark:text-[#F5F0E8]'
                      : 'text-[#57534E] dark:text-[#A8A29E]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFocusMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer whitespace-nowrap ${
                focusMode
                  ? 'bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] border-transparent'
                  : 'border-[#D6CEBE] dark:border-[#332E29] text-[#44403C] dark:text-[#D6D3D1] hover:bg-[#EFEAE0] dark:hover:bg-[#24211D]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{focusMode ? 'Focus Active' : 'Focus Mode'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to archival paper theme' : 'Switch to night edition'}
              className="p-2 rounded-lg border border-[#D6CEBE] dark:border-[#332E29] text-[#44403C] dark:text-[#D6D3D1] hover:bg-[#EFEAE0] dark:hover:bg-[#24211D] cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {isAuthor && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(post)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] hover:opacity-90 cursor-pointer whitespace-nowrap"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeletePost(true)}
                  aria-label="Delete essay"
                  className="p-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Inline Delete Confirmation */}
        {confirmDeletePost && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-red-900 dark:text-red-200">
              Permanently delete "{post.title}" along with its margin notes and discussion?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePost(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D6CEBE] dark:border-[#332E29] bg-white dark:bg-[#1A1816] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPost}
                onClick={handleDeletePost}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-700 text-white hover:bg-red-800 cursor-pointer"
              >
                {deletingPost ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}

        {/* Paragraph Resonance Heatmap Scrubber */}
        {!focusMode && blocks.length > 0 && (
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E] whitespace-nowrap">
              Passage Resonance
            </span>
            <div className="flex-1 flex items-center gap-1 h-5">
              {blocks.map((b) => {
                const heat =
                  (sparksByParagraph[b.index] || 0) +
                  annotations.filter((a) => a.paragraph_index === b.index).length * 2;
                const intensity = heat / maxSpark;
                return (
                  <button
                    key={b.index}
                    type="button"
                    title={`Jump to passage ${b.index + 1}${heat > 0 ? ` (${heat} interactions)` : ''}`}
                    onClick={() => {
                      setActiveParagraph(b.index);
                      document.getElementById(`para-${b.index}`)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    }}
                    className="flex-1 h-2 rounded-xs transition-all cursor-pointer hover:h-3.5"
                    style={{
                      backgroundColor:
                        heat > 0
                          ? isDark
                            ? `rgba(96, 165, 250, ${0.25 + intensity * 0.75})`
                            : `rgba(30, 58, 138, ${0.2 + intensity * 0.8})`
                          : isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(28,25,23,0.08)',
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Essay Masthead Header */}
        <header className="max-w-3xl mt-10 pb-8 border-b border-[#E4DDD0] dark:border-[#2E2924]">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
            <span>{post.category}</span>
            <span aria-hidden="true">·</span>
            <span>{formatEditorialDate(post.created_at)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-code">{post.reading_time_min} min read</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-code">{post.views_count} reads</span>
            {post.status === 'draft' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#92400E] dark:text-amber-300 font-medium">Draft</span>
              </>
            )}
          </div>

          <h1 className="font-serif-display text-4xl sm:text-5xl font-medium tracking-tight text-[#181614] dark:text-[#F5F0E8] mt-4 leading-[1.12] text-balance">
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="text-xs sm:text-sm uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mt-4 leading-relaxed">
              {post.subtitle}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3.5">
            {post.author_avatar ? (
              <img
                src={post.author_avatar}
                alt={post.author_name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border border-[#E4DDD0] dark:border-[#2E2924]"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#EFEAE0] dark:bg-[#24211D] flex items-center justify-center font-serif-display text-base font-medium text-[#181614] dark:text-[#F5F0E8]">
                {post.author_name.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-[#181614] dark:text-[#F5F0E8]">
                {post.author_name}{' '}
                <span className="text-xs font-normal text-[#78716C] dark:text-[#A8A29E]">
                  @{post.author_username}
                </span>
              </p>
              {post.author_bio && (
                <p className="text-xs text-[#78716C] dark:text-[#A8A29E] line-clamp-1">
                  {post.author_bio}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* 70/30 Asymmetric Reading Canvas */}
        <div
          className={`mt-10 grid gap-10 ${
            focusMode ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 lg:grid-cols-12'
          }`}
        >
          <article className={focusMode ? '' : 'lg:col-span-8 max-w-2xl'}>
            {post.cover_image && (
              <figure className="mb-10">
                <div className="overflow-hidden rounded-lg bg-[#EFEAE0] dark:bg-[#1C1A17]">
                  <img
                    src={post.cover_image}
                    alt={post.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[16/9] object-cover"
                  />
                </div>
                <figcaption className="text-xs font-serif-display italic text-[#78716C] dark:text-[#A8A29E] mt-2.5">
                  Fig. 1 — {post.subtitle || post.title}
                </figcaption>
              </figure>
            )}

            <EditorialMarkdown
              content={post.content}
              annotations={annotations}
              sparksByParagraph={sparksByParagraph}
              activeParagraphIndex={activeParagraph}
              narratingParagraphIndex={narratingParagraph}
              fontSize={fontSize}
              onParagraphSelect={handleParagraphSelect}
              onSelectAnnotation={(ann) => setActiveParagraph(ann.paragraph_index)}
              onSparkParagraph={handleSparkParagraph}
            />
          </article>

          {/* 30% Living Margin Annotations Rail */}
          {!focusMode && (
            <aside className="lg:col-span-4 lg:border-l lg:border-[#E4DDD0] lg:dark:border-[#2E2924] lg:pl-8">
              <div className="lg:sticky lg:top-8 space-y-6">
                <div className="pb-4 border-b border-[#E4DDD0] dark:border-[#2E2924]">
                  <p className="text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
                    Living Margin Notes
                  </p>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1 leading-relaxed">
                    Select any text in the essay or click a paragraph&apos;s margin link to anchor a note.
                  </p>
                </div>

                {activeParagraph !== null && (
                  <form
                    onSubmit={handleCreateAnnotation}
                    className="p-4 rounded-xl bg-[#F2EDE4] dark:bg-[#1C1A17] border border-[#E4DDD0] dark:border-[#2E2924] space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
                      <span className="font-mono-code font-medium text-[#1E3A8A] dark:text-[#93C5FD]">
                        Paragraph {activeParagraph + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveParagraph(null);
                          setSelectedQuote('');
                        }}
                        className="hover:text-[#181614] dark:hover:text-[#F5F0E8] cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    {selectedQuote && (
                      <p className="text-xs italic font-serif-display text-[#44403C] dark:text-[#D6D3D1] bg-[#FBF9F5] dark:bg-[#141210] px-2.5 py-2 rounded border border-[#E4DDD0] dark:border-[#2E2924]">
                        &ldquo;{selectedQuote}&rdquo;
                      </p>
                    )}

                    <textarea
                      required
                      rows={3}
                      value={annotationNote}
                      onChange={(e) => setAnnotationNote(e.target.value)}
                      placeholder={
                        currentUser
                          ? 'Write a margin annotation or citation...'
                          : 'Sign in to add your margin annotation...'
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#121110] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {(['lapis', 'amber', 'forest'] as const).map((clr) => (
                          <button
                            key={clr}
                            type="button"
                            onClick={() => setHighlightColor(clr)}
                            className={`px-2 py-1 text-[11px] capitalize rounded cursor-pointer ${
                              highlightColor === clr
                                ? 'bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614]'
                                : 'text-[#57534E] dark:text-[#A8A29E] hover:bg-[#E4DDD0] dark:hover:bg-[#2A2622]'
                            }`}
                          >
                            {clr}
                          </button>
                        ))}
                      </div>
                      <button
                        type="submit"
                        disabled={savingAnnotation}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1E3A8A] dark:bg-[#3B82F6] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      >
                        {savingAnnotation ? 'Pinning...' : 'Pin Note'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {annotations.length === 0 ? (
                    <p className="text-xs text-[#78716C] dark:text-[#A8A29E] italic py-4">
                      No margin annotations yet. Highlight any sentence to start the margin dialogue.
                    </p>
                  ) : (
                    annotations.map((ann) => {
                      const focused = activeParagraph === ann.paragraph_index;
                      return (
                        <div
                          key={ann.id}
                          onClick={() => {
                            setActiveParagraph(ann.paragraph_index);
                            document.getElementById(`para-${ann.paragraph_index}`)?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            });
                          }}
                          className={`p-3.5 rounded-lg border transition-colors cursor-pointer ${
                            focused
                              ? 'bg-[#F2EDE4] dark:bg-[#1F1C18] border-[#1E3A8A]/40 dark:border-[#60A5FA]/40'
                              : 'border-[#E4DDD0] dark:border-[#2E2924] hover:bg-[#F7F4EE] dark:hover:bg-[#1A1816]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                            <span className="font-mono-code">
                              Para {ann.paragraph_index + 1} · {ann.author_name}
                            </span>
                            {currentUser?.id === ann.author_id && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAnnotation(ann.id);
                                }}
                                aria-label="Remove margin note"
                                className="hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {ann.selected_quote && (
                            <p className="text-xs italic font-serif-display text-[#57534E] dark:text-[#A8A29E] mt-1.5">
                              &ldquo;{ann.selected_quote}&rdquo;
                            </p>
                          )}
                          <p className="text-xs text-[#181614] dark:text-[#EDE8DF] mt-1.5 leading-relaxed">
                            {ann.note}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* Threaded Stance-Tagged Comment Salon */}
        <section
          aria-labelledby="discussion-heading"
          className="mt-16 pt-12 border-t border-[#E4DDD0] dark:border-[#2E2924] max-w-3xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
                Reader Dialogue
              </p>
              <h2
                id="discussion-heading"
                className="font-serif-display text-2xl sm:text-3xl font-medium text-[#181614] dark:text-[#F5F0E8] mt-1"
              >
                Comments &amp; Counterpoints ({comments.length})
              </h2>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFEAE0] dark:bg-[#24211D]">
              {(['all', 'insight', 'question', 'counterpoint', 'note'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStanceFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer whitespace-nowrap ${
                    stanceFilter === tab
                      ? 'bg-[#FBF9F5] dark:bg-[#141210] text-[#181614] dark:text-[#F5F0E8]'
                      : 'text-[#57534E] dark:text-[#A8A29E]'
                  }`}
                >
                  {tab === 'all' ? 'All' : STANCE_LABELS[tab]}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handlePostComment}
            className="mt-7 p-5 rounded-xl bg-[#F2EDE4]/70 dark:bg-[#1A1816] border border-[#E4DDD0] dark:border-[#2E2924] space-y-4"
          >
            {replyingTo && (
              <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E] pb-2 border-b border-[#E4DDD0] dark:border-[#2E2924]">
                <span>Replying to {replyingTo.author_name}</span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="underline cursor-pointer"
                >
                  Cancel reply
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#78716C] dark:text-[#A8A29E] mr-1">Stance:</span>
              {(['insight', 'question', 'counterpoint', 'note'] as const).map((stance) => (
                <button
                  key={stance}
                  type="button"
                  onClick={() => setCommentStance(stance)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    commentStance === stance
                      ? 'bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614]'
                      : 'bg-white dark:bg-[#121110] border border-[#D6CEBE] dark:border-[#332E29] text-[#57534E] dark:text-[#A8A29E]'
                  }`}
                >
                  {STANCE_LABELS[stance]}
                </button>
              ))}
            </div>

            <textarea
              required
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                currentUser
                  ? 'Contribute an insight, question, or counterpoint to the discussion...'
                  : 'Sign in to participate in the comment salon...'
              }
              className="w-full px-4 py-3 text-sm rounded-lg bg-white dark:bg-[#121110] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
            />

            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                {currentUser ? `Posting as ${currentUser.name}` : 'Reader authentication required'}
              </span>
              <button
                type="submit"
                disabled={postingComment}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] hover:opacity-90 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{postingComment ? 'Posting...' : replyingTo ? 'Post Reply' : 'Post Comment'}</span>
              </button>
            </div>
          </form>

          <div className="mt-8 divide-y divide-[#E4DDD0] dark:divide-[#2E2924]">
            {filteredTopComments.length === 0 ? (
              <p className="py-8 text-sm text-[#78716C] dark:text-[#A8A29E] italic">
                No comments in this stance category yet.
              </p>
            ) : (
              filteredTopComments.map((comment) => {
                const replies = repliesByParent[comment.id] || [];
                return (
                  <div key={comment.id} className="py-6">
                    <CommentRow
                      comment={comment}
                      currentUser={currentUser}
                      postAuthorId={post.author_id}
                      onUpvote={handleUpvoteComment}
                      onReply={(c) => {
                        setReplyingTo(c);
                        document.getElementById('discussion-heading')?.scrollIntoView({
                          behavior: 'smooth',
                        });
                      }}
                      onDelete={handleDeleteComment}
                    />
                    {replies.length > 0 && (
                      <div className="mt-4 pl-6 sm:pl-8 space-y-4 border-t border-[#EFEAE0] dark:border-[#24211D] pt-4">
                        {replies.map((reply) => (
                          <CommentRow
                            key={reply.id}
                            comment={reply}
                            currentUser={currentUser}
                            postAuthorId={post.author_id}
                            isReply
                            onUpvote={handleUpvoteComment}
                            onDelete={handleDeleteComment}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <RevisionDiffDrawer
        postId={post.id}
        isOpen={revisionDrawerOpen}
        onClose={() => setRevisionDrawerOpen(false)}
      />
    </div>
  );
};

interface CommentRowProps {
  comment: Comment;
  currentUser: User | null;
  postAuthorId: number;
  isReply?: boolean;
  onUpvote: (commentId: number) => void;
  onReply?: (comment: Comment) => void;
  onDelete: (commentId: number) => void;
}

const CommentRow: React.FC<CommentRowProps> = ({
  comment,
  currentUser,
  postAuthorId,
  isReply = false,
  onUpvote,
  onReply,
  onDelete,
}) => {
  const canDelete =
    currentUser && (currentUser.id === comment.author_id || currentUser.id === postAuthorId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#78716C] dark:text-[#A8A29E]">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#181614] dark:text-[#F5F0E8]">
            {comment.author_name}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-[#1E3A8A] dark:text-[#93C5FD] font-medium">
            {STANCE_LABELS[comment.stance]}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatRelativeTime(comment.created_at)}</span>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            aria-label="Delete comment"
            className="text-[#78716C] hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-sm leading-relaxed text-[#292524] dark:text-[#DCD6CC]">{comment.content}</p>

      <div className="flex items-center gap-4 pt-1 text-xs">
        <button
          type="button"
          onClick={() => onUpvote(comment.id)}
          className={`inline-flex items-center gap-1 font-mono-code transition-colors cursor-pointer ${
            comment.user_upvoted
              ? 'text-[#1E3A8A] dark:text-[#93C5FD] font-medium'
              : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#181614] dark:hover:text-[#F5F0E8]'
          }`}
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>{comment.upvotes}</span>
        </button>

        {!isReply && onReply && (
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="inline-flex items-center gap-1 text-[#57534E] dark:text-[#A8A29E] hover:text-[#181614] dark:hover:text-[#F5F0E8] cursor-pointer"
          >
            <Reply className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>
        )}
      </div>
    </div>
  );
};
