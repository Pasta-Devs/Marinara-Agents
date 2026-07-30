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
    const { chromium } = await import(
      pathToFileURL(join(engineRoot, "node_modules/@playwright/test/index.mjs")).href,
    );
    const rejectedSuggestionId = "2a1b5c7d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
    let savedNote: Record<string, unknown> | null = null;
    let deletedSuggestionId: string | null = null;
    browserServer = createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const send = (status: number, body: unknown, contentType = "application/json") => {
        const payload = typeof body === "string" ? body : JSON.stringify(body);
        response.writeHead(status, { "content-type": contentType });
        response.end(payload);
      };
      if (url.pathname === "/")
        return send(200, `<!doctype html><script type="module" src="/client.js"></script>`, "text/html");
      if (url.pathname === "/client.js") return send(200, artifactClient, "application/javascript");
      if (!url.pathname.startsWith("/api/long-term-memory/")) return send(404, {});
      if (request.method === "GET" && url.pathname.endsWith("/status"))
        return send(200, {
          initialized: true,
          directory: "long-term-memory",
          notes: { total: 0, byType: {}, byStatus: {} },
          events: { logAvailable: false, bytes: null },
          indexes: {
            health: "healthy", dirty: false, rebuildState: "idle", errors: [], warnings: [],
            generatedAt: null, sourceHash: null, noteCount: 0, chunkCount: 0,
            chunkFormatVersion: 1, embeddingsAvailable: false, embeddedChunkCount: 0,
          },
        });
      if (request.method === "GET" && url.pathname.endsWith("/drafts/pending-count")) return send(200, { count: 0 });
      if (request.method === "GET" && url.pathname.endsWith("/scope-targets"))
        return send(200, { currentScope: null, chats: [], groups: [], characters: [] });
      if (request.method === "GET" && url.pathname.endsWith("/notes")) return send(200, []);
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
    const page = await browser.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(Crypto.prototype, "randomUUID", { configurable: true, value: undefined });
    });
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
    await page.evaluate(() => {
      const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & { capabilityProps?: unknown };
      element.setAttribute("view", "detail");
      element.capabilityProps = { agent: { name: "Long-Term Memory" }, package: { version: "1.0.2" } };
      document.body.append(element);
    });
    await page.locator('[data-ltm-surface="detail"]').waitFor();
    await page.locator('[data-ltm-control="navigation"][data-ltm-destination="review"]').first().click();
    await page.locator(`[data-ltm-rejected-suggestion="${rejectedSuggestionId}"]`).waitFor();
    await page.getByRole("button", { name: /^Recover suggestion:/u }).click();
    await page.locator("[data-ltm-note-editor]").waitFor();
    const cleanupRequest = page.waitForRequest(
      (request) => request.method() === "DELETE" && request.url().includes(`/rejected-suggestions/${rejectedSuggestionId}`),
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await cleanupRequest;
    await page.locator('[data-ltm-status="success"]').waitFor();
    assert.equal((await page.locator('[role="alert"]').count()), 0);
    assert.equal(deletedSuggestionId, rejectedSuggestionId);
    assert.equal(savedNote?.type, "world");
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
