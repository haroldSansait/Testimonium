import React from 'react';
import { Database, Server, Eye, Cookie, Lock, Mail } from 'lucide-react';

export const PrivacyContent: React.FC = () => {
  return (
    <div className="space-y-6 text-gray-900 text-sm leading-relaxed">
      {/* Section 1 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <Database size={18} className="text-crimson" />
          <span>1. Information We Collect</span>
        </h2>
        <p className="text-gray-800">
          To process certificate requests, parish appointments, and verification, TESTIMONIUM collects:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs sm:text-sm pl-2">
          <li><strong>Profile Information:</strong> Full name, email address, contact telephone number, and home address.</li>
          <li><strong>Sacramental Records:</strong> Date of birth, baptismal details, confirmation records, parents' names, and marriage registry data.</li>
          <li><strong>Transaction Data:</strong> Uploaded payment receipts and GCash/Maya reference numbers.</li>
        </ul>
      </section>

      {/* Section 2 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <Server size={18} className="text-crimson" />
          <span>2. Third-Party Infrastructure Services</span>
        </h2>
        <p className="text-gray-800">
          Your data is processed using production-grade infrastructure with strict security protocols:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs sm:text-sm pl-2">
          <li><strong>Firebase Authentication:</strong> Manages secure user identities, Google Sign-In tokens, and email verification state.</li>
          <li><strong>Cloudflare R2 Object Storage:</strong> Stores encrypted uploaded attachments and payment receipts under restricted access policies.</li>
          <li><strong>Automated OCR Engine:</strong> Processes uploaded payment proofs for reference and amount validation without retaining raw image caches.</li>
        </ul>
      </section>

      {/* Section 3 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <Eye size={18} className="text-crimson" />
          <span>3. Data Retention & Usage</span>
        </h2>
        <p className="text-gray-800">
          The Diocese uses collected information strictly for validating canonical sacramental requests and maintaining immutable audit logs. Personal data is never sold, rented, or commercialized.
        </p>
      </section>

      {/* Section 4 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <Cookie size={18} className="text-crimson" />
          <span>4. Cookies & Session Management</span>
        </h2>
        <p className="text-gray-800">
          We use secure session tokens and local storage strictly necessary for authentication and session protection. No third-party tracking cookies are used.
        </p>
      </section>

      {/* Section 5 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <Lock size={18} className="text-crimson" />
          <span>5. Your Rights Under Philippine Privacy Law</span>
        </h2>
        <p className="text-gray-800">
          Under Republic Act No. 10173, you have the right to request access to your personal records, request corrections to erroneous entries, and request information regarding data processing protocols.
        </p>
      </section>

      {/* Contact Section */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-3.5 shadow-sm">
        <div className="p-2 bg-crimson/10 rounded-lg text-crimson">
          <Mail size={20} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Diocese Data Protection Officer</h4>
          <p className="text-xs text-gray-600">Direct inquiries to privacy@testimonium.org</p>
        </div>
      </div>
    </div>
  );
};
