/**
 * Who fits whom as a couple (`slp-creator-couples.ts`): what the cards allow (a partner already, never
 * dates, aromantic, orientation) and how much chemistry two Creators have. Pure.
 */
import { SLURP_NEVER_PATTERN } from "../feed/slp-life-moments.js";
import { slpRomanceAllows } from "../../../../../shared/src/slp/slp-creator-steering.js";
import { slurpSharedNiche, type SlurpTieCreator } from "./slp-creator-ties.js";
import type { SlurpCoupleForced } from "./slp-creator-couples.js";

// Not "partners": "won't tattoo names of partners" is about work, not about dating (7b-couples measure).
const DATING_TOPIC = /\b(dat(e|es|ing)|relationships?|romance|romantic|love life|fall(s|ing)? in love)\b/iu;
/** "Never dates fans" is about fans, not about another Creator. */
const ABOUT_FANS = /\b(fans?|subscribers?|clients?|customers?|followers?|viewers?)\b/iu;
const NOT_INTO_ANYONE = /\b(aromantic|asexual)\b/iu;
const ROMANTIC =
  /\b(romantic|flirt\w*|lonely|single|looking for love|crush\w*|hopeless romantic|heart on (her|his|their) sleeve)\b/iu;

export type SlurpCoupleMisfit = "taken" | "notInto" | "noDating" | "orientation" | "romance" | "same" | "busy";

type Want = "same" | "other" | "any";

/** Who a card says they are into, when it says so. */
function orientation(text: string): Want | null {
  if (/\b(bi(sexual)?|pan(sexual)?|queer)\b/iu.test(text)) return "any";
  if (/\b(lesbian|gay|homosexual|sapphic)\b/iu.test(text)) return "same";
  if (/\b(straight|heterosexual)\b/iu.test(text)) return "other";
  return null;
}

/** Whether `a`'s stated orientation takes `b`. Unknown orientation takes anyone; unknown gender only then. */
function into(a: SlurpTieCreator, b: SlurpTieCreator): boolean {
  const want = orientation(a.text);
  if (!want || want === "any") return true;
  if (!a.gender || !b.gender || a.gender === "other" || b.gender === "other") return false;
  return want === "same" ? a.gender === b.gender : a.gender !== b.gender;
}

const firstName = (name: string) => name.trim().split(/\s+/u)[0]!.toLocaleLowerCase();
/** Whether one of the card's own partners is this other Creator (by name). */
const cardNames = (a: SlurpTieCreator, b: SlurpTieCreator) =>
  (a.cardPartners ?? []).some((partner) => firstName(partner) === firstName(b.name));

// Not "partner" or "together": "business partner", "works together with" are about work.
const PARTNER_WORDS =
  /\b(?:boyfriend|girlfriend|wife|husband|fianc[eé]e?|spouse|married|dating|in a relationship|lovers?|mated?)\b/iu;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
/**
 * Whether a card's own words say the other one is their partner ("Dating Juniper Vale for two
 * years"). The anchors only exist after the first post, so a couple set up right after sign-up used
 * to start at "sparks" although both cards said they were together.
 */
const textNames = (a: SlurpTieCreator, b: SlurpTieCreator) => {
  const first = b.name.trim().split(/\s+/u)[0];
  if (!first || first.length < 3) return false;
  const name = new RegExp(`(?<![\\p{L}])${escapeRegExp(first)}(?![\\p{L}])`, "iu");
  return a.text.split(/(?<=[.!?])\s+|\n+/u).some((sentence) => name.test(sentence) && PARTNER_WORDS.test(sentence));
};

const neverDates = (creator: SlurpTieCreator) =>
  creator.text
    .split(/(?<=[.!?])\s+|\n+/u)
    .some(
      (sentence) => SLURP_NEVER_PATTERN.test(sentence) && DATING_TOPIC.test(sentence) && !ABOUT_FANS.test(sentence),
    );

export type SlurpCoupleFit = { fits: boolean; misfit: SlurpCoupleMisfit | null; chemistry: number; cards: boolean };

/** Whose card says no to this pair, and why: the first of the two that does. Null when both cards allow it. */
export function slurpCoupleMisfitOf(a: SlurpTieCreator, b: SlurpTieCreator): SlurpCoupleForced | null {
  const cards = cardNames(a, b) || cardNames(b, a) || textNames(a, b) || textNames(b, a);
  const pairs = [
    [a, b],
    [b, a],
  ] as const;
  const first = (
    misfit: SlurpCoupleForced["misfit"],
    test: (self: SlurpTieCreator, other: SlurpTieCreator) => boolean,
  ) => {
    // A page the player runs is the player's: its text is not a card, and it has no gender to read.
    const hit = pairs.find(([self, other]) => self.automatic && test(self, other));
    return hit ? { misfit, byId: hit[0].id } : null;
  };
  // The player's romance setting (0.3.17) is about Creators with each other: a crush on the player's
  // own page, or the player's own steers, are not held to it.
  const romance = pairs.find(
    ([self, other]) => self.automatic && other.automatic && !slpRomanceAllows(self, { id: other.id }),
  );
  if (romance) return { misfit: "romance", byId: romance[0].id };
  return (
    (cards ? null : first("taken", (self) => (self.cardPartners ?? []).length > 0)) ??
    first("notInto", (self) => NOT_INTO_ANYONE.test(self.text)) ??
    first("noDating", neverDates) ??
    first("orientation", (self, other) => other.automatic && !into(self, other))
  );
}

/**
 * Whether these two could be a couple without making either less themselves. `cards` is true when a
 * card names the other one as their partner already. Chemistry: a shared tag counts 2, a shared
 * interest 1, a romantic card 1 each.
 */
export function slurpCoupleFit(a: SlurpTieCreator, b: SlurpTieCreator): SlurpCoupleFit {
  const no = (misfit: SlurpCoupleMisfit) => ({ fits: false, misfit, chemistry: 0, cards: false });
  if (a.id === b.id) return no("same");
  const misfit = slurpCoupleMisfitOf(a, b);
  if (misfit) return no(misfit.misfit);
  const cards = cardNames(a, b) || cardNames(b, a) || textNames(a, b) || textNames(b, a);
  const niche = slurpSharedNiche(a, b);
  const chemistry =
    niche.tags.length * 2 + niche.interests.length + [a, b].filter((creator) => ROMANTIC.test(creator.text)).length;
  return { fits: true, misfit: null, chemistry: cards ? chemistry + 4 : chemistry, cards };
}
