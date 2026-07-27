/**
 * Vitest global setup.
 *
 * Its one job is to make a partial test run impossible to mistake for a
 * complete one: database integration suites are skipped when no MongoDB is
 * available, and a skip that scrolls past in a wall of green is how untested
 * code reaches production.
 */
export default function globalSetup() {
  if (process.env.TEST_MONGODB_URI?.trim()) {
    console.log(
      "[test] TEST_MONGODB_URI is set — database integration suites will run.",
    );
    return;
  }

  console.warn(
    [
      "",
      "  ┌───────────────────────────────────────────────────────────────────┐",
      "  │  TEST_MONGODB_URI is not set.                                     │",
      "  │  Database integration suites will be SKIPPED, not passed.         │",
      "  │                                                                   │",
      "  │  To run them:                                                     │",
      "  │    docker run -d -p 27017:27017 --name bc-test-mongo mongo:8      │",
      "  │    export TEST_MONGODB_URI=mongodb://127.0.0.1:27017              │",
      "  │                                                                   │",
      "  │  CI always sets this, so these suites are enforced there.         │",
      "  └───────────────────────────────────────────────────────────────────┘",
      "",
    ].join("\n"),
  );
}
