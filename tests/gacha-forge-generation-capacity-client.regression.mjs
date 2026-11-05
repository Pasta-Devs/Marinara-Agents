import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { forgeGenerationCapacityFailure } from "../packages/gacha-forge/src/chat-continuity-client.mjs";

const source = await readFile(
  process.env.GACHA_CAPACITY_CLIENT_UNDER_TEST || new URL("../packages/gacha-forge/client.js", import.meta.url),
  "utf8",
);
const slice = (start, end) => {
  const first = source.indexOf(start),
    last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Actual native renderer ${start}`);
  return source.slice(first, last);
};
const config = () => ({
  label: "Chapter event-1",
  status: "Forging",
  errorStatus: "Couldn't read the forged chapter.",
  errorBody: "The model's chapter plan couldn't be read. Nothing was saved.",
});
const escape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;");
const { hp, Js, pp } = new Function(
  "forgeGenerationCapacityFailure",
  "Ay",
  "ky",
  "_y",
  "np",
  "Ey",
  "op",
  "Sy",
  "u",
  "ip",
  "lp",
  "cp",
  "dp",
  `${slice("function hp(", "function Js(")}\n${slice("function Js(", "function pp(")}\n${slice("function pp(", "function Xa(")}\nreturn {hp,Js,pp};`,
)(
  forgeGenerationCapacityFailure,
  { "bad-plan": "Existing parse error" },
  config,
  config,
  config,
  config,
  config,
  config,
  escape,
  "",
  "",
  () => "",
  () => "",
);

const failure = {
  error: "generation-output-capacity",
  detail: JSON.stringify({ minimumOutputTokens: 8192, availableContextTokens: 7343, configuredMaxOutputTokens: 4096 }),
};
for (const html of [
  Js({ chapter: "event-1", error: true, failure }),
  Js({ chapter: 1, mode: "banner", error: true, failure }),
  Js({ chapter: 1, error: true, bondLabel: "Character story", failure }),
  pp({ chapterTitle: "Current scene", error: true, failure }),
]) {
  for (const expected of [
    "Generation needs more output space.",
    "This generation",
    "8192",
    "7343",
    "4096",
    "context size",
    "Max Output Tokens Override",
  ])
    assert.ok(html.includes(expected), expected);
  assert.doesNotMatch(
    html,
    /Couldn't read|couldn't be read|unreadable|minimumOutputTokens|availableContextTokens|configuredMaxOutputTokens|This reply/,
  );
  assert.match(html, /class="forge-why" hidden/);
  assert.match(html, /class="forge-retry"/);
}
assert.deepEqual(hp("bad-plan", "Existing detail"), { head: "Existing parse error", why: "Existing detail" });
assert.equal(forgeGenerationCapacityFailure({ error: "other", detail: "PRIVATE" }), null);
for (const detail of [
  "PRIVATE malformed JSON",
  "PRIVATE".repeat(1000),
  JSON.stringify({ availableContextTokens: "PRIVATE", configuredMaxOutputTokens: -1 }),
  JSON.stringify({ availableContextTokens: Number.MAX_SAFE_INTEGER + 1, configuredMaxOutputTokens: "4096" }),
]) {
  const rendered = hp("generation-output-capacity", detail);
  assert.ok(rendered.head.includes("8192"));
  assert.doesNotMatch(JSON.stringify(rendered), /PRIVATE|9007199254740992|Configured output override/);
  assert.equal(rendered.why, "");
}
const wrapped = forgeGenerationCapacityFailure({
  detail: "generation-output-capacity",
  capacity: { availableContextTokens: 7000 },
});
assert.ok(wrapped.head.includes("7000"));
assert.doesNotMatch(wrapped.head, /reply/);
console.info(
  "Native Gacha generation capacity error renderers passed (plan, founding units, Character Story and scene)",
);
