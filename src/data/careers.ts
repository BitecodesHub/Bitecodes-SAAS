import {
  Globe2,
  GraduationCap,
  HeartHandshake,
  Laptop,
  Plane,
  Sparkles,
} from "lucide-react";
import type { JobOpening } from "@/types/content";
import type { LucideIcon } from "lucide-react";

export const cultureValues = [
  {
    title: "Ownership over hand-offs",
    description:
      "Everyone owns outcomes, not just tickets. You ship, you support, you improve.",
  },
  {
    title: "Craft is the standard",
    description:
      "We sweat the details — clean code, thoughtful UX, real performance — because clients feel them.",
  },
  {
    title: "Async, remote-first",
    description:
      "We optimize for focused work and clear writing over meetings and presence.",
  },
  {
    title: "Always learning",
    description:
      "New tools, new domains, new patterns. Curiosity is part of the job description.",
  },
];

export interface Benefit {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const benefits: Benefit[] = [
  {
    title: "Remote-first",
    description: "Work from anywhere with flexible hours and async defaults.",
    icon: Globe2,
  },
  {
    title: "Modern equipment",
    description: "The hardware and tools you need to do your best work.",
    icon: Laptop,
  },
  {
    title: "Learning budget",
    description: "Courses, books, and conferences — we invest in your growth.",
    icon: GraduationCap,
  },
  {
    title: "Real ownership",
    description: "Meaningful work with real responsibility from day one.",
    icon: Sparkles,
  },
  {
    title: "Time to recharge",
    description: "Generous, genuinely-encouraged paid time off.",
    icon: Plane,
  },
  {
    title: "Supportive team",
    description: "Mentorship, code review, and people who have your back.",
    icon: HeartHandshake,
  },
];

export const hiringProcess = [
  {
    step: 1,
    title: "Application",
    description: "Send us your CV and a note on what you would love to build.",
  },
  {
    step: 2,
    title: "Intro call",
    description: "A relaxed conversation about your experience and goals.",
  },
  {
    step: 3,
    title: "Technical conversation",
    description:
      "A practical discussion or small exercise — no trick questions.",
  },
  {
    step: 4,
    title: "Offer",
    description: "We move quickly and make it easy to say yes.",
  },
];

export const jobOpenings: JobOpening[] = [
  {
    slug: "senior-fullstack-engineer",
    title: "Senior Full-Stack Engineer",
    department: "Engineering",
    type: "Full-time",
    location: "Remote",
    summary:
      "Build polished, high-performance web applications end to end with Next.js, TypeScript, and modern backends.",
    responsibilities: [
      "Design and build features across the stack",
      "Own quality — tests, reviews, and performance",
      "Collaborate directly with clients and design",
    ],
    requirements: [
      "Strong TypeScript and React/Next.js experience",
      "Comfort with backend APIs and databases",
      "An eye for UX detail and performance",
    ],
  },
  {
    slug: "backend-engineer-java",
    title: "Backend Engineer (Java / Spring Boot)",
    department: "Engineering",
    type: "Full-time",
    location: "Remote",
    summary:
      "Engineer reliable, well-architected services and APIs for enterprise-grade systems.",
    responsibilities: [
      "Build and maintain Spring Boot services",
      "Model data and design clean API contracts",
      "Add observability and harden for production",
    ],
    requirements: [
      "Solid Java and Spring Boot experience",
      "Relational database and API design skills",
      "Familiarity with Docker and cloud deployment",
    ],
  },
  {
    slug: "ai-engineer",
    title: "AI Engineer",
    department: "AI & Automation",
    type: "Full-time",
    location: "Remote",
    summary:
      "Embed LLMs, retrieval, and agentic workflows into real products — with evaluation and guardrails.",
    responsibilities: [
      "Integrate LLMs and build MCP servers",
      "Design evaluations and guardrails",
      "Optimize for quality, latency, and cost",
    ],
    requirements: [
      "Experience integrating LLMs into products",
      "Strong Python or TypeScript skills",
      "A pragmatic, evaluation-driven mindset",
    ],
  },
  {
    slug: "product-designer",
    title: "Product Designer (UI/UX)",
    department: "Design",
    type: "Contract / Full-time",
    location: "Remote",
    summary:
      "Shape premium, accessible product experiences from research through high-fidelity design.",
    responsibilities: [
      "Run research and map user flows",
      "Design wireframes and high-fidelity UI",
      "Partner closely with engineering on fidelity",
    ],
    requirements: [
      "A strong portfolio of shipped product work",
      "Fluency in modern design tools and systems",
      "Understanding of accessibility and motion",
    ],
  },
];
