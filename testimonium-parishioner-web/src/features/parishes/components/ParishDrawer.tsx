import React from 'react';
import { 
  Clock, 
  User, 
  FileText, 
  Calendar, 
  Phone, 
  Mail, 
  Globe, 
  Compass, 
  X,
  Award,
  MapPin,
  FileCheck
} from 'lucide-react';
import type { Parish } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import {
  CANONICAL_DOCUMENT_TYPES,
  DEFAULT_OFFERED_DOCUMENTS,
} from '../../../config/documents';
import { ParishPersonnelList } from './ParishPersonnelList';
import { ParishMassSchedule } from './ParishMassSchedule';
import { ParishCouncilSection } from './ParishCouncilSection';
import { useParish } from '../../../hooks/useService';

interface ParishDrawerProps {
  parish: Parish;
  onRequestDocument: (parishId: string) => void;
  onScheduleAppointment: (parishId: string) => void;
  onClose?: () => void;
}

interface DaySchedule {
  day: string;
  fullDay: string;
  hours: string;
  isClosed: boolean;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

export const ParishDrawer: React.FC<ParishDrawerProps> = ({ 
  parish, 
  onRequestDocument, 
  onScheduleAppointment, 
  onClose 
}) => {
  const { data: detailParish, loading: loadingDetail } = useParish(parish.id);
  const effectiveParish = detailParish || parish;
  
  // Calculate if the parish office is currently open based on current time
  const isOfficeOpen = () => {
    const now = new Date();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = daysOfWeek[now.getDay()]; // e.g. "Monday"
    
    let hoursObj: any = null;
    if (parish.officeHours) {
      if (typeof parish.officeHours === 'object') {
        hoursObj = parish.officeHours;
      } else {
        try {
          hoursObj = JSON.parse(parish.officeHours as any);
        } catch {
          // ignore and fallback
        }
      }
    }
    
    if (hoursObj && hoursObj[currentDayName]) {
      const todayHours = hoursObj[currentDayName];
      if (todayHours.isClosed) return false;
      
      const parseTime = (timeStr: string) => {
        const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
        if (!match) return { hour: 8, minute: 0 };
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return { hour: h, minute: m };
      };
      
      const open = parseTime(todayHours.openTime);
      const close = parseTime(todayHours.closeTime);
      
      const currentTotalMin = now.getHours() * 60 + now.getMinutes();
      const openTotalMin = open.hour * 60 + open.minute;
      const closeTotalMin = close.hour * 60 + close.minute;
      
      return currentTotalMin >= openTotalMin && currentTotalMin <= closeTotalMin;
    }
    
    const day = now.getDay(); // 0 is Sunday, 5 is Friday
    const hour = now.getHours();
    
    const hoursLower = String(parish.officeHours || '').toLowerCase();
    const isClosedMonday = hoursLower.includes('tuesday -') || hoursLower.includes('tues -');
    const isClosedSunday = hoursLower.includes('tuesday - saturday') || hoursLower.includes('tue - sat');
    
    if (day === 1 && isClosedMonday) return false;
    if (day === 0 && isClosedSunday) return false;
    
    return (hour >= 8 && hour < 12) || (hour >= 13 && hour < 17);
  };

  const getOfficeHoursSchedule = (): DaySchedule[] => {
    let hoursObj: any = null;
    if (parish.officeHours) {
      if (typeof parish.officeHours === 'object') {
        hoursObj = parish.officeHours;
      } else {
        try {
          hoursObj = JSON.parse(parish.officeHours);
        } catch {
          hoursObj = null;
        }
      }
    }

    if (hoursObj && typeof hoursObj === 'object') {
      return DAYS.map((day) => {
        const info = hoursObj[day];
        if (!info || info.isClosed) {
          return { day: DAY_ABBR[day], fullDay: day, hours: 'Closed', isClosed: true };
        }
        const open = info.openTime || '08:00 AM';
        const close = info.closeTime || '05:00 PM';
        return { day: DAY_ABBR[day], fullDay: day, hours: `${open} – ${close}`, isClosed: false };
      });
    }

    const lower = String(parish.officeHours || '').toLowerCase();
    const isClosedSun = lower.includes('tue - sat') || lower.includes('tuesday - saturday') || lower.includes('mon - fri');
    const isClosedMon = lower.includes('tue - sat') || lower.includes('tuesday - saturday');

    return DAYS.map((day) => {
      if (day === 'Sunday' && isClosedSun) {
        return { day: DAY_ABBR[day], fullDay: day, hours: 'Closed', isClosed: true };
      }
      if (day === 'Monday' && isClosedMon) {
        return { day: DAY_ABBR[day], fullDay: day, hours: 'Closed', isClosed: true };
      }
      if (day === 'Saturday' && (lower.includes('12:00 pm') || lower.includes('half day'))) {
        return { day: DAY_ABBR[day], fullDay: day, hours: '08:00 AM – 12:00 PM', isClosed: false };
      }
      return { day: DAY_ABBR[day], fullDay: day, hours: '08:00 AM – 05:00 PM', isClosed: false };
    });
  };

  const officeIsOpen = isOfficeOpen();
  const officeSchedule = getOfficeHoursSchedule();

  return (
    <Card className="flex flex-col h-full overflow-hidden border border-border/80 shadow-2xl rounded-2xl bg-white select-none">
      <div className="relative h-44 sm:h-48 w-full flex-shrink-0 bg-neutral-900 overflow-hidden">
        <img 
          src={parish.coverImage} 
          alt={parish.name} 
          className="w-full h-full object-cover object-center"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== "/assets/church_placeholder.png") {
              target.src = "/assets/church_placeholder.png";
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
        
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-all z-20 focus-ring cursor-pointer"
            aria-label="Close details"
          >
            <X size={16} />
          </button>
        )}

        <div className="absolute bottom-3 left-4 right-4 text-white z-10 flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                officeIsOpen ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}>
                {officeIsOpen ? 'Open Now' : 'Closed'}
              </span>
              <span className="text-xs text-white/80 font-medium">
                Feast: {parish.feastDay}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-serif leading-tight drop-shadow-sm">
              {parish.name}
            </h2>
            <p className="text-xs text-white/90 flex items-center gap-1 mt-0.5">
              <Award size={13} className="text-amber-300" />
              Patron Saint: {parish.patronSaint}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 text-xs space-y-2.5">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-crimson flex-shrink-0 mt-0.5" />
                <span className="text-text-primary font-medium">{parish.address}</span>
              </div>
              {parish.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-crimson flex-shrink-0" />
                  <span className="text-text-primary font-medium">{parish.phone}</span>
                </div>
              )}
              {parish.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-crimson flex-shrink-0" />
                  <span className="text-text-primary font-medium truncate">{parish.email}</span>
                </div>
              )}
              {parish.facebookPage && (
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-crimson flex-shrink-0" />
                  <a 
                    href={parish.facebookPage} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-crimson font-bold hover:underline"
                  >
                    Official Facebook Page
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                About the Parish
              </h4>
              <p className="text-xs text-text-muted leading-relaxed">
                {parish.directoryDescription || parish.description || 'Welcome to our parish community under the Vicariate of Canlaon.'}
              </p>
            </div>

            <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 space-y-2">
              <span className="text-[10px] font-bold text-text-muted uppercase flex items-center tracking-wider pb-1 border-b border-border/50">
                <User size={12} className="mr-1.5 text-crimson" />
                Parish Administration
              </span>
              <ParishPersonnelList priest={parish.assignedPriest} secretary={parish.assignedSecretary} />
            </div>

            <ParishCouncilSection councils={effectiveParish.councils} loading={loadingDetail && !detailParish} />
          </div>

          <div className="space-y-4">
            <ParishMassSchedule massSchedules={parish.massSchedules} />

            <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                <span className="text-[10px] font-bold text-text-muted uppercase flex items-center tracking-wider">
                  <Clock size={12} className="mr-1.5 text-crimson" />
                  Office Hours
                </span>
                <span className="text-[10px] text-text-muted font-medium">Weekly Schedule</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs">
                {officeSchedule.map((item) => (
                  <div key={item.day} className="flex items-center justify-between py-0.5">
                    <span className="font-semibold text-text-primary text-xs w-10">{item.day}</span>
                    <span
                      className={
                        item.isClosed
                          ? 'text-gray-400 font-normal text-xs'
                          : 'text-text-primary font-semibold font-mono text-[11px]'
                      }
                    >
                      {item.hours}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {(() => {
              const effectiveDocs = parish.availableDocuments !== null && parish.availableDocuments !== undefined
                ? parish.availableDocuments
                : DEFAULT_OFFERED_DOCUMENTS;

              if (!Array.isArray(effectiveDocs) || effectiveDocs.length === 0) return null;

              return (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck size={13} className="text-crimson" />
                    Offered Certificates
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveDocs.map((docId) => {
                      const docDef = CANONICAL_DOCUMENT_TYPES.find((d) => d.id === docId);
                      const label = docDef ? docDef.label : docId;
                      return (
                        <span
                          key={docId}
                          className="text-[10px] font-semibold px-2.5 py-1 bg-gray-100 text-gray-800 rounded-md border border-gray-200"
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="p-3 bg-app-page border-t border-border flex items-center gap-2 flex-shrink-0">
        <Button 
          className="flex-1 bg-crimson hover:bg-crimson-dark text-white font-bold text-xs h-9"
          onClick={() => onRequestDocument(parish.id)}
        >
          <FileText size={13} className="mr-1.5" />
          <span>Request Document</span>
        </Button>
        <Button 
          variant="outline"
          className="flex-1 border-crimson text-crimson hover:bg-red-50 font-bold text-xs h-9"
          onClick={() => onScheduleAppointment(parish.id)}
        >
          <Calendar size={13} className="mr-1.5" />
          <span>Schedule Rite</span>
        </Button>
        <a 
          href={`https://www.google.com/maps?q=${parish.coordinates.lat},${parish.coordinates.lng}`}
          target="_blank"
          rel="noreferrer"
          className="p-2 border border-border bg-white text-text-muted hover:text-crimson hover:border-crimson/30 rounded-lg transition-colors flex items-center justify-center h-9"
          title="Open in Google Maps"
        >
          <Compass size={16} />
        </a>
      </div>
    </Card>
  );
};

export default ParishDrawer;
