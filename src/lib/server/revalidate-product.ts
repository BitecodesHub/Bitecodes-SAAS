import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Invalidates a product's pages in both signed-in areas.
 *
 * The same screen is rendered at `/admin/forms` and `/app/forms`, so a mutation
 * that revalidates only one of them leaves the other showing what was true
 * before the change. Staff and customers rarely look at the same account, but
 * "rarely" is not "never" — an operator troubleshooting their own embed is
 * exactly the person who would hit it.
 *
 * Its own module rather than a helper inside each `"use server"` file, where
 * every export must be an async function.
 */
export function revalidateProduct(
  segment: "chatbots" | "forms" | "bookings" | "chatbots/api-keys",
): void {
  revalidatePath(`/admin/${segment}`);
  // The customer area mirrors the admin paths, except that API keys live under
  // the email product rather than under chatbots.
  revalidatePath(
    segment === "chatbots/api-keys" ? "/app/email" : `/app/${segment}`,
  );
}

/** The same, for one record's detail page. */
export function revalidateProductRecord(
  segment: "chatbots" | "forms" | "bookings",
  id: string,
): void {
  revalidatePath(`/admin/${segment}/${id}`);
  revalidatePath(`/app/${segment}/${id}`);
}
