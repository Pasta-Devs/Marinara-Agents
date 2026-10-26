import assert from "node:assert/strict";
import {
  createChapterRuntime,
  chapterRunId as runId,
  chapterUnitId as unitId,
  freshMainPlan,
  freshBondPlan,
} from "./fixtures/gacha-forge-chapter-runtime.mjs";
for (const lane of ["main", "bond"])
  for (const first of ["ordinary", "event"]) {
    const f = await createChapterRuntime();
    // Admission must reach the provider; dedicated budget tests cover insufficient capacity.
    f.transport.maxContext = 262144;
    let release, lead, follow;
    try {
      for (const [id] of f.docs)
        if (id.startsWith(`${runId}:chapter:2`) || id.startsWith(`${runId}:beat:2:`)) f.docs.delete(id);
      f.docs.get("index").data.runs[0].story.seasonalEvents = true;
      f.session().progress = { 1: { normal: 10 } };
      delete f.session().reading;
      let started;
      const providerStarted = new Promise((r) => {
        started = r;
      });
      const gate = new Promise((r) => {
        release = r;
      });
      const providers = [];
      f.transport.reply = async (body) => {
        const sys = String(body.messages?.[0]?.content || "");
        if (sys.includes("substantial, self-contained seasonal story event"))
          return JSON.stringify({
            title: "Festival",
            theme: "Known friends gather.",
            premise: "A confined celebration.",
            cast: [unitId],
            special: "character",
          });
        if (sys.includes("Summarize only")) return JSON.stringify({ summary: "Existing canon." });
        const event = sys.includes("SEASONAL EVENT:"),
          kind = event ? "event" : "ordinary";
        providers.push(kind);
        if (kind === first) {
          started();
          await gate;
        }
        return JSON.stringify(!event && lane === "bond" ? freshBondPlan : freshMainPlan);
      };
      assert((await f.post("/story-events", { runId })).body.ok);
      const ordinary = () =>
        f.post(lane === "main" ? "/chapter-plan" : "/bond-chapter/plan", {
          runId,
          ...(lane === "main" ? { chapter: 2 } : { unitId, part: 1 }),
        });
      const event = () => f.post("/story-event/plan", { runId, chapter: "event-1" });
      lead = first === "event" ? event() : ordinary();
      void lead.catch(() => {});
      let startTimer;
      await Promise.race([
        providerStarted,
        new Promise((_, reject) => {
          startTimer = setTimeout(
            () => reject(new Error(`${lane}/${first}: leading planner did not reach the provider within 5 seconds`)),
            5000,
          );
        }),
      ]).finally(() => clearTimeout(startTimer));
      follow = first === "event" ? ordinary() : event();
      void follow.catch(() => {});
      // Let the second actual HTTP route reach admission while the first provider remains held.
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.deepEqual(providers, [first], `${lane}/${first}: only the admitted planner may call the provider`);
      release();
      const [a, b] = await Promise.all([lead, follow]);
      assert.equal(a.body.ok, true, JSON.stringify(a));
      assert.equal(b.body.ok, false, JSON.stringify(b));
      assert.equal(b.body.error, first === "event" ? "story-event-open" : "event-needs-chapter-boundary");
      assert.deepEqual(providers, [first], "Denied queued admission must not spend a second provider request");
      const ordinaryKey = lane === "main" ? 2 : "bond-arden";
      assert.equal(f.docs.has(`${runId}:chapter:${ordinaryKey}`), first !== "event");
      assert.equal(f.docs.has(`${runId}:chapter:event-1`), first === "event");
      if (lane === "bond" && first === "event") {
        f.seed(`${runId}:chapter:bond-arden`, "chapter-plan", {
          ...freshBondPlan,
          bondUnitId: unitId,
          bondPart: 1,
          after: 1,
        });
        assert.equal(
          (await ordinary()).body.error,
          "story-event-open",
          "An imported cached-but-unopened Character Story cannot open new progress during the event",
        );
        f.session().bondChapters = { [unitId]: { beats: 3, after: 1, opened: 1 } };
        const replay = await ordinary();
        assert.equal(replay.body.ok, true, JSON.stringify(replay));
        assert.equal(replay.body.cached, true);
        assert.deepEqual(providers, [first], "Already played Character Story replay remains cached and free");
      }
    } finally {
      release?.();
      await Promise.allSettled([lead, follow]);
      await f.close();
    }
  }
console.info(
  "Actual SDK shared story admission passed both orderings for main chapters and Character Stories without a second paid generation.",
);
