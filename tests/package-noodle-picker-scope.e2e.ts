// Noodle's sticker, emoji and poll pickers open inside Noodle's own element (or the layer of the dialog they sit in),
// where Noodle's stylesheet applies. On document.body they were see-through and still showed the chat-only
// "Selection preferences" settings, which have no chat to change in Noodle (Pasta-Devs/Marinara-Agents#1487, D5).
// Run: node scripts/run-package-browser-tests.mjs noodle tests/package-noodle-picker-scope.e2e.ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("MARINARA_ENGINE_ROOT is required");
const APP_VERSION = (JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")) as { version: string })
  .version;
const NOODLE_SCOPE = 'marinara-capability-noodle, [data-marinara-capability-scope="noodle"]';
const SELECTION_PREFERENCES = 'button[title="Selection preferences"], button[aria-label="Selection preferences"]';

/** The open picker: its chat-only settings button is rendered, hidden, and inside Noodle's scope; the panel is opaque. */
async function expectScopedPicker(page: Page, tab: Locator) {
  await tab.click();
  const buttons = page.locator(SELECTION_PREFERENCES);
  await expect(buttons.first()).toBeAttached();
  await expect(page.locator(`:is(${SELECTION_PREFERENCES}):visible`)).toHaveCount(0);
  const placement = await buttons.first().evaluate((button, scope) => {
    let panel: Element | null = button;
    // The picker panel is the nearest ancestor with its own background (the rounded card around the tabs).
    while (panel && getComputedStyle(panel).backgroundColor.replace(/\s/gu, "") === "rgba(0,0,0,0)")
      panel = panel.parentElement;
    // A popover narrower than the picker scrolled it sideways when a tab took focus, cutting off its left edge.
    let shifted = false;
    for (let node: Element | null = button; node && node !== document.body; node = node.parentElement)
      shifted ||= node.scrollLeft > 0;
    return {
      inScope: Boolean(button.closest(scope)),
      opaquePanel: Boolean(panel && panel !== document.body),
      shifted,
    };
  }, NOODLE_SCOPE);
  expect(placement).toEqual({ inScope: true, opaquePanel: true, shifted: false });
}

test.beforeEach(async ({ page }) => {
  expect((await page.request.put("/api/app-settings/ui", { data: { value: "" } })).ok()).toBeTruthy();
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    if (localStorage.getItem("marinara-engine-ui")) return;
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
        version: 65,
      }),
    );
  }, APP_VERSION);
});

test("Noodle pickers hide the chat-only emoji settings and keep Noodle's styles", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const persona = (await (
    await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Picker Tester", description: "Temporary browser regression persona." },
    })
  ).json()) as { id: string };
  await page.addInitScript((personaId) => {
    if (!localStorage.getItem("marinara:noodle:ui"))
      localStorage.setItem("marinara:noodle:ui", JSON.stringify({ noodleSelectedPersonaId: personaId }));
  }, persona.id);
  let postId: string | null = null;
  try {
    // The first request after the server starts can arrive before Noodle's routes are registered.
    await expect(async () => {
      const post = await page.request.post("/api/noodle/posts", {
        data: { authorKind: "character", authorEntityId: "__professor_mari__", content: `Picker scope ${Date.now()}` },
      });
      expect(post.ok(), `${post.status()} ${await post.text()}`).toBe(true);
      postId = ((await post.json()) as { id: string }).id;
    }).toPass({ timeout: 30_000 });

    await page.goto("/");
    await page.getByRole("tab", { name: "Open Noodle" }).click();
    const noodle = page.locator('[data-component="NoodleView"]');
    await expect(noodle).toBeVisible();
    const welcome = page.getByRole("dialog", { name: "Welcome to Noodle" });
    if (
      await welcome.waitFor({ state: "visible", timeout: 2_000 }).then(
        () => true,
        () => false,
      )
    )
      await welcome.getByRole("button", { name: "Start reading" }).click();

    // The post composer: inline on a desktop, the "New post" dialog on a phone.
    const phone = testInfo.project.name.includes("mobile");
    let composer: Locator;
    if (phone) {
      await noodle
        .locator('[data-component="NoodleView.MobileBottomNav"]')
        .getByRole("button", { name: "Open Noodle account menu" })
        .click();
      await page
        .getByRole("dialog", { name: "Noodle account menu" })
        .getByRole("button", { name: "Post", exact: true })
        .click();
      composer = page.locator('[data-component="NoodleView.ModalComposer"]');
    } else {
      composer = noodle.locator('[data-component="NoodleView.InlineComposer"]');
    }
    await expect(composer).toBeVisible();
    await composer.getByTitle("Emoji, GIFs and stickers").click();
    await expectScopedPicker(page, page.getByRole("button", { name: "Stickers", exact: true }));
    await page.screenshot({ path: testInfo.outputPath("composer-stickers.png") });
    await composer.getByTitle("Emoji, GIFs and stickers").click();

    // The poll's answer emoji picker (its custom emoji tab carries the same settings button).
    await composer.getByTitle("Create poll").click();
    await page.getByRole("button", { name: /^Choose emoji for answer 1$/u }).click();
    await expectScopedPicker(page, page.getByRole("button", { name: "Custom emojis", exact: true }));
    await page.screenshot({ path: testInfo.outputPath("poll-custom-emojis.png") });
    await page.getByRole("button", { name: /^Choose emoji for answer 1$/u }).click();
    await page.getByRole("button", { name: "Close poll editor", exact: true }).click();
    if (phone) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("heading", { name: "New post" })).toBeHidden();
    }

    // A comment's reply composer.
    const card = noodle.locator(`[data-noodle-post-id="${postId}"]`).first();
    await card.getByTitle("Reply").first().click();
    const reply = card.locator('[data-component="NoodleView.ReplyComposer"]');
    await expect(reply).toBeVisible();
    await reply.getByTitle("Emoji, GIFs and stickers").click();
    await expectScopedPicker(page, page.getByRole("button", { name: "Stickers", exact: true }));
    await page.screenshot({ path: testInfo.outputPath("reply-stickers.png") });
    expect(errors).toEqual([]);
  } finally {
    if (postId) await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    await page.request.delete(`/api/characters/personas/${persona.id}`, { timeout: 5_000 }).catch(() => undefined);
  }
});
