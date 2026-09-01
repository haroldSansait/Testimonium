const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const formatDate = (value) => {
  if (!value) return "Not specified";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
};

const layout = (heading, paragraphs) => ({
  html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222;line-height:1.55"><main style="max-width:600px;margin:auto;padding:24px"><h1 style="color:#7B1C2A;font-size:22px">${escapeHtml(heading)}</h1>${paragraphs.map((line) => `<p>${line}</p>`).join("")}<p>— TESTIMONIUM</p></main></body></html>`,
  text: `${heading}\n\n${paragraphs.map((line) => line.replace(/<[^>]+>/g, "")).join("\n\n")}\n\n— TESTIMONIUM`,
});

export function renderEmail(emailType, payload) {
  const name = escapeHtml(payload.recipientName || "Parishioner");
  const parish = escapeHtml(payload.parishName || "the parish");
  const service = escapeHtml(payload.serviceLabel || payload.documentType || "your request");
  const tracking = escapeHtml(payload.trackingNumber || "Not available");
  const time = escapeHtml(payload.timeSlot || "Not specified");
  const location = escapeHtml(payload.location || "Please check TESTIMONIUM for details");

  if (emailType === "DOCUMENT_SUBMITTED") {
    return {
      subject: "TESTIMONIUM — Document Request Submitted",
      ...layout("Document request submitted", [
        `Hello ${name},`,
        "Your document request has been submitted successfully and is now awaiting parish review.",
        `Tracking Number: <strong>${tracking}</strong><br>Document: ${service}<br>Parish: ${parish}`,
        "You can sign in to TESTIMONIUM to track its progress.",
      ]),
    };
  }
  if (emailType === "DOCUMENT_NEEDS_CORRECTION") {
    return {
      subject: "TESTIMONIUM — Action Required on Your Document Request",
      ...layout("Action required on your document request", [
        `Hello ${name},`,
        "Your document request requires corrections before processing can continue.",
        `Tracking Number: <strong>${tracking}</strong><br>Document: ${service}<br>Parish: ${parish}`,
        "Sign in to TESTIMONIUM to review the required corrections and submit the updated requirements.",
      ]),
    };
  }
  if (emailType === "DOCUMENT_PAYMENT_NEEDS_CORRECTION") {
    return {
      subject: "TESTIMONIUM — Payment Proof Needs Attention",
      ...layout("Payment proof needs attention", [
        `Hello ${name},`,
        "The payment proof for your document request requires correction.",
        `Tracking Number: <strong>${tracking}</strong><br>Document: ${service}<br>Parish: ${parish}`,
        "Sign in to TESTIMONIUM to review the instructions and upload a corrected payment proof.",
      ]),
    };
  }
  if (emailType === "DOCUMENT_READY_FOR_PICKUP") {
    return {
      subject: "TESTIMONIUM — Your Document Is Ready for Pickup",
      ...layout("Your document is ready for pickup", [
        `Hello ${name},`,
        `Your requested document is ready for pickup at ${parish}.`,
        `Tracking Number: <strong>${tracking}</strong><br>Document: ${service}`,
        "Please follow the parish's pickup instructions.",
      ]),
    };
  }
  if (emailType === "SCHEDULE_SUBMITTED") {
    return {
      subject: "TESTIMONIUM — Schedule Request Submitted",
      ...layout("Schedule request submitted", [
        `Hello ${name},`,
        `Your ${service} scheduling request at ${parish} was submitted and is awaiting parish review.`,
        `Requested Date: ${escapeHtml(formatDate(payload.requestedDate))}<br>Time: ${time}`,
      ]),
    };
  }
  if (emailType === "SCHEDULE_PROPOSED_RESCHEDULE") {
    return {
      subject: "TESTIMONIUM — New Schedule Proposed",
      ...layout("A new schedule was proposed", [
        `Hello ${name},`,
        `${parish} proposed a new schedule for your ${service} request.`,
        `Proposed Date: ${escapeHtml(formatDate(payload.proposedDate))}<br>Time: ${time}`,
        "Sign in to TESTIMONIUM to review and accept or decline the proposal.",
      ]),
    };
  }
  if (emailType === "SCHEDULE_CONFIRMED") {
    return {
      subject: "TESTIMONIUM — Schedule Confirmed",
      ...layout("Your schedule is confirmed", [
        `Hello ${name},`,
        `Your ${service} schedule at ${parish} is confirmed.`,
        `Date: ${escapeHtml(formatDate(payload.requestedDate))}<br>Time: ${time}<br>Location: ${location}`,
      ]),
    };
  }
  throw new Error(`Unsupported email type: ${emailType}`);
}
