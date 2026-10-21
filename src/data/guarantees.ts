/**
 * OWNER MUST CONFIRM EVERY COMMITMENT BEFORE MERGE.
 *
 * These are process-based commitments, not unfunded SLAs. Each one describes
 * how an engagement is run and the limits that apply. The signed proposal and
 * statement of work remain the binding terms; this file exists so the public
 * page, service pages, and FAQ copy can point to one confirmed source.
 */
import type { Faq, Guarantee } from "@/types/content";

export const guarantees: Guarantee[] = [
  {
    slug: "written-fixed-quote",
    title: "A written fixed quote before work starts",
    commitment:
      "You receive a written fixed quote before any billable work begins.",
    details: [
      "The quote itemises scope, deliverables, assumptions, and exclusions.",
      "Work starts only after you approve the quote in writing.",
      "If discovery changes the scope, we issue a revised quote before any extra work.",
      "The quote and its approval are kept with the project record.",
    ],
    appliesTo: ["all"],
  },
  {
    slug: "milestone-payments",
    title: "Milestone-based payments",
    commitment:
      "Invoices follow agreed delivery milestones rather than a single upfront payment.",
    details: [
      "Each milestone has a defined deliverable and a stated amount.",
      "You are billed when the milestone is reviewed and accepted.",
      "The payment schedule is written into the quote before work starts.",
      "Ongoing retainers are billed monthly in advance unless agreed otherwise.",
    ],
    appliesTo: ["all"],
  },
  {
    slug: "client-owns-code",
    title: "You own the code and intellectual property",
    commitment:
      "On final payment, ownership of the custom code and project deliverables transfers to you.",
    details: [
      "Ownership transfers when the agreed fees have been paid in full.",
      "Third-party libraries and tools remain under their own licences.",
      "We keep no licence to reuse your proprietary code.",
      "A written intellectual property assignment can be included in the contract.",
    ],
    appliesTo: ["all"],
  },
  {
    slug: "code-in-your-repository",
    title: "Code in your repository from day one",
    commitment:
      "Project code is committed to a repository you own from the first working day.",
    details: [
      "You keep administrative access to the repository throughout the project.",
      "We work on branches and submit changes for review.",
      "Commit history remains available to your team.",
      "Where you prefer, we use your GitHub, GitLab, or Bitbucket account.",
    ],
    appliesTo: ["all"],
  },
  {
    slug: "defect-fix-window",
    title: "A 30-day defect-fix window after launch",
    commitment:
      "For 30 days after launch, we fix defects against the agreed scope at no additional cost.",
    details: [
      "A defect is delivered work that fails the written acceptance criteria.",
      "The window starts on the agreed launch date.",
      "New requirements and changes to agreed scope are quoted separately.",
      "Reports should include steps to reproduce and the affected environment.",
    ],
    appliesTo: ["all"],
  },
  {
    slug: "support-response-targets",
    title: "Support response targets for maintenance clients",
    commitment:
      "Maintenance clients receive a first response within one business day, and critical issues the same business day.",
    details: [
      "Support hours are Monday to Friday, 10:00 to 18:00 IST, excluding public holidays.",
      "Critical means a production outage or a security issue with no workaround.",
      "The target is a first response, not a resolution time.",
      "Issues are triaged against the agreed scope and support plan.",
    ],
    appliesTo: ["maintenance-support"],
  },
  {
    slug: "no-lock-in",
    title: "No lock-in and a full handover",
    commitment:
      "You can end the engagement at the end of any milestone and receive a complete handover.",
    details: [
      "Handover includes repository access, deployment documentation, credentials, and open tasks.",
      "Outstanding milestone fees remain payable for work completed.",
      "We do not withhold code or access to force a renewal.",
      "Reasonable transition support can be agreed in writing.",
    ],
    appliesTo: ["all"],
  },
  {
    slug: "written-change-requests",
    title: "Written change requests with a price before work",
    commitment:
      "Every change is documented with its price and timeline before work begins.",
    details: [
      "Changes are described in a short written request.",
      "You receive the impact on price and timeline before approving.",
      "Work on a change starts only after written approval.",
      "Approved changes are added to the agreed scope and milestone plan.",
    ],
    appliesTo: ["all"],
  },
  {
    slug: "nda-on-request",
    title: "An NDA on request",
    commitment:
      "We sign a reasonable non-disclosure agreement before detailed discussions when you ask.",
    details: [
      "We can review and sign your standard NDA.",
      "Alternatively, we can provide a mutual NDA for review.",
      "We keep project information confidential whether or not an NDA is signed.",
      "The signed agreement governs and prevails over this summary.",
    ],
    appliesTo: ["all"],
  },
];

export const guaranteeFaqs: Faq[] = [
  {
    question: "Are these commitments part of the contract?",
    answer:
      "These are the commitments we work to. The signed proposal and statement of work set the binding terms, and we include the relevant commitments in writing at the start of an engagement. Ask us to confirm any point before you sign.",
  },
  {
    question: "What counts as a defect?",
    answer:
      "A defect is delivered work that fails the acceptance criteria agreed in writing before build. New ideas, changed requirements, and work outside that scope are change requests, quoted before any work begins.",
  },
  {
    question: "What happens if a project runs late?",
    answer:
      "We share a milestone plan and weekly progress updates so delays surface early. If scope or feedback changes the timeline, we agree a revised plan in writing. The typical timeline is a planning range, not a promise.",
  },
  {
    question: "How do I raise a support issue?",
    answer:
      "Maintenance clients receive a support contact and written process at handover. Send the issue with steps to reproduce and its impact. We acknowledge within one business day, and the same business day for critical production issues.",
  },
];

const guaranteeBySlug = new Map(
  guarantees.map((guarantee) => [guarantee.slug, guarantee]),
);

export function getGuarantee(slug: string) {
  return guaranteeBySlug.get(slug);
}
