import "server-only";

import { isIP } from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function parseIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return parts;
}

export function isPublicIp(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const parts = parseIpv4(address);
    if (!parts) return false;
    const [a, b, c] = parts;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase().split("%")[0];
    return !(
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:") ||
      normalized.startsWith("::ffff:")
    );
  }

  return false;
}

export function normalizeAuditUrl(input: string) {
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(input)
    ? input
    : `https://${input}`;
  const url = new URL(candidate);
  url.hash = "";

  if (!(["http:", "https:"] as string[]).includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS websites can be audited.");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed.");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("Only standard website ports are allowed.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname ||
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa")
  ) {
    throw new Error("This hostname cannot be audited.");
  }

  url.hostname = hostname;
  return url;
}

/**
 * Why a hostname could not be resolved.
 *
 * The distinction is not pedantry. `NXDOMAIN` means the domain does not exist —
 * real evidence a business's website is gone. A resolver timeout or SERVFAIL
 * means *our* DNS is unhappy and says nothing about the domain. Collapsing the
 * two lets a flaky resolver mass-label healthy prospects as "website down" and
 * send them all an email saying so.
 */
export class DnsResolutionError extends Error {
  constructor(
    message: string,
    /** True only when the authoritative answer was "no such domain". */
    readonly domainMissing: boolean,
  ) {
    super(message);
    this.name = "DnsResolutionError";
  }
}

/** DNS error codes that genuinely mean "this domain does not exist". */
const NXDOMAIN_CODES = new Set(["ENOTFOUND", "NOTFOUND", "ENODATA"]);

function dnsErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

export async function assertPublicAuditUrl(url: URL) {
  const hostname = url.hostname;
  if (isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new Error("Private networks are blocked.");
    return [hostname];
  }

  // Errors are captured rather than swallowed, so a failure to resolve can be
  // attributed to the domain or to our resolver.
  const [ipv4Result, ipv6Result] = await Promise.all([
    resolve4(hostname).then(
      (addresses) => ({ addresses, error: null as unknown }),
      (error: unknown) => ({ addresses: [] as string[], error }),
    ),
    resolve6(hostname).then(
      (addresses) => ({ addresses, error: null as unknown }),
      (error: unknown) => ({ addresses: [] as string[], error }),
    ),
  ]);

  const addresses = [...ipv4Result.addresses, ...ipv6Result.addresses];

  if (!addresses.length) {
    const codes = [
      dnsErrorCode(ipv4Result.error),
      dnsErrorCode(ipv6Result.error),
    ].filter(Boolean);

    // Only an unambiguous "no such domain" from every attempt counts. If any
    // lookup failed for another reason — timeout, SERVFAIL, refused — the
    // honest answer is "we do not know".
    const domainMissing =
      codes.length > 0 && codes.every((code) => NXDOMAIN_CODES.has(code));

    throw new DnsResolutionError(
      domainMissing
        ? "The website hostname does not exist."
        : `The website hostname could not be resolved (${codes.join(", ") || "no answer"}).`,
      domainMissing,
    );
  }

  if (addresses.some((address) => !isPublicIp(address))) {
    throw new Error("Private or reserved network destinations are blocked.");
  }
  return addresses;
}
