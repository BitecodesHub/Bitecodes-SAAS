import "server-only";

import type { NextRequest } from "next/server";
import { resolveAutomationChain } from "@/lib/server/desktop/providers";
import { runTextChain } from "@/lib/server/desktop/gateway";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let prompt = "";

  try {
    const body = await request.json();
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    return new Response(
      JSON.stringify({ ok: false, message: "Invalid JSON" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!prompt) {
    return new Response(
      JSON.stringify({ ok: false, message: "Prompt is empty" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const chain = await resolveAutomationChain();
  if (chain.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, message: "No AI provider configured" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const systemPrompt = `You are the Bitecodes AI assistant. Help the user with questions about website development, software projects, and AI automation. Keep answers concise and grounded in the knowledge base.`;

  try {
    const result = await runTextChain(chain, {
      system: systemPrompt,
      prompt,
      maxTokens: 2048,
      temperature: 0.2,
    });

    return new Response(JSON.stringify({ ok: true, text: result.text }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[assistant] AI call failed:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        message:
          "The assistant could not answer right now. Please retry or contact our team.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
