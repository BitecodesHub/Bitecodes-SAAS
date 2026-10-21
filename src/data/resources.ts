import { formatPrice, getPricing } from "@/lib/pricing";

/**
 * The five cornerstone guides in the resources hub.
 *
 * Every guide is written to be useful on its own, with no email required. The
 * printable checklist at the end of each one is the only gated part, and the
 * gate is a fair exchange: an address for a version that is easier to take to a
 * meeting. Prices in the cost guide are derived from `src/lib/pricing.ts` at
 * build time, so the article cannot drift away from what the studio publishes
 * elsewhere.
 */

export type ResourceFormat = "Article" | "HowTo";

export interface ResourceSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  steps?: { title: string; text: string }[];
}

export interface ResourceChecklist {
  title: string;
  description: string;
  items: string[];
}

export interface ResourceFaq {
  question: string;
  answer: string;
}

export interface ResourceGuide {
  slug: string;
  title: string;
  description: string;
  /** Used for the document title and JSON-LD description. */
  metaDescription: string;
  category:
    | "Websites"
    | "Hiring"
    | "AI and automation"
    | "Performance"
    | "Budgeting";
  format: ResourceFormat;
  published: string;
  updated: string;
  readingMinutes: number;
  intro: string[];
  sections: ResourceSection[];
  /** Steps for HowTo structured data, mirroring the visible instructions. */
  howToSteps?: { name: string; text: string }[];
  checklist?: ResourceChecklist;
  faqs?: ResourceFaq[];
  relatedSlugs: string[];
}

function publishedPrice(slug: string): string | null {
  const pricing = getPricing(slug);
  if (!pricing) return null;
  return formatPrice(pricing.startingFromUSD, "INR");
}

const websitePrice = publishedPrice("website-development");
const webAppPrice = publishedPrice("web-applications");
const saasPrice = publishedPrice("saas-development");
const automationPrice = publishedPrice("business-automation");
const maintenancePrice = publishedPrice("maintenance-support");
const consultingPrice = publishedPrice("technical-consulting");
const designPrice = publishedPrice("ui-ux-development");
const performancePrice = publishedPrice("performance-optimization");

export const resources: ResourceGuide[] = [
  {
    slug: "website-launch-checklist-clinics",
    title: "Website launch checklist for clinics and allied health practices",
    description:
      "A practical pre-launch checklist covering bookings, patient privacy, accessibility, performance, and the handover every practice should insist on.",
    metaDescription:
      "A practical website launch checklist for clinics and allied health practices in India and Australia: bookings, patient privacy, accessibility, speed, analytics, and handover.",
    category: "Websites",
    format: "HowTo",
    published: "2026-10-18",
    updated: "2026-10-18",
    readingMinutes: 9,
    intro: [
      "A clinic website has a different job from a brochure. It has to help an anxious person find the right practitioner, understand the cost, and book without calling during opening hours. It also handles health information, which raises the standard for privacy and consent.",
      "This checklist is the one a practice manager and a developer should walk through together in the final week. It is written for clinics and allied health practices in India and Australia, and it assumes the practice, not the web developer, remains responsible for patient information.",
    ],
    sections: [
      {
        heading: "Start with the patient journey, not the home page",
        paragraphs: [
          "Write down the three most common reasons a patient contacts the practice. In most clinics these are booking an appointment, asking about fees or insurance, and finding the right practitioner for a specific concern. Every one of those paths should be reachable in two clicks from any page.",
          "Test the journey on a phone, because that is where most local health searches happen. Use the practice's own phone and a slow mobile connection if possible. A booking flow that works on a desktop but hides the phone number on a small screen is not finished.",
        ],
        bullets: [
          "The practice phone number is tappable and visible without opening a menu.",
          "The booking button appears on every service and practitioner page.",
          "Fees, cancellation terms, and what to bring to a first appointment are stated in plain language.",
          "Opening hours, the physical address, and parking or transport notes are correct and easy to find.",
          "The page states what to do outside opening hours and in an emergency, without presenting the website as a medical service.",
        ],
      },
      {
        heading: "Protect patient information before the first submission",
        paragraphs: [
          "A booking form is not automatically a secure clinical intake form. Collect only what the appointment requires, such as a name, contact number, and preferred time. Do not ask for symptoms, Medicare or NDIS numbers, or insurance details unless the practice has agreed how that information is stored, who can read it, and how long it is kept.",
          "If the website sends form submissions by email, confirm that the mailbox is appropriate for health information. Free consumer mailboxes are not a good default. A practice should know where every submission goes, who has access, and how it is deleted.",
        ],
        bullets: [
          "The privacy policy names the practice, explains why information is collected, and gives a contact for privacy questions.",
          "Every form has an explicit consent line if the information will be used for anything beyond the appointment.",
          "The website runs on HTTPS everywhere, with no mixed-content warnings in the browser console.",
          "Analytics and advertising scripts are not collecting form contents, keystrokes, or session recordings on health pages.",
          "The practice has confirmed that any third-party booking or chat tool meets its own privacy obligations.",
        ],
      },
      {
        heading: "Make accessibility a launch requirement",
        paragraphs: [
          "A clinic serves people with low vision, hearing loss, motor impairments, and cognitive load from illness. Accessibility is not a separate project after launch. The minimum is a site that can be read and operated by keyboard, has readable contrast, and uses headings in a sensible order.",
          "Run an automated checker, then test by hand. Automated tools catch perhaps a third of real issues, and the important failures are often in the booking flow, the form labels, and the PDFs that patients are asked to download.",
        ],
        bullets: [
          "Every image that carries meaning has a text alternative, and decorative images are marked as decorative.",
          "Every form field has a visible label, not only a placeholder.",
          "The page can be used at 200 percent zoom without content disappearing or overlapping.",
          "Colour is not the only way to communicate an error, a status, or a required field.",
          "Downloadable intake forms are accessible PDFs, not photographed paper.",
          "The skip link, focus outlines, and keyboard navigation work in the booking flow.",
        ],
      },
      {
        heading: "Check speed and reliability on the devices patients use",
        paragraphs: [
          "Patients arrive from search results, maps, and social links, often on a mobile network. A large hero video and a dozen third-party scripts will make the first impression slow. Compress images, load only the scripts the page needs, and test a real page from a mobile connection rather than a desktop on office Wi-Fi.",
          "Reliability matters as much as speed. Confirm what happens when the booking provider is unavailable: does the page explain it, and is there a phone number or email fallback? A failed booking with no fallback is a lost patient.",
        ],
        bullets: [
          "The largest image on the home page is compressed and sized for the space it occupies.",
          "Fonts are loaded deliberately, without blocking the first render.",
          "The booking and contact forms show a clear confirmation and a reference number.",
          "The site has a 404 page that offers the booking link and the phone number.",
          "The practice knows who to contact if the site or booking tool goes down.",
        ],
      },
      {
        heading: "Agree the handover before launch day",
        paragraphs: [
          "The most common post-launch problem is not a broken page. It is a practice that cannot change its own opening hours, add a practitioner, or update a fee without waiting for a developer. Decide what the practice will own before the site goes live.",
          "Ask for the domain and hosting account in the practice's name, a documented way to edit the content it will need to change, and a written record of every account and service attached to the website. A developer should be able to leave without taking the website with them.",
        ],
        bullets: [
          "The domain is registered to the practice or its nominated owner, not only to the developer.",
          "The hosting, analytics, booking, and email accounts are documented with the practice as owner where possible.",
          "The practice has a short written guide for the edits it will make, such as hours, fees, and practitioner profiles.",
          "There is a named person and a response time for support after launch, in writing.",
          "A backup or export of the content has been taken and stored somewhere the practice can reach.",
        ],
      },
    ],
    howToSteps: [
      {
        name: "Map the patient journey",
        text: "Write down the three most common patient tasks and confirm each is reachable in two clicks on a phone.",
      },
      {
        name: "Review privacy and forms",
        text: "Confirm the privacy policy, consent lines, HTTPS, and where every form submission is stored and who can read it.",
      },
      {
        name: "Test accessibility",
        text: "Use a keyboard, a screen reader, and an automated checker on the booking flow, forms, and downloadable documents.",
      },
      {
        name: "Test speed and failure paths",
        text: "Check the main pages on a mobile connection and confirm what patients see when booking is unavailable.",
      },
      {
        name: "Complete the handover",
        text: "Put the domain and accounts in the practice's name and exchange a written support agreement and content guide.",
      },
    ],
    checklist: {
      title: "Printable clinic website launch checklist",
      description:
        "A one-page checklist you can take to the final pre-launch meeting, grouped by patient journey, privacy, accessibility, reliability, and handover.",
      items: [
        "Phone number is tappable and visible without opening the menu.",
        "Booking link appears on every service and practitioner page.",
        "Fees, cancellation terms, and first-appointment instructions are stated.",
        "Opening hours, address, and transport notes are correct.",
        "Out-of-hours and emergency guidance is clear and not framed as medical advice.",
        "Privacy policy names the practice and explains collection and retention.",
        "Booking forms collect only what the appointment needs.",
        "No health details are requested unless storage and access are agreed.",
        "HTTPS is active on every page and no mixed-content warnings appear.",
        "Analytics and chat tools do not record form contents or health pages.",
        "Every form field has a visible label.",
        "Images that carry meaning have text alternatives.",
        "The site works at 200 percent zoom and with a keyboard.",
        "Error messages do not rely on colour alone.",
        "Downloadable intake forms are accessible PDFs.",
        "The home page loads a compressed hero image, not a large video.",
        "The booking form shows a confirmation and reference.",
        "The 404 page offers booking and phone options.",
        "The domain and hosting are in the practice's name.",
        "A written support contact and response time exist for after launch.",
      ],
    },
    faqs: [
      {
        question:
          "Is a website booking form suitable for clinical information?",
        answer:
          "Only if the practice has decided how that information is stored, who can access it, and how long it is kept. A simple appointment request should collect the minimum needed to contact the patient and reserve a time. Clinical details belong in the practice management system, not in a marketing website form.",
      },
      {
        question: "Do we need a separate accessibility audit?",
        answer:
          "A short manual check is part of launch. A formal audit is worth commissioning when the practice serves a large number of patients with access needs, or when the site is being procured by a hospital or government programme that requires evidence of conformance. Automated scores alone are not evidence.",
      },
    ],
    relatedSlugs: [
      "questions-before-hiring-software-studio",
      "website-speed-checklist",
    ],
  },
  {
    slug: "questions-before-hiring-software-studio",
    title: "Twenty questions to ask before hiring a software studio",
    description:
      "Questions that reveal how a studio scopes, estimates, documents, and hands over work, with notes on what a good answer sounds like.",
    metaDescription:
      "Twenty practical questions to ask a software studio before signing: scope, estimates, code ownership, security, testing, support, and handover, with notes on good answers.",
    category: "Hiring",
    format: "Article",
    published: "2026-10-18",
    updated: "2026-10-18",
    readingMinutes: 10,
    intro: [
      "Most studio websites look the same from the outside. The differences appear in how a team answers questions about scope, ownership, and the unglamorous work after launch. These twenty questions are designed to surface those differences before money changes hands.",
      "They are not a trick. A good studio will welcome most of them, and a studio that treats a request for a written scope or a code ownership clause as distrust is telling you something useful.",
    ],
    sections: [
      {
        heading: "Scope and estimates",
        paragraphs: [
          "An estimate without a written scope is a number, not a commitment. Ask how the studio turns a conversation into a fixed scope, what happens when the scope changes, and which parts of the estimate are assumptions rather than prices.",
          "Be wary of a quote that is dramatically below every other quote without a written explanation. It usually means a smaller scope, a less experienced team, or an estimate that will grow after the contract is signed.",
        ],
        bullets: [
          "1. What exactly is included in this price, and what is explicitly excluded?",
          "2. Which assumptions would change the estimate if they turn out to be wrong?",
          "3. How do you handle a change request after the scope is agreed?",
          "4. What does a typical project timeline look like, including review time on our side?",
          "5. What do you need from us, and by when, for the timeline to hold?",
        ],
      },
      {
        heading: "Team and process",
        paragraphs: [
          "Ask who will actually do the work. A senior person in the sales meeting is not a guarantee that the same person will write the code. Ask for the roles, the expected involvement, and how the team communicates across time zones.",
          "A studio that works with clients in another country should be able to describe its overlap hours, its written update rhythm, and how decisions are recorded. Weekly demos are more useful than a status report that says everything is on track.",
        ],
        bullets: [
          "6. Who will be the day-to-day contact, and who makes technical decisions?",
          "7. Which parts are done in-house, and which are subcontracted?",
          "8. How often will we see working software, and in what form?",
          "9. How do you record decisions and changes so both sides can find them later?",
          "10. What are your normal working hours, and how many hours overlap with our team?",
        ],
      },
      {
        heading: "Code, data, and ownership",
        paragraphs: [
          "You are paying for an asset, not renting access to one. The contract should state that the custom code and content are yours on final payment, and that third-party components are licensed in a way your business can keep using.",
          "Ask where the code lives, who controls the repository, and what happens if the relationship ends. A studio that hosts everything on its own account without an export path creates a dependency that is difficult to undo.",
        ],
        bullets: [
          "11. Who owns the custom code, designs, and content when the project is paid for?",
          "12. Will the source code live in a repository we can access, and can we add our own developers?",
          "13. Which third-party licences are used, and are any of them restrictive for commercial use?",
          "14. What happens to our data and code if we stop working together?",
        ],
      },
      {
        heading: "Security, testing, and operations",
        paragraphs: [
          "Security is a process, not a badge. Ask how the studio handles secrets, access, dependencies, and backups. Ask what testing is automated and what is checked by hand. A studio that cannot describe its own practices in plain language is unlikely to document them for you.",
          "For anything that takes payments or holds personal information, ask who is responsible for monitoring, patching, and responding to incidents after launch. The answer should name a person or a process, not a promise to be careful.",
        ],
        bullets: [
          "15. How are passwords, API keys, and production access managed?",
          "16. What automated tests run before a release, and what is tested manually?",
          "17. How are dependencies and security patches handled after launch?",
          "18. What monitoring and backups are in place, and who checks them?",
        ],
      },
      {
        heading: "Support and handover",
        paragraphs: [
          "The end of a project is where many good builds become difficult. Ask for a written handover: a short architecture note, a deployment guide, a list of accounts and services, and a named support contact. If the studio cannot produce this at the start, ask why.",
          "Finally, ask for a reference you can actually contact, and ask that reference what went wrong as well as what went well. Every project has friction. The useful question is how the studio behaved when it appeared.",
        ],
        bullets: [
          "19. What does handover include, and will we receive documentation we can act on?",
          "20. Can we speak to a client whose project had a problem, and what happened?",
        ],
      },
    ],
    checklist: {
      title: "Printable studio shortlist scorecard",
      description:
        "The twenty questions as a scorecard with space for notes, so two people can compare shortlisted studios on the same criteria.",
      items: [
        "Written scope with inclusions and exclusions.",
        "Assumptions that could change the estimate are named.",
        "Change-request process is documented.",
        "Timeline includes client review time.",
        "Client responsibilities and deadlines are stated.",
        "Day-to-day contact and technical decision maker are named.",
        "In-house and subcontracted work are distinguished.",
        "Working software is demonstrated regularly.",
        "Decisions and changes are recorded in writing.",
        "Overlap hours and communication rhythm are agreed.",
        "Custom code, designs, and content ownership are stated in the contract.",
        "Repository access and exit path are clear.",
        "Third-party licences are listed and suitable for commercial use.",
        "Data and code return process is documented.",
        "Secrets and production access are managed securely.",
        "Automated and manual testing are described.",
        "Dependency and security patching after launch are assigned.",
        "Monitoring, backups, and incident response are named.",
        "Handover documentation is specified.",
        "A reference client is available to speak with.",
      ],
    },
    relatedSlugs: [
      "website-launch-checklist-clinics",
      "how-much-business-website-costs-india-2026",
    ],
  },
  {
    slug: "ai-chatbot-readiness-checklist",
    title: "AI chatbot readiness checklist for service businesses",
    description:
      "What to prepare before an AI assistant answers customers: content, boundaries, escalation, privacy, cost control, and a way to measure whether it helps.",
    metaDescription:
      "An AI chatbot readiness checklist for service businesses: content quality, fallback answers, escalation, privacy, consent, cost limits, testing, and measurement.",
    category: "AI and automation",
    format: "HowTo",
    published: "2026-10-18",
    updated: "2026-10-18",
    readingMinutes: 8,
    intro: [
      "An AI assistant is only as useful as the material it is allowed to use and the boundaries it is given. A chatbot that invents an opening time or a price is worse than a contact form, because it sounds confident while being wrong.",
      "This checklist is for a service business preparing its first customer-facing assistant. It covers the work that happens before launch, not the choice of model.",
    ],
    sections: [
      {
        heading: "Decide what the assistant is for",
        paragraphs: [
          "Write one sentence that describes the job. Good examples are answering questions about services and hours, helping a visitor choose the right service, and handing a ready buyer to a booking page. A bad example is answering anything a customer asks.",
          "Decide what the assistant must not do. It should not diagnose, give legal or medical advice, quote a fixed price for custom work, promise a delivery date, or collect payment details. Those boundaries belong in the system prompt and in the content the assistant is allowed to retrieve.",
        ],
        bullets: [
          "The purpose is written in one sentence.",
          "The questions it should answer are listed with example phrasings.",
          "The topics it must refuse or hand over are listed.",
          "A named person owns the assistant and its content.",
        ],
      },
      {
        heading: "Prepare content that is current and specific",
        paragraphs: [
          "The assistant can only be accurate if the source material is accurate. Collect the current service descriptions, fees or fee ranges, opening hours, locations, cancellation terms, and the answers to the questions the front desk hears every week. Remove old pages and duplicate versions before importing anything.",
          "Write answers in short paragraphs. A page written for search engines often contains several ideas in one block, which makes retrieval less precise. A question-and-answer format, with one topic per entry, works better for both customers and retrieval.",
        ],
        bullets: [
          "Service descriptions and prices match the current offer.",
          "Opening hours and contact details are current, including public holidays.",
          "Cancellation, refund, and privacy terms are included.",
          "Old or duplicate content is removed, not merely hidden.",
          "A content owner and a review date are recorded.",
        ],
      },
      {
        heading: "Design the fallback and the handover",
        paragraphs: [
          "The most important answer is the one the assistant gives when it does not know. It should say so plainly, offer the contact route, and not fill the gap with a guess. Test this by asking questions that are deliberately outside the knowledge base.",
          "Define how a conversation reaches a person. For a clinic, that may be a phone number during opening hours. For a software studio, it may be a form or a booking link. The handover should be visible in the conversation, not buried in a footer.",
        ],
        bullets: [
          "The fallback answer is written, tested, and does not guess.",
          "The handover route is a phone number, form, booking link, or email that someone monitors.",
          "The assistant does not claim to be human.",
          "Conversations that need a person are flagged for review.",
        ],
      },
      {
        heading: "Set privacy, consent, and retention rules",
        paragraphs: [
          "A chat conversation can contain personal information even when the business did not ask for it. Decide what is stored, where it is stored, who can read it, and how long it is kept. If the assistant offers to send a transcript or follow up by email, the consent line must be explicit and unticked by default.",
          "Check the provider's data terms as well. Some providers retain prompts for training unless configured otherwise. The business remains responsible for what customers are told, regardless of which model answers.",
        ],
        bullets: [
          "The privacy policy mentions the assistant and the provider category.",
          "The assistant asks for an email only when a reply is needed.",
          "Any marketing consent is a separate, unticked checkbox.",
          "Retention and deletion are decided and documented.",
          "Staff know how to find and remove a conversation on request.",
        ],
      },
      {
        heading: "Control cost and test before launch",
        paragraphs: [
          "Set a budget per conversation or per month, and decide what happens when it is reached. A hard stop with an honest message is better than a silent failure or an unexpected bill. Test with the questions real customers ask, including the awkward ones.",
          "Run a small pilot with staff before the public sees it. Ask them to try to break it, and record every wrong answer. A launch with twenty known failures is easier to improve than a launch with no review at all.",
        ],
        bullets: [
          "A spend limit and a behaviour at the limit are configured.",
          "At least thirty real customer questions have been tested.",
          "Wrong answers are recorded with the source material that caused them.",
          "Staff can pause the assistant without a developer.",
          "A weekly review of unanswered questions is scheduled.",
        ],
      },
    ],
    howToSteps: [
      {
        name: "Define the job",
        text: "Write the assistant's purpose, the topics it covers, and the topics it must refuse or hand over.",
      },
      {
        name: "Clean the knowledge base",
        text: "Collect current services, fees, hours, and policies in short question-and-answer entries and remove old versions.",
      },
      {
        name: "Write the fallback and handover",
        text: "Decide what the assistant says when it does not know and how the conversation reaches a person.",
      },
      {
        name: "Agree privacy and retention",
        text: "Document what is stored, who can read it, how long it is kept, and the consent wording for email follow-up.",
      },
      {
        name: "Pilot and measure",
        text: "Set a spend limit, test real questions with staff, and schedule a weekly review of wrong and unanswered answers.",
      },
    ],
    checklist: {
      title: "Printable AI chatbot readiness checklist",
      description:
        "The preparation checklist for a first customer-facing assistant, including content, boundaries, privacy, cost, and launch tests.",
      items: [
        "One-sentence purpose is agreed.",
        "Topics to answer and topics to refuse are listed.",
        "A named owner and review date exist for the content.",
        "Service descriptions and prices are current.",
        "Opening hours and contact details are current.",
        "Cancellation, refund, and privacy terms are included.",
        "Old and duplicate content has been removed.",
        "The fallback answer is written and tested.",
        "A monitored handover route is visible in the conversation.",
        "The assistant does not claim to be human.",
        "The privacy policy mentions the assistant and provider type.",
        "Email capture has an explicit, unticked consent line.",
        "Retention and deletion rules are documented.",
        "Staff can find and remove a conversation on request.",
        "A spend limit and behaviour at the limit are configured.",
        "At least thirty real customer questions have been tested.",
        "Wrong answers are recorded with their source cause.",
        "Staff can pause the assistant without a developer.",
        "A weekly unanswered-question review is scheduled.",
        "A launch note explains what the assistant can and cannot do.",
      ],
    },
    relatedSlugs: [
      "website-speed-checklist",
      "questions-before-hiring-software-studio",
    ],
  },
  {
    slug: "website-speed-checklist",
    title: "Website speed checklist: what actually slows a small business site",
    description:
      "A developer-friendly checklist for finding and fixing the common causes of a slow business website, without chasing a single score.",
    metaDescription:
      "A practical website speed checklist for small businesses: images, fonts, scripts, hosting, caching, layout shift, measurement, and what to fix first.",
    category: "Performance",
    format: "HowTo",
    published: "2026-10-18",
    updated: "2026-10-18",
    readingMinutes: 8,
    intro: [
      "Speed is not a single score. It is how long a customer waits before the page is useful, how much the layout jumps while it loads, and whether the booking button responds when tapped. A site can score well in a laboratory and still feel slow on a phone in a clinic waiting room.",
      "This checklist starts with measurement and then moves through the causes that produce the largest gains for a typical small business website.",
    ],
    sections: [
      {
        heading: "Measure the pages that matter",
        paragraphs: [
          "Do not optimise the home page alone. Measure the pages customers actually use: the main service page, the contact page, and the booking or checkout flow. Run the test on a throttled mobile connection, not office broadband.",
          "Record three numbers before changing anything: the time until the main content is visible, the total page weight, and the number of requests. Without a before-and-after record it is impossible to know whether a change helped.",
        ],
        bullets: [
          "Test the home page, one service page, and the booking or contact flow.",
          "Use a mobile profile with a slow connection and a mid-range device.",
          "Record the page weight, request count, and main-content timing.",
          "Repeat the same test after each change.",
        ],
      },
      {
        heading: "Fix images first",
        paragraphs: [
          "Images are usually the largest download on a small business site. A photograph straight from a phone can be several megabytes. Resize it to the largest size it will actually display, compress it, and use a modern format where the browser supports it.",
          "Do not lazy-load the image that is visible at the top of the page. Do lazy-load images further down. Give every image explicit width and height so the page does not jump as it loads.",
        ],
        bullets: [
          "Hero images are compressed and no larger than the space they fill.",
          "Images below the fold use lazy loading.",
          "Every image has width and height attributes.",
          "Decorative video does not autoplay with sound or block the first render.",
        ],
      },
      {
        heading: "Audit third-party scripts",
        paragraphs: [
          "Every chat widget, tracking pixel, heatmap, font loader, and embedded map adds a request and often its own JavaScript. Some are worth it. Many were added for a campaign that ended two years ago and nobody has removed them.",
          "List every third-party script, who owns it, and what it does. Remove what is not used. Load the rest after the main content, and prefer a provider that offers a lightweight or server-side option.",
        ],
        bullets: [
          "A list of third-party scripts exists with an owner for each.",
          "Unused tracking, chat, and marketing scripts are removed.",
          "Non-critical scripts load after the main content.",
          "Fonts are self-hosted or loaded with a deliberate display strategy.",
          "A map embed is replaced with a link or an image where an interactive map is not essential.",
        ],
      },
      {
        heading: "Use caching and a suitable host",
        paragraphs: [
          "A fast page still feels slow if the server takes a second to respond. Check the time to first byte from the regions your customers use. A host in one country serving customers on another continent needs a content delivery network or a closer region.",
          "Caching helps static assets and, where the platform supports it, rendered pages. Configure long cache lifetimes for versioned files such as images, fonts, and compiled scripts. Do not cache personal or booking pages in a shared cache.",
        ],
        bullets: [
          "Time to first byte is measured from the customers' region.",
          "Static assets have long cache lifetimes with versioned file names.",
          "Personal and booking pages are excluded from shared caches.",
          "Images and scripts are served from a CDN when the audience is international.",
        ],
      },
      {
        heading: "Fix layout shift and interaction delays",
        paragraphs: [
          "A page that moves while a customer is about to tap the booking button causes real errors, especially on a phone. Reserve space for images, banners, consent notices, and embedded widgets. Load the consent notice in a way that does not push the whole page down after it appears.",
          "Check the main thread as well. A large JavaScript bundle can make the page look ready while taps are ignored for a second or more. Remove unused code, split what is not needed on first load, and test the booking flow on a mid-range Android phone.",
        ],
        bullets: [
          "Space is reserved for images, banners, and embedded widgets.",
          "The consent notice does not push content down after it loads.",
          "The booking button responds immediately on a mid-range phone.",
          "Large client-side JavaScript is split or removed.",
        ],
      },
    ],
    howToSteps: [
      {
        name: "Measure a baseline",
        text: "Test the home page, a service page, and the booking flow on a throttled mobile profile and record weight, requests, and main-content timing.",
      },
      {
        name: "Compress and size images",
        text: "Resize images to their display size, compress them, use modern formats, and set width and height on every image.",
      },
      {
        name: "Remove unnecessary scripts",
        text: "List every third-party script with an owner, remove the unused ones, and defer the rest.",
      },
      {
        name: "Fix hosting and caching",
        text: "Measure time to first byte from the customer region, use a suitable host or CDN, and set long cache lifetimes for versioned assets.",
      },
      {
        name: "Remove layout shift",
        text: "Reserve space for images, banners, and widgets, and re-test the booking flow on a mid-range phone.",
      },
    ],
    checklist: {
      title: "Printable website speed checklist",
      description:
        "A one-page checklist for a developer or site owner, with the measurement steps and the fixes that produce the largest gains.",
      items: [
        "Home page, one service page, and the booking flow are tested.",
        "A throttled mobile profile is used, not office broadband.",
        "Baseline weight, requests, and main-content timing are recorded.",
        "Hero images are compressed and correctly sized.",
        "Images below the fold use lazy loading.",
        "Every image has width and height attributes.",
        "Decorative video does not block the first render.",
        "Every third-party script has a named owner.",
        "Unused tracking and marketing scripts are removed.",
        "Non-critical scripts load after the main content.",
        "Fonts are self-hosted or loaded with a deliberate strategy.",
        "Time to first byte is measured from the customer region.",
        "Versioned static assets use long cache lifetimes.",
        "Personal and booking pages are excluded from shared caches.",
        "Space is reserved for images, banners, and widgets.",
        "The consent notice does not push the page down.",
        "The booking button responds on a mid-range phone.",
        "Large client-side JavaScript is split or removed.",
        "The before-and-after numbers are recorded.",
        "A repeat test is scheduled after launch.",
      ],
    },
    relatedSlugs: [
      "website-launch-checklist-clinics",
      "ai-chatbot-readiness-checklist",
    ],
  },
  {
    slug: "how-much-business-website-costs-india-2026",
    title: "How much a business website costs in India in 2026",
    description:
      "A transparent breakdown of what drives website cost in India, with Bitecodes' published starting prices and the costs that sit outside the build.",
    metaDescription:
      "How much a business website costs in India in 2026: published starting prices, what changes the scope, domain and hosting, content, maintenance, and GST.",
    category: "Budgeting",
    format: "Article",
    published: "2026-10-18",
    updated: "2026-10-18",
    readingMinutes: 9,
    intro: [
      "A website quote is not a single number with a single explanation. The same five-page site can be a template with stock photographs or a custom build with a booking system and a content migration, and those are different products.",
      "This guide explains what drives the cost, lists Bitecodes' published starting prices in Indian rupees, and names the costs that sit outside the build so a budget is not surprised later.",
    ],
    sections: [
      {
        heading: "What the published starting prices mean",
        paragraphs: [
          "Bitecodes publishes a starting price for each service. It is a floor for a scoped engagement, not a quote for your project. The final price depends on the number of pages, the design work, the integrations, the content, and the amount of migration and testing.",
          "The prices below come from the same source used on the pricing and service pages, converted at the published exchange rate. They are shown in Indian rupees and exclude GST, domain and hosting fees, paid stock photography, and third-party subscriptions unless stated otherwise.",
        ],
        bullets: [
          `Website development: from ${websitePrice ?? "the published starting price"}.`,
          `Web application: from ${webAppPrice ?? "the published starting price"}.`,
          `SaaS product development: from ${saasPrice ?? "the published starting price"}.`,
          `Business automation: from ${automationPrice ?? "the published starting price"}.`,
          `Maintenance and support: from ${maintenancePrice ?? "the published starting price"} per month.`,
          `Technical consulting: from ${consultingPrice ?? "the published starting price"} per hour.`,
          `UI and UX design: from ${designPrice ?? "the published starting price"}.`,
          `Performance optimisation: from ${performancePrice ?? "the published starting price"}.`,
        ],
      },
      {
        heading: "The scope decisions that move the price most",
        paragraphs: [
          "Design and content are the two largest variables. A custom design for a small site takes longer than adapting a well-built template, and content that has to be written, edited, or migrated takes longer than content supplied in a finished form. Neither is inherently better; they are different levels of effort.",
          "Integrations are the next largest. A booking calendar, a payment gateway, a CRM connection, or a customer portal adds work for the build, the testing, and the handover. A website that needs to work with an existing practice management system should expect a discovery step before a fixed price is possible.",
        ],
        bullets: [
          "Number of unique page designs, not only the number of pages.",
          "Copywriting, editing, photography, and content migration.",
          "Booking, payments, CRM, or learning-management integrations.",
          "Multi-language content and regional pricing.",
          "Accessibility and procurement requirements from a larger client.",
          "Data migration from an old site or system.",
        ],
      },
      {
        heading: "Costs outside the build",
        paragraphs: [
          "A complete budget includes the ongoing services that keep the site online and useful. Domain registration, hosting, email, analytics, and any booking or chat subscription are usually billed separately. So are paid stock images, custom photography, and third-party fonts.",
          "In India, GST applies to the service. Ask whether a quote includes GST and whether it includes the third-party costs. A lower quote that excludes both can be more expensive than a higher quote that includes them.",
        ],
        bullets: [
          "Domain registration and renewal.",
          "Hosting, CDN, and managed database costs.",
          "Business email and any transactional email service.",
          "Booking, chat, analytics, or marketing subscriptions.",
          "Paid stock photography, custom photography, and copywriting.",
          "GST and any applicable taxes.",
          "Maintenance, security patching, and support after launch.",
        ],
      },
      {
        heading: "How to compare quotes fairly",
        paragraphs: [
          "Ask every studio for the same three documents: a written scope, a list of exclusions and assumptions, and a payment schedule tied to milestones. Compare the scope line by line, not the headline price. A quote that omits content migration or testing is not cheaper; it is a different project.",
          "Ask what happens after launch. A site without a support agreement, a backup, and a documented handover is a liability disguised as a saving. The cheapest responsible option is usually the one that names who does that work and what it costs.",
        ],
        bullets: [
          "A written scope with inclusions and exclusions.",
          "A list of assumptions that would change the price.",
          "A milestone payment schedule, not a single upfront payment.",
          "A named support arrangement after launch.",
          "A handover list: domain, hosting, accounts, documentation.",
        ],
      },
      {
        heading: "A sensible way to set the budget",
        paragraphs: [
          "Decide what the website must do in the next twelve months, not what it might do eventually. A first version that handles the main services, the booking path, and the contact route is usually a better investment than a larger site that launches late.",
          "Hold a separate budget for the first three months after launch. That is when real customer behaviour appears, small content changes are needed, and the first round of improvements becomes obvious. A launch is the start of the work, not the end of the invoice.",
        ],
        bullets: [
          "Start with the smallest version that serves the main customer journey.",
          "Keep a separate budget for post-launch changes.",
          "Plan the content before the design, not after.",
          "Agree what will be measured and reviewed after three months.",
        ],
      },
    ],
    checklist: {
      title: "Printable website budget checklist",
      description:
        "A checklist for comparing website quotes and building a complete budget, including the costs that are often left out.",
      items: [
        "The written scope lists every page and feature.",
        "The quote states what is excluded.",
        "Assumptions that could change the price are named.",
        "GST and third-party costs are shown separately.",
        "Domain and hosting costs are confirmed for year one.",
        "Email and transactional email services are included.",
        "Booking, chat, analytics, and marketing subscriptions are listed.",
        "Content writing, editing, photography, and migration are priced.",
        "Payment milestones are tied to deliverables.",
        "The proposal states who owns the code and content.",
        "The handover list includes domain, hosting, and accounts.",
        "A support and maintenance arrangement is priced.",
        "A separate post-launch budget is set aside.",
        "The first three months of changes have a named owner.",
        "The proposal includes a realistic timeline with review time.",
        "At least two quotes are compared on the same scope.",
        "The cheapest quote is checked for missing work.",
        "The decision is based on scope, support, and ownership, not price alone.",
      ],
    },
    relatedSlugs: [
      "questions-before-hiring-software-studio",
      "website-launch-checklist-clinics",
    ],
  },
];

export function getResource(slug: string): ResourceGuide | undefined {
  return resources.find((resource) => resource.slug === slug);
}

export function relatedResources(resource: ResourceGuide): ResourceGuide[] {
  return resource.relatedSlugs
    .map((slug) => getResource(slug))
    .filter((item): item is ResourceGuide => Boolean(item));
}

export const resourceCategories = [
  ...new Set(resources.map((resource) => resource.category)),
];
