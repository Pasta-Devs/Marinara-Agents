// Beholder 1.3.6 — Marinara Engine roleplay-toolbar capability (single-file client bundle)
// Built from packages/beholder/src (7 modules) by scripts/build-beholder-package.mjs. Do not edit; edit src/ and rebuild.
(() => {
"use strict";
const BH_STYLE_CSS = "/* Beholder extension — settings drawer + floating state panel + paper-doll mode\n   ─────────────────────────────────────────────────────────────────────────\n   Design system: \"Tactical Codex\" — refined editorial dark-mode UI.\n   - Cinzel for headings (panel title, char name) — engraved nameplate feel\n   - JetBrains Mono for data labels (slot names, drawer section caps, gauges)\n   - Body inherits host font\n   - Type/space/color tokens declared on .beholder-panel ↓\n   ───────────────────────────────────────────────────────────────────────── */\n\n/* Remote webfont @import removed for packaging: a catalog package must not\n   fetch from third-party hosts. Display face falls back to var(--font-sans). */\n/* Settings drawer — grouped sections with helper text. */\n#beholder_settings small.opacity50p {\n    display: block;\n    margin-top: 6px;\n    opacity: 0.6;\n    font-size: 0.85em;\n}\n.bh-settings-main-toggle {\n    padding: 6px 8px;\n    margin-bottom: 6px;\n    background: rgba(255, 255, 255, 0.025);\n    border: 1px solid rgba(255, 255, 255, 0.08);\n    border-radius: 6px;\n}\n.bh-settings-section {\n    margin: 8px 0;\n    padding: 0;\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.08));\n    border-radius: 6px;\n    background: rgba(255, 255, 255, 0.015);\n}\n.bh-settings-section > summary {\n    cursor: pointer;\n    padding: 7px 10px;\n    list-style: none;\n    user-select: none;\n    font-size: 0.95em;\n    border-radius: 6px;\n    position: relative;\n    padding-right: 24px;\n}\n.bh-settings-section > summary::-webkit-details-marker { display: none; }\n.bh-settings-section > summary::after {\n    content: \"›\";\n    position: absolute;\n    right: 12px;\n    top: 50%;\n    transform: translateY(-50%) rotate(0deg);\n    transition: transform 0.18s;\n    opacity: 0.5;\n    font-size: 1.2em;\n}\n.bh-settings-section[open] > summary::after {\n    transform: translateY(-50%) rotate(90deg);\n}\n.bh-settings-section > summary b { color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary))); }\n.bh-settings-body {\n    padding: 0 10px 10px;\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n}\n.bh-settings-body label:not(.checkbox_label) {\n    font-size: 0.88em;\n    opacity: 0.85;\n    margin-top: 6px;\n}\n.bh-settings-body .checkbox_label { margin-top: 6px; }\n.bh-help {\n    display: block;\n    margin-top: 2px;\n    margin-bottom: 4px;\n    opacity: 0.55;\n    font-size: 0.78em;\n    line-height: 1.4;\n}\n.bh-help-inline {\n    margin-left: 4px;\n    opacity: 0.6;\n    font-size: 0.85em;\n    font-weight: normal;\n    font-style: italic;\n}\n.bh-help code,\n.bh-settings-body code {\n    background: rgba(255, 255, 255, 0.06);\n    padding: 1px 5px;\n    border-radius: 3px;\n    font-size: 0.92em;\n}\n.bh-settings-buttons {\n    gap: 6px;\n    margin-top: 8px;\n}\n\n/* ─── Floating state panel ────────────────────────────────────────────── */\n\n.beholder-panel {\n    position: fixed;\n    z-index: 9000;\n    width: min(420px, calc(100vw - 40px));\n    max-height: 86vh;\n    min-width: 240px;\n    min-height: 180px;\n    /* Fixed-width panel (no resize). Container queries below auto-switch\n       to the single-column list layout when the panel is narrow. */\n    overflow: hidden;\n    display: flex;\n    flex-direction: column;\n    background: var(--SmartThemeBlurTintColor, rgba(20, 20, 24, 0.92));\n    color: var(--SmartThemeBodyColor, #e0e0e0);\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.15));\n    border-radius: 12px;\n    box-shadow:\n        0 1px 0 rgba(255, 255, 255, 0.05) inset,\n        0 12px 40px rgba(0, 0, 0, 0.5);\n    backdrop-filter: blur(10px);\n    -webkit-backdrop-filter: blur(10px);\n    user-select: none;\n\n    /* ────── DESIGN TOKENS ──────────────────────────────────────────────\n       Every panel-scoped value should reference one of these. Adding a\n       new font-size or padding without a token is a design-system bug. */\n\n    /* Master scale knob. The host updates it from the floating window's\n       available width and height so chrome, cards, and the doll scale together. */\n    --bh-ui-scale: 1.1;\n    font-size: calc(0.875em * var(--bh-ui-scale));\n\n    /* Type ramp (em, relative to panel base). Five steps, named by role —\n       NOT by size. Use the role, not the number, when picking. */\n    --bh-text-meta:      0.78em;   /* slot caps, POV hint, tab pulse */\n    --bh-text-secondary: 0.875em;  /* species, gauge label, drawer hint */\n    --bh-text-body:      1em;      /* chips, tabs, drawer buttons */\n    --bh-text-large:     1.143em;  /* panel title, gauge value, drawer focus */\n    --bh-text-display:   1.357em;  /* char name */\n\n    /* Font families. Scoped via `font-family: var(--bh-font-display)` etc.\n       so the host site's body font keeps governing default text — these\n       only apply where we explicitly opt in. */\n    --bh-font-display: \"Cinzel\", \"Trajan Pro\", \"Georgia\", serif;\n    --bh-font-data:    \"JetBrains Mono\", \"SF Mono\", \"Menlo\", \"Consolas\", monospace;\n\n    /* Spacing scale — multiples of 4. Em-based so it co-scales with the type. */\n    --bh-space-1: 0.286em;   /*  4px @ 14px base */\n    --bh-space-2: 0.571em;   /*  8px */\n    --bh-space-3: 0.857em;   /* 12px */\n    --bh-space-4: 1.143em;   /* 16px */\n    --bh-space-5: 1.714em;   /* 24px */\n\n    /* Color roles — neutrals layered over the host theme background. Used\n       for elevated/inset surfaces and divider strengths. */\n    --bh-surface-1: rgba(255, 255, 255, 0.025);  /* inset (drawer, gauge bg) */\n    --bh-surface-2: rgba(255, 255, 255, 0.05);   /* elevated (header, hover) */\n    --bh-surface-3: rgba(255, 255, 255, 0.085);  /* pressed / active control */\n    --bh-divider:   rgba(255, 255, 255, 0.08);   /* hairline dividers */\n    --bh-border:    rgba(255, 255, 255, 0.18);   /* control borders, focus */\n\n    /* Opacity roles — apply via opacity: var(...) for consistent muting. */\n    --bh-mute-strong: 0.45;  /* meta, POV hint */\n    --bh-mute-soft:   0.7;   /* secondary text */\n    --bh-mute-none:   1;     /* primary */\n}\n/* When user has manually resized, drop the max-height cap so their size sticks. */\n.beholder-panel[data-resized=\"true\"] {\n    max-height: none;\n}\n\n/* (Legacy data-mode rules removed — only one layout now. Mobile is\n   handled via @container query below.) */\n\n/* No tracked state renders a full-size default-human placeholder (same width +\n   chrome as a populated panel) so the extension shows at its real size on first\n   open, with all header tools visible. data-empty only mutes the placeholder\n   name + caption and drops its interactive view controls (it's visual-only\n   until real state arrives). */\n.beholder-panel[data-empty=\"true\"] .bh-char-name {\n    opacity: 0.4;\n}\n.beholder-panel[data-empty=\"true\"] .bh-figure-controls {\n    display: none;\n}\n.bh-placeholder-note {\n    margin: 14px 14px 6px;\n    padding: 10px 14px;\n    text-align: center;\n    font-size: var(--bh-text-secondary);\n    line-height: 1.5;\n    color: var(--bh-gold, var(--bh-chroma, var(--primary)));\n    background: linear-gradient(160deg, color-mix(in srgb, var(--bh-accent) 14%, transparent), color-mix(in srgb, var(--bh-accent) 4%, transparent));\n    border: 1px solid color-mix(in srgb, var(--bh-accent) 40%, transparent);\n    border-radius: 8px;\n}\n.bh-placeholder-note b { color: var(--bh-chroma, var(--primary)); font-weight: 600; }\n\n/* Note/intent bar mounted above the chat input: input grows, the apply button\n   sits to its right (not stacked under). */\n.beholder-notebox {\n    display: flex;\n    gap: var(--bh-space-2, 6px);\n    align-items: stretch;\n    margin: 4px 0;\n}\n.beholder-notebox .beholder-notebox-input { flex: 1 1 auto; min-width: 0; }\n.beholder-notebox .beholder-notebox-btn { flex: 0 0 auto; }\n\n.beholder-panel.beholder-dragging {\n    opacity: 0.85;\n}\n\n.beholder-panel-header {\n    position: relative;\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    background: var(--bh-surface-2);\n    border-bottom: 1px solid var(--bh-divider);\n    cursor: move;\n}\n/* Hairline accent rule across the top of the header — quiet brand mark.\n   Fades in from the left edge so the panel feels \"anchored\" on its left side. */\n.beholder-panel-header::before {\n    content: \"\";\n    position: absolute;\n    left: 0; right: 0; top: 0;\n    height: 1px;\n    background: linear-gradient(\n        90deg,\n        var(--bh-accent, var(--primary)) 0%,\n        color-mix(in srgb, var(--bh-accent) 40%, transparent) 22%,\n        transparent 60%\n    );\n    pointer-events: none;\n    opacity: 0.7;\n}\n.beholder-panel-title {\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-large);\n    font-weight: 600;\n    letter-spacing: 0.12em;\n    color: var(--SmartThemeBodyColor, #e8eaee);\n}\n\n.beholder-panel-controls {\n    display: flex;\n    gap: var(--bh-space-2);\n    font-size: var(--bh-text-body);\n    flex-wrap: wrap;\n    justify-content: flex-end;\n}\n\n.beholder-panel-controls .fa-solid,\n.beholder-tool-btn {\n    cursor: pointer;\n    opacity: var(--bh-mute-soft);\n    transition: opacity 0.15s, color 0.15s, transform 0.15s;\n}\n/* Header tool icons + active control bump slightly larger than the\n   backfill chevrons so the tool row reads as the primary actions. */\n.beholder-panel-controls .fa-solid,\n.beholder-tool-btn { font-size: 1.08em; padding: 4px; }\n.beholder-panel-controls .fa-solid:hover {\n    opacity: 1;\n    color: var(--bh-accent, var(--primary));\n}\n.beholder-panel-controls .fa-solid:active {\n    transform: scale(0.92);\n}\n\n/* ─── Layer bar ──────────────────────────────────────────────────────────\n   Sits directly under the header as a permanent control strip. Reads like\n   the legend row on a vintage anatomical chart: hairline divider above and\n   below, JetBrains Mono small-caps labels, a thin \"engagement bar\" beneath\n   each active layer instead of a chunky fill. Off layers fade to mute-strong\n   so the user can see at a glance which dimensions of the state are hidden.\n\n   Disengaged label gets a thin double-strike instead of an underline — a\n   subtle \"redacted\" cue that echoes editorial typography.                   */\n.beholder-layer-bar {\n    display: grid;\n    grid-template-columns: repeat(3, 1fr);\n    gap: 0;\n    padding: var(--bh-space-1) var(--bh-space-3) calc(var(--bh-space-1) + 1px);\n    background: var(--bh-surface-1);\n    border-bottom: 1px solid var(--bh-divider);\n    position: relative;\n}\n/* Bracket marks at both ends, the way an instrument bezel anchors a scale. */\n.beholder-layer-bar::before,\n.beholder-layer-bar::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    width: 4px;\n    height: 9px;\n    border: 1px solid var(--bh-divider);\n    transform: translateY(-50%);\n    pointer-events: none;\n}\n.beholder-layer-bar::before { left: var(--bh-space-2); border-right: none;  }\n.beholder-layer-bar::after  { right: var(--bh-space-2); border-left:  none; }\n\n.bh-layer-cell {\n    position: relative;\n    cursor: pointer;\n    user-select: none;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    padding: var(--bh-space-1) 0 calc(var(--bh-space-1) + 2px);\n    min-width: 0;\n}\n.bh-layer-cell input {\n    position: absolute;\n    opacity: 0;\n    pointer-events: none;\n}\n.bh-layer-cell span {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 500;\n    letter-spacing: 0.22em;\n    text-transform: uppercase;\n    color: var(--bh-body);\n    opacity: var(--bh-mute-strong);\n    line-height: 1;\n    text-align: center;\n    transition: opacity 0.12s ease, color 0.12s ease, letter-spacing 0.12s ease;\n    position: relative;\n    padding: 1px 2px 3px;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: clip;\n}\n/* Disengaged: a thin overstrike line through the label — editorial \"redacted\"\n   cue, gentler than strikethrough. Drawn as a pseudo-element so it doesn't\n   shift typographic metrics. */\n.bh-layer-cell span::before {\n    content: \"\";\n    position: absolute;\n    left: 8%; right: 8%;\n    top: calc(50% - 1px);\n    height: 1px;\n    background: currentColor;\n    opacity: 0.35;\n    transition: opacity 0.12s ease, transform 0.12s ease;\n    transform-origin: center;\n}\n/* Engagement bar — the \"instrument\" cue. Sits beneath the label, drawn as\n   the cell's own pseudo so it tracks cell width, not text width. */\n.bh-layer-cell::after {\n    content: \"\";\n    position: absolute;\n    left: 18%; right: 18%;\n    bottom: 0;\n    height: 2px;\n    background: var(--bh-accent, var(--primary));\n    transform: scaleX(0);\n    transform-origin: center;\n    transition: transform 0.18s ease, opacity 0.18s ease;\n    opacity: 0;\n}\n.bh-layer-cell:hover span {\n    opacity: var(--bh-mute-none);\n    color: var(--bh-accent, var(--primary));\n}\n.bh-layer-cell:hover span::before { opacity: 0; }\n.bh-layer-cell:hover::after {\n    transform: scaleX(0.55);\n    opacity: 0.55;\n}\n.bh-layer-cell input:checked + span {\n    opacity: var(--bh-mute-none);\n    color: var(--SmartThemeBodyColor, #e8eaee);\n    letter-spacing: 0.26em;        /* fractionally widens — \"tuned in\" */\n}\n.bh-layer-cell input:checked + span::before { opacity: 0; }\n.bh-layer-cell:has(input:checked)::after {\n    transform: scaleX(1);\n    opacity: 1;\n}\n.bh-layer-cell input:focus-visible + span {\n    outline: 1px dashed var(--bh-accent);\n    outline-offset: 3px;\n}\n\n/* Narrow container: tighten letter-spacing so labels still fit on 4 cells. */\n@container bhpanel (max-width: 320px) {\n    .bh-layer-cell span { letter-spacing: 0.14em; font-size: 0.72em; }\n    .bh-layer-cell input:checked + span { letter-spacing: 0.18em; }\n}\n\n.beholder-panel-body {\n    padding: var(--bh-space-3) var(--bh-space-3) var(--bh-space-4);\n    overflow-y: auto;\n    /* Vertical scrolls; horizontal is CLIPPED (never spills past the panel border).\n       `clip` (not `hidden`) adds no scrollbar and composes with overflow-y:auto. The\n       grid/wrap fixes above make content FIT; this is the belt-and-suspenders so a\n       stray wide card can never poke over the right edge again. */\n    overflow-x: clip;\n    flex: 1;\n    /* Subtle scrollbar tuning to feel integrated rather than borrowed. */\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n}\n.beholder-panel-body::-webkit-scrollbar { width: 6px; }\n.beholder-panel-body::-webkit-scrollbar-track { background: transparent; }\n.beholder-panel-body::-webkit-scrollbar-thumb {\n    background: var(--bh-border);\n    border-radius: 3px;\n}\n\n\n.bh-empty-text {\n    color: var(--SmartThemeBodyColor, #888);\n    opacity: var(--bh-mute-soft);\n    text-align: center;\n    padding: var(--bh-space-2) 0;\n    font-size: var(--bh-text-secondary);\n    font-style: italic;\n}\n\n/* ─── Compact mode (legacy text list) ─────────────────────────────────── */\n\n.beholder-char {\n    margin-bottom: 10px;\n    padding-bottom: 8px;\n    border-bottom: 1px dashed var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.08));\n}\n.beholder-char:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }\n.beholder-char-name {\n    font-weight: 600;\n    margin-bottom: 4px;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n}\n.beholder-species {\n    font-weight: normal;\n    opacity: 0.5;\n    font-size: 0.85em;\n    margin-left: 6px;\n}\n.beholder-row { line-height: 1.5; word-wrap: break-word; }\n.beholder-label {\n    display: inline-block;\n    min-width: 60px;\n    opacity: 0.55;\n    font-size: 0.8em;\n    text-transform: uppercase;\n    letter-spacing: 0.4px;\n}\n.beholder-item { margin-right: 4px; }\n.beholder-slot { opacity: 0.45; font-size: 0.85em; font-style: italic; }\n.beholder-wound { color: #ff7676; }\n.beholder-dmg-warn { color: var(--bh-chroma, var(--primary)); }\n.beholder-dmg-bad  { color: #ff8585; }\n\n/* ─── Doll mode ───────────────────────────────────────────────────────── */\n\n/* Tier color scale — drives slot row borders + damage chips */\n.beholder-panel {\n    --bh-tier-0: #6ad48b; /* pristine, lightly worn */\n    --bh-tier-1: var(--bh-chroma); /* frayed, soiled */\n    --bh-tier-2: #e9933b; /* damaged, cracked */\n    --bh-tier-3: #e26464; /* torn, bloodstained */\n    --bh-tier-4: #8c3030; /* tatters, ruined */\n    /* Legacy token names remain aliases so the imported renderer stays small,\n       but every interface accent follows the host theme. */\n    --bh-gold: var(--bh-chroma);\n    --bh-gold-deep: var(--bh-accent);\n    --bh-gold-soft: color-mix(in srgb, var(--bh-chroma) 82%, var(--foreground));\n    --bh-holding: var(--bh-gold);\n    --bh-body: var(--SmartThemeBodyColor, #cfd2d6);\n    --bh-body-soft: color-mix(in srgb, var(--bh-body) 25%, transparent);\n    --bh-accent: var(--bh-accent-pref, var(--primary));\n    --bh-wound: #ff5252;\n}\n\n/* Character tabs — name nav for multi-char chats. Wraps to multiple rows\n   when there are more tabs than fit on one row (instead of horizontal\n   scrolling, which hides off-screen characters). */\n.bh-tabs {\n    display: flex;\n    flex-wrap: wrap;\n    gap: var(--bh-space-1) var(--bh-space-2);\n    margin-bottom: var(--bh-space-3);\n    padding-bottom: var(--bh-space-1);\n    border-bottom: 1px solid var(--bh-divider);\n}\n.bh-tab {\n    background: transparent;\n    border: none;\n    color: var(--bh-body);\n    padding: var(--bh-space-1) var(--bh-space-2) var(--bh-space-1);\n    font: inherit;\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-body);\n    letter-spacing: 0.06em;\n    cursor: pointer;\n    opacity: 0.55;\n    border-bottom: 2px solid transparent;\n    transition: opacity 0.15s, border-color 0.15s, color 0.15s;\n    white-space: nowrap;\n}\n.bh-tab:hover { opacity: 0.85; }\n.bh-tab-active {\n    opacity: 1;\n    border-bottom-color: var(--bh-accent);\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    font-weight: 600;\n}\n\n/* Multi-char \"updated\" indicator. Critical for the multi-char RP case:\n   when Maggie's state changes while Tim's tab is active, the dot on\n   Maggie's tab signals \"she changed, click to see.\" */\n.bh-tab-updated {\n    opacity: 0.85;\n    color: var(--bh-accent);\n}\n.bh-tab-updated .bh-tab-pulse {\n    color: var(--bh-accent);\n    font-size: var(--bh-text-meta);\n    margin-left: var(--bh-space-1);\n    vertical-align: middle;\n}\n/* Absent — character is tracked but not currently in the scene. Tab stays\n   clickable (last-known state preserved) but reads as \"on the roster, not\n   here right now\": dimmed, italic, no accent. Hover brightens slightly so\n   it's clear the tab is still interactive. */\n.bh-tab-absent {\n    opacity: 0.38;\n    font-style: italic;\n}\n.bh-tab-absent:hover { opacity: 0.7; }\n.bh-tab-absent.bh-tab-active {\n    /* If user explicitly views an absent char, lift the dim a little so\n       their state is readable, but keep italic so the off-scene status is\n       still legible. */\n    opacity: 0.72;\n}\n\n.bh-char-doll {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n}\n\n.bh-char-head {\n    display: flex;\n    align-items: baseline;\n    gap: var(--bh-space-3);\n    padding: var(--bh-space-1) 0 var(--bh-space-2);\n    border-bottom: 1px solid var(--bh-divider);\n    margin-bottom: var(--bh-space-2);\n    position: relative;\n}\n/* Decorative inscription rule under the character name — codex page feel.\n   Sits over the head's bottom border, accenting the left edge. */\n.bh-char-head::after {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    bottom: -1px;\n    width: 32px;\n    height: 1px;\n    background: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    opacity: 0.55;\n}\n.bh-char-name {\n    font-family: var(--bh-font-display);\n    font-weight: 600;\n    font-size: var(--bh-text-display);\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    letter-spacing: 0.06em;\n    line-height: 1.15;\n}\n\n/* (Stamina gauge removed — the stamina field is no longer tracked. Any\n   residual gauge element is hidden via the .bh-char-head .bh-gauge\n   display:none rule appended below.) */\n.bh-char-species {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    font-weight: 600;\n    color: var(--primary, var(--bh-body));\n    opacity: 1;\n    letter-spacing: 0.08em;\n    text-transform: lowercase;\n    padding: 1px var(--bh-space-2);\n    border: 1px solid color-mix(in srgb, var(--primary, var(--bh-divider)) 45%, transparent);\n    border-radius: 3px;\n    background: color-mix(in srgb, var(--primary, var(--bh-surface-1)) 12%, transparent);\n}\n/* v0.4 (2026-06-03): `bh-char-gender` rules removed along with the gender\n   field. The wings rules below are kept defensively in case a v0.5+ state\n   still emits a `wings` slot — they harmlessly do nothing when paperdoll.js\n   never renders the element. */\n.bh-char-species::before {\n    content: \"·\";\n    margin-right: 4px;\n    opacity: 0.5;\n}\n\n/* The 3-col grid: left labels | silhouette | right labels */\n.bh-doll-grid {\n    display: grid;\n    /* minmax(0, 1fr) — NOT bare 1fr. A bare `1fr` track has an implicit min of\n       min-content, so a wide chip (a long item name) forces the side column — and the\n       whole grid — past the panel's right edge. minmax(0,…) lets the track shrink and\n       the content wrap/clip instead of overflowing. */\n    grid-template-columns: minmax(0, 1fr) calc(140px * var(--bh-ui-scale, 1)) minmax(0, 1fr);\n    gap: calc(6px * var(--bh-ui-scale, 1));\n    align-items: start;\n}\n.bh-doll-empty {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 4px;\n    padding: 4px 0;\n}\n.bh-figure { display: flex; justify-content: center; }\n\n.bh-col {\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n    min-width: 0;\n}\n.bh-col-empty { min-height: 1px; }\n\n/* ─── Narrow-viewport / ST sidebar adaptation ──────────────────────────\n   Container queries (not media queries) — the panel responds to its OWN\n   size, so it adapts whether it's narrow because of viewport (mobile) or\n   because the user docked it in a narrow ST sidebar. */\n.beholder-panel {\n    container-type: inline-size;\n    container-name: bhpanel;\n}\n/* ─── Mobile / narrow context = section digest (auto) ─────────────────────\n   Above 360px the panel is the paperdoll grid. Below, the digest takes\n   over: wounds → held → worn → state flags, sorted by IMPORTANCE rather\n   than by anatomy. The silhouette + slot cards aren't useful at narrow\n   widths once the spatial cue is gone — the digest reformats the same\n   data as a priority feed. Both are always rendered; CSS picks one. */\n.bh-digest { display: none; }\n@container bhpanel (max-width: 360px) {\n    .bh-doll-grid     { display: none; }\n    .bh-doll-grid.bh-paired { display: none; }\n    .bh-digest        { display: block; }\n    /* Auto-narrow always shows the digest; hide the digest-side layout\n       switch (the panel has no doll grid to switch between at this width). */\n    .bh-layout-switch-row { display: none; }\n    /* Header tools collapse to the overflow (⋯) trigger when narrow. */\n    .beholder-tool-btn { display: none; }\n    .beholder-tools-more { display: inline-block; }\n}\n\n/* Per-slot CARD: one card per anatomical slot, contains chips for each\n   worn item / held item / wound that belongs to it. Replaces the\n   one-row-per-thing layout (which repeated the slot name on every card).\n   The card's left border = worst damage tier across all items in that slot. */\n.bh-slot-card {\n    background: rgba(255, 255, 255, 0.035);\n    border: 1px solid rgba(255, 255, 255, 0.08);\n    border-radius: 6px;\n    padding: 4px 6px 5px 9px;\n    position: relative;\n    line-height: 1.3;\n    /* In paired mode the card IS the grid item (the .bh-col wrapper is display:contents),\n       so it needs its own min-width:0 to shrink below its content and let the text wrap\n       instead of forcing the track — and the panel — wider. */\n    min-width: 0;\n    font-size: 1em;\n}\n/* Card no longer carries a tier border — damage tier reads off each chip's\n   own left bar (CSS ::before below) so the colored stripes match each\n   chip's actual height. Empty card still gets faint outline via main\n   .bh-slot-card border style above. */\n\n/* Wound-count marker in the slot card header (✚ or ✚N for >1). */\n.bh-slot-card-head {\n    display: flex;\n    align-items: baseline;\n    justify-content: space-between;\n    gap: 6px;\n}\n/* (Slot-head wound mark removed — the wound chips inside the card already\n   say the same thing; the head-level glyph was duplicating info.) */\n/* Right-column = true mirror of left. Border anchors to the right edge\n   (toward the silhouette), and chip content reverses so dots/swatches/\n   glyphs cluster on the right side near the border, multi-slot tags\n   + wound marks float to the left. Text within each label still reads\n   left-to-right — only the element order flips. */\n.bh-col-right .bh-slot-card-head { flex-direction: row-reverse; }\n.bh-slot-card .bh-slot-name {\n    font-family: var(--bh-font-data);\n    font-size: 0.82em;          /* slot card scale already shrinks; bump back to readable */\n    font-weight: 500;\n    opacity: 0.65;\n    text-transform: lowercase;\n    letter-spacing: 0.06em;\n    font-style: normal;\n}\n\n/* Right-column cards mirror the border. */\n.bh-col-right .bh-slot-card { text-align: right; padding-left: 6px; padding-right: 9px; }\n.bh-col-right .bh-slot-card::before { inset: 0 0 0 auto; border-radius: 0 6px 6px 0; }\n\n/* Empty / ghost slot card: faint one-liner, no chips. Lets users see what\n   slots ARE available without dominating the visual. */\n.bh-slot-card.bh-slot-empty {\n    background: transparent;\n    border-style: dashed;\n    border-color: rgba(255, 255, 255, 0.05);\n    opacity: 0.35;\n    padding: 2px 6px 2px 9px;\n}\n.bh-slot-card.bh-slot-empty::before {\n    background: rgba(255, 255, 255, 0.06);\n}\n.bh-slot-card.bh-slot-empty:hover { opacity: 0.7; }\n\n/* Bare slot card (v0.3 — narration explicitly confirmed uncovered).\n   Skin-tone left bar + italic \"bare\" tag in the same slot as missing's tag.\n   Visually distinct from .bh-slot-empty (which means \"unknown / nothing said\").\n   Mutually exclusive with worn/items per schema, so no chips. */\n.bh-slot-card.bh-slot-bare {\n    background: rgba(220, 188, 156, 0.04);\n    border-style: solid;\n    border-color: rgba(220, 188, 156, 0.18);\n    opacity: 0.85;\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    padding: 4px 8px 4px 9px;\n}\n.bh-slot-card.bh-slot-bare::before {\n    background: linear-gradient(180deg, rgba(220, 188, 156, 0.5), rgba(220, 188, 156, 0.25));\n}\n.bh-slot-bare-tag {\n    color: rgba(220, 188, 156, 0.95);\n    font-family: var(--bh-font-data);\n    font-size: 0.78em;\n    text-transform: uppercase;\n    letter-spacing: 0.12em;\n    font-style: normal;\n    font-weight: 600;\n}\n.bh-slot-card.bh-slot-bare:hover {\n    opacity: 1;\n    border-color: rgba(220, 188, 156, 0.45);\n}\n\n/* ─── Layered worn-items staircase ──────────────────────────────────────\n   When a slot has >1 worn item (chest with gambeson + chainmail + breastplate),\n   each chip gets a left-side index gutter and a faint connector line. The\n   first chip is the outermost layer (per schema worn[0] = outer). */\n.bh-chip-layered {\n    display: flex;\n    align-items: stretch;\n    gap: var(--bh-space-1);\n    position: relative;\n}\n.bh-chip-layer-idx {\n    font-family: var(--bh-font-data);\n    font-size: 0.65em;\n    font-weight: 600;\n    color: var(--bh-body);\n    opacity: 0.4;\n    min-width: 10px;\n    text-align: center;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    flex-shrink: 0;\n    position: relative;\n}\n/* Connector line tying the indices into a vertical stack. */\n.bh-chip-layered:not(:first-child) .bh-chip-layer-idx::before {\n    content: \"\";\n    position: absolute;\n    top: -3px;\n    bottom: 50%;\n    width: 1px;\n    background: var(--bh-border);\n    opacity: 0.5;\n}\n.bh-chip-layered:not(:last-child) .bh-chip-layer-idx::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    bottom: -3px;\n    width: 1px;\n    background: var(--bh-border);\n    opacity: 0.5;\n}\n.bh-chip-layered:first-child .bh-chip-layer-idx { color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary))); opacity: 0.55; }\n.bh-chip-layered:hover .bh-chip-layer-idx       { opacity: 0.9; }\n/* Right-column layered chips mirror: index ends up on the right side (toward\n   the body), connector tick still runs vertically through the index gutter. */\n.bh-col-right .bh-chip-layered { flex-direction: row-reverse; }\n\n/* Missing / lost slot card: vertical gray slits, strikethrough on the slot\n   name, \"missing\" tag. Distinct from empty and off-body. */\n.bh-slot-card.bh-slot-missing {\n    background: repeating-linear-gradient(\n        90deg,\n        rgba(140, 140, 140, 0.07) 0px, rgba(140, 140, 140, 0.07) 1px,\n        transparent 1px, transparent 6px\n    );\n    border-style: dashed;\n    border-color: rgba(140, 140, 140, 0.3);\n    opacity: 0.65;\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    padding: 4px 8px 4px 9px;\n}\n.bh-slot-card.bh-slot-missing::before { background: rgba(140, 140, 140, 0.45); }\n.bh-slot-card.bh-slot-missing .bh-slot-name {\n    text-decoration: line-through;\n    opacity: 0.7;\n}\n.bh-slot-missing-tag {\n    color: rgba(160, 160, 160, 0.95);\n    font-family: var(--bh-font-data);\n    font-size: 0.78em;\n    text-transform: uppercase;\n    letter-spacing: 0.12em;\n    font-style: normal;\n    font-weight: 600;\n}\n.bh-slot-card.bh-slot-missing:hover {\n    opacity: 0.85;\n    border-color: rgba(160, 160, 160, 0.5);\n}\n\n/* Chips inside a slot card: one per item / wound. Damage tier shows as a\n   small dot before the item name; the card border still shows the worst\n   tier across all items, the per-chip dot tells you which item is which. */\n.bh-slot-chips {\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    margin-top: 2px;\n}\n.bh-chip {\n    display: flex;\n    flex-wrap: wrap;             /* allows the verbose sub-row to drop below */\n    align-items: baseline;\n    font-size: 1.0em;\n    line-height: 1.35;\n    padding: 1px 0;\n    cursor: help;\n    /* Wrap at WORD boundaries only (no mid-word breaks). Long names that\n       genuinely need to wrap will, but won't shatter into \"breastpla|te\". */\n    overflow-wrap: normal;\n    word-break: normal;\n}\n/* Chip head — prefix glyphs + item name + multi-slot tag share ONE inner\n   flex line that never wraps as a unit. The text inside is allowed to wrap\n   to multiple lines via min-width:0, but the dot/glyph/swatch stay glued to\n   the start of the FIRST line. Previously the chip was a single flex with\n   wrap, so a long item name would push to a new row, orphaning the prefix\n   on the row above. */\n.bh-chip-head {\n    display: flex;\n    flex: 1 1 100%;\n    align-items: baseline;\n    gap: 6px;\n    min-width: 0;\n    flex-wrap: nowrap;\n}\n.bh-chip-text {\n    font-weight: 500;\n    flex: 1 1 auto;\n    min-width: 0;\n    /* A single over-long token (an item name with no spaces) can't wrap at a space,\n       so break it as a LAST RESORT rather than let it overflow the column past the\n       panel edge. Multi-word names still wrap at spaces first (this only fires when a\n       word is wider than the column). */\n    overflow-wrap: anywhere;\n    /* Sentence case at the display layer: normalize the model's casing\n       (lowercase everything) and then capitalize the first letter. Means\n       \"ARMING SWORD\" and \"arming sword\" both render as \"Arming sword\".\n       Display normalization only — the underlying data stays as authored. */\n    text-transform: lowercase;\n}\n.bh-chip-text::first-letter {\n    text-transform: uppercase;\n}\n.bh-chip-dot {\n    width: 8px; height: 8px;\n    border-radius: 50%;\n    flex-shrink: 0;\n    background: var(--bh-tier-0);\n    align-self: center;\n}\n.bh-chip.bh-tier-1 .bh-chip-dot { background: var(--bh-tier-1); }\n.bh-chip.bh-tier-2 .bh-chip-dot { background: var(--bh-tier-2); }\n.bh-chip.bh-tier-3 .bh-chip-dot { background: var(--bh-tier-3); }\n.bh-chip.bh-tier-4 .bh-chip-dot { background: var(--bh-tier-4); }\n/* Hide the per-chip damage dot in desktop (doll-grid) — the card's left\n   border already encodes the same tier for each item. Mobile (digest)\n   keeps the dot because there's no card border to read off. */\n.bh-doll-grid .bh-chip-dot { display: none; }\n\n/* ─── Color swatch (v0.3 worn[].color / holding.color) ──────────────────\n   Inline color square beside the damage dot. Encodes the item's color\n   without stealing characters from the item name. Schema palette = 16\n   controlled colors; free-text variants fall back to .bh-c-other (neutral)\n   and rely on the tooltip for the exact word. */\n.bh-chip-swatch {\n    width: 9px;\n    height: 9px;\n    border-radius: 2px;\n    flex-shrink: 0;\n    align-self: center;\n    border: 1px solid rgba(255, 255, 255, 0.18);\n    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset;\n}\n/* Schema's 16-color controlled palette — chosen for legibility on dark bg. */\n.bh-c-red    { background: #d6534b; }\n.bh-c-orange { background: #e6883a; }\n.bh-c-yellow { background: #e6c64b; }\n.bh-c-green  { background: #5ec27a; }\n.bh-c-blue   { background: #4d8fdc; }\n.bh-c-purple { background: #9d6dcc; }\n.bh-c-pink   { background: #e687a3; }\n.bh-c-brown  { background: #8a5a3a; }\n.bh-c-black  { background: #1f1f24; border-color: rgba(255, 255, 255, 0.3); }\n.bh-c-white  { background: #f0f0f0; border-color: rgba(255, 255, 255, 0.4); }\n.bh-c-gray   { background: #888c92; }\n.bh-c-beige  { background: #d6c7a3; }\n.bh-c-gold   { background: #d4a93a; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset, 0 0 4px rgba(212, 169, 58, 0.4); }\n.bh-c-silver { background: #b5b8bd; }\n.bh-c-navy   { background: #2a3d6b; }\n.bh-c-tan    { background: #c4a878; }\n/* Free-text color (crimson, burgundy, etc.): neutral swatch with a hint\n   underline so it reads as \"color present, see tooltip\". */\n.bh-c-other  {\n    background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));\n    border-style: dashed;\n}\n\n/* Held items use the chat chroma for their ✦ glyph, while the chip text stays\n   neutral so color swatches and damage state remain readable. */\n.bh-chip-hold .bh-chip-text { color: inherit; }\n.bh-chip-hold .bh-chip-glyph {\n    color: var(--bh-holding);\n    font-size: 0.95em;\n    text-shadow: 0 0 4px color-mix(in srgb, var(--bh-chroma) 35%, transparent);\n}\n\n/* Wound chips: severity-colored (1=minor amber, 2=serious orange, 3=critical red).\n   v0.3 supplies explicit severity + bleeding fields. */\n.bh-chip-wound .bh-chip-glyph { font-size: 0.95em; }\n.bh-chip-wound-1 { color: var(--bh-chroma, var(--primary)); }\n.bh-chip-wound-1 .bh-chip-glyph { text-shadow: 0 0 4px color-mix(in srgb, var(--bh-accent) 45%, transparent); }\n.bh-chip-wound-2 { color: #e9933b; }\n.bh-chip-wound-2 .bh-chip-glyph { text-shadow: 0 0 4px rgba(233, 147, 59, 0.5); }\n.bh-chip-wound-3 { color: #ff4747; }\n.bh-chip-wound-3 .bh-chip-glyph { text-shadow: 0 0 4px rgba(255, 71, 71, 0.55); }\n.bh-chip-glyph { flex-shrink: 0; }\n\n/* Bleeding indicator — the wound chip's ✚ glyph pulses with a saturated\n   red halo. Settled middle ground: slightly larger base, modest scale +\n   opacity pulse, still distinct from a STATIC red ✚ but not jumpy. */\n.bh-chip-bleeding .bh-chip-glyph {\n    display: inline-block;\n    color: #ff3838 !important;\n    font-size: 1.12em;\n    line-height: 1;\n    text-shadow:\n        0 0 4px rgba(255, 56, 56, 0.9),\n        0 0 9px rgba(255, 56, 56, 0.55) !important;\n    animation: bh-bleed-pulse 1.3s ease-in-out infinite;\n    transform-origin: center;\n}\n@keyframes bh-bleed-pulse {\n    0%, 100% {\n        opacity: 0.78;\n        transform: scale(1);\n        text-shadow:\n            0 0 3px rgba(255, 56, 56, 0.65),\n            0 0 6px rgba(255, 56, 56, 0.3);\n    }\n    50% {\n        opacity: 1;\n        transform: scale(1.1);\n        text-shadow:\n            0 0 5px rgba(255, 56, 56, 0.95),\n            0 0 11px rgba(255, 56, 56, 0.55),\n            0 0 16px rgba(255, 56, 56, 0.3);\n    }\n}\n@media (prefers-reduced-motion: reduce) {\n    .bh-chip-bleeding .bh-chip-glyph {\n        animation: none;\n        opacity: 1;\n        transform: scale(1.08);\n    }\n}\n\n/* ─── Verbose sub-row (Full view) ──────────────────────────────────────\n   Spells out what tooltips show: damage word, color word, severity word,\n   bleeding word. The whole row is hidden by default and forced onto a new\n   line (flex-basis 100%) under the chip text in Full view — keeps slot\n   cards the same width regardless of label length. */\n.bh-chip-verbose {\n    font-family: var(--bh-font-data);\n    font-size: 0.78em;\n    letter-spacing: 0.04em;\n    opacity: 0.75;\n    text-transform: lowercase;\n}\n/* Verbose row is no longer gated by Meta — each label inside has its own\n   layer gate (color → Color layer, damage label → always, sev/bleed → live\n   on wound chips that are themselves Wound-gated). Meta now only controls\n   species pill, layer indices, and multi-slot ⌖ tags. */\n.bh-chip-verbose-row {\n    display: flex;\n    flex-basis: 100%;            /* forces line break inside the wrapping chip */\n    flex-direction: column;      /* stack labels vertically — consistent placement\n                                    regardless of how many labels or how long;\n                                    we have length, not width, in slot cards. */\n    gap: 1px;\n    /* Indent past the dot + swatch so labels visually pair with the item text */\n    padding-left: 20px;\n    margin-top: 2px;\n}\n/* Layer ownership of verbose labels:\n     .bh-chip-verbose-dmg    → Damage layer\n     .bh-chip-verbose-color  → Color layer\n     .bh-chip-verbose-sev    → Wounds layer (cascades — wound chip is the gate)\n     .bh-chip-verbose-bleed  → Wounds layer (cascades — wound chip is the gate)\n   The per-label hide rules live alongside the other Damage/Color/Wounds rules\n   below (search \"bh-hide-damage\", etc.). The row hide rules below collapse\n   the container when every visible label would be gone — no orphan margin. */\n.bh-chip-verbose-dmg   { color: inherit; opacity: 0.85; }\n.bh-chip-verbose-color { opacity: 0.7; font-style: italic; }\n.bh-chip-verbose-sev   { color: inherit; font-weight: 600; opacity: 0.9; }\n.bh-chip-verbose-bleed {\n    color: var(--bh-wound);\n    font-weight: 600;\n    text-shadow: 0 0 4px rgba(255, 71, 71, 0.4);\n}\n/* Collapse the verbose row when every label that WOULD render is layer-hidden.\n   Three explicit cases cover all \"no visible content left\" combinations. */\n.beholder-panel.bh-hide-color.bh-hide-damage .bh-chip-verbose-row:not(:has(.bh-chip-verbose-sev, .bh-chip-verbose-bleed)) { display: none; }\n.beholder-panel.bh-hide-color:not(.bh-hide-damage) .bh-chip-verbose-row:not(:has(.bh-chip-verbose-dmg, .bh-chip-verbose-sev, .bh-chip-verbose-bleed)) { display: none; }\n.beholder-panel.bh-hide-damage:not(.bh-hide-color) .bh-chip-verbose-row:not(:has(.bh-chip-verbose-color, .bh-chip-verbose-sev, .bh-chip-verbose-bleed)) { display: none; }\n\n/* Wounds chips own their severity-dot decoration; sev dots and the verbose\n   sev word are both severity cues — keep dots for the visual signal, words\n   for the spelled-out tier. They render together when wounds layer is on,\n   disappear together when it's off (wound chip is hidden as a whole). */\n\n/* Multi-slot annotation — when a row covers >1 slot (sundress on 4 slots,\n   gown on chest+waist+legs). The chip still appears in every slot it covers\n   (testers prefer this), but the small ⌖N tag signals \"this item also lives\n   in other cards\" so readers don't think they're seeing duplicates. */\n.bh-chip-multi {\n    font-family: var(--bh-font-data);\n    font-size: 0.7em;\n    letter-spacing: 0.04em;\n    color: var(--bh-body);\n    opacity: 0.45;\n    margin-left: var(--bh-space-1);\n    padding: 0 4px;\n    border: 1px solid var(--bh-divider);\n    border-radius: 3px;\n    flex-shrink: 0;\n    align-self: center;\n    cursor: help;\n}\n.bh-chip-multi:hover { opacity: 0.85; border-color: var(--bh-border); }\n\n/* Per-chip damage bar (desktop only) — positioned at the CARD'S LEFT EDGE\n   (negative offset hops out of the chip's normal flow, into the card's\n   padding-left). Each bar's height matches its own chip exactly, so a\n   chest with three layered items shows three stacked bars at the card\n   edge — together they read as a single segmented \"card border\" that's\n   item-aware. Wounds get no bar (different concern).\n   Adjacent bars extend ±1px so they meet across the chip-gap, forming a\n   continuous left edge. Mobile digest uses chip-dots instead. */\n.bh-doll-grid .bh-chip {\n    position: relative;\n}\n.bh-doll-grid .bh-chip::before {\n    content: \"\";\n    position: absolute;\n    left: -9px;            /* card has padding-left: 9px → bar lands at card edge */\n    top: -1px;\n    bottom: -1px;\n    width: 3px;\n    background: var(--chip-bar, transparent);\n}\n.bh-doll-grid .bh-chip.bh-tier-0 { --chip-bar: var(--bh-tier-0); }\n.bh-doll-grid .bh-chip.bh-tier-1 { --chip-bar: var(--bh-tier-1); }\n.bh-doll-grid .bh-chip.bh-tier-2 { --chip-bar: var(--bh-tier-2); }\n.bh-doll-grid .bh-chip.bh-tier-3 { --chip-bar: var(--bh-tier-3); }\n.bh-doll-grid .bh-chip.bh-tier-4 { --chip-bar: var(--bh-tier-4); }\n/* Wound chips have no bar — gear damage is a different concern. */\n.bh-doll-grid .bh-chip-wound::before { display: none; }\n/* Right-column mirror — bars on the right edge (card has padding-right: 9px\n   on right-col cards). */\n.bh-doll-grid .bh-col-right .bh-chip::before { left: auto; right: -9px; }\n\n/* Layered worn chips: the bar is positioned on the WRAPPER (not the inner\n   chip), so it lands at the card's left edge instead of inside the wrapper\n   (where it was overlapping the layer-index gutter and hiding the 1/2/3).\n   The tier class is copied onto the wrapper at render time. */\n.bh-doll-grid .bh-chip-layered::before {\n    content: \"\";\n    position: absolute;\n    left: -9px;\n    top: -1px;\n    bottom: -1px;\n    width: 3px;\n    background: var(--chip-bar, transparent);\n}\n.bh-doll-grid .bh-chip-layered.bh-tier-0 { --chip-bar: var(--bh-tier-0); }\n.bh-doll-grid .bh-chip-layered.bh-tier-1 { --chip-bar: var(--bh-tier-1); }\n.bh-doll-grid .bh-chip-layered.bh-tier-2 { --chip-bar: var(--bh-tier-2); }\n.bh-doll-grid .bh-chip-layered.bh-tier-3 { --chip-bar: var(--bh-tier-3); }\n.bh-doll-grid .bh-chip-layered.bh-tier-4 { --chip-bar: var(--bh-tier-4); }\n/* Inner chip's bar is suppressed when wrapped, to avoid double drawing. */\n.bh-doll-grid .bh-chip-layered .bh-chip::before { display: none; }\n/* Right-column wrapper bar mirrors to the right edge. */\n.bh-doll-grid .bh-col-right .bh-chip-layered::before { left: auto; right: -9px; }\n\n/* Wound group divider — dashed hairline above the wounds sub-list so the\n   gear group and the wound group read as distinct sections inside one\n   slot card. */\n.bh-slot-wounds {\n    margin-top: var(--bh-space-2);\n    padding-top: var(--bh-space-2);\n    border-top: 1px dashed var(--bh-divider);\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n}\n\n/* Right-col chip content mirrors: dot/swatch/glyph end up on the right\n   (toward the silhouette in the middle), multi-slot tag flips to the left,\n   text still reads LTR inside its element. The row-reverse goes on the\n   head (the inner prefix line); the chip itself stays normal so the verbose\n   row stays BELOW the head, not above. */\n.bh-col-right .bh-chip-head { flex-direction: row-reverse; }\n/* Verbose sub-row indent flips for right-col: indent on the RIGHT (away from\n   the body), labels stacked vertically and right-aligned so they sit under\n   the item text as it appears in the mirrored layout. */\n.bh-col-right .bh-chip-verbose-row {\n    padding-left: 0;\n    padding-right: 20px;\n    align-items: flex-end;\n}\n\n/* Spanning-item section: a horizontal strip above the doll grid for items\n   that occupy multiple slots (sundress on chest+waist+legs renders once\n   here, not in every slot card). */\n.bh-spanning-section {\n    display: flex;\n    flex-wrap: wrap;\n    align-items: center;\n    gap: 4px 6px;\n    margin: 4px 2px 6px;\n    padding: 4px 6px;\n    background: rgba(255, 255, 255, 0.02);\n    border: 1px dashed rgba(255, 255, 255, 0.08);\n    border-radius: 6px;\n}\n.bh-spanning-label {\n    font-size: 0.7em;\n    text-transform: uppercase;\n    letter-spacing: 1.2px;\n    opacity: 0.45;\n    margin-right: 2px;\n}\n.bh-chip-spanning {\n    padding: 2px 8px;\n    background: rgba(255, 255, 255, 0.04);\n    border: 1px solid rgba(255, 255, 255, 0.08);\n    border-radius: 999px;\n    cursor: help;\n}\n.bh-chip-spanning .bh-chip-slots {\n    font-size: 0.78em;\n    opacity: 0.5;\n    font-style: italic;\n    margin-left: 2px;\n}\n\n/* (Obsolete single-row card styling removed — replaced by .bh-slot-card +\n   .bh-chip layout above. Left intentionally so the file is shorter.) */\n\n/* (Right-column mirroring moved into .bh-slot-card / .bh-chip rules above.) */\n\n/* Silhouette — scales with the panel's --bh-ui-scale knob. */\n.bh-silhouette {\n    width: calc(140px * var(--bh-ui-scale, 1));\n    height: calc(440px * var(--bh-ui-scale, 1));\n    display: block;\n    color: var(--bh-body);\n}\n.bh-body-fill {\n    fill: var(--bh-body-soft);\n    stroke: var(--bh-body);\n    stroke-width: 1;\n    stroke-opacity: 0.45;\n}\n\n.bh-wound-marker .bh-wound-dot {\n    fill: var(--bh-wound);\n    stroke: rgba(0, 0, 0, 0.5);\n    stroke-width: 0.8;\n    filter: drop-shadow(0 0 3px rgba(255, 60, 60, 0.55));\n    /* Animation budget ≤1 at a time (per UX research). A static dot is\n       legible on its own; reserve motion for future severity tiers\n       (critical/bleeding) which will animate exclusively. */\n}\n.bh-wound-marker .bh-wound-count {\n    font-size: 7px;\n    fill: #fff;\n    font-weight: 700;\n    pointer-events: none;\n}\n\n/* Held-item marker on the silhouette hand — just the ✦ glyph, no circle.\n   pointer-events: none so the hand part underneath stays hoverable for\n   the hover-link with the slot card. */\n.bh-hold-marker {\n    pointer-events: none;\n}\n.bh-hold-marker .bh-hold-icon {\n    font-size: 8px;\n    fill: var(--bh-holding);\n    font-weight: 700;\n    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.65));\n}\n\n/* (Gauge CSS removed — the only consumer was the stamina gauge, which is no\n   longer tracked. A defensive .bh-char-head .bh-gauge{display:none} is\n   appended below to hide any residual gauge element.) */\n\n/* Old .bh-wounds-block (bottom <details> list) removed — wounds are now\n   first-class slot rows alongside worn/holding (see .bh-row-wound below). */\n\n/* Viewer-perspective hint below the silhouette: the figure faces the user,\n   so character-right renders on viewer-left. Without this, ~30% of first-\n   time testers think the model swapped hands. */\n.bh-figure {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: var(--bh-space-2);\n    min-width: 0;\n    max-width: 100%;\n    overflow: hidden;\n}\n.bh-pov-hint {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-1);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.16em;\n    opacity: var(--bh-mute-strong);\n    text-transform: uppercase;\n    cursor: help;\n    padding-top: var(--bh-space-1);\n    white-space: nowrap;\n}\n.bh-pov-hint:hover { opacity: var(--bh-mute-soft); }\n.bh-pov-axis { opacity: 0.5; letter-spacing: 0; }\n.bh-pov-note {\n    font-family: inherit;\n    font-size: 0.92em;\n    letter-spacing: 0.04em;\n    text-transform: lowercase;\n    font-style: italic;\n    margin-left: var(--bh-space-1);\n    opacity: 0.85;\n}\n\n/* ─── Body-part tinting on the silhouette ────────────────────────────── */\n/* Per-part visual encoding:\n     STROKE (ring outside the part) = armor damage tier\n     FILL   (interior of the part)  = wound severity\n   `paint-order: stroke` shifts the fill to paint OVER the inner half of\n   the stroke, so the visible stroke ring sits entirely OUTSIDE the fill —\n   no muddled blend when armor and wound are both red. Thicker stroke at\n   high tiers makes the ring unambiguous. */\n.bh-part .bh-body-fill {\n    paint-order: stroke fill;\n    transition: stroke 0.2s ease, stroke-width 0.2s ease, fill 0.2s ease;\n}\n.bh-part .bh-body-fill.bh-part-tier-2 { stroke: var(--bh-tier-2); stroke-width: 3.0; stroke-opacity: 1; }\n.bh-part .bh-body-fill.bh-part-tier-3 { stroke: var(--bh-tier-3); stroke-width: 4.0; stroke-opacity: 1; }\n.bh-part .bh-body-fill.bh-part-tier-4 { stroke: var(--bh-tier-4); stroke-width: 5.0; stroke-opacity: 1; }\n\n/* Body-part wound fill — tier by MAX SEVERITY. Hue + opacity both shift so\n   the three severities are unambiguous at a glance:\n     minor    = soft amber, ~20% — a passing visual nudge (\"there's a wound\")\n     serious  = clear orange, ~40% — body part is meaningfully hurt\n     critical = saturated red, ~65% — alarming, draws the eye\n   Critical also gets a thin red stroke overlay so it pops even when the\n   part is small (eyes, ears). */\n/* Wound fill — interior tint by severity. Stroke is reserved for ARMOR;\n   wound severity reads from the fill color (no stroke override). This\n   keeps the two channels orthogonal: ring = armor, interior = body. */\n.bh-part .bh-body-fill.bh-part-wound-1 {\n    fill: color-mix(in srgb, var(--bh-chroma) 20%, transparent);\n}\n.bh-part .bh-body-fill.bh-part-wound-2 {\n    fill: rgba(233, 147, 59, 0.42);\n}\n.bh-part .bh-body-fill.bh-part-wound-3 {\n    fill: rgba(255, 71, 71, 0.65);\n}\n\n/* Missing / acquired-loss body part: gray vertical hatch + dashed outline.\n   Distinct from off-body (species lacks this part — handled in row layer with\n   ⌀ glyph) and from empty (no item — handled by ghost card). */\n.bh-part .bh-body-fill.bh-part-missing {\n    fill: url(#bh-missing-pattern);\n    stroke: rgba(140, 140, 140, 0.6) !important;\n    stroke-opacity: 0.7 !important;\n    stroke-dasharray: 4 3;\n}\n\n/* Hover any part to see slot + damage + wounds tooltip via <title>. */\n.bh-part { cursor: help; }\n.bh-part:hover .bh-body-fill { filter: brightness(1.15); }\n\n/* Hover-link: visually pair a body part with its slot row(s) and vice versa.\n   !important here because the hide-damage / hide-wounds rules above use\n   !important to neutralize tier strokes and wound fills — without it the\n   hover-link highlight gets stomped in every view except Full.\n\n   The fill is explicitly mixed with the accent color (not just a brightness\n   filter) so the highlight reads as a tinted REGION rather than a bright\n   outline. Critical on slim slots like legs/arms where the silhouette's\n   pale soft-body fill barely shifts under a brightness filter alone. */\n.bh-part.bh-hover-link .bh-body-fill {\n    fill: var(--bh-accent, var(--primary)) !important;\n    fill-opacity: 0.55 !important;\n    filter: drop-shadow(0 0 5px var(--bh-accent, var(--primary))) !important;\n    stroke: var(--bh-accent, var(--primary)) !important;\n    stroke-width: 2 !important;\n    stroke-opacity: 0.95 !important;\n}\n.bh-slot-card.bh-hover-link {\n    background: color-mix(in srgb, var(--bh-accent) 10%, transparent);\n    border-color: color-mix(in srgb, var(--bh-accent) 55%, transparent);\n}\n.bh-slot-card.bh-hover-link::before {\n    box-shadow: 0 0 6px var(--bh-accent, var(--primary));\n}\n.bh-chip-spanning.bh-hover-link {\n    background: color-mix(in srgb, var(--bh-accent) 14%, transparent);\n    border-color: color-mix(in srgb, var(--bh-accent) 60%, transparent);\n}\n\n/* Spine line — back-view anchor so users know they're seeing the back. */\n.bh-spine-line {\n    stroke: var(--bh-body);\n    stroke-width: 0.8;\n    stroke-opacity: 0.35;\n    stroke-dasharray: 2 3;\n    fill: none;\n}\n\n/* Count badges on body parts: ×N for multi-wounds, +N for layered clothes.\n   Solves the \"1 wound vs 3 wounds look identical in fill intensity\" and\n   \"I can't tell if there's a cloak over my chest tunic\" problems. */\n.bh-count-badge { pointer-events: none; }\n.bh-badge-circle { stroke: rgba(0, 0, 0, 0.45); stroke-width: 0.6; }\n.bh-badge-wound-bg  { fill: var(--bh-wound); filter: drop-shadow(0 0 3px rgba(255, 60, 60, 0.55)); }\n.bh-badge-layers-bg { fill: var(--bh-holding); filter: drop-shadow(0 0 3px color-mix(in srgb, var(--bh-chroma) 40%, transparent)); }\n.bh-badge-text {\n    font-size: 7.5px;\n    font-weight: 700;\n    fill: #fff;\n    text-anchor: middle;\n    dominant-baseline: middle;\n    font-family: inherit;\n}\n\n/* Species family tag (top of silhouette, only shown for non-humanoid). */\n.bh-family-tag {\n    fill: var(--bh-accent);\n    font-size: 7px;\n    font-weight: 600;\n    letter-spacing: 1.5px;\n    text-transform: uppercase;\n    opacity: 0.65;\n    font-family: inherit;\n}\n\n/* Stroke-only body parts (digitigrade legs, serpentine tail) — inherit\n   tier/wound strokes from .bh-part-tier-* / .bh-part-wound-*. */\n.bh-silhouette .bh-tail,\n.bh-silhouette .bh-digi-leg {\n    stroke: var(--bh-body);\n    stroke-opacity: 0.45;\n}\n\n/* Wings (v0.4) — drawn behind the body in the SVG layering, slightly\n   reduced opacity so they read as \"behind / further from camera\"\n   rather than competing with the torso. The full saturation comes\n   back on hover-link. Feathered vs leathery just change the path\n   geometry, not the visual treatment. */\n.bh-silhouette .bh-wings {\n    opacity: 0.72;\n}\n.bh-silhouette .bh-wings.bh-part-tier-2,\n.bh-silhouette .bh-wings.bh-part-tier-3,\n.bh-silhouette .bh-wings.bh-part-tier-4 {\n    opacity: 0.9;\n}\n.bh-silhouette .bh-tail.bh-part-tier-2,\n.bh-silhouette .bh-digi-leg.bh-part-tier-2 { stroke: var(--bh-tier-2); stroke-opacity: 1; }\n.bh-silhouette .bh-tail.bh-part-tier-3,\n.bh-silhouette .bh-digi-leg.bh-part-tier-3 { stroke: var(--bh-tier-3); stroke-opacity: 1; }\n.bh-silhouette .bh-tail.bh-part-tier-4,\n.bh-silhouette .bh-digi-leg.bh-part-tier-4 { stroke: var(--bh-tier-4); stroke-opacity: 1; }\n\n/* Off-silhouette slot row hint: a serpentine character's worn boot still\n   shows in the row list, but flagged so users know it doesn't appear on\n   the body diagram. */\n.bh-row-off-body {\n    opacity: 0.6;\n}\n.bh-off-body {\n    display: inline-block;\n    margin-left: 4px;\n    color: var(--bh-tier-2);\n    font-size: 0.85em;\n    opacity: 0.8;\n    cursor: help;\n}\n\n/* ─── Onboarding popover (first-impression explainer) ─────────────────── */\n.beholder-onboard {\n    background: var(--SmartThemeBlurTintColor, rgba(20, 20, 24, 0.95));\n    color: var(--SmartThemeBodyColor, #e0e0e0);\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));\n    border-radius: 12px;\n    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);\n    backdrop-filter: blur(10px);\n    -webkit-backdrop-filter: blur(10px);\n    font-size: 0.875em;\n    line-height: 1.55;\n    animation: bh-onboard-in 0.25s ease-out;\n}\n.beholder-onboard .bh-onboard-title {\n    font-family: Cinzel, \"Trajan Pro\", Georgia, serif;\n    font-weight: 600;\n    letter-spacing: 0.1em;\n    font-size: 1.05em;\n}\n@keyframes bh-onboard-in {\n    from { opacity: 0; transform: scale(0.95); }\n    to   { opacity: 1; transform: scale(1); }\n}\n.bh-onboard-arrow {\n    position: absolute;\n    top: 18px;\n    width: 0; height: 0;\n    border-top: 8px solid transparent;\n    border-bottom: 8px solid transparent;\n}\n.beholder-onboard[data-side=\"right\"] .bh-onboard-arrow {\n    right: -8px;\n    border-left: 8px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));\n}\n.beholder-onboard[data-side=\"left\"] .bh-onboard-arrow {\n    left: -8px;\n    border-right: 8px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));\n}\n.bh-onboard-head {\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    padding: 8px 12px;\n    border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));\n}\n.bh-onboard-title {\n    font-weight: 700;\n    color: var(--bh-accent, var(--primary));\n    letter-spacing: 0.5px;\n}\n.bh-onboard-close {\n    cursor: pointer;\n    opacity: 0.55;\n    transition: opacity 0.15s;\n}\n.bh-onboard-close:hover { opacity: 1; }\n.bh-onboard-body {\n    padding: 10px 12px;\n}\n.bh-onboard-body b { color: var(--bh-accent, var(--primary)); font-weight: 600; }\n.bh-onboard-tips {\n    margin: 8px 0 0;\n    padding: 0 0 0 18px;\n    font-size: 0.92em;\n}\n.bh-onboard-tips li {\n    margin: 3px 0;\n    color: var(--SmartThemeBodyColor, #d0d0d0);\n    opacity: 0.85;\n}\n.bh-onboard-foot {\n    padding: 8px 12px 10px;\n    text-align: right;\n    border-top: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.06));\n}\n.bh-onboard-dismiss {\n    background: var(--bh-accent, var(--primary));\n    color: #fff;\n    border: none;\n    padding: 6px 16px;\n    border-radius: 4px;\n    cursor: pointer;\n    font-size: 0.95em;\n    font-weight: 600;\n    letter-spacing: 0.3px;\n}\n.bh-onboard-dismiss:hover { filter: brightness(1.1); }\n\n/* ─── Inline per-message delta badges ─────────────────────────────────── */\n/* Annotates each AI message with what the extractor saw change. Lives in\n   the chat DOM, appended after .mes_text. Shows testers that the extractor\n   ran on this turn; great debug surface for the model itself. */\n.beholder-msg-badges {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 4px;\n    margin: 4px 0 6px;\n    padding: 4px 8px;\n    border-left: 2px solid var(--bh-accent, var(--primary));\n    background: rgba(255, 255, 255, 0.02);\n    border-radius: 0 4px 4px 0;\n    font-size: 0.78em;\n    line-height: 1.45;\n}\n.beholder-msg-noop {\n    color: var(--SmartThemeBodyColor, #aaa);\n    opacity: 0.4;\n    font-style: italic;\n    font-size: 0.75em;\n}\n.bh-msg-badge {\n    display: inline-flex;\n    align-items: center;\n    gap: 4px;\n    padding: 1px 7px 2px;\n    background: rgba(255, 255, 255, 0.04);\n    border: 1px solid rgba(255, 255, 255, 0.08);\n    border-radius: 10px;\n    color: var(--SmartThemeBodyColor, #d0d0d0);\n}\n.bh-msg-char {\n    font-weight: 600;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    font-size: 0.92em;\n}\n.bh-msg-text { opacity: 0.92; }\n\n/* Semantic colors per delta kind */\n.bh-msg-add   { border-color: rgba(106, 212, 139, 0.5); color: #6ad48b; }\n.bh-msg-clear { border-color: rgba(233, 147, 59, 0.5);  color: #e9933b; }\n.bh-msg-hold  { border-color: color-mix(in srgb, var(--bh-chroma) 50%, transparent); color: var(--bh-chroma); }\n.bh-msg-wound { border-color: rgba(255, 82, 82, 0.55);  color: #ff7676; }\n.bh-msg-heal  { border-color: rgba(120, 220, 255, 0.5); color: #78dcff; }\n.bh-msg-mod   { border-color: rgba(136, 170, 255, 0.5); color: #aac3ff; }\n.bh-msg-add .bh-msg-char,\n.bh-msg-clear .bh-msg-char,\n.bh-msg-hold .bh-msg-char,\n.bh-msg-wound .bh-msg-char,\n.bh-msg-heal .bh-msg-char,\n.bh-msg-mod .bh-msg-char {\n    color: inherit;\n    opacity: 0.85;\n}\n\n/* ─── Front / Back view toggle ──────────────────────────────────────────\n   Segmented pill toggle. The whole control is one button (a single click\n   flips the view), but visually it reads as a Front | Back switch with\n   the active label highlighted. */\n.bh-figure-controls {\n    display: flex;\n    justify-content: center;\n    margin-top: var(--bh-space-2);\n}\n.bh-view-toggle {\n    background: var(--bh-surface-1);\n    color: var(--bh-body);\n    border: 1px solid var(--bh-border);\n    border-radius: 999px;\n    padding: var(--bh-space-1) var(--bh-space-3);\n    font: inherit;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    font-weight: 500;\n    letter-spacing: 0.08em;\n    text-transform: uppercase;\n    cursor: pointer;\n    display: inline-flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;\n}\n.bh-view-toggle:hover {\n    background: var(--bh-surface-2);\n    border-color: var(--bh-accent);\n    box-shadow: 0 0 0 3px color-mix(in srgb, var(--bh-accent) 10%, transparent);\n}\n.bh-view-front-label,\n.bh-view-back-label {\n    transition: color 0.15s, opacity 0.15s;\n    opacity: var(--bh-mute-strong);\n}\n.bh-view-active {\n    opacity: 1;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    font-weight: 600;\n}\n.bh-view-sep {\n    opacity: 0.35;\n    font-size: 0.9em;\n    letter-spacing: 0;\n}\n\n/* Damage-tier legend popover (toggled by ? icon in panel header). Solves\n   the \"is this damage or wound severity?\" first-impression confusion. */\n.beholder-legend {\n    padding: var(--bh-space-3) var(--bh-space-3) var(--bh-space-3) var(--bh-space-4);\n    border-bottom: 1px solid var(--bh-divider);\n    font-size: var(--bh-text-secondary);\n    background: var(--bh-surface-1);\n}\n.beholder-legend[hidden] { display: none; }\n.bh-legend-row {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    padding: 2px 0;\n    line-height: 1.3;\n}\n.bh-legend-bar {\n    display: inline-block;\n    width: 3px;\n    height: 14px;\n    border-radius: 2px;\n    flex-shrink: 0;\n}\n.bh-legend-bar.bh-tier-0 { background: var(--bh-tier-0); }\n.bh-legend-bar.bh-tier-1 { background: var(--bh-tier-1); }\n.bh-legend-bar.bh-tier-2 { background: var(--bh-tier-2); }\n.bh-legend-bar.bh-tier-3 { background: var(--bh-tier-3); }\n.bh-legend-bar.bh-tier-4 { background: var(--bh-tier-4); }\n.bh-legend-bar.bh-tier-holding { background: var(--bh-holding); }\n.bh-legend-dot {\n    display: inline-block;\n    width: 8px;\n    height: 8px;\n    border-radius: 50%;\n    background: var(--bh-wound);\n    box-shadow: 0 0 4px var(--bh-wound);\n    margin-left: 0;\n    flex-shrink: 0;\n}\n\n/* Height-only resize handle (bottom edge). Width is intentionally locked —\n   changing it throws off the doll grid columns + chip layouts. The handle\n   is a thin horizontal grip with ns-resize cursor centered on the bottom\n   border so it reads as \"stretch downward\" not \"resize corner\". */\n.beholder-resize-handle {\n    position: absolute;\n    left: 50%;\n    transform: translateX(-50%);\n    bottom: 2px;\n    width: 44px;\n    height: 5px;\n    cursor: ns-resize;\n    z-index: 50;\n    border-radius: 999px;\n    background: var(--bh-border);\n    opacity: 0.55;\n    transition: opacity 0.15s, background 0.15s, width 0.15s;\n}\n.beholder-resize-handle:hover {\n    opacity: 1;\n    background: var(--bh-accent, var(--primary));\n    width: 60px;\n}\n.beholder-panel.beholder-resizing { user-select: none; }\n\n/* ─── Mobile digest ────────────────────────────────────────────────────\n   The narrow-width replacement for the doll grid. Four sections in\n   priority order: Wounds → Held → Worn → State (missing/bare). Each row\n   is one chip + a faint slot annotation on the right. */\n.bh-digest-section {\n    margin-bottom: var(--bh-space-3);\n}\n.bh-digest-section:last-child { margin-bottom: 0; }\n.bh-digest-heading {\n    display: flex;\n    align-items: baseline;\n    gap: var(--bh-space-2);\n    margin: 0 0 var(--bh-space-2);\n    padding-bottom: var(--bh-space-1);\n    border-bottom: 1px solid var(--bh-divider);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    font-weight: 600;\n    letter-spacing: 0.14em;\n    text-transform: uppercase;\n    color: var(--bh-body);\n    opacity: var(--bh-mute-soft);\n}\n.bh-digest-count {\n    font-size: 0.85em;\n    opacity: 0.6;\n    font-weight: 500;\n    margin-left: auto;\n}\n.bh-digest-list {\n    list-style: none;\n    margin: 0;\n    padding: 0;\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-1);\n}\n\n/* Grouped worn list: each anatomical region (head, torso, arms, legs) is a\n   sub-block with its own subheading + nested list. Visually separates a\n   long worn list into 4 scannable chunks instead of one wall. */\n.bh-digest-list-grouped {\n    gap: var(--bh-space-3);\n}\n.bh-digest-group {\n    list-style: none;\n    margin: 0;\n    padding: 0;\n}\n.bh-digest-subhead {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-secondary);\n    font-weight: 600;\n    letter-spacing: 0.1em;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    opacity: 0.85;\n    margin: 0 0 var(--bh-space-2);\n    padding: var(--bh-space-1) 0 var(--bh-space-1) var(--bh-space-2);\n    border-left: 2px solid var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    background: linear-gradient(90deg, color-mix(in srgb, var(--bh-chroma) 6%, transparent), transparent 60%);\n    border-radius: 0 4px 4px 0;\n}\n.bh-digest-group-list {\n    list-style: none;\n    margin: 0;\n    padding: 0;\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-1);\n}\n.bh-digest-row {\n    display: flex;\n    align-items: baseline;\n    gap: var(--bh-space-2);\n    padding: var(--bh-space-1) 0;\n    line-height: 1.35;\n}\n.bh-digest-row .bh-chip {\n    flex: 1 1 auto;\n    min-width: 0;\n}\n.bh-digest-slot {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    text-transform: lowercase;\n    letter-spacing: 0.06em;\n    opacity: 0.55;\n    flex-shrink: 0;\n    text-align: right;\n    align-self: center;\n}\n.bh-digest-layer {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 600;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    opacity: 0.65;\n    margin-left: var(--bh-space-1);\n    flex-shrink: 0;\n}\n.bh-digest-flag {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 600;\n    text-transform: uppercase;\n    letter-spacing: 0.12em;\n    padding: 2px 8px;\n    border: 1px solid var(--bh-border);\n    border-radius: 3px;\n    flex-shrink: 0;\n}\n.bh-digest-flag-missing {\n    color: rgba(160, 160, 160, 0.95);\n    border-color: rgba(140, 140, 140, 0.4);\n    background: rgba(140, 140, 140, 0.06);\n}\n.bh-digest-flag-bare {\n    color: rgba(220, 188, 156, 0.95);\n    border-color: rgba(220, 188, 156, 0.4);\n    background: rgba(220, 188, 156, 0.06);\n}\n.bh-digest-row-flag {\n    justify-content: space-between;\n}\n/* Section-level color cues, semantic (not nth-of-type — those break when an\n   earlier section is filtered out). */\n.bh-digest-section-wounds .bh-digest-heading { color: var(--bh-wound); }\n.bh-digest-section-held   .bh-digest-heading { color: var(--bh-holding); }\n\n/* ─── Mobile digest × view-ladder filters ──────────────────────────────\n   The doll-grid selectors above don't fire in mobile (the grid is\n   display:none). These mirror the same hide semantics for the digest. */\n\n/* hide-wounds: drop the whole wounds section + heading + count. */\n.beholder-panel.bh-hide-wounds .bh-digest-section-wounds {\n    display: none !important;\n}\n\n/* hide-damage: tier-colored heading on wounds is fine (it's wound color,\n   not damage). But neutralize held heading's gold \"holding\" tint so the\n   visual budget matches the wider hide-damage view. */\n.beholder-panel.bh-hide-damage .bh-digest-section-held .bh-digest-heading {\n    color: var(--bh-body) !important;\n    opacity: var(--bh-mute-soft);\n}\n\n/* hide-meta: drop multi-slot tag inside digest rows (already covered by\n   .bh-chip-multi rule above, no extra rule needed here). */\n\n\n/* ─── Hide color ─────────────────────────────────────────────────────────\n   The chip swatch (the small color square next to each item name) is now\n   IDENTITY — it always renders, even with this layer off, because color is\n   often the cheapest way to distinguish one of two similar items at a glance\n   (\"the *red* cloak vs the *blue* cloak\"). The Color layer instead toggles\n   the verbose color label inside the chip's wrapping row (\"rust-red leather\"\n   etc.). Identity stays visible; verbose annotation is opt-in. */\n.beholder-panel.bh-hide-color .bh-chip-verbose-color {\n    display: none !important;\n}\n\n/* ─── Hide wounds — drop wound chips + body-part red tint ──────────────── */\n.beholder-panel.bh-hide-wounds .bh-chip-wound {\n    display: none !important;\n}\n/* Restore the default body-part fill / stroke (var(--bh-body-soft) is the\n   default `.bh-body-fill` color; var(--bh-body) is text-near-white and was\n   the white-out bug). */\n.beholder-panel.bh-hide-wounds .bh-body-fill.bh-part-wound-1,\n.beholder-panel.bh-hide-wounds .bh-body-fill.bh-part-wound-2,\n.beholder-panel.bh-hide-wounds .bh-body-fill.bh-part-wound-3 {\n    fill: var(--bh-body-soft) !important;\n    stroke: var(--bh-body) !important;\n    stroke-opacity: 0.45 !important;\n    filter: none !important;\n}\n/* Compact mode equivalent */\n.beholder-panel.bh-hide-wounds .beholder-wound,\n.beholder-panel.bh-hide-wounds .beholder-row:has(.beholder-wound) { display: none !important; }\n\n/* ─── Hide gear damage tier — every damage visual neutralized ─────────── */\n.beholder-panel.bh-hide-damage .bh-chip-verbose-dmg { display: none !important; }\n.beholder-panel.bh-hide-damage .bh-chip-dot { display: none !important; }\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-0,\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-1,\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-2,\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-3,\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-4 {\n    color: inherit !important;\n}\n/* Per-chip damage bar — kill the chip-bar CSS var so the ::before becomes\n   transparent. Covers both inline chips AND the layered-wrapper bars. */\n.beholder-panel.bh-hide-damage .bh-chip,\n.beholder-panel.bh-hide-damage .bh-chip-layered {\n    --chip-bar: transparent !important;\n}\n/* Body-part armor-tier stroke off */\n.beholder-panel.bh-hide-damage .bh-body-fill.bh-part-tier-2,\n.beholder-panel.bh-hide-damage .bh-body-fill.bh-part-tier-3,\n.beholder-panel.bh-hide-damage .bh-body-fill.bh-part-tier-4 {\n    stroke: none !important;\n    stroke-width: 0 !important;\n}\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-tail.bh-part-tier-2,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-tail.bh-part-tier-3,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-tail.bh-part-tier-4,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-digi-leg.bh-part-tier-2,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-digi-leg.bh-part-tier-3,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-digi-leg.bh-part-tier-4 {\n    stroke-opacity: 0 !important;\n}\n/* Held items: drop the gold glyph tint to neutral too */\n.beholder-panel.bh-hide-damage .bh-chip-hold .bh-chip-glyph {\n    color: inherit !important;\n    text-shadow: none !important;\n}\n/* ─── Backfill status strip ──────────────────────────────────────────────\n   Sits between the header and the layer bar. Two modes — offer banner (on\n   chat change, before the run) and progress strip (during the run). Quiet\n   surface tint + thin divider so it reads as system chrome, not a chip.    */\n.beholder-backfill-status {\n    padding: var(--bh-space-2) var(--bh-space-3);\n    /* Gold left-edge + faint tint so this reads as the same CTA family as the\n       no-model banner (which sits directly below it). */\n    background: linear-gradient(\n        90deg,\n        color-mix(in srgb, var(--bh-accent) 10%, transparent),\n        color-mix(in srgb, var(--bh-accent) 2%, transparent) 60%,\n        transparent\n    );\n    border-bottom: 1px solid color-mix(in srgb, var(--bh-accent) 40%, transparent);\n    box-shadow: inset 3px 0 0 var(--bh-gold-deep);\n    font-size: var(--bh-text-secondary);\n}\n.beholder-backfill-status[hidden] { display: none; }\n.bh-bf-progress {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-3);\n    flex-wrap: wrap;\n}\n.bh-bf-text { flex: 1 1 auto; opacity: 0.85; line-height: 1.45; }\n.beholder-backfill-status .bh-btn {\n    padding: 7px 14px;\n    font-size: var(--bh-text-secondary);\n}\n.bh-bf-bar {\n    flex: 0 1 120px;\n    height: 6px;\n    background: var(--bh-divider);\n    border-radius: 3px;\n    overflow: hidden;\n}\n.bh-bf-bar-fill {\n    display: block;\n    height: 100%;\n    background: var(--bh-accent, var(--primary));\n    transition: width 0.2s ease-out;\n}\n\n/* ─── Backfill split-button + menu ───────────────────────────────────────\n   Header \"history\" control is a 2-part split button: clock icon (default\n   action) + caret (opens a small dropdown menu with the less-frequent\n   ops — re-seed-only, rebuild-from-scratch). Menu is absolute-positioned\n   so the panel layout doesn't reflow when it opens. */\n.beholder-backfill-group {\n    display: inline-flex;\n    align-items: center;\n    gap: 3px;\n    position: relative;\n}\n.beholder-backfill-group .beholder-backfill-more {\n    /* The click handler is on this element, so its box IS the hit target. It used\n       to be font-size:0.7em + padding:0 2px — a near-unclickable sliver you had to\n       hit pixel-perfect. Give it a real, comfortable button-sized target. */\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    font-size: 0.82em;\n    line-height: 1;\n    min-width: 20px;\n    min-height: 22px;\n    padding: 4px 6px;\n    cursor: pointer;\n    border-radius: 5px;\n    transition: background .12s ease, color .12s ease;\n}\n.beholder-backfill-group .beholder-backfill-more:hover {\n    background: var(--bh-surface-2, rgba(255, 255, 255, 0.09));\n    color: var(--bh-accent, var(--primary));\n}\n.beholder-backfill-group.bh-menu-open .beholder-backfill-more {\n    opacity: 1;\n    color: var(--bh-accent, var(--primary));\n}\n\n.beholder-bf-menu {\n    /* Rendered to <body> + fixed-positioned by panel.js at the caret, so the\n       panel's overflow:hidden + container-type can't clip it. The gold brand\n       tokens are scoped to .beholder-panel; this menu lives on <body>, so it\n       re-declares the ones it + its items use (otherwise it renders unbranded). */\n    --bh-accent: var(--primary);\n    --bh-chroma: var(--marinara-chat-chrome-accent, var(--primary));\n    --bh-gold: var(--bh-chroma);\n    --bh-gold-deep: var(--bh-accent);\n    --bh-border: rgba(255, 255, 255, 0.18);\n    --bh-surface-2: rgba(255, 255, 255, 0.07);\n    --bh-mute-soft: 0.7;\n    position: fixed;\n    z-index: 10001;\n    min-width: 240px;\n    max-width: min(320px, calc(100vw - 16px));\n    padding: 4px;\n    /* Match the panel's surface exactly (host theme tint), not a hardcoded dark. */\n    background: var(--SmartThemeBlurTintColor, rgba(20, 20, 24, 0.92));\n    border: 1px solid var(--bh-border);\n    border-radius: 8px;\n    box-shadow: rgba(0, 0, 0, 0.55) 0 8px 28px;\n    backdrop-filter: blur(10px);\n    -webkit-backdrop-filter: blur(10px);\n    display: flex;\n    flex-direction: column;\n    gap: 1px;\n    color: var(--SmartThemeBodyColor, #cfd2d6);\n    font-size: 0.875em;\n}\n/* Gold top hairline — matches the .beholder-tools-menu header dropdown. */\n.beholder-bf-menu::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    border-radius: 8px 8px 0 0;\n    background: linear-gradient(90deg, var(--bh-gold-deep), color-mix(in srgb, var(--bh-accent) 35%, transparent) 40%, transparent 80%);\n    opacity: 0.75;\n}\n.beholder-bf-menu .bh-bf-mode {\n    display: flex;\n    flex-direction: row;\n    align-items: flex-start;\n    gap: 9px;\n    width: 100%;\n    padding: 9px 11px;\n    background: transparent;\n    border: none;\n    border-radius: 5px;\n    color: inherit;\n    text-align: left;\n    cursor: pointer;\n    font: inherit;\n    line-height: 1.35;\n    transition: background 0.12s;\n}\n/* Gold leading icon — the brand's accent, same as the tools (⋯) menu items. */\n.beholder-bf-menu .bh-bf-mode > i {\n    flex-shrink: 0;\n    width: 16px;\n    margin-top: 2px;\n    text-align: center;\n    color: var(--bh-gold-deep);\n}\n.beholder-bf-menu .bh-bf-mode-text {\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    min-width: 0;\n}\n.beholder-bf-menu .bh-bf-mode:hover,\n.beholder-bf-menu .bh-bf-mode:focus-visible {\n    background: var(--bh-surface-2);\n    outline: none;\n}\n.beholder-bf-menu .bh-bf-mode-title {\n    font-weight: 600;\n    color: var(--SmartThemeBodyColor, #e6e6e6);\n}\n.beholder-bf-menu .bh-bf-mode-sub {\n    opacity: var(--bh-mute-soft);\n    font-size: 0.9em;\n}\n.beholder-bf-menu .bh-bf-mode-danger > i,\n.beholder-bf-menu .bh-bf-mode-danger .bh-bf-mode-title {\n    color: #ff9888;\n}\n.beholder-bf-menu .bh-bf-mode-danger:hover .bh-bf-mode-title {\n    color: #ffb0a0;\n}\n\n/* ══════════════════════════════════════════════════════════════════════════\n   Gold brand overlay — buttons, header tools, paired grid, layout switch,\n   bottom-sheet editor, view overlays (settings / doctor / inspector / help),\n   the desktop slot editor, slot lock/edit decoration, and toasts. All of\n   these read from the gold + surface + space tokens declared on\n   .beholder-panel above.\n   ══════════════════════════════════════════════════════════════════════════ */\n\n/* Quiet brand mark before the panel title — a small filled lens glyph. */\n.beholder-panel-title::before {\n    content: \"◉\";\n    color: var(--bh-gold-deep);\n    margin-right: 0.45em;\n    font-size: 0.82em;\n    text-shadow: color-mix(in srgb, var(--bh-accent) 55%, transparent) 0 0 9px;\n    vertical-align: 0.06em;\n}\n\n/* Defensive: hide any residual char-head gauge element (stamina retired). */\n.beholder-panel .bh-char-head .bh-gauge { display: none !important; }\n\n/* Idle (untracked) facial features on the silhouette render faintly so the\n   face still reads as a face even when no eye/ear/mouth slot is populated. */\n.bh-silhouette .bh-face-idle { fill: rgba(207, 210, 214, 0.1); stroke-opacity: 0.28; }\n\n/* Onboarding popover — gold restyle (higher-specificity overrides of the\n   neutral defaults above). */\n.beholder-onboard .bh-onboard-title {\n    color: var(--bh-gold-deep, var(--bh-accent, var(--primary)));\n    font-family: \"Cinzel\", \"Trajan Pro\", \"Georgia\", serif;\n}\n.beholder-onboard .bh-onboard-body b { color: var(--bh-chroma, var(--primary)); }\n.beholder-onboard .bh-onboard-dismiss {\n    background: linear-gradient(160deg, color-mix(in srgb, var(--bh-accent) 28%, transparent), color-mix(in srgb, var(--bh-accent) 10%, transparent));\n    border: 1px solid color-mix(in srgb, var(--bh-accent) 60%, transparent);\n    color: var(--bh-chroma, var(--primary));\n}\n.beholder-onboard .bh-onboard-dismiss:hover {\n    filter: none;\n    box-shadow: color-mix(in srgb, var(--bh-accent) 25%, transparent) 0 4px 18px;\n}\n\n/* ─── Button family ──────────────────────────────────────────────────────\n   Shared pill button used across the view overlays + editors. */\n.bh-btn {\n    display: inline-flex;\n    align-items: center;\n    gap: 7px;\n    padding: 5px 12px;\n    border-radius: 7px;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    letter-spacing: 0.05em;\n    border: 1px solid var(--bh-border);\n    background: var(--bh-surface-1);\n    color: var(--bh-body);\n    cursor: pointer;\n    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s, transform 0.1s;\n}\n.bh-btn:active { transform: scale(0.97); }\n.bh-btn:hover {\n    border-color: var(--bh-gold-deep);\n    color: var(--SmartThemeBodyColor, #e8eaee);\n}\n.bh-btn-primary {\n    background: linear-gradient(160deg, color-mix(in srgb, var(--bh-accent) 24%, transparent), color-mix(in srgb, var(--bh-accent) 7%, transparent));\n    border-color: color-mix(in srgb, var(--bh-accent) 60%, transparent);\n    color: var(--bh-chroma, var(--primary));\n}\n.bh-btn-primary:hover {\n    box-shadow: color-mix(in srgb, var(--bh-accent) 22%, transparent) 0 4px 18px;\n    border-color: var(--bh-gold-deep);\n}\n.bh-btn-danger {\n    border-color: rgba(255, 130, 110, 0.45);\n    color: rgb(255, 152, 136);\n}\n.bh-btn-danger:hover {\n    border-color: rgb(255, 152, 136);\n    color: rgb(255, 176, 160);\n    box-shadow: none;\n}\n.bh-btn[disabled] { opacity: 0.45; pointer-events: none; }\n\n/* ─── Header tool icons + overflow menu ──────────────────────────────────\n   The flat icon row (settings / doctor / inspector / help) + a \"⋯\" overflow\n   trigger, separated from the backfill group and close button by thin\n   dividers. The icons collapse into the overflow menu at narrow widths\n   (see the 360px container query above). */\n.beholder-tool-btn:focus-visible {\n    outline: 1px solid var(--bh-gold-deep);\n    outline-offset: 2px;\n    border-radius: 3px;\n    opacity: 1;\n}\n.beholder-panel-controls .bh-header-sep {\n    width: 1px;\n    height: 14px;\n    align-self: center;\n    flex-shrink: 0;\n    margin: 0 1px;\n    background: var(--bh-border);\n    opacity: 0.8;\n}\n.beholder-tools-more { display: none; }\n.beholder-tools-more.bh-more-open { opacity: 1; color: var(--bh-accent); }\n.beholder-tools-menu {\n    position: absolute;\n    top: calc(100% + 5px);\n    right: var(--bh-space-3);\n    z-index: 10001;\n    min-width: 180px;\n    padding: var(--bh-space-1);\n    background: rgba(16, 18, 24, 0.98);\n    border: 1px solid var(--bh-border);\n    border-radius: 8px;\n    box-shadow: rgba(0, 0, 0, 0.55) 0 8px 28px;\n    display: flex;\n    flex-direction: column;\n    gap: 1px;\n}\n.beholder-tools-menu::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    border-radius: 8px 8px 0 0;\n    background: linear-gradient(90deg, var(--bh-gold-deep), color-mix(in srgb, var(--bh-accent) 35%, transparent) 40%, transparent 80%);\n    opacity: 0.75;\n}\n.beholder-tools-item {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    width: 100%;\n    padding: 9px 11px;\n    background: transparent;\n    border: none;\n    border-radius: 5px;\n    color: var(--SmartThemeBodyColor, #e6e6e6);\n    font: inherit;\n    font-size: var(--bh-text-body);\n    text-align: left;\n    cursor: pointer;\n    transition: background 0.12s;\n}\n.beholder-tools-item:hover,\n.beholder-tools-item:focus-visible {\n    background: var(--bh-surface-2);\n    outline: none;\n}\n.beholder-tools-item i { width: 17px; text-align: center; color: var(--bh-gold-deep); }\n\n/* ─── Paired doll grid ───────────────────────────────────────────────────\n   Left / center figure / right column layout. Each anatomical pair sits\n   across columns 1 and 3; the empty half of a populated pair gets a faint\n   ghost card so the grid stays balanced. (Collapses to the digest at narrow\n   widths via the 360px container query above.) */\n.bh-doll-grid.bh-paired {\n    display: grid;\n    /* minmax(0, …) side tracks — see the base .bh-doll-grid note. Extra-important here\n       because `.bh-col { display: contents }` below dissolves the columns, so the SLOT\n       CARDS are the direct grid items; a bare `1fr` would size to the widest card's\n       min-content and push the right column over the panel edge. */\n    grid-template-columns: minmax(0, 1fr) minmax(calc(132px * var(--bh-ui-scale, 1)), calc(148px * var(--bh-ui-scale, 1))) minmax(0, 1fr);\n    gap: calc(4px * var(--bh-ui-scale, 1)) calc(6px * var(--bh-ui-scale, 1));\n    align-items: stretch;\n}\n.bh-doll-grid.bh-paired .bh-col { display: contents; }\n.bh-doll-grid.bh-paired .bh-figure { align-self: start; }\n.bh-doll-grid.bh-paired .bh-slot-ghosted { opacity: 0.22; }\n.bh-doll-grid.bh-paired .bh-slot-ghosted:hover { opacity: 0.5; }\n\n/* ─── Layout switch (paired / columns / list) ────────────────────────────\n   List mode forces the digest render via .bh-layout-compact. */\n.beholder-panel.bh-layout-compact .bh-doll-grid { display: none; }\n.beholder-panel.bh-layout-compact .bh-digest { display: block; }\n.bh-layout-switch {\n    display: inline-flex;\n    margin-top: var(--bh-space-2);\n    border: 1px solid var(--bh-border);\n    border-radius: 999px;\n    overflow: hidden;\n    background: var(--bh-surface-1);\n}\n.bh-layout-switch .bh-ls-opt {\n    background: transparent;\n    border: none;\n    cursor: pointer;\n    color: var(--bh-body);\n    opacity: var(--bh-mute-strong);\n    padding: 2px 9px;\n    font-size: var(--bh-text-meta);\n    line-height: 1.2;\n    transition: background 0.15s, color 0.15s, opacity 0.15s;\n}\n.bh-layout-switch .bh-ls-opt + .bh-ls-opt { border-left: 1px solid var(--bh-divider); }\n.bh-layout-switch .bh-ls-opt:hover {\n    opacity: 0.85;\n    color: var(--SmartThemeBodyColor, #e8eaee);\n}\n.bh-layout-switch .bh-ls-opt.bh-ls-active {\n    opacity: 1;\n    color: var(--bh-gold, var(--bh-chroma, var(--primary)));\n    background: var(--bh-surface-2);\n}\n.bh-layout-switch-row { display: flex; justify-content: flex-end; }\n\n/* Digest toolbar — \"Edit slots\" action on the left, a layout switch on the\n   right, above the digest priority feed. */\n.bh-digest-toolbar {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: var(--bh-space-2);\n    margin-bottom: var(--bh-space-3);\n}\n.bh-digest-edit {\n    display: inline-flex;\n    align-items: center;\n    gap: 7px;\n    padding: 6px 14px;\n    border-radius: 8px;\n    background: linear-gradient(160deg, color-mix(in srgb, var(--bh-accent) 20%, transparent), color-mix(in srgb, var(--bh-accent) 6%, transparent));\n    border: 1px solid color-mix(in srgb, var(--bh-accent) 50%, transparent);\n    color: var(--bh-chroma, var(--primary));\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    letter-spacing: 0.05em;\n    cursor: pointer;\n    transition: box-shadow 0.15s, border-color 0.15s;\n}\n.bh-digest-edit:hover {\n    box-shadow: color-mix(in srgb, var(--bh-accent) 20%, transparent) 0 3px 14px;\n    border-color: var(--bh-gold-deep);\n}\n.bh-digest-edit i { font-size: 0.9em; }\n\n/* ─── Mobile bottom sheet (slot picker + slot editor) ────────────────────\n   Slides up from the bottom of the panel on touch / narrow layouts. */\n.bh-sheet-backdrop {\n    position: absolute;\n    inset: 0;\n    z-index: 95;\n    background: rgba(0, 0, 0, 0.45);\n    animation: 0.15s ease-out bh-view-in;\n}\n.bh-edit-sheet {\n    position: absolute;\n    left: 0;\n    right: 0;\n    bottom: 0;\n    z-index: 96;\n    max-height: 88%;\n    display: flex;\n    flex-direction: column;\n    background: var(--SmartThemeBlurTintColor, rgba(13, 15, 20, 0.98));\n    border-top: 1px solid var(--bh-border);\n    border-radius: 14px 14px 0 0;\n    box-shadow: rgba(0, 0, 0, 0.6) 0 -10px 40px;\n    animation: 0.2s cubic-bezier(0.2, 0.7, 0.2, 1) bh-sheet-up;\n}\n@keyframes bh-sheet-up {\n    0% { transform: translateY(100%); }\n    100% { transform: none; }\n}\n@media (prefers-reduced-motion: reduce) {\n    .bh-edit-sheet { animation: none; }\n    .bh-sheet-backdrop { animation: none; }\n}\n.bh-edit-sheet::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    border-radius: 14px 14px 0 0;\n    background: linear-gradient(90deg, var(--bh-gold-deep) 0%, color-mix(in srgb, var(--bh-accent) 40%, transparent) 22%, transparent 60%);\n    opacity: 0.8;\n}\n.bh-sheet-head {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    padding: var(--bh-space-3);\n    border-bottom: 1px solid var(--bh-divider);\n    flex-shrink: 0;\n}\n.bh-sheet-back,\n.bh-sheet-close {\n    cursor: pointer;\n    opacity: var(--bh-mute-soft);\n    padding: 5px;\n    font-size: 1.05em;\n    transition: opacity 0.15s, color 0.15s;\n}\n.bh-sheet-back[hidden] { display: none; }\n.bh-sheet-back:hover,\n.bh-sheet-close:hover { opacity: 1; color: var(--bh-gold-deep); }\n.bh-sheet-title {\n    flex: 1 1 0%;\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-large);\n    font-weight: 600;\n    letter-spacing: 0.06em;\n}\n.bh-sheet-close { margin-left: auto; }\n.bh-sheet-body {\n    flex: 1 1 0%;\n    overflow-y: auto;\n    padding: var(--bh-space-3);\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n}\n.bh-sheet-lockrow {\n    display: flex;\n    justify-content: flex-end;\n    margin-bottom: var(--bh-space-2);\n}\n.bh-sheet-body .bh-editor-body { max-height: none; overflow: visible; padding: 0; }\n.bh-sheet-body .bh-editor-foot {\n    border-top: 1px solid var(--bh-divider);\n    margin-top: var(--bh-space-3);\n    padding: var(--bh-space-3) 0 0;\n    background: transparent;\n}\n.bh-slot-picker { display: flex; flex-direction: column; gap: var(--bh-space-3); }\n.bh-pick-region-head {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.16em;\n    text-transform: uppercase;\n    color: var(--bh-gold-deep);\n    margin-bottom: var(--bh-space-1);\n}\n.bh-pick-slot {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    width: 100%;\n    padding: 10px 12px;\n    margin-bottom: 3px;\n    background: var(--bh-surface-1);\n    border: 1px solid var(--bh-divider);\n    border-radius: 8px;\n    color: var(--bh-body);\n    font: inherit;\n    text-align: left;\n    cursor: pointer;\n    transition: background 0.12s, border-color 0.12s;\n}\n.bh-pick-slot:hover,\n.bh-pick-slot:focus-visible {\n    background: var(--bh-surface-2);\n    border-color: var(--bh-gold-deep);\n    outline: none;\n}\n.bh-pick-label {\n    flex-shrink: 0;\n    min-width: 5.5em;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    letter-spacing: 0.04em;\n    text-transform: lowercase;\n    color: var(--SmartThemeBodyColor, #e6e6e6);\n}\n.bh-pick-summary {\n    flex: 1 1 0%;\n    min-width: 0;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    font-size: var(--bh-text-secondary);\n    opacity: 0.85;\n}\n.bh-pick-summary.bh-pick-empty { opacity: 0.4; font-style: italic; }\n.bh-pick-summary.bh-pick-bare { color: rgba(220, 188, 156, 0.95); opacity: 1; }\n.bh-pick-summary.bh-pick-missing { color: rgba(160, 160, 160, 0.95); font-style: italic; opacity: 1; }\n.bh-pick-mark { flex-shrink: 0; font-size: 0.85em; }\n.bh-pick-lock { color: var(--bh-gold); }\n.bh-pick-edited { color: var(--bh-gold-deep); }\n.bh-pick-arrow { flex-shrink: 0; opacity: 0.4; font-size: 0.8em; }\n\n/* ─── View overlay (settings / doctor / inspector / help) ────────────────\n   Full-panel overlay surface with its own header, scroll body, and a set of\n   collapsible sections. */\n.bh-view {\n    position: absolute;\n    inset: 0;\n    z-index: 60;\n    display: flex;\n    flex-direction: column;\n    background: var(--SmartThemeBlurTintColor, rgba(13, 15, 20, 0.97));\n    border-radius: 12px;\n    overflow: hidden;\n    animation: 0.18s ease-out bh-view-in;\n}\n@keyframes bh-view-in {\n    0% { opacity: 0; transform: translateY(6px); }\n    100% { opacity: 1; transform: none; }\n}\n@media (prefers-reduced-motion: reduce) {\n    .bh-view { animation: none; }\n}\n.bh-view-head {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    padding: var(--bh-space-2) var(--bh-space-3);\n    background: var(--bh-surface-2);\n    border-bottom: 1px solid var(--bh-divider);\n    position: relative;\n    flex-shrink: 0;\n    cursor: move;\n}\n.bh-view-head::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    background: linear-gradient(90deg, var(--bh-gold-deep) 0%, color-mix(in srgb, var(--bh-accent) 40%, transparent) 22%, transparent 60%);\n    opacity: 0.7;\n}\n.bh-view-back {\n    cursor: pointer;\n    opacity: var(--bh-mute-soft);\n    padding: 2px 6px 2px 2px;\n    transition: opacity 0.15s, color 0.15s;\n}\n.bh-view-back:hover { opacity: 1; color: var(--bh-gold-deep); }\n.bh-view-title {\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-large);\n    font-weight: 600;\n    letter-spacing: 0.1em;\n}\n.bh-view-title .bh-view-crumb {\n    opacity: 0.45;\n    font-size: 0.82em;\n    letter-spacing: 0.08em;\n    margin-right: 0.4em;\n}\n.bh-view-body {\n    flex: 1 1 0%;\n    overflow-y: auto;\n    padding: var(--bh-space-3);\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n    font-size: var(--bh-text-secondary);\n    user-select: text;\n}\n.bh-vsection {\n    border: 1px solid var(--bh-divider);\n    border-radius: 10px;\n    background: var(--bh-surface-1);\n    margin-bottom: var(--bh-space-3);\n    overflow: hidden;\n}\n.bh-vsection > summary {\n    list-style: none;\n    cursor: pointer;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 600;\n    letter-spacing: 0.18em;\n    text-transform: uppercase;\n    color: var(--bh-gold-deep);\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    user-select: none;\n}\n.bh-vsection > summary::-webkit-details-marker { display: none; }\n.bh-vsection > summary::after {\n    content: \"›\";\n    margin-left: auto;\n    opacity: 0.5;\n    transition: transform 0.15s;\n    font-size: 1.25em;\n    letter-spacing: 0;\n}\n.bh-vsection[open] > summary::after { transform: rotate(90deg); }\n.bh-vsection-body {\n    padding: 0 var(--bh-space-3) var(--bh-space-3);\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-3);\n}\n.bh-vsection-body p { margin: 0; opacity: 0.8; line-height: 1.5; }\n/* The Advanced > custom-endpoint body is NOT a .bh-vsection-body, so it missed the\n   column-gap spacing and its endpoint/model/key bars stacked flush. Match the same\n   rhythm so each field has a few px of breathing room under it. */\n.bh-adv-endpoint-body {\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-3);\n}\n.bh-field { display: flex; flex-direction: column; gap: 3px; }\n.bh-field > label {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.08em;\n    text-transform: uppercase;\n    opacity: 0.6;\n}\n.bh-input,\n.bh-select {\n    background: rgba(0, 0, 0, 0.25);\n    border: 1px solid var(--bh-border);\n    border-radius: 6px;\n    color: var(--SmartThemeBodyColor, #e6e6e6);\n    font: inherit;\n    padding: 6px 9px;\n    width: 100%;\n    box-sizing: border-box;\n    transition: border-color 0.15s, box-shadow 0.15s;\n}\n.bh-input:focus-visible,\n.bh-select:focus-visible {\n    outline: none;\n    border-color: var(--bh-gold-deep);\n    box-shadow: color-mix(in srgb, var(--bh-accent) 12%, transparent) 0 0 0 3px;\n}\n.bh-check { display: flex; align-items: baseline; gap: 8px; cursor: pointer; line-height: 1.45; }\n.bh-check input { accent-color: var(--bh-gold-deep); flex-shrink: 0; }\n.bh-check small { display: block; opacity: 0.55; font-size: 0.88em; }\n.bh-row-actions { display: flex; gap: var(--bh-space-2); flex-wrap: wrap; align-items: center; }\n.bh-conn-status {\n    display: inline-flex;\n    align-items: center;\n    gap: 7px;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.06em;\n    opacity: 0.85;\n}\n.bh-dot {\n    width: 8px;\n    height: 8px;\n    border-radius: 50%;\n    flex-shrink: 0;\n    background: var(--bh-mute-strong, #777);\n}\n.bh-dot-ok { background: rgb(106, 212, 139); box-shadow: rgba(106, 212, 139, 0.6) 0 0 6px; }\n.bh-dot-warn { background: var(--bh-accent); box-shadow: color-mix(in srgb, var(--bh-accent) 60%, transparent) 0 0 6px; }\n.bh-dot-bad { background: rgb(226, 100, 100); box-shadow: rgba(226, 100, 100, 0.6) 0 0 6px; }\n.bh-dot-busy { background: var(--bh-gold-deep); animation: 1s ease-in-out infinite bh-dot-pulse; }\n@keyframes bh-dot-pulse {\n    50% { opacity: 0.35; }\n}\n.bh-vitals { display: flex; flex-direction: column; }\n.bh-vital {\n    display: flex;\n    align-items: baseline;\n    gap: 10px;\n    padding: 6px 2px;\n    border-bottom: 1px dashed var(--bh-divider);\n    line-height: 1.4;\n}\n.bh-vital:last-child { border-bottom: none; }\n.bh-vital .bh-dot { align-self: center; }\n.bh-vital-label {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.07em;\n    text-transform: uppercase;\n    opacity: 0.6;\n    flex: 0 0 34%;\n}\n.bh-vital-value { flex: 1 1 0%; min-width: 0; overflow-wrap: anywhere; }\n.bh-vital-value code {\n    background: rgba(255, 255, 255, 0.06);\n    padding: 0 5px;\n    border-radius: 3px;\n    font-size: 0.92em;\n}\n.bh-code {\n    background: rgba(0, 0, 0, 0.32);\n    border: 1px solid var(--bh-divider);\n    border-radius: 8px;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    font-family: var(--bh-font-data);\n    font-size: 0.8em;\n    line-height: 1.5;\n    white-space: pre-wrap;\n    overflow-wrap: anywhere;\n    max-height: 240px;\n    overflow-y: auto;\n    margin: 0;\n    color: var(--bh-body);\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n    user-select: text;\n}\n.bh-pane-meta {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.05em;\n    opacity: 0.5;\n    margin-left: auto;\n    text-transform: none;\n}\n.bh-vlog { display: flex; flex-direction: column; gap: 4px; }\n.bh-vlog-row {\n    display: flex;\n    align-items: baseline;\n    gap: 8px;\n    font-family: var(--bh-font-data);\n    font-size: 0.8em;\n    line-height: 1.45;\n    padding: 4px 8px;\n    border-radius: 5px;\n    background: rgba(255, 255, 255, 0.025);\n    border-left: 2px solid var(--bh-divider);\n}\n.bh-vlog-row b { flex-shrink: 0; font-size: 0.85em; letter-spacing: 0.1em; }\n.bh-vlog-warn { border-left-color: var(--bh-accent); }\n.bh-vlog-warn b { color: var(--bh-accent); }\n.bh-vlog-error { border-left-color: rgb(226, 100, 100); }\n.bh-vlog-error b { color: rgb(255, 118, 118); }\n.bh-vlog-ok { border-left-color: rgb(106, 212, 139); opacity: 0.75; }\n.bh-vlog-ok b { color: rgb(106, 212, 139); }\n.bh-turns { width: 100%; border-collapse: collapse; font-size: 0.85em; }\n.bh-turns th {\n    font-family: var(--bh-font-data);\n    font-size: 0.78em;\n    letter-spacing: 0.1em;\n    text-transform: uppercase;\n    opacity: 0.5;\n    text-align: left;\n    padding: 3px 8px 5px 0;\n    border-bottom: 1px solid var(--bh-divider);\n    font-weight: 500;\n}\n.bh-turns td {\n    padding: 5px 8px 5px 0;\n    border-bottom: 1px dashed var(--bh-divider);\n    font-family: var(--bh-font-data);\n    font-size: 0.92em;\n}\n.bh-turns tr:last-child td { border-bottom: none; }\n.bh-tips {\n    margin: 0;\n    padding-left: 18px;\n    display: flex;\n    flex-direction: column;\n    gap: 7px;\n}\n.bh-tips li { line-height: 1.5; opacity: 0.85; }\n.bh-tips li::marker { color: var(--bh-gold-deep); }\n.bh-tips b { color: var(--bh-chroma, var(--primary)); font-weight: 600; }\n.bh-orn {\n    display: flex;\n    align-items: center;\n    gap: 14px;\n    margin: var(--bh-space-2) auto;\n    max-width: 220px;\n    color: color-mix(in srgb, var(--bh-accent) 55%, transparent);\n    font-size: 0.85em;\n    text-shadow: color-mix(in srgb, var(--bh-accent) 50%, transparent) 0 0 12px;\n}\n.bh-orn span {\n    flex: 1 1 0%;\n    height: 1px;\n    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--bh-accent) 35%, transparent));\n}\n.bh-orn span:last-child {\n    background: linear-gradient(90deg, color-mix(in srgb, var(--bh-accent) 35%, transparent), transparent);\n}\n\n/* ─── Desktop slot editor (floating popover) ─────────────────────────────\n   Per-slot worn / held / wound editor anchored to the clicked card. */\n.bh-editor {\n    position: absolute;\n    z-index: 80;\n    width: min(330px, 100% - 16px);\n    background: rgba(16, 18, 24, 0.98);\n    border: 1px solid var(--bh-border);\n    border-radius: 10px;\n    box-shadow: rgba(0, 0, 0, 0.6) 0 14px 44px;\n    display: flex;\n    flex-direction: column;\n    overflow: hidden;\n    font-size: var(--bh-text-secondary);\n    animation: 0.15s ease-out bh-view-in;\n}\n.bh-editor-head {\n    display: flex;\n    align-items: center;\n    gap: 9px;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    background: var(--bh-surface-2);\n    border-bottom: 1px solid var(--bh-divider);\n    position: relative;\n}\n.bh-editor-head::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    background: linear-gradient(90deg, var(--bh-gold-deep), color-mix(in srgb, var(--bh-accent) 35%, transparent) 40%, transparent 80%);\n    opacity: 0.7;\n}\n.bh-editor-title {\n    font-family: var(--bh-font-display);\n    font-weight: 600;\n    font-size: var(--bh-text-large);\n    letter-spacing: 0.08em;\n}\n.bh-editor-slot {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.08em;\n    text-transform: lowercase;\n    opacity: 0.55;\n}\n.bh-editor-close { margin-left: auto; cursor: pointer; opacity: 0.6; }\n.bh-editor-close:hover { opacity: 1; color: var(--bh-gold-deep); }\n.bh-editor-body {\n    padding: var(--bh-space-3);\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-2);\n    overflow-y: auto;\n    max-height: 52vh;\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n}\n.bh-editor-group-label {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.16em;\n    text-transform: uppercase;\n    color: var(--bh-gold-deep);\n    opacity: 0.85;\n    margin-top: var(--bh-space-1);\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n.bh-editor-group-label::after { content: \"\"; flex: 1 1 0%; height: 1px; background: var(--bh-divider); }\n.bh-editor-row {\n    display: grid;\n    grid-template-columns: 1fr 86px 74px 22px;\n    gap: 6px;\n    align-items: center;\n}\n.bh-editor-row .bh-input,\n.bh-editor-row .bh-select { padding: 4px 7px; font-size: 0.92em; }\n.bh-editor-row-wound { grid-template-columns: 1fr 86px 24px 22px; }\n.bh-editor-remove {\n    background: none;\n    border: none;\n    color: var(--bh-body);\n    opacity: 0.4;\n    cursor: pointer;\n    font-size: 0.95em;\n    padding: 2px;\n    transition: opacity 0.12s, color 0.12s;\n}\n.bh-editor-remove:hover { opacity: 1; color: rgb(255, 133, 133); }\n.bh-editor-add {\n    align-self: flex-start;\n    background: none;\n    border: 1px dashed var(--bh-border);\n    border-radius: 6px;\n    color: var(--bh-body);\n    opacity: 0.6;\n    cursor: pointer;\n    font: inherit;\n    font-size: 0.88em;\n    padding: 3px 10px;\n    transition: opacity 0.12s, border-color 0.12s, color 0.12s;\n}\n.bh-editor-add:hover { opacity: 1; border-color: var(--bh-gold-deep); color: var(--bh-chroma, var(--primary)); }\n.bh-bleed-check { display: inline-flex; align-items: center; justify-content: center; }\n.bh-bleed-check input { accent-color: rgb(255, 71, 71); }\n.bh-editor-body.bhe-missing-mode > :not(.bh-row-actions):not(.bh-editor-group-label:last-of-type) {\n    opacity: 0.35;\n    pointer-events: none;\n}\n.bh-editor-body.bhe-missing-mode > .bh-row-actions,\n.bh-editor-body.bhe-missing-mode > .bh-editor-group-label:last-of-type {\n    opacity: 1;\n    pointer-events: auto;\n}\n.bh-editor-foot {\n    display: flex;\n    gap: var(--bh-space-2);\n    padding: var(--bh-space-2) var(--bh-space-3);\n    border-top: 1px solid var(--bh-divider);\n    background: var(--bh-surface-1);\n    align-items: center;\n}\n.bh-editor-foot .bh-btn-primary { margin-left: auto; }\n.bh-lock-toggle {\n    display: inline-flex;\n    align-items: center;\n    gap: 6px;\n    cursor: pointer;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.1em;\n    text-transform: uppercase;\n    opacity: 0.6;\n    border: 1px solid var(--bh-border);\n    border-radius: 20px;\n    padding: 2px 10px;\n    transition: opacity 0.15s, border-color 0.15s, color 0.15s;\n    user-select: none;\n}\n.bh-lock-toggle:hover { opacity: 1; }\n.bh-lock-toggle.bh-locked-on {\n    opacity: 1;\n    color: var(--bh-gold);\n    border-color: color-mix(in srgb, var(--bh-chroma) 50%, transparent);\n    text-shadow: color-mix(in srgb, var(--bh-chroma) 40%, transparent) 0 0 8px;\n}\n\n/* ─── Slot card lock / user-edited decoration ────────────────────────────\n   A locked slot is pinned by the user so model deltas can't overwrite it; a\n   user-edited slot carries a small ✎ mark. */\n.bh-slot-card { cursor: pointer; }\n.bh-slot-card.bh-slot-locked {\n    border-color: color-mix(in srgb, var(--bh-accent) 45%, transparent);\n    background: color-mix(in srgb, var(--bh-accent) 5%, transparent);\n}\n.bh-slot-lock-glyph {\n    color: var(--bh-gold);\n    font-size: 0.72em;\n    margin-left: 5px;\n    text-shadow: color-mix(in srgb, var(--bh-chroma) 45%, transparent) 0 0 7px;\n    flex-shrink: 0;\n}\n.bh-slot-card.bh-slot-user-edited .bh-slot-name::after {\n    content: \"✎\";\n    color: var(--bh-gold-deep);\n    font-size: 0.85em;\n    margin-left: 5px;\n    opacity: 0.8;\n}\n\n/* ─── Toast ──────────────────────────────────────────────────────────────\n   Transient confirmation message, centered near the bottom of the viewport. */\n.bh-toast {\n    position: fixed;\n    left: 50%;\n    bottom: 86px;\n    transform: translateX(-50%) translateY(8px);\n    z-index: 99999;\n    background: rgba(16, 18, 24, 0.97);\n    border: 1px solid color-mix(in srgb, var(--bh-accent) 55%, transparent);\n    border-radius: 9px;\n    color: var(--bh-chroma, var(--primary));\n    font: 13px / 1.45 \"JetBrains Mono\", monospace;\n    letter-spacing: 0.03em;\n    padding: 9px 18px;\n    box-shadow: rgba(0, 0, 0, 0.55) 0 10px 34px, color-mix(in srgb, var(--bh-accent) 12%, transparent) 0 0 22px;\n    opacity: 0;\n    transition: opacity 0.2s, transform 0.2s;\n    pointer-events: none;\n    max-width: min(520px, 86vw);\n    text-align: center;\n}\n.bh-toast.bh-toast-in { opacity: 1; transform: translateX(-50%) translateY(0); }\n\n/* ══════════════════════════════════════════════════════════════════════════\n   Local-model card + \"no model active\" banner (browser-engine surfaces)\n   ─────────────────────────────────────────────────────────────────────────\n   Built entirely from the existing gold + surface + space tokens. The card\n   lives at the top of the settings view's Connection section (above the\n   custom-endpoint fields, which move under a collapsed Advanced <details>);\n   the banner is a persistent strip in the panel, modelled on the backfill\n   status strip. No new color system — readiness dots reuse .bh-dot*,\n   buttons reuse .bh-btn family, the progress bar mirrors .bh-bf-bar.\n   ══════════════════════════════════════════════════════════════════════════ */\n\n/* ─── Local-model card ───────────────────────────────────────────────────\n   An elevated panel inside the settings view. Reads as the primary control\n   for the connection section — a touch more presence than a .bh-vsection\n   (gold hairline top rule, like the editor/header chrome) without inventing\n   new tokens. */\n.bh-localmodel-card {\n    position: relative;\n    border: 1px solid var(--bh-border);\n    border-radius: 10px;\n    background: var(--bh-surface-2);\n    padding: var(--bh-space-3);\n    margin-bottom: var(--bh-space-3);\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-2);\n    overflow: hidden;\n}\n/* Quiet gold top rule — same anchored-on-the-left gradient the header and\n   editor use, so the card reads as part of the brand chrome. */\n.bh-localmodel-card::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    background: linear-gradient(\n        90deg,\n        var(--bh-gold-deep),\n        color-mix(in srgb, var(--bh-accent) 35%, transparent) 40%,\n        transparent 80%\n    );\n    opacity: 0.7;\n    pointer-events: none;\n}\n\n/* Card header: a label + the lifecycle status pill. */\n.bh-lm-head {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    flex-wrap: wrap;\n}\n.bh-lm-title {\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-large);\n    font-weight: 600;\n    letter-spacing: 0.08em;\n    color: var(--SmartThemeBodyColor, #e8eaee);\n}\n/* Microchip accent at the right of the head (the leading status dot is the\n   primary marker). */\n.bh-lm-glyph {\n    color: var(--bh-gold-deep);\n    opacity: 0.6;\n    margin-left: auto;\n    font-size: 0.95em;\n}\n/* The pinned model id / version line under the header. */\n.bh-lm-modelid {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    opacity: 0.6;\n    margin: 2px 0 6px;\n}\n.bh-lm-modelid code { font-family: inherit; }\n/* Status pill — a dot + short word (\"ready\", \"off\", \"downloading…\").\n   Reuses the conn-status idiom and the .bh-dot* color set. */\n.bh-lm-status {\n    display: inline-flex;\n    align-items: center;\n    gap: 7px;\n    margin-left: auto;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.1em;\n    text-transform: uppercase;\n    opacity: 0.85;\n    white-space: nowrap;\n}\n\n/* Descriptive copy line below the header (state-dependent prose). */\n.bh-lm-copy {\n    font-size: var(--bh-text-secondary);\n    line-height: 1.5;\n    opacity: 0.8;\n    margin: 0;\n}\n.bh-lm-copy code {\n    background: rgba(255, 255, 255, 0.06);\n    padding: 0 5px;\n    border-radius: 3px;\n    font-size: 0.92em;\n}\n\n/* ─── Readiness rows (GPU / Disk / RAM) ──────────────────────────────────\n   Same anatomy as the Doctor vitals: a status dot, a mono label, a value.\n   Reuses .bh-dot / .bh-dot-ok / .bh-dot-warn / .bh-dot-bad exactly. */\n.bh-lm-readiness {\n    display: flex;\n    flex-direction: column;\n    border: 1px solid var(--bh-divider);\n    border-radius: 8px;\n    background: var(--bh-surface-1);\n    padding: 0 var(--bh-space-3);\n}\n.bh-lm-readiness-row {\n    display: flex;\n    align-items: baseline;\n    gap: 10px;\n    padding: 6px 0;\n    border-bottom: 1px dashed var(--bh-divider);\n    line-height: 1.4;\n}\n.bh-lm-readiness-row:last-child { border-bottom: none; }\n.bh-lm-readiness-row .bh-dot { align-self: center; }\n.bh-lm-readiness-label {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.07em;\n    text-transform: uppercase;\n    opacity: 0.6;\n    flex: 0 0 22%;\n    min-width: 56px;\n}\n.bh-lm-readiness-value {\n    flex: 1 1 0%;\n    min-width: 0;\n    overflow-wrap: anywhere;\n    font-size: var(--bh-text-secondary);\n}\n/* \"hint only\" qualifier (RAM is a total-not-free Chromium hint). Quiet\n   trailing note so the honest copy doesn't read as a hard number. */\n.bh-lm-readiness-hint {\n    font-family: var(--bh-font-data);\n    font-size: 0.82em;\n    letter-spacing: 0.04em;\n    opacity: 0.45;\n    margin-left: 6px;\n    text-transform: lowercase;\n}\n/* Actionable help line under a FAILED gate (e.g. how to enable WebGPU per\n   browser) — a readable gold block note, NOT the faint inline qualifier above. */\n.bh-lm-hint {\n    display: block;\n    margin-top: 4px;\n    font-size: 0.86em;\n    line-height: 1.45;\n    color: var(--bh-gold-soft, var(--bh-chroma, var(--primary)));\n    opacity: 0.9;\n}\n/* Card \"update available\" indicator (persists after the dialog is dismissed). */\n.bh-lm-update {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    margin: var(--bh-space-2) 0;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    border-radius: 8px;\n    background: color-mix(in srgb, var(--bh-accent) 12%, transparent);\n    box-shadow: inset 2px 0 0 var(--bh-gold-deep);\n    font-size: var(--bh-text-secondary);\n}\n.bh-lm-update > span { flex: 1 1 auto; min-width: 0; }\n.bh-lm-update .bh-btn { flex: 0 0 auto; padding: 5px 12px; }\n\n/* ─── Model-update banner (in-panel CTA strip; sibling of the no-model banner) ── */\n.bh-update-banner {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-3);\n    flex-wrap: wrap;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    font-size: var(--bh-text-secondary);\n    border-bottom: 1px solid color-mix(in srgb, var(--bh-accent) 40%, transparent);\n    box-shadow: inset 3px 0 0 var(--bh-gold-deep);\n    background: linear-gradient(\n        90deg,\n        color-mix(in srgb, var(--bh-accent) 16%, transparent),\n        color-mix(in srgb, var(--bh-accent) 4%, transparent) 60%,\n        transparent\n    );\n}\n.bh-update-banner-copy { flex: 1 1 auto; min-width: 0; line-height: 1.45; }\n.bh-update-banner-copy > i { color: var(--bh-gold-deep); margin-right: 4px; }\n.bh-update-banner-actions {\n    display: flex;\n    gap: var(--bh-space-2);\n    flex: 1 1 100%;\n}\n.bh-update-banner .bh-btn {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    gap: 6px;\n    padding: 6px 12px;\n    font-size: var(--bh-text-secondary);\n    text-decoration: none;\n}\n.bh-update-banner .bh-update-now { flex: 1 1 0%; }\n.bh-update-banner .bh-update-later { flex: 0 0 auto; padding: 6px 10px; opacity: 0.8; }\n\n/* ─── Progress bar (download / load) ─────────────────────────────────────\n   Mirrors the backfill bar (.bh-bf-bar) but full-width with a label row, so\n   the long weight-streaming phase reads clearly. */\n.bh-lm-progress {\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-1);\n}\n.bh-lm-progress-label {\n    display: flex;\n    align-items: baseline;\n    justify-content: space-between;\n    gap: var(--bh-space-2);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.06em;\n    opacity: 0.75;\n}\n.bh-lm-progress-pct { font-weight: 600; color: var(--bh-chroma, var(--primary)); }\n.bh-lm-progress-bar {\n    height: 6px;\n    background: var(--bh-divider);\n    border-radius: 3px;\n    overflow: hidden;\n}\n.bh-lm-progress-fill {\n    display: block;\n    height: 100%;\n    width: 0;\n    background: var(--bh-accent, var(--primary));\n    box-shadow: color-mix(in srgb, var(--bh-accent) 40%, transparent) 0 0 8px;\n    transition: width 0.2s ease-out;\n}\n/* Indeterminate phase (WebGPU kernel compile reports no fine-grained pct):\n   a slow shimmer across the bar. Honors reduced-motion. */\n.bh-lm-progress-bar.bh-lm-indeterminate .bh-lm-progress-fill {\n    width: 40%;\n    box-shadow: none;\n    animation: bh-lm-indet 1.3s ease-in-out infinite;\n}\n@keyframes bh-lm-indet {\n    0%   { transform: translateX(-110%); }\n    100% { transform: translateX(310%); }\n}\n@media (prefers-reduced-motion: reduce) {\n    .bh-lm-progress-bar.bh-lm-indeterminate .bh-lm-progress-fill {\n        animation: none;\n        width: 100%;\n        opacity: 0.5;\n    }\n}\n\n/* ─── Primary lifecycle button ───────────────────────────────────────────\n   The card's single action (Download · ~X.X GB / Enable / Disable / Retry /\n   Pause). Built on .bh-btn + .bh-btn-primary, just stretched full-width and\n   sized a step up so it reads as the card's call-to-action. Disable uses the\n   existing danger variant; the action row carries one button at a time. */\n.bh-lm-action { display: flex; gap: var(--bh-space-2); align-items: center; }\n.bh-lm-btn {\n    flex: 1 1 auto;\n    justify-content: center;\n    padding: 8px 14px;\n    font-size: var(--bh-text-body);\n    letter-spacing: 0.06em;\n}\n/* Download size / sublabel inside the button, dimmed so the verb leads. */\n.bh-lm-btn .bh-lm-btn-sub {\n    opacity: 0.7;\n    font-size: 0.88em;\n    letter-spacing: 0.04em;\n}\n\n/* ─── Collapsed Advanced section (custom endpoint) ───────────────────────\n   The existing endpoint/model/apiKey fields move under this <details>. It's\n   a quieter sibling of .bh-vsection — same disclosure idiom, dimmed summary\n   so it visually defers to the local-model card above it. */\n.bh-lm-advanced {\n    border: 1px solid var(--bh-divider);\n    border-radius: 8px;\n    background: var(--bh-surface-1);\n    margin-bottom: var(--bh-space-3);\n    overflow: hidden;\n}\n.bh-lm-advanced > summary {\n    list-style: none;\n    cursor: pointer;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 600;\n    letter-spacing: 0.14em;\n    text-transform: uppercase;\n    color: var(--bh-body);\n    opacity: 0.6;\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    user-select: none;\n    transition: opacity 0.15s, color 0.15s;\n}\n.bh-lm-advanced > summary:hover { opacity: 0.9; color: var(--bh-gold-deep); }\n.bh-lm-advanced > summary::-webkit-details-marker { display: none; }\n.bh-lm-advanced > summary::after {\n    content: \"›\";\n    margin-left: auto;\n    opacity: 0.5;\n    transition: transform 0.15s;\n    font-size: 1.25em;\n    letter-spacing: 0;\n}\n.bh-lm-advanced[open] > summary {\n    opacity: 0.85;\n    color: var(--bh-gold-deep);\n}\n.bh-lm-advanced[open] > summary::after { transform: rotate(90deg); }\n.bh-lm-advanced-body {\n    padding: 0 var(--bh-space-3) var(--bh-space-3);\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-2);\n}\n\n/* ─── \"No model active\" banner ───────────────────────────────────────────\n   A persistent strip in the panel, shown when no transport resolves\n   (inactive). Two on-brand variants:\n     .bh-banner-warn  — alarm (never set up / endpoint unreachable): gold-edged\n                        prominent strip that asks for action.\n     .bh-banner-calm  — deliberate \"disabled\" note: quieter, neutral chrome\n                        so a purposeful off-state doesn't read as an error.\n   Modelled on .beholder-backfill-status (surface tint, divider, [hidden]). */\n.bh-no-model-banner {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-3);\n    flex-wrap: wrap;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    background: var(--bh-surface-1);\n    border-bottom: 1px solid var(--bh-divider);\n    font-size: var(--bh-text-secondary);\n    position: relative;\n}\n.bh-no-model-banner[hidden] { display: none; }\n.bh-no-model-banner .bh-banner-copy {\n    flex: 1 1 auto;\n    min-width: 0;\n    line-height: 1.45;\n}\n.bh-banner-copy b { color: var(--bh-chroma, var(--primary)); font-weight: 600; }\n.bh-no-model-banner .bh-banner-icon {\n    flex-shrink: 0;\n    align-self: center;\n}\n.bh-no-model-banner .bh-banner-actions {\n    display: flex;\n    gap: var(--bh-space-2);\n    flex: 1 1 100%;\n    justify-content: center;\n}\n/* Reuse the pill buttons, sized down to strip scale (matches the backfill\n   strip's menu_button sizing). */\n.bh-no-model-banner .bh-btn {\n    padding: 7px 14px;\n    font-size: var(--bh-text-secondary);\n}\n/* Full-width gold buttons — split the action row evenly so the CTA reads as one\n   solid block rather than centered shrink-to-fit pills. */\n.bh-no-model-banner .bh-banner-actions .bh-btn {\n    flex: 1 1 0%;\n    justify-content: center;\n}\n\n/* Warn variant — prominent but on-brand: gold-tinted left accent + a leading\n   ◈ glyph that draws the eye without an alarm-red color. */\n.bh-no-model-banner.bh-banner-warn,\n.bh-no-model-banner.bh-banner-loading {\n    background: linear-gradient(\n        90deg,\n        color-mix(in srgb, var(--bh-accent) 16%, transparent),\n        color-mix(in srgb, var(--bh-accent) 4%, transparent) 60%,\n        transparent\n    );\n    border-bottom-color: color-mix(in srgb, var(--bh-accent) 40%, transparent);\n    box-shadow: inset 3px 0 0 var(--bh-gold-deep);\n}\n/* \"Loading\" shares the gold edge but leans calmer (lighter fill) + a gold spinner,\n   so it reads as in-progress, not alarm — and stays on the gold house style. */\n.bh-no-model-banner.bh-banner-loading {\n    background: linear-gradient(\n        90deg,\n        color-mix(in srgb, var(--bh-accent) 10%, transparent),\n        color-mix(in srgb, var(--bh-accent) 2%, transparent) 60%,\n        transparent\n    );\n}\n.bh-no-model-banner .bh-banner-spin { color: var(--bh-gold-deep); }\n.bh-no-model-banner.bh-banner-warn .bh-banner-icon {\n    color: var(--bh-gold-deep);\n    text-shadow: color-mix(in srgb, var(--bh-accent) 45%, transparent) 0 0 8px;\n}\n\n/* Calm variant — deliberate off: muted, no gold pull, a quiet ○ marker.\n   It's still persistent, just a note rather than a call to action. */\n.bh-no-model-banner.bh-banner-calm {\n    background: var(--bh-surface-1);\n    opacity: 0.9;\n}\n.bh-no-model-banner.bh-banner-calm .bh-banner-copy {\n    opacity: var(--bh-mute-soft);\n}\n.bh-no-model-banner.bh-banner-calm .bh-banner-icon {\n    color: var(--bh-body);\n    opacity: 0.5;\n}\n.bh-no-model-banner.bh-banner-calm .bh-btn { opacity: 0.8; }\n.bh-no-model-banner.bh-banner-calm .bh-btn:hover { opacity: 1; }\n\n/* ─── Narrow-container behavior (consistent with the panel's @container) ──\n   Below 360px the panel is the mobile digest; the card + banner stack their\n   actions full-width and drop the readiness label column to a fixed minimum\n   so values keep room. Mirrors the existing bhpanel container queries. */\n@container bhpanel (max-width: 360px) {\n    .bh-lm-head { gap: var(--bh-space-1); }\n    .bh-lm-status { margin-left: 0; flex-basis: 100%; }\n    .bh-lm-readiness-label { flex-basis: 30%; }\n    .bh-no-model-banner { gap: var(--bh-space-2); }\n    .bh-no-model-banner .bh-banner-actions {\n        flex-basis: 100%;\n        justify-content: stretch;\n    }\n    .bh-no-model-banner .bh-banner-actions .bh-btn { flex: 1 1 0%; justify-content: center; }\n}\n@container bhpanel (max-width: 320px) {\n    .bh-lm-action { flex-direction: column; align-items: stretch; }\n    .bh-lm-btn { width: 100%; }\n}\n\n/* ─── Characters view (roster: reorder · hide · merge) ───────────────────── */\n.bh-ch-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--bh-space-1, 0.286em); }\n.bh-ch {\n    display: flex; align-items: center; gap: var(--bh-space-2, 0.571em);\n    padding: var(--bh-space-1, 0.286em) var(--bh-space-2, 0.571em);\n    border: 1px solid transparent;\n    border-left: 2px solid transparent;\n    border-radius: 6px;\n    background: rgba(255, 255, 255, 0.025);\n    flex-wrap: wrap;\n}\n.bh-ch-you { border-left-color: var(--bh-accent, #88aaff); }\n.bh-ch-star { color: var(--bh-accent, #88aaff); font-size: 0.8em; }\n.bh-ch-grip { cursor: grab; opacity: var(--bh-mute-soft, 0.5); font-size: 0.85em; flex: 0 0 auto; }\n.bh-ch-grip:active { cursor: grabbing; }\n.bh-ch-dragging { opacity: 0.45; }\n.bh-ch-dropzone { border-color: var(--bh-accent, #88aaff); }\n.bh-ch-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }\n.bh-ch-name {\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-body, 1em);\n    letter-spacing: 0.04em;\n    color: var(--bh-body);\n    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.bh-ch-aliases { display: flex; flex-wrap: wrap; gap: var(--bh-space-1, 0.286em); }\n.bh-ch-alias {\n    display: inline-flex; align-items: center; gap: 0.3em;\n    font-size: var(--bh-text-meta, 0.78em);\n    opacity: 0.72;\n    padding: 0.05em 0.4em;\n    border-radius: 3px;\n    background: rgba(255, 255, 255, 0.05);\n}\n.bh-ch-alias .fa-xmark { cursor: pointer; opacity: 0.55; font-size: 0.85em; }\n.bh-ch-alias .fa-xmark:hover { opacity: 1; }\n.bh-ch-tools { display: flex; align-items: center; gap: var(--bh-space-2, 0.571em); flex: 0 0 auto; }\n.bh-ch-tools i {\n    cursor: pointer; opacity: var(--bh-mute-soft, 0.5);\n    transition: opacity 0.15s, color 0.15s; font-size: 1.02em; padding: 2px;\n}\n.bh-ch-tools i:hover { opacity: 1; }\n.bh-ch-hide:hover, .bh-ch-unhide:hover, .bh-ch-merge:hover { color: var(--bh-accent, #88aaff); }\n.bh-ch-hidden { opacity: 0.55; }\n.bh-ch-empty { opacity: 0.6; font-style: italic; padding: var(--bh-space-2, 0.571em); }\n.bh-ch-tray { margin-top: var(--bh-space-3, 0.857em); }\n.bh-ch-tray-cap {\n    display: block; font-size: var(--bh-text-meta, 0.78em);\n    text-transform: uppercase; letter-spacing: 0.08em;\n    opacity: 0.45; margin-bottom: var(--bh-space-1, 0.286em);\n}\n/* inline \"is <name>\" merge picker */\n.bh-ch-pick {\n    flex: 1 1 100%;\n    display: flex; flex-wrap: wrap; align-items: center; gap: var(--bh-space-1, 0.286em);\n    margin-top: var(--bh-space-1, 0.286em);\n    padding-top: var(--bh-space-1, 0.286em);\n    border-top: 1px dashed var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.12));\n}\n.bh-ch-pick-lead { font-size: var(--bh-text-meta, 0.78em); opacity: 0.55; font-style: italic; }\n.bh-ch-pill {\n    cursor: pointer;\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-meta, 0.85em);\n    letter-spacing: 0.03em;\n    color: var(--bh-body);\n    background: transparent;\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));\n    border-radius: 4px;\n    padding: 0.15em 0.6em;\n    opacity: 0.85;\n    transition: opacity 0.12s, border-color 0.12s, color 0.12s;\n}\n.bh-ch-pill:hover { opacity: 1; border-color: var(--bh-accent, #88aaff); color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary))); }\n.bh-ch-pick-input {\n    flex: 1 1 6em; min-width: 5em;\n    background: rgba(0, 0, 0, 0.25);\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.15));\n    border-radius: 4px; color: inherit;\n    padding: 0.2em 0.4em; font-size: var(--bh-text-meta, 0.78em);\n}\n";
const BH_FA_CSS = "/* Real FontAwesome-solid glyphs (subset to Beholder's icons), embedded so ME (lucide-only) renders them. */\n@font-face{font-family:bh-fa;font-style:normal;font-weight:900;font-display:block;src:url(data:font/woff;base64,d09GRgABAAAAABkMAAoAAAAAMhQDBQUAAAAAAAAAAAAAAAAAAAAAAAAAAABPUy8yAAAW4AAAAFEAAABgYXVZ+GNtYXAAABc0AAABDwAAAbyCUs+BZ2x5ZgAAAPQAABSRAAAr0HTOgsBoZWFkAAAWEAAAADYAAAA2KQTUh2hoZWEAABbAAAAAIAAAACQETAJfaG10eAAAFkgAAAB1AAAA2GbGAUtsb2NhAAAVoAAAAG4AAABuI8sZgm1heHAAABWIAAAAGAAAACAATAGQbmFtZQAAGEQAAACzAAABmB2DOHFwb3N0AAAY+AAAABQAAAAg/94AGXicrVprjCRXdT7ndndV16Orq7q6q7pndrcfNdM17+nanu6amfVA27Ner1/RYCfeJQhrAAW8QJw1STbrYOPxQ2D8A02ISGzyZxIFgZEglmICxDLpRIoQRESbHwFFyo9RlEh482cTggAhuqNzb1V3zcvYSnY1Vec+zqmue8/jO+cWIJjDW/gK7kIAgCt+EDS9hiyVSoEX0L3oOu12UArofjbsdjpBO6D7it/0vKCDoCiGoSi7hqIoirF7sIVXj+2OWpABGPZZDftQg3XYhA/AswC2HPLHuoEb0CPDIAzocX7g858mp6RSENA4jWI0RiOIcij7QRi4mTcVEMj4S8b/s9lsZjJNg2UyzBhTrxuGZxTtPD4ZEYNn8etXrlwpXykPvGx2tZTKZlOlNVleE9Qqbh/b+znDOCyaqMFe3rbznmHgk3m7aHiGMXgWV4X8xmEhJHgIx/UCML6ugH04BSHAtCS7gVMqypLX8P1Akpt+0++G3dBxHVc+GwZBV2yoz7debLrrtHEP/acURc3l1E90Llw+d46xc+cu0/2GX68XbbtYr/tj6taFzidorqI85WM8k+67tt1oNJuNhm2PKQCE4vA1toB98AGw6Uu08oEkS65Ld9cJQ9qhsOvTnnb9Ju0QbihFW+3t2pJkPFJhebOw87RlmqnyI7mMbO/28KsWovWckyrYxoc+a+uacv68oun2Zz9k2IWU8xwgANSwj9twBgAdUiUZA7Eyzc5K2G2fdV16Xvusi19XlCHQO+2IZbjyBl3xEl2HoCg74n0/fFNR6H1qUMNt3OaW1O0EAdkI6ZPQK6FzciBsivRO6J/QvRAvRc+4Egn98OE2zp40EreBgTm8gbewDyW475A9jyxY7tKW03bzzSYtcFzSh264EvfyPqckyUJbVsJuiDVht5H1qohZJZdTZ10Xa7Vud3Oz263V0C3PqLmckkVUz1gWOxvce+/ZgFnWadwTvPvR7d3ErCFmG8utVcEr5Ky2lhvEruVyStnzZu8NzjKSM+t5ZdJtfdjH/8E+bMNv0g7KMtdtN3Bk0iBJlriOc8prcK1p+nIgRVQzDPk++0Ez7IYhqb7rBhHVPus65FjcMOhGlNwNaanEkuCttLrA2IKalpWMqqvGarGsp/NFxykZab1cXDXUnJJR5MQsJXfsLDWtyLcWy45TXhRXrBjqjJ7L6TOqUbCyZl5LF0xl3Uil0yljXTELaS1vZi0rr/q5Q7PUNTFrTY1nFV5Gf2bGR3GF1MgfzML98NAhvUhqp9BL4d1JczspSQ4CSS4FpA91WqOwQ6voe6TJ3Gq8jOOSlow15G6hlzsJy7l7f7JQQCwUJnEnpn5jqViZsBc/iFcdxhz6i3XkR/cIrp2Rid3zo0GfeGoxMycWbXtxVbA6jHTDHP4L3sIvwm3wFABpNLfmZCRrBa0g4BGsE9lntAZC74Xmh92QN4pyMWk4gRsEtBDcVEYGxNUsCPwDgbHhSd4VfSLo9QKrIV4qioWGohQW1tbW1hamzXRG0nO6lrkjK0kMTxg8JIWxFPtxY2J52RqZYyTZsxbyhpFfmF4iNmJ/KCVJWWQpduKMhCAUcQP72Ic8dAHsUqfUDsR203vKnVInDhuloM1VokRmJtf5nA5Xj/buHjpuo+E62GMzsxsbszPMjHdt0I8pE1v0j6bRdKJpJnG0aHw0kRMAEuEUBrgLeZiGc/Au+AD8NoAtdLMdCL303AbpK9/r+mg76qW30euXOqWEwECS3UPPmCF9a/HLi2JdsSbug/1f1n4l5nRYeSwGd8fdZtLL7p3YeLHVijmY8/yYneIQDPcRcA9OA4RJsBRFmrF9K4rSF/b15S8Li+v/gF9F4+WXxWAfEHrDfewJmdMiagr7J18aBonYieFbFZrwSxNwHi4BZLpJMMKVLgIjbooPtYXWCfdOGkcP73ZonxpyiZx82HFX+Myzbgx5mh2EC+vrU43G1Pr6hTH1kGQY9vpkwUKs1siD6AtZNNYlppaKUje52D2sN27b2NzcuK1RxwP0eyxVxYI1OWUXaANyhjyRVgzMsKKklNhrIwmKYvCdAcA+7sDssTuT0MJDu7QXRXpsR4r0vSjm7/Gl3YsAgHhWBAv2Ik3YwT16nt30goB8+hh/WCPXZiWxyJuIxD8e/5bB9yLlbse/BSA1HAz32SbuQRNuh4cBUMSPkWdNYI3IhfL/Mt+zKADzfYuCd7MTCgkNvylzTRjxSa5TwtpGqzXlua6WyWiu6021WhtRj57J6FHPsQB0l5yLpqgspdfrM75tK0q5UlVYCvfQdRt1zzul66c8r95wXTzas38cBO6Rr0oxRdVIHsmt2jZjqqJBaviz4TfZp/DbUIUQ3kX7IUsuRvj24GrQavmucLRF2Q/G71uUfVfyBCIjlJNcU9+387rJtuh65XSxqKXT8QK05+fqV78xs0Ye1vJz2ehN5V//o8op6sOHGwZfwCmv1dq42L0bX9NNOz9o0fWBaq1aSSyFaU1e/oNpJE/drJ4504hf0dQv3FKpV1XvWZoaM7Az64mMZBbeC4Bjz9s+gIiTwZYHUlnsvnUAf4zjtgg9VtANE8EXe0IxH/yu0MvvjExw71Ycb7BHVBT48oN+HjEfBcmr2Bf93xGK/t0HI2ZDUWrEO+jHUmIO4sZePpIH0vBnPFZ9EYowCz24BI/CxwFswqpRpsFRJ6HM0nGdoXBh7SB2Yl5Abqx0fLcwHophUXedd/uOS5CYIG83fDGfuyirmjxjGJblhGbhcPtiApofufUOx7Srk3ldz0+KK37eLGxl5RnLMgxnI5/bO9j8YNIJ7p3YaKFbLpOl0ZXiPWnMDvZBhwq04AK8D36H1jDxUvVkA0XsoMWhnIZwnhc0/QzBvVZAqc04enj+yf5GBJownkr6tXsAqF9NtgaAZ84szZVLjM1+32b4uVnGSuW5pTNnkNnf/1ou57iViuvkcmNqG5vN1WurzSayyuCvKgz7SbCevA7+meSomnZumtml6XOaptLTbLY94QiRzsSYGvycZJLwCmMVQsOF4T+xR/EvYIO0bzrKSP2myI24LxV5Di1AFM15fhRDW56FC8ucFtEq4onAr8iqBAKIljLmEblVVFKQ2fm5OX+lvcA0xrJZPaexyqnTjus+VqnVKiXGLJQZ0zQ9l8VqOt1cXFtfvPqLn3KeRdQYk5URT/nqiTwLj726uL62OJ1JVzGb03WVpbJoMVaq1Orlx1zXOX2qwoghy5jGFlba/tzc1fJbYMnpB1gSOHkSNgDstsfTDIc7JEkmtRNOqRvKba9NpTQrICRNhbTDM2488cQTReO8gTmj2C8aOSRib2trq9fvEbkf92HfOG8U/3XUrBG10xtCrXWwD3D4c+jhnQhgA4ROm/IdsRt1UV/5NE+uDFkpDaGkyMbO3YqyY9o2om2bOxyX7TNCkBVowDyALWyizm3CSkB+y7Usqx1YgVf32h69pAUHk7wBp3p7e7izt7e3h9tHUwHs9YaAEP8RTpocfhO/gN+GSaqk+E05w7WKxwrXCaf5u3hBiO9V7JI9BFNWSlfvJxrBlLPOb92Hf+iaufx+vljEvxxTwKA27LMW/h08DI9xj0zRRQ5Efiuii6gSiLoA2YbYsvE4aXycBpHjEONx7CZIynXfddwMr61FME4Euc+kM1JuAicnZ2cnJ3EiJ2XSaV3LTRR1Hb2pMFOtLrSqNXRyuTiJyuUcqn7cFQTSmjeFul6cyGl6Gh9IOk/8MvUpj5NQEv64QlJJela2zNLj5+bncvOTpxBr1dZdStGuxBGsYheVu3iFZXHpgj4/f+7xkmnJWfqV300iYGDgD/dZDV8CD5YAqNQalwza7XHeG5dS6Y1tr+3xcmwgo3fz5s1CYcuevBKFlSeeLRResCcqRUlRPrb1xAvn8VM3b96kji1bPPJZarxQKAxe2nryhU2RLfwQCM1SRGgSguZeTHijTrIRCv8l/FCvZpqmWTt6XcXJU6doveh6OdnYSzYeSfJwTP0aY/j39AvQkVNRxUn4wigh4b6R9GiFCtQu/rfJeqmcYVw/bxZtTH8pq6j6P1y20MR+wcS/1oqD7XxWloJ78rJS+lUp/XVNU7JfW1BsW0VQtGRFd43qerbv8heM01IBIUXA4qo4gtsCaAvVpNouz2X5tnEm0uZ7G42GbhjInEetjKRVuw880O0y1u0+8I6WcH0p7Z0PXlxbbzQQG431tYud5SXvaw6TL1KIv505+LuNRkOTMtajDkPD0KuCncRgndjJ6S5GzEJQseh1mPOIKl8kAHL7ww7jEf8GA3wF5mADtuDj8Bn4BkBYdANSMrJFUrQk0gvikrWo8LSPZn7hMV0cfEYsAoKeJNqnwk6c2QoJYTMunf0yCXQyEpKtkY39RGj9T+J2aCjKTtLAIswprrWTWGKRB5DT3fGMS6J9KW7/QLR/QMhNoATBk6SPB2Nbx851crnWgbT4JKEis0dCbybU4X4AWyB+KhsJ/N4+3JEZ5wTCGydzAeF5R9nxdoRJ+9F9CJEbnPJWxS9Y9aYwwqt9jue3iSe+R5WU2rn5eX1T9G+S84vql8LeKAK+BHV4N4BL9uaTpfGivRsV7922KDR7DX/aawsMz48xyP+JEdKRZvQCoqQsSs7RC8r//uqrr8qZS1N5LZDzRnaOmY1HMvKrumnqWHzuuecyrCwbeXm2LedNqcYyH0mnFKzXV7x6raLrlVrdW6nXMVt6+eWXMzKrTTyaw9yvpc6gLH1J0/4jvawj6g9+zEDjvgyWJ6Ru01czqkqsqppR/WZXqpS55SXj/Z3wK1SNsU+q/dZHFV+epBKZeRtzeZZ8GCUgL4fxIlZc0B18480njiq/uEdDI7GcuBgPjqa/pUmQHmluBeZhFS6M1iGZg1ri3Qj5RRlFII7U6CLcMIUhPhwPjl8bYmoI270ez0QxTymo4zZqWK3VqlSRqlXR3N7eptySX7A/xlPjRRn0iYvGScz2lF0o2FPiuod56s9jstL2FLwEf0bVBz9GLlTiJFUmmHqYEmpKYUSA18MUL/gGFGA8Dm8PUwIRiWdR/4giXEwulWwgzmM5dGq7XtvjXuEV2hF6RV5vnUle6fVpdHV0eSvzzH6fHEbkN+hG//BL/weRx857JPEE8jJ9qp9WopOJdYDptteOzEOWDx48iPJWjBij8ioFH5FWtfFGNpsVQXZuYW1tdW1BFPTFmYGq0pkanRYsLwfv7AWzmiSZ1/eZs2NKkja3YIynCjaarijLy5xlaZZQAAAb/mL4Og7xb8CCKYH03AO4TibsJxI9ngyGgY8fCYLgmaBQmCHQdtcbb7xhyl5aVY3rJfPmM/gVPkpDM4XCXTdv3sw71w1VTXty/uYzENkc5VNZuBsegPfwPH/kNQhDx2UxSkG52vJjy/jIssN9McXgGO2I+MxLi7Gk6dj/bMXGXjsIsw+2ZsNLh4HypebkRKY2OqzKjvzP8zH1vsMs/3hERvUQuMdyuTmM+Z8f+SHCmX3Wwz6coxyI51+Ho2K8KMJejz+l6+B2/DAR3OIzmfGB3Mgx1XB8HhMVZd7kTKYFDPLD1/G/sA9nKEtEngS7TomKMsIDUiYV5UPtkmVZPAx2/CBAkKXXLVXDQmF56aGJiYeWlgsF1FTrdUk+7zfN/CvYT23J+Xyxfeedt98xr+vzd9x+553tYj4vb6U2B5/E3x980ut219aX7kmgjdMwxfHxcR47djJem59r+bIo8oiTLNIpj2fnpDUdXjoi99YOOof89g7hh/7Ozjbma3lskYdtJcnDXpowxQ79u3VkKicjbH8HPANt6FGdZnQ6L/Of0Q0TCRY/lRXAU2gCjYXTrVIjWAlanVbgBKyVSzFVNU3j9x6n55hRObT38KK3OB2BvT9dmHpq8FnEVZpH8y9ToBAacmqKZhuKMvFwFhGjc0Gui1Wqdxz5toE0z+U+n58vpXh2QkWmqMDEDx3iTIWF0aFQQ1ZK7KOnS0xu9P/t2rVrm0G2gUxrp1kq9ZTMil/ZmF/OIC9VKEq/IbPS6Y+ykiI3+oPvX7t2LbOc9QI9XWGpdOoxWS0ynAs2IfqmiCJdCzbhIbgCTwBMF4MgKNLXDJ6wFHIj/E+W5Aavp4vwLWzMcTPjA/KRuR1N5sOjs9yjsxhgqXjq/bxGk5JRZXmjLGWS+ZSgBwfygQPQPDkQ4dgoviDipGVR7SeTMQzEolMuFFhSrKCj4m2EgU+Ud2AEsqMa7AysQA/ug3fDB+E6vMBtPeAFr/bRmlCECkQ4TwkgweFA+wQ6KjeK6Bel8CIgUqgk7zY+Xq479ODo3JlDDV7uv14tFhGLxergRkxdjyvzNX7ZPpZ8Hu1ikepedH3R1VVVd8V1sEsJf1xZY7WYMk2eT/T4w27FD0OTKPolg50Ydh3+20mKn0k++GKfJG/Hj+BEn+pgyvCbDPFv4S6A6cx0RkTc8SEYLQwvOIi2d6BNPcIRC3QR2SK6otBGefe9Wq7Raq0oqbRmZlF6fyYlS+l0WvGzKL1LTjmalkJNM+c33vGOdy6vq1pO0r+gaVnph8PhkHL/e+W0mknX5ayCmJXZaZZW1aycJbqckldXOk1T0zBlGKcmlzY2bpvLKX+uKFTP4BkHP0+uQBvuhw/B0/AnAOGJqLB94kiUo0fTgsSk8P+VZ6bValmarmtWdOsf6TjQar3t8e3E4JFb7WBz5+2MEqYbDL+FA/wWWHDbSZiOPHYqkFz6QCp2haQ7DV8OeNGVfyrp49UwDJ9cNc2lguMUthRF2a3ql6Xc5zOku7EOa+pLRgGzVXWBPY1fXV1dfTKk6UumeT+jb6Oqg58WjJdULZ5P98znc9JlvbqrPC0yln1GGmLDMmyKr1FEwBsDn9ApiRgvEE838js8N4swk/iEQ7iLNpVkzFb8uKsmBWgeqE2r8gWqmw5u4TbVXzH/4wqjjlfwaqtFYGgr/qGt0uTgRhzdMxXLxD5VXQc9qq3mkVUy1KSYCdvYxxqUCBuJotPhb006x/ZGvpojDSpgRPdx+0A8OBA14H8BrNYSPgAAAHicY2BkYGAwY+xnEGUAARAPBQAAFfYA3gAAAAAAPgDqAT0BeAGlAecCWALyA2YEBgRUBOkFEwU+BbYF7gYnBrQHMweqCEwI7QmaCeoKCgpKCncLFAtVC5gL0wxFDSsNiw4CDogO8w+zEAkQQhDMER4RYhHBEhISaBMOE84UOxTzFUwVrBXoAAAAAQAAAwUFAElLKltfDzz1AAsCAAAAAADiMceFAAAAAOIxx4X/8/+1AosBywAAAAgAAgAAAAAAAHicZY4xCsNADARH2wUMOUya4Madv6Gn3dP8LRNiBemMmxRC0mjZlXWwnSYHAXJetoN1VkETTMWhJa/uYI4nv7TI41SPY2jjULLOXHePz6Vd5KxyNvI+fKvK439+i/hW7vjvObLuPTOyP/InEWfy1P8AFEccXgAAAHicY2BkYGA8/X8rAwNTw//P/z8zdTMwMqACMwC6aQeseJxjYGFiZm5hYGVgYPRhTGNgYHCH0l8ZJBlaGBiYGDiZGWCAUQDOZGBwDA/2ZWhg0P6+hPH0/60MDIynGbxBasAKHRnXMzAwKDAwAAAAVwweAAAAeJxjYGBgYmBgYGZgYBBhYGZgBNMsjCsYGBjSGBwYWBnUGLQfnfrA9IH1A+8HwQ/CHyQ/KH5Q/mD1IeRD5IeED0kf8j4UfOj7sO7DwQ9HP1z/cPvD8w8fP+p+dPp44+Otj/c+Pvsk98n408FPtz/9/Mzyuf3zwc9vv5R/2ftV6qv9V5ev2V/7vq79zvd9yf//DAxwe3hQ7AlGs+cAZfb8vyZrIcDI/5//J/83/q/8H/hf8r/gv8S/i38b/wb+9fxL+Bfzt/Gn84fxB/M78dvzm/Br833gu8PnzufG58xnw8fK+5E3hdebV49XhWcRTyaPHfdW7gJuEa4PXG+4jnEt4WrjVOOYCA5FOgAAgGevqAB4nJXPz0oCYRSH4WdSi1p2BbNUyEFHZ8QWQQTdgNCibY41UI2MUXRTXmPw8WW6cNHuPYfz+3Nw5lFH0j3HlMiJ3DTyiQuryB031pG7ezc9S9vIp66SS3caa99atWcvPqT6ngyk7jXew+bWl8pG4011dJ8qg6pVhWmh8aq23KP/a4dKmUIm96DS2qiDS2pmZiIzMjZXmBjLFeGH40mfBy7XIfs3YbDTHarKXbfhX7cfSe85EgB4nGNgZgCD/7cZJCEsVAAALh8B9w==) format('woff')}\n.beholder-panel [class*='fa-'],.beholder-notebox [class*='fa-']{font-family:bh-fa!important;font-weight:900!important;font-style:normal!important;-webkit-font-smoothing:antialiased;display:inline-block;line-height:1;text-rendering:auto}\n.beholder-panel .fa-arrow-left::before,.beholder-notebox .fa-arrow-left::before{content:\"\\f060\"}.beholder-panel .fa-arrows-rotate::before,.beholder-notebox .fa-arrows-rotate::before{content:\"\\f021\"}.beholder-panel .fa-arrow-up::before,.beholder-notebox .fa-arrow-up::before{content:\"\\f062\"}.beholder-panel .fa-arrow-up-right-from-square::before,.beholder-notebox .fa-arrow-up-right-from-square::before{content:\"\\f08e\"}.beholder-panel .fa-bolt::before,.beholder-notebox .fa-bolt::before{content:\"\\f0e7\"}.beholder-panel .fa-broom::before,.beholder-notebox .fa-broom::before{content:\"\\f51a\"}.beholder-panel .fa-caret-down::before,.beholder-notebox .fa-caret-down::before{content:\"\\f0d7\"}.beholder-panel .fa-check::before,.beholder-notebox .fa-check::before{content:\"\\f00c\"}.beholder-panel .fa-chevron-left::before,.beholder-notebox .fa-chevron-left::before{content:\"\\f053\"}.beholder-panel .fa-chevron-right::before,.beholder-notebox .fa-chevron-right::before{content:\"\\f054\"}.beholder-panel .fa-circle-question::before,.beholder-notebox .fa-circle-question::before{content:\"\\f059\"}.beholder-panel .fa-clock-rotate-left::before,.beholder-notebox .fa-clock-rotate-left::before{content:\"\\f1da\"}.beholder-panel .fa-code-merge::before,.beholder-notebox .fa-code-merge::before{content:\"\\f387\"}.beholder-panel .fa-copy::before,.beholder-notebox .fa-copy::before{content:\"\\f0c5\"}.beholder-panel .fa-download::before,.beholder-notebox .fa-download::before{content:\"\\f019\"}.beholder-panel .fa-ellipsis-vertical::before,.beholder-notebox .fa-ellipsis-vertical::before{content:\"\\f142\"}.beholder-panel .fa-eraser::before,.beholder-notebox .fa-eraser::before{content:\"\\f12d\"}.beholder-panel .fa-eye::before,.beholder-notebox .fa-eye::before{content:\"\\f06e\"}.beholder-panel .fa-eye-slash::before,.beholder-notebox .fa-eye-slash::before{content:\"\\f070\"}.beholder-panel .fa-feather-pointed::before,.beholder-notebox .fa-feather-pointed::before{content:\"\\f56b\"}.beholder-panel .fa-file-medical::before,.beholder-notebox .fa-file-medical::before{content:\"\\f477\"}.beholder-panel .fa-gear::before,.beholder-notebox .fa-gear::before{content:\"\\f013\"}.beholder-panel .fa-grip-lines::before,.beholder-notebox .fa-grip-lines::before{content:\"\\f7a4\"}.beholder-panel .fa-grip-vertical::before,.beholder-notebox .fa-grip-vertical::before{content:\"\\f58e\"}.beholder-panel .fa-hand-holding::before,.beholder-notebox .fa-hand-holding::before{content:\"\\f4bd\"}.beholder-panel .fa-heart-pulse::before,.beholder-notebox .fa-heart-pulse::before{content:\"\\f21e\"}.beholder-panel .fa-id-badge::before,.beholder-notebox .fa-id-badge::before{content:\"\\f2c1\"}.beholder-panel .fa-link::before,.beholder-notebox .fa-link::before{content:\"\\f0c1\"}.beholder-panel .fa-list::before,.beholder-notebox .fa-list::before{content:\"\\f03a\"}.beholder-panel .fa-list-check::before,.beholder-notebox .fa-list-check::before{content:\"\\f0ae\"}.beholder-panel .fa-lock::before,.beholder-notebox .fa-lock::before{content:\"\\f023\"}.beholder-panel .fa-lock-open::before,.beholder-notebox .fa-lock-open::before{content:\"\\f3c1\"}.beholder-panel .fa-magnifying-glass::before,.beholder-notebox .fa-magnifying-glass::before{content:\"\\f002\"}.beholder-panel .fa-microchip::before,.beholder-notebox .fa-microchip::before{content:\"\\f2db\"}.beholder-panel .fa-palette::before,.beholder-notebox .fa-palette::before{content:\"\\f53f\"}.beholder-panel .fa-paper-plane::before,.beholder-notebox .fa-paper-plane::before{content:\"\\f1d8\"}.beholder-panel .fa-pen::before,.beholder-notebox .fa-pen::before{content:\"\\f304\"}.beholder-panel .fa-pen-nib::before,.beholder-notebox .fa-pen-nib::before{content:\"\\f5ad\"}.beholder-panel .fa-plug::before,.beholder-notebox .fa-plug::before{content:\"\\f1e6\"}.beholder-panel .fa-plus::before,.beholder-notebox .fa-plus::before{content:\"\\2b\"}.beholder-panel .fa-power-off::before,.beholder-notebox .fa-power-off::before{content:\"\\f011\"}.beholder-panel .fa-robot::before,.beholder-notebox .fa-robot::before{content:\"\\f544\"}.beholder-panel .fa-rotate-right::before,.beholder-notebox .fa-rotate-right::before{content:\"\\f2f9\"}.beholder-panel .fa-scroll::before,.beholder-notebox .fa-scroll::before{content:\"\\f70e\"}.beholder-panel .fa-server::before,.beholder-notebox .fa-server::before{content:\"\\f233\"}.beholder-panel .fa-shield-halved::before,.beholder-notebox .fa-shield-halved::before{content:\"\\f3ed\"}.beholder-panel .fa-sliders::before,.beholder-notebox .fa-sliders::before{content:\"\\f1de\"}.beholder-panel .fa-star::before,.beholder-notebox .fa-star::before{content:\"\\f005\"}.beholder-panel .fa-stethoscope::before,.beholder-notebox .fa-stethoscope::before{content:\"\\f0f1\"}.beholder-panel .fa-table-columns::before,.beholder-notebox .fa-table-columns::before{content:\"\\f0db\"}.beholder-panel .fa-users::before,.beholder-notebox .fa-users::before{content:\"\\f0c0\"}.beholder-panel .fa-wand-magic-sparkles::before,.beholder-notebox .fa-wand-magic-sparkles::before{content:\"\\e2ca\"}.beholder-panel .fa-xmark::before,.beholder-notebox .fa-xmark::before{content:\"\\f00d\"}\n";
const BH_LOCALES = {"en":{"toolbarLabel":"Beholder","trackerPanelLabel":"Open Beholder","dockTitle":"Beholder","dockClose":"Close Beholder","dockPopOut":"Open Beholder in a new tab","resizeWindow":"Resize Beholder","layerColor":"Color","layerColorHint":"Color word annotation on chips","layerDamage":"Damage","layerDamageHint":"Damage-tier visuals + damage word","layerWounds":"Wounds","layerWoundsHint":"Wounds, bleeding, severity","layerBarLabel":"Detail layers"}};

// ===== 00-prelude.js =====
// ── Beholder capability client: prelude ──────────────────────────────────────
// Namespace, one-time stylesheet injection, and the state fetch.
//
// The renderer modules that follow (garment data, colors, state, paperdoll) are
// ported verbatim from the Beholder extension so the doll drawn here is the doll
// the extension draws — same markup, same classes, same stylesheet. Only this
// file, the dock, and the custom element are new: they replace the extension's
// host shim with the capability contract.
//
// BH_STYLE_CSS and BH_FA_CSS are emitted ahead of this file by
// scripts/build-beholder-package.mjs from src/*.css.

const BH = {
  PANEL_ID: "beholder_panel",
};

/** Escape a value for interpolation into panel markup. */
BH.escapeHtml = function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
};

/**
 * Resolve an interface string for the host's locale.
 *
 * The host tells a capability which locale it is rendering in but not what the
 * words are, so the package carries its own catalogs (src/locales/*.json, emitted
 * as BH_LOCALES by the builder) and falls back through region → language → en.
 */
BH.localize = function localize(props, key, fallback) {
  const requested = String(props?.localization?.locale || "en")
    .trim()
    .replaceAll("_", "-")
    .toLowerCase();
  const candidates = [requested, requested.split("-")[0], "en"];
  for (const candidate of candidates) {
    const value = BH_LOCALES[candidate]?.[key];
    if (typeof value === "string" && value) return value;
  }
  return fallback;
};

/** Inject the panel stylesheet once per document, including detached tabs. */
BH.ensureStyles = function ensureStyles(targetDocument = document) {
  if (targetDocument.getElementById("bh-capability-styles")) return;
  const style = targetDocument.createElement("style");
  style.id = "bh-capability-styles";
  style.textContent = `${BH_FA_CSS}\n${BH_STYLE_CSS}\n${BH_HOST_CSS}`;
  targetDocument.head.appendChild(style);
};

/**
 * Read the tracked physical state for a chat.
 *
 * The agent writes it server-side after each extraction; this is a plain read of
 * the route the Beholder agent package's server half already exposes. A failure
 * here is not fatal — the dock renders its empty state and the next turn retries.
 */
BH.fetchState = async function fetchState(chatId) {
  const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`beholder-state ${res.status}`);
  const body = await res.json();
  const characters = Array.isArray(body?.state?.characters) ? body.state.characters : [];
  // The renderer keys state by character name — the shape the extension panel uses.
  // Null-prototype: the keys are character names straight out of the chat, and a
  // character called __proto__ must land as an entry, not as the map's prototype.
  const byName = Object.create(null);
  for (const character of characters) {
    if (!character || typeof character.name !== "string") continue;
    byName[character.name] = {
      ...(character.species ? { species: character.species } : {}),
      body: character.body && typeof character.body === "object" ? character.body : {},
    };
  }
  return byName;
};

/** Report an unrecoverable wiring failure through the host's runtime-error contract. */
BH.fail = function fail(element, error) {
  const message = error && error.message ? error.message : "Beholder interface stopped";
  element.capabilityRuntimeError = message;
  element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error", { detail: { message }, bubbles: true }));
  console.error("[beholder] capability client stopped", error);
};

// ===== 10-garment-data.js =====
// AUTO-GENERATED from datagen shared/worn_coverage_map.json — DO NOT EDIT BY HAND.
// Regenerate: python3 scripts/dump_garment_canon.py > ../Beholder/garment_data.js (source = datagen).
// Plural→singular garment-identity aliases so 'boot' and 'boots' are ONE identity.
// The runtime only does GARMENT_CANON[x] ?? x; see state.js canonicalGarment().

const GARMENT_CANON = {
  boots: "boot",
  "boxing shoes": "boxing shoe",
  bracers: "bracer",
  greaves: "greave",
  heels: "heel",
  pauldrons: "pauldron",
  sandals: "sandal",
  shoes: "shoe",
  slippers: "slipper",
  sneakers: "sneaker",
  stockings: "stocking",
  trousers: "trouser",
};

// ===== 12-colors.js =====
// Beholder color normalization.
//
// `color` is free-text in the schema: the prose's own color word is kept.
// Normalization only (a) lowercases, (b) folds hyphens/underscores/whitespace to
// single spaces, (c) maps a small set of well-known synonyms to the 16-color base
// palette. Everything else passes through verbatim — distinct-but-related shades
// are deliberately NOT collapsed (cream != beige; gunmetal stays gunmetal).
//
// Used for canonical color comparison (e.g. worn-item grouping) with
// compare-after-normalize semantics. The synonym map must stay in sync with the
// server-side color normalizer the extractor was trained against.

const COLOR_PALETTE = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "black",
  "white",
  "gray",
  "beige",
  "gold",
  "silver",
  "navy",
  "tan",
];

// Conservative: only true synonyms (same color, different word) + the grey/gray
// spelling variant. Distinct shades (cream, gunmetal, maroon, teal, …) are absent.
const COLOR_SYNONYMS = new Map([
  ["grey", "gray"],
  ["crimson", "red"],
  ["scarlet", "red"],
  ["cobalt", "blue"],
  ["azure", "blue"],
  ["emerald", "green"],
  ["violet", "purple"],
  ["golden", "gold"],
  ["ebony", "black"],
  ["ivory", "white"],
  ["charcoal", "gray"],
]);

/**
 * Normalize a color string for comparison/display.
 * Lowercase; collapse internal hyphens/underscores/whitespace to single spaces;
 * trim; then map known palette synonyms to their canonical form. Non-strings and
 * empties return "". Unknown colors pass through (folded).
 */
function normalizeColor(value) {
  if (typeof value !== "string") return "";
  const norm = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
  if (!norm) return "";
  return COLOR_SYNONYMS.get(norm) ?? norm;
}

// ===== 15-state.js =====
// ── State helpers used by the renderer ───────────────────────────────────────
// Ported from the Beholder extension's state module, reduced to the two helpers
// the paper doll actually calls. The extension's module also carries the delta
// merge engine (applyDelta, lock handling, alias resolution); none of it belongs
// here, because in Marinara the server merges each extraction into chat state and
// this client only draws the result. Dropping it keeps the bundle to what runs
// and leaves no unused path handling untrusted model output.

/**
 * Canonical garment identity: fold a plural surface onto its singular ("boots" →
 * "boot") so the seed's "boot" and the model's "boots" are ONE identity instead of
 * two that stack forever (GROUND 3a). Table is generated offline from the coverage
 * map (datagen scripts/dump_garment_canon.py) and vendored in garment_data.js.
 */
function canonicalGarment(item) {
  if (typeof item !== "string") return "";
  const n = item.trim().toLowerCase();
  return GARMENT_CANON[n] ?? n;
}

/**
 * v2 output wrapper: `{"changed": bool, "delta": <obj>}`. Returns the inner delta
 * (or `{}` for changed=false). Pass-through if not a v2 wrapper.
 */

// ── D30: anatomical dependency cascade ──
// A missing limb implies its dependents are also missing: shoulder → arm → hand,
// leg → foot, hind_leg → hind_foot. Limbs ONLY — a missing face does NOT imply
// missing eyes (deliberately excluded). This is a DERIVED overlay applied where
// state is consumed (display + prompt injection), never persisted — so restoring
// the limb restores the dependents automatically. Mirrors the datagen D30 axis.
const MISSING_DEPENDENTS = {
  left_shoulder: ["left_arm"],
  right_shoulder: ["right_arm"],
  left_arm: ["left_hand"],
  right_arm: ["right_hand"],
  left_leg: ["left_foot"],
  right_leg: ["right_foot"],
  hind_left_leg: ["hind_left_foot"],
  hind_right_leg: ["hind_right_foot"],
};

/**
 * Return a shallow-cloned `body` with dependent slots marked `missing: true` when
 * their parent limb is missing, applied transitively (shoulder → arm → hand). The
 * input is not mutated. Pass a character's `body` object.
 */

/**
 * Return a shallow-cloned `body` with dependent slots marked `missing: true` when
 * their parent limb is missing, applied transitively (shoulder → arm → hand). The
 * input is not mutated. Pass a character's `body` object.
 */
function withDependentMissing(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const out = { ...body };
  let changed = true;
  while (changed) {
    changed = false;
    for (const [parent, children] of Object.entries(MISSING_DEPENDENTS)) {
      if (out[parent]?.missing !== true) continue;
      for (const child of children) {
        if (out[child]?.missing === true) continue;
        out[child] = { ...(out[child] || {}), missing: true };
        changed = true;
      }
    }
  }
  return out;
}

/**
 * Apply a single character's delta into a single character's state. Recurses
 * through `body.<slot>.<field>` and handles the "clear sentinel" cases for
 * `worn`, `wounds`, `holding`.
 *
 * Mutates `state` in place and also returns it for convenience.
 */

// ===== 30-paperdoll.js =====
/**
 * Beholder — paper-doll renderer.
 *
 * Renders ONE character's state as an anatomical card: a creature silhouette
 * (SVG) flanked by per-slot item labels arranged at the matching body height,
 * with armor-damage and wound state tinted directly onto each body region.
 *
 * Tracked slots: head, face, neck, chest, back, waist, the L/R shoulder, arm,
 * hand, leg and foot pairs, plus facial features (eyes, ears, mouth) and the
 * species-conditional slots (tail, centaur hind pairs).
 *   Per slot: { worn: [{item, damage, color}], holding, wounds: [...], ... }
 *   Per char: species (top-level scalar)
 *
 * The renderer is sparse: only slots with state get a populated card. The
 * silhouette itself is always rendered (so the user has spatial reference even
 * for a freshly-stripped character), and facial features always draw as quiet
 * idle anatomy so "nothing tracked" reads differently from "lost".
 *
 * Four silhouette families share one upper body and swap the lower body:
 * humanoid, digitigrade, serpentine, centauroid. Geometry only — the
 * state→class logic is family-agnostic.
 */

// 3-state damage scale (SCHEMA.md / shared/schema_axes.py D22, 2026-06-17:
// cracked dropped). pristine → damaged → broken on a green→amber→red ramp.
const DAMAGE_TIER = {
  pristine: { class: "bh-tier-0", label: "pristine", tier: 0 },
  damaged: { class: "bh-tier-2", label: "damaged", tier: 2 },
  broken: { class: "bh-tier-4", label: "broken", tier: 4 },
  // Legacy coercion: pre-D22 saved chats may carry 'cracked'; map it onto the
  // nearest current tier (renders as 'damaged') so old state still displays.
  cracked: { class: "bh-tier-2", label: "damaged", tier: 2 },
};

function tierOf(damageStr) {
  return DAMAGE_TIER[String(damageStr ?? "").toLowerCase()]?.tier ?? 0;
}

/**
 * Wound severity tier 1..3 (minor / serious / critical).
 *
 * A wound may be a bare string or an object with an explicit `severity` field.
 * When `severity` is present it's used directly; otherwise severity is inferred
 * from the wound text via a keyword heuristic, so the explicit field is picked
 * up automatically with no caller change.
 *
 * Coverage isn't exhaustive; it's good enough to keep "bruise" from
 * looking as alarming as "stab wound" when no explicit severity is given.
 */
function woundSeverity(w) {
  if (w && typeof w === "object" && w.severity) {
    const s = String(w.severity).toLowerCase();
    if (s === "minor") return 1;
    if (s === "serious") return 2;
    if (s === "critical") return 3;
  }
  const text = String(typeof w === "string" ? w : (w?.text ?? "")).toLowerCase();
  // Explicit severity modifiers in the text override everything else.
  if (/\b(minor|light|small|superficial|tiny|faint|mild)\b/.test(text)) return 1;
  if (/\b(deep|severe|heavy|grave|mortal|fatal|massive|critical)\b/.test(text)) return 3;
  // Critical-by-default wound nouns (penetrating, broken, hemorrhagic).
  if (
    /\b(stab|impal|gunshot|arrow wound|hemorrhag|gushing|spurt|shattered|crushed|broken|fracture|sever(ed|al)?|amputat|disembowel)\b/.test(
      text,
    )
  )
    return 3;
  // Minor-by-default wound nouns (cosmetic, superficial).
  if (/\b(bruis|scratch|scrape|abrasion|graze|scuff|blister|chafe|red mark|faint mark|nick)\b/.test(text)) return 1;
  // Default: serious (middle tier). Covers "cut", "gash", "burn", "wound",
  // "laceration", "contusion" — distinct injuries but not necessarily critical.
  return 2;
}

function woundText(w) {
  return typeof w === "string" ? w : (w?.text ?? "");
}

// Side of the body each slot lives on. Determines which column the label goes in.
// Center-line slots (head, face, neck, chest, back, waist) draw their label on
// the side with fewer items, balancing visual weight.
const SLOT_SIDE = {
  head: "center",
  face: "center",
  neck: "center",
  chest: "center",
  back: "center",
  waist: "center",
  mouth: "center",
  left_eye: "left",
  left_ear: "left",
  left_shoulder: "left",
  left_arm: "left",
  left_hand: "left",
  left_leg: "left",
  left_foot: "left",
  right_eye: "right",
  right_ear: "right",
  right_shoulder: "right",
  right_arm: "right",
  right_hand: "right",
  right_leg: "right",
  right_foot: "right",
  // Species-conditional slots (tail + centaur hind pair)
  tail: "center",
  hind_left_leg: "left",
  hind_left_foot: "left",
  hind_right_leg: "right",
  hind_right_foot: "right",
};

// Vertical position of each slot's CONNECTION POINT on the silhouette (in % of
// silhouette height). Drives label vertical ordering. Top of doll = 0%, feet = 100%.
// Facial features (eyes/ears/mouth) and species-conditional slots (tail, centaur
// hind pairs) are listed so the layout can place them when state references them.
const SLOT_Y = {
  head: 6,
  left_eye: 8,
  right_eye: 8,
  left_ear: 9,
  right_ear: 9,
  face: 12,
  mouth: 14,
  neck: 20,
  left_shoulder: 25,
  right_shoulder: 25,
  chest: 38,
  back: 38,
  left_arm: 42,
  right_arm: 42,
  waist: 56,
  left_hand: 60,
  right_hand: 60,
  left_leg: 74,
  right_leg: 74,
  left_foot: 94,
  right_foot: 94,
  // Quadruped hind pair (centaurs etc.) — visually behind the front legs
  hind_left_leg: 78,
  hind_right_leg: 78,
  hind_left_foot: 96,
  hind_right_foot: 96,
  tail: 88, // generally below the waist, varies by family
};

// Human-readable slot label for display.
const SLOT_LABEL = {
  head: "head",
  face: "face",
  neck: "neck",
  chest: "chest",
  back: "back",
  waist: "waist",
  mouth: "mouth",
  left_eye: "L. eye",
  right_eye: "R. eye",
  left_ear: "L. ear",
  right_ear: "R. ear",
  left_shoulder: "L. shoulder",
  right_shoulder: "R. shoulder",
  left_arm: "L. arm",
  right_arm: "R. arm",
  left_hand: "L. hand",
  right_hand: "R. hand",
  left_leg: "L. leg",
  right_leg: "R. leg",
  left_foot: "L. foot",
  right_foot: "R. foot",
  // Species-conditional slots
  tail: "tail",
  hind_left_leg: "L. hind leg",
  hind_right_leg: "R. hind leg",
  hind_left_foot: "L. hind foot",
  hind_right_foot: "R. hind foot",
};

// Family-aware label overrides. Schema slot key stays the same
// (left_foot is always left_foot in JSON); only the displayed label
// shifts per silhouette family. Pure UI concern.
//   digitigrade (catfolk/foxfolk/wolffolk/etc.) — feet are paws
//   centauroid  (centaur)                       — feet are hooves, legs distinguished fore/hind
//   serpentine  (lamia/naga/merfolk)            — no legs/feet to label; tail label stays generic
const FAMILY_LABEL_OVERRIDES = {
  digitigrade: {
    left_foot: "L. paw",
    right_foot: "R. paw",
  },
  centauroid: {
    left_leg: "L. fore-leg",
    right_leg: "R. fore-leg",
    left_foot: "L. fore-hoof",
    right_foot: "R. fore-hoof",
    hind_left_leg: "L. hind-leg",
    hind_right_leg: "R. hind-leg",
    hind_left_foot: "L. hind-hoof",
    hind_right_foot: "R. hind-hoof",
  },
};
function labelOf(slot, family) {
  const override = FAMILY_LABEL_OVERRIDES[family];
  if (override && override[slot]) return override[slot];
  return SLOT_LABEL[slot] || slot;
}

// Slots that should NOT auto-render as ghost-empty CARDS. They only get a card
// when state actually populates them — otherwise a plain human would sprout a
// ghost "tail" row, etc. SPECIES-CONDITIONAL ONLY: facial features (eyes/ears/
// mouth) are universal to every humanoid head, so they render an empty card like
// face/head/neck — an empty 'face' card showing while 'mouth' did not was an
// inconsistency. Tail + the centaur hind pair stay proposed (a human has no tail).
// This governs the slot CARDS only; the silhouette still always draws the facial
// features as idle anatomy (see silhouetteSvg), and paired layout couples a
// populated half of a pair with a ghost for its empty half.
const PROPOSED_SLOTS = new Set(["tail", "hind_left_leg", "hind_right_leg", "hind_left_foot", "hind_right_foot"]);

// Slots a given family ALWAYS shows (overrides PROPOSED_SLOTS for that family):
// centaurs always have 4 hind-legs + a tail; lamia always has a tail.
// Winged families (avian/draconic) and the wings slot are not yet drawn.
const FAMILY_ALWAYS_SLOTS = {
  centauroid: new Set(["hind_left_leg", "hind_right_leg", "hind_left_foot", "hind_right_foot", "tail"]),
  serpentine: new Set(["tail"]),
  digitigrade: new Set(["tail"]), // cats, foxes, wolves all have tails
  // humanoid doesn't auto-add — tail (rare for humans) appears only when populated
};

// ─── Panel layout ───────────────────────────────────────────────────────────
// One of three densities, driven by a single in-panel switch:
//   'paired'  → silhouette + L/R aligned rows, ghost-fill coupling (default)
//   'columns' → silhouette + packed two-column layout (paired off)
//   'list'    → the digest only: single-column Wounds→Held→Worn→State, no
//               silhouette, most compact (also auto-used below 360px via CSS)
// The mode is read at render time so the doll grid is built natively for the
// current layout. Persisted layout is owned by the host (settings); this is the
// in-memory mirror the renderer reads.
let currentLayout = "paired";

/** Set the doll layout mode read by the next render. */
function setDollLayout(mode) {
  currentLayout = ["paired", "columns", "list"].includes(mode) ? mode : "paired";
  return currentLayout;
}

// True left/right pairs that share one row in paired layout.
const LAYOUT_PAIRS = [
  ["left_eye", "right_eye"],
  ["left_ear", "right_ear"],
  ["left_shoulder", "right_shoulder"],
  ["left_arm", "right_arm"],
  ["left_hand", "right_hand"],
  ["left_leg", "right_leg"],
  ["hind_left_leg", "hind_right_leg"],
  ["left_foot", "right_foot"],
  ["hind_left_foot", "hind_right_foot"],
];
const PAIR_OF = (() => {
  const m = {};
  for (const [l, r] of LAYOUT_PAIRS) {
    m[l] = r;
    m[r] = l;
  }
  return m;
})();
// Anatomical top→bottom order for the paired-layout walk (mirrors SLOT_Y).
const LAYOUT_SLOT_ORDER = [
  "head",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "face",
  "mouth",
  "neck",
  "left_shoulder",
  "right_shoulder",
  "chest",
  "back",
  "left_arm",
  "right_arm",
  "waist",
  "left_hand",
  "right_hand",
  "left_leg",
  "right_leg",
  "hind_left_leg",
  "hind_right_leg",
  "tail",
  "left_foot",
  "right_foot",
  "hind_left_foot",
  "hind_right_foot",
];

// In-panel quick switch: a small segmented [paired | columns | list] toggle so
// the layout density can flip without opening Settings. It lives in BOTH the
// figure (under the silhouette's controls) and the digest (right-aligned),
// since each is hidden in the other. Click handlers are bound by the panel.
function layoutSwitchHtml() {
  const opt = (mode, icon, title, label) =>
    `<button class="bh-ls-opt${mode === currentLayout ? " bh-ls-active" : ""}" data-layout="${mode}" title="${title}" aria-label="${label}"><i class="fa-solid ${icon}"></i></button>`;
  return `<div class="bh-layout-switch" role="group" aria-label="Panel layout">
        ${opt("paired", "fa-grip-lines", "Paired rows — L/R aligned, every box coupled to the body", "Paired rows")}
        ${opt("columns", "fa-table-columns", "Columns — packed two-column layout", "Columns")}
        ${opt("list", "fa-list", "Compact list — no silhouette, saves space", "Compact list")}
    </div>`;
}

// ─── Species → silhouette family ──────────────────────────────────────────
// Four families. Unmapped species fall back to humanoid (never errors) and
// get a small "humanoid silhouette" tag so the user knows the model emitted
// something unmapped. The MODEL still emits the full schema; we just pick
// which SVG legs/feet shape to draw. Body slots are identical across
// families (a lamia still has "left_foot" in the schema, even if it doesn't
// have a foot to wear a boot on — we render the slot row with an
// "off-silhouette" hint in that case).
const SPECIES_FAMILIES = {
  humanoid: [
    "human",
    "elf",
    "half-elf",
    "dwarf",
    "gnome",
    "halfling",
    "orc",
    "tiefling",
    "aasimar",
    "genasi",
    "goliath",
    "firbolg",
    "minotaur",
  ],
  digitigrade: [
    "catfolk",
    "felid",
    "cat",
    "tabaxi",
    "leonin",
    "wolffolk",
    "wolf",
    "lupine",
    "canid",
    "gnoll",
    "jackal",
    "foxfolk",
    "fox",
    "vulpine",
    "kitsune",
    "mousegirl",
    "mousefolk",
    "rodent",
    "ratfolk",
    "rabbitfolk",
    "harengon",
    "lagomorph",
    "goat",
    "satyr",
    "caprine",
  ],
  serpentine: ["lamia", "naga", "merfolk", "echidna", "serpent", "snake", "yuan-ti", "medusa"],
  centauroid: ["centaur", "driderkin"],
  // Winged families (avian / draconic) and the wings slot are not yet drawn.
  // Unmapped winged species fall back to humanoid until then.
};

function familyOf(species) {
  const s = String(species || "")
    .toLowerCase()
    .trim();
  if (!s) return "humanoid";
  for (const [family, members] of Object.entries(SPECIES_FAMILIES)) {
    if (members.includes(s)) return family;
  }
  return "humanoid"; // unmapped — fall back, never error
}

// Slots that don't visually exist on certain non-humanoid families. The
// renderer still shows the slot rows in left/right columns, but the body
// part is omitted from the silhouette and gets a small "⌀" off-body hint
// in the row.
const OFF_BODY_SLOTS = {
  humanoid: new Set(),
  digitigrade: new Set(),
  serpentine: new Set(["left_leg", "right_leg", "left_foot", "right_foot"]),
  centauroid: new Set(),
};

/**
 * Accept `holding` as either a bare string or an `{item, damage, color}` object
 * (held items can be damaged/colored too). Returns a normalized
 * `{item, damage, color}` object or null.
 */
function normalizeHolding(h) {
  if (!h) return null;
  if (typeof h === "string") return { item: h, damage: null, color: null };
  if (typeof h === "object" && h.item) {
    return { item: h.item, damage: h.damage || null, color: h.color || null };
  }
  return null;
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function damageMeta(d) {
  const key = String(d ?? "").toLowerCase();
  return DAMAGE_TIER[key] || { class: "bh-tier-0", label: key || "" };
}

/**
 * Aggregate per-slot state into the data the silhouette needs:
 *   { slot: { tier: 0..4, wounds: int, hasHolding: bool } }
 *
 * Body-part visual encoding:
 *   - STROKE on the part = worst worn-item damage tier (only at tier ≥ 2)
 *   - FILL  on the part = wound presence (capped at 3 intensity levels)
 *
 * This was the user's redesign signal: outline communicates "armor is
 * damaged here", fill communicates "the body itself is hurt here".
 * Dot-on-anatomy was less legible at small panel sizes.
 */
function computeSlotStates(state) {
  // D30: a missing limb's dependents (hand, foot) render missing too — derived,
  // not stored, so it reverses cleanly if the limb is ever restored.
  const body = withDependentMissing(state.body || {});
  const out = {};
  for (const [slot, sd] of Object.entries(body)) {
    // Per-slot flags:
    //   missing: true → acquired loss (lost arm, missing eye, gone ear).
    //                   Distinct from off-body and empty. Renders gray-striped.
    //   bare: true    → slot is exposed/unclothed (stripped, ripped off,
    //                   never worn anything). Distinct from "slot absent
    //                   from state" — bare is an explicit assertion.
    const s = {
      tier: 0,
      wornCount: 0,
      wounds: 0,
      maxWoundSev: 0,
      hasHolding: false,
      missing: sd?.missing === true,
      bare: sd?.bare === true,
    };
    if (sd?.worn?.length) {
      s.wornCount = sd.worn.length;
      for (const w of sd.worn) {
        const t = tierOf(w.damage);
        if (t > s.tier) s.tier = t;
      }
    }
    if (sd?.wounds?.length) {
      s.wounds = sd.wounds.length;
      for (const w of sd.wounds) {
        const sev = woundSeverity(w);
        if (sev > s.maxWoundSev) s.maxWoundSev = sev;
      }
    }
    if (sd?.holding) s.hasHolding = true;
    out[slot] = s;
  }
  return out;
}

/** Torso path state. Front view = chest; Back view = back. Shoulders used to
 *  be pooled in here, but they now have their own deltoid-cap regions on the
 *  silhouette (see silhouetteSvg), so pooling them would double-tint the
 *  same damage. The torso path now reflects ONLY its own slot. */
function torsoState(perSlot, view) {
  const slot = view === "back" ? "back" : "chest";
  const p = perSlot[slot];
  if (!p) return { tier: 0, wounds: 0, maxWoundSev: 0, hasHolding: false };
  return {
    tier: p.tier || 0,
    wounds: p.wounds || 0,
    maxWoundSev: p.maxWoundSev || 0,
    hasHolding: !!p.hasHolding,
  };
}

// Coverable-loss slots: a worn cover (eyepatch / ear-cover / gag) sits OVER the
// loss, so it shows the cover instead of a "missing" marker. After validation,
// missing+worn coexist ONLY on these slots (a missing limb has its worn stripped),
// so a wornCount alongside missing reliably means "covered loss".
const COVERABLE_MISSING_SLOTS = new Set(["left_eye", "right_eye", "left_ear", "right_ear", "mouth"]);

/** Build the SVG class string for one body part given its slot-state.
 *  Body-part fill intensity now reflects MAX wound SEVERITY, not count.
 *  3 bruises (all minor) → light pink; 1 stab wound → deep red. */
function partClasses(slotState) {
  const cls = ["bh-body-fill"];
  if (!slotState) return cls.join(" ");
  // A covered loss (patched eye, covered ear) shows the cover, not the missing hatch.
  if (slotState.missing && !(slotState.wornCount > 0)) {
    cls.push("bh-part-missing");
    return cls.join(" "); // uncovered missing wins over everything
  }
  if (slotState.tier >= 2) cls.push(`bh-part-tier-${slotState.tier}`);
  if (slotState.maxWoundSev > 0) cls.push(`bh-part-wound-${slotState.maxWoundSev}`);
  return cls.join(" ");
}

/** Tooltip text for a body part (hover the SVG element to see). */
function partTitle(slotKey, slotState, family) {
  const label = labelOf(slotKey, family);
  const bits = [label];
  if (slotState?.tier >= 2) {
    const tierName = ["pristine", "light wear", "damaged", "torn", "ruined"][slotState.tier];
    bits.push(`armor: ${tierName}`);
  }
  if (slotState?.wounds > 0) bits.push(`wounds: ${slotState.wounds}`);
  return bits.join(" · ");
}

// ─── Silhouette geometry ────────────────────────────────────────────────────
// One neutral, anatomically-generic mannequin. All characters render with the
// same form; the only thing that varies is the lower body, swapped per family.
//
// Shared upper body — a flowing dress-form mannequin: egg head with a chin
// taper, neck that flares into the trapezius, deltoid caps that read as
// shoulder balls, lat taper into the waist, elbow + wrist pinch on the arms,
// mitten hands.

const HEAD =
  "M 70 5 C 80.5 5, 87.5 13, 87.5 25 C 87.5 35.5, 80 45.5, 70 47.5 C 60 45.5, 52.5 35.5, 52.5 25 C 52.5 13, 59.5 5, 70 5 Z";

const NECK =
  "M 63.5 44 C 64.5 50, 64 56, 61 61 C 66.5 63.5, 73.5 63.5, 79 61 C 76 56, 75.5 50, 76.5 44 C 72.5 46.5, 67.5 46.5, 63.5 44 Z";

// Chest/back torso: shoulder line at y≈66, lats taper to the waist at y≈152.
const TORSO_PATH =
  "M 40 66 C 39 86, 42 112, 46 130 C 47.5 142, 48.5 150, 48.5 152 L 91.5 152 C 91.5 150, 92.5 142, 94 130 C 98 112, 101 86, 100 66 C 80 61, 60 61, 40 66 Z";

// Deltoid caps. Drawn after the arms so the shoulder ball sits over the joint.
const SHOULDER_L =
  "M 53 64 C 43 61, 33 64, 28.5 72 C 26 77, 25.5 83, 27 88 C 32.5 82, 39 78.5, 46.5 77.5 C 49.5 73, 51.5 68.5, 53 64 Z";

// Arm: upper arm tapers to an elbow pinch (~y132), forearm to a narrow wrist.
const ARM_L =
  "M 27 86 C 24.5 102, 23.5 118, 24 132 C 22.5 150, 22 168, 23.5 186 L 31.5 188 C 33.5 170, 34.5 152, 34 134 C 36 118, 37.5 100, 38 88 C 34 84.5, 30.5 84, 27 86 Z";

// Mitten hand under the wrist.
const HAND_L =
  "M 23.5 188 C 19.5 193, 18 200, 19 207 C 20 214, 23.5 219, 27.5 219.5 C 31.5 219, 34.5 214, 35 207 C 35.5 200, 34 193, 31.5 188 C 29 190, 26 190, 23.5 188 Z";

// Pelvis variants. Humanoid/digitigrade get a hip flare + crotch notch so the
// legs read as separate; serpentine omits the notch (flows into the tail);
// centauroid flares outward into the horse chest.
const PELVIS_BIPED =
  "M 48.5 152 C 48 162, 46 172, 44 182 C 42.5 192, 44 202, 49 208 C 55 212, 62 213.5, 68 206 L 70 202 L 72 206 C 78 213.5, 85 212, 91 208 C 96 202, 97.5 192, 96 182 C 94 172, 92 162, 91.5 152 Z";
const PELVIS_SERPENT =
  "M 48.5 152 C 48 162, 46 172, 44 182 C 42.5 192, 44 200, 47 206 C 62 201, 78 201, 93 207 C 96 200, 97.5 192, 96 182 C 94 172, 92 162, 91.5 152 Z";
const PELVIS_CENTAUR =
  "M 48.5 152 C 47 165, 44 180, 40 196 C 50 191, 60 189, 70 189 C 80 189, 90 191, 100 196 C 96 180, 93 165, 91.5 152 Z";

// ─── Lower bodies per family ────────────────────────────────────────────────

// Humanoid leg: thigh → knee pinch (~y300) → calf → ankle (~y380).
const LEG_HUM_L =
  "M 46 198 C 45 235, 48 270, 51.5 298 C 49.5 318, 50 324, 51 332 C 52.5 352, 54 368, 55 380 L 62.5 380 C 63.5 364, 64.5 345, 64.8 326 C 65 318, 64.5 310, 63.8 300 C 66 268, 67.5 232, 68.5 204 C 61 197, 53 196, 46 198 Z";

// Shoe pointing slightly outward, rounded toe.
const FOOT_HUM_L =
  "M 54.5 378 C 53 388, 51 394, 46 397 C 41 400, 38.5 404, 41 407 C 45 409.5, 54 409, 60 407 C 63 405, 64 400, 63.5 393 L 63 380 Z";

// Digitigrade leg: thigh → knee → backward hock (~y345) → metatarsus → paw.
const LEG_DIGI_L =
  "M 45 198 C 43 235, 46 268, 50 295 C 47 315, 48.5 330, 53 345 C 50 360, 49 372, 50.5 382 L 60 382 C 61.5 370, 62 358, 60.5 346 C 64.5 332, 65 315, 63 298 C 65.5 268, 67 234, 68 204 C 60 196.5, 52 196.5, 45 198 Z";

// Paw: flat rounded pad with two toe notches.
const FOOT_DIGI_L =
  "M 49 380 C 45 384, 42.5 390, 43 396 C 43.5 401, 47 404, 51.5 404.5 C 53.5 404.8, 54.5 403.2, 55.5 404.2 C 57.5 405.4, 59.5 404.8, 61 402.5 C 63 398.5, 63 390.5, 61.5 382 Z";

// Digitigrade tail: swishy curl with an inner hook. Front anchors behind the
// right hip; back view re-anchors to the centerline.
const TAIL_DIGI_FRONT =
  "M 95 205 C 113 213, 124 232, 122 256 C 120.5 272, 112 283, 103 283.5 C 97.5 283.5, 95.5 277.5, 99.5 274 C 106 271, 111 264, 110 252 C 109 238, 102 222, 93 213 Z";
const TAIL_DIGI_BACK =
  "M 62 205 C 80 213, 91 232, 89 256 C 87.5 272, 79 283, 70 283.5 C 64.5 283.5, 62.5 277.5, 66.5 274 C 73 271, 78 264, 77 252 C 76 238, 69 222, 60 213 Z";

// Rare humanoid tail (only when state populates the slot).
const TAIL_HUM = "M 96 210 C 116 220, 122 246, 110 268 C 102 276, 98 268, 102 260 C 110 244, 108 230, 100 220 Z";

// Serpentine tail: a THICK body-width serpent tail (a lamia/naga tail is as
// wide as the body, not a thin ribbon). Starts at full hip width (~52px,
// matching the pelvis), sways gently to one side, and tapers to a rounded tip.
// Drawn as a closed outline: down the left edge, around the tip, back up.
const TAIL_SERPENT = `M 45 206
    C 46 232, 48 246, 52 260
    C 57 286, 60 300, 62 315
    C 65 336, 67 350, 68 362
    C 68 380, 67 392, 68 401
    C 68 414, 67 421, 70 428
    C 71 431, 73 431, 74 427
    C 77 415, 81 407, 85 400
    C 91 387, 96 374, 96 360
    C 99 341, 102 329, 102 315
    C 101 290, 100 274, 100 260
    C 99 240, 97 221, 95 206 Z`;

// Centaur barrel (front = chest, back = rump; roughly cylindrical so the
// outline is shared, the rump just rounds the bottom edge a little more).
const BARREL_FRONT =
  "M 36 202 C 22 214, 16 238, 19 262 C 22 282, 34 294, 52 297 L 88 297 C 106 294, 118 282, 121 262 C 124 238, 118 214, 104 202 C 82 194, 58 194, 36 202 Z";
const BARREL_BACK =
  "M 36 202 C 22 214, 15 240, 19 266 C 23 286, 36 297, 54 299 L 86 299 C 104 297, 117 286, 121 266 C 125 240, 118 214, 104 202 C 82 194, 58 194, 36 202 Z";

// Horse leg: forearm/gaskin → knee/hock pinch → slim cannon → fetlock.
function horseLegPath(x) {
  return `M ${x} 290 C ${x - 2} 312, ${x - 1} 330, ${x + 2} 344 C ${x + 1} 350, ${x + 1} 354, ${x + 2} 358 C ${x + 2.5} 374, ${x + 3} 390, ${x + 3.5} 402 L ${x + 13} 402 C ${x + 13.5} 390, ${x + 14} 374, ${x + 14.5} 358 C ${x + 15.5} 354, ${x + 15.5} 350, ${x + 14.5} 344 C ${x + 17} 330, ${x + 17.5} 312, ${x + 16} 292 Z`;
}
// Hoof: flared trapezoid (not an ellipse).
function hoofPath(cx) {
  return `M ${cx - 7.5} 404 L ${cx + 6.5} 404 C ${cx + 8} 410, ${cx + 8.5} 416, ${cx + 7.5} 419 L ${cx - 8.5} 419 C ${cx - 9.5} 416, ${cx - 9} 410, ${cx - 7.5} 404 Z`;
}

// Horse tail: thick hair rope from the top of the rump, slight sway + taper.
const TAIL_HORSE = "M 64 203 C 58 240, 56 290, 62 330 C 65 346, 76 348, 80 336 C 86 296, 84 240, 78 205 Z";

// ─── Mirror + small helpers ────────────────────────────────────────────────

/** Mirror an SVG path's x coordinates around the centerline (x' = 140 − x). */
function mirrorPath(d) {
  // Tokenize numbers; in this path language every coordinate pair is "x y".
  // Commands used are M/C/L (absolute) so x is every even-indexed number
  // within each command's argument run.
  return d.replace(/([MLC])([^MLCZz]+)/g, (_, cmd, args) => {
    const nums = args
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const out = [];
    for (let i = 0; i < nums.length; i += 2) {
      out.push(`${+(140 - nums[i]).toFixed(2)} ${nums[i + 1]}`);
    }
    return cmd + " " + out.join(", ");
  });
}

const ARM_R = mirrorPath(ARM_L);
const HAND_R = mirrorPath(HAND_L);
const SHOULDER_R = mirrorPath(SHOULDER_L);
const LEG_HUM_R = mirrorPath(LEG_HUM_L);
const FOOT_HUM_R = mirrorPath(FOOT_HUM_L);
const LEG_DIGI_R = mirrorPath(LEG_DIGI_L);
const FOOT_DIGI_R = mirrorPath(FOOT_DIGI_L);

// Facial anatomy. These are ALWAYS drawn (a face has two eyes, two ears, a
// mouth) — when a slot is untracked they render as quiet "idle" features;
// tracked state tints them exactly like any body part. Drawing them only when
// populated would make "nothing tracked on the right ear" indistinguishable
// from "lost the right ear" (the latter is what `missing: true` + the hatch
// pattern are for).
const FACE_FEATURES = {
  left_eye: '<ellipse cx="62" cy="24.5" rx="3.1" ry="2.2"',
  right_eye: '<ellipse cx="78" cy="24.5" rx="3.1" ry="2.2"',
  left_ear: '<ellipse cx="52" cy="27" rx="2.4" ry="4.5"',
  right_ear: '<ellipse cx="88" cy="27" rx="2.4" ry="4.5"',
  mouth: '<ellipse cx="70" cy="38.5" rx="5.2" ry="1.7"',
};

// The `face` slot (veils, visors, masks, war paint, rouge) gets a facial oval
// on the head front — drawn behind the eye/ear/mouth features and only in
// front view (the face isn't visible from behind). Positioned on the lower
// face (cheeks → jaw, around the mouth) so the crown above reads clearly as
// the separate `head` slot (head = hats/helms/circlets; face = veils/masks).
const FACE_OVAL = '<ellipse cx="70" cy="39" rx="9.5" ry="8.5"';

function silhouetteSvg(perSlot, view, holding, family) {
  family = family || "humanoid";
  const part = (slotKey) => partClasses(perSlot[slotKey]);
  const title = (slotKey) => `<title>${escapeHtml(partTitle(slotKey, perSlot[slotKey], family))}</title>`;
  const torsoSlot = view === "back" ? "back" : "chest";
  const torsoClass = partClasses(torsoState(perSlot, view));
  const torsoTip = `<title>${escapeHtml(partTitle(torsoSlot, torsoState(perSlot, view), family))}</title>`;

  const holdMarkers = holding
    .map(({ slot, item, damage }) => {
      const pos = HAND_POSITIONS[slot];
      if (!pos) return "";
      const handSide = slot === "left_hand" ? "left" : "right";
      const tip = damage
        ? `Held in ${handSide} hand (character's POV) — ${item} (${damage})`
        : `Held in ${handSide} hand (character's POV) — ${item}`;
      return `<g class="bh-hold-marker" transform="translate(${pos.x},${pos.y})">
            <title>${escapeHtml(tip)}</title>
            <text y="2" text-anchor="middle" class="bh-hold-icon">✦</text>
        </g>`;
    })
    .join("");

  // Subtle spine indicator visible only in back view. Pure decorative —
  // gives the viewer a "yes this is the back" anchor.
  const spineHint =
    view === "back"
      ? `<line x1="70" y1="66" x2="70" y2="150" class="bh-spine-line"/>
           <line x1="70" y1="156" x2="70" y2="198" class="bh-spine-line"/>`
      : "";

  // Lower-body geometry varies by species family. Upper body is shared.
  const lowerBody = lowerBodyParts(perSlot, family, part, title, view);

  // Facial anatomy — ALWAYS drawn. Tracked slots get their per-slot tier /
  // wound classes; untracked ones render as quiet idle features. Eyes + mouth
  // hide in back view (you're behind the head); ears stay (visible from
  // behind). A face's right ear with nothing tracked should look different
  // from a face that lost its right ear (missing → the hatch pattern).
  const faceFeature = (s, shape) => {
    const hidden = view === "back" && (s.endsWith("eye") || s === "mouth");
    if (hidden) return "";
    if (perSlot[s]) {
      return `<g class="bh-part" data-slot="${s}">${title(s)}${shape} class="${part(s)}"/></g>`;
    }
    return `<g class="bh-part bh-face-idle-part" data-slot="${s}"><title>${escapeHtml(labelOf(s, family))} — nothing tracked</title>${shape} class="bh-body-fill bh-face-idle"/></g>`;
  };
  const featureOverlay = Object.keys(FACE_FEATURES)
    .map((s) => faceFeature(s, FACE_FEATURES[s]))
    .join("");

  // Face region — on the head front, behind the eye/ear/mouth features, front
  // view only (the face isn't visible from behind). Always drawn (idle when
  // untracked) so face items (veils, masks, paint) have a region to couple to.
  const faceRegion =
    view === "back"
      ? ""
      : (() => {
          if (perSlot.face) {
            return `<g class="bh-part" data-slot="face">${title("face")}${FACE_OVAL} class="${part("face")}"/></g>`;
          }
          return `<g class="bh-part bh-face-idle-part" data-slot="face"><title>face — nothing tracked</title>${FACE_OVAL} class="bh-body-fill bh-face-idle"/></g>`;
        })();

  // Front view mirrors the body so character-left visually appears on
  // viewer-right (the character faces you, so their right is on your left
  // — standard anatomical convention). Back view does NOT mirror because
  // you're behind the character now, so their left is on your left.
  const mirror = view === "front" ? 'transform="scale(-1, 1) translate(-140, 0)"' : "";

  // Flowing dress-form mannequin. Each region is a separate path/shape tagged
  // with data-slot so per-slot tinting (.bh-part-tier-N for armor stroke,
  // .bh-part-wound-N for wound fill) works unchanged. Shoulder deltoid caps
  // are drawn AFTER the arms so the shoulder ball sits over the joint.
  return `<svg class="bh-silhouette" viewBox="0 0 140 440" data-view="${view}" data-family="${family}" aria-hidden="true">
        <defs>
            <pattern id="bh-missing-pattern" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#888" stroke-width="1.2" stroke-opacity="0.6"/>
            </pattern>
        </defs>
        <g class="bh-body-group" ${mirror}>
            <g class="bh-part" data-slot="head">${title("head")}<path d="${HEAD}" class="${part("head")}"/></g>
            ${faceRegion}
            ${featureOverlay}
            <g class="bh-part" data-slot="neck">${title("neck")}<path d="${NECK}" class="${part("neck")}"/></g>
            <g class="bh-part" data-slot="${torsoSlot}">${torsoTip}<path d="${TORSO_PATH}" class="${torsoClass}"/></g>
            ${pelvisHtml(perSlot, family, part, title)}
            <g class="bh-part" data-slot="left_arm">${title("left_arm")}<path d="${ARM_L}" class="${part("left_arm")}"/></g>
            <g class="bh-part" data-slot="right_arm">${title("right_arm")}<path d="${ARM_R}" class="${part("right_arm")}"/></g>
            <g class="bh-part" data-slot="left_hand">${title("left_hand")}<path d="${HAND_L}" class="${part("left_hand")}"/></g>
            <g class="bh-part" data-slot="right_hand">${title("right_hand")}<path d="${HAND_R}" class="${part("right_hand")}"/></g>
            <g class="bh-part bh-shoulder" data-slot="left_shoulder">${title("left_shoulder")}<path d="${SHOULDER_L}" class="${part("left_shoulder")}"/></g>
            <g class="bh-part bh-shoulder" data-slot="right_shoulder">${title("right_shoulder")}<path d="${SHOULDER_R}" class="${part("right_shoulder")}"/></g>
            ${lowerBody}

            ${spineHint}
            ${holdMarkers}
        </g>
    </svg>`;
}

/**
 * Pelvis / hip region. It belongs to the waist slot (one slot, two shapes — the
 * torso lats taper into it). Centauroid uses a wider flare into the horse chest;
 * the other families share the biped/serpent pelvis. Drawn before the arms so
 * the arms layer over the hip edge.
 */
function pelvisHtml(perSlot, family, part, title) {
  let pelvis;
  if (family === "centauroid") pelvis = PELVIS_CENTAUR;
  else if (family === "serpentine") pelvis = PELVIS_SERPENT;
  else pelvis = PELVIS_BIPED;
  return `<g class="bh-part" data-slot="waist">${title("waist")}<path d="${pelvis}" class="${part("waist")}"/></g>`;
}

/**
 * Lower-body SVG paths per species family. Upper body is shared.
 *
 *   humanoid    — two tapered legs + shoe-shaped feet
 *   digitigrade — legs with a backward hock; flat paw feet
 *   serpentine  — no legs; a thick body-width tail. left/right_leg + foot slots
 *                 are marked off-silhouette in the slot rows.
 *   centauroid  — horse-like quadruped extension below the waist. The four
 *                 leg slots get distributed (left_leg=fore-left, etc.).
 */
function lowerBodyParts(perSlot, family, part, title, view) {
  view = view === "back" ? "back" : "front";
  const pathPart = (slot, d, extra) =>
    `<g class="bh-part" data-slot="${slot}">${title(slot)}<path d="${d}" class="${part(slot)}${extra ? " " + extra : ""}"/></g>`;

  if (family === "serpentine") {
    // Lamia / naga / merfolk tail — a thick, body-width serpent tail
    // (as wide as the body, not a thin ribbon). Wrapped in data-slot="tail"
    // so items (silver bands, magical wraps) can land on it.
    return pathPart("tail", TAIL_SERPENT, "bh-tail");
  }
  if (family === "centauroid") {
    // Centaur — view-aware. Real horse anatomy: from the FRONT you see the
    // chest + 2 fore legs; the hind legs and tail are HIDDEN behind the
    // body. From the BACK you see the rump + 2 hind legs + tail; the fore
    // legs are HIDDEN behind. The slot cards stay in the columns regardless
    // of view — they just don't light up the silhouette when the part isn't
    // visible from the current angle. The barrel belongs to the waist slot.
    const fore = view !== "back";
    const legL = fore ? "left_leg" : "hind_left_leg";
    const legR = fore ? "right_leg" : "hind_right_leg";
    const footL = fore ? "left_foot" : "hind_left_foot";
    const footR = fore ? "right_foot" : "hind_right_foot";
    const barrel = view === "back" ? BARREL_BACK : BARREL_FRONT;
    const barrelHtml = pathPart("waist", barrel);
    // Horse tail hangs from the top of the rump — only visible from behind.
    const tail = view === "back" ? pathPart("tail", TAIL_HORSE, "bh-tail") : "";
    return [
      barrelHtml,
      tail,
      pathPart(legL, horseLegPath(41)),
      pathPart(legR, horseLegPath(83)),
      pathPart(footL, hoofPath(49.5)),
      pathPart(footR, hoofPath(91.5)),
    ].join("");
  }
  if (family === "digitigrade") {
    // Catfolk / foxfolk / wolffolk / etc. Legs bend back at a hock; the
    // foot reads as a flat paw rather than a shoe. View-aware tail: peeks
    // from behind the right hip in FRONT view; re-anchors to the centerline
    // in BACK view.
    const tailD = view === "back" ? TAIL_DIGI_BACK : TAIL_DIGI_FRONT;
    return [
      pathPart("left_leg", LEG_DIGI_L),
      pathPart("right_leg", LEG_DIGI_R),
      pathPart("left_foot", FOOT_DIGI_L),
      pathPart("right_foot", FOOT_DIGI_R),
      pathPart("tail", tailD, "bh-tail"),
    ].join("");
  }
  // humanoid (default fallback for any family without its own lower body).
  // Tapered legs, shoe-shaped feet pointing outward. A tail is rendered when
  // the family always has one OR when state explicitly populates it (rare
  // humanoid case).
  const familyAlwaysHasTail = (FAMILY_ALWAYS_SLOTS[family] || new Set()).has("tail");
  const optionalTail = perSlot.tail || familyAlwaysHasTail ? pathPart("tail", TAIL_HUM, "bh-tail") : "";
  return [
    pathPart("left_leg", LEG_HUM_L),
    pathPart("right_leg", LEG_HUM_R),
    pathPart("left_foot", FOOT_HUM_L),
    pathPart("right_foot", FOOT_HUM_R),
    optionalTail,
  ].join("");
}

// Hand-marker anchor points for held items (✦), matched to the v2 mitten hands.
const HAND_POSITIONS = {
  left_hand: { x: 27, y: 205 },
  right_hand: { x: 113, y: 205 },
};

/**
 * Collect renderable rows from a character state. Worn items spanning
 * multiple slots are GROUPED — a sundress at chest + waist + L_leg + R_leg
 * renders as one row "Sundress · chest · waist · legs", not four. Grouping
 * key is (lowercased item, damage); two "boots" with different damage stay
 * separate rows.
 *
 * Returns: [{slots: [str], kind: 'worn'|'holding', item, damage?}].
 */
function collectSlotRows(state) {
  const body = state.body || {};

  // Group worn entries by (item, damage, color) → merged slot list.
  // Each worn entry may carry an optional `color`. Two "shirts" with
  // different colors stay separate groups so the chip can render both
  // distinctly (a red shirt and a blue shirt aren't "both shirts").
  const wornGroups = new Map();
  for (const [slot, sd] of Object.entries(body)) {
    if (!sd?.worn?.length) continue;
    for (const w of sd.worn) {
      const item = w.item || "?";
      const dmg = w.damage || "";
      const color = w.color || "";
      // Group by CANONICAL garment (boot==boots) + CANONICAL color (crimson==red).
      // The displayed `item`/`color` keep the original (first-seen) surface; only
      // the grouping key is normalized, so a cross-slot "boot"/"boots" split renders
      // as ONE row instead of two.
      const key = `${canonicalGarment(item)}|${dmg.toLowerCase()}|${normalizeColor(color)}`;
      if (!wornGroups.has(key)) {
        wornGroups.set(key, { kind: "worn", item, damage: dmg, color, slots: [] });
      }
      wornGroups.get(key).slots.push(slot);
    }
  }

  // Holding entries are inherently per-slot (each hand can hold one thing).
  // holding is {item, damage, [color]} (with a bare-string fallback).
  const holdRows = [];
  for (const [slot, sd] of Object.entries(body)) {
    const h = normalizeHolding(sd?.holding);
    if (h) {
      holdRows.push({ kind: "holding", item: h.item, damage: h.damage, color: h.color, slots: [slot] });
    }
  }

  // Wounds become first-class rows. Each wound carries its inferred (or
  // explicit) severity tier 1..3 so the chip can render colored accordingly
  // — bruise vs stab wound shouldn't look identical. A wound may also carry a
  // `bleeding` flag — the chip uses it to render a small drop indicator and a
  // subtle pulse, separating fresh wounds from sealed/scabbed ones.
  const woundRows = [];
  for (const [slot, sd] of Object.entries(body)) {
    if (!sd?.wounds?.length) continue;
    for (const w of sd.wounds) {
      const bleeding = typeof w === "object" && w !== null && w.bleeding === true;
      woundRows.push({
        kind: "wound",
        item: woundText(w),
        severity: woundSeverity(w),
        bleeding,
        slots: [slot],
      });
    }
  }

  return [...wornGroups.values(), ...holdRows, ...woundRows];
}

/**
 * Format a list of slot keys for display. Collapses symmetric pairs:
 *   ['left_leg', 'right_leg'] → 'both legs'
 *   ['chest', 'waist']        → 'chest · waist'
 *   ['left_hand']             → 'L. hand'
 */
function formatSlotList(slots) {
  if (slots.length === 2) {
    const [a, b] = slots;
    const PAIRS = {
      "left_hand|right_hand": "both hands",
      "left_arm|right_arm": "both arms",
      "left_leg|right_leg": "both legs",
      "left_foot|right_foot": "both feet",
      "left_shoulder|right_shoulder": "both shoulders",
    };
    const key = [a, b].sort().join("|");
    if (PAIRS[key]) return PAIRS[key];
  }
  return slots.map((s) => SLOT_LABEL[s] || s).join(" · ");
}

/**
 * Which column (left/right/center) does a merged row belong in?
 * Single-side items go to their side; mixed/center rows go to whichever
 * column is shorter at render time (returned as 'center').
 */
function rowSide(slots) {
  const sides = new Set(slots.map((s) => SLOT_SIDE[s] || "center"));
  if (sides.size === 1) {
    const only = [...sides][0];
    if (only === "left" || only === "right") return only;
  }
  return "center";
}

/**
 * Render a single character's paper doll. Returns HTML string.
 *
 * `view` is 'front' (default) or 'back'. In back view the torso reflects the
 * 'back' slot's state instead of 'chest', and a subtle spine line appears so
 * the user knows they're seeing the rear silhouette.
 */
function renderCharacterDoll(name, state, view, opts = {}) {
  state = state || {};
  view = view === "back" ? "back" : "front";
  const placeholder = opts.placeholder === true;
  const body = state.body || {};
  const family = familyOf(state.species);
  const offBodySlots = OFF_BODY_SLOTS[family] || OFF_BODY_SLOTS.humanoid;

  // Per-slot aggregate state drives body-part stroke (armor damage) and
  // fill (wound) coloring. Replaces the old wound-dot-on-anatomy approach.
  const perSlot = computeSlotStates(state);

  // Hold markers on the silhouette (✦ on hand positions). Wounds are now
  // first-class slot rows via collectSlotRows (kind='wound'), so we don't
  // need a separate wounds list here.
  const holding = [];
  for (const [slot, sd] of Object.entries(body)) {
    const h = normalizeHolding(sd?.holding);
    if (h) holding.push({ slot, item: h.item, damage: h.damage });
  }

  const realRows = collectSlotRows(state);

  // Group rows BY each slot they cover. Multi-slot items (sundress on
  // chest+waist+legs) are included in EVERY slot card they touch — the
  // user explicitly preferred this over a separate "spanning" section.
  // Same row object referenced in multiple slots' lists is fine; it's
  // just rendered once per card.
  const rowsBySlot = new Map();
  for (const row of realRows) {
    for (const s of row.slots) {
      if (!rowsBySlot.has(s)) rowsBySlot.set(s, []);
      rowsBySlot.get(s).push(row);
    }
  }

  // Build one card per anatomical slot (or skip off-body slots for species
  // that don't have them). Empty slot → ghost card (faint one-liner).
  // PROPOSED slots (facial features, species-conditional slots) only render
  // a card when state explicitly references them OR when the family always
  // has them (centaurs always get hind-legs + tail, lamia always gets tail,
  // digitigrade species always get tail).
  const alwaysSlots = FAMILY_ALWAYS_SLOTS[family] || new Set();
  const allSlotKeys = Object.keys(SLOT_Y).filter((s) => {
    if (offBodySlots.has(s)) return false;
    if (PROPOSED_SLOTS.has(s) && !rowsBySlot.has(s) && !perSlot[s] && !alwaysSlots.has(s)) return false;
    return true;
  });
  const slotCards = allSlotKeys
    .map((slot) => ({ slot, items: rowsBySlot.get(slot) || [] }))
    .sort((a, b) => (SLOT_Y[a.slot] ?? 50) - (SLOT_Y[b.slot] ?? 50));

  const paired = currentLayout === "paired";

  // Distribute slot cards into left/right columns.
  //
  // Columns mode: pack by anatomical side, center slots into the shorter
  // column (the host's two-column layout).
  //
  // Paired mode: lay the grid out so every true L/R pair shares one row
  // (col 1 ← left, col 3 ← right); a populated half of a pair forces a ghost
  // card for the empty half so every silhouette region has a coupled box and
  // pairs stay symmetric; center / unpaired slots flow in anatomical order,
  // packing two-per-row to fill the gaps beside the figure. Each card gets an
  // inline grid-column/grid-row so the CSS grid (.bh-doll-grid.bh-paired)
  // places it; the figure spans the middle column across all rows.
  const cols = { left: [], right: [] };
  let figureSpan = "";
  if (paired) {
    const bySlot = new Map(slotCards.map((sc) => [sc.slot, sc]));
    // Couple every populated half of a pair with a ghost for its empty half.
    // Off-body slots (e.g. serpentine legs) are excluded above, so they
    // never create a ghost.
    for (const sc of slotCards) {
      const mate = PAIR_OF[sc.slot];
      if (mate && !bySlot.has(mate) && !offBodySlots.has(mate)) {
        bySlot.set(mate, { slot: mate, items: [], ghost: true });
      }
    }
    const place = (entry, col, r) => {
      entry.style = `grid-column:${col};grid-row:${r}`;
      (col === 1 ? cols.left : cols.right).push(entry);
    };
    let row = 0;
    let pendingCenterCol = 0; // 0 = none; 3 = a row with a free col-3 cell
    const seen = new Set();
    for (const slot of LAYOUT_SLOT_ORDER) {
      const entry = bySlot.get(slot);
      if (!entry || seen.has(slot)) continue;
      const mate = PAIR_OF[slot];
      if (mate && bySlot.has(mate)) {
        // True pair → its own fresh row. left key → col1, right → col3.
        row += 1;
        const isLeft = slot.startsWith("left") || slot.startsWith("hind_left");
        place(entry, isLeft ? 1 : 3, row);
        place(bySlot.get(mate), isLeft ? 3 : 1, row);
        seen.add(slot);
        seen.add(mate);
        pendingCenterCol = 0;
      } else {
        // Center / unpaired slot → fill a pending col-3, else open col1.
        if (pendingCenterCol === 3) {
          place(entry, 3, row);
          pendingCenterCol = 0;
        } else {
          row += 1;
          place(entry, 1, row);
          pendingCenterCol = 3;
        }
        seen.add(slot);
      }
    }
    figureSpan = `grid-column:2;grid-row:1 / ${row + 2}`;
  } else {
    for (const sc of slotCards) {
      const side = SLOT_SIDE[sc.slot] || "center";
      if (side === "left") cols.left.push(sc);
      else if (side === "right") cols.right.push(sc);
      else {
        (cols.left.length <= cols.right.length ? cols.left : cols.right).push(sc);
      }
    }
  }

  /** Render one inline chip representing a worn item, held item, or wound.
   *
   *  Layout: [glyph/dot] [item name].
   *  Damage tier / wound severity is encoded SOLELY by the dot/glyph color.
   *  Exact word ("frayed" / "critical" / etc.) lives in the title tooltip,
   *  not in inline text — inline text was forcing mid-word wraps on long
   *  item names (`cracked breastpla|te`, `silver wedding|band`) by stealing
   *  the second column.  */
  // Color → swatch. The palette below is the set of controlled values;
  // free-text variants ("crimson", "burgundy") fall back to a neutral and
  // rely on the tooltip for the exact word. Color renders as an inline swatch
  // beside the damage dot, NOT as a word prefix — text reads cleanly, color
  // reads as color. The tooltip preserves the literal color word.
  const PALETTE = new Set([
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "brown",
    "black",
    "white",
    "gray",
    "beige",
    "gold",
    "silver",
    "navy",
    "tan",
  ]);
  const colorClass = (color) => {
    if (!color) return "";
    const c = String(color).trim().toLowerCase();
    if (!c) return "";
    return PALETTE.has(c) ? `bh-c-${c}` : "bh-c-other";
  };
  const colorSwatch = (row) => {
    if (!row.color) return "";
    const cls = colorClass(row.color);
    return `<span class="bh-chip-swatch ${cls}" title="color: ${escapeHtml(row.color)}"></span>`;
  };
  // Escaped like every sibling label: this lands inside a title="…" attribute,
  // and the colour word comes from the extractor, i.e. ultimately from prose.
  const colorTitle = (row) => (row.color ? ` · color: ${escapeHtml(row.color)}` : "");

  // (Severity dots ▪/▪▪/▪▪▪ removed — the wound chip's COLOR already
  // encodes severity, the dots were redundant noise.)

  // Multi-slot indicator: when a row covers >1 slot (e.g. sundress on chest +
  // waist + both legs), append a small chain glyph + count. Chip stays in
  // every slot it covers (testers explicitly preferred this), but readers
  // can see "this item also lives elsewhere" at a glance.
  const multiSlot = (row) => {
    if (!row.slots || row.slots.length <= 1) return "";
    const list = row.slots.map((s) => labelOf(s, family)).join(", ");
    return `<span class="bh-chip-multi" title="also on: ${escapeHtml(list)}">⌖${row.slots.length}</span>`;
  };

  // Verbose label sub-row — wraps onto a second line in Full view so the
  // chip text on line 1 isn't pushed off the card by the labels. The row
  // wrapper is hidden in non-Full views; in Full it's flex-basis:100% to
  // force a line break, indented to align under the item text.
  const verboseRow = (parts) => {
    const labels = parts.filter(Boolean).join("");
    if (!labels) return "";
    return `<span class="bh-chip-verbose-row">${labels}</span>`;
  };
  const dmgLabel = (damage) => {
    if (!damage) return "";
    const label = damageMeta(damage).label;
    return `<span class="bh-chip-verbose bh-chip-verbose-dmg">${escapeHtml(label)}</span>`;
  };
  // Verbose color label — the literal color word ("rust-red", "ivory",
  // "burgundy"). The swatch carries the same info graphically, so this is
  // gated behind the Color layer: users who want a clean view can disable
  // the layer and rely on swatches alone; users who want full annotation
  // get the word too. Free-text colors that don't map to a palette class
  // are STILL useful here (the swatch falls back to neutral).
  const colorLabel = (row) => {
    if (!row?.color) return "";
    return `<span class="bh-chip-verbose bh-chip-verbose-color">${escapeHtml(row.color)}</span>`;
  };
  const sevLabel = (sev) => {
    const label = ["", "minor", "serious", "critical"][sev || 2];
    return `<span class="bh-chip-verbose bh-chip-verbose-sev">${label}</span>`;
  };
  const bleedLabel = (bleed) => (bleed ? `<span class="bh-chip-verbose bh-chip-verbose-bleed">bleeding</span>` : "");

  const renderChip = (row) => {
    if (row.kind === "wound") {
      const sev = row.severity || 2;
      const sevText = ["", "minor", "serious", "critical"][sev];
      const bleed = row.bleeding === true;
      const bleedTitle = bleed ? " · bleeding" : "";
      // Bleeding wounds: the ✚ glyph itself pulses red. No separate
      // status dot — the glyph IS the indicator.
      return `<span class="bh-chip bh-chip-wound bh-chip-wound-${sev} ${bleed ? "bh-chip-bleeding" : ""}" title="wound · ${sevText}${bleedTitle}">
                <span class="bh-chip-head"><span class="bh-chip-glyph">✚</span><span class="bh-chip-text">${escapeHtml(row.item)}</span>${multiSlot(row)}</span>${verboseRow([sevLabel(sev), bleedLabel(bleed)])}
            </span>`;
    }
    if (row.kind === "holding") {
      // Held items can carry damage too. Apply the same tier class as
      // worn so .bh-chip-dot picks up the right color; the ✦ glyph stays
      // the "held" identifier.
      const meta = damageMeta(row.damage);
      const dmgTitle = row.damage ? ` · ${escapeHtml(meta.label)}` : "";
      return `<span class="bh-chip bh-chip-hold ${meta.class}" title="held${dmgTitle}${colorTitle(row)}">
                <span class="bh-chip-head"><span class="bh-chip-dot"></span><span class="bh-chip-glyph">✦</span>${colorSwatch(row)}<span class="bh-chip-text">${escapeHtml(row.item)}</span>${multiSlot(row)}</span>${verboseRow([dmgLabel(row.damage), colorLabel(row)])}
            </span>`;
    }
    // worn
    const meta = damageMeta(row.damage);
    const dmgTitle = row.damage ? ` · ${escapeHtml(meta.label)}` : "";
    return `<span class="bh-chip ${meta.class}" title="worn${dmgTitle}${colorTitle(row)}">
            <span class="bh-chip-head"><span class="bh-chip-dot"></span>${colorSwatch(row)}<span class="bh-chip-text">${escapeHtml(row.item)}</span>${multiSlot(row)}</span>${verboseRow([dmgLabel(row.damage), colorLabel(row)])}
        </span>`;
  };

  /** Render one slot card. Empty slots get a faint one-liner placeholder.
   *  Border color reflects ARMOR damage only (worst worn tier in this slot).
   *  Wounds get their own ✚N marker in the header — combining them into a
   *  green-red gradient looked off when a slot had ONLY a wound.
   *  Missing slots (acquired loss — lost arm, missing eye) render with
   *  gray hatch/strikethrough. Distinct from "empty" and "off-body". */
  const renderSlotCard = ({ slot, items, style }) => {
    const slotLabel = labelOf(slot, family);
    const slotState = perSlot[slot];
    const styleAttr = style ? ` style="${style}"` : "";
    // A covered loss (patched eye / covered ear / gag) shows the cover, not the
    // "missing" tag — the cover IS the visible, tracked state there.
    const coveredLoss = COVERABLE_MISSING_SLOTS.has(slot) && slotState?.wornCount > 0;
    if (slotState?.missing && !coveredLoss) {
      return `<div class="bh-slot-card bh-slot-missing" data-slot="${slot}" data-slots="${slot}"${styleAttr} title="${escapeHtml(slotLabel)} — missing / lost">
                <span class="bh-slot-name">${escapeHtml(slotLabel)}</span>
                <span class="bh-slot-missing-tag">missing</span>
            </div>`;
    }
    // bare: narration explicitly confirmed the slot is uncovered. Distinct
    // from empty: empty = unknown, bare = known-uncovered. Renders with a
    // skin-tone left bar instead of the gray "missing" hatch.
    if (slotState?.bare && items.length === 0) {
      return `<div class="bh-slot-card bh-slot-bare" data-slot="${slot}" data-slots="${slot}"${styleAttr} title="${escapeHtml(slotLabel)} — bare (narration confirmed uncovered)">
                <span class="bh-slot-name">${escapeHtml(slotLabel)}</span>
                <span class="bh-slot-bare-tag">bare</span>
            </div>`;
    }
    if (items.length === 0) {
      return `<div class="bh-slot-card bh-slot-empty" data-slot="${slot}" data-slots="${slot}"${styleAttr}>
                <span class="bh-slot-name">${escapeHtml(slotLabel)}</span>
            </div>`;
    }
    // Sort: worn first (outer→inner per schema), then holding, then wounds.
    const wornItems = items.filter((i) => i.kind === "worn");
    const heldItems = items.filter((i) => i.kind === "holding");
    const ordered = [...wornItems, ...heldItems, ...items.filter((i) => i.kind === "wound")];
    // Damage tier now reads from each CHIP's own left bar (CSS ::before
    // colored by .bh-tier-N), so the card itself no longer carries a
    // tier border. Each item's bar matches its own chip's height — three
    // items = three same-height bars, naturally aligned. Wounds get no
    // bar (they aren't gear damage; the ✚ glyph + severity dots speak
    // for themselves). The wound-only slot also has no card border now;
    // the wound chips inside identify themselves.
    const woundChips = ordered.filter((i) => i.kind === "wound");
    const woundCount = woundChips.length;
    const cardClasses = [
      "bh-slot-card",
      wornItems.length > 1 ? "bh-slot-worn-stacked" : "", // drives the per-chip 1/N indices
    ]
      .filter(Boolean)
      .join(" ");
    // Render chips. Worn stacks get layer indices; held chips render
    // as-is. Wounds go into their own sub-group (.bh-slot-wounds) so
    // they're visually separated from the gear with a dashed divider.
    const wornStacked = wornItems.length > 1;
    let wornIdx = 0;
    const itemChips = ordered
      .filter((row) => row.kind !== "wound")
      .map((row) => {
        if (row.kind === "worn" && wornStacked) {
          wornIdx += 1;
          const role = wornIdx === 1 ? "outermost" : wornIdx === wornItems.length ? "innermost" : `layer ${wornIdx}`;
          // Copy the chip's tier class onto the wrapper so the
          // wrapper's ::before bar (positioned at the card edge)
          // picks up the right tier color.
          const meta = damageMeta(row.damage);
          return `<div class="bh-chip-layered ${meta.class}" data-layer="${wornIdx}" title="${role}">
                        <span class="bh-chip-layer-idx">${wornIdx}</span>
                        ${renderChip(row)}
                    </div>`;
        }
        return renderChip(row);
      })
      .join("");
    const woundChipsHtml = woundCount ? `<div class="bh-slot-wounds">${woundChips.map(renderChip).join("")}</div>` : "";
    return `<div class="${cardClasses}" data-slot="${slot}" data-slots="${slot}"${styleAttr}>
            <div class="bh-slot-card-head">
                <span class="bh-slot-name">${escapeHtml(slotLabel)}</span>
            </div>
            <div class="bh-slot-chips">${itemChips}${woundChipsHtml}</div>
        </div>`;
  };

  /** A ghost card: a faint empty placeholder for the unpopulated half of a
   *  populated L/R pair, so every silhouette region has a coupled box and
   *  pairs stay symmetric in paired layout. */
  const ghostCard = (slot, style) => {
    const styleAttr = style ? ` style="${style}"` : "";
    return `<div class="bh-slot-card bh-slot-empty bh-slot-ghosted" data-slot="${slot}" data-slots="${slot}"${styleAttr}>
            <span class="bh-slot-name">${escapeHtml(labelOf(slot, family))}</span>
        </div>`;
  };

  const renderColCard = (entry) => (entry.ghost ? ghostCard(entry.slot, entry.style) : renderSlotCard(entry));
  const leftCol = cols.left.map(renderColCard).join("");
  const rightCol = cols.right.map(renderColCard).join("");

  // "Empty" = no real state (only ghost placeholders + nothing else).
  // Don't treat the ghost slot rows as content.
  const isEmpty = realRows.length === 0 && holding.length === 0;

  // Identity badge next to the character name. Species ALWAYS shown when
  // known (including 'human').
  const sp = state.species ? String(state.species).trim() : "";
  const speciesTag = sp ? `<span class="bh-char-species">${escapeHtml(sp)}</span>` : "";

  // Wounds are now first-class rows (kind='wound') rendered alongside worn
  // and holding rows — no separate <details> list at the bottom.

  // ── Digest (compact list) ──────────────────────────────────────────
  // Alternative DOM rendered alongside the doll grid. CSS swaps which one
  // shows: in List layout, or auto below 360px width, the digest replaces
  // the doll. The digest reorders information by IMPORTANCE (wounds first →
  // held → worn → state flags) rather than by anatomy, since the silhouette
  // spatial cue isn't shown here. A toolbar at the top carries the "Edit
  // slots" affordance (the list view's only edit entry point) and a copy of
  // the layout switch (hidden when auto-narrow).
  const digestHtml = isEmpty
    ? placeholder
      ? // Placeholder in list view: render just the layout switch so the user
        // can switch back out of the (empty) list — no "Edit slots", nothing to edit.
        `<div class="bh-digest"><div class="bh-digest-toolbar"><div class="bh-layout-switch-row">${layoutSwitchHtml()}</div></div></div>`
      : ""
    : (() => {
        const slotLabelOf = (s) => labelOf(s, family);
        // Build flat lists from collected rows (already grouped by kind).
        // Wounds: sort by severity DESC, bleeding first, then slot order.
        const wounds = realRows
          .filter((r) => r.kind === "wound")
          .map((r) => ({ row: r, slot: r.slots[0] }))
          .sort((a, b) => {
            const sevDiff = (b.row.severity || 2) - (a.row.severity || 2);
            if (sevDiff !== 0) return sevDiff;
            const bleedDiff = (b.row.bleeding ? 1 : 0) - (a.row.bleeding ? 1 : 0);
            if (bleedDiff !== 0) return bleedDiff;
            return (SLOT_Y[a.slot] ?? 50) - (SLOT_Y[b.slot] ?? 50);
          });
        // Held: left then right (hand reading order).
        const held = holding.slice().sort((a, b) => (SLOT_Y[a.slot] ?? 50) - (SLOT_Y[b.slot] ?? 50));
        // Worn: by slot Y (head → feet). Multi-slot items show in the first
        // (topmost) slot they cover; the chip's ⌖N annotation calls out the
        // rest. Layered items get the 1/N index — critical info.
        const wornBySlot = new Map();
        for (const row of realRows.filter((r) => r.kind === "worn")) {
          const topSlot = [...row.slots].sort((a, b) => (SLOT_Y[a] ?? 50) - (SLOT_Y[b] ?? 50))[0];
          if (!wornBySlot.has(topSlot)) wornBySlot.set(topSlot, []);
          wornBySlot.get(topSlot).push(row);
        }
        // Group worn rows by anatomical region for the digest. Within a
        // region, slots stay in Y order; layered items within a slot keep
        // outer→inner sequence.
        const REGIONS = [
          {
            key: "head",
            label: "Head & Face",
            slots: ["head", "face", "left_eye", "right_eye", "left_ear", "right_ear", "mouth", "neck"],
          },
          { key: "torso", label: "Torso", slots: ["left_shoulder", "right_shoulder", "chest", "back", "waist"] },
          { key: "arms", label: "Arms & Hands", slots: ["left_arm", "right_arm", "left_hand", "right_hand"] },
          { key: "legs", label: "Legs & Feet", slots: ["left_leg", "right_leg", "left_foot", "right_foot"] },
        ];
        const regionOf = (slot) => {
          for (const r of REGIONS) if (r.slots.includes(slot)) return r.key;
          return "other";
        };
        const wornByRegion = new Map(REGIONS.map((r) => [r.key, []]));
        wornByRegion.set("other", []);
        for (const [slot, rows] of [...wornBySlot.entries()].sort(
          (a, b) => (SLOT_Y[a[0]] ?? 50) - (SLOT_Y[b[0]] ?? 50),
        )) {
          const region = regionOf(slot);
          rows.forEach((row, i) => {
            wornByRegion.get(region).push({
              row,
              slot,
              layerIdx: rows.length > 1 ? i + 1 : 0,
              layerTotal: rows.length,
            });
          });
        }
        const wornTotalCount = [...wornByRegion.values()].reduce((n, group) => n + group.length, 0);
        // Missing + bare slots (semantic flags worth surfacing).
        const missingSlots = [],
          bareSlots = [];
        for (const [s, st] of Object.entries(perSlot)) {
          // A covered loss surfaces as its cover (in the worn list), not a "missing" flag.
          const coveredLoss = COVERABLE_MISSING_SLOTS.has(s) && st?.wornCount > 0;
          if (st?.missing && !coveredLoss) missingSlots.push(s);
          else if (st?.bare) bareSlots.push(s);
        }
        const slotTag = (slot, layerIdx, layerTotal) => {
          const layer = layerTotal > 1 ? `<span class="bh-digest-layer">${layerIdx}/${layerTotal}</span>` : "";
          return `<span class="bh-digest-slot">${escapeHtml(slotLabelOf(slot))}</span>${layer}`;
        };
        const digestRow = ({ row, slot, layerIdx, layerTotal }) => `
            <li class="bh-digest-row">
                ${renderChip(row)}
                ${slotTag(slot, layerIdx || 0, layerTotal || 0)}
            </li>`;
        const section = (key, label, count, items) => {
          if (!items.length) return "";
          return `<section class="bh-digest-section bh-digest-section-${key}" data-section="${key}">
                <h4 class="bh-digest-heading">${escapeHtml(label)}<span class="bh-digest-count">${count}</span></h4>
                <ul class="bh-digest-list">${items.join("")}</ul>
            </section>`;
        };
        const woundItems = wounds.map(({ row, slot }) => digestRow({ row, slot, layerIdx: 0, layerTotal: 0 }));
        const heldItems = held.map(({ slot, item, damage }) => {
          // Reconstruct a holding row that renderChip understands.
          const row = realRows.find((r) => r.kind === "holding" && r.slots[0] === slot) || {
            kind: "holding",
            item,
            damage,
            slots: [slot],
          };
          return digestRow({ row, slot, layerIdx: 0, layerTotal: 0 });
        });
        // Worn section is the big one — render with region subheadings so a
        // long list doesn't read as one undifferentiated wall.
        const wornGroupedHtml =
          REGIONS.map((r) => {
            const rows = wornByRegion.get(r.key) || [];
            if (!rows.length) return "";
            return `<li class="bh-digest-group">
                <h5 class="bh-digest-subhead">${escapeHtml(r.label)}</h5>
                <ul class="bh-digest-group-list">${rows.map(digestRow).join("")}</ul>
            </li>`;
          }).join("") +
          (wornByRegion.get("other").length
            ? `<li class="bh-digest-group">
                <h5 class="bh-digest-subhead">Other</h5>
                <ul class="bh-digest-group-list">${wornByRegion.get("other").map(digestRow).join("")}</ul>
            </li>`
            : "");
        const flagItems = [];
        for (const s of missingSlots)
          flagItems.push(
            `<li class="bh-digest-row bh-digest-row-flag">
                <span class="bh-digest-flag bh-digest-flag-missing">missing</span>
                ${slotTag(s, 0, 0)}
            </li>`,
          );
        for (const s of bareSlots)
          flagItems.push(
            `<li class="bh-digest-row bh-digest-row-flag">
                <span class="bh-digest-flag bh-digest-flag-bare">bare</span>
                ${slotTag(s, 0, 0)}
            </li>`,
          );
        const wornSectionHtml = wornTotalCount
          ? `<section class="bh-digest-section bh-digest-section-worn" data-section="worn">
                <h4 class="bh-digest-heading">Worn<span class="bh-digest-count">${wornTotalCount}</span></h4>
                <ul class="bh-digest-list bh-digest-list-grouped">${wornGroupedHtml}</ul>
            </section>`
          : "";
        const toolbar = `<div class="bh-digest-toolbar">
            <button class="bh-digest-edit"><i class="fa-solid fa-pen"></i> Edit slots</button>
            <div class="bh-layout-switch-row">${layoutSwitchHtml()}</div>
        </div>`;
        return `<div class="bh-digest">
            ${toolbar}
            ${section("wounds", "Wounds", wounds.length, woundItems)}
            ${section("held", "Held", held.length, heldItems)}
            ${wornSectionHtml}
            ${section("state", "State", flagItems.length, flagItems)}
        </div>`;
      })();

  const gridClass = paired ? "bh-doll-grid bh-paired" : "bh-doll-grid";
  const figureStyle = figureSpan ? ` style="${figureSpan}"` : "";
  return `<section class="bh-char-doll" data-char="${escapeHtml(name)}">
        <header class="bh-char-head">
            <span class="bh-char-name">${escapeHtml(name)}</span>
            ${speciesTag}
        </header>
        ${
          isEmpty && !placeholder
            ? `<div class="bh-doll-empty">
                ${silhouetteSvg(perSlot, view, [], family)}
                <p class="bh-empty-text">No tracked state.</p>
            </div>`
            : `<div class="${gridClass}">
                <div class="bh-col bh-col-left">${leftCol}</div>
                <div class="bh-figure"${figureStyle}>
                    ${silhouetteSvg(perSlot, view, holding, family)}
                    <div class="bh-figure-controls">
                        <button class="bh-view-toggle ${view === "back" ? "bh-view-back" : ""}" data-char="${escapeHtml(name)}" data-view="${view}" title="Switch to ${view === "back" ? "front" : "back"} view (for back wounds)">
                            <span class="bh-view-front-label ${view === "front" ? "bh-view-active" : ""}">Front</span>
                            <span class="bh-view-sep">⇄</span>
                            <span class="bh-view-back-label ${view === "back" ? "bh-view-active" : ""}">Back</span>
                        </button>
                    </div>
                    <div class="bh-pov-hint" title="${view === "back" ? "Back view — figure faces away. Your left = character's left." : "Front view — figure faces you. Your left = character's right."}">
                        ${
                          view === "back"
                            ? '<span>L</span><span class="bh-pov-axis">·</span><span>R</span>'
                            : '<span>R</span><span class="bh-pov-axis">·</span><span>L</span>'
                        }
                    </div>
                    ${layoutSwitchHtml()}
                </div>
                <div class="bh-col bh-col-right">${rightCol}</div>
            </div>${digestHtml}`
        }
    </section>`;
}

/**
 * Render character tabs + the active character's doll. State is the full
 * multi-character state object: { name1: charState1, name2: charState2, ... }.
 *
 * `updatedNames` is a Set of character names that changed since last render
 * but the user hasn't yet viewed (i.e., they're not the active tab). Those
 * tabs get an accent dot so testers know other characters' state evolved
 * even while a different tab is foregrounded. CRITICAL for multi-char RP —
 * without this, users assume Beholder only tracks the visible character.
 *
 * Returns { html, activeName }. The caller is responsible for wiring tab
 * clicks; this renderer is pure.
 */
function renderDollPanel(state, activeName, updatedNames, view) {
  const updated = updatedNames || new Set();
  view = view === "back" ? "back" : "front";
  const names = Object.keys(state || {});
  if (!names.length) {
    // No tracked state yet: render a full-size default-human placeholder
    // (visual only) so the panel shows at its real size immediately rather
    // than collapsing to a chip. `placeholder: true` forces the full grid
    // (empty flanking columns + silhouette) instead of the silhouette-only
    // empty view; the muted name + caption + hidden view controls are styled
    // via [data-empty] in style.css. The first AI message / "Build from
    // history" replaces this with real state.
    const doll = renderCharacterDoll("—", {}, view, { placeholder: true });
    return {
      html: `${doll}<p class="bh-placeholder-note">Showing a <b>default human</b> — nothing's tracked yet. It fills in as the scene plays out.</p>`,
      activeName: null,
    };
  }
  // Pick active: requested name if present, else first PRESENT char (an
  // off-screen char shouldn't become active by default), else fall back to
  // first listed.
  const presentNames = names.filter((n) => state[n]?.present !== false);
  const active = activeName && names.includes(activeName) ? activeName : presentNames[0] || names[0];

  const tabs =
    names.length > 1
      ? `<nav class="bh-tabs" aria-label="${escapeHtml(names.length)} characters tracked">
            ${names
              .map((n) => {
                // A char with `present: false` is tracked but off-screen.
                // Tab stays visible (clickable, last-known state preserved)
                // but renders dimmed/italic so a reader can tell at a glance
                // who's in the scene right now versus who's just on the roster.
                const absent = state[n]?.present === false;
                const classes = [
                  "bh-tab",
                  n === active ? "bh-tab-active" : "",
                  updated.has(n) && n !== active ? "bh-tab-updated" : "",
                  absent ? "bh-tab-absent" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const label =
                  updated.has(n) && n !== active
                    ? `${escapeHtml(n)} <span class="bh-tab-pulse" aria-label="updated">●</span>`
                    : escapeHtml(n);
                return `<button class="${classes}" data-char="${escapeHtml(n)}" aria-label="${escapeHtml(n)}${absent ? " (not in scene)" : ""}">${label}</button>`;
              })
              .join("")}
        </nav>`
      : "";

  const doll = renderCharacterDoll(active, state[active] || {}, view);

  return {
    html: `${tabs}<div class="bh-doll-host">${doll}</div>`,
    activeName: active,
  };
}

// ===== 80-dock.js =====
// ── The floating panel ───────────────────────────────────────────────────────
// Ported from the Beholder extension's host shim. The extension injected this
// panel into its host and had to fight for a place on screen; here the host
// mounts us. Desktop keeps the extension's movable workspace behavior inside the
// live roleplay area; mobile uses the host's full-screen panel geometry.

const BH_HOST_CSS = `
.beholder-panel{
  --SmartThemeBlurTintColor: var(--card, rgba(20,20,24,.92));
  --SmartThemeBodyColor: var(--foreground, #e0e0e0);
  --SmartThemeBorderColor: var(--border, rgba(255,255,255,.15));
  --SmartThemeEmColor: var(--marinara-chat-chrome-accent, var(--foreground));
  --SmartThemeQuoteColor: var(--marinara-chat-chrome-accent, var(--foreground));
  --bh-accent-pref: var(--marinara-chat-chrome-accent, var(--foreground));
  --bh-chroma: var(--marinara-chat-chrome-accent, var(--foreground));
  --bh-window-accent: var(--marinara-app-accent-static, var(--primary));
  --bh-font-display: var(--font-sans, inherit);
  box-sizing:border-box; display:flex !important; position:absolute !important;
  top:var(--bh-window-top,1rem) !important; left:var(--bh-window-left,1rem) !important; right:auto !important; bottom:auto !important;
  width:var(--bh-window-width,min(500px,calc(100% - 2rem))) !important; height:var(--bh-window-height,min(620px,calc(100% - 2rem))) !important;
  min-width:0 !important; min-height:0 !important; max-width:none !important; max-height:none !important;
  border-color:var(--bh-window-accent) !important; border-radius:.75rem !important; transform:none !important; z-index:50; }
.beholder-panel.bh-detached{ position:fixed !important; inset:0 !important; width:100vw !important; height:100dvh !important; border-radius:0 !important; }
.beholder-panel.bh-collapsed{ display:none !important; }
.beholder-panel-body{ min-height:0; overflow:hidden; }
.beholder-panel .beholder-close{ display:none !important; }
.beholder-panel .beholder-resize-handle{ display:block !important; left:auto; right:.25rem; bottom:.25rem; transform:none;
  width:1.5rem; height:1.5rem; border:0; border-radius:.25rem; background:transparent; color:var(--bh-window-accent);
  cursor:nwse-resize; opacity:.65; touch-action:none; }
.beholder-panel .beholder-resize-handle::after{ content:""; position:absolute; right:.25rem; bottom:.25rem; width:.625rem; height:.625rem;
  border-right:2px solid currentColor; border-bottom:2px solid currentColor; }
.beholder-panel .beholder-resize-handle:hover{ width:1.5rem; background:var(--bh-surface-2); color:var(--bh-window-accent); opacity:1; }
.beholder-panel-header{ touch-action:none; }
.beholder-panel-controls{ flex-wrap:nowrap; }
.beholder-panel-controls :is(.bh-dock-popout,.bh-dock-close){ box-sizing:border-box; display:inline-flex; width:1.75rem; height:1.75rem; align-items:center; justify-content:center; border:0; border-radius:.375rem;
  padding:0; font-size:.875rem;
  background:transparent; color:var(--bh-window-accent); cursor:pointer; opacity:.8; }
.beholder-panel-controls :is(.bh-dock-popout,.bh-dock-close):hover{ background:var(--bh-surface-2); color:var(--bh-window-accent); opacity:1; }
.beholder-panel-controls :is(.bh-dock-popout,.bh-dock-close):focus-visible{ outline:2px solid var(--bh-window-accent); outline-offset:1px; }
.beholder-panel.bh-detached .bh-dock-popout,.beholder-panel.bh-detached .beholder-resize-handle{ display:none !important; }
@media (max-width:767px){
  .rpg-chat-area.bh-beholder-open{ z-index:70; }
  .beholder-panel{ inset:0 !important; width:100% !important; height:100% !important; max-height:none !important; border-radius:0 !important; z-index:80; }
  .beholder-panel-header{ cursor:default; touch-action:auto; }
  .beholder-panel .beholder-resize-handle{ display:none !important; }
  .beholder-panel-body{ overflow-y:auto; padding-bottom:max(var(--bh-space-4),env(safe-area-inset-bottom)); }
  .beholder-panel.bh-mobile-layout .bh-doll-grid{ display:grid; }
  .beholder-panel.bh-mobile-layout .bh-digest{ display:none; }
}
.bh-hud-toggle{ cursor:pointer; }
.bh-hud-icon{ display:block;width:.875rem;height:.875rem;color:var(--marinara-app-accent-solid,var(--primary)); }
.bh-tracker-launch{display:flex;width:100%;min-height:1.75rem;align-items:center;gap:.25rem;
  border:0;border-bottom:1px solid var(--border);background:var(--tracker-panel-section-background,transparent);
  padding:.125rem .25rem;color:var(--foreground);cursor:pointer;font:inherit;text-align:left;}
.bh-tracker-launch:hover{background:color-mix(in srgb,var(--accent) 18%,transparent);}
.bh-tracker-launch.bh-active{background:color-mix(in srgb,var(--marinara-chat-chrome-accent,var(--foreground)) 14%,transparent);}
.bh-tracker-launch:focus-visible{outline:2px solid var(--marinara-chat-chrome-accent,var(--foreground));outline-offset:-2px;}
.bh-tracker-launch__logo{display:flex;width:.875rem;height:.875rem;align-items:center;justify-content:center;color:var(--tracker-profile-icon,var(--muted-foreground));opacity:.75;}
.bh-tracker-launch__icon{display:block;width:.6875rem;height:.6875rem;}
.bh-tracker-launch__title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:.625rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--foreground) 62%,transparent);}
.bh-tracker-launch__arrow{display:flex;width:.75rem;height:.875rem;align-items:center;justify-content:center;color:var(--tracker-profile-icon,var(--muted-foreground));font-size:.875rem;opacity:.6;transform:rotate(0deg);transition:transform 150ms ease;}
.bh-tracker-launch.bh-active .bh-tracker-launch__arrow{transform:rotate(90deg);}
.beholder-panel:not(.bh-mobile-layout):not(.bh-layout-compact) .bh-doll-grid{display:grid;}
.beholder-panel:not(.bh-mobile-layout):not(.bh-layout-compact) .bh-digest{display:none;}
`;

const BH_LAYER_KEYS = ["color", "damage", "wounds"];
const BH_LAYOUTS = ["paired", "columns", "list"];
const BH_LAYOUT_KEY = "marinara.beholder.layout";
const BH_LAYERS_KEY = "marinara.beholder.viewLayers";
const BH_WINDOW_KEY = "marinara.beholder.window";
const BH_WINDOW_MARGIN = 12;
const BH_WINDOW_MIN_WIDTH = 280;
const BH_WINDOW_MIN_HEIGHT = 260;
const BH_WINDOW_DEFAULT_WIDTH = 500;
const BH_WINDOW_DEFAULT_HEIGHT = 620;
const BH_WINDOW_MIN_SCALE = 0.24;
const BH_WINDOW_MAX_SCALE = 1.35;
const BH_THEME_VARIABLES = [
  "--background",
  "--foreground",
  "--card",
  "--border",
  "--accent",
  "--primary",
  "--ring",
  "--muted",
  "--muted-foreground",
  "--popover",
  "--font-sans",
  "--marinara-app-accent-solid",
  "--marinara-app-accent-static",
  "--marinara-chat-chrome-accent",
];

const clampWindowValue = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

BH.readLayout = function readLayout() {
  try {
    const stored = window.localStorage.getItem(BH_LAYOUT_KEY);
    if (BH_LAYOUTS.includes(stored)) return stored;
  } catch {
    // A blocked storage read must not break the dock.
  }
  return "paired";
};

BH.readLayers = function readLayers() {
  const layers = { color: true, damage: true, wounds: true };
  try {
    const raw = JSON.parse(window.localStorage.getItem(BH_LAYERS_KEY) || "null");
    if (raw && typeof raw === "object") {
      for (const key of BH_LAYER_KEYS) if (typeof raw[key] === "boolean") layers[key] = raw[key];
    }
  } catch {
    // Fall back to all layers on.
  }
  return layers;
};

BH.readWindowGeometry = function readWindowGeometry() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(BH_WINDOW_KEY) || "null");
    if (stored && [stored.left, stored.top, stored.width, stored.height].every((value) => Number.isFinite(value))) {
      return stored;
    }
  } catch {
    // A blocked or stale storage value falls back to the default placement.
  }
  return null;
};

BH.writeSetting = function writeSetting(key, value) {
  try {
    window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // Persisting is a convenience; the session still works without it.
  }
};

/**
 * One floating panel per document, shared by every element instance.
 *
 * The host may mount the toolbar element more than once across a session (chat
 * switches, version bumps, error retries), so the panel and its state live in
 * module scope and survive remounts, exactly as the extension's did.
 */
BH.dock = {
  panel: null,
  props: null,
  state: {},
  chatId: null,
  activeName: null,
  layout: BH.readLayout(),
  layers: BH.readLayers(),
  geometry: BH.readWindowGeometry(),
  viewByChar: new Map(),
  unviewed: new Set(),
  hostElements: new Set(),
  hostArea: null,
  detachedWindow: null,
  _windowBound: false,
  _interaction: null,
  _boundsObserver: null,
  _detachedResize: null,

  registerHost(element) {
    const area = element.closest?.(".rpg-chat-area");
    if (!area) return;
    this.hostElements.add(element);
    this.hostArea = area;
    if (this.panel && !this.isDetached() && this.panel.parentElement !== area) area.appendChild(this.panel);
    this.observeBounds();
    this.syncGeometry();
  },

  releaseHost(element) {
    this.hostElements.delete(element);
    requestAnimationFrame(() => {
      for (const host of this.hostElements) if (!host.isConnected) this.hostElements.delete(host);
      if (this.hostElements.size === 0 && !this.isDetached()) this.close();
    });
  },

  findChatArea() {
    if (this.hostArea?.isConnected) return this.hostArea;
    this.hostArea =
      Array.from(document.querySelectorAll(".rpg-chat-area")).find((area) => {
        const rect = area.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      }) || null;
    return this.hostArea;
  },

  isDetached() {
    return (
      !!this.detachedWindow && !this.detachedWindow.closed && this.panel?.ownerDocument === this.detachedWindow.document
    );
  },

  /** Build the panel once. Markup is the extension's, so style.css applies unchanged. */
  ensure() {
    if (this.panel?.isConnected) return this.panel;
    const hostArea = this.findChatArea();
    if (!hostArea) return null;
    BH.ensureStyles();
    const panel = document.createElement("div");
    panel.id = BH.PANEL_ID;
    panel.className = "beholder-panel bh-collapsed";
    panel.setAttribute("data-empty", "true");
    // data-chat-floating-panel keeps host keyboard shortcuts off our controls.
    panel.setAttribute("data-chat-floating-panel", "");
    const say = (key, fallback) => BH.escapeHtml(BH.localize(this.props, key, fallback));
    panel.innerHTML = `
      <div class="beholder-panel-header">
        <span class="beholder-panel-title">${say("dockTitle", "Beholder")}</span>
        <span class="beholder-panel-controls"><button type="button" class="bh-dock-popout fa-solid fa-arrow-up-right-from-square" title="${say("dockPopOut", "Open Beholder in a new tab")}" aria-label="${say("dockPopOut", "Open Beholder in a new tab")}"></button><button type="button" class="bh-dock-close fa-solid fa-xmark" title="${say("dockClose", "Close Beholder")}" aria-label="${say("dockClose", "Close Beholder")}"></button></span>
      </div>
      <div class="beholder-layer-bar" role="group" aria-label="${say("layerBarLabel", "Detail layers")}">
        <label class="bh-layer-cell" data-layer="color" title="${say("layerColorHint", "Color word annotation on chips")}"><input type="checkbox" name="bh-view-layer" value="color"><span>${say("layerColor", "Color")}</span></label>
        <label class="bh-layer-cell" data-layer="damage" title="${say("layerDamageHint", "Damage-tier visuals + damage word")}"><input type="checkbox" name="bh-view-layer" value="damage"><span>${say("layerDamage", "Damage")}</span></label>
        <label class="bh-layer-cell" data-layer="wounds" title="${say("layerWoundsHint", "Wounds, bleeding, severity")}"><input type="checkbox" name="bh-view-layer" value="wounds"><span>${say("layerWounds", "Wounds")}</span></label>
      </div>
      <div class="beholder-panel-body"></div>
      <button type="button" class="beholder-resize-handle" title="${say("resizeWindow", "Resize Beholder")}" aria-label="${say("resizeWindow", "Resize Beholder")}"></button>`;
    hostArea.appendChild(panel);
    this.panel = panel;
    document.body.classList.remove("bh-dock-open");

    panel.querySelector(".bh-dock-close").addEventListener("click", () => this.close());
    panel.querySelector(".bh-dock-popout").addEventListener("click", () => this.popOut());
    panel.querySelector(".beholder-panel-header").addEventListener("pointerdown", (event) => {
      this.startInteraction("move", event);
    });
    const resizeHandle = panel.querySelector(".beholder-resize-handle");
    resizeHandle.addEventListener("pointerdown", (event) => {
      this.startInteraction("resize", event);
    });
    resizeHandle.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 48 : 16;
      const delta = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[event.key];
      if (!delta) return;
      event.preventDefault();
      this.resizeBy(delta[0], delta[1]);
    });
    panel.addEventListener("change", (event) => {
      const input = event.target.closest('input[name="bh-view-layer"]');
      if (!input) return;
      this.layers = { ...this.layers, [input.value]: input.checked };
      BH.writeSetting(BH_LAYERS_KEY, this.layers);
      this.applyLayers();
    });
    // The doll emits its own controls; delegate so they drive dock state. The
    // view toggle also carries data-char, so it is matched before the tabs.
    panel.addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest(".bh-view-toggle")) {
        const name = this.activeName;
        if (name) this.viewByChar.set(name, this.viewByChar.get(name) === "back" ? "front" : "back");
        this.render();
        return;
      }
      const layoutButton = target.closest("[data-layout]");
      if (layoutButton && BH_LAYOUTS.includes(layoutButton.dataset.layout)) {
        this.layout = layoutButton.dataset.layout;
        BH.writeSetting(BH_LAYOUT_KEY, this.layout);
        this.render();
        return;
      }
      const tab = target.closest("button[data-char]");
      if (tab && tab.dataset.char) {
        this.activeName = tab.dataset.char;
        this.render();
      }
    });

    this.applyLayers();
    this.syncGeometry();
    this.observeBounds();
    if (!this._windowBound) {
      this._windowBound = true;
      let frame = 0;
      window.addEventListener("resize", () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          this.syncGeometry();
          this.render();
        });
      });
    }
    return panel;
  },

  applyLayers() {
    if (!this.panel) return;
    for (const key of BH_LAYER_KEYS) this.panel.classList.toggle(`bh-hide-${key}`, !this.layers[key]);
    for (const input of this.panel.querySelectorAll('input[name="bh-view-layer"]')) {
      input.checked = !!this.layers[input.value];
    }
  },

  isOpen() {
    return !!this.panel && !this.panel.classList.contains("bh-collapsed");
  },

  toggle() {
    const panel = this.ensure();
    if (!panel) return;
    if (this.isDetached()) {
      this.detachedWindow.focus();
      return;
    }
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.syncGeometry();
    panel.classList.remove("bh-collapsed");
    this.syncHostLayer();
    BH.syncToggles();
    void this.refresh();
  },

  close() {
    if (this.isDetached()) {
      const popup = this.detachedWindow;
      this.restoreFromDetached();
      popup.close();
      return;
    }
    if (this.panel) this.panel.classList.add("bh-collapsed");
    this.syncHostLayer();
    BH.syncToggles();
  },

  syncHostLayer() {
    this.findChatArea()?.classList.toggle("bh-beholder-open", this.isOpen() && !this.isDetached());
  },

  isMobile() {
    return window.matchMedia("(max-width: 767px)").matches;
  },

  getChatBounds() {
    if (this.isDetached()) {
      return { left: 0, top: 0, right: this.detachedWindow.innerWidth, bottom: this.detachedWindow.innerHeight };
    }
    const area = this.findChatArea();
    if (!area) return null;
    const rect = area.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return null;
    return { left: 0, top: 0, right: area.clientWidth, bottom: area.clientHeight };
  },

  applyScale(width, height) {
    if (!this.panel) return 1;
    const scale = clampWindowValue(
      Math.min(width / BH_WINDOW_DEFAULT_WIDTH, height / BH_WINDOW_DEFAULT_HEIGHT),
      BH_WINDOW_MIN_SCALE,
      BH_WINDOW_MAX_SCALE,
    );
    this.panel.style.setProperty("--bh-ui-scale", scale.toFixed(3));
    return scale;
  },

  fitDesktopContent() {
    const panel = this.panel;
    if (!panel || (!this.isDetached() && this.isMobile())) return;
    const body = panel.querySelector(".beholder-panel-body");
    if (!body) return;
    const rect = panel.getBoundingClientRect();
    let scale = this.applyScale(rect.width, rect.height);
    for (let pass = 0; pass < 2; pass += 1) {
      const widthRatio = body.clientWidth / Math.max(body.scrollWidth, 1);
      const heightRatio = body.clientHeight / Math.max(body.scrollHeight, 1);
      const fit = Math.min(1, widthRatio, heightRatio);
      if (fit >= 0.995) break;
      scale = clampWindowValue(scale * fit, BH_WINDOW_MIN_SCALE, BH_WINDOW_MAX_SCALE);
      panel.style.setProperty("--bh-ui-scale", scale.toFixed(3));
    }
  },

  applyGeometry(geometry) {
    const panel = this.panel;
    if (!panel) return;
    panel.style.setProperty("--bh-window-left", `${Math.round(geometry.left)}px`);
    panel.style.setProperty("--bh-window-top", `${Math.round(geometry.top)}px`);
    panel.style.setProperty("--bh-window-width", `${Math.round(geometry.width)}px`);
    panel.style.setProperty("--bh-window-height", `${Math.round(geometry.height)}px`);
    this.applyScale(geometry.width, geometry.height);
  },

  syncGeometry() {
    const panel = this.panel;
    if (!panel) return;
    const bounds = this.getChatBounds();
    if (!bounds) {
      if (this.isOpen() && !this.isDetached()) this.close();
      return;
    }
    if (this.isDetached()) {
      panel.classList.remove("bh-mobile-layout");
      this.applyScale(bounds.right, bounds.bottom);
      return;
    }
    if (this.isMobile()) {
      panel.classList.add("bh-mobile-layout");
      this.applyScale(bounds.right, bounds.bottom);
      return;
    }
    panel.classList.remove("bh-mobile-layout");

    const availableWidth = Math.max(1, bounds.right - bounds.left);
    const availableHeight = Math.max(1, bounds.bottom - bounds.top);
    const margin = Math.min(BH_WINDOW_MARGIN, availableWidth / 4, availableHeight / 4);
    const maxWidth = Math.max(1, availableWidth - margin * 2);
    const maxHeight = Math.max(1, availableHeight - margin * 2);
    const minWidth = Math.min(BH_WINDOW_MIN_WIDTH, maxWidth);
    const minHeight = Math.min(BH_WINDOW_MIN_HEIGHT, maxHeight);
    const width = clampWindowValue(this.geometry?.width ?? BH_WINDOW_DEFAULT_WIDTH, minWidth, maxWidth);
    const height = clampWindowValue(this.geometry?.height ?? BH_WINDOW_DEFAULT_HEIGHT, minHeight, maxHeight);
    const defaultLeft = bounds.right - margin - width;
    const defaultTop = bounds.top + margin;
    const left = clampWindowValue(
      this.geometry?.left ?? defaultLeft,
      bounds.left + margin,
      bounds.right - margin - width,
    );
    const top = clampWindowValue(
      this.geometry?.top ?? defaultTop,
      bounds.top + margin,
      bounds.bottom - margin - height,
    );
    this.geometry = { left, top, width, height };
    this.applyGeometry(this.geometry);
  },

  observeBounds() {
    if (typeof ResizeObserver !== "function") return;
    this._boundsObserver?.disconnect();
    this._boundsObserver = new ResizeObserver(() => {
      this.syncGeometry();
      this.render();
    });
    const area = this.findChatArea();
    if (area) this._boundsObserver.observe(area);
  },

  popOut() {
    const panel = this.ensure();
    if (!panel || this.isDetached()) return;
    const popup = window.open("", "_blank");
    if (!popup) return;
    const popupDocument = popup.document;
    popupDocument.title = BH.localize(this.props, "dockTitle", "Beholder");
    popupDocument.documentElement.lang = document.documentElement.lang || "en";
    popupDocument.documentElement.dir = document.documentElement.dir || "ltr";
    const sourceTheme = getComputedStyle(this.findChatArea() || document.documentElement);
    for (const variable of BH_THEME_VARIABLES) {
      const value = sourceTheme.getPropertyValue(variable);
      if (value) popupDocument.documentElement.style.setProperty(variable, value);
    }
    popupDocument.documentElement.style.colorScheme = getComputedStyle(document.documentElement).colorScheme;
    popupDocument.body.replaceChildren();
    popupDocument.body.style.margin = "0";
    popupDocument.body.style.overflow = "hidden";
    popupDocument.body.style.background = "var(--background, #111)";
    popupDocument.body.style.color = "var(--foreground, #eee)";
    popupDocument.body.style.fontFamily = sourceTheme.fontFamily;
    BH.ensureStyles(popupDocument);

    panel.classList.add("bh-detached");
    popupDocument.body.appendChild(panel);
    this.detachedWindow = popup;
    this.syncHostLayer();
    this._detachedResize = () => {
      this.syncGeometry();
      this.render();
    };
    popup.addEventListener("resize", this._detachedResize);
    popup.addEventListener("beforeunload", () => this.restoreFromDetached(), { once: true });
    this.syncGeometry();
    this.render();
    popup.focus();
  },

  restoreFromDetached() {
    const popup = this.detachedWindow;
    const panel = this.panel;
    if (!popup || !panel) return;
    if (this._detachedResize) popup.removeEventListener("resize", this._detachedResize);
    this._detachedResize = null;
    this.detachedWindow = null;
    panel.classList.remove("bh-detached");
    const hostArea = this.findChatArea();
    if (hostArea) {
      hostArea.appendChild(panel);
      panel.classList.add("bh-collapsed");
      this.syncHostLayer();
      this.syncGeometry();
    } else {
      panel.remove();
      this.panel = null;
    }
    BH.syncToggles();
  },

  resizeBy(deltaWidth, deltaHeight) {
    if (this.isMobile()) return;
    this.syncGeometry();
    const bounds = this.getChatBounds();
    if (!bounds) return;
    const geometry = this.geometry;
    if (!geometry) return;
    const margin = Math.min(BH_WINDOW_MARGIN, (bounds.right - bounds.left) / 4, (bounds.bottom - bounds.top) / 4);
    const maxWidth = Math.max(1, bounds.right - margin - geometry.left);
    const maxHeight = Math.max(1, bounds.bottom - margin - geometry.top);
    this.geometry = {
      ...geometry,
      width: clampWindowValue(geometry.width + deltaWidth, Math.min(BH_WINDOW_MIN_WIDTH, maxWidth), maxWidth),
      height: clampWindowValue(geometry.height + deltaHeight, Math.min(BH_WINDOW_MIN_HEIGHT, maxHeight), maxHeight),
    };
    this.applyGeometry(this.geometry);
    BH.writeSetting(BH_WINDOW_KEY, this.geometry);
    this.render();
  },

  startInteraction(kind, event) {
    if (this.isMobile() || this.isDetached() || event.button !== 0 || !this.panel) return;
    const target = event.target instanceof Element ? event.target : null;
    if (kind === "move" && target?.closest("button, input, label, select, textarea, a")) return;
    event.preventDefault();
    this._interaction?.();

    const pointerId = event.pointerId;
    const start = {
      x: event.clientX,
      y: event.clientY,
      left: this.geometry?.left ?? this.panel.offsetLeft,
      top: this.geometry?.top ?? this.panel.offsetTop,
      width: this.panel.offsetWidth,
      height: this.panel.offsetHeight,
    };
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = kind === "move" ? "move" : "nwse-resize";
    document.body.style.userSelect = "none";
    this.panel.classList.add(kind === "move" ? "beholder-dragging" : "beholder-resizing");

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const bounds = this.getChatBounds();
      if (!bounds) return;
      const margin = Math.min(BH_WINDOW_MARGIN, (bounds.right - bounds.left) / 4, (bounds.bottom - bounds.top) / 4);
      const deltaX = moveEvent.clientX - start.x;
      const deltaY = moveEvent.clientY - start.y;
      if (kind === "move") {
        const left = clampWindowValue(start.left + deltaX, bounds.left + margin, bounds.right - margin - start.width);
        const top = clampWindowValue(start.top + deltaY, bounds.top + margin, bounds.bottom - margin - start.height);
        this.geometry = { left, top, width: start.width, height: start.height };
      } else {
        const maxWidth = Math.max(1, bounds.right - margin - start.left);
        const maxHeight = Math.max(1, bounds.bottom - margin - start.top);
        this.geometry = {
          left: start.left,
          top: start.top,
          width: clampWindowValue(start.width + deltaX, Math.min(BH_WINDOW_MIN_WIDTH, maxWidth), maxWidth),
          height: clampWindowValue(start.height + deltaY, Math.min(BH_WINDOW_MIN_HEIGHT, maxHeight), maxHeight),
        };
      }
      this.applyGeometry(this.geometry);
    };

    const finish = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      this.panel?.classList.remove("beholder-dragging", "beholder-resizing");
      if (this.geometry) BH.writeSetting(BH_WINDOW_KEY, this.geometry);
      this.render();
      this._interaction = null;
    };
    const onEnd = (endEvent) => {
      if (endEvent.pointerId === pointerId) finish();
    };
    this._interaction = finish;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  },

  /** Point the dock at a chat. Switching chats drops per-chat view memory. */
  setChat(chatId) {
    if (this.chatId === chatId) return;
    this.chatId = chatId;
    this.state = {};
    this.activeName = null;
    this.viewByChar.clear();
    this.unviewed.clear();
    this.observeBounds();
    if (this.panel) this.render();
    if (this.isOpen()) void this.refresh();
  },

  async refresh() {
    const chatId = this.chatId;
    if (!chatId) return;
    try {
      const next = await BH.fetchState(chatId);
      if (this.chatId !== chatId) return; // chat switched mid-flight
      this.adopt(next);
    } catch (error) {
      // A read failure leaves the last known doll on screen; the next turn retries.
      console.warn("[beholder] state refresh failed", error);
    }
  },

  /** Mark characters whose state changed since the last render, then draw. */
  adopt(next) {
    const previous = this.state || {};
    for (const [name, value] of Object.entries(next)) {
      const before = previous[name];
      if (!before || JSON.stringify(before) !== JSON.stringify(value)) this.unviewed.add(name);
    }
    for (const name of [...this.unviewed]) if (!(name in next)) this.unviewed.delete(name);
    this.state = next;
    this.render();
  },

  render() {
    const panel = this.panel;
    if (!panel) return;
    const body = panel.querySelector(".beholder-panel-body");
    if (!body) return;

    // No state renders the full-size default-human placeholder built by the
    // renderer rather than collapsing to a chip, so the panel shows at its real
    // size immediately. data-empty only mutes the placeholder's name + caption.
    const isEmpty = Object.keys(this.state).length === 0;
    panel.setAttribute("data-empty", isEmpty ? "true" : "false");
    if (isEmpty) this.unviewed.clear();

    // The full-screen mobile window keeps the paper doll visible and scales it
    // to the viewport. Resizable desktop windows retain the selected layout.
    const layout = !this.isDetached() && this.isMobile() ? "paired" : this.layout;
    setDollLayout(layout);
    panel.classList.toggle("bh-layout-compact", layout === "list");
    panel.classList.toggle("bh-mobile-layout", !this.isDetached() && this.isMobile());

    // The active character's updates are viewed by definition.
    const unviewedForRender = new Set(this.unviewed);
    if (this.activeName) unviewedForRender.delete(this.activeName);
    const view = this.activeName ? this.viewByChar.get(this.activeName) || "front" : "front";
    const rendered = renderDollPanel(this.state, this.activeName, unviewedForRender, view);
    this.activeName = rendered.activeName;
    if (this.activeName) this.unviewed.delete(this.activeName);
    body.innerHTML = rendered.html || "";
    this.fitDesktopContent();
  },
};

// ===== 90-element.js =====
// ── Custom element ───────────────────────────────────────────────────────────
// The host mounts <marinara-capability-beholder view="toolbar"> in the roleplay
// toolbar for every chat where the Beholder agent is switched on, and assigns
// node.capabilityProps before dispatching marinara-capability-props. The element
// is only the button; the panel it opens lives in module scope (BH.dock) so it
// survives the remounts the host performs on chat switch, version bump, or retry.

const bhEyeIcon = (className) =>
  `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7C3.7 7.6 7.64 5 12 5c4.36 0 8.3 2.6 9.94 6.65a1 1 0 0 1 0 .7C20.3 16.4 16.36 19 12 19c-4.36 0-8.3-2.6-9.94-6.65Z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** Keep every mounted toggle's pressed state in step with the dock. */
BH.syncToggles = function syncToggles() {
  const open = BH.dock.isOpen();
  for (const button of document.querySelectorAll(".bh-hud-toggle,.bh-tracker-launch")) {
    button.setAttribute("aria-pressed", open ? "true" : "false");
    button.classList.toggle("bh-active", open);
  }
};

// The extractor runs server-side after the turn completes, so the state lands a
// few seconds after generation does. Re-read on a short schedule and stop as
// soon as the state changes, rather than polling for the life of the chat.
const BH_REFRESH_DELAYS = [0, 2000, 5000, 9000];
let bhRefreshTimers = [];
BH.dock.refreshSoon = function refreshSoon() {
  for (const timer of bhRefreshTimers) clearTimeout(timer);
  bhRefreshTimers = [];
  const before = JSON.stringify(this.state);
  for (const delay of BH_REFRESH_DELAYS) {
    bhRefreshTimers.push(
      setTimeout(async () => {
        await this.refresh();
        // Landed: drop the remaining attempts.
        if (JSON.stringify(this.state) !== before) {
          for (const timer of bhRefreshTimers) clearTimeout(timer);
          bhRefreshTimers = [];
        }
      }, delay),
    );
  }
};

let bhGenerationBound = false;
function bindGenerationListener() {
  if (bhGenerationBound) return;
  bhGenerationBound = true;
  window.addEventListener("marinara:generation-complete", (event) => {
    const chatId = event?.detail?.chatId;
    if (chatId && chatId === BH.dock.chatId) BH.dock.refreshSoon();
  });
}

class BeholderElement extends HTMLElement {
  constructor() {
    super();
    this._props = null;
    this._onPropsEvent = () => this._sync();
  }

  // The host assigns capabilityProps then dispatches the event; support both the
  // accessor and the event so either ordering works.
  set capabilityProps(value) {
    this._props = value;
    this._sync();
  }

  get capabilityProps() {
    return this._props;
  }

  static get observedAttributes() {
    return ["view"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "view" && oldValue !== newValue) this._sync();
  }

  connectedCallback() {
    this.addEventListener("marinara-capability-props", this._onPropsEvent);
    BH.dock.registerHost(this);
    bindGenerationListener();
    this._sync();
  }

  disconnectedCallback() {
    this.removeEventListener("marinara-capability-props", this._onPropsEvent);
    BH.dock.releaseHost(this);
  }

  _sync() {
    try {
      const view = this.getAttribute("view");
      if (view !== "toolbar" && view !== "tracker") return;
      const props = this._props;
      if (!props || typeof props.chatId !== "string") return;
      BH.ensureStyles();
      BH.dock.props = props;
      BH.dock.setChat(props.chatId);
      if (view === "tracker") this._renderTrackerButton(props);
      else this._renderToggle(props);
    } catch (error) {
      BH.fail(this, error);
    }
  }

  _renderToggle(props) {
    let button = this._button;
    if (!button || !this.contains(button) || !button.classList.contains("bh-hud-toggle")) {
      button = document.createElement("button");
      button.type = "button";
      // The extension had to clone a live toolbar button's classes to match the
      // host's controls; here the host hands us the class it uses itself.
      button.innerHTML = bhEyeIcon("bh-hud-icon");
      button.addEventListener("click", () => {
        BH.dock.toggle();
      });
      this.replaceChildren(button);
      this._button = button;
    }
    const hostClass = typeof props.toolbarButtonClass === "string" ? props.toolbarButtonClass : "";
    button.className = `${hostClass} mari-accent-animated bh-hud-toggle`.trim();
    const label = BH.localize(props, "toolbarLabel", "Beholder");
    button.title = label;
    button.setAttribute("aria-label", label);
    BH.syncToggles();
  }

  _renderTrackerButton(props) {
    let button = this._button;
    if (!button || !this.contains(button) || !button.classList.contains("bh-tracker-launch")) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "bh-tracker-launch";
      button.innerHTML = `<span class="bh-tracker-launch__arrow" aria-hidden="true">›</span><span class="bh-tracker-launch__logo" aria-hidden="true">${bhEyeIcon("bh-tracker-launch__icon")}</span><span class="bh-tracker-launch__title">Beholder</span>`;
      button.addEventListener("click", () => BH.dock.toggle());
      this.replaceChildren(button);
      this._button = button;
    }
    const label = BH.localize(props, "trackerPanelLabel", "Open Beholder");
    button.title = label;
    button.setAttribute("aria-label", label);
    BH.syncToggles();
  }
}

const BH_TAG = "marinara-capability-beholder";
if (!customElements.get(BH_TAG)) customElements.define(BH_TAG, BeholderElement);

})();
