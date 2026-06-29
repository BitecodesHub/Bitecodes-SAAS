import {
  ClipboardList,
  Code2,
  Compass,
  LifeBuoy,
  PenTool,
  Rocket,
  TestTube2,
} from "lucide-react";
import type { ProcessStep } from "@/types/content";

export const processSteps: ProcessStep[] = [
  {
    step: 1,
    title: "Discovery",
    icon: Compass,
    description:
      "We start by understanding your goals, users, and constraints — turning a vision into a clear, shared problem statement.",
    deliverables: [
      "Goals & success metrics",
      "Stakeholder interviews",
      "Scope outline",
    ],
  },
  {
    step: 2,
    title: "Planning",
    icon: ClipboardList,
    description:
      "We translate discovery into an architecture, roadmap, and milestone plan you can actually budget and trust.",
    deliverables: [
      "Technical architecture",
      "Roadmap & milestones",
      "Estimates",
    ],
  },
  {
    step: 3,
    title: "UI/UX Design",
    icon: PenTool,
    description:
      "Wireframes and high-fidelity designs make the product tangible before a line of production code is written.",
    deliverables: ["Wireframes", "High-fidelity UI", "Interactive prototype"],
  },
  {
    step: 4,
    title: "Development",
    icon: Code2,
    description:
      "We build in short, reviewable increments — clean code, continuous integration, and demos you can see every week.",
    deliverables: ["Working increments", "Code reviews", "Weekly demos"],
  },
  {
    step: 5,
    title: "Testing",
    icon: TestTube2,
    description:
      "Automated and manual testing across devices and edge cases, so quality is verified — not assumed.",
    deliverables: [
      "Automated tests",
      "Cross-device QA",
      "Accessibility checks",
    ],
  },
  {
    step: 6,
    title: "Deployment",
    icon: Rocket,
    description:
      "We ship to production with zero-downtime releases, monitoring, and a clear rollback path.",
    deliverables: [
      "Production release",
      "Monitoring & alerts",
      "Handover docs",
    ],
  },
  {
    step: 7,
    title: "Maintenance",
    icon: LifeBuoy,
    description:
      "After launch we keep the software healthy — patches, improvements, and responsive support backed by SLAs.",
    deliverables: [
      "Proactive patching",
      "SLA support",
      "Continuous improvement",
    ],
  },
];
