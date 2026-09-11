import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, BookOpen } from 'lucide-react';
import type { ChatSource } from '../../../providers/types';

interface SourcesAccordionProps {
  sources: ChatSource[];
}

export const SourcesAccordion: React.FC<SourcesAccordionProps> = ({ sources }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!Array.isArray(sources) || sources.length === 0) {
    return null;
  }

  const isSafeHttpsUrl = (ref?: string | null): boolean => {
    if (!ref) return false;
    try {
      const url = new URL(ref.trim());
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const formatSourceType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-border/60 text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-[11px] font-medium text-text-muted hover:text-text-primary py-1 px-1 rounded transition-colors focus-ring"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-3 h-3 text-crimson/80" />
          <span>Verified Sources ({sources.length})</span>
        </span>
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && (
        <ul className="mt-1.5 space-y-1.5 pl-1" role="list">
          {sources.map((src, idx) => (
            <li
              key={src.id ? `src_${src.id}_${idx}` : `src_${idx}`}
              className="text-[11px] bg-app-base/80 p-2 rounded border border-border/50 text-text-primary"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="font-semibold text-text-primary leading-tight">{src.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 uppercase font-mono flex-shrink-0">
                  {src.scope}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                <span>{formatSourceType(src.sourceType)}</span>
                {src.authority === 'CONFIRMED' && (
                  <span className="text-emerald-700 font-medium">• Verified</span>
                )}
              </div>

              {src.sourceReference && (
                <div className="mt-1 text-[10px] text-text-muted">
                  {isSafeHttpsUrl(src.sourceReference) ? (
                    <a
                      href={src.sourceReference.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-crimson hover:underline"
                    >
                      <span>Reference Link</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="italic">{src.sourceReference}</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SourcesAccordion;
