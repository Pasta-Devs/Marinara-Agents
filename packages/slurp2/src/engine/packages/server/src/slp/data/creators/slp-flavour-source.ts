/**
 * Everything the flavour brief is compiled from, read for one request: the linked card as it is
 * now, the cached canon anchors, the Creator's own recent public lines, and the player's steering.
 *
 * Read-only. Nothing is written back to the card or stored as a flavour sheet: the brief is
 * compiled fresh each time, so a card edit shows up in the next post.
 */
import type { SlpDeepDetailsFlavour } from "../../../../../shared/src/slp/slp-deep-details.js";
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { logger } from "../../../lib/logger.js";
import type { SlpAccount, SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlpCreatorSteering } from "../../../../../shared/src/slp/slp-creator-steering.js";
import { parseRecord } from "../../modules/creators/slp-public-support.js";
import {
  compileSlurpFlavourBrief,
  type SlurpFlavourCard,
  type SlurpFlavourUse,
} from "../../modules/creators/slp-creator-flavour.js";
import type { SlurpCanonAnchors } from "../../modules/feed/slp-post-beat.js";
import { readSlurpCreatorSteering } from "./slp-steering-storage.js";
import { readSlurpCreatorTiesDocument } from "../projects/slp-creator-ties-storage.js";
import { resolveSlurpExplicitLevel } from "../settings/slp-post-guidance-storage.js";
import { SLP_EXPLICIT_LEVELS } from "../../../../../shared/src/slp/slp-spice.js";
import { slurpCouplePartners } from "../../modules/projects/slp-couple-group.js";
import { slurpPartnerWord, slurpRelationshipLine } from "../../modules/projects/slp-couple-lines.js";
import { readSlurpAgentMemoryLines } from "./slp-agent-memory-source.js";
import { createSlurpStorage } from "../slp-storage.js";
import { resolveSlurpCreatorSpice, type SlurpCreatorSpice } from "./slp-spice-storage.js";
import {
  slurpDmSpiceLevel,
  slurpSpiceBriefLines,
  slurpTastePick,
  type SlurpSpiceCreator,
} from "../../modules/creators/slp-spice.js";

/** The beats planner's anchor cache, one entry per Creator. Written by `slp-post-beat-service.ts`. */
export const SLURP_CANON_ANCHORS_KEY = "slurp2.canon-anchors";

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** The card fields the brief reads. A concealed Creator keeps the voice, not the googleable backstory. */
async function readFlavourCard(
  db: DB,
  source: Pick<SlpAccount, "kind" | "entityId"> | null,
  disclosureMode: SlpIdentityDisclosure,
): Promise<{ name: string; card: SlurpFlavourCard } | null> {
  if (!source) return null;
  const characters = createCharactersStorage(db);
  const open = disclosureMode === "open";
  if (source.kind === "character") {
    const row = await characters.getById(source.entityId);
    if (!row) return null;
    const data = parseRecord(row.data);
    const extensions = parseRecord(data.extensions);
    return {
      name: text(data.name),
      card: {
        description: text(data.description),
        personality: text(data.personality),
        backstory: open ? text(data.backstory) || text(extensions.backstory) : "",
        mes_example: text(data.mes_example),
        first_mes: text(data.first_mes),
        alternate_greetings: Array.isArray(data.alternate_greetings) ? data.alternate_greetings.map(text) : [],
      },
    };
  }
  if (source.kind === "persona") {
    const row = await characters.getPersona(source.entityId);
    if (!row) return null;
    return {
      name: text(row.name),
      card: {
        description: text(row.description),
        personality: text(row.personality),
        backstory: open ? text(row.backstory) : "",
      },
    };
  }
  return null;
}

async function readAnchors(db: DB, accountId: string): Promise<SlurpCanonAnchors | null> {
  try {
    const raw = await createAppSettingsStorage(db).get(SLURP_CANON_ANCHORS_KEY);
    const cache = parseRecord(typeof raw === "string" ? JSON.parse(raw) : raw);
    const entry = parseRecord(cache[accountId]);
    return (entry.anchors as SlurpCanonAnchors | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * The brief for one request, unprotected (the caller applies identity protection like it does to
 * every other card value). Empty when nothing could be read: a missing brief never costs a post.
 */
export async function resolveSlurpCreatorFlavour(
  db: DB,
  input: {
    account: Pick<SlpAccount, "id" | "displayName"> & { settings?: { strategy?: unknown } };
    source: Pick<SlpAccount, "kind" | "entityId"> | null;
    disclosureMode: SlpIdentityDisclosure;
    use: SlurpFlavourUse;
    sequence: number;
    /** Already loaded by the caller; read here when absent. */
    steering?: SlpCreatorSteering | null;
    /** Their own lines, newest first; their recent public captions when absent. */
    ownLines?: readonly string[];
    /** Already loaded by the caller (a post); read here when absent. */
    spice?: SlurpCreatorSpice | null;
    /**
     * A chat: whether the other side subscribed, whether it is the player (their taste shows), and
     * who they are to the Creator (the DM role): a fan, a fellow Creator's page, or Slurp's staff.
     */
    chat?: {
      subscribed: boolean;
      player: boolean;
      seed: string;
      with?: "fan" | "peer" | "staff";
      /** A peer who is their partner now (7b-couples): the chat goes as far as both their levels. */
      partnerId?: string;
    };
    /** Receives the brief as parts, for the post's Deep details record. */
    shaped?: (value: SlpDeepDetailsFlavour) => void;
  },
): Promise<string> {
  try {
    // What the player's other Agents know about them, when the setting allows (on by default).
    // Open identities only: another Agent's notes can carry the backstory a concealed Creator hides.
    const settings = await createSlurpStorage(db)
      .getSettings()
      .catch(() => null);
    const agents =
      input.disclosureMode === "open" && settings?.flavourFromAgents
        ? await readSlurpAgentMemoryLines(db, input.source)
        : [];
    const card = await readFlavourCard(db, input.source, input.disclosureMode);
    const ownLines =
      input.ownLines ??
      (await createSlurpStorage(db).listNoodlerPostsByAccount(input.account.id, 8))
        .filter((post) => post.access !== "locked")
        .map((post) => post.content);
    const anchors = await readAnchors(db, input.account.id);
    const spiceLines = await flavourSpiceLines(db, input, card?.card ?? {}, anchors).catch((error: unknown) => {
      logger.warn(error, "[slurp] Could not read the Creator's spice; the brief goes without it");
      return [];
    });
    const brief = compileSlurpFlavourBrief(
      {
        accountId: input.account.id,
        name: card?.name || input.account.displayName,
        card: card?.card ?? {},
        anchors,
        ownLines,
        steering: input.steering ?? (await readSlurpCreatorSteering(db, input.account.id)),
        lately: agents,
        spice: spiceLines,
        // Slurp Support is staff: their love life is not its business. In a chat with the partner the
        // role header already says who they are to each other; the general line ("you are with X,
        // not the topic of everything you write") would contradict it there.
        relationship:
          input.chat?.with === "staff" || input.chat?.partnerId
            ? ""
            : await readSlurpRelationshipLine(db, input.account.id),
      },
      { use: input.use, sequence: input.sequence },
    );
    input.shaped?.(brief.shaped);
    return brief.text;
  } catch (error) {
    logger.warn(error, "[slurp] Could not compile the flavour brief; the prompt goes without it");
    return "";
  }
}

/** Card and anchors as one text, for spice fit and the card's own "never" sentences. */
function spiceText(card: SlurpFlavourCard, anchors: SlurpCanonAnchors | null): string {
  return [
    card.description ?? "",
    card.personality ?? "",
    card.backstory ?? "",
    ...(anchors ? [...anchors.habits, ...anchors.work, ...anchors.places, ...anchors.objects] : []),
  ]
    .filter(Boolean)
    .join("\n");
}

/** One Creator as the spice rules see them. */
export function slurpSpiceCreatorFrom(
  accountId: string,
  card: SlurpFlavourCard,
  anchors: SlurpCanonAnchors | null,
  spice: SlurpCreatorSpice,
): SlurpSpiceCreator {
  return { accountId, text: spiceText(card, anchors), turnOns: spice.turnOns, hardNoes: spice.hardNoes, anchors };
}

/** Everything a spicy post needs about its Creator, read once: level, likes, noes, taste, card text. */
export async function resolveSlurpSpiceCreator(
  db: DB,
  input: {
    account: Pick<SlpAccount, "id"> & { settings: { strategy?: unknown } };
    source: Pick<SlpAccount, "kind" | "entityId"> | null;
    disclosureMode: SlpIdentityDisclosure;
  },
): Promise<{ spice: SlurpCreatorSpice; creator: SlurpSpiceCreator }> {
  const spice = await resolveSlurpCreatorSpice(db, input.account);
  const card = await readFlavourCard(db, input.source, input.disclosureMode);
  const anchors = await readAnchors(db, input.account.id);
  return { spice, creator: slurpSpiceCreatorFrom(input.account.id, card?.card ?? {}, anchors, spice) };
}

async function flavourSpiceLines(
  db: DB,
  input: Parameters<typeof resolveSlurpCreatorFlavour>[1],
  card: SlurpFlavourCard,
  anchors: SlurpCanonAnchors | null,
): Promise<string[]> {
  // A comment reply or a hand-over note is not the place for turn-ons, nor a talk with Slurp's staff.
  if (input.use === "comment" || input.use === "delivery") return [];
  if (input.chat?.with === "staff") return [];
  const spice =
    input.spice ??
    (await resolveSlurpCreatorSpice(db, {
      id: input.account.id,
      settings: { strategy: input.account.settings?.strategy },
    }));
  // Their partner gets the lower of the two levels, never the tease; everyone else as before.
  const level = input.chat?.partnerId
    ? await partnerLevel(db, spice.level, input.chat.partnerId)
    : input.chat
      ? slurpDmSpiceLevel(spice.level, input.chat.subscribed)
      : spice.level;
  // The player's taste reaches a chat with the player; posts carry it in their spicy angle.
  const taste =
    input.chat?.player && level !== "none"
      ? slurpTastePick(
          spice.spice,
          slurpSpiceCreatorFrom(input.account.id, card, anchors, spice),
          input.chat.seed,
          input.sequence,
        )
      : null;
  return slurpSpiceBriefLines({
    use: input.use,
    level,
    // A fellow Creator gets the tease too, but is not somebody to sell a subscription to.
    // A partner's chat is a peer chat (`partnerId` rides on `with: "peer"`), so it is never held back.
    held: Boolean(input.chat && input.chat.with !== "peer" && level !== spice.level),
    turnOns: spice.turnOns,
    hardNoes: spice.hardNoes,
    never: spice.spice.never,
    taste: taste?.text ?? null,
    language: spice.spice.language,
  });
}

/**
 * What "does this fit them" is judged on, outside a post (an automatic storyline): the card as it
 * is now, the anchors, and the Creator's tags. Empty when nothing could be read, which fits only
 * the storylines that need nothing.
 */
export async function readSlurpCreatorFitText(
  db: DB,
  input: {
    account: Pick<SlpAccount, "id"> & { settings: { profile: { tags?: string[] } } };
    source: Pick<SlpAccount, "kind" | "entityId"> | null;
  },
): Promise<string> {
  try {
    const card = await readFlavourCard(db, input.source, "open");
    const anchors = await readAnchors(db, input.account.id);
    return [
      card?.card.description ?? "",
      card?.card.personality ?? "",
      card?.card.backstory ?? "",
      ...(anchors
        ? [
            ...anchors.people.map((person) => `${person.name} ${person.relation}`),
            ...anchors.places,
            ...anchors.work,
            ...anchors.habits,
          ]
        : []),
      ...(input.account.settings.profile.tags ?? []),
    ]
      .filter(Boolean)
      .join("\n");
  } catch (error) {
    logger.warn(error, "[slurp] Could not read the card for a storyline fit check");
    return "";
  }
}

/** The partners a card names (anchor people with a partner relation), for couples. */
/** Everyone the card names, with how they relate (canon anchors), for bonds. Empty until anchors exist. */
export async function readSlurpCardPeople(db: DB, accountId: string): Promise<{ name: string; relation: string }[]> {
  return (await readAnchors(db, accountId))?.people ?? [];
}

/**
 * What a Creator knows about their own love life (7b-couples), one plain sentence or "": a crush, the
 * partner, or a recent ex (U). With `withId` (a chat with the partner or the ex) it says who they are to each other.
 */
export async function readSlurpRelationshipLine(
  db: DB,
  creatorId: string,
  options: { withId?: string | null } = {},
): Promise<string> {
  try {
    const { couples } = await readSlurpCreatorTiesDocument(db);
    // Every partner they had (the line picks the current one, a crush, or a recent ex).
    const storage = createSlurpStorage(db);
    const partners = await Promise.all(
      [...new Set(couples.flatMap((couple) => slurpCouplePartners(couple, creatorId)))].map((partnerId) =>
        partnerId ? storage.getNoodlerAccountById(partnerId) : null,
      ),
    );
    const found = partners.flatMap((partner) => (partner ? [partner] : []));
    const names = new Map(found.map((partner) => [partner.id, partner.displayName] as const));
    // A page the player runs is the player: she is with them, not with "another Creator on Slurp".
    const players = found.filter((partner) => partner.kind === "persona" && partner.sourceKind === "persona");
    return slurpRelationshipLine(couples, creatorId, names, {
      ...options,
      playerIds: new Set(players.map((partner) => partner.id)),
      words: new Map(
        players.map((partner) => [partner.id, slurpPartnerWord(partner.settings.profile.gender)] as const),
      ),
    });
  } catch (error) {
    logger.warn(error, "[slurp] Could not read a Creator's relationship");
    return "";
  }
}

/**
 * The lower of a Creator's own level and their partner's. A page the player runs is the player, whose
 * own level is not theirs to set here: with the player she goes as far as her own level (Drama).
 */
async function partnerLevel(
  db: DB,
  own: SlurpCreatorSpice["level"],
  partnerId: string,
): Promise<SlurpCreatorSpice["level"]> {
  const account = await createSlurpStorage(db)
    .getNoodlerAccountById(partnerId)
    .catch(() => null);
  if (account?.kind === "persona" && account.sourceKind === "persona") return own;
  const theirs = await resolveSlurpExplicitLevel(db, partnerId).catch(() => null);
  return theirs && SLP_EXPLICIT_LEVELS.indexOf(theirs) < SLP_EXPLICIT_LEVELS.indexOf(own) ? theirs : own;
}
