import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveGrowthSettings,
  resolveSettings,
  GROWTH_DEFAULTS,
  GROWTH_TOGGLE_KEYS,
} from "@/lib/server/settings";
import { GROWTH_TOGGLES } from "@/lib/growth/toggles";

describe("growth settings resolution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("resolves to defaults when no stored data", () => {
    const result = resolveGrowthSettings(undefined);
    expect(result).toEqual(GROWTH_DEFAULTS);
  });

  it("preserves stored boolean values", () => {
    const stored = {
      aiEnabled: true,
      leadScoring: false,
      weeklyReport: true,
    };
    const result = resolveGrowthSettings(stored);
    expect(result.aiEnabled).toBe(true);
    expect(result.leadScoring).toBe(false);
    expect(result.weeklyReport).toBe(true);
  });

  it("ignores non-boolean stored values", () => {
    const stored = {
      aiEnabled: "true", // string, not boolean
      leadScoring: 1, // number, not boolean
    };
    const result = resolveGrowthSettings(stored);
    expect(result.aiEnabled).toBe(true); // default
    expect(result.leadScoring).toBe(true); // default
  });

  it("each toggle has a default and a key", () => {
    for (const key of GROWTH_TOGGLE_KEYS) {
      expect(key).toBeDefined();
      const toggle = GROWTH_TOGGLES.find((t) => t.key === key);
      expect(toggle).toBeDefined();
    }
  });

  it("all toggle keys are unique", () => {
    expect(new Set(GROWTH_TOGGLE_KEYS).size).toBe(GROWTH_TOGGLE_KEYS.length);
  });

  it("toggle keys match GROWTH_TOGGLES", () => {
    const toggleKeys = GROWTH_TOGGLES.map((t) => t.key);
    expect(GROWTH_TOGGLE_KEYS).toEqual(toggleKeys);
  });

  it("resolveSettings includes growth block", () => {
    const result = resolveSettings(null);
    expect(result.growth).toBeDefined();
    expect(Object.keys(result.growth).length).toBe(GROWTH_TOGGLE_KEYS.length);
  });

  it("growth toggle default values are consistent", () => {
    const defaults = GROWTH_DEFAULTS;
    for (const key of GROWTH_TOGGLE_KEYS) {
      const toggle = GROWTH_TOGGLES.find((t) => t.key === key);
      expect(defaults[key]).toBe(toggle?.defaultValue ?? false);
    }
  });
});
