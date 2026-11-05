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
  await page.mouse.click(1, 1);
  await expect(sheet).not.toBeVisible();
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

for (const failure of ["missing-show", "throwing-show", "throwing-close"] as const) {
  test(`Relationship Tracker recovers from ${failure} without leaving a dialog or polling behind`, async ({ page }) => {
    const errors: string[] = [];
    const statusReads: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://tracker.test/**", (route) => {
      if (route.request().isNavigationRequest())
        return route.fulfill({
          contentType: "text/html",
          body: '<meta name="viewport" content="width=device-width,initial-scale=1"><main></main>',
        });
      if (new URL(route.request().url()).pathname.endsWith("/status")) {
        statusReads.push(route.request().url());
        return route.fulfill({ json: { processing: false, completedRevision: 0 } });
      }
      return route.fulfill({ json: { configured: false, characters: [], relationships: [], persona: null } });
    });
    await page.goto("http://tracker.test/");
    await page.clock.install();
    await page.addScriptTag({ content: client });
    await page.evaluate((name) => {
      const element = document.createElement(name) as HTMLElement & { capabilityProps: unknown };
      element.setAttribute("view", "toolbar");
      element.capabilityProps = { chatId: "chat-fault", mobileCompact: true, toolbarButtonClass: "host-button" };
      document.querySelector("main")!.append(element);
    }, tag);
    const opener = page.getByRole("button", { name: "Relationship Tracker", exact: true });
    if (failure === "throwing-close") {
      await opener.click();
      await expect(page.getByRole("dialog", { name: "Relationship Tracker", exact: true })).toBeVisible();
      await expect.poll(() => statusReads.length).toBe(1);
    }
    await page.evaluate((mode) => {
      const method = mode === "throwing-close" ? "close" : "showModal";
      const descriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method)!;
      (globalThis as any).restoreTrackerModal = () =>
        Object.defineProperty(HTMLDialogElement.prototype, method, descriptor);
      Object.defineProperty(HTMLDialogElement.prototype, method, {
        configurable: true,
        writable: true,
        value:
          mode === "missing-show"
            ? undefined
            : () => {
                throw new DOMException("Fixture modal failure", "InvalidStateError");
              },
      });
    }, failure);
    const readsBefore = statusReads.length;
    if (failure === "throwing-close")
      await page.getByRole("button", { name: "Close Relationship Tracker", exact: true }).click();
    else await opener.click();
    await expect(opener).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("dialog")).toHaveCount(0);
    await expect(page.locator(`${tag}[view="tracker"]`)).toHaveCount(0);
    await page.clock.runFor(5_000);
    expect(statusReads).toHaveLength(readsBefore);
    expect(errors).toEqual([]);
    await page.evaluate(() => (globalThis as any).restoreTrackerModal());
    await opener.click();
    const sheet = page.getByRole("dialog", { name: "Relationship Tracker", exact: true });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("All relationships", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Close Relationship Tracker", exact: true }).click();
    await expect(opener).toBeFocused();
    expect(errors).toEqual([]);
  });
}
