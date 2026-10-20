/**
 * The Slurp Support desk: where a Creator stands with the platform (docs/SUPPORT-DESK.md).
 *
 * One record per Creator, kept beside the Creator like the steering. Trust is how the Creator feels
 * about Slurp; suspicion is how much they sense Slurp is playing them. The player sees both numbers;
 * the Creator only ever sees the tier, in the Support prompt. The rest is what the desk runs with
 * them: perks, badges, a challenge, a contract, favours owed, an open ticket, a leave countdown.
 *
 * Pure: the server stores it and runs the tick, the client shows it. Every reader goes through
 * `normalizeSlpSupportDesk`, so an old or broken record never breaks the desk.
 */
import { z } from "zod";

export const SLP_DESK_TIERS = ["wary", "neutral", "cooperative", "partner"] as const;
export type SlpDeskTier = (typeof SLP_DESK_TIERS)[number];

/** How a Creator feels about platforms in general, read once from their card. */
export const SLP_DESK_ATTITUDES = ["loyal", "cynical", "demanding", "indifferent"] as const;
export type SlpDeskAttitude = (typeof SLP_DESK_ATTITUDES)[number];

export const SLP_DESK_BADGES = ["rising", "verified", "partner"] as const;
export type SlpDeskBadge = (typeof SLP_DESK_BADGES)[number];

export const SLP_DESK_TICKET_KINDS = ["help", "caught", "leaving"] as const;
export type SlpDeskTicketKind = (typeof SLP_DESK_TICKET_KINDS)[number];
export const SLP_DESK_TICKET_STATUSES = ["open", "waiting", "resolved"] as const;
export type SlpDeskTicketStatus = (typeof SLP_DESK_TICKET_STATUSES)[number];

/** What a ticket a Creator opens is about. Picked from their real situation by the tick. */
export const SLP_DESK_TICKET_TOPICS = ["views", "fan", "badge", "collab", "money", "burnout"] as const;
export type SlpDeskTicketTopic = (typeof SLP_DESK_TICKET_TOPICS)[number];

export const SLP_DESK_PERKS = ["feature", "badge", "coins"] as const;
export type SlpDeskPerkKind = (typeof SLP_DESK_PERKS)[number];

export const SLP_DESK_CHALLENGE_METRICS = ["posts", "stories"] as const;
export type SlpDeskChallengeMetric = (typeof SLP_DESK_CHALLENGE_METRICS)[number];

export const SLP_DESK_TRUST_MIN = -100;
export const SLP_DESK_TRUST_MAX = 100;
/** Trust at or below this starts the leave warning. */
export const SLP_DESK_LEAVE_AT = -80;
/** Trust back above this during the countdown wins them back. */
export const SLP_DESK_STAY_AT = -60;
export const SLP_DESK_COINS_MAX = 5000;
export const SLP_DESK_FEATURE_DAYS_MAX = 7;
export const SLP_DESK_THROTTLE_DAYS_MAX = 7;
export const SLP_DESK_TEXT_MAX = 400;
const LOG_MAX = 30;
const INTEL_MAX = 10;
const CHALLENGES_MAX = 6;
const ASKS_MAX = 10;
const DAY_MS = 86_400_000;

export type SlpDeskPerk = {
  kind: SlpDeskPerkKind;
  /** For `badge`. */
  badge?: SlpDeskBadge;
  /** For `coins`. */
  coins?: number;
  /** For `feature`: how long the Discover feature runs. */
  days?: number;
};

export type SlpDeskTicket = {
  id: string;
  kind: SlpDeskTicketKind;
  topic: string;
  status: SlpDeskTicketStatus;
  openedBy: "creator" | "support";
  openedAt: string;
  resolvedAt: string | null;
  /** 1–5, given by the Creator when Support resolves it. */
  rating: number | null;
};

export type SlpDeskChallenge = {
  id: string;
  metric: SlpDeskChallengeMetric;
  count: number;
  /** How many the Creator had published when it started; progress counts from here. */
  baseline: number;
  progress: number;
  until: string;
  reward: SlpDeskPerk;
  status: "offered" | "active" | "won" | "failed";
  at: string;
};

export type SlpDeskContract = {
  id: string;
  postsPerWeek: number;
  themes: string[];
  /** Coins Slurp pays for every week the terms are kept. */
  weeklyBonus: number;
  status: "offered" | "active" | "ended";
  since: string;
  until: string;
  /** The week being counted: its start and the published count at its start. */
  weekStart: string;
  weekBaseline: number;
  broken: number;
};

export type SlpDeskIntel = { id: string; text: string; aboutAccountId: string | null; at: string; used: boolean };

/** One line of the case file: what happened and what it did to trust and suspicion. */
export type SlpDeskLogEntry = { at: string; text: string; trust: number; suspicion: number };

export type SlpSupportDesk = {
  trust: number;
  suspicion: number;
  attitude: SlpDeskAttitude | null;
  /** The desk record was started (from the sign-up or first contact). */
  seededAt: string | null;
  /** Last time the tick ran for this Creator. */
  tickedAt: string | null;
  badges: SlpDeskBadge[];
  featuredUntil: string | null;
  throttle: { until: string; factor: number } | null;
  favours: number;
  challenges: SlpDeskChallenge[];
  contract: SlpDeskContract | null;
  ticket: SlpDeskTicket | null;
  /** The leave warning is out; the Creator leaves when it runs out. */
  leaving: { since: string; until: string } | null;
  /** Left Slurp: no posts, the page says so, the tick skips them. Nothing is deleted. */
  pausedAt: string | null;
  /** Automatic posting was on when they left; it comes back on when they return. */
  pausedAutoPosting: boolean;
  intel: SlpDeskIntel[];
  /** When Support last asked something of them, newest last (many asks in a day cost trust). */
  asks: string[];
  /** Notices already sent ("milestone:1000", "trending:<post id>"), so each goes out once. */
  noticed: string[];
  log: SlpDeskLogEntry[];
};

export const SLP_DEFAULT_SUPPORT_DESK: SlpSupportDesk = {
  trust: 0,
  suspicion: 0,
  attitude: null,
  seededAt: null,
  tickedAt: null,
  badges: [],
  featuredUntil: null,
  throttle: null,
  favours: 0,
  challenges: [],
  contract: null,
  ticket: null,
  leaving: null,
  pausedAt: null,
  pausedAutoPosting: false,
  intel: [],
  asks: [],
  noticed: [],
  log: [],
};

// ---------------------------------------------------------------------------------------------
// Settings (Settings › Stir)

export const SLP_DESK_TICKET_PACES = ["off", "rare", "sometimes", "often"] as const;
export const SLP_DESK_RATES = ["low", "normal", "high"] as const;
export type SlpDeskRate = (typeof SLP_DESK_RATES)[number];

export const slpSupportDeskSettingsSchema = z.object({
  /** How often Creators open tickets on their own. Off by default. */
  tickets: z.enum(SLP_DESK_TICKET_PACES).default("off"),
  /** Slurp's own notices in Support threads. */
  noticeMilestones: z.boolean().default(true),
  noticeTrending: z.boolean().default(true),
  noticeResults: z.boolean().default(true),
  /** Trust matters: a Creator may refuse or counter an offer. Off: they always go along. */
  refusals: z.boolean().default(true),
  /** Throttles, rumours and warnings without cause. Off hides them from the desk. */
  shadyMoves: z.boolean().default(true),
  /** A Creator at the bottom of Trust may leave Slurp (paused, never deleted). Off: they only go quiet. */
  leaving: z.boolean().default(true),
  /** AI Support sends notices, badges and offers to the Creators the player runs. */
  toYourCreators: z.boolean().default(true),
  /** AI Support plays the same games with the player's Creators. */
  gamesWithYourCreators: z.boolean().default(false),
  /** Advanced. */
  trustRate: z.enum(SLP_DESK_RATES).default("normal"),
  suspicionRate: z.enum(SLP_DESK_RATES).default("normal"),
  winBackDays: z.number().int().min(1).max(14).default(3),
});
export type SlpSupportDeskSettings = z.infer<typeof slpSupportDeskSettingsSchema>;
export const SLP_DEFAULT_SUPPORT_DESK_SETTINGS: SlpSupportDeskSettings = slpSupportDeskSettingsSchema.parse({});

export function normalizeSlpSupportDeskSettings(raw: unknown): SlpSupportDeskSettings {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(slpSupportDeskSettingsSchema.shape)) {
    const parsed = (field as z.ZodTypeAny).safeParse(value[key]);
    out[key] = parsed.success ? parsed.data : (SLP_DEFAULT_SUPPORT_DESK_SETTINGS as Record<string, unknown>)[key];
  }
  return out as SlpSupportDeskSettings;
}

const RATE: Record<SlpDeskRate, number> = { low: 0.5, normal: 1, high: 1.6 };

// ---------------------------------------------------------------------------------------------
// Reading a stored record

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const num = (value: unknown, fallback = 0) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const str = (value: unknown, max = SLP_DESK_TEXT_MAX) =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, max) : "";
const date = (value: unknown) => {
  const text = str(value, 40);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
};
const record = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null =>
  list.includes(value as T) ? (value as T) : null;

export function normalizeSlpDeskPerk(raw: unknown): SlpDeskPerk | null {
  const value = record(raw);
  const kind = oneOf(SLP_DESK_PERKS, value?.kind);
  if (!value || !kind) return null;
  if (kind === "badge") {
    const badge = oneOf(SLP_DESK_BADGES, value.badge);
    return badge ? { kind, badge } : null;
  }
  if (kind === "coins") {
    const coins = Math.round(clamp(num(value.coins), 0, SLP_DESK_COINS_MAX));
    return coins > 0 ? { kind, coins } : null;
  }
  return { kind, days: Math.round(clamp(num(value.days, 2), 1, SLP_DESK_FEATURE_DAYS_MAX)) };
}

function ticket(raw: unknown): SlpDeskTicket | null {
  const value = record(raw);
  const openedAt = date(value?.openedAt);
  if (!value || !openedAt || !str(value.id, 64)) return null;
  const rating = num(value.rating, 0);
  return {
    id: str(value.id, 64),
    kind: oneOf(SLP_DESK_TICKET_KINDS, value.kind) ?? "help",
    topic: str(value.topic, 160),
    status: oneOf(SLP_DESK_TICKET_STATUSES, value.status) ?? "open",
    openedBy: value.openedBy === "support" ? "support" : "creator",
    openedAt,
    resolvedAt: date(value.resolvedAt),
    rating: rating >= 1 && rating <= 5 ? Math.round(rating) : null,
  };
}

function challenge(raw: unknown): SlpDeskChallenge | null {
  const value = record(raw);
  const reward = normalizeSlpDeskPerk(value?.reward);
  const until = date(value?.until);
  const at = date(value?.at);
  const metric = oneOf(SLP_DESK_CHALLENGE_METRICS, value?.metric);
  if (!value || !reward || !until || !at || !metric || !str(value.id, 64)) return null;
  return {
    id: str(value.id, 64),
    metric,
    count: Math.round(clamp(num(value.count, 1), 1, 30)),
    baseline: Math.max(0, Math.round(num(value.baseline))),
    progress: Math.max(0, Math.round(num(value.progress))),
    until,
    reward,
    status: oneOf(["offered", "active", "won", "failed"] as const, value.status) ?? "offered",
    at,
  };
}

function contract(raw: unknown): SlpDeskContract | null {
  const value = record(raw);
  const since = date(value?.since);
  const until = date(value?.until);
  if (!value || !since || !until || !str(value.id, 64)) return null;
  return {
    id: str(value.id, 64),
    postsPerWeek: Math.round(clamp(num(value.postsPerWeek, 3), 1, 21)),
    themes: (Array.isArray(value.themes) ? value.themes : [])
      .map((entry) => str(entry, 60))
      .filter(Boolean)
      .slice(0, 3),
    weeklyBonus: Math.round(clamp(num(value.weeklyBonus, 100), 0, SLP_DESK_COINS_MAX)),
    status: oneOf(["offered", "active", "ended"] as const, value.status) ?? "offered",
    since,
    until,
    weekStart: date(value.weekStart) ?? since,
    weekBaseline: Math.max(0, Math.round(num(value.weekBaseline))),
    broken: Math.max(0, Math.round(num(value.broken))),
  };
}

export function normalizeSlpSupportDesk(raw: unknown): SlpSupportDesk {
  const value = record(raw) ?? {};
  const throttle = record(value.throttle);
  const throttleUntil = date(throttle?.until);
  const leaving = record(value.leaving);
  const leavingSince = date(leaving?.since);
  const leavingUntil = date(leaving?.until);
  return {
    trust: Math.round(clamp(num(value.trust), SLP_DESK_TRUST_MIN, SLP_DESK_TRUST_MAX)),
    suspicion: Math.round(clamp(num(value.suspicion), 0, 100)),
    attitude: oneOf(SLP_DESK_ATTITUDES, value.attitude),
    seededAt: date(value.seededAt),
    tickedAt: date(value.tickedAt),
    badges: [
      ...new Set((Array.isArray(value.badges) ? value.badges : []).map((b) => oneOf(SLP_DESK_BADGES, b))),
    ].filter((badge): badge is SlpDeskBadge => badge !== null),
    featuredUntil: date(value.featuredUntil),
    throttle: throttleUntil ? { until: throttleUntil, factor: clamp(num(throttle?.factor, 0.5), 0.1, 1) } : null,
    favours: Math.round(clamp(num(value.favours), 0, 20)),
    challenges: (Array.isArray(value.challenges) ? value.challenges : [])
      .map(challenge)
      .filter((entry): entry is SlpDeskChallenge => entry !== null)
      .slice(-CHALLENGES_MAX),
    contract: contract(value.contract),
    ticket: ticket(value.ticket),
    leaving: leavingSince && leavingUntil ? { since: leavingSince, until: leavingUntil } : null,
    pausedAt: date(value.pausedAt),
    pausedAutoPosting: value.pausedAutoPosting === true,
    intel: (Array.isArray(value.intel) ? value.intel : [])
      .map(record)
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .map((entry) => ({
        id: str(entry.id, 64),
        text: str(entry.text),
        aboutAccountId: str(entry.aboutAccountId, 64) || null,
        at: date(entry.at) ?? "",
        used: entry.used === true,
      }))
      .filter((entry) => entry.id && entry.text && entry.at)
      .slice(-INTEL_MAX),
    asks: (Array.isArray(value.asks) ? value.asks : [])
      .map(date)
      .filter((entry): entry is string => entry !== null)
      .slice(-ASKS_MAX),
    noticed: (Array.isArray(value.noticed) ? value.noticed : [])
      .map((entry) => str(entry, 120))
      .filter(Boolean)
      .slice(-40),
    log: (Array.isArray(value.log) ? value.log : [])
      .map(record)
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .map((entry) => ({
        at: date(entry.at) ?? "",
        text: str(entry.text, 200),
        trust: Math.round(num(entry.trust)),
        suspicion: Math.round(num(entry.suspicion)),
      }))
      .filter((entry) => entry.at && entry.text)
      .slice(-LOG_MAX),
  };
}

// ---------------------------------------------------------------------------------------------
// Rules

export function slpDeskTier(trust: number): SlpDeskTier {
  if (trust < -25) return "wary";
  if (trust < 25) return "neutral";
  if (trust < 60) return "cooperative";
  return "partner";
}

/**
 * Change trust and suspicion and write one case-file line. Trust gains and losses scale with the
 * trust rate; suspicion rises faster when the Creator already trusts Slurp little.
 */
export function slpDeskAdjust(
  desk: SlpSupportDesk,
  change: { trust?: number; suspicion?: number; text: string },
  settings: Pick<SlpSupportDeskSettings, "trustRate" | "suspicionRate"> = SLP_DEFAULT_SUPPORT_DESK_SETTINGS,
  at = new Date(),
): SlpSupportDesk {
  const trustDelta = Math.round((change.trust ?? 0) * RATE[settings.trustRate]);
  const lowTrust = desk.trust < -25 ? 1.5 : 1;
  const rawSuspicion = change.suspicion ?? 0;
  const suspicionDelta = Math.round(
    rawSuspicion > 0 ? rawSuspicion * RATE[settings.suspicionRate] * lowTrust : rawSuspicion,
  );
  const trust = clamp(desk.trust + trustDelta, SLP_DESK_TRUST_MIN, SLP_DESK_TRUST_MAX);
  const suspicion = clamp(desk.suspicion + suspicionDelta, 0, 100);
  return {
    ...desk,
    trust,
    suspicion,
    log: [
      ...desk.log,
      {
        at: at.toISOString(),
        text: change.text.slice(0, 200),
        trust: trust - desk.trust,
        suspicion: suspicion - desk.suspicion,
      },
    ].slice(-LOG_MAX),
  };
}

/**
 * Support asked something of the Creator. More than three asks inside a day costs trust: nobody
 * likes being handled.
 */
export function slpDeskAsk(
  desk: SlpSupportDesk,
  settings: Pick<SlpSupportDeskSettings, "trustRate" | "suspicionRate"> = SLP_DEFAULT_SUPPORT_DESK_SETTINGS,
  at = new Date(),
): SlpSupportDesk {
  const recent = desk.asks.filter((entry) => at.getTime() - Date.parse(entry) < DAY_MS);
  const next = { ...desk, asks: [...recent, at.toISOString()].slice(-ASKS_MAX) };
  return recent.length >= 3 ? slpDeskAdjust(next, { trust: -3, text: "Too many asks in one day" }, settings, at) : next;
}

/** The chance of being caught within one day at this suspicion, 0–1. Shown as "Risk n%". */
export function slpDeskDailyRisk(suspicion: number): number {
  if (suspicion <= 0) return 0;
  return Math.min(0.85, Math.pow(suspicion / 100, 1.5) * 0.7);
}

/** The same chance for any stretch of time, so a tick every minute and one a day agree. */
export function slpDeskRiskFor(suspicion: number, elapsedMs: number): number {
  const daily = slpDeskDailyRisk(suspicion);
  return daily <= 0 || elapsedMs <= 0 ? 0 : 1 - Math.pow(1 - daily, elapsedMs / DAY_MS);
}

/** Suspicion fades by itself: about 4 points a day, half as fast at low trust. */
export function slpDeskDecay(desk: SlpSupportDesk, elapsedMs: number): SlpSupportDesk {
  const perDay = desk.trust < -25 ? 2 : 4;
  const fade = (elapsedMs / DAY_MS) * perDay;
  return fade <= 0 ? desk : { ...desk, suspicion: Math.max(0, desk.suspicion - fade) };
}

export const slpDeskActive = (until: string | null | undefined, at = new Date()) =>
  Boolean(until && Date.parse(until) > at.getTime());

/** The reach multiplier the desk puts on a Creator's posts right now (throttle, Discover feature). */
export function slpDeskReachFactor(desk: SlpSupportDesk, at = new Date()): number {
  if (desk.pausedAt) return 0;
  let factor = 1;
  if (desk.throttle && slpDeskActive(desk.throttle.until, at)) factor *= desk.throttle.factor;
  if (slpDeskActive(desk.featuredUntil, at)) factor *= 1.6;
  if (desk.badges.includes("partner")) factor *= 1.1;
  return factor;
}

export type SlpDeskTickEvent =
  | { kind: "caught" }
  | { kind: "leave-warning" }
  | { kind: "won-back" }
  | { kind: "left" }
  | { kind: "challenge-won"; challenge: SlpDeskChallenge }
  | { kind: "challenge-failed"; challenge: SlpDeskChallenge }
  | { kind: "contract-broken"; contract: SlpDeskContract }
  | { kind: "contract-kept"; contract: SlpDeskContract }
  | { kind: "contract-ended"; contract: SlpDeskContract }
  | { kind: "ticket"; topic: SlpDeskTicketTopic };

/**
 * One tick of the desk for one Creator: fade suspicion, roll the risk, count challenges and the
 * contract, run the leave countdown, maybe open a ticket. Pure; the caller supplies the random
 * numbers and the published counts and carries out the events (messages, perks, pausing).
 */
export function slpDeskTick(
  desk: SlpSupportDesk,
  input: {
    at: Date;
    settings: SlpSupportDeskSettings;
    /** Published so far, for challenges and the contract. */
    counts: Record<SlpDeskChallengeMetric, number>;
    /** Uniform 0–1 numbers: [risk roll, ticket roll, ticket topic]. */
    rolls: [number, number, number];
    /** What the Creator's week looks like, to pick a ticket topic that fits. */
    situation?: { viewsDown?: boolean; hasCollabWish?: boolean };
  },
): { desk: SlpSupportDesk; events: SlpDeskTickEvent[] } {
  const { at, settings, counts, rolls } = input;
  const events: SlpDeskTickEvent[] = [];
  const now = at.getTime();
  const elapsed = desk.tickedAt ? Math.max(0, Math.min(7 * DAY_MS, now - Date.parse(desk.tickedAt))) : 0;
  let next: SlpSupportDesk = { ...slpDeskDecay(desk, elapsed), tickedAt: at.toISOString() };
  if (next.pausedAt) return { desk: next, events };

  // Caught: a large trust drop, suspicion resets, the Creator confronts Support.
  if (settings.shadyMoves && next.suspicion > 0 && rolls[0] < slpDeskRiskFor(next.suspicion, elapsed)) {
    next = slpDeskAdjust(next, { trust: -35, text: "Caught Slurp playing them" }, settings, at);
    next = { ...next, suspicion: 0 };
    events.push({ kind: "caught" });
  }

  // Expired effects fall away.
  if (next.throttle && !slpDeskActive(next.throttle.until, at)) next = { ...next, throttle: null };
  if (next.featuredUntil && !slpDeskActive(next.featuredUntil, at)) next = { ...next, featuredUntil: null };

  // Challenges.
  next = {
    ...next,
    challenges: next.challenges.map((entry) => {
      if (entry.status !== "active") return entry;
      const progress = Math.max(0, counts[entry.metric] - entry.baseline);
      if (progress >= entry.count) {
        const won = { ...entry, progress, status: "won" as const };
        events.push({ kind: "challenge-won", challenge: won });
        return won;
      }
      if (Date.parse(entry.until) <= now) {
        const failed = { ...entry, progress, status: "failed" as const };
        events.push({ kind: "challenge-failed", challenge: failed });
        return failed;
      }
      return { ...entry, progress };
    }),
  };

  // The contract: each finished week is kept or broken; the end closes it.
  if (next.contract?.status === "active") {
    let running: SlpDeskContract = next.contract;
    while (Date.parse(running.weekStart) + 7 * DAY_MS <= now) {
      const published = counts.posts + counts.stories - running.weekBaseline;
      const kept = published >= running.postsPerWeek;
      events.push({ kind: kept ? "contract-kept" : "contract-broken", contract: running });
      next = kept
        ? slpDeskAdjust(next, { trust: 2, text: "Kept the contract this week and got the bonus" }, settings, at)
        : slpDeskAdjust(next, { text: "Broke a contract term: no bonus this week" }, settings, at);
      running = {
        ...running,
        broken: running.broken + (kept ? 0 : 1),
        weekStart: new Date(Date.parse(running.weekStart) + 7 * DAY_MS).toISOString(),
        weekBaseline: counts.posts + counts.stories,
      };
    }
    if (Date.parse(running.until) <= now) {
      running = { ...running, status: "ended" };
      events.push({ kind: "contract-ended", contract: running });
    }
    next = { ...next, contract: running };
  }

  // Leaving: warn at the bottom, win back above the line, leave when the countdown runs out.
  if (settings.leaving) {
    if (!next.leaving && next.trust <= SLP_DESK_LEAVE_AT) {
      next = {
        ...next,
        leaving: { since: at.toISOString(), until: new Date(now + settings.winBackDays * DAY_MS).toISOString() },
      };
      events.push({ kind: "leave-warning" });
    } else if (next.leaving && next.trust > SLP_DESK_STAY_AT) {
      next = { ...next, leaving: null };
      events.push({ kind: "won-back" });
    } else if (next.leaving && Date.parse(next.leaving.until) <= now) {
      next = { ...next, leaving: null, pausedAt: at.toISOString() };
      events.push({ kind: "left" });
    }
  } else if (next.leaving) {
    next = { ...next, leaving: null };
  }

  // A ticket, only when none is open and nothing louder happened this tick.
  const pace = { off: 0, rare: 0.15, sometimes: 0.35, often: 0.7 }[settings.tickets];
  const ticketOpen = next.ticket && next.ticket.status !== "resolved";
  if (
    pace > 0 &&
    !ticketOpen &&
    events.length === 0 &&
    elapsed > 0 &&
    rolls[1] < 1 - Math.pow(1 - pace, elapsed / DAY_MS)
  ) {
    events.push({ kind: "ticket", topic: slpDeskTicketTopic(next, input.situation ?? {}, rolls[2], at) });
  }
  return { desk: next, events };
}

/** What a Creator writes in about, from their real situation first, then by chance. */
export function slpDeskTicketTopic(
  desk: SlpSupportDesk,
  situation: { viewsDown?: boolean; hasCollabWish?: boolean },
  roll: number,
  at = new Date(),
): SlpDeskTicketTopic {
  if (situation.viewsDown || (desk.throttle && slpDeskActive(desk.throttle.until, at))) return "views";
  if (situation.hasCollabWish) return "collab";
  const open: SlpDeskTicketTopic[] = ["fan", "money", "burnout", ...(desk.badges.length < 2 ? ["badge" as const] : [])];
  return open[Math.min(open.length - 1, Math.floor(roll * open.length))]!;
}

/** Trust change for a resolved ticket's rating (1–5). */
export const slpDeskRatingTrust = (rating: number) => [-10, -5, 0, 5, 10][clamp(Math.round(rating), 1, 5) - 1]!;

/** A perk's trust worth. */
export function slpDeskPerkTrust(perk: SlpDeskPerk): number {
  if (perk.kind === "badge") return perk.badge === "partner" ? 15 : perk.badge === "verified" ? 10 : 6;
  if (perk.kind === "coins") return Math.min(12, Math.round(3 + (perk.coins ?? 0) / 150));
  return 4 + (perk.days ?? 1);
}

/** Give a perk: the effect on the record, one favour owed, and the trust it buys. */
export function slpDeskGrantPerk(
  desk: SlpSupportDesk,
  perk: SlpDeskPerk,
  settings: Pick<SlpSupportDeskSettings, "trustRate" | "suspicionRate"> = SLP_DEFAULT_SUPPORT_DESK_SETTINGS,
  at = new Date(),
): SlpSupportDesk {
  let next: SlpSupportDesk = { ...desk, favours: Math.min(20, desk.favours + 1) };
  if (perk.kind === "badge" && perk.badge && !next.badges.includes(perk.badge))
    next = { ...next, badges: [...next.badges, perk.badge] };
  if (perk.kind === "feature") {
    const from = Math.max(at.getTime(), next.featuredUntil ? Date.parse(next.featuredUntil) : 0);
    next = { ...next, featuredUntil: new Date(from + (perk.days ?? 2) * DAY_MS).toISOString() };
  }
  return slpDeskAdjust(next, { trust: slpDeskPerkTrust(perk), text: slpDeskPerkLine(perk) }, settings, at);
}

export function slpDeskPerkLine(perk: SlpDeskPerk): string {
  if (perk.kind === "badge") return `Got the ${perk.badge} badge`;
  if (perk.kind === "coins") return `Got a ${perk.coins} coin bonus`;
  return `Featured on Discover for ${perk.days} day${perk.days === 1 ? "" : "s"}`;
}

/** The start of a desk record: Creators Support signed up start warm, everyone else neutral. */
export function slpDeskSeed(desk: SlpSupportDesk, input: { signedUpBySupport: boolean; at?: Date }): SlpSupportDesk {
  if (desk.seededAt) return desk;
  const at = input.at ?? new Date();
  return {
    ...desk,
    trust: input.signedUpBySupport ? 20 : 0,
    seededAt: at.toISOString(),
    log: [
      ...desk.log,
      {
        at: at.toISOString(),
        text: input.signedUpBySupport ? "Signed up through Slurp Support" : "First contact with Slurp Support",
        trust: input.signedUpBySupport ? 20 : 0,
        suspicion: 0,
      },
    ],
  };
}

/**
 * How a Creator feels about platforms, read once from their name and bio: the words that give it away
 * first, then a stable pick by id so every Creator has one. No model call.
 */
export function slpDeskAttitudeFor(text: string, seed: string): SlpDeskAttitude {
  const words = text.toLocaleLowerCase();
  if (/\b(cynic|sarcas|jaded|skeptic|sceptic|distrust|rebel|anti|conspirac)/u.test(words)) return "cynical";
  if (/\b(diva|demanding|ambitious|boss|queen|king|perfection|entitled|hustl)/u.test(words)) return "demanding";
  if (/\b(loyal|grateful|thankful|sweet|kind|devoted|supportive)/u.test(words)) return "loyal";
  const pick = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 11) % 4;
  return SLP_DESK_ATTITUDES[pick]!;
}

/** The Creator's standing in words, for the Support prompt. Never the numbers. */
export function slpDeskPromptLine(desk: SlpSupportDesk, supportName: string): string {
  const tier = slpDeskTier(desk.trust);
  const feel = {
    wary: `You do not trust ${supportName} much right now; you are guarded and short with them, and you do not do them favours.`,
    neutral: `You are neutral about ${supportName}: polite, businesslike, you weigh what they ask.`,
    cooperative: `You get on well with ${supportName}; you are open with them and happy to help when it suits you.`,
    partner: `You trust ${supportName}; Slurp has been good to you and you go out of your way for them.`,
  }[tier];
  const attitude = desk.attitude
    ? {
        loyal: "In general you are loyal to the platforms you use.",
        cynical: "In general you are cynical about platforms: you assume they want something.",
        demanding: "In general you expect a lot from platforms and say so.",
        indifferent: "In general platforms do not interest you much; you just want to post.",
      }[desk.attitude]
    : "";
  const extra = [
    desk.leaving ? "You have told them you are thinking about leaving Slurp." : "",
    desk.favours > 0 ? `You owe ${supportName} ${desk.favours === 1 ? "a favour" : "a few favours"}.` : "",
    desk.contract?.status === "active"
      ? `You are under an exclusive Slurp contract: ${desk.contract.postsPerWeek} posts a week${
          desk.contract.themes.length ? ` about ${desk.contract.themes.join(", ")}` : ""
        }.`
      : "",
    desk.badges.length ? `Slurp gave you these badges: ${desk.badges.join(", ")}.` : "",
  ].filter(Boolean);
  return [feel, attitude, ...extra].filter(Boolean).join(" ");
}
