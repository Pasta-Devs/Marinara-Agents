// Every agent at once (Pasta-Devs/Marinara-Agents#1487): with the rebuilt packages and the prebuilt ones installed into
// one Engine, a page load leaves the Engine's browser storage to the Engine, every package renders with the Engine's one
// React, there is one toaster, and Escape closes only the topmost dialog. Bundled store copies used to reset
// `marinara-engine-ui` (#1478) and write the active chat and drafts on load.
// Run: MARINARA_PACKAGE_IDS=<comma list> node scripts/run-package-browser-tests.mjs noodle tests/package-all-agents.e2e.ts
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot = process.env.MARINARA_ENGINE_ROOT!;
const packageIds = [
  ...new Set(
    [process.env.MARINARA_PACKAGE_ID ?? "", ...String(process.env.MARINARA_PACKAGE_IDS ?? "").split(",")]
      .map((id) => id.trim())
      .filter(Boolean),
  ),
];
const clientPackageIds = packageIds.filter(
  (id) =>
    (
      JSON.parse(readFileSync(resolve("packages", id, "manifest.json"), "utf8")) as {
        entrypoints: { client?: string };
      }
    ).entrypoints.client,
);
const version = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version as string;
/** Browser storage only the Engine may write (Engine docs, "Host client namespace"). */
const ENGINE_KEYS = [
  "marinara-engine-ui",
  "marinara-engine-ui:host",
  "marinara-active-chat-id",
  "marinara-input-drafts",
  "marinara-pending-spatial-transitions",
  "marinara-pinned-gallery-images",
  "marinara_sidecar_prompted",
];

test.skip(packageIds.length < 2, "runs with MARINARA_PACKAGE_IDS");

type StorageWrite = { method: string; key: string; caller: string };
type HostWindow = {
  __storageWrites?: StorageWrite[];
  __MARINARA_HOST__?: {
    version: number;
    stores: { ui: { getState: () => { openModal: (type: string) => void } } };
    services: { dialogs: { showConfirmDialog: (options: Record<string, unknown>) => Promise<boolean> } };
    modules: { sonner: { toast: (message: string) => unknown } };
  };
};

async function savedUI(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("marinara-engine-ui") ?? "null"));
}

test("all agents installed: the Engine keeps its storage, React, toaster and dialog order", async ({ page }) => {
  test.setTimeout(240_000);
  const { UI_PERSISTENCE } = await import(
    pathToFileURL(resolve(engineRoot, "packages/client/src/lib/ui-persistence.ts")).href
  );
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.addInitScript(
    ({ version, persistence }) => {
      // Who calls setItem/removeItem: the first stack frame outside this wrapper.
      const writes: StorageWrite[] = [];
      (window as HostWindow).__storageWrites = writes;
      for (const method of ["setItem", "removeItem"] as const) {
        const original = Storage.prototype[method] as (...args: unknown[]) => unknown;
        Storage.prototype[method] = function __marinaraStorageWrite(this: Storage, ...args: unknown[]) {
          const frames = String(new Error().stack ?? "")
            .split("\n")
            .slice(1)
            .filter((line) => !line.includes("__marinaraStorageWrite"));
          writes.push({ method, key: String(args[0]), caller: frames[0] ?? "" });
          return original.apply(this, args);
        } as never;
      }
      if (sessionStorage.getItem("all-agents-seeded")) return;
      sessionStorage.setItem("all-agents-seeded", "1");
      localStorage.setItem("marinara:whats-new:seen-version", version);
      // Noodle's first-run explainer would open late and race the dialog checks below.
      localStorage.setItem("marinara:noodle:intro-seen", "true");
      localStorage.setItem(
        persistence.name,
        JSON.stringify({
          version: persistence.version,
          state: {
            hasCompletedOnboarding: true,
            sidebarOpen: false,
            rightPanelOpen: false,
            chatWindowIntroDismissed: true,
            chibiProfessorMariEnabled: false,
            appAccentPulseMode: false,
          },
        }),
      );
      // The seed is this test's own write, not the Engine's: only writes after it count.
      writes.splice(0);
    },
    { version, persistence: UI_PERSISTENCE },
  );

  const writes: StorageWrite[] = [];
  const takeWrites = async () =>
    writes.push(...(await page.evaluate(() => (window as HostWindow).__storageWrites?.splice(0) ?? [])));
  // Every installed package client loads (each defines its custom element) over two reloads.
  for (let load = 0; load < 3; load += 1) {
    if (load === 0) await page.goto("/");
    else await page.reload();
    await expect
      .poll(
        () =>
          page.evaluate(
            (ids) => ids.filter((id) => !customElements.get(`marinara-capability-${id}`)),
            clientPackageIds,
          ),
        { timeout: 120_000, message: "package clients that did not load" },
      )
      .toEqual([]);
    // The Engine's own save, at the Engine's version, with the browser-only settings it was given.
    const saved = await savedUI(page);
    expect(saved?.version).toBe(UI_PERSISTENCE.version);
    expect(saved?.state?.chibiProfessorMariEnabled).toBe(false);
    expect(saved?.state?.appAccentPulseMode).toBe(false);
    await takeWrites();
  }

  // A package view renders with the Engine's React: every fiber key in the page has the host's suffix.
  await page.getByRole("tab", { name: "Open Noodle" }).click();
  await expect(page.locator('[data-component="NoodleView"]')).toBeVisible({ timeout: 60_000 });
  const fiberSuffixes = await page.evaluate(() => {
    const suffixes = new Set<string>();
    for (const element of document.querySelectorAll("*")) {
      for (const key of Object.keys(element)) if (key.startsWith("__reactFiber$")) suffixes.add(key.slice(13));
    }
    const inNoodle = Object.keys(document.querySelector('[data-component="NoodleView"]') ?? {}).some((key) =>
      key.startsWith("__reactFiber$"),
    );
    return { suffixes: [...suffixes], inNoodle };
  });
  expect(fiberSuffixes.inNoodle).toBe(true);
  expect(fiberSuffixes.suffixes).toHaveLength(1);

  // One toaster: a package toast lands in the Engine's.
  await page.evaluate(() => (window as HostWindow).__MARINARA_HOST__!.modules.sonner.toast("All agents loaded"));
  await expect(page.getByText("All agents loaded")).toBeVisible();
  await expect(page.locator("[data-sonner-toaster]")).toHaveCount(1);
  await expect(page.locator('section[aria-label^="Notifications"]')).toHaveCount(1);

  // Escape closes only the topmost dialog: a confirm opened over an Engine modal.
  await page.evaluate(() =>
    (window as HostWindow).__MARINARA_HOST__!.stores.ui.getState().openModal("keyboard-shortcuts"),
  );
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.evaluate(() => {
    void (window as HostWindow).__MARINARA_HOST__!.services.dialogs.showConfirmDialog({
      title: "Topmost",
      message: "Escape closes this one first.",
    });
  });
  await expect(page.getByRole("dialog")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("dialog").getByText("Escape closes this one first.")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // No package wrote or removed an Engine key itself, on any load or since.
  await takeWrites();
  const byPackages = writes.filter(
    (write) => ENGINE_KEYS.includes(write.key) && write.caller.includes("/api/capability-packages/"),
  );
  expect(byPackages).toEqual([]);
  // The attribution sees package frames: Noodle saves its own keys from its client.
  expect(
    writes.some(
      (write) => write.key.startsWith("marinara:noodle:") && write.caller.includes("/api/capability-packages/noodle/"),
    ),
  ).toBe(true);
  expect(writes.some((write) => write.key === "marinara-engine-ui")).toBe(true);
  expect(pageErrors).toEqual([]);
});
