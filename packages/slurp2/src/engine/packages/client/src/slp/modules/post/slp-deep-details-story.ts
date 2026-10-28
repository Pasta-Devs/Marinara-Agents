import type {
  SlpDeepDetailsImageRun,
  SlpDeepDetailsRecord,
  SlpDeepDetailsResponse,
} from "../../../../../shared/src/slp/slp-deep-details.js";
import { readSlpPurpose, type SlpPurpose } from "../../../../../shared/src/slp/slp-post-purpose.js";
import { formatFullTime } from "../../base/ui/slp-date-time";
import type { SlpStepStatus } from "./SlpDeepDetailsParts";
import type { SlpFlowNode, SlpFlowRow } from "./slp-deep-details-flow";

/**
 * Deep details as a short story (M): what a post was for, what happened in it, who the Creator was
 * that day, the player's steering, the spice, who it was made with, the picture, the writing and the
 * cost. Plain in-world words from the stored record; nothing is re-read from today's settings. Pure,
 * so the phone summary and the tests read one model.
 */

export type SlpDeepChainStep = { label: string; text: string; state: "done" | "this" | "next" };

export type SlpDeepRowId =
  "why" | "happens" | "voice" | "steering" | "spice" | "together" | "picture" | "writing" | "cost" | "since";

export type SlpDeepRow = {
  id: SlpDeepRowId;
  title: string;
  /** One line of what happened. Null = nothing was recorded (the row does not open). */
  line: string | null;
  status?: SlpStepStatus;
  /** The purpose chain: tease → drop, poll → answer, a pack's moment. */
  chain?: SlpDeepChainStep[];
  /** Plain sentences. */
  sentences?: string[];
  /** Bulleted details, each with a muted note of what it is. */
  items?: { text: string; note: string | null }[];
  /** A line quoted as it was given (their voice, the brief for the moment). */
  quote?: { label: string; text: string } | null;
  /** What the enhance step changed in the picture prompt. */
  changes?: { added: string[]; dropped: string[] } | null;
  facts?: [string, string | null][];
  blocks?: { label: string; text: string }[];
};

const clip = (text: string | null | undefined, length = 90) => {
  const value = text?.trim().replace(/\s+/gu, " ");
  if (!value) return null;
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
};

const str = (value: unknown) => (typeof value === "string" && value ? value : null);
const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** What the post or Story was for, in plain words (3b). Null on posts made before purposes existed. */
export function slpPurposeSentence(purpose: SlpPurpose | null, locale = "en"): string | null {
  if (!purpose) return null;
  const time = (value: string) => formatFullTime(value, locale) || value;
  switch (purpose.kind) {
    case "tease":
      return purpose.postId
        ? "Teased a locked drop, which is up now"
        : purpose.dropAt
          ? `Teases a locked drop due ${time(purpose.dropAt)}`
          : "Teases what is behind the lock";
    case "drop":
      return purpose.teasePostId ? "The drop an earlier tease promised" : "A new locked drop";
    case "behind_the_scenes":
      return "Behind the scenes of a shoot";
    case "promote":
      return purpose.subject === "brand"
        ? "A paid partnership"
        : purpose.subject === "couple"
          ? "A moment of their couple story"
          : "Promotes a collab";
    case "storyline":
      return "A beat of their storyline";
    case "answer_fans":
      return "Gives fans what they asked for";
    case "thanks":
      return "Thanks fans";
    case "daily_life":
      return "A moment from their day";
    case "poll_answer":
      return `What fans picked in a Story poll: ${purpose.answer ?? "?"}`;
    case "new_post":
      return "Story that points to a new post";
    case "countdown":
      return purpose.postId ? "Story that counted down to a drop, which is up now" : "Story that counts down to a drop";
    case "poll":
      return purpose.answeredAt ? "Story poll, answered in a later post" : "Story poll: fans pick the next post";
    case "day_in_life":
      return `Story ${purpose.part ?? 2} of their day`;
    case "comment_reaction":
      return `Story that answers a comment${purpose.comment?.handle ? ` by @${purpose.comment.handle}` : ""}`;
  }
}

/** Older posts have no purpose: their intent, in the same plain words. */
const INTENT_WORDS: Record<string, string> = {
  casual: "An everyday post",
  teaser: "A free peek at what is behind the lock",
  set: "A photo set",
  behind_the_scenes: "Behind the scenes",
  request: "Something fans asked for",
  appreciation: "A thank-you to fans",
  callback: "A callback to an earlier post",
  business: "Business",
};

type Beat = NonNullable<NonNullable<SlpDeepDetailsRecord["planner"]>["beat"]>;

/** A pack's dated moment (S) is a life beat whose shared id starts with `occasion:`. */
const occasionOf = (beat: Beat | null | undefined) => (beat?.sharedId?.startsWith("occasion:") ? beat.anchor : null);

function purposeChain(data: SlpDeepDetailsResponse, purpose: SlpPurpose | null, locale: string): SlpDeepChainStep[] {
  const related = (id: string | undefined) => (id ? clip(data.related?.[id]?.text, 70) : null);
  const time = (value: string) => formatFullTime(value, locale) || value;
  const story = data.post.metadata.noodlerPostType === "story";
  const self = story ? "This Story" : "This post";
  switch (purpose?.kind) {
    case "tease":
      return [
        { label: "Tease", text: `${self}, free for everyone`, state: "this" },
        purpose.postId
          ? { label: "Drop", text: related(purpose.postId) ?? "The locked drop is up", state: "done" }
          : {
              label: "Drop",
              text: purpose.dropAt
                ? `Locked, due ${time(purpose.dropAt)}${purpose.held ? " (the slot is held)" : ""}`
                : "Locked, coming next",
              state: "next",
            },
      ];
    case "drop":
      return [
        { label: "Tease", text: related(purpose.teasePostId) ?? "An earlier free post hinted at it", state: "done" },
        { label: "Drop", text: `${self}, behind the lock`, state: "this" },
      ];
    case "countdown":
      return [
        { label: "Countdown", text: self, state: "this" },
        purpose.postId
          ? { label: "Drop", text: related(purpose.postId) ?? "The drop is up", state: "done" }
          : { label: "Drop", text: purpose.dropAt ? `Due ${time(purpose.dropAt)}` : "Coming next", state: "next" },
      ];
    case "poll":
      return [
        { label: "Poll", text: `${self} asks fans to pick`, state: "this" },
        {
          label: "Answer",
          text: purpose.answeredAt ? "A later post did what fans picked" : "A later post does what fans pick",
          state: purpose.answeredAt ? "done" : "next",
        },
      ];
    case "poll_answer":
      return [
        { label: "Poll", text: related(purpose.pollPostId) ?? "A Story poll", state: "done" },
        { label: "Fans picked", text: purpose.answer ?? "Not recorded", state: "done" },
        { label: "Answer", text: self, state: "this" },
      ];
    case "new_post":
      return [
        { label: "New post", text: related(purpose.postId) ?? "Their newest post", state: "done" },
        { label: "Story", text: "This Story points to it", state: "this" },
      ];
    case "comment_reaction":
      return purpose.comment
        ? [
            {
              label: "Comment",
              text: `${purpose.comment.handle ? `@${purpose.comment.handle}: ` : ""}“${clip(purpose.comment.text, 80)}”`,
              state: "done",
            },
            { label: "Reply", text: "This Story answers it", state: "this" },
          ]
        : [];
    default:
      return [];
  }
}

function whyRow(data: SlpDeepDetailsResponse, locale: string): SlpDeepRow {
  const details = data.details;
  const plan = details?.plan;
  const meta = data.post.metadata;
  const purpose = readSlpPurpose(meta);
  const intent = plan?.intent ?? str(meta.contentIntent);
  const beat = details?.planner?.beat;
  const occasion = occasionOf(beat);
  const chain = purposeChain(data, purpose, locale);
  if (occasion) chain.unshift({ label: "Occasion", text: `A ${occasion} moment`, state: "done" });
  if (plan?.project) {
    chain.unshift({
      label: "Storyline",
      text: join([plan.project.title, plan.project.chapter && `chapter “${plan.project.chapter}”`]),
      state: "done",
    });
  }
  const sentences = [
    details?.direction ? `You asked for it: “${clip(details.direction, 160)}”` : null,
    data.plan?.topic ? `It keeps a promise to a fan: ${data.plan.topic}.` : null,
    plan?.demandTopic ? `Subscribers kept asking for ${plan.demandTopic}.` : null,
    plan?.teaser && purpose?.kind !== "tease" ? "A free peek at what subscribers get." : null,
    plan?.reusedFromPostId || str(meta.reusedFromPostId) ? "It reuses a picture from an earlier post." : null,
  ].filter((value): value is string => Boolean(value));
  const line =
    slpPurposeSentence(purpose, locale) ??
    (occasion ? `A ${occasion} moment` : null) ??
    (intent ? (INTENT_WORDS[intent] ?? intent) : null);
  return {
    id: "why",
    title: "Why it went up",
    line: line ?? (details ? "An everyday post" : null),
    chain: chain.length > 1 || occasion || plan?.project ? chain : undefined,
    sentences,
    facts: [
      ["Who sees it", data.post.access === "locked" ? "Subscribers and unlocks" : "Everyone"],
      ["Planned", data.plan ? formatFullTime(data.plan.plannedAt, locale) || null : null],
      ["Post number", details ? String(details.sequence + 1) : null],
    ],
  };
}

const BEAT_SOURCE: Record<string, string> = {
  steer: "From what you steer them towards",
  arc: "A chapter of their storyline",
  life: "A day-to-day moment of their life",
  collab: "From a collab",
  sponsor: "From a brand deal",
  rival: "From a rivalry",
  couple: "From their love life",
  people: "From someone in their life",
  places: "From a place they often are",
  work: "From their work",
  objects: "From something of theirs",
  habits: "From one of their habits",
  runningJokes: "From a running joke of theirs",
};

function beatSource(beat: Beat): string {
  if (beat.nudgeId) return "Your idea for them";
  if (beat.sharedId?.startsWith("poll:")) return "What fans picked in a Story poll";
  const occasion = occasionOf(beat);
  if (occasion) return `Part of ${occasion}`;
  return BEAT_SOURCE[beat.anchorKind] ?? "From their card";
}

function happensRow(data: SlpDeepDetailsResponse): SlpDeepRow {
  const details = data.details;
  const beat = details?.planner?.beat ?? null;
  const angle = details?.angle;
  const claim = details?.planner?.claimCheck;
  const scene = join([angle?.place, angle?.moment, angle?.company]);
  const sentences = [
    beat ? `${beatSource(beat)}.` : null,
    beat?.reference ? `It can call back to this: ${clip(beat.reference.text, 140)}` : null,
    claim && claim.revised
      ? claim.ok
        ? "The first draft got a fact about their life wrong, so it was fixed once."
        : "The draft still got a fact about their life wrong after one fix."
      : claim && !claim.ok
        ? "The draft got a fact about their life wrong."
        : null,
  ].filter((value): value is string => Boolean(value));
  return {
    id: "happens",
    title: "What happens",
    line: beat ? (clip(beat.anchor, 80) ?? beatSource(beat)) : scene || (details ? "Left to the moment" : null),
    status: claim && !claim.ok ? "rejected" : undefined,
    quote: beat ? { label: "The moment Slurp planned", text: beat.line } : null,
    sentences,
    facts: [
      ["Where", angle?.place ?? null],
      ["When", angle?.moment ?? null],
      ["Who is there", angle?.company ?? (beat?.cast.length ? beat.cast.join(", ") : null)],
      ["What was off", claim && !claim.ok ? claim.problems.join("; ") || null : null],
    ],
  };
}

const DETAIL_NOTE: Record<string, string> = {
  people: "someone in their life",
  places: "a place they often are",
  work: "part of their work",
  objects: "something of theirs",
  habit: "a habit",
  jokes: "a running joke",
  voice: "how they talk",
  never: "something they never do",
  life: "from their card",
  lately: "what your other Agents noticed",
};

const DAY_WORDS = {
  flat: "One of those flat days: shorter and plainer was fine.",
  good: "A good day, and it could show a little.",
  small: "Something small and real from their own day could slip in.",
};

function voiceRow(data: SlpDeepDetailsResponse, name: string): SlpDeepRow | null {
  const flavour = data.details?.flavour;
  if (!flavour) return null;
  const sentences = [
    flavour.opener
      ? flavour.opener.allowed
        ? `“${flavour.opener.phrase}” is a thing ${name} says, so it was fine once in a while.`
        : `${name} had opened with “${flavour.opener.phrase}” a lot, so this one had to open differently.`
      : null,
    flavour.day ? DAY_WORDS[flavour.day] : null,
    flavour.relationship ? `About their love life, Slurp told ${name}: “${flavour.relationship}”` : null,
  ].filter((value): value is string => Boolean(value));
  const firstDetail = flavour.details[0]?.text;
  return {
    id: "voice",
    title: `Who ${name} was today`,
    line:
      join([
        firstDetail && clip(firstDetail, 50),
        flavour.details.length > 1 && `${flavour.details.length - 1} more`,
        flavour.voice && "their own voice",
      ]) || "Their card, as it is now",
    items: flavour.details.map((detail) => ({ text: detail.text, note: DETAIL_NOTE[detail.kind] ?? null })),
    quote: flavour.voice ? { label: "How they sound, from a line of theirs", text: flavour.voice } : null,
    sentences,
  };
}

const MOOD_WORDS: Record<string, string> = {
  bright: "bright and bubbly",
  cozy: "soft and cozy",
  restless: "restless",
  low: "a bit low",
  flirty: "flirty and bold",
  stressed: "busy and stretched thin",
};

function steeringRow(data: SlpDeepDetailsResponse): SlpDeepRow | null {
  const details = data.details;
  const steering = details?.flavour?.steering;
  const beat = details?.planner?.beat;
  const idea = beat?.nudgeId ? beat.anchor : null;
  // A Story poll's answer rides the same beat kind, but fans picked it, not the player.
  const steered =
    beat?.anchorKind === "steer" && !beat.nudgeId && !beat.sharedId?.startsWith("poll:") ? beat.anchor : null;
  if (!steering && !idea && !steered) return null;
  const facts: [string, string | null][] = [
    ["Your idea", idea],
    ["Became the moment", steered],
    ["Mood lately", steering?.mood ? (MOOD_WORDS[steering.mood] ?? steering.mood) : null],
    ["Life right now", steering?.life ?? null],
    ["Into lately", steering?.focus ?? null],
    ["Brought up this time", steering?.topic ?? null],
    ["Left out", steering?.leftOut.length ? steering.leftOut.join(", ") : null],
  ];
  const shown = facts.filter(([, value]) => value);
  return {
    id: "steering",
    title: "Your steering",
    line: idea
      ? `Your idea: ${clip(idea, 60)}`
      : join(shown.slice(0, 2).map(([, value]) => clip(value, 40))) || "Applied",
    sentences: ["You pick what happens. They decide how, in their own way."],
    facts,
  };
}

/** The picture levels as the player knows them (7b-spice). */
const LEVEL_WORDS: Record<string, string> = {
  none: "Not spicy",
  suggestive: "Flirty",
  nudity: "Suggestive",
  explicit: "Explicit",
};

const SPICE_KIND: Record<string, string> = {
  lingerie: "a lingerie shoot",
  tease: "a slow tease",
  nudes: "nudes",
  shower: "a shower scene",
  toys: "toys",
  solo: "solo play",
  partnered: "a partner scene",
};

function spiceRow(data: SlpDeepDetailsResponse, name: string): SlpDeepRow | null {
  const heat = data.details?.planner?.heat;
  const raw = data.post.metadata.slurpSpice;
  const spice = raw && typeof raw === "object" ? (raw as { kind?: unknown; taste?: unknown }) : null;
  const kind = str(spice?.kind);
  const taste = str(spice?.taste);
  if (!kind && (!heat || heat.planned === "none")) return null;
  const level = heat ? (LEVEL_WORDS[heat.planned] ?? heat.planned) : null;
  const kindWords = kind ? (SPICE_KIND[kind] ?? kind) : null;
  const tease = data.post.access !== "locked";
  const partner = kind === "partnered" ? (data.details?.planner?.beat?.cast[0] ?? null) : null;
  return {
    id: "spice",
    title: "Spice",
    line: join([level, kindWords, taste && `a nod to ${taste}`]),
    sentences: [
      heat && level
        ? heat.dial === heat.planned
          ? `Planned at ${level}, as far as ${name} goes.`
          : `Planned at ${level}. ${name} goes up to ${LEVEL_WORDS[heat.dial] ?? heat.dial}.`
        : null,
      kindWords
        ? tease
          ? `A free post only hints at ${kindWords}; the rest sits behind the lock.`
          : `This one is ${kindWords}${partner ? ` with ${partner}` : ""}, the way ${name} does it.`
        : null,
      taste ? `Your fans have been into ${taste} lately, so it was worked in.` : null,
    ].filter((value): value is string => Boolean(value)),
  };
}

const COUPLE_MOMENT: Record<string, string> = {
  flirt: "a flirt",
  date: "a date",
  launch: "going public as a couple",
  anniversary: "an anniversary",
  jealous: "a jealous moment",
  fight: "a fight",
  makeup: "making up",
  breakup: "the breakup",
  reunion: "getting back together",
  pageOpen: "opening their shared page",
  pageClose: "closing their shared page",
  movingOn: "moving on",
  cameo: "a cameo by their partner",
};

function togetherRow(data: SlpDeepDetailsResponse, name: string): SlpDeepRow | null {
  const tie: Tie | null = data.details?.planner?.beat?.tie ?? readTie(data.post.metadata);
  if (!tie) return null;
  const who = (id: string | undefined) => {
    const person = id ? data.people?.[id] : undefined;
    return person ? `@${person.handle}` : "another Creator";
  };
  const partner = who(tie.partnerId);
  const stamp = readTie(data.post.metadata) ?? tie;
  const share = typeof tie.hostShare === "number" ? tie.hostShare : null;
  const sentences: string[] = [];
  let line: string;
  if (tie.kind === "collab") {
    line = stamp.announce
      ? `Announces a collab with ${partner}`
      : stamp.echo
        ? `Their side of a collab with ${partner}`
        : `A collab with ${partner}`;
    if (stamp.announce) sentences.push("It builds hype; the joint post goes up on both pages later.");
    else if (stamp.echo) sentences.push("Their own post about it, not the joint one: no split.");
    else if (share !== null)
      sentences.push(`Up on both pages. ${name} keeps ${share} %, ${partner} gets ${100 - share} %.`);
    if (stamp.shoot) sentences.push("A spicy shoot the two planned in their DMs.");
  } else if (tie.kind === "sponsor") {
    const brand = tie.brand ?? "a brand";
    line = stamp.declined ? `Turned down ${brand}` : `Paid partnership with ${brand}`;
    sentences.push(
      stamp.declined ? `${brand} offered a paid post; ${name} said no and says why.` : "Marked as an ad (#ad).",
    );
  } else if (tie.kind === "rival") {
    line = `Rivalry with ${partner}`;
    sentences.push("A post in their running rivalry.");
  } else {
    const moment = tie.moment ? (COUPLE_MOMENT[tie.moment] ?? tie.moment) : null;
    line = join([`Couple with ${partner}`, moment]);
    sentences.push(
      stamp.pageId
        ? `Posted on the page they share with ${partner}; it splits what it earns 50/50.`
        : stamp.joint
          ? "An older joint couple post: on both pages, split like a collab."
          : `${name}'s own post about their life: no collab tag, no split.`,
    );
  }
  return { id: "together", title: "Made with", line, sentences };
}

type Tie = {
  kind: string;
  partnerId?: string;
  brand?: string;
  hostShare?: number;
  moment?: string;
  announce?: boolean;
  echo?: boolean;
  shoot?: boolean;
  declined?: boolean;
  joint?: boolean;
  pageId?: string;
};

function readTie(metadata: Record<string, unknown>): Tie | null {
  const raw = metadata.slurpTie;
  return raw && typeof raw === "object" && typeof (raw as { kind?: unknown }).kind === "string" ? (raw as Tie) : null;
}

const FAMILY_WORDS: Record<string, string> = {
  tags: "in tag words, for a tag model",
  e621: "in e621 tags, for a drawn furry",
  natural: "in plain words",
};

/** Comma or line parts of a prompt, lowercased, for a readable before/after. */
const parts = (text: string | null | undefined) =>
  new Set(
    (text ?? "")
      .toLocaleLowerCase()
      .split(/[,\n.;]+/u)
      .map((part) => part.trim())
      .filter((part) => part.length > 1),
  );

/** What the enhance step added and dropped, in prompt parts. Null when it did not run or was not used. */
export function slpEnhanceChanges(run: SlpDeepDetailsImageRun, max = 6): { added: string[]; dropped: string[] } | null {
  if (run.rewrite.status !== "accepted" || !run.rewrite.input || !run.rewrite.output) return null;
  const before = parts(run.rewrite.input);
  const after = parts(run.rewrite.output);
  return {
    added: [...after].filter((part) => !before.has(part)).slice(0, max),
    dropped: [...before].filter((part) => !after.has(part)).slice(0, max),
  };
}

const ENHANCE_WORDS: Record<SlpDeepDetailsImageRun["rewrite"]["status"], string> = {
  skipped: "Not enhanced",
  accepted: "Enhanced",
  rejected: "Enhance discarded",
  failed: "Enhance had no answer",
};

function pictureRow(data: SlpDeepDetailsResponse, locale: string): SlpDeepRow {
  const details = data.details;
  const runs = details?.imageRuns ?? [];
  const run = runs.at(-1) ?? null;
  const meta = data.post.metadata;
  const failed = run ? run.result.status === "failed" : meta.imageGenerationFailed === true;
  if (!run) {
    const prompt = details?.providerPrompt ?? data.post.imagePrompt;
    return {
      id: "picture",
      title: "The picture",
      line: data.post.imageUrl
        ? join([str(meta.imageModel), "saved"])
        : failed
          ? "No picture: it failed"
          : details?.plan.delivery === "text_only"
            ? "Words only"
            : "No picture",
      status: failed ? "failed" : undefined,
      sentences: details?.plan.reusedFromPostId ? ["A picture from an earlier post, posted again."] : [],
      facts: [["Why it failed", failed ? (str(meta.imageGenerationError) ?? "Not recorded") : null]],
      blocks: prompt ? [{ label: "Prompt the picture was drawn from", text: prompt }] : [],
    };
  }
  const failures = runs.flatMap((entry) => entry.attempts).filter((attempt) => !attempt.ok).length;
  const servedBy = run.attempts.find((attempt) => attempt.servedBy)?.servedBy;
  const redraws = runs.filter((entry) => entry.trigger === "retry").length;
  const seconds = run.attempts.reduce((sum, attempt) => sum + attempt.durationMs, 0) / 1000;
  const changes = slpEnhanceChanges(run);
  const sentences = [
    run.viewpoint
      ? `Seen as: “${run.viewpoint.phrase}”, ${FAMILY_WORDS[run.viewpoint.family] ?? "for this model"}. The enhance step had to keep it word for word.`
      : null,
    run.styleProfile.name
      ? `Style kept: ${run.styleProfile.name}${run.styleProfile.chosenBy === "creator" ? ", the Creator's own" : ""}.`
      : null,
    run.rewrite.status === "rejected"
      ? `The enhanced prompt was thrown away (${run.rewrite.reason ?? "it broke the brief"}), so the plain one went out.`
      : run.rewrite.status === "failed"
        ? "The enhance step gave no answer, so the plain prompt went out."
        : run.rewrite.status === "skipped"
          ? "Not enhanced: the plain prompt went out."
          : null,
    failures ? `${plural(failures, "try", "tries")} failed before it worked.` : null,
    servedBy ? `The backup connection drew it (${servedBy.model ?? servedBy.name}).` : null,
    redraws ? `Drawn again ${plural(redraws, "time", "times")} after the first picture.` : null,
    run.result.status === "failed" ? `No picture: ${run.result.error ?? "the image connection failed"}.` : null,
  ].filter((value): value is string => Boolean(value));
  return {
    id: "picture",
    title: "The picture",
    // The status chip says "Retried"; the line keeps what fits beside it.
    line: join([
      ENHANCE_WORDS[run.rewrite.status],
      run.result.status === "failed" ? "failed" : run.result.status === "preview" ? "waits for your review" : null,
      run.connection.model,
    ]),
    status: run.result.status === "failed" ? "failed" : failures || servedBy ? "retried" : undefined,
    sentences,
    changes,
    facts: [
      ["Image model", run.connection.model],
      ["Connection", run.connection.name ?? run.connection.id],
      ["Size", run.size.width && run.size.height ? `${run.size.width} × ${run.size.height}` : null],
      ["Drawing took", seconds > 0 ? `${seconds.toFixed(1)} s` : null],
      ["Drawn", formatFullTime(run.startedAt, locale) || null],
    ],
    blocks: [
      ...(run.finalPrompt ? [{ label: "Prompt the picture was drawn from", text: run.finalPrompt }] : []),
      ...(run.negativePrompt ? [{ label: "What it had to leave out", text: run.negativePrompt }] : []),
    ],
  };
}

function writingRow(data: SlpDeepDetailsResponse, locale: string): SlpDeepRow {
  const details = data.details;
  if (!details) return { id: "writing", title: "The writing", line: null };
  const revised = details.planner?.claimCheck?.revised;
  return {
    id: "writing",
    title: "The writing",
    line: join([
      details.model.model || details.model.provider,
      details.attempts > 1 && plural(details.attempts, "try", "tries"),
    ]),
    status: details.attempts > 1 ? "retried" : undefined,
    sentences: [
      details.attempts > 1
        ? revised
          ? "The first draft was sent back once to fix a fact."
          : "The first answer came back broken, so Slurp asked once more."
        : null,
    ].filter((value): value is string => Boolean(value)),
    facts: [
      ["Model", details.model.model],
      ["Connection", details.model.connectionName ?? details.model.provider],
      ["Written", formatFullTime(details.generatedAt, locale) || null],
      ["Temperature", details.model.temperature?.toString() ?? null],
      ["Max tokens", details.model.maxTokens?.toString() ?? null],
    ],
    blocks: [
      {
        label: "Writing prompt",
        text: details.messages.map((message) => `# ${message.role}\n${message.content}`).join("\n\n"),
      },
      { label: "Raw answer", text: details.rawResponse },
    ],
  };
}

/** Every model call this post took: writing tries, enhance calls, picture tries. */
export function slpDeepDetailsCost(details: SlpDeepDetailsRecord | null) {
  if (!details) return null;
  const runs = details.imageRuns ?? [];
  const writing = details.attempts;
  const enhance = runs.filter((run) => run.rewrite.status !== "skipped").length;
  const pictures = runs.reduce((sum, run) => sum + run.attempts.length, 0);
  return { writing, enhance, pictures, total: writing + enhance + pictures };
}

function costRow(data: SlpDeepDetailsResponse): SlpDeepRow | null {
  const cost = slpDeepDetailsCost(data.details);
  if (!cost) return null;
  return {
    id: "cost",
    title: "What it cost",
    line: join([
      plural(cost.total, "AI call", "AI calls"),
      cost.pictures > 0 && plural(cost.pictures, "picture try", "picture tries"),
    ]),
    facts: [
      ["Writing", plural(cost.writing, "call", "calls")],
      ["Enhancing the picture prompt", cost.enhance ? plural(cost.enhance, "call", "calls") : null],
      ["Drawing", cost.pictures ? plural(cost.pictures, "try", "tries") : null],
    ],
    sentences: ["Calls to your own AI connections, counted as they ran."],
  };
}

function sinceRow(data: SlpDeepDetailsResponse, locale: string): SlpDeepRow {
  const { likes, replies, unlocks } = data.stats;
  return {
    id: "since",
    title: "Since it went up",
    line: join([
      plural(likes, "like", "likes"),
      plural(replies, "reply", "replies"),
      unlocks > 0 && plural(unlocks, "unlock", "unlocks"),
    ]),
    facts: [
      ["Likes", String(likes)],
      ["Replies", String(replies)],
      ["Unlocks", String(unlocks)],
      [
        "Last edited",
        data.post.updatedAt !== data.post.createdAt ? formatFullTime(data.post.updatedAt, locale) || null : null,
      ],
    ],
  };
}

/** The summary rows, in reading order. Rows that do not apply to this post are left out. */
export function buildSlpDeepDetailsStory(data: SlpDeepDetailsResponse, locale = "en"): SlpDeepRow[] {
  const name = data.creator.displayName.trim().split(/\s+/u)[0] || data.creator.displayName;
  return [
    whyRow(data, locale),
    happensRow(data),
    voiceRow(data, name),
    steeringRow(data),
    spiceRow(data, name),
    togetherRow(data, name),
    pictureRow(data, locale),
    writingRow(data, locale),
    costRow(data),
    sinceRow(data, locale),
  ].filter((row): row is SlpDeepRow => Boolean(row));
}

/** Where each story row joins the chart (M): its column, the steps it feeds, and why it matters. */
const fact = (label: string, value: string | null | undefined): SlpFlowRow => ({
  label,
  value: value ?? null,
  note: null,
});

/** A row whose long text opens on demand, like the chart's own rows. */
const row = (label: string, text: string): SlpFlowRow => {
  const value = clip(text, 120);
  return { label, value, text: text.trim() !== value ? text.trim() : null, note: null };
};

export const SLP_STORY_NODES: Partial<
  Record<SlpDeepRowId, { column: number; feeds: [string, string][]; why: string }>
> = {
  why: {
    column: 0,
    feeds: [["plan", "purpose"]],
    why: "Every post has one job, and some lead to the next: a tease to its drop, a poll to its answer.",
  },
  together: {
    column: 0,
    feeds: [["plan", "made with"]],
    why: "Collabs, brand deals, rivalries and couples change who is in the post and who gets paid.",
  },
  steering: {
    column: 1,
    feeds: [
      ["angle", "your idea"],
      ["writing-prompt", "your steering"],
    ],
    why: "You pick what happens. The Creator decides how, in their own way.",
  },
  voice: {
    column: 2,
    feeds: [["writing-prompt", "who they are"]],
    why: "A few true details and a line of their own keep one Creator from sounding like every other.",
  },
  spice: {
    column: 2,
    feeds: [
      ["writing-prompt", "spice"],
      ["brief", "picture level"],
    ],
    why: "How far the post goes, never past the Creator's level or the Slurp-wide limit.",
  },
};

export function slpStoryNode(story: SlpDeepRow): SlpFlowNode | null {
  const place = SLP_STORY_NODES[story.id];
  if (!place) return null;
  const outputs: SlpFlowRow[] = [
    ...(story.chain ?? []).map((step) =>
      fact(step.state === "next" ? `${step.label} (still to come)` : step.label, step.text),
    ),
    ...(story.quote ? [row(story.quote.label, story.quote.text)] : []),
    ...(story.items ?? []).map((item) =>
      fact(item.note ? item.note.charAt(0).toLocaleUpperCase() + item.note.slice(1) : "Detail", item.text),
    ),
    ...(story.facts ?? []).map(([label, value]) => fact(label, value)),
  ];
  // One label per card: the flowchart keys rows by label.
  const seen = new Map<string, number>();
  for (const output of outputs) {
    const count = (seen.get(output.label) ?? 0) + 1;
    seen.set(output.label, count);
    if (count > 1) output.label = `${output.label} ${count}`;
  }
  return {
    id: `story-${story.id}`,
    kind: "input",
    lane: "text",
    title: story.title,
    status: story.status ?? "done",
    model: null,
    inputs: [],
    outputs: [fact("In short", story.line), ...outputs],
    what: story.sentences?.join(" ") || (story.line ?? ""),
    why: place.why,
    details: [],
    column: place.column,
  };
}
