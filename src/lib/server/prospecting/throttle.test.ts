import { describe, expect, it } from "vitest";
import { HostThrottle } from "@/lib/server/prospecting/throttle";

/** A controllable clock, so timing assertions do not depend on real time. */
function fakeClock(start = 1_000) {
  let current = start;
  const sleeps: number[] = [];
  return {
    now: () => current,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      current += ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
    sleeps,
  };
}

describe("HostThrottle", () => {
  it("runs a single task immediately", async () => {
    const clock = fakeClock();
    const throttle = new HostThrottle(1_000, clock.now, clock.sleep);

    await expect(throttle.run(async () => "ok")).resolves.toBe("ok");
    expect(clock.sleeps).toEqual([]);
  });

  it("spaces consecutive tasks by the minimum interval", async () => {
    const clock = fakeClock();
    const throttle = new HostThrottle(1_000, clock.now, clock.sleep);

    await throttle.run(async () => "a");
    await throttle.run(async () => "b");

    // The second task had to wait the full interval, since no time passed.
    expect(clock.sleeps).toEqual([1_000]);
  });

  it("does not wait when enough time has already passed", async () => {
    const clock = fakeClock();
    const throttle = new HostThrottle(1_000, clock.now, clock.sleep);

    await throttle.run(async () => "a");
    clock.advance(1_500);
    await throttle.run(async () => "b");

    expect(clock.sleeps).toEqual([]);
  });

  it("serialises tasks that arrive at the same instant", async () => {
    // The property a timestamp check cannot provide: two callers racing must
    // still leave the host one request at a time.
    const clock = fakeClock();
    const throttle = new HostThrottle(1_000, clock.now, clock.sleep);
    const order: string[] = [];

    let releaseFirst: (() => void) | undefined;
    const first = throttle.run(async () => {
      order.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      order.push("first:end");
    });
    const second = throttle.run(async () => {
      order.push("second:start");
    });

    // Let the first task begin, then confirm the second has not started.
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(["first:start"]);

    releaseFirst?.();
    await Promise.all([first, second]);

    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("keeps running later tasks after one rejects", async () => {
    // A rejected tail would otherwise poison the chain and fail every
    // subsequent request with the first request's error.
    const clock = fakeClock();
    const throttle = new HostThrottle(0, clock.now, clock.sleep);

    await expect(
      throttle.run(async () => {
        throw new Error("provider down");
      }),
    ).rejects.toThrow("provider down");

    await expect(throttle.run(async () => "recovered")).resolves.toBe(
      "recovered",
    );
  });

  it("propagates each task's own rejection, not a neighbour's", async () => {
    const clock = fakeClock();
    const throttle = new HostThrottle(0, clock.now, clock.sleep);

    const first = throttle.run(async () => {
      throw new Error("first failed");
    });
    const second = throttle.run(async () => {
      throw new Error("second failed");
    });

    await expect(first).rejects.toThrow("first failed");
    await expect(second).rejects.toThrow("second failed");
  });

  it("preserves submission order across many tasks", async () => {
    const clock = fakeClock();
    const throttle = new HostThrottle(10, clock.now, clock.sleep);
    const seen: number[] = [];

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        throttle.run(async () => {
          seen.push(index);
        }),
      ),
    );

    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // Seven gaps between eight requests.
    expect(clock.sleeps).toHaveLength(7);
  });
});
