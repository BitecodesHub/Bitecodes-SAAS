import "server-only";

import {
  adminUsers,
  emailMessages,
  prospects,
} from "@/lib/server/db/collections";
import { getSettingsFresh } from "@/lib/server/settings";

/**
 * The getting-started checklist.
 *
 * Every step is derived from real data rather than a "dismissed" flag, so it
 * cannot claim something is done that is not, and it disappears on its own once
 * the work is genuinely finished. The order is the order the work has to happen
 * in: you cannot send outreach before there is a postal address to put in the
 * footer, and there is nothing to send until prospects exist.
 */

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  /** Blocks outreach entirely until resolved, rather than merely being unfinished. */
  blocking: boolean;
}

export interface SetupState {
  steps: SetupStep[];
  completed: number;
  total: number;
  allDone: boolean;
}

export async function getSetupState(): Promise<SetupState> {
  const settings = await getSettingsFresh();

  const [prospectCount, sentCount, teamCount] = await Promise.all([
    count(async () => (await prospects()).countDocuments()),
    count(async () =>
      (await emailMessages()).countDocuments({ status: "sent" }),
    ),
    count(async () => (await adminUsers()).countDocuments()),
  ]);

  const hasPostal = settings.contact.address.postal.trim().length > 0;

  const steps: SetupStep[] = [
    {
      id: "postal",
      title: "Add your postal address",
      description:
        "Commercial email must carry a physical address. Outreach refuses to send until this is set.",
      href: "/admin/settings",
      cta: "Open settings",
      done: hasPostal,
      blocking: !hasPostal,
    },
    {
      id: "discover",
      title: "Find businesses to contact",
      description:
        "Pick an area on the map and the trades you serve. Each business is checked and tagged with the reason it needs you.",
      href: "/admin/customers/discover",
      cta: "Grab customers",
      done: prospectCount > 0,
      blocking: false,
    },
    {
      id: "outreach",
      title: "Send your first outreach email",
      description:
        "Start a sequence from the customers table. Nothing leaves until you approve it in the queue.",
      href: "/admin/customers",
      cta: "Open customers",
      done: sentCount > 0,
      blocking: false,
    },
    {
      id: "team",
      title: "Add your team",
      description:
        "Give the people who work your leads and run outreach their own sign-in, with only the access their role needs.",
      href: "/admin/users",
      cta: "Open team",
      done: teamCount > 1,
      blocking: false,
    },
  ];

  const completed = steps.filter((step) => step.done).length;
  return {
    steps,
    completed,
    total: steps.length,
    allDone: completed === steps.length,
  };
}

/** A failed count must not take the dashboard down; treat it as "not done yet". */
async function count(run: () => Promise<number>): Promise<number> {
  try {
    return await run();
  } catch {
    return 0;
  }
}
