import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Church } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import services from '../../../providers/factory';
import type { Parish } from '../../../types';
import { ParishSelector } from './ParishSelector';
import { SourcesAccordion } from './SourcesAccordion';
import { SafeMarkdown } from './SafeMarkdown';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import {
  CALOY_STORAGE_KEYS,
  readCaloyMessages,
  writeCaloyMessages,
  getPendingQuestion,
  setPendingQuestion,
  clearPendingQuestion,
  getStructuredClarification,
  setStructuredClarification,
  clearStructuredClarification,
  getConversationContext,
  setConversationContext,
  type ChatMessage,
} from '../caloyStorage';

export type { ChatMessage } from '../caloyStorage';

interface CaloyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

const MAX_QUESTION_LENGTH = 1000;

const DEFAULT_DOCUMENT_TYPE_OPTIONS = [
  { value: 'BAPTISMAL_CERTIFICATE', label: 'Baptismal Certificate' },
  { value: 'CONFIRMATION_CERTIFICATE', label: 'Confirmation Certificate' },
  { value: 'MARRIAGE_CERTIFICATE', label: 'Marriage Certificate' },
  { value: 'FIRST_COMMUNION_CERTIFICATE', label: 'First Communion Certificate' },
  { value: 'MARRIAGE_BANNS', label: 'Marriage Banns' },
  { value: 'PERMIT_TO_MARRY', label: 'Permit to Marry' },
  { value: 'STATUS_OF_LIBERTY', label: 'Status of Liberty Certificate' },
  { value: 'DEATH_CERTIFICATE', label: 'Death Certificate' },
];

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return typeof id === 'string' && UUID_V4_REGEX.test(id);
}

export function generateCryptoUuid(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  return '';
}

export const CaloyDrawer: React.FC<CaloyDrawerProps> = ({ isOpen, onClose, triggerRef }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [showManualParishSelect, setShowManualParishSelect] = useState(false);

  const [selectedParishId, setSelectedParishId] = useState<number | null>(() => {
    try {
      const stored = sessionStorage.getItem(CALOY_STORAGE_KEYS.parishId);
      const parsed = stored ? Number(stored) : null;
      return parsed && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  });

  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const existing = sessionStorage.getItem(CALOY_STORAGE_KEYS.sessionId);
      if (existing && isValidUuid(existing)) {
        return existing;
      }
      const newId = generateCryptoUuid();
      if (newId) {
        sessionStorage.setItem(CALOY_STORAGE_KEYS.sessionId, newId);
        return newId;
      }
      return '';
    } catch {
      return '';
    }
  });

  const [revealingMessageId, setRevealingMessageId] = useState<string | null>(null);
  const activeRevealTimerRef = useRef<any>(null);
  const activeRevealFullTextRef = useRef<{ id: string; fullText: string } | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Complete any active progressive reveal immediately (e.g. if user sends a new message)
  const completeActiveReveal = useCallback(() => {
    if (activeRevealTimerRef.current) {
      clearInterval(activeRevealTimerRef.current);
      activeRevealTimerRef.current = null;
    }
    if (activeRevealFullTextRef.current) {
      const { id, fullText } = activeRevealFullTextRef.current;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, text: fullText } : m))
      );
      activeRevealFullTextRef.current = null;
    }
    setRevealingMessageId(null);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (activeRevealTimerRef.current) {
        clearInterval(activeRevealTimerRef.current);
      }
    };
  }, []);

  // Load parishes for inline clarification and context chip
  useEffect(() => {
    let mounted = true;
    async function loadParishes() {
      try {
        const list = await services.parish.getParishes();
        if (mounted) {
          setParishes(list || []);
        }
      } catch (err) {
        console.warn('[CaloyDrawer] Failed to load parish list:', err);
      }
    }
    loadParishes();
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize messages from sessionStorage with safe fallback
  useEffect(() => {
    const restoredMessages = readCaloyMessages();
    if (restoredMessages) {
      setMessages(restoredMessages);
      return;
    }

    const welcomeMsg: ChatMessage = {
      id: 'welcome',
      sender: 'caloy',
      text: "Hello! I'm Caloy, your TESTIMONIUM assistant. Ask me about verified guides, procedures, and sacramental requirements across the Diocese.",
      timestamp: new Date().toISOString(),
      fallback: false,
      sources: [],
    };
    setMessages([welcomeMsg]);
    writeCaloyMessages([welcomeMsg]);
  }, []);

  // Save messages safely to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      writeCaloyMessages(messages);
    }
  }, [messages]);

  // Save parish preference safely
  const handleSelectParish = useCallback((parishId: number | null) => {
    setSelectedParishId(parishId);
    try {
      if (parishId) {
        sessionStorage.setItem(CALOY_STORAGE_KEYS.parishId, String(parishId));
      } else {
        sessionStorage.removeItem(CALOY_STORAGE_KEYS.parishId);
      }
    } catch {}
  }, []);

  // Focus trap, Escape listener, and focus restoration
  useEffect(() => {
    if (!isOpen) return;

    // Focus input on open
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trap containment
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      triggerRef?.current?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  // Smart auto-scroll
  const scrollToBottom = useCallback((force = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;

    if (force || isAtBottom) {
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }, 50);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Core execution function for queries
  const executeQuery = async (
    questionText: string,
    parishIdToUse: number | null,
    appendUserMessage = true,
    structuredClarificationOverride?: any
  ) => {
    const cleanInput = questionText.trim();
    if (!cleanInput || isTyping) return;

    // Fast-complete previous reveal if user sends while animation is running
    completeActiveReveal();

    if (appendUserMessage) {
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        sender: 'user',
        text: cleanInput,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    setInputValue('');
    setIsTyping(true);
    scrollToBottom(true);

    try {
      const clarificationPayload = structuredClarificationOverride !== undefined
        ? structuredClarificationOverride
        : getStructuredClarification();

      const contextPayload = getConversationContext();

      const result = await services.chat.sendMessage(
        cleanInput,
        parishIdToUse,
        sessionId,
        clarificationPayload,
        contextPayload
      );

      if (result.sessionId && result.sessionId !== sessionId) {
        setSessionId(result.sessionId);
        try {
          sessionStorage.setItem(CALOY_STORAGE_KEYS.sessionId, result.sessionId);
        } catch {}
      }

      if (result.conversationContext) {
        setConversationContext(result.conversationContext);
      }

      // Track structured clarification or simple pending question
      if (result.structuredClarification) {
        setStructuredClarification(result.structuredClarification);
        if (appendUserMessage) {
          setPendingQuestion(cleanInput);
        }
      } else if (result.clarificationType === 'PARISH') {
        setPendingQuestion(cleanInput);
        clearStructuredClarification();
      } else {
        clearPendingQuestion();
        clearStructuredClarification();
      }

      const fullAnswer = result.answer;
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      const replyMsgId = `c_${Date.now()}`;

      // Progressive reveal cadence: ~18ms ticks, finishing short answers in ~0.5s and long in ~1s
      const shouldAnimate = !prefersReducedMotion && fullAnswer && fullAnswer.length > 20;

      if (shouldAnimate) {
        const chunkSize = Math.max(3, Math.ceil(fullAnswer.length / 35));
        let currIndex = Math.min(chunkSize, fullAnswer.length);

        const initialMsg: ChatMessage = {
          id: replyMsgId,
          sender: 'caloy',
          text: fullAnswer.slice(0, currIndex),
          timestamp: new Date().toISOString(),
          fallback: result.fallback,
          sources: result.fallback ? [] : result.sources || [],
          responseType: result.responseType,
          clarificationType: result.clarificationType,
          clarificationOptions: result.clarificationOptions,
          structuredClarification: result.structuredClarification,
          liveData: result.liveData,
        };

        setRevealingMessageId(replyMsgId);
        activeRevealFullTextRef.current = { id: replyMsgId, fullText: fullAnswer };
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.sender === 'caloy' &&
            lastMsg.clarificationType &&
            lastMsg.clarificationType === initialMsg.clarificationType &&
            (lastMsg.text === fullAnswer || lastMsg.text === initialMsg.text)
          ) {
            return prev.map((m, idx) => (idx === prev.length - 1 ? initialMsg : m));
          }
          return [...prev, initialMsg];
        });

        activeRevealTimerRef.current = setInterval(() => {
          currIndex = Math.min(currIndex + chunkSize, fullAnswer.length);
          const nextSlice = fullAnswer.slice(0, currIndex);

          setMessages((prev) =>
            prev.map((m) => (m.id === replyMsgId ? { ...m, text: nextSlice } : m))
          );

          if (currIndex >= fullAnswer.length) {
            if (activeRevealTimerRef.current) {
              clearInterval(activeRevealTimerRef.current);
              activeRevealTimerRef.current = null;
            }
            activeRevealFullTextRef.current = null;
            setRevealingMessageId(null);
          }
        }, 18);
      } else {
        const replyMsg: ChatMessage = {
          id: replyMsgId,
          sender: 'caloy',
          text: fullAnswer,
          timestamp: new Date().toISOString(),
          fallback: result.fallback,
          sources: result.fallback ? [] : result.sources || [],
          responseType: result.responseType,
          clarificationType: result.clarificationType,
          clarificationOptions: result.clarificationOptions,
          structuredClarification: result.structuredClarification,
          liveData: result.liveData,
        };

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.sender === 'caloy' &&
            lastMsg.clarificationType &&
            lastMsg.clarificationType === replyMsg.clarificationType &&
            lastMsg.text === replyMsg.text
          ) {
            return prev.map((m, idx) => (idx === prev.length - 1 ? replyMsg : m));
          }
          return [...prev, replyMsg];
        });
      }
    } catch (err: any) {
      console.warn('[CaloyDrawer] Query error:', err);

      let errorText =
        'I apologize, but my AI services are currently offline. Please contact your parish office directly for help.';

      const errCode = err?.code || err?.error || '';
      const errMsg = String(err?.message || '');

      if (errCode === 'AI_PROVIDER_RATE_LIMITED' || errMsg.includes('AI_PROVIDER_RATE_LIMITED')) {
        errorText = "Caloy's AI service is temporarily at its usage limit. Please try again later.";
      } else if (errCode === 'CHATBOT_AI_LIMIT_REACHED' || errMsg.includes('CHATBOT_AI_LIMIT_REACHED')) {
        errorText = "You've reached Caloy's AI question limit for now. You can still use basic assistant features, or try again in a few minutes.";
      } else if (err?.statusCode === 429 || errCode === 'CHATBOT_RATE_LIMITED' || errMsg.includes('CHATBOT_RATE_LIMITED')) {
        errorText = "You're sending messages too quickly. Please wait a moment.";
      } else if (err?.statusCode === 503 || errCode === 'CHATBOT_UNAVAILABLE') {
        errorText = 'Caloy is temporarily unavailable. Please check back later or contact your parish office.';
      } else if (err?.name === 'TypeError' || errMsg.includes('fetch')) {
        errorText = 'Unable to connect to Caloy. Please check your internet connection and try again.';
      }

      const errorMsg: ChatMessage = {
        id: `c_${Date.now()}`,
        sender: 'caloy',
        text: errorText,
        timestamp: new Date().toISOString(),
        isError: true,
        sources: [],
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;
    await executeQuery(inputValue, selectedParishId, true);
  };

  // Inline clarification selection handlers
  const handleInlineParishSelect = async (parishId: number, msgId?: string) => {
    handleSelectParish(parishId);
    const chosenParish = parishes.find((p) => Number(p.id) === Number(parishId));
    const parishLabel = chosenParish?.name || `Parish #${parishId}`;

    setMessages((prev) =>
      prev.map((m) =>
        (msgId ? m.id === msgId : (m.clarificationType === 'PARISH' && !m.selectedClarificationValue))
          ? { ...m, selectedClarificationValue: parishId, selectedClarificationLabel: parishLabel }
          : m
      )
    );

    const structured = getStructuredClarification();
    if (structured) {
      const updated = {
        ...structured,
        isButtonSelection: true,
        selectedValue: parishId,
        collected: { ...(structured.collected || {}), parishId },
      };
      setStructuredClarification(updated);
      const pending = getPendingQuestion() || structured.originalQuestion;
      await executeQuery(pending || 'Continue', parishId, false, updated);
      return;
    }
    const pending = getPendingQuestion();
    if (pending) {
      clearPendingQuestion();
      await executeQuery(pending, parishId, false);
    }
  };

  const handleInlineDocTypeSelect = async (docType: string, msgId?: string, label?: string) => {
    const docOption = DEFAULT_DOCUMENT_TYPE_OPTIONS.find((o) => o.value === docType);
    const docLabel = label || docOption?.label || docType;

    setMessages((prev) =>
      prev.map((m) =>
        (msgId ? m.id === msgId : (m.clarificationType === 'DOCUMENT_TYPE' && !m.selectedClarificationValue))
          ? { ...m, selectedClarificationValue: docType, selectedClarificationLabel: docLabel }
          : m
      )
    );

    const structured = getStructuredClarification();
    const parishIdToUse = selectedParishId;
    if (structured) {
      const updated = {
        ...structured,
        isButtonSelection: true,
        selectedValue: docType,
        collected: { ...(structured.collected || {}), documentType: docType },
      };
      setStructuredClarification(updated);
      const pending = getPendingQuestion() || structured.originalQuestion;
      await executeQuery(pending || 'Continue', parishIdToUse, false, updated);
      return;
    }
    const pending = getPendingQuestion();
    if (pending) {
      await executeQuery(`${pending} ${docType}`, parishIdToUse, false);
    }
  };

  const handleInlineEventTypeSelect = async (eventType: string, msgId?: string, label?: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        (msgId ? m.id === msgId : (m.clarificationType === 'SCHEDULE_EVENT' && !m.selectedClarificationValue))
          ? { ...m, selectedClarificationValue: eventType, selectedClarificationLabel: label || eventType }
          : m
      )
    );

    const structured = getStructuredClarification();
    const parishIdToUse = selectedParishId;
    if (structured) {
      const updated = {
        ...structured,
        isButtonSelection: true,
        selectedValue: eventType,
        collected: {
          ...(structured.collected || {}),
          eventType,
          scheduleEvent: eventType,
        },
      };
      setStructuredClarification(updated);
      const pending = getPendingQuestion() || structured.originalQuestion;
      await executeQuery(pending || 'Continue', parishIdToUse, false, updated);
      return;
    }
    const pending = getPendingQuestion();
    if (pending) {
      await executeQuery(`${pending} ${eventType}`, parishIdToUse, false);
    }
  };

  const selectedParish = parishes.find((p) => String(p.id) === String(selectedParishId));
  const remainingChars = MAX_QUESTION_LENGTH - inputValue.length;

  const drawerElement = (
    <div
      className={`fixed inset-0 z-[9999] flex justify-end transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Caloy AI Assistant Conversation"
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      {/* Unpurgeable animation style for Caloy typing dots */}
      <style>{`
        @keyframes caloyDotPulse {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.35;
          }
          40% {
            transform: scale(1.15);
            opacity: 1;
          }
        }
        .caloy-typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background-color: #8B0000;
          display: inline-block;
          animation: caloyDotPulse 1.4s infinite ease-in-out both;
        }
        .caloy-typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .caloy-typing-dot:nth-child(2) { animation-delay: -0.16s; }
        .caloy-typing-dot:nth-child(3) { animation-delay: 0s; }
      `}</style>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        tabIndex={isOpen ? 0 : -1}
        className={`relative w-full max-w-md bg-white h-full shadow-card flex flex-col z-10 border-l border-border transition-transform duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-crimson text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-serif font-bold text-lg">
              C
            </div>
            <div>
              <h3 className="font-serif font-bold text-base leading-none">Caloy</h3>
              <span className="text-xs text-white/75">Parish Assistant</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors focus-ring"
            aria-label="Close assistant"
          >
            <X size={20} />
          </button>
        </div>

        {/* Parish Context Bar / Chip */}
        <div className="bg-app-page/90 border-b border-border px-3.5 py-2 text-xs flex items-center justify-between">
          {selectedParish ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
              <span className="text-crimson font-bold text-sm">📍</span>
              <span className="truncate font-semibold text-text-primary" title={selectedParish.name}>
                {selectedParish.name}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2 text-text-muted">
              <Church className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              <span className="truncate">Diocese-wide (All Parishes)</span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowManualParishSelect((prev) => !prev)}
              disabled={isTyping}
              className="text-xs text-crimson hover:underline font-semibold focus-ring px-1 py-0.5 rounded"
              aria-label={selectedParish ? "Change selected parish" : "Select a parish"}
            >
              {selectedParish ? "Change" : "Select Parish"}
            </button>
            {selectedParish && (
              <button
                type="button"
                onClick={() => handleSelectParish(null)}
                disabled={isTyping}
                className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-gray-200 transition-colors focus-ring"
                title="Clear parish filter to diocese-wide"
                aria-label="Clear parish filter to diocese-wide"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Expandable Manual Parish Filter Selector */}
        {showManualParishSelect && (
          <ParishSelector
            selectedParishId={selectedParishId}
            onSelectParish={(pId) => {
              handleSelectParish(pId);
              setShowManualParishSelect(false);
            }}
            disabled={isTyping}
          />
        )}

        {/* Messages List Container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-app-base"
          aria-live="polite"
        >
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-card p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-crimson text-white rounded-tr-none'
                    : msg.isError
                    ? 'bg-red-50 text-red-800 border border-red-200 rounded-tl-none shadow-sm'
                    : 'bg-white text-text-primary border border-border rounded-tl-none shadow-sm'
                }`}
              >
                {msg.sender === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <SafeMarkdown text={msg.text} />
                )}

                {/* Live Data Badge for TESTIMONIUM verified live operational results */}
                {msg.responseType === 'LIVE_DATA' && revealingMessageId !== msg.id && (
                  <div className="mt-2 pt-2 border-t border-border/70 flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>Current TESTIMONIUM Data</span>
                    </span>
                    {msg.liveData?.asOf && (
                      <span className="text-[10px] text-text-muted">
                        Updated just now
                      </span>
                    )}
                  </div>
                )}

                {/* Inline Parish Clarification Selector */}
                {msg.clarificationType === 'PARISH' && revealingMessageId !== msg.id && (idx === messages.length - 1 || Boolean(msg.selectedClarificationValue ?? (idx < messages.length - 1 ? selectedParishId : null))) && (() => {
                  const effectiveVal = msg.selectedClarificationValue ?? (idx < messages.length - 1 ? selectedParishId : null);
                  const isSelected = effectiveVal !== null && effectiveVal !== undefined && effectiveVal !== '';
                  const selectedParishObj = isSelected ? parishes.find((p) => String(p.id) === String(effectiveVal)) : null;
                  const selectedLabel = msg.selectedClarificationLabel || selectedParishObj?.name;

                  return (
                    <div className="mt-3 pt-2.5 border-t border-border/70">
                      <label
                        htmlFor={`parish-clarify-${msg.id}`}
                        className="block text-[11px] font-medium text-text-muted mb-1.5"
                      >
                        {isSelected ? 'Selected parish:' : 'Select your parish to continue:'}
                      </label>
                      <CustomSelect
                        id={`parish-clarify-${msg.id}`}
                        disabled={isTyping || isSelected}
                        value={isSelected ? String(effectiveVal) : ''}
                        selectedLabel={selectedLabel}
                        placeholder="Choose a parish..."
                        options={parishes.map((p) => ({ value: String(p.id), label: p.name }))}
                        onChange={(val) => {
                          const num = Number(val);
                          if (num && Number.isInteger(num) && num > 0) {
                            handleInlineParishSelect(num, msg.id);
                          }
                        }}
                        size="sm"
                        aria-label="Select parish for clarification"
                      />
                    </div>
                  );
                })()}

                {/* Inline Document Type Clarification Selector */}
                {msg.clarificationType === 'DOCUMENT_TYPE' && revealingMessageId !== msg.id && (idx === messages.length - 1 || Boolean(msg.selectedClarificationValue ?? (idx < messages.length - 1 ? getConversationContext()?.lastDocumentType : null))) && (() => {
                  const effectiveVal = msg.selectedClarificationValue ?? (idx < messages.length - 1 ? getConversationContext()?.lastDocumentType : null);
                  const isSelected = effectiveVal !== null && effectiveVal !== undefined && effectiveVal !== '';
                  const docOptions = msg.clarificationOptions && msg.clarificationOptions.length > 0
                    ? msg.clarificationOptions.map((opt) => ({ value: String(opt.value), label: opt.label }))
                    : DEFAULT_DOCUMENT_TYPE_OPTIONS;
                  const selectedDocObj = isSelected ? docOptions.find((o) => String(o.value) === String(effectiveVal)) : null;
                  const selectedLabel = msg.selectedClarificationLabel || selectedDocObj?.label || (isSelected ? String(effectiveVal) : undefined);

                  return (
                    <div className="mt-3 pt-2.5 border-t border-border/70">
                      <label
                        htmlFor={`doc-clarify-${msg.id}`}
                        className="block text-[11px] font-medium text-text-muted mb-1.5"
                      >
                        {isSelected ? 'Selected document:' : 'Select document type to continue:'}
                      </label>
                      <CustomSelect
                        id={`doc-clarify-${msg.id}`}
                        disabled={isTyping || isSelected}
                        value={isSelected ? String(effectiveVal) : ''}
                        selectedLabel={selectedLabel}
                        placeholder="Choose a document type..."
                        options={docOptions}
                        onChange={(val) => {
                          if (val) {
                            const found = docOptions.find((o) => String(o.value) === String(val));
                            handleInlineDocTypeSelect(String(val), msg.id, found?.label);
                          }
                        }}
                        size="sm"
                        aria-label="Select document type for clarification"
                      />
                    </div>
                  );
                })()}

                {/* Inline Schedule Event Clarification Selector */}
                {msg.clarificationType === 'SCHEDULE_EVENT' && revealingMessageId !== msg.id && (idx === messages.length - 1 || Boolean(msg.selectedClarificationValue ?? (idx < messages.length - 1 ? getConversationContext()?.lastScheduleEvent : null))) && (() => {
                  const effectiveVal = msg.selectedClarificationValue ?? (idx < messages.length - 1 ? getConversationContext()?.lastScheduleEvent : null);
                  const isSelected = effectiveVal !== null && effectiveVal !== undefined && effectiveVal !== '';
                  const eventOptions = (msg.clarificationOptions || []).map((opt) => ({
                    value: String(opt.value),
                    label: opt.label,
                  }));
                  const selectedEventObj = isSelected ? eventOptions.find((o) => String(o.value) === String(effectiveVal)) : null;
                  const selectedLabel = msg.selectedClarificationLabel || selectedEventObj?.label || (isSelected ? String(effectiveVal) : undefined);

                  return (
                    <div className="mt-3 pt-2.5 border-t border-border/70">
                      <label
                        htmlFor={`event-clarify-${msg.id}`}
                        className="block text-[11px] font-medium text-text-muted mb-1.5"
                      >
                        {isSelected ? 'Selected event/service:' : 'Select an event or service:'}
                      </label>
                      <CustomSelect
                        id={`event-clarify-${msg.id}`}
                        disabled={isTyping || isSelected}
                        value={isSelected ? String(effectiveVal) : ''}
                        selectedLabel={selectedLabel}
                        placeholder="Choose an event or service..."
                        options={eventOptions}
                        onChange={(val) => {
                          if (val) {
                            const found = eventOptions.find((o) => String(o.value) === String(val));
                            handleInlineEventTypeSelect(String(val), msg.id, found?.label);
                          }
                        }}
                        size="sm"
                        aria-label="Select schedule event for clarification"
                      />
                    </div>
                  );
                })()}

                {/* Sources Section for verified answers (revealed after text completes) */}
                {msg.sources && msg.sources.length > 0 && revealingMessageId !== msg.id && !msg.fallback && (
                  <SourcesAccordion sources={msg.sources} />
                )}

                <span
                  className={`text-[9px] block mt-1.5 ${
                    msg.sender === 'user' ? 'text-white/65 text-right' : 'text-text-muted'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div
              className="flex justify-start items-end space-x-2"
              role="status"
              aria-label="Caloy is typing an answer"
            >
              <div className="w-7 h-7 rounded-full bg-crimson text-white flex items-center justify-center text-xs font-serif font-bold flex-shrink-0 shadow-sm">
                C
              </div>
              <div className="bg-white border border-border rounded-card rounded-tl-none px-4 py-3 shadow-sm flex items-center space-x-2">
                <span className="caloy-typing-dot" />
                <span className="caloy-typing-dot" />
                <span className="caloy-typing-dot" />
                <span className="sr-only">Caloy is typing an answer</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-border flex flex-col gap-1.5">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              disabled={isTyping}
              maxLength={MAX_QUESTION_LENGTH}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Caloy about sacraments or parish guides..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-app-page border border-border rounded-button text-text-primary placeholder-text-muted focus-ring disabled:opacity-50"
              aria-label="Message input to Caloy"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isTyping || !inputValue.trim()}
              className="w-10 h-10 rounded-button flex items-center justify-center p-0 flex-shrink-0"
              aria-label="Send message"
            >
              <Send size={16} />
            </Button>
          </div>

          {/* Character counter */}
          <div className="flex justify-between items-center px-1 text-[10px] text-text-muted">
            <span>Press Enter to send</span>
            <span className={remainingChars < 50 ? 'text-amber-600 font-medium' : ''}>
              {inputValue.length}/{MAX_QUESTION_LENGTH}
            </span>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(drawerElement, document.body)
    : drawerElement;
};

export default CaloyDrawer;
