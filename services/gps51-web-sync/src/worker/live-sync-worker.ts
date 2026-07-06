import type { SupabaseClient } from "@supabase/supabase-js";
import type { Browser, Page } from "playwright";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { launchBrowser } from "../browser/create-browser.js";
import { createAuthenticatedContext, isReauthRequired } from "../auth/session.js";
import { performSafeLiveDiscoveryInteractions } from "../browser/safe-monitor-interactions.js";
import { attachLiveWebSocketListeners } from "../browser/live-websocket-listener.js";
import type { ParsedPositionLast } from "../gps51/position-last-parser.js";
import { parseEpochMilliseconds } from "../gps51/position-last-parser.js";
import {
  isDuplicatePositionId,
  validatePositionLast,
} from "../gps51/position-last-validator.js";
import { OfflineStateManager } from "../gps51/offline-state-manager.js";
import {
  buildDeviceLookup,
  buildLatestUpdateMap,
  fetchAccountByUsername,
  fetchKnownDevices,
  insertLivePosition,
  markDevicesOffline,
} from "../db/live-position-repository.js";
import { ensureInventoryAccount } from "../db/inventory-repository.js";
import {
  finishSyncRun,
  markAccountReauth,
  markAccountSynced,
  startSyncRun,
} from "../db/repositories.js";
import {
  incrementLivePositionsAccepted,
  incrementLivePositionsRejected,
  resetLiveSyncMetrics,
  setLiveAuthenticated,
  setLiveReauthRequired,
  setLiveUniqueDevicesSeen,
  incrementLiveReconnectCount,
} from "./live-sync-metrics.js";

export type LiveSyncMode = "dry" | "once" | "continuous";

export class LiveReauthRequiredError extends Error {
  constructor() {
    super("GPS51 session expired — run npm run auth again");
    this.name = "LiveReauthRequiredError";
  }
}

export type LiveDryRunStats = {
  deviceCount: number;
  validPositions: number;
  duplicates: number;
  parsingErrors: number;
  rejected: number;
  remindMsgCount: number;
  uniqueDevicesSeen: number;
};

const MAX_BACKOFF_MS = 5 * 60 * 1000;

export async function runLiveSyncWorker(
  sb: SupabaseClient | null,
  config: AppConfig,
  log: Logger,
  mode: LiveSyncMode,
): Promise<LiveDryRunStats | void> {
  resetLiveSyncMetrics();

  if (mode === "continuous") {
    let backoffMs = 5_000;
    while (true) {
      try {
        await runLiveSession(sb, config, log, mode);
        backoffMs = 5_000;
      } catch (err) {
        if (err instanceof LiveReauthRequiredError) {
          setLiveReauthRequired(true);
          throw err;
        }
        incrementLiveReconnectCount();
        log.warn({ err: err instanceof Error ? err.message : String(err), backoffMs }, "Live session failed — reconnecting");
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      }
    }
  }

  return runLiveSession(sb, config, log, mode);
}

async function runLiveSession(
  sb: SupabaseClient | null,
  config: AppConfig,
  log: Logger,
  mode: LiveSyncMode,
): Promise<LiveDryRunStats | void> {
  const durationMs =
    mode === "dry"
      ? config.GPS51_LIVE_DRY_DURATION_SECONDS * 1000
      : mode === "once"
        ? config.GPS51_LIVE_ONCE_DURATION_SECONDS * 1000
        : Number.MAX_SAFE_INTEGER;

  let accountId: string | null = null;
  let syncRunId: string | null = null;
  let knownDeviceIds = new Set<string>();
  let deviceLookup = buildDeviceLookup([]);
  let latestUpdateMap = new Map<string, number>();

  if (mode !== "dry" && sb) {
    const account = await ensureInventoryAccount(
      sb,
      config.ORGANIZATION_ID,
      config.GPS51_USERNAME,
      config.GPS51_BASE_URL,
      config.monitorUrl,
    );
    accountId = account.id;
    syncRunId = await startSyncRun(sb, config.ORGANIZATION_ID, account.id, "live");
    const devices = await fetchKnownDevices(sb, account.id);
    knownDeviceIds = new Set(devices.map((d) => d.source_device_id));
    deviceLookup = buildDeviceLookup(devices);
    latestUpdateMap = buildLatestUpdateMap(devices);
    log.info({ known_devices: knownDeviceIds.size }, "Loaded inventory devices for live validation");
  } else if (mode === "dry" && sb) {
    const account = await fetchAccountByUsername(
      sb,
      config.ORGANIZATION_ID,
      config.GPS51_USERNAME,
      config.GPS51_BASE_URL,
    );
    if (account) {
      const devices = await fetchKnownDevices(sb, account.id);
      knownDeviceIds = new Set(devices.map((d) => d.source_device_id));
      deviceLookup = buildDeviceLookup(devices);
      latestUpdateMap = buildLatestUpdateMap(devices);
    }
  }

  const offlineManager = new OfflineStateManager({
    offlineAfterSeconds: config.GPS51_OFFLINE_AFTER_SECONDS,
    warmupSeconds: config.GPS51_OFFLINE_WARMUP_SECONDS,
  });

  const stats: LiveDryRunStats = {
    deviceCount: knownDeviceIds.size,
    validPositions: 0,
    duplicates: 0,
    parsingErrors: 0,
    rejected: 0,
    remindMsgCount: 0,
    uniqueDevicesSeen: 0,
  };

  const seenPositionKeys = new Set<string>();
  const seenDevices = new Set<string>();

  let browser: Browser | null = null;
  let page: Page | null = null;
  let detachWs: (() => void) | null = null;

  try {
    browser = await launchBrowser(config, { forceHeadless: true });
    const context = await createAuthenticatedContext(config, browser);
    page = await context.newPage();

    detachWs = attachLiveWebSocketListeners(page, log, {
      onPositionLast: async (position) => {
        await handlePosition(position);
      },
      onRemindMsg: () => {
        stats.remindMsgCount += 1;
      },
      onParseError: () => {
        stats.parsingErrors += 1;
      },
    });

    await page.goto(config.monitorUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.SYNC_REQUEST_TIMEOUT_MS,
    });

    if (await isReauthRequired(page)) {
      if (sb && accountId) await markAccountReauth(sb, accountId, "reauth_required during live sync");
      throw new LiveReauthRequiredError();
    }

    setLiveAuthenticated(true);
    await performSafeLiveDiscoveryInteractions(page);

    const started = Date.now();
    while (Date.now() - started < durationMs) {
      await sleep(Math.min(5_000, durationMs - (Date.now() - started)));
      if (mode === "continuous") {
        if (page.isClosed()) throw new Error("Monitor page closed");
        if (await isReauthRequired(page)) throw new LiveReauthRequiredError();
      }

      if (mode !== "dry" && sb && accountId && !offlineManager.isWarmupActive()) {
        const staleIds = offlineManager.getStaleDeviceIds();
        if (staleIds.length > 0) {
          await markDevicesOffline(sb, accountId, staleIds);
        }
      }
    }

    stats.uniqueDevicesSeen = seenDevices.size;
    setLiveUniqueDevicesSeen(seenDevices.size);

    if (mode === "dry") {
      printDryStats(stats);
      return stats;
    }

    if (sb && syncRunId && accountId) {
      await finishSyncRun(sb, syncRunId, {
        status: "success",
        devices_visible: knownDeviceIds.size,
        positions_inserted: stats.validPositions,
        parse_failures: stats.parsingErrors + stats.rejected,
        summary: stats as unknown as Record<string, unknown>,
      });
      await markAccountSynced(sb, accountId, "success");
    }
  } finally {
    detachWs?.();
    if (page) await page.context().close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }

  async function handlePosition(position: ParsedPositionLast): Promise<void> {
    if (isDuplicatePositionId(seenPositionKeys, position)) {
      stats.duplicates += 1;
      incrementLivePositionsRejected();
      return;
    }

    const validation = validatePositionLast(position, {
      knownDeviceIds,
      latestSourceUpdatedAtMs: latestUpdateMap,
      maxFutureMs: config.GPS51_LIVE_MAX_FUTURE_MS,
    });

    if (!validation.ok) {
      stats.rejected += 1;
      incrementLivePositionsRejected();
      return;
    }

    stats.validPositions += 1;
    seenDevices.add(position.sourceDeviceId);
    setLiveUniqueDevicesSeen(seenDevices.size);

    const updatedMs = parseEpochMilliseconds(position.sourceUpdatedAt) ?? Date.now();
    offlineManager.markPosition(position.sourceDeviceId, updatedMs);
    latestUpdateMap.set(position.sourceDeviceId, updatedMs);

    if (mode === "dry" || !sb || !accountId) {
      incrementLivePositionsAccepted();
      return;
    }

    const device = deviceLookup.get(position.sourceDeviceId);
    if (!device) {
      stats.rejected += 1;
      incrementLivePositionsRejected();
      return;
    }

    const outcome = await insertLivePosition(
      sb,
      config.ORGANIZATION_ID,
      accountId,
      syncRunId,
      device,
      position,
    );

    if (outcome === "inserted") {
      incrementLivePositionsAccepted();
    } else if (outcome === "duplicate") {
      stats.duplicates += 1;
      incrementLivePositionsRejected();
    } else {
      stats.rejected += 1;
      incrementLivePositionsRejected();
    }
  }
}

function printDryStats(stats: LiveDryRunStats): void {
  console.log("\n--- GPS51 Live WebSocket Dry Run ---");
  console.log(`Inventory devices: ${stats.deviceCount}`);
  console.log(`Valid positions parsed: ${stats.validPositions}`);
  console.log(`Duplicates rejected: ${stats.duplicates}`);
  console.log(`Validation rejected: ${stats.rejected}`);
  console.log(`Parsing errors: ${stats.parsingErrors}`);
  console.log(`remindMsg frames: ${stats.remindMsgCount}`);
  console.log(`Unique devices seen: ${stats.uniqueDevicesSeen}`);
  console.log("Zero Supabase writes performed.");
  console.log("------------------------------------\n");
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
