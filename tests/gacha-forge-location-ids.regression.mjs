// Gacha Forge ships pre-built bundles whose source tree lives outside this repository, so this proof
// reads the committed bundles: it runs the shipped location-ID code (Pasta-Devs/Marinara-Agents#1460)
// and pins the iPhone landscape layout rules (Pasta-Devs/Marinara-Agents#1461), so a later bundle
// drop cannot lose either fix silently.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const packageRoot = new URL("../packages/gacha-forge/", import.meta.url);
const server = await readFile(new URL("server.mjs", packageRoot), "utf8");
const client = await readFile(new URL("client.js", packageRoot), "utf8");

// Cuts one top-level `function name(...){...}` out of a minified bundle by balancing braces.
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the bundle`);
  assert.equal(source.indexOf(`function ${name}(`, start + 1), -1, `${name} must be defined once`);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

const serverSource = ["gs", "ir", "bgSlug", "gsPlaces"].map((name) => extractFunction(server, name)).join("\n");
const serverFns = vm.runInNewContext(`${serverSource}\n({ gs, ir, bgSlug, gsPlaces })`);
const clientSlug = vm.runInNewContext(`${extractFunction(client, "oc")}\noc`);

// The client and the server must derive the same ID from the same name, or the client looks up a
// background the server filed under another key.
assert.equal(
  extractFunction(client, "oc")
    .replace(/^function oc\(t\)/u, "")
    .replaceAll("t??", "e??"),
  extractFunction(server, "gs").replace(/^function gs\(e\)/u, ""),
  "client oc() and server gs() must be the same normalization",
);

// Every ASCII name keeps exactly the ID it had before, so existing backgrounds and saves still match.
const legacySlug = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
let seed = 1460;
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};
const asciiSamples = ["", "  ", "Moon Forest", "  Crystal  Cave #2 ", "--edge--", "a".repeat(59) + " b", "A/B\\C..D"];
for (let sample = 0; sample < 4000; sample += 1) {
  let text = "";
  const length = Math.floor(random() * 90);
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(Math.floor(random() * 128));
  asciiSamples.push(text);
}
for (const name of asciiSamples) {
  assert.equal(serverFns.gs(name), legacySlug(name), `server ID changed for ASCII ${JSON.stringify(name)}`);
  assert.equal(clientSlug(name), legacySlug(name), `client ID changed for ASCII ${JSON.stringify(name)}`);
}

// Names the ASCII-only rule emptied or cut down now keep their letters.
const unicodeCases = new Map([
  ["달빛 숲", "달빛-숲"],
  ["수정 동굴", "수정-동굴"],
  ["숲 1", "숲-1"],
  ["동굴 1", "동굴-1"],
  ["Château Rouge", "château-rouge"],
  ["月の神殿", "月の神殿"],
  ["Лунный лес", "лунный-лес"],
  ["काला महल", "काला-महल"],
  ["किला महल", "किला-महल"],
]);
for (const [name, slug] of unicodeCases) {
  assert.equal(serverFns.gs(name), slug, `server ID for ${name}`);
  assert.equal(clientSlug(name), slug, `client ID for ${name}`);
}
// Decomposed input (Hangul jamo, e plus a combining accent) files under the composed ID.
assert.equal(serverFns.gs("달빛 숲".normalize("NFD")), "달빛-숲");
assert.equal(clientSlug("Café"), "café");
// The fold used for fuzzy matching no longer empties Hangul either.
assert.equal(serverFns.ir("달빛 숲"), "달빛-숲");
assert.equal(serverFns.ir("Château Rouge"), "chateau-rouge");

// The 60-character cap counts code points and never leaves half of a surrogate pair.
const astral = "\u{20000}".repeat(70);
for (const slug of [serverFns.gs(astral), clientSlug(astral)]) {
  assert.equal(Array.from(slug).length, 60);
  assert.equal(slug, "\u{20000}".repeat(60));
  assert.doesNotMatch(slug, /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u);
}

// An ID never carries a path separator, a dot pair or a control character.
for (const name of ["../../etc/passwd", "a\\b", "x\u0000y\u001f", "\u0085\u007f", "..", "달빛/숲"]) {
  assert.doesNotMatch(serverFns.gs(name), /[/\\]|\.\.|\p{Cc}/u, `gs(${JSON.stringify(name)})`);
}

// The background endpoint accepts Unicode IDs and refuses a slug that tries to carry one of those.
assert.match(server, /i=bgSlug\(u\.slug,u\.name\);if\(!o\|\|!i\)return\{ok:!1,error:"bad-request"\}/u);
assert.equal(serverFns.bgSlug("달빛-숲", "달빛 숲"), "달빛-숲");
assert.equal(serverFns.bgSlug("", "달빛 숲"), "달빛-숲");
assert.equal(serverFns.bgSlug(undefined, "Moon Forest"), "moon-forest");
assert.equal(serverFns.bgSlug("moon-forest", ""), "moon-forest");
for (const slug of ["../x", "a/b", "a\\b", "..", "x\u0000", "x\u001b[0m", "x\u009b"]) {
  assert.equal(serverFns.bgSlug(slug, "Moon Forest"), "", `slug ${JSON.stringify(slug)} must be refused`);
}
assert.equal(serverFns.bgSlug("", ""), "");

// Backgrounds filed under the old lossy ID are still found by the new one, and a name that once
// collided with another under the old rule does not inherit its background.
assert.match(server, /return\{doc:u,places:gsPlaces\(u&&u\.data&&u\.data\.places\|\|\{\}\)\}/u);
const stored = {
  "ch-teau-rouge": { name: "Château Rouge", url: "/a.png" },
  1: { name: "숲 1", url: "/b.png" },
  "moon-forest": { name: "Moon Forest", url: "/c.png" },
  "달빛-숲": { name: "달빛 숲", url: "/d.png" },
  odd: { name: "달빛 숲", url: "/e.png" },
};
const storedBefore = structuredClone(stored);
const places = serverFns.gsPlaces(stored);
assert.equal(places["château-rouge"], stored["ch-teau-rouge"]);
assert.equal(places["ch-teau-rouge"], stored["ch-teau-rouge"]);
assert.equal(places["숲-1"], stored[1]);
assert.equal(places["동굴-1"], undefined);
assert.equal(places["달빛-숲"], stored["달빛-숲"], "an alias never replaces a key already filed");
assert.deepEqual(stored, storedBefore, "the stored document is not changed");

// iPhone landscape (#1461): the frame fits the visible screen, keeps clear of the notch when it
// covers the screen, gives a short landscape screen every pixel, and keeps the type at its size.
const css = (pattern, label) => assert.match(client, pattern, label);
css(/max-height: 100vh;\s*max-height: 100dvh;/u, "the arena caps at 100dvh with a 100vh fallback first");
css(
  /:host\(:fullscreen\) \.gf-arena \{ padding: env\(safe-area-inset-top\) env\(safe-area-inset-right\) env\(safe-area-inset-bottom\) env\(safe-area-inset-left\); \}/u,
  "fullscreen keeps clear of the safe areas",
);
css(
  /\.gf-arena, \.gf-arena \* \{ -webkit-text-size-adjust: 100%; text-size-adjust: 100%; \}/u,
  "no landscape text inflation",
);
const shortLandscape = /@media \(orientation: landscape\) and \(max-height: 500px\) \{([^}]*\}[^}]*\})\s*\}/gu;
const blocks = [...client.matchAll(shortLandscape)].map((match) => match[1]);
assert.ok(
  blocks.some(
    (block) =>
      /\.gf-arena \{ padding: 0; \}/u.test(block) && /\.gf-stage \{ border: 0; box-shadow: none; \}/u.test(block),
  ),
);
assert.ok(
  blocks.some((block) => /\.st-plate \{ padding:/u.test(block)),
  "settings plates tighten in a short landscape",
);
// A fullscreen toggle the browser cannot honour (iPhone Safari) is removed instead of doing nothing.
css(
  /s=typeof this\.requestFullscreen=="function"&&document\.fullscreenEnabled!==!1;/u,
  "fullscreen support is checked",
);
css(/r&&\(s\?r\.addEventListener\("click",e\):r\.remove\(\)\)/u, "unsupported fullscreen toggles are removed");

process.stdout.write("Gacha Forge location ID and landscape regression passed.\n");
