// ──────────────────────────────────────────────
// Story Writer: reader styles (the open book, the e-reader, pagination and the page turn)
// ──────────────────────────────────────────────
// Colors and fonts come from the shell's custom properties on the Story Writer root (--sw-ink, --sw-page-bg, ...); the
// values after them are only fallbacks. Geometry comes from the reader's own properties (--sw-text-w, --sw-gap, ...),
// which StoryReader sets from computeReaderLayout so the column grid and the page grid stay identical.

const R = "marinara-capability-story-writer .sw-reader";
const BOOK = `${R}[data-theme="book"]`;
const EBOOK = `${R}[data-theme="ebook"]`;
const DARK = 'marinara-capability-story-writer [data-sw-mode="dark"] .sw-reader';

export const READER_STYLES = `
${R} {
  --sw-r-accent: var(--sw-accent, #8a3b12);
  --sw-r-muted: var(--sw-ink-muted, color-mix(in srgb, var(--sw-ink, #2b2118) 62%, transparent));
  --sw-r-edge: var(--sw-page-edge, #d6c29c);
  --sw-r-fold-1: rgba(0, 0, 0, 0.3);
  --sw-r-fold-2: rgba(0, 0, 0, 0.12);
  --sw-r-fold-3: rgba(0, 0, 0, 0.04);
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--sw-ink, #2b2118);
  font-size: var(--sw-font-size, 18px);
  line-height: 1.55;
  -webkit-tap-highlight-color: transparent;
}
${BOOK} {
  font-family: var(--sw-font, "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, ui-serif, serif);
}
${EBOOK} {
  --sw-r-accent: var(--sw-accent, #6b5b45);
  --sw-r-muted: var(--sw-ink-muted, color-mix(in srgb, var(--sw-ink, #1f1f1f) 58%, transparent));
  color: var(--sw-ink, #1f1f1f);
  font-family: var(--sw-font, Georgia, "Iowan Old Style", ui-serif, serif);
  line-height: 1.6;
}
${DARK}[data-theme="book"] {
  --sw-r-accent: var(--sw-accent, #e0a060);
  --sw-r-muted: var(--sw-ink-muted, color-mix(in srgb, var(--sw-ink, #e9dcc3) 60%, transparent));
  --sw-r-edge: var(--sw-page-edge, #3d342c);
  --sw-r-fold-1: rgba(0, 0, 0, 0.55);
  --sw-r-fold-2: rgba(0, 0, 0, 0.22);
  --sw-r-fold-3: rgba(0, 0, 0, 0.08);
  color: var(--sw-ink, #e9dcc3);
}
${DARK}[data-theme="ebook"] {
  --sw-r-accent: var(--sw-accent, #c9b48f);
  --sw-r-muted: var(--sw-ink-muted, color-mix(in srgb, var(--sw-ink, #d8d4cb) 55%, transparent));
  color: var(--sw-ink, #d8d4cb);
}
${R} .sw-probe {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  white-space: nowrap;
  pointer-events: none;
}

/* ── The book lying on the desk ── */
${R} .sw-book {
  position: absolute;
  touch-action: pan-y pinch-zoom;
}
${BOOK} .sw-book {
  border-radius: 5px 5px 7px 7px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.07), transparent 18%, transparent 82%, rgba(0, 0, 0, 0.24)),
    var(--sw-book-cover, linear-gradient(160deg, #5a3320, #3a2014 55%, #29160d));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 0 1px rgba(0, 0, 0, 0.35),
    0 2px 3px rgba(0, 0, 0, 0.35),
    0 18px 30px -8px rgba(0, 0, 0, 0.55),
    0 42px 70px -22px rgba(0, 0, 0, 0.6);
}
${R} .sw-stack {
  position: absolute;
  pointer-events: none;
}
${BOOK} .sw-stack--left,
${BOOK} .sw-stack--right {
  background: repeating-linear-gradient(
    90deg,
    var(--sw-r-edge) 0 1px,
    color-mix(in srgb, var(--sw-r-edge) 72%, #000) 1px 2px
  );
}
${BOOK} .sw-stack--left {
  border-radius: 2px 0 0 2px;
  box-shadow: -1px 0 2px rgba(0, 0, 0, 0.3);
}
${BOOK} .sw-stack--right {
  border-radius: 0 2px 2px 0;
  box-shadow: 1px 0 2px rgba(0, 0, 0, 0.3);
}
${BOOK} .sw-stack--bottom {
  border-radius: 0 0 3px 3px;
  background: repeating-linear-gradient(
    180deg,
    var(--sw-r-edge) 0 1px,
    color-mix(in srgb, var(--sw-r-edge) 72%, #000) 1px 2px
  );
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
${R} .sw-pages {
  position: absolute;
}
${R} .sw-page {
  position: absolute;
  top: 0;
  overflow: hidden;
  background: var(--sw-page-bg, #efe2c6);
}
${R}[data-editable="true"] :is(.sw-page, .sw-viewport) {
  cursor: text;
}
${R} .sw-block--title {
  cursor: default;
}
/* Paper curves into the spine: each page darkens toward the fold and a little at its outer edge. */
${BOOK} .sw-page--left {
  border-radius: 3px 0 0 3px;
  background:
    linear-gradient(to left, var(--sw-r-fold-1), var(--sw-r-fold-2) 3%, var(--sw-r-fold-3) 9%, transparent 16%),
    linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent 3%),
    var(--sw-page-bg, #efe2c6);
}
${BOOK} .sw-page--right {
  border-radius: 0 3px 3px 0;
  background:
    linear-gradient(to right, var(--sw-r-fold-1), var(--sw-r-fold-2) 3%, var(--sw-r-fold-3) 9%, transparent 16%),
    linear-gradient(to left, rgba(0, 0, 0, 0.08), transparent 3%),
    var(--sw-page-bg, #efe2c6);
}
${BOOK} .sw-page--single {
  border-radius: 0 3px 3px 0;
  background:
    linear-gradient(to right, var(--sw-r-fold-1), var(--sw-r-fold-3) 5%, transparent 11%),
    linear-gradient(to left, rgba(0, 0, 0, 0.08), transparent 3%),
    var(--sw-page-bg, #efe2c6);
}
${BOOK} .sw-page--back {
  background:
    linear-gradient(to left, var(--sw-r-fold-1), transparent 18%),
    var(--sw-page-bg, #efe2c6);
}
${BOOK} .sw-spine {
  position: absolute;
  top: 0;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(90deg, var(--sw-r-fold-1), rgba(0, 0, 0, 0.58) 50%, var(--sw-r-fold-1)),
    var(--sw-page-bg, #efe2c6);
}

/* ── Running header and page numbers (outside the text clip) ── */
${R} .sw-page-header,
${R} .sw-page-number {
  position: absolute;
  overflow: hidden;
  color: var(--sw-r-muted);
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}
${R} .sw-page-header {
  left: var(--sw-pad-x);
  right: var(--sw-pad-x);
  top: calc(var(--sw-pad-y) * 0.6);
  text-align: center;
  font-size: clamp(9px, 0.64em, 13px);
  letter-spacing: 0.14em;
  font-variant-caps: all-small-caps;
}
${R} .sw-page-number {
  bottom: calc(var(--sw-pad-y) * 0.55);
  font-size: clamp(10px, 0.74em, 14px);
  letter-spacing: 0.06em;
  font-variant-numeric: oldstyle-nums;
}
${R} .sw-page-number--left {
  left: var(--sw-pad-x);
}
${R} .sw-page-number--right {
  right: var(--sw-pad-x);
}
${R} .sw-page-number--single {
  left: 0;
  right: 0;
  text-align: center;
}

/* ── Pagination: a clip viewport over one horizontal track of multi-column chapter blocks ── */
${R} .sw-viewport {
  position: absolute;
  z-index: 2;
  overflow: hidden;
  direction: ltr;
}
${R} .sw-track {
  display: flex;
  align-items: stretch;
  height: 100%;
}
${R} .sw-block {
  position: relative;
  flex: 0 0 auto;
  height: var(--sw-text-h);
}
${R} .sw-columns {
  width: var(--sw-text-w);
  height: var(--sw-text-h);
  column-width: var(--sw-text-w);
  column-gap: var(--sw-gap);
  column-fill: auto;
  overflow: visible;
  text-align: justify;
  hyphens: auto;
  -webkit-hyphens: auto;
  overflow-wrap: break-word;
  orphans: 2;
  widows: 2;
  font-kerning: normal;
  font-variant-ligatures: common-ligatures;
}
${R} .sw-columns ::selection {
  background: color-mix(in srgb, var(--sw-r-accent) 26%, transparent);
}

/* ── Chapter openings ── */
${R} .sw-chapter-head {
  padding-top: calc(var(--sw-text-h) * 0.09);
  margin-bottom: 1.3em;
  text-align: center;
  hyphens: manual;
  break-inside: avoid;
  user-select: none;
  -webkit-user-select: none;
}
${R} .sw-block--ghost .sw-chapter-head {
  opacity: 0.45;
}
${R} .sw-chapter-label {
  color: var(--sw-r-accent);
  font-size: 0.82em;
  letter-spacing: 0.26em;
  text-indent: 0.26em;
  font-variant-caps: all-small-caps;
}
${R} .sw-ornament {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7em;
  width: min(70%, 14em);
  margin: 0.45em auto 0;
  color: var(--sw-r-accent);
  font-size: 0.9em;
  line-height: 1;
}
${R} .sw-ornament::before,
${R} .sw-ornament::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, currentColor);
  opacity: 0.5;
}
${R} .sw-ornament::after {
  background: linear-gradient(90deg, currentColor, transparent);
}

/* ── The text ── */
${R} .sw-body {
  position: relative;
  min-height: 1.55em;
  outline: none;
  caret-color: var(--sw-r-accent);
}
${R} .sw-body :is(p, div) {
  margin: 0;
}
/* Indent every paragraph but the first after a heading, a scene break or a quote. */
${R} .sw-body :is(p, div) + :is(p, div) {
  text-indent: 1.4em;
}
${R} .sw-body :is(h1, h2, h3) {
  font-weight: 400;
  line-height: 1.25;
  text-align: center;
  text-indent: 0;
  hyphens: manual;
  break-after: avoid;
}
${R} .sw-body h1 {
  margin: 0 0 1.1em;
  font-size: 1.5em;
  font-style: italic;
}
${R} .sw-body h2 {
  margin: 1.1em 0 0.7em;
  font-size: 1.2em;
}
${R} .sw-body h3 {
  margin: 1em 0 0.6em;
  font-size: 1em;
  letter-spacing: 0.1em;
  font-variant-caps: all-small-caps;
}
${R} .sw-body > :is(h1, h2, h3):first-child {
  margin-top: 0;
}
${R} .sw-body hr {
  height: auto;
  margin: 0.7em 0;
  border: 0;
  overflow: visible;
  color: var(--sw-r-muted);
  text-align: center;
}
${R} .sw-body hr::before {
  content: "⁂";
  display: block;
  font-size: 1.35em;
  line-height: 1.25;
  letter-spacing: 0.2em;
}
${R} .sw-body blockquote {
  margin: 0.6em 1.2em;
  font-style: italic;
}
${R} .sw-body blockquote :is(p, div) + :is(p, div) {
  text-indent: 0;
  margin-top: 0.4em;
}
/* A drop cap and a small-caps first line open every chapter of the book; a one-line opening still clears the cap. */
${BOOK} .sw-body > p:first-child,
${BOOK} .sw-body > :is(h1, h2, h3):first-child + p {
  display: flow-root;
}
${BOOK} .sw-body > p:first-child::first-letter,
${BOOK} .sw-body > :is(h1, h2, h3):first-child + p::first-letter {
  float: left;
  margin: 0.06em 0.09em 0 0;
  padding: 0;
  color: var(--sw-r-accent);
  font-size: 3.2em;
  font-style: normal;
  font-weight: 400;
  line-height: 0.82;
}
${BOOK} .sw-body > p:first-child::first-line,
${BOOK} .sw-body > :is(h1, h2, h3):first-child + p::first-line {
  font-variant-caps: small-caps;
  letter-spacing: 0.03em;
}
${R} .sw-body[data-empty="true"]::before {
  content: attr(data-placeholder);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  color: var(--sw-r-muted);
  font-style: italic;
  text-align: center;
  text-indent: 0;
  pointer-events: none;
}
${R} .sw-body[data-empty="true"]:focus::before {
  opacity: 0.5;
}
/* The quill still moving at the end of the chapter being written. */
${R} .sw-body[data-generating="true"] > :is(p, div):last-child::after {
  content: "";
  display: inline-block;
  width: 0.55em;
  height: 0.12em;
  margin-left: 0.2em;
  background: var(--sw-r-accent);
  vertical-align: baseline;
  animation: sw-reader-quill 1.1s ease-in-out infinite;
}
@keyframes sw-reader-quill {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
}

/* ── Title page ── */
${R} .sw-title-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55em;
  width: var(--sw-text-w);
  height: var(--sw-text-h);
  overflow: hidden;
  text-align: center;
  user-select: none;
  -webkit-user-select: none;
}
${R} .sw-title-text {
  display: -webkit-box;
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  font-size: 1.9em;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 0.03em;
  font-variant-caps: small-caps;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}
${R} .sw-title-details {
  max-width: 100%;
  margin: 0;
  color: var(--sw-r-muted);
  font-size: 0.86em;
  font-style: italic;
  line-height: 1.4;
}
/* On a short page Mari shrinks first, so the hint and the button always fit. */
${R} .sw-title-page > * {
  flex: none;
}
${R} .sw-title-page > .sw-title-start {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  align-items: center;
  gap: 0.45em;
  min-height: 0;
  margin-top: 0.8em;
}
${R} .sw-title-start > * {
  flex: none;
}
${R} .sw-title-start > .sw-title-mari {
  display: block;
  flex: 0 1 auto;
  width: auto;
  height: auto;
  min-height: 48px;
  max-width: 72%;
  max-height: calc(var(--sw-text-h) * 0.42);
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
}
${R} .sw-title-hint {
  margin: 0;
  color: var(--sw-r-muted);
  font-size: 0.9em;
  font-style: italic;
}
${R} .sw-title-start-button {
  min-height: 40px;
  padding: 0.35em 1.2em;
  border: 1px solid color-mix(in srgb, var(--sw-r-accent) 55%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--sw-r-accent) 9%, transparent);
  color: var(--sw-r-accent);
  font: inherit;
  font-size: 0.82em;
  letter-spacing: 0.14em;
  font-variant-caps: all-small-caps;
  cursor: pointer;
}
@media (hover: hover) {
  ${R} .sw-title-start-button:hover {
    background: color-mix(in srgb, var(--sw-r-accent) 16%, transparent);
  }
}

/* ── The e-reader: a device with a bezel, a screen and almost no chrome ── */
${EBOOK} .sw-book {
  border-radius: clamp(16px, calc(var(--sw-page-w) * 0.06), 36px);
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.1), transparent 35%, transparent 70%, rgba(0, 0, 0, 0.25)),
    var(--sw-bezel, #1d1d20);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.07),
    inset 0 -2px 3px rgba(0, 0, 0, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 24px 60px -18px rgba(0, 0, 0, 0.6);
}
${DARK}[data-theme="ebook"] .sw-book {
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.06), transparent 35%, transparent 70%, rgba(0, 0, 0, 0.3)),
    var(--sw-bezel, #050506);
}
${EBOOK} .sw-pages {
  border-radius: 6px;
  background: var(--sw-page-bg, #f5f2ea);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
}
${EBOOK} .sw-pages::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: inherit;
  box-shadow: inset 0 1px 5px rgba(0, 0, 0, 0.18);
  pointer-events: none;
}
${EBOOK} .sw-page {
  background: var(--sw-page-bg, #f5f2ea);
}
${DARK}[data-theme="ebook"] .sw-page,
${DARK}[data-theme="ebook"] .sw-pages {
  background: var(--sw-page-bg, #16171a);
}
${EBOOK} :is(.sw-page--left, .sw-page--single) {
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
}
${EBOOK} :is(.sw-page--right, .sw-page--single) {
  border-top-right-radius: 6px;
  border-bottom-right-radius: 6px;
}
${EBOOK} :is(.sw-page-header, .sw-page-number) {
  font-family: var(--sw-ui-font, system-ui, sans-serif);
  font-size: 11px;
  letter-spacing: 0.02em;
  font-variant-caps: normal;
  font-variant-numeric: tabular-nums;
}
${EBOOK} .sw-page-header {
  top: max(8px, calc(var(--sw-pad-y) * 0.7));
}
${EBOOK} .sw-page-number {
  bottom: max(14px, calc(var(--sw-pad-y) * 0.9));
}
${R} .sw-progress {
  position: absolute;
  bottom: 7px;
  z-index: 3;
  height: 2px;
  border-radius: 2px;
  background: color-mix(in srgb, currentColor 14%, transparent);
  pointer-events: none;
}
${R} .sw-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, currentColor 55%, transparent);
  transition: width 0.3s ease;
}
${EBOOK} .sw-chapter-label {
  color: var(--sw-r-muted);
  font-family: var(--sw-ui-font, system-ui, sans-serif);
  font-size: 0.64em;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  font-variant-caps: normal;
}
${EBOOK} .sw-ornament {
  gap: 0;
  width: 3em;
  color: var(--sw-r-muted);
}
${EBOOK} .sw-ornament > span {
  display: none;
}
${EBOOK} .sw-body h1 {
  font-size: 1.45em;
  font-style: normal;
  font-weight: 600;
}

/* ── Arrows and the chapter indicator ── */
${R} .sw-nav-arrow {
  position: absolute;
  z-index: 8;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--sw-panel-border, rgba(255, 255, 255, 0.14));
  border-radius: 999px;
  background: color-mix(in srgb, var(--sw-panel-bg, #1c1611) 76%, transparent);
  color: var(--sw-panel-fg, #f1e6d2);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
${R} .sw-nav-arrow:disabled {
  opacity: 0.28;
  box-shadow: none;
  cursor: default;
}
${R}[data-arrows="inside"] .sw-nav-arrow {
  width: 40px;
  height: 56px;
  border-radius: 14px;
  opacity: 0.6;
}
${R}[data-arrows="inside"] .sw-nav-arrow:disabled {
  opacity: 0;
  pointer-events: none;
}
@media (hover: hover) {
  ${R} .sw-nav-arrow:not(:disabled):hover {
    opacity: 1;
    transform: scale(1.06);
  }
}
${R} :is(.sw-nav-arrow, .sw-reader-footer-bar button, .sw-title-start-button):focus-visible {
  outline: 2px solid var(--sw-r-accent);
  outline-offset: 2px;
  opacity: 1;
}
${R} .sw-reader-footer {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  pointer-events: none;
}
${R} .sw-reader-footer-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 2px;
  border: 1px solid var(--sw-panel-border, rgba(255, 255, 255, 0.12));
  border-radius: 999px;
  background: color-mix(in srgb, var(--sw-panel-bg, #1c1611) 70%, transparent);
  color: var(--sw-panel-fg, #f1e6d2);
  font-family: var(--sw-ui-font, system-ui, sans-serif);
  font-size: 12.5px;
  line-height: 1;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}
${R} .sw-reader-footer-bar button {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
${R} .sw-reader-footer-bar button:disabled {
  opacity: 0.3;
  cursor: default;
}
@media (hover: hover) {
  ${R} .sw-reader-footer-bar button:not(:disabled):hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
}
${R} .sw-indicator {
  min-width: 0;
  padding: 0 0.5em;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}

/* ── The page turn (see page-flip.ts) ── */
${R} .sw-flip-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}
${R} .sw-flip {
  position: absolute;
  inset: 0;
}
${R} .sw-flip-leaf {
  transform-style: preserve-3d;
  will-change: transform;
}
${R} :is(.sw-flip-front, .sw-flip-back) {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
${R} .sw-flip-back {
  transform: rotateY(180deg);
}
${R} .sw-flip-leaf > .sw-page {
  box-shadow: 0 0 18px rgba(0, 0, 0, 0.22);
}
${R} .sw-flip-text {
  position: absolute;
  overflow: hidden;
}
${R} .sw-flip-shade {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}
${R} :is(.sw-page--right, .sw-page--single) > .sw-flip-shade {
  background: linear-gradient(to right, rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0.12) 45%, rgba(0, 0, 0, 0.02));
}
${R} :is(.sw-page--left, .sw-page--back) > .sw-flip-shade {
  background: linear-gradient(to left, rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0.12) 45%, rgba(0, 0, 0, 0.02));
}
${R} .sw-flip-reveal {
  pointer-events: none;
}
${R} .sw-flip-reveal--right {
  background: linear-gradient(to right, rgba(0, 0, 0, 0.38), rgba(0, 0, 0, 0.1) 30%, transparent 60%);
}
${R} .sw-flip-reveal--left {
  background: linear-gradient(to left, rgba(0, 0, 0, 0.38), rgba(0, 0, 0, 0.1) 30%, transparent 60%);
}

@media (prefers-reduced-motion: reduce) {
  ${R} *,
  ${R} *::before,
  ${R} *::after {
    animation: none !important;
    transition: none !important;
  }
  ${R} .sw-flip-layer {
    display: none;
  }
}
`;
