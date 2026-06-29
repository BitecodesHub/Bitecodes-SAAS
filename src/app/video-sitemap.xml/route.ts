import { xmlResponse } from "@/lib/sitemap-xml";

// Video sitemap. The Bitecodes marketing site has no videos today, so this
// emits a VALID EMPTY <urlset> with the video namespace declared. A namespaced
// empty urlset is valid per sitemaps.org and is the correct placeholder. To
// add a video later, push a <url> containing <loc> (page) and <video:video>
// with <video:thumbnail_loc>, <video:title>, <video:description>, and
// <video:content_loc> (or a <video:player_loc>).
export const dynamic = "force-static";

export function GET(): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
</urlset>
`;

  return xmlResponse(body);
}
