/**
 * Runs once per Next.js server instance, before the first request.
 *
 * The only job here is to start the autonomous bootstrap in the background:
 * a fresh database gets its settings document, default discovery presets, and
 * seed records without anyone opening the admin panel.
 *
 * Deliberately **not awaited**. `register` blocks the server becoming ready,
 * and a deployment whose database is unreachable must still boot and serve the
 * public site — that is the no-credential profile in `docs/operations/`. The
 * bootstrap reports its failure through `/api/health`, the admin panel, and
 * the server log instead of preventing startup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { runBootstrap } = await import("@/lib/server/bootstrap");

  void runBootstrap({ source: "server-start" })
    .then((report) => {
      if (!report.ok) {
        console.error(
          "[bootstrap] First-boot reconciliation had errors:",
          report.errors.join(" | "),
        );
        return;
      }
      console.info(
        `[bootstrap] ${report.reconciled ? "Reconciled" : "Already current"}; ` +
          `presets created: ${report.presets.created}; ` +
          `outbound gate: ${report.gates.state}.`,
      );
    })
    .catch((error) => {
      console.error(
        "[bootstrap] First-boot reconciliation failed:",
        error instanceof Error ? error.message : error,
      );
    });
}
