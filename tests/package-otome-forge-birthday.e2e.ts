// Otome Hearth's birthdays (#2153) in the Engine's Home tab, with /api/otome-forge/** stubbed. Two birthdays are open:
// Home's Remind Me carries a dot and the name "Remind Me · a birthday to celebrate"; Remind Me lists both under
// Birthdays to celebrate (today's, and one 3 days late with the day it can still be celebrated until) and drops
// malformed rows. Celebrate opens the sheet: the gift radio group works by keyboard, the cost line shows, and each
// refusal has its own message (409 conflict, 409 locked, 404) and reads again what it changed. Then Celebrate posts
// {li, gift}, the scene opens in the reader under its localized title, and leaving it returns to Remind Me, where the row now
// offers Play the scene. Escape closes the sheet and gives focus back to Celebrate. With no gift owned there is no
// picker, only where to buy one, and Celebrate posts {li}. On a desktop and a 390 px phone, nothing scrolls sideways,
// and on the phone each row's button is full width under its words, at least 44 px tall.
// Then in Pearl (at 375 px on the phone): the rows' words and the buttons' labels keep 4.5:1 and the rows' cakes and
// Home's dot 3:1; a failed read of her gifts offers Try again and no Celebrate (so none is never given unasked); and a
// birthday that closed while its sheet was open leaves Remind Me before the sheet can close, which gives focus to the
// screen's title.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-birthday.e2e.ts
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

const RUN = "r-e2e-bday001";
const ILVAR = "li-ilvar-0001";
const CASSIAN = "li-cassian-0002";

/** The local date in a time zone. */
const dayIn = (zone: string, date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const shift = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const until = (day: string) =>
  new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

function createBirthdayStub() {
  const calls: Call[] = [];
  let zone = "UTC";
  const today = () => dayIn(zone, new Date());
  const now = () => new Date().toISOString();
  const pronouns = { subject: "he", object: "him", possessive: "his" };
  const state = {
    gifts: { flowers: 1 } as Record<string, number>,
    started: new Set<string>(),
    /** The next answers of POST /home/birthday, first first; an empty queue celebrates. `closes`: its offer goes too. */
    refusals: [] as Array<{ status: number; code: string; closes?: boolean }>,
    /** Love interests whose birthday can no longer be celebrated. */
    closed: new Set<string>(),
    /** GET /wardrobe fails while set. */
    wardrobeFails: false,
  };
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
      places: {},
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
  const year = () => Number(today().slice(0, 4));
  const sceneKey = (li: string, day: string) => `story-birthday-${li}-${day.slice(0, 4)}`;
  const offers = () =>
    [
      { li: ILVAR, day: today(), daysLate: 0, started: state.started.has(ILVAR) },
      { li: CASSIAN, day: shift(today(), -3), daysLate: 3, started: state.started.has(CASSIAN) },
    ].filter((offer) => !state.closed.has(offer.li));

  const answer = (call: Call, zoneOf: string | null): { status: number; json: unknown } => {
    calls.push(call);
    if (zoneOf) zone = zoneOf;
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (path === base) return { status: 200, json: { view: structuredClone(view) } };
    if (path === `${base}/home`) {
      const open = offers().flatMap((offer) => (offer.started ? [] : [offer.li]));
      return {
        status: 200,
        json: {
          li: ILVAR,
          show: "him",
          note: {
            li: ILVAR,
            dayKey: today(),
            text: "The lab light was on again.",
            face: "",
            mood: { word: "calm", reason: "quiet" },
            at: now(),
          },
          look: null,
          faces: {},
          lines: { ready: true },
          rupture: false,
          unread: 0,
          backdrop: null,
          photo: null,
          noticed: null,
          noticing: false,
          thoughts: null,
          ...(open.length ? { celebrate: open } : {}),
        },
      };
    }
    if (/^\/runs\/[^/]+\/lis\/[^/]+\/lines$/u.test(path)) {
      return {
        status: 200,
        json: { ready: true, stage: 2, rupture: false, tap: null, annoyed: [], cold: [], comfort: [], claw: null },
      };
    }
    if (path === `${base}/calendar`) {
      return {
        status: 200,
        json: {
          birthdays: [
            { li: ILVAR, md: today().slice(5) },
            { li: CASSIAN, md: shift(today(), -3).slice(5) },
          ],
          anniversaries: [],
          bannerEnds: [],
          celebrate: [
            ...offers(),
            // Malformed or out of reach: never drawn.
            { li: "", day: today(), daysLate: 0 },
            { li: ILVAR, day: "not a day", daysLate: 0 },
            { li: CASSIAN, day: today(), daysLate: 9 },
            { li: "li-gone-9999", day: today(), daysLate: 0 },
          ],
        },
      };
    }
    if (path === `${base}/wardrobe`) {
      if (state.wardrobeFails) return { status: 500, json: { error: "The wardrobe is unreachable." } };
      return {
        status: 200,
        json: {
          him: {},
          me: [],
          couples: [],
          noticed: null,
          noticing: false,
          gifts: { ...state.gifts },
          figurines: [],
        },
      };
    }
    if (path === `${base}/home/birthday`) {
      const refusal = state.refusals.shift();
      if (refusal?.closes) state.closed.add(call.body!.li as string);
      if (refusal) return { status: refusal.status, json: { error: "Refused.", code: refusal.code } };
      const li = call.body!.li as string;
      const offer = offers().find((entry) => entry.li === li)!;
      state.started.add(li);
      if (call.body!.gift) state.gifts[call.body!.gift] = (state.gifts[call.body!.gift] ?? 1) - 1;
      return { status: 200, json: { key: sceneKey(li, offer.day), resumed: false } };
    }
    const chapter = /^\/runs\/[^/]+\/chapters\/(story-birthday-[a-z0-9-]+)(?:\/beats\/0(\/read)?)?$/u.exec(path);
    if (chapter) {
      const key = chapter[1]!;
      if (path.endsWith("/read")) return { status: 200, json: { grants: [], starlight: 2000, chapterDone: false } };
      if (path.endsWith("/beats/0")) {
        return {
          status: 200,
          json: {
            beat: {
              key,
              i: 0,
              kind: "beat",
              places: [],
              segments: [
                { speaker: "", text: "Candles gutter on the workbench." },
                { speaker: "Ilvar Thorne", text: "You remembered. Unscientific of you.", expression: "flustered" },
              ],
              choices: [],
              written: { at: now(), connectionId: "conn-text", model: "fixture" },
            },
          },
        };
      }
      return {
        status: 200,
        json: {
          chapter: {
            key,
            kind: "story",
            li: ILVAR,
            lead: ILVAR,
            title: "Ilvar Thorne's Birthday",
            tags: [],
            summary: "",
            nodes: [{ i: 0, kind: "beat" }],
            plannedAt: now(),
          },
          beats: [{ i: 0, state: "unwritten" }],
        },
      };
    }
    if (path === `${base}/art/scene`) {
      return { status: 200, json: { places: [], cg: null, faces: {}, facesComing: [] } };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer, state, today, year };
}

type Stub = ReturnType<typeof createBirthdayStub>;

async function stubRoutes(page: Page, stub: Stub) {
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === "POST" ? request.postDataJSON() : undefined;
    const { status, json } = stub.answer(
      { method: request.method(), path: url.pathname, body },
      url.searchParams.get("timeZone") ?? body?.timeZone ?? null,
    );
    await route.fulfill({ status, json });
  });
  await page.route("**/api/connections", (route) =>
    route.fulfill({ json: [{ id: "conn-text", name: "Nocturne", provider: "openai", model: "night-1" }] }),
  );
}

async function openHome(page: Page): Promise<Locator> {
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
const gets = (stub: Stub, suffix: string) =>
  stub.calls.filter((call) => call.method === "GET" && call.path.endsWith(suffix)).length;

/** No horizontal scroll anywhere on the stage. */
async function expectNoSideways(root: Locator) {
  const overflow = await root.evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>(".of-page, .of-celebrate, .of-celebrate li, .of-dialog")]
      .filter((node) => node.scrollWidth > node.clientWidth + 1)
      .map((node) => node.className),
  );
  expect(overflow).toEqual([]);
}

test("Otome Hearth birthdays: Home's dot, Celebrate in Remind Me, the gift sheet, its refusals and the scene", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ colorScheme: "dark" });
  const stub = createBirthdayStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openHome(page);
  const phone = testInfo.project.name.startsWith("mobile");

  // Home: two birthdays open, one fixed name and a dot on Remind Me, and the rail keeps its size.
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();
  const remind = root.getByRole("button", { name: "Remind Me · a birthday to celebrate", exact: true });
  await expect(remind).toBeInViewport();
  await expect(remind).toHaveAttribute("title", "Remind Me · a birthday to celebrate");
  const dot = remind.locator(".of-tab-dot");
  await expect(dot).toBeVisible();
  const [dotBox, remindBox] = [await dot.boundingBox(), await remind.boundingBox()];
  expect(dotBox!.x).toBeGreaterThanOrEqual(remindBox!.x);
  expect(dotBox!.x + dotBox!.width).toBeLessThanOrEqual(remindBox!.x + remindBox!.width + 1);
  expect(
    await contrastOf(page, dot, { hide: "visibility", fill: true }),
    "the dot against its button",
  ).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: testInfo.outputPath("01-home-dot.png") });

  // Remind Me: both birthdays, the late one with its last day; the malformed rows are dropped.
  await remind.click();
  await expect(root.getByRole("heading", { level: 1, name: "Remind Me" })).toBeFocused();
  const section = root.getByRole("region", { name: "Birthdays to celebrate" });
  const rows = section.locator(".of-celebrate li");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Today is Ilvar Thorne’s birthday.");
  await expect(rows.nth(1)).toContainText(
    `Cassian’s birthday was 3 days ago. You can still celebrate it until ${until(shift(stub.today(), 4))}.`,
  );
  const celebrateIlvar = section.getByRole("button", { name: "Celebrate Ilvar Thorne’s birthday" });
  await expect(celebrateIlvar).toBeVisible();
  if (phone) {
    // On the phone each button is full width under its words, and a touch target.
    const [button, row, words] = [
      await celebrateIlvar.boundingBox(),
      await rows.nth(0).boundingBox(),
      await rows.nth(0).locator(".of-celebrate-text").boundingBox(),
    ];
    expect(button!.height).toBeGreaterThanOrEqual(44);
    expect(button!.width).toBeGreaterThanOrEqual(row!.width - 2);
    expect(button!.y).toBeGreaterThanOrEqual(words!.y + words!.height - 1);
  }
  await expectNoSideways(root);
  await page.screenshot({ path: testInfo.outputPath("02-remind-celebrate.png") });

  // Escape closes the sheet and gives focus back to Celebrate.
  await celebrateIlvar.click();
  let sheet = page.getByRole("dialog", { name: "Celebrate Ilvar Thorne’s birthday" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(celebrateIlvar).toBeFocused();

  // The sheet: the gift radio group by keyboard, the cost line, then each refusal with its own words.
  await page.keyboard.press("Enter");
  sheet = page.getByRole("dialog", { name: "Celebrate Ilvar Thorne’s birthday" });
  const gifts = sheet.getByRole("radiogroup", { name: "Give a gift" });
  await expect(gifts).toBeVisible();
  await expect(sheet.getByText("Ilvar Thorne reacts to it in the scene, and it earns extra affection.")).toBeVisible();
  await expect(
    sheet.getByText("1 model call to write the scene · places, voices and music as in any scene"),
  ).toBeVisible();
  const none = gifts.getByRole("radio", { name: "No gift" });
  await expect(none).toBeChecked();
  await expect(none).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(gifts.getByRole("radio", { name: "Bouquet of flowers: 1 owned" })).toBeChecked();
  await expectNoSideways(root);
  await page.screenshot({ path: testInfo.outputPath("03-sheet.png") });

  const celebrate = sheet.getByRole("button", { name: "Celebrate", exact: true });
  stub.state.refusals.push(
    { status: 409, code: "conflict" },
    { status: 409, code: "locked" },
    { status: 404, code: "not-found" },
  );
  const wardrobeReads = gets(stub, "/wardrobe");
  await celebrate.click();
  await expect(sheet.getByRole("alert")).toHaveText("You no longer have that gift.");
  await expect.poll(() => gets(stub, "/wardrobe")).toBeGreaterThan(wardrobeReads);
  const runReads = gets(stub, `/runs/${RUN}`);
  await celebrate.click();
  await expect(sheet.getByRole("alert")).toHaveText("That gift can’t be given under this story’s Heat.");
  await expect.poll(() => gets(stub, `/runs/${RUN}`)).toBeGreaterThan(runReads);
  const calendarReads = gets(stub, "/calendar");
  await celebrate.click();
  await expect(sheet.getByRole("alert")).toHaveText("This birthday can no longer be celebrated.");
  await expect.poll(() => gets(stub, "/calendar")).toBeGreaterThan(calendarReads);

  // Celebrated: {li, gift} goes, and the scene opens in the reader under its own title.
  await expect(gifts.getByRole("radio", { name: "Bouquet of flowers: 1 owned" })).toBeChecked();
  await celebrate.click();
  const sent = posts(stub, "/home/birthday");
  expect(sent.at(-1)!.body).toMatchObject({ li: ILVAR, gift: "flowers" });
  await expect(root.getByText(`Ilvar Thorne’s birthday, ${stub.year()}`).first()).toBeVisible();
  await expect(root.getByText("Candles gutter on the workbench.").first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("04-reader.png") });
  await root.getByRole("button", { name: "Leave the chapter" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Remind Me" })).toBeVisible();
  await expect(section.getByRole("button", { name: "Play the scene with Ilvar Thorne" })).toBeVisible();

  // Her only gift is spent: no picker, only where to buy one, and Celebrate sends none.
  await section.getByRole("button", { name: "Celebrate Cassian’s birthday" }).click();
  sheet = page.getByRole("dialog", { name: "Celebrate Cassian’s birthday" });
  await expect(sheet.getByText("No gifts yet: the Shop in Wish sells them.")).toBeVisible();
  await expect(sheet.getByRole("radiogroup")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Celebrate", exact: true }).click();
  await expect(
    root.getByText(`Cassian’s birthday, ${Number(shift(stub.today(), -3).slice(0, 4))}`).first(),
  ).toBeVisible();
  const last = posts(stub, "/home/birthday").at(-1)!.body!;
  expect(last.li).toBe(CASSIAN);
  expect("gift" in last).toBe(false);

  // Home again, with both celebrated: no dot, and Remind Me is plain Remind Me.
  await root.getByRole("button", { name: "Leave the chapter" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Remind Me" })).toBeVisible();
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await expect(root.getByRole("button", { name: "Remind Me", exact: true })).toBeVisible();
  await expect(root.locator(".of-home-remind .of-tab-dot")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

/** The lowest WCAG contrast of `color` against the pixels of a PNG (base64), worked out in the page. */
function lowestContrast(page: Page, png: string, color: string) {
  return page.evaluate(
    async ({ png, color }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      [canvas.width, canvas.height] = [image.width, image.height];
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const channel = (value: number) => {
        const s = value / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (r: number, g: number, b: number) =>
        0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      const [r, g, b] = (color.match(/\d+(\.\d+)?/g) ?? []).map(Number);
      const own = luminance(r!, g!, b!);
      let lowest = Infinity;
      for (let i = 0; i < pixels.length; i += 4) {
        const other = luminance(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
        lowest = Math.min(lowest, (Math.max(own, other) + 0.05) / (Math.min(own, other) + 0.05));
      }
      return lowest;
    },
    { png, color },
  );
}

/** The colour `part` is drawn in, filters included: of the pixels it changes, the one farthest from what was behind. */
function drawnColour(page: Page, shown: string, hidden: string) {
  return page.evaluate(
    async ({ shown, hidden }) => {
      const pixels = async (png: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        [canvas.width, canvas.height] = [image.width, image.height];
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const [on, off] = [await pixels(shown), await pixels(hidden)];
      let [far, best] = [-1, "rgb(0, 0, 0)"];
      for (let i = 0; i < on.length; i += 4) {
        const distance =
          Math.abs(on[i]! - off[i]!) + Math.abs(on[i + 1]! - off[i + 1]!) + Math.abs(on[i + 2]! - off[i + 2]!);
        if (distance > far) [far, best] = [distance, `rgb(${on[i]}, ${on[i + 1]}, ${on[i + 2]})`];
      }
      return best;
    },
    { shown, hidden },
  );
}

/**
 * The lowest contrast of `part`'s own colour (its text colour, its fill for a dot, or the colour it is drawn in, for an
 * icon under a filter) against what is behind it, with it hidden (an icon's strokes are currentColor). `words`: only
 * the box of its own words, as for a button's label.
 */
async function contrastOf(
  page: Page,
  part: Locator,
  {
    hide,
    fill = false,
    words = false,
    drawn = false,
  }: { hide: "visibility" | "color"; fill?: boolean; words?: boolean; drawn?: boolean },
) {
  const computed = await part.evaluate(
    (element, fill) => getComputedStyle(element)[fill ? "backgroundColor" : "color"],
    fill,
  );
  const box = words
    ? await part.evaluate((element) => {
        const range = document.createRange();
        range.selectNode([...element.childNodes].find((node) => node.nodeType === 3 && node.textContent!.trim())!);
        const { x, y, width, height } = range.getBoundingClientRect();
        return { x, y, width, height };
      })
    : (await part.boundingBox())!;
  const shown = drawn ? (await page.screenshot({ clip: box })).toString("base64") : "";
  await part.evaluate(
    (element, hide) => ((element as HTMLElement).style[hide] = hide === "color" ? "transparent" : "hidden"),
    hide,
  );
  const png = (await page.screenshot({ clip: box })).toString("base64");
  await part.evaluate((element, hide) => ((element as HTMLElement).style[hide] = ""), hide);
  return lowestContrast(page, png, drawn ? await drawnColour(page, shown, png) : computed);
}

test("Otome Hearth birthdays in Pearl: 4.5:1 words and 3:1 marks, a failed gift read, and a birthday gone while its sheet is open", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 375, height: 667 });
  const stub = createBirthdayStub();
  stub.state.started.add(CASSIAN);
  stub.state.wardrobeFails = true;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openHome(page);

  // Home's dot keeps 3:1 against the glass behind it.
  const remind = root.getByRole("button", { name: "Remind Me · a birthday to celebrate", exact: true });
  await expect(remind).toBeVisible();
  expect(
    await contrastOf(page, remind.locator(".of-tab-dot"), { hide: "visibility", fill: true }),
    "Remind Me's dot against its button",
  ).toBeGreaterThanOrEqual(3);

  // Remind Me: each row's words 4.5:1 and its cake 3:1; Celebrate's and Play the scene's labels 4.5:1.
  await remind.click();
  const title = root.getByRole("heading", { level: 1, name: "Remind Me" });
  await expect(title).toBeFocused();
  await page.mouse.move(0, 0);
  const section = root.getByRole("region", { name: "Birthdays to celebrate" });
  const rows = section.locator(".of-celebrate li");
  await expect(rows).toHaveCount(2);
  const celebrateIlvar = section.getByRole("button", { name: "Celebrate Ilvar Thorne’s birthday" });
  const play = section.getByRole("button", { name: "Play the scene with Cassian" });
  await expect(play).toBeVisible();
  for (const row of await rows.all()) {
    const words = row.locator(".of-celebrate-text");
    expect(await contrastOf(page, words, { hide: "color" }), `${await words.textContent()}`).toBeGreaterThanOrEqual(
      4.5,
    );
    // Pearl draws the calendar's icons through a filter (darker, more saturated): the colour on screen is measured.
    expect(
      await contrastOf(page, row.locator("svg.of-event-icon"), { hide: "visibility", drawn: true }),
      `${await words.textContent()}: its cake`,
    ).toBeGreaterThanOrEqual(3);
  }
  for (const button of [celebrateIlvar, play]) {
    expect(
      await contrastOf(page, button, { hide: "color", words: true }),
      `${await button.getAttribute("aria-label")}'s label`,
    ).toBeGreaterThanOrEqual(4.5);
  }
  await page.screenshot({ path: testInfo.outputPath("05-pearl-remind.png") });

  // Her gifts can't be read: Try again, and Celebrate gives nothing unasked.
  await celebrateIlvar.click();
  const sheet = page.getByRole("dialog", { name: "Celebrate Ilvar Thorne’s birthday" });
  await expect(sheet.getByRole("alert")).toContainText("Your gifts could not load.", { timeout: 15_000 });
  await expect(sheet.getByText("No gifts yet: the Shop in Wish sells them.")).toHaveCount(0);
  const celebrate = sheet.getByRole("button", { name: "Celebrate", exact: true });
  await expect(celebrate).toHaveAttribute("aria-disabled", "true");
  // aria-disabled keeps it focusable: a tap reaches it and does nothing.
  await celebrate.click({ force: true });
  await expectNoSideways(root);
  await page.screenshot({ path: testInfo.outputPath("06-pearl-gifts-failed.png") });
  expect(posts(stub, "/home/birthday")).toHaveLength(0);
  stub.state.wardrobeFails = false;
  await sheet.getByRole("button", { name: "Try again" }).click();
  await expect(sheet.getByRole("radiogroup", { name: "Give a gift" })).toBeVisible();
  await expect(celebrate).toHaveAttribute("aria-disabled", "false");

  // Gone meanwhile: its row leaves while the sheet is open, and Escape gives focus to the screen's title.
  stub.state.refusals.push({ status: 404, code: "not-found", closes: true });
  await celebrate.click();
  await expect(sheet.getByRole("alert")).toHaveText("This birthday can no longer be celebrated.");
  await expect(rows).toHaveCount(1);
  await expect(celebrateIlvar).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(title).toBeFocused();
  expect(pageErrors).toEqual([]);
});
