import type { AppManifest } from "../../platform/app-manifest";

export const mapsManifest: AppManifest = {
  id: "maps",
  name: "Maps",
  version: "1.0.0",
  icon: "maps",
  category: "travel",
  capabilities: ["context.read", "story.write"],
  modelUse: "heavy",
  removable: true,
  routes: [{ id: "map", path: "/", title: "Maps" }],
  records: [],
  actions: [{ id: "search", tier: "ambient" }, { id: "route", tier: "story" }],
  content: { places: { fields: { places: "string[]" } } },
  notifications: null,
};

export type MapPlace = { name: string; category: string; detail: string };
export function parsePlace(line: string): MapPlace {
  const [name, category, ...detail] = line.split(" | ");
  return { name: name?.trim() || "A place", category: category?.trim().toLowerCase() || "place", detail: detail.join(" | ").trim() || "" };
}
