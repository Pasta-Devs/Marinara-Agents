// Otome Forge's Wish, Wardrobe and Album (M4) in the Engine's Home tab, with /api/otome-forge/** stubbed: a ten-wish
// arrives in a sealed letter, Skip goes straight to the results (NEW ribbons, a repeat's Starlight back), and a double
// tap is one charged wish with one request id; a wish whose answer was lost is sent again with the same id; a single
// wish opens by dragging the seal up into a 5★ reveal, whose first open is one request however often it is tapped; at
// reduced motion the keyboard alone opens the letter; a wish without enough Starlight sends nothing. The Wardrobe's
// toggle moves between a love interest's looks and mine, wears a look at home (his line about it replaces the
// "noticing" hint in one live region) and shows one of mine; the Album opens a CG large and saves it through the
// Engine. With the Engine's prompt review on, an open on the 5★ reveal hands focus to Continue, and the review a wish's
// results open is the dialog on top, and it paints.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-wish.e2e.ts
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

const RUN = "r-e2e-m4w001";
const ILVAR = "li-ilvar-0001";
const CASSIAN = "li-cassian-0002";
const HE = { subject: "he", object: "him", possessive: "his" };
const THEY = { subject: "they", object: "them", possessive: "their" };
const SHE = { subject: "she", object: "her", possessive: "her" };
const now = () => new Date().toISOString();

/** A soft two-colour SVG as a data: URL (img-src allows data:). */
const art = (colour: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="160"><defs><linearGradient id="g" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${colour}"/><stop offset="1" stop-color="#f3dcaa"/></linearGradient></defs>` +
      `<rect width="90" height="160" fill="url(#g)"/></svg>`,
  ).toString("base64")}`;
const ready = (url: string) => ({ state: "ready", at: now(), url });
const CG = art("#2b2236");
/** A 1×1 PNG, for an image the Album saves (a data: URL cannot be fetched under the Engine's CSP). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const GALLERY_CG = "/api/gallery/file/otome-forge-cg-observation-room.png";

function runView(starlight: number): Json {
  return {
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
      images: { connectionId: "conn-image", rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
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
      personaId: "persona-mira",
      name: "Mira Vale",
      pronouns: SHE,
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
      outfits: [],
      noticed: {
        li: ILVAR,
        text: "You wore the blue one. I noticed. That is all.",
        look: "my-wardrobe-1-f",
        at: now(),
      },
    },
    lis: [
      {
        id: ILVAR,
        name: "Ilvar Thorne",
        pronouns: HE,
        source: "archetype",
        voiceGender: "male",
        accent: "#9DB8F0",
        level: 4,
        stage: 2,
      },
      {
        id: CASSIAN,
        name: "Cassian",
        pronouns: THEY,
        source: "archetype",
        voiceGender: "",
        accent: "#E6C98A",
        level: 2,
        stage: 1,
      },
    ],
    forge: { phase: "ready", steps: [] },
    starlight,
  };
}

const index = () => ({
  version: 1,
  runs: [{ runKey: RUN, title: "The Clockwork Masquerade", createdAt: now(), lastPlayedAt: null }],
  activeRun: RUN,
  ageGate: null,
  lastOpenedAt: null,
});

// ── Wish fixtures ──

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

function memoriesBanner(key = "memories-1", echo = false): Json {
  return {
    key,
    kind: "memories",
    rotation: Number(key.split("-").at(-1)),
    startsDay: echo ? "2026-10-14" : "2026-10-28",
    endsDay: echo ? "2026-10-27" : "2026-11-10",
    featuredLi: ILVAR,
    title: echo ? "Ink and Rain" : "Clockwork Hearts",
    echo,
    five: item(`${key}-f`, "memory5", 5, ILVAR, echo ? "Ink and Rain" : "The Hour He Stopped", {
      premise: "The great clock stops at midnight and only one of you knows why.",
    }),
    four: [1, 2, 3].map((n) => item(`${key}-a${n}`, "moment4", 4, n === 2 ? CASSIAN : ILVAR, `A Moment ${n}`)),
    three: [1, 2, 3, 4, 5, 6].map((n) =>
      item(`${key}-s${n}`, "snapshot3", 3, n % 2 ? ILVAR : CASSIAN, `Snapshot ${n}`),
    ),
    art: echo ? null : ready(CG),
  };
}

function wardrobeBanner(): Json {
  const key = "his-wardrobe-1";
  return {
    ...memoriesBanner(key),
    kind: "his-wardrobe",
    featuredLi: CASSIAN,
    title: "Gilded Hours",
    five: item(`${key}-f`, "his-look5", 5, CASSIAN, "Gilded Hours", { look: { name: "Gilded Waistcoat" } }),
    four: [1, 2, 3].map((n) =>
      item(`${key}-a${n}`, "his-look4", 4, ILVAR, `Look ${n}`, { look: { name: `Look ${n}` } }),
    ),
    art: null,
  };
}

function myBanner(): Json {
  const key = "my-wardrobe-1";
  return {
    ...memoriesBanner(key),
    kind: "my-wardrobe",
    title: "Starlit Gown",
    five: item(`${key}-f`, "her-look5", 5, CASSIAN, "Starlit Gown", { look: { name: "Starlit Gown" } }),
    four: [1, 2, 3].map((n) =>
      item(`${key}-a${n}`, "her-look4", 4, null, `Gown ${n}`, { look: { name: `Gown ${n}` } }),
    ),
    art: null,
  };
}

const PITY = {
  memories: { fiveIn: 37, fourIn: 4 },
  "his-wardrobe": { fiveIn: 60, fourIn: 10 },
  "my-wardrobe": { fiveIn: 60, fourIn: 10 },
};

interface WishStub {
  view: Json;
  wish: Json;
  pullResponse: Json;
  /** Answer the first pull with a dropped connection (the server applied it). */
  dropFirst?: boolean;
}

function wishView(starlight: number): Json {
  return {
    starlight,
    banners: [memoriesBanner(), wardrobeBanner(), myBanner()],
    echoes: [memoriesBanner("memories-0", true)],
    pity: PITY,
    creating: false,
    missing: [],
    rotation: { number: 1, startsDay: "2026-10-28", endsDay: "2026-11-10" },
    selectors: [],
  };
}

/** Ten results: the 5★ (new), two 4★ (one a repeat), seven Snapshots (two repeats). */
function tenResults(): Json[] {
  const banner = memoriesBanner();
  const owned = (value: Json) => ({ ...value, owned: true });
  return [
    { item: owned(banner.three[0]), rarity: 3, isNew: true, refund: 0 },
    { item: owned(banner.four[0]), rarity: 4, isNew: true, refund: 0 },
    { item: owned(banner.three[1]), rarity: 3, isNew: true, refund: 0 },
    { item: owned(banner.three[1]), rarity: 3, isNew: false, refund: 10 },
    { item: owned(banner.five), rarity: 5, isNew: true, refund: 0 },
    { item: owned(banner.three[2]), rarity: 3, isNew: true, refund: 0 },
    { item: owned(banner.four[0]), rarity: 4, isNew: false, refund: 60 },
    { item: owned(banner.three[3]), rarity: 3, isNew: true, refund: 0 },
    { item: owned(banner.three[2]), rarity: 3, isNew: false, refund: 10 },
    { item: owned(banner.three[4]), rarity: 3, isNew: true, refund: 0 },
  ];
}

// ── Wardrobe and Album fixtures ──

function look(id: string, owner: string, name: string, extra: Json = {}): Json {
  return {
    id,
    owner,
    name,
    art: ready(art("#8f7aa8")),
    url: art("#8f7aa8"),
    worn: false,
    wearable: true,
    unopened: false,
    ...extra,
  };
}

/** What Ilvar says on seeing the Starlit Gown (P19), once the Wardrobe has asked while it was being written. */
const GOWN_NOTICED = "Starlight on you. I forgot what I was saying.";

/** `noticing`: P19 is still writing what he noticed about the look she wears now. */
function wardrobeView(herWorn = "base", noticing = false): Json {
  return {
    him: {
      [ILVAR]: [
        look("base", ILVAR, "", { worn: true }),
        look("his-wardrobe-0-a1", ILVAR, "Midnight Coat", {
          item: { kind: "his-look4", rarity: 4, title: "Midnight Coat" },
        }),
      ],
      [CASSIAN]: [look("base", CASSIAN, "", { worn: true })],
    },
    me: [
      look("base", "me", "", { worn: herWorn === "base" }),
      look("my-wardrobe-0-f", "me", "Starlit Gown", {
        item: { kind: "her-look5", rarity: 5, title: "Starlit Gown" },
        worn: herWorn === "my-wardrobe-0-f",
        shownTo: [],
      }),
    ],
    couples: [
      {
        his: { id: "his-wardrobe-0-f", li: CASSIAN, name: "Gilded Waistcoat", owned: false },
        hers: { id: "my-wardrobe-0-f", name: "Starlit Gown", owned: true, url: art("#8f7aa8") },
        complete: false,
        pair: null,
        canPaintPair: false,
      },
    ],
    noticed: noticing
      ? null
      : herWorn === "base"
        ? { li: ILVAR, text: "You wore the blue one. I noticed. That is all.", look: "base", at: now() }
        : { li: ILVAR, text: GOWN_NOTICED, look: herWorn, at: now() },
    noticing,
  };
}

function albumView(): Json {
  return {
    cgs: [
      // A Global Gallery file, same-origin as the Engine serves them (saving fetches it).
      { key: "main-1/2", url: GALLERY_CG, at: "2026-10-27T20:00:00.000Z", li: ILVAR, source: "story" },
      {
        key: "memories-0-f",
        url: art("#5a3b6e"),
        at: "2026-10-28T09:00:00.000Z",
        li: ILVAR,
        source: "memory",
        title: "Ink and Rain",
      },
    ],
    memories: [
      { ...memoriesBanner("memories-0", true).five, owned: true, story: { key: "story-memories-0-f" }, read: "unread" },
    ],
    timeline: [
      {
        at: "2026-10-27T20:00:00.000Z",
        li: ILVAR,
        kind: "first-meeting",
        text: "The first time Ilvar said your name.",
      },
    ],
    favorites: [],
    soundtrack: [{ cue: "home", track: null }],
    tells: { [ILVAR]: ["He straightens his cuffs when he is lying."], [CASSIAN]: [] },
  };
}

type Answer = { status: number; json?: unknown; delay?: number; abort?: boolean };

async function stubRoutes(page: Page, answer: (call: Call) => Answer | undefined, calls: Call[]) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: Json | undefined;
    try {
      body = request.method() === "POST" ? (request.postDataJSON() ?? undefined) : undefined;
    } catch {
      body = undefined;
    }
    const call = { method: request.method(), path: url.pathname, body };
    calls.push(call);
    const reply = answer(call) ?? {
      status: 404,
      json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" },
    };
    if (reply.delay) await new Promise((done) => setTimeout(done, reply.delay));
    if (reply.abort) await route.abort("connectionreset");
    else await route.fulfill({ status: reply.status, json: reply.json });
  });
}

function wishStub(starlight = 2000): { stub: WishStub; answer: (call: Call) => Answer | undefined } {
  const stub: WishStub = { view: runView(starlight), wish: wishView(starlight), pullResponse: {} };
  const seen = new Set<string>();
  const answer = (call: Call): Answer | undefined => {
    const path = call.path.replace("/api/otome-forge", "");
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index: index() } };
    if (path === `/runs/${RUN}`) return { status: 200, json: { view: stub.view } };
    if (path === `/runs/${RUN}/wish` && call.method === "GET") return { status: 200, json: stub.wish };
    if (path === `/runs/${RUN}/wish/pull`) {
      const id = String(call.body?.requestId ?? "");
      const first = !seen.has(id);
      seen.add(id);
      if (first) {
        // The server's one write: charged, rolled, and the items it brought owned from now on.
        const won = new Set<string>(stub.pullResponse.results.map((result: Json) => result.item.id));
        const own = (value: Json) => (won.has(value.id) ? { ...value, owned: true } : value);
        stub.view.starlight = stub.pullResponse.starlight;
        stub.wish = {
          ...stub.wish,
          starlight: stub.pullResponse.starlight,
          banners: stub.wish.banners.map((banner: Json) => ({
            ...banner,
            five: own(banner.five),
            four: banner.four.map(own),
            three: banner.three.map(own),
          })),
        };
      }
      // The first answer of a dropped wish is lost on the way back, though the server applied it.
      if (stub.dropFirst && first) return { status: 0, abort: true };
      return { status: 200, json: stub.pullResponse, delay: 150 };
    }
    if (/\/items\/[^/]+\/open$/u.test(path)) {
      const id = decodeURIComponent(path.split("/").at(-2)!);
      const opened = {
        ...memoriesBanner().five,
        id,
        owned: true,
        story: { key: `story-${id}` },
        voicedLine: "Stay. Just until the clock starts again.",
        art: ready(CG),
      };
      stub.wish = {
        ...stub.wish,
        banners: stub.wish.banners.map((banner: Json) =>
          banner.five.id === id ? { ...banner, five: opened } : banner,
        ),
      };
      return { status: 200, json: { item: opened, story: opened.story, art: opened.art }, delay: 400 };
    }
    return undefined;
  };
  return { stub, answer };
}

async function openOtome(page: Page, { review = false } = {}): Promise<Locator> {
  await page.addInitScript(
    ({ version, review }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            sidebarOpen: false,
            rightPanelOpen: false,
            appAccentPulseMode: false,
            // The Engine's "Review image prompts before sending".
            reviewImagePromptsBeforeSend: review,
          },
          version: 65,
        }),
      );
    },
    { version: appVersion, review },
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Otome Hearth" }).click();
  const root = page.locator("marinara-capability-otome-forge .of-root");
  await expect(root).toBeVisible({ timeout: 60_000 });
  return root;
}

async function openDock(root: Locator, name: string) {
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name, exact: true }).click();
  await expect(root.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
}

const posts = (calls: Call[], suffix: string) =>
  calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));

const starlight = (root: Locator) => root.locator(".of-topbar .of-starlight");

test("Otome Forge Wish: a ten-wish arrives sealed, Skip shows the results, and a double tap is one charged wish", async ({
  page,
}) => {
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  stub.pullResponse = {
    results: tenResults(),
    starlight: 1070,
    pity: { ...PITY, memories: { fiveIn: 60, fourIn: 10 } },
  };
  await stubRoutes(page, answer, calls);
  const root = await openOtome(page);
  await openDock(root, "Wish");

  const banner = root.getByRole("region", { name: "Clockwork Hearts" });
  await expect(banner).toBeVisible();
  await expect(banner.getByText("5★ in 37")).toBeVisible();
  await expect(banner.getByText("4★ in 4")).toBeVisible();
  // The love interest's wardrobe is named for whoever it features, never "his".
  await expect(root.getByRole("tab", { name: "Cassian’s Wardrobe" })).toBeVisible();

  const ten = banner.getByRole("button", { name: /^Wish ×10,/u });
  await ten.dblclick();
  const takeover = page.getByRole("dialog", { name: "Your wish" });
  await expect(takeover).toBeVisible();
  // The seal holds focus, and its rarity glows gold for the 5★ inside.
  await expect(takeover.getByRole("button", { name: "Break the seal" })).toBeFocused();
  await expect(takeover.locator(".of-letter")).toHaveAttribute("data-rarity", "gold");
  await takeover.getByRole("button", { name: "Skip" }).click();

  await expect(takeover.getByRole("heading", { name: "Your wishes" })).toBeFocused();
  const tiles = takeover.locator(".of-pull-tile");
  await expect(tiles).toHaveCount(10);
  await expect(takeover.locator(".of-ribbon")).toHaveCount(7);
  await expect(takeover.getByText("80 back for repeats")).toBeVisible();
  await expect(tiles.nth(6).getByText("Already yours: 60 Starlight back")).toBeAttached();

  const pulls = posts(calls, "/wish/pull");
  expect(pulls).toHaveLength(1);
  expect(pulls[0]!.body).toMatchObject({ banner: "memories-1", count: 10 });
  expect(pulls[0]!.body!.requestId).toMatch(/^[A-Za-z0-9_-]{8,80}$/u);
  await expect(starlight(root)).toContainText("1,070");

  // The 5★'s page: its first open is one request, however often it is tapped.
  await tiles.nth(4).click();
  await expect(takeover.getByRole("heading", { name: "The Hour He Stopped" })).toBeFocused();
  // Two taps in a row: the second lands before the first has answered.
  await takeover.getByRole("button", { name: "Open it" }).dblclick();
  await expect(takeover.getByRole("button", { name: "Read the story" })).toBeVisible();
  expect(posts(calls, "/items/memories-1-f/open")).toHaveLength(1);
  await takeover.getByRole("button", { name: "Back to your wishes" }).click();
  await expect(tiles.nth(4)).toBeFocused();

  await takeover.getByRole("button", { name: "Done" }).click();
  await expect(takeover).toBeHidden();
  await expect(ten).toBeFocused();
});

test("Otome Forge Wish: a wish whose answer was lost is sent again with the same id, and shown, not charged twice", async ({
  page,
}) => {
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  stub.dropFirst = true;
  stub.pullResponse = { results: tenResults().slice(0, 1), starlight: 1900, pity: PITY };
  await stubRoutes(page, answer, calls);
  const root = await openOtome(page);
  await openDock(root, "Wish");
  const banner = root.getByRole("region", { name: "Clockwork Hearts" });
  await banner.getByRole("button", { name: /^Wish ×1,/u }).click();
  await expect(banner.getByRole("alert")).toBeVisible();
  await banner.getByRole("alert").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("dialog", { name: "Your wish" })).toBeVisible();
  const pulls = posts(calls, "/wish/pull");
  expect(pulls).toHaveLength(2);
  expect(pulls[1]!.body!.requestId).toBe(pulls[0]!.body!.requestId);
  await expect(starlight(root)).toContainText("1,900");
});

test("Otome Forge Wish: dragging the seal up opens a single wish into its 5★ reveal", async ({ page }) => {
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  const five = { ...memoriesBanner().five, owned: true };
  stub.pullResponse = { results: [{ item: five, rarity: 5, isNew: true, refund: 0 }], starlight: 1900, pity: PITY };
  await stubRoutes(page, answer, calls);
  const root = await openOtome(page);
  await openDock(root, "Wish");
  await root
    .getByRole("region", { name: "Clockwork Hearts" })
    .getByRole("button", { name: /^Wish ×1,/u })
    .click();

  const takeover = page.getByRole("dialog", { name: "Your wish" });
  const seal = takeover.getByRole("button", { name: "Break the seal" });
  await expect(seal).toBeVisible();
  // A short drag that is let go settles back: the letter stays sealed.
  const box = (await seal.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 30, { steps: 4 });
  await page.mouse.up();
  await expect(takeover.locator(".of-letter")).toHaveAttribute("data-opening", "false");
  // Drawn past halfway, it opens.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 140, { steps: 8 });
  await page.mouse.up();

  const reveal = takeover.locator(".of-reveal");
  await expect(reveal).toBeVisible();
  await expect(reveal.getByRole("heading", { name: "The Hour He Stopped" })).toBeFocused();
  await expect(reveal).toHaveAttribute("data-shown", "true");
  await expect(reveal.getByText("NEW")).toBeVisible();
  await reveal.getByRole("button", { name: "Continue" }).click();
  await expect(takeover.getByRole("heading", { name: "Your wish" })).toBeFocused();
  await expect(takeover.locator(".of-pull-tile")).toHaveCount(1);
  // Escape on the results is Done.
  await page.keyboard.press("Escape");
  await expect(takeover).toBeHidden();
});

test("Otome Forge Wish: at reduced motion the keyboard alone opens the letter, and too little Starlight sends nothing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const { stub, answer } = wishStub(150);
  stub.pullResponse = { results: tenResults().slice(0, 1), starlight: 50, pity: PITY };
  await stubRoutes(page, answer, calls);
  const root = await openOtome(page);
  await openDock(root, "Wish");
  const banner = root.getByRole("region", { name: "Clockwork Hearts" });
  const ten = banner.getByRole("button", { name: /^Wish ×10,/u });
  await expect(ten).toHaveAttribute("aria-disabled", "true");
  await expect(ten).toHaveAccessibleDescription("850 more Starlight");
  // aria-disabled, so it keeps focus and still says why: a press does nothing.
  await ten.click({ force: true });
  expect(posts(calls, "/wish/pull")).toHaveLength(0);

  await banner.getByRole("button", { name: /^Wish ×1,/u }).focus();
  await page.keyboard.press("Enter");
  const takeover = page.getByRole("dialog", { name: "Your wish" });
  await expect(takeover.getByRole("button", { name: "Break the seal" })).toBeFocused();
  // Tab stays inside the takeover.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(takeover.getByRole("button", { name: "Break the seal" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(takeover.getByRole("heading", { name: "Your wish" })).toBeFocused();
  await expect(starlight(root)).toContainText("50");
  await page.keyboard.press("Escape");
  await expect(takeover).toBeHidden();
  await expect(banner.getByRole("button", { name: /^Wish ×1,/u })).toBeFocused();
});

test("Otome Forge Wardrobe: the toggle moves between their looks and mine, wears one at home and shows one of mine", async ({
  page,
}) => {
  const calls: Call[] = [];
  const view = runView(2000);
  let herWorn = "base";
  // Reads of the wardrobe since she put the gown on: the first is told the line is on its way.
  let readsSinceWear = 0;
  await stubRoutes(
    page,
    (call) => {
      const path = call.path.replace("/api/otome-forge", "");
      if (path === "/index" || path === "/index/opened") return { status: 200, json: { index: index() } };
      if (path === `/runs/${RUN}`) return { status: 200, json: { view } };
      if (path === `/runs/${RUN}/wardrobe`) {
        if (herWorn !== "base") readsSinceWear += 1;
        return { status: 200, json: wardrobeView(herWorn, herWorn !== "base" && readsSinceWear <= 1) };
      }
      if (path === `/runs/${RUN}/wardrobe/wear`) {
        herWorn = String(call.body?.look);
        return { status: 200, json: { wardrobe: wardrobeView(herWorn, true) }, delay: 120 };
      }
      if (path === `/runs/${RUN}/wardrobe/show`) {
        return {
          status: 200,
          json: {
            line: "Blue suits you. Don't make me say it twice.",
            grants: [{ source: "show-him", li: ILVAR, affection: 20 }],
          },
        };
      }
      return undefined;
    },
    calls,
  );
  const root = await openOtome(page);
  await openDock(root, "Wardrobe");

  const owners = root.getByRole("group", { name: "Whose wardrobe" });
  await expect(owners.getByRole("radio", { name: "Ilvar Thorne" })).toBeChecked();
  await expect(root.getByRole("heading", { name: "Ilvar Thorne’s looks" })).toBeVisible();
  await expect(root.getByRole("heading", { name: "Midnight Coat" })).toBeVisible();
  // Wearing one of theirs paints its five faces (expressions are on): the cost is on Wear.
  await expect(root.locator(".of-ward-look", { hasText: "Midnight Coat" }).getByText("Paints 5 images")).toBeVisible();
  // The arrow keys move the toggle; Cassian (they/them) is named, never "him".
  await owners.getByRole("radio", { name: "Ilvar Thorne" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(owners.getByRole("radio", { name: "Cassian" })).toBeChecked();
  await expect(root.getByRole("heading", { name: "Cassian’s looks" })).toBeVisible();
  await owners.getByText("Me", { exact: true }).click();
  await expect(root.getByRole("heading", { name: "My looks" })).toBeVisible();
  await expect(root.getByText("Ilvar Thorne noticed")).toBeVisible();
  await expect(root.getByRole("heading", { name: "Couple sets" })).toBeVisible();

  await root.getByRole("button", { name: "Wear Starlit Gown at home" }).click();
  // The pressed Wear leaves: focus goes to the look's new state, not to the page.
  await expect(root.locator(".of-ward-look", { hasText: "Starlit Gown" }).getByText("Worn at home")).toBeFocused();
  expect(posts(calls, "/wardrobe/wear").map((call) => call.body)).toEqual([
    expect.objectContaining({ owner: "me", look: "my-wardrobe-0-f" }),
  ]);
  // He is noticing the gown, then his line takes the hint's place in the same live region, so it is announced.
  const status = root.getByRole("status").filter({ hasText: /noticed|noticing/i });
  await expect(status).toContainText("Your new look is being noticed");
  await expect(status).toContainText(GOWN_NOTICED, { timeout: 15_000 });
  await expect(status.getByText("Ilvar Thorne noticed")).toBeVisible();

  await root.getByRole("button", { name: "Show off: Starlit Gown" }).click();
  const dialog = page.getByRole("dialog", { name: "Who should see Starlit Gown?" });
  await dialog.getByRole("button", { name: "Show Ilvar Thorne" }).click();
  await expect(page.getByRole("dialog", { name: "Ilvar Thorne sees Starlit Gown" })).toBeVisible();
  await expect(page.getByText("“Blue suits you. Don't make me say it twice.”")).toBeFocused();
  await expect(page.getByText("+20 affection with Ilvar Thorne")).toBeVisible();
  expect(posts(calls, "/wardrobe/show").map((call) => call.body)).toEqual([
    expect.objectContaining({ li: ILVAR, look: "my-wardrobe-0-f" }),
  ]);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(root.getByRole("button", { name: "Show off: Starlit Gown" })).toBeFocused();
});

test("Otome Forge Album: a CG opens large and saves through the Engine; the Timeline and the Tells read without images", async ({
  page,
}) => {
  const calls: Call[] = [];
  const view = runView(2000);
  await page.route(`**${GALLERY_CG}`, (route) => route.fulfill({ body: PNG, contentType: "image/png" }));
  await stubRoutes(
    page,
    (call) => {
      const path = call.path.replace("/api/otome-forge", "");
      if (path === "/index" || path === "/index/opened") return { status: 200, json: { index: index() } };
      if (path === `/runs/${RUN}`) return { status: 200, json: { view } };
      if (path === `/runs/${RUN}/album`) return { status: 200, json: albumView() };
      return undefined;
    },
    calls,
  );
  const root = await openOtome(page);
  await openDock(root, "Album");
  await root.getByRole("button", { name: "View: Ink and Rain" }).click();
  const viewer = page.getByRole("dialog", { name: "Ink and Rain" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText("2 of 2")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "A moment with Ilvar Thorne" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save image" }).click();
  // The gallery file's own name, saved through the Engine's image saving.
  expect((await download).suggestedFilename()).toBe("otome-forge-cg-observation-room.png");
  await page.keyboard.press("Escape");

  const tabs = root.getByRole("tablist", { name: "Album" });
  await tabs.getByRole("tab", { name: "Love Timeline" }).click();
  await expect(root.getByText("The first time Ilvar said your name.")).toBeVisible();
  await tabs.getByRole("tab", { name: "Love Timeline" }).focus();
  await page.keyboard.press("End");
  await expect(tabs.getByRole("tab", { name: "Tells" })).toHaveAttribute("aria-selected", "true");
  await expect(root.getByText("He straightens his cuffs when he is lying.")).toBeVisible();
  await expect(root.getByText("You haven’t learned to read Cassian yet.")).toBeVisible();
  await tabs.getByRole("tab", { name: "Memories" }).click();
  await root.getByRole("button", { name: /Ink and Rain/u }).click();
  await expect(page.getByRole("button", { name: "Read the story" })).toBeVisible();
  // Its story was written before there was an image connection: an open now paints its CG (and writes nothing).
  await expect(page.getByRole("button", { name: "Open it" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Paints 1 image")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Writes its story")).toHaveCount(0);
});

test("Otome Forge Wish: an open on the 5★ reveal hands focus on, and the prompt review from the results is on top", async ({
  page,
}) => {
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  const five = { ...memoriesBanner().five, owned: true };
  const setFive = (value: Json) => {
    stub.wish = {
      ...stub.wish,
      banners: stub.wish.banners.map((banner: Json) =>
        banner.five.id === value.id ? { ...banner, five: value } : banner,
      ),
    };
  };
  stub.pullResponse = { results: [{ item: five, rarity: 5, isNew: true, refund: 0 }], starlight: 1900, pity: PITY };
  await stubRoutes(
    page,
    (call) => {
      const path = call.path.replace("/api/otome-forge", "");
      // Under the prompt review the open writes the story and holds its art for the tap.
      if (path === `/runs/${RUN}/items/memories-1-f/open`) {
        const opened = { ...five, story: { key: "story-memories-1-f" }, art: { state: "waiting-consent", at: now() } };
        setFive(opened);
        return { status: 200, json: { item: opened, story: opened.story, art: opened.art }, delay: 200 };
      }
      if (path === `/runs/${RUN}/items/memories-1-f/art/prompt`) {
        return { status: 200, json: { prompt: "The great clock at midnight", negativePrompt: "" } };
      }
      if (path === `/runs/${RUN}/items/memories-1-f/art`) {
        setFive({ ...five, story: { key: "story-memories-1-f" }, art: ready(CG) });
        return { status: 200, json: { art: ready(CG) } };
      }
      return answer(call);
    },
    calls,
  );
  const root = await openOtome(page, { review: true });
  await openDock(root, "Wish");
  await root
    .getByRole("region", { name: "Clockwork Hearts" })
    .getByRole("button", { name: /^Wish ×1,/u })
    .click();
  const takeover = page.getByRole("dialog", { name: "Your wish" });
  await expect(takeover.getByRole("button", { name: "Break the seal" })).toBeFocused();
  await page.keyboard.press("Enter");
  const reveal = takeover.locator(".of-reveal");
  await reveal.getByRole("button", { name: "Open it now" }).focus();
  await page.keyboard.press("Enter");
  // "Open it now" leaves once it answered: focus goes on to Continue, so Escape still skips.
  await expect(reveal.getByRole("button", { name: "Continue" })).toBeFocused();
  expect(posts(calls, "/items/memories-1-f/open")).toHaveLength(1);
  await page.keyboard.press("Escape");
  await expect(takeover.getByRole("heading", { name: "Your wish" })).toBeFocused();

  await takeover.locator(".of-pull-tile").first().click();
  await takeover.getByRole("button", { name: "Paint it" }).click();
  const review = page.getByRole("dialog", { name: "Paint: The Hour He Stopped" });
  await expect(review).toBeVisible();
  await expect(review.getByRole("textbox").first()).toBeFocused();
  // A real pointer click: the review is the dialog on top of the takeover.
  await review.getByRole("button", { name: "Paint", exact: true }).click();
  await expect(review).toBeHidden();
  const paints = posts(calls, "/items/memories-1-f/art");
  expect(paints).toHaveLength(1);
  expect(paints[0]!.body).toMatchObject({ prompt: "The great clock at midnight" });
  await expect(takeover.getByRole("button", { name: "Read the story" })).toBeFocused();
});
