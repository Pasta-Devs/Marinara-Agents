import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot = process.env.MARINARA_ENGINE_ROOT!;
const version = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

test("Beholder slots expose keyboard editing and visible focus", async ({ page, request }, info) => {
  const { UI_PERSISTENCE } = await import(
    pathToFileURL(resolve(engineRoot, "packages/client/src/lib/ui-persistence.ts")).href
  );
  const characterResponse = await request.post("/api/characters", {
    data: { data: { name: "Maggie", first_mes: "" } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = await characterResponse.json();
  let chatId = "";
  try {
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Beholder keyboard proof", mode: "roleplay", characterIds: [character.id] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    chatId = (await chatResponse.json()).id;
    expect(
      (
        await request.patch(`/api/chats/${chatId}/metadata`, {
          data: { enableAgents: true, activeAgentIds: ["beholder"] },
        })
      ).ok(),
    ).toBeTruthy();
    // Supply a prior extraction; this proof exercises the installed keyboard UI without a provider call.
    await page.route(`**/api/agents/beholder-state/${chatId}`, (route) =>
      route.fulfill({
        json: {
          state: {
            characters: [
              {
                name: "Maggie",
                species: "human",
                body: {
                  chest: { worn: [{ item: "coat", damage: "broken" }] },
                  head: { wounds: [{ text: "cut", severity: "serious", bleeding: false }] },
                },
              },
            ],
          },
        },
      }),
    );
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.addInitScript(
      ({ chatId, version, persistence }) => {
        localStorage.setItem("marinara:whats-new:seen-version", version);
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem(
          persistence.name,
          JSON.stringify({
            version: persistence.version,
            state: {
              hasCompletedOnboarding: true,
              sidebarOpen: false,
              rightPanelOpen: false,
              chatHelpSeenModes: ["roleplay"],
              chibiProfessorMariEnabled: false,
            },
          }),
        );
      },
      { chatId, version, persistence: UI_PERSISTENCE },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Beholder", exact: true }).filter({ visible: true }).first().click();
    const panel = page.locator(".beholder-panel");
    await expect(panel).toBeVisible();
    const card = panel.locator('.bh-slot-card[data-slot="chest"]').filter({ visible: true });
    await expect(card).toHaveAccessibleName(/chest.*coat/i);
    await expect(card).toHaveAttribute("role", "button");
    await card.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    for (const key of ["Enter", "Space"]) {
      await card.focus();
      await expect(card).toBeFocused();
      const focusStyle = await card.evaluate((el) => ({
        width: Number.parseFloat(getComputedStyle(el).outlineWidth),
        style: getComputedStyle(el).outlineStyle,
        opacity: getComputedStyle(el).opacity,
      }));
      expect(focusStyle.width).toBeGreaterThanOrEqual(2);
      expect(focusStyle.style).not.toBe("none");
      expect(focusStyle.opacity).toBe("1");
      await page.keyboard.press(key);
      const editor = panel.getByRole("dialog", { name: "Edit chest" });
      await expect(editor).toBeVisible();
      await expect(editor.locator(".bhe-item").first()).toHaveValue("coat");
      await expect(editor.locator(":focus")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(editor).toHaveCount(0);
      await expect(card).toBeFocused();
    }

    await info.attach("Beholder keyboard controls", { body: await panel.screenshot(), contentType: "image/png" });
  } finally {
    await page.close();
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`);
    await request.delete(`/api/characters/${character.id}`);
  }
});
