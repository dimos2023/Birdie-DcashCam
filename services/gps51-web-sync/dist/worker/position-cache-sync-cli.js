import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig, validateBrowserWorkerConfig, validateWorkerConfig, ensureCaptureDir, resetConfigCache, } from "../config.js";
import { createLogger } from "../logger.js";
import { getDbClient } from "../db/client.js";
import { runPositionCacheSync, PositionCacheSyncError, POSITION_CACHE_SYNC_SUMMARY_FILE, buildPositionCacheSyncSummary, } from "./position-cache-sync.js";
const isMain = process.argv[1]?.includes("position-cache-sync-cli");
function resolveMode() {
    const arg = process.argv[2]?.toLowerCase();
    if (arg === "dry")
        return "dry";
    if (arg === "sync")
        return "sync";
    throw new Error("Usage: position-cache-sync-cli.ts <dry|sync>");
}
export async function main() {
    resetConfigCache();
    const mode = resolveMode();
    const config = loadConfig(process.env);
    ensureCaptureDir(config);
    const failurePath = path.join(config.captureDir, POSITION_CACHE_SYNC_SUMMARY_FILE);
    try {
        if (mode === "sync")
            validateWorkerConfig(config);
        else
            validateBrowserWorkerConfig(config);
        const log = createLogger(config);
        const sb = mode === "sync" ? getDbClient(config) : null;
        const result = await runPositionCacheSync(sb, config, log, mode, undefined, undefined);
        if (!result.validated) {
            process.exitCode = 2;
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writeFileSync(failurePath, JSON.stringify(buildPositionCacheSyncSummary({
            inventoryCount: 0,
            devicesAttempted: 0,
            cacheHitsBeforeSelection: 0,
            positionsReceivedAfterSelection: 0,
            validPositions: 0,
            invalidPositions: 0,
            missingPositions: 0,
            duplicatePositions: 0,
            onlineDevicesWithPosition: 0,
            offlineDevicesWithPosition: 0,
            databaseWrites: 0,
            validated: false,
            validationReasons: [message],
        }), null, 2));
        if (err instanceof PositionCacheSyncError) {
            console.error(message);
            process.exitCode = 2;
            return;
        }
        throw err;
    }
}
if (isMain) {
    main()
        .then(() => {
        if (process.exitCode == null)
            process.exit(0);
    })
        .catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
