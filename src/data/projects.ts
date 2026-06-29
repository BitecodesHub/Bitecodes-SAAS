import type { Project } from "@/types/content";

/*
 * Portfolio case studies.
 * TODO(client): Results metrics are representative and should be confirmed
 * against real, publishable figures before launch.
 */
export const projects: Project[] = [
  {
    slug: "prism",
    name: "PRISM",
    client: "Bitecodes",
    category: "AI · SEO Platform",
    year: "2025",
    teaser:
      "An AI-driven SEO and generative-engine-optimization platform that audits, fixes, and future-proofs websites.",
    overview:
      "PRISM is an AI-powered SEO and GEO (generative engine optimization) platform that helps site owners rank in both traditional search and AI answer engines. It audits technical SEO, generates structured data, manages redirects and sitemaps, and rewrites content to be citation-ready for LLMs.",
    challenge:
      "SEO tooling was built for a search world that is rapidly changing. Site owners needed a single system that could handle classic technical SEO and the new reality of AI crawlers and answer engines — without a team of specialists.",
    solution:
      "We built PRISM as an automation engine with a clean dashboard and an MCP server interface. It runs full technical audits, auto-generates schema, manages an llms.txt and AI-bot policy, fixes canonicals and broken links, and rewrites pages for generative engines — all with a reversible change history.",
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
    results: [
      { metric: "60%", label: "Faster SEO audits" },
      { metric: "2x", label: "Structured-data coverage" },
      { metric: "100%", label: "Reversible changes" },
    ],
    accent: "from-violet-500 via-indigo-500 to-blue-500",
    featured: true,
    gallery: 4,
  },
  {
    slug: "parking-management-system",
    name: "Parking Management System",
    client: "ConceptServe Technologies",
    category: "Enterprise · Operations",
    year: "2024",
    teaser:
      "A complete parking operations platform — bookings, access control, billing, and live occupancy.",
    overview:
      "A robust parking management system that digitizes the full operations lifecycle: space inventory, bookings, access control, billing, and reporting, with live occupancy dashboards for operators.",
    challenge:
      "Manual logs and disconnected tools made it impossible to know real-time occupancy, reconcile revenue, or scale to multiple sites without errors.",
    solution:
      "We delivered a centralized platform with real-time occupancy tracking, automated billing, role-based operator access, and multi-site reporting — built on a reliable Spring Boot backend with a responsive operator dashboard.",
    technologies: ["java", "spring-boot", "react", "postgresql", "docker"],
    features: [
      "Real-time occupancy and space management",
      "Automated billing and reconciliation",
      "Role-based operator access",
      "Multi-site reporting dashboards",
      "Booking and access-control workflows",
    ],
    results: [
      { metric: "40%", label: "Less manual admin" },
      { metric: "Real-time", label: "Occupancy visibility" },
      { metric: "Multi-site", label: "Scalable operations" },
    ],
    accent: "from-sky-500 via-cyan-500 to-teal-500",
    featured: false,
    gallery: 3,
  },
  {
    slug: "smart-ai-park",
    name: "Smart AI Park",
    client: "ConceptServe Technologies",
    category: "AI · Smart Infrastructure",
    year: "2025",
    teaser:
      "AI-powered parking intelligence — plate recognition, occupancy prediction, and automated entry.",
    overview:
      "Smart AI Park layers computer vision and prediction onto parking infrastructure: automatic license-plate recognition, occupancy forecasting, and frictionless automated entry and exit.",
    challenge:
      "Operators wanted to remove the friction of tickets and barriers while predicting demand to optimize pricing and staffing — a job traditional systems could not do.",
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
    results: [
      { metric: "Ticketless", label: "Entry experience" },
      { metric: "Predictive", label: "Occupancy planning" },
      { metric: "Lower", label: "Operating overhead" },
    ],
    accent: "from-emerald-500 via-teal-500 to-cyan-500",
    featured: true,
    gallery: 4,
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
    results: [
      { metric: "Instant", label: "Lesson loads" },
      { metric: "Mobile-first", label: "Learning experience" },
      { metric: "Scalable", label: "To many learners" },
    ],
    accent: "from-amber-500 via-orange-500 to-rose-500",
    featured: false,
    gallery: 3,
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
      "For Sublime Care, an Australian aged-care provider, we built operations tooling and automation that streamlines care administration and the fortnightly billing cycle, reducing manual effort and errors.",
    challenge:
      "Care administration and government-funded billing involved hours of manual, error-prone spreadsheet work each cycle, pulling staff away from care.",
    solution:
      "We automated the invoicing pipeline end to end — validating inputs, normalizing data, resolving routing rules per client, and generating accounting-ready imports — with a human-in-the-loop review at every step.",
    technologies: ["python", "nodejs", "ai-integration", "postgresql"],
    features: [
      "Automated fortnightly invoicing pipeline",
      "Data validation and normalization",
      "Per-client routing rules",
      "Accounting-system-ready exports",
      "Human-in-the-loop review checkpoints",
    ],
    results: [
      { metric: "Hours", label: "Saved each cycle" },
      { metric: "Fewer", label: "Manual errors" },
      { metric: "Audit-ready", label: "Billing records" },
    ],
    accent: "from-teal-500 via-emerald-500 to-green-500",
    featured: true,
    gallery: 3,
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
      "We delivered a fast corporate platform and embedded as an ongoing engineering partner — shipping features, maintaining quality, and advising on architecture across their product line.",
    technologies: ["nextjs", "react", "typescript", "nodejs", "postgresql"],
    features: [
      "Fast, SEO-friendly corporate platform",
      "Reusable design system",
      "Ongoing engineering partnership",
      "Architecture and code-review support",
    ],
    results: [
      { metric: "Reliable", label: "Delivery cadence" },
      { metric: "Senior", label: "Engineering, on demand" },
      { metric: "Multiple", label: "Products supported" },
    ],
    accent: "from-blue-500 via-indigo-500 to-violet-500",
    featured: false,
    gallery: 3,
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
      "We built a media-optimized portfolio with responsive imagery, smooth transitions, and a static-first architecture — cinematic feel, fast loads, strong SEO.",
    technologies: ["nextjs", "react", "typescript"],
    features: [
      "Cinematic, media-rich layouts",
      "Optimized responsive imagery",
      "Smooth, tasteful transitions",
      "Strong SEO and fast loads",
    ],
    results: [
      { metric: "Cinematic", label: "Brand presence" },
      { metric: "Fast", label: "Media-heavy pages" },
      { metric: "Improved", label: "Discoverability" },
    ],
    accent: "from-rose-500 via-pink-500 to-fuchsia-500",
    featured: false,
    gallery: 4,
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
    results: [
      { metric: "Premium", label: "Brand perception" },
      { metric: "Faster", label: "Page loads" },
      { metric: "More", label: "Qualified leads" },
    ],
    accent: "from-orange-500 via-amber-500 to-yellow-500",
    featured: false,
    gallery: 3,
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
    results: [
      { metric: "Trustworthy", label: "Patient experience" },
      { metric: "Accessible", label: "To all users" },
      { metric: "Clear", label: "Service discovery" },
    ],
    accent: "from-cyan-500 via-sky-500 to-blue-500",
    featured: false,
    gallery: 3,
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
      "We built an applicant-tracking platform with structured candidate pipelines, employer dashboards, and clear communication flows — making hiring faster and more organized.",
    technologies: ["nextjs", "react", "nodejs", "postgresql"],
    features: [
      "Applicant tracking and pipelines",
      "Employer and candidate dashboards",
      "Structured communication flows",
      "Search and candidate matching",
    ],
    results: [
      { metric: "Organized", label: "Hiring pipeline" },
      { metric: "Faster", label: "Time to shortlist" },
      { metric: "Fewer", label: "Lost candidates" },
    ],
    accent: "from-indigo-500 via-purple-500 to-pink-500",
    featured: false,
    gallery: 3,
  },
];

export const featuredProjects = projects.filter((p) => p.featured);

const projectBySlug = new Map(projects.map((p) => [p.slug, p]));

export function getProject(slug: string) {
  return projectBySlug.get(slug);
}
