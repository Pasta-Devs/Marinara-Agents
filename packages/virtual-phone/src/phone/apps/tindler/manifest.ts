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
    { id: "preferences", path: "/preferences", title: "Discovery settings" },
  ],
  records: [
    { type: "dating-profile", ownership: "phone-local" },
    { type: "dating-preferences", ownership: "permissioned-private" },
    { type: "mutual-match", ownership: "participant-shared" },
  ],
  actions: [
    { id: "pass", tier: "local", immediate: true },
    { id: "like", tier: "participant", immediate: true },
    { id: "remove-match", tier: "local", immediate: true },
  ],
  content: { deck: { fields: { profiles: "string[]" } }, matches: { fields: { profile: "string", contactPhoneId: "string?" } } },
  notifications: { tier: "participant", dedupeBy: "mutual-match" },
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
