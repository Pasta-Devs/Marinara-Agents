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

export function fallbackSearchResults(query: string) {
  const normalized = query.trim().slice(0, 120);
  return normalized
    ? { title: `Results for ${normalized}`, summary: "No generated results are available right now.", items: [] as string[] }
    : { title: "Goodle Search", summary: "Enter a search query.", items: [] as string[] };
}
