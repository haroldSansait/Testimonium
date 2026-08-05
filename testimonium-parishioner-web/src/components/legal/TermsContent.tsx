import React from 'react';
import { ShieldCheck, AlertTriangle, FileText, Scale, Mail } from 'lucide-react';

export const TermsContent: React.FC = () => {
  return (
    <div className="space-y-6 text-gray-900 text-sm leading-relaxed">
      {/* Notice Alert */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start space-x-3 text-xs sm:text-sm text-amber-950 shadow-sm">
        <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-amber-700" />
        <div>
          <span className="font-bold text-amber-950">Important Notice: </span>
          By accessing, registering, or using the TESTIMONIUM Sacramental Record Portal, you enter into a legally binding agreement with the Roman Catholic Diocese of San Carlos. Please review these terms thoroughly.
        </div>
      </div>

      {/* Section 1 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <FileText size={18} className="text-crimson" />
          <span>1. Account & Parishioner Responsibilities</span>
        </h2>
        <p className="text-gray-800">
          Users registering on the TESTIMONIUM portal are responsible for providing truthful, complete, and up-to-date accurate information during profile registration and certificate requests.
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs sm:text-sm pl-2">
          <li>You must safeguard your login credentials and authentication tokens.</li>
          <li>You are strictly liable for any request or activity submitted under your authenticated user account.</li>
          <li>Sharing accounts with unauthorized third parties is prohibited.</li>
        </ul>
      </section>

      {/* Section 2 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <ShieldCheck size={18} className="text-crimson" />
          <span>2. Sacramental Record Verification & Governance</span>
        </h2>
        <p className="text-gray-800">
          All sacramental records (Baptismal, Confirmation, Marriage, Death certificates) rendered on TESTIMONIUM remain the canonical property of the Roman Catholic Diocese of San Carlos.
        </p>
        <p className="text-xs sm:text-sm text-gray-600">
          Official verification remains subject to physical canonical ledger validation by authorized Parish Secretaries and Priests. Submission of false information or altered receipts for payment processing constitutes fraud under Philippine Law.
        </p>
      </section>

      {/* Section 3 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <Scale size={18} className="text-crimson" />
          <span>3. Acceptable Use & Prohibited Conduct</span>
        </h2>
        <p className="text-gray-800">When interacting with the platform, you agree NOT to:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs sm:text-sm pl-2">
          <li>Attempt automated bot requests or rate-limit circumvention.</li>
          <li>Upload fraudulent payment receipts or malformed files to Cloudflare R2 storage.</li>
          <li>Impersonate parish personnel, clergy, or another parishioner.</li>
          <li>Reverse engineer or attempt unauthorized access to Diocese administration endpoints.</li>
        </ul>
      </section>

      {/* Section 4 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <FileText size={18} className="text-crimson" />
          <span>4. Data Retention & Privacy Compliance</span>
        </h2>
        <p className="text-gray-800">
          Personal information, sacramental details, and uploaded verification receipts are stored securely in compliance with the Republic Act No. 10173 (Philippine Data Privacy Act of 2012).
        </p>
      </section>

      {/* Section 5 */}
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1.5 flex items-center space-x-2">
          <AlertTriangle size={18} className="text-crimson" />
          <span>5. Account Suspension & Termination</span>
        </h2>
        <p className="text-gray-800">
          The Diocese reserves the right to suspend or deactivate any account found violating security standards, attempting rate-limit abuse, or submitting fraudulent requests.
        </p>
      </section>

      {/* Contact Section */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-3.5 shadow-sm">
        <div className="p-2 bg-crimson/10 rounded-lg text-crimson">
          <Mail size={20} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Have questions regarding these terms?</h4>
          <p className="text-xs text-gray-600">Contact the Vicariate Chancery Office at support@testimonium.org</p>
        </div>
      </div>
    </div>
  );
};
