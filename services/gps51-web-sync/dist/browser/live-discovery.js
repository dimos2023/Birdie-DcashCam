import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig, validateWorkerConfig, ensureCaptureDir } from "../config.js";
import { createLogger } from "../logger.js";
import { launchBrowser } from "./create-browser.js";
import { NetworkCapture, waitForDiscoverySignals } from "./network-capture.js";
import { LiveNetworkCapture, observeLiveNetwork } from "./live-network-capture.js";
import { performPeriodicLiveDiscoveryInteractions, performSafeLiveDiscoveryInteractions, } from "./safe-monitor-interactions.js";
import { createAuthenticatedContext, isReauthRequired } from "../auth/session.js";
import { parseInventoryDeviceTree } from "../gps51/device-tree-parser.js";
import { redactSecrets } from "./redaction.js";
import { analyzeLiveCandidate, analyzeQueryAlarmLiveState, buildLiveStateSummary, } from "../gps51/live-state-analyzer.js";
const MIN_OBSERVE_MS = 90_000;
const TREE_WAIT_MS = 30_000;
const INTERACTION_INTERVAL_MS = 20_000;
const isMain = process.argv[1]?.includes("live-discovery");
function writeJson(outDir, filename, data) {
    writeFileSync(path.join(outDir, filename), JSON.stringify(data, null, 2));
}
function sanitizeRecord(record) {
    return redactSecrets(record);
}
function extractInventoryIds(payload) {
    const parsed = parseInventoryDeviceTree(payload);
    return new Set(parsed.devices.map((d) => d.sourceDeviceId));
}
function splitCandidates(candidates) {
    const network = [];
    const websocket = [];
    for (const candidate of candidates) {
        if (candidate.transportType === "websocket")
            websocket.push(candidate);
        else
            network.push(candidate);
    }
    return { network, websocket };
}
export async function runLiveDiscovery() {
    const config = loadConfig(process.env);
    validateWorkerConfig(config);
    ensureCaptureDir(config);
    const log = createLogger(config);
    const startedAt = new Date().toISOString();
    const browser = await launchBrowser(config, { forceHeadless: true });
    const context = await createAuthenticatedContext(config, browser);
    const page = await context.newPage();
    const inventoryCapture = new NetworkCapture();
    inventoryCapture.attach(page);
    const liveCapture = new LiveNetworkCapture();
    liveCapture.attach(page);
    try {
        log.info({ monitor_url: config.monitorUrl }, "Opening GPS51 monitor for live-state discovery");
        await page.goto(config.monitorUrl, {
            waitUntil: "domcontentloaded",
            timeout: config.SYNC_REQUEST_TIMEOUT_MS,
        });
        if (await isReauthRequired(page)) {
            throw new Error("Session expired — run npm run auth again");
        }
        await waitForDiscoverySignals(page, inventoryCapture, TREE_WAIT_MS, TREE_WAIT_MS);
        const treeCapture = inventoryCapture.getActionCapture("querydevicestree");
        if (!treeCapture?.sanitizedResponse) {
            throw new Error("querydevicestree was not captured — cannot compute inventory overlap");
        }
        const inventoryIds = extractInventoryIds(treeCapture.sanitizedResponse);
        log.info({ inventory_devices: inventoryIds.size }, "Inventory IDs loaded from querydevicestree");
        await performSafeLiveDiscoveryInteractions(page);
        const observationStarted = Date.now();
        while (Date.now() - observationStarted < MIN_OBSERVE_MS) {
            const remaining = MIN_OBSERVE_MS - (Date.now() - observationStarted);
            const slice = Math.min(INTERACTION_INTERVAL_MS, remaining);
            await observeLiveNetwork(page, slice);
            if (Date.now() - observationStarted < MIN_OBSERVE_MS) {
                await performPeriodicLiveDiscoveryInteractions(page);
            }
        }
        const finishedAt = new Date().toISOString();
        const observationDurationMs = Date.now() - Date.parse(startedAt);
        const rawCaptures = liveCapture.getCaptures();
        const analyzed = rawCaptures.map((capture) => analyzeLiveCandidate(capture, inventoryIds, sanitizeRecord));
        const { network, websocket } = splitCandidates(analyzed);
        const alarmCapture = rawCaptures.find((c) => c.action === "queryalarm");
        const queryAlarmAnalysis = alarmCapture
            ? analyzeQueryAlarmLiveState(alarmCapture.payloads, inventoryIds, sanitizeRecord)
            : inventoryCapture.getActionCapture("queryalarm")?.sanitizedResponse
                ? analyzeQueryAlarmLiveState([inventoryCapture.getActionCapture("queryalarm").sanitizedResponse], inventoryIds, sanitizeRecord)
                : null;
        const summary = buildLiveStateSummary(inventoryIds.size, startedAt, finishedAt, observationDurationMs, network, websocket, queryAlarmAnalysis);
        const outDir = config.captureDir;
        writeJson(outDir, "live-network-candidates.json", network);
        writeJson(outDir, "live-websocket-candidates.json", websocket);
        writeJson(outDir, "live-state-summary.json", summary);
        writeJson(outDir, "live-records-sample.json", {
            inventoryDeviceCount: inventoryIds.size,
            topCandidates: summary.rankedCandidates.slice(0, 5).map((candidate) => ({
                endpointKey: candidate.endpointKey,
                action: candidate.action,
                transportType: candidate.transportType,
                rankingScore: candidate.rankingScore,
                overlapPercentage: candidate.overlapPercentage,
                sampleRecords: candidate.sampleRecords,
            })),
            queryAlarmAnalysis,
            websocketOutgoingMetadata: liveCapture.getWebSocketOutgoingMetadata(),
        });
        await page.screenshot({ path: path.join(outDir, "live-monitor.png"), fullPage: false });
        log.info({
            inventory_devices: inventoryIds.size,
            network_candidates: network.length,
            websocket_candidates: websocket.length,
            top_score: summary.rankedCandidates[0]?.rankingScore ?? null,
            validated: summary.topRecommendation?.validated ?? false,
        }, "Live-state discovery complete");
        printLiveSummary(summary, queryAlarmAnalysis);
    }
    finally {
        await context.close();
        await browser.close();
    }
}
function printLiveSummary(summary, queryAlarmAnalysis) {
    console.log("\n--- GPS51 Live-State Discovery Summary ---");
    console.log(`Inventory device IDs: ${summary.inventoryDeviceCount}`);
    console.log(`Observation duration: ${Math.round(summary.observationDurationMs / 1000)}s`);
    console.log(`Network candidates: ${summary.networkCandidateCount}`);
    console.log(`WebSocket candidates: ${summary.websocketCandidateCount}`);
    if (summary.rankedCandidates[0]) {
        const top = summary.rankedCandidates[0];
        console.log(`Top candidate: ${top.endpointKey} (score ${top.rankingScore})`);
        console.log(`  Overlap: ${top.overlapCount}/${summary.inventoryDeviceCount} (${top.overlapPercentage}%)`);
        console.log(`  Coordinates: ${top.recordsWithCoordinates}, Online: ${top.recordsWithOnlineStatus}`);
    }
    if (queryAlarmAnalysis) {
        console.log(`queryalarm: ${queryAlarmAnalysis.recordCount} records, assessment=${queryAlarmAnalysis.assessment}`);
        console.log(`  Safe for live status: ${queryAlarmAnalysis.safeForLiveStatus}`);
        console.log(`  ${queryAlarmAnalysis.reason}`);
    }
    if (summary.topRecommendation) {
        console.log(`Recommendation: ${summary.topRecommendation.note}`);
    }
    console.log("Sanitized files written to data/captures/");
    console.log("------------------------------------------\n");
}
if (isMain) {
    runLiveDiscovery()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
