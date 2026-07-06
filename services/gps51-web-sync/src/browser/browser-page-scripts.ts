/**
 * Browser-side scripts as string literals.
 * Never pass TypeScript/JavaScript function callbacks to page.evaluate — tsx/esbuild
 * injects a __name helper that does not exist in the browser context.
 */

export function buildWebSocketSendScript(frameJson: string): string {
  return `
(function() {
  var json = ${frameJson};
  var text = JSON.stringify(json);
  var candidates = [];
  var key;
  for (key in window) {
    if (!Object.prototype.hasOwnProperty.call(window, key)) continue;
    try {
      var val = window[key];
      if (val instanceof WebSocket && val.readyState === WebSocket.OPEN) {
        candidates.push(val);
      }
    } catch (e) {}
  }
  if (candidates.length === 0) return false;
  var i;
  for (i = 0; i < candidates.length; i++) {
    try {
      candidates[i].send(text);
    } catch (e) {
      return false;
    }
  }
  return true;
})()
`.trim();
}

export function assertBrowserScriptSafe(script: string): void {
  if (script.includes("__name")) {
    throw new Error("Browser script must not reference __name (tsx/esbuild artifact)");
  }
}

export function parsePortalStatusCountsFromText(text: string): {
  all: number | null;
  online: number | null;
  offline: number | null;
} {
  const parse = (label: string): number | null => {
    const match = text.match(new RegExp(`${label}\\s*\\(?\\s*(\\d+)\\s*\\)?`, "i"));
    return match ? Number(match[1]) : null;
  };
  return {
    all: parse("All devices") ?? parse("All"),
    online: parse("Online"),
    offline: parse("Offline"),
  };
}
