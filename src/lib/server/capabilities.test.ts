import { describe, expect, it } from "vitest";
import {
  capabilityMatrix,
  capabilitySummary,
  outboundSendGate,
} from "@/lib/server/capabilities";
import { resolveSettings } from "@/lib/server/settings";

/**
 * The matrix is the answer to "what may this deployment claim?" — so these
 * tests pin the two ends: a bare deployment that must still serve pages, and
 * a fully configured one where every capability is enabled.
 */

const emptyEnv: Record<string, string | undefined> = {};

const configuredEnv: Record<string, string | undefined> = {
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  AUTH_SECRET: "a".repeat(32),
  CRON_SECRET: "b".repeat(16),
  SMTP_HOST: "smtp.example.com",
  SMTP_FROM: "Bitecodes <no-reply@example.com>",
  SMTP_USER: "user",
  SMTP_PASSWORD: "password",
  OUTREACH_FROM: "outreach@mail.example.com",
  OUTREACH_POSTAL_ADDRESS: "12 Test Lane, Ahmedabad",
  AI_API_KEY: "test-ai-key-never-returned",
  RAZORPAY_KEY_ID: "rzp_test",
  RAZORPAY_KEY_SECRET: "secret",
  RAZORPAY_WEBHOOK_SECRET: "webhook",
  INDEXNOW_KEY: "indexnowkey123",
  IMAP_HOST: "imap.example.com",
  IMAP_USER: "user",
  IMAP_PASSWORD: "password",
  GOOGLE_CLIENT_ID: "client",
  GOOGLE_CLIENT_SECRET: "secret",
};

const configuredSettings = resolveSettings({
  _id: "site",
  contact: { address: { postal: "12 Test Lane, Ahmedabad" } },
  outreach: { fromAddress: "outreach@mail.example.com" },
  automation: { requireApproval: false },
  ai: { chatEnabled: true },
  growth: { aiEnabled: true, outreachDrafts: true },
  createdAt: new Date(),
  updatedAt: new Date(),
} as never);

function stateOf(
  capabilities: ReturnType<typeof capabilityMatrix>,
  id: string,
) {
  return capabilities.find((capability) => capability.id === id)?.state;
}

describe("capabilityMatrix", () => {
  it("keeps the public site up and names every missing provider on a bare deployment", () => {
    const capabilities = capabilityMatrix({
      settings: resolveSettings(null),
      env: emptyEnv,
    });

    expect(stateOf(capabilities, "public-site")).toBe("enabled");
    expect(stateOf(capabilities, "search-indexing")).toBe("enabled");
    expect(stateOf(capabilities, "database")).toBe("disabled");
    expect(stateOf(capabilities, "signed-links")).toBe("disabled");
    expect(stateOf(capabilities, "scheduled-jobs")).toBe("disabled");
    expect(stateOf(capabilities, "transactional-email")).toBe("disabled");
    expect(stateOf(capabilities, "ai")).toBe("disabled");
    expect(stateOf(capabilities, "payments")).toBe("manual");
    expect(stateOf(capabilities, "reply-detection")).toBe("manual");
    expect(stateOf(capabilities, "google-signin")).toBe("disabled");
    expect(stateOf(capabilities, "search-pings")).toBe("disabled");
    expect(stateOf(capabilities, "outreach-drafts")).toBe("degraded");
    expect(stateOf(capabilities, "outbound-sending")).toBe("disabled");

    // Every disabled state must say what to do about it.
    for (const capability of capabilities) {
      if (capability.state === "disabled") {
        expect(capability.remedy, capability.id).toBeTruthy();
      }
    }
  });

  it("enables every capability when its provider and switch are configured", () => {
    const capabilities = capabilityMatrix({
      settings: configuredSettings,
      env: configuredEnv,
    });

    for (const id of [
      "public-site",
      "database",
      "signed-links",
      "scheduled-jobs",
      "transactional-email",
      "ai",
      "prospect-discovery",
      "outreach-drafts",
      "outbound-sending",
      "payments",
      "search-indexing",
      "search-pings",
      "reply-detection",
      "google-signin",
      "website-chat",
    ]) {
      expect(stateOf(capabilities, id), id).toBe("enabled");
    }

    const summary = capabilitySummary(capabilities);
    expect(summary.disabled).toBe(0);
    expect(summary.degraded).toBe(0);
    expect(summary.manual).toBe(0);
  });

  it("turns AI steps off explicitly rather than failing when the toggle is off", () => {
    const settings = resolveSettings({
      _id: "site",
      growth: { aiEnabled: false },
      ai: { chatEnabled: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const capabilities = capabilityMatrix({ settings, env: configuredEnv });
    expect(stateOf(capabilities, "ai")).toBe("disabled");
    expect(stateOf(capabilities, "website-chat")).toBe("disabled");
    // Drafting degrades instead of disappearing: discovery and audits continue.
    expect(stateOf(capabilities, "outreach-drafts")).toBe("degraded");
  });

  it("never echoes a configured secret into a detail or remedy", () => {
    const capabilities = capabilityMatrix({
      settings: configuredSettings,
      env: configuredEnv,
    });
    const serialized = JSON.stringify(capabilities);
    expect(serialized).not.toContain(configuredEnv.AI_API_KEY);
    expect(serialized).not.toContain(configuredEnv.RAZORPAY_KEY_SECRET);
    expect(serialized).not.toContain(configuredEnv.SMTP_PASSWORD);
  });
});

describe("outboundSendGate", () => {
  it("is closed when SMTP, sender, or postal address is missing", () => {
    const gate = outboundSendGate(resolveSettings(null), emptyEnv);
    expect(gate.state).toBe("closed");
    expect(gate.canSend).toBe(false);
    expect(gate.reasons.join(" ")).toMatch(/SMTP/);
    expect(gate.reasons.join(" ")).toMatch(/sender/);
    expect(gate.reasons.join(" ")).toMatch(/postal/);
  });

  it("is manual while human approval is required", () => {
    const settings = resolveSettings({
      _id: "site",
      automation: { requireApproval: true },
      contact: { address: { postal: "12 Test Lane" } },
      outreach: { fromAddress: "outreach@mail.example.com" },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const gate = outboundSendGate(settings, configuredEnv);
    expect(gate.state).toBe("manual");
    expect(gate.canSend).toBe(true);
  });

  it("is open only when infrastructure, footer, and policy all allow it", () => {
    const gate = outboundSendGate(configuredSettings, configuredEnv);
    expect(gate.state).toBe("open");
    expect(gate.canSend).toBe(true);
    expect(gate.reasons).toEqual([]);
  });
});
