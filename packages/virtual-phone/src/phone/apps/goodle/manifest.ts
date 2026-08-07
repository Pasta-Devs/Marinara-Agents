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

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 40) || "page";
}

export function parseResultItem(item: string) {
  const parts = item.split(" | ");
  const title = parts[0]?.trim() || item.trim() || "Untitled page";
  const url = parts[1]?.trim() || `goodle.web/${slugify(title)}`;
  const snippet = parts.slice(2).join(" | ").trim();
  return { title, url, snippet };
}

export function parsePageSection(section: string) {
  const [heading, ...rest] = section.split(" :: ");
  return rest.length
    ? { heading: heading!.trim(), body: rest.join(" :: ").trim() }
    : { heading: "", body: section.trim() };
}

export function fallbackSearchResults(query: string) {
  const normalized = query.trim().slice(0, 120);
  return normalized
    ? { title: `Results for ${normalized}`, summary: "No generated results are available right now.", items: [] as string[] }
    : { title: "Goodle Search", summary: "Enter a search query.", items: [] as string[] };
}

/**
 * Splits a section body into plain text and `[[linked]]` entities. The generator wraps two to four
 * names, places or products per section; those become links to further generated pages, which is
 * what makes the fake web feel deep rather than like a single page per search.
 */
export function parseLinkedText(body: string): Array<{ text: string; link: boolean }> {
  return body
    .split(/(\[\[[^\]]+\]\])/gu)
    .filter((part) => part.length > 0)
    .map((part) => part.startsWith("[[") && part.endsWith("]]")
      ? { text: part.slice(2, -2).trim(), link: true }
      : { text: part, link: false })
    .filter((part) => part.text.length > 0);
}

/**
 * Recognises something the user typed as an address rather than a search. A real URL must not
 * yield the real site — it opens this world's page at that address instead (see 13-goodle.md).
 */
export function looksLikeUrl(value: string) {
  const trimmed = value.trim();
  if (/\s/u.test(trimmed)) return false;
  return /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/iu.test(trimmed);
}

export function normalizeUrl(value: string) {
  return value.trim().replace(/^https?:\/\//iu, "").replace(/^www\./iu, "");
}
