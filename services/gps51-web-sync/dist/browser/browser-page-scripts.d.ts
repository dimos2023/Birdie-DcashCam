/**
 * Browser-side scripts as string literals.
 * Never pass TypeScript/JavaScript function callbacks to page.evaluate — tsx/esbuild
 * injects a __name helper that does not exist in the browser context.
 */
export declare function buildWebSocketSendScript(frameJson: string): string;
export declare function assertBrowserScriptSafe(script: string): void;
export declare function parsePortalStatusCountsFromText(text: string): {
    all: number | null;
    online: number | null;
    offline: number | null;
};
