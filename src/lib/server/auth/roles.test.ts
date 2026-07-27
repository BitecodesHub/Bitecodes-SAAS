import { describe, expect, it } from "vitest";
import type { AdminRole } from "@/lib/server/db/types";
import {
  CAPABILITIES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_ORDER,
  can,
  capabilitiesFor,
  type Capability,
} from "@/lib/server/auth/roles";

const ROLES: AdminRole[] = ["owner", "admin", "editor", "viewer"];

describe("can", () => {
  it("gives the owner every capability", () => {
    for (const capability of CAPABILITIES) {
      expect(can("owner", capability), capability).toBe(true);
    }
  });

  it("lets every role read", () => {
    for (const role of ROLES) {
      expect(can(role, "view"), role).toBe(true);
    }
  });

  it("reserves account management for the owner", () => {
    expect(can("owner", "manage_users")).toBe(true);
    for (const role of ["admin", "editor", "viewer"] as AdminRole[]) {
      expect(can(role, "manage_users"), role).toBe(false);
    }
  });

  it("separates drafting from publishing", () => {
    // The distinction that matters: an editor may write freely, but pushing a
    // page live reaches customers and search engines.
    expect(can("editor", "write_content")).toBe(true);
    expect(can("editor", "publish_content")).toBe(false);
    expect(can("admin", "publish_content")).toBe(true);
  });

  it("withholds outbound email from editors and viewers", () => {
    // Approving outreach sends mail to real businesses in the company's name.
    expect(can("editor", "send_email")).toBe(false);
    expect(can("viewer", "send_email")).toBe(false);
    expect(can("admin", "send_email")).toBe(true);
  });

  it("gives a viewer nothing beyond reading", () => {
    expect(capabilitiesFor("viewer")).toEqual(["view"]);
    for (const capability of CAPABILITIES) {
      if (capability === "view") continue;
      expect(can("viewer", capability), capability).toBe(false);
    }
  });

  it("keeps prospect discovery away from editors", () => {
    // Discovery spends third-party quota and creates outreach targets.
    expect(can("editor", "manage_prospects")).toBe(false);
    expect(can("admin", "manage_prospects")).toBe(true);
  });

  it("returns false for an unknown role instead of throwing", () => {
    // Guards a role string read from an old session document.
    expect(can("superuser" as AdminRole, "view")).toBe(false);
    expect(can("" as AdminRole, "view")).toBe(false);
  });

  it("returns false for an unknown capability", () => {
    expect(can("owner", "delete_everything" as Capability)).toBe(false);
  });
});

describe("permission matrix shape", () => {
  it("is monotonic down the role order", () => {
    // Each role must hold a subset of the one above it. Without this a
    // lower-privileged role could gain something its senior lacks, which makes
    // the matrix impossible to reason about.
    for (let index = 1; index < ROLE_ORDER.length; index += 1) {
      const senior = capabilitiesFor(ROLE_ORDER[index - 1]!);
      const junior = capabilitiesFor(ROLE_ORDER[index]!);
      for (const capability of junior) {
        expect(
          senior.includes(capability),
          `${ROLE_ORDER[index]} has "${capability}" but ${ROLE_ORDER[index - 1]} does not`,
        ).toBe(true);
      }
    }
  });

  it("grants strictly fewer capabilities at each step down", () => {
    const counts = ROLE_ORDER.map((role) => capabilitiesFor(role).length);
    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index]!, ROLE_ORDER[index]).toBeLessThan(
        counts[index - 1]!,
      );
    }
  });

  it("references only declared capabilities", () => {
    for (const role of ROLES) {
      for (const capability of capabilitiesFor(role)) {
        expect(CAPABILITIES, `${role}: ${capability}`).toContain(capability);
      }
    }
  });

  it("has no duplicate capabilities in any role", () => {
    for (const role of ROLES) {
      const list = capabilitiesFor(role);
      expect(new Set(list).size, role).toBe(list.length);
    }
  });

  it("labels and describes every role", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role], role).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[role], role).toBeTruthy();
    }
    expect(ROLE_ORDER).toHaveLength(ROLES.length);
    expect(new Set(ROLE_ORDER).size).toBe(ROLES.length);
  });
});
