import Fastify from "fastify";
import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { pingSupabase } from "./db/client.js";
import { storageStateExists } from "./auth/session.js";
import { getSchedulerState } from "./worker/scheduler.js";
import { liveMetricsForHealth } from "./worker/live-sync-metrics.js";

export function createHealthServer(config: AppConfig, log: Logger) {
  const app = Fastify({ logger: false });

  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_req, reply) => {
    const supabaseOk = await pingSupabase(config);
    const authenticated = storageStateExists(config);
    const scheduler = getSchedulerState();
    const live = liveMetricsForHealth();

    const ready = supabaseOk && authenticated && !live.reauthRequired;
    const body = {
      status: ready ? "ready" : "not_ready",
      browser: true,
      authenticated,
      supabase: supabaseOk,
      lastSyncAt: scheduler.lastSyncAt,
      lastSyncStatus: scheduler.lastSyncStatus,
      ...live,
    };

    if (!ready) return reply.status(503).send(body);
    return body;
  });

  app.get("/metrics", async () => {
    const scheduler = getSchedulerState();
    const live = liveMetricsForHealth();
    return {
      service: "gps51-web-sync",
      health_port: config.HEALTH_PORT,
      last_sync_at: scheduler.lastSyncAt,
      last_sync_status: scheduler.lastSyncStatus,
      last_error: scheduler.lastError ? "[present]" : null,
      backoff_ms: scheduler.backoffMs,
      running: scheduler.running,
      ...live,
    };
  });

  app
    .listen({ host: "127.0.0.1", port: config.HEALTH_PORT })
    .then(() => log.info({ port: config.HEALTH_PORT, bind: "127.0.0.1" }, "Health server listening"))
    .catch((err) => log.error({ err }, "Health server failed"));

  return app;
}
