import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/SourcesWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const activity = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/ActivityView.tsx",
    import.meta.url,
  ),
  "utf8",
);
const settings = readFileSync(
  new URL(
    "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/MemorySettings.tsx",
    import.meta.url,
  ),
  "utf8",
);
const locale = JSON.parse(
  readFileSync(
    new URL(
      "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/locales/en.json",
      import.meta.url,
    ),
  ),
);

assert.match(workspace, /const effectiveAction = retryContract\?\.action \?\? action/u);
assert.match(workspace, /extract: contract\.action !== "refresh"/u);
assert.match(workspace, /retryContract\?\.action/u);
assert.match(workspace, /refreshSelectedSources/u);
assert.match(workspace, /sourceRefreshCompletedWithFailures/u);
assert.match(
  workspace,
  /contract\.action === "refresh"[\s\S]*!result\.counts\.missing[\s\S]*!result\.counts\.sourceWriteFailed/u,
);
assert.match(workspace, /sourceRefreshedExtractionNotRun/u);
assert.match(workspace, /retry-cancelled/u);
assert.match(workspace, /cancelledImport\.sourceIds[\s\S]*"import"[\s\S]*cancelledImport/u);
assert.match(workspace, /retry-failed/u);
assert.match(workspace, /retryableIds[\s\S]*"import"[\s\S]*importResultContract/u);
assert.match(workspace, /readyForReviewWithRejectedSuggestions/u);
assert.match(workspace, /extractionDidNotFinish/u);
assert.match(activity, /completionReasoningTokens/u);
assert.match(activity, /data-ltm-activity-warnings/u);
assert.match(settings, /reasoningEffort: resolved\.reasoningEffort \?\? "low"/u);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.syncSelected_8c57bdb"], undefined);
assert.equal(locale["ui.longTermMemory.sourcesworkspace.refreshSelectedSources"], "Refresh selected sources");
assert.equal(locale["ui.longTermMemory.activityview.totalTokens"], "Total: {{count}} tokens");

process.stdout.write("Long-Term Memory feedback clarity UI regression: labels, outcomes, usage, warnings, and defaults ok\n");
