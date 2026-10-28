/**
 * Why a post or a Story goes up, and what it leads to (3b). Pure and deterministic.
 *
 * ## The problem
 *
 * Free teaser slots teased "what paid posts offer" with nothing planned behind them; automatic
 * Stories were random pictures with a line; no ordinary post could take up what fans answered.
 * The reasons that did exist (a promise, a collab, a milestone) were never stored in plain terms.
 *
 * ## The approach
 *
 * The planner already decides what a post is for; this names it (`SlpPurpose`) and adds the
 * follow-through: a free tease opens a campaign whose next stage is the locked drop, and the two
 * link to each other; a Story draws a job from what is really going on (a post just went up, a drop
 * is coming, a fan commented, earlier Stories today) or asks a poll whose winner becomes a later
 * post's beat. Code decides; the model only writes the words, so nothing here costs an AI call.
 */

import {
  SLURP_STORY_JOB_DEFAULTS,
  type SlpPurpose,
  type SlurpStoryJobWeights,
} from "../../../../../shared/src/slp/slp-post-purpose.js";
import type { SlpCreatorSteering } from "../../../../../shared/src/slp/slp-creator-steering.js";
import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import { slurpAnchorsWithout, slurpNudgeBeat, type SlurpBeat, type SlurpCanonAnchors } from "./slp-post-beat.js";
import { slurpWeightedPick } from "./slp-weighted.js";
import { createSlpPoll } from "../../../../../shared/src/slp/slp-polls.js";

const HOUR = 60 * 60_000;

/** A poll's answer is taken up once it has had a few hours, and forgotten after three days. */
export const SLURP_POLL_ANSWER_AFTER_MS = 6 * HOUR;
export const SLURP_POLL_ANSWER_WITHIN_MS = 3 * 24 * HOUR;
/** A post is "new" for a Story for half a day; a comment is worth a reaction for two. */
const NEW_POST_MS = 12 * HOUR;
const COMMENT_MS = 48 * HOUR;
/** Stories this close together are one day. */
const SAME_DAY_MS = 10 * HOUR;
/** A free tease's drop is due this long after the tease goes up. */
export const SLURP_TEASE_DROP_DELAY_MS = 3 * HOUR;

const quote = (value: string, max = 90) => {
  const text = value.replace(/\s+/g, " ").trim();
  return `“${text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text}”`;
};

/** "about 3 hours" / "about an hour" / "any minute now", from now to the drop. */
export function slurpDropIn(dropAt: string, at: Date): string {
  const hours = Math.round((Date.parse(dropAt) - at.getTime()) / HOUR);
  if (!Number.isFinite(hours) || hours <= 0) return "any minute now";
  return hours === 1 ? "about an hour" : `about ${hours} hours`;
}

const clock = (at: Date) => {
  const hour = at.getHours() % 12 || 12;
  const minutes = at.getMinutes();
  return `${hour}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""} ${at.getHours() < 12 ? "am" : "pm"}`;
};

/**
 * The drop's exact time in plain words, as a Creator would say it: "tonight at 9 pm", "today at
 * 3 pm", "tomorrow at 10 am", "on Friday at 8 pm". Local time, the clock the player lives on.
 */
export function slurpDropClock(dropAt: string, at: Date): string {
  const drop = new Date(dropAt);
  const day = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((day(drop) - day(at)) / (24 * HOUR));
  const when =
    days <= 0
      ? drop.getHours() >= 18
        ? "tonight"
        : "today"
      : days === 1
        ? "tomorrow"
        : `on ${drop.toLocaleDateString("en-US", { weekday: "long" })}`;
  return `${when} at ${clock(drop)}`;
}

// --- Posts ------------------------------------------------------------------------------------------

/** What the planner decided about a feed post, in the terms that give it a reason. */
export type SlurpPostPurposeFacts = {
  intent?: SlurpContentIntent | null;
  /** A campaign stage this post runs. A `set` stage run by the planner is always a teased drop. */
  stageKind?: "set" | "teaser" | "callback" | null;
  campaignId?: string | null;
  /** A tease: the drop it leads to (campaign, due time while it is still to come, the drop's post once it is up). */
  tease?: { campaignId: string; dropAt?: string | null; postId?: string | null; held?: boolean } | null;
  /** A teased drop: the tease it delivers. */
  drop?: { teasePostId: string | null; title?: string | null } | null;
  promise?: boolean;
  demand?: boolean;
  pollAnswer?: { pollPostId: string; answer: string } | null;
  beat?: SlurpBeat | null;
  storyline?: boolean;
};

const THANKS_LIFE = /^(life:(milestone|viral|fan-gift)|occasion:first-1k-subs)/u;

/** Every feed post gets one reason. Follow-through first, then the reason the beat carries, then daily life. */
export function slurpPostPurpose(facts: SlurpPostPurposeFacts): SlpPurpose {
  if (facts.pollAnswer) return { kind: "poll_answer", ...facts.pollAnswer };
  if (facts.tease) {
    return {
      kind: "tease",
      campaignId: facts.tease.campaignId,
      ...(facts.tease.dropAt ? { dropAt: facts.tease.dropAt } : {}),
      ...(facts.tease.postId ? { postId: facts.tease.postId } : {}),
      ...(facts.tease.held && facts.tease.dropAt ? { held: true } : {}),
    };
  }
  if (facts.stageKind === "set" || facts.drop) {
    return {
      kind: "drop",
      ...(facts.campaignId ? { campaignId: facts.campaignId } : {}),
      ...(facts.drop?.teasePostId ? { teasePostId: facts.drop.teasePostId } : {}),
    };
  }
  if (facts.stageKind === "callback" || facts.intent === "callback" || facts.intent === "behind_the_scenes") {
    return { kind: "behind_the_scenes" };
  }
  if (facts.promise || facts.demand || facts.intent === "request") return { kind: "answer_fans" };
  const tie = facts.beat?.tie;
  if (tie && !tie.declined) {
    if (tie.kind === "rival") return { kind: "storyline" };
    return { kind: "promote", subject: tie.kind === "sponsor" ? "brand" : tie.kind === "couple" ? "couple" : "collab" };
  }
  if (facts.storyline || facts.beat?.anchorKind === "arc") return { kind: "storyline" };
  if (facts.intent === "appreciation" || THANKS_LIFE.test(facts.beat?.sharedId ?? "")) return { kind: "thanks" };
  if (facts.intent === "set") return { kind: "drop", ...(facts.campaignId ? { campaignId: facts.campaignId } : {}) };
  return { kind: "daily_life" };
}

/**
 * The prompt line for a feed post's purpose, only where it adds follow-through the rest of the
 * prompt does not already carry (the intent, the beat and the campaign stage say the rest).
 */
export function slurpPostPurposeLine(purpose: SlpPurpose, input: { at: Date; teaseTitle?: string | null }): string {
  if (purpose.kind === "tease" && purpose.dropAt && !purpose.postId && purpose.held) {
    return `This free post teases your next locked drop, which goes up ${slurpDropClock(purpose.dropAt, input.at)} (in ${slurpDropIn(purpose.dropAt, input.at)}). Name that time, your way: it is a date with your fans. Hint at what is coming and keep the good part for the drop.`;
  }
  if (purpose.kind === "tease" && purpose.dropAt && !purpose.postId) {
    return `This free post teases your next locked drop, due in ${slurpDropIn(purpose.dropAt, input.at)}. Hint at what is coming and roughly when, and keep the good part for the drop. Do it your way.`;
  }
  if (purpose.kind === "drop" && purpose.teasePostId) {
    return `This is the drop you teased earlier${input.teaseTitle ? ` (${quote(input.teaseTitle)})` : ""}. Deliver what that tease promised, your way.`;
  }
  if (purpose.kind === "poll_answer" && purpose.answer) {
    return `Your followers picked ${quote(purpose.answer)} in your Story poll, so this post is about that. You can say they chose it, your way.`;
  }
  return "";
}

// --- Story polls ------------------------------------------------------------------------------------

const POLL_FRAMES = {
  places: "where your next post happens",
  objects: "which of these shows up in your next post",
  habits: "what your next post is about",
  work: "what your next post is about",
  topics: "what your next post is about",
} as const;
type PollKind = keyof typeof POLL_FRAMES;

export type SlurpPollPlan = { kind: PollKind; options: string[] };

/**
 * Two choices of one kind, from the Creator's own life (card anchors) or what the player asked to
 * bring up more. Never a topic the player left out, never a long phrase. Null when nothing fits.
 */
export function slurpStoryPoll(
  creatorAccountId: string,
  sequence: number,
  anchors: SlurpCanonAnchors | null,
  steering: Pick<SlpCreatorSteering, "push" | "avoid"> | null,
): SlurpPollPlan | null {
  const usable = (values: readonly string[]) => [
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length >= 3 && value.length <= 48)),
  ];
  const kept = anchors ? slurpAnchorsWithout(anchors, steering?.avoid ?? []) : null;
  const pools: { kind: PollKind; values: string[] }[] = [
    { kind: "topics" as const, values: usable(steering?.push ?? []) },
    { kind: "places" as const, values: usable(kept?.places ?? []) },
    { kind: "objects" as const, values: usable(kept?.objects ?? []) },
    { kind: "habits" as const, values: usable(kept?.habits ?? []) },
    { kind: "work" as const, values: usable(kept?.work ?? []) },
  ].filter((pool) => pool.values.length >= 2);
  if (!pools.length) return null;
  const pool = slurpWeightedPick(
    "pollKind",
    creatorAccountId,
    sequence,
    pools.map((value) => ({ value, weight: value.kind === "topics" ? 2 : 1 })),
  );
  const first = slurpWeightedPick(
    "pollA",
    creatorAccountId,
    sequence,
    pool.values.map((value) => ({ value, weight: 1 })),
  );
  const second = slurpWeightedPick(
    "pollB",
    creatorAccountId,
    sequence,
    pool.values.filter((value) => value !== first).map((value) => ({ value, weight: 1 })),
  );
  return { kind: pool.kind, options: [first, second] };
}

/** The option with the most votes; a tie goes to a seeded pick among the tied. */
export function slurpPollWinner(options: readonly string[], tally: readonly number[], seed: string): string | null {
  if (!options.length) return null;
  const top = Math.max(...options.map((_, index) => tally[index] ?? 0));
  const tied = options.filter((_, index) => (tally[index] ?? 0) === top);
  return slurpWeightedPick(
    "pollTie",
    seed,
    0,
    tied.map((value) => ({ value, weight: 1 })),
  );
}

/** Whether a poll Story's answer is ready to become a post: old enough, not too old, not taken. */
export function slurpPollAnswerDue(poll: { createdAt: string; purpose: SlpPurpose }, at: Date): boolean {
  const age = at.getTime() - Date.parse(poll.createdAt);
  return (
    poll.purpose.kind === "poll" &&
    !poll.purpose.answeredAt &&
    age >= SLURP_POLL_ANSWER_AFTER_MS &&
    age <= SLURP_POLL_ANSWER_WITHIN_MS
  );
}

/** A poll's winner as the post's beat: what happens is what the followers picked; the Creator still does it their way. */
export function slurpPollAnswerBeat(
  answer: string,
  pollPostId: string,
  anchors: SlurpCanonAnchors | null,
  intents: readonly SlurpContentIntent[],
): SlurpBeat {
  const { nudgeId: _nudgeId, ...beat } = slurpNudgeBeat({ id: "", text: answer }, anchors, intents);
  return {
    ...beat,
    anchor: answer.trim(),
    line: `Your followers picked this in your Story poll: ${answer.trim()}. Make it yours.`,
    // Unique per poll, so the shared-idea day cap never counts it and a retried slot can find the poll again.
    sharedId: `poll:${pollPostId}`,
  };
}

// --- Stories ----------------------------------------------------------------------------------------

/** What is really going on for a Creator right now, as the Story planner reads it. */
export type SlurpStoryCandidates = {
  /** A teased drop still to come. */
  countdown?: { campaignId: string; dropAt: string } | null;
  /** Their newest feed post, when it went up recently and no Story pointed at it yet. */
  newPost?: { postId: string; title: string } | null;
  /** The newest fan comment on a recent post that no Story answered yet. */
  comment?: { postId: string; postTitle: string; handle: string; text: string } | null;
  /** Poll choices, when no poll ran lately and there is something to choose from. */
  poll?: SlurpPollPlan | null;
  /** An earlier Story today, so this one continues the day. */
  earlier?: { line: string; count: number } | null;
};

export type SlurpStoryPurposePlan = {
  purpose: SlpPurpose;
  line: string;
  /** The Story links through to this post (new post, the post a comment was on). */
  linkedPostId: string | null;
  poll: SlurpPollPlan | null;
};

/**
 * A job for an automatic Story, drawn by weight from what is really available, so a Creator's
 * Stories announce, count down, ask, answer and follow their day, and now and then just share a
 * moment. Deterministic on the Creator and the post count, like every other draw.
 */
export function slurpStoryPurpose(
  creatorAccountId: string,
  sequence: number,
  candidates: SlurpStoryCandidates,
  at: Date,
  weights: SlurpStoryJobWeights = SLURP_STORY_JOB_DEFAULTS,
): SlurpStoryPurposePlan {
  type Key = keyof SlurpStoryJobWeights;
  const available: Key[] = [
    ...(candidates.countdown ? (["countdown"] as const) : []),
    ...(candidates.newPost ? (["newPost"] as const) : []),
    ...(candidates.comment ? (["comment"] as const) : []),
    ...(candidates.poll ? (["poll"] as const) : []),
    ...(candidates.earlier ? (["earlier"] as const) : []),
    "plain",
  ];
  const key = slurpWeightedPick(
    "storyPurpose",
    creatorAccountId,
    sequence,
    // A plain moment stays possible when the player turned every job down to zero.
    available.map((value) => ({
      value,
      weight: available.every((key) => !(weights[key] > 0)) && value === "plain" ? 1 : Math.max(0, weights[value] ?? 0),
    })),
  );
  const plain = { purpose: { kind: "daily_life" }, line: "", linkedPostId: null, poll: null } as const;
  if (key === "countdown" && candidates.countdown) {
    return {
      purpose: { kind: "countdown", campaignId: candidates.countdown.campaignId, dropAt: candidates.countdown.dropAt },
      line: `This Story counts down to your next drop, due in ${slurpDropIn(candidates.countdown.dropAt, at)}. Build it up in one short line, your way; a countdown sticker shows the time.`,
      linkedPostId: null,
      poll: null,
    };
  }
  if (key === "newPost" && candidates.newPost) {
    return {
      purpose: { kind: "new_post", postId: candidates.newPost.postId },
      line: `This Story points your followers to your new post ${quote(candidates.newPost.title)}, which just went up. Say it is up in one short line, your way; the Story links to it.`,
      linkedPostId: candidates.newPost.postId,
      poll: null,
    };
  }
  if (key === "comment" && candidates.comment) {
    const { postId, postTitle, handle, text } = candidates.comment;
    return {
      purpose: { kind: "comment_reaction", postId, comment: { handle, text } },
      line: `This Story answers a comment ${handle ? `@${handle}` : "a fan"} left on your post ${quote(postTitle)}: ${quote(text, 160)}. React to it in one short line, your way; the comment shows as a sticker.`,
      linkedPostId: postId,
      poll: null,
    };
  }
  if (key === "poll" && candidates.poll) {
    const [first, second] = candidates.poll.options;
    return {
      purpose: { kind: "poll" },
      line: `This Story is a poll: your followers pick ${POLL_FRAMES[candidates.poll.kind]}, ${quote(first!)} or ${quote(second!)}. Ask it in one short line, your way. The choices show as a sticker, so do not list them.`,
      linkedPostId: null,
      poll: candidates.poll,
    };
  }
  if (key === "earlier" && candidates.earlier) {
    return {
      purpose: { kind: "day_in_life", part: candidates.earlier.count + 1 },
      line: `This Story continues your day: earlier today your Story said ${quote(candidates.earlier.line)}. Show what you are up to now, later the same day.`,
      linkedPostId: null,
      poll: null,
    };
  }
  return plain;
}

/** One of this Creator's recent posts, as the Story planner reads it. */
export type SlurpPurposePost = {
  id: string;
  title: string | null;
  content: string;
  access: string;
  createdAt: string;
  story: boolean;
  purpose: SlpPurpose | null;
};

/** A comment on one of their posts, by someone else. */
export type SlurpPurposeComment = { postId: string; handle: string; text: string; createdAt: string };

/**
 * The candidates, from their recent posts (newest first) and the comments on them. `drops` are the
 * teased drops still to come. Pure, so the read side stays a plain query.
 */
export function slurpStoryCandidates(input: {
  posts: readonly SlurpPurposePost[];
  comments: readonly SlurpPurposeComment[];
  drops: readonly { campaignId: string; dropAt: string }[];
  poll: SlurpPollPlan | null;
  at: Date;
}): SlurpStoryCandidates {
  const now = input.at.getTime();
  const within = (createdAt: string, ms: number) => now - Date.parse(createdAt) <= ms;
  const stories = input.posts.filter((post) => post.story);
  const pointedAt = new Set(stories.map((story) => story.purpose?.postId).filter(Boolean));
  const countedDown = new Set(
    stories.filter((story) => story.purpose?.kind === "countdown").map((story) => story.purpose?.campaignId),
  );
  const answered = new Set(
    stories.filter((story) => story.purpose?.kind === "comment_reaction").map((story) => story.purpose?.comment?.text),
  );
  const newest = input.posts.find((post) => !post.story);
  const drop = input.drops.find((entry) => !countedDown.has(entry.campaignId));
  const comment = input.comments.find((entry) => within(entry.createdAt, COMMENT_MS) && !answered.has(entry.text));
  const commentPost = comment ? input.posts.find((post) => post.id === comment.postId) : null;
  const pollLately = stories.some((story) => story.purpose?.kind === "poll" && within(story.createdAt, 48 * HOUR));
  const today = stories.filter((story) => within(story.createdAt, SAME_DAY_MS));
  const title = (post: SlurpPurposePost) => post.title?.trim() || post.content.trim().slice(0, 80);
  return {
    countdown: drop ?? null,
    newPost:
      newest && within(newest.createdAt, NEW_POST_MS) && !pointedAt.has(newest.id)
        ? { postId: newest.id, title: title(newest) }
        : null,
    comment: comment && commentPost ? { ...comment, postTitle: title(commentPost) } : null,
    poll: pollLately ? null : input.poll,
    earlier: today[0] ? { line: today[0].content.trim().slice(0, 140), count: today.length } : null,
  };
}

/** Everything the planner decided about purpose, ready for the prompt and the post's metadata. */
export type SlurpPurposePlan = {
  purpose: SlpPurpose;
  line: string;
  linkedPostId?: string | null;
  poll?: SlurpPollPlan | null;
  /** A drop delivers the spicy kind its tease hinted at. */
  spiceKind?: string | null;
};

/**
 * What the post stores: its purpose, the post a Story links through to, and a Story poll whose
 * question is the Story's own line (written in the Creator's voice and language). A post of an
 * active storyline that had no other reason reads as a storyline beat.
 */
export function slurpPurposeMetadata(
  plan: SlurpPurposePlan | null | undefined,
  content: string,
  input: { storyline?: boolean } = {},
): Record<string, unknown> {
  if (!plan) return {};
  const purpose =
    plan.purpose.kind === "daily_life" && input.storyline
      ? { ...plan.purpose, kind: "storyline" as const }
      : plan.purpose;
  const poll = plan.poll
    ? createSlpPoll({ question: content.replace(/\s+/g, " ").trim().slice(0, 240) || "?", options: plan.poll.options })
    : null;
  return {
    slurpPurpose: purpose,
    ...(plan.linkedPostId ? { noodlerLinkedPostId: plan.linkedPostId } : {}),
    ...(poll ? { poll } : {}),
  };
}

/** One metadata write a published post causes: a new purpose, and for a Story its link-through. */
export type SlurpPurposeLink = { postId: string; purpose: SlpPurpose; linkedPostId?: string };

/**
 * The links a post that just went up closes: a drop points its tease and the countdown Stories at
 * itself (and itself back at the tease); a tease or a countdown that goes up after its drop points at
 * the drop. Each link is written once; nothing already linked is touched.
 */
export function slurpPurposeLinks(
  self: { id: string; purpose: SlpPurpose | null; story: boolean },
  posts: readonly SlurpPurposePost[],
): SlurpPurposeLink[] {
  const purpose = self.purpose;
  if (!purpose?.campaignId || !["drop", "tease", "countdown"].includes(purpose.kind)) return [];
  const same = posts.filter((post) => post.id !== self.id && post.purpose?.campaignId === purpose.campaignId);
  if (purpose.kind === "drop") {
    const links: SlurpPurposeLink[] = same
      .filter((post) => (post.purpose?.kind === "tease" || post.purpose?.kind === "countdown") && !post.purpose.postId)
      .map((post) => ({
        postId: post.id,
        purpose: { ...post.purpose!, postId: self.id },
        ...(post.story ? { linkedPostId: self.id } : {}),
      }));
    const tease = same.find((post) => post.purpose?.kind === "tease");
    if (tease && !purpose.teasePostId) links.push({ postId: self.id, purpose: { ...purpose, teasePostId: tease.id } });
    return links;
  }
  const drop = same.find((post) => post.purpose?.kind === "drop");
  if (!drop || purpose.postId) return [];
  return [
    { postId: self.id, purpose: { ...purpose, postId: drop.id }, ...(self.story ? { linkedPostId: drop.id } : {}) },
  ];
}

/** The backfilled teaser stays one glance long. */
const LOCKED_TEASER_BACKFILL_MAX = 90;

/**
 * The line a non-subscriber reads under a locked post. The post's own generated `lockedTeaser`
 * wins; an older locked post without one gets the opening of its own caption, cut short so it
 * trails off rather than giving the post away. Null (the fixed line) only when the post has no
 * caption of its own or the opening only repeats the title the card already shows.
 */
export function slurpLockedPostTeaser(post: {
  title: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
}): string | null {
  const own = post.metadata?.lockedTeaser;
  if (typeof own === "string" && own.trim()) return own.trim();
  const text = post.content?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const sentence = (text.split(/(?<=[.!?…])\s/u)[0] ?? text).replace(/[.!?,;:…\s]+$/u, "");
  const same = (value: string) =>
    value
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  if (!sentence || (post.title && same(sentence) === same(post.title))) return null;
  if (sentence.length < LOCKED_TEASER_BACKFILL_MAX) return `${sentence}…`;
  const clipped = sentence.slice(0, LOCKED_TEASER_BACKFILL_MAX - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 30 ? clipped.slice(0, lastSpace) : clipped).replace(/[.!?,;:\s]+$/u, "")}…`;
}
