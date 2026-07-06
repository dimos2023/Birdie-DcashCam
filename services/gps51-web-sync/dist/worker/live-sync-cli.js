import { loadConfig, validateWorkerConfig, resetConfigCache } from "../config.js";
import { createLogger } from "../logger.js";
import { getDbClient } from "../db/client.js";
import { createHealthServer } from "../health.js";
import { runLiveSyncWorker, LiveReauthRequiredError } from "./live-sync-worker.js";
const isMain = process.argv[1]?.includes("live-sync-cli");
function resolveMode() {
    const arg = process.argv[2]?.toLowerCase();
    if (arg === "dry")
        return "dry";
    if (arg === "once")
        return "once";
    if (arg === "continuous" || arg === "live")
        return "continuous";
    throw new Error("Usage: live-sync-cli.ts <dry|once|live>");
}
export async function main() {
    resetConfigCache();
    const mode = resolveMode();
    const config = loadConfig(process.env);
    validateWorkerConfig(config);
    const log = createLogger(config);
    const sb = getDbClient(config);
    if (mode === "continuous") {
        createHealthServer(config, log);
    }
    try {
        await runLiveSyncWorker(sb, config, log, mode);
    }
    catch (err) {
        if (err instanceof LiveReauthRequiredError) {
            log.error("Live sync stopped — reauth required");
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
