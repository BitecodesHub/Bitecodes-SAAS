import { describe, expect, it } from "vitest";
import {
  buildSubmissionSchema,
  defaultFields,
  formFieldsSchema,
  HONEYPOT_FIELD,
} from "@/lib/forms/fields";
import type { FormField } from "@/lib/server/db/types";

function field(overrides: Partial<FormField> = {}): FormField {
  return {
    id: "f1",
    type: "text",
    name: "subject",
    label: "Subject",
    placeholder: null,
    required: false,
    options: [],
    maxLength: null,
    ...overrides,
  };
}

describe("formFieldsSchema", () => {
  it("accepts the default starter fields", () => {
    expect(formFieldsSchema.safeParse(defaultFields()).success).toBe(true);
  });

  it("rejects duplicate field names", () => {
    const result = formFieldsSchema.safeParse([
      field({ id: "a", name: "email" }),
      field({ id: "b", name: "email" }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects reserved and unsafe field names", () => {
    for (const name of ["_token", "__proto__", "Has-Dash", "1leading"]) {
      expect(formFieldsSchema.safeParse([field({ name })]).success).toBe(false);
    }
  });

  it("requires options on a select field", () => {
    expect(
      formFieldsSchema.safeParse([field({ type: "select", options: [] })])
        .success,
    ).toBe(false);
    expect(
      formFieldsSchema.safeParse([
        field({ type: "select", options: ["One", "Two"] }),
      ]).success,
    ).toBe(true);
  });
});

describe("buildSubmissionSchema", () => {
  it("validates a simple required text + email form", () => {
    const schema = buildSubmissionSchema([
      field({ id: "a", name: "name", required: true }),
      field({ id: "b", name: "email", type: "email", required: true }),
    ]);

    expect(
      schema.safeParse({ name: "Ada", email: "ADA@Example.com " }).success,
    ).toBe(true);
    // Missing a required field fails.
    expect(schema.safeParse({ name: "Ada" }).success).toBe(false);
    // A malformed email fails.
    expect(schema.safeParse({ name: "Ada", email: "nope" }).success).toBe(
      false,
    );
  });

  it("rejects unknown keys, so a caller cannot smuggle extra data", () => {
    const schema = buildSubmissionSchema([field({ name: "name" })]);
    const result = schema.safeParse({ name: "Ada", isAdmin: "true" });
    expect(result.success).toBe(false);
  });

  it("never accepts the honeypot as a data field", () => {
    const schema = buildSubmissionSchema([field({ name: "name" })]);
    expect(
      schema.safeParse({ name: "Ada", [HONEYPOT_FIELD]: "bot" }).success,
    ).toBe(false);
  });

  it("constrains a select to the owner's own options", () => {
    const schema = buildSubmissionSchema([
      field({
        type: "select",
        name: "plan",
        options: ["Basic", "Pro"],
        required: true,
      }),
    ]);
    expect(schema.safeParse({ plan: "Pro" }).success).toBe(true);
    expect(schema.safeParse({ plan: "Enterprise" }).success).toBe(false);
  });

  it("coerces numbers and checkboxes from form strings", () => {
    const schema = buildSubmissionSchema([
      field({ id: "n", type: "number", name: "quantity", required: true }),
      field({ id: "c", type: "checkbox", name: "consent", required: true }),
    ]);
    const result = schema.safeParse({ quantity: "42", consent: "on" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(42);
      expect(result.data.consent).toBe(true);
    }
  });

  it("requires a required checkbox to be ticked", () => {
    const schema = buildSubmissionSchema([
      field({ id: "c", type: "checkbox", name: "consent", required: true }),
    ]);
    expect(schema.safeParse({ consent: "false" }).success).toBe(false);
  });

  it("enforces maxLength caps", () => {
    const schema = buildSubmissionSchema([
      field({ name: "note", maxLength: 5, required: true }),
    ]);
    expect(schema.safeParse({ note: "hello" }).success).toBe(true);
    expect(schema.safeParse({ note: "hello world" }).success).toBe(false);
  });

  it("allows an optional field to be omitted or blank", () => {
    const schema = buildSubmissionSchema([
      field({ id: "a", name: "name", required: true }),
      field({ id: "b", name: "company", required: false }),
    ]);
    expect(schema.safeParse({ name: "Ada" }).success).toBe(true);
    expect(schema.safeParse({ name: "Ada", company: "" }).success).toBe(true);
  });
});
