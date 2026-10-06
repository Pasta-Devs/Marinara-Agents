import { z } from "zod";

/**
 * Drama pack entries (`docs/DRAMA.md`): **situations** (a standing state with a deck of small beats,
 * no end) and **dramas** (stages with a cast, choices and an exit). Both ride Story Packs as optional
 * arrays, so older packs import unchanged. The engine knows no genre: every drama is data here.
 *
 * Rules the schema enforces (a bad entry is refused with a clear message, never half-imported):
 * - a `post` beat carries a `heat` block (the one drama line and its heat angle); other channels may not
 * - every role a beat, choice or outcome names exists; stage keys are unique; choices lead somewhere real
 * - every drama has `maxDays` and an `exit`; text is short
 */

const key = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,31}$/u, "use lowercase letters, digits and dashes");
const text = (max: number) => z.string().trim().min(1).max(max);
const spice = z.number().int().min(0).max(3);

export const SLP_DRAMA_CHANNELS = ["post", "dm", "comment", "notification", "money"] as const;
export type SlpDramaChannel = (typeof SLP_DRAMA_CHANNELS)[number];
export const SLP_RELATIONS_TO_PLAYER = ["partner", "ex", "roommate", "friend", "crush"] as const;
export type SlpRelationToPlayer = (typeof SLP_RELATIONS_TO_PLAYER)[number];
export const SLP_DRAMA_TIE_KINDS = ["friend", "roommate", "coworker", "ex", "rival", "couple"] as const;

/** Who may fill a role. The player role is the player's own persona page, never cast by the world. */
export const slpDramaRoleSchema = z
  .object({
    key,
    player: z.boolean().optional(),
    needs: z
      .object({
        /** The Creator is this to the player's persona (her relation to you). */
        relationToPlayer: z.array(z.enum(SLP_RELATIONS_TO_PLAYER)).min(1).max(5).optional(),
        gender: z.enum(["male", "female", "other"]).optional(),
        minSpice: spice.optional(),
        /** Shares a tag or interest with that role. */
        sharesNicheWith: key.optional(),
        /** Already tied to that role in one of these ways. */
        tiedTo: z
          .object({ role: key, kinds: z.array(z.enum(SLP_DRAMA_TIE_KINDS)).min(1).max(6) })
          .strict()
          .optional(),
      })
      .strict()
      .default({}),
    /** Newcomers (joined in the last two weeks) or the biggest pages first. */
    prefer: z.enum(["newcomer", "popular"]).optional(),
  })
  .strict();
export type SlpDramaRole = z.infer<typeof slpDramaRoleSchema>;

export const slpDramaHeatSchema = z
  .object({
    /** The one drama line the post may carry: its *why*, in a few words, never an infodump. */
    line: text(200),
    with: key.optional(),
    shotBy: key.optional(),
    for: z.union([key, z.literal("fans")]).optional(),
  })
  .strict();

export const slpDramaBeatSchema = z
  .object({
    /** Who acts: a role, or the crowd (comments only). */
    role: z.union([key, z.literal("crowd")]),
    channel: z.enum(SLP_DRAMA_CHANNELS),
    /** dm / money: who receives it (a role; "player" for the player's persona). */
    to: key.optional(),
    /** comment: on the newest post of this role. */
    on: key.optional(),
    /** dm and notification: what it is about, in a few words; the Creator writes the message. */
    seed: text(200).optional(),
    /** comment: the lines to pick from (crowd or a role), short. */
    lines: z.array(text(120)).min(1).max(8).optional(),
    heat: slpDramaHeatSchema.optional(),
    /** money: how much, in coins. */
    amount: z
      .object({ min: z.number().int().min(1).max(100_000), max: z.number().int().min(1).max(100_000) })
      .strict()
      .optional(),
    delayHours: z.tuple([z.number().min(0).max(72), z.number().min(0).max(72)]).optional(),
    /** Percent chance this beat happens at all. */
    chance: z.number().int().min(1).max(100).optional(),
    /** Situation decks: only while the situation's dials have these values. */
    when: z.record(key, key).optional(),
  })
  .strict()
  .superRefine((beat, context) => {
    const issue = (message: string) => context.addIssue({ code: "custom", message });
    if (beat.channel === "post" && !beat.heat) issue("a post beat needs a heat block (its one line and angle)");
    if (beat.channel !== "post" && beat.heat) issue("only a post beat carries heat");
    if (beat.role === "crowd" && beat.channel !== "comment") issue("the crowd only comments");
    if (beat.channel === "comment" && (!beat.on || !beat.lines)) issue("a comment beat needs `on` and `lines`");
    if ((beat.channel === "dm" || beat.channel === "money") && !beat.to) issue(`a ${beat.channel} beat needs \`to\``);
    if ((beat.channel === "dm" || beat.channel === "notification") && !beat.seed)
      issue(`a ${beat.channel} beat needs a seed`);
    if (beat.channel === "money" && (!beat.amount || beat.amount.min > beat.amount.max))
      issue("a money beat needs an amount (min ≤ max)");
    if (beat.delayHours && beat.delayHours[0] > beat.delayHours[1]) issue("delayHours goes from low to high");
  });
export type SlpDramaBeat = z.infer<typeof slpDramaBeatSchema>;

export const slpDramaOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("tie"),
      tie: z.enum(SLP_DRAMA_TIE_KINDS),
      between: z.tuple([key, key]),
      level: z.number().int().min(0).max(3).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("end-tie"), tie: z.enum(SLP_DRAMA_TIE_KINDS), between: z.tuple([key, key]) }).strict(),
  z
    .object({ kind: z.literal("temperature"), between: z.tuple([key, key]), value: z.enum(["warm", "tense", "cold"]) })
    .strict(),
]);
export type SlpDramaOutcome = z.infer<typeof slpDramaOutcomeSchema>;

export const slpDramaChoiceSchema = z
  .object({
    asks: z.enum(["fans", "player", "role"]),
    /** asks role: the role that decides (by their card). */
    role: key.optional(),
    question: text(200),
    options: z
      .array(z.object({ label: text(60), next: z.union([key, z.literal("end")]) }).strict())
      .min(2)
      .max(4),
    /** The option taken when nobody answers in time (0-based). The pack decides. */
    default: z.number().int().min(0).max(3),
    timeoutDays: z.number().int().min(1).max(14).default(2),
  })
  .strict();
export type SlpDramaChoice = z.infer<typeof slpDramaChoiceSchema>;

export const slpDramaStageSchema = z
  .object({
    key,
    days: z.tuple([z.number().int().min(0).max(30), z.number().int().min(0).max(30)]),
    minSpice: spice.optional(),
    beats: z.array(slpDramaBeatSchema).max(8).default([]),
    choice: slpDramaChoiceSchema.optional(),
    /** Without a choice: the next stage (default: the next one in the list, or the end). */
    next: z.union([key, z.literal("end")]).optional(),
    outcomes: z.array(slpDramaOutcomeSchema).max(6).default([]),
  })
  .strict();
export type SlpDramaStage = z.infer<typeof slpDramaStageSchema>;

const common = {
  id: key,
  name: text(80),
  description: z.string().trim().max(600).default(""),
  roles: z.array(slpDramaRoleSchema).min(1).max(5),
  enabled: z.boolean().default(false),
  builtin: z.boolean().default(false),
};

/**
 * Every role a beat, choice, outcome or role condition names must exist. "crowd" is only who acts in
 * a beat and "fans" only who a post is for: `beatRoles` leaves those two out where they belong.
 */
function checkRoles(entry: { roles: SlpDramaRole[] }, named: (string | undefined)[], context: z.RefinementCtx): void {
  const keys = entry.roles.map((role) => role.key);
  const known = new Set(keys);
  if (known.size !== keys.length) context.addIssue({ code: "custom", message: "role keys must be unique" });
  const conditions = entry.roles.flatMap((role) => [role.needs.tiedTo?.role, role.needs.sharesNicheWith]);
  for (const name of [...named, ...conditions])
    if (name && !known.has(name)) context.addIssue({ code: "custom", message: `unknown role "${name}"` });
}
const beatRoles = (beat: SlpDramaBeat) => [
  beat.role === "crowd" ? undefined : beat.role,
  beat.to,
  beat.on,
  beat.heat?.with,
  beat.heat?.shotBy,
  beat.heat?.for === "fans" ? undefined : beat.heat?.for,
];

export const slpSituationSchema = z
  .object({
    ...common,
    dials: z
      .array(
        z
          .object({ key, options: z.array(key).min(2).max(5), default: key })
          .strict()
          .refine((dial) => dial.options.includes(dial.default), "a dial's default is one of its options"),
      )
      .max(6)
      .default([]),
    /** Small beats drawn now and then while the situation stands. `when` limits a beat to dial values. */
    deck: z.array(slpDramaBeatSchema).min(1).max(24),
    /** At most this many deck beats reach the player a day. */
    perDay: z.number().int().min(1).max(6).default(2),
  })
  .strict()
  .superRefine((situation, context) => checkRoles(situation, situation.deck.flatMap(beatRoles), context));
export type SlpSituation = z.infer<typeof slpSituationSchema>;

export const slpDramaSchema = z
  .object({
    ...common,
    /** Runs only while this situation stands (its roles are shared by key). */
    requires: z.object({ situation: key }).strict().optional(),
    weight: z.number().min(0.1).max(10).default(1),
    cooldownDays: z.number().int().min(0).max(365).default(21),
    maxDays: z.number().int().min(1).max(90),
    stages: z.array(slpDramaStageSchema).min(1).max(10),
    exit: slpDramaBeatSchema,
  })
  .strict()
  .superRefine((drama, context) => {
    const issue = (message: string) => context.addIssue({ code: "custom", message });
    const stageKeys = drama.stages.map((stage) => stage.key);
    if (new Set(stageKeys).size !== stageKeys.length) issue("stage keys must be unique");
    const reachable = new Set([...stageKeys, "end"]);
    for (const stage of drama.stages) {
      if (stage.days[0] > stage.days[1]) issue(`stage "${stage.key}": days go from low to high`);
      if (stage.next && !reachable.has(stage.next)) issue(`stage "${stage.key}": next "${stage.next}" does not exist`);
      if (stage.choice) {
        if (stage.choice.default >= stage.choice.options.length)
          issue(`stage "${stage.key}": the default is not an option`);
        if (stage.choice.asks === "role" && !stage.choice.role)
          issue(`stage "${stage.key}": a role choice names its role`);
        for (const option of stage.choice.options)
          if (!reachable.has(option.next)) issue(`stage "${stage.key}": option "${option.label}" leads nowhere`);
      }
    }
    const minimum = drama.stages.reduce((sum, stage) => sum + stage.days[0], 0);
    if (minimum > drama.maxDays) issue("maxDays is shorter than the stages need");
    checkRoles(
      drama,
      [
        ...drama.stages.flatMap((stage) => [
          ...stage.beats.flatMap(beatRoles),
          stage.choice?.role,
          ...stage.outcomes.flatMap((outcome) => outcome.between),
        ]),
        ...beatRoles(drama.exit),
      ],
      context,
    );
  });
export type SlpDrama = z.infer<typeof slpDramaSchema>;

// ---------------------------------------------------------------------------------------------
// Settings (Backstage › Drama)

export const SLP_DRAMA_LEVELS = ["calm", "lively", "soap"] as const;
export type SlpDramaLevel = (typeof SLP_DRAMA_LEVELS)[number];

/** Field by field: a bad or missing field falls back to its default, the rest stays. */
export const slpDramaSettingsSchema = z
  .object({
    /** How much drama runs at once and how often a post carries a drama line. */
    level: z.enum(SLP_DRAMA_LEVELS).catch("lively"),
    /** Situations and dramas the player switched on, by id. Empty: nothing runs. */
    // Entry by entry: a bad id is dropped, not the whole list (one bad value used to switch everything off).
    enabled: z
      .array(z.unknown())
      .catch([])
      .transform((list) => [...new Set(list.filter((id): id is string => key.safeParse(id).success))].slice(0, 200)),
    /** A situation's dials, by situation id and dial key (e.g. "audience-knows": "yes"). */
    dials: z.record(key, z.record(key, key)).catch({}),
  })
  .catch({ level: "lively", enabled: [], dials: {} });
export type SlpDramaSettings = z.infer<typeof slpDramaSettingsSchema>;
export const SLP_DEFAULT_DRAMA_SETTINGS: SlpDramaSettings = slpDramaSettingsSchema.parse({});

export const normalizeSlpDramaSettings = (raw: unknown): SlpDramaSettings => slpDramaSettingsSchema.parse(raw ?? {});

/** The role pairs a drama ends as a couple: casting keeps the player's romance settings for them (0.3.17). */
export const slpDramaCouplePairs = (drama: { stages: readonly { outcomes: readonly SlpDramaOutcome[] }[] }) =>
  drama.stages.flatMap((stage) =>
    stage.outcomes.flatMap((outcome) => (outcome.kind === "tie" && outcome.tie === "couple" ? [outcome.between] : [])),
  );
