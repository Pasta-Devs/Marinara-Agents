// ──────────────────────────────────────────────
// Virtual Phone — app catalog
//
// The App Store is this list. "Installing" an app only decides whether its icon
// sits on the home screen; every app is generated on demand, so nothing is
// downloaded and nothing is executed. Apps with a template render through
// templates.ts; the rest are generated as full pages.
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
  /** Preinstalled on a fresh phone. */
  preinstalled?: boolean;
  /** Hidden until the chat allows adult content. */
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
  },
  {
    id: "noodler",
    name: "Noodler",
    icon: "🌶️",
    domain: "noodler.social",
    description: "Noodle's age-gated creator platform. Subscriptions, tips, locked posts.",
    adult: true,
  },
  {
    id: "search",
    name: "Search",
    icon: "🔍",
    domain: "search.web",
    description: "Look anything up in the story world.",
    preinstalled: true,
  },
  {
    id: "maps",
    name: "Maps",
    icon: "🗺️",
    domain: "maps.web",
    description: "Where things are, and how far.",
    preinstalled: true,
  },
  {
    id: "messages",
    name: "Messages",
    icon: "💬",
    domain: "messages.phone",
    description: "Texts with characters in the scene.",
    preinstalled: true,
  },
  {
    id: "gallery",
    name: "Gallery",
    icon: "🖼️",
    domain: "gallery.phone",
    description: "Photos the persona has taken.",
    preinstalled: true,
  },
  {
    id: "notes",
    name: "Notes",
    icon: "📝",
    domain: "notes.phone",
    description: "Scraps, lists, and things worth remembering.",
  },
  {
    id: "wallet",
    name: "Wallet",
    icon: "💳",
    domain: "wallet.phone",
    description: "Balance, recent charges, and regrettable purchases.",
  },
  {
    id: "news",
    name: "News",
    icon: "📰",
    domain: "news.web",
    description: "What the world thinks is happening.",
  },
  {
    id: "video",
    name: "Video",
    icon: "▶️",
    domain: "video.web",
    description: "Clips, channels, and comment sections.",
  },
  {
    id: "music",
    name: "Music",
    icon: "🎵",
    domain: "music.web",
    description: "Playlists that say too much about the listener.",
  },
  {
    id: "forum",
    name: "Forum",
    icon: "🗣️",
    domain: "forum.web",
    description: "Threaded posts from people with strong opinions.",
  },
  {
    id: "shop",
    name: "Shop",
    icon: "📦",
    domain: "shop.web",
    description: "Listings, reviews, and next-day delivery.",
  },
  {
    id: "weather",
    name: "Weather",
    icon: "🌦️",
    domain: "weather.phone",
    description: "Forecast for wherever the scene is set.",
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

/** The App Store hides adult apps unless the chat has opted in. */
export function visibleApps(allowAdult: boolean): PhoneApp[] {
  return PHONE_APPS.filter((app) => allowAdult || !app.adult);
}
