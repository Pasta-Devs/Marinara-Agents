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
// Only contexts that PUT a class on an element. `classList.remove`, `classList.contains`
// and every selector are lookups: they name a class without rendering it, and counting
// them meant a class the package only ever removes or searches for — `bh-detached` and
// `bh-dock-open` among them — was reported as rendered. That is the same false comfort
// as substring matching, arriving by a different route.
const CLASS_CONTEXTS = [
  /\bclassName\s*(?:=|\+=|:)\s*["'`]([^"'`]*)["'`]/g,
  /\bclassList\s*\.\s*(?:add|toggle)\s*\(([^)]*)\)/g,
  // replace(old, new) renders only its second argument.
  /\bclassList\s*\.\s*replace\s*\([^,]*,\s*["'`]([^"'`]*)["'`]/g,
];

/** Finds `class=` and returns each attribute's raw value. */
function classAttributeValues(source) {
  // Scanned rather than matched. A class attribute written inside a template literal
  // routinely reads `class="bh-ls-opt${on ? " bh-ls-active" : ""}"`, where the inner
  // quotes belong to the conditional and not to the attribute — so the scanner has to
  // step over `${...}` to find the real closing quote.
  //
  // A regex that expressed the same idea needed alternatives that both began at `$`,
  // and CodeQL was right to call it: overlapping alternatives under a star backtrack
  // exponentially on input like `${{}}${{}}…`. This walks each character exactly once
  // and cannot, which is easier to be sure of than a cleverer pattern.
  const values = [];
  const opener = /\bclass\s*=\s*(["'`])/g;
  let found;
  while ((found = opener.exec(source)) !== null) {
    const quote = found[1];
    let i = opener.lastIndex;
    let value = "";
    while (i < source.length) {
      const ch = source[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) break;
      if (ch === "$" && source[i + 1] === "{") {
        // Skip the interpolation, tracking nesting so a `}` inside an object literal
        // does not end it early.
        let depth = 0;
        i += 1;
        while (i < source.length) {
          if (source[i] === "{") depth += 1;
          else if (source[i] === "}" && --depth === 0) {
            i += 1;
            break;
          }
          i += 1;
        }
        // The interpolation may itself carry class names; keep them.
        value += " ";
        continue;
      }
      value += ch;
      i += 1;
    }
    values.push(source.slice(found.index, i));
    opener.lastIndex = Math.max(i, opener.lastIndex);
  }
  return values;
}

/** Beholder class tokens in a blob of source, read only from class contexts. */
export function classTokens(source) {
  const tokens = new Set();
  const chunks = [...classAttributeValues(source)];
  for (const pattern of CLASS_CONTEXTS) {
    for (const match of source.matchAll(pattern)) chunks.push(match[1] ?? "");
  }
  for (const chunk of chunks) {
    for (const token of chunk.match(/(?:bh|beholder)-[a-z0-9-]*/g) ?? []) {
      // A lone prefix like `bh-` carries no information about what is rendered.
      if (token.length > 4) tokens.add(token);
    }
  }
  return tokens;
}
