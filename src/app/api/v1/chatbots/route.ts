import { z } from "zod";
import {
  authenticateRequest,
  jsonError,
  jsonOk,
} from "@/lib/server/chatbot/rest-auth";
import { createChatbot, listChatbots } from "@/lib/server/chatbot/repository";

export const dynamic = "force-dynamic";

/** GET /api/v1/chatbots — the authenticated owner's chatbots. */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request, "read");
  if (!auth.ok) return auth.response;

  const bots = await listChatbots(auth.key.ownerId);
  return jsonOk(
    bots.map((b) => ({
      chatbotId: b.chatbotId,
      name: b.name,
      status: b.status,
      websiteName: b.websiteName,
      allowedDomains: b.allowedDomains,
      modelKey: b.modelKey,
      createdAt: b.createdAt,
    })),
  );
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  websiteName: z.string().trim().max(120).optional(),
  allowedDomains: z.array(z.string().trim().max(120)).max(50).optional(),
});

/** POST /api/v1/chatbots — create a bot; returns its one-time public token. */
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

  const created = await createChatbot({
    ownerId: auth.key.ownerId,
    name: parsed.data.name,
    websiteName: parsed.data.websiteName ?? null,
    allowedDomains: parsed.data.allowedDomains ?? [],
  });
  return jsonOk(created, 201);
}
