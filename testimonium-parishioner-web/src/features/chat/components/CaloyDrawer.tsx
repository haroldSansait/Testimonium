import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Send } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import services from '../../../providers/factory';
import { ParishSelector } from './ParishSelector';
import { SourcesAccordion } from './SourcesAccordion';
import {
  CALOY_STORAGE_KEYS,
  readCaloyMessages,
  writeCaloyMessages,
  type ChatMessage,
} from '../caloyStorage';

export type { ChatMessage } from '../caloyStorage';

interface CaloyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

const MAX_QUESTION_LENGTH = 1000;

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

  const drawerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      // Restore focus to trigger on close
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = inputValue.trim();
    if (!cleanInput || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: cleanInput,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    scrollToBottom(true);

    try {
      const result = await services.chat.sendMessage(cleanInput, selectedParishId, sessionId);

      if (result.sessionId && result.sessionId !== sessionId) {
        setSessionId(result.sessionId);
        try {
          sessionStorage.setItem(CALOY_STORAGE_KEYS.sessionId, result.sessionId);
        } catch {}
      }

      const replyMsg: ChatMessage = {
        id: `c_${Date.now()}`,
        sender: 'caloy',
        text: result.answer,
        timestamp: new Date().toISOString(),
        fallback: result.fallback,
        sources: result.fallback ? [] : result.sources || [],
      };

      setMessages((prev) => [...prev, replyMsg]);
    } catch (err: any) {
      console.warn('[CaloyDrawer] Query error:', err);

      let errorText =
        'I apologize, but my AI services are currently offline. Please contact your parish office directly for help.';

      if (err?.statusCode === 429 || err?.code === 'CHATBOT_RATE_LIMITED') {
        errorText = "You've reached the message limit for now. Please wait a few minutes before trying again.";
      } else if (err?.statusCode === 503 || err?.code === 'CHATBOT_UNAVAILABLE') {
        errorText = 'Caloy is temporarily unavailable. Please check back later or contact your parish office.';
      } else if (err?.name === 'TypeError' || String(err?.message || '').includes('fetch')) {
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

        {/* Parish Filter Selector */}
        <ParishSelector
          selectedParishId={selectedParishId}
          onSelectParish={handleSelectParish}
          disabled={isTyping}
        />

        {/* Messages List Container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-app-base"
          aria-live="polite"
        >
          {messages.map((msg) => (
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
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Sources Section for verified answers */}
                {msg.sources && msg.sources.length > 0 && !msg.fallback && (
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
            <div className="flex justify-start">
              <div className="bg-white border border-border rounded-card rounded-tl-none p-3 shadow-sm flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-crimson/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-crimson/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-crimson/50 animate-bounce" style={{ animationDelay: '300ms' }} />
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
