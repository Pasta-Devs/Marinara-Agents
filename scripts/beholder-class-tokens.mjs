// One way of reading class names, shared by the surface generator and the parity test.
//
// They used to do it differently, and both ways were wrong in their own direction.
//
// The generator pulled names out of the reference's `class="..."` attributes but read
// only the checkout's root and one named subdirectory, so anything nested deeper was
// silently absent from the surface rather than reported as missing.
//
// The test then asked whether the package's source merely CONTAINED that string.
// Substring matching says yes too often: `bh-con` is inside `bh-conn`, `bh-help` is
// inside `bh-help-list`, `bh-pro` is inside `bh-prompt`. Three classes were reported as
// rendered on that basis while nothing rendered them — a parity number built on exactly
// the kind of false comfort this measurement exists to remove.
//
// Both sides now read class CONTEXTS and compare whole tokens. Contexts matter: a bare
// `bh-[a-z-]+` scan over source also collects `var(--bh-gold)` and every other custom
// property, which are not classes and cannot be "rendered" by anyone. Whole tokens
// matter because of the substring problem above.
//
// Dynamic names survive it. The reference writes `bh-msg-${kind}` and so does the
// package; both yield the literal prefix `bh-msg-`, so they match each other honestly
// without either pretending to know the suffixes.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Every file under `dir` with one of `extensions`, depth-first, sorted for stability. */
export function collectFiles(dir, extensions = [".js"]) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    // node_modules and dot-directories are never part of a source surface.
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectFiles(full, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) found.push(full);
  }
  return found;
}

/** The concatenated text of every matching file under `dir`. */
export function readSource(dir, extensions = [".js"]) {
  return collectFiles(dir, extensions)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

/**
 * Places a class name can legitimately be written.
 *
 * Not just `class="..."`: this package sets names through `className`, `classList` and
 * template literals, and a matcher that only knew about the attribute would report
 * ordinary code as missing. Anything outside these contexts — a CSS custom property, a
 * comment, a stray string — is not a class and is not collected.
 */
const CLASS_CONTEXTS = [
  // Interpolation is allowed inside the value, and is tried FIRST. A class attribute
  // written inside a template literal routinely reads
  // `class="bh-ls-opt${on ? " bh-ls-active" : ""}"`, and the quotes belong to the
  // conditional rather than to the attribute. Matching character by character walks
  // into the interpolation and stops at one of those quotes, so the conditional class
  // is never read and something plainly rendered is reported as missing.
  /\bclass\s*=\s*"((?:\$\{[^}]*\}|\\.|[^"\\])*)"/g,
  /\bclass\s*=\s*'((?:\$\{[^}]*\}|\\.|[^'\\])*)'/g,
  /\bclass\s*=\s*`((?:\$\{[^}]*\}|\\.|[^`\\])*)`/g,
  /\bclassName\s*(?:=|\+=|:)\s*["'`]([^"'`]*)["'`]/g,
  /\bclassList\s*\.\s*(?:add|remove|toggle|contains|replace)\s*\(([^)]*)\)/g,
  // Selectors, which name the same classes the package renders.
  /\b(?:querySelector|querySelectorAll|closest|matches)\s*\(\s*["'`]([^"'`]*)["'`]/g,
];

/** Beholder class tokens in a blob of source, read only from class contexts. */
export function classTokens(source) {
  const tokens = new Set();
  for (const pattern of CLASS_CONTEXTS) {
    for (const match of source.matchAll(pattern)) {
      for (const token of (match[1] ?? "").match(/(?:bh|beholder)-[a-z0-9-]*/g) ?? []) {
        // A lone prefix like `bh-` carries no information about what is rendered.
        if (token.length > 4) tokens.add(token);
      }
    }
  }
  return tokens;
}
