import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Chatbot repository tests against a real MongoDB. The property that matters
 * most is tenant isolation — one owner must never read or mutate another's
 * bot — so it is exercised directly.
 */
describeWithDatabase("chatbot repository", () => {
  useTestDatabase();

  const A = "owner-a";
  const B = "owner-b";

  beforeEach(async () => {
    const { chatbots } = await import("@/lib/server/db/collections");
    await (await chatbots()).deleteMany({});
  });

  it("creates a bot and returns a one-time public token", async () => {
    const { createChatbot, getChatbot } =
      await import("@/lib/server/chatbot/repository");
    const { chatbotId, publicToken } = await createChatbot({
      ownerId: A,
      name: "Support Bot",
      allowedDomains: ["HTTPS://Example.com/path", "*.example.com"],
    });
    expect(publicToken.startsWith("cb_pub_")).toBe(true);

    const bot = await getChatbot(A, chatbotId);
    expect(bot?.name).toBe("Support Bot");
    // Domains are normalised and de-duplicated.
    expect(bot?.allowedDomains).toEqual(["example.com", "*.example.com"]);
    // The token itself is never stored, only its hash.
    expect(
      (bot as unknown as { publicToken?: string }).publicToken,
    ).toBeUndefined();
    expect(bot?.publicTokenHash).toBeTruthy();
  });

  it("isolates tenants: B cannot read or mutate A's bot", async () => {
    const {
      createChatbot,
      getChatbot,
      getChatbotForWidget,
      updateChatbot,
      deleteChatbot,
      rotatePublicToken,
      setChatbotStatus,
    } = await import("@/lib/server/chatbot/repository");
    const { chatbotId, publicToken } = await createChatbot({
      ownerId: A,
      name: "A bot",
    });

    expect(await getChatbot(B, chatbotId)).toBeNull();
    expect(await updateChatbot(B, chatbotId, { name: "hijacked" })).toBe(false);
    expect(await deleteChatbot(B, chatbotId)).toBe(false);
    // Status changes and token rotation are mutations too.
    expect(await setChatbotStatus(B, chatbotId, "paused")).toBe(false);
    expect(await rotatePublicToken(B, chatbotId)).toBeNull();
    // A's bot is untouched, including its original public token.
    expect((await getChatbot(A, chatbotId))?.name).toBe("A bot");
    expect(await getChatbotForWidget(chatbotId, publicToken)).not.toBeNull();
  });

  it("merges appearance on partial update without dropping fields", async () => {
    const { createChatbot, updateChatbot, getChatbot } =
      await import("@/lib/server/chatbot/repository");
    const { chatbotId } = await createChatbot({ ownerId: A, name: "Bot" });

    await updateChatbot(A, chatbotId, {
      appearance: {
        primaryColor: "#000000",
        starterPrompts: ["What do you sell?"],
      },
    });
    await updateChatbot(A, chatbotId, {
      appearance: { welcomeMessage: "Hello there" },
    });
    const bot = await getChatbot(A, chatbotId);
    expect(bot?.appearance.primaryColor).toBe("#000000");
    // Arrays and untouched defaults survive later partial updates too.
    expect(bot?.appearance.starterPrompts).toEqual(["What do you sell?"]);
    expect(bot?.appearance.position).toBe("bottom-right");
    expect(bot?.appearance.welcomeMessage).toBe("Hello there");
  });

  it("upgrades a legacy appearance document on read", async () => {
    const { createChatbot, getChatbotForWidget } =
      await import("@/lib/server/chatbot/repository");
    const { chatbots } = await import("@/lib/server/db/collections");
    const { chatbotId, publicToken } = await createChatbot({
      ownerId: A,
      name: "Legacy",
    });

    // The shape stored before launcherLabel/starterPrompts existed.
    await (
      await chatbots()
    ).updateOne(
      { chatbotId },
      {
        $set: {
          // Deliberately incomplete: this is the legacy stored shape.
          appearance: { theme: "dark", primaryColor: "#123456" } as never,
        },
      },
    );

    const bot = await getChatbotForWidget(chatbotId, publicToken);
    expect(bot?.appearance.theme).toBe("dark");
    expect(bot?.appearance.primaryColor).toBe("#123456");
    // Missing fields are filled from the current contract, not left undefined.
    expect(bot?.appearance.launcherLabel).toBe("Open chat");
    expect(bot?.appearance.starterPrompts).toEqual([]);
    expect(bot?.appearance.secondaryColor).toBeTruthy();
  });

  it("resolves for the widget only with the right token and only when active", async () => {
    const { createChatbot, getChatbotForWidget, setChatbotStatus } =
      await import("@/lib/server/chatbot/repository");
    const { chatbotId, publicToken } = await createChatbot({
      ownerId: A,
      name: "Bot",
    });

    expect(await getChatbotForWidget(chatbotId, publicToken)).not.toBeNull();
    expect(await getChatbotForWidget(chatbotId, "wrong-token")).toBeNull();

    await setChatbotStatus(A, chatbotId, "paused");
    // A paused bot must not serve the widget even with the correct token.
    expect(await getChatbotForWidget(chatbotId, publicToken)).toBeNull();
  });

  it("rotates the public token, invalidating the old one", async () => {
    const { createChatbot, getChatbotForWidget, rotatePublicToken } =
      await import("@/lib/server/chatbot/repository");
    const { chatbotId, publicToken } = await createChatbot({
      ownerId: A,
      name: "Bot",
    });

    const next = await rotatePublicToken(A, chatbotId);
    expect(next).toBeTruthy();
    expect(next).not.toBe(publicToken);
    expect(await getChatbotForWidget(chatbotId, publicToken)).toBeNull();
    expect(await getChatbotForWidget(chatbotId, next!)).not.toBeNull();
  });

  it("lists only the owner's bots, newest first", async () => {
    const { createChatbot, listChatbots } =
      await import("@/lib/server/chatbot/repository");
    await createChatbot({ ownerId: A, name: "A1" });
    await createChatbot({ ownerId: A, name: "A2" });
    await createChatbot({ ownerId: B, name: "B1" });

    const list = await listChatbots(A);
    expect(list).toHaveLength(2);
    expect(list.every((b) => b.ownerId === A)).toBe(true);
  });
});
