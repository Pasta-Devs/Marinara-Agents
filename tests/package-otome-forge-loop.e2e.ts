// Otome Hearth's whole release-1 loop in the Engine's Home tab, at 1280 × 800 (Midnight) and 390 × 844 (Pearl), at
// reduced motion and with text only, through /api/otome-forge/** answered in memory by one world: setup (premise,
// persona, two love interests of different genders, content, connections) and the forge; a main chapter read to its
// end; Home with his note and a tap; Reply into his thread; a wish; Wear at home; the Album; Read Them, Date Night and
// a Claw round; Remind Me, the tracker and a Caring message. Starlight earned on one screen is spent and shown on the
// next. A second walk, in the other look at each size, visits the screens around the loop: Who’s home, the cast and a
// bible, Rough day?, every Settings tab, the reader's Backlog and Ease off, the Album's other tabs and Your stories.
// On every screen both check the release's accessibility rules: each control is reached by Tab and shows a focus ring,
// nothing answers only a pointer, nothing animates at reduced motion, new lines reach a polite live region, and dialogs
// hold focus and give it back.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-loop.e2e.ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

type Json = Record<string, any>;
interface Call {
  method: string;
  path: string;
  query: Record<string, string>;
  body: Json | undefined;
}

const RUN = "r-e2e-loop01";
const ILVAR = "li-ilvar-0001";
const ROS = "li-rosalind-0002";
const HE = { subject: "he", object: "him", possessive: "his" };
const SHE = { subject: "she", object: "her", possessive: "her" };
const PREMISE = "In a city of clockwork canals, an apprentice sees a murder at the masked ball.";
const NOTE = "You left the lab light on again. I turned it off. Don’t thank me.";
const REPLY = "Barely. The data kept me company.";
const CARE_NOTE = "Blanket, tea, and no arguments tonight. I’ll keep the kettle warm.";
const READ_SET = "rh-e2e-loop01";
const written = { at: "2026-10-28T10:00:00.000Z", connectionId: "conn-text", model: "fixture" };
const now = () => new Date().toISOString();
const seg = (speaker: string, text: string, extra: Json = {}) => ({ speaker, text, ...extra });

/** The prologue: Mira's own evening, one scene with one choice, before anyone else in the story. */
const PROLOGUE_BEAT: Json = {
  places: [{ name: "The Canal Workshop", tags: "clockwork workshop, lamps" }],
  segments: [
    seg("", "The canal lamps hiss awake as you lock the workshop for the night.", { place: "The Canal Workshop" }),
    seg("Mira Vale", "One more commission and the apprenticeship is mine.", { thought: true }),
  ],
  choices: [
    {
      id: "choice-p",
      kind: "small",
      at: 1,
      options: [
        {
          id: "option-p1",
          text: "Finish the gears tonight.",
          selection: { kind: "action", text: "You unlock the door again." },
          segments: [seg("", "The gears can't wait, and neither can you.")],
        },
        {
          id: "option-p2",
          text: "Go to the ball.",
          selection: { kind: "action", text: "You take the mask from its hook." },
          segments: [seg("", "Just one night off.")],
        },
      ],
    },
  ],
};
/** Main chapter 1: a beat with a small choice, then a beat with both of them. */
const MAIN_BEATS: Json[] = [
  {
    places: [{ name: "The Clocktower Gallery", tags: "brass gears, night" }],
    segments: [
      seg("", "The gears above the gallery tick past midnight.", { place: "The Clocktower Gallery" }),
      seg("Ilvar Thorne", "You saw it too. Don’t pretend you didn’t."),
      seg("Mira Vale", "He knows. Of course he knows.", { thought: true }),
      seg("Ilvar Thorne", "Then we find out who did it. Together."),
    ],
    choices: [
      {
        id: "choice-1",
        kind: "small",
        at: 1,
        options: [
          {
            id: "option-1",
            text: "Admit it.",
            selection: { kind: "dialogue", text: "I saw everything." },
            segments: [seg("Ilvar Thorne", "Good. Lying never suited you.")],
          },
          {
            id: "option-2",
            text: "Deny it.",
            selection: { kind: "dialogue", text: "I saw nothing." },
            segments: [seg("Ilvar Thorne", "Hm. Your hands say otherwise.")],
          },
        ],
      },
    ],
  },
  {
    places: [{ name: "The Masked Ballroom", tags: "chandeliers" }],
    segments: [
      seg("", "Music spills down the stairs.", { place: "The Masked Ballroom" }),
      seg("Rosalind Vey", "Dance with me, and tell me what you saw."),
      seg("Ilvar Thorne", "She is with me tonight."),
    ],
    choices: [],
  },
];

/** Date Night: three scenes, one scored choice each. */
const DATE_BEATS: Json[] = [0, 1, 2].map((i) => ({
  places: [{ name: "The Moonlit Aquarium", tags: "blue glass, jellyfish" }],
  segments: [
    seg("", `Scene ${i + 1}: the tanks glow blue around you.`, { place: "The Moonlit Aquarium" }),
    seg("Ilvar Thorne", i === 2 ? "I would come here again. With you." : "The jellyfish drift like slow clocks."),
  ],
  choices: [
    {
      id: "choice-1",
      kind: "small",
      at: 1,
      options: [
        {
          id: "option-1",
          text: `Take his hand (${i + 1})`,
          selection: { kind: "action", text: "You reach for his hand." },
          segments: [seg("Ilvar Thorne", "…Fine. Just this once.")],
        },
        {
          id: "option-2",
          text: `Tease him (${i + 1})`,
          selection: { kind: "dialogue", text: "Afraid of a fish?" },
          segments: [seg("Ilvar Thorne", "Hardly.")],
        },
      ],
    },
  ],
}));

const READ_ROUNDS = [1, 0, 2, 1, 0].map((trueIndex, round) => ({
  context: `Moment ${round + 1}: Ilvar Thorne waits by the frozen canal lock.`,
  line: "You’re late. The clocks don’t wait.",
  face: "",
  readings: [0, 1, 2].map((option) =>
    option === trueIndex ? `Glad you came (${round + 1})` : `Decoy ${option} (${round + 1})`,
  ),
  trueIndex,
  thought: `I counted the bells until you came (${round + 1}).`,
  tell: round === 0 ? "Winds a pocket watch" : null,
}));

const CLAW_LINES = {
  cheer: ["Left a touch. Trust your hands."],
  cheat: ["Oops. My elbow. Into the machine."],
  win: ["Ha. Ours."],
  miss: ["The claw is rigged."],
  plush: ["Another friend for the shelf."],
};

function item(id: string, kind: string, rarity: number, li: string | null, title: string, extra: Json = {}): Json {
  return {
    id,
    kind,
    rarity,
    banner: id.replace(/-(?:f|a\d|s\d)$/u, ""),
    li,
    title,
    owned: false,
    art: null,
    story: null,
    ...extra,
  };
}

function memoriesBanner(): Json {
  const key = "memories-1";
  return {
    key,
    kind: "memories",
    rotation: 1,
    startsDay: "2026-10-28",
    endsDay: "2026-11-10",
    featuredLi: ILVAR,
    title: "Clockwork Hearts",
    echo: false,
    five: item(`${key}-f`, "memory5", 5, ILVAR, "The Hour He Stopped", {
      premise: "The great clock stops at midnight and only one of you knows why.",
    }),
    four: [1, 2, 3].map((n) => item(`${key}-a${n}`, "moment4", 4, n === 2 ? ROS : ILVAR, `A Moment ${n}`)),
    three: [1, 2, 3, 4, 5, 6].map((n) => item(`${key}-s${n}`, "snapshot3", 3, n % 2 ? ILVAR : ROS, `Snapshot ${n}`)),
    art: null,
  };
}

const PITY = {
  memories: { fiveIn: 37, fourIn: 4 },
  "his-wardrobe": { fiveIn: 60, fourIn: 10 },
  "my-wardrobe": { fiveIn: 60, fourIn: 10 },
};

/** A bible as the server keeps it (C/shared/api-types.ts Bible), for the bible view behind its spoiler wall. */
function bible(name: string, pronouns: Json): Json {
  return {
    age: 27,
    pronouns,
    birthday: "03-14",
    role: "Clockmaker to the canal guild",
    publicFace: `${name} is precise, cool and hard to impress.`,
    archetype: "the-cold-genius",
    subversion: "Keeps every broken clock anyone gives them.",
    wound: "A brother lost to the flood locks.",
    ghost: "The night the great clock stopped.",
    lie: "Caring is a fault in the mechanism.",
    want: "To find who stopped the clocks.",
    need: "To let someone in.",
    fear: "Being needed and failing again.",
    mask: { presents: "Detached", tells: ["Straightens cuffs", "Counts under breath", "Looks at clocks"] },
    trueSelf: { is: "Tender and frightened", showsWhen: ["She is hurt"] },
    flaws: ["Proud"],
    virtues: ["Loyal"],
    contradictions: ["Hates crowds, goes to every ball"],
    moralCode: "Never break a promise.",
    redLines: ["Never harm her"],
    darkness: { kinds: [] },
    voice: {
      register: "clipped",
      tics: ["Hm."],
      never: ["Swears"],
      careLanguage: "fixes things",
      angerStyle: "goes quiet",
      jealousyStyle: "precise questions",
      samples: { guarded: "Noted.", tender: "Stay.", angry: "Enough." },
    },
    likes: ["Tea"],
    dislikes: ["Rain"],
    web: {},
    secrets: [
      { id: "secret-1", truth: "Built the clock that stopped.", tells: ["Avoids the tower"], revealAt: { stage: 4 } },
      { id: "secret-2", truth: "Saw the murder too.", tells: ["Flinches at masks"], revealAt: { stage: 3 } },
    ],
    arc: { "1": { seed: "Distance" }, "2": {}, "3": {}, "4": {}, "5": {}, "6": { wantsFromHer: "Stay" } },
    look: { identityLine: "tall, dark hair", outfitLine: "grey coat", presentation: "person" },
    play: { style: "Plays to an audience.", cheat: "nudge" },
  };
}

/**
 * One world, answered in memory by the server's rules: the setup and forge routes (M1), the story and reader (M2a),
 * Home and the phone (M3), Wish, the Wardrobe and the Album (M4), the games (M5), and the calendar and care note (M6).
 * Starlight moves as the server moves it, so each screen shows what the one before earned or spent.
 */
function createLoopStub({ seeded = false } = {}) {
  const calls: Call[] = [];
  const index: Json = { version: 1, runs: [], activeRun: null, ageGate: null, lastOpenedAt: null };
  let view: Json | null = null;
  const chapters = new Map<string, Json>();
  const beats = new Map<string, Json>();
  const progress = new Map<string, { read: number; done: boolean }>();
  const affection: Record<string, number> = { [ILVAR]: 0, [ROS]: 0 };
  const timeline: Json[] = [];
  let note: Json | null = null;
  let wish = false;
  let herWorn = "base";
  let dateDone = false;
  const picks: Array<number | undefined> = [];
  const plush: Record<string, number> = {};
  const earned = { starlight: 0, affection: {} as Record<string, number> };
  const messages: Json[] = [];

  const lis = () => view!.lis as Json[];
  const gain = (li: string, points: number) => {
    affection[li] = (affection[li] ?? 0) + points;
    const entry = lis().find((each) => each.id === li)!;
    entry.level = Math.min(10, 1 + Math.floor(affection[li]! / 300));
  };

  const chapterView = (key: string) => {
    const chapter = chapters.get(key)!;
    const state = progress.get(key)!;
    return {
      chapter,
      beats: chapter.nodes.map(({ i }: Json) => ({
        i,
        state: i < state.read ? "read" : beats.has(`${key}:${i}`) ? "ready" : "unwritten",
      })),
    };
  };

  /** What reading a beat to its end earns, once: 30 a beat; the chapter's end pays its Lead and Foil. */
  const finishBeat = (key: string, i: number) => {
    const state = progress.get(key)!;
    const chapter = chapters.get(key)!;
    if (i !== state.read || state.done) return { grants: [], starlight: view!.starlight, chapterDone: state.done };
    state.read += 1;
    const grants: Json[] = [];
    // A main or prologue beat pays 30 (rewards.ts PAYS_BEATS); a date's beats are paid with the date.
    if (chapter.kind === "main" || chapter.kind === "prologue") {
      grants.push({ source: "beat", starlight: 30 });
      view!.starlight += 30;
    }
    if (state.read === chapter.nodes.length) {
      state.done = true;
      if (chapter.kind === "prologue") view!.prologue = true;
      else if (chapter.kind === "main") {
        grants.push(
          { source: "chapter", starlight: 160 },
          { source: "lead", li: chapter.lead, affection: 150 },
          { source: "foil", li: chapter.foil, affection: 60 },
        );
        view!.starlight += 160;
        gain(chapter.lead, 150);
        gain(chapter.foil, 60);
        timeline.push({
          at: now(),
          li: chapter.lead,
          kind: "first-meeting",
          text: "The night Ilvar first said your name.",
        });
      } else if (chapter.kind === "date") dateDone = true;
    }
    return { grants, starlight: view!.starlight, chapterDone: state.done };
  };

  const readyView = (setup: Json): Json => ({
    runKey: RUN,
    world: {
      version: 1,
      title: "The Clockwork Masquerade",
      premise: setup.premise,
      language: setup.language,
      createdAt: now(),
      setting: "",
      mystery: { question: "Who killed the duke?" },
      web: [],
      openingSituation: "",
      content: setup.content,
      images: { ...setup.images, connectionId: null },
      connections: setup.connections,
      forge: { phase: "forging", steps: [] },
      audio: {
        tts: false,
        otherVoices: false,
        combatVoices: false,
        generate: false,
        homeMusic: "",
        audioConnectionId: "",
        muted: false,
        musicVolume: 0.5,
        dialogueVolume: 1,
        sfxVolume: 0.5,
        autoplayPauseSeconds: 3,
        tracks: [],
      },
      places: {},
    },
    player: {
      personaId: setup.protagonist.personaId,
      name: "Mira Vale",
      pronouns: setup.protagonist.pronouns,
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
      outfits: [],
    },
    lis: setup.lis.map((li: Json, i: number) => ({
      id: i === 0 ? ILVAR : ROS,
      name: li.cardId === "card-ilvar" ? "Ilvar Thorne" : "Rosalind Vey",
      pronouns: li.pronouns,
      source: "card",
      cardId: li.cardId,
      voiceGender: "",
      accent: i === 0 ? "#9DB8F0" : "#E7A6B8",
      level: 1,
      stage: 1,
    })),
    forge: {
      phase: "forging",
      steps: [
        { id: "world-plan", state: "pending" },
        ...[ILVAR, ROS].map((li) => ({ id: `bible:${li}`, state: "pending" })),
      ],
    },
    starlight: 2000,
  });

  /** Each read of the run while it forges finishes one step and starts the next. */
  const advanceForge = () => {
    const forge = view!.forge;
    if (forge.phase === "ready") return;
    const running = forge.steps.find((step: Json) => step.state === "running");
    if (running) running.state = "done";
    const next = forge.steps.find((step: Json) => step.state === "pending");
    if (next) next.state = "running";
    if (forge.steps.every((step: Json) => step.state === "done")) forge.phase = "ready";
    view!.world.forge = forge;
  };

  const homeLines = () => {
    const pool = (lines: string[]) => ({ morning: lines, day: lines, night: lines });
    return {
      ready: true,
      stage: 1,
      rupture: false,
      tap: {
        head: pool(["Careful with the hair."]),
        hand: pool(["Cold hands. Stay a moment."]),
        heart: pool(["That is my heart."]),
      },
      annoyed: ["Enough. I mean it."],
      cold: ["Not now."],
      comfort: ["Sit. Tea first, then everything else."],
      claw: CLAW_LINES,
    };
  };

  const historyPage = (li: string) => ({
    messages: li === ILVAR ? messages : [],
    page: 1,
    pages: 1,
    from: 0,
    past: 0,
    activeCount: li === ILVAR ? messages.length : 0,
    busy: false,
    retry: false,
    sessions: [],
    suggestions: [],
    seenAt: null,
  });

  const wardrobe = () => ({
    him: {
      [ILVAR]: [{ id: "base", owner: ILVAR, name: "", art: null, worn: true, wearable: true, unopened: false }],
      [ROS]: [{ id: "base", owner: ROS, name: "", art: null, worn: true, wearable: true, unopened: false }],
    },
    me: [
      { id: "base", owner: "me", name: "", art: null, worn: herWorn === "base", wearable: true, unopened: false },
      {
        id: "my-wardrobe-0-f",
        owner: "me",
        name: "Starlit Gown",
        art: null,
        worn: herWorn === "my-wardrobe-0-f",
        wearable: true,
        unopened: false,
        item: { kind: "her-look5", rarity: 5, title: "Starlit Gown" },
        shownTo: [],
      },
    ],
    couples: [],
    noticed: null,
    noticing: false,
  });

  const answer = (call: Call): { status: number; json: unknown } => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index") return { status: 200, json: { index } };
    if (path === "/index/opened") return { status: 200, json: { index: { ...index, lastOpenedAt: now() } } };
    if (path === "/premise/suggest") return { status: 200, json: { premise: PREMISE } };
    if (path === "/runs" && call.method === "POST") {
      view = readyView(call.body!.setup);
      index.runs.push({ runKey: RUN, title: view.world.title, createdAt: now(), lastPlayedAt: null });
      return { status: 200, json: { run: RUN, view: structuredClone(view) } };
    }
    if (!view) return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
    if (path === base) {
      advanceForge();
      return { status: 200, json: { view: structuredClone(view) } };
    }
    if (path === `${base}/activate`) {
      index.activeRun = RUN;
      return { status: 200, json: { index } };
    }

    // ── Story and reader ──
    if (path === `${base}/prologue`) {
      if (!chapters.has("prologue")) {
        chapters.set("prologue", {
          key: "prologue",
          kind: "prologue",
          lead: "",
          title: view.world.title,
          tags: [],
          summary: "",
          nodes: [{ i: 0, kind: "beat" }],
          plannedAt: now(),
        });
        progress.set("prologue", { read: 0, done: false });
      }
      return { status: 200, json: { chapter: chapters.get("prologue") } };
    }
    if (path === `${base}/story`) {
      const main = chapters.get("main-1");
      const done = !!main && progress.get("main-1")!.done;
      return {
        status: 200,
        json: {
          chapters: main
            ? [
                {
                  key: "main-1",
                  kind: "main",
                  title: main.title,
                  lead: main.lead,
                  state: done ? "done" : "in-progress",
                  beatsRead: progress.get("main-1")!.read,
                  nodes: main.nodes.length,
                },
              ]
            : [],
          next:
            main && !done
              ? null
              : {
                  kind: "main",
                  number: main ? 2 : 1,
                  candidates: [
                    { li: ROS, reason: "least-recent" },
                    { li: ILVAR, reason: "ripe-conflict" },
                  ],
                },
          routes: [],
          repairs: [],
        },
      };
    }
    if (path === `${base}/chapters/next`) {
      const lead = call.body!.lead;
      chapters.set("main-1", {
        key: "main-1",
        kind: "main",
        number: 1,
        lead,
        foil: lead === ILVAR ? ROS : ILVAR,
        title: "The Masked Ball",
        tags: [],
        summary: "A murder at the ball, and two people who saw it.",
        nodes: MAIN_BEATS.map((_, i) => ({ i, kind: "beat" })),
        plannedAt: now(),
      });
      progress.set("main-1", { read: 0, done: false });
      return { status: 200, json: { chapter: chapters.get("main-1") } };
    }
    const chapterMatch = /^\/runs\/[^/]+\/chapters\/([a-z0-9-]+)$/u.exec(path);
    if (chapterMatch && chapters.has(chapterMatch[1]!)) return { status: 200, json: chapterView(chapterMatch[1]!) };
    const beatMatch = /^\/runs\/[^/]+\/chapters\/([a-z0-9-]+)\/beats\/(\d+)(?:\/(choose|read))?$/u.exec(path);
    if (beatMatch && chapters.has(beatMatch[1]!)) {
      const [key, i, action] = [beatMatch[1]!, Number(beatMatch[2]), beatMatch[3]];
      const id = `${key}:${i}`;
      if (!action) {
        if (!beats.has(id)) {
          const source = key === "prologue" ? PROLOGUE_BEAT : (key === "main-1" ? MAIN_BEATS : DATE_BEATS)[i]!;
          beats.set(id, {
            key,
            i,
            kind: "beat",
            ...structuredClone(source),
            choiceCanon: {},
            musicMood: key === "main-1" ? "tense" : "date",
            readThrough: 0,
            written,
            rewrites: 0,
          });
        }
        return { status: 200, json: { beat: beats.get(id) } };
      }
      const beat = beats.get(id)!;
      if (action === "choose") {
        const first = !beat.choiceCanon[call.body!.choice];
        beat.choiceCanon[call.body!.choice] ??= call.body!.option;
        const remembered = first && key === "main-1";
        return { status: 200, json: { beat, remembered, rememberedBy: remembered ? [ILVAR] : [] } };
      }
      const end = beat.segments.length - 1;
      const reached = Math.min(end, call.body!.segment);
      beat.readThrough = Math.max(beat.readThrough, reached);
      const settled = beat.choices.every((choice: Json) => choice.at > end || beat.choiceCanon[choice.id]);
      if (reached < end || !settled) {
        return { status: 200, json: { grants: [], starlight: view.starlight, chapterDone: false } };
      }
      return { status: 200, json: finishBeat(key, i) };
    }
    if (path === `${base}/cancel`) return { status: 200, json: { ok: true } };
    const bibleMatch = /^\/runs\/[^/]+\/lis\/([^/]+)\/bible$/u.exec(path);
    if (bibleMatch) {
      const li = lis().find((entry) => entry.id === bibleMatch[1])!;
      return { status: 200, json: { bible: bible(li.name, li.pronouns) } };
    }
    if (path === `${base}/memory/status`) {
      return { status: 200, json: { status: { phase: "ready", retryable: false, recordCount: 3 } } };
    }
    if (path === `${base}/favorites`) return { status: 200, json: { favorites: [] } };

    // ── Home and the phone ──
    if (path === `${base}/home`) {
      return {
        status: 200,
        json: {
          li: ILVAR,
          show: "him",
          note,
          look: null,
          faces: {},
          lines: { ready: true },
          rupture: false,
          unread: 0,
          backdrop: null,
          noticed: null,
          noticing: false,
        },
      };
    }
    if (path === `${base}/home/set`) return { status: 200, json: { home: { li: ILVAR, show: "him" } } };
    if (path === `${base}/home/note`) {
      note ??= {
        li: call.body!.li,
        dayKey: now().slice(0, 10),
        text: NOTE,
        face: "tender",
        mood: { word: "restless", reason: "the clocks" },
        curt: false,
        at: now(),
      };
      return { status: 200, json: { note } };
    }
    if (/^\/runs\/[^/]+\/lis\/[^/]+\/lines$/u.test(path)) return { status: 200, json: homeLines() };
    if (path === `${base}/phone`) {
      return {
        status: 200,
        json: {
          threads: [
            { li: ILVAR, last: messages.at(-1) ?? null, unread: 0, busy: false },
            { li: ROS, last: null, unread: 0, busy: false },
          ],
        },
      };
    }
    const phone = /^\/runs\/[^/]+\/phone\/([^/]+)(?:\/(seen|send|close))?$/u.exec(path);
    if (phone) {
      const [li, action] = [phone[1]!, phone[2]];
      if (!action) return { status: 200, json: historyPage(li) };
      if (action === "seen") return { status: 200, json: {} };
      if (action === "send") {
        const { text = "", quote, id } = call.body!;
        const mine = { id, who: "player", text, at: now(), ...(quote ? { quote } : {}) };
        const his = { id: `m-r${messages.length}`, who: "li", text: REPLY, at: now() };
        messages.push(mine, his);
        return { status: 200, json: { messages: [mine, his], suggestions: [] } };
      }
    }

    // ── Wish, the Wardrobe and the Album ──
    if (path === `${base}/wish` && call.method === "GET") {
      const banner = memoriesBanner();
      if (wish) banner.five.owned = true;
      return {
        status: 200,
        json: {
          starlight: view.starlight,
          banners: [banner],
          echoes: [],
          pity: wish ? { ...PITY, memories: { fiveIn: 60, fourIn: 10 } } : PITY,
          creating: false,
          missing: [],
          rotation: { number: 1, startsDay: "2026-10-28", endsDay: "2026-11-10" },
          selectors: [],
        },
      };
    }
    if (path === `${base}/wish/pull`) {
      if (!wish) {
        wish = true;
        view.starlight -= 100;
      }
      return {
        status: 200,
        json: {
          results: [{ item: { ...memoriesBanner().five, owned: true }, rarity: 5, isNew: true, refund: 0 }],
          starlight: view.starlight,
          pity: { ...PITY, memories: { fiveIn: 60, fourIn: 10 } },
        },
      };
    }
    if (path === `${base}/wardrobe`) return { status: 200, json: wardrobe() };
    if (path === `${base}/wardrobe/wear`) {
      herWorn = String(call.body!.look);
      return { status: 200, json: { wardrobe: wardrobe() } };
    }
    if (path === `${base}/album`) {
      return {
        status: 200,
        json: {
          cgs: [],
          memories: wish
            ? [{ ...memoriesBanner().five, owned: true, story: { key: "story-memories-1-f" }, read: "unread" }]
            : [],
          timeline,
          favorites: [],
          soundtrack: [{ cue: "home", track: null }],
          tells: { [ILVAR]: picks.length ? ["Winds a pocket watch"] : [], [ROS]: [] },
        },
      };
    }

    // ── The games ──
    if (path === `${base}/play`) {
      return {
        status: 200,
        json: {
          dayKey: now().slice(0, 10),
          starlight: { earned: earned.starlight, cap: 400 },
          affection: { earned: { ...earned.affection }, cap: 300 },
          plush: { ...plush },
          lis: Object.fromEntries(
            [ILVAR, ROS].map((li) => [
              li,
              {
                cheat: li === ILVAR ? "nudge" : "calculate",
                style: li === ILVAR ? "Plays to an audience, all flourish and a wink." : "Calculates the angle aloud.",
                rupture: false,
                makeItRight: false,
                lines: { claw: li === ILVAR ? CLAW_LINES : null, cold: [] },
              },
            ]),
          ),
        },
      };
    }
    const pay = (source: string, li: string, starlight: number, points: number) => {
      view!.starlight += starlight;
      earned.starlight += starlight;
      earned.affection[li] = (earned.affection[li] ?? 0) + points;
      gain(li, points);
      return [
        { source, starlight },
        { source, li, affection: points },
      ];
    };
    if (path === `${base}/read-him`) {
      const rounds = READ_ROUNDS.map(({ context, line, face, readings }) => ({ context, line, face, readings }));
      return { status: 200, json: { setId: READ_SET, li: call.body!.li, rounds, grants: null } };
    }
    if (path === `${base}/read-him/${READ_SET}/answer`) {
      const { round, pick } = call.body as { round: number; pick: number };
      picks[round] ??= pick;
      const truth = READ_ROUNDS[round]!;
      const correct = picks[round] === truth.trueIndex;
      return {
        status: 200,
        json: {
          pick: picks[round],
          correct,
          trueIndex: truth.trueIndex,
          thought: truth.thought,
          ...(correct && truth.tell ? { tellLearned: truth.tell } : {}),
        },
      };
    }
    if (path === `${base}/read-him/${READ_SET}/finish`) {
      return { status: 200, json: { grants: pay("read-him", ILVAR, 40, 40), starlight: view.starlight } };
    }
    const dateEntry = (state: string, outcome: string | null = null) => ({
      key: "date-1",
      li: ILVAR,
      title: "An Evening at the Aquarium",
      place: "aquarium",
      placeName: "The Moonlit Aquarium",
      makeItRight: false,
      state,
      outcome,
      plannedAt: now(),
      completedAt: state === "reading" ? null : now(),
      keepsake: null,
    });
    if (path === `${base}/dates` && call.method === "GET") {
      const open = chapters.has("date-1") && !progress.get("date-1")!.done ? dateEntry("reading") : null;
      return {
        status: 200,
        json: {
          lis: [ILVAR, ROS].map((li) => ({ li, rupture: false, open: li === ILVAR ? open : null })),
          dates: dateDone ? [dateEntry("finished", "great")] : [],
        },
      };
    }
    if (path === `${base}/dates`) {
      chapters.set("date-1", {
        key: "date-1",
        kind: "date",
        lead: ILVAR,
        title: "An Evening at the Aquarium",
        tags: [],
        summary: "Blue light and slow jellyfish.",
        nodes: DATE_BEATS.map((_, i) => ({ i, kind: "beat" })),
        plannedAt: now(),
      });
      progress.set("date-1", { read: 0, done: false });
      return { status: 200, json: { date: dateEntry("reading"), resumed: false } };
    }
    if (path === `${base}/dates/date-1/finish`) {
      return {
        status: 200,
        json: {
          date: dateEntry("finished", "great"),
          outcome: "great",
          picks: DATE_BEATS.map((_, i) => ({ text: `Take his hand (${i + 1})`, score: 1 })),
          line: "I would come here again. With you.",
          grants: pay("date", ILVAR, 120, 100),
          starlight: view.starlight,
          counted: true,
          repaired: false,
          mends: false,
          keepsake: { offer: false },
        },
      };
    }
    if (path === `${base}/claw/finish`) {
      const body = call.body!;
      const newPlush: string[] = [];
      for (const { prize } of body.caught) {
        if (!plush[prize]) newPlush.push(prize);
        plush[prize] = (plush[prize] ?? 0) + 1;
      }
      const grants = pay("claw", body.li, 20 + 30 * body.caught.length, 30);
      return {
        status: 200,
        json: {
          grants,
          newPlush,
          firstPlush: newPlush.includes(`li:${body.li}`),
          capped: false,
          replay: false,
          plush: { ...plush },
          starlight: view.starlight,
        },
      };
    }

    // ── Remind Me ──
    if (path === `${base}/calendar`) {
      const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(5, 10);
      return {
        status: 200,
        json: {
          birthdays: [
            { li: ILVAR, md: day(3) },
            { li: ROS, md: day(9) },
          ],
          anniversaries: [{ md: day(0), label: "The Clockwork Masquerade", year: new Date().getFullYear() }],
          bannerEnds: [],
        },
      };
    }
    if (path === `${base}/care-note`) return { status: 200, json: { note: CARE_NOTE, source: "model" } };
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  // A world already forged, for the screens around the loop.
  if (seeded) {
    view = readyView({
      premise: PREMISE,
      language: "English",
      protagonist: { personaId: "persona-mira", pronouns: SHE },
      lis: [
        { source: "card", cardId: "card-ilvar", pronouns: HE },
        { source: "card", cardId: "card-rosalind", pronouns: SHE },
      ],
      content: { heat: "sfw", darkness: "angst", limits: {}, custom: [] },
      images: { connectionId: null, rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
    });
    for (const step of view.forge.steps) step.state = "done";
    view.forge.phase = "ready";
    view.world.forge = view.forge;
    index.runs.push({ runKey: RUN, title: view.world.title, createdAt: now(), lastPlayedAt: now() });
    index.activeRun = RUN;
  }
  return { calls, answer };
}

type Stub = ReturnType<typeof createLoopStub>;

async function stubEngine(page: Page, stub: Stub) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  // Text only: one story connection, the Engine's default.
  await page.route("**/api/connections", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: [{ id: "conn-text", name: "Story fixture", provider: "custom", model: "fixture", isDefault: "true" }],
        })
      : route.continue(),
  );
  await page.route("**/api/characters/personas/list**", (route) =>
    route.fulfill({ json: [{ id: "persona-mira", name: "Mira Vale", avatarPath: null }] }),
  );
  await page.route("**/api/characters/catalog**", (route) =>
    route.fulfill({
      json: {
        items: [
          { id: "card-ilvar", name: "Ilvar Thorne", avatarPath: null },
          { id: "card-rosalind", name: "Rosalind Vey", avatarPath: null },
        ],
        hasMore: false,
      },
    }),
  );
  // Sounds come through the Engine's player from its game-assets library: none here.
  await page.route("**/api/game-assets/**", (route) => route.fulfill({ json: { assets: {} } }));
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { status, json } = stub.answer({
      method: request.method(),
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: request.method() === "POST" ? request.postDataJSON() : undefined,
    });
    await route.fulfill({ status, json });
  });
}

async function openOtome(page: Page): Promise<Locator> {
  // Engine's calendar greeting can appear after startup. Keep its theme through the normal, specific dialog action.
  await page.addLocatorHandler(
    page
      .getByRole("dialog", { name: "Happy Halloween!", exact: true })
      .filter({ has: page.getByRole("button", { name: "Keep it", exact: true }) }),
    async (dialog) => {
      await dialog.getByRole("button", { name: "Keep it", exact: true }).click();
    },
  );
  await page.addInitScript((version) => {
    localStorage.setItem("marinara:whats-new:seen-version", version);
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, appAccentPulseMode: false },
        version: 65,
      }),
    );
  }, appVersion);
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Otome Hearth" }).click();
  const root = page.locator("marinara-capability-otome-forge .of-root");
  await expect(root).toBeVisible({ timeout: 60_000 });
  return root;
}

// ── §1.12: keyboard, focus, motion ──

interface KeyboardAudit {
  /** Controls a pointer can use that Tab never reached (a radio group or roving widget counts once, by any member). */
  unreached: string[];
  /** Controls that took focus without a visible ring (outline, focus-coloured border or shadow, or a ringed parent). */
  unringed: string[];
  /** Elements that look clickable (cursor: pointer) but are no control and sit in none. */
  pointerOnly: string[];
  /** Where Tab went, for a failure's message. */
  walk: string[];
}

/**
 * Tabs forward, then backward, from `start` (the screen's heading by default) until focus leaves Otome Hearth or comes
 * round again, and checks what it met against every visible control on the stage.
 */
async function keyboardAudit(page: Page, root: Locator, start: Locator): Promise<KeyboardAudit> {
  const controls: Array<{ id: string; group: string; label: string }> = await root.evaluate((element) => {
    const SELECTOR = [
      "button",
      "a[href]",
      "input:not([type=hidden])",
      "select",
      "textarea",
      "summary",
      "[tabindex]",
      '[role="button"]',
      '[role="tab"]',
      '[role="radio"]',
      '[role="switch"]',
      '[role="checkbox"]',
      '[role="slider"]',
      '[role="gridcell"]',
      '[role="option"]',
      '[role="menuitem"]',
    ].join(", ");
    // checkVisibility, not client rects alone: a closed <details> keeps its content laid out but hidden.
    const shown = (node: Element) =>
      !node.closest("[inert], [aria-hidden='true']") && node.checkVisibility({ visibilityProperty: true });
    const label = (node: Element) =>
      `${node.tagName.toLowerCase()}${node.getAttribute("role") ? `[role=${node.getAttribute("role")}]` : ""}${
        node instanceof HTMLInputElement ? `[${node.type}]` : ""
      } “${(
        node.getAttribute("aria-label") ??
        (node instanceof HTMLInputElement ? (node.labels?.[0]?.textContent ?? node.value) : node.textContent) ??
        ""
      )
        .trim()
        .replace(/\s+/gu, " ")
        .slice(0, 48)}” .${String((node as HTMLElement).className?.toString?.() ?? "").split(" ")[0]}`;
    const groups = new Map<Element, number>();
    const result: Array<{ id: string; group: string; label: string }> = [];
    let n = 0;
    for (const node of element.querySelectorAll(SELECTOR)) {
      // :disabled, not .disabled: a control in a disabled fieldset is disabled without its own attribute.
      if (node.matches(":disabled") || !shown(node)) continue;
      const tabindex = node.getAttribute("tabindex");
      const roving = node.closest(
        '[role="tablist"], [role="grid"], [role="radiogroup"], [role="listbox"], [role="menu"]',
      );
      // A heading or panel given tabindex -1 takes focus only from code; a control so marked must be in a roving
      // widget.
      if (tabindex === "-1" && !roving && !node.matches("button, a[href], input, select, textarea, [role]")) continue;
      if (tabindex === "-1" && node.matches('[role="tabpanel"], [role="dialog"], [role="img"], [role="region"]'))
        continue;
      const id = `kb-${n++}`;
      node.setAttribute("data-kb", id);
      let group = id;
      if (node instanceof HTMLInputElement && node.type === "radio") group = `radio:${node.name}`;
      else if (roving && tabindex === "-1") {
        if (!groups.has(roving)) groups.set(roving, groups.size);
        group = `roving:${groups.get(roving)}`;
      } else if (roving && node.closest('[role="tablist"], [role="grid"]')) {
        if (!groups.has(roving)) groups.set(roving, groups.size);
        group = `roving:${groups.get(roving)}`;
      }
      result.push({ id, group, label: label(node) });
    }
    return result;
  });

  const met = new Map<string, boolean>();
  const walk: string[] = [];
  const unringedLabels = new Set<string>();
  // Where the walk starts counts as reached (its ring is checked when Tab comes back round to it, if it does).
  const startId = await start.getAttribute("data-kb");
  if (startId) met.set(startId, true);
  for (const key of ["Tab", "Shift+Tab"]) {
    await start.focus();
    let first: string | null = null;
    for (let press = 0; press < 160; press += 1) {
      await page.keyboard.press(key);
      const focus = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || !element.closest(".of-root")) return null;
        const rgb = (value: string) => {
          const hex = /^\s*#([0-9a-f]{6})\s*$/iu.exec(value);
          if (!hex) return value.trim();
          const n = Number.parseInt(hex[1]!, 16);
          return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
        };
        const ringed = (node: Element) => {
          const style = getComputedStyle(node);
          const focus = rgb(style.getPropertyValue("--of-focus"));
          const outline =
            style.outlineStyle !== "none" &&
            Number.parseFloat(style.outlineWidth) >= 1 &&
            !/rgba\([^)]*, 0\)|transparent/u.test(style.outlineColor);
          const border = style.borderTopColor === focus && Number.parseFloat(style.borderTopWidth) >= 1;
          return outline || border || style.boxShadow.includes(focus);
        };
        let visible = false;
        let opacity = 1;
        for (let node: Element | null = element, depth = 0; node && depth < 5; node = node.parentElement, depth += 1) {
          if (ringed(node)) visible = true;
        }
        for (let node: Element | null = element; node && !node.matches(".of-root"); node = node.parentElement) {
          opacity *= Number(getComputedStyle(node).opacity);
        }
        // A range input rings its thumb (styles.ts `.of-range:focus-visible::-webkit-slider-thumb`).
        if (element.matches("input[type=range].of-range")) visible = true;
        return {
          id: element.getAttribute("data-kb") ?? `untracked ${element.tagName.toLowerCase()}.${element.className}`,
          visible: visible && opacity > 0.2,
        };
      });
      walk.push(focus ? `${key}→${focus.id}${focus.visible ? "" : " (no ring)"}` : `${key}→out`);
      if (!focus) break;
      if (focus.id === first) break;
      first ??= focus.id;
      met.set(focus.id, (met.get(focus.id) ?? true) && focus.visible);
      // A focus stop that is no control (a scroller the browser makes focusable) still needs its ring.
      if (focus.id.startsWith("untracked") && !focus.visible) unringedLabels.add(focus.id);
    }
  }
  // Back where the walk began, so the screen's own keys work as they did before it.
  await start.focus();
  const reachedGroups = new Set(controls.filter((control) => met.has(control.id)).map((control) => control.group));
  for (const control of controls) {
    if (met.get(control.id) === false) unringedLabels.add(control.label);
  }
  const pointerOnly: string[] = await root.evaluate((element) => {
    // A control, or a label for one; any other role (a dialog, a list, a region) is no excuse.
    const CONTROL = [
      "button",
      "a[href]",
      "input",
      "select",
      "textarea",
      "summary",
      "label",
      '[tabindex]:not([tabindex="-1"])',
      ...["button", "link", "tab", "radio", "switch", "checkbox", "slider", "gridcell", "option", "menuitem"].map(
        (role) => `[role="${role}"]`,
      ),
    ].join(", ");
    return [...element.querySelectorAll<HTMLElement>("*")]
      .filter((node) => {
        if (node.closest("[inert], [aria-hidden='true']") || !node.checkVisibility({ visibilityProperty: true })) {
          return false;
        }
        if (getComputedStyle(node).cursor !== "pointer") return false;
        if (node.closest(CONTROL)) return false;
        // Inherited from a control's own child: only the outermost pointer element counts.
        return !(node.parentElement && getComputedStyle(node.parentElement).cursor === "pointer");
      })
      .map((node) => `${node.tagName.toLowerCase()}.${node.className}`);
  });
  return {
    unreached: controls.filter((control) => !reachedGroups.has(control.group)).map((control) => control.label),
    unringed: [...unringedLabels],
    pointerOnly,
    walk: [...walk, ...controls.map((control) => `${control.id}=${control.label} [${control.group}]`)],
  };
}

/** Nothing on the stage animates (CSS animations, transitions and the Web Animations API alike). */
async function expectStill(root: Locator, where: string) {
  const running = await root.evaluate((element) =>
    element
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === "running")
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
        const kind =
          (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty ?? "script";
        return `${kind} on ${target?.tagName.toLowerCase()}.${target?.className}`;
      }),
  );
  expect(running, `${where}: animations at reduced motion`).toEqual([]);
}

/** The screen's own checks: every control reached and ringed, nothing pointer-only, nothing moving. */
async function auditScreen(page: Page, root: Locator, where: string, start?: Locator) {
  await expectStill(root, where);
  const heading = start ?? root.locator("h1").first();
  const { walk, ...audit } = await keyboardAudit(page, root, heading);
  expect(audit, `${where}: keyboard and focus\n${walk.join("\n")}`).toEqual({
    unreached: [],
    unringed: [],
    pointerOnly: [],
  });
}

/** Tab and Shift+Tab stay inside an open dialog, round and round. */
async function expectTrapped(page: Page, dialog: Locator) {
  const count = await dialog.evaluate(
    (element) =>
      [
        ...element.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => node.getClientRects().length).length,
  );
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let press = 0; press < count + 2; press += 1) {
      await page.keyboard.press(key);
      expect(await dialog.evaluate((element) => element.contains(document.activeElement)), `${key} stays in`).toBe(
        true,
      );
    }
  }
}

// A step that cannot find its control fails within the step, not at the whole walk's timeout.
test.use({ actionTimeout: 15_000 });

const posts = (stub: Stub, suffix: string) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));

/** Picks a radio drawn as a pill or card (the input itself is visually hidden). */
const pick = (scope: Locator, label: string | RegExp) =>
  scope.locator("label").filter({ hasText: label }).first().click();

/** Goes on once the line has typed itself out (at reduced motion it is whole at once). */
async function next(root: Locator) {
  const button = root.locator(".of-next");
  await expect(button).toHaveAttribute("data-done", "true");
  await button.click();
}

const line = (root: Locator) => root.locator(".of-dialogue .of-line");
const dock = (root: Locator, name: string) =>
  root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name, exact: true });
const starlight = (root: Locator) => root.locator(".of-topbar .of-starlight");
const amount = (value: number) => value.toLocaleString("en-US");

test("Otome Hearth's whole loop, by keyboard and pointer: setup, a chapter, Home, the phone, Wish, Wardrobe, Album, the games and Remind Me", async ({
  page,
}, testInfo) => {
  test.setTimeout(600_000);
  const mobile = testInfo.project.name.includes("mobile");
  if (!mobile) await page.setViewportSize({ width: 1280, height: 800 });
  // Midnight on the desktop, Pearl on the phone; reduced motion on both, so every screen can be checked for stillness.
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createLoopStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubEngine(page, stub);
  const root = await openOtome(page);
  await expect(root).toHaveAttribute("data-look", mobile ? "pearl" : "midnight");
  const shot = (name: string) => page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  const width = page.viewportSize()!.width;
  const noSideways = async () =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

  await test.step("setup: premise, persona, a cast of two genders, content and a text connection", async () => {
    await root.getByRole("button", { name: "Begin a new story" }).click();
    await expect(root.getByRole("heading", { name: "Where does it begin?" })).toBeVisible();
    await auditScreen(page, root, "setup: story");
    await root.getByRole("button", { name: "Surprise me" }).click();
    await expect(root.getByLabel("Premise")).toHaveValue(PREMISE);
    await root.getByRole("button", { name: "Next" }).click();

    await expect(root.getByRole("heading", { name: "Who are you here?" })).toBeFocused();
    await pick(root, "Mira Vale");
    await pick(root.getByRole("group", { name: "Your pronouns" }), "she/her");
    await auditScreen(page, root, "setup: you");
    await root.getByRole("button", { name: "Next" }).click();

    await expect(root.getByRole("heading", { name: "Who waits for you?" })).toBeVisible();
    await root.getByRole("button", { name: "Ilvar Thorne" }).click();
    await root.getByRole("button", { name: "Rosalind Vey" }).click();
    await pick(root.getByRole("group", { name: "Pronouns for Ilvar Thorne" }), "he/him");
    await pick(root.getByRole("group", { name: "Pronouns for Rosalind Vey" }), "she/her");
    await auditScreen(page, root, "setup: cast");
    await root.getByRole("button", { name: "Next" }).click();

    await expect(root.getByRole("heading", { name: "How tender, how dark?" })).toBeVisible();
    await auditScreen(page, root, "setup: content");
    await root.getByRole("button", { name: "Next" }).click();
    await expect(root.getByLabel("Story", { exact: true })).toHaveValue("conn-text");
    await auditScreen(page, root, "setup: connections");
    await root.getByRole("button", { name: "Next" }).click();
    await auditScreen(page, root, "setup: review");
    await shot("01-review");
    await root.getByRole("button", { name: "Forge our story" }).click();

    const created = posts(stub, "/runs")[0]!.body!.setup;
    expect(created).toMatchObject({
      premise: PREMISE,
      protagonist: { personaId: "persona-mira", pronouns: SHE },
      lis: [
        { source: "card", cardId: "card-ilvar", pronouns: HE },
        { source: "card", cardId: "card-rosalind", pronouns: SHE },
      ],
      connections: { narration: "conn-text" },
    });
    await expect(root.getByRole("heading", { name: "Your story is ready" })).toBeVisible({ timeout: 30_000 });
    // Without an image connection the cast stays as initials, and the ready world says so.
    await expect(root.getByText(/No image connection: your cast appears as initials/u)).toBeVisible();
    await auditScreen(page, root, "forge: ready");
    await expect(root.getByText(/Begin plays your prologue first/u)).toBeVisible();
    await root.getByRole("button", { name: "Begin" }).click();
    // Begin plays the prologue first, in the reader: her own evening, a choice about who she is, then Home.
    expect(posts(stub, "/prologue")).toHaveLength(1);
    await expect(line(root)).toContainText("The canal lamps hiss awake as you lock the workshop for the night.");
    await next(root);
    await expect(line(root)).toContainText("One more commission and the apprenticeship is mine.");
    const who = root.getByRole("group", { name: "What do you do?" });
    await expect(who).toBeVisible();
    await auditScreen(page, root, "prologue: a choice", root.locator(".of-reader"));
    await who.getByRole("button", { name: "Finish the gears tonight." }).click();
    await expect(line(root)).toContainText("You unlock the door again.");
    await next(root);
    await expect(line(root)).toContainText("The gears can't wait, and neither can you.");
    await next(root);
    await expect(root.getByRole("heading", { name: "Prologue complete" })).toBeFocused();
    await expect(root.getByText("+30 Starlight")).toBeVisible();
    await root.getByRole("button", { name: "Back to Home" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
  });

  await test.step("a main chapter: who leads, a choice he remembers, read to its end", async () => {
    await dock(root, "Story").click();
    await expect(root.getByRole("heading", { level: 1, name: "Story" })).toBeFocused();
    await auditScreen(page, root, "story");
    const opener = root.getByRole("button", { name: "Choose who leads" });
    await opener.click();
    const lead = page.getByRole("dialog", { name: "Who walks with you this chapter?" });
    await expect(lead).toContainText("You haven’t walked with Rosalind Vey in a while.");
    await expectTrapped(page, lead);
    await page.keyboard.press("Escape");
    await expect(lead).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await lead.getByRole("button", { name: /Ilvar Thorne/u }).click();
    expect(posts(stub, "/chapters/next")[0]!.body).toMatchObject({ lead: ILVAR });

    // Each new line goes to the reader's polite live region, said with its speaker.
    const live = root.locator('.of-reader > p.of-visually-hidden[aria-live="polite"]');
    await expect(line(root)).toContainText("The gears above the gallery tick past midnight.");
    await expect(live).toContainText("The gears above the gallery tick past midnight.");
    await expectStill(root, "reader");
    await next(root);
    await expect(live).toContainText("Ilvar Thorne");
    await expect(live).toContainText("You saw it too.");
    const choice = root.getByRole("group", { name: "What do you do?" });
    await expect(choice).toBeVisible();
    await auditScreen(page, root, "reader: a choice", root.locator(".of-reader"));
    await choice.getByRole("button", { name: "Admit it." }).click();
    await expect(root.getByText("Ilvar Thorne will remember that.")).toBeVisible();
    await expect(line(root)).toContainText("I saw everything.");
    for (const text of ["Good. Lying never suited you.", "He knows.", "Then we find out who did it."]) {
      await next(root);
      await expect(line(root)).toContainText(text);
      await expect(live).toContainText(text);
    }
    await next(root);
    await expect(line(root)).toContainText("Music spills down the stairs.");
    await shot("02-reader");
    await next(root);
    await expect(live).toContainText("Rosalind Vey");
    await next(root);
    await expect(line(root)).toContainText("She is with me tonight.");
    await next(root);
    await expect(root.getByRole("heading", { name: "Chapter complete" })).toBeFocused();
    await expect(root.getByText("+160 Starlight")).toBeVisible();
    await expect(root.getByText("Ilvar Thorne · +150 affection")).toBeVisible();
    await auditScreen(page, root, "chapter end", root.getByRole("heading", { name: "Chapter complete" }));
    await root.getByRole("button", { name: "Back to the story" }).click();
    await expect(starlight(root)).toContainText(amount(2250));
  });

  await test.step("Home: his note, a tap by keyboard, Reply into his thread", async () => {
    await root.getByRole("button", { name: "Home with Ilvar Thorne" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
    const note = root.getByRole("article", { name: "A note from Ilvar Thorne" });
    await expect(note).toContainText(NOTE);
    expect(posts(stub, "/home/note")).toHaveLength(1);
    const head = root.getByRole("group", { name: "Touch Ilvar Thorne" }).getByRole("button", { name: "Head" });
    await head.focus();
    await page.keyboard.press("Enter");
    await expect(root.locator(".of-home-bubble")).toHaveText("Careful with the hair.");
    await expect(root.locator('.of-home > p[aria-live="polite"]')).toContainText(
      "Ilvar Thorne: Careful with the hair.",
    );
    await noSideways();
    await shot("03-home");
    await auditScreen(page, root, "home");

    await note.getByRole("button", { name: "Reply" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
    await expect(root.locator(".of-quote-chip")).toContainText(NOTE);
    await auditScreen(page, root, "phone: thread");
    await root.getByRole("textbox", { name: "Message Ilvar Thorne" }).fill("I left it on for you.");
    await page.keyboard.press("Enter");
    const log = root.getByRole("list", { name: "Messages with Ilvar Thorne" });
    await expect(log.getByText(REPLY)).toBeVisible();
    // His reply is said in the thread's polite live region.
    await expect(root.locator('.of-thread > p[aria-live="polite"]')).toContainText(REPLY);
    expect(posts(stub, "/send")[0]!.body).toMatchObject({ text: "I left it on for you.", quote: NOTE });
    await root.getByRole("button", { name: "All messages" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
    await expect(root.locator(".of-threads").getByRole("button", { name: /Ilvar Thorne/u })).toBeFocused();
    await auditScreen(page, root, "phone: threads");
    await shot("04-phone");
    await root.getByRole("button", { name: "Back", exact: true }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
  });

  await test.step("Wish: one wish by keyboard at reduced motion, paid from the chapter's Starlight", async () => {
    await dock(root, "Wish").click();
    await expect(root.getByRole("heading", { level: 1, name: "Wish" })).toBeFocused();
    const banner = root.getByRole("region", { name: "Clockwork Hearts" });
    await expect(banner.getByText("5★ in 37")).toBeVisible();
    await auditScreen(page, root, "wish");
    const one = banner.getByRole("button", { name: /^Wish ×1,/u });
    await one.focus();
    await page.keyboard.press("Enter");
    const takeover = page.getByRole("dialog", { name: "Your wish" });
    await expect(takeover.getByRole("button", { name: "Break the seal" })).toBeFocused();
    await expectTrapped(page, takeover);
    await takeover.getByRole("button", { name: "Break the seal" }).focus();
    await page.keyboard.press("Enter");
    const reveal = takeover.locator(".of-reveal");
    await expect(reveal.getByRole("heading", { name: "The Hour He Stopped" })).toBeFocused();
    await expectStill(root, "wish: reveal");
    await reveal.getByRole("button", { name: "Continue" }).click();
    await expect(takeover.getByRole("heading", { name: "Your wish" })).toBeFocused();
    await shot("05-wish");
    await page.keyboard.press("Escape");
    await expect(takeover).toBeHidden();
    await expect(one).toBeFocused();
    await expect(starlight(root)).toContainText(amount(2150));
    expect(posts(stub, "/wish/pull")).toHaveLength(1);
  });

  await test.step("Wardrobe: my looks, and one worn at home", async () => {
    await dock(root, "Wardrobe").click();
    await expect(root.getByRole("heading", { level: 1, name: "Wardrobe" })).toBeFocused();
    const owners = root.getByRole("group", { name: "Whose wardrobe" });
    await expect(owners.getByRole("radio", { name: "Ilvar Thorne" })).toBeChecked();
    await auditScreen(page, root, "wardrobe: his");
    await owners.getByText("Me", { exact: true }).click();
    await expect(root.getByRole("heading", { name: "My looks" })).toBeVisible();
    await root.getByRole("button", { name: "Wear Starlit Gown at home" }).click();
    await expect(root.locator(".of-ward-look", { hasText: "Starlit Gown" }).getByText("Worn at home")).toBeFocused();
    expect(posts(stub, "/wardrobe/wear").at(-1)!.body).toMatchObject({ owner: "me", look: "my-wardrobe-0-f" });
    await auditScreen(page, root, "wardrobe: mine");
    await shot("06-wardrobe");
  });

  await test.step("Album: the wish's Memory, the Love Timeline", async () => {
    await dock(root, "Album").click();
    await expect(root.getByRole("heading", { level: 1, name: "Album" })).toBeFocused();
    await auditScreen(page, root, "album");
    const tabs = root.getByRole("tablist", { name: "Album" });
    await tabs.getByRole("tab", { name: "Memories" }).click();
    const memory = root.getByRole("button", { name: /The Hour He Stopped/u });
    await memory.click();
    const dialog = page.getByRole("dialog", { name: "Memory" });
    await expect(dialog.getByRole("button", { name: "Read the story" })).toBeVisible();
    await expectTrapped(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(memory).toBeFocused();
    await tabs.getByRole("tab", { name: "Memories" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Love Timeline" })).toHaveAttribute("aria-selected", "true");
    await expect(root.getByText("The night Ilvar first said your name.")).toBeVisible();
    await auditScreen(page, root, "album: timeline");
    await shot("07-album");
  });

  await test.step("Dates: Read Them by keyboard", async () => {
    await dock(root, "Dates").click();
    await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
    await expect(root.getByRole("radio", { name: /Ilvar Thorne/u })).toBeChecked();
    await auditScreen(page, root, "dates");
    await root.getByRole("button", { name: "Play: Read Ilvar Thorne" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Read Ilvar Thorne" })).toBeFocused();
    await auditScreen(page, root, "read them: intro");
    await root.getByRole("button", { name: "Begin" }).click();
    for (const [round, truth] of READ_ROUNDS.entries()) {
      await expect(root.getByRole("heading", { name: `Moment ${round + 1} of 5` })).toBeFocused();
      if (round === 0)
        await auditScreen(page, root, "read them: a moment", root.getByRole("heading", { name: "Moment 1 of 5" }));
      await page.keyboard.press(String(truth.trueIndex + 1));
      await expect(root.locator(".of-rh-verdict")).toContainText("You read Ilvar Thorne right.");
      await page.keyboard.press("Enter");
    }
    const score = root.getByRole("heading", { name: "You read Ilvar Thorne right 5 of 5 times" });
    await expect(score).toBeFocused();
    await expect(root.locator(".of-rh-done")).toContainText("+40 Starlight");
    await auditScreen(page, root, "read them: done", score);
    await shot("08-read-them");
    await root.getByRole("button", { name: "Back" }).first().click();
    await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
    await expect(starlight(root)).toContainText(amount(2190));
  });

  await test.step("Date Night: a place, the looks, three scenes and how it went", async () => {
    await root.getByRole("button", { name: "Play: Date Night with Ilvar Thorne" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Where to tonight?" })).toBeFocused();
    const places = root.getByRole("group", { name: "Where you and Ilvar Thorne spend the evening" });
    await auditScreen(page, root, "date night: places");
    await places.locator("label").first().click();
    await root.getByRole("button", { name: "Next: what you wear" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "What will you wear?" })).toBeFocused();
    await auditScreen(page, root, "date night: looks");
    await root.getByRole("button", { name: "Begin the date" }).click();
    await expect.poll(() => posts(stub, "/dates").length).toBe(1);
    expect(posts(stub, "/dates")[0]!.body).toMatchObject({ li: ILVAR, herLook: "base", hisLook: "base" });
    for (const [i] of DATE_BEATS.entries()) {
      await expect(line(root)).toContainText(`Scene ${i + 1}: the tanks glow blue around you.`);
      await next(root);
      await expect(line(root)).toContainText(i === 2 ? "I would come here again." : "The jellyfish drift");
      await root
        .getByRole("group", { name: "What do you do?" })
        .getByRole("button", { name: `Take his hand (${i + 1})` })
        .click();
      await expect(line(root)).toContainText("You reach for his hand.");
      await next(root);
      await expect(line(root)).toContainText("Just this once.");
      await next(root);
    }
    const ending = root.getByRole("heading", { level: 1 });
    await expect(ending).toBeFocused();
    await expect(root.getByText("+120 Starlight")).toBeVisible();
    await auditScreen(page, root, "date night: ending");
    await shot("09-date-night");
    await root.getByRole("button", { name: "Back to Dates" }).first().click();
    await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
    await expect(starlight(root)).toContainText(amount(2310));
  });

  await test.step("Claw Machine: his turn cheered on, my drops, the shelf", async () => {
    await root.getByRole("button", { name: "Play: Claw Machine with Ilvar Thorne" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Claw Machine" })).toBeFocused();
    await auditScreen(page, root, "claw: who goes first");
    await root.getByRole("button", { name: "Ilvar Thorne first" }).click();
    const action = root.locator(".of-claw-action");
    await expect(action).toBeFocused();
    await expect(action).toHaveAttribute("data-mode", "cheer", { timeout: 10_000 });
    for (let cheer = 0; cheer < 8; cheer += 1) {
      await page.keyboard.press("c");
      await page.waitForTimeout(130);
    }
    const result = root.locator("#of-claw-result-title");
    for (let turn = 0; turn < 12 && !(await result.isVisible()); turn += 1) {
      await Promise.race([
        expect(action).toHaveAttribute("data-mode", "drop", { timeout: 20_000 }),
        expect(result).toBeVisible({ timeout: 20_000 }),
      ]).catch(() => undefined);
      if (await result.isVisible()) break;
      if ((await action.getAttribute("data-mode")) !== "drop") continue;
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press(" ");
      await expect(action)
        .not.toHaveAttribute("data-mode", "drop", { timeout: 10_000 })
        .catch(() => undefined);
    }
    await expect(result).toBeFocused({ timeout: 30_000 });
    await expect(root.locator(".of-claw-pay")).toContainText("affection with Ilvar Thorne");
    const caught = posts(stub, "/claw/finish")[0]!.body!.caught.length;
    await auditScreen(page, root, "claw: result", result);
    await shot("10-claw");
    await root.getByRole("button", { name: "Back" }).first().click();
    await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
    await expect(starlight(root)).toContainText(amount(2310 + 20 + 30 * caught));
  });

  await test.step("Remind Me, the tracker, and a Caring message", async () => {
    await root.getByRole("button", { name: "Home with Ilvar Thorne" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
    await root.getByRole("button", { name: "Remind Me" }).click();
    const heading = root.getByRole("heading", { level: 1, name: "Remind Me" });
    await expect(heading).toBeFocused();
    await expect(root.getByRole("region", { name: "Coming up" })).toContainText("Ilvar Thorne’s birthday");
    await auditScreen(page, root, "remind me");
    await root.getByRole("button", { name: "Open the tracker" }).click();
    await expect(root.getByRole("tab", { name: "Tracker" })).toHaveAttribute("aria-selected", "true");
    const toggle = root.getByRole("switch", { name: /Period tracker/u });
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
    const yesterday = await page.evaluate(() => new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA"));
    await root.getByLabel("Log an earlier first day").fill(yesterday);
    await root.getByRole("button", { name: "Add", exact: true }).click();
    await expect(root.getByText(/Today is day 2 of your period/u)).toBeVisible();
    await auditScreen(page, root, "settings: tracker");
    await shot("11-tracker");
    await root.getByRole("button", { name: "Back" }).click();
    await expect(heading).toBeFocused();
    await expect(root.getByRole("grid").locator(`[data-day="${today}"]`)).toHaveAttribute("data-cycle", "logged");
    await root.getByRole("button", { name: "Back" }).click();
    const caring = root.getByRole("button", { name: "Caring message" });
    await caring.click();
    const dialog = page.getByRole("dialog", { name: "A caring message" });
    await expect(dialog).toContainText(CARE_NOTE);
    await expectTrapped(page, dialog);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(caring).toBeFocused();
    await auditScreen(page, root, "home: caring message");
    await shot("12-home-caring");
  });

  await noSideways();
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth's screens around the loop, by keyboard: the cast, a bible, every Settings tab, the reader's dialogs and the Album", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const mobile = testInfo.project.name.includes("mobile");
  if (!mobile) await page.setViewportSize({ width: 1280, height: 800 });
  // The other look at each size from the loop's.
  await page.emulateMedia({ colorScheme: mobile ? "dark" : "light", reducedMotion: "reduce" });
  const stub = createLoopStub({ seeded: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubEngine(page, stub);
  const root = await openOtome(page);
  await expect(root).toHaveAttribute("data-look", mobile ? "midnight" : "pearl");
  const home = root.getByRole("heading", { level: 1, name: "Ilvar Thorne" });
  await expect(home).toBeVisible();

  await test.step("Who’s home, the cast and a bible behind its spoiler wall", async () => {
    const whoIsHome = root.getByRole("button", { name: "Who’s home" });
    await whoIsHome.click();
    const picker = page.getByRole("dialog", { name: "Who’s home" });
    await expectTrapped(page, picker);
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(whoIsHome).toBeFocused();
    await whoIsHome.click();
    await picker.getByRole("button", { name: "Your cast" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Your story is ready" })).toBeFocused();
    await auditScreen(page, root, "the cast");
    await root.getByRole("button", { name: "Open Rosalind Vey’s bible (spoilers)" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Rosalind Vey’s bible" })).toBeFocused();
    await auditScreen(page, root, "bible: spoiler wall");
    await root.getByRole("button", { name: "Show spoilers" }).click();
    await expect(root.getByText("Built the clock that stopped.")).toBeVisible();
    await auditScreen(page, root, "bible: open");
    await root.getByRole("button", { name: "Back", exact: true }).click();
    await root.getByRole("button", { name: "Back", exact: true }).click();
    await expect(home).toBeFocused();
  });

  await test.step("Rough day?", async () => {
    const rough = root.getByRole("button", { name: "Rough day?" });
    await rough.click();
    const sheet = page.getByRole("dialog", { name: "For a rough day" });
    await expect(sheet).toContainText("Sit. Tea first, then everything else.");
    await expectTrapped(page, sheet);
    await page.keyboard.press("Escape");
    await expect(rough).toBeFocused();
  });

  await test.step("every Settings tab", async () => {
    await root.getByRole("button", { name: "Settings", exact: true }).click();
    const tabs = root.getByRole("tablist");
    for (const name of ["Look", "Content", "Connections", "Images", "Audio", "Tracker", "Privacy & data", "Debug"]) {
      const tab = tabs.getByRole("tab", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(root.getByRole("tabpanel")).toBeVisible();
      await auditScreen(page, root, `settings: ${name}`, tab);
    }
    await page.screenshot({ path: testInfo.outputPath("settings-debug.png") });
    await root.getByRole("button", { name: "Back", exact: true }).click();
    await expect(home).toBeFocused();
  });

  await test.step("the reader's Backlog and Ease off hold focus and give it back", async () => {
    await dock(root, "Story").click();
    await root.getByRole("button", { name: "Choose who leads" }).click();
    await page
      .getByRole("dialog", { name: "Who walks with you this chapter?" })
      .getByRole("button", { name: /Ilvar Thorne/u })
      .click();
    await expect(line(root)).toContainText("The gears above the gallery tick past midnight.");
    await next(root);
    await expect(root.getByRole("group", { name: "What do you do?" })).toBeVisible();
    const more = root.getByRole("button", { name: "More reader controls" });
    if ((await more.isVisible()) && (await more.getAttribute("aria-expanded")) === "false") await more.click();
    const backlogButton = root.getByRole("button", { name: "Backlog" });
    await backlogButton.click();
    const backlog = page.getByRole("dialog", { name: "Backlog" });
    await expect(backlog).toContainText("The gears above the gallery tick past midnight.");
    await expectTrapped(page, backlog);
    await page.keyboard.press("Escape");
    await expect(backlog).toBeHidden();
    await expect(backlogButton).toBeFocused();
    const easeOff = root.getByRole("button", { name: "Ease off" });
    await easeOff.click();
    const ease = page.getByRole("dialog", { name: "Ease off?" });
    await expectTrapped(page, ease);
    await ease.getByRole("button", { name: "Keep reading" }).click();
    await expect(ease).toBeHidden();
    await expect(easeOff).toBeFocused();
    expect(posts(stub, "/ease-off")).toHaveLength(0);
    await root.getByRole("button", { name: "Leave the chapter" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Story" })).toBeFocused();
    await auditScreen(page, root, "story: a chapter under way");
  });

  await test.step("the Album's other tabs", async () => {
    await dock(root, "Album").click();
    const tabs = root.getByRole("tablist", { name: "Album" });
    for (const name of ["CGs", "Favourite lines", "Soundtrack", "Tells"]) {
      const tab = tabs.getByRole("tab", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await auditScreen(page, root, `album: ${name}`, tab);
    }
  });

  await test.step("Your stories", async () => {
    await dock(root, "Album").click();
    await expect(home).toBeFocused();
    await root.getByRole("button", { name: "Who’s home" }).click();
    await page.getByRole("dialog", { name: "Who’s home" }).getByRole("button", { name: "Your stories" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Your stories" })).toBeFocused();
    await expect(root.getByText("The Clockwork Masquerade")).toBeVisible();
    await auditScreen(page, root, "your stories");
    await page.screenshot({ path: testInfo.outputPath("stories.png") });
  });

  expect(pageErrors).toEqual([]);
});
