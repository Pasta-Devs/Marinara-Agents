// ──────────────────────────────────────────────
// Otome Forge: the cast and the protagonist as setup reads them from the Engine, and the shapes P1's and P2's replies
// take (plan M1 "Prompts")
// ──────────────────────────────────────────────
// Cards and personas are read through api.runtime.resources; a card love interest's canon is read for each request
// (castOf, the kit's forgeHydrateStoryCharacters) and never saved. The setup prompts P1 (premise), P2 (world plan)
// and P3 (bible) are in S/prompts.ts; their checks are here (P1, P2) and in S/setup/bible.ts (P3).
import { forgeHydrateStoryCharacters, type ForgeCardCanon } from "@forge-kit/character-card-context.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { z, type ZodType } from "zod";
import type {
  LiId,
  Player,
  Unit,
  WebRow,
  WebStance,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { text } from "../schemas/common.js";

const PREMISE_MAX = 2000;

// ── Engine cards and personas, read through api.runtime.resources ──

/** A card's authored fields, flattened the way the kit reads them. */
export interface CardFields {
  name: string;
  description: string;
  personality: string;
  backstory: string;
  appearance: string;
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function parsed(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * The card's current fields, or null when it is gone. The Engine hands `data` over as the stored JSON text; Marinara
 * keeps backstory and appearance under `extensions`, and a V2 card nests everything under `data`.
 */
export async function readCard(
  runtime: Pick<CapabilityRuntimeHost, "resources">,
  cardId: string,
): Promise<CardFields | null> {
  const [record] = await runtime.resources.listCharacters([cardId]);
  const raw = parsed(record?.data);
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : raw;
  if (!isRecord(data)) return null;
  const extensions = isRecord(data.extensions) ? data.extensions : {};
  return {
    name: str(data.name),
    description: str(data.description),
    personality: str(data.personality),
    backstory: str(extensions.backstory) || str(data.backstory),
    appearance: str(extensions.appearance) || str(data.appearance),
  };
}

export interface PersonaFields {
  name: string;
  description: string;
  personality: string;
  backstory: string;
  /** Authored story appearance, independent of the optional image-only override. */
  authoredAppearance: string;
  /** The image appearance only while its override is enabled, otherwise the authored Appearance. */
  appearance: string;
}

export async function readPersona(
  runtime: Pick<CapabilityRuntimeHost, "resources">,
  personaId: string,
): Promise<PersonaFields | null> {
  if (!personaId) return null;
  const [record] = await runtime.resources.listPersonas([personaId]);
  const data = parsed(record?.data);
  if (!isRecord(data)) return null;
  const imageAppearance = str(data.imageAppearance);
  const imageFirst = data.imageAppearanceEnabled === true || data.imageAppearanceEnabled === "true";
  return {
    name: str(data.name),
    description: str(data.description),
    personality: str(data.personality),
    backstory: str(data.backstory),
    authoredAppearance: str(data.appearance),
    appearance: (imageFirst && imageAppearance) || str(data.appearance),
  };
}

/** Only the persona's four authored story fields; roleplay scenarios and sample dialogue are not story canon. */
export function personaStoryAbout(persona: PersonaFields): string {
  return [
    persona.description,
    persona.personality ? `Personality: ${persona.personality}` : "",
    persona.backstory ? `Backstory: ${persona.backstory}` : "",
    persona.authoredAppearance ? `Appearance: ${persona.authoredAppearance}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Read current authored persona fields for a prompt; an unavailable persona keeps this protagonist's saved copy. */
export async function withPersonaStoryAbout(
  runtime: Pick<CapabilityRuntimeHost, "resources">,
  player: Player,
): Promise<Player> {
  try {
    const persona = await readPersona(runtime, player.personaId);
    return persona ? { ...player, about: personaStoryAbout(persona) } : player;
  } catch {
    return player;
  }
}

/** Current persona appearance is authoritative for every image; retain the action's separate outfit line. */
export async function withPersonaImageAppearance(
  runtime: Pick<CapabilityRuntimeHost, "resources">,
  player: Player,
): Promise<Player> {
  try {
    const persona = await readPersona(runtime, player.personaId);
    // Empty is still the current selection. A disabled override must not return through the saved identity cache.
    return persona ? { ...player, look: { ...player.look, identityLine: persona.appearance } } : player;
  } catch {
    // A deleted/unavailable persona keeps the same protagonist's saved look instead of borrowing another subject.
    return player;
  }
}

// ── The cast as the prompts see it (S/prompts.ts castEntry introduces each one) ──

/** A love interest and, for a card LI, the card's canon read for this request only. */
export interface CastMember {
  unit: Unit;
  canon?: ForgeCardCanon;
}

/** Each unit with its card's current canon (never saved: prompt input only). */
export async function castOf(
  runtime: Pick<CapabilityRuntimeHost, "resources" | "logger">,
  units: readonly Unit[],
): Promise<CastMember[]> {
  const hydrated = await forgeHydrateStoryCharacters([...units], (cardId) => readCard(runtime, cardId), runtime.logger);
  return hydrated.map(({ forgeCardCanon, ...unit }) => ({
    unit,
    ...(forgeCardCanon ? { canon: forgeCardCanon } : {}),
  }));
}

// ── P1's reply: a premise suggestion (the prompt: S/prompts.ts premiseMessages) ──

export interface PremiseReply {
  premise: string;
}
export const PremiseSchema: ZodType<PremiseReply> = z.object({ premise: z.string() });

export function normalizePremise(reply: PremiseReply): PremiseReply | string {
  const premise = reply.premise.trim();
  if (!premise) return "premise must not be empty";
  if (premise.length > PREMISE_MAX) return `premise must be at most ${PREMISE_MAX} characters`;
  return { premise };
}

// ── P2's reply: the world plan (the prompt: S/prompts.ts worldPlanMessages) ──

export interface WorldPlanReply {
  title: string;
  setting: string;
  mystery: { question: string; truth: string };
  pieces: Array<{ li: string; piece: string; reasonToHide: string }>;
  web: Array<{ a: string; b: string; history: string; stance: WebStance; debt: string; secret?: string | null }>;
  openingSituation: string;
}

export const WorldPlanSchema: ZodType<WorldPlanReply> = z.object({
  title: z.string().min(1).max(200),
  setting: z.string().min(1).max(4000),
  mystery: z.object({ question: z.string().min(1).max(4000), truth: z.string().min(1).max(4000) }),
  // The world document's own limits (schemas/world.ts), so an over-long field gets the repair turn here instead of
  // emptying the stored mystery or dropping the row when the world is read back.
  pieces: z.array(z.object({ li: z.string(), piece: text().min(1), reasonToHide: text().min(1) })).max(20),
  web: z
    .array(
      z.object({
        a: z.string(),
        b: z.string(),
        history: text(),
        stance: z.enum(["allies", "uneasy", "rivals", "enemies"]),
        debt: text(),
        secret: text().nullable().optional(),
      }),
    )
    .max(30),
  openingSituation: z.string().min(1).max(4000),
});

/** What the world plan writes into the world document. */
export type WorldPlan = Pick<World, "title" | "setting" | "mystery" | "web" | "openingSituation">;

/** A love interest the model named by id or, failing that, by exact name. */
function resolveLi(cast: readonly CastMember[], value: string): LiId | null {
  const key = value.trim();
  const byId = cast.find(({ unit }) => unit.id === key);
  if (byId) return byId.unit.id;
  const byName = cast.filter(({ unit }) => unit.name.trim().toLowerCase() === key.toLowerCase());
  return byName.length === 1 ? byName[0].unit.id : null;
}

/** The plan in the world's shape, or the reason it is refused: every love interest holds exactly one piece. */
export function normalizeWorldPlan(reply: WorldPlanReply, cast: readonly CastMember[]): WorldPlan | string {
  const pieces: World["mystery"]["pieces"] = {};
  for (const entry of reply.pieces) {
    const li = resolveLi(cast, entry.li);
    if (li && !pieces[li]) pieces[li] = { piece: entry.piece.trim(), reasonToHide: entry.reasonToHide.trim() };
  }
  const missing = cast.filter(({ unit }) => !pieces[unit.id]).map(({ unit }) => unit.id);
  if (missing.length) return `every love interest needs exactly one piece; missing: ${missing.join(", ")}`;
  const web: WebRow[] = [];
  const pairs = new Set<string>();
  for (const row of reply.web) {
    const a = resolveLi(cast, row.a);
    const b = resolveLi(cast, row.b);
    const pair = [a, b].sort().join("|");
    if (!a || !b || a === b || pairs.has(pair)) continue;
    pairs.add(pair);
    const secret = row.secret?.trim();
    web.push({
      a,
      b,
      history: row.history.trim(),
      stance: row.stance,
      debt: row.debt.trim(),
      ...(secret ? { secret } : {}),
    });
  }
  return {
    title: reply.title.trim(),
    setting: reply.setting.trim(),
    mystery: { question: reply.mystery.question.trim(), truth: reply.mystery.truth.trim(), pieces },
    web,
    openingSituation: reply.openingSituation.trim(),
  };
}
