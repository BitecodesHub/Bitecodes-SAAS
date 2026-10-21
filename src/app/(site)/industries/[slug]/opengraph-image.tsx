import { renderOgImage, OG_SIZE } from "@/lib/og";
import { industries, getIndustry } from "@/data/industries";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Bitecodes industry";

export function generateStaticParams() {
  return industries.map((industry) => ({ slug: industry.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const industry = getIndustry(slug);
  return renderOgImage({
    eyebrow: "Industries",
    title: industry?.name ?? "Industry",
    subtitle: industry?.description,
  });
}
