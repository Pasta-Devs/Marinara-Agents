import { nanoid } from "nanoid";
import type {
  CapabilityJsonHost,
  CapabilityLanguageModelHost,
  CapabilityPersistenceHost,
  CapabilityResourceHost,
  CapabilityRuntimeHost,
  CapabilityRuntimeLogArgument,
  CapabilityRuntimeLogger,
} from "@marinara-engine/shared";

let lastSortableTimestamp = 0;
let sortableSequence = 0;
let runtimeHost: CapabilityRuntimeHost | null = null;
let runtimeRegistration = 0;

function getRuntimeHost(): CapabilityRuntimeHost {
  if (!runtimeHost) throw new Error("Hierarchical Maps runtime is not configured");
  return runtimeHost;
}

export function configurePackageRuntime(host: CapabilityRuntimeHost): () => void {
  const registration = ++runtimeRegistration;
  runtimeHost = host;
  return () => {
    if (runtimeRegistration === registration) runtimeHost = null;
  };
}

export const logger: CapabilityRuntimeLogger = {
  debug: (message: string, ...args: CapabilityRuntimeLogArgument[]) => getRuntimeHost().logger.debug(message, ...args),
  info: (message: string, ...args: CapabilityRuntimeLogArgument[]) => getRuntimeHost().logger.info(message, ...args),
  warn: (message: string, ...args: CapabilityRuntimeLogArgument[]) => getRuntimeHost().logger.warn(message, ...args),
  error: (error: unknown, message: string, ...args: CapabilityRuntimeLogArgument[]) =>
    getRuntimeHost().logger.error(error, message, ...args),
  debugOverride: (overrideEnabled: boolean, message: string, ...args: CapabilityRuntimeLogArgument[]) =>
    getRuntimeHost().logger.debugOverride(overrideEnabled, message, ...args),
};

export function isDebugAgentsEnabled(): boolean {
  return getRuntimeHost().isDebugAgentsEnabled();
}

export function getPackagePersistence(): CapabilityPersistenceHost {
  return getRuntimeHost().persistence;
}

export function getPackageResources(): CapabilityResourceHost {
  return getRuntimeHost().resources;
}

export function getPackageLanguageModels(): CapabilityLanguageModelHost {
  return getRuntimeHost().languageModels;
}

export function getPackageJson(): CapabilityJsonHost {
  return getRuntimeHost().json;
}

export function logDebugOverride(
  overrideEnabled: boolean,
  message: string,
  ...args: CapabilityRuntimeLogArgument[]
): void {
  logger.debugOverride(overrideEnabled, message, ...args);
}

/** Generate an opaque package-owned record ID. */
export function newId(): string {
  return nanoid();
}

/** Generate a package-owned ID whose lexical order follows creation order. */
export function newTimeSortableId(): string {
  const timestamp = Date.now();
  if (timestamp === lastSortableTimestamp) sortableSequence += 1;
  else {
    lastSortableTimestamp = timestamp;
    sortableSequence = 0;
  }
  return `${timestamp.toString(36).padStart(10, "0")}${sortableSequence.toString(36).padStart(4, "0")}${nanoid(7)}`;
}

export function now(): string {
  return new Date().toISOString();
}
