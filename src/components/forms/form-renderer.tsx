"use client";

import { useState } from "react";
import type { FormAppearance, FormField } from "@/lib/server/db/types";
import { isNavigableHttpUrl } from "@/lib/navigable-url";

/**
 * The autocomplete token for a field, so browsers and password managers can fill
 * it. Without one a visitor retypes their name, email and phone by hand on every
 * form — worst on mobile, and this is a lead-capture product where an abandoned
 * form is a lost customer.
 *
 * Derived from the field type and its name, because a form owner labels fields in
 * their own words and only the type is reliable.
 */
function autoCompleteFor(type: string, name: string): string | undefined {
  if (type === "email") return "email";
  if (type === "phone") return "tel";
  const n = name.toLowerCase();
  if (/(^|_)(first|given)/.test(n)) return "given-name";
  if (/(^|_)(last|family|surname)/.test(n)) return "family-name";
  if (/name/.test(n)) return "name";
  if (/compan|organi/.test(n)) return "organization";
  if (/city|town/.test(n)) return "address-level2";
  if (/country/.test(n)) return "country-name";
  if (/(zip|post)/.test(n)) return "postal-code";
  return undefined;
}

/**
 * Renders one customer form and posts it to the public submit endpoint.
 *
 * Used by the hosted page at `/form/[formId]` (the iframe target). The embedded
 * `<script>` path renders the same fields in a Shadow DOM instead — see
 * `src/app/form-widget.js/route.ts`. Both post the identical JSON body, so the
 * server has one submission contract to validate.
 */
export function FormRenderer({
  formId,
  publicToken,
  fields,
  appearance,
  honeypotField,
  thankYouMessage,
  redirectUrl,
}: {
  formId: string;
  publicToken: string;
  fields: Pick<
    FormField,
    | "type"
    | "name"
    | "label"
    | "placeholder"
    | "required"
    | "options"
    | "maxLength"
  >[];
  appearance: FormAppearance;
  honeypotField: string | null;
  thankYouMessage: string;
  redirectUrl: string | null;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [trap, setTrap] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  function set(name: string, value: string | boolean) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const body: Record<string, unknown> = { _token: publicToken };
    for (const field of fields) {
      body[field.name] =
        field.type === "checkbox"
          ? Boolean(values[field.name])
          : (values[field.name] ?? "");
    }
    if (honeypotField) body[honeypotField] = trap;

    try {
      const res = await fetch(`/api/forms/${formId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));

      if (res.ok) {
        const target = payload.redirectUrl ?? redirectUrl;
        // Scheme-checked at the sink as well as where it is saved. This page is
        // served from our own origin — the same one as /admin — so a stored
        // `javascript:` or `data:` redirect would execute script there. The
        // server now rejects those, but a row written before that guard existed
        // must not be trusted, and the cost of checking here is nothing.
        if (target && isNavigableHttpUrl(target)) {
          window.location.href = target;
          return;
        }
        setSent(true);
        return;
      }
      if (res.status === 422 && payload.fieldErrors) {
        const first = Object.values(
          payload.fieldErrors as Record<string, string[]>,
        )[0];
        setError(first?.[0] ?? payload.message);
      } else {
        setError(payload.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="bg-surface-2 rounded-[20px] p-5 text-[15px] leading-[1.6]"
      >
        <p className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-[7px] size-2 shrink-0 rounded-full"
            style={{ background: "var(--chart-3)" }}
          />
          {thankYouMessage}
        </p>
      </div>
    );
  }

  const accent = appearance.primaryColor;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="bg-surface-2 space-y-5 rounded-[24px] p-6"
    >
      {fields.map((field) => {
        const id = `f_${field.name}`;
        if (field.type === "hidden") {
          return (
            <input
              key={field.name}
              type="hidden"
              name={field.name}
              value={String(values[field.name] ?? "")}
              onChange={(e) => set(field.name, e.target.value)}
            />
          );
        }

        if (field.type === "checkbox") {
          return (
            <div key={field.name} className="flex min-h-11 items-start gap-3">
              <input
                id={id}
                type="checkbox"
                checked={Boolean(values[field.name])}
                onChange={(e) => set(field.name, e.target.checked)}
                required={field.required}
                style={{ accentColor: accent }}
                className="mt-0.5 size-[18px] shrink-0"
              />
              <label
                htmlFor={id}
                className="cursor-pointer text-[15px] leading-[1.55]"
              >
                {field.label}
                {field.required && <span style={{ color: accent }}> *</span>}
              </label>
            </div>
          );
        }

        return (
          <div key={field.name} className="space-y-2">
            <label htmlFor={id} className="block text-[15px] font-semibold">
              {field.label}
              {field.required && <span style={{ color: accent }}> *</span>}
            </label>

            {field.type === "textarea" ? (
              <textarea
                id={id}
                required={field.required}
                placeholder={field.placeholder ?? undefined}
                maxLength={field.maxLength ?? undefined}
                value={String(values[field.name] ?? "")}
                onChange={(e) => set(field.name, e.target.value)}
                rows={5}
                className="bg-background placeholder:text-muted-foreground/70 w-full rounded-[14px] px-4 py-3 text-[15px] leading-[1.55] transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              />
            ) : field.type === "select" ? (
              <select
                id={id}
                required={field.required}
                value={String(values[field.name] ?? "")}
                onChange={(e) => set(field.name, e.target.value)}
                className="bg-background min-h-11 w-full rounded-[14px] px-4 py-3 text-[15px] transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                {!field.required && <option value="">Please choose…</option>}
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={
                  field.type === "email"
                    ? "email"
                    : field.type === "number"
                      ? "number"
                      : field.type === "phone"
                        ? "tel"
                        : "text"
                }
                required={field.required}
                placeholder={field.placeholder ?? undefined}
                maxLength={field.maxLength ?? undefined}
                autoComplete={autoCompleteFor(field.type, field.name)}
                value={String(values[field.name] ?? "")}
                onChange={(e) => set(field.name, e.target.value)}
                className="bg-background placeholder:text-muted-foreground/70 min-h-11 w-full rounded-[14px] px-4 text-[15px] transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              />
            )}
          </div>
        );
      })}

      {/* Honeypot: off-screen, never announced, never a real field. */}
      {honeypotField && (
        <div aria-hidden="true" className="absolute -left-[9999px] opacity-0">
          <input
            type="text"
            name={honeypotField}
            tabIndex={-1}
            autoComplete="off"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive rounded-[14px] px-4 py-3 text-[14px] leading-[1.5]"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{ background: accent }}
        className="inline-flex min-h-11 items-center rounded-full px-6 text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
      >
        {pending ? "Sending…" : appearance.buttonText}
      </button>
    </form>
  );
}
