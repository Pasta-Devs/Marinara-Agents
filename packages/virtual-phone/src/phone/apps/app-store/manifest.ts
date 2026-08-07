import type { AppManifest } from "../../platform/app-manifest";

export const appStoreManifest: AppManifest = {
  id: "app-store",
  name: "App Store",
  version: "1.0.0",
  icon: "store",
  category: "system",
  capabilities: ["storage.local"],
  modelUse: "none",
  removable: false,
  routes: [
    { id: "root", path: "/", title: "App Store" },
    { id: "detail", path: "/apps/:appId", title: "App details" },
  ],
  records: [],
  actions: [
    { id: "install-app", tier: "local", immediate: true },
    { id: "remove-app", tier: "local", immediate: false },
  ],
  content: { root: {}, detail: {} },
  notifications: null,
};

export function modelUseLabel(modelUse: AppManifest["modelUse"]) {
  if (modelUse === "none") return "Works without a model";
  if (modelUse === "light") return "Uses the model lightly";
  return "Model-heavy";
}

/**
 * What each app actually does, for the App Store detail page. Manifests carry a name and a
 * category; neither tells you whether Tindler is a dating app or a fire-lighting utility.
 */
export const appDescriptions: Record<string, string> = {
  settings: "Appearance, screen condition, and which model connections this phone generates with.",
  "app-store": "Install and remove the apps on this phone.",
  goodle: "Search this world's web and read the pages it invents, following links as you go.",
  messages: "Texts with anyone else in this chat who has a phone, and the story's own conversations.",
  notes: "Private notes. Nothing written here leaves the phone.",
  noodler: "The world's public timeline: short posts from the cast and from strangers.",
  contacts: "Everyone this phone can reach, with bios and a way into their conversation.",
  mail: "The owner's inbox — newsletters, notices, spam, and the occasional real letter.",
  gallery: "Photos from this story, plus anything taken with the Camera.",
  tindler: "Dating profiles of people who live in this world. Swipe, match, and talk.",
  "noodler-r": "Creator pages with subscriber-only posts, for the cast and for strangers.",
  camera: "Point at the story and take a photo. You can edit what it saw before keeping it.",
};

export function appDescription(appId: string) {
  return appDescriptions[appId] ?? "";
}
