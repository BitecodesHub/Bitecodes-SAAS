import { describe, expect, it } from "vitest";
import { consumeContactRateLimit } from "@/lib/server/rate-limit";

describe("consumeContactRateLimit", () => {
  it("allows five requests and blocks the sixth", () => {
    const key = `test-${crypto.randomUUID()}`;
    const now = 1_000_000;

    for (let request = 0; request < 5; request += 1) {
      expect(consumeContactRateLimit(key, now).allowed).toBe(true);
    }

    const blocked = consumeContactRateLimit(key, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(3600);
  });

  it("opens a new window after the previous one expires", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(consumeContactRateLimit(key, 1).allowed).toBe(true);
    expect(consumeContactRateLimit(key, 3_600_002).allowed).toBe(true);
  });
});
