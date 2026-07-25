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
let resolveAgentConfig: ((agentType: string) => Promise<unknown>) | null = null;
let writeAgentConfig:
  | ((agentType: string, patch: Record<string, unknown>) => Promise<unknown>)
  | null = null;
let agentConfigUpdateQueue = Promise.resolve();

function getRuntimeHost(): CapabilityRuntimeHost {
  if (!runtimeHost) throw new Error("Hierarchical Maps runtime is not configured");
  return runtimeHost;
}

export function configurePackageRuntime(
  host: CapabilityRuntimeHost,
  agentConfigResolver: (agentType: string) => Promise<unknown>,
  agentConfigWriter: (agentType: string, patch: Record<string, unknown>) => Promise<unknown>,
): () => void {
  const registration = ++runtimeRegistration;
  runtimeHost = host;
  resolveAgentConfig = agentConfigResolver;
  writeAgentConfig = agentConfigWriter;
  agentConfigUpdateQueue = Promise.resolve();
  return () => {
    if (runtimeRegistration !== registration) return;
    runtimeHost = null;
    resolveAgentConfig = null;
    writeAgentConfig = null;
    agentConfigUpdateQueue = Promise.resolve();
  };
}

async function getPackageAgentConfig(agentType: string): Promise<Record<string, unknown>> {
  if (!resolveAgentConfig) throw new Error("Hierarchical Maps agent configuration is unavailable");
  const value = await resolveAgentConfig(agentType);
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getPackageAgentConnectionId(agentType: string): Promise<string | null> {
  const config = await getPackageAgentConfig(agentType);
  return typeof config.connectionId === "string" && config.connectionId.trim()
    ? config.connectionId.trim()
    : null;
}

export async function updatePackageAgentSettings(
  agentType: string,
  update: (settings: Record<string, unknown>) => Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!writeAgentConfig) throw new Error("Hierarchical Maps agent settings are not writable");
  const writer = writeAgentConfig;
  const operation = agentConfigUpdateQueue.then(async () => {
    const current = await getPackageAgentSettings(agentType);
    const saved = await writer(agentType, { settings: update(current) });
    const config =
      saved && typeof saved === "object" && !Array.isArray(saved)
        ? (saved as Record<string, unknown>)
        : {};
    return parseAgentSettings(config.settings);
  });
  agentConfigUpdateQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

export async function updatePackageAgentConfiguration(
  agentType: string,
  patch: {
    description: string;
    phase: "pre_generation";
    connectionId: string | null;
    settings: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  if (!writeAgentConfig) throw new Error("Hierarchical Maps agent configuration is not writable");
  const writer = writeAgentConfig;
  const operation = agentConfigUpdateQueue.then(async () => {
    const currentSettings = await getPackageAgentSettings(agentType);
    const saved = await writer(agentType, {
      description: patch.description,
      phase: patch.phase,
      connectionId: patch.connectionId,
      settings: {
        ...currentSettings,
        ...patch.settings,
      },
    });
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? (saved as Record<string, unknown>)
      : {};
  });
  agentConfigUpdateQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

function parseAgentSettings(value: unknown): Record<string, unknown> {
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

export async function getPackageAgentSettings(agentType: string): Promise<Record<string, unknown>> {
  const config = await getPackageAgentConfig(agentType);
  return parseAgentSettings(config.settings);
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
