import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(
  process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"),
);
const dataDir = mkdtempSync(join(tmpdir(), "marinara-maps-lifecycle-"));
const catalogUrl = "https://1.1.1.1/catalog/catalog.json";
const csrfHeaders = { "x-marinara-csrf": "1" };
const originalFetch = globalThis.fetch;

process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";
process.env.DATA_DIR = dataDir;
process.env.LOG_DISABLE_REQUEST_LOGGING = "true";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_AGENT_CATALOG_URL = catalogUrl;
process.env.MARINARA_ENV_FILE = join(dataDir, ".env");
process.env.MARINARA_LITE = "true";
process.env.NODE_ENV = "test";

type Manifest = {
  id: string;
  name: string;
  version: string;
  [key: string]: unknown;
};

type ArtifactFixture = {
  bytes: Buffer;
  manifest: Manifest;
  url: string;
};

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function artifactFixture(version: string): ArtifactFixture {
  const path = join(repoRoot, "artifacts", `hierarchical-maps-${version}.zip`);
  assert.ok(
    existsSync(path),
    `Missing exact Maps ${version} artifact at ${path}`,
  );
  const bytes = readFileSync(path);
  const manifest = JSON.parse(
    execFileSync("unzip", ["-p", path, "manifest.json"], { encoding: "utf8" }),
  ) as Manifest;
  assert.equal(manifest.id, "hierarchical-maps");
  assert.equal(manifest.version, version);
  return {
    bytes,
    manifest,
    url: `https://1.1.1.1/artifacts/hierarchical-maps-${version}.zip`,
  };
}

const fixtures = new Map(
  [artifactFixture("1.0.5"), artifactFixture("1.0.6")].map((fixture) => [
    fixture.manifest.version,
    fixture,
  ]),
);
let catalogVersion = "1.0.5";
let catalogOnline = true;

function catalogFixture(version: string) {
  const fixture = fixtures.get(version);
  assert.ok(fixture, `Missing catalog fixture for Maps ${version}`);
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-15T00:00:00.000Z",
    packages: [
      {
        manifest: fixture.manifest,
        category: "tracker",
        artifact: {
          url: fixture.url,
          sha256: sha256(fixture.bytes),
          bytes: fixture.bytes.byteLength,
        },
        documentationUrl:
          "https://github.com/Pasta-Devs/Marinara-Agents#hierarchical-maps",
      },
    ],
  };
}

globalThis.fetch = (async (input: string | URL | Request) => {
  if (!catalogOnline) throw new Error("Lifecycle fixture is offline");
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  if (url === catalogUrl) {
    return new Response(JSON.stringify(catalogFixture(catalogVersion)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  const fixture = [...fixtures.values()].find(
    (candidate) => candidate.url === url,
  );
  if (fixture) {
    return new Response(fixture.bytes, {
      status: 200,
      headers: { "content-type": "application/zip" },
    });
  }
  throw new Error(`Unexpected lifecycle fetch: ${url}`);
}) as typeof fetch;

async function importEngine<T>(relativePath: string): Promise<T> {
  const url = pathToFileURL(resolve(engineRoot, relativePath)).href;
  return import(url) as Promise<T>;
}

async function expectJson(
  app: {
    inject(
      options: Record<string, unknown>,
    ): Promise<{ statusCode: number; body: string }>;
  },
  options: Record<string, unknown>,
  statusCode = 200,
) {
  const response = await app.inject(options);
  assert.equal(response.statusCode, statusCode, response.body);
  return response.body ? (JSON.parse(response.body) as unknown) : null;
}

function metadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

const definition = {
  schemaVersion: 1,
  ownerMode: "roleplay",
  enabled: true,
  revision: 0,
  startingLocationId: "lifecycle_world",
  locations: [
    {
      id: "lifecycle_world",
      parentId: null,
      name: "Lifecycle World",
      kind: "region",
      description: "A world used to prove package lifecycle preservation.",
      modelMemory: "The package lifecycle must not erase this location.",
      icon: "🌍",
      childPresentation: "list",
      links: [],
      status: "active",
      sortOrder: 0,
    },
    {
      id: "lifecycle_harbor",
      parentId: "lifecycle_world",
      name: "Lifecycle Harbor",
      kind: "settlement",
      description: "A destination retained across package changes.",
      modelMemory: "The harbor proves restored definitions retain stable IDs.",
      icon: "⚓",
      childPresentation: "list",
      links: [],
      status: "active",
      sortOrder: 0,
    },
  ],
};

async function main() {
  let app: Awaited<
    ReturnType<
      (typeof import("../../Marinara-Engine/packages/server/src/app.js"))["buildApp"]
    >
  > | null = null;

  try {
    const { capabilityPackageManager } = await importEngine<{
      capabilityPackageManager: {
        install(id: string): Promise<{
          version: string;
          status: string;
          previousVersion?: string;
        }>;
        installed(): Promise<
          Array<{
            id: string;
            version: string;
            status: string;
            readiness: string;
          }>
        >;
      };
    }>(
      "packages/server/src/services/capability-packages/package-manager.service.ts",
    );
    const { buildApp } = await importEngine<{
      buildApp(): Promise<NonNullable<typeof app>>;
    }>("packages/server/src/app.ts");

    const installed105 =
      await capabilityPackageManager.install("hierarchical-maps");
    assert.equal(installed105.version, "1.0.5");
    assert.equal(installed105.status, "restart-required");

    catalogVersion = "1.0.6";
    const installed106 =
      await capabilityPackageManager.install("hierarchical-maps");
    assert.equal(installed106.version, "1.0.6");
    assert.equal(installed106.previousVersion, "1.0.5");
    assert.ok(
      existsSync(
        join(
          dataDir,
          "capability-packages",
          "versions",
          "hierarchical-maps",
          "1.0.5",
        ),
      ),
    );
    assert.ok(
      existsSync(
        join(
          dataDir,
          "capability-packages",
          "versions",
          "hierarchical-maps",
          "1.0.6",
        ),
      ),
    );

    catalogOnline = false;
    app = await buildApp();
    const firstHealth = (await expectJson(app, {
      method: "GET",
      url: "/api/health",
    })) as {
      capabilityPackages: {
        status: string;
        packages: Array<{
          id: string;
          version: string;
          status: string;
          readiness: string;
          ready: boolean;
        }>;
      };
    };
    assert.equal(firstHealth.capabilityPackages.status, "ok");
    assert.deepEqual(
      firstHealth.capabilityPackages.packages
        .filter((entry) => entry.id === "hierarchical-maps")
        .map((entry) => ({
          version: entry.version,
          status: entry.status,
          readiness: entry.readiness,
          ready: entry.ready,
        })),
      [{ version: "1.0.6", status: "active", readiness: "ready", ready: true }],
    );

    const created = (await expectJson(app, {
      method: "POST",
      url: "/api/chats",
      headers: csrfHeaders,
      payload: {
        name: "Hierarchical Maps lifecycle fixture",
        mode: "roleplay",
        characterIds: [],
      },
    })) as { id: string };
    const chatId = created.id;

    await expectJson(app, {
      method: "PATCH",
      url: `/api/chats/${chatId}/metadata`,
      headers: csrfHeaders,
      payload: { enableAgents: true, activeAgentIds: ["hierarchical-maps"] },
    });
    await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/messages`,
      headers: csrfHeaders,
      payload: {
        role: "assistant",
        content: "The lifecycle begins in a persistent world.",
      },
    });
    const saved = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${chatId}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition,
      },
    })) as { currentLocationId: string; hasCommittedSpatialHistory: boolean };
    assert.equal(saved.currentLocationId, "lifecycle_world");
    assert.equal(saved.hasCommittedSpatialHistory, true);

    await app.close();
    app = null;

    // Restart with every catalog/artifact fetch rejected. The installed package must
    // activate from disk and retain both its definition and spatial snapshot.
    app = await buildApp();
    const restarted = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}/spatial-context`,
    })) as {
      currentLocationId: string;
      definition: { locations: Array<{ id: string }> };
    };
    assert.equal(restarted.currentLocationId, "lifecycle_world");
    assert.ok(
      restarted.definition.locations.some(
        (location) => location.id === "lifecycle_harbor",
      ),
    );

    const backupResponse = await app.inject({
      method: "POST",
      url: "/api/backup/download",
      headers: csrfHeaders,
    });
    assert.equal(backupResponse.statusCode, 200, backupResponse.body);
    const backupPath = join(dataDir, "hierarchical-maps-lifecycle-backup.zip");
    writeFileSync(backupPath, backupResponse.rawPayload);
    const backupEntries = execFileSync("unzip", ["-Z1", backupPath], {
      encoding: "utf8",
    });
    assert.match(backupEntries, /\/marinara-profile\.json$/mu);
    assert.match(backupEntries, /\/storage\//mu);

    await expectJson(app, {
      method: "DELETE",
      url: "/api/capability-packages/hierarchical-maps",
      headers: csrfHeaders,
    });
    const chatAfterRemoval = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}`,
    })) as {
      metadata: unknown;
    };
    const retainedMetadata = metadata(chatAfterRemoval.metadata);
    assert.ok(
      retainedMetadata.spatialContext,
      "Uninstall must retain the spatial definition in chat metadata",
    );
    assert.deepEqual(
      retainedMetadata.activeAgentIds,
      [],
      "Uninstall should detach the package without deleting map data",
    );

    await app.close();
    app = null;
    app = await buildApp();
    await expectJson(
      app,
      { method: "GET", url: `/api/chats/${chatId}/spatial-context` },
      404,
    );
    const unavailableChat = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}`,
    })) as {
      metadata: unknown;
    };
    assert.ok(metadata(unavailableChat.metadata).spatialContext);
    await app.close();
    app = null;

    catalogOnline = true;
    const reinstalled =
      await capabilityPackageManager.install("hierarchical-maps");
    assert.equal(reinstalled.version, "1.0.6");
    assert.equal(reinstalled.status, "restart-required");
    catalogOnline = false;
    app = await buildApp();
    const stateAfterReinstall = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(stateAfterReinstall.currentLocationId, "lifecycle_world");

    await expectJson(
      app,
      {
        method: "DELETE",
        url: `/api/chats/${chatId}?force=true`,
        headers: csrfHeaders,
      },
      204,
    );
    await expectJson(app, { method: "GET", url: `/api/chats/${chatId}` }, 404);

    const boundary = `marinara-maps-lifecycle-${Date.now()}`;
    const multipartPrefix = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="maps-backup.zip"\r\nContent-Type: application/zip\r\n\r\n`,
    );
    const multipartSuffix = Buffer.from(`\r\n--${boundary}--\r\n`);
    const backupBytes = readFileSync(backupPath);
    const multipartBody = Buffer.concat([
      multipartPrefix,
      backupBytes,
      multipartSuffix,
    ]);
    const restored = (await expectJson(app, {
      method: "POST",
      url: "/api/backup/import-profile",
      headers: {
        ...csrfHeaders,
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(multipartBody.byteLength),
      },
      payload: multipartBody,
    })) as { success: boolean };
    assert.equal(restored.success, true);

    const chats = (await expectJson(app, {
      method: "GET",
      url: "/api/chats",
    })) as Array<{
      id: string;
      name: string;
    }>;
    const restoredChat = chats.find(
      (chat) => chat.name === "Hierarchical Maps lifecycle fixture",
    );
    assert.ok(restoredChat, "Full backup restore must recreate the Maps chat");
    const restoredState = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${restoredChat.id}/spatial-context`,
    })) as {
      currentLocationId: string;
      definition: { locations: Array<{ id: string }> };
    };
    assert.equal(restoredState.currentLocationId, "lifecycle_world");
    assert.ok(
      restoredState.definition.locations.some(
        (location) => location.id === "lifecycle_harbor",
      ),
    );

    const finalInstalled = await capabilityPackageManager.installed();
    assert.deepEqual(
      finalInstalled
        .filter((entry) => entry.id === "hierarchical-maps")
        .map((entry) => ({
          version: entry.version,
          status: entry.status,
          readiness: entry.readiness,
        })),
      [{ version: "1.0.6", status: "active", readiness: "ready" }],
    );

    console.info(
      "Hierarchical Maps exact-artifact lifecycle regression passed: update, offline restart, remove, reinstall, backup, and restore.",
    );
  } finally {
    if (app) await app.close().catch(() => undefined);
    globalThis.fetch = originalFetch;
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
