import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  HelpCircle,
  FileText,
  Calendar,
  CalendarDays,
  Clock,
  Users,
  Church,
  BarChart2,
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
    id: 'schedule',
    icon: <CalendarDays className="w-4 h-4" />,
    title: 'Schedule Requests',
    roles: ['SECRETARY', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I approve a schedule request?',
        answer:
          'Open the Schedule Requests page, click on a Pending request to open the detail modal. Select a priest from the "Priest Assignment" dropdown, then click "Approve & Assign". The parishioner will be notified automatically.',
      },
      {
        question: 'How do I propose a reschedule?',
        answer:
          'Open a schedule request, click "Propose Reschedule" in the modal footer. Enter the proposed date and time, provide a reason, then click "Send Proposal to Parishioner". The parishioner can accept or decline the proposal.',
      },
      {
        question: 'What does the Tentative status mean?',
        answer:
          'Tentative means a scheduling conflict was detected (the priest is unavailable or another event overlaps). Review the conflict notice in the detail modal and either reassign a priest or propose an alternative date.',
      },
    ],
  },
  {
    id: 'documents',
    icon: <FileText className="w-4 h-4" />,
    title: 'Document Requests',
    roles: ['SECRETARY', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I process a document request?',
        answer:
          'Go to Document Requests and open a Pending request. Review the applicant details and attached requirements. Move it to Under Review once you begin processing, then to Payment Pending if fees apply. After payment is confirmed, set it to Ready for Pickup.',
      },
      {
        question: 'How do I verify a payment submission?',
        answer:
          'When a parishioner submits proof of payment, the request status changes to Payment Pending. Open the request, review the uploaded payment proof in the attachments section, and click "Verify Payment" if it is correct.',
      },
      {
        question: 'Can I reject a document request?',
        answer:
          'Yes. Open the request and click "Reject" in the action panel. You must provide a reason for rejection — this reason is sent to the parishioner as part of the notification.',
      },
    ],
  },
  {
    id: 'mass',
    icon: <Clock className="w-4 h-4" />,
    title: 'Mass Schedule Settings',
    roles: ['SECRETARY', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I add a new Mass time slot?',
        answer:
          'Go to Mass Schedule in the sidebar. Click "+ Add Time Slot", select the day type (Weekday, Sunday, Holiday, Special), enter the time and label (e.g. "Morning Mass"), and optionally assign a priest. Click Save.',
      },
      {
        question: 'How do Mass slots appear on the calendar?',
        answer:
          'Active Mass schedule templates automatically generate recurring calendar events for the current month. Editing or disabling a template affects all future calendar entries — existing confirmed schedules are not affected.',
      },
      {
        question: 'What is a "Holiday" or "Special" slot?',
        answer:
          'Holiday slots only generate events on official Philippine public holidays. Special slots are one-off entries you can manually assign to specific dates.',
      },
    ],
  },
  {
    id: 'availability',
    icon: <Calendar className="w-4 h-4" />,
    title: 'Leave & Availability',
    roles: ['SECRETARY', 'PRIEST', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I add a leave period for a priest?',
        answer:
          'Go to "My Leave Settings" in the sidebar. Click "+ Add Entry", select the type (Priest Leave, Secretary Leave, Parish Closed, Fully Booked), enter the date range and a description, then save. Leave periods prevent Mass slot generation for the affected priest on those dates.',
      },
      {
        question: 'How do I mark the parish as closed?',
        answer:
          'In My Leave Settings, add an entry with type "Parish Closed". Set the start and end date to cover the closure period. The calendar will reflect the closure and no new schedules can be booked for those dates.',
      },
    ],
  },
  {
    id: 'users',
    icon: <Users className="w-4 h-4" />,
    title: 'User Management',
    roles: ['DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I create a new staff account?',
        answer:
          'Go to User Management and click "+ Add Staff Member". Enter the staff member\'s name, email, role (Secretary, Priest, Assistant Priest), and assigned parish. Click Create — a secure onboarding link is generated and logged in the Activity Log.',
      },
      {
        question: 'How do I reset a staff member\'s password?',
        answer:
          'Find the staff member in User Management, open their action menu, and click "Reset Password". A Firebase password reset link is generated. Share it with the staff member or check the Activity Log to retrieve the link.',
      },
      {
        question: 'How do I disable a staff account?',
        answer:
          'Open the staff member\'s action menu in User Management and click "Disable Account". The account is immediately deactivated in both the application and Firebase. The staff member\'s data and history are preserved.',
      },
    ],
  },
  {
    id: 'parishes',
    icon: <Church className="w-4 h-4" />,
    title: 'Parish Management',
    roles: ['DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I edit parish details?',
        answer:
          'Go to Parish Management, find the parish, and click the edit icon. You can update the parish name, address, contact number, patron saint, feast day, and cover image. Changes are reflected immediately in the parishioner portal.',
      },
      {
        question: 'How do I assign a priest to a parish?',
        answer:
          'Parish-priest assignment is managed through User Management. Open the staff member\'s edit form and change their assigned parish. Both primary and assistant priests can be assigned to the same parish.',
      },
    ],
  },
  {
    id: 'analytics',
    icon: <BarChart2 className="w-4 h-4" />,
    title: 'Analytics & Reports',
    roles: ['DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'What data does the Analytics page show?',
        answer:
          'The Analytics page displays aggregate metrics across all Canlaon Vicariate parishes: total document requests by type, schedule request volume, parish activity comparisons, and monthly trend charts.',
      },
      {
        question: 'How do I view the system activity log?',
        answer:
          'Go to Activity Log in the sidebar. All staff actions — user creation, status changes, account resets — are listed chronologically with timestamps, actor name, and affected record.',
      },
    ],
  },
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
