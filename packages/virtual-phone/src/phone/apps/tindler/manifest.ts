import type { AppManifest } from "../../platform/app-manifest";

export const tindlerManifest: AppManifest = {
  id: "tindler",
  name: "Tindler",
  version: "1.0.0",
  icon: "tindler",
  category: "social",
  capabilities: ["storage.local", "context.read"],
  modelUse: "heavy",
  removable: true,
  routes: [
    { id: "deck", path: "/", title: "Tindler" },
    { id: "matches", path: "/matches", title: "Matches" },
  ],
  records: [{ type: "dating-profile", ownership: "phone-local" }],
  actions: [{ id: "swipe", tier: "local", immediate: true }],
  content: { deck: { fields: { profiles: "string[]" } }, matches: {} },
  notifications: null,
};

export function parseProfile(item: string) {
  const [head, ...rest] = item.split(" | ");
  const headText = head?.trim() ?? "";
  const commaIndex = headText.lastIndexOf(",");
  const age = commaIndex >= 0 ? headText.slice(commaIndex + 1).trim() : "";
  const name = (commaIndex >= 0 && /^\d+$/u.test(age) ? headText.slice(0, commaIndex) : headText).trim() || "Someone";
  return {
    name,
    age: /^\d+$/u.test(age) ? age : "",
    tagline: rest[0]?.trim() ?? "",
    bio: rest.slice(1).join(" | ").trim(),
  };
}
