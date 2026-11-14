import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileEngineVisualStyles } from "./engine-visual-styles.ts";
import { buildPackageHostFixture } from "./package-host-fixture.ts";
import { runRegressionToCompletion, runWithSafeCleanup } from "./regression-helpers.ts";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const packageManifest = JSON.parse(readFileSync(join(repoRoot, "packages/long-term-memory/manifest.json"), "utf8")) as {
  version: string;
};
const artifactPath = join(repoRoot, `artifacts/long-term-memory-${packageManifest.version}.zip`);
const visualOutputDir = process.env.MARINARA_VISUAL_OUTPUT_DIR ? resolve(process.env.MARINARA_VISUAL_OUTPUT_DIR) : null;
function unzip(args: string[], purpose: string) {
  try {
    // The bundled client passed the 1 MiB default buffer.
    return execFileSync("unzip", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      throw new Error(`Cannot ${purpose}: unzip executable was not found; install unzip and retry.`);
    throw new Error(`Could not ${purpose}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}
// Recall keeps the fine-tuning controls in a closed "Advanced" section; open it before touching them.
async function openRecallAdvanced(page: { locator: (selector: string) => any }) {
  const advanced = page.locator("#settings-panel-recall [data-ltm-recall-advanced]");
  if (!(await advanced.evaluate((node: HTMLDetailsElement) => node.open))) await advanced.locator("> summary").click();
}
// Extraction keeps model tuning, Finish cut-off answers, AI keywords and Game Mode in a closed "Advanced" section.
async function openExtractionAdvanced(page: { locator: (selector: string) => any }) {
  const advanced = page.locator("#settings-panel-extraction [data-ltm-extraction-advanced]");
  if (!(await advanced.evaluate((node: HTMLDetailsElement) => node.open))) await advanced.locator("> summary").click();
}
// A finished action is an Engine toast (sonner), not a banner in the package. Older toasts with the same text can
// still be on screen for a few seconds, so the newest match is the one a step just raised. Sonner lists the newest
// toast first.
function toastWith(page: { locator: (selector: string) => any }, text: string | RegExp) {
  return page.locator("[data-sonner-toast]").filter({ hasText: text }).first();
}
// Count-free toast checks: mark the toasts on screen before an action, then wait for one that was not there. A toast
// that auto-dismisses meanwhile cannot skew the result, and React keeps an attribute it did not set.
async function markToasts(page: { evaluate: (fn: () => void) => any }) {
  await page.evaluate(() =>
    document.querySelectorAll("[data-sonner-toast]").forEach((toast) => toast.setAttribute("data-test-seen", "")),
  );
}
function newToast(page: { locator: (selector: string, options?: { hasText: string | RegExp }) => any }, text: string) {
  return page.locator("[data-sonner-toast]:not([data-test-seen])", { hasText: text });
}
// Troubleshooting is a closed section at the bottom of Memory Settings; open it before touching Reset, Delete all or the log.
async function openTroubleshooting(page: { locator: (selector: string) => any }) {
  const section = page.locator("#settings-panel-troubleshooting");
  if (!(await section.evaluate((node: HTMLDetailsElement) => node.open))) await section.locator("> summary").click();
}
// Activity is its own page in the memory workspace (whichever navigation is showing).
async function openActivityLog(page: { locator: (selector: string) => any }) {
  const tab = page.locator('[data-ltm-destination="activity"]:visible').first();
  if ((await tab.getAttribute("aria-current")) !== "page") await tab.click();
  await page.locator('[data-ltm-surface="activity"]').waitFor();
}
// Leaving Activity unmounts its view and coming back mounts a fresh one, which fetches the log again.
async function reopenActivityLog(page: { locator: (selector: string) => any }) {
  await page.locator('[data-ltm-destination="settings"]:visible').first().click();
  await page.locator('[data-ltm-surface="memory-settings"]').waitFor();
  await openActivityLog(page);
}
const artifactManifest = JSON.parse(
  unzip(["-p", artifactPath, "manifest.json"], `read ${artifactPath}/manifest.json`),
) as Record<string, unknown>;
const artifactClient = unzip(["-p", artifactPath, "client.js"], `read ${artifactPath}/client.js`);
async function main() {
  if (visualOutputDir) mkdirSync(visualOutputDir, { recursive: true });
  const engineStyles = await compileEngineVisualStyles(
    engineRoot,
    join(repoRoot, "packages/long-term-memory/src/engine/packages/client/src/**/*.{ts,tsx}"),
  );
  // The client takes React and React Query from the Engine's host namespace, which this bare page must provide first.
  // The Engine mounts the one sonner Toaster; the fixture page mounts the same so package toasts render.
  const hostScript = await buildPackageHostFixture(engineRoot, { toaster: true, agentStore: true });
  let browser: { close: () => Promise<void> } | null = null;
  let browserServer: ReturnType<typeof createServer> | null = null;
  let releaseReextraction: (() => void) | null = null;
  const reextractionRequests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const identityResolutionRequests: Array<{ id: string; choices: unknown }> = [];
  const resolvedIdentitySuggestionIds = new Set<string>();
  let identityResolutionFailures = 1;
  let markReextractionStarted: () => void = () => undefined;
  const reextractionStarted = new Promise<void>((resolve) => {
    markReextractionStarted = resolve;
  });
  await runWithSafeCleanup(
    "LTM browser",
    async () => {
      assert.equal(artifactManifest.id, "long-term-memory");
      assert.equal(artifactManifest.version, packageManifest.version);
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
      assert.match(
        artifactClient,
        /extract:[^,}]+!=="refresh"/u,
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
      const otherRejectedSuggestionId = "3b2c6d8e-0f1a-4b2c-9d3e-4f5a6b7c8d9e";
      const thirdRejectedSuggestionId = "4c3d7e9f-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
      const identityRejectedSuggestionId = "5d4e8f0a-2b3c-4d5e-9f60-7a8b9c0d1e2f";
      const skipIdentitySuggestionId = "6e5f901b-3c4d-5e6f-a071-8b9c0d1e2f3a";
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
      // Assigned to one branch of Conversation A, as saved before branches stopped being places (#1420).
      let outsideChatNote = {
        id: "world_outside_current_chat",
        title: "Memory outside current chat",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "memory-chat", chatIds: ["memory-chat"] } as Record<string, unknown>,
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
      };
      const availabilityPatches: Array<Record<string, unknown>> = [];
      // Set to hold the next legacy-global availability PATCH open, so a test can act while Save is running.
      let availabilityGate: Promise<void> | null = null;
      const branchAvailabilityPatches: Array<Record<string, unknown>> = [];
      const batchNotesCalls: Array<Record<string, unknown>> = [];
      const batchNotesFailure = false;
      let batchNotesPartial = false;
      let deletedSuggestionId: string | null = null;
      const clearedRejectedSourceIds = new Set<string>();
      let clearRejectedSuggestionsFailure = false;
      const scopeTargetQueries: string[] = [];
      const noteQueries: string[] = [];
      const sourcePreviewRequests: Record<string, unknown>[] = [];
      const lorebookPreviewRequests: Record<string, unknown>[] = [];
      const reviewContextQueries: string[] = [];
      const reviewQueries: string[] = [];
      const rejectedSuggestionQueries: string[] = [];
      const reviewActionCalls: Array<{
        action: "accept" | "skip";
        draftId: string;
        mutationIds: string[];
      }> = [];
      const reviewEditedMutationIds: string[][] = [];
      const deletedDraftIds: string[] = [];
      let failDraftDeletion = false;
      const reviewDraftIds = {
        first: "10000000-0000-4000-8000-000000000011",
        second: "10000000-0000-4000-8000-000000000012",
        recovery: "10000000-0000-4000-8000-000000000013",
        merge: "10000000-0000-4000-8000-000000000014",
        single: "10000000-0000-4000-8000-000000000015",
        blank: "10000000-0000-4000-8000-000000000016",
      };
      const reviewMutationIds = {
        first: "10000000-0000-4000-8000-000000000021",
        second: "10000000-0000-4000-8000-000000000022",
        partial: "10000000-0000-4000-8000-000000000023",
        merge: "10000000-0000-4000-8000-000000000024",
      };
      const makeReviewDraft = (
        draftId: string,
        mutationId?: string,
        title = "Review fixture memory",
        mutation?: Record<string, unknown> | Record<string, unknown>[],
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
          ? Array.isArray(mutation)
            ? mutation
            : [
                mutation ?? {
                  id: mutationId,
                  kind: "create_note",
                  claimKind: "static",
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
        evidence: ["source_note:source_mobile_review", "Rika: I have kept the lighthouse key."],
        noteId: "world_second_mobile",
        sectionKey: "facts",
        section: {
          text: "Updated second mobile review memory text.",
          importance: "major",
          updatedAt: "2026-07-30T00:00:00.000Z",
        },
      });
      const makePartialReviewMutation = () => ({
        id: reviewMutationIds.partial,
        kind: "create_note",
        claimKind: "static",
        risk: "low",
        confidence: 0.9,
        summary: "Pending partial review memory",
        evidence: ["source_note:source_mobile_review"],
        note: {
          id: "world_partial_mobile",
          title: "Pending partial review memory",
          type: "world",
          status: "active",
          modes: ["roleplay"],
          scope: {},
          tags: [],
          keywords: [],
          links: [],
          sections: {
            facts: {
              text: "Pending partial review memory content.",
              importance: "major",
              updatedAt: "2026-07-30T00:00:00.000Z",
            },
          },
        },
      });
      const makeMergeCreateMutation = () => {
        const mutation = makePartialReviewMutation();
        return {
          ...mutation,
          id: reviewMutationIds.merge,
          summary: "Merge proposed mobile memory",
          note: {
            ...mutation.note,
            id: "world_merge_proposal_mobile",
            title: "Merge proposed mobile memory",
          },
        };
      };
      const singleDraftTitle = `Single-source-mobile-memory-${"x".repeat(300)}`;
      let reviewSources: any[] = [
        {
          sourceNoteId: "source_mobile_recovery",
          modes: ["roleplay"],
          drafts: [
            {
              draft: {
                ...makeReviewDraft(reviewDraftIds.recovery, undefined, "Mobile recovery draft"),
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
          sourceNoteId: "source_mobile_single",
          modes: ["roleplay"],
          drafts: [
            {
              draft: {
                ...makeReviewDraft(reviewDraftIds.single, undefined, singleDraftTitle),
                summary: singleDraftTitle,
                source: {
                  sourceNoteId: "source_mobile_single",
                  chatId: "chat-a",
                },
              },
              freshness: "fresh",
              blockReasons: [],
              diagnostics: [],
              candidateRejections: [],
              deduplications: [],
            },
          ],
          targets: [],
        },
        {
          sourceNoteId: "source_mobile_blank",
          modes: ["roleplay"],
          drafts: [
            {
              draft: {
                ...makeReviewDraft(reviewDraftIds.blank),
                summary: " \t",
                source: {
                  sourceNoteId: "source_mobile_blank",
                  chatId: "chat-a",
                },
              },
              freshness: "fresh",
              blockReasons: [],
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
              draft: makeReviewDraft(reviewDraftIds.second, reviewMutationIds.second, "Second mobile review memory", [
                makeExistingReviewMutation(),
                makePartialReviewMutation(),
              ]),
              freshness: "fresh",
              blockReasons: [],
              diagnostics: [],
              candidateRejections: [],
              deduplications: [],
            },
            {
              draft: makeReviewDraft(
                reviewDraftIds.merge,
                reviewMutationIds.merge,
                "Merge proposed mobile memory",
                makeMergeCreateMutation(),
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
                    claimKind: "static",
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
            {
              noteId: "world_partial_mobile",
              title: "Pending partial review memory",
              noteType: "world",
              rows: [
                {
                  draftId: reviewDraftIds.second,
                  mutation: makePartialReviewMutation(),
                  disposition: "new",
                  diagnostics: [],
                  changes: [],
                },
              ],
            },
            {
              noteId: "world_merge_target_mobile",
              title: "Existing merge target",
              noteType: "world",
              rows: [
                {
                  draftId: reviewDraftIds.merge,
                  mutation: makeMergeCreateMutation(),
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
      let statusFailure = false;
      // Tidy with AI: what the preview answers, how many times it was asked, and the bodies of every apply.
      let tidyPreviewReply: { status: number; body: unknown } = { status: 200, body: {} };
      let tidyPreviewRequests = 0;
      const tidyPreviewBodies: string[] = [];
      // What each check's scope read (how many memories, which connection) answers; it reads, never sends.
      let tidyScopeReply: { status: number; body: unknown } = { status: 200, body: {} };
      let linksScopeReply: { status: number; body: unknown } = { status: 200, body: {} };
      let peopleScopeReply: { status: number; body: unknown } = { status: 200, body: {} };
      let holdTidyPreview: Promise<void> | null = null;
      const tidyApplyBodies: Array<{ noteIds: string[] }> = [];
      // Link older relationships: the same, for its own two routes.
      let linksPreviewReply: { status: number; body: unknown } = { status: 200, body: {} };
      let linksPreviewRequests = 0;
      const linksApplyBodies: Array<{ links: Array<{ relationshipId: string; personId: string }> }> = [];
      // Find duplicate people: the same again.
      let peoplePreviewReply: { status: number; body: unknown } = { status: 200, body: {} };
      let peoplePreviewRequests = 0;
      const peopleApplyBodies: Array<{ groups: Array<{ keepId: string; mergeIds: string[] }> }> = [];
      // Status reads left that report a rebuild still scheduled after a write (stale and dirty).
      let pendingRebuildReads = 0;
      let noteTotal = 5;
      const extractionWrites: Record<string, unknown>[] = [];
      let pendingDraftCount = 2;
      let failSecondReviewAccept = false;
      let holdReviewAccept: Promise<void> | null = null;
      let failReviewContext = false;
      let missingSourceReview = false;
      let linkCardSourceNote = false;
      const omitReviewContextId: string | null = null;
      let reviewPreflightBlocked = false;
      let reviewPreflightConflictOnly = false;
      let confirmReviewDiscard = false;
      let lastReviewDiscardMessage = "";
      let confirmDelete = false;
      let lastDeleteConfirmation: { title: string; message: string; confirmLabel?: string } | null = null;
      let notifyDeleteConfirmation: (() => void) | undefined;
      const permanentDeleteCalls: string[][] = [];
      let holdDeleteTargetLookup = false;
      let releaseDeleteTargetLookup: (() => void) | null = null;
      let reviewQueueEmpty = false;
      let reviewFingerprintRevision = 0;
      let lastInjectionRequests = 0;
      let lastInjectionHold: Promise<void> | null = null;
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
            `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/globals.css"><script type="module" src="/host.js"></script><script type="module" src="/client.js"></script>`,
            "text/html",
          );
        if (url.pathname === "/globals.css") return send(200, engineStyles, "text/css");
        if (url.pathname === "/host.js") return send(200, hostScript, "application/javascript");
        if (url.pathname === "/client.js") return send(200, artifactClient, "application/javascript");
        if (request.method === "GET" && url.pathname === "/api/connections") return send(200, []);
        // Onboarding art, so screenshots show Mari; every other sprite request used to 404 here.
        const sprite =
          /^\/api\/capability-packages\/long-term-memory\/assets\/assets\/onboarding\/([a-z0-9-]+\.webp)$/u.exec(
            url.pathname,
          );
        if (request.method === "GET" && sprite) {
          response.writeHead(200, { "content-type": "image/webp" });
          return response.end(readFileSync(join(repoRoot, "packages/long-term-memory/assets/onboarding", sprite[1]!)));
        }
        if (!url.pathname.startsWith("/api/long-term-memory/")) return send(404, {});
        if (request.method === "GET" && url.pathname.endsWith("/status") && statusFailure)
          return send(500, { error: "status fixture down" });
        if (request.method === "GET" && url.pathname.endsWith("/status")) {
          const rebuildPending = pendingRebuildReads > 0;
          if (rebuildPending) pendingRebuildReads -= 1;
          return send(200, {
            initialized: true,
            directory: "long-term-memory",
            notes: {
              total: noteTotal,
              sourceNotes: 1,
              savedMemories: Math.max(0, noteTotal - 1),
              pendingDrafts: pendingDraftCount,
              byType: {},
              byStatus: {},
            },
            events: { logAvailable: false, bytes: null },
            indexes: {
              health: rebuildPending ? "stale" : healthState,
              dirty: rebuildPending,
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
        }
        if (request.method === "GET" && url.pathname.endsWith("/settings")) return send(200, {});
        if (request.method === "PUT" && url.pathname.endsWith("/settings")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          // Echo the saved settings so the toggle-local Save can be observed end to end.
          return send(200, JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
        }
        if (request.method === "POST" && url.pathname.endsWith("/notes/batch")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as {
            noteIds: string[];
            status?: string;
            archive?: string;
            addScope?: Record<string, unknown>;
          };
          batchNotesCalls.push(body);
          if (batchNotesFailure) {
            return send(500, { error: "batch notes failed" });
          }
          if (batchNotesPartial) {
            if (body.status === "resolved") {
              return send(200, {
                status: "partial",
                requestedNoteIds: body.noteIds,
                updatedNoteIds: [],
                affectedNoteIds: [],
                skippedNoteIds: [],
                failedNoteIds: body.noteIds,
              });
            }
            return send(200, {
              status: "complete",
              requestedNoteIds: body.noteIds,
              updatedNoteIds: body.noteIds,
              affectedNoteIds: body.noteIds,
              skippedNoteIds: [],
              failedNoteIds: [],
            });
          }
          return send(200, {
            status: "complete",
            requestedNoteIds: body.noteIds,
            updatedNoteIds: body.noteIds,
            affectedNoteIds: body.noteIds,
            skippedNoteIds: [],
            failedNoteIds: [],
          });
        }
        if (request.method === "GET" && url.pathname.endsWith("/extraction-settings")) return send(200, {});
        if (request.method === "PUT" && url.pathname.endsWith("/extraction-settings")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          extractionWrites.push(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
          return send(200, extractionWrites.at(-1));
        }
        if (request.method === "GET" && url.pathname.endsWith("/integrity"))
          return send(200, { health: "healthy", ok: true, noteCount: 3, issues: [] });
        if (request.method === "GET" && url.pathname.endsWith("/tidy/scope"))
          return send(tidyScopeReply.status, tidyScopeReply.body);
        if (request.method === "GET" && url.pathname.endsWith("/links/scope"))
          return send(linksScopeReply.status, linksScopeReply.body);
        if (request.method === "GET" && url.pathname.endsWith("/people/scope"))
          return send(peopleScopeReply.status, peopleScopeReply.body);
        if (request.method === "POST" && url.pathname.endsWith("/tidy/preview")) {
          tidyPreviewRequests += 1;
          const bodyChunks: Buffer[] = [];
          for await (const chunk of request) bodyChunks.push(Buffer.from(chunk));
          tidyPreviewBodies.push(Buffer.concat(bodyChunks).toString("utf8"));
          await holdTidyPreview;
          return send(tidyPreviewReply.status, tidyPreviewReply.body);
        }
        if (request.method === "POST" && url.pathname.endsWith("/tidy/apply")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { noteIds: string[] };
          tidyApplyBodies.push(body);
          return send(200, { archived: body.noteIds, skipped: [], rebuild: null });
        }
        if (request.method === "POST" && url.pathname.endsWith("/links/preview")) {
          linksPreviewRequests += 1;
          return send(linksPreviewReply.status, linksPreviewReply.body);
        }
        if (request.method === "POST" && url.pathname.endsWith("/links/apply")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as (typeof linksApplyBodies)[number];
          linksApplyBodies.push(body);
          return send(200, { linked: body.links, skipped: [], rebuild: null });
        }
        if (request.method === "POST" && url.pathname.endsWith("/people/preview")) {
          peoplePreviewRequests += 1;
          return send(peoplePreviewReply.status, peoplePreviewReply.body);
        }
        if (request.method === "POST" && url.pathname.endsWith("/people/apply")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as (typeof peopleApplyBodies)[number];
          peopleApplyBodies.push(body);
          return send(200, {
            merged: body.groups,
            skipped: [],
            backup: { id: "backup-1", createdAt: "2026-10-20T00:00:00.000Z" },
            rebuild: null,
          });
        }
        // soup/review-identity: Review checks for duplicate people on mount; the default answer has none.
        if (request.method === "POST" && url.pathname.endsWith("/identity-repair/preview"))
          return send(200, {
            generatedAt: "2026-01-01T00:00:00.000Z",
            scope: { kind: "global" },
            counts: { analyzedNotes: 0, candidateCount: 0, bindableNotes: 0, duplicateNotes: 0, unresolvedNotes: 0 },
            candidates: [],
            unresolved: [],
          });
        if (request.method === "GET" && url.pathname.endsWith("/drafts/pending-count"))
          // soup/review-one-press: `count` is waiting sources, `mutations` the memories waiting in them (3 each here).
          return send(200, { count: pendingDraftCount, mutations: pendingDraftCount * 3 });
        if (request.method === "GET" && url.pathname.endsWith("/last-injection/chat-artifact")) {
          lastInjectionRequests += 1;
          if (lastInjectionRequests === 1)
            return send(200, {
              memoryCount: 1,
              tokenCount: 42,
              memories: [
                {
                  noteId: "retained-memory",
                  title: "Retained memory",
                  tokenCount: 42,
                },
              ],
            });
          // Keep the failure in flight briefly so the retry's disabled guard is observable.
          await (lastInjectionHold ?? new Promise((resolve) => setTimeout(resolve, 120)));
          return send(503, { error: "latest recall failed" });
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
            sources: reviewQueueEmpty
              ? []
              : reviewSources.map((source) => ({
                  ...source,
                  drafts: source.drafts.map((item: any) => ({
                    ...item,
                    draft: {
                      ...item.draft,
                      updatedAt: reviewFingerprintRevision ? "2026-07-30T00:00:01.000Z" : item.draft.updatedAt,
                    },
                  })),
                })),
            counts: {
              sources: reviewQueueEmpty ? 0 : reviewSources.length,
              drafts: reviewQueueEmpty ? 0 : reviewSources.reduce((count, source) => count + source.drafts.length, 0),
              mutations: reviewQueueEmpty
                ? 0
                : reviewSources.reduce(
                    (count, source) =>
                      count +
                      source.drafts.reduce(
                        (draftCount: number, item: any) => draftCount + item.draft.mutations.length,
                        0,
                      ),
                    0,
                  ),
              blockedDrafts: reviewQueueEmpty
                ? 0
                : reviewSources.reduce(
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
            memoryPresence: [
              { chatId: "memory-chat", chatIds: ["memory-chat"] },
              { characterIds: ["character-a"] },
              { personaId: "persona-a", personaIds: ["persona-a"] },
            ],
            chats: [
              {
                id: "desktop-chat",
                label: "Current Final Branch",
                mode: "conversation",
                groupId: null,
                personaId: "persona-a",
                characterIds: ["character-a"],
              },
              {
                id: "memory-chat",
                label: "Member Final Branch",
                chatName: "Memory Conversation",
                mode: "roleplay",
                groupId: "conversation-a",
                personaId: "persona-a",
                characterIds: ["character-a"],
              },
              {
                id: "memory-conversation-branch",
                label: "Memory conversation branch",
                chatName: "Memory Conversation",
                mode: "conversation",
                groupId: "conversation-a",
                personaId: "persona-a",
                characterIds: ["character-a"],
              },
              ...Array.from({ length: 100 }, (_, index) => ({
                id: `bulk-chat-${index}`,
                label: `Bulk chat ${index}`,
                mode: "conversation",
                groupId: null,
                personaId: null,
                characterIds: [],
              })),
            ],
            groups: [
              {
                id: "conversation-a",
                label: "Conversation A",
                chatIds: ["memory-chat", "memory-conversation-branch"],
              },
              {
                id: "valid-group",
                label: "Valid group",
                chatIds: Array.from({ length: 100 }, (_, index) => `valid-group-chat-${index}`),
              },
              {
                id: "overflow-group",
                label: "Overflow group",
                chatIds: Array.from({ length: 101 }, (_, index) => `overflow-group-chat-${index}`),
              },
            ],
            characters: [{ id: "character-a", label: "Character A" }],
            personas: [
              { id: "persona-a", label: "Persona A", comment: "Space explorer" },
              { id: "persona-b", label: "Persona A", comment: "Private detective" },
            ],
          });
        }
        if (request.method === "GET" && url.pathname.endsWith("/notes")) {
          noteQueries.push(url.search);
          // A fresh install (status total 0) has an empty Vault, which is where setup is offered.
          if (noteTotal === 0) return send(200, []);
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
              links: [{ target: "world_outside_current_chat", relation: "involves" }],
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
              id: "world_merge_target_mobile",
              title: "Existing merge target",
              type: "world",
              status: "active",
              modes: ["roleplay"],
              scope: {},
              tags: [],
              keywords: [],
              links: [],
              sections: {
                facts: {
                  text: "Existing merge target text.",
                  importance: "major",
                  updatedAt: "2026-07-30T00:00:00.000Z",
                },
              },
              createdAt: "2026-07-30T00:00:00.000Z",
              updatedAt: "2026-07-30T00:00:00.000Z",
              version: 1,
            },
            outsideChatNote,
            {
              id: "source_mobile_recovery",
              title: "Mobile recovery source",
              type: "source",
              status: "active",
              modes: ["roleplay"],
              scope: {},
              tags: [],
              keywords: [],
              links: [],
              sections: { source: { text: "Mobile recovery source text.", updatedAt: noteTimestamp } },
              createdAt: noteTimestamp,
              updatedAt: noteTimestamp,
              version: 1,
            },
            {
              id: "source_mobile_single",
              title: "Single-draft mobile source",
              type: "source",
              status: "active",
              modes: ["roleplay"],
              scope: {},
              tags: [],
              keywords: [],
              links: [],
              sections: { source: { text: "Single-draft mobile source text.", updatedAt: noteTimestamp } },
              createdAt: noteTimestamp,
              updatedAt: noteTimestamp,
              version: 1,
            },
            {
              id: "source_mobile_blank",
              title: "Blank-summary mobile source",
              type: "source",
              status: "active",
              modes: ["roleplay"],
              scope: {},
              tags: [],
              keywords: [],
              links: [],
              sections: { source: { text: "Blank-summary mobile source text.", updatedAt: noteTimestamp } },
              createdAt: noteTimestamp,
              updatedAt: noteTimestamp,
              version: 1,
            },
            {
              id: "world_mobile_recovery",
              title: "Mobile recovery memory",
              type: "world",
              status: "resolved",
              modes: ["roleplay"],
              scope: {},
              tags: [],
              keywords: [],
              links: [],
              sections: { facts: { text: "Mobile recovery memory text.", updatedAt: noteTimestamp } },
              createdAt: noteTimestamp,
              updatedAt: noteTimestamp,
              version: 1,
            },
            legacyGlobalNote,
            scopedDesktopNote,
            ...(linkCardSourceNote
              ? [
                  {
                    id: "source_link_cards",
                    title: "Link card source",
                    type: "source",
                    status: "active",
                    modes: ["roleplay"],
                    scope: {},
                    tags: [],
                    keywords: [],
                    links: [],
                    sections: { source: { text: "Link card source text.", updatedAt: noteTimestamp } },
                    createdAt: noteTimestamp,
                    updatedAt: noteTimestamp,
                    version: 1,
                  },
                ]
              : []),
          ];
          if (url.searchParams.has("ids")) {
            reviewContextQueries.push(url.search);
            if (failReviewContext) return send(503, { error: "review context temporarily unavailable" });
            if (holdDeleteTargetLookup) {
              holdDeleteTargetLookup = false;
              await new Promise<void>((resolveHold) => {
                releaseDeleteTargetLookup = resolveHold;
              });
            }
            const requestedIds = new Set(url.searchParams.get("ids")?.split(",") ?? []);
            return send(
              200,
              notes.filter((note) => requestedIds.has(note.id) && note.id !== omitReviewContextId),
            );
          }
          const requestedChatIds = url.searchParams.get("scopeChatIds")?.split(",") ?? [];
          return send(
            200,
            url.searchParams.get("scopeGroupId") === "conversation-a"
              ? notes.filter((note) =>
                  ((note.scope as { chatIds?: string[] }).chatIds ?? []).some((id) => requestedChatIds.includes(id)),
                )
              : url.searchParams.get("scopeCharacterIds") === "character-a"
                ? notes.filter((note) => note.id === "world_second_mobile")
                : url.searchParams.get("scopeChatIds") === "desktop-chat"
                  ? notes.filter((note) => note.id !== "world_outside_current_chat")
                  : url.searchParams.get("scopePersonaId") === "persona-b"
                    ? []
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
            links: [{ target: "world_outside_current_chat", relation: "involves" }],
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
        if (request.method === "GET" && url.pathname.endsWith("/notes/world_merge_target_mobile"))
          return send(200, {
            id: "world_merge_target_mobile",
            title: "Existing merge target",
            type: "world",
            status: "active",
            modes: ["roleplay"],
            scope: {},
            tags: [],
            keywords: [],
            links: [],
            sections: {
              facts: {
                text: "Existing merge target text.",
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
        if (request.method === "GET" && url.pathname.endsWith(`/notes/${outsideChatNote.id}`))
          return send(200, outsideChatNote);
        if (request.method === "PATCH" && url.pathname.endsWith(`/notes/${outsideChatNote.id}`)) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const patch = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          branchAvailabilityPatches.push(patch);
          outsideChatNote = {
            ...outsideChatNote,
            ...patch,
            updatedAt: noteTimestamp,
            version: outsideChatNote.version + 1,
          };
          return send(200, { note: outsideChatNote });
        }
        if (request.method === "PATCH" && url.pathname.endsWith(`/notes/${legacyGlobalNote.id}`)) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const patch = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          availabilityPatches.push(patch);
          if (availabilityGate) await availabilityGate;
          legacyGlobalNote = {
            ...legacyGlobalNote,
            ...patch,
            updatedAt: noteTimestamp,
            version: legacyGlobalNote.version + 1,
          };
          return send(200, { note: legacyGlobalNote });
        }
        if (request.method === "POST" && url.pathname.endsWith("/import/preview")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          const pagedCharacters = body.source === "characters" && !body.query;
          if (pagedCharacters && body.cursor === "characters-page-2") {
            return send(200, {
              source: "characters",
              scanned: 1,
              draftable: 1,
              importedCount: 0,
              samples: [
                {
                  sourceId: "character-next-page",
                  title: "Next page character",
                  importMode: "roleplay",
                  mutationCount: 1,
                  summary: "A source beyond the initial page.",
                  snippet: "Append this source without losing the previous selection.",
                  status: "pending",
                  freshness: "new",
                },
              ],
              totals: { matches: 3, ready: 2, imported: 1 },
              truncated: false,
              hasMore: false,
              nextCursor: null,
            });
          }
          if (body.source === "chats" && body.query === "Lanterns") {
            const chatName = "My Very Long Adventure With Some Friends In The City Of A Thousand Lanterns";
            const summaryRows = [
              { id: "numbered", label: "msgs 1-120", messageRange: { chatName, first: 1, last: 120 } },
              { id: "session", label: "msgs game session 3", summaryRange: { chatName, label: "game session 3" } },
              { id: "day", label: "msgs 27.07.2026", summaryRange: { chatName, label: "27.07.2026" } },
            ];
            return send(200, {
              source: "chats",
              scanned: 3,
              draftable: 3,
              importedCount: 0,
              samples: summaryRows.map(({ id, label, ...range }) => ({
                sourceId: `chat-long:${id}`,
                title: `${chatName}, ${label}`,
                ...range,
                importMode: "roleplay",
                mutationCount: 0,
                summary: `Import ${chatName}, ${label}`,
                snippet: "A summary of a long chat.",
                status: "pending",
                freshness: "new",
              })),
              totals: { matches: 3, ready: 3, imported: 0 },
              truncated: false,
              hasMore: false,
              nextCursor: null,
            });
          }
          if (body.source === "messages") {
            const chatName = "My Very Long Adventure With Some Friends In The City Of A Thousand Lanterns";
            return send(200, {
              source: "messages",
              scanned: 2,
              draftable: 2,
              importedCount: 0,
              samples: [
                [1, 120],
                [121, 121],
              ].map(([first, last]) => ({
                sourceId: `chat-long:messages:m${first}`,
                title: `${chatName}, ${first === last ? "message" : "messages"} ${first === last ? first : `${first}-${last}`}`,
                messageRange: { chatName, first, last },
                importMode: "roleplay",
                mutationCount: 0,
                summary: "Messages from a long chat.",
                snippet: "Aster: the lanterns light.",
                status: "pending",
                freshness: "new",
              })),
              totals: { matches: 2, ready: 2, imported: 0 },
              truncated: false,
              hasMore: false,
              nextCursor: null,
            });
          }
          return send(200, {
            source: body.source ?? "chats",
            scanned: 2,
            draftable: 1,
            importedCount: 1,
            samples: [
              {
                sourceId: "chat-a:summary-desktop-reextract",
                title: "Desktop re-extract source",
                importMode: "conversation",
                mutationCount: 0,
                summary: "An imported source held open for re-extraction.",
                snippet: "The re-extract action should show progress.",
                status: "imported",
                freshness: "current",
                existingNoteId: "source_desktop_reextract",
                existingNoteTitle: "Desktop re-extract source",
              },
              {
                sourceId: "character-outside-current-chat",
                title: "Character outside current chat",
                importMode: "roleplay",
                mutationCount: 1,
                summary: "A character source from another chat.",
                snippet: "This character remains available outside the active chat.",
                status: "pending",
                freshness: "new",
              },
            ],
            totals: { matches: pagedCharacters ? 3 : 2, ready: pagedCharacters ? 2 : 1, imported: 1 },
            truncated: pagedCharacters,
            hasMore: pagedCharacters,
            nextCursor: pagedCharacters ? "characters-page-2" : null,
          });
        }
        if (request.method === "POST" && url.pathname.endsWith("/import/lorebooks/preview")) {
          const books = [
            {
              id: "lorebook_mobile_fixture",
              name: "Mobile Field Guide",
              description: "A populated lorebook used to verify responsive source browsing.",
              category: "Reference",
              tags: ["mobile", "test"],
              scope: {},
              counts: { entries: 1, candidates: 1, pending: 1, imported: 0 },
              totals: { entries: 1, candidates: 1, pending: 1, imported: 0 },
              entries: [
                {
                  id: "entry_mobile_harbor",
                  name: "Harbor Signals",
                  candidateCount: 1,
                  candidates: [
                    {
                      sourceId: "lorebook_mobile_fixture:entry_mobile_harbor:0",
                      title: "Mobile Field Guide: Harbor Signals",
                      importMode: "roleplay",
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
            {
              id: "lorebook_outside_current_chat",
              name: "Lorebook outside current chat",
              description: "A lorebook source from another chat.",
              category: "Reference",
              tags: ["scope", "test"],
              scope: {},
              counts: { entries: 1, candidates: 1, pending: 1, imported: 0 },
              totals: { entries: 1, candidates: 1, pending: 1, imported: 0 },
              entries: [
                {
                  id: "entry_outside_current_chat",
                  name: "Outside Chat Entry",
                  candidateCount: 1,
                  candidates: [
                    {
                      sourceId: "lorebook_outside_current_chat:entry_outside_current_chat:0",
                      title: "Lorebook outside current chat: Outside Chat Entry",
                      importMode: "roleplay",
                      mutationCount: 1,
                      summary: "A lorebook entry from another chat.",
                      snippet: "This entry remains available outside the active chat.",
                      status: "pending",
                      freshness: "new",
                    },
                  ],
                },
              ],
            },
          ];
          return send(200, {
            counts: {
              books: books.length,
              entries: books.reduce((count, book) => count + book.counts.entries, 0),
              candidates: books.reduce((count, book) => count + book.counts.candidates, 0),
              pending: books.reduce((count, book) => count + book.counts.pending, 0),
              imported: books.reduce((count, book) => count + book.counts.imported, 0),
            },
            books,
            totals: {
              books: books.length,
              entries: books.reduce((count, book) => count + book.counts.entries, 0),
              candidates: books.reduce((count, book) => count + book.counts.candidates, 0),
              pending: books.reduce((count, book) => count + book.counts.pending, 0),
              imported: books.reduce((count, book) => count + book.counts.imported, 0),
            },
            truncated: false,
          });
        }
        if (request.method === "GET" && url.pathname.endsWith("/rejected-suggestions")) {
          rejectedSuggestionQueries.push(url.search);
          if (url.searchParams.has("chatId")) return send(200, { suggestions: [], total: 0 });
          const suggestions = reviewQueueEmpty
            ? []
            : [
                {
                  id: rejectedSuggestionId,
                  fingerprint: "a".repeat(64),
                  source: { sourceNoteId: "source_mobile_recovery" },
                  scope: {},
                  modes: ["roleplay"],
                  candidate: {
                    index: 0,
                    reason: "invalid_format",
                    validatorCode: "invalid_evidence_unit_format",
                    message: "A recoverable mobile memory.",
                    snippet: "A recoverable mobile memory.",
                    issues: ["units.0.text: Required"],
                    recovery: {
                      noteType: "world",
                      noteId: "world_mobile_recovery",
                      sectionKey: "facts",
                    },
                  },
                  createdAt: "2026-07-30T00:00:00.000Z",
                  lastSeenAt: "2026-07-30T00:00:00.000Z",
                },
                {
                  id: otherRejectedSuggestionId,
                  fingerprint: "b".repeat(64),
                  source: { sourceNoteId: "source_mobile_single" },
                  scope: {},
                  modes: ["roleplay"],
                  candidate: {
                    index: 1,
                    reason: "unsupported_bucket",
                    validatorCode: "scene_only_tone_or_anchor",
                    message: "Tone and anchor candidates must describe durable atmosphere, motifs, or callbacks.",
                    snippet: "The observatory felt tense tonight.",
                  },
                  createdAt: "2026-07-30T00:00:00.000Z",
                  lastSeenAt: "2026-07-30T00:00:00.000Z",
                },
                {
                  id: thirdRejectedSuggestionId,
                  fingerprint: "c".repeat(64),
                  source: { sourceNoteId: missingSourceReview ? "source_orphaned_suggestion" : "source_mobile_blank" },
                  scope: {},
                  modes: ["roleplay"],
                  candidate: {
                    index: 2,
                    reason: "missing_source_evidence",
                    validatorCode: "missing_evidence",
                    message: "Evidence unit must reference the source note evidence.",
                    snippet: "A blank-source suggestion.",
                  },
                  createdAt: "2026-07-30T00:00:00.000Z",
                  lastSeenAt: "2026-07-30T00:00:00.000Z",
                },
                {
                  id: identityRejectedSuggestionId,
                  fingerprint: "d".repeat(64),
                  source: { sourceNoteId: "source_mobile_recovery" },
                  scope: { characterIds: ["character-a"] },
                  modes: ["roleplay"],
                  candidate: {
                    index: 3,
                    reason: "ambiguous_subject",
                    message: "An extracted relationship with two participants.",
                    snippet: "Ari trusts Mira.",
                    identityReview: [
                      {
                        name: "Ari",
                        candidates: [
                          {
                            name: "Ari",
                            subject: { key: "character:character-a", ref: { kind: "character", id: "character-a" } },
                          },
                          {
                            name: "Ari",
                            subject: { key: "persona:persona-a", ref: { kind: "persona", id: "persona-a" } },
                          },
                          {
                            name: "Ari",
                            subject: { key: "character:character-c", ref: { kind: "character", id: "character-c" } },
                          },
                        ],
                        allowDifferent: false,
                      },
                      {
                        name: "Mira",
                        candidates: [
                          {
                            name: "Mira",
                            subject: { key: "character:character-b", ref: { kind: "character", id: "character-b" } },
                          },
                        ],
                        allowDifferent: true,
                      },
                    ],
                  },
                  createdAt: "2026-07-30T00:00:00.000Z",
                  lastSeenAt: "2026-07-30T00:00:00.000Z",
                },
                {
                  id: skipIdentitySuggestionId,
                  fingerprint: "e".repeat(64),
                  source: { sourceNoteId: "source_mobile_recovery" },
                  scope: { characterIds: ["character-a"] },
                  modes: ["roleplay"],
                  candidate: {
                    index: 4,
                    reason: "ambiguous_subject",
                    message: "An extracted fact for one participant.",
                    snippet: "Nox lives nearby.",
                    identityReview: [
                      {
                        name: "Nox",
                        candidates: [
                          {
                            name: "Nox",
                            subject: { key: "character:character-a", ref: { kind: "character", id: "character-a" } },
                          },
                        ],
                        allowDifferent: true,
                      },
                    ],
                  },
                  createdAt: "2026-07-30T00:00:00.000Z",
                  lastSeenAt: "2026-07-30T00:00:00.000Z",
                },
              ].filter(
                (suggestion) =>
                  !clearedRejectedSourceIds.has(suggestion.source.sourceNoteId) &&
                  suggestion.id !== deletedSuggestionId &&
                  !resolvedIdentitySuggestionIds.has(suggestion.id),
              );
          return send(200, { suggestions, total: suggestions.length });
        }
        if (request.method === "POST" && url.pathname.endsWith("/resolve-identity")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const id = decodeURIComponent(url.pathname.split("/").at(-2)!);
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { choices?: unknown };
          identityResolutionRequests.push({ id, choices: body.choices });
          if (identityResolutionFailures > 0) {
            identityResolutionFailures -= 1;
            return send(500, { error: "Identity choice fixture failed" });
          }
          resolvedIdentitySuggestionIds.add(id);
          return send(200, { resolved: true, suggestionId: id, draft: null });
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
        if (request.method === "POST" && url.pathname.endsWith("/notes/permanent-delete")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { ids?: string[] };
          const ids = body.ids ?? [];
          permanentDeleteCalls.push(ids);
          return send(200, { deletedIds: ids });
        }
        if (request.method === "POST" && url.pathname.endsWith("/import/source-notes")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            source: string;
            sourceIds: string[];
          };
          return send(200, {
            operationId: "00000000-0000-4000-8000-000000000001",
            batchStatus: "failed",
            source: body.source,
            imported: [],
            writeFailures: [],
            missingSourceIds: body.sourceIds,
            counts: {
              requested: body.sourceIds.length,
              sourceNotesWritten: 0,
              succeeded: 0,
              failed: 0,
              cancelled: 0,
              missing: body.sourceIds.length,
              sourceWriteFailed: 0,
            },
          });
        }
        if (request.method === "POST" && url.pathname.endsWith("/notes/source_desktop_reextract/extract")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          reextractionRequests.push({
            path: url.pathname,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>,
          });
          if (reextractionRequests.length === 1)
            return await new Promise<void>((resolve) => {
              releaseReextraction = () => {
                releaseReextraction = null;
                send(500, { error: "Re-extraction fixture failed once" });
                resolve();
              };
              markReextractionStarted();
            });
          return send(200, {
            operationId: "00000000-0000-4000-8000-000000000002",
            draft: null,
            diagnostics: [],
            outcome: {
              state: "no_suggestions_created",
              totalCandidates: 0,
              keptUnits: 0,
              droppedUnits: 0,
              droppedCandidates: [],
            },
            accounting: {
              providerCandidates: 0,
              normalizedAdditions: 0,
              parserRejections: 0,
              validationRejections: 0,
              deduplications: 0,
              keptUnits: 0,
            },
            response: { summary: "No durable suggestions found.", mutations: [] },
            appliedMutationIds: [],
            skippedMutationIds: [],
          });
        }
        if (request.method === "POST" && url.pathname.endsWith("/preflight")) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            mutationIds?: string[];
          };
          const mutationIds = body.mutationIds ?? [];
          const targetByMutationId: Record<string, string> = {
            [reviewMutationIds.first]: "world_new_mobile",
            [reviewMutationIds.second]: "world_second_mobile",
            [reviewMutationIds.partial]: "world_partial_mobile",
          };
          const blockedMutationIds = reviewPreflightBlocked ? [reviewMutationIds.second] : [];
          const conflictMutationIds =
            reviewPreflightBlocked || reviewPreflightConflictOnly ? [reviewMutationIds.partial] : [];
          return send(200, {
            draftId: decodeURIComponent(url.pathname.split("/").at(-2)!),
            selectedMutationIds: mutationIds,
            readyMutationIds: mutationIds.filter((id) => !blockedMutationIds.includes(id)),
            blockedMutationIds,
            autoIncludedMutationIds: [],
            rows: mutationIds.map((mutationId) => ({
              mutationId,
              targetId: targetByMutationId[mutationId] ?? `world_${mutationId.slice(-3)}`,
              disposition: "new",
              status: blockedMutationIds.includes(mutationId) ? "blocked" : "ready",
              autoIncluded: false,
              blockers: blockedMutationIds.includes(mutationId)
                ? [{ code: "preflight_blocked", message: "Fixture preflight blocked this mutation." }]
                : [],
              conflicts: conflictMutationIds.includes(mutationId)
                ? [
                    {
                      field: "facts",
                      existing: "Existing fixture value",
                      proposed: "Proposed fixture value",
                      resolution: "pending",
                      policy: "manual review",
                    },
                  ]
                : [],
            })),
          });
        }
        if (request.method === "POST" && (url.pathname.endsWith("/accept") || url.pathname.endsWith("/skip"))) {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            mutationIds?: string[];
            editedMutations?: Array<{ id: string }>;
          };
          const action = url.pathname.endsWith("/accept") ? "accept" : "skip";
          const draftId = decodeURIComponent(url.pathname.split("/").at(-2)!);
          const mutationIds = body.mutationIds ?? [];
          reviewEditedMutationIds.push((body.editedMutations ?? []).map((mutation) => mutation.id));
          reviewActionCalls.push({ action, draftId, mutationIds });
          if (action === "accept" && holdReviewAccept) await holdReviewAccept;
          if (
            action === "accept" &&
            draftId === reviewDraftIds.second &&
            mutationIds.includes(reviewMutationIds.second)
          ) {
            if (failSecondReviewAccept) return send(503, { error: "temporary review failure" });
            reviewSources = reviewSources.map((source) => ({
              ...source,
              drafts: source.drafts.map((item: any) =>
                item.draft.id === draftId
                  ? {
                      ...item,
                      draft: {
                        ...item.draft,
                        updatedAt: "2026-07-30T00:00:01.000Z",
                        appliedMutationIds: [reviewMutationIds.second],
                        mutations: item.draft.mutations.filter(
                          (mutation: any) => mutation.id === reviewMutationIds.partial,
                        ),
                      },
                    }
                  : item,
              ),
              targets: source.targets.map((target: any) => ({
                ...target,
                rows: target.rows.filter(
                  (row: any) => row.draftId !== draftId || row.mutation.id === reviewMutationIds.partial,
                ),
              })),
            }));
          } else if (
            action === "accept" &&
            draftId === reviewDraftIds.second &&
            mutationIds.includes(reviewMutationIds.partial)
          ) {
            reviewSources = reviewSources
              .map((source) => ({
                ...source,
                drafts: source.drafts.map((item: any) =>
                  item.draft.id === draftId
                    ? {
                        ...item,
                        draft: {
                          ...item.draft,
                          mutations: item.draft.mutations.filter(
                            (mutation: any) => mutation.id !== reviewMutationIds.partial,
                          ),
                        },
                      }
                    : item,
                ),
                targets: source.targets.map((target: any) => ({
                  ...target,
                  rows: target.rows.filter(
                    (row: any) => row.draftId !== draftId || row.mutation.id !== reviewMutationIds.partial,
                  ),
                })),
              }))
              .filter((source) => source.drafts.some((item: any) => item.draft.mutations.length > 0));
          } else if (action === "skip" && draftId === reviewDraftIds.merge) {
            reviewSources = reviewSources
              .map((source) => ({
                ...source,
                drafts: source.drafts
                  .filter((item: any) => item.draft.id !== draftId)
                  .map((item: any) =>
                    item.draft.id === reviewDraftIds.second
                      ? {
                          ...item,
                          draft: {
                            ...item.draft,
                            mutations: item.draft.mutations.filter(
                              (mutation: any) => mutation.id !== reviewMutationIds.partial,
                            ),
                          },
                        }
                      : item,
                  ),
                targets: source.targets.map((target: any) => ({
                  ...target,
                  rows: target.rows.filter(
                    (row: any) =>
                      row.draftId !== reviewDraftIds.second || row.mutation.id !== reviewMutationIds.partial,
                  ),
                })),
              }))
              .filter((source) => source.drafts.some((item: any) => item.draft.mutations.length > 0));
          } else {
            reviewSources = reviewSources
              .map((source) => ({
                ...source,
                drafts: source.drafts.filter((item: any) => item.draft.id !== draftId),
              }))
              .filter((source) => source.drafts.length > 0);
          }
          return action === "accept"
            ? send(200, {
                appliedMutationIds: mutationIds,
                skippedMutationIds: [],
                autoIncludedMutationIds: [],
                indexRebuild: { status: "not_requested" },
              })
            : send(200, {
                mutationIds:
                  draftId === reviewDraftIds.merge
                    ? [...new Set([...mutationIds, reviewMutationIds.partial])]
                    : mutationIds,
              });
        }
        if (request.method === "DELETE" && url.pathname.startsWith("/api/long-term-memory/drafts/")) {
          if (failDraftDeletion) return send(503, { error: "Draft deletion fixture failed" });
          const draftId = decodeURIComponent(url.pathname.split("/").at(-1)!);
          deletedDraftIds.push(draftId);
          reviewSources = reviewSources
            .map((source) => ({
              ...source,
              drafts: source.drafts.filter((item: any) => item.draft.id !== draftId),
              targets: source.targets.map((target: any) => ({
                ...target,
                rows: target.rows.filter((row: any) => row.draftId !== draftId),
              })),
            }))
            .filter((source) => source.drafts.length > 0);
          return send(200, { deleted: true, id: draftId });
        }
        if (request.method === "DELETE" && url.pathname.includes("/rejected-suggestions/")) {
          deletedSuggestionId = decodeURIComponent(url.pathname.split("/").at(-1)!);
          return send(200, { deleted: true, id: deletedSuggestionId });
        }
        if (request.method === "DELETE" && url.pathname.endsWith("/rejected-suggestions")) {
          const sourceNoteId = url.searchParams.get("sourceNoteId");
          if (clearRejectedSuggestionsFailure) return send(500, { error: "Clear rejected suggestions fixture failed" });
          clearedRejectedSourceIds.add(sourceNoteId ?? "");
          return send(200, { deletedCount: 1, sourceNoteId });
        }
        return send(404, {});
      });
      await new Promise<void>((resolveListen) => browserServer!.listen(0, "127.0.0.1", resolveListen));
      const address = browserServer.address();
      assert.ok(address && typeof address !== "string");
      browser = await chromium.launch({ args: ["--disable-gpu"] });
      const browserContext = await browser.newContext({ hasTouch: true });
      const page = await browserContext.newPage();
      // #1588: "fits" when a touch target is at least 2.75rem (44px) both ways, else its size.
      const touchTargetSize = (target: ReturnType<typeof page.locator>) =>
        target.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width >= 44 && rect.height >= 44 ? "fits" : `${rect.width}x${rect.height}`;
        });
      // #1659: the visible tabs and compact actions inside a surface that are shorter than 2.75rem (44px).
      // The Engine's unlayered .mari-editor-tab and --compact min-heights beat the min-h-11 utilities.
      const shortTouchTargets = (surface: string) =>
        page.locator(surface).evaluate((root) =>
          [...root.querySelectorAll<HTMLElement>('[role="tab"], .mari-editor-tab, .mari-editor-action--compact')]
            .filter((element) => element.getClientRects().length > 0)
            .map(
              (element) =>
                `${(element.textContent ?? "").trim().slice(0, 24)}: ${element.getBoundingClientRect().height}`,
            )
            .filter((entry) => Number.parseFloat(entry.slice(entry.lastIndexOf(":") + 1)) < 44),
        );
      // #1588: scrolls the bar's scroller to one end; "in view" when the bar is still inside the scrollport and
      // the window.
      const stickyBarInView = (bar: ReturnType<typeof page.locator>, end: "top" | "bottom") =>
        bar.evaluate((element, scrollEnd) => {
          let scroller = element.parentElement;
          while (
            scroller &&
            !(
              /auto|scroll/u.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight
            )
          )
            scroller = scroller.parentElement;
          const scrolling = scroller ?? document.scrollingElement!;
          scrolling.scrollTop = scrollEnd === "bottom" ? scrolling.scrollHeight : 0;
          const box = scroller?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight };
          const port = { top: Math.max(box.top, 0), bottom: Math.min(box.bottom, innerHeight) };
          const rect = element.getBoundingClientRect();
          return rect.top >= port.top - 1 && rect.bottom <= port.bottom + 1
            ? "in view"
            : `bar ${rect.top}-${rect.bottom} outside ${port.top}-${port.bottom} at scrollTop ${scrolling.scrollTop}`;
        }, end);
      // #1588: sizes the detail panel as a host panel does: the window's height, so its content scrolls inside
      // it, and a width ("" for full, "24rem" for a narrow side panel on a wide window); null undocks it.
      const dockDetailPanel = (target: typeof page, maxWidth: string | null) =>
        target.locator('[data-ltm-surface="detail"]').evaluate((surface, width) => {
          (surface as HTMLElement).style.height = width === null ? "" : "100vh";
          (surface as HTMLElement).style.maxWidth = width ?? "";
          if (width !== null) surface.scrollIntoView({ block: "start" });
        }, maxWidth);
      page.on("request", (request) => {
        if (request.method() !== "POST") return;
        const body = request.postDataJSON() as Record<string, unknown>;
        if (request.url().endsWith("/api/long-term-memory/import/preview")) sourcePreviewRequests.push(body);
        if (request.url().endsWith("/api/long-term-memory/import/lorebooks/preview"))
          lorebookPreviewRequests.push(body);
      });
      const desktopActivationChanges: boolean[] = [];
      let activationGate: Promise<void> = Promise.resolve();
      await page.exposeFunction("onDesktopActivationChange", async (enabled: boolean) => {
        desktopActivationChanges.push(enabled);
        await activationGate;
      });
      await page.exposeFunction("declineDestinationChange", () => false);
      await page.exposeFunction("confirmReviewDiscard", (options: { message?: string }) => {
        lastReviewDiscardMessage = options.message ?? "";
        return confirmReviewDiscard;
      });
      await page.exposeFunction(
        "captureDeleteConfirmation",
        (options: { title: string; message: string; confirmLabel?: string }) => {
          lastDeleteConfirmation = options;
          notifyDeleteConfirmation?.();
          return confirmDelete;
        },
      );
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
          confirmAction: (
            window as Window & {
              captureDeleteConfirmation: (options: {
                title: string;
                message: string;
                confirmLabel?: string;
              }) => boolean;
            }
          ).captureDeleteConfirmation,
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
      const memoryScope = page.locator('[data-ltm-scope-picker="vault"]');
      const memoryScopeTrigger = memoryScope.locator("[data-ltm-scope-picker-trigger]");
      const memoryScopePopup = memoryScope.locator("[data-ltm-scope-picker-popup]");
      const memoryScopeSearch = memoryScopePopup.locator("input");
      const secondaryScope = page.locator('[data-ltm-scope-picker="vault-secondary"]');
      const secondaryScopeTrigger = secondaryScope.locator("[data-ltm-scope-picker-trigger]");
      const worldGroupSummary = page.locator('[data-ltm-memory-group="world"] > summary');
      // The list unmounts while a place loads and its first group mounts already open, so wait for the heading
      // before reading its state: a click decided while the list was empty would land on the open group and close it.
      const openWorldGroup = async () => {
        await worldGroupSummary.waitFor();
        if (!(await page.locator('[data-ltm-memory-group="world"][open]').count())) await worldGroupSummary.click();
      };
      const notesRequest = (predicate: (params: URLSearchParams) => boolean) =>
        page.waitForRequest((request) => {
          const url = new URL(request.url());
          return request.method() === "GET" && url.pathname.endsWith("/notes") && predicate(url.searchParams);
        });
      const colorAlpha = (color: string) => {
        const slash = /\/\s*([\d.]+)(%?)\s*\)$/u.exec(color);
        if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
        const rgba = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/u.exec(color);
        return rgba ? Number(rgba[1]) : 1;
      };
      // Opens a place picker, moves to a kind tab and picks an option without the mouse.
      const choosePlaceByKeyboard = async (picker: string, kind: string, optionId: string) => {
        const root = page.locator(`[data-ltm-scope-picker="${picker}"]`);
        await root.locator("[data-ltm-scope-picker-trigger]").focus();
        await page.keyboard.press("Enter");
        await root.locator("[data-ltm-scope-picker-popup] input:focus").waitFor();
        await page.keyboard.press("Tab");
        // The first group opens by itself once its list loads, so wait for the list before deciding to click:
        // a click that lands after the auto-open would close the group.
        await worldGroupSummary.waitFor();
        await root.locator('[data-ltm-scope-tab="all"]:focus').waitFor();
        for (let step = 0; step < 3 && !(await root.locator(`[data-ltm-scope-tab="${kind}"]:focus`).count()); step += 1)
          await page.keyboard.press("ArrowRight");
        await root.locator(`[data-ltm-scope-tab="${kind}"][aria-selected="true"]:focus`).waitFor();
        await page.keyboard.press("Shift+Tab");
        await root.locator("[data-ltm-scope-picker-popup] input:focus").waitFor();
        const option = root.locator(`[data-ltm-scope-option="${optionId}"]`);
        const order = await root
          .locator('[role="option"]')
          .evaluateAll((options) =>
            options.map((item) => [item.getAttribute("data-ltm-scope-option"), item.getAttribute("data-highlighted")]),
          );
        const key =
          order.findIndex(([, highlighted]) => highlighted === "true") > order.findIndex(([id]) => id === optionId)
            ? "ArrowUp"
            : "ArrowDown";
        for (let step = 0; step < 150 && (await option.getAttribute("data-highlighted")) !== "true"; step += 1)
          await page.keyboard.press(key);
        assert.equal(await option.getAttribute("data-highlighted"), "true", `${optionId} is reachable with ArrowDown`);
        await page.keyboard.press("Enter");
        await root.locator("[data-ltm-scope-picker-popup]").waitFor({ state: "detached" });
      };
      const choosePlaceBySearch = async (picker: string, query: string, optionId: string) => {
        const root = page.locator(`[data-ltm-scope-picker="${picker}"]`);
        await root.locator("[data-ltm-scope-picker-trigger]").click();
        await root.locator("[data-ltm-scope-picker-popup] input").fill(query);
        await root.locator(`[data-ltm-scope-option="${optionId}"]`).click();
        await root.locator("[data-ltm-scope-picker-popup]").waitFor({ state: "detached" });
      };
      await memoryScopeTrigger.waitFor();
      // The place reads "All" until the scope targets load.
      await memoryScopeTrigger.getByText("Current", { exact: true }).waitFor();
      assert.match(
        await page.locator("[data-ltm-memory-scope]").innerText(),
        /^Currently viewing memories in:\s*Current\b/u,
      );
      assert.equal(await page.getByText("Memory outside current chat").count(), 0);
      await memoryScopeTrigger.click();
      await memoryScopePopup.waitFor();
      assert.equal(
        await memoryScope.locator('[data-ltm-scope-option="chat:desktop-chat"]').getAttribute("aria-selected"),
        "true",
        "The contextual Current place is selected by ID",
      );
      assert.equal(await memoryScope.locator('[data-ltm-scope-option="all"]').getAttribute("aria-selected"), "false");
      assert.deepEqual(
        await memoryScope
          .locator("[data-ltm-scope-tab]")
          .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-ltm-scope-tab"))),
        ["all", "chat", "character", "persona"],
      );
      const scopePopupLayout = await memoryScopePopup.evaluate((popup) => {
        const style = getComputedStyle(popup);
        const tablist = popup.querySelector<HTMLElement>("[data-ltm-scope-tablist]")!;
        const bounds = document.querySelector<HTMLElement>("[data-ltm-browser-controls]")!.getBoundingClientRect();
        const control = document.querySelector<HTMLElement>("[data-ltm-memory-scope]")!.getBoundingClientRect();
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          columns: getComputedStyle(tablist).gridTemplateColumns.split(" ").length,
          controlFits: control.width <= bounds.width + 1 && control.right <= bounds.right + 1,
        };
      });
      // The dropdown is a solid surface, so the memory list never shows through it.
      assert.equal(colorAlpha(scopePopupLayout.backgroundColor), 1, JSON.stringify(scopePopupLayout));
      assert.match(scopePopupLayout.backgroundImage, /gradient/u, JSON.stringify(scopePopupLayout));
      assert.equal(scopePopupLayout.columns, 4, JSON.stringify(scopePopupLayout));
      assert.ok(scopePopupLayout.controlFits, JSON.stringify(scopePopupLayout));
      await page.keyboard.press("Escape");
      await memoryScopePopup.waitFor({ state: "detached" });
      // Every place kind is chosen by keyboard, and the list follows the choice (#1420).
      const allPlaceQueryStart = noteQueries.length;
      await choosePlaceByKeyboard("vault", "all", "all");
      assert.equal((await memoryScopeTrigger.innerText()).trim(), "All");
      await openWorldGroup();
      await page.getByText("Memory outside current chat").waitFor();
      assert.ok(
        noteQueries.slice(allPlaceQueryStart).some((query) => !query.includes("scopeChatIds")),
        "choosing All loads notes without a chat scope",
      );
      // With no character folded into the places, chats split by whether they hold memories.
      await memoryScopeTrigger.click();
      await memoryScope.locator('[data-ltm-scope-tab="chat"]').click();
      const withMemories = memoryScope.locator('[data-ltm-scope-presence="with-memories"]');
      const noMemories = memoryScope.locator('[data-ltm-scope-presence="no-memories"]');
      const showNoMemories = memoryScope.locator("[data-ltm-scope-show-no-memories]");
      const listboxRoles = () =>
        memoryScope
          .locator('[role="listbox"]')
          .evaluate((list) => [...new Set([...list.children].map((child) => child.getAttribute("role")))].sort());
      assert.equal(await withMemories.getAttribute("aria-label"), "With memories");
      assert.match(
        await withMemories.locator('[data-ltm-scope-option="group:conversation-a"]').innerText(),
        /Conversation A[\s\S]*All branches/u,
        "a chat with branches is one Chats entry",
      );
      assert.equal(await memoryScope.locator('[data-ltm-scope-option="chat:memory-chat"]').count(), 0);
      // While collapsed, places without memories are one "Show N places" option, so the listbox holds
      // only options and groups (#1442).
      assert.equal(await noMemories.count(), 0, "places without memories start collapsed");
      assert.match(await showNoMemories.innerText(), /^Show \d+ places with no memories$/u);
      assert.equal(await showNoMemories.getAttribute("role"), "option");
      assert.deepEqual(await listboxRoles(), ["group", "option"]);
      await memoryScopeSearch.fill("Bulk chat 1");
      await noMemories.waitFor();
      // A tab change during a search keeps the group open (#1442).
      await memoryScope.locator('[data-ltm-scope-tab="all"]').click();
      await memoryScope.locator('[data-ltm-scope-tab="chat"]').click();
      assert.equal(await noMemories.locator('[data-ltm-scope-option="chat:bulk-chat-1"]').count(), 1);
      assert.equal(await showNoMemories.count(), 0);
      // Clearing the search returns to the collapsed choice, without batching an immediate
      // clear/refill back to the same controlled value.
      await memoryScopeSearch.fill("");
      await showNoMemories.waitFor();
      assert.equal(await noMemories.count(), 0);
      // ArrowDown from the search box reaches the "Show" option, and Enter opens the group in place.
      await memoryScopeSearch.focus();
      for (let step = 0; step < 20 && (await showNoMemories.getAttribute("data-highlighted")) !== "true"; step += 1)
        await page.keyboard.press("ArrowDown");
      assert.equal(await showNoMemories.getAttribute("data-highlighted"), "true", "ArrowDown reaches the Show option");
      await page.keyboard.press("Enter");
      await noMemories.waitFor();
      assert.equal(await noMemories.getAttribute("role"), "group");
      assert.equal(await noMemories.getAttribute("aria-label"), "No memories");
      assert.equal(await showNoMemories.count(), 0);
      assert.deepEqual(await listboxRoles(), ["group", "option"]);
      assert.equal(await memoryScopeTrigger.getAttribute("aria-expanded"), "true", "opening the group is not a choice");
      await memoryScopeSearch.fill("Member Final Branch");
      assert.equal(
        await memoryScope.locator('[data-ltm-scope-option="group:conversation-a"]').count(),
        1,
        "a chat is searchable by a branch name",
      );
      await memoryScopeSearch.fill("");
      await noMemories.waitFor();
      // Arrow keys keep the highlighted place inside the list's visible area (#1584).
      for (let step = 0; step < 20; step += 1) await page.keyboard.press("ArrowDown");
      const highlightBox = await memoryScope.locator('[role="listbox"]').evaluate((list) => {
        const option = list.querySelector('[data-highlighted="true"]');
        return {
          list: list.getBoundingClientRect().toJSON(),
          option: option?.getBoundingClientRect().toJSON(),
          id: option?.getAttribute("data-ltm-scope-option"),
        };
      });
      assert.ok(
        highlightBox.option &&
          highlightBox.option.top >= highlightBox.list.top &&
          highlightBox.option.bottom <= highlightBox.list.bottom,
        `the highlighted place is inside the visible list: ${JSON.stringify(highlightBox)}`,
      );
      await page.keyboard.press("Escape");
      await memoryScopePopup.waitFor({ state: "detached" });
      const wholeChatRequest = notesRequest((params) => params.get("scopeGroupId") === "conversation-a");
      await choosePlaceByKeyboard("vault", "chat", "group:conversation-a");
      assert.deepEqual(
        new URL((await wholeChatRequest).url()).searchParams.get("scopeChatIds")?.split(","),
        ["memory-chat", "memory-conversation-branch"],
        "the whole chat covers every branch, including branch assignments",
      );
      await page.getByText("Second mobile review memory", { exact: true }).waitFor({ state: "detached" });
      await openWorldGroup();
      await page.getByText("Memory outside current chat").waitFor();
      await choosePlaceByKeyboard("vault", "chat", "chat:desktop-chat");
      assert.match(await memoryScopeTrigger.innerText(), /^Current\n/u);
      await page.getByText("Memory outside current chat").waitFor({ state: "detached" });
      const characterPlaceRequest = notesRequest((params) => params.get("scopeCharacterIds") === "character-a");
      await choosePlaceByKeyboard("vault", "character", "character:character-a");
      await characterPlaceRequest;
      await openWorldGroup();
      await page.getByText("Second mobile review memory", { exact: true }).waitFor();
      assert.equal(await page.getByText("Memory outside current chat").count(), 0);
      const personaPlaceRequest = notesRequest((params) => params.get("scopePersonaId") === "persona-a");
      await choosePlaceByKeyboard("vault", "persona", "persona:persona-a");
      await personaPlaceRequest;
      assert.match(await memoryScopeTrigger.innerText(), /Persona A\nSpace explorer/u);
      // ...and by search, including a place inside the collapsed No memories group.
      await choosePlaceBySearch("vault", "Member Final Branch", "group:conversation-a");
      assert.match(await memoryScopeTrigger.innerText(), /All branches/u);
      await openWorldGroup();
      await page.getByText("Memory outside current chat").waitFor();
      await choosePlaceBySearch("vault", "Character A", "character:character-a");
      await page.getByText("Memory outside current chat").waitFor({ state: "detached" });
      const hiddenPersonaRequest = notesRequest((params) => params.get("scopePersonaId") === "persona-b");
      await memoryScopeTrigger.click();
      await memoryScopeSearch.fill("Private detective");
      await memoryScope
        .locator('[data-ltm-scope-presence="no-memories"] [data-ltm-scope-option="persona:persona-b"]')
        .click();
      await hiddenPersonaRequest;
      assert.match(await memoryScopeTrigger.innerText(), /Private detective/u);
      await choosePlaceBySearch("vault", "does-not-match", "all");
      await openWorldGroup();
      await page.getByText("Memory outside current chat").waitFor();
      // Repair proof: a secondary place must stay literal. Inheriting the primary
      // place's character turns "A AND (B OR A)" back into A, so memories the second
      // place does not hold would still reach the list and bulk selection.
      await choosePlaceBySearch("vault", "Character A", "character:character-a");
      const secondaryPlaceRequestPromise = notesRequest((params) => params.get("scopeGroupId") === "conversation-a");
      // #1636: the second place and the mode filter sit under Filters, which stays closed until one is set.
      // The disclosure is a button (`aria-expanded`) that controls `[data-ltm-refine-panel]`.
      const refine = page.locator("button[data-ltm-refine]");
      const refinePanel = page.locator("[data-ltm-refine-panel]");
      assert.equal(await refine.getAttribute("aria-expanded"), "false", "Filters starts closed");
      assert.equal(await refine.getAttribute("aria-controls"), null, "closed Filters points at no missing panel");
      assert.equal(await refinePanel.count(), 0, "the closed Filters panel is not rendered");
      await refine.click();
      await refinePanel.waitFor();
      assert.equal(await refine.getAttribute("aria-controls"), "ltm-vault-filters");
      assert.equal(await refine.getAttribute("aria-expanded"), "true", "Filters opens by hand");
      await choosePlaceBySearch("vault-secondary", "Member Final Branch", "group:conversation-a");
      const secondaryPlaceRequest = await secondaryPlaceRequestPromise;
      assert.doesNotMatch(
        secondaryPlaceRequest.url(),
        /scopeCharacterIds/u,
        `the second place must not inherit the primary character: ${secondaryPlaceRequest.url()}`,
      );
      await choosePlaceBySearch("vault-secondary", "does-not-match", "all");
      await choosePlaceBySearch("vault", "does-not-match", "all");
      await openWorldGroup();
      await page.getByText("Memory outside current chat").waitFor();
      const secondaryCharacterRequestPromise = notesRequest(
        (params) => params.get("scopeCharacterIds") === "character-a",
      );
      await choosePlaceByKeyboard("vault-secondary", "character", "character:character-a");
      const secondaryCharacterRequest = await secondaryCharacterRequestPromise;
      assert.match(
        secondaryCharacterRequest.url(),
        /scopeCharacterIds=character-a/u,
        "the second place must issue its own scope query",
      );
      await openWorldGroup();
      await page.getByText("Second mobile review memory", { exact: true }).waitFor();
      assert.equal(
        await page.getByText("Memory outside current chat").count(),
        0,
        "AND intersection must drop memories unavailable in the second place",
      );
      // Repair proof: the AND view keeps the primary place's notes as link context,
      // so a memory linked to a note outside the intersection still resolves by its
      // title instead of dropping out of linked-title search.
      const secondaryContextSearch = page.getByLabel("Search memories");
      await secondaryContextSearch.fill("Memory outside current chat");
      await page.getByText("Second mobile review memory", { exact: true }).waitFor();
      await secondaryContextSearch.fill("");
      // Repair proof: an empty AND intersection still names the combined scope
      // instead of falling back to the generic "no memories" copy.
      await secondaryScopeTrigger.click();
      await secondaryScope.locator("[data-ltm-scope-picker-popup] input").fill("Private detective");
      await secondaryScope
        .locator('[data-ltm-scope-presence="no-memories"] [data-ltm-scope-option="persona:persona-b"]')
        .click();
      await page.getByText(/^Nothing is available in .+ AND .+, but you have \d+ saved elsewhere\.$/u).waitFor();
      await choosePlaceBySearch("vault-secondary", "does-not-match", "all");
      assert.match(await secondaryScopeTrigger.innerText(), /No second place/u);
      // A closed Filters names the filter in use, so a hidden mode filter is never a silent one.
      const firstModeFilter = page.locator("[data-ltm-mode-filter] input").first();
      await firstModeFilter.uncheck();
      await refine.click();
      assert.equal(await refine.getAttribute("aria-expanded"), "false", "Filters closes by hand");
      assert.equal(await refinePanel.count(), 0, "the closed Filters panel is not rendered");
      await refine
        .locator("[data-ltm-refine-active]")
        .getByText(/^Available chat types: /u)
        .waitFor();
      await refine.click();
      await refinePanel.waitFor();
      await firstModeFilter.check();
      // soup/shared-picker: the last chat type cannot be unchecked, and the group says why in place.
      const modeBoxes = page.locator("[data-ltm-mode-filter] input[type=checkbox]");
      const modeBoxCount = await modeBoxes.count();
      for (let index = 1; index < modeBoxCount; index += 1) await modeBoxes.nth(index).uncheck();
      await page.locator("[data-ltm-mode-filter] [data-ltm-last-mode-note]").waitFor();
      assert.equal(await modeBoxes.first().isDisabled(), true, "the last checked chat type is disabled");
      for (let index = 1; index < modeBoxCount; index += 1) await modeBoxes.nth(index).check();
      await page.locator("[data-ltm-mode-filter] [data-ltm-last-mode-note]").waitFor({ state: "detached" });
      await openWorldGroup();
      await page.getByText("Memory outside current chat").waitFor();
      // Unsaved edits: Keep editing and Discard both return focus to the place button (#1442).
      await page
        .locator('[data-ltm-note-type="world"]')
        .filter({ hasText: /^Second mobile review memory/u })
        .locator("button")
        .first()
        .click();
      await page.locator('[data-ltm-field="title"]').fill("Second mobile review memory, edited");
      // #1617: leaving the dirty Vault editor for another destination says where it leads.
      const reviewDestination = page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]');
      await reviewDestination.click();
      const destinationDescription = page.locator('[data-ltm-unsaved-dialog] [id$="-description"]');
      await destinationDescription.waitFor();
      const destinationText = (await destinationDescription.innerText()).trim();
      assert.match(destinationText, /^Save your changes before opening .+, or discard them\.$/u);
      assert.doesNotMatch(destinationText, /this memory/u);
      await page.locator("[data-ltm-unsaved-stay]").click();
      await destinationDescription.waitFor({ state: "detached" });
      // Stay hands focus back to the Review button on the next frame; moving on earlier lets it steal the picker's.
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]:focus').waitFor();
      const focusedPlaceButton = memoryScope.locator("[data-ltm-scope-picker-trigger]:focus");
      await choosePlaceByKeyboard("vault", "character", "character:character-a");
      await page.locator("[data-ltm-unsaved-stay]:focus").waitFor();
      await page.keyboard.press("Enter");
      await focusedPlaceButton.waitFor();
      assert.equal((await memoryScopeTrigger.innerText()).trim(), "All", "Keep editing stays in the place");
      const discardPlaceRequest = notesRequest((params) => params.get("scopeCharacterIds") === "character-a");
      await choosePlaceByKeyboard("vault", "character", "character:character-a");
      await page.getByRole("button", { name: "Discard and continue", exact: true }).click();
      await discardPlaceRequest;
      await focusedPlaceButton.waitFor();
      await choosePlaceBySearch("vault", "does-not-match", "all");
      await openWorldGroup();
      await page.getByText("Memory outside current chat").waitFor();
      // soup/vault-first-open: a row says where it applies and carries no "Active" chip, an emptied list says the
      // place hides memories and offers Show all, and a new memory starts on the chat's character (unless a
      // persona place is picked) with an empty first line that "Add new memory section" keeps. The first group
      // opening itself is asserted on the capped-list page below, where nothing opens it by hand.
      await page.locator("[data-ltm-note-type] [data-ltm-row-place]").first().waitFor();
      // soup/ltm-frame-vault: the short age ends the title line, its tooltip carries "Updated <date>", the row has
      // no type chip, and an "Available everywhere" chip carries a globe icon.
      const rowUpdated = page.locator("[data-ltm-note-type] [data-ltm-row-updated]").first();
      assert.match((await rowUpdated.innerText()).trim(), /^.+ ago$/u);
      assert.doesNotMatch((await rowUpdated.innerText()).trim(), /Updated/u);
      assert.match((await rowUpdated.getAttribute("title")) ?? "", /^Updated .+/u);
      assert.equal(
        await rowUpdated.evaluate((element) => element.previousElementSibling?.tagName === "STRONG"),
        true,
        "the age sits on the title line, right after the title",
      );
      const everywhereChip = page
        .locator("[data-ltm-note-type] [data-ltm-row-place]")
        .filter({ hasText: "Available everywhere" })
        .first();
      if (await everywhereChip.count()) assert.equal(await everywhereChip.locator("svg").count(), 1);
      // Guarded: the open group may hold only placed memories. A placed memory's chip has no globe.
      const placedChip = page
        .locator("[data-ltm-note-type] [data-ltm-row-place]")
        .filter({ hasNotText: /Available everywhere|^\+\d+/u })
        .first();
      if (await placedChip.count()) assert.equal(await placedChip.locator("svg").count(), 0);
      assert.equal(
        await page.locator("[data-ltm-note-type]").getByText("Active", { exact: true }).count(),
        0,
        "an active memory carries no status chip",
      );
      await memoryScopeTrigger.click();
      await memoryScopeSearch.fill("Private detective");
      await memoryScope
        .locator('[data-ltm-scope-presence="no-memories"] [data-ltm-scope-option="persona:persona-b"]')
        .click();
      await page.getByText(/^Nothing is available in .+, but you have \d+ saved elsewhere\.$/u).waitFor();
      assert.equal(await page.getByText(/No memories/u).count(), 0, "the empty list never says there are none");
      // A picked persona place keeps its own scope: no character default, so no Character subjects.
      await page.getByRole("button", { name: "New memory", exact: true }).click();
      await page.locator('[data-ltm-field="title"]').waitFor();
      assert.equal(
        await page.locator('[data-ltm-field="subjects"]').count(),
        0,
        "a picked persona place stays a World memory",
      );
      const discardNewMemory = async () => {
        await page.getByRole("button", { name: "Close", exact: true }).click();
        await page.getByRole("button", { name: "Discard and continue", exact: true }).click();
        await page.locator('[data-ltm-field="title"]').waitFor({ state: "detached" });
      };
      await discardNewMemory();
      await page.getByRole("button", { name: "Show all", exact: true }).click();
      await memoryScopeTrigger.getByText("All", { exact: true }).waitFor();
      await page.locator('[aria-label="Add memories"]').click();
      await page.getByRole("button", { name: /Create manually/u }).click();
      await page.locator('[data-ltm-field="title"]').waitFor();
      assert.equal(
        await page.locator('[data-ltm-field="subjects"]').count(),
        1,
        "a new memory from a chat starts as a Character memory",
      );
      assert.match(
        await page.locator("[data-ltm-availability-summary]").innerText(),
        /\b1 places\b/u,
        "a new memory starts on the chat's character",
      );
      // soup/shared-picker: the subject picker is the shared picker: typing narrows it, Esc clears the text first, and
      // an empty result says so in place.
      // A Character memory holds one person, so the picker only shows once the chat's character chip is removed.
      assert.equal(await page.locator('[data-ltm-picker-search="subject"]').count(), 0, "a full subject slot hides it");
      await page.locator('[data-ltm-field="subjects"] [data-ltm-pill] button').click();
      const subjectSearch = page.locator('[data-ltm-picker-search="subject"]');
      assert.equal(await subjectSearch.getAttribute("role"), "combobox");
      await subjectSearch.fill("zz-no-such-person");
      await page
        .locator('[data-ltm-picker="subject"]')
        .getByText(/^No matching characters/u)
        .waitFor();
      await subjectSearch.press("Escape");
      assert.equal(await subjectSearch.inputValue(), "", "Esc clears the search text");
      assert.equal(
        await page.locator('[data-ltm-field="title"]').count(),
        1,
        "Esc in the picker keeps the editor open",
      );
      const firstDetail = page.locator('[data-ltm-field="section"]');
      assert.equal(
        await firstDetail.inputValue(),
        "",
        "the first line starts empty, so typing never replaces placeholder text",
      );
      await firstDetail.fill("Kept text");
      await page.getByRole("button", { name: "Add new memory section", exact: true }).click();
      await page.getByPlaceholder("e.g. Current state, Important facts").fill("Current state");
      await page.getByRole("button", { name: "Add section", exact: true }).click();
      assert.equal(await page.locator('[data-ltm-field="section"]').count(), 2);
      assert.equal(
        await firstDetail.first().inputValue(),
        "Kept text",
        "adding a detail keeps the text already written",
      );
      await discardNewMemory();
      await openWorldGroup();
      await page.getByText("Memory outside current chat").waitFor();
      await page.evaluate(() => {
        document.body.tabIndex = -1;
        document.body.focus();
      });
      for (let index = 0; index < 200; index += 1) {
        if (await worldGroupSummary.evaluate((summary) => summary.matches(":focus"))) break;
        await page.keyboard.press("Tab");
      }
      const memoryGroupFocus = await worldGroupSummary.evaluate((summary) => ({
        outlineStyle: getComputedStyle(summary).outlineStyle,
        outlineWidth: getComputedStyle(summary).outlineWidth,
        height: summary.getBoundingClientRect().height,
      }));
      assert.notEqual(memoryGroupFocus.outlineStyle, "none");
      assert.ok(memoryGroupFocus.height >= 44, JSON.stringify(memoryGroupFocus));
      await page.evaluate(() => document.body.removeAttribute("tabindex"));
      // soup/tour: Help is a two-item menu; Esc closes it and returns focus to Help.
      const helpButton = page.getByRole("button", { name: "Help", exact: true });
      await helpButton.click();
      await page.locator("[data-ltm-help-menu]").waitFor();
      assert.equal(await helpButton.getAttribute("aria-expanded"), "true");
      // The menu is drawn on the page body, so no page field can cover an item; the keyboard starts on its first item.
      const helpMenuLayer = await page.evaluate(() => {
        const menu = document.querySelector("[data-ltm-help-menu]")!;
        const covered = [...menu.querySelectorAll("button")].filter((item) => {
          const rect = item.getBoundingClientRect();
          const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return !top || !item.contains(top);
        }).length;
        return {
          onBody: menu.parentElement === document.body,
          covered,
          focusInside: menu.contains(document.activeElement),
          rightEdge: menu.getBoundingClientRect().right <= window.innerWidth,
        };
      });
      assert.deepEqual(helpMenuLayer, { onBody: true, covered: 0, focusInside: true, rightEdge: true });
      await page.keyboard.press("Escape");
      await page.locator("[data-ltm-help-menu]").waitFor({ state: "detached" });
      assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-ltm-onboarding-help")), true);
      await helpButton.click();
      await page.locator("[data-ltm-help-setup]").click();
      // soup/setup-beats: Help opens setup as a dialog over the current screen, at its saved beat, and Later closes it.
      const helpSetup = page.locator('[data-ltm-surface="onboarding"]');
      await helpSetup.waitFor();
      assert.equal(await helpSetup.evaluate((dialog) => dialog.tagName), "DIALOG");
      await helpSetup.locator("[data-ltm-setup-close]").click();
      await helpSetup.waitFor({ state: "detached" });
      // soup/tour: Next walks the nine stops; each stop with an anchor rings a visible control, Back steps
      // back, and Esc ends the tour with focus on Help. Linked memories opens the Graph itself and leaving
      // it puts the Vault back on List.
      await helpButton.click();
      await page.locator("[data-ltm-help-tour]").click();
      const tour = page.locator('[data-ltm-surface="tour"]');
      await tour.waitFor();
      assert.equal(await tour.evaluate((dialog) => dialog.tagName), "DIALOG");
      // The tour opens on Next, so Enter as the first key moves on instead of ending it.
      assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-ltm-tour-next")), true);
      const tourAnchors: Record<string, string | null> = {
        welcome: null,
        vault: '[data-ltm-surface="vault"]',
        sources: '[data-ltm-navigation="desktop"] [data-ltm-destination="sources"]',
        review: '[data-ltm-navigation="desktop"] [data-ltm-destination="review"]',
        linked: "[data-ltm-graph]",
        reading: "[data-ltm-reading-chip]",
        inchat: null,
        activity: '[data-ltm-navigation="desktop"] [data-ltm-destination="activity"]',
        settings: '[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]',
      };
      const tourStops = Object.keys(tourAnchors);
      for (const [index, stopId] of tourStops.entries()) {
        await page.locator(`[data-ltm-surface="tour"][data-ltm-tour-stop="${stopId}"]`).waitFor();
        assert.match(
          await tour.locator("[data-ltm-tour-bubble]").innerText(),
          new RegExp(`Stop ${index + 1} of 9`, "u"),
        );
        assert.equal(
          await page.evaluate(() => Boolean(document.activeElement?.closest("[data-ltm-tour-bubble]"))),
          true,
          `focus stays in the bubble at ${stopId}`,
        );
        const anchor = tourAnchors[stopId];
        if (anchor) {
          await tour.locator("[data-ltm-tour-spotlight]").waitFor();
          assert.equal(await page.locator(anchor).first().isVisible(), true, `${stopId} anchor is visible`);
          // soup/reading-chip: an idle Mari still gets a chip to ring, shown as a preview.
          if (stopId === "reading") {
            assert.equal(await page.locator(anchor).getAttribute("data-ltm-reading"), "preview");
            assert.equal(
              await page.locator(`${anchor} [data-ltm-setup-sprite]`).getAttribute("data-ltm-sprite-motion"),
              null,
              "the idle preview chip is a still frame",
            );
          }
        } else {
          assert.equal(await tour.locator("[data-ltm-tour-spotlight]").count(), 0, `${stopId} has no ring`);
        }
        if (index === 2) {
          await tour.locator("[data-ltm-tour-back]").click();
          await page.locator('[data-ltm-surface="tour"][data-ltm-tour-stop="vault"]').waitFor();
          await tour.locator("[data-ltm-tour-next]").click();
          await page.locator('[data-ltm-surface="tour"][data-ltm-tour-stop="sources"]').waitFor();
        }
        if (index < tourStops.length - 1) await tour.locator("[data-ltm-tour-next]").click();
        if (stopId === "linked") {
          await page.locator('[data-ltm-surface="tour"][data-ltm-tour-stop="reading"]').waitFor();
          assert.equal(
            await page.locator("[data-ltm-vault-view-list]").getAttribute("aria-pressed"),
            "true",
            "leaving Linked memories puts the Vault back on List",
          );
        }
      }
      assert.equal(await tour.locator("[data-ltm-tour-next]").innerText(), "Finish");
      await page.keyboard.press("Escape");
      await tour.waitFor({ state: "detached" });
      await page.waitForFunction(() => document.activeElement?.hasAttribute("data-ltm-onboarding-help"));
      assert.equal(await page.evaluate(() => localStorage.getItem("marinara-long-term-memory-tour-v1")), "tour:done");
      assert.equal(await page.locator("[data-ltm-reading-chip]").count(), 0, "the preview leaves with the tour");
      // soup/tour: with no memories to draw, Linked memories shows a made-up example graph and says so.
      const everyNoteList = (url: URL) => url.pathname.endsWith("/api/long-term-memory/notes");
      await page.route(everyNoteList, (route) =>
        route.request().method() === "GET" ? route.fulfill({ json: [] }) : route.fallback(),
      );
      await helpButton.click();
      await page.locator("[data-ltm-help-tour]").click();
      for (const stopId of ["vault", "sources", "review", "linked"]) {
        await tour.locator("[data-ltm-tour-next]").click();
        await page.locator(`[data-ltm-surface="tour"][data-ltm-tour-stop="${stopId}"]`).waitFor();
      }
      const exampleGraph = page.locator("[data-ltm-graph][data-ltm-graph-example]");
      await exampleGraph.waitFor();
      assert.equal(await exampleGraph.locator("[data-ltm-graph-example-tag]").innerText(), "Example");
      assert.match(await exampleGraph.innerText(), /The lighthouse fire/u);
      await tour.locator("[data-ltm-tour-spotlight]").waitFor();
      await page.waitForFunction(() =>
        /This is an example/u.test(document.querySelector("[data-ltm-tour-bubble]")?.textContent ?? ""),
      );
      await page.unroute(everyNoteList);
      await tour.locator("[data-ltm-tour-end]").click();
      await tour.waitFor({ state: "detached" });
      assert.equal(await page.locator("[data-ltm-graph]").count(), 0, "ending the tour puts the Vault back on List");
      // soup/reading-chip: the header chip shows while an extraction has started and not ended, and hides after.
      let extractionRunning = true;
      const readingRoute = "**/api/long-term-memory/debug-log?phase=extraction*";
      await page.route(readingRoute, (route) => {
        const base = { operationId: "11111111-1111-4111-8111-111111111111", action: "extract_source_note" };
        const ts = new Date().toISOString();
        return route.fulfill({
          json: {
            events: [{ ...base, ts, status: "started" }, ...(extractionRunning ? [] : [{ ...base, ts, status: "ok" }])],
          },
        });
      });
      const readingChip = page.locator("[data-ltm-reading-chip]");
      await readingChip.waitFor({ timeout: 10_000 });
      assert.equal(await readingChip.getAttribute("data-ltm-reading"), "live");
      assert.match(await readingChip.innerText(), /Reading the last reply/u);
      extractionRunning = false;
      await readingChip.waitFor({ state: "detached", timeout: 10_000 });
      await page.unroute(readingRoute);
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
      await page.getByRole("button", { name: "Choose where available" }).click();
      await page.locator("[data-ltm-availability-workbench]").waitFor();
      const availability = page.locator("[data-ltm-availability-workbench]");
      await availability.getByRole("checkbox", { name: "Conversation" }).check();
      // Save keeps keyboard focus while the request is held: it and Cancel are aria-disabled instead of
      // `disabled`, and a second Enter sends no second request.
      let releaseAvailability = () => {};
      availabilityGate = new Promise<void>((resolve) => {
        releaseAvailability = resolve;
      });
      const saveAvailability = availability.getByRole("button", { name: /^Save availability$|^Saving/u });
      const cancelAvailability = availability.getByRole("button", { name: "Cancel", exact: true });
      const patchesBeforeSave = availabilityPatches.length;
      await saveAvailability.focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () =>
          document
            .querySelector("[data-ltm-availability-workbench] .mari-editor-action--primary")
            ?.getAttribute("aria-disabled") === "true",
      );
      assert.equal(
        await saveAvailability.evaluate((el) => el === document.activeElement),
        true,
        "Save availability keeps focus while it saves",
      );
      assert.equal(await saveAvailability.getAttribute("disabled"), null);
      assert.equal(await cancelAvailability.getAttribute("aria-disabled"), "true");
      assert.equal(await cancelAvailability.getAttribute("disabled"), null);
      await page.keyboard.press("Enter");
      await cancelAvailability.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
      assert.equal(availabilityPatches.length, patchesBeforeSave + 1, "a second Enter sends no second save");
      assert.equal(
        await page.locator("[data-ltm-availability-workbench]").count(),
        1,
        "a locked Cancel does not close",
      );
      availabilityGate = null;
      releaseAvailability();
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
      await page.getByRole("button", { name: "Change where available" }).waitFor();
      await page.getByRole("button", { name: "Change where available" }).click();
      await page.locator("[data-ltm-availability-workbench]").waitFor();
      const scopedAvailability = page.locator("[data-ltm-availability-workbench]");
      await scopedAvailability.locator("[data-ltm-availability-pills] button").first().click();
      await scopedAvailability.locator('[role="alert"]').waitFor();
      assert.equal(await page.locator('[data-ltm-availability-workbench] [role="alert"]').count(), 1);
      assert.equal(availabilityPatches.length, 1);
      await page.getByRole("button", { name: "Cancel" }).click();
      // An existing branch assignment keeps working (#1420): its chip reads "Chat - Branch", saving
      // other places leaves it alone, and it can be removed in bulk and in the single editor.
      await memorySearch.fill("Memory outside current chat");
      const branchCard = page
        .locator('[data-ltm-note-type="world"]')
        .filter({ hasText: /^Memory outside current chat/u });
      await branchCard.waitFor();
      await branchCard.locator("button").first().click();
      await page.getByRole("button", { name: "Change where available" }).click();
      const branchAvailability = page.locator("[data-ltm-availability-workbench]");
      await branchAvailability.waitFor();
      const branchPill = branchAvailability.getByRole("button", {
        name: "Remove Memory Conversation - Member Final Branch",
        exact: true,
      });
      assert.equal(await branchPill.count(), 1);
      await branchAvailability.locator("[data-ltm-availability-picker] > summary").click();
      const branchRail = branchAvailability.locator("[data-ltm-availability-tabs]");
      assert.deepEqual(
        await shortTouchTargets("[data-ltm-availability-workbench]"),
        [],
        "the availability tabs fit 2.75rem",
      );
      assert.deepEqual(
        await branchRail
          .locator("[data-ltm-availability-tab]")
          .evaluateAll((tabs) =>
            tabs.map((tab) => [tab.getAttribute("data-ltm-availability-tab"), tab.getAttribute("aria-selected")]),
          ),
        [
          ["all", "true"],
          ["chat", "false"],
          ["character", "false"],
          ["persona", "false"],
        ],
      );
      assert.equal(await branchRail.locator('[data-ltm-availability-target="chat:memory-chat"]').count(), 0);
      assert.match(
        await branchRail.locator('[data-ltm-availability-target="chat:conversation-a"]').innerText(),
        /Chat · All branches/u,
      );
      // Keyboard and search: a persona from the All tab, then a character from its own tab.
      const branchAllSearch = branchRail.locator('[data-ltm-availability-search="all"]');
      await branchAllSearch.fill("Space explorer");
      assert.deepEqual(
        await branchRail
          .locator("[data-ltm-availability-target]")
          .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-ltm-availability-target"))),
        ["persona:persona-a"],
      );
      await branchAllSearch.press("Tab");
      await branchRail.locator('[data-ltm-availability-target="persona:persona-a"]:focus').waitFor();
      await page.keyboard.press("Enter");
      await branchRail.locator('[data-ltm-availability-target="persona:persona-a"][aria-pressed="true"]').waitFor();
      await branchRail.locator('[data-ltm-availability-tab="all"]').focus();
      await page.keyboard.press("ArrowRight");
      await branchRail.locator('[data-ltm-availability-tab="chat"]:focus').waitFor();
      await page.keyboard.press("ArrowRight");
      await branchRail.locator('[data-ltm-availability-tab="character"][aria-selected="true"]:focus').waitFor();
      await page.keyboard.press("Tab");
      await branchRail.locator('[data-ltm-availability-search="character"]:focus').waitFor();
      await page.keyboard.type("Character A");
      await page.keyboard.press("Tab");
      await branchRail.locator('[data-ltm-availability-target="character:character-a"]:focus').waitFor();
      await page.keyboard.press("Space");
      await branchRail.locator('[data-ltm-availability-target="character:character-a"][aria-pressed="true"]').waitFor();
      await branchRail.locator('[data-ltm-availability-tab="chat"]').click();
      await branchRail.locator('[data-ltm-availability-target="chat:bulk-chat-7"]').click();
      await branchRail.locator('[data-ltm-availability-target="chat:bulk-chat-7"][aria-pressed="true"]').waitFor();
      assert.equal(await branchPill.count(), 1, "adding places keeps the branch chip");
      // Choosing the branch's whole chat covers it (#1442): the chat's chip stands for the branch.
      await branchRail.locator('[data-ltm-availability-target="chat:conversation-a"]').click();
      await branchRail.locator('[data-ltm-availability-target="chat:conversation-a"][aria-pressed="true"]').waitFor();
      assert.equal(await branchPill.count(), 0, "a selected whole chat covers its branch chip");
      await branchAvailability.getByRole("button", { name: "Save availability" }).click();
      await page.waitForFunction(() => document.querySelector("[data-ltm-availability-workbench]") === null);
      type SavedScope = { chatIds?: string[]; groupIds?: string[]; characterIds?: string[]; personaIds?: string[] };
      const keptBranchScope = branchAvailabilityPatches.at(-1)?.scope as SavedScope;
      assert.deepEqual(
        keptBranchScope.chatIds?.toSorted(),
        ["bulk-chat-7", "memory-chat"],
        JSON.stringify(keptBranchScope),
      );
      assert.deepEqual(keptBranchScope.groupIds, ["conversation-a"], JSON.stringify(keptBranchScope));
      assert.deepEqual(keptBranchScope.characterIds, ["character-a"], JSON.stringify(keptBranchScope));
      assert.deepEqual(keptBranchScope.personaIds, ["persona-a"], JSON.stringify(keptBranchScope));
      // soup/frame-vault: the Vault header carries one New memory, the filter row counts selections only in select
      // mode, a Source notes chip names its count, and group headings show their count as a chip.
      assert.equal(await page.locator("[data-ltm-vault-header] [data-ltm-new-memory]").count(), 1);
      assert.equal(await page.getByRole("button", { name: "New memory", exact: true }).count(), 1);
      assert.equal(
        await page.locator("[data-ltm-selection-count]").count(),
        0,
        "no selection count outside select mode",
      );
      assert.ok((await page.locator("[data-ltm-memory-group] > summary [data-ltm-group-count]").count()) > 0);
      if (await page.locator("[data-ltm-source-filter]").count()) {
        assert.match((await page.locator("[data-ltm-source-filter]").innerText()).trim(), /^Source notes · \d+$/u);
        assert.equal(await page.locator("[data-ltm-source-filter]").getAttribute("aria-pressed"), "false");
      }
      // Bulk remove lists the branch assignment the selected memory already has.
      await page.locator("[data-ltm-select-mode]").click();
      await page.locator("[data-ltm-selection-count]").waitFor();
      await branchCard.locator('input[type="checkbox"]').check();
      // #1588: the whole label around a row checkbox is a 44px target, not just the box.
      assert.equal(await touchTargetSize(branchCard.locator('label:has(input[type="checkbox"])')), "fits");
      await page.locator("[data-ltm-bulk-edit]").click();
      const bulkBranchRemoval = page.locator("[data-ltm-bulk-availability-workbench]");
      await bulkBranchRemoval.waitFor();
      await bulkBranchRemoval.getByRole("button", { name: "Remove availability", exact: true }).click();
      await bulkBranchRemoval.locator("[data-ltm-availability-picker] > summary").click();
      const bulkBranchRail = bulkBranchRemoval.locator("[data-ltm-availability-tabs]");
      await bulkBranchRail.locator('[data-ltm-availability-tab="chat"]').click();
      const bulkBranchRow = bulkBranchRail.locator('[data-ltm-availability-target="chat:memory-chat"]');
      assert.match(await bulkBranchRow.innerText(), /Memory Conversation - Member Final Branch/u);
      await bulkBranchRow.click();
      assert.equal(await bulkBranchRow.getAttribute("aria-pressed"), "true");
      await bulkBranchRemoval.getByRole("button", { name: "Add availability", exact: true }).click();
      assert.equal(await bulkBranchRow.count(), 0, "a branch is not a place to add");
      await bulkBranchRemoval.getByRole("button", { name: "Remove availability", exact: true }).click();
      assert.equal(await bulkBranchRow.getAttribute("aria-pressed"), "false", "switching to Add drops the branch");
      await bulkBranchRow.click();
      assert.equal(await bulkBranchRemoval.getByText("1 memory selected", { exact: true }).count(), 1);
      assert.equal(
        await bulkBranchRemoval.locator("[data-ltm-bulk-outcome-summary]").innerText(),
        "1 ready · 0 unchanged · 0 blocked",
      );
      const bulkBranchRequest = page.waitForRequest(
        (request) => request.method() === "POST" && request.url().includes("/api/long-term-memory/notes/batch"),
      );
      // The memory now also names a chat deleted since it was assigned; the refresh after Apply loads it.
      outsideChatNote = {
        ...outsideChatNote,
        scope: { ...keptBranchScope, chatIds: [...(keptBranchScope.chatIds ?? []), "deleted-chat"] },
      };
      await bulkBranchRemoval.locator('[data-ltm-bulk-apply="top"]').click();
      assert.deepEqual((await bulkBranchRequest).postDataJSON().removeScope, { chatIds: ["memory-chat"] });
      await bulkBranchRemoval.waitFor({ state: "detached" });
      // The open memory was part of the change, so it reloads: its summary now counts the deleted chat.
      await page.locator("[data-ltm-availability-summary]").getByText("5 places, 1 chat types").waitFor();
      if ((await page.locator("[data-ltm-select-mode]").innerText()).trim() === "Done")
        await page.locator("[data-ltm-select-mode]").click();
      // Bulk Remove lists a place that no longer exists, with the single editor's fallback label (#1442).
      await page.locator("[data-ltm-select-mode]").click();
      await branchCard.locator('input[type="checkbox"]').check();
      await page.locator("[data-ltm-bulk-edit]").click();
      await bulkBranchRemoval.waitFor();
      await bulkBranchRemoval.getByRole("button", { name: "Remove availability", exact: true }).click();
      await bulkBranchRemoval.locator("[data-ltm-availability-picker] > summary").click();
      await bulkBranchRail.locator('[data-ltm-availability-tab="chat"]').click();
      const deletedChatRow = bulkBranchRail.locator('[data-ltm-availability-target="chat:deleted-chat"]');
      assert.match(await deletedChatRow.innerText(), /Unavailable chat/u);
      await deletedChatRow.click();
      assert.equal(await deletedChatRow.getAttribute("aria-pressed"), "true");
      // Removing a whole chat in bulk also removes its branch ids (#1442).
      await bulkBranchRail.locator('[data-ltm-availability-target="chat:conversation-a"]').click();
      // Sources' "All branches" import saves the chat's group id with every branch id; the refresh loads it.
      outsideChatNote = {
        ...outsideChatNote,
        scope: {
          groupId: "conversation-a",
          groupIds: ["conversation-a"],
          chatId: "memory-chat",
          chatIds: ["memory-chat", "memory-conversation-branch", "bulk-chat-7"],
          characterIds: ["character-a"],
          personaId: "persona-a",
          personaIds: ["persona-a"],
        },
      };
      const deletedChatRequest = page.waitForRequest(
        (request) => request.method() === "POST" && request.url().includes("/api/long-term-memory/notes/batch"),
      );
      // Hold the response, so the memory is opened and edited while the change is still running.
      let releaseDeletedChatBatch: (() => void) | null = null;
      const deletedChatBatchHeld = new Promise<void>((resolve) => {
        releaseDeletedChatBatch = resolve;
      });
      await page.route(
        "**/api/long-term-memory/notes/batch",
        async (route) => {
          await deletedChatBatchHeld;
          await route.continue();
        },
        { times: 1 },
      );
      await bulkBranchRemoval.locator('[data-ltm-bulk-apply="top"]').click();
      assert.deepEqual((await deletedChatRequest).postDataJSON().removeScope, {
        chatIds: ["deleted-chat", "memory-chat", "memory-conversation-branch"],
        groupIds: ["conversation-a"],
      });
      await bulkBranchRemoval.waitFor({ state: "detached" });
      if ((await page.locator("[data-ltm-select-mode]").innerText()).trim() === "Done")
        await page.locator("[data-ltm-select-mode]").click();
      // An imported whole chat shows one chip, and removing or unticking it removes its branches too (#1442).
      const branchPills = branchAvailability.getByRole("button", { name: /^Remove Memory Conversation - /u });
      const wholeChatPill = branchAvailability.getByRole("button", { name: "Remove Conversation A", exact: true });
      await branchCard.locator("button").first().click();
      const branchTitle = page.locator("[data-ltm-field='title']");
      await branchTitle.fill("Memory outside current chat, edited");
      const noteQueriesBeforeBatch = noteQueries.length;
      releaseDeletedChatBatch?.();
      // When the change finishes, the row actions work again, the list reloads and the open memory keeps its unsaved
      // title; the availability panel below shows the places after the change.
      await branchCard
        .locator("[data-ltm-note-actions-desktop] button:enabled:not([aria-disabled='true'])")
        .first()
        .waitFor();
      assert.ok(noteQueries.length > noteQueriesBeforeBatch, "the memory list reloads after the change");
      assert.equal(await branchTitle.inputValue(), "Memory outside current chat, edited");
      await branchTitle.fill("Memory outside current chat");
      await page.getByRole("button", { name: "Change where available" }).click();
      await branchAvailability.waitFor();
      assert.equal(await wholeChatPill.count(), 1);
      assert.equal(await branchPills.count(), 0, "the whole chat's chip covers its branches");
      assert.equal(await branchAvailability.locator("[data-ltm-availability-pills] button").count(), 4);
      await wholeChatPill.click();
      assert.equal(await wholeChatPill.count(), 0);
      // #1588: focus stays in the chip list on a neighbouring chip's Remove button.
      await page.waitForFunction(
        () => document.activeElement?.matches("[data-ltm-availability-pills] [data-ltm-pill-remove]") ?? false,
      );
      assert.equal(await branchPills.count(), 0, "removing the whole chat removes its branches");
      await branchAvailability.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Change where available" }).click();
      await branchAvailability.waitFor();
      await branchAvailability.locator("[data-ltm-availability-picker] > summary").click();
      await branchRail.locator('[data-ltm-availability-tab="chat"]').click();
      await branchRail.locator('[data-ltm-availability-target="chat:conversation-a"]').click();
      await branchRail.locator('[data-ltm-availability-target="chat:conversation-a"][aria-pressed="false"]').waitFor();
      assert.equal(await branchPills.count(), 0, "unticking the whole chat removes its branches");
      await branchAvailability.getByRole("button", { name: "Save availability" }).click();
      await page.waitForFunction(() => document.querySelector("[data-ltm-availability-workbench]") === null);
      const removedBranchScope = branchAvailabilityPatches.at(-1)?.scope as SavedScope & { groupId?: string };
      assert.deepEqual(removedBranchScope.chatIds, ["bulk-chat-7"], JSON.stringify(removedBranchScope));
      assert.equal(removedBranchScope.groupIds, undefined, JSON.stringify(removedBranchScope));
      assert.equal(removedBranchScope.groupId, undefined, JSON.stringify(removedBranchScope));
      assert.equal(branchAvailabilityPatches.length, 2);
      // Hold a save, then reopen the same memory with Discard and continue while it runs.
      let releaseBranchSave: (() => void) | null = null;
      const branchSaveHeld = new Promise<void>((resolve) => {
        releaseBranchSave = resolve;
      });
      const branchNoteRoute = `**/api/long-term-memory/notes/${outsideChatNote.id}`;
      let deferRecallRebuild = false;
      let deferRecallError: string | undefined = "index busy";
      await page.route(branchNoteRoute, async (route) => {
        if (route.request().method() === "PATCH") await branchSaveHeld;
        if (route.request().method() === "PATCH" && deferRecallRebuild) {
          const response = await route.fetch();
          await route.fulfill({
            response,
            json: {
              ...(await response.json()),
              rebuild: { status: "deferred", ...(deferRecallError ? { error: deferRecallError } : {}) },
            },
          });
          return;
        }
        await route.continue();
      });
      await branchTitle.fill("Memory outside current chat, saved");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await branchCard.locator("button").first().click();
      await page.getByRole("button", { name: "Discard and continue", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLInputElement>("[data-ltm-field='title']")?.value === "Memory outside current chat",
      );
      const noteQueriesBeforeSave = noteQueries.length;
      releaseBranchSave?.();
      // When the save finishes, the reopened memory shows what was saved, Save reads "Save" again and works after an
      // edit, and the list reloads.
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLInputElement>("[data-ltm-field='title']")?.value ===
          "Memory outside current chat, saved",
      );
      await page.getByRole("button", { name: "Save", exact: true }).waitFor();
      await branchTitle.fill("Memory outside current chat, edited again");
      await page.locator("[data-ltm-save]:not([aria-disabled])").waitFor();
      assert.ok(noteQueries.length > noteQueriesBeforeSave, "the memory list reloads after the save");
      // #1636: Save keeps its label and focus (aria-disabled, never disabled) and a polite status beside it says Saved.
      const saveButton = page.locator("[data-ltm-save]");
      const saveStatus = page.locator("[data-ltm-save-status]");
      assert.equal(await saveStatus.getAttribute("role"), "status");
      await saveButton.focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("[data-ltm-save-status]")?.textContent === "Saved");
      assert.equal(await saveButton.getAttribute("aria-disabled"), "true");
      assert.equal(await saveButton.getAttribute("disabled"), null);
      assert.equal(await saveButton.innerText(), "Save");
      await page.locator("[data-ltm-save]:focus").waitFor();
      await branchTitle.fill("Memory outside current chat, edited a third time");
      assert.equal(await saveStatus.innerText(), "", "an edit clears the Saved status");
      // A save whose recall rebuild is deferred is a warning with the strong border, not a danger error.
      deferRecallRebuild = true;
      await saveButton.click();
      const staleWarning = page.locator('[data-sonner-toast][data-type="warning"]').filter({
        hasText: "Saved. Recall will catch up once the reindex succeeds: index busy",
      });
      await staleWarning.waitFor({ timeout: 5000 });
      assert.equal(
        (await staleWarning.first().innerText()).trim(),
        "Saved. Recall will catch up once the reindex succeeds: index busy",
      );
      assert.equal(await staleWarning.first().locator("[data-icon]").count(), 1);
      assert.equal(await page.locator('[data-sonner-toast][data-type="error"]').count(), 0);
      // A deferred rebuild that reports no error leaves no dangling colon.
      deferRecallError = undefined;
      await branchTitle.fill("Memory outside current chat, saved without a rebuild error");
      await saveButton.click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('[data-sonner-toast][data-type="warning"] [data-title]')].some(
          (title) => title.textContent?.trim() === "Saved. Recall will catch up once the reindex succeeds.",
        ),
      );
      // The next message resets the tone: a plain save raises the success toast again.
      deferRecallRebuild = false;
      await branchTitle.fill("Memory outside current chat, saved");
      await markToasts(page);
      await saveButton.click();
      await page.waitForFunction(() => document.querySelector("[data-ltm-save-status]")?.textContent === "Saved");
      await newToast(page, "Memory saved.").first().waitFor();
      assert.equal(
        await newToast(page, "Memory saved.").first().getAttribute("data-type"),
        "success",
        "a plain save after a deferred rebuild raises the success tone again",
      );
      assert.equal(
        await page.locator('[data-sonner-toast][data-type="warning"]:not([data-test-seen])').count(),
        0,
        "the later save raises no new warning toast",
      );
      // Opening another memory without editing must not carry the Saved status over to it.
      const otherRow = page
        .locator(`[data-ltm-note-id]:not([data-ltm-note-id="${outsideChatNote.id}"]) button`)
        .first();
      assert.ok(await otherRow.count(), "a second memory row exists to open");
      await page.waitForFunction(() => document.querySelector("[data-ltm-save-status]")?.textContent === "Saved");
      await otherRow.click();
      await page.waitForFunction(() => document.querySelector("[data-ltm-save-status]")?.textContent === "");
      // #1636: the open row is marked beyond colour: aria-current on its button and a start-edge bar, on that row only.
      assert.equal(await otherRow.getAttribute("aria-current"), "true");
      assert.equal(await page.locator('[data-ltm-note-id] button[aria-current="true"]').count(), 1);
      assert.equal(await page.locator("[data-ltm-note-open-bar]").count(), 1);
      await page.locator(`[data-ltm-note-id="${outsideChatNote.id}"] button`).first().click();
      await page.locator(`[data-ltm-note-id="${outsideChatNote.id}"] [data-ltm-note-open-bar]`).waitFor();
      assert.equal(await otherRow.getAttribute("aria-current"), null);
      await branchTitle.fill("Memory outside current chat, saved");
      // Save pressed in an unsaved-changes prompt while a save is in flight joins that save: one PATCH, and the
      // caller still finishes what it was asked to do. Both callers (the Vault dialog, the destination prompt).
      let outsidePatchRequests = 0;
      const countOutsidePatch = (request: { method: () => string; url: () => string }) => {
        if (request.method() === "PATCH" && request.url().endsWith(`/notes/${outsideChatNote.id}`))
          outsidePatchRequests += 1;
      };
      page.on("request", countOutsidePatch);
      let inFlightGate: Promise<void> = Promise.resolve();
      let releaseInFlightSave!: () => void;
      const holdNextSave = () => {
        inFlightGate = new Promise<void>((resolve) => {
          releaseInFlightSave = resolve;
        });
      };
      await page.route(branchNoteRoute, async (route) => {
        if (route.request().method() === "PATCH") await inFlightGate;
        await route.fallback();
      });
      const waitForOutsidePatches = async (count: number) => {
        for (let attempt = 0; attempt < 100 && outsidePatchRequests < count; attempt += 1)
          await page.waitForTimeout(20);
        assert.equal(outsidePatchRequests, count);
      };
      const saveAndContinue = page.getByRole("button", { name: "Save and continue", exact: true });
      const noSaveError = async () =>
        assert.equal(await page.locator('[data-sonner-toast][data-type="error"]').count(), 0);
      holdNextSave();
      let patchesBefore = outsidePatchRequests;
      await branchTitle.fill("Memory outside current chat, saved in flight");
      await saveButton.click();
      await waitForOutsidePatches(patchesBefore + 1);
      await otherRow.click();
      await saveAndContinue.click();
      await page.waitForTimeout(150);
      assert.equal(outsidePatchRequests, patchesBefore + 1, "Vault dialog: Save joins the save in flight");
      releaseInFlightSave();
      await page.waitForFunction((openId) => {
        const open = document.querySelector('[data-ltm-note-id] button[aria-current="true"]');
        const id = open?.closest("[data-ltm-note-id]")?.getAttribute("data-ltm-note-id");
        return Boolean(id) && id !== openId;
      }, outsideChatNote.id);
      assert.equal(outsidePatchRequests, patchesBefore + 1, "Vault dialog: no second save after the first lands");
      await noSaveError();
      await page.locator(`[data-ltm-note-id="${outsideChatNote.id}"] button`).first().click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLInputElement>("[data-ltm-field='title']")?.value ===
          "Memory outside current chat, saved in flight",
      );
      // Two saves in a row: each one raises its own "Memory saved." toast, so the second is announced as well.
      await markToasts(page);
      await branchTitle.fill("Memory outside current chat, first of two");
      await saveButton.click();
      await newToast(page, "Memory saved.").first().waitFor();
      await branchTitle.fill("Memory outside current chat, second of two");
      assert.equal(await newToast(page, "Memory saved.").count(), 1, "the first toast stays until the next save");
      await saveButton.click();
      await newToast(page, "Memory saved.").nth(1).waitFor();
      // Destination prompt: leaving the Vault for Review while a save is in flight joins that save too.
      holdNextSave();
      patchesBefore = outsidePatchRequests;
      await branchTitle.fill("Memory outside current chat, saved for destination");
      await saveButton.click();
      await waitForOutsidePatches(patchesBefore + 1);
      await reviewDestination.click();
      await saveAndContinue.click();
      await page.waitForTimeout(150);
      assert.equal(outsidePatchRequests, patchesBefore + 1, "Destination prompt: Save joins the save in flight");
      releaseInFlightSave();
      await page.locator('[data-ltm-surface="review-queue"]').waitFor();
      assert.equal(outsidePatchRequests, patchesBefore + 1, "Destination prompt: no second save after the first lands");
      assert.equal(await page.locator("[data-ltm-unsaved-dialog]").count(), 0);
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
      await openWorldGroup();
      await page.locator(`[data-ltm-note-id="${outsideChatNote.id}"] button`).first().click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLInputElement>("[data-ltm-field='title']")?.value ===
          "Memory outside current chat, saved for destination",
      );
      await branchTitle.fill("Memory outside current chat, saved");
      await saveButton.click();
      await page.waitForFunction(() => document.querySelector("[data-ltm-save-status]")?.textContent === "Saved");
      page.off("request", countOutsidePatch);
      await page.unroute(branchNoteRoute);
      // Escape keeps the Rename detail dialog open while the rename runs, as its disabled Cancel button does.
      let releaseRename: (() => void) | null = null;
      const renameHeld = new Promise<void>((resolve) => {
        releaseRename = resolve;
      });
      const renameRoute = `**/api/long-term-memory/notes/${outsideChatNote.id}/sections/rename`;
      await page.route(renameRoute, async (route) => {
        await renameHeld;
        await route.fulfill({
          json: {
            note: {
              ...outsideChatNote,
              sections: { background: outsideChatNote.sections.facts },
              version: outsideChatNote.version + 1,
            },
            rebuild: { status: "complete" },
          },
        });
      });
      const renameDetailButton = page.getByRole("button", { name: /^Rename section: /u }).first();
      if (!(await renameDetailButton.isVisible())) await page.locator("[data-ltm-details-toggle]").click();
      if (!(await renameDetailButton.isVisible()))
        await page.locator("summary", { hasText: "Rename sections" }).click();
      await renameDetailButton.click();
      const renameDialog = page.locator("dialog").filter({ has: page.locator("#ltm-rename-detail-title") });
      await renameDialog.getByLabel("New section name").fill("background");
      const renameRequest = page.waitForRequest(
        (request) => request.method() === "POST" && request.url().endsWith("/sections/rename"),
      );
      await renameDialog.getByRole("button", { name: "Save section name" }).click();
      await renameRequest;
      await page.keyboard.press("Escape");
      assert.equal(
        await renameDialog.evaluateAll(
          (dialogs) => dialogs.filter((dialog) => (dialog as HTMLDialogElement).open).length,
        ),
        1,
        "Escape keeps the dialog open while the rename runs",
      );
      releaseRename?.();
      await renameDialog.waitFor({ state: "detached" });
      // #1588: closing Rename details returns focus to a Rename button, here the renamed detail's.
      const renameButtonFocused = () =>
        page.waitForFunction(() => document.activeElement?.matches("[data-ltm-rename-detail]") ?? false);
      await renameButtonFocused();
      await page.unroute(renameRoute);
      // Below 48rem the memory list's pane is hidden while the details show; Rename detail still opens a
      // visible dialog instead of an invisible one that freezes the page (#1584).
      const vaultViewport = page.viewportSize();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('[data-ltm-workspace-pane-tab="navigator"]').waitFor({ state: "visible" });
      const narrowInspectorTab = page.locator('[data-ltm-workspace-pane-tab="inspector"]');
      if (await narrowInspectorTab.count()) await narrowInspectorTab.click();
      else await page.locator("[data-ltm-details-toggle]").click();
      if (!(await renameDetailButton.isVisible()))
        await page.locator("summary", { hasText: "Rename sections" }).click();
      await renameDetailButton.click();
      assert.equal(await page.locator('[data-ltm-workspace-pane="navigator"]').isVisible(), false);
      const narrowRenameDialog = await renameDialog.evaluate((dialog) => ({
        open: (dialog as HTMLDialogElement).open,
        ...dialog.getBoundingClientRect().toJSON(),
      }));
      assert.ok(
        narrowRenameDialog.open && narrowRenameDialog.width > 0 && narrowRenameDialog.height > 0,
        `the open Rename details dialog is visible at 390px: ${JSON.stringify(narrowRenameDialog)}`,
      );
      await renameDialog.getByRole("button", { name: "Cancel" }).click();
      await renameDialog.waitFor({ state: "detached" });
      await renameButtonFocused();
      if (vaultViewport) await page.setViewportSize(vaultViewport);

      // #1588: docked narrow on a wide window, the Vault lays out by its own width: row actions move into
      // the More menu and the memory list follows the page instead of a viewport-height scroller.
      const vaultLayout = () =>
        page.locator("[data-ltm-memory-list]").evaluate((list) => ({
          inline: getComputedStyle(list.querySelector('[data-ltm-row-actions="inline"]')!).display,
          menu: getComputedStyle(list.querySelector('[data-ltm-row-actions="menu"]')!).display,
          capped: getComputedStyle(list).maxHeight !== "none",
        }));
      assert.deepEqual(await vaultLayout(), { inline: "flex", menu: "none", capped: true });
      await dockDetailPanel(page, "24rem");
      await page.locator('[data-ltm-workspace-pane-tab="navigator"]').click();
      assert.deepEqual(await vaultLayout(), { inline: "none", menu: "block", capped: false });
      if (visualOutputDir) await page.screenshot({ path: join(visualOutputDir, "long-term-memory-vault-docked.png") });
      assert.equal(await touchTargetSize(page.locator('[data-ltm-control="back"]')), "fits");
      await dockDetailPanel(page, null);
      await memorySearch.fill("Scoped desktop memory");
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
      const recoverySource = page.locator('[data-ltm-review-source-select="source_mobile_recovery"]');
      if ((await recoverySource.getAttribute("aria-expanded")) !== "true") await recoverySource.click();
      const recoveryDraft = page.locator(`[data-ltm-review-draft-select="${reviewDraftIds.recovery}"]`);
      await recoveryDraft.waitFor();
      assert.match(await recoveryDraft.innerText(), /Mobile recovery draft summary/u);
      assert.doesNotMatch(await recoveryDraft.innerText(), /Draft 1/u);
      const singleSource = page.locator('[data-ltm-review-source-select="source_mobile_single"]');
      await singleSource.click();
      const singleDraft = page.locator(`[data-ltm-review-draft-select="${reviewDraftIds.single}"]`);
      await singleDraft.waitFor();
      assert.match(await singleDraft.innerText(), /Single-source-mobile-memory-/u);
      assert.doesNotMatch(await singleDraft.innerText(), /Draft 1/u);
      await singleDraft.click();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.locator("[data-ltm-review-draft-title]").innerText(), singleDraftTitle);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      const blankSource = page.locator('[data-ltm-review-source-select="source_mobile_blank"]');
      await blankSource.click();
      const blankDraft = page.locator(`[data-ltm-review-draft-select="${reviewDraftIds.blank}"]`);
      await blankDraft.waitFor();
      assert.equal(await blankDraft.innerText(), "No draft summary.\n0\nFresh");
      // Counts and the Fresh chip use the full text color, and Fresh carries no accent (#1654 contrast).
      const blankDraftStyle = await blankDraft.evaluate((button) => {
        const [title, count] = Array.from(button.querySelectorAll<HTMLElement>("span.min-w-0 > span > span"));
        const chip = button.querySelector<HTMLElement>("[data-ltm-freshness]")!;
        return {
          title: getComputedStyle(title).color,
          count: getComputedStyle(count).color,
          chip: getComputedStyle(chip).color,
          chipBorder: getComputedStyle(chip).borderTopWidth,
        };
      });
      assert.equal(blankDraftStyle.count, blankDraftStyle.title, "draft counts use the full text color");
      assert.equal(blankDraftStyle.chip, blankDraftStyle.title, "the Fresh chip uses the full text color");
      assert.equal(blankDraftStyle.chipBorder, "0px", "Fresh has no border");
      await blankDraft.click();
      assert.equal(await page.locator("[data-ltm-review-draft-title]").innerText(), "No draft summary.");
      const reviewSource = page.locator('[data-ltm-review-source-select="source_mobile_review"]');
      await reviewSource.click();
      const reviewDraftRows = page.locator(
        `#ltm-review-source-panel-source_mobile_review [data-ltm-review-draft-select]`,
      );
      await reviewDraftRows.first().waitFor();
      assert.equal(await reviewDraftRows.count(), 3);
      const reviewDraftRowText = await reviewDraftRows.allInnerTexts();
      for (const title of [
        "First mobile review memory",
        "Second mobile review memory summary",
        "Merge proposed mobile memory",
      ])
        assert.equal(reviewDraftRowText.filter((text) => text.includes(title)).length, 1);
      assert.ok(reviewDraftRowText.every((text) => !/Draft 1/u.test(text)));
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.first}"] [data-ltm-review-mutation-toggle]`)
        .click();
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
      await page.evaluate(() => {
        let writes = 0;
        const originalSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function (key, value) {
          if (key.startsWith("marinara_ltm_review_state:")) writes += 1;
          return originalSetItem(key, value);
        };
        const counter = {
          get value() {
            return writes;
          },
        };
        Object.defineProperty(window, "reviewStateWriteCount", {
          configurable: true,
          get: Object.getOwnPropertyDescriptor(counter, "value")?.get,
        });
      });
      const dirtyEditor = page.locator("[data-ltm-review-mutation] textarea").first();
      await dirtyEditor.fill("Dirty memory draft");
      await dirtyEditor.fill("Dirty memory latest");
      await dirtyEditor.fill("Dirty memory");
      await page.waitForTimeout(350);
      assert.equal(await page.evaluate(() => (window as any).reviewStateWriteCount), 1);
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      await page.locator('[data-ltm-review-source-select="source_mobile_recovery"]').click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').click();
      await page.locator("[data-ltm-review-mutation-toggle]").click();
      assert.equal(await page.locator("[data-ltm-review-mutation] textarea").first().inputValue(), "Dirty memory");
      assert.deepEqual(
        await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes("review_state"))),
        ["marinara_ltm_review_state:desktop-chat"],
      );
      // soup/setup-beats: Done offers "Review them now" while drafts wait; it opens Review and closes setup.
      await page.evaluate((key) => localStorage.setItem(key, "beat:4"), "marinara-long-term-memory-onboarding-v1");
      await helpButton.click();
      await page.locator("[data-ltm-help-setup]").click();
      const reviewSetup = page.locator('[data-ltm-surface="onboarding"][data-ltm-setup-beat="4"]');
      await reviewSetup.locator("[data-ltm-setup-review]").click();
      await reviewSetup.waitFor({ state: "detached" });
      assert.equal(await page.locator('[data-ltm-surface="review-queue"]').count(), 1);
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), "marinara-long-term-memory-onboarding-v1"),
        "done",
      );
      pendingDraftCount = 0;
      reviewFingerprintRevision = 0;
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
      assert.equal(await page.locator("[data-ltm-review-mutation] textarea").first().inputValue(), "Dirty memory");
      reviewFingerprintRevision = 1;
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
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
      await page.locator("[data-ltm-review-state-warning]").waitFor();
      // #1588: a warning carries an icon and the strong editor border, not only a tone attribute.
      const reviewStateWarning = page.locator("[data-ltm-review-state-warning]");
      assert.equal(await reviewStateWarning.locator("[data-ltm-status-icon]").count(), 1);
      assert.equal(
        await reviewStateWarning.evaluate((surface) => {
          const probe = document.createElement("div");
          probe.style.border = "1px solid var(--marinara-editor-border-strong)";
          surface.parentElement?.append(probe);
          const expected = getComputedStyle(probe).borderTopColor;
          probe.remove();
          const actual = getComputedStyle(surface).borderTopColor;
          return actual === expected ? "strong" : `${actual} is not ${expected}`;
        }),
        "strong",
      );
      assert.equal(
        await reviewStateWarning.evaluate((surface) => getComputedStyle(surface).paddingTop),
        "8px",
        "a status surface keeps its text and actions off its border",
      );
      reviewFingerprintRevision = 0;
      // #1611: leaving the Review Queue with unsaved state asks first; Stay keeps the screen.
      const confirmDialog = page.locator("[data-ltm-confirm-dialog]");
      const vaultTab = page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]');
      await vaultTab.click();
      await confirmDialog.waitFor();
      // #1617: the confirm fallback names where the user is going, like the in-page dialog does.
      assert.match(await confirmDialog.innerText(), /Your changes are not saved\. Discard them to open .+\./u);
      // soup/confirm: the fallback is the package's own dialog, opens on Cancel, closes with Esc and gives focus back.
      await page.locator("[data-ltm-confirm-cancel]:focus").waitFor();
      await page.keyboard.press("Escape");
      await confirmDialog.waitFor({ state: "detached" });
      await vaultTab.and(page.locator(":focus")).waitFor();
      assert.equal(await page.locator("[data-ltm-confirm-dialog]").count(), 0, "No dialog is left to block clicks");
      assert.equal(await page.locator('[data-ltm-surface="review-queue"]').count(), 1);
      await vaultTab.click();
      await confirmDialog.waitFor();
      await page.locator("[data-ltm-confirm-ok]").click();
      // soup/confirm: the confirmed action's own focus move wins over the opener restore. The Vault takes focus on
      // arrival (its navigator's first control); the dialog's restore waits two frames and then finds focus placed.
      await page.locator('[data-ltm-surface="vault"] :focus').waitFor();
      await page.evaluate(() => new Promise((settled) => requestAnimationFrame(() => requestAnimationFrame(settled))));
      assert.equal(await page.locator('[data-ltm-surface="vault"] :focus').count(), 1);
      assert.equal(await vaultTab.and(page.locator(":focus")).count(), 0, "focus is not sent back to the opener");
      // soup/setup-beats: each beat saves on tap, a reload resumes at the saved beat, and Done shows the Vault.
      await page.evaluate((key) => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          enabledForChat: false,
          onEnabledForChatChange: (
            window as Window & {
              onDesktopActivationChange: (enabled: boolean) => void;
            }
          ).onDesktopActivationChange,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
        localStorage.removeItem(key);
      }, "marinara-long-term-memory-onboarding-v1");
      await helpButton.click();
      await page.locator("[data-ltm-help-setup]").click();
      const setupBeat = (beat: number) =>
        page.locator(`[data-ltm-surface="onboarding"][data-ltm-setup-beat="${beat}"]`);
      await setupBeat(1).waitFor();
      // A held turn-on keeps the answer focusable and aria-disabled, and Enter or Space on it
      // sends no second request (Enter and Space still fire onClick on an aria-disabled button).
      let releaseHeldTurnOn!: () => void;
      activationGate = new Promise<void>((resolve) => {
        releaseHeldTurnOn = resolve;
      });
      const rememberChoice = page.locator('[data-ltm-setup-choice="remember"]');
      await rememberChoice.click();
      await page.locator('[data-ltm-setup-choice="remember"][aria-disabled="true"]').waitFor();
      await rememberChoice.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Space");
      await page.waitForTimeout(150);
      assert.deepEqual(desktopActivationChanges, [true], "a held turn-on sends exactly one request");
      releaseHeldTurnOn();
      await setupBeat(2).waitFor();
      assert.deepEqual(desktopActivationChanges, [true]);
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), "marinara-long-term-memory-onboarding-v1"),
        "beat:2",
      );
      // How: a tapped answer saves at once and shows pressed; Next keeps it and moves on.
      const writesBeforeChoice = extractionWrites.length;
      await page.locator('[data-ltm-setup-choice="review"]').click();
      await page.locator('[data-ltm-setup-choice="review"][aria-pressed="true"]').waitFor();
      assert.ok(extractionWrites.length > writesBeforeChoice, "a tapped answer saves right away");
      await page.locator("[data-ltm-setup-next]").click();
      await setupBeat(3).waitFor();
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), "marinara-long-term-memory-onboarding-v1"),
        "beat:3",
      );
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
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      await helpButton.click();
      await page.locator("[data-ltm-help-setup]").click();
      await setupBeat(3).waitFor();
      // Records when beat 4 and its first recap row appear, to catch a one-frame flash of the answers.
      await page.evaluate(() => {
        const timing: { beat4?: number; recap?: number } = {};
        (window as unknown as { __ltmRecapTiming: typeof timing }).__ltmRecapTiming = timing;
        new MutationObserver(() => {
          if (timing.beat4 === undefined && document.querySelector('[data-ltm-setup-beat="4"]'))
            timing.beat4 = performance.now();
          if (timing.recap === undefined && document.querySelector("[data-ltm-setup-recap]"))
            timing.recap = performance.now();
        }).observe(document.body, { childList: true, subtree: true, attributes: true });
      });
      await page.locator('[data-ltm-setup-choice="start-fresh"]').click();
      await setupBeat(4).waitFor();
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), "marinara-long-term-memory-onboarding-v1"),
        "done",
      );
      // The answers appear after Mari finishes her lines (`talking`), so wait for the recap before counting it.
      await page.locator('[data-ltm-setup-recap="3"]').waitFor();
      assert.equal(await page.locator("[data-ltm-setup-recap]").count(), 3);
      const recapTiming = await page.evaluate(
        () => (window as unknown as { __ltmRecapTiming: { beat4?: number; recap?: number } }).__ltmRecapTiming,
      );
      assert.ok(
        recapTiming.beat4 !== undefined &&
          recapTiming.recap !== undefined &&
          recapTiming.recap - recapTiming.beat4 >= 300,
        `setup recap waits for Mari's lines instead of flashing with beat 4 (${JSON.stringify(recapTiming)})`,
      );
      await page.locator("[data-ltm-setup-open-vault]").click();
      await page.locator('[data-ltm-surface="onboarding"]').waitFor({ state: "detached" });
      await page.locator('[data-ltm-surface="vault"]').waitFor();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="sources"]').click();
      await page.locator('[data-ltm-source-tab="lorebooks"]').click();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').waitFor();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="sources"]').click();
      await page.locator('[data-ltm-source-tab="lorebooks"][aria-selected="true"]').waitFor();
      await page.locator('[data-ltm-source-tab="chats"]').click();
      assert.deepEqual(
        await shortTouchTargets('[data-ltm-surface="sources"]'),
        [],
        "Sources tabs and actions fit 2.75rem",
      );
      // soup/sources-review: with a chat open the one bar reads "Available in: This chat" and Import is not gated.
      assert.equal(
        (await page.locator("#ltm-destination-scope-control [data-ltm-destination-scope-summary]").innerText()).trim(),
        "This chat",
        "soup/sources-review: the destination defaults to the open chat",
      );
      // #1714: the destination tabs sit under the same Engine min-height rule as the Sources and Settings tabs.
      assert.equal(
        await page.locator('[data-ltm-navigation="desktop"] .mari-editor-tab:visible').count(),
        5,
        "the five destination tabs are on screen",
      );
      assert.deepEqual(
        await shortTouchTargets('[data-ltm-navigation="desktop"]'),
        [],
        "the destination tabs fit 2.75rem",
      );
      assert.equal(
        scopeTargetQueries.slice(scopeTargetQueryCount).includes("?includeAllChats=true&chatId=desktop-chat"),
        true,
      );
      // soup/ltm-frame: every desktop tab shows an icon and its full name, and its tab opens with a heading and
      // one subtitle line.
      const desktopTabs = await page
        .locator('[data-ltm-navigation="desktop"] [data-ltm-control="navigation"]')
        .evaluateAll((tabs) =>
          tabs.map((tab) => ({
            destination: tab.getAttribute("data-ltm-destination"),
            icon: tab.querySelector("svg") !== null,
            text: tab.textContent ?? "",
          })),
        );
      assert.deepEqual(
        desktopTabs.map((tab) => [
          tab.destination,
          tab.icon,
          /Memories|Review|Sources|Activity|Memory Settings/u.exec(tab.text)?.[0],
        ]),
        [
          ["vault", true, "Memories"],
          ["review", true, "Review"],
          ["sources", true, "Sources"],
          ["activity", true, "Activity"],
          ["settings", true, "Memory Settings"],
        ],
        "each desktop tab has an icon and its full name",
      );
      const tabSubtitles: Array<[string, string, string]> = [
        ["vault", "Memory vault", "Saved memories"],
        ["review", "Review queue", "Proposals waiting for your OK"],
        ["sources", "Sources", "Import from chats, lorebooks, characters"],
        ["activity", "Activity", "What memory did and why"],
      ];
      for (const [destination, heading, subtitle] of tabSubtitles) {
        await page.locator(`[data-ltm-navigation="desktop"] [data-ltm-destination="${destination}"]`).click();
        const region = page.locator("[data-ltm-destination-content]");
        await region.getByRole("heading", { name: heading, exact: true }).first().waitFor();
        assert.equal(
          await region.locator("[data-ltm-tab-subtitle]").first().innerText(),
          subtitle,
          `${destination} opens with its subtitle`,
        );
      }
      // Memory Settings states its scope in one line under the tabs instead of a subtitle.
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
      const settingsRegion = page.locator("[data-ltm-destination-content]");
      await settingsRegion.getByRole("heading", { name: "Memory Settings", exact: true }).first().waitFor();
      assert.equal(await settingsRegion.locator("[data-ltm-tab-subtitle]").count(), 0);
      await settingsRegion.locator("[data-ltm-settings-reassurance]").waitFor();
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      // The Engine header's Active switch is the one per-chat on/off; the package draws no second control.
      assert.equal(
        await page.locator('[data-ltm-surface="activation-chip"]').count(),
        0,
        "no activation chip on a chat",
      );
      assert.equal(await page.locator('[data-ltm-control="activation"]').count(), 0, "no Turn on/off button");
      assert.equal(await page.locator('[aria-label="Add memories"]').isVisible(), true);
      // #1673: a wide detail surface shows the add label.
      assert.equal(await page.locator("[data-ltm-add-label]").isVisible(), true, "a wide surface shows the add label");
      // The extraction connection picker names each connection's model, and the default option names the host's
      // default agent connection; image and video connections never appear.
      // The host sends its flag columns as the text "true" / "false"; only the language default is named.
      const connectionRows = [
        { id: "conn-voice", name: "My Voice", provider: "audio", model: "tts-1", defaultForAgents: "true" },
        { id: "conn-fast", name: "Quick Pen", provider: "openai", model: "gpt-fast", defaultForAgents: "false" },
        { id: "conn-deep", name: "Deep Ink", provider: "anthropic", model: "claude-deep", defaultForAgents: "true" },
        { id: "conn-bare", name: "", provider: "custom", model: "", defaultForAgents: "false" },
        { id: "conn-art", name: "Pixel Art", provider: "image_generation", model: "art-1", defaultForAgents: "false" },
      ];
      const connectionsRoute = (route: { fulfill: (response: { status: number; json: unknown }) => Promise<void> }) =>
        route.fulfill({ status: 200, json: connectionRows });
      await page.route("**/api/connections", connectionsRoute);
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
      await page.locator("#settings-tab-extraction").click();
      // Extraction settings load after the tab opens, so wait for the choice rather than sampling once.
      await page
        .locator('#settings-panel-extraction [data-ltm-chat-memories="global"]')
        .waitFor({ state: "visible", timeout: 5_000 });
      const connectionPicker = page.getByLabel("Model for extraction", { exact: true });
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("#settings-panel-extraction select option")].some((option) =>
            /Deep Ink/u.test(option.textContent ?? ""),
          ),
        undefined,
        { timeout: 5_000 },
      );
      assert.deepEqual(
        await connectionPicker.locator("option").allTextContents(),
        [
          "Default agent connection (Deep Ink · claude-deep)",
          "My Voice · tts-1",
          "Quick Pen · gpt-fast",
          "Deep Ink · claude-deep",
          "custom",
        ],
        "each connection reads name · model, a missing name falls back to the provider, and image connections are left out",
      );
      await page.unroute("**/api/connections", connectionsRoute);
      assert.deepEqual(
        await shortTouchTargets('[data-ltm-surface="memory-settings"]'),
        [],
        "Settings tabs fit 2.75rem",
      );
      const desktopExtractionLayout = await page
        .locator("#settings-panel-extraction > [data-ltm-extraction-grid]")
        .evaluate((grid) => {
          // The model picker sits in the Model section under the first grid; its name is directly above it.
          const connection = document.querySelector("#settings-panel-extraction [data-ltm-connection-field]")!;
          const label = connection.firstElementChild as HTMLElement;
          const select = connection.querySelector("select")!;
          const infoButtons = grid.querySelectorAll("[data-ltm-info]").length;
          return {
            columns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/u).length,
            labelGap: select.getBoundingClientRect().top - label.getBoundingClientRect().bottom,
            selectHeight: select.getBoundingClientRect().height,
            infoButtons,
          };
        });
      assert.equal(desktopExtractionLayout.columns, 2);
      assert.equal(
        await page
          .locator("[data-ltm-settings-tab-rail]")
          .evaluate((rail) => getComputedStyle(rail).gridTemplateColumns.split(/\s+/u).length),
        2,
        "a wide Settings container shows both tabs in one row",
      );
      assert.equal(
        await page
          .locator("[data-ltm-active-template-grid]")
          .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(/\s+/u).length),
        3,
        "a wide Settings container puts the three active-template pickers in one row",
      );
      assert.ok(
        desktopExtractionLayout.labelGap >= 0 && desktopExtractionLayout.labelGap <= 8,
        `the model picker's name sits directly above it (gap ${desktopExtractionLayout.labelGap}px)`,
      );
      assert.equal(desktopExtractionLayout.selectHeight, 44);
      assert.equal(
        desktopExtractionLayout.infoButtons,
        0,
        "Extraction guidance is hints under the controls, not (i) buttons",
      );
      // #1673: a 420px-high window stands in for the height at 200% zoom (Playwright has no zoom API). Headless
      // Chromium reads vh and dvh alike, so this proves the caps track the window; the dvh unit is pinned statically.
      const fitsWindow = (list: ReturnType<typeof page.locator>) =>
        list.evaluate((element) => parseFloat(getComputedStyle(element).maxHeight) + 12 * 16 <= innerHeight + 1);
      await page.setViewportSize({ width: 1280, height: 420 });
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
      assert.equal(
        await fitsWindow(page.locator("[data-ltm-memory-list]")),
        true,
        "the Vault list cap fits a short window",
      );
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
      await openActivityLog(page);
      assert.equal(
        await fitsWindow(page.locator("[data-ltm-debug-list]")),
        true,
        "the Debug log cap fits a short window",
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      // #1673: a narrow panel on a wide window keeps the phone layout inside the panel, not at a window breakpoint.
      await dockDetailPanel(page, "24rem");
      await page.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="vault"]').click();
      const narrowAdd = page.locator('[aria-label="Add memories"]');
      await narrowAdd.waitFor();
      assert.equal(await touchTargetSize(narrowAdd), "fits", "a 24rem panel keeps the add control at 2.75rem");
      assert.equal(await page.locator("[data-ltm-add-label]").isVisible(), false, "a 24rem panel shows the icon only");
      // #1714: the header icon and content padding follow the panel too, not the window.
      assert.deepEqual(
        await page.evaluate(() => ({
          icon: getComputedStyle(document.querySelector("[data-ltm-detail-icon]")!).width,
          padding: getComputedStyle(document.querySelector("[data-ltm-detail-content]")!).paddingLeft,
        })),
        { icon: "14px", padding: "16px" },
        "a 24rem panel uses the compact header icon and padding",
      );
      await page.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="settings"]').click();
      assert.equal(
        await page
          .locator("[data-ltm-settings-tab-rail]")
          .evaluate((rail) => getComputedStyle(rail).gridTemplateColumns.split(/\s+/u).length),
        2,
        "a 24rem Settings container keeps two tab columns",
      );
      if (visualOutputDir)
        await page.screenshot({ path: join(visualOutputDir, "long-term-memory-settings-docked.png") });
      await dockDetailPanel(page, null);
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
      await page.locator("#settings-tab-extraction").click();
      const debugEvent = (operationId: string, action: string, status: string, fields = {}) => ({
        id: `${operationId}-${action}-${status}`,
        operationId,
        ts: noteTimestamp,
        phase: "llm",
        action,
        status,
        sourceNoteId: legacyGlobalNote.id,
        ...fields,
      });
      const secondsAfter = (seconds: number) => new Date(Date.parse(noteTimestamp) + seconds * 1000).toISOString();
      const debugEvents = [
        debugEvent("estimated", "extract_source_note", "started"),
        debugEvent("estimated", "evidence_unit_request", "started", {
          ts: secondsAfter(2),
          model: "fixture-model",
          counts: { estimatedPromptTokens: 123 },
        }),
        debugEvent("estimated", "evidence_unit_response", "ok", {
          ts: secondsAfter(74),
          durationMs: 72_000,
          details: { finishReason: "stop", responseSnippet: "private response snippet" },
        }),
        debugEvent("estimated", "extract_source_note", "ok", { ts: secondsAfter(75), durationMs: 500 }),
        debugEvent("reported", "evidence_unit_request", "started", { counts: { estimatedPromptTokens: 123 } }),
        debugEvent("reported", "evidence_unit_response", "ok", {
          counts: { promptTokens: 40, completionTokens: 12, completionReasoningTokens: 8, totalTokens: 60 },
        }),
        debugEvent("zero", "evidence_unit_request", "started", { counts: { inputTokens: 123 } }),
        debugEvent("zero", "evidence_unit_response", "ok", { counts: { promptTokens: 0 } }),
        debugEvent("truncated", "extract_source_note", "started"),
        debugEvent("truncated", "evidence_unit_response", "warning", {
          details: { finishReason: "length", responseSnippet: "private response snippet" },
        }),
        debugEvent("truncated", "extract_source_note", "ok"),
        debugEvent("context", "evidence_unit_request", "started"),
        debugEvent("context", "evidence_unit_context_preflight", "error", {
          details: { reason: "prompt_trim_required" },
        }),
        debugEvent("budget", "evidence_unit_request", "started"),
        debugEvent("budget", "evidence_unit_context_preflight", "error", {
          details: { reason: "output_budget_below_viability_floor" },
        }),
        debugEvent("partial", "import_sources", "started"),
        debugEvent("partial", "extract_source_note", "error", { error: { message: "One source failed." } }),
        debugEvent("partial", "import_sources", "ok"),
        debugEvent("breakdown", "evidence_units_compiled", "warning", {
          sourceNoteId: "source_mobile_review",
          counts: {
            totalCandidates: 12,
            units: 7,
            mutations: 2,
            targetNotes: 2,
            deduplications: 1,
            candidateRejectionDiagnostics: 4,
          },
          details: {
            mutationKinds: { create_note: 1, append_section: 1 },
            targetNoteIds: ["world_legacy_global", "world_scoped_desktop"],
            // The server always logs the model's own summary, which does not explain the warning.
            summary: "Compiled the extraction into seven units.",
          },
        }),
        debugEvent("breakdown", "draft_deferred", "ok", {
          sourceNoteId: "source_mobile_review",
          counts: { droppedUnits: 9 },
          details: {
            extractionOutcome: {
              state: "partial_success",
              totalCandidates: 12,
              keptUnits: 7,
              droppedUnits: 4,
              droppedCandidateDetailsTruncated: true,
              droppedCandidates: [
                { reason: "missing_source_evidence", message: "No supporting quote.", snippet: "x".repeat(280) },
                { reason: "missing_source_evidence", message: "Evidence was omitted." },
                {
                  reason: "candidate_overflow",
                  message: "Dropped candidates exceeding the extraction processing limit.",
                },
              ],
            },
          },
        }),
        debugEvent("noduration", "recall_explanation", "ok", {
          details: { selected: "truncated", rejected: [null], weights: "truncated", eligibleChunks: 3 },
        }),
        debugEvent("noduration", "draft_deferred", "ok", {
          details: { extractionOutcome: { droppedUnits: "truncated" } },
        }),
        debugEvent("counts-only", "draft_deferred", "ok", {
          counts: { droppedUnits: 3 },
          details: { truncated: true },
        }),
        debugEvent("sample-only", "draft_deferred", "ok", {
          counts: { droppedUnits: 3 },
          details: {
            extractionOutcome: {
              droppedUnits: "truncated",
              droppedCandidates: [{ reason: "invalid_format", message: "One recorded sample." }],
            },
          },
        }),
        debugEvent("missing-samples", "draft_deferred", "ok", {
          counts: { droppedUnits: 5 },
          details: { extractionOutcome: { droppedUnits: 0 } },
        }),
        debugEvent("complete-empty", "draft_deferred", "ok", {
          counts: { droppedUnits: 5 },
          details: { extractionOutcome: { droppedUnits: 0, droppedCandidates: [] } },
        }),
        // Fixture events predate the one-hour stale-threshold, so a started step in
        // a completed operation must not read as unfinished (M1), while a
        // started-only operation still reads "No completion recorded".
        debugEvent("oldstarted", "extract_source_note", "started"),
        // Every recall is an ordinary history row: one names its source chat by the
        // /scope-targets label, one keeps the raw id when the lookup has no match.
        debugEvent("recall-desktop", "recall_explanation", "ok", {
          phase: "retrieval",
          chatId: "desktop-chat",
          counts: { selected: 1, rejected: 0, usedTokens: 12 },
          details: {
            chatId: "desktop-chat",
            selected: [],
            rejected: [],
          },
        }),
        debugEvent("recall", "recall_explanation", "ok", {
          phase: "retrieval",
          // No shared source note: this recall must match the memory filter only
          // through its selected candidate id.
          sourceNoteId: undefined,
          chatId: "chat-artifact",
          counts: { selected: 1, rejected: 6, usedTokens: 42 },
          details: {
            chatId: "chat-artifact",
            maxChunks: 8,
            maxTokens: 2048,
            scoreThreshold: 0.5,
            mode: "on_relevance",
            includeResolved: false,
            exclusiveCharacterTargeting: false,
            contextMessagesUsed: 3,
            indexLoadOutcome: "loaded",
            indexedChunks: 4,
            eligibleChunks: 3,
            embeddedChunks: 2,
            semanticOutcome: "available",
            rejectedLimit: 20,
            weights: { semanticWeight: 0.6 },
            selected: [
              {
                noteId: "world_legacy_global",
                sectionKey: "facts",
                score: 0.35,
                fusedScore: 0.02,
                fusedRank: 1,
                lanes: ["semantic"],
              },
            ],
            rejected: [
              {
                noteId: "world_scoped_desktop",
                sectionKey: "facts",
                score: 0.45,
                fusedScore: 0.01,
                fusedRank: 2,
                rejectionReason: "lower_rank",
              },
              ...["budget", "duplicate_text", "score_threshold", "missing_chunk", "prompt_budget", "type_cap"].map(
                (rejectionReason) => ({ noteId: "world_scoped_desktop", sectionKey: "facts", rejectionReason }),
              ),
            ],
          },
        }),
        // D31: explicit memory-id references the Vault memory filter must match (produced
        // target, rejected recall candidate), plus operations it must not: an unrelated
        // source and an apply carrying only change/mutation ids.
        debugEvent("target", "evidence_units_compiled", "ok", {
          sourceNoteId: "source_target_other",
          details: { targetNoteIds: [legacyGlobalNote.id] },
        }),
        // Two events; only the second references the memory, so matching must find the
        // operation by that single event and still show both events and the status.
        debugEvent("late-reference", "extract_source_note", "started", { sourceNoteId: "world_unrelated" }),
        debugEvent("late-reference", "extract_source_note", "ok", {
          sourceNoteId: undefined,
          noteId: legacyGlobalNote.id,
          durationMs: 700,
        }),
        debugEvent("recall-rejected", "recall_explanation", "ok", {
          phase: "retrieval",
          // Matches only through the rejected candidate id, not a shared source note.
          sourceNoteId: undefined,
          chatId: "chat-artifact",
          details: {
            chatId: "chat-artifact",
            selected: [],
            rejected: [
              { noteId: legacyGlobalNote.id, sectionKey: "facts", score: 0.3, rejectionReason: "score_threshold" },
            ],
          },
        }),
        debugEvent("recall-rejected-threshold", "recall_explanation", "ok", {
          phase: "retrieval",
          sourceNoteId: undefined,
          chatId: "chat-artifact",
          details: {
            chatId: "chat-artifact",
            scoreThreshold: 0.5,
            selected: [],
            rejected: [
              { noteId: legacyGlobalNote.id, sectionKey: "facts", score: 0.3, rejectionReason: "score_threshold" },
            ],
          },
        }),
        debugEvent("apply", "apply_changes", "ok", { sourceNoteId: undefined }),
        // The server logs the selected ids on mutations_selected, with the skipped ids in details.
        debugEvent("apply", "mutations_selected", "ok", {
          sourceNoteId: undefined,
          mutationIds: ["66666666-7777-8888-9999-000000000000"],
          details: { skippedMutationIds: ["11111111-2222-3333-4444-555555555555"] },
        }),
        // An auto-apply runs inside the extraction's operation, so the extraction's own terminal
        // event makes the operation read completed_with_warnings rather than error.
        debugEvent("apply-failed", "extract_source_note", "started", { sourceNoteId: undefined }),
        debugEvent("apply-failed", "extract_source_note", "ok", { sourceNoteId: undefined }),
        // The selection is logged before the write, so a failed apply saved an unknown share of it.
        debugEvent("apply-failed", "mutations_selected", "ok", {
          sourceNoteId: undefined,
          mutationIds: ["77777777-8888-9999-0000-111111111111"],
          details: { skippedMutationIds: [] },
        }),
        debugEvent("apply-failed", "apply_draft", "error", {
          sourceNoteId: undefined,
          error: { message: "The memory could not be written." },
        }),
        // One operation applying two drafts: the failure belongs to its own draft only.
        debugEvent("apply-mixed", "mutations_selected", "ok", {
          id: "apply-mixed-selected-a",
          draftId: "draft-a",
          sourceNoteId: undefined,
          mutationIds: ["88888888-9999-0000-1111-222222222222"],
          details: { skippedMutationIds: [] },
        }),
        debugEvent("apply-mixed", "apply_draft", "error", {
          draftId: "draft-a",
          sourceNoteId: undefined,
          error: { message: "The memory could not be written." },
        }),
        debugEvent("apply-mixed", "mutations_selected", "ok", {
          id: "apply-mixed-selected-b",
          draftId: "draft-b",
          sourceNoteId: undefined,
          mutationIds: ["99999999-0000-1111-2222-333333333333"],
          details: { skippedMutationIds: [] },
        }),
        debugEvent("apply-mixed", "apply_draft", "ok", { draftId: "draft-b", sourceNoteId: undefined }),
        debugEvent("unrelated", "extract_source_note", "ok", { sourceNoteId: "world_unrelated" }),
      ];
      // Simulates a retained log that holds no events for the handed memory.
      let debugLogEmpty = false;
      let debugReviewPending = true;
      let debugExportError = false;
      let debugLogError = false;
      let debugClearDeletes = 0;
      let debugLogDelayMs = 0;
      // Older filler events, so the default 200-event window is full and "Show up to 1,000" shows.
      let debugLogPadding = 0;
      // Holds debug-log responses until the test releases them.
      let debugLogGate: Promise<void> | null = null;
      let debugLogRequests = 0;
      const debugReviewSources = structuredClone(reviewSources);
      const assertDebugActivity = async (activityPage: typeof page, navigation: "desktop" | "mobile") => {
        // D18/D33: the noncompact Activity log Retry keeps a 44px target. Fail the
        // first load, measure the Retry, then recover through it.
        debugLogError = true;
        await openActivityLog(activityPage);
        const activity = activityPage.locator('[data-ltm-surface="activity"]');
        const details = activity.locator("[data-ltm-debug-details]");
        const activityRetry = activity.locator('[data-ltm-status="danger"]').getByRole("button", { name: "Retry" });
        await activityRetry.waitFor();
        const activityRetryBox = await activityRetry.boundingBox();
        assert.ok(activityRetryBox && activityRetryBox.height >= 44, "Activity log Retry keeps a 44px target");
        debugLogError = false;
        await activityRetry.click();
        await activity.locator('[data-ltm-debug-operation="estimated"]').waitFor();
        const showEvents = async () => {
          const tab = activity.locator('[data-ltm-workspace-pane-tab="navigator"]');
          if (await tab.count()) await tab.click();
        };
        const operation = async (id: string) => {
          await showEvents();
          await activity.locator(`[data-ltm-debug-operation="${id}"]`).click();
          await details.waitFor();
          return details.innerText();
        };
        const estimated = await operation("estimated");
        assert.match(estimated, /AI extraction/u);
        assert.match(estimated, /fixture-model/u);
        assert.match(estimated, /500 ms/u);
        assert.match(estimated, /Estimated input: 123 tokens/u);
        assert.doesNotMatch(estimated, /Input \(provider-reported\)|Output:|Total:/u);
        // Steps read as sentences with their offset from the start, in the shared duration units.
        assert.match(estimated, /\+2\.0 s[\s\S]*Sent to the model[\s\S]*Started/u);
        assert.match(estimated, /\+1 min 14 s[\s\S]*Model replied after 1 min 12 s[\s\S]*Succeeded/u);
        assert.match(estimated, /took 500 ms/u, "the header names the operation's recorded duration");
        assert.doesNotMatch(estimated, /Phase \/|LLM \//u, "steps no longer lead with a Phase / Action heading");
        assert.doesNotMatch(estimated, /72,000 ms/u);
        assert.match(estimated, /Copy JSON copies the 4 log records for this operation\./u);
        assert.match(estimated, /It includes the model's reply excerpt, which isn't shown here\./u);
        assert.equal(
          await details.locator("time[datetime]").first().getAttribute("datetime"),
          secondsAfter(75),
          "the header time is the operation's last event",
        );
        // M1: a completed operation's old started steps must not age into "No completion
        // recorded"; a started-only old operation still must.
        assert.doesNotMatch(estimated, /No completion recorded/u);
        assert.match(await operation("oldstarted"), /No completion recorded/u);
        const reported = await operation("reported");
        assert.match(reported, /Completed/u, "a standalone request/response pair must not stay Running");
        assert.match(reported, /Input \(provider-reported\): 40 tokens/u);
        assert.match(reported, /Reasoning: 8 tokens/u);
        assert.match(reported, /Output: 12 tokens/u);
        assert.match(reported, /Total: 60 tokens/u);
        assert.match(await operation("zero"), /Estimated input: 123 tokens/u);
        assert.match(await operation("zero"), /Input \(provider-reported\): 0 tokens/u);
        assert.match(await operation("truncated"), /Completed with warnings/u);
        assert.match(await operation("truncated"), /output limit.*length/iu);
        assert.match(await operation("context"), /Failed/u);
        assert.match(await operation("context"), /too large.*context/iu);
        assert.match(await operation("budget"), /Failed/u);
        assert.match(await operation("budget"), /too small.*response/iu);
        assert.match(await operation("partial"), /Completed with warnings/u);
        assert.match(await operation("partial"), /One source failed\./u);
        assert.match(await operation("truncated"), /What to try[\s\S]*output budget/iu);
        const breakdown = await operation("breakdown");
        assert.match(breakdown, /Result\s+12\s+candidates found\s+→\s+7\s+kept\s+→\s+2\s+changes/u);
        assert.doesNotMatch(breakdown, /kept units/u);
        assert.match(breakdown, /Create note[\s\S]*Append section/u);
        assert.match(breakdown, /Kept 7 of 12 candidates/u);
        assert.match(breakdown, /4 candidates failed checks; see Not kept\./u);
        assert.doesNotMatch(breakdown, /Compile evidence: Warning/u);
        assert.match(breakdown, /Not kept[\s\S]*No supporting quote\.[\s\S]*Evidence was omitted\./u);
        assert.match(breakdown, /The extraction processing limit was exceeded\./u);
        assert.doesNotMatch(breakdown, /unspecified extraction reason/u);
        assert.equal(await details.locator("[data-ltm-debug-drop-reason]").count(), 2);
        assert.equal(await details.locator("blockquote").count(), 1, "missing snippets do not render blank quotes");
        assert.match(breakdown, /and 1 more/u);
        assert.equal(
          await activityPage.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
          true,
          "long candidate quotes must wrap on desktop and mobile",
        );
        await details.getByRole("button", { name: "Open Review" }).click();
        await activityPage.locator('[data-ltm-review-source-select="source_mobile_review"]').waitFor();
        debugReviewPending = false;
        await activityPage.locator(`[data-ltm-navigation="${navigation}"] [data-ltm-destination="settings"]`).click();
        await openActivityLog(activityPage);
        await operation("breakdown");
        await details.getByRole("button", { name: "Open Review" }).waitFor({ state: "hidden" });
        debugReviewPending = true;
        const applied = await operation("apply");
        assert.match(applied, /Result\s+2\s+changes in the draft\s+→\s+1\s+saved/u);
        assert.match(applied, /Selected 1 of 2 changes/u);
        assert.match(applied, /Not saved[\s\S]*1 change skipped/u);
        assert.doesNotMatch(applied, /11111111-2222-3333-4444-555555555555|66666666-7777-8888-9999-000000000000/u);
        assert.equal(
          await details.locator("[data-ltm-debug-facts]").count(),
          0,
          "an operation with no facts renders no empty Details section",
        );
        await details.getByRole("button", { name: /^Copy JSON/u }).click();
        assert.match(
          await activityPage.evaluate(() => navigator.clipboard.readText()),
          /11111111-2222-3333-4444-555555555555/u,
          "raw ids stay available through Copy JSON",
        );
        const failedApply = await operation("apply-failed");
        assert.match(failedApply, /Result[\s\S]*Not recorded/u);
        assert.doesNotMatch(
          failedApply,
          /1 saved|1 change skipped|No skipped changes/u,
          "a failed apply claims no saves",
        );
        const mixedApply = await operation("apply-mixed");
        assert.match(
          mixedApply,
          /Result[\s\S]*Not recorded[\s\S]*1\s+change in the draft\s+→\s+1\s+saved/u,
          "only the failed draft loses its saved count",
        );
        for (const [id, count, more, incomplete] of [
          ["counts-only", 3, 3, true],
          ["sample-only", 3, 2, true],
          ["missing-samples", 0, 0, true],
          ["complete-empty", 0, 0, false],
        ] as const) {
          const outcome = await operation(id);
          assert.match(outcome, new RegExp(`\\b${count} not kept\\b`, "u"));
          if (more) assert.match(outcome, new RegExp(`and ${more} more`, "u"));
          else assert.doesNotMatch(outcome, /and \d+ more/u);
          assert.equal(outcome.includes("this breakdown is incomplete."), incomplete);
        }
        assert.doesNotMatch(
          await operation("noduration"),
          / ms|\d s\b/u,
          "an operation without a recorded duration must not display a fabricated one",
        );
        // Settings are whole labels; an unrecorded one reads "Not recorded" and a missing count is left out.
        const recordedSetting = (term: string) =>
          details.locator("dt", { hasText: term }).locator("xpath=following-sibling::dd[1]").innerText();
        assert.equal(await recordedSetting("Minimum relevance"), "Not recorded");
        assert.match(await details.innerText(), /3\s+usable in this chat/u);
        assert.doesNotMatch(await details.innerText(), /indexed/u);
        assert.equal(
          await details.locator("[data-ltm-debug-nothing-added]").count(),
          0,
          "malformed rows add no callout",
        );
        const missingOutcome = await details
          .getByRole("heading", { name: "Not kept", exact: true })
          .locator("..")
          .innerText();
        assert.match(missingOutcome.trim(), /^Not kept\s+Not recorded\s+Only the recorded candidate samples/u);
        assert.match(missingOutcome, /this breakdown is incomplete\./u);
        // The response snippet is never on screen; Copy JSON is the only raw-record path.
        assert.doesNotMatch(await activity.innerText(), /private response snippet/u);
        await operation("estimated");
        await details.getByRole("button", { name: /^Copy JSON/u }).click();
        const copied = await activityPage.evaluate(() => navigator.clipboard.readText());
        assert.match(copied, /private response snippet/u);
        assert.match(copied, /"operationId": "estimated"/u);
        assert.match(copied, /estimated-evidence_unit_response-ok/u);
        assert.doesNotMatch(await activity.innerText(), /private response snippet/u);
        // Chips filter whole operations: a partial import that ended ok but recorded
        // an error must not flip to "Failed" under Problems.
        await showEvents();
        await activity.locator('[data-ltm-debug-chip="problems"]').click();
        await activity.locator('[data-ltm-debug-operation="partial"]').waitFor();
        const partial = await operation("partial");
        assert.match(partial, /Completed with warnings/u);
        assert.match(partial, /One source failed\./u);
        // The active chip reads pressed with the pointer elsewhere.
        await showEvents();
        await activityPage.mouse.move(0, 0);
        const chipBackground = (chip: string) =>
          activity
            .locator(`[data-ltm-debug-chip="${chip}"]`)
            .evaluate((element) => getComputedStyle(element).backgroundColor);
        assert.notEqual(await chipBackground("problems"), await chipBackground("recall"));
        await showEvents();
        await activity.locator('[data-ltm-debug-chip="all"]').click();
        // Rows show the outcome rather than repeating their title.
        const rowText = async (id: string) => {
          await showEvents();
          return activity.locator(`[data-ltm-debug-operation="${id}"]`).innerText();
        };
        assert.match(await rowText("breakdown"), /7 of 12 kept/u);
        assert.match(await rowText("recall"), /1 added · 6 not added/u);
        assert.match(await rowText("apply"), /1 saved · 1 skipped/u);
        assert.doesNotMatch(
          await activity.locator("[data-ltm-debug-list]").innerText(),
          /(AI extraction|Memory recall|Deferred draft): Ok\./u,
        );
        assert.doesNotMatch(await operation("estimated"), /AI extraction: Ok\./u, "timeline steps do not repeat it");
        // The open event stays marked with the pointer elsewhere, also after returning to Events.
        await showEvents();
        await activity.locator('[data-ltm-debug-operation="recall"]').click();
        await showEvents();
        await activityPage.mouse.move(0, 0);
        const selectedRow = activity.locator('[data-ltm-debug-operation="recall"]');
        const rowStyle = (row: typeof selectedRow) =>
          row.evaluate((element) => {
            // Read the settled colors, not a mid-transition frame.
            for (const animation of element.getAnimations({ subtree: true })) animation.finish();
            return {
              background: getComputedStyle(element).backgroundColor,
              bar: getComputedStyle(element).boxShadow,
              title: getComputedStyle(element.querySelector(".font-semibold")!).color,
              summary: getComputedStyle(element.querySelector(".line-clamp-2")!).color,
            };
          });
        const selectedStyle = await rowStyle(selectedRow);
        const otherStyle = await rowStyle(activity.locator('[data-ltm-debug-operation="recall-desktop"]'));
        assert.notEqual(selectedStyle.background, otherStyle.background);
        assert.notEqual(selectedStyle.bar, otherStyle.bar, "the selected row carries an accent bar");
        assert.equal(selectedStyle.summary, selectedStyle.title, "muted row text meets contrast when selected");
        assert.ok(
          await activity.locator("[data-ltm-debug-list] .line-clamp-2").evaluateAll((spans) =>
            spans.every((span) => {
              const style = getComputedStyle(span);
              return span.getBoundingClientRect().height <= Number.parseFloat(style.lineHeight) * 2 + 1;
            }),
          ),
          "row summaries clamp to two lines",
        );
        // A hovered row reads like the selected one, wherever on the row the pointer is.
        await activity.locator('[data-ltm-debug-operation="recall-desktop"] .font-semibold').hover();
        const hoveredStyle = await rowStyle(activity.locator('[data-ltm-debug-operation="recall-desktop"]'));
        assert.equal(hoveredStyle.summary, hoveredStyle.title, "muted row text meets contrast when hovered");
        await activityPage.mouse.move(0, 0);
        // Search narrows whole operations and keeps the full event list of the match.
        await showEvents();
        const searchBox = activity.locator("[data-ltm-debug-search]");
        await searchBox.fill("fixture-model");
        await activity.locator('[data-ltm-debug-operation="estimated"]').waitFor();
        // The estimated row is on screen before the search, and the filter runs on a deferred value.
        await activity.locator('[data-ltm-debug-operation="reported"]').waitFor({ state: "detached" });
        assert.equal(await activity.locator('[data-ltm-debug-operation="reported"]').count(), 0);
        const searchedEstimated = await operation("estimated");
        assert.match(searchedEstimated, /AI extraction/u);
        assert.match(searchedEstimated, /500 ms/u);
        await showEvents();
        // #1588: clearing the search keeps focus in the search box.
        await activity.getByRole("button", { name: "Clear activity search" }).click();
        assert.deepEqual(
          await searchBox.evaluate((input) => [input === document.activeElement, (input as HTMLInputElement).value]),
          [true, ""],
          "clearing the activity search keeps focus in the empty search box",
        );
        // A recorded recall is an ordinary history row naming its source chat, and
        // its selected/rejected memory names read before the run parameters.
        const recall = await operation("recall");
        assert.match(recall, /Memory recall/u);
        assert.match(recall, /Recall from chat-artifact/u);
        assert.match(
          recall,
          /Result\s+4\s+indexed\s+→\s+3\s+usable in this chat\s+→\s+1\s+added[\s\S]*Added[\s\S]*Not added[\s\S]*Recall settings used/u,
        );
        assert.doesNotMatch(recall, /1 selected · 6 rejected/u, "recall counts appear once, under Result");
        assert.equal(await recordedSetting("Minimum relevance"), "50%");
        assert.equal(await recordedSetting("Memory limit"), "8");
        assert.equal(await recordedSetting("Token limit"), "2,048");
        assert.equal(await recordedSetting("Tokens used"), "42");
        assert.equal(await recordedSetting("Messages read"), "3");
        assert.equal(await recordedSetting("Ranking weights"), "Meaning match 0.6");
        assert.doesNotMatch(recall, /Limits:|chunks ·|Used:|Weights:|Run parameters|Relevance:/u);
        assert.doesNotMatch(recall, /No memory/u, "a recall that added a memory needs no explanation");
        // Candidates are flat rows: no filled box around each one.
        const candidateBackgrounds = await details
          .locator("[data-ltm-recalled-note]")
          .first()
          .evaluate((link) => getComputedStyle(link.closest("li")!).backgroundColor);
        assert.equal(candidateBackgrounds, "rgba(0, 0, 0, 0)");
        assert.match(recall, /Ranked below the 8-memory limit/u);
        for (const reason of [
          "Didn't fit the 2,048-token limit",
          "Duplicate text",
          "Below minimum relevance",
          "Memory text unavailable",
          "Prompt budget reached",
          "Kept back to leave room for other kinds of memory",
        ])
          assert.match(recall, new RegExp(reason, "u"));
        assert.match(recall, /Legacy global memory/u);
        assert.match(recall, /35%\s*·\s*Rank 1/u);
        assert.match(recall, /45%\s*·\s*Rank 2/u);
        // The nothing-added explanation names the limit that applied, or the generic fact without one.
        const rejectedRecall = await operation("recall-rejected");
        assert.match(rejectedRecall, /No memory was added to this reply\./u);
        assert.doesNotMatch(rejectedRecall, /minimum relevance\./u);
        assert.match(rejectedRecall, /What to try: If you expected a memory/u);
        const thresholdRecall = await operation("recall-rejected-threshold");
        assert.match(thresholdRecall, /No memory reached the 50% minimum relevance\./u);
        assert.match(thresholdRecall, /What to try: If you expected a memory/u);
        // The two paragraphs stack inside the flex callout rather than sitting side by side.
        const calloutBoxes = await details
          .locator("[data-ltm-debug-nothing-added] p")
          .evaluateAll((paragraphs) =>
            paragraphs.map((p) => p.getBoundingClientRect()).map(({ top, bottom }) => ({ top, bottom })),
          );
        assert.equal(calloutBoxes.length, 2);
        // soup/: the nothing-added callout offers the Recall settings handoff.
        assert.equal(
          await details
            .locator("[data-ltm-debug-nothing-added]")
            .first()
            .getByRole("button", { name: "Open Recall settings" })
            .count(),
          1,
        );
        assert.ok(calloutBoxes[1].top >= calloutBoxes[0].bottom - 1, "callout paragraphs are stacked");
        // Every row names how long ago its operation last logged an event.
        await showEvents();
        const rowTimes = await activity.locator("[data-ltm-debug-operation]").evaluateAll((rows) =>
          rows.map((row) => ({
            id: row.getAttribute("data-ltm-debug-operation"),
            datetime: row.querySelector("time")?.getAttribute("datetime"),
            text: row.querySelector("time")?.textContent?.trim(),
          })),
        );
        assert.ok(rowTimes.length > 0 && rowTimes.every((row) => row.datetime && /\bago$/u.test(row.text ?? "")));
        assert.equal(rowTimes.find((row) => row.id === "estimated")?.datetime, secondsAfter(75));
        await operation("recall");
        // M6: the recalled-memory link keeps a 44px touch target.
        const recalledBox = await activity.locator('[data-ltm-recalled-note="world_legacy_global"]').boundingBox();
        assert.ok(recalledBox && recalledBox.height >= 44, "recalled memory links keep a 44px touch target");
        // PR 4 (#1275): label/separator/health and honest export controls.
        assert.equal(
          await activity.getByRole("heading", { name: "Activity log", exact: true }).count(),
          1,
          "the log heading reads Activity log",
        );
        // soup/: a hover tooltip never swallows the next click; only the pinned panel takes pointer events.
        const activityInfo = activity.locator('[data-ltm-info="Activity log"]');
        await activityInfo.hover();
        const activityInfoPanel = activityPage.locator('[data-ltm-info-panel="Activity log"]');
        await activityInfoPanel.waitFor();
        assert.equal(await activityInfoPanel.evaluate((panel) => getComputedStyle(panel).pointerEvents), "none");
        await activityInfo.click();
        assert.notEqual(
          await activityPage
            .locator('[data-ltm-info-panel="Activity log"]')
            .evaluate((panel) => getComputedStyle(panel).pointerEvents),
          "none",
        );
        await activityPage.keyboard.press("Escape");
        await activityPage.locator('[data-ltm-info-panel="Activity log"]').waitFor({ state: "detached" });
        assert.equal(
          await activity.locator('[role="group"][aria-label="Log actions"]').count(),
          1,
          "the toolbar is named Log actions",
        );
        assert.match(
          await activity.locator("[data-ltm-debug-export-warning]").innerText(),
          /full Activity log[\s\S]*model output[\s\S]*before sharing[\s\S]*Filters and search do not limit the export/iu,
        );
        const healthText = await activity.locator("[data-ltm-debug-health]").innerText();
        assert.match(healthText, /\d+ events loaded/u);
        assert.doesNotMatch(healthText, /Log size/u);
        assert.match(healthText, /Index /u);
        assert.match(healthText, /Semantic search /u);
        // #1304: the source shows on the health line, and the "source changed" note follows
        // availability (the embedding space), not a label difference.
        const sourceChangedNote = activity.locator("[data-ltm-embedding-source-changed]");
        if (navigation === "desktop") {
          assert.match(healthText, /Semantic search unavailable · Renamed connection \(bge-m3\)/u);
          assert.equal(await sourceChangedNote.count(), 1, "unavailable vectors with equal labels show the note");
          assert.match(await sourceChangedNote.innerText(), /different embedding model or endpoint/u);
        } else {
          assert.match(healthText, /Semantic search available · Renamed connection \(bge-m3\)/u);
          assert.equal(await sourceChangedNote.count(), 0, "a renamed connection with usable vectors shows no note");
        }
        // D21: operation metadata composes with one spaced middle-dot separator.
        assert.match(reported, /Reasoning: 8 tokens · Output: 12 tokens[\s\S]*Total: 60 tokens/u);
        // D20: runtime count/weight names read as localized labels, not camelCase.
        assert.match(breakdown, /12 candidates · 7 units · 2 mutations/u);
        assert.doesNotMatch(breakdown, /totalCandidates|deduplications/u);
        assert.match(recall, /Tokens used\s+42/u);
        assert.doesNotMatch(recall, /42 used tokens/u, "the used-token count is not repeated under Details");
        assert.match(recall, /Ranking weights\s+Meaning match 0\.6/u);
        assert.doesNotMatch(recall, /Semantic weight/u);
        // D23: a completed operation's start step is Started/Succeeded, never Running.
        assert.match(estimated, /Started/u);
        assert.match(estimated, /Succeeded/u);
        assert.doesNotMatch(estimated, /Running/u);
        // D14: a warning status carries an icon and stronger weight.
        await operation("truncated");
        const warningStatus = details.locator('[data-ltm-debug-detail-status="completed_with_warnings"]');
        assert.equal((await warningStatus.locator("svg").count()) > 0, true, "warning status shows an icon");
        assert.match((await warningStatus.getAttribute("class")) ?? "", /items-center/u);
        assert.equal(
          await warningStatus.locator("span.font-semibold").count(),
          1,
          "warning status label is emphasized",
        );
        // D13: Copy JSON keeps its polite live-region confirmation and reset.
        await operation("estimated");
        await details.getByRole("button", { name: /^Copy JSON/u }).click();
        await activity.locator('[role="status"]', { hasText: "Copied" }).first().waitFor();
        // D07: export uses a timestamped fallback filename and announces success.
        const exportButton = activity.getByRole("button", { name: "Export full log" });
        const downloadPromise = activityPage.waitForEvent("download");
        await exportButton.click();
        await activityPage.waitForFunction(() => {
          const button = [...document.querySelectorAll("button")].find((candidate) =>
            candidate.textContent?.includes("Export full log"),
          );
          return button instanceof HTMLButtonElement && button.getAttribute("aria-disabled") === "true";
        });
        assert.equal(
          await activityPage.evaluate(() => document.activeElement?.textContent?.includes("Export full log") ?? false),
          true,
          "the export control keeps focus while the action is pending",
        );
        const download = await downloadPromise;
        assert.match(download.suggestedFilename(), /^ltm-debug-log-\d{4}/u);
        await toastWith(activityPage, "Full Activity log exported.").waitFor({ timeout: 5000 });
        // The result is the toast alone: nothing stays behind in the Activity view, and no live copy is mounted there.
        assert.equal(
          await activity.locator("[data-ltm-status]", { hasText: "Full Activity log exported." }).count(),
          0,
        );
        assert.equal(await activity.locator('[data-ltm-status][role="status"]').count(), 0);
        // D07: a failed export surfaces the server's JSON error text.
        debugExportError = true;
        await exportButton.click();
        await toastWith(activityPage, "Export fixture failed.").waitFor({ timeout: 5000 });
        assert.equal(
          await activityPage
            .locator('[data-sonner-toast][data-type="error"]')
            .filter({ hasText: "Export fixture failed." })
            .count(),
          1,
        );
        debugExportError = false;
        // D32: Clear confirms its all-chat scope and permanent, memory-safe behavior;
        // cancelling makes no DELETE request.
        const clearButton = activity.getByRole("button", { name: "Clear", exact: true });
        const clearDeletesBefore = debugClearDeletes;
        await activityPage.evaluate(() => {
          (window as unknown as { __ltmConfirmResult?: boolean }).__ltmConfirmResult = false;
          (window as unknown as { __ltmConfirmCalls?: number }).__ltmConfirmCalls = 0;
          (window as unknown as { __ltmLastConfirm?: string }).__ltmLastConfirm = undefined;
        });
        // #1275 repair: a same-turn double activation opens the host confirmation once;
        // the guard is acquired before the dialog is awaited.
        await activityPage.evaluate(() => {
          const button = [...document.querySelectorAll('[data-ltm-surface="activity"] button')].find(
            (candidate) => candidate.textContent?.trim() === "Clear",
          );
          if (button instanceof HTMLButtonElement) {
            button.click();
            button.click();
          }
        });
        await activityPage.waitForFunction(() =>
          Boolean((window as unknown as { __ltmLastConfirm?: string }).__ltmLastConfirm),
        );
        assert.equal(
          await activityPage.evaluate(
            () => (window as unknown as { __ltmConfirmCalls?: number }).__ltmConfirmCalls ?? 0,
          ),
          1,
          "a same-turn double Clear opens the confirmation once",
        );
        const clearConfirmation = await activityPage.evaluate(
          () => (window as unknown as { __ltmLastConfirm?: string }).__ltmLastConfirm ?? "",
        );
        assert.match(clearConfirmation, /for every chat/u);
        assert.match(clearConfirmation, /Memories and settings are not affected/u);
        assert.equal(debugClearDeletes, clearDeletesBefore, "cancelling Clear must not send a DELETE");
        await activityPage.evaluate(() => {
          (window as unknown as { __ltmConfirmResult?: boolean }).__ltmConfirmResult = true;
        });
        await clearButton.click();
        await toastWith(activityPage, "Activity log cleared.").waitFor({ timeout: 5000 });
        assert.equal(debugClearDeletes, clearDeletesBefore + 1);
        // D06: focus returns to the initiating control after the host confirmation.
        await activityPage.waitForFunction(() =>
          [...document.querySelectorAll("button")].some(
            (button) => button.textContent?.trim() === "Clear" && button === document.activeElement,
          ),
        );
        // Item 9 replaces the old D05 step: the record switch lives on the Activity page and saves on its own
        // (the full check is in the "Item 9" block), so Memory Settings has no recall-explanations control left.
        await activityPage.locator("[data-ltm-activity-record]").waitFor();
        await openActivityLog(activityPage);
        // D06 repair: a same-turn double Refresh must coalesce into one debug-log
        // request; the button guard reads React Query's rendered `isFetching`, which is
        // still false for a second activation in the same task.
        debugLogDelayMs = 200;
        const refreshRequestsBefore = debugLogRequests;
        await activityPage.evaluate(() => {
          const button = [...document.querySelectorAll('[data-ltm-surface="activity"] button')].find((candidate) =>
            /refresh/i.test(candidate.textContent ?? ""),
          );
          if (button instanceof HTMLButtonElement) {
            button.click();
            button.click();
          }
        });
        const refreshPending = (expectPending: boolean) => {
          const button = [...document.querySelectorAll('[data-ltm-surface="activity"] button')].find((candidate) =>
            /refresh/i.test(candidate.textContent ?? ""),
          );
          return (
            button instanceof HTMLButtonElement && Boolean(button.querySelector(".animate-spin")) === expectPending
          );
        };
        await activityPage.waitForFunction(refreshPending, true);
        await activityPage.waitForFunction(refreshPending, false);
        assert.equal(
          debugLogRequests,
          refreshRequestsBefore + 1,
          "a same-turn double Refresh coalesces into one debug-log request",
        );
        debugLogDelayMs = 0;
        if (navigation === "desktop") {
          // #1588: "Show up to 1,000 events" keeps the log and keeps focus while the longer
          // log loads, then hands focus to the log once the control is gone.
          debugLogPadding = 250;
          await reopenActivityLog(activityPage);
          const showMore = activity.locator("[data-ltm-activity-show-more]");
          await showMore.waitFor();
          let releaseDebugLog = () => {};
          debugLogGate = new Promise<void>((resolve) => {
            releaseDebugLog = resolve;
          });
          await showMore.focus();
          await activityPage.keyboard.press("Enter");
          await activityPage.waitForFunction(
            () => document.activeElement?.matches('[data-ltm-activity-show-more][aria-disabled="true"]') ?? false,
          );
          assert.equal(await activity.locator("[data-ltm-debug-list]").count(), 1, "the log stays while it grows");
          debugLogGate = null;
          releaseDebugLog();
          await showMore.waitFor({ state: "detached" });
          await activityPage.waitForFunction(
            () => document.activeElement?.matches('[data-ltm-surface="activity"] [data-ltm-debug-list]') ?? false,
          );
          debugLogPadding = 0;
          await reopenActivityLog(activityPage);
          await activity.locator('[data-ltm-debug-operation="estimated"]').waitFor();
        }
        // M2: a recall whose chat resolves through /scope-targets shows the chat label.
        const resolvedRecall = await operation("recall-desktop");
        assert.match(resolvedRecall, /Recall from Current Final Branch/u);
        assert.doesNotMatch(resolvedRecall, /desktop-chat/u);
        // M4: labelled Details facts (and the resolved source memory) render in the workbench.
        const estimatedFacts = await operation("estimated");
        assert.match(estimatedFacts, /Details[\s\S]*Source: Legacy global memory/u);
        assert.match(estimatedFacts, /Model: fixture-model/u);
        assert.match(estimatedFacts, /Duration: 500 ms/u);
        // M3: search also matches the displayed subject, which is not in any event text.
        await showEvents();
        await searchBox.fill("Current Final Branch");
        await activity.locator('[data-ltm-debug-operation="recall-desktop"]').waitFor();
        // The filter can apply a frame after the matching row appears; wait for the other row to leave.
        await activity.locator('[data-ltm-debug-operation="recall"]').first().waitFor({ state: "detached" });
        assert.equal(await activity.locator('[data-ltm-debug-operation="recall"]').count(), 0);
        await showEvents();
        await searchBox.fill("");
        assert.equal(
          await activityPage.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
          true,
        );
        if (navigation === "mobile") {
          // M5: selecting a row on a phone opens Details and moves focus to its tab,
          // leaving nothing focused on the now-hidden row; the switcher returns to Events.
          await showEvents();
          const focusRow = activity.locator('[data-ltm-debug-operation="estimated"]');
          await focusRow.focus();
          await focusRow.press("Enter");
          await details.waitFor();
          await activityPage.waitForFunction(
            () => document.activeElement?.getAttribute("data-ltm-workspace-pane-tab") === "workbench",
          );
          assert.match(await details.innerText(), /AI extraction/u);
          await activity.locator('[data-ltm-workspace-pane-tab="navigator"]').click();
        }
        return details;
      };
      // D31: the Vault memory link opens Debug filtered to that memory, with no server
      // correlation. The filter matches only explicit structured memory-id references.
      const assertMemoryFilteredDebug = async (debugPage: typeof page, navigation: "desktop" | "mobile") => {
        const activity = debugPage.locator('[data-ltm-surface="activity"]');
        const details = activity.locator("[data-ltm-debug-details]");
        const filterChip = activity.locator('[data-ltm-debug-memory-filter="world_legacy_global"]');
        const showEvents = async () => {
          const tab = activity.locator('[data-ltm-workspace-pane-tab="navigator"]');
          if (await tab.count()) await tab.click();
        };
        const openFromVault = async () => {
          await debugPage.locator(`[data-ltm-navigation="${navigation}"] [data-ltm-destination="vault"]`).click();
          await debugPage.locator('[data-ltm-surface="vault"]').waitFor();
          await debugPage.getByLabel("Search memories").fill("Legacy global memory");
          await debugPage
            .locator('[data-ltm-note-type="world"]')
            .filter({ hasText: /^Legacy global memory/u })
            .locator("button")
            .first()
            .click();
          // The link lives in the Vault inspector's collapsible Record info section.
          await debugPage.locator("[data-ltm-details-toggle]").click();
          await debugPage
            .locator("[data-ltm-record-info]")
            .first()
            .evaluate((element) => {
              (element as HTMLDetailsElement).open = true;
            });
          const openDebugLog = debugPage.getByRole("button", { name: "View activity" });
          const openDebugLogBox = await openDebugLog.boundingBox();
          assert.ok(openDebugLogBox && openDebugLogBox.height >= 44, "View activity keeps a 44px target");
          await openDebugLog.click();
          await activity.waitFor();
          await filterChip.waitFor();
          assert.equal(
            await debugPage
              .locator(`[data-ltm-navigation="${navigation}"] [data-ltm-destination="activity"]`)
              .getAttribute("aria-current"),
            "page",
            "View activity lands on the Activity page",
          );
        };

        // A previous Debug selection must not survive the memory handoff.
        await showEvents();
        await activity.locator('[data-ltm-debug-operation="estimated"]').click();
        await details.waitFor();
        await openFromVault();
        // Entry: nothing is selected, the filter names the memory, and the caveat is shown.
        assert.equal(await details.count(), 0, "the memory handoff selects no operation");
        assert.match(await filterChip.innerText(), /Legacy global memory/u);
        assert.match(await activity.innerText(), /Apply operations log change IDs, not memory IDs/u);
        // Matching extraction source, produced target, recall candidates, and a
        // single later event each pull their whole operation in.
        await activity.locator('[data-ltm-debug-operation="estimated"]').waitFor();
        await activity.locator('[data-ltm-debug-operation="target"]').waitFor();
        await activity.locator('[data-ltm-debug-operation="target"]').click();
        await details.waitFor();
        assert.match(await details.innerText(), /Result[\s\S]*Legacy global memory/u);
        await showEvents();
        await activity.locator('[data-ltm-debug-operation="recall"]').waitFor();
        await activity.locator('[data-ltm-debug-operation="recall-rejected"]').waitFor();
        await activity.locator('[data-ltm-debug-operation="late-reference"]').waitFor();
        // Chip counts describe the memory-filtered domain, not the whole loaded log.
        const listedOperations = await activity.locator("[data-ltm-debug-operation]").count();
        assert.match(
          await activity.locator('[data-ltm-debug-chip="all"]').innerText(),
          new RegExp(`All\\s+${listedOperations}`, "u"),
        );
        // An unrelated operation and an apply carrying only change ids are excluded.
        assert.equal(await activity.locator('[data-ltm-debug-operation="unrelated"]').count(), 0);
        assert.equal(await activity.locator('[data-ltm-debug-operation="apply"]').count(), 0);
        // A matching operation keeps its full event list and its status.
        await activity.locator('[data-ltm-debug-operation="estimated"]').click();
        await details.waitFor();
        const matched = await details.innerText();
        assert.match(matched, /AI extraction/u);
        assert.match(matched, /500 ms/u);
        // The recall rows match through their candidate ids, not a shared source note.
        await showEvents();
        await activity.locator('[data-ltm-debug-operation="recall-rejected"]').click();
        await details.waitFor();
        assert.match(await details.innerText(), /Legacy global memory/u);
        // late-reference matches through one later event and still shows every event.
        await showEvents();
        await activity.locator('[data-ltm-debug-operation="late-reference"]').click();
        await details.waitFor();
        assert.match(await details.innerText(), /Completed/u);
        assert.equal(await details.locator("ol > li").count(), 2, "a matched operation keeps all of its events");

        // Clearing the filter makes the other loaded operations available again.
        await showEvents();
        await filterChip.getByRole("button", { name: "Clear memory filter" }).click();
        await activity.locator('[data-ltm-debug-operation="unrelated"]').waitFor();
        assert.equal(await activity.locator("[data-ltm-debug-memory-filter]").count(), 0);

        // A cleared filter must not come back when the Debug tab is reopened.
        await reopenActivityLog(debugPage);
        await showEvents();
        assert.equal(await activity.locator("[data-ltm-debug-memory-filter]").count(), 0);
        await activity.locator('[data-ltm-debug-operation="unrelated"]').waitFor();

        // Re-open from the Vault link and compose with the chips and search.
        await openFromVault();
        await showEvents();
        await activity.locator('[data-ltm-debug-chip="recall"]').click();
        await activity.locator('[data-ltm-debug-operation="recall"]').waitFor();
        await activity.locator('[data-ltm-debug-operation="recall-rejected"]').waitFor();
        assert.equal(await activity.locator('[data-ltm-debug-operation="estimated"]').count(), 0);
        assert.equal(await activity.locator('[data-ltm-debug-operation="target"]').count(), 0);
        await activity.locator('[data-ltm-debug-chip="all"]').click();
        // Typing filters on the deferred value: right after the input event the box shows the new text and the
        // rows are still the unfiltered ones, then the filtered rows replace them.
        const unfilteredRows = await activity.locator("[data-ltm-debug-operation]").count();
        assert.ok(unfilteredRows > 1, "the unfiltered log has several operations");
        const typed = await activity.page().evaluate(() => {
          const input = document.querySelector<HTMLInputElement>("[data-ltm-debug-search]")!;
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "fixture-model");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return {
            value: input.value,
            rows: document.querySelectorAll("[data-ltm-debug-operation]").length,
          };
        });
        assert.deepEqual(typed, { value: "fixture-model", rows: unfilteredRows }, "rows lag the typed text");
        await activity.locator('[data-ltm-debug-operation="estimated"]').waitFor();
        await activity
          .page()
          .waitForFunction(
            (count) => document.querySelectorAll("[data-ltm-debug-operation]").length < count,
            unfilteredRows,
          );
        assert.equal(await activity.locator('[data-ltm-debug-operation="target"]').count(), 0);
        // No-match: an empty result names the memory coverage, not a plain miss.
        await activity.locator("[data-ltm-debug-search]").fill("no-such-operation");
        await activity
          .getByText("No matching operations in the loaded debug log. This does not mean the memory never changed.")
          .waitFor();
        await activity.locator("[data-ltm-debug-search]").fill("");

        if (navigation === "mobile") {
          // The link lands on Events; selecting a row opens Details; the switcher returns.
          await showEvents();
          assert.equal(await details.count(), 0);
          await activity.locator('[data-ltm-debug-operation="estimated"]').click();
          await details.waitFor();
          assert.match(await details.innerText(), /AI extraction/u);
          await activity.locator('[data-ltm-workspace-pane-tab="navigator"]').click();
        }

        // Leave the remaining Debug flow unfiltered.
        await showEvents();
        await filterChip.getByRole("button", { name: "Clear memory filter" }).click();

        // An empty retained log still names the memory coverage, not "no activity".
        debugLogEmpty = true;
        await openFromVault();
        await activity
          .getByText("No matching operations in the loaded debug log. This does not mean the memory never changed.")
          .waitFor();
        debugLogEmpty = false;
        // Restore the real log for the remaining Debug flow.
        await reopenActivityLog(debugPage);
        await activity.locator('[data-ltm-debug-operation="estimated"]').waitFor();
      };
      const openDebugActivity = async (context: typeof browserContext, navigation: "desktop" | "mobile") => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"], {
          origin: `http://127.0.0.1:${address.port}`,
        });
        const debugPage = await context.newPage();
        await debugPage.route("**/api/long-term-memory/status*", async (route) => {
          // #1304: desktop keeps two equal labels over unavailable vectors (a switched
          // sidecar model); mobile shows differing labels over available vectors (a renamed connection).
          const response = await route.fetch();
          const status = await response.json();
          const renamed = navigation === "mobile";
          await route.fulfill({
            response,
            json: {
              ...status,
              indexes: {
                ...status.indexes,
                embeddingsAvailable: renamed,
                embeddingSource: "Renamed connection (bge-m3)",
                indexedEmbeddingSource: renamed ? "Old name (bge-m3)" : "Renamed connection (bge-m3)",
              },
            },
          });
        });
        await debugPage.route("**/api/long-term-memory/drafts/review?*", async (route) => {
          const response = await route.fetch();
          const review = { ...(await response.json()), sources: structuredClone(debugReviewSources) };
          for (const source of review.sources)
            if (source.sourceNoteId === "source_mobile_review")
              for (const item of source.drafts) item.draft.status = debugReviewPending ? "pending" : "accepted";
          await route.fulfill({ response, json: review });
        });
        await debugPage.route("**/api/long-term-memory/debug-log?*", async (route) => {
          // The header reading chip polls the extraction phase every 4s; it is not an Activity request.
          if (new URL(route.request().url()).searchParams.has("phase")) return route.fulfill({ json: { events: [] } });
          debugLogRequests += 1;
          // A delay keeps the first request in flight so a same-turn second activation is observable.
          if (debugLogDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, debugLogDelayMs));
          if (debugLogGate) await debugLogGate;
          if (debugLogError) {
            route.fulfill({ status: 500, json: { error: "Activity fixture failed." } });
            return;
          }
          if (debugLogEmpty) {
            route.fulfill({ json: { events: [] } });
            return;
          }
          const query = new URL(route.request().url()).searchParams;
          const matches = (value: unknown, expected: string | null) => !expected || value === expected;
          const filtered = debugEvents.filter((event) => {
            const record = event as Record<string, unknown>;
            return (
              matches(record.operationId, query.get("operationId")) &&
              matches(record.sourceNoteId, query.get("sourceNoteId")) &&
              matches(record.draftId, query.get("draftId")) &&
              matches(record.status, query.get("status")) &&
              matches(record.phase, query.get("phase"))
            );
          });
          const padding = Array.from({ length: debugLogPadding }, (_, index) =>
            debugEvent(`padding-${index}`, "extract_source_note", "ok"),
          );
          const events = [...padding, ...filtered];
          const limit = Number(query.get("limit") ?? 0);
          route.fulfill({ json: { events: limit > 0 ? events.slice(-limit) : events } });
        });
        await debugPage.route("**/api/long-term-memory/debug-log/export", async (route) => {
          // A small delay lets the test observe the pending/disabled guard.
          await new Promise((resolve) => setTimeout(resolve, 120));
          if (debugExportError) {
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({ error: "Export fixture failed." }),
            });
            return;
          }
          await route.fulfill({ contentType: "application/x-ndjson", body: '{"id":"fixture"}\n' });
        });
        await debugPage.route("**/api/long-term-memory/debug-log", async (route) => {
          if (route.request().method() === "DELETE") {
            debugClearDeletes += 1;
            await route.fulfill({ json: { ok: true } });
            return;
          }
          await route.continue();
        });
        await debugPage.goto(`http://127.0.0.1:${address.port}/`);
        await debugPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        // String form keeps the inline confirmAction out of the tsx/esbuild `__name`
        // transform, which is unavailable inside the page.
        await debugPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          // Exercise the host confirmation flow rather than a native dialog, so
          // cancel/confirm outcomes and focus restoration are observable.
          element.capabilityProps = {
            confirmAction: (options) => {
              window.__ltmLastConfirm = options.message;
              window.__ltmConfirmCalls = (window.__ltmConfirmCalls ?? 0) + 1;
              return window.__ltmConfirmResult ?? true;
            },
          };
          document.body.append(element);
        })()`);
        await debugPage.locator(`[data-ltm-navigation="${navigation}"] [data-ltm-destination="settings"]`).click();
        // The detail view mounts the Vault first, which pages all notes; count
        // note queries only from the settings navigation on, so this measures
        // the Debug tab's own title lookup.
        const noteQueryStart = noteQueries.length;
        const notesByIdsResponse = debugPage.waitForResponse((response) =>
          new URL(response.url()).searchParams.has("ids"),
        );
        await assertDebugActivity(debugPage, navigation);
        await notesByIdsResponse;
        // Start at the Debug tab's own ids lookup so a Vault page that is still
        // in flight cannot be read as Debug paging the whole vault.
        const idsIndex = noteQueries.slice(noteQueryStart).findIndex((query) => query.includes("ids="));
        assert.ok(idsIndex >= 0, "Debug resolves memory titles by id");
        assert.equal(
          noteQueries.slice(noteQueryStart + idsIndex).some((query) => query.includes("limit=500")),
          false,
          "Debug does not page the whole vault for titles",
        );
        await assertMemoryFilteredDebug(debugPage, navigation);
        return debugPage;
      };
      const desktopDebugPage = await openDebugActivity(browserContext, "desktop");
      // D31-adjacent handoff: a resolved recall-memory name opens its Vault memory.
      await desktopDebugPage.locator('[data-ltm-debug-operation="recall"]').click();
      await desktopDebugPage.locator('[data-ltm-recalled-note="world_legacy_global"]').click();
      await desktopDebugPage.locator('[data-ltm-surface="vault"]').waitFor();
      await desktopDebugPage.close();
      // A Vault group renders at most 100 rows until Show more. Its count, the shown total and
      // search still cover every memory in the place.
      {
        const capPage = await browserContext.newPage();
        const capNotes = Array.from({ length: 250 }, (_, index) => {
          const number = String(index).padStart(3, "0");
          const timestamp = new Date(Date.UTC(2026, 6, 30) - index * 60_000).toISOString();
          return {
            id: `world_cap_${number}`,
            title: `Capped memory ${number}`,
            type: "world",
            status: "active",
            modes: ["roleplay"],
            scope: {},
            tags: [],
            keywords: [],
            links: [],
            sections: {
              facts: {
                text: index === 230 ? "The lighthouse keeper hid the ledger." : `Capped memory ${number} text.`,
                updatedAt: timestamp,
              },
            },
            createdAt: timestamp,
            updatedAt: timestamp,
            version: 1,
          };
        });
        await capPage.route(
          (url) => url.pathname.endsWith("/api/long-term-memory/notes"),
          (route) =>
            route.request().method() === "GET" && !new URL(route.request().url()).searchParams.has("ids")
              ? route.fulfill({ json: capNotes })
              : route.continue(),
        );
        await capPage.goto(`http://127.0.0.1:${address.port}/`);
        await capPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await capPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await capPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
        const capGroupSummary = capPage.locator('[data-ltm-memory-group="world"] > summary');
        const capRows = capPage.locator('[data-ltm-memory-group="world"] [data-ltm-note-type]');
        // soup/vault-first-open: the first group opens itself, so the list is never a column of closed headings.
        await capPage.locator('[data-ltm-memory-group="world"][open]').waitFor();
        await capRows.first().waitFor();
        await capPage.getByText("250 shown").waitFor();
        assert.match(await capGroupSummary.innerText(), /250/u, "the group counts every memory");
        assert.equal(await capRows.count(), 100, "a group renders 100 rows before Show more");
        await capPage.getByRole("button", { name: "Show 100 more" }).press("Enter");
        await capPage.waitForFunction(
          () => document.activeElement?.textContent?.includes("Capped memory 100") ?? false,
          undefined,
          { timeout: 2000 },
        );
        assert.equal(await capRows.count(), 200, "Show more adds the next 100 rows");
        assert.match(
          await capPage.evaluate(() => document.activeElement?.textContent ?? ""),
          /Capped memory 100/u,
          "Show more moves focus to the first row it added",
        );
        assert.equal(await capPage.getByRole("button", { name: "Show 50 more" }).count(), 1);
        const capSearch = capPage.getByLabel("Search memories", { exact: true });
        await capSearch.fill("lighthouse");
        await capRows.filter({ hasText: "Capped memory 230" }).waitFor({ timeout: 5000 });
        assert.equal(await capRows.count(), 1, "search covers memories beyond the cap");
        await capSearch.fill("");
        await capPage.getByText("250 shown").waitFor();
        assert.equal(await capRows.count(), 100, "a new search starts again at 100 rows");
        // Select visible covers every memory in the place, not only the rendered rows.
        await capPage.locator("[data-ltm-select-mode]").click();
        await capPage.getByLabel("Select visible", { exact: true }).check();
        await capPage.locator("[data-ltm-selection-count]").filter({ hasText: "250 selected" }).waitFor();
        await capPage.close();
      }
      // soup/vault-graph: the Vault's List / Graph switch, Focus-first canvas, one filter row and "Link to …".
      {
        const graphPage = await browserContext.newPage();
        const stamp = "2026-07-30T00:00:00.000Z";
        const graphNote = (
          id: string,
          title: string,
          type: string,
          extra: Record<string, unknown> = {},
          importance = "major",
        ) => ({
          id,
          title,
          type,
          status: "active",
          modes: ["roleplay"],
          scope: {},
          tags: [],
          keywords: [],
          links: [],
          sections: { facts: { text: `${title} text.`, importance, updatedAt: stamp } },
          createdAt: stamp,
          updatedAt: stamp,
          version: 1,
          ...extra,
        });
        const graphNotes: Array<ReturnType<typeof graphNote>> = [
          graphNote("graph_mira", "Mira Vale", "character", {
            subjects: [{ key: "mira", ref: { kind: "local_character", id: "Mira" } }],
          }),
          graphNote("graph_kael", "Kael Ross", "character", {
            subjects: [{ key: "kael", ref: { kind: "local_character", id: "Kael" } }],
          }),
          graphNote("graph_pair", "Mira and Kael", "relationship", {
            subjects: [
              { key: "mira", ref: { kind: "local_character", id: "Mira" } },
              { key: "kael", ref: { kind: "local_character", id: "Kael" } },
            ],
          }),
          // The same two people in the other order: the card lists them in subject order.
          graphNote("graph_pair_again", "Kael and Mira", "relationship", {
            subjects: [
              { key: "kael", ref: { kind: "local_character", id: "Kael" } },
              { key: "mira", ref: { kind: "local_character", id: "Mira" } },
            ],
          }),
          graphNote("graph_thread", "Find the ledger", "thread", {
            links: [{ target: "graph_mira", relation: "involves" }],
          }),
          graphNote(
            "graph_event",
            "Ledger stolen",
            "timeline_event",
            { links: [{ target: "graph_thread", relation: "caused_by" }] },
            "minor",
          ),
          graphNote("graph_lone", "Lone lighthouse", "world"),
        ];
        const linkPatches: Array<{ id: string; links: Array<{ target: string; relation: string }> }> = [];
        await graphPage.route(
          (url) => /\/api\/long-term-memory\/notes\/[^/]+$/u.test(url.pathname),
          (route) => {
            if (route.request().method() !== "PATCH") return route.continue();
            const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop()!);
            const body = route.request().postDataJSON() as { links: Array<{ target: string; relation: string }> };
            const note = graphNotes.find((candidate) => candidate.id === id)!;
            note.links = body.links as never;
            note.version += 1;
            linkPatches.push({ id, links: body.links });
            return route.fulfill({ json: { note } });
          },
        );
        await graphPage.route(
          (url) => url.pathname.endsWith("/api/long-term-memory/notes"),
          (route) =>
            route.request().method() === "GET" && !new URL(route.request().url()).searchParams.has("ids")
              ? route.fulfill({ json: graphNotes })
              : route.continue(),
        );
        await graphPage.goto(`http://127.0.0.1:${address.port}/`);
        await graphPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await graphPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await graphPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
        await graphPage.getByText("7 shown").waitFor();
        const node = (id: string) => graphPage.locator(`[data-ltm-graph-node="${id}"]`);
        const nodeCount = () => graphPage.locator("[data-ltm-graph-node]").count();
        // The card floats over the canvas's bottom right: close it before a click that could land under it.
        const closeCard = async () => {
          const close = graphPage.locator("[data-ltm-graph-card-close]");
          if (await close.count()) await close.click();
        };
        // By note id: another row can mention the title (a linked memory's row names what it links to).
        const openRow = async (id: string, title: string) => {
          const search = graphPage.getByLabel("Search memories", { exact: true });
          await search.fill(title);
          await graphPage.locator(`[data-ltm-note-id="${id}"] button`).first().click();
          // Opening a memory can restore the Vault's saved search a moment later; clear until it stays clear.
          for (let tries = 0; tries < 10; tries += 1) {
            await search.fill("");
            await graphPage.waitForTimeout(200);
            if ((await search.inputValue()) === "") break;
          }
        };
        // The switch is in the Vault header; the Graph opens on the open memory and its links, not the whole Vault.
        await openRow("graph_thread", "Find the ledger");
        await graphPage.locator("[data-ltm-vault-view-graph]").click();
        await node("graph_thread").waitFor();
        assert.equal(await graphPage.locator("[data-ltm-vault-view-graph]").getAttribute("aria-pressed"), "true");
        // One Vault header in Graph view too: the title, the count, the switch and the search share its row.
        const vaultHeader = graphPage.locator("[data-ltm-vault-header]");
        const headerHeading = vaultHeader.getByRole("heading", { name: "Memory Vault" });
        await headerHeading.waitFor();
        await vaultHeader.getByText("7 shown").waitFor();
        await vaultHeader.getByLabel("Search memories", { exact: true }).waitFor();
        // A self-calling string, not a callback: tsx wraps a callback's named helpers in `__name`, which the page lacks.
        const headerRow = await graphPage.evaluate(`(() => {
          const header = document.querySelector("[data-ltm-vault-header]");
          const box = (selector) => header.querySelector(selector).getBoundingClientRect();
          const heading = box("h2");
          const switchBox = box("[data-ltm-vault-view-switch]");
          const search = box("input");
          const centre = (rect) => rect.top + rect.height / 2;
          return {
            switchInRow: centre(switchBox) >= heading.top && centre(switchBox) <= heading.bottom + 16,
            searchInRow: centre(search) >= heading.top && centre(search) <= heading.bottom + 16,
            switchLeftOfSearch: switchBox.right <= search.left + 1,
          };
        })()`);
        assert.deepEqual(headerRow, { switchInRow: true, searchInRow: true, switchLeftOfSearch: true }, "header row");
        assert.match(await graphPage.locator("[data-ltm-graph-banner]").innerText(), /Linked to\s+Find the ledger/u);
        assert.equal(await nodeCount(), 3, "Focus shows the open memory and what it links to, nothing else");
        assert.equal(await node("graph_lone").count(), 0);
        assert.equal(await graphPage.locator('[data-ltm-graph-whole][aria-pressed="false"]').count(), 1);
        // The focus banner floats on the canvas and carries a "Show everything" chip.
        assert.equal(
          await graphPage.evaluate(
            () =>
              !!document.querySelector(
                "[data-ltm-graph-canvas] [data-ltm-graph-banner] [data-ltm-graph-show-everything]",
              ),
          ),
          true,
          "the focus banner sits on the canvas with Show everything",
        );
        // The family chips show their counts: People has Mira Vale, Kael Ross and the two relationships.
        assert.match(await graphPage.locator('[data-ltm-graph-family="people"]').innerText(), /People\s*4/u);
        // Back to the List keeps the open memory; the Graph keeps Focus on it.
        await graphPage.locator("[data-ltm-vault-view-list]").click();
        assert.equal(await graphPage.locator("[data-ltm-field='title']").inputValue(), "Find the ledger");
        await graphPage.locator("[data-ltm-vault-view-graph]").click();
        assert.match(await graphPage.locator("[data-ltm-graph-banner]").innerText(), /Find the ledger/u);
        // Whole Vault shows every memory; "Show everything" on the banner does the same.
        await graphPage.locator("[data-ltm-graph-show-everything]").click();
        await graphPage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length === 7);
        assert.equal(await graphPage.locator("[data-ltm-graph-banner]").count(), 0, "the banner goes with Focus");
        assert.equal(await graphPage.locator('[data-ltm-graph-whole][aria-pressed="true"]').count(), 1);
        // The header search narrows the Graph, not only the List.
        await vaultHeader.getByLabel("Search memories", { exact: true }).fill("Find the ledger");
        await graphPage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length < 7);
        await vaultHeader.getByLabel("Search memories", { exact: true }).fill("");
        await graphPage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length === 7);
        // A family chip hides its memories and so their links.
        assert.equal(await graphPage.locator('[data-ltm-graph-edge="caused_by"]').count(), 1);
        // At rest, before any click: a pressed chip (Story) and an unpressed one (Archived) differ, and both are chip-sized.
        const chipLook = (selector: string) =>
          graphPage
            .locator(selector)
            .evaluate((chip) => ({ background: getComputedStyle(chip).backgroundColor, height: chip.clientHeight }));
        const onLook = await chipLook('[data-ltm-graph-family="story"]');
        const offLook = await chipLook("[data-ltm-graph-archived]");
        assert.ok(onLook.height < 40, `filter chips are chip-sized, got ${onLook.height}px`);
        assert.notEqual(onLook.background, offLook.background);
        await graphPage.locator('[data-ltm-graph-family="story"]').click();
        assert.equal(await node("graph_event").count(), 0);
        assert.equal(await graphPage.locator('[data-ltm-graph-edge="caused_by"]').count(), 0);
        await graphPage.locator('[data-ltm-graph-family="story"]').click();
        await node("graph_event").waitFor();
        // Hide minor hides the minor memory.
        await graphPage.getByRole("button", { name: "Hide minor", exact: true }).click();
        assert.equal(await node("graph_event").count(), 0);
        await graphPage.getByRole("button", { name: "All", exact: true }).click();
        await node("graph_event").waitFor();
        // With no chat open, Recalled is off and says why.
        assert.equal(await graphPage.locator("[data-ltm-graph-recalled]").isDisabled(), true);
        assert.equal(
          await graphPage.locator("[data-ltm-graph-recalled]").getAttribute("title"),
          "Open a chat to see what was used",
        );
        // An unlinked focused memory says so and offers the editor's Linked memories.
        await node("graph_lone").locator("circle").first().click();
        await graphPage.locator("[data-ltm-graph-focus-here]").click();
        assert.match(await graphPage.locator("[data-ltm-graph-empty]").innerText(), /No links yet/u);
        await graphPage.locator("[data-ltm-graph-whole]").click();
        await closeCard();
        // A relationship is drawn to the people its subjects name with no stored link: no button, nothing saved.
        await node("graph_pair").locator("circle").first().click();
        await graphPage.locator("[data-ltm-graph-focus-here]").click();
        await graphPage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length === 3);
        await node("graph_mira").waitFor();
        await node("graph_kael").waitFor();
        assert.equal(await graphPage.locator("[data-ltm-graph-link-subjects], [data-ltm-link-subjects]").count(), 0);
        assert.equal(linkPatches.length, 0, "the people's lines are drawn, not saved");
        // The keyboard reaches nodes and opens their card: Tab stop, arrows, Enter, Esc.
        await graphPage.locator('[data-ltm-graph-node][tabindex="0"]').focus();
        const focusedNode = () =>
          graphPage.evaluate(() => document.activeElement?.getAttribute("data-ltm-graph-node") ?? "");
        const first = await focusedNode();
        assert.ok(first, "the canvas has one Tab stop");
        let moved = "";
        for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]) {
          await graphPage.keyboard.press(key);
          moved = await focusedNode();
          if (moved && moved !== first) break;
        }
        assert.ok(moved && moved !== first, "an arrow key moves to another memory");
        await graphPage.keyboard.press("Enter");
        await graphPage.locator("[data-ltm-graph-card]").waitFor();
        await graphPage.keyboard.press("Escape");
        await graphPage.locator("[data-ltm-graph-card]").waitFor({ state: "detached" });
        await graphPage.waitForFunction(
          (id) => document.activeElement?.getAttribute("data-ltm-graph-node") === id,
          moved,
        );
        // Open in editor returns to the List with that memory open; the Graph then follows it.
        await graphPage.keyboard.press("Enter");
        const openedTitle = await graphPage.locator("[data-ltm-graph-card] h3").innerText();
        await graphPage.locator("[data-ltm-graph-open-editor]").click();
        await graphPage.locator("[data-ltm-field='title']").waitFor();
        assert.equal(await graphPage.locator("[data-ltm-field='title']").inputValue(), openedTitle);
        await graphPage.locator("[data-ltm-vault-view-graph]").click();
        await graphPage.locator("[data-ltm-graph-banner]").waitFor();
        // soup/vault-graph-card: the card lists links the way the editor does; Focus here and a double-click narrow
        // to two hops; a relationship's card lists its people.
        const whole = graphPage.locator("[data-ltm-graph-whole]");
        if ((await whole.getAttribute("aria-pressed")) !== "true") await whole.click();
        const card = graphPage.locator("[data-ltm-graph-card]");
        await node("graph_thread").locator("circle").first().click();
        await card.waitFor();
        const cardText = await card.innerText();
        assert.match(cardText, /Linked memories\s+2/u);
        assert.match(cardText, /Involves\s+Mira Vale/u);
        assert.match(cardText, /Caused by\s+Ledger stolen/u);
        // The card lies inside the canvas (it floats over it), and its title takes focus (not the container).
        assert.equal(
          await graphPage.evaluate(() => {
            const pane = document.querySelector("[data-ltm-graph-canvas]")!.getBoundingClientRect();
            const box = document.querySelector("[data-ltm-graph-card]")!.getBoundingClientRect();
            return (
              box.left >= pane.left - 1 &&
              box.right <= pane.right + 1 &&
              box.top >= pane.top - 1 &&
              box.bottom <= pane.bottom + 1
            );
          }),
          true,
          "the card sits inside the canvas",
        );
        assert.equal(await graphPage.evaluate(() => document.activeElement?.tagName), "H3");
        // A linked memory the canvas shows becomes the card, and the selection ring follows it.
        await card.getByRole("button", { name: /Ledger stolen/u }).click();
        await card.getByRole("heading", { name: "Ledger stolen" }).waitFor();
        assert.equal(await node("graph_event").locator("[data-ltm-graph-selected-ring]").count(), 1);
        // ...and is centred on the canvas.
        await graphPage.waitForFunction(() => {
          const pane = document.querySelector("[data-ltm-graph-canvas]")!.getBoundingClientRect();
          const box = document.querySelector('[data-ltm-graph-node="graph_event"]')!.getBoundingClientRect();
          return (
            Math.abs(box.left + box.width / 2 - (pane.left + pane.width / 2)) < 12 &&
            Math.abs(box.top + box.height / 2 - (pane.top + pane.height / 2)) < 12
          );
        });
        // Focus here: two hops from that memory (its background link to a character stays out past the first hop).
        await card.locator("[data-ltm-graph-focus-here]").click();
        await graphPage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length === 2);
        assert.equal(await node("graph_mira").count(), 0);
        // Double-clicking a node does the same.
        await closeCard();
        await node("graph_thread").locator("circle").first().dblclick();
        await graphPage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length === 3);
        assert.match(await graphPage.locator("[data-ltm-graph-banner]").innerText(), /Find the ledger/u);
        // The card lists a relationship's people from its subjects, with no button to link them.
        await whole.click();
        await closeCard();
        await node("graph_pair_again").locator("circle").first().click();
        await card.getByRole("heading", { name: "Kael and Mira" }).waitFor();
        assert.match(await card.innerText(), /Involves\s+Kael Ross[\s\S]*Involves\s+Mira Vale/u);
        assert.equal(await card.locator("[data-ltm-link-subjects]").count(), 0);
        assert.equal(linkPatches.length, 0);
        await graphPage.close();
      }
      // soup/vault-graph-recalled: the Recalled chip rings the memories the last reply in this chat used, from the
      // same data as the "last injection" panel, and rings nothing when the last attempt failed.
      {
        const stamp = "2026-07-30T00:00:00.000Z";
        const recalledNote = (id: string, title: string, type: string, links: unknown[] = []) => ({
          id,
          title,
          type,
          status: "active",
          modes: ["roleplay"],
          scope: {},
          tags: [],
          keywords: [],
          links,
          sections: { facts: { text: `${title} text.`, importance: "major", updatedAt: stamp } },
          createdAt: stamp,
          updatedAt: stamp,
          version: 1,
        });
        const recalledNotes = [
          recalledNote("rec_thread", "Find the ledger", "thread", [{ target: "rec_mira", relation: "involves" }]),
          recalledNote("rec_mira", "Mira Vale", "character"),
          recalledNote("rec_world", "Lone lighthouse", "world"),
        ];
        let recalledAttempt: Record<string, unknown> = {
          version: 1,
          chatId: "chat-artifact",
          attemptId: "00000000-0000-4000-8000-000000000004",
          at: stamp,
          outcome: "completed",
          debugEnabled: false,
          confirmed: true,
        };
        // Both pages read the attempt when the request arrives, so the second one sees the failure.
        const openRecalledGraph = async () => {
          const recalledPage = await browserContext.newPage();
          await recalledPage.route(
            (url) => url.pathname.endsWith("/api/long-term-memory/notes"),
            (route) =>
              route.request().method() === "GET" && !new URL(route.request().url()).searchParams.has("ids")
                ? route.fulfill({ json: recalledNotes })
                : route.continue(),
          );
          await recalledPage.route(
            (url) => url.pathname.includes("/api/long-term-memory/last-injection/"),
            (route) =>
              route.fulfill({
                json: {
                  memoryCount: 2,
                  tokenCount: 40,
                  memories: [
                    { noteId: "rec_thread", title: "Find the ledger", tokenCount: 20 },
                    { noteId: "rec_world", title: "Lone lighthouse", tokenCount: 20 },
                  ],
                  state: "injected",
                  dispatchedAt: stamp,
                  attempt: recalledAttempt,
                },
              }),
          );
          await recalledPage.goto(`http://127.0.0.1:${address.port}/`);
          await recalledPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
          await recalledPage.evaluate(`(() => {
            const element = document.createElement("marinara-capability-long-term-memory");
            element.setAttribute("view", "detail");
            element.capabilityProps = { chatId: "chat-artifact", confirmAction: () => true };
            document.body.append(element);
          })()`);
          await recalledPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
          await recalledPage.getByText("3 shown").waitFor();
          await recalledPage.locator("[data-ltm-vault-view-graph]").click();
          await recalledPage.locator("[data-ltm-graph-whole]").click();
          await recalledPage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length === 3);
          await recalledPage.waitForFunction(
            () => document.querySelector("[data-ltm-graph-recalled]")?.getAttribute("aria-disabled") !== "true",
          );
          return recalledPage;
        };
        const recalledPage = await openRecalledGraph();
        const recalledChip = recalledPage.locator("[data-ltm-graph-recalled]");
        const used = recalledPage.locator("[data-ltm-graph-used]");
        assert.equal(
          await recalledPage.getByRole("button", { name: "Used in the last reply", exact: true }).count(),
          1,
          "the chip is named Used in the last reply",
        );
        assert.equal(await recalledChip.getAttribute("aria-pressed"), "false");
        assert.equal(await used.count(), 0, "nothing is ringed until Recalled is on");
        await recalledChip.click();
        assert.equal(await recalledChip.getAttribute("aria-pressed"), "true");
        assert.deepEqual(
          await used.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-ltm-graph-node")).sort()),
          ["rec_thread", "rec_world"],
        );
        assert.equal(await recalledPage.locator("[data-ltm-graph-recalled-ring]").count(), 2);
        await recalledPage.getByText("Used in the last reply: 2 in view").waitFor();
        await recalledChip.click();
        assert.equal(await used.count(), 0);
        await recalledPage.close();
        // A failed last attempt overrides the receipt: the panel says "used nothing", so nothing is ringed.
        recalledAttempt = { ...recalledAttempt, outcome: "failed", confirmed: false };
        const failedPage = await openRecalledGraph();
        await failedPage.locator("[data-ltm-graph-recalled]").click();
        assert.equal(await failedPage.locator("[data-ltm-graph-used]").count(), 0);
        await failedPage.close();
      }
      // soup/vault-graph-card (long link lists): the card shows six link rows and then "N more", a row moves the
      // selection, the card stays inside the canvas at 1440 and 390, and "N more" opens the editor.
      {
        const stamp = "2026-07-30T00:00:00.000Z";
        const moreNote = (id: string, title: string, type: string, links: unknown[] = []) => ({
          id,
          title,
          type,
          status: "active",
          modes: ["roleplay"],
          scope: {},
          tags: [],
          keywords: [],
          links,
          sections: { facts: { text: `${title} text.`, importance: "major", updatedAt: stamp } },
          createdAt: stamp,
          updatedAt: stamp,
          version: 1,
        });
        const people = Array.from({ length: 7 }, (_, index) =>
          moreNote(`more_c${index}`, `Person ${index}`, "character"),
        );
        const moreNotes = [
          ...people,
          moreNote(
            "more_hub",
            "Harbour hub",
            "world",
            people.map((person) => ({ target: person.id, relation: "involves" })),
          ),
        ];
        const morePage = await browserContext.newPage();
        await morePage.route(
          (url) => url.pathname.endsWith("/api/long-term-memory/notes"),
          (route) =>
            route.request().method() === "GET" && !new URL(route.request().url()).searchParams.has("ids")
              ? route.fulfill({ json: moreNotes })
              : route.continue(),
        );
        await morePage.goto(`http://127.0.0.1:${address.port}/`);
        await morePage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await morePage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await morePage.setViewportSize({ width: 1440, height: 900 });
        await morePage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
        await morePage.getByText("8 shown").waitFor();
        await morePage.locator("[data-ltm-vault-view-graph]").click();
        await morePage.locator("[data-ltm-graph-whole]").click();
        await morePage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length === 8);
        const moreCard = morePage.locator("[data-ltm-graph-card]");
        const moreInside = () =>
          morePage.evaluate(() => {
            const pane = document.querySelector("[data-ltm-graph-canvas]")!.getBoundingClientRect();
            const box = document.querySelector("[data-ltm-graph-card]")!.getBoundingClientRect();
            return (
              box.left >= pane.left - 1 &&
              box.right <= pane.right + 1 &&
              box.top >= pane.top - 1 &&
              box.bottom <= pane.bottom + 1
            );
          });
        await morePage.locator('[data-ltm-graph-node="more_hub"] circle').first().click();
        await moreCard.waitFor();
        assert.equal(await moreCard.locator("[data-ltm-graph-link-row]:not([data-ltm-graph-link-more])").count(), 6);
        assert.equal((await moreCard.locator("[data-ltm-graph-link-more]").innerText()).trim(), "1 more");
        assert.equal(await moreInside(), true, "the card is inside the canvas at 1440px");
        // A row selects that memory.
        await moreCard.locator("[data-ltm-graph-link-row]").first().click();
        await moreCard.getByRole("heading", { name: /^Person \d$/u }).waitFor();
        assert.equal(await morePage.locator("[data-ltm-graph-selected-ring]").count(), 1);
        assert.equal(await moreCard.locator("[data-ltm-graph-link-more]").count(), 0);
        // Esc closes the card.
        await morePage.keyboard.press("Escape");
        await moreCard.waitFor({ state: "detached" });
        await morePage.locator('[data-ltm-graph-node="more_hub"] circle').first().click();
        await moreCard.waitFor();
        await morePage.setViewportSize({ width: 390, height: 844 });
        assert.equal(await moreInside(), true, "the card is inside the canvas at 390px");
        // "N more" opens the editor on the memory.
        await moreCard.locator("[data-ltm-graph-link-more]").click();
        await morePage.locator("[data-ltm-field='title']").waitFor();
        assert.equal(await morePage.locator("[data-ltm-field='title']").inputValue(), "Harbour hub");
        await morePage.close();
      }
      // soup/vault-graph-widths: the Graph at phone, tablet and desktop width in both themes. The page never
      // scrolls sideways, the canvas fills its pane, the filter row is one swipeable line on a phone and wraps wider,
      // and the zoom buttons sit on the canvas. With MARINARA_VISUAL_OUTPUT_DIR set, each combination is saved as
      // long-term-memory-graph-<width>-<theme>.png.
      {
        const stamp = "2026-07-30T00:00:00.000Z";
        const widthNote = (id: string, title: string, type: string, links: unknown[] = []) => ({
          id,
          title,
          type,
          status: "active",
          modes: ["roleplay"],
          scope: {},
          tags: [],
          keywords: [],
          links,
          sections: { facts: { text: `${title} text.`, importance: "major", updatedAt: stamp } },
          createdAt: stamp,
          updatedAt: stamp,
          version: 1,
        });
        const widthNotes = [
          widthNote("wide_mira", "Mira Vale", "character"),
          widthNote("wide_kael", "Kael Ross", "character"),
          widthNote("wide_pair", "Mira and Kael", "relationship", [
            { target: "wide_mira", relation: "involves" },
            { target: "wide_kael", relation: "involves" },
          ]),
          widthNote("wide_thread", "Find the ledger that went missing from the harbour office", "thread", [
            { target: "wide_mira", relation: "involves" },
          ]),
          {
            ...widthNote("wide_event", "Ledger stolen", "timeline_event", [
              { target: "wide_thread", relation: "caused_by" },
            ]),
            status: "resolved",
            conflicts: [{ field: "facts", existing: "a", proposed: "b", resolution: "pending", policy: "ask" }],
          },
          widthNote("wide_world", "Lone lighthouse", "world"),
        ];
        const widthsPage = await browserContext.newPage();
        await widthsPage.route(
          (url) => url.pathname.endsWith("/api/long-term-memory/notes"),
          (route) =>
            route.request().method() === "GET" && !new URL(route.request().url()).searchParams.has("ids")
              ? route.fulfill({ json: widthNotes })
              : route.continue(),
        );
        await widthsPage.goto(`http://127.0.0.1:${address.port}/`);
        await widthsPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await widthsPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await widthsPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
        await widthsPage.getByText("6 shown").waitFor();
        // A row carries no type chip: the group heading it sits under names the type, in the plural.
        const eventRow = widthsPage.locator("[data-ltm-note-id]", { hasText: "Ledger stolen" }).first();
        await eventRow.waitFor({ state: "attached" });
        assert.equal(
          await eventRow.evaluate((row) =>
            row.closest("[data-ltm-memory-group]")?.getAttribute("data-ltm-memory-group"),
          ),
          "timeline_event",
          "the row sits in its type's group",
        );
        assert.equal(await eventRow.getByText("Timeline event", { exact: true }).count(), 0);
        assert.equal(await eventRow.getByText("Timeline Events", { exact: true }).count(), 0);
        // The sort select shows "Recently updated" whole at phone and desktop width. It sits in the Filters panel.
        for (const width of [390, 1440]) {
          await widthsPage.setViewportSize({ width, height: 844 });
          const sort = widthsPage.locator('[data-ltm-browser-controls] select:has(option[value="updated"])');
          if (!(await sort.count())) await widthsPage.locator("button[data-ltm-refine]").click();
          await sort.waitFor();
          assert.equal(
            // A native select clips its text inside its own box, so measure the chosen text against the box.
            await sort.evaluate((select) => {
              const style = getComputedStyle(select);
              const context = document.createElement("canvas").getContext("2d")!;
              context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
              const text = select.selectedOptions[0]!.textContent ?? "";
              const room =
                select.clientWidth -
                Number.parseFloat(style.paddingLeft) -
                Number.parseFloat(style.paddingRight) -
                Number.parseFloat(style.fontSize) * 1.5;
              return context.measureText(text).width <= room;
            }),
            true,
            `the sort select is not clipped at ${width}px`,
          );
        }
        await widthsPage.setViewportSize({ width: 1440, height: 844 });
        await widthsPage.locator("[data-ltm-vault-view-graph]").click();
        await widthsPage.locator("[data-ltm-graph-whole]").click();
        await widthsPage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length === 6);
        const canvasByTheme: Record<string, string> = {};
        for (const width of [390, 768, 1440]) {
          await widthsPage.setViewportSize({ width, height: 844 });
          for (const theme of ["light", "dark"]) {
            await widthsPage.evaluate((value) => {
              document.documentElement.dataset.theme = value;
            }, theme);
            if (width === 390 && theme === "light") {
              // Back in Focus the banner docks inside the canvas, left of the zoom buttons; then Whole Vault again.
              await widthsPage.locator("[data-ltm-graph-whole]").click();
              await widthsPage.locator("[data-ltm-graph-banner]").waitFor();
              const docked = await widthsPage.evaluate(() => {
                const pane = document.querySelector("[data-ltm-graph-canvas]")!.getBoundingClientRect();
                const banner = document.querySelector("[data-ltm-graph-banner]")!.getBoundingClientRect();
                const zoom = document.querySelector("[data-ltm-graph-zoom]")!.getBoundingClientRect();
                return {
                  inside: banner.left >= pane.left - 1 && banner.right <= pane.right + 1 && banner.top >= pane.top - 1,
                  clearOfZoom: banner.right <= zoom.left + 1,
                };
              });
              assert.deepEqual(
                docked,
                { inside: true, clearOfZoom: true },
                "the banner docks inside the canvas at 390px",
              );
              await widthsPage.locator("[data-ltm-graph-whole]").click();
            }
            await widthsPage.locator("[data-ltm-graph-fit]").click();
            await widthsPage.waitForFunction(() => document.querySelectorAll("[data-ltm-graph-node]").length === 6);
            const measured = await widthsPage.evaluate(() => {
              const svg = document.querySelector('svg[role="group"]')!;
              const pane = svg.parentElement!.getBoundingClientRect();
              const filtersEl = document.querySelector<HTMLElement>("[data-ltm-graph-filters]")!;
              const filters = filtersEl.getBoundingClientRect();
              const canvas = svg.parentElement!;
              const chipTops = new Set(
                [...filtersEl.querySelectorAll<HTMLElement>("button")].map((chip) =>
                  Math.round(chip.getBoundingClientRect().top),
                ),
              );
              return {
                filterLines: chipTops.size,
                filtersScroll: filtersEl.scrollWidth - filtersEl.clientWidth,
                // An anonymous callback: tsx adds `__name` to a named helper, and the page has none.
                zoomInside: ["[aria-label='Zoom in']", "[aria-label='Zoom out']", "[data-ltm-graph-fit]"].every(
                  (selector) => {
                    const box = canvas.querySelector(selector)?.getBoundingClientRect();
                    return (
                      !!box &&
                      box.left >= pane.left - 1 &&
                      box.right <= pane.right + 1 &&
                      box.top >= pane.top - 1 &&
                      box.bottom <= pane.bottom + 1
                    );
                  },
                ),
                pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                canvasFill: svg.getBoundingClientRect().width / pane.width,
                paneRight: pane.right,
                filtersRight: filters.right,
                viewport: window.innerWidth,
              };
            });
            const label = `${width}px ${theme}`;
            assert.ok(measured.pageOverflow <= 0, `the page does not scroll sideways at ${label}`);
            // On a phone the filter row is one line you swipe sideways, so the canvas keeps its height; wider, it
            // wraps and never scrolls. The zoom buttons are inside the canvas.
            if (width === 390) assert.equal(measured.filterLines, 1, `the filter row is one line at ${label}`);
            else assert.ok(measured.filtersScroll <= 0, `the filter row does not scroll sideways at ${label}`);
            assert.ok(measured.zoomInside, `the zoom buttons are inside the canvas at ${label}`);
            // About 1: a canvas that was never re-measured keeps its default width and lands far from 1.
            assert.ok(
              Math.abs(measured.canvasFill - 1) <= 0.05,
              `the canvas fills its pane at ${label} (${measured.canvasFill})`,
            );
            assert.ok(measured.paneRight <= measured.viewport + 1, `the canvas stays inside the page at ${label}`);
            assert.ok(
              measured.filtersRight <= measured.viewport + 1,
              `the filter row stays inside the page at ${label}`,
            );
            // The mock-up's colours: a tinted canvas that differs per theme and is not the card colour, and the
            // People disc stroke in the mock-up People colour of each theme.
            const painted = await widthsPage.evaluate(() => {
              const root = document.querySelector("[data-ltm-graph]")!;
              const canvas = getComputedStyle(root.querySelector("[data-ltm-graph-canvas]")!);
              const probe = document.createElement("div");
              probe.style.background = "var(--card)";
              root.append(probe);
              const card = getComputedStyle(probe).backgroundColor;
              probe.remove();
              const disc = root.querySelector('[data-ltm-graph-node="wide_mira"] [data-ltm-graph-disc]')!;
              return {
                canvas: canvas.backgroundColor,
                canvasDots: canvas.backgroundImage,
                card,
                stroke: getComputedStyle(disc).stroke,
              };
            });
            assert.notEqual(painted.canvas, painted.card, `the canvas is not the card colour at ${label}`);
            assert.ok(painted.canvasDots.includes("radial-gradient"), `the canvas has its dot grid at ${label}`);
            assert.equal(
              painted.stroke,
              theme === "dark" ? "rgb(175, 77, 128)" : "rgb(149, 44, 70)",
              `a People node uses the mock-up People colour at ${label}`,
            );
            canvasByTheme[theme] = painted.canvas;
            // The resolved memory carries the check and the one with a pending change the "!" badge; no other does.
            const event = widthsPage.locator('[data-ltm-graph-node="wide_event"]');
            assert.equal(await event.locator("[data-ltm-graph-check]").count(), 1, `resolved check at ${label}`);
            assert.equal(await widthsPage.locator("[data-ltm-graph-check]").count(), 1);
            assert.equal(await event.locator("[data-ltm-graph-conflict]").count(), 1, `conflict badge at ${label}`);
            assert.equal(await widthsPage.locator("[data-ltm-graph-conflict]").count(), 1);
            // After Fit the text holds its size: a node label is about 11 px tall however far Fit zoomed out, and a
            // cause line (caused_by) carries an arrowhead and the neutral line colour, not a family colour.
            const lines = await widthsPage.evaluate(() => {
              // The font size on screen, since a bounding box would include the halo stroke.
              const labels = [...document.querySelectorAll<SVGTextElement>("[data-ltm-graph-label]")].map(
                (text) => Number.parseFloat(getComputedStyle(text).fontSize) * text.getScreenCTM()!.a,
              );
              const cause = document.querySelector('[data-ltm-graph-edge="caused_by"]')!;
              return {
                labels,
                markerEnd: cause.getAttribute("marker-end") ?? "",
                stroke: getComputedStyle(cause).stroke,
              };
            });
            assert.ok(lines.labels.length >= 6, `every label shows at ${label}`);
            for (const height of lines.labels) {
              assert.ok(height >= 10 && height <= 14, `a node label is 10-14 px at ${label} (${height})`);
            }
            assert.match(lines.markerEnd, /^url\(#/u, `the caused_by line has an arrowhead at ${label}`);
            assert.notEqual(lines.stroke, painted.stroke, `a line is not drawn in a family colour at ${label}`);
            // The zoom buttons sit over a corner of the canvas, so open the card from the keyboard.
            await widthsPage.locator('[data-ltm-graph-node="wide_thread"]').focus();
            await widthsPage.keyboard.press("Enter");
            await widthsPage.locator("[data-ltm-graph-card]").waitFor();
            // The card floats over the canvas (a bottom sheet at phone width) and never leaves its box.
            const cardBox = await widthsPage.evaluate(() => {
              const pane = document.querySelector("[data-ltm-graph-canvas]")!.getBoundingClientRect();
              const box = document.querySelector("[data-ltm-graph-card]")!.getBoundingClientRect();
              return {
                inside:
                  box.left >= pane.left - 1 &&
                  box.right <= pane.right + 1 &&
                  box.top >= pane.top - 1 &&
                  box.bottom <= pane.bottom + 1,
                width: Math.round(box.width),
                sheet: box.width / pane.width,
                tall: box.height / pane.height,
              };
            });
            assert.ok(cardBox.inside, `the card lies inside the canvas at ${label}`);
            if (width < 832) {
              assert.ok(cardBox.sheet > 0.9, `the card is a bottom sheet at ${label}`);
              // The sheet covers the lower part only, so most of the graph stays in sight above it.
              assert.ok(cardBox.tall <= 0.43, `the card sheet is under half the canvas at ${label} (${cardBox.tall})`);
            } else assert.equal(cardBox.width, 320, `the card is 20rem wide at ${label}`);
            // The open card's memory is the one selection ring, however many other memories were anchors.
            assert.equal(
              await widthsPage.locator("[data-ltm-graph-selected-ring]").count(),
              1,
              `one selection ring at ${label}`,
            );
            if (visualOutputDir) {
              // The tabs fade between themes, so wait and capture the page.
              await widthsPage.evaluate(
                "Promise.all(document.getAnimations().filter((animation) => animation.effect.getComputedTiming().endTime !== Infinity).map((animation) => animation.finished))",
              );
              await widthsPage.screenshot({
                path: join(visualOutputDir, `long-term-memory-graph-${width}-${theme}.png`),
                fullPage: true,
              });
            }
            await widthsPage.keyboard.press("Escape");
            await widthsPage.locator("[data-ltm-graph-card]").waitFor({ state: "detached" });
            if (theme === "light") {
              // Full screen: the graph fills the window, the canvas grows and the zoom buttons stay on it; Esc returns
              // the graph to the page with focus back on its button.
              const before = await widthsPage.locator("[data-ltm-graph-canvas]").evaluate((el) => el.clientHeight);
              const pageOverflow = await widthsPage.evaluate(() => document.documentElement.style.overflow);
              await widthsPage.locator("[data-ltm-graph-expand]").click();
              await widthsPage.locator("[data-ltm-graph-expanded]").waitFor();
              await widthsPage.waitForFunction(
                () => !!document.activeElement?.matches("[data-ltm-graph-expanded] [data-ltm-graph-expand]"),
              );
              const full = await widthsPage.evaluate(() => {
                const root = document.querySelector("[data-ltm-graph-expanded]")!.getBoundingClientRect();
                const canvas = document.querySelector("[data-ltm-graph-canvas]")!.getBoundingClientRect();
                const zoom = document.querySelector("[data-ltm-graph-zoom]")!.getBoundingClientRect();
                return {
                  covers: root.top <= 0 && root.left <= 0 && root.width >= window.innerWidth - 1,
                  height: canvas.height,
                  zoomInside: zoom.bottom <= canvas.bottom + 1 && zoom.right <= canvas.right + 1,
                  label: document.querySelector("[data-ltm-graph-expand]")!.getAttribute("aria-label"),
                  pageScroll: document.documentElement.style.overflow,
                };
              });
              assert.ok(full.covers, `full screen covers the window at ${label}`);
              assert.ok(
                full.height > before + 40,
                `full screen grows the canvas at ${label} (${before} -> ${full.height})`,
              );
              assert.ok(full.zoomInside, `the zoom buttons stay on the full-screen canvas at ${label}`);
              assert.equal(full.label, "Exit full screen", `the button names the way out at ${label}`);
              assert.equal(full.pageScroll, "hidden", `the page behind stops scrolling at ${label}`);
              await widthsPage.keyboard.press("Escape");
              await widthsPage.locator("[data-ltm-graph-expanded]").waitFor({ state: "detached" });
              await widthsPage.waitForFunction(() => !!document.activeElement?.matches("[data-ltm-graph-expand]"));
              assert.equal(
                await widthsPage.evaluate(() => document.documentElement.style.overflow),
                pageOverflow,
                `the page scrolls as before after full screen at ${label}`,
              );
              // Headless Chromium keeps its window in the full-screen state after the page leaves it,
              // so restore the window before the next width is set.
              const cdp = await widthsPage.context().newCDPSession(widthsPage);
              const { windowId } = await cdp.send("Browser.getWindowForTarget");
              await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
              await cdp.detach();
            }
          }
          assert.notEqual(canvasByTheme.light, canvasByTheme.dark, `the canvas differs between themes at ${width}px`);
        }
        // Phone-sized hands on the canvas: a press that starts on a memory and moves pans the graph and opens nothing,
        // a tap just beside a small dot opens that memory, the card's memory moves above the sheet, and a tap on empty
        // canvas closes the card.
        {
          await widthsPage.setViewportSize({ width: 390, height: 844 });
          await widthsPage.locator("[data-ltm-graph-canvas]").scrollIntoViewIfNeeded();
          await widthsPage.locator("[data-ltm-graph-fit]").click();
          const worldDisc = widthsPage.locator('[data-ltm-graph-node="wide_world"] [data-ltm-graph-disc]');
          for (let i = 0; i < 8 && (await worldDisc.boundingBox())!.width > 16; i += 1)
            await widthsPage.locator("[data-ltm-graph-canvas] [aria-label='Zoom out']").click();
          const transform = () => widthsPage.locator('svg[role="group"] > g').getAttribute("transform");
          const before = await transform();
          // Start on a memory the canvas controls do not cover and move it a little toward the middle of the pane.
          const grab = (await widthsPage.evaluate(`(() => {
            const pane = document.querySelector("[data-ltm-graph-canvas]").getBoundingClientRect();
            const middle = { x: pane.x + pane.width / 2, y: pane.y + Math.min(pane.height, innerHeight - pane.y) / 2 };
            for (const node of document.querySelectorAll("[data-ltm-graph-node]")) {
              const box = node.querySelector("[data-ltm-graph-disc]").getBoundingClientRect();
              const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
              if (document.elementFromPoint(from.x, from.y)?.closest("[data-ltm-graph-node]") !== node) continue;
              const length = Math.hypot(middle.x - from.x, middle.y - from.y) || 1;
              const step = Math.min(60, length) / length;
              return { from, to: { x: from.x + (middle.x - from.x) * step, y: from.y + (middle.y - from.y) * step } };
            }
            return null;
          })()`)) as { from: { x: number; y: number }; to: { x: number; y: number } } | null;
          assert.ok(grab, "a memory the pointer can reach");
          await widthsPage.mouse.move(grab.from.x, grab.from.y);
          await widthsPage.mouse.down();
          await widthsPage.mouse.move(grab.to.x, grab.to.y, { steps: 8 });
          await widthsPage.mouse.up();
          assert.notEqual(await transform(), before, "a drag that starts on a memory pans the graph");
          assert.equal(await widthsPage.locator("[data-ltm-graph-card]").count(), 0, "a drag opens no card");
          // A point beside a small disc, clear of its own shape and nearer to it than to any other memory.
          const beside = await widthsPage.evaluate(() => {
            const nodes = [...document.querySelectorAll("[data-ltm-graph-node]")].map((node) => {
              const box = node.querySelector("[data-ltm-graph-disc]")!.getBoundingClientRect();
              return {
                id: node.getAttribute("data-ltm-graph-node")!,
                label: node.getAttribute("aria-label") ?? "",
                x: box.left + box.width / 2,
                y: box.top + box.height / 2,
                r: box.width / 2,
              };
            });
            for (const target of nodes.filter((node) => node.r * 2 <= 16)) {
              const gap = target.r + 10;
              for (let turn = 0; turn < 16; turn += 1) {
                const x = target.x + Math.cos((turn / 8) * Math.PI) * gap;
                const y = target.y + Math.sin((turn / 8) * Math.PI) * gap;
                const hit = document.elementFromPoint(x, y);
                const clear = nodes.every((node) => node === target || Math.hypot(node.x - x, node.y - y) > gap + 4);
                if (hit?.closest('svg[role="group"]') && !hit.closest("[data-ltm-graph-node]") && clear)
                  return { x, y, id: target.id, label: target.label };
              }
            }
            return null;
          });
          assert.ok(beside, "there is room beside a small disc");
          await widthsPage.mouse.click(beside.x, beside.y);
          await widthsPage.locator("[data-ltm-graph-card]").waitFor();
          const cardTitle = await widthsPage.locator("[data-ltm-graph-card] h3").innerText();
          assert.ok(
            beside.label.includes(cardTitle),
            `a tap beside a small dot opens it (${cardTitle} / ${beside.label})`,
          );
          const placed = await widthsPage.evaluate(
            (id) => ({
              disc: document
                .querySelector(`[data-ltm-graph-node="${id}"] [data-ltm-graph-disc]`)!
                .getBoundingClientRect().bottom,
              card: document.querySelector("[data-ltm-graph-card]")!.getBoundingClientRect().top,
            }),
            beside.id,
          );
          assert.ok(placed.disc < placed.card, `the memory moves above the card sheet (${JSON.stringify(placed)})`);
          const emptySpot = await widthsPage.evaluate(() => {
            const card = document.querySelector("[data-ltm-graph-card]")!.getBoundingClientRect();
            const pane = document.querySelector("[data-ltm-graph-canvas]")!.getBoundingClientRect();
            const centres = [...document.querySelectorAll("[data-ltm-graph-disc]")].map((disc) => {
              const box = disc.getBoundingClientRect();
              return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
            });
            for (let y = pane.top + 8; y < card.top - 8; y += 8)
              for (let x = pane.left + 8; x < pane.right - 8; x += 8) {
                const hit = document.elementFromPoint(x, y);
                const far = centres.every((centre) => Math.hypot(centre.x - x, centre.y - y) >= 50);
                if (hit?.matches('svg[role="group"]') && far) return { x, y };
              }
            return null;
          });
          assert.ok(emptySpot, "there is empty canvas above the card");
          await widthsPage.mouse.click(emptySpot.x, emptySpot.y);
          await widthsPage.locator("[data-ltm-graph-card]").waitFor({ state: "detached" });
        }
        await widthsPage.close();
      }
      // #1588: each memory group in the place picker shows 100 places at a time, so with more than 100 places
      // holding memories, "Show N places with no memories" still opens its group.
      {
        const groupCapPage = await browserContext.newPage();
        await groupCapPage.route(
          (url) => url.pathname.endsWith("/api/long-term-memory/scope-targets"),
          async (route) => {
            const response = await route.fetch();
            const targets = await response.json();
            const capChats = Array.from({ length: 101 }, (_, index) => ({
              id: `cap-chat-${index}`,
              label: `Cap chat ${index}`,
              mode: "conversation",
              groupId: null,
              personaId: null,
              characterIds: [],
            }));
            await route.fulfill({
              response,
              json: {
                ...targets,
                chats: [...targets.chats, ...capChats],
                memoryPresence: [...targets.memoryPresence, ...capChats.map((chat) => ({ chatId: chat.id }))],
              },
            });
          },
        );
        await groupCapPage.goto(`http://127.0.0.1:${address.port}/`);
        await groupCapPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await groupCapPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await groupCapPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
        const groupCapPicker = groupCapPage.locator('[data-ltm-scope-picker="vault"]');
        const groupCapWith = groupCapPicker.locator('[data-ltm-scope-presence="with-memories"]');
        const groupCapWithout = groupCapPicker.locator('[data-ltm-scope-presence="no-memories"]');
        await groupCapPicker.locator("[data-ltm-scope-picker-trigger]").click();
        await groupCapPicker.locator('[data-ltm-scope-tab="chat"]').click();
        assert.equal(await groupCapWith.locator("[data-ltm-scope-option]").count(), 100);
        await groupCapPicker.locator("[data-ltm-scope-show-no-memories]").click();
        await groupCapWithout.waitFor({ timeout: 5000 });
        assert.equal(
          await groupCapWithout.locator('[data-ltm-scope-option][data-highlighted="true"]').count(),
          1,
          "opening the group highlights its first place",
        );
        const groupCapWithMore = groupCapWith.locator("[data-ltm-scope-show-more]");
        assert.match((await groupCapWithMore.innerText()).trim(), /^Show \d more$/u);
        await groupCapWithMore.click();
        assert.equal(await groupCapWithMore.count(), 0);
        assert.equal(await groupCapWith.locator('[data-ltm-scope-option="chat:cap-chat-100"]').count(), 1);
        await groupCapPage.close();
      }
      // #1376: "Reset to defaults" (beside the Memory Settings reassurance) reloads the forms. The Troubleshooting
      // section stays mounted and its Delete button stays locked until the settings refetch resolves.
      {
        const resetPage = await browserContext.newPage();
        let settingsGate: Promise<void> | null = null;
        let releaseSettings = () => {};
        let resetBudget: number | null = null;
        await resetPage.route("**/api/long-term-memory/settings/reset", (route) =>
          route.fulfill({ json: { rebuild: { status: "deferred", error: "Fixture rebuild failed." } } }),
        );
        // Settings read after the reset serve a changed value, which the forms must show instead of the cache.
        await resetPage.route("**/api/long-term-memory/settings", async (route) => {
          if (resetBudget === null || route.request().method() !== "GET") return route.continue();
          if (settingsGate) await settingsGate;
          const response = await route.fetch();
          await route.fulfill({
            response,
            json: { ...(await response.json()), longTermMemoryBudgetTokens: resetBudget },
          });
        });
        await resetPage.goto(`http://127.0.0.1:${address.port}/`);
        await resetPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await resetPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await resetPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        await openRecallAdvanced(resetPage);
        const recallBudget = resetPage.getByRole("spinbutton", { name: "Memory budget", exact: true });
        const cachedBudget = Number(await recallBudget.inputValue());
        await openTroubleshooting(resetPage);
        const maintenancePanel = resetPage.locator("#settings-panel-troubleshooting");
        // The panel is hidden while the cleared forms reload, so find its button there too.
        const deleteButton = maintenancePanel.getByRole("button", { name: "Delete all data", includeHidden: true });
        // The link unmounts while the cleared forms reload and comes back once the settings are read.
        const resetLink = resetPage.locator("[data-ltm-reset-settings]");
        assert.equal(await resetLink.innerText(), "Reset to defaults");
        assert.equal(
          await maintenancePanel.getByRole("button", { name: "Reset settings", includeHidden: true }).count(),
          0,
          "Troubleshooting no longer holds Reset",
        );
        settingsGate = new Promise<void>((resolve) => {
          releaseSettings = () => resolve();
        });
        resetBudget = cachedBudget === 2048 ? 2176 : 2048;
        const settingsRefetch = resetPage.waitForRequest(
          (request) => request.method() === "GET" && new URL(request.url()).pathname.endsWith("/settings"),
        );
        // #1377: the invalidation already refetches the active settings query, so a reset reads them once.
        let settingsReads = 0;
        resetPage.on("request", (request) => {
          if (request.method() === "GET" && new URL(request.url()).pathname.endsWith("/long-term-memory/settings"))
            settingsReads += 1;
        });
        await resetLink.click();
        await settingsRefetch;
        // Let the cleared forms re-render while the refetch is still held.
        await resetPage.waitForTimeout(300);
        // #1452: the cleared forms wait for the refetch instead of refilling from the cached settings.
        await resetPage.getByText("Loading memory settings.").waitFor();
        assert.equal(await resetLink.count(), 0, "the Reset link is gone while the forms reload");
        assert.equal(
          await deleteButton.getAttribute("aria-disabled"),
          "true",
          "Delete all data stays locked until the settings refetch resolves",
        );
        assert.equal(await deleteButton.getAttribute("disabled"), null, "a locked button keeps keyboard focus");
        settingsGate = null;
        releaseSettings();
        // A reset that landed but could not rebuild the index is a warning toast, not an error.
        await resetPage
          .locator('[data-sonner-toast][data-type="warning"]')
          .filter({
            hasText: "Memory settings reset to defaults, but the reindex failed: Fixture rebuild failed.",
          })
          .waitFor({ timeout: 5000 });
        await resetLink.waitFor({ timeout: 5000 });
        assert.equal(
          await resetLink.getAttribute("aria-disabled"),
          null,
          "Reset is available again once the refetch resolves",
        );
        assert.equal(await deleteButton.getAttribute("aria-disabled"), null, "Delete is unlocked again");
        assert.equal(
          await resetLink.evaluate((element) => element === document.activeElement),
          true,
          "focus returns to the Reset link",
        );
        assert.equal(settingsReads, 1, "Reset reads the settings once");
        // A finished Troubleshooting action is a toast: the panel keeps no result banner of its own.
        assert.equal(
          await maintenancePanel
            .locator("[data-ltm-status]")
            .filter({ hasText: /^Memory settings reset to defaults, but/u })
            .count(),
          0,
        );
        await resetPage.locator("#settings-tab-recall").click();
        await openRecallAdvanced(resetPage);
        assert.equal(
          await recallBudget.inputValue(),
          String(resetBudget),
          "the forms show the settings read after the reset",
        );
        await resetPage.close();
      }
      // soup/settings-troubleshooting: Memory Settings has two tabs, Recall and Extraction. Troubleshooting is a
      // closed section at the bottom (Delete all data, the activity log; Reset to defaults sits beside the
      // reassurance above the tabs), and Sources holds "Import detail" at the import button.
      {
        const tsPage = await browserContext.newPage();
        await tsPage.goto(`http://127.0.0.1:${address.port}/`);
        await tsPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await tsPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => false };
          document.body.append(element);
        })()`);
        await tsPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        assert.deepEqual(
          await tsPage.locator('[role="tab"][id^="settings-tab-"]').evaluateAll((tabs) => tabs.map((tab) => tab.id)),
          ["settings-tab-recall", "settings-tab-extraction"],
          "Memory Settings has only the Recall and Extraction tabs",
        );
        const section = tsPage.locator("#settings-panel-troubleshooting");
        assert.equal(
          await section.evaluate((node: HTMLDetailsElement) => node.open),
          false,
          "Troubleshooting starts closed",
        );
        assert.equal(
          await tsPage.evaluate(() => {
            const last = document.querySelector("#settings-panel-troubleshooting");
            const extraction = document.querySelector("#settings-panel-extraction");
            return Boolean(
              last && extraction && extraction.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING,
            );
          }),
          true,
          "Troubleshooting sits after the tab panels",
        );
        await openTroubleshooting(tsPage);
        assert.equal(await section.getByRole("button", { name: "Delete all data" }).count(), 1);
        assert.equal(await section.getByRole("button", { name: "Reset settings" }).count(), 0);
        assert.equal(await tsPage.locator("[data-ltm-reset-settings]").count(), 1, "Reset is on the page");
        await section.getByRole("button", { name: "Delete all data" }).click();
        await section.locator("[data-ltm-delete-prompt]").waitFor();
        assert.equal(
          await section.locator("[data-ltm-activity-log]").count(),
          0,
          "Troubleshooting has no activity log",
        );
        await tsPage.locator("#settings-tab-extraction").click();
        assert.equal(
          await section.evaluate((node: HTMLDetailsElement) => node.open),
          true,
          "Troubleshooting stays open across tabs",
        );
        // Record recall explanations moved to the Activity page; Recall > Advanced no longer has it.
        await tsPage.locator("#settings-tab-recall").click();
        await openRecallAdvanced(tsPage);
        assert.equal(
          await tsPage.getByText("Record recall explanations", { exact: true }).count(),
          0,
          "Recall > Advanced has no record switch",
        );
        // Sources: Import detail at the bottom of the card saves on its own through the extraction-settings PUT.
        const writesBefore = extractionWrites.length;
        await tsPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="sources"]').click();
        const importDetail = tsPage.locator("[data-ltm-import-detail]");
        await importDetail.waitFor();
        // Import detail sits at the bottom of the card, after the source list.
        assert.equal(
          await importDetail.evaluate((element) =>
            Boolean(
              document.querySelector('[data-ltm-surface="sources"] [role="list"]')!.compareDocumentPosition(element) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          ),
          true,
          "Import detail follows the source list",
        );
        const detailed = importDetail.getByRole("button", { name: "Detailed" });
        assert.equal(await detailed.getAttribute("aria-pressed"), "false");
        const detailWrite = tsPage.waitForResponse(
          (response) =>
            response.request().method() === "PUT" && new URL(response.url()).pathname.endsWith("/extraction-settings"),
        );
        await detailed.click();
        await detailWrite;
        assert.deepEqual(extractionWrites.slice(writesBefore), [{ chatImportDetail: "detailed" }]);
        await tsPage.close();
      }
      // #1659: Troubleshooting group Delete. Delete all data offers "Export a backup first" before the host's confirmation.
      for (const width of [1280, 390]) {
        const groupPage = await browserContext.newPage();
        await groupPage.setViewportSize({ width, height: 900 });
        let deleteRequests = 0;
        await groupPage.route("**/api/long-term-memory/data", (route) => {
          if (route.request().method() !== "DELETE") return route.continue();
          deleteRequests += 1;
          return route.fulfill({ json: { ok: true } });
        });
        await groupPage.goto(`http://127.0.0.1:${address.port}/`);
        await groupPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await groupPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = {
            confirmAction: (options) => {
              window.__ltmConfirms = [...(window.__ltmConfirms ?? []), options];
              return window.__ltmConfirmResult ?? false;
            },
          };
          document.body.append(element);
        })()`);
        await groupPage.locator('[data-ltm-destination="settings"]:visible').first().click();
        await openTroubleshooting(groupPage);
        const panel = groupPage.locator("#settings-panel-troubleshooting");
        const groupNames = await panel
          .locator("[data-ltm-troubleshooting-group]")
          .evaluateAll((groups) => groups.map((group) => group.getAttribute("data-ltm-troubleshooting-group")));
        assert.deepEqual(groupNames, ["help", "delete"], `Troubleshooting groups at ${width}px`);
        const groupOf = (name: string) => panel.locator(`[data-ltm-troubleshooting-group="${name}"]`);
        for (const [group, button] of [
          ["help", "Run setup again"],
          ["help", "Take the tour"],
          ["delete", "Delete all data"],
        ] as const) {
          assert.equal(
            await groupOf(group).getByRole("button", { name: button }).count(),
            1,
            `${button} is in ${group}`,
          );
        }
        const tones = await panel.evaluate((root) => {
          const buttons = [...root.querySelectorAll<HTMLElement>("button")];
          const remove = buttons.find((item) => item.textContent?.trim() === "Delete all data")!;
          return { deleteDanger: remove.classList.contains("mari-editor-action--danger") };
        });
        assert.deepEqual(tones, { deleteDanger: true });
        assert.equal(
          await groupPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
          true,
          `Troubleshooting does not overflow horizontally at ${width}px`,
        );
        // Delete all data opens the export offer first; declining the host confirmation deletes nothing.
        const deleteAll = groupOf("delete").getByRole("button", { name: "Delete all data" });
        await deleteAll.click();
        const prompt = groupOf("delete").locator("[data-ltm-delete-prompt]");
        await prompt.waitFor();
        const exportFirst = prompt.getByRole("button", { name: "Export a backup first" });
        await groupPage.waitForFunction(() => document.activeElement?.textContent?.includes("Export a backup first"));
        assert.equal(await exportFirst.evaluate((element) => element === document.activeElement), true);
        assert.equal(
          await groupPage.evaluate(
            () => (window as unknown as { __ltmConfirms?: unknown[] }).__ltmConfirms?.length ?? 0,
          ),
          0,
        );
        assert.equal(
          await groupPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
          true,
          `the open export offer does not overflow horizontally at ${width}px`,
        );
        // "Export a backup first" exports from here, reports in Delete, and deletes nothing.
        let exportRequests = 0;
        await groupPage.route("**/api/long-term-memory/backup/export", (route) => {
          exportRequests += 1;
          return route.fulfill({ json: { version: 1, notes: [] } });
        });
        await exportFirst.click();
        await toastWith(groupPage, "Memory backup exported.").waitFor({ timeout: 5000 });
        assert.equal(exportRequests, 1, "the export offer exports once");
        assert.equal(await panel.getByRole("button", { name: "Choose backup" }).count(), 0, "Restore is in the Vault");
        assert.equal(await prompt.count(), 1, "exporting leaves the offer open");
        assert.equal(deleteRequests, 0);
        assert.equal(
          await groupPage.evaluate(
            () => (window as unknown as { __ltmConfirms?: unknown[] }).__ltmConfirms?.length ?? 0,
          ),
          0,
        );
        assert.equal(
          await prompt.getAttribute("aria-describedby"),
          await prompt.locator("p").first().getAttribute("id"),
          "the offer text describes the group",
        );
        // Escape closes the offer and returns focus to Delete all data.
        await exportFirst.focus();
        await groupPage.keyboard.press("Escape");
        assert.equal(await prompt.count(), 0, "Escape closes the export offer");
        assert.equal(await deleteAll.evaluate((element) => element === document.activeElement), true);
        await deleteAll.click();
        await prompt.waitFor();
        await prompt.getByRole("button", { name: "Cancel" }).click();
        assert.equal(await prompt.count(), 0, "Cancel closes the export offer");
        assert.equal(
          await deleteAll.evaluate((element) => element === document.activeElement),
          true,
          "Cancel returns focus",
        );
        await deleteAll.click();
        await prompt.getByRole("button", { name: "Continue to delete" }).click();
        await groupPage.waitForFunction(
          () => (window as unknown as { __ltmConfirms?: unknown[] }).__ltmConfirms?.length === 1,
        );
        const confirmOptions = await groupPage.evaluate(
          () =>
            (window as unknown as { __ltmConfirms: Array<{ confirmLabel?: string; tone?: string }> }).__ltmConfirms[0],
        );
        assert.equal(confirmOptions?.confirmLabel, "Delete everything");
        assert.equal(confirmOptions?.tone, "destructive");
        assert.equal(deleteRequests, 0, "declining the host confirmation deletes nothing");
        assert.equal(await prompt.count(), 1, "a declined confirmation leaves the export offer open");
        await groupPage.evaluate(() => {
          (window as unknown as { __ltmConfirmResult: boolean }).__ltmConfirmResult = true;
        });
        await prompt.getByRole("button", { name: "Continue to delete" }).click();
        await toastWith(groupPage, "All memory data deleted.").waitFor({ timeout: 5000 });
        assert.equal(deleteRequests, 1);
        assert.equal(await prompt.count(), 0, "the export offer closes once the delete runs");
        // soup/tour: Troubleshooting replays the tour even after it was ended; on a phone the bubble docks
        // to the bottom, and End tour returns focus to Help.
        await groupOf("help").locator("[data-ltm-troubleshooting-tour]").click();
        const replay = groupPage.locator('[data-ltm-surface="tour"][data-ltm-tour-stop="welcome"]');
        await replay.waitFor();
        if (width === 390) {
          const docked = await replay
            .locator("[data-ltm-tour-bubble]")
            .evaluate((bubble) => Math.round(window.innerHeight - bubble.getBoundingClientRect().bottom));
          assert.equal(docked, 16, "the phone bubble docks 16px above the bottom");
          // A ring on a bottom tab moves the docked bubble to the top, so the tab stays visible.
          // The stop changes under each click, so Next is found on the tour itself, not on the welcome stop.
          const replayNext = groupPage.locator('[data-ltm-surface="tour"] [data-ltm-tour-next]');
          await replayNext.click();
          await groupPage.locator('[data-ltm-surface="tour"][data-ltm-tour-stop="vault"]').waitFor();
          await replayNext.click();
          const phoneTour = groupPage.locator('[data-ltm-surface="tour"][data-ltm-tour-stop="sources"]');
          await phoneTour.locator("[data-ltm-tour-spotlight]").waitFor();
          const overlap = await phoneTour.evaluate((dialog) => {
            const ring = dialog.querySelector("[data-ltm-tour-spotlight]")!.getBoundingClientRect();
            const bubble = dialog.querySelector("[data-ltm-tour-bubble]")!.getBoundingClientRect();
            return ring.top < bubble.bottom && bubble.top < ring.bottom;
          });
          assert.equal(overlap, false, "the phone bubble does not cover the ringed tab");
        }
        await groupPage.locator("[data-ltm-tour-end]").click();
        await groupPage.locator('[data-ltm-surface="tour"]').waitFor({ state: "detached" });
        await groupPage.waitForFunction(() => document.activeElement?.hasAttribute("data-ltm-onboarding-help"));
        await groupPage.close();
      }
      // soup/tour-phone: at 390px setup's Done offers "Show me around" and it starts the tour; the bubble docks and
      // uses the -small strip. Strips play (a play-once one here), and reduced motion holds the rest frame.
      {
        const phonePage = await browserContext.newPage();
        await phonePage.setViewportSize({ width: 390, height: 844 });
        await phonePage.goto(`http://127.0.0.1:${address.port}/`);
        await phonePage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await phonePage.evaluate(() => {
          localStorage.setItem("marinara-long-term-memory-onboarding-v1", "beat:4");
          localStorage.removeItem("marinara-long-term-memory-tour-v1");
        });
        await phonePage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => false };
          document.body.append(element);
        })()`);
        await phonePage.getByRole("button", { name: "Help", exact: true }).click();
        await phonePage.locator("[data-ltm-help-setup]").click();
        const phoneSetup = phonePage.locator('[data-ltm-surface="onboarding"][data-ltm-setup-beat="4"]');
        await phoneSetup.waitFor();
        const doneSprite = phoneSetup.locator("[data-ltm-setup-sprite]");
        const motion = (locator: typeof doneSprite) =>
          locator.evaluate((sprite) => {
            const style = getComputedStyle(sprite);
            return {
              name: style.animationName,
              x: style.backgroundPositionX,
              motion: sprite.getAttribute("data-ltm-sprite-motion"),
            };
          });
        const doneMotion = await motion(doneSprite);
        assert.equal(doneMotion.motion, "once", "a single gesture plays once");
        assert.equal(doneMotion.name, "ltm-sprite-once");
        await phonePage.emulateMedia({ reducedMotion: "reduce" });
        assert.deepEqual(
          await motion(doneSprite),
          { name: "none", x: "-384px", motion: "once" },
          "reduced motion holds the last frame of a play-once strip",
        );
        await phonePage.emulateMedia({ reducedMotion: "no-preference" });
        await phoneSetup.getByRole("button", { name: "Show me around" }).click();
        await phoneSetup.waitFor({ state: "detached" });
        const phoneWelcome = phonePage.locator('[data-ltm-surface="tour"][data-ltm-tour-stop="welcome"]');
        await phoneWelcome.waitFor();
        const welcomeSprite = phoneWelcome.locator("[data-ltm-setup-sprite]");
        assert.equal(await welcomeSprite.getAttribute("data-ltm-setup-sprite"), "welcome-bell-small");
        assert.deepEqual(
          await welcomeSprite.evaluate((sprite) => [sprite.clientWidth, sprite.clientHeight]),
          [64, 96],
          "the phone bubble uses the -small strip",
        );
        assert.equal(
          await phoneWelcome
            .locator("[data-ltm-tour-bubble]")
            .evaluate((bubble) => Math.round(window.innerHeight - bubble.getBoundingClientRect().bottom)),
          16,
          "the phone bubble docks 16px above the bottom",
        );
        // Stop 2 loops (vault-browse): it runs, and reduced motion holds frame 1.
        await phonePage.locator("[data-ltm-tour-next]").click();
        const phoneVault = phonePage.locator('[data-ltm-surface="tour"][data-ltm-tour-stop="vault"]');
        await phoneVault.waitFor();
        const loopSprite = phoneVault.locator("[data-ltm-setup-sprite]");
        assert.equal((await motion(loopSprite)).name, "ltm-sprite-loop");
        await phonePage.emulateMedia({ reducedMotion: "reduce" });
        assert.deepEqual(
          await motion(loopSprite),
          { name: "none", x: "0px", motion: "loop" },
          "reduced motion holds frame 1 of a loop",
        );
        await phonePage.locator("[data-ltm-tour-end]").click();
        await phonePage.close();
      }
      // #1659: Recall opens with the budget and style, then Sharing, then a closed fine-tuning section; the four weights use
      // plain names (the same ones the Activity view uses), and editing a weight shows the Custom note with a
      // button that restores the preset the weights came from.
      for (const width of [1280, 390]) {
        const recallPage = await browserContext.newPage();
        await recallPage.setViewportSize({ width, height: 900 });
        await recallPage.goto(`http://127.0.0.1:${address.port}/`);
        await recallPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await recallPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => false };
          document.body.append(element);
        })()`);
        await recallPage.locator('[data-ltm-destination="settings"]:visible').first().click();
        const recall = recallPage.locator("#settings-panel-recall");
        await recall.waitFor();
        const groups = await recall.locator("[data-ltm-recall-group]").evaluateAll((nodes) =>
          nodes.map((node) => ({
            group: node.getAttribute("data-ltm-recall-group"),
            heading: node.querySelector("h4")?.textContent?.trim(),
            labelled: node.getAttribute("aria-labelledby") === node.querySelector("h4")?.id,
          })),
        );
        assert.deepEqual(
          groups,
          [{ group: "sharing", heading: "Other Agents", labelled: true }],
          `Recall groups at ${width}px`,
        );
        const inGroup = (group: string) => recall.locator(`[data-ltm-recall-group="${group}"]`);
        const advanced = recall.locator("[data-ltm-recall-advanced]");
        for (const label of ["Memory budget", "Recall style"]) {
          assert.equal(await recall.getByLabel(label, { exact: true }).count(), 1, `${label} is on the Recall tab`);
          assert.equal(await advanced.getByLabel(label, { exact: true }).count(), 0, `${label} is not tucked away`);
        }
        for (const label of [
          "Recent messages to search with",
          "Match strictness",
          "Intro to memories",
          "Words to skip when matching",
        ]) {
          assert.equal(await advanced.getByLabel(label, { exact: true }).count(), 1, `${label} is fine-tuning`);
        }
        // soup/ltm-settings-tidy: the four weights belong to Custom, so a preset style shows none of them.
        for (const label of ["Meaning match", "Exact words match", "Linked memories match", "Stored keywords match"]) {
          assert.equal(await recall.getByLabel(label, { exact: true }).count(), 0, `${label} is hidden on a preset`);
        }
        assert.equal(
          await inGroup("sharing").getByRole("button", { name: "Add Agent", exact: true }).count(),
          1,
          "Add Agent is in sharing",
        );
        assert.equal(await recall.getByText("Graph weight", { exact: true }).count(), 0, "the old graph label is gone");
        assert.equal(
          await recall.getByText("Keyword weight", { exact: true }).count(),
          0,
          "the old keyword label is gone",
        );
        // soup/settings-recall: Advanced starts closed and holds the fine-tuning controls; the budget says what
        // it fits and the style shows its description in place.
        assert.equal(await advanced.evaluate((node) => (node as HTMLDetailsElement).open), false, "Advanced is closed");
        assert.match(await advanced.locator("summary").innerText(), /^Matching and wording/u);
        assert.equal(await recall.getByLabel("Match strictness", { exact: true }).isVisible(), false);
        assert.equal(await recall.getByLabel("Recall style", { exact: true }).isVisible(), true);
        assert.equal(
          await recall.locator("[data-ltm-recall-style-description]").count(),
          1,
          "preset styles describe themselves",
        );
        assert.equal(await recall.getByRole("checkbox", { name: "Linked memories", exact: true }).count(), 1);
        // soup/ltm-frame-vault: on/off settings are switches and the weights and threshold are sliders.
        assert.equal(
          await recall
            .getByRole("checkbox", { name: "Linked memories", exact: true })
            .evaluate((input) => getComputedStyle(input).appearance),
          "none",
          "Settings toggles draw as switches",
        );
        assert.equal(
          await recall.getByLabel("Match strictness", { exact: true }).getAttribute("type"),
          "range",
          "Match strictness is a slider",
        );
        assert.deepEqual(
          await recall.locator("[data-ltm-slider-ends] > span").allTextContents(),
          ["Looser · more memories", "Stricter · fewer, closer memories"],
          "the threshold says which way is which",
        );
        // soup/ltm-frame-vault: hints sit at the control, not behind (i) buttons.
        const budgetGroup = recall.locator("[data-ltm-recall-grid]").first();
        assert.equal((await budgetGroup.locator("[data-ltm-unit]").innerText()).trim(), "tokens", "budget unit suffix");
        assert.equal(await budgetGroup.locator("[data-ltm-info]").count(), 0, "the budget has no (i) button");
        const linkedHint = recall.locator("[data-ltm-toggle-hint]").filter({ hasText: "linked to the ones found" });
        assert.equal(
          (await linkedHint.innerText()).trim(),
          "Also bring in memories linked to the ones found",
          "Linked memories shows its hint under the label",
        );
        assert.equal(await linkedHint.isVisible(), true);
        assert.equal(
          await recall.locator('[data-ltm-info="Linked memories"]').count(),
          0,
          "Linked memories has no (i)",
        );
        // Settings look. One scope line under the tabs replaces the tab's own title and intro, section headings are
        // sentence-case and the disclosure rows turn their chevron.
        assert.equal(
          (await recallPage.locator("[data-ltm-settings-reassurance]").innerText()).trim(),
          "Used by every chat unless it sets its own. The defaults suit most chats. Reset to defaults",
          "Settings states its scope once, with the Reset link",
        );
        assert.equal(await recall.locator("h3").count(), 0, "the Recall tab does not repeat its name as a heading");
        assert.equal(
          await inGroup("sharing")
            .locator("[data-ltm-group-heading]")
            .evaluate((node) => getComputedStyle(node).textTransform),
          "none",
          "group headings are sentence-case headings, not uppercase overlines",
        );
        assert.equal(
          await recall.locator("[data-ltm-recall-advanced] > summary [data-ltm-disclosure-chevron]").count(),
          1,
          "Advanced has a chevron",
        );
        assert.equal(
          await recallPage.locator("#settings-panel-troubleshooting > summary [data-ltm-disclosure-chevron]").count(),
          1,
          "Troubleshooting has a chevron",
        );
        const advancedRow = recall.locator("[data-ltm-recall-advanced] > summary");
        const advancedBox = await advancedRow.boundingBox();
        assert.ok(advancedBox, "Advanced row has a box");
        // The far right of the row is empty space; the whole row still toggles.
        await advancedRow.click({ position: { x: advancedBox.width - 8, y: advancedBox.height / 2 } });
        await recallPage.waitForTimeout(300);
        assert.equal(await advanced.evaluate((node) => (node as HTMLDetailsElement).open), true, "row click opens");
        assert.notEqual(
          await advancedRow
            .locator("[data-ltm-disclosure-chevron]")
            .evaluate((node) => getComputedStyle(node).transform),
          "none",
          "the chevron turns when open",
        );
        await advancedRow.click({ position: { x: advancedBox.width - 8, y: advancedBox.height / 2 } });
        await recallPage.waitForTimeout(300);
        assert.equal(await advanced.evaluate((node) => (node as HTMLDetailsElement).open), false, "row click closes");
        assert.equal(
          await advancedRow
            .locator("[data-ltm-disclosure-chevron]")
            .evaluate((node) => getComputedStyle(node).transform),
          "none",
          "the chevron resets when closed",
        );
        const budgetHint = recall.locator("[data-ltm-recall-budget-hint]");
        await openRecallAdvanced(recallPage);
        // The strictness slider says what its value means: the share a memory has to match, or that 0 is off.
        await advanced
          .getByText(/^(A memory must match the chat at least \d+% to be recalled|Off: any match can be recalled)$/u)
          .waitFor();
        const budgetField = recall.getByLabel("Memory budget", { exact: true });
        const savedBudget = await budgetField.inputValue();
        const savedHint = (await budgetHint.innerText()).trim();
        await budgetField.fill("1000");
        await budgetField.press("Enter");
        await budgetHint.getByText("About 11 memories per reply", { exact: true }).waitFor();
        await budgetField.fill(savedBudget);
        await budgetField.press("Enter");
        await budgetHint.getByText(savedHint, { exact: true }).waitFor();

        const style = recall.getByLabel("Recall style", { exact: true });
        const note = recall.locator("[data-ltm-recall-custom]");
        assert.equal((await note.innerText()).trim(), "", "no Custom note while a preset is in use");
        assert.equal(await recall.getByRole("button", { name: "Reset to preset" }).count(), 0);
        await style.selectOption("exact");
        // Choosing Custom by hand reveals the four weights, starting from the preset's own values.
        await style.selectOption("custom");
        assert.match(
          await note.innerText(),
          /Reset to preset returns to Exact\./u,
          "Custom from Exact resets to Exact",
        );
        const exactWeight = await recall.getByLabel("Meaning match", { exact: true }).inputValue();
        assert.equal(exactWeight, "0.105", "the weights start from the last preset's values");
        assert.equal(await recall.locator("[data-ltm-info]").count(), 0, "Recall settings have no (i) buttons");
        assert.equal(
          (await recall.getByLabel("Linked memories match", { exact: true }).getAttribute("aria-describedby")) !== null,
          true,
          "a weight's hint is read with its slider",
        );
        // Weights are sliders, which Playwright cannot fill: set the value the way a drag does.
        await recall.getByLabel("Meaning match", { exact: true }).evaluate((input, next) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, next);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }, "0.91");
        assert.equal(await style.inputValue(), "custom", "editing a weight flips the style to Custom");
        assert.match(await note.innerText(), /^Custom \(edited weights\)\. Reset to preset returns to Exact\./u);
        assert.equal(await note.getAttribute("role"), "status");
        const reset = recall.getByRole("button", { name: "Reset to preset" });
        assert.equal(
          await reset.evaluate((button) => button.getBoundingClientRect().height >= 44),
          true,
          "Reset to preset is a 2.75rem target",
        );
        await reset.click();
        assert.equal(await style.inputValue(), "exact", "Reset to preset restores the preset it came from");
        assert.equal((await note.innerText()).trim(), "", "the note clears once the preset is back");
        assert.equal(
          await recall.getByLabel("Meaning match", { exact: true }).count(),
          0,
          "the weights hide again once a preset is back",
        );
        // The restored weights are the preset's own: Custom shows them unedited.
        await style.selectOption("custom");
        assert.equal(await recall.getByLabel("Meaning match", { exact: true }).inputValue(), exactWeight);
        await recall.getByRole("button", { name: "Reset to preset" }).click();
        assert.equal(await style.inputValue(), "exact");
        // soup/settings-recall: the Linked memories switch is the "Linked memories match" weight above 0, and
        // changing it is a weight edit, so it shows the Custom note like any other. Exact has no link weight.
        const linkedSwitch = recall.getByRole("checkbox", { name: "Linked memories", exact: true });
        assert.equal(await linkedSwitch.isChecked(), false, "Exact recall uses no linked memories");
        await linkedSwitch.check();
        // The switch is a weight edit, so Custom shows the weights; the slider takes its value on the next render.
        const linkedWeight = await recall.getByLabel("Linked memories match", { exact: true }).elementHandle();
        await recallPage.waitForFunction(([input]) => (input as HTMLInputElement).value === "0.105", [
          linkedWeight,
        ] as const);
        assert.equal(await style.inputValue(), "custom", "turning links on is a weight edit");
        await recall.getByRole("button", { name: "Reset to preset" }).click();
        assert.equal(await style.inputValue(), "exact");
        assert.equal(await linkedSwitch.isChecked(), false, "Reset to preset restores the Exact link weight");
        // Balanced uses links: off then on over the untouched preset returns to Balanced, not Custom.
        await style.selectOption("balanced");
        await linkedSwitch.uncheck();
        assert.equal(await style.inputValue(), "custom");
        await linkedSwitch.check();
        assert.equal(await style.inputValue(), "balanced", "links back on over an untouched preset leaves no Custom");
        // Choosing Custom by hand, with no edit, still resets to the last preset. Balanced is the saved style,
        // so the form is clean again and Save goes quiet.
        await style.selectOption("balanced");
        await style.selectOption("custom");
        await recall.getByRole("button", { name: "Reset to preset" }).click();
        assert.equal(await style.inputValue(), "balanced", "choosing Custom by hand still resets to the last preset");
        await recallPage.locator('[data-ltm-save-state="clean"]').waitFor({ timeout: 5_000 });
        assert.equal(
          await recallPage.getByRole("button", { name: "Save settings" }).getAttribute("aria-disabled"),
          "true",
          "Reset to preset back to the saved preset leaves the form clean",
        );
        assert.equal(
          await recallPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
          true,
          `Recall has no horizontal overflow at ${width}px`,
        );
        await recallPage.close();
      }
      // #1659: a form saved as Custom takes the preset its weights are closest to (Balanced here). Picking Exact
      // and discarding must not leave "returns to Exact" behind.
      {
        const customPage = await browserContext.newPage();
        await customPage.setViewportSize({ width: 1280, height: 900 });
        await customPage.route("**/api/long-term-memory/settings", (route) =>
          route.request().method() === "GET"
            ? route.fulfill({ json: { longTermMemoryRecallStyle: "custom", longTermMemorySemanticWeight: 0.7 } })
            : route.continue(),
        );
        await customPage.goto(`http://127.0.0.1:${address.port}/`);
        await customPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await customPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await customPage.locator('[data-ltm-destination="settings"]:visible').first().click();
        const recall = customPage.locator("#settings-panel-recall");
        const note = recall.locator("[data-ltm-recall-custom]");
        await recall.getByText("Reset to preset returns to Balanced.", { exact: false }).waitFor();
        const style = recall.getByLabel("Recall style", { exact: true });
        assert.equal(await style.inputValue(), "custom");
        await style.selectOption("exact");
        await customPage.getByRole("button", { name: "Discard changes" }).click();
        await customPage.getByRole("button", { name: "Discard changes" }).waitFor({ state: "detached" });
        assert.equal(await style.inputValue(), "custom", "Discard returns to the saved Custom style");
        await recall.getByText("Reset to preset returns to Balanced.", { exact: false }).waitFor();
        assert.match(await note.innerText(), /returns to Balanced\./u, "the discarded pick is not remembered");
        await customPage.close();
      }
      // Background import: the card in Chat Settings lists what was saved since the last reply, what waits for review,
      // a read in progress and the messages an import hid, and a missing extraction connection is a warning with a
      // Choose button in Chat Settings and in Extraction.
      for (const scenario of [
        "connection-missing",
        "connection-chosen",
        "working",
        "review",
        "empty",
        "empty-save",
        "manual",
        "read-failed",
      ] as const) {
        const importPage = await browserContext.newPage();
        await importPage.setViewportSize({ width: 1280, height: 900 });
        const now = new Date().toISOString();
        const event = (fields: Record<string, unknown>) => ({
          id: crypto.randomUUID(),
          operationId: crypto.randomUUID(),
          phase: "import",
          action: "auto_import",
          chatId: "chat-import",
          ts: now,
          ...fields,
        });
        const events =
          scenario === "empty" || scenario === "empty-save"
            ? []
            : scenario === "review"
              ? // Nothing is saved on its own in review mode, so no event applied anything.
                [event({ status: "ok", counts: { imported: 2, failed: 0, applied: 0, skipped: 0 } })]
              : scenario === "working"
                ? [
                    event({ status: "ok", counts: { imported: 2, failed: 0, applied: 3, skipped: 1 } }),
                    event({ status: "ok", counts: { imported: 1, failed: 0, applied: 2, skipped: 0 } }),
                    event({ status: "ok", chatId: "other-chat", counts: { applied: 9 } }),
                    event({ status: "ok", ts: "2000-01-01T00:00:00.000Z", counts: { applied: 7 } }),
                    // Background import no longer reads summaries, so an old failure of that source must not stick.
                    event({
                      status: "error",
                      source: "chats",
                      ts: "2000-01-01T00:00:00.000Z",
                      error: { message: "No model", code: "ltm_model_configuration" },
                    }),
                  ]
                : scenario === "read-failed"
                  ? [
                      event({ status: "ok", source: "chats", ts: "2000-01-01T00:00:00.000Z" }),
                      // Saved before the failure; with the last recall unreadable nothing can be called new.
                      event({
                        status: "ok",
                        source: "messages",
                        ts: new Date(Date.now() - 5_000).toISOString(),
                        counts: { applied: 2 },
                      }),
                      event({
                        status: "error",
                        source: "messages",
                        error: { message: "Failed", code: "extraction_failed" },
                      }),
                    ]
                  : [event({ status: "error", error: { message: "No model", code: "ltm_model_configuration" } })];
        await importPage.route("**/api/long-term-memory/extraction-settings", (route) =>
          route.request().method() === "GET"
            ? route.fulfill({
                json: {
                  autoImportChatSources: scenario !== "manual",
                  autoAcceptSafeChanges: scenario === "working" || scenario === "empty-save",
                  connectionId: scenario === "connection-chosen" || scenario === "read-failed" ? "connection-1" : null,
                },
              })
            : route.continue(),
        );
        // What this chat's activity looks like now; the working scenario changes it later to play the next reply.
        const activity: {
          reading: boolean;
          hidden: { from: number; to: number; at: string } | null;
          recallAt: string;
        } = {
          reading: scenario === "review",
          hidden:
            scenario === "working"
              ? { from: 12, to: 25, at: new Date(Date.now() + 1_000).toISOString() }
              : scenario === "review"
                ? { from: 3, to: 3, at: new Date(Date.now() + 1_000).toISOString() }
                : null,
          recallAt: "2020-01-01T00:00:00.000Z",
        };
        await importPage.route("**/api/long-term-memory/chat-memories/*", (route) =>
          route.fulfill({ json: { chatMemories: null, reading: activity.reading, hidden: activity.hidden } }),
        );
        const retries: string[] = [];
        await importPage.route("**/api/long-term-memory/chat-memories/*/retry", (route) => {
          retries.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
          return route.fulfill({ status: 202, json: { scheduled: true } });
        });
        let eventReads = 0;
        await importPage.route("**/api/long-term-memory/debug-log?*", (route) => {
          eventReads += 1;
          return route.fulfill({ json: { events } });
        });
        // The save and set-up lines come from import events, so a failed receipt read must not hide them.
        await importPage.route("**/api/long-term-memory/last-injection/**", (route) =>
          scenario === "read-failed"
            ? route.fulfill({ status: 500, json: { error: "unavailable" } })
            : route.fulfill({
                json: {
                  memoryCount: 0,
                  tokenCount: 0,
                  memories: [],
                  state: "not_recorded",
                  dispatchedAt: activity.recallAt,
                  attempt: null,
                },
              }),
        );
        await importPage.route("**/api/long-term-memory/drafts/pending-count?*", (route) => {
          assert.match(route.request().url(), /chatId=chat-import/u, "the waiting count is for this chat");
          return route.fulfill({
            json: {
              count: scenario === "empty" || scenario === "empty-save" ? 0 : 4,
              mutations: scenario === "empty" || scenario === "empty-save" ? 0 : 4,
            },
          });
        });
        await importPage.goto(`http://127.0.0.1:${address.port}/`);
        await importPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await importPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "settings");
          element.capabilityProps = {
            chatId: "chat-import",
            onChatSettingsChange: () => {},
            onOpenAgentSettings: () => {
              const detail = document.createElement("marinara-capability-long-term-memory");
              detail.setAttribute("view", "detail");
              detail.capabilityProps = { chatId: "chat-import", confirmAction: () => true };
              document.body.append(detail);
            },
          };
          document.body.append(element);
        })()`);
        const importSettings = importPage.locator('[data-ltm-surface="chat-settings"]').last();
        await importSettings.waitFor();
        // The conversation surface keeps the Agent activity icon in step (Capability API 1.820): the Engine's
        // setPackageActivity is replaced by a recorder, since the host under test is older than the seam.
        await importPage.evaluate(`(async () => {
          const mountSurface = (id, chatId) => {
            const surface = document.createElement("marinara-capability-long-term-memory");
            surface.id = id;
            surface.setAttribute("view", "surface");
            surface.capabilityProps = { chatId };
            document.body.append(surface);
            return surface;
          };
          // Without the seam (an Engine older than 1.820) the surface mounts and says nothing, and leaving does not throw.
          const bare = mountSurface("ltm-activity-bare-surface", "chat-bare");
          await new Promise((resolve) => setTimeout(resolve, 300));
          bare.remove();
          await new Promise((resolve) => setTimeout(resolve, 50));
          window.activityCalls = [];
          window.__agentState = () => ({
            setPackageActivity: (...call) => window.activityCalls.push(JSON.stringify(call)),
          });
          mountSurface("ltm-activity-surface", "chat-import");
        })()`);
        const activityLit = (busy: boolean, alert: boolean) =>
          importPage.waitForFunction(
            (want) => (window as unknown as { activityCalls: string[] }).activityCalls.includes(want),
            JSON.stringify(["long-term-memory", "chat-import", { busy, alert }]),
            { timeout: 5_000 },
          );
        const activityLast = () =>
          importPage.evaluate(() => (window as unknown as { activityCalls: string[] }).activityCalls.at(-1) ?? null);
        const cardLines = importSettings.locator("[data-ltm-last-injection] [data-ltm-card-saved]");
        const lineText = async (kind: string) =>
          (await importSettings.locator(`[data-ltm-card-saved="${kind}"]`).innerText()).replace(/\s+/gu, " ").trim();
        // Every scenario's lines come from the events and the waiting count, so wait for both reads to land.
        const eventsLoaded = async () => {
          for (let tries = 0; tries < 100 && eventReads === 0; tries += 1) await importPage.waitForTimeout(50);
          await importPage.waitForTimeout(300);
        };
        const noDrawerLine = async () =>
          assert.equal(
            await importSettings.locator("[data-ltm-auto-import-status]").count(),
            0,
            "the drawer has no count line",
          );
        if (scenario === "working") {
          await importSettings.locator('[data-ltm-card-saved="review"]').waitFor({ timeout: 5_000 });
          await noDrawerLine();
          assert.equal(await lineText("review"), "4 memories to review Review");
          assert.equal(
            await lineText("new"),
            "Saved 5 new memories View",
            "only this chat's saves since the last reply, not the old or other chats'",
          );
          assert.equal(await lineText("hidden"), "Messages 12–25 saved as memories and hidden");
          assert.equal(
            await importSettings.locator('[data-ltm-card-saved="hidden"] button').count(),
            0,
            "the hidden line has no button",
          );
          assert.deepEqual(
            await cardLines.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-ltm-card-saved"))),
            ["review", "new", "hidden"],
          );
          assert.equal(await importSettings.locator("[data-ltm-connection-warning]").count(), 0);
          // The next reply: a read starts (the card says so), then a newer recall retires the saved and hidden lines.
          activity.reading = true;
          await importSettings.locator('[data-ltm-card-saved="reading"]').waitFor({ timeout: 15_000 });
          assert.equal(await lineText("reading"), "Reading new messages…");
          // The icon spins with the card's line and stops with it.
          await activityLit(true, false);
          activity.reading = false;
          activity.recallAt = new Date(Date.now() + 60_000).toISOString();
          await importSettings
            .locator('[data-ltm-card-saved="reading"]')
            .waitFor({ state: "detached", timeout: 15_000 });
          await importSettings
            .locator('[data-ltm-card-saved="hidden"]')
            .waitFor({ state: "detached", timeout: 15_000 });
          await importSettings.locator('[data-ltm-card-saved="new"]').waitFor({ state: "detached", timeout: 15_000 });
          await activityLit(false, false);
          assert.equal(await lineText("review"), "4 memories to review Review", "waiting memories stay");
          await importSettings
            .locator('[data-ltm-card-saved="review"]')
            .getByRole("button", { name: "Review", exact: true })
            .click();
          await importPage.locator('[data-ltm-destination="review"][aria-current="page"]:visible').first().waitFor({
            timeout: 5_000,
          });
        } else if (scenario === "review") {
          // Nothing saves on its own in review mode, so no saved line; one hidden message and a read in progress show.
          await importSettings.locator('[data-ltm-card-saved="review"]').waitFor({ timeout: 5_000 });
          assert.equal(await lineText("review"), "4 memories to review Review");
          assert.equal(await lineText("hidden"), "Message 3 saved as a memory and hidden");
          assert.equal(await lineText("reading"), "Reading new messages…");
          await noDrawerLine();
          assert.deepEqual(
            await cardLines.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-ltm-card-saved"))),
            ["review", "hidden", "reading"],
          );
        } else if (scenario === "empty" || scenario === "empty-save") {
          // Each line only when true: a chat with nothing to say shows no part 3 at all.
          await eventsLoaded();
          await noDrawerLine();
          assert.equal(await cardLines.count(), 0);
          assert.equal(
            await importSettings.getByRole("button", { name: "Review" }).count(),
            0,
            "Review only when something waits",
          );
        } else if (scenario === "manual") {
          const status = importSettings.locator("[data-ltm-auto-import-status]");
          await status.waitFor({ timeout: 5_000 });
          assert.match(await status.innerText(), /Nothing is added on its own/u);
          await status.getByRole("button", { name: "Import", exact: true }).click();
          await importPage.locator('[data-ltm-destination="sources"][aria-current="page"]:visible').first().waitFor({
            timeout: 5_000,
          });
        } else if (scenario === "read-failed") {
          // A provider error stops the background read: say so in this chat and offer one tap to try again.
          const failed = importSettings.locator("[data-ltm-last-injection] [data-ltm-auto-import-failed]");
          await failed.waitFor({ timeout: 5_000 });
          await activityLit(false, true);
          assert.match(await failed.innerText(), /Couldn't save new memories/u);
          await noDrawerLine();
          assert.equal(
            await importSettings.locator('[data-ltm-card-saved="new"]').count(),
            0,
            'no "new" count while the last recall is unreadable',
          );
          assert.equal(await importSettings.locator("[data-ltm-card-problem]").count(), 1, "at most one problem line");
          assert.equal(await importSettings.locator("[data-ltm-connection-warning]").count(), 0);
          await failed.getByRole("button", { name: "Retry", exact: true }).click();
          await failed.waitFor({ state: "detached", timeout: 5_000 });
          assert.deepEqual(retries, ["POST /api/long-term-memory/chat-memories/chat-import/retry"]);
          // Try again clears the dot the surface owns, the same moment it clears the card's line.
          await activityLit(false, false);
          assert.equal(
            await activityLast(),
            JSON.stringify(["long-term-memory", "chat-import", { busy: false, alert: false }]),
          );
        } else if (scenario === "connection-chosen") {
          await eventsLoaded();
          assert.equal(
            await importSettings.locator("[data-ltm-connection-warning]").count(),
            0,
            "a chosen connection hides the warning",
          );
        } else {
          const warning = importSettings.locator("[data-ltm-last-injection] [data-ltm-connection-warning]");
          await warning.waitFor({ timeout: 5_000 });
          assert.match(await warning.innerText(), /Not saving new memories/u);
          await warning.getByRole("button", { name: "Set up", exact: true }).click();
          await importPage.waitForFunction(
            () =>
              document.activeElement?.getAttribute("aria-labelledby")?.length &&
              document.activeElement.tagName === "SELECT",
          );
          assert.equal(
            await importPage.locator("#settings-tab-extraction").getAttribute("aria-selected"),
            "true",
            "Set up opens Extraction",
          );
          assert.equal(await importPage.locator("[data-ltm-connection-warning]").count(), 2);
        }
        if (scenario === "review") {
          await activityLit(true, false);
        } else if (scenario !== "read-failed" && scenario !== "working") {
          // Set-up, waiting reviews, a hide and a recall problem never light the icon.
          await importPage.waitForTimeout(300);
          assert.equal(
            await importPage.evaluate(
              () =>
                (window as unknown as { activityCalls: string[] }).activityCalls.filter((call) => /true/u.test(call))
                  .length,
            ),
            0,
            `${scenario}: the icon stays quiet`,
          );
        }
        // Leaving the chat clears the entry: the Engine never does.
        const callsBeforeLeaving = await importPage.evaluate(
          `(() => { const n = window.activityCalls.length; document.querySelector("#ltm-activity-surface").remove(); return n; })()`,
        );
        await importPage.waitForFunction(
          ([want, before]) => {
            const calls = (window as unknown as { activityCalls: string[] }).activityCalls;
            return calls.length > Number(before) && calls.at(-1) === want;
          },
          [JSON.stringify(["long-term-memory", "chat-import", { busy: false, alert: false }]), callsBeforeLeaving],
          { timeout: 5_000 },
        );
        await importPage.close();
      }
      // #1980: one "Memories from chats" choice. Chat Settings keeps a per-chat override with "Use the default for all chats",
      // and Extraction writes both stored switches from one select.
      {
        const memoriesPage = await browserContext.newPage();
        await memoriesPage.setViewportSize({ width: 1280, height: 900 });
        let stored: Record<string, unknown> = { autoImportChatSources: true, autoAcceptSafeChanges: false };
        const writes: Record<string, unknown>[] = [];
        let override: string | null = "save";
        const chatPatches: Record<string, unknown>[] = [];
        await memoriesPage.route("**/api/long-term-memory/extraction-settings", (route) => {
          if (route.request().method() !== "PUT") return route.fulfill({ json: stored });
          const body = route.request().postDataJSON() as Record<string, unknown>;
          writes.push(body);
          stored = { ...stored, ...body };
          return route.fulfill({ json: stored });
        });
        await memoriesPage.route("**/api/long-term-memory/chat-memories/*", (route) => {
          assert.match(route.request().url(), /chat-memories\/chat-memories$/u, "the choice is read for this chat");
          return route.fulfill({ json: { chatMemories: override } });
        });
        await memoriesPage.exposeFunction("onMemoriesChatPatch", (patch: Record<string, unknown>) => {
          chatPatches.push(patch);
          if ("longTermMemoryChatMemories" in patch) override = patch.longTermMemoryChatMemories as string | null;
        });
        await memoriesPage.goto(`http://127.0.0.1:${address.port}/`);
        await memoriesPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await memoriesPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "settings");
          element.capabilityProps = {
            chatId: "chat-memories",
            onChatSettingsChange: (patch) => window.onMemoriesChatPatch(patch),
          };
          document.body.append(element);
        })()`);
        const memoriesField = memoriesPage.locator('[data-ltm-surface="chat-settings"] [data-ltm-chat-memories-field]');
        const chatChoice = memoriesField.locator('[data-ltm-chat-memories="chat"]');
        const chatChoiceIs = (value: string) =>
          memoriesPage.waitForFunction(
            (want) =>
              (document.querySelector('[data-ltm-chat-memories="chat"]') as HTMLSelectElement | null)?.value === want,
            value,
            { timeout: 5_000 },
          );
        await chatChoiceIs("save");
        assert.equal(
          await memoriesPage.evaluate(() => {
            const panel = document.querySelector('[data-ltm-surface="chat-settings"]')!;
            // The activity card tops the section; the first control after it is Memories from this chat.
            const controls = [...panel.children].filter((child) => !child.hasAttribute("data-ltm-activity-card"));
            return controls[0]?.hasAttribute("data-ltm-chat-memories-field");
          }),
          true,
          "Memories from this chat comes first among the controls, after the card",
        );
        assert.equal(await memoriesField.getByText("Default for all chats", { exact: true }).count(), 0);
        await memoriesField.getByRole("button", { name: "Use the default for all chats" }).click();
        // With no override the chat shows the global choice: import on, accept off is "Collect them, I'll review".
        await chatChoiceIs("review");
        await memoriesField.getByText("Default for all chats", { exact: true }).waitFor({ timeout: 5_000 });
        assert.deepEqual(chatPatches.at(-1), { longTermMemoryChatMemories: null });
        await chatChoice.selectOption("manual");
        await memoriesField.getByRole("button", { name: "Use the default for all chats" }).waitFor({ timeout: 5_000 });
        assert.deepEqual(chatPatches.at(-1), { longTermMemoryChatMemories: "manual" });
        assert.equal(writes.length, 0, "a chat's choice never writes the global settings");
        await memoriesPage.evaluate(`(() => {
          document.body.replaceChildren();
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await memoriesPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        await memoriesPage.locator("#settings-tab-extraction").click();
        const globalChoice = memoriesPage.locator('[data-ltm-chat-memories="global"]');
        await globalChoice.waitFor({ timeout: 5_000 });
        assert.equal(await globalChoice.inputValue(), "review");
        await globalChoice.selectOption("save");
        await memoriesPage
          .locator('#settings-panel-extraction [data-ltm-chat-memories-sample="save"]')
          .getByText("2 saved", { exact: true })
          .waitFor({ timeout: 5_000 });
        await memoriesPage.getByRole("button", { name: "Save settings" }).click();
        await memoriesPage.locator('[data-ltm-save-state="saved"]').waitFor({ timeout: 5_000 });
        assert.equal(writes.at(-1)?.autoImportChatSources, true);
        assert.equal(writes.at(-1)?.autoAcceptSafeChanges, true, "Save them for me turns on both switches");
        await globalChoice.selectOption("manual");
        await memoriesPage.getByRole("button", { name: "Save settings" }).click();
        await memoriesPage.locator('[data-ltm-save-state="saved"]').waitFor({ timeout: 5_000 });
        assert.equal(writes.at(-1)?.autoImportChatSources, false);
        assert.equal(writes.at(-1)?.autoAcceptSafeChanges, false, "I add them myself turns off both switches");
        await memoriesPage.close();
      }
      // Item 8: a branch chat's "Show" opens this chat's own memories every time (never a remembered place or filter),
      // and a row's "From branch" chip narrows the list to that branch until "Show all".
      {
        const branchPage = await browserContext.newPage();
        await branchPage.setViewportSize({ width: 1280, height: 900 });
        const inheritedIds = { "branch-a": "world_second_mobile", "branch-b": "world_merge_target_mobile" };
        await branchPage.route("**/api/long-term-memory/branch-memories/desktop-chat", (route) =>
          route.fulfill({
            json: {
              branches: [
                { chatId: "branch-a", name: "Branch A", noteIds: [inheritedIds["branch-a"]] },
                { chatId: "branch-b", name: "Branch B", noteIds: [inheritedIds["branch-b"]] },
              ],
            },
          }),
        );
        // The chat's own scope leaves out what its other branches added, so those arrive as inherited memories.
        await branchPage.route(
          (url) =>
            url.pathname.endsWith("/api/long-term-memory/notes") &&
            url.searchParams.get("scopeChatIds") === "desktop-chat",
          async (route) => {
            const response = await route.fetch();
            const held = new Set(Object.values(inheritedIds));
            await route.fulfill({
              response,
              json: ((await response.json()) as { id: string }[]).filter((note) => !held.has(note.id)),
            });
          },
        );
        await branchPage.route("**/api/long-term-memory/chat-memories/*", (route) =>
          route.fulfill({ json: { chatMemories: null } }),
        );
        await branchPage.goto(`http://127.0.0.1:${address.port}/`);
        await branchPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        const mountBranchPage = (view: "detail" | "settings") =>
          branchPage.evaluate(
            `(() => {
              document.body.replaceChildren();
              const element = document.createElement("marinara-capability-long-term-memory");
              element.setAttribute("view", ${JSON.stringify(view)});
              const chat = { chatId: "desktop-chat", chatName: "desktop chat", chatMode: "conversation", enabledForChat: true };
              element.capabilityProps = Object.assign({ confirmAction: () => true, onChatSettingsChange: () => {} }, chat, ${JSON.stringify(view)} === "settings" ? {
                onOpenAgentSettings: () => {
                  const detail = document.createElement("marinara-capability-long-term-memory");
                  detail.setAttribute("view", "detail");
                  detail.capabilityProps = Object.assign({ confirmAction: () => true }, chat);
                  document.body.replaceChildren(detail);
                },
              } : {});
              document.body.append(element);
            })()`,
          );
        // Open the Vault on "All" first, so a remembered place is waiting when Show is tapped.
        await mountBranchPage("detail");
        await branchPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
        const branchScope = branchPage.locator('[data-ltm-scope-picker="vault"]');
        await branchScope.locator("[data-ltm-scope-picker-trigger]").click();
        await branchScope.locator('[data-ltm-scope-option="all"]').click();
        await branchPage.locator("[data-ltm-note-id]").first().waitFor({ timeout: 5_000 });
        assert.equal(await branchPage.locator("[data-ltm-row-from-branch]").count(), 0, "All lists no branch chips");
        // Chat Settings → Show: this chat's place, inherited rows listed, no filter.
        await mountBranchPage("settings");
        await branchPage
          .locator('[data-ltm-branch-memories="branch-a"]')
          .getByRole("button", { name: "Show", exact: true })
          .click();
        await branchPage.locator('[data-ltm-surface="detail"]').waitFor({ timeout: 5_000 });
        assert.equal(
          await branchPage
            .locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]')
            .getAttribute("aria-current"),
          "page",
          "Show lands on the Vault",
        );
        const chipA = branchPage.locator('[data-ltm-row-from-branch="branch-a"]');
        await chipA.waitFor({ timeout: 5_000 });
        assert.equal(await branchPage.locator("[data-ltm-branch-filter]").count(), 0, "Show opens with no filter");
        assert.equal(await branchPage.locator('[data-ltm-row-from-branch="branch-b"]').count(), 1);
        assert.match(
          await branchPage.locator("[data-ltm-memory-scope]").innerText(),
          /^Currently viewing memories in:\s*Current\b/u,
          "the place is this chat",
        );
        // The chip is a real button of its own (not inside the row's open button), 44px tall, named for what it does.
        assert.equal(
          await chipA.evaluate((chip) => chip.tagName === "BUTTON" && chip.parentElement?.closest("button") === null),
          true,
        );
        assert.ok((await chipA.boundingBox())!.height >= 44, "a 44px touch target");
        assert.equal(await chipA.getAttribute("aria-label"), "From branch Branch A: show only its memories");
        const allRows = await branchPage.locator("[data-ltm-note-id]").count();
        await chipA.click();
        const bar = branchPage.locator('[data-ltm-branch-filter="branch-a"]');
        await bar.waitFor({ timeout: 5_000 });
        assert.match(await bar.innerText(), /Showing memories from branch Branch A/u);
        await branchPage.waitForFunction(() => document.activeElement?.closest("[data-ltm-branch-filter]"));
        assert.deepEqual(
          await branchPage
            .locator("[data-ltm-note-id]")
            .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-ltm-note-id"))),
          [inheritedIds["branch-a"]],
          "only that branch's memories",
        );
        await bar.getByRole("button", { name: "Show all", exact: true }).click();
        await bar.waitFor({ state: "detached", timeout: 5_000 });
        await branchPage.waitForFunction(() =>
          document.activeElement?.matches('[data-ltm-row-from-branch="branch-a"]'),
        );
        assert.equal(await branchPage.locator("[data-ltm-note-id]").count(), allRows, "Show all restores the list");
        await branchPage.close();
      }
      // Item 9: Activity is its own page in the memory workspace, with its "Record recall explanations" switch on it.
      {
        const activityPage = await browserContext.newPage();
        await activityPage.setViewportSize({ width: 1280, height: 900 });
        const recordWrites: unknown[] = [];
        const activityAttemptId = "recall";
        let recordDebug = false;
        await activityPage.route("**/api/long-term-memory/settings", async (route) => {
          if (route.request().method() === "PUT") {
            const body = route.request().postDataJSON() as { longTermMemoryDebug: boolean };
            recordWrites.push(body);
            recordDebug = body.longTermMemoryDebug;
            return route.fulfill({ json: body });
          }
          if (route.request().method() !== "GET") return route.continue();
          const response = await route.fetch();
          return route.fulfill({ response, json: { ...(await response.json()), longTermMemoryDebug: recordDebug } });
        });
        await activityPage.route("**/api/long-term-memory/debug-log?*", (route) => {
          const query = new URL(route.request().url()).searchParams;
          if (query.has("phase")) return route.fulfill({ json: { events: [] } });
          const operationId = query.get("operationId");
          return route.fulfill({
            json: {
              events: debugEvents.filter(
                (event) => !operationId || (event as { operationId?: string }).operationId === operationId,
              ),
            },
          });
        });
        await activityPage.route("**/api/long-term-memory/last-injection/**", (route) =>
          route.fulfill({
            json: {
              memoryCount: 1,
              tokenCount: 42,
              memories: [{ noteId: "world_legacy_global", title: "Legacy global memory", tokenCount: 42 }],
              state: "injected",
              dispatchedAt: "2026-07-30T00:00:00.000Z",
              attempt: {
                version: 1,
                chatId: "chat-artifact",
                attemptId: activityAttemptId,
                at: "2026-07-30T00:00:00.000Z",
                outcome: "completed",
                debugEnabled: true,
                confirmed: true,
              },
            },
          }),
        );
        await activityPage.goto(`http://127.0.0.1:${address.port}/`);
        await activityPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await activityPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        const destinationIds = (navigation: "desktop" | "mobile") =>
          activityPage
            .locator(`[data-ltm-navigation="${navigation}"] [data-ltm-destination]`)
            .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-ltm-destination")));
        const fiveDestinations = ["vault", "review", "sources", "activity", "settings"];
        assert.deepEqual(
          await destinationIds("desktop"),
          fiveDestinations,
          "desktop navigation lists five destinations",
        );
        assert.deepEqual(await destinationIds("mobile"), fiveDestinations, "mobile navigation lists five destinations");
        // The five-tab rail fits a 390px phone with no horizontal scroll and 44px tabs.
        await activityPage.setViewportSize({ width: 390, height: 844 });
        assert.deepEqual(
          await activityPage.evaluate(() => {
            const tabs = [...document.querySelectorAll('[data-ltm-navigation="mobile"] [data-ltm-destination]')];
            const rail = document.querySelector('[data-ltm-navigation="mobile"]')!;
            return {
              pageFits: document.documentElement.scrollWidth <= window.innerWidth,
              railFits: rail.scrollWidth <= rail.clientWidth + 1,
              tabs: tabs.length,
              tallEnough: Math.min(...tabs.map((tab) => tab.getBoundingClientRect().height)) >= 43.5,
            };
          }),
          { pageFits: true, railFits: true, tabs: 5, tallEnough: true },
          "the five-tab mobile rail fits 390px",
        );
        await activityPage.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="activity"]').click();
        await activityPage.locator('[data-ltm-surface="activity"]').waitFor();
        assert.equal(
          await activityPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          true,
          "Activity has no horizontal scroll at 390px",
        );
        await activityPage.setViewportSize({ width: 1280, height: 900 });
        // Activity shows the log with the record switch above it, and the switch saves on its own.
        const recordRow = activityPage.locator("[data-ltm-activity-record]");
        await recordRow.waitFor();
        await activityPage.locator('[data-ltm-surface="activity"] [data-ltm-debug-operation]').first().waitFor();
        const recordSwitch = recordRow.getByLabel("Record recall explanations");
        assert.equal(await recordSwitch.isChecked(), false);
        assert.equal(
          await activityPage.getByText("Settings →", { exact: false }).count(),
          0,
          "the switch hint carries no path copy",
        );
        await recordSwitch.click();
        // Settled: the save finished (no aria-disabled) and the refetch shows the saved value.
        await activityPage.waitForFunction(() => {
          const input = document.querySelector<HTMLInputElement>("[data-ltm-activity-record] input");
          return input?.checked === true && !input.hasAttribute("aria-disabled");
        });
        assert.deepEqual(recordWrites, [{ longTermMemoryDebug: true }], "one PUT, no Save");
        assert.equal(
          await activityPage.getByRole("button", { name: "Save settings" }).count(),
          0,
          "the switch needs no Save",
        );
        // Settings has no record switch under Recall, and Troubleshooting has no activity log.
        await activityPage.locator('[data-ltm-destination="settings"]:visible').first().click();
        await activityPage.locator('[data-ltm-surface="memory-settings"]').waitFor();
        await activityPage.locator("#settings-tab-recall").click();
        await openRecallAdvanced(activityPage);
        assert.equal(await activityPage.getByText("Record recall explanations", { exact: true }).count(), 0);
        await openTroubleshooting(activityPage);
        assert.equal(await activityPage.locator("[data-ltm-activity-log]").count(), 0);
        // The Activity page's Recall settings link opens Settings on the Recall tab.
        await openActivityLog(activityPage);
        await activityPage.locator('[data-ltm-debug-operation="recall-rejected"]').click();
        await activityPage.getByRole("button", { name: "Open Recall settings" }).click();
        await activityPage.locator("#settings-panel-recall").waitFor();
        assert.equal(
          await activityPage.locator("#settings-tab-recall").getAttribute("aria-selected"),
          "true",
          "Recall settings opens the Recall tab",
        );
        // Chat drawer: the card's Open lands on the Memory Vault.
        await activityPage.evaluate(`(() => {
          document.body.replaceChildren();
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "settings");
          element.capabilityProps = {
            chatId: "chat-artifact",
            onChatSettingsChange: () => {},
            onOpenAgentSettings: () => {
              const detail = document.createElement("marinara-capability-long-term-memory");
              detail.setAttribute("view", "detail");
              detail.capabilityProps = { chatId: "chat-artifact", confirmAction: () => true };
              document.body.replaceChildren(detail);
            },
          };
          document.body.append(element);
        })()`);
        // The card's Open lands on the Memory Vault.
        await activityPage.locator("[data-ltm-last-injection] [data-ltm-card-open]").click();
        await activityPage.locator('[data-ltm-surface="vault"]').first().waitFor({ timeout: 5_000 });
        await activityPage.close();
      }
      // Item 10: "What model to use?" is a stacked list on a phone (labelled stars, no sideways scroll) and the same
      // table at 640px and up.
      {
        const modelPage = await browserContext.newPage();
        await modelPage.setViewportSize({ width: 390, height: 844 });
        await modelPage.goto(`http://127.0.0.1:${address.port}/`);
        await modelPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await modelPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await modelPage.locator('[data-ltm-destination="settings"]:visible').first().click();
        await modelPage.locator("#settings-tab-extraction").click();
        await modelPage.locator("[data-ltm-what-model-button]").click();
        const dialog = modelPage.locator("[data-ltm-what-model-dialog]");
        await dialog.waitFor();
        const panel = dialog.locator("section").first();
        const fits = (tab: string) =>
          modelPage.evaluate((name) => {
            const panelBox = document.querySelector("[data-ltm-what-model-dialog] section")!.getBoundingClientRect();
            const scope = document.querySelector(`[data-ltm-what-model-panel="${name}"]`)!;
            const table = scope.querySelector<HTMLElement>("[data-ltm-what-model-table]")!;
            const wrapper = table.parentElement!;
            const section = document.querySelector<HTMLElement>("[data-ltm-what-model-dialog] section")!;
            const row = scope.querySelector<HTMLElement>("[data-ltm-what-model-row]")!;
            const why = row.lastElementChild!.getBoundingClientRect();
            const labels = [...row.querySelectorAll<HTMLElement>("[data-ltm-what-model-score-label]")];
            const other = scope.querySelector<HTMLElement>("[data-ltm-what-model-other]")!;
            return {
              panelFits: section.scrollWidth <= section.clientWidth + 1,
              wrapperFits: wrapper.scrollWidth <= wrapper.clientWidth + 1,
              tableFits: table.getBoundingClientRect().right <= panelBox.right + 1,
              whyInside: why.right <= panelBox.right && why.width > 0,
              theadShown: getComputedStyle(scope.querySelector("thead")!).display !== "none",
              labels: labels.map((label) => ({
                text: label.textContent?.trim(),
                shown: getComputedStyle(label).display !== "none",
              })),
              otherStacked:
                other.querySelector("th")!.getBoundingClientRect().bottom <=
                other.querySelector("td:last-child")!.getBoundingClientRect().top + 1,
              pageFits: document.documentElement.scrollWidth <= window.innerWidth,
            };
          }, tab);
        assert.deepEqual(
          await fits("hosted"),
          {
            panelFits: true,
            wrapperFits: true,
            tableFits: true,
            whyInside: true,
            theadShown: false,
            labels: [
              { text: "Quality", shown: true },
              { text: "Speed", shown: true },
              { text: "Low cost", shown: true },
            ],
            otherStacked: true,
            pageFits: true,
          },
          "hosted ranking is a stacked list at 390px",
        );
        const firstRow = dialog.locator('[data-ltm-what-model-panel="hosted"] [data-ltm-what-model-row]').first();
        const stackBox = await firstRow.evaluate((row) => {
          const [rank, name, ...rest] = [...row.children].map((cell) => cell.getBoundingClientRect());
          const scores = rest.slice(0, -1);
          const why = rest.at(-1)!;
          return {
            nameBesideRank: Math.abs(name!.top - rank!.top) < 8,
            scoresBelowName: scores.every((score) => score.top >= name!.bottom - 1),
            // At 390px the three labelled scores share one line, left to right.
            scoresShareALine: scores.every(
              (score, index) =>
                index === 0 || (Math.abs(score.top - scores[0]!.top) < 4 && score.left >= scores[index - 1]!.right - 1),
            ),
            whyBelowScores: why.top >= Math.max(...scores.map((score) => score.bottom)) - 1,
            whyIndented: why.left >= name!.left - 1,
          };
        });
        assert.deepEqual(
          stackBox,
          {
            nameBesideRank: true,
            scoresBelowName: true,
            scoresShareALine: true,
            whyBelowScores: true,
            whyIndented: true,
          },
          "a model reads rank + name, scores on one line, then why",
        );
        // The screen reader still hears the score's number after its label.
        assert.match(
          (await firstRow.locator("[data-ltm-what-model-score]").first().innerText()) +
            (await firstRow.locator("[data-ltm-what-model-score] .sr-only").first().textContent()),
          /Quality[\s\S]*8 out of 10/u,
        );
        // The panel is solid: the settings page behind it does not show through.
        assert.equal(
          await dialog.evaluate((element) => {
            const color = getComputedStyle(element.querySelector("section")!).backgroundColor;
            const alpha = /rgba?\([^)]*?,\s*([\d.]+)\)$/u.exec(color)?.[1];
            return color.startsWith("rgb(") || (alpha !== undefined && Number(alpha) === 1);
          }),
          true,
          "the dialog panel has an opaque background",
        );
        // The first row keeps its tint and the rows keep their borders.
        assert.notEqual(await firstRow.evaluate((row) => getComputedStyle(row).backgroundColor), "rgba(0, 0, 0, 0)");
        assert.notEqual(await firstRow.evaluate((row) => getComputedStyle(row).borderBottomWidth), "0px");
        // The tab rail and Close stay 44px tall inside the panel.
        assert.equal(
          await dialog.evaluate((element) =>
            [...element.querySelectorAll("[data-ltm-what-model-tab], [data-ltm-what-model-close]")].every(
              (control) =>
                control.getBoundingClientRect().height >= 43.5 &&
                control.getBoundingClientRect().right <=
                  element.querySelector("section")!.getBoundingClientRect().right,
            ),
          ),
          true,
          "tabs and Close are 44px tall and inside the panel",
        );
        if (visualOutputDir)
          await modelPage.screenshot({ path: join(visualOutputDir, "long-term-memory-what-model-mobile.png") });
        await dialog.locator('[data-ltm-what-model-tab="selfHost"]').click();
        const selfHost = await fits("selfHost");
        assert.deepEqual(
          selfHost,
          {
            panelFits: true,
            wrapperFits: true,
            tableFits: true,
            whyInside: true,
            theadShown: false,
            labels: [{ text: "Quality", shown: true }],
            otherStacked: true,
            pageFits: true,
          },
          "self-host ranking is a stacked list at 390px with Quality only",
        );
        assert.ok((await panel.boundingBox())!.width <= 390);
        // 640px and up: the same table as before, header visible and the score labels hidden.
        await modelPage.setViewportSize({ width: 1280, height: 900 });
        const wide = await modelPage.evaluate(() => {
          const scope = document.querySelector('[data-ltm-what-model-panel="hosted"]')!;
          const table = scope.querySelector<HTMLElement>("[data-ltm-what-model-table]")!;
          return {
            theadShown: getComputedStyle(scope.querySelector("thead")!).display !== "none",
            labelsHidden: [...scope.querySelectorAll("[data-ltm-what-model-score-label]")].every(
              (label) => getComputedStyle(label).display === "none",
            ),
            tableDisplay: getComputedStyle(table).display,
            minWidth:
              getComputedStyle(table).minWidth ===
              `${parseFloat(getComputedStyle(document.documentElement).fontSize) * 40}px`,
          };
        });
        assert.deepEqual(
          wide,
          { theadShown: true, labelsHidden: true, tableDisplay: "table", minWidth: true },
          "the wide table is unchanged",
        );
        await modelPage.close();
      }
      // #1659 / S-6: a form saved as Custom names the preset its weights are closest to, so Reset to preset after Save
      // agrees with a reload and a tweaked Story stays Story.
      {
        const savePage = await browserContext.newPage();
        await savePage.setViewportSize({ width: 1280, height: 900 });
        await savePage.route("**/api/long-term-memory/settings", (route) =>
          route.request().method() === "PUT"
            ? route.fulfill({ json: route.request().postDataJSON() })
            : route.continue(),
        );
        await savePage.goto(`http://127.0.0.1:${address.port}/`);
        await savePage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await savePage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await savePage.locator('[data-ltm-destination="settings"]:visible').first().click();
        const recall = savePage.locator("#settings-panel-recall");
        const style = recall.getByLabel("Recall style", { exact: true });
        await style.selectOption("story");
        await style.selectOption("custom");
        // Weights are sliders, which Playwright cannot fill: set the value the way a drag does.
        await recall.getByLabel("Meaning match", { exact: true }).evaluate((input, next) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, next);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }, "0.91");
        await recall.getByText("Reset to preset returns to Story.", { exact: false }).waitFor();
        await savePage.getByRole("button", { name: "Save settings" }).click();
        await savePage.locator('[data-ltm-save-state="saved"]').waitFor({ timeout: 5_000 });
        assert.equal(await style.inputValue(), "custom", "the saved form stays Custom");
        // S-6: a saved Custom form names the preset its weights are closest to, so a Story tweak still resets to
        // Story after Save (and after a reload, which reads the same weights).
        await recall.getByText("Reset to preset returns to Story.", { exact: false }).waitFor();
        await savePage.waitForTimeout(250); // the restart effect runs after the save commits
        // The note was already there before Save, so prove the behaviour: the button restores Story's weights.
        await recall.getByRole("button", { name: "Reset to preset" }).click();
        assert.equal(await style.inputValue(), "story", "Reset to preset after Save returns to Story");
        await savePage.close();
      }
      // soup/settings-sharing: one row per Agent. Add Agent adds a row that can read but not add, toggling one
      // Agent's Can add leaves the others, the save writes only the per-Agent map, and turning on Slurp's add
      // asks about the matching switch in Slurp right away, applying a yes only once Save succeeds.
      {
        const sharingPage = await browserContext.newPage();
        await sharingPage.setViewportSize({ width: 1280, height: 900 });
        const settingsWrites: Record<string, unknown>[] = [];
        const slurpPatches: unknown[] = [];
        await sharingPage.route("**/api/long-term-memory/settings", (route) => {
          if (route.request().method() !== "PUT")
            return route.fulfill({ json: { longTermMemoryPackageAccess: { slurp2: { read: true, add: false } } } });
          const body = route.request().postDataJSON() as Record<string, unknown>;
          settingsWrites.push(body);
          return route.fulfill({ json: body });
        });
        await sharingPage.route("**/api/long-term-memory/settings/package-readers", (route) =>
          route.fulfill({
            json: { readers: [{ caller: "slurp2", lastReadAt: null, reads: 3, memories: 7, added: 1 }] },
          }),
        );
        await sharingPage.route("**/api/capability-packages/installed", (route) =>
          route.fulfill({
            json: [
              { id: "slurp2", manifest: { name: "Slurp" } },
              { id: "noodle", manifest: { name: "Noodle" } },
            ],
          }),
        );
        await sharingPage.route("**/api/slurp2/settings", (route) => {
          if (route.request().method() === "PATCH") {
            slurpPatches.push(route.request().postDataJSON());
            return route.fulfill({ json: {} });
          }
          return route.fulfill({ json: { flavourFromAgents: true, shareWithMemory: false } });
        });
        await sharingPage.goto(`http://127.0.0.1:${address.port}/`);
        await sharingPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await sharingPage.evaluate(`(() => {
          window.__ltmConfirms = [];
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: (options) => { window.__ltmConfirms.push(options); return true; } };
          document.body.append(element);
        })()`);
        await sharingPage.locator('[data-ltm-destination="settings"]:visible').first().click();
        const sharing = sharingPage.locator('#settings-panel-recall [data-ltm-recall-group="sharing"]');
        const table = sharing.getByRole("table", { name: "Agents that share memories" });
        await table.waitFor();
        const slurpRow = table.locator('[data-ltm-sharing-agent="slurp2"]');
        await slurpRow.getByText("This week: read 3× · 7 returned · 1 added", { exact: true }).waitFor();
        assert.equal(await sharing.getByText("Other Agents can read memories", { exact: true }).count(), 0);
        assert.equal(await sharing.getByText("What other Agents read and added", { exact: true }).count(), 0);
        const slurpAdd = table.getByRole("switch", { name: "Slurp can add memories", exact: true });
        const confirmsReach = (count: number) =>
          sharingPage.waitForFunction(
            (expected) => (window as unknown as { __ltmConfirms: unknown[] }).__ltmConfirms.length === expected,
            count,
          );
        const offersSoFar = () =>
          sharingPage.evaluate(() => (window as unknown as { __ltmConfirms: Array<{ title: string }> }).__ltmConfirms);
        // "Can add" says what it does, and the switch points at that line.
        const hintId = await slurpAdd.getAttribute("aria-describedby");
        assert.ok(hintId, "Can add is described by its hint");
        assert.match(
          await sharingPage.locator(`[id="${hintId}"]`).innerText(),
          /Can add lets an Agent save its own memories here\.$/u,
        );
        // The Slurp question is asked when the switch is flipped, not at Save, and changes nothing yet.
        await slurpAdd.check();
        await confirmsReach(1);
        assert.equal((await offersSoFar()).length, 1, "the Slurp question shows as the switch turns on");
        assert.deepEqual(slurpPatches, [], "a yes applies nothing before Save");
        // Discard after a yes applies nothing, and the next switch-on asks again.
        await sharingPage.getByRole("button", { name: "Discard changes", exact: true }).click();
        await confirmsReach(2);
        await slurpAdd.waitFor();
        assert.equal(await slurpAdd.isChecked(), false, "Discard turns the switch back off");
        assert.deepEqual(slurpPatches, [], "Discard after a yes applies nothing");
        assert.equal(settingsWrites.length, 0, "Discard writes no settings");
        await sharing.getByRole("button", { name: "Add Agent", exact: true }).click();
        await sharing.getByRole("button", { name: "Noodle", exact: true }).click();
        const noodleRead = table.getByRole("switch", { name: "Noodle can read memories", exact: true });
        await noodleRead.waitFor();
        assert.equal(await noodleRead.isChecked(), true, "a new row can read");
        assert.equal(
          await noodleRead.evaluate((input) => getComputedStyle(input).appearance),
          "none",
          "sharing cells draw as switches",
        );
        assert.equal(
          await noodleRead.evaluate((input) => (input.parentElement?.getBoundingClientRect().height ?? 0) >= 44),
          true,
          "each switch keeps a 2.75rem target",
        );
        assert.equal(
          await noodleRead.evaluate((element) => element === document.activeElement),
          true,
          "the new row's first switch takes focus",
        );
        const noodleRow = table.locator('[data-ltm-sharing-agent="noodle"]');
        assert.equal(await noodleRow.getByText("Not offered", { exact: true }).count(), 1, "Noodle cannot add");
        await sharing.getByRole("button", { name: "Add Agent", exact: true }).click();
        await sharing.getByText("No other installed Agent can be added.", { exact: true }).waitFor();
        await slurpAdd.check();
        await confirmsReach(3);
        assert.equal((await offersSoFar()).length, 3, "turning it on again asks again (Slurp, Discard, Slurp)");
        assert.equal(await noodleRead.isChecked(), true, "toggling Slurp's add leaves Noodle's row");
        assert.equal(
          await table.getByRole("switch", { name: "Slurp can read memories", exact: true }).isChecked(),
          true,
          "toggling Slurp's add leaves its read",
        );
        const slurpPatch = sharingPage.waitForRequest(
          (request) => request.method() === "PATCH" && request.url().endsWith("/api/slurp2/settings"),
        );
        await sharingPage.getByRole("button", { name: "Save settings" }).click();
        await slurpPatch;
        assert.deepEqual(settingsWrites.at(-1)?.longTermMemoryPackageAccess, {
          noodle: { read: true, add: false },
          slurp2: { read: true, add: true },
        });
        assert.equal("longTermMemoryShareWithPackages" in (settingsWrites.at(-1) ?? {}), false);
        assert.equal("longTermMemoryAcceptFromPackages" in (settingsWrites.at(-1) ?? {}), false);
        // Slurp could already read, so only the add question was ever asked.
        assert.equal((await offersSoFar()).length, 3, "Save asks nothing more");
        assert.deepEqual(slurpPatches, [{ shareWithMemory: true }], "Save applies the yes once");
        await sharingPage.close();
      }
      // soup/settings-save: one save model for both tabs. A changed select shows the unsaved cue and enables Save,
      // "Edit instructions" opens the template its mode uses, and Duplicate selects the copy and says so.
      {
        const savePage = await browserContext.newPage();
        await savePage.setViewportSize({ width: 1280, height: 900 });
        let stored: Record<string, unknown> = {
          promptTemplates: [
            { id: "template_story", name: "Story beats", prompt: "Keep story beats." },
            { id: "template_game", name: "Quest log", prompt: "Keep quests." },
          ],
          activePromptTemplateIdsByMode: { conversation: null, roleplay: "template_story", game: "template_game" },
        };
        const writes: Record<string, unknown>[] = [];
        await savePage.route("**/api/long-term-memory/extraction-settings", (route) => {
          if (route.request().method() !== "PUT") return route.fulfill({ json: stored });
          const body = route.request().postDataJSON() as Record<string, unknown>;
          writes.push(body);
          stored = { ...stored, ...body };
          return route.fulfill({ json: stored });
        });
        await savePage.goto(`http://127.0.0.1:${address.port}/`);
        await savePage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await savePage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await savePage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        await savePage.locator("#settings-tab-extraction").click();
        const extraction = savePage.locator("#settings-panel-extraction");
        const saveState = savePage.locator("[data-ltm-save-state]");
        const saveButton = savePage.getByRole("button", { name: "Save settings" });
        await saveState.waitFor({ timeout: 5_000 });
        assert.equal(await saveState.getAttribute("data-ltm-save-state"), "clean");
        assert.equal(await saveButton.getAttribute("aria-disabled"), "true", "Save is visible but quiet when clean");
        // The Hide switch sits right under "Memories from chats" and carries a one-line hint.
        assert.match(
          await extraction.getByLabel("Hide remembered messages from the AI", { exact: true }).evaluate((input) => {
            const ids = (input.getAttribute("aria-describedby") ?? "").split(/\s+/u);
            return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
          }),
          /\S/u,
          "Hide remembered messages has a live hint read with its switch",
        );
        // Model tuning, Finish cut-off answers, AI keywords and Game Mode sit in a closed Advanced section.
        const extractionAdvanced = extraction.locator("[data-ltm-extraction-advanced]");
        assert.equal(await extractionAdvanced.evaluate((node: HTMLDetailsElement) => node.open), false);
        await openExtractionAdvanced(savePage);
        await extractionAdvanced.getByText("Finish cut-off answers", { exact: false }).first().waitFor();
        // Changing a dropdown marks the form unsaved at once; nothing applies silently.
        await extraction.getByRole("combobox", { name: /Roleplay active template/u }).selectOption("");
        await savePage.locator('[data-ltm-save-state="dirty"]').waitFor({ timeout: 5_000 });
        assert.notEqual(
          await saveButton.getAttribute("aria-disabled"),
          "true",
          "Save is enabled once anything changes",
        );
        assert.equal(writes.length, 0, "a dropdown never saves by itself");
        await extraction.getByRole("combobox", { name: /Roleplay active template/u }).selectOption("template_story");
        await savePage.locator('[data-ltm-save-state="clean"]').waitFor({ timeout: 5_000 });
        // Edit instructions opens the template the mode actually uses.
        const editGame = extraction.getByRole("button", { name: "Edit instructions Game" });
        await editGame.click();
        assert.equal(await editGame.getAttribute("aria-expanded"), "true");
        const templateName = extraction.getByLabel("Name", { exact: true });
        assert.equal(await templateName.inputValue(), "Quest log", "Game opens the Game template");
        await extraction.getByRole("button", { name: "Edit instructions Roleplay" }).click();
        assert.equal(await templateName.inputValue(), "Story beats", "Roleplay opens the Roleplay template");
        // Duplicate selects the copy and says so.
        await extraction.getByRole("button", { name: "Duplicate", exact: true }).click();
        assert.match(await templateName.inputValue(), /Story beats/u, "the copy keeps the original's name");
        assert.notEqual(await templateName.inputValue(), "Story beats", "the copy is the selected template");
        await extraction.locator("[data-ltm-template-notice]").getByText("Now used for Roleplay").waitFor();
        await savePage.locator('[data-ltm-save-state="dirty"]').waitFor({ timeout: 5_000 });
        // The copy is the Roleplay template straight away; the other modes keep theirs.
        const roleplayCopy = await templateName.inputValue();
        const roleplaySelect = extraction.getByRole("combobox", { name: /Roleplay active template/u });
        assert.equal(
          await roleplaySelect.locator("option:checked").textContent(),
          roleplayCopy,
          "Roleplay now uses the copy",
        );
        assert.equal(
          await extraction.getByRole("combobox", { name: /Game active template/u }).inputValue(),
          "template_game",
          "Game keeps its own template",
        );
        // Copy to edit on a built-in default (Conversation) is used for Conversation straight away.
        await extraction.getByRole("button", { name: "Edit instructions Conversation" }).click();
        await extraction.getByRole("button", { name: "Copy to edit", exact: true }).click();
        await extraction.locator("[data-ltm-template-notice]").getByText("Now used for Conversation").waitFor();
        assert.match(
          (await extraction
            .getByRole("combobox", { name: /Conversation active template/u })
            .locator("option:checked")
            .textContent()) ?? "",
          /copy/u,
          "Conversation now uses the copy of its built-in default",
        );
        await saveButton.click();
        await savePage.locator('[data-ltm-save-state="saved"]').waitFor({ timeout: 5_000 });
        assert.equal(writes.length, 1, "one Save writes every changed tab once");
        const savedActive = writes[0]?.activePromptTemplateIdsByMode as Record<string, string | null>;
        assert.ok(
          savedActive.roleplay?.startsWith("template_") && savedActive.roleplay !== "template_story",
          "Save persists the Roleplay copy as active",
        );
        assert.ok(savedActive.conversation?.startsWith("template_"), "Save persists the Conversation copy as active");
        assert.equal(savedActive.game, "template_game");
        // The header Create button has no mode once the editor is closed: the blank template stays unused.
        await extraction.getByRole("button", { name: "Edit instructions Conversation" }).click();
        assert.equal(await extraction.locator("[data-ltm-prompt-template-grid]").count(), 0, "the editor is closed");
        await extraction.getByRole("button", { name: "New prompt template" }).click();
        await extraction.locator("[data-ltm-template-notice]").getByText("Now editing", { exact: false }).waitFor();
        // A second Create while the blank template is open still has no mode (the closed Conversation editor is not one).
        await extraction.getByRole("button", { name: "New prompt template" }).click();
        assert.equal(
          await extraction.getByRole("combobox", { name: /Conversation active template/u }).inputValue(),
          savedActive.conversation,
          "a template made with no mode context is not made active",
        );
        await savePage.getByRole("button", { name: "Discard changes" }).click();
        await savePage.locator('[data-ltm-save-state="clean"]').waitFor({ timeout: 5_000 });
        // A typed number counts as an edit before the field blurs, and number fields are sized to their numbers.
        const typedNumber = extraction.getByRole("spinbutton", { name: "Maximum output tokens" });
        const saveStateOf = () => savePage.locator("[data-ltm-save-state]").getAttribute("data-ltm-save-state");
        const startValue = await typedNumber.inputValue();
        await typedNumber.fill("1234");
        await savePage.locator('[data-ltm-save-state="dirty"]').waitFor({ timeout: 5_000 });
        assert.notEqual(await saveButton.getAttribute("aria-disabled"), "true", "Save lights up while typing");
        const numberBox = await typedNumber.boundingBox();
        assert.ok(numberBox && numberBox.width < 192, `a number field is narrower than 12rem (${numberBox?.width})`);
        await savePage.getByRole("button", { name: "Discard changes" }).click();
        await savePage.locator('[data-ltm-save-state="clean"]').waitFor({ timeout: 5_000 });
        // An out-of-range draft does not mark the form dirty; blur clamps it and then it does.
        await typedNumber.fill("100");
        assert.equal(await saveStateOf(), "clean", "an out-of-range draft is not an edit yet");
        await typedNumber.blur();
        assert.equal(await typedNumber.inputValue(), "512", "blur clamps to the minimum");
        await savePage.locator('[data-ltm-save-state="dirty"]').waitFor({ timeout: 5_000 });
        await savePage.getByRole("button", { name: "Discard changes" }).click();
        await savePage.locator('[data-ltm-save-state="clean"]').waitFor({ timeout: 5_000 });
        // Emptying a field that was live-committed goes back to the value it started from, not a typed prefix.
        await typedNumber.fill("1000");
        await savePage.locator('[data-ltm-save-state="dirty"]').waitFor({ timeout: 5_000 });
        await typedNumber.fill("");
        await typedNumber.blur();
        assert.equal(await typedNumber.inputValue(), startValue, "an emptied field returns to its starting value");
        await savePage.locator('[data-ltm-save-state="clean"]').waitFor({ timeout: 5_000 });
        const memoriesFromChats = await extraction.locator('[data-ltm-chat-memories="global"]').boundingBox();
        assert.ok(
          memoriesFromChats && memoriesFromChats.width <= 384.5,
          `a Memory Settings dropdown stops at 24rem (${memoriesFromChats?.width})`,
        );
        await savePage.close();
      }
      // #1659: success text reads at 4.5:1 in both themes and carries a check icon, an unsaved tab shows a dot,
      // and Save stays reachable while the form scrolls.
      {
        const critiquePage = await browserContext.newPage();
        await critiquePage.setViewportSize({ width: 1280, height: 520 });
        await critiquePage.goto(`http://127.0.0.1:${address.port}/`);
        await critiquePage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await critiquePage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await critiquePage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        // Contrast of an element's text against its composited ancestor backgrounds, drawn on a canvas so
        // every CSS color syntax (color-mix, oklab) is resolved by the browser itself.
        const contrastOf = (selector: string) =>
          critiquePage.evaluate(`(() => {
            const element = document.querySelector(${JSON.stringify(selector)});
            const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
            context.canvas.width = 1;
            context.canvas.height = 1;
            const paint = (css) => {
              context.fillStyle = css;
              context.fillRect(0, 0, 1, 1);
            };
            const read = () => [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
            const chain = [];
            for (let node = element; node; node = node.parentElement) {
              chain.unshift(getComputedStyle(node).backgroundColor);
            }
            paint("#fff");
            for (const color of chain) paint(color);
            const background = read();
            paint("rgb(" + background.join(",") + ")");
            paint(getComputedStyle(element).color);
            const text = read();
            const luminance = (rgb) => {
              const [r, g, b] = rgb.map((value) => {
                const channel = value / 255;
                return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
              });
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const [light, dark] = [luminance(text), luminance(background)].sort((a, b) => b - a);
            return (light + 0.05) / (dark + 0.05);
          })()`) as Promise<number>;
        // The integrity result moved to the Vault (soup/vault-fix-bar), so Settings has no success line to sample.
        for (const theme of ["light", "dark"]) {
          await critiquePage.evaluate((value) => {
            document.documentElement.dataset.theme = value;
          }, theme);
          // The tabs use transition-colors, so measure after the theme change has finished fading.
          await critiquePage.evaluate(
            "Promise.all(document.getAnimations().filter((animation) => animation.effect.getComputedTiming().endTime !== Infinity).map((animation) => animation.finished))",
          );
          const ratios = {
            selectedTab: await contrastOf('#settings-tab-recall[data-active="true"]'),
            inactiveTab: await contrastOf('#settings-tab-extraction[data-active="false"]'),
          };
          for (const [name, ratio] of Object.entries(ratios)) {
            assert.equal(
              ratio >= 4.5,
              true,
              `${name} text is at least 4.5:1 in the ${theme} theme (${ratio.toFixed(2)})`,
            );
          }
        }
        // Unsaved edits: a dot on the tab that holds them, Save and Discard sticky while the form scrolls.
        await critiquePage.locator("#settings-tab-recall").click();
        const recallTab = critiquePage.locator("#settings-tab-recall");
        assert.equal(await critiquePage.locator("[data-ltm-tab-dirty]").count(), 0, "a clean form shows no dot");
        await openRecallAdvanced(critiquePage);
        const budget = critiquePage.getByRole("spinbutton", { name: "Memory budget", exact: true });
        const budgetBefore = Number(await budget.inputValue());
        await budget.fill(String(budgetBefore === 2048 ? 2176 : 2048));
        await budget.blur();
        await critiquePage.getByRole("button", { name: "Save settings" }).waitFor();
        assert.equal(await recallTab.locator("[data-ltm-tab-dirty]").count(), 1, "the Recall tab shows the dot");
        assert.equal(await critiquePage.locator("#settings-tab-extraction [data-ltm-tab-dirty]").count(), 0);
        assert.equal(
          await critiquePage.getByRole("tab", { name: /^Recall\s+Unsaved changes$/u }).count(),
          1,
          "the dot is spoken, not only drawn",
        );
        // The Engine shell bounds .mari-editor-content and scrolls it; this host does not, so bound it here.
        await critiquePage.addStyleTag({ content: ".mari-editor-content { max-height: 520px; }" });
        await critiquePage
          .locator("#settings-panel-recall")
          .getByText("Intro to memories", { exact: false })
          .first()
          .scrollIntoViewIfNeeded();
        assert.deepEqual(
          await critiquePage.evaluate(
            "(() => { const scroller = document.querySelector('.mari-editor-content'); const header = document.querySelector('[data-ltm-settings-header]'); return { scrolled: scroller.scrollTop > 0, sticky: getComputedStyle(header).position }; })()",
          ),
          { scrolled: true, sticky: "sticky" },
          "the form scrolled under a sticky header",
        );
        const saveBox = await critiquePage.getByRole("button", { name: "Save settings" }).boundingBox();
        assert.ok(saveBox);
        assert.equal(
          saveBox.y >= 0 && saveBox.y + saveBox.height <= 520,
          true,
          "Save settings stays in view after scrolling the form",
        );
        await critiquePage.getByRole("button", { name: "Discard changes" }).click();
        await critiquePage.getByRole("button", { name: "Discard changes" }).waitFor({ state: "detached" });
        assert.equal(await critiquePage.locator("[data-ltm-tab-dirty]").count(), 0, "Discard clears the dot");
        await critiquePage.close();
      }
      // Troubleshooting results are toasts, announced once by the host; the panel has no live regions of its own.
      {
        const pluralPage = await browserContext.newPage();
        await pluralPage.goto(`http://127.0.0.1:${address.port}/`);
        await pluralPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await pluralPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = {
            confirmAction: (options) => {
              window.__ltmConfirms = [...(window.__ltmConfirms ?? []), options];
              return false;
            },
          };
          document.body.append(element);
        })()`);
        await pluralPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        await openTroubleshooting(pluralPage);
        const maintenance = pluralPage.locator("#settings-panel-troubleshooting");
        // A finished run is an Engine toast, which the host announces once; the panel mounts no status copy of its
        // own before, during or after the run.
        await maintenance.getByRole("button", { name: "Delete all data" }).click();
        await pluralPage.route("**/api/long-term-memory/backup/export", (route) => route.fulfill({ json: {} }));
        const maintenanceLiveCopy = () =>
          maintenance.evaluate((panel) =>
            [...panel.querySelectorAll('p[role="status"].sr-only, [aria-live]')].map((node) => node.textContent ?? ""),
          );
        assert.deepEqual(await maintenanceLiveCopy(), [], "no status copy is mounted before a run");
        await maintenance.getByRole("button", { name: "Export a backup first" }).click();
        const exportedToast = toastWith(pluralPage, "Memory backup exported.");
        await exportedToast.waitFor();
        assert.equal(await exportedToast.getAttribute("data-type"), "success");
        assert.deepEqual(await maintenanceLiveCopy(), [], "the panel does not announce the export a second time");
        await pluralPage.close();
      }
      // soup/review-identity: duplicate people show in Review as "same person · Merge / Keep both"; Merge and
      // "Preview identity repairs" open the real repair preview and the apply confirmation, with the One and Other
      // plural forms and the Intl.ListFormat joins (render-level proof). Keep both is a per-device choice.
      {
        const identityPage = await browserContext.newPage();
        const repairNote = (noteId: string, title: string) => ({
          noteId,
          title,
          basis: "exact_name",
          alreadyBound: false,
          exactFullName: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        });
        const candidate = (id: string, subjectNames: string[], matchBasis: string[], duplicateIds: string[]) => ({
          id: id.repeat(64),
          subjectNames,
          noteType: "character",
          matchBasis,
          blockingReasons: [],
          notes: [
            repairNote(`${id}-canonical`, subjectNames[0]!),
            ...duplicateIds.map((duplicateId) => repairNote(duplicateId, `${subjectNames[0]} (copy)`)),
          ],
          canonicalNoteId: `${id}-canonical`,
          duplicateNoteIds: duplicateIds,
          additiveContent: [],
          supersedingConflicts: [],
        });
        let previewCandidates = [candidate("a", ["Mira"], ["exact_name"], ["a-copy"])];
        const applyBodies: Array<{ repairs: Array<{ candidateId: string; canonicalNoteId: string }> }> = [];
        await identityPage.route("**/api/long-term-memory/identity-repair/preview", (route) =>
          route.fulfill({
            json: {
              generatedAt: "2026-01-01T00:00:00.000Z",
              scope: { kind: "global" },
              counts: {
                analyzedNotes: 6,
                candidateCount: previewCandidates.length,
                bindableNotes: 6,
                duplicateNotes: previewCandidates.reduce((count, item) => count + item.duplicateNoteIds.length, 0),
                unresolvedNotes: 0,
              },
              candidates: previewCandidates,
              unresolved: [],
            },
          }),
        );
        await identityPage.route("**/api/long-term-memory/identity-repair/apply", (route) => {
          const body = route.request().postDataJSON();
          applyBodies.push(body);
          return route.fulfill({
            json: {
              repairedAt: "2026-01-01T00:00:00.000Z",
              backup: { id: "0123abcd-4567-89ef-0123-456789abcdef", createdAt: "2026-01-01T00:00:00.000Z" },
              repairs: body.repairs.map((repair: { candidateId: string }) => ({ candidateId: repair.candidateId })),
            },
          });
        });
        const openReview = async () => {
          await identityPage.goto(`http://127.0.0.1:${address.port}/`);
          await identityPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
          await identityPage.evaluate(`(() => {
            const element = document.createElement("marinara-capability-long-term-memory");
            element.setAttribute("view", "detail");
            element.capabilityProps = {
              confirmAction: (options) => {
                window.__ltmConfirms = [...(window.__ltmConfirms ?? []), options];
                return window.__ltmConfirmAnswer === true;
              },
            };
            document.body.append(element);
          })()`);
          await identityPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
        };
        const confirmCount = () =>
          identityPage.evaluate(() => (window as unknown as { __ltmConfirms?: unknown[] }).__ltmConfirms?.length ?? 0);
        const lastConfirm = () =>
          identityPage.evaluate(() =>
            (
              window as unknown as { __ltmConfirms: Array<{ message?: string; confirmLabel?: string }> }
            ).__ltmConfirms.at(-1)!,
          );
        await openReview();
        await identityPage.evaluate(() => window.localStorage.removeItem("ltm-identity-keep-both"));
        // The pair is one row with a name, what it is, how many memories, and two choices.
        const identityRow = identityPage.locator("[data-ltm-identity-row]");
        await identityRow.waitFor();
        const rowText = (await identityRow.innerText()).replace(/\s+/gu, " ");
        assert.match(rowText, /Mira/u);
        assert.match(rowText, /Character · 2 memories/iu);
        assert.equal(await identityRow.getByRole("button", { name: "Merge", exact: true }).count(), 1);
        assert.equal(await identityRow.getByRole("button", { name: "Keep both", exact: true }).count(), 1);
        assert.match(await identityPage.locator("[data-ltm-identity-item]").innerText(), /Same person\? \(1\)/u);
        assert.match(
          await identityPage.locator("[data-ltm-identity-item]").innerText(),
          /Keep both hides a pair on this device only\./u,
        );
        // One: Merge opens the real preview for that pair and asks before archiving anything.
        await identityRow.getByRole("button", { name: "Merge", exact: true }).click();
        const identityPreview = identityPage.locator("[data-ltm-identity-preview]");
        await identityPreview.waitFor();
        await identityPage.getByRole("button", { name: /Apply selected repairs/u }).click();
        await identityPage.waitForFunction(
          () => ((window as unknown as { __ltmConfirms?: unknown[] }).__ltmConfirms?.length ?? 0) === 1,
        );
        assert.deepEqual(await lastConfirm(), {
          title: "Apply identity repairs?",
          message:
            "1 selected identity repair will be applied. 1 explicitly included duplicate note will be archived; excluded duplicates will be preserved. A backup is created first.",
          confirmLabel: "Apply 1 repair",
          tone: "destructive",
        });
        assert.equal(applyBodies.length, 0, "declining the confirmation applies nothing");
        // Confirming merges, says a backup was saved, and never names a folder.
        await identityPage.evaluate(() => {
          (window as unknown as { __ltmConfirmAnswer?: boolean }).__ltmConfirmAnswer = true;
        });
        previewCandidates = [];
        await identityPage.getByRole("button", { name: /Apply selected repairs/u }).click();
        const identityResult = toastWith(identityPage, /Merged 1 duplicate person\. A backup was saved first\./u);
        await identityResult.waitFor({ timeout: 5000 });
        assert.doesNotMatch(await identityResult.innerText(), /folder|path|\//iu);
        assert.equal(await identityPage.locator("[data-ltm-identity-result]").count(), 0, "no inline result remains");
        assert.equal(applyBodies.length, 1);
        assert.deepEqual(
          applyBodies[0]!.repairs.map((repair) => [repair.candidateId, repair.canonicalNoteId]),
          [["a".repeat(64), "a-canonical"]],
        );
        await identityPage.waitForFunction(() => document.querySelectorAll("[data-ltm-identity-row]").length === 0);
        assert.equal(await identityRow.count(), 0, "a merged pair is no longer offered");
        // The merged pair unmounts this item with its Preview button, so focus falls back to the review queue itself
        // (the one named target), never to <body> or an arbitrary button.
        await identityPage.waitForFunction(
          () => document.activeElement?.matches('[data-ltm-surface="review-queue"]') ?? false,
        );
        // Other: two pairs, three duplicates, lists of three names and two match bases; Keep both hides one pair.
        previewCandidates = [
          candidate("a", ["Mira", "Mirabel", "Mimi"], ["exact_name", "unique_alias"], ["a-copy"]),
          candidate("b", ["Sol"], ["exact_name"], ["b-copy", "b-copy-two"]),
        ];
        await openReview();
        await identityRow.nth(1).waitFor();
        assert.equal(await identityRow.count(), 2);
        await identityPage.getByRole("button", { name: "Preview identity repairs" }).click();
        const firstCandidate = identityPreview.locator("label", { hasText: "Mira, Mirabel, and Mimi" });
        await firstCandidate.waitFor();
        assert.match(
          (await firstCandidate.innerText()).replace(/\s+/gu, " "),
          /Mira, Mirabel, and Mimi .*match via exact name, unique alias\./u,
        );
        const confirmsBefore = await confirmCount();
        await identityPage.getByRole("button", { name: /Apply selected repairs/u }).click();
        await identityPage.waitForFunction(
          (before) => ((window as unknown as { __ltmConfirms?: unknown[] }).__ltmConfirms?.length ?? 0) > before,
          confirmsBefore,
        );
        assert.deepEqual(await lastConfirm(), {
          title: "Apply identity repairs?",
          message:
            "2 selected identity repairs will be applied. 3 explicitly included duplicate notes will be archived; excluded duplicates will be preserved. A backup is created first.",
          confirmLabel: "Apply 2 repairs",
          tone: "destructive",
        });
        await identityPage.getByRole("button", { name: "Cancel", exact: true }).click();
        await identityPreview.waitFor({ state: "detached" });
        await identityRow.first().getByRole("button", { name: "Keep both", exact: true }).click();
        await identityPage.waitForFunction(() => document.querySelectorAll("[data-ltm-identity-row]").length === 1);
        await identityPage.waitForFunction(
          (id) =>
            document.activeElement?.closest("[data-ltm-identity-row]")?.getAttribute("data-ltm-identity-row") === id,
          "b".repeat(64),
        );
        await openReview();
        await identityRow.first().waitFor();
        assert.equal(await identityRow.count(), 1, "Keep both is remembered after Review reopens");
        assert.equal(await identityRow.first().getAttribute("data-ltm-identity-row"), "b".repeat(64));
        // Keep both on the last row leaves no row, but the preview stays reachable and lists every pair.
        await identityRow.first().getByRole("button", { name: "Keep both", exact: true }).click();
        await identityPage.waitForFunction(() => document.querySelectorAll("[data-ltm-identity-row]").length === 0);
        assert.doesNotMatch(await identityPage.locator("[data-ltm-identity-item]").innerText(), /\(\d+\)/u);
        await identityPage.getByRole("button", { name: "Preview identity repairs" }).click();
        await identityPreview.waitFor();
        assert.equal(await identityPreview.locator(":scope > div").count(), 2, "kept pairs are still previewable");
        // A candidate with nothing to archive (a bind-only repair) has no row, yet the preview still opens.
        previewCandidates = [candidate("c", ["Rue"], ["exact_name"], [])];
        await openReview();
        await identityPage.getByRole("button", { name: "Preview identity repairs" }).waitFor();
        assert.equal(await identityRow.count(), 0, "nothing to merge means no Merge row");
        await identityPage.getByRole("button", { name: "Preview identity repairs" }).click();
        await identityPreview.waitFor();
        assert.equal(await identityPreview.locator(":scope > div").count(), 1);
        await identityPage.close();
      }
      // soup/review-skipped: every skipped change is listed with why it was not saved, and an action.
      {
        const skippedPage = await browserContext.newPage();
        await skippedPage.goto(`http://127.0.0.1:${address.port}/`);
        await skippedPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await skippedPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await skippedPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
        const skippedChip = skippedPage.locator("[data-ltm-review-navigator] [data-ltm-skipped-toggle]");
        await skippedChip.waitFor();
        const skippedTotal = Number((await skippedChip.innerText()).match(/^Skipped \((\d+)\)$/u)?.[1]);
        assert.ok(skippedTotal >= 3, "the seeded rejected suggestions are counted");
        // soup/ltm-sources-review: the chip sits at the right of the Review heading row, the list is closed until it
        // opens, and the heading row's summary strip carries the counts in one line with no "Modes:" text.
        const skippedList = skippedPage.locator("[data-ltm-skipped-list]");
        assert.equal(await skippedChip.getAttribute("aria-expanded"), "false");
        assert.equal(await skippedList.count(), 0);
        const headingRow = await skippedPage.evaluate(() => {
          const heading = document.querySelector("[data-ltm-review-navigator] h2")!.getBoundingClientRect();
          const chip = document
            .querySelector("[data-ltm-review-navigator] [data-ltm-skipped-toggle]")!
            .getBoundingClientRect();
          return {
            sameRow: Math.abs(chip.top + chip.height / 2 - (heading.top + heading.height / 2)) < 24,
            right: chip.left >= heading.right,
          };
        });
        assert.deepEqual(headingRow, { sameRow: true, right: true });
        assert.match(
          await skippedPage.locator("[data-ltm-review-progress]:visible").innerText(),
          /^\d+ sources? · \d+ pending · \d+ ready(?: · \d+ blocked)?$/u,
        );
        assert.doesNotMatch(await skippedPage.locator('[data-ltm-surface="review-queue"]').innerText(), /Modes:/u);
        await skippedChip.click();
        await skippedList.waitFor();
        assert.equal(await skippedChip.getAttribute("aria-expanded"), "true");
        assert.equal(await skippedList.locator("[data-ltm-skipped-item]").count(), skippedTotal);
        const skippedItem = skippedList.locator(`[data-ltm-skipped-item="${rejectedSuggestionId}"]`);
        const skippedText = (await skippedItem.innerText()).replace(/\s+/gu, " ");
        assert.match(skippedText, /A recoverable mobile memory\./u);
        assert.match(skippedText, /Why it wasn't saved: A recoverable mobile memory\./u);
        assert.match(skippedText, /Source note: /u);
        // A change with no message of its own says its reason in words, never the raw code.
        const reasonOnly = skippedList.locator("[data-ltm-skipped-item]").filter({ hasText: "Why it wasn't saved:" });
        assert.equal(await reasonOnly.count(), skippedTotal, "every change states why it was not saved");
        assert.doesNotMatch(
          await skippedList.innerText(),
          /invalid_format|unsupported_bucket|missing_source_evidence/u,
        );
        assert.equal(await skippedItem.getByRole("button", { name: "Open source", exact: true }).count(), 1);
        // Add anyway opens the same recovery as a source's "Recover manually".
        await skippedItem.getByRole("button", { name: /^Add anyway: / }).click();
        await skippedPage.locator("[data-ltm-note-editor]").waitFor();
        await skippedPage.close();
      }
      // #1452: when the settings read after Reset fails, Retry on the error surface loads the new settings
      // instead of the cached ones the action replaced. (A Vault restore needs no such retry: Memory Settings
      // refetches when it opens; see soup/vault-backup.)
      {
        const failPage = await browserContext.newPage();
        let nextBudget: number | null = null;
        let failSettings = false;
        await failPage.route("**/api/long-term-memory/settings/reset", (route) => route.fulfill({ json: {} }));
        await failPage.route("**/api/long-term-memory/settings", async (route) => {
          if (nextBudget === null || route.request().method() !== "GET") return route.continue();
          if (failSettings) return route.fulfill({ status: 500, json: { error: "Fixture settings read failed." } });
          const response = await route.fetch();
          await route.fulfill({
            response,
            json: { ...(await response.json()), longTermMemoryBudgetTokens: nextBudget },
          });
        });
        await failPage.goto(`http://127.0.0.1:${address.port}/`);
        await failPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await failPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await failPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        await openRecallAdvanced(failPage);
        const recallBudget = failPage.getByRole("spinbutton", { name: "Memory budget", exact: true });
        const cachedBudget = Number(await recallBudget.inputValue());
        nextBudget = cachedBudget === 2048 ? 2176 : 2048;
        failSettings = true;
        await failPage.locator("[data-ltm-reset-settings]").click();
        const loadError = failPage
          .locator('[data-ltm-status="danger"]')
          .filter({ hasText: "Could not load memory settings." });
        await loadError.waitFor({ timeout: 5000 });
        // The reset itself succeeded, so its toast is up while the settings read still fails (toasts are brief).
        await toastWith(failPage, "Memory settings reset to defaults.").waitFor({ timeout: 5000 });
        failSettings = false;
        const loadRetry = loadError.getByRole("button", { name: "Retry" });
        // #1673: a text-style retry keeps the 2.75rem touch floor.
        assert.ok(
          (await loadRetry.evaluate((element) => element.getBoundingClientRect().height)) >= 44,
          "the settings load retry meets 2.75rem",
        );
        await loadRetry.click();
        await loadError.waitFor({ state: "detached", timeout: 5000 });
        await failPage.locator("#settings-tab-recall").click();
        await openRecallAdvanced(failPage);
        assert.equal(
          await recallBudget.inputValue(),
          String(nextBudget),
          "reset: the forms show the settings read after the action",
        );
        await failPage.close();
      }
      // #1673: the connections-load Retry and every active-template Edit button meet the 2.75rem floor.
      {
        const touchPage = await browserContext.newPage();
        await touchPage.route("**/api/connections", (route) =>
          route.fulfill({ status: 500, json: { error: "Fixture connections read failed." } }),
        );
        await touchPage.goto(`http://127.0.0.1:${address.port}/`);
        await touchPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await touchPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await touchPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        await touchPage.locator("#settings-tab-extraction").click();
        const connectionsError = touchPage
          .locator('[data-ltm-status="danger"]')
          .filter({ hasText: "Could not load language connections." });
        await connectionsError.waitFor({ timeout: 10000 });
        assert.ok(
          (await connectionsError
            .getByRole("button", { name: "Retry" })
            .evaluate((element) => element.getBoundingClientRect().height)) >= 44,
          "the connections retry meets 2.75rem",
        );
        const edits = touchPage.getByRole("button", { name: /^Edit instructions /u });
        const editCount = await edits.count();
        assert.equal(editCount, 3, "each active-template picker has its Edit button");
        for (let index = 0; index < editCount; index += 1) {
          assert.ok(
            (await edits.nth(index).evaluate((element) => element.getBoundingClientRect().height)) >= 44,
            `Edit ${index + 1} meets 2.75rem`,
          );
        }
        assert.equal(await touchPage.getByRole("button", { name: "Reset to default", exact: true }).count(), 0);
        await touchPage.close();
      }
      // Settings that remount after a failed reload wait for a successful read instead of filling
      // the forms from the settings cached before the Reset, which the next Save would write back.
      {
        const remountPage = await browserContext.newPage();
        let nextBudget: number | null = null;
        let failSettings = false;
        await remountPage.route("**/api/long-term-memory/settings/reset", (route) => route.fulfill({ json: {} }));
        await remountPage.route("**/api/long-term-memory/settings", async (route) => {
          if (nextBudget === null || route.request().method() !== "GET") return route.continue();
          if (failSettings) return route.fulfill({ status: 500, json: { error: "Fixture settings read failed." } });
          const response = await route.fetch();
          await route.fulfill({
            response,
            json: { ...(await response.json()), longTermMemoryBudgetTokens: nextBudget },
          });
        });
        await remountPage.goto(`http://127.0.0.1:${address.port}/`);
        await remountPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await remountPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        const settingsNav = remountPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]');
        await settingsNav.click();
        await openRecallAdvanced(remountPage);
        const recallBudget = remountPage.getByRole("spinbutton", { name: "Memory budget", exact: true });
        const cachedBudget = Number(await recallBudget.inputValue());
        nextBudget = cachedBudget === 2048 ? 2176 : 2048;
        failSettings = true;
        await remountPage.locator("[data-ltm-reset-settings]").click();
        await remountPage
          .locator('[data-ltm-status="danger"]')
          .filter({ hasText: "Could not load memory settings." })
          .waitFor({ timeout: 5000 });
        await remountPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
        failSettings = false;
        await settingsNav.click();
        await openRecallAdvanced(remountPage);
        await recallBudget.waitFor({ timeout: 5000 });
        assert.equal(
          await recallBudget.inputValue(),
          String(nextBudget),
          "Settings reopened after a failed reload show the settings read after the Reset",
        );
        await remountPage.close();
      }
      // Reset hides the forms (and its own link) while they reload. Focus then returns to the link that started
      // the action.
      {
        const focusPage = await browserContext.newPage();
        let settingsGate: Promise<void> | null = null;
        let releaseSettings = () => {};
        await focusPage.route("**/api/long-term-memory/settings/reset", (route) => route.fulfill({ json: {} }));
        await focusPage.route("**/api/long-term-memory/settings", async (route) => {
          if (route.request().method() === "GET" && settingsGate) await settingsGate;
          await route.continue();
        });
        await focusPage.goto(`http://127.0.0.1:${address.port}/`);
        await focusPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await focusPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        await focusPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        const focusedControl = () =>
          focusPage.evaluate(() =>
            document.activeElement === document.body ? "body" : (document.activeElement?.textContent?.trim() ?? ""),
          );
        settingsGate = new Promise<void>((resolve) => {
          releaseSettings = () => resolve();
        });
        const settingsRefetch = focusPage.waitForRequest(
          (request) => request.method() === "GET" && new URL(request.url()).pathname.endsWith("/settings"),
        );
        // Keyboard activation, so focus starts on the control.
        await focusPage.locator("[data-ltm-reset-settings]").press("Enter");
        await settingsRefetch;
        await focusPage.waitForTimeout(300);
        settingsGate = null;
        releaseSettings();
        await toastWith(focusPage, "Memory settings reset to defaults.").waitFor({ timeout: 5000 });
        await focusPage
          .waitForFunction(() => document.activeElement !== document.body, undefined, { timeout: 2000 })
          .catch(() => undefined);
        assert.equal(
          await focusedControl(),
          "Reset to defaults",
          "reset: focus returns to the Reset link after the settings reload",
        );
        await focusPage.close();
      }
      // soup/vault-backup: Back up and Restore are in the Vault header. Restore keeps the real flow (Choose
      // backup, the incoming counts, then the host's "Replace Long-Term Memory data?"), the results show in the
      // Vault, and Memory Settings shows the settings read after a restore.
      {
        const backupPage = await browserContext.newPage();
        const backupFile = JSON.stringify({ version: 1, notes: [] });
        let exportRequests = 0;
        const previewBodies: unknown[] = [];
        const importBodies: unknown[] = [];
        let importedBudget: number | null = null;
        await backupPage.route("**/api/long-term-memory/backup/export", (route) => {
          exportRequests += 1;
          return route.fulfill({ json: { version: 1, notes: [] } });
        });
        await backupPage.route("**/api/long-term-memory/backup/preview", (route) => {
          previewBodies.push(route.request().postDataJSON());
          return route.fulfill({
            json: {
              incoming: { notes: 2, drafts: 1, rejectedSuggestions: 0 },
              current: { notes: 5, drafts: 0, rejectedSuggestions: 3 },
            },
          });
        });
        await backupPage.route("**/api/long-term-memory/backup/import", (route) => {
          importBodies.push(route.request().postDataJSON());
          return route.fulfill({ json: {} });
        });
        await backupPage.route("**/api/long-term-memory/settings", async (route) => {
          if (importedBudget === null || route.request().method() !== "GET") return route.continue();
          const response = await route.fetch();
          await route.fulfill({
            response,
            json: { ...(await response.json()), longTermMemoryBudgetTokens: importedBudget },
          });
        });
        await backupPage.goto(`http://127.0.0.1:${address.port}/`);
        await backupPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await backupPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = {
            confirmAction: (options) => {
              window.__ltmConfirms = [...(window.__ltmConfirms ?? []), options];
              return window.__ltmConfirmResult ?? false;
            },
          };
          document.body.append(element);
        })()`);
        // Back up and Restore sit behind the header's "⋯" button, closed until opened.
        const moreToggle = backupPage.locator("[data-ltm-vault-header] [data-ltm-vault-more]");
        await moreToggle.waitFor();
        assert.equal(await moreToggle.getAttribute("aria-expanded"), "false");
        assert.equal(await backupPage.locator("[data-ltm-vault-more-menu]").count(), 0, "the menu starts closed");
        await moreToggle.click();
        assert.equal(await moreToggle.getAttribute("aria-expanded"), "true");
        const moreMenu = backupPage.locator("[data-ltm-vault-more-menu]");
        const backUp = moreMenu.getByRole("button", { name: "Back up", exact: true });
        const restore = moreMenu.getByRole("button", { name: "Restore", exact: true });
        await backUp.waitFor();
        const confirms = () =>
          backupPage.evaluate(
            () => (window as unknown as { __ltmConfirms?: Array<Record<string, unknown>> }).__ltmConfirms ?? [],
          );
        // Back up downloads the file and says so in the Vault.
        const [download] = await Promise.all([backupPage.waitForEvent("download"), backUp.click()]);
        assert.equal(download.suggestedFilename(), "long-term-memory-backup.json");
        await toastWith(backupPage, "Memory backup exported.").waitFor({ timeout: 5000 });
        assert.equal(exportRequests, 1, "Back up exports once");
        // Restore opens the real flow; nothing is sent until the file is chosen and the host confirms.
        assert.equal(await restore.getAttribute("aria-expanded"), "false");
        await restore.click();
        assert.equal(await restore.getAttribute("aria-expanded"), "true");
        const restorePanel = backupPage.locator("[data-ltm-vault-restore-panel]");
        await restorePanel.getByRole("button", { name: "Choose backup" }).waitFor();
        // Closing "⋯" under an open Restore panel keeps the panel; Cancel then returns focus to the "⋯" toggle.
        await moreToggle.click();
        assert.equal(await moreMenu.count(), 0, "the menu closes under the open Restore panel");
        await restorePanel.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal(await restorePanel.count(), 0);
        assert.equal(
          await moreToggle.evaluate((element) => element === document.activeElement),
          true,
          "Cancel returns focus to the ⋯ toggle when Restore is unmounted",
        );
        await moreToggle.click();
        await restore.click();
        await restorePanel.getByRole("button", { name: "Choose backup" }).waitFor();
        assert.deepEqual(
          await restorePanel
            .locator('input[type="file"]')
            .evaluate((input) => [(input as HTMLInputElement).tabIndex, input.getAttribute("aria-hidden")]),
          [-1, "true"],
          "the visible Choose backup button opens the hidden file input",
        );
        await restorePanel
          .locator('input[type="file"]')
          .setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(backupFile) });
        await restorePanel.getByText("Validated backup ready to import").waitFor({ timeout: 5000 });
        assert.deepEqual(previewBodies, [JSON.parse(backupFile)], "the chosen file is validated first");
        assert.match(
          (await restorePanel.textContent()) ?? "",
          /Current: 5 memories, 0 drafts\. Incoming: 2 memories, 1 drafts\./u,
          "the restore panel shows the current and incoming counts",
        );
        assert.deepEqual(importBodies, [], "choosing a file imports nothing");
        // Declining the host confirmation imports nothing and keeps the preview.
        const replace = restorePanel.getByRole("button", { name: "Replace with this backup" });
        await replace.click();
        await backupPage.waitForFunction(
          () => ((window as unknown as { __ltmConfirms?: unknown[] }).__ltmConfirms?.length ?? 0) === 1,
        );
        const [firstConfirm] = await confirms();
        assert.equal(firstConfirm?.title, "Replace Long-Term Memory data?");
        assert.equal(firstConfirm?.confirmLabel, "Replace data");
        assert.equal(firstConfirm?.tone, "destructive");
        assert.match(
          String(firstConfirm?.message),
          /replaces 5 current memories and 0 drafts with 2 memories and 1 drafts/u,
        );
        assert.deepEqual(importBodies, [], "a declined confirmation imports nothing");
        assert.equal(await replace.count(), 1, "a declined confirmation keeps the preview");
        // Accepting imports the validated file, closes the panel and reports in the Vault.
        await backupPage.evaluate(() => {
          (window as unknown as { __ltmConfirmResult?: boolean }).__ltmConfirmResult = true;
        });
        importedBudget = 2560;
        await replace.click();
        await toastWith(backupPage, "Memory backup imported.").waitFor({ timeout: 5000 });
        assert.deepEqual(importBodies, [JSON.parse(backupFile)], "the validated file is imported once");
        assert.equal(await restorePanel.count(), 0, "the restore panel closes after the import");
        assert.equal(await restore.getAttribute("aria-expanded"), "false");
        // Memory Settings refills from the settings read after the restore.
        await backupPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        await openRecallAdvanced(backupPage);
        assert.equal(
          await backupPage.getByRole("spinbutton", { name: "Memory budget", exact: true }).inputValue(),
          "2560",
          "Settings shows the restored settings",
        );
        await openTroubleshooting(backupPage);
        assert.equal(
          await backupPage
            .locator("#settings-panel-troubleshooting")
            .getByRole("button", { name: "Choose backup" })
            .count(),
          0,
          "Troubleshooting no longer holds Restore",
        );
        await backupPage.close();
      }
      // soup/vault-fix-bar: the repair checklist is one "N memories need fixing · Fix" bar over the Vault list.
      // Fix opens the real maintenance actions, a run holds the Vault lock and shows its result, and each
      // memory's info has a History list of its changes. Troubleshooting no longer holds the checklist.
      {
        const fixPage = await browserContext.newPage();
        let repaired = false;
        const repairBodies: unknown[] = [];
        let releaseRepair: () => void = () => undefined;
        const repairHold = new Promise<void>((resolve) => {
          releaseRepair = resolve;
        });
        await fixPage.route("**/api/long-term-memory/integrity", (route) =>
          route.request().method() !== "GET"
            ? route.fallback()
            : route.fulfill({
                json: repaired
                  ? { health: "healthy", ok: true, noteCount: 3, issues: [] }
                  : {
                      health: "degraded",
                      ok: false,
                      noteCount: 3,
                      issues: [
                        {
                          severity: "error",
                          code: "note_invalid",
                          noteId: "broken-memory",
                          message: "Note failed validation.",
                        },
                      ],
                    },
              }),
        );
        await fixPage.route("**/api/long-term-memory/repair", async (route) => {
          repairBodies.push(route.request().postDataJSON());
          await repairHold;
          repaired = true;
          return route.fulfill({
            json: {
              repairedAt: new Date().toISOString(),
              actions: [{ action: "rebuild_indexes", result: "rebuilt", count: 4 }],
            },
          });
        });
        await fixPage.route(
          (url) => url.pathname.endsWith("/api/long-term-memory/events") && url.searchParams.has("noteId"),
          (route) =>
            route.fulfill({
              json: {
                events: [
                  {
                    id: "history-2",
                    ts: "2026-11-02T10:00:00.000Z",
                    type: "note_updated",
                    summary: "Edited the first section",
                  },
                  { id: "history-1", ts: "2026-11-01T10:00:00.000Z", type: "note_created", summary: "Memory created" },
                ],
              },
            }),
        );
        await fixPage.goto(`http://127.0.0.1:${address.port}/`);
        await fixPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await fixPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        const fixBar = fixPage.locator("[data-ltm-vault-fix-bar]");
        await fixBar.waitFor();
        assert.match((await fixBar.textContent()) ?? "", /1 memory needs fixing ·/u, "the bar counts the memories");
        const fix = fixBar.getByRole("button", { name: "Fix", exact: true });
        assert.equal(await fix.getAttribute("aria-expanded"), "false");
        assert.equal(await fixPage.locator("[data-ltm-vault-fix-panel]").count(), 0, "nothing opens until Fix");
        await fix.click();
        assert.equal(await fix.getAttribute("aria-expanded"), "true");
        const fixPanel = fixPage.getByRole("group", { name: "Vault Maintenance" });
        await fixPanel.waitFor();
        assert.match((await fixPanel.textContent()) ?? "", /1 integrity issue\(s\) found\./u);
        const runFix = fixPanel.getByRole("button", { name: "Run selected maintenance", exact: true });
        assert.equal(await runFix.isDisabled(), true, "Run waits for a chosen action");
        // Every AI check opens from the Fix panel and from the Vault's More menu; nothing is sent before Start.
        const requestsBefore = tidyPreviewRequests + linksPreviewRequests + peoplePreviewRequests;
        for (const [opener, kind] of [
          ["[data-ltm-vault-fix-tidy]", "tidy"],
          ["[data-ltm-vault-tidy]", "tidy"],
          ["[data-ltm-vault-fix-links]", "links"],
          ["[data-ltm-vault-links]", "links"],
          ["[data-ltm-vault-fix-people]", "people"],
          ["[data-ltm-vault-people]", "people"],
        ] as const) {
          const viaMenu = !opener.startsWith("[data-ltm-vault-fix-");
          if (viaMenu) await fixPage.locator("[data-ltm-vault-more]").click();
          await fixPage.locator(opener).click();
          const tidyDialog = fixPage.locator("[data-ltm-tidy-dialog]");
          await tidyDialog.locator('[data-ltm-tidy-state="confirm"]').waitFor();
          assert.equal(await tidyDialog.locator(`[data-ltm-ai-check="${kind}"]`).count(), 1, opener);
          await tidyDialog.locator("[data-ltm-tidy-back]").click();
          await tidyDialog.waitFor({ state: "detached" });
          if (viaMenu) await fixPage.locator("[data-ltm-vault-more]").click();
        }
        assert.equal(
          tidyPreviewRequests + linksPreviewRequests + peoplePreviewRequests,
          requestsBefore,
          "opening an AI check sends nothing",
        );
        await fixPanel.getByRole("checkbox", { name: /Reindex recall data/u }).check();
        // A run holds the Vault lock: both buttons stay focusable but refuse a second request.
        await runFix.click();
        await fixPage.waitForFunction(
          () => document.querySelector("[data-ltm-vault-fix-bar] button")?.getAttribute("aria-disabled") === "true",
        );
        assert.equal(await runFix.getAttribute("aria-disabled"), "true");
        // Playwright treats aria-disabled as not enabled, so the second press is forced.
        await runFix.click({ force: true });
        await fixPage.waitForTimeout(100);
        assert.deepEqual(repairBodies, [{ actions: ["rebuild_indexes"] }], "one repair request while it runs");
        releaseRepair();
        await toastWith(fixPage, "Reindex recall data: Rebuilt (4)").waitFor({ timeout: 5000 });
        assert.equal(await fixPage.locator("[data-ltm-vault-fix-result]").count(), 0, "no inline result remains");
        // The run empties the selection and Run turns disabled; focus lands on the panel's Close button.
        await fixPage.waitForFunction(() => {
          const active = document.activeElement;
          return (
            active instanceof HTMLButtonElement &&
            active.textContent?.trim() === "Close" &&
            active.closest("[data-ltm-vault-fix-panel]") !== null
          );
        });
        await fixBar.waitFor({ state: "detached" });
        // Troubleshooting keeps only its own groups.
        await fixPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="settings"]').click();
        await openTroubleshooting(fixPage);
        assert.equal(
          await fixPage
            .locator("#settings-panel-troubleshooting")
            .getByRole("button", { name: "Run selected maintenance" })
            .count(),
          0,
          "Troubleshooting no longer holds the repair checklist",
        );
        // History: the memory info lists that memory's changes.
        await fixPage.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
        await fixPage.locator('[data-ltm-surface="vault"]').waitFor();
        await fixPage.locator("[data-ltm-note-type]").first().locator("button").first().click();
        if ((await fixPage.locator("[data-ltm-details-toggle]").getAttribute("aria-pressed")) !== "true")
          await fixPage.locator("[data-ltm-details-toggle]").click();
        await fixPage
          .locator("[data-ltm-record-info]")
          .first()
          .evaluate((element) => {
            (element as HTMLDetailsElement).open = true;
          });
        const history = fixPage
          .locator("[data-ltm-note-inspector]")
          .getByText("History", { exact: true })
          .locator("xpath=..");
        await history.getByText("Edited the first section").waitFor({ timeout: 5000 });
        assert.match((await history.textContent()) ?? "", /Memory created/u, "History lists every change");
        await fixPage.close();
      }
      {
        // #1588: clearing the memory search keeps focus in the search box, Create detail moves focus into the
        // new detail's text, and Cancel returns it to the button that opened the form.
        const detailPage = await browserContext.newPage();
        await detailPage.goto(`http://127.0.0.1:${address.port}/`);
        await detailPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await detailPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "detail");
          element.capabilityProps = { confirmAction: () => true };
          document.body.append(element);
        })()`);
        const detailSearch = detailPage.getByLabel("Search memories", { exact: true });
        await detailSearch.fill("Scoped desktop memory");
        await detailPage.getByRole("button", { name: "Clear memory search" }).click();
        assert.deepEqual(
          await detailSearch.evaluate((input) => [input === document.activeElement, (input as HTMLInputElement).value]),
          [true, ""],
          "clearing the memory search keeps focus in the empty search box",
        );
        await detailSearch.fill("Scoped desktop memory");
        const detailCard = detailPage
          .locator('[data-ltm-note-type="world"]')
          .filter({ hasText: /^Scoped desktop memory/u })
          .first();
        await detailCard.waitFor();
        await detailCard.locator("button").first().click();
        const createDetail = detailPage.getByRole("button", { name: "Add new memory section" });
        await createDetail.waitFor();
        await createDetail.click();
        await detailPage.locator("[data-ltm-details]").getByRole("button", { name: "Cancel", exact: true }).click();
        await detailPage.waitForFunction(
          () => document.activeElement?.textContent?.trim() === "Add new memory section",
        );
        await createDetail.click();
        const detailName = detailPage.locator("[data-ltm-details]").getByLabel("New section name");
        // A refused name is explained on the field, which keeps focus and links the reason.
        await detailName.fill("日本語");
        await detailPage.getByRole("button", { name: "Add section", exact: true }).click();
        await detailPage.locator("#ltm-new-section-error").waitFor();
        assert.match(await detailPage.locator("#ltm-new-section-error").innerText(), /letter A-Z or a number/u);
        await detailPage.waitForFunction(
          () => document.activeElement?.getAttribute("aria-label") === "New section name",
        );
        assert.match((await detailName.getAttribute("aria-describedby")) ?? "", /ltm-new-section-error/u);
        await detailName.fill("Facts");
        assert.equal(await detailPage.locator("#ltm-new-section-error").count(), 0, "typing clears the reason");
        const existingKey = await detailPage
          .locator("[data-ltm-details] textarea[data-ltm-field='section']")
          .first()
          .getAttribute("id");
        await detailName.fill(existingKey?.replace("ltm-section-", "") ?? "facts");
        await detailPage.getByRole("button", { name: "Add section", exact: true }).click();
        await detailPage.locator("#ltm-new-section-error").waitFor();
        assert.match(await detailPage.locator("#ltm-new-section-error").innerText(), /already exists/u);
        await detailPage.waitForFunction(
          () => document.activeElement?.getAttribute("aria-label") === "New section name",
        );
        await detailName.fill("habits");
        await detailPage.getByRole("button", { name: "Add section", exact: true }).click();
        await detailPage.waitForFunction(() => document.activeElement?.id === "ltm-section-habits");
        await detailPage.close();
      }
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
      assert.equal(await chatSettings.getAttribute("data-ltm-density"), "compact");
      const selectBox = await chatSettings.locator('select[data-ltm-control="select"]').first().boundingBox();
      assert.ok(selectBox);
      assert.ok(selectBox.height <= 38, `Expected compact select height <= 38px, got ${selectBox.height}`);
      // soup/ltm-settings-tidy: the drawer's guidance is a hint under each field, not an (i) button.
      assert.equal(await chatSettings.locator("[data-ltm-info]").count(), 0, "the drawer card has no (i) buttons");
      assert.match(
        await chatSettings.getByLabel("Memory budget", { exact: true }).evaluate((input) => {
          const ids = (input.getAttribute("aria-describedby") ?? "").split(/\s+/u);
          return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
        }),
        /Maximum number of tokens that recalled memories may add/u,
        "the budget hint is read with its field",
      );
      // soup/chat-recalled: the recall style is described in place (no popover, no "Current" chip) and follows the select.
      assert.equal(await chatSettings.locator('[data-ltm-info="Recall style"]').count(), 0);
      const styleDescription = chatSettings.locator("[data-ltm-recall-style-description]");
      await styleDescription.waitFor();
      assert.match(await styleDescription.innerText(), /Balanced suits most chats/u);
      assert.equal(await chatSettings.getByText("Current", { exact: true }).count(), 0);
      assert.equal(
        await chatSettings
          .getByLabel("Recall style", { exact: true })
          .evaluate(
            (select) =>
              select.getAttribute("aria-describedby") ===
              document.querySelector("[data-ltm-recall-style-description]")?.id,
          ),
        true,
      );
      // #1617: until the global defaults arrive, an inherited value shows a neutral placeholder, not 1024 / balanced.
      {
        const loadingPage = await browserContext.newPage();
        let releaseDefaults = () => {};
        const defaultsGate = new Promise<void>((resolve) => {
          releaseDefaults = resolve;
        });
        // The last-injection counter below belongs to the main page, so this page never reaches that route.
        await loadingPage.route("**/api/long-term-memory/last-injection/**", (route) => route.abort());
        await loadingPage.route("**/api/long-term-memory/settings", async (route) => {
          if (route.request().method() === "GET") await defaultsGate;
          await route.continue();
        });
        await loadingPage.goto(`http://127.0.0.1:${address.port}/`);
        await loadingPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await loadingPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "settings");
          element.capabilityProps = { chatId: "chat-artifact", onChatSettingsChange: () => undefined };
          document.body.append(element);
        })()`);
        const loadingSettings = loadingPage.locator('[data-ltm-surface="chat-settings"]');
        await loadingSettings.waitFor();
        const loadingStyle = loadingSettings.getByLabel("Recall style", { exact: true });
        const loadingBudget = loadingSettings.getByRole("spinbutton", { name: "Memory budget" });
        assert.equal(
          await loadingStyle.evaluate((select: HTMLSelectElement) => select.selectedOptions[0]?.textContent),
          "Loading default…",
        );
        for (const field of [loadingBudget]) {
          assert.equal(await field.inputValue(), "");
          assert.equal(await field.getAttribute("placeholder"), "Loading default…");
        }
        assert.equal(await loadingSettings.getByText("Default for all chats").count(), 0);
        releaseDefaults();
        await loadingPage.waitForFunction(
          (select) => (select as HTMLSelectElement).value === "balanced",
          await loadingStyle.elementHandle(),
        );
        assert.equal(await loadingBudget.inputValue(), "1024");
        // A settled load leaves no placeholder behind, so clearing a field to retype it never announces a load.
        for (const field of [loadingBudget]) {
          assert.equal(await field.getAttribute("placeholder"), null);
        }
        await loadingPage.close();
      }
      // soup/chat-recalled: recalled memories open in the Vault, "Details" explains the recall, and each changed field
      // offers one click back to the default for all chats.
      {
        const recalledPage = await browserContext.newPage();
        const noteQueriesBeforeRecalled = noteQueries.length;
        const attemptId = "7f1d2c3b-4a5e-4b6c-8d7e-9f0a1b2c3d4e";
        const recalledChanges: unknown[] = [];
        const settingsWrites: unknown[] = [];
        const attemptDebugEnabled = true;
        await recalledPage.exposeFunction("onRecalledChatSettingsChange", (patch: unknown) => {
          recalledChanges.push(patch);
        });
        let recalledOverride: Record<string, unknown> | null = null;
        await recalledPage.route("**/api/long-term-memory/last-injection/**", (route) =>
          route.fulfill({
            json: recalledOverride ?? {
              memoryCount: 1,
              tokenCount: 42,
              memories: [{ noteId: "world_legacy_global", title: "Legacy global memory", tokenCount: 42 }],
              state: "injected",
              dispatchedAt: "2026-07-30T00:00:00.000Z",
              attempt: {
                version: 1,
                chatId: "chat-artifact",
                attemptId,
                at: "2026-07-30T00:00:00.000Z",
                outcome: "completed",
                debugEnabled: attemptDebugEnabled,
                confirmed: true,
              },
            },
          }),
        );
        let explanationRequests = 0;
        await recalledPage.route("**/api/long-term-memory/debug-log?*", (route) => {
          // The header reading chip polls the extraction phase; only the recall explanation is asserted here.
          if (new URL(route.request().url()).searchParams.has("phase")) return route.fulfill({ json: { events: [] } });
          // An attempt that recorded no explanation (Details must not be offered for it).
          if (route.request().url().includes("operationId=attempt-unrecorded"))
            return route.fulfill({ json: { events: [] } });
          explanationRequests += 1;
          assert.match(route.request().url(), new RegExp(`operationId=${attemptId}`, "u"));
          return route.fulfill({
            json: {
              events: [
                {
                  id: "recall-explanation-event",
                  ts: "2026-07-30T00:00:00.000Z",
                  operationId: attemptId,
                  phase: "recall",
                  action: "recall_explanation",
                  status: "ok",
                  counts: { selected: 3 },
                  // Three added sections of two memories, and four left out for three reasons.
                  details: {
                    indexedChunks: 234,
                    eligibleChunks: 40,
                    maxTokens: 2048,
                    maxChunks: 12,
                    selected: [{ noteId: "note-a" }, { noteId: "note-a" }, { noteId: "note-b" }],
                    rejected: [
                      { noteId: "note-c", rejectionReason: "budget" },
                      { noteId: "note-d", rejectionReason: "budget" },
                      { noteId: "note-e", rejectionReason: "score_threshold" },
                      { noteId: "note-f", rejectionReason: "lower_rank" },
                      { noteId: "note-c", rejectionReason: "budget" },
                      { noteId: "note-a", rejectionReason: "prompt_budget" },
                    ],
                  },
                  chatId: "chat-artifact",
                },
              ],
            },
          });
        });
        await recalledPage.route("**/api/long-term-memory/settings", async (route) => {
          if (route.request().method() === "PUT") {
            settingsWrites.push(route.request().postDataJSON());
            return route.fulfill({ json: {} });
          }
          if (route.request().method() !== "GET") return route.continue();
          const response = await route.fetch();
          const body = await response.json();
          return route.fulfill({
            response,
            json: {
              ...body,
              longTermMemoryRecallStyle: "exact",
              longTermMemoryBudgetTokens: 2048,
            },
          });
        });
        await recalledPage.goto(`http://127.0.0.1:${address.port}/`);
        await recalledPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await recalledPage.evaluate(`(() => {
          const element = document.createElement("marinara-capability-long-term-memory");
          element.setAttribute("view", "settings");
          element.capabilityProps = {
            chatId: "chat-artifact",
            chatSettings: { longTermMemoryRecallStyle: "story", longTermMemoryBudgetTokens: 512 },
            onChatSettingsChange: window.onRecalledChatSettingsChange,
            onOpenAgentSettings: () => {
              const detail = document.createElement("marinara-capability-long-term-memory");
              detail.setAttribute("view", "detail");
              detail.capabilityProps = { chatId: "chat-artifact", confirmAction: () => true };
              document.body.append(detail);
            },
          };
          document.body.append(element);
        })()`);
        const recalledSettings = recalledPage.locator('[data-ltm-surface="chat-settings"]').last();
        const recalledSummary = recalledSettings.locator("[data-ltm-last-injection]");
        await recalledSummary.getByText("Used 1 memory").waitFor();
        // Per-field defaults: changed fields offer the way back with the default's value, the inherited one says so.
        assert.match(await recalledSettings.locator("[data-ltm-recall-style-description]").innerText(), /story/iu);
        await recalledSettings
          .locator('[data-ltm-default-reset="longTermMemoryRecallStyle"]')
          .getByText("Use the default for all chats (Exact)")
          .waitFor();
        await recalledSettings
          .locator('[data-ltm-default-reset="longTermMemoryBudgetTokens"]')
          .getByText("Use the default for all chats (2,048)")
          .waitFor();
        assert.equal(await recalledSettings.locator('[data-ltm-default-reset="longTermMemoryMaxChunks"]').count(), 0);
        await recalledSettings.locator('[data-ltm-default-reset="longTermMemoryBudgetTokens"]').click();
        for (let wait = 0; wait < 50 && recalledChanges.length === 0; wait += 1) await recalledPage.waitForTimeout(100);
        assert.deepEqual(
          recalledChanges,
          [{ longTermMemoryBudgetTokens: null }],
          "reset sends null so the default applies",
        );
        // A saved per-chat field says so beside itself, and number fields are sized to their numbers.
        await recalledSettings
          .locator('[data-ltm-chat-saved="longTermMemoryBudgetTokens"]')
          .getByText("Saved", { exact: true })
          .waitFor();
        const drawerNumber = await recalledSettings.locator('[data-ltm-control="number"]').first().boundingBox();
        assert.ok(
          drawerNumber && drawerNumber.width <= 128,
          `a drawer number field is compact (${drawerNumber?.width})`,
        );
        // The card only reads the recall explanation (for its "left out" line) and writes nothing.
        assert.equal(await recalledSummary.locator("[data-ltm-recall-details]").count(), 0);
        assert.equal(await recalledSummary.locator("[data-ltm-recall-turn-on]").count(), 0);
        assert.deepEqual(settingsWrites, [], "the card writes no setting");
        // Part 2: three memories were left out (two by the token limit, one by the count), so the card names the token
        // limit, and Raise limit focuses that field.
        const leftOut = recalledSummary.locator('[data-ltm-card-problem="leftOut"]');
        await leftOut.getByText("3 more left out to fit the limit", { exact: true }).waitFor();
        assert.equal(await recalledSummary.locator("[data-ltm-card-problem]").count(), 1, "at most one problem line");
        assert.ok(explanationRequests >= 1, "the card reads the recall's explanation");
        await leftOut.getByRole("button", { name: "Raise limit", exact: true }).click();
        const budgetField = recalledSettings.getByRole("spinbutton", { name: "Memory budget" });
        for (let wait = 0; wait < 20 && !(await budgetField.evaluate((el) => el === document.activeElement)); wait += 1)
          await recalledPage.waitForTimeout(50);
        assert.ok(
          await budgetField.evaluate((el) => el === document.activeElement),
          "Raise limit focuses the token limit",
        );
        // The Agent activity panel (Capability API 1.820) mounts the same card: same lines, Open leaves through
        // onOpenAgentSettings, no Raise limit (the panel has no limit fields), and nothing without a chat.
        await recalledPage.evaluate(`(() => {
          window.activityOpened = 0;
          const element = document.createElement("marinara-capability-long-term-memory");
          element.id = "ltm-activity-view";
          element.setAttribute("view", "activity");
          element.capabilityProps = { chatId: "chat-artifact", onOpenAgentSettings: () => { window.activityOpened += 1; } };
          const bare = document.createElement("marinara-capability-long-term-memory");
          bare.id = "ltm-activity-bare";
          bare.setAttribute("view", "activity");
          bare.capabilityProps = {};
          document.body.append(element, bare);
        })()`);
        const activityCard = recalledPage.locator("#ltm-activity-view [data-ltm-activity-card]");
        await activityCard.getByText("Used 1 memory").waitFor();
        await activityCard
          .locator('[data-ltm-card-problem="leftOut"]')
          .getByText("3 more left out to fit the limit", { exact: true })
          .waitFor();
        assert.equal(await activityCard.getByRole("button", { name: "Raise limit" }).count(), 0, "no dead Raise limit");
        await activityCard.locator("[data-ltm-card-open]").click();
        assert.equal(await recalledPage.evaluate("window.activityOpened"), 1, "Open uses onOpenAgentSettings");
        assert.equal(await recalledPage.locator("#ltm-activity-bare").innerHTML(), "", "no chat, no card");
        // Nothing recalled and nothing to say: the panel card renders nothing, so the Engine's own empty line shows.
        recalledOverride = {
          memoryCount: 0,
          tokenCount: 0,
          memories: [],
          state: "not_recorded",
          dispatchedAt: null,
          attempt: null,
        };
        const quietRead = recalledPage.waitForResponse((response) => response.url().includes("/last-injection/"));
        await recalledPage.evaluate(async () => {
          const element = document.querySelector("#ltm-activity-view")!;
          element.remove();
          await new Promise((resolve) => setTimeout(resolve, 0));
          document.body.append(element);
        });
        await quietRead;
        await recalledPage.waitForTimeout(200);
        assert.equal(await recalledPage.locator("#ltm-activity-view").innerHTML(), "", "nothing to say, no card");
        recalledOverride = null;
        await recalledPage.evaluate(
          `document.querySelectorAll("#ltm-activity-view, #ltm-activity-bare").forEach((el) => el.remove())`,
        );
        // The chat card keeps the quiet read it just cached (nothing polls it here), so mount it again to read the
        // recall back.
        await recalledPage.evaluate(async () => {
          const element = document.querySelector("marinara-capability-long-term-memory")!;
          element.remove();
          await new Promise((resolve) => setTimeout(resolve, 0));
          document.body.append(element);
        });
        // A title shows that memory's text in place, with a way to open it in the Vault.
        await recalledSummary.locator('[data-ltm-recalled-note="world_legacy_global"]').click();
        await recalledSummary.getByText("Legacy global memory text.", { exact: true }).waitFor();
        // The other part-1 moments: nothing matched (with and without the available count) and a recall that did not run.
        const remountRecalled = () =>
          recalledPage.evaluate(async () => {
            const element = document.querySelector("marinara-capability-long-term-memory")!;
            element.remove();
            await new Promise((resolve) => setTimeout(resolve, 0));
            document.body.append(element);
          });
        const attempt = (outcome: string, extra: Record<string, unknown> = {}) => ({
          version: 1,
          chatId: "chat-artifact",
          attemptId,
          at: "2026-07-30T00:00:00.000Z",
          outcome,
          debugEnabled: false,
          confirmed: outcome === "completed",
          ...extra,
        });
        const emptyReceipt = { memoryCount: 0, tokenCount: 0, memories: [], dispatchedAt: "2026-07-30T00:00:00.000Z" };
        recalledOverride = {
          ...emptyReceipt,
          state: "no_matches",
          availableCount: 248,
          attempt: attempt("completed", { reason: "no_matches" }),
        };
        await remountRecalled();
        await recalledSummary.getByText("No memories used · 248 available", { exact: true }).waitFor();
        recalledOverride = {
          ...emptyReceipt,
          state: "no_matches",
          attempt: attempt("completed", { reason: "no_matches" }),
        };
        await remountRecalled();
        await recalledSummary.getByText("No memories used", { exact: true }).waitFor();
        for (const skipped of [
          attempt("skipped", { reason: "empty_query", attemptId: "attempt-unrecorded" }),
          attempt("failed", { attemptId: "attempt-unrecorded" }),
        ]) {
          recalledOverride = {
            memoryCount: 1,
            tokenCount: 42,
            memories: [{ noteId: "world_legacy_global", title: "Legacy global memory", tokenCount: 42 }],
            state: "injected",
            dispatchedAt: "2026-07-30T00:00:00.000Z",
            availableCount: 248,
            attempt: skipped,
          };
          await remountRecalled();
          await recalledSummary.getByText("Memory wasn't used this reply", { exact: true }).waitFor();
          const reason = recalledSummary.locator('[data-ltm-card-problem="recall"]');
          await reason
            .getByText(skipped.outcome === "failed" ? "The recall failed" : "There was no recent context to search", {
              exact: true,
            })
            .waitFor();
          // These attempts recorded no explanation, so Activity has nothing to open and Details is not offered.
          assert.equal(await reason.getByRole("button", { name: "Details" }).count(), 0);
          assert.equal(await recalledSummary.getByText(/No memories used/u).count(), 0);
          assert.equal(await recalledSummary.locator("[data-ltm-recalled-note]").count(), 0);
        }
        recalledOverride = null;
        await remountRecalled();
        await recalledSummary.getByText("Used 1 memory").waitFor();
        await recalledSummary.locator('[data-ltm-recalled-note="world_legacy_global"]').click();
        await recalledSummary.getByText("Legacy global memory text.", { exact: true }).waitFor();
        // "Open in Vault" opens the memory in the Vault.
        const noteRead = recalledPage.waitForRequest((request) =>
          /\/notes\/world_legacy_global$/u.test(new URL(request.url()).pathname),
        );
        await recalledSummary.locator('[data-ltm-recalled-open-vault="world_legacy_global"]').click();
        await recalledPage.locator('[data-ltm-surface="vault"]').first().waitFor({ timeout: 5_000 });
        await noteRead;
        // The opened Vault lists notes with no place on this page, not the main page: let it finish, then drop its
        // queries so the later "last notes query" assertion keeps reading the main page's own list.
        await recalledPage.waitForLoadState("networkidle");
        noteQueries.length = noteQueriesBeforeRecalled;
        await recalledPage.close();
      }
      const lastInjection = chatSettings.locator("[data-ltm-last-injection]");
      await lastInjection.getByText("Used 1 memory").waitFor();
      await lastInjection.getByText("Retained memory").waitFor();
      assert.equal(await lastInjection.getByText("42 tokens").count(), 0, "the card shows no token count");
      await page.evaluate(async () => {
        const element = document.querySelectorAll("marinara-capability-long-term-memory").item(1)!;
        element.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));
        document.body.append(element);
      });
      await lastInjection.locator('[data-ltm-status="danger"]').waitFor();
      // D18: compact Retry keeps a 24px target.
      const compactRetry = lastInjection.getByRole("button", { name: /retry/i });
      const compactRetryBox = await compactRetry.boundingBox();
      assert.ok(compactRetryBox && compactRetryBox.height >= 24, "compact Retry keeps a 24px target");
      let releaseLastInjection = () => {};
      lastInjectionHold = new Promise<void>((resolve) => {
        releaseLastInjection = resolve;
      });
      await compactRetry.click();
      // D27 repair: a cached-data retry still shows the title without a loading flash,
      // but the Retry control stays aria-disabled (and focusable) while that refetch is in flight.
      await page.waitForFunction(() => {
        const button = [...document.querySelectorAll("[data-ltm-last-injection] button")].find((candidate) =>
          /retry/i.test(candidate.textContent ?? ""),
        );
        return (
          button instanceof HTMLButtonElement && button.getAttribute("aria-disabled") === "true" && !button.disabled
        );
      });
      // Enter and Space still fire onClick on an aria-disabled button: a held retry sends no second request.
      await compactRetry.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Space");
      await page.waitForTimeout(150);
      assert.equal(lastInjectionRequests, 3, "a held Retry sends exactly one request");
      lastInjectionHold = null;
      releaseLastInjection();
      await page.waitForFunction(() => {
        const button = [...document.querySelectorAll("[data-ltm-last-injection] button")].find((candidate) =>
          /retry/i.test(candidate.textContent ?? ""),
        );
        return button instanceof HTMLButtonElement && !button.hasAttribute("aria-disabled");
      });
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
        ["vault", "review", "sources", "activity", "settings"],
      );
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="review"]').click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').waitFor();
      assert.ok(reviewQueries.length > 0);
      assert.ok(reviewQueries.every((query) => query === "?includeInvalidated=true"));
      assert.ok(rejectedSuggestionQueries.length > 0);
      assert.ok(rejectedSuggestionQueries.every((query) => query === "" || query === "?includeResolved=true"));
      assert.ok(rejectedSuggestionQueries.some((query) => query === "?includeResolved=true"));
      assert.ok(reviewContextQueries.length > 0);
      assert.ok(reviewContextQueries.every((query) => query.startsWith("?ids=")));
      assert.ok(reviewContextQueries.some((query) => query.includes("world_merge_target_mobile")));
      assert.equal(
        reviewContextQueries.some((query) => query.includes("includeGlobal")),
        false,
      );
      assert.equal(
        reviewContextQueries.some((query) => query.includes("limit=500")),
        false,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      healthState = "degraded";
      await page.reload();
      await page.evaluate((version) => {
        localStorage.setItem("marinara-long-term-memory-onboarding-v1", "beat:2");
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
      // soup/setup-beats: setup never opens on its own; Help resumes it at the saved beat.
      await page.waitForTimeout(300);
      assert.equal(await page.locator('[data-ltm-surface="onboarding"]').count(), 0);
      await page.locator("[data-ltm-onboarding-help]").click();
      await page.locator("[data-ltm-help-setup]").click();
      const restoredGuide = page.locator('[data-ltm-surface="onboarding"][data-ltm-setup-beat="2"]');
      await restoredGuide.waitFor();
      // The pictures are 128x192 frames drawn at 1x on a phone, so the pixel art stays sharp.
      const restoredSprite = restoredGuide.locator('[data-ltm-setup-sprite="archivist-modes"]');
      await restoredSprite.waitFor();
      assert.deepEqual(
        await restoredSprite.evaluate((sprite) => {
          const rect = sprite.getBoundingClientRect();
          return { width: Math.round(rect.width), height: Math.round(rect.height) };
        }),
        { width: 128, height: 192 },
      );
      await restoredGuide.locator("[data-ltm-setup-close]").click();
      await restoredGuide.waitFor({ state: "detached" });
      // Later keeps the saved beat for the next visit.
      assert.equal(
        await page.evaluate(() => localStorage.getItem("marinara-long-term-memory-onboarding-v1")),
        "beat:2",
      );
      // #1588: closing setup returns focus to the button that reopens it.
      await page.waitForFunction(() => document.activeElement?.matches("[data-ltm-onboarding-help]") ?? false);
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
      // soup/review-one-press: the Review tab counts the memories waiting (2 sources x 3), not the 2 sources.
      assert.equal(
        await page
          .locator('[data-ltm-navigation="mobile"] [data-ltm-destination="review"] [data-ltm-badge]')
          .innerText(),
        "6",
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
      // soup/ltm-frame: the reindex notice is one slim line with its action and no (i).
      assert.equal(await page.locator('[data-ltm-surface="vault-health-warning"] [data-ltm-info]').count(), 0);
      // #1588: the warning banner shows StatusSurface's icon once, not a second one of its own.
      assert.equal(
        await page.locator('[data-ltm-surface="vault-health-warning"]').getAttribute("data-ltm-status"),
        "warning",
      );
      assert.equal(await page.locator('[data-ltm-surface="vault-health-warning"] [data-ltm-status-icon]').count(), 1);
      assert.equal(
        await page.locator('[data-ltm-surface="vault-health-warning"] svg.lucide-triangle-alert').count(),
        1,
      );
      // soup/: the banner names no Settings path; it carries the Reindex now button in place.
      assert.doesNotMatch(
        await page.locator('[data-ltm-surface="vault-health-warning"]').innerText(),
        /Settings >|Maintenance|→/u,
      );
      assert.equal(
        await page
          .locator('[data-ltm-surface="vault-health-warning"]')
          .getByRole("button", { name: "Reindex now" })
          .count(),
        1,
      );
      // #1588: the Reindex result shows under the health banner.
      let failReindex = true;
      let reindexRequests = 0;
      let releaseReindex: (() => void) | null = null;
      const reindexHeld = new Promise<void>((resolve) => {
        releaseReindex = resolve;
      });
      await page.route("**/api/long-term-memory/repair", async (route) => {
        reindexRequests += 1;
        if (failReindex) {
          failReindex = false;
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Reindex fixture failed" }),
          });
        }
        await reindexHeld;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
      const reindexButton = page
        .locator('[data-ltm-surface="vault-health-warning"]')
        .getByRole("button", { name: "Reindex now" });
      const reindexResult = (state: string) =>
        page.locator(`[data-ltm-reindex-result="${state}"]`).evaluate((result) => ({
          role: result.getAttribute("role"),
          text: result.textContent?.trim(),
          inPopover: Boolean(result.closest("[data-ltm-info-panel]")),
          afterBanner: Boolean(
            document.querySelector('[data-ltm-surface="vault-health-warning"]')?.compareDocumentPosition(result) ===
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        }));
      await reindexButton.click();
      await page.locator('[data-ltm-reindex-result="danger"]').waitFor();
      assert.deepEqual(await reindexResult("danger"), {
        role: "alert",
        text: "Reindex fixture failed",
        inPopover: false,
        afterBanner: true,
      });
      await reindexButton.click();
      await page.locator('[data-ltm-reindex-result="pending"]').waitFor();
      assert.deepEqual(await reindexResult("pending"), {
        role: "status",
        text: "Reindexing recall data...",
        inPopover: false,
        afterBanner: true,
      });
      // Pending keeps keyboard focus: the button stays focused and named, is aria-disabled instead of `disabled`,
      // and a second Enter or click starts no second reindex.
      assert.equal(await reindexButton.getAttribute("aria-disabled"), "true");
      assert.equal(await reindexButton.evaluate((button) => button.matches(":disabled")), false);
      assert.equal(await reindexButton.evaluate((button) => button === document.activeElement), true);
      await page.keyboard.press("Enter");
      await reindexButton.dispatchEvent("click");
      await page.waitForTimeout(150);
      assert.equal(reindexRequests, 2);
      assert.equal(await reindexButton.evaluate((button) => button === document.activeElement), true);
      releaseReindex?.();
      await page.locator('[data-ltm-reindex-result="success"]').waitFor();
      assert.deepEqual(await reindexResult("success"), {
        role: "status",
        text: "Reindex finished.",
        inPopover: false,
        afterBanner: true,
      });
      // #1588: the result shows once.
      assert.equal(await page.getByText("Reindex finished.").count(), 1);
      // #1588: a reindex that ends after you leave its screen shows its outcome on no screen, including the
      // one you return to.
      await page.unroute("**/api/long-term-memory/repair");
      let releaseLateReindex = () => {};
      const lateReindexHeld = new Promise<void>((resolve) => {
        releaseLateReindex = resolve;
      });
      await page.route("**/api/long-term-memory/repair", async (route) => {
        await lateReindexHeld;
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Late reindex failed" }),
        });
      });
      await reindexButton.click();
      await page.locator('[data-ltm-reindex-result="pending"]').waitFor();
      await page.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="review"]').click();
      await page.locator("[data-ltm-reindex-result]").waitFor({ state: "detached" });
      releaseLateReindex();
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLButtonElement>('[data-ltm-surface="vault-health-warning"] button')].some(
          (button) => button.textContent?.includes("Reindex now") && button.getAttribute("aria-disabled") !== "true",
        ),
      );
      assert.equal(await page.locator("[data-ltm-reindex-result]").count(), 0);
      await page.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="vault"]').click();
      assert.equal(await page.locator("[data-ltm-reindex-result]").count(), 0);
      await page.unroute("**/api/long-term-memory/repair");

      const showWorkspacePane = async (pane: "navigator" | "workbench" | "inspector") => {
        const target = page.locator(`[data-ltm-workspace-pane="${pane}"]`);
        if (!(await target.isVisible())) {
          // ResizeObserver renders the mobile tabs asynchronously after a viewport change.
          const tab = page.locator(`[data-ltm-workspace-pane-tab="${pane}"]`);
          await tab.waitFor({ state: "visible" });
          await tab.click();
        }
        await target.waitFor({ state: "visible" });
      };
      const missingSources = ["source_deleted", "source_vanished"];
      for (const [index, sourceNoteId] of missingSources.entries()) {
        const draft = makeReviewDraft(
          `10000000-0000-4000-8000-00000000003${index}`,
          `10000000-0000-4000-8000-00000000004${index}`,
          "Missing-source memory",
        );
        draft.source.sourceNoteId = sourceNoteId;
        const mutation = draft.mutations[0] as any;
        reviewSources.push({
          sourceNoteId,
          modes: ["roleplay"],
          drafts: [
            {
              draft,
              // Also cover a source disappearing after the server's freshness check.
              freshness: index === 0 ? "missing" : "fresh",
              blockReasons:
                index === 0 ? [{ code: "source_missing", message: "The source note no longer exists." }] : [],
              diagnostics: [],
              candidateRejections: [],
              deduplications: [],
            },
          ],
          targets: [
            {
              noteId: mutation.note.id,
              title: mutation.note.title,
              noteType: "world",
              rows: [{ draftId: draft.id, mutation, disposition: "new", diagnostics: [], changes: [] }],
            },
          ],
        });
      }
      missingSourceReview = true;
      failReviewContext = true;
      await page.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="review"]').click();
      const reviewContextError = page
        .locator('[data-ltm-status="danger"]')
        .filter({ hasText: "Memory context could not load." });
      await reviewContextError.waitFor();
      assert.match(await reviewContextError.innerText(), /review context temporarily unavailable/u);
      assert.equal(await page.locator("[data-ltm-workspace]").isVisible(), false);
      assert.equal(await page.locator("[data-ltm-review-action]:visible").count(), 0);
      const reviewUtilitySizes = await page
        .locator('[data-ltm-status="danger"] button, [data-ltm-review-rejected-count]')
        .evaluateAll((elements) =>
          elements
            .map((element) => element.getBoundingClientRect().toJSON())
            .filter((rect) => rect.width > 0 && rect.height > 0),
        );
      assert.ok(
        reviewUtilitySizes.length >= 1 && reviewUtilitySizes.every((rect) => rect.width >= 44 && rect.height >= 44),
        JSON.stringify(reviewUtilitySizes),
      );
      failReviewContext = false;
      // The review-context failure is transient: a single Retry re-fetches the notes context and, once the
      // request settles, restores the workspace. (world_second_mobile is an optional context note fetched
      // with allowMissing=true, so it must not be omitted here or the later review content assertions fail.)
      await reviewContextError.getByRole("button", { name: "Retry" }).click();
      await page.locator('[data-ltm-review-source-select="source_deleted"]').waitFor();
      assert.equal(await reviewContextError.isVisible(), false);
      for (const sourceNoteId of [...missingSources, "source_orphaned_suggestion"]) {
        await showWorkspacePane("navigator");
        const source = page.locator(`[data-ltm-review-source-select="${sourceNoteId}"]`);
        assert.match(await source.innerText(), /Deleted source/u);
        await source.click();
        await showWorkspacePane("workbench");
        const warning = page.locator("[data-ltm-review-source-missing]");
        await warning.waitFor();
        assert.match(await warning.innerText(), /cannot be accepted/u);
        // soup/: the missing-source note carries the Sources handoff instead of describing the path.
        assert.equal(await warning.getByRole("button", { name: "Import sources" }).count(), 1);
        // Scoped to the workbench: Review's page-level "Skipped" list has its own Open source buttons.
        assert.equal(
          await page
            .locator('[data-ltm-workspace-pane="workbench"]')
            .getByRole("button", { name: "Open source", exact: true })
            .count(),
          0,
        );
        if (missingSources.includes(sourceNoteId)) {
          assert.equal(await page.locator("[data-ltm-review-mutation]").count(), 1);
          assert.equal(await page.locator("[data-ltm-review-action]").isDisabled(), true);
          await page.locator("[data-ltm-review-mutation]").getByRole("checkbox").check();
          assert.equal(await page.locator("[data-ltm-review-batch-actions] button").first().isDisabled(), true);
          await page.locator("[data-ltm-review-mutation]").getByRole("checkbox").uncheck();
        } else {
          await page.locator("[data-ltm-rejected-suggestions] > summary").click();
          assert.equal(await page.locator("[data-ltm-clear-rejected-suggestions]").isEnabled(), true);
        }
      }
      if (visualOutputDir) {
        await showWorkspacePane("navigator");
        await page.locator('[data-ltm-review-source-select="source_deleted"]').click();
        await showWorkspacePane("workbench");
        await page.screenshot({
          path: join(visualOutputDir, "long-term-memory-missing-source-mobile.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.screenshot({
          path: join(visualOutputDir, "long-term-memory-missing-source-desktop.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
      }
      await showWorkspacePane("navigator");
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').waitFor();
      const restoredContextSource = page.locator('[data-ltm-review-source-select="source_mobile_review"]');
      if ((await restoredContextSource.getAttribute("aria-expanded")) === "false") {
        await restoredContextSource.click();
      }
      await showWorkspacePane("navigator");
      await page.locator(`[data-ltm-review-draft-select="${reviewDraftIds.first}"]`).click();
      await showWorkspacePane("workbench");
      // soup/review-one-press: one "Add to memory" button per change, enabled, with what it does shown beforehand.
      const restoredAccept = page.locator(
        `[data-ltm-review-mutation="${reviewMutationIds.first}"] [data-ltm-review-action="add"]`,
      );
      await restoredAccept.waitFor();
      assert.equal(await restoredAccept.isDisabled(), false);
      assert.match((await restoredAccept.getAttribute("aria-label")) ?? "", /^Add .+ to memory$/u);
      assert.equal(await restoredAccept.innerText(), "Add to memory");
      assert.equal(
        await page
          .locator(`[data-ltm-review-mutation="${reviewMutationIds.first}"] [data-ltm-review-add-effect]`)
          .count(),
        1,
      );
      assert.equal(
        await page
          .locator(`[data-ltm-review-mutation="${reviewMutationIds.first}"] [data-ltm-review-edit]`)
          .innerText(),
        "Edit",
      );
      const firstMutation = page.locator(`[data-ltm-review-mutation="${reviewMutationIds.first}"]`);
      assert.equal(await firstMutation.locator("[data-ltm-review-summary]").count(), 1);
      assert.equal(await firstMutation.locator("[data-ltm-review-evidence-summary]").count(), 1);
      // The Change line uses the Vault row's "Label: text" preview, with the full text color (#1654).
      // (An inline callback: a named helper inside evaluate gets tsx's `__name`, which the page does not define.)
      const changeColors = await firstMutation.evaluate((row) => {
        const node = row.querySelector("[data-ltm-review-summary]")!;
        return { text: getComputedStyle(node).color, label: getComputedStyle(node.children[0]!).color };
      });
      assert.equal(changeColors.text, changeColors.label, "the Change line uses the full text color");
      // A card with no quoted line says which source it is from, and its meta line names the source too.
      assert.equal(await firstMutation.locator("[data-ltm-review-quote]").count(), 0);
      assert.match(await firstMutation.locator("[data-ltm-review-evidence-summary]").innerText(), /^From /u);
      assert.match(await firstMutation.locator("[data-ltm-review-meta]").innerText(), / from /u);
      // Every card names what adding it does with one action chip, and Discard is a labelled button.
      assert.equal(await firstMutation.locator("[data-ltm-review-operation]").count(), 1);
      assert.equal(await firstMutation.getByRole("button", { name: /^Discard suggestion /u }).innerText(), "Discard");
      assert.equal(await firstMutation.locator("[data-ltm-review-disclosure]").getAttribute("aria-expanded"), "false");
      // An accept keeps the queue on screen while its memory context reloads, and every action waits for the
      // reloaded context (#1584).
      const reviewWorkspace = page.locator('[data-ltm-surface="review-queue"] [data-ltm-workspace-container]');
      const reviewContextRoute = (url: URL) =>
        url.pathname.endsWith("/api/long-term-memory/notes") && url.searchParams.has("ids");
      // #1588: focus moves to the next change, to the inline result of a run that needs attention, or (a clean run
      // reports in a toast) to the review queue itself, instead of the page.
      const reviewNextChange = '[data-ltm-surface="review-queue"] [data-ltm-review-mutation-toggle]';
      const reviewQueueRoot = '[data-ltm-surface="review-queue"]';
      const reviewFocusMoved = async (selector: string) => {
        await page.waitForFunction((target) => document.activeElement?.matches(target) ?? false, selector);
      };
      const acceptWithReviewContextHeld = async (
        mutationId: string,
        accept: () => Promise<void>,
        whileHeld = async () => {},
      ) => {
        await reviewWorkspace.evaluate((workspace) => {
          const record = { hidden: false };
          (window as Window & { reviewWorkspaceHidden?: typeof record }).reviewWorkspaceHidden = record;
          new MutationObserver(() => {
            if (workspace.classList.contains("hidden")) record.hidden = true;
          }).observe(workspace, { attributes: true, attributeFilter: ["class"] });
        });
        let releaseReviewContext = () => {};
        const reviewContextHeld = new Promise<void>((resolve) => {
          releaseReviewContext = resolve;
        });
        await page.route(reviewContextRoute, async (route) => {
          await reviewContextHeld;
          await route.continue();
        });
        // The refresh is announced through a status line that is already mounted, so its text change is heard.
        const reviewContextStatus = page.locator(
          '[data-ltm-surface="review-queue"] [role="status"][data-ltm-review-context-status]',
        );
        assert.equal(await reviewContextStatus.count(), 1, "the context status line is mounted before the accept");
        assert.equal(await reviewContextStatus.textContent(), "");
        await accept();
        await page.waitForFunction((id) => !document.querySelector(`[data-ltm-review-mutation="${id}"]`), mutationId);
        assert.equal(await reviewWorkspace.isVisible(), true, "the queue stays on screen while its context reloads");
        assert.equal(await page.locator("[data-ltm-review-context-refreshing]").count(), 1);
        assert.equal(await reviewContextStatus.textContent(), "Loading memory context.");
        assert.deepEqual(
          await page
            .locator('[data-ltm-surface="review-queue"] [data-ltm-review-action]')
            .evaluateAll(
              (actions) =>
                actions.filter(
                  (action) =>
                    !(action as HTMLButtonElement).disabled && action.getAttribute("aria-disabled") !== "true",
                ).length,
            ),
          0,
          "no change can be accepted against the reloading context",
        );
        await whileHeld();
        releaseReviewContext();
        await page.locator("[data-ltm-review-context-refreshing]").waitFor({ state: "detached" });
        await page.unroute(reviewContextRoute);
        assert.equal(await reviewContextStatus.textContent(), "");
        assert.equal(
          await page.evaluate(
            () => (window as Window & { reviewWorkspaceHidden?: { hidden: boolean } }).reviewWorkspaceHidden?.hidden,
          ),
          false,
          "the queue is never hidden during the accept",
        );
      };
      // The next draft and the keyboard position survive the accept.
      await acceptWithReviewContextHeld(
        reviewMutationIds.first,
        () =>
          page
            .locator(`[data-ltm-review-mutation="${reviewMutationIds.first}"] [data-ltm-review-action="add"]`)
            .click(),
        async () => {
          assert.equal(await page.locator(`[data-ltm-review-draft-select="${reviewDraftIds.second}"]`).count(), 1);
          // Another change is left in the queue, so focus lands on it, not on the fallback.
          await reviewFocusMoved(reviewNextChange);
          await page.keyboard.press("Tab");
          assert.equal(
            await page.evaluate(() => Boolean(document.activeElement?.closest('[data-ltm-surface="review-queue"]'))),
            true,
            "Tab after the accept continues inside the queue",
          );
        },
      );
      // soup/review-one-press: that one press added the change; no separate "Check" press came first.
      assert.deepEqual(reviewActionCalls, [
        { action: "accept", draftId: reviewDraftIds.first, mutationIds: [reviewMutationIds.first] },
      ]);
      reviewSources = reviewSources.filter((source) => !missingSources.includes(source.sourceNoteId));
      missingSourceReview = false;
      const mergeSource = page.locator('[data-ltm-review-source-select="source_mobile_review"]');
      if ((await mergeSource.getAttribute("aria-expanded")) === "false") {
        await mergeSource.click();
      }
      await showWorkspacePane("navigator");
      await page.locator(`[data-ltm-review-draft-select="${reviewDraftIds.merge}"]`).click();
      await showWorkspacePane("workbench");
      const mergeMutation = page.locator(`[data-ltm-review-mutation="${reviewMutationIds.merge}"]`);
      await mergeMutation.locator("[data-ltm-review-mutation-toggle]").click();
      await mergeMutation.getByRole("button", { name: "Open memory" }).click();
      await page.locator('[data-ltm-surface="vault"]').waitFor();
      await page.locator("[data-ltm-note-editor]").waitFor();
      assert.equal(await page.locator("[data-ltm-note-editor] input").first().inputValue(), "Existing merge target");
      await page.locator('[data-ltm-control="navigation"][data-ltm-destination="review"]').last().click();
      await page.locator('[data-ltm-review-source-select="source_mobile_review"]').waitFor();
      await showWorkspacePane("navigator");
      const restoredReviewSource = page.locator('[data-ltm-review-source-select="source_mobile_review"]');
      if ((await restoredReviewSource.getAttribute("aria-expanded")) === "false") {
        await restoredReviewSource.click();
      }
      await showWorkspacePane("navigator");
      await page.locator('[data-ltm-review-draft-select="10000000-0000-4000-8000-000000000012"]').click();
      await showWorkspacePane("workbench");
      await page.locator("[data-ltm-review-draft-title]").waitFor();
      assert.equal(
        await page.locator("[data-ltm-review-draft-title]").innerText(),
        "Second mobile review memory summary",
      );
      assert.equal(
        await page
          .locator('[data-ltm-workspace-pane="workbench"]')
          .getByText("Source note: Mobile review source", { exact: true })
          .count(),
        1,
      );
      const reviewText = await page.locator('[data-ltm-workspace-pane="workbench"]').innerText();
      assert.match(reviewText, /Second mobile review memory/u);
      assert.match(reviewText, /Second mobile review memory text\./u);
      assert.match(reviewText, /World/u);
      assert.match(reviewText, /Update section/u);
      assert.match(reviewText, /Major/u);
      // Each card carries one action chip; the update card quotes the line it came from.
      const secondReviewMutation = page.locator(`[data-ltm-review-mutation="${reviewMutationIds.second}"]`);
      assert.equal(
        await secondReviewMutation.locator("[data-ltm-review-operation]").getAttribute("data-ltm-review-operation"),
        "update_section",
      );
      assert.equal(
        await secondReviewMutation.locator("[data-ltm-review-evidence-summary][data-ltm-review-quote]").innerText(),
        "\u201cRika: I have kept the lighthouse key.\u201d",
      );
      if (visualOutputDir)
        await page.screenshot({ path: join(visualOutputDir, "long-term-memory-review-mobile.png"), fullPage: true });
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.second}"] [data-ltm-review-mutation-toggle]`)
        .click();
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
      await showWorkspacePane("navigator");
      await page.locator('[data-ltm-review-draft-select="10000000-0000-4000-8000-000000000012"]').click();
      await showWorkspacePane("workbench");
      await page.setViewportSize({ width: 1280, height: 900 });
      const acceptButtonSize = await page
        .locator("[data-ltm-review-mutation] [data-ltm-review-action]")
        .first()
        .evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const icon = button.querySelector("svg")!;
          return {
            width: rect.width,
            height: rect.height,
            iconWidth: icon.getAttribute("width"),
            iconHeight: icon.getAttribute("height"),
            visibleText: (button as HTMLElement).innerText,
            iconShown: getComputedStyle(icon).display !== "none",
            chips: button.closest("[role=group]")!.querySelectorAll("[data-ltm-review-state-chip]").length,
            edit: button.closest("[role=group]")!.querySelector("[data-ltm-review-edit]")?.textContent ?? null,
          };
        });
      assert.ok(acceptButtonSize.width >= 44);
      assert.ok(acceptButtonSize.height >= 44);
      // soup/review-one-press: the one commit control always says "Add to memory" and Edit sits beside it, at any width.
      assert.equal(acceptButtonSize.visibleText, "Add to memory");
      assert.equal(acceptButtonSize.edit, "Edit");
      assert.equal(acceptButtonSize.iconShown, true);
      assert.equal(acceptButtonSize.chips, 0);
      assert.equal(acceptButtonSize.iconWidth, "1rem");
      assert.equal(acceptButtonSize.iconHeight, "1rem");
      if (visualOutputDir)
        await page.screenshot({ path: join(visualOutputDir, "long-term-memory-review-desktop.png"), fullPage: true });
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
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.partial}"] [data-ltm-review-mutation-toggle]`)
        .click();
      // #1588: on a phone the batch bar sits above the rows and sticks to the top of the scroller, so it stays
      // in view at the end of a long draft; the compact row checkbox and the preview summary are 44px targets.
      const reviewWorkbench = page.locator("[data-ltm-review-workbench]");
      const reviewBatchBar = page.locator("[data-ltm-review-batch-actions]");
      await dockDetailPanel(page, "");
      await reviewWorkbench.evaluate((workbench) => {
        (workbench as HTMLElement).style.minHeight = "250vh";
      });
      assert.equal(await stickyBarInView(reviewBatchBar, "bottom"), "in view");
      if (visualOutputDir)
        await page.screenshot({ path: join(visualOutputDir, "long-term-memory-review-batch-bar-mobile.png") });
      // Shift+Tab onto a row checkbox that sits under the stuck bar scrolls it out from under the bar.
      const partialRowCheckbox = page.locator(
        `[data-ltm-review-mutation="${reviewMutationIds.partial}"] [data-ltm-control="review-select"]`,
      );
      const partialCheckboxState = () =>
        partialRowCheckbox.evaluate((checkbox) => {
          const bar = document.querySelector("[data-ltm-review-batch-actions]")!.getBoundingClientRect();
          const rect = checkbox.getBoundingClientRect();
          const focus = document.activeElement === checkbox ? "focused" : "unfocused";
          return `${focus} ${rect.bottom > bar.top && rect.top < bar.bottom ? "under bar" : "clear"}`;
        });
      await partialRowCheckbox.evaluate((checkbox) => {
        const bar = document.querySelector("[data-ltm-review-batch-actions]")!;
        let scroller = bar.parentElement;
        while (
          scroller &&
          !(/auto|scroll/u.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)
        )
          scroller = scroller.parentElement;
        (scroller ?? document.scrollingElement!).scrollTop +=
          checkbox.getBoundingClientRect().top - (bar.getBoundingClientRect().bottom - 8);
      });
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.partial}"] [data-ltm-review-mutation-toggle]`)
        .evaluate((toggle) => (toggle as HTMLElement).focus({ preventScroll: true }));
      assert.equal(await partialCheckboxState(), "unfocused under bar");
      await page.keyboard.press("Shift+Tab");
      let partialCheckboxAfterTab = "";
      for (let attempt = 0; attempt < 20 && partialCheckboxAfterTab !== "focused clear"; attempt += 1) {
        await page.waitForTimeout(50);
        partialCheckboxAfterTab = await partialCheckboxState();
      }
      assert.equal(partialCheckboxAfterTab, "focused clear");
      await reviewWorkbench.evaluate((workbench) => {
        (workbench as HTMLElement).style.minHeight = "";
      });
      await dockDetailPanel(page, null);
      const partialRow = page.locator(`[data-ltm-review-mutation="${reviewMutationIds.partial}"]`);
      assert.equal(await touchTargetSize(partialRow.locator('label:has([data-ltm-control="review-select"])')), "fits");
      assert.equal(await touchTargetSize(partialRow.locator("[data-ltm-review-disclosure]")), "fits");
      // Docked narrow on a wide window, the bar keeps sticking and the workbench keeps its phone padding.
      const reviewBarLayout = () =>
        reviewBatchBar.evaluate((bar) => ({
          position: getComputedStyle(bar).position,
          workbenchPadding: getComputedStyle(bar.closest("[data-ltm-review-workbench]")!).paddingTop,
        }));
      await page.setViewportSize({ width: 1280, height: 900 });
      assert.deepEqual(await reviewBarLayout(), { position: "static", workbenchPadding: "16px" });
      // #1654: one progress line per band (the navigator's below 48rem, the workbench's from it), and the draft
      // sits in the workbench without a frame of its own.
      const reviewChrome = () =>
        page.evaluate(() => {
          const bands = ["navigator", "workbench"].map(
            (band) => getComputedStyle(document.querySelector(`[data-ltm-review-progress-band="${band}"]`)!).display,
          );
          const draft = getComputedStyle(document.querySelector("[data-ltm-review-draft]")!);
          return {
            navigator: bands[0],
            workbench: bands[1],
            visibleProgress: [...document.querySelectorAll("[data-ltm-review-progress]")].filter(
              (progress) => progress.getClientRects().length > 0,
            ).length,
            draftBorder: draft.borderTopWidth,
            draftPadding: draft.paddingTop,
          };
        });
      assert.deepEqual(await reviewChrome(), {
        navigator: "none",
        workbench: "block",
        visibleProgress: 1,
        draftBorder: "0px",
        draftPadding: "0px",
      });
      await dockDetailPanel(page, "24rem");
      await showWorkspacePane("workbench");
      assert.deepEqual(await reviewBarLayout(), { position: "sticky", workbenchPadding: "12px" });
      assert.deepEqual(await reviewChrome(), {
        navigator: "block",
        workbench: "none",
        visibleProgress: 0,
        draftBorder: "0px",
        draftPadding: "0px",
      });
      await showWorkspacePane("navigator");
      assert.equal((await reviewChrome()).visibleProgress, 1);
      await showWorkspacePane("workbench");
      if (visualOutputDir) await page.screenshot({ path: join(visualOutputDir, "long-term-memory-review-docked.png") });
      await dockDetailPanel(page, null);
      await page.setViewportSize({ width: 390, height: 844 });
      await showWorkspacePane("workbench");
      // #1588: an emptied edit says why Accept is off, on the row and in the batch bar.
      const emptiedPartial = page.locator(`[data-ltm-review-mutation="${reviewMutationIds.partial}"]`);
      await emptiedPartial.locator("textarea").fill("");
      const partialAcceptReason = emptiedPartial.locator("[data-ltm-review-accept-reason]");
      assert.equal(await partialAcceptReason.innerText(), "Can't add yet: an edited section is empty.");
      assert.equal(
        await emptiedPartial.locator('[data-ltm-review-action="add"]').getAttribute("aria-describedby"),
        await partialAcceptReason.getAttribute("id"),
      );
      // #1673: the lock is aria-disabled, never `disabled`, so the button takes focus and a press applies nothing.
      const lockedAccept = emptiedPartial.locator('[data-ltm-review-action="add"]');
      const lockedAcceptCalls = reviewActionCalls.length;
      await lockedAccept.focus();
      assert.equal(
        await lockedAccept.evaluate((button) => button === document.activeElement && !button.hasAttribute("disabled")),
        true,
      );
      assert.equal(await lockedAccept.getAttribute("aria-disabled"), "true");
      await page.keyboard.press("Enter");
      await lockedAccept.click({ force: true });
      await page.waitForTimeout(150);
      assert.equal(reviewActionCalls.length, lockedAcceptCalls);
      await emptiedPartial.locator('[data-ltm-control="review-select"]').check();
      assert.match(
        await page.locator("[data-ltm-review-batch-accept-reason]").innerText(),
        /^Fix 1 invalid edited change before adding: /u,
      );
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.partial}"] textarea`)
        .fill("Edited pending partial memory");
      assert.equal(
        await page.locator("[data-ltm-review-accept-reason], [data-ltm-review-batch-accept-reason]").count(),
        0,
      );
      reviewPreflightBlocked = true;
      failSecondReviewAccept = false;
      // soup/review-one-press: one press checks and, because one change is blocked, stops before adding anything.
      await page.getByRole("button", { name: "Add selected (2)" }).click();
      await page.locator("[data-ltm-review-preflight]").first().waitFor();
      assert.equal(await page.locator('[data-ltm-review-preflight][role="alert"]').count(), 1);
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.partial}"] [data-ltm-review-mutation-toggle]`)
        .click();
      assert.equal(await page.locator("[data-ltm-review-conflicts]").count(), 1);
      assert.equal(
        await page
          .locator(`[data-ltm-review-mutation="${reviewMutationIds.second}"] [data-ltm-review-action="blocked"]`)
          .isDisabled(),
        true,
      );
      assert.equal(await page.getByRole("button", { name: /^Add selected \(1\)/ }).count(), 1);
      // The engine's own reason stays after the sentence for a catch-all code.
      assert.equal(
        await page
          .locator(`[data-ltm-review-mutation="${reviewMutationIds.second}"] [data-ltm-review-preflight] p`)
          .evaluateAll((lines) => lines.map((line) => line.textContent ?? "").join("|")),
        "Can't add this suggestion|The check blocked this change. Fixture preflight blocked this mutation.",
      );
      // soup/review-one-press: no state chip; the blocked row says why, in words, beside its Add button.
      const blockedRow = page.locator(`[data-ltm-review-mutation="${reviewMutationIds.second}"]`);
      assert.equal(await blockedRow.locator("[data-ltm-review-state-chip]").count(), 0);
      assert.equal(
        await blockedRow.locator("[data-ltm-review-accept-reason]").innerText(),
        "Can't add this change: its suggestion is blocked or out of date.",
      );
      assert.match(
        (await blockedRow.locator("[data-ltm-review-action]").getAttribute("aria-label")) ?? "",
        /^Can't add /u,
      );
      // #1654: the run summary sits in the workbench, above the rows, and is a warning while a change is ready.
      const preflightResult = page.locator("[data-ltm-review-result]");
      assert.equal(await preflightResult.getAttribute("data-ltm-status"), "warning");
      assert.equal(
        await preflightResult.evaluate(
          (result) =>
            Boolean(result.closest("[data-ltm-review-workbench]")) &&
            Boolean(
              result.compareDocumentPosition(document.querySelector("[data-ltm-review-draft]")!) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ),
        ),
        true,
      );
      assert.equal(
        await page
          .locator(`[data-ltm-review-mutation="${reviewMutationIds.second}"] [data-ltm-review-action-text]`)
          .isVisible(),
        true,
        "the Add button keeps its words at every width",
      );
      assert.deepEqual(reviewActionCalls, [
        {
          action: "accept",
          draftId: reviewDraftIds.first,
          mutationIds: [reviewMutationIds.first],
        },
      ]);
      reviewPreflightBlocked = false;
      await page.getByRole("button", { name: "Clear" }).click();
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.second}"] [data-ltm-control="review-select"]`)
        .check();
      await page
        .locator(`[data-ltm-review-mutation="${reviewMutationIds.partial}"] [data-ltm-control="review-select"]`)
        .check();
      // soup/review-one-press: a clean check that still reports a conflict stops before adding, so it is read first.
      reviewPreflightConflictOnly = true;
      const callsBeforeConflictCheck = reviewActionCalls.length;
      await page.getByRole("button", { name: "Add selected (2)" }).click();
      await page.locator("[data-ltm-review-result]").waitFor();
      assert.equal(reviewActionCalls.length, callsBeforeConflictCheck, "a check with a conflict adds nothing");
      assert.equal(await page.getByRole("button", { name: "Add selected (2)" }).count(), 1);
      reviewPreflightConflictOnly = false;
      failSecondReviewAccept = true;
      // soup/review-one-press: with nothing blocked, the one press checks and adds without a second step.
      let releaseReviewAccept = () => {};
      holdReviewAccept = new Promise<void>((resolve) => (releaseReviewAccept = resolve));
      await page.getByRole("button", { name: "Add selected (2)" }).click();
      await page.getByRole("button", { name: "Adding..." }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Checking..." }).count(), 0);
      // The rows being added say so too; none of them claims to be checking.
      const heldRowLabels = await page
        .locator("[data-ltm-review-action]")
        .evaluateAll((actions) => actions.map((action) => action.getAttribute("aria-label") ?? ""));
      assert.equal(
        heldRowLabels.filter((label) => label.startsWith("Checking change for")).length,
        0,
        String(heldRowLabels),
      );
      assert.equal(heldRowLabels.filter((label) => label.startsWith("Adding ")).length, 2, String(heldRowLabels));
      holdReviewAccept = null;
      releaseReviewAccept();
      await page.getByRole("button", { name: "Retry failed actions" }).waitFor();
      // #1375: each part of the batch summary is its own sentence, not a fragment glued to the last.
      assert.equal(
        await page.getByText(/Applied \d+ changes?; [1-9]\d* failed\. .*Draft action failed: .+\./u).count(),
        1,
      );
      // #1588: failed changes are not counted again as "other pending", and the result stays when the
      // selection changes, until the next run.
      assert.doesNotMatch(await page.locator("[data-ltm-review-result]").innerText(), /other changes? pending/u);
      assert.equal(await page.locator("[data-ltm-review-result]").getAttribute("data-ltm-status"), "danger");
      const partialSelect = page.locator(
        `[data-ltm-review-mutation="${reviewMutationIds.partial}"] [data-ltm-control="review-select"]`,
      );
      await partialSelect.uncheck();
      await partialSelect.check();
      assert.equal(await page.getByRole("button", { name: "Retry failed actions" }).count(), 1);
      failSecondReviewAccept = false;
      await page.getByRole("button", { name: "Retry failed actions" }).click();
      await page.getByText("Checked again. Review the results before adding.").waitFor();
      const editedPartial = page.locator(`[data-ltm-review-mutation="${reviewMutationIds.partial}"]`);
      assert.match(await editedPartial.locator("[data-ltm-review-summary]").innerText(), /Edited suggestion/u);
      // This accept drops the second change's merge target from the memory context, so the context reloads under a
      // new id list while the last one stays on screen (#1584).
      // The batch bar leaves with its selection while the applied rows stay until the queue reloads, so focus
      // must skip those rows. #1588: the click leaves the page focused, as a click does in Safari, and focus
      // still moves.
      await acceptWithReviewContextHeld(
        reviewMutationIds.second,
        async () => {
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          assert.equal(await page.evaluate(() => document.activeElement === document.body), true);
          await page.getByRole("button", { name: /^Add selected \(/ }).dispatchEvent("click");
        },
        // Both rows of this draft were acted on and a clean run has no result, so focus may only reach a change
        // left elsewhere, a result, or the queue itself.
        () => reviewFocusMoved(`${reviewNextChange}, [data-ltm-review-result], ${reviewQueueRoot}`),
      );
      assert.deepEqual(reviewEditedMutationIds.at(-1), [reviewMutationIds.partial]);
      assert.deepEqual(reviewActionCalls, [
        {
          action: "accept",
          draftId: reviewDraftIds.first,
          mutationIds: [reviewMutationIds.first],
        },
        {
          action: "accept",
          draftId: reviewDraftIds.second,
          mutationIds: [reviewMutationIds.second, reviewMutationIds.partial],
        },
        {
          action: "accept",
          draftId: reviewDraftIds.second,
          mutationIds: [reviewMutationIds.second, reviewMutationIds.partial],
        },
      ]);

      await showWorkspacePane("navigator");
      const discardSource = page.locator('[data-ltm-review-source-select="source_mobile_review"]');
      if ((await discardSource.getAttribute("aria-expanded")) === "false") await discardSource.click();
      await page.locator(`[data-ltm-review-draft-select="${reviewDraftIds.merge}"]`).click();
      await showWorkspacePane("workbench");
      const mergeDiscardMutation = page.locator(`[data-ltm-review-mutation="${reviewMutationIds.merge}"]`);
      const skipCallCountBeforeDecline = reviewActionCalls.length;
      confirmReviewDiscard = false;
      await page.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          confirmAction: (
            window as Window & {
              confirmReviewDiscard: (options: { message?: string }) => boolean;
            }
          ).confirmReviewDiscard,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      });
      await mergeDiscardMutation.getByRole("button", { name: /^Discard suggestion /u }).click();
      assert.equal(reviewActionCalls.length, skipCallCountBeforeDecline);
      assert.match(lastReviewDiscardMessage, /Dependent suggestions may also be discarded\./u);
      confirmReviewDiscard = true;
      await page.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          confirmAction: (
            window as Window & {
              confirmReviewDiscard: (options: { message?: string }) => boolean;
            }
          ).confirmReviewDiscard,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      });
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" && response.url().endsWith(`/drafts/${reviewDraftIds.merge}/skip`),
        ),
        mergeDiscardMutation.getByRole("button", { name: /^Discard suggestion /u }).click(),
      ]);
      assert.equal(reviewActionCalls.at(-1)?.action, "skip");

      const sourcesBeforeDismissal = reviewSources;
      const invalidatedDraftId = "10000000-0000-4000-8000-000000000071";
      const emptyReportId = "10000000-0000-4000-8000-000000000072";
      const invalidatedDraft = {
        ...makeReviewDraft(invalidatedDraftId, reviewMutationIds.first, "Old invalidated draft", [
          makeExistingReviewMutation(),
          makePartialReviewMutation(),
          makeMergeCreateMutation(),
        ]),
        status: "invalidated",
        source: { sourceNoteId: "source_mobile_single", chatId: "chat-a" },
      };
      reviewSources = [
        {
          sourceNoteId: "source_mobile_single",
          modes: ["roleplay"],
          targets: [],
          drafts: [
            {
              draft: invalidatedDraft,
              freshness: "invalidated",
              blockReasons: [{ code: "draft_invalidated", message: "A targeted memory detail was deleted." }],
              diagnostics: [],
              candidateRejections: [],
              deduplications: [],
            },
            {
              draft: { ...makeReviewDraft(emptyReportId), source: invalidatedDraft.source },
              freshness: "fresh",
              blockReasons: [],
              diagnostics: [],
              candidateRejections: [],
              deduplications: [],
            },
          ],
        },
      ];
      await page.reload();
      await page.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = {
          agent: { name: "Long-Term Memory" },
          package: { version },
          confirmAction: (window as Window & { confirmReviewDiscard: unknown }).confirmReviewDiscard,
        };
        document.body.append(element);
      }, packageManifest.version);
      await page.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="review"]').click();
      await showWorkspacePane("navigator");
      const invalidatedSource = page.locator('[data-ltm-review-source-select="source_mobile_single"]');
      if ((await invalidatedSource.getAttribute("aria-expanded")) === "false") await invalidatedSource.click();
      await page.locator(`[data-ltm-review-draft-select="${invalidatedDraftId}"]`).click();
      await showWorkspacePane("workbench");
      const invalidatedRows = page.locator("[data-ltm-review-mutation]");
      assert.equal(await invalidatedRows.count(), 3);
      for (const checkbox of await invalidatedRows.locator('[data-ltm-control="review-select"]').all()) {
        await checkbox.check();
      }
      assert.equal(await page.getByRole("button", { name: "Add selected (0)" }).isDisabled(), true);
      for (const action of await invalidatedRows.locator("[data-ltm-review-action]").all()) {
        assert.equal(await action.isDisabled(), true);
      }
      const discardDraft = page.getByRole("button", { name: "Discard invalidated draft", exact: true });
      assert.equal(
        await discardDraft.count(),
        1,
        "non-empty invalidated drafts must have a whole-draft discard action",
      );
      confirmReviewDiscard = false;
      await discardDraft.click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (button) => button.textContent?.trim() === "Discard invalidated draft" && !button.disabled,
        ),
      );
      assert.deepEqual(deletedDraftIds, []);
      assert.match(lastReviewDiscardMessage, /Saved memories will not be changed/u);
      assert.equal(await invalidatedRows.count(), 3, "cancel must preserve every suggestion");
      confirmReviewDiscard = true;
      failDraftDeletion = true;
      await discardDraft.click();
      await page.getByText(/Draft deletion fixture failed/u).waitFor();
      assert.deepEqual(deletedDraftIds, []);
      assert.equal(await invalidatedRows.count(), 3, "failed deletion must leave a retryable draft");
      failDraftDeletion = false;
      if (visualOutputDir) {
        await page.screenshot({
          path: join(visualOutputDir, "long-term-memory-invalidated-mobile.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.screenshot({
          path: join(visualOutputDir, "long-term-memory-invalidated-desktop.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
      }
      await discardDraft.focus();
      await page.keyboard.press("Enter");
      await page.locator(`[data-ltm-review-draft="${invalidatedDraftId}"]`).waitFor({ state: "detached" });
      assert.deepEqual(deletedDraftIds, [invalidatedDraftId]);
      const emptyReport = page.getByRole("button", { name: "Discard report", exact: true });
      await emptyReport.click();
      await page.locator(`[data-ltm-review-draft="${emptyReportId}"]`).waitFor({ state: "detached" });
      assert.deepEqual(deletedDraftIds, [invalidatedDraftId, emptyReportId]);
      reviewSources = sourcesBeforeDismissal;

      reviewQueueEmpty = true;
      await page.reload();
      await page.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = { agent: { name: "Long-Term Memory" }, package: { version } };
        document.body.append(element);
      }, packageManifest.version);
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      await page.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="review"]').click();
      await page.getByText("No proposed memories need review yet.", { exact: true }).waitFor();
      // soup/: the empty state offers the Sources handoff instead of describing the path.
      assert.equal(
        (await page.locator('[data-ltm-surface="detail"]').getByRole("button", { name: "Import sources" }).count()) > 0,
        true,
      );
      assert.equal(await page.locator("[data-ltm-workspace]").isVisible(), false);
      reviewQueueEmpty = false;

      healthState = "healthy";
      // A write schedules the index rebuild 1 to 10 s later; the shell polls status until it lands.
      pendingRebuildReads = 2;
      const repairPosts: string[] = [];
      const recordRepair = (request: { method(): string; url(): string }) => {
        if (request.method() === "POST" && request.url().endsWith("/api/long-term-memory/repair"))
          repairPosts.push(request.url());
      };
      page.on("request", recordRepair);
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
      // The "Recall may miss memories" banner clears on its own once the scheduled rebuild lands, with no Reindex.
      await page.locator('[data-ltm-surface="vault-health-warning"]').waitFor();
      await page.locator('[data-ltm-surface="vault-health-warning"]').waitFor({ state: "detached", timeout: 8_000 });
      page.off("request", recordRepair);
      assert.deepEqual(repairPosts, []);
      assert.equal(pendingRebuildReads, 0);
      // The pill shows "Loading status" until the status read returns; wait for the healthy reading.
      await page.locator('[data-ltm-surface="vault-health-pill"]').waitFor({ state: "detached" });
      assert.equal(await page.locator('[data-ltm-surface="vault-health-pill"]').count(), 0);
      assert.equal(await page.locator('[data-ltm-surface="vault-health-warning"]').count(), 0);
      // #1611: the lexical-recall warning carries its own Reindex button and no info trigger.
      const semanticWarning = page.locator('[data-ltm-surface="semantic-recall-warning"]');
      await semanticWarning.waitFor();
      assert.equal(await semanticWarning.locator("[data-ltm-info]").count(), 0);
      await semanticWarning.getByRole("button", { name: "Reindex now" }).focus();
      assert.equal(
        await page.evaluate(() => {
          const active = document.activeElement;
          return (
            active?.textContent?.trim() === "Reindex now" &&
            Boolean(active.closest('[data-ltm-surface="semantic-recall-warning"]')) &&
            !active.closest("[data-ltm-info-panel]")
          );
        }),
        true,
      );
      await page.route("**/api/long-term-memory/repair", (route) => route.fulfill({ json: { ok: true } }));
      await page.keyboard.press("Enter");
      await page.locator('[data-ltm-reindex-result="success"]').waitFor();
      await page.unroute("**/api/long-term-memory/repair");
      // soup/review-link-cards: a proposed link names the linked memory and the relation in words, never raw ids.
      const linkCardDraft = makeReviewDraft("10000000-0000-4000-8000-000000000060");
      linkCardDraft.source.sourceNoteId = "source_link_cards";
      linkCardSourceNote = true;
      const linkCardMutation = {
        id: "10000000-0000-4000-8000-000000000061",
        kind: "add_link",
        claimKind: "change",
        risk: "low",
        confidence: 0.9,
        summary: "Link the second mobile memory",
        evidence: ["source_note:source_link_cards"],
        noteId: "world_second_mobile",
        link: { target: "world_second_mobile", relation: "caused_by" },
      };
      linkCardDraft.mutations = [linkCardMutation] as typeof linkCardDraft.mutations;
      reviewSources.push({
        sourceNoteId: "source_link_cards",
        modes: ["roleplay"],
        drafts: [
          {
            draft: linkCardDraft,
            freshness: "fresh",
            blockReasons: [],
            diagnostics: [],
            candidateRejections: [],
            deduplications: [],
          },
        ],
        targets: [
          {
            noteId: "world_second_mobile",
            title: "Second mobile memory",
            noteType: "world",
            rows: [
              {
                draftId: linkCardDraft.id,
                mutation: linkCardMutation,
                // A link into a saved memory merges into it, which is what makes Review load its title.
                disposition: "merge",
                diagnostics: [],
                changes: [
                  {
                    kind: "link",
                    key: "caused_by:world_second_mobile",
                    after: "caused_by world_second_mobile",
                  },
                ],
              },
            ],
          },
        ],
      });
      await page.locator('[data-ltm-control="navigation"][data-ltm-destination="review"]').first().click();
      // The link-card source above is listed too, so pick the source whose rejected suggestions are checked here.
      const rejectedSource = page.locator('[data-ltm-review-source-select="source_mobile_recovery"]');
      await rejectedSource.waitFor();
      if ((await rejectedSource.getAttribute("aria-expanded")) !== "true") await rejectedSource.click();
      await page.locator("[data-ltm-rejected-suggestions]").waitFor();
      // soup/review-link-cards: the rejected list sits behind one "N rejected" chip, at least 2.75rem tall.
      const rejectedChip = page.locator("[data-ltm-rejected-suggestions] > summary").first();
      assert.match((await rejectedChip.innerText()).trim(), /^\d+ rejected$/u);
      assert.ok(
        (await rejectedChip.evaluate((element) => Number.parseFloat(getComputedStyle(element).minHeight))) >= 44,
      );
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
      await page.locator('[data-ltm-review-source-select="source_link_cards"]').click();
      await showWorkspacePane("workbench");
      const linkCard = page.locator(`[data-ltm-review-mutation="${linkCardMutation.id}"]`);
      await linkCard.waitFor();
      await linkCard.locator("[data-ltm-review-mutation-toggle]").click();
      // The target's title comes from the context-notes query, which refetches once the new source adds an id.
      await page
        .waitForFunction(
          (id) =>
            /Caused by "Second mobile review memory"/u.test(
              document.querySelector<HTMLElement>(`[data-ltm-review-mutation="${id}"]`)?.innerText ?? "",
            ),
          linkCardMutation.id,
        )
        .catch(() => undefined);
      const linkCardText = await linkCard.innerText();
      assert.match(linkCardText, /Caused by "Second mobile review memory"/u, linkCardText);
      assert.doesNotMatch(linkCardText, /caused_by|world_second_mobile/u, linkCardText);
      reviewSources.splice(reviewSources.length - 1, 1);
      linkCardSourceNote = false;
      await showWorkspacePane("navigator");
      const recoveryReviewSource = page.locator('[data-ltm-review-source-select="source_mobile_recovery"]');
      if ((await recoveryReviewSource.getAttribute("aria-expanded")) !== "true") await recoveryReviewSource.click();
      const rejectedSuggestions = page.locator("[data-ltm-rejected-suggestions]");
      await rejectedSuggestions.waitFor({ state: "attached" });
      if (!(await rejectedSuggestions.evaluate((element) => (element as HTMLDetailsElement).open)))
        await rejectedSuggestions.locator(":scope > summary").click();
      const recoveryRejectedArticle = page.locator('article[data-ltm-rejected-source="source_mobile_recovery"]');
      await recoveryRejectedArticle.waitFor();
      const identityReview = page.locator(`[data-ltm-identity-review="${identityRejectedSuggestionId}"]`);
      await identityReview.waitFor();
      if (visualOutputDir) {
        await identityReview.scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(visualOutputDir, "long-term-memory-identity-desktop.png"), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await showWorkspacePane("workbench");
        await identityReview.scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(visualOutputDir, "long-term-memory-identity-mobile.png"), fullPage: true });
        await page.setViewportSize({ width: 1280, height: 900 });
      }
      const identitySelects = identityReview.getByRole("combobox");
      assert.equal(await identitySelects.nth(0).inputValue(), "", "identity candidates must not be preselected");
      assert.equal(await identitySelects.nth(1).inputValue(), "", "each participant starts without a binding");
      assert.equal(
        await identityReview.getByRole("button", { name: "Save choices and review memory" }).isDisabled(),
        true,
      );
      const identityArticle = identityReview.locator("xpath=ancestor::article[@data-ltm-rejected-suggestion]");
      assert.equal(
        await identityArticle.getByRole("button", { name: /^Discard suggestion:/ }).count(),
        1,
        "identity rows must keep a per-suggestion delete action",
      );
      assert.equal(
        await identityArticle.getByRole("button", { name: /^Recover suggestion:/ }).count(),
        1,
        "identity rows must keep the manual recovery action",
      );
      assert.deepEqual(
        await identitySelects
          .nth(0)
          .locator("option")
          .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).textContent)),
        [
          "Choose identity",
          "Ari (Character, character-a)",
          "Ari (Persona)",
          "Ari (Character, character-c)",
          "Skip this memory",
        ],
      );
      assert.deepEqual(
        await identitySelects
          .nth(0)
          .locator("option")
          .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).title)),
        ["", "character:character-a", "persona:persona-a", "character:character-c", ""],
        "identity options keep the raw subject key in the title",
      );
      assert.ok(
        await identitySelects.evaluateAll((selects) =>
          selects.every((select) => select.getBoundingClientRect().height >= 44),
        ),
        "desktop identity controls retain 44px touch targets",
      );
      await identitySelects.nth(0).focus();
      await identitySelects.nth(0).press("ArrowDown");
      await identitySelects.nth(0).press("Enter");
      assert.equal(await identitySelects.nth(0).inputValue(), "character:character-a");
      await identitySelects.nth(1).selectOption("different");
      // Unsaved identity decisions lock the source list without dropping keyboard focus: the button is
      // aria-disabled (not `disabled`), names its reason, and a click leaves the selection where it was.
      const lockedSource = page.locator('[data-ltm-review-source-select="source_mobile_single"]');
      assert.equal(
        await lockedSource.getAttribute("aria-disabled"),
        "true",
        "changing source cannot silently discard unsaved identity decisions",
      );
      assert.equal(await lockedSource.getAttribute("disabled"), null, "a locked source stays focusable");
      await lockedSource.focus();
      assert.equal(await lockedSource.evaluate((el) => el === document.activeElement), true);
      const lockReasonId = await lockedSource.getAttribute("aria-describedby");
      assert.ok(lockReasonId, "a locked source names its reason");
      assert.equal(
        (await page.locator(`[id="${lockReasonId}"]`).textContent())?.trim(),
        "Review buttons wait until you save or discard your identity choices.",
      );
      const activeSourceBefore = await page
        .locator('[data-ltm-review-source-select][aria-current="true"]')
        .getAttribute("data-ltm-review-source-select");
      const expandedBefore = await lockedSource.getAttribute("aria-expanded");
      await page.keyboard.press("Enter");
      assert.equal(
        await lockedSource.getAttribute("aria-expanded"),
        expandedBefore,
        "a locked source does not collapse or expand",
      );
      assert.equal(
        await page
          .locator('[data-ltm-review-source-select][aria-current="true"]')
          .getAttribute("data-ltm-review-source-select"),
        activeSourceBefore,
        "a locked source does not change the selection",
      );
      await identityReview.getByRole("button", { name: "Discard identity choices" }).click();
      assert.equal(await identitySelects.nth(0).inputValue(), "");
      assert.equal(await identitySelects.nth(1).inputValue(), "");
      assert.equal(
        await page.locator('[data-ltm-review-source-select="source_mobile_single"]').getAttribute("aria-disabled"),
        null,
      );
      await identitySelects.nth(0).selectOption("character:character-a");
      await identitySelects.nth(1).selectOption("different");
      const saveIdentityChoices = identityReview.getByRole("button", { name: "Save choices and review memory" });
      const failedIdentitySave = page.waitForResponse(
        (response) => response.request().method() === "POST" && response.url().endsWith("/resolve-identity"),
      );
      await saveIdentityChoices.click();
      assert.equal((await failedIdentitySave).status(), 500);
      const failedIdentityToast = toastWith(page, "Identity choice fixture failed");
      await failedIdentityToast.waitFor();
      assert.equal(
        await failedIdentityToast.getAttribute("data-type"),
        "error",
        "a failed identity save is an error toast",
      );
      assert.equal(await identitySelects.nth(0).inputValue(), "character:character-a");
      assert.equal(await identitySelects.nth(1).inputValue(), "different");
      const retriedIdentitySave = page.waitForResponse(
        (response) => response.request().method() === "POST" && response.url().endsWith("/resolve-identity"),
      );
      await saveIdentityChoices.click();
      assert.equal((await retriedIdentitySave).status(), 200);
      assert.deepEqual(identityResolutionRequests.at(-1), {
        id: identityRejectedSuggestionId,
        choices: [
          { name: "Ari", action: "bind", subjectKey: "character:character-a" },
          { name: "Mira", action: "different" },
        ],
      });
      await page.getByText("Identity choices saved. Review the pending memory draft before applying it.").waitFor();
      await page.locator(`[data-ltm-identity-review="${identityRejectedSuggestionId}"]`).waitFor({ state: "detached" });

      const skipIdentityReview = page.locator(`[data-ltm-identity-review="${skipIdentitySuggestionId}"]`);
      await skipIdentityReview.waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await showWorkspacePane("workbench");
      const skipIdentitySelect = skipIdentityReview.getByRole("combobox");
      assert.ok(
        (await skipIdentitySelect.boundingBox())!.height >= 44,
        "mobile identity control retains a 44px touch target",
      );
      await skipIdentitySelect.focus();
      await skipIdentitySelect.press("End");
      assert.equal(await skipIdentitySelect.inputValue(), "skip");
      const skipIdentityResponse = page.waitForResponse(
        (response) => response.request().method() === "POST" && response.url().endsWith("/resolve-identity"),
      );
      await skipIdentityReview.getByRole("button", { name: "Save skip choice" }).click();
      assert.equal((await skipIdentityResponse).status(), 200);
      assert.deepEqual(identityResolutionRequests.at(-1), {
        id: skipIdentitySuggestionId,
        choices: [{ name: "Nox", action: "skip" }],
      });
      await page.getByText("Skip choice saved. The whole fact or relationship was skipped.").waitFor();
      await page.setViewportSize({ width: 1280, height: 900 });
      await showWorkspacePane("workbench");

      if ((await recoveryReviewSource.getAttribute("aria-expanded")) !== "true") await recoveryReviewSource.click();
      if (!(await rejectedSuggestions.evaluate((element) => (element as HTMLDetailsElement).open)))
        await rejectedSuggestions.locator(":scope > summary").click();
      const recoveryReviewText = await page.locator('[data-ltm-workspace-pane="workbench"]').innerText();
      assert.match(recoveryReviewText, /Mobile recovery source/u);
      assert.match(recoveryReviewText, /Mobile recovery memory/u);
      assert.match(recoveryReviewText, /A recoverable mobile memory\./u);
      assert.match(recoveryReviewText, /Show 1 format details/u);
      await page.getByText("Show 1 format details", { exact: true }).click();
      assert.match(
        await page.locator('[data-ltm-workspace-pane="workbench"]').innerText(),
        /units\.0\.text: Required/u,
      );
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
      const inspectorPaneName = (await page.locator('[data-ltm-workspace-pane-tab="inspector"]').textContent())?.trim();
      assert.equal(inspectorPaneName, "Memory info");
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
      // One name for the pane: the toggle and the <48rem tab both say "Memory info" with no aria-label to
      // override it, and the inspector's first section is named for what it holds.
      const detailsToggle = page.locator("[data-ltm-details-toggle]");
      assert.equal(await detailsToggle.getAttribute("aria-label"), null);
      assert.equal((await detailsToggle.textContent())?.trim(), inspectorPaneName);
      assert.equal(await detailsToggle.getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: "Memory info", exact: true, pressed: true }).waitFor();
      assert.equal(
        (await page.locator("[data-ltm-memory-options] > summary").textContent())?.trim(),
        "Keywords and links",
      );
      await page.locator("[data-ltm-details-toggle]").click();
      assert.equal(await page.locator("[data-ltm-details-toggle]").getAttribute("aria-pressed"), "false");
      assert.equal(await page.locator('[data-ltm-workspace-pane="inspector"]').count(), 0);
      await page.getByRole("button", { name: "Choose where available" }).click();
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
          { kind: "all", selected: "true", tabIndex: "0", count: "0" },
          { kind: "chat", selected: "false", tabIndex: "-1", count: "1" },
          { kind: "character", selected: "false", tabIndex: "-1", count: "0" },
          { kind: "persona", selected: "false", tabIndex: "-1", count: "0" },
        ],
      );
      assert.equal(
        await availabilityTabs.locator('[data-ltm-availability-tab="persona"] span').first().innerText(),
        "Personas",
      );
      assert.equal(
        await availabilityTabs.locator('[data-ltm-availability-tab="chat"] span').first().innerText(),
        "Chats",
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
      assert.equal(
        await availabilityTabs.locator('[data-ltm-availability-tab="all"]').getAttribute("aria-selected"),
        "true",
      );
      await characterTab.press("End");
      assert.equal(await personaTab.getAttribute("aria-selected"), "true");
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
        columns: 2,
        panelBelowTabs: true,
        pageFits: true,
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await personaTab.click();
      await page.locator('[data-ltm-availability-target="persona:persona-a"]').click();
      await page.locator('[data-ltm-availability-tab="chat"]').click();
      await page.locator('[data-ltm-availability-target="chat:conversation-a"]').click();
      assert.equal(await page.locator('[data-ltm-availability-target="chat:memory-chat"]').count(), 0);
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
      await page.locator("[data-ltm-bulk-edit]").click();
      const bulkAvailability = page.locator("[data-ltm-bulk-availability-workbench]");
      await bulkAvailability.waitFor();
      // #1636: one Edit selected sheet holds status, modes and availability.
      await bulkAvailability.getByRole("heading", { name: "Edit selected memories", exact: true }).waitFor();
      assert.equal(await bulkAvailability.locator("[data-ltm-bulk-edit-status] option").count(), 4);
      assert.equal(await bulkAvailability.locator("[data-ltm-bulk-edit-status]").inputValue(), "");
      assert.equal(await bulkAvailability.locator("h3").filter({ hasText: "Available in" }).count(), 1);
      // #1636: with nothing chosen both Apply buttons stay focusable, say why they are off, and do nothing.
      assert.equal(await bulkAvailability.getByText("2 memories selected", { exact: true }).count(), 1);
      assert.equal(await bulkAvailability.getByRole("heading", { name: "What Apply will do", exact: true }).count(), 1);
      assert.equal(
        await bulkAvailability.locator("[data-ltm-bulk-outcome-summary]").innerText(),
        "0 ready · 2 unchanged · 0 blocked",
      );
      const bulkApplyButtons = bulkAvailability.locator("[data-ltm-bulk-apply]");
      assert.equal(await bulkApplyButtons.count(), 2);
      let bulkGuardRequests = 0;
      const countBulkGuardRequests = (request: { method(): string; url(): string }) => {
        if (request.method() === "POST" && request.url().includes("/api/long-term-memory/notes/batch"))
          bulkGuardRequests += 1;
      };
      page.on("request", countBulkGuardRequests);
      await bulkAvailability.locator('[data-ltm-bulk-apply="top"]').click({ force: true });
      await page.waitForTimeout(150);
      page.off("request", countBulkGuardRequests);
      assert.equal(bulkGuardRequests, 0);
      assert.equal(await bulkAvailability.count(), 1);
      for (const placement of ["top", "bottom"]) {
        const applyButton = bulkAvailability.locator(`[data-ltm-bulk-apply="${placement}"]`);
        assert.equal(await applyButton.getAttribute("aria-disabled"), "true");
        assert.equal(await applyButton.evaluate((button) => (button as HTMLButtonElement).disabled), false);
        const reasonId = await applyButton.getAttribute("aria-describedby");
        assert.match(
          await page.locator(`[id="${reasonId}"]`).innerText(),
          /^Nothing to apply yet\. Choose a status, a chat type or a place\.$/u,
        );
      }
      assert.equal(
        await bulkAvailability.getByRole("button", { name: "Add availability" }).getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await bulkAvailability.getByRole("button", { name: "Remove availability" }).getAttribute("aria-pressed"),
        "false",
      );
      assert.equal(await bulkAvailability.getByRole("button", { name: "Add availability" }).locator("svg").count(), 1);
      // Removing every mode blocks each memory: Apply stays off and the reason names the blockage.
      await bulkAvailability.getByRole("button", { name: "Remove availability" }).click();
      const bulkModeBoxes = bulkAvailability.locator('input[type="checkbox"]');
      for (let index = 0; index < (await bulkModeBoxes.count()); index += 1) await bulkModeBoxes.nth(index).check();
      assert.equal(
        await bulkAvailability.locator("[data-ltm-bulk-outcome-summary]").innerText(),
        "0 ready · 0 unchanged · 2 blocked",
      );
      const blockedApply = bulkAvailability.locator('[data-ltm-bulk-apply="bottom"]');
      assert.equal(await blockedApply.getAttribute("aria-disabled"), "true");
      assert.match(
        await page.locator(`[id="${await blockedApply.getAttribute("aria-describedby")}"]`).innerText(),
        /^Nothing to apply: every selected memory is unchanged or would be skipped\. Each row says why\.$/u,
      );
      for (let index = 0; index < (await bulkModeBoxes.count()); index += 1) await bulkModeBoxes.nth(index).uncheck();
      await bulkAvailability.getByRole("button", { name: "Add availability" }).click();
      assert.equal(await bulkAvailability.getByText("each memory keeps its chat scope", { exact: false }).count(), 1);
      await bulkAvailability.locator("[data-ltm-availability-picker] > summary").click();
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
      assert.match(
        await bulkAvailability.locator("[data-ltm-bulk-outcome-summary]").innerText(),
        /^[1-2] ready · [0-1] unchanged · 0 blocked$/u,
      );
      assert.equal(await bulkAvailability.locator('[data-ltm-bulk-apply][aria-disabled="true"]').count(), 0);
      await bulkAvailability.locator('[data-ltm-bulk-apply="bottom"]').click();
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
      await page
        .locator('[data-sonner-toast][data-type="success"]')
        .filter({ hasText: "Memory saved." })
        .first()
        .waitFor();
      assert.equal(await page.locator('[role="alert"]').count(), 0);
      assert.equal(deletedSuggestionId, rejectedSuggestionId);
      assert.equal(savedNote?.type, "world");

      // Prove Archive Undo: mixed prior statuses, complete undo, and rollback on partial failure.
      const archiveBatch = page.locator("[data-ltm-bulk-actions]");
      const activeWorldCard = page
        .locator('[data-ltm-note-type="world"]')
        .filter({ hasText: "Second mobile review memory" });
      const resolvedWorldCard = page
        .locator('[data-ltm-note-type="world"]')
        .filter({ hasText: "Mobile recovery memory" });
      await activeWorldCard.locator('input[type="checkbox"]').check();
      await resolvedWorldCard.locator('input[type="checkbox"]').check();
      await archiveBatch.getByRole("button", { name: "Archive" }).click();
      // The archive is an Engine toast (sonner) that carries Undo; the package shows no banner of its own.
      const archivedToast = toastWith(page, /2 memories archived/u);
      await archivedToast.waitFor();
      assert.equal(await archivedToast.getAttribute("data-type"), "success");
      // #1588: the batch bar leaves with the selection, so focus moves to a control that stays (the search field),
      // not to <body> and not to the toast.
      const vaultFocusKept = () =>
        page.waitForFunction(
          () =>
            document.activeElement !== document.body &&
            Boolean(document.activeElement?.closest('[data-ltm-surface="vault"]')),
        );
      await vaultFocusKept();
      assert.equal(await archivedToast.getByRole("button", { name: "Undo" }).count(), 1);
      assert.equal((await archivedToast.locator("[data-title]").innerText()).trim(), "2 memories archived.");
      assert.equal(
        await page.locator("[data-ltm-vault-feedback] [data-ltm-status]").count(),
        0,
        "the archive leaves no inline result beside the toast",
      );
      // After a failed undo the failure toast offers Undo again.
      const undoFailedToast = page
        .locator('[data-sonner-toast][data-type="error"]')
        .filter({ hasText: "Could not undo the archive" });
      const undoOffer = () => page.locator("[data-sonner-toast]").getByRole("button", { name: "Undo" });

      // 1. Partial failure restores successful restores back to archived and surfaces error.
      batchNotesPartial = true;
      await archivedToast.getByRole("button", { name: "Undo" }).click();
      await undoFailedToast.first().waitFor();
      await vaultFocusKept();
      assert.match(await undoFailedToast.first().innerText(), /Could not undo the archive/u);
      assert.equal(await undoFailedToast.first().getByRole("button", { name: "Undo" }).count(), 1);
      // The rollback call re-archives only the successfully restored active note, leaving the failed resolved note untouched
      const rollbackCall = batchNotesCalls.at(-1);
      assert.equal(rollbackCall?.status, "archived");
      assert.deepEqual(
        rollbackCall?.noteIds,
        ["world_second_mobile"],
        "Rollback must re-archive only the successfully restored active note",
      );
      // Hold the undo again, and open one of its memories while it runs.
      let releaseUndo: (() => void) | null = null;
      const undoHeld = new Promise<void>((resolve) => {
        releaseUndo = resolve;
      });
      await page.route(
        "**/api/long-term-memory/notes/batch",
        async (route) => {
          await undoHeld;
          await route.continue();
        },
        { times: 2 },
      );
      const batchCallsBeforeUndo = batchNotesCalls.length;
      await undoFailedToast.first().getByRole("button", { name: "Undo" }).click();
      // Pressing Undo dismisses the failure toast, and the held run shows nothing until it ends.
      await undoFailedToast.waitFor({ state: "detached" });
      await activeWorldCard.locator("button").first().click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLInputElement>("[data-ltm-field='title']")?.value === "Second mobile review memory",
      );
      releaseUndo?.();
      // The undo still rolls back the partial restore, and the failure toast offers Undo again.
      await undoFailedToast.first().getByRole("button", { name: "Undo" }).waitFor();
      assert.equal(batchNotesCalls.length, batchCallsBeforeUndo + 3);
      assert.deepEqual(batchNotesCalls.at(-1), { noteIds: ["world_second_mobile"], status: "archived" });
      batchNotesPartial = false;

      // A later toast leaves the Undo offer standing: save the open memory while Undo is still offered.
      await page.route("**/api/long-term-memory/notes/world_second_mobile", async (route) => {
        if (route.request().method() !== "PATCH") return route.fallback();
        const current = await (await page.request.get(route.request().url())).json();
        return route.fulfill({ json: { note: { ...current, version: current.version + 1 } } });
      });
      const titleField = page.locator("[data-ltm-field='title']");
      await titleField.fill("Second mobile review memory, saved");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await toastWith(page, "Memory saved.").waitFor();
      assert.equal(
        (await undoFailedToast.first().locator("[data-title]").innerText()).trim(),
        "Could not undo the archive.",
      );
      assert.equal(await undoOffer().count(), 1);
      await page.unroute("**/api/long-term-memory/notes/world_second_mobile");

      // 2. Complete restore sends restore batches grouped by prior status.
      // Re-archive the two notes cleanly, with one of them open
      await activeWorldCard.locator("button").first().click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLInputElement>("[data-ltm-field='title']")?.value === "Second mobile review memory",
      );
      await activeWorldCard.locator('input[type="checkbox"]').check();
      await resolvedWorldCard.locator('input[type="checkbox"]').check();
      await archiveBatch.getByRole("button", { name: "Archive" }).click();
      const freshArchivedToast = toastWith(page, /2 memories archived/u);
      await freshArchivedToast.waitFor();
      // A new batch makes the earlier Undo stale, so only this archive offers Undo.
      await undoFailedToast.waitFor({ state: "detached" });
      const freshUndoButton = freshArchivedToast.getByRole("button", { name: "Undo" });
      assert.equal(await undoOffer().count(), 1);
      // The undo reloads the open memory it restored, as the archive did.
      const restoredNoteReload = page.waitForRequest(
        (request) =>
          request.method() === "GET" && request.url().endsWith("/long-term-memory/notes/world_second_mobile"),
      );
      await freshUndoButton.click();
      await toastWith(page, /2 memories restored/u).waitFor();
      assert.equal(
        await toastWith(page, /2 memories restored/u).getAttribute("data-type"),
        "success",
        "a finished undo is a success toast",
      );
      await restoredNoteReload;
      await vaultFocusKept();
      // Pressing Undo dismisses its toast, and the restore offers no further Undo.
      await freshArchivedToast.waitFor({ state: "detached" });
      assert.equal(await undoOffer().count(), 0);
      const restoreCalls = batchNotesCalls.slice(-2);
      const activeRestoreCall = restoreCalls.find((call) => call.status === "active");
      const resolvedRestoreCall = restoreCalls.find((call) => call.status === "resolved");
      assert.ok(activeRestoreCall, "Archive undo must include a restore batch for active notes");
      assert.ok(resolvedRestoreCall, "Archive undo must include a restore batch for resolved notes");
      assert.deepEqual(
        activeRestoreCall.noteIds,
        ["world_second_mobile"],
        "Active restore batch must target the active note",
      );
      assert.deepEqual(
        resolvedRestoreCall.noteIds,
        ["world_mobile_recovery"],
        "Resolved restore batch must target the resolved note",
      );

      const deleteTargetIds = ["world_second_mobile", "world_mobile_recovery"];
      const deleteTargetCards = [
        page.locator('[data-ltm-note-type="world"]').filter({ hasText: "Second mobile review memory" }),
        page.locator('[data-ltm-note-type="world"]').filter({ hasText: "Mobile recovery memory" }),
      ];
      // Another memory is open when the deletion starts.
      await page
        .locator('[data-ltm-note-type="world"]')
        .filter({ hasText: "Existing merge target" })
        .locator("button")
        .first()
        .click();
      for (const card of deleteTargetCards) await card.locator('input[type="checkbox"]').check();
      const deleteMemorySearch = page.getByLabel("Search memories", { exact: true });
      await deleteMemorySearch.fill("no-delete-target-match");
      // The list follows the search box a moment later, so wait for the count instead of reading it once.
      await page
        .locator("[data-ltm-selection-count]")
        .filter({ hasText: /2 selected, 2 hidden by filters/u })
        .waitFor();
      confirmDelete = false;
      lastDeleteConfirmation = null;
      await page.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          confirmAction: (
            window as Window & {
              captureDeleteConfirmation: (options: {
                title: string;
                message: string;
                confirmLabel?: string;
              }) => boolean;
            }
          ).captureDeleteConfirmation,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      });
      const beforeDeleteCalls = permanentDeleteCalls.length;
      const cancelledConfirmation = new Promise<void>((resolve) => {
        notifyDeleteConfirmation = resolve;
      });
      const cancelledTargetResolution = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.url().includes("/api/long-term-memory/notes?ids=world_second_mobile%2Cworld_mobile_recovery"),
      );
      await page.locator("[data-ltm-bulk-actions]").getByRole("button", { name: "Delete" }).click();
      await cancelledTargetResolution;
      await cancelledConfirmation;
      notifyDeleteConfirmation = undefined;
      assert.equal(permanentDeleteCalls.length, beforeDeleteCalls, "Cancel must not send a deletion request");
      assert.ok(lastDeleteConfirmation);
      assert.equal(lastDeleteConfirmation?.title, "Permanently delete 2 memories?");
      assert.equal(lastDeleteConfirmation?.confirmLabel, "Delete 2 memories permanently");
      assert.match(lastDeleteConfirmation?.message ?? "", /This cannot be undone\./u);
      assert.match(lastDeleteConfirmation?.message ?? "", /2 selected memories are hidden by your filters\./u);
      for (const id of deleteTargetIds) assert.match(lastDeleteConfirmation?.message ?? "", new RegExp(id, "u"));
      assert.match(lastDeleteConfirmation?.message ?? "", /Second mobile review memory/u);
      assert.match(lastDeleteConfirmation?.message ?? "", /Mobile recovery memory/u);
      assert.match(lastDeleteConfirmation?.message ?? "", /Excerpt: .*memory text/u);
      assert.match(lastDeleteConfirmation?.message ?? "", /Available in: All memories/u);
      confirmDelete = true;
      const deleteResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().endsWith("/api/long-term-memory/notes/permanent-delete"),
      );
      // Hold the deletion, and open one of its memories while it runs.
      let releaseDelete: (() => void) | null = null;
      const deleteHeld = new Promise<void>((resolve) => {
        releaseDelete = resolve;
      });
      await page.route(
        "**/api/long-term-memory/notes/permanent-delete",
        async (route) => {
          await deleteHeld;
          await route.continue();
        },
        { times: 1 },
      );
      const deleteRequest = page.waitForRequest(
        (request) =>
          request.method() === "POST" && request.url().endsWith("/api/long-term-memory/notes/permanent-delete"),
      );
      await page.locator("[data-ltm-bulk-actions]").getByRole("button", { name: "Delete" }).click();
      await deleteRequest;
      await deleteMemorySearch.fill("");
      await deleteTargetCards[0]!.waitFor({ state: "attached" });
      const worldNoteGroup = page.locator('[data-ltm-memory-group="world"]');
      if (!(await worldNoteGroup.evaluate((element) => (element as HTMLDetailsElement).open)))
        await worldNoteGroup.locator("summary").click();
      await deleteTargetCards[1]!.locator("button").first().click();
      await page.waitForFunction(
        () => document.querySelector<HTMLInputElement>("[data-ltm-field='title']")?.value === "Mobile recovery memory",
      );
      const noteQueriesBeforeDelete = noteQueries.length;
      releaseDelete?.();
      await deleteResponse;
      assert.deepEqual(permanentDeleteCalls.at(-1), deleteTargetIds);
      // When the deletion finishes, the list reloads, the deleted memories leave the selection, and the deleted memory
      // opened meanwhile closes with the notice that says why.
      await deleteTargetCards[0]!
        .locator("[data-ltm-note-actions-desktop] button:enabled:not([aria-disabled='true'])")
        .first()
        .waitFor();
      assert.ok(noteQueries.length > noteQueriesBeforeDelete, "the memory list reloads after the deletion");
      assert.equal(await deleteTargetCards[0]!.locator('input[type="checkbox"]').isChecked(), false);
      assert.equal(await page.locator("[data-ltm-note-editor]").count(), 0);
      await toastWith(page, "2 memories deleted.").waitFor();
      assert.equal(
        await page.locator("[data-sonner-toast]").filter({ hasText: "2 memories deleted." }).count(),
        1,
        "the toast says why the open memory closed",
      );

      // A selection change while the delete-target lookup is still resolving must
      // cancel the pending permanent delete instead of acting on the stale IDs.
      for (const card of deleteTargetCards) await card.locator('input[type="checkbox"]').check();
      lastDeleteConfirmation = null;
      const beforeStaleDeleteCalls = permanentDeleteCalls.length;
      holdDeleteTargetLookup = true;
      const staleLookupResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.url().includes("/api/long-term-memory/notes?ids=") &&
          response.url().includes("world_second_mobile"),
      );
      // Keep an earlier assertion failure from being masked by this pending wait rejecting during cleanup.
      staleLookupResponse.catch(() => {});
      await page.locator("[data-ltm-bulk-actions]").getByRole("button", { name: "Delete" }).click();
      for (let attempt = 0; attempt < 200 && !releaseDeleteTargetLookup; attempt += 1) await page.waitForTimeout(5);
      assert.ok(releaseDeleteTargetLookup, "delete target lookup must still be pending");
      const bulkDeleteButton = page.locator("[data-ltm-bulk-actions]").getByRole("button", { name: "Delete" });
      assert.equal(
        await bulkDeleteButton.isDisabled(),
        true,
        "bulk delete controls must be disabled while targets resolve",
      );
      await deleteTargetCards[1].locator('input[type="checkbox"]').uncheck();
      const releaseStaleLookup = releaseDeleteTargetLookup;
      releaseDeleteTargetLookup = null;
      releaseStaleLookup();
      await staleLookupResponse;
      await page.waitForTimeout(50);
      assert.equal(
        lastDeleteConfirmation,
        null,
        "A selection change during target resolution must not open a delete confirmation",
      );
      assert.equal(
        permanentDeleteCalls.length,
        beforeStaleDeleteCalls,
        "A stale permanent delete must not reach the server",
      );
      for (let attempt = 0; attempt < 100 && (await bulkDeleteButton.isDisabled()); attempt += 1)
        await page.waitForTimeout(5);
      assert.equal(
        await bulkDeleteButton.isDisabled(),
        false,
        "bulk delete controls must be re-enabled after the stale delete cancels",
      );

      // A failed target lookup must surface the localized no-op message, not raw server text.
      failReviewContext = true;
      await bulkDeleteButton.click();
      await page
        .locator("[data-ltm-vault-feedback]")
        .getByText("The selected memories could not be loaded for confirmation. No memories were deleted.")
        .waitFor();
      assert.doesNotMatch(await page.locator("[data-ltm-vault-feedback]").innerText(), /temporarily unavailable/u);
      failReviewContext = false;

      await page.locator('[data-ltm-control="navigation"][data-ltm-destination="review"]').first().click();
      const clearSource = page.locator('[data-ltm-review-source-select="source_mobile_single"]');
      await clearSource.click();
      await page.locator("[data-ltm-rejected-suggestions] > summary").click();
      const clearSourceSuggestions = page.locator(
        '[data-ltm-rejected-source="source_mobile_single"] [data-ltm-rejected-suggestion]',
      );
      await clearSourceSuggestions.waitFor();
      const clearRejectedButton = page.locator("[data-ltm-clear-rejected-suggestions]");
      confirmReviewDiscard = false;
      await page.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          confirmAction: (
            window as Window & {
              confirmReviewDiscard: (options: { message?: string }) => boolean;
            }
          ).confirmReviewDiscard,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      });
      await clearRejectedButton.click();
      assert.equal(await clearSourceSuggestions.count(), 1);
      assert.match(lastReviewDiscardMessage, /Clear 1 rejected suggestions from Single-draft mobile source/u);
      confirmReviewDiscard = true;
      await page.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = {
          ...element.capabilityProps,
          confirmAction: (
            window as Window & {
              confirmReviewDiscard: (options: { message?: string }) => boolean;
            }
          ).confirmReviewDiscard,
        };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      });
      clearRejectedSuggestionsFailure = true;
      await clearRejectedButton.click();
      const failedClearToast = toastWith(page, "Clear rejected suggestions fixture failed");
      await failedClearToast.waitFor();
      assert.equal(await failedClearToast.getAttribute("data-type"), "error", "a failed clear is an error toast");
      assert.equal(await clearSourceSuggestions.count(), 1);
      clearRejectedSuggestionsFailure = false;
      await clearRejectedButton.click();
      await clearSourceSuggestions.waitFor({ state: "detached" });
      await page.getByText("Removed 1 rejected suggestion from Single-draft mobile source.", { exact: true }).waitFor();
      await page.locator('[data-ltm-review-source-select="source_mobile_blank"]').click();
      await page.locator("[data-ltm-rejected-suggestions] > summary").click();
      assert.equal(
        await page.locator('[data-ltm-rejected-source="source_mobile_blank"] [data-ltm-rejected-suggestion]').count(),
        1,
      );
      await page.evaluate(() => {
        const element = document.querySelector("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: Record<string, unknown>;
        };
        element.capabilityProps = { ...element.capabilityProps, confirmAction: undefined };
        element.dispatchEvent(new CustomEvent("marinara-capability-props"));
      });
      const expectedInitialChatSourceScope = {
        chatId: "desktop-chat",
        chatIds: ["desktop-chat"],
      };
      await page.locator('[data-ltm-control="navigation"][data-ltm-destination="sources"]').first().click();
      // soup/sources-review: Sources opens on Chat Messages, the first tab, and every kind tab carries its icon.
      await page.locator('[data-ltm-source-tab="messages"][aria-selected="true"]').waitFor();
      assert.deepEqual(
        await page.locator("[data-ltm-source-tab]").evaluateAll((tabs) =>
          tabs.map((tab) => {
            const icon = tab.querySelector("svg");
            // Visible, not just present: the Engine sheds .mari-editor-tab > svg in mid-width containers.
            return [
              tab.getAttribute("data-ltm-source-tab"),
              icon !== null && getComputedStyle(icon).display !== "none",
            ];
          }),
        ),
        [
          ["messages", true],
          ["chats", true],
          ["characters", true],
          ["lorebooks", true],
        ],
      );
      await page.locator('[data-ltm-source-tab="chats"]').click();
      await page.locator('[data-ltm-source-preview-status="success"]').waitFor();
      const sourceScopePicker = page.locator('[data-ltm-scope-picker="source"]');
      const sourceScopeTrigger = sourceScopePicker.getByRole("combobox");
      assert.match((await sourceScopeTrigger.innerText()).trim(), /All/u);
      // soup/ltm-frame-vault: "Find sources in" explains itself under the picker, with no (i) button.
      const sourceScopeHint = page.locator("[data-ltm-source-scope-hint]");
      assert.equal(
        (await sourceScopeHint.innerText()).trim(),
        "Search every available character, lorebook, and chat.",
        "Find sources in shows its hint",
      );
      assert.equal(await page.locator('[data-ltm-info="Find sources in"]').count(), 0, "Find sources in has no (i)");
      assert.equal(
        await sourceScopeTrigger.evaluate(
          (trigger, hintId) => (trigger.getAttribute("aria-describedby") ?? "").split(" ").includes(hintId),
          (await sourceScopeHint.getAttribute("id")) ?? "",
        ),
        true,
        "the picker is described by its hint",
      );
      const scopeTriggerBox = await sourceScopeTrigger.boundingBox();
      const scopeHintBox = await sourceScopeHint.boundingBox();
      assert.ok(scopeTriggerBox && scopeHintBox);
      assert.ok(
        scopeHintBox.y >= scopeTriggerBox.y + scopeTriggerBox.height - 1,
        "the Find sources in hint sits under the picker, not beside it",
      );
      await sourceScopeTrigger.click();
      assert.equal(await sourceScopePicker.locator('[role="listbox"] input').count(), 0);
      assert.deepEqual(
        await sourceScopePicker
          .locator("[data-ltm-scope-tab]")
          .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-ltm-scope-tab"))),
        ["all", "chat", "character", "persona"],
      );
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-tab="all"][data-active="true"]').count(), 1);
      assert.deepEqual(
        await sourceScopePicker.locator('[role="option"]').evaluateAll((options) =>
          options.slice(0, 2).map((option) => {
            const text = option.querySelector("span.min-w-0");
            return {
              label: text?.children[0]?.textContent?.trim(),
              comment: text?.children[1]?.textContent?.trim(),
            };
          }),
        ),
        [
          { label: "Current", comment: "Current Final Branch" },
          { label: "All", comment: undefined },
        ],
      );
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-option="chat:desktop-chat"]').count(), 1);
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-option="all"]').count(), 1);
      // #1588: the list renders 100 places at a time. The fixture's 100 bulk chats come before the group, so the
      // group is one "Show more" away, and the next tab or search starts again at 100. From the search box the
      // arrows reach "Show more" and Enter moves the highlight to the first place it adds.
      const sourceScopeShowMore = sourceScopePicker.locator("[data-ltm-scope-show-more]");
      const sourceScopeSearch = sourceScopePicker.locator("[data-ltm-scope-picker-popup] input");
      assert.equal(await sourceScopePicker.locator("[data-ltm-scope-option]").count(), 102);
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-option="group:conversation-a"]').count(), 0);
      assert.equal((await sourceScopeShowMore.innerText()).trim(), "Show 6 more");
      await sourceScopeSearch.focus();
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowUp");
      assert.equal(
        await sourceScopeSearch.getAttribute("aria-activedescendant"),
        await sourceScopeShowMore.getAttribute("id"),
      );
      await page.keyboard.press("Enter");
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-option="group:conversation-a"]').count(), 1);
      assert.equal(await sourceScopeShowMore.count(), 0);
      assert.equal(
        await sourceScopeSearch.getAttribute("aria-activedescendant"),
        await sourceScopePicker.locator("[data-ltm-scope-option]").nth(102).getAttribute("id"),
        "Enter on Show more highlights the 101st place",
      );
      await sourceScopePicker.locator('[data-ltm-scope-tab="chat"]').click();
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-tab="chat"][data-active="true"]').count(), 1);
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-tabpanel="chat"][role="tabpanel"]').count(), 1);
      assert.equal(
        await sourceScopePicker.locator('[role="tabpanel"]').getAttribute("aria-labelledby"),
        await sourceScopePicker.locator('[data-ltm-scope-tab="chat"]').getAttribute("id"),
      );
      assert.equal(
        await sourceScopePicker.locator('[data-ltm-scope-tab="chat"]').getAttribute("aria-controls"),
        await sourceScopePicker.locator('[role="tabpanel"]').getAttribute("id"),
      );
      assert.equal(await sourceScopePicker.locator('[role="tabpanel"] [role="listbox"]').count(), 1);
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-option="chat:desktop-chat"]').count(), 1);
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-option="all"]').count(), 1);
      await sourceScopeShowMore.click();
      assert.match(
        await sourceScopePicker.locator('[data-ltm-scope-option="group:conversation-a"]').innerText(),
        /^Conversation A\nAll branches$/u,
        "a chat with branches is one Chats entry",
      );
      assert.equal(
        await sourceScopePicker
          .locator('[data-ltm-scope-tab="chat"]')
          .evaluate((tab) => document.activeElement === tab),
        true,
        "mouse-activated tab receives focus so roving keyboard navigation can continue",
      );
      await page.keyboard.press("ArrowRight");
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-tab="character"][data-active="true"]').count(), 1);
      assert.equal(
        await sourceScopePicker
          .locator('[data-ltm-scope-tab="character"]')
          .evaluate((tab) => document.activeElement === tab),
        true,
      );
      await sourceScopePicker.locator('[data-ltm-scope-tab="all"]').click();
      await sourceScopePicker.locator("[data-ltm-scope-picker-popup] input").fill("does-not-match");
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-option="chat:desktop-chat"]').count(), 1);
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-option="all"]').count(), 1);
      assert.equal(await sourceScopePicker.locator('[data-ltm-scope-option="group:conversation-a"]').count(), 0);
      await sourceScopePicker.locator("[data-ltm-scope-picker-popup] input").fill("Member Final Branch");
      assert.equal(
        await sourceScopePicker.locator('[data-ltm-scope-option="group:conversation-a"]').count(),
        1,
        "branch family is searchable by a member branch display name",
      );
      await sourceScopePicker.locator("[data-ltm-scope-picker-popup] input").fill("");
      await sourceScopeShowMore.click();
      assert.equal(
        await sourceScopePicker.locator('[role="option"][data-ltm-scope-option="chat:memory-chat"]').count(),
        0,
      );
      assert.equal(
        await sourceScopePicker.locator('[role="option"][data-ltm-scope-option="branch:memory-chat"]').count(),
        0,
      );
      assert.equal(
        await sourceScopePicker.locator('[role="option"][data-ltm-scope-option="group:conversation-a"]').count(),
        1,
      );
      assert.notEqual(
        await sourceScopePicker
          .locator("[data-ltm-scope-picker-popup]")
          .evaluate((listbox) => getComputedStyle(listbox).backgroundColor),
        "rgba(0, 0, 0, 0)",
      );
      const scopedChatPreviewRequestPromise = page.waitForRequest((request) => {
        if (request.method() !== "POST" || !request.url().includes("/api/long-term-memory/import/preview"))
          return false;
        const body = request.postDataJSON() as { source?: string; sourceScope?: unknown };
        return (
          body.source === "chats" && JSON.stringify(body.sourceScope) === JSON.stringify(expectedInitialChatSourceScope)
        );
      });
      await sourceScopePicker.locator('[data-ltm-scope-tab="chat"]').click();
      await sourceScopePicker.locator('[role="option"][data-ltm-scope-option="chat:desktop-chat"]').click();
      const scopedChatPreviewRequest = (await scopedChatPreviewRequestPromise).postDataJSON() as {
        sourceScope?: unknown;
      };
      assert.deepEqual(scopedChatPreviewRequest.sourceScope, expectedInitialChatSourceScope);
      await page.locator('[data-ltm-source-preview-status="success"]').waitFor();
      // Unified destination panel replaces the split combobox + "Add more locations".
      const destinationPanel = page.locator("#ltm-destination-scope-control");
      await destinationPanel.waitFor();
      const destinationScope = destinationPanel.locator("[data-ltm-destination-scope]");
      assert.equal(await destinationScope.getAttribute("open"), null, "destination scope starts collapsed");
      // soup/sources-review: one bar closes the list. This scenario opens no chat, so the chosen source reads by its
      // own label; the "This chat" default is checked in the chat-mounted block after the detail mount.
      assert.equal(
        (await destinationScope.locator("[data-ltm-destination-scope-summary]").innerText()).trim(),
        "Current",
        "soup/sources-review: a chosen destination shows in the bar, not the Choose chip",
      );
      const importAllNew = page.locator('[data-ltm-source-preview="chats"] [data-ltm-source-action="import-all-new"]');
      assert.equal(await importAllNew.getAttribute("aria-disabled"), null, "Import all new needs no destination step");
      assert.equal(
        await destinationPanel.locator('[data-ltm-source-action="import-all-new"]').count(),
        1,
        "soup/sources-review: Import all new sits in the one bar",
      );
      assert.equal(
        await destinationPanel.locator("[data-ltm-import-limit-hint]").innerText(),
        "You can choose up to 100 parts per import.",
        "soup/sources-review: the bar carries one hint line",
      );
      assert.equal(await destinationPanel.evaluate((bar) => getComputedStyle(bar).position), "sticky");
      assert.equal(
        await page
          .locator('[data-ltm-source-preview="chats"] [data-ltm-source-navigator] > :last-child')
          .evaluate((last) => last.id),
        "ltm-destination-scope-control",
        "soup/sources-review: the bar is the card's last element, so it never covers a row",
      );
      assert.equal(
        (await destinationScope.locator("[data-ltm-destination-change]").innerText()).trim(),
        "Change",
        "soup/sources-destination: the chip offers Change",
      );
      assert.equal(await importAllNew.count(), 1, "soup/sources-review: one Import all new");
      assert.equal(
        await page.locator('[data-ltm-source-preview="chats"] [data-ltm-source-group="ready"]').getAttribute("open"),
        "",
        "soup/sources-destination: Ready to import starts open",
      );
      assert.equal(
        await destinationScope.locator('[data-ltm-availability-tab="all"]').isVisible(),
        false,
        "destination tab rail stays inside the collapsed disclosure",
      );
      // soup/sources-mobile: at phone width the open picker unpins and reads in the page's own scroll. Opening scrolls
      // to it with its "Available in" line held at the top; closing returns the list to where it was.
      const wideViewport = page.viewportSize();
      await page.setViewportSize({ width: 390, height: 844 });
      const listTop = await destinationPanel.evaluate((bar) => {
        const spacer = document.createElement("div");
        spacer.setAttribute("data-ltm-test-spacer", "");
        spacer.style.height = "2000px";
        bar.before(spacer);
        // The app's editor shell is viewport-bound, so its content is the scroller; the harness shell is not.
        document.querySelector<HTMLElement>("main.mari-editor-shell")!.style.height = "844px";
        const content = document.querySelector(".mari-editor-content")!;
        content.scrollTop = 900;
        return content.scrollTop;
      });
      const phoneLayout = () =>
        destinationPanel.evaluate((bar) => {
          const content = document.querySelector(".mari-editor-content")!;
          return {
            position: getComputedStyle(bar).position,
            summaryOffset: Math.round(
              bar.querySelector("summary")!.getBoundingClientRect().top - content.getBoundingClientRect().top,
            ),
            scrollTop: content.scrollTop,
          };
        });
      assert.equal((await phoneLayout()).position, "sticky", "soup/sources-mobile: the closed bar stays pinned");
      await destinationScope.locator("summary").click();
      await page.waitForFunction((top) => document.querySelector(".mari-editor-content")!.scrollTop > top, listTop);
      const opened = await phoneLayout();
      assert.equal(opened.position, "static", "soup/sources-mobile: the open picker leaves the pin");
      assert.ok(
        opened.summaryOffset < 40,
        `soup/sources-mobile: opening scrolls to the picker (${opened.summaryOffset})`,
      );
      await page.evaluate(() => (document.querySelector(".mari-editor-content")!.scrollTop += 500));
      assert.equal(
        (await phoneLayout()).summaryOffset,
        opened.summaryOffset,
        "soup/sources-mobile: the Available in line stays at the top while the picker scrolls",
      );
      if (visualOutputDir)
        await page.screenshot({ path: join(visualOutputDir, "long-term-memory-destination-phone-open.png") });
      await destinationScope.locator("summary").click();
      await page.waitForFunction((top) => document.querySelector(".mari-editor-content")!.scrollTop === top, listTop);
      assert.equal((await phoneLayout()).position, "sticky", "soup/sources-mobile: closing pins the bar again");
      await page.evaluate(() => {
        document.querySelector("[data-ltm-test-spacer]")!.remove();
        document.querySelector<HTMLElement>("main.mari-editor-shell")!.style.height = "";
      });
      if (wideViewport) await page.setViewportSize(wideViewport);
      await destinationScope.locator("summary").click();
      assert.notEqual(
        await destinationScope.getAttribute("open"),
        null,
        "destination scope expands when the summary is clicked",
      );
      assert.equal(
        await destinationPanel.evaluate((bar) => getComputedStyle(bar).position),
        "sticky",
        "soup/sources-mobile: on a wide screen the open picker stays pinned",
      );
      assert.equal(await page.locator('[data-ltm-scope-picker="destination"]').count(), 0);
      assert.equal(await page.locator("[data-ltm-add-destination]").count(), 0);
      assert.equal(await destinationPanel.getByText("Make memories available in", { exact: true }).count(), 1);
      assert.deepEqual(
        await destinationPanel
          .locator("[data-ltm-availability-tab]")
          .evaluateAll((tabs) =>
            tabs.map((tab) => [tab.getAttribute("data-ltm-availability-tab"), tab.getAttribute("aria-selected")]),
          ),
        [
          ["all", "true"],
          ["chat", "false"],
          ["character", "false"],
          ["persona", "false"],
        ],
        "the destination shares the four place tabs and opens on All",
      );
      // Emptying the default leaves import blocked until a destination is chosen again.
      assert.equal(await destinationPanel.locator('button[aria-label^="Remove "]').count(), 1);
      await destinationPanel.locator('button[aria-label^="Remove "]').click();
      assert.equal(await destinationPanel.locator('button[aria-label^="Remove "]').count(), 0);
      assert.equal(
        (await destinationScope.locator("[data-ltm-destination-scope-summary]").innerText()).trim(),
        "Choose",
        "soup/sources-review: with no destination the chip reads Choose",
      );
      assert.equal(await destinationScope.locator("[data-ltm-destination-change]").count(), 0);
      // The reason is a screen-reader-only description: no warning sentence and no second link on screen.
      assert.equal(await page.locator("[data-ltm-import-reason], [data-ltm-choose-destination]").count(), 0);
      assert.equal(await importAllNew.getAttribute("aria-disabled"), "true", "Import all new waits for a destination");
      const importAllNewReason = await importAllNew.getAttribute("aria-describedby");
      assert.equal(
        await page.locator(`[id="${importAllNewReason}"][data-ltm-destination-hint]`).textContent(),
        "Choose a destination before importing scoped memories.",
      );
      // #1588: the selection bar says why Import is off, and the button points at that reason.
      const chatsSelectToggle = page
        .locator('[data-ltm-source-preview="chats"]')
        .getByRole("button", { name: "Select", exact: true });
      await chatsSelectToggle.click();
      await page.locator('[data-ltm-source-status-filter="ready"]').click();
      const firstSourceSelect = page.locator('[data-ltm-source-select="character-outside-current-chat"]');
      await firstSourceSelect.check();
      const importReasonId = await page
        .locator(':is([data-ltm-source-action="import-selected"], [data-ltm-source-action="refresh-selected"]):visible')
        .first()
        .getAttribute("aria-describedby");
      assert.ok(importReasonId, "the off Import button points at its reason");
      const importReasonLine = page.locator(`[id="${importReasonId}"][data-ltm-destination-hint]`);
      assert.equal(await importReasonLine.count(), 1, "the reason the button points at is the bar's status line");
      assert.equal(await importReasonLine.textContent(), "Choose a destination before importing scoped memories.");
      // The button stays focusable, so a keyboard user hears that reason as its description, and pressing it
      // does nothing.
      const waitingImport = page
        .locator(':is([data-ltm-source-action="import-selected"], [data-ltm-source-action="refresh-selected"]):visible')
        .first();
      assert.equal(await waitingImport.getAttribute("aria-disabled"), "true");
      await waitingImport.focus();
      assert.equal(await waitingImport.evaluate((button) => button === document.activeElement), true);
      const destinationReasons = page.getByText("Choose a destination before importing scoped memories.");
      const destinationReasonCount = await destinationReasons.count();
      await page.keyboard.press("Enter");
      assert.equal(await destinationReasons.count(), destinationReasonCount);
      // soup/sources-review: the reason is read, never shown as a sentence with a second link; the chip is the one
      // route to the destination and opens the picker at every width.
      assert.equal(await page.locator("[data-ltm-import-reason]").count(), 0, "no warning sentence");
      const destinationHintBox = await destinationPanel.locator("[data-ltm-destination-hint]").boundingBox();
      assert.ok(destinationHintBox && destinationHintBox.width <= 1 && destinationHintBox.height <= 1);
      for (const width of [1280, 900, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await destinationScope.evaluate((details) => {
          (details as HTMLDetailsElement).open = false;
        });
        assert.equal(await page.locator("[data-ltm-choose-destination]").count(), 0, `${width}px: no second link`);
        await destinationScope.locator("summary").scrollIntoViewIfNeeded();
        await destinationScope.locator("summary").click();
        assert.equal(await destinationScope.evaluate((details) => (details as HTMLDetailsElement).open), true, width);
        await destinationScope.locator("summary").waitFor({ state: "visible" });
        assert.equal(
          await destinationScope.locator("summary").evaluate((summary) => summary === document.activeElement),
          true,
          `${width}px: focus lands on the destination summary`,
        );
        // #1659: with selection mode on and the destination open, the pane tabs (narrow), status filters, Done and
        // the destination rows all keep 2.75rem.
        assert.deepEqual(
          await shortTouchTargets('[data-ltm-surface="sources"]'),
          [],
          `${width}px: Sources tabs and actions fit 2.75rem`,
        );
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await firstSourceSelect.uncheck();
      await page
        .locator('[data-ltm-source-preview="chats"]')
        .getByRole("button", { name: "Done", exact: true })
        .click();
      await chatsSelectToggle.waitFor();
      await page.locator('[data-ltm-source-status-filter="all"]').click();

      // The All tab lists every place kind and labels each row with its kind. #1588: the rail renders 100 places
      // at a time, and the fixture's 100 bulk chats push the rest behind "Show more"; a new tab starts again at 100.
      const destinationShowMore = destinationPanel.locator("[data-ltm-availability-show-more]");
      assert.equal(await destinationPanel.locator("[data-ltm-availability-target]").count(), 100);
      assert.equal((await destinationShowMore.innerText()).trim(), "Show 6 more");
      await destinationShowMore.click();
      // Show more focuses the first place it adds, the 101st row.
      await page.waitForFunction(
        () =>
          document.activeElement ===
          document.querySelectorAll("#ltm-destination-scope-control [data-ltm-availability-target]")[100],
      );
      assert.equal(await destinationShowMore.count(), 0);
      for (const [target, kind] of [
        ["chat:desktop-chat", "Chat · Current Final Branch"],
        ["chat:conversation-a", "Chat · All branches"],
        ["character:character-a", "Character"],
        ["persona:persona-a", "Persona · Space explorer"],
      ]) {
        assert.match(
          await destinationPanel.locator(`[data-ltm-availability-target="${target}"]`).innerText(),
          new RegExp(kind, "u"),
        );
      }

      // Each kind tab shows only its own places; a chat with branches is one Chats row.
      await destinationPanel.locator('[data-ltm-availability-tab="chat"]').click();
      await destinationShowMore.click();
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="chat:desktop-chat"]').count(), 1);
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="persona:persona-a"]').count(), 0);
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="chat:conversation-a"]').count(), 1);
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="chat:valid-group"]').count(), 1);
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="chat:overflow-group"]').count(), 0);
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="chat:memory-chat"]').count(), 0);
      await destinationPanel.locator('[data-ltm-availability-search="chat"]').fill("Current Final Branch");
      assert.equal(
        await destinationPanel.locator('[data-ltm-availability-target="chat:desktop-chat"]').count(),
        1,
        "current target is searchable by its display name through the destination filter",
      );
      await destinationPanel.locator('[data-ltm-availability-search="chat"]').fill("");
      await destinationPanel.locator('[data-ltm-availability-tab="character"]').click();
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="character:character-a"]').count(), 1);
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="chat:conversation-a"]').count(), 0);

      // Personas are visible and searchable within their category.
      await destinationPanel.locator('[data-ltm-availability-tab="persona"]').click();
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="persona:persona-a"]').count(), 1);
      const personaSearch = destinationPanel.locator('[data-ltm-availability-search="persona"]');
      await personaSearch.fill("Private detective");
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="persona:persona-a"]').count(), 0);
      assert.equal(await destinationPanel.locator('[data-ltm-availability-target="persona:persona-b"]').count(), 1);
      await personaSearch.fill("");

      // All chats picks every chat that still fits the 100-ID limit, then clears them again.
      await destinationPanel.locator('[data-ltm-availability-tab="chat"]').click();
      await destinationShowMore.click();
      const allChatsDestination = destinationPanel.locator('[data-ltm-availability-target="chat:all"]');
      assert.equal(await allChatsDestination.getAttribute("aria-pressed"), "false");
      await allChatsDestination.click();
      assert.equal(await allChatsDestination.getAttribute("aria-pressed"), "true");
      for (const [target, pressed] of [
        ["chat:desktop-chat", "true"],
        ["chat:bulk-chat-0", "true"],
        ["chat:bulk-chat-99", "false"],
        ["chat:valid-group", "false"],
      ]) {
        assert.equal(
          await destinationPanel.locator(`[data-ltm-availability-target="${target}"]`).getAttribute("aria-pressed"),
          pressed,
          target,
        );
      }
      assert.equal(await destinationPanel.getByText(/some locations can't be added/u).count(), 1);
      // ponytail: 100 chips squeeze the rail as they did the old list; click through the DOM until the panel scrolls.
      await allChatsDestination.evaluate((element) => (element as HTMLButtonElement).click());
      assert.equal(await allChatsDestination.getAttribute("aria-pressed"), "false");
      assert.equal(await destinationPanel.locator('button[aria-label^="Remove "]').count(), 0);

      // Home/End and Left/Right move focus across the category tabs.
      await destinationPanel.locator('[data-ltm-availability-tab="chat"]').focus();
      await destinationPanel.locator('[data-ltm-availability-tab="chat"]').press("Home");
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-ltm-availability-tab") === "all");
      await destinationPanel.locator('[data-ltm-availability-tab="chat"]').press("End");
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-ltm-availability-tab") === "persona");
      assert.equal(
        await destinationPanel.locator('[data-ltm-availability-tab="persona"]').getAttribute("aria-selected"),
        "true",
      );
      await destinationPanel.locator('[data-ltm-availability-tab="persona"]').press("ArrowLeft");
      await page.waitForFunction(
        () => document.activeElement?.getAttribute("data-ltm-availability-tab") === "character",
      );
      assert.equal(
        await destinationPanel.locator('[data-ltm-availability-tab="character"]').getAttribute("aria-selected"),
        "true",
      );

      // Build a two-category selection: the current chat, then a persona.
      await destinationPanel.locator('[data-ltm-availability-tab="chat"]').click();
      const currentDestination = destinationPanel.locator('[data-ltm-availability-target="chat:desktop-chat"]');
      assert.match(await currentDestination.innerText(), /^Current\nCurrent Final Branch$/u);
      // #1588: the destination hint is one status line that stays mounted, so emptying the selection is read
      // as a change.
      const destinationHint = destinationPanel.locator('[role="status"][data-ltm-destination-hint]');
      const destinationHintMounted = () =>
        destinationHint.evaluate((hint) => (hint as HTMLElement & { ltmMounted?: boolean }).ltmMounted);
      await destinationHint.evaluate((hint) => {
        (hint as HTMLElement & { ltmMounted?: boolean }).ltmMounted = true;
      });
      assert.equal(await destinationHint.textContent(), "Choose a destination before importing scoped memories.");
      await currentDestination.click();
      assert.equal(await destinationHint.textContent(), "");
      await destinationPanel.locator('button[aria-label^="Remove Current"]').click();
      assert.equal(await destinationHint.textContent(), "Choose a destination before importing scoped memories.");
      assert.equal(await destinationHintMounted(), true);
      await currentDestination.click();
      assert.equal(await currentDestination.getAttribute("aria-pressed"), "true");
      assert.equal(await destinationHintMounted(), true);
      assert.equal(await destinationPanel.locator('button[aria-label^="Remove Current"]').count(), 1);
      await destinationPanel.locator('[data-ltm-availability-tab="persona"]').click();
      await destinationPanel.locator('[data-ltm-availability-target="persona:persona-a"]').click();
      assert.equal(
        await destinationPanel
          .locator('[data-ltm-availability-target="persona:persona-a"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await destinationPanel.locator('button[aria-label^="Remove Persona A (current and future chats)"]').count(),
        1,
      );
      // The collapsed summary tracks the current destination selection.
      assert.doesNotMatch(
        await destinationScope.locator("[data-ltm-destination-scope-summary]").innerText(),
        /^Choose$/u,
      );
      // Choosing a destination again enables Import all new.
      assert.equal(
        await importAllNew.getAttribute("aria-disabled"),
        null,
        "a chosen destination enables Import all new",
      );

      // Capacity: the per-kind 100-ID limit blocks the 100th additional chat.
      await destinationPanel.locator('[data-ltm-availability-tab="chat"]').click();
      await destinationShowMore.click();
      const toggleBulkDestinationChats = async () => {
        for (let index = 0; index < 99; index += 1)
          await destinationPanel
            .locator(`[data-ltm-availability-target="chat:bulk-chat-${index}"]`)
            .evaluate((element) => (element as HTMLButtonElement).click());
      };
      await toggleBulkDestinationChats();
      const blockedBulkChat = destinationPanel.locator('[data-ltm-availability-target="chat:bulk-chat-99"]');
      await blockedBulkChat.evaluate((element) => (element as HTMLButtonElement).click());
      assert.equal(await blockedBulkChat.getAttribute("aria-pressed"), "false", "a place past the limit is not added");
      assert.equal(await destinationPanel.getByText(/some locations can't be added/u).count(), 1);
      // Reset the chat selection back to the current chat only.
      await toggleBulkDestinationChats();

      // The rail list is the bounded scroll container.
      const destinationListSelector = "#ltm-destination-scope-control [data-ltm-availability-list]";
      const destinationList = page.locator(destinationListSelector);
      const destinationListHeightAllowance = 400;
      const listMetrics = await destinationList.evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        overflowY: getComputedStyle(element).overflowY,
        docHeightBefore: document.documentElement.scrollHeight,
      }));
      assert.ok(listMetrics.scrollHeight > listMetrics.clientHeight);
      assert.match(listMetrics.overflowY, /auto|scroll/u);
      await destinationList.evaluate((element) => {
        element.scrollTop = 0;
      });
      await destinationList.hover();
      await page.mouse.wheel(0, 600);
      await page.waitForFunction(
        (selector) => ((document.querySelector(selector) as HTMLElement | null)?.scrollTop ?? 0) > 0,
        destinationListSelector,
      );
      const docHeightAfter = await destinationList.evaluate(() => document.documentElement.scrollHeight);
      assert.ok(docHeightAfter < listMetrics.docHeightBefore + destinationListHeightAllowance);

      // Mobile: the same list stays touch/wheel-scrollable inside the list pane, where the destination now lives.
      await page.setViewportSize({ width: 390, height: 844 });
      await destinationList.scrollIntoViewIfNeeded();
      const mobileListScrollable = await destinationList.evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        overflowY: getComputedStyle(element).overflowY,
        pageLocked: document.documentElement.scrollHeight > 2000,
      }));
      assert.ok(mobileListScrollable.scrollHeight > mobileListScrollable.clientHeight);
      assert.match(mobileListScrollable.overflowY, /auto|scroll/u);
      assert.equal(mobileListScrollable.pageLocked, false);
      await destinationList.evaluate((element) => {
        element.scrollTop = 0;
      });
      await destinationList.hover();
      await page.mouse.wheel(0, 600);
      await page.waitForFunction(
        (selector) => ((document.querySelector(selector) as HTMLElement | null)?.scrollTop ?? 0) > 0,
        destinationListSelector,
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      await page
        .locator('[data-ltm-source-preview="chats"]')
        .getByRole("button", { name: "Select", exact: true })
        .click();
      await page.locator('[data-ltm-source-status-filter="ready"]').click();
      await page.locator('[data-ltm-source-select="character-outside-current-chat"]').check();
      // soup/sources-destination: changing the destination keeps the entries you ticked.
      await destinationPanel.locator('[data-ltm-availability-tab="persona"]').click();
      const personaDestination = destinationPanel.locator('[data-ltm-availability-target="persona:persona-a"]');
      await personaDestination.click();
      assert.equal(await personaDestination.getAttribute("aria-pressed"), "false");
      assert.equal(
        await page.locator('[data-ltm-source-select="character-outside-current-chat"]').isChecked(),
        true,
        "soup/sources-destination: the ticked entry survives a destination change",
      );
      assert.equal(
        await page.locator('[data-ltm-source-action="import-selected"]').count(),
        1,
        "soup/sources-destination: Import selected stays available after a destination change",
      );
      assert.match(
        await page.locator('[data-ltm-source-preview="chats"]').innerText(),
        /\b1 selected\b/iu,
        "soup/sources-destination: the selected count stays at 1",
      );
      await personaDestination.click();
      assert.equal(await personaDestination.getAttribute("aria-pressed"), "true");
      assert.equal(
        await page.locator("[data-ltm-import-result-status]").count(),
        1,
        "the import status line is mounted before the import",
      );
      await page.locator("[data-ltm-import-result-status]").evaluate((line) => {
        (line as HTMLElement & { ltmMountedBeforeImport?: boolean }).ltmMountedBeforeImport = true;
      });
      const mergedDestinationRequestPromise = page.waitForRequest(
        (request) => request.method() === "POST" && request.url().includes("/api/long-term-memory/import/source-notes"),
      );
      await page.locator('[data-ltm-source-action="import-selected"]').click();
      const mergedDestinationRequest = (await mergedDestinationRequestPromise).postDataJSON() as {
        destinationScope?: unknown;
      };
      assert.deepEqual(mergedDestinationRequest.destinationScope, {
        chatId: "desktop-chat",
        chatIds: ["desktop-chat"],
        personaId: "persona-a",
        personaIds: ["persona-a"],
      });
      await page.locator("[data-ltm-import-scope-result]").waitFor();
      // #1588: the fixture batch fails, so the result is named as failed, never "complete", and the
      // status line that was already mounted reads it out.
      assert.equal(await page.locator("[data-ltm-import-result-heading]").innerText(), "Source import failed");
      assert.match(
        (await page.locator("[data-ltm-import-result-status]").textContent()) ?? "",
        /Requested 1; .*missing 1;/u,
      );
      assert.equal(
        await page
          .locator("[data-ltm-import-result-status]")
          .evaluate((line) => (line as HTMLElement & { ltmMountedBeforeImport?: boolean }).ltmMountedBeforeImport),
        true,
        "the status line stays mounted, so the result is read as a change",
      );
      // The failed result takes over the column, so return to the list to reach the destination bar.
      await page.getByRole("button", { name: "Back to preview" }).click();
      await destinationPanel.locator('button[aria-label^="Remove Current"]').click();
      // A whole chat and a character found by keyboard search import into the chosen places.
      await destinationPanel.locator('[data-ltm-availability-tab="chat"]').click();
      // The list is collapsed again after the import, so open it before reaching the last chats.
      if (await destinationShowMore.count()) await destinationShowMore.click();
      await destinationPanel.locator('[data-ltm-availability-target="chat:valid-group"]').click();
      assert.equal(
        await destinationPanel
          .locator('[data-ltm-availability-target="chat:valid-group"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await destinationPanel.locator('[data-ltm-availability-tab="all"]').click();
      const destinationAllSearch = destinationPanel.locator('[data-ltm-availability-search="all"]');
      await destinationAllSearch.fill("Character A");
      await destinationAllSearch.press("Tab");
      await destinationPanel.locator('[data-ltm-availability-target="character:character-a"]:focus').waitFor();
      await page.keyboard.press("Enter");
      assert.equal(
        await destinationPanel
          .locator('[data-ltm-availability-target="character:character-a"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await destinationAllSearch.fill("");
      await page.locator('[data-ltm-source-select="character-outside-current-chat"]').check();
      const validGroupRequestPromise = page.waitForRequest(
        (request) => request.method() === "POST" && request.url().includes("/api/long-term-memory/import/source-notes"),
      );
      await page.locator('[data-ltm-source-action="import-selected"]').click();
      const validGroupRequest = (await validGroupRequestPromise).postDataJSON() as {
        destinationScope?: unknown;
      };
      assert.deepEqual(validGroupRequest.destinationScope, {
        chatId: "valid-group-chat-0",
        chatIds: Array.from({ length: 100 }, (_, index) => `valid-group-chat-${index}`),
        groupId: "valid-group",
        groupIds: ["valid-group"],
        characterIds: ["character-a"],
        personaId: "persona-a",
        personaIds: ["persona-a"],
      });
      await page.locator("[data-ltm-import-scope-result]").waitFor();
      await page.locator('[data-ltm-source-tab="characters"]').click();
      await page.locator('[data-ltm-source-preview="characters"]').waitFor();
      await page.locator('[data-ltm-source-preview-status="success"]').waitFor();
      const allStatusFilter = page.locator('[data-ltm-source-status-filter="all"]');
      await allStatusFilter.click();
      await page.locator('[data-ltm-source-status-filter="all"][aria-selected="true"]').waitFor();
      await allStatusFilter.focus();
      await allStatusFilter.press("ArrowRight");
      await page.locator('[data-ltm-source-status-filter="ready"][aria-selected="true"]').waitFor();
      await page.waitForFunction(
        () => document.activeElement?.getAttribute("data-ltm-source-status-filter") === "ready",
      );
      assert.equal(await page.locator('[data-ltm-source-status-filter="ready"]').getAttribute("aria-selected"), "true");
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute("data-ltm-source-status-filter")),
        "ready",
      );
      await page.locator('[data-ltm-source-row-status][data-ltm-source-id="character-outside-current-chat"]').waitFor();
      const selectedCharacter = page.locator('[data-ltm-source-select="character-outside-current-chat"]');
      if (!(await selectedCharacter.isVisible())) {
        await page
          .locator('[data-ltm-source-preview="characters"]')
          .getByRole("button", { name: "Select", exact: true })
          .click();
      }
      await selectedCharacter.check();
      // soup/sources-navigator: the flat list's search, Mode, Reload and status tabs share one header bar, and
      // "Load more" sits under the list instead of in that bar.
      {
        const flatBar = page.locator('[data-ltm-source-preview="characters"] header', {
          has: page.locator("[data-ltm-source-search]"),
        });
        for (const control of [
          "[data-ltm-source-search]",
          "[data-ltm-source-mode]",
          '[data-ltm-source-action="refresh-preview"]',
          '[data-ltm-source-status-filter="all"]',
        ])
          assert.equal(await flatBar.locator(control).count(), 1, `the bar holds ${control}`);
        assert.equal(
          await flatBar.locator('[data-ltm-source-action="load-more"]').count(),
          0,
          "Load more is not in the bar",
        );
        const loadMoreBox = await page.locator('[data-ltm-source-action="load-more"]').boundingBox();
        const lastRowBox = await page.locator("[data-ltm-source-row-status]").last().boundingBox();
        assert.ok(
          loadMoreBox && lastRowBox && loadMoreBox.y >= lastRowBox.y + lastRowBox.height - 1,
          "Load more sits under the last row",
        );
      }
      await page.locator('[data-ltm-source-action="load-more"]').click();
      await page.locator('[data-ltm-source-row-status][data-ltm-source-id="character-next-page"]').waitFor();
      assert.equal(await selectedCharacter.isChecked(), true, "pagination preserves the selected source");
      assert.equal(
        await page.locator('[data-ltm-source-action="load-more"]').count(),
        0,
        "last page removes Load more",
      );
      assert.equal(
        sourcePreviewRequests.filter((request) => request.source === "characters").at(-1)?.cursor,
        "characters-page-2",
      );
      // #1588: docked narrow on a wide window, the row checkbox label is a 44px target and the destination panel
      // has no viewport-height cap. soup/sources-review: Sources is one column, so a row's preview opens under it.
      await dockDetailPanel(page, "24rem");
      assert.equal(
        await touchTargetSize(page.locator('label:has([data-ltm-source-select="character-outside-current-chat"])')),
        "fits",
      );
      const characterRowOpen = page.locator('[data-ltm-source-open="character-outside-current-chat"]');
      assert.equal(await characterRowOpen.getAttribute("aria-expanded"), "false");
      await characterRowOpen.click();
      const characterRegion = page.locator(
        '[role="listitem"]:has([data-ltm-source-open="character-outside-current-chat"]) > [data-ltm-source-workbench]',
      );
      await characterRegion.waitFor();
      assert.equal(await characterRowOpen.getAttribute("aria-expanded"), "true");
      assert.equal(await characterRowOpen.getAttribute("aria-controls"), await characterRegion.getAttribute("id"));
      await characterRegion.locator("[data-ltm-source-primary-actions]").waitFor();
      // One column: no pane switcher and no side-by-side panes, at this docked width and at any other.
      assert.equal(await page.locator('[data-ltm-surface="sources"] [data-ltm-workspace-pane-tab]').count(), 0);
      assert.equal(await page.locator('[data-ltm-surface="sources"] [data-ltm-workspace-pane]').count(), 0);
      if (visualOutputDir)
        await page.screenshot({ path: join(visualOutputDir, "long-term-memory-source-bar-docked.png") });
      // Esc closes the preview and focus returns to the row.
      await characterRowOpen.focus();
      await page.keyboard.press("Escape");
      await characterRegion.waitFor({ state: "detached" });
      assert.equal(await characterRowOpen.getAttribute("aria-expanded"), "false");
      assert.equal(await characterRowOpen.evaluate((button) => button === document.activeElement), true);
      // Esc from inside the preview closes it and moves focus back to the row; so does Close.
      await characterRowOpen.click();
      await characterRegion.waitFor();
      await characterRegion.locator("[data-ltm-source-action]").first().focus();
      await page.keyboard.press("Escape");
      await characterRegion.waitFor({ state: "detached" });
      assert.equal(await characterRowOpen.evaluate((button) => button === document.activeElement), true);
      await characterRowOpen.click();
      await characterRegion.locator("[data-ltm-source-preview-close]").click();
      await characterRegion.waitFor({ state: "detached" });
      assert.equal(await characterRowOpen.evaluate((button) => button === document.activeElement), true);
      // Clicking an open row closes it too; open it again for what follows.
      await characterRowOpen.click();
      await characterRegion.waitFor();
      await characterRowOpen.click();
      await characterRegion.waitFor({ state: "detached" });
      await characterRowOpen.click();
      await characterRegion.waitFor();
      // The bar only caps its height while the picker is open, and then stays inside the window.
      const importBar = page.locator("#ltm-destination-scope-control");
      await destinationScope.evaluate((details) => {
        (details as HTMLDetailsElement).open = false;
      });
      assert.equal(await importBar.evaluate((panel) => getComputedStyle(panel).maxHeight), "none");
      await destinationScope.evaluate((details) => {
        (details as HTMLDetailsElement).open = true;
      });
      assert.ok(((await importBar.boundingBox())?.height ?? Infinity) <= 900, "an open picker stays inside the window");
      await dockDetailPanel(page, null);
      if (visualOutputDir)
        await page.screenshot({
          path: join(visualOutputDir, "long-term-memory-source-pagination-desktop.png"),
          fullPage: true,
        });
      // Keep the import pending so row feedback can be checked independently of response timing.
      const importRoute = "**/api/long-term-memory/import/source-notes";
      let releaseImport!: () => void;
      const importPending = new Promise<void>((resolve) => {
        releaseImport = resolve;
      });
      await page.route(importRoute, async (route) => {
        await importPending;
        await route.continue();
      });
      const importingButton = page.locator(
        '[data-ltm-source-action="import"][data-ltm-source-id="character-outside-current-chat"]',
      );
      const idleButton = page.locator('[data-ltm-source-action="import"][data-ltm-source-id="character-next-page"]');
      const idleIcon = await idleButton.locator("svg").getAttribute("class");
      await importingButton.click();
      try {
        await page.locator('[data-ltm-import-status="pending"]').waitFor();
        const visibleSourceCountOwners = page.locator(
          '[data-ltm-surface="sources"] [data-ltm-source-task-count]:visible',
        );
        assert.equal(
          await visibleSourceCountOwners.count(),
          1,
          "an active source task exposes exactly one visible source count",
        );
        assert.match(await visibleSourceCountOwners.innerText(), /Importing 1/u);
        assert.equal(await importingButton.isDisabled(), true);
        assert.equal(await idleButton.isDisabled(), true);
        // #1659: the controls a run locks stay focusable (aria-disabled, never `disabled`) and a status line says why.
        for (const locked of [
          page.locator('[data-ltm-scope-picker-trigger="source"]'),
          page.locator("[data-ltm-source-mode]"),
        ]) {
          assert.equal(await locked.getAttribute("aria-disabled"), "true");
          assert.equal(await locked.evaluate((control) => control.matches(":disabled")), false);
        }
        // The last selected chat mode is natively disabled for its own reason, so only the others are checked.
        const lockedModeBoxes = page.locator("#ltm-destination-scope-control [data-ltm-availability-mode-checkbox]");
        assert.equal(
          await lockedModeBoxes.evaluateAll((boxes) =>
            boxes.every((box) => box.getAttribute("aria-disabled") === "true"),
          ),
          true,
        );
        const modeBefore = await page.locator("[data-ltm-source-mode]").inputValue();
        await page.locator("[data-ltm-source-mode]").focus();
        await page.keyboard.press(modeBefore === "roleplay" ? "ArrowUp" : "ArrowDown");
        assert.equal(
          await page.locator("[data-ltm-source-mode]").inputValue(),
          modeBefore,
          "a locked mode filter ignores a change",
        );
        const modeCheckedBefore = await lockedModeBoxes.evaluateAll((boxes) =>
          boxes.map((box) => (box as HTMLInputElement).checked),
        );
        await lockedModeBoxes.last().click({ force: true });
        assert.deepEqual(
          await lockedModeBoxes.evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).checked)),
          modeCheckedBefore,
          "a locked chat mode ignores a click",
        );
        assert.equal(
          await page.locator('[data-ltm-import-lock="sources"]').textContent(),
          "Locked while an import runs",
        );
        assert.equal(await page.locator('[data-ltm-import-lock="destination"]:visible').count(), 1);
        const lockedTrigger = page.locator('[data-ltm-scope-picker-trigger="source"]');
        await lockedTrigger.focus();
        await page.evaluate(
          () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        assert.equal(
          await lockedTrigger.evaluate((trigger) => document.activeElement === trigger),
          true,
          "a control locked by a running import keeps focus",
        );
        await lockedTrigger.press("Enter");
        assert.equal(await lockedTrigger.getAttribute("aria-expanded"), "false", "a locked picker does not open");
        assert.equal(
          await idleButton.locator("svg").getAttribute("class"),
          idleIcon,
          "unrelated sources retain their import icon",
        );
        assert.equal(
          await importingButton.locator("svg").getAttribute("class"),
          idleIcon,
          "the active row keeps its default icon while the task surface owns activity",
        );
        await page.waitForFunction(() => {
          const button = document.querySelector(
            '[data-ltm-source-action="import"][data-ltm-source-id="character-next-page"]',
          );
          return button && Number(getComputedStyle(button).opacity) < 1;
        });
        await page.waitForFunction(() => {
          const icon = document.querySelector('[data-ltm-surface="sources"] [data-ltm-source-task-count] svg');
          return Boolean(icon?.getAnimations().some((animation) => animation.playState === "running"));
        });
        const animatedIndicators = await page
          .locator('[data-ltm-surface="sources"] svg')
          .evaluateAll(
            (icons) =>
              icons.filter((icon) => icon.getAnimations().some((animation) => animation.playState === "running"))
                .length,
          );
        assert.equal(animatedIndicators, 1, "a running source task animates exactly one indicator");
      } finally {
        releaseImport();
      }
      await page.locator('[data-ltm-import-status="idle"]').waitFor();
      await page.unroute(importRoute);
      assert.equal(await importingButton.isEnabled(), true);
      assert.equal(await importingButton.locator("svg").getAttribute("class"), idleIcon);
      // A finished import's result takes over the column, so return to the list before ticking the next row.
      await page.getByRole("button", { name: "Back to preview" }).click();
      await selectedCharacter.check();
      const searchRoute = "**/api/long-term-memory/import/preview";
      let releaseSearch!: () => void;
      const searchPending = new Promise<void>((resolve) => {
        releaseSearch = resolve;
      });
      // A failed check below unroutes before the held request continues, so that late continue may find the
      // route already handled.
      await page.route(searchRoute, async (route) => {
        await searchPending;
        await route.continue().catch(() => undefined);
      });
      try {
        const searchRestart = page.waitForRequest(
          (request) =>
            request.method() === "POST" &&
            request.url().endsWith("/import/preview") &&
            request.postDataJSON()?.query === "Navigator",
        );
        await page.locator("[data-ltm-source-search]").fill("Navigator");
        assert.equal(
          Object.hasOwn((await searchRestart).postDataJSON(), "cursor"),
          false,
          "changing search restarts at the first page",
        );
        // #1588: the rows stay on screen until the search results arrive, and the list says it is loading.
        assert.equal(
          await page.locator('[data-ltm-source-row-status][data-ltm-source-id="character-next-page"]').count(),
          1,
          "a new search keeps the current rows while it loads",
        );
        assert.equal(await page.locator("#ltm-source-results-characters").getAttribute("aria-busy"), "true");
        const searchResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith("/import/preview") && response.request().postDataJSON()?.query === "Navigator",
        );
        releaseSearch();
        await searchResponse;
      } finally {
        releaseSearch();
        await page.unroute(searchRoute);
      }
      await page
        .locator('[data-ltm-source-row-status][data-ltm-source-id="character-next-page"]')
        .waitFor({ state: "detached" });
      assert.equal(await page.locator("#ltm-source-results-characters").getAttribute("aria-busy"), "false");
      await page.locator("[data-ltm-source-search]").fill("");
      await page.locator('[data-ltm-source-row-status][data-ltm-source-id="character-next-page"]').waitFor();
      assert.equal(await selectedCharacter.isChecked(), true);
      await selectedCharacter.uncheck();
      const characterPreviewRequest = sourcePreviewRequests.filter((request) => request.source === "characters").at(-1);
      assert.ok(characterPreviewRequest);
      assert.equal(Object.hasOwn(characterPreviewRequest, "sourceScope"), false);
      assert.doesNotMatch(
        await page.locator('[data-ltm-surface="sources"]').innerText(),
        /character card|Summary Prompt|lorebook entries as source notes/iu,
      );
      // #1783: on a Chat Messages row with a long chat name, the name is cut and the range stays whole.
      await page.locator('[data-ltm-source-tab="messages"]').click();
      assert.equal(
        await page.locator('[data-ltm-source-group="ready"]').getAttribute("open"),
        "",
        "soup/sources-destination: Ready to import starts open on every source tab",
      );
      await page.locator('[data-ltm-source-id="chat-long:messages:m1"] [data-ltm-source-message-range]').waitFor();
      const rangeViewport = page.viewportSize();
      // soup/sources-review: a ready row shows its checkbox before Select, an initials avatar and what it imports as.
      for (const [sourceId, meta] of [
        ["chat-long:messages:m1", "120 messages · Imports as Roleplay"],
        ["chat-long:messages:m121", "1 message · Imports as Roleplay"],
      ]) {
        const readyRow = page.locator(`[data-ltm-source-id="${sourceId}"][data-ltm-source-row-status]`);
        assert.equal(
          await readyRow.locator("[data-ltm-source-select]").isVisible(),
          true,
          `${sourceId}: checkbox shows before Select`,
        );
        assert.equal((await readyRow.locator("[data-ltm-source-avatar]").innerText()).trim(), "MV");
        assert.equal((await readyRow.locator("[data-ltm-source-meta]").innerText()).trim(), meta);
      }
      // Ticking one starts selection without pressing Select, and Done still ends it.
      await page.locator('[data-ltm-source-select="chat-long:messages:m1"]').check();
      await page
        .locator('[data-ltm-source-preview="messages"]')
        .getByText(/\b1 selected\b/iu)
        .waitFor();
      await page.locator('[data-ltm-source-select="chat-long:messages:m1"]').uncheck();
      await page
        .locator('[data-ltm-source-preview="messages"]')
        .getByRole("button", { name: "Done", exact: true })
        .click();
      await page.setViewportSize({ width: 320, height: 844 });
      for (const [sourceId, label] of [
        ["chat-long:messages:m1", "messages 1–120"],
        ["chat-long:messages:m121", "message 121"],
      ]) {
        const longRow = page.locator(`[data-ltm-source-id="${sourceId}"][data-ltm-source-row-status]`);
        const rangeLabel = longRow.locator("[data-ltm-source-message-range]");
        const nameLabel = longRow.locator("[data-ltm-source-chat-name]");
        assert.equal((await rangeLabel.innerText()).trim(), label);
        const rowBox = (await longRow.boundingBox())!;
        const rangeBox = (await rangeLabel.boundingBox())!;
        assert.ok(
          rangeBox.x + rangeBox.width <= rowBox.x + rowBox.width,
          `${sourceId}: the range label is inside the row`,
        );
        const badgeBox = (await longRow.locator("[data-ltm-source-status]").boundingBox())!;
        assert.ok(
          badgeBox.x + badgeBox.width <= rowBox.x + rowBox.width,
          `${sourceId}: the status badge is inside the row`,
        );
        assert.ok(
          (await nameLabel.evaluate((element) => element.clientWidth)) >= 100,
          `${sourceId}: the chat name keeps a readable width`,
        );
        assert.equal(
          await nameLabel.evaluate((element) => element.scrollWidth > element.clientWidth),
          true,
          `${sourceId}: the chat name is the element that is cut`,
        );
      }
      // #1910: Chat Summaries rows keep their range the same way, whether it is numbered or another form.
      await page.locator('[data-ltm-source-tab="chats"]').click();
      await page.locator("[data-ltm-source-search]").fill("Lanterns");
      await page.locator('[data-ltm-source-id="chat-long:numbered"][data-ltm-source-row-status]').waitFor();
      for (const [sourceId, label] of [
        ["chat-long:numbered", "messages 1–120"],
        ["chat-long:session", "game session 3"],
        ["chat-long:day", "27.07.2026"],
      ]) {
        const summaryRow = page.locator(`[data-ltm-source-id="${sourceId}"][data-ltm-source-row-status]`);
        const rangeLabel = summaryRow.locator("[data-ltm-source-message-range]");
        const nameLabel = summaryRow.locator("[data-ltm-source-chat-name]");
        assert.equal((await rangeLabel.innerText()).trim(), label);
        const rowBox = (await summaryRow.boundingBox())!;
        const rangeBox = (await rangeLabel.boundingBox())!;
        assert.ok(
          rangeBox.x + rangeBox.width <= rowBox.x + rowBox.width,
          `${sourceId}: the range label is inside the row`,
        );
        const badgeBox = (await summaryRow.locator("[data-ltm-source-status]").boundingBox())!;
        assert.ok(
          badgeBox.x + badgeBox.width <= rowBox.x + rowBox.width,
          `${sourceId}: the status badge is inside the row`,
        );
        assert.equal(
          await nameLabel.evaluate((element) => element.scrollWidth > element.clientWidth),
          true,
          `${sourceId}: the chat name is the element that is cut`,
        );
      }
      await page.locator("[data-ltm-source-search]").fill("");
      await page
        .locator('[data-ltm-source-id="chat-long:numbered"][data-ltm-source-row-status]')
        .waitFor({ state: "detached" });
      if (rangeViewport) await page.setViewportSize(rangeViewport);
      await page.locator('[data-ltm-source-tab="chats"]').click();
      await page.locator('[data-ltm-source-status-filter="imported"]').click();
      assert.match(await page.locator('[data-ltm-source-status-filter="imported"]').innerText(), /\([1-9]\d*\)/u);
      const desktopReextractRow = page.locator('[data-ltm-source-id="chat-a:summary-desktop-reextract"]');
      // Tab reaches the name of an imported row, which has no Import button, and Enter opens the row's preview
      // under it (#1584).
      await page.locator('[data-ltm-source-status-filter="imported"]').focus();
      const reextractRowNameFocused = () =>
        page.evaluate(
          () => document.activeElement?.matches('[data-ltm-source-open="chat-a:summary-desktop-reextract"]') ?? false,
        );
      for (let step = 0; step < 30 && !(await reextractRowNameFocused()); step += 1) await page.keyboard.press("Tab");
      assert.equal(await reextractRowNameFocused(), true, "Tab reaches the name of the imported source row");
      const sourceDetailsRequestPromise = page.waitForRequest(
        (request) =>
          request.method() === "POST" && request.url().includes("/api/long-term-memory/import/source-details"),
      );
      await page.keyboard.press("Enter");
      await page.locator("[data-ltm-source-workbench] h3", { hasText: "Desktop re-extract source" }).waitFor();
      const sourceDetailsRequest = (await sourceDetailsRequestPromise).postDataJSON() as Record<string, unknown>;
      assert.equal(Object.hasOwn(sourceDetailsRequest, "chatId"), false);
      await page.locator("[data-ltm-source-management] > summary").click();
      await page.locator('[data-ltm-source-management-action="copy"]').click();
      const sourceOperationWorkbench = page.locator("[data-ltm-source-operation-workbench]");
      await sourceOperationWorkbench.waitFor();
      // #1588: the opened action takes focus at its heading, not on the closed menu.
      await page.waitForFunction(
        () => document.activeElement?.matches("[data-ltm-source-operation-workbench] h2") ?? false,
      );
      assert.equal(
        await sourceOperationWorkbench.evaluate((element) => Boolean(element.closest("[data-ltm-source-column]"))),
        true,
      );
      // #1588: Close leaves the action and returns focus to the menu item that opened it.
      await sourceOperationWorkbench.locator("[data-ltm-source-operation-close]").click();
      await sourceOperationWorkbench.waitFor({ state: "detached" });
      await page.waitForFunction(
        () => document.activeElement?.matches('[data-ltm-source-management-action="copy"]') ?? false,
      );
      // #1588: the pressed menu item is the trigger even when the click leaves focus in the search field, as a
      // click does in Safari.
      await page.locator("[data-ltm-source-search]:visible").focus();
      await page.locator('[data-ltm-source-management-action="copy"]').dispatchEvent("click");
      await sourceOperationWorkbench.waitFor();
      await sourceOperationWorkbench.locator("[data-ltm-source-operation-close]").click();
      await sourceOperationWorkbench.waitFor({ state: "detached" });
      await page.waitForFunction(
        () => document.activeElement?.matches('[data-ltm-source-management-action="copy"]') ?? false,
      );
      // #1588: Close also leaves while a preview is loading; only an apply holds the action open.
      const derivedRoute = "**/api/long-term-memory/notes/*/derived";
      await page.route(derivedRoute, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sourceNoteId: decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-2) ?? ""),
            sourceIncomingLinkCount: 0,
            sourceOutgoingLinkCount: 0,
            memories: [],
          }),
        }),
      );
      await page.locator('[data-ltm-source-management-action="copy"]').click();
      await sourceOperationWorkbench.waitFor();
      const transferDestination = sourceOperationWorkbench.locator("[data-ltm-source-operation-destination]");
      assert.ok((await transferDestination.locator("option").count()) > 1, "the fixture offers a destination chat");
      await transferDestination.selectOption({ index: 1 });
      let releaseTransferPreview = () => {};
      const transferPreviewHeld = new Promise<void>((resolve) => {
        releaseTransferPreview = resolve;
      });
      await page.route("**/api/long-term-memory/notes/transfer-preview", async (route) => {
        await transferPreviewHeld;
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "held" }) });
      });
      const transferPreviewButton = sourceOperationWorkbench.locator('[data-ltm-source-operation-action="preview"]');
      await transferPreviewButton.click();
      await page.waitForFunction(
        () =>
          document.querySelector('[data-ltm-source-operation-action="preview"]')?.getAttribute("aria-disabled") ===
          "true",
      );
      assert.equal(await transferPreviewButton.getAttribute("disabled"), null, "a running preview stays focusable");
      await sourceOperationWorkbench.locator("[data-ltm-source-operation-close]").click();
      await sourceOperationWorkbench.waitFor({ state: "detached" });
      releaseTransferPreview();
      await page.unroute("**/api/long-term-memory/notes/transfer-preview");
      // The finished run's summary is an Engine toast, which the host announces once; the workbench keeps no live
      // copy of its own, and what happened to each memory stays in the result block to read.
      const archiveBatchRoute = "**/api/long-term-memory/notes/batch";
      await page.route(archiveBatchRoute, (route) =>
        route.fulfill({ json: { updatedNoteIds: ["archived-source"], skippedNoteIds: [], failedNoteIds: [] } }),
      );
      await page.locator('[data-ltm-source-management-action="archive"]').click();
      await sourceOperationWorkbench.waitFor();
      const workbenchLiveCopy = () =>
        sourceOperationWorkbench.evaluate((workbench) =>
          [...workbench.querySelectorAll('[role="status"], [aria-live]')]
            .filter((node) => !node.hasAttribute("data-ltm-source-operation-preview-summary"))
            .map((node) => ({ marked: node.hasAttribute("data-ltm-test-mounted"), text: node.textContent ?? "" })),
        );
      assert.deepEqual(await workbenchLiveCopy(), [], "the workbench keeps no live copy of its own");
      assert.equal(await sourceOperationWorkbench.locator("[data-ltm-source-operation-result]").count(), 0);
      await sourceOperationWorkbench.locator('[data-ltm-source-operation-action="preview"]').click();
      // This host has no confirmAction here, so Apply asks through the package's own confirm dialog; accept it.
      await sourceOperationWorkbench.locator('[data-ltm-source-operation-action="apply"]').click();
      await page.locator("[data-ltm-confirm-ok]").click();
      const workbenchResult = sourceOperationWorkbench.locator("[data-ltm-source-operation-result]");
      await workbenchResult.waitFor();
      const summaryToast = toastWith(page, "Updated 1; deleted 0; detached 0; excluded 0; skipped 0; failed 0.");
      await summaryToast.waitFor();
      assert.equal(await summaryToast.getAttribute("data-type"), "success");
      assert.deepEqual(await workbenchLiveCopy(), [], "nothing in the workbench announces the result a second time");
      assert.equal(await workbenchResult.locator("[data-ltm-status], [role=status], [aria-live]").count(), 0);
      assert.equal(await workbenchResult.locator("[data-ltm-source-operation-result-memory]").count(), 1);
      assert.match(
        await workbenchResult.locator("[data-ltm-source-operation-result-memory]").innerText(),
        /: Updated$/u,
      );
      await sourceOperationWorkbench.locator("[data-ltm-source-operation-close]").click();
      await sourceOperationWorkbench.waitFor({ state: "detached" });
      await page.unroute(archiveBatchRoute);
      await page.unroute(derivedRoute);
      await page.locator("[data-ltm-source-workbench] h3", { hasText: "Desktop re-extract source" }).waitFor();
      await page.locator('[data-ltm-source-tab="characters"]').click();
      await page.locator('[data-ltm-source-preview="characters"]').waitFor();
      await page.locator('[data-ltm-source-tab="chats"]').click();
      // The row's preview is still open from before the tab switch; clicking an open row would close it.
      if ((await desktopReextractRow.getAttribute("data-ltm-source-focused")) === null)
        await desktopReextractRow.click();
      const desktopReextract = page.locator('[data-ltm-source-inspector-action="re-extract"]');
      await desktopReextract.click();
      await page.waitForFunction(
        () =>
          document.querySelector('[data-ltm-surface="sources"]')?.getAttribute("data-ltm-extraction-status") ===
          "pending",
      );
      // The run holds the lock: the inspector's Re-extract is aria-disabled (never `disabled`) and says why.
      assert.equal(await desktopReextract.getAttribute("aria-disabled"), "true");
      assert.equal(await desktopReextract.getAttribute("disabled"), null);
      const reextractLockId = await desktopReextract.getAttribute("aria-describedby");
      assert.ok(reextractLockId, "a locked Re-extract points at the lock text");
      assert.equal(await page.locator(`[id="${reextractLockId}"]`).innerText(), "Locked while a re-extract runs");
      await page.locator("[data-ltm-source-task-progress]").waitFor();
      // #1673: while a run holds the lock, Import stays focusable (aria-disabled, never `disabled`), points at the
      // visible lock text, and a press or click sends nothing.
      await page.locator('[data-ltm-source-tab="characters"]').click();
      await page.locator('[data-ltm-source-preview="characters"]').waitFor();
      const lockedImport = page.locator('[data-ltm-source-action="import"]:visible').first();
      assert.equal(await lockedImport.getAttribute("aria-disabled"), "true");
      assert.equal(await lockedImport.evaluate((button) => button.hasAttribute("disabled")), false);
      const lockedImportReasonId = await lockedImport.getAttribute("aria-describedby");
      assert.ok(lockedImportReasonId, "a locked Import points at the lock text");
      // The held run is a re-extract, so the shared reason says so.
      assert.equal(await page.locator(`[id="${lockedImportReasonId}"]`).innerText(), "Locked while a re-extract runs");
      await lockedImport.focus();
      assert.equal(await lockedImport.evaluate((button) => button === document.activeElement), true);
      const lockedImportWrites: string[] = [];
      const recordWrite = (request: { method(): string; url(): string }) => {
        if (request.method() !== "GET") lockedImportWrites.push(request.url());
      };
      page.on("request", recordWrite);
      await page.keyboard.press("Enter");
      await lockedImport.click({ force: true });
      await page.waitForTimeout(150);
      page.off("request", recordWrite);
      assert.deepEqual(lockedImportWrites, []);
      await page.locator('[data-ltm-source-tab="chats"]').click();
      // Re-extract waits on the same run: focusable, described by the reason, and silent on Enter. (The workbench
      // swaps Re-import and the row actions for the progress panel while a run is active, so the static guard
      // covers those.)
      await desktopReextract.focus();
      assert.equal(await desktopReextract.evaluate((button) => button === document.activeElement), true);
      const reextractRequestsBefore = reextractionRequests.length;
      lockedImportWrites.length = 0;
      page.on("request", recordWrite);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
      page.off("request", recordWrite);
      assert.deepEqual(lockedImportWrites, []);
      assert.equal(reextractionRequests.length, reextractRequestsBefore, "a locked Re-extract sends no second request");
      const desktopSourcesNavigation = page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="sources"]');
      assert.match(await desktopSourcesNavigation.innerText(), /Re-extracting\.\.\./u);
      assert.match(await page.locator("[data-ltm-source-task-progress]").innerText(), /Re-extracting 1/u);
      await page.locator('[data-ltm-navigation="desktop"] [data-ltm-destination="vault"]').click();
      await reextractionStarted;
      releaseReextraction?.();
      await page.waitForFunction(() =>
        document
          .querySelector('[data-ltm-navigation="desktop"] [data-ltm-destination="sources"]')
          ?.textContent?.includes("1 source failed"),
      );
      assert.match(await desktopSourcesNavigation.innerText(), /1 source failed/u);
      await desktopSourcesNavigation.click();
      await page.locator('[data-ltm-surface="sources"]').waitFor();
      await page.locator("[data-ltm-source-mode]").first().selectOption("game");
      const retryReextract = page.locator('[data-ltm-source-action="retry-re-extract"]');
      await retryReextract.waitFor();
      await retryReextract.click();
      await page.locator("[data-ltm-reextract-result]").waitFor();
      assert.match(await desktopSourcesNavigation.innerText(), /Completed 1/u);
      // Re-extract and its retry send the current availability modes (#1227);
      // the retry repeats the original selection even after the mode filter changes.
      assert.deepEqual(reextractionRequests, [
        {
          path: "/api/long-term-memory/notes/source_desktop_reextract/extract",
          body: { modes: ["conversation"] },
        },
        {
          path: "/api/long-term-memory/notes/source_desktop_reextract/extract",
          body: { modes: ["conversation"] },
        },
      ]);
      await page.locator('[data-ltm-source-tab="lorebooks"]').click();
      await page.locator('[data-ltm-source-preview="lorebooks"]').waitFor();
      await page.locator('[data-ltm-lorebook-id="lorebook_outside_current_chat"]').waitFor();
      const lorebookPreviewRequest = lorebookPreviewRequests.at(-1);
      assert.ok(lorebookPreviewRequest);
      assert.equal(Object.hasOwn(lorebookPreviewRequest, "sourceScope"), false);
      // soup/sources-review: the lorebook list is one column too, with no pane switcher.
      await page.locator('[data-ltm-surface="sources"] [data-ltm-source-column]').waitFor();
      assert.equal(await page.locator('[data-ltm-surface="sources"] [data-ltm-workspace]').count(), 0);
      if ((await destinationScope.getAttribute("open")) === null) {
        await destinationScope.locator("summary").click();
      }
      const destinationChipRemovers = destinationPanel.locator('button[aria-label^="Remove "]');
      while (await destinationChipRemovers.count()) await destinationChipRemovers.first().click();
      await destinationPanel.locator('[data-ltm-availability-tab="chat"]').click();
      await destinationShowMore.click();
      const wholeChatDestination = destinationPanel.locator('[data-ltm-availability-target="chat:conversation-a"]');
      await wholeChatDestination.click();
      assert.equal(await wholeChatDestination.getAttribute("aria-pressed"), "true");
      await page.locator('[data-ltm-lorebook-id="lorebook_mobile_fixture"]').click();
      assert.equal(await page.locator('[data-ltm-lorebook-workbench="lorebook_mobile_fixture"]').isVisible(), true);
      await page.locator('[data-ltm-lorebook-entry="entry_mobile_harbor"]').waitFor();
      assert.match(
        await page.locator('[data-ltm-lorebook-entry="entry_mobile_harbor"]').innerText(),
        /blue lantern marks the safe channel/u,
      );
      // #1659: counts read as whole sentences; one entry is "1 entry", and no fragment like "entries ·" is left.
      const lorebookDetailText = await page
        .locator('[data-ltm-lorebook-workbench="lorebook_mobile_fixture"] header')
        .first()
        .innerText();
      assert.match(lorebookDetailText, /\b1 entry\b/u);
      assert.doesNotMatch(lorebookDetailText, /1 entries|entries ·/u);
      assert.match(await page.locator('[data-ltm-lorebook-id="lorebook_mobile_fixture"]').innerText(), /\b1 entry\b/u);
      // soup/sources-navigator: the lorebook navigator is the same bar as the flat list.
      for (const control of [
        "[data-ltm-source-search]",
        "[data-ltm-source-mode]",
        '[data-ltm-source-action="refresh-preview"]',
        '[data-ltm-source-status-filter="ready"]',
      ])
        assert.equal(
          await page.locator("[data-ltm-lorebook-browser]").locator(control).count(),
          1,
          `the lorebook bar holds ${control}`,
        );
      await page.locator("[data-ltm-lorebook-browser]").getByRole("button", { name: "Select", exact: true }).click();
      await page.locator('[data-ltm-lorebook-entry-select="entry_mobile_harbor"]').check();
      // #1588: the label around an entry checkbox is a 44px target.
      assert.equal(
        await touchTargetSize(page.locator('label:has([data-ltm-lorebook-entry-select="entry_mobile_harbor"])')),
        "fits",
      );
      await page.locator('[data-ltm-lorebook-id="lorebook_outside_current_chat"]').click();
      await page.locator('[data-ltm-lorebook-entry-select="entry_outside_current_chat"]').check();
      await page.locator('[data-ltm-source-tab="chats"]').click();
      assert.match(await page.locator("[data-ltm-confirm-dialog]").innerText(), /2/u);
      await page.locator("[data-ltm-confirm-cancel]").click();
      await page.locator("[data-ltm-confirm-dialog]").waitFor({ state: "detached" });
      assert.equal(await page.locator('[data-ltm-source-tab="lorebooks"]').getAttribute("aria-selected"), "true");
      const persistedImportRequest = page.waitForRequest(
        (request) => request.method() === "POST" && request.url().includes("/api/long-term-memory/import/source-notes"),
      );
      await page.locator('[data-ltm-lorebook-action="import-selected"]').click();
      const persistedImport = (await persistedImportRequest).postDataJSON() as { destinationScope?: unknown };
      // A whole chat imports as the chat and every branch in it.
      assert.deepEqual(persistedImport.destinationScope, {
        chatId: "memory-chat",
        chatIds: ["memory-chat", "memory-conversation-branch"],
        groupId: "conversation-a",
        groupIds: ["conversation-a"],
      });
      const liveImportResult = page.locator("[data-ltm-source-import-result]");
      await liveImportResult.waitFor();
      // soup/sources-result: the outcome line comes first, a result that needs attention keeps its Details open,
      // and without proposed memories there is no Open Review.
      {
        const outcome = liveImportResult.locator("[data-ltm-import-result-outcome]");
        assert.notEqual(((await outcome.textContent()) ?? "").trim(), "");
        const details = liveImportResult.locator("[data-ltm-import-result-details]");
        assert.equal(await details.getAttribute("open"), "", "a failed import opens its Details");
        assert.equal(await details.locator("[data-ltm-import-scope-result]").isVisible(), true);
        assert.equal(await liveImportResult.locator('[data-ltm-source-action="review-imported-drafts"]').count(), 0);
        assert.equal(
          await liveImportResult.evaluate((panel) => {
            const outcomeNode = panel.querySelector("[data-ltm-import-result-outcome]");
            const detailsNode = panel.querySelector("[data-ltm-import-result-details]");
            return Boolean(
              outcomeNode &&
              detailsNode &&
              outcomeNode.compareDocumentPosition(detailsNode) & Node.DOCUMENT_POSITION_FOLLOWING,
            );
          }),
          true,
          "the outcome precedes the details",
        );
      }
      assert.equal(
        await liveImportResult.evaluate((element) => Boolean(element.closest("[data-ltm-source-column]"))),
        true,
      );

      await page.reload();
      await page.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "detail");
        element.capabilityProps = { agent: { name: "Long-Term Memory" }, package: { version } };
        document.body.append(element);
      }, packageManifest.version);
      await page.locator('[data-ltm-surface="detail"]').waitFor();
      await page.locator('[data-ltm-control="navigation"][data-ltm-destination="sources"]').first().click();
      // #1588: the last task shows its batch outcome as a label, not the raw task state.
      assert.match(await page.locator("[data-ltm-latest-source-task]").innerText(), / · Failed$/u);
      await page.locator("[data-ltm-latest-source-task]").click();
      const restoredSourceResult = page.locator('[data-ltm-safe-source-task-result="completed"]');
      await restoredSourceResult.waitFor();
      assert.match(
        await restoredSourceResult.innerText(),
        /lorebook_outside_current_chat:entry_outside_current_chat:0/u,
      );
      assert.equal(
        await restoredSourceResult.evaluate((element) => Boolean(element.closest("[data-ltm-source-column]"))),
        true,
      );
      await restoredSourceResult.getByRole("button", { name: "Back to preview" }).click();
      assert.equal(await restoredSourceResult.count(), 0);

      // While availability settings load, an imported row's Re-extract stays focusable, says why it waits, and a
      // press sends nothing.
      {
        let releaseSettings = () => {};
        const settingsGate = new Promise<void>((resolve) => {
          releaseSettings = resolve;
        });
        const settingsRoute = "**/api/long-term-memory/settings";
        await page.route(settingsRoute, async (route) => {
          if (route.request().method() === "GET") await settingsGate;
          // The reload at the end of the case can settle a held request first.
          await route.continue().catch(() => {});
        });
        try {
          await page.reload();
          await page.evaluate((version) => {
            const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
              capabilityProps?: unknown;
            };
            element.setAttribute("view", "detail");
            element.capabilityProps = { agent: { name: "Long-Term Memory" }, package: { version } };
            document.body.append(element);
          }, packageManifest.version);
          await page.locator('[data-ltm-surface="detail"]').waitFor();
          await page.locator('[data-ltm-control="navigation"][data-ltm-destination="sources"]').first().click();
          await page.locator('[data-ltm-source-tab="chats"]').click();
          await page.locator('[data-ltm-source-status-filter="imported"]').click();
          await page.locator('[data-ltm-source-open="chat-a:summary-desktop-reextract"]').click();
          const waitingReextract = page.locator('[data-ltm-source-inspector-action="re-extract"]');
          await waitingReextract.waitFor();
          assert.equal(await waitingReextract.getAttribute("aria-disabled"), "true");
          assert.equal(await waitingReextract.getAttribute("disabled"), null);
          const waitingReasonId = await waitingReextract.getAttribute("aria-describedby");
          assert.ok(waitingReasonId, "a waiting Re-extract points at the reason");
          assert.match(await page.locator(`[id="${waitingReasonId}"]`).innerText(), /Loading availability settings/u);
          await waitingReextract.focus();
          assert.equal(await waitingReextract.evaluate((button) => button === document.activeElement), true);
          const waitingWrites: string[] = [];
          const recordWaitingWrite = (request: { method(): string; url(): string }) => {
            if (request.method() !== "GET") waitingWrites.push(request.url());
          };
          page.on("request", recordWaitingWrite);
          await page.keyboard.press("Enter");
          await page.waitForTimeout(150);
          page.off("request", recordWaitingWrite);
          assert.deepEqual(waitingWrites, []);
        } finally {
          releaseSettings();
          await page.unroute(settingsRoute);
        }
      }

      const mobileContext = await browser.newContext({
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
      });
      const mobilePage = await mobileContext.newPage();
      await mobilePage.exposeFunction("onMobileActivationChange", () => {});
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
      // The Engine header's Active switch is the one per-chat on/off; the package draws no second control.
      const activation = mobilePage.locator('[data-ltm-control="activation"]');
      const activationChip = mobilePage.locator('[data-ltm-surface="activation-chip"]');
      assert.equal(await activation.count(), 0);
      assert.equal(await activationChip.count(), 0);
      assert.ok(
        (await mobilePage.locator(".mari-editor-header").evaluate((header) => {
          const [main, actions] = [...header.children].map((child) => child.getBoundingClientRect());
          return Math.abs(main.top + main.height / 2 - (actions.top + actions.height / 2));
        })) <= 1,
      );
      assert.equal(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      // soup/shell-activation: "Add memories" stays on every tab, including Review and Sources.
      for (const destination of ["review", "sources", "vault"]) {
        await mobilePage.locator(`[data-ltm-navigation="mobile"] [data-ltm-destination="${destination}"]`).click();
        assert.equal(
          await mobilePage.locator('[aria-label="Add memories"]').isVisible(),
          true,
          `Add memories shows on ${destination}`,
        );
      }
      // soup/shell-activation: "Create manually" from Review opens the Vault editor.
      await mobilePage.locator('[data-ltm-navigation="mobile"] [data-ltm-destination="review"]').click();
      await mobilePage.locator('[aria-label="Add memories"]').click();
      await mobilePage.getByRole("button", { name: /Create manually/u }).click();
      await mobilePage
        .locator('[data-ltm-navigation="mobile"] [data-ltm-destination="vault"][aria-current="page"]')
        .waitFor();
      // Each tab says what it holds.
      assert.deepEqual(
        await mobilePage
          .locator('[data-ltm-navigation="mobile"] [data-ltm-control="navigation"]')
          .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("title"))),
        [
          "Saved memories",
          "Proposals waiting for your OK",
          "Import from chats, lorebooks, characters",
          "What memory did and why",
          "Recall and extraction options",
        ],
      );
      // Chat Settings pending keeps keyboard focus too: committing one field on blur starts the save while
      // the next field is already focused, and that field must stay focused, named and read-only.
      const chatSettingChanges: unknown[] = [];
      let releaseChatSettings = () => {};
      const chatSettingsHeld = new Promise<void>((resolve) => {
        releaseChatSettings = resolve;
      });
      await mobilePage.exposeFunction("onMobileChatSettingsChange", async (patch: unknown) => {
        chatSettingChanges.push(patch);
        await chatSettingsHeld;
      });
      await mobilePage.evaluate((version) => {
        const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
          capabilityProps?: unknown;
        };
        element.setAttribute("view", "settings");
        element.capabilityProps = {
          chatId: "chat-artifact",
          onChatSettingsChange: (
            window as Window & {
              onMobileChatSettingsChange: (patch: unknown) => Promise<void>;
            }
          ).onMobileChatSettingsChange,
          package: { version },
        };
        document.body.append(element);
      }, packageManifest.version);
      const heldChatSettings = mobilePage.locator('[data-ltm-surface="chat-settings"]');
      await heldChatSettings.waitFor();
      const heldStyle = heldChatSettings.getByLabel("Recall style", { exact: true });
      const heldBudget = heldChatSettings.getByRole("spinbutton", { name: "Memory budget" });
      const isFocused = (target: typeof heldBudget) => target.evaluate((element) => element === document.activeElement);
      await heldBudget.fill("256");
      // Moving focus to the Recall style select commits the budget on blur and starts the save.
      await heldStyle.focus();
      await mobilePage.waitForFunction(() =>
        [...document.querySelectorAll('[data-ltm-surface="chat-settings"] input[type="number"]')].every(
          (input) => input.getAttribute("aria-disabled") === "true",
        ),
      );
      assert.deepEqual(chatSettingChanges, [{ longTermMemoryBudgetTokens: 256 }]);
      assert.equal(await isFocused(heldStyle), true);
      // The number field stays focusable and named while the save is in flight, but typing changes nothing.
      await heldBudget.focus();
      assert.equal(await heldBudget.evaluate((input) => input.matches(":disabled")), false);
      assert.equal(await isFocused(heldBudget), true);
      const heldBudgetValue = await heldBudget.inputValue();
      await mobilePage.keyboard.type("5");
      assert.equal(await heldBudget.inputValue(), heldBudgetValue);
      // An ignored change on the aria-disabled select snaps the controlled value back and starts no second save.
      assert.equal(await heldStyle.getAttribute("aria-disabled"), "true");
      assert.equal(await heldStyle.evaluate((select) => select.matches(":disabled")), false);
      await heldStyle.evaluate((select: HTMLSelectElement) => {
        select.value = "exact";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await mobilePage.waitForTimeout(150);
      assert.equal(await heldStyle.inputValue(), "balanced");
      assert.equal(chatSettingChanges.length, 1);
      releaseChatSettings();
      await mobilePage.waitForFunction(() =>
        [...document.querySelectorAll('[data-ltm-surface="chat-settings"] input[type="number"], select')].every(
          (control) => control.getAttribute("aria-disabled") === null,
        ),
      );
      assert.equal(await isFocused(heldBudget), true);
      assert.equal(chatSettingChanges.length, 1);
      await mobilePage.evaluate(() =>
        document.querySelectorAll("marinara-capability-long-term-memory").item(1)?.remove(),
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
          document.querySelector('[data-ltm-surface="activation-chip"]')?.getAttribute("data-ltm-activation") ===
          "no-chat",
      );
      assert.equal((await activationChip.textContent())?.trim(), "No chat open");
      assert.equal(await activationChip.getAttribute("aria-label"), "No chat open");
      assert.equal(await activation.count(), 0, "no chat, no button");
      // soup/ltm-frame: with no chat open the state is a chip in the header, not a panel in the body.
      assert.equal(
        await activationChip.evaluate((chip) => chip.closest(".mari-editor-header") !== null),
        true,
        "No chat open shows in the header",
      );
      const mobileNavigation = mobilePage.locator('[data-ltm-navigation="mobile"]');
      const mobileNavigationItems = mobileNavigation.locator('[data-ltm-control="navigation"]');
      assert.equal(await mobileNavigationItems.count(), 5);
      for (const destination of ["vault", "review", "sources", "activity", "settings"])
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
      assert.equal(mobileNavigationLayout.columns, 5);
      assert.equal(mobileNavigationLayout.hasSize, true);
      assert.equal(mobileNavigationLayout.fits, true);
      assert.equal(mobileNavigationLayout.touchTargets, true);
      assert.equal(mobileNavigationLayout.oneRow, true);
      // soup/setup-beats: on a phone every setup answer is a 44px touch target and the dialog fits the width.
      await mobilePage.locator("[data-ltm-onboarding-help]").click();
      await mobilePage.locator("[data-ltm-help-setup]").click();
      await mobilePage.locator("[data-ltm-setup-answers]").waitFor();
      assert.ok(
        await mobilePage
          .locator('[data-ltm-surface="onboarding"] [data-ltm-control="button"]')
          .evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 44)),
      );
      assert.equal(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      await mobilePage.locator("[data-ltm-setup-close]").click();
      await mobilePage.locator('[data-ltm-surface="onboarding"]').waitFor({ state: "detached" });
      await mobileNavigation.locator('[data-ltm-destination="sources"]').click();
      await mobilePage.locator('[data-ltm-surface="sources"]').waitFor();
      await mobilePage.locator('[data-ltm-source-tab="lorebooks"]').evaluate((tab) => (tab as HTMLElement).click());
      await mobilePage.locator('[data-ltm-lorebook-id="lorebook_mobile_fixture"]').click();
      // soup/sources-review: on a phone Sources is one column: the lorebook opens under its row, with no pane
      // switcher, and its entries and Import bar are right there.
      assert.equal(await mobilePage.locator('[data-ltm-surface="sources"] [data-ltm-workspace]').count(), 0);
      assert.equal(await mobilePage.locator("[data-ltm-workspace-pane-tab]").count(), 0);
      await mobilePage.locator('[data-ltm-lorebook-entry="entry_mobile_harbor"]').waitFor();
      assert.equal(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      const lorebookWorkbench = mobilePage.locator('[data-ltm-lorebook-workbench="lorebook_mobile_fixture"]');
      await dockDetailPanel(mobilePage, "");
      await lorebookWorkbench.locator("[data-ltm-source-primary-actions]").waitFor();
      assert.equal(
        await mobilePage
          .locator('[data-ltm-lorebook-id="lorebook_mobile_fixture"]')
          .evaluate((row) => row.compareDocumentPosition(document.querySelector("[data-ltm-lorebook-workbench]")!) & 4),
        4,
        "the open lorebook sits after its row",
      );
      // #1588: the lorebook's Import bar stays pinned to the top while its entries scroll.
      assert.equal(
        await stickyBarInView(lorebookWorkbench.locator("[data-ltm-source-primary-actions]"), "bottom"),
        "in view",
      );
      if (visualOutputDir)
        await mobilePage.screenshot({ path: join(visualOutputDir, "long-term-memory-lorebook-bar-mobile.png") });
      await dockDetailPanel(mobilePage, null);
      await mobileNavigation.locator('[data-ltm-destination="settings"]').click();
      await mobilePage.locator("#settings-tab-extraction").click();
      const mobileExtractionLayout = await mobilePage
        .locator("#settings-panel-extraction > [data-ltm-extraction-grid]")
        .evaluate((grid) => {
          const panel = document.querySelector("#settings-panel-extraction")!;
          const fields = [
            panel.querySelector("[data-ltm-chat-memories-field]"),
            panel.querySelector("[data-ltm-connection-field]"),
          ] as HTMLElement[];
          const labels = fields.map((field) => field.firstElementChild as HTMLElement);
          const selects = fields.map((field) => field.querySelector("select")!);
          return {
            columns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/u).length,
            labelGaps: fields.map(
              (field, index) =>
                field.querySelector("select")!.getBoundingClientRect().top -
                labels[index]!.getBoundingClientRect().bottom,
            ),
            selectWidths: selects.map((select) => select.getBoundingClientRect().width),
            fieldWidths: fields.map((field) => field.getBoundingClientRect().width),
          };
        });
      assert.equal(mobileExtractionLayout.columns, 1);
      assert.ok(
        mobileExtractionLayout.labelGaps.every((gap) => gap >= 0 && gap <= 8),
        `each name sits directly above its picker (${mobileExtractionLayout.labelGaps.join(", ")}px)`,
      );
      assert.deepEqual(mobileExtractionLayout.selectWidths, mobileExtractionLayout.fieldWidths);
      const mobileDebugPage = await openDebugActivity(mobileContext, "mobile");
      await mobileDebugPage.close();
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
      await mobilePage.locator("[data-ltm-onboarding-help]").click();
      await mobilePage.locator("[data-ltm-help-setup]").click();
      await mobilePage.evaluate(() => {
        document.documentElement.style.fontSize = "20px";
      });
      assert.deepEqual(
        await mobilePage.locator('[data-ltm-surface="onboarding"]').evaluate((onboarding) => {
          const title = onboarding.querySelector<HTMLElement>("h2")!;
          const talk = onboarding.querySelector<HTMLElement>("[data-ltm-setup-talk]")!;
          return {
            titleFits: title.scrollWidth <= title.clientWidth,
            talkFits: talk.scrollWidth <= talk.clientWidth,
            pageFits:
              onboarding.scrollWidth <= onboarding.clientWidth &&
              document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          };
        }),
        { titleFits: true, talkFits: true, pageFits: true },
      );
      assert.equal(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
      );
      await mobilePage.evaluate(() => {
        document.documentElement.style.fontSize = "";
      });
      await mobilePage.locator("[data-ltm-setup-close]").click();
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
      // soup/setup-beats: a fresh install never opens setup on its own; the empty Vault offers it in place of
      // New memory, and the first beat is Hello.
      const firstRunGuide = firstRunPage.locator('[data-ltm-surface="onboarding"]');
      const firstRunBeat = (beat: number) =>
        firstRunPage.locator(`[data-ltm-surface="onboarding"][data-ltm-setup-beat="${beat}"]`);
      const firstRunSetup = firstRunPage.locator("[data-ltm-vault-setup-open]");
      await firstRunSetup.waitFor();
      assert.equal(await firstRunGuide.count(), 0);
      assert.equal(await firstRunSetup.innerText(), "Set up memory");
      assert.equal(await firstRunPage.getByRole("button", { name: "New memory" }).count(), 0);
      await firstRunSetup.click();
      await firstRunBeat(1).waitFor();
      // With no chat open, Hello offers only "Pick one later".
      await firstRunPage.locator('[data-ltm-setup-choice="pick-later"]').click();
      await firstRunBeat(2).waitFor();
      // #1980: a new setup starts on "Save them for me", and Next keeps it.
      const firstRunChoice = firstRunPage.locator('[data-ltm-setup-choice="save"][aria-pressed="true"]');
      await firstRunChoice.waitFor({ timeout: 5_000 });
      const firstRunSample = firstRunGuide.locator('[data-ltm-chat-memories-sample="save"]');
      assert.equal(await firstRunSample.count(), 1);
      assert.match(
        (await firstRunSample.innerText()).replace(/\s+/gu, " "),
        /^after a reply 2 saved · 1 waits for you$/iu,
      );
      const writesBeforeGuide = extractionWrites.length;
      await firstRunPage.locator("[data-ltm-setup-next]").click();
      await firstRunBeat(3).waitFor();
      assert.deepEqual(extractionWrites.slice(writesBeforeGuide), [
        { autoImportChatSources: true, autoAcceptSafeChanges: true },
      ]);
      // Later keeps the beat, and the Vault's button resumes it with the answered count.
      await firstRunPage.locator("[data-ltm-setup-close]").click();
      await firstRunGuide.waitFor({ state: "detached" });
      assert.equal(
        await firstRunPage.evaluate(() => localStorage.getItem("marinara-long-term-memory-onboarding-v1")),
        "beat:3",
      );
      await firstRunSetup.filter({ hasText: "Resume setup" }).waitFor();
      assert.equal(
        await firstRunPage.locator("[data-ltm-vault-setup-ticks]").getAttribute("aria-label"),
        "2 of 4 answered",
      );
      noteTotal = 0;
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
      await firstRunSetup.click();
      await firstRunBeat(3).waitFor();
      await firstRunPage.locator('[data-ltm-setup-choice="start-fresh"]').click();
      await firstRunBeat(4).waitFor();
      assert.equal(
        await firstRunPage.evaluate(() => localStorage.getItem("marinara-long-term-memory-onboarding-v1")),
        "done",
      );
      // Done opens the Vault, which offers New memory again.
      await firstRunPage.locator("[data-ltm-setup-open-vault]").click();
      await firstRunGuide.waitFor({ state: "detached" });
      await firstRunPage.getByRole("button", { name: "New memory" }).waitFor();
      assert.equal(await firstRunSetup.count(), 0);
      await firstRunContext.close();
      // #1611: a failed first status read shows one Retry and no "Status unavailable" pill, and leaves the guide
      // closed and unsaved because the vault count is unknown; Retry recovers to a populated vault without the guide.
      statusFailure = true;
      noteTotal = 0;
      const statusFailContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const statusFailPage = await statusFailContext.newPage();
      await statusFailPage.goto(`http://127.0.0.1:${address.port}/`);
      await statusFailPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
      await statusFailPage.evaluate((version) => {
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
      const statusError = statusFailPage.locator("[data-ltm-status-error]");
      await statusError.waitFor();
      assert.equal(await statusFailPage.locator('[data-ltm-surface="onboarding"]').count(), 0);
      assert.equal(
        await statusFailPage.evaluate(() => localStorage.getItem("marinara-long-term-memory-onboarding-v1")),
        null,
      );
      assert.equal(await statusFailPage.locator('[data-ltm-surface="vault-health-pill"]').count(), 0);
      assert.equal(await statusFailPage.getByRole("button", { name: "Retry" }).count(), 1);
      statusFailure = false;
      noteTotal = 5;
      await statusError.getByRole("button", { name: "Retry" }).click();
      await statusError.waitFor({ state: "detached" });
      assert.equal(await statusFailPage.locator('[data-ltm-surface="onboarding"]').count(), 0);
      assert.equal(
        await statusFailPage.evaluate(() => localStorage.getItem("marinara-long-term-memory-onboarding-v1")),
        null,
      );
      await statusFailContext.close();
      noteTotal = 3;
      // The one-time "What's new in 1.6" dialog: with setup done and the seen flag absent it opens by itself, Mari's
      // animation reaches the last frame and replays on click, every close writes the flag, the Help menu reopens it, and
      // an action row closes it and lands on its page.
      const whatsNewKey = "marinara-long-term-memory-whats-new-v1";
      const whatsNewContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await whatsNewContext.addInitScript(() =>
        localStorage.setItem("marinara-long-term-memory-onboarding-v1", "done"),
      );
      // One named connection so the scope line can show "name · model"; the others fall back to the model or to the count.
      await whatsNewContext.route("**/api/connections", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "conn-link", name: "Fictional Link", provider: "openai", model: "fictional-model-2" },
          ]),
        }),
      );
      const whatsNewPage = await whatsNewContext.newPage();
      const tidyScopeLine = () => whatsNewPage.locator("[data-ltm-tidy-scope]");
      const mountWhatsNew = async () => {
        await whatsNewPage.goto(`http://127.0.0.1:${address.port}/`);
        await whatsNewPage.evaluate(() => customElements.whenDefined("marinara-capability-long-term-memory"));
        await whatsNewPage.evaluate((version) => {
          const element = document.createElement("marinara-capability-long-term-memory") as HTMLElement & {
            capabilityProps?: unknown;
          };
          element.setAttribute("view", "detail");
          element.capabilityProps = { agent: { name: "Long-Term Memory" }, package: { version } };
          document.body.append(element);
        }, packageManifest.version);
      };
      const whatsNewDialog = whatsNewPage.locator("[data-ltm-whats-new]");
      const whatsNewReplay = whatsNewPage.locator("[data-ltm-whats-new-replay]");
      const whatsNewFrame = async () => Number(await whatsNewReplay.getAttribute("data-ltm-whats-new-frame"));
      await mountWhatsNew();
      await whatsNewDialog.waitFor();
      assert.equal(await whatsNewPage.evaluate((key) => localStorage.getItem(key), whatsNewKey), null);
      await whatsNewPage.waitForFunction(
        () => document.querySelector("[data-ltm-whats-new-replay]")?.getAttribute("data-ltm-whats-new-frame") === "11",
        undefined,
        { timeout: 10_000 },
      );
      assert.equal(await whatsNewPage.locator("[data-ltm-whats-new-change]").count(), 6);
      assert.equal(await whatsNewPage.locator("[data-ltm-whats-new-action]").count(), 2);
      assert.equal(
        await whatsNewPage.locator("[data-ltm-whats-new-ai]").count(),
        3,
        "Tidy, Link and People are AI rows",
      );
      assert.equal(await whatsNewPage.locator('[data-ltm-whats-new-action="vault"]').count(), 0);
      assert.equal(
        (await whatsNewPage.locator("[data-ltm-whats-new-hint]").innerText()).trim(),
        "You can open this again from the ? button.",
      );
      assert.equal(
        await whatsNewPage.evaluate(() => document.activeElement?.hasAttribute("data-ltm-whats-new-close")),
        true,
      );
      const whatsNewMore = whatsNewPage.locator("[data-ltm-whats-new-more]");
      assert.equal(await whatsNewMore.locator("li").first().isVisible(), false, "the long list starts closed");
      await whatsNewMore.locator("summary").click();
      assert.equal(await whatsNewMore.locator("li").count(), 9);
      assert.equal(await whatsNewMore.locator("li").last().isVisible(), true);
      assert.equal(/whatsnew\.more/.test(await whatsNewMore.innerText()), false, "every line is translated");
      await whatsNewMore.locator("summary").click();
      await whatsNewReplay.click();
      assert.ok((await whatsNewFrame()) < 11, "Clicking Mari must replay the animation");
      await whatsNewPage.waitForFunction(
        () => document.querySelector("[data-ltm-whats-new-replay]")?.getAttribute("data-ltm-whats-new-frame") === "11",
        undefined,
        { timeout: 10_000 },
      );
      // 1280x900 shot of the finished dialog, when the caller asks for one.
      if (process.env.WHATS_NEW_SHOT_DIR) {
        await whatsNewPage.screenshot({ path: join(process.env.WHATS_NEW_SHOT_DIR, "whats-new-1280.png") });
        await whatsNewPage.setViewportSize({ width: 390, height: 844 });
        await whatsNewPage.screenshot({ path: join(process.env.WHATS_NEW_SHOT_DIR, "whats-new-390.png") });
        await whatsNewPage.setViewportSize({ width: 1280, height: 900 });
      }
      await whatsNewPage.locator("[data-ltm-whats-new-close]").click();
      await whatsNewDialog.waitFor({ state: "detached" });
      assert.equal(await whatsNewPage.evaluate((key) => localStorage.getItem(key), whatsNewKey), "1.6");
      await mountWhatsNew();
      await whatsNewPage.locator('[data-ltm-surface="detail"]').waitFor();
      assert.equal(await whatsNewDialog.count(), 0, "A seen dialog must not open again by itself");
      // The Help menu reopens it, and closing it returns focus to the Help button.
      await whatsNewPage.locator("[data-ltm-onboarding-help]").click();
      await whatsNewPage.locator("[data-ltm-help-whats-new]").click();
      await whatsNewDialog.waitFor();
      await whatsNewPage.locator("[data-ltm-whats-new-close]").click();
      await whatsNewDialog.waitFor({ state: "detached" });
      await whatsNewPage.waitForFunction(() => document.activeElement?.hasAttribute("data-ltm-onboarding-help"));
      // An action row closes the dialog and lands on its page.
      await whatsNewPage.locator("[data-ltm-onboarding-help]").click();
      await whatsNewPage.locator("[data-ltm-help-whats-new]").click();
      await whatsNewDialog.waitFor();
      await whatsNewPage.locator('[data-ltm-whats-new-action="sources"]').click();
      await whatsNewDialog.waitFor({ state: "detached" });
      await whatsNewPage.locator('[data-ltm-surface="sources"]').waitFor();
      // A phone-width dialog has no sideways scroll.
      await whatsNewPage.setViewportSize({ width: 390, height: 844 });
      await whatsNewPage.locator("[data-ltm-onboarding-help]").click();
      await whatsNewPage.locator("[data-ltm-help-whats-new]").click();
      await whatsNewDialog.waitFor();
      assert.equal(
        await whatsNewPage.evaluate(() => {
          const panel = document.querySelector<HTMLElement>("[data-ltm-whats-new]")!;
          return (
            document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
            panel.scrollWidth <= panel.clientWidth
          );
        }),
        true,
      );
      // Tidy with AI lives inside the dialog: nothing is sent before Start, the results list the suggestions with every
      // archive entry ticked, only the ticked ids are applied, and a failed read shows the server's message.
      const tidyShot = async (state: string) => {
        if (!process.env.WHATS_NEW_SHOT_DIR) return;
        const shotDir = process.env.WHATS_NEW_SHOT_DIR;
        await whatsNewPage.screenshot({ path: join(shotDir, `tidy-${state}-390.png`) });
        await whatsNewPage.setViewportSize({ width: 1280, height: 900 });
        await whatsNewPage.screenshot({ path: join(shotDir, `tidy-${state}-1280.png`) });
        await whatsNewPage.setViewportSize({ width: 390, height: 844 });
      };
      const tidyState = (state: string) => whatsNewPage.locator(`[data-ltm-tidy-state="${state}"]`);
      const tidyFocused = (selector: string) =>
        whatsNewPage.evaluate((value) => document.activeElement?.matches(value) ?? false, selector);
      tidyPreviewReply = {
        status: 200,
        body: {
          total: 12,
          checked: 9,
          truncated: true,
          next: "tidy-cursor-12",
          failedChunks: 0,
          suggestions: [
            {
              reason: "duplicate",
              keep: { id: "tidy-keep-1", title: "Ilse leaves the lighthouse" },
              archive: [
                { id: "tidy-dup-1", title: "Ilse left the lighthouse" },
                { id: "tidy-dup-2", title: "Ilse walks away from the lighthouse" },
              ],
            },
            { reason: "placeholder", keep: null, archive: [{ id: "tidy-empty-1", title: "Untitled memory" }] },
          ],
        },
      };
      tidyPreviewRequests = 0;
      // A connection the list does not hold falls back to the model name.
      tidyScopeReply = { status: 200, body: { count: 9, connectionId: "conn-missing", model: "fictional-model-1" } };
      await whatsNewPage.locator("[data-ltm-whats-new-tidy]").click();
      await tidyState("confirm").waitFor();
      await tidyScopeLine().getByText("Uses fictional-model-1. Checks 9 memories.", { exact: true }).waitFor();
      assert.equal(tidyPreviewRequests, 0, "Reading the scope sends nothing to the model");
      assert.equal(await whatsNewPage.locator("[data-ltm-whats-new-change]").count(), 0);
      assert.equal(await whatsNewPage.locator("[data-ltm-whats-new-action]").count(), 0);
      assert.equal(await tidyFocused("[data-ltm-tidy-start]"), true, "Confirm takes focus on Start");
      assert.equal(tidyPreviewRequests, 0, "Nothing is sent before Start");
      await tidyShot("confirm");
      // Cancel while the model reads aborts the request and returns to the confirm view.
      let releaseTidyPreview!: () => void;
      holdTidyPreview = new Promise<void>((resolveHold) => (releaseTidyPreview = resolveHold));
      await whatsNewPage.locator("[data-ltm-tidy-start]").click();
      await tidyState("checking").waitFor();
      assert.equal(await tidyFocused("[data-ltm-tidy-cancel]"), true, "Checking takes focus on Cancel");
      assert.equal(await whatsNewPage.locator('[data-ltm-tidy-state="checking"] [aria-live="polite"]').count(), 1);
      await whatsNewPage.locator("[data-ltm-tidy-cancel]").click();
      await tidyState("confirm").waitFor();
      releaseTidyPreview();
      holdTidyPreview = null;
      await whatsNewPage.waitForTimeout(150);
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-state]").getAttribute("data-ltm-tidy-state"), "confirm");
      // Start shows the suggestions, every archive entry ticked.
      await whatsNewPage.locator("[data-ltm-tidy-start]").click();
      await tidyState("results").waitFor();
      assert.equal(tidyPreviewRequests, 2);
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-suggestion]").count(), 2);
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-item]").count(), 3);
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-item]:checked").count(), 3);
      assert.equal(await tidyFocused("[data-ltm-tidy-item]"), true, "Results take focus on the first memory");
      const tidyText = (await tidyState("results").innerText()).replace(/\s+/gu, " ");
      assert.ok(tidyText.includes("Repeat") && tidyText.includes("Empty"));
      assert.ok(tidyText.includes("Keeps: Ilse leaves the lighthouse"));
      assert.ok(tidyText.includes("Checked 9 of 12 memories."));
      assert.equal(
        await whatsNewPage.locator('[data-ltm-tidy-suggestion="placeholder"]').getByText("Keeps:").count(),
        0,
        "A placeholder has no memory to keep",
      );
      const tidyApply = whatsNewPage.locator("[data-ltm-tidy-apply]");
      assert.equal((await tidyApply.innerText()).trim(), "Archive 3 memories");
      const noOverflow = () =>
        whatsNewPage.evaluate(() => {
          const panel = document.querySelector<HTMLElement>("[data-ltm-whats-new]")!;
          const section = panel.querySelector<HTMLElement>("section")!.getBoundingClientRect();
          return (
            document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
            panel.scrollWidth <= panel.clientWidth &&
            section.bottom <= window.innerHeight
          );
        });
      assert.equal(await noOverflow(), true, "The results view fits a 390x844 viewport");
      await tidyShot("results");
      await whatsNewPage.locator('[data-ltm-tidy-item="tidy-dup-2"]').uncheck();
      assert.equal((await tidyApply.innerText()).trim(), "Archive 2 memories");
      await tidyApply.click();
      await tidyState("done").waitFor();
      assert.deepEqual(tidyApplyBodies, [{ noteIds: ["tidy-dup-1", "tidy-empty-1"] }]);
      const doneText = await tidyState("done").innerText();
      assert.ok(doneText.includes("2 memories archived."));
      assert.ok(doneText.includes("set Show to Archived"));
      assert.equal(
        await whatsNewPage.locator("[data-ltm-tidy-next]").count(),
        1,
        "The done view offers the next batch",
      );
      assert.equal(await tidyFocused("[data-ltm-tidy-focus]"), true);
      await tidyShot("done");
      await whatsNewPage.locator("[data-ltm-tidy-focus]").click();
      await whatsNewDialog.locator("[data-ltm-whats-new-tidy]").waitFor();
      assert.equal(await tidyFocused("[data-ltm-whats-new-tidy]"), true, "Back returns focus to the Tidy row");
      // A cut-short check offers the next batch: it asks from the cursor, a failure retries that batch, and the last batch has no button.
      await whatsNewPage.locator("[data-ltm-whats-new-tidy]").click();
      await whatsNewPage.locator("[data-ltm-tidy-start]").click();
      await tidyState("results").waitFor();
      assert.ok(!(tidyPreviewBodies.at(-1) ?? "").includes("after"), "The first batch sends no cursor");
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-next]").count(), 1);
      const firstBatchReply = tidyPreviewReply;
      tidyPreviewReply = { status: 400, body: { error: "Model unavailable.", code: "ltm_model_configuration" } };
      await whatsNewPage.locator("[data-ltm-tidy-next]").click();
      await tidyState("error").waitFor();
      assert.deepEqual(JSON.parse(tidyPreviewBodies.at(-1) ?? ""), { after: "tidy-cursor-12" });
      tidyPreviewReply = {
        status: 200,
        body: {
          total: 12,
          checked: 3,
          truncated: false,
          next: null,
          failedChunks: 1,
          suggestions: [
            { reason: "placeholder", keep: null, archive: [{ id: "tidy-empty-2", title: "Untitled memory" }] },
          ],
        },
      };
      await whatsNewPage.getByRole("button", { name: "Try again" }).click();
      await tidyState("results").waitFor();
      assert.deepEqual(
        JSON.parse(tidyPreviewBodies.at(-1) ?? ""),
        { after: "tidy-cursor-12" },
        "Try again re-reads the same batch",
      );
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-item]").count(), 1, "The next batch replaces the first");
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-next]").count(), 0, "The last batch has no next button");
      tidyPreviewReply = firstBatchReply;
      await whatsNewPage.locator("[data-ltm-tidy-back]").click();
      await whatsNewDialog.locator("[data-ltm-whats-new-tidy]").waitFor();
      // After Apply the done view carries on from the same cursor, so the batches after it are still reachable.
      await whatsNewPage.locator("[data-ltm-whats-new-tidy]").click();
      await whatsNewPage.locator("[data-ltm-tidy-start]").click();
      await tidyState("results").waitFor();
      await whatsNewPage.locator("[data-ltm-tidy-apply]").click();
      await tidyState("done").waitFor();
      await whatsNewPage.locator("[data-ltm-tidy-next]").click();
      await tidyState("results").waitFor();
      assert.deepEqual(
        JSON.parse(tidyPreviewBodies.at(-1) ?? ""),
        { after: "tidy-cursor-12" },
        "The done view's next button asks after the same cursor",
      );
      await whatsNewPage.locator("[data-ltm-tidy-back]").click();
      await whatsNewDialog.locator("[data-ltm-whats-new-tidy]").waitFor();
      // A failed read shows the server's own message and offers Try again; Back returns to What's new.
      tidyPreviewReply = {
        status: 400,
        body: { error: "Pick an extraction model first.", code: "ltm_model_configuration" },
      };
      await whatsNewPage.locator("[data-ltm-whats-new-tidy]").click();
      await whatsNewPage.locator("[data-ltm-tidy-start]").click();
      await tidyState("error").waitFor();
      assert.ok((await tidyState("error").innerText()).includes("Pick an extraction model first."));
      assert.equal(await whatsNewPage.getByRole("button", { name: "Try again" }).count(), 1);
      tidyPreviewReply = {
        status: 200,
        body: { total: 4, checked: 4, truncated: false, next: null, failedChunks: 0, suggestions: [] },
      };
      await whatsNewPage.getByRole("button", { name: "Try again" }).click();
      await tidyState("empty").waitFor();
      assert.ok((await tidyState("empty").innerText()).includes("Nothing to tidy."));
      await whatsNewPage.locator("[data-ltm-tidy-focus]").click();
      // Link older relationships opens its flow in the same dialog: confirm sends nothing, Back refocuses its row.
      const linkRow = whatsNewPage.locator('[data-ltm-whats-new-ai="links"]');
      linksPreviewReply = {
        status: 200,
        body: {
          total: 5,
          checked: 3,
          truncated: true,
          next: null,
          failedChunks: 0,
          suggestions: [
            {
              relationship: { id: "rel_00000001", title: "Mira and Tomas" },
              person: { id: "char_00000001", title: "Tomas" },
              origin: "name",
            },
            {
              relationship: { id: "rel_00000002", title: "Dov and Wren" },
              person: { id: "char_00000002", title: "Wren" },
              origin: "model",
            },
          ],
        },
      };
      linksPreviewRequests = 0;
      // A connection in the list is named "name · model".
      linksScopeReply = { status: 200, body: { count: 3, connectionId: "conn-link", model: "fictional-model-2" } };
      await linkRow.click();
      await tidyState("confirm").waitFor();
      await tidyScopeLine()
        .getByText("Uses Fictional Link · fictional-model-2. Checks 3 relationship memories.", { exact: true })
        .waitFor();
      assert.equal(linksPreviewRequests, 0, "Reading the scope sends nothing to the model");
      assert.equal(await whatsNewPage.locator('[data-ltm-ai-check="links"]').count(), 1);
      assert.equal(await whatsNewPage.locator("[data-ltm-whats-new-ai]").count(), 0);
      assert.ok((await tidyState("confirm").innerText()).includes("to your extraction model"));
      assert.equal(linksPreviewRequests, 0, "Nothing is sent before Start");
      await whatsNewPage.locator("[data-ltm-tidy-back]").click();
      await linkRow.waitFor();
      assert.equal(
        await whatsNewPage.evaluate(() => document.activeElement?.getAttribute("data-ltm-whats-new-ai") === "links"),
        true,
        "Back returns focus to the Link row",
      );
      await linkRow.click();
      await whatsNewPage.locator("[data-ltm-tidy-start]").click();
      await tidyState("results").waitFor();
      assert.equal(linksPreviewRequests, 1);
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-item]:checked").count(), 2);
      const linksText = (await tidyState("results").innerText()).replace(/\s+/gu, " ");
      assert.ok(linksText.includes("Mira and Tomas → Tomas") && linksText.includes("Same name"));
      assert.ok(linksText.includes("Suggested by AI") && linksText.includes("Checked 3 of 5 relationships."));
      await whatsNewPage.locator('[data-ltm-tidy-item="rel_00000002|char_00000002"]').uncheck();
      assert.equal((await whatsNewPage.locator("[data-ltm-tidy-apply]").innerText()).trim(), "Add 1 link");
      await whatsNewPage.locator("[data-ltm-tidy-apply]").click();
      await tidyState("done").waitFor();
      assert.deepEqual(linksApplyBodies, [{ links: [{ relationshipId: "rel_00000001", personId: "char_00000001" }] }]);
      assert.ok((await tidyState("done").innerText()).includes("1 link added."));
      await whatsNewPage.locator("[data-ltm-tidy-focus]").click();
      await linkRow.waitFor();
      // Find duplicate people: nothing is sent before Start, nothing starts ticked, and only the ticked group merges.
      const peopleRow = whatsNewPage.locator('[data-ltm-whats-new-ai="people"]');
      peoplePreviewReply = {
        status: 200,
        body: {
          total: 6,
          checked: 6,
          truncated: false,
          next: null,
          failedChunks: 0,
          suggestions: [
            {
              keep: { id: "char_00000011", title: "Elizabeth Marlow" },
              merge: [
                { id: "char_00000012", title: "Lizzie" },
                { id: "char_00000013", title: "Liz" },
              ],
            },
            { keep: { id: "char_00000014", title: "Toby" }, merge: [{ id: "char_00000015", title: "Tobin" }] },
          ],
        },
      };
      peoplePreviewRequests = 0;
      // No connection and no model: the count alone, in the singular.
      peopleScopeReply = { status: 200, body: { count: 1, connectionId: null, model: null } };
      await peopleRow.click();
      await tidyState("confirm").waitFor();
      await tidyScopeLine().getByText("Checks 1 person memory.", { exact: true }).waitFor();
      assert.equal(peoplePreviewRequests, 0, "Reading the scope sends nothing to the model");
      assert.equal(await whatsNewPage.locator('[data-ltm-ai-check="people"]').count(), 1);
      assert.equal(peoplePreviewRequests, 0, "Nothing is sent before Start");
      await whatsNewPage.locator("[data-ltm-tidy-start]").click();
      await tidyState("results").waitFor();
      assert.equal(peoplePreviewRequests, 1);
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-item]").count(), 2);
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-item]:checked").count(), 0, "nothing starts ticked");
      assert.equal(await whatsNewPage.locator("[data-ltm-tidy-apply]").isDisabled(), true);
      const peopleText = (await tidyState("results").innerText()).replace(/\s+/gu, " ");
      assert.ok(peopleText.includes("Maybe the same person") && peopleText.includes("Keeps: Elizabeth Marlow"));
      assert.ok(peopleText.includes("Merge in: Lizzie, Liz") && peopleText.includes("Merge in: Tobin"));
      await whatsNewPage.locator('[data-ltm-tidy-item="char_00000011|char_00000012,char_00000013"]').check();
      assert.equal((await whatsNewPage.locator("[data-ltm-tidy-apply]").innerText()).trim(), "Merge 1 group");
      await whatsNewPage.locator("[data-ltm-tidy-apply]").click();
      await tidyState("done").waitFor();
      assert.deepEqual(peopleApplyBodies, [
        { groups: [{ keepId: "char_00000011", mergeIds: ["char_00000012", "char_00000013"] }] },
      ]);
      const peopleDone = await tidyState("done").innerText();
      assert.ok(peopleDone.includes("1 group merged.") && peopleDone.includes("a backup was saved first"));
      await whatsNewPage.locator("[data-ltm-tidy-focus]").click();
      await peopleRow.waitFor();
      // Closing the dialog while the model reads aborts the request and still writes the seen flag.
      holdTidyPreview = new Promise<void>((resolveHold) => (releaseTidyPreview = resolveHold));
      await whatsNewPage.locator("[data-ltm-whats-new-tidy]").click();
      await whatsNewPage.locator("[data-ltm-tidy-start]").click();
      await tidyState("checking").waitFor();
      await whatsNewPage.keyboard.press("Escape");
      await whatsNewDialog.waitFor({ state: "detached" });
      releaseTidyPreview();
      holdTidyPreview = null;
      await whatsNewContext.close();
      await mobileContext.close();
    },
    [
      () => releaseReextraction?.(),
      () => browser?.close(),
      () =>
        new Promise<void>((resolveClose, reject) => {
          if (!browserServer) return resolveClose();
          browserServer.close((error) => (error ? reject(error) : resolveClose()));
        }),
    ],
  );
  console.log("Long-Term Memory browser: onboarding, review, availability, re-extraction, mobile, and loading ok");
}
export const completion = runRegressionToCompletion("long-term-memory-browser", main);
void completion.catch((error) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
