/**
 * Slurp's action layer: the named things a helper can do for the player ("improve text", "draw a
 * picture", "steer a Creator", "add an idea", "write a post"). The app's AI assist buttons call these,
 * and so can anything outside the app that the Engine lets reach Slurp (Professor Mari, through the
 * `mari-actions:slurp2` service on Engines with Capability API 1.50).
 *
 * Every action has a name, a one-line summary in plain words, a description of each input, and a zod
 * schema. The server validates every call against the schema here before it runs; the client uses the
 * same schema and types, so both sides agree on one contract. See docs/architecture/README.md
 * ("Action layer").
 */
import { z } from "zod";
import {
  SLP_RELATIONSHIP_STYLES,
  SLP_STEERING_MOODS,
  SLP_STEERING_PACES,
  SLP_STEERING_TEXT_MAX,
} from "./slp-creator-steering.js";
import { SLP_SPICE_LEVELS } from "./slp-spice.js";
import {
  SLP_DESK_BADGES,
  SLP_DESK_CHALLENGE_METRICS,
  SLP_DESK_COINS_MAX,
  SLP_DESK_FEATURE_DAYS_MAX,
  SLP_DESK_PERKS,
  SLP_DESK_THROTTLE_DAYS_MAX,
} from "./slp-support-desk.js";

/**
 * The text fields the assist can write or improve, with what the model is told the field is, who
 * speaks in it, and how long it may be. `creator` = written as the Creator (their brief is used);
 * `player` = the player writes it themself; `about` = notes about the Creator (third person).
 */
export const SLP_ASSIST_FIELDS = {
  bio: { what: "their profile bio on their Slurp page", voice: "creator", max: 500 },
  caption: { what: "the caption of a feed post", voice: "creator", max: 2000 },
  story: { what: "the one short line on a Story picture", voice: "creator", max: 280 },
  reply: { what: "their next direct message in a chat", voice: "creator", max: 1000 },
  voice: {
    what: "how they talk on their page (their stage voice), for the people writing as them",
    voice: "about",
    max: 1000,
  },
  facts: { what: "a few plain facts about them for their page (looks, wardrobe, places)", voice: "about", max: 1000 },
  life: {
    what: "what is going on in their life right now, one short line",
    voice: "about",
    max: SLP_STEERING_TEXT_MAX,
  },
  focus: {
    what: "what they are into or working on lately, one short line",
    voice: "about",
    max: SLP_STEERING_TEXT_MAX,
  },
  idea: { what: "an idea for one of their next posts, one short line", voice: "about", max: 160 },
  chapter: { what: "what happens next in their storyline, one short line", voice: "about", max: 160 },
  brief: { what: "a commission brief: what the fan asks the Creator to make for them", voice: "player", max: 1000 },
  dm: { what: "the fan's direct message to the Creator", voice: "player", max: 1000 },
  support: { what: "Slurp Support's direct message to a Creator", voice: "staff", max: 1000 },
} as const satisfies Record<string, { what: string; voice: "creator" | "player" | "about" | "staff"; max: number }>;
export type SlpAssistField = keyof typeof SLP_ASSIST_FIELDS;
export const SLP_ASSIST_FIELD_NAMES = Object.keys(SLP_ASSIST_FIELDS) as [SlpAssistField, ...SlpAssistField[]];

export const SLP_ASSIST_NOTE_MAX = 400;
export const SLP_ASSIST_REQUEST_MAX = 600;
/** What a drawn picture is for; it sets the size and the framing. */
export const SLP_PICTURE_TARGETS = ["avatar", "cover", "post", "story"] as const;
export type SlpPictureTarget = (typeof SLP_PICTURE_TARGETS)[number];

const accountId = z.string().trim().min(1).max(200);
/** Bonds the player can set between two Creators (mirrors `SLURP_BOND_KINDS`). */
export const SLP_BOND_KINDS = ["friend", "roommate", "coworker", "ex"] as const;
/**
 * What a player can do to a couple (7b-couples); the Stir sheet and the couples panel share it.
 * "official": sparks or dating become together. "secret"/"public": a couple with the player's own page only.
 */
export const SLP_COUPLE_STEERS = [
  "date",
  "drama",
  "patchUp",
  "breakUp",
  "reunite",
  "official",
  "secret",
  "public",
  "moveOn",
  "forget",
] as const;
/**
 * What a breakup leaves behind (#1293): the usual memory and fallout, moved on (history stays, no
 * more dwelling), or forgotten (stops reaching future posts and chats). The client omits "keep"; absent
 * means keep, so older servers and clients still agree.
 */
export const SLP_BREAKUP_AFTERMATHS = ["keep", "moveOn", "forget"] as const;
export type SlpBreakupAftermath = (typeof SLP_BREAKUP_AFTERMATHS)[number];
/** The chapter moves open without Director mode. */
export const SLP_STORYLINE_MOVES = ["hold", "release", "skip", "back", "insert", "label"] as const;
const note = z.string().trim().max(SLP_ASSIST_NOTE_MAX).optional();
/** Nearby text that helps (the post a Story links to, the fan type's name); never written back. */
const context = z.string().trim().max(2000).optional();

const textInput = z
  .object({ field: z.enum(SLP_ASSIST_FIELD_NAMES), accountId: accountId.optional(), note, context })
  .strict();

/** A Slurp perk (docs/SUPPORT-DESK.md): a Discover feature, a badge or a coin bonus. */
const deskPerkSchema = z.object({
  perk: z.enum(SLP_DESK_PERKS),
  badge: z.enum(SLP_DESK_BADGES).optional(),
  coins: z.number().int().min(1).max(SLP_DESK_COINS_MAX).optional(),
  days: z.number().int().min(1).max(SLP_DESK_FEATURE_DAYS_MAX).optional(),
});

export const SLP_ACTIONS = {
  "write-text": {
    summary: "Write a text field from scratch (a bio, a caption, a Story line, a steering note…).",
    inputs: {
      field: `One of: ${SLP_ASSIST_FIELD_NAMES.join(", ")}.`,
      accountId: "The Creator it is for (optional for the player's own texts).",
      note: "What the player wants it to say (optional).",
      context: "Nearby text that helps (optional).",
    },
    schema: textInput,
  },
  "improve-text": {
    summary: "Improve a text the player already wrote, keeping its meaning and language.",
    inputs: {
      field: `One of: ${SLP_ASSIST_FIELD_NAMES.join(", ")}.`,
      text: "The current text.",
      accountId: "The Creator it is for (optional).",
      note: "What should change (optional).",
      context: "Nearby text that helps (optional).",
    },
    schema: textInput.extend({ text: z.string().trim().min(1).max(4000) }).strict(),
  },
  "draw-picture": {
    summary:
      "Draw a picture of a Creator from what the player typed, their brief and their spice level. Returns it without saving it.",
    inputs: {
      accountId: "The Creator.",
      target: `One of: ${SLP_PICTURE_TARGETS.join(", ")}.`,
      request: "What the picture should show, in the player's words (optional for posts: the caption is used).",
      context: "The caption or Story line it goes with (optional).",
      options:
        "Optional switches: who they are (creatorDetails), their look (appearance), reference pictures (sourceReferences), profile framing (composition).",
    },
    schema: z
      .object({
        accountId,
        target: z.enum(SLP_PICTURE_TARGETS),
        request: z.string().trim().max(SLP_ASSIST_REQUEST_MAX).default(""),
        context,
        options: z
          .object({
            creatorDetails: z.boolean(),
            appearance: z.boolean(),
            sourceReferences: z.boolean(),
            composition: z.boolean(),
          })
          .partial()
          .strict()
          .optional(),
      })
      .strict(),
  },
  "use-picture": {
    summary: "Make a drawn picture the Creator's profile picture or cover. The old one is kept for Undo.",
    inputs: { accountId: "The Creator.", target: "avatar or cover.", image: "The picture as a data URL." },
    schema: z
      .object({
        accountId,
        target: z.enum(["avatar", "cover"]),
        image: z
          .string()
          .max(16_000_000)
          .regex(/^data:image\/(png|jpeg|webp);base64,/u),
      })
      .strict(),
  },
  "undo-picture": {
    summary: "Put back the profile picture or cover that was there before the last use-picture.",
    inputs: { accountId: "The Creator.", target: "avatar or cover." },
    schema: z.object({ accountId, target: z.enum(["avatar", "cover"]) }).strict(),
  },
  "keep-picture": {
    summary: "Keep the picture from the last use-picture: the old one is let go and Undo is no longer offered.",
    inputs: { accountId: "The Creator.", target: "avatar or cover." },
    schema: z.object({ accountId, target: z.enum(["avatar", "cover"]) }).strict(),
  },
  "steer-creator": {
    summary: "Change what is going on in a Creator's life: mood, life, focus, topics, how often they post.",
    inputs: {
      accountId: "The Creator.",
      mood: `One of: ${SLP_STEERING_MOODS.join(", ")}, or null for as usual.`,
      lifePhase: "What is going on in their life.",
      focus: "What they are into lately.",
      push: "Topics to bring up more.",
      avoid: "Topics to leave out.",
      pace: `One of: ${SLP_STEERING_PACES.join(", ")}.`,
      relationshipStyle: `One of: ${SLP_RELATIONSHIP_STYLES.join(", ")}, or null to read it from their card (polyamory).`,
    },
    schema: z
      .object({
        accountId,
        mood: z.enum(SLP_STEERING_MOODS).nullable().optional(),
        relationshipStyle: z.enum(SLP_RELATIONSHIP_STYLES).nullable().optional(),
        lifePhase: z.string().trim().max(SLP_STEERING_TEXT_MAX).optional(),
        focus: z.string().trim().max(SLP_STEERING_TEXT_MAX).optional(),
        push: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
        avoid: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
        pace: z.enum(SLP_STEERING_PACES).optional(),
      })
      .strict(),
  },
  "add-idea": {
    summary: "Give a Creator an idea for one of their next posts or Stories. They do it their way.",
    inputs: { accountId: "The Creator.", text: "The idea.", story: "True for a Story (optional)." },
    schema: z
      .object({ accountId, text: z.string().trim().min(1).max(160), story: z.boolean().default(false) })
      .strict(),
  },
  "list-creators": {
    summary:
      "List the Creators on Slurp: their id (every other action takes it as accountId), name and handle. Changes nothing.",
    inputs: {},
    schema: z.object({}).strict(),
  },
  "draft-post": {
    summary:
      "Draft a post from one idea: the caption and its picture, returned without posting so the player reviews it. For the player's own page, which nothing posts for unattended.",
    inputs: {
      accountId: "The Creator page.",
      idea: "What the post is about, in the player's words.",
      story: "True for a Story (optional).",
      dealId: "A brand deal this post is the #ad for (optional).",
      collabId: "A collab this post is about (optional).",
      picture: "False for text only (optional).",
    },
    schema: z
      .object({
        accountId,
        idea: z.string().trim().min(1).max(SLP_ASSIST_REQUEST_MAX),
        story: z.boolean().default(false),
        dealId: accountId.optional(),
        collabId: accountId.optional(),
        picture: z.boolean().default(true),
      })
      .strict(),
  },
  "write-post": {
    summary: "Have a Creator write and post their next post now (it takes their oldest idea, or the one given).",
    inputs: { accountId: "The Creator.", idea: "An idea for this post (optional).", story: "True for a Story." },
    schema: z
      .object({ accountId, idea: z.string().trim().min(1).max(160).optional(), story: z.boolean().default(false) })
      .strict(),
  },
  // ─── Stir (W): the world levers. Each wraps the code its old button already ran. ─────────────────
  "list-world": {
    summary:
      "List what is going on between Creators: couples, collabs, rivalries, events you can start, running storylines, with the ids the other actions take. Changes nothing.",
    inputs: {},
    schema: z.object({}).strict(),
  },
  "suggest-collab": {
    summary:
      "Suggest a collab between two Creators. The one who is asked answers in their own way and may say no, unless happen is true (then they agree now).",
    inputs: { aId: "One Creator.", bId: "The other Creator.", happen: "True to make them agree now (optional)." },
    schema: z.object({ aId: accountId, bId: accountId, happen: z.boolean().default(false) }).strict(),
  },
  "push-collab": {
    summary: "Make a collab request happen: the two agree now.",
    inputs: { collabId: "The collab request (from list-world)." },
    schema: z.object({ collabId: accountId }).strict(),
  },
  "start-rivalry": {
    summary: "Start a rivalry: one Creator throws shade at another. It always happens; their cards colour how.",
    inputs: {
      fromId: "The Creator who starts it (Slurp must post for them).",
      toId: "The Creator it is aimed at.",
      cause: "What set it off, one short line (optional).",
    },
    schema: z
      .object({ fromId: accountId, toId: accountId, cause: z.string().trim().min(1).max(160).optional() })
      .strict(),
  },
  "cool-rivalry": {
    summary: "Cool a rivalry down: the two calm it down in their own way.",
    inputs: { rivalryId: "The rivalry (from list-world)." },
    schema: z.object({ rivalryId: accountId }).strict(),
  },
  "set-up-couple": {
    summary:
      "Set two Creators up: they start to flirt. It always happens; if a card says otherwise it colours how (awkward, reluctant).",
    inputs: { aId: "One Creator.", bId: "The other Creator." },
    schema: z.object({ aId: accountId, bId: accountId }).strict(),
  },
  "steer-couple": {
    summary:
      "Nudge a couple: plan a date, stir some drama, patch it up, break up, or get back together. For an ex (moveOn, forget) it changes what the breakup leaves behind.",
    inputs: {
      coupleId: "The couple (from list-world).",
      steer: `One of: ${SLP_COUPLE_STEERS.join(", ")}.`,
      aftermath: `For breakUp only: one of ${SLP_BREAKUP_AFTERMATHS.join(", ")} (optional; default keep). Never send it with moveOn, forget or any other steer.`,
    },
    schema: z
      .object({
        coupleId: accountId,
        steer: z.enum(SLP_COUPLE_STEERS),
        aftermath: z.enum(SLP_BREAKUP_AFTERMATHS).optional(),
      })
      .strict(),
  },
  "set-bond": {
    summary:
      "Make two Creators friends, best friends, roommates, coworkers or exes. A bond the player sets stays until the player ends it.",
    inputs: {
      aId: "One Creator.",
      bId: "The other Creator.",
      kind: `One of: ${SLP_BOND_KINDS.join(", ")}.`,
      level: "For friends only: 0 acquaintances to 3 best friends (optional, 1).",
    },
    schema: z
      .object({
        aId: accountId,
        bId: accountId,
        kind: z.enum(SLP_BOND_KINDS),
        level: z.number().int().min(0).max(3).optional(),
      })
      .strict(),
  },
  "end-bond": {
    summary: "End a bond: they stop being friends, move out, stop working together, or let the ex go.",
    inputs: { bondId: "The bond (from list-world)." },
    schema: z.object({ bondId: accountId }).strict(),
  },
  "start-drama": {
    summary:
      "Start a drama pack now (it must be switched on): Slurp casts the roles, or the player picks who leads it.",
    inputs: {
      dramaId: "The drama (from list-world).",
      leadId: "The Creator in its first role (optional; must fit it).",
    },
    schema: z.object({ dramaId: accountId, leadId: accountId.optional() }).strict(),
  },
  "end-drama": {
    summary: "End a running drama now: nothing more of it goes out.",
    inputs: { runId: "The running drama (from list-world)." },
    schema: z.object({ runId: accountId }).strict(),
  },
  "couple-page": {
    summary: "Open a couple's shared page, or close it with a goodbye post.",
    inputs: { coupleId: "The couple (from list-world).", open: "True to open, false to close." },
    schema: z.object({ coupleId: accountId, open: z.boolean() }).strict(),
  },
  "start-event": {
    summary: "Start a Slurp event now (SlurpCon, a holiday…). Every Creator it fits joins.",
    inputs: { eventId: "The event (from list-world)." },
    schema: z.object({ eventId: accountId }).strict(),
  },
  "steer-storyline": {
    summary:
      "Move a Creator's running storyline: stay on this chapter (hold), let it move on (release), move on now (skip), go back (back), add what happens next (insert) or rename the chapter (label).",
    inputs: {
      accountId: "The Creator.",
      projectId: "The storyline (from list-world).",
      move: `One of: ${SLP_STORYLINE_MOVES.join(", ")}.`,
      text: "The new chapter, for insert and label.",
    },
    schema: z
      .object({
        accountId,
        projectId: accountId,
        move: z.enum(SLP_STORYLINE_MOVES),
        text: z.string().trim().min(1).max(200).optional(),
      })
      // insert and label need the text; the runner says so (a refine would hide the shape).
      .strict(),
  },
  "run-audience": {
    summary: "Wake the fans up now: they like, comment and reply. Uses the AI connection.",
    inputs: {},
    schema: z.object({}).strict(),
  },
  "set-spice": {
    summary: "Set how spicy a Creator gets (under the Slurp-wide limit); null goes back to the default.",
    inputs: { accountId: "The Creator.", level: `One of: ${SLP_SPICE_LEVELS.join(", ")}, or null.` },
    schema: z.object({ accountId, level: z.enum(SLP_SPICE_LEVELS).nullable() }).strict(),
  },
  // ─── Brands (R). `offer-brand-deal` is the Stir lever "give <Creator> a deal with <brand / product>". ──
  "list-brands": {
    summary:
      "List the brands that can sponsor Creators and their products (ids, name, one-line pitch, spice fit). With accountId, each product also says whether it fits that Creator. Changes nothing.",
    inputs: { accountId: "A Creator, to mark which products fit them (optional)." },
    schema: z.object({ accountId: accountId.optional() }).strict(),
  },
  "offer-brand-deal": {
    summary:
      "Give a Creator a paid partnership: a brand (or one of its products) offers them a sponsored post. They answer in their own way and may say no, unless happen is true. With preview true it only says what would happen.",
    inputs: {
      accountId: "The Creator.",
      brandId: "The brand (from list-brands, optional): its best-fitting product is picked.",
      productId: "One product (from list-brands, optional); wins over brandId.",
      happen: "True to make them say yes now (optional).",
      preview: "True to see who, what, the fee and fit notes without changing anything (optional).",
    },
    schema: z
      .object({
        accountId,
        brandId: z.string().trim().min(1).max(120).optional(),
        productId: z.string().trim().min(1).max(120).optional(),
        happen: z.boolean().default(false),
        preview: z.boolean().default(false),
      })
      .strict(),
  },
  // ─── 0.3.1: new world levers over systems that already exist (storylines, goals, looks, events). ──
  "start-storyline": {
    summary:
      "Give a Creator a new storyline: what they go through over the next posts (training for a marathon, a move abroad). With withIds it is a crossover the others share.",
    inputs: {
      accountId: "The Creator.",
      title: "The storyline in a few words, in the player's words.",
      direction: "Where it should go, one short line (optional).",
      withIds: "One or two more Creators who share it (optional).",
    },
    schema: z
      .object({
        accountId,
        title: z.string().trim().min(1).max(80),
        direction: z.string().trim().max(300).optional(),
        withIds: z.array(accountId).max(2).optional(),
      })
      .strict(),
  },
  "set-tip-goal": {
    summary: "Open a tip goal for a Creator: something they ask their fans to help pay for (a new camera).",
    inputs: {
      accountId: "The Creator.",
      label: "What it is for.",
      target: "How many dollars it needs (Creator earnings are in dollars).",
    },
    schema: z
      .object({
        accountId,
        label: z.string().trim().min(1).max(80),
        target: z.number().int().min(1).max(1_000_000),
      })
      .strict(),
  },
  "new-look": {
    summary:
      "Change how a Creator looks from now on (pink hair, a tattoo, a new style). Their pictures show it; the rest of their look stays.",
    inputs: { accountId: "The Creator.", change: "What changes, one short line." },
    schema: z.object({ accountId, change: z.string().trim().min(1).max(300) }).strict(),
  },
  "invent-event": {
    summary:
      "Make up a Slurp event in the player's words and start it now (a heatwave, Slurp is down, a dance challenge). Every Creator joins in their own way.",
    inputs: {
      name: "The event's name, a few words.",
      guidance: "What it is and what people post about, one or two lines (optional).",
      days: "How many days it lasts, 1 to 14.",
    },
    schema: z
      .object({
        name: z.string().trim().min(1).max(60),
        guidance: z.string().trim().max(600).default(""),
        days: z.number().int().min(1).max(14).default(1),
      })
      .strict(),
  },
  "draw-brand-picture": {
    summary:
      "Draw a brand's logo, or a picture of one of its products, from the brand's own words and what the player typed. Returns it without saving it.",
    inputs: {
      brandId: "The brand (from list-brands or Backstage).",
      productId: "The product, for a product picture (optional: without it the logo is drawn).",
      request: "What the picture should show, in the player's words (optional).",
    },
    schema: z
      .object({
        brandId: z.string().trim().min(1).max(120),
        productId: z.string().trim().min(1).max(120).optional(),
        request: z.string().trim().max(SLP_ASSIST_REQUEST_MAX).default(""),
      })
      .strict(),
  },
  "add-to-couple": {
    summary:
      "Polyamory: someone joins a couple that is dating or together, up to four people. Only when polyamory is on in Settings › Stir.",
    inputs: { coupleId: "The couple (from list-world).", accountId: "The Creator who joins." },
    schema: z.object({ coupleId: accountId, accountId }).strict(),
  },
  // ─── 0.3.5: the Slurp Support desk (docs/SUPPORT-DESK.md). Offered in a Support thread, the Creator
  // answers first; run from Stir or a helper, they just happen. ───────────────────────────────────
  "grant-perk": {
    summary:
      "Slurp gives a Creator a perk: a Discover feature for some days, a badge (rising, verified, partner) or a coin bonus. They owe Slurp a favour for it.",
    inputs: {
      accountId: "The Creator.",
      perk: `One of: ${SLP_DESK_PERKS.join(", ")}.`,
      badge: `For badge: one of ${SLP_DESK_BADGES.join(", ")}.`,
      coins: `For coins: how many, 1 to ${SLP_DESK_COINS_MAX}.`,
      days: `For feature: how many days, 1 to ${SLP_DESK_FEATURE_DAYS_MAX}.`,
    },
    schema: deskPerkSchema.extend({ accountId }).strict(),
  },
  "set-challenge": {
    summary:
      "Give a Creator a challenge from Slurp: post so many posts or Stories before a deadline and win a perk. The world counts; they win or fail.",
    inputs: {
      accountId: "The Creator.",
      metric: `What counts: ${SLP_DESK_CHALLENGE_METRICS.join(" or ")}.`,
      count: "How many, 1 to 30.",
      days: "Days to do it in, 1 to 14.",
      reward: "The perk they win: { perk, badge?, coins?, days? } like grant-perk.",
    },
    schema: z
      .object({
        accountId,
        metric: z.enum(SLP_DESK_CHALLENGE_METRICS),
        count: z.number().int().min(1).max(30),
        days: z.number().int().min(1).max(14),
        reward: deskPerkSchema.strict(),
      })
      .strict(),
  },
  "offer-contract": {
    summary:
      "Sign a Creator to an exclusive Slurp contract: so many posts a week (maybe on set themes) for a weekly coin bonus. A week they miss pays nothing.",
    inputs: {
      accountId: "The Creator.",
      postsPerWeek: "Posts and Stories a week, 1 to 21.",
      themes: "Up to 3 themes their posts should be about (optional).",
      weeks: "How long it runs, 1 to 12 weeks.",
      weeklyBonus: `Coins a kept week pays, 0 to ${SLP_DESK_COINS_MAX}.`,
    },
    schema: z
      .object({
        accountId,
        postsPerWeek: z.number().int().min(1).max(21),
        themes: z.array(z.string().trim().min(1).max(60)).max(3).default([]),
        weeks: z.number().int().min(1).max(12).default(4),
        weeklyBonus: z.number().int().min(0).max(SLP_DESK_COINS_MAX).default(100),
      })
      .strict(),
  },
  "cash-favour": {
    summary:
      "Call in a favour a Creator owes Slurp: they do what Slurp asks in their next posts. Shady: it raises their suspicion.",
    inputs: { accountId: "The Creator.", ask: "What Slurp asks for, one short line." },
    schema: z.object({ accountId, ask: z.string().trim().min(1).max(160) }).strict(),
  },
  "throttle-reach": {
    summary:
      "Quietly show fewer people a Creator's posts for some days. Shady: it raises their suspicion, and they may notice.",
    inputs: {
      accountId: "The Creator.",
      days: `How many days, 1 to ${SLP_DESK_THROTTLE_DAYS_MAX}.`,
      strength: "light or heavy.",
    },
    schema: z
      .object({
        accountId,
        days: z.number().int().min(1).max(SLP_DESK_THROTTLE_DAYS_MAX).default(2),
        strength: z.enum(["light", "heavy"]).default("light"),
      })
      .strict(),
  },
  "plant-rumour": {
    summary:
      'Plant a rumour with a Creator ("I heard X plans a collab with Y"). They remember it; about another Creator it may start a rivalry. Told by Support it is traceable; anonymous it is quieter.',
    inputs: {
      accountId: "The Creator who hears it.",
      text: "The rumour, one short line.",
      aboutId: "The Creator it is about (optional).",
      via: "support (Slurp Support says it) or anonymous.",
    },
    schema: z
      .object({
        accountId,
        text: z.string().trim().min(1).max(200),
        aboutId: accountId.optional(),
        via: z.enum(["support", "anonymous"]).default("anonymous"),
      })
      .strict(),
  },
  "seed-trend": {
    summary: "Tell a few Creators a topic is hot on Slurp right now. Each gets it as an idea for a post.",
    inputs: { topic: "The topic, a few words.", accountIds: "One to six Creators." },
    schema: z
      .object({ topic: z.string().trim().min(1).max(80), accountIds: z.array(accountId).min(1).max(6) })
      .strict(),
  },
  "warn-creator": {
    summary:
      "Slurp Support warns a Creator about their content. They tone it down (the topic goes on their leave-alone list). It costs trust; a warning without cause is shady.",
    inputs: {
      accountId: "The Creator.",
      reason: "What Slurp says is wrong, one short line.",
      topic: "A topic they should leave alone for now (optional).",
      cause: "False when there was no real reason (shady).",
    },
    schema: z
      .object({
        accountId,
        reason: z.string().trim().min(1).max(200),
        topic: z.string().trim().min(1).max(60).optional(),
        cause: z.boolean().default(true),
      })
      .strict(),
  },
} as const;

export type SlpActionName = keyof typeof SLP_ACTIONS;
export const SLP_ACTION_NAMES = Object.keys(SLP_ACTIONS) as SlpActionName[];
export type SlpActionInput<N extends SlpActionName> = z.input<(typeof SLP_ACTIONS)[N]["schema"]>;
export type SlpActionParsed<N extends SlpActionName> = z.output<(typeof SLP_ACTIONS)[N]["schema"]>;

/** What `list-world` answers: the ids and names the world levers take. */
export type SlpStirWorld = {
  couples: {
    id: string;
    aId: string;
    bId: string;
    /** Polyamory (0.3.5): more partners. */
    moreIds?: string[];
    stage: string;
    page: "open" | "closed" | null;
    /** A couple with the player's own page, kept out of public. */
    secret?: boolean;
    /** #1293: how an ex handles the breakup; absent is the usual memory and fallout. */
    aftermath?: Exclude<SlpBreakupAftermath, "keep"> | null;
  }[];
  collabs: { id: string; hostId: string; partnerId: string; status: string }[];
  rivalries: { id: string; fromId: string; toId: string; stage: string }[];
  events: { id: string; name: string; running: boolean }[];
  storylines: { accountId: string; projectId: string; title: string; chapter: string; held: boolean }[];
  /** Friends, roommates, coworkers and exes (0.3.11: Stir sets and ends them). */
  bonds?: { id: string; aId: string; bId: string; kind: string; level: number }[];
  /** Drama packs switched on, and the ones running now with their cast (0.3.11). */
  dramas?: { id: string; name: string; description: string; leadRole: string }[];
  runs?: { id: string; dramaId: string; name: string; stage: string; cast: Record<string, string> }[];
};

/** Where a lever sits in the Stir deck. `help` (writing and picture help) is not a card. */
export const SLP_STIR_CATEGORIES = ["love", "work", "drama", "life", "world"] as const;
export type SlpStirCategory = (typeof SLP_STIR_CATEGORIES)[number];

/**
 * How each action shows in Stir: its deck category, what it acts on, whether one Undo can take it
 * back, whether it calls the AI now, and whether the Creator may say no (work plays; W decision:
 * love and drama always happen, a card only colours how). Every action has an entry (typed).
 */
export const SLP_ACTION_META: Record<
  SlpActionName,
  {
    category: SlpStirCategory | "help" | "desk";
    targets: "creator" | "pair" | "couple" | "collab" | "rivalry" | "event" | "storyline" | "bond" | "drama" | "none";
    reversible: boolean;
    ai: boolean;
    refusable: boolean;
    /** A card in the Stir deck (the rest are reached from a Creator, a list row, or plain words). */
    deck: boolean;
  }
> = {
  "write-text": { category: "help", targets: "creator", reversible: false, ai: true, refusable: false, deck: false },
  "improve-text": { category: "help", targets: "creator", reversible: false, ai: true, refusable: false, deck: false },
  "draw-picture": { category: "help", targets: "creator", reversible: false, ai: true, refusable: false, deck: false },
  "use-picture": { category: "help", targets: "creator", reversible: true, ai: false, refusable: false, deck: false },
  "undo-picture": { category: "help", targets: "creator", reversible: false, ai: false, refusable: false, deck: false },
  "keep-picture": { category: "help", targets: "creator", reversible: false, ai: false, refusable: false, deck: false },
  "list-creators": { category: "help", targets: "none", reversible: false, ai: false, refusable: false, deck: false },
  "list-world": { category: "help", targets: "none", reversible: false, ai: false, refusable: false, deck: false },
  "add-idea": { category: "life", targets: "creator", reversible: true, ai: false, refusable: false, deck: true },
  "write-post": { category: "life", targets: "creator", reversible: false, ai: true, refusable: false, deck: true },
  "draft-post": { category: "help", targets: "creator", reversible: false, ai: true, refusable: false, deck: false },
  "steer-creator": { category: "life", targets: "creator", reversible: true, ai: false, refusable: false, deck: true },
  "set-spice": { category: "life", targets: "creator", reversible: true, ai: false, refusable: false, deck: true },
  "set-up-couple": { category: "love", targets: "pair", reversible: true, ai: false, refusable: false, deck: true },
  "steer-couple": { category: "love", targets: "couple", reversible: true, ai: false, refusable: false, deck: true },
  "couple-page": { category: "love", targets: "couple", reversible: false, ai: false, refusable: false, deck: true },
  "set-bond": { category: "life", targets: "pair", reversible: true, ai: false, refusable: false, deck: true },
  "end-bond": { category: "life", targets: "bond", reversible: true, ai: false, refusable: false, deck: false },
  "start-drama": { category: "drama", targets: "drama", reversible: true, ai: false, refusable: false, deck: true },
  "end-drama": { category: "drama", targets: "drama", reversible: false, ai: false, refusable: false, deck: false },
  "suggest-collab": { category: "work", targets: "pair", reversible: true, ai: false, refusable: true, deck: true },
  "push-collab": { category: "work", targets: "collab", reversible: true, ai: false, refusable: false, deck: true },
  "start-rivalry": { category: "drama", targets: "pair", reversible: true, ai: false, refusable: false, deck: true },
  "cool-rivalry": { category: "drama", targets: "rivalry", reversible: true, ai: false, refusable: false, deck: true },
  "start-event": { category: "world", targets: "event", reversible: true, ai: false, refusable: false, deck: true },
  "steer-storyline": {
    category: "world",
    targets: "storyline",
    reversible: true,
    ai: false,
    refusable: false,
    deck: true,
  },
  "run-audience": { category: "world", targets: "none", reversible: false, ai: true, refusable: false, deck: true },
  "list-brands": { category: "help", targets: "none", reversible: false, ai: false, refusable: false, deck: false },
  "draw-brand-picture": {
    category: "help",
    targets: "none",
    reversible: false,
    ai: true,
    refusable: false,
    deck: false,
  },
  "offer-brand-deal": {
    category: "work",
    targets: "creator",
    reversible: false,
    ai: false,
    refusable: true,
    deck: true,
  },
  "start-storyline": {
    category: "life",
    targets: "creator",
    reversible: true,
    ai: false,
    refusable: false,
    deck: true,
  },
  "set-tip-goal": { category: "work", targets: "creator", reversible: true, ai: false, refusable: false, deck: true },
  "new-look": { category: "life", targets: "creator", reversible: true, ai: false, refusable: false, deck: true },
  "invent-event": { category: "world", targets: "none", reversible: true, ai: false, refusable: false, deck: true },
  "add-to-couple": { category: "love", targets: "couple", reversible: true, ai: false, refusable: false, deck: true },
  // The Support desk's tools live on the desk and in Support threads, not in the deck.
  "grant-perk": { category: "desk", targets: "creator", reversible: true, ai: false, refusable: false, deck: false },
  "set-challenge": { category: "desk", targets: "creator", reversible: true, ai: false, refusable: true, deck: false },
  "offer-contract": { category: "desk", targets: "creator", reversible: true, ai: false, refusable: true, deck: false },
  "cash-favour": { category: "desk", targets: "creator", reversible: true, ai: false, refusable: true, deck: false },
  "throttle-reach": {
    category: "desk",
    targets: "creator",
    reversible: true,
    ai: false,
    refusable: false,
    deck: false,
  },
  "plant-rumour": { category: "desk", targets: "creator", reversible: false, ai: false, refusable: false, deck: false },
  "seed-trend": { category: "desk", targets: "none", reversible: true, ai: false, refusable: false, deck: false },
  "warn-creator": { category: "desk", targets: "creator", reversible: true, ai: false, refusable: false, deck: false },
};

/** What Slurp Support can put in a thread as an Offer: the Creator answers yes, no or a counter first. */
export const SLP_DESK_OFFERABLE = [
  "set-challenge",
  "offer-contract",
  "cash-favour",
  "offer-brand-deal",
  "suggest-collab",
  "start-storyline",
  "set-tip-goal",
  "new-look",
  "add-idea",
] as const satisfies readonly SlpActionName[];
/** What Slurp Support does in a thread straight away, with its message. */
export const SLP_DESK_NOW = ["grant-perk", "warn-creator", "plant-rumour"] as const satisfies readonly SlpActionName[];

/** The catalog without the schemas: what a helper reads to know what it can ask Slurp to do. */
export function slpActionCatalog() {
  return SLP_ACTION_NAMES.map((name) => ({
    name,
    summary: SLP_ACTIONS[name].summary,
    inputs: SLP_ACTIONS[name].inputs,
    ...SLP_ACTION_META[name],
  }));
}

/**
 * The service keys the action layer registers under. `slurp2:actions` always; `mari-actions:slurp2`
 * for Professor Mari only when this package's manifest holds the `mari-actions` permission, which
 * only an Engine with Capability API 1.50 accepts (the builder adds it once slurp2 declares 1.50).
 * An older Engine never sees the key, so Slurp loads the same there (J2).
 */
export function slpActionServiceKeys(permissions: readonly unknown[] | null | undefined): string[] {
  return ["slurp2:actions", ...(permissions?.includes("mari-actions") ? ["mari-actions:slurp2"] : [])];
}

export function isSlpActionName(value: string): value is SlpActionName {
  return Object.hasOwn(SLP_ACTIONS, value);
}
