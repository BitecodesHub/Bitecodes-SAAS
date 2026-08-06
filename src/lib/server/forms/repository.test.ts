import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

/**
 * Forms repository tests against a real MongoDB. Tenant isolation is the
 * property that matters most — one owner must never read or mutate another's
 * form or submissions — so it is exercised directly.
 */
describeWithDatabase("forms repository", () => {
  useTestDatabase();

  const A = "owner-a";
  const B = "owner-b";

  beforeEach(async () => {
    const { forms, formSubmissions } =
      await import("@/lib/server/db/collections");
    await (await forms()).deleteMany({});
    await (await formSubmissions()).deleteMany({});
  });

  it("creates a form with default fields and a one-time public token", async () => {
    const { createForm, getForm } =
      await import("@/lib/server/forms/repository");
    const { formId, publicToken } = await createForm({
      ownerId: A,
      name: "Contact us",
      allowedDomains: ["HTTPS://Example.com/path", "*.example.com"],
      notifyEmails: ["Owner@Example.com"],
    });
    expect(publicToken.startsWith("fm_pub_")).toBe(true);

    const form = await getForm(A, formId);
    expect(form?.name).toBe("Contact us");
    // Domains normalised and de-duplicated; emails lowercased.
    expect(form?.allowedDomains).toEqual(["example.com", "*.example.com"]);
    expect(form?.notifyEmails).toEqual(["owner@example.com"]);
    // Starter fields exist so a new form is usable immediately.
    expect(form?.fields.map((f) => f.name)).toEqual([
      "name",
      "email",
      "message",
    ]);
    // The token itself is never stored, only its hash.
    expect(form?.publicTokenHash).toBeTruthy();
    expect(
      (form as unknown as { publicToken?: string }).publicToken,
    ).toBeUndefined();
  });

  it("isolates tenants: B cannot read or mutate A's form", async () => {
    const { createForm, getForm, updateForm, deleteForm, setFormStatus } =
      await import("@/lib/server/forms/repository");
    const { formId } = await createForm({ ownerId: A, name: "A form" });

    expect(await getForm(B, formId)).toBeNull();
    expect(await updateForm(B, formId, { name: "hijacked" })).toBe(false);
    expect(await setFormStatus(B, formId, "paused")).toBe(false);
    expect(await deleteForm(B, formId)).toBe(false);
    expect((await getForm(A, formId))?.name).toBe("A form");
  });

  it("resolves for the public embed only with the right token and while active", async () => {
    const { createForm, getFormForPublic, setFormStatus } =
      await import("@/lib/server/forms/repository");
    const { formId, publicToken } = await createForm({
      ownerId: A,
      name: "Form",
    });

    expect(await getFormForPublic(formId, publicToken)).not.toBeNull();
    expect(await getFormForPublic(formId, "wrong-token")).toBeNull();

    await setFormStatus(A, formId, "paused");
    // A paused form must not serve the embed even with the correct token.
    expect(await getFormForPublic(formId, publicToken)).toBeNull();
  });

  it("rotates the public token, invalidating the old embed", async () => {
    const { createForm, getFormForPublic, rotatePublicToken } =
      await import("@/lib/server/forms/repository");
    const { formId, publicToken } = await createForm({
      ownerId: A,
      name: "Form",
    });

    const next = await rotatePublicToken(A, formId);
    expect(next).toBeTruthy();
    expect(next).not.toBe(publicToken);
    expect(await getFormForPublic(formId, publicToken)).toBeNull();
    expect(await getFormForPublic(formId, next!)).not.toBeNull();
  });

  it("merges appearance on partial update without dropping fields", async () => {
    const { createForm, updateForm, getForm } =
      await import("@/lib/server/forms/repository");
    const { formId } = await createForm({ ownerId: A, name: "Form" });

    await updateForm(A, formId, { appearance: { primaryColor: "#000000" } });
    const form = await getForm(A, formId);
    expect(form?.appearance.primaryColor).toBe("#000000");
    expect(form?.appearance.buttonText).toBeTruthy();
  });

  it("records submissions, bumps the counter, and scopes reads by owner", async () => {
    const { createForm, getForm, recordSubmission, listSubmissions } =
      await import("@/lib/server/forms/repository");
    const { formId } = await createForm({ ownerId: A, name: "Form" });

    await recordSubmission({
      ownerId: A,
      formId,
      data: { name: "Ada", email: "ada@example.com" },
      meta: { ipHash: "h", userAgent: "ua", referrer: null, origin: null },
    });

    expect((await getForm(A, formId))?.submissionCount).toBe(1);
    expect(await listSubmissions(A, formId)).toHaveLength(1);
    // Another owner sees nothing.
    expect(await listSubmissions(B, formId)).toHaveLength(0);
  });

  it("deleting a form removes its submissions too", async () => {
    const { createForm, recordSubmission, deleteForm, listSubmissions } =
      await import("@/lib/server/forms/repository");
    const { formId } = await createForm({ ownerId: A, name: "Form" });
    await recordSubmission({
      ownerId: A,
      formId,
      data: { name: "Ada" },
      meta: { ipHash: null, userAgent: null, referrer: null, origin: null },
    });

    expect(await deleteForm(A, formId)).toBe(true);
    expect(await listSubmissions(A, formId)).toHaveLength(0);
  });
});
