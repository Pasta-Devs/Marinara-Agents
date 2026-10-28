// Otome Forge's Home and phone (M3) in the Engine's Home tab, with /api/otome-forge/** stubbed: the layered Home with
// his figure and face, the message of the day written once (and never asked for again by itself after a failure), his
// mood, tap lines that need no request (and annoy him after too many), Play, Him / Me, Reply into his thread with the
// note quoted; a thread with typing, his messages one by one, his sticker, suggestions, a sticker of hers, read
// receipts and Close and remember; then Home without images at reduced motion, during a rupture, with Rough day?.
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
const TENDER = png(13, 19, [230, 170, 190]);
const FLUSTERED = png(13, 19, [240, 140, 170]);
const AVATAR = png(8, 8, [231, 166, 184]);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
/** Exactly one of `lines`. */
const anyOf = (lines: string[]) => new RegExp("^(?:" + lines.map(escapeRegExp).join("|") + ")$", "u");

/** The M3 routes, answered in memory by the server's rules (S/routes/home.ts, S/routes/phone.ts). */
function createHomeStub({ images = true, rupture = false, noteFailures = 0 } = {}) {
  const calls: Call[] = [];
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
      {
        id: ILVAR,
        name: "Ilvar Thorne",
        pronouns,
        source: "card",
        accent: "#9DB8F0",
        level: 2,
        stage: 2,
        ...(images ? { portrait: PORTRAIT, expressions: { tender: TENDER, flustered: FLUSTERED } } : {}),
      },
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
  const notes = new Map<string, Json>();
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
  let suggestions: string[] = [];
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
    busy: false,
    retry: messages.at(-1)?.who === "player",
    sessions,
    suggestions,
    seenAt,
  });

  const answer = async (call: Call): Promise<{ status: number; json: unknown }> => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (path === base) return { status: 200, json: { view: structuredClone(view) } };
    if (path === `${base}/home`) {
      const look =
        home.show === "me"
          ? images
            ? { url: AVATAR, source: "avatar", cutoutState: "uncut" }
            : null
          : images && home.li === ILVAR
            ? { url: PORTRAIT, source: "look", cutoutState: "uncut" }
            : null;
      return {
        status: 200,
        json: {
          li: home.li,
          show: home.show,
          note: notes.get(home.li) ?? null,
          look,
          faces: {},
          lines: { ready: images },
          rupture,
          unread: unread(),
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
      if (!notes.has(li)) {
        notes.set(li, {
          li,
          dayKey: now().slice(0, 10),
          text: li === ILVAR ? NOTE : "The canals froze at dawn. I thought of you.",
          face: "tender",
          mood: { word: "irritable", reason: "audit" },
          at: now(),
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
              rupture,
              tap: rupture
                ? null
                : { head: tap(HIS_LINES.head), hand: tap(HIS_LINES.hand), heart: tap(HIS_LINES.heart) },
              annoyed: rupture ? [] : ANNOYED,
              cold: ["Not now.", "Leave it."],
              comfort: ["Sit. Tea first, then everything else."],
              claw: null,
            }
          : { ready: false, stage: 1, rupture, tap: null, annoyed: [], cold: [], comfort: [], claw: null },
      };
    }
    if (path === `${base}/phone`) {
      return {
        status: 200,
        json: {
          threads: [
            { li: ILVAR, last: messages.at(-1), unread: unread(), busy: false },
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
      await new Promise((done) => setTimeout(done, 500));
      replies += 1;
      const reply: Json[] = [
        {
          id: `m-r${replies}a`,
          who: "li",
          text: replies === 1 ? "Barely. The data kept me company." : "Noted.",
          at: now(),
        },
        { id: `m-r${replies}b`, who: "li", text: "", sticker: "tender", at: now() },
      ];
      messages.push(...reply);
      suggestions = replies === 1 ? ["Go to sleep, Ilvar.", "Tell me about the data."] : [];
      return { status: 200, json: { messages: [mine, ...reply], suggestions } };
    }
    if (path === `${base}/phone/${ILVAR}/close`) {
      const count = messages.length - archived();
      sessions.push({
        start: archived(),
        count,
        memory: { text: "She wrote late; he admitted he had not slept.", quote: "Barely." },
        closedAt: now(),
      });
      suggestions = [];
      return {
        status: 200,
        json: {
          memory: sessions.at(-1)!.memory,
          grants: [{ source: "close-and-remember", li: ILVAR, affection: 20 }],
        },
      };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer, notes };
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
  // The Engine's voice route: a silent clip.
  await page.route("**/api/tts/speak", async (route) => {
    spoken.push(String(route.request().postDataJSON()?.text ?? ""));
    await route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) });
  });
}

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

const posts = (stub: Stub, suffix: string) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));

/**
 * Every request Otome Forge makes from now on: its own routes and the voice service. The Engine shell's own traffic
 * (its polls and late first loads) is not Otome's, so it is left out.
 */
function apiRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^\/api\/(?:otome-forge|tts)\//.test(url.pathname)) seen.push(`${request.method()} ${url.pathname}`);
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
  const spoken: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, spoken);
  const root = await openHome(page);

  // Home opens on him: the layers fill the stage behind the top bar and the dock, his face from the note's mood.
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();
  const note = root.getByRole("article", { name: "A note from Ilvar Thorne" });
  await expect(note).toContainText(NOTE);
  await expect(root.getByRole("img", { name: "Ilvar Thorne, tender" })).toBeVisible();
  await expect(root.locator(".of-mood-chip")).toContainText("irritable: audit");
  for (const layer of ["place", "tint", "light"]) {
    await expect(root.locator(`.of-home-layers [data-layer="${layer}"]`)).toHaveCount(1);
  }
  const [layers, body] = await Promise.all([
    root.locator(".of-home-layers").boundingBox(),
    root.locator(".of-stage-body").boundingBox(),
  ]);
  expect(layers).toEqual(body);
  await expect(root.getByRole("button", { name: /Phone/ })).toContainText("1");
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
  // A real pointer on his chest (he breathes, so the zone never holds still for a locator click): the rows over him
  // let the tap through.
  const heart = (await zones.getByRole("button", { name: "Heart" }).boundingBox())!;
  await page.mouse.click(heart.x + heart.width / 2, heart.y + heart.height / 2);
  await expect(bubble).toHaveText(anyOf(HIS_LINES.heart));
  for (let tap = 0; tap < 4; tap++) await page.keyboard.press("Enter");
  await expect(bubble).toHaveAttribute("data-mode", "annoyed");
  expect(ANNOYED).toContain(await bubble.textContent());
  expect(requests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("02-tap.png") });

  // Play reads the note aloud through the Engine's voice service.
  await note.getByRole("button", { name: "Hear Ilvar Thorne read the note" }).click();
  await expect.poll(() => spoken).toEqual([NOTE]);

  // Me: the player in her own look (her persona's avatar), saved; then him again, by the keyboard.
  const him = root.getByRole("radio", { name: "Ilvar" });
  await him.focus();
  await page.keyboard.press("ArrowRight");
  await expect(root.getByRole("heading", { level: 1, name: "Mira Vale" })).toBeVisible();
  await expect(root.getByRole("img", { name: "You, Mira Vale" })).toBeVisible();
  expect(posts(stub, "/home/set").at(-1)!.body).toMatchObject({ show: "me" });
  await expect(root.locator('.of-figure[data-art="avatar"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("03-me.png") });
  await page.keyboard.press("ArrowLeft");
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeVisible();

  // Leaving Home and coming back reads the same note: it is never written twice.
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Story" }).click();
  await root.getByRole("button", { name: "Home with Ilvar Thorne" }).click();
  await expect(root.getByRole("article", { name: "A note from Ilvar Thorne" })).toContainText(NOTE);
  expect(posts(stub, "/home/note")).toHaveLength(1);

  // Reply opens his thread with the note quoted, focus on its heading; the quote goes with the first message.
  await root.getByRole("article", { name: "A note from Ilvar Thorne" }).getByRole("button", { name: "Reply" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();
  await expect(root.locator(".of-quote-chip")).toContainText(NOTE);
  await root.getByRole("textbox", { name: "Message Ilvar Thorne" }).fill("I left it on for you.");
  await page.keyboard.press("Enter");
  await expect(root.getByText("Barely. The data kept me company.")).toBeVisible();
  expect(posts(stub, "/send")[0]!.body).toMatchObject({ text: "I left it on for you.", quote: NOTE });
  await expect(root.locator(".of-quote-chip")).toHaveCount(0);
  const scrolled = await root.evaluate((element) =>
    [element, ...element.querySelectorAll(".of-frame, .of-stage, .of-stage-body")]
      .filter((box) => box.scrollTop || box.scrollLeft)
      .map((box) => box.className),
  );
  expect(scrolled).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("Otome Forge phone: a thread with typing, his sticker, suggestions, her sticker and Close and remember", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: "dark" });
  const stub = createHomeStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub, []);
  const root = await openHome(page);

  // The Phone button opens the threads: one per love interest, his with its unread message.
  await root.getByRole("button", { name: /Phone/ }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Phone" })).toBeFocused();
  const threads = root.locator(".of-threads");
  const row = threads.getByRole("button", { name: /Ilvar Thorne/ });
  await expect(row).toContainText("The light was on again.");
  await expect(row).toContainText("1 unread");
  await expect(threads.getByRole("button", { name: /Cassian/ })).toContainText("No messages yet.");
  await row.click();
  await expect(root.getByRole("heading", { level: 1, name: "Ilvar Thorne" })).toBeFocused();

  // What he remembers of the closed conversation, then the open one; his new message is marked seen.
  const log = root.getByRole("list", { name: "Messages with Ilvar Thorne" });
  await expect(log).toContainText("Remembered by Ilvar Thorne");
  await expect(log).toContainText("She asked where he was; he pretended not to be pleased.");
  await expect.poll(() => posts(stub, "/seen").at(-1)?.body?.last).toBe("m-a3");

  // He types, then his messages arrive one at a time: words, then his face as a sticker; suggestions follow.
  await root.getByRole("textbox", { name: "Message Ilvar Thorne" }).fill("Did you sleep at all?");
  await root.getByRole("button", { name: "Send" }).click();
  await expect(root.locator(".of-typing")).toBeVisible();
  await expect(root.locator('.of-bubble-row[data-who="player"]').last()).toContainText("Did you sleep at all?");
  await expect(log.getByText("Barely. The data kept me company.")).toBeVisible();
  await expect(log.getByRole("img", { name: "Sticker: Tender" }).last()).toBeVisible();
  await expect(root.locator(".of-typing")).toHaveCount(0);
  const sent = posts(stub, "/send")[0]!.body!;
  expect(sent).toMatchObject({ text: "Did you sleep at all?" });
  expect(sent.id).toMatch(/^[a-z0-9][a-z0-9-]{7,59}$/u);
  await page.screenshot({ path: testInfo.outputPath("04-thread.png") });

  // A suggestion sends as it is.
  const suggestions = root.getByRole("list", { name: "Suggested replies" });
  await suggestions.getByRole("button", { name: "Go to sleep, Ilvar." }).click();
  await expect(log.getByText("Noted.")).toBeVisible();
  expect(posts(stub, "/send")[1]!.body).toMatchObject({ text: "Go to sleep, Ilvar." });

  // Her sticker: one of his painted faces.
  await expect(root.locator(".of-typing")).toHaveCount(0);
  await root.getByRole("button", { name: "Stickers" }).click();
  await root.getByRole("button", { name: "Send the Flustered sticker" }).click();
  await expect.poll(() => posts(stub, "/send").length).toBe(3);
  expect(posts(stub, "/send")[2]!.body).toMatchObject({ text: "", sticker: "flustered" });
  await expect(log.getByRole("img", { name: "Sticker: Flustered" })).toBeVisible();

  // Close and remember: the conversation becomes his memory, and affection is earned once.
  await expect(root.locator(".of-typing")).toHaveCount(0);
  await root.getByRole("button", { name: "Close and remember" }).click();
  const dialog = page.getByRole("dialog", { name: "Close and remember?" });
  await expect(dialog).toContainText("Ilvar Thorne");
  await dialog.getByRole("button", { name: "Close and remember" }).click();
  await expect(log).toContainText("She wrote late; he admitted he had not slept.");
  await expect(log).toContainText("+20 affection");
  expect(posts(stub, "/close")).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath("05-remembered.png") });

  // Back to the threads, focus on his row.
  await root.getByRole("button", { name: "All messages" }).click();
  await expect(root.locator(".of-threads").getByRole("button", { name: /Ilvar Thorne/ })).toBeFocused();
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

  // His initials on his accent colour, with labelled tap buttons; nothing breathes, drifts or follows the pointer.
  const figure = root.getByRole("img", { name: "Ilvar Thorne", exact: true });
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
