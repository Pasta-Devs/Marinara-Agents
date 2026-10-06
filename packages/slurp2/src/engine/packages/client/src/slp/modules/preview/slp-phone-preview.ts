/**
 * Opening day (docs/OPENING-DAY.md, "What each answer does to the phone"): the owner's answers →
 * a plain description of the small phone on the stage. Pure, so every answer's effect runs in a
 * test. The view names locale keys, never text: captions, comments, ads and names are fixed sample
 * copy. An answer that is still open renders a neutral default.
 */

export type SlpPhonePreviewInput = {
  /** false: the empty state "No Creators yet". */
  creators: boolean;
  /** Mari's first post is locked. */
  locked: boolean;
  pace?: "manual" | "occasional" | "lively" | "veryActive" | "grows";
  pictures?: "yes" | "no";
  spice?: "clean" | "flirty" | "suggestive" | "explicit";
  /** hinted = stage names. */
  names?: "hinted" | "open";
  nights?: "yes" | "no";
  fans?: "warm" | "mixed" | "unfiltered";
  size?: "intimate" | "normal" | "large";
  drama?: "none" | "sometimes" | "bringIt";
  ads?: "none" | "few" | "lots";
  adTone?: "normal" | "unhinged";
  pullStrings?: "fair" | "platform";
  connectionName?: string;
  imageConnectionName?: string;
};

/** Where a change shows. `SlpPhonePreview` glows every element of the region. */
export type SlpPhoneRegion =
  | "chip"
  | "moon"
  | "gossip"
  | "feed"
  | "names"
  | "picture"
  | "caption"
  | "comment"
  | "likes"
  | "ads"
  | "footer"
  | "stir";

export type SlpPhonePost = {
  kind: "post";
  /** Index into `SLP_PHONE_CREATORS`; 0 is Mari. */
  creator: number;
  nameKey: string;
  /** 0 = "now". */
  ageHours: number;
  locked: boolean;
  picture: boolean;
  /** The locked blur follows the spice. */
  blur: "soft" | "medium" | "strong";
  captionKey: string;
  comment: { nameKey: string; textKey: string } | null;
  likes: number;
  comments: number;
};

export type SlpPhoneSponsored = {
  kind: "sponsored";
  variant: 1 | 2;
  tone: "normal" | "unhinged";
  brandKey: string;
  textKey: string;
};

export type SlpPhoneFeedItem = SlpPhonePost | SlpPhoneSponsored;

export type SlpPhonePreviewView = {
  top: {
    /** "Opening soon" until the size is answered, then "{{fans}} fans". */
    chipKey: string;
    fans: number | null;
    moon: boolean;
  };
  /** The empty state's two lines, or null once a Creator moved in. */
  empty: { titleKey: string; bodyKey: string } | null;
  gossip: { level: "light" | "loud"; textKey: string; creators: [number, number] } | null;
  items: SlpPhoneFeedItem[];
  /** "Posts when you ask" under the feed (pace manual). */
  hintKey: string | null;
  footer: { key: string; name: string }[];
  stirBadge: boolean;
};

/** Mari, then three sample Creators. Mari's avatar and pictures are Engine sprites. */
export const SLP_PHONE_CREATORS = ["mari", "lila", "thunder", "ribbit"] as const;

const POSTS = { manual: 1, occasional: 2, lively: 3, veryActive: 4, grows: 3 } as const;
const ADS = { none: 0, few: 1, lots: 2 } as const;
const FANS = { intimate: 312, normal: 12_400, large: 1_200_000 } as const;
const LIKES = { intimate: 17, normal: 1_200, large: 48_000 } as const;
const BLUR = { clean: "soft", flirty: "soft", suggestive: "medium", explicit: "strong" } as const;

/** The answer a `changed` key names → the region that glows. */
export const SLP_PHONE_REGIONS: Record<string, SlpPhoneRegion> = {
  creators: "feed",
  locked: "picture",
  pace: "feed",
  pictures: "feed",
  spice: "caption",
  names: "names",
  nights: "moon",
  fans: "comment",
  size: "chip",
  drama: "gossip",
  ads: "ads",
  adTone: "ads",
  pullStrings: "stir",
  connection: "footer",
  imageConnection: "footer",
};

export function slpPhoneCreatorNameKey(creator: number, names: SlpPhonePreviewInput["names"]) {
  return `ui.slurp.opening.preview.creator.${SLP_PHONE_CREATORS[creator % SLP_PHONE_CREATORS.length]}.${names === "hinted" ? "stage" : "own"}`;
}

export function slpPhonePreview(input: SlpPhonePreviewInput): SlpPhonePreviewView {
  const size = input.size ?? "normal";
  const footer: SlpPhonePreviewView["footer"] = [];
  if (input.connectionName) footer.push({ key: `ui.slurp.opening.preview.writtenBy`, name: input.connectionName });
  if (input.imageConnectionName && input.pictures !== "no")
    footer.push({ key: `ui.slurp.opening.preview.picturesBy`, name: input.imageConnectionName });
  const top = {
    chipKey: input.size ? `ui.slurp.opening.preview.fans` : `ui.slurp.opening.preview.soon`,
    fans: input.size ? FANS[input.size] : null,
    moon: input.nights === "yes",
  };
  const stirBadge = input.pullStrings === "platform";
  if (!input.creators)
    return {
      top,
      empty: { titleKey: `ui.slurp.opening.preview.empty.title`, bodyKey: `ui.slurp.opening.preview.empty.body` },
      gossip: null,
      items: [],
      hintKey: null,
      footer,
      stirBadge,
    };

  const posts = input.pace ? POSTS[input.pace] : 1;
  const ads = input.ads ? ADS[input.ads] : 0;
  const tone = input.adTone ?? "normal";
  const sponsored = (variant: 1 | 2): SlpPhoneSponsored => ({
    kind: "sponsored",
    variant,
    tone,
    brandKey: `ui.slurp.opening.preview.ad.${variant}.brand`,
    textKey: `ui.slurp.opening.preview.ad.${variant}.${tone}`,
  });
  const items: SlpPhoneFeedItem[] = [];
  for (let i = 0; i < posts; i++) {
    const first = i === 0;
    items.push({
      kind: "post",
      creator: i,
      nameKey: slpPhoneCreatorNameKey(i, input.names),
      ageHours: i * 2,
      locked: first && input.locked,
      picture: input.pictures !== "no",
      blur: input.spice ? BLUR[input.spice] : "medium",
      captionKey: first
        ? `ui.slurp.opening.preview.caption.mari.${input.spice ?? "default"}`
        : `ui.slurp.opening.preview.caption.${SLP_PHONE_CREATORS[i]}`,
      comment:
        first && input.fans
          ? {
              nameKey: `ui.slurp.opening.preview.comment.${input.fans}.name`,
              textKey: `ui.slurp.opening.preview.comment.${input.fans}.text`,
            }
          : null,
      likes: Math.round(LIKES[size] / (i + 1)),
      comments: input.fans ? 3 + i : 0,
    });
    // An ad after each of the first two posts.
    if (i < ads) items.push(sponsored((i + 1) as 1 | 2));
  }
  // A feed shorter than the ads still shows every ad.
  for (let v = posts + 1; v <= ads; v++) items.push(sponsored(v as 1 | 2));

  const drama = input.drama === "sometimes" ? "light" : input.drama === "bringIt" ? "loud" : null;
  return {
    top,
    empty: null,
    gossip: drama
      ? {
          level: drama,
          textKey: `ui.slurp.opening.preview.gossip.${drama}`,
          creators: drama === "loud" ? [1, 0] : [1, 2],
        }
      : null,
    items,
    hintKey: input.pace === "manual" ? `ui.slurp.opening.preview.manual` : null,
    footer,
    stirBadge,
  };
}
