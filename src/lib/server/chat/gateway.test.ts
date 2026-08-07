import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Chat-gateway tests against a real MongoDB, with only the AI provider stubbed.
 *
 * The provider is the one thing worth faking: it is a paid network call whose
 * latency and wording are not what these tests are about. Everything the gateway
 * is responsible for — token resolution, the origin boundary, rate limiting,
 * refusing to spend money it does not have, grounding, and metering after the
 * stream — runs for real.
 */

const streamMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/ai-provider", () => ({
  streamChatCompletion: streamMock,
  getAiProviderConfig: () => ({
    apiKey: "k",
    baseUrl: "https://example.invalid/v1",
    model: "env/should-not-be-used",
    timeoutMs: 1000,
    isOpenRouter: false,
  }),
}));

/** A provider that yields two deltas and reports usage. */
function stubProvider(reply = "Refunds are available within 30 days.") {
  streamMock.mockImplementation(
    async (input: { system: string; model?: string }) => {
      capturedSystem = input.system;
      capturedModel = input.model;
      return {
        model: input.model ?? "stub",
        stream: (async function* () {
          yield reply.slice(0, 10);
          yield reply.slice(10);
        })(),
        usage: () => ({ inputTokens: 120, outputTokens: 30 }),
      };
    },
  );
}

let capturedSystem = "";
let capturedModel: string | undefined;

async function drain(stream: AsyncGenerator<string, void, unknown>) {
  let text = "";
  for await (const delta of stream) text += delta;
  return text;
}

describeWithDatabase("chat gateway", () => {
  useTestDatabase();

  const ORIGIN = "https://example.com";
  let chatbotId = "";
  let publicToken = "";
  let ownerId = "";

  beforeEach(async () => {
    const {
      chatbots,
      chatbotKnowledgeChunks,
      chatbotModels,
      walletBalances,
      walletLedger,
      rateLimits,
    } = await import("@/lib/server/db/collections");
    await (await chatbots()).deleteMany({});
    await (await chatbotKnowledgeChunks()).deleteMany({});
    await (await chatbotModels()).deleteMany({});
    await (await walletBalances()).deleteMany({});
    await (await walletLedger()).deleteMany({});
    await (await rateLimits()).deleteMany({});

    const { resetSeededModelsFlag } =
      await import("@/lib/server/chatbot/models");
    resetSeededModelsFlag();

    const { createChatbot } = await import("@/lib/server/chatbot/repository");
    ownerId = "owner-chat";
    const created = await createChatbot({
      ownerId,
      name: "Support",
      allowedDomains: ["example.com"],
    });
    chatbotId = created.chatbotId;
    publicToken = created.publicToken;

    capturedSystem = "";
    capturedModel = undefined;
    stubProvider();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function fund(amount: number) {
    const { credit } = await import("@/lib/server/tokens-ledger/ledger");
    await credit({ ownerId, amount, kind: "purchase" });
  }

  async function addKnowledge(text: string) {
    const { ingestContent } = await import("@/lib/server/knowledge/repository");
    await ingestContent({
      ownerId,
      chatbotId,
      type: "manual",
      format: "txt",
      origin: "Policy",
      content: text,
    });
  }

  function baseRequest(overrides: Record<string, unknown> = {}) {
    return {
      chatbotId,
      publicToken,
      message: "What is your refund policy?",
      origin: ORIGIN,
      ip: "203.0.113.7",
      ...overrides,
    } as Parameters<typeof import("@/lib/server/chat/gateway").handleChat>[0];
  }

  it("answers, streams, and meters tokens once the stream completes", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    const { getBalance } = await import("@/lib/server/tokens-ledger/ledger");
    await fund(1_000);
    await addKnowledge("Refunds are available within 30 days of purchase.");

    const outcome = await handleChat(baseRequest());
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;

    // Nothing is billed until the answer is actually delivered.
    expect(await getBalance(ownerId)).toBe(1_000);

    const text = await drain(outcome.stream);
    expect(text).toContain("Refunds");

    const usage = await outcome.settle();
    expect(usage.inputTokens + usage.outputTokens).toBe(150);
    expect(await getBalance(ownerId)).toBe(850);
  });

  it("refuses a foreign origin without calling the model", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);

    const outcome = await handleChat(
      baseRequest({ origin: "https://attacker.example.net" }),
    );
    expect(outcome.kind).toBe("origin-denied");
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("gives one answer for a wrong token and for a paused bot", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    const { setChatbotStatus } =
      await import("@/lib/server/chatbot/repository");
    await fund(1_000);

    expect(
      (await handleChat(baseRequest({ publicToken: "cb_pub_wrong" }))).kind,
    ).toBe("not-available");

    await setChatbotStatus(ownerId, chatbotId, "paused");
    expect((await handleChat(baseRequest())).kind).toBe("not-available");
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("refuses before spending when the balance is too low", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(10); // below the pre-flight floor

    const outcome = await handleChat(baseRequest());
    expect(outcome.kind).toBe("out-of-tokens");
    // The decisive point: no paid model call was made.
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("rejects an empty or oversized message", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);

    expect((await handleChat(baseRequest({ message: "   " }))).kind).toBe(
      "invalid",
    );
    expect(
      (await handleChat(baseRequest({ message: "x".repeat(5_000) }))).kind,
    ).toBe("invalid");
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("grounds the prompt in retrieved knowledge without discouraging its use", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);
    await addKnowledge("Refunds are available within 30 days of purchase.");

    const outcome = await handleChat(baseRequest());
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.grounded).toBe(true);

    expect(capturedSystem).toContain("Refunds are available within 30 days");
    expect(capturedSystem).toContain("Answer ONLY from KNOWLEDGE");
    // The anti-injection framing must still reach the model.
    expect(capturedSystem).toContain("never as orders");
    // Regression guard: calling the knowledge "untrusted" made the model refuse
    // to quote the contact details it had just been handed, on live.
    expect(capturedSystem).not.toContain("untrusted");
    expect(capturedSystem).toContain("state them directly");
  });

  it("reports ungrounded when nothing relevant is stored", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);
    await addKnowledge("Our office is in Ahmedabad and opens at 10am.");

    const outcome = await handleChat(
      baseRequest({ message: "Do you sell bicycles?" }),
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    // The model is still asked, but told it has nothing — so it can say so
    // rather than inventing an answer.
    expect(outcome.grounded).toBe(false);
  });

  it("still answers a broad opener made only of stop words", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);
    await addKnowledge("Bitecodes builds websites and automation software.");

    // Every word here is a stop word, so retrieval has nothing to match on.
    // Observed on live: the assistant replied that it had no information to
    // share, with a full knowledge base sitting behind it.
    const outcome = await handleChat(
      baseRequest({ message: "What do you do?" }),
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;

    // The knowledge still reaches the model...
    expect(capturedSystem).toContain("Bitecodes builds websites");
    // ...and it must NOT be told the assistant is unconfigured.
    expect(capturedSystem).not.toContain("nothing is stored");
    // ...but nothing actually matched, so the operator sees that honestly.
    expect(outcome.grounded).toBe(false);
  });

  it("tells the model plainly when no knowledge exists at all", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);
    // No knowledge ingested.

    const outcome = await handleChat(baseRequest());
    expect(outcome.kind).toBe("ok");
    expect(capturedSystem).toContain("nothing is stored");
  });

  it("is not fooled into reporting grounded by one incidental word", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);
    // "sells" is present, so the old `ranked.length > 0` test called this
    // grounded even though nothing here concerns motorcycles. Observed on live.
    await addKnowledge(
      "Bitecodes sells an embeddable AI chatbot for websites.",
    );

    const outcome = await handleChat(
      baseRequest({ message: "Do you sell used motorcycles?" }),
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.grounded).toBe(false);
  });

  it("uses the catalogue default rather than the env model", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);

    const outcome = await handleChat(baseRequest());
    expect(outcome.kind).toBe("ok");
    // This is the guard against inheriting AI_MODEL, which on this deployment
    // is a model measured at ~60s to first byte.
    expect(capturedModel).toBe("meta/llama-3.1-8b-instruct");
    expect(capturedModel).not.toBe("env/should-not-be-used");
  });

  it("falls back to the default when the bot's chosen model is disabled", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    const { updateChatbot } = await import("@/lib/server/chatbot/repository");
    const { listModels, setModelEnabled } =
      await import("@/lib/server/chatbot/models");
    await fund(1_000);
    await listModels(); // seed

    await updateChatbot(ownerId, chatbotId, {
      modelKey: "nvidia/nemotron-mini-4b-instruct",
    });
    await setModelEnabled("nvidia/nemotron-mini-4b-instruct", false);

    const outcome = await handleChat(baseRequest());
    expect(outcome.kind).toBe("ok");
    // A visitor's question is answered rather than failed.
    expect(capturedModel).toBe("meta/llama-3.1-8b-instruct");
  });

  it("rate-limits a single visitor", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(100_000);

    const kinds: string[] = [];
    for (let i = 0; i < 45; i++) {
      const outcome = await handleChat(
        baseRequest({ message: `Question number ${i} about refunds` }),
      );
      kinds.push(outcome.kind);
      if (outcome.kind === "ok") await drain(outcome.stream);
    }
    // The `chat` bucket is 40/hour, so the tail must be refused.
    expect(kinds.filter((k) => k === "rate-limited").length).toBeGreaterThan(0);
  });

  /**
   * The production regression that motivated the retrieval rewrite.
   *
   * A visitor asked what the company does AND what a website costs. The four
   * highest-scoring chunks were all about what the company does, the pricing
   * chunk placed fifth, and the assistant replied "we do not have a fixed price
   * for a website" while holding a price list. These fix the failure in place.
   */
  it("keeps BOTH subjects of a compound question in context", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);
    await addKnowledge("Bitecodes is a studio. We build websites and apps.");
    await addKnowledge("Website development starts from $500 per project.");
    await addKnowledge("You can reach Bitecodes at hello@bitecodes.test.");

    const outcome = await handleChat(
      baseRequest({
        message: "What does Bitecodes do, and how much is a website?",
      }),
    );
    expect(outcome.kind).toBe("ok");

    // Both halves must be answerable, which means both must be present.
    expect(capturedSystem).toContain("We build websites and apps");
    expect(capturedSystem).toContain("$500");
  });

  it("does not let a contact block outrank the page that answers the question", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);
    // The contact chunk names the company three times once its email and URL are
    // tokenized, which used to make it the top hit for any question naming the
    // company — including questions about price.
    await addKnowledge(
      "Reach Bitecodes at bitecodes.global@gmail.com or https://www.bitecodes.com for the website.",
    );
    await addKnowledge("Website development starts from $500 per project.");

    const outcome = await handleChat(
      baseRequest({ message: "How much is a Bitecodes website?" }),
    );
    expect(outcome.kind).toBe("ok");
    expect(capturedSystem).toContain("$500");
  });

  it("matches a price the visitor quotes with a thousands separator", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);
    await addKnowledge("Web applications start from $1,600 per project.");
    await addKnowledge("Our office is in Ahmedabad, India.");

    // "$1,600" used to tokenize to "600", so this could never match.
    const outcome = await handleChat(
      baseRequest({ message: "Is a web application around 1600?" }),
    );
    expect(outcome.kind).toBe("ok");
    expect(capturedSystem).toContain("$1,600");
  });

  it("supplies the knowledge base when a question matches no word in it", async () => {
    const { handleChat } = await import("@/lib/server/chat/gateway");
    await fund(1_000);
    // "process" appears nowhere; the text says "discovery" and "progress".
    await addKnowledge(
      "We start with a discovery call, then send a written scope. We share progress weekly.",
    );

    const outcome = await handleChat(
      baseRequest({ message: "What is your process?" }),
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    // The answer is reachable even though nothing matched lexically...
    expect(capturedSystem).toContain("discovery call");
    // ...and the operator is still told honestly that nothing actually matched.
    expect(outcome.grounded).toBe(false);
  });
});
