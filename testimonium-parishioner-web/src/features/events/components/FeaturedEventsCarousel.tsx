import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Clock, 
  MapPin, 
  Building,
  CalendarPlus,
  ArrowRight,
  Pause,
  Play
} from 'lucide-react';
import type { Event } from '../../../types';
import { getEventCountdownLabel, formatEventCalendarDate } from '../../../utils/date';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';

interface FeaturedEventsCarouselProps {
  events: Event[];
  onViewDetails: (event: Event) => void;
}

const AUTOPLAY_DURATION_MS = 8000;

export const FeaturedEventsCarousel: React.FC<FeaturedEventsCarouselProps> = ({ 
  events, 
  onViewDetails 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef<number>(AUTOPLAY_DURATION_MS);
  const timerStartRef = useRef<number | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Touch coordinates for swipe gestures
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Pagination container and active dot refs for auto-centering on mobile
  const paginationContainerRef = useRef<HTMLDivElement | null>(null);
  const activeDotRef = useRef<HTMLButtonElement | null>(null);

  const totalSlides = events.length;

  useEffect(() => {
    if (paginationContainerRef.current && activeDotRef.current) {
      const container = paginationContainerRef.current;
      const dot = activeDotRef.current;
      const scrollTarget = dot.offsetLeft - container.offsetWidth / 2 + dot.offsetWidth / 2;
      container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
  }, [currentIndex]);

  // Clear running slide timer
  const clearSlideTimer = useCallback(() => {
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current);
      slideTimerRef.current = null;
    }
  }, []);

  // Normalize currentIndex if filtered events change and index exceeds bounds
  useEffect(() => {
    if (currentIndex >= totalSlides && totalSlides > 0) {
      setCurrentIndex(0);
      remainingTimeRef.current = AUTOPLAY_DURATION_MS;
    }
  }, [totalSlides, currentIndex]);

  // Autoplay cyclic advance (wraps back to 0 at end)
  const advanceAutoplay = useCallback(() => {
    setCurrentIndex(prev => (prev >= totalSlides - 1 ? 0 : prev + 1));
    remainingTimeRef.current = AUTOPLAY_DURATION_MS;
  }, [totalSlides]);

  // Manual navigation with boundary bounds
  const nextSlide = useCallback(() => {
    if (currentIndex < totalSlides - 1) {
      setCurrentIndex(prev => prev + 1);
      remainingTimeRef.current = AUTOPLAY_DURATION_MS;
    }
  }, [currentIndex, totalSlides]);

  const prevSlide = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      remainingTimeRef.current = AUTOPLAY_DURATION_MS;
    }
  }, [currentIndex]);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < totalSlides) {
      setCurrentIndex(index);
      remainingTimeRef.current = AUTOPLAY_DURATION_MS;
    }
  }, [totalSlides]);

  // Check prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  // Single slide timer synchronized with pause/resume
  useEffect(() => {
    if (isPaused || totalSlides <= 1 || prefersReducedMotion) {
      clearSlideTimer();
      if (timerStartRef.current !== null) {
        const elapsed = Date.now() - timerStartRef.current;
        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
        timerStartRef.current = null;
      }
      return;
    }

    timerStartRef.current = Date.now();
    slideTimerRef.current = setTimeout(() => {
      advanceAutoplay();
    }, remainingTimeRef.current);

    return () => {
      clearSlideTimer();
    };
  }, [isPaused, totalSlides, prefersReducedMotion, currentIndex, advanceAutoplay, clearSlideTimer]);

  // Tab Inactive Pause Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Keyboard navigation listener
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === ' ') {
      e.preventDefault();
      setIsPaused(prev => !prev);
    }
  };

  // Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const diffX = touchStartX.current - touchEndX.current;
    const threshold = 45; // minimum swipe delta in pixels

    if (diffX > threshold) {
      nextSlide();
    } else if (diffX < -threshold) {
      prevSlide();
    }

    touchStartX.current = null;
    touchEndX.current = null;
    setIsPaused(false);
  };

  if (totalSlides === 0) return null;

  const getCategoryColor = (category: Event['category']): "ready" | "pending" | "under-review" | "rejected" | "neutral" | "crimson" | undefined => {
    switch (category) {
      case 'Holy Mass': return 'ready';
      case 'Baptism': return 'pending';
      case 'Wedding': return 'neutral';
      case 'Confirmation': return 'under-review';
      case 'Funeral': return 'rejected';
      case 'Fiesta': return 'under-review';
      case 'Seminar': return 'neutral';
      default: return 'neutral';
    }
  };

  const handleExportGoogleCalendar = (e: React.MouseEvent, event: Event) => {
    e.stopPropagation();
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(`${event.description}\n\nParish: ${event.parishName}\nLocation: ${event.location}`);
    const location = encodeURIComponent(`${event.location}, ${event.parishName}`);
    
    const dateStr = event.startDate.replace(/-/g, '');
    const startTimeStr = event.startTime ? event.startTime.replace(/[^0-9]/g, '').padEnd(4, '0') + '00' : '080000';
    const endTimeStr = event.endTime ? event.endTime.replace(/[^0-9]/g, '').padEnd(4, '0') + '00' : '100000';
    
    const dates = `${dateStr}T${startTimeStr}/${dateStr}T${endTimeStr}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isFirstSlide = currentIndex === 0;
  const isLastSlide = currentIndex === totalSlides - 1;

  return (
    <section 
      aria-roledescription="carousel" 
      aria-label="Featured Vicariate Events"
      className="relative outline-none select-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <style>{`
        @keyframes testimoniumCarouselProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      {/* Slides Container */}
      <div 
        className="relative w-full rounded-2xl overflow-hidden bg-white border border-border/80 shadow-md transition-all duration-300 md:h-[390px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {events.map((event, idx) => {
          const isActive = idx === currentIndex;
          const countdown = getEventCountdownLabel(event.startDate, event.startTime);
          
          return (
            <div
              key={event.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${idx + 1} of ${totalSlides}: ${event.title}`}
              aria-hidden={!isActive}
              inert={!isActive ? true : undefined}
              className={`transition-all duration-300 ease-in-out ${
                isActive 
                  ? 'relative flex flex-col w-full h-auto opacity-100 z-10 pointer-events-auto scale-100 md:absolute md:inset-0 md:flex-row md:h-full md:duration-500 animate-in fade-in' 
                  : 'hidden md:flex md:flex-row md:absolute md:inset-0 md:h-full opacity-0 z-0 pointer-events-none scale-[0.98] md:duration-500'
              }`}
            >
              {/* Event Image Cover */}
              <div className="relative w-full md:w-5/12 h-48 sm:h-52 md:h-full bg-neutral-900 overflow-hidden flex-shrink-0">
                <img
                  src={event.coverImage}
                  alt={event.coverImageAlt}
                  fetchPriority={idx === 0 ? 'high' : 'auto'}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/30" />
                
                {/* Category & Parish Badge overlay */}
                <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
                  <Badge variant={getCategoryColor(event.category)} className="py-1 px-3 font-bold text-xs tracking-wider shadow-sm backdrop-blur-md">
                    {event.category}
                  </Badge>
                </div>

                {/* Countdown Badge overlay */}
                <div className="absolute top-4 right-4 z-20">
                  <div className="bg-crimson text-white text-[11px] font-bold uppercase tracking-wider py-1 px-3 rounded-full shadow-md backdrop-blur-sm border border-white/20">
                    {countdown}
                  </div>
                </div>

                {/* Mobile Bottom overlay info */}
                <div className="md:hidden absolute bottom-3 left-4 right-4 text-white">
                  <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5 drop-shadow">
                    <Building size={13} className="text-red-300" />
                    {event.parishName}
                  </span>
                </div>
              </div>

              {/* Event Details Content Panel */}
              <div className="flex-1 p-4 sm:p-6 md:p-8 flex flex-col justify-between h-auto md:h-full bg-white text-text-primary">
                <div className="space-y-3.5 sm:space-y-4">
                  <div>
                    <div className="hidden md:flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider">
                      <Building size={14} className="text-crimson" />
                      <span>{event.parishName}</span>
                    </div>
                    <h3 className="font-serif font-bold text-lg sm:text-xl md:text-2xl text-text-primary mt-1 leading-tight tracking-tight">
                      {event.title}
                    </h3>
                  </div>

                  {/* Metadata coordinates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 sm:gap-y-2.5 text-xs text-text-muted bg-app-page/70 p-3 sm:p-3.5 rounded-xl border border-border/50">
                    <div className="flex items-center space-x-2 min-w-0">
                      <Calendar size={15} className="text-crimson flex-shrink-0" />
                      <span className="font-medium text-text-primary truncate">
                        {formatEventCalendarDate(event.startDate)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 min-w-0">
                      <Clock size={15} className="text-crimson flex-shrink-0" />
                      <span className="font-medium text-text-primary truncate">{event.startTime} - {event.endTime}</span>
                    </div>
                    <div className="flex items-center space-x-2 min-w-0 sm:col-span-2">
                      <MapPin size={15} className="text-crimson flex-shrink-0" />
                      <span className="font-medium text-text-primary truncate">{event.location}</span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-text-muted line-clamp-3 md:line-clamp-3 leading-relaxed">
                    {event.description}
                  </p>
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pt-3.5 sm:pt-4 border-t border-border/50 mt-3.5 sm:mt-4 md:mt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button 
                      size="sm"
                      onClick={() => onViewDetails(event)}
                      className="bg-crimson hover:bg-crimson-dark text-white font-semibold text-xs px-3.5 sm:px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
                    >
                      <span>View Details</span>
                      <ArrowRight size={13} className="ml-1.5 shrink-0" />
                    </Button>
                    
                    <button
                      type="button"
                      onClick={(e) => handleExportGoogleCalendar(e, event)}
                      title="Add to Google Calendar"
                      className="px-2.5 sm:px-3 py-2 border border-border rounded-lg text-text-muted hover:text-crimson hover:bg-red-50/40 hover:border-crimson/30 transition-all text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <CalendarPlus size={15} className="shrink-0" />
                      <span className="inline text-xs font-semibold">Add to Calendar</span>
                    </button>
                  </div>
                  
                  {/* Participant indicators */}
                  {event.registrationRequired && event.currentParticipants !== undefined && event.maxParticipants !== undefined && (
                    <span className="text-[11px] text-text-muted font-semibold bg-app-base py-1 px-2.5 sm:px-3 rounded-full border border-border/60 whitespace-nowrap">
                      Slots: <strong className="text-text-primary">{event.currentParticipants}/{event.maxParticipants}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* CSS-Driven Autoplay Progress Bar */}
        {totalSlides > 1 && !prefersReducedMotion && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 z-20 overflow-hidden">
            <div 
              key={currentIndex}
              className="h-full bg-crimson"
              style={{
                animation: `testimoniumCarouselProgress ${AUTOPLAY_DURATION_MS}ms linear forwards`,
                animationPlayState: isPaused ? 'paused' : 'running',
              }}
            />
          </div>
        )}
      </div>

      {/* Navigation Controls Bar */}
      {totalSlides > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 px-1 gap-2.5 sm:gap-0">
          {/* Top row on mobile: Pause/Play + Counter on Left, Arrows on Right */}
          <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2 sm:gap-2 sm:order-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(prev => !prev)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-gray-100 transition-colors focus-ring"
                title={isPaused ? "Resume Autoplay" : "Pause Autoplay"}
                aria-label={isPaused ? "Resume Autoplay" : "Pause Autoplay"}
              >
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
              </button>
              <span className="text-xs font-semibold text-text-muted whitespace-nowrap select-none">
                {currentIndex + 1} / {totalSlides}
              </span>
            </div>

            {/* Mobile-only Arrow Buttons: aligned to the right of the counter/pause row */}
            <div className="flex sm:hidden items-center gap-1.5">
              <button
                onClick={prevSlide}
                disabled={isFirstSlide}
                className={`p-1.5 rounded-lg bg-white border border-border transition-all focus-ring shadow-xs ${
                  isFirstSlide
                    ? 'opacity-40 text-text-muted/50 cursor-not-allowed'
                    : 'text-text-muted hover:text-crimson hover:bg-gray-50 active:scale-95'
                }`}
                aria-label="Previous event slide"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={nextSlide}
                disabled={isLastSlide}
                className={`p-1.5 rounded-lg bg-white border border-border transition-all focus-ring shadow-xs ${
                  isLastSlide
                    ? 'opacity-40 text-text-muted/50 cursor-not-allowed'
                    : 'text-text-muted hover:text-crimson hover:bg-gray-50 active:scale-95'
                }`}
                aria-label="Next event slide"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Pagination Dot Indicators: Row 2 on mobile, Center (order-2) on desktop */}
          <div 
            ref={paginationContainerRef}
            role="tablist" 
            aria-label="Carousel Slides" 
            className="flex items-center justify-center max-w-full overflow-x-auto py-1 px-1 space-x-1 sm:space-x-1.5 scrollbar-none sm:order-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {events.map((_, idx) => (
              <button
                key={idx}
                ref={idx === currentIndex ? activeDotRef : undefined}
                role="tab"
                aria-selected={idx === currentIndex}
                aria-label={`Go to event slide ${idx + 1}`}
                onClick={() => goToSlide(idx)}
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 flex-shrink-0 ${
                  idx === currentIndex 
                    ? 'bg-crimson w-5 sm:w-7' 
                    : 'bg-border hover:bg-text-muted/50 w-1.5 sm:w-2'
                }`}
              />
            ))}
          </div>

          {/* Desktop-only Prev/Next Arrow Buttons (order-3 on desktop) */}
          <div className="hidden sm:flex items-center gap-1.5 sm:order-3">
            <button
              onClick={prevSlide}
              disabled={isFirstSlide}
              className={`p-1.5 rounded-lg bg-white border border-border transition-all focus-ring shadow-xs ${
                isFirstSlide
                  ? 'opacity-40 text-text-muted/50 cursor-not-allowed'
                  : 'text-text-muted hover:text-crimson hover:bg-gray-50 hover:scale-105'
              }`}
              aria-label="Previous event slide"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={nextSlide}
              disabled={isLastSlide}
              className={`p-1.5 rounded-lg bg-white border border-border transition-all focus-ring shadow-xs ${
                isLastSlide
                  ? 'opacity-40 text-text-muted/50 cursor-not-allowed'
                  : 'text-text-muted hover:text-crimson hover:bg-gray-50 hover:scale-105'
              }`}
              aria-label="Next event slide"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default FeaturedEventsCarousel;


