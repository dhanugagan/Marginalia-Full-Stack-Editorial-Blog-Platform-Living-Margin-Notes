import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookMarked, Edit3, Moon, Search, Sun, Trash2 } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { PostEditorStudio } from './components/PostEditorStudio';
import { PostReaderView } from './components/PostReaderView';
import { api } from './lib/api';
import { formatEditorialDate, formatRelativeTime } from './lib/diff';
import {
  EDITORIAL_CATEGORIES,
  type MarginAnnotation,
  type Post,
  type User,
} from './types';

type RouteView =
  | { type: 'edition' }
  | { type: 'archive' }
  | { type: 'annotations' }
  | { type: 'studio' }
  | { type: 'reader'; slugOrId: string | number; paragraphFocus?: number | null }
  | { type: 'editor'; post?: Post | null };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [route, setRoute] = useState<RouteView>({ type: 'edition' });

  const [posts, setPosts] = useState<Post[]>([]);
  const [myDrafts, setMyDrafts] = useState<Post[]>([]);
  const [recentAnnotations, setRecentAnnotations] = useState<MarginAnnotation[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Operational Archive Filters
  const [category, setCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'discussed'>('latest');

  // Theme state (Archival Paper vs Night Folio)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('marginalia_theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('marginalia_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('marginalia_theme', 'light');
    }
  }, [isDark]);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await api.posts.list({
        category: category === 'All' ? undefined : category,
        q: searchQuery.trim() || undefined,
        sort: sortBy,
      });
      setPosts(res.posts);
    } finally {
      setLoadingPosts(false);
    }
  }, [category, searchQuery, sortBy]);

  const loadMyStudioPosts = useCallback(async (activeUser: User | null) => {
    if (!activeUser) {
      setMyDrafts([]);
      return;
    }
    try {
      const res = await api.posts.list({ status: 'all', author: activeUser.username });
      setMyDrafts(res.posts);
    } catch {
      setMyDrafts([]);
    }
  }, []);

  const loadRecentAnnotations = useCallback(async () => {
    try {
      const res = await api.annotations.recent();
      setRecentAnnotations(res.annotations);
    } catch {
      setRecentAnnotations([]);
    }
  }, []);

  useEffect(() => {
    api.auth
      .me()
      .then((res) => {
        setUser(res.user);
        loadMyStudioPosts(res.user);
      })
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
  }, [loadMyStudioPosts]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (route.type === 'annotations') {
      loadRecentAnnotations();
    }
  }, [route.type, loadRecentAnnotations]);

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setMyDrafts([]);
    if (route.type === 'studio' || route.type === 'editor') {
      setRoute({ type: 'edition' });
    }
  };

  const openEditor = (existing?: Post | null) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setRoute({ type: 'editor', post: existing || null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openReader = (slugOrId: string | number, paragraphFocus: number | null = null) => {
    setRoute({ type: 'reader', slugOrId, paragraphFocus });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const leadPost = useMemo(() => posts[0] || null, [posts]);
  const secondaryPosts = useMemo(() => posts.slice(1, 4), [posts]);
  const archiveRemainder = useMemo(() => posts.slice(4), [posts]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] dark:bg-[#121110] text-[#1C1917] dark:text-[#EDE8DF] transition-colors duration-150">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-[#E4DDD0] dark:border-[#2E2924] bg-[#FBF9F5]/95 dark:bg-[#121110]/95 backdrop-blur-xs">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <button
            type="button"
            onClick={() => setRoute({ type: 'edition' })}
            className="font-serif-display text-2xl font-semibold tracking-tight text-[#181614] dark:text-[#F5F0E8] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Marginalia
          </button>

          {/* Zone 2: 4–5 single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E] dark:text-[#A8A29E]">
            <button
              type="button"
              onClick={() => setRoute({ type: 'edition' })}
              className={`whitespace-nowrap shrink-0 cursor-pointer hover:text-[#181614] dark:hover:text-[#F5F0E8] hover:underline underline-offset-4 ${
                route.type === 'edition' ? 'text-[#181614] dark:text-[#F5F0E8] underline' : ''
              }`}
            >
              Edition
            </button>
            <button
              type="button"
              onClick={() => setRoute({ type: 'archive' })}
              className={`whitespace-nowrap shrink-0 cursor-pointer hover:text-[#181614] dark:hover:text-[#F5F0E8] hover:underline underline-offset-4 ${
                route.type === 'archive' ? 'text-[#181614] dark:text-[#F5F0E8] underline' : ''
              }`}
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => setRoute({ type: 'annotations' })}
              className={`whitespace-nowrap shrink-0 cursor-pointer hover:text-[#181614] dark:hover:text-[#F5F0E8] hover:underline underline-offset-4 ${
                route.type === 'annotations' ? 'text-[#181614] dark:text-[#F5F0E8] underline' : ''
              }`}
            >
              Annotations
            </button>
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setAuthModalOpen(true);
                } else {
                  loadMyStudioPosts(user);
                  setRoute({ type: 'studio' });
                }
              }}
              className={`whitespace-nowrap shrink-0 cursor-pointer hover:text-[#181614] dark:hover:text-[#F5F0E8] hover:underline underline-offset-4 ${
                route.type === 'studio' ? 'text-[#181614] dark:text-[#F5F0E8] underline' : ''
              }`}
            >
              My Desk
            </button>
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="whitespace-nowrap shrink-0 cursor-pointer hover:text-[#181614] dark:hover:text-[#F5F0E8] hover:underline underline-offset-4"
              >
                Sign Out
              </button>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => openEditor(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                Write Essay
              </button>
            ) : (
              <button
                type="button"
                disabled={!authReady}
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Compact mobile navigation row */}
        <div className="md:hidden border-t border-[#EFEAE0] dark:border-[#24211D] px-4 py-2 flex items-center gap-5 overflow-x-auto text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
          <button
            type="button"
            onClick={() => setRoute({ type: 'edition' })}
            className="whitespace-nowrap shrink-0 cursor-pointer"
          >
            Edition
          </button>
          <button
            type="button"
            onClick={() => setRoute({ type: 'archive' })}
            className="whitespace-nowrap shrink-0 cursor-pointer"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={() => setRoute({ type: 'annotations' })}
            className="whitespace-nowrap shrink-0 cursor-pointer"
          >
            Annotations
          </button>
          <button
            type="button"
            onClick={() => (user ? setRoute({ type: 'studio' }) : setAuthModalOpen(true))}
            className="whitespace-nowrap shrink-0 cursor-pointer"
          >
            My Desk
          </button>
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1">
        {route.type === 'reader' && (
          <PostReaderView
            postSlugOrId={route.slugOrId}
            initialParagraphFocus={route.paragraphFocus}
            currentUser={user}
            isDark={isDark}
            onToggleTheme={() => setIsDark((d) => !d)}
            onBack={() => setRoute({ type: 'edition' })}
            onEdit={(p) => openEditor(p)}
            onDeleted={() => {
              loadPosts();
              loadMyStudioPosts(user);
              setRoute({ type: 'edition' });
            }}
            onRequireAuth={() => setAuthModalOpen(true)}
          />
        )}

        {route.type === 'editor' && (
          <PostEditorStudio
            existingPost={route.post}
            onCancel={() => setRoute({ type: 'edition' })}
            onSaved={(saved) => {
              loadPosts();
              loadMyStudioPosts(user);
              if (saved.status === 'draft') {
                setRoute({ type: 'studio' });
              } else {
                openReader(saved.slug);
              }
            }}
          />
        )}

        {route.type === 'annotations' && (
          <section className="max-w-[1040px] mx-auto px-4 sm:px-8 py-12">
            <div className="pb-6 border-b border-[#E4DDD0] dark:border-[#2E2924] flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
                  Reader Margin Stream
                </p>
                <h1 className="font-serif-display text-3xl sm:text-4xl font-medium text-[#181614] dark:text-[#F5F0E8] mt-2 text-balance">
                  Recent Living Annotations
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setIsDark((d) => !d)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-[#D6CEBE] dark:border-[#332E29] cursor-pointer"
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{isDark ? 'Paper Mode' : 'Night Folio'}</span>
              </button>
            </div>

            <div className="divide-y divide-[#E4DDD0] dark:divide-[#2E2924]">
              {recentAnnotations.length === 0 ? (
                <p className="py-12 text-sm text-[#78716C] dark:text-[#A8A29E] italic">
                  No margin annotations published yet. Open any essay and highlight a sentence to anchor the first margin note.
                </p>
              ) : (
                recentAnnotations.map((ann) => (
                  <article key={ann.id} className="py-7 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E]">
                      <span className="font-medium text-[#181614] dark:text-[#F5F0E8]">
                        {ann.author_name}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        annotated Paragraph {ann.paragraph_index + 1} in{' '}
                        <button
                          type="button"
                          onClick={() =>
                            ann.post_slug && openReader(ann.post_slug, ann.paragraph_index)
                          }
                          className="underline decoration-[#D6CEBE] underline-offset-4 hover:text-[#1E3A8A] dark:hover:text-[#93C5FD] cursor-pointer"
                        >
                          {ann.post_title}
                        </button>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTime(ann.created_at)}</span>
                    </div>

                    {ann.selected_quote && (
                      <p className="font-serif-display italic text-base text-[#57534E] dark:text-[#A8A29E]">
                        &ldquo;{ann.selected_quote}&rdquo;
                      </p>
                    )}

                    <p className="text-sm text-[#181614] dark:text-[#EDE8DF] leading-relaxed max-w-2xl">
                      {ann.note}
                    </p>

                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          ann.post_slug && openReader(ann.post_slug, ann.paragraph_index)
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A8A] dark:text-[#93C5FD] hover:underline cursor-pointer"
                      >
                        <span>Jump to passage</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {route.type === 'studio' && (
          <section className="max-w-[1040px] mx-auto px-4 sm:px-8 py-12">
            <div className="pb-6 border-b border-[#E4DDD0] dark:border-[#2E2924] flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
                  Contributor Desk · @{user?.username}
                </p>
                <h1 className="font-serif-display text-3xl sm:text-4xl font-medium text-[#181614] dark:text-[#F5F0E8] mt-2">
                  Your Drafts &amp; Published Essays
                </h1>
              </div>
              <button
                type="button"
                onClick={() => openEditor(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] cursor-pointer"
              >
                New Manuscript
              </button>
            </div>

            <div className="divide-y divide-[#E4DDD0] dark:divide-[#2E2924]">
              {myDrafts.length === 0 ? (
                <div className="py-12 space-y-3">
                  <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">
                    You have not drafted or published any essays yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => openEditor(null)}
                    className="text-xs font-medium text-[#1E3A8A] dark:text-[#93C5FD] underline cursor-pointer"
                  >
                    Open the Dual-Pane Studio
                  </button>
                </div>
              ) : (
                myDrafts.map((item) => (
                  <div
                    key={item.id}
                    className="py-6 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E]">
                        <span
                          className={
                            item.status === 'draft'
                              ? 'text-[#92400E] dark:text-amber-300 font-medium'
                              : 'text-[#14532D] dark:text-emerald-300 font-medium'
                          }
                        >
                          {item.status === 'draft' ? 'Draft' : 'Published'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>Updated {formatEditorialDate(item.updated_at)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-code">v{item.revision_count || 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openReader(item.id)}
                        className="font-serif-display text-xl font-medium text-left text-[#181614] dark:text-[#F5F0E8] hover:underline cursor-pointer"
                      >
                        {item.title}
                      </button>
                      <p className="text-xs text-[#57534E] dark:text-[#A8A29E] line-clamp-1">
                        {item.excerpt}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditor(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D6CEBE] dark:border-[#332E29] hover:bg-[#EFEAE0] dark:hover:bg-[#24211D] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.posts.delete(item.id);
                          loadMyStudioPosts(user);
                          loadPosts();
                        }}
                        aria-label={`Delete ${item.title}`}
                        className="p-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {(route.type === 'edition' || route.type === 'archive') && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-8 pt-8 pb-20">
            {/* Operational Utility & Filter Bar (below header per Top Bar Contract) */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#E4DDD0] dark:border-[#2E2924]">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFEAE0] dark:bg-[#24211D] overflow-x-auto max-w-full">
                {EDITORIAL_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      category === cat
                        ? 'bg-[#FBF9F5] dark:bg-[#141210] text-[#181614] dark:text-[#F5F0E8] shadow-xs'
                        : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#181614] dark:hover:text-[#F5F0E8]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search essays..."
                    aria-label="Search essays"
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#1A1816] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] w-48 sm:w-56 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
                  />
                </div>

                <select
                  aria-label="Sort essays"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'latest' | 'popular' | 'discussed')}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#1A1816] border border-[#D6CEBE] dark:border-[#332E29] text-[#44403C] dark:text-[#D6D3D1] cursor-pointer"
                >
                  <option value="latest">Latest</option>
                  <option value="popular">Most Read</option>
                  <option value="discussed">Most Annotated</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsDark((d) => !d)}
                  aria-label={isDark ? 'Switch to Archival Paper' : 'Switch to Night Folio'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D6CEBE] dark:border-[#332E29] text-[#44403C] dark:text-[#D6D3D1] hover:bg-[#EFEAE0] dark:hover:bg-[#24211D] cursor-pointer whitespace-nowrap"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{isDark ? 'Paper' : 'Night'}</span>
                </button>
              </div>
            </div>

            {loadingPosts ? (
              <div className="py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
                <div className="lg:col-span-6 h-80 bg-[#EFEAE0] dark:bg-[#24211D] rounded-xl" />
                <div className="lg:col-span-6 h-80 bg-[#EFEAE0] dark:bg-[#24211D] rounded-xl" />
              </div>
            ) : posts.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <p className="font-serif-display text-2xl text-[#181614] dark:text-[#F5F0E8]">
                  No essays match your current filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCategory('All');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[#D6CEBE] dark:border-[#332E29] cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : route.type === 'archive' ? (
              /* Full Archive Index View */
              <div className="mt-10">
                <div className="pb-4 border-b border-[#E4DDD0] dark:border-[#2E2924]">
                  <p className="text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
                    Complete Catalog · {posts.length} {posts.length === 1 ? 'Essay' : 'Essays'}
                  </p>
                  <h1 className="font-serif-display text-3xl font-medium text-[#181614] dark:text-[#F5F0E8] mt-1">
                    Editorial Archive
                  </h1>
                </div>
                <div className="divide-y divide-[#E4DDD0] dark:divide-[#2E2924]">
                  {posts.map((post) => (
                    <ArchiveRow key={post.id} post={post} onOpen={() => openReader(post.slug)} />
                  ))}
                </div>
              </div>
            ) : (
              /* 3-Tier Editorial Front Page */
              <>
                {/* Tier 1: Lead Story Split */}
                {leadPost && (
                  <section className="py-10 border-b border-[#E4DDD0] dark:border-[#2E2924]">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                      <div className="lg:col-span-6 flex flex-col justify-between gap-6">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
                            <span>Lead Essay</span>
                            <span aria-hidden="true">·</span>
                            <span>{leadPost.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatEditorialDate(leadPost.created_at)}</span>
                          </div>

                          <h1 className="font-serif-display text-4xl sm:text-5xl font-medium tracking-tight text-[#181614] dark:text-[#F5F0E8] mt-4 leading-[1.1] text-balance">
                            <button
                              type="button"
                              onClick={() => openReader(leadPost.slug)}
                              className="text-left hover:opacity-80 transition-opacity cursor-pointer"
                            >
                              {leadPost.title}
                            </button>
                          </h1>

                          {leadPost.subtitle && (
                            <p className="text-xs uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mt-4 leading-relaxed">
                              {leadPost.subtitle}
                            </p>
                          )}

                          <p className="text-base text-[#44403C] dark:text-[#D6D3D1] mt-5 leading-relaxed max-w-xl">
                            {leadPost.excerpt}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#EFEAE0] dark:border-[#24211D]">
                          <div className="flex items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                            <span className="font-medium text-[#181614] dark:text-[#F5F0E8]">
                              {leadPost.author_name}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-code">
                              {leadPost.reading_time_min} min read
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-code">
                              {leadPost.annotation_count || 0} margin notes
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-code">
                              {leadPost.comment_count || 0} comments
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => openReader(leadPost.slug)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] hover:opacity-90 cursor-pointer whitespace-nowrap"
                          >
                            <span>Read Essay</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="lg:col-span-6">
                        <button
                          type="button"
                          onClick={() => openReader(leadPost.slug)}
                          className="block w-full h-full min-h-[280px] overflow-hidden rounded-xl bg-[#EFEAE0] dark:bg-[#1C1A17] cursor-pointer group"
                        >
                          {leadPost.cover_image ? (
                            <img
                              src={leadPost.cover_image}
                              alt={leadPost.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full lg:h-full aspect-[16/9] lg:aspect-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="w-full h-full min-h-[280px] flex flex-col items-center justify-center p-8 text-center">
                              <BookMarked className="w-8 h-8 text-[#78716C] mb-3" />
                              <span className="font-serif-display text-xl text-[#44403C] dark:text-[#D6D3D1]">
                                {leadPost.title}
                              </span>
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* Tier 2: Secondary Features Grid */}
                {secondaryPosts.length > 0 && (
                  <section className="py-12 border-b border-[#E4DDD0] dark:border-[#2E2924]">
                    <div className="flex items-baseline justify-between mb-8">
                      <h2 className="font-serif-display text-2xl font-medium text-[#181614] dark:text-[#F5F0E8]">
                        Current Dispatches
                      </h2>
                      <button
                        type="button"
                        onClick={() => setRoute({ type: 'archive' })}
                        className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#181614] dark:hover:text-[#F5F0E8] underline underline-offset-4 cursor-pointer"
                      >
                        View full archive
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {secondaryPosts.map((post) => (
                        <article key={post.id} className="flex flex-col justify-between gap-4">
                          <div className="space-y-3.5">
                            <button
                              type="button"
                              onClick={() => openReader(post.slug)}
                              className="block w-full overflow-hidden rounded-lg bg-[#EFEAE0] dark:bg-[#1C1A17] cursor-pointer group"
                            >
                              {post.cover_image ? (
                                <img
                                  src={post.cover_image}
                                  alt={post.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                />
                              ) : (
                                <div className="w-full aspect-[4/3] flex items-center justify-center p-6 text-center">
                                  <span className="font-serif-display text-lg text-[#57534E]">
                                    {post.title}
                                  </span>
                                </div>
                              )}
                            </button>

                            <div className="text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
                              {post.category} · {formatEditorialDate(post.created_at)}
                            </div>

                            <h3 className="font-serif-display text-2xl font-medium leading-snug text-[#181614] dark:text-[#F5F0E8] text-balance">
                              <button
                                type="button"
                                onClick={() => openReader(post.slug)}
                                className="text-left hover:opacity-80 transition-opacity cursor-pointer"
                              >
                                {post.title}
                              </button>
                            </h3>

                            <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed line-clamp-2">
                              {post.excerpt}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-[#EFEAE0] dark:border-[#24211D] flex items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E]">
                            <span className="text-[#181614] dark:text-[#EDE8DF] font-medium">
                              {post.author_name}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-code">{post.reading_time_min} min</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-code">
                              {post.annotation_count || 0} notes
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-code">
                              {post.comment_count || 0} replies
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {/* Tier 3: Additional Archive Rows */}
                {archiveRemainder.length > 0 && (
                  <section className="pt-10">
                    <h2 className="font-serif-display text-xl font-medium text-[#181614] dark:text-[#F5F0E8] mb-4">
                      More from the Archive
                    </h2>
                    <div className="divide-y divide-[#E4DDD0] dark:divide-[#2E2924]">
                      {archiveRemainder.map((post) => (
                        <ArchiveRow key={post.id} post={post} onOpen={() => openReader(post.slug)} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E4DDD0] dark:border-[#2E2924] py-8">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-8 flex flex-wrap items-center justify-between gap-4 text-xs text-[#78716C] dark:text-[#A8A29E]">
          <span>Marginalia · Independent Editorial Publishing &amp; Reader Annotations</span>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setRoute({ type: 'edition' })}
              className="hover:text-[#181614] dark:hover:text-[#F5F0E8] cursor-pointer"
            >
              Edition
            </button>
            <button
              type="button"
              onClick={() => setRoute({ type: 'archive' })}
              className="hover:text-[#181614] dark:hover:text-[#F5F0E8] cursor-pointer"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => setRoute({ type: 'annotations' })}
              className="hover:text-[#181614] dark:hover:text-[#F5F0E8] cursor-pointer"
            >
              Margin Stream
            </button>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(authenticatedUser) => {
          setUser(authenticatedUser);
          loadMyStudioPosts(authenticatedUser);
        }}
      />
    </div>
  );
}

const ArchiveRow: React.FC<{ post: Post; onOpen: () => void }> = ({ post, onOpen }) => (
  <article className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div className="space-y-1.5 max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E]">
        <span className="uppercase tracking-widest">{post.category}</span>
        <span aria-hidden="true">·</span>
        <span>{post.author_name}</span>
        <span aria-hidden="true">·</span>
        <span>{formatEditorialDate(post.created_at)}</span>
      </div>
      <h3 className="font-serif-display text-2xl font-medium text-[#181614] dark:text-[#F5F0E8]">
        <button
          type="button"
          onClick={onOpen}
          className="text-left hover:underline underline-offset-4 cursor-pointer"
        >
          {post.title}
        </button>
      </h3>
      <p className="text-sm text-[#57534E] dark:text-[#A8A29E] line-clamp-1">{post.excerpt}</p>
    </div>

    <div className="flex items-center gap-4 shrink-0 text-xs font-mono-code text-[#78716C] dark:text-[#A8A29E]">
      <span>{post.reading_time_min} min read</span>
      <span aria-hidden="true">·</span>
      <span>{post.annotation_count || 0} margin notes</span>
      <span aria-hidden="true">·</span>
      <span>{post.comment_count || 0} comments</span>
    </div>
  </article>
);
