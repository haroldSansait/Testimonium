import { useImperativeHandle, forwardRef } from 'react';
import { SafeMarkdown } from './SafeMarkdown';
import { SourcesAccordion } from './SourcesAccordion';
import { useProgressiveReveal } from '../hooks/useProgressiveReveal';
import type { ChatMessage } from '../caloyStorage';
import type { Parish } from '../../../types';
import { CustomSelect } from '../../../components/ui/CustomSelect';

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

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'BAPTISMAL_CERTIFICATE', label: 'Baptismal Certificate' },
  { value: 'CONFIRMATION_CERTIFICATE', label: 'Confirmation Certificate' },
  { value: 'MARRIAGE_CERTIFICATE', label: 'Marriage Certificate' },
  { value: 'FIRST_COMMUNION_CERTIFICATE', label: 'First Communion Certificate' },
  { value: 'MARRIAGE_BANNS', label: 'Marriage Banns' },
  { value: 'PERMIT_TO_MARRY', label: 'Permit to Marry' },
  { value: 'STATUS_OF_LIBERTY', label: 'Status of Liberty Certificate' },
];

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
              <CustomSelect
                id={`parish-clarify-${msg.id}`}
                disabled={isTyping}
                value=""
                placeholder="Choose a parish..."
                options={parishes.map((p) => ({ value: p.id, label: p.name }))}
                onChange={(val) => {
                  const num = Number(val);
                  if (num && Number.isInteger(num) && num > 0) {
                    onInlineParishSelect(num);
                  }
                }}
                size="sm"
                aria-label="Select parish for clarification"
              />
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
              <CustomSelect
                id={`doc-clarify-${msg.id}`}
                disabled={isTyping}
                value=""
                placeholder="Choose a document..."
                options={DOCUMENT_TYPE_OPTIONS}
                onChange={(val) => {
                  if (val) {
                    onInlineDocTypeSelect(String(val));
                  }
                }}
                size="sm"
                aria-label="Select document type for clarification"
              />
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
              <CustomSelect
                id={`event-clarify-${msg.id}`}
                disabled={isTyping}
                value=""
                placeholder="Choose an event or service..."
                options={(msg.clarificationOptions || []).map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                onChange={(val) => {
                  if (val) {
                    onInlineEventTypeSelect(String(val));
                  }
                }}
                size="sm"
                aria-label="Select event type for clarification"
              />
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
