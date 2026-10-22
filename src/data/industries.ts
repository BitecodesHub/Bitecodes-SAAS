import {
  Banknote,
  Building2,
  Clapperboard,
  Factory,
  GraduationCap,
  HeartPulse,
  Rocket,
  ShoppingBag,
  UserSearch,
} from "lucide-react";
import type { Industry } from "@/types/content";

export const industries: Industry[] = [
  {
    slug: "healthcare",
    name: "Healthcare",
    icon: HeartPulse,
    description:
      "Care platforms, patient tooling, and accessible workflows for clinics, allied health practices, and aged-care providers.",
    highlights: ["Care management", "Patient portals", "Accessible intake"],
    problems: [
      "Patients cannot book, reschedule, or ask a question outside reception hours.",
      "Paper and PDF intake forms are re-typed into the practice system.",
      "The website is difficult to use with a keyboard, screen reader, or larger text.",
      "Referrals and reminders are tracked by hand across phone calls and email.",
      "Sensitive information moves through spreadsheets without clear access controls.",
    ],
    approach: [
      "Map the patient journey from first search to appointment, referral, and intake.",
      "Agree the information patients and families need before they call.",
      "Design calm, accessible pages with booking and enquiry paths that work on a phone.",
      "Connect forms, reminders, and records to the systems the practice already uses.",
      "Test with keyboard, screen reader, and mobile users, then train reception and care staff.",
    ],
    faqs: [
      {
        question: "What can a clinic website do beyond sharing opening hours?",
        answer:
          "It can explain services and fees, answer common patient questions, take appointment requests, collect intake information securely, and send reminders. The right scope depends on your reception workflow and the systems your practice already uses.",
      },
      {
        question: "How do you handle patient privacy?",
        answer:
          "We design around the privacy obligations you specify, using access controls, encryption in transit, audit history, and data retention rules. We do not claim clinical or privacy certification. Your privacy or governance reviewer confirms the final design before launch.",
      },
      {
        question: "Can you support NDIS and aged-care billing workflows?",
        answer:
          "Yes. We have built care-operations tooling and fortnightly billing automation for an Australian aged-care provider, including validation, per-client routing, and accounting-ready exports. The Sublime Care case study describes the workflow in detail.",
      },
      {
        question: "Can families use the site on a phone?",
        answer:
          "Yes. We design mobile first for the tasks families complete most often, such as finding a service, checking eligibility, and making an enquiry. Touch targets, readable text, and simple forms are tested on real devices before launch.",
      },
    ],
    relatedServices: [
      "website-development",
      "ui-ux-development",
      "business-automation",
      "ai-integration",
      "maintenance-support",
    ],
    caseStudies: ["sublime-care", "rivala-care"],
  },
  {
    slug: "education",
    name: "Education",
    icon: GraduationCap,
    description:
      "Enrolment, learning, and assessment platforms for schools, coaching centres, and training providers.",
    highlights: ["Learning platforms", "Online enrolment", "Assessments"],
    problems: [
      "Enquiries and enrolments arrive by phone, walk-in, or direct message and are tracked in different places.",
      "Course, fee, and schedule information is out of date on the website.",
      "Parents and students ask the same questions by phone every week.",
      "Teachers and administrators copy data between spreadsheets and a learning tool.",
      "A learning portal is needed for some programmes but not others.",
    ],
    approach: [
      "Clarify programmes, fees, eligibility, and the enrolment steps before design.",
      "Build a public site that answers common questions and accepts applications.",
      "Connect enrolment, payment, and communication into one workflow.",
      "Add a learning portal only where it supports the teaching model.",
      "Train administrators and provide a clear content update process.",
    ],
    faqs: [
      {
        question: "Do we need a full learning management system?",
        answer:
          "Not always. A coaching centre may need a clear website, online enrolment, and payment rather than a full LMS. We assess how teaching, assessment, and communication work today, then recommend the smallest system that supports them.",
      },
      {
        question: "Can you build online enrolment and payments?",
        answer:
          "Yes. We can build application forms, document upload, fee calculation, and payment integration, with confirmation emails and an admin view. The workflow is agreed in writing, including refunds and exceptions, before development starts.",
      },
      {
        question: "How do you keep course information accurate?",
        answer:
          "We design the content structure around the fields that change most often, such as dates, fees, and availability. Administrators can update those fields without a developer, and the site validates required information before publishing.",
      },
      {
        question: "Can you support both in-person and online programmes?",
        answer:
          "Yes. The public pages can present both formats, while the portal handles the parts that differ, such as schedules, materials, and attendance. Access rules are agreed per programme rather than assumed for the whole organisation.",
      },
    ],
    relatedServices: [
      "website-development",
      "web-applications",
      "mobile-app-development",
      "business-automation",
      "ai-integration",
    ],
    caseStudies: ["bitecodes-academy"],
  },
  {
    slug: "recruitment",
    name: "Recruitment",
    icon: UserSearch,
    description:
      "Applicant tracking, candidate pipelines, and hiring workflows for agencies and in-house teams.",
    highlights: [
      "Applicant tracking",
      "Candidate pipelines",
      "Hiring workflows",
    ],
    problems: [
      "Applications arrive by email and are tracked across spreadsheets.",
      "Hiring managers cannot see pipeline status without asking for an update.",
      "Candidates receive inconsistent communication at each stage.",
      "Duplicate candidate records make reporting unreliable.",
      "Sensitive candidate data has no clear retention or access rules.",
    ],
    approach: [
      "Map the hiring stages, decision points, and communication at each step.",
      "Define roles for recruiters, hiring managers, and administrators.",
      "Build a candidate pipeline with clear ownership and next actions.",
      "Automate acknowledgements and reminders without removing human judgment.",
      "Agree retention, export, and deletion rules before launch.",
    ],
    faqs: [
      {
        question: "What does an applicant tracking system need to include?",
        answer:
          "It needs a clear pipeline, candidate records, role-based access, communication history, and reporting. The exact scope depends on your hiring volume and process. We map the stages first so the system reflects how your team actually decides.",
      },
      {
        question: "Can the platform support both employers and candidates?",
        answer:
          "Yes. We build separate experiences with appropriate permissions: employers manage roles and shortlists, while candidates apply, upload documents, and track progress. Shared data is limited to what each role needs to complete its task.",
      },
      {
        question: "How do you protect candidate data?",
        answer:
          "We apply role-based access, encryption in transit, audit history, and agreed retention rules. Exports are restricted and logged. Your privacy or compliance reviewer confirms the final design against the jurisdictions where candidates live.",
      },
      {
        question: "Can you migrate our existing candidate records?",
        answer:
          "Yes. We profile the source data, remove duplicates, map fields, and run a trial import before the production cutover. You review a sample, and the old system remains available until the migration is signed off.",
      },
    ],
    relatedServices: [
      "web-applications",
      "saas-development",
      "custom-software",
      "rest-api-development",
      "ui-ux-development",
    ],
    caseStudies: ["hirebound"],
  },
  {
    slug: "finance",
    name: "Finance",
    icon: Banknote,
    description:
      "Billing, reconciliation, and reporting tools for accounting firms, finance teams, and financial service providers.",
    highlights: ["Billing and invoicing", "Reconciliation", "Audit trails"],
    problems: [
      "Reconciliation still depends on spreadsheets and manual cross-checking.",
      "Approvals happen over email without a clear audit trail.",
      "Client or policy data is spread across tools that do not agree.",
      "Month-end reporting takes days of preparation.",
      "Access to sensitive records is broader than it needs to be.",
    ],
    approach: [
      "Map the money flow, approvals, and reconciliation points.",
      "Define the audit events and evidence each process must produce.",
      "Build role-based access and segregation of duties into the workflow.",
      "Integrate with accounting or core systems through documented interfaces.",
      "Test with real scenarios, including reversals and exceptions.",
    ],
    faqs: [
      {
        question: "Can you build a tool that fits our approval process?",
        answer:
          "Yes. We map who requests, approves, and reviews each transaction, then build those roles and limits into the system. Every approval is recorded with a timestamp and reason, so the process is visible to auditors and operations.",
      },
      {
        question: "How do you integrate with accounting software?",
        answer:
          "We use the provider's documented API where one exists, or a controlled import and export where it does not. The integration is tested against real records, including failed postings and corrections, before it handles live transactions.",
      },
      {
        question: "How do you approach financial data security?",
        answer:
          "We apply least-privilege access, encryption in transit, audit logging, and agreed retention. Sensitive changes require explicit permission. We do not claim certifications we do not hold, and your security reviewer confirms the design before launch.",
      },
      {
        question: "Can the system produce audit-ready reports?",
        answer:
          "Yes, when the required evidence is defined at the start. We agree the report format, source records, and retention period, then test the output against sample scenarios. The report states its source and generation time so reviewers can trace it.",
      },
    ],
    relatedServices: [
      "web-applications",
      "enterprise-software",
      "custom-software",
      "rest-api-development",
      "backend-development",
    ],
    caseStudies: [],
  },
  {
    slug: "retail",
    name: "Retail",
    icon: ShoppingBag,
    description:
      "Storefronts, inventory, and order workflows for independent retailers and growing consumer brands.",
    highlights: ["Storefronts", "Inventory", "Order workflows"],
    problems: [
      "Stock counts differ between the website, the shop, and the accounts.",
      "Orders arrive through marketplaces and social messages that are checked by hand.",
      "A third-party platform takes a commission on every direct customer.",
      "The storefront is slow on mobile, where most customers browse.",
      "Returns and exchanges are tracked in a notebook.",
    ],
    approach: [
      "Map how customers browse, order, pay, and return.",
      "Choose between an established commerce platform and a custom storefront.",
      "Connect stock, orders, and accounting into one flow.",
      "Tune the mobile experience before adding new channels.",
      "Agree fulfilment and exception rules with the people who handle them.",
    ],
    faqs: [
      {
        question:
          "Should we use an existing commerce platform or build custom?",
        answer:
          "An established platform is often the right choice for a straightforward catalogue and standard payments. Custom becomes worthwhile when your pricing, fulfilment, or customer workflow is genuinely different. We compare both options before recommending one.",
      },
      {
        question: "Can you connect our online store to inventory?",
        answer:
          "Yes. We integrate the storefront with your stock source so availability updates as orders are placed and fulfilled. Where the existing system has no API, we agree a scheduled exchange and a clear rule for resolving conflicts.",
      },
      {
        question: "How do you reduce dependence on marketplaces?",
        answer:
          "We improve the direct storefront, make repeat ordering simple, and connect consent-based email or messaging. Marketplaces can remain a discovery channel, but the customer relationship and data stay with your business.",
      },
      {
        question: "Can you support click-and-collect or local delivery?",
        answer:
          "Yes. We build the options your operation can actually fulfil, including store selection, time slots, delivery zones, and order status updates. The rules are written down and tested against busy periods before launch.",
      },
    ],
    relatedServices: [
      "website-development",
      "web-applications",
      "mobile-app-development",
      "performance-optimization",
      "ui-ux-development",
    ],
    caseStudies: [],
  },
  {
    slug: "media",
    name: "Media",
    icon: Clapperboard,
    description:
      "Portfolio, production, and publishing platforms for studios, agencies, and media houses.",
    highlights: ["Content platforms", "Portfolios", "Media delivery"],
    problems: [
      "Image and video heavy pages load slowly on mobile.",
      "Updating the portfolio requires a developer for every new project.",
      "Media is scattered across drives and links that break.",
      "Search engines cannot read the content inside galleries.",
      "Traffic spikes during a launch expose hosting limits.",
    ],
    approach: [
      "Define the portfolio structure and the story each project should tell.",
      "Build an editorial workflow for images, video, and captions.",
      "Design responsive media delivery with appropriate formats and sizes.",
      "Make project pages readable by search and answer engines.",
      "Test performance under realistic network and traffic conditions.",
    ],
    faqs: [
      {
        question: "How do you keep a media-heavy site fast?",
        answer:
          "We compress and resize media, serve modern formats, lazy-load below the fold, and set performance budgets for key pages. The exact approach depends on the mix of images and video, and it is measured before launch.",
      },
      {
        question: "Can our team update the portfolio without a developer?",
        answer:
          "Yes. We build an editor workflow with defined fields for credits, synopsis, media, and links. Your team publishes new work through that workflow, and the site validates required details before a project goes live.",
      },
      {
        question: "Can video be hosted on the site?",
        answer:
          "Yes, usually through a dedicated video platform embedded on the page rather than self-hosted streaming. That keeps playback reliable and protects page speed. We agree the provider, privacy settings, and fallback behaviour during design.",
      },
      {
        question: "How do you help people find our work?",
        answer:
          "We structure project pages with clear titles, descriptions, credits, and metadata, then add structured data and internal links. The aim is to make each project understandable to search engines and answer engines without hiding it behind a gallery.",
      },
    ],
    relatedServices: [
      "website-development",
      "frontend-development",
      "ui-ux-development",
      "performance-optimization",
      "maintenance-support",
    ],
    caseStudies: ["saanvi-production-house", "vertex-media-house"],
  },
  {
    slug: "manufacturing",
    name: "Manufacturing",
    icon: Factory,
    description:
      "Production tracking, scheduling, and reporting systems for factories and industrial teams.",
    highlights: ["Process tracking", "Scheduling", "Reporting"],
    problems: [
      "Production status lives on paper, whiteboards, or separate spreadsheets.",
      "Scheduling changes are communicated by phone and not recorded.",
      "Customer or management reports are assembled manually each week.",
      "Machine and ERP data cannot be combined without re-keying.",
      "Floor staff need a simple interface, not a desktop form.",
    ],
    approach: [
      "Walk the production process and record where information changes hands.",
      "Define the events, units, and exceptions the system must track.",
      "Design a fast, touch-friendly interface for floor use.",
      "Integrate with existing ERP, machine, or reporting systems.",
      "Roll out one line or site first, then extend.",
    ],
    faqs: [
      {
        question: "Can you build around our existing ERP?",
        answer:
          "Yes. We integrate with the ERP through its API or a controlled data exchange, keeping it as the system of record where that makes sense. The boundary between systems is agreed before development so data is not duplicated.",
      },
      {
        question: "How do you handle unreliable factory connectivity?",
        answer:
          "We design for intermittent connectivity where needed, with local capture and synchronisation when the connection returns. Conflict rules are agreed in advance, and the interface makes unsent records visible to the operator.",
      },
      {
        question: "Do floor staff need training?",
        answer:
          "Yes, and the interface should reduce the need for it. We test with the people who will use the system, keep the main actions large and simple, and provide a short reference guide for exceptions and corrections.",
      },
      {
        question: "Can the system report across multiple sites?",
        answer:
          "Yes, when site data is structured consistently. We agree common definitions for output, downtime, and quality, then build reports that compare sites without hiding local differences. Access can be limited by site or role.",
      },
    ],
    relatedServices: [
      "custom-software",
      "web-applications",
      "enterprise-software",
      "business-automation",
      "rest-api-development",
    ],
    caseStudies: [],
  },
  {
    slug: "startups",
    name: "Startups",
    icon: Rocket,
    description:
      "MVP design and engineering for founders who need to validate a product with real users.",
    highlights: ["MVPs", "Rapid iteration", "Scale-ready foundations"],
    problems: [
      "The product idea is clear, but the first release scope is not.",
      "Every week without a working product delays customer learning.",
      "Early technical choices can create expensive rework later.",
      "Investors and partners need a demonstrable product, not a deck.",
      "A full-time engineering team is not justified yet.",
    ],
    approach: [
      "Define the smallest release that proves the core value.",
      "Agree the architecture and the decisions that are expensive to reverse.",
      "Design and build in short increments with a working demo each week.",
      "Instrument the product so usage informs the next decision.",
      "Hand over clean code and documentation for the next stage.",
    ],
    faqs: [
      {
        question: "How do you define an MVP?",
        answer:
          "An MVP is the smallest coherent product that lets real users complete the core task and gives you evidence about whether it works. We exclude features that do not test the main assumption, while keeping security and data foundations sound.",
      },
      {
        question: "Can you work with a small budget?",
        answer:
          "Yes, by narrowing the first release. A focused MVP costs less than a broad launch because it tests one workflow well. We show what is included at each budget level and what must wait for a later phase.",
      },
      {
        question: "Do we own the code and intellectual property?",
        answer:
          "Yes. On final payment, ownership of the custom code and deliverables transfers to you, and the code is in your repository from day one. Third-party libraries remain under their own licences, which we document at handover.",
      },
      {
        question: "What happens after launch?",
        answer:
          "You can continue with a maintenance retainer, bring the work in-house, or return for a later phase. We provide documentation, deployment access, and a handover session so the product is not dependent on us.",
      },
    ],
    relatedServices: [
      "saas-development",
      "web-applications",
      "mobile-app-development",
      "ui-ux-development",
      "technical-consulting",
      "deployment",
    ],
    caseStudies: [],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    icon: Building2,
    description:
      "Large-scale platforms with the integration, access control, and reliability that enterprise teams require.",
    highlights: ["Integrations", "SSO and RBAC", "High availability"],
    problems: [
      "Business-critical processes run on systems that are hard to change.",
      "Identity, access, and audit requirements slow every integration.",
      "Several departments hold versions of the same data.",
      "Vendors and internal teams need a clear, documented interface.",
      "Change control and procurement require evidence before approval.",
    ],
    approach: [
      "Map the systems, data ownership, and approval constraints.",
      "Agree the architecture, integration contracts, and security model.",
      "Deliver in approved phases with documented acceptance criteria.",
      "Provide environments, runbooks, and evidence for internal review.",
      "Plan handover to the team that will operate the platform.",
    ],
    faqs: [
      {
        question: "Can you work within our procurement and change process?",
        answer:
          "Yes. We provide written scope, architecture, security information, and milestone plans in the format your process requires. We plan for review time in the schedule and do not treat approval steps as an afterthought.",
      },
      {
        question: "How do you manage integration with several systems?",
        answer:
          "We document each system's owner, interface, data contract, and failure behaviour before build. Integrations are delivered behind clear boundaries, with retries and monitoring, so one failing system does not take down the whole workflow.",
      },
      {
        question: "Do you support SSO and role-based access?",
        answer:
          "Yes. We integrate with standard identity providers and design roles around real job responsibilities. Access is reviewed at launch and can be audited afterwards. The exact provider and group mapping are agreed during discovery.",
      },
      {
        question: "What documentation do we receive?",
        answer:
          "Architecture diagrams, integration contracts, deployment and recovery runbooks, administrative guides, and decision records. The documentation is written for the team that will operate the system, not only for the people who built it.",
      },
    ],
    relatedServices: [
      "enterprise-software",
      "web-applications",
      "rest-api-development",
      "cloud-solutions",
      "devops",
      "technical-consulting",
      "mcp-servers",
    ],
    caseStudies: ["parking-management-system"],
  },
];

const industryBySlug = new Map(
  industries.map((industry) => [industry.slug, industry]),
);

export function getIndustry(slug: string) {
  return industryBySlug.get(slug);
}
