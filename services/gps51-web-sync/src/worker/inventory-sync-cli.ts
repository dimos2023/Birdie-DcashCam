import { loadConfig, validateWorkerConfig, ensureCaptureDir, resetConfigCache } from "../config.js";
import { runInventorySync, ReauthRequiredError } from "./inventory-sync.js";
import type { InventorySyncMode } from "./inventory-sync.js";
import {
  finishSyncRun,
  markAccountReauth,
  startSyncRun,
} from "../db/repositories.js";
import { getDbClient } from "../db/client.js";
import { ensureInventoryAccount } from "../db/inventory-repository.js";

const isMain = process.argv[1]?.includes("inventory-sync-cli");

function resolveMode(): InventorySyncMode {
  const arg = process.argv[2]?.toLowerCase();
  if (arg === "dry" || arg === "sync" || arg === "reconcile") return arg;
  throw new Error("Usage: inventory-sync-cli.ts <dry|sync|reconcile>");
}

async function recordReauthFailure(config: ReturnType<typeof loadConfig>, message: string) {
  try {
    const sb = getDbClient(config);
    const account = await ensureInventoryAccount(
      sb,
      config.ORGANIZATION_ID,
      config.GPS51_USERNAME,
      config.GPS51_BASE_URL,
      config.monitorUrl,
    );
    const runId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "one_shot");
    await finishSyncRun(sb, runId, {
      status: "reauth_required",
      error_message: message,
    });
    await markAccountReauth(sb, account.id, message);
  } catch {
    // Best effort only — never log credentials.
  }
}

export async function main(): Promise<void> {
  resetConfigCache();
  const mode = resolveMode();
  const config = loadConfig(process.env);

  if (mode === "dry") {
    if (!config.ORGANIZATION_ID) {
      throw new Error("ORGANIZATION_ID is required");
    }
    const { existsSync } = await import("node:fs");
    if (!existsSync(config.storageStatePath)) {
      throw new Error(
        `GPS51 storage state missing at ${config.storageStatePath}. Run npm run auth first.`,
      );
    }
  } else {
    validateWorkerConfig(config);
  }

  ensureCaptureDir(config);
  await runInventorySync(mode, config);
}

if (isMain) {
  main()
    .then(() => process.exit(0))
    .catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);

      if (err instanceof ReauthRequiredError) {
        try {
          resetConfigCache();
          const config = loadConfig(process.env);
          if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
            await recordReauthFailure(config, message);
          }
        } catch {
          // ignore secondary failures
        }
        process.exit(2);
      }

      process.exit(1);
    });
}
