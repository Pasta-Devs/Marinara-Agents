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
  if (modelUse === "none") return "Instant · no generation";
  if (modelUse === "light") return "Quick generation";
  return "Rich world generation";
}

export function privacyLabel(manifest: AppManifest) {
  const ownership = new Set(manifest.records.map((record) => record.ownership));
  if (ownership.has("participant-shared")) return "Shared with the people involved";
  if (ownership.has("story-shared")) return "Shared across this story";
  if (ownership.has("permissioned-private")) return "Private unless access is granted";
  if (ownership.has("phone-local")) return "Saved only on this phone";
  return "Does not keep its own records";
}

export function storyImpactLabel(manifest: AppManifest) {
  const tiers = new Set(manifest.actions.map((action) => action.tier));
  if (tiers.has("story")) return "Can create events the story remembers";
  if (tiers.has("participant")) return "Acts with other people in the story";
  if (tiers.has("ambient")) return "Reads the world when you ask";
  return "Stays on the phone until you share it";
}

const capabilityLabels: Partial<Record<AppManifest["capabilities"][number], string>> = {
  "storage.local": "Saves information on this phone",
  "context.read": "Can read the current story when you ask it to",
  notify: "Can send phone notifications",
  "share.screen": "Can show its current screen in the conversation",
  "story.write": "Can create actions or events in the story",
  "net.search": "Can search the fictional world's web",
  participants: "Can interact with characters in the conversation",
};

export function capabilitySummary(manifest: AppManifest) {
  const labels = manifest.capabilities.map((capability) => capabilityLabels[capability]).filter((label): label is string => Boolean(label));
  return labels.length ? labels : ["No additional access"];
}

/**
 * What each app actually does, for the App Store detail page. Manifests carry a name and a
 * category; neither tells you whether Tindler is a dating app or a fire-lighting utility.
 */
export const appDescriptions: Record<string, string> = {
  settings: "Appearance, screen condition, and which model connections this phone generates with.",
  "app-store": "Find, install, open, and remove apps made for this phone.",
  calls: "Place and receive story calls with configured characters, with a real shared call session.",
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
  bazaar: "Local person-to-person classifieds. Message sellers, haggle, buy used things, or list your own.",
  banking: "A balance that follows this persona across chats, with a transaction history. The story proposes what moved; you approve, reject, or set the number yourself.",
  game: "A private match-three game with saved progress, hints, and high scores.",
  shop: "Retail shopping from established stores, with receipts, tracked orders, and deliveries that arrive in the story.",
  maps: "Privately preview places and routes from this world, then explicitly show or reference one in the scene.",
  find: "Check locations that contacts shared or the story already established. Find does not guess.",
};

export function appDescription(appId: string) {
  return appDescriptions[appId] ?? "";
}
