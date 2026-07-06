import { describe, expect, it } from "vitest";
import {
  buildSessionStorageInitScript,
  sessionStorageHasAuthHints,
} from "../src/auth/session-storage.js";
import {
  loadStatusSourceValidation,
  StatusBootstrapError,
} from "../src/worker/status-bootstrap.js";
import { reconcileDeviceSets } from "../src/browser/status-dom-collector.js";
import {
  validateStatusSourceDiscovery,
} from "../src/gps51/status-source-analyzer.js";
import { resolveStatusPrecedence } from "../src/db/status-repository.js";
import { redactSecrets } from "../src/browser/redaction.js";
import { calibrateStatusRule, collectBootstrapDeviceRecords } from "../src/gps51/status-bootstrap-parser.js";

describe("auth lifecycle helpers", () => {
  it("builds sessionStorage init script without logging secret values", () => {
    const script = buildSessionStorageInitScript({
      authToken: "secret-token-value",
      userId: "12345",
    });
    expect(script).toContain("sessionStorage.setItem");
    expect(script).toContain("secret-token-value");
    expect(script).not.toContain("__name");
  });

  it("detects auth-like sessionStorage keys without exposing values", () => {
    expect(sessionStorageHasAuthHints({ authToken: "x", theme: "dark" })).toBe(true);
    expect(sessionStorageHasAuthHints({ theme: "dark" })).toBe(false);
  });

  it("standalone auth defaults to closeOnSuccess true in options type", () => {
    const options = { closeOnSuccess: true as const };
    expect(options.closeOnSuccess).toBe(true);
  });

  it("embedded auth uses closeOnSuccess false", () => {
    const options = { closeOnSuccess: false as const };
    expect(options.closeOnSuccess).toBe(false);
  });
});

describe("status bootstrap guards", () => {
  const failedTree = {
    groups: [
      {
        devices: Array.from({ length: 20 }, (_, i) => ({
          deviceid: `860000000000${String(i).padStart(3, "0")}`,
          lastactivetime: 1_700_000_000_000,
          offlinedelay: 600,
        })),
      },
    ],
  };

  it("rejects failed timestamp calibration (selectedRule null)", () => {
    const records = collectBootstrapDeviceRecords(failedTree);
    const calibration = calibrateStatusRule(
      records,
      { online: 113, offline: 492 },
      600,
      5,
      Date.parse("2026-06-29T12:00:00.000Z"),
    );
    expect(calibration.selectedRule).toBeNull();
    expect(calibration.calculatedCounts.online).toBe(0);
    expect(calibration.mismatchCount).toBeGreaterThan(5);
  });

  it("loadStatusSourceValidation returns false when summary missing", () => {
    const result = loadStatusSourceValidation("/nonexistent/capture/dir");
    expect(result.validated).toBe(false);
  });

  it("production guard error type is StatusBootstrapError", () => {
    const err = new StatusBootstrapError("blocked");
    expect(err.name).toBe("StatusBootstrapError");
  });
});

describe("status source discovery reconciliation", () => {
  const inventory = new Set(
    Array.from({ length: 605 }, (_, i) => `860000000000${String(i).padStart(3, "0")}`),
  );

  it("reconciles online/offline device sets", () => {
    const onlineIds = [...inventory].slice(0, 113);
    const offlineIds = [...inventory].slice(113);
    const result = reconcileDeviceSets({
      inventoryIds: inventory,
      onlineIds,
      offlineIds,
      allIds: [...inventory],
    });
    expect(result.onlineCount).toBe(113);
    expect(result.offlineCount).toBe(492);
    expect(result.missingInventory).toHaveLength(0);
    expect(result.overlapInventoryPercent).toBe(100);
  });

  it("detects duplicate and missing inventory IDs", () => {
    const onlineIds = ["860000000000001", "860000000000001", "860000000000002"];
    const result = reconcileDeviceSets({
      inventoryIds: new Set(["860000000000001", "860000000000003"]),
      onlineIds,
      offlineIds: [],
      allIds: onlineIds,
    });
    expect(result.duplicateOnline).toEqual(["860000000000001"]);
    expect(result.missingInventory).toContain("860000000000003");
  });

  it("validates portal counts within tolerance", () => {
    const validation = validateStatusSourceDiscovery({
      portalCounts: { all: 605, online: 113, offline: 492 },
      inventoryCount: 605,
      onlineIds: Array.from({ length: 113 }, (_, i) => `id-online-${i}`),
      offlineIds: Array.from({ length: 492 }, (_, i) => `id-offline-${i}`),
      allIds: Array.from({ length: 605 }, (_, i) => `id-${i}`),
      inventoryOverlapPercent: 95,
      maxPortalDelta: 5,
    });
    expect(validation.validated).toBe(true);
    expect(validation.recommendedRule).toBe("portal_tab_membership");
  });

  it("rejects validation when portal mismatch exceeds tolerance", () => {
    const validation = validateStatusSourceDiscovery({
      portalCounts: { all: 605, online: 113, offline: 492 },
      inventoryCount: 605,
      onlineIds: ["a"],
      offlineIds: ["b"],
      allIds: ["a", "b"],
      inventoryOverlapPercent: 0,
      maxPortalDelta: 5,
    });
    expect(validation.validated).toBe(false);
    expect(validation.reasons.length).toBeGreaterThan(0);
  });
});

describe("status precedence and redaction", () => {
  it("gives WebSocket positionLast immediate Online precedence", () => {
    expect(
      resolveStatusPrecedence({
        websocketPositionJustReceived: true,
        treeStatus: "offline",
        hasTreeSnapshot: true,
      }),
    ).toBe("online");
  });

  it("uses tree snapshot when no websocket position", () => {
    expect(
      resolveStatusPrecedence({
        websocketPositionJustReceived: false,
        treeStatus: "offline",
        hasTreeSnapshot: true,
      }),
    ).toBe("offline");
  });

  it("redacts secrets from captured payloads", () => {
    const sanitized = redactSecrets({
      token: "abc123",
      deviceid: "860000000000001",
      nested: { authorization: "Bearer secret" },
    }) as Record<string, unknown>;
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.deviceid).toBe("860000000000001");
    expect((sanitized.nested as Record<string, unknown>).authorization).toBe("[REDACTED]");
  });
});
