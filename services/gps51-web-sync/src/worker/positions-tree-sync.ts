import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { assertBrowserScriptSafe } from "../browser/browser-page-scripts.js";
import {
  buildPositionExtractAllScript,
  normalizePositionInventoryExtraction,
  type PositionInventoryExtraction,
} from "../gps51/position-source-extract.js";
import {
  isDuplicatePositionId,
  validatePositionLast,
} from "../gps51/position-last-validator.js";
import { ensureInventoryAccount } from "../db/inventory-repository.js";
import {
  buildDeviceLookup,
  buildLatestUpdateMap,
  fetchKnownDevices,
  insertTreePosition,
} from "../db/live-position-repository.js";
import {
  finishSyncRun,
  markAccountSynced,
  startSyncRun,
} from "../db/repositories.js";
import {
  loadInventorySourceFromQueryDeviceTree,
  type InventorySource,
} from "./status-tree-sync.js";

export const POSITIONS_TREE_SYNC_SUMMARY_FILE = "positions-tree-sync-summary.json";

export type PositionsTreeSyncMode = "dry" | "sync";

export class PositionsTreeSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositionsTreeSyncError";
  }
}

export async function extractPositionsOnPage(
  page: Page,
  inventoryIds: Set<string>,
): Promise<PositionInventoryExtraction> {
  const script = buildPositionExtractAllScript([...inventoryIds]);
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => null);
  return normalizePositionInventoryExtraction(raw, inventoryIds);
}

export function buildPositionsTreeSyncSummary(input: {
  status: "success" | "failed";
  mode: PositionsTreeSyncMode;
  inventoryCount: number;
  inventorySource: InventorySource["source"] | null;
  extraction: PositionInventoryExtraction | null;
  databaseWrites: number;
  duplicates: number;
  rejected: number;
  errorMessage?: string | null;
}): Record<string, unknown> {
  const extraction = input.extraction;
  return {
    status: input.status,
    mode: input.mode,
    inventoryCount: input.inventoryCount,
    inventorySource: input.inventorySource,
    positionSource: extraction?.source ?? null,
    positionFieldPath: extraction?.fieldPath ?? null,
    componentPath: extraction?.componentPath ?? null,
    validCoordinateCount: extraction?.validDeviceIds.length ?? 0,
    invalidCoordinateCount: extraction?.invalidDeviceIds.length ?? 0,
    missingCoordinateCount: extraction?.missingDeviceIds.length ?? 0,
    databaseWrites: input.databaseWrites,
    duplicates: input.duplicates,
    rejected: input.rejected,
    extractionError: extraction?.error ?? null,
    errorMessage: input.errorMessage ?? null,
    generatedAt: new Date().toISOString(),
  };
}

function writePositionsTreeArtifacts(captureDir: string, summary: Record<string, unknown>): void {
  writeFileSync(
    path.join(captureDir, POSITIONS_TREE_SYNC_SUMMARY_FILE),
    JSON.stringify(summary, null, 2),
  );
}

export function printPositionsTreeSyncReport(summary: Record<string, unknown>): void {
  console.log("\n--- GPS51 Tree Positions Sync ---");
  console.log(`Inventory: ${summary.inventoryCount}`);
  console.log(`Valid coordinates: ${summary.validCoordinateCount}`);
  console.log(`Invalid coordinates: ${summary.invalidCoordinateCount}`);
  console.log(`Missing coordinates: ${summary.missingCoordinateCount}`);
  console.log(`Position source: ${summary.positionSource ?? "—"}`);
  console.log(`Database writes: ${summary.databaseWrites}`);
  console.log(`Duplicates: ${summary.duplicates}`);
  console.log(`Rejected: ${summary.rejected}`);
  console.log("---------------------------------\n");
}

export async function writeValidatedTreePositions(
  sb: SupabaseClient,
  config: AppConfig,
  log: Logger,
  inventory: InventorySource,
  extraction: PositionInventoryExtraction,
): Promise<{ databaseWrites: number; duplicates: number; rejected: number }> {
  const account = await ensureInventoryAccount(
    sb,
    config.ORGANIZATION_ID,
    config.GPS51_USERNAME,
    config.GPS51_BASE_URL,
    config.monitorUrl,
  );
  const syncRunId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "positions_tree");
  const devices = await fetchKnownDevices(sb, account.id);
  const deviceLookup = buildDeviceLookup(devices);
  const latestMap = buildLatestUpdateMap(devices);
  const knownIds = new Set(devices.map((device) => device.source_device_id));
  const seenKeys = new Set<string>();

  let databaseWrites = 0;
  let duplicates = 0;
  let rejected = 0;
  const fieldPath = extraction.fieldPath ?? "cacheMgr.lastPositions[deviceId]";

  for (const position of extraction.positions) {
    const device = deviceLookup.get(position.sourceDeviceId);
    if (!device) {
      rejected += 1;
      continue;
    }

    const validation = validatePositionLast(position, {
      knownDeviceIds: knownIds,
      latestSourceUpdatedAtMs: latestMap,
    });
    if (!validation.ok) {
      rejected += 1;
      continue;
    }
    if (isDuplicatePositionId(seenKeys, position)) {
      duplicates += 1;
      continue;
    }

    const result = await insertTreePosition(
      sb,
      config.ORGANIZATION_ID,
      account.id,
      syncRunId,
      device,
      position,
      fieldPath,
    );
    if (result === "inserted") {
      databaseWrites += 1;
      latestMap.set(position.sourceDeviceId, Date.parse(position.sourceUpdatedAt));
    } else if (result === "duplicate") {
      duplicates += 1;
    } else {
      rejected += 1;
    }
  }

  await finishSyncRun(sb, syncRunId, {
    status: "success",
    devices_visible: inventory.deviceIds.length,
    positions_inserted: databaseWrites,
    parse_failures: rejected,
    summary: {
      valid: extraction.validDeviceIds.length,
      invalid: extraction.invalidDeviceIds.length,
      missing: extraction.missingDeviceIds.length,
      duplicates,
      rejected,
      positionSource: extraction.source,
      fieldPath: extraction.fieldPath,
    },
  });
  await markAccountSynced(sb, account.id, "success");

  log.info(
    {
      databaseWrites,
      duplicates,
      rejected,
      valid: extraction.validDeviceIds.length,
      positionSource: extraction.source,
    },
    "Tree positions sync complete",
  );

  return { databaseWrites, duplicates, rejected };
}

export async function runPositionsTreeSync(
  sb: SupabaseClient | null,
  config: AppConfig,
  log: Logger,
  mode: PositionsTreeSyncMode,
  page?: Page,
  inventoryIds?: Set<string>,
): Promise<{
  validated: boolean;
  databaseWrites: number;
  validCoordinateCount: number;
}> {
  let ownsSession = false;
  let cleanup: (() => Promise<void>) | null = null;
  let activePage = page ?? null;
  let inventory = inventoryIds ? [...inventoryIds] : [];
  let inventorySource: InventorySource["source"] | null = inventoryIds ? "database" : null;
  let lastSummary = buildPositionsTreeSyncSummary({
    status: "failed",
    mode,
    inventoryCount: inventory.length,
    inventorySource,
    extraction: null,
    databaseWrites: 0,
    duplicates: 0,
    rejected: 0,
    errorMessage: null,
  });

  try {
    if (!activePage) {
      const session = await ensureAuthenticatedPage(config, log, { forceHeadless: mode === "sync" });
      cleanup = session.cleanup;
      activePage = session.page;
      ownsSession = true;
    }

    if (inventory.length === 0) {
      const source = await loadInventorySourceFromQueryDeviceTree(activePage, config);
      inventory = source.deviceIds;
      inventorySource = source.source;
      if (source.duplicateIds.length > 0) {
        throw new PositionsTreeSyncError(
          `Duplicate inventory device IDs found in querydevicestree: ${source.duplicateIds.length}`,
        );
      }
    }

    const inventorySet = new Set(inventory);
    if (inventorySet.size !== inventory.length) {
      throw new PositionsTreeSyncError(
        `Duplicate inventory device IDs found after normalization: ${inventory.length - inventorySet.size}`,
      );
    }

    const extraction = await extractPositionsOnPage(activePage, inventorySet);
    const validated = extraction.positions.length > 0 && extraction.source != null;

    lastSummary = buildPositionsTreeSyncSummary({
      status: validated ? "success" : "failed",
      mode,
      inventoryCount: inventorySet.size,
      inventorySource,
      extraction,
      databaseWrites: 0,
      duplicates: 0,
      rejected: 0,
    });
    writePositionsTreeArtifacts(config.captureDir, lastSummary);

    if (!validated) {
      printPositionsTreeSyncReport(lastSummary);
      if (mode === "sync") {
        throw new PositionsTreeSyncError(
          extraction.error ?? "No validated positions extracted from cacheMgr.lastPositions",
        );
      }
      return { validated: false, databaseWrites: 0, validCoordinateCount: 0 };
    }

    if (mode === "dry" || !sb) {
      printPositionsTreeSyncReport(lastSummary);
      return {
        validated: true,
        databaseWrites: 0,
        validCoordinateCount: extraction.validDeviceIds.length,
      };
    }

    const writeResult = await writeValidatedTreePositions(
      sb,
      config,
      log,
      {
        deviceIds: inventory,
        source: inventorySource ?? "querydevicestree",
        duplicateIds: [],
      },
      extraction,
    );

    lastSummary = buildPositionsTreeSyncSummary({
      status: "success",
      mode,
      inventoryCount: inventorySet.size,
      inventorySource,
      extraction,
      databaseWrites: writeResult.databaseWrites,
      duplicates: writeResult.duplicates,
      rejected: writeResult.rejected,
    });
    writePositionsTreeArtifacts(config.captureDir, lastSummary);
    printPositionsTreeSyncReport(lastSummary);

    return {
      validated: true,
      databaseWrites: writeResult.databaseWrites,
      validCoordinateCount: extraction.validDeviceIds.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastSummary = buildPositionsTreeSyncSummary({
      status: "failed",
      mode,
      inventoryCount: inventory.length,
      inventorySource,
      extraction: null,
      databaseWrites: 0,
      duplicates: 0,
      rejected: 0,
      errorMessage: message,
    });
    writePositionsTreeArtifacts(config.captureDir, lastSummary);
    if (error instanceof PositionsTreeSyncError) throw error;
    throw new PositionsTreeSyncError(message);
  } finally {
    if (ownsSession && cleanup) {
      await cleanup().catch(() => undefined);
    }
  }
}
