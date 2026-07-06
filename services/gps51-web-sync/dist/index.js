import { loadConfig, validateWorkerConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { getDbClient } from "./db/client.js";
import { createHealthServer } from "./health.js";
import { runSyncCycle } from "./worker/sync-cycle.js";
import { startScheduler } from "./worker/scheduler.js";
const config = loadConfig(process.env);
validateWorkerConfig(config);
const log = createLogger(config);
const sb = getDbClient(config);
createHealthServer(config, log);
const stopScheduler = startScheduler(config, log, () => runSyncCycle(sb, config, log));
const shutdown = () => {
    log.info("Shutting down gps51-web-sync worker");
    stopScheduler();
    process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
