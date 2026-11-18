// Otome Hearth's Kitty Cards (0.35.0) in the Engine's Home tab, with /api/otome-forge/** stubbed and the package's own
// card art served by the Engine. Each game is dealt from a seed the test picks (the page's next 32-bit random number),
// and played by one rule on her side (her card and cup that score most, else a draw), so the test plays the same game
// in Node with the shared rules (SH/kitty.ts) and knows every move, his cheat moment and the final score before the
// page shows them. Desktop and phone (the two projects) each play: from the Dates hub, a whole game with his nudge
// caught by Gotcha!, a lost answer retried with the same game and paid once; then a freeze, an extra, a calculate and a
// steady moment, one game each, every one sent in the finish; with images on, the painted kittens on the value-5
// cards and Paint our kittens, the tap that pays for one held by Ask before painting; and at phone width, her hand
// drawn up to 10 cards stays inside the page, and one paint failure shared by every kitten shows once. 0.36.0: the
// intro's "How Kai Ardent plays" says what his cheat does in Kitty Cards, never his bible's Claw Machine sentence.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-kitty.e2e.ts
import { expect, test, type Locator, type Page } from "./fixtures/package-browser.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyMove,
  cheatCaught,
  cheatDue,
  cupPoints,
  deal,
  endCheat,
  isOver,
  partnerMove,
  score,
  sneakCard,
  swapCups,
  takeBack,
  tradeCards,
  tradeOffer,
  turnSeed,
  type KittyCard,
  type KittyCheat,
  type KittyGame,
  type KittyMove,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/kitty";
import type { ClawCheat } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const packageVersion = JSON.parse(readFileSync(resolve("packages/otome-forge/manifest.json"), "utf8")).version;
/** The intro's "How Kai Ardent plays" for each cheat (0.36.0). */
const STYLE: Record<ClawCheat, string> = {
  nudge: "Kai Ardent might swap two cups while you look away. Tap Gotcha! in time to catch it.",
  freeze:
    "Kai Ardent might doze off mid-game. Swap the kittens of two filled cups before Kai Ardent wakes, and hope it goes unnoticed.",
  extra: "Kai Ardent might look away so you can sneak an extra card. Hold Sneak a card before Kai Ardent turns back.",
  calculate: "Kai Ardent might offer to trade one card from each hand, face down. Take the trade or keep your cards.",
  steady: "Kai Ardent might let you take back the card you just played and play again.",
};
/** His bible's `play.style`, which is how he plays the Claw Machine. */
const CLAW_STYLE = "Plays to an audience, all flourish and a wink.";

type Json = Record<string, any>;
interface Call {
  method: string;
  path: string;
  body: Json | undefined;
}

const RUN = "r-e2e-kitty1";
const KAI = "li-kai-0001";
const MIR = "li-mireille-0002";
const FILE = "/api/global-gallery/file";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
/** His own Kitty Cards lines (GET /play's `lines.kitty`, his fixed pack). */
const KAI_KITTY = {
  start: ["Deal me in. Gently."],
  good: ["Right cup, right kitten."],
  cheat: ["Look, a bird over there."],
  caught: ["Fine. Fair is fair."],
  win: ["You win this one. Rematch later."],
  lose: ["My game this time."],
};
const KITTEN = (owner: string) => `${FILE}/kitten-${owner}.png`;

// ── The game in Node: the same rules, her side by one rule ──

/** Her move here: her card and cup that score most (the first such, in hand and cup order), else a draw. */
function herMove(game: KittyGame): KittyMove {
  let best: { card: KittyCard; cup: number; points: number } | null = null;
  for (const card of game.hands.me) {
    game.cups.forEach((cup, index) => {
      if (cup.played) return;
      const points = cupPoints(card, cup.colour);
      if (!best || points > best.points) best = { card, cup: index, points };
    });
  }
  const pick = best as { card: KittyCard; cup: number; points: number } | null;
  if (pick && (pick.points > 0 || !game.pile.length)) return { kind: "play", card: pick.card, cup: pick.cup };
  return { kind: "draw" };
}

/** Her swap while he dozes: the first two filled cups whose kittens swapped gain her the most. */
function herSwap(game: KittyGame): [number, number] {
  const lead = (by: string, card: KittyCard, colour: KittyGame["cups"][number]["colour"]) =>
    (by === "me" ? 1 : -1) * cupPoints(card, colour);
  let best: [number, number] | null = null;
  let gain = -Infinity;
  game.cups.forEach((a, i) =>
    game.cups.forEach((b, j) => {
      if (j <= i || !a.played || !b.played) return;
      const change =
        lead(a.played.by, a.played.card, b.colour) +
        lead(b.played.by, b.played.card, a.colour) -
        lead(a.played.by, a.played.card, a.colour) -
        lead(b.played.by, b.played.card, b.colour);
      if (change > gain) [best, gain] = [[i, j], change];
    }),
  );
  return best!;
}

type Event = { who: "me"; move: KittyMove; moves: number } | { who: "moment"; moves: number; swap?: [number, number] };
interface Plan {
  seed: number;
  events: Event[];
  game: KittyGame;
  cheat: KittyCheat | null;
}

/**
 * The game dealt from `seed` as the page plays it: her moves by herMove, his by partnerMove, and his moment answered
 * by `answer` (Gotcha! for a nudge, a swap while he dozes, a held Sneak a card, Trade, Take it back).
 */
function playInNode(seed: number, first: "me" | "partner", cheat: ClawCheat): Plan {
  const events: Event[] = [];
  let game = deal(seed, first);
  let record: KittyCheat | null = null;
  while (!isOver(game)) {
    if (game.turn === "partner" && cheatDue(game, cheat)) {
      game = endCheat(game);
      const event: Event = { who: "moment", moves: game.moves };
      events.push(event);
      if (cheat === "nudge") {
        // Swapped, then swapped back by Gotcha!.
        record = { kind: "nudge", caught: true };
      } else if (cheat === "freeze") {
        const swap = herSwap(game);
        event.swap = swap;
        game = swapCups(game, ...swap);
        const caught = cheatCaught(game);
        if (caught) game = swapCups(game, ...swap);
        record = { kind: "freeze", caught };
      } else if (cheat === "extra") {
        const caught = cheatCaught(game);
        if (!caught) game = sneakCard(game);
        record = { kind: "extra", caught };
      } else if (cheat === "calculate") {
        game = tradeCards(game, tradeOffer(game));
        record = { kind: "calculate", caught: false };
      } else {
        game = takeBack(game);
        record = { kind: "steady", caught: false };
      }
      continue;
    }
    if (game.turn === "partner") {
      game = applyMove(game, partnerMove(game, turnSeed(game)));
    } else {
      const move = herMove(game);
      events.push({ who: "me", move, moves: game.moves });
      game = applyMove(game, move);
    }
  }
  return { seed, events, game, cheat: record };
}

/** The first seed whose game has his moment, and passes `also`. */
function seedFor(first: "me" | "partner", cheat: ClawCheat, also: (plan: Plan) => boolean = () => true): Plan {
  for (let seed = 1; seed < 20_000; seed += 1) {
    const plan = playInNode(seed, first, cheat);
    if (plan.cheat && also(plan)) return plan;
  }
  throw new Error(`No seed gives a ${cheat} moment`);
}

// ── The stub ──

function createKittyStub({ images = false, finishFailures = 0, paintFails = false } = {}) {
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
      images: { connectionId: images ? "conn-image" : null, rating: "sfw", ask: images, expressions: false },
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
      { id: KAI, name: "Kai Ardent", pronouns: they, source: "archetype", accent: "#9DB8F0", level: 2, stage: 1 },
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
  const state = {
    cheat: "nudge" as ClawCheat,
    kitty: KAI_KITTY as Json | undefined,
    // With images on: hers and his painted, Mireille's held for a tap (Ask before painting).
    kittens: { player: KITTEN("player"), [KAI]: KITTEN(KAI) } as Record<string, string>,
  };
  const paid = new Map<string, Json>();
  const earned = { starlight: 0, affection: {} as Record<string, number> };
  let failuresLeft = finishFailures;

  const answer = (call: Call): { status: number; json: unknown } => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (path === base) return { status: 200, json: { view: structuredClone(view) } };
    if (path === `${base}/home`) {
      return { status: 200, json: { li: KAI, show: "him", note: null, look: null, faces: {}, lines: { ready: true } } };
    }
    if (path === `${base}/play`) {
      return {
        status: 200,
        json: {
          dayKey: now().slice(0, 10),
          starlight: { earned: earned.starlight, cap: 400 },
          affection: { earned: { ...earned.affection }, cap: 150 },
          plush: {},
          lis: {
            [KAI]: {
              cheat: state.cheat,
              style: CLAW_STYLE,
              rupture: false,
              lines: { claw: null, cold: [], ...(state.kitty ? { kitty: state.kitty } : {}) },
            },
            [MIR]: { cheat: "calculate", style: "", rupture: false, lines: { claw: null, cold: [] } },
          },
          ...(images
            ? {
                kittens: ["player", KAI, MIR].map((owner) =>
                  state.kittens[owner]
                    ? { owner, url: state.kittens[owner] }
                    : { owner, art: { state: "waiting-consent", at: now() } },
                ),
              }
            : {}),
        },
      };
    }
    if (path === `${base}/art/kitten`) {
      if (paintFails) return { status: 503, json: { error: "No image connection.", code: "no-connection" } };
      const owner = call.body!.owner as string;
      state.kittens[owner] = KITTEN(owner);
      return { status: 200, json: { art: { state: "ready", url: KITTEN(owner), at: now() } } };
    }
    if (path === `${base}/kitty/finish`) {
      const body = call.body!;
      if (!/^k-[0-9a-z]{1,12}-[0-9a-z]{6}$/u.test(body.round)) return { status: 400, json: { code: "bad-request" } };
      const result = body.me > body.partner ? "win" : body.me < body.partner ? "lose" : "draw";
      if (body.result !== result) return { status: 400, json: { code: "bad-request" } };
      const kept = paid.get(body.round);
      if (kept) return { status: 200, json: { ...kept, replay: true } };
      const starlight = 20 + (result === "win" ? 20 : 0);
      view.starlight += starlight;
      earned.starlight += starlight;
      earned.affection[body.li] = (earned.affection[body.li] ?? 0) + 30;
      const answered = {
        grants: [
          { source: "kitty", starlight },
          { source: "kitty", li: body.li, affection: 30 },
        ],
        capped: false,
        replay: false,
        starlight: view.starlight,
      };
      paid.set(body.round, answered);
      if (failuresLeft > 0) {
        // Paid, but the answer was lost on the way back.
        failuresLeft -= 1;
        return { status: 503, json: { error: "The answer was lost.", code: "no-connection" } };
      }
      return { status: 200, json: answered };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer, view, state };
}

type Stub = ReturnType<typeof createKittyStub>;

async function openOtome(page: Page, stub: Stub): Promise<Locator> {
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const { status, json } = stub.answer({
      method: request.method(),
      path: new URL(request.url()).pathname,
      body: request.method() === "POST" ? request.postDataJSON() : undefined,
    });
    await route.fulfill({ status, json });
  });
  await page.route(`**${FILE}/**`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
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
    // The next game's seed: the page's next 32-bit random number, once the test sets one.
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (<T extends ArrayBufferView | null>(array: T): T => {
      const seed = (window as { __kittySeed?: number }).__kittySeed;
      if (seed !== undefined && array instanceof Uint32Array && array.length === 1) {
        delete (window as { __kittySeed?: number }).__kittySeed;
        array[0] = seed;
        return array;
      }
      return random(array);
    }) as typeof crypto.getRandomValues;
  }, appVersion);
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Otome Hearth" }).click();
  const root = page.locator("marinara-capability-otome-forge .of-root");
  await expect(root).toBeVisible({ timeout: 60_000 });
  await expect(root.getByRole("heading", { level: 1, name: "Kai Ardent" })).toBeVisible();
  return root;
}

/** Notes every line and announcement the game shows from now on (his turns are short). */
async function recordKitty(page: Page) {
  await page.evaluate(() => {
    const seen = ((window as unknown as { __kittySeen?: Set<string> }).__kittySeen ??= new Set<string>());
    const note = () => {
      for (const element of document.querySelectorAll(
        "marinara-capability-otome-forge :is(.of-claw-bubble, .of-kitty-game [aria-live], .of-kitty-moment h2)",
      )) {
        seen.add(element.textContent ?? "");
      }
    };
    note();
    new MutationObserver(note).observe(document.querySelector("marinara-capability-otome-forge")!, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
}
const shown = (page: Page, text: string) => async () =>
  (await page.evaluate(() => [...(window as unknown as { __kittySeen: Set<string> }).__kittySeen])).some((entry) =>
    entry.includes(text),
  );

const finishes = (stub: Stub) => stub.calls.filter((call) => call.method === "POST" && call.path.endsWith("/finish"));
/** A POST's own fields: every one also carries the player's time zone and debug mode. */
const fields = (call: Call) => {
  const { timeZone: _zone, debugMode: _debug, ...rest } = call.body!;
  return rest;
};
const noWider = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

/** Starts the game `plan` was dealt from: its seed for the page's next random number, then who goes first. */
async function startGame(page: Page, root: Locator, plan: Pick<Plan, "seed">, first: "me" | "partner") {
  await page.evaluate((seed) => ((window as { __kittySeed?: number }).__kittySeed = seed), plan.seed);
  await root.getByRole("button", { name: first === "me" ? "I’ll go first" : "Kai Ardent goes first" }).click();
  await expect(root.locator(".of-kitty-game")).toBeVisible();
}

/**
 * Plays `plan` on the page: each of her moves once the page has made the moves before it, and `onMoment` at his
 * moment. Ends on the end screen.
 */
async function playOut(page: Page, root: Locator, plan: Plan, onMoment: (event: Event) => Promise<void>) {
  const table = root.locator(".of-kitty-game");
  const press = (target: Locator) => target.click();
  for (const event of plan.events) {
    await expect(table).toHaveAttribute("data-moves", String(event.moves), { timeout: 20_000 });
    if (event.who === "moment") {
      await expect(root.locator(".of-kitty-moment")).toBeVisible();
      await onMoment(event);
      continue;
    }
    await expect(table).toHaveAttribute("data-turn", "me", { timeout: 20_000 });
    await expect(root.locator(".of-kitty-moment")).toHaveCount(0, { timeout: 10_000 });
    if (event.move.kind === "draw") {
      await press(root.getByRole("button", { name: /^Draw a card/u }));
    } else {
      const card = root.locator(`.of-kitty-hand-card[data-card="${event.move.card}"]`);
      await press(card);
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await press(root.locator(`.of-kitty-cup[data-cup="${event.move.cup}"]`));
    }
    await expect(table).not.toHaveAttribute("data-moves", String(event.moves));
  }
  await expect(root.locator("#of-kitty-result-title")).toBeFocused({ timeout: 20_000 });
}

/** Opens Dates, then Kitty Cards with Kai Ardent. */
async function openKitty(root: Locator) {
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
  await root.getByRole("button", { name: "Play: Kitty Cards with Kai Ardent" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Kitty Cards" })).toBeFocused();
}

/** What the finish of `plan` sends. */
const finishOf = (plan: Plan, first: "me" | "partner") => {
  const { me, partner } = score(plan.game);
  return {
    li: KAI,
    first,
    result: me > partner ? "win" : me < partner ? "lose" : "draw",
    me,
    partner,
    cheat: plan.cheat,
  };
};

test("Otome Hearth Kitty Cards from Dates: a whole game, his nudge caught, the lost answer retried and paid once", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  // Pearl with reduced motion on the phone, Midnight in motion on the desktop.
  await page.emulateMedia({
    colorScheme: mobile ? "light" : "dark",
    reducedMotion: mobile ? "reduce" : "no-preference",
  });
  if (mobile) await page.setViewportSize({ width: 360, height: 800 });
  const stub = createKittyStub({ finishFailures: 1 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const root = await openOtome(page, stub);
  await expect(root).toHaveAttribute("data-look", mobile ? "pearl" : "midnight");

  // Dates lists Kitty Cards after the Claw Machine, with its pay and cost.
  await root.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Dates" }).click();
  const activities = root.getByRole("list", { name: "Things to do with Kai Ardent" });
  expect(
    await activities
      .locator(".of-activity")
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.activity)),
  ).toEqual(["read-him", "read-me", "tarot", "photo-shoot", "kitty", "claw"]);
  const card = root.locator('.of-activity[data-activity="kitty"]');
  await expect(card.getByRole("heading", { name: "Kitty Cards with Kai Ardent" })).toBeVisible();
  await expect(card).toContainText("+20 Starlight a game, +20 more for a win · +30 affection");
  await expect(card).toContainText("No model calls");
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("01-dates.png") });

  // The intro: how they play (his cheat in this game, not his Claw Machine style), the value-5 cards (the package's own
  // kittens), who goes first.
  const before = stub.calls.length;
  await root.getByRole("button", { name: "Play: Kitty Cards with Kai Ardent" }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Kitty Cards" })).toBeFocused();
  await expect(root.locator(".of-claw-style .of-eyebrow")).toHaveText("How Kai Ardent plays");
  await expect(root.locator(".of-claw-style-text")).toHaveText(STYLE.nudge);
  await expect(root).not.toContainText(CLAW_STYLE);
  await expect(root.getByRole("img", { name: "Turkish Angora, rose 5" })).toBeVisible();
  const art = root.getByRole("img", { name: "Devon Rex, sky 5" }).locator("img");
  await expect(art).toHaveAttribute(
    "src",
    `/api/capability-packages/otome-forge/assets/kitty/sky-5.webp?v=${encodeURIComponent(packageVersion)}`,
  );
  // The Engine serves the card from the installed package.
  await expect
    .poll(() => art.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth))
    .toBeGreaterThan(0);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("02-intro.png"), fullPage: true });

  const plan = seedFor("me", "nudge", (each) => each.events.filter((event) => event.who === "me").length >= 4);
  await recordKitty(page);
  await startGame(page, root, plan, "me");
  // Her hand has focus at once; his own start line opens the game.
  await expect(root.locator(".of-kitty-hand-card").first()).toBeFocused();
  await expect.poll(shown(page, "Deal me in. Gently.")).toBe(true);
  await expect(root.locator(".of-kitty-cup")).toHaveCount(8);
  await expect(root.getByRole("list", { name: /^Your hand, 2 cards$/u })).toBeVisible();
  await expect(root.locator(".of-kitty-his-hand")).toContainText("Kai Ardent: 3 cards");
  await expect(root.locator(".of-kitty-pile")).toContainText("Pile: 15 cards");
  // A picked card lights the cups it would score in, and names what each would make.
  const firstPlay = plan.events.find((event) => event.who === "me" && event.move.kind === "play");
  if (firstPlay?.who === "me" && firstPlay.move.kind === "play" && plan.events[0] === firstPlay) {
    await root.locator(`.of-kitty-hand-card[data-card="${firstPlay.move.card}"]`).click();
    await expect(root.locator(".of-kitty-cup[data-scores]").first()).toBeVisible();
    await expect(root.locator(`.of-kitty-cup[data-cup="${firstPlay.move.cup}"]`)).toHaveAccessibleName(
      /^Empty (rose|sky|lemon|mint|white) cup: \d+ points? for this card$/u,
    );
    await root.locator(`.of-kitty-hand-card[data-card="${firstPlay.move.card}"]`).click();
    await expect(root.locator(".of-kitty-cup[data-scores]")).toHaveCount(0);
  }
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("03-table.png"), fullPage: true });

  await playOut(page, root, plan, async () => {
    // His nudge: two cups swapped, his own cheat line, and Gotcha! (focused, with seconds to press it).
    await expect(root.locator(".of-kitty-moment")).toHaveAttribute("data-kind", "nudge");
    await expect(root.locator(".of-kitty-cup[data-moved]")).toHaveCount(2);
    await expect.poll(shown(page, "Look, a bird over there.")).toBe(true);
    const gotcha = root.getByRole("button", { name: "Gotcha!" });
    await expect(gotcha).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath("04-nudge.png"), fullPage: true });
    await page.keyboard.press("Enter");
    await expect.poll(shown(page, "Caught! The kittens go back where they were.")).toBe(true);
    await expect.poll(shown(page, "Fine. Fair is fair.")).toBe(true);
  });

  // The end screen: both scores and who won; the first answer was lost, Try again sends the same game.
  const expected = finishOf(plan, "me");
  await expect(root.locator(".of-kitty-final")).toHaveText(`You ${expected.me} · Kai Ardent ${expected.partner}`);
  await expect(root.locator("#of-kitty-result-title")).toHaveText(
    expected.result === "win" ? "You won!" : expected.result === "lose" ? "Kai Ardent won" : "A draw!",
  );
  await expect(root.getByText("Kai Ardent swapped two cups’ kittens, and you caught it.")).toBeVisible();
  if (expected.result !== "draw") {
    await expect(root.locator(".of-claw-quote")).toContainText(
      expected.result === "win" ? KAI_KITTY.win[0]! : KAI_KITTY.lose[0]!,
    );
  }
  await expect(root.getByRole("alert")).toContainText("No connection is set");
  await root.getByRole("button", { name: "Try again" }).click();
  const pay = 20 + (expected.result === "win" ? 20 : 0);
  await expect(root.locator(".of-claw-pay")).toContainText(`+${pay} Starlight · +30 affection with Kai Ardent`);
  const sent = finishes(stub);
  expect(sent).toHaveLength(2);
  expect(fields(sent[1]!)).toEqual(fields(sent[0]!));
  expect(fields(sent[0]!)).toEqual({ ...expected, round: expect.stringMatching(/^k-[0-9a-z]{1,12}-[0-9a-z]{6}$/u) });
  // Paid once: the stub's wallet moved by one game's pay, and the top bar shows it.
  expect(stub.view.starlight).toBe(2000 + pay);
  await expect(root.locator(".of-starlight")).toContainText((2000 + pay).toLocaleString("en-US"));
  // No model call and no picture; his lines came with GET /play, never from GET .../lines.
  expect(stub.calls.slice(before).filter((call) => /generate|avatar|chat|note|lines|\/art\//u.test(call.path))).toEqual(
    [],
  );
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("05-result.png"), fullPage: true });

  // Play again deals a new game with a new id; Back returns to Dates with today's Starlight.
  await root.getByRole("button", { name: "Play again" }).click();
  await expect(root.locator(".of-kitty-hand-card").first()).toBeFocused();
  await root.getByRole("button", { name: "Back" }).first().click();
  await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
  await expect(root.getByRole("progressbar", { name: "Starlight from activities" })).toHaveAttribute(
    "aria-valuenow",
    String(pay),
  );
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth Kitty Cards' other cheats: a freeze, an extra, a calculate and a steady, each sent in its finish", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "dark" : "light", reducedMotion: "reduce" });
  const stub = createKittyStub();
  // The catalog's lines: his pack has none yet.
  stub.state.kitty = undefined;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const root = await openOtome(page, stub);
  await recordKitty(page);
  const moment = root.locator(".of-kitty-moment");

  const games: Array<{ cheat: ClawCheat; first: "me" | "partner"; play: (event: Event) => Promise<void> }> = [
    {
      // He dozes: she swaps two filled cups' kittens, one tap then the other; he wakes when the five seconds are up.
      cheat: "freeze",
      first: "partner",
      play: async (event) => {
        await expect(moment).toHaveAttribute("data-kind", "freeze");
        await expect.poll(shown(page, "Kai Ardent dozes off")).toBe(true);
        const [a, b] = event.who === "moment" ? event.swap! : [0, 1];
        await root.locator(`.of-kitty-cup[data-cup="${a}"]`).click();
        await expect(root.locator(`.of-kitty-cup[data-cup="${a}"]`)).toHaveAttribute("aria-pressed", "true");
        await root.locator(`.of-kitty-cup[data-cup="${b}"]`).click();
        await expect(root.locator(".of-kitty-cup[data-moved]")).toHaveCount(2);
        await expect(moment).toContainText("Swapped. Now look innocent.");
        await page.screenshot({ path: testInfo.outputPath("06-freeze.png"), fullPage: true });
        await expect(moment).toHaveCount(0, { timeout: 8_000 });
      },
    },
    {
      // He looks away: she holds Sneak a card (Space on the desktop, a held press on the phone) for its 1.5 seconds.
      cheat: "extra",
      first: "me",
      play: async () => {
        await expect(moment).toHaveAttribute("data-kind", "extra");
        const sneak = root.getByRole("button", { name: "Sneak a card" });
        await expect(sneak).toBeFocused();
        if (mobile) {
          const box = (await sneak.boundingBox())!;
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(1_800);
          await page.mouse.up();
        } else {
          await page.keyboard.down(" ");
          await page.waitForTimeout(1_800);
          await page.keyboard.up(" ");
        }
        await expect(moment).toHaveCount(0);
        await expect.poll(shown(page, "You sneaked ")).toBe(true);
      },
    },
    {
      // He offers a trade, face down: she takes it.
      cheat: "calculate",
      first: "me",
      play: async () => {
        await expect(moment).toHaveAttribute("data-kind", "calculate");
        await expect(moment.locator(".of-kitty-back")).toHaveCount(2);
        await page.screenshot({ path: testInfo.outputPath("07-trade.png"), fullPage: true });
        await root.getByRole("button", { name: "Trade" }).click();
        await expect.poll(shown(page, "Traded: ")).toBe(true);
      },
    },
    {
      // He lets her take back the card she just played: it comes back to her hand, and she plays again.
      cheat: "steady",
      first: "me",
      play: async () => {
        await expect(moment).toHaveAttribute("data-kind", "steady");
        const hand = await root.locator(".of-kitty-hand-card").count();
        await root.getByRole("button", { name: "Take it back" }).click();
        await expect(root.locator(".of-kitty-hand-card")).toHaveCount(hand + 1);
        await expect(root.locator(".of-kitty-game")).toHaveAttribute("data-turn", "me");
      },
    },
  ];

  stub.state.cheat = games[0]!.cheat;
  await openKitty(root);
  for (const [index, game] of games.entries()) {
    const next = games[index + 1];
    const plan = seedFor(game.first, game.cheat, (each) =>
      game.cheat === "freeze" || game.cheat === "extra" ? each.cheat?.caught === false : true,
    );
    // The intro says what his cheat does in this game.
    await expect(root.locator(".of-claw-style-text")).toHaveText(STYLE[game.cheat]);
    await startGame(page, root, plan, game.first);
    await playOut(page, root, plan, async (event) => {
      await game.play(event);
      // The next game's cheat (GET /play's `cheat`), which the play view read after this finish brings.
      if (next) stub.state.cheat = next.cheat;
    });
    await expect.poll(() => finishes(stub).length).toBe(index + 1);
    expect(fields(finishes(stub)[index]!)).toEqual({
      ...finishOf(plan, game.first),
      round: expect.stringMatching(/^k-/u),
    });
    await expect(root.locator(".of-claw-pay")).toContainText("+30 affection with Kai Ardent");
    await noWider(page);
    if (!next) break;
    const finished = stub.calls.indexOf(finishes(stub)[index]!);
    await expect.poll(() => stub.calls.slice(finished).some((call) => call.path.endsWith("/play"))).toBe(true);
    await root.getByRole("button", { name: "Back" }).first().click();
    await expect(root.getByRole("heading", { level: 1, name: "Dates" })).toBeFocused();
    await root.getByRole("button", { name: "Play: Kitty Cards with Kai Ardent" }).click();
    await expect(root.getByRole("heading", { level: 1, name: "Kitty Cards" })).toBeFocused();
  }
  // The catalog's own lines stood in for his pack's.
  await expect.poll(shown(page, "Kai Ardent: ")).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth Kitty Cards with images on: the painted kittens take the value-5 cards, Paint our kittens paints one", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createKittyStub({ images: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const root = await openOtome(page, stub);
  await openKitty(root);

  // Rose 5 is hers and sky 5 his; Mireille's waits for a tap, so lemon 5 keeps its breed, and mint 5 has no one.
  const hero = root.getByRole("list", { name: "Some of the kittens in the deck" });
  await expect(hero.getByRole("img", { name: "Mira Vale as a kitten, rose 5" }).locator("img")).toHaveAttribute(
    "src",
    KITTEN("player"),
  );
  await expect(hero.getByRole("img", { name: "Kai Ardent as a kitten, sky 5" }).locator("img")).toHaveAttribute(
    "src",
    KITTEN(KAI),
  );
  await expect(hero.getByRole("img", { name: "Exotic Shorthair, lemon 5" })).toBeVisible();
  await expect(hero.getByRole("img", { name: "Egyptian Mau, mint 5" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("08-kittens.png"), fullPage: true });

  // Paint our kittens stands for consent: one tap paints Mireille's, which then takes lemon 5.
  const paint = root.getByRole("button", { name: "Paint our kittens (1 image)" });
  await expect(paint).toBeVisible();
  await paint.click();
  await expect(hero.getByRole("img", { name: "Mireille as a kitten, lemon 5" }).locator("img")).toHaveAttribute(
    "src",
    KITTEN(MIR),
  );
  await expect(paint).toHaveCount(0);
  const taps = stub.calls.filter((call) => call.method === "POST" && call.path.endsWith("/art/kitten"));
  expect(taps.map(fields)).toEqual([{ owner: MIR }]);

  // In a game her painted kitten is rose 5 itself, named for her.
  const plan = seedFor("me", "nudge", (each) => deal(each.seed, "me").hands.me.includes("rose-5"));
  await startGame(page, root, plan, "me");
  const rose = root.locator('.of-kitty-hand-card[data-card="rose-5"]');
  await expect(rose).toHaveAccessibleName("Mira Vale as a kitten, rose 5");
  await expect(rose.locator("img")).toHaveAttribute("src", KITTEN("player"));
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("09-painted-in-hand.png"), fullPage: true });
  expect(pageErrors).toEqual([]);
});

test("Otome Hearth Kitty Cards at phone width: her hand drawn to 10 cards stays on the page, a shared paint failure shows once", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "dark" : "light", reducedMotion: "reduce" });
  if (mobile) await page.setViewportSize({ width: 360, height: 800 });
  // All three kittens wait for a tap, and every paint fails the same way.
  const stub = createKittyStub({ images: true, paintFails: true });
  stub.state.kittens = {};
  // Steady: his moment needs her last move to be a play, so a game where she only draws has none.
  stub.state.cheat = "steady";
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const root = await openOtome(page, stub);
  await openKitty(root);

  // One message for the three failed kittens, not one each.
  await root.getByRole("button", { name: "Paint our kittens (3 images)" }).click();
  await expect.poll(() => stub.calls.filter((call) => call.path.endsWith("/art/kitten")).length).toBe(3);
  await expect(root.getByRole("status").filter({ hasText: "Painting your kittens" })).toHaveCount(0);
  await expect(root.getByRole("alert")).toHaveText(["No connection is set for this. Choose one in Settings."]);

  // Her fanned hand, at every size up to 10 cards: no sideways scroll, and no card past the page's edges.
  const table = root.locator(".of-kitty-game");
  /** How far the page scrolls sideways, and how far any card of her hand reaches past the page's left or right edge. */
  const overflow = () =>
    root.locator(".of-page.of-kitty").evaluate((scroller) => {
      const box = scroller.getBoundingClientRect();
      const cards = [...scroller.querySelectorAll(".of-kitty-hand-card")].map((card) => card.getBoundingClientRect());
      return {
        sideways: scroller.scrollWidth - scroller.clientWidth,
        left: Math.max(0, ...cards.map((card) => Math.ceil(box.left - card.left))),
        right: Math.max(0, ...cards.map((card) => Math.ceil(card.right - box.right))),
      };
    });
  await startGame(page, root, { seed: 1 }, "me");
  for (let hand = 3; hand <= 10; hand += 1) {
    await expect(table).toHaveAttribute("data-turn", "me", { timeout: 20_000 });
    await root.getByRole("button", { name: /^Draw a card/u }).click();
    await expect(root.locator(".of-kitty-hand-card")).toHaveCount(hand);
    await expect.poll(overflow, { message: `her hand of ${hand}` }).toEqual({ sideways: 0, left: 0, right: 0 });
  }
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("10-full-hand.png"), fullPage: true });
  expect(pageErrors).toEqual([]);
});
