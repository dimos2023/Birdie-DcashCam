import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { loadConfig, validateWorkerConfig, ensureCaptureDir, resetConfigCache } from "../config.js";
import { createLogger } from "../logger.js";
import { ensureAuthenticatedPage } from "../auth/session.js";
import { NetworkCapture, waitForDiscoverySignals } from "./network-capture.js";
import { readPortalStatusCounts } from "./monitor-subscription.js";
import { collectBootstrapDeviceRecords } from "../gps51/status-bootstrap-parser.js";
import {
  discoverStatusFilterFieldCandidates,
  pickBestStatusFilterFieldCandidate,
} from "../gps51/status-filter-field-profiler.js";
import {
  buildFilteredCollectionCandidate,
  categorizeStatusFilterFailure,
  recommendStatusFilterSource,
  validateStatusFilterDiscovery,
  type FilteredCollectionCandidate,
} from "../gps51/status-filter-reconciliation.js";
import {
  buildStatusFilterProbeScript,
  compareStateSnapshots,
  isFrameworkStatePath,
  normalizeBrowserFilterProbe,
  type ChangedStatePath,
  type FunctionSourceRecord,
  type VueComponentRecord,
} from "../gps51/status-filter-vue.js";
import {
  clickStatusTabSafely,
  waitForLoadingToSettle,
  waitForStablePortalCount,
} from "./status-dom-tabs.js";
import type { ModelPortalCounts } from "../gps51/status-model-reconciliation.js";
import { STATUS_TAB_FALLBACKS } from "./monitor-dom-safety.js";
import {
  buildStatusFilterExtractScript,
  isExcludedStatusFilterFunction,
  normalizeStatusFilterExtraction,
} from "../gps51/status-filter-extract.js";
import { collectBundleMatches, pickBestBundleMatch } from "./status-filter-bundles.js";
import { assertBrowserScriptSafe } from "./browser-page-scripts.js";

export const STATUS_FILTER_SUMMARY_FILE = "status-filter-summary.json";
export const STATUS_FILTER_COMPONENT_STATE_FILE = "status-filter-component-state.json";
export const STATUS_FILTER_FUNCTIONS_FILE = "status-filter-functions.json";
export const STATUS_FILTER_FIELD_CANDIDATES_FILE = "status-filter-field-candidates.json";
export const STATUS_FILTER_BUNDLE_MATCHES_FILE = "status-filter-bundle-matches.json";
export const STATUS_FILTER_ONLINE_IDS_FILE = "status-filter-online-ids.json";
export const STATUS_FILTER_OFFLINE_IDS_FILE = "status-filter-offline-ids.json";
export const STATUS_FILTER_BUNDLES_DIR = "status-filter-bundles";

const isMain = process.argv[1]?.includes("status-filter-discovery");

const PREFERRED_CONNECTIVITY_FUNCTIONS = [
  "setCurrentZtree",
  "updateAllState",
  "tablesClickRowDevice",
  "updateAllTreeAndDeviceState",
  "refreshMapUI",
];

async function extractStatusFilterIds(page: Page, inventoryIds: Set<string>) {
  const script = buildStatusFilterExtractScript();
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => null);
  const extraction = normalizeStatusFilterExtraction(raw);
  const filterToInventory = (ids: string[]) => ids.filter((id) => inventoryIds.has(id));

  return {
    ...extraction,
    allDeviceIds: filterToInventory(extraction.allDeviceIds),
    onlineDeviceIds: filterToInventory(extraction.onlineDeviceIds),
    offlineDeviceIds: filterToInventory(extraction.offlineDeviceIds),
    counts: {
      all: filterToInventory(extraction.allDeviceIds).length,
      online: filterToInventory(extraction.onlineDeviceIds).length,
      offline: filterToInventory(extraction.offlineDeviceIds).length,
    },
  };
}

type TabFilterCapture = {
  tab: "all" | "online" | "offline";
  portalCountBefore: number | null;
  portalCountAfter: number | null;
  rowSignature: string;
  changedStatePaths: ChangedStatePath[];
  collectionCandidates: FilteredCollectionCandidate[];
};

async function readPortalSnapshot(page: Page): Promise<ModelPortalCounts> {
  const before = await readPortalStatusCounts(page).catch(() => ({
    all: null,
    online: null,
    offline: null,
  }));
  await page.waitForTimeout(600);
  const after = await readPortalStatusCounts(page).catch(() => before);
  return {
    all: after.all ?? before.all,
    online: after.online ?? before.online,
    offline: after.offline ?? before.offline,
    allBefore: before.all,
    allAfter: after.all,
    onlineBefore: before.online,
    onlineAfter: after.online,
    offlineBefore: before.offline,
    offlineAfter: after.offline,
  };
}

async function probeFilterState(
  page: Page,
  inventoryIds: Set<string>,
): Promise<ReturnType<typeof normalizeBrowserFilterProbe>> {
  const tabLabels = [
    ...STATUS_TAB_FALLBACKS.all,
    ...STATUS_TAB_FALLBACKS.online,
    ...STATUS_TAB_FALLBACKS.offline,
  ];
  const script = buildStatusFilterProbeScript([...inventoryIds].slice(0, 605), tabLabels);
  assertBrowserScriptSafe(script);
  const raw = await page.evaluate(script).catch(() => null);
  return normalizeBrowserFilterProbe(raw);
}

async function waitForRowSignatureChange(
  page: Page,
  inventoryIds: Set<string>,
  previousSignature: string,
  timeoutMs = 8000,
): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const probe = await probeFilterState(page, inventoryIds);
    if (probe.rowSignature && probe.rowSignature !== previousSignature) {
      return probe.rowSignature;
    }
    await page.waitForTimeout(400);
  }
  const finalProbe = await probeFilterState(page, inventoryIds);
  return finalProbe.rowSignature;
}

function buildCollectionCandidates(
  tab: "all" | "online" | "offline",
  probe: ReturnType<typeof normalizeBrowserFilterProbe>,
  inventoryIds: Set<string>,
  portalCount: number | null,
  previousSignatures: string[],
): FilteredCollectionCandidate[] {
  return probe.collectionHits
    .map((hit) => {
      const filteredIds = hit.matchedInventoryIds.filter((id) => inventoryIds.has(id));
      return buildFilteredCollectionCandidate({
        dataPath: hit.dataPath,
        tab,
        matchedIds: filteredIds,
        collectionLength: hit.collectionLength,
        portalCount,
        previousSignatures,
        isFrameworkPath: isFrameworkStatePath(hit.dataPath),
      });
    })
    .sort((a, b) => b.matchedInventoryCount - a.matchedInventoryCount);
}

async function captureTabFilterState(
  page: Page,
  tab: "all" | "online" | "offline",
  inventoryIds: Set<string>,
  previousProbe: ReturnType<typeof normalizeBrowserFilterProbe> | null,
  previousSignatures: string[],
  skipClick = false,
): Promise<TabFilterCapture> {
  if (!skipClick && tab !== "all") {
    await clickStatusTabSafely(page, tab);
    await waitForLoadingToSettle(page);
    if (previousProbe?.rowSignature) {
      await waitForRowSignatureChange(page, inventoryIds, previousProbe.rowSignature);
    }
  }

  const portalSnapshot = await waitForStablePortalCount(page, tab, 1200);
  const portalCount = portalSnapshot.after ?? portalSnapshot.before;
  const probe = await probeFilterState(page, inventoryIds);
  const changedStatePaths =
    previousProbe != null
      ? compareStateSnapshots(previousProbe.stateSnapshot, probe.stateSnapshot).filter(
          (change) => !isFrameworkStatePath(change.path),
        )
      : [];

  return {
    tab,
    portalCountBefore: portalSnapshot.before,
    portalCountAfter: portalSnapshot.after,
    rowSignature: probe.rowSignature,
    changedStatePaths,
    collectionCandidates: buildCollectionCandidates(
      tab,
      probe,
      inventoryIds,
      portalCount,
      previousSignatures,
    ),
  };
}

function pickBestFunctionCandidate(
  functions: FunctionSourceRecord[],
): { componentName: string; functionName: string } | null {
  const ranked = functions
    .filter((fn) => !isExcludedStatusFilterFunction(fn.name))
    .filter((fn) => fn.matchedTerms.some((term) => term.includes("filter") || term.includes("online")))
    .map((fn) => ({
      fn,
      score:
        fn.matchedTerms.length +
        (PREFERRED_CONNECTIVITY_FUNCTIONS.includes(fn.name) ? 20 : 0) +
        (fn.componentName === "DeviceList" ? 10 : 0) +
        (fn.componentName === "DeviceCountState" ? 8 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.fn;
  if (!best) return null;
  return {
    componentName: best.componentName ?? best.componentPath,
    functionName: best.name,
  };
}

function pickBestCollectionPerTab(
  candidates: FilteredCollectionCandidate[],
  tab: "all" | "online" | "offline",
): FilteredCollectionCandidate | null {
  return (
    candidates
      .filter((candidate) => candidate.tab === tab && !candidate.rejected)
      .sort((a, b) => b.matchedInventoryCount - a.matchedInventoryCount)[0] ?? null
  );
}

export function buildStatusFilterFailureSummary(input: {
  startedAt: string;
  error?: unknown;
  portalCounts?: ModelPortalCounts | null;
}): Record<string, unknown> {
  const message = input.error instanceof Error ? input.error.message : String(input.error ?? "unknown");
  return {
    status: "failed",
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    portalCounts: input.portalCounts ?? null,
    relevantComponentCount: 0,
    changedStatePaths: [],
    filteredCollectionCandidates: 0,
    bundleMatchCount: 0,
    recommendedSource: null,
    recommendedComponent: null,
    recommendedFunction: null,
    recommendedFieldPath: null,
    recommendedMapping: null,
    extractedCounts: null,
    onlineOfflineIntersection: [],
    unionCount: 0,
    inventoryOverlapPercentage: 0,
    validated: false,
    validationReasons: [message],
    failureCategories: ["discovery_error"],
    generatedAt: new Date().toISOString(),
  };
}

export async function runStatusFilterDiscovery(): Promise<{
  validated: boolean;
  summary: Record<string, unknown>;
}> {
  const config = loadConfig(process.env);
  validateWorkerConfig(config);
  ensureCaptureDir(config);
  const log = createLogger(config);
  const startedAt = new Date().toISOString();
  let cleanup: (() => Promise<void>) | null = null;

  try {
    const session = await ensureAuthenticatedPage(config, log, { forceHeadless: false });
    cleanup = session.cleanup;
    const { page } = session;

    const capture = new NetworkCapture();
    capture.attach(page);
    await waitForDiscoverySignals(page, capture, 10_000, 25_000);

    const portalCounts = await readPortalSnapshot(page);
    const treePayload = capture.getActionCapture("querydevicestree")?.sanitizedResponse;
    const records = treePayload ? collectBootstrapDeviceRecords(treePayload) : [];
    const inventoryIds = new Set(records.map((record) => record.sourceDeviceId));

    if (inventoryIds.size === 0) {
      const summary = buildStatusFilterFailureSummary({
        startedAt,
        error: new Error("Could not load inventory from querydevicestree"),
        portalCounts,
      });
      writeStatusFilterArtifacts(config.captureDir, summary, {}, [], [], [], [], [], []);
      return { validated: false, summary };
    }

    const fieldCandidates = discoverStatusFilterFieldCandidates(records, portalCounts);
    const bestFieldCandidate = pickBestStatusFilterFieldCandidate(fieldCandidates);

    const tabSequence: Array<{ tab: "all" | "online" | "offline"; skipClick?: boolean }> = [
      { tab: "all", skipClick: true },
      { tab: "online" },
      { tab: "offline" },
      { tab: "all" },
    ];

    const tabCaptures: TabFilterCapture[] = [];
    const allComponents = new Map<string, VueComponentRecord>();
    const allFunctions = new Map<string, FunctionSourceRecord>();
    const allChangedPaths: ChangedStatePath[] = [];
    const collectionCandidates: FilteredCollectionCandidate[] = [];
    const previousSignatures: string[] = [];
    let previousProbe: ReturnType<typeof normalizeBrowserFilterProbe> | null = null;

    for (const step of tabSequence) {
      const captureResult = await captureTabFilterState(
        page,
        step.tab,
        inventoryIds,
        previousProbe,
        previousSignatures,
        step.skipClick,
      );
      tabCaptures.push(captureResult);
      previousProbe = await probeFilterState(page, inventoryIds);

      for (const component of previousProbe.components) {
        allComponents.set(component.componentPath, component);
      }
      for (const fn of previousProbe.functionSources) {
        allFunctions.set(`${fn.componentPath}:${fn.name}`, fn);
      }
      allChangedPaths.push(...captureResult.changedStatePaths);
      for (const candidate of captureResult.collectionCandidates) {
        previousSignatures.push(candidate.datasetSignature);
        collectionCandidates.push(candidate);
      }
    }

    const bundleDir = path.join(config.captureDir, STATUS_FILTER_BUNDLES_DIR);
    mkdirSync(bundleDir, { recursive: true });
    const computedNames = [...allFunctions.values()]
      .map((fn) => fn.name)
      .filter((name) => !isExcludedStatusFilterFunction(name));
    const bundleMatches = await collectBundleMatches(page, bundleDir, computedNames);
    const bestBundleMatch = pickBestBundleMatch(bundleMatches);
    const functionCandidate = pickBestFunctionCandidate([...allFunctions.values()]);

    const extraction = await extractStatusFilterIds(page, inventoryIds);

    let allDeviceIds: string[] = [];
    let onlineDeviceIds: string[] = [];
    let offlineDeviceIds: string[] = [];
    let usedExtraction = false;

    if (extraction.source && extraction.allDeviceIds.length > 0) {
      allDeviceIds = extraction.allDeviceIds;
      onlineDeviceIds = extraction.onlineDeviceIds;
      offlineDeviceIds = extraction.offlineDeviceIds;
      usedExtraction = true;
    } else if (bestFieldCandidate?.validated) {
      allDeviceIds = [
        ...new Set([
          ...bestFieldCandidate.onlineDeviceIds,
          ...bestFieldCandidate.offlineDeviceIds,
        ]),
      ];
      onlineDeviceIds = bestFieldCandidate.onlineDeviceIds;
      offlineDeviceIds = bestFieldCandidate.offlineDeviceIds;
    } else {
      const allCollection = pickBestCollectionPerTab(collectionCandidates, "all");
      const onlineCollection = pickBestCollectionPerTab(collectionCandidates, "online");
      const offlineCollection = pickBestCollectionPerTab(collectionCandidates, "offline");
      allDeviceIds = allCollection?.uniqueMatchedIds ?? [];
      onlineDeviceIds = onlineCollection?.uniqueMatchedIds ?? [];
      offlineDeviceIds = offlineCollection?.uniqueMatchedIds ?? [];
      if (allDeviceIds.length === 0) {
        allDeviceIds = [...new Set([...onlineDeviceIds, ...offlineDeviceIds])];
      }
    }

    const validation = validateStatusFilterDiscovery({
      inventoryIds,
      allDeviceIds,
      onlineDeviceIds,
      offlineDeviceIds,
      portalCounts,
      collections: collectionCandidates,
      requireSourceChange: !bestFieldCandidate?.validated && !usedExtraction,
    });

    const recommendation = recommendStatusFilterSource({
      fieldCandidate: bestFieldCandidate,
      extraction,
      functionCandidate,
      collectionCandidates,
      bundleMatch: bestBundleMatch,
    });

    const failureCategories = categorizeStatusFilterFailure({
      relevantComponentCount: allComponents.size,
      changedStatePaths: allChangedPaths.length,
      fieldCandidateCount: fieldCandidates.length,
      validatedField: Boolean(bestFieldCandidate?.validated),
      functionCandidateCount: allFunctions.size,
      collectionCandidateCount: collectionCandidates.filter((c) => !c.rejected).length,
      bundleMatchCount: bundleMatches.length,
      validation,
    });

    const generatedAt = new Date().toISOString();
    const summary: Record<string, unknown> = {
      status: "success",
      portalCounts,
      relevantComponentCount: allComponents.size,
      changedStatePaths: allChangedPaths.map((change) => ({
        path: change.path,
        changeKind: change.changeKind,
        before: change.before,
        after: change.after,
      })),
      filteredCollectionCandidates: collectionCandidates.filter((c) => !c.rejected).length,
      bundleMatchCount: bundleMatches.length,
      recommendedSource: recommendation.source,
      recommendedComponent: recommendation.component,
      recommendedFunction: recommendation.functionName,
      recommendedFieldPath: recommendation.fieldPath,
      recommendedMapping: recommendation.mapping,
      extractionSource: extraction.source,
      extractionError: extraction.error,
      extractionCounts: extraction.counts,
      extractedCounts: validation.extractedCounts,
      onlineOfflineIntersection: validation.onlineOfflineIntersection,
      unionCount: validation.unionCount,
      inventoryOverlapPercentage: validation.inventoryOverlapPercentage,
      validated: validation.validated,
      validationReasons: validation.validationReasons,
      failureCategories: validation.validated ? [] : failureCategories,
      generatedAt,
    };

    writeStatusFilterArtifacts(
      config.captureDir,
      summary,
      {
        components: [...allComponents.values()],
        tabCaptures: tabCaptures.map((capture) => ({
          tab: capture.tab,
          portalCountBefore: capture.portalCountBefore,
          portalCountAfter: capture.portalCountAfter,
          rowSignature: capture.rowSignature,
          changedStatePathCount: capture.changedStatePaths.length,
        })),
        changedStatePaths: allChangedPaths,
      },
      [...allFunctions.values()],
      fieldCandidates.slice(0, 100),
      collectionCandidates,
      bundleMatches,
      validation.onlineDeviceIds,
      validation.offlineDeviceIds,
    );

    log.info(
      {
        validated: validation.validated,
        recommendedSource: recommendation.source,
        relevantComponents: allComponents.size,
        changedPaths: allChangedPaths.length,
      },
      "Status filter discovery complete",
    );

    console.log("\n--- GPS51 Status Filter Discovery ---");
    console.log(JSON.stringify(summary, null, 2));
    console.log("Files written to data/captures/");
    console.log("-------------------------------------\n");

    return { validated: validation.validated, summary };
  } catch (err) {
    const summary = buildStatusFilterFailureSummary({ startedAt, error: err });
    writeStatusFilterArtifacts(config.captureDir, summary, {}, [], [], [], [], [], []);
    console.error(err instanceof Error ? err.message : String(err));
    return { validated: false, summary };
  } finally {
    if (cleanup) await cleanup().catch(() => undefined);
  }
}

function writeStatusFilterArtifacts(
  captureDir: string,
  summary: Record<string, unknown>,
  componentState: Record<string, unknown>,
  functions: unknown[],
  fieldCandidates: unknown[],
  collectionCandidates: unknown[],
  bundleMatches: unknown[],
  onlineIds: string[],
  offlineIds: string[],
): void {
  writeFileSync(path.join(captureDir, STATUS_FILTER_SUMMARY_FILE), JSON.stringify(summary, null, 2));
  writeFileSync(
    path.join(captureDir, STATUS_FILTER_COMPONENT_STATE_FILE),
    JSON.stringify(componentState, null, 2),
  );
  writeFileSync(path.join(captureDir, STATUS_FILTER_FUNCTIONS_FILE), JSON.stringify(functions, null, 2));
  writeFileSync(
    path.join(captureDir, STATUS_FILTER_FIELD_CANDIDATES_FILE),
    JSON.stringify(fieldCandidates, null, 2),
  );
  writeFileSync(
    path.join(captureDir, STATUS_FILTER_BUNDLE_MATCHES_FILE),
    JSON.stringify(bundleMatches, null, 2),
  );
  writeFileSync(
    path.join(captureDir, STATUS_FILTER_ONLINE_IDS_FILE),
    JSON.stringify({ count: onlineIds.length, deviceIds: onlineIds }, null, 2),
  );
  writeFileSync(
    path.join(captureDir, STATUS_FILTER_OFFLINE_IDS_FILE),
    JSON.stringify({ count: offlineIds.length, deviceIds: offlineIds }, null, 2),
  );
}

if (isMain) {
  resetConfigCache();
  runStatusFilterDiscovery()
    .then((result) => {
      process.exitCode = result.validated ? 0 : 2;
      process.exit(process.exitCode);
    })
    .catch(() => process.exit(1));
}
