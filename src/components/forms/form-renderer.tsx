"use client";

import { useState } from "react";
import type { FormAppearance, FormField } from "@/lib/server/db/types";

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
        if (payload.redirectUrl || redirectUrl) {
          window.location.href = payload.redirectUrl ?? redirectUrl!;
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
        className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      >
        {thankYouMessage}
      </div>
    );
  }

  const accent = appearance.primaryColor;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
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
            <div key={field.name} className="flex items-start gap-2.5">
              <input
                id={id}
                type="checkbox"
                checked={Boolean(values[field.name])}
                onChange={(e) => set(field.name, e.target.checked)}
                required={field.required}
                className="mt-1"
              />
              <label htmlFor={id} className="text-sm leading-relaxed">
                {field.label}
                {field.required && <span style={{ color: accent }}> *</span>}
              </label>
            </div>
          );
        }

        return (
          <div key={field.name} className="space-y-1.5">
            <label htmlFor={id} className="block text-sm font-semibold">
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
                className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
              />
            ) : field.type === "select" ? (
              <select
                id={id}
                required={field.required}
                value={String(values[field.name] ?? "")}
                onChange={(e) => set(field.name, e.target.value)}
                className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
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
                value={String(values[field.name] ?? "")}
                onChange={(e) => set(field.name, e.target.value)}
                className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
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
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{ background: accent }}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : appearance.buttonText}
      </button>
    </form>
  );
}
