/**
 * The in-story web used to be one template: a heading, a nav, and a stack of "Heading :: body"
 * sections, with two special cases hidden inside the renderer. Every address in the world looked
 * the same, which is what made it read as generated text rather than as a web.
 *
 * A site kind is picked from the address before anything is generated — the shape of a URL says a
 * lot about what lives there — and the model fills that template's fields. The model may correct
 * the guess, but only to another kind in this registry, so the renderer always has a template it
 * knows how to draw.
 */

export type SiteKind =
  | "news" | "shop" | "forum" | "wiki" | "profile"
  | "blog" | "directory" | "official" | "video";

export interface SiteTemplate {
  id: SiteKind;
  label: string;
  /** What the model is told each section means for this kind. */
  sectionFormat: string;
  /** How many sections suit this layout. */
  sections: [number, number];
  /** Whether the template draws a lead image box. */
  hero: boolean;
  /** Emoji used for media placeholders when the page gives no better hint. */
  glyph: string;
}

export const SITE_TEMPLATES: Record<SiteKind, SiteTemplate> = {
  news: {
    id: "news", label: "News", hero: true, glyph: "📰", sections: [3, 5],
    sectionFormat: "'Paragraph heading :: paragraph text'. Write it as a news article: the first section is the lede.",
  },
  shop: {
    id: "shop", label: "Shop", hero: true, glyph: "🛍️", sections: [4, 6],
    sectionFormat: "'Product name :: price :: short description'. One product per section, price with a currency symbol.",
  },
  forum: {
    id: "forum", label: "Forum", hero: false, glyph: "💬", sections: [4, 6],
    sectionFormat: "'Poster handle :: post text'. The first section is the original post, the rest are replies arguing, helping, or derailing.",
  },
  wiki: {
    id: "wiki", label: "Reference", hero: true, glyph: "📚", sections: [4, 6],
    sectionFormat: "'Section heading :: encyclopedic paragraph'. Neutral, factual tone about this world.",
  },
  profile: {
    id: "profile", label: "Profile", hero: true, glyph: "👤", sections: [3, 5],
    sectionFormat: "'Heading :: body'. An about-page for a person or organisation: who they are, what they do, history, contact.",
  },
  blog: {
    id: "blog", label: "Blog", hero: false, glyph: "✍️", sections: [3, 5],
    sectionFormat: "'Post title :: date :: opening paragraph'. A list of posts, newest first, in one person's voice.",
  },
  directory: {
    id: "directory", label: "Listings", hero: false, glyph: "📍", sections: [4, 6],
    sectionFormat: "'Place or business name :: rating and category :: one-line description'. A local listings page.",
  },
  official: {
    id: "official", label: "Official", hero: false, glyph: "🏛️", sections: [3, 5],
    sectionFormat: "'Heading :: body'. Formal and bureaucratic: notices, procedures, opening hours, who to contact.",
  },
  video: {
    id: "video", label: "Video", hero: false, glyph: "▶️", sections: [4, 6],
    sectionFormat: "'Video title :: duration like 12:04 :: channel name and view count'. A video listing page.",
  },
};

export const SITE_KINDS = Object.keys(SITE_TEMPLATES) as SiteKind[];

export function normalizeSiteKind(value: unknown, fallback: SiteKind = "official"): SiteKind {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw in SITE_TEMPLATES) return raw as SiteKind;
  // The model reaches for near-misses more often than for nonsense.
  const aliases: Record<string, SiteKind> = {
    article: "news", newspaper: "news", magazine: "news", press: "news",
    store: "shop", shopping: "shop", product: "shop", ecommerce: "shop", marketplace: "shop",
    board: "forum", thread: "forum", discussion: "forum", community: "forum", reddit: "forum",
    encyclopedia: "wiki", reference: "wiki", wikipedia: "wiki",
    about: "profile", person: "profile", company: "profile", portfolio: "profile", social: "profile",
    posts: "blog", journal: "blog", diary: "blog", substack: "blog",
    listings: "directory", local: "directory", reviews: "directory", map: "directory", yelp: "directory",
    government: "official", gov: "official", corporate: "official", legal: "official", bank: "official",
    videos: "video", stream: "video", youtube: "video", tv: "video",
  };
  return aliases[raw] ?? fallback;
}

const KIND_HINTS: Array<[SiteKind, RegExp]> = [
  ["video", /\b(video|watch|tube|stream|clip|channel|episode)\b/u],
  ["forum", /\b(forum|thread|board|discuss|community|reddit|topic|r\/)\b/u],
  ["wiki", /\b(wiki|encyclopedia|pedia|reference|lore|codex|history-of)\b/u],
  ["shop", /\b(shop|store|buy|cart|product|price|catalog|order|deal)\b/u],
  ["news", /\b(news|times|post|herald|gazette|daily|tribune|report|press|article|breaking)\b/u],
  ["directory", /\b(listings?|directory|places|near|map|reviews?|guide|yelp|hours)\b/u],
  ["blog", /\b(blog|posts?|journal|diary|substack|column|notes)\b/u],
  ["profile", /\b(about|profile|team|staff|bio|who-we-are|@)\b/u],
  ["official", /\b(gov|govt|official|council|ministry|department|bureau|police|hospital|bank|support|policy|terms)\b/u],
];

/**
 * What kind of place an address looks like, before a word of it has been generated. Deliberately a
 * plain heuristic over the URL, page title and the search that found it: it costs nothing, it is
 * stable across regenerations of the same address, and being occasionally wrong is survivable
 * because the model may correct it.
 */
export function guessSiteKind(url: string, title = "", query = ""): SiteKind {
  const haystack = `${url} ${title} ${query}`.toLowerCase().replace(/[_/.-]+/gu, " ");
  for (const [kind, pattern] of KIND_HINTS) {
    if (pattern.test(haystack)) return kind;
  }
  // A bare domain with no path is usually a company's front door.
  return /^[^/]+\/?$/u.test(url.trim()) ? "profile" : "official";
}

/** A section is "a :: b :: c"; what b and c mean is the template's business. */
export function parsePageSection(section: string) {
  const parts = section.split(" :: ").map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length <= 1) return { heading: "", meta: "", body: section.trim(), parts };
  return {
    heading: parts[0]!,
    meta: parts.length > 2 ? parts[1]! : "",
    body: parts.length > 2 ? parts.slice(2).join(" :: ") : parts.slice(1).join(" :: "),
    parts,
  };
}

/**
 * Media on a page is "emoji | caption" and renders as a grey box with the emoji in it. Real images
 * need an Engine capability the package does not have yet, and a labelled placeholder that admits
 * what it is beats both a broken image and a page with no pictures at all.
 */
export function parseMediaItem(item: string, fallbackGlyph = "🖼️") {
  const [first, ...rest] = item.split(" | ");
  const head = (first ?? "").trim();
  const caption = rest.join(" | ").trim();
  // A leading emoji is the format; anything else is treated as the caption.
  const isGlyph = head.length <= 4 && !/[a-z0-9]/iu.test(head);
  return {
    glyph: isGlyph && head ? head : fallbackGlyph,
    caption: (isGlyph ? caption : [head, caption].filter(Boolean).join(" ")) || "Image",
  };
}

/** An image search result: "emoji | caption | site.web/path". */
export function parseImageResult(item: string) {
  const parts = item.split(" | ").map((part) => part.trim());
  const { glyph, caption } = parseMediaItem(parts.slice(0, 2).join(" | "));
  const source = parts[2] ?? "";
  return { glyph, caption, source: source || "goodle.web/images", title: caption };
}
