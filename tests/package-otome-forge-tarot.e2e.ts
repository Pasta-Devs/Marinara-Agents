// Otome Hearth's Tarot night (#2151) in the Engine's Home tab, with /api/otome-forge/** stubbed by the server's rules
// (S/routes/tarot.ts): Dates lists it after Read Me with its pay and its one call; the intro picks who reads and the
// question; three of 22 face-down cards are picked by tap or click (or Let fate choose, or the keyboard's roving
// tabindex on the desktop), numbered in order; the cards turn one at a time, each line voiced once and focus moving to
// each new one; in "you-read" the player picks a reading (button or keys 1–3), spoken in the persona's voice, and the
// reaction shows only then (never from a key pressed in a dialog); the finish pays once; a "you-read" reading left
// half-way opens again at the card it stopped on; with no image connection the cards are our SVG and offer no paint,
// and with Ask before painting the Paint these cards bar (for the turned cards only) paints and the card swaps to its
// picture. Each test runs Midnight on one project and Pearl on the other, at phone
// width (mobile-chromium, touch) and on the desktop (desktop-chromium, mouse and keyboard), with no horizontal scroll.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-tarot.e2e.ts
import { expect, test, type Locator, type Page } from "./fixtures/package-browser.ts";
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

const RUN = "r-e2e-tarot1";
const KAI = "li-kai-0001";
const MIR = "li-mireille-0002";
const READING = "tr-e2e01-abc123";
const FILE = "/api/global-gallery/file";
const LOOK = `${FILE}/kai-look.png`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
/** The draw the stub makes, whatever is picked: the Tower reversed, the Lovers, the Star. */
const DRAWN = [
  { card: "tower", reversed: true },
  { card: "lovers", reversed: false },
  { card: "star", reversed: false },
];
const deckKeyOf = (card: string) => (card === "lovers" ? `lovers@${KAI}` : card);

interface StubOptions {
  /** The story's image connection, with Ask before painting. */
  images?: boolean;
  /** A "you-read" reading already open, its first card answered. */
  open?: boolean;
}

function createTarotStub({ images = false, open = false }: StubOptions = {}) {
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
      images: { connectionId: images ? "conn-image" : null, rating: "sfw", ask: images, expressions: true },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
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
  let reading: Json | null = null;
  const reactions: Array<Json | undefined> = [undefined, undefined, undefined];
  let paid: Json | null = null;
  const deck: Record<string, Json> = {};

  const readingOf = (mode: string, question: Json | null): Json => ({
    id: READING,
    li: KAI,
    mode,
    question: mode === "reads-you" ? question : null,
    context: "Kai Ardent spreads a velvet cloth over the lock wall and lays the deck on it.",
    opening: {
      line: mode === "you-read" ? "Read mine, then. Will I ever stop running?" : "Ask, and I will read them true.",
      face: "tender",
    },
    cards: DRAWN.map((drawn, card) => ({
      ...drawn,
      line: `Card ${card + 1} turns, and Kai Ardent smiles at it.`,
      face: card === 1 ? "flustered" : "tender",
      ...(mode === "you-read"
        ? { readings: [0, 1, 2].map((option) => `Reading ${card + 1}.${option + 1}: you keep a door open.`) }
        : {}),
    })),
    closing: { line: "That is all the cards will say tonight.", face: "tender" },
    grants: null,
  });
  if (open) {
    reading = readingOf("you-read", null);
    reactions[0] = {
      pick: 0,
      reading: "Reading 1.1: you keep a door open.",
      reaction: "Reaction 1.1: maybe I do.",
      face: "flustered",
    };
  }
  const shown = () =>
    reading && {
      ...reading,
      cards: reading.cards.map((card: Json, index: number) => ({
        ...card,
        ...(reactions[index] ? { answer: reactions[index] } : {}),
      })),
      grants: paid ? paid.grants : null,
    };

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
          starlight: { earned: 0, cap: 400 },
          affection: { earned: {}, cap: 150 },
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
    if (path === `${base}/lis/${KAI}/tarot`) {
      return { status: 200, json: { open: paid ? null : shown(), deck: structuredClone(deck) } };
    }
    if (path === `${base}/tarot`) {
      const body = call.body as { mode: string; question?: Json; picks: number[] };
      if (!reading || paid) {
        reading = readingOf(body.mode, body.question ?? null);
        reactions.fill(undefined);
        paid = null;
        // The drawn cards are claimed for the deck: held for the tap under Ask before painting.
        if (images) {
          for (const drawn of DRAWN) {
            deck[deckKeyOf(drawn.card)] ??= { card: drawn.card, art: { state: "waiting-consent", at: now() } };
          }
        }
      }
      return { status: 200, json: shown() };
    }
    if (path === `${base}/tarot/${READING}/answer`) {
      const { card, pick } = call.body as { card: number; pick: number };
      if (reading?.mode !== "you-read") return { status: 400, json: { error: "Not yours.", code: "bad-request" } };
      reactions[card] ??= {
        pick,
        reading: reading.cards[card].readings[pick],
        reaction: `Reaction ${card + 1}.${pick + 1}: maybe I do.`,
        face: "flustered",
      };
      return { status: 200, json: reactions[card] };
    }
    if (path === `${base}/tarot/${READING}/finish`) {
      if (reading?.mode === "you-read" && reactions.some((entry) => !entry)) {
        return { status: 409, json: { error: "Read every card before finishing.", code: "conflict" } };
      }
      if (!paid) {
        paid = {
          grants: [
            { source: "tarot", starlight: 40 },
            { source: "tarot", li: KAI, affection: 40 },
          ],
        };
        view.starlight += 40;
      }
      return { status: 200, json: { grants: paid.grants, starlight: view.starlight } };
    }
    if (path === `${base}/art/tarot`) {
      const { card } = call.body as { card: string };
      const key = deckKeyOf(card);
      if (!deck[key]) return { status: 409, json: { error: "Not drawn yet.", code: "locked" } };
      deck[key] = { card, art: { state: "ready", at: now(), url: `${FILE}/card-${card}.png` } };
      return { status: 200, json: { art: deck[key].art } };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer, view, deck };
}

type Stub = ReturnType<typeof createTarotStub>;

/** Holds requests to `url` until the returned release is called, then lets them through to the stub. */
async function hold(page: Page, url: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    await gate;
    await route.fallback();
  });
  return release;
}

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
  // The Engine's voice routes: his card's voice and her persona's, and a silent clip for each line.
  await page.route("**/api/tts/config", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        connectionId: "conn-tts",
        connectionProfiles: {
          "conn-tts": {
            voiceAssignments: [
              { characterId: "card-kai", voice: "Kai Voice" },
              { characterId: "persona-mira", voice: "Mira Voice" },
            ],
            npcDefaultMaleVoices: ["Pool Male"],
            npcDefaultFemaleVoices: ["Pool Female"],
          },
        },
      },
    }),
  );
  await page.route("**/api/tts/voices*", (route) =>
    route.fulfill({ json: { voices: ["Kai Voice", "Mira Voice", "Pool Male"] } }),
  );
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
const heard = (page: Page, ref: string) =>
  expect
    .poll(async () => (await voiced(page)).map((entry) => entry.cacheKey))
    .toContain(`otome-forge:${RUN}:tarot:${READING}:${ref}`);

async function openOtome(page: Page): Promise<Locator> {
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
  await expect(root.getByRole("heading", { level: 1, name: "Kai Ardent" })).toBeVisible();
  return root;
}

/** Opens Dates from Home, then Tarot night with Kai Ardent. */
async function openTarot(root: Locator) {
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
  await root.getByRole("button", { name: "Play: Tarot night with Kai Ardent" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Tarot night with Kai Ardent" })).toBeFocused();
}

const posts = (stub: Stub, suffix: string) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));
const fields = (call: Call) => {
  const { timeZone, debugMode, ...rest } = call.body!;
  expect(typeof timeZone).toBe("string");
  expect(typeof debugMode).toBe("boolean");
  return rest;
};
const noWider = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const line = (root: Locator) => root.locator(".of-rh-dialogue .of-line > [aria-hidden='true']");

test("Otome Hearth Tarot night: Kai Ardent reads my cards, picked by tap or click, turned one by one, paid once", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createTarotStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());

  // Dates lists Tarot night after Read Me, with its pay and its one call (no image connection: no images).
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  const activities = root.getByRole("list", { name: "Things to do with Kai Ardent" });
  expect(
    await activities
      .locator(".of-activity")
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.activity)),
  ).toEqual(["read-him", "read-me", "tarot", "date-night", "photo-shoot", "claw"]);
  const card = root.locator('.of-activity[data-activity="tarot"]');
  await expect(card.getByRole("heading", { name: "Tarot night with Kai Ardent" })).toBeVisible();
  await expect(card).toContainText("+40 Starlight · +40 affection");
  await expect(card.locator(".of-cost")).toHaveText("1 model call");
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("01-dates.png") });
  await press(root.getByRole("button", { name: "Play: Tarot night with Kai Ardent" }));
  await expect(root.getByRole("heading", { level: 1, name: "Tarot night with Kai Ardent" })).toBeFocused();

  // The intro: who reads (Kai Ardent by default), a question chip or words of one's own, and the pay; no paint cost.
  await expect(root.getByRole("radio", { name: /Kai Ardent reads my cards/u })).toBeChecked();
  await expect(root.getByRole("radio", { name: /I read Kai Ardent’s cards/u })).not.toBeChecked();
  const own = root.getByRole("textbox", { name: "Or ask in your own words" });
  await expect(own).toHaveAttribute("maxlength", "200");
  await press(root.getByRole("button", { name: "What’s coming" }));
  await expect(root.getByRole("button", { name: "What’s coming" })).toHaveAttribute("aria-pressed", "true");
  await expect(root).toContainText("+40 Starlight and +40 affection, within today’s rewards.");
  await expect(root.getByText(/Paints \d image/u)).toHaveCount(0);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("02-intro.png"), fullPage: true });
  await press(root.getByRole("button", { name: "Choose your cards" }));

  // The pick: 22 face-down cards, three picked in order and numbered; Turn the cards waits for the third.
  await expect(root.getByRole("heading", { name: "Choose three cards" })).toBeFocused();
  const backs = root.getByRole("button", { name: /^Card \d+, face down$/u });
  await expect(backs).toHaveCount(22);
  const turnCards = root.getByRole("button", { name: "Turn the cards" });
  await expect(turnCards).toHaveAttribute("aria-disabled", "true");
  for (const number of [5, 12, 18]) await press(root.getByRole("button", { name: `Card ${number}, face down` }));
  await expect(root.getByRole("button", { name: "Card 12, face down" })).toHaveAttribute("aria-pressed", "true");
  await expect(root.locator(".of-tarot-order")).toHaveText(["1", "2", "3"]);
  await expect(root.getByRole("status").filter({ hasText: "of 3 chosen" })).toHaveText("3 of 3 chosen");
  // A fourth tap changes nothing; tapping a picked card again lets it go.
  await press(root.getByRole("button", { name: "Card 1, face down" }));
  await expect(root.getByRole("button", { name: "Card 1, face down" })).toHaveAttribute("aria-pressed", "false");
  if (mobile) {
    const box = await root.getByRole("button", { name: "Card 1, face down" }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("03-pick.png") });
  await recordSpeech(page);
  // While he lays out the cards, the personality quiz waits under the status, and takes no focus.
  const release = await hold(page, "**/runs/*/tarot");
  await press(turnCards);
  await expect(root.getByRole("status").filter({ hasText: "Kai Ardent lays out the cards" })).toBeVisible();
  const play = root.getByRole("button", { name: "Play the personality quiz" });
  await expect(play).toBeVisible();
  await expect(play).not.toBeFocused();
  release();
  await page.unroute("**/runs/*/tarot");

  // Play: the context opens it, his opening line is voiced and focused, and every card lies face down.
  await expect(root.getByRole("heading", { name: "The reading begins" })).toBeFocused();
  await expect(root).toContainText("Kai Ardent spreads a velvet cloth over the lock wall");
  await expect(root).toContainText("Your question: What’s coming");
  await expect(line(root)).toHaveText("Ask, and I will read them true.");
  await expect(root.getByRole("button", { name: "Turn the Past card" })).toBeVisible();
  await heard(page, "0");
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("04-opening.png") });

  // Each card turns by a tap on it or Turn the next card; its name and orientation are read out, focus moves to it.
  await press(root.getByRole("button", { name: "Turn the Past card" }));
  await expect(root.getByRole("heading", { name: "Past: The Tower, reversed" })).toBeFocused();
  const tower = root.getByRole("img", { name: "Past: The Tower, reversed" });
  await expect(tower).toBeVisible();
  await expect(tower.locator("text")).toHaveText(["XVI", "REVERSED", "The Tower"]);
  await expect(line(root)).toHaveText("Card 1 turns, and Kai Ardent smiles at it.");
  await heard(page, "1");
  await page.screenshot({ path: testInfo.outputPath("05-past.png") });
  await press(root.getByRole("button", { name: "Turn the next card" }));
  await expect(root.getByRole("heading", { name: "Present: The Lovers" })).toBeFocused();
  await heard(page, "2");
  await press(root.getByRole("button", { name: "Turn the Future card" }));
  await expect(root.getByRole("heading", { name: "Future: The Star" })).toBeFocused();
  await heard(page, "3");
  // A turned card opens large; Escape closes it and gives focus back.
  const pastCard = root.getByRole("button", { name: "Past: The Tower, reversed" });
  await press(pastCard);
  const dialog = page.getByRole("dialog", { name: "Past: The Tower, reversed" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Past: The Tower, reversed" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("06-large.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pastCard).toBeFocused();
  // No image connection: our cards only, with no paint controls.
  await expect(root.locator(".of-tarot-art")).toHaveCount(0);
  await expect(root.getByRole("button", { name: /Paint|Try painting/u })).toHaveCount(0);
  await noWider(page);
  await press(root.getByRole("button", { name: "Close the reading" }));

  // Done: the closing, voiced; paid once.
  await expect(root.getByRole("heading", { name: "The cards are read" })).toBeFocused();
  await expect(line(root)).toHaveText("That is all the cards will say tonight.");
  await heard(page, "closing");
  await expect(root.locator(".of-tarot-done .of-grants")).toContainText("+40 Starlight");
  await expect(root.locator(".of-tarot-done .of-grants")).toContainText("Kai Ardent · +40 affection");
  await expect(root.locator(".of-starlight")).toContainText((2040).toLocaleString("en-US"));
  expect(posts(stub, "/tarot").map(fields)).toEqual([
    { li: KAI, mode: "reads-you", question: { chip: "coming" }, picks: [4, 11, 17] },
  ]);
  expect(posts(stub, "/finish").map(fields)).toEqual([{}]);
  expect(posts(stub, "/answer")).toHaveLength(0);
  const keys = (await voiced(page)).map((entry) => entry.cacheKey);
  expect(keys).toEqual(["0", "1", "2", "3", "closing"].map((ref) => `otome-forge:${RUN}:tarot:${READING}:${ref}`));
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("07-done.png"), fullPage: true });

  // Another reading starts at the intro again, focus on its heading.
  await press(root.getByRole("button", { name: "Another reading" }));
  await expect(root.getByRole("radio", { name: /Kai Ardent reads my cards/u })).toBeVisible();
  await expect(root.getByRole("heading", { level: 1, name: "Tarot night with Kai Ardent" })).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth Tarot night: I read Kai Ardent's cards, by fate or keys, in my own voice, and pick up where I left", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "dark" : "light", reducedMotion: "reduce" });
  const stub = createTarotStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());
  await openTarot(root);

  // You read: no question field; the love interest asks.
  await press(root.getByText("I read Kai Ardent’s cards"));
  await expect(root.getByRole("radio", { name: /I read Kai Ardent’s cards/u })).toBeChecked();
  await expect(root.getByRole("textbox", { name: "Or ask in your own words" })).toHaveCount(0);
  await press(root.getByRole("button", { name: "Choose your cards" }));
  await expect(root.getByRole("heading", { name: "Choose three cards" })).toBeFocused();

  if (mobile) {
    await press(root.getByRole("button", { name: "Let fate choose" }));
    // Fate picks three places at random: the badges, in the deck's order, number them 1 to 3 in the order picked.
    await expect(root.locator(".of-tarot-order")).toHaveCount(3);
    expect((await root.locator(".of-tarot-order").allTextContents()).sort()).toEqual(["1", "2", "3"]);
  } else {
    // The keyboard: one card in the tab order, arrows and Home/End move, Space and Enter pick.
    await page.keyboard.press("Tab");
    await expect(root.getByRole("button", { name: "Card 1, face down" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(root.getByRole("button", { name: "Card 3, face down" })).toBeFocused();
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowDown");
    const below = await root.locator(".of-tarot-back-button:focus").getAttribute("aria-label");
    expect(below).toMatch(/^Card (?:[4-9]|1\d), face down$/u);
    await page.keyboard.press("Enter");
    await page.keyboard.press("End");
    await expect(root.getByRole("button", { name: "Card 22, face down" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Home");
    await expect(root.getByRole("button", { name: "Card 1, face down" })).toBeFocused();
    await expect(root.getByRole("button", { name: /face down/u, pressed: true })).toHaveCount(3);
    await expect(root.locator(".of-tarot-back-button[tabindex='0']")).toHaveCount(1);
  }
  await recordSpeech(page);
  await press(root.getByRole("button", { name: "Turn the cards" }));

  // His question first, then the Past card: three readings, no reaction before one is picked.
  await expect(root.getByRole("heading", { name: "The reading begins" })).toBeFocused();
  await expect(line(root)).toHaveText("Read mine, then. Will I ever stop running?");
  await heard(page, "0");
  // The spread stays mounted as cards turn, so the Past card flips in place rather than being rebuilt face up.
  const pastFace = await root.locator(".of-tarot-spread .of-tarot-card").first().elementHandle();
  expect(await pastFace!.evaluate((element) => element.getAttribute("data-turned"))).toBe("false");
  await press(root.getByRole("button", { name: "Turn the first card" }));
  await expect(root.getByRole("heading", { name: "Past: The Tower, reversed" })).toBeFocused();
  expect(await pastFace!.evaluate((element) => element.isConnected && element.getAttribute("data-turned"))).toBe(
    "true",
  );
  const readings = root.getByRole("group", { name: "How do you read it?" }).getByRole("button");
  await expect(readings).toHaveCount(3);
  await expect(root.getByText(/Reaction \d/u)).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Turn the next card" })).toHaveCount(0);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("01-readings.png") });
  // A key pressed in the large card's dialog never answers the card behind it.
  const pastCard = root.getByRole("button", { name: "Past: The Tower, reversed" });
  await press(pastCard);
  const large = page.getByRole("dialog", { name: "Past: The Tower, reversed" });
  await expect(large).toBeVisible();
  await page.keyboard.press("3");
  await page.keyboard.press("Escape");
  await expect(large).toHaveCount(0);
  await expect(pastCard).toBeFocused();
  await expect(readings).toHaveCount(3);
  if (mobile) await readings.nth(1).tap();
  else await page.keyboard.press("2");
  const next = root.getByRole("button", { name: "Turn the next card" });
  await expect(next).toBeFocused();
  await expect(root.locator(".of-rm-said")).toHaveText("Mira Vale: “Reading 1.2: you keep a door open.”");
  await expect(line(root)).toHaveText("Reaction 1.2: maybe I do.");
  await heard(page, "1:you");
  await heard(page, "1:reaction");
  // Her reading in her persona's voice, his reaction in his.
  const spoken = await voiced(page);
  const yours = spoken.find((entry) => entry.cacheKey.endsWith(":1:you"))!;
  const his = spoken.find((entry) => entry.cacheKey.endsWith(":1:reaction"))!;
  expect([yours.voice, yours.characterId, his.voice]).toEqual(["Mira Voice", "persona-mira", "Kai Voice"]);
  await page.screenshot({ path: testInfo.outputPath("02-answered.png") });

  // The Present card: leave half-way, then come back: it opens straight at the card it stopped on.
  await press(next);
  await expect(root.getByRole("heading", { name: "Present: The Lovers" })).toBeFocused();
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
  await press(root.getByRole("button", { name: "Play: Tarot night with Kai Ardent" }));
  await expect(root.getByRole("group", { name: "How do you read it?" })).toBeVisible();
  await expect(line(root)).toHaveText("Card 2 turns, and Kai Ardent smiles at it.");
  await expect(root.getByRole("img", { name: "Past: The Tower, reversed" })).toBeVisible();
  await expect(root.getByRole("img", { name: "Present: The Lovers" })).toBeVisible();
  await expect(root.getByRole("radio")).toHaveCount(0);
  expect(posts(stub, "/tarot")).toHaveLength(1);
  if (mobile) await readings.first().tap();
  else await page.keyboard.press("1");
  await expect(root.getByRole("button", { name: "Turn the next card" })).toBeFocused();
  await press(root.getByRole("button", { name: "Turn the next card" }));
  await expect(root.getByRole("heading", { name: "Future: The Star" })).toBeFocused();
  await press(readings.last());
  await expect(root.getByRole("button", { name: "Close the reading" })).toBeFocused();
  await press(root.getByRole("button", { name: "Close the reading" }));
  await expect(root.getByRole("heading", { name: "The cards are read" })).toBeFocused();
  await expect(root.locator(".of-tarot-done .of-grants")).toContainText("+40 Starlight");
  expect(posts(stub, "/answer").map(fields)).toEqual([
    { card: 0, pick: 1 },
    { card: 1, pick: 0 },
    { card: 2, pick: 2 },
  ]);
  expect(posts(stub, "/tarot").map(fields)).toEqual([
    { li: KAI, mode: "you-read", picks: expect.any(Array) as unknown as number[] },
  ]);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("03-done.png"), fullPage: true });
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth Tarot night: with Ask before painting, Paint these cards paints and each card shows its picture", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createTarotStub({ images: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  await expect(root.locator('.of-activity[data-activity="tarot"] .of-cost')).toHaveText(
    "1 model call · up to 3 images, only for cards not painted yet",
  );
  await press(root.getByRole("button", { name: "Play: Tarot night with Kai Ardent" }));
  await expect(root.locator(".of-tarot-intro .of-cost")).toHaveText(
    "Paints up to 3 images, only for cards not painted yet, each painted once and kept",
  );
  await press(root.getByRole("button", { name: "Choose your cards" }));
  await press(root.getByRole("button", { name: "Let fate choose" }));
  await press(root.getByRole("button", { name: "Turn the cards" }));
  await expect(root.getByRole("heading", { name: "The reading begins" })).toBeFocused();

  // The drawn cards wait for the tap: one bar for the cards turned so far, with what it costs (a face-down card is
  // never named, by its review either); nothing is painted yet.
  const bar = root.locator(".of-tarot-paint");
  await expect(bar).toHaveCount(0);
  await press(root.getByRole("button", { name: "Turn the Past card" }));
  await expect(bar.getByRole("button", { name: "Paint these cards" })).toBeVisible();
  await expect(bar).toContainText("Paints 1 image");
  for (const turn of ["Turn the Present card", "Turn the Future card"]) {
    await press(root.getByRole("button", { name: turn }));
  }
  await expect(bar).toContainText("Paints 3 images");
  expect(posts(stub, "/art/tarot")).toHaveLength(0);
  await expect(root.locator(".of-tarot-art")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("01-waiting.png") });
  await press(bar.getByRole("button", { name: "Paint these cards" }));
  await expect(bar).toHaveCount(0);
  // Each card swaps to its picture, inside our frame (the numeral and name stay on top).
  await expect(root.locator(".of-tarot-spread .of-tarot-art")).toHaveCount(3);
  await expect(root.locator('svg[data-card="tower"] .of-tarot-art')).toHaveAttribute("href", `${FILE}/card-tower.png`);
  await expect(root.getByRole("img", { name: "Present: The Lovers" }).locator("text").last()).toHaveText("The Lovers");
  expect(
    posts(stub, "/art/tarot")
      .map(fields)
      .map((body) => body.card)
      .sort(),
  ).toEqual(["lovers", "star", "tower"]);
  expect(posts(stub, "/art/tarot").map(fields)[0]).toMatchObject({ li: KAI });
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("02-painted.png") });
  await press(root.getByRole("button", { name: "Close the reading" }));
  await expect(root.getByRole("heading", { name: "The cards are read" })).toBeFocused();
  await expect(root.locator(".of-tarot-done .of-tarot-art")).toHaveCount(3);
  expect(pageErrors).toEqual([]);
});
