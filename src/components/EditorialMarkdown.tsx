import React from 'react';
import { Asterisk, MessageSquarePlus } from 'lucide-react';
import type { MarginAnnotation } from '../types';

export interface ParsedBlock {
  index: number;
  type: 'h2' | 'h3' | 'paragraph' | 'blockquote' | 'code' | 'list' | 'hr';
  text: string;
  items?: string[];
  language?: string;
}

export function parseMarkdownBlocks(markdown: string): ParsedBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        index: blockIndex++,
        type: 'code',
        text: codeLines.join('\n'),
        language: lang || 'text',
      });
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push({ index: blockIndex++, type: 'hr', text: '' });
      i++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({ index: blockIndex++, type: 'h3', text: trimmed.slice(4).trim() });
      i++;
      continue;
    }

    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      const text = trimmed.startsWith('## ') ? trimmed.slice(3).trim() : trimmed.slice(2).trim();
      blocks.push({ index: blockIndex++, type: 'h2', text });
      i++;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        index: blockIndex++,
        type: 'blockquote',
        text: quoteLines.join(' '),
      });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({
        index: blockIndex++,
        type: 'list',
        text: items.join(' '),
        items,
      });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('```') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        index: blockIndex++,
        type: 'paragraph',
        text: paraLines.join(' '),
      });
    }
  }

  return blocks;
}

function renderInlineFormatting(
  text: string,
  paragraphAnnotations: MarginAnnotation[],
  onSelectAnnotation?: (ann: MarginAnnotation) => void
): React.ReactNode {
  // First check if any annotation quote matches an exact substring in this paragraph
  const matchedAnn = paragraphAnnotations.find(
    (ann) => ann.selected_quote && text.toLowerCase().includes(ann.selected_quote.toLowerCase())
  );

  const renderStyledSegment = (segment: string, keyPrefix: string): React.ReactNode[] => {
    const tokens = segment.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
    return tokens.map((token, idx) => {
      const key = `${keyPrefix}-${idx}`;
      if (token.startsWith('**') && token.endsWith('**')) {
        return (
          <strong key={key} className="font-semibold text-[#181614] dark:text-[#F5F0E8]">
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.startsWith('*') && token.endsWith('*')) {
        return (
          <em key={key} className="italic">
            {token.slice(1, -1)}
          </em>
        );
      }
      if (token.startsWith('`') && token.endsWith('`')) {
        return (
          <code
            key={key}
            className="font-mono-code text-[0.88em] px-1.5 py-0.5 rounded bg-[#EFEAE0] dark:bg-[#262320] text-[#1C1917] dark:text-[#E7E2D9]"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const safeHref = href.startsWith('http://') || href.startsWith('https://') ? href : '#';
        return (
          <a
            key={key}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-[#1E3A8A]/40 underline-offset-4 hover:decoration-[#1E3A8A] text-[#1E3A8A] dark:text-[#93C5FD]"
          >
            {label}
          </a>
        );
      }
      return <React.Fragment key={key}>{token}</React.Fragment>;
    });
  };

  if (!matchedAnn) {
    return renderStyledSegment(text, 'seg');
  }

  const qLower = matchedAnn.selected_quote.toLowerCase();
  const matchIdx = text.toLowerCase().indexOf(qLower);
  if (matchIdx === -1) {
    return renderStyledSegment(text, 'seg');
  }

  const before = text.slice(0, matchIdx);
  const exact = text.slice(matchIdx, matchIdx + matchedAnn.selected_quote.length);
  const after = text.slice(matchIdx + matchedAnn.selected_quote.length);

  const highlightClasses =
    matchedAnn.highlight_color === 'amber'
      ? 'bg-amber-200/50 dark:bg-amber-500/20 border-b border-amber-700/50 dark:border-amber-400/50'
      : matchedAnn.highlight_color === 'forest'
        ? 'bg-emerald-200/45 dark:bg-emerald-500/20 border-b border-emerald-700/50 dark:border-emerald-400/50'
        : 'bg-[#1E3A8A]/10 dark:bg-[#60A5FA]/20 border-b border-[#1E3A8A]/50 dark:border-[#93C5FD]/50';

  return (
    <>
      {before && renderStyledSegment(before, 'before')}
      <button
        type="button"
        onClick={() => onSelectAnnotation?.(matchedAnn)}
        title={`Margin note by ${matchedAnn.author_name}: ${matchedAnn.note}`}
        className={`inline text-left cursor-pointer px-0.5 transition-colors hover:opacity-85 ${highlightClasses}`}
      >
        {exact}
      </button>
      {after && renderStyledSegment(after, 'after')}
    </>
  );
}

interface EditorialMarkdownProps {
  content: string;
  annotations?: MarginAnnotation[];
  sparksByParagraph?: Record<number, number>;
  activeParagraphIndex?: number | null;
  narratingParagraphIndex?: number | null;
  fontSize?: 'compact' | 'standard' | 'large';
  interactive?: boolean;
  onParagraphSelect?: (paragraphIndex: number, selectedQuote?: string) => void;
  onSelectAnnotation?: (annotation: MarginAnnotation) => void;
  onSparkParagraph?: (paragraphIndex: number) => void;
}

export const EditorialMarkdown: React.FC<EditorialMarkdownProps> = ({
  content,
  annotations = [],
  sparksByParagraph = {},
  activeParagraphIndex = null,
  narratingParagraphIndex = null,
  fontSize = 'standard',
  interactive = true,
  onParagraphSelect,
  onSelectAnnotation,
  onSparkParagraph,
}) => {
  const blocks = parseMarkdownBlocks(content);
  let firstParagraphSeen = false;

  const sizeClass =
    fontSize === 'compact'
      ? 'text-[15px] leading-[1.72]'
      : fontSize === 'large'
        ? 'text-[19px] leading-[1.82]'
        : 'text-[17px] leading-[1.78]';

  const handleMouseUp = (paragraphIndex: number) => {
    if (!interactive || !onParagraphSelect) return;
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length >= 4 && selection.length <= 220) {
      onParagraphSelect(paragraphIndex, selection);
    }
  };

  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        const paraAnnotations = annotations.filter((a) => a.paragraph_index === block.index);
        const sparkCount = sparksByParagraph[block.index] || 0;
        const isNarrating = narratingParagraphIndex === block.index;
        const isActive = activeParagraphIndex === block.index;

        if (block.type === 'hr') {
          return (
            <div key={block.index} className="py-4 flex items-center justify-center">
              <div className="w-24 border-t border-[#D6CEBE] dark:border-[#332E29]" />
            </div>
          );
        }

        if (block.type === 'h2') {
          return (
            <h2
              key={block.index}
              id={`para-${block.index}`}
              className={`font-serif-display text-2xl sm:text-[1.75rem] font-medium tracking-tight text-[#181614] dark:text-[#F5F0E8] pt-4 text-balance transition-opacity duration-200 ${
                isNarrating ? 'bg-[#1E3A8A]/8 dark:bg-[#60A5FA]/15 px-2 -mx-2 rounded' : ''
              }`}
            >
              {block.text}
            </h2>
          );
        }

        if (block.type === 'h3') {
          return (
            <h3
              key={block.index}
              id={`para-${block.index}`}
              className="font-serif-display text-xl font-medium text-[#181614] dark:text-[#F5F0E8] pt-2 text-balance"
            >
              {block.text}
            </h3>
          );
        }

        if (block.type === 'code') {
          return (
            <pre
              key={block.index}
              id={`para-${block.index}`}
              className="font-mono-code text-[13px] leading-relaxed overflow-x-auto p-5 rounded-lg bg-[#F2EDE4] dark:bg-[#1C1A17] border border-[#E4DDD0] dark:border-[#2E2924] text-[#292524] dark:text-[#E7E2D9]"
            >
              <code>{block.text}</code>
            </pre>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <div key={block.index} id={`para-${block.index}`} className="group relative py-2">
              <blockquote
                onMouseUp={() => handleMouseUp(block.index)}
                className={`border-y border-[#D6CEBE] dark:border-[#332E29] py-6 my-2 font-serif-display italic text-xl sm:text-2xl leading-relaxed text-[#292524] dark:text-[#EAE4DA] transition-colors ${
                  isNarrating ? 'bg-[#1E3A8A]/6 dark:bg-[#60A5FA]/10 px-3 -mx-3 rounded' : ''
                }`}
              >
                {renderInlineFormatting(block.text, paraAnnotations, onSelectAnnotation)}
              </blockquote>
              {interactive && (
                <ParagraphGutterControls
                  paragraphIndex={block.index}
                  annotationCount={paraAnnotations.length}
                  sparkCount={sparkCount}
                  isActive={isActive}
                  onAnnotate={() => onParagraphSelect?.(block.index)}
                  onSpark={() => onSparkParagraph?.(block.index)}
                />
              )}
            </div>
          );
        }

        if (block.type === 'list' && block.items) {
          return (
            <ul
              key={block.index}
              id={`para-${block.index}`}
              className={`list-disc pl-6 space-y-2 text-[#292524] dark:text-[#DCD6CC] ${sizeClass}`}
            >
              {block.items.map((item, idx) => (
                <li key={idx}>{renderInlineFormatting(item, paraAnnotations, onSelectAnnotation)}</li>
              ))}
            </ul>
          );
        }

        const applyDropCap = !firstParagraphSeen;
        firstParagraphSeen = true;

        return (
          <div
            key={block.index}
            id={`para-${block.index}`}
            className={`group relative transition-colors duration-200 rounded ${
              isNarrating
                ? 'bg-[#1E3A8A]/8 dark:bg-[#60A5FA]/15 px-3 py-2 -mx-3'
                : isActive
                  ? 'bg-[#F2EDE4]/70 dark:bg-[#1F1C18] px-3 py-2 -mx-3'
                  : ''
            }`}
          >
            <p
              onMouseUp={() => handleMouseUp(block.index)}
              className={`text-[#292524] dark:text-[#DCD6CC] ${sizeClass} ${
                applyDropCap ? 'editorial-dropcap' : ''
              }`}
            >
              {renderInlineFormatting(block.text, paraAnnotations, onSelectAnnotation)}
            </p>
            {interactive && (
              <ParagraphGutterControls
                paragraphIndex={block.index}
                annotationCount={paraAnnotations.length}
                sparkCount={sparkCount}
                isActive={isActive}
                onAnnotate={() => onParagraphSelect?.(block.index)}
                onSpark={() => onSparkParagraph?.(block.index)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

interface ParagraphGutterControlsProps {
  paragraphIndex: number;
  annotationCount: number;
  sparkCount: number;
  isActive: boolean;
  onAnnotate: () => void;
  onSpark: () => void;
}

const ParagraphGutterControls: React.FC<ParagraphGutterControlsProps> = ({
  paragraphIndex,
  annotationCount,
  sparkCount,
  isActive,
  onAnnotate,
  onSpark,
}) => {
  const hasActivity = annotationCount > 0 || sparkCount > 0 || isActive;

  return (
    <div
      className={`mt-1.5 flex items-center gap-3 text-xs transition-opacity duration-150 ${
        hasActivity ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
      }`}
    >
      <button
        type="button"
        onClick={onAnnotate}
        aria-label={`Add or view margin notes on paragraph ${paragraphIndex + 1}`}
        className="inline-flex items-center gap-1.5 text-[#57534E] dark:text-[#A8A29E] hover:text-[#1E3A8A] dark:hover:text-[#93C5FD] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <MessageSquarePlus className="w-3.5 h-3.5" />
        <span className="font-mono-code">
          {annotationCount > 0 ? `${annotationCount} margin ${annotationCount === 1 ? 'note' : 'notes'}` : 'Add margin note'}
        </span>
      </button>
      <span aria-hidden="true" className="text-[#D6CEBE] dark:text-[#44403C]">
        ·
      </span>
      <button
        type="button"
        onClick={onSpark}
        aria-label={`Resonate with paragraph ${paragraphIndex + 1}`}
        className="inline-flex items-center gap-1 text-[#57534E] dark:text-[#A8A29E] hover:text-[#92400E] dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Asterisk className="w-3.5 h-3.5" />
        <span className="font-mono-code">Resonate{sparkCount > 0 ? ` (${sparkCount})` : ''}</span>
      </button>
    </div>
  );
};
