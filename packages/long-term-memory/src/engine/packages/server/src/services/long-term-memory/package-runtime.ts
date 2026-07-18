export type RuntimeLogArgument = string | number | boolean | null | undefined | object;

export type CapabilityRuntimeHost = {
  dataDir?: string;
  logger: {
    debug(message: string, ...args: RuntimeLogArgument[]): void;
    info(message: string, ...args: RuntimeLogArgument[]): void;
    warn(message: string, ...args: RuntimeLogArgument[]): void;
    error(error: unknown, message: string, ...args: RuntimeLogArgument[]): void;
  };
  persistence?: {
    dataDir?: string;
    getChat(chatId: string): Promise<{
      id: string;
      mode: string;
      characterIds: string[];
      groupId: string | null;
      metadata: unknown;
    } | null>;
  };
};

export type PackageEmbeddingAdapter = {
  label: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null>;
};

let host: CapabilityRuntimeHost | null = null;
let registration = 0;
let embeddingAdapter: PackageEmbeddingAdapter | null = null;

function currentHost() {
  if (!host) throw new Error("Long-Term Memory package runtime is not configured");
  return host;
}

export function configurePackageRuntime(next: CapabilityRuntimeHost) {
  const token = ++registration;
  host = next;
  return () => {
    if (registration === token) host = null;
  };
}

export function configurePackageEmbeddingAdapter(adapter: PackageEmbeddingAdapter | null) {
  embeddingAdapter = adapter;
}

export function getPackageEmbeddingAdapter() {
  return embeddingAdapter;
}

export function getPackageDataDir() {
  const runtime = currentHost();
  const dataDir = runtime.dataDir ?? runtime.persistence?.dataDir;
  if (!dataDir) throw new Error("Long-Term Memory runtime host did not provide dataDir");
  return dataDir;
}

export function getPackagePersistence() {
  const persistence = currentHost().persistence;
  if (!persistence) throw new Error("Long-Term Memory runtime host did not provide persistence");
  return persistence;
}

export const logger = {
  debug: (message: string, ...args: RuntimeLogArgument[]) => currentHost().logger.debug(message, ...args),
  info: (message: string, ...args: RuntimeLogArgument[]) => currentHost().logger.info(message, ...args),
  warn: (error: unknown, message?: string, ...args: RuntimeLogArgument[]) =>
    currentHost().logger.warn(message ?? "Long-Term Memory warning", error as RuntimeLogArgument, ...args),
  error: (error: unknown, message: string, ...args: RuntimeLogArgument[]) =>
    currentHost().logger.error(error, message, ...args),
};

export async function withKeyedLock<T>(
  locks: Map<string, Promise<void>>,
  key: string,
  operation: () => Promise<T>,
) {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current, () => current);
  locks.set(key, tail);
  try {
    await previous.catch(() => {});
    return await operation();
  } finally {
    release();
    if (locks.get(key) === tail) locks.delete(key);
  }
}
