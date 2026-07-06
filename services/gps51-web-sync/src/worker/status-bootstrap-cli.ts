import { loadConfig, validateWorkerConfig, ensureCaptureDir, resetConfigCache } from "../config.js";
import { createLogger } from "../logger.js";
import { getDbClient } from "../db/client.js";
import { runStatusBootstrap, StatusBootstrapError } from "./status-bootstrap.js";

const isMain = process.argv[1]?.includes("status-bootstrap-cli");

function resolveMode(): "dry" | "sync" {
  const arg = process.argv[2]?.toLowerCase();
  if (arg === "dry") return "dry";
  if (arg === "sync" || arg === "bootstrap") return "sync";
  throw new Error("Usage: status-bootstrap-cli.ts <dry|sync>");
}

export async function main(): Promise<void> {
  resetConfigCache();
  const mode = resolveMode();
  const config = loadConfig(process.env);
  validateWorkerConfig(config);
  ensureCaptureDir(config);
  const log = createLogger(config);

  const sb = mode === "sync" ? getDbClient(config) : null;

  try {
    await runStatusBootstrap(sb, config, log, mode);
  } catch (err) {
    if (err instanceof StatusBootstrapError) {
      console.error(err.message);
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
