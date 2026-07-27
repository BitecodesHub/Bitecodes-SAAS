import "server-only";

import type { ContactInput } from "@/lib/contact";
import { getServerEnv } from "@/lib/server/env";
import { emailShell, escapeHtml } from "@/lib/email/template";
import { getTransporter } from "@/lib/server/email/transport";

/**
 * Contact-form notifications.
 *
 * Kept as a direct send rather than going through the queue: the visitor is
 * waiting on the response, and the acknowledgement email is the receipt for an
 * action they just took. The chrome and escaping now come from the shared
 * `email/template` module so these two messages look identical to every other
 * email the system sends.
 */

export async function sendContactEmails(
  enquiry: ContactInput,
  reference: string,
) {
  const env = getServerEnv();
  const mailer = getTransporter();
  const name = escapeHtml(enquiry.name);
  const email = escapeHtml(enquiry.email);
  const company = escapeHtml(enquiry.company || "Not provided");
  const budget = escapeHtml(enquiry.budget || "Not specified");
  const message = escapeHtml(enquiry.message).replaceAll("\n", "<br>");

  await Promise.all([
    mailer.sendMail({
      from: env.SMTP_FROM,
      to: env.CONTACT_NOTIFICATION_TO,
      replyTo: enquiry.email,
      subject: `New Bitecodes enquiry — ${enquiry.name}`,
      text: `Reference: ${reference}\nName: ${enquiry.name}\nEmail: ${enquiry.email}\nCompany: ${enquiry.company || "Not provided"}\nBudget: ${enquiry.budget || "Not specified"}\n\n${enquiry.message}`,
      html: emailShell(
        `<h1 style="font-size:24px;margin:0 0 16px">New project enquiry</h1><p style="margin:0 0 16px"><strong>Reference:</strong> ${escapeHtml(reference)}</p><p style="margin:0 0 16px"><strong>Name:</strong> ${name}<br><strong>Email:</strong> ${email}<br><strong>Company:</strong> ${company}<br><strong>Budget:</strong> ${budget}</p><p style="line-height:1.7;margin:0">${message}</p>`,
      ),
    }),
    mailer.sendMail({
      from: env.SMTP_FROM,
      to: enquiry.email,
      replyTo: env.CONTACT_NOTIFICATION_TO[0],
      subject: "We received your Bitecodes enquiry",
      text: `Hi ${enquiry.name},\n\nThank you for contacting Bitecodes. Your reference is ${reference}. We will review your message and respond within one business day.\n\nBitecodes`,
      html: emailShell(
        `<h1 style="font-size:24px;margin:0 0 16px">Thanks, ${name}.</h1><p style="line-height:1.7;margin:0 0 16px">We received your enquiry and will review it carefully. A member of our team will respond within one business day.</p><p style="margin:0"><strong>Your reference:</strong> ${escapeHtml(reference)}</p>`,
      ),
    }),
  ]);
}
