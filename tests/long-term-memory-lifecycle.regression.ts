import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runWithSafeCleanup } from "./regression-helpers.ts";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const catalogUrl = "https://1.1.1.1/catalog/catalog.json";
const packageManifest = JSON.parse(readFileSync(join(repoRoot, "packages/long-term-memory/manifest.json"), "utf8")) as {
  version: string;
};
const artifactPath = join(repoRoot, `artifacts/long-term-memory-${packageManifest.version}.zip`);
const artifactUrl = `https://1.1.1.1/artifacts/long-term-memory-${packageManifest.version}.zip`;
const artifactBytes = readFileSync(artifactPath);
function unzip(args: string[], purpose: string) {
  try {
    return execFileSync("unzip", args, { encoding: "utf8" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      throw new Error(`Cannot ${purpose}: unzip executable was not found; install unzip and retry.`);
    throw new Error(`Could not ${purpose}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}
const artifactManifest = JSON.parse(
  unzip(["-p", artifactPath, "manifest.json"], `read ${artifactPath}/manifest.json`),
) as Record<string, unknown>;
const artifactClient = unzip(["-p", artifactPath, "client.js"], `read ${artifactPath}/client.js`);
const engineStyles = readFileSync(join(engineRoot, "packages/client/src/styles/globals.css"), "utf8");
const activationFixtureStyles = `
  [data-ltm-surface="detail"] .hidden { display: none; }
  @media (min-width: 768px) {
    [data-ltm-surface="detail"] .md\\:flex { display: flex; }
  }
  @media (min-width: 1024px) {
    [data-ltm-surface="detail"] .lg\\:inline { display: inline; }
  }
`;
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
function assertCatalogArtifact() {
  for (const relativePath of ["catalog/catalog.json", "catalog/v2/catalog.json", "catalog/v3/catalog.json"]) {
    const catalog = JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8")) as {
      packages: Array<{
        manifest?: { id?: string; version?: string };
        artifact?: { url?: string; sha256?: string; bytes?: number };
      }>;
    };
    const entry = catalog.packages.find((item) => item.manifest?.id === "long-term-memory");
    assert.ok(entry, `${relativePath} must contain Long-Term Memory`);
    assert.equal(entry.manifest?.version, packageManifest.version);
    assert.equal(
      entry.artifact?.url,
      `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/long-term-memory-${packageManifest.version}.zip`,
    );
    assert.equal(entry.artifact?.sha256, sha256(artifactBytes));
    assert.equal(entry.artifact?.bytes, artifactBytes.byteLength);
  }
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
  for (const [path, bytes] of expected) assert.deepEqual(actual.get(path), bytes, path);
}
async function importEngine<T>(relativePath: string): Promise<T> {
  return import(pathToFileURL(join(engineRoot, relativePath)).href) as Promise<T>;
}
async function main() {
  const { labelKeys, localizedLabel } = await import(
    pathToFileURL(
      join(
        repoRoot,
        "packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/display-labels.ts",
      ),
    ).href
  );
  const testLocalize = (key: string) => `translated:${key}`;
  assert.equal(
    localizedLabel("critical", testLocalize, labelKeys.importance),
    "translated:ui.longTermMemory.memoryvault.critical",
  );
  assert.equal(
    localizedLabel("roleplay", testLocalize, labelKeys.mode),
    "translated:ui.longTermMemory.sourcesworkspace.roleplay",
  );
  assert.equal(localizedLabel("future_value", testLocalize, labelKeys.mode), "Future value");
  const dataDir = mkdtempSync(join(tmpdir(), "marinara-ltm-lifecycle-"));
  process.env.DATA_DIR = dataDir;
  process.env.MARINARA_ENV_FILE = join(dataDir, ".env");
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!catalogOnline) throw new Error("LTM lifecycle fixture is offline");
    if (url === catalogUrl)
      return new Response(JSON.stringify(catalog()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    if (url === artifactUrl) return new Response(artifactBytes, { status: 200 });
    throw new Error(`Unexpected lifecycle URL: ${url}`);
  }) as typeof fetch;
  let app: {
    inject: (options: unknown) => Promise<{ statusCode: number; body: string; rawPayload: Buffer }>;
    close: () => Promise<void>;
  } | null = null;
  let browser: { close: () => Promise<void> } | null = null;
  let browserServer: ReturnType<typeof createServer> | null = null;
  let releaseReextraction: (() => void) | null = null;
  await runWithSafeCleanup(
    "LTM lifecycle",
    async () => {
      assert.equal(artifactManifest.id, "long-term-memory");
      assert.equal(artifactManifest.version, packageManifest.version);
      assertCatalogArtifact();
      assert.match(
        String(artifactManifest.description),
        /Chat Settings → Agents → Long-Term Memory/u,
        "Long-Term Memory guidance must name its dedicated activation path",
      );
      assert.doesNotMatch(
        String(artifactManifest.description),
        /Misc Agents for Conversation/u,
        "Long-Term Memory guidance must not send Conversation users to Misc Agents",
      );
      assert.doesNotMatch(
        artifactClient,
        /crypto\.randomUUID/u,
        "The mobile client must not require secure-context-only crypto.randomUUID",
      );
      assert.doesNotMatch(
        artifactClient,
        /1\. Import source -> 2\. Review proposals -> 3\. Accept saved memories -> 4\. Activate recall in chat/u,
        "Workflow guidance must remain contextual rather than repeated on each destination",
      );
      for (const copy of [
        "accepted proposals become recallable.",
        "Stable appearance can help the character remain visually consistent",
        "This source note preserves imported material as audit evidence. It is not recalled directly; accepted memories created from it appear below.",
        "Saving something does not mean it shows up in every reply.",
        "Import a character",
        "Note: You can use any summary.",
        "Open Summary Prompt, then Chat Summary.",
        "Open Prompt Preset Editor.",
        "Add an Agent Section for Long-Term Memory.",
        "Correct and save anything worth keeping, delete the rest.",
        "When you get a response, peek the prompt and make sure the memories are reaching your chat context.",
        "Under the Hood",
        "Choose What to Remember",
        "Review Before Saving",
        "Check What the Chat Used",
        "Enabling It for the Current Chat",
        "Writing to memory (Extraction)",
        "Reading from memory (Recall)",
        "Close",
      ])
        assert.ok(artifactClient.includes(copy), `Generated client is missing: ${copy}`);
      assert.doesNotMatch(
        artifactClient,
        /gentlest on-ramp/u,
        "The removed Character recommendation must not return to the wizard",
      );
      for (const copy of [
        "Review what extraction found.",
        "Keeps the character card as a source note",
        "For chat-summary imports, first pick",
        "Keeps selected lorebook entries as source notes",
      ])
        assert.ok(!artifactClient.includes(copy), `Generated client retains removed guidance: ${copy}`);
      for (const copy of [
        "Chat",
        "Persona",
        "Occurred in",
        "Already applicable",
        "Rebuilt",
        "Back to Agents",
        "Add memories",
        "Clear memory search",
        "Remove {{value1}} detail",
        "{{mutation}}: {{title}}",
      ])
        assert.ok(artifactClient.includes(copy), `Generated client is missing localization alignment copy: ${copy}`);
      assert.match(
        artifactClient,
        /backToAgents|Back to Agents/u,
        "The generated client must retain the localized Back control label",
      );
      assert.match(
        artifactClient,
        /reExtractValue1|Re-extract \{\{value1\}\}/u,
        "The generated client must retain source-specific mobile re-extract labels",
      );
      assert.match(
        artifactClient,
        /extract:(?:\w+\.)?\w+!=="refresh"/u,
        "Normal imports must continue extracting source notes",
      );
      assert.match(
        artifactClient,
        /Default agent connection/u,
        "The null extraction connection option must identify the default agent connection",
      );
      const { chromium, devices } = await import(
        pathToFileURL(join(engineRoot, "node_modules/@playwright/test/index.mjs")).href
      );
      const rejectedSuggestionId = "2a1b5c7d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
      let savedNote: Record<string, unknown> | null = null;
      const noteTimestamp = "2026-07-30T00:00:00.000Z";
      let legacyGlobalNote = {
        id: "world_legacy_global",
        title: "Legacy global memory",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: {},
        tags: [],
        keywords: [],
        links: [],
        sections: {
          facts: {
            text: "Legacy global memory text.",
            importance: "major",
            updatedAt: noteTimestamp,
          },
        },
        createdAt: noteTimestamp,
        updatedAt: noteTimestamp,
        version: 1,
      };
      const scopedDesktopNote = {
        ...legacyGlobalNote,
        id: "world_scoped_desktop",
        title: "Scoped desktop memory",
        scope: { chatId: "desktop-chat", chatIds: ["desktop-chat"] },
        sections: {
          facts: {
            text: "Scoped desktop memory text.",
            importance: "major",
            updatedAt: noteTimestamp,
          },
        },
      };
      const availabilityPatches: Array<Record<string, unknown>> = [];
      let deletedSuggestionId: string | null = null;
      const scopeTargetQueries: string[] = [];
      const noteQueries: string[] = [];
      const reviewQueries: string[] = [];
      const rejectedSuggestionQueries: string[] = [];
      const reviewActionCalls: Array<{
        action: "accept" | "skip";
        draftId: string;
        mutationIds: string[];
      }> = [];
      const reviewDraftIds = {
        first: "10000000-0000-4000-8000-000000000011",
        second: "10000000-0000-4000-8000-000000000012",
        recovery: "10000000-0000-4000-8000-000000000013",
      };
      const reviewMutationIds = {
        first: "10000000-0000-4000-8000-000000000021",
        second: "10000000-0000-4000-8000-000000000022",
      };
      const makeReviewDraft = (
        draftId: string,
        mutationId?: string,
        title = "Review fixture memory",
        mutation?: Record<string, unknown>,
      ) => ({
        id: draftId,
        status: "pending",
        applyState: "not_started",
        indexRebuildStatus: "not_requested",
        createdAt: "2026-07-30T00:00:00.000Z",
        updatedAt: "2026-07-30T00:00:00.000Z",
        reviewRequired: true,
        source: { sourceNoteId: "source_mobile_review", chatId: "chat-a" },
        scope: {},
        modes: ["roleplay"],
        summary: `${title} summary`,
        mutations: mutationId
          ? [
              mutation ?? {
                id: mutationId,
                kind: "create_note",
                claimKind: "addition",
                risk: "low",
                confidence: 0.9,
                summary: title,
                evidence: ["source_note:source_mobile_review"],
                note: {
                  id: `world_${mutationId.slice(-3)}`,
                  title,
                  type: "world",
                  status: "active",
                  modes: ["roleplay"],
                  scope: {},
                  tags: [],
                  keywords: [],
                  links: [],
                  sections: {
                    facts: {
                      text: `${title} content.`,
                      importance: "major",
                      updatedAt: "2026-07-30T00:00:00.000Z",
                    },
                  },
                },
              },
            ]
          : [],
      });
      const makeExistingReviewMutation = () => ({
        id: reviewMutationIds.second,
        kind: "update_section",
        claimKind: "change",
        risk: "low",
        confidence: 0.9,
        summary: "Update the existing mobile world memory",
        evidence: ["source_note:source_mobile_review"],
        noteId: "world_second_mobile",
        sectionKey: "facts",
        section: {
          text: "Updated second mobile review memory text.",
          importance: "major",
          updatedAt: "2026-07-30T00:00:00.000Z",
        },
      });
      let reviewSources: any[] = [
        {
          sourceNoteId: "source_mobile_recovery",
          modes: ["roleplay"],
          drafts: [
            {
              draft: {
                ...makeReviewDraft(reviewDraftIds.recovery),
                source: {
                  sourceNoteId: "source_mobile_recovery",
                  chatId: "chat-a",
                },
              },
              freshness: "hashless",
              blockReasons: [
                {
                  code: "no_mutations",
                  message: "No mutation survived extraction.",
                },
              ],
              diagnostics: [],
              candidateRejections: [],
              deduplications: [],
            },
          ],
          targets: [],
        },
        {
          sourceNoteId: "source_mobile_review",
          modes: ["roleplay"],
          drafts: [
            {
              draft: makeReviewDraft(reviewDraftIds.first, reviewMutationIds.first, "First mobile review memory"),
              freshness: "fresh",
              blockReasons: [],
              diagnostics: [],
              candidateRejections: [],
              deduplications: [],
            },
            {
              draft: makeReviewDraft(
                reviewDraftIds.second,
                reviewMutationIds.second,
                "Second mobile review memory",
                makeExistingReviewMutation(),
              ),
              freshness: "fresh",
              blockReasons: [],
              diagnostics: [],
              candidateRejections: [],
              deduplications: [],
            },
          ],
          targets: [
            {
              noteId: "world_new_mobile",
              title: "Existing mobile world",
              noteType: "world",
              rows: [
                {
                  draftId: reviewDraftIds.first,
                  mutation: {
                    id: reviewMutationIds.first,
                    kind: "create_note",
                    claimKind: "addition",
                    risk: "low",
                    confidence: 0.9,
                    summary: "First mobile review memory",
                    evidence: ["source_note:source_mobile_review"],
                    note: {
                      id: "world_new_mobile",
                      title: "First mobile review memory",
                      type: "world",
                      status: "active",
                      modes: ["roleplay"],
                      scope: {},
                      tags: [],
                      keywords: [],
                      links: [],
                      sections: {
                        facts: {
                          text: "First mobile review memory content.",
                          importance: "major",
                          updatedAt: "2026-07-30T00:00:00.000Z",
                        },
                      },
                    },
                  },
                  disposition: "new",
                  diagnostics: [],
                  changes: [],
                },
              ],
            },
            {
              noteId: "world_second_mobile",
              title: "Second mobile review memory",
              noteType: "world",
              rows: [
                {
                  draftId: reviewDraftIds.second,
                  mutation: makeExistingReviewMutation(),
                  disposition: "merge",
                  diagnostics: [],
                  changes: [],
                },
              ],
            },
          ],
        },
      ];
      let healthState: "healthy" | "degraded" = "healthy";
      let noteTotal = 5;
      let pendingDraftCount = 2;
      let lastInjectionRequests = 0;
      browserServer = createServer(async (request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const send = (status: number, body: unknown, contentType = "application/json") => {
          const payload = typeof body === "string" ? body : JSON.stringify(body);
          response.writeHead(status, { "content-type": contentType });
          response.end(payload);
        };
        if (url.pathname === "/")
          return send(
            200,
            `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/globals.css"><script type="module" src="/client.js"></script>`,
            "text/html",
          );
        if (url.pathname === "/globals.css")
          return send(200, `${engineStyles}\n${activationFixtureStyles}`, "text/css");
        if (url.pathname === "/client.js") return send(200, artifactClient, "application/javascript");
        if (request.method === "GET" && url.pathname === "/api/connections") return send(200, []);
        if (!url.pathname.startsWith("/api/long-term-memory/")) return send(404, {});
        if (request.method === "GET" && url.pathname.endsWith("/status"))
          return send(200, {
            initialized: true,
            directory: "long-term-memory",
            notes: { total: noteTotal, byType: {}, byStatus: {} },
            events: { logAvailable: false, bytes: null },
            indexes: {
              health: healthState,
              dirty: false,
              rebuildState: "idle",
              errors: [],
              warnings: [],
              generatedAt: null,
              sourceHash: null,
              noteCount: 0,
              chunkCount: 12,
              chunkFormatVersion: 1,
              embeddingsAvailable: false,
              embeddedChunkCount: 0,
            },
          });
        if (request.method === "GET" && url.pathname.endsWith("/settings")) return send(200, {});
        if (request.method === "POST" && url.pathname.endsWith("/notes/batch"))
          return send(200, {
            status: "complete",
            requestedNoteIds: ["world_artifact_lifecycle"],
            updatedNoteIds: ["world_artifact_lifecycle"],
            affectedNoteIds: ["world_artifact_lifecycle"],
            skippedNoteIds: [],
            failedNoteIds: [],
          });
        if (request.method === "GET" && url.pathname.endsWith("/extraction-settings")) return send(200, {});
        if (request.method === "GET" && url.pathname.endsWith("/integrity"))
          return send(200, { health: "healthy", ok: true, noteCount: 3, issues: [] });
        if (request.method === "GET" && url.pathname.endsWith("/drafts/pending-count"))
          return send(200, { count: pendingDraftCount });
        if (request.method === "GET" && url.pathname.endsWith("/last-injection/chat-artifact")) {
          lastInjectionRequests += 1;
          return lastInjectionRequests === 1
            ? send(200, {
                memoryCount: 1,
                tokenCount: 42,
                memories: [
                  {
                    noteId: "retained-memory",
                    title: "Retained memory",
                    tokenCount: 42,
                  },
                ],
              })
            : send(503, { error: "latest recall failed" });
        }
        if (request.method === "GET" && url.pathname.endsWith("/drafts/review")) {
          reviewQueries.push(url.search);
          if (url.searchParams.has("chatId"))
            return send(200, {
              generatedAt: "2026-07-30T00:00:00.000Z",
              sources: [],
              counts: {
                sources: 0,
                drafts: 0,
                mutations: 0,
                blockedDrafts: 0,
                candidateRejections: 0,
                deduplications: 0,
              },
            });
          return send(200, {
            generatedAt: "2026-07-30T00:00:00.000Z",
            sources: reviewSources,
            counts: {
              sources: reviewSources.length,
              drafts: reviewSources.reduce((count, source) => count + source.drafts.length, 0),
              mutations: reviewSources.reduce(
                (count, source) =>
                  count +
                  source.drafts.reduce((draftCount: number, item: any) => draftCount + item.draft.mutations.length, 0),
                0,
              ),
              blockedDrafts: reviewSources.reduce(
                (count, source) => count + source.drafts.filter((item: any) => item.blockReasons.length).length,
                0,
              ),
              candidateRejections: 0,
              deduplications: 0,
            },
          });
        }
        if (request.method === "GET" && url.pathname.endsWith("/scope-targets")) {
          scopeTargetQueries.push(url.search);
          return send(200, {
            currentScope: { chatId: "desktop-chat", chatIds: ["desktop-chat"] },
            chats: [
              {
                id: "desktop-chat",
                label: "Desktop chat",
                mode: "conversation",
                groupId: null,
                personaId: "persona-a",
                characterIds: ["character-a"],
              },
              {
                id: "memory-chat",
                label: "Memory chat",
                mode: "roleplay",
                groupId: "conversation-a",
                personaId: "persona-a",
                characterIds: ["character-a"],
              },
            ],
            groups: [
              {
                id: "conversation-a",
                label: "Conversation A",
                chatIds: ["memory-chat"],
              },
            ],
            characters: [{ id: "character-a", label: "Character A" }],
            personas: [{ id: "persona-a", label: "Persona A" }],
          });
        }
        if (request.method === "GET" && url.pathname.endsWith("/notes")) {
          noteQueries.push(url.search);
          const notes = [
            {
              id: "source_mobile_review",
              title: "Mobile review source",
              type: "source",
              status: "active",
              modes: ["roleplay"],
              scope: {},
              tags: [],
              keywords: [],
              links: [],
              sections: {
                source: {
                  text: "Mobile review source text.",
                  updatedAt: "2026-07-30T00:00:00.000Z",
                },
              },
              createdAt: "2026-07-30T00:00:00.000Z",
              updatedAt: "2026-07-30T00:00:00.000Z",
              version: 1,
            },
            {
              id: "world_second_mobile",
              title: "Second mobile review memory",
              type: "world",
              status: "active",
              modes: ["roleplay"],
              scope: {},
              tags: [],
              keywords: [],
              links: [],
              sections: {
                facts: {
                  text: "Second mobile review memory text.",
                  importance: "major",
                  updatedAt: "2026-07-30T00:00:00.000Z",
                },
              },
              createdAt: "2026-07-30T00:00:00.000Z",
              updatedAt: "2026-07-30T00:00:00.000Z",
              version: 1,
            },
            {
              id: "world_outside_current_chat",
              title: "Memory outside current chat",
              type: "world",
              status: "active",
              modes: ["roleplay"],
              scope: { chatId: "memory-chat", chatIds: ["memory-chat"] },
              tags: [],
              keywords: [],
              links: [],
              sections: {
                facts: {
                  text: "This memory belongs to another chat.",
                  importance: "major",
                  updatedAt: "2026-07-30T00:00:00.000Z",
                },
              },
              createdAt: "2026-07-30T00:00:00.000Z",
              updatedAt: "2026-07-30T00:00:00.000Z",
              version: 1,
            },
            legacyGlobalNote,
            scopedDesktopNote,
          ];
          return send(
            200,
            url.searchParams.get("scopeCharacterIds") === "character-a"
              ? notes.filter((note) => note.id === "world_second_mobile")
              : url.searchParams.get("scopeChatIds") === "desktop-chat"
                ? notes.filter((note) => note.id !== "world_outside_current_chat")
                : notes,
          );
        }
        if (request.method === "GET" && url.pathname.endsWith("/notes/world_second_mobile"))
          return send(200, {
            id: "world_second_mobile",
            title: "Second mobile review memory",
            type: "world",
            status: "active",
            modes: ["roleplay"],
            scope: {},
            tags: [],
            keywords: [],
            links: [],
            sections: {
              facts: {
                text: "Second mobile review memory text.",
                importance: "major",
                updatedAt: "2026-07-30T00:00:00.000Z",
              },
            },
            createdAt: "2026-07-30T00:00:00.000Z",
            updatedAt: "2026-07-30T00:00:00.000Z",
            version: 1,
          });
        if (request.method === "GET" && url.pathname.endsWith(`/notes/${legacyGlobalNote.id}`))
          return send(200, legacyGlobalNote);
        if (request.method === "GET" && url.pathname.endsWith(`/notes/${scopedDesktopNote.id}`))
          return send(200, scopedDesktopNote);
        if (request.method === "PATCH" && url.pathname.endsWith(`/notes/${legacyGlobalNote.id}`)) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const patch = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          availabilityPatches.push(patch);
          legacyGlobalNote = {
            ...legacyGlobalNote,
            ...patch,
            updatedAt: noteTimestamp,
            version: legacyGlobalNote.version + 1,
          };
          return send(200, { note: legacyGlobalNote });
        }
        if (request.method === "POST" && url.pathname.endsWith("/import/preview"))
          return send(200, {
            source: "chats",
            scanned: 1,
            draftable: 0,
            importedCount: 1,
            samples: [
              {
                sourceId: "chat-a:summary-desktop-reextract",
                title: "Desktop re-extract source",
                mutationCount: 0,
                summary: "An imported source held open for re-extraction.",
                snippet: "The re-extract action should show progress.",
                status: "imported",
                freshness: "current",
                existingNoteId: "source_desktop_reextract",
                existingNoteTitle: "Desktop re-extract source",
              },
            ],
          });
        if (request.method === "POST" && url.pathname.endsWith("/import/lorebooks/preview"))
          return send(200, {
            counts: {
              books: 1,
              entries: 1,
              candidates: 1,
              pending: 1,
              imported: 0,
            },
            books: [
              {
                id: "lorebook_mobile_fixture",
                name: "Mobile Field Guide",
                description: "A populated lorebook used to verify responsive source browsing.",
                category: "Reference",
                tags: ["mobile", "test"],
                scope: {},
                counts: { entries: 1, candidates: 1, pending: 1, imported: 0 },
                entries: [
                  {
                    id: "entry_mobile_harbor",
                    name: "Harbor Signals",
                    candidateCount: 1,
                    candidates: [
                      {
                        sourceId: "lorebook_mobile_fixture:entry_mobile_harbor:0",
                        title: "Mobile Field Guide: Harbor Signals",
                        mutationCount: 1,
                        summary: "Harbor signal colors and their meanings.",
                        snippet: "A blue lantern marks the safe channel after dusk.",
                        status: "pending",
                        freshness: "new",
                      },
                    ],
                  },
                ],
              },
            ],
          });
        if (request.method === "GET" && url.pathname.endsWith("/rejected-suggestions")) {
          rejectedSuggestionQueries.push(url.search);
          if (url.searchParams.has("chatId")) return send(200, { suggestions: [], total: 0 });
          return send(200, {
            suggestions: [
              {
                id: rejectedSuggestionId,
                fingerprint: "a".repeat(64),
                source: { sourceNoteId: "source_mobile_recovery" },
                scope: {},
                modes: ["roleplay"],
                candidate: {
                  index: 0,
                  reason: "invalid_format",
                  message: "A recoverable mobile memory.",
                  snippet: "A recoverable mobile memory.",
                  recovery: {
                    noteType: "world",
                    noteId: "world_mobile_recovery",
                    sectionKey: "facts",
                  },
                },
                createdAt: "2026-07-30T00:00:00.000Z",
                lastSeenAt: "2026-07-30T00:00:00.000Z",
              },
            ],
            total: 1,
          });
        }
        if (request.method === "POST" && url.pathname.endsWith("/notes")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          savedNote = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          return send(201, {
            note: {
              ...savedNote,
              createdAt: "2026-07-30T00:00:00.000Z",
              updatedAt: "2026-07-30T00:00:00.000Z",
              version: 1,
            },
          });
        }
        if (request.method === "POST" && url.pathname.endsWith("/notes/source_desktop_reextract/extract"))
          return await new Promise<void>((resolve) => {
            releaseReextraction = () => {
              releaseReextraction = null;
              send(200, {});
              resolve();
            };
          });
        if (request.method === "POST" && (url.pathname.endsWith("/accept") || url.pathname.endsWith("/skip"))) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            mutationIds?: string[];
          };
          const action = url.pathname.endsWith("/accept") ? "accept" : "skip";
          const draftId = decodeURIComponent(url.pathname.split("/").at(-2)!);
          const mutationIds = body.mutationIds ?? [];
          reviewActionCalls.push({ action, draftId, mutationIds });
          reviewSources = reviewSources
            .map((source) => ({
              ...source,
              drafts: source.drafts.filter((item: any) => item.draft.id !== draftId),
            }))
            .filter((source) => source.drafts.length > 0);
          return action === "accept"
            ? send(200, {
                appliedMutationIds: mutationIds,
                skippedMutationIds: [],
                autoIncludedMutationIds: [],
                indexRebuild: { status: "not_requested" },
              })
            : send(200, { mutationIds });
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
      const desktopActivationChanges: boolean[] = [];
      const chatSummarySettingsOpens: number[] = [];
      const promptPresetEditorOpens: number[] = [];
      await page.exposeFunction("onDesktopActivationChange", (enabled: boolean) => {
        desktopActivationChanges.push(enabled);
      });
      await page.exposeFunction("onOpenChatSummarySettings", () => {
        chatSummarySettingsOpens.push(Date.now());
      });
      await page.exposeFunction("onOpenActivePromptPresetEditor", () => {
        promptPresetEditorOpens.push(Date.now());
      });
      await page.exposeFunction("declineDestinationChange", () => false);
      await page.addInitScript(() => {
        Object.defineProperty(Crypto.prototype, "randomUUID", {
          configurable: true,
          value: undefined,
        });
      });
      await page.goto(`http://127.0.0.1:${address.port}/`);
      await page.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
      await page.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = {
          agent: { name: "Long-Term Memory" },
          chatId: "desktop-chat",
          chatName: "desktop chat",
          chatMode: "conversation",
          enabledForChat: true,
          onEnabledForChatChange: (
            window as Window & {
              onDesktopActivationChange: () => void;
            }
          ).onDesktopActivationChange,
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      await page.locator("[data-ltm-browser-controls]").waitFor();
      const memoryScope = page.locator("[data-ltm-memory-scope]");
      await memoryScope.locator(":scope > summary").waitFor();
      assert.equal(
        await memoryScope.locator(":scope > summary").innerText(),
        "Currently viewing memories in:desktop chat",
      );
      assert.equal(await page.getByText("Memory outside current chat").count(), 0);
      await memoryScope.locator(":scope > summary").click();
      const scopeControlStyle = await memoryScope.locator(":scope > summary").evaluate((element) => {
        const chevron = element.querySelector<SVGElement>("[data-ltm-memory-scope-chevron]");
        const label = element.querySelector<HTMLElement>("span");
        const style = getComputedStyle(element);
        return {
          display: style.display,
          fontFamily: style.fontFamily,
          chevronAfterLabel: Boolean(
            chevron && label && chevron.getBoundingClientRect().left >= label.getBoundingClientRect().right,
          ),
        };
      });
      assert.equal(scopeControlStyle.display, "flex");
      assert.ok(scopeControlStyle.fontFamily.length > 0);
      assert.equal(scopeControlStyle.chevronAfterLabel, true);
      assert.equal(
        await memoryScope.locator('[data-ltm-memory-scope-target="character:character-a"]').textContent(),
        "Character A",
      );
      assert.equal(
        await memoryScope.locator('[data-ltm-memory-scope-picker="chat"]').locator(":scope > summary").innerText(),
        "ChatDesktop chat",
      );
      assert.equal(
        await memoryScope
          .locator('[data-ltm-memory-scope-picker="branch"]')
          .getByText("All branches", { exact: true })
          .count(),
        1,
      );
      await memoryScope.locator('[data-ltm-memory-scope-picker="character"] > summary').press("Enter");
      assert.equal(
        await memoryScope
          .locator('[data-ltm-memory-scope-picker="character"]')
          .evaluate((picker) => (picker as HTMLDetailsElement).open),
        true,
      );
      const characterPickerStyle = await memoryScope
        .locator('[data-ltm-memory-scope-picker="character"]')
        .evaluate((picker) => {
          const summary = picker.querySelector<HTMLElement>("summary")!;
          const chevron = summary.querySelector<SVGElement>("[data-ltm-memory-scope-chevron]")!;
          const target = picker.querySelector<HTMLElement>('[data-ltm-memory-scope-target="character:character-a"]')!;
          const targetStyle = getComputedStyle(target);
          return {
            chevronTransform: getComputedStyle(chevron).transform,
            targetBackground: targetStyle.backgroundColor,
            targetFontWeight: Number.parseInt(targetStyle.fontWeight, 10),
          };
        });
      assert.notEqual(characterPickerStyle.chevronTransform, "none");
      assert.notEqual(characterPickerStyle.targetBackground, "rgba(0, 0, 0, 0)");
      assert.ok(characterPickerStyle.targetFontWeight >= 600);
      await page.locator('[data-ltm-memory-scope-target="character:character-a"]').focus();
      await page.locator('[data-ltm-memory-scope-target="character:character-a"]').press("Enter");
      await page.waitForFunction(
        () => document.activeElement === document.querySelector('[data-ltm-memory-scope-picker="character"] > summary'),
      );
      assert.equal(
        await memoryScope
          .locator('[data-ltm-memory-scope-picker="character"]')
          .evaluate((picker) => (picker as HTMLDetailsElement).open),
        false,
      );
      for (const kind of ["chat", "branch", "status", "sort"]) {
        const picker = page.locator(`[data-ltm-memory-scope-picker="${kind}"]`);
        const summary = picker.locator(":scope > summary");
        await summary.focus();
        await summary.press("Enter");
        await picker.locator('[data-ltm-memory-scope-target$=":all"]').focus();
        await picker.locator('[data-ltm-memory-scope-target$=":all"]').press("Enter");
        await page.waitForFunction(
          (selector) => document.activeElement === document.querySelector(selector),
          `[data-ltm-memory-scope-picker="${kind}"] > summary`,
          { timeout: 5000 },
        );
      }
      const memoryGroupSummary = page.locator('[data-ltm-memory-group="world"] > summary');
      await page.evaluate(() => {
        document.body.tabIndex = -1;
        document.body.focus();
      });
      for (let index = 0; index < 200; index += 1) {
        if (await memoryGroupSummary.evaluate((summary) => summary.matches(":focus"))) break;
        await page.keyboard.press("Tab");
      }
      const memoryGroupFocus = await memoryGroupSummary.evaluate((summary) => ({
        outlineStyle: getComputedStyle(summary).outlineStyle,
        outlineWidth: getComputedStyle(summary).outlineWidth,
        height: summary.getBoundingClientRect().height,
      }));
      assert.notEqual(memoryGroupFocus.outlineStyle, "none");
      assert.ok(memoryGroupFocus.height >= 44, JSON.stringify(memoryGroupFocus));
      await page.evaluate(() => document.body.removeAttribute("tabindex"));
      await memoryScope.locator('[data-ltm-memory-scope-picker="character"] > summary').click();
      await page.locator('[data-ltm-memory-scope-target="character:all"]').click();
      await page.locator('[data-ltm-memory-group="world"] > summary').click();
      await page.getByText("Memory outside current chat").waitFor();
      assert.ok(noteQueries.some((query) => !query.includes("scopeChatIds")));
      const setupGuide = page.getByRole("button", { name: "Show setup guide" });
      await setupGuide.click();
      const onboardingTitle = page.locator("#ltm-onboarding-title");
      assert.equal(await page.locator('[data-ltm-surface="onboarding"]').getByText("Step 1 of 7 · Save").count(), 1);
      assert.equal(await onboardingTitle.innerText(), "Overview");
      assert.equal(await page.locator("#ltm-onboarding-description dt").count(), 3);
      const guideWidth = await page
        .locator("#ltm-onboarding-description")
        .evaluate((description) => description.getBoundingClientRect().width);
      await page.getByRole("button", { name: "Next: How recall works" }).click();
      assert.equal(await onboardingTitle.innerText(), "How Recall Works");
      const onboardingNext = page.getByRole("button", {
        name: "Next: Enabling it for the Current Chat",
      });
      await onboardingNext.click();
      assert.match(
        await page.locator('[data-ltm-surface="onboarding"]').innerText(),
        /In Conversation mode, the Engine places recalled memories automatically/u,
      );
      assert.doesNotMatch(await page.locator('[data-ltm-surface="onboarding"]').innerText(), /Agent Sections/u);
      assert.equal(
        await page.locator('[data-ltm-surface="onboarding"]').getByText("Step 3 of 7 · Activate").count(),
        1,
      );
      await page.getByRole("button", { name: "Back", exact: true }).click();
      assert.equal(await onboardingTitle.innerText(), "How Recall Works");
      await page.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      await page.getByRole("button", { name: "Next: Choose a source" }).click();
      assert.equal(await onboardingTitle.innerText(), "Choose What to Remember");
      assert.equal(await page.locator("#ltm-onboarding-description ul li").count(), 3);
      assert.deepEqual(await page.locator("#ltm-onboarding-description ul li strong").allInnerTexts(), [
        "Chat Summary",
        "Lorebook",
        "Character",
      ]);
      assert.deepEqual(await page.locator("[data-ltm-source-choice] > button").allInnerTexts(), [
        "Chat Summary",
        "Lorebook",
        "Character",
      ]);
      assert.deepEqual(await page.locator("[data-ltm-onboarding-actions] > button").allInnerTexts(), [
        "Back",
        "Next: Reviewing and saving memories",
        "Open chat sources",
      ]);
      assert.ok(
        Math.abs(
          guideWidth -
            (await page
              .locator("#ltm-onboarding-description")
              .evaluate((description) => description.getBoundingClientRect().width)),
        ) < 0.01,
      );
      assert.equal(await page.getByRole("button", { name: "Open chat sources" }).count(), 1);
      await page.getByRole("button", { name: "Next: Reviewing and saving memories" }).click();
      assert.equal(await onboardingTitle.innerText(), "Review Before Saving");
      assert.equal(await page.locator("#ltm-onboarding-description ul li").count(), 3);
      await page.getByRole("button", { name: "Next: Check it works" }).click();
      assert.equal(await onboardingTitle.innerText(), "Check What the Chat Used");
      assert.match(
        await page.locator('[data-ltm-surface="onboarding"]').innerText(),
        /send a message related to a saved fact[\s\S]*zero results/iu,
      );
      assert.equal(await page.locator('[data-ltm-surface="onboarding"]').getByText("Step 6 of 7 · Check").count(), 1);
      assert.equal(await page.locator("#ltm-onboarding-description ol li").count(), 2);
      assert.equal(
        await page.locator("#ltm-onboarding-description ol li").nth(1).innerText(),
        "When you get a response, peek the prompt and make sure the memories are reaching your chat context.",
      );
      await page.getByRole("button", { name: "Next: Under the Hood" }).click();
      assert.equal(await onboardingTitle.innerText(), "Under the Hood");
      assert.equal(await page.locator("#ltm-onboarding-description details").count(), 2);
      assert.deepEqual(await page.locator("#ltm-onboarding-description details summary").allInnerTexts(), [
        "Writing to memory (Extraction)",
        "Reading from memory (Recall)",
      ]);
      assert.equal(await page.getByRole("button", { name: "Close" }).count(), 1);
      await page.getByRole("button", { name: "Go to saved memories" }).first().click();
      await page.locator('[data-ltm-destination-content][aria-label="Memory Vault"]').waitFor();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
      await page.locator('[data-ltm-surface="vault"]').waitFor();
      const memorySearch = page.getByLabel("Search memories");
      await memorySearch.fill("Legacy global memory");
      await page
        .locator('[data-ltm-note-type="world"]')
        .filter({ hasText: /^Legacy global memory/u })
        .locator("button")
        .first()
        .click();
      await page.getByRole("button", { name: "Choose where used" }).click();
      await page.locator("[data-ltm-availability-workbench]").waitFor();
      const availability = page.locator("[data-ltm-availability-workbench]");
      await availability.getByRole("checkbox", { name: "Conversation" }).check();
      await availability.getByRole("button", { name: "Save availability" }).click();
      await page.waitForFunction(() => document.querySelector("[data-ltm-availability-workbench]") === null);
      assert.deepEqual(availabilityPatches.at(-1), {
        scope: {},
        modes: ["roleplay", "conversation"],
      });
      assert.deepEqual(legacyGlobalNote.scope, {});
      assert.deepEqual(legacyGlobalNote.modes, ["roleplay", "conversation"]);
      await memorySearch.fill("Scoped desktop memory");
      const scopedCard = page.locator('[data-ltm-note-type="world"]').filter({ hasText: /^Scoped desktop memory/u });
      await scopedCard.waitFor();
      await scopedCard.locator("button").first().click();
      await page.getByRole("button", { name: "Edit availability" }).waitFor();
      await page.getByRole("button", { name: "Edit availability" }).click();
      await page.locator("[data-ltm-availability-workbench]").waitFor();
      const scopedAvailability = page.locator("[data-ltm-availability-workbench]");
      await scopedAvailability.locator("[data-ltm-availability-pills] button").first().click();
      await scopedAvailability.locator('[role="alert"]').waitFor();
      assert.equal(await page.locator('[data-ltm-availability-workbench] [role="alert"]').count(), 1);
      assert.equal(availabilityPatches.length, 1);
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').click();
      await page.locator("[data-ltm-review-mutation-toggle]").click();
      await page.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          confirmAction: (
            window as Window & {
              declineDestinationChange: () => boolean;
            }
          ).declineDestinationChange,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
        localStorage.removeItem("marinara-long-term-memory-onboarding-v1");
      });
      await page.locator("[data-ltm-review-mutation] textarea").first().fill("Dirty memory");
      await setupGuide.click();
      await page.getByRole("button", { name: "Next: How recall works" }).click();
      await page.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      await page.getByRole("button", { name: "Next: Choose a source" }).click();
      await page.getByRole("button", { name: "Next: Reviewing and saving memories" }).click();
      await page.getByRole("button", { name: "Open Review Queue" }).click();
      assert.equal(await onboardingTitle.innerText(), "Review Before Saving");
      assert.equal(await page.locator('[data-ltm-surface="review-queue"]').count(), 1);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("marinara-long-term-memory-onboarding-v1")),
        "step:4",
      );
      await page.getByRole("button", { name: "Close", exact: true }).click();
      pendingDraftCount = 0;
      await page.reload();
      await page.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = {
          agent: { name: "Long-Term Memory" },
          chatId: "desktop-chat",
          chatName: "desktop chat",
          chatMode: "conversation",
          enabledForChat: true,
          confirmAction: (
            window as Window & {
              declineDestinationChange: () => boolean;
            }
          ).declineDestinationChange,
          package: { version },
        };
        document.body.append(element);
        localStorage.removeItem("marinara-long-term-memory-onboarding-v1");
      }, packageManifest.version);
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      const scopeTargetQueryCount = scopeTargetQueries.length;
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').click();
      await page.locator("[data-ltm-review-mutation-toggle]").click();
      await page.locator("[data-ltm-review-mutation] textarea").first().fill("Dirty memory");
      await setupGuide.click();
      await page.getByRole("button", { name: "Next: How recall works" }).click();
      await page.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      await page.getByRole("button", { name: "Next: Choose a source" }).click();
      await page.getByRole("button", { name: "Next: Reviewing and saving memories" }).click();
      await page.getByRole("button", { name: "Choose a Source" }).click();
      assert.equal(await onboardingTitle.innerText(), "Review Before Saving");
      assert.equal(await page.locator('[data-ltm-surface="review-queue"]').count(), 1);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("marinara-long-term-memory-onboarding-v1")),
        "step:4",
      );
      await page.getByRole("button", { name: "Close", exact: true }).click();
      pendingDraftCount = 2;
      await page.reload();
      await page.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = {
          agent: { name: "Long-Term Memory" },
          chatId: "desktop-chat",
          chatName: "desktop chat",
          chatMode: "conversation",
          enabledForChat: true,
          onEnabledForChatChange: (
            window as Window & {
              onDesktopActivationChange: (enabled: boolean) => void;
            }
          ).onDesktopActivationChange,
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      await setupGuide.click();
      await page.getByRole("button", { name: "Next: How recall works" }).click();
      await page.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      await page.getByRole("button", { name: "Next: Choose a source" }).click();
      await page.getByRole("button", { name: "Character" }).click();
      await page.getByRole("button", { name: "Import a character" }).click();
      await page.locator('[data-ltm-source-tab="characters"][aria-selected="true"]').waitFor();
      assert.equal(await page.locator('[data-ltm-surface="onboarding"]').count(), 1);
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await setupGuide.click();
      await page.getByRole("button", { name: "Next: How recall works" }).click();
      await page.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      await page.getByRole("button", { name: "Next: Choose a source" }).click();
      await page.getByRole("button", { name: "Chat Summary" }).click();
      const chatSummaryGuide = page.locator('[data-ltm-surface="onboarding"]');
      assert.match(
        await chatSummaryGuide.innerText(),
        /Chat Summary section.*default prompt.*Long-Term Memory Agent/isu,
      );
      assert.equal(await page.getByRole("button", { name: "Open chat sources" }).count(), 1);
      assert.equal(
        await page.getByRole("button", { name: "Open Chat Summary settings" }).count(),
        0,
        "Chat Summary handoff must remain hidden without a compatible Roleplay host callback",
      );
      await page.getByRole("button", { name: "Open chat sources" }).click();
      await page.locator('[data-ltm-source-tab="chats"][aria-selected="true"]').waitFor();
      assert.equal(
        await page.locator('[data-ltm-surface="onboarding"]').count(),
        1,
        "Source handoff must keep the onboarding wizard open",
      );
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          chatMode: "roleplay",
          enabledForChat: false,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      });
      await setupGuide.click();
      await page.getByRole("button", { name: "Next: How recall works" }).click();
      await page.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      assert.match(
        await page.locator('[data-ltm-surface="onboarding"]').innerText(),
        /Open Prompt Preset Editor.*Open Sections.*Add an Agent Section for Long-Term Memory/isu,
      );
      assert.equal(
        await page.getByRole("button", { name: "Open Prompt Preset Sections" }).count(),
        0,
        "Prompt preset handoff must remain hidden without a host callback",
      );
      await page.getByRole("button", { name: "Turn on for this chat" }).click();
      assert.deepEqual(desktopActivationChanges, [true]);
      await page.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          enabledForChat: true,
          onOpenChatSummarySettings: (
            window as Window & {
              onOpenChatSummarySettings: () => void;
            }
          ).onOpenChatSummarySettings,
          onOpenActivePromptPresetEditor: (
            window as Window & {
              onOpenActivePromptPresetEditor: () => void;
            }
          ).onOpenActivePromptPresetEditor,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
        localStorage.removeItem("marinara-long-term-memory-onboarding-v1");
      });
      await setupGuide.click();
      await page.getByRole("button", { name: "Next: How recall works" }).click();
      await page.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      await page.getByRole("button", { name: "Open Prompt Preset Sections" }).click();
      assert.deepEqual(promptPresetEditorOpens.length, 1);
      assert.equal(await page.locator('[data-ltm-surface="onboarding"]').count(), 0);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("marinara-long-term-memory-onboarding-v1")),
        "step:2",
      );
      await page.evaluate(() => localStorage.removeItem("marinara-long-term-memory-onboarding-v1"));
      await setupGuide.click();
      await page.getByRole("button", { name: "Next: How recall works" }).click();
      await page.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      await page.getByRole("button", { name: "Next: Choose a source" }).click();
      await page.getByRole("button", { name: "Chat Summary", exact: true }).click();
      await page.getByRole("button", { name: "Open Chat Summary settings" }).click();
      assert.deepEqual(chatSummarySettingsOpens.length, 1);
      assert.equal(await page.locator('[data-ltm-surface="onboarding"]').count(), 0);
      assert.equal(
        await page.evaluate(() => localStorage.getItem("marinara-long-term-memory-onboarding-v1")),
        "step:3",
      );
      await page.locator('[data-ltm-source-tab="lorebooks"]').click();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').waitFor();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="sources"]').click();
      await page.locator('[data-ltm-source-tab="lorebooks"][aria-selected="true"]').waitFor();
      await page.locator('[data-ltm-source-tab="chats"]').click();
      assert.equal(
        scopeTargetQueries.slice(scopeTargetQueryCount).includes("?includeAllChats=true&chatId=desktop-chat"),
        true,
      );
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
      const desktopActivation = page.locator('[data-ltm-control="activation"]');
      await desktopActivation.waitFor();
      const desktopActivationBox = await desktopActivation.boundingBox();
      const desktopAddBox = await page.locator('[aria-label="Add memories"]').boundingBox();
      assert.ok(desktopActivationBox);
      assert.ok(desktopAddBox);
      assert.equal(
        Math.abs(
          desktopActivationBox.y + desktopActivationBox.height / 2 - (desktopAddBox.y + desktopAddBox.height / 2),
        ) <= 2,
        true,
      );
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
      await page.locator("#settings-tab-extraction").click();
      const desktopExtractionLayout = await page
        .locator("#settings-panel-extraction > [data-ltm-extraction-grid]")
        .evaluate((grid) => {
          const fields = [...grid.children].slice(0, 2) as HTMLElement[];
          const labels = fields.map((field) => field.firstElementChild as HTMLElement);
          const selects = fields.map((field) => field.querySelector("select")!);
          const info = fields[1].querySelector("[data-ltm-info] svg")!;
          return {
            columns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/u).length,
            labelTops: labels.map((label) => label.getBoundingClientRect().top),
            labelHeights: labels.map((label) => label.getBoundingClientRect().height),
            selectTops: selects.map((select) => select.getBoundingClientRect().top),
            selectHeights: selects.map((select) => select.getBoundingClientRect().height),
            infoSize: info.getBoundingClientRect().width,
          };
        });
      assert.equal(desktopExtractionLayout.columns, 2);
      assert.deepEqual(desktopExtractionLayout.labelHeights, [44, 44]);
      assert.equal(Math.abs(desktopExtractionLayout.labelTops[0]! - desktopExtractionLayout.labelTops[1]!) <= 1, true);
      assert.equal(
        Math.abs(desktopExtractionLayout.selectTops[0]! - desktopExtractionLayout.selectTops[1]!) <= 1,
        true,
      );
      assert.deepEqual(desktopExtractionLayout.selectHeights, [44, 44]);
      assert.equal(desktopExtractionLayout.infoSize, 14);
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
      await page.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "settings");
        element.capabilityProps = {
          chatId: "chat-artifact",
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      const chatSettings = page.locator('[data-ltm-surface="chat-settings"]').last();
      await chatSettings.waitFor();
      const lastInjection = chatSettings.locator("[data-ltm-last-injection]");
      await lastInjection.getByText(/1 saved memory included in the latest model context/u).waitFor();
      await lastInjection.click();
      await lastInjection.getByText("Retained memory").waitFor();
      await lastInjection.locator("summary").getByText("42 tokens").waitFor();
      await page.evaluate(async () => {
        const element = document.querySelectorAll("marinara-capability-long-term-memory").item(1)!;
        element.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));
        document.body.append(element);
      });
      await lastInjection.click();
      await lastInjection.locator('[data-ltm-status="danger"]').waitFor();
      await lastInjection.getByRole("button", { name: /retry/i }).click();
      await lastInjection.locator('[data-ltm-status="danger"]').waitFor();
      assert.equal(lastInjectionRequests, 3);
      assert.equal(await lastInjection.getByText("Retained memory").count(), 0);
      assert.equal(await lastInjection.getByText("42 tokens").count(), 0);
      await page.waitForFunction(() => document.body.textContent?.includes("Second mobile review memory"));
      assert.equal(noteQueries.at(-1), "?scopeChatIds=desktop-chat&includeGlobal=false&limit=500&offset=0");
      assert.equal(await page.locator('[data-ltm-surface="overview"]').count(), 0);
      assert.equal(await page.locator('[data-ltm-surface="vault-health-pill"]').count(), 0);
      const desktopNavigationLayout = await page
        .locator('[data-ltm-control="navigation"]')
        .first()
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
      await page.waitForFunction(() => document.querySelectorAll("[data-ltm-workspace-pane-tab]").length === 0);
      assert.equal(await page.locator('[data-ltm-surface="vault-health-warning"]').count(), 0);
      assert.deepEqual(
        await page
          .locator('[data-ltm-control="navigation"]')
          .evaluateAll((elements) => [
            ...new Set(elements.map((element) => element.getAttribute("data-ltm-destination"))),
          ]),
        ["vault", "review", "sources", "settings"],
      );
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').waitFor();
      assert.ok(reviewQueries.length > 0);
      assert.ok(reviewQueries.every((query) => query === "?includeInvalidated=true"));
      assert.ok(rejectedSuggestionQueries.length > 0);
      assert.ok(rejectedSuggestionQueries.every((query) => query === ""));
      await page.setViewportSize({ width: 390, height: 844 });
      healthState = "degraded";
      await page.reload();
      await page.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = {
          agent: { name: "Long-Term Memory" },
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      const restoredGuide = page.locator('[data-ltm-surface="onboarding"]');
      await restoredGuide.waitFor();
      assert.equal(await restoredGuide.getByText("Step 4 of 7 · Import").count(), 1);
      await restoredGuide.getByRole("button", { name: "Close" }).click();
      await restoredGuide.waitFor({ state: "detached" });
      assert.equal(
        await page
          .locator('[data-ltm-control="navigation"]')
          .last()
          .evaluate((element) => getComputedStyle(element.closest("nav")!).display !== "none"),
        true,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      assert.deepEqual(
        await page.locator('[data-ltm-navigation="mobile"] [data-ltm-badge]').evaluateAll((badges) =>
          badges
            .map((badge) => {
              const badgeRect = badge.getBoundingClientRect();
              const buttonRect = badge.closest("button")!.getBoundingClientRect();
              return {
                destination: badge.closest<HTMLButtonElement>("button")?.dataset.ltmDestination,
                top: badgeRect.top < buttonRect.top + buttonRect.height / 2,
                left: badgeRect.left < buttonRect.left + buttonRect.width / 2,
              };
            })
            .sort((left, right) => left.destination!.localeCompare(right.destination!)),
        ),
        [
          { destination: "review", top: true, left: true },
          { destination: "vault", top: true, left: true },
        ],
      );
      assert.equal(await page.locator('[data-ltm-workspace-pane-tab="workbench"]').count(), 0);
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
      assert.equal(await page.locator('[data-ltm-surface="vault-health-warning"] [data-ltm-info]').count(), 1);
      await page.locator('[data-ltm-surface="vault-health-warning"] [data-ltm-info]').click();
      const healthInfoPanel = page.locator("[data-ltm-info-panel]").last();
      await healthInfoPanel.waitFor();
      assert.match(await healthInfoPanel.innerText(), /12 indexed chunks/u);
      assert.match(await healthInfoPanel.innerText(), /Check Settings > Maintenance > Reindex recall data\./u);

      await page.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="review"]').click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').waitFor();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').click();
      await page.locator('[data-ltm-workspace-pane-tab="navigator"]').click();
      await page.locator('[data-ltm-review-draft-select="10000000-0000-4000-8000-000000000012"]').click();
      await page.locator('[data-ltm-workspace-pane-tab="workbench"]').click();
      await page.locator("[data-ltm-review-draft-title]").waitFor();
      assert.equal(
        await page.locator("[data-ltm-review-draft-title]").innerText(),
        "Source note: Mobile review source",
      );
      const reviewText = await page.locator('[data-ltm-workspace-pane="workbench"]').innerText();
      assert.match(reviewText, /Second mobile review memory/u);
      assert.match(reviewText, /Second mobile review memory text\./u);
      assert.match(reviewText, /World/u);
      assert.match(reviewText, /Update section/u);
      assert.match(reviewText, /Major/u);
      assert.equal(await page.locator("[data-ltm-review-operation]").count(), 1);
      await page.locator("[data-ltm-review-mutation-toggle]").click();
      await page.getByRole("button", { name: "Open memory" }).click();
      await page.locator('[data-ltm-surface="vault"]').waitFor();
      await page.locator("[data-ltm-note-editor]").waitFor();
      assert.equal(
        await page.locator("[data-ltm-note-editor] input").first().inputValue(),
        "Second mobile review memory",
      );
      await page.locator('[data-ltm-control="navigation"][data-ltm-destination="review"]').last().click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').waitFor();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').click();
      await page.locator('[data-ltm-workspace-pane-tab="navigator"]').click();
      await page.locator('[data-ltm-review-draft-select="10000000-0000-4000-8000-000000000012"]').click();
      await page.locator('[data-ltm-workspace-pane-tab="workbench"]').click();
      await page.setViewportSize({ width: 1280, height: 900 });
      const acceptButtonSize = await page
        .locator('[data-ltm-review-mutation] [aria-label^="Accept "]')
        .first()
        .evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const icon = button.querySelector("svg")!;
          return {
            width: rect.width,
            height: rect.height,
            iconWidth: icon.getAttribute("width"),
            iconHeight: icon.getAttribute("height"),
          };
        });
      assert.ok(acceptButtonSize.width >= 44);
      assert.ok(acceptButtonSize.height >= 44);
      assert.equal(acceptButtonSize.iconWidth, "1rem");
      assert.equal(acceptButtonSize.iconHeight, "1rem");
      await page.setViewportSize({ width: 390, height: 844 });
      const reviewTextAfterViewportChanges = await page.locator('[data-ltm-workspace-pane="workbench"]').innerText();
      assert.doesNotMatch(
        reviewTextAfterViewportChanges,
        /timeline_event|world_022|10000000-0000-4000-8000-000000000022/u,
      );
      assert.equal(
        await page
          .locator("[data-ltm-review-target]")
          .first()
          .evaluate((target) => Boolean(target.closest("[data-ltm-review-draft]"))),
        true,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.second}"] [data-ltm-control="review-select"]`)
        .check();
      await page.getByRole("button", { name: "Skip selected (1)" }).click();
      const firstMutation = page.locator(`[data-ltm-review-mutation="${reviewMutationIds.first}"]`);
      await firstMutation.waitFor({ state: "visible" });
      await page.waitForFunction(
        (mutationId) =>
          document
            .querySelector(`[data-ltm-review-mutation="${mutationId}"]`)
            ?.textContent?.includes("First mobile review memory"),
        reviewMutationIds.first,
      );
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.first}"] [data-ltm-control="review-select"]`)
        .check();
      await page.getByRole("button", { name: "Accept eligible (1)" }).click();
      await page.waitForFunction(
        () => !document.querySelector('[data-ltm-review-source-select="source_mobile_review"]'),
      );
      assert.deepEqual(reviewActionCalls, [
        {
          action: "skip",
          draftId: reviewDraftIds.second,
          mutationIds: [reviewMutationIds.second],
        },
        {
          action: "accept",
          draftId: reviewDraftIds.first,
          mutationIds: [reviewMutationIds.first],
        },
      ]);

      healthState = "healthy";
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.reload();
      await page.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = {
          agent: { name: "Long-Term Memory" },
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      assert.equal(await page.locator('[data-ltm-surface="vault-health-pill"]').count(), 0);
      assert.equal(await page.locator('[data-ltm-surface="vault-health-warning"]').count(), 0);
      await page.locator('[data-ltm-control="navigation"][data-ltm-destination="review"]').first().click();
      await page.locator("[data-ltm-rejected-suggestions]").waitFor();
      assert.equal(
        await page
          .locator("[data-ltm-rejected-suggestions]")
          .evaluate((element) => (element as HTMLDetailsElement).open),
        false,
      );
      assert.ok(
        await page
          .locator("[data-ltm-rejected-suggestions]")
          .evaluate(
            (element) =>
              element.compareDocumentPosition(document.querySelector('[data-ltm-control="review-select"]')!) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
      );
      await page.locator("[data-ltm-rejected-suggestions] > summary").click();
      await page.getByRole("button", { name: /^Recover suggestion:/u }).click();
      await page.locator("[data-ltm-note-editor]").waitFor();
      await page.locator("[data-ltm-details-toggle]").click();
      await page.locator("[data-ltm-linked-memories] > summary").click();
      assert.equal(
        await page.locator("[data-ltm-linked-memories]").evaluate((section) => (section as HTMLDetailsElement).open),
        true,
      );
      await page.waitForFunction(() => document.querySelectorAll("[data-ltm-workspace-pane-tab]").length === 0);
      assert.equal(await page.locator("[data-ltm-workspace-pane-tab]").count(), 0);
      assert.equal(await page.locator('[data-ltm-workspace-pane][role="tabpanel"]').count(), 0);
      const wideVaultLayout = await page.locator("[data-ltm-workspace]").evaluate((element) => ({
        columns: getComputedStyle(element).gridTemplateColumns.split(/\s+/u).length,
        editorVisible:
          getComputedStyle(element.querySelector<HTMLElement>('[data-ltm-workspace-pane="workbench"]')!).display !==
          "none",
        inspectorVisible:
          getComputedStyle(element.querySelector<HTMLElement>('[data-ltm-workspace-pane="inspector"]')!).display !==
          "none",
      }));
      assert.deepEqual(wideVaultLayout, {
        columns: 3,
        editorVisible: true,
        inspectorVisible: true,
      });
      await page.setViewportSize({ width: 900, height: 844 });
      await page.waitForFunction(() => document.querySelectorAll("[data-ltm-workspace-pane-tab]").length === 2);
      assert.deepEqual(
        await page.locator("[data-ltm-workspace-pane-tab]").evaluateAll((tabs) =>
          tabs.map((tab) => ({
            pane: tab.getAttribute("data-ltm-workspace-pane-tab"),
            controls: tab.getAttribute("aria-controls"),
          })),
        ),
        [
          {
            pane: "workbench",
            controls: await page.locator('[data-ltm-workspace-pane="workbench"]').getAttribute("id"),
          },
          {
            pane: "inspector",
            controls: await page.locator('[data-ltm-workspace-pane="inspector"]').getAttribute("id"),
          },
        ],
      );
      const workbenchTab = page.locator('[data-ltm-workspace-pane-tab="workbench"]');
      await workbenchTab.focus();
      await workbenchTab.press("End");
      await page.waitForFunction(() => {
        const tab = document.querySelector('[data-ltm-workspace-pane-tab="inspector"]');
        return document.activeElement === tab && tab?.getAttribute("aria-selected") === "true";
      });
      await page.locator("[data-ltm-note-inspector]").waitFor({ state: "visible" });
      await page.locator('[data-ltm-workspace-pane-tab="inspector"]').press("Home");
      await page.waitForFunction(
        () => document.activeElement?.getAttribute("data-ltm-workspace-pane-tab") === "workbench",
      );
      await page.locator("[data-ltm-details-toggle]").click();
      await page.waitForFunction(() => {
        const tab = document.querySelector('[data-ltm-workspace-pane-tab="workbench"]');
        return (
          (document.activeElement === tab && tab?.getAttribute("aria-selected") === "true") ||
          document.activeElement?.getAttribute("data-ltm-workspace-pane") === "workbench"
        );
      });
      await page.locator("[data-ltm-details-toggle]").click();
      await page.waitForFunction(() => {
        const tab = document.querySelector('[data-ltm-workspace-pane-tab="inspector"]');
        return document.activeElement === tab && tab?.getAttribute("aria-selected") === "true";
      });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "20px";
      });
      await page.setViewportSize({ width: 900, height: 844 });
      await page.waitForFunction(() => document.querySelectorAll("[data-ltm-workspace-pane-tab]").length === 3);
      assert.deepEqual(
        await page
          .locator("[data-ltm-workspace-pane-tab]")
          .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-ltm-workspace-pane-tab"))),
        ["navigator", "workbench", "inspector"],
      );
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.locator("[data-ltm-details-toggle]").click();
      assert.equal(await page.locator("[data-ltm-details-toggle]").getAttribute("aria-pressed"), "false");
      assert.equal(await page.locator('[data-ltm-workspace-pane="inspector"]').count(), 0);
      await page.getByRole("button", { name: "Choose where used" }).click();
      await page.locator("[data-ltm-availability-picker] > summary").click();
      const availabilityTabs = page.locator("[data-ltm-availability-tabs]");
      await availabilityTabs.waitFor();
      assert.deepEqual(
        await availabilityTabs.locator('[role="tab"]').evaluateAll((tabs) =>
          tabs.map((tab) => ({
            kind: tab.getAttribute("data-ltm-availability-tab"),
            selected: tab.getAttribute("aria-selected"),
            tabIndex: tab.getAttribute("tabindex"),
            count: tab.querySelector("[data-ltm-availability-count]")?.textContent,
          })),
        ),
        [
          { kind: "character", selected: "true", tabIndex: "0", count: "0" },
          { kind: "persona", selected: "false", tabIndex: "-1", count: "0" },
          { kind: "chat", selected: "false", tabIndex: "-1", count: "1" },
          { kind: "branch", selected: "false", tabIndex: "-1", count: "1" },
        ],
      );
      assert.equal(
        await availabilityTabs.locator('[data-ltm-availability-tab="persona"] span').first().innerText(),
        "Persona",
      );
      assert.equal(
        await availabilityTabs.locator('[data-ltm-availability-tab="chat"] span').first().innerText(),
        "Chat",
      );
      const desktopRailLayout = await availabilityTabs.evaluate((rail) => {
        const tablist = rail.querySelector<HTMLElement>('[role="tablist"]')!;
        const tabs = [...rail.querySelectorAll<HTMLElement>('[role="tab"]')];
        const rects = tabs.map((tab) => tab.getBoundingClientRect());
        const panel = rail.querySelector<HTMLElement>('[role="tabpanel"]')!;
        const panelRect = panel.getBoundingClientRect();
        const tablistRect = tablist.getBoundingClientRect();
        const template = getComputedStyle(tablist).gridTemplateColumns;
        return {
          columns: template.startsWith("repeat(4,") ? 4 : template.split(/\s+/u).length,
          sameRow: rects.every((rect) => Math.abs(rect.top - rects[0]!.top) <= 1),
          equalWidths: rects.every((rect) => Math.abs(rect.width - rects[0]!.width) <= 1),
          panelBelowTabs: panelRect.top >= tablistRect.bottom,
          panelWidth: panelRect.width,
          tablistWidth: tablistRect.width,
        };
      });
      assert.deepEqual(
        {
          columns: desktopRailLayout.columns,
          sameRow: desktopRailLayout.sameRow,
          equalWidths: desktopRailLayout.equalWidths,
          panelBelowTabs: desktopRailLayout.panelBelowTabs,
        },
        {
          columns: 4,
          sameRow: true,
          equalWidths: true,
          panelBelowTabs: true,
        },
      );
      assert.ok(Math.abs(desktopRailLayout.panelWidth - desktopRailLayout.tablistWidth) <= 0.5);
      await availabilityTabs.locator('[data-ltm-availability-tab="chat"]').click();
      assert.equal(
        await availabilityTabs.locator('[data-ltm-availability-target="chat:all"]').getAttribute("aria-pressed"),
        "true",
      );
      await availabilityTabs.locator('[data-ltm-availability-tab="branch"]').click();
      assert.equal(
        await availabilityTabs.locator('[data-ltm-availability-target="branch:all"]').getAttribute("aria-pressed"),
        "true",
      );
      await availabilityTabs.locator('[data-ltm-availability-tab="character"]').click();
      const characterTab = availabilityTabs.locator('[data-ltm-availability-tab="character"]');
      const personaTab = availabilityTabs.locator('[data-ltm-availability-tab="persona"]');
      await characterTab.press("ArrowRight");
      assert.equal(await personaTab.getAttribute("aria-selected"), "true");
      assert.equal(
        await availabilityTabs.locator('[role="tabpanel"]').getAttribute("aria-labelledby"),
        await personaTab.getAttribute("id"),
      );
      await personaTab.press("Home");
      assert.equal(await characterTab.getAttribute("aria-selected"), "true");
      await characterTab.press("End");
      assert.equal(
        await availabilityTabs.locator('[data-ltm-availability-tab="branch"]').getAttribute("aria-selected"),
        "true",
      );
      await characterTab.click();
      await availabilityTabs.locator('[data-ltm-availability-search="character"]').fill("Character");
      await availabilityTabs.locator('[data-ltm-availability-target="character:character-a"]').click();
      assert.equal(
        await availabilityTabs
          .locator('[data-ltm-availability-target="character:character-a"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await personaTab.click();
      assert.equal(await characterTab.getAttribute("aria-selected"), "false");
      assert.equal(await personaTab.getAttribute("aria-selected"), "true");
      await characterTab.click();
      assert.equal(
        await availabilityTabs.locator('[data-ltm-availability-search="character"]').inputValue(),
        "Character",
      );
      await page.setViewportSize({ width: 320, height: 720 });
      const mobileRailLayout = await availabilityTabs.evaluate((rail) => {
        const tablist = rail.querySelector<HTMLElement>('[role="tablist"]')!;
        const panel = rail.querySelector<HTMLElement>('[role="tabpanel"]')!;
        const tablistRect = tablist.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        return {
          columns: getComputedStyle(tablist).gridTemplateColumns.split(/\s+/u).length,
          panelBelowTabs: panelRect.top >= tablistRect.bottom,
          pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        };
      });
      assert.deepEqual(mobileRailLayout, {
        columns: 1,
        panelBelowTabs: true,
        pageFits: true,
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await personaTab.click();
      await page.locator('[data-ltm-availability-target="persona:persona-a"]').click();
      await page.locator('[data-ltm-availability-tab="chat"]').click();
      await page.locator('[data-ltm-availability-target="chat:conversation-a"]').click();
      await page.locator('[data-ltm-availability-tab="branch"]').click();
      await page.locator('[data-ltm-availability-target="branch:memory-chat"]').click();
      assert.equal(await page.getByText("Groups", { exact: true }).count(), 0);
      await page.getByRole("button", { name: "Save availability" }).click();
      await page.locator("[data-ltm-select-mode]").click();
      const selectableWorldNotes = page.locator('[data-ltm-note-type="world"] input[type="checkbox"]');
      assert.ok((await selectableWorldNotes.count()) >= 2);
      const worldGroup = page.locator('[data-ltm-memory-group="world"]');
      if (!(await worldGroup.evaluate((group) => (group as HTMLDetailsElement).open))) {
        await worldGroup.locator(":scope > summary").click();
      }
      await selectableWorldNotes.nth(0).check();
      await selectableWorldNotes.nth(1).check();
      await page.locator("[data-ltm-bulk-availability]").click();
      const bulkAvailability = page.locator("[data-ltm-bulk-availability-workbench]");
      await bulkAvailability.waitFor();
      const bulkRail = bulkAvailability.locator("[data-ltm-availability-tabs]");
      await bulkRail.waitFor();
      assert.deepEqual(
        await bulkRail.evaluate((rail) => ({
          railRadius: getComputedStyle(rail).borderRadius,
          tabRadius: getComputedStyle(rail.querySelector<HTMLElement>('[role="tab"]')!).borderRadius,
          pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        })),
        { railRadius: "0px", tabRadius: "0px", pageFits: true },
      );
      await bulkRail.locator('[data-ltm-availability-tab="character"]').click();
      await bulkRail.locator('[data-ltm-availability-target="character:character-a"]').click();
      assert.equal(
        await bulkRail.locator('[data-ltm-availability-target="character:character-a"]').getAttribute("aria-pressed"),
        "true",
      );
      await bulkRail.locator('[data-ltm-availability-tab="chat"]').click();
      assert.equal(
        await bulkRail.locator('[data-ltm-availability-target="chat:all"]').getAttribute("aria-pressed"),
        "true",
      );
      await bulkRail.locator('[data-ltm-availability-tab="branch"]').click();
      assert.equal(
        await bulkRail.locator('[data-ltm-availability-target="branch:all"]').getAttribute("aria-pressed"),
        "true",
      );
      await bulkRail.locator('[data-ltm-availability-tab="persona"]').click();
      await bulkRail.locator('[data-ltm-availability-target="persona:persona-a"]').click();
      assert.equal(
        await bulkRail.locator('[data-ltm-availability-target="persona:persona-a"]').getAttribute("aria-pressed"),
        "true",
      );
      const bulkAvailabilityResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" && response.url().includes("/api/long-term-memory/notes/batch"),
      );
      const bulkAvailabilityRequest = page.waitForRequest(
        (request) => request.method() === "POST" && request.url().includes("/api/long-term-memory/notes/batch"),
      );
      await bulkAvailability.getByRole("button", { name: "Apply" }).click();
      const bulkAvailabilityPayload = (await bulkAvailabilityRequest).postDataJSON();
      assert.deepEqual(bulkAvailabilityPayload.addScope, {
        characterIds: ["character-a"],
        personaIds: ["persona-a"],
      });
      assert.equal((await bulkAvailabilityResponse).status(), 200);
      await page.locator("[data-ltm-note-editor]").waitFor();
      const cleanupRequest = page.waitForRequest(
        (request) =>
          request.method() === "DELETE" && request.url().includes(`/rejected-suggestions/${rejectedSuggestionId}`),
      );
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await cleanupRequest;
      await page.locator('[data-ltm-status="success"]').waitFor();
      assert.equal(await page.locator('[role="alert"]').count(), 0);
      assert.equal(deletedSuggestionId, rejectedSuggestionId);
      assert.equal(savedNote?.type, "world");
      await page.locator('[data-ltm-control="navigation"][data-ltm-destination="sources"]').first().click();
      await page.locator('[data-ltm-source-tab="chats"]').click();
      await page.locator('[data-ltm-source-tab="characters"]').click();
      assert.doesNotMatch(
        await page.locator('[data-ltm-surface="sources"]').innerText(),
        /character card|Summary Prompt|lorebook entries as source notes/iu,
      );
      await page.locator('[data-ltm-source-section="imported"]').click();
      const desktopReextractRow = page.locator('[data-ltm-source-id="chat-a:summary-desktop-reextract"]');
      await desktopReextractRow.hover();
      const desktopReextract = desktopReextractRow.locator('[data-ltm-source-action="re-extract"]');
      await desktopReextract.click();
      await page.waitForFunction(
        () =>
          document.querySelector('[data-ltm-surface="sources"]')?.getAttribute("data-ltm-extraction-status") ===
          "pending",
      );
      assert.equal(await desktopReextract.isDisabled(), true);
      assert.match(
        (await desktopReextract.getAttribute("class")) ?? "",
        /\[&>svg\]:animate-spin/u,
        "Desktop re-extraction must animate its pending loader",
      );
      releaseReextraction?.();
      await page.waitForFunction(
        () =>
          document.querySelector('[data-ltm-surface="sources"]')?.getAttribute("data-ltm-extraction-status") === "idle",
      );
      assert.equal(await desktopReextract.isDisabled(), false);
      await page.locator('[data-ltm-source-tab="lorebooks"]').click();
      const sourcesWorkspace = page.locator('[data-ltm-surface="sources"] [data-ltm-workspace]');
      await sourcesWorkspace.waitFor();
      assert.equal(
        await sourcesWorkspace.evaluate(
          (element) => getComputedStyle(element).gridTemplateColumns.split(/\s+/u).length,
        ),
        2,
      );
      await page.locator('[data-ltm-lorebook-id="lorebook_mobile_fixture"]').click();
      assert.equal(await page.locator('[data-ltm-lorebook-workbench="lorebook_mobile_fixture"]').isVisible(), true);
      await page.locator('[data-ltm-lorebook-entry="entry_mobile_harbor"]').waitFor();
      assert.match(
        await page.locator('[data-ltm-lorebook-entry="entry_mobile_harbor"]').innerText(),
        /blue lantern marks the safe channel/u,
      );

      const mobileContext = await browser.newContext({
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
      });
      const mobilePage = await mobileContext.newPage();
      const activationChanges: boolean[] = [];
      await mobilePage.exposeFunction("onMobileActivationChange", (enabled: boolean) => {
        activationChanges.push(enabled);
      });
      await mobilePage.exposeFunction("onMobileManagePackage", () => {});
      await mobilePage.goto(`http://127.0.0.1:${address.port}/`);
      await mobilePage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
      await mobilePage.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = {
          agent: { name: "Long-Term Memory" },
          chatId: "chat-mobile",
          chatName: "kirei",
          enabledForChat: true,
          onEnabledForChatChange: (
            window as Window & {
              onMobileActivationChange: (value: boolean) => void;
            }
          ).onMobileActivationChange,
          onManagePackage: (
            window as Window & {
              onMobileManagePackage: () => void;
            }
          ).onMobileManagePackage,
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      await mobilePage.locator('[data-ltm-surface="detail"]').waitFor();
      const activation = mobilePage.locator('[data-ltm-control="activation"]');
      assert.equal(await activation.count(), 1);
      assert.equal(await activation.isVisible(), true);
      assert.equal(await activation.getAttribute("aria-checked"), "true");
      const activationTrack = activation.locator("[data-ltm-activation-track]");
      const activationGeometry = await activation.evaluate((element) => {
        const button = element.getBoundingClientRect();
        const track = element.querySelector("[data-ltm-activation-track]")!.getBoundingClientRect();
        const knob = element.querySelector("[data-ltm-activation-knob]")!.getBoundingClientRect();
        const style = getComputedStyle(element.querySelector("[data-ltm-activation-track]")!);
        return {
          button: { width: button.width, height: button.height },
          track: {
            x: track.left - button.left,
            y: track.top - button.top,
            width: track.width,
            height: track.height,
          },
          knob: {
            x: knob.left - track.left,
            y: knob.top - track.top,
            width: knob.width,
            height: knob.height,
          },
          backgroundColor: style.backgroundColor,
          borderWidth: style.borderWidth,
        };
      });
      assert.equal(activationGeometry.button.height, 44);
      assert.equal(activationGeometry.button.width > 48, true);
      assert.equal(activationGeometry.track.width, 44);
      assert.equal(activationGeometry.track.height, 24);
      assert.equal(activationGeometry.knob.width, 20);
      assert.equal(activationGeometry.knob.height, 20);
      assert.ok(activationGeometry.knob.x + activationGeometry.knob.width / 2 > activationGeometry.track.width / 2);
      assert.ok(activationGeometry.knob.x + activationGeometry.knob.width <= activationGeometry.track.width);
      assert.notEqual(activationGeometry.backgroundColor, "rgba(0, 0, 0, 0)");
      assert.equal(activationGeometry.borderWidth, "1px");
      const activationTrackStyle = await activationTrack.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          width: rect.width,
          height: rect.height,
          backgroundColor: style.backgroundColor,
        };
      });
      assert.deepEqual(
        { width: activationTrackStyle.width, height: activationTrackStyle.height },
        { width: 44, height: 24 },
      );
      assert.equal(activationTrackStyle.backgroundColor, activationGeometry.backgroundColor);
      const activationMetrics = await activation.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          nearbyText: element.parentElement?.innerText ?? "",
          withinViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
          centerCovered: center === element || element.contains(center),
        };
      });
      console.log(`LTM mobile activation baseline: ${JSON.stringify(activationMetrics)}`);
      assert.ok(activationMetrics.box.width > 0 && activationMetrics.box.height > 0);
      assert.ok(activationMetrics.box.width >= 40 && activationMetrics.box.height >= 36);
      assert.equal(activationMetrics.withinViewport, true);
      assert.equal(activationMetrics.centerCovered, true);
      assert.ok(
        (await mobilePage.locator(".mari-editor-header").evaluate((header) => {
          const [main, actions] = [...header.children].map((child) => child.getBoundingClientRect());
          return Math.abs(main.top + main.height / 2 - (actions.top + actions.height / 2));
        })) <= 1,
      );
      const addMemoriesBox = await mobilePage.locator('[aria-label="Add memories"]').boundingBox();
      assert.ok(addMemoriesBox);
      assert.equal(
        Math.abs((await activationTrack.boundingBox())!.y + 12 - (addMemoriesBox.y + addMemoriesBox.height / 2)) <= 1,
        true,
      );
      assert.equal(await activation.getAttribute("title"), "Active in kirei");
      assert.equal((await activation.innerText()).trim(), "Active");
      assert.equal(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      await activation.click();
      assert.deepEqual(activationChanges, [false]);
      await mobilePage.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          enabledForChat: false,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      });
      await mobilePage.waitForFunction(
        () => document.querySelector('[data-ltm-control="activation"]')?.getAttribute("aria-checked") === "false",
      );
      assert.equal(await activation.getAttribute("aria-checked"), "false");
      assert.equal(await activation.getAttribute("title"), "Inactive in kirei");
      assert.equal((await activation.innerText()).trim(), "Inactive");
      const inactiveTrack = await activationTrack.evaluate((element) => {
        const style = getComputedStyle(element);
        const track = element.getBoundingClientRect();
        const knob = element.firstElementChild!.getBoundingClientRect();
        return {
          backgroundColor: style.backgroundColor,
          borderWidth: style.borderWidth,
          knobRight: knob.right - track.left,
          width: track.width,
        };
      });
      assert.notEqual(inactiveTrack.backgroundColor, "rgba(0, 0, 0, 0)");
      assert.equal(inactiveTrack.borderWidth, "1px");
      assert.ok(inactiveTrack.knobRight <= inactiveTrack.width);
      const longChatName = "A".repeat(200);
      await mobilePage.evaluate((chatName) => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = { ...element.capabilityProps, chatName };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      }, longChatName);
      await mobilePage.waitForFunction(
        (chatName) =>
          document.querySelector('[data-ltm-control="activation"]')?.getAttribute("aria-label") ===
          `Inactive in ${chatName}`,
        longChatName,
      );
      const longNameBox = await activation.boundingBox();
      assert.ok(longNameBox);
      assert.ok(longNameBox.width >= 40 && longNameBox.height >= 36);
      assert.equal(longNameBox.x + longNameBox.width <= 390, true);
      assert.equal(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      await mobilePage.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          chatId: null,
          chatName: null,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      });
      await mobilePage.waitForFunction(
        () =>
          document.querySelector('[data-ltm-control="activation"]')?.getAttribute("aria-label") ===
          "Inactive in this chat",
      );
      assert.equal(await activation.count(), 1);
      assert.equal(await activation.getAttribute("aria-checked"), "false");
      const mobileNavigation = mobilePage.locator('[data-ltm-navigation="mobile"]');
      const mobileNavigationItems = mobileNavigation.locator('[data-ltm-control="navigation"]');
      assert.equal(await mobileNavigationItems.count(), 4);
      for (const destination of ["vault", "review", "sources", "settings"])
        assert.equal(await mobileNavigation.locator(`[data-ltm-destination="${destination}"]`).count(), 1);
      const mobileNavigationLayout = await mobileNavigation.evaluate((navigation) => {
        const rect = navigation.getBoundingClientRect();
        const items = [...navigation.querySelectorAll<HTMLElement>('[data-ltm-control="navigation"]')];
        return {
          visible: getComputedStyle(navigation).display !== "none",
          columns: getComputedStyle(navigation).gridTemplateColumns.split(/\s+/u).length,
          hasSize: rect.width > 0 && rect.height > 0,
          fits: navigation.scrollWidth <= navigation.clientWidth + 1,
          touchTargets: items.every((item) => item.getBoundingClientRect().height >= 44),
          oneRow: new Set(items.map((item) => Math.round(item.getBoundingClientRect().y))).size === 1,
        };
      });
      assert.equal(mobileNavigationLayout.visible, true);
      assert.equal(mobileNavigationLayout.columns, 4);
      assert.equal(mobileNavigationLayout.hasSize, true);
      assert.equal(mobileNavigationLayout.fits, true);
      assert.equal(mobileNavigationLayout.touchTargets, true);
      assert.equal(mobileNavigationLayout.oneRow, true);
      await mobilePage.getByRole("button", { name: "Show setup guide" }).click();
      const onboardingFooter = mobilePage.locator("[data-ltm-onboarding-footer]");
      const footerCloseBox = await onboardingFooter.getByRole("button", { name: "Close" }).boundingBox();
      const footerNoteBox = await onboardingFooter.locator(":scope > p").boundingBox();
      assert.ok(footerCloseBox);
      assert.ok(footerNoteBox);
      assert.ok(footerNoteBox.x >= footerCloseBox.x + footerCloseBox.width);
      assert.ok(
        await mobilePage
          .locator('[data-ltm-surface="onboarding"] [data-ltm-control="button"]')
          .evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 44)),
      );
      assert.deepEqual(
        await mobilePage.locator("[data-ltm-onboarding-actions]").evaluate((actions) => {
          const buttons = [...actions.querySelectorAll(":scope > button")];
          return buttons.map((button) => {
            const actionRect = actions.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            return {
              left: Math.round(buttonRect.left - actionRect.left),
              right: Math.round(actionRect.right - buttonRect.right),
            };
          });
        }),
        [{ left: 0, right: 0 }],
      );
      await mobilePage.getByRole("button", { name: "Next: How recall works" }).click();
      await mobilePage.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      await mobilePage.getByRole("button", { name: "Continue without a chat" }).click();
      const mobileSourceButtons = mobilePage.locator("[data-ltm-source-choice] > button");
      assert.deepEqual(await mobileSourceButtons.allInnerTexts(), ["Chat Summary", "Lorebook", "Character"]);
      const sourceButtonPositions = async () =>
        mobileSourceButtons.evaluateAll((buttons) =>
          buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            return { left: rect.left, width: rect.width };
          }),
        );
      const initialSourceButtonPositions = await sourceButtonPositions();
      await mobilePage.getByRole("button", { name: "Lorebook" }).click();
      assert.deepEqual(await sourceButtonPositions(), initialSourceButtonPositions);
      await mobilePage.getByRole("button", { name: "Close" }).click();
      await mobilePage.locator('[data-ltm-surface="onboarding"]').waitFor({ state: "detached" });
      await mobileNavigation.locator('[data-ltm-destination="sources"]').click();
      await mobilePage.locator('[data-ltm-surface="sources"]').waitFor();
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
          innerWidth: 390,
          mobileMedia: true,
          visiblePanes: ["workbench"],
        },
      );
      await mobilePage.locator('[data-ltm-lorebook-entry="entry_mobile_harbor"]').waitFor();
      assert.equal(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      await mobileNavigation.locator('[data-ltm-destination="settings"]').click();
      await mobilePage.locator("#settings-tab-extraction").click();
      const mobileExtractionLayout = await mobilePage
        .locator("#settings-panel-extraction > [data-ltm-extraction-grid]")
        .evaluate((grid) => {
          const fields = [...grid.children].slice(0, 2) as HTMLElement[];
          const labels = fields.map((field) => field.firstElementChild as HTMLElement);
          const selects = fields.map((field) => field.querySelector("select")!);
          return {
            columns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/u).length,
            labelHeights: labels.map((label) => label.getBoundingClientRect().height),
            selectWidths: selects.map((select) => select.getBoundingClientRect().width),
            fieldWidths: fields.map((field) => field.getBoundingClientRect().width),
          };
        });
      assert.equal(mobileExtractionLayout.columns, 1);
      assert.deepEqual(mobileExtractionLayout.labelHeights, [44, 44]);
      assert.deepEqual(mobileExtractionLayout.selectWidths, mobileExtractionLayout.fieldWidths);
      await mobilePage.setViewportSize({ width: 320, height: 720 });
      assert.ok(
        await mobilePage.locator(".mari-editor-header").evaluate((header) => {
          const [main, actions] = [...header.children].map((child) => child.getBoundingClientRect());
          return (
            Math.abs(main.top + main.height / 2 - (actions.top + actions.height / 2)) <= 1 &&
            header.scrollWidth <= header.clientWidth
          );
        }),
      );
      await mobilePage.getByRole("button", { name: "Show setup guide" }).click();
      await mobilePage.evaluate(() => {
        document.documentElement.style.fontSize = "20px";
      });
      assert.deepEqual(
        await mobilePage.locator('[data-ltm-surface="onboarding"]').evaluate((onboarding) => {
          const title = onboarding.querySelector<HTMLElement>("#ltm-onboarding-title")!;
          const description = onboarding.querySelector<HTMLElement>("#ltm-onboarding-description")!;
          return {
            titleFits: title.scrollWidth <= title.clientWidth,
            descriptionFits: description.scrollWidth <= description.clientWidth,
            pageFits:
              onboarding.scrollWidth <= onboarding.clientWidth &&
              document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          };
        }),
        { titleFits: true, descriptionFits: true, pageFits: true },
      );
      assert.equal(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      await mobilePage.evaluate(() => {
        document.documentElement.style.fontSize = "";
      });
      await mobilePage.getByRole("button", { name: "Close" }).click();
      noteTotal = 0;
      const firstRunContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const firstRunPage = await firstRunContext.newPage();
      await firstRunPage.goto(`http://127.0.0.1:${address.port}/`);
      await firstRunPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
      await firstRunPage.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = {
          agent: { name: "Long-Term Memory" },
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      const firstRunGuide = firstRunPage.locator('[data-ltm-surface="onboarding"]');
      await firstRunGuide.waitFor();
      await firstRunGuide.getByRole("button", { name: "Next: How recall works" }).click();
      await firstRunGuide.getByRole("button", { name: "Next: Enabling it for the Current Chat" }).click();
      assert.match(await firstRunGuide.innerText(), /Continue without a chat/u);
      await firstRunGuide.getByRole("button", { name: "Continue without a chat" }).click();
      await firstRunGuide.getByRole("button", { name: "Next: Reviewing and saving memories" }).click();
      await firstRunGuide.getByRole("button", { name: "Next: Check it works" }).click();
      assert.equal(await firstRunGuide.getByRole("button", { name: "Choose a Source" }).count(), 1);
      await firstRunGuide.getByRole("button", { name: "Choose a Source" }).click();
      await firstRunPage.locator('[data-ltm-source-tab="characters"][aria-selected="true"]').waitFor();
      assert.equal(await firstRunPage.locator('[data-ltm-surface="onboarding"]').count(), 1);
      await firstRunPage.reload();
      await firstRunPage.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = {
          agent: { name: "Long-Term Memory" },
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      await firstRunPage.locator('[data-ltm-surface="detail"]').waitFor();
      assert.equal(await firstRunPage.locator('[data-ltm-surface="onboarding"]').count(), 1);
      await firstRunPage.getByRole("button", { name: "Show setup guide" }).click();
      await firstRunPage.locator('[data-ltm-surface="onboarding"]').waitFor();
      await firstRunContext.close();
      noteTotal = 3;
      await mobileContext.close();
      const { capabilityPackageManager } = await importEngine<{
        capabilityPackageManager: {
          install(
            id: string,
            expectedVersion: string,
            expectedArtifactSha256: string,
          ): Promise<{ version: string; previousVersion?: string }>;
          uninstall(id: string): Promise<unknown>;
        };
      }>("packages/server/src/services/capability-packages/package-manager.service.ts");
      const { buildApp } = await importEngine<{
        buildApp(): Promise<typeof app>;
      }>("packages/server/src/app.ts");
      const installed = await capabilityPackageManager.install(
        "long-term-memory",
        packageManifest.version,
        sha256(artifactBytes),
      );
      assert.equal(installed.version, artifactManifest.version);
      catalogOnline = false;
      app = await buildApp();
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: "/api/long-term-memory/status",
          })
        ).statusCode,
        200,
      );
      const note = {
        id: "world_artifact_lifecycle",
        title: "Artifact lifecycle fixture",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { characterIds: ["character-a"] },
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
        JSON.stringify({
          ...legacyState,
          lastPublishedGenerationId: "legacy-generation",
        }),
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
      assert.ok(!existsSync(join(dataDir, "capability-packages/versions/long-term-memory")));
      assertSnapshot(durableRoot, afterMigration);
      catalogOnline = true;
      const reinstalled = await capabilityPackageManager.install(
        "long-term-memory",
        packageManifest.version,
        sha256(artifactBytes),
      );
      assert.equal(reinstalled.version, artifactManifest.version);
      catalogOnline = false;
      app = await buildApp();
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: "/api/long-term-memory/status",
          })
        ).statusCode,
        200,
      );
      assertSnapshot(durableRoot, afterMigration);
      console.log(
        `Long-Term Memory ${packageManifest.version} lifecycle: install, offline restart, backup inclusion, uninstall, reinstall, and durable-byte preservation ok`,
      );
    },
    [
      () => releaseReextraction?.(),
      () => browser?.close(),
      () =>
        new Promise<void>((resolveClose, reject) => {
          if (!browserServer) return resolveClose();
          browserServer.close((error) => (error ? reject(error) : resolveClose()));
        }),
      () => app?.close(),
      () => {
        globalThis.fetch = originalFetch;
      },
      () => rmSync(dataDir, { recursive: true, force: true }),
    ],
  );
}
main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
