import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Building } from 'lucide-react';
import type { Event } from '../../../types';
import { getEventCountdownLabel } from '../../../utils/date';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';

interface FeaturedEventsCarouselProps {
  events: Event[];
  onViewDetails: (event: Event) => void;
}

export const FeaturedEventsCarousel: React.FC<FeaturedEventsCarouselProps> = ({ 
  events, 
  onViewDetails 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoplayTimerRef = useRef<any>(null);
  
  // Touch coordinates for swipe gestures
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const totalSlides = events.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex(prev => (prev === totalSlides - 1 ? 0 : prev + 1));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentIndex(prev => (prev === 0 ? totalSlides - 1 : prev - 1));
  }, [totalSlides]);

  // Autoplay Setup
  useEffect(() => {
    if (isPaused || totalSlides <= 1) {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      return;
    }

    autoplayTimerRef.current = setInterval(() => {
      nextSlide();
    }, 9000); // 9 seconds autoplay period

    return () => {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
      }
    };
  }, [isPaused, nextSlide, totalSlides]);

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
    const threshold = 55; // minimum swipe delta in pixels

    if (diffX > threshold) {
      nextSlide();
    } else if (diffX < -threshold) {
      prevSlide();
    }

    // Reset touch variables and resume playing
    touchStartX.current = null;
    touchEndX.current = null;
    setIsPaused(false);
  };

  if (totalSlides === 0) return null;

  const getCategoryColor = (category: Event['category']): "ready" | "pending" | "under-review" | "rejected" | "neutral" | "crimson" | undefined => {
    switch (category) {
      case 'Holy Mass': return 'ready';
      case 'Fiesta': return 'under-review';
      case 'Seminar': return 'neutral';
      case 'Youth': return 'pending';
      case 'Formation': return 'neutral';
      case 'Retreat': return 'under-review';
      case 'Outreach': return 'ready';
      case 'Community': return 'ready';
      case 'Diocesan Event': return 'pending';
      case 'Sacramental': return 'neutral';
      default: return 'neutral';
    }
  };

  return (
    <section 
      aria-roledescription="carousel" 
      aria-label="Featured Vicariate Events"
      className="relative outline-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Slides Container */}
      <div 
        className="relative h-[480px] md:h-[380px] w-full rounded-card overflow-hidden bg-app-page border border-border shadow-md"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {events.map((event, idx) => {
          const isActive = idx === currentIndex;
          const countdown = getEventCountdownLabel(event.startDate);
          
          return (
            <div
              key={event.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${idx + 1} of ${totalSlides}`}
              aria-hidden={!isActive}
              className={`absolute inset-0 flex flex-col md:flex-row transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Event Image Cover */}
              <div className="relative w-full md:w-5/12 h-48 md:h-full bg-border overflow-hidden">
                <img
                  src={event.coverImage}
                  alt={event.coverImageAlt}
                  loading="lazy"
                  className="w-full h-full object-cover select-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/5" />
                
                {/* Category Badge overlay */}
                <div className="absolute top-4 left-4 z-20">
                  <Badge variant={getCategoryColor(event.category)} className="capitalize py-1 px-2.5 font-semibold text-xs tracking-wider">
                    {event.category}
                  </Badge>
                </div>

                {/* Countdown Badge overlay */}
                <div className="absolute top-4 right-4 z-20">
                  <div className="bg-crimson text-white text-[10px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-full shadow">
                    {countdown}
                  </div>
                </div>
              </div>

              {/* Event Details Content Panel */}
              <div className="flex-1 p-6 md:p-8 flex flex-col justify-between h-auto md:h-full bg-white text-text-primary">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase flex items-center space-x-1">
                      <Building size={12} className="text-crimson mr-1" />
                      <span>{event.parishName}</span>
                    </span>
                    <h3 className="font-serif font-bold text-lg md:text-2xl text-text-primary mt-1 md:mt-2 leading-tight">
                      {event.title}
                    </h3>
                  </div>

                  {/* Metadata coordinates */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-text-muted">
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <Calendar size={14} className="text-crimson/70 flex-shrink-0" />
                      <span className="truncate">{new Date(event.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <Clock size={14} className="text-crimson/70 flex-shrink-0" />
                      <span className="truncate">{event.startTime} - {event.endTime}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 min-w-0 col-span-2">
                      <MapPin size={14} className="text-crimson/70 flex-shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-text-muted line-clamp-3 leading-relaxed">
                    {event.description}
                  </p>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between pt-4 border-t border-border/40">
                  <Button 
                    size="sm"
                    onClick={() => onViewDetails(event)}
                    className="bg-crimson hover:bg-crimson-dark text-white font-semibold text-xs tracking-wider"
                  >
                    View Details
                  </Button>
                  
                  {/* Participant indicators */}
                  {event.registrationRequired && event.currentParticipants !== undefined && event.maxParticipants !== undefined && (
                    <span className="text-[10px] text-text-muted font-medium bg-app-base py-1 px-2.5 rounded-full border border-border/40">
                      Slots: {event.currentParticipants}/{event.maxParticipants} Registered
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      {totalSlides > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-[24%] md:top-1/2 md:-translate-y-1/2 z-20 p-1.5 md:p-2.5 rounded-full bg-white/90 border border-border text-text-primary hover:text-crimson hover:bg-white hover:scale-105 shadow transition-all focus-ring"
            aria-label="Previous slide"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-[24%] md:top-1/2 md:-translate-y-1/2 z-20 p-1.5 md:p-2.5 rounded-full bg-white/90 border border-border text-text-primary hover:text-crimson hover:bg-white hover:scale-105 shadow transition-all focus-ring"
            aria-label="Next slide"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* Pagination Dot Indicators (Rendered below the slide container to avoid overlaps) */}
      {totalSlides > 1 && (
        <div 
          role="tablist" 
          aria-label="Slides" 
          className="flex justify-center space-x-2 mt-4"
        >
          {events.map((_, idx) => (
            <button
              key={idx}
              role="tab"
              aria-selected={idx === currentIndex}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                idx === currentIndex 
                  ? 'bg-crimson w-6' 
                  : 'bg-text-muted/30 hover:bg-text-muted/60'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
export default FeaturedEventsCarousel;

