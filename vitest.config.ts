import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./src/test/server-only.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./src/test/global-setup.ts"],
    // Database integration suites talk to a real MongoDB; the default 5s is
    // not enough for a first connection plus index creation.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    /**
     * One test file at a time.
     *
     * Every database suite creates a fresh database and builds the full index
     * set across 26 collections. Run in parallel workers, that meant six of
     * those existing at once, which was enough to exhaust a local containerised
     * MongoDB — it dropped connections and then crashed outright, surfacing as
     * ~80 unrelated test failures that look exactly like a code regression.
     *
     * The whole suite runs in well under a minute serially, so the parallelism
     * was buying very little and costing a great deal of misdiagnosis.
     */
    fileParallelism: false,
    /**
     * Dot-prefixed test files are scratch probes, not suite members.
     *
     * Writing a throwaway `.probe.test.ts` to measure how some function actually
     * behaves is a good habit — it uses the real code instead of reasoning about
     * it. But such a file follows whatever it was investigating, so it references
     * code that may not exist on the current branch, and joining the suite it
     * then fails the pre-push hook for reasons unrelated to the change being
     * pushed. That happened, and the diagnosis cost more than the probe saved.
     *
     * The default excludes are restated because supplying `exclude` replaces
     * them, and dropping node_modules from it would collect every dependency's
     * tests.
     */
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/.*.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts"],
    },
  },
});
