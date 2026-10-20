// Host overlay for lib/logger.ts (Pasta-Devs/Marinara-Agents#1487): package logs go through the Engine's
// logger (api.runtime.logger), so LOG_LEVEL, the log file and shutdown flushing are the Engine's. The
// vendored copy started its own Pino instance and pino-pretty worker per package.
import { hostLog, hostLogLevelEnabled, type HostLogLevel } from "./host-runtime.js";

type LogMethod = (...args: unknown[]) => void;

export const logger: {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
  isLevelEnabled(level: HostLogLevel): boolean;
} = Object.freeze({
  // The runtime logger has no trace or fatal; they land on the nearest level it has.
  trace: (...args: unknown[]) => hostLog("debug", args),
  debug: (...args: unknown[]) => hostLog("debug", args),
  info: (...args: unknown[]) => hostLog("info", args),
  warn: (...args: unknown[]) => hostLog("warn", args),
  error: (...args: unknown[]) => hostLog("error", args),
  fatal: (...args: unknown[]) => hostLog("error", args),
  isLevelEnabled: (level: HostLogLevel) => hostLogLevelEnabled(level),
});

/** Explicit UI debug mode: the Engine logs the message even when LOG_LEVEL hides debug lines. */
export function logDebugOverride(overrideEnabled: boolean, message: string, ...args: unknown[]): void {
  hostLog("debugOverride", [overrideEnabled, message, ...args]);
}
