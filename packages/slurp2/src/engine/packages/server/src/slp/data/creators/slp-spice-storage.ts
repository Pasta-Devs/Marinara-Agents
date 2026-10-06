/**
 * The Slurp-wide spice store (limit, the player's taste, what Slurp learned) and one Creator's
 * spice as the prompts need it. Rules live in `modules/creators/slp-spice.ts`.
 *
 * One blob under the `slurp2.` namespace, so the backup export picks it up without being told.
 */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { logger } from "../../../lib/logger.js";
import {
  normalizeSlpSpice,
  SLP_SPICE_SETTING_KEY,
  SLP_TASTE_IDEAS,
  SLP_SPICE_TO_EXPLICIT,
  slpClampExplicitLevel,
  slpSpiceFromStrategyText,
  type SlpExplicitLevelName,
  type SlpSpiceState,
} from "../../../../../shared/src/slp/slp-spice.js";
import {
  SLURP_TASTE_SIGNAL_WEIGHT,
  slurpLearnTaste,
  slurpSpiceLabelsOf,
  slurpSpiceLanguageFor,
  slurpTasteLabelsIn,
  type SlurpTasteSignal,
} from "../../modules/creators/slp-spice.js";
import { getSlurpPostGuidance, updateSlurpPostGuidance } from "../settings/slp-post-guidance-storage.js";
import { selectSlurpExplicitLevel } from "../../modules/feed/slp-post-guidance.js";
import { readSlurpCreatorSteering, slurpSteeringKey } from "./slp-steering-storage.js";
import { createSlurpStorage } from "../slp-storage.js";
import { SLURP_GUIDANCE_PRESETS, SLURP_HOUSE_STYLE_GUIDANCE } from "../../modules/settings/slp-settings.js";

// One blob behind concurrent writes (a like and a tip landing together) loses the earlier one.
// ponytail: in-process queue like the post guidance blob; needs a row lock if Engine ever runs
// more than one process.
let queue: Promise<unknown> = Promise.resolve();

async function readStoredSpice(db: DB): Promise<SlpSpiceState> {
  const raw = await createAppSettingsStorage(db).get(SLP_SPICE_SETTING_KEY);
  try {
    return normalizeSlpSpice(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSlpSpice(null);
  }
}

export async function readSlurpSpice(db: DB): Promise<SlpSpiceState> {
  const state = await readStoredSpice(db);
  return state.language ? state : settleSlurpSpiceLanguage(db);
}

/**
 * Once (0.3.17): the old Writing preset becomes the Language choice, and a still-shipped preset text
 * becomes the house style. Mild was soft words; steamy and explicit carried the dirty word list,
 * as does anything else (the shipped default). An edited guidance text is never touched.
 */
async function migrateSpiceLanguage(db: DB, current: SlpSpiceState): Promise<SlpSpiceState> {
  if (current.language) return current;
  const storage = createSlurpStorage(db);
  const guidance = (await storage.getSettings()).generationGuidance;
  // The text first: if this write fails, the language stays unset and the step runs again.
  if ((Object.values(SLURP_GUIDANCE_PRESETS) as string[]).includes(guidance))
    await storage.updateSettings({ generationGuidance: SLURP_HOUSE_STYLE_GUIDANCE });
  const language = slurpSpiceLanguageFor(guidance, {
    mild: SLURP_GUIDANCE_PRESETS.mild,
    dirty: [SLURP_GUIDANCE_PRESETS.steamy, SLURP_GUIDANCE_PRESETS.explicit, SLURP_HOUSE_STYLE_GUIDANCE],
  });
  const next = { ...current, language };
  await createAppSettingsStorage(db).set(SLP_SPICE_SETTING_KEY, JSON.stringify(next));
  return next;
}

// Inside the write queue, so a taste learned or a PATCH landing meanwhile is never overwritten.
let settling: Promise<SlpSpiceState> | null = null;
function settleSlurpSpiceLanguage(db: DB): Promise<SlpSpiceState> {
  if (!settling) {
    settling = queue.then(async () => migrateSpiceLanguage(db, await readStoredSpice(db)));
    queue = settling.catch(() => undefined);
    void settling.finally(() => (settling = null)).catch(() => undefined);
  }
  return settling;
}

export async function updateSlurpSpice(
  db: DB,
  mutate: (current: SlpSpiceState) => SlpSpiceState,
): Promise<SlpSpiceState> {
  const run = queue.then(async () => {
    // Read straight from storage: readSlurpSpice could queue the migration behind this very write.
    const next = normalizeSlpSpice(mutate(await migrateSpiceLanguage(db, await readStoredSpice(db))));
    await createAppSettingsStorage(db).set(SLP_SPICE_SETTING_KEY, JSON.stringify(next));
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Learn a little from something the player did: an unlock, a like, a tip or a request. `metadata`
 * is a post's (what made it spicy, `slurpSpiceLabelsOf`), `text` a request or a paid picture,
 * `creatorId` a tip (what that Creator's spicy posts have been lately). Any other `signal` (a reply,
 * a vote) teaches nothing. Never costs the action itself.
 */
export function recordSlurpTasteSignal(
  db: DB,
  source: { metadata?: unknown; text?: string; creatorId?: string },
  signal: SlurpTasteSignal | (string & {}),
): void {
  if (!(signal in SLURP_TASTE_SIGNAL_WEIGHT)) return;
  const labels = slurpSpiceLabelsOf(source.metadata);
  const run = async () => {
    const fromCreator = source.creatorId
      ? ((await createSlurpStorage(db).listNoodlerPostsByAccount(source.creatorId, 8))
          .map((post: { metadata?: unknown }) => slurpSpiceLabelsOf(post.metadata))
          .find((labels: string[]) => labels.length) ?? [])
      : [];
    await updateSlurpSpice(db, (state) => {
      const all = [
        ...labels,
        ...fromCreator,
        ...(source.text ? slurpTasteLabelsIn(source.text, state, SLP_TASTE_IDEAS) : []),
      ];
      return all.length ? slurpLearnTaste(state, all, signal as SlurpTasteSignal, new Date()) : state;
    });
  };
  if (!labels.length && !source.text?.trim() && !source.creatorId) return;
  void run().catch((error: unknown) => logger.warn(error, "[slurp] Could not learn from a taste signal"));
}

/**
 * The sign-up chat used to put the spice level, turn-ons and hard noes into the strategy text.
 * Moved once into the steering (turn-ons, hard noes) and the post guidance (level) — Slurp's own
 * settings only, never the account row, so no prepared post goes stale over it. The strategy
 * reader drops the old lines (`slp-creator-strategy.ts`).
 */
export async function moveSlurpStrategyLimits(
  db: DB,
  account: { id: string; settings: { strategy?: unknown } },
): Promise<void> {
  const steering = await readSlurpCreatorSteering(db, account.id);
  if (steering.limitsMoved) return;
  const stored = account.settings.strategy as { strategyText?: unknown } | undefined;
  const limits = slpSpiceFromStrategyText(typeof stored?.strategyText === "string" ? stored.strategyText : "");
  if (!limits.found) return;
  await createAppSettingsStorage(db).set(
    slurpSteeringKey(account.id),
    JSON.stringify({
      ...steering,
      turnOns: steering.turnOns.length ? steering.turnOns : limits.turnOns,
      hardNoes: steering.hardNoes.length ? steering.hardNoes : limits.hardNoes,
      limitsMoved: true,
    }),
  );
  if (limits.level) {
    const level = SLP_SPICE_TO_EXPLICIT[limits.level];
    await updateSlurpPostGuidance(db, (current) => {
      const entry = current.creators[account.id] ?? { public: "", locked: "", menu: "", level: "" };
      return entry.level
        ? current
        : { ...current, creators: { ...current.creators, [account.id]: { ...entry, level } } };
    });
  }
}

/** One Creator's spice for a prompt: their level under the Slurp-wide limit, likes, noes, taste. */
export type SlurpCreatorSpice = {
  level: SlpExplicitLevelName;
  turnOns: string[];
  hardNoes: string[];
  spice: SlpSpiceState;
};

export async function resolveSlurpCreatorSpice(
  db: DB,
  account: { id: string; settings: { strategy?: unknown } },
): Promise<SlurpCreatorSpice> {
  await moveSlurpStrategyLimits(db, account).catch((error: unknown) =>
    logger.warn(error, "[slurp] Could not move the sign-up limits out of the strategy text"),
  );
  const [spice, guidance, steering] = await Promise.all([
    readSlurpSpice(db),
    getSlurpPostGuidance(db),
    readSlurpCreatorSteering(db, account.id),
  ]);
  return {
    level: slpClampExplicitLevel(selectSlurpExplicitLevel(guidance, account.id), spice.max),
    turnOns: steering.turnOns,
    hardNoes: steering.hardNoes,
    spice,
  };
}

/**
 * Creators this one works with (paired in settings, or a collab they made) who would be in a fully explicit post: their own
 * level reaches explicit and their hard noes do not rule sex with a partner out.
 */
export async function slurpSpicyCollabNames(db: DB, partnerIds: readonly string[]): Promise<string[]> {
  if (!partnerIds.length) return [];
  const [spice, guidance] = await Promise.all([readSlurpSpice(db), getSlurpPostGuidance(db)]);
  const storage = createSlurpStorage(db);
  const names: string[] = [];
  for (const partnerId of partnerIds.slice(0, 6)) {
    const account = await storage.getNoodlerAccountById(partnerId).catch(() => null);
    // A page the player runs is the player: its own level and hard noes are not theirs to set here (Drama).
    if (account?.kind === "persona" && account.sourceKind === "persona") {
      if (account.displayName) names.push(account.displayName);
      continue;
    }
    const level = slpClampExplicitLevel(selectSlurpExplicitLevel(guidance, partnerId), spice.max);
    if (level !== "explicit") continue;
    const steering = await readSlurpCreatorSteering(db, partnerId);
    if (steering.hardNoes.some((no) => /\b(sex|partner|collab|others?)\b/iu.test(no))) continue;
    if (account?.displayName) names.push(account.displayName);
  }
  return names;
}
