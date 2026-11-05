// ──────────────────────────────────────────────
// Story Writer: theme tokens and the shell's stylesheet (stage, sidebar, sticky note, action bar)
// ──────────────────────────────────────────────
// Plain CSS, scoped under the package's element. The root carries data-sw-theme / data-sw-mode / data-sw-sidebar /
// data-sw-note; the reading tokens (--sw-ink, --sw-page-bg, ...) are set inline by storyThemeVariables because the
// texture URLs carry the package version. Layout follows the root's own size (container queries), not the window:
// the Engine may show its sidebar next to the tab.
import { STORY_WRITER_ASSETS, type StoryWriterAsset } from "./assets";
import type { StoryTheme } from "./model";

export type ResolvedColorMode = "light" | "dark";

export const BOOK_FONT_STACK = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, ui-serif, serif`;
export const EBOOK_FONT_STACK = `Georgia, "Iowan Old Style", ui-serif, serif`;
const FONT_PRESETS: Record<string, string> = {
  "@serif": `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`,
  "@sans": "ui-sans-serif, system-ui, sans-serif",
  "@mono": "ui-monospace, SFMono-Regular, Menlo, monospace",
  "@app": "var(--font-user, Inter), system-ui, sans-serif",
};

interface ThemeTokens {
  ink: string;
  inkMuted: string;
  accent: string;
  pageColor: string;
  paper: StoryWriterAsset | null;
  pageEdge: string;
  bezel: string;
  panelBg: string;
  panelFg: string;
  panelBorder: string;
  stage(wood: string): string;
}

const THEME_TOKENS: Record<StoryTheme, Record<ResolvedColorMode, ThemeTokens>> = {
  book: {
    light: {
      ink: "#2b2118",
      inkMuted: "#6f5a44",
      accent: "#8a3b12",
      pageColor: "#efe2c6",
      paper: STORY_WRITER_ASSETS.paperLight,
      pageEdge: "#a88a5c",
      bezel: "#5a3a22",
      panelBg: "#f2e5c6",
      panelFg: "#3a2a1b",
      panelBorder: "rgba(90, 50, 20, 0.35)",
      stage: (wood) =>
        `radial-gradient(ellipse 70% 60% at 50% 42%, rgba(255, 214, 150, 0.14), transparent 70%), radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.45) 100%), url("${wood}") center / cover no-repeat, #3b2718`,
    },
    dark: {
      ink: "#e9dcc3",
      inkMuted: "#b3a184",
      accent: "#e0a060",
      pageColor: "#2a2420",
      paper: STORY_WRITER_ASSETS.paperDark,
      pageEdge: "#0d0907",
      bezel: "#1a0f08",
      panelBg: "#261810",
      panelFg: "#eedcbc",
      panelBorder: "rgba(224, 160, 96, 0.22)",
      stage: (wood) =>
        `radial-gradient(ellipse 60% 50% at 50% 42%, rgba(255, 190, 110, 0.07), transparent 70%), linear-gradient(rgba(6, 4, 2, 0.58), rgba(6, 4, 2, 0.58)), radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.6) 100%), url("${wood}") center / cover no-repeat, #120c08`,
    },
  },
  ebook: {
    light: {
      ink: "#1f1f1f",
      inkMuted: "#6a6a6a",
      accent: "#2f5fc4",
      pageColor: "#f5f2ea",
      paper: null,
      pageEdge: "#1d1d20",
      bezel: "#1d1d20",
      panelBg: "rgba(248, 248, 250, 0.95)",
      panelFg: "#1f1f22",
      panelBorder: "rgba(17, 17, 20, 0.1)",
      stage: () => "radial-gradient(120% 90% at 50% 0%, #f7f7f9 0%, #e2e3e7 55%, #cbccd2 100%)",
    },
    dark: {
      ink: "#d8d4cb",
      inkMuted: "#8e8a82",
      accent: "#8ab4f8",
      pageColor: "#16171a",
      paper: null,
      pageEdge: "#050506",
      bezel: "#050506",
      panelBg: "rgba(22, 23, 27, 0.96)",
      panelFg: "#ece9e2",
      panelBorder: "rgba(255, 255, 255, 0.08)",
      stage: () => "radial-gradient(120% 90% at 50% 0%, #1d1e22 0%, #0e0e11 60%, #050506 100%)",
    },
  },
};

/** The theme's own text color, for the font color picker's starting value. */
export function themeInkColor(theme: StoryTheme, mode: ResolvedColorMode): string {
  return THEME_TOKENS[theme][mode].ink;
}

/** The reading font stack for a preference value ("" = the theme's font, "@…" = a preset, else a family name). */
export function readingFontStack(fontFamily: string, theme: StoryTheme): string {
  const fallback = theme === "book" ? BOOK_FONT_STACK : EBOOK_FONT_STACK;
  if (!fontFamily) return fallback;
  const preset = FONT_PRESETS[fontFamily];
  if (preset) return preset;
  // The name reaches CSS through a custom property: keep it to one quoted family.
  const family = fontFamily.replace(/["\\;{}<>]/g, "").trim();
  return family ? `"${family}", ${fallback}` : fallback;
}

export function storyThemeVariables(input: {
  theme: StoryTheme;
  mode: ResolvedColorMode;
  fontFamily: string;
  fontColor: string;
  fontSize: number;
  assetUrl: (file: StoryWriterAsset) => string;
}): Record<string, string> {
  const tokens = THEME_TOKENS[input.theme][input.mode];
  const pageBg = tokens.paper
    ? `url("${input.assetUrl(tokens.paper)}") center / 100% 100% no-repeat, ${tokens.pageColor}`
    : tokens.pageColor;
  return {
    "--sw-ink": input.fontColor || tokens.ink,
    "--sw-ink-muted": input.fontColor ? `color-mix(in srgb, ${input.fontColor} 62%, transparent)` : tokens.inkMuted,
    "--sw-accent": tokens.accent,
    "--sw-page-bg": pageBg,
    "--sw-page-color": tokens.pageColor,
    "--sw-page-edge": tokens.pageEdge,
    "--sw-bezel": tokens.bezel,
    "--sw-stage-bg": tokens.stage(input.assetUrl(STORY_WRITER_ASSETS.wood)),
    "--sw-panel-bg": tokens.panelBg,
    "--sw-panel-fg": tokens.panelFg,
    "--sw-panel-border": tokens.panelBorder,
    "--sw-font": readingFontStack(input.fontFamily, input.theme),
    "--sw-font-size": `${input.fontSize}px`,
    "--sw-ui-font": "var(--font-y2k, system-ui)",
  };
}

const R = "marinara-capability-story-writer";
/** The Engine's mobile shell query: phones, and touch tablets up to 1440 px. */
const MOBILE_QUERY = "(max-width: 767px), (max-width: 1440px) and (hover: none) and (any-pointer: coarse)";
/** The Engine shell already keeps Home below the status bar and clear of a sideways phone's camera;
 *  only the bottom edge reaches the home indicator. */
const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0px)";
const HAND_FONT = `"Bradley Hand", "Segoe Print", "Chalkboard SE", "Comic Sans MS", cursive`;

// Control colors per theme and mode. The reading tokens above are inline; these only style the shell.
const THEME_RULES = `
${R} .sw-root[data-sw-theme="book"] {
  --sw-heading-font: ${BOOK_FONT_STACK};
}
${R} .sw-root[data-sw-theme="ebook"] {
  --sw-heading-font: var(--sw-ui-font);
  --sw-panel-texture: linear-gradient(transparent, transparent);
  --sw-header-bg: transparent;
}
${R} .sw-root[data-sw-theme="book"][data-sw-mode="light"] {
  --sw-panel-muted: #7a6650;
  --sw-panel-texture: radial-gradient(120% 60% at 0% 0%, rgba(255, 255, 255, 0.55), transparent 60%),
    radial-gradient(90% 50% at 100% 100%, rgba(150, 100, 40, 0.16), transparent 70%),
    repeating-linear-gradient(0deg, rgba(120, 80, 30, 0.025) 0 2px, transparent 2px 4px);
  --sw-header-bg: linear-gradient(180deg, #70401f 0%, #4b2512 100%);
  --sw-header-fg: #f2d9a2;
  --sw-heading-fg: #4a2a14;
  --sw-field-bg: rgba(255, 252, 242, 0.78);
  --sw-field-border: rgba(120, 78, 38, 0.3);
  --sw-field-fg: #2e2117;
  --sw-placeholder: rgba(80, 58, 36, 0.45);
  --sw-control-bg: rgba(255, 250, 236, 0.55);
  --sw-control-hover: rgba(255, 246, 222, 0.95);
  --sw-control-border: rgba(120, 78, 38, 0.32);
  --sw-segment-bg: rgba(120, 78, 38, 0.08);
  --sw-segment-active-bg: #fffaf0;
  --sw-segment-active-fg: #5a2a10;
  --sw-switch-off: rgba(120, 78, 38, 0.2);
  --sw-section-border: rgba(120, 78, 38, 0.2);
  --sw-on-accent: #fff6e8;
  --sw-primary-bg: linear-gradient(180deg, #a84d1f 0%, #7b3311 100%);
  --sw-primary-fg: #fff3de;
  --sw-stop-bg: linear-gradient(180deg, #8f2a1d 0%, #64170e 100%);
  --sw-stop-fg: #fff3de;
  --sw-bar-bg: linear-gradient(180deg, rgba(78, 43, 22, 0.95), rgba(48, 25, 12, 0.96));
  --sw-bar-fg: #f6e5c4;
  --sw-bar-muted: rgba(246, 229, 196, 0.7);
  --sw-bar-border: rgba(222, 182, 110, 0.38);
  --sw-bar-hover: rgba(255, 228, 170, 0.12);
  --sw-accent-on-bar: #f0b56f;
  --sw-handle-bg: linear-gradient(90deg, #5a2f18 0%, #7b4426 60%, #6a391e 100%);
  --sw-handle-fg: #f3d69c;
  --sw-handle-border: rgba(30, 14, 5, 0.6);
  --sw-leather: #6a391e;
  --sw-leather-dark: #3e1f0f;
  --sw-stitch: rgba(240, 205, 140, 0.55);
  --sw-note-bg: linear-gradient(172deg, #fff8bf 0%, #fbe68c 58%, #f3d466 100%);
  --sw-note-fg: #3d3112;
  --sw-note-shadow: rgba(30, 18, 4, 0.55);
  --sw-note-line: rgba(140, 100, 20, 0.22);
  --sw-scrim: rgba(18, 9, 3, 0.5);
  --sw-message-fg: #f3e3c3;
  --sw-danger: #a3271a;
}
${R} .sw-root[data-sw-theme="book"][data-sw-mode="dark"] {
  --sw-panel-muted: #b39a7a;
  --sw-panel-texture: radial-gradient(120% 60% at 0% 0%, rgba(255, 210, 150, 0.07), transparent 60%),
    radial-gradient(90% 60% at 100% 100%, rgba(0, 0, 0, 0.35), transparent 70%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.012) 0 2px, transparent 2px 5px);
  --sw-header-bg: linear-gradient(180deg, #3d2213 0%, #24130a 100%);
  --sw-header-fg: #e9c98d;
  --sw-heading-fg: #f0d9b0;
  --sw-field-bg: rgba(10, 6, 3, 0.35);
  --sw-field-border: rgba(224, 160, 96, 0.24);
  --sw-field-fg: #f0e2c8;
  --sw-placeholder: rgba(240, 226, 200, 0.38);
  --sw-control-bg: rgba(255, 220, 170, 0.05);
  --sw-control-hover: rgba(255, 220, 170, 0.12);
  --sw-control-border: rgba(224, 160, 96, 0.26);
  --sw-segment-bg: rgba(0, 0, 0, 0.25);
  --sw-segment-active-bg: #4a2c18;
  --sw-segment-active-fg: #f6dcae;
  --sw-switch-off: rgba(255, 220, 170, 0.14);
  --sw-section-border: rgba(224, 160, 96, 0.16);
  --sw-on-accent: #2a1606;
  --sw-primary-bg: linear-gradient(180deg, #e7a868 0%, #c47c3a 100%);
  --sw-primary-fg: #24130a;
  --sw-stop-bg: linear-gradient(180deg, #c2483a 0%, #8e2a1f 100%);
  --sw-stop-fg: #fff2e6;
  --sw-bar-bg: linear-gradient(180deg, rgba(40, 22, 12, 0.94), rgba(22, 12, 6, 0.96));
  --sw-bar-fg: #f0dcb8;
  --sw-bar-muted: rgba(240, 220, 184, 0.66);
  --sw-bar-border: rgba(224, 160, 96, 0.3);
  --sw-bar-hover: rgba(255, 210, 150, 0.1);
  --sw-accent-on-bar: #e8aa66;
  --sw-handle-bg: linear-gradient(90deg, #2c180c 0%, #46281a 60%, #3a2112 100%);
  --sw-handle-fg: #e7c286;
  --sw-handle-border: rgba(0, 0, 0, 0.7);
  --sw-leather: #4a2a17;
  --sw-leather-dark: #24130a;
  --sw-stitch: rgba(231, 194, 134, 0.42);
  --sw-note-bg: linear-gradient(172deg, #efe0a0 0%, #e3cc72 60%, #d4b85a 100%);
  --sw-note-fg: #2e2510;
  --sw-note-shadow: rgba(0, 0, 0, 0.7);
  --sw-note-line: rgba(110, 80, 10, 0.25);
  --sw-scrim: rgba(0, 0, 0, 0.55);
  --sw-message-fg: #e9dcc3;
  --sw-danger: #f08a7a;
}
${R} .sw-root[data-sw-theme="ebook"][data-sw-mode="light"] {
  --sw-panel-muted: #6b6b70;
  --sw-header-fg: #1f1f22;
  --sw-heading-fg: #1f1f22;
  --sw-field-bg: #ffffff;
  --sw-field-border: rgba(17, 17, 20, 0.14);
  --sw-field-fg: #1f1f22;
  --sw-placeholder: rgba(31, 31, 34, 0.4);
  --sw-control-bg: rgba(17, 17, 20, 0.04);
  --sw-control-hover: rgba(17, 17, 20, 0.08);
  --sw-control-border: rgba(17, 17, 20, 0.12);
  --sw-segment-bg: rgba(17, 17, 20, 0.05);
  --sw-segment-active-bg: #ffffff;
  --sw-segment-active-fg: #1f1f22;
  --sw-switch-off: rgba(17, 17, 20, 0.16);
  --sw-section-border: rgba(17, 17, 20, 0.08);
  --sw-on-accent: #ffffff;
  --sw-primary-bg: #2f5fc4;
  --sw-primary-fg: #ffffff;
  --sw-stop-bg: #c0392b;
  --sw-stop-fg: #ffffff;
  --sw-bar-bg: rgba(255, 255, 255, 0.84);
  --sw-bar-fg: #1f1f22;
  --sw-bar-muted: #5f5f66;
  --sw-bar-border: rgba(17, 17, 20, 0.1);
  --sw-bar-hover: rgba(17, 17, 20, 0.07);
  --sw-accent-on-bar: #2f5fc4;
  --sw-handle-bg: rgba(255, 255, 255, 0.94);
  --sw-handle-fg: #2f5fc4;
  --sw-handle-border: rgba(17, 17, 20, 0.12);
  --sw-note-bg: #fdf1a8;
  --sw-note-fg: #3a3416;
  --sw-note-shadow: rgba(40, 35, 10, 0.3);
  --sw-note-line: rgba(120, 100, 20, 0.18);
  --sw-note-strip: #f2d65a;
  --sw-scrim: rgba(20, 20, 25, 0.35);
  --sw-message-fg: #3a3a40;
  --sw-danger: #c0392b;
}
${R} .sw-root[data-sw-theme="ebook"][data-sw-mode="dark"] {
  --sw-panel-muted: #9a978f;
  --sw-header-fg: #ece9e2;
  --sw-heading-fg: #ece9e2;
  --sw-field-bg: rgba(255, 255, 255, 0.05);
  --sw-field-border: rgba(255, 255, 255, 0.12);
  --sw-field-fg: #ece9e2;
  --sw-placeholder: rgba(236, 233, 226, 0.36);
  --sw-control-bg: rgba(255, 255, 255, 0.05);
  --sw-control-hover: rgba(255, 255, 255, 0.1);
  --sw-control-border: rgba(255, 255, 255, 0.12);
  --sw-segment-bg: rgba(0, 0, 0, 0.3);
  --sw-segment-active-bg: #2a2c32;
  --sw-segment-active-fg: #f2efe8;
  --sw-switch-off: rgba(255, 255, 255, 0.16);
  --sw-section-border: rgba(255, 255, 255, 0.07);
  --sw-on-accent: #0b1a33;
  --sw-primary-bg: #8ab4f8;
  --sw-primary-fg: #0b1a33;
  --sw-stop-bg: #e06c5c;
  --sw-stop-fg: #1a0703;
  --sw-bar-bg: rgba(26, 27, 31, 0.86);
  --sw-bar-fg: #ece9e2;
  --sw-bar-muted: #a5a29a;
  --sw-bar-border: rgba(255, 255, 255, 0.1);
  --sw-bar-hover: rgba(255, 255, 255, 0.08);
  --sw-accent-on-bar: #8ab4f8;
  --sw-handle-bg: rgba(30, 31, 36, 0.96);
  --sw-handle-fg: #8ab4f8;
  --sw-handle-border: rgba(255, 255, 255, 0.12);
  --sw-note-bg: #4a4224;
  --sw-note-fg: #f5eab8;
  --sw-note-shadow: rgba(0, 0, 0, 0.6);
  --sw-note-line: rgba(245, 234, 184, 0.14);
  --sw-note-strip: #d9bd45;
  --sw-scrim: rgba(0, 0, 0, 0.5);
  --sw-message-fg: #c9c5bc;
  --sw-danger: #f08a7a;
}`;

const ROOT_RULES = `
${R} { display: block; height: 100%; min-height: 0; }
${R} .sw-root {
  position: relative; height: 100%; min-height: 0; overflow: hidden; isolation: isolate;
  container: sw-root / size;
  font-family: var(--sw-ui-font); color: var(--sw-panel-fg); background: #120d09;
  -webkit-tap-highlight-color: transparent;
  --sw-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
${R} .sw-frame {
  position: absolute; inset: 0;
  --sw-slot-top: 22px;
  --sw-slot-bottom: calc(92px + ${SAFE_BOTTOM});
  --sw-slot-left: 48px;
  --sw-slot-right: 48px;
}
${R} .sw-stage { position: absolute; inset: 0; background: var(--sw-stage-bg); }
${R} .sw-reader-slot {
  position: absolute; top: var(--sw-slot-top); bottom: var(--sw-slot-bottom);
  left: var(--sw-slot-left); right: var(--sw-slot-right); min-width: 0; min-height: 0;
}
${R} .sw-slot-message {
  position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 14px;
  padding: 24px; text-align: center; color: var(--sw-message-fg); font-size: 15px; line-height: 1.5;
}
${R} .sw-slot-message p { margin: 0; max-width: 34ch; }
${R} .sw-spin { animation: sw-spin 1s linear infinite; }
@keyframes sw-spin { to { transform: rotate(360deg); } }
${R} :is(.sw-drawer, .sw-note-anchor, .sw-actionbar, .sw-slot-message) :focus-visible {
  outline: 2px solid var(--sw-accent); outline-offset: 2px;
}
${R} .sw-visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}`;

const CONTROL_RULES = `
${R} .sw-field { display: grid; gap: 6px; min-width: 0; }
${R} .sw-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; }
${R} .sw-label { font-size: 13px; font-weight: 600; letter-spacing: 0.01em; color: var(--sw-heading-fg); }
${R} .sw-label-extra { font-size: 12px; font-weight: 500; color: var(--sw-panel-muted); white-space: nowrap; }
${R} .sw-hint { margin: 0; font-size: 12px; line-height: 1.45; color: var(--sw-panel-muted); }
${R} .sw-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
${R} :is(.sw-input, .sw-textarea, .sw-select) {
  width: 100%; min-width: 0; min-height: 38px; margin: 0; padding: 8px 10px;
  font: inherit; font-size: 14px; line-height: 1.4; color: var(--sw-field-fg);
  background-color: var(--sw-field-bg); border: 1px solid var(--sw-field-border); border-radius: 9px;
  transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
}
${R} .sw-textarea { resize: vertical; min-height: 72px; line-height: 1.5; }
${R} :is(.sw-input, .sw-textarea)::placeholder { color: var(--sw-placeholder); opacity: 1; }
${R} :is(.sw-input, .sw-textarea, .sw-select):focus {
  outline: none; border-color: var(--sw-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-accent) 22%, transparent);
}
${R} .sw-select {
  appearance: none; -webkit-appearance: none; padding-inline-end: 32px; cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 17px) 52%, calc(100% - 12px) 52%;
  background-size: 5px 5px; background-repeat: no-repeat;
}
${R} .sw-select option { color: #1f1f22; background: #fff; }
${R} .sw-input[type="number"] { font-variant-numeric: tabular-nums; }
${R} .sw-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 6px 12px;
  border: 1px solid var(--sw-control-border); border-radius: 9px; background: var(--sw-control-bg); color: inherit;
  font: inherit; font-size: 13px; font-weight: 600; line-height: 1.2; white-space: nowrap; cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, transform 120ms ease, opacity 160ms ease;
}
${R} .sw-button:hover:not(:disabled) { background: var(--sw-control-hover); }
${R} .sw-button:active:not(:disabled) { transform: translateY(1px); }
${R} .sw-button:disabled { opacity: 0.45; cursor: not-allowed; }
${R} .sw-button[data-variant="primary"] { border-color: transparent; background: var(--sw-primary-bg); color: var(--sw-primary-fg); }
${R} .sw-button[data-variant="primary"]:hover:not(:disabled) { background: var(--sw-primary-bg); filter: brightness(1.07); }
${R} .sw-button[data-variant="danger"] { color: var(--sw-danger); }
${R} .sw-button-row { display: flex; flex-wrap: wrap; gap: 8px; }
${R} .sw-icon-button {
  display: inline-grid; place-items: center; flex: none; width: 36px; height: 36px; padding: 0;
  border: 1px solid transparent; border-radius: 9px; background: transparent; color: inherit; cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, opacity 160ms ease;
}
${R} .sw-icon-button:hover:not(:disabled) { background: var(--sw-control-hover); border-color: var(--sw-control-border); }
${R} .sw-icon-button:disabled { opacity: 0.35; cursor: not-allowed; }
${R} .sw-icon-button[data-variant="danger"] { color: var(--sw-danger); }
${R} .sw-chip {
  min-height: 30px; padding: 3px 11px; border: 1px solid var(--sw-control-border); border-radius: 999px;
  background: transparent; color: inherit; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}
${R} .sw-chip:hover { background: var(--sw-control-hover); }
${R} .sw-chip[aria-pressed="true"] { border-color: transparent; background: var(--sw-accent); color: var(--sw-on-accent); }
${R} .sw-toggle {
  display: flex; align-items: center; justify-content: space-between; gap: 14px; width: 100%; min-height: 40px;
  padding: 4px 0; border: 0; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer;
}
${R} .sw-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
${R} .sw-toggle-text { display: grid; gap: 2px; font-size: 14px; font-weight: 600; color: var(--sw-heading-fg); }
${R} .sw-toggle-text small { font-size: 12px; font-weight: 400; line-height: 1.4; color: var(--sw-panel-muted); }
${R} .sw-switch {
  position: relative; flex: none; width: 40px; height: 24px; border: 1px solid var(--sw-control-border);
  border-radius: 999px; background: var(--sw-switch-off); transition: background-color 200ms ease, border-color 200ms ease;
}
${R} .sw-switch::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); transition: transform 220ms var(--sw-ease);
}
${R} .sw-toggle[aria-pressed="true"] .sw-switch { border-color: transparent; background: var(--sw-accent); }
${R} .sw-toggle[aria-pressed="true"] .sw-switch::after { transform: translateX(16px); }
${R} .sw-segmented {
  display: flex; gap: 3px; padding: 3px; border: 1px solid var(--sw-control-border); border-radius: 10px;
  background: var(--sw-segment-bg);
}
${R} .sw-segment {
  flex: 1 1 0; min-width: 0; min-height: 34px; padding: 4px 8px; border: 0; border-radius: 7px; background: transparent;
  color: inherit; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
}
${R} .sw-segment[aria-pressed="true"] {
  background: var(--sw-segment-active-bg); color: var(--sw-segment-active-fg); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}
${R} .sw-progress { height: 6px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, currentColor 14%, transparent); }
${R} .sw-progress > span { display: block; height: 100%; border-radius: inherit; background: var(--sw-accent); transition: width 400ms var(--sw-ease); }
${R} .sw-range-row { display: flex; align-items: center; gap: 12px; }
${R} .sw-range { flex: 1; min-width: 0; height: 28px; margin: 0; accent-color: var(--sw-accent); cursor: pointer; }
${R} .sw-range-value { min-width: 52px; font-size: 13px; font-weight: 600; text-align: end; font-variant-numeric: tabular-nums; }
${R} .sw-color-row { display: flex; align-items: center; gap: 10px; }
${R} .sw-color {
  width: 48px; height: 36px; padding: 3px; border: 1px solid var(--sw-field-border); border-radius: 9px;
  background: var(--sw-field-bg); cursor: pointer;
}
${R} .sw-color-value { font-size: 12px; color: var(--sw-panel-muted); font-variant-numeric: tabular-nums; text-transform: uppercase; }
${R} .sw-search { position: relative; }
${R} .sw-search > svg { position: absolute; top: 50%; left: 10px; transform: translateY(-50%); opacity: 0.55; pointer-events: none; }
${R} .sw-search > .sw-input { padding-inline-start: 32px; }
${R} .sw-empty { margin: 0; padding: 8px 4px; font-size: 13px; color: var(--sw-panel-muted); }`;

const DRAWER_RULES = `
${R} .sw-drawer {
  position: absolute; top: 0; bottom: 0; z-index: 40; width: min(380px, 92%);
  transition: transform 380ms var(--sw-ease);
}
${R} .sw-drawer[data-side="left"] { left: 0; transform: translateX(-100%); }
${R} .sw-drawer[data-side="right"] { right: 0; transform: translateX(100%); }
${R} .sw-drawer[data-open="true"] { transform: translateX(0); }
${R} .sw-drawer-panel {
  position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0;
  padding-bottom: ${SAFE_BOTTOM};
  background: var(--sw-panel-texture), var(--sw-panel-bg); color: var(--sw-panel-fg);
  box-shadow: 0 0 0 1px var(--sw-panel-border);
  transition: box-shadow 380ms ease;
}
${R} .sw-drawer[data-open="true"] .sw-drawer-panel { box-shadow: 0 0 0 1px var(--sw-panel-border), 0 24px 64px rgba(0, 0, 0, 0.45); }
/* Closed, the outline would spill 1px past the edge as a line beside the handle. */
${R} .sw-drawer:not([data-open="true"]) .sw-drawer-panel { box-shadow: none; }
${R} .sw-root[data-sw-theme="ebook"] .sw-drawer-panel { -webkit-backdrop-filter: blur(18px) saturate(1.2); backdrop-filter: blur(18px) saturate(1.2); }
/* Book: a leather spine with stitching along the edge that faces the stage. */
${R} .sw-root[data-sw-theme="book"] .sw-drawer[data-side="left"] .sw-drawer-panel { padding-right: 12px; }
${R} .sw-root[data-sw-theme="book"] .sw-drawer[data-side="right"] .sw-drawer-panel { padding-left: 12px; }
${R} .sw-root[data-sw-theme="book"] .sw-drawer-panel::after {
  content: ""; position: absolute; top: 0; bottom: 0; width: 12px; pointer-events: none;
  background: linear-gradient(90deg, var(--sw-leather-dark), var(--sw-leather) 45%, var(--sw-leather-dark));
}
${R} .sw-root[data-sw-theme="book"] .sw-drawer-panel::before {
  content: ""; position: absolute; top: 10px; bottom: 10px; z-index: 1; width: 0;
  border-left: 1.5px dashed var(--sw-stitch); pointer-events: none;
}
${R} .sw-root[data-sw-theme="book"] .sw-drawer[data-side="left"] .sw-drawer-panel::after { right: 0; }
${R} .sw-root[data-sw-theme="book"] .sw-drawer[data-side="left"] .sw-drawer-panel::before { right: 5px; }
${R} .sw-root[data-sw-theme="book"] .sw-drawer[data-side="right"] .sw-drawer-panel::after { left: 0; }
${R} .sw-root[data-sw-theme="book"] .sw-drawer[data-side="right"] .sw-drawer-panel::before { left: 5px; }
${R} .sw-drawer-header {
  display: flex; flex: none; align-items: center; gap: 10px; padding: 14px 12px 12px 18px;
  background: var(--sw-header-bg); color: var(--sw-header-fg); border-bottom: 1px solid var(--sw-section-border);
}
${R} .sw-root[data-sw-theme="book"] .sw-drawer-header {
  border-bottom: 2px solid var(--sw-leather-dark); box-shadow: inset 0 -1px 0 rgba(255, 220, 150, 0.22);
}
${R} .sw-drawer-brand { display: flex; flex: 1; min-width: 0; align-items: center; gap: 10px; }
${R} .sw-drawer-brand img { width: 30px; height: 30px; flex: none; object-fit: contain; }
${R} .sw-drawer-titles { display: grid; min-width: 0; }
${R} .sw-drawer-title {
  margin: 0; font-family: var(--sw-heading-font); font-size: 19px; font-weight: 600; line-height: 1.2;
  letter-spacing: 0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${R} .sw-root[data-sw-theme="book"] .sw-drawer-title { text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45); }
${R} .sw-save-state { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: 0.78; }
${R} .sw-save-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: currentColor; opacity: 0.55; }
${R} .sw-save-state[data-saving="true"] .sw-save-dot { animation: sw-pulse 1s ease-in-out infinite; }
@keyframes sw-pulse { 50% { opacity: 1; transform: scale(1.3); } }
${R} .sw-drawer-header .sw-icon-button:hover:not(:disabled) { background: color-mix(in srgb, currentColor 14%, transparent); border-color: transparent; }
${R} .sw-drawer-body {
  flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 16px 32px;
  scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 25%, transparent) transparent;
}
${R} .sw-section { border-bottom: 1px solid var(--sw-section-border); }
${R} .sw-section:last-child { border-bottom: 0; }
${R} .sw-section-heading { margin: 0; }
${R} .sw-section-toggle {
  display: flex; width: 100%; min-height: 50px; align-items: center; gap: 10px; padding: 10px 2px;
  border: 0; background: none; color: var(--sw-heading-fg); font: inherit; font-family: var(--sw-heading-font);
  font-size: 16px; font-weight: 600; text-align: start; cursor: pointer;
}
${R} .sw-root[data-sw-theme="book"] .sw-section-toggle { font-size: 17px; font-variant: small-caps; letter-spacing: 0.04em; }
${R} .sw-root[data-sw-theme="ebook"] .sw-section-toggle { font-size: 15px; }
${R} .sw-section-icon { display: inline-grid; flex: none; place-items: center; color: var(--sw-accent); }
${R} .sw-section-badge {
  padding: 1px 8px; border-radius: 999px; font-family: var(--sw-ui-font); font-size: 12px; font-weight: 600;
  font-variant: normal; letter-spacing: 0; color: var(--sw-accent); background: color-mix(in srgb, var(--sw-accent) 15%, transparent);
}
${R} .sw-section-chevron { flex: none; margin-inline-start: auto; opacity: 0.65; transition: transform 240ms var(--sw-ease); }
${R} .sw-section-toggle[aria-expanded="true"] .sw-section-chevron { transform: rotate(180deg); }
${R} .sw-section-body { display: grid; gap: 16px; padding: 2px 0 20px; animation: sw-section-in 260ms var(--sw-ease); }
@keyframes sw-section-in { from { opacity: 0; transform: translateY(-6px); } }
${R} .sw-subheading {
  margin: 4px 0 -4px; font-family: var(--sw-heading-font); font-size: 14px; font-weight: 700; color: var(--sw-heading-fg);
}
${R} .sw-root[data-sw-theme="book"] .sw-subheading { font-variant: small-caps; letter-spacing: 0.04em; font-size: 15px; }
${R} .sw-handle {
  position: absolute; top: 50%; display: grid; place-items: center; width: 30px; height: 76px; margin-top: -38px;
  padding: 0; border: 1px solid var(--sw-handle-border); background: var(--sw-handle-bg); color: var(--sw-handle-fg);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35); cursor: pointer; transition: width 200ms var(--sw-ease);
}
${R} .sw-handle::before { content: ""; position: absolute; inset: -10px -14px; }
${R} .sw-drawer[data-side="left"] .sw-handle { left: 100%; border-left: 0; border-radius: 0 14px 14px 0; }
${R} .sw-drawer[data-side="right"] .sw-handle { right: 100%; border-right: 0; border-radius: 14px 0 0 14px; }
${R} .sw-handle:hover { width: 34px; }
${R} .sw-handle svg { position: relative; transition: transform 380ms var(--sw-ease); }
${R} .sw-drawer[data-side="left"][data-open="true"] .sw-handle svg,
${R} .sw-drawer[data-side="right"][data-open="false"] .sw-handle svg { transform: rotate(180deg); }
${R} .sw-root[data-sw-theme="book"] .sw-handle::after {
  content: ""; position: absolute; inset: 5px; border: 1px dashed var(--sw-stitch); border-radius: inherit; pointer-events: none;
}
${R} .sw-root[data-sw-theme="book"] .sw-drawer[data-side="left"] .sw-handle::after { left: -1px; border-left: 0; }
${R} .sw-root[data-sw-theme="book"] .sw-drawer[data-side="right"] .sw-handle::after { right: -1px; border-right: 0; }
${R} .sw-root[data-sw-theme="ebook"] .sw-handle { -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
${R} .sw-scrim {
  display: none; position: absolute; inset: 0; z-index: 35; padding: 0; border: 0; background: var(--sw-scrim);
  opacity: 0; pointer-events: none; transition: opacity 300ms ease;
}
${R} .sw-scrim[data-open="true"] { opacity: 1; pointer-events: auto; }
${R} .sw-story-list {
  display: grid; gap: 6px; max-height: 264px; margin: 0; padding: 0; overflow-y: auto; overscroll-behavior: contain; list-style: none;
}
${R} .sw-story-item {
  display: grid; gap: 2px; width: 100%; min-height: 48px; padding: 9px 12px; border: 1px solid transparent; border-radius: 10px;
  background: var(--sw-control-bg); color: inherit; font: inherit; text-align: start; cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease;
}
${R} .sw-story-item:hover:not(:disabled) { background: var(--sw-control-hover); }
${R} .sw-story-item:disabled { cursor: not-allowed; opacity: 0.6; }
${R} .sw-story-item[aria-current="true"] { border-color: var(--sw-accent); background: color-mix(in srgb, var(--sw-accent) 12%, var(--sw-field-bg)); }
${R} .sw-story-title { overflow: hidden; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
${R} .sw-story-meta { font-size: 12px; color: var(--sw-panel-muted); }
${R} .sw-checklist-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
${R} .sw-checklist {
  display: grid; gap: 2px; max-height: 248px; margin: 0; padding: 4px; overflow-y: auto; overscroll-behavior: contain;
  list-style: none; border: 1px solid var(--sw-field-border); border-radius: 10px; background: var(--sw-field-bg);
}
${R} .sw-check-item {
  display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 5px 8px; border-radius: 8px; cursor: pointer;
}
${R} .sw-check-item:hover { background: var(--sw-control-hover); }
${R} .sw-check-item input { flex: none; width: 18px; height: 18px; margin: 0; accent-color: var(--sw-accent); cursor: pointer; }
${R} .sw-avatar {
  display: grid; flex: none; place-items: center; width: 30px; height: 30px; overflow: hidden; border-radius: 50%;
  object-fit: cover; font-size: 13px; font-weight: 700; color: var(--sw-accent);
  background: color-mix(in srgb, var(--sw-accent) 18%, transparent);
}
${R} .sw-check-text { display: grid; min-width: 0; }
${R} .sw-check-name { overflow: hidden; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; color: var(--sw-field-fg); }
${R} .sw-check-detail { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; color: var(--sw-panel-muted); }
${R} .sw-toc { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
${R} .sw-toc-item { border-radius: 10px; background: var(--sw-control-bg); }
${R} .sw-toc-row { display: flex; align-items: center; gap: 2px; padding-inline-end: 4px; }
${R} .sw-toc-jump {
  display: flex; flex: 1; min-width: 0; min-height: 42px; align-items: baseline; gap: 10px; padding: 9px 10px;
  border: 0; border-radius: 10px; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer;
}
${R} .sw-toc-jump:hover { background: var(--sw-control-hover); }
${R} .sw-toc-number { min-width: 1.6em; font-family: var(--sw-heading-font); font-weight: 700; color: var(--sw-accent); }
${R} .sw-toc-title { flex: 1; min-width: 0; overflow: hidden; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
${R} .sw-toc-words { font-size: 12px; white-space: nowrap; color: var(--sw-panel-muted); font-variant-numeric: tabular-nums; }
${R} .sw-toc-tag {
  padding: 1px 6px; border-radius: 999px; font-size: 11px; font-weight: 700; color: var(--sw-accent);
  background: color-mix(in srgb, var(--sw-accent) 14%, transparent);
}
${R} .sw-toc-details { display: grid; gap: 8px; padding: 2px 10px 12px; }
${R} .sw-timeline { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
${R} .sw-event { display: flex; align-items: center; gap: 4px; }
${R} .sw-event-index { min-width: 1.6em; font-size: 12px; font-weight: 700; text-align: end; color: var(--sw-panel-muted); }
${R} .sw-event input[type="checkbox"] { flex: none; width: 18px; height: 18px; margin: 0 4px; accent-color: var(--sw-accent); cursor: pointer; }
${R} .sw-event .sw-input { flex: 1; min-height: 34px; padding: 6px 8px; }
${R} .sw-event[data-done="true"] .sw-input { text-decoration: line-through; opacity: 0.7; }
${R} .sw-event .sw-icon-button { width: 30px; height: 30px; }
${R} .sw-event-add { display: flex; gap: 8px; }
${R} .sw-event-add .sw-input { flex: 1; }`;

const NOTE_RULES = `
${R} .sw-note-anchor { position: absolute; top: 14px; z-index: 25; width: 0; height: 0; }
${R} .sw-note-anchor[data-side="left"] { left: 16px; }
${R} .sw-note-anchor[data-side="right"] { right: 16px; }
${R} .sw-note { position: absolute; top: 0; color: var(--sw-note-fg); background: var(--sw-note-bg); font-family: var(--sw-ui-font); }
${R} .sw-note-anchor[data-side="left"] .sw-note { left: 0; transform-origin: 0 0; }
${R} .sw-note-anchor[data-side="right"] .sw-note { right: 0; transform-origin: 100% 0; }
${R} .sw-note-collapsed {
  display: flex; flex-direction: column; gap: 6px; width: 148px; height: 124px; padding: 22px 14px 12px;
  border: 0; border-radius: 3px; text-align: start; cursor: pointer;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.12), 0 14px 18px -10px var(--sw-note-shadow), inset 0 -18px 24px -20px rgba(120, 80, 0, 0.35);
  rotate: var(--sw-note-tilt, 0deg);
  transition: translate 260ms var(--sw-ease), scale 260ms var(--sw-ease), box-shadow 260ms ease;
}
${R} .sw-note-anchor[data-side="left"] .sw-note-collapsed { --sw-note-tilt: -3deg; }
${R} .sw-note-anchor[data-side="right"] .sw-note-collapsed { --sw-note-tilt: 2.5deg; }
${R} .sw-note-collapsed:hover { translate: 0 2px; scale: 1.03; box-shadow: 0 1px 1px rgba(0, 0, 0, 0.12), 0 20px 24px -12px var(--sw-note-shadow), inset 0 -18px 24px -20px rgba(120, 80, 0, 0.35); }
${R} .sw-note-tape {
  position: absolute; top: -10px; left: 50%; width: 66px; height: 22px; margin-left: -33px; rotate: -4deg; pointer-events: none;
  background: rgba(255, 255, 255, 0.46); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
  clip-path: polygon(0 10%, 5% 0, 30% 6%, 60% 0, 95% 5%, 100% 0, 97% 50%, 100% 100%, 70% 94%, 35% 100%, 4% 95%, 0 100%, 3% 50%);
}
${R} .sw-root[data-sw-mode="dark"] .sw-note-tape { background: rgba(255, 245, 220, 0.3); }
${R} .sw-note-icon { display: none; }
${R} .sw-note-title { font-family: ${HAND_FONT}; font-size: 17px; font-weight: 700; line-height: 1.1; }
${R} .sw-note-preview {
  display: -webkit-box; overflow: hidden; font-size: 12.5px; line-height: 1.35; opacity: 0.82; overflow-wrap: anywhere;
  -webkit-box-orient: vertical; -webkit-line-clamp: 4;
}
${R} .sw-note-open {
  display: flex; flex-direction: column; gap: 10px; width: min(340px, calc(100cqw - 32px));
  max-height: calc(100cqh - var(--sw-slot-bottom) - 28px); padding: 26px 18px 14px; border-radius: 3px;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.14), 0 28px 44px -18px var(--sw-note-shadow);
}
${R} .sw-note-open .sw-note-tape { width: 84px; margin-left: -42px; }
${R} .sw-note-head { display: flex; align-items: center; gap: 8px; }
${R} .sw-note-head h2 { flex: 1; margin: 0; font-family: ${HAND_FONT}; font-size: 21px; font-weight: 700; line-height: 1.15; }
${R} .sw-note-head .sw-icon-button:hover:not(:disabled) { background: rgba(0, 0, 0, 0.08); border-color: transparent; }
${R} .sw-root[data-sw-theme="ebook"][data-sw-mode="dark"] .sw-note-head .sw-icon-button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
${R} .sw-note-explain { margin: 0; font-size: 12.5px; line-height: 1.45; opacity: 0.85; }
${R} .sw-note-text {
  flex: 1 1 auto; width: 100%; height: 208px; min-height: 96px; margin: 0; padding: 0 2px; resize: none;
  border: 0; border-radius: 0; background: transparent; color: inherit;
  font: inherit; font-size: 15px; line-height: 26px;
  background-image: repeating-linear-gradient(transparent 0 25px, var(--sw-note-line) 25px 26px);
  background-attachment: local;
}
${R} .sw-note-text::placeholder { color: inherit; opacity: 0.5; }
${R} .sw-note-text:focus { outline: none; }
${R} .sw-note-text:focus-visible { outline: none; box-shadow: 0 2px 0 0 color-mix(in srgb, var(--sw-note-fg) 45%, transparent); }
${R} .sw-note-foot { margin: 0; font-size: 11.5px; opacity: 0.65; }
${R} .sw-note-depth { display: grid; grid-template-columns: auto 4.5em; align-items: center; gap: 4px 8px; font-size: 12.5px; }
${R} .sw-note-depth label { font-weight: 700; }
${R} .sw-note-depth input {
  width: 100%; min-height: 32px; padding: 2px 6px; border-radius: 6px; font: inherit; color: inherit;
  border: 1px solid color-mix(in srgb, var(--sw-note-fg) 30%, transparent);
  background: color-mix(in srgb, var(--sw-note-fg) 6%, transparent);
}
${R} .sw-note-depth input:focus-visible { outline: 2px solid color-mix(in srgb, var(--sw-note-fg) 55%, transparent); outline-offset: 1px; }
${R} .sw-note-depth span { grid-column: 1 / -1; font-size: 11.5px; line-height: 1.35; opacity: 0.7; }
@media (pointer: coarse) { ${R} .sw-note-depth input { font-size: 16px; min-height: 40px; } }
/* E-book: a flat, rounded note with a colored strip instead of paper and tape. */
${R} .sw-root[data-sw-theme="ebook"] .sw-note { border-radius: 12px; }
${R} .sw-root[data-sw-theme="ebook"] .sw-note-collapsed { --sw-note-tilt: 0deg; padding-top: 18px; box-shadow: 0 10px 26px -12px var(--sw-note-shadow), 0 0 0 1px rgba(0, 0, 0, 0.06); }
${R} .sw-root[data-sw-theme="ebook"] .sw-note-open { padding-top: 22px; box-shadow: 0 24px 48px -16px var(--sw-note-shadow), 0 0 0 1px rgba(0, 0, 0, 0.06); }
${R} .sw-root[data-sw-theme="ebook"] .sw-note-tape {
  top: 0; left: 0; width: 100%; height: 6px; margin: 0; rotate: none; clip-path: none; box-shadow: none;
  border-radius: 12px 12px 0 0; background: var(--sw-note-strip);
}
${R} .sw-root[data-sw-theme="ebook"] :is(.sw-note-title, .sw-note-head h2) { font-family: var(--sw-ui-font); letter-spacing: 0.01em; }
${R} .sw-root[data-sw-theme="ebook"] .sw-note-title { font-size: 14px; }
${R} .sw-root[data-sw-theme="ebook"] .sw-note-head h2 { font-size: 17px; }`;

const ACTION_RULES = `
${R} .sw-actionbar {
  position: absolute; left: 50%; bottom: calc(16px + ${SAFE_BOTTOM}); z-index: 20; translate: -50% 0;
  display: flex; align-items: center; gap: 4px; max-width: calc(100% - 96px); padding: 6px;
  border: 1px solid var(--sw-bar-border); border-radius: 999px; background: var(--sw-bar-bg); color: var(--sw-bar-fg);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(14px) saturate(1.2); backdrop-filter: blur(14px) saturate(1.2);
}
${R} .sw-action-primary {
  display: inline-flex; flex: none; align-items: center; gap: 8px; min-height: 44px; padding: 0 20px 0 16px;
  border: 0; border-radius: 999px; background: var(--sw-primary-bg); color: var(--sw-primary-fg);
  font: inherit; font-size: 15px; font-weight: 700; white-space: nowrap; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transition: filter 160ms ease, opacity 160ms ease, transform 120ms ease;
}
${R} .sw-action-primary:hover:not(:disabled) { filter: brightness(1.08); }
${R} .sw-action-primary:active:not(:disabled) { transform: translateY(1px); }
${R} .sw-action-primary:disabled { opacity: 0.5; cursor: not-allowed; }
${R} .sw-action-primary[data-stop="true"] { background: var(--sw-stop-bg); color: var(--sw-stop-fg); }
${R} .sw-action-label-short { display: none; }
${R} .sw-action-status {
  display: flex; align-items: center; gap: 8px; min-width: 0; padding: 0 10px 0 8px; overflow: hidden;
  font-size: 13px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; font-variant-numeric: tabular-nums;
}
${R} .sw-action-status .sw-status-short { display: none; }
${R} .sw-action-icon {
  display: grid; flex: none; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px;
  background: transparent; color: inherit; cursor: pointer; transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}
${R} .sw-action-icon:hover:not(:disabled) { background: var(--sw-bar-hover); }
${R} .sw-action-icon:disabled { opacity: 0.4; cursor: not-allowed; }
${R} .sw-action-icon[aria-pressed="true"] { background: var(--sw-bar-hover); color: var(--sw-accent-on-bar); }
${R} .sw-action-divider { flex: none; align-self: stretch; width: 1px; margin: 8px 3px; background: var(--sw-bar-border); }
${R} .sw-wordcount {
  display: grid; gap: 4px; min-width: 0; padding: 0 14px 0 6px; font-size: 12.5px; font-weight: 600;
  color: var(--sw-bar-muted); white-space: nowrap; font-variant-numeric: tabular-nums;
}
${R} .sw-wordcount-bar { height: 3px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, currentColor 22%, transparent); }
${R} .sw-wordcount-bar > span { display: block; height: 100%; border-radius: inherit; background: var(--sw-accent-on-bar); transition: width 500ms var(--sw-ease); }
${R} .sw-action-hint { max-width: 230px; padding: 0 12px 0 4px; font-size: 12.5px; line-height: 1.3; color: var(--sw-bar-muted); }`;

// Size-driven layout. Order matters: the short landscape rules come last and win on phones turned sideways.
const LAYOUT_RULES = `
@container sw-root (max-width: 1099px) {
  ${R} .sw-frame { --sw-slot-top: 72px; }
  ${R} .sw-note-collapsed { width: 156px; height: 54px; gap: 2px; padding: 9px 12px 8px 14px; justify-content: center; }
  ${R} .sw-note-collapsed .sw-note-tape { top: -9px; width: 46px; height: 18px; margin-left: -23px; }
  ${R} .sw-note-collapsed .sw-note-preview { -webkit-line-clamp: 1; font-size: 12px; }
  ${R} .sw-note-collapsed .sw-note-title { font-size: 15px; }
  /* The e-book note's colored strip needs less room than the paper note's tape. */
  ${R} .sw-root[data-sw-theme="ebook"] .sw-note-collapsed { height: auto; min-height: 54px; padding-top: 12px; }
}
@container sw-root (max-width: 640px) {
  ${R} .sw-frame {
    --sw-slot-top: 70px;
    --sw-slot-bottom: calc(76px + ${SAFE_BOTTOM});
    --sw-slot-left: 30px;
    --sw-slot-right: 30px;
  }
  ${R} .sw-handle { width: 28px; height: 68px; margin-top: -34px; }
  ${R} .sw-handle:hover { width: 28px; }
  ${R} .sw-note-anchor { top: 10px; }
  ${R} .sw-note-anchor[data-side="left"] { left: 12px; }
  ${R} .sw-note-anchor[data-side="right"] { right: 12px; }
  ${R} .sw-actionbar { bottom: calc(12px + ${SAFE_BOTTOM}); max-width: calc(100% - 20px); gap: 2px; padding: 5px; }
  ${R} .sw-action-primary { min-height: 44px; padding: 0 16px 0 13px; font-size: 14px; }
  ${R} .sw-action-label-long, ${R} .sw-action-status .sw-status-long { display: none; }
  ${R} .sw-action-label-short, ${R} .sw-action-status .sw-status-short { display: inline; }
  ${R} .sw-action-hint { display: none; }
  ${R} .sw-wordcount { padding: 0 10px 0 4px; font-size: 12px; }
  ${R} .sw-grid-2 { grid-template-columns: minmax(0, 1fr); }
}
@container sw-root (max-height: 520px) and (min-aspect-ratio: 4 / 3) {
  ${R} .sw-frame {
    --sw-slot-top: 8px;
    --sw-slot-bottom: calc(8px + ${SAFE_BOTTOM});
    --sw-slot-left: 78px;
    --sw-slot-right: 78px;
  }
  ${R} .sw-note-anchor { top: 10px; }
  ${R} .sw-note-collapsed {
    width: 56px; height: 56px; padding: 0; align-items: center; justify-content: center; gap: 0;
  }
  ${R} .sw-note-collapsed :is(.sw-note-title, .sw-note-preview) { display: none; }
  ${R} .sw-note-collapsed .sw-note-icon { display: block; }
  ${R} .sw-note-collapsed .sw-note-tape { width: 34px; height: 14px; margin-left: -17px; top: -7px; }
  ${R} .sw-note-open { max-height: calc(100cqh - 24px); }
  ${R} .sw-note-text { min-height: 72px; }
  ${R} .sw-actionbar {
    top: 50%; bottom: auto; translate: 0 -50%; flex-direction: column; max-width: none; max-height: calc(100% - 16px);
    border-radius: 28px;
  }
  ${R} .sw-root[data-sw-sidebar="left"] .sw-actionbar { left: auto; right: 10px; }
  ${R} .sw-root[data-sw-sidebar="right"] .sw-actionbar { left: 10px; }
  ${R} .sw-action-primary { justify-content: center; width: 48px; height: 48px; min-height: 0; padding: 0; }
  ${R} .sw-action-primary :is(.sw-action-label-long, .sw-action-label-short) { display: none; }
  ${R} .sw-action-divider { align-self: auto; width: auto; height: 1px; margin: 2px 8px; }
  ${R} .sw-action-status, ${R} .sw-wordcount, ${R} .sw-action-hint { display: none; }
  /* The upright bar sits on the side away from the drawer; a note on that side moves in beside it, not over it. */
  ${R} .sw-root[data-sw-sidebar="left"] .sw-note-anchor[data-side="right"] { right: 84px; }
  ${R} .sw-root[data-sw-sidebar="right"] .sw-note-anchor[data-side="left"] { left: 84px; }
}`;

const DEVICE_RULES = `
@media ${MOBILE_QUERY} {
  ${R} .sw-scrim { display: block; }
  ${R} .sw-icon-button { width: 42px; height: 42px; }
  ${R} .sw-event .sw-icon-button { width: 38px; height: 38px; }
  ${R} .sw-button { min-height: 42px; }
  ${R} .sw-chip { min-height: 38px; padding: 4px 13px; }
  ${R} .sw-segment { min-height: 40px; }
  ${R} .sw-drawer-body { padding-bottom: 48px; }
}
@media (any-pointer: coarse) {
  /* 16 px keeps iOS from zooming into a focused field. */
  ${R} :is(.sw-input, .sw-textarea, .sw-select, .sw-note-text) { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  ${R} :is(.sw-drawer, .sw-drawer-panel, .sw-handle, .sw-handle svg, .sw-scrim, .sw-note-collapsed, .sw-section-chevron,
    .sw-switch, .sw-switch::after, .sw-progress > span, .sw-wordcount-bar > span, .sw-action-primary, .sw-button) { transition: none; }
  ${R} :is(.sw-section-body, .sw-save-state .sw-save-dot) { animation: none; }
}`;

export const SHELL_STYLES = [
  ROOT_RULES,
  THEME_RULES,
  CONTROL_RULES,
  DRAWER_RULES,
  NOTE_RULES,
  ACTION_RULES,
  LAYOUT_RULES,
  DEVICE_RULES,
].join("\n");
