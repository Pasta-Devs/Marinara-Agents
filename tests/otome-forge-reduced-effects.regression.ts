// Otome Hearth honours the Engine's "Reduce Ambient Animations & Effects" (<html data-marinara-reduced-effects="true">)
// as it honours prefers-reduced-motion (Marinara-Agents#1997, Home flickering in Samsung Internet). Nothing in the
// client asks the system on its own: every reduced rule goes through reducedRules, which writes it under both, and
// useReducedMotion reads both through reducedFrom. The flag also drops every backdrop blur, the glass's through
// --of-glass-blur, and the glass takes the solid surface of the no-blur fallback.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  REDUCED_EFFECTS,
  reducedFrom,
  reducedRules,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/reduced-motion.ts";

const client = join(
  dirname(fileURLToPath(import.meta.url)),
  "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge",
);
/** Every client source, with `${R}` and `${REDUCED_EFFECTS}` read as the selectors they stand for. */
const sources = readdirSync(client, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.tsx?$/u.test(file))
  .map((file) => ({
    file,
    text: readFileSync(join(client, file), "utf8")
      .replaceAll("${R}", ".of-root")
      .replaceAll("${REDUCED_EFFECTS}", REDUCED_EFFECTS),
  }));

test("only lib/reduced-motion.ts names the system's query: stylesheets and hooks go through it", () => {
  const own = sources.filter(
    ({ file, text }) => file !== "lib/reduced-motion.ts" && /prefers-reduced-motion\s*:/u.test(text),
  );
  assert.deepEqual(
    own.map(({ file }) => file),
    [],
  );
  const reader = sources.find(({ file }) => file === "hooks/use-reader.ts")!.text;
  assert.match(reader, /reducedFrom\(/u);
  assert.match(reader, /attributeFilter: \[REDUCED_EFFECTS_ATTRIBUTE\]/u);
  // The claw machine is play, not decoration: it follows only the system, as the Engine's own games do.
  const claw = sources.find(({ file }) => file === "screens/dates/ClawMachine.tsx")!.text;
  assert.match(claw, /useReducedMotion\(\{ ambient: false \}\)/u);
  assert.match(claw, /<MotionConfig reducedMotion="user">/u);
  assert.match(reader, /ambient \? document\.documentElement\.dataset : undefined/u);
});

test("reducedRules writes each rule under the system's query and under the Engine's flag", () => {
  const css = reducedRules(
    (root) => `\n${root} .a { animation: none; }\n${root}, ${root} * { transition: none !important; }`,
  );
  assert.equal(
    css,
    [
      "@media (prefers-reduced-motion: reduce) {",
      ".of-root .a { animation: none; }",
      ".of-root, .of-root * { transition: none !important; }",
      "}",
      "",
      'html[data-marinara-reduced-effects="true"] .of-root .a { animation: none; }',
      'html[data-marinara-reduced-effects="true"] .of-root, html[data-marinara-reduced-effects="true"] .of-root * { transition: none !important; }',
    ].join("\n"),
  );
});

test("useReducedMotion's reading: the system's query or the Engine's flag", () => {
  assert.equal(reducedFrom(false, undefined), false);
  assert.equal(reducedFrom(false, {}), false);
  assert.equal(reducedFrom(false, { marinaraReducedEffects: "false" }), false);
  assert.equal(reducedFrom(false, { marinaraReducedEffects: "true" }), true);
  assert.equal(reducedFrom(true, {}), true);
});

test("the Engine's flag drops every backdrop blur, and glass turns solid", () => {
  const css = sources.map(({ text }) => text).join("\n");
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  assert.ok(css.includes(`${REDUCED_EFFECTS} .of-root { --of-glass-blur: none; }`), "glass blur off under the flag");
  assert.ok(
    css.includes(`:where(${REDUCED_EFFECTS}) .of-root .of-glass { background: var(--of-surface-solid); }`),
    "glass takes the solid surface under the flag",
  );
  // A blur that is not the glass's own: its rule is reset under the flag.
  const fixed: string[] = [];
  for (const { file, text } of sources) {
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (line.trimStart().startsWith("@supports")) return;
      if (!/backdrop-filter:(?!\s*(?:var\(--of-glass-blur\)|none))/u.test(line)) return;
      let start = index;
      while (start > 0 && !/(?:^|[^$])\{/u.test(lines[start]!)) start -= 1;
      const selector = lines[start]!.slice(0, lines[start]!.search(/(?:^|[^$])\{/u) + 1).trim();
      fixed.push(selector);
      assert.match(
        css,
        new RegExp(`${escape(`${REDUCED_EFFECTS} ${selector}`)}[,\\s][^{]*\\{[^}]*\\bbackdrop-filter: none;`, "u"),
        `${file}: ${selector} keeps its blur under the flag`,
      );
    });
  }
  assert.ok(fixed.length > 0, "the stylesheet's fixed blurs were found");
});

test("the Engine's ambient setting spares the claw machine's game feedback but stops its idle loops", () => {
  const styles = sources.find(({ file }) => file === "theme/styles.ts")!.text;
  assert.match(styles, /\*:not\(\.of-claw, \.of-claw \*\)/u, "the Engine-only stop rule skips the claw machine");
  // Its three idle loops: the marquee bulbs, the live meter's hearts and the current turn's pip.
  assert.match(
    styles,
    /\$\{root\} \.of-claw-bulbs, \$\{root\} \.of-claw-hearts, \$\{root\} \.of-claw-pip\[data-state="current"\] \{\s*animation: none !important;/u,
  );
  const css = reducedRules((root, engine) => (engine ? `${root} .engine {}` : `${root} .system {}`));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\.of-root \.system \{\}/u, "the system copy");
  assert.match(css, /html\[data-marinara-reduced-effects="true"\] \.of-root \.engine \{\}$/u, "the Engine copy");
});
