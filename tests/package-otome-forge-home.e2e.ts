// Otome Forge's Home and phone (M3) in the Engine's Home tab, with /api/otome-forge/** stubbed: the layered Home with
// his figure and face before a painted place, the message of the day written once (and never asked for again by itself
// after a failure), his mood, tap lines that need no Otome request (and annoy him after too many, his face showing it),
// each voiced with his card's Engine voice under a cache key and cut short by Me, Play (cached), Him / Me, Home read
// again on each visit under the Engine's 30 s cache (a rupture that opens brings a curt note, its repair a new warm one
// the same day), Reply into his thread with the note quoted; a thread with typing, his messages one by one, his
// sticker, no suggested replies, a sticker of hers, read receipts and Close and remember, which shows only that he
// remembers it and the line he keeps (#2044: her five and his chibi stickers
// in the picker, his bracketed sticker in a bubble, an old face sticker as before, and "You unlocked a new sticker");
// Home without images at reduced motion,
// during a rupture, with Rough day? voiced with no cache key; and his faces' cut-outs arriving while Home is open.
// M4: what the Wardrobe's Wear at home put on stands on Home (his look's cut-out, her look on Me), with the line he
// noticed about hers arriving while Home is open; on a small phone the longest line stands beside the rail without
// pushing it up, clear of the note, and at every phone size and on desktop it covers no rail button, the note (its Play
// and Reply), her name, the top bar or the dock.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-home.e2e.ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const catalog: Record<string, string> = JSON.parse(
  readFileSync(
    resolve(__dirname, "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/locales/en.json"),
    "utf8",
  ),
);
const fallback = (prefix: string) =>
  Object.entries(catalog)
    .filter(([key]) => key.startsWith(`ui.otomeForge.fallback.${prefix}`))
    .map(([, text]) => text);

type Json = Record<string, any>;
interface Call {
  method: string;
  path: string;
  body: Json | undefined;
}

const RUN = "r-e2e-home01";
const ILVAR = "li-ilvar-0001";
const CASSIAN = "li-cassian-0002";
const NOTE = "You left the lab light on again. I turned it off. Don’t thank me.";
/** His notes later the same day: during a rupture, then after its repair. */
const CURT_NOTE = "The audit will not wait.";
const WARM_AGAIN = "The lab is quiet again. Come by when you can.";
const HIS_LINES = {
  head: ["Careful with the hair.", "Again. Fine.", "You are bold today."],
  hand: ["Cold hands. Stay a moment.", "Hold on, then.", "Fine. Just this once."],
  heart: ["That is my heart.", "Steady. It only beats.", "Too close. Stay."],
};
const ANNOYED = ["Enough. I mean it.", "I am not a bell.", "Patience. Mine is thinning.", "One more and I leave."];

/** A tiny solid PNG as a data: URL (the CSP allows data: images). */
function png(width: number, height: number, [r, g, b]: [number, number, number]): string {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (data: Buffer) => {
    let c = 0xffffffff;
    for (const byte of data) c = table[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    rows.push(0);
    for (let x = 0; x < width; x++) rows.push(r, g, b);
  }
  const image = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${image.toString("base64")}`;
}

const PORTRAIT = png(13, 19, [150, 160, 210]);
const PORTRAIT_CUT = png(13, 19, [140, 150, 200]);
const TENDER = png(13, 19, [230, 170, 190]);
const TENDER_CUT = png(13, 19, [220, 160, 180]);
const PLACE = png(16, 9, [60, 70, 110]);
/** #2087: a Photo Shoot photo with Ilvar, a square print. */
const PHOTO = png(16, 16, [240, 200, 160]);
const FLUSTERED = png(13, 19, [240, 140, 170]);
const AVATAR = png(8, 8, [231, 166, 184]);
/** M4: the looks the Wardrobe's Wear at home put on, his cut out. */
const HIS_WORN = png(13, 19, [90, 110, 170]);
const HIS_WORN_CUT = png(13, 19, [80, 100, 160]);
const HER_WORN = png(13, 19, [200, 150, 90]);
// #2044: her painted laugh sticker and two chibi stickers of his (cut-outs).
const HER_LAUGH = png(16, 16, [250, 210, 150]);
const HIS_SMUG = png(16, 16, [120, 150, 220]);
const HIS_PENSIVE = png(16, 16, [110, 130, 200]);
const NOTICED_LINE = "Amber suits you. Do not let it go to your head.";
// The longest of each (P16 writes up to 30 words, P19 up to 20): on a small phone they still leave the rail its room.
const LONG_NOTE = "You left the lab light on again tonight, so I turned it off and locked up after you. Sleep, please.";
const LONG_NOTICED =
  "Amber suits you more than I expected, and I keep looking, which is a problem. Do not tell anyone else.";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
/** Exactly one of `lines`. */
const anyOf = (lines: string[]) => new RegExp("^(?:" + lines.map(escapeRegExp).join("|") + ")$", "u");

/**
 * The M3 routes, answered in memory by the server's rules (S/routes/home.ts, S/routes/phone.ts). `state.rupture` is
 * the story's (the reader opens and repairs one), and a note written on the other side of it is stale, as noteFits
 * says; `faceCutouts` has his tender face's cut-out land on the second read of Home. On the phone, `state.hold` keeps
 * his reply back until it resolves (the thread and the list say `busy` meanwhile), and `sendFailures` and
 * `closeFailures` fail that many sends (with nothing saved) or closes (409 busy).
 */
function createHomeStub({
  images = true,
  rupture = false,
  noteFailures = 0,
  faceCutouts = false,
  worn = false,
  firstNote = NOTE,
  noticedLine = NOTICED_LINE,
  photo = false,
  // The story memory's status (GET .../memory/status); without it the route is a 404 and no memory banner shows.
  memory = null as Json | null,
} = {}) {
  const calls: Call[] = [];
  const state = {
    rupture,
    speakDelayMs: 0,
    hold: null as Promise<void> | null,
    replying: false,
    sendFailures: 0,
    closeFailures: 0,
  };
  let homeReads = 0;
  // M4: the reads of Me before the line he noticed about her look lands (it is written in the background).
  let meReads = 0;
  const now = () => new Date().toISOString();
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
  const pronouns = { subject: "he", object: "him", possessive: "his" };
  const view: Json = {
    runKey: RUN,
    world: {
      version: 1,
      title: "The Clockwork Masquerade",
      premise: "A city of clockwork canals.",
      language: "English",
      createdAt: now(),
      setting: "",
      mystery: { question: "Who stopped the clocks?" },
      web: [],
      openingSituation: "",
      content: { heat: "sfw", darkness: "angst", limits: {}, custom: [] },
      images: { connectionId: images ? "conn-image" : null, rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
      // Voices on (Settings → Audio), so Home's lines are voiced through the Engine's voice service.
      audio: { tts: true },
    },
    player: {
      personaId: "persona-mira",
      name: "Mira Vale",
      pronouns: { subject: "she", object: "her", possessive: "her" },
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
      // M4: the look she wears at home (her base look is her persona's avatar).
      ...(worn
        ? {
            outfits: [
              { id: "my-wardrobe-0-f", name: "Lantern Dress", outfitLine: "amber silk", url: HER_WORN, at: now() },
            ],
            wornOutfit: "my-wardrobe-0-f",
          }
        : {}),
    },
    lis: [
      {
        id: ILVAR,
        name: "Ilvar Thorne",
        pronouns,
        source: "card",
        cardId: "card-ilvar",
        accent: "#9DB8F0",
        level: 2,
        stage: 2,
        ...(images ? { portrait: PORTRAIT, expressions: { tender: TENDER, flustered: FLUSTERED } } : {}),
        // M4: the look he wears, whose faces are not painted yet (the run view's faces are the worn look's).
        ...(worn ? { worn: { id: "his-wardrobe-0-f", url: HIS_WORN }, expressions: undefined } : {}),
      },
      { id: CASSIAN, name: "Cassian", pronouns, source: "archetype", accent: "#E7A6B8", level: 1, stage: 1 },
    ],
    forge: { phase: "ready", steps: [] },
    starlight: 2000,
    // #2044: her five (the laugh painted; the rest the built-in set) and his level 2 sticker.
    stickers: [
      ...["laugh", "love", "shy", "sad", "pout"].map((emotion) => ({
        id: `you:${emotion}`,
        owner: "you",
        emotion,
        name: `mira_vale_${emotion}`,
        ...(emotion === "laugh" ? { url: HER_LAUGH } : {}),
      })),
      {
        id: `${ILVAR}:smug`,
        owner: ILVAR,
        emotion: "smug",
        name: "ilvar_thorne_smug",
        label: "Smug",
        level: 2,
        url: HIS_SMUG,
      },
    ],
  };
  // #2044: POST .../stickers (the phone opened with images on); with `unlock`, the next read brings his level 3 sticker.
  const stickerState = { unlock: false, starts: 0 };
  const index = {
    version: 1,
    runs: [{ runKey: RUN, title: "The Clockwork Masquerade", createdAt: now(), lastPlayedAt: null }],
    activeRun: RUN,
    ageGate: null,
    lastOpenedAt: null,
  };
  const home = { li: ILVAR as string, show: "him" as "him" | "me" };
  const notes = new Map<string, Json>();
  const written = new Map<string, number>();
  const fits = (note: Json | undefined) => !!note && note.curt === state.rupture;
  const noteText = (li: string, count: number) =>
    li !== ILVAR
      ? "The canals froze at dawn. I thought of you."
      : count === 1
        ? firstNote
        : state.rupture
          ? CURT_NOTE
          : WARM_AGAIN;
  let failuresLeft = noteFailures;

  // Ilvar's thread: one remembered conversation, then a message of his the player hasn't seen.
  const messages: Json[] = [
    { id: "m-a1", who: "player", text: "Are you still at the lab?", at: minutesAgo(300) },
    { id: "m-a2", who: "li", text: "Where else would I be.", at: minutesAgo(299) },
    { id: "m-a3", who: "li", text: "The light was on again.", at: minutesAgo(5) },
  ];
  const sessions: Json[] = [
    {
      start: 0,
      count: 2,
      memory: { text: "She asked where he was; he pretended not to be pleased.", quote: "Where else would I be." },
      closedAt: minutesAgo(298),
    },
  ];
  let seenAt: string | null = minutesAgo(200);
  let replies = 0;
  const archived = () => sessions.reduce((sum, session) => sum + session.count, 0);
  const unread = () => messages.filter((m) => m.who === "li" && (!seenAt || m.at > seenAt)).length;
  const historyPage = () => ({
    messages: messages.map((m, i) => ({ ...m, archived: i < archived() })),
    page: 1,
    pages: 1,
    from: 0,
    past: sessions.length,
    activeCount: messages.length - archived(),
    busy: state.replying,
    retry: messages.at(-1)?.who === "player",
    sessions,
    seenAt,
  });

  const answer = async (call: Call): Promise<{ status: number; json: unknown }> => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (memory && path === `${base}/memory/status`) return { status: 200, json: { status: memory } };
    if (path === base) {
      if (stickerState.unlock && stickerState.starts > 0) {
        stickerState.unlock = false;
        view.stickers.push({
          id: `${ILVAR}:pensive`,
          owner: ILVAR,
          emotion: "pensive",
          name: "ilvar_thorne_pensive",
          label: "Pensive",
          level: 3,
          url: HIS_PENSIVE,
        });
      }
      return { status: 200, json: { view: structuredClone(view) } };
    }
    if (path === `${base}/stickers`) {
      stickerState.starts += 1;
      view.player.stickers = {};
      return { status: 200, json: { started: true } };
    }
    if (path === `${base}/home`) {
      const look =
        home.show === "me"
          ? worn
            ? { url: HER_WORN, source: "look", cutoutState: "uncut" }
            : images
              ? { url: AVATAR, source: "avatar", cutoutState: "uncut" }
              : null
          : worn && home.li === ILVAR
            ? { url: HIS_WORN, source: "look", cutout: HIS_WORN_CUT, cutoutState: "ready" }
            : images && home.li === ILVAR
              ? faceCutouts
                ? { url: PORTRAIT, source: "look", cutout: PORTRAIT_CUT, cutoutState: "ready" }
                : { url: PORTRAIT, source: "look", cutoutState: "uncut" }
              : null;
      homeReads += 1;
      if (home.show === "me") meReads += 1;
      const noticedNow = worn && meReads >= 2;
      const faces =
        faceCutouts && home.li === ILVAR
          ? {
              tender:
                homeReads === 1
                  ? { url: TENDER, cutoutState: "pending" }
                  : { url: TENDER, cutout: TENDER_CUT, cutoutState: "ready" },
            }
          : {};
      const stored = notes.get(home.li);
      return {
        status: 200,
        json: {
          li: home.li,
          show: home.show,
          note: fits(stored) ? stored : null,
          look,
          faces,
          lines: { ready: images },
          rupture: state.rupture,
          unread: unread(),
          backdrop: images ? { url: PLACE, kind: "place" } : null,
          // #2087: the newest Photo Shoot photo with him, taped into his note.
          photo: photo && home.li === ILVAR ? { url: PHOTO, at: now() } : null,
          noticed: noticedNow ? { li: ILVAR, text: noticedLine, look: "my-wardrobe-0-f", at: now() } : null,
          noticing: worn && meReads >= 1 && !noticedNow,
        },
      };
    }
    if (path === `${base}/home/set`) {
      if (call.body!.li) home.li = call.body!.li;
      if (call.body!.show) home.show = call.body!.show;
      return { status: 200, json: { home } };
    }
    if (path === `${base}/home/note`) {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        return { status: 503, json: { error: "No connection for the note.", code: "no-connection" } };
      }
      const li = call.body!.li;
      if (!fits(notes.get(li))) {
        const count = (written.get(li) ?? 0) + 1;
        written.set(li, count);
        notes.set(li, {
          li,
          dayKey: now().slice(0, 10),
          text: noteText(li, count),
          // A curt note names no face, so his face is the rupture's (cold).
          face: state.rupture && count > 1 ? "" : "tender",
          mood: { word: "irritable", reason: "audit" },
          curt: state.rupture,
          at: new Date(Date.now() + count).toISOString(),
        });
      }
      return { status: 200, json: { note: notes.get(li) } };
    }
    const lines = /^\/runs\/[^/]+\/lis\/([^/]+)\/lines$/u.exec(path);
    if (lines) {
      const tap = (pool: string[]) => ({ morning: pool, day: pool, night: pool });
      return {
        status: 200,
        json: images
          ? {
              ready: true,
              stage: 2,
              rupture: state.rupture,
              tap: state.rupture
                ? null
                : { head: tap(HIS_LINES.head), hand: tap(HIS_LINES.hand), heart: tap(HIS_LINES.heart) },
              annoyed: state.rupture ? [] : ANNOYED,
              cold: ["Not now.", "Leave it."],
              comfort: ["Sit. Tea first, then everything else."],
              claw: null,
            }
          : {
              ready: false,
              stage: 1,
              rupture: state.rupture,
              tap: null,
              annoyed: [],
              cold: [],
              comfort: [],
              claw: null,
            },
      };
    }
    if (path === `${base}/phone`) {
      return {
        status: 200,
        json: {
          threads: [
            { li: ILVAR, last: messages.at(-1), unread: unread(), busy: state.replying },
            { li: CASSIAN, last: null, unread: 0, busy: false },
          ],
        },
      };
    }
    if (path === `${base}/phone/${ILVAR}`) return { status: 200, json: historyPage() };
    if (path === `${base}/phone/${CASSIAN}`) {
      return {
        status: 200,
        json: { ...historyPage(), messages: [], past: 0, activeCount: 0, sessions: [], retry: false },
      };
    }
    if (path === `${base}/phone/${ILVAR}/seen`) {
      const last = messages.find((m) => m.id === call.body!.last);
      if (last && (!seenAt || last.at > seenAt)) seenAt = last.at;
      return { status: 200, json: {} };
    }
    if (path === `${base}/phone/${ILVAR}/send`) {
      if (state.sendFailures > 0) {
        state.sendFailures -= 1;
        return { status: 500, json: { error: "The line went quiet.", code: "failed" } };
      }
      const { text = "", sticker, quote, id } = call.body!;
      const mine: Json = {
        id,
        who: "player",
        text,
        at: now(),
        ...(sticker ? { sticker } : {}),
        ...(quote ? { quote } : {}),
      };
      messages.push(mine);
      // The model takes a moment; his reply is two messages, the second a sticker.
      state.replying = true;
      await new Promise((done) => setTimeout(done, 500));
      await state.hold;
      state.replying = false;
      replies += 1;
      const reply: Json[] = [
        {
          id: `m-r${replies}a`,
          who: "li",
          text: replies === 1 ? "Barely. The data kept me company." : "Noted.",
          at: now(),
        },
        // His first sticker is an old face (a message from before #2044), his second his own chibi sticker.
        { id: `m-r${replies}b`, who: "li", text: "", sticker: replies === 1 ? "tender" : `${ILVAR}:smug`, at: now() },
      ];
      messages.push(...reply);
      return { status: 200, json: { messages: [mine, ...reply] } };
    }
    if (path === `${base}/phone/${ILVAR}/close`) {
      if (state.closeFailures > 0) {
        state.closeFailures -= 1;
        return { status: 409, json: { error: "Ilvar Thorne is still writing.", code: "busy" } };
      }
      const count = messages.length - archived();
      sessions.push({
        start: archived(),
        count,
        memory: { text: "She wrote late; he admitted he had not slept.", quote: "Barely." },
        closedAt: now(),
      });
      return {
        status: 200,
        json: {
          memory: sessions.at(-1)!.memory,
          grants: [{ source: "close-and-remember", li: ILVAR, affection: 5 }],
        },
      };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer, notes, state, stickerState };
}

type Stub = ReturnType<typeof createHomeStub>;

async function stubRoutes(page: Page, stub: Stub, spoken: string[]) {
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { status, json } = await stub.answer({
      method: request.method(),
      path: url.pathname,
      body: request.method() === "POST" ? request.postDataJSON() : undefined,
    });
    await route.fulfill({ status, json });
  });
  // The Engine's voice routes: his card's assigned voice, the pools, and a silent clip for each line.
  await page.route("**/api/tts/config", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        connectionId: "conn-tts",
        connectionProfiles: {
          "conn-tts": {
            voiceAssignments: [{ characterId: "card-ilvar", voice: "Ilvar Voice" }],
            npcDefaultMaleVoices: ["Pool Male"],
            npcDefaultFemaleVoices: ["Pool Female"],
          },
        },
      },
    }),
  );
  await page.route("**/api/tts/voices*", (route) => route.fulfill({ json: { voices: ["Ilvar Voice", "Pool Male"] } }));
  // A clip can take a while (state.speakDelayMs), so a line is still playing when the player moves on.
  await page.route("**/api/tts/speak", async (route) => {
    spoken.push(String(route.request().postDataJSON()?.text ?? ""));
    if (stub.state.speakDelayMs) await new Promise((done) => setTimeout(done, stub.state.speakDelayMs));
    await route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) }).catch(() => undefined);
  });
}

/** Records every line the Engine's voice service is asked to speak, with its voice and cache key, and its signal. */
async function recordSpeech(page: Page) {
  await page.evaluate(() => {
    const service = (globalThis as any).__MARINARA_HOST__.services.tts.ttsService;
    const speak = service.speakSequence.bind(service);
    (window as any).__spoken = [];
    (window as any).__signals = [];
    service.speakSequence = (requests: any[], id: string, options: any) => {
      (window as any).__spoken.push(...requests);
      (window as any).__signals.push(options?.signal);
      return speak(requests, id, options);
    };
  });
}
const voiced = (page: Page) => page.evaluate(() => (window as any).__spoken as Json[]);
/** Whether the newest voiced line was cut short. */
const lastLineStopped = (page: Page) =>
  page.evaluate(() => !!((window as any).__signals as (AbortSignal | undefined)[]).at(-1)?.aborted);

/** The Engine's own React Query cache keeps an answer fresh for 30 s (lib/query-client.ts); the stand-in's does not. */
const engineStaleTime = (page: Page) =>
  page.evaluate(() => {
    const client = (globalThis as any).__MARINARA_HOST__.queryClient;
    const defaults = client.getDefaultOptions();
    client.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, staleTime: 30_000 } });
  });

async function openHome(page: Page): Promise<Locator> {
  // Engine's calendar greeting can appear after startup. Keep its theme through the normal, specific dialog action.
  await page.addLocatorHandler(
    page
      .getByRole("dialog", { name: "Happy Halloween!", exact: true })
      .filter({ has: page.getByRole("button", { name: "Keep it", exact: true }) }),
    async (dialog) => {
      await dialog.getByRole("button", { name: "Keep it", exact: true }).click();
    },
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
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

const posts = (stub: Stub, suffix: string) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));

/**
 * Every request Otome Forge makes to its own routes from now on. The voice service's (a voiced line) and the Engine
 * shell's own traffic (its polls and late first loads) are left out.
 */
function apiRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/otome-forge/")) seen.push(`${request.method()} ${url.pathname}`);
  });
  return seen;
}

test("Otome Forge Home: his note once a day, taps with no request, Play, Him / Me, and Reply into his thread", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // Midnight here and in the phone test; Pearl in the last.
  await page.emulateMedia({ colorScheme: "dark" });
  const stub = createHomeStub();
  const answer = stub.answer;
  stub.answer = async (call) => {
    const response = await answer(call);
    // This positive presentation fixture represents faces whose cleanup is already complete.
    if (call.path === `/api/otome-forge/runs/${RUN}`) (response.json as Json).view.lis[0].cut = [TENDER, FLUSTERED];
    return response;
  };
  const spoken: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, spoken);
  const root = await openHome(page);
  await recordSpeech(page);
  await engineStaleTime(page);

  // Home opens on him: the layers fill the stage behind the top bar and the dock, his face from the note's mood, a
  // painted place behind him.
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();
  const home = root.locator(".of-home");
  const note = root.getByRole("article", { name: "A note from Ilvar Thorne" });
  await expect(note).toContainText(NOTE);
  await expect(root.getByRole("img", { name: "Ilvar Thorne, tender" })).toBeVisible();
  await expect(root.locator(".of-mood-chip")).toContainText("irritable: audit");
  for (const layer of ["place", "tint", "light"]) {
    await expect(root.locator(`.of-home [data-layer="${layer}"]`)).toHaveCount(1);
  }
  await expect(root.locator('.of-home-l0[data-backdrop="place"] img.of-home-backdrop')).toHaveAttribute("src", PLACE);
  const [layers, front, body] = await Promise.all([
    root.locator(".of-home-layers").boundingBox(),
    root.locator(".of-home-front").boundingBox(),
    root.locator(".of-stage-body").boundingBox(),
  ]);
  expect(layers).toEqual(body);
  expect(front).toEqual(body);
  // His stars twinkle (motion is on) within the sky's own opacity: none at dawn or by day, bright at night.
  const sky = await home.getAttribute("data-sky");
  const starsUnder = async (value: string) => {
    await home.evaluate((element, phase) => {
      (element as HTMLElement).dataset.sky = phase;
    }, value);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    return root.locator(".of-home-stars").evaluate((element) => Number(getComputedStyle(element).opacity));
  };
  expect(await root.locator(".of-home-stars").evaluate((element) => getComputedStyle(element).animationName)).not.toBe(
    "none",
  );
  // The Engine's "Reduce Ambient Animations & Effects" stills them as reduced motion does, and drops the glass blur.
  const reducedEffects = (on: boolean) =>
    page.evaluate((value) => {
      if (value) document.documentElement.dataset.marinaraReducedEffects = "true";
      else delete document.documentElement.dataset.marinaraReducedEffects;
    }, on);
  await reducedEffects(true);
  expect(await root.locator(".of-home-stars").evaluate((element) => getComputedStyle(element).animationName)).toBe(
    "none",
  );
  expect(await root.locator(".of-home-plate").evaluate((element) => getComputedStyle(element).backdropFilter)).toBe(
    "none",
  );
  await reducedEffects(false);
  expect(await starsUnder("day")).toBe(0);
  expect(await starsUnder("dawn")).toBe(0);
  expect(await starsUnder("night")).toBeGreaterThan(0.4);
  await home.evaluate((element, phase) => {
    (element as HTMLElement).dataset.sky = phase;
  }, sky ?? "night");
  await expect(root.getByRole("button", { name: /Messages/ })).toContainText("1");
  await page.screenshot({ path: testInfo.outputPath("01-home.png") });
  expect(posts(stub, "/home/note")).toHaveLength(1);

  // Taps answer at once from his own lines, with no request; a sixth tap within 20 s annoys him.
  const requests = apiRequests(page);
  const zones = root.getByRole("group", { name: "Touch Ilvar Thorne" });
  const head = zones.getByRole("button", { name: "Head" });
  await head.focus();
  await page.keyboard.press("Enter");
  const bubble = root.locator(".of-home-bubble");
  await expect(bubble).toHaveText(anyOf(HIS_LINES.head));
  await expect(root.locator('.of-home > p[aria-live="polite"]')).toContainText("Ilvar Thorne:");
  // His tender face while the line shows (painted), and the line in his card's voice, cached under its own words.
  await expect(root.getByRole("img", { name: "Ilvar Thorne, tender" })).toBeVisible();
  await expect.poll(async () => (await voiced(page)).length).toBe(1);
  const tapVoice = (await voiced(page))[0]!;
  expect(tapVoice).toMatchObject({ text: await bubble.textContent(), voice: "Ilvar Voice", characterId: "card-ilvar" });
  expect(tapVoice.cacheKey).toMatch(new RegExp(`^otome-forge:${RUN}:tap:${ILVAR}:[0-9a-z]+$`, "u"));
  // A real pointer on his chest (he breathes, so the zone never holds still for a locator click): the rows over him
  // let the tap through.
  const heart = (await zones.getByRole("button", { name: "Heart" }).boundingBox())!;
  await page.mouse.click(heart.x + heart.width / 2, heart.y + heart.height / 2);
  await expect(bubble).toHaveText(anyOf(HIS_LINES.heart));
  await zones.getByRole("button", { name: "Heart" }).focus();
  await expect(zones.getByRole("button", { name: "Heart" })).toBeFocused();
  for (let tap = 0; tap < 4; tap++) await page.keyboard.press("Enter");
  await expect(bubble).toHaveAttribute("data-mode", "annoyed");
  expect(ANNOYED).toContain(await bubble.textContent());
  // Annoyed, he is flustered: that face is painted too.
  await expect(root.getByRole("img", { name: "Ilvar Thorne, flustered" })).toHaveAttribute("src", FLUSTERED);
  expect(requests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("02-tap.png") });

  // Play reads the note aloud in his voice, cached under the note itself (taps' lines no longer play by then).
  await expect(bubble).toHaveCount(0, { timeout: 10_000 });
  await note.getByRole("button", { name: "Hear Ilvar Thorne read the note" }).click();
  await expect.poll(async () => (await voiced(page)).at(-1)?.text).toBe(NOTE);
  const noteVoice = (await voiced(page)).at(-1)!;
  expect(noteVoice).toMatchObject({ voice: "Ilvar Voice", characterId: "card-ilvar" });
  expect(noteVoice.cacheKey).toMatch(new RegExp(`^otome-forge:${RUN}:note:${ILVAR}:`, "u"));
  await expect.poll(() => spoken.includes(NOTE)).toBe(true);

  // A tap's line goes with its bubble: Me cuts it short while it still plays.
  stub.state.speakDelayMs = 8_000;
  const before = (await voiced(page)).length;
  await zones.getByRole("button", { name: "Hand" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await voiced(page)).length).toBe(before + 1);
  expect((await voiced(page)).at(-1)!.cacheKey).toMatch(new RegExp(`:tap:${ILVAR}:`, "u"));
  expect(await lastLineStopped(page)).toBe(false);

  // Me: the player in her own look (her persona's avatar), saved; then him again, by the keyboard.
  const him = root.getByRole("radio", { name: "Ilvar" });
  await him.focus();
  await page.keyboard.press("ArrowRight");
  await expect(root.getByRole("heading", { level: 1, name: "Mira Vale" })).toBeVisible();
  await expect.poll(() => lastLineStopped(page)).toBe(true);
  stub.state.speakDelayMs = 0;
  await expect(root.getByRole("img", { name: "You, Mira Vale" })).toBeVisible();
  expect(posts(stub, "/home/set").at(-1)!.body).toMatchObject({ show: "me" });
  await expect(root.locator('.of-figure[data-art="avatar"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("03-me.png") });
  await page.keyboard.press("ArrowLeft");
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();

  // Leaving Home and coming back reads the same note: it is never written twice.
  const visitHome = async () => {
    await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Story" }).click();
    await root.getByRole("button", { name: "Home with Ilvar Thorne" }).click();
  };
  await visitHome();
  const noteCard = root.getByRole("article", { name: "A note from Ilvar Thorne" });
  await expect(noteCard).toContainText(NOTE);
  expect(posts(stub, "/home/note")).toHaveLength(1);

  // A rupture opens in the story while Home is away, within the Engine's 30 s cache: the next visit reads Home again,
  // so the warm note gives way to a curt one and his face is cold.
  stub.state.rupture = true;
  await visitHome();
  await expect(noteCard).toContainText(CURT_NOTE);
  await expect(root.getByRole("img", { name: "Ilvar Thorne, cold" })).toBeVisible();
  expect(posts(stub, "/home/note")).toHaveLength(2);
  // It is repaired the same day: a new warm note is written, never the one from before the rupture.
  stub.state.rupture = false;
  await visitHome();
  await expect(noteCard).toContainText(WARM_AGAIN);
  expect(posts(stub, "/home/note")).toHaveLength(3);

  // Reply opens his thread with the note quoted, focus on its heading; the quote goes with the first message.
  await noteCard.getByRole("button", { name: "Reply" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
  await expect(root.locator(".of-quote-chip")).toContainText(WARM_AGAIN);
  await root.getByRole("textbox", { name: "Message Ilvar Thorne" }).fill("I left it on for you.");
  await root.getByRole("button", { name: "Send", exact: true }).click();
  await expect(root.getByText("Barely. The data kept me company.")).toBeVisible();
  expect(posts(stub, "/send")[0]!.body).toMatchObject({ text: "I left it on for you.", quote: WARM_AGAIN });
  await expect(root.locator(".of-quote-chip")).toHaveCount(0);
  // Settings and back: the phone opens on his thread again, and the quote that went with her message stays spent.
  await root.getByRole("button", { name: "Settings", exact: true }).click();
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
  await expect(root.getByText("Barely. The data kept me company.")).toBeVisible();
  await expect(root.locator(".of-quote-chip")).toHaveCount(0);
  const scrolled = await root.evaluate((element) =>
    [element, ...element.querySelectorAll(".of-frame, .of-stage, .of-stage-body")]
      .filter((box) => box.scrollTop || box.scrollLeft)
      .map((box) => box.className),
  );
  expect(scrolled).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge phone: a thread with typing, his sticker, her sticker and Close and remember", async ({
  page,
}, testInfo) => {
  // #2044's sticker steps (the unlock notice's 4 s, the picker by touch and keyboard) make this the longest phone walk.
  test.setTimeout(180_000);
  await page.emulateMedia({ colorScheme: "dark" });
  // A summary that failed: its banner stays above every screen of the walk, and the sticker notice lands below it.
  const stub = createHomeStub({
    memory: {
      phase: "error",
      retryable: true,
      reason: "generation-failed",
      recordCount: 1,
      message: "This model's maximum context length is 8192 tokens.",
      noConnection: false,
      unsummarized: 1,
    },
  });
  stub.stickerState.unlock = true;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, []);
  const root = await openHome(page);

  // The Messages button opens the threads: one per love interest, his with its unread message.
  await root.getByRole("button", { name: /Messages/ }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Messages" })).toBeFocused();
  const threads = root.locator(".of-threads");
  const row = threads.getByRole("button", { name: /Ilvar Thorne/ });
  await expect(row).toContainText("The light was on again.");
  await expect(row).toContainText("1 unread");
  await expect(threads.getByRole("button", { name: /Cassian/ })).toContainText("No messages yet.");
  // #2044: the phone opened with images on starts her stickers once, and his newly painted one is announced.
  await expect.poll(() => posts(stub, `/runs/${RUN}/stickers`).length).toBe(1);
  const notice = root.locator(".of-toasts--app");
  await expect(notice).toHaveAttribute("role", "status");
  await expect(notice).toContainText("You unlocked a new sticker · Ilvar Thorne");
  const banner = root.locator(".of-memory-banner");
  await expect(banner.getByRole("alert")).toContainText("A story summary failed");
  const [noticeBox, bannerBox] = await Promise.all([
    root.locator(".of-toasts--app .of-toast").first().boundingBox(),
    banner.boundingBox(),
  ]);
  expect(noticeBox!.y, "the notice leaves the banner's Retry in view").toBeGreaterThanOrEqual(
    bannerBox!.y + bannerBox!.height,
  );
  await page.screenshot({ path: testInfo.outputPath("03-sticker-unlocked.png") });
  await expect(root.locator(".of-toasts--app .of-toast")).toHaveCount(0, { timeout: 8_000 });
  await row.click();
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();

  // That he remembers the closed conversation and the line he keeps from it, never the summary written for his
  // prompts; then the open one. His new message is marked seen.
  const log = root.getByRole("list", { name: "Messages with Ilvar Thorne" });
  await expect(log).toContainText("Remembered by Ilvar Thorne");
  await expect(log).toContainText("Where else would I be.");
  await expect(log).not.toContainText("She asked where he was; he pretended not to be pleased.");
  await expect.poll(() => posts(stub, "/seen").at(-1)?.body?.last).toBe("m-a3");

  // He types, then his messages arrive one at a time: words, then his face as a sticker. Her own words leave the box
  // with the message, and no reply is suggested to her.
  const box = root.getByRole("textbox", { name: "Message Ilvar Thorne" });
  await box.fill("Did you sleep at all?");
  await root.getByRole("button", { name: "Send" }).click();
  await expect(box).toHaveValue("");
  await expect(root.locator(".of-typing")).toBeVisible();
  await expect(root.locator('.of-bubble-row[data-who="player"]').last()).toContainText("Did you sleep at all?");
  await expect(log.getByText("Barely. The data kept me company.")).toBeVisible();
  await expect(log.getByRole("img", { name: "Sticker: Tender" }).last()).toBeVisible();
  await expect(root.locator(".of-typing")).toHaveCount(0);
  const sent = posts(stub, "/send")[0]!.body!;
  expect(sent).toMatchObject({ text: "Did you sleep at all?" });
  expect(sent.id).toMatch(/^[a-z0-9][a-z0-9-]{7,59}$/u);
  await page.screenshot({ path: testInfo.outputPath("04-thread.png") });

  // She writes her own reply: nothing offers one.
  await expect(root.locator(".of-suggestions")).toHaveCount(0);
  await box.fill("Go to sleep, Ilvar.");
  await root.getByRole("button", { name: "Send", exact: true }).click();
  await expect(log.getByText("Noted.")).toBeVisible();
  expect(posts(stub, "/send")[1]!.body).toMatchObject({ text: "Go to sleep, Ilvar." });
  await box.fill("Half a thought");
  // His own sticker (his bracketed [ilvar_thorne_smug]) shows whole as its cut-out.
  const smug = log.getByRole("img", { name: "Sticker: Smug" });
  await expect(smug).toHaveAttribute("src", HIS_SMUG);
  await expect(smug).toHaveAttribute("data-kind", "chibi");

  // Her sticker: her own five (the laugh painted, the rest the built-in set), then his two.
  await expect(root.locator(".of-typing")).toHaveCount(0);
  await root.getByRole("button", { name: "Stickers" }).click();
  const yours = root.getByRole("group", { name: "Your stickers" });
  const his = root.getByRole("group", { name: "Ilvar Thorne’s stickers" });
  await expect(yours.getByRole("button")).toHaveCount(5);
  await expect(yours.getByRole("button", { name: "Send the Laughing sticker" }).locator("img")).toHaveAttribute(
    "src",
    HER_LAUGH,
  );
  await expect(yours.getByRole("button", { name: "Send the Pouting sticker" })).toHaveAttribute("data-kind", "builtin");
  await expect(his.getByRole("button")).toHaveCount(2);
  await expect(his.getByRole("button", { name: "Send the Pensive sticker" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Send the Flustered sticker" })).toHaveCount(0);
  // 44 px targets (the Stickers button and Send too), and the panel stays on the stage.
  for (const target of [
    yours.getByRole("button").first(),
    root.getByRole("button", { name: "Stickers" }),
    root.getByRole("button", { name: "Send", exact: true }),
  ]) {
    const box = (await target.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // A solid panel: the messages behind it never show through its titles or the cut-outs (glass inside the composer's
  // glass never blurs them).
  const surface = await root.locator(".of-sticker-panel").evaluate((element) => {
    const style = getComputedStyle(element);
    const parts = style.backgroundColor.match(/[\d.]+/gu)!.map(Number);
    return { alpha: parts.length > 3 ? parts[3]! : 1, blur: style.backdropFilter };
  });
  expect(surface.alpha).toBeGreaterThanOrEqual(0.95);
  expect(surface.blur).toBe("none");
  await page.screenshot({ path: testInfo.outputPath("04b-sticker-picker.png") });
  // An iPhone never focuses a pressed button: the press gives focus to the nearest focusable ancestor (the Engine's
  // main), which closed the panel before the tap's click landed, so a tapped sticker never sent. Every press is
  // answered that way here, unless the picker keeps its focus.
  await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>("main")!;
    // WebKit focuses it on a press; Chromium only once it is focusable.
    main.tabIndex = -1;
    const press = (event: MouseEvent) => {
      if (!event.defaultPrevented) main.focus();
    };
    document.addEventListener("mousedown", press);
    Object.assign(window, { iosPress: press });
  });
  await yours.getByRole("button", { name: "Send the Laughing sticker" }).click();
  await page.evaluate(() => {
    document.removeEventListener(
      "mousedown",
      (window as unknown as { iosPress: (event: MouseEvent) => void }).iosPress,
    );
    document.querySelector<HTMLElement>("main")!.removeAttribute("tabindex");
  });
  // The pressed sticker leaves with its panel: focus goes on to the message box, never to the page.
  await expect(box).toBeFocused();
  await expect.poll(() => posts(stub, "/send").length).toBe(3);
  expect(posts(stub, "/send")[2]!.body).toMatchObject({ text: "", sticker: "you:laugh" });
  await expect(log.getByRole("img", { name: "Sticker: Laughing" }).first()).toHaveAttribute("src", HER_LAUGH);
  await expect(box).toHaveValue("Half a thought");
  // By keyboard, once his reply has landed (the picker waits while he writes): it opens on its first sticker, and
  // Escape closes it and gives focus back.
  await expect(root.locator(".of-typing")).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Stickers" })).toHaveAttribute("aria-disabled", "false");
  await root.getByRole("button", { name: "Stickers" }).focus();
  await page.keyboard.press("Enter");
  await expect(yours.getByRole("button", { name: "Send the Laughing sticker" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(root.getByRole("button", { name: "Stickers" })).toBeFocused();
  await expect(yours).toHaveCount(0);
  // Closing it from its button gives focus back to the button too, never to the page.
  await root.getByRole("button", { name: "Stickers" }).click();
  await expect(yours.getByRole("button", { name: "Send the Laughing sticker" })).toBeFocused();
  await root.getByRole("button", { name: "Stickers" }).click();
  await expect(yours).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Stickers" })).toBeFocused();

  // Her words fail to send and the server never saved them: they come back to the box, unsent.
  await expect(root.locator(".of-typing")).toHaveCount(0);
  // Enter starts a new line and sends nothing, on a phone and on a computer alike: only Send sends.
  await box.press("End");
  await box.press("Enter");
  await expect(box).toHaveValue("Half a thought\n");
  await box.press("Shift+Enter");
  await expect(box).toHaveValue("Half a thought\n\n");
  expect(posts(stub, "/send")).toHaveLength(3);
  await box.fill("Half a thought");
  stub.state.sendFailures = 1;
  await root.getByRole("button", { name: "Send", exact: true }).click();
  // The thread's own alert, beside the memory banner's.
  await expect(root.locator(".of-screen").getByRole("alert")).toContainText(catalog["ui.otomeForge.errors.unknown"]!);
  await expect(box).toHaveValue("Half a thought");
  expect(posts(stub, "/send")).toHaveLength(4);

  // Close and remember: the conversation becomes his memory, and affection is earned once. A close that failed says
  // so, and the dialog opened again starts clean.
  await expect(root.locator(".of-typing")).toHaveCount(0);
  stub.state.closeFailures = 1;
  await root.getByRole("button", { name: "Close and remember" }).click();
  const dialog = page.getByRole("dialog", { name: "Close and remember?" });
  await expect(dialog).toContainText("Ilvar Thorne");
  await dialog.getByRole("button", { name: "Close and remember" }).click();
  await expect(dialog.getByRole("alert")).toContainText(catalog["ui.otomeForge.errors.busy"]!);
  await dialog.getByRole("button", { name: "Not yet" }).click();
  await expect(dialog).toHaveCount(0);
  await root.getByRole("button", { name: "Close and remember" }).click();
  await expect(dialog).toContainText("Ilvar Thorne");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close and remember" }).click();
  await expect(log).toContainText("Barely.");
  await expect(log).not.toContainText("She wrote late; he admitted he had not slept.");
  await expect(log).toContainText("+5 affection");
  expect(posts(stub, "/close")).toHaveLength(2); // The one that failed, then the one that landed.
  await page.screenshot({ path: testInfo.outputPath("05-remembered.png") });

  // Back to the threads, focus on his row.
  await root.getByRole("button", { name: "All messages" }).click();
  await expect(root.locator(".of-threads").getByRole("button", { name: /Ilvar Thorne/ })).toBeFocused();

  // A thread opened from the list is still open after Settings and back, and its Back still leads to his row.
  await root
    .locator(".of-threads")
    .getByRole("button", { name: /Ilvar Thorne/ })
    .click();
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
  await root.getByRole("button", { name: "Settings", exact: true }).click();
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
  // Both closed conversations still show that he remembers them, and only that.
  await expect(log.locator(".of-thread-divider")).toHaveCount(2);
  await expect(log).not.toContainText("She wrote late; he admitted he had not slept.");
  await root.getByRole("button", { name: "All messages" }).click();
  await expect(root.locator(".of-threads").getByRole("button", { name: /Ilvar Thorne/ })).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test("Otome Forge phone: a reply that lands after the player left his thread is there when it opens again; Close says why it waits", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stub = createHomeStub();
  await stubRoutes(page, stub, []);
  const root = await openHome(page);
  await engineStaleTime(page);
  await root.getByRole("button", { name: /Messages/ }).click();
  const row = root.locator(".of-threads").getByRole("button", { name: /Ilvar Thorne/ });
  await expect(row).toContainText("The light was on again.");
  await row.click();
  const log = root.getByRole("list", { name: "Messages with Ilvar Thorne" });
  await expect(log).toContainText("The light was on again.");

  // She sends, then goes back to the thread list while his reply is still being written.
  let release = () => {};
  stub.state.hold = new Promise<void>((done) => (release = done));
  await root.getByRole("textbox", { name: "Message Ilvar Thorne" }).fill("Still up?");
  await root.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => stub.state.replying).toBe(true);
  // Meanwhile Close waits for his reply, and says so: there is a conversation to remember.
  const close = root.getByRole("button", { name: "Close and remember" });
  await expect(close).toHaveAttribute("aria-disabled", "true");
  await expect(close).toHaveAttribute("title", "Wait until Ilvar Thorne has finished writing.");
  await expect(close).toHaveAccessibleDescription("Wait until Ilvar Thorne has finished writing.");
  await root.getByRole("button", { name: "All messages" }).click();
  await expect(row).toContainText("Ilvar Thorne is typing…");
  const replied = page.waitForResponse((response) => response.url().endsWith(`/phone/${ILVAR}/send`));
  release();
  await replied;
  // The list reads itself again until he is done, and its preview moves to his last message (his sticker).
  await expect(row).toContainText(/Sticker: tender/iu);
  // Opened again inside the Engine's 30 s cache: the server's page, with her message and his reply.
  await row.click();
  await expect(log).toContainText("Still up?");
  await expect(log).toContainText("Barely. The data kept me company.");
  await expect(close).toHaveAttribute("aria-disabled", "false");
  // Only a thread with no open conversation has nothing to remember.
  await root.getByRole("button", { name: "All messages" }).click();
  await root
    .locator(".of-threads")
    .getByRole("button", { name: /Cassian/ })
    .click();
  await expect(root.getByRole("heading", { level: 1, name: "Cassian" })).toBeFocused();
  await expect(close).toHaveAttribute("aria-disabled", "true");
  await expect(close).toHaveAttribute("title", "There is nothing new to remember yet.");
  await expect(close).toHaveAccessibleDescription("There is nothing new to remember yet.");
});

test("Otome Forge daily messages: the first heartbeat reads nothing again for an old message; a new one reads Home again", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Settings → Connections' daily messages on, and one that landed yesterday, long before Home was read. `events`
  // keeps, in order, each heartbeat with the message it named and each read of Home.
  const stub = createHomeStub();
  const OLD = "2026-11-01T08:00:00.000Z";
  const NEW = "2026-11-02T08:00:00.000Z";
  let latest = OLD;
  const events: string[] = [];
  const answer = stub.answer;
  stub.answer = async (call) => {
    if (call.path === `/api/otome-forge/runs/${RUN}/phone/due`) {
      stub.calls.push(call);
      events.push(`due ${latest}`);
      return { status: 200, json: { status: "waiting", latest: { li: ILVAR, at: latest } } };
    }
    if (call.method === "GET" && call.path.endsWith("/home")) events.push("home");
    const response = await answer(call);
    if (call.path === `/api/otome-forge/runs/${RUN}`) (response.json as Json).view.world.dailyMessages = 3;
    return response;
  };
  await page.clock.install();
  await stubRoutes(page, stub, []);
  const root = await openHome(page);
  await expect(root.getByRole("article", { name: "A note from Ilvar Thorne" })).toContainText(NOTE);
  /** Moves the page's clock a minute at a time until the heartbeat has named `at`. */
  const heartbeat = (at: string) =>
    expect
      .poll(
        async () => {
          await page.clock.fastForward(60_000);
          return events.includes(`due ${at}`);
        },
        { intervals: [250] },
      )
      .toBe(true);
  // The first heartbeat names the old message: Home already read it, so nothing is read again.
  await heartbeat(OLD);
  // A new one lands: the next heartbeat reads Home again, once.
  latest = NEW;
  await heartbeat(NEW);
  await expect.poll(() => events.lastIndexOf("home")).toBeGreaterThan(events.indexOf(`due ${NEW}`));
  const heard = events.slice(events.indexOf(`due ${OLD}`));
  expect(heard.filter((event) => event === "home")).toHaveLength(1);
});

test("Otome Forge phone: his thread's header keeps Close beside his name on one row, at every width in both looks", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const stub = createHomeStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, []);
  const root = await openHome(page);
  await root.getByRole("button", { name: /Messages/ }).click();
  await root
    .locator(".of-threads")
    .getByRole("button", { name: /Ilvar Thorne/ })
    .click();
  const title = root.getByRole("heading", { level: 1, name: "Ilvar Thorne" });
  await expect(title).toBeFocused();
  // Its label is just "Close"; its accessible name and tooltip still say it remembers the talk.
  const close = root.getByRole("button", { name: "Close and remember" });
  await expect(close).toHaveText("Close");
  await expect(close).toHaveAttribute("title", "Close and remember");
  const back = root.getByRole("button", { name: "All messages" });
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [1280, 800],
  ] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme, reducedMotion: colorScheme === "dark" ? "reduce" : "no-preference" });
      const where = `${width} px, ${colorScheme}`;
      await expect(close).toBeInViewport();
      const [head, name, button, backButton] = await Promise.all(
        [root.locator(".of-thread-head"), title, close, back].map(async (item) => (await item.boundingBox())!),
      );
      const middle = (box: { y: number; height: number }) => box.y + box.height / 2;
      // One row: Close, the back button and his name share a line, and the header is no taller than one control.
      expect(Math.abs(middle(button!) - middle(name!)), where).toBeLessThan(8);
      expect(Math.abs(middle(backButton!) - middle(name!)), where).toBeLessThan(8);
      expect(head!.height, where).toBeLessThan(64);
      expect(button!.x, where).toBeGreaterThan(name!.x + name!.width - 1);
      expect(head!.x + head!.width, where).toBeLessThanOrEqual(width);
      // 44 px touch targets.
      for (const target of [button!, backButton!]) {
        expect(target.height, where).toBeGreaterThanOrEqual(44);
        expect(target.width, where).toBeGreaterThanOrEqual(44);
      }
      // His name never wraps: it ends in an ellipsis when it runs out of room.
      const fits = await title.evaluate((element) => ({
        lines: Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)),
        clipped: element.scrollWidth > element.clientWidth,
        ellipsis: getComputedStyle(element).textOverflow,
      }));
      expect(fits.lines, where).toBe(1);
      expect(fits.ellipsis, where).toBe("ellipsis");
      if (width === 320) expect(fits.clipped, where).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`thread-head-${width}-${colorScheme}.png`) });
    }
  }
  // Keyboard: from his name, Tab reaches Close, and Enter opens its dialog.
  await title.focus();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Close and remember?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  // "You unlocked a new sticker" landing while his thread is open (the close reads the run again) sits below its
  // header, so his name and Close stay in view.
  await page.setViewportSize({ width: 320, height: 640 });
  stub.stickerState.unlock = true;
  await close.click();
  await dialog.getByRole("button", { name: "Close and remember" }).click();
  const toast = root.locator(".of-toasts--app .of-toast");
  await expect(toast).toContainText("You unlocked a new sticker · Ilvar Thorne");
  const [toastBox, headBox] = await Promise.all([toast.boundingBox(), root.locator(".of-thread-head").boundingBox()]);
  expect(toastBox!.y).toBeGreaterThanOrEqual(headBox!.y + headBox!.height);
  await page.screenshot({ path: testInfo.outputPath("thread-head-sticker-notice.png") });
  expect(pageErrors).toEqual([]);
});

test("Otome Forge Home without images, at reduced motion, during a rupture: initials, cold lines, Rough day?", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const stub = createHomeStub({ images: false, rupture: true, noteFailures: 1 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, []);
  const root = await openHome(page);
  await recordSpeech(page);

  // His initials on his accent colour before the gradient alone, with labelled tap buttons; nothing breathes, drifts or
  // follows the pointer.
  await expect(root.locator(".of-home-l0")).toHaveCount(1);
  await expect(root.locator(".of-home-backdrop")).toHaveCount(0);
  // A rupture: before his note, his face is cold (named, as nothing is painted).
  const figure = root.getByRole("img", { name: "Ilvar Thorne, cold", exact: true });
  await expect(figure).toHaveText("IT");
  const breathe = root.locator(".of-figure-breathe");
  expect(await breathe.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  const home = root.locator(".of-home");
  const box = (await home.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.8);
  expect(await root.locator(".of-figure-parallax").evaluate((element) => getComputedStyle(element).transform)).toBe(
    "none",
  );

  // The note failed once: Home says so and waits for Try again (no second request by itself).
  const note = root.getByRole("article", { name: "A note from Ilvar Thorne" });
  await expect(note).toContainText("Ilvar Thorne’s note could not be written.");
  await page.waitForTimeout(600);
  expect(posts(stub, "/home/note")).toHaveLength(1);
  await note.getByRole("button", { name: "Try again" }).click();
  await expect(note).toContainText(NOTE);
  expect(posts(stub, "/home/note")).toHaveLength(2);

  // A rupture: every tap is one of the cold lines (the catalog's, as his pack doesn't exist yet). No request.
  const requests = apiRequests(page);
  await root.getByRole("group", { name: "Touch Ilvar Thorne" }).getByRole("button", { name: "Hand" }).click();
  const bubble = root.locator(".of-home-bubble");
  await expect(bubble).toHaveAttribute("data-mode", "cold");
  expect(fallback("cold")).toContain(await bubble.textContent());

  // Rough day?: one of the catalog's comfort lines, with no model call.
  await root.getByRole("button", { name: "Rough day?" }).click();
  const sheet = page.getByRole("dialog", { name: "For a rough day" });
  const comfort = fallback("comfort").map((line) => `“${line}”`);
  expect(comfort).toContain(await sheet.locator(".of-comfort-line").textContent());
  // Played in his voice with no cache key: comfort never lands in the Engine's audio cache.
  const before = (await voiced(page)).length;
  await sheet.getByRole("button", { name: "Hear Ilvar Thorne say it" }).click();
  await expect.poll(async () => (await voiced(page)).length).toBe(before + 1);
  const comfortVoice = (await voiced(page)).at(-1)!;
  expect(comfort).toContain(`“${comfortVoice.text}”`);
  expect(comfortVoice.voice).toBe("Ilvar Voice");
  expect(comfortVoice.cacheKey).toBeUndefined();
  await sheet.getByRole("button", { name: "Another" }).click();
  expect(comfort).toContain(await sheet.locator(".of-comfort-line").textContent());
  await page.screenshot({ path: testInfo.outputPath("06-rough-day.png") });
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(root.getByRole("button", { name: "Rough day?" })).toBeFocused();
  expect(requests).toEqual([]);

  // Who's home: Cassian, saved; his own note is asked for.
  await root.getByRole("button", { name: "Who’s home" }).click();
  await page
    .getByRole("dialog", { name: "Who’s home" })
    .getByRole("button", { name: /Cassian/ })
    .click();
  await expect(root.getByRole("heading", { level: 1, name: "Cassian" })).toBeVisible();
  expect(posts(stub, "/home/set").at(-1)!.body).toMatchObject({ li: CASSIAN });
  await expect(root.getByRole("article", { name: "A note from Cassian" })).toContainText("The canals froze at dawn.");
  await expect(root.getByRole("button", { name: "Home with Cassian" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("07-no-images.png") });
  expect(pageErrors).toEqual([]);
});

/**
 * Phone sizes from 360 to 430 px wide and 600 to 900 px tall. At 390 × 664 without images the nameplate once covered
 * two of his three tap pills, and the rail covered the edge of a tap zone beside it at common heights.
 */
const PHONE_SIZES = [
  { width: 390, height: 664 },
  { width: 360, height: 600 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 900 },
  { width: 430, height: 740 },
];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
const overlaps = (a: Box, b: Box) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 &&
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;

/**
 * Every tap zone or pill on Home, and what could cover one: the note, each rail button, the nameplate, the top bar and
 * the dock (its raised Wish too). A target must also take a tap at its centre.
 */
function homeLayout(root: Locator) {
  return root.evaluate((element) => {
    const scope = element.getRootNode() as Document | ShadowRoot;
    const box = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const named = (selector: string, name: (node: Element) => string) =>
      [...element.querySelectorAll(selector)].map((node) => ({ name: name(node), box: box(node) }));
    const label = (node: Element) => (node.getAttribute("aria-label") ?? node.textContent ?? "").trim().slice(0, 24);
    const targets = [...element.querySelectorAll(".of-tap-zone, .of-tap-pill")].map((node) => {
      const rect = node.getBoundingClientRect();
      const hit = scope.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { name: label(node), box: box(node), hit: !!hit && node.contains(hit) };
    });
    return {
      targets,
      /** How much of the note's own words shows (it scrolls when the stage is short). */
      noteText: element.querySelector(".of-note-text")?.clientHeight ?? 0,
      /** #2087: the taped photo, inside the scrolling text so the words wrap around it. */
      photo: (() => {
        const print = element.querySelector(".of-note-text > .of-note-photo");
        const text = element.querySelector(".of-note-text");
        if (!print || !text) return null;
        const words = text.querySelector("p")!;
        const range = document.createRange();
        range.selectNodeContents(words);
        const first = range.getClientRects()[0];
        const shown = print.getBoundingClientRect();
        const box = text.getBoundingClientRect();
        return {
          left: shown.left,
          right: shown.right,
          top: shown.top,
          lineLeft: first?.left ?? 0,
          lineRight: first?.right ?? 0,
          boxLeft: box.left,
          boxRight: box.right,
        };
      })(),
      // M6's round Remind Me and Caring message share a row at the rail's foot: each counts as a button of its own.
      rail: named(".of-home-rail > :not(.of-home-rail-row), .of-home-rail-row > *", (node) => `rail: ${label(node)}`),
      covers: [
        ...named(".of-note", () => "note"),
        ...named(".of-home-plate", () => "nameplate"),
        ...named(".of-topbar", () => "top bar"),
        ...named(".of-dock, .of-dock-item", (node) => `dock: ${label(node)}`),
      ],
      /** M4: the line he noticed about her look, on Me. */
      noticed: named(".of-home-noticed .of-noticed", () => "noticed line"),
      /** The figure itself: his art, or the medallion without it. */
      figure: named(".of-figure-img, .of-figure-medallion", () => "figure"),
      body: box(element.querySelector(".of-stage-body")!),
    };
  });
}

/** The same checks on a desktop window, where the stage stands 9:16 in the middle. */
const SIZES = [...PHONE_SIZES, { width: 1280, height: 800 }];

/**
 * M6's rail ends with Remind Me, always, and Caring message beside it on a day the period tracker marks: this logs a
 * period that began the day before (UTC, so day 1 to 3 in any zone) as another tab would, through a `storage` event.
 */
async function showCaringMessage(page: Page, root: Locator) {
  await page.evaluate(() => {
    const key = "otome-forge:cycle:v1";
    const starts = [new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)];
    const cycle = { version: 1, enabled: true, mode: "send-today", cycleLength: 28, periodLength: 5, irregular: false };
    localStorage.setItem(key, JSON.stringify({ ...cycle, starts }));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
  await expect(root.getByRole("button", { name: "Caring message" })).toBeVisible();
}

// #2087: the same sweep again with a Photo Shoot photo taped into the note.
for (const [images, photo] of [
  [true, false],
  [false, false],
  [true, true],
] as const) {
  for (const look of ["dark", "light"] as const) {
    test(`Otome Forge Home at phone sizes (${images ? "painted" : "no images"}${photo ? ", a photo in the note" : ""}, ${look === "dark" ? "Midnight" : "Pearl"}): nothing covers a tap zone or pill`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: look });
      const stub = createHomeStub({ images, photo });
      await stubRoutes(page, stub, []);
      const root = await openHome(page);
      await expect(root.getByRole("article", { name: "A note from Ilvar Thorne" })).toContainText(NOTE);
      await expect(root.locator(images ? ".of-tap-zone" : ".of-tap-pill")).toHaveCount(3);

      await expect(root.getByRole("button", { name: "Remind Me" })).toBeVisible();
      await expect(root.getByRole("button", { name: "Caring message" })).toHaveCount(0);
      for (const caring of [false, true]) {
        if (caring) await showCaringMessage(page, root);
        for (const size of SIZES) {
          await page.setViewportSize(size);
          await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
          const layout = await homeLayout(root);
          const at = `${size.width}x${size.height}${caring ? " with Caring message" : ""}`;
          expect(layout.targets, at).toHaveLength(3);
          expect(layout.rail, at).toHaveLength(caring ? 6 : 5);
          expect(layout.rail.map((button) => button.name).slice(4), at).toEqual(
            caring ? ["rail: Remind Me", "rail: Caring message"] : ["rail: Remind Me"],
          );
          // He shows, art or medallion: on the real Engine's 360 x 600 stage his cell once kept 128 px while its
          // cqh read 0, and he shrank to nothing.
          expect(layout.figure, at).toHaveLength(1);
          expect(
            layout.figure[0].box.width >= 24 && layout.figure[0].box.height >= 24,
            `his figure shows at ${at}`,
          ).toBe(true);
          // The note keeps at least a line of its words in view.
          expect(layout.noteText, `the note's words at ${at}`).toBeGreaterThanOrEqual(24);
          if (photo) {
            // The print is inside the note's text, at its end, and its first line of words stops before it.
            expect(layout.photo, `the photo in the note at ${at}`).not.toBeNull();
            expect(layout.photo!.lineRight, `the first line wraps around the photo at ${at}`).toBeLessThanOrEqual(
              layout.photo!.left + 1,
            );
            expect(layout.photo!.right, `the photo stays in the note at ${at}`).toBeLessThanOrEqual(
              layout.photo!.boxRight + 1,
            );
          } else {
            expect(layout.photo, at).toBeNull();
          }
          for (const target of layout.targets) {
            const big = target.box.width >= 24 && target.box.height >= 24;
            expect(big, `${target.name} is at least 24 px square at ${at}`).toBe(true);
            expect(target.hit, `${target.name} takes a tap at ${at}`).toBe(true);
            const inside =
              target.box.x >= layout.body.x - 0.5 &&
              target.box.y >= layout.body.y - 0.5 &&
              target.box.x + target.box.width <= layout.body.x + layout.body.width + 0.5 &&
              target.box.y + target.box.height <= layout.body.y + layout.body.height + 0.5;
            expect(inside, `${target.name} on the stage at ${at}`).toBe(true);
            for (const cover of [...layout.covers, ...layout.rail]) {
              expect(overlaps(target.box, cover.box), `${cover.name} over ${target.name} at ${at}`).toBe(false);
            }
          }
          // Every rail button, M6's two included: clear of the note (its Play and Reply inside it), the nameplate, the
          // top bar and the dock.
          for (const button of layout.rail) {
            for (const cover of layout.covers) {
              expect(overlaps(button.box, cover.box), `${cover.name} and ${button.name} at ${at}`).toBe(false);
            }
          }
        }
      }
    });
  }
}

for (const cleanup of ["pending", "failed"] as const) {
  test(`Otome Hearth phone: an old face sticker in a bubble keeps its original face when cleanup is ${cleanup}`, async ({
    page,
  }, testInfo) => {
    const stub = createHomeStub({ faceCutouts: true });
    stub.notes.set(ILVAR, {
      li: ILVAR,
      dayKey: new Date().toISOString().slice(0, 10),
      text: NOTE,
      face: "tender",
      mood: { word: "fond", reason: "You came back" },
      curt: false,
      at: new Date().toISOString(),
    });
    const answer = stub.answer;
    stub.answer = async (call) => {
      const response = await answer(call);
      if (call.path === `/api/otome-forge/runs/${RUN}`) {
        const view = (response.json as Json).view;
        Object.assign(view.lis[0], { portrait: PORTRAIT_CUT, expressions: { tender: TENDER }, cut: [PORTRAIT_CUT] });
        view.cutoutsPending = cleanup === "pending";
      }
      if (call.path.endsWith("/home")) {
        (response.json as Json).faces = {
          tender: { url: TENDER, cutoutState: cleanup === "pending" ? "pending" : "uncut" },
        };
      }
      if (call.path === `/api/otome-forge/runs/${RUN}/phone/${ILVAR}`) {
        const messages = (response.json as Json).messages;
        Object.assign(messages.at(-1), { text: "", sticker: "tender" });
      }
      return response;
    };
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await stubRoutes(page, stub, []);
    const root = await openHome(page);
    await expect(root.locator(".of-figure-img").last()).toHaveAttribute("src", PORTRAIT_CUT);
    await expect(root.locator(`.of-figure-img[src="${TENDER}"]`)).toHaveCount(0);
    await root.getByRole("button", { name: /Messages/ }).click();
    await root
      .locator(".of-threads")
      .getByRole("button", { name: /Ilvar Thorne/ })
      .click();
    const log = root.getByRole("list", { name: "Messages with Ilvar Thorne" });
    await expect(log.getByRole("img", { name: "Sticker: Tender" })).toHaveAttribute("src", TENDER);
    await expect(log.getByRole("img", { name: "Sticker: Tender" })).toBeVisible();
    // #2044: the picker offers her stickers and his, never his faces.
    await root.getByRole("button", { name: "Stickers" }).click();
    await expect(root.getByRole("button", { name: "Send the Laughing sticker" })).toBeVisible();
    await expect(root.getByRole("button", { name: "Send the Tender sticker" })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`phone-original-sticker-${cleanup}.png`) });
    expect(posts(stub, "/send")).toHaveLength(0);
    expect(stub.calls.filter((call) => call.method === "POST" && call.path.includes("/art/"))).toHaveLength(0);
  });
}

for (const outcome of ["ready", "uncut", "load-error"] as const) {
  test(`Otome Hearth Home expressions retain a clean neutral when cleanup is ${outcome}`, async ({
    page,
  }, testInfo) => {
    // His earlier neutral cut-out stays available; the offending raw expression is never removed from its descriptor.
    const stub = createHomeStub({ faceCutouts: true });
    stub.notes.set(ILVAR, {
      li: ILVAR,
      dayKey: new Date().toISOString().slice(0, 10),
      text: NOTE,
      face: "tender",
      mood: { word: "fond", reason: "You came back" },
      curt: false,
      at: new Date().toISOString(),
    });
    let phase: "pending" | "ready" | "uncut" = "pending";
    const broken = "/api/avatars/file/missing-clean-expression.png";
    await page.route(`**${broken}`, (route) => route.fulfill({ status: 404, body: "Missing cut-out" }));
    const answer = stub.answer;
    stub.answer = async (call) => {
      const response = await answer(call);
      if (call.path === `/api/otome-forge/runs/${RUN}`) {
        const view = (response.json as Json).view;
        view.lis[0].expressions = { tender: TENDER };
        view.lis[0].cut = [PORTRAIT_CUT];
      }
      if (call.path.endsWith("/home")) {
        (response.json as Json).faces = {
          tender: {
            url: TENDER,
            cutoutState: phase,
            ...(phase === "ready" ? { cutout: outcome === "load-error" ? broken : TENDER_CUT } : {}),
          },
        };
      }
      return response;
    };
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.clock.install();
    const spoken: string[] = [];
    await stubRoutes(page, stub, spoken);
    const root = await openHome(page);
    const figure = root.getByRole("img", { name: "Ilvar Thorne, tender" });
    await expect(figure).toHaveAttribute("src", PORTRAIT_CUT);
    await expect(root.locator('.of-figure[data-cut="true"]')).toHaveCount(1);
    await expect(root.locator(`.of-figure-img[src="${TENDER}"]`)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("home-expression-pending-neutral.png") });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
    const reads = () => stub.calls.filter((call) => call.method === "GET" && call.path.endsWith("/home")).length;
    const before = reads();
    const completedResponse = page.waitForResponse(async (response) => {
      if (!new URL(response.url()).pathname.endsWith("/home") || response.status() !== 200) return false;
      return (await response.json()).faces.tender.cutoutState !== "pending";
    });
    phase = outcome === "uncut" ? "uncut" : "ready";
    await page.clock.runFor(10_500);
    await (await completedResponse).finished();
    let drained = 0;
    await expect
      .poll(
        async () => {
          if (drained++ < 100) await page.clock.runFor(1);
          return figure.getAttribute("src");
        },
        { intervals: [100], timeout: 10_000 },
      )
      .toBe(outcome === "ready" ? TENDER_CUT : PORTRAIT_CUT);
    await expect(root.locator('.of-figure[data-cut="true"]')).toHaveCount(1);
    await expect(root.locator(`.of-figure-img[src="${TENDER}"]`)).toHaveCount(0);
    expect(reads()).toBeGreaterThan(before);
    await page.screenshot({ path: testInfo.outputPath(`home-expression-${outcome}.png`) });
    const completed = reads();
    await page.clock.runFor(20_000);
    expect(reads(), "ready or unavailable cleanup stops Home polling").toBe(completed);
    expect(stub.calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toHaveLength(0);
    expect(spoken).toEqual([]);
  });
}

test("Otome Forge Home wears what the Wardrobe put on: his look cut out, hers on Me with the line he noticed", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const stub = createHomeStub({ worn: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, []);
  const root = await openHome(page);

  // Him: the cut-out of the look he wears, not his base portrait (its faces are not painted yet).
  const him = root.getByRole("img", { name: "Ilvar Thorne, tender" });
  await expect(him).toHaveAttribute("src", HIS_WORN_CUT);
  await expect(root.locator('.of-figure[data-art="look"][data-cut="true"]')).toHaveCount(1);
  await expect(root.locator(".of-home-noticed")).toHaveCount(0);

  // Me: her look, uncut (never her persona's avatar while she wears one); the line he noticed is still being
  // written, so Home asks again until it lands, and says it.
  await root.getByRole("radio", { name: "Ilvar" }).focus();
  await page.keyboard.press("ArrowRight");
  const me = root.getByRole("img", { name: "You, Mira Vale" });
  await expect(me).toHaveAttribute("src", HER_WORN);
  await expect(root.locator('.of-figure[data-art="look"][data-cut="false"]')).toHaveCount(1);
  const noticed = root.locator(".of-home-noticed");
  await expect(noticed).toHaveAttribute("aria-live", "polite");
  await expect(noticed).toContainText("Ilvar Thorne noticed", { timeout: 15_000 });
  await expect(noticed).toContainText(NOTICED_LINE);
  await page.screenshot({ path: testInfo.outputPath("m4-me-noticed.png") });

  // Him again: the line belongs to her side.
  await page.keyboard.press("ArrowLeft");
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();
  await expect(root.locator(".of-home-noticed")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge Home on a small phone: the longest line he noticed stands beside the rail and never pushes it up", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // A phone with its browser bars showing, the longest note and the longest noticed line.
  await page.setViewportSize({ width: 390, height: 664 });
  const stub = createHomeStub({ worn: true, firstNote: LONG_NOTE, noticedLine: LONG_NOTICED });
  await stubRoutes(page, stub, []);
  const root = await openHome(page);
  const note = root.getByRole("article", { name: "A note from Ilvar Thorne" });
  await expect(note).toContainText(LONG_NOTE);
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const rail = root.locator(".of-home-rail");
  const line = root.locator(".of-home-noticed .of-noticed");

  // Me, while the line is still being written: where the rail stands with nothing beside it.
  await root.getByRole("radio", { name: "Ilvar" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(root.getByRole("heading", { level: 1, name: "Mira Vale" })).toBeVisible();
  await expect(line).toHaveCount(0);
  const railBefore = await box(rail);
  await expect(line).toHaveCount(0);

  // The line lands beside the rail: the rail stays where it stood (the bottom row does not grow and push it up onto
  // the note), and the line touches neither the note, the rail nor her name.
  await expect(line).toContainText(LONG_NOTICED, { timeout: 15_000 });
  await page.screenshot({ path: testInfo.outputPath("m4-me-noticed-390x664.png") });
  const [noteBox, railBox, lineBox, plateBox] = await Promise.all([
    box(note),
    box(rail),
    box(line),
    box(root.locator(".of-home-plate")),
  ]);
  expect(railBox).toEqual(railBefore);
  expect(overlap(lineBox, noteBox)).toBe(false);
  expect(overlap(lineBox, railBox)).toBe(false);
  expect(overlap(lineBox, plateBox)).toBe(false);
});

/** Desktop sizes beside the phone ones: the project's own, and a short laptop screen. */
const DESKTOP_SIZES = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

for (const images of [true, false]) {
  test(`Otome Forge Home on Me at phone and desktop sizes (${images ? "painted" : "no images"}): the longest line he noticed covers nothing`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const stub = createHomeStub({ images, worn: true, firstNote: LONG_NOTE, noticedLine: LONG_NOTICED });
    await stubRoutes(page, stub, []);
    const root = await openHome(page);
    await expect(root.getByRole("article", { name: "A note from Ilvar Thorne" })).toContainText(LONG_NOTE);
    await root.getByRole("radio", { name: "Ilvar" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(root.locator(".of-home-noticed .of-noticed")).toContainText(LONG_NOTICED, { timeout: 15_000 });

    // M6's rail: Remind Me always, and Caring message beside it on a day the period tracker marks.
    await expect(root.getByRole("button", { name: "Remind Me" })).toBeVisible();
    for (const caring of [false, true]) {
      if (caring) await showCaringMessage(page, root);
      for (const size of [...PHONE_SIZES, ...DESKTOP_SIZES]) {
        await page.setViewportSize(size);
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
        const layout = await homeLayout(root);
        const at = `${size.width}x${size.height}${caring ? " with Caring message" : ""}`;
        expect(layout.noticed, at).toHaveLength(1);
        expect(layout.rail, at).toHaveLength(caring ? 6 : 5);
        expect(layout.rail.map((button) => button.name).slice(4), at).toEqual(
          caring ? ["rail: Remind Me", "rail: Caring message"] : ["rail: Remind Me"],
        );
        expect(layout.noteText, `the note's words at ${at}`).toBeGreaterThanOrEqual(24);
        const [line] = layout.noticed;
        const inside =
          line.box.x >= layout.body.x - 0.5 &&
          line.box.y >= layout.body.y - 0.5 &&
          line.box.x + line.box.width <= layout.body.x + layout.body.width + 0.5 &&
          line.box.y + line.box.height <= layout.body.y + layout.body.height + 0.5;
        expect(inside, `the noticed line on the stage at ${at}`).toBe(true);
        // The note holds its Play and Reply, so clear of the note is clear of them.
        for (const cover of [...layout.covers, ...layout.rail]) {
          expect(overlaps(line.box, cover.box), `${cover.name} and the noticed line at ${at}`).toBe(false);
        }
        // The rail stays clear of the note, the top bar and the dock with the line beside it.
        for (const button of layout.rail) {
          for (const cover of layout.covers.filter((item) => item.name !== "nameplate")) {
            expect(overlaps(button.box, cover.box), `${cover.name} and ${button.name} at ${at}`).toBe(false);
          }
        }
      }
    }
  });
}
