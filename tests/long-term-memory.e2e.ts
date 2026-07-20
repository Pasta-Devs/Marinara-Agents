// Prerequisites: a provisioned Engine is already running with the locally rebuilt
// Long-Term Memory package installed and active. From ../Marinara-Engine run:
// pnpm exec playwright test -c ../Marinara-Agents/tests/long-term-memory.playwright.config.ts
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot =
  process.env.MARINARA_ENGINE_ROOT ?? join(process.cwd(), "..");
const playwright = await import(
  pathToFileURL(join(engineRoot, "node_modules/@playwright/test/index.js")).href
);
const { expect, test } = playwright.default;

const csrfHeaders = { "x-marinara-csrf": "1" };

async function dismissOnboardingTutorial(page: any) {
  const skip = page.getByRole("button", { name: "Skip Tutorial" });
  if (await skip.isVisible({ timeout: 3_000 }).catch(() => false))
    await skip.click();
}

async function dismissWhatsNew(page: any) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible({ timeout: 3_000 }).catch(() => false))
    await gotIt.click();
}

async function createChat(page: any, testInfo: any) {
  const name = `LTM E2E ${testInfo.project.name} ${Date.now()}`;
  const response = await page.request.post("/api/chats", {
    data: {
      name,
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return { ...((await response.json()) as { id: string }), name };
}

async function deleteChat(page: any, chatId: string) {
  const response = await page.request.delete(`/api/chats/${chatId}`);
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function deleteNotes(page: any, ids: string[]) {
  const response = await page.request.post(
    "/api/long-term-memory/notes/permanent-delete",
    {
      headers: csrfHeaders,
      data: { ids },
    },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function openLongTermMemory(page: any, chatId: string, testInfo: any) {
  await page.addInitScript((activeChatId) => {
    localStorage.setItem("marinara-active-chat-id", activeChatId);
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: {
          hasCompletedOnboarding: true,
          rightPanelOpen: false,
          sidebarOpen: false,
        },
        version: 75,
      }),
    );
  }, chatId);
  await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
  await page.goto("/");
  await dismissOnboardingTutorial(page);
  await dismissWhatsNew(page);

  await page.locator('[data-tour="panel-agents"]').click();
  const agentsPanel = page.locator(
    testInfo.project.name.includes("mobile")
      ? '[data-component="RightPanelMobile"]'
      : '[data-component="RightPanelDesktop"]',
  );
  const card = agentsPanel.locator('[data-agent-name="Long-Term Memory"]');
  await expect(card).toBeVisible();
  await card.getByText("Long-Term Memory", { exact: true }).click();
  await expect(page.locator('[data-ltm-surface="detail"]')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await expect
    .poll(
      async () => {
        const response = await page.request
          .get("/api/health")
          .catch(() => null);
        return response?.ok() ?? false;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
});

test("Long-Term Memory opens its default vault and exposes every navigation destination", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);

  try {
    await openLongTermMemory(page, chat.id, testInfo);

    const detail = page.locator('[data-ltm-surface="detail"]');
    await expect(
      detail.locator('nav[aria-label="Long-Term Memory sections"]'),
    ).toHaveCount(2);
    const navigation = detail.locator(
      'nav[aria-label="Long-Term Memory sections"]:visible',
    );
    await expect(navigation).toHaveCount(1);
    await expect(detail.locator('[data-ltm-surface="vault"]')).toBeVisible();
    await expect(detail.getByLabel("Choose memory scope")).toHaveValue(
      chat.name,
    );
    await detail.getByLabel("Choose memory scope").click();
    await expect(
      detail.getByRole("option", { name: "All memories" }),
    ).toBeVisible();
    await detail.getByRole("option", { name: "All memories" }).click();
    await expect(
      navigation.locator('[data-ltm-destination="vault"]'),
    ).toHaveAttribute("aria-current", "page");
    await expect(navigation.locator("[data-ltm-destination]")).toHaveCount(5);

    await navigation.locator('[data-ltm-destination="sources"]').click();
    const sources = detail.locator('[data-ltm-surface="sources"]');
    await expect(sources).toBeVisible();
    await expect(sources.locator('[data-ltm-source-tab="chats"]')).toHaveText(
      "Chat Summaries",
    );
    await expect(
      sources.locator('[data-ltm-source-tab="chats"]'),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      sources.locator('[data-ltm-source-section="available"]'),
    ).toBeVisible();
    await expect(
      sources.locator('[data-ltm-source-section="imported"]'),
    ).toBeVisible();
    await expect(
      sources.locator('[data-ltm-source-section-toggle="available"]'),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      sources.locator('[data-ltm-source-section-toggle="imported"]'),
    ).toHaveAttribute("aria-expanded", "false");
    await expect(
      sources.locator('[data-ltm-source-select-all="available"]'),
    ).toBeVisible();
    await sources
      .locator('[data-ltm-source-section-toggle="imported"]')
      .click();
    await expect(
      sources.locator('[data-ltm-source-select-all="imported"]'),
    ).toBeVisible();
    await expect(sources.locator('[data-ltm-transfer-include-derived]')).toBeChecked();

    await navigation.locator('[data-ltm-destination="settings"]').click();
    const settings = detail.locator('[data-ltm-surface="memory-settings"]');
    const recallTab = settings.getByRole("tab", { name: "Recall" });
    await expect(recallTab).toHaveAttribute("aria-selected", "true");
    await expect(settings.getByRole("tabpanel")).toHaveCount(1);
    await settings.getByRole("tab", { name: "Backup" }).click();
    await expect(
      settings.getByRole("heading", { name: "Backup and Reset" }),
    ).toBeVisible();
    await settings.getByRole("tab", { name: "Backup" }).press("ArrowRight");
    await expect(
      settings.getByRole("tab", { name: "Extraction" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() =>
        settings.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true);

    await navigation.locator('[data-ltm-destination="vault"]').click();
    await expect(detail.locator('[data-ltm-surface="vault"]')).toBeVisible();
    await expect(detail.getByLabel("Choose memory scope")).toHaveValue(
      "All memories",
    );
  } finally {
    await deleteChat(page, chat.id);
  }
});

test("Long-Term Memory preserves hidden selections for batch operations", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);
  const suffix = `${Date.now()}_${testInfo.project.name.replaceAll(/[^a-z0-9]+/giu, "_")}`;
  const timelineId = `timeline_e2e_${suffix}`;
  const worldId = `world_e2e_${suffix}`;
  const timelineTitle = `E2E timeline ${suffix}`;
  const timestamp = new Date().toISOString();

  try {
    for (const note of [
      {
        id: timelineId,
        title: timelineTitle,
        type: "timeline_event",
        sections: {
          event: {
            text: "A durable E2E timeline fixture.",
            updatedAt: timestamp,
          },
        },
      },
      {
        id: worldId,
        title: `E2E world ${suffix}`,
        type: "world",
        sections: {
          facts: { text: "A durable E2E world fixture.", updatedAt: timestamp },
        },
      },
    ]) {
      const response = await page.request.post("/api/long-term-memory/notes", {
        headers: csrfHeaders,
        data: {
          ...note,
          status: "active",
          modes: ["roleplay"],
          scope: { chatId: chat.id, chatIds: [chat.id] },
          tags: ["e2e_fixture"],
          keywords: ["e2e"],
          links: [],
        },
      });
      expect(response.status(), await response.text()).toBe(201);
    }

    await openLongTermMemory(page, chat.id, testInfo);
    const vault = page.locator('[data-ltm-surface="vault"]');
    await expect(vault).toBeVisible();
    await vault.getByLabel("Filter by type").selectOption("timeline_event");

    const timelineRow = vault
      .locator('[data-ltm-note-type="timeline_event"]')
      .filter({ hasText: timelineTitle });
    await expect(timelineRow).toBeVisible();
    await expect(timelineRow).toHaveAttribute(
      "data-ltm-note-type",
      "timeline_event",
    );
    if (testInfo.project.name.includes("mobile"))
      await vault.getByRole("button", { name: "Select" }).click();
    await timelineRow
      .getByRole("checkbox", { name: `Select ${timelineTitle}` })
      .check();

    await vault.getByLabel("Filter by type").selectOption("world");
    await expect(
      vault
        .locator(`[data-ltm-note-type="world"]`)
        .filter({ hasText: `E2E world ${suffix}` }),
    ).toBeVisible();
    const bulkActions = vault.locator("[data-ltm-bulk-actions]");
    await expect(bulkActions.locator("[data-ltm-selection-count]")).toHaveText(
      "1 selected, 1 hidden by filters",
    );
    await expect(
      bulkActions.getByRole("button", { name: "Set status" }),
    ).toBeVisible();

    await bulkActions.getByRole("checkbox", { name: "Select visible" }).check();
    await expect(bulkActions.locator("[data-ltm-selection-count]")).toHaveText(
      "2 selected, 1 hidden by filters",
    );
    const deleted = await page.request.post(
      "/api/long-term-memory/notes/permanent-delete",
      {
        headers: csrfHeaders,
        data: { ids: [worldId] },
      },
    );
    expect(deleted.ok(), await deleted.text()).toBe(true);
    await bulkActions.getByRole("button", { name: "Set status" }).click();
    await expect(vault).toContainText("1 memory updated; 0 skipped, 1 failed.");
    await expect(bulkActions.locator("[data-ltm-selection-count]")).toHaveText(
      "1 selected, 1 hidden by filters",
    );
  } finally {
    await deleteNotes(page, [timelineId, worldId]);
    await deleteChat(page, chat.id);
  }
});

test("Long-Term Memory opens details and offers manual or source creation", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);
  const id = `world_detail_${Date.now()}`;
  const timestamp = new Date().toISOString();

  try {
    const created = await page.request.post("/api/long-term-memory/notes", {
      headers: csrfHeaders,
      data: {
        id,
        title: "Visible details fixture",
        type: "world",
        status: "resolved",
        modes: ["roleplay"],
        scope: { chatId: chat.id, chatIds: [chat.id] },
        tags: ["e2e_fixture"],
        keywords: [],
        links: [],
        sections: {
          facts: {
            text: `A scoped fixture. ${"unbroken".repeat(80)}`,
            updatedAt: timestamp,
          },
        },
      },
    });
    expect(created.status(), await created.text()).toBe(201);

    await openLongTermMemory(page, chat.id, testInfo);
    const vault = page.locator('[data-ltm-surface="vault"]');
    const memory = vault.getByRole("button", {
      name: "Visible details fixture",
    });
    await expect(memory).toContainText(/facts: A scoped fixture\./i);
    await expect
      .poll(() =>
        vault.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true);
    await expect(vault.locator("[data-ltm-memory-list]")).toHaveCSS(
      "overflow-y",
      "visible",
    );
    await memory.click();
    if (testInfo.project.name.includes("mobile")) {
      await expect(vault.locator("[data-ltm-memory-list]")).toBeHidden();
      await expect(vault.getByRole("tab", { name: "Editor" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await vault.getByRole("tab", { name: "Details" }).click();
    } else {
      await expect(vault.locator("[data-ltm-memory-list]")).toBeVisible();
      await expect(vault.getByRole("tab")).toHaveCount(0);
      await vault.getByRole("button", { name: "Details" }).click();
    }
    await expect(vault).toContainText("Created");
    if (testInfo.project.name.includes("mobile"))
      await vault.getByRole("tab", { name: "Editor" }).click();
    await expect(
      vault.getByRole("heading", { name: "Memory details" }),
    ).toBeVisible();
    await expect(vault.getByRole("textbox", { name: "facts" })).toHaveValue(
      /A scoped fixture\. unbroken/,
    );

    await vault.getByRole("button", { name: "Add memories" }).click();
    await vault.getByRole("menuitem", { name: /Create manually/ }).click();
    await expect(
      vault.getByRole("heading", { name: "New memory" }),
    ).toBeVisible();
    await expect(vault).toContainText(chat.name);

    await vault.getByRole("button", { name: "Close" }).click();
    const discardDialog = page.getByRole("dialog", {
      name: "Discard unsaved memory changes?",
    });
    if (await discardDialog.isVisible({ timeout: 1_000 }).catch(() => false))
      await discardDialog
        .getByRole("button", { name: "Discard changes" })
        .click();
    await vault.getByRole("button", { name: "Add memories" }).click();
    await vault.getByRole("menuitem", { name: /Import sources/ }).click();
    await expect(page.locator('[data-ltm-surface="sources"]')).toBeVisible();
  } finally {
    await deleteNotes(page, [id]);
    await deleteChat(page, chat.id);
  }
});
