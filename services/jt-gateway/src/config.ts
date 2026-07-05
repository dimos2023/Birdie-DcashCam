import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  GATEWAY_INSTANCE_ID: z.string().min(1),

  JT808_BIND_HOST: z.string().default("0.0.0.0"),
  JT808_TCP_PORT: z.coerce.number().int().min(1).max(65535).default(6808),
  JT808_ENABLE_UDP: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  JT808_UDP_PORT: z.coerce.number().int().min(1).max(65535).default(6808),
  JT808_SOCKET_IDLE_SECONDS: z.coerce.number().int().min(30).default(180),
  JT808_MAX_FRAME_BYTES: z.coerce.number().int().min(256).default(65535),
  JT808_ALLOW_AUTO_REGISTRATION: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),

  JT1078_BIND_HOST: z.string().default("0.0.0.0"),
  JT1078_TCP_PORT: z.coerce.number().int().min(1).max(65535).default(6809),
  JT1078_ENABLE_UDP: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  JT1078_UDP_PORT: z.coerce.number().int().min(1).max(65535).default(6810),
  JT1078_MAX_PACKET_BYTES: z.coerce.number().int().min(256).default(65535),

  PUBLIC_GATEWAY_IPV4: z.string().optional().default(""),
  PUBLIC_GATEWAY_DOMAIN: z.string().optional().default(""),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  COMMAND_POLL_INTERVAL_MS: z.coerce.number().int().min(50).default(250),
  COMMAND_ACK_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  COMMAND_MAX_RETRIES: z.coerce.number().int().min(1).max(20).default(3),

  MEDIAMTX_RTSP_URL: z.string().default("rtsp://mediamtx:8554"),
  MEDIAMTX_HLS_BASE_URL: z.string().default("http://localhost:8888"),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  H265_TRANSCODE_TO_H264: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0"),

  STREAM_TOKEN_SECRET: z.string().min(8),
  HEALTH_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8090),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid gateway configuration: ${msg}`);
  }
  cached = parsed.data;
  return cached;
}

export function getPublicMediaHost(config: AppConfig): string {
  if (config.PUBLIC_GATEWAY_DOMAIN.trim()) return config.PUBLIC_GATEWAY_DOMAIN.trim();
  if (config.PUBLIC_GATEWAY_IPV4.trim()) return config.PUBLIC_GATEWAY_IPV4.trim();
  return "127.0.0.1";
}
