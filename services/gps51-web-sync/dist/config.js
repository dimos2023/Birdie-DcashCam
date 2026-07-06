import "dotenv/config";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTGRES_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
    GPS51_BASE_URL: z.string().url(),
    GPS51_MONITOR_URL: z.string().url().optional(),
    GPS51_USERNAME: z.string().min(1).default("BXAW"),
    GPS51_STORAGE_STATE_PATH: z.string().default("data/auth/storage-state.json"),
    GPS51_CAPTURE_DIR: z.string().default("data/captures"),
    GPS51_AUTH_SUCCESS_URL_PATTERN: z.string().optional().default(""),
    GPS51_HEADLESS: z
        .string()
        .optional()
        .transform((v) => v === "true" || v === "1"),
    GPS51_OFFLINE_AFTER_SECONDS: z.coerce.number().int().min(60).default(600),
    GPS51_OFFLINE_WARMUP_SECONDS: z.coerce.number().int().min(60).default(900),
    GPS51_LIVE_DRY_DURATION_SECONDS: z.coerce.number().int().min(60).default(300),
    GPS51_LIVE_ONCE_DURATION_SECONDS: z.coerce.number().int().min(30).default(300),
    GPS51_LIVE_MAX_FUTURE_MS: z.coerce.number().int().min(60_000).default(600_000),
    GPS51_SUBSCRIBE_ALL: z
        .string()
        .optional()
        .default("false")
        .transform((v) => v === "true" || v === "1"),
    GPS51_SUBSCRIPTION_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
    GPS51_SUBSCRIPTION_BATCH_DELAY_MS: z.coerce.number().int().min(0).max(10_000).default(500),
    GPS51_SUBSCRIPTION_REFRESH_SECONDS: z.coerce.number().int().min(60).default(300),
    GPS51_STATUS_REFRESH_SECONDS: z.coerce.number().int().min(30).default(180),
    GPS51_STATUS_MIN_DEVICES: z.coerce.number().int().min(1).default(550),
    GPS51_STATUS_BOOTSTRAP_MAX_PORTAL_DELTA: z.coerce.number().int().min(0).default(5),
    GPS51_STATUS_DOM_MAX_DELTA: z.coerce.number().int().min(0).default(2),
    GPS51_STATUS_DOM_MIN_OVERLAP_PERCENT: z.coerce.number().int().min(50).max(100).default(99),
    SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(15).default(60),
    SYNC_JITTER_SECONDS: z.coerce.number().int().min(0).max(60).default(10),
    SYNC_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5000).default(30_000),
    SYNC_MAX_DEVICES: z.coerce.number().int().min(1).max(10_000).default(2000),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    ORGANIZATION_ID: z.string().trim().regex(POSTGRES_UUID_REGEX, "Invalid PostgreSQL UUID"),
    HEALTH_HOST: z.string().min(1).default("0.0.0.0"),
    HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(8091),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});
let cached = null;
function resolveServicePath(relativePath) {
    return path.isAbsolute(relativePath)
        ? relativePath
        : path.resolve(serviceRoot, relativePath);
}
export function loadConfig(env = process.env) {
    if (cached)
        return cached;
    const parsed = envSchema.safeParse(env);
    if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw new Error(`Invalid gps51-web-sync configuration: ${msg}`);
    }
    const base = parsed.data.GPS51_BASE_URL.replace(/\/$/, "");
    const storageStatePath = resolveServicePath(parsed.data.GPS51_STORAGE_STATE_PATH);
    const captureDir = resolveServicePath(parsed.data.GPS51_CAPTURE_DIR);
    cached = {
        ...parsed.data,
        storageStatePath,
        captureDir,
        loginUrl: `${base}/#/login`,
        monitorUrl: parsed.data.GPS51_MONITOR_URL ?? `${base}/#/monitorPage`,
    };
    return cached;
}
export function ensureCaptureDir(config) {
    mkdirSync(config.captureDir, { recursive: true });
    mkdirSync(path.dirname(config.storageStatePath), { recursive: true });
}
export function validateWorkerConfig(config) {
    validateBrowserWorkerConfig(config);
    if (!config.SUPABASE_URL?.trim()) {
        throw new Error("SUPABASE_URL is required for sync/discover");
    }
    if (!config.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for sync/discover");
    }
}
export function validateBrowserWorkerConfig(config) {
    if (!config.GPS51_BASE_URL.trim()) {
        throw new Error("GPS51_BASE_URL is required");
    }
    if (!config.ORGANIZATION_ID) {
        throw new Error("ORGANIZATION_ID is invalid");
    }
    if (!existsSync(config.storageStatePath)) {
        throw new Error(`GPS51 storage state missing at ${config.storageStatePath}. Run npm run auth first.`);
    }
    assertStorageStatePermissions(config.storageStatePath);
}
export function assertStorageStatePermissions(storageStatePath) {
    try {
        const mode = statSync(storageStatePath).mode & 0o777;
        if (process.platform !== "win32" && (mode & 0o077) !== 0) {
            throw new Error(`Storage state file is world-readable (${mode.toString(8)}). Restrict permissions to owner only.`);
        }
    }
    catch (err) {
        if (err instanceof Error && err.message.includes("world-readable"))
            throw err;
    }
}
export function resetConfigCache() {
    cached = null;
}
