import type { AppManifest } from "../../platform/app-manifest";

export const goodleManifest: AppManifest = {
  id: "goodle",
  name: "Goodle",
  version: "1.0.0",
  icon: "search",
  category: "web",
  capabilities: ["storage.local", "context.read", "net.search"],
  modelUse: "heavy",
  removable: true,
  routes: [
    { id: "search", path: "/", title: "Goodle Search" },
    { id: "results", path: "/search", title: "Search results" },
  ],
  records: [{ type: "search-history", ownership: "phone-local" }],
  actions: [{ id: "search", tier: "local", immediate: true }],
  content: {
    search: {},
    results: { fields: { title: "string", summary: "string", items: "string[]" } },
  },
  notifications: null,
};

export function parseResultItem(item: string) {
  const parts = item.split(" | ");
  const title = parts[0]?.trim() || item.trim() || "Untitled page";
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 40) || "page";
  const url = parts[1]?.trim() || `goodle.web/${slug}`;
  const snippet = parts.slice(2).join(" | ").trim();
  return { title, url, snippet };
}

export function fallbackSearchResults(query: string) {
  const normalized = query.trim().slice(0, 120);
  return normalized
    ? { title: `Results for ${normalized}`, summary: "No generated results are available right now.", items: [] as string[] }
    : { title: "Goodle Search", summary: "Enter a search query.", items: [] as string[] };
}
