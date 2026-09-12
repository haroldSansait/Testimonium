import { useImperativeHandle, forwardRef } from 'react';
import { SafeMarkdown } from './SafeMarkdown';
import { SourcesAccordion } from './SourcesAccordion';
import { useProgressiveReveal } from '../hooks/useProgressiveReveal';
import type { ChatMessage } from '../caloyStorage';
import type { Parish } from '../../../types';

export interface AnimatedAssistantMessageHandle {
  completeImmediately: () => void;
}

interface AnimatedAssistantMessageProps {
  msg: ChatMessage;
  isLatest: boolean;
  parishes: Parish[];
  isTyping: boolean;
  onInlineParishSelect: (parishId: number) => void;
  onInlineDocTypeSelect: (docType: string) => void;
  onInlineEventTypeSelect: (eventType: string) => void;
}

export const AnimatedAssistantMessage = forwardRef<
  AnimatedAssistantMessageHandle,
  AnimatedAssistantMessageProps
>(({ msg, isLatest, parishes, isTyping, onInlineParishSelect, onInlineDocTypeSelect, onInlineEventTypeSelect }, ref) => {
  const { displayedText, isComplete, completeImmediately } = useProgressiveReveal({
    text: msg.text,
    isRestored: Boolean(msg.isRestored || !isLatest),
    charsPerTick: 4,
    tickIntervalMs: 18,
  });

  useImperativeHandle(ref, () => ({
    completeImmediately,
  }));

  const isLiveData = msg.responseType === 'LIVE_DATA';
  const isRag = msg.responseType === 'RAG' || (!msg.responseType && msg.sources && msg.sources.length > 0);

  return (
    <div className="text-xs sm:text-sm leading-relaxed text-text-primary">
      <SafeMarkdown text={displayedText} />

      {/* Show metadata, sources, and clarification only after progressive reveal completes */}
      {isComplete && (
        <>
          {/* LIVE_DATA Badge */}
          {isLiveData && (
            <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-emerald-800 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                <span>✓ Current TESTIMONIUM Data</span>
              </span>
              <span className="text-[10px] text-text-muted">Updated just now</span>
            </div>
          )}

          {/* RAG Sources Accordion */}
          {isRag && msg.sources && msg.sources.length > 0 && !msg.fallback && (
            <SourcesAccordion sources={msg.sources} />
          )}

          {/* Inline Clarification Selectors */}
          {msg.clarificationType === 'PARISH' && (
            <div className="mt-3 pt-2.5 border-t border-border/70">
              <label
                htmlFor={`parish-clarify-${msg.id}`}
                className="block text-[11px] font-medium text-text-muted mb-1.5"
              >
                Select your parish to continue:
              </label>
              <select
                id={`parish-clarify-${msg.id}`}
                disabled={isTyping}
                defaultValue=""
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val && Number.isInteger(val) && val > 0) {
                    onInlineParishSelect(val);
                  }
                }}
                className="w-full text-xs bg-app-page border border-crimson/40 rounded px-2.5 py-1.5 text-text-primary focus-ring font-medium cursor-pointer"
                aria-label="Select parish for clarification"
              >
                <option value="" disabled>
                  Choose a parish...
                </option>
                {parishes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {msg.clarificationType === 'DOCUMENT_TYPE' && (
            <div className="mt-3 pt-2.5 border-t border-border/70">
              <label
                htmlFor={`doc-clarify-${msg.id}`}
                className="block text-[11px] font-medium text-text-muted mb-1.5"
              >
                Select a document type to check:
              </label>
              <select
                id={`doc-clarify-${msg.id}`}
                disabled={isTyping}
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    onInlineDocTypeSelect(val);
                  }
                }}
                className="w-full text-xs bg-app-page border border-crimson/40 rounded px-2.5 py-1.5 text-text-primary focus-ring font-medium cursor-pointer"
                aria-label="Select document type for clarification"
              >
                <option value="" disabled>
                  Choose a document...
                </option>
                <option value="BAPTISMAL_CERTIFICATE">Baptismal Certificate</option>
                <option value="CONFIRMATION_CERTIFICATE">Confirmation Certificate</option>
                <option value="MARRIAGE_CERTIFICATE">Marriage Certificate</option>
                <option value="FIRST_COMMUNION_CERTIFICATE">First Communion Certificate</option>
                <option value="MARRIAGE_BANNS">Marriage Banns</option>
                <option value="PERMIT_TO_MARRY">Permit to Marry</option>
                <option value="STATUS_OF_LIBERTY">Status of Liberty Certificate</option>
              </select>
            </div>
          )}

          {msg.clarificationType === 'SCHEDULE_EVENT' && (
            <div className="mt-3 pt-2.5 border-t border-border/70">
              <label
                htmlFor={`event-clarify-${msg.id}`}
                className="block text-[11px] font-medium text-text-muted mb-1.5"
              >
                Select an event or service:
              </label>
              <select
                id={`event-clarify-${msg.id}`}
                disabled={isTyping}
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    onInlineEventTypeSelect(val);
                  }
                }}
                className="w-full text-xs bg-app-page border border-crimson/40 rounded px-2.5 py-1.5 text-text-primary focus-ring font-medium cursor-pointer"
                aria-label="Select event type for clarification"
              >
                <option value="" disabled>
                  Choose an event or service...
                </option>
                {(msg.clarificationOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      <span className="text-[9px] block mt-1.5 text-text-muted">
        {new Date(msg.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
});

AnimatedAssistantMessage.displayName = 'AnimatedAssistantMessage';
