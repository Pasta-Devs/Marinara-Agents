// Exercise the shipped custom element with the same mobileCompact contract used by RoleplayHUD.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const client = readFileSync(resolve("packages/relationship-tracker/client.js"), "utf8");
const tag = "marinara-capability-relationship-tracker";

test("Relationship Tracker phone toolbar opens its web and restores focus without running a model", async ({
  page,
}) => {
  const writes: string[] = [];
  await page.route("http://tracker.test/**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") writes.push(request.url());
    if (request.isNavigationRequest())
      return route.fulfill({
        contentType: "text/html",
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><main></main>',
      });
    return route.fulfill({ json: { configured: false, characters: [], relationships: [], persona: null } });
  });
  await page.goto("http://tracker.test/");
  await page.evaluate(() => localStorage.setItem("marinara.relationship-tracker.trackerPanelCollapsed", "true"));
  await page.addScriptTag({ content: client });
  await page.evaluate((name) => {
    const element = document.createElement(name) as HTMLElement & { capabilityProps: unknown };
    element.setAttribute("view", "toolbar");
    element.capabilityProps = { chatId: "chat-phone", mobileCompact: true, toolbarButtonClass: "host-button" };
    document.querySelector("main")!.append(element);
  }, tag);
  const opener = page.getByRole("button", { name: "Relationship Tracker", exact: true });
  await opener.click();
  const sheet = page.getByRole("dialog", { name: "Relationship Tracker", exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("All relationships", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(opener).toBeFocused();
  await opener.click();
  await page.getByRole("button", { name: "Close Relationship Tracker", exact: true }).click();
  await expect(opener).toBeFocused();
  await opener.click();
  await page.evaluate((name) => {
    const element = document.querySelector(name) as HTMLElement & { capabilityProps: Record<string, unknown> };
    element.capabilityProps = { ...element.capabilityProps, chatId: "chat-new" };
  }, tag);
  await expect(sheet).not.toBeVisible();
  await opener.click();
  await expect(sheet).toBeVisible();
  const bounds = await sheet.boundingBox();
  expect(bounds).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  await page.evaluate((name) => document.querySelector(name)!.remove(), tag);
  await expect(sheet).not.toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("Relationship Tracker desktop miniature stays passive inside its host drawer", async ({ page }) => {
  await page.setContent('<button id="host" type="button">Open host drawer</button>');
  await page.addScriptTag({ content: client });
  await page.evaluate((name) => {
    const element = document.createElement(name) as HTMLElement & { capabilityProps: unknown };
    element.setAttribute("view", "toolbar");
    element.capabilityProps = { mobileCompact: false, toolbarButtonClass: "host-button" };
    document.querySelector("#host")!.append(element);
  }, tag);
  await expect(page.getByRole("img", { name: "Relationship Tracker", exact: true })).toBeVisible();
  await expect(page.locator(tag).getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
