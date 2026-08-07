import {
  authenticateRequest,
  jsonError,
  jsonOk,
} from "@/lib/server/chatbot/rest-auth";
import { getForm, listSubmissions } from "@/lib/server/forms/repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/forms/:id/submissions — a form's submissions, newest first.
 *
 * Owner-scoped twice over: the key resolves the owner, and the form is fetched
 * with that owner id, so a valid key cannot read another tenant's form by
 * guessing its id.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request, "read");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const form = await getForm(auth.key.ownerId, id);
  if (!form) return jsonError(404, "not_found", "No such form.");

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 100);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "new" ||
    statusParam === "spam" ||
    statusParam === "archived"
      ? statusParam
      : undefined;

  const submissions = await listSubmissions(auth.key.ownerId, id, {
    limit: Number.isFinite(limitParam) ? limitParam : 100,
    status,
  });

  return jsonOk(
    submissions.map((s) => ({
      submissionId: s.submissionId,
      status: s.status,
      data: s.data,
      createdAt: s.createdAt,
    })),
  );
}
