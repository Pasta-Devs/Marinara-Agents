// Prerequisites: a provisioned Engine is already running with the locally rebuilt
// Long-Term Memory package installed and active. From ../Marinara-Engine run:
// pnpm exec playwright test -c ../Marinara-Agents/tests/long-term-memory.playwright.config.ts
import { join } from "node:path";
import { readFile } from "node:fs/promises";
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
  const response = await page.request.delete(`/api/chats/${chatId}?force=true`);
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function deleteNotes(page: any, ids: string[]) {
  if (ids.length === 0) return;
  const response = await page.request.post(
    "/api/long-term-memory/notes/permanent-delete",
    {
      headers: csrfHeaders,
      data: { ids },
    },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function seedNotes(page: any, notes: any[]) {
  const exported = await page.request.get(
    "/api/long-term-memory/backup/export",
  );
  expect(exported.ok(), await exported.text()).toBeTruthy();
  const backup = await exported.json();
  backup.notes.push(...notes);
  const imported = await page.request.post(
    "/api/long-term-memory/backup/import",
    { headers: csrfHeaders, data: backup },
  );
  expect(imported.ok(), await imported.text()).toBeTruthy();
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

async function openLongTermMemoryChatSettings(page: any, chatId: string) {
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
  await page.getByRole("button", { name: "Chat Settings" }).click();
  const drawer = page.locator(".mari-chat-settings-drawer");
  await expect(drawer).toBeVisible();
  await drawer
    .locator('[role="button"][aria-expanded]')
    .filter({ hasText: /^Agents/ })
    .click();
  await drawer.getByRole("button", { name: /Misc Agents/ }).click();
  return drawer;
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

test("Long-Term Memory chat settings link opens the main agent settings", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);

  try {
    const response = await page.request.patch(
      `/api/chats/${chat.id}/metadata`,
      {
        data: {
          enableAgents: true,
          activeAgentIds: ["long-term-memory"],
        },
      },
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const drawer = await openLongTermMemoryChatSettings(page, chat.id);
    const agentEntry = drawer.locator(
      '[data-chat-agent-entry="long-term-memory"]',
    );
    await expect(agentEntry).toBeVisible();
    if (testInfo.project.name.includes("mobile")) {
      const drawerBox = await drawer.boundingBox();
      const entryBox = await agentEntry.boundingBox();
      const settingsButtonBox = await agentEntry
        .getByRole("button", { name: "Open Long-Term Memory settings" })
        .boundingBox();
      expect(drawerBox).not.toBeNull();
      expect(entryBox).not.toBeNull();
      expect(settingsButtonBox).not.toBeNull();
      expect(entryBox!.width).toBeLessThanOrEqual(drawerBox!.width);
      expect(settingsButtonBox!.width).toBeCloseTo(entryBox!.width, 0);
    }
    await expect(
      agentEntry.getByRole("button", {
        name: "Open Long-Term Memory settings",
      }),
    ).toBeVisible();
    await agentEntry
      .getByRole("button", { name: "Open Long-Term Memory settings" })
      .click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('[data-ltm-surface="detail"]')).toBeVisible();
  } finally {
    await deleteChat(page, chat.id);
  }
});

test("Long-Term Memory opens its default vault and exposes every navigation destination", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);

  try {
    const operationId = "00000000-0000-4000-8000-000000000001";
    const eventId = "00000000-0000-4000-8000-000000000002";
    await page.route("**/api/long-term-memory/debug-log?*", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("limit") !== "200") return route.continue();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: [
            {
              id: eventId,
              ts: new Date().toISOString(),
              operationId,
              phase: "llm",
              action: "evidence_unit_response",
              status: "ok",
              counts: {
                promptTokens: 12,
                completionTokens: 8,
                responseChars: 99,
              },
            },
          ],
        }),
      });
    });
    if (testInfo.project.name.includes("mobile")) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: undefined,
        });
        document.execCommand = () => true;
      });
    }
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
    const statusStrip = detail.locator('[data-ltm-surface="overview"]');
    await expect(statusStrip).toBeVisible();
    await expect(statusStrip).toContainText("indexed chunks");
    await expect(statusStrip.getByRole("switch")).toHaveAttribute(
      "aria-checked",
      /true|false/,
    );
    await expect(
      detail.getByRole("button", { name: "Add memories" }),
    ).toBeVisible();
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
    await expect(navigation.locator("[data-ltm-destination]")).toHaveCount(4);
    await expect(
      navigation.locator('[data-ltm-destination="activity"]'),
    ).toHaveCount(0);

    await navigation.locator('[data-ltm-destination="sources"]').click();
    await expect(
      detail.getByRole("button", { name: "Add memories" }),
    ).toHaveCount(0);
    const sources = detail.locator('[data-ltm-surface="sources"]');
    await expect(sources).toBeVisible();
    await expect(sources.locator('[data-ltm-source-tab="chats"]')).toHaveText(
      "Chat Summaries",
    );
    await expect(
      sources.locator('[data-ltm-source-tab="chats"]'),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      sources.getByRole("tab", { name: /Ready to Import/ }),
    ).toBeVisible();
    await expect(
      sources.getByRole("tab", { name: /Already Imported/ }),
    ).toBeVisible();
    await expect(
      sources.getByRole("tab", { name: /Ready to Import/ }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(sources.getByRole("tabpanel")).toHaveCount(1);
    await expect(
      sources.locator('[data-ltm-source-select-all="available"]'),
    ).toBeVisible();
    await expect(sources.locator("[data-ltm-source-transfer]")).toHaveCount(0);
    const importScopeHelp = sources.getByRole("button", {
      name: "About Import scope",
    });
    const importScope = sources.getByRole("combobox", { name: "Import scope" });
    const importHelpBox = await importScopeHelp.boundingBox();
    expect(importHelpBox).not.toBeNull();
    expect(importHelpBox!.width).toBeGreaterThanOrEqual(32);
    expect(importHelpBox!.height).toBeGreaterThanOrEqual(32);
    await importScopeHelp.click();
    const importScopePanel = page.locator(
      '[data-ltm-info-panel="Import scope"]',
    );
    await expect(importScopePanel).toContainText("Limit imports to this chat");
    const panelBox = await importScopePanel.boundingBox();
    const viewport = page.viewportSize();
    expect(panelBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.y).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(viewport!.width);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(
      viewport!.height,
    );
    await page.mouse.click(8, 8);
    await expect(importScopePanel).toHaveCount(0);
    if (testInfo.project.name.includes("mobile")) {
      await importScope.selectOption("all");
      await importScopeHelp.click();
      await expect(importScopePanel).toContainText(
        "Search every available character",
      );
      await page.keyboard.press("Escape");
    }

    await navigation.locator('[data-ltm-destination="settings"]').click();
    const settings = detail.locator('[data-ltm-surface="memory-settings"]');
    const recallTab = settings.getByRole("tab", { name: "Recall" });
    await expect(recallTab).toHaveAttribute("aria-selected", "true");
    await expect(settings.getByRole("tab")).toHaveCount(4);
    await expect(settings.getByRole("tab", { name: "Backup" })).toHaveCount(0);
    await expect(settings.getByRole("tabpanel")).toHaveCount(1);
    await expect(
      settings.getByText("Enable Long-Term Memory", { exact: true }),
    ).toHaveCount(0);
    await expect(
      settings.getByText("Meaning match", { exact: true }),
    ).toBeVisible();
    await expect(
      settings.getByText("Exact words match", { exact: true }),
    ).toBeVisible();
    await expect(
      settings.getByText("Memory context instructions", { exact: true }),
    ).toBeVisible();
    const scoreHelp = settings.getByRole("button", {
      name: "About Score threshold",
    });
    await expect(
      settings.getByRole("combobox", { name: "Recall style" }),
    ).toBeVisible();
    await expect(
      settings.getByRole("textbox", { name: "Memory context instructions" }),
    ).toBeVisible();
    await expect(scoreHelp).toHaveAttribute("aria-expanded", "false");
    if (testInfo.project.name.includes("mobile")) await scoreHelp.click();
    else await scoreHelp.hover();
    await expect(
      page.locator('[data-ltm-info-panel="Score threshold"]'),
    ).toContainText("Higher values return fewer, stronger matches.");
    if (!testInfo.project.name.includes("mobile")) await scoreHelp.click();
    await expect(scoreHelp).toHaveAttribute("aria-expanded", "true");
    await expect(scoreHelp).toHaveAttribute("aria-describedby", /-panel$/);
    await settings.getByRole("button", { name: "About Meaning match" }).click();
    await expect(
      page.locator('[data-ltm-info-panel="Score threshold"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-ltm-info-panel="Meaning match"]'),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-ltm-info-panel="Meaning match"]'),
    ).toHaveCount(0);
    if (!testInfo.project.name.includes("mobile")) {
      await scoreHelp.focus();
      await expect(
        page.locator('[data-ltm-info-panel="Score threshold"]'),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await expect(settings.locator('[data-ltm-surface="activity"]')).toHaveCount(
      0,
    );
    await settings.getByRole("tab", { name: "Maintenance" }).click();
    await expect(
      settings.getByRole("heading", { name: "Backup and Reset" }),
    ).toBeVisible();
    await expect(
      settings.getByRole("heading", { name: "Vault Maintenance" }),
    ).toBeVisible();
    await expect(settings.locator('[data-ltm-surface="activity"]')).toHaveCount(
      0,
    );
    await settings.getByRole("tab", { name: "Debug" }).click();
    await expect(
      settings.getByRole("heading", { name: "Debug Activity" }),
    ).toBeVisible();
    const activity = settings.locator('[data-ltm-surface="activity"]');
    await expect(activity).toBeVisible();
    await expect(activity).not.toContainText("No message recorded.");
    await expect(activity).toContainText("Prompt: 12 Tokens");
    await expect(activity).toContainText("Response: 8 Tokens");
    await expect(activity).not.toContainText("responseChars");
    await activity.locator("details > summary").first().click();
    await activity.getByText("Technical details", { exact: true }).click();
    await activity.getByRole("button", { name: /Copy raw JSON/ }).click();
    await expect(activity.getByText("Copied", { exact: true })).toBeVisible();
    await settings.getByRole("tab", { name: "Debug" }).press("ArrowLeft");
    await expect(
      settings.getByRole("tab", { name: "Maintenance" }),
    ).toHaveAttribute("aria-selected", "true");
    await settings.getByRole("tab", { name: "Maintenance" }).press("ArrowLeft");
    await expect(
      settings.getByRole("tab", { name: "Extraction" }),
    ).toHaveAttribute("aria-selected", "true");
    await settings.getByRole("tab", { name: "Extraction" }).press("ArrowRight");
    await expect(
      settings.getByRole("tab", { name: "Maintenance" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() =>
        settings.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true);

    await settings.getByRole("tab", { name: "Extraction" }).click();
    await expect(
      settings.getByRole("combobox", { name: "Reasoning effort" }),
    ).toBeVisible();
    await expect(
      settings.getByRole("combobox", { name: "Verbosity" }),
    ).toBeVisible();
    const templatePanel = settings
      .getByRole("tabpanel")
      .filter({ hasText: "Prompt templates" });
    const templateSelect = templatePanel.getByRole("combobox", {
      name: "Prompt template",
    });
    await expect(templateSelect).toHaveValue("default:conversation");
    await expect(
      templatePanel.getByRole("button", { name: "Reset to default" }),
    ).toHaveCount(3);
    await templateSelect.selectOption("default:roleplay");
    await expect(
      templatePanel.getByRole("textbox", { name: "Name" }),
    ).toHaveValue("Built-in Default (Roleplay)");
    await expect(
      templatePanel.getByRole("textbox", { name: "Template prompt" }),
    ).not.toBeEditable();
    await templatePanel.getByRole("button", { name: "Duplicate" }).click();
    await expect(templateSelect).toHaveValue(/custom:/);
    await expect(
      templatePanel.getByRole("textbox", { name: "Name" }),
    ).toHaveValue("Built-in Default (Roleplay) copy");
    await templatePanel
      .getByRole("textbox", { name: "Name" })
      .fill("Roleplay custom");
    await expect(
      templatePanel.getByRole("textbox", { name: "Name" }),
    ).toHaveValue("Roleplay custom");
    await templateSelect.selectOption("default:game");
    await templateSelect.selectOption({ label: "Roleplay custom" });
    await expect(
      templatePanel.getByRole("textbox", { name: "Name" }),
    ).toHaveValue("Roleplay custom");
    await templatePanel
      .getByRole("button", { name: "Reset to default" })
      .first()
      .click();
    await expect(
      settings.getByRole("button", { name: "Save settings" }),
    ).toBeVisible();
    await expect(
      settings.getByRole("button", { name: "Discard changes" }),
    ).toBeVisible();

    await navigation.locator('[data-ltm-destination="vault"]').click();
    await page
      .getByRole("dialog", { name: "Discard unsaved changes?" })
      .getByRole("button", { name: "Discard changes" })
      .click();
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
          status: note.type === "world" ? "resolved" : "active",
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
    await vault.getByLabel("Filter by status").selectOption("active");

    const timelineRow = vault
      .locator('[data-ltm-note-type="timeline_event"]')
      .filter({ hasText: timelineTitle });
    await vault
      .locator('[data-ltm-memory-group="timeline_event"] summary')
      .click();
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

    await vault.getByLabel("Filter by status").selectOption("resolved");
    await vault.locator('[data-ltm-memory-group="world"] summary').click();
    await expect(
      vault
        .locator(`[data-ltm-note-type="world"]`)
        .filter({ hasText: `E2E world ${suffix}` }),
    ).toBeVisible();
    const bulkActions = vault.locator("[data-ltm-bulk-actions]");
    const selectionCount = vault.locator("[data-ltm-selection-count]");
    await expect(selectionCount).toHaveText("1 selected, 1 hidden by filters");
    await expect(
      bulkActions.getByRole("button", { name: "Set status" }),
    ).toBeVisible();

    await vault.getByRole("checkbox", { name: "Select visible" }).check();
    await expect(selectionCount).toHaveText("2 selected, 1 hidden by filters");
    const deleted = await page.request.post(
      "/api/long-term-memory/notes/permanent-delete",
      {
        headers: csrfHeaders,
        data: { ids: [worldId] },
      },
    );
    expect(deleted.ok(), await deleted.text()).toBe(true);
    await bulkActions.getByLabel("Set status").selectOption("resolved");
    await bulkActions.getByRole("button", { name: "Set status" }).click();
    await expect(vault).toContainText("1 memory updated; 0 skipped, 1 failed.");
    await expect(selectionCount).toHaveText("1 selected, 1 hidden by filters");
  } finally {
    await deleteNotes(page, [timelineId, worldId]);
    await deleteChat(page, chat.id);
  }
});

test("Long-Term Memory review queue keeps context compact and actions contextual", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);
  const sourceId = "source_review_ui";
  const targetId = "world_review_ui";
  const draftId = "00000000-0000-4000-8000-000000000101";
  const mutationId = "00000000-0000-4000-8000-000000000102";
  const timestamp = "2026-07-23T12:00:00.000Z";
  let pendingDraftCount = 0;
  let pendingCountRequests = 0;

  try {
    await page.route(
      "**/api/capability-packages/long-term-memory/client*",
      async (route) => {
        await route.fulfill({
          contentType: "text/javascript; charset=utf-8",
          body: await readFile(
            join(import.meta.dirname, "../packages/long-term-memory/client.js"),
          ),
        });
      },
    );
    await page.route(
      "**/api/long-term-memory/notes?*includeGlobal=*",
      async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: sourceId,
              title: "Review source",
              type: "source",
              status: "active",
              modes: ["roleplay"],
              scope: { chatId: chat.id, chatIds: [chat.id] },
              tags: [],
              keywords: [],
              links: [],
              sections: {
                source: { text: "Source text", updatedAt: timestamp },
              },
              createdAt: timestamp,
              updatedAt: timestamp,
              version: 1,
            },
            {
              id: targetId,
              title: "Existing target",
              type: "world",
              status: "active",
              modes: ["roleplay"],
              scope: { chatId: chat.id, chatIds: [chat.id] },
              tags: [],
              keywords: [],
              links: [],
              sections: {
                facts: { text: "Existing fact", updatedAt: timestamp },
              },
              createdAt: timestamp,
              updatedAt: timestamp,
              version: 1,
            },
          ]),
        });
      },
    );
    await page.route(
      "**/api/long-term-memory/drafts/review?*",
      async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            generatedAt: timestamp,
            sources: [
              {
                sourceNoteId: sourceId,
                modes: ["roleplay"],
                drafts: [
                  {
                    draft: {
                      id: draftId,
                      status: "pending",
                      applyState: "not_started",
                      indexRebuildStatus: "not_requested",
                      createdAt: timestamp,
                      updatedAt: timestamp,
                      source: { sourceNoteId: sourceId },
                      scope: { chatId: chat.id, chatIds: [chat.id] },
                      modes: ["roleplay"],
                      summary: "Compact review fixture",
                      mutations: [
                        {
                          id: mutationId,
                          kind: "append_section",
                          noteId: targetId,
                          sectionKey: "facts",
                          text: "A proposed durable fact.",
                          claimKind: "change",
                          risk: "low",
                          confidence: 0.9,
                          summary: "Add one durable fact",
                          evidence: ["The source says so."],
                        },
                      ],
                      accounting: {
                        providerCandidates: 1,
                        normalizedAdditions: 0,
                        parserRejections: 0,
                        validationRejections: 0,
                        deduplications: 0,
                        keptUnits: 1,
                      },
                    },
                    freshness: "fresh",
                    blockReasons: [],
                    diagnostics: [],
                    candidateRejections: [],
                    deduplications: [],
                  },
                ],
                targets: [
                  {
                    noteId: targetId,
                    title: "Existing target",
                    noteType: "world",
                    rows: [
                      {
                        draftId,
                        mutation: {
                          id: mutationId,
                          kind: "append_section",
                          noteId: targetId,
                          sectionKey: "facts",
                          text: "A proposed durable fact.",
                          claimKind: "change",
                          risk: "low",
                          confidence: 0.9,
                          summary: "Add one durable fact",
                          evidence: ["The source says so."],
                        },
                        disposition: "merge",
                        diagnostics: [],
                        changes: [
                          {
                            kind: "section",
                            key: "facts",
                            before: "Existing fact",
                            after: "Existing fact\nA proposed durable fact.",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            counts: {
              sources: 1,
              drafts: 1,
              mutations: 1,
              blockedDrafts: 0,
              candidateRejections: 0,
              deduplications: 0,
            },
          }),
        });
      },
    );
    await page.route(
      "**/api/long-term-memory/drafts/pending-count*",
      async (route) => {
        pendingCountRequests += 1;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ count: pendingDraftCount }),
        });
      },
    );
    await openLongTermMemory(page, chat.id, testInfo);
    const detail = page.locator('[data-ltm-surface="detail"]');
    const navigation = detail.locator(
      'nav[aria-label="Long-Term Memory sections"]:visible',
    );
    await expect.poll(() => pendingCountRequests).toBeGreaterThan(0);
    await expect(
      navigation.locator('[data-ltm-destination="review"] [data-ltm-badge]'),
    ).toHaveCount(0);
    await page.route(
      `**/api/long-term-memory/notes/${sourceId}/extract`,
      async (route) => {
        pendingDraftCount = 1;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      },
    );
    const vault = detail.locator('[data-ltm-surface="vault"]');
    await vault.locator('[data-ltm-memory-group="source"] summary').click();
    await vault
      .locator('[data-ltm-note-type="source"]')
      .filter({ hasText: "Review source" })
      .getByRole("button")
      .click();
    await detail.getByRole("button", { name: "Extract to review" }).click();
    await expect.poll(() => pendingCountRequests).toBeGreaterThan(1);
    await expect(
      navigation.locator('[data-ltm-destination="review"] [data-ltm-badge]'),
    ).toHaveText("1");
    await detail
      .locator('nav[aria-label="Long-Term Memory sections"]:visible')
      .locator('[data-ltm-destination="review"]')
      .click();

    const queue = detail.locator('[data-ltm-surface="review-queue"]');
    await expect(queue).toBeVisible();
    await expect(queue.locator("[data-ltm-review-summary]")).toHaveText(
      "1 source | 1 pending | 1 ready | 0 blocked",
    );
    await expect(queue.locator("[data-ltm-review-source]")).toContainText(
      "Review source",
    );
    await expect(queue.locator("[data-ltm-review-draft]")).toContainText(
      "Created",
    );
    await expect(queue.locator("[data-ltm-review-batch-actions]")).toHaveCount(
      0,
    );

    const mutation = queue.locator(
      `[data-ltm-review-mutation="${mutationId}"]`,
    );
    const preview = mutation.locator("[data-ltm-review-preview]");
    await expect(preview).not.toHaveAttribute("open", "");
    await preview.locator("summary").click();
    await expect(mutation.locator("[data-ltm-review-evidence]")).toBeVisible();
    await expect(mutation.locator("[data-ltm-review-changes]")).toBeVisible();

    await mutation.getByRole("checkbox").check();
    await expect(
      queue.locator("[data-ltm-review-batch-actions]"),
    ).toBeVisible();
    await expect(
      queue.locator("[data-ltm-review-batch-actions]").getByRole("button", {
        name: "Accept eligible (1)",
      }),
    ).toBeVisible();
    await mutation.getByRole("textbox").fill("Edited durable fact.");
    await detail
      .locator('nav[aria-label="Long-Term Memory sections"]:visible')
      .locator('[data-ltm-destination="vault"]')
      .click();
    await expect(
      page.getByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "Discard unsaved changes?" })
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(queue).toBeVisible();
    await expect
      .poll(() =>
        queue.evaluate((element) => element.scrollWidth <= element.clientWidth),
      )
      .toBe(true);
  } finally {
    await deleteChat(page, chat.id);
  }
});

test("Long-Term Memory manages imported sources from one workstation", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);
  const noteId = `source_workstation_${Date.now()}`;
  const noteTitle = "Imported workstation source";
  const timestamp = new Date().toISOString();
  let appliedNoteIds: string[] = [];

  try {
    await seedNotes(page, [
      {
        id: noteId,
        title: noteTitle,
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: chat.id, chatIds: [chat.id] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: chat.id },
        sections: {
          source: { text: "Imported source fixture.", updatedAt: timestamp },
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      },
    ]);
    await page.route(
      "**/api/capability-packages/long-term-memory/client*",
      async (route) => {
        await route.fulfill({
          contentType: "text/javascript; charset=utf-8",
          body: await readFile(
            join(import.meta.dirname, "../packages/long-term-memory/client.js"),
          ),
        });
      },
    );
    await page.route(
      "**/api/long-term-memory/import/preview",
      async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            source: "chats",
            scanned: 2,
            draftable: 1,
            importedCount: 1,
            samples: [
              {
                sourceId: "pending-workstation",
                title: "Pending workstation source",
                mutationCount: 0,
                summary: "Ready to import.",
                snippet: "Pending source fixture.",
                status: "pending",
                freshness: "new",
              },
              {
                sourceId: "imported-workstation",
                title: "Imported workstation source",
                mutationCount: 0,
                summary: "Already imported.",
                snippet: "Imported source fixture.",
                status: "imported",
                freshness: "current",
                existingNoteId: noteId,
                existingNoteTitle: noteTitle,
              },
            ],
          }),
        });
      },
    );
    await page.route(
      "**/api/long-term-memory/notes/transfer-preview",
      async (route) => {
        const request = route.request().postDataJSON();
        expect(request.noteIds).toEqual([noteId]);
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            mode: request.mode,
            destinationChatId: chat.id,
            selection: {
              requestedNoteCount: 1,
              totalNoteCount: 1,
              requestedNoteIds: [noteId],
              availableDerivedCount: 0,
              includedDerivedCount: 0,
              derivedNoteIds: [],
              includeDerived: request.includeDerived,
            },
            buckets: { ready: [noteId], noOp: [], conflict: [] },
            items: [
              {
                noteId,
                title: noteTitle,
                type: "source",
                previewText: "Imported source fixture.",
                scope: { chatId: chat.id, chatIds: [chat.id] },
                nextScope: { chatId: chat.id, chatIds: [chat.id] },
                derived: false,
                classification: "ready",
                defaultIncluded: true,
                conflicts: [],
              },
            ],
          }),
        });
      },
    );
    await page.route(
      "**/api/long-term-memory/notes/transfer",
      async (route) => {
        const request = route.request().postDataJSON();
        appliedNoteIds = request.noteIds;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            mode: request.mode,
            destinationChatId: chat.id,
            updatedNoteIds: request.noteIds,
            skippedNoteIds: [],
            derivedNoteIdsTouched: [],
            rebuild: null,
          }),
        });
      },
    );

    await openLongTermMemory(page, chat.id, testInfo);
    const detail = page.locator('[data-ltm-surface="detail"]');
    const navigation = detail.locator(
      'nav[aria-label="Long-Term Memory sections"]:visible',
    );
    await navigation.locator('[data-ltm-destination="sources"]').click();
    const sources = detail.locator('[data-ltm-surface="sources"]');
    await expect(
      sources.getByRole("tab", { name: /Ready to Import \(1\)/ }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(sources.getByText("Pending workstation source")).toBeVisible();
    await expect(sources.getByText("Imported workstation source")).toHaveCount(
      0,
    );

    await sources.getByRole("tab", { name: /Already Imported \(1\)/ }).click();
    const importedPanel = sources.getByRole("tabpanel");
    await expect(
      importedPanel.getByRole("heading", { name: noteTitle }),
    ).toBeVisible();
    const importedRow = importedPanel.locator(`[data-ltm-source-id="imported-workstation"]`);
    await expect(
      importedPanel.locator("[data-ltm-source-transfer-note]"),
    ).toHaveCount(0);
    if (testInfo.project.name.includes("mobile")) {
      await importedRow
        .getByRole("button", { name: `More actions for ${noteTitle}` })
        .click();
      await expect(
        importedRow.getByRole("button", { name: "Re-extract" }),
      ).toBeVisible();
      await expect(
        importedRow.getByRole("button", { name: "Review drafts" }),
      ).toBeVisible();
    } else {
      await importedRow.hover();
      await expect(
        importedRow.getByRole("button", { name: `Re-extract ${noteTitle}` }),
      ).toBeVisible();
      await expect(
        importedRow.getByRole("button", {
          name: `Review drafts for ${noteTitle}`,
        }),
      ).toBeVisible();
    }
    await importedPanel
      .getByLabel("Select Imported workstation source")
      .check();
    await expect(
      sources.locator('[data-ltm-source-action="transfer-selected"]'),
    ).toContainText("(1)");
    await sources
      .locator('[data-ltm-source-action="transfer-selected"]')
      .click();
    await expect(
      sources.locator("[data-ltm-transfer-include-derived]"),
    ).toBeChecked();
    await sources.locator('[data-ltm-transfer-action="preview"]').click();
    await expect(sources.locator("[data-ltm-transfer-preview]")).toContainText(
      "1 ready",
    );
    await sources.locator('[data-ltm-transfer-action="apply-ready"]').click();
    await expect(
      sources.locator('[data-ltm-transfer-result="copy"]'),
    ).toBeVisible();
    expect(appliedNoteIds).toEqual([noteId]);

    await sources
      .getByRole("button", { name: `Open source memory: ${noteTitle}` })
      .click();
    const vault = detail.locator('[data-ltm-surface="vault"]');
    await expect(vault).toBeVisible();
    await expect(vault.getByLabel("Title")).toHaveValue(noteTitle);
  } finally {
    await deleteNotes(page, [noteId]);
    await deleteChat(page, chat.id);
  }
});

test("Long-Term Memory exposes single-memory actions without selection mode", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);
  const suffix = Date.now();
  const sourceTitle = `Single action source ${suffix}`;
  const worldTitle = `Single action world ${suffix}`;
  const sourceId = `source_single_action_${suffix}`;
  const worldId = `world_single_action_${suffix}`;
  const timestamp = new Date().toISOString();
  const batchRequests: Array<Record<string, unknown>> = [];

  try {
    await seedNotes(page, [
      {
        id: sourceId,
        title: sourceTitle,
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: chat.id, chatIds: [chat.id] },
        tags: ["e2e_fixture"],
        keywords: [],
        links: [],
        sections: {
          source: { text: "Single-item source fixture.", updatedAt: timestamp },
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      },
      {
        id: worldId,
        title: worldTitle,
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: chat.id, chatIds: [chat.id] },
        tags: ["e2e_fixture"],
        keywords: [],
        links: [],
        sections: {
          facts: { text: "Single-item world fixture.", updatedAt: timestamp },
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      },
    ]);
    await page.route("**/api/long-term-memory/notes/batch", async (route) => {
      const request = route.request().postDataJSON();
      batchRequests.push(request);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          updatedNoteIds: request.noteIds,
          skippedNoteIds: [],
          failedNoteIds: [],
        }),
      });
    });

    await openLongTermMemory(page, chat.id, testInfo);
    const vault = page.locator('[data-ltm-surface="vault"]');
    await vault.locator('[data-ltm-memory-group="world"] summary').click();
    const worldRow = vault
      .locator('[data-ltm-note-type="world"]')
      .filter({ hasText: worldTitle });

    if (testInfo.project.name.includes("mobile")) {
      await worldRow
        .getByRole("button", { name: `More actions for ${worldTitle}` })
        .click();
      await worldRow.getByRole("button", { name: "Archive" }).click();
    } else {
      await worldRow.hover();
      await worldRow
        .getByRole("button", { name: `Archive ${worldTitle}` })
        .click();
    }

    await expect(vault).toContainText("1 memory updated.");
    expect(batchRequests).toEqual([
      { noteIds: [worldId], archive: "notes_only" },
    ]);

    await vault.locator('[data-ltm-memory-group="source"] summary').click();
    const sourceRow = vault
      .locator('[data-ltm-note-type="source"]')
      .filter({ hasText: sourceTitle });
    if (testInfo.project.name.includes("mobile")) {
      await sourceRow
        .getByRole("button", { name: `More actions for ${sourceTitle}` })
        .click();
      await sourceRow.getByRole("button", { name: "Delete" }).click();
    } else {
      await sourceRow.hover();
      await sourceRow
        .getByRole("button", { name: `Delete ${sourceTitle}` })
        .click();
    }

    const dialog = page.getByRole("dialog", {
      name: "Permanently delete selected memories?",
    });
    await expect(dialog.locator("[data-ltm-delete-extracted]")).toBeVisible();
  } finally {
    await deleteNotes(page, [sourceId, worldId]);
    await deleteChat(page, chat.id);
  }
});

test("Long-Term Memory browses whole lorebooks and selects their entries", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);
  const atlasId = "ltm-e2e-atlas";
  const archiveId = "ltm-e2e-archive";
  const gateId = "ltm-e2e-cobalt-gate";
  const atlasName = "LTM Atlas";
  const archiveName = "LTM Archive";
  const gateName = "Cobalt Gate";
  const moonVaultName = "Moon Vault";
  const quietRecordName = "Quiet Record";

  try {
    await page.route(
      "**/api/capability-packages/long-term-memory/client*",
      async (route) => {
        await route.fulfill({
          contentType: "text/javascript; charset=utf-8",
          body: await readFile(
            join(import.meta.dirname, "../packages/long-term-memory/client.js"),
          ),
        });
      },
    );
    const candidate = (sourceId: string, title: string, snippet: string) => ({
      sourceId,
      title,
      mutationCount: 1,
      summary: `Import ${title}`,
      snippet,
      status: "pending",
      freshness: "new",
    });
    const entry = (
      id: string,
      name: string,
      sourceId: string,
      snippet: string,
    ) => ({
      id,
      name,
      candidateCount: 1,
      candidates: [candidate(sourceId, name, snippet)],
    });
    const atlasEntries = [
      entry(
        "description",
        "Description",
        "atlas-description",
        "A source-browser fixture.",
      ),
      entry(
        gateId,
        gateName,
        "atlas-gate",
        "The cobalt gate opens only at dusk.",
      ),
      entry(
        "moon-vault",
        moonVaultName,
        "atlas-vault",
        "The Moon Vault lies beneath the observatory.",
      ),
    ];
    const archiveEntries = [
      entry(
        "description",
        "Description",
        "archive-description",
        "A source-browser fixture.",
      ),
      entry(
        "quiet-record",
        quietRecordName,
        "archive-record",
        "The archive records the seventh bell.",
      ),
    ];
    await page.route(
      "**/api/long-term-memory/import/lorebooks/preview",
      async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            counts: {
              books: 2,
              entries: 5,
              candidates: 5,
              pending: 5,
              imported: 0,
            },
            books: [
              {
                id: atlasId,
                name: atlasName,
                description: "A source-browser fixture.",
                category: "world",
                tags: ["ltm-e2e"],
                scope: {},
                counts: {
                  entries: 3,
                  candidates: 3,
                  pending: 3,
                  imported: 0,
                },
                entries: atlasEntries,
              },
              {
                id: archiveId,
                name: archiveName,
                description: "A source-browser fixture.",
                category: "world",
                tags: ["ltm-e2e"],
                scope: {},
                counts: {
                  entries: 2,
                  candidates: 2,
                  pending: 2,
                  imported: 0,
                },
                entries: archiveEntries,
              },
            ],
          }),
        });
      },
    );

    await openLongTermMemory(page, chat.id, testInfo);
    const detail = page.locator('[data-ltm-surface="detail"]');
    const navigation = detail.locator(
      'nav[aria-label="Long-Term Memory sections"]:visible',
    );
    await navigation.locator('[data-ltm-destination="sources"]').click();
    const sources = detail.locator('[data-ltm-surface="sources"]');
    await sources.locator("[data-ltm-import-scope]").selectOption("all");
    await sources.locator('[data-ltm-source-tab="lorebooks"]').click();

    const browser = sources.locator("[data-ltm-lorebook-browser]");
    await expect(browser).toBeVisible();
    const atlasRow = browser.locator(`[data-ltm-lorebook-id="${atlasId}"]`);
    const archiveRow = browser.locator(`[data-ltm-lorebook-id="${archiveId}"]`);
    await expect(atlasRow).toHaveCount(1);
    await expect(archiveRow).toHaveCount(1);
    await expect(atlasRow).toContainText("3 entries");

    await atlasRow.click();
    const workbench = browser.locator(
      `[data-ltm-lorebook-workbench="${atlasId}"]`,
    );
    await expect(workbench).toBeVisible();
    await expect(
      workbench.getByRole("heading", { name: gateName }),
    ).toBeVisible();
    await expect(
      workbench.getByRole("heading", { name: moonVaultName }),
    ).toBeVisible();
    await expect(workbench).not.toContainText(quietRecordName);

    const gateEntry = workbench.locator(
      `[data-ltm-lorebook-entry="${gateId}"]`,
    );
    await gateEntry.getByRole("checkbox").check();
    await expect(
      workbench.locator('[data-ltm-lorebook-action="import-selected"]'),
    ).toContainText("(1)");
    await expect(
      workbench.locator('[data-ltm-lorebook-action="refresh-selected"]'),
    ).toContainText("(0)");

    if (testInfo.project.name.includes("mobile")) {
      await expect(
        browser.locator('[data-ltm-lorebook-pane="entries"]'),
      ).toHaveAttribute("aria-selected", "true");
      await expect(browser.locator("[data-ltm-lorebook-list]")).toBeHidden();
      await browser
        .locator('[data-ltm-lorebook-pane="entries"]')
        .press("ArrowLeft");
      await expect(
        browser.locator('[data-ltm-lorebook-pane="lorebooks"]'),
      ).toBeFocused();
      await expect(browser.locator("[data-ltm-lorebook-list]")).toBeVisible();
      await expect(workbench).toBeHidden();
    } else {
      const [listBox, workbenchBox] = await Promise.all([
        browser.locator("[data-ltm-lorebook-list]").boundingBox(),
        workbench.boundingBox(),
      ]);
      expect(listBox).not.toBeNull();
      expect(workbenchBox).not.toBeNull();
      expect(listBox!.x + listBox!.width).toBeLessThan(workbenchBox!.x);
    }
    await expect
      .poll(() =>
        sources.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true);
  } finally {
    await deleteChat(page, chat.id);
  }
});

test("Long-Term Memory opens details and offers manual or source creation", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);
  const id = `world_detail_${Date.now()}`;
  const sourceId = `source_detail_${Date.now()}`;
  const timestamp = new Date().toISOString();

  try {
    const sourceTitle = "Readable source fixture";
    await seedNotes(page, [
      {
        id: sourceId,
        title: sourceTitle,
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: chat.id, chatIds: [chat.id] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: chat.id },
        sections: {
          source: { text: "Source fixture text.", updatedAt: timestamp },
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      },
    ]);

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
            text: `A scoped fixture. ${"unbroken".repeat(10)}`,
            updatedAt: timestamp,
            importance: "major",
            confidence: 0.8,
            salience: 0.7,
            evidence: [`source_note:${sourceId}`],
          },
        },
      },
    });
    expect(created.status(), await created.text()).toBe(201);

    await openLongTermMemory(page, chat.id, testInfo);
    const vault = page.locator('[data-ltm-surface="vault"]');
    const groups = vault.locator("[data-ltm-memory-group]");
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0)).toHaveAttribute(
      "data-ltm-memory-group",
      "source",
    );
    await expect(groups.nth(1)).toHaveAttribute(
      "data-ltm-memory-group",
      "world",
    );
    await expect(groups.nth(0).locator("summary")).toContainText("Source");
    await expect(groups.nth(0)).not.toHaveAttribute("open", "");
    await expect(groups.nth(0).getByText(sourceTitle)).toBeHidden();
    await vault.getByLabel("Search memories").fill("Visible details fixture");
    const worldGroup = vault.locator('[data-ltm-memory-group="world"]');
    await expect(worldGroup).toHaveAttribute("open", "");
    const memory = vault.getByRole("button", {
      name: "Visible details fixture",
    });
    await expect(memory).toContainText(/facts: A scoped fixture\./i);
    await expect
      .poll(() =>
        vault.evaluate((element) => element.scrollWidth <= element.clientWidth),
      )
      .toBe(true);
    await expect(vault.locator("[data-ltm-memory-list]")).toHaveCSS(
      "overflow-y",
      testInfo.project.name.includes("mobile") ? "visible" : "auto",
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
      const memoryList = vault.locator("[data-ltm-memory-list]");
      const editor = vault.locator("[data-ltm-note-editor]");
      const inspector = vault.locator("[data-ltm-note-inspector]");
      await expect(memoryList).toBeVisible();
      await expect(editor).toBeVisible();
      await expect(inspector).toBeHidden();
      await vault.getByRole("button", { name: "Show metadata" }).click();
      await expect(inspector).toBeVisible();
      await expect(vault.getByRole("tab")).toHaveCount(0);
      await expect(
        vault.getByRole("button", { name: "Details", exact: true }),
      ).toBeHidden();
      const [listBox, editorBox, inspectorBox] = await Promise.all([
        memoryList.boundingBox(),
        editor.boundingBox(),
        inspector.boundingBox(),
      ]);
      expect(listBox).not.toBeNull();
      expect(editorBox).not.toBeNull();
      expect(inspectorBox).not.toBeNull();
      expect(listBox!.x + listBox!.width).toBeLessThan(editorBox!.x);
      expect(editorBox!.x + editorBox!.width).toBeLessThan(inspectorBox!.x);
    }
    await expect(vault.getByLabel("Confidence")).toHaveValue("0.8");
    await expect(vault.getByLabel("Salience")).toHaveValue("0.7");
    await expect(vault.getByLabel("Importance")).toHaveValue("major");
    await expect(vault).toContainText("Created");
    if (testInfo.project.name.includes("mobile"))
      await vault.getByRole("tab", { name: "Editor" }).click();
    await expect(
      vault.getByRole("heading", { name: "Memory details" }),
    ).toBeVisible();
    await expect(vault.getByRole("textbox", { name: "facts" })).toHaveValue(
      /A scoped fixture\. unbroken/,
    );
    const titleBox = await vault.getByLabel("Title").boundingBox();
    const sectionBox = await vault
      .getByRole("heading", { name: "Memory sections" })
      .boundingBox();
    expect(titleBox).not.toBeNull();
    expect(sectionBox).not.toBeNull();
    expect(titleBox!.y).toBeLessThan(sectionBox!.y);
    await expect(vault.getByText(sourceId, { exact: false })).toHaveCount(0);
    await expect(
      vault
        .locator("[data-ltm-note-editor]")
        .getByText(sourceTitle, { exact: true }),
    ).toBeVisible();

    const detail = page.locator('[data-ltm-surface="detail"]');
    await detail.getByRole("button", { name: "Add memories" }).click();
    await detail.getByRole("button", { name: /Create manually/ }).click();
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
    await detail.getByRole("button", { name: "Add memories" }).click();
    await detail.getByRole("button", { name: /Import sources/ }).click();
    await expect(page.locator('[data-ltm-surface="sources"]')).toBeVisible();
  } finally {
    await deleteNotes(page, [id, sourceId]);
    await deleteChat(page, chat.id);
  }
});

test("Long-Term Memory can delete a source and its extracted memories", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const chat = await createChat(page, testInfo);
  const suffix = Date.now();
  const sourceId = `source_delete_${suffix}`;
  const memoryId = `world_delete_${suffix}`;
  const sourceTitle = `Delete source ${suffix}`;
  const timestamp = new Date().toISOString();
  const scope = { chatId: chat.id, chatIds: [chat.id] };
  const sourceHash = "a".repeat(64);

  try {
    await seedNotes(page, [
      {
        id: sourceId,
        title: sourceTitle,
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope,
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: chat.id },
        sections: {
          source: { text: "Deletion source fixture.", updatedAt: timestamp },
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      },
      {
        id: memoryId,
        title: `Extracted memory ${suffix}`,
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope,
        tags: ["e2e_fixture"],
        keywords: [],
        links: [{ target: sourceId, relation: "extracted_from" }],
        sections: {
          facts: {
            text: "Source-owned deletion fact.",
            updatedAt: timestamp,
            evidence: [`source_note:${sourceId}`],
            contributions: [
              {
                owner: "source",
                sourceNoteId: sourceId,
                sourceHash,
                text: "Source-owned deletion fact.",
                updatedAt: timestamp,
                evidence: [`source_note:${sourceId}`],
              },
            ],
          },
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      },
    ]);

    await openLongTermMemory(page, chat.id, testInfo);
    const vault = page.locator('[data-ltm-surface="vault"]');
    await vault.locator('[data-ltm-memory-group="source"] summary').click();
    if (testInfo.project.name.includes("mobile"))
      await vault.getByRole("button", { name: "Select" }).click();
    const sourceRow = vault
      .locator('[data-ltm-note-type="source"]')
      .filter({ hasText: sourceTitle });
    await sourceRow
      .getByRole("checkbox", { name: `Select ${sourceTitle}` })
      .check();
    await vault
      .locator("[data-ltm-bulk-actions]")
      .getByRole("button", { name: "Delete" })
      .click();

    const dialog = page.getByRole("dialog", {
      name: "Permanently delete selected memories?",
    });
    const cascade = dialog.locator("[data-ltm-delete-extracted]");
    await expect(cascade).not.toBeChecked();
    await cascade.check();
    await dialog.getByRole("button", { name: "Delete permanently" }).click();

    await expect
      .poll(async () =>
        (
          await page.request.get(`/api/long-term-memory/notes/${sourceId}`)
        ).status(),
      )
      .toBe(404);
    expect(
      (
        await page.request.get(`/api/long-term-memory/notes/${memoryId}`)
      ).status(),
    ).toBe(404);
  } finally {
    await deleteNotes(page, [sourceId, memoryId]);
    await deleteChat(page, chat.id);
  }
});
