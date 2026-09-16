import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  makeSlurpProject,
  resolveSlurpArcConfig,
  SLURP_ARC_LIBRARY_SEED,
  slurpArcLifeLine,
  slurpArcTypeFromProject,
  slurpAutoArcPick,
  slurpGeneratedArcProject,
  slurpProjectInstruction,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-project.js";

const at = new Date("2026-09-09T10:00:00.000Z");

const generationSource = readFileSync(
  new URL(
    "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-arc-generation.service.ts",
    import.meta.url,
  ),
  "utf8",
);
assert.match(generationSource, /input\.brief\.trim\(\)\.slice\(0, 2_000\)/u, "the AI builder sends the player's brief");
const routesSource = readFileSync(
  new URL("../packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts", import.meta.url),
  "utf8",
);
assert.match(routesSource, /arc-library\/generate/u, "the AI builder has a dedicated draft route");
assert.match(
  routesSource,
  /slurpArcTypeFromProject\(project, draftId\)/u,
  "the draft route returns a library type without storing a project",
);
assert.match(routesSource, /Generation already in progress/u, "busy generation has a clear response");
assert.match(routesSource, /rawResponse: error\.rawResponse/u, "foreground failures expose bounded model output");
assert.match(generationSource, /SlurpArcGenerationFailure/u, "unusable model output keeps a diagnostic reason");
assert.match(
  readFileSync(
    new URL(
      "../packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpBackstageWorkflow.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  /Export.*Import Arc|importArc[\s\S]*exportArc/u,
  "the Arc Library supports sharing individual arcs",
);

// arcSource: global default reaches the resolved config, a Creator override wins.
const global = { arcAutoMode: "auto", arcCooldownWeeks: 1, arcPace: "normal", arcSource: "mixed" } as const;
assert.equal(resolveSlurpArcConfig(global, {}).source, "mixed");
assert.equal(resolveSlurpArcConfig(global, { source: "library" }).source, "library");

// Source selection is deterministic per Creator and day.
const base = { at, projects: [], library: SLURP_ARC_LIBRARY_SEED, creatorTags: [], lastAutoAt: null, cooldownWeeks: 1 };
const ids = Array.from({ length: 3000 }, (_, index) => `creator-${index}`);
const rolled = ids
  .map((creatorAccountId) => slurpAutoArcPick({ ...base, creatorAccountId, source: "mixed" }))
  .filter(Boolean);
const again = ids
  .map((creatorAccountId) => slurpAutoArcPick({ ...base, creatorAccountId, source: "mixed" }))
  .filter(Boolean);
assert.deepEqual(rolled, again, "same Creator and day, same pick");
const generatedShare = rolled.filter((pick) => pick && "generated" in pick).length / rolled.length;
assert.ok(generatedShare > 0.2 && generatedShare < 0.46, `about 1 in 3 generated, got ${generatedShare}`);
const lucky = ids.find((creatorAccountId) => slurpAutoArcPick({ ...base, creatorAccountId, source: "library" }))!;
assert.deepEqual(slurpAutoArcPick({ ...base, creatorAccountId: lucky, source: "generated" }), { generated: true });
assert.ok("type" in slurpAutoArcPick({ ...base, creatorAccountId: lucky, source: "library" })!);
assert.deepEqual(
  slurpAutoArcPick({ ...base, creatorAccountId: lucky, source: "mixed", allowedTypeIds: [] }),
  { generated: true },
  "mixed with no matching type generates",
);
assert.equal(slurpAutoArcPick({ ...base, creatorAccountId: lucky, source: "library", allowedTypeIds: [] }), null);
assert.equal(
  slurpAutoArcPick({ ...base, creatorAccountId: lucky, source: "generated", concurrentAuto: 2, maxConcurrentAuto: 2 }),
  null,
  "the cap holds for generated arcs",
);

// Generated output is clamped; unusable output is null.
const options = { origin: "auto", status: "suggested" } as const;
assert.equal(slurpGeneratedArcProject("g", null, at, options), null);
assert.equal(slurpGeneratedArcProject("g", "nope", at, options), null);
assert.equal(slurpGeneratedArcProject("g", { title: "   ", chapters: [] }, at, options), null);
const arc = slurpGeneratedArcProject(
  "g",
  {
    title: "x".repeat(300),
    direction: "Learning to bake bread",
    tone: "cozy",
    chapters: [
      { label: "the starter", minDays: 5, maxDays: 2 },
      { label: "", minDays: 1, maxDays: 1 },
      { label: "the first loaf", minDays: -4, maxDays: 900 },
      ...Array.from({ length: 20 }, (_, index) => ({ label: `extra ${index}`, minDays: 1, maxDays: 2 })),
    ],
  },
  at,
  options,
)!;
assert.equal(arc.title.length, 80);
assert.equal(arc.typeId, null);
assert.equal(arc.origin, "auto");
assert.equal(arc.generated, true);
assert.equal(arc.status, "suggested");
assert.equal(arc.tone, "cozy");
assert.equal(arc.chapters.length, 12);
assert.deepEqual(arc.phaseDays[0], { min: 5, max: 5 });
assert.deepEqual(arc.phaseDays[1], { min: 0, max: 90 });
assert.equal(arc.durationDays, null);
const open = slurpGeneratedArcProject("o", { title: "Open", chapters: [], durationDays: 9999 }, at, options)!;
assert.equal(open.durationDays, 365);
assert.equal(slurpGeneratedArcProject("o", { title: "Open" }, at, options)!.durationDays, 14);

// Save to library shape.
assert.deepEqual(
  slurpArcTypeFromProject(
    { ...arc, chapters: arc.chapters.slice(0, 2), phaseDays: [arc.phaseDays[0]!, null] },
    "custom-1",
  ),
  {
    id: "custom-1",
    name: arc.title,
    description: "Learning to bake bread",
    chapters: [
      { label: "the starter", minDays: 5, maxDays: 5 },
      { label: "the first loaf", minDays: 0, maxDays: 0 },
    ],
    tags: [],
    tone: "cozy",
    durationDays: 14,
    enabled: true,
    builtin: false,
    hidden: false,
  },
);

// Tone reaches the post and DM arc lines; no tone adds nothing.
assert.match(
  slurpProjectInstruction({ title: "Bread", direction: "", chapter: null, tone: "dark", history: [] }),
  /Tone: dark/u,
);
assert.doesNotMatch(slurpProjectInstruction({ title: "Bread", direction: "", chapter: null, history: [] }), /Tone:/u);
const toned = { ...makeSlurpProject("t", { title: "Bread", chapters: ["starter"] }, at)!, tone: "spicy" };
assert.equal(slurpArcLifeLine([toned]), "Bread (starter), tone: spicy");

console.log("slurp2 arc generation regression passed");
