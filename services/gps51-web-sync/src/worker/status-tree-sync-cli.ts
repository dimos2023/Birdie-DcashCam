import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  loadConfig,
  validateBrowserWorkerConfig,
  validateWorkerConfig,
  ensureCaptureDir,
  resetConfigCache,
} from "../config.js";
import { createLogger } from "../logger.js";
import { getDbClient } from "../db/client.js";
import {
  runStatusTreeSync,
  StatusTreeSyncError,
  STATUS_TREE_SYNC_SUMMARY_FILE,
  buildTreeSyncSummary,
} from "./status-tree-sync.js";

const isMain = process.argv[1]?.includes("status-tree-sync-cli");

function resolveMode(): "dry" | "sync" {
  const arg = process.argv[2]?.toLowerCase();
  if (arg === "dry") return "dry";
  if (arg === "sync") return "sync";
  throw new Error("Usage: status-tree-sync-cli.ts <dry|sync>");
}

export async function main(): Promise<void> {
  resetConfigCache();
  const mode = resolveMode();
  const config = loadConfig(process.env);
  ensureCaptureDir(config);
  const failurePath = path.join(config.captureDir, STATUS_TREE_SYNC_SUMMARY_FILE);

  try {
    if (mode === "sync") validateWorkerConfig(config);
    else validateBrowserWorkerConfig(config);

    const log = createLogger(config);
    const sb = mode === "sync" ? getDbClient(config) : null;
    const result = await runStatusTreeSync(sb, config, log, mode, undefined, undefined);
    if (!result.validated) {
      process.exitCode = 2;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeFileSync(
      failurePath,
      JSON.stringify(
        buildTreeSyncSummary({
          status: "failed",
          mode,
          portalCounts: null,
          reconciliation: null,
          inventoryCount: 0,
          inventorySource: null,
          databaseWrites: 0,
          componentPath: null,
          extractionError: null,
          malformedNodeCount: 0,
          errorMessage: message,
        }),
        null,
        2,
      ),
    );
    if (err instanceof StatusTreeSyncError) {
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
      if (process.exitCode == null) process.exit(0);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
