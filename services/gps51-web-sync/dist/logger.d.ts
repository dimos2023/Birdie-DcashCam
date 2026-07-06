import pino from "pino";
import type { AppConfig } from "./config.js";
export declare function createLogger(config: AppConfig): pino.Logger<never, boolean>;
export type Logger = ReturnType<typeof createLogger>;
