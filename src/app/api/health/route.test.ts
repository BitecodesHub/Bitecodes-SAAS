import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * The public/diagnostic health surface.
 *
 * Only the shallow and authorization paths are exercised here; the deep checks
 * make real SMTP and provider calls, which belong to an integration
 * environment rather than the unit suite. What matters in a test is that no
 * secret leaks publicly and that deep mode refuses an unauthenticated caller.
 */
describeWithDatabase("health routes", () => {
  useTestDatabase();

  describe("GET /api/health", () => {
    beforeEach(() => {
      vi.stubEnv("CRON_SECRET", "c".repeat(16));
      // The closed-gate assertion must not depend on the developer's shell.
      vi.stubEnv("OUTREACH_FROM", "");
      vi.stubEnv("OUTREACH_POSTAL_ADDRESS", "");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("returns a public summary without secrets", async () => {
      const { GET } = await import("@/app/api/health/route");

      const response = await GET(
        new NextRequest("http://localhost/api/health"),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");

      const body = (await response.json()) as {
        ok: boolean;
        status: string;
        capabilities: { id: string; state: string; detail: string }[];
        summary: Record<string, number>;
        autonomy: { presets: { total: number } } | null;
      };

      expect(body.ok).toBe(true);
      expect(body.status).toBe("ok");
      expect(body.capabilities.length).toBeGreaterThan(10);
      expect(
        body.capabilities.find((capability) => capability.id === "public-site")
          ?.state,
      ).toBe("enabled");
      expect(
        body.capabilities.find(
          (capability) => capability.id === "outbound-sending",
        )?.state,
      ).toBe("disabled");
      expect(body.autonomy).not.toBeNull();
      expect(body.summary).toHaveProperty("enabled");

      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain(
        "test-secret-at-least-32-characters-long-000",
      );
      expect(serialized).not.toMatch(/mongodb:\/\//);
    });

    it("refuses deep checks when CRON_SECRET is unconfigured", async () => {
      vi.stubEnv("CRON_SECRET", "");
      const { GET } = await import("@/app/api/health/route");

      const response = await GET(
        new NextRequest("http://localhost/api/health?deep=1"),
      );
      expect(response.status).toBe(503);
    });

    it("refuses deep checks without the bearer token", async () => {
      const { GET } = await import("@/app/api/health/route");

      const response = await GET(
        new NextRequest("http://localhost/api/health?deep=1"),
      );
      expect(response.status).toBe(401);
    });

    it("refuses deep checks with a wrong bearer token", async () => {
      const { GET } = await import("@/app/api/health/route");

      const response = await GET(
        new NextRequest("http://localhost/api/health?deep=1", {
          headers: { authorization: "Bearer wrong-token-wrong-token" },
        }),
      );
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/health/bootstrap", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("refuses to run unauthenticated", async () => {
      vi.stubEnv("CRON_SECRET", "c".repeat(16));
      const { POST } = await import("@/app/api/health/bootstrap/route");

      const response = await POST(
        new NextRequest("http://localhost/api/health/bootstrap", {
          method: "POST",
          body: JSON.stringify({ dryRun: true }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it("runs an authenticated dry run and returns the report", async () => {
      const secret = "c".repeat(16);
      vi.stubEnv("CRON_SECRET", secret);
      const { POST } = await import("@/app/api/health/bootstrap/route");

      const response = await POST(
        new NextRequest("http://localhost/api/health/bootstrap", {
          method: "POST",
          headers: {
            authorization: `Bearer ${secret}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ dryRun: true }),
        }),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        dryRun: boolean;
        ok: boolean;
        presets: { wouldCreate: number; created: number };
        capabilities: unknown[];
      };
      expect(body.dryRun).toBe(true);
      expect(body.ok).toBe(true);
      expect(body.presets.created).toBe(0);
      expect(body.capabilities.length).toBeGreaterThan(0);
    });
  });
});
