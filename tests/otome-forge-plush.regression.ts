// Otome Hearth (#1954): each love interest's own Claw Machine plush, the animal that fits them, drawn as SVG.
// - The allow-list (S/art/plush-svg.ts) rebuilds a plush from shapes, attributes and value patterns only, and refuses
//   scripts, styles, text, links, images, URLs, entities, unknown attributes and broken nesting, with a reason.
// - A stored plush is checked again on every read; a damaged one is dropped (and drawn again).
// - GET /play queues one background job per love interest with a bible and no plush, never waits for it, and shows the
//   plush as a data URL once it is kept; a plush is drawn once, a failure is left alone for PLUSH_RETRY_MS, and the
//   prompt (their accent and look) is logged in debug mode.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  PLUSH_ELEMENTS_MAX,
  PLUSH_SVG_MAX,
  plushSvgUrl,
  sanitizePlushSvg,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/plush-svg.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import {
  runDocTarget,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { PLUSH_RETRY_MS } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/plush.ts";
import { registerClawRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/claw.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import { KAI, MIR, SOL, storyWorld } from "./fixtures/otome-forge-story.ts";

const RAVEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256"><g transform="translate(0 2)">' +
  '<ellipse cx="32" cy="40" rx="16" ry="14" fill="#2ec4c4" stroke="#3b2a40" stroke-width="1.2"/>' +
  '<circle cx="32" cy="24" r="14" fill="#2ec4c4" stroke="#3b2a40" stroke-width="1.2"/>' +
  '<circle cx="27" cy="23" r="2.4" fill="#d81b3c"/><circle cx="37" cy="23" r="2.4" fill="#d81b3c"/>' +
  '<path d="M29 28 L32 33 L35 28 Z" fill="#3b2a40"/>' +
  '<path d="M20 40 Q32 48 44 40" fill="none" stroke="#3b2a40" stroke-dasharray="1.5 1.5"/>' +
  '<line x1="22" y1="12" x2="27" y2="16" stroke="#3b2a40" stroke-width="1.2"/></g></svg>';

test("the allow-list rebuilds a plush from shapes only, with its own root", () => {
  const clean = sanitizePlushSvg(`<?xml version="1.0"?>\n${RAVEN}`);
  assert.ok("svg" in clean, JSON.stringify(clean));
  assert.ok(clean.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform='));
  assert.ok(!clean.svg.includes('width="256"'), "the root's own attributes are ours");
  assert.ok(clean.svg.includes('<circle cx="27" cy="23" r="2.4" fill="#d81b3c"/>'));
  // Attribute names with digits read as names: a line keeps all four of its points.
  assert.ok(clean.svg.includes('<line x1="22" y1="12" x2="27" y2="16" stroke="#3b2a40" stroke-width="1.2"/>'));
  assert.ok(clean.svg.endsWith("</g></svg>"));
  assert.equal(sanitizePlushSvg(clean.svg).svg, clean.svg, "a clean plush passes again unchanged");
  const url = plushSvgUrl(clean.svg)!;
  assert.ok(url.startsWith("data:image/svg+xml,%3Csvg%20xmlns%3D"), url.slice(0, 40));
  assert.equal(decodeURIComponent(url.slice("data:image/svg+xml,".length)), clean.svg);
});

test("what the allow-list keeps fits the cap as rebuilt, so every read keeps it too", () => {
  const body = (n: number) => `<path d="M0 0${" L1 1".repeat(n)}"/>`;
  // Sized so the source fits PLUSH_SVG_MAX but the rebuilt root's namespace and box take it over.
  const paths = [body(1150), body(1150)];
  const filler = PLUSH_SVG_MAX - "<svg></svg>".length - paths.join("").length - 20;
  const svg = `<svg>${paths.join("")}<path d="M0 0${" L1 1".repeat(Math.floor(filler / 5))}"/></svg>`;
  assert.ok(svg.length <= PLUSH_SVG_MAX && svg.length > PLUSH_SVG_MAX - 60, `source ${svg.length}`);
  assert.match(String((sanitizePlushSvg(svg) as { error?: string }).error), /longer than 12000/);
  // A kept plush always passes again, so a read never drops what a write kept.
  const kept = sanitizePlushSvg(`<?xml version="1.0"?><svg>${body(10)}${body(10)}</svg>`);
  assert.ok("svg" in kept && sanitizePlushSvg(kept.svg).svg === kept.svg);
});

test("the allow-list refuses anything that is not a plain shape, with a reason", () => {
  const wrap = (inner: string) => `<svg viewBox="0 0 64 64"><circle cx="1" cy="1" r="1"/>${inner}</svg>`;
  const refused: Record<string, string> = {
    script: wrap("<script>alert(1)</script>"),
    style: wrap("<style>circle{fill:red}</style>"),
    foreignObject: wrap("<foreignObject><div/></foreignObject>"),
    image: wrap('<image href="https://example.com/a.png"/>'),
    use: wrap('<use href="#a"/>'),
    link: wrap('<a href="javascript:alert(1)"><circle cx="1" cy="1" r="1"/></a>'),
    handler: wrap('<circle cx="1" cy="1" r="1" onload="alert(1)"/>'),
    xlink: wrap('<path d="M0 0" xlink:href="#a"/>'),
    styleAttribute: wrap('<circle cx="1" cy="1" r="1" style="fill:red"/>'),
    id: wrap('<circle id="a" cx="1" cy="1" r="1"/>'),
    urlPaint: wrap('<circle cx="1" cy="1" r="1" fill="url(#a)"/>'),
    matrix: wrap('<g transform="matrix(1 0 0 1 0 0)"></g>'),
    entity: wrap('<circle cx="1" cy="1" r="1" fill="&#x72;ed"/>'),
    text: wrap("<g>Kai</g>"),
    textElement: wrap("<text>Kai</text>"),
    cdata: wrap("<![CDATA[<script>alert(1)</script>]]>"),
    doctype: `<!DOCTYPE svg [<!ENTITY a "b">]>${wrap("")}`,
    unquoted: wrap("<circle cx=1 cy=1 r=1/>"),
    uppercase: wrap('<CIRCLE cx="1" cy="1" r="1"/>'),
    nested: wrap('<svg><circle cx="1" cy="1" r="1"/></svg>'),
    outOfOrder: '<svg><g><circle cx="1" cy="1" r="1"></g></circle></svg>',
    unclosed: '<svg><circle cx="1" cy="1" r="1"/>',
    after: `${wrap("")}<script>alert(1)</script>`,
    twoRoots: `${wrap("")}${wrap("")}`,
    noRoot: '<circle cx="1" cy="1" r="1"/>',
    empty: "<svg></svg>",
    // Two paths each within their own limit, together over the plush's.
    tooLong: wrap(`<path d="M0 0${" L1 1".repeat(1100)}"/>`.repeat(3)),
    tooMany: wrap('<circle cx="1" cy="1" r="1"/>'.repeat(PLUSH_ELEMENTS_MAX)),
    badNumber: wrap('<circle cx="1px" cy="1" r="1"/>'),
    inherited: wrap('<circle constructor="1" cx="1" cy="1" r="1"/>'),
    inheritedToString: wrap('<circle toString="1" cx="1" cy="1" r="1"/>'),
    repeated: wrap('<circle cx="1" cy="1" r="1" fill="#00ff00" fill="#ff0000"/>'),
    // A comment is skipped where it stands, never cut out: halves around one cannot join into new markup.
    // No comment is taken in any form, so none can end early (`--!>`) or splice two halves into a tag.
    comment: wrap("<!-- a raven -->"),
    commentBangEnd: wrap("<!-- --!><script>alert(1)</script> -->"),
    splicedComment: wrap("<scr<!-- -->ipt>alert(1)</script>"),
    commentHalf: wrap("<!<!-- -->-- x -->"),
    digitName: wrap('<circle cx="1" cy="1" r="1" x3="1"/>'),
    laterDeclaration: `${wrap("")}<?xml version="1.0"?>`,
  };
  assert.match(String((sanitizePlushSvg(refused.tooLong!) as { error: string }).error), /longer than 12000/);
  assert.match(String((sanitizePlushSvg(refused.repeated!) as { error: string }).error), /repeats the attribute fill/);
  assert.match(String((sanitizePlushSvg(refused.comment!) as { error: string }).error), /has a comment/);
  assert.match(String((sanitizePlushSvg(refused.digitName!) as { error: string }).error), /attribute x3, which is not/);
  for (const [kind, svg] of Object.entries(refused)) {
    const result = sanitizePlushSvg(svg);
    assert.ok("error" in result && result.error.startsWith("svg "), `${kind} is refused: ${JSON.stringify(result)}`);
    assert.equal(plushSvgUrl(svg), undefined, `${kind} never becomes a picture`);
  }
});

test("a stored plush is checked again on every read; a damaged one is dropped", () => {
  const svg = (sanitizePlushSvg(RAVEN) as { svg: string }).svg;
  const unit = (plushArt: unknown) => normalizeUnit({ id: KAI, name: "Kai", plushArt });
  assert.deepEqual(unit({ animal: " raven ", svg, at: "t" }).plushArt, { animal: "raven", svg, at: "t" });
  for (const damaged of [
    { animal: "raven", svg: `${svg}<script>alert(1)</script>`, at: "t" },
    { animal: "raven", svg: svg.replace("<circle ", '<circle constructor="1" '), at: "t" },
    { animal: "", svg, at: "t" },
    { animal: "raven", at: "t" },
    "raven",
  ]) {
    assert.equal("plushArt" in unit(damaged), false, JSON.stringify(damaged).slice(0, 60));
  }
  assert.equal("plushArt" in normalizeUnit({ id: KAI }), false, "no plush yet: no key at all");
});

const plushReply = (animal: string, svg = RAVEN) => JSON.stringify({ animal, svg });
const isPlush = (messages: Array<{ content: string }>) => messages[0]!.content.includes("You design one plush toy");

/** A forged world with the Claw routes and a background lane; `play()` is GET /runs/:run/play in debug mode. */
async function plushWorld(runKey: string, replies: Parameters<typeof storyWorld>[0]["replies"]) {
  const t = await storyWorld({ runKey, replies });
  const background = createBackgroundQueue(t.runtime);
  const deps: RouteDeps = { ...t.deps, background };
  const routes = new Map<string, RouteHandler>();
  registerClawRoutes({ get: (path, handler) => routes.set(path, handler), post: () => undefined } as never, deps);
  const play = async () => {
    let payload: unknown;
    const reply: OtomeReply = { status: () => reply, send: (value) => ((payload = value), reply) };
    const query = { timeZone: "UTC", debugMode: true };
    const result = await routes.get("/runs/:run/play")!(
      { method: "GET", url: "", params: { run: runKey }, query },
      reply,
    );
    return (result === reply ? payload : result) as { lis: Record<string, { animal?: string; plush?: string }> };
  };
  const settle = async () => {
    for (let round = 0; round < 200; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      await runForeground(t.runId, async () => undefined);
    }
  };
  const unit = async (li: string) => (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
  const plushCalls = () => t.calls.filter((entry) => isPlush(entry.messages));
  return { ...t, background, play, settle, unit, plushCalls };
}

test("GET /play draws each love interest's plush once, in the background, and shows it once kept", async () => {
  const t = await plushWorld("r-plush01-aaaaaa", [plushReply("raven"), plushReply("black cat"), plushReply("red fox")]);
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    accent: "#2EC4C4",
    identityLine: "tall man, cyan hair, red eyes",
  }));
  // Hold the lane: GET /play still answers at once, and no plush is drawn until the lane is free.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  t.background.ensure({ key: "blocker", connectionId: "conn-text", run: () => gate });
  const first = await t.play();
  assert.equal(first.lis[KAI]!.animal, undefined, "the play view never waits for a plush");
  await t.settle();
  assert.equal(t.plushCalls().length, 0, "nothing is drawn while the lane is held");
  release();
  await t.settle();
  assert.equal(t.plushCalls().length, 3, "one call per love interest");
  const prompt = t.plushCalls().find((call) => call.messages[1]!.content.includes("LOVE INTEREST: Kai"))!.messages;
  assert.match(prompt[1]!.content, /Accent colour: #2EC4C4/);
  assert.match(prompt[1]!.content, /Look: tall man, cyan hair, red eyes/);
  assert.match(
    prompt[0]!.content,
    /Use only these elements: svg, g, path, circle, ellipse, rect, polygon, polyline, line\./,
  );
  const kai = await t.unit(KAI);
  assert.ok(kai.plushArt && ["raven", "black cat", "red fox"].includes(kai.plushArt.animal));
  const second = await t.play();
  for (const li of [KAI, MIR, SOL]) {
    assert.equal(second.lis[li]!.animal, plushSvgUrl((await t.unit(li)).plushArt!.svg), `${li}'s plush is shown`);
  }
  await t.settle();
  assert.equal(t.plushCalls().length, 3, "a kept plush is never drawn again");
  const logged = t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === "plush");
  assert.ok(logged.length >= 1, "the prompt is logged in debug mode");
});

test("a refused plush is repaired once, and a love interest whose plush failed is left alone for a while", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const script = '<svg viewBox="0 0 64 64"><script>alert(1)</script></svg>';
  const t = await plushWorld("r-plush02-bbbbbb", [
    plushReply("raven", script),
    (messages) => {
      assert.match(messages.at(-1)!.content, /svg uses <script>, which is not allowed/, "the repair says why");
      return plushReply("raven");
    },
    plushReply("cat", script),
    plushReply("cat", script),
    plushReply("fox", script),
    plushReply("fox", script),
  ]);
  await t.play();
  await t.settle();
  const kept = await Promise.all([KAI, MIR, SOL].map(async (li) => !!(await t.unit(li)).plushArt));
  assert.equal(kept.filter(Boolean).length, 1, "one repaired and kept; two refused twice and not kept");
  assert.equal(t.plushCalls().length, 6);
  await t.play();
  await t.settle();
  assert.equal(t.plushCalls().length, 6, "the failed ones are left alone within the cool-down");
  context.mock.timers.tick(PLUSH_RETRY_MS + 1);
  await t.play();
  await t.settle();
  assert.equal(t.plushCalls().length, 8, "after it, they are asked again (and the replies have run out)");
});
