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
  Landmark
} from 'lucide-react';
import type { Parish } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ParishPersonnelList } from './ParishPersonnelList';
import { ParishMassSchedule } from './ParishMassSchedule';

interface ParishDrawerProps {
  parish: Parish;
  onRequestDocument: (parishId: string) => void;
  onScheduleAppointment: (parishId: string) => void;
  onClose?: () => void;
}

export const ParishDrawer: React.FC<ParishDrawerProps> = ({ 
  parish, 
  onRequestDocument, 
  onScheduleAppointment, 
  onClose 
}) => {
  
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
        } catch (e) {
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

  const getOfficeHoursDisplay = (): string => {
    if (!parish.officeHours) return "Closed";
    
    let hoursObj: any = null;
    if (typeof parish.officeHours === 'object') {
      hoursObj = parish.officeHours;
    } else {
      try {
        hoursObj = JSON.parse(parish.officeHours);
      } catch (e) {
        return String(parish.officeHours);
      }
    }
    
    if (!hoursObj || typeof hoursObj !== 'object') return String(parish.officeHours);
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const groups: string[] = [];
    
    days.forEach(day => {
      const info = hoursObj[day];
      if (info) {
        const status = info.isClosed ? 'Closed' : `${info.openTime} - ${info.closeTime}`;
        groups.push(`${day.substring(0, 3)}: ${status}`);
      }
    });
    
    return groups.length > 0 ? groups.join(' | ') : "Closed";
  };

  const officeIsOpen = isOfficeOpen();
  const officeHoursText = getOfficeHoursDisplay();

  return (
    <Card className="flex-grow flex flex-col h-full overflow-hidden border border-border shadow-card relative bg-white">
      {/* Top Banner Image with Gradient Overlay */}
      <div className="relative h-48 sm:h-52 w-full flex-shrink-0 bg-gray-950">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
        
        {/* Close button (if onClose provided) */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 bg-black/45 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors z-20 focus-ring"
            aria-label="Close details"
          >
            <X size={16} />
          </button>
        )}

        {/* Parish Logo overlap */}
        <div className="absolute -bottom-8 left-6 w-20 h-20 rounded-full border-4 border-white bg-white overflow-hidden shadow-md z-10">
          {parish.logoImage ? (
            <img
              src={parish.logoImage}
              alt={`${parish.name} Logo`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 font-bold text-lg uppercase">
              {parish.name.substring(0, 2)}
            </div>
          )}
        </div>
      </div>

      {/* Main Info Details Area (Scrollable) */}
      <div className="flex-grow overflow-y-auto pt-10 px-5 pb-5 space-y-5 text-sm max-h-[50vh] sm:max-h-[60vh]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 leading-tight font-serif">
              {parish.name}
            </h2>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider ${
              officeIsOpen ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
            }`}>
              {officeIsOpen ? 'Open Now' : 'Closed'}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-xs text-gray-500 font-medium">
            <span className="flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-[#7B1C2A]" />
              Vicariate of Canlaon
            </span>
            <span className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-[#7B1C2A]" />
              Patron: {parish.patronSaint}
            </span>
          </div>
        </div>

        {/* Description & Saint History */}
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            About the Parish
          </h3>
          <p className="text-xs text-gray-650 leading-relaxed font-medium">
            {parish.directoryDescription || parish.description || 'No description configured yet.'}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
            <span className="text-text-muted">
              <strong className="text-text-primary font-medium">Feast Day:</strong> {parish.feastDay}
            </span>
          </div>
        </div>

        {/* Grid info: Office Hours & Staff */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
          <div className="space-y-1 bg-app-page p-3.5 rounded-button border border-border/40">
            <span className="text-[10px] font-bold text-text-muted uppercase flex items-center tracking-wider">
              <Clock size={12} className="mr-1.5 text-[#7B1C2A] flex-shrink-0" />
              Office Hours
            </span>
            <p className="text-xs text-text-primary mt-1 font-medium leading-relaxed break-words">
              {officeHoursText}
            </p>
          </div>
          <div className="space-y-1 bg-app-page p-3.5 rounded-button border border-border/40">
            <span className="text-[10px] font-bold text-text-muted uppercase flex items-center tracking-wider">
              <User size={12} className="mr-1.5 text-[#7B1C2A] flex-shrink-0" />
              Parish Personnel
            </span>
            <ParishPersonnelList priest={parish.assignedPriest} secretary={parish.assignedSecretary} />
          </div>
        </div>

        {/* Contact details */}
        <div className="space-y-2 bg-app-page p-4 rounded-button border border-border/40 text-xs text-text-muted">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-primary mb-2.5">
            Contact Information
          </h4>
          <div className="grid grid-cols-1 gap-2.5">
            <div className="flex items-start space-x-2">
              <Phone size={14} className="text-[#7B1C2A]/80 flex-shrink-0 mt-0.5" />
              <span className="text-text-primary font-medium break-all">{parish.phone || 'No phone listed'}</span>
            </div>
            <div className="flex items-start space-x-2">
              <Mail size={14} className="text-[#7B1C2A]/80 flex-shrink-0 mt-0.5" />
              <span className="text-text-primary font-medium break-all">{parish.email || 'No email listed'}</span>
            </div>
            {parish.facebookPage && (
              <a 
                href={parish.facebookPage} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center space-x-2 text-[#7B1C2A] hover:underline font-medium"
              >
                <Globe size={14} className="flex-shrink-0" />
                <span className="break-all">Facebook Page</span>
              </a>
            )}
          </div>
        </div>

        {/* Mass Schedule */}
        <ParishMassSchedule massSchedules={parish.massSchedules} />

        {/* Available Services */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
            Available Sacramental Services
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {parish.services.map(srv => (
              <span key={srv} className="text-[10px] font-semibold px-2 py-0.5 bg-red-50 text-[#7B1C2A] border border-[#7B1C2A]/10 rounded-full">
                {srv}
              </span>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        {parish.upcomingEvents && parish.upcomingEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Upcoming Parish Events
            </h4>
            <ul className="text-xs space-y-1.5 text-text-primary">
              {parish.upcomingEvents.map((evt, idx) => (
                <li key={idx} className="flex items-center space-x-2">
                  <Calendar size={12} className="text-[#7B1C2A] flex-shrink-0" />
                  <span>{evt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer Actions (Pre-configured button links) */}
      <div className="p-3 border-t border-border flex flex-row gap-2 bg-app-page flex-shrink-0">
        <Button 
          className="flex-1 flex items-center justify-center space-x-1 text-xs h-9 px-2 bg-[#7B1C2A] hover:bg-[#5C1520]"
          onClick={() => onRequestDocument(parish.id)}
        >
          <FileText size={12} />
          <span className="truncate">Request</span>
        </Button>
        <Button 
          variant="outline"
          className="flex-1 flex items-center justify-center space-x-1 text-xs h-9 px-2 border-[#7B1C2A] text-[#7B1C2A] hover:bg-[#7B1C2A]/5"
          onClick={() => onScheduleAppointment(parish.id)}
        >
          <Calendar size={12} />
          <span className="truncate">Schedule</span>
        </Button>
        <a 
          href={`https://www.google.com/maps?q=${parish.coordinates.lat},${parish.coordinates.lng}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center space-x-1 border border-border bg-white text-text-muted hover:text-text-primary text-xs font-semibold rounded-button px-2 transition-colors h-9 focus-ring"
        >
          <Compass size={12} className="text-text-muted" />
          <span className="truncate">Directions</span>
        </a>
      </div>
    </Card>
  );
};

export default ParishDrawer;
