const topics = [
  ['Requesting a certificate', 'Open Request a Document, choose your parish and certificate, upload only the requested supporting files, then review before submitting. Track corrections, payment review, processing, and pickup from Request Tracking.'],
  ['Scheduling a parish service', 'Open Schedule a Service and follow Parish → Service → Date → Time Slot → Confirmation. Dates and times shown are the parish’s current configuration; unavailable days and full slots cannot be submitted.'],
  ['Reschedule proposals', 'When parish staff proposes another schedule, open the request from tracking or its notification. Review the proposed date and time, then accept or decline it.'],
  ['Payments and receipts', 'Use the payment instructions attached to your owned request. Upload a clear receipt and wait for parish verification. If correction is requested, replace it with the requested evidence.'],
  ['Events and privacy', 'The events feed shows public parish events. Parish-private events are visible only to authorized parish staff.'],
  ['Notifications and email', 'In-app notifications remain the primary activity history. Important document-ready and scheduling transitions may also be sent to your registered email address.'],
];

export default function HelpPage() {
  return <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-xs font-bold uppercase tracking-widest text-crimson">Help Center</p><h1 className="mt-2 font-serif text-3xl font-bold text-text-primary">Using TESTIMONIUM</h1><p className="mt-2 text-sm text-text-muted">Straightforward guidance for parish records, payments, scheduling, and events.</p></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{topics.map(([title, description]) => <section key={title} className="rounded-xl border border-border bg-white p-5 shadow-sm"><h2 className="font-serif text-lg font-bold text-text-primary">{title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{description}</p></section>)}</div><section className="rounded-xl bg-crimson p-5 text-white"><h2 className="font-bold">Need parish-specific assistance?</h2><p className="mt-1 text-sm text-white/85">Contact the parish shown on your request. Do not send passwords, verification codes, or payment credentials through support messages.</p></section></div>;
}
