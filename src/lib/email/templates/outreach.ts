import type { EmailBlock } from "@/lib/email/template";
import type { ProspectTag } from "@/lib/server/db/types";

/**
 * The seeded outreach templates — one per prospect classification tag.
 *
 * These are the default first-contact emails. They are seeded into the database
 * so an operator can edit them, but the defaults matter enormously: they are
 * what actually goes out, and a cold email is the only impression most
 * recipients will ever form of the company.
 *
 * The rules every template here follows, and which the tests enforce:
 *
 * 1. **Short.** Under about 120 words of body. A long cold email is deleted.
 * 2. **One verifiable observation.** Each opens with something the recipient can
 *    confirm on their own phone in under a minute. No invented traffic figures,
 *    no percentages, no "you are losing customers" arithmetic we cannot support.
 * 3. **No flattery and no fake familiarity.** No "I was browsing your site and
 *    loved it" — it is transparently untrue in a templated email.
 * 4. **The ask is a click, not a meeting.** The report page does the selling;
 *    asking a stranger for thirty minutes on the first touch does not work.
 * 5. **An easy no.** Every template says, in plain words, that ignoring it is
 *    fine. That is both decent and better for deliverability than pressure.
 * 6. **Unsubscribe in the body, not just the header**, because the compliance
 *    footer alone reads as boilerplate.
 *
 * Variables available to every outreach template are listed in
 * `OUTREACH_VARIABLES`. Values are interpolated by a renderer that always
 * escapes, so a business name harvested from OpenStreetMap cannot inject markup.
 */

/**
 * Variables the outreach renderer supplies, with a note on each.
 *
 * Surfaced in the admin editor so a template author knows what is available
 * without reading this file.
 */
export const OUTREACH_VARIABLES: Array<{
  name: string;
  description: string;
  example: string;
}> = [
  {
    name: "businessName",
    description: "The business as it appears on the map.",
    example: "Café Rossi",
  },
  {
    name: "city",
    description: "Their town or city, when known.",
    example: "Ahmedabad",
  },
  {
    name: "websiteHost",
    description: "Their domain without the scheme. Empty when they have none.",
    example: "rossi.example.com",
  },
  {
    name: "topIssue",
    description: "The single most important finding, as a short phrase.",
    example: "Not usable on a phone",
  },
  {
    name: "reportUrl",
    description: "Signed link to their personalised report page.",
    example: "https://bitecodes.com/report/…",
  },
  {
    name: "unsubscribeUrl",
    description: "One-click opt-out. Required in every outreach template.",
    example: "https://bitecodes.com/unsubscribe?t=…",
  },
  {
    name: "senderName",
    description: "Who the email is from.",
    example: "Ismail",
  },
  {
    name: "companyName",
    description: "Your studio's name.",
    example: "Bitecodes",
  },
];

export interface OutreachTemplateSeed {
  key: string;
  name: string;
  description: string;
  subject: string;
  blocks: EmailBlock[];
  prospectTag: ProspectTag;
}

/** The closing block every outreach template ends with. */
function closing(): EmailBlock[] {
  return [
    {
      type: "p",
      text: "If this is not useful, ignore this and you will not hear from me again — or {{unsubscribeUrl}} to be removed for good.",
    },
    { type: "signature", text: "{{senderName}}, {{companyName}}" },
  ];
}

/**
 * The templates.
 *
 * Subject lines are deliberately plain and specific rather than curiosity-gap
 * ("Quick question", "Following up"). A vague subject gets a better open rate
 * and a worse reply rate, because the opens come from people who feel misled.
 */
export const OUTREACH_TEMPLATE_SEEDS: OutreachTemplateSeed[] = [
  {
    key: "outreach.no-website",
    name: "No website found",
    description:
      "For a business with no website at all, or only a social page. The strongest opening: nothing to defend.",
    prospectTag: "no-website",
    subject: "{{businessName}} — I could not find your website",
    blocks: [
      {
        type: "p",
        text: "Hello — I run a small software studio and I was looking at businesses in {{city}}. I could not find a website for {{businessName}} anywhere.",
      },
      {
        type: "p",
        text: "That may well be deliberate. If it is not, it means anyone searching for you finds a competitor instead, and there is nothing you control in those results.",
      },
      {
        type: "p",
        text: "I wrote up what I found, and what a single useful page would need to do for a business like yours:",
      },
      { type: "cta", label: "See what I found", url: "{{reportUrl}}" },
      ...closing(),
    ],
  },
  {
    key: "outreach.website-down",
    name: "Website not loading",
    description:
      "Urgent and genuinely useful. Only ever sent when the failure is real evidence about their site, never on a timeout at our end.",
    prospectTag: "website-down",
    subject: "{{businessName}} — your website is not loading",
    blocks: [
      {
        type: "p",
        text: "Hello — this is not a sales email so much as a heads-up. When I tried {{websiteHost}} it did not load.",
      },
      {
        type: "p",
        text: "Outages like this often go unnoticed for weeks, because the owner rarely visits their own site. Anyone searching for you right now sees an error page.",
      },
      {
        type: "p",
        text: "Worth checking your hosting and domain are current. I have put the details of what I saw here:",
      },
      { type: "cta", label: "See what happened", url: "{{reportUrl}}" },
      {
        type: "p",
        text: "If it is already fixed, ignore me — glad it was brief.",
      },
      ...closing(),
    ],
  },
  {
    key: "outreach.not-mobile-friendly",
    name: "Not usable on a phone",
    description:
      "The most persuasive finding, because the recipient can confirm it on their own phone in five seconds.",
    prospectTag: "not-mobile-friendly",
    subject: "{{businessName}} — try your site on your phone",
    blocks: [
      {
        type: "p",
        text: "Hello — I look at how local businesses in {{city}} come across online. Open {{websiteHost}} on your phone and you will see what I mean: it loads as a shrunken desktop page.",
      },
      {
        type: "p",
        text: "Most people searching for a business like yours are on a phone. If the text needs pinching to read, they leave.",
      },
      {
        type: "p",
        text: "It is usually a layout fix rather than a rebuild. Here is the detail:",
      },
      { type: "cta", label: "See the full check", url: "{{reportUrl}}" },
      ...closing(),
    ],
  },
  {
    key: "outreach.insecure-website",
    name: "Browsers show Not secure",
    description:
      "A trust problem before a technical one, and the fix is cheap — which makes it an easy first conversation.",
    prospectTag: "insecure-website",
    subject: "{{businessName}} — browsers are flagging your site",
    blocks: [
      {
        type: "p",
        text: "Hello — when I opened {{websiteHost}}, my browser labelled it “Not secure” in the address bar.",
      },
      {
        type: "p",
        text: "That warning appears because the site has no valid certificate. Visitors read it as carelessness, and search engines rank the page lower for it.",
      },
      {
        type: "p",
        text: "The certificate itself is free and it is usually an afternoon of work. Details here:",
      },
      { type: "cta", label: "See the full check", url: "{{reportUrl}}" },
      ...closing(),
    ],
  },
  {
    key: "outreach.slow-website",
    name: "Slow to load",
    description:
      "Measurable and unarguable. Speed is the one improvement that helps ranking and conversion together.",
    prospectTag: "slow-website",
    subject: "{{businessName}} — {{websiteHost}} is slow to load",
    blocks: [
      {
        type: "p",
        text: "Hello — I measured how quickly {{websiteHost}} responds, and it is slow enough that visitors will leave before the page appears.",
      },
      {
        type: "p",
        text: "It is normally images and unused scripts rather than anything structural, which makes it one of the cheaper things to fix.",
      },
      { type: "p", text: "The numbers I measured are here:" },
      { type: "cta", label: "See the timings", url: "{{reportUrl}}" },
      ...closing(),
    ],
  },
  {
    key: "outreach.seo-gaps",
    name: "Invisible to search",
    description:
      "For a site that works but is not readable by search engines or social platforms.",
    prospectTag: "seo-gaps",
    subject: "{{businessName}} — search engines cannot read your page",
    blocks: [
      {
        type: "p",
        text: "Hello — {{websiteHost}} is missing the markup that tells Google what your business is, where it is, and when it is open.",
      },
      {
        type: "p",
        text: "Practically, that makes you less likely to appear in the map results, and links to your site preview as a bare URL when somebody shares them.",
      },
      { type: "p", text: "Here is exactly what is missing:" },
      { type: "cta", label: "See the gaps", url: "{{reportUrl}}" },
      ...closing(),
    ],
  },
  {
    key: "outreach.accessibility-gaps",
    name: "Accessibility problems",
    description:
      "Lower urgency commercially, but real, and in several markets a legal exposure.",
    prospectTag: "accessibility-gaps",
    subject: "{{businessName}} — some visitors cannot use your site",
    blocks: [
      {
        type: "p",
        text: "Hello — I checked {{websiteHost}} for the markup that screen readers rely on, and parts of it are missing.",
      },
      {
        type: "p",
        text: "That shuts out visitors using assistive technology, and in a number of markets it carries legal exposure. It is usually a markup change rather than a redesign.",
      },
      { type: "p", text: "The specifics are here:" },
      { type: "cta", label: "See the details", url: "{{reportUrl}}" },
      ...closing(),
    ],
  },
  {
    key: "outreach.feature-upgrade",
    name: "Site informs but does not sell",
    description:
      "For a decent site missing the one action that would make it earn: booking, ordering, or enquiry capture.",
    prospectTag: "feature-upgrade",
    subject: "{{businessName}} — one thing your site cannot do yet",
    blocks: [
      {
        type: "p",
        text: "Hello — {{websiteHost}} is in reasonable shape. It tells people about {{businessName}}, but it does not let them act.",
      },
      {
        type: "p",
        text: "The specific gap I noticed: {{topIssue}}. Every visitor who has to phone instead is one you can lose to a competitor who does not make them.",
      },
      { type: "p", text: "I set out what I would add first, and why:" },
      { type: "cta", label: "See the suggestion", url: "{{reportUrl}}" },
      ...closing(),
    ],
  },
  {
    key: "outreach.strong-website",
    name: "Site is already good",
    description:
      "Deliberately not a critique. For a business worth knowing where there is nothing to fix — the pitch is what comes next, not what is broken.",
    prospectTag: "strong-website",
    subject: "{{businessName}} — nothing wrong with your site",
    blocks: [
      {
        type: "p",
        text: "Hello — I check how businesses in {{city}} come across online. {{websiteHost}} holds up well, which is rarer than it should be, so this is not a list of problems.",
      },
      {
        type: "p",
        text: "Where I usually help a business at this stage is the work behind the site: integrations, automating something done by hand, or an internal tool.",
      },
      {
        type: "p",
        text: "If any of that is on your list, the check I ran is here for reference:",
      },
      { type: "cta", label: "See the check", url: "{{reportUrl}}" },
      ...closing(),
    ],
  },
];

/** Lookup by classification tag, for the send planner. */
export function outreachTemplateForTag(
  tag: ProspectTag,
): OutreachTemplateSeed | undefined {
  return OUTREACH_TEMPLATE_SEEDS.find((seed) => seed.prospectTag === tag);
}

export const OUTREACH_TEMPLATE_KEYS = OUTREACH_TEMPLATE_SEEDS.map(
  (seed) => seed.key,
);
