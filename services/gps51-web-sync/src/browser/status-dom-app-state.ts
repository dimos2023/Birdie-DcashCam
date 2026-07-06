import type { Page } from "playwright";
import { redactSecrets } from "./redaction.js";
import { extractInventoryMatchesFromTexts } from "../gps51/status-dom-matcher.js";
import { buildVxeExtractionScript } from "./status-dom-vxe.js";
import {
  appendUniqueReasons,
  describeEvaluateResultType,
  normalizeAppStatePathEntries,
  normalizeRecordArray,
  normalizeUnknownArray,
  type AppStatePathEntry,
} from "./status-dom-normalize.js";

const APP_STATE_PATH_PROBE_LIMIT = 40;

export type AppStateProbeDiagnostics = {
  evaluateResultType: string;
  normalizedCandidateCount: number;
  inspectedPropertyCount: number;
  matchedInventoryIdCount: number;
  fallbackUsed: boolean;
  fallbackSucceeded: boolean;
};

export type AppStateFallbackResult = {
  used: boolean;
  source: string | null;
  onlineIds: string[];
  offlineIds: string[];
  allIds: string[];
  candidates: AppStatePathEntry[];
  matchedDeviceIds: string[];
  inspectedPropertyCount: number;
  reason: string | null;
  debug: Record<string, unknown>;
  diagnostics: AppStateProbeDiagnostics;
};

const SECRET_VALUE_PATTERN =
  /token|password|secret|authorization|cookie|session|credential|apikey|api_key|bearer/i;

function isRelevantAppStatePath(path: string): boolean {
  if (!path || path === "window") return false;
  if (/document\.Z__visibilitychange/i.test(path)) return false;
  if (/^window\.document\./i.test(path)) return false;
  return /vxe|vue|store|device|tree|table|monitor/i.test(path);
}
const APP_STATE_ARRAY_SCAN_LIMIT = 5000;
const APP_STATE_OBJECT_KEY_LIMIT = 200;

export function redactAppStateValue(key: string, value: unknown): unknown {
  if (SECRET_VALUE_PATTERN.test(key)) return "[REDACTED]";
  if (typeof value === "string" && value.length > 200 && SECRET_VALUE_PATTERN.test(value)) {
    return "[REDACTED]";
  }
  return redactSecrets(value);
}

export function findInventoryIdsInUnknownValue(
  value: unknown,
  inventoryIds: Set<string>,
  depth = 0,
): string[] {
  if (depth > 12 || value == null) return [];

  if (typeof value === "string") {
    return extractInventoryMatchesFromTexts([value], inventoryIds);
  }

  if (Array.isArray(value)) {
    const found = new Set<string>();
    const items = normalizeUnknownArray(value).slice(0, APP_STATE_ARRAY_SCAN_LIMIT);
    for (const item of items) {
      for (const id of findInventoryIdsInUnknownValue(item, inventoryIds, depth + 1)) {
        found.add(id);
      }
    }
    return [...found];
  }

  if (typeof value === "object") {
    const found = new Set<string>();
    const entries = Object.entries(value as Record<string, unknown>).slice(0, APP_STATE_OBJECT_KEY_LIMIT);
    for (const [key, child] of entries) {
      if (SECRET_VALUE_PATTERN.test(key)) continue;
      for (const id of findInventoryIdsInUnknownValue(child, inventoryIds, depth + 1)) {
        found.add(id);
      }
    }
    return [...found];
  }

  return [];
}

export function buildAppStateProbeResult(input: {
  rawPaths: unknown;
  pathMatches: Array<{ path: string; type: string; length: number; ids: string[] }>;
}): AppStateFallbackResult {
  const evaluateResultType = describeEvaluateResultType(input.rawPaths);
  const candidates = normalizeAppStatePathEntries(input.rawPaths);
  const normalizedCandidateCount = candidates.length;
  const inspectedEntries = input.pathMatches.slice(0, APP_STATE_PATH_PROBE_LIMIT);
  const inspectedPropertyCount = inspectedEntries.length;

  let bestPath: string | null = null;
  let bestIds: string[] = [];
  const debugPaths: Array<Record<string, unknown>> = [];

  for (const entry of inspectedEntries) {
    const uniqueIds = [...new Set(entry.ids)].sort();
    debugPaths.push({
      path: entry.path,
      type: entry.type,
      length: entry.length,
      inventoryMatches: uniqueIds.length,
      sample: redactAppStateValue(entry.path, null),
    });

    if (uniqueIds.length > bestIds.length) {
      bestPath = entry.path;
      bestIds = uniqueIds;
    }
  }

  const matchedDeviceIds = bestIds;
  const fallbackSucceeded = matchedDeviceIds.length > 0;
  const reason = fallbackSucceeded ? null : "no_application_state_candidates";

  return {
    used: fallbackSucceeded,
    source: bestPath,
    onlineIds: [],
    offlineIds: [],
    allIds: matchedDeviceIds,
    candidates,
    matchedDeviceIds,
    inspectedPropertyCount,
    reason,
    debug: {
      pathsInspected: inspectedPropertyCount,
      paths: debugPaths.slice(0, 10),
    },
    diagnostics: {
      evaluateResultType,
      normalizedCandidateCount,
      inspectedPropertyCount,
      matchedInventoryIdCount: matchedDeviceIds.length,
      fallbackUsed: true,
      fallbackSucceeded,
    },
  };
}

export function logAppStateProbeDiagnostics(diagnostics: AppStateProbeDiagnostics): void {
  console.info(
    JSON.stringify({
      msg: "GPS51 application-state probe",
      evaluateResultType: diagnostics.evaluateResultType,
      normalizedCandidateCount: diagnostics.normalizedCandidateCount,
      inspectedPropertyCount: diagnostics.inspectedPropertyCount,
      matchedInventoryIdCount: diagnostics.matchedInventoryIdCount,
      fallbackUsed: diagnostics.fallbackUsed,
      fallbackSucceeded: diagnostics.fallbackSucceeded,
    }),
  );
}

function buildAppStatePathSnapshotScript(): string {
  return `(() => {
    try {
      var paths = [];
      var queue = [{ prefix: "window", value: window }];
      var seen = new Set();

      while (queue.length > 0 && paths.length < 80) {
        var item = queue.shift();
        if (!item) continue;
        var value = item.value;
        if (!value || typeof value !== "object") continue;
        if (seen.has(value)) continue;
        seen.add(value);

        if (Array.isArray(value)) {
          paths.push({ path: item.prefix, type: "array", length: value.length });
          if (value.length > 0 && value.length < 5000) {
            queue.push({ prefix: item.prefix, value: value });
          }
          continue;
        }

        var keys = Object.keys(value).slice(0, 60);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (/token|password|secret|cookie|session|authorization/i.test(key)) continue;
          var child = value[key];
          var childPath = item.prefix + "." + key;
          if (Array.isArray(child) && child.length > 0) {
            paths.push({ path: childPath, type: "array", length: child.length });
          }
          if (child && typeof child === "object") {
            queue.push({ prefix: childPath, value: child });
          }
        }
      }

      return Array.isArray(paths) ? paths : [];
    } catch (e) {
      return [];
    }
  })()`;
}

function buildReadAppStatePathScript(path: string): string {
  const serializedPath = JSON.stringify(path);
  return `(() => {
    try {
      var pathExpr = ${serializedPath};
      return (function() { return eval(pathExpr); })();
    } catch (e) {
      return null;
    }
  })()`;
}

export async function readAppStateValueAtPath(page: Page, path: string): Promise<unknown> {
  return page.evaluate(buildReadAppStatePathScript(path)).catch(() => null);
}

export async function probeAppStateDeviceSets(
  page: Page,
  inventoryIds: Set<string>,
): Promise<AppStateFallbackResult> {
  const vxeScript = buildVxeExtractionScript([...inventoryIds], "fallback", null);
  const vxeRaw = await page.evaluate(vxeScript).catch(() => null);
  const vxeRecord = normalizeRecordArray([vxeRaw])[0] ?? {};
  const vxeIds = Array.isArray(vxeRecord.deviceIds)
    ? vxeRecord.deviceIds.filter((id): id is string => typeof id === "string")
    : [];

  if (vxeIds.length > 0) {
    const result: AppStateFallbackResult = {
      used: true,
      source: typeof vxeRecord.selectedDataPath === "string" ? vxeRecord.selectedDataPath : "vxe_component",
      onlineIds: [],
      offlineIds: [],
      allIds: [...new Set(vxeIds)].sort(),
      candidates: [],
      matchedDeviceIds: [...new Set(vxeIds)].sort(),
      inspectedPropertyCount: 1,
      reason: null,
      debug: {
        extractionMethod: vxeRecord.extractionMethod ?? "vue_component_state",
        candidateDatasetCounts: vxeRecord.candidateDatasetCounts ?? [],
      },
      diagnostics: {
        evaluateResultType: describeEvaluateResultType(vxeRaw),
        normalizedCandidateCount: normalizeRecordArray(vxeRecord.candidateDatasetCounts).length,
        inspectedPropertyCount: 1,
        matchedInventoryIdCount: vxeIds.length,
        fallbackUsed: true,
        fallbackSucceeded: true,
      },
    };
    logAppStateProbeDiagnostics(result.diagnostics);
    return result;
  }

  const rawPaths = await page.evaluate(buildAppStatePathSnapshotScript()).catch(() => []);
  const candidates = normalizeAppStatePathEntries(rawPaths).filter((entry) =>
    isRelevantAppStatePath(entry.path),
  );
  const pathMatches: Array<{ path: string; type: string; length: number; ids: string[] }> = [];

  for (const entry of candidates.slice(0, APP_STATE_PATH_PROBE_LIMIT)) {
    const value = await readAppStateValueAtPath(page, entry.path);
    const ids = findInventoryIdsInUnknownValue(value, inventoryIds);
    pathMatches.push({
      path: entry.path,
      type: entry.type,
      length: entry.length,
      ids,
    });
  }

  const result = buildAppStateProbeResult({ rawPaths: candidates, pathMatches });
  logAppStateProbeDiagnostics(result.diagnostics);
  return result;
}

export async function captureAppStateTabDiff(
  page: Page,
  inventoryIds: Set<string>,
  beforePath: string | null,
): Promise<{ onlineIds: string[]; offlineIds: string[] }> {
  if (!beforePath) return { onlineIds: [], offlineIds: [] };

  const afterValue = await readAppStateValueAtPath(page, beforePath);
  const ids = findInventoryIdsInUnknownValue(afterValue, inventoryIds);
  return { onlineIds: ids, offlineIds: [] };
}

export function mergeDomDiscoveryValidationReasons(input: {
  reconciliationReasons: string[];
  containerReason: string | null;
  appStateReason: string | null;
}): string[] {
  return appendUniqueReasons(input.reconciliationReasons, [
    input.containerReason ?? "",
    input.appStateReason ?? "",
  ]);
}
