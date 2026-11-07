import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

const OPENING = "It was a dark and stormy night.";
const PARAGRAPH =
  "The rain came sideways off the river and found every gap in Vimes's coat. He walked anyway, because walking was " +
  "the job, and because the city had a way of telling you things if you let your boots listen. Somewhere a gutter " +
  "sang *off key*, and somewhere further off a bell decided it was midnight, then thought better of it.";
// Long enough to fill several pages of the book on any screen.
const CHAPTER = [
  " Thunder rolled over the rooftops.",
  ...Array.from({ length: 14 }, () => PARAGRAPH),
  "***",
  "**Morning came** at last, grey and grudging.",
].join("\n\n");

function sseBody(content: string) {
  const pieces: string[] = [];
  for (let index = 0; index < content.length; index += 48) pieces.push(content.slice(index, index + 48));
  return [
    { type: "raw_started", data: { runId: "e2e" } },
    ...pieces.map((data) => ({ type: "token", data })),
    { type: "result", data: { content } },
    { type: "done", data: "" },
  ]
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");
}

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function engineRequest(
  request: APIRequestContext,
  baseURL: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  data?: unknown,
) {
  const response = await request.fetch(`${baseURL}/api${path}`, {
    method,
    data,
    headers: { "x-marinara-csrf": "1", origin: new URL(baseURL).origin },
  });
  expect(response.ok(), `${method} ${path} → ${response.status()} ${await response.text()}`).toBe(true);
  return response.json();
}

async function openStoryWriter(page: Page) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((version) => {
    localStorage.removeItem("marinara-active-chat-id");
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
  await page.getByRole("tab", { name: "Open Story Writer" }).click();
  const root = page.locator("marinara-capability-story-writer .sw-root");
  await expect(root).toBeVisible();
  return root;
}

test("Story Writer writes, edits, turns pages, keeps stories and returns from the connection editor", async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  test.setTimeout(150_000);
  const base = baseURL!;
  const mobile = testInfo.project.name.includes("mobile");

  // A text connection the stream never reaches: /generate/raw is answered below.
  const connections: Array<{ id: string; name: string }> = await engineRequest(request, base, "GET", "/connections");
  const connection =
    connections.find((row) => row.name === "Story Writer E2E") ??
    (await engineRequest(request, base, "POST", "/connections", {
      name: "Story Writer E2E",
      provider: "openai",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "story-writer-e2e-key",
      model: "e2e-model",
      isDefault: true,
    }));
  await engineRequest(request, base, "PATCH", "/story-writer/preferences", {
    theme: "book",
    colorMode: "light",
    sidebarSide: "left",
    noteSide: "right",
    streaming: true,
    pageAnimation: true,
    // One document per server run: a retry must not find the quick reply an earlier attempt saved.
    showQuickReplies: true,
    quickReplies: [],
  });
  // Each run starts on a fresh story, so earlier runs' stories never decide what opens.
  const fresh = await engineRequest(request, base, "POST", "/story-writer/stories", {
    settings: { title: "The Long Walk Home" },
  });
  await engineRequest(request, base, "PATCH", "/story-writer/preferences", { lastStoryId: fresh.story.id });

  const generations: Array<Record<string, unknown>> = [];
  // Set to hold the mocked reply back, so a step can look at the page while the chapter is being written.
  let hold: Promise<void> | null = null;
  await page.route("**/api/generate/raw", async (route) => {
    generations.push(route.request().postDataJSON());
    await hold;
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sseBody(CHAPTER) });
  });

  const root = await openStoryWriter(page);
  await expect(root).toHaveAttribute("data-sw-theme", "book");
  await expect(root.locator(".sw-reader")).toHaveAttribute("data-pps", mobile ? "1" : "2");
  await expect(root.locator(".sw-title-text")).toContainText("The Long Walk Home");
  await page.screenshot({ path: testInfo.outputPath("01-empty-book.png") });

  // Click the empty page and start the story yourself. The first create and the first save fail as a dropped
  // connection would: the text must still reach the server, not vanish with the failed request.
  const failedOnce = new Set<string>();
  await page.route("**/api/story-writer/stories/*/chapters**", async (route) => {
    const method = route.request().method();
    if ((method === "POST" || method === "PATCH") && !failedOnce.has(method)) {
      failedOnce.add(method);
      await route.fulfill({ status: 503, json: { error: "Service unavailable" } });
      return;
    }
    await route.continue();
  });
  if (mobile) await root.getByRole("button", { name: "Start writing" }).click();
  const ghost = root.locator(".sw-block--ghost .sw-body");
  await ghost.click();
  const storyChapters = async () =>
    (await engineRequest(request, base, "GET", `/story-writer/stories/${fresh.story.id}`)).chapters;
  const firstHalf = "It was a dark";
  await page.keyboard.type(firstHalf);
  await expect
    .poll(storyChapters, { timeout: 30_000 })
    .toEqual([expect.objectContaining({ status: "draft", text: firstHalf })]);
  await page.keyboard.type(OPENING.slice(firstHalf.length));
  await expect
    .poll(storyChapters, { timeout: 30_000 })
    .toEqual([expect.objectContaining({ status: "draft", text: OPENING })]);
  expect([...failedOnce].sort()).toEqual(["PATCH", "POST"]);
  await page.unroute("**/api/story-writer/stories/*/chapters**");

  // The author's note, at depth 0, goes right before the continue message.
  await root.getByRole("button", { name: /^Open the author's note/ }).click();
  await root.getByLabel("Instructions for the next chapter").fill("Make it rain.");
  await expect(root.locator(".sw-note-depth input")).toHaveValue("0");
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath("02-note-open.png") });
  await page.keyboard.press("Escape");

  const write = root.getByRole("button", { name: "Continue chapter 1" });
  await expect(write).toBeEnabled();
  await write.click();
  await expect(root.getByRole("button", { name: "Write next chapter" })).toBeEnabled({ timeout: 30_000 });
  expect(generations).toHaveLength(1);
  const body = generations[0]!;
  expect(body.connectionId).toBe(connection.id);
  expect(body.streaming).toBe(true);
  const messages = body.messages as Array<{ role: string; content: string }>;
  expect(messages[0]!.role).toBe("system");
  expect(messages[0]!.content).toContain("You are an excellent writer for the user.");
  expect(messages[0]!.content).toContain("Never use these words or phrases: ozone, jaws working, Elara");
  expect(messages[0]!.content).not.toContain("Make it rain.");
  expect(messages.slice(-3)).toEqual([
    { role: "assistant", content: OPENING },
    { role: "user", content: "Make it rain." },
    { role: "user", content: "Continue." },
  ]);

  const saved = await engineRequest(request, base, "GET", `/story-writer/stories/${fresh.story.id}`);
  expect(saved.chapters).toHaveLength(1);
  expect(saved.chapters[0].status).toBe("complete");
  expect(saved.chapters[0].text.startsWith(`${OPENING} Thunder rolled over the rooftops.`)).toBe(true);
  await expect(root.locator(".sw-body").first()).toContainText("Morning came");

  // The chapter fills several pages; the arrows turn them.
  const indicator = root.locator(".sw-indicator");
  await expect(indicator).toContainText(/Page \d+ of \d+/);
  const total = Number(/of (\d+)/.exec((await indicator.textContent()) ?? "")?.[1]);
  expect(total).toBeGreaterThanOrEqual(mobile ? 3 : 2);
  // A loaded machine can finish the mocked stream before the pages are laid out, leaving the reader on page 1.
  const next = root.getByRole("button", { name: "Next page" });
  const before = await indicator.textContent();
  await ((await next.isEnabled()) ? next : root.getByRole("button", { name: "Previous page" })).click();
  await expect(indicator).not.toHaveText(before ?? "");
  await page.waitForTimeout(800);
  await page.screenshot({ path: testInfo.outputPath("03-book-written.png") });

  // The chapter bar sits above the book, outside the reader, clear of the sticky note.
  const chapterBar = root.getByRole("navigation", { name: "Chapters" });
  await expect(chapterBar).toBeVisible();
  await expect(root.locator(".sw-reader").getByRole("navigation", { name: "Chapters" })).toHaveCount(0);
  await expect(root.locator(".sw-reader-footer")).toHaveCount(0);
  const barBox = (await chapterBar.boundingBox())!;
  const bookTop = (await root.locator(".sw-book").boundingBox())!.y;
  const noteBox = (await root.locator(".sw-note-collapsed").boundingBox())!;
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(bookTop);
  expect(overlaps(barBox, noteBox)).toBe(false);
  // On a phone it moves to the side away from the note (on the right here).
  if (mobile) expect(barBox.x + barBox.width).toBeLessThan(noteBox.x);

  // Quick replies: no bar until there is one to show.
  await expect(root.locator(".sw-quickbar")).toHaveCount(0);
  const wide = (await root.boundingBox())!.width >= 1100;
  const slotBefore = (await root.locator(".sw-reader-slot").boundingBox())!;
  await root.getByRole("button", { name: "Show story settings" }).click();
  await root.getByRole("button", { name: /^Quick replies/ }).click();
  await root.getByLabel("Button label (optional)").fill("Pour");
  await root.getByLabel("Instruction", { exact: true }).fill("Make it pour.");
  await root.getByRole("button", { name: "Add quick reply" }).click();
  // Clearing an instruction to retype it keeps the reply.
  const instruction = root.getByLabel("Instruction of quick reply 1");
  await expect(instruction).toHaveValue("Make it pour.");
  await instruction.fill("");
  await instruction.pressSequentially("Make it pour.");
  await expect(root.locator(".sw-quick-item")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("03a-quick-replies-editor.png") });
  await expect
    .poll(async () => (await engineRequest(request, base, "GET", "/story-writer/preferences")).quickReplies)
    .toEqual([expect.objectContaining({ label: "Pour", text: "Make it pour." })]);
  await root.getByRole("button", { name: "Hide story settings" }).click();

  const quickBar = root.getByRole("toolbar", { name: "Quick replies" });
  await expect(quickBar).toBeVisible();
  const quickBox = (await quickBar.boundingBox())!;
  const actionBox = (await root.locator(".sw-actionbar").boundingBox())!;
  await expect.poll(async () => overlaps(quickBox, (await root.locator(".sw-book").boundingBox())!)).toBe(false);
  expect(overlaps(quickBox, actionBox)).toBe(false);
  const slotAfter = (await root.locator(".sw-reader-slot").boundingBox())!;
  if (wide) {
    // Beside the actions: the book keeps its height.
    expect(Math.abs(quickBox.y + quickBox.height / 2 - (actionBox.y + actionBox.height / 2))).toBeLessThanOrEqual(1);
    expect(slotAfter.height).toBe(slotBefore.height);
  } else {
    // Above the actions: the book gives up exactly the bar and its gap.
    expect(quickBox.y + quickBox.height).toBeLessThanOrEqual(actionBox.y);
    expect(slotBefore.height - slotAfter.height).toBeCloseTo(quickBox.height + 6, 0);
  }
  if (!mobile) {
    // The row shows no scrollbar, so an ordinary mouse wheel scrolls it sideways when it overflows.
    const row = quickBar.locator(".sw-quickbar-list");
    await row.evaluate((element) => {
      element.style.maxWidth = "40px";
    });
    await row.hover();
    await page.mouse.wheel(0, 120);
    await expect.poll(() => row.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    // A wheel that counts lines, as Firefox's does (deltaMode 1, three lines a notch), moves it as far.
    const lines = await row.evaluate((element) => {
      element.scrollLeft = 0;
      element.dispatchEvent(new WheelEvent("wheel", { deltaY: 3, deltaMode: 1, bubbles: true, cancelable: true }));
      return { moved: element.scrollLeft, room: element.scrollWidth - element.clientWidth };
    });
    // Three lines are ~48px, not 3: the row moves as far as it can go, up to that (Dottore on #2160).
    expect(lines.room).toBeGreaterThan(10);
    expect(lines.moved).toBeGreaterThanOrEqual(Math.min(40, lines.room));
    await row.evaluate((element) => {
      element.style.maxWidth = "";
    });
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath("03b-quick-replies.png") });

  // A quick reply writes the next chapter with its instruction in place of the continue message, after the note.
  let release = () => {};
  hold = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  const pour = quickBar.getByRole("button", { name: "Pour" });
  await pour.click();
  await expect.poll(() => generations.length).toBe(2);
  // Mid-run the chips wait, and the bar stays put so the book does not re-paginate.
  await expect(pour).toBeDisabled();
  await expect(quickBar).toBeVisible();
  release();
  hold = null;
  const writeNext = root.getByRole("button", { name: "Write next chapter" });
  await expect(writeNext).toBeEnabled({ timeout: 30_000 });
  expect((generations[1]!.messages as unknown[]).slice(-2)).toEqual([
    { role: "user", content: "Make it rain." },
    { role: "user", content: "Make it pour." },
  ]);
  const requests = async () => (await storyChapters()).map((chapter: { request: string }) => chapter.request);
  expect(await requests()).toEqual(["", "Make it pour."]);
  const poured = await engineRequest(request, base, "GET", `/story-writer/stories/${fresh.story.id}`);
  expect(poured.story.settings.continueMessage).toBe("Continue.");

  // Rewriting that chapter asks for the same thing again.
  await root.getByRole("button", { name: "Rewrite the last chapter" }).click();
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect.poll(() => generations.length).toBe(3);
  await expect(writeNext).toBeEnabled({ timeout: 30_000 });
  expect((generations[2]!.messages as unknown[]).at(-1)).toEqual({ role: "user", content: "Make it pour." });
  expect(await requests()).toEqual(["", "Make it pour."]);

  // "Edit quick replies" opens the section; "Show quick replies" hides the bar and gives the room back.
  await quickBar.getByRole("button", { name: "Edit quick replies" }).click();
  const showQuick = root.getByRole("button", { name: /^Show quick replies/ });
  await expect(showQuick).toBeInViewport();
  await showQuick.click();
  await expect(root.locator(".sw-quickbar")).toHaveCount(0);
  await expect.poll(async () => (await root.locator(".sw-reader-slot").boundingBox())!.height).toBe(slotBefore.height);
  await showQuick.click();
  await expect(quickBar).toBeVisible();
  await root.getByRole("button", { name: "Hide story settings" }).click();

  // Appearance: dark book, then the e-book, from the sidebar.
  await root.getByRole("button", { name: "Show story settings" }).click();
  await root.getByRole("button", { name: "Appearance" }).click();
  await root.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(root).toHaveAttribute("data-sw-mode", "dark");
  await page.screenshot({ path: testInfo.outputPath("04-sidebar-dark.png") });
  await root.getByRole("button", { name: "Hide story settings" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath("05-book-dark.png") });
  await root.getByRole("button", { name: "Show story settings" }).click();
  await root.getByRole("button", { name: "E-book", exact: true }).click();
  await expect(root).toHaveAttribute("data-sw-theme", "ebook");
  await root.getByRole("button", { name: "Hide story settings" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath("06-ebook-dark.png") });
  await root.getByRole("button", { name: "Show story settings" }).click();
  await root.getByRole("button", { name: "Light", exact: true }).click();
  await root.getByRole("button", { name: "Book", exact: true }).click();
  await root.getByRole("button", { name: "Hide story settings" }).click();

  // The library: start a new story, then come back to this one.
  await root.getByRole("button", { name: "Your stories" }).click();
  const list = root.getByRole("list", { name: "Your stories" });
  await expect(list).toBeVisible();
  await expect(list).toBeInViewport();
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath("07-library.png") });

  const downloadPromise = page.waitForEvent("download");
  await root.getByRole("button", { name: "Download the story as Markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  expect(readFileSync((await download.path())!, "utf8")).toContain(OPENING);

  await root.getByRole("button", { name: "New story" }).click();
  await expect(root.locator(".sw-title-text")).toContainText("Untitled");
  await expect(root.getByRole("button", { name: "Write next chapter" })).toBeVisible();
  await root.getByRole("button", { name: "Your stories" }).click();
  await list.getByRole("button", { name: /The Long Walk Home/ }).click();
  await expect(root.locator(".sw-title-text")).toContainText("The Long Walk Home");
  await expect(root.locator(".sw-body").first()).toContainText(OPENING);

  // Edit connection opens the Engine's editor and comes back to this tab when it closes.
  const show = root.getByRole("button", { name: "Show story settings" });
  if (await show.isVisible()) await show.click();
  const writing = root.getByRole("button", { name: "Writing" });
  if ((await writing.getAttribute("aria-expanded")) !== "true") await writing.click();
  await root.getByRole("button", { name: "Edit connection" }).click();
  await expect
    .poll(() => page.evaluate(() => (globalThis as any).__MARINARA_HOST__.stores.ui.getState().connectionDetailId))
    .toBe(connection.id);
  await page.evaluate(() => (globalThis as any).__MARINARA_HOST__.stores.ui.getState().closeConnectionDetail());
  await expect(page.getByRole("tab", { name: "Open Story Writer" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("marinara-capability-story-writer .sw-root")).toBeVisible();

  if (mobile) {
    // Landscape phones get the two-page spread. iPhones report the camera inset on both sides.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { left: 59, right: 59, bottom: 21 } });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator("marinara-capability-story-writer .sw-reader")).toHaveAttribute("data-pps", "2");
    // The sticky note never covers the upright action bar's Write button.
    const host = page.locator("marinara-capability-story-writer");
    if (await host.locator(".sw-drawer[data-open='true']").count()) {
      await host.getByRole("button", { name: "Hide story settings" }).click();
    }
    // The Engine shell already keeps Home clear of the camera, so a closed drawer leaves only its handle.
    const hostBox = await host.boundingBox();
    await expect
      .poll(async () => {
        const drawer = await host.locator(".sw-drawer").boundingBox();
        return drawer ? Math.round(drawer.x + drawer.width - hostBox!.x) : null;
      })
      .toBeLessThanOrEqual(0);
    await expect
      .poll(() => host.locator(".sw-drawer-panel").evaluate((panel) => getComputedStyle(panel).boxShadow))
      .toBe("none");
    const note = (await host.locator(".sw-note-collapsed").boundingBox())!;
    const writeButton = (await host.locator(".sw-action-primary").boundingBox())!;
    expect(overlaps(note, writeButton)).toBe(false);
    // The chapter bar in the top band and the quick replies at the bottom keep clear of the note, the upright
    // actions and the book.
    const box = async (selector: string) => (await host.locator(selector).boundingBox())!;
    expect(overlaps(await box(".sw-chapterbar"), note)).toBe(false);
    await expect
      .poll(async () => {
        const quick = await box(".sw-quickbar");
        return [note, await box(".sw-actionbar"), await box(".sw-book")].some((other) => overlaps(quick, other));
      })
      .toBe(false);
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath("08-landscape.png") });
  }
});
