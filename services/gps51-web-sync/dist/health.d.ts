import Fastify from "fastify";
import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
export declare function createHealthServer(config: AppConfig, log: Logger): Fastify.FastifyInstance<import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault> & PromiseLike<Fastify.FastifyInstance<import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault>> & {
    __linterBrands: "SafePromiseLike";
};
