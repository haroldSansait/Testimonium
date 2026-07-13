import React, { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import services from '../../../providers/factory';

interface Message {
  id: string;
  sender: 'user' | 'caloy';
  text: string;
  timestamp: string;
}

interface CaloyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CaloyDrawer: React.FC<CaloyDrawerProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history from sessionStorage or initialize welcome message
  useEffect(() => {
    const stored = sessionStorage.getItem('testimonium_caloy_messages');
    if (stored) {
      setMessages(JSON.parse(stored));
    } else {
      const welcomeMsg: Message = {
        id: 'welcome',
        sender: 'caloy',
        text: "Hello! I'm Caloy, your TESTIMONIUM assistant. I can help you find parishes, explain requirements for sacramental documents, answer scheduling questions, and guide you through the portal.",
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMsg]);
      sessionStorage.setItem('testimonium_caloy_messages', JSON.stringify([welcomeMsg]));
    }
  }, []);

  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('testimonium_caloy_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Focus trap / ESC listener
  useEffect(() => {
    if (isOpen) {
      // Focus input on open
      setTimeout(() => inputRef.current?.focus(), 100);
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Smart auto-scroll: Only scroll if user was already at the bottom
  const scrollToBottom = (force = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;

    if (force || isAtBottom) {
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userText = inputValue.trim();
    const userMsg: Message = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    
    // Force scroll after user sends their own message
    scrollToBottom(true);

    try {
      const replyText = await services.chat.sendMessage(userText);
      const replyMsg: Message = {
        id: `c_${Date.now()}`,
        sender: 'caloy',
        text: replyText,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, replyMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: `c_${Date.now()}`,
        sender: 'caloy',
        text: 'I apologize, but my AI services are currently offline. Please contact your parish office directly for help.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      // Focus input back
      inputRef.current?.focus();
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex justify-end ${
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Caloy AI Assistant Conversation"
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
        className={`relative w-full max-w-md bg-white h-full shadow-card flex flex-col z-10 border-l border-border transition-transform duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-crimson text-white px-4 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-serif font-bold text-lg">
              C
            </div>
            <div>
              <h3 className="font-serif font-bold text-base leading-none">Caloy</h3>
              <span className="text-xs text-white/70">Parish Assistant</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white transition-colors focus-ring"
            aria-label="Close assistant"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages List Container */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-app-base"
          aria-live="polite"
        >
          {messages.map(msg => (
            <div 
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-card p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-crimson text-white rounded-tr-none'
                    : 'bg-white text-text-primary border border-border rounded-tl-none shadow-sm'
                }`}
              >
                <p>{msg.text}</p>
                <span className={`text-[9px] block mt-1.5 ${
                  msg.sender === 'user' ? 'text-white/65 text-right' : 'text-text-muted'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-border rounded-card rounded-tl-none p-3 shadow-sm flex items-center space-x-2">
                <span className="text-xs text-text-muted italic">Caloy is thinking</span>
                <span className="flex space-x-1">
                  <span className="w-1.5 h-1.5 bg-crimson rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-crimson rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-crimson rounded-full animate-bounce" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Message Form Footer */}
        <form 
          onSubmit={handleSend} 
          className="p-3 border-t border-border bg-white flex items-center space-x-2 flex-shrink-0"
        >
          <input
            ref={inputRef}
            type="text"
            disabled={isTyping}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Ask Caloy about schedules or document fees..."
            className="flex-1 px-4 py-2.5 text-sm bg-app-page border border-border rounded-button text-text-primary placeholder-text-muted focus-ring disabled:opacity-50"
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
        </form>
      </div>
    </div>
  );
};

export default CaloyDrawer;
