import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { SyncCycleResult } from "./sync-cycle.js";

type SchedulerState = {
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  backoffMs: number;
  running: boolean;
};

const state: SchedulerState = {
  lastSyncAt: null,
  lastSyncStatus: null,
  lastError: null,
  backoffMs: 0,
  running: false,
};

export function getSchedulerState() {
  return { ...state };
}

function jitterMs(config: AppConfig): number {
  if (config.SYNC_JITTER_SECONDS <= 0) return 0;
  return Math.floor(Math.random() * config.SYNC_JITTER_SECONDS * 1000);
}

function nextBackoff(current: number): number {
  if (current === 0) return 30_000;
  return Math.min(current * 2, 15 * 60 * 1000);
}

export function startScheduler(
  config: AppConfig,
  log: Logger,
  runCycle: () => Promise<SyncCycleResult>,
): () => void {
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  const scheduleNext = (delayMs: number) => {
    if (stopped) return;
    timer = setTimeout(() => void tick(), delayMs);
  };

  const tick = async () => {
    if (stopped || state.running) {
      scheduleNext(config.SYNC_INTERVAL_SECONDS * 1000 + jitterMs(config));
      return;
    }

    state.running = true;
    try {
      const result = await runCycle();
      state.lastSyncAt = new Date().toISOString();
      state.lastSyncStatus = result.status;
      state.lastError = result.errorMessage;

      if (result.reauthRequired) {
        state.backoffMs = 15 * 60 * 1000;
        log.warn("Reauthentication required — scheduler paused with 15m backoff");
      } else if (result.status === "failed") {
        state.backoffMs = nextBackoff(state.backoffMs);
      } else {
        state.backoffMs = 0;
      }
    } catch (err) {
      state.lastSyncStatus = "failed";
      state.lastError = err instanceof Error ? err.message : "Unknown scheduler error";
      state.backoffMs = nextBackoff(state.backoffMs);
      log.error({ err: state.lastError }, "Scheduler tick failed");
    } finally {
      state.running = false;
      const base = config.SYNC_INTERVAL_SECONDS * 1000 + jitterMs(config);
      scheduleNext(base + state.backoffMs);
    }
  };

  void tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
