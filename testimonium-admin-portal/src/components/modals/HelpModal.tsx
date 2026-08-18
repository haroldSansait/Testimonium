import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  HelpCircle,
  FileText,
  CalendarDays,
  Church,
  ChevronRight,
  Sliders,
  Users,
  MapPin,
  Activity,
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
    id: 'secretary-docs',
    icon: <FileText className="w-4 h-4" />,
    title: 'Secretary: Documents & Payments',
    roles: ['SECRETARY', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I review incoming document certificate requests?',
        answer: 'Open Document Requests from the sidebar to view incoming submissions. The system automatically snapshots the authoritative certificate fee (e.g. ₱100.00, ₱250.00) based on parish settings at submission time. Click any request to inspect applicant details, relationship, purpose, and uploaded prerequisite documents.',
      },
      {
        question: 'How do I verify GCash and Maya payments with OCR?',
        answer: 'When a request is in "Payment Under Review" or "Payment Pending", open the payment verification drawer. The OCR engine automatically scans the uploaded receipt image, extracting the reference number, paid amount, and confidence scores. Cross-reference the extracted number with your parish merchant account and click "Verify Payment" to advance status to "Processing".',
      },
      {
        question: 'How do I request corrections or missing file re-uploads?',
        answer: 'If an applicant submitted an invalid or blurry document, click "Request Correction". Select the specific requirement tags that need re-upload (e.g. Valid ID, Birth Certificate, CENOMAR) and enter a clear instruction note. The parishioner is instantly notified on their web portal to re-upload the requested items.',
      },
      {
        question: 'How do I complete and release processed certificates?',
        answer: 'Once the physical certificate has been printed, sealed, and signed by the parish priest, update the request status to "Ready for Pickup". When the applicant claims the certificate at the parish office, mark it as "Completed".',
      }
    ]
  },
  {
    id: 'secretary-scheduling',
    icon: <CalendarDays className="w-4 h-4" />,
    title: 'Secretary: Sacramental Scheduling',
    roles: ['SECRETARY', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I process sacramental appointment requests?',
        answer: 'Go to Schedule Requests to review bookings for Baptisms, Weddings, Canonical Interviews, Blessings, and Special Masses. Select a pending booking, assign an available presiding priest, and confirm the reservation.',
      },
      {
        question: 'How does priest conflict detection work?',
        answer: 'When assigning a priest to an appointment or Mass, the system automatically checks for overlapping schedules across all parishes and warns you if the priest has another concurrent commitment or active leave block.',
      },
      {
        question: 'How do I propose an alternative reschedule date and time?',
        answer: 'If the requested slot conflicts with a parish recollection or funeral, click "Propose Reschedule". Choose a new date and time slot, and enter a mandatory reason note. The booking transitions to "Proposed Reschedule" and the parishioner receives an accept/decline prompt on their portal.',
      }
    ]
  },
  {
    id: 'secretary-settings',
    icon: <Sliders className="w-4 h-4" />,
    title: 'Secretary: Parish Settings & Limits',
    roles: ['SECRETARY', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I configure document pricing and offered certificates?',
        answer: 'In Parish Settings under Tab 1 (Document Fees & Requirements), you can configure individual document fees and toggle mandatory file uploads. In the Offered Documents section, check only the certificates your parish currently issues.',
      },
      {
        question: 'How do I set booking slot capacity vs church venue capacity?',
        answer: 'In Parish Settings under Tab 2 (Sacramental Scheduling), "Slot Capacity" controls how many concurrent appointments can be booked in the exact same time slot window (e.g. 2 bookings/slot). "Daily Limit" caps total bookings for a single day (e.g. 10/day). "Maximum Venue Capacity" is the physical church attendance limit (e.g. 150 people) displayed as an informational guide to parishioners.',
      },
      {
        question: 'How do I customize available time slots and offered sacraments?',
        answer: 'Under Tab 2, use the Offered Sacraments toggle chips to enable or disable specific rites. In the Time Slots builder, add standard operating slots (e.g. 08:00 AM, 09:30 AM, 01:30 PM, 03:30 PM). Parishioners will only be able to book active slots.',
      },
      {
        question: 'How do I upload and activate GCash / Maya payment QR codes?',
        answer: 'In Tab 4 (Payment QR Code), upload an image of your parish GCash or Maya merchant QR code and click "Enable Payment QR". Parishioners ordering documents will scan this QR code directly during checkout.',
      },
      {
        question: 'How do unsaved changes guards work in Settings?',
        answer: 'Any modification to settings, fees, or time slots flags the page as dirty. If you attempt to switch parishes or close the tab, the system will prompt you to save or discard your changes to prevent accidental data loss.',
      }
    ]
  },
  {
    id: 'coordinator-map',
    icon: <MapPin className="w-4 h-4" />,
    title: 'Coordinator: Map Configuration',
    roles: ['DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I position and adjust church map markers?',
        answer: 'As a Diocese Coordinator, open Map Configuration. You can drag and drop church markers to their precise physical sanctuary coordinates, or click and use keyboard arrow keys for fine-tuned nudging with boundary clamping.',
      },
      {
        question: 'How do I customize map pin colors and styling?',
        answer: 'Select a parish from the map settings panel. You can select curated swatches or enter a custom hex color (e.g. Testimonium Crimson #7B1C2A). You can also adjust the default zoom level (1–20) and toggle permanent label display.',
      },
      {
        question: 'How do I save map updates safely?',
        answer: 'Changes are tracked in real-time on the Save Toolbar with an unsaved changes glow indicator. Click "Save Changes" to commit the batch updates, or "Discard" to revert to the persisted coordinates.',
      }
    ]
  },
  {
    id: 'coordinator-users',
    icon: <Users className="w-4 h-4" />,
    title: 'Coordinator: Staff & User Management',
    roles: ['DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I add or provision parish priests and secretaries?',
        answer: 'Navigate to User Management. Click "Add User", select the role (SECRETARY or PRIEST), assign their target parish, and input their full name and email. Pre-provisioned staff accounts link automatically when the staff member logs in with Firebase.',
      },
      {
        question: 'How do I assign calendar color codes and assistant flags?',
        answer: 'In User Management, edit a priest\'s profile to assign a personalized calendar color tag. For assistant clergy, enable the "Assistant Priest" toggle.',
      },
      {
        question: 'How do I deactivate or archive user accounts?',
        answer: 'Toggle the status switch to "Inactive" or "Disabled" on any user row. Deactivated users are immediately prevented from accessing administrative endpoints.',
      }
    ]
  },
  {
    id: 'coordinator-audit',
    icon: <Activity className="w-4 h-4" />,
    title: 'Coordinator: Activity Logs & Audits',
    roles: ['DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I monitor administrative actions across the Vicariate?',
        answer: 'Open Activity Log to view a tamper-resistant audit trail of all staff operations, status transitions, and setting adjustments. Each entry captures actor role, IP address, timestamp, and detailed JSON diffs of previous vs new values.',
      },
      {
        question: 'How do I archive and maintain audit logs?',
        answer: 'Use the "Archive Logs" button to compress and archive records older than the retention threshold (default: 365 days). You can filter between active and archived logs at any time.',
      }
    ]
  },
  {
    id: 'priest-calendar',
    icon: <Church className="w-4 h-4" />,
    title: 'Priest: Calendar & Mass Assignments',
    roles: ['PRIEST', 'DIOCESE_COORDINATOR'],
    items: [
      {
        question: 'How do I check my assigned presiding schedule?',
        answer: 'Go to Calendar to view a unified feed of confirmed appointments, Sunday Masses, wake services, and fiesta celebrations assigned to you.',
      },
      {
        question: 'How do I respond to assignment requests?',
        answer: 'When a parish secretary assigns you to a special Mass or sacramental celebration, you can confirm your availability or decline with notes directly from the Calendar or Mass Schedule tab.',
      },
      {
        question: 'How do I set my personal leave or pastoral unavailability?',
        answer: 'Open Staff Availability to log planned recollection leaves, diocesan meetings, or sick days. The scheduling system will automatically flag conflicting appointment requests during your leave.',
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
