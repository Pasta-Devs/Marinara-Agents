// Otome Hearth's grievances (#2156) in the Engine's Home tab, with /api/otome-forge/** stubbed by the server's rules.
// His grievance: the Story screen's banner and his route say how much space he still needs, with no Make it right
// until he has had it; his affection shows as paused; the Lead dialog says why he can't lead; every activity with him
// in Dates shows that he needs space, with no Play. Her grievance: "I'm upset with her" beside each route (also at
// stage 6) is a toggle (aria-pressed) that asks first (a dialog, Escape closes it and sends nothing) and is taken back
// at once; his invitation in Messages offers Accept and Decline, and Accept opens Date Night on what you wear, with his
// choice of place picked. Each test runs at phone width (mobile-chromium, 390×844, touch) and on the desktop
// (desktop-chromium, mouse), with no horizontal scroll.
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

function createStub() {
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
      places: {},
      content: { heat: "sfw", darkness: "angst", limits: {}, custom: [] },
      images: { connectionId: null, rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
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

  const answer = (call: Call): { status: number; json: unknown } => {
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
          arc: null,
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
                makeItRight: li === KAI,
                held: li === KAI,
                asked: li === MIR && asked,
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
      if (accept) asked = true;
      return { status: 200, json: { status: messages[1]!.invite.status } };
    }
    if (path === `${base}/dates` && call.method === "GET") {
      return {
        status: 200,
        json: {
          lis: [KAI, MIR].map((li) => ({ li, rupture: li === KAI, open: null, asked: li === MIR && asked })),
          dates: [],
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
  return { calls, answer, upset };
}

type Stub = ReturnType<typeof createStub>;

async function stubRoutes(page: Page, stub: Stub) {
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { status, json } = stub.answer({
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
  await expect(activities.locator('.of-activity[data-activity="date-night"]')).not.toContainText("Make it right");
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("05-dates.png"), fullPage: true });
  await press(root.locator(".of-partner").filter({ hasText: "Mireille" }));
  await expect(root.getByRole("button", { name: "Play: Read Mireille" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth grievances: his invitation to clear the air, accepted in Messages, opens Date Night on what you wear", async ({
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

  // Accept: Date Night with her, on what you wear, her choice of place picked.
  await press(accept);
  await expect(root.getByRole("heading", { level: 1, name: "What will you wear?" })).toBeFocused();
  expect(posts(stub, "/invite").map(fields)).toEqual([{ message: INVITE, accept: true }]);
  await expect(root.locator(".of-date-summary")).toContainText("Wherever Mireille takes you");
  await expect(root.locator(".of-date-summary")).toContainText("Mireille asked you out tonight to clear the air.");
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("02-looks.png"), fullPage: true });
  // Back reaches the places, with hers picked.
  await press(root.getByRole("button", { name: "Change the place" }));
  await expect(root.getByRole("heading", { level: 1, name: "Where to tonight?" })).toBeFocused();
  await expect(root.getByRole("radio", { name: /Let Mireille choose/u })).toBeChecked();
  await noWider(page);
  // The thread keeps what she said.
  await press(root.getByRole("button", { name: /^Home with/u }));
  await press(root.locator(".of-home-rail").getByRole("button", { name: /Messages/u }));
  await press(root.locator(".of-threads").getByRole("button", { name: /Mireille/u }));
  await expect(root.getByRole("group", { name: "Mireille’s invitation" })).toContainText(
    "You said yes. Date Night with Mireille waits in Dates.",
  );
  await expect(root.getByRole("group", { name: "Mireille’s invitation" }).getByRole("button")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
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
