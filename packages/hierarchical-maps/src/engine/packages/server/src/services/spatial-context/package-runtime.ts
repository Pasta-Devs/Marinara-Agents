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
let resolveAgentSettings: ((agentType: string) => Promise<unknown>) | null = null;
let writeAgentSettings: ((agentType: string, settings: Record<string, unknown>) => Promise<unknown>) | null = null;
let agentSettingsUpdateQueue = Promise.resolve();

function getRuntimeHost(): CapabilityRuntimeHost {
  if (!runtimeHost) throw new Error("Hierarchical Maps runtime is not configured");
  return runtimeHost;
}

export function configurePackageRuntime(
  host: CapabilityRuntimeHost,
  agentSettingsResolver: (agentType: string) => Promise<unknown>,
  agentSettingsWriter: (agentType: string, settings: Record<string, unknown>) => Promise<unknown>,
): () => void {
  const registration = ++runtimeRegistration;
  runtimeHost = host;
  resolveAgentSettings = agentSettingsResolver;
  writeAgentSettings = agentSettingsWriter;
  agentSettingsUpdateQueue = Promise.resolve();
  return () => {
    if (runtimeRegistration !== registration) return;
    runtimeHost = null;
    resolveAgentSettings = null;
    writeAgentSettings = null;
    agentSettingsUpdateQueue = Promise.resolve();
  };
}

export async function updatePackageAgentSettings(
  agentType: string,
  update: (settings: Record<string, unknown>) => Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!writeAgentSettings) throw new Error("Hierarchical Maps agent settings are not writable");
  const writer = writeAgentSettings;
  const operation = agentSettingsUpdateQueue.then(async () => {
    const current = await getPackageAgentSettings(agentType);
    const value = await writer(agentType, update(current));
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value !== "string") return {};
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  });
  agentSettingsUpdateQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

export async function getPackageAgentSettings(agentType: string): Promise<Record<string, unknown>> {
  if (!resolveAgentSettings) throw new Error("Hierarchical Maps agent settings are unavailable");
  const value = await resolveAgentSettings(agentType);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
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
