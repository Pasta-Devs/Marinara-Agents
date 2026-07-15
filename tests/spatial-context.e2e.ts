import { expect, test, type Page, type TestInfo } from "@playwright/test";

const generatedDefinition = {
  schemaVersion: 1,
  ownerMode: "roleplay",
  enabled: false,
  revision: 0,
  startingLocationId: "ai_world",
  locations: [
    {
      id: "ai_world",
      parentId: null,
      name: "Shrouded Coast",
      kind: "region",
      description: "A coast hidden beneath sea fog.",
      modelMemory: "Old shipping routes conceal forgotten coves.",
      icon: "🌫️",
      childPresentation: "map",
      links: [],
      status: "active",
      sortOrder: 0,
    },
    {
      id: "ai_harbor",
      parentId: "ai_world",
      name: "Gloam Harbor",
      kind: "settlement",
      description: "A busy harbor of black piers.",
      modelMemory: "The harbor master keeps a smuggling ledger.",
      icon: "⚓",
      childPresentation: "list",
      placement: { x: 25, y: 60 },
      links: [],
      status: "active",
      sortOrder: 0,
    },
    {
      id: "ai_lighthouse",
      parentId: "ai_world",
      name: "Blackglass Lighthouse",
      kind: "building",
      description: "A dark lighthouse on the cliffs.",
      modelMemory: "Its lamp reveals hidden ink at midnight.",
      icon: "🗼",
      childPresentation: "list",
      placement: { x: 72, y: 25 },
      links: [
        {
          targetId: "ai_sewers",
          label: "Smuggler tunnel",
          bidirectional: true,
          state: "hidden",
        },
      ],
      status: "active",
      sortOrder: 1,
    },
    {
      id: "ai_sewers",
      parentId: "ai_world",
      name: "Old Sewers",
      kind: "place",
      description: "Flooded tunnels beneath the coast.",
      modelMemory: "A sealed gate leads under the lighthouse.",
      icon: "🕳️",
      childPresentation: "list",
      placement: { x: 55, y: 82 },
      links: [],
      status: "active",
      sortOrder: 2,
    },
  ],
} as const;

const expandedDefinition = {
  ...generatedDefinition,
  enabled: true,
  revision: 1,
  locations: [
    ...generatedDefinition.locations,
    {
      id: "ai_riverside",
      parentId: "ai_world",
      name: "Riverside Ward",
      kind: "place",
      description: "A lantern-lit district beside the tidal river.",
      modelMemory: "The ward ferrymen know which tunnels remain dry.",
      icon: "🏮",
      childPresentation: "list",
      placement: { x: 82, y: 58 },
      links: [],
      status: "active",
      sortOrder: 3,
    },
    {
      id: "ai_minnow",
      parentId: "ai_riverside",
      name: "Silver Minnow Inn",
      kind: "building",
      description: "A crowded inn for ferrymen and river traders.",
      modelMemory: "A hidden cellar door opens at low tide.",
      icon: "🍺",
      childPresentation: "list",
      links: [],
      status: "active",
      sortOrder: 0,
    },
  ],
} as const;

const gameGeneratedDefinition = {
  ...generatedDefinition,
  ownerMode: "game",
} as const;

test.beforeEach(async ({ page }) => {
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/health").catch(() => null);
        return response?.ok() ?? false;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  const healthResponse = await page.request.get("/api/health");
  expect(healthResponse.ok()).toBeTruthy();
  const { version } = (await healthResponse.json()) as { version: string };
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
});

async function activateHierarchicalMaps(page: Page, chatId: string) {
  const response = await page.request.patch(`/api/chats/${chatId}/metadata`, {
    data: {
      enableAgents: true,
      activeAgentIds: ["hierarchical-maps"],
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function dismissOnboardingTutorial(page: Page) {
  const skip = page.getByRole("button", { name: "Skip Tutorial" });
  const appeared = await skip.waitFor({ state: "visible", timeout: 3_000 }).then(
    () => true,
    () => false,
  );
  if (appeared) await skip.click();
}

async function expectWorkspaceFillsOverlay(page: Page) {
  const overlay = page.locator("[data-marinara-maps-workspace-overlay]");
  await expect(overlay).toBeVisible();
  const geometry = await overlay.evaluate((element) => {
    const root =
      element.querySelector<HTMLElement>("[data-marinara-maps-workspace-root]") ??
      element.querySelector<HTMLElement>(":scope > .mari-editor-shell");
    if (!root) return null;
    const overlayRect = element.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return {
      overlay: {
        x: overlayRect.x,
        y: overlayRect.y,
        width: overlayRect.width,
        height: overlayRect.height,
      },
      root: {
        x: rootRect.x,
        y: rootRect.y,
        width: rootRect.width,
        height: rootRect.height,
      },
    };
  });
  expect(geometry).not.toBeNull();
  expect(Math.abs(geometry!.root.x - geometry!.overlay.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry!.root.y - geometry!.overlay.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry!.root.width - geometry!.overlay.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry!.root.height - geometry!.overlay.height)).toBeLessThanOrEqual(1);
}

async function expectAuthoringWorkspaceLayout(page: Page, mobile: boolean) {
  await expectWorkspaceFillsOverlay(page);
  const layout = await page.locator("[data-marinara-maps-workspace-overlay]").evaluate((overlay) => {
    const desktopGrid = overlay.querySelector<HTMLElement>(".mari-maps-workspace-grid");
    const mobileNav = overlay.querySelector<HTMLElement>('[aria-label="Map editor panes"]');
    if (!desktopGrid || !mobileNav) return null;
    const overlayRect = overlay.getBoundingClientRect();
    const gridRect = desktopGrid.getBoundingClientRect();
    const navRect = mobileNav.getBoundingClientRect();
    return {
      overlayRight: overlayRect.right,
      overlayBottom: overlayRect.bottom,
      desktopDisplay: getComputedStyle(desktopGrid).display,
      gridTemplateColumns: getComputedStyle(desktopGrid).gridTemplateColumns,
      grid: {
        left: gridRect.left,
        right: gridRect.right,
        top: gridRect.top,
        bottom: gridRect.bottom,
      },
      children: Array.from(desktopGrid.children).map((child) => {
        const rect = child.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
      }),
      mobileNav: {
        display: getComputedStyle(mobileNav).display,
        width: navRect.width,
        height: navRect.height,
        bottom: navRect.bottom,
      },
    };
  });
  expect(layout).not.toBeNull();
  if (mobile) {
    expect(layout!.desktopDisplay).toBe("none");
    expect(layout!.mobileNav.width).toBeGreaterThan(0);
    expect(layout!.mobileNav.height).toBeGreaterThan(0);
    expect(layout!.mobileNav.bottom).toBeLessThanOrEqual(layout!.overlayBottom + 1);
    return;
  }
  expect(layout!.desktopDisplay).toBe("grid");
  expect(layout!.children).toHaveLength(3);
  expect(layout!.grid.right).toBeLessThanOrEqual(layout!.overlayRight + 1);
  expect(layout!.grid.bottom).toBeLessThanOrEqual(layout!.overlayBottom + 1);
  expect(layout!.children.every((child) => child.width >= 240)).toBe(true);
  expect(Math.abs(layout!.children[0]!.top - layout!.children[1]!.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout!.children[1]!.top - layout!.children[2]!.top)).toBeLessThanOrEqual(1);
  expect(layout!.children[0]!.right).toBeLessThanOrEqual(layout!.children[1]!.left + 1);
  expect(layout!.children[1]!.right).toBeLessThanOrEqual(layout!.children[2]!.left + 1);
  expect(layout!.gridTemplateColumns.split(/\s+/u)).toHaveLength(3);
  await expect(page.locator('.mari-maps-workspace-grid section[aria-label^="Details for "]')).toBeVisible();
  await expect(page.locator(".mari-maps-workspace-grid").getByText("Linked lore", { exact: true })).toHaveCount(1);
}

async function expectAiBuilderLayout(page: Page, mobile: boolean) {
  await expectWorkspaceFillsOverlay(page);
  const layout = await page.locator(".mari-maps-ai-grid").evaluate((grid) => {
    const style = getComputedStyle(grid);
    return {
      columns: style.gridTemplateColumns,
      children: Array.from(grid.children).map((child) => {
        const rect = child.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width };
      }),
    };
  });
  expect(layout.children).toHaveLength(2);
  if (mobile) {
    expect(Math.abs(layout.children[0]!.left - layout.children[1]!.left)).toBeLessThanOrEqual(1);
    expect(layout.children[1]!.top).toBeGreaterThan(layout.children[0]!.top);
  } else {
    expect(layout.columns.split(/\s+/u)).toHaveLength(2);
    expect(layout.children[1]!.left).toBeGreaterThan(layout.children[0]!.left);
    expect(Math.abs(layout.children[0]!.top - layout.children[1]!.top)).toBeLessThanOrEqual(1);
  }
}

async function openGameSetupMapDraftReview(page: Page, testInfo: TestInfo) {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: `E2 Setup Map ${suffix}`,
      mode: "game",
      characterIds: [],
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as Record<string, unknown> & { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const connection = {
    id: `e2-connection-${suffix}`,
    name: `E2 Setup Connection ${suffix}`,
    provider: "openai",
    model: "e2-test-model",
    isDefault: false,
  };
  let setupPersisted = false;

  await page.route("**/api/connections", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([connection]),
    });
  });
  await page.route("**/api/game/create", async (route) => {
    const request = route.request().postDataJSON() as {
      chatId: string;
      connectionId?: string;
      setupConfig: Record<string, unknown>;
    };
    expect(request.chatId).toBe(chat.id);
    expect(request.connectionId).toBe(connection.id);
    expect(request.setupConfig).not.toHaveProperty("draftSpatialMap");
    await route.continue();
  });
  await page.route("**/api/game/setup", async (route) => {
    const request = route.request().postDataJSON() as { chatId: string; connectionId?: string };
    expect(request.chatId).toBe(chat.id);
    expect(request.connectionId).toBe(connection.id);
    const readyResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameSessionStatus: "ready",
        gameWorldOverview: "A fogbound coast ruled by rival harbor guilds.",
      },
    });
    expect(readyResponse.ok()).toBeTruthy();
    setupPersisted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        setup: { worldOverview: "A fogbound coast ruled by rival harbor guilds." },
        worldOverview: "A fogbound coast ruled by rival harbor guilds.",
        gameNpcs: [],
      }),
    });
  });
  await page.route(`**/api/chats/${chat.id}/spatial-context/generate`, async (route) => {
    expect(setupPersisted).toBe(true);
    const request = route.request().postDataJSON() as {
      operation: string;
      size: string;
      connectionId?: string;
      debugMode: boolean;
    };
    expect(request).toMatchObject({
      operation: "create",
      size: "small",
      connectionId: connection.id,
      debugMode: false,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        operation: "create",
        size: "small",
        source: "game_setup",
        generatedLocationCount: gameGeneratedDefinition.locations.length,
        definition: gameGeneratedDefinition,
      }),
    });
  });

  await page.addInitScript(
    ({ chatId }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
          },
          version: 72,
        }),
      );
    },
    { chatId: chat.id },
  );
  await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
  await page.goto("/");
  await dismissOnboardingTutorial(page);

  await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();
  const wizard = page.getByRole("dialog", { name: "New Game" });
  await wizard.locator("select").first().selectOption(connection.id);
  for (const heading of ["World", "Party", "Goals", "Lorebooks"]) {
    await wizard.getByRole("button", { name: "Next" }).click();
    await expect(wizard.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await wizard.getByRole("button", { name: /Draft with AI/ }).click();
  await wizard.getByRole("button", { name: /Small About 8 places/ }).click();
  await wizard.getByRole("button", { name: "Next" }).click();
  await wizard.getByRole("button", { name: "Next" }).click();
  await wizard.getByRole("button", { name: "Start Game" }).click();

  await expect(page.getByRole("heading", { name: "Draft the map with AI" })).toBeVisible();
  await expect(page.getByText(/Your game world is ready/)).toBeVisible();
  await expect(page.getByText("Validated", { exact: true })).toBeVisible();
  await expect(page.getByText("4 new locations", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use this draft" })).toBeVisible();
  await expectAiBuilderLayout(page, testInfo.project.name.includes("mobile"));

  return { chat };
}

test("AI map builder previews a validated local draft before save", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const response = await page.request.post("/api/chats", {
    data: {
      name: "AI Map Builder Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const mobile = testInfo.project.name.includes("mobile");

  await page.route(`**/api/chats/${chat.id}/spatial-context/generate`, async (route) => {
    const request = route.request().postDataJSON() as {
      operation: string;
      size: string;
      instructions?: string;
      debugMode: boolean;
    };
    expect(request).toMatchObject({
      operation: "create",
      size: "small",
      instructions: "A foggy port with a lighthouse and secret sewers.",
      debugMode: false,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        operation: "create",
        size: "small",
        source: "roleplay_setup",
        generatedLocationCount: generatedDefinition.locations.length,
        definition: generatedDefinition,
      }),
    });
  });

  try {
    await page.addInitScript(
      ({ chatId, openEditor }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        if (!openEditor) return;
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            state: {
              hasCompletedOnboarding: true,
              rightPanelOpen: false,
              sidebarOpen: false,
              spatialMapDetailChatId: chatId,
            },
            version: 72,
          }),
        );
      },
      { chatId: chat.id, openEditor: mobile },
    );
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    if (!mobile) {
      await page.getByRole("button", { name: "Chat Settings" }).click();
      const drawer = page.locator(".mari-chat-settings-drawer");
      await drawer.getByText("Hierarchical map", { exact: true }).click();
      await drawer.getByRole("button", { name: "Create hierarchical map" }).click();
    }

    await expectWorkspaceFillsOverlay(page);
    await page.getByRole("button", { name: "Draft with AI" }).click();
    await expect(page.getByRole("heading", { name: "Draft the map with AI" })).toBeVisible();
    await expectAiBuilderLayout(page, mobile);
    await page.getByLabel("What should this world include?").fill("A foggy port with a lighthouse and secret sewers.");
    await page.getByRole("button", { name: /Small About 8 places/ }).click();
    await page.getByRole("button", { name: "Generate draft" }).click();
    await expect(page.getByText("Validated", { exact: true })).toBeVisible();
    await expect(page.getByText("4 new locations", { exact: true })).toBeVisible();
    await expect(page.getByText("Shrouded Coast", { exact: true })).toBeVisible();

    const beforeApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await beforeApply.json()) as { definition: unknown }).definition).toBeNull();

    await page.getByRole("button", { name: "Use this draft" }).click();
    await expect(page.getByText("AI map draft applied. Review it, then Save.")).toBeVisible();
    const hierarchy = page.locator('section[aria-label="Location hierarchy"]:visible');
    await expect(hierarchy.getByRole("button", { name: "Shrouded Coast region" })).toBeVisible();

    const afterApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await afterApply.json()) as { definition: unknown }).definition).toBeNull();

    await page.getByLabel("Disabled", { exact: true }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const stored = (await storedResponse.json()) as {
      definition: { enabled: boolean; locations: Array<{ name: string }> };
    };
    expect(stored.definition.enabled).toBe(true);
    expect(stored.definition.locations.map((location) => location.name)).toEqual([
      "Shrouded Coast",
      "Gloam Harbor",
      "Blackglass Lighthouse",
      "Old Sewers",
    ]);
  } finally {
    if (!mobile) await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("AI map expansion preserves a campaign map and its current location", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const response = await page.request.post("/api/chats", {
    data: {
      name: "AI Map Expansion Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const mobile = testInfo.project.name.includes("mobile");

  const anchorResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
    data: {
      role: "assistant",
      content: "The campaign begins on the Shrouded Coast.",
    },
  });
  expect(anchorResponse.ok()).toBeTruthy();
  const initialSave = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: { ...generatedDefinition, enabled: true },
    },
  });
  expect(initialSave.ok()).toBeTruthy();
  expect(((await initialSave.json()) as { hasCommittedSpatialHistory: boolean }).hasCommittedSpatialHistory).toBe(true);

  await page.route(`**/api/chats/${chat.id}/spatial-context/generate`, async (route) => {
    const request = route.request().postDataJSON() as {
      operation: string;
      targetLocationId?: string;
      size: string;
      instructions?: string;
      debugMode: boolean;
    };
    expect(request).toMatchObject({
      operation: "expand",
      targetLocationId: "ai_world",
      size: "small",
      instructions: "Add a riverside ward with an inn for ferrymen.",
      debugMode: false,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        operation: "expand",
        targetLocationId: "ai_world",
        size: "small",
        source: "roleplay_setup",
        generatedLocationCount: 2,
        definition: expandedDefinition,
      }),
    });
  });

  try {
    await page.addInitScript(
      ({ chatId, openEditor }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        if (!openEditor) return;
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            state: {
              hasCompletedOnboarding: true,
              rightPanelOpen: false,
              sidebarOpen: false,
              spatialMapDetailChatId: chatId,
              musicPlayerEnabled: true,
              musicPlayerSource: "custom",
              spotifyMobileWidgetCollapsed: true,
              spotifyMobileWidgetPosition: { x: 16, y: 96 },
            },
            version: 72,
          }),
        );
      },
      { chatId: chat.id, openEditor: mobile },
    );
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    if (!mobile) {
      await page.getByRole("button", { name: "Chat Settings" }).click();
      const drawer = page.locator(".mari-chat-settings-drawer");
      await drawer.getByText("Hierarchical map", { exact: true }).click();
      await drawer.getByRole("button", { name: "Edit hierarchical map" }).click();
    } else {
      const mobileMusicLayer = page.locator('[data-component="MobileMusicWidgetLayer"]');
      const mobileMusicWidget = mobileMusicLayer.locator(".fixed");
      await expect(mobileMusicWidget).toHaveCount(1);
      const widgetIsCoveredByWorkspace = await mobileMusicWidget.evaluate((widget) => {
        const rect = widget.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return Boolean(hit?.closest("[data-marinara-maps-workspace-overlay]"));
      });
      expect(widgetIsCoveredByWorkspace).toBe(true);
      await expect(page.getByRole("button", { name: "Expand with AI" })).toBeVisible();
    }

    await expectAuthoringWorkspaceLayout(page, mobile);
    await page.getByRole("button", { name: "Expand Shrouded Coast" }).click();
    await page.getByRole("button", { name: "Enter Gloam Harbor" }).click();
    await expect(page.getByRole("heading", { name: "Gloam Harbor", exact: true })).toBeVisible();
    if (mobile) {
      await expect(page.getByRole("button", { name: "local", exact: true })).toHaveAttribute("aria-pressed", "true");
    }
    await expectAuthoringWorkspaceLayout(page, mobile);

    await page.getByRole("button", { name: "Expand with AI" }).click();
    await expect(page.getByRole("heading", { name: "Expand the map with AI" })).toBeVisible();
    await expectAiBuilderLayout(page, mobile);
    await expect(page.getByText(/Campaign history is protected/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Replace draft/ })).toHaveCount(0);
    await expect(page.getByLabel("Expand beneath")).toHaveValue("ai_world");
    await page.getByLabel("What should be added?").fill("Add a riverside ward with an inn for ferrymen.");
    await page.getByRole("button", { name: /Small About 8 places/ }).click();
    await page.getByRole("button", { name: "Generate expansion" }).click();
    await expect(page.getByText("Validated", { exact: true })).toBeVisible();
    await expect(page.getByText("2 new locations", { exact: true })).toBeVisible();
    await expect(page.getByText("Riverside Ward", { exact: true })).toBeVisible();

    const beforeApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await beforeApply.json()) as { definition: { locations: unknown[] } }).definition.locations).toHaveLength(4);

    await page.getByRole("button", { name: "Add to working map" }).click();
    await expect(page.getByText("AI expansion added to the working map. Review it, then Save.")).toBeVisible();

    const afterApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await afterApply.json()) as { definition: { locations: unknown[] } }).definition.locations).toHaveLength(4);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const stored = (await storedResponse.json()) as {
      currentLocationId: string;
      definition: { locations: Array<{ id: string }> };
    };
    expect(stored.currentLocationId).toBe("ai_world");
    expect(stored.definition.locations.map((location) => location.id)).toEqual([
      "ai_world",
      "ai_harbor",
      "ai_lighthouse",
      "ai_sewers",
      "ai_riverside",
      "ai_minnow",
    ]);

    if (mobile) {
      await page.getByRole("button", { name: "Back to chat" }).click();
      const mobileMusicLayer = page.locator('[data-component="MobileMusicWidgetLayer"]');
      await expect(mobileMusicLayer.locator(".fixed")).toBeVisible();
    }
  } finally {
    if (!mobile) await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Game setup hands an optional map draft into review before Save", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { chat } = await openGameSetupMapDraftReview(page, testInfo);

  try {
    const beforeApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(beforeApply.ok()).toBeTruthy();
    expect(((await beforeApply.json()) as { definition: unknown }).definition).toBeNull();

    await page.getByRole("button", { name: "Use this draft" }).click();
    await expect(page.getByText("AI map draft applied. Review it, then Save.")).toBeVisible();

    const mobile = testInfo.project.name.includes("mobile");
    await expectAuthoringWorkspaceLayout(page, mobile);
    await page.getByRole("button", { name: "Expand Shrouded Coast" }).click();
    await page.getByRole("button", { name: "Enter Gloam Harbor" }).click();
    await expect(page.getByRole("heading", { name: "Gloam Harbor", exact: true })).toBeVisible();
    if (mobile) {
      await expect(page.getByRole("button", { name: "local", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await expectAuthoringWorkspaceLayout(page, mobile);

    const afterApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await afterApply.json()) as { definition: unknown }).definition).toBeNull();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const stored = (await storedResponse.json()) as {
      currentLocationId: string;
      definition: { ownerMode: string; enabled: boolean; locations: Array<{ id: string }> };
    };
    expect(stored.currentLocationId).toBe("ai_world");
    expect(stored.definition.ownerMode).toBe("game");
    expect(stored.definition.enabled).toBe(true);
    expect(stored.definition.locations.map((location) => location.id)).toEqual([
      "ai_world",
      "ai_harbor",
      "ai_lighthouse",
      "ai_sewers",
    ]);
  } finally {
    if (!testInfo.project.name.includes("mobile")) await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Game setup can skip a generated map without persisting it", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { chat } = await openGameSetupMapDraftReview(page, testInfo);

  try {
    await page.getByRole("button", { name: "Skip map" }).click();
    await expect(page.getByRole("heading", { name: "Draft the map with AI" })).toHaveCount(0);
    await expect(page.getByText("Map draft skipped. You can build one later from Chat Settings.")).toBeVisible();

    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(storedResponse.ok()).toBeTruthy();
    expect(((await storedResponse.json()) as { definition: unknown }).definition).toBeNull();
  } finally {
    if (!testInfo.project.name.includes("mobile")) await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Roleplay stages story movement separately from prose and recovers stale turns", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: `Spatial Runtime ${testInfo.project.name}`,
      mode: "roleplay",
      characterIds: [],
      connectionId: "spatial-runtime-e2-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const runtimeDefinition = {
    ...generatedDefinition,
    enabled: true,
    revision: 0,
    startingLocationId: "ai_world",
    locations: generatedDefinition.locations.slice(0, 2),
  };
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: runtimeDefinition,
    },
  });
  expect(saveResponse.ok()).toBeTruthy();
  const saved = (await saveResponse.json()) as { definition: { revision: number }; currentLocationId: string };
  let generationRequestCount = 0;

  await page.route("**/api/generate", async (route) => {
    generationRequestCount += 1;
    const request = route.request().postDataJSON() as {
      chatId: string;
      userMessage: string;
      pendingSpatialTransition: {
        destinationId: string;
        expectedDefinitionRevision: number;
        expectedCurrentLocationId: string;
        commandId: string;
      };
    };
    expect(request.chatId).toBe(chat.id);
    expect(request.pendingSpatialTransition).toMatchObject({
      destinationId: "ai_harbor",
      expectedDefinitionRevision: saved.definition.revision,
      expectedCurrentLocationId: "ai_world",
    });
    expect(request.userMessage).not.toContain("moves to");
    if (generationRequestCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body:
          `data: ${JSON.stringify({
            type: "spatial_transition_committed",
            data: {
              chatId: chat.id,
              commandId: request.pendingSpatialTransition.commandId,
              currentLocationId: "ai_harbor",
              definitionRevision: saved.definition.revision,
            },
          })}\n\n` + `data: ${JSON.stringify({ type: "done", data: "" })}\n\n`,
      });
      return;
    }
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "The hierarchical map changed. Review the available destinations.",
        code: "spatial_transition_stale_definition",
        currentRevision: saved.definition.revision + 1,
        currentLocationId: "ai_world",
      }),
    });
  });

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({ state: { hasCompletedOnboarding: true, sidebarOpen: false }, version: 72 }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    const storyLocation = page.getByRole("region", { name: "Story location" });
    await expect(storyLocation).toContainText("Shrouded Coast");
    await storyLocation.getByRole("button", { name: /Story location.*Shrouded Coast/ }).click();
    await storyLocation.getByRole("button", { name: /Enter Gloam Harbor/ }).click();
    await expect(storyLocation.getByText("Moves with your next turn")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Story location" }).getByText("Moves with your next turn")).toBeVisible();
    const input = page.locator("textarea.mari-chat-input-textarea");
    await input.fill("I follow the harbor road.");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(page.getByText("Moves with your next turn")).toHaveCount(0);
    await expect(input).toHaveValue("");

    await storyLocation.getByRole("button", { name: /Story location.*Shrouded Coast/ }).click();
    await storyLocation.getByRole("button", { name: /Enter Gloam Harbor/ }).click();
    await input.fill("Wait for me at the gate.");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(input).toHaveValue("Wait for me at the gate.");
    await expect(storyLocation.getByText(/Needs review/)).toBeVisible();

    await page.reload();
    await expect(page.locator("textarea.mari-chat-input-textarea")).toHaveValue("Wait for me at the gate.");
    await expect(page.getByRole("region", { name: "Story location" }).getByText(/Needs review/)).toBeVisible();
  } finally {
    await page.unroute("**/api/generate");
    if (!testInfo.project.name.includes("mobile")) await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Game screen gives the hierarchical World map precedence over the session Local map", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: `Game World Map ${testInfo.project.name}`,
      mode: "game",
      characterIds: [],
      connectionId: "game-world-map-e2-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const sessionMap = {
    id: "the-crownscar",
    type: "node",
    name: "The Crownscar",
    description: "A game-created map stored in Session → Edit Spoilers → Maps.",
    nodes: [
      {
        id: "region_1",
        emoji: "🏘️",
        label: "Embercross",
        x: 50,
        y: 15,
        discovered: true,
        description: "A lively bridge-town serving as the safest base for expeditions.",
      },
      {
        id: "architect_s_shrine",
        emoji: "⛩️",
        label: "Architect's Shrine",
        x: 50,
        y: 50,
        discovered: true,
      },
    ],
    edges: [
      {
        from: "region_1",
        to: "architect_s_shrine",
      },
    ],
    partyPosition: "architect_s_shrine",
  };

  try {
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: `world-map-game-${chat.id}`,
        gameSessionStatus: "active",
        gameMaps: [sessionMap],
        gameMap: sessionMap,
        activeGameMapId: sessionMap.id,
        gameIntroPresented: true,
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    const spatialSave = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
      data: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition: {
          ...gameGeneratedDefinition,
          enabled: true,
        },
      },
    });
    expect(spatialSave.ok()).toBeTruthy();
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "Fog curls around the piers of the Shrouded Coast.",
      },
    });
    expect(messageResponse.ok()).toBeTruthy();

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            sidebarOpen: false,
            rightPanelOpen: false,
          },
          version: 72,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "Open map" }).click();
    }

    const mapView = page.getByRole("group", { name: "Map view" });
    await expect(mapView.getByRole("button", { name: "World" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("The Crownscar", { exact: true })).toHaveCount(0);
    const worldMap = page.getByRole("region", { name: "Hierarchical world map" });
    await expect(worldMap).toBeVisible();
    await expect(worldMap.getByRole("button", { name: /Gloam Harbor/ })).toBeVisible();
    await expect(worldMap.getByText("⚓", { exact: true })).toBeVisible();

    await worldMap.getByRole("button", { name: /Gloam Harbor/ }).click();
    await expect(worldMap.getByText("A busy harbor of black piers.")).toBeVisible();
    await expect(worldMap.getByRole("button", { name: "Set destination: Gloam Harbor" })).toBeVisible();

    await mapView.getByRole("button", { name: "Local" }).click();
    await expect(mapView.getByRole("button", { name: "Local" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("The Crownscar", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Hierarchical world map" })).toHaveCount(0);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Game Location Details binds and clears a tactical cell", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The binding editor interaction is covered on desktop.");
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Game Map Binding Smoke",
      mode: "game",
      characterIds: [],
      connectionId: "game-map-binding-e2-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const tacticalMap = {
    id: "coast-map",
    type: "grid",
    name: "Shrouded Coast Tactical Map",
    description: "A local tactical map.",
    width: 1,
    height: 1,
    cells: [
      {
        x: 0,
        y: 0,
        emoji: "⚓",
        label: "Harbor Gate",
        discovered: true,
        terrain: "city",
      },
    ],
    partyPosition: { x: 0, y: 0 },
  };

  try {
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: `binding-game-${chat.id}`,
        gameSessionStatus: "active",
        gameMaps: [tacticalMap],
        gameMap: tacticalMap,
        activeGameMapId: tacticalMap.id,
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    const spatialSave = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
      data: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition: {
          ...gameGeneratedDefinition,
          enabled: true,
          locations: gameGeneratedDefinition.locations.slice(0, 2),
        },
      },
    });
    expect(spatialSave.ok()).toBeTruthy();

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            sidebarOpen: false,
            rightPanelOpen: false,
            spatialMapDetailChatId: chatId,
          },
          version: 72,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    await expect(page.getByText("Game map binding", { exact: true })).toBeVisible();
    await page.getByLabel("Map position").selectOption("cell:0:0");
    await page.getByRole("button", { name: "Bind to this location" }).click();
    await expect(page.getByRole("button", { name: "Bound here" })).toBeVisible();

    const boundChatResponse = await page.request.get(`/api/chats/${chat.id}`);
    const boundChat = (await boundChatResponse.json()) as { metadata: unknown };
    const boundMetadata =
      typeof boundChat.metadata === "string"
        ? (JSON.parse(boundChat.metadata) as { gameMaps: Array<{ cells: Array<{ spatialLocationId?: string }> }> })
        : (boundChat.metadata as { gameMaps: Array<{ cells: Array<{ spatialLocationId?: string }> }> });
    expect(boundMetadata.gameMaps[0]?.cells[0]?.spatialLocationId).toBe("ai_world");

    await page.getByRole("button", { name: "Clear binding" }).click();
    await expect(page.getByText("Unbound tactical position", { exact: true })).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});
