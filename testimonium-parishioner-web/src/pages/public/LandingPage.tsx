import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Map, ClipboardCheck, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';

// Admin Portal URL — update to production URL when deploying.
// Intentionally external navigation (not React Router) because the Admin Portal
// is a completely independent application running on a separate port/domain.
const ADMIN_PORTAL_URL = import.meta.env.VITE_ADMIN_PORTAL_URL ?? 'http://localhost:5174';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const services = [
    {
      title: 'Sacramental Requests',
      description: 'Request official certificates for Baptism, Confirmation, Marriage, and other sacramental registries securely online.',
      icon: <FileText className="text-crimson w-8 h-8" />
    },
    {
      title: 'Event Scheduling',
      description: 'Schedule weddings, baptisms, canonical interviews, and parish events directly with your local church calendar.',
      icon: <Calendar className="text-crimson w-8 h-8" />
    },
    {
      title: 'Vicariate Directory',
      description: 'Locate nearby parishes, view office hours, check mass schedules, and contact the assigned parish secretary using our interactive vicariate map.',
      icon: <Map className="text-crimson w-8 h-8" />
    },
    {
      title: 'Request Tracking',
      description: 'Monitor the status of your requested documents in real-time, from submission to signature and collection pickup.',
      icon: <ClipboardCheck className="text-crimson w-8 h-8" />
    }
  ];

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section
        className="relative border-b border-border py-20 md:py-28 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.95)), url(${mtKanlaonImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Background graphic */}
        <div className="absolute inset-0 opacity-[0.01] pointer-events-none flex items-center justify-center">
          <div className="w-[800px] h-[800px] border-4 border-crimson rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 space-y-6 relative z-10">
          <p className="text-xs font-bold text-crimson uppercase tracking-widest">
            Roman Catholic Diocese of San Carlos
          </p>
          <h1 className="text-4xl md:text-6xl font-serif font-black text-text-primary tracking-tight leading-tight">
            Connect with Your Parish Community
          </h1>
          <p className="text-base md:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
            Welcome to the TESTIMONIUM Parishioner Portal. Request sacramental documents, schedule parish appointments, and track your certificates online with complete transparency and ease.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => navigate('/signup')}>
              Create Parishioner Account
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => navigate('/login')}>
              Log In to Portal
            </Button>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-serif font-bold text-text-primary">
            Our Parishioner Services
          </h2>
          <p className="text-sm text-text-muted max-w-xl mx-auto">
            Access secure services designed to simplify administrative workflows for the faithful of the diocese.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <Card key={index} hoverable className="flex flex-col justify-between">
              <CardContent className="space-y-4 pt-4">
                <div className="p-3 bg-red-50 w-fit rounded-button">
                  {service.icon}
                </div>
                <h3 className="text-lg font-serif font-semibold text-text-primary">
                  {service.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {service.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* About TESTIMONIUM */}
      <section className="bg-white border-y border-border py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-xs font-bold text-crimson uppercase tracking-widest">
              About the Initiative
            </span>
            <h2 className="text-3xl font-serif font-bold text-text-primary">
              Modernizing Ecclesial Records Management
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              TESTIMONIUM is an official diocesan framework designed to bridge the gap between parishioners and parish administrators. By standardizing registry tracking and scheduling, we strive to bring efficiency and reverence to parish services.
            </p>
            <div className="pt-2">
              <Button variant="ghost" onClick={() => navigate('/login')} className="group pl-0">
                Explore Portal Features <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
          <div className="bg-app-page border border-border rounded-card p-8 flex flex-col justify-center space-y-4 min-h-[250px]">
            <p className="font-serif italic text-text-primary text-lg">
              "For where two or three gather in my name, there am I with them."
            </p>
            <p className="text-xs text-text-muted font-semibold tracking-wide uppercase">
              Matthew 18:20
            </p>
          </div>
        </div>
      </section>

      {/* Staff & Administrators Gateway */}
      {/* Secondary CTA — separated from the parishioner hero to preserve distinct entry points */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border border-border rounded-card bg-app-page px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="p-3 bg-white border border-border rounded-button shrink-0">
            <ShieldCheck className="w-7 h-7 text-text-muted" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-base font-semibold text-text-primary">
              Parish Staff &amp; Administrators
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Secretaries, Parish Coordinators, Diocese Coordinators, and Super Administrators access document processing, scheduling management, and parish analytics through the dedicated Admin Portal.
            </p>
          </div>
          <a
            href={ADMIN_PORTAL_URL}
            target="_self"
            rel="noopener noreferrer"
            className="shrink-0"
            aria-label="Open TESTIMONIUM Admin Portal"
          >
            <Button variant="outline" size="sm" className="whitespace-nowrap group">
              Admin Portal <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
