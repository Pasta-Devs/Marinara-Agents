// ──────────────────────────────────────────────
// Shared Logger — Pino singleton
// ──────────────────────────────────────────────
// Every module in the server package should import `logger` from here
// instead of using `console.log/warn/error` directly. This ensures
// LOG_LEVEL actually controls what gets printed.
//
// Fastify builds its own separate pino instance from a {level, transport}
// object (see app.ts) rather than importing this singleton, so
// req.log / reply.log do NOT track runtime LOG_LEVEL changes applied here
// by the env-watcher hot-reload.
// ──────────────────────────────────────────────
import pino from "pino";
import { getLogLevel, getNodeEnv } from "../config/runtime-config.js";

export const logger = pino({
  level: getLogLevel(),
  transport: getNodeEnv() !== "production" ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});

export function logDebugOverride(overrideEnabled: boolean, message: string, ...args: any[]) {
  if (overrideEnabled && !logger.isLevelEnabled("debug")) {
    // Default LOG_LEVEL is warn, so explicit UI debug mode must log at warn to be visible.
    logger.warn(message, ...args);
    return;
  }

  logger.debug(message, ...args);
}
