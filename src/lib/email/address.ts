/**
 * Email address normalisation and suppression matching.
 *
 * Pure and dependency-free so it can be tested exhaustively. Correctness here
 * is a compliance requirement, not a nicety: a normalisation mismatch means an
 * unsubscribe is recorded for `Someone@Example.com` while the next send targets
 * `someone@example.com` and goes out anyway.
 */

/**
 * Lowercases and trims. Deliberately does **not** strip Gmail-style `+tags` or
 * dots: those are provider-specific aliasing rules, and treating
 * `a.b@example.com` as `ab@example.com` at a non-Gmail domain would silently
 * suppress a different person's address.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Returns the domain part, or null when the address is not usable. */
export function emailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

/**
 * A conservative deliverability check.
 *
 * Not RFC 5322 — full RFC validation accepts addresses no mail provider will
 * deliver to, and rejecting a valid-but-exotic address is cheaper than a bounce
 * against the sending domain's reputation.
 */
export function isDeliverableEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (normalized.length < 6 || normalized.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+$/.test(normalized)) return false;

  const domain = emailDomain(normalized);
  if (!domain) return false;
  // Needs a dot-separated TLD of at least two letters, no leading/trailing
  // hyphen or dot in any label.
  if (
    !/^(?!-)[a-z0-9-]+(?<!-)(\.(?!-)[a-z0-9-]+(?<!-))*\.[a-z]{2,}$/.test(domain)
  ) {
    return false;
  }
  const local = normalized.slice(0, normalized.lastIndexOf("@"));
  if (local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  return true;
}

/**
 * Addresses that reach a shared mailbox rather than a person. Still legitimate
 * B2B outreach targets — often the only published address for a small business —
 * but worth flagging so the admin panel can show what kind of contact it has.
 */
const ROLE_LOCAL_PARTS = new Set([
  "info",
  "contact",
  "hello",
  "enquiries",
  "enquiry",
  "inquiries",
  "sales",
  "office",
  "admin",
  "support",
  "help",
  "mail",
  "team",
  "reception",
  "bookings",
  "booking",
]);

export function isRoleAddress(email: string): boolean {
  const normalized = normalizeEmail(email);
  const local = normalized.slice(0, normalized.lastIndexOf("@"));
  return ROLE_LOCAL_PARTS.has(local);
}

/**
 * Addresses that must never receive outreach: automated senders, and
 * abuse/legal contacts where an unsolicited message is actively harmful.
 */
const NEVER_CONTACT_LOCAL_PARTS = new Set([
  "abuse",
  "postmaster",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "bounce",
  "bounces",
  "spam",
  "security",
  "dmarc",
  "dmarc-reports",
]);

export function isNeverContactAddress(email: string): boolean {
  const normalized = normalizeEmail(email);
  const local = normalized.slice(0, normalized.lastIndexOf("@"));
  if (NEVER_CONTACT_LOCAL_PARTS.has(local)) return true;
  // Catches variants like "noreply-orders" or "no-reply.support".
  return /^(no-?reply|do-?not-?reply|bounces?)[._-]/.test(local);
}

/**
 * Matches an address against a suppression list.
 *
 * An entry beginning with `@` suppresses a whole domain, which is how a
 * "remove our company" request from one person is honoured for every address
 * at that company.
 */
export function matchesSuppression(
  email: string,
  suppressed: Iterable<string>,
): boolean {
  const normalized = normalizeEmail(email);
  const domain = emailDomain(normalized);

  for (const raw of suppressed) {
    const entry = normalizeEmail(raw);
    if (!entry) continue;
    if (entry.startsWith("@")) {
      if (domain && domain === entry.slice(1)) return true;
      continue;
    }
    if (entry === normalized) return true;
  }

  return false;
}

/** Normalises a suppression entry, preserving the `@domain` form. */
export function normalizeSuppressionEntry(value: string): string | null {
  const trimmed = normalizeEmail(value);
  if (!trimmed) return null;
  if (trimmed.startsWith("@")) {
    const domain = trimmed.slice(1);
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? `@${domain}` : null;
  }
  return isDeliverableEmail(trimmed) ? trimmed : null;
}
