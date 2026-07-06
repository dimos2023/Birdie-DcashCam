import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig, validateWorkerConfig, ensureCaptureDir } from "../config.js";
import { createLogger } from "../logger.js";
import { launchBrowser } from "./create-browser.js";
import { createAuthenticatedContext, isReauthRequired } from "../auth/session.js";
import { NetworkCapture, waitForDiscoverySignals } from "./network-capture.js";
import { SubscriptionFrameCapture } from "./subscription-frame-capture.js";
import { clickTab, readPortalStatusCounts, selectOneDeviceCheckbox, subscribeViaMonitorUi, } from "./monitor-subscription.js";
const OBSERVE_MS = 15_000;
const isMain = process.argv[1]?.includes("subscription-discovery");
async function observe(page, ms) {
    await page.waitForTimeout(ms);
}
function frameTotals(actions) {
    let outgoingFrameCount = 0;
    let incomingFrameCount = 0;
    let selectedHint = null;
    for (const action of actions) {
        outgoingFrameCount += action.outgoingFrames.length;
        incomingFrameCount += action.incomingFrames.length;
        if (action.selectedDeviceCountHint != null) {
            selectedHint = action.selectedDeviceCountHint;
        }
    }
    return { outgoingFrameCount, incomingFrameCount, selectedHint };
}
function writeDiscoverySummary(captureDir, summary) {
    writeFileSync(path.join(captureDir, "subscription-summary.json"), JSON.stringify(summary, null, 2));
}
function writeOutgoingFrames(captureDir, actions) {
    writeFileSync(path.join(captureDir, "subscription-outgoing-frames.json"), JSON.stringify(actions.map((a) => ({
        action: a.action,
        outgoing: a.outgoingFrames,
        incomingPositionLast: a.incomingFrames.filter((f) => f.kind === "positionLast").length,
    })), null, 2));
}
export async function runSubscriptionDiscovery() {
    const config = loadConfig(process.env);
    validateWorkerConfig(config);
    ensureCaptureDir(config);
    const log = createLogger(config);
    const startedAt = new Date().toISOString();
    const actions = [];
    const browser = await launchBrowser(config, { forceHeadless: false });
    const context = await createAuthenticatedContext(config, browser);
    const page = await context.newPage();
    const inventoryCapture = new NetworkCapture();
    inventoryCapture.attach(page);
    const frameCapture = new SubscriptionFrameCapture();
    const detachFrames = frameCapture.attach(page);
    try {
        log.info("Opening GPS51 monitor for subscription discovery (headed)");
        await page.goto(config.monitorUrl, {
            waitUntil: "domcontentloaded",
            timeout: config.SYNC_REQUEST_TIMEOUT_MS,
        });
        if (await isReauthRequired(page)) {
            throw new Error("Session expired — run npm run auth again");
        }
        await waitForDiscoverySignals(page, inventoryCapture, 10_000, 20_000);
        await observe(page, 3000);
        frameCapture.beginAction();
        const oneSelected = await selectOneDeviceCheckbox(page);
        await observe(page, OBSERVE_MS);
        actions.push(frameCapture.snapshotAction("select_one_device", oneSelected ? 1 : null));
        frameCapture.beginAction();
        await clickTab(page, ["Default", "Default group"]);
        await observe(page, OBSERVE_MS);
        actions.push(frameCapture.snapshotAction("select_default_group", null));
        frameCapture.beginAction();
        const allSelected = await subscribeViaMonitorUi(page, log);
        await observe(page, OBSERVE_MS);
        actions.push(frameCapture.snapshotAction("select_all_devices", allSelected));
        frameCapture.beginAction();
        await clickTab(page, ["Online", "Online devices"]);
        await observe(page, OBSERVE_MS);
        actions.push(frameCapture.snapshotAction("switch_online_tab", null));
        const portalCounts = await readPortalStatusCounts(page);
        const recommended = pickRecommendedSubscriptionFrame(actions);
        const totals = frameTotals(actions);
        const summary = {
            status: "success",
            startedAt,
            finishedAt: new Date().toISOString(),
            selectedHint: totals.selectedHint,
            outgoingFrameCount: totals.outgoingFrameCount,
            incomingFrameCount: totals.incomingFrameCount,
            errorMessage: null,
            websocketSocketsSeen: frameCapture.getOpenSocketCount(),
            portalCounts,
            actions: actions.map((a) => ({
                action: a.action,
                outgoingFrameCount: a.outgoingFrames.length,
                incomingFrameCount: a.incomingFrames.length,
                positionLastCount: a.positionLastCount,
                selectedDeviceCountHint: a.selectedDeviceCountHint,
                topOutgoingKinds: summarizeKinds(a.outgoingFrames),
            })),
            recommendedAction: recommended?.action ?? null,
            recommendedFrame: recommended?.frame ?? null,
            deviceIdField: recommended?.deviceIdField ?? "deviceids",
            note: "Outgoing frames are sanitized. Use recommendedFrame for GPS51_SUBSCRIBE_ALL websocket batches when validated.",
        };
        writeDiscoverySummary(config.captureDir, summary);
        writeOutgoingFrames(config.captureDir, actions);
        printSummary(summary);
    }
    catch (err) {
        const totals = frameTotals(actions);
        const errorMessage = err instanceof Error ? err.message : String(err);
        writeDiscoverySummary(config.captureDir, {
            status: "error",
            startedAt,
            finishedAt: new Date().toISOString(),
            selectedHint: totals.selectedHint,
            outgoingFrameCount: totals.outgoingFrameCount,
            incomingFrameCount: totals.incomingFrameCount,
            errorMessage,
        });
        log.error({ err: errorMessage }, "Subscription discovery failed");
        throw err;
    }
    finally {
        detachFrames();
        await context.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
    }
}
function summarizeKinds(frames) {
    const counts = {};
    for (const frame of frames) {
        counts[frame.kind] = (counts[frame.kind] ?? 0) + 1;
    }
    return counts;
}
function pickRecommendedSubscriptionFrame(actions) {
    const ranked = [...actions].sort((a, b) => b.positionLastCount - a.positionLastCount);
    for (const action of ranked) {
        const outgoing = action.outgoingFrames.find((f) => f.kind === "other" && typeof f.payload === "object");
        if (!outgoing || typeof outgoing.payload !== "object" || outgoing.payload == null)
            continue;
        const payload = outgoing.payload;
        const deviceIdField = ["deviceids", "deviceIds", "ids", "devicelist", "devices"].find((k) => k in payload) ??
            "deviceids";
        return { action: action.action, frame: payload, deviceIdField };
    }
    return null;
}
function printSummary(summary) {
    console.log("\n--- GPS51 Subscription Discovery ---");
    console.log(JSON.stringify(summary, null, 2));
    console.log("Files written to data/captures/");
    console.log("------------------------------------\n");
}
if (isMain) {
    runSubscriptionDiscovery()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
