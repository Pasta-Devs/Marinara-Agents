import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { runTask } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";

const fresh = () => core.newRun(core.HAFENKAI, 1);
const at = (s: core.Run, week: number, day: number, hoursLeft: number) => {
  s.clock = { week, day, hoursLeft };
  core.movePeople(s);
};
const slots = [5, 4, 3, 2, 1]; // hoursLeft for morning .. night

test("routine: each person is in their routine room, or wanders at about 10%", () => {
  const s = fresh();
  let total = 0;
  let wandered = 0;
  for (let week = 1; week <= 6; week++)
    for (let day = 0; day < 5; day++)
      slots.forEach((hoursLeft, n) => {
        at(s, week, day, hoursLeft);
        for (const p of HAFENKAI_PLACE.people) {
          const want = p.routine[core.SLOTS[n]];
          const room = s.people[p.id].room;
          if (want === "home") assert.equal(room, "home", "home stays home");
          else {
            total++;
            if (room !== want) wandered++;
            assert.ok(s.rooms[room], `${p.id} is in a real room`);
          }
        }
        const listed = Object.values(s.rooms).flatMap((r) => r.people);
        assert.equal(listed.length, new Set(listed).size, "nobody is in 2 rooms");
        assert.equal(listed.length, Object.values(s.people).filter((p) => p.room !== "home").length);
      });
  assert.ok(wandered / total < 0.25, `wander rate ${wandered / total}`);
  assert.ok(wandered > 0, "wander happens");
});

test("needs: stress sends a person to the break room, a sick one home, a crush follows the crush", () => {
  const s = fresh();
  s.people.henrike.stress = 90;
  s.people.tomasz.mood = "sick";
  at(s, 1, 0, 5);
  assert.equal(s.people.henrike.room, "kantine");
  assert.equal(s.people.tomasz.room, "home");
  const t = fresh();
  t.relations.push({ a: "mira", b: "sven", kind: "crush", level: 70 });
  for (const day of [0, 1, 2]) {
    at(t, 1, day, 5);
    if (t.people.sven.room !== "home") assert.equal(t.people.mira.room, t.people.sven.room);
  }
});

test("relations: levels stay in 0-100 and secrets stay unknown until heard", () => {
  const s = fresh();
  core.shiftRelation(s, "henrike", "sven", 500);
  assert.equal(s.relations.find((r) => r.a === "henrike" && r.b === "sven")!.level, 100);
  core.shiftRelation(s, "sven", "henrike", -500);
  assert.equal(s.relations.find((r) => r.a === "henrike" && r.b === "sven")!.level, 0);
  const crush = s.relations.find((r) => r.kind === "crush")!;
  assert.equal(core.isKnown(crush, []), false);
  assert.equal(core.isKnown(crush, [core.relKey(crush)]), true);
});

test("leave: low trust warns, a second low week quits, recovery closes the warning", () => {
  const s = fresh();
  s.people.olga.trust = 5;
  s.clock = { week: 3, day: 0, hoursLeft: 5 };
  core.dayTurn(s);
  const warning = Object.values(s.threads).find((t) => t.kind === "crisis" && t.people[0] === "olga");
  assert.ok(warning, "a warning thread opened");
  assert.equal(s.people.olga.status, "active");
  s.clock = { week: 4, day: 0, hoursLeft: 5 };
  core.dayTurn(s);
  assert.equal(s.people.olga.status, "quit");
  assert.equal(s.people.olga.room, "home");
  assert.equal(
    Object.values(s.threads).some((t) => t.people.includes("olga")),
    false,
  );

  const r = fresh();
  r.people.olga.trust = 5;
  r.clock = { week: 3, day: 0, hoursLeft: 5 };
  core.dayTurn(r);
  r.people.olga.trust = 40;
  r.clock = { week: 4, day: 0, hoursLeft: 5 };
  core.dayTurn(r);
  assert.equal(r.people.olga.status, "active");
  assert.equal(Object.keys(r.threads).length, 0);
});

test("rooms: a worn room costs its meter 1 point a week, never more", () => {
  const s = fresh();
  for (const room of Object.values(s.rooms)) room.condition = 5;
  const before = { ...s.meters };
  s.clock = { week: 2, day: 0, hoursLeft: 5 };
  core.dayTurn(s);
  const lost = core.METERS.map((m) => before[m] - s.meters[m]);
  assert.equal(
    lost.reduce((a, b) => a + b, 0),
    1,
  );
});

test("tasks: the ambient prompt carries a person's reason seeds", async () => {
  const seen: string[] = [];
  const spy = async (...a: unknown[]) => {
    seen.push(JSON.stringify(a));
    return JSON.stringify({ lines: [{ person: "mira", line: "Hello." }] });
  };
  const people = [
    { person: "mira", room: "Dispatch", mood: "fine", with: [], reasons: ["Mira heard you stood up for the porters"] },
  ];
  await runTask("ambient.batch", { kit: HAFENKAI_PLACE, rng: 3, people }, { model: spy as never });
  assert.ok(seen.join().includes("Mira heard you stood up for the porters"));
});

test("tasks: ambient and grapevine fall back to Lite and reject a wrong person", async () => {
  const kit = HAFENKAI_PLACE;
  const people = [
    { person: "henrike", room: "Dock A", mood: "fine", with: [] },
    { person: "mira", room: "Dispatch", mood: "low", with: [{ person: "olga", kind: "friend" }] },
  ];
  const lite = await runTask("ambient.batch", { kit, rng: 3, people });
  assert.equal(lite.source, "lite");
  assert.deepEqual(
    lite.output.lines.map((l) => l.person),
    ["henrike", "mira"],
  );
  const bad = async () =>
    JSON.stringify({
      lines: [
        { person: "mira", line: "Mind the gap." },
        { person: "henrike", line: "Right." },
      ],
    });
  assert.equal((await runTask("ambient.batch", { kit, rng: 3, people }, { model: bad })).source, "lite");
  const good = async () =>
    JSON.stringify({
      lines: [
        { person: "henrike", line: "Pallets again." },
        { person: "mira", line: "Not today." },
      ],
    });
  assert.equal((await runTask("ambient.batch", { kit, rng: 3, people }, { model: good })).source, "model");
  const facts = [{ person: "mira", text: "Mira is in a bad mood." }];
  const gossip = await runTask("grapevine.batch", { kit, rng: 3, facts });
  assert.equal(gossip.output.lines[0].source, "mira");
  const nobody = async () => JSON.stringify({ lines: [{ source: "ghost", line: "Something odd." }] });
  assert.equal((await runTask("grapevine.batch", { kit, rng: 3, facts }, { model: nobody })).source, "lite");
});

test("visitor: goes home on their last day and gets a room before that", () => {
  const s = fresh();
  const p = HAFENKAI_PLACE.people.find((x) => !x.deputy)!;
  s.people.v1 = { ...s.people[p.id], name: "Visitor", routine: p.routine, until: core.dayIndex(s.clock) + 1 };
  core.movePeople(s);
  assert.notEqual(s.people.v1.room, "home", "a visitor works a kit routine");
  core.dayTurn(s);
  assert.equal(s.people.v1.status, "active", "still here before the last day");
  s.clock = { ...s.clock, day: s.clock.day + 1 };
  core.dayTurn(s);
  assert.equal(s.people.v1.status, "quit");
});
