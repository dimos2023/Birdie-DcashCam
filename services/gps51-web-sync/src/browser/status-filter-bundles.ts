import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { redactSensitiveText } from "../gps51/status-filter-internals.js";
import { isConnectivityBundleSnippet, isExcludedStatusFilterFunction } from "../gps51/status-filter-extract.js";

export type BundleMatch = {
  bundleUrl: string;
  bundleFile: string;
  nearbyIdentifier: string | null;
  matchingTerm: string;
  snippet: string;
  probablePredicate: string;
};

const BUNDLE_SEARCH_TERMS = [
  "All devices",
  "All Devices",
  "Online",
  "Offline",
  "在线",
  "离线",
  "全部",
  "querydevicestree",
  "deviceid",
  "lastactivetime",
  "offlinedelay",
  "filter(",
  "isonline",
  "devicestatus",
  "statusType",
  "deviceStateFilter",
];

export function buildScriptUrlCollectorScript(): string {
  return `(() => {
    try {
      var urls = [];
      var scripts = document.querySelectorAll("script[src]");
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].getAttribute("src");
        if (!src) continue;
        try {
          var absolute = new URL(src, window.location.href).href;
          if (absolute.indexOf(window.location.origin) === 0) urls.push(absolute.split("?")[0]);
        } catch (e) {}
      }
      var seen = {};
      var out = [];
      for (var j = 0; j < urls.length; j++) {
        if (!seen[urls[j]]) { seen[urls[j]] = true; out.push(urls[j]); }
      }
      return out;
    } catch (e) {
      return [];
    }
  })()`;
}

export function sanitizeBundleUrl(url: string): string {
  return url.split("?")[0] ?? url;
}

export function hashBundleContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function extractBundleMatches(
  bundleUrl: string,
  bundleFile: string,
  content: string,
  extraTerms: string[] = [],
): BundleMatch[] {
  const terms = [...new Set([...BUNDLE_SEARCH_TERMS, ...extraTerms])];
  const matches: BundleMatch[] = [];
  const lower = content.toLowerCase();

  for (const term of terms) {
    let index = lower.indexOf(term.toLowerCase());
    let occurrences = 0;
    while (index >= 0 && occurrences < 5) {
      const start = Math.max(0, index - 150);
      const end = Math.min(content.length, index + 350);
      const snippet = redactSensitiveText(content.slice(start, end).replace(/\s+/g, " "));
      const identifier = findNearbyIdentifier(content, index);
      matches.push({
        bundleUrl: sanitizeBundleUrl(bundleUrl),
        bundleFile,
        nearbyIdentifier: identifier,
        matchingTerm: term,
        snippet: snippet.slice(0, 500),
        probablePredicate: inferProbablePredicate(snippet, term),
      });
      occurrences += 1;
      index = lower.indexOf(term.toLowerCase(), index + term.length);
    }
  }

  return matches;
}

function findNearbyIdentifier(content: string, index: number): string | null {
  const window = content.slice(Math.max(0, index - 300), Math.min(content.length, index + 100));
  const patterns = [
    /function\s+([A-Za-z0-9_$]+)/g,
    /([A-Za-z0-9_$]+)\s*:\s*function/g,
    /computed\s*:\s*\{[^}]*?([A-Za-z0-9_$]+)\s*:/g,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(window);
    if (match?.[1]) return match[1];
  }
  return null;
}

function inferProbablePredicate(snippet: string, term: string): string {
  const lower = snippet.toLowerCase();
  if (lower.includes("filter(") && (lower.includes("online") || lower.includes("offline"))) {
    return "device_list_filter_predicate";
  }
  if (term.toLowerCase().includes("statustype") || lower.includes("statustype")) {
    return "status_type_tab_filter";
  }
  if (term === "querydevicestree") return "device_tree_bootstrap";
  if (term === "lastactivetime" || term === "offlinedelay") return "timestamp_threshold_candidate";
  return `bundle_term_${term.toLowerCase().replace(/\s+/g, "_")}`;
}

export async function collectBundleMatches(
  page: Page,
  bundleDir: string,
  extraTerms: string[] = [],
): Promise<BundleMatch[]> {
  mkdirSync(bundleDir, { recursive: true });
  const rawUrls = await page.evaluate(buildScriptUrlCollectorScript()).catch(() => []);
  const urls = Array.isArray(rawUrls)
    ? rawUrls.filter((url): url is string => typeof url === "string")
    : [];

  const allMatches: BundleMatch[] = [];
  for (const url of urls.slice(0, 25)) {
    try {
      const response = await page.context().request.get(url);
      if (!response.ok()) continue;
      const content = await response.text();
      const fileName = `${hashBundleContent(content)}.js`;
      const filePath = path.join(bundleDir, fileName);
      writeFileSync(filePath, content, "utf8");
      allMatches.push(...extractBundleMatches(url, fileName, content, extraTerms));
    } catch {
      // skip failed bundle downloads
    }
  }

  return dedupeBundleMatches(allMatches);
}

function dedupeBundleMatches(matches: BundleMatch[]): BundleMatch[] {
  const seen = new Set<string>();
  const out: BundleMatch[] = [];
  for (const match of matches) {
    const key = `${match.bundleUrl}:${match.matchingTerm}:${match.snippet.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(match);
  }
  return out;
}

export function scoreBundleMatch(match: BundleMatch): number {
  const snippet = match.snippet.toLowerCase();
  const identifier = (match.nearbyIdentifier ?? "").toLowerCase();
  if (isExcludedStatusFilterFunction(snippet) || isExcludedStatusFilterFunction(identifier)) {
    return -100;
  }

  let score = 0;
  if (isConnectivityBundleSnippet(match.snippet)) score += 50;
  if (snippet.includes("selectdevicestatetype")) score += 20;
  if (snippet.includes("isonline")) score += 15;
  if (snippet.includes("lastpositions")) score += 12;
  if (snippet.includes("setcurrentztree")) score += 10;
  if (snippet.includes("updateallstate")) score += 10;
  if (snippet.includes("deviceinfos")) score += 8;
  if (match.probablePredicate.includes("filter")) score += 5;
  if (match.matchingTerm === "filter(") score += 4;
  if (match.probablePredicate === "status_type_tab_filter") score += 4;
  if (identifier.includes("alarm") || identifier.includes("urgent")) score -= 50;
  return score;
}

export function pickBestBundleMatch(matches: BundleMatch[]): BundleMatch | null {
  const ranked = matches
    .map((match) => ({ match, score: scoreBundleMatch(match) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.match ?? null;
}
