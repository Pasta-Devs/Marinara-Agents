// Beholder client contract.
//
// The client bundle is a port of the Beholder extension's paper doll: the renderer
// modules are the extension's own, so the doll drawn in Marinara is the doll the
// extension draws. Nothing in the build can prove that on its own — a stray edit to
// a renderer module would still concatenate, still lint, and still ship. These
// snapshots pin the rendered markup for a fixture that exercises every visual
// branch (worn, damage, wounds, bleeding, bare, missing, holding, species, both
// views, all three layouts), so a change in output has to be deliberate.
//
// The second half checks the properties the host relies on: the element registers
// under the tag the host mounts, the bundle is self-contained, and the shipped
// bytes match what the manifest declares.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const packageRoot = join(repoRoot, "packages/beholder");
const srcDir = join(packageRoot, "src");

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

// ── Fixture: one character per rendering branch ──────────────────────────────
const STATE = {
  Maggie: {
    species: "human",
    body: {
      chest: { worn: [{ item: "blouse", color: "white", damage: "torn" }] },
      back: { worn: [{ item: "cloak", color: "green", damage: "pristine" }] },
      waist: { worn: [{ item: "belt", color: "brown" }], bare: false },
      left_leg: { worn: [{ item: "trouser", color: "black", damage: "bloodied" }] },
      left_foot: { worn: [{ item: "boot", color: "brown", damage: "scuffed" }] },
      right_foot: { bare: true },
      head: { wounds: [{ type: "cut", severity: "moderate", bleeding: true }] },
      left_arm: { wounds: [{ type: "burn", severity: "critical", bleeding: false }] },
      left_hand: { holding: { item: "lantern" } },
      right_arm: { missing: true },
      left_eye: { missing: true },
    },
  },
  Kheza: {
    species: "naga",
    body: {
      chest: { worn: [{ item: "harness", color: "crimson", damage: "pristine" }] },
      tail: { bare: true },
      head: { worn: [{ item: "circlet", color: "gold" }] },
      right_hand: { holding: { item: "spear", damage: "charred" } },
      neck: { worn: [{ item: "torc", color: "silver", damage: "tarnished" }] },
    },
  },
};

// Markup digests produced by the extension's renderer for the fixture above.
const EXPECTED_RENDER = {
  "paired/front": "64cd9fee2ac71a31",
  "paired/back": "9ae3c8247520f181",
  "columns/front": "f6dd8dc85e3a833b",
  "columns/back": "06dc2548b64d47b0",
  "list/front": "32aa4e2856cb4201",
  "list/back": "d96c948af5a6a897",
};

// The renderer half of the bundle: everything before the dock, which is the part
// that needs a document. Loading it alone keeps this test free of a DOM stub.
const RENDERER_MODULES = ["10-garment-data.js", "12-colors.js", "15-state.js", "30-paperdoll.js"];
const rendererSource = RENDERER_MODULES.map((name) => readFileSync(join(srcDir, name), "utf8")).join("\n");
const loadRenderer = new Function(`${rendererSource}\nreturn { renderDollPanel, setDollLayout };`) as () => {
  renderDollPanel: (
    state: unknown,
    activeName: string | null,
    updated: Set<string>,
    view: string,
  ) => { html: string; activeName: string | null };
  setDollLayout: (layout: string) => void;
};
const { renderDollPanel, setDollLayout } = loadRenderer();

for (const layout of ["paired", "columns", "list"]) {
  setDollLayout(layout);
  for (const view of ["front", "back"]) {
    const key = `${layout}/${view}` as keyof typeof EXPECTED_RENDER;
    const rendered = renderDollPanel(STATE, "Maggie", new Set(["Kheza"]), view);
    assert.equal(
      sha256(rendered.html).slice(0, 16),
      EXPECTED_RENDER[key],
      `Beholder doll markup changed for ${key} — update the snapshot only if the change is intended`,
    );
  }
}

// A fixture that used slot names the schema does not have would render empty cards
// and the snapshots above would pass while covering nothing. Pin the size of the
// markup so that failure mode cannot pass unnoticed.
setDollLayout("paired");
const populated = renderDollPanel(STATE, "Maggie", new Set(), "front").html;
for (const marker of [
  "blouse", // worn item
  "lantern", // held item — `holding` is one object, not a list; an array renders nothing
  "bh-slot-missing-tag", // acquired loss
  "bh-slot-bare", // uncovered slot
  "bleeding", // wound detail
  "bh-chip", // the chip the color and damage layers decorate
  "torn", // the damage word itself, not just the chip that carries it
  "white", // and the colour word
  "bh-c-white", // the swatch class derived from it
]) {
  assert.ok(
    populated.includes(marker),
    `fixture must exercise ${marker} — a fixture using names the schema lacks renders empty cards and these snapshots would prove nothing`,
  );
}

// The renderer must resolve an active character even when the caller's choice is gone,
// because the dock passes the previously selected name straight back in.
setDollLayout("paired");
assert.equal(
  renderDollPanel(STATE, "Someone Who Left", new Set(), "front").activeName,
  "Maggie",
  "renderer must fall back to a present character when the active one disappears",
);
assert.equal(
  renderDollPanel({}, null, new Set(), "front").html.length > 0,
  true,
  "empty state must still render the placeholder doll rather than nothing",
);

// ── Bundle contract ──────────────────────────────────────────────────────────
const client = readFileSync(join(packageRoot, "client.js"), "utf8");
const manifest = JSON.parse(readFileSync(join(packageRoot, "manifest.json"), "utf8"));
const beholderInterfaceSource = ["style.css", "80-dock.js", "90-element.js"]
  .map((name) => readFileSync(join(srcDir, name), "utf8"))
  .join("\n");

assert.equal(manifest.entrypoints.client, "client.js", "manifest must declare the client entrypoint");
assert.ok(
  manifest.contributions?.slots?.includes("roleplay-tracker"),
  "manifest must contribute to the left-side roleplay tracker toolbar",
);
assert.ok(
  manifest.contributions?.slots?.includes("tracker-panel"),
  "manifest must contribute its Beholder launcher to Tracker Panel",
);
assert.ok(manifest.permissions.includes("ui"), "a client-bearing package needs the ui permission");
assert.match(beholderInterfaceSource, /--marinara-chat-chrome-accent/u, "Beholder must consume the chat chroma token");
assert.match(beholderInterfaceSource, /bh-hud-icon/u, "the Beholder toolbar mark must be theme-colored");
assert.match(
  beholderInterfaceSource,
  /\.bh-hud-icon\{[^}]*--marinara-app-accent-solid/u,
  "the Beholder toolbar mark must follow the animated app accent",
);
assert.match(
  beholderInterfaceSource,
  /\$\{hostClass\} mari-accent-animated bh-hud-toggle/u,
  "the Beholder toolbar control must opt into the host accent transition",
);
assert.match(
  beholderInterfaceSource,
  /<svg class="\$\{className\}"[^>]*stroke="currentColor"/u,
  "Beholder launchers must use the theme-colored eye icon",
);
assert.doesNotMatch(beholderInterfaceSource, /BH_LOGO/u, "Beholder launchers must not restore the old PNG logo");
assert.match(beholderInterfaceSource, /"toolbarLabel", "Beholder"/u, "the toolbar tooltip must simply say Beholder");
assert.doesNotMatch(
  beholderInterfaceSource,
  /\.(?:bh-hud-toggle|bh-tracker-launch)[^}]*var\(--primary\)/su,
  "the Beholder launcher must inherit the host toolbar theme instead of primary pink",
);
assert.match(
  beholderInterfaceSource,
  /\.bh-tracker-launch\.bh-active\{[^}]*--marinara-chat-chrome-accent/u,
  "the Tracker Panel launcher must visibly reflect its active state",
);
assert.match(
  beholderInterfaceSource,
  /\.bh-tracker-launch\.bh-active \.bh-tracker-launch__arrow\{transform:rotate\(90deg\);\}/u,
  "the Tracker Panel arrow must point down while the Beholder window is open",
);
assert.match(
  beholderInterfaceSource,
  /\.bh-tracker-launch:focus-visible\{[^}]*outline/u,
  "the Tracker Panel launcher must retain a visible keyboard focus indicator",
);
assert.match(
  beholderInterfaceSource,
  /startInteraction\("move", event\)/u,
  "the Beholder header must support moving the desktop window",
);
assert.match(
  beholderInterfaceSource,
  /startInteraction\("resize", event\)/u,
  "the Beholder resize handle must support two-dimensional desktop resizing",
);
assert.match(
  beholderInterfaceSource,
  /event\.preventDefault\(\);\s*this\._interaction\?\.\(\);[\s\S]*const pointerId/u,
  "a new pointer interaction must clean up the previous one before capturing body styles",
);
assert.match(
  beholderInterfaceSource,
  /const pointerId = event\.pointerId;[\s\S]*moveEvent\.pointerId !== pointerId[\s\S]*endEvent\.pointerId === pointerId/u,
  "only the initiating pointer may move or end a Beholder interaction",
);
assert.match(
  beholderInterfaceSource,
  /resizeHandle\.addEventListener\("keydown"[\s\S]*this\.resizeBy/u,
  "the Beholder resize control must remain keyboard-operable",
);
assert.match(
  beholderInterfaceSource,
  /_boundsObserver = new ResizeObserver\(\(\) => \{[\s\S]*this\.syncGeometry\(\)/u,
  "the floating window must stay inside the chat when the surrounding layout changes",
);
assert.match(
  beholderInterfaceSource,
  /\.beholder-panel\{ inset:0 !important; width:100% !important; height:100% !important/u,
  "mobile Beholder must fill its chat-area host",
);
assert.match(
  beholderInterfaceSource,
  /hostArea\.appendChild\(panel\)/u,
  "floating Beholder must be mounted inside the live chat area rather than document.body",
);
assert.match(
  beholderInterfaceSource,
  /releaseHost\(element\)[\s\S]*this\.close\(\)/u,
  "floating Beholder must close when its roleplay host leaves the chat area",
);
assert.match(
  beholderInterfaceSource,
  /window\.open\("", "_blank"\)/u,
  "the Beholder header must offer a detached browser tab",
);
assert.match(
  beholderInterfaceSource,
  /--bh-window-accent: var\(--marinara-app-accent-static/u,
  "the floating window frame and controls must follow the app accent",
);
assert.match(
  beholderInterfaceSource,
  /Math\.min\(width \/ BH_WINDOW_DEFAULT_WIDTH, height \/ BH_WINDOW_DEFAULT_HEIGHT\)/u,
  "the floating window must scale its content from the available size",
);
assert.match(
  beholderInterfaceSource,
  /fitDesktopContent\(\)[\s\S]*body\.clientHeight[\s\S]*body\.scrollHeight/u,
  "desktop Beholder must shrink overflowing content to the available body height",
);
assert.match(
  beholderInterfaceSource,
  /const layout = !this\.isDetached\(\) && this\.isMobile\(\) \? "paired" : this\.layout/u,
  "mobile Beholder must keep the paper doll while desktop preserves the selected layout",
);
assert.match(
  beholderInterfaceSource,
  /\.beholder-panel\.bh-mobile-layout \.bh-doll-grid\{ display:grid; \}[\s\S]*\.beholder-panel\.bh-mobile-layout \.bh-digest\{ display:none; \}/u,
  "the full-screen mobile window must not let narrow-container rules hide the paper doll",
);
assert.match(
  beholderInterfaceSource,
  /\.rpg-chat-area\.bh-beholder-open\{ z-index:70; \}[\s\S]*\.beholder-panel\{[^}]*z-index:80/u,
  "mobile Beholder must stack above Echo Chamber and Tracker Panel",
);
assert.match(
  beholderInterfaceSource,
  /bh-tracker-launch__arrow[^<]*<\/span><span class="bh-tracker-launch__logo"/u,
  "the Tracker Panel launcher must place its disclosure arrow before the eye",
);
assert.doesNotMatch(
  beholderInterfaceSource,
  /body\.bh-dock-open/u,
  "floating Beholder must not reflow the chat like the removed sidebar",
);
assert.match(
  beholderInterfaceSource,
  /\.bh-msg-hold\s*\{[^}]*var\(--bh-chroma\)/u,
  "held-item activity must use the chat chroma instead of a fixed yellow",
);
assert.match(
  beholderInterfaceSource,
  /\.bh-part \.bh-body-fill\.bh-part-wound-1\s*\{[^}]*var\(--bh-chroma\)/u,
  "minor wound highlights must use the chat chroma instead of a fixed yellow",
);
for (const legacyColor of [
  "#ffeaa7",
  "#c9a55a",
  "#f3e3b8",
  "rgba(201, 165, 90",
  "rgba(255, 234, 167",
  "rgb(227, 201, 105",
]) {
  assert.ok(!beholderInterfaceSource.includes(legacyColor), `Beholder UI still contains legacy gold: ${legacyColor}`);
}

assert.ok(
  client.includes("customElements.define(BH_TAG, BeholderElement)") &&
    client.includes('"marinara-capability-beholder"'),
  "client must register the custom element the host mounts",
);

// Self-contained: the panel's styles, strings and brand mark are inlined, so the
// client must never reach a third-party host at runtime.
const remoteReference = client.match(/https?:\/\/(?!localhost)[^"'`\s)]+/g) ?? [];
const allowedRemote = remoteReference.filter((url) => !url.startsWith("https://huggingface.co/GetBeholder"));
assert.deepEqual(allowedRemote, [], `client bundle must not reference remote hosts: ${allowedRemote.join(", ")}`);

// Reconstruct the deterministic bundle so a stale generated client cannot pass
// merely because it still contains every module marker.
const clientModules = readdirSync(srcDir)
  .filter((file) => file.endsWith(".js"))
  .sort();
const clientLocales: Record<string, Record<string, string>> = {};
for (const name of readdirSync(join(srcDir, "locales"))
  .filter((file) => file.endsWith(".json"))
  .sort()) {
  const catalog = JSON.parse(readFileSync(join(srcDir, "locales", name), "utf8"));
  clientLocales[basename(name, ".json").toLowerCase()] = Object.fromEntries(
    Object.entries(catalog).filter(([key, value]) => key !== "_meta" && typeof value === "string"),
  );
}
const freshClient =
  `// Beholder ${manifest.version} — Marinara Engine roleplay-toolbar capability (single-file client bundle)\n` +
  `// Built from packages/beholder/src (${clientModules.length} modules) by scripts/build-beholder-package.mjs. Do not edit; edit src/ and rebuild.\n` +
  `(() => {\n"use strict";\n` +
  `const BH_STYLE_CSS = ${JSON.stringify(readFileSync(join(srcDir, "style.css"), "utf8"))};\n` +
  `const BH_FA_CSS = ${JSON.stringify(readFileSync(join(srcDir, "fa-embed.css"), "utf8"))};\n` +
  `const BH_LOCALES = ${JSON.stringify(clientLocales)};\n\n` +
  `${clientModules.map((name) => `// ===== ${name} =====\n${readFileSync(join(srcDir, name), "utf8")}`).join("\n")}\n` +
  `})();\n`;
assert.equal(client, freshClient, "client.js is stale relative to Beholder source — rebuild the package");

// Every source module must be in the bundle, so a new module cannot be silently
// left out of a build.
for (const name of clientModules) {
  assert.ok(client.includes(`// ===== ${name} =====`), `client bundle is missing ${name} — rebuild the package`);
}

// Shipped bytes must match the manifest, or installs fail their integrity check.
for (const entry of manifest.files) {
  const buffer = readFileSync(join(packageRoot, entry.path));
  assert.equal(sha256(buffer), entry.sha256, `${entry.path} hash does not match the manifest — rebuild the package`);
  assert.equal(buffer.byteLength, entry.bytes, `${entry.path} size does not match the manifest — rebuild the package`);
}

console.log("beholder client contract: renderer snapshots + bundle contract OK");

// ── Escaping ────────────────────────────────────────────────────────────────
// Every value on a slot originates in prose, so it is attacker-influenced by the
// time it reaches markup. Two of these reached a title="…" attribute unescaped
// (the colour word, and the damage word whenever it fell outside the known tiers
// and was echoed back raw), which let a crafted value close the attribute and add
// one of its own. Render each field with a breakout payload and require that the
// raw payload never survives into the markup.
const BREAKOUT = 'white" onmouseover="alert(1)" data-x="';
const escapingCases: Array<[string, unknown]> = [
  ["color", { Maggie: { body: { chest: { worn: [{ item: "blouse", color: BREAKOUT }] } } } }],
  ["item", { Maggie: { body: { chest: { worn: [{ item: BREAKOUT }] } } } }],
  ["damage", { Maggie: { body: { chest: { worn: [{ item: "blouse", damage: BREAKOUT }] } } } }],
  ["material", { Maggie: { body: { chest: { worn: [{ item: "blouse", material: BREAKOUT }] } } } }],
  ["woundType", { Maggie: { body: { head: { wounds: [{ type: BREAKOUT, severity: "minor" }] } } } }],
  ["woundSeverity", { Maggie: { body: { head: { wounds: [{ type: "cut", severity: BREAKOUT }] } } } }],
  ["holding", { Maggie: { body: { left_hand: { holding: { item: BREAKOUT } } } } }],
  ["species", { Maggie: { species: BREAKOUT, body: { chest: { worn: [{ item: "blouse" }] } } } }],
  ["characterName", { [BREAKOUT]: { body: { chest: { worn: [{ item: "blouse" }] } } } }],
];
for (const [field, state] of escapingCases) {
  const html = renderDollPanel(state, "Maggie", new Set(), "front").html;
  assert.ok(
    !html.includes(BREAKOUT),
    `${field} reaches the markup unescaped — a crafted value can close the attribute it lands in`,
  );
}

// A null slot must not take the panel down: the renderer already treats slots as
// possibly absent in some branches, so every branch has to agree.
assert.doesNotThrow(
  () => renderDollPanel({ Maggie: { body: { chest: null, head: undefined } } }, "Maggie", new Set(), "front"),
  "a null slot must render, not throw",
);
