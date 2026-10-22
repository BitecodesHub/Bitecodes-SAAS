import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { services } from "@/data/services";
import { projects } from "@/data/projects";
import { jobOpenings } from "@/data/careers";
import { resources } from "@/data/resources";
import { industries } from "@/data/industries";
import { getPublishedPosts } from "@/lib/server/blog/repository";

// Dynamic so newly published (including AI-published) posts appear without a
// redeploy; the blog generator revalidates this path on publish.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const blogPosts = await getPublishedPosts();

  const staticRoutes = [
    { path: "/", priority: 1 },
    { path: "/services", priority: 0.9 },
    { path: "/ai-chatbot", priority: 0.9 },
    { path: "/notes", priority: 0.9 },
    { path: "/forms", priority: 0.9 },
    { path: "/booking", priority: 0.9 },
    { path: "/portfolio", priority: 0.9 },
    { path: "/pricing", priority: 0.8 },
    // The way in. Listed high because "bitecodes sign up" and "bitecodes login"
    // are navigational queries a real customer types, and answering them with
    // the right page beats answering them with the home page. `/verify`,
    // `/reset` and the dashboard itself carry credentials or private data and
    // are `noindex` in next.config.ts.
    { path: "/signup", priority: 0.8 },
    { path: "/login", priority: 0.5 },
    { path: "/tools", priority: 0.9 },
    { path: "/website-audit", priority: 0.9 },
    { path: "/ai-project-consultant", priority: 0.9 },
    { path: "/project-cost-calculator", priority: 0.9 },
    { path: "/website-development-cost-calculator", priority: 0.9 },
    { path: "/mobile-app-cost-calculator", priority: 0.9 },
    { path: "/startup-mvp-cost-calculator", priority: 0.9 },
    { path: "/about", priority: 0.8 },
    { path: "/technologies", priority: 0.7 },
    { path: "/industries", priority: 0.7 },
    { path: "/process", priority: 0.7 },
    { path: "/blog", priority: 0.7 },
    { path: "/careers", priority: 0.8 },
    { path: "/contact", priority: 0.8 },
    { path: "/faq", priority: 0.7 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
    { path: "/refund-policy", priority: 0.3 },
    { path: "/cookies", priority: 0.3 },
    { path: "/disclaimer", priority: 0.3 },
    // Maintenance and offline are operational utility pages and intentionally
    // excluded from the sitemap and search indexing.
    // Machine-readable GEO documents — discoverable via sitemap for AI
    // crawlers. The concise summary and its expanded companion are listed
    // together so a crawler that finds one can reach the other.
    { path: "/llms.txt", priority: 0.3 },
    { path: "/llms-full.txt", priority: 0.3 },
    // Conversion and engagement pages. `/book-a-call` is deliberately absent:
    // it is a 307 to whichever booking destination is configured today, and a
    // sitemap must list the canonical destination, not the redirect. `/thank-you`
    // is reachable only after a form submission and is noindex.
    { path: "/demo", priority: 0.9 },
    { path: "/guarantees", priority: 0.8 },
    // Resources hub
    { path: "/resources", priority: 0.8 },
  ];

  // No `lastModified` for pages whose content is compiled in: there is no
  // honest modification timestamp, and stamping every request's clock teaches
  // crawlers to ignore the field across the whole sitemap.
  const routes: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${base}${r.path}`,
    changeFrequency: "monthly",
    priority: r.priority,
  }));

  const serviceRoutes: MetadataRoute.Sitemap = services.map((s) => ({
    url: `${base}/services/${s.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Open roles change weekly while hiring is active, and Google for Jobs
  // re-crawls postings far more often than marketing pages.
  const jobRoutes: MetadataRoute.Sitemap = jobOpenings.map((j) => ({
    url: `${base}/careers/${j.slug}`,
    lastModified: new Date(j.datePosted),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${base}/portfolio/${p.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    // `updatedAt` when the post has actually been edited since publishing;
    // falls back to the publish date for static posts, which have no
    // independent modification timestamp.
    lastModified: new Date(p.updatedAt ?? p.date),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const resourceRoutes: MetadataRoute.Sitemap = resources.map((r) => ({
    url: `${base}/resources/${r.slug}`,
    lastModified: new Date(r.updated),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const industryRoutes: MetadataRoute.Sitemap = industries.map((i) => ({
    url: `${base}/industries/${i.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    ...routes,
    ...jobRoutes,
    ...serviceRoutes,
    ...projectRoutes,
    ...blogRoutes,
    ...resourceRoutes,
    ...industryRoutes,
  ];
}
