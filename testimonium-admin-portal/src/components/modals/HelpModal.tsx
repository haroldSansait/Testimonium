import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  HelpCircle,
  FileText,
  CalendarDays,
  Church,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ─── Help Section Data ─────────────────────────────────────────────────────────

interface HelpItem {
  question: string;
  answer: string;
}

interface HelpSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  roles: string[];
  items: HelpItem[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'navigation',
    icon: <ChevronRight className="w-4 h-4" />,
    title: 'Navigation Guide',
    roles: ['SECRETARY', 'PRIEST', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I navigate the admin portal?',
        answer: 'You can use the sidebar on the left (which expands when you hover over it) to navigate to the Dashboard, Calendar, Document/Schedule Requests, and other administration pages. Common tools like Help and About are accessible at the top right in the Navbar.',
      },
      {
        question: 'How does the collapsible sidebar work?',
        answer: 'The sidebar is collapsed by default to save screen space, displaying only icons. Hovering over it for 150ms will automatically expand it. You can also pin it to stay expanded across your sessions.',
      }
    ]
  },
  {
    id: 'requests',
    icon: <CalendarDays className="w-4 h-4" />,
    title: 'Request Workflow',
    roles: ['SECRETARY', 'PRIEST', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I approve scheduling requests?',
        answer: 'Open the Schedule Requests page, select a pending request, choose an available priest, and approve the schedule. The system will check for potential conflicts and alert you if the priest is unavailable.',
      },
      {
        question: 'How are corrections handled?',
        answer: 'If a request needs corrections, mark the status as requiring correction and input the details. The parishioner will be notified immediately to re-upload or update information on the web portal.',
      }
    ]
  },
  {
    id: 'map',
    icon: <Church className="w-4 h-4" />,
    title: 'Map Configuration Basics',
    roles: ['DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I configure parish map boundaries?',
        answer: 'As a Diocese Coordinator, open the Map Configuration page. You can drag and position parish boundaries, manage geographic marker pins, and upload custom parish boundary shapes directly on the interactive map.',
      },
      {
        question: 'What happens to unsaved map changes?',
        answer: 'If you try to navigate away with unsaved map changes, a confirmation warning will ask if you want to discard them. Be sure to click save on the toolbar to persist changes.',
      }
    ]
  },
  {
    id: 'documents',
    icon: <FileText className="w-4 h-4" />,
    title: 'Document Management',
    roles: ['SECRETARY', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I configure document requirements and fees?',
        answer: 'Go to Parish Settings and select the Document Fees & Requirements tab. You can configure individual certificate pricing and select which file uploads (e.g. Valid ID) are mandatory for request submissions.',
      },
      {
        question: 'How do I verify GCash/Maya payment receipts?',
        answer: 'Open a Payment Pending request to view the uploaded receipt image. The OCR service will extract the reference number and amount to cross-reference. Click Verify Payment to confirm and update status.',
      }
    ]
  }
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── HelpModal ─────────────────────────────────────────────────────────────────

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { role } = useAuth();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Filter sections to those visible for the current role
  const visibleSections = HELP_SECTIONS.filter((s) =>
    s.roles.includes(role || '')
  );

  // Auto-select first section on open
  useEffect(() => {
    if (isOpen && visibleSections.length > 0 && !activeSectionId) {
      setActiveSectionId(visibleSections[0].id);
    }
    if (!isOpen) {
      setActiveSectionId(null);
      setExpandedItems({});
    }
  }, [isOpen]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const activeSection = visibleSections.find((s) => s.id === activeSectionId);

  const toggleItem = (key: string) => {
    setExpandedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Admin Help Guide"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#7B1C2A] text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 opacity-90" />
            <div>
              <h2 className="text-base font-bold tracking-wide">Admin Help Guide</h2>
              <p className="text-[10px] text-white/70 mt-0.5 uppercase tracking-widest">TESTIMONIUM Parish Admin Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close help guide"
            id="help-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Section Nav (left) */}
          <div className="w-52 flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto py-3">
            {visibleSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSectionId(section.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                  activeSectionId === section.id
                    ? 'bg-[#7B1C2A]/10 text-[#7B1C2A] font-semibold border-l-2 border-[#7B1C2A]'
                    : 'text-gray-600 hover:bg-gray-100 border-l-2 border-transparent'
                }`}
                id={`help-section-${section.id}`}
              >
                <span className={activeSectionId === section.id ? 'text-[#7B1C2A]' : 'text-gray-400'}>
                  {section.icon}
                </span>
                {section.title}
              </button>
            ))}
          </div>

          {/* Content (right) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {activeSection ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[#7B1C2A]">{activeSection.icon}</span>
                  <h3 className="text-base font-bold text-gray-800">{activeSection.title}</h3>
                </div>
                {activeSection.items.map((item, idx) => {
                  const key = `${activeSection.id}-${idx}`;
                  const isExpanded = expandedItems[key] ?? true; // Default open
                  return (
                    <div
                      key={key}
                      className="border border-gray-200 rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => toggleItem(key)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-xs font-semibold text-gray-800">{item.question}</span>
                        <ChevronRight
                          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>
                      {isExpanded && (
                        <div className="px-4 py-3 bg-white border-t border-gray-100">
                          <p className="text-xs text-gray-600 leading-relaxed">{item.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Select a topic from the left to get started.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0 text-center">
          <p className="text-[11px] text-gray-400">
            For system issues, contact your Diocese Coordinator or IT administrator.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
