import Fastify from "fastify";
import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { pingSupabase } from "./db/supabase-admin.js";
import { listSessions } from "./jt808/session-registry.js";
import { getPipelineCount } from "./media/ffmpeg-manager.js";

export interface HealthState {
  signalingBound: boolean;
  mediaBound: boolean;
}

export function createHealthServer(
  config: AppConfig,
  log: Logger,
  state: HealthState,
) {
  const app = Fastify({ logger: false });

  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_req, reply) => {
    const supabaseOk = await pingSupabase(config);
    const ready = supabaseOk && state.signalingBound;
    if (!ready) {
      return reply.status(503).send({
        status: "not_ready",
        supabase: supabaseOk,
        signaling: state.signalingBound,
        media: state.mediaBound,
      });
    }
    return { status: "ready", supabase: true, signaling: true, media: state.mediaBound };
  });

  app.get("/metrics", async () => ({
    gateway_instance_id: config.GATEWAY_INSTANCE_ID,
    active_sessions: listSessions().length,
    ffmpeg_pipelines: getPipelineCount(),
  }));

  app
    .listen({ host: "0.0.0.0", port: config.HEALTH_HTTP_PORT })
    .then(() => log.info({ port: config.HEALTH_HTTP_PORT }, "Health server listening"))
    .catch((err) => log.error({ err }, "Health server failed"));

  return app;
}
