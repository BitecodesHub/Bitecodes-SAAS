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
  /** Commercial class. Inbound sequences are nurture, not cold outreach. */
  category?: "outreach" | "nurture";
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

/**
 * The inbound sequence.
 *
 * This is the "profit from the contact form" path: someone has already raised
 * their hand, so the cadence is slower, the copy is about the next useful step
 * rather than persuasion, and every message has a real exit. It is opt-in only.
 *
 * Delays are measured from enrolment and then from the previous step: day 2,
 * day 6, day 14. After that it stops for good.
 */
export const INBOUND_TEMPLATE_SEEDS: FollowupTemplateSeed[] = [
  {
    key: "inbound.welcome",
    name: "Inbound follow-up one — what happens next",
    description:
      "Sent two days after an opted-in enquiry. Explains the next step and offers a call without pretending the project is already scoped.",
    step: 1,
    category: "nurture",
    subject: "{{firstName}}, a useful next step",
    blocks: [
      {
        type: "p",
        text: "Thanks for getting in touch about {{serviceName}}. I have your message and the details you shared.",
      },
      {
        type: "p",
        text: "The next useful step is a short call to understand the goal, the constraints, and the timing. There is no pitch deck and no obligation.",
      },
      { type: "cta", label: "Choose a time", url: "{{bookingUrl}}" },
      {
        type: "p",
        text: "If a call is not useful yet, simply reply with the one question that would help most. {{unsubscribeUrl}} if you would rather not receive these notes.",
      },
      { type: "signature", text: "{{senderName}}, {{companyName}}" },
    ],
  },
  {
    key: "inbound.value",
    name: "Inbound follow-up two — one practical note",
    description:
      "Sent around day six. Gives one genuinely useful piece of advice, then repeats the invitation to book.",
    step: 2,
    category: "nurture",
    subject: "One thing worth deciding early",
    blocks: [
      {
        type: "p",
        text: "Hello {{firstName}} — one practical note while your enquiry is with us.",
      },
      {
        type: "p",
        text: "Most projects of this kind get easier when the primary action is agreed before the design: the one thing a visitor should be able to do. Booking a call, sending an enquiry, or buying — one clear action is usually better than three competing ones.",
      },
      {
        type: "p",
        text: "If that is useful, we can talk it through: {{bookingUrl}}. {{unsubscribeUrl}} to stop these notes.",
      },
      { type: "signature", text: "{{senderName}}, {{companyName}}" },
    ],
  },
  {
    key: "inbound.final",
    name: "Inbound follow-up three — the last note",
    description:
      "Sent around day fourteen. States plainly that this is the last message.",
    step: 3,
    category: "nurture",
    subject: "The last note from me",
    blocks: [
      {
        type: "p",
        text: "This is the last email I will send about your enquiry. No follow-up after this one.",
      },
      {
        type: "p",
        text: "If the timing changes, the door is open — reply whenever it suits, even months from now. {{bookingUrl}} if you would like to pick a time.",
      },
      {
        type: "p",
        text: "Either way, thank you for considering us. {{unsubscribeUrl}} if you would rather be removed entirely.",
      },
      { type: "signature", text: "{{senderName}}, {{companyName}}" },
    ],
  },
];

/** The default cold-outreach sequence: first contact, a nudge, then one final note. */
export interface SequenceSeed {
  key: string;
  name: string;
  description: string;
  /** Step one is the tag-matched first-contact template, resolved at send time. */
  steps: Array<{ templateKey: string | null; delayHours: number }>;
  stopOnClick: boolean;
  /** Who this sequence is for. Defaults to a prospect. */
  audience?: "prospect" | "lead";
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
    audience: "prospect",
  },
  {
    key: "inbound.followup",
    name: "Inbound enquiry follow-up",
    description:
      "Three opt-in notes after a contact-form enquiry: the next step, one useful thought, then a final note. Stops on a click, a reply, a booking, or a stage change.",
    steps: [
      { templateKey: "inbound.welcome", delayHours: 48 },
      { templateKey: "inbound.value", delayHours: 96 },
      { templateKey: "inbound.final", delayHours: 192 },
    ],
    stopOnClick: true,
    audience: "lead",
  },
];

export const FOLLOWUP_TEMPLATE_KEYS = FOLLOWUP_TEMPLATE_SEEDS.map(
  (seed) => seed.key,
);

export const INBOUND_TEMPLATE_KEYS = INBOUND_TEMPLATE_SEEDS.map(
  (seed) => seed.key,
);

export const ALL_FOLLOWUP_TEMPLATE_SEEDS: FollowupTemplateSeed[] = [
  ...FOLLOWUP_TEMPLATE_SEEDS,
  ...INBOUND_TEMPLATE_SEEDS,
];
