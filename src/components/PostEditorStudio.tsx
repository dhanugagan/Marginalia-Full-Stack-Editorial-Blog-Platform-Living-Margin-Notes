import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Code, Columns2, Eye, Heading2, List, Minus, Quote } from 'lucide-react';
import { api } from '../lib/api';
import { COVER_PRESETS, EDITORIAL_CATEGORIES, type Post, type PostStatus } from '../types';
import { EditorialMarkdown } from './EditorialMarkdown';

interface PostEditorStudioProps {
  existingPost?: Post | null;
  onCancel: () => void;
  onSaved: (post: Post) => void;
}

const SLASH_COMMANDS = [
  { cmd: '/h2', label: 'Section Heading', snippet: '## Section Heading\n\n' },
  { cmd: '/quote', label: 'Editorial Pull Quote', snippet: '> A notable quote or thesis sentence.\n\n' },
  { cmd: '/code', label: 'Code Block', snippet: '```ts\nconst example = true;\n```\n\n' },
  { cmd: '/list', label: 'Bulleted List', snippet: '- First observation\n- Second observation\n\n' },
  { cmd: '/divider', label: 'Section Divider', snippet: '---\n\n' },
];

export const PostEditorStudio: React.FC<PostEditorStudioProps> = ({
  existingPost,
  onCancel,
  onSaved,
}) => {
  const [title, setTitle] = useState(existingPost?.title || '');
  const [subtitle, setSubtitle] = useState(existingPost?.subtitle || '');
  const [category, setCategory] = useState(existingPost?.category || 'Essays');
  const [coverImage, setCoverImage] = useState(
    existingPost?.cover_image ?? COVER_PRESETS[0].url
  );
  const [content, setContent] = useState(
    existingPost?.content ||
      'Begin your essay here. Select any text in the reader to anchor margin notes, or type `/` on a new line for editorial formatting commands.\n\n## First Movement\n\nWrite with clarity and deliberate measure.'
  );
  const [changeSummary, setChangeSummary] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'write' | 'preview'>('split');
  const [slashOpen, setSlashOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const stats = useMemo(() => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.ceil(words / 210));
    return { words, chars: content.length, mins };
  }, [content]);

  const insertSnippet = (snippet: string, replaceSlash = false) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}\n${snippet}`);
      setSlashOpen(false);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    let nextStart = start;
    let prefix = content.slice(0, start);
    if (replaceSlash && prefix.endsWith('/')) {
      prefix = prefix.slice(0, -1);
      nextStart = start - 1;
    }
    const updated = prefix + snippet + content.slice(end);
    setContent(updated);
    setSlashOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = nextStart + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const lineStart = val.lastIndexOf('\n', cursor - 1) + 1;
    const currentLine = val.slice(lineStart, cursor);
    setSlashOpen(currentLine === '/');
  };

  const handleSave = async (targetStatus: PostStatus) => {
    if (!title.trim() || !content.trim()) {
      setError('Both an essay title and body prose are required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        content: content.trim(),
        cover_image: coverImage.trim(),
        category,
        status: targetStatus,
      };
      const res = existingPost
        ? await api.posts.update(existingPost.id, {
            ...payload,
            change_summary: changeSummary.trim() || `Updated (${targetStatus})`,
          })
        : await api.posts.create(payload);
      onSaved(res.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save essay');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E4DDD0] dark:border-[#2E2924]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#181614] dark:hover:text-[#F5F0E8] cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span aria-hidden="true" className="text-[#D6CEBE] dark:text-[#44403C]">
            |
          </span>
          <span className="text-xs font-mono-code text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            {stats.words} words · {stats.mins} min read
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFEAE0] dark:bg-[#24211D]">
            <button
              type="button"
              onClick={() => setViewMode('write')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'write'
                  ? 'bg-[#FBF9F5] dark:bg-[#141210] text-[#181614] dark:text-[#F5F0E8]'
                  : 'text-[#57534E] dark:text-[#A8A29E]'
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'split'
                  ? 'bg-[#FBF9F5] dark:bg-[#141210] text-[#181614] dark:text-[#F5F0E8]'
                  : 'text-[#57534E] dark:text-[#A8A29E]'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Split Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'preview'
                  ? 'bg-[#FBF9F5] dark:bg-[#141210] text-[#181614] dark:text-[#F5F0E8]'
                  : 'text-[#57534E] dark:text-[#A8A29E]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-[#D6CEBE] dark:border-[#332E29] text-[#44403C] dark:text-[#D6D3D1] hover:bg-[#EFEAE0] dark:hover:bg-[#24211D] disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('published')}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] hover:opacity-90 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {saving ? 'Saving...' : existingPost ? 'Update Essay' : 'Publish Essay'}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs font-medium text-red-700 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <div
        className={`mt-6 grid gap-8 ${
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1 max-w-3xl mx-auto'
        }`}
      >
        {viewMode !== 'preview' && (
          <div className={`${viewMode === 'split' ? 'lg:col-span-6' : ''} space-y-5`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                  Department / Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#1A1816] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
                >
                  {EDITORIAL_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                  Cover Photograph
                </label>
                <select
                  value={COVER_PRESETS.some((p) => p.url === coverImage) ? coverImage : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') setCoverImage(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#1A1816] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
                >
                  {COVER_PRESETS.map((preset) => (
                    <option key={preset.url} value={preset.url}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="">No Cover Image</option>
                  <option value="custom">Custom Image URL</option>
                </select>
              </div>
            </div>

            {!COVER_PRESETS.some((p) => p.url === coverImage) && coverImage !== '' && (
              <div>
                <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                  Custom Cover URL
                </label>
                <input
                  type="url"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="/src/assets/images/..."
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#1A1816] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8]"
                />
              </div>
            )}

            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Essay Headline..."
                className="w-full font-serif-display text-3xl font-medium bg-transparent border-b border-[#E4DDD0] dark:border-[#2E2924] pb-3 text-[#181614] dark:text-[#F5F0E8] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            <div>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Concise deck or archival subtitle (optional)"
                className="w-full text-xs uppercase tracking-widest bg-transparent border-b border-[#E4DDD0] dark:border-[#2E2924] pb-2.5 text-[#57534E] dark:text-[#A8A29E] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            {existingPost && (
              <div>
                <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                  Revision Note (recorded in Time-Travel History)
                </label>
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="e.g., Clarified opening thesis and tightened conclusion"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#1A1816] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8]"
                />
              </div>
            )}

            <div className="relative rounded-xl border border-[#E4DDD0] dark:border-[#2E2924] bg-white dark:bg-[#1A1816] overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#E4DDD0] dark:border-[#2E2924] bg-[#F7F4EE] dark:bg-[#161412]">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => insertSnippet('## Heading\n\n')}
                    title="Insert section heading"
                    className="p-1.5 rounded text-[#57534E] dark:text-[#A8A29E] hover:bg-[#EFEAE0] dark:hover:bg-[#262320] cursor-pointer"
                  >
                    <Heading2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('> Pull quote here\n\n')}
                    title="Insert pull quote"
                    className="p-1.5 rounded text-[#57534E] dark:text-[#A8A29E] hover:bg-[#EFEAE0] dark:hover:bg-[#262320] cursor-pointer"
                  >
                    <Quote className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('- List item\n- Second item\n\n')}
                    title="Insert bullet list"
                    className="p-1.5 rounded text-[#57534E] dark:text-[#A8A29E] hover:bg-[#EFEAE0] dark:hover:bg-[#262320] cursor-pointer"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('```ts\n// code sample\n```\n\n')}
                    title="Insert code block"
                    className="p-1.5 rounded text-[#57534E] dark:text-[#A8A29E] hover:bg-[#EFEAE0] dark:hover:bg-[#262320] cursor-pointer"
                  >
                    <Code className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('---\n\n')}
                    title="Insert section divider"
                    className="p-1.5 rounded text-[#57534E] dark:text-[#A8A29E] hover:bg-[#EFEAE0] dark:hover:bg-[#262320] cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[11px] font-mono-code text-[#78716C] dark:text-[#A8A29E]">
                  Type / on empty line for commands
                </span>
              </div>

              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                rows={18}
                placeholder="Write your essay in Markdown..."
                className="w-full p-5 text-[15px] leading-relaxed bg-transparent text-[#181614] dark:text-[#EDE8DF] focus:outline-none resize-y font-sans"
              />

              {slashOpen && (
                <div className="absolute left-4 bottom-4 z-20 w-64 rounded-lg bg-[#FBF9F5] dark:bg-[#201D1A] border border-[#D6CEBE] dark:border-[#332E29] shadow-lg p-1.5">
                  <p className="px-2.5 py-1 text-[11px] uppercase tracking-wider text-[#78716C]">
                    Insert Block
                  </p>
                  {SLASH_COMMANDS.map((item) => (
                    <button
                      key={item.cmd}
                      type="button"
                      onClick={() => insertSnippet(item.snippet, true)}
                      className="w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-md hover:bg-[#EFEAE0] dark:hover:bg-[#2C2824] text-[#181614] dark:text-[#F5F0E8] cursor-pointer"
                    >
                      <span>{item.label}</span>
                      <span className="font-mono-code text-[#78716C]">{item.cmd}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode !== 'write' && (
          <div
            className={`${
              viewMode === 'split'
                ? 'lg:col-span-6 lg:border-l lg:border-[#E4DDD0] lg:dark:border-[#2E2924] lg:pl-8'
                : ''
            }`}
          >
            <p className="text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E] mb-4">
              Broadsheet Live Preview
            </p>
            <div className="pb-6 mb-6 border-b border-[#E4DDD0] dark:border-[#2E2924]">
              <p className="text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
                {category} · {stats.mins} min read
              </p>
              <h1 className="font-serif-display text-3xl sm:text-4xl font-medium text-[#181614] dark:text-[#F5F0E8] mt-2 text-balance">
                {title || 'Untitled Essay'}
              </h1>
              {subtitle && (
                <p className="text-xs uppercase tracking-widest text-[#57534E] dark:text-[#A8A29E] mt-2.5">
                  {subtitle}
                </p>
              )}
            </div>
            {coverImage && (
              <div className="mb-8 overflow-hidden rounded-lg bg-[#EFEAE0] dark:bg-[#1C1A17]">
                <img
                  src={coverImage}
                  alt={title || 'Essay cover'}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[16/9] object-cover"
                />
              </div>
            )}
            <EditorialMarkdown content={content} interactive={false} />
          </div>
        )}
      </div>
    </div>
  );
};
