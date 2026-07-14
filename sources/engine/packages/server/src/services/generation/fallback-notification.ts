import { AsyncLocalStorage } from "node:async_hooks";

export type GenerationFallbackCategory = "main" | "agents" | "illustrator" | "video";

export type GenerationFallbackNotice = {
  category: GenerationFallbackCategory;
  connectionId: string;
  connectionName: string;
  model: string;
};

export type GenerationFallbackNotifier = (notice: GenerationFallbackNotice) => void | Promise<void>;

export const GENERATION_FALLBACK_HEADER = "X-Marinara-Fallback-Used";

const fallbackNotifierContext = new AsyncLocalStorage<GenerationFallbackNotifier>();

export function runWithGenerationFallbackNotifier<T>(notifier: GenerationFallbackNotifier, callback: () => T): T {
  return fallbackNotifierContext.run(notifier, callback);
}

export async function notifyGenerationFallback(notice: GenerationFallbackNotice): Promise<void> {
  await fallbackNotifierContext.getStore()?.(notice);
}

export function encodeGenerationFallbackNotice(notice: GenerationFallbackNotice): string {
  return encodeURIComponent(JSON.stringify(notice));
}
