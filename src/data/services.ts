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
import type { Service } from "@/types/content";

export const services: Service[] = [
  {
    slug: "website-development",
    title: "Website Development",
    tagline: "Marketing sites that load instantly and convert.",
    description:
      "High-performance marketing and corporate websites built on modern frameworks, tuned for Core Web Vitals, SEO, and accessibility. Every site ships as a fast, static-first experience that ranks well and feels effortless.",
    icon: Globe,
    features: [
      "Static-first rendering for sub-second loads",
      "SEO, structured data, and OG covered end to end",
      "WCAG AA accessibility baked in",
      "CMS-ready architecture for future content teams",
    ],
    stack: ["nextjs", "typescript", "react"],
    category: "Engineering",
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
  },
  {
    slug: "custom-software",
    title: "Custom Software",
    tagline: "Bespoke systems for problems off the shelf can't solve.",
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
      "SLA-backed response times",
      "Dependency and security updates",
      "Continuous small improvements",
    ],
    stack: ["linux", "aws", "docker"],
    category: "Cloud & Operations",
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
  },
  {
    slug: "technical-consulting",
    title: "Technical Consulting",
    tagline: "An experienced second opinion when it counts.",
    description:
      "Architecture reviews, technology selection, and team guidance from engineers who have shipped real systems. We help you make decisions you won't have to undo.",
    icon: Compass,
    features: [
      "Architecture and code reviews",
      "Technology selection",
      "Scalability and security audits",
      "Team mentoring and process",
    ],
    stack: ["java", "nextjs", "aws"],
    category: "Product & Design",
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
