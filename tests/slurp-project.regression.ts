import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  activeSlurpProjects,
  makeSlurpProject,
  readSlurpProject,
  readSlurpProjects,
  SLURP_PROJECT_MAX_CHAPTERS,
  SLURP_PROJECT_TITLE_MAX_LENGTH,
  slurpProjectAdvance,
  slurpProjectChapter,
  slurpProjectInstruction,
  slurpProjectsKey,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-project.js";

const at = new Date("2026-09-09T10:00:00.000Z");

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

// ── The key follows the goal and earnings shape ─────────────────────────────
assert.equal(slurpProjectsKey("creator-a"), "slurp.creator.creator-a.projects");

// ── Posts carry the project they were published into ────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src");
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
  /slurpPostProject\(account\.id, sequence, await noodle\.listActiveProjects\(account\.id\), settings\.projectRate\)/u,
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
assert.match(generation, /if \(project\) await noodle\.advanceProject\(account\.id, project\.id\)/u);

const publish = read("services/storage/slurp.storage.ts");
assert.match(publish, /projectId: typeof payload\.projectId === "string" \? payload\.projectId : null/u);
assert.match(publish, /await this\.advanceProject\(item\.creatorAccountId, item\.payload\.projectId\)/u);

// ── Routes ──────────────────────────────────────────────────────────────────
const routes = read("routes/slurp.routes.ts");
for (const route of [
  'app.get("/noodler/accounts/:id/projects"',
  'app.post("/noodler/accounts/:id/projects"',
  'app.patch("/noodler/accounts/:id/projects/:projectId"',
  'app.delete("/noodler/accounts/:id/projects/:projectId"',
  'app.get("/noodler/accounts/:id/projects/:projectId/posts"',
]) {
  assert.ok(routes.includes(route), `missing route ${route}`);
}
// A project is production notes, not a tip goal: it must never be readable by the audience.
assert.equal(
  routes.split("accounts/:id/projects").length - 1,
  5,
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
const clientRoot = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/client/src");
const readClient = (path: string) => readFileSync(join(clientRoot, path), "utf8");
const panel = readClient("components/slurp/SlurpProjectsPanel.tsx");
// Read down and edit the dull ones. A review queue would be unusable at thirty Creators.
assert.match(panel, /useSlurpProjects/u);
assert.match(panel, /ui\.slurp\.projects\.pause/u);
assert.match(panel, /ui\.slurp\.projects\.resume/u);
assert.match(panel, /ui\.slurp\.projects\.finish/u);
// "Delete" normally takes the content with it. Say that it does not.
assert.match(panel, /ui\.slurp\.projects\.deleteNote/u);
assert.match(readClient("components/slurp/SlurpHome.tsx"), /<SlurpProjectsPanel personaId=\{personaId\}/u);
// The pace is one familiar control beside the Story rate, not a second settings screen.
assert.match(readClient("components/slurp/SlurpSettings.tsx"), /ui\.slurp\.settings\.projectRate/u);

const locales = JSON.parse(readClient("localization/locales/en.json")) as Record<string, string>;
for (const key of ["ui.slurp.projects.heading", "ui.slurp.settings.projectRate", "ui.slurp.projects.status.active"]) {
  assert.ok(locales[key], `missing English string ${key}`);
}

console.log("slurp project regression passed");
