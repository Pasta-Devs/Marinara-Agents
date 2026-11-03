// Otome Hearth's Photo Shoot (#2087) in the Engine's Home tab, with /api/otome-forge/** stubbed by the server's rules
// (S/routes/dates.ts, S/minigames/photo-shoot.ts): without an image connection the Dates card says it needs one and
// has no Play; with one, Play opens the screen with its heading focused. Played by keyboard at 390 × 844: a painted
// place, his expression, a shared pose that sets hers to match (announced), her solo pose that ends it, her own words
// with their counter, then Take picture through Ask before painting and the prompt review, as exactly one POST with
// ids, her words, the edited prompt and a photo id; the polaroid shows. A failed photo and a lost answer each try
// again with the same id. With no painted place Take picture says why it waits. The Album's Photos view, save and
// delete a photo (asked in the same dialog, the question read with each answer), and a photo that lands while Delete
// asks never takes the shown one's place; Home tapes the newest photo into his note, its words wrapping around it in both looks, mirrored in
// RTL, at reduced motion. Each test runs on both projects (desktop-chromium and mobile-chromium).
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-photo-shoot.e2e.ts
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

const RUN = "r-e2e-photo01";
const KAI = "li-kai-0001";
const MIR = "li-mireille-0002";
const FILE = "/api/global-gallery/file";
const LOOK = `${FILE}/kai-look.png`;
const HER_LOOK = `${FILE}/mira-look.png`;
const PHOTO_URL = `${FILE}/kai-photo-1.png`;
const CONSERVATORY = { key: "the-glass-conservatory", name: "The Glass Conservatory" };
const CANAL = { key: "the-frozen-canal", name: "The Frozen Canal" };
const NOTE = "The canals froze at dawn, so I walked the long way round past your window. The light was on again.";
/** A 1×1 PNG for every gallery image the stub names. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PHOTO_ID = /^ph-[0-9a-z]{1,12}-[0-9a-z]{6}$/u;

type Take = "ready" | "failed" | "abort";
interface StubOptions {
  images?: boolean;
  /** Ask before painting. */
  ask?: boolean;
  /** The story's painted places. */
  places?: Array<{ key: string; name: string }>;
  /** How each POST /photos answers, in order (then "ready"). */
  takes?: Take[];
  /** Photos in the Album when it opens. */
  photos?: Json[];
  /** Home's newest photo with Kai. */
  homePhoto?: boolean;
  /** The first POST /photos waits for `release()`. */
  hold?: boolean;
  /** She owns a look not painted yet. */
  unpaintedLook?: boolean;
}

const albumPhoto = (id: string, url = PHOTO_URL) => ({
  key: `photo:${id}`,
  url,
  ref: `global-gallery:${id}`,
  at: new Date().toISOString(),
  li: KAI,
  source: "photo",
  title: CONSERVATORY.name,
});

/** The routes the Photo Shoot, the Album and Home use, answered in memory by the server's rules. */
function createPhotoStub({
  images = true,
  ask = false,
  places = [CONSERVATORY, CANAL],
  takes = [],
  photos = [],
  homePhoto = false,
  hold = false,
  unpaintedLook = false,
}: StubOptions = {}) {
  const calls: Call[] = [];
  let release = () => {};
  let gate: Promise<void> | null = hold ? new Promise<void>((resolve) => (release = resolve)) : null;
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
      images: { connectionId: images ? "conn-image" : null, rating: "sfw", ask, expressions: true },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
      audio: { tts: false },
      places: Object.fromEntries(
        places.map(({ key, name }) => [
          key,
          { name, tags: "glasshouse, ferns, no humans", art: { state: "ready", at: now(), url: `${FILE}/${key}.png` } },
        ]),
      ),
    },
    player: {
      personaId: "persona-mira",
      name: "Mira Vale",
      pronouns: she,
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
      portrait: HER_LOOK,
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
        level: 2,
        stage: 1,
      },
      { id: MIR, name: "Mireille", pronouns: she, source: "archetype", accent: "#E7A6B8", level: 1, stage: 1 },
    ],
    forge: { phase: "ready", steps: [] },
    starlight: 2000,
    stickers: [],
  };
  const index = {
    version: 1,
    runs: [{ runKey: RUN, title: "The Clockwork Masquerade", createdAt: now(), lastPlayedAt: null }],
    activeRun: RUN,
    ageGate: null,
    lastOpenedAt: null,
  };
  const album: Json[] = structuredClone(photos);
  const outcomes = [...takes];
  const base = (owner: string, url: string) => ({
    id: "base",
    owner,
    name: "",
    url,
    art: null,
    worn: true,
    wearable: true,
    unopened: false,
  });

  const answer = async (call: Call): Promise<{ status: number; json?: unknown; abort?: boolean }> => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const runPath = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (path === runPath) return { status: 200, json: { view: structuredClone(view) } };
    if (path === `${runPath}/home`) {
      const note = {
        li: KAI,
        dayKey: now().slice(0, 10),
        text: NOTE,
        face: "",
        mood: { word: "calm", reason: "frost" },
        curt: false,
        at: now(),
      };
      return {
        status: 200,
        json: {
          li: KAI,
          show: "him",
          note,
          look: null,
          faces: {},
          lines: { ready: true },
          rupture: false,
          unread: 0,
          backdrop: null,
          photo: homePhoto ? { url: PHOTO_URL, at: now() } : null,
          noticed: null,
          noticing: false,
        },
      };
    }
    if (/^\/runs\/[^/]+\/lis\/[^/]+\/lines$/u.test(path)) {
      return {
        status: 200,
        json: { ready: true, stage: 1, rupture: false, tap: null, annoyed: [], cold: [], comfort: [], claw: null },
      };
    }
    if (path === `${runPath}/play`) {
      return {
        status: 200,
        json: {
          dayKey: now().slice(0, 10),
          starlight: { earned: 0, cap: 400 },
          affection: { earned: {}, cap: 300 },
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
    if (path === `${runPath}/wardrobe`) {
      return {
        status: 200,
        json: {
          him: { [KAI]: [base(KAI, LOOK)] },
          me: [
            base("me", HER_LOOK),
            ...(unpaintedLook
              ? [
                  {
                    ...base("me", ""),
                    id: "my-wardrobe-0-a1",
                    name: "Rain Coat",
                    url: undefined,
                    worn: false,
                    wearable: false,
                  },
                ]
              : []),
          ],
          couples: [],
          noticed: null,
          noticing: false,
        },
      };
    }
    if (path === `${runPath}/photos/prompt`) {
      return {
        status: 200,
        json: {
          prompt: "A photo of Kai and Mira taking a picture together, both facing the camera and posing for it.",
          negativePrompt: "child, minor, extra people",
        },
      };
    }
    if (path === `${runPath}/photos`) {
      if (gate) {
        const wait = gate;
        gate = null;
        await wait;
      }
      const outcome = outcomes.shift() ?? "ready";
      if (outcome === "abort") return { status: 0, abort: true };
      const body = call.body!;
      const place = places.find((entry) => entry.key === body.place)!;
      const art =
        outcome === "ready"
          ? { state: "ready", at: now(), url: PHOTO_URL, ref: `global-gallery:${body.id}` }
          : { state: "failed", at: now(), error: "The provider said no." };
      if (outcome === "ready") album.unshift(albumPhoto(body.id));
      return {
        status: 200,
        json: {
          photo: {
            id: body.id,
            li: body.li,
            place,
            hisLook: body.hisLook,
            herLook: body.herLook,
            his: body.his,
            her: body.her,
            createdAt: now(),
            art,
          },
        },
      };
    }
    const deleted = /^\/runs\/[^/]+\/photos\/([^/]+)\/delete$/u.exec(path);
    if (deleted) {
      const at = album.findIndex((entry) => entry.key === `photo:${deleted[1]}`);
      if (at < 0) return { status: 404, json: { error: "No such photo.", code: "not-found" } };
      album.splice(at, 1);
      return { status: 200, json: { deleted: true } };
    }
    if (path === `${runPath}/album`) {
      return {
        status: 200,
        json: {
          cgs: [],
          memories: [],
          timeline: [],
          favorites: [],
          soundtrack: [{ cue: "home", track: null }],
          tells: { [KAI]: [], [MIR]: [] },
          stickers: [],
          photos: structuredClone(album),
        },
      };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer, view, album, release: () => release() };
}

type Stub = ReturnType<typeof createPhotoStub>;

async function stubRoutes(page: Page, stub: Stub) {
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const reply = await stub.answer({
      method: request.method(),
      path: url.pathname,
      body: request.method() === "POST" ? request.postDataJSON() : undefined,
    });
    if (reply.abort) await route.abort("connectionreset");
    else await route.fulfill({ status: reply.status, json: reply.json });
  });
  await page.route("**/api/game-assets/**", (route) => route.fulfill({ json: { assets: {} } }));
  await page.route(`**${FILE}/**`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
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
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
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

async function openDates(root: Locator) {
  await expect(root.getByRole("heading", { level: 1, name: "Kai Ardent" })).toBeVisible();
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
}

async function openPhotoShoot(root: Locator) {
  await openDates(root);
  await root.getByRole("button", { name: "Play: Photo Shoot with Kai Ardent" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Photo Shoot with Kai Ardent" })).toBeFocused();
}

const posts = (stub: Stub, suffix: string) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));
/** A POST's own fields: every one also carries the player's time zone, debug mode and prompt review setting. */
const fields = (call: Call) => {
  const { timeZone: _zone, debugMode: _debug, reviewImagePrompts: _review, ...rest } = call.body!;
  return rest;
};
/** Checks a radio by keyboard: focus it, then Space. */
async function pressRadio(page: Page, radio: Locator) {
  await radio.focus();
  await page.keyboard.press("Space");
  await expect(radio).toBeChecked();
}

test("Otome Hearth Photo Shoot: unavailable without an image connection; with one, Play opens it", async ({ page }) => {
  const stub = createPhotoStub({ images: false, unpaintedLook: true });
  await stubRoutes(page, stub);
  let root = await openOtome(page);
  await openDates(root);
  const card = root.locator('.of-activity[data-activity="photo-shoot"]');
  await expect(card.getByRole("heading", { name: "Photo Shoot with Kai Ardent" })).toBeVisible();
  await expect(card).toContainText("Needs an image connection");
  await expect(card).toContainText("No model calls · 1 image, when you take it");
  await expect(card).toContainText("No Starlight or affection");
  await expect(card.getByRole("button")).toHaveCount(0);

  stub.view.world.images.connectionId = "conn-image";
  await page.reload();
  await page.getByRole("tab", { name: "Open Otome Hearth" }).click();
  root = page.locator("marinara-capability-otome-forge .of-root");
  await expect(root).toBeVisible({ timeout: 60_000 });
  await openPhotoShoot(root);
  await expect(root.getByRole("radio", { name: /The Glass Conservatory/u })).toBeChecked();
  // A look she owns is not painted yet: the hint about it never hides that the photo wears nothing.
  await expect(root.locator(".of-looks-note")).toHaveText(
    "Only the photo wears these: what you both wear at home stays as it is. A look you own appears here once it’s painted: open it in the Wardrobe.",
  );
  expect(posts(stub, "/photos")).toHaveLength(0);
});

test("Otome Hearth Photo Shoot by keyboard at 390 × 844: a shared pose mirrors, a solo one ends it, one POST through ask and review", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const stub = createPhotoStub({ ask: true });
  await stubRoutes(page, stub);
  const root = await openOtome(page, { review: true });
  await openPhotoShoot(root);

  // The second painted place, by the arrow keys from the first (checked to begin with).
  const placeGroup = root.getByRole("group", { name: "Where you and Kai Ardent take the photo" });
  const first = placeGroup.getByRole("radio", { name: /The Glass Conservatory/u });
  await expect(first).toBeChecked();
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(placeGroup.getByRole("radio", { name: /The Frozen Canal/u })).toBeChecked();

  const his = root.getByRole("region", { name: "Kai Ardent" });
  const hers = root.getByRole("region", { name: "You" });
  const hisExpression = his.getByRole("group", { name: "Expression" });
  await hisExpression.getByRole("radio", { name: "Smile" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(hisExpression.getByRole("radio", { name: "Wink" })).toBeChecked();

  // His "Carries piggyback" is her "Rides piggyback", said aloud.
  await pressRadio(
    page,
    his.getByRole("group", { name: "Together" }).getByRole("radio", { name: "Carries piggyback" }),
  );
  await expect(
    hers.getByRole("group", { name: "Together" }).getByRole("radio", { name: "Rides piggyback" }),
  ).toBeChecked();
  await expect(root.getByRole("status").filter({ hasText: "Mira Vale’s pose: Rides piggyback" })).toHaveCount(1);
  await expect(his.getByText("A pose together is one pick for you both")).toBeVisible();

  // Her solo pose ends it: he goes back to posing for the camera.
  await pressRadio(page, hers.getByRole("group", { name: "On your own" }).getByRole("radio", { name: "Peace sign" }));
  await expect(
    his.getByRole("group", { name: "On your own" }).getByRole("radio", { name: "Pose for the camera" }),
  ).toBeChecked();
  await expect(his.getByRole("group", { name: "Together" }).getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(root.getByRole("status").filter({ hasText: "Kai Ardent’s pose: Pose for the camera" })).toHaveCount(1);

  // Her own words for her expression, with their counter; Take picture waits for them.
  await pressRadio(page, hers.getByRole("group", { name: "Expression" }).getByRole("radio", { name: "Your own" }));
  const take = root.getByRole("button", { name: "Take picture" });
  await expect(take).toHaveAttribute("aria-disabled", "true");
  await expect(take).toHaveAccessibleDescription("Write your own words, or pick one.");
  const words = hers.getByRole("textbox", { name: "Your own expression" });
  await words.focus();
  await page.keyboard.type("a crooked grin");
  await expect(hers.getByText("14 / 80")).toBeVisible();
  await expect(take).toHaveAttribute("aria-disabled", "false");
  await page.screenshot({ path: testInfo.outputPath("photo-shoot-setup.png"), fullPage: true });

  // Ask before painting, then the prompt review; Send is one POST.
  await take.focus();
  await page.keyboard.press("Enter");
  const ask = page.getByRole("dialog", { name: "Take this picture?" });
  await expect(ask).toContainText("One photo of you and Kai Ardent");
  await expect(ask).toContainText("Paints 1 image");
  expect(posts(stub, "/photos/prompt")).toHaveLength(0);
  await ask.getByRole("button", { name: "Take it" }).focus();
  await page.keyboard.press("Enter");
  const review = page.getByRole("dialog", { name: "Paint: a photo with Kai Ardent" });
  await expect(review).toBeVisible();
  expect(posts(stub, "/photos/prompt")).toHaveLength(1);
  expect(fields(posts(stub, "/photos/prompt")[0]!)).toEqual({
    li: KAI,
    place: CANAL.key,
    hisLook: "base",
    herLook: "base",
    his: { expression: "wink", pose: "pose" },
    her: { expression: "custom", expressionText: "a crooked grin", pose: "peace" },
  });
  const prompt = review.getByRole("textbox", { name: "Prompt", exact: true });
  await prompt.fill("EDITED: Kai and Mira under the frozen canal lamps");
  await review.getByRole("button", { name: "Take picture" }).focus();
  await page.keyboard.press("Enter");

  const print = root.locator("figure.of-photo-result img");
  await expect(print).toHaveAttribute("alt", "You and Kai Ardent at The Frozen Canal");
  await expect(root.getByText("Kept in the Album, and taped into Kai Ardent’s note on Home.")).toBeVisible();
  await expect(review).toHaveCount(0);
  await expect(root.getByRole("button", { name: "Take another" })).toBeFocused();
  const sent = posts(stub, "/photos");
  expect(sent).toHaveLength(1);
  const body = fields(sent[0]!);
  expect(body.id).toMatch(PHOTO_ID);
  expect(body).toEqual({
    id: body.id,
    li: KAI,
    place: CANAL.key,
    hisLook: "base",
    herLook: "base",
    his: { expression: "wink", pose: "pose" },
    her: { expression: "custom", expressionText: "a crooked grin", pose: "peace" },
    prompt: "EDITED: Kai and Mira under the frozen canal lamps",
    negativePrompt: "child, minor, extra people",
  });
  await page.screenshot({ path: testInfo.outputPath("photo-shoot-print.png") });

  // Take another starts a new photo with the same setup.
  await page.keyboard.press("Enter");
  await expect(take).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("Otome Hearth Photo Shoot: a failed photo and a lost answer each try again with the same id", async ({ page }) => {
  const stub = createPhotoStub({ takes: ["failed", "ready", "abort", "ready"] });
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  await openPhotoShoot(root);
  await root.getByRole("button", { name: "Take picture" }).click();
  await expect(root.getByRole("alert")).toContainText(
    "The photo didn’t finish. Otome Hearth takes it again only when you ask.",
  );
  await root.getByRole("button", { name: "Try again" }).click();
  await expect(root.locator("figure.of-photo-result img")).toBeVisible();
  let sent = posts(stub, "/photos").map((call) => call.body!.id);
  expect(sent).toHaveLength(2);
  expect(sent[1]).toBe(sent[0]);

  await root.getByRole("button", { name: "Take another" }).click();
  await root.getByRole("button", { name: "Take picture" }).click();
  await expect(root.getByRole("alert")).toBeVisible();
  await root.getByRole("button", { name: "Try again" }).click();
  await expect(root.locator("figure.of-photo-result img")).toBeVisible();
  sent = posts(stub, "/photos").map((call) => call.body!.id);
  expect(sent).toHaveLength(4);
  expect(sent[3]).toBe(sent[2]);
  expect(sent[2]).not.toBe(sent[0]);
});

test("Otome Hearth Photo Shoot: with no painted place there is nothing to take, and Take picture says why", async ({
  page,
}) => {
  const stub = createPhotoStub({ places: [] });
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  await openPhotoShoot(root);
  await expect(
    root.getByText("Your story hasn’t painted a place yet. Once it has, you can take a photo there.").first(),
  ).toBeVisible();
  const take = root.getByRole("button", { name: "Take picture" });
  await expect(take).toHaveAttribute("aria-disabled", "true");
  await expect(take).toHaveAccessibleDescription(
    "Your story hasn’t painted a place yet. Once it has, you can take a photo there.",
  );
  // aria-disabled keeps it in reach of the keyboard; a press does nothing.
  await take.click({ force: true });
  await take.focus();
  await page.keyboard.press("Enter");
  expect(posts(stub, "/photos")).toHaveLength(0);
  expect(posts(stub, "/photos/prompt")).toHaveLength(0);
});

test("Otome Hearth Album: Photos opens a photo large, saves it, and deletes it after asking in the same dialog", async ({
  page,
}) => {
  const id = "ph-mh1abc-abcdef";
  const stub = createPhotoStub({ photos: [albumPhoto(id)] });
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Album", exact: true }).click();
  const tabs = root.getByRole("tablist", { name: "Album" });
  await tabs.getByRole("tab", { name: "Photos", exact: true }).click();
  await root.getByRole("button", { name: "View: The Glass Conservatory" }).click();
  const viewer = page.getByRole("dialog", { name: "The Glass Conservatory" });
  await expect(viewer).toContainText("From a Photo Shoot");
  const download = page.waitForEvent("download");
  await viewer.getByRole("button", { name: "Save image" }).click();
  // The gallery file's own name, as every Album image saves.
  expect((await download).suggestedFilename()).toBe("kai-photo-1.png");

  await viewer.getByRole("button", { name: "Delete photo" }).click();
  await expect(viewer).toContainText("Delete this photo?");
  await expect(viewer.getByRole("button", { name: "Keep it" })).toBeFocused();
  // Focus lands on Keep it in a dialog that opened before the question: each answer reads the question with it.
  const question = "Delete this photo? It leaves the Album and the note on Home, and it can’t be brought back.";
  await expect(viewer.getByRole("button", { name: "Keep it" })).toHaveAccessibleDescription(question);
  await expect(viewer.getByRole("button", { name: "Delete", exact: true })).toHaveAccessibleDescription(question);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await viewer.getByRole("button", { name: "Keep it" }).click();
  await expect(viewer.getByRole("button", { name: "Delete photo" })).toBeFocused();
  expect(posts(stub, "/delete")).toHaveLength(0);
  await viewer.getByRole("button", { name: "Delete photo" }).click();
  await viewer.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(posts(stub, `/photos/${id}/delete`)).toHaveLength(1);
  await expect(root.getByRole("tabpanel")).toBeFocused();
  await expect(root.getByRole("tabpanel")).toContainText("No photos yet.");
});

test("Otome Hearth Album: a photo that lands while Delete asks never takes the place of the one being deleted", async ({
  page,
}) => {
  const shown = "ph-mh1abc-abcdef";
  const stub = createPhotoStub({ photos: [albumPhoto(shown)], hold: true });
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  // A photo is still being taken when the player leaves for the Album.
  await openPhotoShoot(root);
  await root.getByRole("button", { name: "Take picture" }).click();
  await expect.poll(() => posts(stub, "/photos").length).toBe(1);
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Album", exact: true }).click();
  await root.getByRole("tablist", { name: "Album" }).getByRole("tab", { name: "Photos", exact: true }).click();
  await root.getByRole("button", { name: "View: The Glass Conservatory" }).click();
  const viewer = page.getByRole("dialog", { name: "The Glass Conservatory" });
  await viewer.getByRole("button", { name: "Delete photo" }).click();
  await expect(viewer.getByRole("button", { name: "Keep it" })).toBeFocused();

  // It lands first in the list behind the dialog (the Photo Shoot refreshes the Album once it answers).
  stub.release();
  await expect(root.locator(".of-album-cg")).toHaveCount(2);
  await viewer.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const taken = posts(stub, "/photos")[0]!.body!.id;
  expect(posts(stub, "/delete").map((call) => call.path)).toEqual([
    `/api/otome-forge/runs/${RUN}/photos/${shown}/delete`,
  ]);
  expect(stub.album.map((entry) => entry.key)).toEqual([`photo:${taken}`]);
  await expect(root.locator(".of-album-cg")).toHaveCount(1);
});

test("Otome Hearth Home: the newest photo is taped into his note, its words wrapping around it", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const stub = createPhotoStub({ homePhoto: true });
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const note = root.getByRole("article", { name: "A note from Kai Ardent" });
  await expect(note).toContainText("The canals froze at dawn");
  const photo = note.locator(".of-note-text > .of-note-photo");
  await expect(photo).toHaveCount(1);
  await expect(photo.getByRole("img", { name: "A photo of you and Kai Ardent" })).toBeVisible();
  await expect(photo.locator("button, a, [tabindex]")).toHaveCount(0);

  const measure = () =>
    note.evaluate((element) => {
      const text = element.querySelector(".of-note-text")!;
      const range = document.createRange();
      range.selectNodeContents(text.querySelector("p")!);
      const line = range.getClientRects()[0]!;
      const print = element.querySelector(".of-note-photo")!.getBoundingClientRect();
      return {
        line: { left: line.left, right: line.right },
        print: { left: print.left, right: print.right },
        words: text.clientHeight,
      };
    });
  for (const [colorScheme, look] of [
    ["dark", "midnight"],
    ["light", "pearl"],
  ] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await expect(root).toHaveAttribute("data-look", look);
    await expect(note).toHaveCSS("animation-name", "none");
    const box = await measure();
    expect(box.line.right, "the first line stops before the photo").toBeLessThanOrEqual(box.print.left + 1);
    expect(box.words, "a line of words shows").toBeGreaterThanOrEqual(24);
    await page.screenshot({ path: testInfo.outputPath(`home-photo-${look}.png`) });
  }
  // Right to left, the photo is on the left and the words start beside it.
  await root.evaluate((element) => element.setAttribute("dir", "rtl"));
  const mirrored = await measure();
  expect(mirrored.line.left, "the first line starts after the photo in RTL").toBeGreaterThanOrEqual(
    mirrored.print.right - 1,
  );
  await page.screenshot({ path: testInfo.outputPath("home-photo-rtl.png") });
});
