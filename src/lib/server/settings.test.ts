import { describe, expect, it } from "vitest";
import { flatten } from "@/lib/server/settings";

describe("flatten", () => {
  it("converts nested objects to dot paths", () => {
    expect(flatten({ contact: { email: "a@b.com" } })).toEqual({
      "contact.email": "a@b.com",
    });
    expect(flatten({ a: { b: { c: 1 } } })).toEqual({ "a.b.c": 1 });
  });

  it("keeps top-level scalars", () => {
    expect(flatten({ enabled: true, count: 3 })).toEqual({
      enabled: true,
      count: 3,
    });
  });

  it("treats arrays as leaves so $set replaces them wholesale", () => {
    // Flattening an array into "tags.0" would merge with existing entries and
    // leave stale items behind.
    expect(flatten({ tags: ["a", "b"] })).toEqual({ tags: ["a", "b"] });
  });

  it("treats dates as leaves", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(flatten({ at: date })).toEqual({ at: date });
  });

  it("preserves null so a field can be cleared", () => {
    expect(flatten({ outreach: { replyTo: null } })).toEqual({
      "outreach.replyTo": null,
    });
  });

  it("drops undefined so an absent field is not overwritten", () => {
    expect(flatten({ a: undefined, b: 1 })).toEqual({ b: 1 });
    expect(flatten({ nested: { a: undefined, b: 2 } })).toEqual({
      "nested.b": 2,
    });
  });

  it("never emits an _id path", () => {
    // Mongo rejects an update that tries to $set the immutable _id.
    expect(flatten({ _id: "site", a: 1 })).toEqual({ a: 1 });
  });

  it("produces paths that patch one field without clobbering siblings", () => {
    // The point of dot paths: two admins editing different settings sections
    // must not overwrite each other.
    const patch = flatten({ automation: { requireApproval: false } });
    expect(Object.keys(patch)).toEqual(["automation.requireApproval"]);
    expect(patch).not.toHaveProperty("automation");
  });

  it("handles an empty object", () => {
    expect(flatten({})).toEqual({});
  });
});
