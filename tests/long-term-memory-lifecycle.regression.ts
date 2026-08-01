import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runWithSafeCleanup } from "./regression-helpers.ts";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(
  process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"),
);
const catalogUrl = "https://1.1.1.1/catalog/catalog.json";
const packageManifest = JSON.parse(
  readFileSync(join(repoRoot, "packages/long-term-memory/manifest.json"), "utf8"),
) as { version: string };
const artifactPath = join(repoRoot, `artifacts/long-term-memory-${packageManifest.version}.zip`);
const artifactUrl = `https://1.1.1.1/artifacts/long-term-memory-${packageManifest.version}.zip`;
const artifactBytes = readFileSync(artifactPath);
function unzip(args: string[], purpose: string) {
  try {
    return execFileSync("unzip", args, { encoding: "utf8" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      throw new Error(`Cannot ${purpose}: unzip executable was not found; install unzip and retry.`);
    throw new Error(
      `Could not ${purpose}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
const artifactManifest = JSON.parse(
  unzip(["-p", artifactPath, "manifest.json"], `read ${artifactPath}/manifest.json`),
) as Record<string, unknown>;
const artifactClient = unzip(
  ["-p", artifactPath, "client.js"],
  `read ${artifactPath}/client.js`,
);
const originalFetch = globalThis.fetch;
let catalogOnline = true;

process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";
process.env.LOG_DISABLE_REQUEST_LOGGING = "true";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_AGENT_CATALOG_URL = catalogUrl;
process.env.MARINARA_LITE = "true";
process.env.NODE_ENV = "test";

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
function catalog() {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-18T00:00:00.000Z",
    packages: [
      {
        manifest: artifactManifest,
        category: "misc",
        artifact: {
          url: artifactUrl,
          sha256: sha256(artifactBytes),
          bytes: artifactBytes.byteLength,
        },
      },
    ],
  };
}
function snapshot(root: string) {
  const result = new Map<string, Buffer>();
  const visit = (current: string) => {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else result.set(relative(root, path), readFileSync(path));
    }
  };
  visit(root);
  return result;
}
function assertSnapshot(root: string, expected: Map<string, Buffer>) {
  const actual = snapshot(root);
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort());
  for (const [path, bytes] of expected)
    assert.deepEqual(actual.get(path), bytes, path);
}
async function importEngine<T>(relativePath: string): Promise<T> {
  return import(
    pathToFileURL(join(engineRoot, relativePath)).href
  ) as Promise<T>;
}
async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), "marinara-ltm-lifecycle-"));
  process.env.DATA_DIR = dataDir;
  process.env.MARINARA_ENV_FILE = join(dataDir, ".env");
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (!catalogOnline) throw new Error("LTM lifecycle fixture is offline");
    if (url === catalogUrl)
      return new Response(JSON.stringify(catalog()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    if (url === artifactUrl)
      return new Response(artifactBytes, { status: 200 });
    throw new Error(`Unexpected lifecycle URL: ${url}`);
  }) as typeof fetch;
  let app: {
    inject: (
      options: unknown,
    ) => Promise<{ statusCode: number; body: string; rawPayload: Buffer }>;
    close: () => Promise<void>;
  } | null = null;
  let browser: { close: () => Promise<void> } | null = null;
  let browserServer: ReturnType<typeof createServer> | null = null;
  await runWithSafeCleanup("LTM lifecycle", async () => {
    assert.equal(artifactManifest.id, "long-term-memory");
    assert.equal(artifactManifest.version, packageManifest.version);
    assert.doesNotMatch(
      artifactClient,
      /crypto\.randomUUID/u,
      "The mobile client must not require secure-context-only crypto.randomUUID",
    );
    const { chromium, devices } = await import(
      pathToFileURL(join(engineRoot, "node_modules/@playwright/test/index.mjs")).href,
    );
    const rejectedSuggestionId = "2a1b5c7d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
    let savedNote: Record<string, unknown> | null = null;
    let deletedSuggestionId: string | null = null;
    let healthState: "healthy" | "degraded" = "healthy";
    browserServer = createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const send = (status: number, body: unknown, contentType = "application/json") => {
        const payload = typeof body === "string" ? body : JSON.stringify(body);
        response.writeHead(status, { "content-type": contentType });
        response.end(payload);
      };
      if (url.pathname === "/")
        return send(200, `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><script type="module" src="/client.js"></script>`, "text/html");
      if (url.pathname === "/client.js") return send(200, artifactClient, "application/javascript");
      if (!url.pathname.startsWith("/api/long-term-memory/")) return send(404, {});
      if (request.method === "GET" && url.pathname.endsWith("/status"))
        return send(200, {
          initialized: true,
          directory: "long-term-memory",
          notes: { total: 3, byType: {}, byStatus: {} },
          events: { logAvailable: false, bytes: null },
          indexes: {
            health: healthState, dirty: false, rebuildState: "idle", errors: [], warnings: [],
            generatedAt: null, sourceHash: null, noteCount: 0, chunkCount: 12,
            chunkFormatVersion: 1, embeddingsAvailable: false, embeddedChunkCount: 0,
          },
        });
      if (request.method === "GET" && url.pathname.endsWith("/drafts/pending-count")) return send(200, { count: 2 });
      if (request.method === "GET" && url.pathname.endsWith("/scope-targets"))
        return send(200, { currentScope: null, chats: [], groups: [], characters: [] });
      if (request.method === "GET" && url.pathname.endsWith("/notes")) return send(200, []);
      if (request.method === "POST" && url.pathname.endsWith("/import/preview"))
        return send(200, { samples: [], scanned: 0, draftable: 0, importedCount: 0 });
      if (request.method === "POST" && url.pathname.endsWith("/import/lorebooks/preview"))
        return send(200, {
          counts: { books: 1, entries: 1, candidates: 1, pending: 1, imported: 0 },
          books: [{
            id: "lorebook_mobile_fixture",
            name: "Mobile Field Guide",
            description: "A populated lorebook used to verify responsive source browsing.",
            category: "Reference",
            tags: ["mobile", "test"],
            scope: {},
            counts: { entries: 1, candidates: 1, pending: 1, imported: 0 },
            entries: [{
              id: "entry_mobile_harbor",
              name: "Harbor Signals",
              candidateCount: 1,
              candidates: [{
                sourceId: "lorebook_mobile_fixture:entry_mobile_harbor:0",
                title: "Mobile Field Guide: Harbor Signals",
                mutationCount: 1,
                summary: "Harbor signal colors and their meanings.",
                snippet: "A blue lantern marks the safe channel after dusk.",
                status: "pending",
                freshness: "new",
              }],
            }],
          }],
        });
      if (request.method === "GET" && url.pathname.endsWith("/rejected-suggestions"))
        return send(200, {
          suggestions: [{
            id: rejectedSuggestionId,
            fingerprint: "a".repeat(64),
            source: { sourceNoteId: "source_mobile_recovery" },
            scope: {},
            modes: ["roleplay"],
            candidate: {
              index: 0, reason: "invalid_format", message: "A recoverable mobile memory.",
              snippet: "A recoverable mobile memory.",
              recovery: { noteType: "world", noteId: "world_mobile_recovery", sectionKey: "facts" },
            },
            createdAt: "2026-07-30T00:00:00.000Z",
            lastSeenAt: "2026-07-30T00:00:00.000Z",
          }],
          total: 1,
        });
      if (request.method === "POST" && url.pathname.endsWith("/notes")) {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        savedNote = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        return send(201, { note: { ...savedNote, createdAt: "2026-07-30T00:00:00.000Z", updatedAt: "2026-07-30T00:00:00.000Z", version: 1 } });
      }
      if (request.method === "DELETE" && url.pathname.includes("/rejected-suggestions/")) {
        deletedSuggestionId = decodeURIComponent(url.pathname.split("/").at(-1)!);
        return send(200, { deleted: true, id: deletedSuggestionId });
      }
      return send(404, {});
    });
    await new Promise<void>((resolveListen) => browserServer!.listen(0, "127.0.0.1", resolveListen));
    const address = browserServer.address();
    assert.ok(address && typeof address !== "string");
    browser = await chromium.launch();
    const browserContext = await browser.newContext({ hasTouch: true });
    const page = await browserContext.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(Crypto.prototype, "randomUUID", { configurable: true, value: undefined });
    });
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
    await page.evaluate((version) => {
      const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & { capabilityProps?: unknown };
      element.setAttribute("view", "detail");
      element.capabilityProps = { agent: { name: "Long-Term Memory" }, package: { version } };
      document.body.append(element);
    }, packageManifest.version);
    await page.locator('[data-ltm-surface="detail"]').waitFor();
    assert.equal(await page.locator('[data-ltm-surface="overview"]').count(), 0);
    assert.equal(await page.locator('[data-ltm-surface="vault-health-pill"]').count(), 0);
    const desktopNavigationLayout = await page
      .locator('[data-ltm-control="navigation"]').first()
      .evaluate((element) => {
        const navigation = element.closest("nav")!;
        const style = getComputedStyle(navigation);
        return {
          display: style.display,
          flexDirection: style.flexDirection,
          overflowX: style.overflowX,
          width: navigation.getBoundingClientRect().width,
          height: navigation.getBoundingClientRect().height,
        };
      });
    assert.notEqual(desktopNavigationLayout.display, "none");
    assert.notEqual(desktopNavigationLayout.flexDirection, "column");
    assert.equal(desktopNavigationLayout.overflowX, "auto");
    assert.ok(desktopNavigationLayout.width > 0);
    assert.ok(desktopNavigationLayout.height > 0);
    const desktopWorkspace = await page.locator("[data-ltm-workspace]").evaluate((element) => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(/\s+/u).length,
      visiblePanes: [...element.querySelectorAll<HTMLElement>("[data-ltm-workspace-pane]")]
        .filter((pane) => getComputedStyle(pane).display !== "none")
        .map((pane) => pane.dataset.ltmWorkspacePane),
    }));
    assert.equal(desktopWorkspace.columns, 2);
    assert.deepEqual(desktopWorkspace.visiblePanes, ["navigator", "workbench"]);
    await page.waitForFunction(() =>
      document.querySelectorAll("[data-ltm-workspace-pane-tab]").length === 0,
    );
    assert.equal(await page.locator('[data-ltm-surface="vault-health-warning"]').count(), 0);
    assert.deepEqual(
      await page.locator('[data-ltm-control="navigation"]').evaluateAll((elements) =>
        [...new Set(elements.map((element) => element.getAttribute("data-ltm-destination")))],
      ),
      ["vault", "review", "sources", "settings"],
    );

    await page.setViewportSize({ width: 390, height: 844 });
    healthState = "degraded";
    await page.reload();
    await page.evaluate((version) => {
      const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & { capabilityProps?: unknown };
      element.setAttribute("view", "detail");
      element.capabilityProps = { agent: { name: "Long-Term Memory" }, package: { version } };
      document.body.append(element);
    }, packageManifest.version);
    await page.locator('[data-ltm-surface="detail"]').waitFor();
    assert.equal(
      await page.locator('[data-ltm-control="navigation"]').last().evaluate((element) =>
        getComputedStyle(element.closest("nav")!).display !== "none",
      ),
      true,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      true,
    );
    assert.deepEqual(
      await page.locator('[data-ltm-navigation="mobile"] [data-ltm-badge]').evaluateAll((badges) =>
        badges.map((badge) => {
          const badgeRect = badge.getBoundingClientRect();
          const buttonRect = badge.closest("button")!.getBoundingClientRect();
          return {
            destination: badge.closest<HTMLButtonElement>("button")?.dataset.ltmDestination,
            top: badgeRect.top < buttonRect.top + buttonRect.height / 2,
            left: badgeRect.left < buttonRect.left + buttonRect.width / 2,
          };
        }).sort((left, right) => left.destination!.localeCompare(right.destination!)),
      ),
      [
        { destination: "review", top: true, left: true },
        { destination: "vault", top: true, left: true },
      ],
    );
    assert.equal(
      await page.locator('[data-ltm-workspace-pane-tab="workbench"]').count(),
      0,
    );
    assert.deepEqual(
      await page.locator("[data-ltm-workspace]").evaluate((workspace) => ({
        visiblePanes: [...workspace.querySelectorAll<HTMLElement>("[data-ltm-workspace-pane]")]
          .filter((pane) => getComputedStyle(pane).display !== "none")
          .map((pane) => pane.dataset.ltmWorkspacePane),
        scrollTop: document.scrollingElement?.scrollTop ?? 0,
      })),
      { visiblePanes: ["navigator"], scrollTop: 0 },
    );
    const navigatorPane = page.locator('[data-ltm-workspace-pane="navigator"]');
    const navigatorBox = await navigatorPane.boundingBox();
    assert.ok(navigatorBox);
    await page.locator('[data-ltm-surface="vault-health-warning"]').waitFor();
    assert.equal(
      await page.locator('[data-ltm-surface="vault-health-warning"] [data-ltm-info]').count(),
      1,
    );
    await page.locator('[data-ltm-surface="vault-health-warning"] [data-ltm-info]').click();
    const healthInfoPanel = page.locator('[data-ltm-info-panel]').last();
    await healthInfoPanel.waitFor();
    assert.match(await healthInfoPanel.innerText(), /12 indexed chunks/u);
    assert.match(await healthInfoPanel.innerText(), /Check Settings > Maintenance > Reindex recall data\./u);

    healthState = "healthy";
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload();
    await page.evaluate((version) => {
      const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & { capabilityProps?: unknown };
      element.setAttribute("view", "detail");
      element.capabilityProps = { agent: { name: "Long-Term Memory" }, package: { version } };
      document.body.append(element);
    }, packageManifest.version);
    await page.locator('[data-ltm-surface="detail"]').waitFor();
    assert.equal(await page.locator('[data-ltm-surface="vault-health-pill"]').count(), 0);
    assert.equal(await page.locator('[data-ltm-surface="vault-health-warning"]').count(), 0);
    await page.locator('[data-ltm-control="navigation"][data-ltm-destination="review"]').first().click();
    await page.locator(`[data-ltm-rejected-suggestion="${rejectedSuggestionId}"]`).waitFor();
    await page.getByRole("button", { name: /^Recover suggestion:/u }).click();
    await page.locator("[data-ltm-note-editor]").waitFor();
    await page.locator("[data-ltm-details-toggle]").click();
    await page.waitForFunction(() =>
      document.querySelectorAll("[data-ltm-workspace-pane-tab]").length === 0,
    );
    assert.equal(await page.locator("[data-ltm-workspace-pane-tab]").count(), 0);
    assert.equal(await page.locator('[data-ltm-workspace-pane][role="tabpanel"]').count(), 0);
    const wideVaultLayout = await page.locator("[data-ltm-workspace]").evaluate((element) => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(/\s+/u).length,
      editorVisible: getComputedStyle(element.querySelector<HTMLElement>('[data-ltm-workspace-pane="workbench"]')!).display !== "none",
      inspectorVisible: getComputedStyle(element.querySelector<HTMLElement>('[data-ltm-workspace-pane="inspector"]')!).display !== "none",
    }));
    assert.deepEqual(wideVaultLayout, { columns: 3, editorVisible: true, inspectorVisible: true });
    await page.setViewportSize({ width: 900, height: 844 });
    await page.waitForFunction(() =>
      document.querySelectorAll("[data-ltm-workspace-pane-tab]").length === 2,
    );
    assert.deepEqual(
      await page.locator("[data-ltm-workspace-pane-tab]").evaluateAll((tabs) =>
        tabs.map((tab) => ({
          pane: tab.getAttribute("data-ltm-workspace-pane-tab"),
          controls: tab.getAttribute("aria-controls"),
        })),
      ),
      [
        { pane: "workbench", controls: await page.locator('[data-ltm-workspace-pane="workbench"]').getAttribute("id") },
        { pane: "inspector", controls: await page.locator('[data-ltm-workspace-pane="inspector"]').getAttribute("id") },
      ],
    );
    const workbenchTab = page.locator('[data-ltm-workspace-pane-tab="workbench"]');
    await workbenchTab.focus();
    await workbenchTab.press("End");
    await page.waitForFunction(
      () => {
        const tab = document.querySelector('[data-ltm-workspace-pane-tab="inspector"]');
        return document.activeElement === tab && tab?.getAttribute("aria-selected") === "true";
      },
    );
    await page.locator("[data-ltm-note-inspector]").waitFor({ state: "visible" });
    await page.locator('[data-ltm-workspace-pane-tab="inspector"]').press("Home");
    await page.waitForFunction(() =>
      document.activeElement?.getAttribute("data-ltm-workspace-pane-tab") === "workbench",
    );
    await page.locator('[data-ltm-details-toggle]').click();
    await page.waitForFunction(() => {
      const tab = document.querySelector('[data-ltm-workspace-pane-tab="workbench"]');
      return (
        (document.activeElement === tab && tab?.getAttribute("aria-selected") === "true") ||
        document.activeElement?.getAttribute("data-ltm-workspace-pane") === "workbench"
      );
    });
    await page.locator('[data-ltm-details-toggle]').click();
    await page.waitForFunction(() => {
      const tab = document.querySelector('[data-ltm-workspace-pane-tab="inspector"]');
      return document.activeElement === tab && tab?.getAttribute("aria-selected") === "true";
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "20px";
    });
    await page.setViewportSize({ width: 900, height: 844 });
    await page.waitForFunction(() =>
      document.querySelectorAll("[data-ltm-workspace-pane-tab]").length === 3,
    );
    assert.deepEqual(
      await page.locator("[data-ltm-workspace-pane-tab]").evaluateAll((tabs) =>
        tabs.map((tab) => tab.getAttribute("data-ltm-workspace-pane-tab")),
      ),
      ["navigator", "workbench", "inspector"],
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    page.once("dialog", (dialog) => void dialog.accept());
    await page.locator('[data-ltm-control="navigation"][data-ltm-destination="review"]').first().click();
    await page.locator(`[data-ltm-rejected-suggestion="${rejectedSuggestionId}"]`).waitFor();
    await page.getByRole("button", { name: /^Recover suggestion:/u }).click();
    await page.locator("[data-ltm-note-editor]").waitFor();
    assert.equal(
      await page.locator("[data-ltm-details-toggle]").getAttribute("aria-pressed"),
      "false",
    );
    assert.equal(await page.locator('[data-ltm-workspace-pane="inspector"]').count(), 0);
    const cleanupRequest = page.waitForRequest(
      (request) => request.method() === "DELETE" && request.url().includes(`/rejected-suggestions/${rejectedSuggestionId}`),
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await cleanupRequest;
    await page.locator('[data-ltm-status="success"]').waitFor();
    assert.equal((await page.locator('[role="alert"]').count()), 0);
    assert.equal(deletedSuggestionId, rejectedSuggestionId);
    assert.equal(savedNote?.type, "world");
    await page.locator('[data-ltm-control="navigation"][data-ltm-destination="sources"]').first().click();
    await page.locator('[data-ltm-source-tab="lorebooks"]').click();
    const sourcesWorkspace = page.locator('[data-ltm-surface="sources"] [data-ltm-workspace]');
    await sourcesWorkspace.waitFor();
    assert.equal(
      await sourcesWorkspace.evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(/\s+/u).length,
      ),
      2,
    );
    await page.locator('[data-ltm-lorebook-id="lorebook_mobile_fixture"]').click();
    assert.equal(
      await page.locator('[data-ltm-lorebook-workbench="lorebook_mobile_fixture"]').isVisible(),
      true,
    );
    await page.locator('[data-ltm-lorebook-entry="entry_mobile_harbor"]').waitFor();
    assert.match(
      await page.locator('[data-ltm-lorebook-entry="entry_mobile_harbor"]').innerText(),
      /blue lantern marks the safe channel/u,
    );

    const mobileContext = await browser.newContext({ ...devices["Pixel 7"] });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`http://127.0.0.1:${address.port}/`);
    await mobilePage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
    await mobilePage.evaluate((version) => {
      const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & { capabilityProps?: unknown };
      element.setAttribute("view", "detail");
      element.capabilityProps = { agent: { name: "Long-Term Memory" }, package: { version } };
      document.body.append(element);
    }, packageManifest.version);
    await mobilePage.locator('[data-ltm-surface="detail"]').waitFor();
    const mobileNavigation = mobilePage.locator('[data-ltm-navigation="mobile"]');
    const mobileNavigationItems = mobileNavigation.locator('[data-ltm-control="navigation"]');
    assert.equal(await mobileNavigationItems.count(), 4);
    for (const destination of ["vault", "review", "sources", "settings"])
      assert.equal(
        await mobileNavigation.locator(`[data-ltm-destination="${destination}"]`).count(),
        1,
      );
    assert.deepEqual(
      await mobileNavigation.evaluate((navigation) => {
        const rect = navigation.getBoundingClientRect();
        const itemRects = [...navigation.querySelectorAll<HTMLElement>('[data-ltm-control="navigation"]')]
          .map((item) => item.getBoundingClientRect());
        return {
          visible: getComputedStyle(navigation).display !== "none" && rect.width > 0 && rect.height > 0,
          fillsParent: Math.abs(rect.width - navigation.parentElement!.getBoundingClientRect().width) < 1,
          equalItems: Math.max(...itemRects.map((item) => item.width)) - Math.min(...itemRects.map((item) => item.width)) < 1,
          fillsBar: Math.abs(itemRects[0].left - rect.left) < 1 && Math.abs(itemRects.at(-1)!.right - rect.right) < 1,
        };
      }),
      { visible: true, fillsParent: true, equalItems: true, fillsBar: true },
    );
    await mobileNavigation.locator('[data-ltm-destination="sources"]').click();
    await mobilePage.locator('[data-ltm-source-tab="lorebooks"]').click();
    await mobilePage.locator('[data-ltm-lorebook-id="lorebook_mobile_fixture"]').click();
    const mobileSourcesWorkspace = mobilePage.locator('[data-ltm-surface="sources"] [data-ltm-workspace]');
    assert.deepEqual(
      await mobileSourcesWorkspace.evaluate((workspace) => ({
        innerWidth,
        mobileMedia: matchMedia("(max-width: 767px)").matches,
        visiblePanes: [...workspace.querySelectorAll<HTMLElement>("[data-ltm-workspace-pane]")]
          .filter((pane) => getComputedStyle(pane).display !== "none")
          .map((pane) => pane.dataset.ltmWorkspacePane),
      })),
      {
        innerWidth: 412,
        mobileMedia: true,
        visiblePanes: ["workbench"],
      },
    );
    await mobilePage.locator('[data-ltm-lorebook-entry="entry_mobile_harbor"]').waitFor();
    assert.equal(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      true,
    );
    await mobileContext.close();
    const { capabilityPackageManager } = await importEngine<{
      capabilityPackageManager: {
        install(
          id: string,
          expectedVersion?: string,
        ): Promise<{ version: string; previousVersion?: string }>;
        uninstall(id: string): Promise<unknown>;
      };
    }>(
      "packages/server/src/services/capability-packages/package-manager.service.ts",
    );
    const { buildApp } = await importEngine<{
      buildApp(): Promise<typeof app>;
    }>("packages/server/src/app.ts");
    const installed =
      await capabilityPackageManager.install("long-term-memory");
    assert.equal(installed.version, artifactManifest.version);
    catalogOnline = false;
    app = await buildApp();
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/long-term-memory/status" }))
        .statusCode,
      200,
    );
    const note = {
      id: "world_artifact_lifecycle",
      title: "Artifact lifecycle fixture",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: {},
      tags: ["artifact_lifecycle"],
      keywords: ["artifact", "lifecycle"],
      links: [],
      sections: {
        facts: {
          text: "Exact artifact lifecycle fact survives uninstall and reinstall.",
          updatedAt: "2026-07-18T00:00:00.000Z",
        },
      },
    };
    const created = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers: { "x-marinara-csrf": "1" },
      payload: note,
    });
    assert.equal(created.statusCode, 201, created.body);
    const durableRoot = join(dataDir, "long-term-memory");
    const beforeRestart = snapshot(durableRoot);
    await app.close();
    app = null;
    app = await buildApp();
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/notes/world_artifact_lifecycle",
        })
      ).statusCode,
      200,
    );
    assertSnapshot(durableRoot, beforeRestart);
    const legacyStatePath = join(durableRoot, "indexes/state.json");
    const legacyState = JSON.parse(readFileSync(legacyStatePath, "utf8"));
    writeFileSync(
      legacyStatePath,
      JSON.stringify({ ...legacyState, lastPublishedGenerationId: "legacy-generation" }),
    );
    const backup = await app.inject({
      method: "POST",
      url: "/api/backup/download",
      headers: { "x-marinara-csrf": "1" },
    });
    assert.equal(backup.statusCode, 200, backup.body);
    const backupPath = join(dataDir, "ltm-lifecycle-backup.zip");
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(backupPath, backup.rawPayload);
    assert.match(
      unzip(["-Z1", backupPath], `inspect ${backupPath}`),
      /long-term-memory\/vault\/world\/world_artifact_lifecycle\.json/u,
    );
    await app.close();
    app = null;
    const afterMigration = snapshot(durableRoot);
    await capabilityPackageManager.uninstall("long-term-memory");
    assert.ok(
      !existsSync(
        join(dataDir, "capability-packages/versions/long-term-memory"),
      ),
    );
    assertSnapshot(durableRoot, afterMigration);
    catalogOnline = true;
    const reinstalled =
      await capabilityPackageManager.install("long-term-memory");
    assert.equal(reinstalled.version, artifactManifest.version);
    catalogOnline = false;
    app = await buildApp();
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/long-term-memory/status" }))
        .statusCode,
      200,
    );
    assertSnapshot(durableRoot, afterMigration);
    console.log(
      `Long-Term Memory ${packageManifest.version} lifecycle: install, offline restart, backup inclusion, uninstall, reinstall, and durable-byte preservation ok`,
    );
  }, [
    () => browser?.close(),
    () => new Promise<void>((resolveClose, reject) => {
      if (!browserServer) return resolveClose();
      browserServer.close((error) => error ? reject(error) : resolveClose());
    }),
    () => app?.close(),
    () => { globalThis.fetch = originalFetch; },
    () => rmSync(dataDir, { recursive: true, force: true }),
  ]);
}
main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
