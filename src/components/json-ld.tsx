/**
 * Renders a JSON-LD structured-data script. Server component — no client JS.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is static and built from trusted local config.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
