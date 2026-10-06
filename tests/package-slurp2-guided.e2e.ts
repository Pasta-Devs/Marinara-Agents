import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Focused proof for persona Stir; the existing browser suites remain unchanged.
test("persona Stir previews a draft and opens Edit without losing it", async ({ page }, info) => {
  test.skip(!info.project.name.includes("desktop"), "All three widths use one isolated fixture.");
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  const engineVersion = JSON.parse(
    readFileSync(resolve(process.env.MARINARA_ENGINE_ROOT!, "package.json"), "utf8"),
  ).version;
  const slurpVersion = JSON.parse(readFileSync("packages/slurp2/manifest.json", "utf8")).version;
  const personaResponse = await page.request.post("/api/characters/personas", { data: { name: "Guided persona" } });
  expect(personaResponse.ok(), await personaResponse.text()).toBeTruthy();
  const persona = await personaResponse.json();
  const settings = await page.request.patch("/api/slurp2/settings", { data: { onboarding: "completed" } });
  expect(settings.ok(), await settings.text()).toBeTruthy();
  const response = await page.request.post(`/api/slurp2/accounts/${persona.id}/noodler`, {
    data: {
      stageProfile: {
        displayName: "Guided persona",
        handle: `guided_${Date.now()}`,
        bio: "A persona page",
        stagePersonality: "Friendly",
        disclosureMode: "open",
        gender: "other",
        tags: ["art", "gaming", "cosplay"],
      },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const profile = await response.json();
  await page.addInitScript(
    ({ personaId, accountId, engineVersion, slurpVersion }) => {
      localStorage.setItem("marinara:whats-new:seen-version", engineVersion);
      localStorage.setItem("slurp2:splash-seen-version", slurpVersion);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
          version: 65,
        }),
      );
      localStorage.setItem(
        "marinara:slurp2:package-ui",
        JSON.stringify({
          navigation: { mode: "creator", view: "profile", accountId },
          viewerPersonaId: personaId,
          onboardingState: "completed",
        }),
      );
    },
    { personaId: persona.id, accountId: profile.id, engineVersion, slurpVersion },
  );
  let finish: (() => void) | undefined;
  const image = `data:image/png;base64,${readFileSync("packages/slurp2/slurp2-logo.png").toString("base64")}`;
  await page.route("**/api/slurp2/slurp/actions/draft-post", async (route) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    await route.fulfill({ json: { text: "A quiet morning at the beach. ".repeat(12), image, imageError: null } });
  });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const tab = page.getByRole("tab", { name: "Open Slurp" });
    await expect(tab).toBeVisible();
    await tab.click();
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .locator("..")
      .getByRole("button", { name: "Stir", exact: true })
      .click();
    const sheet = page.getByRole("dialog", { name: "Stir", exact: true });
    await expect(sheet.getByRole("textbox", { name: "What do you want to post?" })).toBeVisible();
    await expect(sheet.locator("textarea")).toHaveCount(0);
    await expect(sheet.getByRole("checkbox", { name: "Generate an image with the draft" })).toBeChecked();
    await expect(sheet.getByRole("button", { name: "Upload an image", exact: true })).toBeVisible();
    await expect(sheet).toHaveCSS("opacity", "1");
    await page.screenshot({ path: info.outputPath(`guided-${width}-empty.png`) });
    await sheet.getByRole("textbox").fill("A quiet morning at the beach");
    await sheet.getByRole("button", { name: /Write it/u }).click();
    await expect(sheet.getByRole("button", { name: "Post", exact: true })).toBeDisabled();
    await expect.poll(() => Boolean(finish)).toBe(true);
    await page.screenshot({ path: info.outputPath(`guided-${width}-loading.png`) });
    finish!();
    finish = undefined;
    await expect(sheet.getByRole("img", { name: "Attached post image" })).toBeVisible();
    await expect
      .poll(() =>
        sheet
          .getByRole("img", { name: "Attached post image" })
          .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    await expect(sheet.getByRole("img", { name: "Attached post image" })).toHaveCSS("opacity", "1");
    await expect(sheet.locator("[data-slp-guided-preview]")).toContainText("A quiet morning");
    await expect(sheet.locator("textarea")).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Post", exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath(`guided-${width}-preview.png`) });
    await sheet.getByRole("button", { name: "Edit", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "New post", exact: true });
    await expect(editor.locator("textarea")).toHaveValue(/A quiet morning/u);
    await expect(editor.locator("img").last()).toBeVisible();
    await page.screenshot({ path: info.outputPath(`guided-${width}-edit.png`) });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const npcResponse = await page.request.post("/api/slurp2/accounts/__professor_mari__/noodler", {
    data: {
      stageProfile: {
        displayName: "NPC Creator",
        handle: `npc_${Date.now()}`,
        bio: "An NPC page",
        stagePersonality: "Friendly",
        disclosureMode: "open",
        gender: "female",
        tags: ["art", "gaming", "cosplay"],
      },
    },
  });
  expect(npcResponse.ok(), await npcResponse.text()).toBeTruthy();
  const npc = await npcResponse.json();
  await page.addInitScript(
    ({ accountId }) => {
      const state = JSON.parse(localStorage.getItem("marinara:slurp2:package-ui")!);
      state.navigation = { mode: "creator", view: "profile", accountId };
      localStorage.setItem("marinara:slurp2:package-ui", JSON.stringify(state));
    },
    { accountId: npc.id },
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Slurp" }).click();
  await page.getByRole("button", { name: "Stir NPC Creator", exact: true }).click();
  const npcStir = page.getByRole("dialog", { name: "Stir NPC Creator", exact: true });
  await npcStir.getByRole("button", { name: /Draft post/u }).click();
  const npcGuide = page.getByRole("dialog", { name: "Stir", exact: true });
  await expect(npcGuide.getByRole("textbox", { name: "What do you want to post?" })).toBeVisible();
  await expect(npcGuide.locator("textarea")).toHaveCount(0);
  await expect(npcGuide).toContainText("Post as NPC Creator");
  await expect(npcStir).toHaveCount(0);
  await expect(npcGuide).toHaveCSS("opacity", "1");
  const chooser = page.waitForEvent("filechooser");
  await npcGuide.getByRole("button", { name: "Upload an image", exact: true }).click();
  await (await chooser).setFiles("packages/slurp2/slurp2-logo.png");
  await expect(npcGuide.getByRole("img", { name: "Attached post image" })).toBeVisible();
  await expect(npcGuide.getByRole("checkbox", { name: "Generate an image with the draft" })).not.toBeChecked();
  await page.screenshot({ path: info.outputPath("guided-npc-1440-empty.png") });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
