import { describe, expect, it } from "vitest";
import {
  CHATBOT_APPEARANCE_DEFAULTS,
  normalizeAppearance,
  normalizePrompts,
} from "@/lib/chatbot/appearance";
import { appearancePatchSchema } from "@/lib/chatbot/appearance-schema";

describe("normalizeAppearance", () => {
  it("fills every field for a document written before the contract existed", () => {
    expect(normalizeAppearance({})).toEqual(CHATBOT_APPEARANCE_DEFAULTS);
    expect(normalizeAppearance(undefined)).toEqual(CHATBOT_APPEARANCE_DEFAULTS);
  });

  it("keeps a valid appearance intact", () => {
    const stored = {
      theme: "dark" as const,
      emoji: "🤖",
      avatar: "https://cdn.example.com/a.png",
      logo: "https://cdn.example.com/l.svg",
      primaryColor: "#123456",
      secondaryColor: "#abc",
      position: "bottom-left" as const,
      size: "large" as const,
      displayMode: "popup" as const,
      welcomeMessage: "Hello",
      placeholder: "Type here",
      typingAnimation: false,
      branding: false,
      launcherLabel: "Ask us anything",
      suggestedQuestions: ["Where are you?"],
      starterPrompts: ["What do you sell?"],
    };

    expect(normalizeAppearance(stored)).toMatchObject(stored);
  });

  it("falls back per field instead of discarding a whole legacy document", () => {
    const normalized = normalizeAppearance({
      theme: "sepia" as never,
      displayMode: "modal" as never,
      primaryColor: "red",
      emoji: "<script>alert(1)</script>",
      avatar: "javascript:alert(1)",
      position: "top-left" as never,
      welcomeMessage: "\u0000bad",
      launcherLabel: "\u0007",
    });

    expect(normalized.theme).toBe("auto");
    expect(normalized.displayMode).toBe("bubble");
    expect(normalized.primaryColor).toBe(
      CHATBOT_APPEARANCE_DEFAULTS.primaryColor,
    );
    expect(normalized.emoji).toBe(CHATBOT_APPEARANCE_DEFAULTS.emoji);
    expect(normalized.avatar).toBeNull();
    expect(normalized.position).toBe("bottom-right");
    expect(normalized.welcomeMessage).toBe(
      CHATBOT_APPEARANCE_DEFAULTS.welcomeMessage,
    );
    expect(normalized.launcherLabel).toBe("Open chat");
  });

  it("treats an empty emoji as 'use the built-in icon'", () => {
    expect(normalizeAppearance({ emoji: "" }).emoji).toBeNull();
  });

  it("normalizes prompt arrays and caps them at four", () => {
    expect(
      normalizeAppearance({
        suggestedQuestions: [
          " one ",
          "two",
          "three",
          "four",
          "five",
          42 as never,
        ],
      }).suggestedQuestions,
    ).toEqual(["one", "two", "three", "four"]);

    expect(normalizePrompts(["a".repeat(121), "ok", "", 7, null])).toEqual([
      "ok",
    ]);
  });

  it("returns fresh arrays so a caller cannot mutate the defaults", () => {
    const first = normalizeAppearance({});
    first.starterPrompts.push("changed");

    expect(normalizeAppearance({}).starterPrompts).toEqual([]);
    expect(CHATBOT_APPEARANCE_DEFAULTS.starterPrompts).toEqual([]);
  });
});

describe("appearancePatchSchema", () => {
  it("accepts a single changed field", () => {
    expect(appearancePatchSchema.safeParse({ branding: false }).success).toBe(
      true,
    );
  });

  it("accepts visible emoji and a flag sequence", () => {
    expect(appearancePatchSchema.safeParse({ emoji: "🤖" }).success).toBe(true);
    expect(appearancePatchSchema.safeParse({ emoji: "🇦🇺" }).success).toBe(true);
    expect(appearancePatchSchema.safeParse({ emoji: "" }).success).toBe(true);
    expect(appearancePatchSchema.safeParse({ emoji: null }).success).toBe(true);
  });

  it("rejects markup, script text and control characters as an emoji", () => {
    for (const emoji of ["<script>", "ab", "\u0000", "`x`", '"x"']) {
      expect(appearancePatchSchema.safeParse({ emoji }).success).toBe(false);
    }
  });

  it("rejects non-http images", () => {
    for (const avatar of ["javascript:alert(1)", "ftp://example.com/a.png"]) {
      expect(appearancePatchSchema.safeParse({ avatar }).success).toBe(false);
    }
    expect(
      appearancePatchSchema.safeParse({ avatar: "https://example.com/a.png" })
        .success,
    ).toBe(true);
  });

  it("bounds prompt count and length", () => {
    expect(
      appearancePatchSchema.safeParse({
        starterPrompts: ["one", "two", "three", "four"],
      }).success,
    ).toBe(true);
    expect(
      appearancePatchSchema.safeParse({
        starterPrompts: ["one", "two", "three", "four", "five"],
      }).success,
    ).toBe(false);
    expect(
      appearancePatchSchema.safeParse({
        suggestedQuestions: ["a".repeat(121)],
      }).success,
    ).toBe(false);
    expect(
      appearancePatchSchema.safeParse({ suggestedQuestions: [""] }).success,
    ).toBe(false);
  });

  it("refuses control characters in the launcher label", () => {
    expect(
      appearancePatchSchema.safeParse({ launcherLabel: "Chat\u0000" }).success,
    ).toBe(false);
    expect(
      appearancePatchSchema.safeParse({ launcherLabel: "Chat with us" })
        .success,
    ).toBe(true);
  });

  it("strips fields outside the contract instead of failing", () => {
    const parsed = appearancePatchSchema.parse({
      branding: false,
      appearanceVersion: 99,
      adminOnly: true,
    });
    expect(parsed).toEqual({ branding: false });
  });
});
