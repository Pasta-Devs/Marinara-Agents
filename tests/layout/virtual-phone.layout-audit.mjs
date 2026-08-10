/**
 * Layout audit for the Virtual Phone.
 *
 * Renders representative screens in headless Chromium and reports the things that look wrong
 * rather than break: controls covering each other, elements past the screen edge, text clipped by
 * its own box, controls almost touching, and tap targets too small to hit. Screenshots only catch
 * these when someone looks closely at the right screen; this does not need anyone to look.
 *
 * Needs a Chromium and its libraries, so it is deliberately not part of the regression suite:
 *
 *   CHROME=/path/to/chrome-headless-shell node tests/layout/virtual-phone.layout-audit.mjs
 *
 * Exits non-zero with a list when it finds something, and prints CLEAN when it does not.
 */
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const work = mkdtempSync(join(tmpdir(), "vp-layout-"));
const engineRoot = process.env.MARINARA_ENGINE_ROOT || "/home/dev/projects/Marinara-Engine";
const eb = join(engineRoot, "node_modules/.bin/esbuild");
execSync(`${eb} ${join(repo, "packages/virtual-phone/src/phone/device/styles.ts")} --bundle --platform=node --format=esm --outfile=${join(work, "styles.mjs")}`);
execSync(`${eb} ${join(repo, "packages/virtual-phone/src/phone/device/theme.ts")} --bundle --platform=node --format=esm --outfile=${join(work, "theme.mjs")}`);
const { phoneStylesheet } = await import(join(work, "styles.mjs"));
const { phoneThemeTokens } = await import(join(work, "theme.mjs"));
const tok = (t) => Object.entries(phoneThemeTokens(t)).map(([k, v]) => `${k}:${v}`).join(";");
// Screens are taken from the mock harnesses already written this session.
const { screens } = await import(join(here, "virtual-phone.screens.mjs"));
const frames = screens.map((s) => `<div class="vp-root" data-screen="${s.name}" style="position:static;${tok(s.theme || "dark")}"><div class="frame vp-screen">${s.html}</div></div>`).join("");
const audit = `
const findings = [];
const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05; };
const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.top + a.height - 0 + 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
for (const root of document.querySelectorAll("[data-screen]")) {
  const screen = root.dataset.screen;
  const add = (kind, detail) => findings.push(screen + " | " + kind + " | " + detail);
  const frame = root.querySelector(".vp-screen").getBoundingClientRect();
  const label = (el) => (el.getAttribute("aria-label") || el.className || el.tagName).toString().slice(0, 48).trim();
  const controls = [...root.querySelectorAll("button, input, textarea, select, a")].filter(visible);
  // 1. Interactive things sitting on top of each other.
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue;
      const a = controls[i].getBoundingClientRect(), b = controls[j].getBoundingClientRect();
      // A button deliberately placed inside a field (the search Go) is not an overlap bug.
      const insideField = [controls[i], controls[j]].some((el) => getComputedStyle(el).position === "absolute");
      if (!insideField && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) {
        add("OVERLAP", label(controls[i]) + " over " + label(controls[j]));
      }
    }
  }
  // 2. Anything sticking out of the screen.
  for (const el of [...root.querySelectorAll("*")].filter(visible)) {
    const r = el.getBoundingClientRect();
    if (r.right > frame.right + 1 || r.left < frame.left - 1 || r.bottom > frame.bottom + 1) {
      const s = getComputedStyle(el);
      if (s.position === "fixed") continue;
      add("OUTSIDE", label(el) + " extends past the screen edge");
    }
  }
  // 3. Text cut off by its own box.
  for (const el of [...root.querySelectorAll("*")].filter(visible)) {
    const s = getComputedStyle(el);
    if (s.overflow === "hidden" && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0
        && !el.className.toString().includes("clamp") && s.webkitLineClamp === "none" && el.children.length === 0) {
      add("CLIPPED", label(el) + " text is taller than its box");
    }
  }
  // 4. Controls almost touching.
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue;
      const a = controls[i].getBoundingClientRect(), b = controls[j].getBoundingClientRect();
      const vGap = b.top - a.bottom, hGap = b.left - a.right;
      const sameCol = Math.abs(a.left - b.left) < 8 && vGap >= 0 && vGap < 3;
      const sameRow = Math.abs(a.top - b.top) < 8 && hGap >= 0 && hGap < 3;
      const grouped = controls[i].parentElement === controls[j].parentElement && controls[i].closest(".vp-list, .vp-group, .vp-lore-list, .vp-gallery-grid, .vp-notes-grid, .vp-site-grid, .vp-image-grid");
      if (!grouped && (sameCol || sameRow)) add("TOUCHING", label(controls[i]) + " and " + label(controls[j]) + " gap " + Math.round(sameCol ? vGap : hGap) + "px");
    }
  }
  // 5. Controls buried under something else — the check that catches a panel drawn over a field.
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    if (top && top !== el && !el.contains(top) && !top.contains(el)) {
      add("COVERED", label(el) + " is under " + label(top));
    }
  }
  // 6. Tap targets too small to hit.
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if ((r.height < 22 || r.width < 22) && !el.matches("input, textarea, select")) {
      add("SMALL-TARGET", label(el) + " " + Math.round(r.width) + "x" + Math.round(r.height));
    }
  }
}
const out = document.createElement("pre");
out.id = "audit";
out.textContent = findings.length ? findings.join("\\n") : "CLEAN";
document.body.appendChild(out);
`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*,*::before,*::after{animation:none !important}
body{margin:0;background:#20242b;display:flex;flex-wrap:wrap;gap:14px;padding:14px;font-family:system-ui}
.frame{position:relative;width:300px;height:620px;border-radius:43px;overflow:hidden}
${phoneStylesheet}</style></head><body>${frames}<script>${audit}<\/script></body></html>`;
const page = join(work, "audit.html");
writeFileSync(page, html);

const chrome = process.env.CHROME
  || `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`;
const dom = execSync(
  `${chrome} --no-sandbox --disable-gpu --hide-scrollbars --virtual-time-budget=2000 --dump-dom ${page}`,
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 },
);
const report = /<pre id="audit">([\s\S]*?)<\/pre>/u.exec(dom)?.[1] ?? "";
const findings = report.replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&").trim();
if (!findings || findings === "CLEAN") {
  console.log(`Virtual Phone layout audit clean across ${screens.length} screens.`);
  process.exit(0);
}
console.error(findings);
console.error(`\n${findings.split("\n").length} layout findings.`);
process.exit(1);
