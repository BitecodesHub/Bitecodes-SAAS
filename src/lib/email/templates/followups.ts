import type { EmailBlock } from "@/lib/email/template";

/**
 * Follow-up templates — steps two and three of an outreach sequence.
 *
 * Generic rather than per-tag, deliberately. The first email already made the
 * specific, verifiable observation; repeating it reads as a mail-merge loop.
 * A follow-up's only honest job is to be short, acknowledge that the first one
 * may simply have arrived at a bad moment, and make stopping easier than
 * replying.
 *
 * The rules, enforced by tests:
 *
 * 1. **Shorter than the first email.** Under 70 words. A long follow-up to
 *    someone who did not answer the short one is not persuasion, it is pressure.
 * 2. **No guilt and no false continuity.** No "I noticed you didn't reply", no
 *    "just circling back", no "did you see my last email" — all of which imply
 *    an obligation the recipient never took on.
 * 3. **Two follow-ups, then stop, permanently.** The final one says so in plain
 *    words. A sequence that never ends is what turns outreach into harassment,
 *    and saying "this is the last one" is both true and the most effective line
 *    in the whole sequence.
 * 4. **Every follow-up repeats the unsubscribe.** Someone who ignored the first
 *    email should not have to hunt for the exit in the second.
 */

export interface FollowupTemplateSeed {
  key: string;
  name: string;
  description: string;
  subject: string;
  blocks: EmailBlock[];
  /** Position in the sequence, for documentation and ordering. */
  step: number;
}

export const FOLLOWUP_TEMPLATE_SEEDS: FollowupTemplateSeed[] = [
  {
    key: "followup.nudge",
    name: "Follow-up one — the report is still there",
    description:
      "Sent a few days after first contact. Short, no guilt, points at the same report rather than restating the finding.",
    step: 2,
    subject: "{{businessName}} — the notes I mentioned",
    blocks: [
      {
        type: "p",
        text: "Hello again — the write-up I put together for {{businessName}} is still here if it is useful:",
      },
      { type: "cta", label: "Open the notes", url: "{{reportUrl}}" },
      {
        type: "p",
        text: "There is nothing to sign up for and no cost. If it is not relevant, that is a perfectly good answer — {{unsubscribeUrl}} and I will stop.",
      },
      { type: "signature", text: "{{senderName}}, {{companyName}}" },
    ],
  },
  {
    key: "followup.final",
    name: "Follow-up two — the last one",
    description:
      "The final message in the sequence. States plainly that it is the last, which is both true and the most effective line in the sequence.",
    step: 3,
    subject: "{{businessName}} — last note from me",
    blocks: [
      {
        type: "p",
        text: "This is the last email I will send about {{businessName}}. No follow-up after this one.",
      },
      {
        type: "p",
        text: "If the timing is simply wrong, the notes stay available and you are welcome to reply whenever it suits — a year from now is fine.",
      },
      { type: "cta", label: "Open the notes", url: "{{reportUrl}}" },
      {
        type: "p",
        text: "Otherwise, thank you for your time and good luck with the business. {{unsubscribeUrl}} if you would rather be removed from our records entirely.",
      },
      { type: "signature", text: "{{senderName}}, {{companyName}}" },
    ],
  },
];

/** The single default sequence: first contact, a nudge, then one final note. */
export interface SequenceSeed {
  key: string;
  name: string;
  description: string;
  /** Step one is the tag-matched first-contact template, resolved at send time. */
  steps: Array<{ templateKey: string | null; delayHours: number }>;
  stopOnClick: boolean;
}

/**
 * Delays chosen to be unhurried. Four days, then seven more: a fortnight from
 * first contact to silence. Tighter cadences perform marginally better on paper
 * and read as pestering to the person receiving them.
 */
export const SEQUENCE_SEEDS: SequenceSeed[] = [
  {
    key: "outreach.default",
    name: "Standard outreach",
    description:
      "First contact matched to the customer's classification, then two unhurried follow-ups. Stops early on a click, an unsubscribe, or any sign of a reply.",
    steps: [
      // `null` means "the template for this prospect's tag", resolved per
      // recipient. Hard-coding a template here would send everyone the same
      // opening regardless of why they were classified.
      { templateKey: null, delayHours: 0 },
      { templateKey: "followup.nudge", delayHours: 96 },
      { templateKey: "followup.final", delayHours: 168 },
    ],
    stopOnClick: true,
  },
];

export const FOLLOWUP_TEMPLATE_KEYS = FOLLOWUP_TEMPLATE_SEEDS.map(
  (seed) => seed.key,
);
