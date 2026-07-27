import "server-only";

/**
 * Serialises calls to one host and spaces them out.
 *
 * Overpass and Nominatim are donated infrastructure whose usage policies cap
 * request rate; exceeding them gets an application blocked. This is the only
 * mechanism enforcing that cap, so it is deliberately simple enough to reason
 * about completely.
 *
 * Implemented as a promise chain rather than a "sleep if too soon" check.
 * Ordering has to hold when callers arrive at the same instant, and a timestamp
 * check does not give that: two simultaneous callers would both read the same
 * stale `lastStartedAt`, both conclude they were free to go, and both fire.
 * Awaiting the previous task makes the queue explicit.
 */
export class HostThrottle {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStartedAt = 0;

  constructor(
    private readonly minIntervalMs: number,
    /** Injected for tests, so timing assertions do not need real clocks. */
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const scheduled = this.tail.then(async () => {
      const wait = this.lastStartedAt + this.minIntervalMs - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastStartedAt = this.now();
      return task();
    });

    // Keep the chain alive when a task rejects. Assigning `scheduled` directly
    // would leave a rejected promise as the tail, and every later request would
    // then fail with the first request's error.
    this.tail = scheduled.catch(() => undefined);
    return scheduled;
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
