import type { EstimateInput } from "@/lib/cost-estimator";

export interface CalculatorPageConfig {
  slug: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  intro: string;
  keywords: string[];
  initialInput: EstimateInput;
  faqs: { question: string; answer: string }[];
}

export const calculatorPages: CalculatorPageConfig[] = [
  {
    slug: "website-development-cost-calculator",
    eyebrow: "Website planning tool",
    title: "Website development cost calculator",
    accent: "for India",
    description:
      "Estimate professional website development cost in India for a business site, eCommerce store, portal, or custom web experience.",
    intro:
      "Model design depth, commerce, accounts, integrations, admin tooling, delivery priority, and post-launch support without surrendering your email first.",
    keywords: [
      "website development cost India",
      "website price calculator",
      "website quotation",
    ],
    initialInput: {
      projectType: "business-website",
      complexity: "growth",
      platforms: 1,
      features: ["custom-design", "admin", "integrations"],
      urgency: "standard",
      support: "quarter",
    },
    faqs: [
      {
        question: "How much does a professional website cost in India?",
        answer:
          "A focused business website can begin around ₹18,000, while custom eCommerce, portals, integrations, content workflows, and advanced product experiences increase the investment. The calculator shows a planning range based on your selected scope.",
      },
      {
        question: "Does the website estimate include hosting and content?",
        answer:
          "The estimate includes discovery, product design, engineering, QA, deployment, and the support option selected. Hosting, paid software, photography, copywriting, GST, and usage-based third-party services are excluded unless explicitly scoped.",
      },
      {
        question: "Can you redesign an existing website?",
        answer:
          "Yes. We can retain valuable content and integrations while improving information architecture, conversion, accessibility, performance, SEO, and visual identity.",
      },
    ],
  },
  {
    slug: "mobile-app-cost-calculator",
    eyebrow: "Mobile app planning tool",
    title: "Mobile app development cost calculator",
    accent: "for India",
    description:
      "Estimate Android, iOS, Flutter, React Native, or cross-platform mobile app development cost, timeline, and team size in India.",
    intro:
      "Explore the impact of platforms, product complexity, accounts, payments, real-time workflows, AI features, admin operations, and launch support.",
    keywords: [
      "app cost calculator",
      "mobile app development cost India",
      "Android app price",
    ],
    initialInput: {
      projectType: "mobile-app",
      complexity: "growth",
      platforms: 2,
      features: ["custom-design", "authentication", "admin", "integrations"],
      urgency: "standard",
      support: "quarter",
    },
    faqs: [
      {
        question: "How much does mobile app development cost in India?",
        answer:
          "A professional mobile MVP commonly starts around ₹1.3 lakh before scope multipliers. Multiple platforms, real-time features, payments, integrations, compliance, and operational dashboards can materially increase the range.",
      },
      {
        question: "Is cross-platform development less expensive?",
        answer:
          "Flutter or React Native can share product logic and interface work across Android and iOS, but platform-specific integrations, testing, store readiness, and native behavior still require dedicated effort.",
      },
      {
        question: "Are app-store and cloud fees included?",
        answer:
          "No. Apple and Google developer accounts, cloud consumption, maps, messaging, paid APIs, GST, and other third-party charges remain separate unless included in a final proposal.",
      },
    ],
  },
  {
    slug: "startup-mvp-cost-calculator",
    eyebrow: "Founder planning tool",
    title: "Startup MVP cost calculator",
    accent: "for India",
    description:
      "Estimate startup MVP and SaaS development cost, delivery timeline, and product team size for an investor-ready first release.",
    intro:
      "Balance speed, differentiation, technical foundations, accounts, payments, admin operations, integrations, AI, and post-launch iteration.",
    keywords: [
      "startup MVP cost",
      "software development cost",
      "app development cost calculator",
    ],
    initialInput: {
      projectType: "saas-mvp",
      complexity: "growth",
      platforms: 1,
      features: ["custom-design", "authentication", "payments", "admin"],
      urgency: "standard",
      support: "quarter",
    },
    faqs: [
      {
        question: "How much should a startup budget for an MVP in India?",
        answer:
          "A professionally designed and engineered SaaS MVP often begins around ₹1.4 lakh before complexity, platform, feature, urgency, and support adjustments. A narrow validation product can cost less; regulated or operationally complex products cost more.",
      },
      {
        question: "What should an MVP include?",
        answer:
          "It should include the smallest coherent workflow that proves customer value, along with sufficient product design, analytics, security, reliability, and operations to learn safely from real use.",
      },
      {
        question: "Can Bitecodes help define the MVP scope?",
        answer:
          "Yes. Product discovery can turn an early idea into prioritized user journeys, technical architecture, delivery milestones, assumptions, risks, and a fixed proposal.",
      },
    ],
  },
];

export function getCalculatorPage(slug: string) {
  return calculatorPages.find((page) => page.slug === slug);
}
