import { renderOgImage, OG_SIZE } from "@/lib/og";
import { projects, getProject } from "@/data/projects";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Bitecodes case study";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  return renderOgImage({
    eyebrow: project?.category ?? "Portfolio",
    title: project?.name ?? "Case study",
    subtitle: project?.teaser,
  });
}
