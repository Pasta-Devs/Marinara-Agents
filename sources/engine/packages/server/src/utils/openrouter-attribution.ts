export const OPENROUTER_APP_REFERER = "https://github.com/Pasta-Devs/Marinara-Engine";
export const OPENROUTER_APP_TITLE = "Marinara Engine";

export function isOpenRouterApiUrl(value: string | URL): boolean {
  try {
    const hostname = (value instanceof URL ? value : new URL(value)).hostname.toLowerCase();
    return hostname === "openrouter.ai" || hostname.endsWith(".openrouter.ai");
  } catch {
    return false;
  }
}

/**
 * Attach OpenRouter's app-attribution headers only when the actual outbound
 * destination is OpenRouter. Applying this at the safe-fetch boundary covers
 * text, embeddings, media, discovery, polling, and future request paths while
 * avoiding attribution-header leakage across redirects to other origins.
 */
export function requestHeadersWithOpenRouterAttribution(
  url: string | URL,
  headersInit: RequestInit["headers"] | undefined,
): Headers | undefined {
  if (!isOpenRouterApiUrl(url)) {
    return headersInit ? new Headers(headersInit) : undefined;
  }

  const headers = new Headers(headersInit);
  headers.set("HTTP-Referer", OPENROUTER_APP_REFERER);
  headers.set("X-OpenRouter-Title", OPENROUTER_APP_TITLE);
  return headers;
}
