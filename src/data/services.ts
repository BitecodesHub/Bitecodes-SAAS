import {
  AppWindow,
  Boxes,
  BrainCircuit,
  Building2,
  Cloud,
  Code2,
  Compass,
  Gauge,
  GitBranch,
  Globe,
  Layers,
  LifeBuoy,
  PenTool,
  PlugZap,
  Rocket,
  Server,
  Smartphone,
  Webhook,
  Workflow,
} from "lucide-react";
import type { Faq, Service } from "@/types/content";
import { formatStartingPrice, getPricing } from "@/lib/pricing";

/**
 * Published starting prices live in src/lib/pricing.ts. Building the pricing
 * answer from the same source keeps the FAQ and the price table aligned.
 */
function pricingFaq(slug: string, label: string): Faq {
  const pricing = getPricing(slug);
  if (!pricing) {
    throw new Error(`Missing pricing entry for service: ${slug}`);
  }
  return {
    question: `What does ${label} cost?`,
    answer: `Published ${label} engagements start ${formatStartingPrice(pricing)}. After a short discovery conversation you receive a written fixed quote with milestones, assumptions, and exclusions, so the price is agreed before work starts.`,
  };
}

export const services: Service[] = [
  {
    slug: "website-development",
    title: "Website Development",
    tagline: "Marketing sites that load quickly and convert.",
    description:
      "High-performance marketing and corporate websites built on modern frameworks, tuned for Core Web Vitals, SEO, and accessibility. Every site ships as a fast, static-first experience that ranks well and feels effortless.",
    icon: Globe,
    features: [
      "Static-first rendering for fast page loads",
      "SEO, structured data, and OG covered end to end",
      "WCAG AA accessibility built into the process",
      "CMS-ready architecture for future content teams",
    ],
    stack: ["nextjs", "typescript", "react"],
    category: "Engineering",
    deliverables: [
      "A written scope, sitemap, and page-by-page content plan",
      "Responsive page designs approved before build",
      "A production website built on Next.js and TypeScript",
      "On-page SEO, metadata, sitemap, and structured data",
      "Accessibility and performance checks against agreed criteria",
      "Deployment, analytics setup, and an editor handover guide",
    ],
    timeline:
      "Typically 2 to 4 weeks for a focused marketing site, and 6 to 10 weeks for a larger multi-page build.",
    idealFor: [
      "Small and mid-sized service businesses replacing an outdated website",
      "Clinics, studios, and professional firms that need booking and enquiry flows",
      "Teams that need a fast, editable site without a full-time developer",
    ],
    outcomes: [
      "Visitors can find services, understand pricing, and enquire without friction.",
      "The site loads quickly on mobile connections and remains easy to update.",
      "Search engines and answer engines can read the page structure and metadata.",
      "Your team can publish content without waiting on a developer.",
    ],
    faqs: [
      {
        question: "What is included in a website development project?",
        answer:
          "A typical project covers discovery, sitemap and content planning, responsive design, front-end and back-end build, on-page SEO, accessibility checks, deployment, and a handover guide. The written quote lists every deliverable and exclusion before work begins.",
      },
      {
        question: "How long does a website take to build?",
        answer:
          "A focused marketing site typically takes 2 to 4 weeks, while a larger multi-page build usually takes 6 to 10 weeks. Timelines depend on content readiness, feedback speed, and integrations. We agree a milestone plan in writing before work starts.",
      },
      {
        question:
          "Can you update our existing website instead of rebuilding it?",
        answer:
          "Yes. We can improve an existing site when the foundation is sound, or rebuild it when the platform is holding it back. The free website audit gives you a clear recommendation before you commit to either path.",
      },
      pricingFaq("website-development", "website development"),
    ],
  },
  {
    slug: "web-applications",
    title: "Web Applications",
    tagline: "Complex, data-rich products that stay fast.",
    description:
      "Interactive web applications with real-time data, role-based access, and rich dashboards. We architect for scale from day one so the product grows without rewrites.",
    icon: AppWindow,
    features: [
      "Component-driven design systems",
      "Real-time and offline-capable patterns",
      "Granular roles and permissions",
      "Observability and error tracking",
    ],
    stack: ["nextjs", "react", "nodejs", "postgresql"],
    category: "Engineering",
    deliverables: [
      "User journeys, wireframes, and a working prototype",
      "A responsive application with role-based access",
      "Database schema, API layer, and background jobs",
      "Admin screens for the operations your team runs",
      "Automated tests and a deployment pipeline",
      "Technical documentation and a handover session",
    ],
    timeline:
      "Typically 6 to 12 weeks for a first production release, depending on roles, integrations, and data migration.",
    idealFor: [
      "Service businesses moving an internal process out of spreadsheets",
      "Operations teams that need one shared view of customers and work",
      "Startups validating a product with real users",
    ],
    outcomes: [
      "Staff work from one system instead of several disconnected tools.",
      "Permissions and audit history make sensitive actions traceable.",
      "The application can add new roles and workflows without a rewrite.",
      "Your team can see how the product is used and where it stalls.",
    ],
    faqs: [
      {
        question:
          "What is the difference between a website and a web application?",
        answer:
          "A website presents information and invites an enquiry. A web application lets signed-in users create, edit, and act on data, often with roles, dashboards, and integrations. Many projects include both: a public site plus a private application behind it.",
      },
      {
        question: "Can you work with our existing systems?",
        answer:
          "Yes. We integrate with existing databases, CRMs, accounting tools, and internal APIs. Where no API exists, we agree a safe integration method such as a scheduled import or a controlled export before build.",
      },
      {
        question: "How do you handle data migration?",
        answer:
          "We audit the source data, define the target schema, and run a trial migration before the production cutover. You review the results, and we keep a rollback path until the new system is confirmed.",
      },
      pricingFaq("web-applications", "web application development"),
    ],
  },
  {
    slug: "enterprise-software",
    title: "Enterprise Software",
    tagline: "Mission-critical systems built to last.",
    description:
      "Robust enterprise platforms engineered for reliability, security, and compliance. We bring disciplined architecture, audit trails, and integration with existing systems of record.",
    icon: Building2,
    features: [
      "Domain-driven, modular architecture",
      "SSO, RBAC, and audit logging",
      "Legacy and third-party integrations",
      "High-availability deployment topologies",
    ],
    stack: ["java", "spring-boot", "postgresql", "docker"],
    category: "Engineering",
    deliverables: [
      "A written architecture and integration plan",
      "Single sign-on, role-based access, and audit logging",
      "Integration with systems of record and legacy data",
      "Environments for development, staging, and production",
      "Technical documentation and operational runbooks",
      "Team handover and architecture walkthrough",
    ],
    timeline:
      "Typically 3 to 6 months for a first release, with delivery in approved milestones rather than one final handover.",
    idealFor: [
      "Enterprise teams replacing a legacy internal system",
      "Organisations that need SSO, audit trails, and formal change control",
      "Operations groups coordinating several departments or sites",
    ],
    outcomes: [
      "Critical processes run on a supported platform with clear ownership.",
      "Access and changes are traceable for internal and external review.",
      "New systems connect to existing records instead of duplicating them.",
      "Your team can operate and extend the platform after handover.",
    ],
    faqs: [
      {
        question: "Can enterprise software be delivered in phases?",
        answer:
          "Yes. We recommend a phased release that puts the highest-value workflow into production first. Each phase has its own acceptance criteria, and later phases build on a platform your team can already use.",
      },
      {
        question: "How do you handle security and compliance requirements?",
        answer:
          "We start from your written requirements and map them to controls such as access management, encryption, logging, and data retention. We do not claim certifications we do not hold. Your security or compliance team reviews the design before build.",
      },
      {
        question: "Will the system integrate with our legacy tools?",
        answer:
          "We assess each legacy system for an API, database access, or file-based exchange. Where direct integration is unsafe, we use a controlled middle layer. The integration plan and its limits are documented before development starts.",
      },
      pricingFaq("enterprise-software", "enterprise software"),
    ],
  },
  {
    slug: "saas-development",
    title: "SaaS Development",
    tagline: "Multi-tenant platforms ready to scale.",
    description:
      "End-to-end SaaS engineering — multi-tenancy, subscription billing, usage metering, and admin tooling — designed so you can onboard your first customer and your thousandth on the same foundation.",
    icon: Layers,
    features: [
      "Multi-tenant data isolation strategies",
      "Subscription, metering, and entitlements",
      "Self-serve onboarding flows",
      "Admin and analytics back-office",
    ],
    stack: ["nextjs", "nodejs", "postgresql", "aws"],
    category: "Engineering",
    deliverables: [
      "Multi-tenant architecture and data isolation plan",
      "Subscription billing, plans, and entitlement logic",
      "Self-serve sign-up, onboarding, and account settings",
      "Admin console for support and operations",
      "Usage metering and product analytics events",
      "Deployment, monitoring, and a launch checklist",
    ],
    timeline:
      "Typically 8 to 16 weeks for a launch-ready first version, depending on billing, tenancy, and integration complexity.",
    idealFor: [
      "Founders taking a validated idea to a paid first release",
      "Software teams adding a subscription product beside an existing service",
      "Businesses replacing a manual service with a self-serve platform",
    ],
    outcomes: [
      "New customers can sign up, pay, and reach first value without manual setup.",
      "Billing and entitlements follow one consistent source of truth.",
      "Support can see account state, usage, and plan limits in one place.",
      "The platform is ready for new plans and tenant volumes without a rebuild.",
    ],
    faqs: [
      {
        question: "What does multi-tenant mean for our product?",
        answer:
          "Multi-tenant means one application serves many customer organisations while keeping their data separate. We choose an isolation approach based on your security needs, then document how tenants, users, and permissions are separated.",
      },
      {
        question: "Can you integrate subscription billing?",
        answer:
          "Yes. We integrate providers such as Stripe or Razorpay for plans, trials, invoices, and payment events. We also build the entitlement logic that decides what each account can access, and test upgrades, downgrades, and failed payments.",
      },
      {
        question: "Do we need a full product team to start?",
        answer:
          "No. A small team can launch a focused first version. We handle product design, engineering, and delivery, then document the architecture and hand over the code so your team can grow the product.",
      },
      pricingFaq("saas-development", "SaaS development"),
    ],
  },
  {
    slug: "custom-software",
    title: "Custom Software",
    tagline: "Bespoke systems for problems off the shelf cannot solve.",
    description:
      "When generic tools fall short, we build exactly what your operation needs — internal platforms, workflow engines, and specialized tooling shaped around your processes, not the other way around.",
    icon: Boxes,
    features: [
      "Requirements discovery and process mapping",
      "Tailored data models and workflows",
      "Integrations with your existing stack",
      "Documentation and team handover",
    ],
    stack: ["java", "spring-boot", "python", "react"],
    category: "Engineering",
    deliverables: [
      "A process map of the current workflow and its exceptions",
      "A prioritised scope with measurable acceptance criteria",
      "A tailored data model and workflow engine",
      "Integrations with the tools your team already uses",
      "Admin controls, reports, and audit history",
      "Documentation and a team training session",
    ],
    timeline:
      "Typically 4 to 10 weeks for a focused internal tool, and longer for multi-team systems with complex approvals.",
    idealFor: [
      "Operations teams held back by spreadsheets and manual handoffs",
      "Businesses whose workflow does not fit a standard product",
      "Teams that need one tool shaped around an existing process",
    ],
    outcomes: [
      "The workflow lives in one system with clear states and owners.",
      "Manual re-entry and duplicate records are reduced.",
      "Reports reflect the same data that staff work from each day.",
      "The tool can change as the process changes.",
    ],
    faqs: [
      {
        question:
          "When should we build custom software instead of buying a product?",
        answer:
          "Build when the workflow is central to your advantage, no product fits without costly workarounds, or integration and data ownership matter. Buy when a standard tool already covers the process well and the cost of switching is low.",
      },
      {
        question:
          "How do you keep a custom build from becoming difficult to maintain?",
        answer:
          "We use a modular architecture, write automated tests, document decisions, and avoid unnecessary dependencies. Code lives in your repository from day one, so your team can review it throughout the project rather than discovering it at handover.",
      },
      {
        question: "Can the system grow with the business?",
        answer:
          "Yes, when the data model and boundaries are designed for it. We separate core domain logic from presentation and integrations, which lets new roles, reports, and workflows arrive without rebuilding the foundation.",
      },
      pricingFaq("custom-software", "custom software"),
    ],
  },
  {
    slug: "rest-api-development",
    title: "REST API Development",
    tagline: "Clean, documented, versioned APIs.",
    description:
      "Well-designed REST APIs with predictable contracts, strong validation, and first-class documentation. Built to be consumed by web, mobile, and partner integrations alike.",
    icon: Webhook,
    features: [
      "OpenAPI specifications and docs",
      "Authentication, rate limiting, and versioning",
      "Contract testing and validation",
      "Pagination, filtering, and caching",
    ],
    stack: ["spring-boot", "nodejs", "java", "postgresql"],
    category: "Engineering",
    deliverables: [
      "An OpenAPI specification agreed before implementation",
      "Authentication, rate limiting, and versioning",
      "Validation, error handling, and pagination",
      "Automated contract and integration tests",
      "Developer documentation and example requests",
      "Deployment and monitoring for the API",
    ],
    timeline:
      "Typically 2 to 6 weeks for a focused API, depending on the number of resources and integrations.",
    idealFor: [
      "Teams exposing data to partners, mobile apps, or internal services",
      "Products replacing fragile point-to-point integrations",
      "Platforms that need a stable, documented contract",
    ],
    outcomes: [
      "Consumers build against a documented, predictable contract.",
      "Failures return clear, consistent errors instead of silent gaps.",
      "New versions can ship without breaking existing clients.",
      "Your team can monitor usage and investigate issues quickly.",
    ],
    faqs: [
      {
        question: "Do you design the API before writing code?",
        answer:
          "Yes. We agree the resources, request and response shapes, authentication, and error model in an OpenAPI specification first. That contract is reviewed before implementation, so client teams can plan against something stable.",
      },
      {
        question: "How do you handle API versioning?",
        answer:
          "We version APIs when a change would break existing consumers. Additive changes ship within the current version, while breaking changes receive a new version with a documented migration window and deprecation notice.",
      },
      {
        question: "Can you document and support partner integrations?",
        answer:
          "Yes. We provide developer documentation, example requests, sandbox guidance, and a clear support path. We can also review partner implementations and add contract tests so integrations stay reliable as the API evolves.",
      },
      pricingFaq("rest-api-development", "REST API development"),
    ],
  },
  {
    slug: "frontend-development",
    title: "Frontend Development",
    tagline: "Interfaces that feel as good as they look.",
    description:
      "Pixel-precise, accessible frontends with reusable design systems and smooth interactions. We obsess over performance budgets so the polish never costs you speed.",
    icon: Code2,
    features: [
      "Design systems and component libraries",
      "Performance budgets and Core Web Vitals",
      "Accessibility and keyboard support",
      "Motion that respects reduced-motion",
    ],
    stack: ["react", "nextjs", "typescript"],
    category: "Product & Design",
    deliverables: [
      "A component library and design tokens",
      "Responsive layouts for the agreed breakpoints",
      "Accessible interactions with keyboard support",
      "Performance budgets and measured page results",
      "Integration with your APIs and content sources",
      "Storybook or equivalent component documentation",
    ],
    timeline:
      "Typically 2 to 6 weeks for a focused interface, and longer for a full product design system.",
    idealFor: [
      "Teams with a design system that needs faithful implementation",
      "Products whose interface feels slow or inconsistent",
      "Marketing teams that need reusable, on-brand page components",
    ],
    outcomes: [
      "The interface looks and behaves consistently across pages.",
      "Keyboard and screen-reader users can complete core tasks.",
      "Page weight and rendering stay within an agreed budget.",
      "New screens reuse existing components instead of starting over.",
    ],
    faqs: [
      {
        question: "Can you implement a design we already have?",
        answer:
          "Yes. We review the files, agree the component inventory, and build the interface to match. Where the design creates accessibility or performance problems, we raise them early and propose a practical alternative for your approval.",
      },
      {
        question: "Do you build design systems or only pages?",
        answer:
          "Both. A design system engagement covers tokens, components, documentation, and usage rules. A page engagement can use an existing system or a smaller shared component set, depending on what your team needs to maintain.",
      },
      {
        question: "How do you test accessibility?",
        answer:
          "We combine automated checks with keyboard and screen-reader testing on representative pages. We agree the target standard before work starts, document known exceptions, and fix issues against the agreed acceptance criteria before launch.",
      },
      pricingFaq("frontend-development", "frontend development"),
    ],
  },
  {
    slug: "backend-development",
    title: "Backend Development",
    tagline: "Reliable services and solid data foundations.",
    description:
      "Scalable backend services with clean domain logic, resilient data layers, and observability built in. We design APIs and data models that age gracefully.",
    icon: Server,
    features: [
      "Service and domain architecture",
      "Relational and document data modeling",
      "Background jobs and queues",
      "Monitoring, logging, and alerting",
    ],
    stack: ["spring-boot", "nodejs", "python", "mongodb"],
    category: "Engineering",
    deliverables: [
      "A service and data architecture document",
      "Relational or document database schemas and migrations",
      "API endpoints with validation and access control",
      "Background jobs and queue processing",
      "Logging, metrics, and alerting",
      "Operational documentation and handover",
    ],
    timeline:
      "Typically 3 to 8 weeks for a focused backend, depending on integrations, data volume, and reliability requirements.",
    idealFor: [
      "Products that need a reliable service behind a web or mobile front end",
      "Teams replacing manual batch processes with scheduled jobs",
      "Platforms preparing for growth in traffic or data volume",
    ],
    outcomes: [
      "Core logic lives in one tested service rather than scattered scripts.",
      "Data changes are validated and traceable.",
      "Background work retries safely instead of failing silently.",
      "Your team can see service health and investigate incidents.",
    ],
    faqs: [
      {
        question: "Which databases do you work with?",
        answer:
          "We work with PostgreSQL, MySQL, MongoDB, and Redis, and choose based on the data model, consistency needs, and query patterns. The decision, including its trade-offs, is documented before implementation rather than chosen by habit.",
      },
      {
        question: "How do you handle background jobs and failures?",
        answer:
          "We use a queue with retries, backoff, and idempotent handlers so a failed job can run again without duplicating work. Failed jobs are logged and surfaced for review rather than disappearing silently.",
      },
      {
        question: "Can you take over an existing backend?",
        answer:
          "Yes. We start with a code and infrastructure review, map the data and dependencies, and identify immediate risks. We then agree a stabilisation plan before adding features, so changes do not make existing problems harder to see.",
      },
      pricingFaq("backend-development", "backend development"),
    ],
  },
  {
    slug: "mobile-app-development",
    title: "Mobile App Development",
    tagline: "Cross-platform apps with native feel.",
    description:
      "Mobile experiences that share a codebase without sacrificing quality — fast, offline-aware, and tightly integrated with your backend and notifications.",
    icon: Smartphone,
    features: [
      "Cross-platform iOS and Android",
      "Offline-first data sync",
      "Push notifications and deep links",
      "App store delivery support",
    ],
    stack: ["react", "typescript", "nodejs"],
    category: "Engineering",
    deliverables: [
      "A mobile product flow and interactive prototype",
      "A cross-platform app for iOS and Android",
      "Offline handling and data synchronisation",
      "Push notifications and deep links",
      "Store listing assets and submission support",
      "Crash reporting and release documentation",
    ],
    timeline:
      "Typically 6 to 12 weeks for a first store release, depending on device features, offline behaviour, and review requirements.",
    idealFor: [
      "Service businesses whose customers need bookings or updates on the move",
      "Products extending an existing web platform to mobile",
      "Field teams that work with unreliable connectivity",
    ],
    outcomes: [
      "Customers can complete core tasks from a phone without a browser.",
      "The app behaves predictably when connectivity drops.",
      "Your team can release updates through a repeatable build process.",
      "Crashes and usage patterns are visible after launch.",
    ],
    faqs: [
      {
        question: "Should we build native or cross-platform?",
        answer:
          "Cross-platform suits most business apps because it shares logic and interface work across iOS and Android. Native is worth the extra cost when the product depends on deep device features, high-performance graphics, or platform-specific behaviour. We recommend one after reviewing the requirements.",
      },
      {
        question: "Do you handle app store submission?",
        answer:
          "Yes. We prepare the build, listing assets, privacy details, and release notes, then support submission to the Apple App Store and Google Play. Account ownership remains with you, and we document the release process for future updates.",
      },
      {
        question: "Can the app work offline?",
        answer:
          "Yes, when the workflow allows it. We design local storage and synchronisation rules around your data, including conflict handling and retry behaviour. The offline scope is agreed in writing because it affects testing and timeline.",
      },
      pricingFaq("mobile-app-development", "mobile app development"),
    ],
  },
  {
    slug: "cloud-solutions",
    title: "Cloud Solutions",
    tagline: "Cloud architecture that fits your budget and scale.",
    description:
      "Cloud-native architecture on AWS and Azure — right-sized, cost-aware, and secure. We design infrastructure that scales with demand and stays observable.",
    icon: Cloud,
    features: [
      "AWS and Azure architecture",
      "Cost optimization and autoscaling",
      "Networking, security, and IAM",
      "Backups and disaster recovery",
    ],
    stack: ["aws", "azure", "docker", "linux"],
    category: "Cloud & Operations",
    deliverables: [
      "A cloud architecture and cost estimate",
      "Networking, identity, and access configuration",
      "Infrastructure as code for repeatable environments",
      "Backup, recovery, and monitoring setup",
      "Security baseline and documented exceptions",
      "Runbook and team walkthrough",
    ],
    timeline:
      "Typically 2 to 6 weeks for a new environment or migration, depending on the number of services and compliance reviews.",
    idealFor: [
      "Teams moving a production system to AWS or Azure",
      "Businesses whose cloud bill has grown without clear ownership",
      "Products that need reliable backups and recovery plans",
    ],
    outcomes: [
      "Environments can be recreated from code rather than memory.",
      "Access follows least privilege and is easy to review.",
      "Costs are visible by service and owner.",
      "Recovery steps are documented and tested.",
    ],
    faqs: [
      {
        question: "Can you reduce our cloud costs?",
        answer:
          "We review usage, storage, networking, and commitment options, then recommend changes with their risk and expected effect. Savings depend on the current setup. We report measured before-and-after costs rather than promising a fixed percentage.",
      },
      {
        question: "Do you migrate existing systems to the cloud?",
        answer:
          "Yes. We assess dependencies, plan the migration order, and choose between rehosting and rebuilding where each is appropriate. A trial migration and rollback plan reduce risk before production cutover.",
      },
      {
        question: "How do you handle backups and disaster recovery?",
        answer:
          "We define what must be protected, how quickly it must return, and how much data loss is acceptable. Backups are automated, access is restricted, and restore tests are scheduled so the plan is proven rather than assumed.",
      },
      pricingFaq("cloud-solutions", "cloud solutions"),
    ],
  },
  {
    slug: "devops",
    title: "DevOps",
    tagline: "Ship confidently, many times a day.",
    description:
      "CI/CD pipelines, infrastructure as code, and container orchestration that turn releases from events into routine. Less firefighting, more shipping.",
    icon: GitBranch,
    features: [
      "CI/CD pipeline design",
      "Infrastructure as code",
      "Containerization and orchestration",
      "Observability and incident readiness",
    ],
    stack: ["docker", "aws", "linux", "git"],
    category: "Cloud & Operations",
    deliverables: [
      "A CI/CD pipeline with review and approval gates",
      "Infrastructure as code for every environment",
      "Container builds and image scanning",
      "Monitoring, alerting, and incident runbooks",
      "Release and rollback procedures",
      "Team documentation and training",
    ],
    timeline:
      "Typically a 4 to 8 week setup, then an ongoing monthly retainer for maintenance and improvement.",
    idealFor: [
      "Teams releasing manually or with long, risky deploy days",
      "Organisations running several services without consistent pipelines",
      "Engineering leaders who need clearer operational visibility",
    ],
    outcomes: [
      "Releases follow the same path every time.",
      "Failures are detected and rolled back without guesswork.",
      "Infrastructure changes are reviewed like code.",
      "The team spends less time on repetitive release work.",
    ],
    faqs: [
      {
        question: "What does a DevOps retainer include?",
        answer:
          "The retainer covers pipeline maintenance, infrastructure changes, monitoring review, security patching, and agreed improvement work. The monthly scope and response targets are written into the agreement, and work is prioritised with your engineering lead.",
      },
      {
        question: "Can you work with our current tools?",
        answer:
          "Yes. We work with GitHub Actions, GitLab CI, Jenkins, Terraform, Docker, Kubernetes, and the major cloud platforms. We improve the existing path where it is sound rather than replacing tools for their own sake.",
      },
      {
        question: "How quickly can you respond to a production issue?",
        answer:
          "Response targets depend on the support agreement. Retainer clients receive the targets published on our guarantees page. Outside those hours, we agree an escalation path for critical releases before it is needed.",
      },
      pricingFaq("devops", "DevOps"),
    ],
  },
  {
    slug: "ai-integration",
    title: "AI Integration",
    tagline: "Practical AI woven into real products.",
    description:
      "We embed large language models, retrieval, and agentic workflows into your product where they create measurable value — not as a gimmick, but as a feature your users feel.",
    icon: BrainCircuit,
    features: [
      "LLM and RAG integrations",
      "Agentic and tool-using workflows",
      "Evaluation and guardrails",
      "Cost and latency optimization",
    ],
    stack: ["ai-integration", "python", "nodejs"],
    category: "AI & Automation",
    deliverables: [
      "A use-case assessment and success criteria",
      "Model, retrieval, and prompt architecture",
      "Guardrails and evaluation tests",
      "Integration with your product and data",
      "Cost and latency monitoring",
      "Documentation and an operations guide",
    ],
    timeline:
      "Typically 3 to 8 weeks for a focused feature, depending on data readiness and the review process.",
    idealFor: [
      "Products with a clear task that language models can assist",
      "Teams with documents or knowledge that users struggle to search",
      "Operations groups reviewing repetitive text at volume",
    ],
    outcomes: [
      "AI features solve a defined task rather than adding novelty.",
      "Responses are grounded in approved data with visible limits.",
      "Quality is measured against a test set before release.",
      "Cost and latency stay within an agreed operating range.",
    ],
    faqs: [
      {
        question: "How do you decide whether AI is the right solution?",
        answer:
          "We start with the task, the data, and the cost of a wrong answer. If rules or search solve it more reliably, we say so. AI is recommended when it improves a measurable workflow and the risks can be contained.",
      },
      {
        question: "How do you prevent inaccurate answers?",
        answer:
          "We ground responses in approved sources, constrain the model with clear instructions, and test against representative questions. We also add fallback behaviour and human review where the cost of an error is high. No system removes every error.",
      },
      {
        question: "Where does our data go when we use AI?",
        answer:
          "That depends on the provider and deployment you choose. We document which data leaves your system, where it is processed, and how long it is retained. Sensitive workloads can use providers with stricter terms or a self-hosted model.",
      },
      pricingFaq("ai-integration", "AI integration"),
    ],
  },
  {
    slug: "mcp-servers",
    title: "MCP Servers",
    tagline: "Connect your tools to AI, safely.",
    description:
      "Custom Model Context Protocol servers that expose your systems to AI assistants with the right boundaries — typed tools, scoped permissions, and auditable actions.",
    icon: PlugZap,
    features: [
      "Typed tool and resource design",
      "Scoped, auditable permissions",
      "Integration with existing APIs",
      "Local and hosted deployment",
    ],
    stack: ["mcp-servers", "typescript", "nodejs"],
    category: "AI & Automation",
    deliverables: [
      "A tool and resource design for your systems",
      "A typed MCP server implementation",
      "Scoped permissions and approval boundaries",
      "Audit logging for tool calls",
      "Local and hosted deployment options",
      "Developer documentation and examples",
    ],
    timeline:
      "Typically 2 to 5 weeks for a focused server, depending on the number of tools and systems connected.",
    idealFor: [
      "Teams connecting internal tools to AI assistants",
      "Platforms that want controlled, auditable AI actions",
      "Developers building assistant workflows around existing APIs",
    ],
    outcomes: [
      "Assistants can use your systems through defined, typed tools.",
      "Each action is limited to the permissions you grant.",
      "Tool calls are logged for review and investigation.",
      "The server runs locally or in your own environment.",
    ],
    faqs: [
      {
        question: "What is an MCP server?",
        answer:
          "A Model Context Protocol server exposes tools and resources to an AI assistant through a defined interface. It lets the assistant read or act on your systems without giving it unrestricted access to the underlying platform.",
      },
      {
        question: "How do you control what the assistant can do?",
        answer:
          "Each tool has a narrow purpose and an explicit permission scope. We separate read-only tools from actions that change data, require confirmation for sensitive operations, and log every call for review.",
      },
      {
        question: "Can the server run inside our infrastructure?",
        answer:
          "Yes. We can build a local server for individual use or a hosted server inside your cloud environment. Authentication, network access, and deployment are agreed during design and documented at handover.",
      },
      pricingFaq("mcp-servers", "MCP server development"),
    ],
  },
  {
    slug: "business-automation",
    title: "Business Automation",
    tagline: "Reclaim the hours lost to manual work.",
    description:
      "We map repetitive operational workflows and replace them with reliable automation — integrations, scheduled jobs, and AI-assisted steps that run quietly in the background.",
    icon: Workflow,
    features: [
      "Process discovery and mapping",
      "Workflow and integration automation",
      "AI-assisted document and data handling",
      "Monitoring and human-in-the-loop checks",
    ],
    stack: ["python", "nodejs", "ai-integration"],
    category: "AI & Automation",
    deliverables: [
      "A process map with volumes and failure points",
      "A prioritised automation plan with expected effort",
      "Working integrations between the agreed tools",
      "Scheduled jobs with retries and alerts",
      "Human review steps where judgment is required",
      "Runbook and team training",
    ],
    timeline:
      "Typically 2 to 6 weeks for a first automation, with additional workflows added in short follow-on phases.",
    idealFor: [
      "Teams copying data between spreadsheets, email, and line-of-business tools",
      "Operations groups processing the same documents every week",
      "Businesses that need a reliable handoff between departments",
    ],
    outcomes: [
      "Repetitive steps run on a schedule instead of by memory.",
      "Errors surface with context rather than being found later.",
      "Staff review exceptions instead of re-keying every record.",
      "Each automation is documented and can be changed safely.",
    ],
    faqs: [
      {
        question: "Which processes should we automate first?",
        answer:
          "Start with a process that is frequent, rule-based, and costly when it fails. We map the current steps, measure the volume, and estimate the effort. High-volume work with clear rules usually delivers the clearest return.",
      },
      {
        question: "Will automation remove the need for staff review?",
        answer:
          "Not always. We keep human approval at steps where judgment, exceptions, or customer sensitivity matter. The automation prepares the work, checks the data, and routes exceptions to the right person for a decision.",
      },
      {
        question: "What happens when an automation fails?",
        answer:
          "Failed runs are logged with the input and error, then retried where safe. Critical failures raise an alert, and the runbook explains how to recover. Each workflow has an owner and a documented fallback for the manual path.",
      },
      pricingFaq("business-automation", "business automation"),
    ],
  },
  {
    slug: "deployment",
    title: "Deployment",
    tagline: "From repository to production, repeatably.",
    description:
      "Zero-downtime deployments with sensible environments, rollbacks, and release strategies. We set up the path so every change reaches users safely.",
    icon: Rocket,
    features: [
      "Environment and release strategy",
      "Zero-downtime and blue-green deploys",
      "Automated rollbacks",
      "Edge and CDN configuration",
    ],
    stack: ["aws", "docker", "nextjs", "linux"],
    category: "Cloud & Operations",
    deliverables: [
      "Environment and release strategy",
      "A repeatable build and deploy pipeline",
      "Zero-downtime or blue-green release setup",
      "Automated rollback procedure",
      "Edge, CDN, and DNS configuration",
      "Launch checklist and runbook",
    ],
    timeline:
      "Typically 1 to 3 weeks for a focused deployment setup, depending on the existing infrastructure.",
    idealFor: [
      "Teams launching a new product without a release process",
      "Products moving from manual uploads to automated deploys",
      "Businesses that need safer, reversible releases",
    ],
    outcomes: [
      "Every release follows the same tested path.",
      "A failed release can be reversed without a scramble.",
      "Environments stay consistent from staging to production.",
      "The team knows who does what on launch day.",
    ],
    faqs: [
      {
        question: "Can you deploy to our existing cloud account?",
        answer:
          "Yes. We work inside your AWS, Azure, or other account and keep ownership with you. Access is scoped, changes are made through infrastructure as code, and credentials are stored in your secret manager.",
      },
      {
        question: "What is a zero-downtime deployment?",
        answer:
          "A zero-downtime deployment moves traffic to a new version only after it is healthy, then retires the old one. It requires health checks, a rollback path, and a data strategy for changes that affect the database.",
      },
      {
        question: "Do you support rollbacks?",
        answer:
          "Yes. We configure health checks and keep the previous release available so traffic can return quickly. Rollback steps are documented and tested before launch, including what to do when a database change cannot be reversed automatically.",
      },
      pricingFaq("deployment", "deployment"),
    ],
  },
  {
    slug: "maintenance-support",
    title: "Maintenance & Support",
    tagline: "Steady hands long after launch.",
    description:
      "Ongoing maintenance, security patching, and responsive support that keep your software healthy. We treat your uptime as our own.",
    icon: LifeBuoy,
    features: [
      "Proactive monitoring and patching",
      "Support response targets published on /guarantees",
      "Dependency and security updates",
      "Continuous small improvements",
    ],
    stack: ["linux", "aws", "docker"],
    category: "Cloud & Operations",
    deliverables: [
      "A support agreement with named contacts and hours",
      "Monitoring and uptime alerts",
      "Security and dependency patching",
      "Regular backups and restore checks",
      "A monthly summary of work and incidents",
      "A prioritised backlog of small improvements",
    ],
    timeline:
      "Ongoing monthly retainer. The initial setup typically takes 1 to 2 weeks before regular support begins.",
    idealFor: [
      "Businesses running a live website or application without in-house engineers",
      "Teams that need dependable patching and monitoring",
      "Products preparing for a period of growth or change",
    ],
    outcomes: [
      "Issues are found and reported before customers notice.",
      "Dependencies and security patches stay current.",
      "Support requests follow a known path and response target.",
      "Small improvements ship without a new project each time.",
    ],
    faqs: [
      {
        question: "What are your support response times?",
        answer:
          "Maintenance clients receive a first response within one business day, and critical production issues the same business day. Support hours are Monday to Friday, 10:00 to 18:00 IST, excluding public holidays. The full commitments are published on our guarantees page.",
      },
      {
        question: "What is included in the monthly retainer?",
        answer:
          "The retainer covers monitoring, patching, backups, a defined support allowance, and a monthly summary. Larger improvements are quoted separately. The agreement lists included hours, response targets, and any exclusions before it starts.",
      },
      {
        question: "Can you take over maintenance from another team?",
        answer:
          "Yes. We review the code, infrastructure, and documentation, then list the risks and missing access before taking responsibility. A short stabilisation period may be needed before the standard support targets apply.",
      },
      pricingFaq("maintenance-support", "maintenance and support"),
    ],
  },
  {
    slug: "performance-optimization",
    title: "Performance Optimization",
    tagline: "Make slow software fast — measurably.",
    description:
      "We profile, measure, and tune — front to back. From Core Web Vitals to database queries, we find the bottlenecks and remove them, with numbers to prove it.",
    icon: Gauge,
    features: [
      "Core Web Vitals and bundle analysis",
      "Database and query tuning",
      "Caching strategy and CDN",
      "Before/after benchmarking",
    ],
    stack: ["nextjs", "postgresql", "aws"],
    category: "Cloud & Operations",
    deliverables: [
      "A baseline measurement and prioritised findings",
      "Front-end bundle and rendering improvements",
      "Database and query tuning",
      "Caching and CDN configuration",
      "Before-and-after measurements",
      "A short report with remaining recommendations",
    ],
    timeline:
      "Typically 2 to 4 weeks for an audit and focused fixes, depending on the number of pages and systems involved.",
    idealFor: [
      "Sites that feel slow on mobile connections",
      "Products with rising infrastructure costs or slow queries",
      "Teams preparing for a campaign or traffic increase",
    ],
    outcomes: [
      "Pages respond faster on the devices your customers use.",
      "The heaviest bottlenecks are identified with evidence.",
      "Caching and assets are configured for repeat visits.",
      "Your team has a measured baseline for future work.",
    ],
    faqs: [
      {
        question: "How do you measure performance?",
        answer:
          "We capture a baseline using field data where available and controlled tests where it is not. We then repeat the same tests after changes. The report states the method, the environment, and the variation so the comparison is honest.",
      },
      {
        question: "Will optimisation change how the site looks?",
        answer:
          "Usually not. Most gains come from asset delivery, rendering, caching, and queries. Where a visual change is needed, we show the trade-off and ask for approval before implementing it.",
      },
      {
        question: "Can you improve a site we did not build?",
        answer:
          "Yes. We audit the current stack and identify where changes are safe. If the platform cannot support the required improvements, we explain the limit and outline a staged alternative rather than forcing risky workarounds.",
      },
      pricingFaq("performance-optimization", "performance optimisation"),
    ],
  },
  {
    slug: "ui-ux-development",
    title: "UI/UX Development",
    tagline: "Design and engineering, in one team.",
    description:
      "Product design that ships — research, wireframes, and high-fidelity interfaces translated faithfully into clean, accessible code by the same team.",
    icon: PenTool,
    features: [
      "User research and flows",
      "Wireframes and high-fidelity design",
      "Design-to-code fidelity",
      "Usability and accessibility testing",
    ],
    stack: ["react", "nextjs", "typescript"],
    category: "Product & Design",
    deliverables: [
      "User research notes and journey maps",
      "Wireframes for the agreed flows",
      "High-fidelity screens and a design system",
      "An interactive prototype for review",
      "Production front-end implementation",
      "Usability and accessibility findings",
    ],
    timeline:
      "Typically 3 to 8 weeks for a focused product flow, depending on research, review rounds, and the number of screens.",
    idealFor: [
      "Products with unclear flows or recurring usability complaints",
      "Teams that want design and build handled by one group",
      "Businesses refreshing an interface without rebuilding the backend",
    ],
    outcomes: [
      "Core tasks follow a clear, tested path.",
      "The interface works on the devices customers actually use.",
      "Design decisions are documented for future work.",
      "The built product matches the approved design.",
    ],
    faqs: [
      {
        question: "Do you conduct user research?",
        answer:
          "Yes, when the scope allows it. We can interview customers, review support requests, and test a prototype with representative users. The findings are summarised with the decisions they informed, not presented as a separate report nobody uses.",
      },
      {
        question: "Can you design and build the product?",
        answer:
          "Yes. One team handles research, wireframes, visual design, and front-end implementation. That keeps the design intent intact and removes the handoff gap where details are often lost.",
      },
      {
        question: "How do you handle accessibility in design?",
        answer:
          "Accessibility is part of the design review, not a final check. We consider contrast, focus order, labels, touch targets, and motion preferences early, then verify them in the built interface against the agreed standard.",
      },
      pricingFaq("ui-ux-development", "UI/UX development"),
    ],
  },
  {
    slug: "technical-consulting",
    title: "Technical Consulting",
    tagline: "An experienced second opinion when it counts.",
    description:
      "Architecture reviews, technology selection, and team guidance from engineers who have shipped real systems. We help you make decisions you will not have to undo.",
    icon: Compass,
    features: [
      "Architecture and code reviews",
      "Technology selection",
      "Scalability and security audits",
      "Team mentoring and process",
    ],
    stack: ["java", "nextjs", "aws"],
    category: "Product & Design",
    deliverables: [
      "A written review of the architecture and code",
      "A risk register with prioritised recommendations",
      "Technology and vendor comparison",
      "A practical roadmap with effort estimates",
      "A working session with your team",
      "Follow-up notes and decision records",
    ],
    timeline:
      "Typically 1 to 3 weeks for an assessment, or an ongoing advisory arrangement for a few hours each month.",
    idealFor: [
      "Founders making a major architecture or platform decision",
      "Teams inheriting a codebase without clear documentation",
      "Engineering leaders who need an independent review",
    ],
    outcomes: [
      "Decisions are documented with their trade-offs and owners.",
      "The highest-risk issues are visible and prioritised.",
      "Your team has a practical plan rather than a slide deck.",
      "Future work can be estimated against a shared baseline.",
    ],
    faqs: [
      {
        question: "What does a technical assessment cover?",
        answer:
          "It covers architecture, code quality, data flow, security posture, deployment, and operational readiness, scoped to your concerns. You receive findings with evidence, prioritised recommendations, and a working session to discuss the trade-offs.",
      },
      {
        question: "Can you review a codebase before we acquire a company?",
        answer:
          "Yes. We assess maintainability, security, dependencies, infrastructure, and delivery risk, then report what is sound and what needs investment. The scope and any access limits are agreed in writing before the review begins.",
      },
      {
        question: "Do you provide ongoing advisory support?",
        answer:
          "Yes. Advisory can be a short review or a monthly arrangement for architecture decisions, code reviews, and team guidance. The hours, response expectations, and decision rights are agreed in advance so the role stays useful.",
      },
      pricingFaq("technical-consulting", "technical consulting"),
    ],
  },
];

export const serviceCategories = [
  "Engineering",
  "Product & Design",
  "AI & Automation",
  "Cloud & Operations",
] as const;

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
