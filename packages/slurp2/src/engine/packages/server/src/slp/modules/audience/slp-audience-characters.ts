/**
 * Which characters the user put in the audience.
 *
 * Pure and leaf, like the other Slurp rule modules, so a test can import it without pulling in
 * `@marinara-engine/shared` — the constraint that made the privacy core untestable until it was
 * moved out of its service (see SLURP-AUDIT-TASKS.md T6).
 *
 * A character fan is an account row, not a population member. It is shaped exactly like the six
 * ambient roster accounts: `kind: "random_user"`, identity carried in `entityId`. That is what
 * lets a character act in the audience without widening either `random_user` authorisation gate
 * (`createNoodlerFanInteraction`, `applyPulse`), and without a `kind: "character"` row leaking into
 * the Creator listings the way the phantom-profile bug did.
 */

/** Marks an account row as a character standing in the audience. */
export const SLURP_CHARACTER_FAN_PREFIX = "character-fan:";

/** The `entityId` an audience row carries for one Engine character. */
export function slurpCharacterFanEntityId(characterId: string): string {
  return `${SLURP_CHARACTER_FAN_PREFIX}${characterId}`;
}

/**
 * The Engine character behind an audience row, or null when the id is not one.
 *
 * This is the only way back to the character: a `random_user` row has null source columns, so
 * `resolveAccountSource` cannot answer for it.
 */
export function slurpCharacterIdFromFanEntityId(entityId: string | null | undefined): string | null {
  if (typeof entityId !== "string" || !entityId.startsWith(SLURP_CHARACTER_FAN_PREFIX)) return null;
  const characterId = entityId.slice(SLURP_CHARACTER_FAN_PREFIX.length).trim();
  return characterId.length > 0 ? characterId : null;
}

/** Whether an account row is a character standing in the audience. */
export function isSlurpCharacterFanAccount(
  account: Pick<{ kind: string; entityId: string }, "kind" | "entityId"> | null | undefined,
): boolean {
  return account?.kind === "random_user" && slurpCharacterIdFromFanEntityId(account.entityId) !== null;
}

/** One character group, as `characters.listGroups()` returns it: `characterIds` is a JSON string. */
export type SlurpAudienceCharacterGroup = { id: string; characterIds?: unknown };

function memberIds(group: SlurpAudienceCharacterGroup): string[] {
  if (Array.isArray(group.characterIds)) {
    return group.characterIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  }
  if (typeof group.characterIds !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(group.characterIds);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export type SlurpAudienceCharacterSettings = {
  audienceCharacters: Record<string, string | boolean>;
  audienceCharacterGroupIds: string[];
};

/**
 * Every character eligible to stand in the audience, in priority order.
 *
 * Uncapped on purpose. `audienceCharacterLimit` bounds how many may *act at once*, and the draw
 * that applies it rotates through this list the way the fan cast already rotates returning members
 * and newcomers. Capping here instead would freeze the same few characters forever.
 *
 * Priority is explicit picks first, then group members in group order. So when the limit is
 * smaller than the list, a character the user chose by hand outranks one that arrived in a group
 * of forty. Deterministic: same settings and groups always produce the same order.
 */
export function resolveSlurpAudienceCharacterIds(
  settings: SlurpAudienceCharacterSettings,
  groups: readonly SlurpAudienceCharacterGroup[],
): string[] {
  const entries = settings.audienceCharacters ?? {};
  // An explicit `false` is a removal and outranks group membership; that is the whole point of
  // being able to invite a group and then drop one of its members.
  const excluded = new Set(Object.keys(entries).filter((id) => entries[id] === false));
  const explicit = Object.keys(entries).filter((id) => entries[id] !== false);
  const selectedGroupIds = new Set(settings.audienceCharacterGroupIds ?? []);
  const fromGroups = groups.filter((group) => selectedGroupIds.has(group.id)).flatMap(memberIds);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of [...explicit, ...fromGroups]) {
    if (excluded.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

/**
 * The Fan Type the user pinned to a character, when they pinned one.
 *
 * `true` means "derive it", which is the default and what a group invite writes.
 */
export function slurpAudienceCharacterFanTypeId(
  settings: SlurpAudienceCharacterSettings,
  characterId: string,
): string | null {
  const value = (settings.audienceCharacters ?? {})[characterId];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * A character card, as far as this module cares: the stored `data` blob and an avatar path.
 *
 * `data` is whatever the card holds, string or object, because a V2 card is stored as JSON text and
 * a test is easier to write against an object. Nothing here trusts a field to exist.
 */
export type SlurpAudienceCharacterCard = { data?: unknown };

function cardRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return cardRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cardText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

/** A card list field. Already an array, or JSON text holding one, or nothing usable. */
function cardList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * How a character writes, for the fan-activity prompt.
 *
 * Personality first, then description: personality is the field that says how somebody speaks, and
 * description is the one that says who they are, so a card with both gets the useful half. Scenario,
 * greetings, and example dialogue stay out — they describe a chat that is not happening here, and
 * the whole point of the budget is that this rides in every prompt the character appears in.
 *
 * The result is cut to `voiceBudget`, which the caller takes from `SLURP_FAN_VOICE_PROMPT_MAX` so
 * that a character costs a prompt exactly what a Fan Type voice costs. Cutting at a word boundary
 * rather than mid-word, because a voice ending in "she is extremely deter" reads as corruption.
 *
 * Returns undefined for a card with nothing usable, which leaves the Fan Type's own voice in place
 * rather than sending an empty string the model has to interpret.
 */
export function slurpAudienceCharacterVoice(
  card: SlurpAudienceCharacterCard | null | undefined,
  voiceBudget: number,
): string | undefined {
  const data = cardRecord(card?.data);
  const parts = [cardText(data.personality), cardText(data.description)].filter(Boolean);
  if (parts.length === 0) return undefined;
  const joined = parts.join(" ");
  if (joined.length <= voiceBudget) return joined;
  const cut = joined.slice(0, voiceBudget);
  const lastSpace = cut.lastIndexOf(" ");
  // A single word longer than the whole budget has no boundary to cut on; take the hard slice.
  return (lastSpace > voiceBudget * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/**
 * The card's own tags, for the prompt's `traits`.
 *
 * A V2 card stores `tags` as an array, but it is player-editable and may arrive as a JSON string,
 * so both are accepted. Capped at three to match what a generated member carries, and each tag is
 * length-capped because a "tag" pasted from elsewhere can be a paragraph.
 *
 * An empty result means the caller should fall back to the Fan Type's traits.
 */
export function slurpAudienceCharacterTraits(card: SlurpAudienceCharacterCard | null | undefined): string[] {
  const data = cardRecord(card?.data);
  const traits: string[] = [];
  for (const entry of cardList(data.tags)) {
    const tag = cardText(entry).slice(0, 32);
    if (tag && !traits.includes(tag)) traits.push(tag);
    if (traits.length === 3) break;
  }
  return traits;
}

/** FNV-1a with the murmur3 finalizer, as the other Slurp rule modules use. */
function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  return out >>> 0;
}

/**
 * Which character fans may act in one run.
 *
 * `audienceCharacterLimit` bounds the prompt cost, so when more characters are invited than the
 * limit allows, somebody has to sit out. Taking the first N would mean the last character the user
 * invited never speaks, so the window rotates: a slot derived from the run key walks the list, and
 * everybody gets their turn across runs.
 *
 * Deterministic in `runKey`, so a replayed or resumed run draws the same people. That matters more
 * than it looks: `createNoodlerFanInteraction` compares the stored snapshot against the account
 * row, so a cast that changed between planning and applying would silently drop its own work.
 */
export function selectSlurpAudienceCharacterIds(
  characterIds: readonly string[],
  limit: number,
  runKey: string,
): string[] {
  const capacity = Math.max(0, Math.floor(limit));
  if (capacity === 0 || characterIds.length === 0) return [];
  if (characterIds.length <= capacity) return [...characterIds];
  const start = hash(runKey) % characterIds.length;
  return Array.from({ length: capacity }, (_, index) => characterIds[(start + index) % characterIds.length]!);
}
