import React, { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { api } from '../lib/api';
import { computeLineDiff, formatEditorialDate } from '../lib/diff';
import type { PostRevision } from '../types';

interface RevisionDiffDrawerProps {
  postId: number;
  isOpen: boolean;
  onClose: () => void;
}

export const RevisionDiffDrawer: React.FC<RevisionDiffDrawerProps> = ({
  postId,
  isOpen,
  onClose,
}) => {
  const [revisions, setRevisions] = useState<PostRevision[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.posts
      .revisions(postId)
      .then((res) => {
        setRevisions(res.revisions);
        setSelectedIndex(0);
      })
      .catch(() => setRevisions([]))
      .finally(() => setLoading(false));
  }, [isOpen, postId]);

  if (!isOpen) return null;

  const currentRev = revisions[selectedIndex];
  const previousRev = revisions[selectedIndex + 1];
  const diffLines = currentRev
    ? computeLineDiff(previousRev ? previousRev.content : '', currentRev.content)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Essay revision history"
    >
      <div className="w-full max-w-3xl h-full bg-[#FBF9F5] dark:bg-[#141210] border-l border-[#E4DDD0] dark:border-[#2E2924] flex flex-col">
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[#E4DDD0] dark:border-[#2E2924]">
          <div className="flex items-center gap-3">
            <History className="w-4 h-4 text-[#1E3A8A] dark:text-[#93C5FD]" />
            <div>
              <h2 className="font-serif-display text-xl font-medium text-[#181614] dark:text-[#F5F0E8]">
                Time-Travel Revision History
              </h2>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                Every saved edit creates an immutable manuscript snapshot
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close revision history"
            className="p-2 rounded-lg text-[#78716C] hover:text-[#181614] dark:hover:text-[#F5F0E8] hover:bg-[#EFEAE0] dark:hover:bg-[#24211D] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-[#E4DDD0] dark:border-[#2E2924] overflow-y-auto p-4 space-y-2">
            {loading ? (
              <p className="text-xs text-[#78716C] p-3">Loading revision trail...</p>
            ) : (
              revisions.map((rev, idx) => (
                <button
                  key={rev.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                    idx === selectedIndex
                      ? 'bg-[#EFEAE0] dark:bg-[#24211D] border-[#1E3A8A]/40 dark:border-[#60A5FA]/40'
                      : 'border-transparent hover:bg-[#F2EDE4] dark:hover:bg-[#1C1A17]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-[#78716C] dark:text-[#A8A29E] font-mono-code">
                    <span className="font-medium text-[#1E3A8A] dark:text-[#93C5FD]">
                      v{rev.version_num}
                    </span>
                    <span>{formatEditorialDate(rev.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-[#181614] dark:text-[#F5F0E8] mt-1">
                    {rev.change_summary}
                  </p>
                  <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-1">
                    Edited by {rev.editor_name}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="md:col-span-8 overflow-y-auto p-6">
            {currentRev ? (
              <div>
                <div className="pb-4 mb-5 border-b border-[#E4DDD0] dark:border-[#2E2924]">
                  <p className="text-xs font-mono-code text-[#78716C] dark:text-[#A8A29E]">
                    Comparing v{currentRev.version_num}{' '}
                    {previousRev ? `against v${previousRev.version_num}` : '(initial manuscript)'}
                  </p>
                  <h3 className="font-serif-display text-lg font-medium text-[#181614] dark:text-[#F5F0E8] mt-1">
                    {currentRev.title}
                  </h3>
                </div>

                <div className="space-y-1 font-mono-code text-xs leading-relaxed">
                  {diffLines.map((line, i) => {
                    if (!line.text && line.type === 'equal') {
                      return <div key={i} className="h-3" />;
                    }
                    const style =
                      line.type === 'added'
                        ? 'bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 px-2.5 py-1 rounded'
                        : line.type === 'removed'
                          ? 'bg-red-100/70 dark:bg-red-950/50 text-red-900 dark:text-red-200 line-through px-2.5 py-1 rounded'
                          : 'text-[#57534E] dark:text-[#A8A29E] px-2.5 py-0.5';
                    const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';
                    return (
                      <div key={i} className={`${style} whitespace-pre-wrap break-words`}>
                        {prefix}
                        {line.text}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#78716C]">Select a revision to inspect changes.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
