export { storageStateExists, ensureAuthDirs, restrictStorageStatePermissions, isReauthRequired, runAuthBootstrap, persistAuthArtifacts, waitForAuthSuccess, } from "./bootstrap.js";
export { ensureAuthenticatedPage, createAuthenticatedContext, type AuthenticatedBrowserSession, type EnsureAuthenticatedOptions, } from "./authenticated-page.js";
export { loadSessionStorageSnapshot, buildSessionStorageInitScript, applySessionStorageInitScript, captureSessionStorage, persistSessionStorage, sessionStorageExists, sessionStorageHasAuthHints, resolveSessionStoragePath, } from "./session-storage.js";
