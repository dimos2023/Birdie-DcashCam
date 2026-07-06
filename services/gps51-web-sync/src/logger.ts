import pino from "pino";
import type { AppConfig } from "./config.js";

export function createLogger(config: AppConfig) {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: "gps51-web-sync" },
    redact: {
      paths: [
        "password",
        "cookie",
        "cookies",
        "authorization",
        "token",
        "access_token",
        "refresh_token",
        "storageState",
        "SUPABASE_SERVICE_ROLE_KEY",
        "localStorage",
        "sessionStorage",
        "headers.authorization",
        "headers.cookie",
        "*.password",
        "*.token",
        "*.cookie",
        "*.authorization",
      ],
      remove: true,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
