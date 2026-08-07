import type { AppManifest } from "../../platform/app-manifest";

export const galleryManifest: AppManifest = {
  id: "gallery",
  name: "Gallery",
  version: "1.0.0",
  icon: "gallery",
  category: "media",
  capabilities: ["context.read"],
  modelUse: "none",
  removable: true,
  routes: [
    { id: "grid", path: "/", title: "Gallery" },
    { id: "photo", path: "/photo", title: "Photo" },
  ],
  records: [],
  actions: [{ id: "refresh-gallery", tier: "ambient" }],
  content: { grid: {}, photo: {} },
  notifications: null,
};

export function extractImageUrls(content: string): string[] {
  const urls = new Set<string>();
  for (const match of content.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/gu)) urls.add(match[1]!);
  for (const match of content.matchAll(/(?:https?:\/\/|\/)[^\s"'()<>\]]+\.(?:png|jpe?g|webp|gif)/giu)) urls.add(match[0]!);
  return [...urls];
}
