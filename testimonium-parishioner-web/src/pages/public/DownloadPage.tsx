import React, { useEffect } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  HardDrive,
  Cpu,
  Layers,
  ArrowDownCircle,
  HelpCircle
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import DownloadQRCode from '../../components/common/DownloadQRCode';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';

const APK_DOWNLOAD_URL = '/download/android';
const APK_FILENAME = 'TESTIMONIUM-v1.0.0-build5.apk';
const APP_VERSION = '1.0.0';
const APP_BUILD = '5';
const APP_PACKAGE_ID = 'com.testimonium.app';
const APP_MIN_ANDROID = 'Android 8.0 (API level 26) or newer';
const APP_FILE_SIZE = '281.33 MB';

export const DownloadPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
  const installSteps = [
    {
      step: '1',
      title: 'Download the APK',
      description: `Tap the "Download for Android" button above or scan the QR code. Your browser will download ${APK_FILENAME}.`
    },
    {
      step: '2',
      title: 'Open the Downloaded File',
      description: 'When the download completes, tap the download notification in your status bar or navigate to your device\'s "Downloads" folder and select the APK.'
    },
    {
      step: '3',
      title: 'Allow Installation When Prompted',
      description: 'If Android prompts: "For your security, your phone is not allowed to install unknown apps from this source", tap Settings and switch on "Allow from this source", then return to the installer.'
    },
    {
      step: '4',
      title: 'Complete Setup & Launch',
      description: 'Tap "Install" to finalize setup. Once completed, tap "Open" to launch TESTIMONIUM and sign in or create your parishioner account.'
    }
  ];

  const appHighlights = [
    'Sacramental document requests (Baptism, Confirmation, Marriage)',
    'Real-time reference tracking from submission to pickup',
    'Vicariate canonical event scheduling and calendar bookings',
    'Interactive parish directory with mass times and contacts'
  ];

  return (
    <div className="space-y-12 sm:space-y-16 pb-20">
      {/* Hero Header with Mt. Kanlaon Crimson Backdrop */}
      <section
        className="relative py-14 sm:py-20 md:py-24 overflow-hidden border-b border-border text-white select-none shadow-sm"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(107, 15, 26, 0.90), rgba(74, 10, 18, 0.95)), url(${mtKanlaonImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="space-y-3 max-w-3xl">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-white/90">
                Roman Catholic Diocese of San Carlos
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-white tracking-tight leading-tight">
                Download TESTIMONIUM for Android
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed font-normal">
                Official TESTIMONIUM Android application for accessing parish services, requesting sacramental documents, scheduling appointments, and tracking requests.
              </p>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2 flex flex-col items-center gap-3 w-full sm:w-auto">
              <a
                href={APK_DOWNLOAD_URL}
                download={APK_FILENAME}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-crimson hover:bg-white/95 font-bold rounded-button shadow-lg hover:shadow-xl transition-all active:scale-[0.98] text-base sm:text-lg focus-ring group"
                id="android-download-cta"
                aria-label={`Download TESTIMONIUM Android APK Version ${APP_VERSION} Build ${APP_BUILD}`}
              >
                <Download size={22} className="text-crimson group-hover:-translate-y-0.5 transition-transform" />
                <span>Download for Android</span>
              </a>

              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/80 font-medium">
                <span>Version {APP_VERSION} (Build {APP_BUILD})</span>
                <span>•</span>
                <span>~{APP_FILE_SIZE}</span>
                <span>•</span>
                <span>Android 8.0+</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Download Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Release Details & Step-by-Step Installation Guide (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* Release Specifications Card */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-3 border-b border-border/70 pb-4">
                  <div className="p-2.5 bg-red-50 text-crimson rounded-button">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-serif font-bold text-text-primary">
                      Release Information
                    </h2>
                    <p className="text-xs text-text-muted">
                      Direct distribution build confirmed for parishioner devices
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                  <div className="p-3 bg-app-page/70 rounded-button border border-border/60 space-y-1">
                    <span className="text-text-muted text-xs flex items-center gap-1.5">
                      <Layers size={13} className="text-crimson" />
                      App Version &amp; Build
                    </span>
                    <p className="font-semibold text-text-primary">
                      v{APP_VERSION} (Build {APP_BUILD})
                    </p>
                  </div>

                  <div className="p-3 bg-app-page/70 rounded-button border border-border/60 space-y-1">
                    <span className="text-text-muted text-xs flex items-center gap-1.5">
                      <Cpu size={13} className="text-crimson" />
                      Compatibility
                    </span>
                    <p className="font-semibold text-text-primary">
                      {APP_MIN_ANDROID}
                    </p>
                  </div>

                  <div className="p-3 bg-app-page/70 rounded-button border border-border/60 space-y-1">
                    <span className="text-text-muted text-xs flex items-center gap-1.5">
                      <HardDrive size={13} className="text-crimson" />
                      Download Size
                    </span>
                    <p className="font-semibold text-text-primary">
                      ~{APP_FILE_SIZE}
                    </p>
                  </div>

                  <div className="p-3 bg-app-page/70 rounded-button border border-border/60 space-y-1">
                    <span className="text-text-muted text-xs flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-crimson" />
                      Package Identifier
                    </span>
                    <p className="font-mono text-xs font-semibold text-text-primary break-all">
                      {APP_PACKAGE_ID}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-text-muted pt-1">
                  Distributed directly through the official TESTIMONIUM website via secured Cloudflare R2 delivery.
                </p>
              </CardContent>
            </Card>

            {/* Android Installation Guide */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-6 sm:p-7 space-y-6">
                <div className="flex items-center gap-3 border-b border-border/70 pb-4">
                  <div className="p-2.5 bg-red-50 text-crimson rounded-button">
                    <ArrowDownCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-serif font-bold text-text-primary">
                      How to Install on Android
                    </h2>
                    <p className="text-xs text-text-muted">
                      Follow these steps to complete installation on your phone
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {installSteps.map((item) => (
                    <div key={item.step} className="flex items-start gap-3.5">
                      <div className="w-7 h-7 rounded-full bg-crimson text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        {item.step}
                      </div>
                      <div className="space-y-1 text-left">
                        <h3 className="text-sm font-bold text-text-primary">
                          {item.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-text-muted leading-relaxed font-normal">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Direct Distribution Guidance Note */}
                <div className="bg-app-page border border-border/80 rounded-button p-4 text-xs space-y-1.5 text-text-muted">
                  <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                    <HelpCircle size={15} className="text-crimson shrink-0" />
                    <span>Direct Distribution Guidance</span>
                  </div>
                  <p className="leading-relaxed">
                    Android standard security displays a prompt whenever installing an app outside an app store. When your device asks for confirmation, simply allow installation from your browser or file manager to proceed.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: QR Code Card & App Features (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Scannable QR Code Card */}
            <Card className="border-border/80 shadow-xs text-center">
              <CardContent className="p-6 flex flex-col items-center justify-center space-y-4">
                <DownloadQRCode size={192} showUrlLabel={false} />

                <div className="w-full pt-1 border-t border-border/70">
                  <a
                    href={APK_DOWNLOAD_URL}
                    download={APK_FILENAME}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-crimson hover:bg-crimson-dark text-white font-semibold rounded-button text-xs sm:text-sm shadow-sm transition-colors focus-ring"
                  >
                    <Download size={15} />
                    <span>Download APK Directly ({APP_FILE_SIZE})</span>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Application Capabilities */}
            <Card className="border-border/80 shadow-xs">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-sm font-serif font-bold text-text-primary">
                  Features Available in TESTIMONIUM Android
                </h3>
                <div className="space-y-2.5">
                  {appHighlights.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-text-primary">
                      <CheckCircle2 size={16} className="text-crimson shrink-0 mt-0.5" />
                      <span className="leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DownloadPage;
