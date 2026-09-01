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
// The header used to offer "open in a new tab". It was removed on the operator's
// judgement — a paper doll pinned beside the chat it describes has a reason to exist;
// the same doll alone on a blank tab does not. Asserted so it does not drift back in.
assert.ok(
  !/window\.open\("", "_blank"\)/u.test(beholderInterfaceSource),
  "the Beholder header must not offer a detached browser tab",
);
assert.ok(
  !/bh-dock-popout/u.test(beholderInterfaceSource),
  "the pop-out control must be gone from the header, not merely unwired",
);
assert.match(
  beholderInterfaceSource,
  /--bh-window-accent: var\(--marinara-app-accent-static/u,
  "the floating window frame and controls must follow the app accent",
);
assert.match(
  beholderInterfaceSource,
  /Math\.min\(width \/ BH_SCALE_REFERENCE_WIDTH, height \/ BH_SCALE_REFERENCE_HEIGHT\)/u,
  "the floating window must scale its content from the available size",
);
// The reference size and the opening size have to stay separate constants. One constant
// answered both questions, so opening the panel taller — which is what stops it shrinking
// its own text to 6px — silently redefined what 100% meant and scaled everything back
// down again.
assert.ok(
  /BH_SCALE_REFERENCE_HEIGHT = \d+/u.test(beholderInterfaceSource) &&
    /BH_WINDOW_DEFAULT_HEIGHT = \d+/u.test(beholderInterfaceSource) &&
    !/height \/ BH_WINDOW_DEFAULT_HEIGHT/u.test(beholderInterfaceSource),
  "the scale reference must not be the same constant as the opening height",
);
// Shrink-to-fit has a floor, and what does not fit scrolls. Without the floor the panel
// answered a short window by rendering slot labels at 6.4px against a designed 12.2px.
assert.match(
  beholderInterfaceSource,
  /BH_CONTENT_MIN_SCALE = 0\.\d+/u,
  "shrinking to fit must stop at a readable floor",
);
assert.match(
  beholderInterfaceSource,
  /bh-content-scrolls/u,
  "and the body must scroll for whatever still does not fit",
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
  `const BH_LOCALES = ${JSON.stringify(clientLocales)};\n` +
  // This preamble mirrors scripts/build-beholder-package.mjs by hand, which is the
  // price of checking staleness independently of the builder. Anything added there has
  // to be added here too, or this fails with a 400 KB diff that says nothing.
  `const BH_PACKAGE_VERSION = ${JSON.stringify(manifest.version)};\n\n` +
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

// ── The local model slot ─────────────────────────────────────────────────────
// The slot silently outranks the agent's configured connection server-side, so the
// UI's one job is to say which model is actually answering and to stop the operator
// pairing the trained model with the wrong prompt. Both are rendered from server
// state, so they are checked here rather than left to a live click-through.
const viewsSource = ["00-prelude.js", "55-sidecar.js", "60-views.js"]
  .map((name) => readFileSync(join(srcDir, name), "utf8"))
  .join("\n");
const loadViews = new Function(
  "fetch",
  `const window = { addEventListener() {} }; const document = { querySelector: () => null, createElement: () => ({ style: {}, classList: { add() {}, toggle() {} }, appendChild() {}, setAttribute() {} }), head: { appendChild() {} } };
   ${viewsSource}
   return BH;`,
) as (fetch: unknown) => {
  views: {
    connectionBanner(args: Record<string, unknown>): string;
    modelSection(args: Record<string, unknown>): string;
    hardwareSection(settings: unknown): string;
  };
  sidecar: { versionLabel(model: unknown): string; MODEL_ID: string };
};
const BH_VIEWS = loadViews(() => Promise.reject(new Error("no network in contract test")));

const INSTALLED = { repo: "GetBeholder/Beholder-GGUF", file: "Beholder-Q8_0.gguf", oid: "abc123def4567890" };

{
  // Served locally: the banner must name the local model, not the agent connection.
  const banner = BH_VIEWS.views.connectionBanner({
    routing: { source: "utility-sidecar" },
    servedLocally: true,
    model: "gpt-5.5",
    installed: INSTALLED,
  });
  assert.match(banner, /local Beholder model/, "a locally served agent must say so");
  assert.ok(
    !/gpt-5\.5/.test(banner),
    "naming the agent connection while the local slot answers would point the operator at the wrong model",
  );
  assert.match(banner, /abc123def456/, "the banner states the installed version");

  // Not served: the banner must name the connection that will answer, and why.
  const remote = BH_VIEWS.views.connectionBanner({
    routing: { source: "agent-connection", reason: "The utility slot is not running." },
    servedLocally: false,
    model: "gpt-5.5",
    installed: INSTALLED,
  });
  assert.match(remote, /agent connection/);
  assert.match(remote, /gpt-5\.5/);
  assert.match(remote, /not running/, "the reason the local model is not answering must be shown");
}

{
  // Version honesty: never imply "current" when the version cannot be read.
  assert.equal(BH_VIEWS.sidecar.versionLabel(null), "not installed");
  assert.equal(BH_VIEWS.sidecar.versionLabel({ oid: null }), "version unknown");
  assert.equal(BH_VIEWS.sidecar.versionLabel(INSTALLED), "abc123def456");
}

{
  // Not installed, no runtime: the install path must warn rather than fail at spawn.
  const fresh = BH_VIEWS.views.modelSection({
    sidecarStatus: { runtimeInstalled: false, settings: null },
    installed: null,
    servedLocally: false,
  });
  assert.match(fresh, /data-model-action="install"/);
  assert.match(fresh, /runtime is not installed/, "a missing runtime has to be surfaced before the download");
  assert.match(fresh, /does not\s+touch or replace/i, "the operator must be told the main sidecar is unaffected");

  // Installed and serving: the action offered is to stop, not to install again.
  const serving = BH_VIEWS.views.modelSection({
    sidecarStatus: { runtimeInstalled: true, settings: { contextSize: 8192, gpuLayers: 0, maxParallelJobs: 1 } },
    installed: INSTALLED,
    servedLocally: true,
  });
  assert.match(serving, /data-model-action="disable"/);
  assert.ok(!/data-model-action="install"/.test(serving), "an installed model must not offer a fresh install");
  assert.match(serving, /serving/);
}

{
  // Hardware only. A sampling control here would let someone quietly break extraction.
  const hw = BH_VIEWS.views.hardwareSection({ contextSize: 8192, gpuLayers: 0, maxParallelJobs: 2 });
  for (const field of ["contextSize", "gpuLayers", "maxParallelJobs"]) {
    assert.ok(hw.includes(`data-hw="${field}"`), `${field} must be operator-controllable`);
  }
  for (const forbidden of ["temperature", "topP", "topK", "top_p", "top_k"]) {
    assert.ok(
      !new RegExp(forbidden, "i").test(hw),
      `${forbidden} must not be exposed — sampling is fixed to what the model was trained with`,
    );
  }
  assert.match(hw, /CPU only/, "the CPU/GPU choice is the point of this section");
  assert.match(hw, /sidecar is not affected/i, "restarting this slot must be distinguished from the main sidecar");

  // The current values must round-trip into the form, or saving silently resets them.
  assert.match(hw, /value="8192"/);
  assert.match(hw, /data-hw="maxParallelJobs"[^>]*value="2"/);
  assert.match(
    BH_VIEWS.views.hardwareSection({ contextSize: 4096, gpuLayers: -1, maxParallelJobs: 1 }),
    /<option value="gpu" selected>/,
    "max-GPU offload must read back as selected",
  );
  assert.match(
    BH_VIEWS.views.hardwareSection({ contextSize: 4096, gpuLayers: 24, maxParallelJobs: 1 }),
    /data-hw="gpuLayers"[^>]*value="24"/,
    "an explicit layer count must read back, not fall to the placeholder",
  );
}

{
  // Server-supplied strings reach markup; a repo name or reason is no more trusted
  // than a prose colour word.
  const hostile = BH_VIEWS.views.connectionBanner({
    routing: { source: "agent-connection", reason: BREAKOUT },
    servedLocally: false,
    model: BREAKOUT,
    installed: { ...INSTALLED, file: BREAKOUT },
  });
  assert.ok(!hostile.includes(BREAKOUT), "the routing reason and model name must be escaped");
  const hostileLocal = BH_VIEWS.views.connectionBanner({
    routing: { source: "utility-sidecar" },
    servedLocally: true,
    model: "",
    installed: { ...INSTALLED, file: BREAKOUT, oid: BREAKOUT },
  });
  assert.ok(!hostileLocal.includes(BREAKOUT), "the model file name and version must be escaped");
}

console.log("beholder client contract: local model slot OK");

// ── The chrome ported so far ─────────────────────────────────────────────────
// Not "parity" — that word was used here while three whole features were missing.
// beholder-parity.regression.ts is the file that measures how much is actually
// ported; this one only checks that what was ported still works.
// The panel shipped with a paper doll and almost none of the controls around it: no
// way to build state from a chat that was already underway, and no way to reach a slot
// the doll does not draw. Both were reported from real use, not from reading the code.
// These assert the controls exist and stay wired, since the stylesheet has always
// carried their design and the markup is what went missing.
const beholderChromeSource = ["50-editor.js", "52-sheet.js", "56-banner.js", "70-backfill.js", "80-dock.js"]
  .map((name) => readFileSync(join(srcDir, name), "utf8"))
  .join("\n");

{
  // Build state from the chat — the control an operator reaches for when they switch
  // Beholder on halfway through and the doll is empty.
  assert.match(beholderChromeSource, /beholder-backfill-btn/u, "the header must offer a build-from-history control");
  assert.match(beholderChromeSource, /beholder-backfill-more/u, "and its more-options caret");
  assert.match(beholderChromeSource, /beholder-backfill-status/u, "with a progress strip");
  for (const mode of ['data-mode="build"', 'data-mode="turn"', 'data-mode="rebuild"']) {
    assert.ok(beholderChromeSource.includes(mode), `the build menu must offer ${mode}`);
  }
  // Every mode is one model call per message. The count is stated first, and cancel
  // has to actually stop the walk rather than just hide the bar.
  assert.match(beholderChromeSource, /window\.confirm\(/u, "a multi-message build must be confirmed before it runs");
  assert.match(beholderChromeSource, /this\.cancelled/u, "and must be cancellable mid-walk");
  assert.match(
    beholderChromeSource,
    /forMessageId/u,
    "a history walk must scope each run to one message, not re-run the latest every time",
  );
}

{
  // The slot sheet: the only route to a slot the doll does not draw.
  assert.match(beholderChromeSource, /bh-digest-edit/u, "the Edit slots button must be wired");
  assert.match(beholderChromeSource, /bh-edit-sheet/u, "and open the sheet");
  assert.match(beholderChromeSource, /bh-pick-slot/u, "which lists slots to pick from");
  assert.match(beholderChromeSource, /bh-slot-picker/u);
  // Regions, so the list is navigable rather than 26 flat rows.
  for (const region of ["Head & Face", "Torso", "Arms & Hands", "Legs & Feet"]) {
    assert.ok(beholderChromeSource.includes(region), `the picker must group slots under ${region}`);
  }
}

{
  // Editor chrome, matched to the reference: it is the surface the operator lives in.
  assert.match(beholderChromeSource, /bhe-cancel/u, "the editor must offer Cancel, not only Apply");
  assert.match(beholderChromeSource, /bh-btn-primary/u, "and mark Apply as the primary action");
  assert.match(beholderChromeSource, /bh-editor-slot/u, "the head must name the character and the slot");
  assert.match(
    beholderChromeSource,
    /cardRect\.top - panelRect\.top - height/u,
    "and flip above a card near the bottom",
  );
  // Dismissal, including the guard that makes removing a row safe.
  assert.match(beholderChromeSource, /key !== "Escape"/u, "Escape must close the editor");
  assert.match(beholderChromeSource, /isConnected === false/u, "a detached target must not read as an outside click");
}

{
  // The local model was invisible to the person it was built for: the slot silently
  // outranks the agent's connection, and the only place that said so was inside a view
  // you had to already know to open. The panel now always states what will answer.
  assert.match(beholderChromeSource, /bh-no-model-banner/u, "the panel must carry a which-model-answers strip");
  assert.match(beholderChromeSource, /BH\.banner\.refresh\(\)/u, "and refresh it with the panel");
  for (const action of ['data-action="install"', 'data-action="enable"', 'data-action="manage"'].map((a) =>
    a.slice(13, -1),
  )) {
    assert.ok(beholderChromeSource.includes(`"${action}"`), `the strip must offer the ${action} action`);
  }
  // An install button that cannot install is worse than no button.
  assert.match(
    beholderChromeSource,
    /runtimeInstalled/u,
    "the strip must not offer a download when the local runtime is missing",
  );
}

console.log("beholder client contract: ported chrome OK");

{
  // Below the narrow breakpoint the stylesheet hides every .beholder-tool-btn and
  // reveals .beholder-tools-more instead. The package rendered the buttons and not the
  // trigger, so on a phone every view was unreachable — asserted together so the pair
  // cannot drift apart again.
  const stylesheet = readFileSync(join(srcDir, "style.css"), "utf8");
  // Whitespace-tolerant: the rule was pinned as a one-line literal and broke the moment
  // prettier reformatted the stylesheet, which says nothing about whether the row hides.
  assert.match(stylesheet, /\.beholder-tool-btn\s*\{\s*display:\s*none;/u, "the narrow layout hides the tool row");
  assert.match(beholderChromeSource, /beholder-tools-more/u, "so the header must render an overflow trigger");
  assert.match(beholderChromeSource, /beholder-tools-menu/u, "that opens a menu");
  // Built from the header's own buttons, so a new view cannot appear in one and not
  // the other.
  assert.match(
    beholderChromeSource,
    /querySelectorAll\("\.beholder-tool-btn\[data-view\]"\)/u,
    "the menu must be built from the header's buttons, not a second hand-kept list",
  );
  assert.match(beholderChromeSource, /openView\(view\)/u, "and both must route through one view dispatcher");
}

{
  // Roster: presentation only, and applied where the panel is drawn so every surface
  // agrees on who is on screen.
  assert.match(beholderChromeSource, /BH\.roster\.arrange\(/u, "the panel must apply the operator's roster");
  assert.match(
    beholderChromeSource,
    /arranged\.visible\.length \? shownState : this\.state/u,
    "hiding everyone must not strand the operator with an empty panel and no way back",
  );
}

console.log("beholder client contract: mobile reachability + roster OK");

// ── The prose check ──────────────────────────────────────────────────────────
// Beholder anchors on one focal character per passage; scripts and scenes that narrate
// several people at once are outside what it does. Telling someone that is better than
// leaving them with an empty panel — but only if the detector is right, so this pins
// the two claims the code makes.
//
// Fixtures are written here rather than lifted from the evaluation corpus: that corpus
// is private, and a public test is exactly the wrong place for it.
const proseSource = readFileSync(join(srcDir, "72-prose.js"), "utf8");
const vocabSource = readFileSync(join(srcDir, "11-garment-vocab.js"), "utf8");
const loadProse = new Function(`const BH = {}; ${vocabSource}\n${proseSource}; return BH.prose;`) as () => {
  isScript(text: string): boolean;
  describesState(text: string): boolean;
};
const prose = loadProse();

{
  const scripts = [
    "INT. BEDROOM - NIGHT\nA radio plays. She crosses to the window and pulls the curtain back.",
    "The camera holds on the doorway.\nCUT TO: the hallway, empty, the coat still on its hook.",
    "MARGOT\nYou said you'd be here at six.\n\nDANIEL\n(quietly)\nI said I'd try.",
  ];
  for (const [index, text] of scripts.entries()) {
    assert.ok(prose.isScript(text), `script fixture ${index} must be recognised as a script`);
  }

  // Ordinary roleplay, including the shapes that could trip a naive detector: a single
  // shouted line, in-character caps, and asterisked action.
  const notScripts = [
    "Maggie shrugged the cloak off her shoulders and hung it by the door. The cut on her forearm had stopped bleeding, though the sleeve was ruined.",
    'She rounded on him. "STOP!"\nThe word cracked across the yard and he froze with the lantern still raised.',
    "*breathes calmly* I'm fine. Really.",
    "Caelvir sat at one end of the long table. The distance between them was deliberate, and he let it sit there while the servants poured.",
    "OOC: sorry for the delay!\nShe steps through the gate, boots loud on the wet stone.",
  ];
  for (const [index, text] of notScripts.entries()) {
    assert.ok(!prose.isScript(text), `roleplay fixture ${index} must not be flagged as a script`);
  }

  // Vocabulary gates the warning. Length does not: a long turn of pure dialogue has
  // nothing to extract, and warning that Beholder "found nothing" in it would be noise.
  assert.equal(
    prose.describesState("She nods. They talk for a while about the weather, and about nothing much at all."),
    false,
    "a turn that mentions no clothing or injury does not describe extractable state",
  );
  assert.equal(prose.describesState("He shrugged the cloak off his shoulders."), true, "a garment does");
  assert.equal(prose.describesState("The gash on her arm had stopped bleeding."), true, "an injury does");
}

{
  // The code must not claim to detect omniscient narration. Every shape-based attempt
  // measured at chance against the register corpus — about one ordinary roleplay
  // passage in five false-flagged for the same catch rate — so the honest signal is
  // low yield, which reports what happened instead of guessing why.
  assert.ok(
    !/omniscient/i.test(proseSource.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "")),
    "the prose check must not classify narration as omniscient outside its comments",
  );
  assert.match(proseSource, /described-but-unread/u, "it reports what it observed instead");
  // The gate is the vocabulary, not word count — length says nothing about whether a
  // passage has any physical state in it.
  assert.ok(!/isSubstantial/u.test(proseSource), "word count must not gate the warning");
  assert.match(proseSource, /describing >= 3/u, "and one turn is not enough to conclude from");
  // Matched loosely: the requirement is that the large-model option is named as
  // unsupported, not that it is worded a particular way — the copy gets rewritten for
  // readability and the test should not fight that.
  assert.match(proseSource, /(not support|unsupported)/u, "the large-model alternative must be named as unsupported");
  assert.match(proseSource, /staying on your computer/u, "and the privacy cost of taking it must be stated");
}

console.log("beholder client contract: prose check OK");

{
  // The boundary is stated to everyone on the empty panel, which is the screen a new
  // user looks at and the one where "this is broken" gets decided. Detection cannot
  // carry this: classifying multi-character narration by shape measured 42% catch at
  // 4% false alarm once period-style markers (semicolons, honorifics) were removed —
  // and those markers were carrying half the signal, so the classifier was largely
  // recognising Victorian prose rather than omniscient prose. Saying it up front
  // reaches 100% of users with no false alarms at all.
  const dollSource = readFileSync(join(srcDir, "30-paperdoll.js"), "utf8");
  assert.match(dollSource, /bh-placeholder-scope/u, "the empty panel must state what Beholder reads");
  // Worded to match what the model actually does. An earlier draft said "one focal
  // character per passage", which reads as "cannot do multiple characters" — the
  // opposite of true: attribution measures 0.95 across the supported registers, and
  // keeping characters apart is a trained, first-class capability. The boundary is the
  // missing point of view, not the number of people in the scene.
  // Checked by meaning, not by sentence: the note must say Beholder handles everyone in
  // the scene, and must locate the limit in whose view the writing follows rather than
  // in how many people are in it.
  assert.match(dollSource, /every character in the scene/u, "must not undersell multi-character tracking");
  assert.match(dollSource, /one person at a time/u, "the limit is whose view the writing follows");
  assert.ok(!/one focal character/u.test(dollSource), "the misleading phrasing must not come back");
  assert.match(dollSource, /script/u, "and the script case");
  assert.match(beholderChromeSource, /bh-scope-more/u, "with a route to the full explanation");
}

console.log("beholder client contract: stated scope OK");
