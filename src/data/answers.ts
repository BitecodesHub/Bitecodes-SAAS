/**
 * Answer-first library.
 *
 * Each page opens with a complete, quotable answer, then supports it with
 * detail. The structure is deliberate: answer engines extract the first
 * paragraph, while a human reader can keep scrolling for the reasoning. Answers
 * link to the calculators, services, and tools that turn intent into action.
 *
 * Prices here must match `src/lib/pricing.ts` and `src/data/offers.ts`.
 */

export type AnswerCategory =
  | "Costs"
  | "Hiring"
  | "AI search"
  | "Delivery"
  | "Products";

export interface AnswerSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface AnswerPage {
  slug: string;
  question: string;
  shortAnswer: string;
  metaDescription: string;
  category: AnswerCategory;
  updated: string;
  readingMinutes: number;
  sections: AnswerSection[];
  faqs: { question: string; answer: string }[];
  related: string[];
  cta: { label: string; href: string; description: string };
}

export const answerPages: AnswerPage[] = [
  {
    slug: "how-much-does-a-website-cost",
    question: "How much does a website cost in 2026?",
    shortAnswer:
      "A focused business website typically costs between $500 and $10,000 in 2026. A small, well-built marketing site starts around $500; a larger site with custom design, many templates, integrations, and copy support usually lands between $3,000 and $10,000. E-commerce, membership, and multilingual sites cost more because the complexity sits in the workflows, not the page count.",
    metaDescription:
      "A practical 2026 breakdown of website costs by scope, what changes the price, and how to compare quotes without buying more site than you need.",
    category: "Costs",
    updated: "2026-10-22",
    readingMinutes: 6,
    sections: [
      {
        heading: "What drives the price of a website",
        paragraphs: [
          "Page count is the least important driver. The expensive parts are custom design, content structure, integrations, and anything that must be tested across browsers, devices, and languages. A five-page site with a booking flow can cost more than a thirty-page brochure site because the booking flow has states, edge cases, and a third-party API.",
          "The second driver is who supplies the content. A project moves fastest when the copy, images, and brand assets exist before design starts. When the studio has to structure or write the content, that work is real and should appear in the quote.",
        ],
        bullets: [
          "Design: a custom visual system versus a restrained, type-led layout",
          "Content: supplied, structured by the studio, or written from scratch",
          "Integrations: payments, CRM, booking, email, analytics, and authentication",
          "Compliance: accessibility, cookie consent, privacy pages, and regional rules",
          "Migration: moving existing pages, redirects, and search equity",
        ],
      },
      {
        heading: "Typical price bands",
        paragraphs: [
          "These bands describe the market, not a quote. A credible proposal states what is included, what is excluded, and what assumptions would change the price.",
        ],
        bullets: [
          "Under $1,000: a small, template-led site with a handful of pages and standard forms. Bitecodes' Launch package starts at $500.",
          "$1,000–$3,000: custom design, more pages, a CMS, and one or two integrations.",
          "$3,000–$10,000: a larger marketing site with complex content, multiple templates, analytics, and lead routing.",
          "Above $10,000: e-commerce, multilingual publishing, memberships, or a site tightly coupled to a custom application.",
        ],
      },
      {
        heading: "How to compare quotes fairly",
        paragraphs: [
          "Compare deliverables and assumptions, not headline prices. Two quotes for $2,000 can describe very different projects: one includes responsive design, accessibility checks, analytics, deployment, and handover; the other is a theme with your logo and a contact form.",
          "Ask who owns the code and the accounts, what happens after launch, and how change requests are priced. A low build price with no handover or support is often the more expensive option over two years.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is $500 enough for a real business website?",
        answer:
          "It is enough for a focused, well-built marketing site with a clear structure, responsive design, contact capture, basic SEO, and deployment. It is not enough for e-commerce, custom portals, or a large content operation. The honest answer depends on scope, not on whether the number sounds low.",
      },
      {
        question: "Should I pay monthly or once?",
        answer:
          "Pay once for the build if you want to own the asset outright. Pay monthly for hosting, maintenance, and ongoing improvements, which are separate services. Avoid a contract where you never own the code or cannot move hosting.",
      },
      {
        question: "How long does a website take?",
        answer:
          "A small marketing site typically takes four to eight weeks; a larger custom site takes eight to sixteen. The timeline is usually set by content readiness and review speed rather than by development hours.",
      },
    ],
    related: [
      "how-to-reduce-website-cost",
      "custom-software-vs-off-the-shelf",
      "how-to-choose-a-software-development-company",
    ],
    cta: {
      label: "Estimate your website cost",
      href: "/website-development-cost-calculator",
      description:
        "Use the calculator for a transparent range, then get a written fixed quote after a short scoping conversation.",
    },
  },
  {
    slug: "how-much-does-a-mobile-app-cost",
    question: "How much does a mobile app cost?",
    shortAnswer:
      "A simple mobile app usually costs between $1,800 and $8,000. A production app with accounts, payments, notifications, an admin panel, and store submission typically costs $8,000 to $40,000 or more. The largest cost drivers are the number of distinct user roles, offline behaviour, third-party integrations, and whether the app needs native device capabilities.",
    metaDescription:
      "What a mobile app costs in 2026, which features move the price most, and how to scope a first release that can actually ship.",
    category: "Costs",
    updated: "2026-10-22",
    readingMinutes: 6,
    sections: [
      {
        heading: "The features that actually cost money",
        paragraphs: [
          "A screen count is a poor estimate. The expensive work is everything behind the screens: identity, permissions, data synchronisation, payment state, push notifications, and the rules that decide what each user can see. Every one of those adds states that must be designed, built, and tested.",
          "Store submission is a small but real cost. Apple and Google require privacy disclosures, screenshots, review notes, and a credible account-deletion path if users can create accounts. A build that works in a simulator is not the same as a submission that passes review.",
        ],
        bullets: [
          "Authentication and roles: the more roles, the more permission states",
          "Payments: store billing rules, refunds, and subscription edge cases",
          "Offline mode: conflict resolution is significantly harder than caching",
          "Native capabilities: camera, Bluetooth, background location, health data",
          "Admin tooling: most apps need a web dashboard that is part of the budget",
        ],
      },
      {
        heading: "Cross-platform, native, or a web app",
        paragraphs: [
          "A cross-platform build (React Native or Flutter) is usually the right first choice for a business app: one codebase, two stores, and native access where it matters. A fully native build makes sense when performance, deep device integration, or platform-specific interaction is the product.",
          "Sometimes the honest answer is a mobile-first web app. If the app does not need push notifications, offline use, or a store presence, a well-built responsive web application can reach users faster and cost less to maintain.",
        ],
      },
      {
        heading: "A sane first-release budget",
        paragraphs: [
          "Scope the first release around one job the user must complete. Defer social features, elaborate onboarding, and dashboards nobody has asked for. A smaller release that reaches real users produces better evidence than a larger one that never launches.",
          "Bitecodes builds mobile apps from $1,800. A written fixed quote follows a short discovery conversation, and the quote separates must-have functionality from later phases so the first release can ship on a real budget.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do I need both iOS and Android?",
        answer:
          "Usually, yes, but not necessarily on day one. If your audience is concentrated on one platform, launching there first can validate the product sooner. A cross-platform codebase keeps the second launch cheaper.",
      },
      {
        question: "Are app store fees included?",
        answer:
          "No. Apple's and Google's developer programme fees, payment processing fees, and any third-party service subscriptions are separate from build costs. They are usually small relative to development but should be in the budget.",
      },
      {
        question: "How long does an app take to build?",
        answer:
          "A focused first release usually takes eight to sixteen weeks. More roles, payments, and integrations extend that. Store review adds a few days and can require a resubmission if metadata or privacy disclosures are incomplete.",
      },
    ],
    related: [
      "how-much-does-a-website-cost",
      "how-to-build-an-mvp-in-8-weeks",
      "custom-software-vs-off-the-shelf",
    ],
    cta: {
      label: "Estimate your app cost",
      href: "/mobile-app-cost-calculator",
      description:
        "Get a range for your app scope, then confirm it against a written, fixed-scope quote.",
    },
  },
  {
    slug: "how-long-does-a-saas-mvp-take",
    question: "How long does it take to build a SaaS MVP?",
    shortAnswer:
      "A focused SaaS MVP usually takes 6 to 12 weeks. A simpler workflow with one user role and one core job can ship in 6 to 10 weeks; a multi-tenant product with billing, admin tooling, and several roles typically takes 14 to 24 weeks. The calendar is usually set by scope decisions and feedback speed, not by typing speed.",
    metaDescription:
      "A realistic SaaS MVP timeline, the decisions that extend it, and how to scope a first version that reaches paying users.",
    category: "Delivery",
    updated: "2026-10-22",
    readingMinutes: 6,
    sections: [
      {
        heading: "What belongs in an MVP",
        paragraphs: [
          "An MVP is the smallest product that completes one valuable job for one type of user, reliably enough that they would pay for it or use it repeatedly. It is not a demo, and it is not the full product with fewer features. It is a narrow product with the quality bar kept high on the path that matters.",
          "The usual MVP includes authentication, one core workflow, the data model behind it, a usable interface, payments if the product is sold directly, and enough operational visibility to know when something breaks. It excludes elaborate analytics, integrations with every tool, and roles nobody has asked for.",
        ],
      },
      {
        heading: "Where the timeline goes",
        paragraphs: [
          "Discovery and scoping take one to two weeks and prevent the most expensive mistakes. Design and build for the core workflow take four to eight weeks. Hardening, testing, deployment, and a short feedback cycle take another one to three weeks. If payments or third-party integrations are in scope, add one to three weeks depending on their approval processes.",
          "Multi-tenancy, granular permissions, and subscription billing are the three features most likely to turn a six-week project into a four-month one. They are legitimate requirements, but they should be scheduled deliberately rather than assumed.",
        ],
        bullets: [
          "One user role and one workflow: the fastest credible MVP",
          "Payments and subscriptions: add two to four weeks including testing",
          "Admin and support tooling: add one to three weeks",
          "Data migration from an existing system: add two to six weeks",
          "AI features: add one to three weeks on top of the product workflow",
        ],
      },
      {
        heading: "How to keep the first release small",
        paragraphs: [
          "Write the first release as a list of jobs the user must complete, not a list of screens. For each job, define what done means and what can wait. Anything that does not help the first paying user complete the first job belongs in a later phase.",
          "Bitecodes' Growth package, a web application with accounts and workflows, starts at $1,600 and typically runs 10 to 18 weeks. The Scale package, a multi-tenant SaaS product with billing and admin tooling, starts at $2,400 and typically runs 14 to 24 weeks. A written fixed quote confirms the scope before work begins.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can a SaaS MVP really ship in six weeks?",
        answer:
          "Yes, if it has one user type, one core workflow, no complex billing, and content and decisions are ready. Six weeks is not enough for multi-tenant permissions, several integrations, and a full admin suite. The constraint is scope, not effort.",
      },
      {
        question: "Should I build an MVP with no-code tools?",
        answer:
          "No-code is a reasonable way to validate demand before writing software. It becomes limiting when the product needs custom logic, performance, or data ownership. The right question is whether the tool can support the first paying customers without a rewrite in six months.",
      },
      {
        question: "What happens after the MVP launches?",
        answer:
          "Expect a stabilisation period, then a small set of improvements based on real usage. A 30-day defect-fix window is standard at Bitecodes. Ongoing product work is scoped separately so it can follow evidence rather than assumptions.",
      },
    ],
    related: [
      "how-to-build-an-mvp-in-8-weeks",
      "custom-software-vs-off-the-shelf",
      "in-house-vs-agency-development",
    ],
    cta: {
      label: "Scope your MVP",
      href: "/startup-mvp-cost-calculator",
      description:
        "Get a first range in a minute, then a written scope with milestones and a fixed quote.",
    },
  },
  {
    slug: "custom-software-vs-off-the-shelf",
    question: "Is custom software better than off-the-shelf?",
    shortAnswer:
      "Custom software is better when your process is a competitive advantage, no product fits it without expensive workarounds, or you need control over data and integrations. Off-the-shelf software is better when the need is common, the budget is limited, and the tool's standard workflow is acceptable. Most companies should buy commodity functions and build only the parts that are genuinely different.",
    metaDescription:
      "A decision framework for custom software versus off-the-shelf tools, including total cost, lock-in, and when a hybrid approach wins.",
    category: "Hiring",
    updated: "2026-10-22",
    readingMinutes: 5,
    sections: [
      {
        heading: "Start with the process, not the software",
        paragraphs: [
          "Write down the job the software must do, who does it today, and what a good outcome looks like. If a standard product supports that job with minor configuration, buying is usually the lower-risk choice. If the product forces a worse process, a workaround per order, or a spreadsheet alongside the tool, the cost of fitting the business to the software is real and often invisible.",
          "The strongest case for custom software is not 'we want something unique'. It is 'this workflow is how we win, and no product models it'.",
        ],
      },
      {
        heading: "Compare the total cost, not the licence",
        paragraphs: [
          "Off-the-shelf pricing is visible but incomplete: add implementation, per-seat growth, integration work, and the cost of employees maintaining workarounds. Custom software has a higher upfront build cost but no per-seat tax, and you own the code. It also carries real ongoing costs: hosting, maintenance, and someone accountable for changes.",
          "For a five-person team with a standard need, buying almost always wins. For a hundred-person operation where the workflow is the product, a custom system can pay for itself by removing manual coordination.",
        ],
        bullets: [
          "Buy when the need is common and the standard workflow is acceptable",
          "Buy when speed matters more than differentiation",
          "Build when the workflow is proprietary or the integration surface is unusual",
          "Build when per-seat pricing would grow faster than the value delivered",
          "Consider a hybrid: buy the commodity layer, build the differentiator",
        ],
      },
      {
        heading: "Reduce the risk of a custom build",
        paragraphs: [
          "Scope a first phase that delivers one workflow end to end. Require a written fixed quote, repository access from day one, automated tests for critical paths, and a handover that includes documentation and deployment. Those terms matter more than the technology choice.",
          "Avoid a build that depends on one vendor for hosting, code access, and changes. Ownership and exit terms belong in the contract, not in a conversation after launch.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is custom software always more expensive?",
        answer:
          "Upfront, usually yes. Over three to five years it can be cheaper if it replaces several per-seat subscriptions, removes significant manual work, or supports a workflow that directly generates revenue. The comparison has to include implementation, subscriptions, and staff time.",
      },
      {
        question: "Can we start with off-the-shelf and migrate later?",
        answer:
          "Yes, and it is often sensible. Keep your data exportable and avoid customisations that only exist inside the vendor's platform. A later migration is easier when the underlying process is documented.",
      },
      {
        question: "How do we know if our process is unique enough?",
        answer:
          "If the process is documented, repeatable, and directly tied to how you win customers or deliver service, it is a candidate. If it is a variation of a standard function like accounting or payroll, buy.",
      },
    ],
    related: [
      "how-to-choose-a-software-development-company",
      "in-house-vs-agency-development",
      "how-much-does-a-website-cost",
    ],
    cta: {
      label: "Talk through the decision",
      href: "/book-a-call",
      description:
        "Bring the process and the constraints. We will tell you honestly whether to buy, build, or start with a discovery sprint.",
    },
  },
  {
    slug: "how-to-choose-a-software-development-company",
    question: "How do you choose a software development company?",
    shortAnswer:
      "Choose a software development company by verifying relevant work, talking to the people who will actually do the work, and insisting on a written scope with explicit assumptions, exclusions, ownership, and payment milestones. The strongest signal is not a portfolio image; it is whether the team can explain the trade-offs in your specific problem and has shipped something comparable.",
    metaDescription:
      "A practical checklist for evaluating software development companies, including the questions that expose risk before you sign.",
    category: "Hiring",
    updated: "2026-10-22",
    readingMinutes: 6,
    sections: [
      {
        heading: "Evaluate the evidence, not the presentation",
        paragraphs: [
          "Ask for a case study that matches your problem in complexity, not industry. Then ask what went wrong on it, what changed, and what the team would do differently. A vendor that can describe a difficult project honestly is usually safer than one whose portfolio has no failures.",
          "Ask who will be your day-to-day contact and whether that person is the same person who will write the code. If the sales team disappears after signing, the proposal is not evidence of how the project will run.",
        ],
      },
      {
        heading: "Questions that reveal how a team works",
        paragraphs: [
          "These questions are less about catching a vendor and more about seeing whether they think in terms of risk, scope, and ownership.",
        ],
        bullets: [
          "What is explicitly excluded from this quote?",
          "What would change the price or timeline, and how are changes priced?",
          "Who owns the code, designs, and accounts at the end?",
          "Where will the code live during the project, and can we access it from day one?",
          "What testing and deployment process do you use?",
          "What happens in the first 30 days after launch?",
          "Can we speak to a client whose project had a serious problem?",
        ],
      },
      {
        heading: "Red flags worth taking seriously",
        paragraphs: [
          "A fixed price with no written scope is not a guarantee; it is an invitation to argue later. A refusal to share the repository, a quote that cannot explain its assumptions, and a portfolio of screenshots with no named clients are all reasons to slow down.",
          "The opposite failure is also common: a large agency that assigns a junior team and a rotating account manager. Ask who is accountable for delivery and how much of the work is done in-house.",
        ],
      },
    ],
    faqs: [
      {
        question: "Should I choose the cheapest quote?",
        answer:
          "No. Compare what each quote includes, the assumptions behind it, and the team you will actually work with. The cheapest quote often excludes testing, handover, or support, which become expensive later.",
      },
      {
        question: "Does location matter?",
        answer:
          "Time-zone overlap and communication quality matter more than country. A team with a few hours of overlap and written English can run a project well; a nearby team that does not communicate clearly cannot.",
      },
      {
        question: "How long should a trial project be?",
        answer:
          "A paid discovery sprint or a small first milestone is enough to test communication, estimation, and code quality. Avoid unpaid trials that require substantial speculative work.",
      },
    ],
    related: [
      "custom-software-vs-off-the-shelf",
      "in-house-vs-agency-development",
      "how-much-does-a-website-cost",
    ],
    cta: {
      label: "See how we work",
      href: "/process",
      description:
        "Our process, guarantees, and written-quote commitments are published, so you can compare them with any other shortlist.",
    },
  },
  {
    slug: "why-is-my-website-not-showing-up-in-chatgpt",
    question: "Why is my website not showing up in ChatGPT?",
    shortAnswer:
      "A website usually fails to appear in ChatGPT answers for one of four reasons: its crawler is blocked in robots.txt, the page depends on JavaScript that the crawler does not execute, the content does not state the answer and the business facts clearly, or the site has too little independent evidence for a model to trust it. Fixing crawl access and publishing clear, structured, factual content addresses the first three; reputation and citations address the fourth.",
    metaDescription:
      "The real reasons a site is missing from ChatGPT, Claude, and Perplexity answers, with fixes you can verify yourself.",
    category: "AI search",
    updated: "2026-10-22",
    readingMinutes: 6,
    sections: [
      {
        heading: "1. The crawler is blocked",
        paragraphs: [
          "Open your robots.txt and search for GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, and Google-Extended. A wildcard `Disallow: /` blocks them too. Some sites block AI crawlers through a CDN or firewall rule rather than robots.txt, which the file will not show.",
          "Use the free AI visibility check to see exactly which crawlers are allowed and which rule decided it. Blocking training crawlers can be a legitimate choice; blocking search and citation crawlers usually removes you from the answer.",
        ],
      },
      {
        heading: "2. The content is not readable",
        paragraphs: [
          "Answer engines work from text they can retrieve. If the main content only appears after client-side JavaScript, a canvas, or a login, a crawler may see an empty shell. Server-rendered HTML, static pages, and clean semantic headings all improve the odds that the page is understood.",
          "The same applies to facts. A page that says 'we are passionate about excellence' gives a model nothing to quote. A page that says what the company does, who it serves, where it operates, what it costs, and how to start is citable.",
        ],
        bullets: [
          "Put the answer in the first paragraph under each heading",
          "State prices, locations, timelines, and guarantees explicitly",
          "Use one H1 and descriptive H2s that match real questions",
          "Keep important content in the initial HTML, not only in scripts",
          "Add Organization, Service, and FAQPage structured data",
        ],
      },
      {
        heading: "3. There is not enough corroboration",
        paragraphs: [
          "Models assemble answers from multiple sources and tend to favour entities they can verify. A company page is one signal; consistent profiles, reviews, directories, published articles, and mentions on other sites are others. This is the part that takes time and cannot be fixed by markup alone.",
          "Start with the entity basics: the same company name, description, address, and links everywhere. Then publish genuinely useful material that other people cite. There is no shortcut that reliably substitutes for being a real, consistent presence.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I pay to appear in ChatGPT?",
        answer:
          "OpenAI sells advertising placements in some products, but organic answers are not a paid placement you can buy. Claims that a service guarantees placement in AI answers should be treated with scepticism.",
      },
      {
        question: "How long does it take to appear?",
        answer:
          "Crawl access and technical fixes can take effect within days to weeks. Being cited consistently usually takes months of publishing and corroboration. No one can promise a specific date.",
      },
      {
        question: "Does blocking GPTBot hurt my Google rankings?",
        answer:
          "GPTBot is OpenAI's crawler, separate from Googlebot. Blocking it does not directly affect Google Search. Blocking Google-Extended affects Google's AI use of content, not standard Google Search indexing.",
      },
    ],
    related: [
      "what-is-generative-engine-optimization",
      "how-to-get-found-by-ai-search",
      "what-does-a-technical-audit-include",
    ],
    cta: {
      label: "Run the free AI visibility check",
      href: "/ai-visibility-check",
      description:
        "See which AI crawlers are allowed, whether llms.txt and structured data exist, and the highest-value fixes.",
    },
  },
  {
    slug: "what-is-generative-engine-optimization",
    question: "What is generative engine optimization (GEO)?",
    shortAnswer:
      "Generative engine optimization (GEO) is the practice of making a website's facts easy for AI answer engines to retrieve, understand, and cite. It combines technical crawl access, structured data, clear answer-first writing, and consistent entity information. Unlike traditional SEO, which competes for a link position, GEO competes to be included in a generated answer.",
    metaDescription:
      "A clear definition of generative engine optimization, how it differs from SEO, and the practices that actually influence AI citations.",
    category: "AI search",
    updated: "2026-10-22",
    readingMinutes: 5,
    sections: [
      {
        heading: "How GEO differs from SEO",
        paragraphs: [
          "SEO optimises for a ranked list of URLs. GEO optimises for a synthesized paragraph that may mention three sources and omit the rest. The unit of competition changes: instead of a position, you are competing to be the source a model selects, quotes, and links.",
          "The fundamentals still matter. A page that cannot be crawled, loads slowly, or buries its meaning in vague copy will struggle in both channels. GEO adds a stronger emphasis on entity clarity, direct answers, and machine-readable facts.",
        ],
      },
      {
        heading: "The practices that matter",
        paragraphs: [
          "Start with access: allow the crawlers you want to be cited by, and publish an llms.txt summary. Then make the page legible: one clear H1, question-shaped H2s, answer-first paragraphs, and explicit facts about the business, services, prices, and process.",
          "Add structured data that matches the visible page: Organization, WebSite, Service, FAQPage, and Article where appropriate. Keep the same company details across the site and external profiles. Finally, publish material worth citing and make it easy for others to reference.",
        ],
        bullets: [
          "Crawl access for AI and search crawlers",
          "llms.txt and a clear about/services/pricing structure",
          "Answer-first paragraphs and factual specificity",
          "JSON-LD that matches visible content",
          "Consistent entity details across the web",
          "Original research, guides, and tools that earn citations",
        ],
      },
      {
        heading: "What GEO cannot promise",
        paragraphs: [
          "No one controls how a model weights sources, and providers change retrieval systems frequently. A GEO programme can improve the odds that your content is retrievable and quotable; it cannot guarantee inclusion in a specific answer.",
          "Be cautious with vendors selling 'AI ranking guarantees'. The honest deliverable is a set of verifiable technical and content improvements, plus measurement of whether AI referrals and brand mentions grow over time.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is GEO just SEO with a new name?",
        answer:
          "It overlaps heavily. Both need crawlability, useful content, and clean structure. GEO adds emphasis on entity consistency, direct answers, and machine-readable summaries because the output is a generated answer rather than a list of links.",
      },
      {
        question: "Does llms.txt improve AI rankings?",
        answer:
          "It is an emerging convention, not a standard with guaranteed support. It is still a cheap way to publish a concise, factual summary and key links. Treat it as one useful signal, not a switch.",
      },
      {
        question: "How do I measure GEO?",
        answer:
          "Track AI referral traffic where it is identifiable, branded search demand, mentions in AI answers you sample manually, and the technical signals in a visibility check. Be careful with attribution: many AI referrals arrive as direct traffic.",
      },
    ],
    related: [
      "why-is-my-website-not-showing-up-in-chatgpt",
      "how-to-get-found-by-ai-search",
      "how-to-embed-an-ai-chatbot-on-a-website",
    ],
    cta: {
      label: "Check your AI visibility",
      href: "/ai-visibility-check",
      description:
        "A free, evidence-based review of the seven signals that decide whether AI crawlers can read your site.",
    },
  },
  {
    slug: "how-to-get-found-by-ai-search",
    question: "How do you get found by AI search?",
    shortAnswer:
      "To get found by AI search, allow AI crawlers, publish clear answer-first content with explicit facts, add structured data, keep your company details consistent everywhere, and earn mentions on other trustworthy sites. Technical access gets you read; clarity gets you quoted; corroboration makes you worth citing.",
    metaDescription:
      "A step-by-step, verifiable approach to appearing in ChatGPT, Claude, Perplexity, and other AI search answers.",
    category: "AI search",
    updated: "2026-10-22",
    readingMinutes: 6,
    sections: [
      {
        heading: "Step 1: Make the site readable",
        paragraphs: [
          "Check robots.txt for GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, and Google-Extended. Confirm the homepage and key pages return server-rendered HTML with the main content present. Avoid putting essential copy only inside images or client-only components.",
          "Publish an llms.txt that states what the company does, who it serves, where it operates, what it charges, and which pages matter. Link to the services, pricing, and contact pages.",
        ],
      },
      {
        heading: "Step 2: Make the facts quotable",
        paragraphs: [
          "Lead every section with the answer. Replace adjectives with specifics: prices, timelines, locations, service names, guarantees, and process steps. A model can cite a number; it cannot cite 'industry-leading quality'.",
          "Add JSON-LD for Organization, WebSite, Service, and FAQPage. Make sure the structured values match what a visitor sees. Inconsistent markup is worse than none because it creates conflicting facts.",
        ],
        bullets: [
          "Answer the question in the first sentence of the page",
          "Use question-shaped H2 headings",
          "State prices and timelines explicitly",
          "Add FAQ sections with direct answers",
          "Keep one canonical URL per topic",
        ],
      },
      {
        heading: "Step 3: Build corroboration",
        paragraphs: [
          "Answer engines favour entities they can verify across sources. Keep your name, description, address, and links consistent in directories, social profiles, and partner sites. Publish original guides, tools, or research that others can cite.",
          "Then measure. Sample the questions your buyers ask across the major assistants, note whether you appear, and check referrers and branded search over time. Treat it as a compounding channel, not a one-time switch.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do backlinks still matter for AI search?",
        answer:
          "They are one of several signals. A link is evidence that another source considers the page credible. Consistent mentions without links can also help entity recognition, but neither guarantees inclusion.",
      },
      {
        question: "Should I create content just for AI crawlers?",
        answer:
          "No. Write for the buyer and structure it so a machine can extract the answer. Content that exists only to game a crawler is usually low quality and easy to detect.",
      },
      {
        question: "How often should I update the content?",
        answer:
          "Update when the facts change: prices, services, locations, and product details. Freshness alone is not a substitute for accuracy, and changing dates without changing content does not help.",
      },
    ],
    related: [
      "what-is-generative-engine-optimization",
      "why-is-my-website-not-showing-up-in-chatgpt",
      "what-makes-a-website-convert",
    ],
    cta: {
      label: "See what is missing",
      href: "/ai-visibility-check",
      description:
        "Run the free check, then use the prioritized fixes or ask us to implement them.",
    },
  },
  {
    slug: "what-does-a-technical-audit-include",
    question: "What does a technical website audit include?",
    shortAnswer:
      "A technical website audit reviews how a site is built and delivered: crawlability, indexing, response performance, Core Web Vitals, accessibility markup, HTTPS and security headers, structured data, broken links, and the reliability of forms and integrations. A serious audit separates what was measured from what was inferred, and states what it did not test.",
    metaDescription:
      "What a useful technical website audit covers, how it differs from a passive scan, and what deliverables to expect.",
    category: "Delivery",
    updated: "2026-10-22",
    readingMinutes: 5,
    sections: [
      {
        heading: "The core areas",
        paragraphs: [
          "A good audit follows the path from discovery to conversion. Can crawlers reach the important pages? Do canonical tags and redirects point to the right URLs? Does the server respond quickly and consistently? Is the page usable with a keyboard and a screen reader? Does the enquiry form actually deliver?",
          "Security is part of the review at the header and configuration level: HTTPS, HSTS, content security policy, referrer policy, and MIME sniffing protection. A passive audit can note their absence; confirming exploitable vulnerabilities requires authorization and a different engagement.",
        ],
        bullets: [
          "Crawl and index: robots.txt, sitemap, canonicals, redirect chains, status codes",
          "Performance: server response, page weight, caching, and Core Web Vitals",
          "Accessibility: landmarks, headings, alt text, contrast, and keyboard paths",
          "Security posture: HTTPS, headers, exposed configuration, and dependencies",
          "Conversion path: forms, validation, notifications, and analytics events",
          "Content structure: titles, descriptions, headings, and internal links",
        ],
      },
      {
        heading: "Passive scan versus a real audit",
        paragraphs: [
          "A passive scan reads public responses and finds obvious gaps quickly. It is useful as a first pass and honest about its limits. A full audit adds crawling multiple pages, browser-based measurement, checking integrations and forms, reviewing analytics and consent behaviour, and interviewing the team about known issues.",
          "Beware of any report that presents a single score as the whole truth. Scores are a summary; the value is in the specific findings, their evidence, and the order in which to fix them.",
        ],
      },
      {
        heading: "What to expect as deliverables",
        paragraphs: [
          "Ask for a prioritized findings document, not a raw tool export. Each finding should state what was observed, why it matters, how to verify it, and an estimated effort. The report should distinguish confirmed issues from hypotheses that need access to confirm.",
          "If the audit is a prelude to a rebuild, ask for a migration plan as well: URL mapping, redirects, content inventory, and a launch checklist. Those details protect existing search equity.",
        ],
      },
    ],
    faqs: [
      {
        question: "How much does a technical audit cost?",
        answer:
          "Bitecodes runs a free passive audit at /website-audit. A deeper, multi-page audit with browser testing and integration checks is scoped as a paid engagement because it takes real time and, for some checks, written authorization.",
      },
      {
        question: "Is a technical audit the same as a penetration test?",
        answer:
          "No. An audit reviews configuration and public signals. A penetration test attempts to exploit vulnerabilities and requires explicit authorization, a defined scope, and usually a specialist. Never let an unaudited third party test systems you do not own.",
      },
      {
        question: "How often should a site be audited?",
        answer:
          "A light check after major changes and a fuller review once or twice a year is a sensible baseline. Sites with frequent releases, payments, or regulated data should review more often.",
      },
    ],
    related: [
      "what-makes-a-website-convert",
      "why-is-my-website-not-showing-up-in-chatgpt",
      "how-to-choose-a-software-development-company",
    ],
    cta: {
      label: "Run the free passive audit",
      href: "/website-audit",
      description:
        "Check SEO, response performance, accessibility markup, HTTPS, and defensive headers in one pass.",
    },
  },
  {
    slug: "how-to-embed-an-ai-chatbot-on-a-website",
    question: "How do you embed an AI chatbot on a website?",
    shortAnswer:
      "To embed an AI chatbot, train it on your own content, configure the widget and allowed domains, then paste one script tag or iframe into your site's HTML. The chatbot should answer only from approved sources, show a clear AI disclosure, capture leads with consent, and hand off to a human when it cannot help.",
    metaDescription:
      "A practical guide to embedding an AI chatbot safely: content, script installation, domain locks, lead capture, and what to test.",
    category: "Products",
    updated: "2026-10-22",
    readingMinutes: 5,
    sections: [
      {
        heading: "1. Prepare the knowledge",
        paragraphs: [
          "Gather the content the chatbot is allowed to use: service pages, FAQs, policies, pricing, and support articles. Remove outdated pages and anything confidential. A chatbot is only as accurate as its sources, and a confident wrong answer about price or policy is worse than no answer.",
          "Decide what it must never do: quote a custom price, promise a delivery date, give legal or medical advice, or discuss a customer's account. Those boundaries belong in the instructions and in the handoff rules.",
        ],
      },
      {
        heading: "2. Configure and embed",
        paragraphs: [
          "Set the appearance, welcome message, and allowed domains. Domain allowlisting stops someone from copying your embed code onto another site and spending your credits. Then add the script tag before the closing body tag, or use the iframe if your CMS restricts scripts.",
          "Test the widget on a staging page and on a phone. Check that it loads without blocking the page, that the close button is usable, and that the transcript is not cut off on small screens.",
        ],
        bullets: [
          "Train on current, approved content",
          "Lock the widget to your domains",
          "Publish a clear AI disclosure and privacy link",
          "Enable lead capture with an unticked marketing consent",
          "Set a human handoff path for unanswered questions",
          "Test on mobile, slow connections, and with scripts blocked",
        ],
      },
      {
        heading: "3. Measure and maintain",
        paragraphs: [
          "Review the questions the chatbot cannot answer. Each gap is either missing content, a misunderstanding, or a request that should go to a person. Update the knowledge base and re-test. A chatbot that is never reviewed drifts out of date.",
          "Bitecodes' chatbot uses prepaid token packs with no monthly subscription. The Starter pack is ₹499 for roughly 500 answers, and credits do not expire. You can self-serve at /signup or have the widget configured as part of a build.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does an AI chatbot hurt SEO?",
        answer:
          "Not inherently. The widget is a client-side addition and should not replace indexable content. Keep the core service and pricing information on the page so search engines and AI crawlers can read it without opening the chat.",
      },
      {
        question: "Can it answer from my website automatically?",
        answer:
          "Many tools can crawl your site to build a knowledge base. Review the result before launch. Automatic crawling can pick up outdated pages, legal text, or content you did not intend to expose.",
      },
      {
        question: "What about privacy and consent?",
        answer:
          "Disclose that the visitor is talking to an AI, link to a privacy policy, collect only what you need, and do not promise a retention period you have not implemented. If you record transcripts, say so and define how long you keep them.",
      },
    ],
    related: [
      "how-much-does-an-ai-chatbot-cost",
      "what-is-generative-engine-optimization",
      "what-makes-a-website-convert",
    ],
    cta: {
      label: "Try the Bitecodes chatbot",
      href: "/ai-chatbot",
      description:
        "Train it on your content, lock it to your domain, and embed it with one line of code.",
    },
  },
  {
    slug: "how-much-does-an-ai-chatbot-cost",
    question: "How much does an AI chatbot cost?",
    shortAnswer:
      "A website AI chatbot usually costs either a monthly subscription or usage-based credits. Bitecodes uses prepaid token packs with no subscription: the Starter pack is ₹499 for roughly 500 answers, and credits do not expire. Custom integration, content preparation, and advanced workflows are separate project work, typically from $1,200 for AI integration.",
    metaDescription:
      "AI chatbot pricing explained: subscriptions versus usage credits, what drives token cost, and how to budget for a support or lead-generation bot.",
    category: "Costs",
    updated: "2026-10-22",
    readingMinutes: 5,
    sections: [
      {
        heading: "The two pricing models",
        paragraphs: [
          "Subscriptions charge a fixed monthly fee, often per seat or per bot, with usage limits that are hard to predict. Usage-based pricing charges for what is consumed, usually tokens or answers. Subscriptions are easier to budget; usage pricing is cheaper when volume is low and can grow with success.",
          "The hidden cost in both models is content work. Someone has to gather, clean, and review the knowledge base, write the instructions, test the answers, and maintain it. That is usually more work than installing the widget.",
        ],
      },
      {
        heading: "What drives usage cost",
        paragraphs: [
          "Longer answers, larger knowledge retrievals, and more conversation turns all consume more tokens. A support bot answering policy questions is usually cheaper per conversation than a sales assistant that writes long, personalized proposals.",
          "Watch for answers that retrieve too much context. A focused knowledge base with good chunking is cheaper and more accurate than dumping every page into every prompt.",
        ],
        bullets: [
          "Number of conversations and turns",
          "Length of the retrieved context",
          "Model choice and fallback behaviour",
          "Whether summaries or translations are generated",
          "Spam and abuse controls that prevent wasted usage",
        ],
      },
      {
        heading: "A realistic budget",
        paragraphs: [
          "For a small site with steady questions, a Starter pack at ₹499 covers roughly 500 answers. A busy site might use the Growth pack at ₹1,499 for roughly 2,500 answers. Because credits do not expire, you can start small and top up as usage grows.",
          "If the chatbot needs custom workflows, CRM integration, or a bespoke interface, budget for project work. Bitecodes' AI integration service starts at $1,200, and discovery confirms the scope before a fixed quote.",
        ],
      },
    ],
    faqs: [
      {
        question: "Are there monthly fees?",
        answer:
          "Bitecodes' chatbot uses prepaid credits with no monthly subscription and no automatic renewal. Hosting, model usage, and any third-party services are covered by the credit model or billed separately depending on the setup.",
      },
      {
        question: "What happens when credits run out?",
        answer:
          "The widget stops answering until you top up, and the dashboard shows the balance. Configure a low-credit warning so a busy period does not silently turn the bot off.",
      },
      {
        question: "Is a chatbot cheaper than human support?",
        answer:
          "For repetitive, documented questions, often yes. For complex or emotional issues, a chatbot that frustrates the visitor can cost more in lost goodwill. Use it for triage and clear answers, with an obvious path to a person.",
      },
    ],
    related: [
      "how-to-embed-an-ai-chatbot-on-a-website",
      "what-makes-a-website-convert",
      "how-much-does-a-website-cost",
    ],
    cta: {
      label: "See chatbot pricing",
      href: "/ai-chatbot",
      description:
        "Start with a prepaid pack, embed the widget, and top up only when usage grows.",
    },
  },
  {
    slug: "how-to-build-an-mvp-in-8-weeks",
    question: "How do you build an MVP in 8 weeks?",
    shortAnswer:
      "Build an MVP in eight weeks by fixing one user and one job, writing a short scope with explicit exclusions, designing only the screens that job needs, building in weekly increments, and launching to real users before polishing anything else. Eight weeks is realistic for a single-role product without complex billing or heavy integrations; it is not realistic for a multi-tenant platform with several roles.",
    metaDescription:
      "An eight-week MVP plan with scope rules, weekly milestones, and the features to defer so the first release actually ships.",
    category: "Delivery",
    updated: "2026-10-22",
    readingMinutes: 6,
    sections: [
      {
        heading: "Weeks 1–2: Decide and scope",
        paragraphs: [
          "Write one sentence describing the user and the job. Then write the smallest flow that completes it end to end. List everything else under 'later' and treat that list as closed for the release. Choose the data you need, the accounts, and the one integration that is unavoidable.",
          "Produce a clickable or written flow and a data model. Get agreement on what done means for the first release. This is the week where a vague idea becomes buildable.",
        ],
      },
      {
        heading: "Weeks 3–6: Build the path",
        paragraphs: [
          "Build the happy path first, then the error states that would block a real user: failed payment, expired session, duplicate record, missing email. Keep a staging environment available from week one so feedback happens against running software.",
          "Ship a working slice every week. A weekly demo catches misunderstandings early and keeps the scope honest. Do not start secondary features until the core job works end to end.",
        ],
        bullets: [
          "Week 3: authentication, data model, first screen",
          "Week 4: core workflow, happy path",
          "Week 5: error states, notifications, admin visibility",
          "Week 6: payments or the critical integration, if in scope",
        ],
      },
      {
        heading: "Weeks 7–8: Harden and launch",
        paragraphs: [
          "Test the critical paths, fix the defects that block the job, and prepare deployment, backups, and monitoring. Write a short handover: how to deploy, where the secrets live, and what to check when something breaks.",
          "Launch to a small group first. Watch what they actually do, not what they say in feedback. The next release should be driven by observed friction, not by the deferred feature list.",
        ],
      },
    ],
    faqs: [
      {
        question: "What if we cannot decide on scope?",
        answer:
          "Pick the workflow that directly produces the value and defer the rest. If the team cannot agree on one job, the product is not ready for an eight-week build; a discovery sprint is the better next step.",
      },
      {
        question: "Can AI tools make this faster?",
        answer:
          "AI can speed up drafting and boilerplate, but it does not remove the need for decisions, testing, and integration work. Treat any timeline that assumes AI eliminates engineering as marketing.",
      },
      {
        question: "What should we defer?",
        answer:
          "Secondary roles, elaborate analytics, native apps, most integrations, localization, and visual polish that does not affect comprehension. Defer anything that does not help the first user complete the first job.",
      },
    ],
    related: [
      "how-long-does-a-saas-mvp-take",
      "custom-software-vs-off-the-shelf",
      "in-house-vs-agency-development",
    ],
    cta: {
      label: "Scope an eight-week build",
      href: "/contact",
      description:
        "Tell us the user and the job. We will reply with a realistic scope, milestones, and a fixed quote.",
    },
  },
  {
    slug: "in-house-vs-agency-development",
    question: "Should you build in-house or hire an agency?",
    shortAnswer:
      "Build in-house when software is core to the business, you need continuous product work, and you can recruit and retain a team. Hire an agency when you need a defined outcome quickly, lack specialist skills, or want to avoid a long hiring cycle. Many companies do both: an in-house product owner with an external engineering team, then gradually internalise the roles that matter most.",
    metaDescription:
      "An honest comparison of in-house teams and agencies: cost, speed, control, continuity, and the hybrid model that often works best.",
    category: "Hiring",
    updated: "2026-10-22",
    readingMinutes: 5,
    sections: [
      {
        heading: "The real differences",
        paragraphs: [
          "An agency brings a ready team, established process, and a defined scope. You pay for flexibility and speed rather than building permanent capacity. An in-house team brings deep context and can iterate continuously, but recruiting, onboarding, and retaining engineers takes months and carries fixed cost.",
          "Cost comparisons often go wrong because they compare a day rate with a salary. Add recruitment fees, benefits, equipment, management time, and the risk of a vacancy. Then compare against an agency's fixed project price and the internal time needed to manage it.",
        ],
        bullets: [
          "Speed to start: agency usually faster",
          "Context and continuity: in-house usually stronger",
          "Flexibility to stop or change: agency usually easier",
          "Long-term product iteration: in-house usually better",
          "Specialist skills: agency usually broader",
          "Fixed cost versus variable cost: opposite trade-offs",
        ],
      },
      {
        heading: "When an agency is the better choice",
        paragraphs: [
          "Choose an agency for a defined build with a clear outcome, a launch deadline, or a skill you do not have. It is also the sensible choice when you are testing a product idea and should not hire a permanent team before demand is proven.",
          "Protect yourself with the basics: written scope, repository access, ownership of code and accounts, milestone payments, and a handover. Those terms make it possible to move in-house later without starting over.",
        ],
      },
      {
        heading: "The hybrid model",
        paragraphs: [
          "A common and effective structure is a small internal team that owns product decisions, domain knowledge, and vendor management, supported by an external engineering team for delivery. The internal person does not need to code, but must be able to define priorities and evaluate trade-offs.",
          "Plan the transition early. Documentation, tests, and clean deployment are what make an external build maintainable by an internal team. Without them, 'we will bring it in-house later' rarely happens smoothly.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is an agency cheaper than hiring?",
        answer:
          "For a short, defined project, usually yes, because you do not carry recruitment and idle time. For continuous product work over years, a capable in-house team can be cheaper and faster. The comparison depends on duration and how much specialist skill you need.",
      },
      {
        question: "How do we keep control of the work?",
        answer:
          "Insist on repository access from day one, a written scope, weekly demos, and ownership of all accounts. Control comes from visibility and contract terms, not from being in the same office.",
      },
      {
        question: "Can we hire the agency's developers later?",
        answer:
          "That depends on the contract and the individuals. Discuss it upfront. Even if you do not hire them, a proper handover with documentation and tests makes an internal transition feasible.",
      },
    ],
    related: [
      "how-to-choose-a-software-development-company",
      "custom-software-vs-off-the-shelf",
      "how-long-does-a-saas-mvp-take",
    ],
    cta: {
      label: "Compare the trade-offs",
      href: "/book-a-call",
      description:
        "A short call is usually enough to tell whether a defined build, a discovery sprint, or an internal hire is the right next step.",
    },
  },
  {
    slug: "what-makes-a-website-convert",
    question: "What makes a website convert visitors into customers?",
    shortAnswer:
      "A website converts when a visitor can understand the offer, believe it, and take the next step without friction. That means a clear headline, specific proof, transparent pricing or expectations, fast pages, and one obvious action. Design matters, but clarity and trust matter more than novelty.",
    metaDescription:
      "The practical elements that turn website visitors into enquiries: message clarity, proof, friction, speed, and a single next step.",
    category: "Delivery",
    updated: "2026-10-22",
    readingMinutes: 5,
    sections: [
      {
        heading: "Clarity before cleverness",
        paragraphs: [
          "A visitor should know what you do, who it is for, and what to do next within a few seconds. A clever headline that requires interpretation loses people who are not in the mood to decode it. State the outcome in plain language and support it with one specific sentence about how you deliver it.",
          "Every section should answer a question a real buyer has: What will this cost? How long will it take? What happens after I enquire? What if it does not work? Vague reassurance is not an answer.",
        ],
      },
      {
        heading: "Proof that is specific",
        paragraphs: [
          "Testimonials with a name, role, and a concrete result are stronger than logos without context. Case studies should state the problem, the constraint, what was built, and the outcome. If you cannot publish a client name, describe the situation precisely and explain why it is anonymised.",
          "Transparency is proof too. Published starting prices, a written quote commitment, and a clear process reduce the perceived risk of getting in touch.",
        ],
        bullets: [
          "A clear primary action on every page",
          "Specific proof: names, numbers, and outcomes",
          "Transparent pricing or a clear path to a quote",
          "Fast loading and a usable mobile layout",
          "Short forms that ask only what is needed",
          "A visible answer to 'what happens next?'",
        ],
      },
      {
        heading: "Remove friction from the next step",
        paragraphs: [
          "The conversion is not the design; it is the moment a visitor decides to act. Reduce the number of fields, explain what happens after submission, and make the response time explicit. Offer a low-commitment option such as a free audit or a 30-minute call for people who are not ready to buy.",
          "Then measure the path, not just the page. Connect form submissions and calls to the pages that produced them, and review the questions people ask before converting. Those questions are the raw material for the next content and copy improvements.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do more animations increase conversions?",
        answer:
          "Motion can support hierarchy and make a page feel considered, but it cannot fix an unclear offer. Use it sparingly and respect reduced-motion settings. A fast, legible page with a clear action beats a decorative one.",
      },
      {
        question: "How many calls to action should a page have?",
        answer:
          "One primary action, repeated at natural points, is usually enough. Secondary actions should be genuinely lower commitment, not competing buttons that split attention.",
      },
      {
        question: "How do we know what to improve first?",
        answer:
          "Look at where people leave, what they ask before converting, and which pages produce enquiries. Fix clarity and trust gaps before testing button colours. Small copy changes often outperform cosmetic experiments.",
      },
    ],
    related: [
      "what-does-a-technical-audit-include",
      "how-much-does-a-website-cost",
      "how-to-get-found-by-ai-search",
    ],
    cta: {
      label: "Find the leaks",
      href: "/revenue-leak-calculator",
      description:
        "Estimate how much traffic and revenue your current conversion rate leaves on the table.",
    },
  },
  {
    slug: "how-to-reduce-website-cost",
    question: "How can you reduce the cost of a website without ruining it?",
    shortAnswer:
      "Reduce website cost by narrowing scope, supplying your own content and brand assets, reusing a proven layout instead of commissioning a bespoke visual system, and launching with one clear conversion path. Do not cut accessibility, performance, testing, or handover; those are the parts that become expensive to fix later.",
    metaDescription:
      "Practical ways to lower website cost without creating expensive rework, with the cuts that are safe and the ones to avoid.",
    category: "Costs",
    updated: "2026-10-22",
    readingMinutes: 5,
    sections: [
      {
        heading: "Cuts that genuinely save money",
        paragraphs: [
          "Fewer pages, fewer templates, and fewer integrations reduce cost directly. So does content readiness: if the copy and images are ready before design, the project does not pay for someone else to chase or structure them.",
          "A restrained, type-led design system can look more expensive than a busy custom layout while costing less to build and maintain. Motion, illustrations, and custom photography are optional; clarity is not.",
        ],
        bullets: [
          "Start with five pages, not fifteen",
          "Use one reusable page template",
          "Supply final copy and images",
          "Defer integrations until a real workflow needs them",
          "Launch with one primary conversion path",
        ],
      },
      {
        heading: "Cuts that cost more later",
        paragraphs: [
          "Skipping responsive design, accessibility, basic SEO, analytics, or a handover saves money on the invoice and creates rework after launch. A site that is hard to use on a phone or invisible to crawlers is not cheaper; it just moves the cost.",
          "Beware of a low quote that excludes testing, deployment, or code ownership. Those exclusions are where the hidden cost lives. Ask for the complete scope and the change-request rate before signing.",
        ],
      },
      {
        heading: "A staged approach",
        paragraphs: [
          "Build the smallest credible site first, measure how visitors use it, then invest in the pages and features that earn their keep. This is usually cheaper than guessing at a large site upfront and rebuilding the parts that do not work.",
          "Bitecodes' Launch package starts at $500 for a focused marketing site, with a written fixed quote that separates the included scope from later phases. That structure makes it possible to start small without locking out the next step.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is a template cheaper than custom design?",
        answer:
          "Usually, yes. A well-chosen template with focused content can be a sensible start. The cost returns if the template needs heavy customisation or cannot support the content structure you need.",
      },
      {
        question: "Can we add pages later?",
        answer:
          "Yes, if the site is built with reusable templates and a content model. Confirm that the build includes a way for you to add pages without a developer for every change.",
      },
      {
        question: "What is the smallest useful website?",
        answer:
          "A clear home page, one page per core service, proof, pricing or a pricing path, and a contact or booking action. Five to seven pages is often enough to start.",
      },
    ],
    related: [
      "how-much-does-a-website-cost",
      "what-makes-a-website-convert",
      "custom-software-vs-off-the-shelf",
    ],
    cta: {
      label: "Get a fixed quote",
      href: "/contact",
      description:
        "Tell us the smallest version that would be useful. We will quote that scope, not a larger one.",
    },
  },
];

export function getAnswer(slug: string) {
  return answerPages.find((page) => page.slug === slug);
}

export function relatedAnswers(page: AnswerPage) {
  return page.related
    .map((slug) => getAnswer(slug))
    .filter((related): related is AnswerPage => Boolean(related));
}

export const answerCategories: AnswerCategory[] = [
  "Costs",
  "Hiring",
  "AI search",
  "Delivery",
  "Products",
];
