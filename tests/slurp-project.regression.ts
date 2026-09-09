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

console.log("slurp project regression passed");
