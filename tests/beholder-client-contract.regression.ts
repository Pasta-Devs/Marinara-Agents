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
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const packageRoot = join(repoRoot, "packages/beholder");
const srcDir = join(packageRoot, "src");

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

// ── Fixture: one character per rendering branch ──────────────────────────────
const STATE = {
  Maggie: {
    species: "human",
    body: {
      torso: { worn: [{ item: "blouse", color: "white", damage: "torn" }], bare: false },
      legs: { worn: [{ item: "trouser", color: "black" }] },
      left_foot: { worn: [{ item: "boot", color: "brown", damage: "scuffed" }] },
      right_foot: { worn: [], bare: true },
      head: { wounds: [{ type: "cut", severity: "moderate", bleeding: true }] },
      left_hand: { holding: [{ item: "lantern" }] },
      right_arm: { missing: true },
    },
  },
  Kheza: {
    species: "naga",
    body: {
      torso: { worn: [{ item: "harness", color: "crimson", damage: "pristine" }] },
      tail: { bare: true },
      head: { worn: [{ item: "circlet", color: "gold" }] },
      right_hand: { holding: [{ item: "spear" }, { item: "torch" }] },
    },
  },
};

// Markup digests produced by the extension's renderer for the fixture above.
const EXPECTED_RENDER = {
  "paired/front": "265cc2a62c3aed2f",
  "paired/back": "f56d1f04688a4165",
  "columns/front": "61dce444cfad6cba",
  "columns/back": "3903121d72e85c92",
  "list/front": "406aba438e113932",
  "list/back": "9b3f318026967a3f",
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

assert.equal(manifest.entrypoints.client, "client.js", "manifest must declare the client entrypoint");
assert.ok(
  manifest.contributions?.slots?.includes("conversation-toolbar"),
  "manifest must contribute to the roleplay toolbar",
);
assert.ok(manifest.permissions.includes("ui"), "a client-bearing package needs the ui permission");

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

// Every source module must be in the bundle, so a new module cannot be silently
// left out of a build.
for (const name of readdirSync(srcDir).filter((file) => file.endsWith(".js"))) {
  assert.ok(client.includes(`// ===== ${name} =====`), `client bundle is missing ${name} — rebuild the package`);
}

// Shipped bytes must match the manifest, or installs fail their integrity check.
for (const entry of manifest.files) {
  const buffer = readFileSync(join(packageRoot, entry.path));
  assert.equal(sha256(buffer), entry.sha256, `${entry.path} hash does not match the manifest — rebuild the package`);
  assert.equal(buffer.byteLength, entry.bytes, `${entry.path} size does not match the manifest — rebuild the package`);
}

console.log("beholder client contract: renderer snapshots + bundle contract OK");
