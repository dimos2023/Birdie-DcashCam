import type { BrowserContext, Page } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { isReauthRequired } from "../auth/session.js";
import { getOrCreateDedicatedStatusPage } from "./status-dom-sync.js";
import { extractTreeStatusOnPage, writeValidatedTreeStatus } from "./status-tree-sync.js";
import { loadInventoryIdsForRefresh } from "./status-refresh-inventory.js";
import {
  incrementStatusRefreshErrors,
  setStatusChangedDeviceCount,
  setStatusPortalCounts,
  setStatusRefreshCounts,
  setStatusRefreshSuccess,
  setStatusValidationErrors,
} from "./live-sync-metrics.js";

export type StatusRefreshResult = {
  refreshed: boolean;
  updated: number;
  changedDeviceCount: number;
  deviceCount: number;
  online: number;
  offline: number;
  unknown: number;
  reason?: string;
};

export async function refreshTreeStatusesFromDedicatedPage(
  context: BrowserContext,
  sb: SupabaseClient,
  accountId: string,
  config: AppConfig,
  log: Logger,
  statusPageRef: { page: Page | null },
  inventoryIds: Set<string>,
): Promise<StatusRefreshResult> {
  try {
    if (!statusPageRef.page || statusPageRef.page.isClosed()) {
      statusPageRef.page = await getOrCreateDedicatedStatusPage(context, config);
    }

    const statusPage = statusPageRef.page;
    if (await isReauthRequired(statusPage)) {
      incrementStatusRefreshErrors();
      setStatusRefreshSuccess(false);
      setStatusValidationErrors(["reauth_required"]);
      return {
        refreshed: false,
        updated: 0,
        changedDeviceCount: 0,
        deviceCount: inventoryIds.size,
        online: 0,
        offline: 0,
        unknown: 0,
        reason: "reauth_required",
      };
    }

    const extraction = await extractTreeStatusOnPage(statusPage, inventoryIds, config);
    const { portalCounts, reconciliation } = extraction;

    setStatusPortalCounts(
      portalCounts.all,
      portalCounts.online,
      portalCounts.offline,
      reconciliation.extractedCounts.all,
      reconciliation.extractedCounts.online,
      reconciliation.extractedCounts.offline,
    );

    if (!reconciliation.validated) {
      incrementStatusRefreshErrors();
      setStatusRefreshSuccess(false);
      setStatusValidationErrors(reconciliation.validationReasons);
      setStatusChangedDeviceCount(0);
      log.warn(
        { reasons: reconciliation.validationReasons },
        "Tree status refresh skipped — validation failed",
      );
      return {
        refreshed: false,
        updated: 0,
        changedDeviceCount: 0,
        deviceCount: inventoryIds.size,
        online: reconciliation.extractedCounts.online,
        offline: reconciliation.extractedCounts.offline,
        unknown: 0,
        reason: reconciliation.validationReasons.join(","),
      };
    }

    const writeResult = await writeValidatedTreeStatus(
      sb,
      config,
      log,
      {
        deviceIds: [...inventoryIds],
        source: "database",
        duplicateIds: [],
      },
      extraction,
    );

    setStatusRefreshSuccess(true);
    setStatusRefreshCounts(
      reconciliation.extractedCounts.online,
      reconciliation.extractedCounts.offline,
      0,
    );
    setStatusValidationErrors([]);
    setStatusChangedDeviceCount(writeResult.changedDeviceCount);

    log.info(
      {
        updated: writeResult.databaseWrites,
        changed: writeResult.changedDeviceCount,
        online: reconciliation.extractedCounts.online,
        offline: reconciliation.extractedCounts.offline,
      },
      "Tree status refresh complete",
    );

    return {
      refreshed: true,
      updated: writeResult.databaseWrites,
      changedDeviceCount: writeResult.changedDeviceCount,
      deviceCount: inventoryIds.size,
      online: reconciliation.extractedCounts.online,
      offline: reconciliation.extractedCounts.offline,
      unknown: 0,
    };
  } catch (err) {
    incrementStatusRefreshErrors();
    setStatusRefreshSuccess(false);
    setStatusValidationErrors([err instanceof Error ? err.message : String(err)]);
    setStatusChangedDeviceCount(0);
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "Tree status refresh failed");
    return {
      refreshed: false,
      updated: 0,
      changedDeviceCount: 0,
      deviceCount: inventoryIds.size,
      online: 0,
      offline: 0,
      unknown: 0,
      reason: "refresh_error",
    };
  }
}

export { loadInventoryIdsForRefresh } from "./status-refresh-inventory.js";
