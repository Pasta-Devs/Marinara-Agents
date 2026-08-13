import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

type CapturedOpenAiRequest = {
  messages?: Array<{ role?: string; content?: unknown }>;
};

async function startOpenAiTestServer(responses: string[]) {
  const requests: CapturedOpenAiRequest[] = [];
  let responseIndex = 0;
  const server = createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
      response.writeHead(404, { "Content-Type": "application/json", Connection: "close" });
      response.end(JSON.stringify({ error: { message: "Unexpected test-provider request." } }));
      return;
    }

    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as CapturedOpenAiRequest;
        requests.push(parsed);
        const content = responses[Math.min(responseIndex, responses.length - 1)] ?? "Continue.";
        responseIndex += 1;
        response.writeHead(200, { "Content-Type": "application/json", Connection: "close" });
        response.end(
          JSON.stringify({
            id: `chatcmpl-maps-${responseIndex}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1_000),
            model: "maps-authority-e2e",
            choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
            usage: { prompt_tokens: 8, completion_tokens: 8, total_tokens: 16 },
          }),
        );
      } catch (error) {
        response.writeHead(400, { "Content-Type": "application/json", Connection: "close" });
        response.end(JSON.stringify({ error: { message: String(error) } }));
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test provider did not bind a TCP port.");

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function capturedPrompt(request: CapturedOpenAiRequest | undefined): string {
  return (request?.messages ?? [])
    .map((message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content)))
    .join("\n\n");
}

function promptText(messages: Array<{ content?: unknown }>): string {
  return messages
    .map((message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content)))
    .join("\n\n");
}

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

function expectNormalizedSpatialPrompt(
  value: string,
  ownerMode: "roleplay" | "game",
  source: string,
  loreMarkers: {
    forced: string;
    duplicate: string;
    disabled: string;
    excluded: string;
    oversized: string;
  },
  expectedLocation: {
    path: string;
    id: string;
    forcedLore: boolean;
  } = {
    path: "Shrouded Coast > Gloam Harbor",
    id: "ai_harbor",
    forcedLore: true,
  },
): string {
  expect(
    countOccurrences(value, `<spatial_context mode="${ownerMode}" authority="application">`),
    `${source} must contain one spatial projection`,
  ).toBe(1);
  expect(value, `${source} must contain the current path`).toContain(`Current path: ${expectedLocation.path}`);
  expect(value, `${source} must contain the current location ID`).toContain(
    `Current location ID: ${expectedLocation.id}`,
  );
  expect(countOccurrences(value, loreMarkers.forced), `${source} must scope forced-only lore to its location`).toBe(
    expectedLocation.forcedLore ? 1 : 0,
  );
  expect(countOccurrences(value, loreMarkers.duplicate), `${source} must deduplicate ordinary and forced lore`).toBe(1);
  expect(value, `${source} must exclude disabled lore`).not.toContain(loreMarkers.disabled);
  expect(value, `${source} must honor chat lore exclusions`).not.toContain(loreMarkers.excluded);
  expect(value, `${source} must omit over-budget location lore`).not.toContain(loreMarkers.oversized);

  const block = value.match(/<spatial_context\b[^>]*>[\s\S]*?<\/spatial_context>/u)?.[0];
  expect(block).toBeTruthy();
  return block!.replace(/\r\n/gu, "\n").trim();
}

async function generateTurn(
  page: Page,
  data: Record<string, unknown>,
): Promise<Array<{ type?: string; data?: unknown }>> {
  const response = await page.request.post("/api/generate", {
    data: {
      streaming: false,
      skipPresenceDelay: true,
      musicPlayerEnabled: false,
      ...data,
    },
  });
  const body = await response.text();
  expect(response.ok(), body).toBeTruthy();
  return body
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as { type?: string; data?: unknown });
}

function savedAssistantMessage(events: Array<{ type?: string; data?: unknown }>, source: string) {
  const saved = events.find((event) => event.type === "message_saved")?.data as
    | { id?: unknown; role?: unknown; activeSwipeIndex?: unknown; content?: unknown }
    | undefined;
  expect(saved, `${source} must save an assistant message`).toBeTruthy();
  expect(saved?.role, `${source} must save an assistant role`).toBe("assistant");
  expect(typeof saved?.id, `${source} must return the saved message ID`).toBe("string");
  return saved as { id: string; role: "assistant"; activeSwipeIndex: number; content: string };
}

async function expectDeletedInOrder(page: Page, paths: Array<string | null>) {
  const failures: string[] = [];
  for (const path of paths) {
    if (!path) continue;
    const response = await page.request.delete(path);
    if (!response.ok()) failures.push(`DELETE ${path} returned ${response.status()}: ${await response.text()}`);
  }
  expect(failures).toEqual([]);
}

async function expectDeleted(page: Page, path: string) {
  await expectDeletedInOrder(page, [path]);
}

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

const regeneratedDefinition = {
  ...generatedDefinition,
  locations: generatedDefinition.locations.map((location) =>
    location.id === "ai_world"
      ? {
          ...location,
          name: "Recharted Coast",
          description: "A coast redrawn around a safer harbor approach.",
        }
      : location,
  ),
} as const;

const expandedDefinition = {
  ...generatedDefinition,
  enabled: true,
  revision: 1,
  locations: [
    ...generatedDefinition.locations,
    {
      id: "ai_riverside",
      parentId: "ai_harbor",
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

const longLocationLabel =
  "The Observatory of Patient Stars Beyond the Lantern Archive and the Twelve Weathered Gates of the Northern Reach";

const deepMapDefinition = {
  schemaVersion: 1,
  ownerMode: "roleplay",
  enabled: true,
  revision: 0,
  startingLocationId: "deep-00",
  locations: Array.from({ length: 12 }, (_, index) => ({
    id: `deep-${String(index).padStart(2, "0")}`,
    parentId: index === 0 ? null : `deep-${String(index - 1).padStart(2, "0")}`,
    name: `${longLocationLabel} ${String(index + 1).padStart(2, "0")}`,
    kind: index === 0 ? "region" : index % 3 === 0 ? "building" : "place",
    description: `A deliberately deep browser-recovery fixture at level ${index + 1}.`,
    modelMemory: `Deep-map anchor ${index + 1}.`,
    icon: index === 0 ? "🌌" : "📍",
    childPresentation: "map",
    placement: { x: 50, y: 50 },
    links:
      index === 0
        ? [{ targetId: "deep-01", label: "Archive stair", bidirectional: true, state: "available" }]
        : [],
    status: "active",
    sortOrder: 0,
  })),
} as const;

const gameGeneratedDefinition = {
  ...generatedDefinition,
  ownerMode: "game",
} as const;

const acceptedGameSetupMap = {
  id: "shrouded-coast",
  type: "node",
  name: "Shrouded Coast",
  description: "A game-created starting map accepted before the hierarchy draft.",
  nodes: [
    {
      id: "gloam-harbor",
      emoji: "⚓",
      label: "Gloam Harbor",
      x: 20,
      y: 55,
      discovered: true,
      description: "A busy harbor of black piers.",
    },
    {
      id: "blackglass-lighthouse",
      emoji: "🗼",
      label: "Blackglass Lighthouse",
      x: 72,
      y: 25,
      discovered: true,
      description: "A dark lighthouse on the cliffs.",
    },
    {
      id: "old-sewers",
      emoji: "🕳️",
      label: "Old Sewers",
      x: 55,
      y: 82,
      discovered: false,
      description: "Flooded tunnels beneath the coast.",
      spatialLocationId: "existing-old-sewers-binding",
    },
  ],
  edges: [
    { from: "gloam-harbor", to: "blackglass-lighthouse" },
    { from: "blackglass-lighthouse", to: "old-sewers" },
  ],
  partyPosition: "gloam-harbor",
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

type HierarchicalMapsAgentConfig = {
  id: string;
  type: string;
  description: string;
  phase: "pre_generation" | "parallel" | "post_processing";
  connectionId: string | null;
  settings?: unknown;
};

async function getOrCreateHierarchicalMapsAgentConfig(
  page: Page,
): Promise<{ config: HierarchicalMapsAgentConfig; created: boolean }> {
  const agentsResponse = await page.request.get("/api/agents");
  expect(agentsResponse.ok(), await agentsResponse.text()).toBeTruthy();
  const existing = ((await agentsResponse.json()) as HierarchicalMapsAgentConfig[]).find(
    (agent) => agent.type === "hierarchical-maps",
  );
  if (existing) {
    const settings = (() => {
      if (typeof existing.settings !== "string") {
        return existing.settings && typeof existing.settings === "object" && !Array.isArray(existing.settings)
          ? { ...(existing.settings as Record<string, unknown>) }
          : {};
      }
      try {
        const parsed = JSON.parse(existing.settings) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? { ...(parsed as Record<string, unknown>) }
          : {};
      } catch {
        return {};
      }
    })();
    if (settings.deletedFromLibrary !== true) return { config: existing, created: false };

    // Built-in agent deletion is a soft delete. Revive a suite-created row for this test,
    // while retaining cleanup ownership so the original absent state is restored afterward.
    delete settings.deletedFromLibrary;
    const reviveAgentResponse = await page.request.patch(`/api/agents/${existing.id}`, {
      data: { settings },
    });
    expect(reviveAgentResponse.ok(), await reviveAgentResponse.text()).toBeTruthy();
    return {
      config: (await reviveAgentResponse.json()) as HierarchicalMapsAgentConfig,
      created: true,
    };
  }

  const createAgentResponse = await page.request.post("/api/agents", {
    data: {
      type: "hierarchical-maps",
      name: "World Maps",
      description:
        "Adds persistent hierarchical locations, durable shared worlds, reusable artwork, customizable Direct Link lines, and movement to Roleplay and Game. Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay and Game modes.",
      phase: "pre_generation",
      connectionId: null,
      imagePath: null,
      promptTemplate: "",
      settings: {},
    },
  });
  expect(createAgentResponse.ok(), await createAgentResponse.text()).toBeTruthy();
  return {
    config: (await createAgentResponse.json()) as HierarchicalMapsAgentConfig,
    created: true,
  };
}

async function openHierarchicalMapsAgentCategory(page: Page) {
  const drawer = page.locator(".mari-chat-settings-drawer");
  await expect(drawer).toBeVisible();
  await expect(
    drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^World map/ }),
  ).toHaveCount(0);
  await drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ }).click();
  const enableAgents = drawer.getByRole("checkbox", { name: /^Enable Agents/ });
  if (!(await enableAgents.isChecked())) {
    await drawer.getByText("Enable Agents", { exact: true }).click();
    await expect(enableAgents).toBeChecked();
  }
  await drawer.getByRole("button", { name: /Tracker Agents/ }).click();
  return drawer;
}

async function openHierarchicalMapsAgentControls(page: Page) {
  const drawer = await openHierarchicalMapsAgentCategory(page);
  const agentEntry = drawer.locator('[data-chat-agent-entry="hierarchical-maps"]');
  await expect(agentEntry).toBeVisible();
  return { drawer, agentEntry };
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

async function expectMinimumInteractiveSize(locator: Locator, source: string) {
  await expect(locator, `${source} must be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${source} must have measurable browser geometry`).not.toBeNull();
  expect(box!.width, `${source} must be at least 44 CSS pixels wide`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${source} must be at least 44 CSS pixels tall`).toBeGreaterThanOrEqual(44);
}

async function computedBackgroundAlpha(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const color = getComputedStyle(element).backgroundColor;
    if (color === "transparent") return 0;
    const rgba = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
    return rgba ? Number(rgba[1]) : 1;
  });
}

async function expectWorkspaceTheme(
  page: Page,
  expected: { theme: "dark" | "light"; visualTheme: "default" | "sillytavern" },
) {
  await expectWorkspaceFillsOverlay(page);
  const appearance = await page.locator("[data-marinara-maps-workspace-overlay]").evaluate((overlay) => {
    const root = document.documentElement;
    const shell = overlay.querySelector<HTMLElement>(".mari-editor-shell");
    const title = overlay.querySelector<HTMLElement>("h1, h2");
    if (!shell || !title) return null;
    const shellStyle = getComputedStyle(shell);
    const titleStyle = getComputedStyle(title);
    return {
      theme: root.dataset.theme ?? null,
      visualTheme: root.dataset.visualTheme ?? null,
      shellBackground: shellStyle.backgroundColor,
      titleColor: titleStyle.color,
      viewportOverflow: document.documentElement.scrollWidth - window.innerWidth,
      overlayOverflow: overlay.scrollWidth - overlay.clientWidth,
    };
  });
  expect(appearance).not.toBeNull();
  expect(appearance!.theme).toBe(expected.theme);
  expect(appearance!.visualTheme).toBe(expected.visualTheme === "default" ? null : expected.visualTheme);
  expect(appearance!.shellBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(appearance!.titleColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(appearance!.titleColor).not.toBe(appearance!.shellBackground);
  expect(appearance!.viewportOverflow).toBeLessThanOrEqual(1);
  expect(appearance!.overlayOverflow).toBeLessThanOrEqual(1);
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

async function openGameSetupMapDraftReview(
  page: Page,
  testInfo: TestInfo,
  planMode: "ai" | "template" | "shared-world" = "ai",
) {
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
  let template: { id: string; revision: number; name: string } | null = null;
  let sharedWorld: {
    id: string;
    revision: number;
    name: string;
    data: unknown;
  } | null = null;
  if (planMode === "template" || planMode === "shared-world") {
    const spatialResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(spatialResponse.ok(), await spatialResponse.text()).toBeTruthy();
    const spatial = (await spatialResponse.json()) as { hierarchyProfile: unknown };
    if (planMode === "template") {
      const templateResponse = await page.request.post("/api/chats/spatial-context/templates", {
        data: {
          name: `Setup Template ${suffix}`,
          description: "A reusable Game setup template fixture.",
          definition: { ...gameGeneratedDefinition, ownerMode: "roleplay", enabled: false, revision: 0 },
          hierarchyProfile: spatial.hierarchyProfile,
        },
      });
      expect(templateResponse.ok(), await templateResponse.text()).toBeTruthy();
      template = (await templateResponse.json()) as { id: string; revision: number; name: string };
    } else {
      const sharedWorldResponse = await page.request.post("/api/chats/spatial-context/shared-worlds", {
        data: {
          name: `Setup Shared World ${suffix}`,
          description: "A canonical shared world selected during Game setup.",
          definition: { ...gameGeneratedDefinition, ownerMode: "roleplay", enabled: true, revision: 0 },
          hierarchyProfile: spatial.hierarchyProfile,
        },
      });
      expect(sharedWorldResponse.ok(), await sharedWorldResponse.text()).toBeTruthy();
      sharedWorld = (await sharedWorldResponse.json()) as NonNullable<typeof sharedWorld>;
    }
  }
  const connection = {
    id: `e2-connection-${suffix}`,
    name: `E2 Setup Connection ${suffix}`,
    provider: "openai",
    model: "e2-test-model",
    isDefault: false,
  };
  let setupPersisted = false;
  let createRequestCount = 0;

  await page.route("**/api/connections", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([connection]),
    });
  });
  await page.route("**/api/game/create", async (route) => {
    createRequestCount += 1;
    const request = route.request().postDataJSON() as {
      chatId: string;
      connectionId?: string;
      setupConfig: Record<string, unknown>;
    };
    expect(request.chatId).toBe(chat.id);
    expect(request.connectionId).toBe(connection.id);
    expect(request.setupConfig).not.toHaveProperty("draftSpatialMap");
    expect(request.setupConfig.gameWorldMapMode).toBe("hierarchical");
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
        gameMaps: [],
        gameMap: null,
        activeGameMapId: null,
        gameInitialMapFallback: acceptedGameSetupMap,
      },
    });
    expect(readyResponse.ok()).toBeTruthy();
    const previewResponse = await page.request.post(`/api/chats/${chat.id}/spatial-context/generation-prompt/preview`, {
      data: {
        operation: "create",
        size: "small",
        groundingMode: "setup",
        sourceLorebookIds: [],
        debugMode: false,
      },
    });
    expect(previewResponse.ok(), await previewResponse.text()).toBeTruthy();
    const preview = (await previewResponse.json()) as { system?: string; user?: string };
    const previewPrompt = `${preview.system ?? ""}\n${preview.user ?? ""}`;
    expect(previewPrompt).not.toContain("accepted_game_setup_map");
    expect(previewPrompt).not.toContain("Required accepted Game map location names");
    expect(previewPrompt).not.toContain(acceptedGameSetupMap.name);
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
    expect(planMode).toBe("ai");
    expect(setupPersisted).toBe(true);
    const request = route.request().postDataJSON() as {
      operation: string;
      size: string;
      targetLocationCount?: number;
      connectionId?: string;
      debugMode: boolean;
    };
    expect(request).toMatchObject({
      operation: "create",
      size: "small",
      targetLocationCount: 8,
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
  await wizard.getByRole("button", { name: "Next" }).click();
  await expect(wizard.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
  await wizard.getByRole("button", { name: /Enable Agents/ }).click();
  if (planMode === "template") {
    await expect(wizard.getByRole("button", { name: /Draft with AI/ })).toBeVisible();
    await expect(wizard.getByRole("button", { name: /Create manually/ })).toBeVisible();
    await wizard.getByRole("button", { name: /Use a template/ }).click();
    expect(createRequestCount).toBe(0);
    const library = page.locator("[data-marinara-map-template-library]");
    await expect(library.getByRole("heading", { name: "Map templates", exact: true })).toBeVisible();
    const card = library.getByRole("heading", { name: template!.name }).locator("xpath=ancestor::article");
    await card.getByRole("button", { name: "Use template", exact: true }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Use this map template?" });
    await confirm.getByRole("button", { name: "Use template", exact: true }).click();
    await expect(library).toHaveCount(0);
    await expect(wizard).toContainText(`Selected map template: ${template!.name}`);
    expect(createRequestCount).toBe(0);
  } else if (planMode === "shared-world") {
    await expect(wizard.getByRole("button", { name: /Use a template or shared world/ })).toBeVisible();
    await wizard.getByRole("button", { name: /Use a template or shared world/ }).click();
    expect(createRequestCount).toBe(0);
    const library = page.locator("[data-marinara-map-template-library]");
    await expect(library.getByRole("heading", { name: "Shared worlds", exact: true })).toBeVisible();
    const card = library.getByRole("heading", { name: sharedWorld!.name }).locator("xpath=ancestor::article");
    await card.getByRole("button", { name: "Use shared world", exact: true }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Use this shared world?" });
    await confirm.getByRole("button", { name: "Use shared world", exact: true }).click();
    await expect(library).toHaveCount(0);
    await expect(wizard).toContainText(`Selected shared world: ${sharedWorld!.name}`);
    expect(createRequestCount).toBe(0);
  } else {
    await wizard.getByRole("button", { name: /Draft with AI/ }).click();
    await wizard.getByRole("button", { name: /Small About 8 places/ }).click();
    await expect(wizard.getByLabel("Custom place target")).toHaveValue("8");
  }
  await wizard.getByRole("button", { name: "Next" }).click();
  await expect(wizard.getByRole("heading", { name: "GM", exact: true })).toBeVisible();
  await wizard.getByRole("button", { name: "Start Game" }).click();

  if (planMode === "template") {
    await expect(page.locator("[data-marinara-map-template-library]")).toHaveCount(0);
    await expect(page.locator("[data-marinara-maps-workspace-root]")).toBeVisible();
    return { chat, template, sharedWorld };
  }
  if (planMode === "shared-world") {
    await expect(wizard).toHaveCount(0);
    await expect
      .poll(async () => {
        const response = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        if (!response.ok()) return null;
        const spatial = (await response.json()) as { sharedWorld?: { mode?: string; worldId?: string } };
        return spatial.sharedWorld?.mode === "linked" ? spatial.sharedWorld.worldId : null;
      })
      .toBe(sharedWorld!.id);
    return { chat, template, sharedWorld };
  }

  await expect(page.getByRole("heading", { name: "Draft the map with AI" })).toBeVisible();
  await expect(page.getByText(/Your game world is ready/)).toBeVisible();
  await expect(page.getByText("Validated", { exact: true })).toBeVisible();
  await expect(page.getByText("4 locations · 2 levels · not saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to editor" })).toBeVisible();
  await expectAiBuilderLayout(page, testInfo.project.name.includes("mobile"));

  return { chat, template, sharedWorld };
}

test("World Maps activates inside its Tracker Agents entry", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const response = await page.request.post("/api/chats", {
    data: {
      name: "Maps Activation UX Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const resetMetadata = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { enableAgents: false, activeAgentIds: [] },
  });
  expect(resetMetadata.ok()).toBeTruthy();

  try {
    await page.addInitScript((chatId) => {
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
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "More options" }).click();
      const overflowMenu = page.locator("[data-chat-toolbar-overflow-menu]");
      await expect(overflowMenu).toBeVisible();
      await overflowMenu.getByRole("button", { name: "Chat Settings" }).click();
    } else {
      await page.getByRole("button", { name: "Chat Settings" }).click();
    }
    const drawer = await openHierarchicalMapsAgentCategory(page);
    await drawer.getByRole("button").filter({ hasText: /^World Maps/ }).click();
    const addDialog = page.getByRole("dialog", { name: "Add World Maps" });
    await expect(addDialog).toBeVisible();
    await addDialog.getByRole("button", { name: "Add", exact: true }).click();

    const agentEntry = drawer.locator('[data-chat-agent-entry="hierarchical-maps"]');
    await expect(agentEntry).toBeVisible();
    const activation = agentEntry.getByRole("switch", { name: /Enable World Maps/ });
    await expect(activation).toHaveAttribute("aria-checked", "true");
    const activationHeight = await activation.evaluate((element) => element.getBoundingClientRect().height);
    expect(activationHeight).toBeGreaterThanOrEqual(44);
    await expect(agentEntry.getByRole("button", { name: "Set up world map" })).toBeVisible();

    await expect
      .poll(async () => {
        const chatResponse = await page.request.get(`/api/chats/${chat.id}`);
        const stored = (await chatResponse.json()) as { metadata?: unknown };
        const metadata =
          typeof stored.metadata === "string"
            ? (JSON.parse(stored.metadata) as { enableAgents?: boolean; activeAgentIds?: string[] })
            : ((stored.metadata ?? {}) as { enableAgents?: boolean; activeAgentIds?: string[] });
        return {
          enableAgents: metadata.enableAgents,
          activeAgentIds: metadata.activeAgentIds,
        };
      })
      .toEqual({ enableAgents: true, activeAgentIds: ["hierarchical-maps"] });
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}`);
  }
});

test("global World Maps home activates and opens the current chat map", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const response = await page.request.post("/api/chats", {
    data: {
      name: "Maps Global Home Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const { config: mapsAgentBefore, created: mapsAgentCreated } =
    await getOrCreateHierarchicalMapsAgentConfig(page);
  const originalMapsAgentConfig: {
    description: string;
    phase: "pre_generation" | "parallel" | "post_processing";
    connectionId: string | null;
  } = {
    description:
      mapsAgentBefore?.description ??
      "Adds persistent hierarchical locations, spatial context, map authoring, and movement to Roleplay and Game. Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay and Game modes.",
    phase: mapsAgentBefore?.phase ?? "pre_generation",
    connectionId: mapsAgentBefore?.connectionId ?? null,
  };
  const originalMapsAgentSettings = (() => {
    if (typeof mapsAgentBefore?.settings === "string") {
      try {
        const parsed = JSON.parse(mapsAgentBefore.settings) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    return mapsAgentBefore?.settings && typeof mapsAgentBefore.settings === "object"
      ? (mapsAgentBefore.settings as Record<string, unknown>)
      : {};
  })();
  let secondaryChat: { id: string } | null = null;
  const isolatedMapsAgentSettings = { ...originalMapsAgentSettings };
  delete isolatedMapsAgentSettings.spatialMapGenerationPromptLibraries;
  delete isolatedMapsAgentSettings.spatialMapTurnPromptTemplates;
  const unavailableConnectionId = `missing-maps-connection-${testInfo.project.name}`;
  const mobile = testInfo.project.name.includes("mobile");

  try {
    const isolateSettingsResponse = await page.request.patch("/api/agents/type/hierarchical-maps", {
      data: {
        connectionId: unavailableConnectionId,
        settings: isolatedMapsAgentSettings,
      },
    });
    expect(isolateSettingsResponse.ok(), await isolateSettingsResponse.text()).toBeTruthy();
    const resetMetadata = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: false, activeAgentIds: [] },
    });
    expect(resetMetadata.ok(), await resetMetadata.text()).toBeTruthy();
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
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
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    await page.locator('[data-tour="panel-agents"]').click();
    const agentsPanel = page.locator(
      mobile ? '[data-component="RightPanelMobile"]' : '[data-component="RightPanelDesktop"]',
    );
    await expect(agentsPanel).toBeVisible();
    const mapsCard = agentsPanel.locator('[data-agent-name="World Maps"]');
    await expect(mapsCard).toBeVisible();
    await mapsCard.getByText("World Maps", { exact: true }).click();

    const home = page.locator("[data-marinara-maps-home]");
    await expect(home).toBeVisible();
    await expect(home).toHaveClass(/mari-editor-shell/u);
    await expect(home.locator(":scope > .mari-editor-header")).toBeVisible();
    await expect(home.locator(":scope > .mari-editor-header .mari-editor-header-main")).toBeVisible();
    await expect(home.getByRole("heading", { name: "Installed package", exact: true })).toBeVisible();
    await expect(home.getByRole("heading", { name: "Current chat", exact: true })).toBeVisible();
    await expect(home.getByRole("heading", { name: "World Maps", exact: true })).toBeVisible();
    await expect(home.locator(".mari-editor-header")).toContainText("v1.3.6");
    await expect(home.getByRole("heading", { name: "Description", exact: true })).toBeVisible();
    await expect(home.getByRole("heading", { name: "Pipeline Phase", exact: true })).toBeVisible();
    await expect(home.getByRole("button", { name: "Pre-Generation", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(home.getByRole("button", { name: "Parallel", exact: true })).toBeDisabled();
    await expect(home.getByRole("heading", { name: "Connection Override", exact: true })).toBeVisible();
    const connectionOverride = home.getByRole("combobox", { name: "Connection Override" });
    await expect(connectionOverride).toHaveValue(unavailableConnectionId);
    await expect(connectionOverride.getByRole("option", { name: "Saved connection (unavailable)" })).toHaveCount(1);
    await expect(home.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await expect(home).toContainText("Maps Global Home Smoke · Roleplay");
    await expect(home).toContainText("Installed in Marinara, but not active in this chat yet.");
    await expect(page.getByText("System Prompt", { exact: true })).toHaveCount(0);

    const activation = home.getByRole("switch", { name: /Enable World Maps/ });
    const createMap = home.getByRole("button", { name: "Create map", exact: true });
    await expect(activation).toHaveAttribute("aria-checked", "false");
    await expect(createMap).toBeDisabled();
    await expectMinimumInteractiveSize(activation, "Global Maps activation control");
    await expectMinimumInteractiveSize(home.getByRole("button", { name: "Manage package" }), "Manage package control");
    await expectMinimumInteractiveSize(home.getByRole("button", { name: "Back to Agents" }), "Global Maps back control");

    await activation.click();
    await expect(activation).toHaveAttribute("aria-checked", "true");
    await expect(home).toContainText("Active in this chat. Saved map context can participate in turns.");
    await expect(createMap).toBeEnabled();
    await expect(home.getByRole("heading", { name: "Location types", exact: true })).toBeVisible();
    await expect(home).toContainText("Create or import a map first");
    await expect(home.getByRole("heading", { name: "Generation prompt" })).toBeVisible();
    await expect(home).toContainText("Roleplay · Default");
    await expect(home.getByRole("heading", { name: "Turn prompt insert" })).toBeVisible();
    const turnPromptMode = home.getByRole("group", { name: "Turn prompt mode" });
    const roleplayTurnInsert = home.getByLabel("Roleplay turn prompt insert");
    await expect(roleplayTurnInsert).toContainText('<spatial_context mode="roleplay" authority="application">');
    await expect(roleplayTurnInsert).toContainText("Current path: Parent location > Current location");
    await home.getByRole("button", { name: "Edit templates" }).click();
    const roleplayTurnTemplate = home.getByLabel("Roleplay turn prompt template");
    const roleplayTurnTemplateBox = await roleplayTurnTemplate.boundingBox();
    expect(roleplayTurnTemplateBox?.height ?? 0).toBeGreaterThanOrEqual(500);
    await expect(roleplayTurnTemplate).toHaveValue(/\$\{currentPath\}/u);
    await expect(roleplayTurnTemplate).toHaveValue(/\$\{authorityInstruction\}/u);
    const builtInRoleplayTurnTemplate = await roleplayTurnTemplate.inputValue();
    await roleplayTurnTemplate.fill(
      `${builtInRoleplayTurnTemplate}\n${Array.from(
        { length: 500 },
        () => "${privateModelContextBlock}",
      ).join("\n")}`,
    );
    await expect(home.getByRole("alert").filter({ hasText: "Resolved preview unavailable" })).toContainText(
      "40,000 characters",
    );
    await expect(roleplayTurnTemplate).toBeVisible();
    await expect(home.getByRole("button", { name: "Restore built-in" })).toBeEnabled();
    await home.getByRole("button", { name: "Restore built-in" }).click();
    await roleplayTurnTemplate.fill(`${await roleplayTurnTemplate.inputValue()}\n\${ currentPath }`);
    await expect(home.getByRole("alert").filter({ hasText: "Invalid turn prompt variable" })).toContainText(
      "without spaces or punctuation",
    );
    await expect(home.getByRole("button", { name: "Save templates" })).toBeDisabled();
    await home.getByRole("button", { name: "Restore built-in" }).click();
    await roleplayTurnTemplate.fill("Invalid template without required variables.");
    await expect(home.getByRole("button", { name: "Save templates" })).toBeDisabled();
    await expect(home.getByRole("alert")).toContainText("${currentPath}");
    await home.getByRole("button", { name: "Restore built-in" }).click();
    await roleplayTurnTemplate.fill(`ROLEPLAY_EDITABLE_INSERT\n${await roleplayTurnTemplate.inputValue()}`);
    await expect(roleplayTurnInsert).toContainText("ROLEPLAY_EDITABLE_INSERT");
    await turnPromptMode.getByRole("button", { name: "Game", exact: true }).click();
    const gameTurnInsert = home.getByLabel("Game turn prompt insert");
    await expect(gameTurnInsert).toContainText('<spatial_context mode="game" authority="application">');
    await expect(gameTurnInsert).toContainText("authoritative world location for the GM and party");
    await expect(home).toContainText("Game requests also relabel legacy");
    const gameTurnTemplate = home.getByLabel("Game turn prompt template");
    await gameTurnTemplate.fill(`GAME_EDITABLE_INSERT\n${await gameTurnTemplate.inputValue()}`);
    await expect(gameTurnInsert).toContainText("GAME_EDITABLE_INSERT");
    await home.getByRole("button", { name: "Save templates" }).click();
    await expect(home.getByRole("button", { name: "Edit templates" })).toBeVisible();
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/agents");
        const mapsAgent = ((await response.json()) as Array<{ type: string; settings?: unknown }>).find(
          (agent) => agent.type === "hierarchical-maps",
        );
        const settings =
          typeof mapsAgent?.settings === "string"
            ? (JSON.parse(mapsAgent.settings) as Record<string, unknown>)
            : ((mapsAgent?.settings ?? {}) as Record<string, unknown>);
        const templates = settings.spatialMapTurnPromptTemplates as
          | { roleplay?: string; game?: string }
          | undefined;
        return {
          roleplay: templates?.roleplay?.includes("ROLEPLAY_EDITABLE_INSERT") === true,
          game: templates?.game?.includes("GAME_EDITABLE_INSERT") === true,
        };
      })
      .toEqual({ roleplay: true, game: true });
    await turnPromptMode.getByRole("button", { name: "Roleplay", exact: true }).click();
    await expect(roleplayTurnInsert).toContainText("ROLEPLAY_EDITABLE_INSERT");
    const promptOption = home.getByLabel("Prompt option");
    await expect(promptOption).toHaveValue("default");
    const systemTemplate = home.getByLabel("New map System template");
    const userTemplate = home.getByLabel("New map User template");
    await expect(systemTemplate).toHaveValue(/AI roleplay engine/u);
    await expect(userTemplate).toHaveValue(/\$\{sourceContextBlock\}/u);
    const promptLibraryMode = home.getByRole("group", { name: "Prompt library mode" });
    await promptLibraryMode.getByRole("button", { name: "Game", exact: true }).click();
    await expect(home).toContainText("Game · Default");
    await expect(systemTemplate).toHaveValue(/AI game engine/u);
    await expect(home.getByRole("button", { name: "Preview resolved prompt" })).toBeDisabled();
    await expect(home).toContainText("Open a Game chat to resolve these global templates");
    await promptLibraryMode.getByRole("button", { name: "Roleplay", exact: true }).click();
    await expect(home).toContainText("Roleplay · Default");
    await home.getByRole("button", { name: "Add option" }).click();
    await home.getByLabel("Option name").fill("Nautical districts");
    await home.getByLabel("Short description").fill("Compact port cities with clear public routes.");
    await home.locator("summary").filter({ hasText: "Available template variables" }).click();
    await expect(home.getByText("${outputSchema}", { exact: true })).toBeVisible();
    await expect(home.getByText("Required contract", { exact: true })).toBeVisible();
    await home.getByLabel("Reusable creator guidance").fill("Prefer compact nautical districts and clear public routes.");
    await home.getByRole("button", { name: "Add custom variable" }).click();
    await home.getByLabel("Custom variable 1 name").fill("districtStyle");
    await home.getByLabel("Custom variable 1 value").fill("Favor salt-worn brick, covered arcades, and compact waterfront blocks.");
    await systemTemplate.fill(`${await systemTemplate.inputValue()}\nKeep authored districts easy to scan.`);
    await userTemplate.fill(`${await userTemplate.inputValue()}\nUnsaved combined-message preview marker.\n\${districtStyle}`);
    await home.getByRole("button", { name: "Preview resolved prompt" }).click();
    const resolvedPromptMessages = home.getByRole("region", { name: "Resolved prompt messages" });
    await expect(resolvedPromptMessages.getByLabel("Resolved System message")).toContainText(
      "Keep authored districts easy to scan.",
    );
    await expect(resolvedPromptMessages.getByLabel("Resolved System message")).toContainText(
      "Infer a concise location-type vocabulary",
    );
    await expect(resolvedPromptMessages.getByLabel("Resolved User message")).toContainText(
      "Prefer compact nautical districts and clear public routes.",
    );
    await expect(resolvedPromptMessages.getByLabel("Resolved User message")).toContainText(
      "Unsaved combined-message preview marker.",
    );
    await expect(resolvedPromptMessages.getByLabel("Resolved User message")).toContainText(
      "Favor salt-worn brick, covered arcades, and compact waterfront blocks.",
    );
    await home.getByRole("button", { name: "Save global library" }).click();
    await expect(home).toContainText("Roleplay · Nautical districts");
    await expect
      .poll(async () => {
        const spatialResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        const payload = (await spatialResponse.json()) as {
          generationPreferences: {
            version: number;
            activeOptionId: string;
            options: Array<{
              id: string;
              name: string;
              guidance: string;
              customVariables: Array<{ name: string; value: string }>;
              prompts: { draftSystem: string; draftUser: string; expansionSystem: string; expansionUser: string };
            }>;
          };
        };
        const active = payload.generationPreferences.options.find(
          (option) => option.id === payload.generationPreferences.activeOptionId,
        )!;
        return {
          version: payload.generationPreferences.version,
          optionCount: payload.generationPreferences.options.length,
          name: active.name,
          guidance: active.guidance,
          customVariable: active.customVariables[0],
          customizedDraft: active.prompts.draftSystem.includes("Keep authored districts easy to scan."),
          customizedUser: active.prompts.draftUser.includes("Unsaved combined-message preview marker."),
          retainsSchema: active.prompts.draftSystem.includes("${outputSchema}"),
          retainsSourceContext: active.prompts.draftUser.includes("${sourceContextBlock}"),
        };
      })
      .toEqual({
        version: 3,
        optionCount: 2,
        name: "Nautical districts",
        guidance: "Prefer compact nautical districts and clear public routes.",
        customVariable: {
          name: "districtStyle",
          value: "Favor salt-worn brick, covered arcades, and compact waterfront blocks.",
        },
        customizedDraft: true,
        customizedUser: true,
        retainsSchema: true,
        retainsSourceContext: true,
      });
    await expect
      .poll(async () => {
        const agentsResponse = await page.request.get("/api/agents");
        const mapsAgent = ((await agentsResponse.json()) as Array<{ type: string; settings?: unknown }>).find(
          (agent) => agent.type === "hierarchical-maps",
        );
        const settings =
          typeof mapsAgent?.settings === "string"
            ? (JSON.parse(mapsAgent.settings) as Record<string, unknown>)
            : ((mapsAgent?.settings ?? {}) as Record<string, unknown>);
        const libraries = settings.spatialMapGenerationPromptLibraries as
          | {
              version?: number;
              roleplay?: { options?: Array<{ name?: string; prompts?: { draftSystem?: string } }> };
            }
          | undefined;
        return {
          version: libraries?.version,
          names: libraries?.roleplay?.options?.map((option) => option.name),
          customized: libraries?.roleplay?.options?.some((option) =>
            option.prompts?.draftSystem?.includes("Keep authored districts easy to scan."),
          ),
        };
      })
      .toEqual({ version: 1, names: ["Default", "Nautical districts"], customized: true });

    const reviewAuthor = `Maps Review Smoke ${testInfo.project.name}`;
    await home.getByLabel("Author").fill(reviewAuthor);
    await home.getByRole("button", { name: "Save", exact: true }).click();
    await expect(home.getByText("Saved", { exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const agentsResponse = await page.request.get("/api/agents");
        const mapsAgent = ((await agentsResponse.json()) as Array<{
          type: string;
          connectionId?: string | null;
          settings?: unknown;
        }>).find((agent) => agent.type === "hierarchical-maps");
        const settings =
          typeof mapsAgent?.settings === "string"
            ? (JSON.parse(mapsAgent.settings) as Record<string, unknown>)
            : ((mapsAgent?.settings ?? {}) as Record<string, unknown>);
        const libraries = settings.spatialMapGenerationPromptLibraries as
          | { roleplay?: { options?: Array<{ name?: string }> } }
          | undefined;
        const templates = settings.spatialMapTurnPromptTemplates as
          | { roleplay?: string; game?: string }
          | undefined;
        return {
          author: settings.author,
          connectionId: mapsAgent?.connectionId,
          libraryNames: libraries?.roleplay?.options?.map((option) => option.name),
          roleplayTemplatePreserved: templates?.roleplay?.includes("ROLEPLAY_EDITABLE_INSERT") === true,
          gameTemplatePreserved: templates?.game?.includes("GAME_EDITABLE_INSERT") === true,
        };
      })
      .toEqual({
        author: reviewAuthor,
        connectionId: unavailableConnectionId,
        libraryNames: ["Default", "Nautical districts"],
        roleplayTemplatePreserved: true,
        gameTemplatePreserved: true,
      });

    const secondaryResponse = await page.request.post("/api/chats", {
      data: {
        name: `Maps Global Library ${testInfo.project.name}`,
        mode: "roleplay",
        characterIds: [],
      },
    });
    expect(secondaryResponse.ok(), await secondaryResponse.text()).toBeTruthy();
    secondaryChat = (await secondaryResponse.json()) as { id: string };
    await activateHierarchicalMaps(page, secondaryChat.id);
    const secondaryPage = await page.context().newPage();
    try {
      await secondaryPage.addInitScript((chatId) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
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
      }, secondaryChat.id);
      await secondaryPage.route("**/api/backgrounds/file/Black.jpg", async (route) => {
        await route.fulfill({ status: 204, body: "" });
      });
      await secondaryPage.goto("/");
      await dismissOnboardingTutorial(secondaryPage);
      await secondaryPage.locator('[data-tour="panel-agents"]').click();
      const secondaryAgentsPanel = secondaryPage.locator(
        mobile ? '[data-component="RightPanelMobile"]' : '[data-component="RightPanelDesktop"]',
      );
      await secondaryAgentsPanel
        .locator('[data-agent-name="World Maps"]')
        .getByText("World Maps", { exact: true })
        .click();
      const secondaryHome = secondaryPage.locator("[data-marinara-maps-home]");
      await expect(secondaryHome).toContainText("Maps Global Library");
      await expect(secondaryHome.getByLabel("Roleplay turn prompt insert")).toContainText(
        "ROLEPLAY_EDITABLE_INSERT",
      );
      const secondaryPromptOption = secondaryHome.getByLabel("Prompt option");
      await expect(secondaryPromptOption.locator("option")).toHaveText(["Default", "Nautical districts"]);
      let generatedRequest: Record<string, unknown> | null = null;
      const generationRoute = `**/api/chats/${secondaryChat.id}/spatial-context/generate`;
      await secondaryPage.route(generationRoute, async (route) => {
        generatedRequest = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Captured global prompt request" }),
        });
      });
      await secondaryHome.getByRole("button", { name: "Create map", exact: true }).click();
      await expect(secondaryPage.getByRole("heading", { name: "World map", exact: true })).toBeVisible();
      await secondaryPage.getByRole("button", { name: "Draft with AI", exact: true }).click();
      await secondaryPage.getByRole("button", { name: "Generate draft", exact: true }).click();
      await expect
        .poll(() => {
          const preferences = generatedRequest?.generationPreferencesOverride as
            | { activeOptionId?: string; options?: Array<{ name?: string }> }
            | undefined;
          return {
            activeOptionId: preferences?.activeOptionId,
            optionNames: preferences?.options?.map((option) => option.name),
          };
        })
        .toEqual({ activeOptionId: "default", optionNames: ["Default", "Nautical districts"] });
      await secondaryPage.unroute(generationRoute);
      await secondaryPage.getByRole("button", { name: "Back to chat", exact: true }).click();
      const secondaryDiscardDialog = secondaryPage.getByRole("dialog", { name: "Discard map changes?" });
      if (await secondaryDiscardDialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await secondaryDiscardDialog.getByRole("button", { name: "Discard changes", exact: true }).click();
      }
      await expect(secondaryHome).toBeVisible();
      await secondaryPromptOption.selectOption({ label: "Nautical districts" });
      await expect
        .poll(async () => {
          const spatialResponse = await secondaryPage.request.get(
            `/api/chats/${secondaryChat!.id}/spatial-context`,
          );
          const payload = (await spatialResponse.json()) as {
            generationPreferences: { activeOptionId: string; options: Array<{ id: string; name: string }> };
          };
          const active = payload.generationPreferences.options.find(
            (option) => option.id === payload.generationPreferences.activeOptionId,
          );
          return {
            activeName: active?.name,
            activeOptionId: payload.generationPreferences.activeOptionId,
            optionCount: payload.generationPreferences.options.length,
          };
        })
        .toMatchObject({ activeName: "Nautical districts", optionCount: 2 });
    } finally {
      await secondaryPage.close();
    }
    await page.evaluate((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    const activePromptOptionBeforeFailedSave = await promptOption.inputValue();
    const promptSelectionRoute = `**/api/chats/${chat.id}/spatial-context/generation-preferences`;
    await page.route(promptSelectionRoute, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Prompt selection persistence failed" }),
      });
    });
    await promptOption.selectOption({ label: "Default" });
    await expect(promptOption).toHaveValue(activePromptOptionBeforeFailedSave);
    await expect(home).toContainText("Prompt selection persistence failed");
    await page.unroute(promptSelectionRoute);
    await promptOption.selectOption({ label: "Default" });
    await expect(home).toContainText("Roleplay · Default");
    await expect(systemTemplate).toHaveValue(/AI roleplay engine/u);
    await expect(systemTemplate).not.toHaveValue(/Keep authored districts easy to scan\./u);
    await promptOption.selectOption({ label: "Nautical districts" });
    await expect(home).toContainText("Roleplay · Nautical districts");
    await expect(systemTemplate).toHaveValue(/Keep authored districts easy to scan\./u);
    await home.getByRole("button", { name: "Expansion" }).click();
    await expect(home.getByLabel("Expansion System template")).toHaveValue(/AI roleplay engine/u);
    await expect(home.getByLabel("Expansion User template")).toHaveValue(/\$\{selectedMapContextBlock\}/u);
    await expect(home.getByText("Create a map with an active location before previewing the Expansion templates.")).toBeVisible();
    await home.getByRole("button", { name: "Edit prompt option" }).click();
    await home.getByRole("button", { name: "Delete option" }).click();
    await home.getByRole("button", { name: "Save global library" }).click();
    await expect(home).toContainText("Roleplay · Default");
    await expect
      .poll(async () => {
        const spatialResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        const payload = (await spatialResponse.json()) as {
          generationPreferences: {
            version: number;
            activeOptionId: string;
            options: Array<{ id: string; prompts: { draftSystem: string } }>;
          };
        };
        const active = payload.generationPreferences.options.find(
          (option) => option.id === payload.generationPreferences.activeOptionId,
        )!;
        return {
          version: payload.generationPreferences.version,
          optionCount: payload.generationPreferences.options.length,
          activeOptionId: payload.generationPreferences.activeOptionId,
          roleplayDefault: active.prompts.draftSystem.includes("AI roleplay engine"),
          customTextRemoved: !active.prompts.draftSystem.includes("Keep authored districts easy to scan."),
        };
      })
      .toEqual({ version: 3, optionCount: 1, activeOptionId: "default", roleplayDefault: true, customTextRemoved: true });

    await expect
      .poll(async () => {
        const chatResponse = await page.request.get(`/api/chats/${chat.id}`);
        const stored = (await chatResponse.json()) as { metadata?: unknown };
        const metadata =
          typeof stored.metadata === "string"
            ? (JSON.parse(stored.metadata) as { enableAgents?: boolean; activeAgentIds?: string[] })
            : ((stored.metadata ?? {}) as { enableAgents?: boolean; activeAgentIds?: string[] });
        return {
          enableAgents: metadata.enableAgents,
          activeAgentIds: metadata.activeAgentIds,
        };
      })
      .toEqual({ enableAgents: true, activeAgentIds: ["hierarchical-maps"] });

    await createMap.click();
    await expect(page.getByRole("heading", { name: "World map", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to chat" }).click();
    const discardDialog = page.getByRole("dialog", { name: "Discard map changes?" });
    if (await discardDialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await discardDialog.getByRole("button", { name: "Discard changes", exact: true }).click();
    }
    await expect(home).toBeVisible();
    await expect(home.getByRole("button", { name: "Create map", exact: true })).toBeEnabled();
    await home.getByRole("button", { name: "Back to Agents" }).click();
    await expect(home).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Story location" })).toContainText(
      "No map yet. Create one from Agents → World Maps; your message draft is unchanged.",
    );
  } finally {
    if (!mapsAgentCreated) {
      const restoreResponse = await page.request.patch("/api/agents/type/hierarchical-maps", {
        data: {
          ...originalMapsAgentConfig,
          settings: originalMapsAgentSettings,
        },
      });
      expect(restoreResponse.ok(), await restoreResponse.text()).toBeTruthy();
    }
    await expectDeletedInOrder(page, [
      secondaryChat ? `/api/chats/${secondaryChat.id}` : null,
      `/api/chats/${chat.id}`,
      mapsAgentCreated ? `/api/agents/${mapsAgentBefore.id}` : null,
    ]);
  }
});

test("World Maps editor changes the AI connection without losing the draft", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const { config: mapsAgentBefore, created: mapsAgentCreated } =
    await getOrCreateHierarchicalMapsAgentConfig(page);
  const originalSettings = (() => {
    if (typeof mapsAgentBefore.settings === "string") {
      try {
        const parsed = JSON.parse(mapsAgentBefore.settings) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    return mapsAgentBefore.settings && typeof mapsAgentBefore.settings === "object"
      ? (mapsAgentBefore.settings as Record<string, unknown>)
      : {};
  })();
  const originalConfig = {
    description: mapsAgentBefore.description,
    phase: mapsAgentBefore.phase,
    connectionId: mapsAgentBefore.connectionId,
    settings: originalSettings,
  };
  const unavailableConnectionId = `missing-editor-connection-${testInfo.project.name}`;
  const editorConnection = {
    id: `maps-editor-connection-${testInfo.project.name}`,
    name: "Editor Maps",
    provider: "openai",
    model: "maps-editor-model",
  };
  let chat: { id: string } | null = null;

  try {
    const chatResponse = await page.request.post("/api/chats", {
      data: {
        name: `Maps Editor Connection ${testInfo.project.name}`,
        mode: "roleplay",
        characterIds: [],
      },
    });
    expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
    chat = (await chatResponse.json()) as { id: string };
    await activateHierarchicalMaps(page, chat.id);
    const isolateResponse = await page.request.patch("/api/agents/type/hierarchical-maps", {
      data: { connectionId: unavailableConnectionId },
    });
    expect(isolateResponse.ok(), await isolateResponse.text()).toBeTruthy();
    await page.route("**/api/connections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          editorConnection,
          { id: "image-only", name: "Image only", provider: "image_generation", model: "image-model" },
        ]),
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
          version: 75,
        }),
      );
    }, chat.id);
    await page.goto("/");
    await dismissOnboardingTutorial(page);
    await page.locator('[data-tour="panel-agents"]').click();
    const agentsPanel = page.locator(
      testInfo.project.name.includes("mobile")
        ? '[data-component="RightPanelMobile"]'
        : '[data-component="RightPanelDesktop"]',
    );
    await agentsPanel
      .locator('[data-agent-name="World Maps"]')
      .getByText("World Maps", { exact: true })
      .click();

    const home = page.locator("[data-marinara-maps-home]");
    await expect(home).toBeVisible();
    const homeConnectionOverride = home.getByRole("combobox", { name: "Connection Override" });
    await expect(homeConnectionOverride).toHaveValue(unavailableConnectionId);
    await expect(
      homeConnectionOverride.getByRole("option", { name: "Saved connection (unavailable)" }),
    ).toHaveCount(1);
    await home.getByRole("button", { name: "Create map", exact: true }).click();
    await page.getByRole("button", { name: "Draft with AI", exact: true }).click();

    const aiBuilder = page.getByRole("region", { name: "AI map builder" });
    const editorConnectionOverride = aiBuilder.getByRole("combobox", { name: "AI map connection" });
    const instructions = aiBuilder.getByLabel("What should this world include?");
    await instructions.fill("Keep the harbor districts compact.");
    await expect(editorConnectionOverride).toHaveValue(unavailableConnectionId);
    await expect(editorConnectionOverride.locator("option")).toHaveText([
      "Use chat connection",
      "Saved connection (unavailable)",
      "Editor Maps · maps-editor-model · openai",
    ]);
    await editorConnectionOverride.selectOption(editorConnection.id);
    await expect(aiBuilder.getByText("Saved", { exact: true })).toBeVisible();
    await expect(instructions).toHaveValue("Keep the harbor districts compact.");
    await expect
      .poll(async () => {
        const agentsResponse = await page.request.get("/api/agents");
        const mapsAgent = ((await agentsResponse.json()) as Array<{ type: string; connectionId?: string | null }>).find(
          (agent) => agent.type === "hierarchical-maps",
        );
        return mapsAgent?.connectionId;
      })
      .toBe(editorConnection.id);

    await aiBuilder.getByRole("button", { name: "Close AI map builder" }).click();
    await page.getByRole("button", { name: "Back to chat" }).click();
    const discardDialog = page.getByRole("dialog", { name: "Discard map changes?" });
    if (await discardDialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await discardDialog.getByRole("button", { name: "Discard changes", exact: true }).click();
    }
    await expect(home).toBeVisible();
    await expect(homeConnectionOverride).toHaveValue(editorConnection.id);
  } finally {
    await page.unroute("**/api/connections");
    if (!mapsAgentCreated) {
      const restoreResponse = await page.request.patch("/api/agents/type/hierarchical-maps", {
        data: originalConfig,
      });
      expect(restoreResponse.ok(), await restoreResponse.text()).toBeTruthy();
    }
    await expectDeletedInOrder(page, [
      chat ? `/api/chats/${chat.id}` : null,
      mapsAgentCreated ? `/api/agents/${mapsAgentBefore.id}` : null,
    ]);
  }
});

test("Map templates are created outside chats and copied into Roleplay", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The template library flow is shared across viewports.");
  test.setTimeout(90_000);
  const existingTemplatesResponse = await page.request.get("/api/chats/spatial-context/templates");
  expect(existingTemplatesResponse.ok(), await existingTemplatesResponse.text()).toBeTruthy();
  const existingTemplateIds = new Set(
    ((await existingTemplatesResponse.json()) as Array<{ id: string }>).map((template) => template.id),
  );
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Map Template Copy", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const sharedArtworkResponse = await page.request.post("/api/global-gallery/upload", {
    multipart: {
      prompt: "Shared map template artwork",
      provider: "world-map-e2e",
      model: "fixture",
      width: "1",
      height: "1",
      file: {
        name: "shared-template-art.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2SIAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  expect(sharedArtworkResponse.ok(), await sharedArtworkResponse.text()).toBeTruthy();
  const sharedArtwork = (await sharedArtworkResponse.json()) as { id: string };

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);
    await page.locator('[data-tour="panel-agents"]').click();
    const agentsPanel = page.locator('[data-component="RightPanelDesktop"]');
    const mapsCard = agentsPanel.locator('[data-agent-name="World Maps"]');
    await mapsCard.getByText("World Maps", { exact: true }).click();

    const home = page.locator("[data-marinara-maps-home]");
    await home.getByRole("button", { name: "Open world library" }).click();
    const library = page.locator("[data-marinara-map-template-library]");
    await expect(library.getByRole("heading", { name: "Map templates", exact: true })).toBeVisible();
    await expect(library).toContainText("shared Global Gallery artwork");
    await library.getByRole("button", { name: "New map template" }).first().click();

    const workspace = page.locator("[data-marinara-maps-workspace-root]");
    await expect(workspace.getByRole("heading", { name: "Create a map template" })).toBeVisible();
    await expect(workspace.getByRole("button", { name: "Create with AI" })).toBeVisible();
    await workspace.getByRole("button", { name: "Build manually" }).click();
    await workspace.getByLabel("Map template name").fill("Reusable Test World");
    await workspace.getByRole("button", { name: "Choose artwork" }).click();
    const sharedArtworkOption = workspace.getByTitle("Shared map template artwork");
    await expect(sharedArtworkOption.getByText("Shared", { exact: true })).toBeVisible();
    await sharedArtworkOption.click();
    await workspace.getByRole("button", { name: "Use selected" }).click();
    await workspace.getByRole("button", { name: "Save template", exact: true }).click();
    await expect(workspace).toContainText("Saved");
    const globalGalleryBeforeImport = await page.request.get("/api/global-gallery");
    expect(globalGalleryBeforeImport.ok(), await globalGalleryBeforeImport.text()).toBeTruthy();
    const globalImageCountBeforeImport = ((await globalGalleryBeforeImport.json()) as Array<unknown>).length;
    await workspace.getByRole("button", { name: "Export world map" }).click();
    const exportDialog = page.getByRole("dialog", { name: "Export portable world map" });
    await expect(exportDialog.getByRole("radio", { name: /Map \+ linked entries/u })).toBeChecked();
    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Download export" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const exportedTemplate = JSON.parse(await readFile(downloadPath!, "utf8")) as {
      name?: string;
      artwork?: Array<{ sourceImageId: string }>;
    };
    expect(exportedTemplate.artwork).toEqual([
      expect.objectContaining({ sourceImageId: `global-gallery:${sharedArtwork.id}` }),
    ]);
    await workspace.getByRole("button", { name: "Back to map templates" }).click();

    exportedTemplate.name = "Imported Shared Artwork World";
    await library.locator('input[type="file"]').setInputFiles({
      name: "imported-shared-artwork.world-map.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exportedTemplate)),
    });
    await expect(page.getByText("1 existing shared image was reused.")).toBeVisible();
    const globalGalleryAfterImport = await page.request.get("/api/global-gallery");
    expect(globalGalleryAfterImport.ok(), await globalGalleryAfterImport.text()).toBeTruthy();
    expect(((await globalGalleryAfterImport.json()) as Array<unknown>).length).toBe(globalImageCountBeforeImport);
    await workspace.getByRole("button", { name: "Back to map templates" }).click();

    const reusableTemplateCard = library
      .getByRole("heading", { name: "Reusable Test World" })
      .locator("xpath=ancestor::article");
    await expect(reusableTemplateCard).toBeVisible();
    await library.getByRole("button", { name: "Back to Maps" }).click();
    await home.getByRole("button", { name: "Back to Agents" }).click();
    await page.locator('[data-tour="panel-agents"]').click();
    await page.getByRole("button", { name: "Chat Settings" }).click();
    const { agentEntry } = await openHierarchicalMapsAgentControls(page);
    await agentEntry.getByRole("button", { name: "Set up world map" }).click();
    await workspace.getByRole("button", { name: "Open shared worlds and map templates" }).click();

    const chatSettingsLibrary = page.locator("[data-marinara-map-template-library]");
    const chatSettingsTemplateCard = chatSettingsLibrary
      .getByRole("heading", { name: "Imported Shared Artwork World" })
      .locator("xpath=ancestor::article");
    await expect(chatSettingsTemplateCard.getByRole("button", { name: "Add to chat" })).toBeVisible();
    await chatSettingsTemplateCard.getByRole("button", { name: "Add to chat" }).click();
    let confirm = page.getByRole("dialog").filter({ hasText: "Add map template to this chat?" });
    const cancelButton = confirm.getByRole("button", { name: "Cancel", exact: true });
    const confirmButton = confirm.getByRole("button", { name: "Add to chat", exact: true });
    await expect(cancelButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirmButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancelButton).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirm).toHaveCount(0);
    await expect(chatSettingsTemplateCard.getByRole("button", { name: "Add to chat" })).toBeFocused();

    await chatSettingsTemplateCard.getByRole("button", { name: "Add to chat" }).click();
    confirm = page.getByRole("dialog").filter({ hasText: "Add map template to this chat?" });
    await confirm.getByRole("button", { name: "Add to chat", exact: true }).click();
    await expect
      .poll(async () => {
        const response = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        const body = (await response.json()) as {
          definition?: { ownerMode?: string; locations?: Array<{ referenceImageId?: string }> } | null;
        };
        return {
          ownerMode: body.definition?.ownerMode,
          locationCount: body.definition?.locations?.length,
          referenceImageId: body.definition?.locations?.[0]?.referenceImageId,
        };
      })
      .toEqual({
        ownerMode: "roleplay",
        locationCount: 1,
        referenceImageId: `global-gallery:${sharedArtwork.id}`,
      });
  } finally {
    const templatesResponse = await page.request.get("/api/chats/spatial-context/templates");
    if (templatesResponse.ok()) {
      const templates = (await templatesResponse.json()) as Array<{ id: string; revision: number }>;
      for (const template of templates) {
        if (existingTemplateIds.has(template.id)) continue;
        const response = await page.request.delete(`/api/chats/spatial-context/templates/${template.id}`, {
          data: { expectedRevision: template.revision },
        });
        expect(response.ok(), await response.text()).toBeTruthy();
      }
    }
    const deleteSharedArtworkResponse = await page.request.delete(`/api/global-gallery/${sharedArtwork.id}`);
    expect(deleteSharedArtworkResponse.ok(), await deleteSharedArtworkResponse.text()).toBeTruthy();
    await expectDeleted(page, `/api/chats/${chat.id}`);
  }
});

test("detached chat maps create distinguishable shared-world copies and expose plain-language ownership", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The shared-world ownership flow is shared across viewports.");
  test.setTimeout(90_000);
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const chatName = `Shared Copy ${suffix}`;
  const baseWorldName = `${chatName} world`;
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: chatName, mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: { ...generatedDefinition, enabled: true },
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();
  const spatialResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
  expect(spatialResponse.ok(), await spatialResponse.text()).toBeTruthy();
  const spatial = (await spatialResponse.json()) as { hierarchyProfile: unknown };
  const originalWorldResponse = await page.request.post("/api/chats/spatial-context/shared-worlds", {
    data: {
      name: baseWorldName,
      description: "Existing canonical world used to exercise detached-copy naming.",
      definition: { ...generatedDefinition, enabled: true, revision: 0 },
      hierarchyProfile: spatial.hierarchyProfile,
    },
  });
  expect(originalWorldResponse.ok(), await originalWorldResponse.text()).toBeTruthy();

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);
    await page.getByRole("button", { name: "Chat Settings" }).click();
    const { agentEntry } = await openHierarchicalMapsAgentControls(page);
    await agentEntry.getByRole("button", { name: "Set up world map" }).click();

    const workspace = page.locator("[data-marinara-maps-workspace-root]");
    await expect(workspace).toContainText(`${chatName} · Independent chat map`);
    await workspace.getByRole("button", { name: "More map actions" }).click();
    const actions = workspace.getByRole("region", { name: "Map actions" });
    await actions.getByRole("button", { name: "Make shared" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create a shared world from this map?" });
    await expect(createDialog).toContainText(`A shared world named “${baseWorldName}” already exists.`);
    await expect(createDialog).toContainText(`“${baseWorldName} (copy)”`);
    await createDialog.getByRole("button", { name: "Create and link" }).click();
    await expect(workspace).toContainText(`${chatName} · Linked to ${baseWorldName} (copy)`);

    const detach = workspace.getByRole("button", { name: "Detach and keep copy" });
    await expect(detach).toBeVisible();
    await detach.click();
    const detachDialog = page.getByRole("dialog", { name: "Detach from the shared world?" });
    await expect(detachDialog).toContainText("keep its current map as an independent copy");
    await detachDialog.getByRole("button", { name: "Detach and keep copy" }).click();
    await expect(workspace).toContainText(`${chatName} · Independent chat map`);

    const worldsResponse = await page.request.get("/api/chats/spatial-context/shared-worlds");
    expect(worldsResponse.ok(), await worldsResponse.text()).toBeTruthy();
    const matchingNames = ((await worldsResponse.json()) as Array<{ name: string }>)
      .map((world) => world.name)
      .filter((name) => name.startsWith(baseWorldName))
      .sort();
    expect(matchingNames).toEqual([baseWorldName, `${baseWorldName} (copy)`]);
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}`);
    const worldsResponse = await page.request.get("/api/chats/spatial-context/shared-worlds");
    if (worldsResponse.ok()) {
      const worlds = (await worldsResponse.json()) as Array<{ id: string; name: string; revision: number }>;
      for (const world of worlds.filter((candidate) => candidate.name.startsWith(baseWorldName))) {
        const response = await page.request.delete(`/api/chats/spatial-context/shared-worlds/${world.id}`, {
          data: { expectedRevision: world.revision },
        });
        expect(response.ok(), await response.text()).toBeTruthy();
      }
    }
  }
});

test("global World Maps home protects templates after a settings load failure", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const response = await page.request.post("/api/chats", {
    data: {
      name: `Maps Template Load Failure ${testInfo.project.name}`,
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const mobile = testInfo.project.name.includes("mobile");

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);
    await page.locator('[data-tour="panel-agents"]').click();
    const agentsPanel = page.locator(
      mobile ? '[data-component="RightPanelMobile"]' : '[data-component="RightPanelDesktop"]',
    );
    const mapsCard = agentsPanel.locator('[data-agent-name="World Maps"]');
    await expect(mapsCard).toBeVisible();
    await page.route("**/api/agents", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Settings temporarily unavailable" }),
      });
    });
    await mapsCard.getByText("World Maps", { exact: true }).click();

    const home = page.locator("[data-marinara-maps-home]");
    await expect(
      home.getByRole("alert").filter({ hasText: "Global turn prompt templates could not load" }),
    ).toContainText("Settings temporarily unavailable", { timeout: 20_000 });
    await expect(home.getByRole("button", { name: "Edit templates" })).toBeDisabled();
    await expect(home.getByRole("button", { name: "Copy insert" })).toBeDisabled();

    await page.unroute("**/api/agents");
    await home.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(home.getByRole("button", { name: "Edit templates" })).toBeEnabled();
    await expect(home.getByLabel("Roleplay turn prompt insert")).toContainText("Current path:");
  } finally {
    await page.unroute("**/api/agents");
    await expectDeleted(page, `/api/chats/${chat.id}`);
  }
});

test("global World Maps home edits the current map location types", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const agentsBeforeResponse = await page.request.get("/api/agents");
  expect(agentsBeforeResponse.ok(), await agentsBeforeResponse.text()).toBeTruthy();
  const mapsAgentBefore = ((await agentsBeforeResponse.json()) as Array<{
    type: string;
    settings?: unknown;
  }>).find((agent) => agent.type === "hierarchical-maps");
  const originalMapsAgentSettings = (() => {
    if (typeof mapsAgentBefore?.settings === "string") {
      try {
        const parsed = JSON.parse(mapsAgentBefore.settings) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    return mapsAgentBefore?.settings && typeof mapsAgentBefore.settings === "object"
      ? (mapsAgentBefore.settings as Record<string, unknown>)
      : {};
  })();
  const response = await page.request.post("/api/chats", {
    data: {
      name: `Maps Location Types ${testInfo.project.name}`,
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: { ...generatedDefinition, enabled: true },
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();
  const mobile = testInfo.project.name.includes("mobile");

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    await page.locator('[data-tour="panel-agents"]').click();
    const agentsPanel = page.locator(
      mobile ? '[data-component="RightPanelMobile"]' : '[data-component="RightPanelDesktop"]',
    );
    await agentsPanel.locator('[data-agent-name="World Maps"]').getByText("World Maps", { exact: true }).click();

    const home = page.locator("[data-marinara-maps-home]");
    const homeHeadings = await home.getByRole("heading", { level: 2 }).allTextContents();
    expect(homeHeadings.indexOf("Generation prompt")).toBeLessThan(homeHeadings.indexOf("Turn prompt insert"));
    expect(homeHeadings.indexOf("Turn prompt insert")).toBeLessThan(homeHeadings.indexOf("Location types"));
    await expect(home.getByText("Live current chat", { exact: true })).toBeVisible();
    const liveTurnInsert = home.getByLabel("Roleplay turn prompt insert");
    await expect(liveTurnInsert).toContainText('<spatial_context mode="roleplay" authority="application">');
    await expect(liveTurnInsert).toContainText("Current path: Shrouded Coast");
    await expect(liveTurnInsert).toContainText("A coast hidden beneath sea fog.");
    await expect(liveTurnInsert).toContainText("Old shipping routes conceal forgotten coves.");
    await expect(liveTurnInsert).toContainText("- Gloam Harbor [ai_harbor]");
    await home.getByRole("button", { name: "Edit templates" }).click();
    const liveRoleplayTemplate = home.getByLabel("Roleplay turn prompt template");
    await liveRoleplayTemplate.fill(`LIVE_EDITABLE_INSERT\n${await liveRoleplayTemplate.inputValue()}`);
    await home.getByRole("button", { name: "Save templates" }).click();
    await expect(liveTurnInsert).toContainText("LIVE_EDITABLE_INSERT");
    await expect
      .poll(async () => {
        const agentsResponse = await page.request.get("/api/agents");
        const mapsAgent = ((await agentsResponse.json()) as Array<{ type: string; settings?: unknown }>).find(
          (agent) => agent.type === "hierarchical-maps",
        );
        const settings =
          typeof mapsAgent?.settings === "string"
            ? (JSON.parse(mapsAgent.settings) as Record<string, unknown>)
            : ((mapsAgent?.settings ?? {}) as Record<string, unknown>);
        const templates = settings.spatialMapTurnPromptTemplates as { roleplay?: string } | undefined;
        return templates?.roleplay?.includes("LIVE_EDITABLE_INSERT") === true;
      })
      .toBe(true);
    await expect
      .poll(async () => {
        const peekResponse = await page.request.post(`/api/chats/${chat.id}/peek-prompt`, { data: {} });
        if (!peekResponse.ok()) return false;
        const peekPayload = (await peekResponse.json()) as { messages: Array<{ content: string }> };
        return peekPayload.messages
          .map((message) => message.content)
          .join("\n")
          .includes("LIVE_EDITABLE_INSERT");
      })
      .toBe(true);
    await expect(home.getByRole("heading", { name: "Location types", exact: true })).toBeVisible();
    await expect(home.getByLabel("Location type 2 label")).toHaveValue("Settlement");
    await expect(home.getByLabel("Location type 2 label")).toHaveAttribute("readonly", "");

    await home.getByRole("button", { name: "Edit location types" }).click();
    const profileName = home.getByLabel("Profile name");
    const saveLocationTypes = home.getByRole("button", { name: "Save location types" });
    await profileName.fill("X");
    await profileName.press("Backspace");
    await expect(profileName).toHaveValue("");
    await expect(home.getByText("Profile name is required.", { exact: false })).toBeVisible();
    await expect(saveLocationTypes).toBeDisabled();
    await profileName.fill("  Maritime hierarchy  ");
    await expect(profileName).toHaveValue("  Maritime hierarchy  ");
    await home.getByLabel("Location type 1 label").fill("Planet");
    await home.getByLabel("Location type 2 label").fill("City");
    await home.getByRole("button", { name: "Add location type" }).click();
    await home.getByLabel("Location type 7 label").fill("Neighborhood");
    await home.getByLabel("Neighborhood semantic base kind").selectOption("place");
    const moveNeighborhoodUp = home.getByRole("button", { name: "Move Neighborhood up" });
    for (let step = 0; step < 6; step += 1) await moveNeighborhoodUp.click();
    await expect(moveNeighborhoodUp).toBeDisabled();
    await expectMinimumInteractiveSize(
      home.getByRole("button", { name: "Move Neighborhood down" }),
      "Location type reorder control",
    );
    await expect(home.getByRole("button", { name: "Remove City" })).toBeDisabled();
    await expect(home.getByRole("button", { name: "Remove Neighborhood" })).toBeEnabled();
    await home.getByRole("button", { name: "Revert to defaults" }).click();
    await expect(profileName).toHaveValue("Default location types");
    await expect(home.getByLabel("Location type 1 label")).toHaveValue("Region");
    await expect(home.getByLabel("Location type 2 label")).toHaveValue("Settlement");
    await profileName.fill("  Maritime hierarchy  ");
    await home.getByLabel("Location type 1 label").fill("Planet");
    await home.getByLabel("Location type 2 label").fill("City");
    await home.getByRole("button", { name: "Add location type" }).click();
    await home.getByLabel("Location type 7 label").fill("Neighborhood");
    await home.getByLabel("Neighborhood semantic base kind").selectOption("place");
    const restoredMoveNeighborhoodUp = home.getByRole("button", { name: "Move Neighborhood up" });
    for (let step = 0; step < 6; step += 1) await restoredMoveNeighborhoodUp.click();
    await saveLocationTypes.click();

    await expect
      .poll(async () => {
        const spatialResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        const payload = (await spatialResponse.json()) as {
          hierarchyProfile: {
            name: string;
            mode: string;
            types: Array<{ id: string; label: string; baseKind: string }>;
            locationTypeIds: Record<string, string>;
          };
        };
        return {
          name: payload.hierarchyProfile.name,
          mode: payload.hierarchyProfile.mode,
          order: payload.hierarchyProfile.types.slice(0, 3).map((type) => type.label),
          city: payload.hierarchyProfile.types.find((type) => type.label === "City")?.baseKind,
          neighborhood: payload.hierarchyProfile.types.find((type) => type.label === "Neighborhood")?.baseKind,
          rootType: payload.hierarchyProfile.types.find(
            (type) => type.id === payload.hierarchyProfile.locationTypeIds.ai_world,
          )?.label,
        };
      })
      .toEqual({
        name: "Maritime hierarchy",
        mode: "custom",
        order: ["Neighborhood", "Planet", "City"],
        city: "settlement",
        neighborhood: "place",
        rootType: "Planet",
      });

    await home.getByRole("button", { name: "Open map", exact: true }).click();
    const worldMapOverlay = page.locator("[data-marinara-maps-world-overlay]");
    await expect(worldMapOverlay.getByRole("heading", { name: "World map", exact: true })).toBeVisible();
    const worldMap = worldMapOverlay.getByRole("region", { name: "Hierarchical world map" });
    const harborRow = worldMap.getByRole("button", { name: /^Inspect Gloam Harbor/u });
    await expect(harborRow).toContainText("City");
    await harborRow.click();
    await expect(worldMap.getByRole("button", { name: "Set destination: Gloam Harbor" })).toBeVisible();
    await worldMap.getByRole("button", { name: "Browse up one location" }).click();
    await expect(worldMap.getByRole("button", { name: /^Inspect Shrouded Coast/u })).toContainText("Planet");
    await worldMapOverlay.getByRole("button", { name: "Back to World Maps" }).click();
    await expect(home).toBeVisible();

    await home.getByRole("button", { name: "Open map", exact: true }).click();
    await worldMapOverlay.getByRole("button", { name: "Edit map", exact: true }).click();
    const workspace = page.locator("[data-marinara-maps-workspace-root]");
    const hierarchy = workspace.locator('section[aria-label="Location hierarchy"]:visible');
    await expect(hierarchy.getByRole("button", { name: /Shrouded Coast.*Planet/u })).toBeVisible();
    await expect(hierarchy.getByRole("button", { name: /Gloam Harbor.*City/u })).toBeVisible();
    await expect(workspace.getByRole("button", { name: "Location types" })).toHaveCount(0);
    await expect(workspace.getByRole("region", { name: "Location type fields" })).toHaveCount(0);
    await hierarchy.getByRole("button", { name: /Shrouded Coast.*Planet/u }).click();
    const iconInput = workspace.getByLabel("Icon", { exact: true });
    await expect(iconInput).toHaveAttribute("maxlength", "16");
    await iconInput.fill("12345678901234567");
    await expect(iconInput).toHaveValue("1234567890123456");
    const renderedIcon = workspace
      .locator("[data-marinara-location-icon]")
      .filter({ hasText: "1234567890123456" })
      .first();
    await expect(renderedIcon).toBeVisible();
    expect((await renderedIcon.boundingBox())?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(48);

    await hierarchy.getByRole("button", { name: /Gloam Harbor.*City/u }).click();
    await hierarchy.getByRole("button", { name: /Blackglass Lighthouse/u }).click();
    await hierarchy.getByRole("button", { name: /Old Sewers/u }).click();
    await workspace.getByRole("button", { name: "Archive location", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Archive location" })
      .getByRole("button", { name: "Archive", exact: true })
      .click();
    const permanentDelete = workspace.getByRole("button", { name: "Delete permanently", exact: true });
    await expect(permanentDelete).toBeEnabled();
    await permanentDelete.click();
    await page
      .getByRole("dialog", { name: "Delete archived location permanently?" })
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await expect(hierarchy).not.toContainText("Old Sewers");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    const afterPermanentDeleteResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const afterPermanentDelete = (await afterPermanentDeleteResponse.json()) as {
      definition: { locations: Array<{ id: string }> };
      hierarchyProfile: { locationTypeIds: Record<string, string> };
    };
    expect(afterPermanentDelete.definition.locations.some((location) => location.id === "ai_sewers")).toBe(false);
    expect(afterPermanentDelete.hierarchyProfile.locationTypeIds.ai_sewers).toBeUndefined();
  } finally {
    const restoreResponse = await page.request.patch("/api/agents/type/hierarchical-maps", {
      data: { settings: originalMapsAgentSettings },
    });
    expect(restoreResponse.ok(), await restoreResponse.text()).toBeTruthy();
    await expectDeleted(page, `/api/chats/${chat.id}`);
  }
});

test("Map editor fills missing location artwork with one image per location", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Artwork generation is shared across viewports.");
  test.setTimeout(90_000);
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Maps Artwork Fill",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const uploadExistingArtwork = async (name: string) => {
    const response = await page.request.post(`/api/gallery/${chat.id}/upload`, {
      multipart: {
        prompt: `Existing artwork for ${name}.`,
        provider: "world-map-e2e",
        model: "fixture",
        width: "1",
        height: "1",
        file: {
          name: `${name}.png`,
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2SIAAAAASUVORK5CYII=",
            "base64",
          ),
        },
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return (await response.json()) as { id: string };
  };
  const lighthouseArtwork = await uploadExistingArtwork("lighthouse");
  const sewersArtwork = await uploadExistingArtwork("sewers");
  const artworkDefinition = {
    ...generatedDefinition,
    enabled: true,
    locations: generatedDefinition.locations.map((location) => {
      if (location.id === "ai_lighthouse") {
        return {
          ...location,
          childPresentation: "map" as const,
          referenceImageId: lighthouseArtwork.id,
          useReferenceImage: true,
          mapBackgroundImageId: lighthouseArtwork.id,
          mapBackgroundPosition: { x: 50, y: 50 },
        };
      }
      if (location.id === "ai_sewers") {
        return {
          ...location,
          childPresentation: "map" as const,
          referenceImageId: sewersArtwork.id,
          useReferenceImage: true,
          mapBackgroundImageId: sewersArtwork.id,
          mapBackgroundPosition: { x: 40, y: 65 },
        };
      }
      return location;
    }),
  };
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: artworkDefinition,
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();

  const generatedRequests: Array<{
    prompt: string;
    title: string;
    mapsArtworkContext?: {
      locationName: string;
      locationDescription: string;
      locationType: string;
      parentLocationName: string;
      parentLocationDescription: string;
      locationPath: string;
    };
    promptOverride?: string;
    negativePromptOverride?: string;
  }> = [];
  const previewRequests: Array<{
    id: string;
    title: string;
    prompt: string;
    mapsArtworkContext?: {
      locationName: string;
      locationDescription: string;
      locationType: string;
      parentLocationName: string;
      parentLocationDescription: string;
      locationPath: string;
    };
  }> = [];
  let pendingPreviewResponse: { markStarted: () => void; release: Promise<void> } | null = null;
  const blockNextPreviewResponse = () => {
    let markStarted = () => {};
    let releaseResponse = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = () => resolve();
    });
    const release = new Promise<void>((resolve) => {
      releaseResponse = () => resolve();
    });
    pendingPreviewResponse = { markStarted, release };
    return { started, release: releaseResponse };
  };
  const packageClientRoute = "**/api/capability-packages/hierarchical-maps/client*";
  const packageClientSource = await readFile(new URL("../packages/hierarchical-maps/client.js", import.meta.url), "utf8");
  try {
    await page.route(packageClientRoute, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body: packageClientSource });
    });
    await page.route(`**/api/gallery/${chat.id}/generate-image/preview`, async (route) => {
      const payload = route.request().postDataJSON() as {
        items?: Array<{
          id?: unknown;
          title?: unknown;
          prompt?: unknown;
          mapsArtworkContext?: (typeof previewRequests)[number]["mapsArtworkContext"];
        }>;
      };
      const items = (payload.items ?? []).map((item) => ({
        id: typeof item.id === "string" ? item.id : "",
        title: typeof item.title === "string" ? item.title : "",
        prompt: typeof item.prompt === "string" ? item.prompt : "",
        mapsArtworkContext: item.mapsArtworkContext,
      }));
      const blockedResponse = pendingPreviewResponse;
      pendingPreviewResponse = null;
      if (blockedResponse) {
        blockedResponse.markStarted();
        await blockedResponse.release;
      }
      previewRequests.push(...items);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestCount: items.length,
          connection: {
            id: "maps-art-connection",
            name: "Maps Art Connection",
            model: "test-art-model",
            source: "test-art-service",
          },
          styleProfile: { id: "velvet-campaign", name: "Velvet Campaign" },
          campaign: { included: true, artStyleIncluded: true },
          chatSettings: { imageInstructionsIncluded: true },
          width: 1280,
          height: 768,
          items: items.map((item) => ({
            ...item,
            kind: "background",
            sourcePrompt: item.prompt,
            prompt: `Engine campaign style. ${item.prompt}`,
            negativePrompt: "global negative, campaign hard negative",
            width: 1280,
            height: 768,
          })),
        }),
      });
    });
    await page.route(`**/api/gallery/${chat.id}/generate-image`, async (route) => {
      const payload = route.request().postDataJSON() as {
        prompt?: unknown;
        title?: unknown;
        mapsArtworkContext?: (typeof generatedRequests)[number]["mapsArtworkContext"];
        promptOverride?: unknown;
        negativePromptOverride?: unknown;
      };
      const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
      const title = typeof payload.title === "string" ? payload.title : "";
      const promptOverride = typeof payload.promptOverride === "string" ? payload.promptOverride : undefined;
      const negativePromptOverride =
        typeof payload.negativePromptOverride === "string" ? payload.negativePromptOverride : undefined;
      generatedRequests.push({
        prompt,
        title,
        mapsArtworkContext: payload.mapsArtworkContext,
        promptOverride,
        negativePromptOverride,
      });
      const id = `generated-map-art-${generatedRequests.length}`;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          chatId: chat.id,
          filePath: `/tmp/${id}.png`,
          prompt,
          provider: "test",
          model: "test-art",
          width: 1024,
          height: 1024,
          createdAt: new Date().toISOString(),
          url: `/api/gallery/${chat.id}/${id}`,
        }),
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            spatialMapDetailChatId: chatId,
          },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    const workspace = page.locator("[data-marinara-maps-workspace-root]");
    const fillArtwork = workspace.getByRole("button", { name: "Review artwork for 2 locations" });
    await expect(workspace.locator("[data-marinara-map-artwork-reminder]")).toHaveCount(0);
    await expect(fillArtwork).toContainText("2 incomplete locations");
    await fillArtwork.click();
    await expect(fillArtwork).toHaveCount(0);
    await expect(workspace.getByLabel("Review location artwork image requests")).toBeVisible();
    expect(previewRequests).toHaveLength(2);
    expect(previewRequests.find((request) => request.title === "Shrouded Coast")?.mapsArtworkContext).toEqual({
      locationName: "Shrouded Coast",
      locationDescription: "A coast hidden beneath sea fog.",
      locationType: "Region",
      parentLocationName: "",
      parentLocationDescription: "",
      locationPath: "Shrouded Coast",
    });
    expect(previewRequests.find((request) => request.title === "Gloam Harbor")?.mapsArtworkContext).toEqual({
      locationName: "Gloam Harbor",
      locationDescription: "A busy harbor of black piers.",
      locationType: "Settlement",
      parentLocationName: "Shrouded Coast",
      parentLocationDescription: "A coast hidden beneath sea fog.",
      locationPath: "Shrouded Coast > Gloam Harbor",
    });
    expect(generatedRequests).toHaveLength(0);
    await expect(workspace).toContainText("Review 2 image requests");
    await expect(workspace).toContainText("Maps Art Connection");
    await expect(workspace).toContainText("test-art-model");
    await expect(workspace).toContainText("Velvet Campaign");
    await expect(workspace).toContainText("Campaign art style");
    await expect(workspace).toContainText("Scene instructions");
    await expect(workspace).toContainText("Included");
    await expect(workspace).toContainText("1280 × 768");
    await expect(workspace).toContainText("Engine campaign style. Wide establishing image of Shrouded Coast");
    await expect(workspace).toContainText("global negative, campaign hard negative");

    const editedPositive = "Exact reviewed coast prompt, no tower, fog over black piers.";
    const editedNegative = "tower, text, UI, watermark";
    await workspace.getByLabel("Positive prompt for Shrouded Coast").fill(editedPositive);
    await workspace.getByLabel("Negative prompt for Shrouded Coast").fill(editedNegative);

    await workspace.getByRole("button", { name: "Refresh prompts" }).click();
    const refreshDialog = page.getByRole("dialog", { name: "Refresh artwork prompts?" });
    await expect(refreshDialog).toContainText("replaces any prompt or negative-prompt edits");
    await expect(workspace.getByLabel("Positive prompt for Shrouded Coast")).toHaveValue(editedPositive);
    await refreshDialog.getByRole("button", { name: "Refresh prompts" }).click();
    await expect.poll(() => previewRequests.length).toBe(4);
    const refreshedCoastRequest = previewRequests.slice(2).find((request) => request.title === "Shrouded Coast");
    expect(refreshedCoastRequest).toBeDefined();
    await expect(workspace.getByLabel("Positive prompt for Shrouded Coast")).toHaveValue(
      `Engine campaign style. ${refreshedCoastRequest!.prompt}`,
    );
    await expect(workspace.getByLabel("Negative prompt for Shrouded Coast")).toHaveValue(
      "global negative, campaign hard negative",
    );
    await workspace.getByLabel("Positive prompt for Shrouded Coast").fill(editedPositive);
    await workspace.getByLabel("Negative prompt for Shrouded Coast").fill(editedNegative);

    const cancellationValidation = blockNextPreviewResponse();
    await workspace.locator("[data-marinara-confirm-map-artwork]").click();
    await cancellationValidation.started;
    await workspace
      .getByLabel("Review location artwork image requests")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    cancellationValidation.release();
    const fillArtworkAfterCancellation = workspace.locator("[data-marinara-fill-map-artwork]");
    await expect(fillArtworkAfterCancellation).toBeEnabled();
    expect(generatedRequests).toHaveLength(0);

    await fillArtworkAfterCancellation.click();
    await expect(workspace.getByLabel("Review location artwork image requests")).toBeVisible();
    const mapEditValidation = blockNextPreviewResponse();
    await workspace.locator("[data-marinara-confirm-map-artwork]").click();
    await mapEditValidation.started;
    const raceDetails = workspace.locator('section[aria-label^="Details for "]:visible');
    const description = raceDetails.getByLabel("Public description");
    await description.fill("A coast changed while artwork validation is pending.");
    mapEditValidation.release();
    await expect(fillArtworkAfterCancellation).toBeEnabled();
    expect(generatedRequests).toHaveLength(0);

    await description.fill("A coast hidden beneath sea fog.");
    await fillArtworkAfterCancellation.click();
    await expect(workspace.getByLabel("Review location artwork image requests")).toBeVisible();
    await workspace.getByLabel("Positive prompt for Shrouded Coast").fill(editedPositive);
    await workspace.getByLabel("Negative prompt for Shrouded Coast").fill(editedNegative);

    await workspace.locator("[data-marinara-confirm-map-artwork]").click();
    await expect.poll(() => generatedRequests.length).toBe(2);
    const generatedRequestsByTitle = new Map(generatedRequests.map((request) => [request.title, request]));
    expect([...generatedRequestsByTitle.keys()].sort()).toEqual(["Gloam Harbor", "Shrouded Coast"]);
    expect(generatedRequestsByTitle.get("Shrouded Coast")!.prompt).toContain("Shrouded Coast");
    expect(generatedRequestsByTitle.get("Gloam Harbor")!.prompt).toContain("Gloam Harbor");
    expect(generatedRequestsByTitle.get("Shrouded Coast")!.promptOverride).toBe(editedPositive);
    expect(generatedRequestsByTitle.get("Shrouded Coast")!.negativePromptOverride).toBe(editedNegative);
    expect(generatedRequestsByTitle.get("Shrouded Coast")!.mapsArtworkContext).toEqual(
      previewRequests.find((request) => request.title === "Shrouded Coast")!.mapsArtworkContext,
    );
    expect(generatedRequestsByTitle.get("Gloam Harbor")!.promptOverride).toBe(
      `Engine campaign style. ${generatedRequestsByTitle.get("Gloam Harbor")!.prompt}`,
    );
    expect(generatedRequestsByTitle.get("Gloam Harbor")!.negativePromptOverride).toBe(
      "global negative, campaign hard negative",
    );

    const beforeSaveResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const beforeSave = (await beforeSaveResponse.json()) as {
      definition: { locations: Array<{ id: string; referenceImageId?: string }> };
    };
    expect(beforeSave.definition.locations.find((location) => location.id === "ai_world")?.referenceImageId).toBeUndefined();

    await workspace.getByRole("button", { name: "Save", exact: true }).click();
    await expect(workspace).toContainText("Saved");
    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const stored = (await storedResponse.json()) as {
      definition: {
        locations: Array<{
          id: string;
          referenceImageId?: string;
          useReferenceImage?: boolean;
          mapBackgroundImageId?: string;
        }>;
      };
    };
    const locations = new Map(stored.definition.locations.map((location) => [location.id, location]));
    expect(locations.get("ai_world")).toMatchObject({
      referenceImageId: "generated-map-art-1",
      useReferenceImage: true,
      mapBackgroundImageId: "generated-map-art-1",
    });
    expect(locations.get("ai_harbor")).toMatchObject({
      referenceImageId: "generated-map-art-2",
      useReferenceImage: true,
    });
    expect(locations.get("ai_lighthouse")).toMatchObject({
      referenceImageId: lighthouseArtwork.id,
      mapBackgroundImageId: lighthouseArtwork.id,
    });
    expect(locations.get("ai_sewers")).toMatchObject({
      referenceImageId: sewersArtwork.id,
      useReferenceImage: true,
      mapBackgroundImageId: sewersArtwork.id,
    });

    const hierarchy = workspace.locator('section[aria-label="Location hierarchy"]:visible');
    await hierarchy.getByRole("button", { name: "Shrouded Coast region" }).click();
    const details = workspace.locator('section[aria-label^="Details for "]:visible');
    const uploadReference = details.getByRole("button", { name: "Upload location reference" });
    await expectMinimumInteractiveSize(uploadReference, "Direct location artwork upload");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await uploadReference.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "shrouded-coast-upload.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(details.getByRole("img", { name: "Shrouded Coast location reference" })).toBeVisible();
    await workspace.getByRole("button", { name: "Save", exact: true }).click();
    await expect(workspace).toContainText("Saved");

    const uploadedMapResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const uploadedMap = (await uploadedMapResponse.json()) as {
      definition: { locations: Array<{ id: string; referenceImageId?: string; mapBackgroundImageId?: string }> };
    };
    const uploadedWorld = uploadedMap.definition.locations.find((location) => location.id === "ai_world");
    expect(uploadedWorld?.referenceImageId).toBeTruthy();
    expect(uploadedWorld?.referenceImageId).not.toBe("generated-map-art-1");
    expect(uploadedWorld?.mapBackgroundImageId).toBe("generated-map-art-1");

    const galleryResponse = await page.request.get(`/api/gallery/${chat.id}`);
    const gallery = (await galleryResponse.json()) as Array<{
      id: string;
      prompt: string;
      provider: string;
      model: string;
    }>;
    expect(gallery.find((image) => image.id === uploadedWorld?.referenceImageId)).toMatchObject({
      prompt: "Uploaded location reference for Shrouded Coast.",
      provider: "upload",
      model: "user-upload",
    });
  } finally {
    await page.unroute(packageClientRoute);
    await page.unroute(`**/api/gallery/${chat.id}/generate-image/preview`);
    await page.unroute(`**/api/gallery/${chat.id}/generate-image`);
    await expectDeleted(page, `/api/chats/${chat.id}`);
  }
});

test("Large map artwork reviews keep their actions visible while requests scroll", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The long artwork review uses the desktop viewport.");
  test.setTimeout(90_000);
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Maps Artwork Scroll",
      mode: "game",
      characterIds: [],
    },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const locations = Array.from({ length: 31 }, (_, index) => ({
    ...(index === 0 ? generatedDefinition.locations[0] : generatedDefinition.locations[1]),
    id: `artwork-scroll-${index + 1}`,
    parentId: index === 0 ? null : "artwork-scroll-1",
    name: index === 0 ? "The Spiral Crown" : `Location ${index + 1}`,
    childPresentation: index === 0 ? ("map" as const) : ("list" as const),
    links: [],
    sortOrder: index,
  }));
  const definition = {
    ...generatedDefinition,
    ownerMode: "game" as const,
    enabled: true,
    startingLocationId: locations[0]!.id,
    locations,
  };
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition,
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();

  try {
    await page.route(`**/api/gallery/${chat.id}/generate-image/preview`, async (route) => {
      const payload = route.request().postDataJSON() as {
        items?: Array<{ id?: unknown; title?: unknown; prompt?: unknown }>;
      };
      const items = (payload.items ?? []).map((item) => ({
        id: typeof item.id === "string" ? item.id : "",
        title: typeof item.title === "string" ? item.title : "",
        prompt: typeof item.prompt === "string" ? item.prompt : "",
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestCount: items.length,
          connection: { id: "scroll-art", name: "krea2", model: "krea2", source: "test" },
          styleProfile: { id: "auto", name: "Auto" },
          campaign: { included: true, artStyleIncluded: false },
          chatSettings: { imageInstructionsIncluded: false },
          width: 1280,
          height: 720,
          items: items.map((item) => ({
            ...item,
            kind: "background",
            sourcePrompt: item.prompt,
            prompt: `Engine style. ${item.prompt}`,
            negativePrompt: "text, UI, watermark",
            width: 1280,
            height: 720,
          })),
        }),
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            spatialMapDetailChatId: chatId,
          },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    const workspace = page.locator("[data-marinara-maps-workspace-root]");
    await workspace.locator("[data-marinara-fill-map-artwork]").click();
    const review = workspace.getByLabel("Review location artwork image requests");
    await expect(review).toContainText("Review 31 image requests");
    await expect(review.locator("[data-marinara-confirm-map-artwork]")).toBeVisible();
    const scroller = review.locator("[data-marinara-map-artwork-review-scroll]");
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true);
    await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(review.getByText("31. Location 31", { exact: true })).toBeVisible();
    await expect(review.locator("[data-marinara-confirm-map-artwork]")).toBeVisible();
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}`);
  }
});

test("missing location lore explains the problem without exposing opaque entry IDs", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const missingEntryId = `opaque-missing-entry-${Date.now()}`;
  const response = await page.request.post("/api/chats", {
    data: {
      name: `Maps Missing Lore ${testInfo.project.name}`,
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: {
        ...generatedDefinition,
        enabled: true,
        startingLocationId: "ai_harbor",
        locations: generatedDefinition.locations.map((location) =>
          location.id === "ai_harbor"
            ? { ...location, lorebookEntryIds: [missingEntryId] }
            : location,
        ),
      },
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
          version: 75,
        }),
      );
    }, chat.id);
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
    await agentsPanel
      .locator('[data-agent-name="World Maps"]')
      .getByText("World Maps", { exact: true })
      .click();
    const home = page.locator("[data-marinara-maps-home]");
    await expect(home).toBeVisible();
    await home.getByRole("button", { name: "Edit map", exact: true }).click();

    const workspace = page.locator("[data-marinara-maps-workspace-overlay]");
    const message =
      "“Gloam Harbor” links to a lore entry that was deleted or is unavailable. Open Linked lore for this location and detach the missing entry, or restore/import its lorebook.";
    await expect(workspace.getByText("Fix 1 issue(s) before saving.", { exact: true })).toBeVisible();
    await expect(workspace).toContainText(message);
    await expect(workspace).not.toContainText(missingEntryId);

    const details = workspace.locator('section[aria-label="Details for Gloam Harbor"]');
    await details.getByText("Linked lore", { exact: true }).click();
    await expect(details.getByText("Missing lore entry", { exact: true })).toBeVisible();
    await expect(details.getByText("The original entry name is unavailable.", { exact: true })).toBeVisible();
    await details.getByRole("button", { name: "Detach", exact: true }).click();
    await expect(workspace.getByText("Fix 1 issue(s) before saving.", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}`);
  }
});

test("portable map import refreshes host lorebooks and linked navigation without reload", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The portable import contract is viewport-independent.");
  test.setTimeout(120_000);
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const lorebookName = `Portable Coast ${suffix}`;
  const lorebookResponse = await page.request.post("/api/lorebooks", {
    data: {
      name: lorebookName,
      description: "Portable map lore regression fixture.",
      category: "world",
      enabled: false,
      tokenBudget: 1234,
    },
  });
  expect(lorebookResponse.ok(), await lorebookResponse.text()).toBeTruthy();
  const originalLorebook = (await lorebookResponse.json()) as { id: string };
  const folderResponse = await page.request.post(`/api/lorebooks/${originalLorebook.id}/folders`, {
    data: { name: "Harbor records", enabled: false, parentFolderId: null, order: 7 },
  });
  expect(folderResponse.ok(), await folderResponse.text()).toBeTruthy();
  const originalFolder = (await folderResponse.json()) as { id: string };
  const entryResponse = await page.request.post(`/api/lorebooks/${originalLorebook.id}/entries`, {
    data: {
      name: "Portable harbor ledger",
      content: "The harbor master keeps a portable smuggling ledger.",
      keys: ["portable harbor"],
      enabled: false,
      order: 19,
      folderId: originalFolder.id,
    },
  });
  expect(entryResponse.ok(), await entryResponse.text()).toBeTruthy();
  const originalEntry = (await entryResponse.json()) as { id: string };
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: `Portable Lore Map ${suffix}`, mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: {
        ...generatedDefinition,
        enabled: true,
        startingLocationId: "ai_harbor",
        locations: generatedDefinition.locations.map((location) =>
          location.id === "ai_harbor"
            ? { ...location, lorebookEntryIds: [originalEntry.id] }
            : location,
        ),
      },
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();
  let importedLorebookId: string | null = null;

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: true,
            rightPanel: "lorebooks",
            sidebarOpen: false,
            spatialMapDetailChatId: chatId,
          },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    const workspace = page.locator("[data-marinara-maps-workspace-root]");
    await expect(workspace).toBeVisible();
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    await expect(rightPanel.getByText(lorebookName, { exact: true })).toHaveCount(1);
    await workspace.getByRole("button", { name: /More map actions/u }).click();
    await workspace.getByRole("button", { name: "Export world map" }).click();
    let exportDialog = page.getByRole("dialog", { name: "Export portable world map" });
    await expect(exportDialog.getByRole("button", { name: "Cancel map export" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(exportDialog).toHaveCount(0);
    await workspace.getByRole("button", { name: /More map actions/u }).click();
    await workspace.getByRole("button", { name: "Export world map" }).click();
    exportDialog = page.getByRole("dialog", { name: "Export portable world map" });
    await expect(exportDialog).toContainText(`${lorebookName}`);
    await expect(exportDialog).toContainText("1 entry");
    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Download export" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const exportedMapText = await readFile(downloadPath!, "utf8");
    const exportedMap = JSON.parse(exportedMapText) as {
      formatVersion: number;
      portableLore: {
        mode: string;
        books: Array<{ name: string; entries: Array<{ originalId: string }> }>;
        references: Array<{ originalEntryId: string; originalEntryName: string }>;
      };
    };
    expect(exportedMap).toMatchObject({
      formatVersion: 4,
      portableLore: {
        mode: "linked-entries",
        books: [{ name: lorebookName, entries: [{ originalId: originalEntry.id }] }],
        references: [{ originalEntryId: originalEntry.id, originalEntryName: "Portable harbor ledger" }],
      },
    });

    const deleteLorebookResponse = await page.request.delete(`/api/lorebooks/${originalLorebook.id}`);
    expect(deleteLorebookResponse.ok(), await deleteLorebookResponse.text()).toBeTruthy();
    await workspace.locator("[data-marinara-map-import-input]").setInputFiles({
      name: download.suggestedFilename(),
      mimeType: "application/json",
      buffer: Buffer.from(exportedMapText),
    });
    const importDialog = page.getByRole("dialog", { name: "Restore portable map lore" });
    await expect(importDialog.getByRole("button", { name: "Cancel portable lore import" })).toBeFocused();
    await expect(importDialog).toContainText("1 entry");
    await expect(importDialog).toContainText("New entries");
    await importDialog.getByRole("button", { name: "Import separate copies" }).click();
    await expect(page.getByText(/1 entry was imported/u)).toBeVisible();
    await expect(workspace.locator("[data-marinara-portable-lore-unresolved]")).toHaveCount(0);
    const saveButton = workspace.getByRole("button", { name: "Save", exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(workspace).toContainText("Saved");

    const lorebooksAfterImportResponse = await page.request.get("/api/lorebooks");
    expect(lorebooksAfterImportResponse.ok(), await lorebooksAfterImportResponse.text()).toBeTruthy();
    const importedLorebook = ((await lorebooksAfterImportResponse.json()) as Array<{
      id: string;
      name: string;
      enabled: boolean;
      tokenBudget: number;
    }>).find((candidate) => candidate.name === lorebookName);
    expect(importedLorebook).toMatchObject({ enabled: false, tokenBudget: 1234 });
    importedLorebookId = importedLorebook?.id ?? null;
    expect(importedLorebookId).not.toBeNull();
    expect(importedLorebookId).not.toBe(originalLorebook.id);
    const importedEntriesResponse = await page.request.get(`/api/lorebooks/${importedLorebookId}/entries`);
    expect(importedEntriesResponse.ok(), await importedEntriesResponse.text()).toBeTruthy();
    const importedEntries = (await importedEntriesResponse.json()) as Array<{
      id: string;
      name: string;
      enabled: boolean;
      folderId: string | null;
    }>;
    expect(importedEntries).toHaveLength(1);
    expect(importedEntries[0]).toMatchObject({ name: "Portable harbor ledger", enabled: false });
    expect(importedEntries[0]?.id).not.toBe(originalEntry.id);
    const importedFoldersResponse = await page.request.get(`/api/lorebooks/${importedLorebookId}/folders`);
    expect(importedFoldersResponse.ok(), await importedFoldersResponse.text()).toBeTruthy();
    expect(await importedFoldersResponse.json()).toEqual([
      expect.objectContaining({ name: "Harbor records", enabled: false, order: 7 }),
    ]);
    expect(importedEntries[0]?.folderId).not.toBeNull();
    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(storedResponse.ok(), await storedResponse.text()).toBeTruthy();
    const stored = (await storedResponse.json()) as {
      definition: { locations: Array<{ id: string; lorebookEntryIds: string[] }> };
    };
    expect(stored.definition.locations.find((location) => location.id === "ai_harbor")?.lorebookEntryIds).toEqual([
      importedEntries[0]?.id,
    ]);

    await workspace.getByRole("button", { name: "Back to chat", exact: true }).click();
    await expect(workspace).toHaveCount(0);
    const importedLorebookRow = rightPanel.locator('[data-touch-drag-card="lorebook"]', {
      hasText: lorebookName,
    });
    await expect(importedLorebookRow).toHaveCount(1);
    await importedLorebookRow.getByText(lorebookName, { exact: true }).click();
    await expect(page.getByRole("heading", { name: lorebookName, exact: true })).toBeVisible();
    await page.locator(".mari-editor-header").getByRole("button").first().click();

    await page.locator('[data-tour="panel-agents"]').click();
    const agentsPanel = page.locator('[data-component="RightPanelDesktop"]');
    await agentsPanel
      .locator('[data-agent-name="World Maps"]')
      .getByText("World Maps", { exact: true })
      .click();
    const home = page.locator("[data-marinara-maps-home]");
    await expect(home).toBeVisible();
    await home.getByRole("button", { name: "Edit map", exact: true }).click();
    await expect(workspace).toBeVisible();
    const details = workspace.locator('section[aria-label="Details for Gloam Harbor"]');
    await details.getByText("Linked lore", { exact: true }).click();
    await expect(details.getByText("Portable harbor ledger", { exact: true }).first()).toBeVisible();
    await details.getByRole("button", { name: "Open", exact: true }).click();
    await expect(workspace).toHaveCount(0);
    await expect(page.getByRole("heading", { name: lorebookName, exact: true })).toBeVisible();

    await expectDeleted(page, `/api/chats/${chat.id}`);
    const retainedLorebookResponse = await page.request.get(`/api/lorebooks/${importedLorebookId}`);
    expect(retainedLorebookResponse.ok(), await retainedLorebookResponse.text()).toBeTruthy();
  } finally {
    const chatCheck = await page.request.get(`/api/chats/${chat.id}`);
    if (chatCheck.ok()) await expectDeleted(page, `/api/chats/${chat.id}`);
    const originalLorebookCheck = await page.request.get(`/api/lorebooks/${originalLorebook.id}`);
    if (originalLorebookCheck.ok()) await expectDeleted(page, `/api/lorebooks/${originalLorebook.id}`);
    if (importedLorebookId) {
      const importedLorebookCheck = await page.request.get(`/api/lorebooks/${importedLorebookId}`);
      if (importedLorebookCheck.ok()) await expectDeleted(page, `/api/lorebooks/${importedLorebookId}`);
    }
  }
});

for (const libraryTarget of ["template", "shared-world"] as const) {
  test(`portable lore refresh reaches the host from a ${libraryTarget} library editor`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "The library callback bridge is viewport-independent.");
    test.setTimeout(120_000);
    const suffix = `${libraryTarget}-${testInfo.project.name}-${Date.now()}`;
    const lorebookName = `Library refresh ${suffix}`;
    const recordName = `Callback ${libraryTarget} ${suffix}`;
    const lorebookResponse = await page.request.post("/api/lorebooks", {
      data: {
        name: lorebookName,
        description: "Portable lore callback forwarding fixture.",
        category: "world",
        enabled: false,
      },
    });
    expect(lorebookResponse.ok(), await lorebookResponse.text()).toBeTruthy();
    const originalLorebook = (await lorebookResponse.json()) as { id: string };
    const entryResponse = await page.request.post(`/api/lorebooks/${originalLorebook.id}/entries`, {
      data: {
        name: `Library ledger ${suffix}`,
        content: "The library editor must refresh the host after restoring this ledger.",
        keys: ["library refresh"],
        enabled: false,
        order: 3,
      },
    });
    expect(entryResponse.ok(), await entryResponse.text()).toBeTruthy();
    const originalEntry = (await entryResponse.json()) as { id: string };
    const chatResponse = await page.request.post("/api/chats", {
      data: { name: `Library callback ${suffix}`, mode: "roleplay", characterIds: [] },
    });
    expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    await activateHierarchicalMaps(page, chat.id);
    const spatialResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(spatialResponse.ok(), await spatialResponse.text()).toBeTruthy();
    const spatial = (await spatialResponse.json()) as { hierarchyProfile: unknown };
    const recordEndpoint =
      libraryTarget === "template"
        ? "/api/chats/spatial-context/templates"
        : "/api/chats/spatial-context/shared-worlds";
    const recordResponse = await page.request.post(recordEndpoint, {
      data: {
        name: recordName,
        description: "Nested World Maps library callback fixture.",
        definition: { ...generatedDefinition, enabled: true, revision: 0 },
        hierarchyProfile: spatial.hierarchyProfile,
      },
    });
    expect(recordResponse.ok(), await recordResponse.text()).toBeTruthy();
    const libraryRecord = (await recordResponse.json()) as { id: string; revision: number };
    let importedLorebookId: string | null = null;

    try {
      await page.addInitScript((chatId) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            state: { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false },
            version: 75,
          }),
        );
      }, chat.id);
      await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
        await route.fulfill({ status: 204, body: "" });
      });
      await page.goto("/");
      await dismissOnboardingTutorial(page);
      await page.locator('[data-tour="panel-agents"]').click();
      const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
      await rightPanel
        .locator('[data-agent-name="World Maps"]')
        .getByText("World Maps", { exact: true })
        .click();
      const home = page.locator("[data-marinara-maps-home]");
      await expect(home).toBeVisible();

      await page.locator('[data-tour="panel-lorebooks"]').click();
      await expect(rightPanel.getByText(lorebookName, { exact: true })).toHaveCount(1);
      const deleteOriginalResponse = await page.request.delete(`/api/lorebooks/${originalLorebook.id}`);
      expect(deleteOriginalResponse.ok(), await deleteOriginalResponse.text()).toBeTruthy();

      await home.getByRole("button", { name: "Open world library" }).click();
      const library = page.locator("[data-marinara-map-template-library]");
      await expect(library).toBeVisible();
      const recordCard = library.getByRole("heading", { name: recordName, exact: true }).locator("xpath=ancestor::article");
      await recordCard
        .getByRole("button", { name: libraryTarget === "template" ? "Edit" : "Edit canonical", exact: true })
        .click();

      const workspace = page.locator("[data-marinara-maps-workspace-root]");
      await expect(workspace).toBeVisible();
      const importedDefinition = {
        ...generatedDefinition,
        enabled: true,
        revision: 0,
        startingLocationId: "ai_harbor",
        locations: generatedDefinition.locations.map((location) =>
          location.id === "ai_harbor" ? { ...location, lorebookEntryIds: [originalEntry.id] } : location,
        ),
      };
      const entryKey = `entry:${originalEntry.id}`;
      const portableMap = {
        format: "marinara-hierarchical-map",
        formatVersion: 4,
        definition: importedDefinition,
        portableLore: {
          schemaVersion: 1,
          mode: "linked-entries",
          books: [
            {
              key: `book:${originalLorebook.id}`,
              originalId: originalLorebook.id,
              name: lorebookName,
              settings: {
                description: "Portable lore callback forwarding fixture.",
                category: "world",
                enabled: false,
              },
              folders: [],
              entries: [
                {
                  key: entryKey,
                  originalId: originalEntry.id,
                  name: `Library ledger ${suffix}`,
                  folderKey: null,
                  fingerprint: `entry-v1:${"0".repeat(16)}`,
                  data: {
                    name: `Library ledger ${suffix}`,
                    content: "The library editor must refresh the host after restoring this ledger.",
                    keys: ["library refresh"],
                    enabled: false,
                    order: 3,
                  },
                },
              ],
            },
          ],
          references: [
            {
              locationId: "ai_harbor",
              locationName: "Gloam Harbor",
              entryKey,
              originalLorebookId: originalLorebook.id,
              originalLorebookName: lorebookName,
              originalEntryId: originalEntry.id,
              originalEntryName: `Library ledger ${suffix}`,
            },
          ],
        },
      };
      await workspace.locator("[data-marinara-map-import-input]").setInputFiles({
        name: `${suffix}.world-map.json`,
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(portableMap)),
      });
      const importDialog = page.getByRole("dialog", { name: "Restore portable map lore" });
      await expect(importDialog).toContainText("1 lorebook · 1 entry");
      await importDialog.getByRole("button", { name: "Import separate copies" }).click();
      await expect(page.getByText(/1 entry was imported/u)).toBeVisible();
      const details = workspace.locator('section[aria-label="Details for Gloam Harbor"]');
      await details.getByText("Linked lore", { exact: true }).click();
      await expect(details.getByText(`Library ledger ${suffix}`, { exact: true }).first()).toBeVisible();
      await expect(details.getByText("Missing lore entry", { exact: true })).toHaveCount(0);

      const saveLabel = libraryTarget === "template" ? "Save template" : "Update shared world";
      await workspace.getByRole("button", { name: saveLabel, exact: true }).click();
      await expect(workspace).toContainText("Saved");
      await workspace.getByRole("button", { name: "Back to map library" }).click();
      await expect(library).toBeVisible();
      await library.getByRole("button", { name: "Back to Maps" }).click();
      await expect(home).toBeVisible();

      const lorebooksAfterImportResponse = await page.request.get("/api/lorebooks");
      expect(lorebooksAfterImportResponse.ok(), await lorebooksAfterImportResponse.text()).toBeTruthy();
      const importedLorebook = ((await lorebooksAfterImportResponse.json()) as Array<{ id: string; name: string }>).find(
        (candidate) => candidate.name === lorebookName,
      );
      importedLorebookId = importedLorebook?.id ?? null;
      expect(importedLorebookId).not.toBeNull();
      expect(importedLorebookId).not.toBe(originalLorebook.id);

      const refreshedRow = rightPanel.locator('[data-touch-drag-card="lorebook"]', { hasText: lorebookName });
      await expect(refreshedRow).toHaveCount(1);
      await refreshedRow.getByText(lorebookName, { exact: true }).click();
      await expect(page.getByRole("heading", { name: lorebookName, exact: true })).toBeVisible();
    } finally {
      const recordsResponse = await page.request.get(recordEndpoint);
      if (recordsResponse.ok()) {
        const currentRecord = ((await recordsResponse.json()) as Array<{ id: string; revision: number }>).find(
          (candidate) => candidate.id === libraryRecord.id,
        );
        if (currentRecord) {
          const response = await page.request.delete(`${recordEndpoint}/${currentRecord.id}`, {
            data: { expectedRevision: currentRecord.revision },
          });
          expect(response.ok(), await response.text()).toBeTruthy();
        }
      }
      const chatCheck = await page.request.get(`/api/chats/${chat.id}`);
      if (chatCheck.ok()) await expectDeleted(page, `/api/chats/${chat.id}`);
      const originalLorebookCheck = await page.request.get(`/api/lorebooks/${originalLorebook.id}`);
      if (originalLorebookCheck.ok()) await expectDeleted(page, `/api/lorebooks/${originalLorebook.id}`);
      if (importedLorebookId) {
        const importedLorebookCheck = await page.request.get(`/api/lorebooks/${importedLorebookId}`);
        if (importedLorebookCheck.ok()) await expectDeleted(page, `/api/lorebooks/${importedLorebookId}`);
      }
    }
  });
}

test("opening linked lore protects unsaved map edits", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The guarded navigation contract is viewport-independent.");
  test.setTimeout(90_000);
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const lorebookName = `Maps guarded navigation ${suffix}`;
  const lorebookResponse = await page.request.post("/api/lorebooks", {
    data: {
      name: lorebookName,
      description: "Linked lore navigation regression fixture.",
      category: "world",
      enabled: true,
    },
  });
  expect(lorebookResponse.ok(), await lorebookResponse.text()).toBeTruthy();
  const lorebook = (await lorebookResponse.json()) as { id: string };
  const entryResponse = await page.request.post(`/api/lorebooks/${lorebook.id}/entries`, {
    data: {
      name: "Harbor navigation lore",
      content: "The harbor keeps a careful ledger.",
      order: 0,
    },
  });
  expect(entryResponse.ok(), await entryResponse.text()).toBeTruthy();
  const entry = (await entryResponse.json()) as { id: string };
  const searchableLorebookResponse = await page.request.post("/api/lorebooks", {
    data: {
      name: `Trick Archive ${suffix}`,
      description: "A disabled book used to prove book-name search and grouping.",
      category: "world",
      enabled: false,
    },
  });
  expect(searchableLorebookResponse.ok(), await searchableLorebookResponse.text()).toBeTruthy();
  const searchableLorebook = (await searchableLorebookResponse.json()) as { id: string };
  const searchableEntryResponse = await page.request.post(`/api/lorebooks/${searchableLorebook.id}/entries`, {
    data: {
      name: "TODO location note",
      content: "This entry is found by its parent lorebook name.",
      order: 0,
    },
  });
  expect(searchableEntryResponse.ok(), await searchableEntryResponse.text()).toBeTruthy();
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: `Maps Guarded Lore ${suffix}`,
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: {
        ...generatedDefinition,
        enabled: true,
        startingLocationId: "ai_harbor",
        locations: generatedDefinition.locations.map((location) =>
          location.id === "ai_harbor" ? { ...location, lorebookEntryIds: [entry.id] } : location,
        ),
      },
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            spatialMapDetailChatId: chatId,
          },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);

    const workspace = page.locator("[data-marinara-maps-workspace-overlay]");
    await expect(workspace).toBeVisible();
    const details = workspace.locator('section[aria-label^="Details for "]:visible');
    const nameInput = details.getByLabel("Name", { exact: true });
    await details.getByText("Linked lore", { exact: true }).click();
    await expect(details.getByText("Harbor navigation lore", { exact: true })).toBeVisible();
    await details.getByRole("button", { name: "Open", exact: true }).click();
    await expect(workspace).toHaveCount(0);
    await expect(page.getByRole("heading", { name: lorebookName, exact: true })).toBeVisible();

    await page.reload();
    await dismissOnboardingTutorial(page);
    await expect(workspace).toBeVisible();
    await nameInput.fill("Unsaved harbor name");
    await expect(workspace.getByText("Unsaved", { exact: true })).toBeVisible();
    await details.getByText("Linked lore", { exact: true }).click();
    await expect(details.locator("[data-marinara-disclosure-indicator]")).toBeVisible();
    await expect(details.getByText("Harbor navigation lore", { exact: true })).toBeVisible();

    const searchableLorebookGroup = details.locator(`[data-marinara-lorebook-group="${searchableLorebook.id}"]`);
    await expect(searchableLorebookGroup).not.toHaveAttribute("open", "");
    await expect(searchableLorebookGroup.getByText("TODO location note", { exact: true })).toBeHidden();
    await details.getByLabel("Search lorebook names and entries").fill("Trick Archive");
    await expect(searchableLorebookGroup).toHaveAttribute("open", "");
    await expect(searchableLorebookGroup).toContainText("Trick Archive");
    await expect(searchableLorebookGroup.getByRole("button", { name: /TODO location note/u })).toBeDisabled();

    await details.getByRole("button", { name: "Open", exact: true }).click();
    const discardDialog = page.getByRole("dialog", { name: "Discard map changes?" });
    await expect(discardDialog).toContainText(
      "You have unsaved world map changes. Open the linked lorebook and discard them?",
    );
    await discardDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(discardDialog).toHaveCount(0);
    await expect(nameInput).toHaveValue("Unsaved harbor name");
    await expect(workspace).toBeVisible();

    await details.getByRole("button", { name: "Open", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Discard map changes?" })
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
    await expect(workspace).toHaveCount(0);
    await expect(page.getByRole("heading", { name: lorebookName, exact: true })).toBeVisible();
  } finally {
    await expectDeletedInOrder(page, [
      `/api/chats/${chat.id}`,
      `/api/lorebooks/${lorebook.id}`,
      `/api/lorebooks/${searchableLorebook.id}`,
    ]);
  }
});

test("Deep maps and long labels remain keyboard and touch operable across themes", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: `Deep Maps Theme Recovery ${testInfo.project.name}`,
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);

  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: deepMapDefinition,
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();

  try {
    await page.addInitScript((chatId) => {
      const requestedAppearance = JSON.parse(
        localStorage.getItem("marinara-maps-e2-appearance") ??
          JSON.stringify({ theme: "dark", visualTheme: "default" }),
      ) as { theme: "dark" | "light"; visualTheme: "default" | "sillytavern" };
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara-engine-ui-updated-at", String(Date.now() + 60_000));
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            spatialMapDetailChatId: chatId,
            theme: requestedAppearance.theme,
            visualTheme: requestedAppearance.visualTheme,
            appBackgroundColor: "",
            appAccentColor: "",
          },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);
    await expectWorkspaceFillsOverlay(page);

    const hierarchy = page.locator('section[aria-label="Location hierarchy"]:visible');
    const rootName = deepMapDefinition.locations[0]!.name;
    const rootExpand = hierarchy.getByRole("button", { name: `Expand ${rootName}`, exact: true });
    const rootEnter = hierarchy.getByRole("button", { name: `Enter ${rootName}`, exact: true });
    await expectMinimumInteractiveSize(rootExpand, "Hierarchy expand control");
    await expectMinimumInteractiveSize(rootEnter, "Hierarchy enter control");

    for (let index = 0; index < deepMapDefinition.locations.length - 1; index += 1) {
      const location = deepMapDefinition.locations[index]!;
      const nextLocation = deepMapDefinition.locations[index + 1]!;
      const expand = hierarchy.getByRole("button", { name: `Expand ${location.name}`, exact: true });
      await expand.scrollIntoViewIfNeeded();
      if (index === 0) {
        await expand.focus();
        await page.keyboard.press("Enter");
      } else {
        await expand.click();
      }
      await expect(hierarchy.getByRole("button", { name: `Enter ${nextLocation.name}`, exact: true })).toBeVisible();
    }

    const hierarchyOverflow = await hierarchy.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(hierarchyOverflow).toBeLessThanOrEqual(1);

    await rootEnter.scrollIntoViewIfNeeded();
    await rootEnter.focus();
    await page.keyboard.press("Space");

    const localView = page.locator('section[aria-label="Local location view"]:visible');
    await expect(localView.getByRole("heading", { name: rootName, exact: true })).toBeVisible();
    const leaveLocation = localView.getByRole("button", { name: "Leave this location" });
    const localEnter = localView.getByRole("button", { name: "Enter", exact: true });
    await expectMinimumInteractiveSize(leaveLocation, "Local map leave control");
    await expectMinimumInteractiveSize(localEnter, "Local map enter control");

    const childName = deepMapDefinition.locations[1]!.name;
    const childLocation = localView.getByRole("button", { name: childName, exact: true });
    await childLocation.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.locator('section[aria-label^="Details for "]:visible').getByLabel("Name", { exact: true }),
    ).toHaveValue(childName);

    if (testInfo.project.name.includes("mobile")) {
      for (const pane of ["hierarchy", "local", "details"] as const) {
        await expectMinimumInteractiveSize(
          page.getByRole("button", { name: pane, exact: true }),
          `Mobile ${pane} pane control`,
        );
      }
    }

    for (const appearance of [
      { theme: "dark", visualTheme: "default" },
      { theme: "light", visualTheme: "default" },
      { theme: "dark", visualTheme: "sillytavern" },
    ] as const) {
      await page.evaluate((nextAppearance) => {
        localStorage.setItem("marinara-maps-e2-appearance", JSON.stringify(nextAppearance));
      }, appearance);
      await page.reload();
      await dismissOnboardingTutorial(page);
      await expectWorkspaceTheme(page, appearance);
      await expect(rootEnter).toBeVisible();
    }
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}`);
  }
});

test("Map loading retry and stale-write recovery preserve the working copy", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The recovery state is shared across viewports.");
  test.setTimeout(90_000);
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Maps Loading and Conflict Recovery",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: { ...generatedDefinition, enabled: true },
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();
  const saved = (await saveResponse.json()) as {
    currentLocationId: string;
    definition: typeof generatedDefinition;
  };

  let releaseInitialRead: (() => void) | null = null;
  const initialReadHeld = new Promise<void>((resolve) => {
    releaseInitialRead = resolve;
  });
  let heldInitialRead = false;
  let allowSuccessfulRead = false;

  try {
    await page.route(`**/api/chats/${chat.id}/spatial-context`, async (route) => {
      if (route.request().method() === "GET" && !allowSuccessfulRead) {
        if (!heldInitialRead) {
          heldInitialRead = true;
          await initialReadHeld;
        }
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Temporary map service interruption." }),
        });
        return;
      }
      await route.continue();
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            spatialMapDetailChatId: chatId,
          },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);
    await expect(page.getByLabel("Loading world map editor")).toBeVisible();

    releaseInitialRead?.();
    await expect(page.getByRole("heading", { name: "World map unavailable" })).toBeVisible();
    const recovery = page.getByRole("region", { name: "World map recovery" });
    const retry = recovery.getByRole("button", { name: "Retry", exact: true });
    const back = recovery.getByRole("button", { name: "Back", exact: true });
    await expectMinimumInteractiveSize(retry, "Map retry control");
    await expectMinimumInteractiveSize(back, "Map recovery back control");
    allowSuccessfulRead = true;
    await retry.click();

    await expect(page.getByRole("heading", { name: "World map", exact: true })).toBeVisible();
    const localName = "Local unsaved harbor name";
    const serverName = "Server-updated harbor name";
    const nameInput = page.locator('section[aria-label^="Details for "]:visible').getByLabel("Name", { exact: true });
    await nameInput.fill(localName);

    const externalSave = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
      data: {
        expectedRevision: saved.definition.revision,
        expectedCurrentLocationId: saved.currentLocationId,
        definition: {
          ...saved.definition,
          locations: saved.definition.locations.map((location) =>
            location.id === saved.definition.startingLocationId ? { ...location, name: serverName } : location,
          ),
        },
      },
    });
    expect(externalSave.ok(), await externalSave.text()).toBeTruthy();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("alert").getByText("The map changed elsewhere. Your working copy is preserved.")).toBeVisible();
    await expect(nameInput).toHaveValue(localName);

    const reloadServer = page.getByRole("button", { name: "Reload server version" });
    const reviewDifferences = page.getByRole("button", { name: "Review differences" });
    await expectMinimumInteractiveSize(reloadServer, "Conflict reload control");
    await expectMinimumInteractiveSize(reviewDifferences, "Conflict review control");
    await reviewDifferences.click();
    await expect(page.getByText("1 changed", { exact: true })).toBeVisible();
    await reloadServer.click();
    await expect(nameInput).toHaveValue(serverName);
    await expect(page.getByText("The map changed elsewhere. Your working copy is preserved.")).toHaveCount(0);
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}`);
  }
});

test("AI map builder previews a validated local draft before save", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
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
  let generationRequestCount = 0;

  await page.route(`**/api/chats/${chat.id}/spatial-context/generate`, async (route) => {
    generationRequestCount += 1;
    const request = route.request().postDataJSON() as {
      operation: string;
      size: string;
      targetLocationCount?: number;
      instructions?: string;
      debugMode: boolean;
      promptOverride?: { system: string; user: string };
    };
    expect(request).toMatchObject({
      operation: "create",
      size: "small",
      targetLocationCount: 8,
      instructions: "A foggy port with a lighthouse and secret sewers.",
      debugMode: false,
    });
    expect(request.promptOverride).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        operation: "create",
        size: "small",
        source: "roleplay_setup",
        generatedLocationCount: regeneratedDefinition.locations.length,
        definition: generationRequestCount === 1 ? generatedDefinition : regeneratedDefinition,
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
      const { agentEntry } = await openHierarchicalMapsAgentControls(page);
      await agentEntry.getByRole("button", { name: "Set up world map" }).click();
    }

    await expectWorkspaceFillsOverlay(page);
    const workspace = page.locator("[data-marinara-maps-workspace-root]");
    await expect(workspace.getByRole("button", { name: "Draft with AI" })).toBeVisible();
    await expect(workspace.getByRole("button", { name: "Build manually" })).toBeVisible();
    await expect(workspace.getByRole("button", { name: "Use template or shared world" })).toBeVisible();
    await expect(workspace.getByRole("button", { name: "Import map file" })).toBeVisible();
    await page.getByRole("button", { name: "Draft with AI" }).click();
    await expect(page.getByRole("heading", { name: "Draft the map with AI" })).toBeVisible();
    await expectAiBuilderLayout(page, mobile);
    await page.getByLabel("What should this world include?").fill("A foggy port with a lighthouse and secret sewers.");
    await page.getByRole("button", { name: /Small About 8 places/ }).click();
    await expect(page.getByLabel("Custom place target")).toHaveValue("8");
    await page.getByRole("button", { name: /^Custom Edit every type/u }).click();
    await page.getByRole("button", { name: "Move Region down" }).click();
    await expect(page.getByLabel("Location type 1 label")).toHaveValue("Settlement");
    await expect(page.getByLabel("Location type 2 label")).toHaveValue("Region");
    await expectMinimumInteractiveSize(
      page.getByRole("button", { name: "Move Region up" }),
      "AI hierarchy reorder control",
    );
    await page.getByRole("button", { name: "Move Region up" }).click();
    await page.getByRole("button", { name: /^Auto AI fits this world/u }).click();
    await expect(page.getByRole("button", { name: "Preview full prompt" })).toHaveCount(0);
    await page.getByRole("button", { name: "Generate draft", exact: true }).click();
    await expect(page.getByText("Validated", { exact: true })).toBeVisible();
    await expect(page.getByText("4 locations · 2 levels · not saved", { exact: true })).toBeVisible();
    await expect(page.getByText("Proposed start:").getByText("Shrouded Coast", { exact: true })).toBeVisible();

    const draftHierarchy = page.getByRole("region", {
      name: "Generated location hierarchy",
    });
    await expect(draftHierarchy.getByRole("button", { name: /^Gloam Harbor/ })).toBeVisible();
    await expect(draftHierarchy.getByRole("button", { name: /^Blackglass Lighthouse/ })).toBeVisible();
    await draftHierarchy.getByRole("button", { name: /^Blackglass Lighthouse/ }).click();

    const draftDetails = page.getByRole("region", {
      name: "Selected generated location details",
    });
    await expect(draftDetails.getByRole("heading", { name: "Blackglass Lighthouse" })).toBeVisible();
    await expect(
      draftDetails.getByText("A dark lighthouse on the cliffs.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      draftDetails.getByText("Its lamp reveals hidden ink at midnight.", {
        exact: true,
      }),
    ).toBeVisible();

    await page.getByLabel("Search generated locations").fill("sewers");
    await expect(draftHierarchy.getByRole("button", { name: /^Old Sewers/ })).toBeVisible();
    await expect(draftHierarchy.getByRole("button", { name: /^Gloam Harbor/ })).toHaveCount(0);
    await page.getByLabel("Search generated locations").clear();

    const beforeApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await beforeApply.json()) as { definition: unknown }).definition).toBeNull();

    await page.getByRole("button", { name: "Continue to editor" }).click();
    await expect(page.getByText("AI map draft applied. Review it, choose a start, then enable and save.")).toBeVisible();
    const hierarchy = page.locator('section[aria-label="Location hierarchy"]:visible');
    await expect(hierarchy.getByRole("button", { name: "Shrouded Coast region" })).toBeVisible();
    await expect(hierarchy.getByRole("button", { name: "Collapse Shrouded Coast" })).toBeVisible();
    await expect(hierarchy.getByRole("button", { name: "Enter Gloam Harbor" })).toBeVisible();

    const firstMapSetup = page.getByRole("region", { name: "First map setup" });
    await expect(firstMapSetup).toContainText("4 locations · 2 levels · Working draft, not saved");
    await expect(firstMapSetup.getByRole("list", { name: "First map progress" })).toContainText(
      /Build.*Review.*Start here.*Enable map/u,
    );
    await expectMinimumInteractiveSize(firstMapSetup.getByRole("button", { name: "Discard draft" }), "Discard draft control");
    await expectMinimumInteractiveSize(firstMapSetup.getByRole("button", { name: "Regenerate" }), "Regenerate draft control");
    await firstMapSetup.getByRole("button", { name: "Regenerate" }).click();
    const regenerateDialog = page.getByRole("dialog", { name: "Regenerate this working draft?" });
    await expect(regenerateDialog).toBeVisible();
    const confirmRegeneration = regenerateDialog.getByRole("button", { name: "Regenerate draft", exact: true });
    await confirmRegeneration.focus();
    await page.keyboard.press("Enter");
    await expect(regenerateDialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Draft the map with AI" })).toBeVisible();
    await expect(page.getByLabel("What should this world include?")).toHaveValue(
      "A foggy port with a lighthouse and secret sewers.",
    );
    await expect(page.getByRole("button", { name: /Small About 8 places/ })).toHaveAttribute("aria-pressed", "true");
    const regeneratedHierarchy = page.getByRole("region", { name: "Generated location hierarchy" });
    await expect(regeneratedHierarchy.getByRole("button", { name: /^Recharted Coast/ })).toBeVisible();
    expect(generationRequestCount).toBe(2);
    await page.getByRole("button", { name: "Replace working draft" }).click();
    await expect(hierarchy.getByRole("button", { name: "Recharted Coast region" })).toBeVisible();
    const startingLocation = firstMapSetup.getByLabel("Starting location");
    await expect(startingLocation).toHaveValue("ai_world");
    await startingLocation.selectOption("ai_harbor");

    const afterApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await afterApply.json()) as { definition: unknown }).definition).toBeNull();

    await expect(page.getByLabel("Disabled", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Enable and save map", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page.getByText("Map ready · 4 locations · Starting at Gloam Harbor", { exact: true })).toBeVisible();
    await expectMinimumInteractiveSize(page.getByRole("button", { name: "Return to chat" }), "First-save return control");

    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const stored = (await storedResponse.json()) as {
      currentLocationId: string;
      definition: { enabled: boolean; startingLocationId: string; locations: Array<{ name: string }> };
    };
    expect(stored.definition.enabled).toBe(true);
    expect(stored.definition.startingLocationId).toBe("ai_harbor");
    expect(stored.currentLocationId).toBe("ai_harbor");
    expect(stored.definition.locations.map((location) => location.name)).toEqual([
      "Recharted Coast",
      "Gloam Harbor",
      "Blackglass Lighthouse",
      "Old Sewers",
    ]);

    await hierarchy.getByRole("button", { name: "Recharted Coast region" }).click();
    if (mobile) await page.getByRole("button", { name: "details", exact: true }).click();
    const details = page.locator('section[aria-label="Location details"]:visible');
    await expect(details).toContainText(
      "The starting location is used when a new story begins. The current story location is where this chat is now.",
    );
    const correctCurrentLocation = details.getByRole("button", { name: "Set current story location" });
    await expectMinimumInteractiveSize(correctCurrentLocation, "Correct current story location control");
    await correctCurrentLocation.click();
    const currentLocationDialog = page.getByRole("dialog", { name: "Set current story location?" });
    await expect(currentLocationDialog).toContainText("administrative correction, not narrated travel");
    await expect(currentLocationDialog).toContainText("does not rewrite earlier messages");
    await currentLocationDialog.getByRole("button", { name: "Set current location" }).click();
    await expect(details.getByRole("button", { name: "Current story location" })).toBeDisabled();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => {
        const correctedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        return ((await correctedResponse.json()) as { currentLocationId: string }).currentLocationId;
      })
      .toBe("ai_world");

    if (mobile) await page.getByRole("button", { name: "hierarchy", exact: true }).click();

    let replaceMap: Locator;
    if (mobile) {
      const header = workspace.locator(":scope > .mari-editor-header");
      const moreActions = header.getByRole("button", { name: "More map actions" });
      await expectMinimumInteractiveSize(moreActions, "Mobile map actions control");
      await expect(workspace.locator("[data-marinara-map-artwork-reminder]")).toBeHidden();
      await expect(moreActions.locator("[data-marinara-map-notice-count]")).toHaveText("1");
      await expect(workspace.getByRole("button", { name: "Expand with AI", exact: true })).toHaveCount(0);
      const headerGeometry = await header.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          left: rect.left,
          right: rect.right,
          viewportWidth: window.innerWidth,
        };
      });
      expect(headerGeometry.scrollWidth).toBeLessThanOrEqual(headerGeometry.clientWidth + 1);
      expect(headerGeometry.scrollHeight).toBeLessThanOrEqual(headerGeometry.clientHeight + 1);
      expect(headerGeometry.clientHeight).toBeLessThanOrEqual(80);
      const mobileTitleWidth = await header
        .getByRole("heading", { name: "World map" })
        .evaluate((element) => element.getBoundingClientRect().width);
      expect(mobileTitleWidth).toBeGreaterThanOrEqual(80);
      expect(headerGeometry.left).toBeGreaterThanOrEqual(-1);
      expect(headerGeometry.right).toBeLessThanOrEqual(headerGeometry.viewportWidth + 1);

      const moreActionsBox = await moreActions.boundingBox();
      expect(moreActionsBox).not.toBeNull();
      await page.touchscreen.tap(
        moreActionsBox!.x + moreActionsBox!.width / 2,
        moreActionsBox!.y + moreActionsBox!.height / 2,
      );
      const mobileActions = workspace.getByRole("region", { name: "Map actions" });
      await expect(mobileActions).toBeVisible();
      await expect(mobileActions.getByRole("button", { name: "Expand with AI", exact: true })).toBeVisible();
      await expect(
        mobileActions.getByRole("button", { name: "Open shared worlds and map templates" }),
      ).toBeVisible();
      await expect(mobileActions.getByRole("button", { name: "Export world map" })).toBeVisible();
      await expect(mobileActions.getByRole("button", { name: "Import world map" })).toBeVisible();
      await expect(mobileActions.getByRole("button", { name: "Review artwork for 4 locations" })).toBeVisible();
      await expectMinimumInteractiveSize(
        mobileActions.getByRole("button", { name: "Expand with AI", exact: true }),
        "Mobile AI map action",
      );
      await expectMinimumInteractiveSize(
        mobileActions.getByRole("button", { name: "Open shared worlds and map templates" }),
        "Mobile map templates action",
      );
      replaceMap = mobileActions.getByRole("button", { name: "Replace map or start over" });
    } else {
      await page.setViewportSize({ width: 1024, height: 900 });
      const header = workspace.locator(":scope > .mari-editor-header");
      const headerGeometry = await header.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(headerGeometry.scrollWidth).toBeLessThanOrEqual(headerGeometry.clientWidth + 1);
      expect(headerGeometry.scrollHeight).toBeLessThanOrEqual(headerGeometry.clientHeight + 1);
      const moreActions = workspace.getByRole("button", { name: "More map actions" });
      await expectMinimumInteractiveSize(moreActions, "Desktop map actions control");
      await moreActions.click();
      const desktopActions = workspace.getByRole("region", { name: "Map actions" });
      await expect(desktopActions).toBeVisible();
      await expect(desktopActions.locator("[data-marinara-map-compact-only]:visible")).toHaveCount(0);
      await expect(desktopActions.getByRole("button", { name: "Export world map" })).toBeVisible();
      await expect(desktopActions.getByRole("button", { name: "Import world map" })).toBeVisible();
      await expect(
        desktopActions.getByRole("button", { name: "Open shared worlds and map templates" }),
      ).toBeVisible();
      replaceMap = desktopActions.getByRole("button", { name: "Replace map or start over" });
    }
    await expectMinimumInteractiveSize(replaceMap, "Replace map control");
    await replaceMap.click();
    await expect(workspace).toBeVisible();
    const replacePanel = workspace.getByRole("region", { name: "Replace the current map" });
    await expect(replacePanel).toBeVisible();
    await expect(replacePanel).toContainText("4 locations");
    await expect(replacePanel).toContainText("Recharted Coast");
    await expect(replacePanel.getByRole("button", { name: "Save as template" })).toBeVisible();
    await expect(replacePanel.getByRole("button", { name: "Export backup" })).toBeVisible();
    await expect(replacePanel.getByRole("button", { name: "Create with AI" })).toBeVisible();
    await expect(replacePanel.getByRole("button", { name: "Use template or shared world" })).toBeVisible();
    await expect(replacePanel.getByRole("button", { name: "Import map file" })).toBeVisible();
    const startBlank = replacePanel.getByRole("button", { name: "Start blank" });
    await expectMinimumInteractiveSize(startBlank, "Start blank control");
    await startBlank.click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete this map and start over?" });
    await expect(deleteDialog).toHaveAttribute("data-marinara-maps-confirmation", "true");
    await expect(deleteDialog).toContainText("Are you sure? This is dangerous.");
    await expect(deleteDialog).toContainText("Deleting replaces 4 saved locations");
    await expect(deleteDialog).toContainText("the deleted map cannot be restored unless you exported a backup");
    const cancelDelete = deleteDialog.getByRole("button", { name: "Go back and backup first", exact: true });
    const confirmDelete = deleteDialog.getByRole("button", { name: "Start blank", exact: true });
    await expect(cancelDelete).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirmDelete).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancelDelete).toBeFocused();
    await cancelDelete.click();
    await expect(startBlank).toBeFocused();
    await expect(hierarchy.getByRole("button", { name: "Recharted Coast region" })).toBeVisible();

    await startBlank.click();
    await deleteDialog.getByRole("button", { name: "Start blank", exact: true }).click();
    await expect(page.getByText("Fresh map started in the working copy. Review it, then Save.")).toBeVisible();
    await expect(hierarchy.getByRole("button", { name: "New world region" })).toBeVisible();
    await expect(hierarchy.getByRole("button", { name: "Recharted Coast region" })).toHaveCount(0);

    const beforeDeleteSave = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(
      ((await beforeDeleteSave.json()) as { definition: { locations: Array<{ id: string }> } }).definition.locations.map(
        (location) => location.id,
      ),
    ).toContain("ai_world");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => {
        const resetResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        const reset = (await resetResponse.json()) as {
          hasCommittedSpatialHistory: boolean;
          currentLocationId: string | null;
          definition: {
            startingLocationId: string | null;
            locations: Array<{ id: string; name: string; status: string }>;
          };
        };
        return {
          history: reset.hasCommittedSpatialHistory,
          names: reset.definition.locations.map((location) => location.name),
          removedOldIds: reset.definition.locations.every((location) => !location.id.startsWith("ai_")),
          currentMatchesStart: reset.currentLocationId === reset.definition.startingLocationId,
          statuses: reset.definition.locations.map((location) => location.status),
        };
      })
      .toEqual({
        history: false,
        names: ["New world"],
        removedOldIds: true,
        currentMatchesStart: true,
        statuses: ["active"],
      });
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}?force=true`);
  }
});

test("reciprocal and incoming Direct Links stay visible from either endpoint", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const response = await page.request.post("/api/chats", {
    data: {
      name: `Direct Link Endpoint Parity ${testInfo.project.name}`,
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);

  const definition = {
    ...generatedDefinition,
    enabled: true,
    locations: generatedDefinition.locations.map((location) => {
      if (location.id === "ai_harbor") {
        return {
          ...location,
          links: [
            {
              targetId: "ai_sewers",
              label: "Dock shuttle",
              bidirectional: false,
              state: "available" as const,
            },
          ],
        };
      }
      if (location.id === "ai_lighthouse") {
        return { ...location, parentId: "ai_harbor", placement: undefined, sortOrder: 0 };
      }
      if (location.id === "ai_sewers") {
        return {
          ...location,
          links: [
            {
              targetId: "ai_lighthouse",
              label: "Duplicate tunnel",
              bidirectional: true,
              state: "available" as const,
            },
          ],
        };
      }
      return location;
    }),
  };
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition,
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            spatialMapDetailChatId: chatId,
          },
          version: 75,
        }),
      );
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);
    await expectWorkspaceFillsOverlay(page);

    const workspace = page.locator("[data-marinara-maps-workspace-overlay]");
    const hierarchy = workspace.locator('section[aria-label="Location hierarchy"]:visible');
    await hierarchy.getByRole("button", { name: "Expand Shrouded Coast" }).click();
    await hierarchy.getByRole("button", { name: /^Old Sewers/u }).click();

    const sewersDetails = workspace.locator('section[aria-label="Details for Old Sewers"]:visible');
    const reciprocal = sewersDetails.locator(
      '[data-marinara-direct-link-source="ai_lighthouse"][data-marinara-direct-link-target="ai_sewers"]',
    );
    await expect(reciprocal).toHaveCount(1);
    await expect(reciprocal).toHaveAttribute("data-marinara-direct-link-direction", "both");
    await expect(reciprocal).toHaveAttribute("data-marinara-direct-link-editable", "true");
    await expect(reciprocal).toContainText("Both ways");
    await expect(reciprocal).toContainText("Shrouded Coast > Gloam Harbor > Blackglass Lighthouse");
    await expect(reciprocal.getByLabel("Direction for Blackglass Lighthouse")).toHaveValue("both");

    const incomingOneWay = sewersDetails.locator(
      '[data-marinara-direct-link-source="ai_harbor"][data-marinara-direct-link-target="ai_sewers"]',
    );
    await expect(incomingOneWay).toHaveAttribute("data-marinara-direct-link-direction", "incoming");
    await expect(incomingOneWay).toHaveAttribute("data-marinara-direct-link-editable", "false");
    await expect(incomingOneWay).toContainText("Incoming one-way");
    await expect(incomingOneWay).toContainText("Dock shuttle");
    await expect(incomingOneWay).toContainText("Shrouded Coast > Gloam Harbor");
    await expect(incomingOneWay.getByLabel("Link label for Gloam Harbor")).toHaveCount(0);
    const linkTargetPicker = sewersDetails.locator("select").filter({
      has: page.locator('option[value=""]', { hasText: "Choose location" }),
    });
    await expect(linkTargetPicker.locator('option[value="ai_lighthouse"]')).toHaveCount(0);
    await expect(linkTargetPicker.locator('option[value="ai_harbor"]')).toHaveCount(0);

    await reciprocal.getByLabel("Link label for Blackglass Lighthouse").fill("Target-edited tunnel");
    await reciprocal.getByLabel("Link state for Blackglass Lighthouse").selectOption("available");
    await reciprocal.getByLabel("Direction for Blackglass Lighthouse").selectOption("outgoing");
    const outgoingFromSewers = sewersDetails.locator(
      '[data-marinara-direct-link-source="ai_sewers"][data-marinara-direct-link-target="ai_lighthouse"]',
    );
    await expect(outgoingFromSewers).toHaveAttribute("data-marinara-direct-link-direction", "outgoing");
    await outgoingFromSewers.getByRole("button", { name: "View linked location Blackglass Lighthouse" }).click();
    const lighthouseDetails = workspace.locator('section[aria-label="Details for Blackglass Lighthouse"]:visible');
    const incomingAtLighthouse = lighthouseDetails.locator(
      '[data-marinara-direct-link-source="ai_sewers"][data-marinara-direct-link-target="ai_lighthouse"]',
    );
    await expect(incomingAtLighthouse).toHaveAttribute("data-marinara-direct-link-direction", "incoming");
    await expect(incomingAtLighthouse).toHaveAttribute("data-marinara-direct-link-editable", "false");
    await incomingAtLighthouse.getByRole("button", { name: "View source Old Sewers" }).click();

    await outgoingFromSewers.getByLabel("Direction for Blackglass Lighthouse").selectOption("both");
    await expect(outgoingFromSewers).toHaveAttribute("data-marinara-direct-link-direction", "both");
    await outgoingFromSewers.getByRole("button", { name: "View linked location Blackglass Lighthouse" }).click();
    const bothAtLighthouse = lighthouseDetails.locator(
      '[data-marinara-direct-link-source="ai_sewers"][data-marinara-direct-link-target="ai_lighthouse"]',
    );
    await expect(bothAtLighthouse).toHaveAttribute("data-marinara-direct-link-direction", "both");
    await bothAtLighthouse.getByLabel("Direction for Old Sewers").selectOption("outgoing");
    const outgoingFromLighthouse = lighthouseDetails.locator(
      '[data-marinara-direct-link-source="ai_lighthouse"][data-marinara-direct-link-target="ai_sewers"]',
    );
    await expect(outgoingFromLighthouse).toHaveAttribute("data-marinara-direct-link-direction", "outgoing");
    await expect(outgoingFromLighthouse.getByLabel("Link label for Old Sewers")).toHaveValue(
      "Target-edited tunnel",
    );
    await outgoingFromLighthouse.getByLabel("Direction for Old Sewers").selectOption("both");
    await outgoingFromLighthouse.getByRole("button", { name: "View linked location Old Sewers" }).click();
    const bothAtSewers = sewersDetails.locator(
      '[data-marinara-direct-link-source="ai_lighthouse"][data-marinara-direct-link-target="ai_sewers"]',
    );
    await expect(bothAtSewers).toHaveAttribute("data-marinara-direct-link-direction", "both");
    await bothAtSewers.getByLabel("Direction for Blackglass Lighthouse").selectOption("incoming");
    await expect(bothAtSewers).toHaveAttribute("data-marinara-direct-link-direction", "incoming");
    await expect(bothAtSewers).toHaveAttribute("data-marinara-direct-link-editable", "false");

    await workspace.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => {
        const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        const stored = (await storedResponse.json()) as {
          definition: {
            locations: Array<{
              id: string;
              links: Array<{ targetId: string; label?: string; bidirectional: boolean; state: string }>;
            }>;
          };
        };
        return stored.definition.locations.flatMap((location) =>
          location.links
            .filter(
              (link) =>
                (location.id === "ai_lighthouse" && link.targetId === "ai_sewers") ||
                (location.id === "ai_sewers" && link.targetId === "ai_lighthouse"),
            )
            .map((link) => ({ sourceId: location.id, ...link })),
        );
      })
      .toEqual([
        {
          sourceId: "ai_lighthouse",
          targetId: "ai_sewers",
          label: "Target-edited tunnel",
          bidirectional: false,
          state: "available",
        },
      ]);

    await bothAtSewers.getByRole("button", { name: "View source Blackglass Lighthouse" }).click();
    await outgoingFromLighthouse
      .getByRole("button", { name: "Remove Direct Link with Old Sewers" })
      .click();
    await workspace.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => {
        const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        const stored = (await storedResponse.json()) as {
          definition: { locations: Array<{ id: string; links: Array<{ targetId: string }> }> };
        };
        return stored.definition.locations.flatMap((location) =>
          location.links.filter(
            (link) =>
              (location.id === "ai_lighthouse" && link.targetId === "ai_sewers") ||
              (location.id === "ai_sewers" && link.targetId === "ai_lighthouse"),
          ),
        ).length;
      })
      .toBe(0);
    const hierarchyPaneButton = workspace.getByRole("button", { name: "hierarchy", exact: true });
    if (await hierarchyPaneButton.isVisible()) await hierarchyPaneButton.click();
    await hierarchy.getByRole("button", { name: /^Old Sewers/u }).click();
    await expect(bothAtSewers).toHaveCount(0);
    await expect(incomingOneWay).toBeVisible();
    await expect(linkTargetPicker.locator('option[value="ai_lighthouse"]')).toHaveCount(1);
    await expect(linkTargetPicker.locator('option[value="ai_harbor"]')).toHaveCount(0);

    await incomingOneWay.getByRole("button", { name: "View source Gloam Harbor" }).click();
    const harborDetails = workspace.locator('section[aria-label="Details for Gloam Harbor"]:visible');
    const outgoing = harborDetails.locator(
      '[data-marinara-direct-link-source="ai_harbor"][data-marinara-direct-link-target="ai_sewers"]',
    );
    await expect(outgoing).toHaveAttribute("data-marinara-direct-link-direction", "outgoing");
    await expect(outgoing).toHaveAttribute("data-marinara-direct-link-editable", "true");
    await expect(outgoing).toContainText("Outgoing one-way");
    await expect(outgoing.getByLabel("Link label for Old Sewers")).toHaveValue("Dock shuttle");
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}?force=true`);
  }
});

test("Roleplay minimap keeps selected locations opaque over map artwork", async ({ page }) => {
  const response = await page.request.post("/api/chats", {
    data: {
      name: "Opaque Map Selection Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const artworkUpload = await page.request.post(`/api/gallery/${chat.id}/upload`, {
    multipart: {
      prompt: "A fogbound anime coast.",
      provider: "world-map-e2e",
      model: "fixture",
      width: "1",
      height: "1",
      file: {
        name: "shrouded-coast.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2SIAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  expect(artworkUpload.ok(), await artworkUpload.text()).toBeTruthy();
  const uploadedArtwork = (await artworkUpload.json()) as { id: string };
  const definitionWithArtwork = {
    ...generatedDefinition,
    enabled: true,
    locations: generatedDefinition.locations.map((location) =>
      location.id === "ai_world" ? { ...location, mapBackgroundImageId: uploadedArtwork.id } : location,
    ),
  };
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: definitionWithArtwork,
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();

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
    await storyLocation.getByRole("button", { name: "Open story map" }).click();
    const roleplayMap = storyLocation.getByRole("region", { name: "Hierarchical world map" });
    await expect(roleplayMap.locator('img[aria-hidden="true"]')).toBeVisible();
    const selectedMiniMapLocation = roleplayMap.getByRole("button", { name: /Inspect Blackglass Lighthouse/ });
    await selectedMiniMapLocation.click();
    await expect(selectedMiniMapLocation).toHaveAttribute("aria-pressed", "true");
    const selectedMiniMapMarker = selectedMiniMapLocation.locator('[data-marinara-map-selected-location="true"]');
    await expect(selectedMiniMapMarker).toBeVisible();
    await expect
      .poll(
        () => computedBackgroundAlpha(selectedMiniMapMarker),
        { message: "Selected minimap location should remain opaque over map artwork" },
      )
      .toBe(1);
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}?force=true`);
  }
});

test("installed World Maps package keeps the editor canvas visible at 16:9", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The package CSS is shared across viewports.");
  test.setTimeout(120_000);
  const response = await page.request.post("/api/chats", {
    data: {
      name: "World Map Canvas Geometry",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);

  const artworkUpload = await page.request.post(`/api/gallery/${chat.id}/upload`, {
    multipart: {
      prompt: "A fogbound anime harbor.",
      provider: "world-map-e2e",
      model: "fixture",
      width: "1",
      height: "1",
      file: {
        name: "gloam-harbor.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2SIAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  expect(artworkUpload.ok(), await artworkUpload.text()).toBeTruthy();
  const uploadedArtwork = (await artworkUpload.json()) as { id: string };
  const definition = {
    ...generatedDefinition,
    locations: generatedDefinition.locations.map((location) => {
      if (location.id === "ai_harbor") {
        return {
          ...location,
          childPresentation: "map" as const,
          mapBackgroundImageId: uploadedArtwork.id,
        };
      }
      if (location.id === "ai_lighthouse") {
        return { ...location, parentId: "ai_harbor", sortOrder: 0 };
      }
      return location;
    }),
  };
  const initialSave = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: { ...definition, enabled: true },
    },
  });
  expect(initialSave.ok(), await initialSave.text()).toBeTruthy();

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.route("**/api/backgrounds/file/Black.jpg", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/");
    await dismissOnboardingTutorial(page);
    await page.locator('[data-tour="panel-agents"]').click();
    const agentsPanel = page.locator('[data-component="RightPanelDesktop"]');
    await agentsPanel
      .locator('[data-agent-name="World Maps"]')
      .getByText("World Maps", { exact: true })
      .click();
    const home = page.locator("[data-marinara-maps-home]");
    await expect(home).toBeVisible();
    await home.getByRole("button", { name: "Edit map", exact: true }).click();

    const locationHierarchy = page.getByRole("region", { name: "Location hierarchy" });
    await locationHierarchy.getByRole("button", { name: "Expand Shrouded Coast" }).click();
    await locationHierarchy.getByRole("button", { name: "Enter Shrouded Coast" }).click();
    await locationHierarchy.getByRole("button", { name: "Enter Gloam Harbor" }).click();
    await page.getByRole("button", { name: "Arrange map" }).click();

    const canvas = page.locator('[data-marinara-maps-editor-canvas][data-layout-editing="true"]:visible');
    const background = canvas.locator('img[aria-hidden="true"]');
    await expect(background).toBeVisible();
    await expect.poll(() => background.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.height).toBeGreaterThan(100);
    expect(canvasBox!.width / canvasBox!.height).toBeCloseTo(16 / 9, 1);
  } finally {
    await page.close();
    const deleteResponse = await request.delete(`/api/chats/${chat.id}?force=true`);
    expect(deleteResponse.ok(), await deleteResponse.text()).toBeTruthy();
  }
});

test("AI map expansion preserves a campaign map and its current location", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
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
  const hierarchyPickerDefinition = {
    ...generatedDefinition,
    locations: generatedDefinition.locations.map((location) => {
      if (location.id === "ai_harbor") return { ...location, childPresentation: "map" as const };
      if (location.id === "ai_lighthouse") return { ...location, parentId: "ai_harbor", sortOrder: 0 };
      if (location.id === "ai_sewers") return { ...location, parentId: "ai_lighthouse", sortOrder: 0 };
      return location;
    }),
  };

  const artworkUpload = await page.request.post(`/api/gallery/${chat.id}/upload`, {
    multipart: {
      prompt: "A fogbound anime harbor.",
      provider: "world-map-e2e",
      model: "fixture",
      width: "1",
      height: "1",
      file: {
        name: "gloam-harbor.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2SIAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  expect(artworkUpload.ok(), await artworkUpload.text()).toBeTruthy();
  const uploadedArtwork = (await artworkUpload.json()) as { id: string };
  const definitionWithArtwork = {
    ...hierarchyPickerDefinition,
    locations: hierarchyPickerDefinition.locations.map((location) =>
      location.id === "ai_harbor"
        ? {
            ...location,
            referenceImageId: uploadedArtwork.id,
            useReferenceImage: true,
            mapBackgroundImageId: uploadedArtwork.id,
          }
        : location,
    ),
  };

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
      definition: { ...definitionWithArtwork, enabled: true },
    },
  });
  expect(initialSave.ok()).toBeTruthy();
  expect(((await initialSave.json()) as { hasCommittedSpatialHistory: boolean }).hasCommittedSpatialHistory).toBe(true);

  await page.route(`**/api/chats/${chat.id}/spatial-context/generate`, async (route) => {
    const request = route.request().postDataJSON() as {
      operation: string;
      targetLocationId?: string;
      size: string;
      targetLocationCount?: number;
      instructions?: string;
      debugMode: boolean;
      breakHistoryContinuity?: boolean;
    };
    if (request.operation === "replace") {
      expect(request.targetLocationId).toBeUndefined();
      expect(request.breakHistoryContinuity).toBe(true);
      expect(request.size).toBe("small");
      expect(request.targetLocationCount).toBe(10);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          operation: "replace",
          size: "small",
          source: "roleplay_setup",
          generatedLocationCount: 1,
          definition: {
            ...generatedDefinition,
            startingLocationId: "fresh_world",
            locations: [
              {
                ...generatedDefinition.locations[0],
                id: "fresh_world",
                name: "Fresh world",
                parentId: null,
                kind: "region",
                links: [],
              },
            ],
          },
        }),
      });
      return;
    }
    expect(request).toMatchObject({
      operation: "expand",
      targetLocationId: "ai_harbor",
      size: "small",
      targetLocationCount: 8,
      instructions: "Add a riverside ward with an inn for ferrymen.",
      debugMode: false,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        operation: "expand",
        targetLocationId: "ai_harbor",
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
      const { agentEntry } = await openHierarchicalMapsAgentControls(page);
      await agentEntry.getByRole("button", { name: "Set up world map" }).click();
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
    const exportMap = page.getByRole("button", { name: "Export world map" });
    const importMap = page.getByRole("button", { name: "Import world map" });
    await expect(exportMap.locator("svg")).toHaveClass(/lucide-upload/);
    await expect(importMap.locator("svg")).toHaveClass(/lucide-download/);
    if (!mobile) {
      const displayedMapArtwork = page.locator("[data-marinara-maps-editor-canvas] > img");
      await expect(displayedMapArtwork).toBeVisible();
      await exportMap.click();
      const exportDialog = page.getByRole("dialog", { name: "Export portable world map" });
      await expect(exportDialog).toHaveCSS("z-index", "105");
      expect(
        await exportDialog.evaluate((dialog) => {
          const rect = dialog.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return hit === dialog || Boolean(hit && dialog.contains(hit));
        }),
        "The export dialog must own the interaction layer above displayed map artwork",
      ).toBe(true);
      await expect(exportDialog.getByRole("checkbox", { name: "Include map artwork" })).toBeChecked();
      await expect(exportDialog.getByRole("radio", { name: /Map \+ linked entries/u })).toBeChecked();
      const downloadPromise = page.waitForEvent("download");
      await exportDialog.getByRole("button", { name: "Download export" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.world-map\.json$/u);
      const downloadPath = await download.path();
      expect(downloadPath).not.toBeNull();
      const exportedMapText = await readFile(downloadPath!, "utf8");
      const exportedMap = JSON.parse(exportedMapText) as {
        format: string;
        formatVersion: number;
        portableLore: { schemaVersion: number; mode: string };
        artwork: Array<{ sourceImageId: string; filename: string; data: string }>;
      };
      expect(exportedMap).toMatchObject({
        format: "marinara-hierarchical-map",
        formatVersion: 4,
        portableLore: { schemaVersion: 1, mode: "linked-entries" },
      });
      expect(exportedMap.artwork).toHaveLength(1);
      expect(exportedMap.artwork[0]).toMatchObject({
        sourceImageId: uploadedArtwork.id,
        filename: expect.stringMatching(/\.png$/u),
        data: expect.stringMatching(/^data:image\/png;base64,/u),
      });
      await page.locator("[data-marinara-map-import-input]").setInputFiles({
        name: download.suggestedFilename(),
        mimeType: "application/json",
        buffer: Buffer.from(exportedMapText),
      });
      await expect(page.getByText("1 artwork file was restored to this chat's Gallery.")).toBeVisible();
      await expect
        .poll(async () => {
          const galleryResponse = await page.request.get(`/api/gallery/${chat.id}`);
          const images = (await galleryResponse.json()) as Array<{ id: string }>;
          return images.map((image) => image.id);
        })
        .toEqual(expect.arrayContaining([uploadedArtwork.id]));
      await expect
        .poll(async () => {
          const galleryResponse = await page.request.get(`/api/gallery/${chat.id}`);
          const images = (await galleryResponse.json()) as Array<{ id: string }>;
          return images.length;
        })
        .toBe(2);
    }
    await page.locator("[data-marinara-map-import-input]").setInputFiles({
      name: "replacement-with-missing-ids.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "marinara-hierarchical-map",
          formatVersion: 2,
          definition: { ...generatedDefinition, locations: [generatedDefinition.locations[0]] },
        }),
      ),
    });
    const importRepair = page.getByRole("alert", { name: "Import location ID repair guidance" });
    await expect(importRepair).toContainText("Import blocked: 3 saved location IDs are missing");
    await expect(importRepair).toContainText("Gloam Harbor · ai_harbor");
    await expect(importRepair).toContainText("Blackglass Lighthouse · ai_lighthouse");
    await expect(importRepair).toContainText("Old Sewers · ai_sewers");
    await expect(importRepair).toContainText("Export this map as a baseline");
    await importRepair.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("button", { name: "Location types" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Location type fields" })).toHaveCount(0);
    await page.getByRole("button", { name: "Expand Shrouded Coast" }).click();
    const locationHierarchy = page.getByRole("region", { name: "Location hierarchy" });
    await locationHierarchy.getByRole("button", { name: /^Blackglass Lighthouse/ }).click();
    await page.getByLabel("Line style for Old Sewers").selectOption("dotted");
    await page.getByLabel("Line color for Old Sewers").fill("#22c55e");
    await page.getByLabel("Link state").selectOption("available");
    await locationHierarchy.getByRole("button", { name: "Enter Shrouded Coast" }).click();
    const editorConnection = page.locator(
      'line[data-marinara-map-connection="ai_lighthouse|ai_sewers"]',
    );
    await expect(editorConnection).toHaveCount(1);
    await expect(editorConnection).toHaveAttribute("data-line-style", "dotted");
    await expect(editorConnection).toHaveAttribute("stroke", "#22C55E");
    await expect(editorConnection).toHaveAttribute("stroke-dasharray", "1 5");
    const editorConnectionToggle = page.getByRole("button", { name: "Hide connections" });
    await expectMinimumInteractiveSize(editorConnectionToggle, "Map editor connection visibility control");
    await editorConnectionToggle.click();
    await expect(editorConnection).toHaveCount(0);
    await page.getByRole("button", { name: "Show connections" }).click();
    await expect(editorConnection).toHaveCount(1);
    await page.getByRole("button", { name: "Enter Gloam Harbor" }).click();
    await expect(page.getByRole("heading", { name: "Gloam Harbor", exact: true })).toBeVisible();
    if (mobile) {
      await expect(page.getByRole("button", { name: "local", exact: true })).toHaveAttribute("aria-pressed", "true");
    }
    await expectAuthoringWorkspaceLayout(page, mobile);

    const arrangeMap = page.getByRole("button", { name: "Arrange map" });
    await expect(arrangeMap).toBeVisible();
    await arrangeMap.click();
    const arrangedCanvas = page.locator('[data-layout-editing="true"]:visible').first();
    const lighthouseNode = arrangedCanvas.getByRole("button", { name: /Blackglass Lighthouse/ });
    const [canvasBox, nodeBox] = await Promise.all([arrangedCanvas.boundingBox(), lighthouseNode.boundingBox()]);
    expect(canvasBox).not.toBeNull();
    expect(nodeBox).not.toBeNull();
    expect(canvasBox!.height).toBeGreaterThan(100);
    expect(canvasBox!.width / canvasBox!.height).toBeCloseTo(16 / 9, 1);
    const unselectedBorderColor = await lighthouseNode.evaluate((element) => getComputedStyle(element).borderColor);
    await lighthouseNode.focus();
    await lighthouseNode.click();
    await expect(page.locator("[data-marinara-maps-workspace-root]")).toBeVisible();
    await expect(lighthouseNode).toHaveAttribute("data-marinara-map-selected-location", "true");
    await expect
      .poll(async () =>
        lighthouseNode.evaluate((element) => {
          const canvas = document.createElement("canvas");
          canvas.width = 1;
          canvas.height = 1;
          const context = canvas.getContext("2d");
          if (!context) return 0;
          context.fillStyle = getComputedStyle(element).backgroundColor;
          context.fillRect(0, 0, 1, 1);
          return context.getImageData(0, 0, 1, 1).data[3];
        }),
      )
      .toBe(255);
    const selectedBorderColor = await lighthouseNode.evaluate((element) => getComputedStyle(element).borderColor);
    expect(selectedBorderColor).not.toBe(unselectedBorderColor);
    await page.mouse.move(nodeBox!.x + nodeBox!.width / 2, nodeBox!.y + nodeBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.6, canvasBox!.y + canvasBox!.height * 0.4);
    await page.mouse.up();
    await page.keyboard.press("Shift+ArrowRight");
    await expect(page.getByText("Unsaved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Done arranging" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => {
        const response = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        const payload = (await response.json()) as {
          definition: { locations: Array<{ id: string; placement?: { x: number; y: number } }> };
        };
        return payload.definition.locations.find((location) => location.id === "ai_lighthouse")?.placement?.x;
      })
      .toBe(65);

    if (mobile) await page.getByRole("button", { name: "hierarchy", exact: true }).click();
    await page.getByRole("button", { name: "Enter Gloam Harbor" }).click();
    await page.getByRole("button", { name: "Expand with AI" }).click();
    await expect(page.getByRole("heading", { name: "Expand the map with AI" })).toBeVisible();
    await expectAiBuilderLayout(page, mobile);
    await expect(page.getByText(/Campaign history is protected/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Replace draft/ })).toHaveCount(0);
    await expect(page.getByText("Adding beneath", { exact: true })).toBeVisible();
    await expect(page.getByText("Gloam Harbor", { exact: true })).toBeVisible();
    const advancedOptions = page.getByRole("button", { name: "Advanced options", exact: true });
    await expect(advancedOptions).toHaveAttribute("aria-expanded", "false");
    await expectMinimumInteractiveSize(advancedOptions, "AI expansion advanced options control");
    await expect(page.getByLabel("Expand beneath")).toHaveCount(0);
    await advancedOptions.click();
    const expandTarget = page.getByLabel("Expand beneath");
    await expect(expandTarget).toBeVisible();
    await expect(expandTarget).toHaveValue("ai_harbor");
    expect(await expandTarget.locator("option").allTextContents()).toEqual([
      "Shrouded Coast",
      "\u00a0\u00a0└─ Gloam Harbor",
      "\u00a0\u00a0\u00a0\u00a0└─ Blackglass Lighthouse",
      "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0└─ Old Sewers",
    ]);
    await page.getByLabel("What should be added?").fill("Add a riverside ward with an inn for ferrymen.");
    await page.getByRole("button", { name: /Small About 8 places/ }).click();
    await page.getByRole("button", { name: "Generate expansion" }).click();
    await expect(page.getByText("Validated", { exact: true })).toBeVisible();
    await expect(page.getByText("2 new locations · 2 levels · not applied", { exact: true })).toBeVisible();
    const expansionHierarchy = page.getByRole("region", { name: "Generated location hierarchy" });
    await expect(expansionHierarchy.getByRole("button", { name: /^Riverside Ward/ })).toBeVisible();
    await expect(expansionHierarchy.getByRole("button", { name: /^Silver Minnow Inn/ })).toBeVisible();

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

    const replaceMap = page.getByRole("button", { name: "Replace map or start over" });
    await expectMinimumInteractiveSize(replaceMap, "History-safe replace map control");
    await replaceMap.click();
    const replacePanel = page.getByRole("region", { name: "Replace the current map" });
    await expect(replacePanel).toContainText("6 locations");
    await replacePanel.getByRole("button", { name: "Create with AI" }).click();
    const aiStartOverDialog = page.getByRole("dialog", {
      name: "Break breadcrumb continuity and start a new map?",
    });
    await expect(aiStartOverDialog).toContainText("Old messages will remain");
    await expect(aiStartOverDialog).toContainText("historical map links may no longer resolve");
    await aiStartOverDialog.getByRole("button", { name: "Start new map", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Replace the map draft with AI" })).toBeVisible();
    await expect(page.getByLabel("Expand beneath")).toHaveCount(0);
    await expect(page.getByLabel("Custom place target")).toHaveValue("16");
    await expect(page.getByText("AI action", { exact: true })).toHaveCount(0);
    await page.getByLabel("What should this world include?").fill("A fresh map after the old campaign.");
    await page.getByRole("button", { name: /Small About 8 places/ }).click();
    await page.getByLabel("Custom place target").fill("10");
    await page.getByRole("button", { name: "Generate draft" }).click();
    await expect(page.getByText("Validated", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Discard draft", exact: true }).click();
    await expect(page.getByRole("heading", { name: "World map" })).toBeVisible();
    if (mobile) await page.getByRole("button", { name: "More map actions" }).click();
    await page.getByRole("button", { name: "Replace map or start over" }).click();
    const startBlank = replacePanel.getByRole("button", { name: "Start blank" });
    await startBlank.click();
    const protectedDeleteDialog = page.getByRole("dialog", {
      name: "Break breadcrumb continuity and start a new map?",
    });
    await expect(protectedDeleteDialog).toHaveAttribute("data-marinara-maps-confirmation", "true");
    await expect(protectedDeleteDialog).toContainText("Are you sure? This is dangerous.");
    await expect(protectedDeleteDialog).toContainText("Starting over breaks breadcrumb continuity");
    await expect(protectedDeleteDialog).toContainText("Old messages remain");
    await expect(protectedDeleteDialog).toContainText("historical map links may no longer resolve");
    await protectedDeleteDialog.getByRole("button", { name: "Start blank", exact: true }).click();
    await expect(
      page.getByText(
        "Fresh map started. Old messages remain, but previous map locations will not resolve after Save. Review it, then Save.",
      ),
    ).toBeVisible();
    const hierarchy = page.locator('section[aria-label="Location hierarchy"]:visible');
    await expect(hierarchy.getByRole("button", { name: "New world region" })).toBeVisible();
    await expect(hierarchy).not.toContainText("Shrouded Coast");
    await expect(hierarchy).not.toContainText("archived");

    const beforeProtectedSave = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(((await beforeProtectedSave.json()) as { definition: { locations: Array<{ status: string }> } }).definition.locations).toHaveLength(6);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => {
        const resetResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
        const reset = (await resetResponse.json()) as {
          hasCommittedSpatialHistory: boolean;
          currentLocationId: string | null;
          definition: {
            startingLocationId: string | null;
            locations: Array<{ id: string; name: string; status: string }>;
          };
        };
        const oldLocations = reset.definition.locations.filter((location) => location.id.startsWith("ai_"));
        const activeLocations = reset.definition.locations.filter((location) => location.status === "active");
        return {
          history: reset.hasCommittedSpatialHistory,
          oldIds: oldLocations.map((location) => location.id),
          archivedOldCount: oldLocations.filter((location) => location.status === "archived").length,
          activeNames: activeLocations.map((location) => location.name),
          currentMatchesStart: reset.currentLocationId === reset.definition.startingLocationId,
        };
      })
      .toEqual({
        history: true,
        oldIds: [],
        archivedOldCount: 0,
        activeNames: ["New world"],
        currentMatchesStart: true,
      });

    if (mobile) {
      await page.getByRole("button", { name: "Back to chat" }).click();
      const mobileMusicLayer = page.locator('[data-component="MobileMusicWidgetLayer"]');
      await expect(mobileMusicLayer.locator(".fixed")).toBeVisible();
    }
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}?force=true`);
  }
});

test("Game setup stages a saved map template as a Game-owned working copy", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The setup template handoff is shared across viewports.");
  test.setTimeout(120_000);
  const { chat, template } = await openGameSetupMapDraftReview(page, testInfo, "template");

  try {
    await expect(page.getByRole("region", { name: "First map setup" })).toContainText(
      "4 locations · 2 levels · Working draft, not saved",
    );
    const beforeSaveResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(beforeSaveResponse.ok(), await beforeSaveResponse.text()).toBeTruthy();
    expect(((await beforeSaveResponse.json()) as { definition: unknown }).definition).toBeNull();

    await expect(page.getByRole("button", { name: "Enable and save map", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Enable and save map", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    const stored = (await storedResponse.json()) as {
      definition: { ownerMode: string; enabled: boolean; locations: Array<{ id: string }> };
    };
    expect(stored.definition.ownerMode).toBe("game");
    expect(stored.definition.enabled).toBe(true);
    expect(stored.definition.locations.map((location) => location.id)).toEqual(
      gameGeneratedDefinition.locations.map((location) => location.id),
    );

    const beforeStartChatResponse = await page.request.get(`/api/chats/${chat.id}`);
    expect(beforeStartChatResponse.ok(), await beforeStartChatResponse.text()).toBeTruthy();
    const beforeStartChat = (await beforeStartChatResponse.json()) as { metadata: unknown };
    const beforeStartMetadata =
      typeof beforeStartChat.metadata === "string"
        ? (JSON.parse(beforeStartChat.metadata) as Record<string, unknown>)
        : (beforeStartChat.metadata as Record<string, unknown>);
    expect((beforeStartMetadata.gameInitialMapFallback as { id?: string } | null)?.id).toBe(
      acceptedGameSetupMap.id,
    );

    const startResponse = await page.request.post("/api/game/start", { data: { chatId: chat.id } });
    expect(startResponse.ok(), await startResponse.text()).toBeTruthy();
    const startedChatResponse = await page.request.get(`/api/chats/${chat.id}`);
    expect(startedChatResponse.ok(), await startedChatResponse.text()).toBeTruthy();
    const startedChat = (await startedChatResponse.json()) as { metadata: unknown };
    const startedMetadata =
      typeof startedChat.metadata === "string"
        ? (JSON.parse(startedChat.metadata) as Record<string, unknown>)
        : (startedChat.metadata as Record<string, unknown>);
    expect(startedMetadata.gameInitialMapFallback).toBeNull();
    expect(startedMetadata.gameMap).toBeNull();
    expect(startedMetadata.gameMaps).toEqual([]);
    expect(startedMetadata.activeGameMapId).toBeNull();
    expect((startedMetadata.gameSetupConfig as { gameWorldMapMode?: string }).gameWorldMapMode).toBe(
      "hierarchical",
    );
  } finally {
    if (template) {
      const deleteTemplateResponse = await page.request.delete(
        `/api/chats/spatial-context/templates/${template.id}`,
        { data: { expectedRevision: template.revision } },
      );
      expect(deleteTemplateResponse.ok(), await deleteTemplateResponse.text()).toBeTruthy();
    }
    await expectDeleted(page, `/api/chats/${chat.id}?force=true`);
  }
});

test("Game setup links a selected shared world before Start without changing its canonical record", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The shared-world setup handoff is shared across viewports.");
  test.setTimeout(120_000);
  const { chat, sharedWorld } = await openGameSetupMapDraftReview(page, testInfo, "shared-world");

  try {
    const linkedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(linkedResponse.ok(), await linkedResponse.text()).toBeTruthy();
    const linked = (await linkedResponse.json()) as {
      currentLocationId: string | null;
      sharedWorld: { mode: string; worldId: string | null; worldRevision: number | null };
    };
    expect(linked.currentLocationId).toBe(gameGeneratedDefinition.startingLocationId);
    expect(linked.sharedWorld).toMatchObject({
      mode: "linked",
      worldId: sharedWorld!.id,
      worldRevision: sharedWorld!.revision,
    });

    const canonicalResponse = await page.request.get("/api/chats/spatial-context/shared-worlds");
    expect(canonicalResponse.ok(), await canonicalResponse.text()).toBeTruthy();
    const canonical = ((await canonicalResponse.json()) as Array<NonNullable<typeof sharedWorld>>).find(
      (world) => world.id === sharedWorld!.id,
    );
    expect(canonical?.revision).toBe(sharedWorld!.revision);
    expect(canonical?.data).toEqual(sharedWorld!.data);

    const startResponse = await page.request.post("/api/game/start", { data: { chatId: chat.id } });
    expect(startResponse.ok(), await startResponse.text()).toBeTruthy();
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}?force=true`);
    if (sharedWorld) {
      const deleteSharedWorldResponse = await page.request.delete(
        `/api/chats/spatial-context/shared-worlds/${sharedWorld.id}`,
        { data: { expectedRevision: sharedWorld.revision } },
      );
      expect(deleteSharedWorldResponse.ok(), await deleteSharedWorldResponse.text()).toBeTruthy();
    }
  }
});

test("Game setup stages an optional hierarchical draft as the sole world map before Start", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { chat } = await openGameSetupMapDraftReview(page, testInfo);

  try {
    const beforeApply = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(beforeApply.ok()).toBeTruthy();
    expect(((await beforeApply.json()) as { definition: unknown }).definition).toBeNull();

    await page.getByRole("button", { name: "Continue to editor" }).click();
    await expect(page.getByText("AI map draft applied. Review it, choose a start, then enable and save.")).toBeVisible();

    const mobile = testInfo.project.name.includes("mobile");
    await expectAuthoringWorkspaceLayout(page, mobile);
    await expect(page.getByRole("region", { name: "First map setup" }).getByLabel("Starting location")).toHaveValue(
      "ai_world",
    );
    await expect(page.getByRole("button", { name: "Collapse Shrouded Coast" })).toBeVisible();
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

    await page.getByRole("button", { name: "Enable and save map", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page.getByText("Map ready · 4 locations · Starting at Shrouded Coast", { exact: true })).toBeVisible();

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

    const boundChatResponse = await page.request.get(`/api/chats/${chat.id}`);
    expect(boundChatResponse.ok()).toBeTruthy();
    const boundChat = (await boundChatResponse.json()) as { metadata: unknown };
    type StagedGameMap = {
      id: string;
      spatialLocationId?: string;
      nodes: Array<{ id: string; spatialLocationId?: string }>;
    };
    const stagedMetadata =
      typeof boundChat.metadata === "string"
        ? (JSON.parse(boundChat.metadata) as {
            gameMap: null;
            gameMaps: StagedGameMap[];
            activeGameMapId: null;
            gameInitialMapFallback: StagedGameMap;
          })
        : (boundChat.metadata as {
            gameMap: null;
            gameMaps: StagedGameMap[];
            activeGameMapId: null;
            gameInitialMapFallback: StagedGameMap;
          });
    expect(stagedMetadata.gameMap).toBeNull();
    expect(stagedMetadata.gameMaps).toEqual([]);
    expect(stagedMetadata.activeGameMapId).toBeNull();
    expect(stagedMetadata.gameInitialMapFallback.id).toBe(acceptedGameSetupMap.id);
    expect(stagedMetadata.gameInitialMapFallback.spatialLocationId).toBeUndefined();
    expect(
      Object.fromEntries(stagedMetadata.gameInitialMapFallback.nodes.map((node) => [node.id, node.spatialLocationId])),
    ).toEqual({
      "gloam-harbor": undefined,
      "blackglass-lighthouse": undefined,
      "old-sewers": "existing-old-sewers-binding",
    });

    const startResponse = await page.request.post("/api/game/start", { data: { chatId: chat.id } });
    expect(startResponse.ok(), await startResponse.text()).toBeTruthy();
    expect((await startResponse.json()) as { status: string }).toMatchObject({ status: "active" });

    const startedChatResponse = await page.request.get(`/api/chats/${chat.id}`);
    expect(startedChatResponse.ok()).toBeTruthy();
    const startedChat = (await startedChatResponse.json()) as { metadata: unknown };
    const startedMetadata =
      typeof startedChat.metadata === "string"
        ? (JSON.parse(startedChat.metadata) as Record<string, unknown>)
        : (startedChat.metadata as Record<string, unknown>);
    expect(startedMetadata.gameInitialMapFallback).toBeNull();
    expect(startedMetadata.gameMap).toBeNull();
    expect(startedMetadata.gameMaps).toEqual([]);
    expect(startedMetadata.activeGameMapId).toBeNull();
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}?force=true`);
  }
});

test("Game hierarchy drafting refuses to truncate an accepted local map", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The server-side size guard needs one project.");
  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Oversized accepted Game map",
      mode: "game",
      characterIds: [],
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await activateHierarchicalMaps(page, chat.id);
  const nodes = Array.from({ length: 51 }, (_, index) => ({
    id: `location-${index + 1}`,
    emoji: "📍",
    label: `Location ${index + 1}`,
    x: 50,
    y: 50,
    discovered: true,
  }));

  try {
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameMap: {
          id: "oversized-map",
          type: "node",
          name: "Oversized Map",
          description: "A map that cannot fit in one bounded hierarchy draft.",
          nodes,
          edges: [],
          partyPosition: nodes[0]!.id,
        },
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();

    const generationResponse = await page.request.post(`/api/chats/${chat.id}/spatial-context/generate`, {
      data: {
        operation: "create",
        size: "large",
        debugMode: false,
      },
    });
    expect(generationResponse.status()).toBe(409);
    expect((await generationResponse.json()) as { code: string }).toMatchObject({
      code: "spatial_ai_game_map_reference_too_large",
    });
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Game setup can skip a generated map without persisting it", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { chat } = await openGameSetupMapDraftReview(page, testInfo);

  try {
    await page.getByRole("button", { name: "Skip map" }).click();
    await expect(page.getByRole("heading", { name: "Draft the map with AI" })).toHaveCount(0);

    const storedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(storedResponse.ok()).toBeTruthy();
    expect(((await storedResponse.json()) as { definition: unknown }).definition).toBeNull();

    const startResponse = await page.request.post("/api/game/start", { data: { chatId: chat.id } });
    expect(startResponse.ok(), await startResponse.text()).toBeTruthy();
    const startedChatResponse = await page.request.get(`/api/chats/${chat.id}`);
    expect(startedChatResponse.ok()).toBeTruthy();
    const startedChat = (await startedChatResponse.json()) as { metadata: unknown };
    const startedMetadata =
      typeof startedChat.metadata === "string"
        ? (JSON.parse(startedChat.metadata) as Record<string, unknown>)
        : (startedChat.metadata as Record<string, unknown>);
    expect(startedMetadata.gameInitialMapFallback).toBeNull();
    expect(startedMetadata.activeGameMapId).toBe(acceptedGameSetupMap.id);
    expect((startedMetadata.gameMap as { id?: string } | null)?.id).toBe(acceptedGameSetupMap.id);
    expect((startedMetadata.gameSetupConfig as { gameWorldMapMode?: string }).gameWorldMapMode).toBe("standard");
  } finally {
    await expectDeleted(page, `/api/chats/${chat.id}?force=true`);
  }
});

test("Roleplay stages story movement separately from prose and recovers stale turns", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
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
    locations: [
      generatedDefinition.locations[0],
      {
        ...generatedDefinition.locations[1],
        links: [{ targetId: "ai_lighthouse", label: "Cliff road", bidirectional: true, state: "available" as const }],
      },
      { ...generatedDefinition.locations[2], childPresentation: "layers" as const, links: [] },
      {
        id: "ai_edge",
        parentId: "ai_world",
        name: "World's Edge",
        kind: "place",
        description: "The exact edge of the charted coast.",
        modelMemory: "The mapped road begins at the extreme southwest edge.",
        icon: "🧭",
        childPresentation: "list" as const,
        placement: { x: 0, y: 100 },
        links: [{ targetId: "ai_harbor", label: "Coastal road", bidirectional: true, state: "available" as const }],
        status: "active" as const,
        sortOrder: 2,
      },
      {
        id: "ai_lighthouse_ground",
        parentId: "ai_lighthouse",
        name: "Ground Level",
        kind: "floor",
        description: "The lighthouse entrance and keeper's stores.",
        modelMemory: "A spiral stair begins behind the oil racks.",
        icon: "1️⃣",
        childPresentation: "map" as const,
        layerOrder: 0,
        links: [],
        status: "active" as const,
        sortOrder: 0,
      },
      {
        id: "ai_lighthouse_upper",
        parentId: "ai_lighthouse",
        name: "Upper Level",
        kind: "floor",
        description: "The lantern gallery above the cliffs.",
        modelMemory: "The blackglass lens reveals marked ships.",
        icon: "2️⃣",
        childPresentation: "map" as const,
        layerOrder: 1,
        links: [],
        status: "active" as const,
        sortOrder: 1,
      },
      ...Array.from({ length: 23 }, (_, index) => ({
        id: `ai_lighthouse_floor_${index + 3}`,
        parentId: "ai_lighthouse",
        name: `Floor ${index + 3}`,
        kind: "floor" as const,
        description: `Tower floor ${index + 3}.`,
        modelMemory: `The lighthouse stair reaches floor ${index + 3}.`,
        icon: "🏰",
        childPresentation: "map" as const,
        layerOrder: index + 2,
        links: [],
        status: "active" as const,
        sortOrder: index + 2,
      })),
    ],
  };
  const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
    data: {
      expectedRevision: 0,
      expectedCurrentLocationId: null,
      definition: runtimeDefinition,
      hierarchyProfile: {
        version: 1,
        mode: "template",
        name: "Runtime map presentation",
        types: [
          { id: "type_region", label: "Region", baseKind: "region" },
          { id: "type_settlement", label: "Settlement", baseKind: "settlement" },
          { id: "type_place", label: "Place", baseKind: "place" },
          { id: "type_building", label: "Building", baseKind: "building" },
          { id: "type_floor", label: "Floor", baseKind: "floor" },
          { id: "type_room", label: "Room", baseKind: "room" },
        ],
        locationTypeIds: {},
        showConnections: true,
        linkPresentations: {
          "ai_harbor|ai_lighthouse": { color: "#22C55E", lineStyle: "dotted" },
        },
      },
    },
  });
  expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();
  const saved = (await saveResponse.json()) as {
    definition: { revision: number };
    currentLocationId: string;
    hierarchyProfile: {
      showConnections: boolean;
      linkPresentations: Record<string, { color: string; lineStyle: string }>;
    };
  };
  expect(saved.hierarchyProfile.linkPresentations["ai_harbor|ai_lighthouse"]).toEqual({
    color: "#22C55E",
    lineStyle: "dotted",
  });
  expect(saved.hierarchyProfile.showConnections).toBe(true);
  let generationRequestCount = 0;

  await page.route("**/api/generate", async (route) => {
    generationRequestCount += 1;
    const request = route.request().postDataJSON() as {
      chatId: string;
      userMessage?: string;
      generationGuide?: string;
      impersonate?: boolean;
      pendingSpatialTransition?: {
        destinationId: string;
        expectedDefinitionRevision: number;
        expectedCurrentLocationId: string;
        commandId: string;
      };
    };
    expect(request.chatId).toBe(chat.id);
    if (generationRequestCount === 1) {
      expect(request.generationGuide).toContain("Let the NPC wait at the current location");
      expect(request.impersonate).not.toBe(true);
      expect(request.pendingSpatialTransition).toBeUndefined();
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ type: "done", data: "" })}\n\n`,
      });
      return;
    }
    expect(request.userMessage).not.toContain("moves to");
    const pendingSpatialTransition = request.pendingSpatialTransition;
    expect(pendingSpatialTransition).toBeDefined();
    if (!pendingSpatialTransition) throw new Error("Owner movement request did not include its queued transition");
    if (generationRequestCount === 2) {
      expect(request.impersonate).toBe(true);
      expect(pendingSpatialTransition).toMatchObject({
        destinationId: "ai_harbor",
        expectedDefinitionRevision: saved.definition.revision,
        expectedCurrentLocationId: "ai_world",
      });
      const commitResponse = await page.request.post(`/api/chats/${chat.id}/spatial-context/turn`, {
        data: {
          content: request.userMessage,
          transition: pendingSpatialTransition,
        },
      });
      expect(commitResponse.ok()).toBeTruthy();
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body:
          `data: ${JSON.stringify({
            type: "spatial_transition_committed",
            data: {
              chatId: chat.id,
              commandId: pendingSpatialTransition.commandId,
              currentLocationId: "ai_harbor",
              definitionRevision: saved.definition.revision,
            },
          })}\n\n` + `data: ${JSON.stringify({ type: "done", data: "" })}\n\n`,
      });
      return;
    }
    if (generationRequestCount === 3) {
      expect(pendingSpatialTransition).toMatchObject({
        destinationId: "ai_world",
        expectedDefinitionRevision: saved.definition.revision,
        expectedCurrentLocationId: "ai_harbor",
      });
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "The world map changed. Review the available destinations.",
          code: "spatial_transition_stale_definition",
          currentRevision: saved.definition.revision + 1,
          currentLocationId: "ai_harbor",
        }),
      });
      return;
    }
    expect(generationRequestCount).toBe(4);
    const expectedRouteHop = {
      destinationId: "ai_lighthouse_upper",
      expectedCurrentLocationId: "ai_lighthouse",
    };
    expect(pendingSpatialTransition).toMatchObject({
      ...expectedRouteHop,
      expectedDefinitionRevision: saved.definition.revision,
    });
    const commitResponse = await page.request.post(`/api/chats/${chat.id}/spatial-context/turn`, {
      data: { content: request.userMessage, transition: pendingSpatialTransition },
    });
    expect(commitResponse.ok(), await commitResponse.text()).toBeTruthy();
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        `data: ${JSON.stringify({
          type: "spatial_transition_committed",
          data: {
            chatId: chat.id,
            commandId: pendingSpatialTransition.commandId,
            currentLocationId: expectedRouteHop.destinationId,
            definitionRevision: saved.definition.revision,
          },
        })}\n\n` + `data: ${JSON.stringify({ type: "done", data: "" })}\n\n`,
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
    const openStoryMap = storyLocation.getByRole("button", { name: "Open story map" });
    await expectMinimumInteractiveSize(openStoryMap, "Roleplay story-map control");
    const mobileRuntime = testInfo.project.name.includes("mobile");
    const composerBeforeMap = mobileRuntime
      ? await page.locator("textarea.mari-chat-input-textarea").boundingBox()
      : null;
    if (mobileRuntime) {
      expect(composerBeforeMap, "Composer must have measurable browser geometry").not.toBeNull();
      const collapsedRuntimeBox = await storyLocation.boundingBox();
      expect(collapsedRuntimeBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(52);
      expect(collapsedRuntimeBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(48);
    } else {
      expect(await computedBackgroundAlpha(storyLocation), "Collapsed desktop map bar should be opaque").toBe(1);
      const storyLocationToggle = storyLocation.getByRole("button", { name: /^Story location:/ });
      await storyLocationToggle.click();
      const locationOptions = storyLocation.locator("[data-marinara-maps-runtime-options]");
      await expect(locationOptions).toBeVisible();
      expect(await computedBackgroundAlpha(locationOptions), "Expanded desktop location controls should be opaque").toBe(1);
      await storyLocationToggle.click();
    }
    await openStoryMap.click();
    let roleplayMap = storyLocation.getByRole("region", { name: "Hierarchical world map" });
    await expect(roleplayMap).toBeVisible();
    const runtimeCanvas = roleplayMap.locator("[data-marinara-maps-world-canvas]");
    const runtimeCanvasBox = await runtimeCanvas.boundingBox();
    expect(runtimeCanvasBox, "Runtime map canvas must have browser geometry").not.toBeNull();
    expect(runtimeCanvasBox!.width / runtimeCanvasBox!.height).toBeCloseTo(16 / 9, 1);
    const harborMarker = roleplayMap.getByRole("button", { name: /Inspect Gloam Harbor/ });
    expect(await harborMarker.evaluate((element) => (element as HTMLElement).style.left)).toBe("25%");
    expect(await harborMarker.evaluate((element) => (element as HTMLElement).style.top)).toBe("60%");
    const connectionLine = roleplayMap.locator(
      'line[data-marinara-map-connection="ai_harbor|ai_lighthouse"]',
    );
    await expect(connectionLine).toHaveCount(1);
    await expect(connectionLine).toHaveAttribute("x1", "25%");
    await expect(connectionLine).toHaveAttribute("y1", "60%");
    await expect(connectionLine).toHaveAttribute("x2", "72%");
    await expect(connectionLine).toHaveAttribute("y2", "25%");
    await expect(connectionLine).toHaveAttribute("data-line-style", "dotted");
    await expect(connectionLine).toHaveAttribute("stroke", "#22C55E");
    await expect(connectionLine).toHaveAttribute("stroke-dasharray", "1 5");
    const edgeMarker = roleplayMap.getByRole("button", { name: /Inspect World's Edge/ });
    expect(await edgeMarker.evaluate((element) => (element as HTMLElement).style.left)).toBe("0%");
    expect(await edgeMarker.evaluate((element) => (element as HTMLElement).style.top)).toBe("100%");
    const edgeConnectionLine = roleplayMap.locator(
      'line[data-marinara-map-connection="ai_edge|ai_harbor"]',
    );
    await expect(edgeConnectionLine).toHaveCount(1);
    await expect(edgeConnectionLine).toHaveAttribute("x1", "0%");
    await expect(edgeConnectionLine).toHaveAttribute("y1", "100%");
    await expect(edgeConnectionLine).toHaveAttribute("x2", "25%");
    await expect(edgeConnectionLine).toHaveAttribute("y2", "60%");
    await expect(roleplayMap.getByRole("button", { name: /connections/u })).toHaveCount(0);
    const visibleMapPopover = storyLocation.locator("[data-marinara-maps-runtime-popover]:visible");
    await expect(visibleMapPopover).toBeVisible();
    const mapPopoverBox = await visibleMapPopover.boundingBox();
    const viewport = page.viewportSize();
    expect(mapPopoverBox, "Story-map popover must have browser geometry").not.toBeNull();
    expect(viewport, "Browser viewport must be available").not.toBeNull();
    expect(mapPopoverBox!.y).toBeGreaterThanOrEqual(0);
    expect(mapPopoverBox!.y + mapPopoverBox!.height).toBeLessThanOrEqual(viewport!.height + 1);
    expect(
      await computedBackgroundAlpha(visibleMapPopover),
      "Story-map popover background should be opaque",
    ).toBe(1);
    if (mobileRuntime) {
      const composerAfterMap = await page.locator("textarea.mari-chat-input-textarea").boundingBox();
      expect(composerAfterMap, "Composer must remain measurable after opening the map").not.toBeNull();
      expect(Math.abs(composerAfterMap!.y - composerBeforeMap!.y)).toBeLessThanOrEqual(1);
      const closeMapToggle = storyLocation.getByRole("button", { name: "Close story map", exact: true });
      await expectMinimumInteractiveSize(closeMapToggle, "Roleplay story-map close toggle");
      await closeMapToggle.click();
      await expect(roleplayMap).toHaveCount(0);
      await storyLocation.getByRole("button", { name: "Open story map" }).click();
      roleplayMap = storyLocation.getByRole("region", { name: "Hierarchical world map" });
      await expect(roleplayMap).toBeVisible();
      const closeMapPanel = storyLocation.getByRole("button", { name: "Close story map panel" });
      await expectMinimumInteractiveSize(closeMapPanel, "Roleplay story-map panel close control");
      await closeMapPanel.click();
      await expect(roleplayMap).toHaveCount(0);
      await expect(openStoryMap).toBeFocused();
      await storyLocation.getByRole("button", { name: "Open story map" }).click();
      roleplayMap = storyLocation.getByRole("region", { name: "Hierarchical world map" });
      await expect(roleplayMap).toBeVisible();
    } else {
      const closeExpandedMap = storyLocation.getByRole("button", { name: "Close expanded story map" });
      await expectMinimumInteractiveSize(closeExpandedMap, "Desktop story-map panel close control");
      await closeExpandedMap.click();
      await expect(roleplayMap).toHaveCount(0);
      await expect(openStoryMap).toBeFocused();
      await openStoryMap.click();
      roleplayMap = storyLocation.getByRole("region", { name: "Hierarchical world map" });
      await expect(roleplayMap).toBeVisible();
    }
    const editMap = roleplayMap.getByRole("button", { name: "Edit world map" });
    await expectMinimumInteractiveSize(editMap, "Roleplay minimap edit control");
    await editMap.click();
    await expect(page.getByRole("heading", { name: "World map", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to chat" }).click();
    await storyLocation.getByRole("button", { name: "Open story map" }).click();
    roleplayMap = storyLocation.getByRole("region", { name: "Hierarchical world map" });
    await roleplayMap.getByRole("button", { name: /Inspect Blackglass Lighthouse/ }).click();
    await roleplayMap.getByRole("button", { name: "Explore inside" }).click();
    const locationLayers = roleplayMap.getByRole("list", { name: "Location layers" });
    await expect(locationLayers).toBeVisible();
    await expect(roleplayMap.getByText("Ground Level", { exact: true })).toBeVisible();
    await expect(roleplayMap.getByText("Upper Level", { exact: true })).toBeVisible();
    await expect(roleplayMap.getByText("Floor 25", { exact: true })).toBeAttached();
    expect(
      await storyLocation
        .locator("[data-marinara-maps-runtime-popover]:visible [data-marinara-maps-runtime-map-scroll]")
        .evaluate((element) => element.scrollHeight > element.clientHeight),
      "A 25-floor tower should scroll inside the map instead of expanding the composer",
    ).toBe(true);
    expect(
      await locationLayers.evaluate((element) => getComputedStyle(element.parentElement!).overflowY),
      "The level list should defer scrolling to the map panel",
    ).toBe("visible");
    const mapScroll = storyLocation.locator(
      "[data-marinara-maps-runtime-popover]:visible [data-marinara-maps-runtime-map-scroll]",
    );
    const scrollTopBeforeLevelScroll = await mapScroll.evaluate((element) => element.scrollTop);
    await locationLayers.hover();
    await page.mouse.wheel(0, 420);
    await expect
      .poll(() => mapScroll.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(scrollTopBeforeLevelScroll);
    if (!mobileRuntime) {
      const closeExpandedMap = storyLocation.getByRole("button", { name: "Close expanded story map" });
      await expectMinimumInteractiveSize(closeExpandedMap, "Desktop story-map panel close control");
      await expect(closeExpandedMap).toBeInViewport();
    }
    await roleplayMap.getByRole("button", { name: "Browse up one location" }).click();
    const inspectHarbor = roleplayMap.getByRole("button", { name: /Inspect Gloam Harbor/ });
    await expectMinimumInteractiveSize(inspectHarbor, "Roleplay map destination control");
    await inspectHarbor.focus();
    await page.keyboard.press("Enter");
    await expect(roleplayMap.getByText("A busy harbor of black piers.", { exact: true })).toBeVisible();
    await expect(roleplayMap.getByRole("button", { name: "Show linked place Blackglass Lighthouse" })).toBeVisible();
    const setHarborDestination = roleplayMap.getByRole("button", { name: "Set destination: Gloam Harbor" });
    await expectMinimumInteractiveSize(setHarborDestination, "Roleplay map set-destination control");
    await setHarborDestination.click();
    await expect(storyLocation.getByText("Moves with your next turn")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Story location" }).getByText("Moves with your next turn")).toBeVisible();
    const input = page.locator("textarea.mari-chat-input-textarea");
    await input.fill("/guided Let the NPC wait at the current location.");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(input).toHaveValue("");
    await expect(storyLocation.getByText("Moves with your next turn")).toBeVisible();
    const afterGuidedResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(afterGuidedResponse.ok(), await afterGuidedResponse.text()).toBeTruthy();
    expect(((await afterGuidedResponse.json()) as { currentLocationId: string }).currentLocationId).toBe("ai_world");

    await input.fill("/impersonate I follow the harbor road.");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(page.getByText("Moves with your next turn")).toHaveCount(0);
    await expect(input).toHaveValue("");
    await expect(storyLocation).toContainText("Gloam Harbor");

    if (mobileRuntime) {
      await storyLocation.getByRole("button", { name: "Open story map" }).click();
      await storyLocation.getByRole("button", { name: /Open story location options.*Gloam Harbor/ }).click();
    } else {
      await storyLocation.getByRole("button", { name: /Story location.*Gloam Harbor/ }).click();
    }
    await storyLocation.getByRole("button", { name: "Inspect Shrouded Coast" }).click();
    await storyLocation.getByRole("button", { name: "Set destination: Shrouded Coast" }).click();
    await input.fill("Wait for me at the gate.");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(input).toHaveValue("Wait for me at the gate.");
    await expect(storyLocation.getByText(/Needs review/)).toBeVisible();

    await page.reload();
    await expect(page.locator("textarea.mari-chat-input-textarea")).toHaveValue("Wait for me at the gate.");
    const recoveredStoryLocation = page.getByRole("region", { name: "Story location" });
    await expect(recoveredStoryLocation.getByText(/Needs review/)).toBeVisible();
    await recoveredStoryLocation.getByRole("button", { name: "Cancel move to Shrouded Coast" }).click();

    await recoveredStoryLocation.getByRole("button", { name: "Open story map" }).click();
    const routeMap = recoveredStoryLocation.getByRole("region", { name: "Hierarchical world map" });
    await routeMap.getByRole("button", { name: /Inspect Blackglass Lighthouse/ }).click();
    await routeMap.getByRole("button", { name: "Explore inside" }).click();
    await routeMap.getByRole("button", { name: /Inspect Upper Level/ }).click();
    await expect(routeMap.getByText("Shortest route · 2 hops", { exact: true })).toBeVisible();
    await routeMap.getByRole("button", { name: "Plan route to Upper Level" }).click();
    await expect(recoveredStoryLocation).toContainText("Upper Level");
    await expect(recoveredStoryLocation).toContainText("Next stop: Blackglass Lighthouse");
    if (mobileRuntime) {
      const queuedStoryMap = recoveredStoryLocation.getByRole("button", { name: "Open story map" });
      await expectMinimumInteractiveSize(queuedStoryMap, "Queued mobile story-map control");
      await queuedStoryMap.click();
      await expect(recoveredStoryLocation.getByRole("region", { name: "Hierarchical world map" })).toBeVisible();
    }

    await page.evaluate(() => {
      const runtime = document.querySelector("marinara-capability-hierarchical-maps[view='runtime']") as
        | (HTMLElement & {
            capabilityProps?: Record<string, unknown>;
            routeTestOriginalProps?: Record<string, unknown>;
          })
        | null;
      if (!runtime?.capabilityProps) throw new Error("World Maps runtime capability was not mounted");
      runtime.routeTestOriginalProps = runtime.capabilityProps;
      runtime.capabilityProps = {
        ...runtime.capabilityProps,
        onPendingTransitionChange: () => {},
      };
      runtime.dispatchEvent(new CustomEvent("marinara-capability-props"));
    });
    const firstRouteTransition = await page.evaluate((chatId) => {
      const stored = JSON.parse(localStorage.getItem("marinara-pending-spatial-transitions") ?? "[]") as Array<
        [string, { transition: Record<string, unknown> }]
      >;
      return stored.find(([storedChatId]) => storedChatId === chatId)?.[1].transition ?? null;
    }, chat.id);
    expect(firstRouteTransition).toMatchObject({
      destinationId: "ai_lighthouse",
      expectedCurrentLocationId: "ai_harbor",
    });
    const firstRouteCommit = await page.request.post(`/api/chats/${chat.id}/spatial-context/turn`, {
      data: {
        content: "I take the cliff road to the lighthouse.",
        transition: firstRouteTransition,
      },
    });
    expect(firstRouteCommit.ok(), await firstRouteCommit.text()).toBeTruthy();
    await page.evaluate((chatId) => {
      window.dispatchEvent(
        new CustomEvent("marinara-capability-server-event", {
          detail: { packageId: "hierarchical-maps", type: "spatial_transition_committed", chatId },
        }),
      );
    }, chat.id);
    await expect(recoveredStoryLocation).toContainText("Next stop: Upper Level");

    // Engine acknowledges the committed first command with null after Maps has
    // already queued the second hop. That acknowledgement must only clear the
    // submitted command, never the newly queued route command.
    await page.evaluate(() => {
      const runtime = document.querySelector("marinara-capability-hierarchical-maps[view='runtime']") as
        | (HTMLElement & { capabilityProps?: Record<string, unknown> })
        | null;
      if (!runtime?.capabilityProps) throw new Error("World Maps runtime capability was not mounted");
      runtime.capabilityProps = { ...runtime.capabilityProps, pendingTransition: null };
      runtime.dispatchEvent(new CustomEvent("marinara-capability-props"));
    });
    await expect(recoveredStoryLocation).toContainText("Next stop: Upper Level");

    await page.evaluate((chatId) => {
      const runtime = document.querySelector("marinara-capability-hierarchical-maps[view='runtime']") as
        | (HTMLElement & {
            capabilityProps?: Record<string, unknown>;
            routeTestOriginalProps?: Record<string, unknown>;
          })
        | null;
      if (!runtime?.capabilityProps || !runtime.routeTestOriginalProps) {
        throw new Error("World Maps runtime capability test bridge was not available");
      }
      const stored = JSON.parse(localStorage.getItem("marinara-pending-spatial-transitions") ?? "[]") as Array<
        [string, unknown]
      >;
      const pending = stored.find(([storedChatId]) => storedChatId === chatId)?.[1] ?? null;
      runtime.capabilityProps = { ...runtime.routeTestOriginalProps, pendingTransition: pending };
      runtime.dispatchEvent(new CustomEvent("marinara-capability-props"));
      const onPendingTransitionChange = runtime.routeTestOriginalProps.onPendingTransitionChange;
      if (typeof onPendingTransitionChange === "function") onPendingTransitionChange(pending);
      delete runtime.routeTestOriginalProps;
    }, chat.id);

    const routeInput = page.locator("textarea.mari-chat-input-textarea");
    await routeInput.fill("I climb to the lantern gallery.");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(recoveredStoryLocation.getByText("Next stop: Upper Level", { exact: false })).toHaveCount(0);
    await expect(recoveredStoryLocation).toContainText("Upper Level");

    const currentSpatialResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(currentSpatialResponse.ok(), await currentSpatialResponse.text()).toBeTruthy();
    const currentSpatial = (await currentSpatialResponse.json()) as {
      currentLocationId: string;
      definition: typeof runtimeDefinition & { revision: number };
    };
    const disableResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
      data: {
        expectedRevision: currentSpatial.definition.revision,
        expectedCurrentLocationId: currentSpatial.currentLocationId,
        definition: { ...currentSpatial.definition, enabled: false },
      },
    });
    expect(disableResponse.ok(), await disableResponse.text()).toBeTruthy();
    await page.reload();
    await expect(page.getByRole("region", { name: "Story location" })).toContainText(
      "Map disabled. Its saved hierarchy and history are preserved until you enable it again.",
    );
  } finally {
    await page.unroute("**/api/generate");
    await expectDeleted(page, `/api/chats/${chat.id}`);
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
          locations: [
            ...gameGeneratedDefinition.locations,
            {
              id: "ai_harbor_docks",
              parentId: "ai_harbor",
              name: "Fogbound Docks",
              kind: "place",
              description: "Low docks tucked beneath Gloam Harbor's black piers.",
              modelMemory: "The dockhands track every boat that arrives after midnight.",
              icon: "🛶",
              childPresentation: "list",
              links: [],
              status: "active",
              sortOrder: 0,
            },
          ],
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
            gameTutorialDisabled: true,
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
      const storyLocation = page.getByRole("region", { name: "Story location" });
      const storyMapToggle = storyLocation.getByRole("button", { name: "Open story map" });
      const actionButton = page.getByRole("button", { name: "Start combat", exact: true });
      const gameInput = page.getByPlaceholder("What do you do?");
      await expect(storyMapToggle).toBeVisible();
      await expect(actionButton).toBeVisible();
      await expect(gameInput).toBeVisible();
      const [storyLocationBox, storyMapToggleBox, actionButtonBox, gameInputBeforeMap] = await Promise.all([
        storyLocation.boundingBox(),
        storyMapToggle.boundingBox(),
        actionButton.boundingBox(),
        gameInput.boundingBox(),
      ]);
      expect(storyLocationBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          (storyMapToggleBox?.y ?? 0) + (storyMapToggleBox?.height ?? 0) / 2 -
            ((actionButtonBox?.y ?? 0) + (actionButtonBox?.height ?? 0) / 2),
        ),
      ).toBeLessThanOrEqual(1);

      await storyMapToggle.click();
      const runtimeMapPanel = storyLocation.locator("[data-marinara-maps-runtime-popover]");
      await expect(runtimeMapPanel).toBeVisible();
      const panelBackground = await runtimeMapPanel.evaluate((panel) => getComputedStyle(panel).backgroundColor);
      expect(panelBackground).not.toMatch(/^rgba\([^)]*,\s*(?:0|0?\.\d+)\)$/);
      const gameInputAfterMap = await gameInput.boundingBox();
      expect(Math.abs((gameInputAfterMap?.y ?? 0) - (gameInputBeforeMap?.y ?? 0))).toBeLessThanOrEqual(1);
      await storyLocation.getByRole("button", { name: /Open story location options/ }).click();
      const runtimeOptions = storyLocation.locator("[data-marinara-maps-runtime-options]");
      await expect(runtimeOptions).toBeVisible();
      const closeRuntimeOptions = runtimeOptions.getByRole("button", { name: "Close story location options" });
      await expectMinimumInteractiveSize(closeRuntimeOptions, "Game story-location options close control");
      await closeRuntimeOptions.click();
      await expect(runtimeOptions).toHaveCount(0);

      await page.getByRole("button", { name: "Open map" }).click();
    }

    const mapView = page.getByRole("group", { name: "Map view" });
    await expect(mapView.getByRole("button", { name: "World" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("The Crownscar", { exact: true })).toHaveCount(0);
    const worldMap = page.getByRole("region", { name: "Hierarchical world map" });
    await expect(worldMap).toBeVisible();
    const listToggle = worldMap.getByRole("button", { name: "Show places as list" });
    await expectMinimumInteractiveSize(listToggle, "Game world-map list alternative control");
    await listToggle.focus();
    await page.keyboard.press("Enter");
    await expect(worldMap.getByRole("list", { name: "Locations" })).toBeVisible();
    await expect(worldMap.getByRole("button", { name: /Inspect Gloam Harbor/ })).toBeVisible();
    await expect(worldMap.getByText("⚓", { exact: true })).toBeVisible();

    await worldMap.getByRole("button", { name: /Inspect Gloam Harbor/ }).click();
    await expect(worldMap.getByText("A busy harbor of black piers.")).toBeVisible();
    const exploreHarbor = worldMap.getByRole("button", { name: "Explore inside" });
    const setHarborDestination = worldMap.getByRole("button", { name: "Set destination: Gloam Harbor" });
    await expectMinimumInteractiveSize(exploreHarbor, "Game world-map explore control");
    await expectMinimumInteractiveSize(setHarborDestination, "Game world-map set-destination control");
    await exploreHarbor.click();
    await expect(worldMap.getByText("Fogbound Docks", { exact: true })).toBeVisible();
    await worldMap.getByRole("button", { name: "Center current story location" }).click();
    await worldMap.getByRole("button", { name: /Inspect Gloam Harbor/ }).click();
    await expect(worldMap.getByRole("button", { name: "Set destination: Gloam Harbor" })).toBeVisible();

    await mapView.getByRole("button", { name: "Local" }).click();
    await expect(mapView.getByRole("button", { name: "Local" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("The Crownscar", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Hierarchical world map" })).toHaveCount(0);
  } finally {
    await page.goto("about:blank");
    await page.request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

test("Game prompt scopes the legacy map beneath the hierarchical world location", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The package prompt contract is mode-independent.");
  const connectionResponse = await page.request.post("/api/connections", {
    data: {
      name: `Maps Prompt Contract ${Date.now()}`,
      provider: "custom",
      baseUrl: "https://example.invalid/v1",
      model: "maps-prompt-contract",
      apiKey: "maps-prompt-contract",
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  let chat: { id: string } | null = null;

  try {
    const chatResponse = await page.request.post("/api/chats", {
      data: {
        name: "Game Map Prompt Contract",
        mode: "game",
        characterIds: [],
        connectionId: connection.id,
      },
    });
    expect(chatResponse.ok()).toBeTruthy();
    chat = (await chatResponse.json()) as { id: string };
    await activateHierarchicalMaps(page, chat.id);
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameSystemPrompt: [
          "Run the game.",
          "<map_state>",
          "Map: The Crownscar",
          "Party position: Architect's Shrine",
          "</map_state>",
          "",
          "COMMANDS:",
          `- [map_update: new_location="Location Name" connected_to="Previous Location Name" node_emoji="emoji"] - only when the party arrives at an entirely new location on the current node map.`,
        ].join("\n"),
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    const previewPrompt = async () => {
      const promptResponse = await page.request.post("/api/generate/dryRun", {
        data: {
          chatId: chat.id,
          connectionId: connection.id,
          returnPrompt: true,
          skipPreset: true,
          userMessage: "Look around.",
        },
      });
      expect(promptResponse.ok()).toBeTruthy();
      const preview = (await promptResponse.json()) as {
        prompt: { messages: Array<{ role: string; content: string }> };
      };
      return preview.prompt.messages.map((message) => message.content).join("\n\n");
    };

    const legacyOnlyPrompt = await previewPrompt();
    expect(legacyOnlyPrompt).toContain("<map_state>");
    expect(legacyOnlyPrompt).toContain("only when the party arrives at an entirely new location");
    expect(legacyOnlyPrompt).not.toContain("<local_map_state");
    expect(legacyOnlyPrompt).not.toContain("<spatial_context");

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

    const prompt = await previewPrompt();
    expect(prompt).toContain(`<spatial_context mode="game" authority="application">`);
    expect(prompt).toContain("Current path: Shrouded Coast");
    expect(prompt).toContain(`<local_map_state authority="tactical" world_location_source="spatial_context">`);
    expect(prompt).toContain("Map: The Crownscar");
    expect(prompt).not.toContain("<map_state>");
    expect(prompt).not.toContain("</map_state>");
    expect(prompt).toContain("only to add local/tactical detail inside the current hierarchical location");
    expect(prompt).toContain("it must never represent or cause travel between hierarchical locations");
    expect(prompt).toContain("[map_update:");
  } finally {
    await expectDeletedInOrder(page, [chat ? `/api/chats/${chat.id}` : null, `/api/connections/${connection.id}`]);
  }
});

test("Roleplay and Game generation, retry, and continuation share historical prompt parity", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The prompt and lore contract is viewport-independent.");
  test.setTimeout(120_000);

  const provider = await startOpenAiTestServer([
    "ROLEPLAY_HARBOR_NORMAL: The harbor bells answer across the water.",
    "ROLEPLAY_WORLD_NORMAL: The wider coast opens beyond the harbor road.",
    "ROLEPLAY_HARBOR_RETRY: The harbor answer changes while its anchor remains.",
    "ROLEPLAY_WORLD_CONTINUATION: The coast continues beyond the headland.",
    "GAME_HARBOR_NORMAL: The party remains within Gloam Harbor.",
    "GAME_WORLD_NORMAL: The party surveys the whole Shrouded Coast.",
    "GAME_HARBOR_RETRY: A different harbor scene keeps the historical anchor.",
    "GAME_WORLD_CONTINUATION: The GM continues the wider coastal scene.",
  ]);
  const loreMarkers = {
    forced: "FORCED_LOCATION_LORE: cedar pilings mark the safe channel.",
    duplicate: "DUPLICATE_LOCATION_LORE: the tide clock rings at dusk.",
    disabled: "DISABLED_LOCATION_LORE_MUST_NOT_APPEAR",
    excluded: "EXCLUDED_LOCATION_LORE_MUST_NOT_APPEAR",
    oversized: "OVERSIZED_LOCATION_LORE_MUST_BE_REPORTED_AS_TRUNCATED",
  } as const;
  const lorebookIds: string[] = [];
  let connection: { id: string } | null = null;
  let character: { id: string } | null = null;
  let roleplayChat: { id: string } | null = null;
  let gameChat: { id: string } | null = null;

  const createLorebook = async (name: string) => {
    const response = await page.request.post("/api/lorebooks", {
      data: {
        name: `${name} ${Date.now()}`,
        description: "Normalized Hierarchical Maps prompt parity fixture.",
        category: "world",
        enabled: true,
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const lorebook = (await response.json()) as { id: string };
    lorebookIds.push(lorebook.id);
    return lorebook;
  };
  const createLorebookEntry = async (lorebookId: string, data: Record<string, unknown>) => {
    const response = await page.request.post(`/api/lorebooks/${lorebookId}/entries`, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return (await response.json()) as { id: string };
  };
  const previewPrompt = async (chatId: string, messageId?: string) => {
    const response = await page.request.post(`/api/chats/${chatId}/peek-prompt`, {
      data: messageId ? { messageId } : {},
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const preview = (await response.json()) as {
      source: string;
      exact: boolean;
      messages: Array<{ role?: string; content?: unknown }>;
    };
    return { ...preview, text: promptText(preview.messages) };
  };
  const generateCapturedTurn = async (data: Record<string, unknown>, source: string) => {
    const requestIndex = provider.requests.length;
    const events = await generateTurn(page, data);
    expect(provider.requests.length, `${source} must make one provider request`).toBe(requestIndex + 1);
    return {
      events,
      message: savedAssistantMessage(events, source),
      prompt: capturedPrompt(provider.requests[requestIndex]),
    };
  };
  const expectRejectedBeforeProvider = async (
    data: Record<string, unknown>,
    status: number,
    code: string,
    source: string,
  ) => {
    const requestCount = provider.requests.length;
    const response = await page.request.post("/api/generate", {
      data: {
        streaming: false,
        skipPresenceDelay: true,
        musicPlayerEnabled: false,
        ...data,
      },
    });
    const body = await response.text();
    expect(response.status(), body).toBe(status);
    expect(JSON.parse(body) as { code?: string }, source).toMatchObject({ code });
    expect(provider.requests.length, `${source} must stop before the provider`).toBe(requestCount);
  };
  const dryRunPrompt = async (chatId: string) => {
    const response = await page.request.post("/api/generate/dryRun", {
      data: {
        chatId,
        connectionId: connection!.id,
        returnPrompt: true,
        skipPreset: true,
        injectLorebook: true,
        userMessage: "Check the normalized harbor projection.",
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const preview = (await response.json()) as {
      prompt: { messages: Array<{ role?: string; content?: unknown }> };
    };
    return promptText(preview.prompt.messages);
  };
  const expectActiveContext = async (
    chatId: string,
    entries: {
      forced: string;
      duplicate: string;
      disabled: string;
      excluded: string;
      oversized: string;
    },
  ) => {
    const response = await page.request.get(`/api/lorebooks/scan/${chatId}`);
    expect(response.ok(), await response.text()).toBeTruthy();
    const scan = (await response.json()) as {
      entries: Array<{ id: string; activationSources?: string[] }>;
      budgetSkippedEntries?: Array<{ id: string; blockedBy?: string }>;
    };
    expect(scan.entries.map((entry) => entry.id).sort()).toEqual([entries.duplicate, entries.forced].sort());
    expect(scan.entries.find((entry) => entry.id === entries.forced)?.activationSources).toEqual(["current_location"]);
    expect(scan.entries.find((entry) => entry.id === entries.duplicate)?.activationSources).toEqual(
      expect.arrayContaining(["constant", "current_location"]),
    );
    expect(scan.entries.some((entry) => entry.id === entries.disabled)).toBe(false);
    expect(scan.entries.some((entry) => entry.id === entries.excluded)).toBe(false);
    expect(scan.entries.some((entry) => entry.id === entries.oversized)).toBe(false);
    expect(scan.budgetSkippedEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: entries.oversized,
          blockedBy: "location",
        }),
      ]),
    );
  };

  try {
    const connectionResponse = await page.request.post("/api/connections", {
      data: {
        name: `Maps Prompt Parity ${Date.now()}`,
        provider: "custom",
        baseUrl: provider.baseUrl,
        model: "maps-authority-e2e",
        apiKey: "maps-authority-e2e",
        treatAsLocalEndpoint: true,
      },
    });
    expect(connectionResponse.ok(), await connectionResponse.text()).toBeTruthy();
    connection = (await connectionResponse.json()) as { id: string };

    const forcedBook = await createLorebook("Maps forced-only lore");
    const activeBook = await createLorebook("Maps active duplicate lore");
    const excludedBook = await createLorebook("Maps excluded lore");
    const forcedEntry = await createLorebookEntry(forcedBook.id, {
      name: "Forced current-location truth",
      content: loreMarkers.forced,
      order: 0,
    });
    const duplicateEntry = await createLorebookEntry(activeBook.id, {
      name: "Ordinary and current-location truth",
      content: loreMarkers.duplicate,
      constant: true,
      order: 10,
    });
    const disabledEntry = await createLorebookEntry(activeBook.id, {
      name: "Disabled current-location truth",
      content: loreMarkers.disabled,
      constant: true,
      enabled: false,
      order: 20,
    });
    const excludedEntry = await createLorebookEntry(excludedBook.id, {
      name: "Excluded current-location truth",
      content: loreMarkers.excluded,
      constant: true,
      order: 30,
    });
    const oversizedEntry = await createLorebookEntry(forcedBook.id, {
      name: "Over-budget current-location truth",
      content: `${loreMarkers.oversized}: ${"boundary ".repeat(9_000)}`,
      order: 100,
    });
    const entryIds = {
      forced: forcedEntry.id,
      duplicate: duplicateEntry.id,
      disabled: disabledEntry.id,
      excluded: excludedEntry.id,
      oversized: oversizedEntry.id,
    };
    const missingEntryId = `missing-location-lore-${Date.now()}`;
    const buildParityDefinition = (ownerMode: "roleplay" | "game") => ({
      ...generatedDefinition,
      ownerMode,
      enabled: true,
      startingLocationId: "ai_harbor",
      locations: generatedDefinition.locations.map((location) =>
        location.id === "ai_harbor"
          ? {
              ...location,
              lorebookEntryIds: [
                forcedEntry.id,
                duplicateEntry.id,
                disabledEntry.id,
                excludedEntry.id,
                oversizedEntry.id,
                missingEntryId,
              ],
            }
          : location,
      ),
    });

    const characterResponse = await page.request.post("/api/characters", {
      data: { data: { name: `Maps Prompt Parity Guide ${Date.now()}` } },
    });
    expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
    character = (await characterResponse.json()) as { id: string };
    const roleplayChatResponse = await page.request.post("/api/chats", {
      data: {
        name: "Roleplay normalized Maps prompt parity",
        mode: "roleplay",
        characterIds: [character.id],
        connectionId: connection.id,
      },
    });
    expect(roleplayChatResponse.ok(), await roleplayChatResponse.text()).toBeTruthy();
    roleplayChat = (await roleplayChatResponse.json()) as { id: string };
    await activateHierarchicalMaps(page, roleplayChat.id);
    const roleplayMetadataResponse = await page.request.patch(`/api/chats/${roleplayChat.id}/metadata`, {
      data: {
        activeLorebookIds: [activeBook.id, excludedBook.id],
        excludedLorebookIds: [excludedBook.id],
      },
    });
    expect(roleplayMetadataResponse.ok(), await roleplayMetadataResponse.text()).toBeTruthy();
    const roleplaySaveResponse = await page.request.put(`/api/chats/${roleplayChat.id}/spatial-context`, {
      data: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition: buildParityDefinition("roleplay"),
      },
    });
    expect(roleplaySaveResponse.ok(), await roleplaySaveResponse.text()).toBeTruthy();
    const roleplaySave = (await roleplaySaveResponse.json()) as {
      currentLocationId: string;
      definition: { revision: number };
      warnings?: Array<{ code?: string; message?: string; locationId?: string }>;
    };
    expect(roleplaySave.currentLocationId).toBe("ai_harbor");
    expect(roleplaySave.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "lorebook_entry_missing",
          locationId: "ai_harbor",
          message:
            "“Gloam Harbor” links to a lore entry that was deleted or is unavailable. Open Linked lore for this location and detach the missing entry, or restore/import its lorebook.",
        }),
      ]),
    );

    const roleplayLive = await previewPrompt(roleplayChat.id);
    expect(roleplayLive).toMatchObject({
      source: "live_preview",
      exact: false,
    });
    const roleplayDryRun = await dryRunPrompt(roleplayChat.id);
    const roleplayNormalTurn = await generateCapturedTurn(
      {
        chatId: roleplayChat.id,
        connectionId: connection.id,
        userMessage: "Generate from the normalized harbor projection.",
      },
      "Roleplay normal generation",
    );
    const roleplayNormal = roleplayNormalTurn.prompt;
    const roleplayCached = await previewPrompt(roleplayChat.id);
    expect(roleplayCached).toMatchObject({ source: "cached", exact: true });
    expect(roleplayCached.text).toBe(roleplayNormal);
    expect(
      new Set(
        [
          ["Roleplay live Peek Prompt", roleplayLive.text],
          ["Roleplay dry run", roleplayDryRun],
          ["Roleplay normal generation", roleplayNormal],
          ["Roleplay cached Peek Prompt", roleplayCached.text],
        ].map(([source, value]) =>
          expectNormalizedSpatialPrompt(value!, "roleplay", source!, loreMarkers),
        ),
      ).size,
    ).toBe(1);
    await expectActiveContext(roleplayChat.id, entryIds);

    const roleplayWorldTurn = await generateCapturedTurn(
      {
        chatId: roleplayChat.id,
        connectionId: connection.id,
        userMessage: "Return to the Shrouded Coast overview.",
        pendingSpatialTransition: {
          destinationId: "ai_world",
          expectedDefinitionRevision: roleplaySave.definition.revision,
          expectedCurrentLocationId: "ai_harbor",
          commandId: "roleplay-parity-return-to-world",
        },
      },
      "Roleplay accepted owner transition",
    );
    expect(roleplayWorldTurn.events.some((event) => event.type === "spatial_transition_committed")).toBe(true);
    expectNormalizedSpatialPrompt(
      roleplayWorldTurn.prompt,
      "roleplay",
      "Roleplay accepted owner transition",
      loreMarkers,
      { path: "Shrouded Coast", id: "ai_world", forcedLore: false },
    );

    await expectRejectedBeforeProvider(
      {
        chatId: roleplayChat.id,
        connectionId: connection.id,
        userMessage: "Try a stale return to the harbor.",
        pendingSpatialTransition: {
          destinationId: "ai_harbor",
          expectedDefinitionRevision: roleplaySave.definition.revision - 1,
          expectedCurrentLocationId: "ai_world",
          commandId: "roleplay-parity-stale-return",
        },
      },
      409,
      "spatial_transition_stale_definition",
      "Roleplay stale transition",
    );
    await expectRejectedBeforeProvider(
      {
        chatId: roleplayChat.id,
        connectionId: connection.id,
        userMessage: "Duplicate the accepted owner transition.",
        pendingSpatialTransition: {
          destinationId: "ai_world",
          expectedDefinitionRevision: roleplaySave.definition.revision,
          expectedCurrentLocationId: "ai_harbor",
          commandId: "roleplay-parity-return-to-world",
        },
      },
      409,
      "spatial_transition_already_applied",
      "Roleplay duplicate transition",
    );
    await expectRejectedBeforeProvider(
      {
        chatId: roleplayChat.id,
        connectionId: connection.id,
        regenerateMessageId: roleplayNormalTurn.message.id,
        pendingSpatialTransition: {
          destinationId: "ai_harbor",
          expectedDefinitionRevision: roleplaySave.definition.revision,
          expectedCurrentLocationId: "ai_world",
          commandId: "roleplay-parity-invalid-retry-move",
        },
      },
      400,
      "spatial_transition_requires_new_turn",
      "Roleplay retry transition rejection",
    );

    const roleplayRetry = await generateCapturedTurn(
      {
        chatId: roleplayChat.id,
        connectionId: connection.id,
        regenerateMessageId: roleplayNormalTurn.message.id,
      },
      "Roleplay historical retry",
    );
    expect(roleplayRetry.message.id).toBe(roleplayNormalTurn.message.id);
    expect(roleplayRetry.message.activeSwipeIndex).toBe(1);
    expectNormalizedSpatialPrompt(
      roleplayRetry.prompt,
      "roleplay",
      "Roleplay historical retry",
      loreMarkers,
    );
    expect(roleplayRetry.prompt).not.toContain("Current location ID: ai_world");
    const roleplayRetryCached = await previewPrompt(roleplayChat.id, roleplayNormalTurn.message.id);
    expect(roleplayRetryCached).toMatchObject({ source: "cached", exact: true });
    expect(roleplayRetryCached.text).toBe(roleplayRetry.prompt);

    const roleplayContinuation = await generateCapturedTurn(
      {
        chatId: roleplayChat.id,
        connectionId: connection.id,
        continueMessageId: roleplayWorldTurn.message.id,
      },
      "Roleplay continuation",
    );
    expect(roleplayContinuation.message.id).toBe(roleplayWorldTurn.message.id);
    expectNormalizedSpatialPrompt(
      roleplayContinuation.prompt,
      "roleplay",
      "Roleplay continuation",
      loreMarkers,
      { path: "Shrouded Coast", id: "ai_world", forcedLore: false },
    );
    expect(roleplayContinuation.prompt).not.toContain("Current location ID: ai_harbor");
    const roleplayContinuationCached = await previewPrompt(roleplayChat.id, roleplayWorldTurn.message.id);
    expect(roleplayContinuationCached).toMatchObject({ source: "cached", exact: true });
    expect(roleplayContinuationCached.text).toBe(roleplayContinuation.prompt);

    const gameChatResponse = await page.request.post("/api/chats", {
      data: {
        name: "Game normalized Maps prompt parity",
        mode: "game",
        characterIds: [],
        connectionId: connection.id,
      },
    });
    expect(gameChatResponse.ok(), await gameChatResponse.text()).toBeTruthy();
    gameChat = (await gameChatResponse.json()) as { id: string };
    await activateHierarchicalMaps(page, gameChat.id);
    const gameMetadataResponse = await page.request.patch(`/api/chats/${gameChat.id}/metadata`, {
      data: {
        activeLorebookIds: [activeBook.id, excludedBook.id],
        excludedLorebookIds: [excludedBook.id],
        gameId: `maps-prompt-parity-${gameChat.id}`,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameSystemPrompt: "Run the normalized Hierarchical Maps parity fixture.",
      },
    });
    expect(gameMetadataResponse.ok(), await gameMetadataResponse.text()).toBeTruthy();
    const gameSaveResponse = await page.request.put(`/api/chats/${gameChat.id}/spatial-context`, {
      data: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition: buildParityDefinition("game"),
      },
    });
    expect(gameSaveResponse.ok(), await gameSaveResponse.text()).toBeTruthy();
    const gameSave = (await gameSaveResponse.json()) as {
      currentLocationId: string;
      definition: { revision: number };
      warnings?: Array<{ code?: string; message?: string; locationId?: string }>;
    };
    expect(gameSave.currentLocationId).toBe("ai_harbor");
    expect(gameSave.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "lorebook_entry_missing",
          locationId: "ai_harbor",
          message:
            "“Gloam Harbor” links to a lore entry that was deleted or is unavailable. Open Linked lore for this location and detach the missing entry, or restore/import its lorebook.",
        }),
      ]),
    );

    const gameLive = await previewPrompt(gameChat.id);
    expect(gameLive).toMatchObject({ source: "live_preview", exact: false });
    const gameDryRun = await dryRunPrompt(gameChat.id);
    const gameNormalTurn = await generateCapturedTurn(
      {
        chatId: gameChat.id,
        connectionId: connection.id,
        userMessage: "Generate the GM turn from the normalized harbor projection.",
      },
      "Game GM generation",
    );
    const gameNormal = gameNormalTurn.prompt;
    const gameCached = await previewPrompt(gameChat.id);
    expect(gameCached).toMatchObject({ source: "cached", exact: true });
    expect(gameCached.text).toBe(gameNormal);
    expect(
      new Set(
        [
          ["Game live Peek Prompt", gameLive.text],
          ["Game dry run", gameDryRun],
          ["Game GM generation", gameNormal],
          ["Game cached Peek Prompt", gameCached.text],
        ].map(([source, value]) =>
          expectNormalizedSpatialPrompt(value!, "game", source!, loreMarkers),
        ),
      ).size,
    ).toBe(1);
    await expectActiveContext(gameChat.id, entryIds);

    const gameWorldTurn = await generateCapturedTurn(
      {
        chatId: gameChat.id,
        connectionId: connection.id,
        userMessage: "Return the party to the Shrouded Coast overview.",
        pendingSpatialTransition: {
          destinationId: "ai_world",
          expectedDefinitionRevision: gameSave.definition.revision,
          expectedCurrentLocationId: "ai_harbor",
          commandId: "game-parity-return-to-world",
        },
      },
      "Game accepted owner transition",
    );
    expect(gameWorldTurn.events.some((event) => event.type === "spatial_transition_committed")).toBe(true);
    expectNormalizedSpatialPrompt(
      gameWorldTurn.prompt,
      "game",
      "Game accepted owner transition",
      loreMarkers,
      { path: "Shrouded Coast", id: "ai_world", forcedLore: false },
    );

    await expectRejectedBeforeProvider(
      {
        chatId: gameChat.id,
        connectionId: connection.id,
        regenerateMessageId: gameNormalTurn.message.id,
        pendingSpatialTransition: {
          destinationId: "ai_harbor",
          expectedDefinitionRevision: gameSave.definition.revision,
          expectedCurrentLocationId: "ai_world",
          commandId: "game-parity-invalid-retry-move",
        },
      },
      400,
      "spatial_transition_requires_new_turn",
      "Game retry transition rejection",
    );

    const gameRetry = await generateCapturedTurn(
      {
        chatId: gameChat.id,
        connectionId: connection.id,
        regenerateMessageId: gameNormalTurn.message.id,
      },
      "Game historical retry",
    );
    expect(gameRetry.message.id).toBe(gameNormalTurn.message.id);
    expect(gameRetry.message.activeSwipeIndex).toBe(1);
    expectNormalizedSpatialPrompt(gameRetry.prompt, "game", "Game historical retry", loreMarkers);
    expect(gameRetry.prompt).not.toContain("Current location ID: ai_world");
    const gameRetryCached = await previewPrompt(gameChat.id, gameNormalTurn.message.id);
    expect(gameRetryCached).toMatchObject({ source: "cached", exact: true });
    expect(gameRetryCached.text).toBe(gameRetry.prompt);

    const gameContinuation = await generateCapturedTurn(
      {
        chatId: gameChat.id,
        connectionId: connection.id,
        continueMessageId: gameWorldTurn.message.id,
      },
      "Game continuation",
    );
    expect(gameContinuation.message.id).toBe(gameWorldTurn.message.id);
    expectNormalizedSpatialPrompt(
      gameContinuation.prompt,
      "game",
      "Game continuation",
      loreMarkers,
      { path: "Shrouded Coast", id: "ai_world", forcedLore: false },
    );
    expect(gameContinuation.prompt).not.toContain("Current location ID: ai_harbor");
    const gameContinuationCached = await previewPrompt(gameChat.id, gameWorldTurn.message.id);
    expect(gameContinuationCached).toMatchObject({ source: "cached", exact: true });
    expect(gameContinuationCached.text).toBe(gameContinuation.prompt);
  } finally {
    try {
      await expectDeletedInOrder(page, [
        roleplayChat ? `/api/chats/${roleplayChat.id}?force=true` : null,
        gameChat ? `/api/chats/${gameChat.id}?force=true` : null,
        character ? `/api/characters/${character.id}` : null,
        ...lorebookIds.map((id) => `/api/lorebooks/${id}`),
        connection ? `/api/connections/${connection.id}` : null,
      ]);
    } finally {
      await provider.close();
    }
  }
});

test("Roleplay generated turns cannot move the hierarchical location without an owner transition", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The generated-turn authority contract is viewport-independent.");
  test.setTimeout(90_000);
  const provider = await startOpenAiTestServer([
    `We cross the cliffs and arrive at Blackglass Lighthouse.\n[spatial_transition: destination_id="ai_lighthouse"]`,
    "The harbor road descends toward black piers while the lighthouse remains distant.",
  ]);
  let connection: { id: string } | null = null;
  let character: { id: string } | null = null;
  let chat: { id: string } | null = null;

  try {
    const connectionResponse = await page.request.post("/api/connections", {
      data: {
        name: `Roleplay Maps Authority ${Date.now()}`,
        provider: "custom",
        baseUrl: provider.baseUrl,
        model: "maps-authority-e2e",
        apiKey: "maps-authority-e2e",
        treatAsLocalEndpoint: true,
      },
    });
    expect(connectionResponse.ok()).toBeTruthy();
    connection = (await connectionResponse.json()) as { id: string };
    const characterResponse = await page.request.post("/api/characters", {
      data: { data: { name: `Maps Authority Guide ${Date.now()}` } },
    });
    expect(characterResponse.ok()).toBeTruthy();
    character = (await characterResponse.json()) as { id: string };
    const chatResponse = await page.request.post("/api/chats", {
      data: {
        name: "Roleplay Generated-Turn Maps Authority",
        mode: "roleplay",
        characterIds: [character.id],
        connectionId: connection.id,
      },
    });
    expect(chatResponse.ok()).toBeTruthy();
    chat = (await chatResponse.json()) as { id: string };
    await activateHierarchicalMaps(page, chat.id);
    const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
      data: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition: { ...generatedDefinition, enabled: true },
      },
    });
    expect(saveResponse.ok()).toBeTruthy();
    const saved = (await saveResponse.json()) as { definition: { revision: number } };

    const narratedEvents = await generateTurn(page, {
      chatId: chat.id,
      connectionId: connection.id,
      userMessage: "Tell me what happens without moving my map marker.",
    });
    expect(narratedEvents.some((event) => event.type === "message_saved")).toBe(true);
    const narratedStateResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(narratedStateResponse.ok()).toBeTruthy();
    expect((await narratedStateResponse.json()) as { currentLocationId: string }).toMatchObject({
      currentLocationId: "ai_world",
    });
    const firstPrompt = capturedPrompt(provider.requests[0]);
    expect(firstPrompt).toContain(`<spatial_context mode="roleplay" authority="application">`);
    expect(firstPrompt).toContain("Generated prose, bracketed tags, tool-like commands, and claims of arrival cannot change it.");
    expect(firstPrompt).toContain("Only an explicit owner-selected destination committed by the application");

    const movedEvents = await generateTurn(page, {
      chatId: chat.id,
      connectionId: connection.id,
      userMessage: "I follow the road into Gloam Harbor.",
      pendingSpatialTransition: {
        destinationId: "ai_harbor",
        expectedDefinitionRevision: saved.definition.revision,
        expectedCurrentLocationId: "ai_world",
        commandId: `roleplay-owner-move-${Date.now()}`,
      },
    });
    expect(movedEvents.some((event) => event.type === "spatial_transition_committed")).toBe(true);
    const movedStateResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(movedStateResponse.ok()).toBeTruthy();
    expect((await movedStateResponse.json()) as { currentLocationId: string }).toMatchObject({
      currentLocationId: "ai_harbor",
    });
    const secondPrompt = capturedPrompt(provider.requests[1]);
    expect(secondPrompt).toContain("Current path: Shrouded Coast > Gloam Harbor");
    expect(secondPrompt).toContain("Current location ID: ai_harbor");
  } finally {
    try {
      await expectDeletedInOrder(page, [
        chat ? `/api/chats/${chat.id}?force=true` : null,
        character ? `/api/characters/${character.id}` : null,
        connection ? `/api/connections/${connection.id}` : null,
      ]);
    } finally {
      await provider.close();
    }
  }
});

test("Game generated map updates remain local beneath the hierarchical world location", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The generated-turn authority contract is viewport-independent.");
  test.setTimeout(90_000);
  const provider = await startOpenAiTestServer([
    `The party slips beneath the harbor warehouses.\n[map_update: new_location="Smuggler's Den" connected_to="Gloam Harbor" node_emoji="🕳️"]`,
  ]);
  let connection: { id: string } | null = null;
  let chat: { id: string } | null = null;
  const localMap = {
    id: "gloam-harbor-local",
    type: "node",
    name: "Gloam Harbor Local Map",
    description: "Tactical streets and interiors inside Gloam Harbor.",
    nodes: [
      {
        id: "gloam-harbor",
        emoji: "⚓",
        label: "Gloam Harbor",
        x: 50,
        y: 50,
        discovered: true,
        description: "The local harbor approach.",
      },
    ],
    edges: [],
    partyPosition: "gloam-harbor",
  };

  try {
    const connectionResponse = await page.request.post("/api/connections", {
      data: {
        name: `Game Maps Authority ${Date.now()}`,
        provider: "custom",
        baseUrl: provider.baseUrl,
        model: "maps-authority-e2e",
        apiKey: "maps-authority-e2e",
        treatAsLocalEndpoint: true,
      },
    });
    expect(connectionResponse.ok()).toBeTruthy();
    connection = (await connectionResponse.json()) as { id: string };
    const chatResponse = await page.request.post("/api/chats", {
      data: {
        name: "Game Generated-Turn Maps Authority",
        mode: "game",
        characterIds: [],
        connectionId: connection.id,
      },
    });
    expect(chatResponse.ok()).toBeTruthy();
    chat = (await chatResponse.json()) as { id: string };
    await activateHierarchicalMaps(page, chat.id);
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: `maps-authority-${chat.id}`,
        gameSessionStatus: "active",
        gameMap: localMap,
        gameMaps: [localMap],
        activeGameMapId: localMap.id,
        gameSystemPrompt: [
          "Run the game.",
          "<map_state>",
          "Map: Gloam Harbor Local Map",
          "Party position: Gloam Harbor",
          "</map_state>",
          "",
          "COMMANDS:",
          `- [map_update: new_location="Location Name" connected_to="Previous Location Name" node_emoji="emoji"] - only when the party arrives at an entirely new location on the current node map.`,
        ].join("\n"),
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    const saveResponse = await page.request.put(`/api/chats/${chat.id}/spatial-context`, {
      data: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition: { ...gameGeneratedDefinition, enabled: true },
      },
    });
    expect(saveResponse.ok()).toBeTruthy();

    const events = await generateTurn(page, {
      chatId: chat.id,
      connectionId: connection.id,
      userMessage: "Search below the harbor without leaving the current world location.",
    });
    expect(events.some((event) => event.type === "game_map_update")).toBe(true);

    const spatialResponse = await page.request.get(`/api/chats/${chat.id}/spatial-context`);
    expect(spatialResponse.ok()).toBeTruthy();
    expect((await spatialResponse.json()) as { currentLocationId: string }).toMatchObject({
      currentLocationId: "ai_world",
    });

    const storedChatResponse = await page.request.get(`/api/chats/${chat.id}`);
    expect(storedChatResponse.ok()).toBeTruthy();
    const storedChat = (await storedChatResponse.json()) as { metadata?: string | Record<string, unknown> };
    const metadata =
      typeof storedChat.metadata === "string"
        ? (JSON.parse(storedChat.metadata) as Record<string, unknown>)
        : (storedChat.metadata ?? {});
    const storedLocalMap = metadata.gameMap as {
      nodes?: Array<{ label?: string }>;
      partyPosition?: string;
    };
    expect(storedLocalMap.nodes?.some((node) => node.label === "Smuggler's Den")).toBe(true);
    expect(storedLocalMap.partyPosition).not.toBe("gloam-harbor");

    const prompt = capturedPrompt(provider.requests[0]);
    expect(prompt).toContain(`<spatial_context mode="game" authority="application">`);
    expect(prompt).toContain(`<local_map_state authority="tactical" world_location_source="spatial_context">`);
    expect(prompt).toContain("Generated prose, its party marker, and [map_update] commands cannot change the hierarchical world location");
  } finally {
    try {
      await expectDeletedInOrder(page, [
        chat ? `/api/chats/${chat.id}?force=true` : null,
        connection ? `/api/connections/${connection.id}` : null,
      ]);
    } finally {
      await provider.close();
    }
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
