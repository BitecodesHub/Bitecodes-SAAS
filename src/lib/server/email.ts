import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import type { ContactInput } from "@/lib/contact";
import { getServerEnv } from "@/lib/server/env";

let transporter: Transporter | undefined;

function getTransporter() {
  if (transporter) return transporter;

  const env = getServerEnv();
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  return transporter;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character]!,
  );
}

function emailShell(content: string) {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f6f5f2;color:#201f26;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:40px 20px"><div style="background:#fff;border:1px solid #e6e3eb;border-radius:20px;padding:32px"><p style="margin:0 0 24px;color:#5640b8;font-weight:700">BITECODES</p>${content}</div><p style="color:#6e6a77;font-size:12px;line-height:1.6;text-align:center">Software, engineered with intent.</p></div></body></html>`;
}

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
        `<h1 style="font-size:24px">New project enquiry</h1><p><strong>Reference:</strong> ${escapeHtml(reference)}</p><p><strong>Name:</strong> ${name}<br><strong>Email:</strong> ${email}<br><strong>Company:</strong> ${company}<br><strong>Budget:</strong> ${budget}</p><p style="line-height:1.7">${message}</p>`,
      ),
    }),
    mailer.sendMail({
      from: env.SMTP_FROM,
      to: enquiry.email,
      replyTo: env.CONTACT_NOTIFICATION_TO[0],
      subject: "We received your Bitecodes enquiry",
      text: `Hi ${enquiry.name},\n\nThank you for contacting Bitecodes. Your reference is ${reference}. We will review your message and respond within one business day.\n\nBitecodes`,
      html: emailShell(
        `<h1 style="font-size:24px">Thanks, ${name}.</h1><p style="line-height:1.7">We received your enquiry and will review it carefully. A member of our team will respond within one business day.</p><p><strong>Your reference:</strong> ${escapeHtml(reference)}</p>`,
      ),
    }),
  ]);
}
