// Install the real package fixture before running: the host supplies mobileCompact and owns the desktop drawer.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to the package-browser Engine checkout");
const version = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const uiVersion = Number(
  /version: (\d+)/u.exec(readFileSync(resolve(engineRoot, "packages/client/src/lib/ui-persistence.ts"), "utf8"))?.[1],
);
if (!uiVersion) throw new Error("The Engine UI persistence version is required");

test("Relationship Tracker installed package opens through the actual Roleplay phone toolbar and desktop drawer", async ({
  page,
  request,
}, info) => {
  test.setTimeout(60_000);
  const installed = await request.get("/api/capability-packages/installed");
  expect(installed.ok()).toBeTruthy();
  expect((await installed.json()).find((entry: { id: string }) => entry.id === "relationship-tracker")).toMatchObject({
    status: "active",
    version: "0.7.3",
  });
  const created = await request.post("/api/chats", {
    data: { name: "Relationship phone proof", mode: "roleplay", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = await created.json();
  try {
    const enabled = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: true, activeAgentIds: ["relationship-tracker"] },
    });
    expect(enabled.ok()).toBeTruthy();
    await page.route("**/api/app-settings/ui", (route) =>
      route.fulfill({ json: route.request().method() === "GET" ? { value: "" } : { success: true } }),
    );
    const writes: string[] = [];
    await page.route("**/api/relationship-tracker/**", (route) => {
      if (route.request().method() !== "GET") writes.push(route.request().url());
      return route.fulfill({
        json: {
          configured: false,
          characters: [
            { characterId: "card-kai", name: "Kai" },
            { characterId: "card-mira", name: "Mira" },
          ],
          relationships: [
            {
              characterAId: "card-kai",
              characterBId: "card-mira",
              state: "defined",
              label: "Kai trusts Mira",
              description: "They work together",
              colorCategory: "positive",
              manuallyLocked: false,
            },
          ],
          persona: null,
        },
      });
    });
    await page.addLocatorHandler(
      page
        .getByRole("dialog", { name: "Happy Halloween!", exact: true })
        .filter({ has: page.getByRole("button", { name: "Keep it", exact: true }) }),
      async (dialog) => {
        await dialog.getByRole("button", { name: "Keep it", exact: true }).click();
      },
    );
    await page.addInitScript(
      ({ chatId, appVersion, persistenceVersion }) => {
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            state: {
              hasCompletedOnboarding: true,
              sidebarOpen: false,
              rightPanelOpen: false,
              trackerPanelEnabled: false,
              chatHelpSeenModes: ["roleplay"],
              chatWindowIntroDismissed: true,
              chatSettingsMoveTipDismissed: true,
              chibiProfessorMariEnabled: false,
              appAccentPulseMode: false,
            },
            version: persistenceVersion,
          }),
        );
      },
      { chatId: chat.id, appVersion: version, persistenceVersion: uiVersion },
    );
    await page.goto("/");
    await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
    if (info.project.name.includes("mobile")) {
      const opener = page.getByRole("button", { name: "Relationship Tracker", exact: true });
      await opener.click();
      const sheet = page.getByRole("dialog", { name: "Relationship Tracker", exact: true });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText("All relationships", { exact: true })).toBeVisible();
      await expect(
        sheet.getByRole("img", { name: "Relationship web with 2 characters and 1 defined relationships", exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: info.outputPath("relationship-phone-sheet.png") });
      await sheet.getByRole("button", { name: "Close Relationship Tracker", exact: true }).click();
      await expect(sheet).not.toBeVisible();
      await expect(opener).toBeFocused();
    } else {
      await page.locator('.mari-window-bubble[data-window="trackers"]').click();
      const window = page.locator('.mari-window[data-window="trackers"]');
      const drawer = window.getByRole("button", { name: "Relationship Tracker", exact: true });
      // Host drawers default open. Start this interaction closed rather than accidentally closing the web.
      if ((await drawer.getAttribute("aria-expanded")) === "true") await drawer.click();
      await expect(drawer).toHaveAttribute("aria-expanded", "false");
      await expect(window.getByText("All relationships", { exact: true })).not.toBeVisible();
      await drawer.click();
      await expect(drawer).toHaveAttribute("aria-expanded", "true");
      await expect(window.getByText("All relationships", { exact: true })).toBeVisible();
      await expect(
        window.getByRole("img", {
          name: "Relationship web with 2 characters and 1 defined relationships",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole("dialog", { name: "Relationship Tracker", exact: true })).toHaveCount(0);
      await page.screenshot({ path: info.outputPath("relationship-desktop-drawer.png") });
    }
    expect(writes).toEqual([]);
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
