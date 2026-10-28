// Otome Forge's Dates and Claw Machine (M5) in the Engine's Home tab, with /api/otome-forge/** stubbed: the Dates hub
// (who to spend time with, the three activities with their pay and cost, today's caps, the shelf), then a full Claw
// round at phone width played by keyboard: his turn first, cheering until his cheat (a nudge) goes off with his own
// line, her drops, the round paid once (a lost answer retried with the same round), the shelf with what is new, the
// Starlight in the top bar, and sounds through the Engine's player; then a round in motion, steered by holding the
// arrow and the buttons, with the claw swinging, dropping and carrying; then a Read Him set played by keyboard, where
// nothing marks the true reading before it is answered, focus follows each moment, and a tell is learned. Across them,
// the merge with M2b and M3: his claw lines and his Read Him lines are voiced in his card's voice (M2b's audio), each
// moment shows the painted face it names, his plush wears his Home cut-out (M3), and Date Night's picker offers a
// place the story painted, over its picture, beside its own cards (each one visible, apart from the reader's layer).
// His lines come with GET /play, so the machine never asks for GET .../lines (which may queue a pack's write); its
// sounds play at the world's sound-effect volume and never while Mute everything is on; during a rupture his lines are
// Home's cold ones, voiced under Home's own ref; and the Date Night card says what it may paint.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-claw.e2e.ts
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
  body: Json | undefined;
}

const RUN = "r-e2e-claw01";
const KAI = "li-kai-0001";
const MIR = "li-mireille-0002";
const CHEAT_LINE = "Oops. My elbow. Into the machine.";
/** His fixed claw lines (GET /play's `lines.claw`). */
const KAI_CLAW = {
  cheer: ["Left a touch. Trust your hands."],
  cheat: [CHEAT_LINE],
  win: ["Ha. Ours."],
  miss: ["The claw is rigged."],
  plush: ["Another friend for the shelf."],
};
/** His cold lines (Home's, during a rupture). */
const COLD_LINES = ["Fine. Your turn.", "Whatever you like."];
const SERIES = ["chick", "bunny", "kitty", "star", "bear", "whale"];
const READ_SET = "rh-e2e01-abc123";
const FILE = "/api/global-gallery/file";
const LOOK = `${FILE}/kai-look.png`;
const CUTOUT = `${FILE}/kai-cut.png`;
const COLD = `${FILE}/kai-cold.png`;
const PLACE_ART = `${FILE}/conservatory.png`;
/** A 1×1 PNG for every gallery image the stub names. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
/** Five moments; the true reading moves around, and two rounds give away a tell when read right. */
const READ_ROUNDS = [1, 0, 2, 1, 0].map((trueIndex, round) => ({
  context: `Moment ${round + 1}: Kai Ardent waits by the frozen canal lock.`,
  line: "You're late. The clocks don't wait.",
  face: round % 2 ? "" : "cold",
  readings: [0, 1, 2].map((option) =>
    option === trueIndex ? `Glad you came (${round + 1})` : `Decoy ${option} (${round + 1})`,
  ),
  trueIndex,
  thought: `I counted the bells until you came (${round + 1}).`,
  tell: round === 0 ? "Winds a pocket watch" : round === 3 ? "Hums off-key" : null,
}));

/** The M5 routes this screen uses, answered in memory by the server's rules (S/routes/claw.ts). */
function createClawStub({ finishFailures = 0, rupture = false, audio = { tts: true, sfxVolume: 0.3 } as Json } = {}) {
  const calls: Call[] = [];
  const now = () => new Date().toISOString();
  const they = { subject: "they", object: "them", possessive: "their" };
  const she = { subject: "she", object: "her", possessive: "her" };
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
      images: { connectionId: null, rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
      // Voices on (Settings → Audio, M2b), so his lines are voiced through the Engine's voice service.
      audio,
      // A place the story painted (M2b): Date Night offers it over its picture.
      places: {
        "the-glass-conservatory": {
          name: "The Glass Conservatory",
          tags: "glasshouse, ferns, rain, no humans",
          art: { state: "ready", at: now(), url: PLACE_ART },
        },
      },
    },
    player: {
      personaId: "persona-mira",
      name: "Mira Vale",
      pronouns: she,
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
    },
    lis: [
      {
        id: KAI,
        name: "Kai Ardent",
        pronouns: they,
        source: "card",
        cardId: "card-kai",
        voiceGender: "",
        accent: "#9DB8F0",
        portrait: LOOK,
        // His painted faces for the look he wears (M2b), the set ready.
        expressions: Object.fromEntries(
          ["tender", "flustered", "cold", "hurt", "angry"].map((face) => [face, `${FILE}/kai-${face}.png`]),
        ),
        level: 2,
        stage: 1,
      },
      { id: MIR, name: "Mireille", pronouns: she, source: "archetype", accent: "#E7A6B8", level: 1, stage: 1 },
    ],
    forge: { phase: "ready", steps: [] },
    starlight: 2000,
  };
  const index = {
    version: 1,
    runs: [{ runKey: RUN, title: "The Clockwork Masquerade", createdAt: now(), lastPlayedAt: null }],
    activeRun: RUN,
    ageGate: null,
    lastOpenedAt: null,
  };
  const plush: Record<string, number> = {};
  const paid = new Map<string, Json>();
  const earned = { starlight: 0, affection: {} as Record<string, number> };
  let failuresLeft = finishFailures;
  const picks: Array<number | undefined> = [];
  let readPaid = false;

  const answer = async (call: Call): Promise<{ status: number; json: unknown }> => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (path === base) return { status: 200, json: { view: structuredClone(view) } };
    if (path === `${base}/home`) {
      const note = {
        li: KAI,
        dayKey: now().slice(0, 10),
        text: "Canals froze.",
        face: "",
        mood: { word: "calm", reason: "frost" },
        curt: false,
        at: now(),
      };
      return {
        status: 200,
        json: { li: KAI, show: "him", note, look: null, faces: {}, lines: { ready: true }, rupture: false, unread: 0 },
      };
    }
    // Home's read of his lines (it may queue a pack's write): the claw machine never asks for it.
    if (/^\/runs\/[^/]+\/lis\/[^/]+\/lines$/u.test(path)) {
      return {
        status: 200,
        json: { ready: true, stage: 1, rupture, tap: null, annoyed: [], cold: COLD_LINES, comfort: [], claw: null },
      };
    }
    if (path === `${base}/play`) {
      return {
        status: 200,
        json: {
          dayKey: now().slice(0, 10),
          starlight: { earned: earned.starlight, cap: 400 },
          affection: { earned: { ...earned.affection }, cap: 300 },
          plush: { ...plush },
          lis: {
            [KAI]: {
              cheat: "nudge",
              style: "Plays to an audience, all flourish and a wink.",
              rupture,
              makeItRight: rupture,
              // His look's Home cut-out (M3), which his plush wears.
              plush: CUTOUT,
              lines: { claw: KAI_CLAW, cold: COLD_LINES },
            },
            [MIR]: {
              cheat: "calculate",
              style: "Calculates the angle aloud.",
              rupture: false,
              makeItRight: false,
              lines: { claw: null, cold: [] },
            },
          },
        },
      };
    }
    if (path === `${base}/claw/finish`) {
      const body = call.body!;
      if (!/^c-[0-9a-z]{1,12}-[0-9a-z]{6}$/u.test(body.round)) return { status: 400, json: { code: "bad-request" } };
      const allowed = new Set([...SERIES, `li:${body.li}`]);
      if (body.caught.length > 7 || body.caught.some((entry: Json) => !allowed.has(entry.prize))) {
        return { status: 400, json: { code: "bad-request" } };
      }
      // A round already paid answers the same again, paying nothing.
      const kept = paid.get(body.round);
      if (kept) return { status: 200, json: { ...kept, replay: true } };
      const starlight = 20 + 30 * body.caught.length;
      const newPlush: string[] = [];
      for (const { prize } of body.caught) {
        if (!plush[prize]) newPlush.push(prize);
        plush[prize] = (plush[prize] ?? 0) + 1;
      }
      view.starlight += starlight;
      earned.starlight += starlight;
      earned.affection[body.li] = (earned.affection[body.li] ?? 0) + 30;
      const result = {
        grants: [
          { source: "claw", starlight },
          { source: "claw", li: body.li, affection: 30 },
        ],
        newPlush,
        firstPlush: newPlush.includes(`li:${body.li}`),
        ...(newPlush.includes(`li:${body.li}`) ? { line: "It has my frown. Keep it close." } : {}),
        capped: false,
        replay: false,
        plush: { ...plush },
        starlight: view.starlight,
      };
      paid.set(body.round, result);
      if (failuresLeft > 0) {
        // Saved, but the answer was lost on the way back.
        failuresLeft -= 1;
        return { status: 503, json: { error: "The answer was lost.", code: "no-connection" } };
      }
      return { status: 200, json: result };
    }
    // Date Night (S/routes/dates.ts): no date yet; planning one is refused here (the picker is what is under test).
    if (path === `${base}/dates` && call.method === "GET") {
      return {
        status: 200,
        json: {
          lis: [KAI, MIR].map((li) => ({ li, rupture: false, open: null })),
          dates: [],
        },
      };
    }
    if (path === `${base}/dates`) return { status: 503, json: { error: "No connection.", code: "no-connection" } };
    // Read Him (S/routes/read-him.ts): a round's truth, thought and tell only in its answer; the first pick stands.
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
      if (READ_ROUNDS.some((_, round) => picks[round] === undefined)) {
        return { status: 409, json: { error: "Answer every round before finishing.", code: "conflict" } };
      }
      if (!readPaid) {
        readPaid = true;
        view.starlight += 40;
        earned.starlight += 40;
      }
      return {
        status: 200,
        json: {
          grants: [
            { source: "read-him", starlight: 40 },
            { source: "read-him", li: KAI, affection: 40 },
          ],
          starlight: view.starlight,
        },
      };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer, view, plush };
}

type Stub = ReturnType<typeof createClawStub>;

async function stubRoutes(page: Page, stub: Stub) {
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
  // Sounds come through the Engine's player from its game-assets library; a silent answer here.
  await page.route("**/api/game-assets/**", (route) => route.fulfill({ json: { assets: {} } }));
  await page.route(`**${FILE}/**`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  // The Engine's voice routes: his card's assigned voice, the pools, and a silent clip for each line.
  await page.route("**/api/tts/config", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        connectionId: "conn-tts",
        connectionProfiles: {
          "conn-tts": {
            voiceAssignments: [{ characterId: "card-kai", voice: "Kai Voice" }],
            npcDefaultMaleVoices: ["Pool Male"],
            npcDefaultFemaleVoices: ["Pool Female"],
          },
        },
      },
    }),
  );
  await page.route("**/api/tts/voices*", (route) => route.fulfill({ json: { voices: ["Kai Voice", "Pool Male"] } }));
  await page.route("**/api/tts/speak", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) }).catch(() => undefined),
  );
}

/** Records every line the Engine's voice service is asked to speak, with its voice and cache key. */
async function recordSpeech(page: Page) {
  await page.evaluate(() => {
    const service = (globalThis as any).__MARINARA_HOST__.services.tts.ttsService;
    const speak = service.speakSequence.bind(service);
    (window as any).__spoken = [];
    service.speakSequence = (requests: any[], id: string, options: any) => {
      (window as any).__spoken.push(...requests);
      return speak(requests, id, options);
    };
  });
}
const voiced = (page: Page) => page.evaluate(() => ((window as any).__spoken ?? []) as Json[]);

async function openOtome(page: Page): Promise<Locator> {
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

/**
 * Records each sound the page plays through the Engine's audio player. The Engine defines its host namespace once,
 * frozen and non-writable (packages/client/src/lib/marinara-host.ts), so the recorder wraps the audio service as it is
 * defined: every player a package creates delegates to the Engine's own and notes each tag it is asked to play.
 */
async function recordSounds(page: Page) {
  await page.addInitScript(() => {
    const sounds: string[] = [];
    const volumes: unknown[] = [];
    Object.defineProperty(window, "__otomeSounds", { value: sounds });
    Object.defineProperty(window, "__otomeVolumes", { value: volumes });
    const define = Object.defineProperty;
    const wrap = (host: Json) => {
      const audio = host?.services?.audio;
      if (!audio || typeof audio.createPlayer !== "function") return host;
      const createPlayer = (...args: unknown[]) => {
        const player = audio.createPlayer(...args);
        return Object.freeze({
          ...player,
          playSfx: (tag: string, ...rest: unknown[]) => {
            sounds.push(tag);
            return player.playSfx(tag, ...rest);
          },
          setVolumes: (value: unknown) => {
            volumes.push(value);
            return player.setVolumes(value);
          },
        });
      };
      return Object.freeze({
        ...host,
        services: Object.freeze({ ...host.services, audio: Object.freeze({ ...audio, createPlayer }) }),
      });
    };
    Object.defineProperty = function (target: object, key: PropertyKey, descriptor: PropertyDescriptor) {
      if (target === globalThis && key === "__MARINARA_HOST__" && descriptor && "value" in descriptor) {
        Object.defineProperty = define;
        return define(target, key, { ...descriptor, value: wrap(descriptor.value) });
      }
      return define(target, key, descriptor);
    } as typeof Object.defineProperty;
  });
}

/**
 * Notes every line, cheat banner, announcement and label the claw game shows from now on. His turn is short (3 s at
 * reduced motion), so what it showed is read from these notes rather than raced against his countdown.
 */
async function recordClaw(page: Page) {
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { __clawSeen: Set<string> }).__clawSeen = seen;
    const game = document.querySelector("marinara-capability-otome-forge .of-claw-game");
    if (!game) throw new Error("The claw game is not on the page");
    const note = () => {
      for (const element of game.querySelectorAll(".of-claw-bubble, .of-claw-cheat, [aria-live]")) {
        seen.add(element.textContent ?? "");
      }
      for (const element of game.querySelectorAll(".of-claw-action, .of-claw-glass")) {
        seen.add(element.getAttribute("aria-label") ?? "");
      }
    };
    note();
    new MutationObserver(note).observe(game, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label"],
    });
  });
}

const clawSeen = (page: Page) =>
  page.evaluate(() => [...(window as unknown as { __clawSeen: Set<string> }).__clawSeen]);

const soundsPlayed = (page: Page) =>
  page.evaluate(() => (window as unknown as { __otomeSounds?: string[] }).__otomeSounds ?? []);
const volumesSet = (page: Page) =>
  page.evaluate(() => (window as unknown as { __otomeVolumes?: unknown[] }).__otomeVolumes ?? []);

const finishes = (stub: Stub) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith("/claw/finish"));

/** Plays her turns by keyboard until the round ends: a step right on each, then Space to drop. */
async function playHerTurns(page: Page, root: Locator, action: Locator) {
  const result = root.locator("#of-claw-result-title");
  for (let turn = 0; turn < 12 && !(await result.isVisible()); turn += 1) {
    await expect(action.or(result).first()).toBeVisible();
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
}

test("Otome Forge Dates and a Claw round at phone width: the cheer meter, his cheat, paid once, the shelf", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const stub = createClawStub({ finishFailures: 1 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  await recordSounds(page);
  const root = await openOtome(page);
  await expect(root.getByRole("heading", { level: 1, name: "Kai Ardent" })).toBeVisible();

  // Dates: who Home is about is picked first; each activity names them, with its pay and its cost.
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  const title = root.getByRole("heading", { level: 1, name: "Dates" });
  await expect(title).toBeFocused();
  await expect(root.getByRole("radio", { name: /Kai Ardent/ })).toBeChecked();
  const activities = root.getByRole("list", { name: "Things to do with Kai Ardent" });
  await expect(activities.getByRole("heading", { name: "Read Kai Ardent" })).toBeVisible();
  await expect(activities.getByRole("heading", { name: "Date Night with Kai Ardent" })).toBeVisible();
  await expect(activities.getByRole("heading", { name: "Claw Machine with Kai Ardent" })).toBeVisible();
  await expect(activities.getByRole("button", { name: /^Play: / })).toHaveCount(3);
  await expect(activities).toContainText("No model calls");
  // Date Night's card says what it may paint besides the keepsake: its scenes paint places and faces as any scene does.
  await expect(activities).toContainText(
    "4 model calls · new places and unpainted faces use your image connection · 1 more image for a keepsake",
  );
  await expect(activities).toContainText("+20 Starlight a round, +30 for each plush · +30 affection");
  await expect(root.getByRole("progressbar", { name: "Starlight from activities" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await expect(root.getByRole("list", { name: "Your plush shelf" }).getByRole("listitem")).toHaveCount(8);
  // His plush wears his look's Home cut-out (GET /play's `plush`, M3); Mireille, with no look, her initials.
  await expect(root.locator(".of-shelf image")).toHaveCount(1);
  await expect(root.locator(".of-shelf image")).toHaveAttribute("href", CUTOUT);
  // Nothing in the page is wider than the phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("01-dates.png"), fullPage: true });
  await activities.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("01b-activities.png") });
  await root.getByRole("list", { name: "Your plush shelf" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("01c-shelf.png") });

  // Mireille's activities name her; then back to Kai Ardent.
  // Each love interest is a radio (its card is the label); arrow keys move between them, as in any radio group.
  await root.locator("label.of-partner", { hasText: "Mireille" }).click();
  await expect(root.getByRole("radio", { name: /Mireille/ })).toBeChecked();
  await expect(root.getByRole("list", { name: "Things to do with Mireille" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(root.getByRole("radio", { name: /Kai Ardent/ })).toBeChecked();

  // The Claw Machine: how they play, and who goes first. Nothing in it asks a model for anything.
  const before = stub.calls.length;
  await activities.getByRole("button", { name: "Play: Claw Machine with Kai Ardent" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Claw Machine" })).toBeFocused();
  await expect(root).toContainText("Plays to an audience, all flourish and a wink.");
  await expect(root.getByRole("img", { name: "The claw machine, with 7 plushies left inside" })).toBeVisible();
  await expect(root.locator(".of-claw-glass image")).toHaveAttribute("href", CUTOUT);
  await page.screenshot({ path: testInfo.outputPath("02-intro.png"), fullPage: true });
  await recordSpeech(page);
  await root.getByRole("button", { name: "Kai Ardent first" }).click();

  // His turn: the one action button cheers, and takes focus so the keyboard plays at once.
  const action = root.locator(".of-claw-action");
  await expect(action).toBeFocused();
  await expect(action).toHaveAttribute("data-mode", "cheer", { timeout: 10_000 });
  await expect(action).toHaveAccessibleName("Cheer Kai Ardent on (0 of 8)");
  const meter = root.getByRole("progressbar", { name: "Cheer Kai Ardent on" });
  await recordClaw(page);
  for (let cheer = 0; cheer < 8; cheer += 1) {
    await page.keyboard.press("c");
    await page.waitForTimeout(130);
  }
  // The eighth cheer sets off his cheat, a nudge, with his own line; the meter stays spent for the round.
  await expect(meter).toHaveAttribute("aria-valuenow", "8");
  await expect(root.locator(".of-claw-meter")).toContainText("Kai Ardent cheated!");
  // What his turn showed meanwhile, or shows once its entrance plays (his turn may be over by now): the cheat, his
  // line (in his bubble, and said with what the cheat does), the spent Cheer, a plush gone.
  const shown = (text: string) => async () => (await clawSeen(page)).some((entry) => entry.includes(text));
  await expect.poll(shown("Kai Ardent bumps the machine!")).toBe(true);
  await expect.poll(shown(`Kai Ardent: ${CHEAT_LINE} Kai Ardent bumps the machine!`)).toBe(true);
  await expect.poll(() => clawSeen(page)).toContain("Cheat used: Kai Ardent already cheated");
  await expect.poll(() => clawSeen(page)).toContain("The claw machine, with 6 plushies left inside");
  // His cheat line in his card's voice (M2b's audio), cached under the claw's own ref for its words.
  await expect
    .poll(async () => (await voiced(page)).find((line) => line.text === CHEAT_LINE))
    .toMatchObject({ voice: "Kai Voice", characterId: "card-kai" });
  const cheatVoice = (await voiced(page)).find((line) => line.text === CHEAT_LINE)!;
  expect(cheatVoice.cacheKey).toMatch(new RegExp(`^otome-forge:${RUN}:claw:${KAI}:[0-9a-z]+$`, "u"));
  await page.screenshot({ path: testInfo.outputPath("03-cheat.png"), fullPage: true });

  await playHerTurns(page, root, action);

  // The round ends: focus moves to its result. The first answer was lost; Try again sends the same round.
  const result = root.locator("#of-claw-result-title");
  await expect(result).toBeFocused({ timeout: 30_000 });
  await expect(root.getByRole("alert")).toContainText("No connection is set");
  await root.getByRole("button", { name: "Try again" }).click();
  await expect(root.locator(".of-claw-pay")).toContainText("affection with Kai Ardent");
  const sent = finishes(stub);
  expect(sent).toHaveLength(2);
  expect(sent[1]!.body).toEqual(sent[0]!.body);
  const body = sent[0]!.body!;
  expect(body.li).toBe(KAI);
  expect(body.first).toBe("partner");
  expect(body.cheered).toBe(true);
  expect(body.round).toMatch(/^c-[0-9a-z]{1,12}-[0-9a-z]{6}$/u);
  expect(body.caught.length).toBeGreaterThanOrEqual(1);
  expect(body.caught[0].by).toBe("partner");
  expect(new Set(body.caught.map((entry: Json) => entry.prize)).size).toBe(body.caught.length);
  // Paid once: the stub's wallet moved by one round's pay, and the top bar shows it.
  const pay = 20 + 30 * body.caught.length;
  expect(stub.view.starlight).toBe(2000 + pay);
  await expect(root.locator(".of-starlight")).toContainText((2000 + pay).toLocaleString("en-US"));
  // The shelf: every catch, the new ones marked.
  const shelf = root.getByRole("list", { name: "Your plush shelf" });
  await expect(shelf.locator('[data-new="true"]')).toHaveCount(body.caught.length);
  expect(stub.calls.slice(before).every((call) => !/generate|avatar|chat|note/u.test(call.path))).toBe(true);
  // His lines came with GET /play: nothing asked for GET .../lines, which may queue a model call for a missing pack.
  expect(stub.calls.slice(before).filter((call) => call.path.endsWith("/lines"))).toEqual([]);
  // Sounds go through the Engine's player: the latch of his cheat and of every drop, and the bump of the nudge, at
  // the world's sound-effect volume (Settings → Audio), not the new player's default.
  const sounds = await soundsPlayed(page);
  expect(sounds).toContain("sfx:ui:latch");
  expect(sounds).toContain("sfx:ui:inventory-cloth");
  expect(await volumesSet(page)).toContainEqual({ music: 0, sfx: 0.3 });
  await page.screenshot({ path: testInfo.outputPath("04-result.png"), fullPage: true });

  // Play again starts a new round with a new id; Back returns to Dates with the shelf.
  await root.getByRole("button", { name: "Play again" }).click();
  await expect(action).toBeFocused();
  await root.getByRole("button", { name: "Back" }).first().click();
  await expect(title).toBeFocused();
  await expect(root.getByRole("progressbar", { name: "Starlight from activities" })).toHaveAttribute(
    "aria-valuenow",
    String(pay),
  );
  expect(pageErrors).toEqual([]);
});

/** Opens Dates from Home; Home's own requests are over once its heading has focus. */
async function openDates(root: Locator) {
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
}

/** From Dates, opens the Claw Machine with Kai Ardent, lets him go first, and cheers until his cheat goes off. */
async function cheerUntilHisCheat(page: Page, root: Locator) {
  await root.getByRole("button", { name: "Play: Claw Machine with Kai Ardent" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Claw Machine" })).toBeFocused();
  await recordSpeech(page);
  await root.getByRole("button", { name: "Kai Ardent first" }).click();
  const action = root.locator(".of-claw-action");
  await expect(action).toHaveAttribute("data-mode", "cheer", { timeout: 10_000 });
  for (let cheer = 0; cheer < 8; cheer += 1) {
    await page.keyboard.press("c");
    await page.waitForTimeout(130);
  }
  await expect(root.locator(".of-claw-meter")).toContainText("Kai Ardent cheated!");
}

test("Otome Forge Claw Machine under Mute everything plays no sound, and during a rupture shares Home's cold clips", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Settings → Audio's Mute everything: the machine's own Sound is still on, yet nothing plays.
  const muted = createClawStub({ audio: { tts: true, muted: true } });
  await stubRoutes(page, muted);
  await recordSounds(page);
  let root = await openOtome(page);
  await openDates(root);
  await cheerUntilHisCheat(page, root);
  // His cheat latched and bumped the machine; give its cues time to have played.
  await page.waitForTimeout(600);
  expect(await soundsPlayed(page)).toEqual([]);
  expect(await voiced(page)).toEqual([]);

  // A rupture: his lines are his cold ones from Home, voiced under Home's tap ref, so one clip serves both screens.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const cold = createClawStub({ rupture: true });
  await stubRoutes(page, cold);
  root = await openOtome(page);
  await openDates(root);
  const before = cold.calls.length;
  await cheerUntilHisCheat(page, root);
  await expect.poll(async () => (await voiced(page)).length).toBeGreaterThan(0);
  const lines = await voiced(page);
  expect(lines.every((line) => COLD_LINES.includes(line.text))).toBe(true);
  for (const line of lines) {
    expect(line.cacheKey).toMatch(new RegExp(`^otome-forge:${RUN}:tap:${KAI}:[0-9a-z]+$`, "u"));
  }
  expect(cold.calls.slice(before).filter((call) => call.path.endsWith("/lines"))).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge Claw Machine in motion: held arrows steer, the claw swings, drops and carries", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "no-preference" });
  const stub = createClawStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  await root.getByRole("button", { name: "Play: Claw Machine with Kai Ardent" }).click();
  await root.getByRole("button", { name: "Me first" }).click();

  const action = root.locator(".of-claw-action");
  const glass = root.locator(".of-claw-glass");
  await expect(action).toHaveAttribute("data-mode", "drop", { timeout: 10_000 });
  const clawX = async () =>
    Number(await glass.evaluate((element) => getComputedStyle(element).getPropertyValue("--cx")));
  const start = await clawX();
  // Holding → moves the claw; letting go, it swings on its cable.
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(700);
  await page.keyboard.up("ArrowRight");
  const moved = await clawX();
  expect(moved).toBeGreaterThan(start + 0.15);
  const angles = new Set<string>();
  for (let sample = 0; sample < 6; sample += 1) {
    angles.add(await glass.evaluate((element) => getComputedStyle(element).getPropertyValue("--ca")));
    await page.waitForTimeout(90);
  }
  expect(angles.size).toBeGreaterThan(1);
  // The on-screen arrow, held by a pointer, moves it back.
  const left = root.getByRole("button", { name: "Move the claw left" });
  const box = (await left.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  expect(await clawX()).toBeLessThan(moved);
  await page.screenshot({ path: testInfo.outputPath("05-aim.png") });

  // Drop: the cable runs out, then the claw comes home over the chute.
  await action.focus();
  await page.keyboard.press(" ");
  await expect(root.locator(".of-claw-game")).toHaveAttribute("data-stage", "drop");
  await page.waitForTimeout(650);
  const cable = Number(await glass.evaluate((element) => getComputedStyle(element).getPropertyValue("--cc")));
  expect(cable).toBeGreaterThan(0.5);
  await page.screenshot({ path: testInfo.outputPath("06-drop.png") });
  await expect(root.locator(".of-claw-game")).not.toHaveAttribute("data-stage", "drop", { timeout: 6_000 });
  expect(Math.abs((await clawX()) - 0.11)).toBeLessThan(0.02);
  // His turn follows; he moves the claw himself.
  await expect(action).toHaveAttribute("data-mode", "cheer", { timeout: 6_000 });
  await page.waitForTimeout(2_200);
  expect(Math.abs((await clawX()) - 0.11)).toBeGreaterThan(0.05);
  await page.screenshot({ path: testInfo.outputPath("07-his-turn.png") });
  expect(pageErrors).toEqual([]);
});

test("Otome Forge Read Kai Ardent at phone width: no answer before the pick, keyboard play, a tell, paid once", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const stub = createClawStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  await root.getByRole("button", { name: "Play: Read Kai Ardent" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Read Kai Ardent" })).toBeFocused();
  await recordSpeech(page);
  await root.getByRole("button", { name: "Begin" }).click();

  const readings = root.locator(".of-rh-reading");
  for (const [round, truth] of READ_ROUNDS.entries()) {
    await expect(root.getByRole("heading", { name: `Moment ${round + 1} of 5` })).toBeFocused();
    // Before the pick nothing marks the truth or shows the thought.
    await expect(readings).toHaveCount(3);
    await expect(root.locator('.of-rh-reading[data-state="true"]')).toHaveCount(0);
    await expect(root.getByText(truth.thought)).toHaveCount(0);
    // The face the moment names, painted (M2b's ready set); a plain moment shows his look.
    const face = root.locator('.of-rh-scene .of-face-img[data-front="true"]');
    await expect(face).toHaveAttribute("src", truth.face ? COLD : LOOK);
    await expect(root.locator(".of-rh-scene .of-face")).toHaveAccessibleName(
      truth.face ? "Kai Ardent, cold" : "Kai Ardent",
    );
    // His line in his card's voice as the moment opens, once, under the set's own ref.
    await expect
      .poll(async () => (await voiced(page)).map((line) => line.cacheKey))
      .toContain(`otome-forge:${RUN}:readhim:${READ_SET}:${round}`);
    if (round === 0) await page.screenshot({ path: testInfo.outputPath("08-read-moment.png") });
    // The true reading on rounds 1, 4 and 5 (by its number key); a decoy on the others.
    const pick = round === 1 || round === 2 ? (truth.trueIndex + 1) % 3 : truth.trueIndex;
    await page.keyboard.press(String(pick + 1));
    await expect(root.locator('.of-rh-reading[data-state="true"]')).toHaveCount(1);
    await expect(root.locator(".of-rh-verdict")).toContainText(
      pick === truth.trueIndex
        ? "You read Kai Ardent right."
        : `Not quite. Kai Ardent felt: Glad you came (${round + 1})`,
    );
    if (round === 0) {
      await expect(root.getByText("You noticed a tell: Winds a pocket watch")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("09-read-answered.png") });
    }
    // A second key press changes nothing: the first pick stands.
    await page.keyboard.press(String(((pick + 1) % 3) + 1));
    const next = root.getByRole("button", { name: round < 4 ? "Next moment" : "See how you did" });
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
  }

  const score = root.getByRole("heading", { name: "You read Kai Ardent right 3 of 5 times" });
  await expect(score).toBeFocused();
  await expect(root.locator(".of-rh-done")).toContainText("+40 Starlight");
  await expect(root.locator(".of-rh-tells")).toContainText("Winds a pocket watch");
  await expect(root.locator(".of-rh-tells")).toContainText("Hums off-key");
  const sent = (suffix: string) => stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));
  expect(sent("/read-him")).toHaveLength(1);
  expect(sent("/answer").map((call) => call.body!.round)).toEqual([0, 1, 2, 3, 4]);
  expect(sent("/finish")).toHaveLength(1);
  // Each moment's line was voiced once, in his voice; a thought never is.
  const lines = await voiced(page);
  expect(lines.map((line) => line.cacheKey)).toEqual(
    READ_ROUNDS.map((_, round) => `otome-forge:${RUN}:readhim:${READ_SET}:${round}`),
  );
  expect(lines.every((line) => line.voice === "Kai Voice" && line.text === READ_ROUNDS[0]!.line)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("10-read-done.png"), fullPage: true });
  expect(pageErrors).toEqual([]);
});

test("Otome Forge Date Night's places: its own cards and a place the story painted, over its picture", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const stub = createClawStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  await root.getByRole("button", { name: "Play: Date Night with Kai Ardent" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Where to tonight?" })).toBeFocused();

  // Nine cards of its own and the story's painted place, each one shown (M2b's reader layer `.of-place` is apart).
  const group = root.getByRole("group", { name: "Where you and Kai Ardent spend the evening" });
  await expect(group.getByRole("radio")).toHaveCount(10);
  const cards = root.locator(".of-date-place");
  await expect(cards).toHaveCount(10);
  for (const style of await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const computed = getComputedStyle(element);
      return { opacity: computed.opacity, position: computed.position };
    }),
  )) {
    expect(style).toEqual({ opacity: "1", position: "relative" });
  }
  await expect(root.locator(".of-place")).toHaveCount(0);
  const painted = root.locator('.of-date-place[data-place="story"]');
  await expect(painted).toContainText("The Glass Conservatory");
  await expect(painted.locator("img")).toHaveAttribute("src", PLACE_ART);
  await expect(root.getByText("From your story")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await painted.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("11-date-places.png") });

  // Picking it carries its key; the summary names it as the story does.
  await painted.click();
  await expect(group.getByRole("radio", { name: /The Glass Conservatory/ })).toBeChecked();
  await root.getByRole("button", { name: "Next: what you wear" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "What will you wear?" })).toBeFocused();
  await expect(root.locator(".of-date-summary")).toContainText("The Glass Conservatory, with Kai Ardent");
  await root.getByRole("button", { name: "Begin the date" }).click();
  await expect
    .poll(() => stub.calls.filter((call) => call.method === "POST" && call.path.endsWith("/dates")).length)
    .toBe(1);
  const planned = stub.calls.find((call) => call.method === "POST" && call.path.endsWith("/dates"))!;
  expect(planned.body).toMatchObject({
    li: KAI,
    place: "story",
    storyPlace: "the-glass-conservatory",
    herLook: "base",
    hisLook: "base",
  });
  expect(pageErrors).toEqual([]);
});
