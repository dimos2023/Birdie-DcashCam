import type { TabClickDiagnostics } from "../src/browser/status-dom-tabs.js";
import type { TabSelectionEvidence } from "../src/browser/status-dom-tabs.js";

export function emptyTabSelectionEvidence(): TabSelectionEvidence {
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

export function emptyTabClickDiagnostics(): TabClickDiagnostics {
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
