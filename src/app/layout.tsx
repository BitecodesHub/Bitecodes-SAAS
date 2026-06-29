import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/site";
import {
  organizationSchema,
  websiteSchema,
  FEED_ALTERNATE_TYPES,
} from "@/lib/seo";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import { ScrollProgress } from "@/components/scroll-progress";
import { BackToTop } from "@/components/back-to-top";
import { JsonLd } from "@/components/json-ld";
import { MotionProvider } from "@/components/motion/motion-provider";

// Inter — the publicly-available Google Fonts sans that is the standard
// equivalent to Google Sans (which is proprietary / not on Google Fonts).
// One family for body + display keeps the identity clean, modern, and fast.
const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "software outsourcing",
    "web development",
    "Next.js agency",
    "enterprise software",
    "SaaS development",
    "AI integration",
    "MCP servers",
    "Spring Boot",
    "cloud solutions",
  ],
  authors: [{ name: siteConfig.founder }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  alternates: {
    canonical: "/",
    types: FEED_ALTERNATE_TYPES,
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    url: siteConfig.url,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    site: siteConfig.twitterHandle,
    creator: siteConfig.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1b24" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <JsonLd data={organizationSchema()} />
          <JsonLd data={websiteSchema()} />
          <ScrollProgress />
          <MotionProvider>
            <SiteHeader />
            <main id="main" className="flex-1 pt-16">
              {children}
            </main>
            <SiteFooter />
            <BackToTop />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
