import type { NextRequest } from "next/server";
import { getFormForPublic } from "@/lib/server/forms/repository";
import { corsJson, preflightResponse } from "@/lib/server/forms/cors";
import { HONEYPOT_FIELD } from "@/lib/forms/fields";

/**
 * Public, read-only config the widget needs to render a form: fields,
 * appearance, and the thank-you behaviour.
 *
 * Deliberately narrow. It returns only what a rendered form must show — never
 * the owner id, notify list, submission counts, or token hash — so exposing
 * this endpoint to any allowed website leaks nothing about the account behind
 * it.
 */
export const dynamic = "force-dynamic";

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const { formId } = await params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const form = token ? await getFormForPublic(formId, token) : null;
  return preflightResponse(request.headers.get("origin"), form);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const { formId } = await params;
  const origin = request.headers.get("origin");
  const token = new URL(request.url).searchParams.get("t") ?? "";

  const form = await getFormForPublic(formId, token);
  if (!form) {
    return corsJson(
      {
        ok: false,
        code: "NOT_AVAILABLE",
        message: "This form is not available.",
      },
      404,
      origin,
      null,
    );
  }

  return corsJson(
    {
      ok: true,
      data: {
        formId: form.formId,
        name: form.name,
        appearance: form.appearance,
        thankYouMessage: form.thankYouMessage,
        redirectUrl: form.redirectUrl,
        honeypotField: form.honeypotEnabled ? HONEYPOT_FIELD : null,
        fields: form.fields.map((f) => ({
          type: f.type,
          name: f.name,
          label: f.label,
          placeholder: f.placeholder,
          required: f.required,
          options: f.options,
          maxLength: f.maxLength,
        })),
      },
    },
    200,
    origin,
    form,
  );
}
