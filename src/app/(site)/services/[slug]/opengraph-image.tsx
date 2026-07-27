import { renderOgImage, OG_SIZE } from "@/lib/og";
import { services, getService } from "@/data/services";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Bitecodes service";

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getService(slug);
  return renderOgImage({
    eyebrow: service?.category ?? "Services",
    title: service?.title ?? "Service",
    subtitle: service?.tagline,
  });
}
