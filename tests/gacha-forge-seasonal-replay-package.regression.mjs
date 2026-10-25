// A disposable test route exposes the actual bundled memory/context and legacy reader, with no provider calls.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createChapterRuntime,
  chapterRunId as runId,
  chapterUnitId as unitId,
  freshMainPlan,
  freshBondPlan,
} from "./fixtures/gacha-forge-chapter-runtime.mjs";
for (const [target, eventOpened, bondOpened, eventAfter, bondAfter, includeOther] of [
  ["event", 100, 200, 1, 1, false],
  ["event", 200, 100, 1, 1, true],
  ["bond", 200, 100, 1, 1, false],
  ["bond", 100, 200, 1, 1, true],
  ["event", 100, 0, 1, 1, false],
  ["event", 0, 100, 1, 1, false],
  ["event", 0, 0, 2, 1, true],
])
  test(`bundled legacy fallback scopes ${target} replay ${eventOpened}/${bondOpened}/${eventAfter}/${bondAfter}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "gacha-seasonal-replay-")),
      path = join(directory, "server.mjs");
    const source = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
    const needle = 'post("/story-events", (body) => events.list(body));';
    assert(source.includes(needle));
    await writeFile(
      path,
      source.replace(
        needle,
        needle + '\npost("/__review-memory", body => _r(body.runId,body.chapter,0,{job:"structured"}));',
      ),
    );
    const previous = process.env.GACHA_CHAT_SERVER_UNDER_TEST;
    process.env.GACHA_CHAT_SERVER_UNDER_TEST = path;
    let f;
    try {
      f = await createChapterRuntime();
      f.docs.get("index").data.runs[0].connectionId = "";
      f.session().progress = { 1: { normal: 10 }, 2: { normal: 10 }, "event-1": { normal: 10 } };
      delete f.session().reading;
      f.session().bondChapters = { [unitId]: { beats: 3, after: bondAfter, opened: bondOpened } };
      f.seed(`${runId}:chapter:event-1`, "chapter-plan", {
        ...freshMainPlan,
        eventId: `${runId}:story-event:1`,
        after: eventAfter,
        opened: eventOpened,
      });
      f.seed(`${runId}:chapter:bond-arden`, "chapter-plan", {
        ...freshBondPlan,
        bondUnitId: unitId,
        bondPart: 1,
        after: bondAfter,
      });
      for (let i = 0; i < 7; i++)
        f.seed(`${runId}:beat:event-1:${i}`, "beat", {
          chapter: "event-1",
          storyIndex: i,
          segments: [{ text: "EVENT_CANON_MARKER" }],
        });
      for (let i = 0; i < 3; i++)
        f.seed(`${runId}:beat:bond-arden:${i}`, "beat", {
          chapter: "bond-arden",
          storyIndex: i,
          segments: [{ text: "BOND_CANON_MARKER" }],
        });
      const response = await f.post("/__review-memory", {
        runId,
        chapter: target === "event" ? "event-1" : "bond-arden",
      });
      assert.equal(response.status, 200, JSON.stringify(response));
      const marker = target === "event" ? "BOND_CANON_MARKER" : "EVENT_CANON_MARKER";
      assert.equal(response.body.includes(marker), includeOther, JSON.stringify(response));
      assert.equal(
        f.calls.length,
        0,
        "Unknown/disabled memory context must use the real legacy fallback without model generation",
      );
    } finally {
      if (previous === undefined) delete process.env.GACHA_CHAT_SERVER_UNDER_TEST;
      else process.env.GACHA_CHAT_SERVER_UNDER_TEST = previous;
      await f?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
