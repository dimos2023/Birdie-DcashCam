import { writeFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { ensureAuthenticatedPage } from "../auth/session.js";
import {
  discoverCacheComponentsOnPage,
  extractOnlineDeviceIdsOnPage,
  parseCacheRecord,
  readCachePositionsOnPage,
  selectDeviceAndWaitForCacheOnPage,
} from "../gps51/position-cache-browser.js";
import {
  isDuplicateCachePosition,
  isStaleCachePosition,
  positionTimestampMs,
} from "../gps51/position-cache-fingerprint.js";
import { prioritizeCacheSyncDevices } from "../gps51/position-cache-prioritize.js";
import { validateCachePositionCoordinates } from "../gps51/position-cache-validator.js";
import type { ParsedPositionLast } from "../gps51/position-last-parser.js";
import { ensureInventoryAccount } from "../db/inventory-repository.js";
import {
  buildDeviceLookup,
  buildLatestUpdateMap,
  fetchKnownDevices,
  insertCachePosition,
} from "../db/live-position-repository.js";
import {
  finishSyncRun,
  markAccountSynced,
  startSyncRun,
} from "../db/repositories.js";
import {
  collectInventorySourceFromPayload,
  loadInventorySourceFromQueryDeviceTree,
  type InventorySource,
} from "./status-tree-sync.js";
import { getOrCreateDedicatedStatusPage } from "./status-dom-sync.js";

export const POSITION_CACHE_SYNC_SUMMARY_FILE = "position-cache-sync-summary.json";

export type PositionCacheSyncMode = "dry" | "sync";

export class PositionCacheSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositionCacheSyncError";
  }
}

export type PositionCacheSyncStats = {
  inventoryCount: number;
  devicesAttempted: number;
  cacheHitsBeforeSelection: number;
  positionsReceivedAfterSelection: number;
  validPositions: number;
  invalidPositions: number;
  missingPositions: number;
  duplicatePositions: number;
  onlineDevicesWithPosition: number;
  offlineDevicesWithPosition: number;
  databaseWrites: number;
  validated: boolean;
  validationReasons: string[];
};

export function buildPositionCacheSyncSummary(
  stats: PositionCacheSyncStats & { generatedAt?: string },
): Record<string, unknown> {
  return {
    status: stats.validated ? "success" : "failed",
    ...stats,
    generatedAt: stats.generatedAt ?? new Date().toISOString(),
  };
}

function writePositionCacheArtifacts(captureDir: string, summary: Record<string, unknown>): void {
  writeFileSync(
    path.join(captureDir, POSITION_CACHE_SYNC_SUMMARY_FILE),
    JSON.stringify(summary, null, 2),
  );
}

export function printPositionCacheSyncReport(summary: Record<string, unknown>): void {
  console.log("\n--- GPS51 Map Cache Position Sync ---");
  console.log(`Inventory: ${summary.inventoryCount}`);
  console.log(`Devices attempted: ${summary.devicesAttempted}`);
  console.log(`Cache hits (before selection): ${summary.cacheHitsBeforeSelection}`);
  console.log(`Positions after selection: ${summary.positionsReceivedAfterSelection}`);
  console.log(`Valid positions: ${summary.validPositions}`);
  console.log(`Invalid positions: ${summary.invalidPositions}`);
  console.log(`Missing positions: ${summary.missingPositions}`);
  console.log(`Duplicates: ${summary.duplicatePositions}`);
  console.log(`Online with position: ${summary.onlineDevicesWithPosition}`);
  console.log(`Offline with position: ${summary.offlineDevicesWithPosition}`);
  console.log(`Database writes: ${summary.databaseWrites}`);
  console.log(`Validated: ${summary.validated}`);
  if (!summary.validated) {
    console.log(`Validation reasons: ${(summary.validationReasons as string[]).join(", ")}`);
  }
  console.log("-------------------------------------\n");
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ProcessedPosition = {
  deviceId: string;
  position: ParsedPositionLast;
  fromCacheHit: boolean;
  fromSelection: boolean;
};

async function collectPositionsFromPage(
  page: Page,
  inventorySet: Set<string>,
  onlineIds: Set<string>,
  latestPositionMs: Map<string, number>,
  config: AppConfig,
  log: Logger,
  onCurrentDevice?: (deviceId: string | null) => void,
): Promise<{
  processed: ProcessedPosition[];
  cacheHitsBeforeSelection: number;
  positionsReceivedAfterSelection: number;
  devicesAttempted: number;
}> {
  const initialCache = await readCachePositionsOnPage(page, inventorySet);
  const cacheHitIds = new Set(initialCache.keys());
  const processed: ProcessedPosition[] = [];
  let positionsReceivedAfterSelection = 0;

  const queue = prioritizeCacheSyncDevices({
    inventoryIds: [...inventorySet],
    onlineIds,
    latestPositionMsByDevice: latestPositionMs,
    cacheHitIds,
    staleSeconds: config.GPS51_POSITION_STALE_SECONDS,
    maxDevices: config.GPS51_POSITION_MAX_DEVICES_PER_CYCLE,
  });

  for (const deviceId of queue) {
    onCurrentDevice?.(deviceId);
    let record = initialCache.get(deviceId) ?? null;
    let fromCacheHit = record != null;
    let fromSelection = false;

    if (!record) {
      const selection = await selectDeviceAndWaitForCacheOnPage(
        page,
        deviceId,
        config.GPS51_POSITION_WAIT_TIMEOUT_MS,
      );
      if (selection.found && selection.record) {
        record = selection.record;
        fromSelection = true;
        positionsReceivedAfterSelection += 1;
      }
      await sleep(config.GPS51_POSITION_SELECTION_DELAY_MS);
    }

    if (!record) continue;

    const position = parseCacheRecord(deviceId, record);
    if (!position) continue;

    processed.push({
      deviceId,
      position,
      fromCacheHit,
      fromSelection,
    });
  }

  onCurrentDevice?.(null);

  log.info(
    {
      cacheHits: cacheHitIds.size,
      queueSize: queue.length,
      processed: processed.length,
      selections: positionsReceivedAfterSelection,
    },
    "Map cache position collection complete",
  );

  return {
    processed,
    cacheHitsBeforeSelection: cacheHitIds.size,
    positionsReceivedAfterSelection,
    devicesAttempted: queue.length,
  };
}

export async function runPositionCacheSync(
  sb: SupabaseClient | null,
  config: AppConfig,
  log: Logger,
  mode: PositionCacheSyncMode,
  page?: Page,
  inventoryIds?: Set<string>,
  options?: {
    context?: BrowserContext;
    onCurrentDevice?: (deviceId: string | null) => void;
  },
): Promise<PositionCacheSyncStats> {
  if (!config.GPS51_POSITION_CACHE_ENABLED) {
    const stats: PositionCacheSyncStats = {
      inventoryCount: inventoryIds?.size ?? 0,
      devicesAttempted: 0,
      cacheHitsBeforeSelection: 0,
      positionsReceivedAfterSelection: 0,
      validPositions: 0,
      invalidPositions: 0,
      missingPositions: inventoryIds?.size ?? 0,
      duplicatePositions: 0,
      onlineDevicesWithPosition: 0,
      offlineDevicesWithPosition: 0,
      databaseWrites: 0,
      validated: false,
      validationReasons: ["position_cache_disabled"],
    };
    writePositionCacheArtifacts(config.captureDir, buildPositionCacheSyncSummary(stats));
    return stats;
  }

  let ownsSession = false;
  let cleanup: (() => Promise<void>) | null = null;
  let activePage = page ?? null;
  let inventory = inventoryIds ? [...inventoryIds] : [];
  const validationReasons: string[] = [];

  const emptyStats = (): PositionCacheSyncStats => ({
    inventoryCount: inventory.length,
    devicesAttempted: 0,
    cacheHitsBeforeSelection: 0,
    positionsReceivedAfterSelection: 0,
    validPositions: 0,
    invalidPositions: 0,
    missingPositions: inventory.length,
    duplicatePositions: 0,
    onlineDevicesWithPosition: 0,
    offlineDevicesWithPosition: 0,
    databaseWrites: 0,
    validated: false,
    validationReasons,
  });

  try {
    if (!activePage) {
      if (options?.context) {
        activePage = await getOrCreateDedicatedStatusPage(options.context, config);
      } else {
        const session = await ensureAuthenticatedPage(config, log, {
          forceHeadless: mode === "sync",
        });
        cleanup = session.cleanup;
        activePage = session.page;
        ownsSession = true;
      }
    }

    if (inventory.length === 0) {
      const source = await loadInventorySourceFromQueryDeviceTree(activePage, config);
      inventory = source.deviceIds;
      if (source.duplicateIds.length > 0) {
        throw new PositionCacheSyncError(
          `Duplicate inventory device IDs found in querydevicestree: ${source.duplicateIds.length}`,
        );
      }
    }

    const inventorySet = new Set(inventory);
    const discovery = await discoverCacheComponentsOnPage(activePage);
    if (!discovery.cacheMgrFound) {
      validationReasons.push("cache_mgr_not_found");
    }
    if (!discovery.deviceListPath) {
      validationReasons.push("device_list_not_found");
    }

    const onlineIds = await extractOnlineDeviceIdsOnPage(activePage);
    let latestPositionMs = new Map<string, number>();
    let deviceLookup = new Map<string, Awaited<ReturnType<typeof fetchKnownDevices>>[number]>();
    let organizationId = config.ORGANIZATION_ID;

    if (sb) {
      const account = await ensureInventoryAccount(
        sb,
        config.ORGANIZATION_ID,
        config.GPS51_USERNAME,
        config.GPS51_BASE_URL,
        config.monitorUrl,
      );
      const devices = await fetchKnownDevices(sb, account.id);
      deviceLookup = buildDeviceLookup(devices);
      latestPositionMs = buildLatestUpdateMap(devices);
    }

    const collection = await collectPositionsFromPage(
      activePage,
      inventorySet,
      onlineIds,
      latestPositionMs,
      config,
      log,
      options?.onCurrentDevice,
    );

    const seenKeys = new Set<string>();
    let validPositions = 0;
    let invalidPositions = 0;
    let duplicatePositions = 0;
    let databaseWrites = 0;
    let onlineDevicesWithPosition = 0;
    let offlineDevicesWithPosition = 0;
    const validByDevice = new Set<string>();
    const positionsToWrite: ProcessedPosition[] = [];

    for (const item of collection.processed) {
      const validation = validateCachePositionCoordinates(item.position, inventorySet);
      if (!validation.ok) {
        invalidPositions += 1;
        continue;
      }

      if (onlineIds.has(item.deviceId)) onlineDevicesWithPosition += 1;
      else offlineDevicesWithPosition += 1;

      if (isDuplicateCachePosition(seenKeys, organizationId, item.deviceId, item.position)) {
        duplicatePositions += 1;
        continue;
      }

      const storedLatest = latestPositionMs.get(item.deviceId);
      if (isStaleCachePosition(item.position, storedLatest)) {
        duplicatePositions += 1;
        continue;
      }

      validPositions += 1;
      validByDevice.add(item.deviceId);
      positionsToWrite.push(item);
    }

    if (mode === "sync" && sb && positionsToWrite.length > 0) {
      const account = await ensureInventoryAccount(
        sb,
        config.ORGANIZATION_ID,
        config.GPS51_USERNAME,
        config.GPS51_BASE_URL,
        config.monitorUrl,
      );
      const syncRunId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "position_cache");

      for (const item of positionsToWrite) {
        const device = deviceLookup.get(item.deviceId);
        if (!device) continue;

        const outcome = await insertCachePosition(
          sb,
          config.ORGANIZATION_ID,
          account.id,
          syncRunId,
          device,
          item.position,
        );

        if (outcome === "inserted") {
          databaseWrites += 1;
          latestPositionMs.set(item.deviceId, positionTimestampMs(item.position));
        } else if (outcome === "duplicate") {
          duplicatePositions += 1;
        }
      }

      await finishSyncRun(sb, syncRunId, {
        status: "success",
        positions_inserted: databaseWrites,
        summary: {
          valid: validPositions,
          duplicates: duplicatePositions,
          invalid: invalidPositions,
        },
      });
      await markAccountSynced(sb, account.id, "success");
    }

    const missingPositions = inventorySet.size - validByDevice.size;
    const validated =
      validationReasons.length === 0 &&
      (validPositions > 0 || collection.cacheHitsBeforeSelection > 0);

    if (validPositions === 0 && collection.cacheHitsBeforeSelection === 0) {
      validationReasons.push("no_valid_cache_positions");
    }

    const stats: PositionCacheSyncStats = {
      inventoryCount: inventorySet.size,
      devicesAttempted: collection.devicesAttempted,
      cacheHitsBeforeSelection: collection.cacheHitsBeforeSelection,
      positionsReceivedAfterSelection: collection.positionsReceivedAfterSelection,
      validPositions,
      invalidPositions,
      missingPositions,
      duplicatePositions,
      onlineDevicesWithPosition,
      offlineDevicesWithPosition,
      databaseWrites: mode === "dry" ? 0 : databaseWrites,
      validated,
      validationReasons,
    };

    writePositionCacheArtifacts(config.captureDir, buildPositionCacheSyncSummary(stats));
    printPositionCacheSyncReport(buildPositionCacheSyncSummary(stats));

    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stats = emptyStats();
    stats.validationReasons.push(message);
    writePositionCacheArtifacts(config.captureDir, buildPositionCacheSyncSummary(stats));
    if (error instanceof PositionCacheSyncError) throw error;
    throw new PositionCacheSyncError(message);
  } finally {
    if (ownsSession && cleanup) {
      await cleanup().catch(() => undefined);
    }
  }
}

export { collectInventorySourceFromPayload };
