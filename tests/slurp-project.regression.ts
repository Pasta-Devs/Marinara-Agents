import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  activeSlurpProjects,
  makeSlurpProject,
  readSlurpProject,
  readSlurpProjects,
  SLURP_ARC_LIBRARY_SEED,
  SLURP_PROJECT_MAX_CHAPTERS,
  SLURP_PROJECT_TITLE_MAX_LENGTH,
  SLURP_DEFAULT_ARC_AUTO_MODE,
  slurpArcLifeLine,
  slurpArcRotation,
  slurpArcsWithoutFocus,
  slurpAutoArcType,
  slurpProjectAdvance,
  slurpProjectChapter,
  slurpProjectInstruction,
  slurpProjectsKey,
  slurpProjectTick,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-project.js";

const at = new Date("2026-09-09T10:00:00.000Z");
const daysLater = (days: number) => new Date(at.getTime() + days * 86_400_000);
const movingType = SLURP_ARC_LIBRARY_SEED.find((type) => type.id === "moving")!;

// ── Library arcs are paced in days, not posts ───────────────────────────────
const move = makeSlurpProject("m1", { type: movingType }, at);
assert.ok(move, "a library type brings its own title");
assert.equal(move.title, movingType.name);
assert.equal(move.typeId, "moving");
assert.equal(move.chapters.length, movingType.chapters.length);
assert.deepEqual(move.phaseDays[0], { min: 2, max: 5 });
// Posting four times on day one must not pack, move, and settle in before lunch.
let moving = move;
for (let index = 0; index < 4; index += 1) moving = slurpProjectAdvance(moving, at);
assert.equal(moving.chapter, 0, "the minimum days hold the chapter against frequent posts");
assert.equal(moving.posts, 4);
moving = slurpProjectAdvance(moving, daysLater(2));
assert.equal(moving.chapter, 1, "a post after the minimum moves the arc on");
assert.equal(moving.chapterStartedAt, daysLater(2).toISOString(), "the next chapter starts its own clock");
// Pace stretches the minimum: slow is one and a half times as long.
assert.equal(slurpProjectAdvance(move, daysLater(2), "slow").chapter, 0);
assert.equal(slurpProjectAdvance(move, daysLater(1), "fast").chapter, 1);
// The maximum moves the arc on with no post at all, so a quiet Creator does not stall mid-move.
assert.equal(slurpProjectTick(move, daysLater(4), "normal"), move, "nothing moves before the maximum");
assert.equal(slurpProjectTick(move, daysLater(5), "normal").chapter, 1);
assert.equal(slurpProjectTick({ ...move, status: "paused" }, daysLater(50)).chapter, 0, "a paused arc keeps still");
// Typed chapters win over the type, and carry no day ranges unless a label matches.
const ownMove = makeSlurpProject("m2", { type: movingType, title: "Leaving Leeds", chapters: ["a", "b"] }, at);
assert.equal(ownMove?.title, "Leaving Leeds");
assert.deepEqual(ownMove?.phaseDays, []);
assert.equal(makeSlurpProject("m3", {}, at), null, "a custom arc still needs a title");
// Chapters without a day range never time out: they have no clock to run out.
const planless = makeSlurpProject("m4", { title: "t", chapters: ["a", "b"] }, at)!;
assert.equal(slurpProjectTick(planless, daysLater(365)), planless);

// ── Focus ───────────────────────────────────────────────────────────────────
const focus = { ...move, id: "f", intensity: "focus" as const };
assert.deepEqual(
  slurpArcRotation([move, focus]).map((project) => project.id),
  ["m1", "f", "f"],
  "the focus arc takes twice the slots",
);
assert.ok(slurpArcsWithoutFocus([move, focus]).every((project) => project.intensity === "background"));

// ── Automatic arcs ──────────────────────────────────────────────────────────
// Off by default: every Creator moving house unasked is the bug arcs were built to fix.
assert.equal(SLURP_DEFAULT_ARC_AUTO_MODE, "off");
{
  const auto = (overrides: Partial<Parameters<typeof slurpAutoArcType>[0]> = {}) =>
    slurpAutoArcType({
      creatorAccountId: "creator-a",
      at,
      projects: [],
      library: SLURP_ARC_LIBRARY_SEED,
      creatorTags: [],
      lastAutoAt: null,
      cooldownWeeks: 3,
      ...overrides,
    });
  // Find a Creator whose day rolls an arc, so the other rules can be checked against a real "yes".
  const lucky = Array.from({ length: 400 }, (_, index) => `creator-${index}`).find(
    (creatorAccountId) => auto({ creatorAccountId }) !== null,
  );
  assert.ok(lucky, "some Creators roll an arc on a given day");
  const rolled = Array.from({ length: 60 }, (_, index) => auto({ creatorAccountId: `creator-${index}` }));
  assert.ok(rolled.filter(Boolean).length < 60, "not every Creator gets an arc on the same day");
  assert.equal(
    auto({ creatorAccountId: lucky }),
    auto({ creatorAccountId: lucky }),
    "the same day gives the same answer",
  );
  assert.equal(auto({ creatorAccountId: lucky, projects: [move] }), null, "a running arc blocks another");
  assert.equal(auto({ creatorAccountId: lucky, projects: [{ ...move, status: "suggested" }] }), null);
  assert.notEqual(auto({ creatorAccountId: lucky, projects: [{ ...move, status: "complete" }] }), null);
  assert.equal(auto({ creatorAccountId: lucky, library: [] }), null, "an empty library, no arc");
  assert.equal(
    auto({ creatorAccountId: lucky, library: SLURP_ARC_LIBRARY_SEED.map((type) => ({ ...type, enabled: false })) }),
    null,
    "disabled types are never picked",
  );
  assert.equal(auto({ creatorAccountId: lucky, lastAutoAt: daysLater(-7).toISOString() }), null, "cooldown holds");
}

// ── The arc reaches the rest of the Creator's life ──────────────────────────
assert.equal(slurpArcLifeLine([]), null, "no arc, no life event invented in a DM");
assert.equal(slurpArcLifeLine([{ ...move, status: "paused" }]), null);
assert.equal(slurpArcLifeLine([move, { ...focus, title: "Trip" }]), "Trip (deciding to move)", "the focus arc wins");
assert.equal(slurpArcLifeLine([move]), "Moving house (deciding to move)");
{
  const serverRoot = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/services");
  const stance = readFileSync(join(serverRoot, "slurp/slurp-stance.ts"), "utf8");
  assert.match(stance, /do not make every reply about it/u);
  const dm = readFileSync(join(serverRoot, "slurp/slurp-message-generation.service.ts"), "utf8");
  // Gated by the setting, and protected: an arc title can name a Secret Creator's real city.
  assert.match(dm, /settings\.arcAffectsMood\s+\? \(protectNoodlerGeneratedIdentity\(\s+slurpArcLifeLine/u);
  const store = readFileSync(join(serverRoot, "storage/slurp.storage.ts"), "utf8");
  assert.match(store, /"arc_complete"/u);
  assert.match(store, /await this\.recordArcChange\(creatorAccountId, current, next\)/u);
}

// ── A project needs a title and nothing else ────────────────────────────────
const open = makeSlurpProject("p1", { title: "Renovating the flat" }, at);
assert.ok(open);
assert.equal(open.chapters.length, 0, "an open-ended project costs no plan");
assert.equal(open.status, "active");
assert.equal(open.posts, 0);
assert.equal(slurpProjectChapter(open), null);
assert.equal(makeSlurpProject("p2", { title: "   " }, at), null, "an untitled thread cannot be cancelled later");

// ── Chaptered projects ──────────────────────────────────────────────────────
const planned = makeSlurpProject(
  "p3",
  {
    title: "New body, new me",
    direction: "From the decision to the result.",
    chapters: ["the decision", "the consultation", "the result"],
  },
  at,
);
assert.ok(planned);
assert.equal(slurpProjectChapter(planned), "the decision");

// ── Advancing happens one published post at a time ──────────────────────────
let running = slurpProjectAdvance(planned, at);
assert.equal(running.posts, 1);
assert.equal(slurpProjectChapter(running), "the consultation");
assert.equal(running.status, "active");
running = slurpProjectAdvance(running, at);
assert.equal(slurpProjectChapter(running), "the result");
assert.equal(running.status, "active", "the last chapter still has to be posted");
running = slurpProjectAdvance(running, at);
assert.equal(running.status, "complete");
assert.equal(running.posts, 3);
assert.equal(slurpProjectChapter(running), "the result", "a finished project still says where it ended");

// An open-ended project never completes on its own: there is no last chapter to pass, and calling
// the end of a thread is the one judgement the player has to make.
let drifting = open;
for (let index = 0; index < 40; index += 1) drifting = slurpProjectAdvance(drifting, at);
assert.equal(drifting.status, "active");
assert.equal(drifting.posts, 40);

// ── Only active projects claim posts ────────────────────────────────────────
assert.deepEqual(
  activeSlurpProjects([
    planned,
    { ...planned, id: "p4", status: "paused" },
    { ...planned, id: "p5", status: "complete" },
  ]).map((project) => project.id),
  ["p3"],
);

// ── Stored JSON survives being wrong ────────────────────────────────────────
assert.deepEqual(readSlurpProjects(null), []);
assert.deepEqual(readSlurpProjects("not json"), []);
assert.deepEqual(readSlurpProjects('{"id":"p1"}'), [], "an object is not a list of projects");
assert.equal(readSlurpProjects(JSON.stringify([planned, { id: "x" }])).length, 1, "an untitled entry is dropped");
assert.equal(
  readSlurpProject({ id: "p", title: "t", chapters: ["a", "b"], chapter: 99 })?.chapter,
  1,
  "a pointer past the end would strand the project",
);
assert.equal(readSlurpProject({ id: "p", title: "t", chapter: 3 })?.chapter, 0, "no chapters means no pointer");
assert.equal(readSlurpProject({ id: "p", title: "t", status: "nonsense" })?.status, "active");
assert.equal(readSlurpProject({ id: "p", title: "t", posts: -5 })?.posts, 0);
assert.equal(
  readSlurpProject({ id: "p", title: "t", chapters: Array.from({ length: 40 }, (_, index) => `c${index}`) })?.chapters
    .length,
  SLURP_PROJECT_MAX_CHAPTERS,
);
assert.equal(readSlurpProject({ id: "p", title: "x".repeat(400) })?.title.length, SLURP_PROJECT_TITLE_MAX_LENGTH);
// A project stored before arcs had kinds reads as a custom background arc that advances per post.
const legacy = readSlurpProject({ id: "p", title: "t", chapters: ["a", "b"], startedAt: at.toISOString() })!;
assert.equal(legacy.typeId, null);
assert.equal(legacy.intensity, "background");
assert.deepEqual(legacy.phaseDays, []);
assert.equal(legacy.chapterStartedAt, at.toISOString());
assert.equal(slurpProjectAdvance(legacy, at).chapter, 1);
assert.deepEqual(
  readSlurpProject({
    id: "p",
    title: "t",
    chapters: ["a"],
    phaseDays: [
      { min: 9, max: 2 },
      { min: 1, max: 1 },
    ],
  })?.phaseDays,
  [{ min: 9, max: 9 }],
  "day ranges are trimmed to the chapters and max is never below min",
);

// ── The key follows the goal and earnings shape ─────────────────────────────
assert.equal(slurpProjectsKey("creator-a"), "slurp2.creator.creator-a.projects");

// ── Posts carry the project they were published into ────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const schema = read("db/schema/slurp.ts");
assert.match(schema, /projectId: text\("project_id"\)/u);
// The chapter is stamped on the post, not looked up later: editing a project must not rewrite
// what a published post was about.
assert.match(schema, /projectChapter: text\("project_chapter"\)/u);

const storage = read("services/storage/slurp.storage.ts");
assert.match(storage, /async listActiveProjects\(/u);
assert.match(storage, /async advanceProject\(/u);
assert.match(storage, /async listPostsByProject\(/u);
// A full reset must take the projects with it, or a fresh install inherits the last one's threads.
assert.match(storage, /settings\.remove\(slurpProjectsKey\(accountId\)\)/u);

// ── The prompt block ────────────────────────────────────────────────────────
const block = slurpProjectInstruction({
  title: "New body, new me",
  direction: "From the decision to the result.",
  chapter: "the consultation",
  history: ["Booked it — I actually booked it"],
});
assert.match(block, /# Ongoing project/u);
assert.match(block, /New body, new me/u);
assert.match(block, /the consultation/u);
assert.match(block, /- Booked it/u);
// The two failures that turn a project into a summary of itself: repeating the last post, and
// announcing an outcome the feed has not shown yet.
assert.match(block, /Do not restate what those posts already said/u);
assert.match(block, /not shown happening yet/u);
// The variation still owns place, moment, and framing. Without this line the project block reads
// as the whole brief and every post in a thread comes out of the same room.
assert.match(block, /The angle above still decides/u);

// An open-ended project with no history is still a usable block.
const bare = slurpProjectInstruction({ title: "Renovating the flat", direction: "", chapter: null, history: [] });
assert.match(bare, /Renovating the flat/u);
assert.doesNotMatch(bare, /Where you are now/u);
assert.doesNotMatch(bare, /Your last posts/u);

// ── Generation wiring ───────────────────────────────────────────────────────
const generation = read("services/slurp/slurp-generation.service.ts");
// One sequence for both rotations, or the project and the variation drift apart.
assert.match(generation, /const sequence = await noodle\.countNoodlerPostsByAccount\(account\.id\)/u);
assert.match(generation, /slurpPostVariation\(account\.id, sequence, settings\.storyRate\)/u);
assert.match(
  generation,
  /slurpPostProject\(\s*account\.id,\s*sequence,\s*slurpArcRotation\(await noodle\.listActiveProjects\(account\.id\)\),\s*settings\.projectRate,?\s*\)/u,
);
// Player direction stands both rotations down: their direction is the subject.
assert.match(generation, /const directed = Boolean\(input\.request\.noodlerPostGuide\?\.trim\(\)\)/u);
assert.match(generation, /const project = directed\s+\? null/u);
// The project's own posts, not the page's: page history says nothing about where this thread got to.
assert.match(generation, /listPostsByProject\(project\.id, 4\)/u);
// Project text is untrusted user input like every other supplied value.
assert.match(generation, /title: protect\(input\.project\.project\.title\)/u);
assert.match(generation, /direction: protect\(input\.project\.project\.direction\)/u);
// Both publication paths stamp the post and advance only after the row lands.
assert.match(generation, /projectId: project\?\.id \?\? null/u);
assert.match(generation, /if \(project\) await noodle\.advanceProject\(account\.id, project\.id(?:, post\.id)?\)/u);

const publish = read("services/storage/slurp.storage.ts");
assert.match(publish, /projectId: typeof payload\.projectId === "string" \? payload\.projectId : null/u);
assert.match(publish, /await this\.advanceProject\(item\.creatorAccountId, item\.payload\.projectId(?:, \w+)?\)/u);

// ── Routes ──────────────────────────────────────────────────────────────────
const routes = read("routes/slurp.routes.ts");
for (const route of [
  'app.get("/noodler/accounts/:id/projects"',
  'app.post("/noodler/accounts/:id/projects"',
  'app.patch("/noodler/accounts/:id/projects/:projectId"',
  'app.delete("/noodler/accounts/:id/projects/:projectId"',
  'app.get("/noodler/accounts/:id/projects/:projectId/posts"',
  'app.post("/noodler/accounts/:id/projects/generate"',
  'app.post("/noodler/accounts/:id/projects/:projectId/library"',
]) {
  assert.ok(routes.includes(route), `missing route ${route}`);
}
// A project is production notes, not a tip goal: it must never be readable by the audience.
assert.equal(
  routes.split("accounts/:id/projects").length - 1,
  9,
  "every project route is under the owner-checked creator path",
);
assert.match(routes, /Only the Creator's owner can read their projects\./u);
assert.match(routes, /Only the Creator's owner can open a project\./u);
assert.match(routes, /Only the Creator's owner can edit a project\./u);
assert.match(routes, /Only the Creator's owner can delete a project\./u);
// Posts are only served once the project has been confirmed to belong to this Creator, so a
// guessed project id cannot read someone else's thread.
assert.match(routes, /if \(!\(await noodle\.getProject\(creator\.id, projectId\)\)\) \{\s+return reply\.code\(404\)/u);

// ── Studio panel ────────────────────────────────────────────────────────────
const clientRoot = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src");
const readClient = (path: string) => readFileSync(join(clientRoot, path), "utf8");
const panel = readClient("components/slurp/SlurpProjectsPanel.tsx");
// Read down and edit the dull ones. A review queue would be unusable at thirty Creators.
assert.match(panel, /useSlurpProjects/u);
assert.match(panel, /ui\.slurp\.projects\.pause/u);
assert.match(panel, /ui\.slurp\.projects\.resume/u);
assert.match(panel, /ui\.slurp\.projects\.endEarly/u);
// "Delete" normally takes the content with it. Say that it does not.
assert.match(panel, /ui\.slurp\.projects\.deleteNote/u);
assert.match(readClient("components/slurp/SlurpHome.tsx"), /<SlurpProjectsPanel\s+personaId=\{personaId\}/u);
// The pace is one familiar control beside the Story rate, not a second settings screen.
assert.match(readClient("components/slurp/SlurpSettings.tsx"), /ui\.slurp\.settings\.projectRate/u);

const locales = JSON.parse(readClient("localization/locales/en.json")) as Record<string, string>;
for (const key of ["ui.slurp.projects.heading", "ui.slurp.settings.projectRate", "ui.slurp.projects.status.active"]) {
  assert.ok(locales[key], `missing English string ${key}`);
}

console.log("slurp project regression passed");
