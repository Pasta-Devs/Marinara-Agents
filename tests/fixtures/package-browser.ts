// The package browser suites' `test`: Playwright's own, plus an automatic fixture that tells the page no Agent update
// is waiting, so "Agent updates available" never opens over a test.
//
// The runner declines the updates the live catalog offers when it starts (scripts/install-package-browser-fixture.mjs
// declineLiveUpdates), but a package published while a suite runs was offered from then on, and its modal covered the
// page: on 2026-11-06 Otome Hearth 0.9.0 merged during its own mobile run, and every test after it timed out clicking
// under the modal until the job's hour ran out. No package suite tests that dialog.
//
// A second automatic fixture keeps the browser's own fullscreen from starting. Since Engine #9376 a Home package's
// fullscreen also asks for the browser's (document.documentElement.requestFullscreen), and Playwright cannot resize a
// fullscreen window ("To resize minimized/maximized/fullscreen window, restore it to normal state first"), so every
// suite that enters a package's fullscreen and then resizes failed. The request resolves without entering it, as a
// browser that refuses would leave it; the Engine's own suite (e2e/home-browser-fullscreen.e2e.ts) proves the real one.
// A third keeps the Engine's Chibi Professor Mari surprise off. While it is on, every scroll can roll it, and its toast
// covers the top of the page: on 2026-11-25 it opened over the reader during #2481's mobile run, and the Background
// chip's reach check (package-otome-forge-reader.e2e.ts, #2147) found the toast 9px above and below the chip. Suites
// seed the Engine's saved UI state without that setting, so any seed that leaves it out is saved with it off; a suite
// that sets it keeps its own value.
// ponytail: only the suites that import this get it (the Otome Hearth ones and the Gacha Forge ones that enter
// fullscreen). The upgrade path is every package suite importing `test` from here.
import { test as base } from "@playwright/test";

export * from "@playwright/test";

export const test = base.extend<{ noAgentUpdatePrompt: void; noBrowserFullscreen: void; noChibiMari: void }>({
  noAgentUpdatePrompt: [
    async ({ page }, use) => {
      await page.route("**/api/capability-packages/updates/pending", (route) => route.fulfill({ json: [] }));
      await use();
    },
    { auto: true },
  ],
  noBrowserFullscreen: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        Element.prototype.requestFullscreen = () => Promise.resolve();
      });
      await use();
    },
    { auto: true },
  ],
  noChibiMari: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key: string, value: string) {
          if (key === "marinara-engine-ui") {
            try {
              const saved = JSON.parse(value);
              if (saved?.state && saved.state.chibiProfessorMariEnabled === undefined) {
                value = JSON.stringify({ ...saved, state: { ...saved.state, chibiProfessorMariEnabled: false } });
              }
            } catch {
              // Not the Engine's JSON: saved as given.
            }
          }
          setItem.call(this, key, value);
        };
      });
      await use();
    },
    { auto: true },
  ],
});
