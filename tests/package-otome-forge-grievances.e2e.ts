// Otome Hearth's grievances (#2156) in the Engine's Home tab, with /api/otome-forge/** stubbed by the server's rules.
// His grievance: the Story screen's banner and his route say how much space he still needs, with no Make it right
// until he has had it; his affection shows as paused; the Lead dialog says why he can't lead; every activity with him
// in Dates shows that he needs space, with no Play. Her grievance: "I'm upset with her" beside each route (also at
// stage 6) is a toggle (aria-pressed) that asks first (a dialog, Escape closes it and sends nothing) and is taken back
// at once; his invitation in Messages offers Accept and Decline, and Accept opens the scene that clears the air with him
// in the reader (#2303), which the accepted invitation offers again from the thread. A love interest picked for a won
// date before his grievance shows is dropped from it, shown as needing space, and never sent. Each test runs at phone width
// (mobile-chromium, 390×844, touch) and on the desktop (desktop-chromium, mouse), with no horizontal scroll.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-grievances.e2e.ts
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

const RUN = "r-e2e-griev1";
const KAI = "li-kai-0001";
const MIR = "li-mireille-0002";
const INVITE = "m-invite-0002";
/** A 4★ date won from Wish (#2303), planned from Album → Dates. */
const WON_DATE = {
  id: "dates-0-a1",
  kind: "date4",
  rarity: 4,
  banner: "dates-0",
  li: null,
  title: "An Evening at the Aquarium",
  premise: "Blue light and slow jellyfish.",
  place: { name: "The Moonlit Aquarium" },
  scenes: 2,
  owned: true,
  art: null,
  story: null,
};
/** A second won date, no picture, its title one word wider than a phone's card (Dottore, 0.33.3). */
const LONG_DATE = {
  ...WON_DATE,
  id: "dates-0-a2",
  title: "Moonlitpromenadebeneaththeharbourlanternsatmidnight",
  place: { name: "The Harbour Wall" },
};
/** The scene accepting her invitation registers (SH/dates.ts clearAirSceneKey). */
const SCENE = `story-clear-air-${MIR}-1`;

function createStub({
  images = false,
  ask = false,
  arc = null,
}: { images?: boolean; ask?: boolean; arc?: Json | null } = {}) {
  const calls: Call[] = [];
  // 0.34.8: with an image connection, a won 4★ date's first open paints its place in the background.
  let placeArt: Json | null = null;
  let releaseOpen: () => void = () => undefined;
  const openHeld = new Promise<void>((resolve) => (releaseOpen = resolve));
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
      places: {},
      content: { heat: "sfw", darkness: "angst", limits: {}, custom: [] },
      images: { connectionId: images ? "conn-image" : null, rating: "sfw", ask, expressions: true },
      connections: { narration: "conn-text" },
      // Voices off; the reader reads these settings when the clear-air scene opens.
      audio: { tts: false },
      forge: { phase: "ready", steps: [] },
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
      { id: KAI, name: "Kai Ardent", pronouns: they, source: "archetype", accent: "#9DB8F0", level: 3, stage: 2 },
      { id: MIR, name: "Mireille", pronouns: she, source: "archetype", accent: "#E7A6B8", level: 10, stage: 6 },
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
  const upset: Record<string, boolean> = { [KAI]: false, [MIR]: false };
  let asked = false;
  let eveningCounted = false;
  const messages: Json[] = [
    { id: "m-mine-0001", who: "player", text: "You didn't even look at me.", at: now() },
    {
      id: INVITE,
      who: "li",
      text: "I know you're upset with me. Let me make it up to you. Dinner, my choice?",
      at: now(),
      invite: { status: "pending" },
    },
  ];
  const look = (owner: string) => ({
    id: "base",
    owner,
    name: "",
    art: null,
    worn: true,
    wearable: true,
    unopened: false,
  });

  type Answer = { status: number; json: unknown };
  const answer = (call: Call): Answer | Promise<Answer> => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (path === base) return { status: 200, json: { view: structuredClone(view) } };
    if (path === `${base}/home`) {
      const note = {
        li: KAI,
        dayKey: now().slice(0, 10),
        text: "Not now.",
        face: "cold",
        mood: { word: "distant", reason: "you" },
        curt: true,
        at: now(),
      };
      return {
        status: 200,
        json: { li: KAI, show: "him", note, look: null, faces: {}, lines: { ready: true }, rupture: true, unread: 1 },
      };
    }
    if (/^\/runs\/[^/]+\/lis\/[^/]+\/lines$/u.test(path)) {
      return {
        status: 200,
        json: {
          ready: true,
          stage: 2,
          rupture: true,
          tap: null,
          annoyed: [],
          cold: ["Not now."],
          comfort: [],
          claw: null,
        },
      };
    }
    if (path === `${base}/story`) {
      return {
        status: 200,
        json: {
          chapters: [],
          next: { kind: "main", number: 3, candidates: [{ li: MIR, reason: "least-recent" }] },
          routes: [
            {
              li: KAI,
              stage: 2,
              next: { stage: 3, key: `route-${KAI}-3`, unlocked: false, requires: { level: 5 }, blockedBy: "rupture" },
              upset: upset[KAI],
            },
            // Stage 6: no next chapter, and the toggle is still there.
            { li: MIR, stage: 6, next: null, upset: upset[MIR] },
          ],
          repairs: [{ li: KAI, key: `repair-${KAI}-1`, space: { had: 1, needed: 2 } }],
          arc,
          arcChoice: null,
          prestige: [],
        },
      };
    }
    const upsetMatch = /^\/runs\/[^/]+\/routes\/([^/]+)\/upset$/u.exec(path);
    if (upsetMatch) {
      upset[upsetMatch[1]!] = !!call.body!.upset;
      return { status: 200, json: { upset: !!call.body!.upset, writing: !!call.body!.upset } };
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
              {
                cheat: "nudge",
                style: "",
                rupture: li === KAI,
                held: li === KAI,
                lines: { claw: null, cold: [] },
              },
            ]),
          ),
        },
      };
    }
    if (path === `${base}/phone`) {
      return {
        status: 200,
        json: {
          threads: [
            { li: KAI, last: null, unread: 0, busy: false },
            { li: MIR, last: messages.at(-1), unread: 1, busy: false },
          ],
        },
      };
    }
    if (path === `${base}/phone/due`) return { status: 200, json: { status: "disabled", latest: null } };
    const phone = /^\/runs\/[^/]+\/phone\/([^/]+)(?:\/(seen|invite))?$/u.exec(path);
    if (phone) {
      const [li, action] = [phone[1]!, phone[2]];
      if (!action) {
        const shown = li === MIR ? messages : [];
        return {
          status: 200,
          json: {
            messages: shown,
            page: 1,
            pages: 1,
            from: 0,
            past: 0,
            activeCount: shown.length,
            busy: false,
            retry: false,
            sessions: [],
            seenAt: null,
          },
        };
      }
      if (action === "seen") return { status: 200, json: {} };
      const accept = !!call.body!.accept;
      messages[1]!.invite = { status: accept ? "accepted" : "declined" };
      if (!accept) return { status: 200, json: { status: "declined" } };
      asked = true;
      messages[1]!.invite.scene = SCENE;
      return { status: 200, json: { status: "accepted", scene: SCENE } };
    }
    // The Album (empty but for its Dates tab) and the date won from Wish; planning one is refused here, as only its
    // body is under test.
    if (path === `${base}/album`) {
      return {
        status: 200,
        json: {
          cgs: [],
          memories: [],
          timeline: [],
          favorites: [],
          soundtrack: [],
          tells: {},
          stickers: [],
          photos: [],
          cards: [],
        },
      };
    }
    // #2302: an earlier Date Night evening with Mireille, read to its end and not counted yet ("done"); counting it
    // (its finish) makes it "finished". Its keepsake is offered, and this story has no image connection.
    const evening = () => ({
      key: "date-1",
      li: MIR,
      title: "Lanterns on the Canal",
      place: "fairground",
      // As long as the maintainer's own (0.33.3): the card must still give the text its width.
      placeName: "The Ninth's private box at the capital's opera house, on a closed dress-rehearsal night",
      makeItRight: false,
      state: eveningCounted ? "finished" : "done",
      outcome: eveningCounted ? "good" : null,
      plannedAt: now(),
      completedAt: now(),
      keepsake: null,
    });
    if (path === `${base}/dates` && call.method === "GET") {
      return {
        status: 200,
        json: {
          dates: eveningCounted ? [evening()] : [],
          open: eveningCounted ? [] : [evening()],
          pulled: [
            { item: { ...WON_DATE, art: placeArt }, plays: [], playedBy: [] },
            { item: LONG_DATE, plays: [], playedBy: [] },
          ],
        },
      };
    }
    if (path === `${base}/dates/date-1/finish`) {
      const counted = !eveningCounted;
      eveningCounted = true;
      return {
        status: 200,
        json: {
          date: evening(),
          outcome: "good",
          picks: [],
          line: "",
          grants: counted ? [{ source: "date", starlight: 120 }] : [],
          starlight: 2000,
          counted,
          repaired: false,
          mends: false,
          keepsake: { offer: true },
        },
      };
    }
    // The first open marks the place pending and answers once released; its paint lands on a later read.
    if (images && path === `${base}/items/${WON_DATE.id}/open`) {
      // With Ask before painting the open only holds the paint for the next tap (S/art/outfits.ts queueItemArt).
      placeArt = ask ? { state: "waiting-consent" } : { state: "pending", startedAt: now() };
      return openHeld.then(() => ({ status: 200, json: { item: { ...WON_DATE, art: placeArt } } }));
    }
    if (path === `${base}/art/keepsake`) {
      return { status: 503, json: { error: "This world has no image connection.", code: "no-connection" } };
    }
    if (path === `${base}/dates/pulled`) {
      return { status: 503, json: { error: "No connection.", code: "no-connection" } };
    }
    // The scene her acceptance registered (S/items/character-story.ts clearAirStoryChapter), saved under its English
    // title and written on its first read.
    if (asked && path === `${base}/chapters/${SCENE}`) {
      const chapter = {
        key: SCENE,
        kind: "story",
        li: MIR,
        lead: MIR,
        title: "Clearing the Air with Mireille",
        tags: [],
        summary: "",
        nodes: [{ i: 0, kind: "beat" }],
        plannedAt: now(),
      };
      return { status: 200, json: { chapter, beats: [{ i: 0, state: "unwritten" }] } };
    }
    if (asked && path === `${base}/chapters/${SCENE}/beats/0`) {
      return {
        status: 200,
        json: {
          beat: {
            key: SCENE,
            i: 0,
            kind: "beat",
            places: [],
            segments: [
              { speaker: "", text: "The café is nearly empty." },
              { speaker: "Mireille", text: "I'm sorry about the other night." },
            ],
            choices: [],
            choiceCanon: {},
            musicMood: "tender",
            readThrough: 0,
            written: { at: now(), connectionId: "conn-text", model: "fixture" },
          },
        },
      };
    }
    if (path === `${base}/wardrobe`) {
      return {
        status: 200,
        json: {
          him: { [KAI]: [look(KAI)], [MIR]: [look(MIR)] },
          me: [look("me")],
          couples: [],
          noticed: null,
          noticing: false,
        },
      };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  const paintLands = () => {
    placeArt = { state: "done", image: "/api/gallery/place-aquarium.webp" };
  };
  return { calls, answer, upset, releaseOpen, paintLands };
}

type Stub = ReturnType<typeof createStub>;

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
}

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

const dock = (root: Locator, name: string) =>
  root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name, exact: true });
const posts = (stub: Stub, suffix: string) =>
  stub.calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix));
const fields = (call: Call) => {
  const { timeZone: _timeZone, debugMode: _debugMode, ...rest } = call.body!;
  return rest;
};
const noWider = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const tallEnough = async (target: Locator) => expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);

test("Otome Hearth grievances: his space, paused affection and waiting dates; I'm upset, asked first and taken back", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());

  // His grievance: the banner says how much space he still needs, and Make it right waits for it.
  await press(dock(root, "Story"));
  await expect(root.getByRole("heading", { level: 1, name: "Story" })).toBeFocused();
  const banner = root.locator(".of-rupture");
  await expect(banner.getByRole("heading", { name: "Kai Ardent is keeping their distance" })).toBeVisible();
  await expect(banner).toContainText("Until you make it right, Kai Ardent won’t lead a chapter");
  await expect(banner).toContainText("Making it right with Kai Ardent brings +300 affection.");
  const meter = banner.getByRole("progressbar", {
    name: "Give them space first: 1 more story chapter before you can make it right",
  });
  await expect(meter).toHaveAttribute("aria-valuenow", "1");
  await expect(meter).toHaveAttribute("aria-valuemax", "2");
  await expect(root.getByRole("button", { name: /Make it right/u })).toHaveCount(0);
  const kaiRoute = root.locator(".of-route").filter({ has: page.getByRole("heading", { name: "Kai Ardent" }) });
  await expect(kaiRoute).toContainText("Give them space first: 1 more story chapter");
  // His affection is paused; hers is not.
  await expect(root.locator(".of-affection-paused")).toHaveCount(1);
  await expect(root.locator(".of-affection").filter({ hasText: "Kai Ardent" })).toContainText(
    "Paused until you make it right",
  );
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("01-story.png"), fullPage: true });

  // The Lead dialog offers Mireille alone and says why Kai Ardent isn't there.
  await press(root.getByRole("button", { name: "Choose who leads" }));
  const lead = page.getByRole("dialog", { name: "Who walks with you this chapter?" });
  await expect(lead.locator(".of-candidate")).toHaveCount(1);
  await expect(lead.locator(".of-candidate")).toContainText("Mireille");
  await expect(lead).toContainText("Kai Ardent is keeping their distance and can’t lead until you make it right.");
  await page.screenshot({ path: testInfo.outputPath("02-lead.png") });
  await press(lead.getByRole("button", { name: "Not now" }));
  await expect(lead).toHaveCount(0);

  // I'm upset with her, beside her route at stage 6: asked first, and Escape sends nothing.
  const mirRoute = root.locator(".of-route").filter({ has: page.getByRole("heading", { name: "Mireille" }) });
  // Past her finale at level 10 the route goes on in the bond ranks: the card names rank 11, never "complete" (0.24.5).
  await expect(mirRoute).toContainText("Affection 11 · named, her next bond story");
  await expect(mirRoute).toContainText("Next: named");
  await expect(mirRoute).not.toContainText("route is complete");
  const toggle = mirRoute.getByRole("button", { name: "I’m upset with her" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await tallEnough(toggle);
  await toggle.scrollIntoViewIfNeeded();
  await press(toggle);
  const ask = page.getByRole("dialog", { name: "Tell Mireille you’re upset?" });
  await expect(ask).toBeVisible();
  await expect(ask).toContainText("Mireille answers in Messages · 1 model call");
  await page.screenshot({ path: testInfo.outputPath("03-ask.png") });
  await page.keyboard.press("Escape");
  await expect(ask).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(posts(stub, "/upset")).toHaveLength(0);
  // Told: pressed, and said; then taken back at once with no dialog.
  await press(toggle);
  await press(ask.getByRole("button", { name: "Tell her" }));
  await expect(ask).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(mirRoute).toContainText("Mireille knows you’re upset. Tap again to let it go.");
  await expect(mirRoute.getByRole("status")).toHaveText("You told Mireille you’re upset.");
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("04-upset.png"), fullPage: true });
  await press(toggle);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(mirRoute.getByRole("status")).toHaveText("You let it go.");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(posts(stub, "/upset").map(fields)).toEqual([{ upset: true }, { upset: false }]);
  expect(posts(stub, "/upset").map((call) => call.path)).toEqual([
    `/api/otome-forge/runs/${RUN}/routes/${MIR}/upset`,
    `/api/otome-forge/runs/${RUN}/routes/${MIR}/upset`,
  ]);

  // Dates: every activity with him waits, and says why; with her, Play is back.
  await press(dock(root, "Dates"));
  await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
  await expect(root.locator(".of-notice").filter({ hasText: "Kai Ardent needs space." })).toBeVisible();
  const activities = root.getByRole("list", { name: "Things to do with Kai Ardent" });
  await expect(activities.locator(".of-activity")).toHaveCount(6);
  await expect(activities.locator(".of-badge", { hasText: "Kai Ardent needs space" })).toHaveCount(6);
  await expect(activities.getByRole("button", { name: /^Play:/u })).toHaveCount(0);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("05-dates.png"), fullPage: true });
  await press(root.locator(".of-partner").filter({ hasText: "Mireille" }));
  await expect(root.getByRole("button", { name: "Play: Read Mireille" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth grievances: his invitation to clear the air, accepted in Messages, opens its scene in the reader", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "dark" : "light", reducedMotion: "reduce" });
  const stub = createStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());

  await press(root.locator(".of-home-rail").getByRole("button", { name: /Messages/u }));
  await expect(root.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
  await press(root.locator(".of-threads").getByRole("button", { name: /Mireille/u }));
  await expect(root.getByRole("heading", { level: 1, name: "Mireille" })).toBeFocused();
  const invite = root.getByRole("group", { name: "Mireille’s invitation" });
  await expect(invite).toContainText("Mireille asked you out to clear the air.");
  const accept = invite.getByRole("button", { name: "Accept" });
  const decline = invite.getByRole("button", { name: "Decline" });
  await tallEnough(accept);
  await tallEnough(decline);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("01-invite.png") });

  // Accept: the scene that clears the air with her opens in the reader, titled in the player's language.
  await press(accept);
  expect(posts(stub, "/invite").map(fields)).toEqual([{ message: INVITE, accept: true }]);
  await expect(root.getByRole("heading", { level: 1, name: /Clearing the Air with Mireille/u })).toBeVisible();
  await expect(root.getByText("Character story").first()).toBeVisible();
  await expect(root.locator(".of-dialogue .of-line")).toContainText("The café is nearly empty.");
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("02-scene.png") });
  // Leaving goes back to Messages: the thread keeps what she said, and the accepted invitation opens the scene again.
  await press(root.getByRole("button", { name: "Leave the chapter" }));
  const thread = root.locator(".of-threads").getByRole("button", { name: /Mireille/u });
  if (await thread.isVisible()) await press(thread);
  const accepted = root.getByRole("group", { name: "Mireille’s invitation" });
  await expect(accepted).toContainText("You said yes. Clearing the air with Mireille waits as a scene.");
  await expect(accepted.getByRole("button")).toHaveCount(1);
  await press(accepted.getByRole("button", { name: "Clear the air with Mireille" }));
  await expect(root.getByRole("heading", { level: 1, name: /Clearing the Air with Mireille/u })).toBeVisible();
  expect(posts(stub, "/invite")).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth grievances: one picked for a date before his grievance shows is left out of it, never sent", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  // GET /play (who is held) answers only once both are picked: the date screen opens on the dates alone.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === `/api/otome-forge/runs/${RUN}/play`,
    async (route) => {
      await held;
      await route.fallback();
    },
  );
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());

  await press(dock(root, "Album"));
  await press(root.getByRole("tablist", { name: "Album" }).getByRole("tab", { name: "Dates", exact: true }));
  await press(root.getByRole("button", { name: "Plan a date: An Evening at the Aquarium" }));
  await expect(root.getByRole("heading", { level: 1, name: "Who's coming?" })).toBeFocused();
  const kai = root.getByRole("checkbox", { name: /Kai Ardent/u });
  const mireille = root.getByRole("checkbox", { name: /Mireille/u });
  await press(root.locator(".of-partner").filter({ hasText: "Kai Ardent" }));
  await expect(kai).toBeChecked();
  await press(root.getByRole("button", { name: "Next: what you wear" }));
  await expect(root.getByRole("heading", { level: 1, name: "What will you wear?" })).toBeFocused();

  // His grievance shows on the looks step: nobody is left coming, so Begin waits and says why, and nothing is sent.
  release();
  const begin = root.getByRole("button", { name: "Begin the date" });
  await expect(begin).toHaveAttribute("aria-disabled", "true");
  await expect(root.getByRole("status").filter({ hasText: "Choose who's coming." })).toBeVisible();
  // Forced, since Playwright never presses a button marked disabled; the player still can.
  await (mobile ? begin.tap({ force: true }) : begin.click({ force: true }));
  await page.waitForTimeout(300);
  expect(posts(stub, "/dates/pulled")).toHaveLength(0);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("01-looks-empty.png") });

  // Back on who's coming he is unticked, with his box saying why instead of holding him in.
  await press(root.getByRole("button", { name: "Who's coming" }));
  await expect(kai).not.toBeChecked();
  await expect(kai).toBeDisabled();
  await expect(root.locator(".of-partner").filter({ hasText: "Kai Ardent" })).toContainText("Needs space");
  await press(root.locator(".of-partner").filter({ hasText: "Mireille" }));
  await expect(mireille).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("02-company.png") });
  await press(root.getByRole("button", { name: "Next: what you wear" }));
  await expect(root.getByRole("heading", { level: 1, name: "What will you wear?" })).toBeFocused();
  await press(begin);
  await expect.poll(() => posts(stub, "/dates/pulled").length).toBe(1);
  expect(posts(stub, "/dates/pulled")[0]!.body).toMatchObject({ item: WON_DATE.id, cast: [MIR] });
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth #2302: an earlier evening opened at its ending comes back there after Settings → Images", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());

  // The Album's earlier evening, read to its end: Continue opens it at its ending, which counts it.
  await press(dock(root, "Album"));
  await press(root.getByRole("tablist", { name: "Album" }).getByRole("tab", { name: "Dates", exact: true }));
  await press(root.getByRole("button", { name: "Continue: Lanterns on the Canal" }));
  const keepsake = root.locator(".of-date-keepsake");
  await expect(keepsake.getByRole("button", { name: "Paint the keepsake" })).toBeVisible();
  const heading = await root.getByRole("heading", { level: 1 }).textContent();

  // Its keepsake can't paint here: the way to Settings → Images, and back to the same ending, not the scenes.
  await press(keepsake.getByRole("button", { name: "Paint the keepsake" }));
  await expect(keepsake.getByRole("alert")).toBeVisible();
  await press(keepsake.getByRole("button", { name: "Change the image connection" }));
  await expect(root.getByRole("tab", { name: "Images", exact: true })).toHaveAttribute("aria-selected", "true");
  await noWider(page);
  await press(root.getByRole("button", { name: "Back", exact: true }));
  await expect(root.getByRole("heading", { level: 1 })).toHaveText(heading!);
  await expect(root.locator(".of-date-keepsake").getByRole("button", { name: "Paint the keepsake" })).toBeVisible();
  expect(stub.calls.filter((call) => call.path.endsWith("/chapters/date-1"))).toHaveLength(0);
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth 0.33.3: Album → Dates cards give their text the full width, with their buttons in a row below", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const stub = createStub();
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());
  await press(dock(root, "Album"));
  await press(root.getByRole("tablist", { name: "Album" }).getByRole("tab", { name: "Dates", exact: true }));
  const cards = root.locator(".of-album-date");
  // Two won dates (one titled with a single word wider than the card) and the earlier evening.
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    const box = (await card.boundingBox())!;
    const text = (await card.locator(".of-date-memory-text").boundingBox())!;
    const row = (await card.locator(".of-album-date-actions").boundingBox())!;
    // Nothing in the card, a long unbroken title included, is wider than the card or scrolls inside it.
    expect(text.x + text.width).toBeLessThanOrEqual(box.x + box.width + 1);
    expect(await card.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    // The text is never squeezed beside the buttons: it takes most of the card, and the buttons come after it.
    expect(text.width).toBeGreaterThan(box.width * 0.6);
    expect(row.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
    for (const button of await card.getByRole("button").all()) {
      const each = (await button.boundingBox())!;
      expect(each.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
      expect(each.x + each.width).toBeLessThanOrEqual(box.x + box.width + 1);
    }
  }
  await noWider(page);
  await cards.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("album-dates.png"), fullPage: true });
});

test("Otome Hearth grievances: declining his invitation keeps focus on it and says so", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());

  await press(root.locator(".of-home-rail").getByRole("button", { name: /Messages/u }));
  await press(root.locator(".of-threads").getByRole("button", { name: /Mireille/u }));
  const invite = root.getByRole("group", { name: "Mireille’s invitation" });
  const decline = invite.getByRole("button", { name: "Decline" });
  // From the keyboard on desktop, by touch on the phone: the buttons go, and focus stays on the invitation.
  if (mobile) await decline.tap();
  else {
    await decline.focus();
    await page.keyboard.press("Enter");
  }
  await expect(invite.getByRole("status")).toHaveText("You said no.");
  await expect(invite).toBeFocused();
  await expect(invite.getByRole("button")).toHaveCount(0);
  expect(posts(stub, "/invite").map(fields)).toEqual([{ message: INVITE, accept: false }]);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("01-declined.png") });
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth 0.34.8: a date's Take them along card holds its icon and title inside, beside each other", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await stubRoutes(page, createStub());
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());
  await press(dock(root, "Album"));
  await press(root.getByRole("tablist", { name: "Album" }).getByRole("tab", { name: "Dates", exact: true }));
  await press(root.getByRole("button", { name: "Plan a date: An Evening at the Aquarium" }));
  await expect(root.getByRole("heading", { level: 1, name: "Who's coming?" })).toBeFocused();
  // A group with a heading, not a fieldset whose legend Safari left on the card's top border (0.34.8).
  const company = root.getByRole("group", { name: "Take them along" });
  const title = company.getByRole("heading", { level: 2, name: "Take them along" });
  await expect(title).toBeVisible();
  const [card, heading, icon] = await Promise.all([
    company.boundingBox(),
    title.boundingBox(),
    title.locator("svg").boundingBox(),
  ]);
  // Inside the card's padding, not across its top edge.
  expect(heading!.y).toBeGreaterThanOrEqual(card!.y + 10);
  // The icon sits beside the words, centred on them, not on a line above.
  expect(Math.abs(icon!.y + icon!.height / 2 - (heading!.y + heading!.height / 2))).toBeLessThan(4);
  expect(icon!.x + icon!.width).toBeLessThanOrEqual(heading!.x + heading!.width);
  await page.screenshot({ path: testInfo.outputPath("date-take-them-along.png") });
});

test("Otome Hearth 0.34.8: the Story home's arc line is centred and never splits its chapter count", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  // The maintainer's own arc: its label and "chapter 3 of 5" wrapped as "... CHAPTER 3 OF" / "5" on an iPhone.
  const arc = {
    number: 6,
    kind: "breathing",
    label: "Days With Nothing Owed",
    from: 52,
    endsAt: 56,
    read: 2,
    done: false,
  };
  await stubRoutes(page, createStub({ arc }));
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());
  await press(dock(root, "Story"));
  const line = root.locator(".of-story-arc");
  await expect(line).toContainText("chapter 3 of 5");
  await expect(line).toHaveCSS("text-align", "center");
  // The count's words are joined by no-break spaces, so "chapter 3 of 5" always shares one line.
  const split = await line.evaluate((element) => {
    const text = element.firstChild as Text;
    const at = text.data.search(/chapter\s3\sof\s5/u);
    const range = document.createRange();
    range.setStart(text, at);
    range.setEnd(text, at + "chapter 3 of 5".length);
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
  });
  expect(split).toBe(1);
  // Centred under the page head: the space on each side of its widest line is about the same.
  const [box, page2] = await Promise.all([line.boundingBox(), root.locator(".of-page-head").boundingBox()]);
  const lines = await line.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right }));
  });
  const widest = lines.reduce((a, b) => (b.right - b.left > a.right - a.left ? b : a));
  expect(Math.abs(widest.left - box!.x - (box!.x + box!.width - widest.right))).toBeLessThan(12);
  expect(page2).not.toBeNull();
  await line.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("story-arc-line.png") });
});

test("Otome Hearth 0.34.8: Album → Dates Paint it shows painting at once and the picture when it lands", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const stub = createStub({ images: true });
  await stubRoutes(page, stub);
  await page.route("**/api/gallery/place-aquarium.webp", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());
  await press(dock(root, "Album"));
  await press(root.getByRole("tablist", { name: "Album" }).getByRole("tab", { name: "Dates", exact: true }));
  const card = root.locator(".of-album-date").filter({ hasText: "An Evening at the Aquarium" });
  const paint = card.getByRole("button", { name: "Paint the place of An Evening at the Aquarium" });
  await press(paint);
  // Painting from the tap on, while the open still waits.
  await expect(card.getByRole("status")).toHaveText("Painting…");
  // Once the open answers, the dates are read again: still painting, and Paint it does not come back.
  stub.releaseOpen();
  await expect(paint).toHaveCount(0);
  await expect(card.getByRole("status")).toHaveText("Painting…");
  // The picture lands on a later read, with no leaving the screen.
  stub.paintLands();
  await expect(card.getByRole("status")).toHaveCount(0, { timeout: 15_000 });
  await expect(paint).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("album-date-painted.png") });
});

test("Otome Hearth 0.34.8: with Ask before painting, a date's first Paint it holds the paint and never says painting", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const stub = createStub({ images: true, ask: true });
  await stubRoutes(page, stub);
  const root = await openOtome(page);
  const press = (target: Locator) => (mobile ? target.tap() : target.click());
  await press(dock(root, "Album"));
  await press(root.getByRole("tablist", { name: "Album" }).getByRole("tab", { name: "Dates", exact: true }));
  const card = root.locator(".of-album-date").filter({ hasText: "An Evening at the Aquarium" });
  const paint = card.getByRole("button", { name: "Paint the place of An Evening at the Aquarium" });
  await press(paint);
  // The open only holds the paint (Dottore, #2349): no Painting… while it waits, or after.
  await expect(paint).toHaveAttribute("aria-disabled", "true");
  await expect(card.getByText("Painting…")).toHaveCount(0);
  stub.releaseOpen();
  await expect(paint).toHaveAttribute("aria-disabled", "false");
  await expect(card.getByText("Painting…")).toHaveCount(0);
});
