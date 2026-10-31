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
import { crc32, deflateSync } from "node:zlib";

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

/** A meaningful full-body silhouette, with the same retained pixels on a green matte or transparent background. */
function lookPng(clean: boolean): Buffer {
  const width = 32;
  const height = 48;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const subject =
        (y < 11 && x >= 10 && x < 22) ||
        (y >= 11 && y < 30 && x >= 7 && x < 25) ||
        (y >= 15 && y < 29 && x >= 3 && x < 29) ||
        (y >= 30 && ((x >= 8 && x < 14) || (x >= 18 && x < 24)));
      const offset = y * (1 + width * 4) + 1 + x * 4;
      rows.set(subject ? [90, 80, 160, 255] : [0, 255, 0, clean ? 0 : 255], offset);
    }
  }
  const chunk = (kind: string, bytes: Buffer) => {
    const name = Buffer.from(kind);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(bytes.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
    return Buffer.concat([size, name, bytes, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header.set([8, 6], 8);
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const RAW_LOOK = "/api/global-gallery/file/wish-look-green.png";
const OTHER_LOOK = "/api/global-gallery/file/wardrobe-other-green.png";
const CLEAN_LOOK = `data:image/png;base64,${lookPng(true).toString("base64")}`;

async function stubLookCleanup(
  page: Page,
  respond?: () => Promise<{ base64: string }>,
  finished?: (index: number) => void,
) {
  const calls: Json[] = [];
  await page.route("**/api/global-gallery/file/*green.png", (route) =>
    route.fulfill({ contentType: "image/png", body: lookPng(false) }),
  );
  await page.route("**/api/sprites/cleanup/status", (route) => route.fulfill({ json: { cleanupRevision: 2 } }));
  await page.route("**/api/sprites/cleanup", async (route) => {
    calls.push(route.request().postDataJSON());
    const index = calls.length;
    const cell = respond ? await respond() : { base64: CLEAN_LOOK };
    await route.fulfill({ json: { cells: [cell], cleanupRevision: 2 } });
    finished?.(index);
  });
  return calls;
}

/** A read-only completion barrier; visible pixels and no-write behavior are asserted separately. */
const lookSettled = (page: Page, source: string) =>
  expect
    .poll(() =>
      page.evaluate(
        (url) =>
          (globalThis as any).__MARINARA_HOST__.queryClient.getQueryState(["otome-forge", "speaker-display", url])
            ?.fetchStatus,
        source,
      ),
    )
    .toBe("idle");

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
      // A Memory won (#1947): the Album lists it on the day it was won, and it opens from here.
      { at: "2026-10-28T09:00:00.000Z", li: ILVAR, kind: "memory", text: "Ink and Rain", ref: "memories-0-f" },
    ],
    favorites: [],
    soundtrack: [{ cue: "home", track: null }],
    tells: { [ILVAR]: ["He straightens his cuffs when he is lying."], [CASSIAN]: [] },
  };
}

type Answer = { status: number; json?: unknown; delay?: number; abort?: boolean; wait?: Promise<void> };

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
    if (reply.wait) await reply.wait;
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
  // Engine's calendar greeting can appear after startup. Keep its theme through the normal, specific dialog action.
  await page.addLocatorHandler(
    page
      .getByRole("dialog", { name: "Happy Halloween!", exact: true })
      .filter({ has: page.getByRole("button", { name: "Keep it", exact: true }) }),
    async (dialog) => {
      await dialog.getByRole("button", { name: "Keep it", exact: true }).click();
    },
  );
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

test("Otome Hearth look art: Wish cleans and contains outfits, opens the full image without paying, and reuses it in reveals and results", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  const banner = stub.wish.banners[1];
  banner.title = "";
  banner.art = ready(RAW_LOOK);
  banner.five.art = ready(RAW_LOOK);
  const cleanup = await stubLookCleanup(page);
  await stubRoutes(page, answer, calls);
  const root = await openOtome(page);
  await openDock(root, "Wish");
  await expect(root.locator('.of-banner[data-kind="memories"] .of-banner-img')).toHaveAttribute("src", CG);
  expect(cleanup).toHaveLength(0);
  await root.getByRole("tab", { name: "Cassian’s Wardrobe" }).click();
  await expect(root.locator(".of-banner-title")).toHaveText("Gilded Hours");
  const image = root.locator(".of-banner-img");
  await expect(image).toHaveAttribute("src", CLEAN_LOOK);
  expect(cleanup).toHaveLength(1);
  expect(cleanup[0]).toMatchObject({ engine: "builtin", cleanupStrength: 35 });
  await expect(image).toHaveCSS("object-fit", "contain");
  await expect(image).toHaveCSS("object-position", "50% 50%");
  await expect(image).toHaveCSS("animation-name", "none");
  await root.locator(".of-banner-hero").screenshot({ path: testInfo.outputPath("wardrobe-banner-contained.png") });
  const open = root.getByRole("button", { name: "View full image: Gilded Hours" });
  await open.focus();
  await open.press("Enter");
  const dialog = root.getByRole("dialog", { name: "Gilded Hours" });
  await expect(dialog.locator(".of-viewer-img")).toHaveAttribute("src", CLEAN_LOOK);
  await expect(dialog.locator(".of-viewer-img")).toHaveAttribute("alt", "Gilded Hours");
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await expect(dialog.locator(".of-viewer-img")).toHaveCSS("object-fit", "contain");
  await dialog.getByRole("button", { name: "Close", exact: true }).press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  expect(posts(calls, "/wish/pull")).toHaveLength(0);
  expect(calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toHaveLength(0);

  stub.pullResponse = {
    results: [{ item: { ...banner.five, owned: true }, rarity: 5, isNew: true, refund: 0 }],
    spent: 100,
    starlight: 1900,
    pity: PITY,
  };
  await root.getByRole("button", { name: "Wish ×1, 100 Starlight", exact: true }).click();
  const takeover = page.getByRole("dialog", { name: "Your wish" });
  await takeover.getByRole("button", { name: "Break the seal" }).click();
  await expect(takeover.locator(".of-reveal-art img")).toHaveAttribute("src", CLEAN_LOOK);
  await takeover.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(takeover.locator(".of-item-art img")).toHaveAttribute("src", CLEAN_LOOK);
  await takeover.locator(".of-pull-tile").click();
  await expect(takeover.locator(".of-item-detail .of-item-art img")).toHaveAttribute("src", CLEAN_LOOK);
  expect(cleanup).toHaveLength(1);
  expect(posts(calls, "/wish/pull")).toHaveLength(1);
  expect(calls.filter((call) => /\/(?:art|open|generate)$/u.test(call.path) && call.method === "POST")).toHaveLength(0);
  expect(banner.art.url).toBe(RAW_LOOK);
});

test("Otome Hearth look art: Wardrobe cleans LI and persona looks, faces and couple thumbnails while preserving pair art", async ({
  page,
}) => {
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  const wardrobe = wardrobeView();
  for (const entry of [...wardrobe.him[ILVAR], ...wardrobe.me]) {
    entry.url = RAW_LOOK;
    entry.art = ready(RAW_LOOK);
  }
  for (const entry of wardrobe.him[ILVAR]) entry.faces = { cold: RAW_LOOK };
  wardrobe.couples[0].his.url = RAW_LOOK;
  wardrobe.couples[0].his.owned = true;
  wardrobe.couples[0].hers.url = RAW_LOOK;
  wardrobe.couples[0].complete = true;
  wardrobe.couples[0].pair = ready(CG);
  const cleanup = await stubLookCleanup(page);
  await stubRoutes(
    page,
    (call) => (call.path.endsWith("/wardrobe") ? { status: 200, json: wardrobe } : answer(call)),
    calls,
  );
  const root = await openOtome(page);
  await openDock(root, "Wardrobe");
  await expect(root.locator(".of-ward-look .of-ward-frame img")).toHaveCount(2);
  await expect(root.locator(".of-ward-faces img")).toHaveCount(2);
  for (const img of await root.locator(".of-ward-frame img, .of-ward-faces img").all())
    await expect(img).toHaveAttribute("src", CLEAN_LOOK);
  const owners = root.getByRole("group", { name: "Whose wardrobe" });
  await owners.getByText("Me", { exact: true }).click();
  await expect(owners.getByRole("radio", { name: "Me", exact: true })).toBeChecked();
  await expect(root.getByRole("heading", { name: "My looks" })).toBeVisible();
  for (const img of await root.locator(".of-ward-frame img, .of-ward-faces img").all())
    await expect(img).toHaveAttribute("src", CLEAN_LOOK);
  await expect(root.locator(".of-couple-portrait")).toHaveAttribute("src", CG);
  expect(cleanup).toHaveLength(1);
  expect(calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toHaveLength(0);
  expect(stub.view.player.outfits).toEqual([]);
  expect(wardrobe.me[0].url).toBe(RAW_LOOK);
});

test("Otome Hearth look art: pending, late, missing and failed cleanup never exposes matte or the prior outfit", async ({
  page,
}) => {
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  stub.wish.banners[1].art = ready(RAW_LOOK);
  stub.wish.banners[2].art = ready(OTHER_LOOK);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let count = 0;
  let oldRouteDone!: () => void;
  const oldRoute = new Promise<void>((resolve) => (oldRouteDone = resolve));
  const cleanup = await stubLookCleanup(
    page,
    async () => {
      const current = ++count;
      if (current === 1) await held;
      return { base64: current === 1 ? CLEAN_LOOK : `data:image/png;base64,${lookPng(false).toString("base64")}` };
    },
    (index) => {
      if (index === 1) oldRouteDone();
    },
  );
  await stubRoutes(page, answer, calls);
  const root = await openOtome(page);
  await openDock(root, "Wish");
  await root.getByRole("tab", { name: "Cassian’s Wardrobe" }).click();
  await expect.poll(() => cleanup.length).toBe(1);
  await expect(root.locator(".of-banner-img")).toHaveCount(0);
  await expect(root.getByRole("button", { name: /View full image:/u })).toHaveCount(0);
  const rejected = page.waitForResponse((response) => response.url().endsWith("/api/sprites/cleanup"));
  await root.getByRole("tab", { name: "My Wardrobe" }).click();
  await expect.poll(() => cleanup.length).toBe(2);
  await (await rejected).finished();
  await lookSettled(page, OTHER_LOOK);
  release();
  await oldRoute;
  await expect(root.locator('.of-banner[data-kind="my-wardrobe"]')).toBeVisible();
  await expect(root.locator(".of-banner-img")).toHaveCount(0);
  // An updated source URL is missing: do not reuse a cached derivative for the older source.
  stub.wish.banners[2].art = ready("/api/global-gallery/file/missing-look.png?v=2");
  await page.route("**/api/global-gallery/file/missing-look.png?v=2", (route) => route.fulfill({ status: 404 }));
  await page.clock.install();
  await page.clock.fastForward(31_000);
  await openDock(root, "Story");
  const missing = page.waitForResponse(
    (response) => response.url().endsWith("/missing-look.png?v=2") && response.status() === 404,
  );
  await openDock(root, "Wish");
  // Wait for the replacement metadata before selecting its tab; the older failed URL may retry on a fresh mount.
  await expect
    .poll(() =>
      page.evaluate(
        (run) =>
          (globalThis as any).__MARINARA_HOST__.queryClient.getQueryData(["otome-forge", "wish", run])?.banners[2].art
            .url,
        RUN,
      ),
    )
    .toBe("/api/global-gallery/file/missing-look.png?v=2");
  await root.getByRole("tab", { name: "My Wardrobe" }).click();
  await missing;
  await expect(root.locator(".of-banner-img")).toHaveCount(0);
  expect(cleanup).toHaveLength(2);
  expect(calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toHaveLength(0);
});

test("Otome Hearth look art: stale refresh keeps the same cleaned outfit and its viewer, but a cleanup 404 hides it", async ({
  page,
}) => {
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  stub.wish.banners[1].art = ready(RAW_LOOK);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let count = 0;
  const cleanup = await stubLookCleanup(page, async () => {
    if (++count === 2) await held;
    return { base64: CLEAN_LOOK };
  });
  await stubRoutes(page, answer, calls);
  const root = await openOtome(page);
  await openDock(root, "Wish");
  await root.getByRole("tab", { name: "Cassian’s Wardrobe" }).click();
  await expect(root.locator(".of-banner-img")).toHaveAttribute("src", CLEAN_LOOK);
  await page.clock.install();
  await page.clock.fastForward(31_000);
  await openDock(root, "Story");
  await openDock(root, "Wish");
  await root.getByRole("tab", { name: "Cassian’s Wardrobe" }).click();
  await expect.poll(() => cleanup.length).toBe(2);
  await expect(root.locator(".of-banner-img")).toHaveAttribute("src", CLEAN_LOOK);
  const open = root.getByRole("button", { name: "View full image: Gilded Hours" });
  await open.click();
  const dialog = root.getByRole("dialog", { name: "Gilded Hours" });
  await expect(dialog.locator(".of-viewer-img")).toHaveAttribute("src", CLEAN_LOOK);
  const refreshed = page.waitForResponse((response) => response.url().endsWith("/api/sprites/cleanup"));
  release();
  await (await refreshed).finished();
  await lookSettled(page, RAW_LOOK);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.clock.fastForward(31_000);
  await page.route("**/api/sprites/cleanup", (route) => route.fulfill({ status: 404 }));
  await openDock(root, "Story");
  const missing = page.waitForResponse(
    (response) => response.url().endsWith("/api/sprites/cleanup") && response.status() === 404,
  );
  await openDock(root, "Wish");
  await root.getByRole("tab", { name: "Cassian’s Wardrobe" }).click();
  await missing;
  await expect(root.locator(".of-banner-img")).toHaveCount(0);
  await expect(root.getByRole("button", { name: /View full image:/u })).toHaveCount(0);
  expect(calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toHaveLength(0);
});

test("Otome Hearth look art: a pending prompt review cannot open a second image dialog or pay for painting", async ({
  page,
}) => {
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  const banner = stub.wish.banners[1];
  banner.art = { state: "failed", at: now(), error: "Earlier image refused" };
  banner.five.art = ready(RAW_LOOK);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await stubLookCleanup(page);
  await stubRoutes(
    page,
    (call) =>
      call.path.endsWith("/wish/art/prompt")
        ? { status: 200, json: { prompt: "A neutral fully clothed look", negativePrompt: "text" }, wait: held }
        : answer(call),
    calls,
  );
  const root = await openOtome(page, { review: true });
  await openDock(root, "Wish");
  await root.getByRole("tab", { name: "Cassian’s Wardrobe" }).click();
  const open = root.getByRole("button", { name: "View full image: Gilded Hours" });
  await expect(open).toBeEnabled();
  await root.getByRole("button", { name: "Try painting it again", exact: true }).click();
  await expect.poll(() => posts(calls, "/wish/art/prompt").length).toBe(1);
  await expect(open).toBeDisabled();
  release();
  const review = root.getByRole("dialog", { name: "Paint: Gilded Hours" });
  await expect(review).toBeVisible();
  await expect(root.getByRole("dialog")).toHaveCount(1);
  await review.press("Escape");
  await expect(root.getByRole("dialog")).toHaveCount(0);
  await expect(open).toBeEnabled();
  expect(posts(calls, "/wish/art")).toHaveLength(0);
  expect(posts(calls, "/wish/pull")).toHaveLength(0);
});

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
  await expect(status).toContainText("They’re noticing your new look");
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

test("Otome Hearth Album: rarity filters keep unplayed stories first in stable acquisition order", async ({ page }) => {
  const calls: Call[] = [];
  const { answer } = wishStub();
  const album = albumView();
  const memory = (id: string, kind: string, rarity: number, read: string | null, art: Json | null = null) => ({
    ...item(id, kind, rarity, ILVAR, id),
    owned: true,
    story: read ? { key: `story-${id}` } : null,
    read,
    art,
  });
  album.memories = [
    memory("Finished memory A", "memory5", 5, "done"),
    memory("Snapshot", "snapshot3", 3, null),
    memory("Unread moment A", "moment4", 4, "unread", ready(CG)),
    memory("Reading memory", "memory5", 5, "in-progress", ready(CG)),
    memory("Unopened memory", "memory5", 5, null),
    memory("Unread moment B", "moment4", 4, "unread"),
    memory("Finished moment", "moment4", 4, "done", ready(CG)),
    memory("Unread memory", "memory5", 5, "unread", ready(CG)),
    memory("Finished memory B", "memory5", 5, "done", ready(CG)),
  ];
  await stubRoutes(page, (call) => (call.path.endsWith("/album") ? { status: 200, json: album } : answer(call)), calls);
  const root = await openOtome(page);
  await openDock(root, "Album");
  await root.getByRole("tab", { name: "Memories", exact: true }).click();
  const filters = root.getByRole("group", { name: "Memory rarity" });
  await expect(filters.getByRole("radio", { name: "All", exact: true })).toBeChecked();
  const titles = root.locator(".of-keepsake-title");
  await expect(titles).toHaveText([
    "Unread moment A",
    "Unopened memory",
    "Unread moment B",
    "Unread memory",
    "Finished memory A",
    "Snapshot",
    "Reading memory",
    "Finished moment",
    "Finished memory B",
  ]);
  await filters.getByText("5★", { exact: true }).click();
  await expect(filters.getByRole("radio", { name: "5 stars", exact: true })).toBeChecked();
  await expect(titles).toHaveText([
    "Unopened memory",
    "Unread memory",
    "Finished memory A",
    "Reading memory",
    "Finished memory B",
  ]);
  await filters.getByText("4★", { exact: true }).click();
  await expect(filters.getByRole("radio", { name: "4 stars", exact: true })).toBeChecked();
  await expect(titles).toHaveText(["Unread moment A", "Unread moment B", "Finished moment"]);
  await filters.getByText("3★", { exact: true }).click();
  await expect(filters.getByRole("radio", { name: "3 stars", exact: true })).toBeChecked();
  await expect(titles).toHaveText(["Snapshot"]);
  await filters.getByText("All", { exact: true }).click();
  await expect(filters.getByRole("radio", { name: "All", exact: true })).toBeChecked();
  await expect(titles).toHaveCount(9);
  await expect(
    root.locator(".of-keepsake").filter({ hasText: "Finished memory A" }).locator(".of-keepsake-state"),
  ).toHaveText("Read");
  expect(calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toEqual([]);
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
  // A Memory won is on the timeline with what it is, and opens in the Album.
  const line = root.locator(".of-love-line");
  await expect(line.locator(".of-love-kind")).toContainText("Memory");
  await line.getByRole("button", { name: "Ink and Rain", exact: true }).click();
  await expect(page.getByRole("button", { name: "Read the story" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Read the story" })).toHaveCount(0);
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

test("Otome Hearth Wish: a long 5★ premise fits a phone: the title shows whole and Continue is reachable (#1944)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  // The card's settled place, not its entrance slide.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { stub, answer } = wishStub();
  const premise = `${"In the frost-lit observation gallery, the great clock stops and only one of you knows why. ".repeat(14)}PREMISE-END`;
  const five = { ...memoriesBanner().five, premise };
  // The reveal shows the banner's item.
  stub.wish = {
    ...stub.wish,
    banners: stub.wish.banners.map((banner: Json) => (banner.five.id === five.id ? { ...banner, five } : banner)),
  };
  stub.pullResponse = { results: [{ item: five, rarity: 5, isNew: true, refund: 0 }], starlight: 1900, pity: PITY };
  const calls: Call[] = [];
  await stubRoutes(page, answer, calls);
  const root = await openOtome(page);
  await openDock(root, "Wish");
  await root
    .getByRole("region", { name: "Clockwork Hearts" })
    .getByRole("button", { name: /^Wish ×1,/u })
    .click();
  const takeover = page.getByRole("dialog", { name: "Your wish" });
  await expect(takeover.getByRole("button", { name: "Break the seal" })).toBeFocused();
  await page.keyboard.press("Enter");
  const reveal = takeover.locator(".of-reveal");
  const card = reveal.locator(".of-reveal-card");
  const title = reveal.getByRole("heading", { name: "The Hour He Stopped" });
  await expect(title).toBeInViewport({ ratio: 1 });
  // Whole, inside the stage, and clear of Skip's row.
  const stage = (await takeover.boundingBox())!;
  const skip = (await takeover.getByRole("button", { name: "Skip" }).boundingBox())!;
  const box = (await card.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(skip.y + skip.height - 1);
  expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
  // The premise scrolls inside the card, and Continue is there at its end.
  expect(await card.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const go = reveal.getByRole("button", { name: "Continue" });
  await go.scrollIntoViewIfNeeded();
  await expect(go).toBeInViewport();
  await expect(reveal.getByText("PREMISE-END", { exact: false })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("reveal-long-premise-phone.png") });
  await go.click();
  await expect(reveal).toHaveCount(0);
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

test("Otome Hearth Snapshot: an owned vignette reviews one full image prompt and reuses its saved art", async ({
  page,
}) => {
  const calls: Call[] = [];
  const { stub, answer } = wishStub();
  stub.view.world.images.ask = true;
  const text = "Ilvar warms his hands around a cup while the canal lanterns settle into the evening.";
  const snapshot: Json = {
    ...item("memories-1-s1", "snapshot3", 3, ILVAR, "A Quiet Cup", { text }),
    owned: true,
    read: null,
  };
  const album = { ...albumView(), memories: [snapshot] };
  const prompt =
    "Illustrate this saved everyday moment. " +
    "Warm lantern light on a blue coat and a cup. ".repeat(120) +
    "PROMPT-END";
  const negativePrompt = "blurry, compression artifacts, ".repeat(150) + "NEGATIVE-END";
  expect(prompt.length).toBeGreaterThan(4000);
  expect(negativePrompt.length).toBeGreaterThan(4000);
  const artPath = `/items/${snapshot.id}/art`;
  const openPath = `/items/${snapshot.id}/open`;
  await stubRoutes(
    page,
    (call) => {
      if (call.path.endsWith("/album")) return { status: 200, json: album };
      if (call.path.endsWith(openPath) && call.method === "POST") {
        snapshot.art = { state: "waiting-consent", at: now() };
        return { status: 200, json: { item: snapshot, story: null, art: snapshot.art } };
      }
      if (call.path.endsWith(`${artPath}/prompt`) && call.method === "POST")
        return { status: 200, json: { prompt, negativePrompt } };
      if (call.path.endsWith(artPath) && call.method === "POST") {
        snapshot.art = ready(CG);
        return { status: 200, json: { art: snapshot.art } };
      }
      return answer(call);
    },
    calls,
  );
  const root = await openOtome(page, { review: true });
  const balance = await starlight(root).textContent();
  expect(balance).toBeTruthy();
  await openDock(root, "Album");
  await root.getByRole("tab", { name: "Memories", exact: true }).click();
  const card = root.getByRole("button", { name: /A Quiet Cup/u });
  await expect(card).toContainText(text);
  await card.click();
  const detail = root.getByRole("dialog", { name: "Memory", exact: true });
  await expect(detail.locator(".of-item-text--snapshot")).toHaveText(text);
  await expect(
    detail.getByText("Paints 1 image · after you tap Paint (Ask before painting)", { exact: true }),
  ).toBeVisible();
  await expect(detail.getByText("Writes its story", { exact: true })).toHaveCount(0);
  expect(calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toEqual([]);
  await detail.getByRole("button", { name: "Open it", exact: true }).click();
  await expect(detail.getByRole("button", { name: "Paint it", exact: true })).toBeVisible();
  expect(posts(calls, openPath)).toHaveLength(1);
  expect(posts(calls, artPath)).toHaveLength(0);
  await detail.getByRole("button", { name: "Paint it", exact: true }).click();
  const review = root.getByRole("dialog", { name: "Paint: A Quiet Cup", exact: true });
  await expect(review).toBeVisible();
  await expect(root.getByRole("dialog")).toHaveCount(1);
  await expect(review.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(prompt);
  await expect(review.getByRole("textbox", { name: "Negative prompt", exact: true })).toHaveValue(negativePrompt);
  await expect(review.getByText("Paints 1 image", { exact: true })).toBeVisible();
  expect(posts(calls, artPath)).toHaveLength(0);
  const reviewed = `${prompt} USER REVIEWED THE WHOLE PROMPT.`;
  await review.getByRole("textbox", { name: "Prompt", exact: true }).fill(reviewed);
  await review.getByRole("button", { name: "Paint", exact: true }).click();
  await expect(review).toHaveCount(0);
  await expect(detail.locator(".of-item-art img")).toHaveAttribute("src", CG);
  await expect(detail.locator(".of-item-text--snapshot")).toHaveText(text);
  expect(posts(calls, artPath)).toHaveLength(1);
  expect(posts(calls, artPath)[0]!.body).toMatchObject({ prompt: reviewed, negativePrompt });
  await detail.getByRole("button", { name: "Close", exact: true }).click();
  await openDock(root, "Story");
  await openDock(root, "Album");
  await root.getByRole("tab", { name: "Memories", exact: true }).click();
  await root.getByRole("button", { name: /A Quiet Cup/u }).click();
  await expect(detail.locator(".of-item-art img")).toHaveAttribute("src", CG);
  await expect(detail.locator(".of-item-text--snapshot")).toHaveText(text);
  await expect(detail.getByRole("button", { name: "Open it", exact: true })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Paint it", exact: true })).toHaveCount(0);
  await expect(starlight(root)).toHaveText(balance!);
  expect(snapshot.story).toBeNull();
  expect(snapshot.read).toBeNull();
  expect(snapshot.text).toBe(text);
  expect(
    calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened")).map((call) => call.path),
  ).toEqual([
    `/api/otome-forge/runs/${RUN}${openPath}`,
    `/api/otome-forge/runs/${RUN}${artPath}/prompt`,
    `/api/otome-forge/runs/${RUN}${artPath}`,
  ]);
});

for (const colorScheme of ["dark", "light"] as const) {
  test(`Otome Hearth four-star memory: a saved Moment gains reviewed artwork without rewriting its story (${colorScheme})`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
    const calls: Call[] = [];
    const { stub, answer } = wishStub();
    stub.view.world.images.ask = true;
    const moment = item("memories-1-a1", "moment4", 4, ILVAR, "The Last Lantern", {
      owned: true,
      premise: "You and Ilvar share the last lantern on the canal.",
      story: { key: "story-memories-1-a1" },
      read: "done",
    });
    const savedStory = structuredClone(moment.story);
    const album: Json = { ...albumView(), cgs: [], memories: [moment] };
    const artPath = `/items/${moment.id}/art`;
    const openPath = `/items/${moment.id}/open`;
    const prompt = "Two adults sheltering the last canal lantern from the rain.";
    let attempts = 0;
    await stubRoutes(
      page,
      (call) => {
        if (call.path.endsWith("/album")) return { status: 200, json: album };
        if (call.path.endsWith(openPath) && call.method === "POST") {
          moment.art = { state: "waiting-consent", at: now() };
          return { status: 200, json: { item: moment, story: moment.story, art: moment.art } };
        }
        if (call.path.endsWith(`${artPath}/prompt`) && call.method === "POST")
          return { status: 200, json: { prompt, negativePrompt: "text, watermark" } };
        if (call.path.endsWith(artPath) && call.method === "POST") {
          attempts += 1;
          if (attempts === 1) return { status: 502, json: { error: "The image provider is unavailable." } };
          moment.art = ready(CG);
          album.cgs = [{ key: `item:${moment.id}`, source: "memory", li: ILVAR, title: moment.title, ...moment.art }];
          return { status: 200, json: { art: moment.art } };
        }
        return answer(call);
      },
      calls,
    );
    const root = await openOtome(page, { review: true });
    await expect(root).toHaveAttribute("data-look", colorScheme === "dark" ? "midnight" : "pearl");
    const balance = await starlight(root).textContent();
    await openDock(root, "Album");
    await root.getByRole("tab", { name: "Memories", exact: true }).click();
    await root.getByRole("button", { name: /The Last Lantern/u }).click();
    const detail = root.getByRole("dialog", { name: "Memory", exact: true });
    await expect(detail.getByRole("img", { name: "4 stars", exact: true })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Read the story", exact: true })).toBeVisible();
    await expect(detail.getByText("Writes its story", { exact: true })).toHaveCount(0);
    await expect(detail.getByText("Paints 1 image · after you tap Paint (Ask before painting)")).toBeVisible();
    expect(calls.filter((call) => call.method === "POST" && !call.path.endsWith("/index/opened"))).toEqual([]);
    await detail.getByRole("button", { name: "Open it", exact: true }).click();
    await expect(detail.getByRole("button", { name: "Paint it", exact: true })).toBeVisible();
    expect(posts(calls, openPath)).toHaveLength(1);
    expect(posts(calls, artPath)).toHaveLength(0);
    await detail.getByRole("button", { name: "Paint it", exact: true }).click();
    const review = root.getByRole("dialog", { name: "Paint: The Last Lantern", exact: true });
    await expect(review.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(prompt);
    const reviewed = `${prompt} Blue hour, a close composition.`;
    await review.getByRole("textbox", { name: "Prompt", exact: true }).fill(reviewed);
    await review.getByRole("button", { name: "Paint", exact: true }).click();
    await expect(review.getByRole("alert")).toContainText("Something went wrong. Try again.");
    await expect(review.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(reviewed);
    await review.getByRole("button", { name: "Paint", exact: true }).click();
    await expect(review).toHaveCount(0);
    await expect(detail.locator(".of-item-art img")).toHaveAttribute("src", CG);
    await expect(detail.getByRole("button", { name: "Read the story", exact: true })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Open it", exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`four-star-memory-${colorScheme}.png`) });
    await detail.getByRole("button", { name: "Close", exact: true }).click();
    await openDock(root, "Story");
    await openDock(root, "Album");
    await root.getByRole("tab", { name: "Memories", exact: true }).click();
    await root.getByRole("button", { name: /The Last Lantern/u }).click();
    await expect(detail.locator(".of-item-art img")).toHaveAttribute("src", CG);
    await expect(detail.getByRole("button", { name: "Open it", exact: true })).toHaveCount(0);
    await expect(starlight(root)).toHaveText(balance!);
    expect(moment.story).toEqual(savedStory);
    expect(moment.read).toBe("done");
    expect(posts(calls, openPath)).toHaveLength(1);
    expect(posts(calls, artPath)).toHaveLength(2);
    for (const paint of posts(calls, artPath))
      expect(paint.body).toMatchObject({ prompt: reviewed, negativePrompt: "text, watermark" });
    expect(calls.filter((call) => /\/chapters\/.*\/(?:beats|read)/u.test(call.path))).toEqual([]);
  });
}
