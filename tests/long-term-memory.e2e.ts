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

async function createChat(page: any, testInfo: any) {
  const response = await page.request.post("/api/chats", {
    data: {
      name: `LTM E2E ${testInfo.project.name} ${Date.now()}`,
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { id: string };
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

    await navigation.locator('[data-ltm-destination="vault"]').click();
    await expect(detail.locator('[data-ltm-surface="vault"]')).toBeVisible();
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
  const sourceId = `source_e2e_${suffix}`;
  const worldId = `world_e2e_${suffix}`;
  const sourceTitle = `E2E source ${suffix}`;
  const timestamp = new Date().toISOString();

  try {
    for (const note of [
      {
        id: sourceId,
        title: sourceTitle,
        type: "source",
        sections: {
          source: {
            text: "A durable E2E source fixture.",
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
    await vault.getByLabel("Filter by type").selectOption("source");

    const sourceRow = vault
      .locator("[data-ltm-note-source]")
      .filter({ hasText: sourceTitle });
    await expect(sourceRow).toBeVisible();
    await expect(sourceRow).toHaveAttribute("data-ltm-note-type", "source");
    await sourceRow
      .getByRole("checkbox", { name: `Select ${sourceTitle}` })
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

    await bulkActions.getByRole("button", { name: "Set status" }).click();
    await expect(vault).toContainText("1 memory updated.");
    await bulkActions.getByRole("button", { name: "Clear all" }).click();
    await expect(bulkActions.locator("[data-ltm-selection-count]")).toHaveText(
      "0 selected",
    );
  } finally {
    await deleteNotes(page, [sourceId, worldId]);
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
          facts: { text: "A scoped fixture.", updatedAt: timestamp },
        },
      },
    });
    expect(created.status(), await created.text()).toBe(201);

    await openLongTermMemory(page, chat.id, testInfo);
    const vault = page.locator('[data-ltm-surface="vault"]');
    await vault
      .getByRole("button", { name: "Visible details fixture" })
      .click();
    await expect(
      vault.getByRole("heading", { name: "Memory details" }),
    ).toBeVisible();
    await expect(vault.locator("textarea[data-ltm-field]")).toHaveCount(0);

    await vault.getByRole("button", { name: "Add memories" }).click();
    await vault.getByRole("menuitem", { name: /Create manually/ }).click();
    await expect(
      vault.getByRole("heading", { name: "New memory" }),
    ).toBeVisible();
    await expect(vault).toContainText(`Chat: ${chat.id}`);

    page.once("dialog", (dialog) => dialog.accept());
    await vault.getByRole("button", { name: "Close" }).click();
    await vault.getByRole("button", { name: "Add memories" }).click();
    await vault.getByRole("menuitem", { name: /Import sources/ }).click();
    await expect(page.locator('[data-ltm-surface="sources"]')).toBeVisible();
  } finally {
    await deleteNotes(page, [id]);
    await deleteChat(page, chat.id);
  }
});
