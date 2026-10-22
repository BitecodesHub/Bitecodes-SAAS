import "server-only";

import type { DigestRange, DigestSection } from "@/lib/server/digest/types";

/**
 * Digest section "assistant": Website chats, captured leads, unanswered questions, and callback calls.
 *
 * Placeholder created by the foundation; owned by the assistant-calls package, which
 * replaces this body. Return null when there is nothing to report.
 */
export async function buildSection(
  range: DigestRange,
): Promise<DigestSection | null> {
  void range;
  return null;
}
