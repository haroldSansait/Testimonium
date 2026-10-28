import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Calendar,
  Map,
  ClipboardCheck,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';

// Admin Portal URL — update to production URL when deploying.
// Intentionally external navigation (not React Router) because the Admin Portal
// is a completely independent application running on a separate port/domain.
const ADMIN_PORTAL_URL = import.meta.env.VITE_ADMIN_PORTAL_URL ?? 'http://localhost:5174';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // Hero section initial entrance animation (runs once on page load)
  const [heroEntered, setHeroEntered] = useState(false);
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setHeroEntered(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Scroll reveal hooks for sections (replay upon scrolling down and scrolling back up)
  const { ref: bannerRef, isVisible: isBannerVisible } = useScrollReveal<HTMLElement>({
    threshold: 0.15,
  });

  const { ref: servicesRef, isVisible: isServicesVisible } = useScrollReveal<HTMLElement>({
    threshold: 0.1,
  });

  const { ref: aboutRef, isVisible: isAboutVisible } = useScrollReveal<HTMLElement>({
    threshold: 0.1,
  });

  const { ref: mobileAppRef, isVisible: isMobileAppVisible } = useScrollReveal<HTMLElement>({
    threshold: 0.1,
  });

  const { ref: staffRef, isVisible: isStaffVisible } = useScrollReveal<HTMLElement>({
    threshold: 0.15,
  });

  const services = [
    {
      title: 'Sacramental Requests',
      description: 'Request official certificates for Baptism, Confirmation, Marriage, and other sacramental registries securely online.',
      icon: <FileText className="text-crimson w-7 h-7" />,
      actionText: 'Request Certificates',
    },
    {
      title: 'Event Scheduling',
      description: 'Schedule weddings, baptisms, canonical interviews, and parish events directly with your local church calendar.',
      icon: <Calendar className="text-crimson w-7 h-7" />,
      actionText: 'Book Appointments',
    },
    {
      title: 'Vicariate Directory',
      description: 'Locate nearby parishes, view office hours, check mass schedules, and contact the assigned parish secretary using our interactive vicariate map.',
      icon: <Map className="text-crimson w-7 h-7" />,
      actionText: 'Explore Parishes',
    },
    {
      title: 'Request Tracking',
      description: 'Monitor the status of your requested documents in real-time, from submission to signature and collection pickup.',
      icon: <ClipboardCheck className="text-crimson w-7 h-7" />,
      actionText: 'Track Status',
    }
  ];

  const keyCapabilities = [
    'Secure Sacramental Document Processing',
    'Real-time Reference Number Tracking',
    'Canonical Calendar & Priest Appointments',
    'Vicariate Parish Map & Mass Timetables'
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      {/* Dark Crimson Photographic Hero Section */}
      <section
        className="relative py-20 sm:py-28 md:py-36 overflow-hidden border-b border-border text-white select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(107, 15, 26, 0.88), rgba(74, 10, 18, 0.94)), url(${mtKanlaonImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 space-y-6 relative z-10">
          <div
            className={`text-xs sm:text-sm font-semibold uppercase tracking-widest text-white/90 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
              heroEntered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            Roman Catholic Diocese of San Carlos
          </div>

          <h1
            className={`text-3xl sm:text-5xl md:text-6xl font-serif font-bold text-white tracking-tight leading-tight sm:leading-tight transition-[opacity,transform] duration-700 ease-out delay-100 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
              heroEntered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            Connect with Your Parish Community
          </h1>

          <p
            className={`text-sm sm:text-base md:text-lg text-white/85 max-w-2xl mx-auto leading-relaxed font-normal transition-[opacity,transform] duration-700 ease-out delay-200 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
              heroEntered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            Welcome to the TESTIMONIUM Parishioner Portal. Request sacramental documents, schedule parish appointments, and track your certificates online with complete transparency and ease.
          </p>

          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 transition-[opacity,transform] duration-700 ease-out delay-300 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
              heroEntered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <button
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto px-7 py-3.5 bg-white text-crimson hover:bg-white/90 font-bold rounded-button shadow-md transition-all active:scale-[0.98] text-sm sm:text-base focus-ring"
            >
              Create Parishioner Account
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-7 py-3.5 bg-transparent text-white border border-white/40 hover:bg-white/10 font-semibold rounded-button transition-all active:scale-[0.98] text-sm sm:text-base focus-ring"
            >
              Log In to Portal
            </button>
          </div>
        </div>
      </section>

      {/* Identity & Capabilities Banner */}
      <section ref={bannerRef} className="max-w-5xl mx-auto px-4 sm:px-6">
        <div
          className={`bg-white border border-border/80 rounded-card p-4 sm:p-6 shadow-sm flex flex-wrap items-center justify-around gap-4 text-center transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
            isBannerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          <div className="text-xs sm:text-sm font-semibold text-text-primary">
            <span className="text-crimson font-serif font-bold mr-1.5">Diocese of San Carlos</span>
          </div>
          <div className="hidden md:block w-px h-6 bg-border" />
          <div className="text-xs text-text-muted">Parish Services</div>
          <div className="w-1.5 h-1.5 rounded-full bg-border hidden sm:block" />
          <div className="text-xs text-text-muted">Document Requests</div>
          <div className="w-1.5 h-1.5 rounded-full bg-border hidden sm:block" />
          <div className="text-xs text-text-muted">Canonical Scheduling</div>
        </div>
      </section>

      {/* Services Grid Section */}
      <section ref={servicesRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div
          className={`text-center space-y-2.5 max-w-2xl mx-auto transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
            isServicesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          <span className="text-xs font-bold text-crimson uppercase tracking-widest">
            Sacramental Services
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-text-primary">
            Our Parishioner Services
          </h2>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
            Access streamlined digital services designed to simplify administrative workflows for the faithful of the diocese.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              className={`transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
                isServicesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              }`}
              style={{
                transitionDelay: isServicesVisible ? `${index * 90}ms` : '0ms'
              }}
            >
              <Card
                hoverable
                className="flex flex-col justify-between p-6 hover:border-crimson/50 hover:shadow-card transition-all group h-full"
              >
                <CardContent className="space-y-4 p-0">
                  <div className="p-3 bg-red-50/70 w-fit rounded-button text-crimson group-hover:scale-105 transition-transform">
                    {service.icon}
                  </div>
                  <h3 className="text-base sm:text-lg font-serif font-bold text-text-primary">
                    {service.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed font-normal">
                    {service.description}
                  </p>
                </CardContent>

                <div className="pt-5 mt-4 border-t border-border/40">
                  <button
                    onClick={() => navigate('/login')}
                    className="text-xs font-bold text-crimson flex items-center group-hover:translate-x-1 transition-transform focus-ring rounded"
                  >
                    <span>{service.actionText}</span>
                    <ArrowRight size={14} className="ml-1.5" />
                  </button>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* About TESTIMONIUM */}
      <section ref={aboutRef} className="bg-white border-y border-border py-16 sm:py-20 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div
            className={`lg:col-span-7 space-y-5 text-left transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
              isAboutVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
            }`}
          >
            <span className="text-xs font-bold text-crimson uppercase tracking-widest">
              About the Initiative
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-text-primary leading-tight">
              Modernizing Sacramental Records Management
            </h2>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed font-normal">
              TESTIMONIUM is an official diocesan framework designed to bridge the gap between parishioners and parish administrators. By standardizing registry tracking and scheduling, we strive to bring efficiency and reverence to parish services.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {keyCapabilities.map((cap, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-text-primary font-medium">
                  <CheckCircle2 size={16} className="text-crimson flex-shrink-0 mt-0.5" />
                  <span>{cap}</span>
                </div>
              ))}
            </div>

            <div className="pt-3">
              <Button onClick={() => navigate('/login')} className="group font-semibold text-xs sm:text-sm">
                <span>Access Parishioner Portal</span>
                <ArrowRight size={15} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>

          <div
            className={`lg:col-span-5 bg-app-page border border-border rounded-card p-6 sm:p-8 flex flex-col justify-center space-y-4 shadow-xs transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
              isAboutVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
            }`}
            style={{
              transitionDelay: isAboutVisible ? '120ms' : '0ms'
            }}
          >
            <div className="w-10 h-10 rounded-full bg-crimson/10 text-crimson flex items-center justify-center font-serif font-bold text-lg">
              ✝
            </div>
            <p className="font-serif italic text-text-primary text-base sm:text-lg leading-snug">
              "For where two or three gather in my name, there am I with them."
            </p>
            <p className="text-xs text-text-muted font-bold tracking-wider uppercase">
              Matthew 18:20
            </p>
          </div>
        </div>
      </section>

      {/* Android Mobile App Promotion Section */}
      <section ref={mobileAppRef} className="max-w-5xl mx-auto px-4 sm:px-6">
        <div
          className={`relative overflow-hidden rounded-card bg-gradient-to-br from-[#7B1C2A] via-[#6B0F1A] to-[#4A0A12] text-white p-8 sm:p-10 md:p-12 shadow-card border border-crimson-dark/60 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
            isMobileAppVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          {/* Subtle background ambient glow */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-red-400/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto text-center space-y-5">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight leading-snug">
              Get TESTIMONIUM for Android
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-white/85 leading-relaxed font-normal">
              Access diocesan sacramental registries, request baptismal and marriage certificates, schedule parish appointments, and track your records directly from your mobile device.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/download')}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 bg-white text-crimson hover:bg-white/95 font-bold rounded-button shadow-md transition-all active:scale-[0.98] text-sm sm:text-base focus-ring"
                aria-label="Download TESTIMONIUM for Android"
              >
                Download for Android
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Staff & Administrators Gateway (Clearly Secondary) */}
      <section ref={staffRef} className="max-w-5xl mx-auto px-4 sm:px-6">
        <div
          className={`border border-border/80 rounded-card bg-app-page p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xs transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
            isStaffVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white border border-border rounded-button shrink-0 text-text-muted mt-0.5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1 text-left">
              <h3 className="text-sm sm:text-base font-bold text-text-primary">
                Parish Staff &amp; Administrators
              </h3>
              <p className="text-xs text-text-muted leading-relaxed font-normal max-w-xl">
                Secretaries, Parish Coordinators, Diocese Coordinators, and Super Administrators access document processing, scheduling management, and parish analytics through the dedicated Admin Portal.
              </p>
            </div>
          </div>

          <a
            href={ADMIN_PORTAL_URL}
            target="_self"
            rel="noopener noreferrer"
            className="shrink-0 w-full sm:w-auto"
            aria-label="Open TESTIMONIUM Admin Portal"
          >
            <Button variant="outline" size="sm" className="w-full sm:w-auto whitespace-nowrap group text-xs font-semibold">
              <span>Admin Portal</span>
              <ArrowRight size={14} className="ml-1.5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
