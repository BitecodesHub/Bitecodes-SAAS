import type { Technology } from "@/types/content";

export const technologies: Technology[] = [
  {
    slug: "java",
    name: "Java",
    category: "Languages",
    description:
      "The backbone of robust, high-throughput enterprise systems and services.",
  },
  {
    slug: "typescript",
    name: "TypeScript",
    category: "Languages",
    description:
      "Type-safe JavaScript that catches bugs before they ship and scales with teams.",
  },
  {
    slug: "javascript",
    name: "JavaScript",
    category: "Languages",
    description:
      "The universal language of the web, powering interactive client and server code.",
  },
  {
    slug: "python",
    name: "Python",
    category: "Languages",
    description:
      "Our language of choice for automation, data work, and AI tooling.",
  },
  {
    slug: "spring-boot",
    name: "Spring Boot",
    category: "Frameworks",
    description:
      "Production-grade Java services with security, data, and observability built in.",
  },
  {
    slug: "nextjs",
    name: "Next.js",
    category: "Frameworks",
    description:
      "The React framework we use for fast, SEO-friendly, server-first web apps.",
  },
  {
    slug: "nodejs",
    name: "Node.js",
    category: "Frameworks",
    description:
      "Event-driven JavaScript runtime for fast APIs and real-time services.",
  },
  {
    slug: "django",
    name: "Django",
    category: "Frameworks",
    description:
      "Batteries-included Python framework for secure, rapidly-built backends.",
  },
  {
    slug: "react",
    name: "React",
    category: "Frameworks",
    description:
      "Component-driven UI library at the heart of our web and mobile work.",
  },
  {
    slug: "rest-apis",
    name: "REST APIs",
    category: "Frameworks",
    description:
      "Clean, versioned, well-documented contracts that connect every layer.",
  },
  {
    slug: "mongodb",
    name: "MongoDB",
    category: "Databases",
    description:
      "Flexible document database for evolving schemas and fast iteration.",
  },
  {
    slug: "postgresql",
    name: "PostgreSQL",
    category: "Databases",
    description:
      "Our default relational database — reliable, powerful, and standards-driven.",
  },
  {
    slug: "mysql",
    name: "MySQL",
    category: "Databases",
    description:
      "Battle-tested relational database for transactional workloads.",
  },
  {
    slug: "docker",
    name: "Docker",
    category: "Cloud & DevOps",
    description:
      "Reproducible containers so software runs the same everywhere.",
  },
  {
    slug: "aws",
    name: "AWS",
    category: "Cloud & DevOps",
    description:
      "Scalable, secure cloud infrastructure for production workloads.",
  },
  {
    slug: "azure",
    name: "Azure",
    category: "Cloud & DevOps",
    description:
      "Enterprise cloud platform with deep integration and global reach.",
  },
  {
    slug: "linux",
    name: "Linux",
    category: "Cloud & DevOps",
    description:
      "The foundation our servers and pipelines are built and tuned on.",
  },
  {
    slug: "git",
    name: "Git",
    category: "Cloud & DevOps",
    description:
      "Version control that keeps every change traceable and reversible.",
  },
  {
    slug: "github",
    name: "GitHub",
    category: "Cloud & DevOps",
    description:
      "Collaboration, code review, and CI/CD at the center of our workflow.",
  },
  {
    slug: "ai-integration",
    name: "AI Integration",
    category: "AI",
    description:
      "LLMs, retrieval, and agentic workflows embedded where they add real value.",
  },
  {
    slug: "mcp-servers",
    name: "MCP Servers",
    category: "AI",
    description:
      "Model Context Protocol servers that connect your tools to AI, safely.",
  },
];

export const techCategories = [
  "Languages",
  "Frameworks",
  "Databases",
  "Cloud & DevOps",
  "AI",
] as const;

const techBySlug = new Map(technologies.map((t) => [t.slug, t]));

export function getTech(slug: string) {
  return techBySlug.get(slug);
}
