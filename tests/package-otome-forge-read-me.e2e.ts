// Otome Hearth's Read Me (#1945) in the Engine's Home tab, with /api/otome-forge/** stubbed by the server's rules (S/
// routes/read-me.ts): Dates lists it beside Read {{name}} with its pay and its one call; a love interest makes four
// guesses about the protagonist; each is answered Spot on, Close or Not at all (by its button or keys 1–3, which never
// fire while the player types in the words field, digits and all), with the truth in the player's own words; nothing
// shows the reaction before the answer, then the reaction and its face show, voiced; words the server refuses stay in
// the field with the reason beside it; the finish pays once; and the notebook ("What {{name}} knows about you") lists
// what they learned in its categories' order, each with its verdict in words and "You said", where the words are
// edited and an entry deleted after a confirm. A second test picks a half-played set up, with the day's rewards spent,
// and reads a notebook opened from the intro. Each test runs Midnight on one project and Pearl on the other, at phone
// width (mobile-chromium) and on the desktop (desktop-chromium).
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-read-me.e2e.ts
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

const RUN = "r-e2e-readme1";
const KAI = "li-kai-0001";
const MIR = "li-mireille-0002";
const SET = "rm-e2e01-abc123";
const FILE = "/api/global-gallery/file";
const LOOK = `${FILE}/kai-look.png`;
/** A 1×1 PNG for every gallery image the stub names. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
/** The words the stub refuses, as the server refuses words that sound like health or the body (SH/home.ts). */
const REFUSED = "medicine";
/** Four guesses, each with a reaction to every verdict (hidden until it is answered). */
const GUESSES = [
  { category: "likes", line: "You like the rain on the canal roofs.", face: "tender" },
  { category: "fears", line: "You hum when the bells go quiet.", face: "" },
  { category: "habits", line: "You count the bridges on your way home.", face: "cold" },
  { category: "dreams", line: "You want a lantern boat of your own.", face: "" },
].map((guess, index) => ({
  ...guess,
  reactions: {
    right: { reaction: `I knew it (${index + 1}).`, face: "flustered" },
    close: { reaction: `Almost, then (${index + 1}).`, face: "tender" },
    wrong: { reaction: `Tell me, then (${index + 1}).`, face: "hurt" },
  } as Record<string, { reaction: string; face: string }>,
}));
const PAY = { right: 10, close: 5, wrong: 0 } as Record<string, number>;

interface StubOptions {
  /** Guesses already answered when the set is asked for (a set picked up again). */
  answered?: Array<{ verdict: string; words?: string }>;
  /** The notebook before any play. */
  notebook?: Json[];
  /** The day's activity rewards are spent: a finish pays nothing. */
  capped?: boolean;
}

/** The routes Read Me uses, answered in memory by the server's rules. */
function createReadMeStub({ answered = [], notebook = [], capped = false }: StubOptions = {}) {
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
      // Voices on (Settings → Audio, M2b), so the guesses and reactions are voiced through the Engine's voice service.
      audio: { tts: true },
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
  const answers: Array<Json | undefined> = answered.map(({ verdict, words }, guess) => ({
    verdict,
    ...GUESSES[guess]!.reactions[verdict]!,
    ...(words ? { words } : {}),
  }));
  const known: Json[] = structuredClone(notebook);
  let paid: Json | null = null;

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
    if (/^\/runs\/[^/]+\/lis\/[^/]+\/lines$/u.test(path)) {
      return {
        status: 200,
        json: { ready: true, stage: 1, rupture: false, tap: null, annoyed: [], cold: [], comfort: [], claw: null },
      };
    }
    if (path === `${base}/play`) {
      return {
        status: 200,
        json: {
          dayKey: now().slice(0, 10),
          starlight: { earned: capped ? 400 : 0, cap: 400 },
          affection: { earned: capped ? { [KAI]: 300 } : {}, cap: 300 },
          plush: {},
          lis: Object.fromEntries(
            [KAI, MIR].map((li) => [
              li,
              { cheat: "nudge", style: "", rupture: false, makeItRight: false, lines: { claw: null, cold: [] } },
            ]),
          ),
        },
      };
    }
    // Read Me: a guess's reaction only in its answer; the first answer stands; words that sound medical are refused.
    if (path === `${base}/read-me`) {
      const guesses = GUESSES.map(({ category, line, face }, guess) => ({
        category,
        line,
        face,
        ...(answers[guess] ? { answer: answers[guess] } : {}),
      }));
      return {
        status: 200,
        json: {
          setId: SET,
          li: call.body!.li,
          context: "Kai Ardent sets two cups on the lock wall and studies you over the steam.",
          guesses,
          grants: null,
        },
      };
    }
    if (path === `${base}/read-me/${SET}/answer`) {
      const { guess, verdict, words } = call.body as { guess: number; verdict: string; words?: string };
      if (typeof words === "string" && words.includes(REFUSED)) {
        return { status: 400, json: { error: "Those words cannot be kept.", code: "bad-request" } };
      }
      answers[guess] ??= { verdict, ...GUESSES[guess]!.reactions[verdict]!, ...(words ? { words } : {}) };
      return { status: 200, json: answers[guess] };
    }
    if (path === `${base}/read-me/${SET}/finish`) {
      if (GUESSES.some((_, guess) => !answers[guess])) {
        return { status: 409, json: { error: "Answer every guess before finishing.", code: "conflict" } };
      }
      if (!paid) {
        const affection = 20 + answers.reduce((sum, entry) => sum + PAY[entry!.verdict]!, 0);
        const grants = capped
          ? []
          : [
              { source: "read-me", starlight: 40 },
              { source: "read-me", li: KAI, affection },
            ];
        if (!capped) view.starlight += 40;
        known.push(
          ...GUESSES.map(({ category, line }, guess) => ({
            id: `${SET}/${guess}`,
            category,
            text: line,
            verdict: answers[guess]!.verdict,
            ...(answers[guess]!.words ? { words: answers[guess]!.words } : {}),
            at: now(),
          })),
        );
        paid = { grants };
      }
      return { status: 200, json: { grants: paid.grants, starlight: view.starlight, known: structuredClone(known) } };
    }
    if (path === `${base}/lis/${KAI}/notebook`) {
      if (call.method === "POST") {
        const { action, id, words } = call.body as { action: string; id: string; words?: string };
        const at = known.findIndex((entry) => entry.id === id);
        if (at < 0) return { status: 404, json: { error: "No such entry.", code: "not-found" } };
        if (action === "delete") known.splice(at, 1);
        else if (typeof words === "string" && words.includes(REFUSED)) {
          return { status: 400, json: { error: "Those words cannot be kept.", code: "bad-request" } };
        } else {
          const edited = { ...known[at]! };
          delete edited.words;
          known[at] = { ...edited, ...(words ? { words } : {}) };
        }
      }
      return { status: 200, json: { li: KAI, entries: structuredClone(known) } };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer, view, known };
}

type Stub = ReturnType<typeof createReadMeStub>;

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
  await page.route("**/api/game-assets/**", (route) => route.fulfill({ json: { assets: {} } }));
  await page.route(`**${FILE}/**`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  // The Engine's voice routes: his card's assigned voice, and a silent clip for each line.
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
/** Waits until the line under `ref` was voiced (a line answered before its voice starts is stopped, never sent). */
const heard = (page: Page, ref: string) =>
  expect
    .poll(async () => (await voiced(page)).map((entry) => entry.cacheKey))
    .toContain(`otome-forge:${RUN}:readme:${ref}`);

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

/** Opens Dates from Home, then Read Me with Kai Ardent. */
async function openReadMe(root: Locator) {
  await expect(root.getByRole("heading", { level: 1, name: "Kai Ardent" })).toBeVisible();
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
  await root.getByRole("button", { name: "Play: Let Kai Ardent read you" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Let Kai Ardent read you" })).toBeFocused();
}

const posts = (stub: Stub, suffix: string) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));
/** A POST's own fields: every one also carries the player's time zone and debug mode. */
const fields = (call: Call) => {
  const { timeZone, debugMode, ...rest } = call.body!;
  expect(typeof timeZone).toBe("string");
  expect(typeof debugMode).toBe("boolean");
  return rest;
};
const verdicts = (root: Locator) => root.locator(".of-rm-verdicts");
const pressed = (root: Locator) => verdicts(root).locator('button[aria-pressed="true"]');
const noWider = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

test("Otome Hearth Read Me: four guesses answered by button, key and words, paid once, the notebook edited and pruned", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  // Pearl on the phone, Midnight on the desktop; the second test swaps them.
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createReadMeStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  await expect(root).toHaveAttribute("data-look", mobile ? "pearl" : "midnight");

  // Dates lists Read Me beside Read Kai Ardent, with its pay (more for each guess spot on or close) and its one call.
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  const activities = root.getByRole("list", { name: "Things to do with Kai Ardent" });
  await expect(activities.getByRole("button", { name: /^Play: / })).toHaveCount(4);
  const card = root.locator('.of-activity[data-activity="read-me"]');
  await expect(card.getByRole("heading", { name: "Let Kai Ardent read you" })).toBeVisible();
  await expect(card).toContainText(
    "+40 Starlight · +20 affection, and +10 more for each guess Kai Ardent gets spot on (+5 if close)",
  );
  await expect(card).toContainText("1 model call");
  expect(
    await activities
      .locator(".of-activity")
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.activity)),
  ).toEqual(["read-him", "read-me", "date-night", "claw"]);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("01-dates.png") });
  await root.getByRole("button", { name: "Play: Let Kai Ardent read you" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Let Kai Ardent read you" })).toBeFocused();

  // The intro opens their notebook, empty yet; nothing has asked a model for anything.
  await expect(root).toContainText("+40 Starlight and +20 affection, plus 10 more for each guess spot on");
  const notebookToggle = root.getByRole("button", { name: "What Kai Ardent knows about you" });
  await notebookToggle.click();
  await expect(notebookToggle).toHaveAttribute("aria-expanded", "true");
  await expect(root.getByText("Kai Ardent hasn’t learned anything about you yet.")).toBeVisible();
  expect(posts(stub, "/read-me")).toHaveLength(0);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("02-intro.png"), fullPage: true });

  await recordSpeech(page);
  await root.getByRole("button", { name: "Begin", exact: true }).click();
  const tell = root.getByRole("button", { name: "Tell Kai Ardent" });
  const words = root.getByRole("textbox", { name: "In your own words (optional)" });
  const status = root.locator(".of-choices-status");
  const line = root.locator(".of-rh-dialogue .of-line > [aria-hidden='true']");
  const face = root.locator(".of-rh-scene .of-face");

  // Guess 1: no reaction before the answer; key 1 picks Spot on (focus on the heading), then Tell sends it.
  await expect(root.getByRole("heading", { name: "Guess 1 of 4" })).toBeFocused();
  await expect(root).toContainText("Kai Ardent sets two cups on the lock wall");
  await expect(line).toHaveText(GUESSES[0]!.line);
  await expect(face).toHaveAccessibleName("Kai Ardent, tender");
  await expect(root.getByText(/I knew it|Almost, then|Tell me, then/u)).toHaveCount(0);
  await expect(root.getByRole("group", { name: "Did Kai Ardent get you right?" })).toBeVisible();
  await expect(pressed(root)).toHaveCount(0);
  await expect(words).toHaveAttribute("maxlength", "200");
  await heard(page, `${SET}:0`);
  await page.keyboard.press("1");
  await expect(root.getByRole("button", { name: "Spot on" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: testInfo.outputPath("03-guess.png") });
  await tell.click();
  const next = root.getByRole("button", { name: "Next guess" });
  await expect(next).toBeFocused();
  await expect(line).toHaveText("I knew it (1).");
  await expect(face).toHaveAccessibleName("Kai Ardent, flustered");
  await expect(root.locator(".of-rm-recap")).toHaveText(`Kai Ardent guessed: “${GUESSES[0]!.line}”`);
  await heard(page, `${SET}:0:reaction`);
  await expect(root.locator(".of-rm > [aria-live='polite']")).toHaveText(
    "You said: Spot on. Kai Ardent: I knew it (1).",
  );
  // Answered, the verdicts are settled: a key changes nothing.
  await page.keyboard.press("3");
  await expect(pressed(root)).toHaveText(["Spot on"]);
  await page.screenshot({ path: testInfo.outputPath("04-reaction.png") });
  await page.keyboard.press("Enter");

  // Guess 2: Tell with no verdict says what is missing; digits typed into the words are words, never a verdict.
  await expect(root.getByRole("heading", { name: "Guess 2 of 4" })).toBeFocused();
  await heard(page, `${SET}:1`);
  // Tell is aria-disabled (still focusable, so a screen reader hears why) until a verdict is picked.
  await expect(tell).toHaveAttribute("aria-disabled", "true");
  await tell.click({ force: true });
  await expect(status).toHaveText("Pick Spot on, Close or Not at all first.");
  const typed = "I hum 3 songs, 1 or 2 at a time";
  await words.click();
  await page.keyboard.type(typed);
  await expect(words).toHaveValue(typed);
  await expect(pressed(root)).toHaveCount(0);
  expect(posts(stub, "/answer")).toHaveLength(1);
  await root.getByRole("button", { name: "Close", exact: true }).click();
  await expect(root.getByRole("button", { name: "Close", exact: true })).toHaveAttribute("aria-pressed", "true");
  await tell.click();
  await expect(next).toBeFocused();
  await expect(line).toHaveText("Almost, then (2).");
  await expect(root.locator(".of-rm-said")).toHaveText(`You said: “${typed}”`);
  await heard(page, `${SET}:1:reaction`);
  await next.click();

  // Guess 3: refused words stay in the field with the reason beside it; sent again without them.
  await expect(root.getByRole("heading", { name: "Guess 3 of 4" })).toBeFocused();
  await heard(page, `${SET}:2`);
  await words.fill(`The ${REFUSED} cabinet stays tidy`);
  await root.getByRole("button", { name: "Not at all" }).click();
  await tell.click();
  await expect(status).toHaveText(
    "These words can’t be kept. Leave out anything about health, medicine or the body, and try again.",
  );
  await expect(words).toHaveAttribute("aria-invalid", "true");
  await expect(words).toHaveValue(`The ${REFUSED} cabinet stays tidy`);
  await expect(line).toHaveText(GUESSES[2]!.line);
  await words.fill("");
  await tell.click();
  await expect(next).toBeFocused();
  await expect(line).toHaveText("Tell me, then (3).");
  await expect(root.locator(".of-rm-said")).toHaveCount(0);
  await heard(page, `${SET}:2:reaction`);
  await next.click();

  // Guess 4: key 2 picks Close, with words.
  await expect(root.getByRole("heading", { name: "Guess 4 of 4" })).toBeFocused();
  await heard(page, `${SET}:3`);
  await page.keyboard.press("2");
  await words.fill("A lantern, yes. The boat can wait.");
  await tell.click();
  const result = root.getByRole("button", { name: "See what Kai Ardent learned" });
  await expect(result).toBeFocused();
  await heard(page, `${SET}:3:reaction`);
  await result.click();

  // The result: paid once, and the notebook with what they learned, in its categories' order.
  const done = root.getByRole("heading", { name: "Kai Ardent knows you a little better" });
  await expect(done).toBeFocused();
  await expect(root).toContainText("Spot on: 1 · Close: 2 · Not at all: 1");
  await expect(root.locator(".of-rm-done .of-grants")).toContainText("+40 Starlight");
  await expect(root.locator(".of-rm-done .of-grants")).toContainText("Kai Ardent · +40 affection");
  await expect(root.locator(".of-starlight")).toContainText((2040).toLocaleString("en-US"));
  const answersSent = posts(stub, "/answer").map(fields);
  expect(answersSent).toEqual([
    { guess: 0, verdict: "right" },
    { guess: 1, verdict: "close", words: typed },
    { guess: 2, verdict: "wrong", words: `The ${REFUSED} cabinet stays tidy` },
    { guess: 2, verdict: "wrong" },
    { guess: 3, verdict: "close", words: "A lantern, yes. The boat can wait." },
  ]);
  expect(posts(stub, "/read-me").map(fields)).toEqual([{ li: KAI }]);
  expect(posts(stub, "/finish").map(fields)).toEqual([{}]);
  // Each guess voiced as it opened and each reaction as it came, once, in his voice, under the set's own refs.
  const keys = (await voiced(page)).map((entry) => entry.cacheKey);
  expect(keys).toEqual(
    GUESSES.flatMap((_, guess) => [
      `otome-forge:${RUN}:readme:${SET}:${guess}`,
      `otome-forge:${RUN}:readme:${SET}:${guess}:reaction`,
    ]),
  );

  const notebook = root.getByRole("region", { name: "What Kai Ardent knows about you" });
  await expect(notebook.getByRole("heading", { level: 3 })).toHaveText(["Likes", "Habits", "Fears", "Dreams"]);
  const entry = (text: string) => notebook.getByRole("listitem").filter({ hasText: text });
  await expect(entry(GUESSES[0]!.line).locator(".of-rm-mark")).toHaveText("Spot on");
  await expect(entry(GUESSES[1]!.line).locator(".of-rm-mark")).toHaveText("Close");
  await expect(entry(GUESSES[1]!.line)).toContainText(`You said: “${typed}”`);
  await expect(entry(GUESSES[2]!.line).locator(".of-rm-mark")).toHaveText("Not at all");
  await noWider(page);
  await notebook.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("05-done.png"), fullPage: true });

  // Edit: the field takes focus with the words given; Save sends them, and focus returns to Edit.
  const editFears = notebook.getByRole("button", { name: `Edit your words: ${GUESSES[1]!.line}` });
  await editFears.click();
  const field = notebook.getByRole("textbox", { name: "In your own words" });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(typed);
  await field.fill("Only 2 songs, really");
  await notebook.getByRole("button", { name: "Save" }).click();
  await expect(editFears).toBeFocused();
  await expect(entry(GUESSES[1]!.line)).toContainText("You said: “Only 2 songs, really”");
  await expect(notebook.getByRole("status").last()).toHaveText("Saved.");
  // Refused words: said beside the field, which keeps them; Escape puts it away, focus back on Edit.
  const editLikes = notebook.getByRole("button", { name: `Edit your words: ${GUESSES[0]!.line}` });
  await editLikes.click();
  await field.fill(`Rain and ${REFUSED}`);
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue(`Rain and ${REFUSED}\n`);
  await notebook.getByRole("button", { name: "Save" }).click();
  await expect(notebook.getByRole("alert")).toHaveText(
    "These words can’t be kept. Leave out anything about health, medicine or the body, and try again.",
  );
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await page.screenshot({ path: testInfo.outputPath("06-edit-refused.png") });
  await field.focus();
  await page.keyboard.press("Escape");
  await expect(editLikes).toBeFocused();
  await expect(entry(GUESSES[0]!.line).locator(".of-rm-said")).toHaveCount(0);

  // Delete asks first; Keep it keeps it (focus back on Delete), and Delete removes it (focus on the heading).
  const deleteDreams = notebook.getByRole("button", { name: `Delete: ${GUESSES[3]!.line}` });
  await deleteDreams.click();
  const dialog = root.getByRole("dialog", { name: "Delete this from Kai Ardent’s notebook?" });
  await expect(dialog).toContainText(GUESSES[3]!.line);
  await expect(dialog).toContainText("Kai Ardent forgets it, and your words with it.");
  await page.screenshot({ path: testInfo.outputPath("07-delete.png") });
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(deleteDreams).toBeFocused();
  await deleteDreams.click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(notebook.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(notebook.getByRole("heading", { level: 3 })).toHaveText(["Likes", "Habits", "Fears"]);
  await expect(notebook.getByRole("status").last()).toHaveText("Deleted. Kai Ardent has forgotten it.");
  expect(posts(stub, "/notebook").map(fields)).toEqual([
    { action: "edit", id: `${SET}/1`, words: "Only 2 songs, really" },
    { action: "edit", id: `${SET}/0`, words: `Rain and ${REFUSED}` },
    { action: "delete", id: `${SET}/3` },
  ]);
  expect(stub.known.map((known) => known.id)).toEqual([`${SET}/0`, `${SET}/1`, `${SET}/2`]);
  await page.screenshot({ path: testInfo.outputPath("08-pruned.png"), fullPage: true });
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth Read Me picks a half-played set up, after the day's rewards, and opens a notebook kept before", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "dark" : "light", reducedMotion: "reduce" });
  const earlier = [
    {
      id: "rm-e2e00-zzz999/2",
      category: "other",
      text: "You keep your tickets.",
      verdict: "right",
      at: "2026-10-01T10:00:00.000Z",
    },
    {
      id: "rm-e2e00-zzz999/0",
      category: "dislikes",
      text: "You hate the fog horns.",
      verdict: "wrong",
      words: "I love them, actually.",
      at: "2026-10-01T10:01:00.000Z",
    },
  ];
  const stub = createReadMeStub({
    answered: [{ verdict: "wrong", words: "Snow, not rain." }, { verdict: "right" }],
    notebook: earlier,
    capped: true,
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  await expect(root).toHaveAttribute("data-look", mobile ? "midnight" : "pearl");
  await openReadMe(root);

  // The notebook kept before: its sections in order, each verdict in words, the player's own words.
  await root.getByRole("button", { name: "What Kai Ardent knows about you" }).click();
  const notebook = root.getByRole("region", { name: "What Kai Ardent knows about you" });
  await expect(notebook.getByRole("heading", { level: 3 })).toHaveText(["Dislikes", "Other"]);
  await expect(notebook.getByRole("listitem").first()).toContainText("You hate the fog horns.");
  await expect(notebook.getByRole("listitem").first()).toContainText("Not at all");
  await expect(notebook.getByRole("listitem").first()).toContainText("You said: “I love them, actually.”");
  await expect(notebook.getByRole("listitem").last()).toContainText("Spot on");
  await noWider(page);
  await notebook.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("09-notebook-intro.png"), fullPage: true });

  // Begin picks the set up at its first open guess; the two answered marks are in the head.
  await root.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(root.getByRole("heading", { name: "Guess 3 of 4" })).toBeFocused();
  await expect(root.locator('.of-rh-hearts [data-state="wrong"]')).toHaveCount(1);
  await expect(root.locator('.of-rh-hearts [data-state="right"]')).toHaveCount(1);
  await expect(root.locator('.of-rh-hearts [data-state="current"]')).toHaveCount(1);
  for (const key of ["1", "3"]) {
    await page.keyboard.press(key);
    await root.getByRole("button", { name: "Tell Kai Ardent" }).click();
    await root.getByRole("button", { name: /^(Next guess|See what Kai Ardent learned)$/u }).click();
    if (key === "1") await expect(root.getByRole("heading", { name: "Guess 4 of 4" })).toBeFocused();
  }

  // The day's rewards are spent: said so, and nothing paid; the notebook has the kept entries and the four new ones.
  await expect(root.getByRole("heading", { name: "Kai Ardent knows you a little better" })).toBeFocused();
  await expect(root.locator(".of-rm-done .of-notice")).toHaveText(
    "You’ve earned today’s activity rewards. Play on just for fun.",
  );
  await expect(root.locator(".of-rm-done .of-grants")).toHaveCount(0);
  const after = root.getByRole("region", { name: "What Kai Ardent knows about you" });
  await expect(after.getByRole("heading", { level: 3 })).toHaveText([
    "Likes",
    "Dislikes",
    "Habits",
    "Fears",
    "Dreams",
    "Other",
  ]);
  await expect(after.getByRole("listitem")).toHaveCount(6);
  expect(posts(stub, "/answer").map(fields)).toEqual([
    { guess: 2, verdict: "right" },
    { guess: 3, verdict: "wrong" },
  ]);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("10-capped.png"), fullPage: true });
  expect(pageErrors).toEqual([]);
});
