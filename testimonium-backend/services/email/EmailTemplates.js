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
  text: `${heading}\n\n${paragraphs.map((line) => line.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "")).join("\n\n")}\n\n— TESTIMONIUM`,
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
    const correction = payload.correctionContext;
    const correctionLines = [];
    if (correction?.reason) {
      correctionLines.push(`Reason: <strong>${escapeHtml(correction.reason)}</strong>`);
    }
    if (correction?.affectedRequirements) {
      correctionLines.push(`Affected requirement(s): <strong>${escapeHtml(correction.affectedRequirements)}</strong>`);
    }
    if (correction?.note) {
      correctionLines.push(`Additional note: ${escapeHtml(correction.note).replace(/\r?\n/g, "<br>")}`);
    }

    return {
      subject: "TESTIMONIUM — Action Required on Your Document Request",
      ...layout("Action required on your document request", [
        `Hello ${name},`,
        "Your document request requires corrections before processing can continue.",
        `Tracking Number: <strong>${tracking}</strong><br>Document: ${service}<br>Parish: ${parish}`,
        ...(correctionLines.length > 0 ? [correctionLines.join("<br>")] : []),
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
    const isCorrected = Boolean(payload.isCorrectedReturn);
    return {
      subject: isCorrected
        ? "TESTIMONIUM — Your Corrected Document Is Ready for Pickup"
        : "TESTIMONIUM — Your Document Is Ready for Pickup",
      ...layout(
        isCorrected
          ? "Your corrected document is ready for pickup"
          : "Your document is ready for pickup",
        [
          `Hello ${name},`,
          isCorrected
            ? `Your corrected document is ready for pickup at ${parish}. Please bring your defective document to exchange upon pickup.`
            : `Your requested document is ready for pickup at ${parish}.`,
          `Tracking Number: <strong>${tracking}</strong><br>Document: ${service}`,
          "Please follow the parish's pickup instructions.",
        ]
      ),
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
  if (emailType === "EMAIL_VERIFICATION_OTP") {
    const code = escapeHtml(payload.code || "");
    const rendered = renderOtpLayout({
      heading: "Verify Your Email Address",
      code,
      recipientName: payload.recipientName,
      isPasswordReset: false,
    });
    return {
      subject: `${code} is your TESTIMONIUM verification code`,
      ...rendered,
    };
  }
  if (emailType === "PASSWORD_RESET_OTP") {
    const code = escapeHtml(payload.code || "");
    const rendered = renderOtpLayout({
      heading: "Reset Your Password",
      code,
      recipientName: payload.recipientName,
      isPasswordReset: true,
    });
    return {
      subject: `${code} is your TESTIMONIUM password reset code`,
      ...rendered,
    };
  }
  throw new Error(`Unsupported email type: ${emailType}`);
}

export function renderOtpLayout({ heading, code, recipientName, isPasswordReset = false }) {
  const safeName = escapeHtml(recipientName || "Parishioner");
  const safeCode = escapeHtml(code);
  const title = isPasswordReset ? "Reset Your Password" : "Verify Your Email Address";
  const subtext = isPasswordReset
    ? "We received a request to reset the password for your TESTIMONIUM account. Please use the following six-digit code to complete the verification:"
    : "Thank you for registering with TESTIMONIUM. Please use the following six-digit code to verify your email address and continue:";

  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${escapeHtml(title)}</title>
  <style>
    html, body {
      margin: 0 auto !important;
      padding: 0 !important;
      height: 100% !important;
      width: 100% !important;
    }
    * {
      -ms-text-size-adjust: 100%;
      -webkit-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt !important;
      mso-table-rspace: 0pt !important;
    }
    img {
      -ms-interpolation-mode: bicubic;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .fluid-cell {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .otp-code {
        font-size: 30px !important;
        letter-spacing: 6px !important;
      }
    }
  </style>
</head>
<body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #F8F6F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; -webkit-font-smoothing: antialiased;">
  <center style="width: 100%; background-color: #F8F6F2;">
    <!-- Hidden preheader text -->
    <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
      ${safeCode} is your TESTIMONIUM verification code. This code expires in 10 minutes.
    </div>

    <!-- Outer Table for background and centering -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 auto; background-color: #F8F6F2; border-collapse: collapse;">
      <tr>
        <td align="center" valign="top" style="padding: 32px 16px; background-color: #F8F6F2;">
          <!-- Main Centered Card (540px width desktop, fluid on mobile) -->
          <table role="presentation" class="email-container" width="540" border="0" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 540px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E8E2D9; box-shadow: 0 4px 16px rgba(123, 28, 42, 0.04); overflow: hidden; border-collapse: separate;">

            <!-- Burgundy Top Accent Bar -->
            <tr>
              <td style="background-color: #7B1C2A; height: 6px; font-size: 0; line-height: 0;">&nbsp;</td>
            </tr>

            <!-- Header / Branding -->
            <tr>
              <td align="center" class="fluid-cell" style="padding: 32px 32px 16px 32px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    <td align="center">
                      <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; letter-spacing: 2.5px; color: #7B1C2A; text-transform: uppercase; line-height: 1.2;">
                        TESTIMONIUM
                      </div>
                      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; color: #8C7B75; text-transform: uppercase; margin-top: 4px;">
                        Diocese of San Carlos
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td class="fluid-cell" style="padding: 16px 36px 32px 36px; text-align: left;">
                <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #1E293B; margin: 0 0 16px 0; text-align: center; line-height: 1.3;">
                  ${escapeHtml(heading)}
                </h1>

                <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                  Hello ${safeName},
                </p>

                <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
                  ${subtext}
                </p>

                <!-- Prominent OTP Code Card -->
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0; border-collapse: collapse;">
                  <tr>
                    <td align="center" style="background-color: #FDF9F7; border: 1.5px dashed #D4A5AC; border-radius: 10px; padding: 22px 16px;">
                      <div style="font-size: 11px; font-weight: 700; color: #7B1C2A; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">
                        Verification Code
                      </div>
                      <div class="otp-code" style="font-family: 'SF Pro Mono', Menlo, Consolas, Monaco, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1E293B; line-height: 1.1; user-select: all; -webkit-user-select: all;">
                        ${safeCode}
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Instructions & Expiration -->
                <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 16px 0 8px 0; text-align: center;">
                  <strong>This code expires in 10 minutes</strong> and can only be used once.
                </p>

                <p style="font-size: 13px; line-height: 1.5; color: #64748B; margin: 0 0 20px 0; text-align: center;">
                  Never share this code with anyone. TESTIMONIUM staff will never ask for your code.
                </p>

                <div style="border-top: 1px solid #F1ECE6; padding-top: 20px; margin-top: 24px; text-align: center;">
                  <p style="font-size: 12px; line-height: 1.5; color: #94A3B8; margin: 0;">
                    If you did not request this, you may safely ignore this email.
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td class="fluid-cell" style="background-color: #FBF9F6; border-top: 1px solid #EAE5DE; padding: 24px 32px; text-align: center;">
                <p style="font-size: 11px; font-weight: 600; color: #64748B; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                  TESTIMONIUM &bull; Sacramental Registry &amp; Canonical Services
                </p>
                <p style="font-size: 11px; color: #94A3B8; margin: 0 0 8px 0;">
                  Roman Catholic Diocese of San Carlos, Philippines
                </p>
                <p style="font-size: 10px; color: #94A3B8; margin: 0;">
                  For assistance, contact your local Parish Secretary or Diocese Coordinator.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  const text = `${heading}

Hello ${recipientName || "Parishioner"},

${subtext}

Verification Code: ${code}

This code expires in 10 minutes and can only be used once.
Never share this code with anyone. TESTIMONIUM staff will never ask for your code.

If you did not request this, you may safely ignore this email.

—
TESTIMONIUM • Sacramental Registry & Canonical Services
Roman Catholic Diocese of San Carlos, Philippines
For assistance, contact your local Parish Secretary or Diocese Coordinator.`;

  return { html, text };
}
