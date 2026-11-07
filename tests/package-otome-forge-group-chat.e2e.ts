// Otome Hearth's group chat (#2154) in the Engine's Home tab, with /api/otome-forge/** stubbed by the server's rules
// (S/routes/phone.ts, S/phone/group.ts): Messages pins "Everyone" first, with its members' portraits, the last message
// and who sent it, and its unread count; the thread names everyone in its header (the long names ellipsized on one row),
// gives each bubble its speaker's accent, their name when the speaker changes and their portrait on the last of a run,
// and tells a screen reader who said what; Send waits while someone is typing; the picker offers the protagonist's five
// stickers alone; Close and remember says everyone in it recalls it and earns nothing; Back returns focus to its row;
// and Settings → Connections' squabbles a day validate and save with their own note. Each run checks nothing scrolls
// sideways, on the desktop (desktop-chromium) and at phone width (mobile-chromium, 390×844), with touch targets of 44 px.
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge-group-chat.e2e.ts
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

const RUN = "r-e2e-group01";
const KAI = "li-kai-0001";
const MIR = "li-mireille-0002";
const SOL = "li-sol-0003";
const NAMES: Record<string, string> = { [KAI]: "Kai Ardent", [MIR]: "Mireille Delacroix-Vaillancourt", [SOL]: "Sol" };
const ACCENTS: Record<string, string> = { [KAI]: "#9DB8F0", [MIR]: "#E7A6B8", [SOL]: "#B8E0C2" };

/** The routes the phone and Settings → Connections use, answered in memory by the server's rules. */
function createGroupStub() {
  const calls: Call[] = [];
  const now = () => new Date().toISOString();
  const they = { subject: "they", object: "them", possessive: "their" };
  const view: Json = {
    runKey: RUN,
    world: {
      version: 1,
      title: "The Lantern Court",
      premise: "A harbour city lit by lanterns.",
      language: "English",
      createdAt: now(),
      setting: "",
      mystery: { question: "Who puts out the lanterns?" },
      web: [],
      openingSituation: "",
      content: { heat: "sfw", darkness: "angst", limits: {}, custom: [] },
      images: { connectionId: null, rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
      forge: { phase: "ready", steps: [] },
      audio: {},
    },
    player: {
      personaId: "persona-ines",
      name: "Ines",
      pronouns: they,
      traits: [],
      goal: "",
      look: { identityLine: "", outfitLine: "" },
    },
    lis: [KAI, MIR, SOL].map((id) => ({
      id,
      name: NAMES[id],
      pronouns: they,
      source: "archetype",
      accent: ACCENTS[id],
      level: 2,
      stage: 1,
    })),
    forge: { phase: "ready", steps: [] },
    starlight: 100,
  };
  const index = {
    version: 1,
    runs: [{ runKey: RUN, title: "The Lantern Court", createdAt: now(), lastPlayedAt: null }],
    activeRun: RUN,
    ageGate: null,
    lastOpenedAt: null,
  };
  const earlier = new Date(Date.now() - 60_000).toISOString();
  const messages: Json[] = [
    { id: "m-g1", who: "li", text: "Did anyone see the lamps go out?", at: earlier, li: KAI },
    { id: "m-g2", who: "li", text: "Twice now.", at: earlier, li: KAI },
    { id: "m-g3", who: "li", text: "I saw. I said nothing.", at: earlier, li: SOL },
  ];
  const sessions: Json[] = [];
  let seenAt: string | null = null;
  let replying = false;
  const archived = () => sessions.reduce((sum, session) => sum + session.count, 0);
  const unread = () => messages.filter((m) => m.who === "li" && (!seenAt || m.at > seenAt)).length;
  const page = () => ({
    messages: messages.map((message, at) => ({ ...message, archived: at < archived() })),
    page: 1,
    pages: 1,
    from: 0,
    past: sessions.length,
    activeCount: messages.length - archived(),
    busy: replying,
    retry: false,
    sessions: structuredClone(sessions),
    seenAt,
    members: [KAI, MIR, SOL],
  });

  const answer = async (call: Call): Promise<{ status: number; json: unknown }> => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    const base = `/runs/${RUN}`;
    if (path === "/index" || path === "/index/opened") return { status: 200, json: { index } };
    if (path === base) return { status: 200, json: { view: structuredClone(view) } };
    if (path === `${base}/home`) {
      return {
        status: 200,
        json: {
          li: KAI,
          show: "him",
          note: null,
          look: null,
          faces: {},
          lines: { ready: true },
          rupture: false,
          unread: unread(),
        },
      };
    }
    if (/^\/runs\/[^/]+\/lis\/[^/]+\/lines$/u.test(path)) {
      return {
        status: 200,
        json: { ready: true, stage: 1, rupture: false, tap: null, annoyed: [], cold: [], comfort: [], claw: null },
      };
    }
    if (path === `${base}/phone`) {
      return {
        status: 200,
        json: {
          threads: [KAI, MIR, SOL].map((li) => ({ li, last: null, unread: 0, busy: false })),
          group: { members: [KAI, MIR, SOL], last: messages.at(-1) ?? null, unread: unread(), busy: replying },
        },
      };
    }
    if (path === `${base}/phone/group`) return { status: 200, json: page() };
    if (path === `${base}/phone/group/seen`) {
      const last = messages.find((m) => m.id === call.body!.last);
      if (last && (!seenAt || last.at > seenAt)) seenAt = last.at;
      return { status: 200, json: {} };
    }
    if (path === `${base}/phone/group/send`) {
      const { text = "", sticker, id } = call.body!;
      const mine: Json = { id, who: "player", text, at: now(), ...(sticker ? { sticker } : {}) };
      messages.push(mine);
      seenAt = mine.at;
      // Someone is typing a moment; then two of them answer.
      replying = true;
      await new Promise((done) => setTimeout(done, 1500));
      replying = false;
      const reply: Json[] = [
        { id: `m-r${messages.length}a`, who: "li", text: "Some of us were asleep.", at: now(), li: MIR },
        { id: `m-r${messages.length}b`, who: "li", text: "Liar.", at: now(), li: KAI },
      ];
      messages.push(...reply);
      return { status: 200, json: { messages: [mine, ...reply] } };
    }
    if (path === `${base}/phone/group/close`) {
      const count = messages.length - archived();
      const memory = { text: "They argued about the lamps; Ines asked who was awake.", quote: "Liar." };
      sessions.push({ start: archived(), count, memory, closedAt: now(), members: [KAI, MIR, SOL] });
      // A squabble right after the close, by the speaker who ended it: his run restarts after the divider.
      messages.push({ id: `m-after${messages.length}`, who: "li", text: "Again, then?", at: now(), li: KAI });
      return { status: 200, json: { memory, grants: [] } };
    }
    if (path === `${base}/phone/due`) {
      return { status: 200, json: { status: "waiting", latest: null, group: { status: "waiting", latest: null } } };
    }
    if (path === `${base}/settings`) {
      const { connections, dailyMessages, groupSquabbles } = call.body!;
      view.world = {
        ...view.world,
        ...(connections ? { connections } : {}),
        ...(dailyMessages === undefined ? {} : { dailyMessages }),
        ...(groupSquabbles === undefined ? {} : { groupSquabbles }),
      };
      return { status: 200, json: { world: structuredClone(view.world) } };
    }
    if (path === `${base}/memory/status`) {
      return { status: 200, json: { status: { phase: "ready", retryable: false, recordCount: 1 } } };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, answer };
}

type Stub = ReturnType<typeof createGroupStub>;

async function openOtome(page: Page, stub: Stub): Promise<Locator> {
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
  await page.route("**/api/connections", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: [{ id: "conn-text", name: "Story fixture", provider: "custom", model: "fixture", isDefault: "true" }],
        })
      : route.continue(),
  );
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
const noWider = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const atLeast44 = async (target: Locator) => {
  const box = (await target.boundingBox())!;
  expect(box.height, "a 44 px target").toBeGreaterThanOrEqual(44);
  expect(box.width, "a 44 px target").toBeGreaterThanOrEqual(44);
};

test.use({ actionTimeout: 15_000 });

test("Otome Hearth group chat: Everyone pinned first, speakers in the thread, Close and remember, and the squabbles setting", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ colorScheme: mobile ? "light" : "dark", reducedMotion: "reduce" });
  const stub = createGroupStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const root = await openOtome(page, stub);

  // Messages: Everyone is the first row, with the last message and who sent it, and its unread count.
  await root.getByRole("button", { name: /Messages/ }).click();
  await expect(root.getByRole("heading", { level: 1, name: "Messages" })).toBeFocused();
  await expect(root.getByText("In Everyone, everyone in it does.")).toBeVisible();
  const rows = root.locator(".of-threads .of-thread-row");
  await expect(rows).toHaveCount(4);
  const everyone = rows.first();
  await expect(everyone).toContainText("Everyone");
  await expect(everyone).toContainText("Sol: I saw. I said nothing.");
  await expect(everyone).toContainText("3 unread");
  await expect(everyone.locator(".of-avatar-cluster .of-avatar")).toHaveCount(3);
  await expect(everyone.locator(".of-avatar-cluster")).toHaveAttribute("aria-hidden", "true");
  await atLeast44(everyone);
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("01-threads.png") });

  // The thread: its title and everyone in it, on one row with Close, the long names ellipsized.
  await everyone.click();
  const heading = root.getByRole("heading", { level: 1, name: "Everyone" });
  await expect(heading).toBeFocused();
  const subtitle = root.locator(".of-thread-subtitle");
  await expect(subtitle).toHaveText("Kai Ardent, Mireille Delacroix-Vaillancourt, Sol and you");
  await expect(subtitle).toHaveCSS("text-overflow", "ellipsis");
  const close = root.getByRole("button", { name: "Close and remember" });
  const [titleBox, closeBox] = [(await heading.boundingBox())!, (await close.boundingBox())!];
  expect(Math.abs(titleBox.y + titleBox.height / 2 - (closeBox.y + closeBox.height / 2))).toBeLessThan(24);
  await atLeast44(close);
  await atLeast44(root.getByRole("button", { name: "All messages" }));
  await noWider(page);

  // Each speaker's bubble in their accent; the name over the first of a run, the portrait on its last.
  const log = root.getByRole("list", {
    name: "Group chat with Kai Ardent, Mireille Delacroix-Vaillancourt, Sol and you",
  });
  const theirs = log.locator('.of-bubble-row[data-group="true"]');
  await expect(theirs).toHaveCount(3);
  await expect(theirs.nth(0).locator(".of-bubble-name")).toHaveText("Kai Ardent");
  await expect(theirs.nth(0).locator(".of-avatar")).toHaveCount(0);
  await expect(theirs.nth(1).locator(".of-bubble-name")).toHaveCount(0);
  await expect(theirs.nth(1).locator(".of-avatar")).toHaveCount(1);
  await expect(theirs.nth(2).locator(".of-bubble-name")).toHaveText("Sol");
  await expect(theirs.nth(2).locator(".of-avatar")).toHaveCount(1);
  const accent = (row: Locator) =>
    row.evaluate((element) => getComputedStyle(element).getPropertyValue("--of-li-accent").trim());
  // Their own colours (accentOf: the name's colour while the stub's accents are unsampled): Kai's run shares one.
  const [kai, kaiAgain, sol] = await Promise.all([0, 1, 2].map((at) => accent(theirs.nth(at))));
  expect(kai).toMatch(/^#[0-9a-f]{6}$/iu);
  expect(kaiAgain).toBe(kai);
  expect(sol).not.toBe(kai);
  // A screen reader hears who said each one.
  await expect(theirs.nth(2).locator(".of-visually-hidden")).toHaveText("Sol:");
  await expect.poll(() => posts(stub, "/phone/group/seen").at(-1)?.body?.last).toBe("m-g3");
  await page.screenshot({ path: testInfo.outputPath("02-thread.png") });

  // The protagonist's five stickers, and no one else's.
  await root.getByRole("button", { name: "Stickers" }).click();
  await expect(root.getByRole("group", { name: "Your stickers" }).getByRole("button")).toHaveCount(5);
  await expect(root.locator(".of-sticker-panel").getByRole("group")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(root.getByRole("button", { name: "Stickers" })).toBeFocused();

  // She writes to everyone: Send waits while someone is typing, then two of them answer, each named.
  const box = root.getByRole("textbox", { name: "Message everyone" });
  await expect(box).toHaveAttribute("placeholder", "Write to everyone…");
  await box.fill("Who is still awake?");
  const send = root.getByRole("button", { name: "Send", exact: true });
  await send.click();
  await expect(box).toHaveValue("");
  await expect(root.locator(".of-typing")).toBeVisible();
  // The dots in line with the members' bubbles, whose names sit in the column of the times under them.
  const left = async (target: Locator) => (await target.boundingBox())!.x;
  expect(
    Math.abs((await left(root.locator(".of-typing"))) - (await left(theirs.nth(0).locator(".of-bubble")))),
  ).toBeLessThan(1);
  const inset = (selector: string) =>
    theirs
      .nth(2)
      .locator(selector)
      .evaluate((element) => getComputedStyle(element).paddingInlineStart);
  expect(await inset(".of-bubble-name")).toBe(await inset(".of-bubble-time"));
  await expect(send).toHaveAttribute("aria-disabled", "true");
  await expect(log.getByText("Liar.")).toBeVisible();
  await expect(root.locator(".of-typing")).toHaveCount(0);
  await expect(theirs).toHaveCount(5);
  await expect(theirs.nth(3).locator(".of-bubble-name")).toHaveText("Mireille Delacroix-Vaillancourt");
  await expect(theirs.nth(4).locator(".of-bubble-name")).toHaveText("Kai Ardent");
  await expect(root.locator('.of-visually-hidden[aria-live="polite"]')).toHaveText("Kai Ardent: Liar.");
  const sent = posts(stub, "/phone/group/send")[0]!.body!;
  expect(sent).toMatchObject({ text: "Who is still awake?" });
  expect(sent.quote).toBeUndefined();
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("03-answered.png") });

  // Close and remember: everyone in it recalls it, and it earns nothing.
  await close.click();
  const dialog = page.getByRole("dialog", { name: "Close and remember?" });
  await expect(dialog).toContainText("everyone in it recalls: Kai Ardent, Mireille Delacroix-Vaillancourt, Sol");
  await dialog.getByRole("button", { name: "Close and remember" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(log).toContainText("Remembered by everyone in it");
  await expect(log).toContainText("Liar.");
  await expect(log).not.toContainText("affection");
  await expect(log).not.toContainText("They argued about the lamps");
  // A speaker's run never crosses the divider: his last line before it keeps his portrait, his first after it his name.
  const beforeDivider = log.locator(".of-bubble-row", { hasText: "Liar." });
  const afterDivider = log.locator(".of-bubble-row", { hasText: "Again, then?" });
  await expect(afterDivider).toBeVisible();
  await expect(beforeDivider.locator(".of-bubble-gap")).toHaveCount(0);
  await expect(afterDivider.locator(".of-bubble-name")).toHaveText("Kai Ardent");
  await page.screenshot({ path: testInfo.outputPath("04-remembered.png") });

  // Back: focus returns to its row.
  await root.getByRole("button", { name: "All messages" }).click();
  await expect(root.locator(".of-threads .of-thread-row").first()).toBeFocused();

  // Settings → Connections: squabbles a day, 0 (off) until set, 0 to 24, saved with their own note.
  await root.getByRole("button", { name: "Settings", exact: true }).click();
  const tab = root.getByRole("tablist").getByRole("tab", { name: "Connections", exact: true });
  await tab.click();
  const panel = root.getByRole("tabpanel");
  const squabbles = panel.getByRole("spinbutton", { name: "Group chat squabbles each day" });
  const save = panel.getByRole("button", { name: "Save changes" });
  await expect(squabbles).toHaveValue("0");
  await expect(squabbles).toHaveAccessibleDescription(/they always answer/u);
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await squabbles.fill("30");
  await expect(squabbles).toHaveAttribute("aria-invalid", "true");
  await expect(squabbles).toHaveAccessibleDescription("Enter a whole number from 0 to 24.");
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await squabbles.fill("3");
  await expect(squabbles).not.toHaveAttribute("aria-invalid");
  await save.click();
  await expect
    .poll(() => posts(stub, "/settings").at(-1)?.body)
    .toMatchObject({ groupSquabbles: 3, dailyMessages: 0, connections: { narration: "conn-text" } });
  await expect(panel.getByText("Saved. The group chat follows it from now on.")).toBeVisible();
  await expect(squabbles).toHaveValue("3");
  await noWider(page);
  await page.screenshot({ path: testInfo.outputPath("05-settings.png") });
  expect(pageErrors).toEqual([]);
});
