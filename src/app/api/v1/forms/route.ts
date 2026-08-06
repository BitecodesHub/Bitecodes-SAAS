import { z } from "zod";
import {
  authenticateRequest,
  jsonError,
  jsonOk,
} from "@/lib/server/chatbot/rest-auth";
import { createForm, listForms } from "@/lib/server/forms/repository";

export const dynamic = "force-dynamic";

/** GET /api/v1/forms — the authenticated owner's forms. */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request, "read");
  if (!auth.ok) return auth.response;

  const found = await listForms(auth.key.ownerId);
  return jsonOk(
    found.map((f) => ({
      formId: f.formId,
      name: f.name,
      status: f.status,
      allowedDomains: f.allowedDomains,
      fields: f.fields.map((field) => ({
        type: field.type,
        name: field.name,
        required: field.required,
      })),
      submissionCount: f.submissionCount,
      createdAt: f.createdAt,
    })),
  );
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  allowedDomains: z.array(z.string().trim().max(120)).max(50).optional(),
  notifyEmails: z.array(z.string().trim().max(254)).max(10).optional(),
});

/** POST /api/v1/forms — create a form; returns its one-time public token. */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request, "write");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "bad_request", "Body must be valid JSON.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      422,
      "validation",
      "A name of at least 2 characters is required.",
    );
  }

  const created = await createForm({
    ownerId: auth.key.ownerId,
    name: parsed.data.name,
    allowedDomains: parsed.data.allowedDomains ?? [],
    notifyEmails: parsed.data.notifyEmails ?? [],
  });
  return jsonOk(created, 201);
}
