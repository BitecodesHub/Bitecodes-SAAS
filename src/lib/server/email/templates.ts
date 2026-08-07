import "server-only";

import type { AnyBulkWriteOperation } from "mongodb";
import { emailTemplates } from "@/lib/server/db/collections";
import { extractVariables, type EmailBlock } from "@/lib/email/template";
import {
  OUTREACH_TEMPLATE_SEEDS,
  type OutreachTemplateSeed,
} from "@/lib/email/templates/outreach";
import type { EmailTemplateDoc, ProspectTag } from "@/lib/server/db/types";

/**
 * Storage for editable email templates.
 *
 * Templates live in code as seeds and in the database as records. The seeds are
 * the source of truth until a human edits one, at which point the database wins
 * and the seed is never applied again — tracked by `isDefault`.
 *
 * That flag is the whole design. Without it, either a deploy silently overwrites
 * an operator's carefully-worded email, or the defaults freeze at whatever
 * shipped first and improvements never reach anyone. With it, editing is an
 * explicit, one-way opt-out of future seed updates.
 */

/**
 * Inserts any missing seed, and refreshes seeds a human has not touched.
 *
 * Reads all nine seeds in one query and writes in one batch. It used to issue a
 * `findOne` per seed *sequentially* — nine serial round trips — and this runs on
 * the read path of `/admin/email`, so every load of that page paid for all nine
 * before rendering. Measured at 1.38s TTFB, the slowest page in the panel by a
 * wide margin, on a database with no rows in it at all.
 *
 * The decision semantics are unchanged: a human-edited template is left alone
 * entirely, and a still-default one is refreshed when the shipped wording moves.
 */
export async function ensureSeededTemplates(
  now = new Date(),
): Promise<{ inserted: number; refreshed: number }> {
  const collection = await emailTemplates();

  const existingRows = await collection
    .find({ key: { $in: OUTREACH_TEMPLATE_SEEDS.map((s) => s.key) } })
    .toArray();
  const byKey = new Map(existingRows.map((row) => [row.key, row]));

  const writes: AnyBulkWriteOperation<EmailTemplateDoc>[] = [];
  let inserted = 0;
  let refreshed = 0;

  for (const seed of OUTREACH_TEMPLATE_SEEDS) {
    const existing = byKey.get(seed.key);

    if (!existing) {
      writes.push({ insertOne: { document: toDocument(seed, now) } });
      inserted += 1;
      continue;
    }

    // Edited by a human: leave it entirely alone, including its subject.
    if (!existing.isDefault) continue;

    // Still a default. Refresh it so wording improvements in code reach
    // deployments that have never customised this template.
    const next = toDocument(seed, now);
    const changed =
      existing.subject !== next.subject ||
      JSON.stringify(existing.blocks) !== JSON.stringify(next.blocks) ||
      existing.name !== next.name ||
      existing.description !== next.description;

    if (changed) {
      writes.push({
        updateOne: {
          filter: { key: seed.key },
          update: {
            $set: {
              name: next.name,
              description: next.description,
              subject: next.subject,
              blocks: next.blocks,
              variables: next.variables,
              updatedAt: now,
            },
          },
        },
      });
      refreshed += 1;
    }
  }

  // Unordered: the writes touch distinct keys, so there is no reason to make
  // one wait for the previous, and one failure should not abandon the rest.
  if (writes.length > 0) {
    await collection.bulkWrite(writes, { ordered: false });
  }

  return { inserted, refreshed };
}

/**
 * Per-process guard for the read path only.
 *
 * Seeding is reconciliation against code, so it cannot produce a new result
 * twice in the same deployment — but `listTemplates` is called on every render of
 * `/admin/email`, which made it a per-request cost. The flag lives here rather
 * than inside `ensureSeededTemplates` because callers that invoke that function
 * directly (a deploy step, and the tests that assert refresh behaviour after
 * mutating a row) must still get the real reconciliation every time.
 */
let seededThisProcess = false;

/** Test seam — forget the in-process flag. */
export function resetSeededTemplatesFlag() {
  seededThisProcess = false;
}

function toDocument(seed: OutreachTemplateSeed, now: Date): EmailTemplateDoc {
  return {
    key: seed.key,
    name: seed.name,
    description: seed.description,
    subject: seed.subject,
    blocks: seed.blocks,
    variables: extractVariables(seed.subject, ...blockText(seed.blocks)),
    category: "outreach",
    prospectTag: seed.prospectTag,
    enabled: true,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Every interpolatable string in a block list, for variable extraction. */
export function blockText(blocks: readonly EmailBlock[]): string[] {
  const strings: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "p":
      case "h2":
      case "signature":
        strings.push(block.text);
        break;
      case "ul":
        strings.push(...block.items);
        break;
      case "cta":
        strings.push(block.label, block.url);
        break;
    }
  }
  return strings;
}

export async function listTemplates(): Promise<EmailTemplateDoc[]> {
  // Reconcile once per process, not once per page view.
  if (!seededThisProcess) {
    await ensureSeededTemplates();
    seededThisProcess = true;
  }
  const collection = await emailTemplates();
  return collection.find({}).sort({ category: 1, key: 1 }).toArray();
}

export async function getTemplate(
  key: string,
): Promise<EmailTemplateDoc | null> {
  const collection = await emailTemplates();
  return collection.findOne({ key });
}

/**
 * The template for one classification tag, or null if nothing may be sent.
 *
 * The three cases are distinct, and conflating them was a real bug:
 *
 * - **A stored row that is disabled** → null. Disabling is an instruction to
 *   stop emailing this category of prospect. Falling through to the seed here
 *   would make the toggle do nothing at all, which is the worst outcome: the
 *   operator believes sending has stopped and it has not.
 * - **A stored row that is enabled** → that row, edits included.
 * - **No row at all** → the shipped seed, so a fresh deployment where seeding
 *   has not yet run still sends the correct email rather than silently skipping.
 */
export async function getTemplateForTag(
  tag: ProspectTag,
): Promise<EmailTemplateDoc | null> {
  const collection = await emailTemplates();
  const stored = await collection.findOne({
    prospectTag: tag,
    category: "outreach",
  });

  if (stored) return stored.enabled ? stored : null;

  const seed = OUTREACH_TEMPLATE_SEEDS.find(
    (entry) => entry.prospectTag === tag,
  );
  return seed ? toDocument(seed, new Date()) : null;
}

export interface TemplateUpdate {
  name?: string;
  description?: string;
  subject?: string;
  blocks?: EmailBlock[];
  enabled?: boolean;
}

/**
 * Applies an operator's edit.
 *
 * Always clears `isDefault`, even when the new content happens to match the
 * seed: the operator has taken ownership, and a later deploy must not quietly
 * revert what they reviewed and approved.
 */
export async function updateTemplate(
  key: string,
  update: TemplateUpdate,
  now = new Date(),
): Promise<boolean> {
  const collection = await emailTemplates();

  const fields: Partial<EmailTemplateDoc> = {
    isDefault: false,
    updatedAt: now,
  };
  if (update.name !== undefined) fields.name = update.name.slice(0, 120);
  if (update.description !== undefined) {
    fields.description = update.description.slice(0, 400);
  }
  if (update.subject !== undefined)
    fields.subject = update.subject.slice(0, 200);
  if (update.enabled !== undefined) fields.enabled = update.enabled;
  if (update.blocks !== undefined) {
    fields.blocks = update.blocks;
    fields.variables = extractVariables(
      update.subject ?? "",
      ...blockText(update.blocks),
    );
  }

  const result = await collection.updateOne({ key }, { $set: fields });
  return result.matchedCount === 1;
}

/** Restores a template to its shipped default. */
export async function resetTemplate(
  key: string,
  now = new Date(),
): Promise<boolean> {
  const seed = OUTREACH_TEMPLATE_SEEDS.find((entry) => entry.key === key);
  if (!seed) return false;

  const collection = await emailTemplates();
  const next = toDocument(seed, now);
  const result = await collection.updateOne(
    { key },
    {
      $set: {
        name: next.name,
        description: next.description,
        subject: next.subject,
        blocks: next.blocks,
        variables: next.variables,
        enabled: true,
        isDefault: true,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  return result.matchedCount === 1 || result.upsertedCount === 1;
}
