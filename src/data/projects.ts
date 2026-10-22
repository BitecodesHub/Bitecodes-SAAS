import type { Project } from "@/types/content";

/*
 * Portfolio case studies.
 *
 * OWNER MUST CONFIRM each client relationship recorded below and that every
 * client has consented to publication of its name and the description of the
 * work. Relationship values:
 * - "client": a paying client with no relationship to the founder.
 * - "related-party": work for an organisation connected to the founder. The
 *   project page discloses this in plain language.
 * - "internal": built for Bitecodes itself, never counted as client work.
 *
 * No result metrics are published here unless they are plain facts evidenced
 * by the project. Outcomes are qualitative and describe what was built.
 */
type PublishedProject = Omit<Project, "results">;

const publishedProjects: PublishedProject[] = [
  {
    slug: "prism",
    name: "PRISM",
    client: "Sublime Care (Australia)",
    category: "AI · SEO Platform",
    year: "2025",
    teaser:
      "An AI-driven SEO and generative-engine-optimization platform that audits, fixes, and future-proofs websites.",
    overview:
      "PRISM is an AI-powered SEO and GEO (generative engine optimization) platform that helps site owners rank in both traditional search and AI answer engines. It audits technical SEO, generates structured data, manages redirects and sitemaps, and rewrites content to be citation-ready for LLMs.",
    challenge:
      "SEO tooling was built for a search world that is rapidly changing. Site owners needed a single system that could handle classic technical SEO and the new reality of AI crawlers and answer engines without a team of specialists.",
    solution:
      "We built PRISM as an automation engine with a clean dashboard and an MCP server interface. It runs full technical audits, auto-generates schema, manages an llms.txt and AI-bot policy, fixes canonicals and broken links, and rewrites pages for generative engines, all with a reversible change history.",
    technologies: [
      "nextjs",
      "typescript",
      "nodejs",
      "python",
      "ai-integration",
      "mcp-servers",
    ],
    features: [
      "Automated technical SEO audits with fix suggestions",
      "AI-generated JSON-LD schema and FAQ markup",
      "GEO content rewriting for AI answer engines",
      "Redirect, sitemap, and canonical management",
      "MCP server for AI-assistant control",
      "Full, reversible change history",
    ],
    services: [
      "web-applications",
      "ai-integration",
      "mcp-servers",
      "backend-development",
    ],
    engagement: "Product build",
    outcomes: [
      "Technical audits, structured data, redirects, sitemaps, and AI-crawler policy are managed from one dashboard.",
      "Every change is recorded and can be reversed from the same interface.",
      "The platform exposes its tools to AI assistants through an MCP server.",
    ],
    relationship: "related-party",
    featured: false,
    image: "/images/projects/prism.jpg",
    liveUrl: "https://prism.sublimecare.com.au",
  },
  {
    slug: "parking-management-system",
    name: "Parking Management System",
    client: "ConceptServe Technologies",
    category: "Enterprise · Operations",
    year: "2024",
    teaser:
      "A complete parking operations platform for bookings, access control, billing, and live occupancy.",
    overview:
      "A robust parking management system that digitizes the full operations lifecycle: space inventory, bookings, access control, billing, and reporting, with live occupancy dashboards for operators.",
    challenge:
      "Manual logs and disconnected tools made it impossible to know real-time occupancy, reconcile revenue, or scale to multiple sites without errors.",
    solution:
      "We delivered a centralized platform with real-time occupancy tracking, automated billing, role-based operator access, and multi-site reporting, built on a Spring Boot backend with a responsive operator dashboard.",
    technologies: ["java", "spring-boot", "react", "postgresql", "docker"],
    features: [
      "Real-time occupancy and space management",
      "Automated billing and reconciliation",
      "Role-based operator access",
      "Multi-site reporting dashboards",
      "Booking and access-control workflows",
    ],
    services: [
      "enterprise-software",
      "web-applications",
      "backend-development",
    ],
    engagement: "Platform build",
    outcomes: [
      "Operators see occupancy, bookings, billing, and site-level reporting in one dashboard.",
      "Roles separate operator access by responsibility.",
      "Bookings and access control follow a single workflow.",
    ],
    relationship: "client",
    featured: false,
  },
  {
    slug: "smart-ai-park",
    name: "Smart AI Park",
    client: "ConceptServe Technologies",
    category: "AI · Smart Infrastructure",
    year: "2025",
    teaser:
      "AI-powered parking intelligence with plate recognition, occupancy prediction, and automated entry.",
    overview:
      "Smart AI Park layers computer vision and prediction onto parking infrastructure: automatic license-plate recognition, occupancy forecasting, and frictionless automated entry and exit.",
    challenge:
      "Operators wanted to remove the friction of tickets and barriers while predicting demand to optimize pricing and staffing, a job traditional systems could not do.",
    solution:
      "We integrated license-plate recognition for ticketless entry, built an occupancy-prediction model from historical patterns, and exposed it all through a live operations dashboard with automated alerts.",
    technologies: [
      "python",
      "nextjs",
      "nodejs",
      "ai-integration",
      "postgresql",
      "aws",
    ],
    features: [
      "Automatic license-plate recognition",
      "Occupancy forecasting and demand prediction",
      "Ticketless automated entry and exit",
      "Dynamic, data-informed pricing",
      "Live operations dashboard and alerts",
    ],
    services: ["ai-integration", "web-applications", "cloud-solutions"],
    engagement: "Product build",
    outcomes: [
      "Vehicle entry and exit can run without a ticket.",
      "Occupancy forecasts sit beside live operations data.",
      "Operators receive alerts from the same dashboard.",
    ],
    relationship: "client",
    featured: false,
  },
  {
    slug: "bitecodes-academy",
    name: "Bitecodes Academy",
    client: "Bitecodes",
    category: "Education · Platform",
    year: "2024",
    teaser:
      "A modern learning platform with courses, progress tracking, and a fast, focused reading experience.",
    overview:
      "Bitecodes Academy is a learning platform delivering structured courses with lessons, progress tracking, and assessments, wrapped in a fast, distraction-free interface.",
    challenge:
      "Off-the-shelf LMS tools were heavy, slow, and hard to brand. The goal was a fast, beautiful learning experience that scaled to many learners.",
    solution:
      "We built a static-first learning platform with a clean lesson reader, progress tracking, and assessments, optimized for performance so lessons load instantly even on slow connections.",
    technologies: ["nextjs", "typescript", "react", "mongodb"],
    features: [
      "Structured courses and lessons",
      "Progress tracking and assessments",
      "Fast, distraction-free reader",
      "Responsive across all devices",
      "Search and content discovery",
    ],
    industry: "education",
    services: ["web-applications", "frontend-development", "ui-ux-development"],
    engagement: "Internal product build",
    outcomes: [
      "Courses, lessons, progress, and assessments live in one learning interface.",
      "The lesson reader is built to load quickly on mobile connections.",
      "Learners can search the course catalogue.",
    ],
    relationship: "internal",
    featured: false,
  },
  {
    slug: "conceptserve-technologies",
    name: "ConceptServe Technologies",
    client: "ConceptServe Technologies",
    category: "Web · Corporate Platform",
    year: "2024",
    teaser:
      "A fast, professional web platform and engineering partnership for a technology services firm.",
    overview:
      "We partnered with ConceptServe Technologies to deliver their web presence and custom software, providing ongoing engineering capacity across multiple products.",
    challenge:
      "ConceptServe needed a senior engineering partner who could deliver a polished web platform and pick up custom software work reliably, without the overhead of growing an in-house team.",
    solution:
      "We delivered a fast corporate platform and embedded as an ongoing engineering partner, shipping features, maintaining quality, and advising on architecture across their product line.",
    technologies: ["nextjs", "react", "typescript", "nodejs", "postgresql"],
    features: [
      "Fast, SEO-friendly corporate platform",
      "Reusable design system",
      "Ongoing engineering partnership",
      "Architecture and code-review support",
    ],
    services: [
      "website-development",
      "web-applications",
      "technical-consulting",
    ],
    engagement: "Website build and ongoing engineering partnership",
    outcomes: [
      "A corporate site and design system support the public-facing brand.",
      "Ongoing architecture and code review support the product line.",
      "The site is built on the same stack used for custom software work.",
    ],
    relationship: "client",
    featured: true,
    image: "/images/projects/conceptserve.jpg",
    liveUrl: "https://conceptserve.com",
  },
  {
    slug: "sublime-care",
    name: "Sublime Care",
    client: "Sublime Care (Australia)",
    category: "Healthcare · Automation",
    year: "2025",
    teaser:
      "Care-operations and billing automation for an Australian aged-care provider.",
    overview:
      "For Sublime Care, an Australian aged-care provider, we built operations tooling and automation that streamlines care administration and the fortnightly billing cycle, with human review at each step.",
    challenge:
      "Care administration and government-funded billing involved hours of manual, error-prone spreadsheet work each cycle, pulling staff away from care.",
    solution:
      "We automated the invoicing pipeline end to end: validating inputs, normalizing data, resolving routing rules per client, and generating accounting-ready imports, with a human-in-the-loop review at every step.",
    technologies: ["python", "nodejs", "ai-integration", "postgresql"],
    features: [
      "Automated fortnightly invoicing pipeline",
      "Data validation and normalization",
      "Per-client routing rules",
      "Accounting-system-ready exports",
      "Human-in-the-loop review checkpoints",
    ],
    industry: "healthcare",
    services: ["business-automation", "custom-software", "backend-development"],
    engagement: "Automation build",
    outcomes: [
      "Fortnightly invoicing runs through one validated pipeline.",
      "Routing rules are applied per client.",
      "A person reviews each run before accounting-ready exports are produced.",
    ],
    relationship: "related-party",
    featured: false,
    image: "/images/projects/sublimecare.jpg",
    liveUrl: "https://sublimecare.com.au",
  },
  {
    slug: "saanvi-production-house",
    name: "Saanvi Production House",
    client: "Saanvi Production House",
    category: "Media · Portfolio",
    year: "2024",
    teaser:
      "A visually-rich portfolio platform for a film and media production house.",
    overview:
      "Saanvi Production House needed a digital presence as polished as their work. We built a fast, visually-driven portfolio platform that lets their projects shine.",
    challenge:
      "Media-heavy portfolios are notoriously slow. The site had to feel cinematic while still loading quickly and ranking well.",
    solution:
      "We built a media-optimized portfolio with responsive imagery, smooth transitions, and a static-first architecture: cinematic feel, fast loads, strong SEO.",
    technologies: ["nextjs", "react", "typescript"],
    features: [
      "Cinematic, media-rich layouts",
      "Optimized responsive imagery",
      "Smooth, tasteful transitions",
      "Strong SEO and fast loads",
    ],
    industry: "media",
    services: [
      "website-development",
      "frontend-development",
      "ui-ux-development",
    ],
    engagement: "Website build",
    outcomes: [
      "Film and media work is presented in responsive, media-rich layouts.",
      "The site is built static-first to keep media-heavy pages fast.",
      "Pages carry the metadata search engines need.",
    ],
    relationship: "client",
    featured: true,
  },
  {
    slug: "vertex-media-house",
    name: "Vertex Media House",
    client: "Vertex Media House",
    category: "Media · Marketing",
    year: "2025",
    teaser:
      "A fast, conversion-focused marketing website for a creative media agency.",
    overview:
      "Vertex Media House wanted a marketing site that matched their creative reputation and converted visitors into leads. We delivered a fast, visually-driven site built to convert.",
    challenge:
      "Their existing site was slow and dated, undermining credibility with prospective clients and hurting lead generation.",
    solution:
      "We designed and built a premium, conversion-focused marketing website with clear calls to action, fast loads, and a content structure built for SEO.",
    technologies: ["nextjs", "react", "typescript"],
    features: [
      "Premium, on-brand marketing design",
      "Conversion-focused structure and CTAs",
      "Fast, accessible, responsive build",
      "SEO-optimized content architecture",
    ],
    industry: "media",
    services: [
      "website-development",
      "frontend-development",
      "performance-optimization",
    ],
    engagement: "Website build",
    outcomes: [
      "Services and calls to action are presented in a clear page structure.",
      "Static-first pages keep the marketing site fast.",
      "Content is structured for search.",
    ],
    relationship: "client",
    featured: true,
  },
  {
    slug: "rivala-care",
    name: "Rivala Care",
    client: "Rivala Care",
    category: "Healthcare · Platform",
    year: "2025",
    teaser:
      "A clean, trustworthy care and services platform with a reassuring patient experience.",
    overview:
      "Rivala Care needed a modern platform that communicated trust and made services easy to find and access for patients and families.",
    challenge:
      "Healthcare audiences need clarity and reassurance. The experience had to feel calm, accessible, and trustworthy across every device.",
    solution:
      "We built a clean, accessible platform with a calm visual language, clear service information, and an experience tuned for patients and families of every ability.",
    technologies: ["nextjs", "react", "typescript", "mongodb"],
    features: [
      "Calm, trustworthy visual design",
      "Clear, accessible service information",
      "WCAG AA accessibility",
      "Fast, responsive across devices",
    ],
    industry: "healthcare",
    services: ["website-development", "web-applications", "ui-ux-development"],
    engagement: "Platform build",
    outcomes: [
      "Services and care information are presented in a calm, accessible layout.",
      "The interface is responsive across devices.",
      "The build targets WCAG AA accessibility.",
    ],
    relationship: "client",
    featured: false,
  },
  {
    slug: "hirebound",
    name: "HireBound",
    client: "HireBound",
    category: "Recruitment · Platform",
    year: "2025",
    teaser:
      "A recruitment platform connecting candidates and employers with streamlined hiring workflows.",
    overview:
      "HireBound is a recruitment platform that brings candidates and employers together, streamlining applications, tracking, and communication in one place.",
    challenge:
      "Hiring was fragmented across email and spreadsheets, making it slow to track candidates and easy to lose strong applicants.",
    solution:
      "We built an applicant-tracking platform with structured candidate pipelines, employer dashboards, and clear communication flows, making hiring faster and more organized.",
    technologies: ["nextjs", "react", "nodejs", "postgresql"],
    features: [
      "Applicant tracking and pipelines",
      "Employer and candidate dashboards",
      "Structured communication flows",
      "Search and candidate matching",
    ],
    industry: "recruitment",
    services: ["web-applications", "backend-development", "ui-ux-development"],
    engagement: "Platform build",
    outcomes: [
      "Candidates move through structured hiring pipelines.",
      "Employers and candidates each have a dashboard.",
      "Communication is kept in one place.",
    ],
    relationship: "client",
    featured: false,
  },
];

/*
 * `Project.results` is still a required field on the shared content type, but no
 * verified result metrics exist. The published data intentionally omits the
 * field, and nothing reads it. The cast keeps the exported type stable for
 * consumers until the shared type's owner removes the requirement.
 */
export const projects = publishedProjects as Project[];

const relationshipOrder: Record<
  NonNullable<Project["relationship"]>,
  number
> = {
  client: 0,
  "related-party": 1,
  internal: 2,
};

/** Client work is featured first; internal products never lead the homepage. */
export const featuredProjects = projects
  .filter((project) => project.featured)
  .sort(
    (a, b) =>
      relationshipOrder[a.relationship ?? "client"] -
      relationshipOrder[b.relationship ?? "client"],
  );

const projectBySlug = new Map(projects.map((p) => [p.slug, p]));

export function getProject(slug: string) {
  return projectBySlug.get(slug);
}
