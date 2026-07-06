import { readPortalStatusCounts } from "./monitor-subscription.js";
import { NetworkCapture, waitForDiscoverySignals } from "./network-capture.js";
import { collectBootstrapDeviceRecords } from "../gps51/status-bootstrap-parser.js";
import { buildInventoryIdentityIndex, } from "../gps51/status-dom-identity.js";
import { categorizeDomExtractionFailure, hasTabSelectionEvidenceForAllTabs, } from "../gps51/status-dom-failure.js";
import { inferStatusIconMappings } from "../gps51/status-dom-icons.js";
import { reconcileDomStatusSets, } from "../gps51/status-dom-reconciliation.js";
import { buildDatasetSignature, isStaleTabDataset, portalCountWithinTolerance, } from "../gps51/status-dom-vxe-core.js";
import { probeAppStateDeviceSets, mergeDomDiscoveryValidationReasons } from "./status-dom-app-state.js";
import { discoverTreeScrollContainer, } from "./status-dom-tree.js";
import { clickStatusTabSafely, buildTabSelectionEvidence, inspectTabActiveState, waitForLoadingToSettle, waitForStablePortalCount, } from "./status-dom-tabs.js";
import { discoverIdentityAwareContainer, extractDeviceRowsFromContainer, mergeContainerDiscovery, } from "./status-dom-rows.js";
import { extractVxeDeviceIdsForCurrentTab } from "./status-dom-vxe.js";
export const STATUS_DOM_SUMMARY_FILE = "status-dom-summary.json";
export const STATUS_UI_DEBUG_FILE = "status-ui-debug.json";
function emptyTabSelectionEvidence() {
    return {
        ariaSelected: false,
        activeClass: false,
        classChangedAfterClick: false,
        portalCountMatches: false,
        rowSignatureChanged: false,
        anotherTabLostActive: false,
        selected: false,
        reasons: [],
    };
}
function emptyTabClickDiagnostics() {
    return {
        clicked: false,
        matchedLabel: null,
        matchedElementTag: null,
        matchedElementClasses: null,
        clickableAncestorTag: null,
        clickableAncestorClasses: null,
        textBeforeClick: null,
        textAfterClick: null,
        strategy: null,
    };
}
async function resetContainerScroll(page, selector) {
    if (!selector)
        return;
    await page
        .evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el && el.scrollTop != null) {
        el.scrollTop = 0;
        el.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    })()`)
        .catch(() => undefined);
}
async function extractTabDeviceIds(page, tab, identityIndex, containerSelector, settleMs, previousSignature, previousPortalCount) {
    const clickDiagnostics = await clickStatusTabSafely(page, tab);
    await waitForLoadingToSettle(page);
    const portalSnapshot = await waitForStablePortalCount(page, tab, settleMs);
    const portalCount = portalSnapshot.after ?? portalSnapshot.before;
    const activeState = await inspectTabActiveState(page, tab);
    let rowResult = containerSelector
        ? await extractDeviceRowsFromContainer(page, containerSelector, identityIndex, portalCount, tab)
        : {
            deviceIds: [],
            extractionMethod: "none",
            selectedContainer: null,
            stats: {
                idMatches: 0,
                uniqueNameMatches: 0,
                groupNameMatches: 0,
                unresolvedRows: 0,
                duplicateNameRows: 0,
                visibleRowCount: 0,
                resolvedRowCount: 0,
            },
            rowSamples: [],
            datasetSignature: buildDatasetSignature(tab, []),
            scrollPasses: 0,
            rejectionReason: "no_device_container",
        };
    if (rowResult.deviceIds.length === 0) {
        const vxeResult = await extractVxeDeviceIdsForCurrentTab(page, identityIndex.deviceIdSet, tab, portalCount);
        if (vxeResult.deviceIds.length > rowResult.deviceIds.length) {
            rowResult = {
                deviceIds: vxeResult.deviceIds,
                extractionMethod: vxeResult.extractionMethod,
                selectedContainer: containerSelector,
                stats: rowResult.stats,
                rowSamples: rowResult.rowSamples,
                datasetSignature: vxeResult.datasetSignature,
                scrollPasses: vxeResult.extractionMethod === "virtual_dom_scroll" ? 1 : rowResult.scrollPasses,
                rejectionReason: null,
            };
        }
    }
    const rowSignatureChanged = previousSignature != null &&
        rowResult.datasetSignature.length > 0 &&
        rowResult.datasetSignature !== previousSignature;
    const portalCountMatches = portalCount != null &&
        portalCountWithinTolerance(rowResult.deviceIds.length, portalCount, portalCount, 2);
    const tabSelectionEvidence = buildTabSelectionEvidence({
        clickDiagnostics,
        ariaSelected: activeState.ariaSelected,
        activeClass: activeState.activeClass,
        portalCountMatches,
        rowSignatureChanged,
        anotherTabLostActive: rowSignatureChanged && tab !== "all",
    });
    const staleDatasetRejected = isStaleTabDataset({
        currentTab: tab,
        currentSignature: rowResult.datasetSignature,
        previousSignature,
        currentPortalCount: portalCount,
        previousPortalCount,
    });
    const acceptedIds = staleDatasetRejected ||
        !portalCountWithinTolerance(rowResult.deviceIds.length, portalSnapshot.before, portalSnapshot.after, 2)
        ? []
        : rowResult.deviceIds;
    return {
        tab,
        portalCount,
        portalCountBefore: portalSnapshot.before,
        portalCountAfter: portalSnapshot.after,
        deviceIds: acceptedIds,
        tabClicked: clickDiagnostics.clicked,
        tabSelected: tabSelectionEvidence.selected,
        tabSelectionEvidence,
        tabClickDiagnostics: clickDiagnostics,
        matchedLabel: clickDiagnostics.matchedLabel,
        clickStrategy: clickDiagnostics.strategy,
        extractionMethod: staleDatasetRejected || acceptedIds.length === 0
            ? "none"
            : rowResult.extractionMethod === "none"
                ? "virtual_dom_scroll"
                : rowResult.extractionMethod,
        selectedDataPath: null,
        selectedContainer: rowResult.selectedContainer,
        idMatches: rowResult.stats.idMatches,
        uniqueNameMatches: rowResult.stats.uniqueNameMatches,
        groupNameMatches: rowResult.stats.groupNameMatches,
        unresolvedRows: rowResult.stats.unresolvedRows,
        duplicateNameRows: rowResult.stats.duplicateNameRows,
        candidateDatasetCounts: [],
        datasetSignature: staleDatasetRejected
            ? buildDatasetSignature(tab, [])
            : rowResult.datasetSignature,
        staleDatasetRejected,
        expansionPasses: 0,
        expandClicks: 0,
        scrollPasses: rowResult.scrollPasses,
        textsCollected: rowResult.stats.visibleRowCount,
        rowSamples: rowResult.rowSamples,
    };
}
function buildUiDebug(input) {
    return {
        tabClickDiagnostics: input.tabResults.map((tab) => ({
            tab: tab.tab,
            ...tab.tabClickDiagnostics,
        })),
        tabSelectionEvidence: input.tabResults.map((tab) => ({
            tab: tab.tab,
            ...tab.tabSelectionEvidence,
        })),
        containerCandidates: input.containerCandidates,
        selectedContainerSelector: input.selectedContainer,
        duplicateNameCount: input.duplicateNameCount,
        datasetSignatures: Object.fromEntries(input.tabResults.map((tab) => [tab.tab, tab.datasetSignature])),
        rejectionReasons: input.rejectionReasons,
        rowSamplesByTab: Object.fromEntries(input.tabResults.map((tab) => [tab.tab, tab.rowSamples.slice(0, 10)])),
    };
}
export async function extractDomStatusSets(page, inventoryIdsInput, options = {}, identityIndexInput) {
    const settleMs = options.tabSettleMs ?? 1500;
    const inventoryIds = new Set(inventoryIdsInput);
    const generatedAt = new Date().toISOString();
    const portalCounts = await readPortalStatusCounts(page).catch(() => ({
        all: null,
        online: null,
        offline: null,
    }));
    const identityIndex = identityIndexInput ??
        buildInventoryIdentityIndex([...inventoryIds].map((id) => ({
            sourceDeviceId: id,
            deviceName: null,
            lastActiveTimeRaw: null,
            offlineDelayRaw: null,
            raw: {},
        })));
    const legacyContainerDiscovery = await discoverTreeScrollContainer(page, inventoryIds);
    const identityContainerDiscovery = await discoverIdentityAwareContainer(page, identityIndex);
    const selectedTreeContainer = mergeContainerDiscovery(legacyContainerDiscovery, identityContainerDiscovery);
    const containerSelector = selectedTreeContainer?.selector ?? null;
    const containerDiscoveryReason = identityContainerDiscovery.reason ?? legacyContainerDiscovery.reason;
    const tabSequence = ["all", "online", "offline"];
    const tabResults = [];
    let previousSignature = null;
    let previousPortalCount = null;
    for (const tab of tabSequence) {
        try {
            await resetContainerScroll(page, containerSelector);
            const result = await extractTabDeviceIds(page, tab, identityIndex, containerSelector, settleMs, previousSignature, previousPortalCount);
            tabResults.push(result);
            previousSignature = result.datasetSignature;
            previousPortalCount = result.portalCount;
        }
        catch {
            tabResults.push({
                tab,
                portalCount: null,
                portalCountBefore: null,
                portalCountAfter: null,
                deviceIds: [],
                tabClicked: false,
                tabSelected: false,
                tabSelectionEvidence: emptyTabSelectionEvidence(),
                tabClickDiagnostics: emptyTabClickDiagnostics(),
                matchedLabel: null,
                clickStrategy: null,
                extractionMethod: "none",
                selectedDataPath: null,
                selectedContainer: containerSelector,
                idMatches: 0,
                uniqueNameMatches: 0,
                groupNameMatches: 0,
                unresolvedRows: 0,
                duplicateNameRows: 0,
                candidateDatasetCounts: [],
                datasetSignature: buildDatasetSignature(tab, []),
                staleDatasetRejected: false,
                expansionPasses: 0,
                expandClicks: 0,
                scrollPasses: 0,
                textsCollected: 0,
                rowSamples: [],
            });
        }
    }
    let allIds = tabResults.find((t) => t.tab === "all")?.deviceIds ?? [];
    let onlineIds = tabResults.find((t) => t.tab === "online")?.deviceIds ?? [];
    let offlineIds = tabResults.find((t) => t.tab === "offline")?.deviceIds ?? [];
    const tabSnapshots = tabResults.map((result) => ({
        tab: result.tab,
        portalCountBefore: result.portalCountBefore,
        portalCountAfter: result.portalCountAfter,
        extractedCount: result.deviceIds.length,
        tabSelected: result.tabSelected,
        tabSelectionEvidenceSelected: result.tabSelectionEvidence.selected,
    }));
    let appStateFallback = {
        used: false,
        source: null,
        reason: null,
        debug: {},
        diagnostics: {},
    };
    let reconciliation = reconcileDomStatusSets({
        inventoryIds,
        allIds,
        onlineIds,
        offlineIds,
        portalCounts,
        tabSnapshots,
        options: {
            maxTabDelta: options.maxTabDelta,
            minInventoryOverlapPercent: options.minInventoryOverlapPercent,
        },
    });
    let validationReasons = mergeDomDiscoveryValidationReasons({
        reconciliationReasons: reconciliation.validationReasons,
        containerReason: containerDiscoveryReason,
        appStateReason: null,
    });
    if (!reconciliation.validated && options.useAppStateFallback !== false) {
        const fallback = await probeAppStateDeviceSets(page, inventoryIds);
        appStateFallback = {
            used: fallback.used,
            source: fallback.source,
            reason: fallback.reason,
            debug: fallback.debug,
            diagnostics: fallback.diagnostics,
        };
        if (fallback.allIds.length > reconciliation.allIds.length) {
            allIds = fallback.allIds;
        }
        reconciliation = reconcileDomStatusSets({
            inventoryIds,
            allIds,
            onlineIds,
            offlineIds,
            portalCounts,
            tabSnapshots,
            options: {
                maxTabDelta: options.maxTabDelta,
                minInventoryOverlapPercent: options.minInventoryOverlapPercent,
            },
        });
        validationReasons = mergeDomDiscoveryValidationReasons({
            reconciliationReasons: reconciliation.validationReasons,
            containerReason: containerDiscoveryReason,
            appStateReason: fallback.reason,
        });
    }
    if (!hasTabSelectionEvidenceForAllTabs(tabResults) && reconciliation.validated) {
        validationReasons.push("tab_selection_evidence_missing");
        reconciliation = { ...reconciliation, validated: false, validationReasons };
    }
    const failureCategory = reconciliation.validated
        ? null
        : categorizeDomExtractionFailure({
            tabResults,
            reconciliation,
            containerReason: containerDiscoveryReason,
            selectedContainer: containerSelector,
        });
    const uiDebug = buildUiDebug({
        tabResults,
        containerCandidates: identityContainerDiscovery.candidates,
        selectedContainer: containerSelector,
        duplicateNameCount: identityIndex.duplicateNameCount,
        rejectionReasons: validationReasons,
    });
    const allTabRows = tabResults.find((tab) => tab.tab === "all")?.rowSamples ?? [];
    uiDebug.statusIconInference = inferStatusIconMappings({
        rowSamples: allTabRows,
        onlineIds: new Set(onlineIds),
        offlineIds: new Set(offlineIds),
        portalCounts,
    });
    return {
        portalCounts,
        inventoryIds: [...inventoryIds].sort(),
        identityIndex,
        tabResults,
        selectedTreeContainer,
        containerDiscoveryReason,
        selectedContainerRejectedReason: legacyContainerDiscovery.selectedContainerRejectedReason,
        reconciliation: {
            ...reconciliation,
            validated: reconciliation.validated && validationReasons.length === 0,
            validationReasons,
        },
        validationReasons,
        failureCategory,
        appStateFallback,
        uiDebug,
        debug: {
            tabSequence,
            containerDiscovery: legacyContainerDiscovery.diagnostics,
            identityContainerDiscovery: identityContainerDiscovery.candidates,
            containerDiscoveryReason,
            selectedContainerRejectedReason: legacyContainerDiscovery.selectedContainerRejectedReason,
            containerCandidateCount: identityContainerDiscovery.candidates.length,
            appStateProbe: appStateFallback.diagnostics,
            totalExpansionPasses: tabResults.reduce((sum, tab) => sum + tab.expansionPasses, 0),
            totalScrollPasses: tabResults.reduce((sum, tab) => sum + tab.scrollPasses, 0),
            failureCategory,
        },
        generatedAt,
    };
}
export async function loadInventoryFromMonitorPage(page) {
    const capture = new NetworkCapture();
    capture.attach(page);
    await waitForDiscoverySignals(page, capture, 10_000, 25_000);
    const treePayload = capture.getActionCapture("querydevicestree")?.sanitizedResponse;
    if (!treePayload) {
        return {
            inventoryIds: new Set(),
            identityIndex: buildInventoryIdentityIndex([]),
        };
    }
    const records = collectBootstrapDeviceRecords(treePayload);
    return {
        inventoryIds: new Set(records.map((record) => record.sourceDeviceId)),
        identityIndex: buildInventoryIdentityIndex(records),
    };
}
export async function loadInventoryIdsFromMonitorPage(page) {
    const loaded = await loadInventoryFromMonitorPage(page);
    return loaded.inventoryIds;
}
export function buildDomFailureSummary(input) {
    const err = input.error;
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    return {
        status: "failed",
        startedAt: input.startedAt,
        finishedAt: new Date().toISOString(),
        portalCounts: null,
        extractedCounts: null,
        selectedTreeContainer: null,
        expansionPasses: 0,
        scrollPasses: 0,
        duplicateIds: [],
        onlineOfflineIntersection: [],
        unionCount: 0,
        inventoryOverlapCount: 0,
        inventoryOverlapPercentage: 0,
        missingInventoryIds: [],
        extraIds: [],
        validated: false,
        validationReasons: [message],
        failureCategory: input.failureCategory ?? "unknown",
        generatedAt: new Date().toISOString(),
        errorMessage: message,
        errorStack: stack,
    };
}
export function buildDomStatusSummary(extraction) {
    const { reconciliation } = extraction;
    const validationReasons = extraction.validationReasons;
    return {
        status: "success",
        portalCounts: extraction.portalCounts,
        extractedCounts: reconciliation.extractedCounts,
        selectedTreeContainer: extraction.selectedTreeContainer,
        selectedContainerRejectedReason: extraction.selectedContainerRejectedReason,
        expansionPasses: extraction.tabResults.reduce((sum, tab) => sum + tab.expansionPasses, 0),
        scrollPasses: extraction.tabResults.reduce((sum, tab) => sum + tab.scrollPasses, 0),
        duplicateIds: reconciliation.duplicateIds,
        onlineOfflineIntersection: reconciliation.onlineOfflineIntersection,
        unionCount: reconciliation.unionCount,
        inventoryOverlapCount: reconciliation.inventoryOverlapCount,
        inventoryOverlapPercentage: reconciliation.inventoryOverlapPercentage,
        missingInventoryIds: reconciliation.missingInventoryIds.slice(0, 100),
        extraIds: reconciliation.extraIds.slice(0, 100),
        validated: reconciliation.validated,
        validationReasons,
        failureCategory: extraction.failureCategory,
        generatedAt: extraction.generatedAt,
        tabCaptures: extraction.tabResults.map((tab) => ({
            tab: tab.tab,
            portalCount: tab.portalCount,
            portalCountBefore: tab.portalCountBefore,
            portalCountAfter: tab.portalCountAfter,
            extractedCount: tab.deviceIds.length,
            tabClicked: tab.tabClicked,
            tabSelected: tab.tabSelected,
            tabSelectionEvidence: tab.tabSelectionEvidence,
            matchedLabel: tab.matchedLabel,
            clickStrategy: tab.clickStrategy,
            extractionMethod: tab.extractionMethod,
            selectedDataPath: tab.selectedDataPath,
            selectedContainer: tab.selectedContainer,
            idMatches: tab.idMatches,
            uniqueNameMatches: tab.uniqueNameMatches,
            groupNameMatches: tab.groupNameMatches,
            unresolvedRows: tab.unresolvedRows,
            duplicateNameRows: tab.duplicateNameRows,
            candidateDatasetCounts: tab.candidateDatasetCounts,
            datasetSignature: tab.datasetSignature,
            staleDatasetRejected: tab.staleDatasetRejected,
            expansionPasses: tab.expansionPasses,
            scrollPasses: tab.scrollPasses,
        })),
        appStateFallback: extraction.appStateFallback,
        inventoryDeviceCount: extraction.inventoryIds.length,
        duplicateNameCount: extraction.identityIndex.duplicateNameCount,
        debug: extraction.debug,
    };
}
