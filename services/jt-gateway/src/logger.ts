import pino from "pino";
import type { AppConfig } from "./config.js";

export function createLogger(config: AppConfig) {
  return pino({
    level: config.LOG_LEVEL,
    base: { gateway_instance_id: config.GATEWAY_INSTANCE_ID },
    redact: {
      paths: [
        "auth_code",
        "authCode",
        "SUPABASE_SERVICE_ROLE_KEY",
        "stream_token",
        "access_token",
      ],
      remove: true,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
