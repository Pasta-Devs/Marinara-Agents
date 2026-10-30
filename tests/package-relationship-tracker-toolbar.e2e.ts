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
    if (request.isNavigationRequest()) return route.fulfill({ contentType: "text/html", body: "<main></main>" });
    return route.fulfill({ json: { configured: false, characters: [], relationships: [], persona: null } });
  });
  await page.goto("http://tracker.test/");
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
  expect(writes).toEqual([]);
});
