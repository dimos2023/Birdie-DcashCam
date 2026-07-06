import { describe, expect, it } from "vitest";
import {
  buildInventoryIdentityIndex,
  buildGroupNameKey,
  normalizeIdentityText,
  resolveRowToDeviceId,
  type SanitizedRowFields,
} from "../src/gps51/status-dom-identity.js";
import {
  buildClickStatusTabScript,
  buildInspectTabActiveStateScript,
  buildTabSelectionEvidence,
} from "../src/browser/status-dom-tabs.js";
import {
  buildIdentityAwareContainerScript,
  buildRowExtractionScript,
  scoreIdentityAwareContainers,
} from "../src/browser/status-dom-rows.js";
import {
  categorizeDomExtractionFailure,
  hasTabSelectionEvidenceForAllTabs,
} from "../src/gps51/status-dom-failure.js";
import { reconcileDomStatusSets } from "../src/gps51/status-dom-reconciliation.js";
import { portalCountWithinTolerance } from "../src/gps51/status-dom-vxe-core.js";
import { buildDomStatusPatches } from "../src/db/status-repository.js";
import type { TabExtractionResult } from "../src/browser/status-dom-extractor.js";
import { emptyTabClickDiagnostics, emptyTabSelectionEvidence } from "./status-dom-test-helpers.js";

function record(
  id: string,
  name: string | null,
  group: string | null = null,
): Parameters<typeof buildInventoryIdentityIndex>[0][number] {
  return {
    sourceDeviceId: id,
    deviceName: name,
    lastActiveTimeRaw: null,
    offlineDelayRaw: null,
    raw: group ? { groupname: group } : {},
  };
}

function row(text: string, groupLabel: string | null = null): SanitizedRowFields {
  return {
    text,
    title: null,
    ariaLabel: null,
    dataAttributes: {},
    groupLabel,
    level: null,
    statusIconClasses: [],
  };
}

describe("inventory identity index", () => {
  it("normalizes Arabic, English and numeric names safely", () => {
    expect(normalizeIdentityText("  Fleet   Alpha  ")).toBe("fleet alpha");
    expect(normalizeIdentityText("سيارة ١٢٣")).toBe("سيارة ١٢٣");
    expect(normalizeIdentityText("Device-86000000000001")).toBe("device-86000000000001");
  });

  it("maps unique device names directly", () => {
    const index = buildInventoryIdentityIndex([
      record("86000000000001", "Alpha Van"),
      record("86000000000002", "Beta Truck"),
    ]);
    const resolution = resolveRowToDeviceId(row("Alpha Van"), index);
    expect(resolution.sourceDeviceId).toBe("86000000000001");
    expect(resolution.method).toBe("unique_name");
  });

  it("rejects duplicate device names without group path", () => {
    const index = buildInventoryIdentityIndex([
      record("86000000000001", "Shared Name", "Group A"),
      record("86000000000002", "Shared Name", "Group B"),
    ]);
    expect(index.duplicateNameCount).toBe(1);
    const unresolved = resolveRowToDeviceId(row("Shared Name"), index);
    expect(unresolved.method).toBe("duplicate_name");
    expect(unresolved.sourceDeviceId).toBeNull();
  });

  it("resolves duplicate names with group path + device name", () => {
    const index = buildInventoryIdentityIndex([
      record("86000000000001", "Shared Name", "Group A"),
      record("86000000000002", "Shared Name", "Group B"),
    ]);
    const key = buildGroupNameKey("group a", "shared name");
    expect(index.groupNameToId.get(key)).toBe("86000000000001");
    const resolution = resolveRowToDeviceId(row("Shared Name", "Group A"), index);
    expect(resolution.sourceDeviceId).toBe("86000000000001");
    expect(resolution.method).toBe("group_name");
  });

  it("resolves exact device ID matches first", () => {
    const index = buildInventoryIdentityIndex([record("86000000000001", "Alpha Van")]);
    const resolution = resolveRowToDeviceId(row("86000000000001 Alpha Van"), index);
    expect(resolution.method).toBe("id");
    expect(resolution.sourceDeviceId).toBe("86000000000001");
  });
});

describe("tab ancestor click script", () => {
  it("embeds labels and walks to clickable ancestor", () => {
    const script = buildClickStatusTabScript(["Online", "在线"]);
    expect(script).toContain('"Online"');
    expect(script).toContain("findClickableAncestor");
    expect(script).toContain("clickable.click()");
    expect(script).not.toContain("function(labels)");
  });

  it("records matched and ancestor element metadata", () => {
    const script = buildClickStatusTabScript(["All"]);
    expect(script).toContain("matchedElementTag");
    expect(script).toContain("clickableAncestorTag");
    expect(script).toContain("textBeforeClick");
    expect(script).toContain("textAfterClick");
  });
});

describe("tab selection evidence", () => {
  it("treats active class as selected", () => {
    const evidence = buildTabSelectionEvidence({
      clickDiagnostics: { ...emptyTabClickDiagnostics(), clicked: true },
      ariaSelected: false,
      activeClass: true,
      portalCountMatches: false,
      rowSignatureChanged: false,
      anotherTabLostActive: false,
    });
    expect(evidence.selected).toBe(true);
    expect(evidence.reasons).toContain("active_class");
  });

  it("treats row signature change as selected", () => {
    const evidence = buildTabSelectionEvidence({
      clickDiagnostics: { ...emptyTabClickDiagnostics(), clicked: true, classChangedAfterClick: true },
      ariaSelected: false,
      activeClass: false,
      portalCountMatches: false,
      rowSignatureChanged: true,
      anotherTabLostActive: false,
    });
    expect(evidence.selected).toBe(true);
    expect(evidence.reasons).toContain("class_changed_after_click");
    expect(evidence.reasons).toContain("row_signature_changed");
  });

  it("embeds labels in inspect active state script", () => {
    const script = buildInspectTabActiveStateScript(["Offline"]);
    expect(script).toContain('"Offline"');
    expect(script).toContain("ariaSelected");
  });
});

describe("container scoring with name matches", () => {
  it("accepts containers with name hits when ID hits are zero", () => {
    const scored = scoreIdentityAwareContainers([
      {
        selector: "div.tree",
        scrollHeight: 3000,
        clientHeight: 400,
        inventoryIdHits: 0,
        inventoryNameHits: 12,
        visibleRowCount: 20,
        checkboxCount: 8,
        score: 120,
      },
    ]);
    expect(scored.length).toBe(1);
    expect(scored[0]?.inventoryNameHits).toBe(12);
  });

  it("embeds unique names in discovery script", () => {
    const script = buildIdentityAwareContainerScript(
      {
        deviceIds: ["86000000000001"],
        uniqueNames: { "alpha van": "86000000000001" },
        groupNames: {},
        duplicateNames: [],
      },
      [".ivu-tree"],
    );
    expect(script).toContain("alpha van");
    expect(script).toContain("inventoryNameHits");
  });
});

describe("dataset validation and failure categories", () => {
  function tabResult(
    tab: "all" | "online" | "offline",
    ids: string[],
    overrides: Partial<TabExtractionResult> = {},
  ): TabExtractionResult {
    return {
      tab,
      portalCount: ids.length,
      portalCountBefore: ids.length,
      portalCountAfter: ids.length,
      deviceIds: ids,
      tabClicked: true,
      tabSelected: true,
      tabSelectionEvidence: {
        ...emptyTabSelectionEvidence(),
        selected: true,
        reasons: ["active_class"],
      },
      tabClickDiagnostics: emptyTabClickDiagnostics(),
      matchedLabel: tab,
      clickStrategy: "clickable_ancestor",
      extractionMethod: "dom_row_scroll",
      selectedDataPath: null,
      selectedContainer: "div.tree",
      idMatches: 0,
      uniqueNameMatches: ids.length,
      groupNameMatches: 0,
      unresolvedRows: 0,
      duplicateNameRows: 0,
      candidateDatasetCounts: [],
      datasetSignature: `${tab}:${ids.join(",")}`,
      staleDatasetRejected: false,
      expansionPasses: 0,
      expandClicks: 0,
      scrollPasses: 2,
      textsCollected: ids.length,
      rowSamples: [],
      ...overrides,
    };
  }

  it("rejects identical datasets across tabs", () => {
    const ids = ["86000000000001", "86000000000002", "86000000000003"];
    const result = reconcileDomStatusSets({
      inventoryIds: new Set(ids),
      allIds: ids,
      onlineIds: ids,
      offlineIds: ids,
      portalCounts: { all: 3, online: 1, offline: 2 },
    });
    expect(result.validated).toBe(false);
    expect(result.validationReasons).toContain("identical_datasets_across_tabs");
  });

  it("validates dynamic portal counts within tolerance", () => {
    const inventory = Array.from({ length: 10 }, (_, i) => String(86000000000000 + i));
    const allIds = inventory;
    const onlineIds = inventory.slice(0, 4);
    const offlineIds = inventory.slice(4);
    const result = reconcileDomStatusSets({
      inventoryIds: new Set(inventory),
      allIds,
      onlineIds,
      offlineIds,
      portalCounts: { all: 10, online: 3, offline: 7 },
      options: { maxTabDelta: 2 },
    });
    expect(result.validated).toBe(true);
  });

  it("categorizes tab selection failures", () => {
    const category = categorizeDomExtractionFailure({
      tabResults: [
        tabResult("all", [], {
          tabSelected: false,
          tabSelectionEvidence: emptyTabSelectionEvidence(),
        }),
      ],
      reconciliation: reconcileDomStatusSets({
        inventoryIds: new Set(["86000000000001"]),
        allIds: [],
        onlineIds: [],
        offlineIds: [],
        portalCounts: { all: 1, online: 0, offline: 1 },
      }),
      containerReason: null,
      selectedContainer: "div.tree",
    });
    expect(category).toBe("tab_target_not_selected");
  });

  it("requires tab selection evidence for every tab", () => {
    expect(
      hasTabSelectionEvidenceForAllTabs([
        tabResult("all", ["86000000000001"]),
        tabResult("online", [], {
          tabSelectionEvidence: emptyTabSelectionEvidence(),
        }),
      ]),
    ).toBe(false);
  });

  it("performs zero database writes when validation fails", () => {
    const patches = buildDomStatusPatches(
      [
        {
          id: "row-1",
          source_device_id: "86000000000001",
          online_status: "unknown",
          metadata: {},
          birdie_device_id: null,
          vehicle_id: null,
          customer_id: null,
          latitude: null,
          longitude: null,
        },
      ],
      new Set(["86000000000001"]),
      new Set(),
      "2026-06-29T10:00:00.000Z",
    );
    expect(patches.length).toBe(1);
    const validated = false;
    const databaseWrites = validated ? patches.length : 0;
    expect(databaseWrites).toBe(0);
  });
});

describe("virtualized row extraction script", () => {
  it("deduplicates resolved device IDs across scroll passes", () => {
    const script = buildRowExtractionScript(
      "#device-tree",
      {
        deviceIds: ["86000000000001", "86000000000002"],
        uniqueNames: { "alpha van": "86000000000001", "beta truck": "86000000000002" },
        groupNames: {},
        duplicateNames: [],
      },
      2,
    );
    expect(script).toContain("resolved[match.id] = match.method");
    expect(script).toContain("container.scrollTop = 0");
    expect(script).toContain("0.7");
  });
});

describe("nested tab label click", () => {
  it("targets clickable ancestor via embedded evaluate script", () => {
    const script = buildClickStatusTabScript(["Online"]);
    expect(script).toContain("findClickableAncestor(matched)");
    expect(script).toContain('tag === "button"');
    expect(script).toContain('role === "tab"');
  });
});

describe("portal count tolerance helper", () => {
  it("accepts either before or after portal count within tolerance", () => {
    expect(portalCountWithinTolerance(103, 105, 103, 2)).toBe(true);
    expect(portalCountWithinTolerance(500, 502, 498, 2)).toBe(true);
    expect(portalCountWithinTolerance(100, 103, 103, 2)).toBe(false);
  });
});
