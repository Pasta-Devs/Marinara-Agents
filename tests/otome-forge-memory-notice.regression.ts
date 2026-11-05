// Otome Hearth: a failed summary is never silent. Which story memory status shows which banner and which action, on
// every screen of an open story (components/MemoryBanner.tsx) and under Settings → Connections (MemorySection): a
// failed summary offers Retry with the provider's own words (Otome's, marked its own, when the memory model is too
// small) and the way to the Memory connection; a Retry shows nothing while it is sent and runs, nothing once it writes
// the summary, and the failed banner again, with the new error, only when it fails again (the maintainer's,
// 2026-11-05); memory that waits for a connection offers only the way to the connection; ordinary catch-up, ready
// memory and a fresh story show nothing. The status is read fast only while a retry runs or Settings' memory section
// watches upkeep.
import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTICE_MESSAGE_CHARACTERS,
  memoryNotice,
  ownMessage,
  memoryPollMs,
  nextMemoryView,
  shortMessage,
  type MemoryView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/memory-notice.ts";
import type { MemoryStatus } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";

const CONTEXT_ERROR =
  "This model's maximum context length is 8192 tokens. However, your messages resulted in 12034 tokens. Please reduce the length of the messages.";

const status = (phase: MemoryStatus["phase"], extra: Partial<MemoryStatus> = {}): MemoryStatus => ({
  phase,
  retryable: phase !== "pending" && phase !== "ready",
  recordCount: 3,
  noConnection: false,
  unsummarized: phase === "ready" ? 0 : 1,
  ...extra,
});

/** The statuses as the client reads them one after another (each poll and Retry's answer), as cached. */
function read(...statuses: MemoryStatus[]): MemoryView[] {
  const views: MemoryView[] = [];
  for (const next of statuses) views.push(nextMemoryView(views.at(-1), next));
  return views;
}

test("a failed summary shows the provider's words, Retry and the way to the connection", () => {
  const [failed] = read(status("error", { reason: "generation-failed", message: CONTEXT_ERROR }));
  assert.deepEqual(memoryNotice(failed), { kind: "failed", message: CONTEXT_ERROR });
  // Pressed, Retry hides the banner at once: nothing shows while its request is on its way (`sending`).
  assert.equal(memoryNotice(failed, true), null);
  // A failure with no message of its own (the memory store unreadable) still shows, without a quote.
  assert.deepEqual(memoryNotice(status("error", { reason: "memory-unavailable" })), { kind: "failed", message: null });
});

test("a memory model too small for any summary shows Otome's own words, not as the connection's", () => {
  const TOO_SMALL =
    "The Memory connection's model (8,192 tokens of context) is too small to write a summary. Choose a connection with a larger context.";
  const small = status("error", { reason: "context-too-small", message: TOO_SMALL });
  assert.equal(ownMessage(small), true);
  const notice = memoryNotice(read(small)[0]);
  assert.deepEqual(notice, { kind: "failed", message: TOO_SMALL, own: true });
  // The provider's words keep "The connection said": no `own`.
  const provider = status("error", { reason: "generation-failed", message: CONTEXT_ERROR });
  assert.equal(ownMessage(provider), false);
  assert.deepEqual(memoryNotice(provider), { kind: "failed", message: CONTEXT_ERROR });
  // A message with no reason reads as the provider's too.
  assert.deepEqual(memoryNotice(status("error", { message: CONTEXT_ERROR })), {
    kind: "failed",
    message: CONTEXT_ERROR,
  });
});

test("ordinary catch-up, ready memory and a fresh story show nothing", () => {
  for (const quiet of [
    status("pending"),
    status("stale", { reason: "not-prepared" }),
    status("stale", { reason: "interrupted" }),
    status("ready"),
    status("stale", { reason: "not-prepared", unsummarized: 0 }),
  ]) {
    assert.equal(memoryNotice(read(quiet)[0]), null, JSON.stringify(quiet));
  }
  // Upkeep after a chapter, with no failure before it, is catch-up, not a retry.
  assert.equal(memoryNotice(read(status("ready"), status("pending"), status("pending")).at(-1)), null);
  assert.equal(memoryNotice(undefined), null);
});

test("after Retry nothing shows while it runs or once it writes the summary; one that fails again shows the new error", () => {
  const second = "Upstream 413: request too large for gemma4-gutenberg-31b (context 8192).";
  const views = read(
    status("error", { message: CONTEXT_ERROR }),
    // POST .../memory/retry answers pending, and the polls see it run.
    status("pending"),
    status("pending"),
    status("error", { message: second }),
    // The second Retry writes the summary.
    status("pending"),
    status("ready"),
    // A later chapter's catch-up is not a retry.
    status("pending"),
  );
  assert.deepEqual(
    views.map((view) => view.retrying === true),
    [false, true, true, false, true, false, false],
    "a retry is read as one while it runs",
  );
  assert.deepEqual(
    views.map((view) => memoryNotice(view)),
    [{ kind: "failed", message: CONTEXT_ERROR }, null, null, { kind: "failed", message: second }, null, null, null],
  );
  // A retry that ends behind (a chapter changed while it ran) is catch-up again: no banner.
  assert.equal(
    memoryNotice(read(status("error", { message: CONTEXT_ERROR }), status("pending"), status("stale")).at(-1)),
    null,
  );
});

test("memory waiting for a connection offers the connection, not Retry", () => {
  const waiting = memoryNotice(status("stale", { noConnection: true, unsummarized: 2 }));
  assert.deepEqual(waiting, { kind: "no-connection" });
  // Retry could not run without a connection (503 no-connection), so a failure then asks for the connection too.
  assert.deepEqual(memoryNotice(status("error", { noConnection: true, message: CONTEXT_ERROR })), {
    kind: "no-connection",
  });
  // A count the server could not read still shows it; with nothing finished, nothing waits.
  assert.deepEqual(memoryNotice(status("stale", { noConnection: true, unsummarized: undefined })), {
    kind: "no-connection",
  });
  assert.equal(memoryNotice(status("stale", { noConnection: true, unsummarized: 0 })), null);
});

test("a long provider message is shortened to one line for the banner", () => {
  const page = `<html>\n<head><title>502 Bad Gateway</title></head>\n<body>${"upstream timed out ".repeat(120)}</body></html>`;
  const short = shortMessage(page)!;
  assert.ok(short.length <= NOTICE_MESSAGE_CHARACTERS, `${short.length} characters`);
  assert.ok(short.endsWith("…"));
  assert.doesNotMatch(short, /\n|\s{2}/u);
  assert.ok(short.startsWith("<html> <head><title>502 Bad Gateway</title></head>"));
  assert.equal(shortMessage(`  ${CONTEXT_ERROR}\n`), CONTEXT_ERROR);
  assert.equal(shortMessage("   "), null);
  assert.equal(shortMessage(undefined), null);
  // One unbroken word longer than the limit is cut inside it.
  assert.equal(shortMessage("x".repeat(500), 10), `${"x".repeat(9)}…`);
});

test("the status is read every 2 s only while a retry runs or Settings watches; catch-up every 10 s, else 30 s", () => {
  const [failed, retrying] = read(status("error", { message: CONTEXT_ERROR }), status("pending"));
  assert.equal(retrying.retrying, true);
  assert.equal(memoryPollMs(retrying), 2_000);
  // The catch-up after every chapter shows nothing until it fails: no 2 s reads on every screen of the story.
  const catchUp = read(status("ready"), status("pending")).at(-1);
  assert.equal(memoryPollMs(catchUp), 10_000);
  // Settings' memory section shows that upkeep as it runs.
  assert.equal(memoryPollMs(catchUp, true), 2_000);
  for (const resting of [failed, status("ready"), status("stale", { noConnection: true }), undefined]) {
    assert.equal(memoryPollMs(resting), 30_000, JSON.stringify(resting));
    assert.equal(memoryPollMs(resting, true), 30_000, JSON.stringify(resting));
  }
});
