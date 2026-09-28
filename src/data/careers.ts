import {
  Award,
  BadgeIndianRupee,
  Globe2,
  Handshake,
  House,
  Rocket,
} from "lucide-react";
import type { JobOpening } from "@/types/content";
import type { LucideIcon } from "lucide-react";

/**
 * Careers content. Bitecodes is hiring for one role only: a work-from-home
 * sales and marketing internship for candidates in Ahmedabad and Gandhinagar.
 * Everything on /careers and /careers/[slug] — including the JobPosting
 * structured data Google for Jobs reads — is generated from this file, so the
 * visible page and the markup can never disagree.
 */

export const cultureValues = [
  {
    title: "Work with the founder",
    description:
      "No layers. You report to the person who runs the company and see how deals are really won.",
  },
  {
    title: "Real clients, real stakes",
    description:
      "You talk to businesses in India, the US, the UK and the Middle East — not practice accounts.",
  },
  {
    title: "Say what happened",
    description:
      "A short daily update, good or bad. Honest numbers beat polished excuses.",
  },
  {
    title: "Try it your way",
    description:
      "No fixed script. If you find a better way to reach people, we test it.",
  },
];

export interface Benefit {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const benefits: Benefit[] = [
  {
    title: "Work from home",
    description:
      "Fully remote. Flexible hours, minimum four hours a day, from anywhere in Ahmedabad or Gandhinagar.",
    icon: House,
  },
  {
    title: "₹2,000–5,000 a month",
    description: "A fixed monthly stipend based on hours and experience.",
    icon: BadgeIndianRupee,
  },
  {
    title: "Commission on every deal",
    description:
      "A cut of every client you bring in, on top of the stipend. The percentage is agreed before you join.",
    icon: Handshake,
  },
  {
    title: "Certificate and recommendation",
    description:
      "An internship certificate and a letter of recommendation from the founder.",
    icon: Award,
  },
  {
    title: "International exposure",
    description:
      "Pitch software projects to startups and businesses across four continents.",
    icon: Globe2,
  },
  {
    title: "Full-time offer",
    description: "Strong interns get a full-time business development role.",
    icon: Rocket,
  },
];

export const hiringProcess = [
  {
    step: 1,
    title: "Apply",
    description:
      "Send your name, college or background, and two lines on why sales interests you.",
  },
  {
    step: 2,
    title: "Short task",
    description:
      "Write the first message you would send to two small businesses. Twenty minutes, no trick questions.",
  },
  {
    step: 3,
    title: "30-minute call",
    description:
      "A video call with the founder about how you think, talk and handle a no.",
  },
  {
    step: 4,
    title: "Offer",
    description: "We decide the same day and you can start within the week.",
  },
];

export const jobOpenings: JobOpening[] = [
  {
    slug: "sales-marketing-internship-ahmedabad-gandhinagar",
    title: "Sales & Marketing Intern (Business Development)",
    department: "Sales & Marketing",
    type: "Internship · Work from home",
    location: "Ahmedabad & Gandhinagar · Work from home",
    summary:
      "Find companies that need a website, app or AI tool built, reach out, and get them on a call with us. Work from home, ₹2,000–5,000 a month plus commission.",
    seoTitle: "Sales & Marketing Internship, Ahmedabad & Gandhinagar (WFH)",
    seoDescription:
      "Work-from-home sales and marketing internship at Bitecodes for students and freshers in Ahmedabad and Gandhinagar. ₹2,000–5,000/month stipend plus commission, 3 months, certificate and full-time offer.",
    employmentType: "INTERN",
    datePosted: "2026-09-28",
    validThrough: "2026-12-31",
    stipend: { currency: "INR", min: 2000, max: 5000, unit: "MONTH" },
    cities: ["Ahmedabad", "Gandhinagar"],
    workFromHome: true,
    duration: "3 months",
    hours: "Minimum 4 hours a day, flexible timing",
    openings: 2,
    responsibilities: [
      "Research companies that need a website, mobile app or AI tool, and find the right person to talk to",
      "Reach out on LinkedIn, email and Upwork, and book discovery calls with the founder",
      "Follow up — most deals come from the third or fourth message, not the first",
      "Post about our work on LinkedIn and Instagram a few times a week",
      "Keep a simple sheet of who you contacted and what happened",
    ],
    requirements: [
      "English good enough to email a client in the US or UK without anyone checking it",
      "Comfortable messaging strangers and hearing no",
      "Interest in technology — you do not need to code, but you can explain what a web app is",
      "A laptop and a stable internet connection at home",
    ],
    whoCanApply: [
      "Students and freshers living in Ahmedabad or Gandhinagar",
      "Any stream — BBA, BCom, MBA, BTech, BA or anything else",
      "Available for at least 4 hours a day for 3 months",
      "Can start immediately",
    ],
    skills: [
      "Lead generation",
      "Cold email",
      "LinkedIn outreach",
      "Social media marketing",
      "Spoken and written English",
      "Google Sheets / Excel",
    ],
    perks: [
      "₹2,000–5,000 monthly stipend",
      "Commission on every closed deal",
      "Internship certificate",
      "Letter of recommendation",
      "Flexible hours",
      "Full-time job offer for strong performers",
    ],
    faqs: [
      {
        question: "Is this internship work from home?",
        answer:
          "Yes. The internship is fully work from home. We hire candidates who live in Ahmedabad or Gandhinagar so we can meet in person when it helps, but you never need to commute to an office.",
      },
      {
        question: "What is the stipend for this internship?",
        answer:
          "The stipend is ₹2,000 to ₹5,000 a month, depending on your hours and experience. On top of that you earn a commission on every client you bring in, with the percentage agreed in writing before you start.",
      },
      {
        question: "Do I need sales experience to apply?",
        answer:
          "No. We care more about clear English, comfort talking to strangers and consistency than about past experience. Freshers and first-year students are welcome.",
      },
      {
        question: "Who can apply from Ahmedabad and Gandhinagar?",
        answer:
          "Any student or fresher living in Ahmedabad or Gandhinagar, from any college and any stream — BBA, BCom, MBA, engineering or arts.",
      },
      {
        question: "How long is the internship and what are the hours?",
        answer:
          "The internship runs for three months. You choose your hours, with a minimum of four hours a day, so it fits around college.",
      },
      {
        question: "Will I get a certificate and a job offer?",
        answer:
          "Every intern who completes the three months gets a certificate and a letter of recommendation. Interns who bring in clients are offered a full-time business development role.",
      },
      {
        question: "How do I apply?",
        answer:
          "Use the Apply button on this page. Tell us your name, college or background and why sales interests you. We reply to every application within two working days.",
      },
    ],
  },
];

export function getJobOpening(slug: string): JobOpening | undefined {
  return jobOpenings.find((j) => j.slug === slug);
}

/** Formats a stipend range as "₹2,000–5,000 / month". */
export function formatStipend(stipend: JobOpening["stipend"]): string {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  return `₹${fmt(stipend.min)}–${fmt(stipend.max)} / month`;
}
