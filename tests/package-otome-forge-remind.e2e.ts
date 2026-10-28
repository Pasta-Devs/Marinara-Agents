// Otome Forge's Remind Me and period tracker (M6) in the Engine's Home tab, with /api/otome-forge/** stubbed: the
// calendar with his birthday, the story's first day and the month grid by keyboard; the tracker off by default with
// its agreed copy; opting in and logging a first day; filled "logged" and outlined "predicted" hearts; a stubbed
// Caring message that carries exactly one line about today (no other request, query string or body says anything
// about the cycle), kept for the day with no second request and voiced with no cacheKey (a spy on the host's voice
// service); "Keep it off the model" sending nothing; and Delete all. Then, with Otome Forge's storage blocked (a private
// window), Remind Me and the tracker still render and say what they could not keep. Across midnight, an open caring
// message closes, one still on its way is not kept for yesterday, and focus stays on Home when its button goes. In two
// tabs, a mode, a change or a Delete all made in the other one is what counts. At a phone browser's 390 × 664 the rail
// never covers the note's Play button.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-remind.e2e.ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const catalog: Record<string, string> = JSON.parse(
  readFileSync(
    resolve(__dirname, "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/locales/en.json"),
    "utf8",
  ),
);
const comfortFallback = Object.entries(catalog)
  .filter(([key]) => key.startsWith("ui.otomeForge.fallback.comfort"))
  .map(([, text]) => `“${text}”`);

type Json = Record<string, any>;
interface Call {
  method: string;
  path: string;
  body: Json | undefined;
  /** The request's `timeZone` (query or body): the conversation's zone. */
  zone: string | null;
}

const RUN = "r-e2e-remind1";
const ILVAR = "li-ilvar-0001";
const CASSIAN = "li-cassian-0002";
const CARE_NOTE = "Blanket, tea, and no arguments tonight. I’ll keep the kettle warm.";
const CYCLE_KEY = "otome-forge:cycle:v1";
const CARE_KEY = "otome-forge:care-note:v1";

/** The local date in the conversation's zone, which every request names. */
const dayIn = (zone: string, date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
/** The first instant after `from` (ms) when the local date in `zone` changes. */
function nextMidnight(zone: string, from: number): number {
  const day = dayIn(zone, new Date(from));
  let [low, high] = [from, from + 48 * 3_600_000];
  while (high - low > 1_000) {
    const middle = Math.floor((low + high) / 2);
    if (dayIn(zone, new Date(middle)) === day) low = middle;
    else high = middle;
  }
  return high;
}
const shift = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const longDate = (day: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));

function createRemindStub() {
  const calls: Call[] = [];
  /** While set, the care-note answer waits for it (a slow provider). */
  let careGate: Promise<void> | null = null;
  const now = () => new Date().toISOString();
  let zone = "UTC";
  const today = () => dayIn(zone, new Date());
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
      images: { connectionId: null, rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
    },
    player: {
      personaId: "persona-mira",
      name: "Mira Vale",
      pronouns: { subject: "she", object: "her", possessive: "her" },
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
    },
    lis: [
      { id: ILVAR, name: "Ilvar Thorne", pronouns, source: "card", accent: "#9DB8F0", level: 2, stage: 2 },
      { id: CASSIAN, name: "Cassian", pronouns, source: "archetype", accent: "#E7A6B8", level: 1, stage: 1 },
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
  const home = { li: ILVAR as string, show: "him" as "him" | "me" };
  const note = (li: string) => ({
    li,
    dayKey: today(),
    text: li === ILVAR ? "The lab light was on again." : "The canals froze at dawn.",
    face: "",
    mood: { word: "calm", reason: "quiet morning" },
    at: now(),
  });

  const answer = (call: Call): { status: number; json: unknown; headers?: Record<string, string> } => {
    calls.push(call);
    if (call.zone) zone = call.zone;
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (path === base) return { status: 200, json: { view: structuredClone(view) } };
    if (path === `${base}/home`) {
      return {
        status: 200,
        json: {
          li: home.li,
          show: home.show,
          note: note(home.li),
          look: null,
          faces: {},
          lines: { ready: true },
          rupture: false,
          unread: 0,
        },
      };
    }
    if (path === `${base}/home/set`) {
      if (call.body!.li) home.li = call.body!.li;
      return { status: 200, json: { home } };
    }
    if (path === `${base}/home/note`) return { status: 200, json: { note: note(call.body!.li) } };
    const lines = /^\/runs\/[^/]+\/lis\/([^/]+)\/lines$/u.exec(path);
    if (lines) {
      // Cassian's comfort lines aren't written yet: the catalog's stand in.
      return {
        status: 200,
        json: {
          ready: true,
          stage: 2,
          rupture: false,
          tap: null,
          annoyed: [],
          cold: [],
          comfort: lines[1] === ILVAR ? ["Sit. Tea first, then everything else."] : [],
          claw: null,
        },
      };
    }
    if (path === `${base}/calendar`) {
      return {
        status: 200,
        json: {
          birthdays: [
            { li: ILVAR, md: shift(today(), 3).slice(5) },
            { li: "li-gone-9999", md: today().slice(5) },
            { li: CASSIAN, md: "02-31" },
          ],
          anniversaries: [
            { md: today().slice(5), label: "The Clockwork Masquerade", year: Number(today().slice(0, 4)) },
          ],
          bannerEnds: [],
        },
      };
    }
    if (path === `${base}/care-note`) {
      return { status: 200, json: { note: CARE_NOTE, source: "model" }, headers: { "cache-control": "no-store" } };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  /** Holds the next care-note answers until the returned function is called. */
  const holdCare = () => {
    let release = () => {};
    careGate = new Promise<void>((resolve) => (release = resolve));
    return () => {
      careGate = null;
      release();
    };
  };
  return { calls, answer, zone: () => zone, holdCare, careGate: () => careGate };
}

type Stub = ReturnType<typeof createRemindStub>;

/** Every request to the Engine's /api, Otome Forge's or not: its path with the query string, and its raw body. */
interface Seen {
  method: string;
  url: string;
  body: string;
}

async function stubRoutes(page: Page, stub: Stub, spoken: string[]): Promise<Seen[]> {
  const seen: Seen[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      seen.push({ method: request.method(), url: url.pathname + url.search, body: request.postData() ?? "" });
    }
  });
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === "POST" ? request.postDataJSON() : undefined;
    const gate = url.pathname.endsWith("/care-note") ? stub.careGate() : null;
    if (gate) await gate;
    const { status, json, headers } = stub.answer({
      method: request.method(),
      path: url.pathname,
      body,
      zone: url.searchParams.get("timeZone") ?? body?.timeZone ?? null,
    });
    await route.fulfill({ status, json, headers });
  });
  await page.route("**/api/connections", (route) =>
    route.fulfill({ json: [{ id: "conn-text", name: "Nocturne", provider: "openai", model: "night-1" }] }),
  );
  await page.route("**/api/tts/speak", async (route) => {
    spoken.push(String(route.request().postDataJSON()?.text ?? ""));
    await route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) });
  });
  return seen;
}

/**
 * Records what the host's voice service is asked to say, and with which cacheKey, by wrapping the Engine's own
 * ttsService.speak (the object the package calls). Fails when there is no such service to watch, never skips.
 */
async function spyOnVoice(page: Page) {
  const found = await page.evaluate(() => {
    const host = (globalThis as unknown as { __MARINARA_HOST__?: any }).__MARINARA_HOST__;
    const service = host?.services?.tts?.ttsService;
    if (!service || typeof service.speak !== "function") return false;
    const speak = service.speak.bind(service);
    const asked: Array<{ text: string; cacheKey: string | null }> = [];
    (window as unknown as { __voiceAsked: typeof asked }).__voiceAsked = asked;
    service.speak = (text: string, id?: string, options?: { cacheKey?: string }) => {
      asked.push({ text, cacheKey: options?.cacheKey ?? null });
      return speak(text, id, options);
    };
    return true;
  });
  expect(found, "the host's voice service to watch").toBe(true);
  return () =>
    page.evaluate(
      () => (window as unknown as { __voiceAsked: Array<{ text: string; cacheKey: string | null }> }).__voiceAsked,
    );
}

/** Seeds the tracker (and nothing else), then goes to Remind Me and back so Home reads it as it opens. */
async function seedTracker(page: Page, root: Locator, value: Json) {
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: CYCLE_KEY,
    data: value,
  });
  await root.getByRole("button", { name: "Remind Me" }).click();
  await root.getByRole("button", { name: "Back" }).click();
}

const tracker = (starts: string[], patch: Json = {}) => ({
  version: 1,
  enabled: true,
  mode: "send-today",
  cycleLength: 28,
  periodLength: 5,
  irregular: false,
  starts,
  ...patch,
});

async function openHome(page: Page): Promise<Locator> {
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
  await page.getByRole("tab", { name: "Open Otome Forge" }).click();
  const root = page.locator("marinara-capability-otome-forge .of-root");
  await expect(root).toBeVisible({ timeout: 60_000 });
  return root;
}

const stored = (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(name), key);
const posts = (stub: Stub, suffix: string) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));

/** No horizontal scroll anywhere on the stage (390 px included). */
async function expectNoSideways(root: Locator) {
  const overflow = await root.evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>(".of-page, .of-month, .of-month-grid")]
      .filter((node) => node.scrollWidth > node.clientWidth + 1)
      .map((node) => node.className),
  );
  expect(overflow).toEqual([]);
}

test("Otome Forge Remind Me: the calendar, the tracker off by default, hearts, a Caring message and Delete all", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ colorScheme: "dark" });
  const stub = createRemindStub();
  const spoken: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const seen = await stubRoutes(page, stub, spoken);
  const root = await openHome(page);
  const voiceAsked = await spyOnVoice(page);

  // Off by default: Home has no Caring message, and nothing is stored.
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();
  const zone = stub.zone();
  const today = dayIn(zone, new Date());
  await expect(root.getByRole("button", { name: "Caring message" })).toHaveCount(0);
  expect(await stored(page, CYCLE_KEY)).toBeNull();

  // Remind Me: focus lands on its heading; his birthday is coming up, the story began today.
  await root.getByRole("button", { name: "Remind Me" }).click();
  const heading = root.getByRole("heading", { level: 1, name: "Remind Me" });
  await expect(heading).toBeFocused();
  const grid = root.getByRole("grid");
  const todayCell = grid.locator(`[data-day="${today}"]`);
  await expect(todayCell).toHaveAttribute("aria-current", "date");
  await expect(todayCell).toHaveAttribute("aria-selected", "true");
  await expect(todayCell).toHaveAccessibleName(`${longDate(today)}: “The Clockwork Masquerade” began`);
  const upcoming = root.getByRole("region", { name: "Coming up" });
  await expect(upcoming).toContainText("Ilvar Thorne’s birthday");
  await expect(upcoming).toContainText("in 3 days");
  // A birthday for someone not in the cast, or on a day no year has, is never drawn.
  await expect(root.locator(".of-day-events")).not.toContainText("li-gone");
  await expect(root.getByText("Period tracker — for anyone who has periods. Off by default.")).toBeVisible();
  await expect(root.getByRole("group", { name: "What the hearts mean" })).toHaveCount(0);
  await expectNoSideways(root);
  await page.screenshot({ path: testInfo.outputPath("01-remind-off.png") });

  // The grid by keyboard: a day on, a week down, a month on and back, then home again.
  await todayCell.focus();
  await page.keyboard.press("ArrowRight");
  const tomorrow = grid.locator(`[data-day="${shift(today, 1)}"]`);
  await expect(tomorrow).toBeFocused();
  await expect(tomorrow).toHaveAttribute("aria-selected", "true");
  await expect(root.getByRole("heading", { level: 2, name: longDate(shift(today, 1)) })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(todayCell).toBeFocused();
  const monthTitle = root.locator(".of-month-title");
  const thisMonth = await monthTitle.textContent();
  await page.keyboard.press("PageDown");
  await expect(monthTitle).not.toHaveText(thisMonth!);
  await page.keyboard.press("PageUp");
  await expect(monthTitle).toHaveText(thisMonth!);
  await expect(grid.locator('[aria-selected="true"]')).toBeFocused();

  // The tracker, opened from Remind Me: off, with the agreed copy word for word.
  await root.getByRole("button", { name: "Open the tracker" }).click();
  const trackerTab = root.getByRole("tab", { name: "Tracker" });
  await expect(trackerTab).toHaveAttribute("aria-selected", "true");
  // Brought into the tab strip, even at phone width.
  const [tabBox, stripBox] = [await trackerTab.boundingBox(), await root.getByRole("tablist").boundingBox()];
  expect(tabBox!.x).toBeGreaterThanOrEqual(stripBox!.x - 1);
  expect(tabBox!.x + tabBox!.width).toBeLessThanOrEqual(stripBox!.x + stripBox!.width + 1);
  const toggle = root.getByRole("switch", { name: "Period tracker — for anyone who has periods. Off by default." });
  await expect(toggle).not.toBeChecked();
  await expect(root.getByText("Stored only in Otome Forge's storage on this device.")).toBeVisible();
  await toggle.check();
  await expect(
    root.getByText(
      "One line about today (e.g. 'day 2 of their period') goes to your model provider (Nocturne). With a cloud provider it leaves your device. Pressing Play also sends the note to your voice provider.",
    ),
  ).toBeVisible();
  await expect(root.getByRole("radio", { name: /Send today’s line/ })).toBeChecked();
  expect(JSON.parse((await stored(page, CYCLE_KEY))!)).toMatchObject({ enabled: true, mode: "send-today", starts: [] });

  // Yesterday was the first day, so today is day 2.
  const yesterday = shift(today, -1);
  await root.getByLabel("Log an earlier first day").fill(yesterday);
  await root.getByRole("button", { name: "Add", exact: true }).click();
  await expect(root.getByText("Today is day 2 of your period.")).toBeVisible();
  expect(JSON.parse((await stored(page, CYCLE_KEY))!).starts).toEqual([yesterday]);
  await page.screenshot({ path: testInfo.outputPath("02-tracker-on.png") });

  // Back on Remind Me: filled hearts for the logged days, outlined ones labelled "predicted" for the rest.
  await root.getByRole("button", { name: "Back" }).click();
  await expect(heading).toBeFocused();
  await expect(root.getByRole("group", { name: "What the hearts mean" })).toContainText("Logged");
  await expect(root.getByRole("group", { name: "What the hearts mean" })).toContainText("Predicted");
  await expect(todayCell).toHaveAttribute("data-cycle", "logged");
  await expect(todayCell.locator('.of-cycle-heart[data-mark="logged"]')).toHaveAttribute("fill", "currentColor");
  const predictedDay = shift(today, 1);
  if (predictedDay.slice(0, 7) !== today.slice(0, 7)) await root.getByRole("button", { name: "Next month" }).click();
  const predictedCell = grid.locator(`[data-day="${predictedDay}"]`);
  await expect(predictedCell).toHaveAttribute("data-cycle", "predicted");
  await expect(predictedCell).toHaveAccessibleName(/Period day \(predicted\)/);
  await expect(predictedCell.locator('.of-cycle-heart[data-mark="predicted"]')).toHaveAttribute("fill", "none");
  await expect(upcoming).toContainText("Period predicted to start");
  await expectNoSideways(root);
  await page.screenshot({ path: testInfo.outputPath("03-remind-hearts.png") });

  // Home: Caring message, once. The request carries exactly one line about today and nothing else.
  await root.getByRole("button", { name: "Back" }).click();
  const caring = root.getByRole("button", { name: "Caring message" });
  await expect(caring).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("04-home-caring.png") });
  await caring.click();
  const dialog = page.getByRole("dialog", { name: "A caring message" });
  await expect(dialog).toContainText(CARE_NOTE);
  const sent = posts(stub, "/care-note");
  expect(sent).toHaveLength(1);
  expect(sent[0]!.body).toEqual({
    li: ILVAR,
    careLine: "Mira Vale has told you: today is day 2 of her period.",
    timeZone: zone,
    debugMode: false,
  });
  // No other request to the Engine, Otome Forge's or not, ever carried anything about the cycle: not in its path,
  // its query string or its body. Only the one care-note POST names it, and no request names a logged day.
  const aboutCycle = (entry: Seen) => /period|cycle|starts/iu.test(entry.url + entry.body);
  expect(seen.filter(aboutCycle).map((entry) => `${entry.method} ${entry.url}`)).toEqual([
    `POST /api/otome-forge/runs/${RUN}/care-note`,
  ]);
  expect(seen.filter((entry) => (entry.url + entry.body).includes(yesterday))).toEqual([]);
  await expect(dialog).not.toContainText("Reply");

  // Play voices it with no cacheKey, so its audio never lands in the Engine's audio cache.
  await dialog.getByRole("button", { name: "Hear Ilvar Thorne say it" }).click();
  await expect.poll(() => spoken).toContain(CARE_NOTE);
  const voiced = (await voiceAsked()).filter((entry) => entry.text === CARE_NOTE);
  expect(voiced.length).toBeGreaterThan(0);
  expect(voiced.every((entry) => entry.cacheKey === null)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("05-caring-message.png") });
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(caring).toBeFocused();

  // Kept for today: opening it again asks nothing more.
  expect(JSON.parse((await stored(page, CARE_KEY))!)).toMatchObject({ dayKey: today });
  await caring.click();
  await expect(dialog).toContainText(CARE_NOTE);
  expect(posts(stub, "/care-note")).toHaveLength(1);
  await dialog.getByRole("button", { name: "Close" }).click();

  // Keep it off the model: Cassian answers with a catalog comfort line, and no request is made.
  await root.getByRole("button", { name: "Settings" }).click();
  await root.getByRole("tab", { name: "Tracker" }).click();
  await root.getByText("Keep it off the model", { exact: true }).click();
  await expect(root.getByRole("radio", { name: /Keep it off the model/ })).toBeChecked();
  await root.getByRole("button", { name: "Back" }).click();
  await root.getByRole("button", { name: "Who’s home" }).click();
  await page
    .getByRole("dialog", { name: "Who’s home" })
    .getByRole("button", { name: /Cassian/ })
    .click();
  await expect(root.getByRole("heading", { level: 1, name: "Cassian" })).toBeVisible();
  await root.getByRole("button", { name: "Caring message" }).click();
  await expect(dialog).toContainText("Kept off the model: one of Cassian’s comfort lines, written in advance.");
  expect(comfortFallback).toContain(await dialog.locator(".of-comfort-line").textContent());
  expect(posts(stub, "/care-note")).toHaveLength(1);
  await dialog.getByRole("button", { name: "Close" }).click();

  // Delete all cycle data: one click, both keys gone, the tracker off again, and no Caring message.
  await root.getByRole("button", { name: "Settings" }).click();
  await root.getByRole("tab", { name: "Tracker" }).click();
  await root.getByRole("button", { name: "Delete all cycle data" }).click();
  await expect(
    root.getByText("All cycle data was deleted from this browser, with today’s caring messages."),
  ).toBeVisible();
  await expect(root.getByRole("switch", { name: /Period tracker/ })).not.toBeChecked();
  expect(await stored(page, CYCLE_KEY)).toBeNull();
  expect(await stored(page, CARE_KEY)).toBeNull();
  await root.getByRole("button", { name: "Back" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Cassian" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Caring message" })).toHaveCount(0);
  expect(posts(stub, "/care-note")).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge Remind Me with its storage blocked, at reduced motion in Pearl: everything renders and says what it can't keep", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  // A private window that refuses Otome Forge's storage: every access to its keys throws.
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      const original = Storage.prototype[method] as (...args: string[]) => unknown;
      Storage.prototype[method] = function (this: Storage, ...args: string[]) {
        if (String(args[0]).startsWith("otome-forge:")) throw new DOMException("Blocked", "SecurityError");
        return original.apply(this, args);
      } as never;
    }
  });
  const stub = createRemindStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, []);
  const root = await openHome(page);

  await root.getByRole("button", { name: "Remind Me" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Remind Me" })).toBeFocused();
  await expect(root.getByRole("grid")).toBeVisible();
  await expect(root.getByRole("region", { name: "Coming up" })).toContainText("Ilvar Thorne’s birthday");
  // In Pearl the selected day keeps a 2 px border in its deeper champagne (about 5:1), with focus elsewhere.
  await root.getByRole("button", { name: "Next month" }).focus();
  const selectedBorder = await root
    .locator('.of-day[aria-selected="true"]')
    .evaluate((cell) => `${getComputedStyle(cell).borderTopWidth} ${getComputedStyle(cell).borderTopColor}`);
  expect(selectedBorder).toBe("2px rgb(134, 98, 31)");

  // The birthday's status region is there before anything goes wrong, so the notice is announced as it fills in.
  const birthdayStatus = root.getByRole("region", { name: "Your birthday" }).getByRole("status");
  await expect(birthdayStatus).toHaveCount(1);
  await expect(birthdayStatus).toBeEmpty();

  // The birthday form takes focus as it opens and gives it back to Change as it closes.
  await root.getByRole("button", { name: "Add your birthday" }).click();
  const month = root.getByLabel("Month", { exact: true });
  await expect(month).toBeFocused();
  await month.selectOption("03");
  await root.getByLabel("Day", { exact: true }).selectOption("14");
  await root.getByRole("button", { name: "Save", exact: true }).click();
  await expect(root.getByRole("button", { name: "Change" })).toBeFocused();
  await expect(birthdayStatus).toHaveText(
    "This browser didn’t keep that change: it lasts only while this screen is open.",
  );

  // The tracker turns on for this screen and says it wasn't kept; Delete all says the browser refused.
  await root.getByRole("button", { name: "Open the tracker" }).click();
  const toggle = root.getByRole("switch", { name: /Period tracker/ });
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(
    root.getByText("This browser didn’t keep that change: it lasts only while this screen is open."),
  ).toBeVisible();
  await root.getByRole("button", { name: "Delete all cycle data" }).click();
  await expect(root.getByText(/Cleared here. This browser blocks Otome Forge’s storage/)).toBeVisible();
  await expect(toggle).not.toBeChecked();
  const breathe = await root.locator(".of-screen").evaluate((element) => getComputedStyle(element).animationName);
  expect(breathe).toBe("none");
  await page.screenshot({ path: testInfo.outputPath("06-blocked-storage.png") });
  expect(posts(stub, "/care-note")).toHaveLength(0);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge Caring message across midnight: an open one closes rather than ask again, and the day's note goes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // The page's clock: real time flows on from here, and the test jumps it past midnight.
  await page.clock.install({ time: new Date("2026-11-10T11:00:00Z") });
  const stub = createRemindStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, []);
  const root = await openHome(page);
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();
  const zone = stub.zone();
  const pageNow = await page.evaluate(() => Date.now());
  const today = dayIn(zone, new Date(pageNow));

  // Yesterday was a first day (so today is day 2 and tomorrow day 3), and yesterday's caring message is still stored.
  await page.evaluate(
    ({ cycle, care, stale }) => {
      localStorage.setItem(cycle.key, JSON.stringify(cycle.value));
      localStorage.setItem(care, JSON.stringify(stale));
    },
    {
      cycle: {
        key: CYCLE_KEY,
        value: {
          version: 1,
          enabled: true,
          mode: "send-today",
          cycleLength: 28,
          periodLength: 5,
          irregular: false,
          starts: [shift(today, -1)],
        },
      },
      care: CARE_KEY,
      stale: {
        version: 1,
        dayKey: shift(today, -1),
        notes: { [`${RUN} ${ILVAR}`]: { text: "Old.", source: "model", at: "" } },
      },
    },
  );
  // Home reads the tracker as it opens.
  await root.getByRole("button", { name: "Remind Me" }).click();
  await root.getByRole("button", { name: "Back" }).click();
  await expect.poll(() => stored(page, CARE_KEY)).toBeNull();

  const caring = root.getByRole("button", { name: "Caring message" });
  await caring.click();
  const dialog = page.getByRole("dialog", { name: "A caring message" });
  await expect(dialog).toContainText(CARE_NOTE);
  expect(posts(stub, "/care-note").map((call) => call.body!.careLine)).toEqual([
    "Mira Vale has told you: today is day 2 of her period.",
  ]);

  // Midnight passes with the dialog open: it closes by itself, nothing is asked for the new day, and today's note goes.
  const midnight = nextMidnight(zone, await page.evaluate(() => Date.now()));
  await page.clock.fastForward(midnight - (await page.evaluate(() => Date.now())) + 61_000);
  await expect(dialog).toHaveCount(0);
  expect(posts(stub, "/care-note")).toHaveLength(1);
  await expect.poll(() => stored(page, CARE_KEY)).toBeNull();
  await expect(caring).toBeFocused();

  // Pressed again on the new day: one request, with the new day's line.
  await caring.click();
  await expect(dialog).toContainText(CARE_NOTE);
  expect(posts(stub, "/care-note").map((call) => call.body!.careLine)).toEqual([
    "Mira Vale has told you: today is day 2 of her period.",
    "Mira Vale has told you: today is day 3 of her period.",
  ]);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge Caring message on the last period day: one still on its way at midnight is not kept, and focus stays on Home", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.clock.install({ time: new Date("2026-11-10T11:00:00Z") });
  const stub = createRemindStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, []);
  const root = await openHome(page);
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();
  const zone = stub.zone();
  const today = dayIn(zone, new Date(await page.evaluate(() => Date.now())));
  // Day 5 of 5: tomorrow the tracker has nothing to say, so Caring message goes at midnight.
  await seedTracker(page, root, tracker([shift(today, -4)]));
  const caring = root.getByRole("button", { name: "Caring message" });

  // A slow provider: the note is still on its way when midnight passes.
  const release = stub.holdCare();
  await caring.click();
  const dialog = page.getByRole("dialog", { name: "A caring message" });
  await expect(dialog).toContainText("Ilvar Thorne is writing to you…");
  const midnight = nextMidnight(zone, await page.evaluate(() => Date.now()));
  await page.clock.fastForward(midnight - (await page.evaluate(() => Date.now())) + 61_000);
  await expect(dialog).toHaveCount(0);
  await expect(caring).toHaveCount(0);
  // Its button went with the day: focus waits on Remind Me rather than fall to the page.
  await expect(root.getByRole("button", { name: "Remind Me" })).toBeFocused();

  const answered = page.waitForResponse((response) => response.url().includes("/care-note"));
  release();
  await answered;
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
  expect(await stored(page, CARE_KEY), "yesterday's note is not kept after the day changed").toBeNull();
  expect(posts(stub, "/care-note")).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge in two tabs: a mode, a change or a Delete all made in the other one is what counts", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stub = createRemindStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, []);
  const root = await openHome(page);
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();
  const zone = stub.zone();
  const today = dayIn(zone, new Date());
  const yesterday = shift(today, -1);
  await seedTracker(page, root, tracker([yesterday]));
  const caring = root.getByRole("button", { name: "Caring message" });
  await expect(caring).toBeVisible();
  // The other tab: the same origin, so the same storage; changes there reach this one as storage events.
  const other = await page.context().newPage();
  await other.goto("/");
  const deleteAllThere = () =>
    other.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), [CYCLE_KEY, CARE_KEY]);

  // Delete all in the other tab while a caring message is on its way here: the dialog closes, the button goes, focus
  // stays on Home, and the note that lands afterwards is not kept.
  const release = stub.holdCare();
  await caring.click();
  const dialog = page.getByRole("dialog", { name: "A caring message" });
  await expect(dialog).toContainText("Ilvar Thorne is writing to you…");
  await deleteAllThere();
  await expect(dialog).toHaveCount(0);
  await expect(caring).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Remind Me" })).toBeFocused();
  const answered = page.waitForResponse((response) => response.url().includes("/care-note"));
  release();
  await answered;
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
  expect(await stored(page, CARE_KEY)).toBeNull();
  expect(await stored(page, CYCLE_KEY)).toBeNull();

  // Turned on again over there: Caring message comes back here without a reload.
  await other.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: CYCLE_KEY,
    data: tracker([yesterday]),
  });
  await expect(caring).toBeVisible();

  // "Keep it off the model" chosen where this tab never heard of it (no event): the press reads it and sends nothing.
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: CYCLE_KEY,
    data: tracker([yesterday], { mode: "keep-off-model" }),
  });
  await caring.click();
  await expect(dialog).toContainText("Kept off the model: one of Ilvar Thorne’s comfort lines, written in advance.");
  expect(posts(stub, "/care-note")).toHaveLength(1);
  await dialog.getByRole("button", { name: "Close" }).click();

  // Remind Me logs a start on the tracker as stored now: a change it never heard of (irregular) stays.
  await root.getByRole("button", { name: "Remind Me" }).click();
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: CYCLE_KEY,
    data: tracker([yesterday], { mode: "keep-off-model", irregular: true }),
  });
  const grid = root.getByRole("grid");
  const earlier = shift(today, -30);
  while (!(await grid.locator(`[data-day="${earlier}"]`).count())) {
    await root.getByRole("button", { name: "Previous month" }).click();
  }
  await grid.locator(`[data-day="${earlier}"]`).click();
  await root.getByRole("button", { name: "My period started this day" }).click();
  expect(JSON.parse((await stored(page, CYCLE_KEY))!)).toMatchObject({
    mode: "keep-off-model",
    irregular: true,
    starts: [earlier, yesterday],
  });

  // Delete all over there: this screen follows at once, and nothing it held is written back.
  await deleteAllThere();
  await expect(root.getByRole("button", { name: /My period started this day|Remove this first day/ })).toHaveCount(0);
  await expect(root.getByRole("group", { name: "What the hearts mean" })).toHaveCount(0);
  expect(await stored(page, CYCLE_KEY)).toBeNull();
  await other.close();
  expect(pageErrors).toEqual([]);
});

for (const size of [
  { width: 390, height: 664 },
  { width: 375, height: 667 },
]) {
  test(`Otome Forge Home at ${size.width} × ${size.height} with Caring message: the rail never covers the note's Play`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(size);
    const stub = createRemindStub();
    const spoken: string[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await stubRoutes(page, stub, spoken);
    const root = await openHome(page);
    await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();
    await seedTracker(page, root, tracker([shift(dayIn(stub.zone(), new Date()), -1)]));
    await expect(root.getByRole("button", { name: "Caring message" })).toBeVisible();

    // Clicked where it is drawn: Playwright refuses when another element would take the click.
    await root.getByRole("button", { name: "Hear Ilvar Thorne read the note" }).click();
    await expect.poll(() => spoken).toContain("The lab light was on again.");
    const [rail, note] = await Promise.all([
      root.locator(".of-home-rail").boundingBox(),
      root.locator(".of-note").first().boundingBox(),
    ]);
    expect(rail!.y, "the rail stays under the note").toBeGreaterThanOrEqual(note!.y + note!.height - 1);
    for (const button of await root.locator(".of-home-rail > *").all()) await expect(button).toBeInViewport();
    expect(pageErrors).toEqual([]);
  });
}
