/**
 * Decision-stage comparisons.
 *
 * Each page compares Bitecodes with a realistic alternative. The copy is
 * intentionally honest about where the alternative wins: a comparison that
 * claims a studio is cheaper than DIY or faster than an in-house team is not
 * useful to a buyer and not credible to a search engine.
 *
 * Prices and commitments mirror `src/lib/pricing.ts` and
 * `src/data/guarantees.ts`.
 */

export interface ComparisonRow {
  label: string;
  bitecodes: string;
  alternative: string;
}

export interface ComparisonPage {
  slug: string;
  title: string;
  alternativeName: string;
  shortAnswer: string;
  metaDescription: string;
  updated: string;
  readingMinutes: number;
  rows: ComparisonRow[];
  chooseBitecodes: string[];
  chooseAlternative: string[];
  verdict: string;
  faqs: { question: string; answer: string }[];
  related: string[];
  cta: { label: string; href: string; description: string };
}

export const comparisonPages: ComparisonPage[] = [
  {
    slug: "bitecodes-vs-freelancer",
    title: "Bitecodes vs a freelancer: which should you hire?",
    alternativeName: "Freelancer",
    shortAnswer:
      "Choose a freelancer for a small, well-defined task with a limited budget and a single skill. Choose Bitecodes when the project needs design, frontend, backend, testing, deployment, and someone accountable for all of it. A freelancer is usually cheaper per hour; a studio is usually cheaper per finished outcome once coordination and rework are counted.",
    metaDescription:
      "An honest comparison of hiring Bitecodes versus a freelancer: cost, risk, skills, availability, ownership, and when each is the right choice.",
    updated: "2026-10-22",
    readingMinutes: 5,
    rows: [
      {
        label: "Best for",
        bitecodes:
          "A complete website or application with several disciplines and a launch date.",
        alternative:
          "One focused task, such as a landing page, a bug fix, or a single integration.",
      },
      {
        label: "Team",
        bitecodes:
          "Design, frontend, backend, testing, and deployment under one accountable scope.",
        alternative:
          "One person, often strong in one area and self-taught in the rest.",
      },
      {
        label: "Starting price",
        bitecodes: "Website from $500; web app from $1,600.",
        alternative:
          "Often $20–$80 per hour, or a few hundred dollars for a small fixed task.",
      },
      {
        label: "Availability risk",
        bitecodes:
          "Covered by the studio; illness or leave does not stop the project.",
        alternative: "Concentrated in one person, with no automatic cover.",
      },
      {
        label: "Process",
        bitecodes:
          "Written scope, fixed quote, milestones, staging, and a defect-fix window.",
        alternative:
          "Varies widely; the good ones are excellent, and the process is usually informal.",
      },
      {
        label: "Code ownership",
        bitecodes:
          "You own the code, and it lives in your repository from day one.",
        alternative:
          "Usually yours if agreed in writing; confirm before work starts.",
      },
      {
        label: "Communication",
        bitecodes:
          "Written updates and a named contact, with a documented handover.",
        alternative:
          "Direct and fast, but often dependent on one person's habits.",
      },
    ],
    chooseBitecodes: [
      "The project spans design, frontend, backend, and deployment.",
      "You need a written fixed quote and a predictable launch date.",
      "You cannot afford the project to stop when one person is unavailable.",
      "You want tests, documentation, and a handover you can maintain.",
    ],
    chooseAlternative: [
      "The task is genuinely small and single-discipline.",
      "You already have design and project management covered.",
      "You have worked with the freelancer before and trust their delivery.",
      "Budget is the dominant constraint and the scope can flex.",
    ],
    verdict:
      "For a small, isolated task, a good freelancer is often the sensible choice. For a product that must launch and be maintained, the coordination cost of assembling several freelancers usually exceeds the studio premium — and the risk sits with you rather than with one accountable team.",
    faqs: [
      {
        question: "Is a freelancer always cheaper?",
        answer:
          "Their hourly rate usually is. The total can be higher when you add your own coordination time, separate design and QA, and rework between people who did not plan together. For a single well-defined task, freelancers are often cheaper overall.",
      },
      {
        question: "Can Bitecodes work alongside our freelancer?",
        answer:
          "Yes. A common setup is a freelancer handling a specialized piece while we own the core build and integration. The scope and interfaces need to be written down so responsibility is clear.",
      },
      {
        question: "What if the freelancer disappears mid-project?",
        answer:
          "That is the main risk. Mitigate it by requiring repository access, regular commits, and documentation from day one. A studio carries that continuity risk as part of the engagement.",
      },
    ],
    related: [
      "bitecodes-vs-agency",
      "bitecodes-vs-in-house-team",
      "how-to-choose-a-software-development-company",
    ],
    cta: {
      label: "Get a fixed quote",
      href: "/contact",
      description:
        "Describe the outcome you need. We will tell you honestly whether a focused freelancer or a full build team is the better fit.",
    },
  },
  {
    slug: "bitecodes-vs-agency",
    title: "Bitecodes vs a traditional agency: what is the difference?",
    alternativeName: "Traditional agency",
    shortAnswer:
      "A traditional agency is often the right choice for a large brand campaign with media buying, many stakeholders, and a long retainer. Bitecodes is a smaller engineering-led studio: you work closer to the people building the product, the scope is written and fixed, and there is less account-management overhead. For a focused software build, that usually means a shorter path from decision to shipped code.",
    metaDescription:
      "Compare a small engineering studio with a traditional agency on team, cost, speed, communication, and accountability.",
    updated: "2026-10-22",
    readingMinutes: 5,
    rows: [
      {
        label: "Best for",
        bitecodes:
          "Focused websites, web applications, SaaS products, APIs, and AI integrations.",
        alternative:
          "Integrated brand campaigns, media buying, PR, and large multi-team programmes.",
      },
      {
        label: "Team size",
        bitecodes: "A small senior team, with the builder in the conversation.",
        alternative:
          "Larger, with strategy, account management, design, and delivery layers.",
      },
      {
        label: "Starting price",
        bitecodes: "Website from $500; SaaS from $2,400.",
        alternative:
          "Often a monthly retainer or a five-figure project minimum.",
      },
      {
        label: "Speed to first release",
        bitecodes:
          "Discovery to build quickly because there are fewer approval layers.",
        alternative:
          "More stakeholders and process, which can improve alignment but slows delivery.",
      },
      {
        label: "Accountability",
        bitecodes:
          "A written fixed quote, milestone payments, and a named engineer accountable for delivery.",
        alternative:
          "Account management plus a delivery team; ask who is accountable for the actual code.",
      },
      {
        label: "Overhead",
        bitecodes:
          "Low: you pay for engineering and design, not layers of coordination.",
        alternative:
          "Higher, because strategy, accounts, and production are separate functions.",
      },
      {
        label: "Scalability",
        bitecodes:
          "Best for one or two concurrent workstreams, not a 50-person launch.",
        alternative:
          "Can staff a large, multi-channel programme with many specialists.",
      },
    ],
    chooseBitecodes: [
      "The outcome is a working website, application, or AI feature.",
      "You want direct access to the engineer making decisions.",
      "You need a fixed scope and price rather than an open retainer.",
      "You value a short path from feedback to a deployed change.",
    ],
    chooseAlternative: [
      "You need brand strategy, media buying, PR, and production together.",
      "The programme requires many specialist teams and a large budget.",
      "Procurement requires a large agency with specific certifications.",
      "You want a long-term retainer across many marketing channels.",
    ],
    verdict:
      "The distinction is focus, not quality. A large agency can coordinate a multi-channel launch that a small studio should not attempt. A small engineering studio can ship a focused product faster and with less overhead. Match the shape of the team to the shape of the work.",
    faqs: [
      {
        question: "Is Bitecodes an agency?",
        answer:
          "It is a software studio: a small team that designs and builds software. It does not run media buying or PR campaigns. The engagement model is closer to a specialist engineering partner than a full-service agency.",
      },
      {
        question: "Do you work with our existing agency?",
        answer:
          "Yes. We can build the product while your agency owns brand, content, and campaigns. Clear interfaces and a shared launch plan make that work.",
      },
      {
        question: "Why is the starting price lower?",
        answer:
          "Lower overhead and a smaller team, not a different quality bar. The published floor is for a scoped engagement; larger or more complex work is quoted after discovery.",
      },
    ],
    related: [
      "bitecodes-vs-freelancer",
      "bitecodes-vs-in-house-team",
      "how-to-choose-a-software-development-company",
    ],
    cta: {
      label: "Talk to the builder",
      href: "/book-a-call",
      description:
        "A 30-minute call with the engineer who would do the work, not a sales handoff.",
    },
  },
  {
    slug: "bitecodes-vs-wix-squarespace",
    title: "Bitecodes vs Wix or Squarespace: which is right?",
    alternativeName: "Wix or Squarespace",
    shortAnswer:
      "Choose Wix or Squarespace for a simple brochure site you want to launch yourself this week at a low monthly cost. Choose Bitecodes when you need custom design, specific integrations, performance, SEO control, or a site that will grow into a product. Website builders are genuinely good at the first job and become limiting at the second.",
    metaDescription:
      "A fair comparison of custom development with Wix and Squarespace: cost, control, performance, ownership, and when a builder is enough.",
    updated: "2026-10-22",
    readingMinutes: 5,
    rows: [
      {
        label: "Best for",
        bitecodes:
          "Custom marketing sites, web apps, SaaS, and sites with specific integrations or SEO needs.",
        alternative:
          "A simple brochure site, portfolio, or small shop launched without a developer.",
      },
      {
        label: "Cost",
        bitecodes: "One-time build from $500, plus hosting.",
        alternative:
          "A monthly subscription, often $15–$50 per month, plus templates and apps.",
      },
      {
        label: "Time to launch",
        bitecodes:
          "Four to eight weeks for a focused site, including design and testing.",
        alternative: "Days to a few weeks if you build it yourself.",
      },
      {
        label: "Design control",
        bitecodes:
          "A custom design system built around your content and conversion path.",
        alternative:
          "Templates with constrained customisation and platform-specific quirks.",
      },
      {
        label: "Performance",
        bitecodes:
          "Static-first output, image optimisation, and control over every request.",
        alternative:
          "Platform-dependent; heavier pages and third-party scripts are common.",
      },
      {
        label: "Code ownership",
        bitecodes: "You own the code and can move hosting without rebuilding.",
        alternative:
          "You own the content, not the platform; leaving means rebuilding elsewhere.",
      },
      {
        label: "SEO control",
        bitecodes:
          "Full control of markup, structured data, redirects, sitemap, and rendering.",
        alternative:
          "Good basics, but limited control over technical SEO and page weight.",
      },
    ],
    chooseBitecodes: [
      "The site needs custom design or a specific conversion path.",
      "You need integrations, a CMS with a real content model, or a login.",
      "Performance and technical SEO are part of the business case.",
      "You want to own the code and hosting and avoid platform lock-in.",
    ],
    chooseAlternative: [
      "You need a simple site live this week.",
      "You are comfortable editing it yourself and do not need custom code.",
      "The monthly cost is acceptable and the site is unlikely to grow into an app.",
      "You do not need bespoke integrations or fine technical control.",
    ],
    verdict:
      "A website builder is not a lesser choice; it is a different tool. If a template expresses your offer well and you do not need custom behaviour, the subscription is rational. The moment the business depends on performance, integrations, or a unique conversion path, the builder's constraints become the expensive part.",
    faqs: [
      {
        question: "Can I move a Wix or Squarespace site to Bitecodes later?",
        answer:
          "Yes, but it is a rebuild, not a migration. Content and URLs can be carried over with redirects; the design and platform code cannot. Budget for a new build rather than a transfer.",
      },
      {
        question: "Is a custom site always better for SEO?",
        answer:
          "No. A well-configured builder site can rank well. Custom development gives you more control over rendering, page weight, structured data, and redirects, which matters more as the site grows.",
      },
      {
        question: "What is the ongoing cost of a custom site?",
        answer:
          "Hosting is usually modest for a marketing site. Maintenance, content changes, and improvements are separate. Ask for a handover that lets you edit content without a developer for routine changes.",
      },
    ],
    related: [
      "bitecodes-vs-webflow",
      "how-much-does-a-website-cost",
      "how-to-reduce-website-cost",
    ],
    cta: {
      label: "See what a custom build costs",
      href: "/website-development-cost-calculator",
      description:
        "Compare a real scope and price against a builder subscription, including the cost of leaving.",
    },
  },
  {
    slug: "bitecodes-vs-webflow",
    title: "Bitecodes vs Webflow: which should you build on?",
    alternativeName: "Webflow",
    shortAnswer:
      "Choose Webflow when a designer should own a marketing site visually and the site does not need custom application logic. Choose Bitecodes when the site needs custom integrations, complex data, a login, an application, or full control of performance and hosting. Webflow is excellent at design-led marketing sites; it is not a replacement for a software team when the product itself is software.",
    metaDescription:
      "A practical comparison of Webflow and custom development for marketing sites, CMS-driven content, and web applications.",
    updated: "2026-10-22",
    readingMinutes: 5,
    rows: [
      {
        label: "Best for",
        bitecodes:
          "Custom sites, web applications, SaaS products, APIs, and AI integrations.",
        alternative:
          "Design-led marketing sites and content sites managed by a designer.",
      },
      {
        label: "Cost",
        bitecodes: "One-time build from $500, plus hosting.",
        alternative:
          "A site plan plus per-seat workspace costs; design and build may be extra.",
      },
      {
        label: "Design workflow",
        bitecodes:
          "Design and engineering work together, with a coded design system.",
        alternative: "Visual canvas, fast iteration for layout and content.",
      },
      {
        label: "Custom logic",
        bitecodes:
          "Any business logic, authentication, queues, payments, and data model.",
        alternative:
          "Limited to the platform's capabilities and external APIs.",
      },
      {
        label: "CMS",
        bitecodes:
          "Modelled around your content and workflow, with any schema you need.",
        alternative:
          "A capable CMS with collections, references, and a good editor.",
      },
      {
        label: "Ownership",
        bitecodes: "You own the code; hosting and tooling can move.",
        alternative:
          "You own the content and design; the site runs on Webflow's platform.",
      },
      {
        label: "Ceiling",
        bitecodes: "Grows into a product without a platform migration.",
        alternative:
          "A rebuild is likely when the product needs accounts, complex workflows, or native app features.",
      },
    ],
    chooseBitecodes: [
      "The site is part of a product with accounts, data, or workflows.",
      "You need custom integrations or a bespoke content model.",
      "You want code ownership and hosting flexibility.",
      "The site must stay fast as third-party scripts and content grow.",
    ],
    chooseAlternative: [
      "A designer will own and iterate on the site continuously.",
      "The site is primarily marketing and content, without custom logic.",
      "The team already uses Webflow and is productive in it.",
      "You want visual editing without a developer in the loop.",
    ],
    verdict:
      "Webflow is a strong choice for a marketing site owned by a design team. It becomes the wrong choice when the roadmap includes a logged-in product, complex integrations, or a data model the platform does not support. Decide based on where the product will be in two years, not only what launches next month.",
    faqs: [
      {
        question: "Can Webflow handle a SaaS product?",
        answer:
          "It can host the marketing site, but it is not an application platform. Authentication, billing logic, background jobs, and a multi-tenant data model belong in custom software. Many SaaS companies run a Webflow marketing site plus a custom app.",
      },
      {
        question: "Is custom code harder for our team to edit?",
        answer:
          "It depends on the build. A good handover includes a CMS for routine content, documentation, and a repository your team can access. If visual editing is the priority, a builder is the better fit.",
      },
      {
        question: "Which is faster to launch?",
        answer:
          "Webflow, for a design-led marketing site. A custom build takes longer upfront but can absorb product requirements without a later migration.",
      },
    ],
    related: [
      "bitecodes-vs-wix-squarespace",
      "custom-software-vs-off-the-shelf",
      "how-much-does-a-website-cost",
    ],
    cta: {
      label: "Plan the right foundation",
      href: "/book-a-call",
      description:
        "We will tell you if Webflow is the better tool for your next phase — and what changes if the product needs custom software.",
    },
  },
  {
    slug: "bitecodes-vs-in-house-team",
    title: "Bitecodes vs building an in-house team",
    alternativeName: "In-house team",
    shortAnswer:
      "Build in-house when software is the core product, you need continuous iteration, and you can hire and retain a team. Use Bitecodes when you need a defined outcome faster than a hiring cycle allows, or when you need specialist skills for a phase. The most common successful pattern is a small internal owner plus an external build team, with a planned handover.",
    metaDescription:
      "Compare hiring an in-house software team with working with Bitecodes on cost, speed, control, continuity, and long-term ownership.",
    updated: "2026-10-22",
    readingMinutes: 5,
    rows: [
      {
        label: "Best for",
        bitecodes:
          "A defined launch, a specialist phase, or a product bet that needs speed.",
        alternative:
          "Continuous product development where software is the core business.",
      },
      {
        label: "Time to start",
        bitecodes: "Days to weeks after scoping.",
        alternative:
          "Two to four months to recruit and onboard, longer for senior roles.",
      },
      {
        label: "Cost structure",
        bitecodes: "A fixed project price or a defined monthly engagement.",
        alternative:
          "Salaries, benefits, equipment, recruitment, and management time.",
      },
      {
        label: "Skills",
        bitecodes: "A cross-functional team assembled for the scope.",
        alternative:
          "Whatever you can hire; gaps are covered by contractors or training.",
      },
      {
        label: "Context",
        bitecodes:
          "Learns the domain during discovery; context leaves at handover unless documented.",
        alternative:
          "Accumulates deep context over time and can iterate continuously.",
      },
      {
        label: "Control",
        bitecodes:
          "Defined by the contract, with repository access and weekly demos.",
        alternative:
          "Direct day-to-day control, including priorities and staffing.",
      },
      {
        label: "Long-term flexibility",
        bitecodes: "Easy to stop or change scope at a phase boundary.",
        alternative:
          "Difficult to scale down without losing capability or morale.",
      },
    ],
    chooseBitecodes: [
      "You need a release before you could realistically hire a team.",
      "The work is a defined phase rather than permanent product development.",
      "You need a mix of skills that is hard to hire for at once.",
      "You want a fixed price and a written scope before committing.",
    ],
    chooseAlternative: [
      "Software is the product and will need daily iteration for years.",
      "You already have strong technical leadership and can hire well.",
      "Deep domain context is the main source of advantage.",
      "You need direct control over every priority and trade-off.",
    ],
    verdict:
      "This is less a competition than a sequencing decision. Start external when speed and a defined outcome matter; internalise when continuous product work justifies permanent capacity. Whichever way you go, insist on repository access, tests, documentation, and a handover — those make the next step possible.",
    faqs: [
      {
        question: "Can we hire your developers afterwards?",
        answer:
          "That depends on the contract and the individuals, and it should be discussed upfront. Even without a hire, a proper handover with documentation and tests makes an internal transition feasible.",
      },
      {
        question: "How do we avoid lock-in with an external team?",
        answer:
          "Own the repository, cloud accounts, domains, and third-party services from day one. Require documentation and tests as deliverables. Lock-in is usually a contract and access problem, not a technology problem.",
      },
      {
        question: "What is the right first internal hire?",
        answer:
          "Usually a product-minded technical lead who can define priorities, review trade-offs, and manage the external team. Hiring only junior developers before that role exists often creates more coordination work than it removes.",
      },
    ],
    related: [
      "bitecodes-vs-agency",
      "bitecodes-vs-freelancer",
      "in-house-vs-agency-development",
    ],
    cta: {
      label: "Plan the handover",
      href: "/contact",
      description:
        "Tell us your hiring timeline. We can scope a build that your future team can own, with documentation designed for handover.",
    },
  },
];

export function getComparison(slug: string) {
  return comparisonPages.find((page) => page.slug === slug);
}

export function relatedComparisons(page: ComparisonPage) {
  return page.related
    .map((slug) => getComparison(slug))
    .filter((related): related is ComparisonPage => Boolean(related));
}
