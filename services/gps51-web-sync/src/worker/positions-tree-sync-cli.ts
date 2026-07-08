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
  runPositionsTreeSync,
  PositionsTreeSyncError,
  POSITIONS_TREE_SYNC_SUMMARY_FILE,
  buildPositionsTreeSyncSummary,
} from "./positions-tree-sync.js";

const isMain = process.argv[1]?.includes("positions-tree-sync-cli");

function resolveMode(): "dry" | "sync" {
  const arg = process.argv[2]?.toLowerCase();
  if (arg === "dry") return "dry";
  if (arg === "sync") return "sync";
  throw new Error("Usage: positions-tree-sync-cli.ts <dry|sync>");
}

export async function main(): Promise<void> {
  resetConfigCache();
  const mode = resolveMode();
  const config = loadConfig(process.env);
  ensureCaptureDir(config);
  const failurePath = path.join(config.captureDir, POSITIONS_TREE_SYNC_SUMMARY_FILE);

  try {
    if (mode === "sync") validateWorkerConfig(config);
    else validateBrowserWorkerConfig(config);

    const log = createLogger(config);
    const sb = mode === "sync" ? getDbClient(config) : null;
    const result = await runPositionsTreeSync(sb, config, log, mode, undefined, undefined);
    if (!result.validated) {
      process.exitCode = 2;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeFileSync(
      failurePath,
      JSON.stringify(
        buildPositionsTreeSyncSummary({
          status: "failed",
          mode,
          inventoryCount: 0,
          inventorySource: null,
          extraction: null,
          databaseWrites: 0,
          duplicates: 0,
          rejected: 0,
          errorMessage: message,
        }),
        null,
        2,
      ),
    );
    if (err instanceof PositionsTreeSyncError) {
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
