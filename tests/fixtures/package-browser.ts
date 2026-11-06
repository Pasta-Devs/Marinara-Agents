// The package browser suites' `test`: Playwright's own, plus an automatic fixture that tells the page no Agent update
// is waiting, so "Agent updates available" never opens over a test.
//
// The runner declines the updates the live catalog offers when it starts (scripts/install-package-browser-fixture.mjs
// declineLiveUpdates), but a package published while a suite runs was offered from then on, and its modal covered the
// page: on 2026-11-06 Otome Hearth 0.9.0 merged during its own mobile run, and every test after it timed out clicking
// under the modal until the job's hour ran out. No package suite tests that dialog.
// ponytail: only the suites that import this get it (the Otome Hearth ones). The upgrade path is every package suite
// importing `test` from here.
import { test as base } from "@playwright/test";

export * from "@playwright/test";

export const test = base.extend<{ noAgentUpdatePrompt: void }>({
  noAgentUpdatePrompt: [
    async ({ page }, use) => {
      await page.route("**/api/capability-packages/updates/pending", (route) => route.fulfill({ json: [] }));
      await use();
    },
    { auto: true },
  ],
});
