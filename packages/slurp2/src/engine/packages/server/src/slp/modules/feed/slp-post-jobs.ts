/**
 * Post jobs: what kind of post this is, the way real creator pages mix them (a try-on haul, a gym
 * set, a finished commission, a fan request). The beat says why the post exists; the job says
 * what the page shows. A job never sets the spice: the dial and the card heat decide how much is
 * shown, the job decides what the post is.
 *
 * The niche from the card weighs the jobs. The main niche keeps at most half of the Creator's
 * last posts, and a Creator never repeats one of their last three jobs, so a page has an identity
 * without posting the same thing.
 */
import { slurpWeightedPick } from "./slp-weighted.js";

export const SLURP_NICHES = [
  "fitness",
  "cosplay",
  "artist",
  "gamer",
  "music",
  "tech",
  "nerd",
  "outdoors",
  "fashion",
  "dance",
  "cooking",
  "alt",
] as const;
export type SlurpNiche = (typeof SLURP_NICHES)[number];
export type SlurpNiches = { main: SlurpNiche | null; side: SlurpNiche[] };

/**
 * `niches` empty: an everyday job any Creator posts. `place`: the job happens there, so it only goes
 * on a post that has no place yet. `minHeat`: the lowest card heat (0-3) the job fits.
 */
export type SlurpPostJob = {
  id: string;
  niches: readonly SlurpNiche[];
  line: string;
  place?: string;
  minHeat?: number;
};

export const SLURP_POST_JOBS: readonly SlurpPostJob[] = [
  { id: "mirror-selfie", niches: [], line: "a mirror selfie: one quick shot of how you look right now." },
  { id: "try-on-haul", niches: [], line: "an outfit try-on haul: a few new pieces, one picture in your favourite." },
  {
    id: "get-ready",
    niches: [],
    place: "your mirror",
    line: "get ready with me: hair, make-up or getting dressed before you go out.",
  },
  {
    id: "morning-bed",
    niches: [],
    place: "your bed",
    minHeat: 1,
    line: "a lazy morning in bed: messy hair, sheets, the first light.",
  },
  {
    id: "shower-set",
    niches: [],
    place: "the bathroom",
    minHeat: 1,
    line: "a shower or bath set: steam, wet hair, a towel or robe.",
  },
  {
    id: "lingerie-set",
    niches: [],
    minHeat: 2,
    line: "a set in what you wear underneath or to bed, posed for your fans.",
  },
  {
    id: "outfit-poll",
    niches: [],
    line: "a poll: one of two looks you are torn between for tonight, and your followers vote.",
  },
  { id: "behind-scenes", niches: [], line: "behind the scenes of a shoot: the setup, the light, you between takes." },
  { id: "fan-request", niches: [], line: "a fan request: you post what a subscriber asked you for, and say so." },
  {
    id: "ppv-teaser",
    niches: [],
    minHeat: 1,
    line: "a teaser for a bigger set: one picture that shows a little of the rest.",
  },
  {
    id: "tip-thanks",
    niches: [],
    minHeat: 1,
    line: "a thank-you for a tip goal you hit: the reward picture you promised.",
  },
  { id: "day-off", niches: [], place: "your home", line: "a day off at home: comfy clothes, couch, snacks, no plans." },
  { id: "night-out", niches: [], place: "your hallway", line: "a night-out look: dressed up just before you leave." },
  { id: "workout-set", niches: ["fitness"], line: "a workout set: mid-training.", place: "the gym" },
  {
    id: "post-gym",
    niches: ["fitness"],
    place: "the gym",
    line: "a post-gym set: flushed and sweaty, still in your training clothes.",
  },
  {
    id: "progress-check",
    niches: ["fitness"],
    line: "a progress check: one mirror shot today that shows the training.",
  },
  { id: "costume-set", niches: ["cosplay"], line: "a costume set: you in full cosplay of a character you love." },
  { id: "cosplay-wip", niches: ["cosplay"], line: "a cosplay work in progress: wig, props, half the costume on." },
  { id: "finished-piece", niches: ["artist"], line: "a finished piece: you with the artwork you just completed." },
  {
    id: "sketch-wip",
    niches: ["artist"],
    place: "your desk or easel",
    line: "a work-in-progress sketch next to you at your desk or easel.",
  },
  {
    id: "draw-me",
    niches: ["artist"],
    line: "a 'draw me' request: a fan asked, and you share the result with you in it.",
  },
  {
    id: "stream-setup",
    niches: ["gamer"],
    place: "your stream desk",
    line: "your stream setup: you at the desk, lights and headset on.",
  },
  { id: "game-set", niches: ["gamer"], line: "a gamer set: you, the controller, and the game you cannot put down." },
  {
    id: "gig-night",
    niches: ["music", "dance"],
    line: "a gig or show night: you on stage or right after.",
    place: "the stage or backstage",
  },
  {
    id: "practice",
    niches: ["music", "dance"],
    line: "practice at home: you and your instrument or your moves.",
    place: "home",
  },
  {
    id: "desk-set",
    niches: ["tech", "nerd"],
    line: "a desk set: you at your workplace or home office.",
    place: "your desk",
  },
  {
    id: "study-set",
    niches: ["nerd"],
    line: "a study or library set: books, notes, glasses.",
    place: "a library or your study corner",
  },
  {
    id: "outdoor-set",
    niches: ["outdoors"],
    line: "an outdoor set: out in nature.",
    place: "outdoors: a trail, a lake or a beach",
  },
  { id: "song-clip", niches: ["music"], line: "a music post: a clip, a lyric or a track you are working on." },
  { id: "move-clip", niches: ["dance"], line: "a dance post: a move or a short routine you are proud of." },
  { id: "build-log", niches: ["tech"], line: "a tech post: a gadget, a build or a bug you finally fixed." },
  { id: "geek-out", niches: ["nerd"], line: "a nerd post: something you geeked out over today." },
  { id: "trip-find", niches: ["outdoors"], line: "an outdoors post: a view or a find from your latest trip." },
  { id: "dish-photo", niches: ["cooking"], line: "a cooking post: the dish you made and how it turned out." },
  { id: "fit-check", niches: ["fashion", "alt"], line: "a fit check: today's whole look, head to toe." },
  {
    id: "kitchen-set",
    niches: ["cooking"],
    line: "a kitchen set: you cooking or baking, flour and all.",
    place: "the kitchen",
  },
];

const JOB_BY_ID = new Map(SLURP_POST_JOBS.map((job) => [job.id, job]));

export const slurpPostJob = (id: string | undefined): SlurpPostJob | undefined => (id ? JOB_BY_ID.get(id) : undefined);

export function normalizeSlurpNiches(raw: unknown): SlurpNiches | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const niche = (value: unknown) =>
    typeof value === "string" && (SLURP_NICHES as readonly string[]).includes(value.trim().toLowerCase())
      ? (value.trim().toLowerCase() as SlurpNiche)
      : null;
  const main = niche(record.main);
  const side = [...new Set((Array.isArray(record.side) ? record.side : []).map(niche))]
    .filter((entry): entry is SlurpNiche => entry !== null && entry !== main)
    .slice(0, 2);
  return main || side.length ? { main, side } : undefined;
}

export type SlurpJobHistory = {
  /** This Creator's last jobs, newest first. */
  recentJobs?: readonly string[];
  /** Jobs across all Creators in the last day. */
  globalJobs?: Readonly<Record<string, number>>;
};

const MAIN_SHARE_WINDOW = 8;

/** The job for one ordinary post, or null when every job is used up. Deterministic like the beat. */
export function selectSlurpPostJob(
  creatorAccountId: string,
  sequence: number,
  niches: SlurpNiches | undefined,
  history: SlurpJobHistory,
  /** `placeFree`: the post has no place yet, so a job with a place may set it. */
  fit: { heatMax?: number; placeFree?: boolean; avoid?: readonly string[] } = {},
): SlurpPostJob | null {
  const avoid = (fit.avoid ?? []).map((topic) => topic.trim().toLowerCase()).filter(Boolean);
  const fits = (job: SlurpPostJob) =>
    (job.minHeat ?? 0) <= (fit.heatMax ?? 1) &&
    (!job.place || fit.placeFree) &&
    !avoid.some((topic) => `${job.id} ${job.line} ${job.place ?? ""}`.toLowerCase().includes(topic));
  const recent = history.recentJobs ?? [];
  const isMain = (job: SlurpPostJob | undefined) => Boolean(niches?.main && job?.niches.includes(niches.main));
  const mainFull =
    recent.slice(0, MAIN_SHARE_WINDOW).filter((id) => isMain(slurpPostJob(id))).length >= MAIN_SHARE_WINDOW / 2;
  const global = history.globalJobs ?? {};
  const total = Object.values(global).reduce((sum, count) => sum + count, 0);
  const cap = Math.max(2, Math.ceil((total / SLURP_POST_JOBS.length) * 2));
  const options = SLURP_POST_JOBS.map((job) => {
    const niche = !job.niches.length
      ? 1
      : isMain(job)
        ? mainFull
          ? 0
          : 3
        : niches?.side.some((side) => job.niches.includes(side))
          ? 2
          : 0;
    const fresh = recent.slice(0, 3).includes(job.id) ? 0 : 1;
    const crowded = (global[job.id] ?? 0) >= cap ? 0.2 : 1;
    return { value: job, weight: fits(job) ? niche * fresh * crowded : 0 };
  });
  return options.some((option) => option.weight > 0)
    ? slurpWeightedPick("postJob", creatorAccountId, sequence, options)
    : null;
}
