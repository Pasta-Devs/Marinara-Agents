import type { AppManifest } from "../../platform/app-manifest";

export const findManifest: AppManifest = {
  id: "find",
  name: "Find",
  version: "1.0.0",
  icon: "find",
  category: "utilities",
  capabilities: ["context.read", "story.write"],
  modelUse: "heavy",
  removable: true,
  routes: [{ id: "people", path: "/", title: "Find" }],
  records: [],
  actions: [{ id: "locate", tier: "ambient" }, { id: "note-location", tier: "story" }],
  content: { people: { fields: { people: "string[]" } } },
  notifications: null,
};

export type FoundPerson = { name: string; place: string; status: string };
export function parseFound(line: string): FoundPerson {
  const [name, place, ...status] = line.split(" | ");
  return { name: name?.trim() || "Someone", place: place?.trim() || "Unknown", status: status.join(" | ").trim() || "" };
}
