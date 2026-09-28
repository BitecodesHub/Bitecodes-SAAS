import { renderOgImage, OG_SIZE } from "@/lib/og";
import { formatStipend, getJobOpening, jobOpenings } from "@/data/careers";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Bitecodes is hiring";

export function generateStaticParams() {
  return jobOpenings.map((j) => ({ slug: j.slug }));
}

// The card people see when this link is shared on LinkedIn or WhatsApp, so it
// leads with the facts a candidate filters on: pay, place and work mode.
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = getJobOpening(slug);
  return renderOgImage({
    eyebrow: "We are hiring · Internship",
    title: job ? "Sales & Marketing Intern" : "Careers at Bitecodes",
    subtitle: job
      ? `Work from home · ${job.cities.join(" & ")} · ${formatStipend(job.stipend)} + incentives`
      : undefined,
  });
}
