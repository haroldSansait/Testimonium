/**
 * Authoritative Canonical Legal Policies Plain Text
 * Bootstrapped from Parishioner Web v1.0 (effective 2026-08-01)
 */

export const CANONICAL_TERMS_TEXT = `Important Notice:
By accessing, registering, or using the TESTIMONIUM Sacramental Record Portal, you enter into a legally binding agreement with the Roman Catholic Diocese of San Carlos. Please review these terms thoroughly.

1. Account & Parishioner Responsibilities
Users registering on the TESTIMONIUM portal are responsible for providing truthful, complete, and up-to-date accurate information during profile registration and certificate requests.
• You must safeguard your login credentials and authentication tokens.
• You are strictly liable for any request or activity submitted under your authenticated user account.
• Sharing accounts with unauthorized third parties is prohibited.

2. Sacramental Record Verification & Governance
All sacramental records (Baptismal, Confirmation, Marriage, Death certificates) rendered on TESTIMONIUM remain the canonical property of the Roman Catholic Diocese of San Carlos.
Official verification remains subject to physical canonical ledger validation by authorized Parish Secretaries and Priests. Submission of false information or altered receipts for payment processing constitutes fraud under Philippine Law.

3. Acceptable Use & Prohibited Conduct
When interacting with the platform, you agree NOT to:
• Attempt automated bot requests or rate-limit circumvention.
• Upload fraudulent payment receipts or malformed files to Cloudflare R2 storage.
• Impersonate parish personnel, clergy, or another parishioner.
• Reverse engineer or attempt unauthorized access to Diocese administration endpoints.

4. Data Retention & Privacy Compliance
Personal information, sacramental details, and uploaded verification receipts are stored securely in compliance with the Republic Act No. 10173 (Philippine Data Privacy Act of 2012).

5. Account Suspension & Termination
The Diocese reserves the right to suspend or deactivate any account found violating security standards, attempting rate-limit abuse, or submitting fraudulent requests.

Have questions regarding these terms?
Contact the Vicariate Chancery Office at support@testimonium.org`;

export const CANONICAL_PRIVACY_TEXT = `1. Information We Collect
To process certificate requests, parish appointments, and verification, TESTIMONIUM collects:
• Profile Information: Full name, email address, contact telephone number, and home address.
• Sacramental Records: Date of birth, baptismal details, confirmation records, parents' names, and marriage registry data.
• Transaction Data: Uploaded payment receipts and GCash/Maya reference numbers.

2. Third-Party Infrastructure Services
Your data is processed using production-grade infrastructure with strict security protocols:
• Firebase Authentication: Manages secure user identities, Google Sign-In tokens, and email verification state.
• Cloudflare R2 Object Storage: Stores encrypted uploaded attachments and payment receipts under restricted access policies.
• Automated OCR Engine: Processes uploaded payment proofs for reference and amount validation without retaining raw image caches.

3. Data Retention & Usage
The Diocese uses collected information strictly for validating canonical sacramental requests and maintaining immutable audit logs. Personal data is never sold, rented, or commercialized.

4. Cookies & Session Management
We use secure session tokens and local storage strictly necessary for authentication and session protection. No third-party tracking cookies are used.

5. Your Rights Under Philippine Privacy Law
Under Republic Act No. 10173, you have the right to request access to your personal records, request corrections to erroneous entries, and request information regarding data processing protocols.

Diocese Data Protection Officer
Direct inquiries to privacy@testimonium.org`;
