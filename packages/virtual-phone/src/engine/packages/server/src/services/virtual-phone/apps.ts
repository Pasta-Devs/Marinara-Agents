// ──────────────────────────────────────────────
// Virtual Phone — app catalog
//
// The App Store is this list. "Installing" an app only decides whether its icon
// sits on the home screen; every app is generated on demand, so nothing is
// downloaded and nothing is executed. App pages render through the stable
// route templates in templates.ts, with the model filling content slots.
// ──────────────────────────────────────────────

export type PhoneApp = {
  /** Stable id, also the home-screen and App Store key. */
  id: string;
  name: string;
  /** Home-screen glyph. Kept to one emoji so no icon assets ship. */
  icon: string;
  /** In-universe domain the app opens. */
  domain: string;
  description: string;
  /** Shared rendering framework used before the model fills page content. */
  framework?: "social" | "utility" | "media" | "commerce" | "community";
  /** Stable App Store grouping used by the OS catalog and generation prompts. */
  storeCategory?: "social" | "productivity" | "entertainment" | "finance" | "shopping" | "reference";
  /** Short authoring brief so generated content fits this app's role. */
  contentGuidance?: string;
  /** Preinstalled on a fresh phone. */
  preinstalled?: boolean;
  /**
   * Adult-oriented. Never preinstalled, and labelled in the App Store. The gate
   * itself is the app's own in-universe age screen, matching how the Engine's
   * own Noodler works; there is no chat-level adult flag to key off.
   */
  adult?: boolean;
};

export const PHONE_APPS: readonly PhoneApp[] = [
  {
    id: "noodle",
    name: "Noodle",
    icon: "🍜",
    domain: "noodle.social",
    description: "The public feed everyone in the story argues on.",
    preinstalled: true,
    storeCategory: "social",
    contentGuidance: "A public social feed with posts, replies, profiles, reactions, trends, notifications, and direct messages.",
  },
  {
    id: "noodler",
    name: "Noodler",
    icon: "🌶️",
    domain: "noodler.social",
    description: "Noodle's age-gated creator platform. Subscriptions, tips, locked posts.",
    adult: true,
    storeCategory: "social",
    contentGuidance: "An age-gated creator platform with adult creators, subscriptions, tips, locked media, discovery, and private messages. Respect the established content level.",
  },
  {
    id: "search",
    name: "Search",
    icon: "🔍",
    domain: "search.web",
    description: "Look anything up in the story world.",
    preinstalled: true,
    framework: "utility",
    storeCategory: "reference",
    contentGuidance: "A story-world search engine with query results, snippets, related searches, and useful links.",
  },
  {
    id: "maps",
    name: "Maps",
    icon: "🗺️",
    domain: "maps.web",
    description: "Where things are, and how far.",
    preinstalled: true,
    framework: "utility",
    storeCategory: "reference",
    contentGuidance: "A map and place browser with locations, routes, distances, addresses, and local details.",
  },
  {
    id: "messages",
    name: "Messages",
    icon: "💬",
    domain: "messages.phone",
    description: "Texts with characters in the scene.",
    preinstalled: true,
    framework: "social",
    storeCategory: "social",
    contentGuidance: "A private messaging app with conversation rows, message threads, unread counts, and believable short previews.",
  },
  {
    id: "gallery",
    name: "Gallery",
    icon: "🖼️",
    domain: "gallery.phone",
    description: "Photos the persona has taken.",
    preinstalled: true,
    framework: "media",
    storeCategory: "entertainment",
    contentGuidance: "A personal photo library with albums, captions, dates, people, and image descriptions.",
  },
  {
    id: "notes",
    name: "Notes",
    icon: "📝",
    domain: "notes.phone",
    description: "Scraps, lists, and things worth remembering.",
    framework: "utility",
    storeCategory: "productivity",
    contentGuidance: "A private notes app with titles, snippets, tags, dates, and detail pages.",
  },
  {
    id: "wallet",
    name: "Wallet",
    icon: "💳",
    domain: "wallet.phone",
    description: "Balance, recent charges, and regrettable purchases.",
    framework: "commerce",
    storeCategory: "finance",
    contentGuidance: "A private wallet with balance, recent transactions, payment cards, and cautious financial language.",
  },
  {
    id: "news",
    name: "News",
    icon: "📰",
    domain: "news.web",
    description: "What the world thinks is happening.",
    framework: "community",
    storeCategory: "reference",
    contentGuidance: "A news reader with headlines, sections, article summaries, timestamps, and source names.",
  },
  {
    id: "video",
    name: "Video",
    icon: "▶️",
    domain: "video.web",
    description: "Clips, channels, and comment sections.",
    framework: "media",
    storeCategory: "entertainment",
    contentGuidance: "A video platform with channels, clips, thumbnails described in text, views, comments, and watch history.",
  },
  {
    id: "music",
    name: "Music",
    icon: "🎵",
    domain: "music.web",
    description: "Playlists that say too much about the listener.",
    framework: "media",
    storeCategory: "entertainment",
    contentGuidance: "A music player with tracks, albums, artists, playlists, queue state, and listening history.",
  },
  {
    id: "forum",
    name: "Forum",
    icon: "🗣️",
    domain: "forum.web",
    description: "Threaded posts from people with strong opinions.",
    framework: "community",
    storeCategory: "social",
    contentGuidance: "A threaded community forum with boards, posts, replies, votes, usernames, and moderation context.",
  },
  {
    id: "shop",
    name: "Shop",
    icon: "📦",
    domain: "shop.web",
    description: "Listings, reviews, and next-day delivery.",
    framework: "commerce",
    storeCategory: "shopping",
    contentGuidance: "A shopping site with product listings, prices, sellers, ratings, availability, cart, and order details.",
  },
  {
    id: "weather",
    name: "Weather",
    icon: "🌦️",
    domain: "weather.phone",
    description: "Forecast for wherever the scene is set.",
    framework: "utility",
    storeCategory: "reference",
    contentGuidance: "A weather app with current conditions, hourly forecast, daily forecast, alerts, and location context.",
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: "📅",
    domain: "calendar.phone",
    description: "Plans, appointments, and suspiciously vague reminders.",
    framework: "utility",
    storeCategory: "productivity",
    contentGuidance: "A calendar with events, dates, times, locations, attendees, reminders, and schedule conflicts.",
  },
  {
    id: "mail",
    name: "Mail",
    icon: "✉️",
    domain: "mail.phone",
    description: "Inbox messages from people and places in the story.",
    framework: "social",
    storeCategory: "productivity",
    contentGuidance: "An inbox with senders, subjects, unread state, timestamps, short previews, and message detail pages.",
  },
  {
    id: "recipes",
    name: "Recipes",
    icon: "🍳",
    domain: "recipes.web",
    description: "Recipes, ratings, and arguments about substitutions.",
    framework: "community",
    storeCategory: "reference",
    contentGuidance: "A recipe community with recipes, ingredients, steps, cook time, ratings, substitutions, and comments.",
  },
];

const APPS_BY_ID = new Map(PHONE_APPS.map((app) => [app.id, app]));

export function findApp(appId: string): PhoneApp | null {
  return APPS_BY_ID.get(appId) ?? null;
}

/** Resolve an in-frame URL back to the app that owns its domain. */
export function findAppByUrl(url: string): PhoneApp | null {
  let hostname: string;
  try {
    hostname = new URL(url, "https://phone.local").hostname.toLowerCase();
  } catch {
    return null;
  }
  return (
    PHONE_APPS.find((app) => hostname === app.domain || hostname.endsWith(`.${app.domain}`)) ?? null
  );
}

export function defaultInstalledApps(): string[] {
  return PHONE_APPS.filter((app) => app.preinstalled).map((app) => app.id);
}

/** Every app is listed; adult ones are simply never preinstalled. */
export function listApps(): readonly PhoneApp[] {
  return PHONE_APPS;
}
