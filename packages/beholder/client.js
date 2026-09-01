// Beholder 1.3.9 — Marinara Engine roleplay-toolbar capability (single-file client bundle)
// Built from packages/beholder/src (22 modules) by scripts/build-beholder-package.mjs. Do not edit; edit src/ and rebuild.
(() => {
"use strict";
const BH_STYLE_CSS = "/* Beholder extension — settings drawer + floating state panel + paper-doll mode\n   ─────────────────────────────────────────────────────────────────────────\n   Design system: \"Tactical Codex\" — refined editorial dark-mode UI.\n   - Cinzel for headings (panel title, char name) — engraved nameplate feel\n   - JetBrains Mono for data labels (slot names, drawer section caps, gauges)\n   - Body inherits host font\n   - Type/space/color tokens declared on .beholder-panel ↓\n   ───────────────────────────────────────────────────────────────────────── */\n\n/* Remote webfont @import removed for packaging: a catalog package must not\n   fetch from third-party hosts. Display face falls back to var(--font-sans). */\n/* Settings drawer — grouped sections with helper text. */\n#beholder_settings small.opacity50p {\n    display: block;\n    margin-top: 6px;\n    opacity: 0.6;\n    font-size: 0.85em;\n}\n.bh-settings-main-toggle {\n    padding: 6px 8px;\n    margin-bottom: 6px;\n    background: rgba(255, 255, 255, 0.025);\n    border: 1px solid rgba(255, 255, 255, 0.08);\n    border-radius: 6px;\n}\n.bh-settings-section {\n    margin: 8px 0;\n    padding: 0;\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.08));\n    border-radius: 6px;\n    background: rgba(255, 255, 255, 0.015);\n}\n.bh-settings-section > summary {\n    cursor: pointer;\n    padding: 7px 10px;\n    list-style: none;\n    user-select: none;\n    font-size: 0.95em;\n    border-radius: 6px;\n    position: relative;\n    padding-right: 24px;\n}\n.bh-settings-section > summary::-webkit-details-marker { display: none; }\n.bh-settings-section > summary::after {\n    content: \"›\";\n    position: absolute;\n    right: 12px;\n    top: 50%;\n    transform: translateY(-50%) rotate(0deg);\n    transition: transform 0.18s;\n    opacity: 0.5;\n    font-size: 1.2em;\n}\n.bh-settings-section[open] > summary::after {\n    transform: translateY(-50%) rotate(90deg);\n}\n.bh-settings-section > summary b { color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary))); }\n.bh-settings-body {\n    padding: 0 10px 10px;\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n}\n.bh-settings-body label:not(.checkbox_label) {\n    font-size: 0.88em;\n    opacity: 0.85;\n    margin-top: 6px;\n}\n.bh-settings-body .checkbox_label { margin-top: 6px; }\n.bh-help {\n    display: block;\n    margin-top: 2px;\n    margin-bottom: 4px;\n    opacity: 0.55;\n    font-size: 0.78em;\n    line-height: 1.4;\n}\n.bh-help-inline {\n    margin-left: 4px;\n    opacity: 0.6;\n    font-size: 0.85em;\n    font-weight: normal;\n    font-style: italic;\n}\n.bh-help code,\n.bh-settings-body code {\n    background: rgba(255, 255, 255, 0.06);\n    padding: 1px 5px;\n    border-radius: 3px;\n    font-size: 0.92em;\n}\n.bh-settings-buttons {\n    gap: 6px;\n    margin-top: 8px;\n}\n\n/* ─── Floating state panel ────────────────────────────────────────────── */\n\n.beholder-panel {\n    position: fixed;\n    z-index: 9000;\n    width: min(420px, calc(100vw - 40px));\n    max-height: 86vh;\n    min-width: 240px;\n    min-height: 180px;\n    /* Fixed-width panel (no resize). Container queries below auto-switch\n       to the single-column list layout when the panel is narrow. */\n    overflow: hidden;\n    display: flex;\n    flex-direction: column;\n    background: var(--SmartThemeBlurTintColor, rgba(20, 20, 24, 0.92));\n    color: var(--SmartThemeBodyColor, #e0e0e0);\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.15));\n    border-radius: 12px;\n    box-shadow:\n        0 1px 0 rgba(255, 255, 255, 0.05) inset,\n        0 12px 40px rgba(0, 0, 0, 0.5);\n    backdrop-filter: blur(10px);\n    -webkit-backdrop-filter: blur(10px);\n    user-select: none;\n\n    /* ────── DESIGN TOKENS ──────────────────────────────────────────────\n       Every panel-scoped value should reference one of these. Adding a\n       new font-size or padding without a token is a design-system bug. */\n\n    /* Master scale knob. The host updates it from the floating window's\n       available width and height so chrome, cards, and the doll scale together. */\n    --bh-ui-scale: 1.1;\n    font-size: calc(0.875em * var(--bh-ui-scale));\n\n    /* Type ramp (em, relative to panel base). Five steps, named by role —\n       NOT by size. Use the role, not the number, when picking. */\n    --bh-text-meta:      0.78em;   /* slot caps, POV hint, tab pulse */\n    --bh-text-secondary: 0.875em;  /* species, gauge label, drawer hint */\n    --bh-text-body:      1em;      /* chips, tabs, drawer buttons */\n    --bh-text-large:     1.143em;  /* panel title, gauge value, drawer focus */\n    --bh-text-display:   1.357em;  /* char name */\n\n    /* Font families. Scoped via `font-family: var(--bh-font-display)` etc.\n       so the host site's body font keeps governing default text — these\n       only apply where we explicitly opt in. */\n    --bh-font-display: \"Cinzel\", \"Trajan Pro\", \"Georgia\", serif;\n    --bh-font-data:    \"JetBrains Mono\", \"SF Mono\", \"Menlo\", \"Consolas\", monospace;\n\n    /* Spacing scale — multiples of 4. Em-based so it co-scales with the type. */\n    --bh-space-1: 0.286em;   /*  4px @ 14px base */\n    --bh-space-2: 0.571em;   /*  8px */\n    --bh-space-3: 0.857em;   /* 12px */\n    --bh-space-4: 1.143em;   /* 16px */\n    --bh-space-5: 1.714em;   /* 24px */\n\n    /* Color roles — neutrals layered over the host theme background. Used\n       for elevated/inset surfaces and divider strengths. */\n    --bh-surface-1: rgba(255, 255, 255, 0.025);  /* inset (drawer, gauge bg) */\n    --bh-surface-2: rgba(255, 255, 255, 0.05);   /* elevated (header, hover) */\n    --bh-surface-3: rgba(255, 255, 255, 0.085);  /* pressed / active control */\n    --bh-divider:   rgba(255, 255, 255, 0.08);   /* hairline dividers */\n    --bh-border:    rgba(255, 255, 255, 0.18);   /* control borders, focus */\n\n    /* Opacity roles — apply via opacity: var(...) for consistent muting. */\n    --bh-mute-strong: 0.45;  /* meta, POV hint */\n    --bh-mute-soft:   0.7;   /* secondary text */\n    --bh-mute-none:   1;     /* primary */\n}\n/* When user has manually resized, drop the max-height cap so their size sticks. */\n.beholder-panel[data-resized=\"true\"] {\n    max-height: none;\n}\n\n/* (Legacy data-mode rules removed — only one layout now. Mobile is\n   handled via @container query below.) */\n\n/* No tracked state renders a full-size default-human placeholder (same width +\n   chrome as a populated panel) so the extension shows at its real size on first\n   open, with all header tools visible. data-empty only mutes the placeholder\n   name + caption and drops its interactive view controls (it's visual-only\n   until real state arrives). */\n.beholder-panel[data-empty=\"true\"] .bh-char-name {\n    opacity: 0.4;\n}\n.beholder-panel[data-empty=\"true\"] .bh-figure-controls {\n    display: none;\n}\n.bh-placeholder-note {\n    margin: 14px 14px 6px;\n    padding: 10px 14px;\n    text-align: center;\n    font-size: var(--bh-text-secondary);\n    line-height: 1.5;\n    color: var(--bh-gold, var(--bh-chroma, var(--primary)));\n    background: linear-gradient(160deg, color-mix(in srgb, var(--bh-accent) 14%, transparent), color-mix(in srgb, var(--bh-accent) 4%, transparent));\n    border: 1px solid color-mix(in srgb, var(--bh-accent) 40%, transparent);\n    border-radius: 8px;\n}\n.bh-placeholder-note b { color: var(--bh-chroma, var(--primary)); font-weight: 600; }\n\n/* Note/intent bar mounted above the chat input: input grows, the apply button\n   sits to its right (not stacked under). */\n.beholder-notebox {\n    display: flex;\n    gap: var(--bh-space-2, 6px);\n    align-items: stretch;\n    margin: 4px 0;\n}\n.beholder-notebox .beholder-notebox-input { flex: 1 1 auto; min-width: 0; }\n.beholder-notebox .beholder-notebox-btn { flex: 0 0 auto; }\n\n/* The reference extension mounts that bar above the host's chat input. This package\n   mounts it in Beholder's own panel footer instead — the engine's composer has no\n   stable hook to anchor to — so it needs a footer's chrome and a lane kept clear of\n   the resize grip, a 1.5rem square pinned to the panel's bottom-right corner that\n   otherwise sits on top of the send button and swallows the click. */\n.beholder-panel .beholder-notebox {\n    position: relative;\n    z-index: 2;\n    margin: 0;\n    padding: var(--bh-space-2, 6px) calc(1.5rem + var(--bh-space-3, 10px)) var(--bh-space-2, 6px)\n        var(--bh-space-3, 10px);\n    border-top: 1px solid var(--bh-divider);\n    background: var(--bh-surface-1);\n}\n\n.beholder-panel.beholder-dragging {\n    opacity: 0.85;\n}\n\n.beholder-panel-header {\n    position: relative;\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    background: var(--bh-surface-2);\n    border-bottom: 1px solid var(--bh-divider);\n    cursor: move;\n}\n/* Hairline accent rule across the top of the header — quiet brand mark.\n   Fades in from the left edge so the panel feels \"anchored\" on its left side. */\n.beholder-panel-header::before {\n    content: \"\";\n    position: absolute;\n    left: 0; right: 0; top: 0;\n    height: 1px;\n    background: linear-gradient(\n        90deg,\n        var(--bh-accent, var(--primary)) 0%,\n        color-mix(in srgb, var(--bh-accent) 40%, transparent) 22%,\n        transparent 60%\n    );\n    pointer-events: none;\n    opacity: 0.7;\n}\n.beholder-panel-title {\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-large);\n    font-weight: 600;\n    letter-spacing: 0.12em;\n    color: var(--SmartThemeBodyColor, #e8eaee);\n}\n\n.beholder-panel-controls {\n    display: flex;\n    gap: var(--bh-space-2);\n    font-size: var(--bh-text-body);\n    flex-wrap: wrap;\n    justify-content: flex-end;\n}\n\n.beholder-panel-controls .fa-solid,\n.beholder-tool-btn {\n    cursor: pointer;\n    opacity: var(--bh-mute-soft);\n    transition: opacity 0.15s, color 0.15s, transform 0.15s;\n}\n/* Header tool icons + active control bump slightly larger than the\n   backfill chevrons so the tool row reads as the primary actions. */\n.beholder-panel-controls .fa-solid,\n.beholder-tool-btn { font-size: 1.08em; padding: 4px; }\n.beholder-panel-controls .fa-solid:hover {\n    opacity: 1;\n    color: var(--bh-accent, var(--primary));\n}\n.beholder-panel-controls .fa-solid:active {\n    transform: scale(0.92);\n}\n\n/* ─── Layer bar ──────────────────────────────────────────────────────────\n   Sits directly under the header as a permanent control strip. Reads like\n   the legend row on a vintage anatomical chart: hairline divider above and\n   below, JetBrains Mono small-caps labels, a thin \"engagement bar\" beneath\n   each active layer instead of a chunky fill. Off layers fade to mute-strong\n   so the user can see at a glance which dimensions of the state are hidden.\n\n   Disengaged label gets a thin double-strike instead of an underline — a\n   subtle \"redacted\" cue that echoes editorial typography.                   */\n.beholder-layer-bar {\n    display: grid;\n    grid-template-columns: repeat(3, 1fr);\n    gap: 0;\n    padding: var(--bh-space-1) var(--bh-space-3) calc(var(--bh-space-1) + 1px);\n    background: var(--bh-surface-1);\n    border-bottom: 1px solid var(--bh-divider);\n    position: relative;\n}\n/* Bracket marks at both ends, the way an instrument bezel anchors a scale. */\n.beholder-layer-bar::before,\n.beholder-layer-bar::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    width: 4px;\n    height: 9px;\n    border: 1px solid var(--bh-divider);\n    transform: translateY(-50%);\n    pointer-events: none;\n}\n.beholder-layer-bar::before { left: var(--bh-space-2); border-right: none;  }\n.beholder-layer-bar::after  { right: var(--bh-space-2); border-left:  none; }\n\n.bh-layer-cell {\n    position: relative;\n    cursor: pointer;\n    user-select: none;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    padding: var(--bh-space-1) 0 calc(var(--bh-space-1) + 2px);\n    min-width: 0;\n}\n.bh-layer-cell input {\n    position: absolute;\n    opacity: 0;\n    pointer-events: none;\n}\n.bh-layer-cell span {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 500;\n    letter-spacing: 0.22em;\n    text-transform: uppercase;\n    color: var(--bh-body);\n    opacity: var(--bh-mute-strong);\n    line-height: 1;\n    text-align: center;\n    transition: opacity 0.12s ease, color 0.12s ease, letter-spacing 0.12s ease;\n    position: relative;\n    padding: 1px 2px 3px;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: clip;\n}\n/* Disengaged: a thin overstrike line through the label — editorial \"redacted\"\n   cue, gentler than strikethrough. Drawn as a pseudo-element so it doesn't\n   shift typographic metrics. */\n.bh-layer-cell span::before {\n    content: \"\";\n    position: absolute;\n    left: 8%; right: 8%;\n    top: calc(50% - 1px);\n    height: 1px;\n    background: currentColor;\n    opacity: 0.35;\n    transition: opacity 0.12s ease, transform 0.12s ease;\n    transform-origin: center;\n}\n/* Engagement bar — the \"instrument\" cue. Sits beneath the label, drawn as\n   the cell's own pseudo so it tracks cell width, not text width. */\n.bh-layer-cell::after {\n    content: \"\";\n    position: absolute;\n    left: 18%; right: 18%;\n    bottom: 0;\n    height: 2px;\n    background: var(--bh-accent, var(--primary));\n    transform: scaleX(0);\n    transform-origin: center;\n    transition: transform 0.18s ease, opacity 0.18s ease;\n    opacity: 0;\n}\n.bh-layer-cell:hover span {\n    opacity: var(--bh-mute-none);\n    color: var(--bh-accent, var(--primary));\n}\n.bh-layer-cell:hover span::before { opacity: 0; }\n.bh-layer-cell:hover::after {\n    transform: scaleX(0.55);\n    opacity: 0.55;\n}\n.bh-layer-cell input:checked + span {\n    opacity: var(--bh-mute-none);\n    color: var(--SmartThemeBodyColor, #e8eaee);\n    letter-spacing: 0.26em;        /* fractionally widens — \"tuned in\" */\n}\n.bh-layer-cell input:checked + span::before { opacity: 0; }\n.bh-layer-cell:has(input:checked)::after {\n    transform: scaleX(1);\n    opacity: 1;\n}\n.bh-layer-cell input:focus-visible + span {\n    outline: 1px dashed var(--bh-accent);\n    outline-offset: 3px;\n}\n\n/* Narrow container: tighten letter-spacing so labels still fit on 4 cells. */\n@container bhpanel (max-width: 320px) {\n    .bh-layer-cell span { letter-spacing: 0.14em; font-size: 0.72em; }\n    .bh-layer-cell input:checked + span { letter-spacing: 0.18em; }\n}\n\n.beholder-panel-body {\n    padding: var(--bh-space-3) var(--bh-space-3) var(--bh-space-4);\n    overflow-y: auto;\n    /* Vertical scrolls; horizontal is CLIPPED (never spills past the panel border).\n       `clip` (not `hidden`) adds no scrollbar and composes with overflow-y:auto. The\n       grid/wrap fixes above make content FIT; this is the belt-and-suspenders so a\n       stray wide card can never poke over the right edge again. */\n    overflow-x: clip;\n    flex: 1;\n    /* Subtle scrollbar tuning to feel integrated rather than borrowed. */\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n}\n.beholder-panel-body::-webkit-scrollbar { width: 6px; }\n.beholder-panel-body::-webkit-scrollbar-track { background: transparent; }\n.beholder-panel-body::-webkit-scrollbar-thumb {\n    background: var(--bh-border);\n    border-radius: 3px;\n}\n\n\n.bh-empty-text {\n    color: var(--SmartThemeBodyColor, #888);\n    opacity: var(--bh-mute-soft);\n    text-align: center;\n    padding: var(--bh-space-2) 0;\n    font-size: var(--bh-text-secondary);\n    font-style: italic;\n}\n\n/* ─── Compact mode (legacy text list) ─────────────────────────────────── */\n\n.beholder-char {\n    margin-bottom: 10px;\n    padding-bottom: 8px;\n    border-bottom: 1px dashed var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.08));\n}\n.beholder-char:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }\n.beholder-char-name {\n    font-weight: 600;\n    margin-bottom: 4px;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n}\n.beholder-species {\n    font-weight: normal;\n    opacity: 0.5;\n    font-size: 0.85em;\n    margin-left: 6px;\n}\n.beholder-row { line-height: 1.5; word-wrap: break-word; }\n.beholder-label {\n    display: inline-block;\n    min-width: 60px;\n    opacity: 0.55;\n    font-size: 0.8em;\n    text-transform: uppercase;\n    letter-spacing: 0.4px;\n}\n.beholder-item { margin-right: 4px; }\n.beholder-slot { opacity: 0.45; font-size: 0.85em; font-style: italic; }\n.beholder-wound { color: #ff7676; }\n.beholder-dmg-warn { color: var(--bh-chroma, var(--primary)); }\n.beholder-dmg-bad  { color: #ff8585; }\n\n/* ─── Doll mode ───────────────────────────────────────────────────────── */\n\n/* Tier color scale — drives slot row borders + damage chips */\n.beholder-panel {\n    --bh-tier-0: #6ad48b; /* pristine, lightly worn */\n    --bh-tier-1: var(--bh-chroma); /* frayed, soiled */\n    --bh-tier-2: #e9933b; /* damaged, cracked */\n    --bh-tier-3: #e26464; /* torn, bloodstained */\n    --bh-tier-4: #8c3030; /* tatters, ruined */\n    /* Legacy token names remain aliases so the imported renderer stays small,\n       but every interface accent follows the host theme. */\n    --bh-gold: var(--bh-chroma);\n    --bh-gold-deep: var(--bh-accent);\n    --bh-gold-soft: color-mix(in srgb, var(--bh-chroma) 82%, var(--foreground));\n    --bh-holding: var(--bh-gold);\n    --bh-body: var(--SmartThemeBodyColor, #cfd2d6);\n    --bh-body-soft: color-mix(in srgb, var(--bh-body) 25%, transparent);\n    --bh-accent: var(--bh-accent-pref, var(--primary));\n    --bh-wound: #ff5252;\n}\n\n/* Character tabs — name nav for multi-char chats. Wraps to multiple rows\n   when there are more tabs than fit on one row (instead of horizontal\n   scrolling, which hides off-screen characters). */\n.bh-tabs {\n    display: flex;\n    flex-wrap: wrap;\n    gap: var(--bh-space-1) var(--bh-space-2);\n    margin-bottom: var(--bh-space-3);\n    padding-bottom: var(--bh-space-1);\n    border-bottom: 1px solid var(--bh-divider);\n}\n.bh-tab {\n    background: transparent;\n    border: none;\n    color: var(--bh-body);\n    padding: var(--bh-space-1) var(--bh-space-2) var(--bh-space-1);\n    font: inherit;\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-body);\n    letter-spacing: 0.06em;\n    cursor: pointer;\n    opacity: 0.55;\n    border-bottom: 2px solid transparent;\n    transition: opacity 0.15s, border-color 0.15s, color 0.15s;\n    white-space: nowrap;\n}\n.bh-tab:hover { opacity: 0.85; }\n.bh-tab-active {\n    opacity: 1;\n    border-bottom-color: var(--bh-accent);\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    font-weight: 600;\n}\n\n/* Multi-char \"updated\" indicator. Critical for the multi-char RP case:\n   when Maggie's state changes while Tim's tab is active, the dot on\n   Maggie's tab signals \"she changed, click to see.\" */\n.bh-tab-updated {\n    opacity: 0.85;\n    color: var(--bh-accent);\n}\n.bh-tab-updated .bh-tab-pulse {\n    color: var(--bh-accent);\n    font-size: var(--bh-text-meta);\n    margin-left: var(--bh-space-1);\n    vertical-align: middle;\n}\n/* Absent — character is tracked but not currently in the scene. Tab stays\n   clickable (last-known state preserved) but reads as \"on the roster, not\n   here right now\": dimmed, italic, no accent. Hover brightens slightly so\n   it's clear the tab is still interactive. */\n.bh-tab-absent {\n    opacity: 0.38;\n    font-style: italic;\n}\n.bh-tab-absent:hover { opacity: 0.7; }\n.bh-tab-absent.bh-tab-active {\n    /* If user explicitly views an absent char, lift the dim a little so\n       their state is readable, but keep italic so the off-scene status is\n       still legible. */\n    opacity: 0.72;\n}\n\n.bh-char-doll {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n}\n\n.bh-char-head {\n    display: flex;\n    align-items: baseline;\n    gap: var(--bh-space-3);\n    padding: var(--bh-space-1) 0 var(--bh-space-2);\n    border-bottom: 1px solid var(--bh-divider);\n    margin-bottom: var(--bh-space-2);\n    position: relative;\n}\n/* Decorative inscription rule under the character name — codex page feel.\n   Sits over the head's bottom border, accenting the left edge. */\n.bh-char-head::after {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    bottom: -1px;\n    width: 32px;\n    height: 1px;\n    background: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    opacity: 0.55;\n}\n.bh-char-name {\n    font-family: var(--bh-font-display);\n    font-weight: 600;\n    font-size: var(--bh-text-display);\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    letter-spacing: 0.06em;\n    line-height: 1.15;\n}\n\n/* (Stamina gauge removed — the stamina field is no longer tracked. Any\n   residual gauge element is hidden via the .bh-char-head .bh-gauge\n   display:none rule appended below.) */\n.bh-char-species {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    font-weight: 600;\n    color: var(--primary, var(--bh-body));\n    opacity: 1;\n    letter-spacing: 0.08em;\n    text-transform: lowercase;\n    padding: 1px var(--bh-space-2);\n    border: 1px solid color-mix(in srgb, var(--primary, var(--bh-divider)) 45%, transparent);\n    border-radius: 3px;\n    background: color-mix(in srgb, var(--primary, var(--bh-surface-1)) 12%, transparent);\n}\n/* v0.4 (2026-06-03): `bh-char-gender` rules removed along with the gender\n   field. The wings rules below are kept defensively in case a v0.5+ state\n   still emits a `wings` slot — they harmlessly do nothing when paperdoll.js\n   never renders the element. */\n.bh-char-species::before {\n    content: \"·\";\n    margin-right: 4px;\n    opacity: 0.5;\n}\n\n/* The 3-col grid: left labels | silhouette | right labels */\n.bh-doll-grid {\n    display: grid;\n    /* minmax(0, 1fr) — NOT bare 1fr. A bare `1fr` track has an implicit min of\n       min-content, so a wide chip (a long item name) forces the side column — and the\n       whole grid — past the panel's right edge. minmax(0,…) lets the track shrink and\n       the content wrap/clip instead of overflowing. */\n    grid-template-columns: minmax(0, 1fr) calc(140px * var(--bh-ui-scale, 1)) minmax(0, 1fr);\n    gap: calc(6px * var(--bh-ui-scale, 1));\n    align-items: start;\n}\n.bh-doll-empty {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 4px;\n    padding: 4px 0;\n}\n.bh-figure { display: flex; justify-content: center; }\n\n.bh-col {\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n    min-width: 0;\n}\n.bh-col-empty { min-height: 1px; }\n\n/* ─── Narrow-viewport / ST sidebar adaptation ──────────────────────────\n   Container queries (not media queries) — the panel responds to its OWN\n   size, so it adapts whether it's narrow because of viewport (mobile) or\n   because the user docked it in a narrow ST sidebar. */\n.beholder-panel {\n    container-type: inline-size;\n    container-name: bhpanel;\n}\n/* ─── Mobile / narrow context = section digest (auto) ─────────────────────\n   Above 360px the panel is the paperdoll grid. Below, the digest takes\n   over: wounds → held → worn → state flags, sorted by IMPORTANCE rather\n   than by anatomy. The silhouette + slot cards aren't useful at narrow\n   widths once the spatial cue is gone — the digest reformats the same\n   data as a priority feed. Both are always rendered; CSS picks one. */\n.bh-digest { display: none; }\n@container bhpanel (max-width: 360px) {\n    .bh-doll-grid     { display: none; }\n    .bh-doll-grid.bh-paired { display: none; }\n    .bh-digest        { display: block; }\n    /* Auto-narrow always shows the digest; hide the digest-side layout\n       switch (the panel has no doll grid to switch between at this width). */\n    .bh-layout-switch-row { display: none; }\n    /* Header tools collapse to the overflow (⋯) trigger when narrow. */\n    /* .beholder-panel-scoped so this outranks the FA shim's\n       `.beholder-panel [class*='fa-']`, which forces display:inline-block on every\n       icon in the panel and otherwise wins this on specificity. */\n    .beholder-panel .beholder-tool-btn { display: none; }\n    /* One step more specific than the base hide below, which has to be\n       .beholder-panel-scoped itself to outrank the FA shim. Without that the base\n       rule wins on source order and the trigger never appears. */\n    .beholder-panel .beholder-panel-controls .beholder-tools-more { display: inline-block; }\n}\n\n/* Per-slot CARD: one card per anatomical slot, contains chips for each\n   worn item / held item / wound that belongs to it. Replaces the\n   one-row-per-thing layout (which repeated the slot name on every card).\n   The card's left border = worst damage tier across all items in that slot. */\n.bh-slot-card {\n    background: rgba(255, 255, 255, 0.035);\n    border: 1px solid rgba(255, 255, 255, 0.08);\n    border-radius: 6px;\n    padding: 4px 6px 5px 9px;\n    position: relative;\n    line-height: 1.3;\n    /* In paired mode the card IS the grid item (the .bh-col wrapper is display:contents),\n       so it needs its own min-width:0 to shrink below its content and let the text wrap\n       instead of forcing the track — and the panel — wider. */\n    min-width: 0;\n    font-size: 1em;\n}\n/* Card no longer carries a tier border — damage tier reads off each chip's\n   own left bar (CSS ::before below) so the colored stripes match each\n   chip's actual height. Empty card still gets faint outline via main\n   .bh-slot-card border style above. */\n\n/* Wound-count marker in the slot card header (✚ or ✚N for >1). */\n.bh-slot-card-head {\n    display: flex;\n    align-items: baseline;\n    justify-content: space-between;\n    gap: 6px;\n}\n/* (Slot-head wound mark removed — the wound chips inside the card already\n   say the same thing; the head-level glyph was duplicating info.) */\n/* Right-column = true mirror of left. Border anchors to the right edge\n   (toward the silhouette), and chip content reverses so dots/swatches/\n   glyphs cluster on the right side near the border, multi-slot tags\n   + wound marks float to the left. Text within each label still reads\n   left-to-right — only the element order flips. */\n.bh-col-right .bh-slot-card-head { flex-direction: row-reverse; }\n.bh-slot-card .bh-slot-name {\n    font-family: var(--bh-font-data);\n    font-size: 0.82em;          /* slot card scale already shrinks; bump back to readable */\n    font-weight: 500;\n    opacity: 0.65;\n    text-transform: lowercase;\n    letter-spacing: 0.06em;\n    font-style: normal;\n}\n\n/* Right-column cards mirror the border. */\n.bh-col-right .bh-slot-card { text-align: right; padding-left: 6px; padding-right: 9px; }\n.bh-col-right .bh-slot-card::before { inset: 0 0 0 auto; border-radius: 0 6px 6px 0; }\n\n/* Empty / ghost slot card: faint one-liner, no chips. Lets users see what\n   slots ARE available without dominating the visual. */\n.bh-slot-card.bh-slot-empty {\n    background: transparent;\n    border-style: dashed;\n    border-color: rgba(255, 255, 255, 0.05);\n    opacity: 0.35;\n    padding: 2px 6px 2px 9px;\n}\n.bh-slot-card.bh-slot-empty::before {\n    background: rgba(255, 255, 255, 0.06);\n}\n.bh-slot-card.bh-slot-empty:hover { opacity: 0.7; }\n\n/* Bare slot card (v0.3 — narration explicitly confirmed uncovered).\n   Skin-tone left bar + italic \"bare\" tag in the same slot as missing's tag.\n   Visually distinct from .bh-slot-empty (which means \"unknown / nothing said\").\n   Mutually exclusive with worn/items per schema, so no chips. */\n.bh-slot-card.bh-slot-bare {\n    background: rgba(220, 188, 156, 0.04);\n    border-style: solid;\n    border-color: rgba(220, 188, 156, 0.18);\n    opacity: 0.85;\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    padding: 4px 8px 4px 9px;\n}\n.bh-slot-card.bh-slot-bare::before {\n    background: linear-gradient(180deg, rgba(220, 188, 156, 0.5), rgba(220, 188, 156, 0.25));\n}\n.bh-slot-bare-tag {\n    color: rgba(220, 188, 156, 0.95);\n    font-family: var(--bh-font-data);\n    font-size: 0.78em;\n    text-transform: uppercase;\n    letter-spacing: 0.12em;\n    font-style: normal;\n    font-weight: 600;\n}\n.bh-slot-card.bh-slot-bare:hover {\n    opacity: 1;\n    border-color: rgba(220, 188, 156, 0.45);\n}\n\n/* ─── Layered worn-items staircase ──────────────────────────────────────\n   When a slot has >1 worn item (chest with gambeson + chainmail + breastplate),\n   each chip gets a left-side index gutter and a faint connector line. The\n   first chip is the outermost layer (per schema worn[0] = outer). */\n.bh-chip-layered {\n    display: flex;\n    align-items: stretch;\n    gap: var(--bh-space-1);\n    position: relative;\n}\n.bh-chip-layer-idx {\n    font-family: var(--bh-font-data);\n    font-size: 0.65em;\n    font-weight: 600;\n    color: var(--bh-body);\n    opacity: 0.4;\n    min-width: 10px;\n    text-align: center;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    flex-shrink: 0;\n    position: relative;\n}\n/* Connector line tying the indices into a vertical stack. */\n.bh-chip-layered:not(:first-child) .bh-chip-layer-idx::before {\n    content: \"\";\n    position: absolute;\n    top: -3px;\n    bottom: 50%;\n    width: 1px;\n    background: var(--bh-border);\n    opacity: 0.5;\n}\n.bh-chip-layered:not(:last-child) .bh-chip-layer-idx::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    bottom: -3px;\n    width: 1px;\n    background: var(--bh-border);\n    opacity: 0.5;\n}\n.bh-chip-layered:first-child .bh-chip-layer-idx { color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary))); opacity: 0.55; }\n.bh-chip-layered:hover .bh-chip-layer-idx       { opacity: 0.9; }\n/* Right-column layered chips mirror: index ends up on the right side (toward\n   the body), connector tick still runs vertically through the index gutter. */\n.bh-col-right .bh-chip-layered { flex-direction: row-reverse; }\n\n/* Missing / lost slot card: vertical gray slits, strikethrough on the slot\n   name, \"missing\" tag. Distinct from empty and off-body. */\n.bh-slot-card.bh-slot-missing {\n    background: repeating-linear-gradient(\n        90deg,\n        rgba(140, 140, 140, 0.07) 0px, rgba(140, 140, 140, 0.07) 1px,\n        transparent 1px, transparent 6px\n    );\n    border-style: dashed;\n    border-color: rgba(140, 140, 140, 0.3);\n    opacity: 0.65;\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    padding: 4px 8px 4px 9px;\n}\n.bh-slot-card.bh-slot-missing::before { background: rgba(140, 140, 140, 0.45); }\n.bh-slot-card.bh-slot-missing .bh-slot-name {\n    text-decoration: line-through;\n    opacity: 0.7;\n}\n.bh-slot-missing-tag {\n    color: rgba(160, 160, 160, 0.95);\n    font-family: var(--bh-font-data);\n    font-size: 0.78em;\n    text-transform: uppercase;\n    letter-spacing: 0.12em;\n    font-style: normal;\n    font-weight: 600;\n}\n.bh-slot-card.bh-slot-missing:hover {\n    opacity: 0.85;\n    border-color: rgba(160, 160, 160, 0.5);\n}\n\n/* Chips inside a slot card: one per item / wound. Damage tier shows as a\n   small dot before the item name; the card border still shows the worst\n   tier across all items, the per-chip dot tells you which item is which. */\n.bh-slot-chips {\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    margin-top: 2px;\n}\n.bh-chip {\n    display: flex;\n    flex-wrap: wrap;             /* allows the verbose sub-row to drop below */\n    align-items: baseline;\n    font-size: 1.0em;\n    line-height: 1.35;\n    padding: 1px 0;\n    cursor: help;\n    /* Wrap at WORD boundaries only (no mid-word breaks). Long names that\n       genuinely need to wrap will, but won't shatter into \"breastpla|te\". */\n    overflow-wrap: normal;\n    word-break: normal;\n}\n/* Chip head — prefix glyphs + item name + multi-slot tag share ONE inner\n   flex line that never wraps as a unit. The text inside is allowed to wrap\n   to multiple lines via min-width:0, but the dot/glyph/swatch stay glued to\n   the start of the FIRST line. Previously the chip was a single flex with\n   wrap, so a long item name would push to a new row, orphaning the prefix\n   on the row above. */\n.bh-chip-head {\n    display: flex;\n    flex: 1 1 100%;\n    align-items: baseline;\n    gap: 6px;\n    min-width: 0;\n    flex-wrap: nowrap;\n}\n.bh-chip-text {\n    font-weight: 500;\n    flex: 1 1 auto;\n    min-width: 0;\n    /* A single over-long token (an item name with no spaces) can't wrap at a space,\n       so break it as a LAST RESORT rather than let it overflow the column past the\n       panel edge. Multi-word names still wrap at spaces first (this only fires when a\n       word is wider than the column). */\n    overflow-wrap: anywhere;\n    /* Sentence case at the display layer: normalize the model's casing\n       (lowercase everything) and then capitalize the first letter. Means\n       \"ARMING SWORD\" and \"arming sword\" both render as \"Arming sword\".\n       Display normalization only — the underlying data stays as authored. */\n    text-transform: lowercase;\n}\n.bh-chip-text::first-letter {\n    text-transform: uppercase;\n}\n.bh-chip-dot {\n    width: 8px; height: 8px;\n    border-radius: 50%;\n    flex-shrink: 0;\n    background: var(--bh-tier-0);\n    align-self: center;\n}\n.bh-chip.bh-tier-1 .bh-chip-dot { background: var(--bh-tier-1); }\n.bh-chip.bh-tier-2 .bh-chip-dot { background: var(--bh-tier-2); }\n.bh-chip.bh-tier-3 .bh-chip-dot { background: var(--bh-tier-3); }\n.bh-chip.bh-tier-4 .bh-chip-dot { background: var(--bh-tier-4); }\n/* Hide the per-chip damage dot in desktop (doll-grid) — the card's left\n   border already encodes the same tier for each item. Mobile (digest)\n   keeps the dot because there's no card border to read off. */\n.bh-doll-grid .bh-chip-dot { display: none; }\n\n/* ─── Color swatch (v0.3 worn[].color / holding.color) ──────────────────\n   Inline color square beside the damage dot. Encodes the item's color\n   without stealing characters from the item name. Schema palette = 16\n   controlled colors; free-text variants fall back to .bh-c-other (neutral)\n   and rely on the tooltip for the exact word. */\n.bh-chip-swatch {\n    width: 9px;\n    height: 9px;\n    border-radius: 2px;\n    flex-shrink: 0;\n    align-self: center;\n    border: 1px solid rgba(255, 255, 255, 0.18);\n    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset;\n}\n/* Schema's 16-color controlled palette — chosen for legibility on dark bg. */\n.bh-c-red    { background: #d6534b; }\n.bh-c-orange { background: #e6883a; }\n.bh-c-yellow { background: #e6c64b; }\n.bh-c-green  { background: #5ec27a; }\n.bh-c-blue   { background: #4d8fdc; }\n.bh-c-purple { background: #9d6dcc; }\n.bh-c-pink   { background: #e687a3; }\n.bh-c-brown  { background: #8a5a3a; }\n.bh-c-black  { background: #1f1f24; border-color: rgba(255, 255, 255, 0.3); }\n.bh-c-white  { background: #f0f0f0; border-color: rgba(255, 255, 255, 0.4); }\n.bh-c-gray   { background: #888c92; }\n.bh-c-beige  { background: #d6c7a3; }\n.bh-c-gold   { background: #d4a93a; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset, 0 0 4px rgba(212, 169, 58, 0.4); }\n.bh-c-silver { background: #b5b8bd; }\n.bh-c-navy   { background: #2a3d6b; }\n.bh-c-tan    { background: #c4a878; }\n/* Free-text color (crimson, burgundy, etc.): neutral swatch with a hint\n   underline so it reads as \"color present, see tooltip\". */\n.bh-c-other  {\n    background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));\n    border-style: dashed;\n}\n\n/* Held items use the chat chroma for their ✦ glyph, while the chip text stays\n   neutral so color swatches and damage state remain readable. */\n.bh-chip-hold .bh-chip-text { color: inherit; }\n.bh-chip-hold .bh-chip-glyph {\n    color: var(--bh-holding);\n    font-size: 0.95em;\n    text-shadow: 0 0 4px color-mix(in srgb, var(--bh-chroma) 35%, transparent);\n}\n\n/* Wound chips: severity-colored (1=minor amber, 2=serious orange, 3=critical red).\n   v0.3 supplies explicit severity + bleeding fields. */\n.bh-chip-wound .bh-chip-glyph { font-size: 0.95em; }\n.bh-chip-wound-1 { color: var(--bh-chroma, var(--primary)); }\n.bh-chip-wound-1 .bh-chip-glyph { text-shadow: 0 0 4px color-mix(in srgb, var(--bh-accent) 45%, transparent); }\n.bh-chip-wound-2 { color: #e9933b; }\n.bh-chip-wound-2 .bh-chip-glyph { text-shadow: 0 0 4px rgba(233, 147, 59, 0.5); }\n.bh-chip-wound-3 { color: #ff4747; }\n.bh-chip-wound-3 .bh-chip-glyph { text-shadow: 0 0 4px rgba(255, 71, 71, 0.55); }\n.bh-chip-glyph { flex-shrink: 0; }\n\n/* Bleeding indicator — the wound chip's ✚ glyph pulses with a saturated\n   red halo. Settled middle ground: slightly larger base, modest scale +\n   opacity pulse, still distinct from a STATIC red ✚ but not jumpy. */\n.bh-chip-bleeding .bh-chip-glyph {\n    display: inline-block;\n    color: #ff3838 !important;\n    font-size: 1.12em;\n    line-height: 1;\n    text-shadow:\n        0 0 4px rgba(255, 56, 56, 0.9),\n        0 0 9px rgba(255, 56, 56, 0.55) !important;\n    animation: bh-bleed-pulse 1.3s ease-in-out infinite;\n    transform-origin: center;\n}\n@keyframes bh-bleed-pulse {\n    0%, 100% {\n        opacity: 0.78;\n        transform: scale(1);\n        text-shadow:\n            0 0 3px rgba(255, 56, 56, 0.65),\n            0 0 6px rgba(255, 56, 56, 0.3);\n    }\n    50% {\n        opacity: 1;\n        transform: scale(1.1);\n        text-shadow:\n            0 0 5px rgba(255, 56, 56, 0.95),\n            0 0 11px rgba(255, 56, 56, 0.55),\n            0 0 16px rgba(255, 56, 56, 0.3);\n    }\n}\n@media (prefers-reduced-motion: reduce) {\n    .bh-chip-bleeding .bh-chip-glyph {\n        animation: none;\n        opacity: 1;\n        transform: scale(1.08);\n    }\n}\n\n/* ─── Verbose sub-row (Full view) ──────────────────────────────────────\n   Spells out what tooltips show: damage word, color word, severity word,\n   bleeding word. The whole row is hidden by default and forced onto a new\n   line (flex-basis 100%) under the chip text in Full view — keeps slot\n   cards the same width regardless of label length. */\n.bh-chip-verbose {\n    font-family: var(--bh-font-data);\n    font-size: 0.78em;\n    letter-spacing: 0.04em;\n    opacity: 0.75;\n    text-transform: lowercase;\n}\n/* Verbose row is no longer gated by Meta — each label inside has its own\n   layer gate (color → Color layer, damage label → always, sev/bleed → live\n   on wound chips that are themselves Wound-gated). Meta now only controls\n   species pill, layer indices, and multi-slot ⌖ tags. */\n.bh-chip-verbose-row {\n    display: flex;\n    flex-basis: 100%;            /* forces line break inside the wrapping chip */\n    flex-direction: column;      /* stack labels vertically — consistent placement\n                                    regardless of how many labels or how long;\n                                    we have length, not width, in slot cards. */\n    gap: 1px;\n    /* Indent past the dot + swatch so labels visually pair with the item text */\n    padding-left: 20px;\n    margin-top: 2px;\n}\n/* Layer ownership of verbose labels:\n     .bh-chip-verbose-dmg    → Damage layer\n     .bh-chip-verbose-color  → Color layer\n     .bh-chip-verbose-sev    → Wounds layer (cascades — wound chip is the gate)\n     .bh-chip-verbose-bleed  → Wounds layer (cascades — wound chip is the gate)\n   The per-label hide rules live alongside the other Damage/Color/Wounds rules\n   below (search \"bh-hide-damage\", etc.). The row hide rules below collapse\n   the container when every visible label would be gone — no orphan margin. */\n.bh-chip-verbose-dmg   { color: inherit; opacity: 0.85; }\n.bh-chip-verbose-color { opacity: 0.7; font-style: italic; }\n.bh-chip-verbose-sev   { color: inherit; font-weight: 600; opacity: 0.9; }\n.bh-chip-verbose-bleed {\n    color: var(--bh-wound);\n    font-weight: 600;\n    text-shadow: 0 0 4px rgba(255, 71, 71, 0.4);\n}\n/* Collapse the verbose row when every label that WOULD render is layer-hidden.\n   Three explicit cases cover all \"no visible content left\" combinations. */\n.beholder-panel.bh-hide-color.bh-hide-damage .bh-chip-verbose-row:not(:has(.bh-chip-verbose-sev, .bh-chip-verbose-bleed)) { display: none; }\n.beholder-panel.bh-hide-color:not(.bh-hide-damage) .bh-chip-verbose-row:not(:has(.bh-chip-verbose-dmg, .bh-chip-verbose-sev, .bh-chip-verbose-bleed)) { display: none; }\n.beholder-panel.bh-hide-damage:not(.bh-hide-color) .bh-chip-verbose-row:not(:has(.bh-chip-verbose-color, .bh-chip-verbose-sev, .bh-chip-verbose-bleed)) { display: none; }\n\n/* Wounds chips own their severity-dot decoration; sev dots and the verbose\n   sev word are both severity cues — keep dots for the visual signal, words\n   for the spelled-out tier. They render together when wounds layer is on,\n   disappear together when it's off (wound chip is hidden as a whole). */\n\n/* Multi-slot annotation — when a row covers >1 slot (sundress on 4 slots,\n   gown on chest+waist+legs). The chip still appears in every slot it covers\n   (testers prefer this), but the small ⌖N tag signals \"this item also lives\n   in other cards\" so readers don't think they're seeing duplicates. */\n.bh-chip-multi {\n    font-family: var(--bh-font-data);\n    font-size: 0.7em;\n    letter-spacing: 0.04em;\n    color: var(--bh-body);\n    opacity: 0.45;\n    margin-left: var(--bh-space-1);\n    padding: 0 4px;\n    border: 1px solid var(--bh-divider);\n    border-radius: 3px;\n    flex-shrink: 0;\n    align-self: center;\n    cursor: help;\n}\n.bh-chip-multi:hover { opacity: 0.85; border-color: var(--bh-border); }\n\n/* Per-chip damage bar (desktop only) — positioned at the CARD'S LEFT EDGE\n   (negative offset hops out of the chip's normal flow, into the card's\n   padding-left). Each bar's height matches its own chip exactly, so a\n   chest with three layered items shows three stacked bars at the card\n   edge — together they read as a single segmented \"card border\" that's\n   item-aware. Wounds get no bar (different concern).\n   Adjacent bars extend ±1px so they meet across the chip-gap, forming a\n   continuous left edge. Mobile digest uses chip-dots instead. */\n.bh-doll-grid .bh-chip {\n    position: relative;\n}\n.bh-doll-grid .bh-chip::before {\n    content: \"\";\n    position: absolute;\n    left: -9px;            /* card has padding-left: 9px → bar lands at card edge */\n    top: -1px;\n    bottom: -1px;\n    width: 3px;\n    background: var(--chip-bar, transparent);\n}\n.bh-doll-grid .bh-chip.bh-tier-0 { --chip-bar: var(--bh-tier-0); }\n.bh-doll-grid .bh-chip.bh-tier-1 { --chip-bar: var(--bh-tier-1); }\n.bh-doll-grid .bh-chip.bh-tier-2 { --chip-bar: var(--bh-tier-2); }\n.bh-doll-grid .bh-chip.bh-tier-3 { --chip-bar: var(--bh-tier-3); }\n.bh-doll-grid .bh-chip.bh-tier-4 { --chip-bar: var(--bh-tier-4); }\n/* Wound chips have no bar — gear damage is a different concern. */\n.bh-doll-grid .bh-chip-wound::before { display: none; }\n/* Right-column mirror — bars on the right edge (card has padding-right: 9px\n   on right-col cards). */\n.bh-doll-grid .bh-col-right .bh-chip::before { left: auto; right: -9px; }\n\n/* Layered worn chips: the bar is positioned on the WRAPPER (not the inner\n   chip), so it lands at the card's left edge instead of inside the wrapper\n   (where it was overlapping the layer-index gutter and hiding the 1/2/3).\n   The tier class is copied onto the wrapper at render time. */\n.bh-doll-grid .bh-chip-layered::before {\n    content: \"\";\n    position: absolute;\n    left: -9px;\n    top: -1px;\n    bottom: -1px;\n    width: 3px;\n    background: var(--chip-bar, transparent);\n}\n.bh-doll-grid .bh-chip-layered.bh-tier-0 { --chip-bar: var(--bh-tier-0); }\n.bh-doll-grid .bh-chip-layered.bh-tier-1 { --chip-bar: var(--bh-tier-1); }\n.bh-doll-grid .bh-chip-layered.bh-tier-2 { --chip-bar: var(--bh-tier-2); }\n.bh-doll-grid .bh-chip-layered.bh-tier-3 { --chip-bar: var(--bh-tier-3); }\n.bh-doll-grid .bh-chip-layered.bh-tier-4 { --chip-bar: var(--bh-tier-4); }\n/* Inner chip's bar is suppressed when wrapped, to avoid double drawing. */\n.bh-doll-grid .bh-chip-layered .bh-chip::before { display: none; }\n/* Right-column wrapper bar mirrors to the right edge. */\n.bh-doll-grid .bh-col-right .bh-chip-layered::before { left: auto; right: -9px; }\n\n/* Wound group divider — dashed hairline above the wounds sub-list so the\n   gear group and the wound group read as distinct sections inside one\n   slot card. */\n.bh-slot-wounds {\n    margin-top: var(--bh-space-2);\n    padding-top: var(--bh-space-2);\n    border-top: 1px dashed var(--bh-divider);\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n}\n\n/* Right-col chip content mirrors: dot/swatch/glyph end up on the right\n   (toward the silhouette in the middle), multi-slot tag flips to the left,\n   text still reads LTR inside its element. The row-reverse goes on the\n   head (the inner prefix line); the chip itself stays normal so the verbose\n   row stays BELOW the head, not above. */\n.bh-col-right .bh-chip-head { flex-direction: row-reverse; }\n/* Verbose sub-row indent flips for right-col: indent on the RIGHT (away from\n   the body), labels stacked vertically and right-aligned so they sit under\n   the item text as it appears in the mirrored layout. */\n.bh-col-right .bh-chip-verbose-row {\n    padding-left: 0;\n    padding-right: 20px;\n    align-items: flex-end;\n}\n\n/* Spanning-item section: a horizontal strip above the doll grid for items\n   that occupy multiple slots (sundress on chest+waist+legs renders once\n   here, not in every slot card). */\n.bh-spanning-section {\n    display: flex;\n    flex-wrap: wrap;\n    align-items: center;\n    gap: 4px 6px;\n    margin: 4px 2px 6px;\n    padding: 4px 6px;\n    background: rgba(255, 255, 255, 0.02);\n    border: 1px dashed rgba(255, 255, 255, 0.08);\n    border-radius: 6px;\n}\n.bh-spanning-label {\n    font-size: 0.7em;\n    text-transform: uppercase;\n    letter-spacing: 1.2px;\n    opacity: 0.45;\n    margin-right: 2px;\n}\n.bh-chip-spanning {\n    padding: 2px 8px;\n    background: rgba(255, 255, 255, 0.04);\n    border: 1px solid rgba(255, 255, 255, 0.08);\n    border-radius: 999px;\n    cursor: help;\n}\n.bh-chip-spanning .bh-chip-slots {\n    font-size: 0.78em;\n    opacity: 0.5;\n    font-style: italic;\n    margin-left: 2px;\n}\n\n/* (Obsolete single-row card styling removed — replaced by .bh-slot-card +\n   .bh-chip layout above. Left intentionally so the file is shorter.) */\n\n/* (Right-column mirroring moved into .bh-slot-card / .bh-chip rules above.) */\n\n/* Silhouette — scales with the panel's --bh-ui-scale knob. */\n.bh-silhouette {\n    width: calc(140px * var(--bh-ui-scale, 1));\n    height: calc(440px * var(--bh-ui-scale, 1));\n    display: block;\n    color: var(--bh-body);\n}\n.bh-body-fill {\n    fill: var(--bh-body-soft);\n    stroke: var(--bh-body);\n    stroke-width: 1;\n    stroke-opacity: 0.45;\n}\n\n.bh-wound-marker .bh-wound-dot {\n    fill: var(--bh-wound);\n    stroke: rgba(0, 0, 0, 0.5);\n    stroke-width: 0.8;\n    filter: drop-shadow(0 0 3px rgba(255, 60, 60, 0.55));\n    /* Animation budget ≤1 at a time (per UX research). A static dot is\n       legible on its own; reserve motion for future severity tiers\n       (critical/bleeding) which will animate exclusively. */\n}\n.bh-wound-marker .bh-wound-count {\n    font-size: 7px;\n    fill: #fff;\n    font-weight: 700;\n    pointer-events: none;\n}\n\n/* Held-item marker on the silhouette hand — just the ✦ glyph, no circle.\n   pointer-events: none so the hand part underneath stays hoverable for\n   the hover-link with the slot card. */\n.bh-hold-marker {\n    pointer-events: none;\n}\n.bh-hold-marker .bh-hold-icon {\n    font-size: 8px;\n    fill: var(--bh-holding);\n    font-weight: 700;\n    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.65));\n}\n\n/* (Gauge CSS removed — the only consumer was the stamina gauge, which is no\n   longer tracked. A defensive .bh-char-head .bh-gauge{display:none} is\n   appended below to hide any residual gauge element.) */\n\n/* Old .bh-wounds-block (bottom <details> list) removed — wounds are now\n   first-class slot rows alongside worn/holding (see .bh-row-wound below). */\n\n/* Viewer-perspective hint below the silhouette: the figure faces the user,\n   so character-right renders on viewer-left. Without this, ~30% of first-\n   time testers think the model swapped hands. */\n.bh-figure {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: var(--bh-space-2);\n    min-width: 0;\n    max-width: 100%;\n    overflow: hidden;\n}\n.bh-pov-hint {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-1);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.16em;\n    opacity: var(--bh-mute-strong);\n    text-transform: uppercase;\n    cursor: help;\n    padding-top: var(--bh-space-1);\n    white-space: nowrap;\n}\n.bh-pov-hint:hover { opacity: var(--bh-mute-soft); }\n.bh-pov-axis { opacity: 0.5; letter-spacing: 0; }\n.bh-pov-note {\n    font-family: inherit;\n    font-size: 0.92em;\n    letter-spacing: 0.04em;\n    text-transform: lowercase;\n    font-style: italic;\n    margin-left: var(--bh-space-1);\n    opacity: 0.85;\n}\n\n/* ─── Body-part tinting on the silhouette ────────────────────────────── */\n/* Per-part visual encoding:\n     STROKE (ring outside the part) = armor damage tier\n     FILL   (interior of the part)  = wound severity\n   `paint-order: stroke` shifts the fill to paint OVER the inner half of\n   the stroke, so the visible stroke ring sits entirely OUTSIDE the fill —\n   no muddled blend when armor and wound are both red. Thicker stroke at\n   high tiers makes the ring unambiguous. */\n.bh-part .bh-body-fill {\n    paint-order: stroke fill;\n    transition: stroke 0.2s ease, stroke-width 0.2s ease, fill 0.2s ease;\n}\n.bh-part .bh-body-fill.bh-part-tier-2 { stroke: var(--bh-tier-2); stroke-width: 3.0; stroke-opacity: 1; }\n.bh-part .bh-body-fill.bh-part-tier-3 { stroke: var(--bh-tier-3); stroke-width: 4.0; stroke-opacity: 1; }\n.bh-part .bh-body-fill.bh-part-tier-4 { stroke: var(--bh-tier-4); stroke-width: 5.0; stroke-opacity: 1; }\n\n/* Body-part wound fill — tier by MAX SEVERITY. Hue + opacity both shift so\n   the three severities are unambiguous at a glance:\n     minor    = soft amber, ~20% — a passing visual nudge (\"there's a wound\")\n     serious  = clear orange, ~40% — body part is meaningfully hurt\n     critical = saturated red, ~65% — alarming, draws the eye\n   Critical also gets a thin red stroke overlay so it pops even when the\n   part is small (eyes, ears). */\n/* Wound fill — interior tint by severity. Stroke is reserved for ARMOR;\n   wound severity reads from the fill color (no stroke override). This\n   keeps the two channels orthogonal: ring = armor, interior = body. */\n.bh-part .bh-body-fill.bh-part-wound-1 {\n    fill: color-mix(in srgb, var(--bh-chroma) 20%, transparent);\n}\n.bh-part .bh-body-fill.bh-part-wound-2 {\n    fill: rgba(233, 147, 59, 0.42);\n}\n.bh-part .bh-body-fill.bh-part-wound-3 {\n    fill: rgba(255, 71, 71, 0.65);\n}\n\n/* Missing / acquired-loss body part: gray vertical hatch + dashed outline.\n   Distinct from off-body (species lacks this part — handled in row layer with\n   ⌀ glyph) and from empty (no item — handled by ghost card). */\n.bh-part .bh-body-fill.bh-part-missing {\n    fill: url(#bh-missing-pattern);\n    stroke: rgba(140, 140, 140, 0.6) !important;\n    stroke-opacity: 0.7 !important;\n    stroke-dasharray: 4 3;\n}\n\n/* Hover any part to see slot + damage + wounds tooltip via <title>. */\n.bh-part { cursor: help; }\n.bh-part:hover .bh-body-fill { filter: brightness(1.15); }\n\n/* Hover-link: visually pair a body part with its slot row(s) and vice versa.\n   !important here because the hide-damage / hide-wounds rules above use\n   !important to neutralize tier strokes and wound fills — without it the\n   hover-link highlight gets stomped in every view except Full.\n\n   The fill is explicitly mixed with the accent color (not just a brightness\n   filter) so the highlight reads as a tinted REGION rather than a bright\n   outline. Critical on slim slots like legs/arms where the silhouette's\n   pale soft-body fill barely shifts under a brightness filter alone. */\n.bh-part.bh-hover-link .bh-body-fill {\n    fill: var(--bh-accent, var(--primary)) !important;\n    fill-opacity: 0.55 !important;\n    filter: drop-shadow(0 0 5px var(--bh-accent, var(--primary))) !important;\n    stroke: var(--bh-accent, var(--primary)) !important;\n    stroke-width: 2 !important;\n    stroke-opacity: 0.95 !important;\n}\n.bh-slot-card.bh-hover-link {\n    background: color-mix(in srgb, var(--bh-accent) 10%, transparent);\n    border-color: color-mix(in srgb, var(--bh-accent) 55%, transparent);\n}\n.bh-slot-card.bh-hover-link::before {\n    box-shadow: 0 0 6px var(--bh-accent, var(--primary));\n}\n.bh-chip-spanning.bh-hover-link {\n    background: color-mix(in srgb, var(--bh-accent) 14%, transparent);\n    border-color: color-mix(in srgb, var(--bh-accent) 60%, transparent);\n}\n\n/* Spine line — back-view anchor so users know they're seeing the back. */\n.bh-spine-line {\n    stroke: var(--bh-body);\n    stroke-width: 0.8;\n    stroke-opacity: 0.35;\n    stroke-dasharray: 2 3;\n    fill: none;\n}\n\n/* Count badges on body parts: ×N for multi-wounds, +N for layered clothes.\n   Solves the \"1 wound vs 3 wounds look identical in fill intensity\" and\n   \"I can't tell if there's a cloak over my chest tunic\" problems. */\n.bh-count-badge { pointer-events: none; }\n.bh-badge-circle { stroke: rgba(0, 0, 0, 0.45); stroke-width: 0.6; }\n.bh-badge-wound-bg  { fill: var(--bh-wound); filter: drop-shadow(0 0 3px rgba(255, 60, 60, 0.55)); }\n.bh-badge-layers-bg { fill: var(--bh-holding); filter: drop-shadow(0 0 3px color-mix(in srgb, var(--bh-chroma) 40%, transparent)); }\n.bh-badge-text {\n    font-size: 7.5px;\n    font-weight: 700;\n    fill: #fff;\n    text-anchor: middle;\n    dominant-baseline: middle;\n    font-family: inherit;\n}\n\n/* Species family tag (top of silhouette, only shown for non-humanoid). */\n.bh-family-tag {\n    fill: var(--bh-accent);\n    font-size: 7px;\n    font-weight: 600;\n    letter-spacing: 1.5px;\n    text-transform: uppercase;\n    opacity: 0.65;\n    font-family: inherit;\n}\n\n/* Stroke-only body parts (digitigrade legs, serpentine tail) — inherit\n   tier/wound strokes from .bh-part-tier-* / .bh-part-wound-*. */\n.bh-silhouette .bh-tail,\n.bh-silhouette .bh-digi-leg {\n    stroke: var(--bh-body);\n    stroke-opacity: 0.45;\n}\n\n/* Wings (v0.4) — drawn behind the body in the SVG layering, slightly\n   reduced opacity so they read as \"behind / further from camera\"\n   rather than competing with the torso. The full saturation comes\n   back on hover-link. Feathered vs leathery just change the path\n   geometry, not the visual treatment. */\n.bh-silhouette .bh-wings {\n    opacity: 0.72;\n}\n.bh-silhouette .bh-wings.bh-part-tier-2,\n.bh-silhouette .bh-wings.bh-part-tier-3,\n.bh-silhouette .bh-wings.bh-part-tier-4 {\n    opacity: 0.9;\n}\n.bh-silhouette .bh-tail.bh-part-tier-2,\n.bh-silhouette .bh-digi-leg.bh-part-tier-2 { stroke: var(--bh-tier-2); stroke-opacity: 1; }\n.bh-silhouette .bh-tail.bh-part-tier-3,\n.bh-silhouette .bh-digi-leg.bh-part-tier-3 { stroke: var(--bh-tier-3); stroke-opacity: 1; }\n.bh-silhouette .bh-tail.bh-part-tier-4,\n.bh-silhouette .bh-digi-leg.bh-part-tier-4 { stroke: var(--bh-tier-4); stroke-opacity: 1; }\n\n/* Off-silhouette slot row hint: a serpentine character's worn boot still\n   shows in the row list, but flagged so users know it doesn't appear on\n   the body diagram. */\n.bh-row-off-body {\n    opacity: 0.6;\n}\n.bh-off-body {\n    display: inline-block;\n    margin-left: 4px;\n    color: var(--bh-tier-2);\n    font-size: 0.85em;\n    opacity: 0.8;\n    cursor: help;\n}\n\n/* ─── Onboarding popover (first-impression explainer) ─────────────────── */\n.beholder-onboard {\n    background: var(--SmartThemeBlurTintColor, rgba(20, 20, 24, 0.95));\n    color: var(--SmartThemeBodyColor, #e0e0e0);\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));\n    border-radius: 12px;\n    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);\n    backdrop-filter: blur(10px);\n    -webkit-backdrop-filter: blur(10px);\n    font-size: 0.875em;\n    line-height: 1.55;\n    animation: bh-onboard-in 0.25s ease-out;\n}\n.beholder-onboard .bh-onboard-title {\n    font-family: Cinzel, \"Trajan Pro\", Georgia, serif;\n    font-weight: 600;\n    letter-spacing: 0.1em;\n    font-size: 1.05em;\n}\n/* The reference set placement, padding and stacking inline from its own JavaScript, so\n   the ported rules describe a box that never positioned itself. Only the coordinates\n   come from script here; everything that is not per-instance belongs in the sheet.\n   Above the panel's own layer, including the 80 it takes on a phone. */\n.beholder-onboard {\n    position: fixed;\n    z-index: 200;\n    padding: var(--bh-space-3, 10px) var(--bh-space-3, 10px) var(--bh-space-2, 6px);\n}\n.beholder-onboard .bh-onboard-head {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: var(--bh-space-2, 6px);\n}\n.beholder-onboard .bh-onboard-close {\n    border: 0;\n    background: none;\n    color: inherit;\n    opacity: 0.6;\n    cursor: pointer;\n    font-size: 0.95em;\n}\n.beholder-onboard .bh-onboard-close:hover { opacity: 1; }\n.beholder-onboard .bh-onboard-tips {\n    margin: var(--bh-space-2, 6px) 0 0;\n    padding-left: 18px;\n}\n.beholder-onboard .bh-onboard-tips li { margin-bottom: 4px; }\n.beholder-onboard .bh-onboard-foot {\n    display: flex;\n    justify-content: flex-end;\n    margin-top: var(--bh-space-2, 6px);\n}\n/* Sitting on top of the panel because there was no room beside it: the arrow would be\n   pointing at the thing it is covering. */\n.beholder-onboard[data-side=\"over\"] .bh-onboard-arrow { display: none; }\n/* The help view's closing line, which the reference styled inline. */\n.bh-help-sign {\n    margin: 0 0 6px;\n    text-align: center;\n    font-family: var(--bh-font-display);\n    font-size: 1.08em;\n    opacity: 0.8;\n}\n/* The token only. The reference hard-codes a fallback gold that this package has\n   deliberately retired in favour of the themed one. */\n.bh-help-sign span { color: var(--bh-gold); }\n@keyframes bh-onboard-in {\n    from { opacity: 0; transform: scale(0.95); }\n    to   { opacity: 1; transform: scale(1); }\n}\n.bh-onboard-arrow {\n    position: absolute;\n    top: 18px;\n    width: 0; height: 0;\n    border-top: 8px solid transparent;\n    border-bottom: 8px solid transparent;\n}\n.beholder-onboard[data-side=\"right\"] .bh-onboard-arrow {\n    right: -8px;\n    border-left: 8px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));\n}\n.beholder-onboard[data-side=\"left\"] .bh-onboard-arrow {\n    left: -8px;\n    border-right: 8px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));\n}\n.bh-onboard-head {\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    padding: 8px 12px;\n    border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));\n}\n.bh-onboard-title {\n    font-weight: 700;\n    color: var(--bh-accent, var(--primary));\n    letter-spacing: 0.5px;\n}\n.bh-onboard-close {\n    cursor: pointer;\n    opacity: 0.55;\n    transition: opacity 0.15s;\n}\n.bh-onboard-close:hover { opacity: 1; }\n.bh-onboard-body {\n    padding: 10px 12px;\n}\n.bh-onboard-body b { color: var(--bh-accent, var(--primary)); font-weight: 600; }\n.bh-onboard-tips {\n    margin: 8px 0 0;\n    padding: 0 0 0 18px;\n    font-size: 0.92em;\n}\n.bh-onboard-tips li {\n    margin: 3px 0;\n    color: var(--SmartThemeBodyColor, #d0d0d0);\n    opacity: 0.85;\n}\n.bh-onboard-foot {\n    padding: 8px 12px 10px;\n    text-align: right;\n    border-top: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.06));\n}\n.bh-onboard-dismiss {\n    background: var(--bh-accent, var(--primary));\n    color: #fff;\n    border: none;\n    padding: 6px 16px;\n    border-radius: 4px;\n    cursor: pointer;\n    font-size: 0.95em;\n    font-weight: 600;\n    letter-spacing: 0.3px;\n}\n.bh-onboard-dismiss:hover { filter: brightness(1.1); }\n\n/* ─── Inline per-message delta badges ─────────────────────────────────── */\n/* Annotates each AI message with what the extractor saw change. Lives in\n   the chat DOM, appended after .mes_text. Shows testers that the extractor\n   ran on this turn; great debug surface for the model itself. */\n.beholder-msg-badges {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 4px;\n    margin: 4px 0 6px;\n    padding: 4px 8px;\n    border-left: 2px solid var(--bh-accent, var(--primary));\n    background: rgba(255, 255, 255, 0.02);\n    border-radius: 0 4px 4px 0;\n    font-size: 0.78em;\n    line-height: 1.45;\n}\n.beholder-msg-noop {\n    color: var(--SmartThemeBodyColor, #aaa);\n    opacity: 0.4;\n    font-style: italic;\n    font-size: 0.75em;\n}\n.bh-msg-badge {\n    display: inline-flex;\n    align-items: center;\n    gap: 4px;\n    padding: 1px 7px 2px;\n    background: rgba(255, 255, 255, 0.04);\n    border: 1px solid rgba(255, 255, 255, 0.08);\n    border-radius: 10px;\n    color: var(--SmartThemeBodyColor, #d0d0d0);\n}\n.bh-msg-char {\n    font-weight: 600;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    font-size: 0.92em;\n}\n.bh-msg-text { opacity: 0.92; }\n\n/* Semantic colors per delta kind */\n.bh-msg-add   { border-color: rgba(106, 212, 139, 0.5); color: #6ad48b; }\n.bh-msg-clear { border-color: rgba(233, 147, 59, 0.5);  color: #e9933b; }\n.bh-msg-hold  { border-color: color-mix(in srgb, var(--bh-chroma) 50%, transparent); color: var(--bh-chroma); }\n.bh-msg-wound { border-color: rgba(255, 82, 82, 0.55);  color: #ff7676; }\n.bh-msg-heal  { border-color: rgba(120, 220, 255, 0.5); color: #78dcff; }\n.bh-msg-mod   { border-color: rgba(136, 170, 255, 0.5); color: #aac3ff; }\n.bh-msg-add .bh-msg-char,\n.bh-msg-clear .bh-msg-char,\n.bh-msg-hold .bh-msg-char,\n.bh-msg-wound .bh-msg-char,\n.bh-msg-heal .bh-msg-char,\n.bh-msg-mod .bh-msg-char {\n    color: inherit;\n    opacity: 0.85;\n}\n\n/* ─── Front / Back view toggle ──────────────────────────────────────────\n   Segmented pill toggle. The whole control is one button (a single click\n   flips the view), but visually it reads as a Front | Back switch with\n   the active label highlighted. */\n.bh-figure-controls {\n    display: flex;\n    justify-content: center;\n    margin-top: var(--bh-space-2);\n}\n.bh-view-toggle {\n    background: var(--bh-surface-1);\n    color: var(--bh-body);\n    border: 1px solid var(--bh-border);\n    border-radius: 999px;\n    padding: var(--bh-space-1) var(--bh-space-3);\n    font: inherit;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    font-weight: 500;\n    letter-spacing: 0.08em;\n    text-transform: uppercase;\n    cursor: pointer;\n    display: inline-flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;\n}\n.bh-view-toggle:hover {\n    background: var(--bh-surface-2);\n    border-color: var(--bh-accent);\n    box-shadow: 0 0 0 3px color-mix(in srgb, var(--bh-accent) 10%, transparent);\n}\n.bh-view-front-label,\n.bh-view-back-label {\n    transition: color 0.15s, opacity 0.15s;\n    opacity: var(--bh-mute-strong);\n}\n.bh-view-active {\n    opacity: 1;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    font-weight: 600;\n}\n.bh-view-sep {\n    opacity: 0.35;\n    font-size: 0.9em;\n    letter-spacing: 0;\n}\n\n/* Damage-tier legend popover (toggled by ? icon in panel header). Solves\n   the \"is this damage or wound severity?\" first-impression confusion. */\n.beholder-legend {\n    padding: var(--bh-space-3) var(--bh-space-3) var(--bh-space-3) var(--bh-space-4);\n    border-bottom: 1px solid var(--bh-divider);\n    font-size: var(--bh-text-secondary);\n    background: var(--bh-surface-1);\n}\n.beholder-legend[hidden] { display: none; }\n.bh-legend-row {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    padding: 2px 0;\n    line-height: 1.3;\n}\n.bh-legend-bar {\n    display: inline-block;\n    width: 3px;\n    height: 14px;\n    border-radius: 2px;\n    flex-shrink: 0;\n}\n.bh-legend-bar.bh-tier-0 { background: var(--bh-tier-0); }\n.bh-legend-bar.bh-tier-1 { background: var(--bh-tier-1); }\n.bh-legend-bar.bh-tier-2 { background: var(--bh-tier-2); }\n.bh-legend-bar.bh-tier-3 { background: var(--bh-tier-3); }\n.bh-legend-bar.bh-tier-4 { background: var(--bh-tier-4); }\n.bh-legend-bar.bh-tier-holding { background: var(--bh-holding); }\n.bh-legend-dot {\n    display: inline-block;\n    width: 8px;\n    height: 8px;\n    border-radius: 50%;\n    background: var(--bh-wound);\n    box-shadow: 0 0 4px var(--bh-wound);\n    margin-left: 0;\n    flex-shrink: 0;\n}\n\n/* Height-only resize handle (bottom edge). Width is intentionally locked —\n   changing it throws off the doll grid columns + chip layouts. The handle\n   is a thin horizontal grip with ns-resize cursor centered on the bottom\n   border so it reads as \"stretch downward\" not \"resize corner\". */\n.beholder-resize-handle {\n    position: absolute;\n    left: 50%;\n    transform: translateX(-50%);\n    bottom: 2px;\n    width: 44px;\n    height: 5px;\n    cursor: ns-resize;\n    z-index: 50;\n    border-radius: 999px;\n    background: var(--bh-border);\n    opacity: 0.55;\n    transition: opacity 0.15s, background 0.15s, width 0.15s;\n}\n.beholder-resize-handle:hover {\n    opacity: 1;\n    background: var(--bh-accent, var(--primary));\n    width: 60px;\n}\n.beholder-panel.beholder-resizing { user-select: none; }\n\n/* ─── Mobile digest ────────────────────────────────────────────────────\n   The narrow-width replacement for the doll grid. Four sections in\n   priority order: Wounds → Held → Worn → State (missing/bare). Each row\n   is one chip + a faint slot annotation on the right. */\n.bh-digest-section {\n    margin-bottom: var(--bh-space-3);\n}\n.bh-digest-section:last-child { margin-bottom: 0; }\n.bh-digest-heading {\n    display: flex;\n    align-items: baseline;\n    gap: var(--bh-space-2);\n    margin: 0 0 var(--bh-space-2);\n    padding-bottom: var(--bh-space-1);\n    border-bottom: 1px solid var(--bh-divider);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    font-weight: 600;\n    letter-spacing: 0.14em;\n    text-transform: uppercase;\n    color: var(--bh-body);\n    opacity: var(--bh-mute-soft);\n}\n.bh-digest-count {\n    font-size: 0.85em;\n    opacity: 0.6;\n    font-weight: 500;\n    margin-left: auto;\n}\n.bh-digest-list {\n    list-style: none;\n    margin: 0;\n    padding: 0;\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-1);\n}\n\n/* Grouped worn list: each anatomical region (head, torso, arms, legs) is a\n   sub-block with its own subheading + nested list. Visually separates a\n   long worn list into 4 scannable chunks instead of one wall. */\n.bh-digest-list-grouped {\n    gap: var(--bh-space-3);\n}\n.bh-digest-group {\n    list-style: none;\n    margin: 0;\n    padding: 0;\n}\n.bh-digest-subhead {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-secondary);\n    font-weight: 600;\n    letter-spacing: 0.1em;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    opacity: 0.85;\n    margin: 0 0 var(--bh-space-2);\n    padding: var(--bh-space-1) 0 var(--bh-space-1) var(--bh-space-2);\n    border-left: 2px solid var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    background: linear-gradient(90deg, color-mix(in srgb, var(--bh-chroma) 6%, transparent), transparent 60%);\n    border-radius: 0 4px 4px 0;\n}\n.bh-digest-group-list {\n    list-style: none;\n    margin: 0;\n    padding: 0;\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-1);\n}\n.bh-digest-row {\n    display: flex;\n    align-items: baseline;\n    gap: var(--bh-space-2);\n    padding: var(--bh-space-1) 0;\n    line-height: 1.35;\n}\n.bh-digest-row .bh-chip {\n    flex: 1 1 auto;\n    min-width: 0;\n}\n.bh-digest-slot {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    text-transform: lowercase;\n    letter-spacing: 0.06em;\n    opacity: 0.55;\n    flex-shrink: 0;\n    text-align: right;\n    align-self: center;\n}\n.bh-digest-layer {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 600;\n    color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary)));\n    opacity: 0.65;\n    margin-left: var(--bh-space-1);\n    flex-shrink: 0;\n}\n.bh-digest-flag {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 600;\n    text-transform: uppercase;\n    letter-spacing: 0.12em;\n    padding: 2px 8px;\n    border: 1px solid var(--bh-border);\n    border-radius: 3px;\n    flex-shrink: 0;\n}\n.bh-digest-flag-missing {\n    color: rgba(160, 160, 160, 0.95);\n    border-color: rgba(140, 140, 140, 0.4);\n    background: rgba(140, 140, 140, 0.06);\n}\n.bh-digest-flag-bare {\n    color: rgba(220, 188, 156, 0.95);\n    border-color: rgba(220, 188, 156, 0.4);\n    background: rgba(220, 188, 156, 0.06);\n}\n.bh-digest-row-flag {\n    justify-content: space-between;\n}\n/* Section-level color cues, semantic (not nth-of-type — those break when an\n   earlier section is filtered out). */\n.bh-digest-section-wounds .bh-digest-heading { color: var(--bh-wound); }\n.bh-digest-section-held   .bh-digest-heading { color: var(--bh-holding); }\n\n/* ─── Mobile digest × view-ladder filters ──────────────────────────────\n   The doll-grid selectors above don't fire in mobile (the grid is\n   display:none). These mirror the same hide semantics for the digest. */\n\n/* hide-wounds: drop the whole wounds section + heading + count. */\n.beholder-panel.bh-hide-wounds .bh-digest-section-wounds {\n    display: none !important;\n}\n\n/* hide-damage: tier-colored heading on wounds is fine (it's wound color,\n   not damage). But neutralize held heading's gold \"holding\" tint so the\n   visual budget matches the wider hide-damage view. */\n.beholder-panel.bh-hide-damage .bh-digest-section-held .bh-digest-heading {\n    color: var(--bh-body) !important;\n    opacity: var(--bh-mute-soft);\n}\n\n/* hide-meta: drop multi-slot tag inside digest rows (already covered by\n   .bh-chip-multi rule above, no extra rule needed here). */\n\n\n/* ─── Hide color ─────────────────────────────────────────────────────────\n   The chip swatch (the small color square next to each item name) is now\n   IDENTITY — it always renders, even with this layer off, because color is\n   often the cheapest way to distinguish one of two similar items at a glance\n   (\"the *red* cloak vs the *blue* cloak\"). The Color layer instead toggles\n   the verbose color label inside the chip's wrapping row (\"rust-red leather\"\n   etc.). Identity stays visible; verbose annotation is opt-in. */\n.beholder-panel.bh-hide-color .bh-chip-verbose-color {\n    display: none !important;\n}\n\n/* ─── Hide wounds — drop wound chips + body-part red tint ──────────────── */\n.beholder-panel.bh-hide-wounds .bh-chip-wound {\n    display: none !important;\n}\n/* Restore the default body-part fill / stroke (var(--bh-body-soft) is the\n   default `.bh-body-fill` color; var(--bh-body) is text-near-white and was\n   the white-out bug). */\n.beholder-panel.bh-hide-wounds .bh-body-fill.bh-part-wound-1,\n.beholder-panel.bh-hide-wounds .bh-body-fill.bh-part-wound-2,\n.beholder-panel.bh-hide-wounds .bh-body-fill.bh-part-wound-3 {\n    fill: var(--bh-body-soft) !important;\n    stroke: var(--bh-body) !important;\n    stroke-opacity: 0.45 !important;\n    filter: none !important;\n}\n/* Compact mode equivalent */\n.beholder-panel.bh-hide-wounds .beholder-wound,\n.beholder-panel.bh-hide-wounds .beholder-row:has(.beholder-wound) { display: none !important; }\n\n/* ─── Hide gear damage tier — every damage visual neutralized ─────────── */\n.beholder-panel.bh-hide-damage .bh-chip-verbose-dmg { display: none !important; }\n.beholder-panel.bh-hide-damage .bh-chip-dot { display: none !important; }\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-0,\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-1,\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-2,\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-3,\n.beholder-panel.bh-hide-damage .bh-chip.bh-tier-4 {\n    color: inherit !important;\n}\n/* Per-chip damage bar — kill the chip-bar CSS var so the ::before becomes\n   transparent. Covers both inline chips AND the layered-wrapper bars. */\n.beholder-panel.bh-hide-damage .bh-chip,\n.beholder-panel.bh-hide-damage .bh-chip-layered {\n    --chip-bar: transparent !important;\n}\n/* Body-part armor-tier stroke off */\n.beholder-panel.bh-hide-damage .bh-body-fill.bh-part-tier-2,\n.beholder-panel.bh-hide-damage .bh-body-fill.bh-part-tier-3,\n.beholder-panel.bh-hide-damage .bh-body-fill.bh-part-tier-4 {\n    stroke: none !important;\n    stroke-width: 0 !important;\n}\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-tail.bh-part-tier-2,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-tail.bh-part-tier-3,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-tail.bh-part-tier-4,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-digi-leg.bh-part-tier-2,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-digi-leg.bh-part-tier-3,\n.beholder-panel.bh-hide-damage .bh-silhouette .bh-digi-leg.bh-part-tier-4 {\n    stroke-opacity: 0 !important;\n}\n/* Held items: drop the gold glyph tint to neutral too */\n.beholder-panel.bh-hide-damage .bh-chip-hold .bh-chip-glyph {\n    color: inherit !important;\n    text-shadow: none !important;\n}\n/* ─── Backfill status strip ──────────────────────────────────────────────\n   Sits between the header and the layer bar. Two modes — offer banner (on\n   chat change, before the run) and progress strip (during the run). Quiet\n   surface tint + thin divider so it reads as system chrome, not a chip.    */\n.beholder-backfill-status {\n    padding: var(--bh-space-2) var(--bh-space-3);\n    /* Gold left-edge + faint tint so this reads as the same CTA family as the\n       no-model banner (which sits directly below it). */\n    background: linear-gradient(\n        90deg,\n        color-mix(in srgb, var(--bh-accent) 10%, transparent),\n        color-mix(in srgb, var(--bh-accent) 2%, transparent) 60%,\n        transparent\n    );\n    border-bottom: 1px solid color-mix(in srgb, var(--bh-accent) 40%, transparent);\n    box-shadow: inset 3px 0 0 var(--bh-gold-deep);\n    font-size: var(--bh-text-secondary);\n}\n.beholder-backfill-status[hidden] { display: none; }\n.bh-bf-progress {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-3);\n    flex-wrap: wrap;\n}\n.bh-bf-text { flex: 1 1 auto; opacity: 0.85; line-height: 1.45; }\n.beholder-backfill-status .bh-btn {\n    padding: 7px 14px;\n    font-size: var(--bh-text-secondary);\n}\n.bh-bf-bar {\n    flex: 0 1 120px;\n    height: 6px;\n    background: var(--bh-divider);\n    border-radius: 3px;\n    overflow: hidden;\n}\n.bh-bf-bar-fill {\n    display: block;\n    height: 100%;\n    background: var(--bh-accent, var(--primary));\n    transition: width 0.2s ease-out;\n}\n\n/* ─── Backfill split-button + menu ───────────────────────────────────────\n   Header \"history\" control is a 2-part split button: clock icon (default\n   action) + caret (opens a small dropdown menu with the less-frequent\n   ops — re-seed-only, rebuild-from-scratch). Menu is absolute-positioned\n   so the panel layout doesn't reflow when it opens. */\n.beholder-backfill-group {\n    display: inline-flex;\n    align-items: center;\n    gap: 3px;\n    position: relative;\n}\n.beholder-backfill-group .beholder-backfill-more {\n    /* The click handler is on this element, so its box IS the hit target. It used\n       to be font-size:0.7em + padding:0 2px — a near-unclickable sliver you had to\n       hit pixel-perfect. Give it a real, comfortable button-sized target. */\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    font-size: 0.82em;\n    line-height: 1;\n    min-width: 20px;\n    min-height: 22px;\n    padding: 4px 6px;\n    cursor: pointer;\n    border-radius: 5px;\n    transition: background .12s ease, color .12s ease;\n}\n.beholder-backfill-group .beholder-backfill-more:hover {\n    background: var(--bh-surface-2, rgba(255, 255, 255, 0.09));\n    color: var(--bh-accent, var(--primary));\n}\n.beholder-backfill-group.bh-menu-open .beholder-backfill-more {\n    opacity: 1;\n    color: var(--bh-accent, var(--primary));\n}\n\n.beholder-bf-menu {\n    /* Rendered to <body> + fixed-positioned by panel.js at the caret, so the\n       panel's overflow:hidden + container-type can't clip it. The gold brand\n       tokens are scoped to .beholder-panel; this menu lives on <body>, so it\n       re-declares the ones it + its items use (otherwise it renders unbranded). */\n    --bh-accent: var(--primary);\n    --bh-chroma: var(--marinara-chat-chrome-accent, var(--primary));\n    --bh-gold: var(--bh-chroma);\n    --bh-gold-deep: var(--bh-accent);\n    --bh-border: rgba(255, 255, 255, 0.18);\n    --bh-surface-2: rgba(255, 255, 255, 0.07);\n    --bh-mute-soft: 0.7;\n    position: fixed;\n    z-index: 10001;\n    min-width: 240px;\n    max-width: min(320px, calc(100vw - 16px));\n    padding: 4px;\n    /* Match the panel's surface exactly (host theme tint), not a hardcoded dark. */\n    background: var(--SmartThemeBlurTintColor, rgba(20, 20, 24, 0.92));\n    border: 1px solid var(--bh-border);\n    border-radius: 8px;\n    box-shadow: rgba(0, 0, 0, 0.55) 0 8px 28px;\n    backdrop-filter: blur(10px);\n    -webkit-backdrop-filter: blur(10px);\n    display: flex;\n    flex-direction: column;\n    gap: 1px;\n    color: var(--SmartThemeBodyColor, #cfd2d6);\n    font-size: 0.875em;\n}\n/* Gold top hairline — matches the .beholder-tools-menu header dropdown. */\n.beholder-bf-menu::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    border-radius: 8px 8px 0 0;\n    background: linear-gradient(90deg, var(--bh-gold-deep), color-mix(in srgb, var(--bh-accent) 35%, transparent) 40%, transparent 80%);\n    opacity: 0.75;\n}\n.beholder-bf-menu .bh-bf-mode {\n    display: flex;\n    flex-direction: row;\n    align-items: flex-start;\n    gap: 9px;\n    width: 100%;\n    padding: 9px 11px;\n    background: transparent;\n    border: none;\n    border-radius: 5px;\n    color: inherit;\n    text-align: left;\n    cursor: pointer;\n    font: inherit;\n    line-height: 1.35;\n    transition: background 0.12s;\n}\n/* Gold leading icon — the brand's accent, same as the tools (⋯) menu items. */\n.beholder-bf-menu .bh-bf-mode > i {\n    flex-shrink: 0;\n    width: 16px;\n    margin-top: 2px;\n    text-align: center;\n    color: var(--bh-gold-deep);\n}\n.beholder-bf-menu .bh-bf-mode-text {\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    min-width: 0;\n}\n.beholder-bf-menu .bh-bf-mode:hover,\n.beholder-bf-menu .bh-bf-mode:focus-visible {\n    background: var(--bh-surface-2);\n    outline: none;\n}\n.beholder-bf-menu .bh-bf-mode-title {\n    font-weight: 600;\n    color: var(--SmartThemeBodyColor, #e6e6e6);\n}\n.beholder-bf-menu .bh-bf-mode-sub {\n    opacity: var(--bh-mute-soft);\n    font-size: 0.9em;\n}\n.beholder-bf-menu .bh-bf-mode-danger > i,\n.beholder-bf-menu .bh-bf-mode-danger .bh-bf-mode-title {\n    color: #ff9888;\n}\n.beholder-bf-menu .bh-bf-mode-danger:hover .bh-bf-mode-title {\n    color: #ffb0a0;\n}\n\n/* ══════════════════════════════════════════════════════════════════════════\n   Gold brand overlay — buttons, header tools, paired grid, layout switch,\n   bottom-sheet editor, view overlays (settings / doctor / inspector / help),\n   the desktop slot editor, slot lock/edit decoration, and toasts. All of\n   these read from the gold + surface + space tokens declared on\n   .beholder-panel above.\n   ══════════════════════════════════════════════════════════════════════════ */\n\n/* Quiet brand mark before the panel title — a small filled lens glyph. */\n.beholder-panel-title::before {\n    content: \"◉\";\n    color: var(--bh-gold-deep);\n    margin-right: 0.45em;\n    font-size: 0.82em;\n    text-shadow: color-mix(in srgb, var(--bh-accent) 55%, transparent) 0 0 9px;\n    vertical-align: 0.06em;\n}\n\n/* Defensive: hide any residual char-head gauge element (stamina retired). */\n.beholder-panel .bh-char-head .bh-gauge { display: none !important; }\n\n/* Idle (untracked) facial features on the silhouette render faintly so the\n   face still reads as a face even when no eye/ear/mouth slot is populated. */\n.bh-silhouette .bh-face-idle { fill: rgba(207, 210, 214, 0.1); stroke-opacity: 0.28; }\n\n/* Onboarding popover — gold restyle (higher-specificity overrides of the\n   neutral defaults above). */\n.beholder-onboard .bh-onboard-title {\n    color: var(--bh-gold-deep, var(--bh-accent, var(--primary)));\n    font-family: \"Cinzel\", \"Trajan Pro\", \"Georgia\", serif;\n}\n.beholder-onboard .bh-onboard-body b { color: var(--bh-chroma, var(--primary)); }\n.beholder-onboard .bh-onboard-dismiss {\n    background: linear-gradient(160deg, color-mix(in srgb, var(--bh-accent) 28%, transparent), color-mix(in srgb, var(--bh-accent) 10%, transparent));\n    border: 1px solid color-mix(in srgb, var(--bh-accent) 60%, transparent);\n    color: var(--bh-chroma, var(--primary));\n}\n.beholder-onboard .bh-onboard-dismiss:hover {\n    filter: none;\n    box-shadow: color-mix(in srgb, var(--bh-accent) 25%, transparent) 0 4px 18px;\n}\n\n/* ─── Button family ──────────────────────────────────────────────────────\n   Shared pill button used across the view overlays + editors. */\n.bh-btn {\n    display: inline-flex;\n    align-items: center;\n    gap: 7px;\n    padding: 5px 12px;\n    border-radius: 7px;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    letter-spacing: 0.05em;\n    border: 1px solid var(--bh-border);\n    background: var(--bh-surface-1);\n    color: var(--bh-body);\n    cursor: pointer;\n    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s, transform 0.1s;\n}\n.bh-btn:active { transform: scale(0.97); }\n.bh-btn:hover {\n    border-color: var(--bh-gold-deep);\n    color: var(--SmartThemeBodyColor, #e8eaee);\n}\n.bh-btn-primary {\n    background: linear-gradient(160deg, color-mix(in srgb, var(--bh-accent) 24%, transparent), color-mix(in srgb, var(--bh-accent) 7%, transparent));\n    border-color: color-mix(in srgb, var(--bh-accent) 60%, transparent);\n    color: var(--bh-chroma, var(--primary));\n}\n.bh-btn-primary:hover {\n    box-shadow: color-mix(in srgb, var(--bh-accent) 22%, transparent) 0 4px 18px;\n    border-color: var(--bh-gold-deep);\n}\n.bh-btn-danger {\n    border-color: rgba(255, 130, 110, 0.45);\n    color: rgb(255, 152, 136);\n}\n.bh-btn-danger:hover {\n    border-color: rgb(255, 152, 136);\n    color: rgb(255, 176, 160);\n    box-shadow: none;\n}\n.bh-btn[disabled] { opacity: 0.45; pointer-events: none; }\n/* A destructive button waiting for its second press. Filled rather than outlined, so\n   the armed state is obvious at a glance and cannot be confused with the resting one. */\n.bh-btn-danger.bh-btn-armed {\n    background: rgb(255, 152, 136);\n    border-color: rgb(255, 152, 136);\n    color: rgb(32, 12, 10);\n    font-weight: 600;\n}\n\n/* ─── Header tool icons + overflow menu ──────────────────────────────────\n   The flat icon row (settings / doctor / inspector / help) + a \"⋯\" overflow\n   trigger, separated from the backfill group and close button by thin\n   dividers. The icons collapse into the overflow menu at narrow widths\n   (see the 360px container query above). */\n.beholder-tool-btn:focus-visible {\n    outline: 1px solid var(--bh-gold-deep);\n    outline-offset: 2px;\n    border-radius: 3px;\n    opacity: 1;\n}\n.beholder-panel-controls .bh-header-sep {\n    width: 1px;\n    height: 14px;\n    align-self: center;\n    flex-shrink: 0;\n    margin: 0 1px;\n    background: var(--bh-border);\n    opacity: 0.8;\n}\n/* Scoped for the same reason as the tool row: the FA shim would otherwise keep this\n   overflow trigger visible on wide panels, where the tool row is already shown. */\n.beholder-panel .beholder-tools-more { display: none; }\n.beholder-tools-more.bh-more-open { opacity: 1; color: var(--bh-accent); }\n.beholder-tools-menu {\n    position: absolute;\n    top: calc(100% + 5px);\n    right: var(--bh-space-3);\n    z-index: 10001;\n    min-width: 180px;\n    padding: var(--bh-space-1);\n    background: rgba(16, 18, 24, 0.98);\n    border: 1px solid var(--bh-border);\n    border-radius: 8px;\n    box-shadow: rgba(0, 0, 0, 0.55) 0 8px 28px;\n    display: flex;\n    flex-direction: column;\n    gap: 1px;\n}\n.beholder-tools-menu::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    border-radius: 8px 8px 0 0;\n    background: linear-gradient(90deg, var(--bh-gold-deep), color-mix(in srgb, var(--bh-accent) 35%, transparent) 40%, transparent 80%);\n    opacity: 0.75;\n}\n.beholder-tools-item {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    width: 100%;\n    padding: 9px 11px;\n    background: transparent;\n    border: none;\n    border-radius: 5px;\n    color: var(--SmartThemeBodyColor, #e6e6e6);\n    font: inherit;\n    font-size: var(--bh-text-body);\n    text-align: left;\n    cursor: pointer;\n    transition: background 0.12s;\n}\n.beholder-tools-item:hover,\n.beholder-tools-item:focus-visible {\n    background: var(--bh-surface-2);\n    outline: none;\n}\n.beholder-tools-item i { width: 17px; text-align: center; color: var(--bh-gold-deep); }\n\n/* ─── Paired doll grid ───────────────────────────────────────────────────\n   Left / center figure / right column layout. Each anatomical pair sits\n   across columns 1 and 3; the empty half of a populated pair gets a faint\n   ghost card so the grid stays balanced. (Collapses to the digest at narrow\n   widths via the 360px container query above.) */\n.bh-doll-grid.bh-paired {\n    display: grid;\n    /* minmax(0, …) side tracks — see the base .bh-doll-grid note. Extra-important here\n       because `.bh-col { display: contents }` below dissolves the columns, so the SLOT\n       CARDS are the direct grid items; a bare `1fr` would size to the widest card's\n       min-content and push the right column over the panel edge. */\n    grid-template-columns: minmax(0, 1fr) minmax(calc(132px * var(--bh-ui-scale, 1)), calc(148px * var(--bh-ui-scale, 1))) minmax(0, 1fr);\n    gap: calc(4px * var(--bh-ui-scale, 1)) calc(6px * var(--bh-ui-scale, 1));\n    align-items: stretch;\n}\n.bh-doll-grid.bh-paired .bh-col { display: contents; }\n.bh-doll-grid.bh-paired .bh-figure { align-self: start; }\n.bh-doll-grid.bh-paired .bh-slot-ghosted { opacity: 0.22; }\n.bh-doll-grid.bh-paired .bh-slot-ghosted:hover { opacity: 0.5; }\n\n/* ─── Layout switch (paired / columns / list) ────────────────────────────\n   List mode forces the digest render via .bh-layout-compact. */\n.beholder-panel.bh-layout-compact .bh-doll-grid { display: none; }\n.beholder-panel.bh-layout-compact .bh-digest { display: block; }\n.bh-layout-switch {\n    display: inline-flex;\n    margin-top: var(--bh-space-2);\n    border: 1px solid var(--bh-border);\n    border-radius: 999px;\n    overflow: hidden;\n    background: var(--bh-surface-1);\n}\n.bh-layout-switch .bh-ls-opt {\n    background: transparent;\n    border: none;\n    cursor: pointer;\n    color: var(--bh-body);\n    opacity: var(--bh-mute-strong);\n    padding: 2px 9px;\n    font-size: var(--bh-text-meta);\n    line-height: 1.2;\n    transition: background 0.15s, color 0.15s, opacity 0.15s;\n}\n.bh-layout-switch .bh-ls-opt + .bh-ls-opt { border-left: 1px solid var(--bh-divider); }\n.bh-layout-switch .bh-ls-opt:hover {\n    opacity: 0.85;\n    color: var(--SmartThemeBodyColor, #e8eaee);\n}\n.bh-layout-switch .bh-ls-opt.bh-ls-active {\n    opacity: 1;\n    color: var(--bh-gold, var(--bh-chroma, var(--primary)));\n    background: var(--bh-surface-2);\n}\n.bh-layout-switch-row { display: flex; justify-content: flex-end; }\n\n/* Digest toolbar — \"Edit slots\" action on the left, a layout switch on the\n   right, above the digest priority feed. */\n.bh-digest-toolbar {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: var(--bh-space-2);\n    margin-bottom: var(--bh-space-3);\n}\n.bh-digest-edit {\n    display: inline-flex;\n    align-items: center;\n    gap: 7px;\n    padding: 6px 14px;\n    border-radius: 8px;\n    background: linear-gradient(160deg, color-mix(in srgb, var(--bh-accent) 20%, transparent), color-mix(in srgb, var(--bh-accent) 6%, transparent));\n    border: 1px solid color-mix(in srgb, var(--bh-accent) 50%, transparent);\n    color: var(--bh-chroma, var(--primary));\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    letter-spacing: 0.05em;\n    cursor: pointer;\n    transition: box-shadow 0.15s, border-color 0.15s;\n}\n.bh-digest-edit:hover {\n    box-shadow: color-mix(in srgb, var(--bh-accent) 20%, transparent) 0 3px 14px;\n    border-color: var(--bh-gold-deep);\n}\n.bh-digest-edit i { font-size: 0.9em; }\n\n/* ─── Mobile bottom sheet (slot picker + slot editor) ────────────────────\n   Slides up from the bottom of the panel on touch / narrow layouts. */\n.bh-sheet-backdrop {\n    position: absolute;\n    inset: 0;\n    z-index: 95;\n    background: rgba(0, 0, 0, 0.45);\n    animation: 0.15s ease-out bh-view-in;\n}\n.bh-edit-sheet {\n    position: absolute;\n    left: 0;\n    right: 0;\n    bottom: 0;\n    z-index: 96;\n    max-height: 88%;\n    display: flex;\n    flex-direction: column;\n    background: var(--SmartThemeBlurTintColor, rgba(13, 15, 20, 0.98));\n    border-top: 1px solid var(--bh-border);\n    border-radius: 14px 14px 0 0;\n    box-shadow: rgba(0, 0, 0, 0.6) 0 -10px 40px;\n    animation: 0.2s cubic-bezier(0.2, 0.7, 0.2, 1) bh-sheet-up;\n}\n@keyframes bh-sheet-up {\n    0% { transform: translateY(100%); }\n    100% { transform: none; }\n}\n@media (prefers-reduced-motion: reduce) {\n    .bh-edit-sheet { animation: none; }\n    .bh-sheet-backdrop { animation: none; }\n}\n.bh-edit-sheet::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    border-radius: 14px 14px 0 0;\n    background: linear-gradient(90deg, var(--bh-gold-deep) 0%, color-mix(in srgb, var(--bh-accent) 40%, transparent) 22%, transparent 60%);\n    opacity: 0.8;\n}\n.bh-sheet-head {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    padding: var(--bh-space-3);\n    border-bottom: 1px solid var(--bh-divider);\n    flex-shrink: 0;\n}\n.bh-sheet-back,\n.bh-sheet-close {\n    cursor: pointer;\n    opacity: var(--bh-mute-soft);\n    padding: 5px;\n    font-size: 1.05em;\n    transition: opacity 0.15s, color 0.15s;\n}\n.bh-sheet-back[hidden] { display: none; }\n.bh-sheet-back:hover,\n.bh-sheet-close:hover { opacity: 1; color: var(--bh-gold-deep); }\n.bh-sheet-title {\n    flex: 1 1 0%;\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-large);\n    font-weight: 600;\n    letter-spacing: 0.06em;\n}\n.bh-sheet-close { margin-left: auto; }\n.bh-sheet-body {\n    flex: 1 1 0%;\n    overflow-y: auto;\n    padding: var(--bh-space-3);\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n}\n.bh-sheet-lockrow {\n    display: flex;\n    justify-content: flex-end;\n    margin-bottom: var(--bh-space-2);\n}\n.bh-sheet-body .bh-editor-body { max-height: none; overflow: visible; padding: 0; }\n.bh-sheet-body .bh-editor-foot {\n    border-top: 1px solid var(--bh-divider);\n    margin-top: var(--bh-space-3);\n    padding: var(--bh-space-3) 0 0;\n    background: transparent;\n}\n.bh-slot-picker { display: flex; flex-direction: column; gap: var(--bh-space-3); }\n.bh-pick-region-head {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.16em;\n    text-transform: uppercase;\n    color: var(--bh-gold-deep);\n    margin-bottom: var(--bh-space-1);\n}\n.bh-pick-slot {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    width: 100%;\n    padding: 10px 12px;\n    margin-bottom: 3px;\n    background: var(--bh-surface-1);\n    border: 1px solid var(--bh-divider);\n    border-radius: 8px;\n    color: var(--bh-body);\n    font: inherit;\n    text-align: left;\n    cursor: pointer;\n    transition: background 0.12s, border-color 0.12s;\n}\n.bh-pick-slot:hover,\n.bh-pick-slot:focus-visible {\n    background: var(--bh-surface-2);\n    border-color: var(--bh-gold-deep);\n    outline: none;\n}\n.bh-pick-label {\n    flex-shrink: 0;\n    min-width: 5.5em;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-secondary);\n    letter-spacing: 0.04em;\n    text-transform: lowercase;\n    color: var(--SmartThemeBodyColor, #e6e6e6);\n}\n.bh-pick-summary {\n    flex: 1 1 0%;\n    min-width: 0;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    font-size: var(--bh-text-secondary);\n    opacity: 0.85;\n}\n.bh-pick-summary.bh-pick-empty { opacity: 0.4; font-style: italic; }\n.bh-pick-summary.bh-pick-bare { color: rgba(220, 188, 156, 0.95); opacity: 1; }\n.bh-pick-summary.bh-pick-missing { color: rgba(160, 160, 160, 0.95); font-style: italic; opacity: 1; }\n.bh-pick-mark { flex-shrink: 0; font-size: 0.85em; }\n.bh-pick-lock { color: var(--bh-gold); }\n.bh-pick-edited { color: var(--bh-gold-deep); }\n.bh-pick-arrow { flex-shrink: 0; opacity: 0.4; font-size: 0.8em; }\n\n/* ─── View overlay (settings / doctor / inspector / help) ────────────────\n   Full-panel overlay surface with its own header, scroll body, and a set of\n   collapsible sections. */\n.bh-view {\n    position: absolute;\n    inset: 0;\n    z-index: 60;\n    display: flex;\n    flex-direction: column;\n    /* Opaque on purpose, and the same surface the editor popover uses. The reference\n       reads its host's tint variable here, which in this host resolves translucent —\n       the paper doll showed through the text and made it unreadable. */\n    background: rgb(16, 18, 24);\n    border-radius: 12px;\n    overflow: hidden;\n    animation: 0.18s ease-out bh-view-in;\n}\n@keyframes bh-view-in {\n    0% { opacity: 0; transform: translateY(6px); }\n    100% { opacity: 1; transform: none; }\n}\n@media (prefers-reduced-motion: reduce) {\n    .bh-view { animation: none; }\n}\n.bh-view-head {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    padding: var(--bh-space-2) var(--bh-space-3);\n    background: var(--bh-surface-2);\n    border-bottom: 1px solid var(--bh-divider);\n    position: relative;\n    flex-shrink: 0;\n    cursor: move;\n}\n.bh-view-head::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    background: linear-gradient(90deg, var(--bh-gold-deep) 0%, color-mix(in srgb, var(--bh-accent) 40%, transparent) 22%, transparent 60%);\n    opacity: 0.7;\n}\n.bh-view-back {\n    cursor: pointer;\n    opacity: var(--bh-mute-soft);\n    padding: 2px 6px 2px 2px;\n    transition: opacity 0.15s, color 0.15s;\n}\n.bh-view-back:hover { opacity: 1; color: var(--bh-gold-deep); }\n.bh-view-title {\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-large);\n    font-weight: 600;\n    letter-spacing: 0.1em;\n}\n.bh-view-title .bh-view-crumb {\n    opacity: 0.45;\n    font-size: 0.82em;\n    letter-spacing: 0.08em;\n    margin-right: 0.4em;\n}\n.bh-view-body {\n    flex: 1 1 0%;\n    overflow-y: auto;\n    padding: var(--bh-space-3);\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n    font-size: var(--bh-text-secondary);\n    user-select: text;\n}\n.bh-vsection {\n    border: 1px solid var(--bh-divider);\n    border-radius: 10px;\n    background: var(--bh-surface-1);\n    margin-bottom: var(--bh-space-3);\n    overflow: hidden;\n}\n.bh-vsection > summary {\n    list-style: none;\n    cursor: pointer;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 600;\n    letter-spacing: 0.18em;\n    text-transform: uppercase;\n    color: var(--bh-gold-deep);\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    user-select: none;\n}\n.bh-vsection > summary::-webkit-details-marker { display: none; }\n.bh-vsection > summary::after {\n    content: \"›\";\n    margin-left: auto;\n    opacity: 0.5;\n    transition: transform 0.15s;\n    font-size: 1.25em;\n    letter-spacing: 0;\n}\n.bh-vsection[open] > summary::after { transform: rotate(90deg); }\n.bh-vsection-body {\n    padding: 0 var(--bh-space-3) var(--bh-space-3);\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-3);\n}\n.bh-vsection-body p { margin: 0; opacity: 0.8; line-height: 1.5; }\n/* The Advanced > custom-endpoint body is NOT a .bh-vsection-body, so it missed the\n   column-gap spacing and its endpoint/model/key bars stacked flush. Match the same\n   rhythm so each field has a few px of breathing room under it. */\n.bh-adv-endpoint-body {\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-3);\n}\n.bh-field { display: flex; flex-direction: column; gap: 3px; }\n.bh-field > label {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.08em;\n    text-transform: uppercase;\n    opacity: 0.6;\n}\n.bh-input,\n.bh-select {\n    background: rgba(0, 0, 0, 0.25);\n    border: 1px solid var(--bh-border);\n    border-radius: 6px;\n    color: var(--SmartThemeBodyColor, #e6e6e6);\n    font: inherit;\n    padding: 6px 9px;\n    width: 100%;\n    box-sizing: border-box;\n    transition: border-color 0.15s, box-shadow 0.15s;\n}\n.bh-input:focus-visible,\n.bh-select:focus-visible {\n    outline: none;\n    border-color: var(--bh-gold-deep);\n    box-shadow: color-mix(in srgb, var(--bh-accent) 12%, transparent) 0 0 0 3px;\n}\n.bh-check { display: flex; align-items: baseline; gap: 8px; cursor: pointer; line-height: 1.45; }\n.bh-check input { accent-color: var(--bh-gold-deep); flex-shrink: 0; }\n.bh-check small { display: block; opacity: 0.55; font-size: 0.88em; }\n.bh-row-actions { display: flex; gap: var(--bh-space-2); flex-wrap: wrap; align-items: center; }\n.bh-conn-status {\n    display: inline-flex;\n    align-items: center;\n    gap: 7px;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.06em;\n    opacity: 0.85;\n}\n.bh-dot {\n    width: 8px;\n    height: 8px;\n    border-radius: 50%;\n    flex-shrink: 0;\n    background: var(--bh-mute-strong, #777);\n}\n.bh-dot-ok { background: rgb(106, 212, 139); box-shadow: rgba(106, 212, 139, 0.6) 0 0 6px; }\n.bh-dot-warn { background: var(--bh-accent); box-shadow: color-mix(in srgb, var(--bh-accent) 60%, transparent) 0 0 6px; }\n.bh-dot-bad { background: rgb(226, 100, 100); box-shadow: rgba(226, 100, 100, 0.6) 0 0 6px; }\n.bh-dot-busy { background: var(--bh-gold-deep); animation: 1s ease-in-out infinite bh-dot-pulse; }\n@keyframes bh-dot-pulse {\n    50% { opacity: 0.35; }\n}\n.bh-vitals { display: flex; flex-direction: column; }\n.bh-vital {\n    display: flex;\n    align-items: baseline;\n    gap: 10px;\n    padding: 6px 2px;\n    border-bottom: 1px dashed var(--bh-divider);\n    line-height: 1.4;\n}\n.bh-vital:last-child { border-bottom: none; }\n.bh-vital .bh-dot { align-self: center; }\n.bh-vital-label {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.07em;\n    text-transform: uppercase;\n    opacity: 0.6;\n    flex: 0 0 34%;\n}\n.bh-vital-value { flex: 1 1 0%; min-width: 0; overflow-wrap: anywhere; }\n.bh-vital-value code {\n    background: rgba(255, 255, 255, 0.06);\n    padding: 0 5px;\n    border-radius: 3px;\n    font-size: 0.92em;\n}\n.bh-code {\n    background: rgba(0, 0, 0, 0.32);\n    border: 1px solid var(--bh-divider);\n    border-radius: 8px;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    font-family: var(--bh-font-data);\n    font-size: 0.8em;\n    line-height: 1.5;\n    white-space: pre-wrap;\n    overflow-wrap: anywhere;\n    max-height: 240px;\n    overflow-y: auto;\n    margin: 0;\n    color: var(--bh-body);\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n    user-select: text;\n}\n.bh-pane-meta {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.05em;\n    opacity: 0.5;\n    margin-left: auto;\n    text-transform: none;\n}\n.bh-vlog { display: flex; flex-direction: column; gap: 4px; }\n.bh-vlog-row {\n    display: flex;\n    align-items: baseline;\n    flex-wrap: wrap;\n    gap: 8px;\n    font-family: var(--bh-font-data);\n    font-size: 0.8em;\n    line-height: 1.45;\n    padding: 4px 8px;\n    border-radius: 5px;\n    background: rgba(255, 255, 255, 0.025);\n    border-left: 2px solid var(--bh-divider);\n}\n/* The label keeps its width; the sentence takes the rest and wraps within the row\n   rather than pushing past the panel edge. */\n.bh-vlog-row > b { flex: 0 0 auto; }\n.bh-vlog-row > span { flex: 1 1 12ch; min-width: 0; overflow-wrap: anywhere; }\n.bh-vlog-row b { flex-shrink: 0; font-size: 0.85em; letter-spacing: 0.1em; }\n.bh-vlog-warn { border-left-color: var(--bh-accent); }\n.bh-vlog-warn b { color: var(--bh-accent); }\n.bh-vlog-error { border-left-color: rgb(226, 100, 100); }\n.bh-vlog-error b { color: rgb(255, 118, 118); }\n.bh-vlog-ok { border-left-color: rgb(106, 212, 139); opacity: 0.75; }\n.bh-vlog-ok b { color: rgb(106, 212, 139); }\n.bh-turns { width: 100%; border-collapse: collapse; font-size: 0.85em; }\n.bh-turns th {\n    font-family: var(--bh-font-data);\n    font-size: 0.78em;\n    letter-spacing: 0.1em;\n    text-transform: uppercase;\n    opacity: 0.5;\n    text-align: left;\n    padding: 3px 8px 5px 0;\n    border-bottom: 1px solid var(--bh-divider);\n    font-weight: 500;\n}\n.bh-turns td {\n    padding: 5px 8px 5px 0;\n    border-bottom: 1px dashed var(--bh-divider);\n    font-family: var(--bh-font-data);\n    font-size: 0.92em;\n}\n.bh-turns tr:last-child td { border-bottom: none; }\n/* \"nothing here yet\" is a normal state for a fresh chat, so it reads as quiet\n   information rather than as a row of missing data. */\n.bh-turns-empty { opacity: 0.5; }\n.bh-tips {\n    margin: 0;\n    padding-left: 18px;\n    display: flex;\n    flex-direction: column;\n    gap: 7px;\n}\n.bh-tips li { line-height: 1.5; opacity: 0.85; }\n.bh-tips li::marker { color: var(--bh-gold-deep); }\n.bh-tips b { color: var(--bh-chroma, var(--primary)); font-weight: 600; }\n.bh-orn {\n    display: flex;\n    align-items: center;\n    gap: 14px;\n    margin: var(--bh-space-2) auto;\n    max-width: 220px;\n    color: color-mix(in srgb, var(--bh-accent) 55%, transparent);\n    font-size: 0.85em;\n    text-shadow: color-mix(in srgb, var(--bh-accent) 50%, transparent) 0 0 12px;\n}\n.bh-orn span {\n    flex: 1 1 0%;\n    height: 1px;\n    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--bh-accent) 35%, transparent));\n}\n.bh-orn span:last-child {\n    background: linear-gradient(90deg, color-mix(in srgb, var(--bh-accent) 35%, transparent), transparent);\n}\n\n/* ─── Desktop slot editor (floating popover) ─────────────────────────────\n   Per-slot worn / held / wound editor anchored to the clicked card. */\n.bh-editor {\n    position: absolute;\n    z-index: 80;\n    width: min(330px, 100% - 16px);\n    background: rgba(16, 18, 24, 0.98);\n    border: 1px solid var(--bh-border);\n    border-radius: 10px;\n    box-shadow: rgba(0, 0, 0, 0.6) 0 14px 44px;\n    display: flex;\n    flex-direction: column;\n    overflow: hidden;\n    font-size: var(--bh-text-secondary);\n    animation: 0.15s ease-out bh-view-in;\n}\n.bh-editor-head {\n    display: flex;\n    align-items: center;\n    gap: 9px;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    background: var(--bh-surface-2);\n    border-bottom: 1px solid var(--bh-divider);\n    position: relative;\n}\n.bh-editor-head::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    background: linear-gradient(90deg, var(--bh-gold-deep), color-mix(in srgb, var(--bh-accent) 35%, transparent) 40%, transparent 80%);\n    opacity: 0.7;\n}\n.bh-editor-title {\n    font-family: var(--bh-font-display);\n    font-weight: 600;\n    font-size: var(--bh-text-large);\n    letter-spacing: 0.08em;\n}\n.bh-editor-slot {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.08em;\n    text-transform: lowercase;\n    opacity: 0.55;\n}\n.bh-editor-close { margin-left: auto; cursor: pointer; opacity: 0.6; }\n.bh-editor-close:hover { opacity: 1; color: var(--bh-gold-deep); }\n.bh-editor-body {\n    padding: var(--bh-space-3);\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-2);\n    overflow-y: auto;\n    max-height: 52vh;\n    scrollbar-width: thin;\n    scrollbar-color: var(--bh-border) transparent;\n}\n.bh-editor-group-label {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.16em;\n    text-transform: uppercase;\n    color: var(--bh-gold-deep);\n    opacity: 0.85;\n    margin-top: var(--bh-space-1);\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n.bh-editor-group-label::after { content: \"\"; flex: 1 1 0%; height: 1px; background: var(--bh-divider); }\n.bh-editor-row {\n    display: grid;\n    grid-template-columns: 1fr 86px 74px 22px;\n    gap: 6px;\n    align-items: center;\n}\n.bh-editor-row .bh-input,\n.bh-editor-row .bh-select { padding: 4px 7px; font-size: 0.92em; }\n.bh-editor-row-wound { grid-template-columns: 1fr 86px 24px 22px; }\n.bh-editor-remove {\n    background: none;\n    border: none;\n    color: var(--bh-body);\n    opacity: 0.4;\n    cursor: pointer;\n    font-size: 0.95em;\n    padding: 2px;\n    transition: opacity 0.12s, color 0.12s;\n}\n.bh-editor-remove:hover { opacity: 1; color: rgb(255, 133, 133); }\n.bh-editor-add {\n    align-self: flex-start;\n    background: none;\n    border: 1px dashed var(--bh-border);\n    border-radius: 6px;\n    color: var(--bh-body);\n    opacity: 0.6;\n    cursor: pointer;\n    font: inherit;\n    font-size: 0.88em;\n    padding: 3px 10px;\n    transition: opacity 0.12s, border-color 0.12s, color 0.12s;\n}\n.bh-editor-add:hover { opacity: 1; border-color: var(--bh-gold-deep); color: var(--bh-chroma, var(--primary)); }\n.bh-bleed-check { display: inline-flex; align-items: center; justify-content: center; }\n.bh-bleed-check input { accent-color: rgb(255, 71, 71); }\n.bh-editor-body.bhe-missing-mode > :not(.bh-row-actions):not(.bh-editor-group-label:last-of-type) {\n    opacity: 0.35;\n    pointer-events: none;\n}\n.bh-editor-body.bhe-missing-mode > .bh-row-actions,\n.bh-editor-body.bhe-missing-mode > .bh-editor-group-label:last-of-type {\n    opacity: 1;\n    pointer-events: auto;\n}\n.bh-editor-foot {\n    display: flex;\n    gap: var(--bh-space-2);\n    padding: var(--bh-space-2) var(--bh-space-3);\n    border-top: 1px solid var(--bh-divider);\n    background: var(--bh-surface-1);\n    align-items: center;\n}\n.bh-editor-foot .bh-btn-primary { margin-left: auto; }\n.bh-lock-toggle {\n    display: inline-flex;\n    align-items: center;\n    gap: 6px;\n    cursor: pointer;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.1em;\n    text-transform: uppercase;\n    opacity: 0.6;\n    border: 1px solid var(--bh-border);\n    border-radius: 20px;\n    padding: 2px 10px;\n    transition: opacity 0.15s, border-color 0.15s, color 0.15s;\n    user-select: none;\n}\n.bh-lock-toggle:hover { opacity: 1; }\n.bh-lock-toggle.bh-locked-on {\n    opacity: 1;\n    color: var(--bh-gold);\n    border-color: color-mix(in srgb, var(--bh-chroma) 50%, transparent);\n    text-shadow: color-mix(in srgb, var(--bh-chroma) 40%, transparent) 0 0 8px;\n}\n\n/* ─── Slot card lock / user-edited decoration ────────────────────────────\n   A locked slot is pinned by the user so model deltas can't overwrite it; a\n   user-edited slot carries a small ✎ mark. */\n.bh-slot-card { cursor: pointer; }\n.bh-slot-card.bh-slot-locked {\n    border-color: color-mix(in srgb, var(--bh-accent) 45%, transparent);\n    background: color-mix(in srgb, var(--bh-accent) 5%, transparent);\n}\n.bh-slot-lock-glyph {\n    color: var(--bh-gold);\n    font-size: 0.72em;\n    margin-left: 5px;\n    text-shadow: color-mix(in srgb, var(--bh-chroma) 45%, transparent) 0 0 7px;\n    flex-shrink: 0;\n}\n.bh-slot-card.bh-slot-user-edited .bh-slot-name::after {\n    content: \"✎\";\n    color: var(--bh-gold-deep);\n    font-size: 0.85em;\n    margin-left: 5px;\n    opacity: 0.8;\n}\n\n/* ─── Toast ──────────────────────────────────────────────────────────────\n   Transient confirmation message, centered near the bottom of the viewport. */\n.bh-toast {\n    position: fixed;\n    left: 50%;\n    bottom: 86px;\n    transform: translateX(-50%) translateY(8px);\n    z-index: 99999;\n    background: rgba(16, 18, 24, 0.97);\n    border: 1px solid color-mix(in srgb, var(--bh-accent) 55%, transparent);\n    border-radius: 9px;\n    color: var(--bh-chroma, var(--primary));\n    font: 13px / 1.45 \"JetBrains Mono\", monospace;\n    letter-spacing: 0.03em;\n    padding: 9px 18px;\n    box-shadow: rgba(0, 0, 0, 0.55) 0 10px 34px, color-mix(in srgb, var(--bh-accent) 12%, transparent) 0 0 22px;\n    opacity: 0;\n    transition: opacity 0.2s, transform 0.2s;\n    pointer-events: none;\n    max-width: min(520px, 86vw);\n    text-align: center;\n}\n.bh-toast.bh-toast-in { opacity: 1; transform: translateX(-50%) translateY(0); }\n\n/* ══════════════════════════════════════════════════════════════════════════\n   Local-model card + \"no model active\" banner (browser-engine surfaces)\n   ─────────────────────────────────────────────────────────────────────────\n   Built entirely from the existing gold + surface + space tokens. The card\n   lives at the top of the settings view's Connection section (above the\n   custom-endpoint fields, which move under a collapsed Advanced <details>);\n   the banner is a persistent strip in the panel, modelled on the backfill\n   status strip. No new color system — readiness dots reuse .bh-dot*,\n   buttons reuse .bh-btn family, the progress bar mirrors .bh-bf-bar.\n   ══════════════════════════════════════════════════════════════════════════ */\n\n/* ─── Local-model card ───────────────────────────────────────────────────\n   An elevated panel inside the settings view. Reads as the primary control\n   for the connection section — a touch more presence than a .bh-vsection\n   (gold hairline top rule, like the editor/header chrome) without inventing\n   new tokens. */\n.bh-localmodel-card {\n    position: relative;\n    border: 1px solid var(--bh-border);\n    border-radius: 10px;\n    background: var(--bh-surface-2);\n    padding: var(--bh-space-3);\n    margin-bottom: var(--bh-space-3);\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-2);\n    overflow: hidden;\n}\n/* Quiet gold top rule — same anchored-on-the-left gradient the header and\n   editor use, so the card reads as part of the brand chrome. */\n.bh-localmodel-card::before {\n    content: \"\";\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    height: 1px;\n    background: linear-gradient(\n        90deg,\n        var(--bh-gold-deep),\n        color-mix(in srgb, var(--bh-accent) 35%, transparent) 40%,\n        transparent 80%\n    );\n    opacity: 0.7;\n    pointer-events: none;\n}\n\n/* Card header: a label + the lifecycle status pill. */\n.bh-lm-head {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    flex-wrap: wrap;\n}\n.bh-lm-title {\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-large);\n    font-weight: 600;\n    letter-spacing: 0.08em;\n    color: var(--SmartThemeBodyColor, #e8eaee);\n}\n/* Microchip accent at the right of the head (the leading status dot is the\n   primary marker). */\n.bh-lm-glyph {\n    color: var(--bh-gold-deep);\n    opacity: 0.6;\n    margin-left: auto;\n    font-size: 0.95em;\n}\n/* The pinned model id / version line under the header. */\n.bh-lm-modelid {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    opacity: 0.6;\n    margin: 2px 0 6px;\n}\n.bh-lm-modelid code { font-family: inherit; }\n/* Status pill — a dot + short word (\"ready\", \"off\", \"downloading…\").\n   Reuses the conn-status idiom and the .bh-dot* color set. */\n.bh-lm-status {\n    display: inline-flex;\n    align-items: center;\n    gap: 7px;\n    margin-left: auto;\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.1em;\n    text-transform: uppercase;\n    opacity: 0.85;\n    white-space: nowrap;\n}\n\n/* Descriptive copy line below the header (state-dependent prose). */\n.bh-lm-copy {\n    font-size: var(--bh-text-secondary);\n    line-height: 1.5;\n    opacity: 0.8;\n    margin: 0;\n}\n.bh-lm-copy code {\n    background: rgba(255, 255, 255, 0.06);\n    padding: 0 5px;\n    border-radius: 3px;\n    font-size: 0.92em;\n}\n\n/* ─── Readiness rows (GPU / Disk / RAM) ──────────────────────────────────\n   Same anatomy as the Doctor vitals: a status dot, a mono label, a value.\n   Reuses .bh-dot / .bh-dot-ok / .bh-dot-warn / .bh-dot-bad exactly. */\n.bh-lm-readiness {\n    display: flex;\n    flex-direction: column;\n    border: 1px solid var(--bh-divider);\n    border-radius: 8px;\n    background: var(--bh-surface-1);\n    padding: 0 var(--bh-space-3);\n}\n.bh-lm-readiness-row {\n    display: flex;\n    align-items: baseline;\n    gap: 10px;\n    padding: 6px 0;\n    border-bottom: 1px dashed var(--bh-divider);\n    line-height: 1.4;\n}\n.bh-lm-readiness-row:last-child { border-bottom: none; }\n.bh-lm-readiness-row .bh-dot { align-self: center; }\n.bh-lm-readiness-label {\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.07em;\n    text-transform: uppercase;\n    opacity: 0.6;\n    flex: 0 0 22%;\n    min-width: 56px;\n}\n.bh-lm-readiness-value {\n    flex: 1 1 0%;\n    min-width: 0;\n    overflow-wrap: anywhere;\n    font-size: var(--bh-text-secondary);\n}\n/* \"hint only\" qualifier (RAM is a total-not-free Chromium hint). Quiet\n   trailing note so the honest copy doesn't read as a hard number. */\n.bh-lm-readiness-hint {\n    font-family: var(--bh-font-data);\n    font-size: 0.82em;\n    letter-spacing: 0.04em;\n    opacity: 0.45;\n    margin-left: 6px;\n    text-transform: lowercase;\n}\n/* Actionable help line under a FAILED gate (e.g. how to enable WebGPU per\n   browser) — a readable gold block note, NOT the faint inline qualifier above. */\n.bh-lm-hint {\n    display: block;\n    margin-top: 4px;\n    font-size: 0.86em;\n    line-height: 1.45;\n    color: var(--bh-gold-soft, var(--bh-chroma, var(--primary)));\n    opacity: 0.9;\n}\n/* Card \"update available\" indicator (persists after the dialog is dismissed). */\n.bh-lm-update {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-2);\n    margin: var(--bh-space-2) 0;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    border-radius: 8px;\n    background: color-mix(in srgb, var(--bh-accent) 12%, transparent);\n    box-shadow: inset 2px 0 0 var(--bh-gold-deep);\n    font-size: var(--bh-text-secondary);\n}\n.bh-lm-update > span { flex: 1 1 auto; min-width: 0; }\n.bh-lm-update .bh-btn { flex: 0 0 auto; padding: 5px 12px; }\n\n/* ─── Model-update banner (in-panel CTA strip; sibling of the no-model banner) ── */\n.bh-update-banner {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-3);\n    flex-wrap: wrap;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    font-size: var(--bh-text-secondary);\n    border-bottom: 1px solid color-mix(in srgb, var(--bh-accent) 40%, transparent);\n    box-shadow: inset 3px 0 0 var(--bh-gold-deep);\n    background: linear-gradient(\n        90deg,\n        color-mix(in srgb, var(--bh-accent) 16%, transparent),\n        color-mix(in srgb, var(--bh-accent) 4%, transparent) 60%,\n        transparent\n    );\n}\n.bh-update-banner-copy { flex: 1 1 auto; min-width: 0; line-height: 1.45; }\n.bh-update-banner-copy > i { color: var(--bh-gold-deep); margin-right: 4px; }\n.bh-update-banner-actions {\n    display: flex;\n    gap: var(--bh-space-2);\n    flex: 1 1 100%;\n}\n.bh-update-banner .bh-btn {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    gap: 6px;\n    padding: 6px 12px;\n    font-size: var(--bh-text-secondary);\n    text-decoration: none;\n}\n.bh-update-banner .bh-update-now { flex: 1 1 0%; }\n.bh-update-banner .bh-update-later { flex: 0 0 auto; padding: 6px 10px; opacity: 0.8; }\n\n/* ─── Progress bar (download / load) ─────────────────────────────────────\n   Mirrors the backfill bar (.bh-bf-bar) but full-width with a label row, so\n   the long weight-streaming phase reads clearly. */\n.bh-lm-progress {\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-1);\n}\n.bh-lm-progress-label {\n    display: flex;\n    align-items: baseline;\n    justify-content: space-between;\n    gap: var(--bh-space-2);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    letter-spacing: 0.06em;\n    opacity: 0.75;\n}\n.bh-lm-progress-pct { font-weight: 600; color: var(--bh-chroma, var(--primary)); }\n.bh-lm-progress-bar {\n    height: 6px;\n    background: var(--bh-divider);\n    border-radius: 3px;\n    overflow: hidden;\n}\n.bh-lm-progress-fill {\n    display: block;\n    height: 100%;\n    width: 0;\n    background: var(--bh-accent, var(--primary));\n    box-shadow: color-mix(in srgb, var(--bh-accent) 40%, transparent) 0 0 8px;\n    transition: width 0.2s ease-out;\n}\n/* Indeterminate phase (WebGPU kernel compile reports no fine-grained pct):\n   a slow shimmer across the bar. Honors reduced-motion. */\n.bh-lm-progress-bar.bh-lm-indeterminate .bh-lm-progress-fill {\n    width: 40%;\n    box-shadow: none;\n    animation: bh-lm-indet 1.3s ease-in-out infinite;\n}\n@keyframes bh-lm-indet {\n    0%   { transform: translateX(-110%); }\n    100% { transform: translateX(310%); }\n}\n@media (prefers-reduced-motion: reduce) {\n    .bh-lm-progress-bar.bh-lm-indeterminate .bh-lm-progress-fill {\n        animation: none;\n        width: 100%;\n        opacity: 0.5;\n    }\n}\n\n/* ─── Primary lifecycle button ───────────────────────────────────────────\n   The card's single action (Download · ~X.X GB / Enable / Disable / Retry /\n   Pause). Built on .bh-btn + .bh-btn-primary, just stretched full-width and\n   sized a step up so it reads as the card's call-to-action. Disable uses the\n   existing danger variant; the action row carries one button at a time. */\n.bh-lm-action { display: flex; gap: var(--bh-space-2); align-items: center; }\n.bh-lm-btn {\n    flex: 1 1 auto;\n    justify-content: center;\n    padding: 8px 14px;\n    font-size: var(--bh-text-body);\n    letter-spacing: 0.06em;\n}\n/* Download size / sublabel inside the button, dimmed so the verb leads. */\n.bh-lm-btn .bh-lm-btn-sub {\n    opacity: 0.7;\n    font-size: 0.88em;\n    letter-spacing: 0.04em;\n}\n\n/* ─── Collapsed Advanced section (custom endpoint) ───────────────────────\n   The existing endpoint/model/apiKey fields move under this <details>. It's\n   a quieter sibling of .bh-vsection — same disclosure idiom, dimmed summary\n   so it visually defers to the local-model card above it. */\n.bh-lm-advanced {\n    border: 1px solid var(--bh-divider);\n    border-radius: 8px;\n    background: var(--bh-surface-1);\n    margin-bottom: var(--bh-space-3);\n    overflow: hidden;\n}\n.bh-lm-advanced > summary {\n    list-style: none;\n    cursor: pointer;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    font-family: var(--bh-font-data);\n    font-size: var(--bh-text-meta);\n    font-weight: 600;\n    letter-spacing: 0.14em;\n    text-transform: uppercase;\n    color: var(--bh-body);\n    opacity: 0.6;\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    user-select: none;\n    transition: opacity 0.15s, color 0.15s;\n}\n.bh-lm-advanced > summary:hover { opacity: 0.9; color: var(--bh-gold-deep); }\n.bh-lm-advanced > summary::-webkit-details-marker { display: none; }\n.bh-lm-advanced > summary::after {\n    content: \"›\";\n    margin-left: auto;\n    opacity: 0.5;\n    transition: transform 0.15s;\n    font-size: 1.25em;\n    letter-spacing: 0;\n}\n.bh-lm-advanced[open] > summary {\n    opacity: 0.85;\n    color: var(--bh-gold-deep);\n}\n.bh-lm-advanced[open] > summary::after { transform: rotate(90deg); }\n.bh-lm-advanced-body {\n    padding: 0 var(--bh-space-3) var(--bh-space-3);\n    display: flex;\n    flex-direction: column;\n    gap: var(--bh-space-2);\n}\n\n/* ─── \"No model active\" banner ───────────────────────────────────────────\n   A persistent strip in the panel, shown when no transport resolves\n   (inactive). Two on-brand variants:\n     .bh-banner-warn  — alarm (never set up / endpoint unreachable): gold-edged\n                        prominent strip that asks for action.\n     .bh-banner-calm  — deliberate \"disabled\" note: quieter, neutral chrome\n                        so a purposeful off-state doesn't read as an error.\n   Modelled on .beholder-backfill-status (surface tint, divider, [hidden]). */\n.bh-no-model-banner {\n    display: flex;\n    align-items: center;\n    gap: var(--bh-space-3);\n    flex-wrap: wrap;\n    padding: var(--bh-space-2) var(--bh-space-3);\n    background: var(--bh-surface-1);\n    border-bottom: 1px solid var(--bh-divider);\n    font-size: var(--bh-text-secondary);\n    position: relative;\n}\n.bh-no-model-banner[hidden] { display: none; }\n.bh-no-model-banner .bh-banner-copy {\n    flex: 1 1 auto;\n    min-width: 0;\n    line-height: 1.45;\n}\n.bh-banner-copy b { color: var(--bh-chroma, var(--primary)); font-weight: 600; }\n.bh-no-model-banner .bh-banner-icon {\n    flex-shrink: 0;\n    align-self: center;\n}\n.bh-no-model-banner .bh-banner-actions {\n    display: flex;\n    gap: var(--bh-space-2);\n    flex: 1 1 100%;\n    justify-content: center;\n}\n/* Reuse the pill buttons, sized down to strip scale (matches the backfill\n   strip's menu_button sizing). */\n.bh-no-model-banner .bh-btn {\n    padding: 7px 14px;\n    font-size: var(--bh-text-secondary);\n}\n/* Full-width gold buttons — split the action row evenly so the CTA reads as one\n   solid block rather than centered shrink-to-fit pills. */\n.bh-no-model-banner .bh-banner-actions .bh-btn {\n    flex: 1 1 0%;\n    justify-content: center;\n}\n\n/* Warn variant — prominent but on-brand: gold-tinted left accent + a leading\n   ◈ glyph that draws the eye without an alarm-red color. */\n.bh-no-model-banner.bh-banner-warn,\n.bh-no-model-banner.bh-banner-loading {\n    background: linear-gradient(\n        90deg,\n        color-mix(in srgb, var(--bh-accent) 16%, transparent),\n        color-mix(in srgb, var(--bh-accent) 4%, transparent) 60%,\n        transparent\n    );\n    border-bottom-color: color-mix(in srgb, var(--bh-accent) 40%, transparent);\n    box-shadow: inset 3px 0 0 var(--bh-gold-deep);\n}\n/* \"Loading\" shares the gold edge but leans calmer (lighter fill) + a gold spinner,\n   so it reads as in-progress, not alarm — and stays on the gold house style. */\n.bh-no-model-banner.bh-banner-loading {\n    background: linear-gradient(\n        90deg,\n        color-mix(in srgb, var(--bh-accent) 10%, transparent),\n        color-mix(in srgb, var(--bh-accent) 2%, transparent) 60%,\n        transparent\n    );\n}\n.bh-no-model-banner .bh-banner-spin { color: var(--bh-gold-deep); }\n/* The reference relies on FontAwesome's own fa-spin. This package ships an icon shim\n   rather than the whole library, and fa-spin is not part of it — so the spinner sat\n   perfectly still, which reads as a hang rather than as work in progress. */\n@keyframes bh-banner-spin { to { transform: rotate(360deg); } }\n.bh-banner-spin { display: inline-block; animation: bh-banner-spin 0.9s linear infinite; }\n@media (prefers-reduced-motion: reduce) {\n    .bh-banner-spin { animation: none; }\n}\n.bh-no-model-banner.bh-banner-warn .bh-banner-icon {\n    color: var(--bh-gold-deep);\n    text-shadow: color-mix(in srgb, var(--bh-accent) 45%, transparent) 0 0 8px;\n}\n\n/* Calm variant — deliberate off: muted, no gold pull, a quiet ○ marker.\n   It's still persistent, just a note rather than a call to action. */\n/* The reference only ever uses this strip to ask for something, so its actions take a\n   full row and stretch. Here it also reports a healthy state — \"answering locally\" —\n   and a full-width button under one line of text reads as an error the operator has to\n   clear. Calm keeps the action inline beside the copy. */\n.bh-no-model-banner.bh-banner-calm .bh-banner-actions {\n    flex: 0 0 auto;\n    justify-content: flex-end;\n}\n.bh-no-model-banner.bh-banner-calm .bh-banner-actions .bh-btn { flex: 0 0 auto; }\n\n.bh-no-model-banner.bh-banner-calm {\n    background: var(--bh-surface-1);\n    opacity: 0.9;\n}\n.bh-no-model-banner.bh-banner-calm .bh-banner-copy {\n    opacity: var(--bh-mute-soft);\n}\n.bh-no-model-banner.bh-banner-calm .bh-banner-icon {\n    color: var(--bh-body);\n    opacity: 0.5;\n}\n.bh-no-model-banner.bh-banner-calm .bh-btn { opacity: 0.8; }\n.bh-no-model-banner.bh-banner-calm .bh-btn:hover { opacity: 1; }\n\n/* ─── Narrow-container behavior (consistent with the panel's @container) ──\n   Below 360px the panel is the mobile digest; the card + banner stack their\n   actions full-width and drop the readiness label column to a fixed minimum\n   so values keep room. Mirrors the existing bhpanel container queries. */\n@container bhpanel (max-width: 360px) {\n    .bh-lm-head { gap: var(--bh-space-1); }\n    .bh-lm-status { margin-left: 0; flex-basis: 100%; }\n    .bh-lm-readiness-label { flex-basis: 30%; }\n    .bh-no-model-banner { gap: var(--bh-space-2); }\n    .bh-no-model-banner .bh-banner-actions {\n        flex-basis: 100%;\n        justify-content: stretch;\n    }\n    .bh-no-model-banner .bh-banner-actions .bh-btn { flex: 1 1 0%; justify-content: center; }\n}\n@container bhpanel (max-width: 320px) {\n    .bh-lm-action { flex-direction: column; align-items: stretch; }\n    .bh-lm-btn { width: 100%; }\n}\n\n/* ─── Characters view (roster: reorder · hide · merge) ───────────────────── */\n.bh-ch-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--bh-space-1, 0.286em); }\n.bh-ch {\n    display: flex; align-items: center; gap: var(--bh-space-2, 0.571em);\n    padding: var(--bh-space-1, 0.286em) var(--bh-space-2, 0.571em);\n    border: 1px solid transparent;\n    border-left: 2px solid transparent;\n    border-radius: 6px;\n    background: rgba(255, 255, 255, 0.025);\n    flex-wrap: wrap;\n}\n.bh-ch-you { border-left-color: var(--bh-accent, #88aaff); }\n.bh-ch-star { color: var(--bh-accent, #88aaff); font-size: 0.8em; }\n.bh-ch-grip { cursor: grab; opacity: var(--bh-mute-soft, 0.5); font-size: 0.85em; flex: 0 0 auto; }\n.bh-ch-grip:active { cursor: grabbing; }\n.bh-ch-dragging { opacity: 0.45; }\n.bh-ch-dropzone { border-color: var(--bh-accent, #88aaff); }\n.bh-ch-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }\n.bh-ch-name {\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-body, 1em);\n    letter-spacing: 0.04em;\n    color: var(--bh-body);\n    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n}\n.bh-ch-aliases { display: flex; flex-wrap: wrap; gap: var(--bh-space-1, 0.286em); }\n.bh-ch-alias {\n    display: inline-flex; align-items: center; gap: 0.3em;\n    font-size: var(--bh-text-meta, 0.78em);\n    opacity: 0.72;\n    padding: 0.05em 0.4em;\n    border-radius: 3px;\n    background: rgba(255, 255, 255, 0.05);\n}\n.bh-ch-alias .fa-xmark { cursor: pointer; opacity: 0.55; font-size: 0.85em; }\n.bh-ch-alias .fa-xmark:hover { opacity: 1; }\n.bh-ch-tools { display: flex; align-items: center; gap: var(--bh-space-2, 0.571em); flex: 0 0 auto; }\n.bh-ch-tools i {\n    cursor: pointer; opacity: var(--bh-mute-soft, 0.5);\n    transition: opacity 0.15s, color 0.15s; font-size: 1.02em; padding: 2px;\n}\n.bh-ch-tools i:hover { opacity: 1; }\n.bh-ch-hide:hover, .bh-ch-unhide:hover, .bh-ch-merge:hover { color: var(--bh-accent, #88aaff); }\n.bh-ch-hidden { opacity: 0.55; }\n.bh-ch-empty { opacity: 0.6; font-style: italic; padding: var(--bh-space-2, 0.571em); }\n.bh-ch-tray { margin-top: var(--bh-space-3, 0.857em); }\n.bh-ch-tray-cap {\n    display: block; font-size: var(--bh-text-meta, 0.78em);\n    text-transform: uppercase; letter-spacing: 0.08em;\n    opacity: 0.45; margin-bottom: var(--bh-space-1, 0.286em);\n}\n/* inline \"is <name>\" merge picker */\n.bh-ch-pick {\n    flex: 1 1 100%;\n    display: flex; flex-wrap: wrap; align-items: center; gap: var(--bh-space-1, 0.286em);\n    margin-top: var(--bh-space-1, 0.286em);\n    padding-top: var(--bh-space-1, 0.286em);\n    border-top: 1px dashed var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.12));\n}\n.bh-ch-pick-lead { font-size: var(--bh-text-meta, 0.78em); opacity: 0.55; font-style: italic; }\n.bh-ch-pill {\n    cursor: pointer;\n    font-family: var(--bh-font-display);\n    font-size: var(--bh-text-meta, 0.85em);\n    letter-spacing: 0.03em;\n    color: var(--bh-body);\n    background: transparent;\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));\n    border-radius: 4px;\n    padding: 0.15em 0.6em;\n    opacity: 0.85;\n    transition: opacity 0.12s, border-color 0.12s, color 0.12s;\n}\n.bh-ch-pill:hover { opacity: 1; border-color: var(--bh-accent, #88aaff); color: var(--SmartThemeEmColor, var(--bh-chroma, var(--primary))); }\n.bh-ch-pick-input {\n    flex: 1 1 6em; min-width: 5em;\n    background: rgba(0, 0, 0, 0.25);\n    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.15));\n    border-radius: 4px; color: inherit;\n    padding: 0.2em 0.4em; font-size: var(--bh-text-meta, 0.78em);\n}\n\n/* ── Package-only chrome ─────────────────────────────────────────────────────\n   The editor, the views and the slot cards are styled above, carried over with the\n   renderer. This build used to re-define that chrome down here as well — a simpler\n   frame, a floating card for the views, its own Apply button — and being later in the\n   file it won, so the reference styling above was loaded and never seen. That is why\n   the panel looked bolted together next to the extension it was ported from.\n   Those duplicates are gone. What is left is only what has no counterpart above:\n   the prompt picker, the local-model controls, and the lock mark. */\n\n.bh-editor-lock { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; opacity: .85; }\n/* Apply uses the reference's .bh-btn / .bh-btn-primary now. */\n.bh-editor-apply:disabled { opacity: .5; cursor: default; }\n\n\n/* The full-viewport overlay this package used to open views in is gone: views now\n   fill the panel like the reference extension's, so nothing needs to dim the host\n   app to show a legend. */\n.bh-view-close { background: none; border: 0; color: inherit; cursor: pointer; opacity: .7; }\n.bh-view-close:hover { opacity: 1; }\n.bh-view-lead { margin: 0 0 10px; }\n.bh-view-note { opacity: .8; font-size: 11.5px; margin: 8px 0 0; }\n.bh-view-warn { margin: 10px 0 0; padding: 8px 10px; border-radius: 8px;\n  background: rgba(220, 140, 60, .16); border: 1px solid rgba(220, 140, 60, .5); }\n\n.bh-prompt-options { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }\n.bh-prompt-option { display: flex; gap: 10px; align-items: flex-start; cursor: pointer;\n  padding: 10px; border-radius: 10px; border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, .15)); }\n.bh-prompt-option small { display: block; opacity: .75; margin-top: 2px; }\n.bh-prompt-option.bh-prompt-active { border-color: color-mix(in srgb, var(--bh-accent) 75%, transparent); background: color-mix(in srgb, var(--bh-accent) 12%, transparent); }\n.bh-prompt-current { margin-top: 12px; }\n\n.bh-doctor-facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0 0 12px; }\n.bh-doctor-facts dt { opacity: .7; }\n.bh-doctor-facts dd { margin: 0; }\n.bh-doctor-json { max-height: 40vh; overflow: auto; padding: 8px; border-radius: 8px; font-size: 11px;\n  background: rgba(0, 0, 0, .35); border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, .12)); }\n.bh-help-list { margin: 6px 0 12px; padding-left: 18px; }\n.bh-help-list li { margin-bottom: 4px; }\n\n.bh-slot-card.bh-slot-locked { outline: 1px solid color-mix(in srgb, var(--bh-accent) 55%, transparent); outline-offset: -1px; }\n\n/* Which connection is answering, and the local model that may be overruling it. */\n.bh-conn { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-top: 10px;\n  padding: 8px 10px; border-radius: 8px;\n  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, .15)); opacity: 1; }\n.bh-conn small { flex-basis: 100%; opacity: .75; }\n.bh-conn-local { border-color: color-mix(in srgb, var(--bh-accent) 60%, transparent);\n  background: color-mix(in srgb, var(--bh-accent) 12%, transparent); }\n.bh-prompt-locked { margin-left: 6px; padding: 1px 6px; border-radius: 999px; font-size: 10px;\n  background: color-mix(in srgb, var(--bh-accent) 22%, transparent); }\n.bh-prompt-option input:disabled + span { opacity: .55; }\n\n.bh-model-block { margin-top: 14px; padding-top: 12px;\n  border-top: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, .12)); }\n.bh-model-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }\n.bh-model-update:empty { display: none; }\n.bh-pill-on, .bh-pill-off { margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 10px; }\n.bh-pill-on { background: color-mix(in srgb, var(--bh-accent) 26%, transparent); }\n.bh-pill-off { background: rgba(128, 128, 128, .22); }\n.bh-hw { margin-top: 12px; }\n.bh-hw > summary { cursor: pointer; font-weight: 600; }\n.bh-hw-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }\n.bh-hw-row input, .bh-hw-row select { width: 130px; }\n.bh-hw-hidden { display: none; }\n\n/* The boundary, stated on the empty panel — quieter than the placeholder note above\n   it, because it is context rather than an alert. Everyone sees it once; nobody has to\n   be detected. */\n.bh-placeholder-scope {\n    margin: 6px 14px 12px;\n    padding: 9px 12px;\n    font-size: var(--bh-text-meta);\n    line-height: 1.55;\n    opacity: 0.72;\n    border-left: 2px solid var(--bh-divider);\n}\n.bh-placeholder-scope b { opacity: 0.95; }\n.bh-scope-more {\n    display: inline;\n    margin-left: 4px;\n    padding: 0;\n    background: none;\n    border: 0;\n    font: inherit;\n    color: var(--bh-chroma, var(--primary));\n    cursor: pointer;\n    text-decoration: underline;\n}\n";
const BH_FA_CSS = "/* Real FontAwesome-solid glyphs (subset to Beholder's icons), embedded so ME (lucide-only) renders them. */\n@font-face{font-family:bh-fa;font-style:normal;font-weight:900;font-display:block;src:url(data:font/woff;base64,d09GRgABAAAAABkMAAoAAAAAMhQDBQUAAAAAAAAAAAAAAAAAAAAAAAAAAABPUy8yAAAW4AAAAFEAAABgYXVZ+GNtYXAAABc0AAABDwAAAbyCUs+BZ2x5ZgAAAPQAABSRAAAr0HTOgsBoZWFkAAAWEAAAADYAAAA2KQTUh2hoZWEAABbAAAAAIAAAACQETAJfaG10eAAAFkgAAAB1AAAA2GbGAUtsb2NhAAAVoAAAAG4AAABuI8sZgm1heHAAABWIAAAAGAAAACAATAGQbmFtZQAAGEQAAACzAAABmB2DOHFwb3N0AAAY+AAAABQAAAAg/94AGXicrVprjCRXdT7ndndV16Orq7q6q7pndrcfNdM17+nanu6amfVA27Ner1/RYCfeJQhrAAW8QJw1STbrYOPxQ2D8A02ISGzyZxIFgZEglmICxDLpRIoQRESbHwFFyo9RlEh482cTggAhuqNzb1V3zcvYSnY1Vec+zqmue8/jO+cWIJjDW/gK7kIAgCt+EDS9hiyVSoEX0L3oOu12UArofjbsdjpBO6D7it/0vKCDoCiGoSi7hqIoirF7sIVXj+2OWpABGPZZDftQg3XYhA/AswC2HPLHuoEb0CPDIAzocX7g858mp6RSENA4jWI0RiOIcij7QRi4mTcVEMj4S8b/s9lsZjJNg2UyzBhTrxuGZxTtPD4ZEYNn8etXrlwpXykPvGx2tZTKZlOlNVleE9Qqbh/b+znDOCyaqMFe3rbznmHgk3m7aHiGMXgWV4X8xmEhJHgIx/UCML6ugH04BSHAtCS7gVMqypLX8P1Akpt+0++G3dBxHVc+GwZBV2yoz7debLrrtHEP/acURc3l1E90Llw+d46xc+cu0/2GX68XbbtYr/tj6taFzidorqI85WM8k+67tt1oNJuNhm2PKQCE4vA1toB98AGw6Uu08oEkS65Ld9cJQ9qhsOvTnnb9Ju0QbihFW+3t2pJkPFJhebOw87RlmqnyI7mMbO/28KsWovWckyrYxoc+a+uacv68oun2Zz9k2IWU8xwgANSwj9twBgAdUiUZA7Eyzc5K2G2fdV16Xvusi19XlCHQO+2IZbjyBl3xEl2HoCg74n0/fFNR6H1qUMNt3OaW1O0EAdkI6ZPQK6FzciBsivRO6J/QvRAvRc+4Egn98OE2zp40EreBgTm8gbewDyW475A9jyxY7tKW03bzzSYtcFzSh264EvfyPqckyUJbVsJuiDVht5H1qohZJZdTZ10Xa7Vud3Oz263V0C3PqLmckkVUz1gWOxvce+/ZgFnWadwTvPvR7d3ErCFmG8utVcEr5Ky2lhvEruVyStnzZu8NzjKSM+t5ZdJtfdjH/8E+bMNv0g7KMtdtN3Bk0iBJlriOc8prcK1p+nIgRVQzDPk++0Ez7IYhqb7rBhHVPus65FjcMOhGlNwNaanEkuCttLrA2IKalpWMqqvGarGsp/NFxykZab1cXDXUnJJR5MQsJXfsLDWtyLcWy45TXhRXrBjqjJ7L6TOqUbCyZl5LF0xl3Uil0yljXTELaS1vZi0rr/q5Q7PUNTFrTY1nFV5Gf2bGR3GF1MgfzML98NAhvUhqp9BL4d1JczspSQ4CSS4FpA91WqOwQ6voe6TJ3Gq8jOOSlow15G6hlzsJy7l7f7JQQCwUJnEnpn5jqViZsBc/iFcdxhz6i3XkR/cIrp2Rid3zo0GfeGoxMycWbXtxVbA6jHTDHP4L3sIvwm3wFABpNLfmZCRrBa0g4BGsE9lntAZC74Xmh92QN4pyMWk4gRsEtBDcVEYGxNUsCPwDgbHhSd4VfSLo9QKrIV4qioWGohQW1tbW1hamzXRG0nO6lrkjK0kMTxg8JIWxFPtxY2J52RqZYyTZsxbyhpFfmF4iNmJ/KCVJWWQpduKMhCAUcQP72Ic8dAHsUqfUDsR203vKnVInDhuloM1VokRmJtf5nA5Xj/buHjpuo+E62GMzsxsbszPMjHdt0I8pE1v0j6bRdKJpJnG0aHw0kRMAEuEUBrgLeZiGc/Au+AD8NoAtdLMdCL303AbpK9/r+mg76qW30euXOqWEwECS3UPPmCF9a/HLi2JdsSbug/1f1n4l5nRYeSwGd8fdZtLL7p3YeLHVijmY8/yYneIQDPcRcA9OA4RJsBRFmrF9K4rSF/b15S8Li+v/gF9F4+WXxWAfEHrDfewJmdMiagr7J18aBonYieFbFZrwSxNwHi4BZLpJMMKVLgIjbooPtYXWCfdOGkcP73ZonxpyiZx82HFX+Myzbgx5mh2EC+vrU43G1Pr6hTH1kGQY9vpkwUKs1siD6AtZNNYlppaKUje52D2sN27b2NzcuK1RxwP0eyxVxYI1OWUXaANyhjyRVgzMsKKklNhrIwmKYvCdAcA+7sDssTuT0MJDu7QXRXpsR4r0vSjm7/Gl3YsAgHhWBAv2Ik3YwT16nt30goB8+hh/WCPXZiWxyJuIxD8e/5bB9yLlbse/BSA1HAz32SbuQRNuh4cBUMSPkWdNYI3IhfL/Mt+zKADzfYuCd7MTCgkNvylzTRjxSa5TwtpGqzXlua6WyWiu6021WhtRj57J6FHPsQB0l5yLpqgspdfrM75tK0q5UlVYCvfQdRt1zzul66c8r95wXTzas38cBO6Rr0oxRdVIHsmt2jZjqqJBaviz4TfZp/DbUIUQ3kX7IUsuRvj24GrQavmucLRF2Q/G71uUfVfyBCIjlJNcU9+387rJtuh65XSxqKXT8QK05+fqV78xs0Ye1vJz2ehN5V//o8op6sOHGwZfwCmv1dq42L0bX9NNOz9o0fWBaq1aSSyFaU1e/oNpJE/drJ4504hf0dQv3FKpV1XvWZoaM7Az64mMZBbeC4Bjz9s+gIiTwZYHUlnsvnUAf4zjtgg9VtANE8EXe0IxH/yu0MvvjExw71Ycb7BHVBT48oN+HjEfBcmr2Bf93xGK/t0HI2ZDUWrEO+jHUmIO4sZePpIH0vBnPFZ9EYowCz24BI/CxwFswqpRpsFRJ6HM0nGdoXBh7SB2Yl5Abqx0fLcwHophUXedd/uOS5CYIG83fDGfuyirmjxjGJblhGbhcPtiApofufUOx7Srk3ldz0+KK37eLGxl5RnLMgxnI5/bO9j8YNIJ7p3YaKFbLpOl0ZXiPWnMDvZBhwq04AK8D36H1jDxUvVkA0XsoMWhnIZwnhc0/QzBvVZAqc04enj+yf5GBJownkr6tXsAqF9NtgaAZ84szZVLjM1+32b4uVnGSuW5pTNnkNnf/1ou57iViuvkcmNqG5vN1WurzSayyuCvKgz7SbCevA7+meSomnZumtml6XOaptLTbLY94QiRzsSYGvycZJLwCmMVQsOF4T+xR/EvYIO0bzrKSP2myI24LxV5Di1AFM15fhRDW56FC8ucFtEq4onAr8iqBAKIljLmEblVVFKQ2fm5OX+lvcA0xrJZPaexyqnTjus+VqnVKiXGLJQZ0zQ9l8VqOt1cXFtfvPqLn3KeRdQYk5URT/nqiTwLj726uL62OJ1JVzGb03WVpbJoMVaq1Orlx1zXOX2qwoghy5jGFlba/tzc1fJbYMnpB1gSOHkSNgDstsfTDIc7JEkmtRNOqRvKba9NpTQrICRNhbTDM2488cQTReO8gTmj2C8aOSRib2trq9fvEbkf92HfOG8U/3XUrBG10xtCrXWwD3D4c+jhnQhgA4ROm/IdsRt1UV/5NE+uDFkpDaGkyMbO3YqyY9o2om2bOxyX7TNCkBVowDyALWyizm3CSkB+y7Usqx1YgVf32h69pAUHk7wBp3p7e7izt7e3h9tHUwHs9YaAEP8RTpocfhO/gN+GSaqk+E05w7WKxwrXCaf5u3hBiO9V7JI9BFNWSlfvJxrBlLPOb92Hf+iaufx+vljEvxxTwKA27LMW/h08DI9xj0zRRQ5Efiuii6gSiLoA2YbYsvE4aXycBpHjEONx7CZIynXfddwMr61FME4Euc+kM1JuAicnZ2cnJ3EiJ2XSaV3LTRR1Hb2pMFOtLrSqNXRyuTiJyuUcqn7cFQTSmjeFul6cyGl6Gh9IOk/8MvUpj5NQEv64QlJJela2zNLj5+bncvOTpxBr1dZdStGuxBGsYheVu3iFZXHpgj4/f+7xkmnJWfqV300iYGDgD/dZDV8CD5YAqNQalwza7XHeG5dS6Y1tr+3xcmwgo3fz5s1CYcuevBKFlSeeLRResCcqRUlRPrb1xAvn8VM3b96kji1bPPJZarxQKAxe2nryhU2RLfwQCM1SRGgSguZeTHijTrIRCv8l/FCvZpqmWTt6XcXJU6doveh6OdnYSzYeSfJwTP0aY/j39AvQkVNRxUn4wigh4b6R9GiFCtQu/rfJeqmcYVw/bxZtTH8pq6j6P1y20MR+wcS/1oqD7XxWloJ78rJS+lUp/XVNU7JfW1BsW0VQtGRFd43qerbv8heM01IBIUXA4qo4gtsCaAvVpNouz2X5tnEm0uZ7G42GbhjInEetjKRVuw880O0y1u0+8I6WcH0p7Z0PXlxbbzQQG431tYud5SXvaw6TL1KIv505+LuNRkOTMtajDkPD0KuCncRgndjJ6S5GzEJQseh1mPOIKl8kAHL7ww7jEf8GA3wF5mADtuDj8Bn4BkBYdANSMrJFUrQk0gvikrWo8LSPZn7hMV0cfEYsAoKeJNqnwk6c2QoJYTMunf0yCXQyEpKtkY39RGj9T+J2aCjKTtLAIswprrWTWGKRB5DT3fGMS6J9KW7/QLR/QMhNoATBk6SPB2Nbx851crnWgbT4JKEis0dCbybU4X4AWyB+KhsJ/N4+3JEZ5wTCGydzAeF5R9nxdoRJ+9F9CJEbnPJWxS9Y9aYwwqt9jue3iSe+R5WU2rn5eX1T9G+S84vql8LeKAK+BHV4N4BL9uaTpfGivRsV7922KDR7DX/aawsMz48xyP+JEdKRZvQCoqQsSs7RC8r//uqrr8qZS1N5LZDzRnaOmY1HMvKrumnqWHzuuecyrCwbeXm2LedNqcYyH0mnFKzXV7x6raLrlVrdW6nXMVt6+eWXMzKrTTyaw9yvpc6gLH1J0/4jvawj6g9+zEDjvgyWJ6Ru01czqkqsqppR/WZXqpS55SXj/Z3wK1SNsU+q/dZHFV+epBKZeRtzeZZ8GCUgL4fxIlZc0B18480njiq/uEdDI7GcuBgPjqa/pUmQHmluBeZhFS6M1iGZg1ri3Qj5RRlFII7U6CLcMIUhPhwPjl8bYmoI270ez0QxTymo4zZqWK3VqlSRqlXR3N7eptySX7A/xlPjRRn0iYvGScz2lF0o2FPiuod56s9jstL2FLwEf0bVBz9GLlTiJFUmmHqYEmpKYUSA18MUL/gGFGA8Dm8PUwIRiWdR/4giXEwulWwgzmM5dGq7XtvjXuEV2hF6RV5vnUle6fVpdHV0eSvzzH6fHEbkN+hG//BL/weRx857JPEE8jJ9qp9WopOJdYDptteOzEOWDx48iPJWjBij8ioFH5FWtfFGNpsVQXZuYW1tdW1BFPTFmYGq0pkanRYsLwfv7AWzmiSZ1/eZs2NKkja3YIynCjaarijLy5xlaZZQAAAb/mL4Og7xb8CCKYH03AO4TibsJxI9ngyGgY8fCYLgmaBQmCHQdtcbb7xhyl5aVY3rJfPmM/gVPkpDM4XCXTdv3sw71w1VTXty/uYzENkc5VNZuBsegPfwPH/kNQhDx2UxSkG52vJjy/jIssN9McXgGO2I+MxLi7Gk6dj/bMXGXjsIsw+2ZsNLh4HypebkRKY2OqzKjvzP8zH1vsMs/3hERvUQuMdyuTmM+Z8f+SHCmX3Wwz6coxyI51+Ho2K8KMJejz+l6+B2/DAR3OIzmfGB3Mgx1XB8HhMVZd7kTKYFDPLD1/G/sA9nKEtEngS7TomKMsIDUiYV5UPtkmVZPAx2/CBAkKXXLVXDQmF56aGJiYeWlgsF1FTrdUk+7zfN/CvYT23J+Xyxfeedt98xr+vzd9x+553tYj4vb6U2B5/E3x980ut219aX7kmgjdMwxfHxcR47djJem59r+bIo8oiTLNIpj2fnpDUdXjoi99YOOof89g7hh/7Ozjbma3lskYdtJcnDXpowxQ79u3VkKicjbH8HPANt6FGdZnQ6L/Of0Q0TCRY/lRXAU2gCjYXTrVIjWAlanVbgBKyVSzFVNU3j9x6n55hRObT38KK3OB2BvT9dmHpq8FnEVZpH8y9ToBAacmqKZhuKMvFwFhGjc0Gui1Wqdxz5toE0z+U+n58vpXh2QkWmqMDEDx3iTIWF0aFQQ1ZK7KOnS0xu9P/t2rVrm0G2gUxrp1kq9ZTMil/ZmF/OIC9VKEq/IbPS6Y+ykiI3+oPvX7t2LbOc9QI9XWGpdOoxWS0ynAs2IfqmiCJdCzbhIbgCTwBMF4MgKNLXDJ6wFHIj/E+W5Aavp4vwLWzMcTPjA/KRuR1N5sOjs9yjsxhgqXjq/bxGk5JRZXmjLGWS+ZSgBwfygQPQPDkQ4dgoviDipGVR7SeTMQzEolMuFFhSrKCj4m2EgU+Ud2AEsqMa7AysQA/ug3fDB+E6vMBtPeAFr/bRmlCECkQ4TwkgweFA+wQ6KjeK6Bel8CIgUqgk7zY+Xq479ODo3JlDDV7uv14tFhGLxergRkxdjyvzNX7ZPpZ8Hu1ikepedH3R1VVVd8V1sEsJf1xZY7WYMk2eT/T4w27FD0OTKPolg50Ydh3+20mKn0k++GKfJG/Hj+BEn+pgyvCbDPFv4S6A6cx0RkTc8SEYLQwvOIi2d6BNPcIRC3QR2SK6otBGefe9Wq7Raq0oqbRmZlF6fyYlS+l0WvGzKL1LTjmalkJNM+c33vGOdy6vq1pO0r+gaVnph8PhkHL/e+W0mknX5ayCmJXZaZZW1aycJbqckldXOk1T0zBlGKcmlzY2bpvLKX+uKFTP4BkHP0+uQBvuhw/B0/AnAOGJqLB94kiUo0fTgsSk8P+VZ6bValmarmtWdOsf6TjQar3t8e3E4JFb7WBz5+2MEqYbDL+FA/wWWHDbSZiOPHYqkFz6QCp2haQ7DV8OeNGVfyrp49UwDJ9cNc2lguMUthRF2a3ql6Xc5zOku7EOa+pLRgGzVXWBPY1fXV1dfTKk6UumeT+jb6Oqg58WjJdULZ5P98znc9JlvbqrPC0yln1GGmLDMmyKr1FEwBsDn9ApiRgvEE838js8N4swk/iEQ7iLNpVkzFb8uKsmBWgeqE2r8gWqmw5u4TbVXzH/4wqjjlfwaqtFYGgr/qGt0uTgRhzdMxXLxD5VXQc9qq3mkVUy1KSYCdvYxxqUCBuJotPhb006x/ZGvpojDSpgRPdx+0A8OBA14H8BrNYSPgAAAHicY2BkYGAwY+xnEGUAARAPBQAAFfYA3gAAAAAAPgDqAT0BeAGlAecCWALyA2YEBgRUBOkFEwU+BbYF7gYnBrQHMweqCEwI7QmaCeoKCgpKCncLFAtVC5gL0wxFDSsNiw4CDogO8w+zEAkQQhDMER4RYhHBEhISaBMOE84UOxTzFUwVrBXoAAAAAQAAAwUFAElLKltfDzz1AAsCAAAAAADiMceFAAAAAOIxx4X/8/+1AosBywAAAAgAAgAAAAAAAHicZY4xCsNADARH2wUMOUya4Madv6Gn3dP8LRNiBemMmxRC0mjZlXWwnSYHAXJetoN1VkETTMWhJa/uYI4nv7TI41SPY2jjULLOXHePz6Vd5KxyNvI+fKvK439+i/hW7vjvObLuPTOyP/InEWfy1P8AFEccXgAAAHicY2BkYGA8/X8rAwNTw//P/z8zdTMwMqACMwC6aQeseJxjYGFiZm5hYGVgYPRhTGNgYHCH0l8ZJBlaGBiYGDiZGWCAUQDOZGBwDA/2ZWhg0P6+hPH0/60MDIynGbxBasAKHRnXMzAwKDAwAAAAVwweAAAAeJxjYGBgYmBgYGZgYBBhYGZgBNMsjCsYGBjSGBwYWBnUGLQfnfrA9IH1A+8HwQ/CHyQ/KH5Q/mD1IeRD5IeED0kf8j4UfOj7sO7DwQ9HP1z/cPvD8w8fP+p+dPp44+Otj/c+Pvsk98n408FPtz/9/Mzyuf3zwc9vv5R/2ftV6qv9V5ev2V/7vq79zvd9yf//DAxwe3hQ7AlGs+cAZfb8vyZrIcDI/5//J/83/q/8H/hf8r/gv8S/i38b/wb+9fxL+Bfzt/Gn84fxB/M78dvzm/Br833gu8PnzufG58xnw8fK+5E3hdebV49XhWcRTyaPHfdW7gJuEa4PXG+4jnEt4WrjVOOYCA5FOgAAgGevqAB4nJXPz0oCYRSH4WdSi1p2BbNUyEFHZ8QWQQTdgNCibY41UI2MUXRTXmPw8WW6cNHuPYfz+3Nw5lFH0j3HlMiJ3DTyiQuryB031pG7ezc9S9vIp66SS3caa99atWcvPqT6ngyk7jXew+bWl8pG4011dJ8qg6pVhWmh8aq23KP/a4dKmUIm96DS2qiDS2pmZiIzMjZXmBjLFeGH40mfBy7XIfs3YbDTHarKXbfhX7cfSe85EgB4nGNgZgCD/7cZJCEsVAAALh8B9w==) format('woff')}\n.beholder-panel [class*='fa-'],.beholder-notebox [class*='fa-']{font-family:bh-fa!important;font-weight:900!important;font-style:normal!important;-webkit-font-smoothing:antialiased;display:inline-block;line-height:1;text-rendering:auto}\n.beholder-panel .fa-arrow-left::before,.beholder-notebox .fa-arrow-left::before{content:\"\\f060\"}.beholder-panel .fa-arrows-rotate::before,.beholder-notebox .fa-arrows-rotate::before{content:\"\\f021\"}.beholder-panel .fa-arrow-up::before,.beholder-notebox .fa-arrow-up::before{content:\"\\f062\"}.beholder-panel .fa-arrow-up-right-from-square::before,.beholder-notebox .fa-arrow-up-right-from-square::before{content:\"\\f08e\"}.beholder-panel .fa-bolt::before,.beholder-notebox .fa-bolt::before{content:\"\\f0e7\"}.beholder-panel .fa-broom::before,.beholder-notebox .fa-broom::before{content:\"\\f51a\"}.beholder-panel .fa-caret-down::before,.beholder-notebox .fa-caret-down::before{content:\"\\f0d7\"}.beholder-panel .fa-check::before,.beholder-notebox .fa-check::before{content:\"\\f00c\"}.beholder-panel .fa-chevron-left::before,.beholder-notebox .fa-chevron-left::before{content:\"\\f053\"}.beholder-panel .fa-chevron-right::before,.beholder-notebox .fa-chevron-right::before{content:\"\\f054\"}.beholder-panel .fa-circle-question::before,.beholder-notebox .fa-circle-question::before{content:\"\\f059\"}.beholder-panel .fa-clock-rotate-left::before,.beholder-notebox .fa-clock-rotate-left::before{content:\"\\f1da\"}.beholder-panel .fa-code-merge::before,.beholder-notebox .fa-code-merge::before{content:\"\\f387\"}.beholder-panel .fa-copy::before,.beholder-notebox .fa-copy::before{content:\"\\f0c5\"}.beholder-panel .fa-download::before,.beholder-notebox .fa-download::before{content:\"\\f019\"}.beholder-panel .fa-ellipsis-vertical::before,.beholder-notebox .fa-ellipsis-vertical::before{content:\"\\f142\"}.beholder-panel .fa-eraser::before,.beholder-notebox .fa-eraser::before{content:\"\\f12d\"}.beholder-panel .fa-eye::before,.beholder-notebox .fa-eye::before{content:\"\\f06e\"}.beholder-panel .fa-eye-slash::before,.beholder-notebox .fa-eye-slash::before{content:\"\\f070\"}.beholder-panel .fa-feather-pointed::before,.beholder-notebox .fa-feather-pointed::before{content:\"\\f56b\"}.beholder-panel .fa-file-medical::before,.beholder-notebox .fa-file-medical::before{content:\"\\f477\"}.beholder-panel .fa-gear::before,.beholder-notebox .fa-gear::before{content:\"\\f013\"}.beholder-panel .fa-grip-lines::before,.beholder-notebox .fa-grip-lines::before{content:\"\\f7a4\"}.beholder-panel .fa-grip-vertical::before,.beholder-notebox .fa-grip-vertical::before{content:\"\\f58e\"}.beholder-panel .fa-hand-holding::before,.beholder-notebox .fa-hand-holding::before{content:\"\\f4bd\"}.beholder-panel .fa-heart-pulse::before,.beholder-notebox .fa-heart-pulse::before{content:\"\\f21e\"}.beholder-panel .fa-id-badge::before,.beholder-notebox .fa-id-badge::before{content:\"\\f2c1\"}.beholder-panel .fa-link::before,.beholder-notebox .fa-link::before{content:\"\\f0c1\"}.beholder-panel .fa-list::before,.beholder-notebox .fa-list::before{content:\"\\f03a\"}.beholder-panel .fa-list-check::before,.beholder-notebox .fa-list-check::before{content:\"\\f0ae\"}.beholder-panel .fa-lock::before,.beholder-notebox .fa-lock::before{content:\"\\f023\"}.beholder-panel .fa-lock-open::before,.beholder-notebox .fa-lock-open::before{content:\"\\f3c1\"}.beholder-panel .fa-magnifying-glass::before,.beholder-notebox .fa-magnifying-glass::before{content:\"\\f002\"}.beholder-panel .fa-microchip::before,.beholder-notebox .fa-microchip::before{content:\"\\f2db\"}.beholder-panel .fa-palette::before,.beholder-notebox .fa-palette::before{content:\"\\f53f\"}.beholder-panel .fa-paper-plane::before,.beholder-notebox .fa-paper-plane::before{content:\"\\f1d8\"}.beholder-panel .fa-pen::before,.beholder-notebox .fa-pen::before{content:\"\\f304\"}.beholder-panel .fa-pen-nib::before,.beholder-notebox .fa-pen-nib::before{content:\"\\f5ad\"}.beholder-panel .fa-plug::before,.beholder-notebox .fa-plug::before{content:\"\\f1e6\"}.beholder-panel .fa-plus::before,.beholder-notebox .fa-plus::before{content:\"\\2b\"}.beholder-panel .fa-power-off::before,.beholder-notebox .fa-power-off::before{content:\"\\f011\"}.beholder-panel .fa-robot::before,.beholder-notebox .fa-robot::before{content:\"\\f544\"}.beholder-panel .fa-rotate-right::before,.beholder-notebox .fa-rotate-right::before{content:\"\\f2f9\"}.beholder-panel .fa-scroll::before,.beholder-notebox .fa-scroll::before{content:\"\\f70e\"}.beholder-panel .fa-server::before,.beholder-notebox .fa-server::before{content:\"\\f233\"}.beholder-panel .fa-shield-halved::before,.beholder-notebox .fa-shield-halved::before{content:\"\\f3ed\"}.beholder-panel .fa-sliders::before,.beholder-notebox .fa-sliders::before{content:\"\\f1de\"}.beholder-panel .fa-star::before,.beholder-notebox .fa-star::before{content:\"\\f005\"}.beholder-panel .fa-stethoscope::before,.beholder-notebox .fa-stethoscope::before{content:\"\\f0f1\"}.beholder-panel .fa-table-columns::before,.beholder-notebox .fa-table-columns::before{content:\"\\f0db\"}.beholder-panel .fa-users::before,.beholder-notebox .fa-users::before{content:\"\\f0c0\"}.beholder-panel .fa-wand-magic-sparkles::before,.beholder-notebox .fa-wand-magic-sparkles::before{content:\"\\e2ca\"}.beholder-panel .fa-xmark::before,.beholder-notebox .fa-xmark::before{content:\"\\f00d\"}\n";
const BH_LOCALES = {"en":{"toolbarLabel":"Beholder","trackerPanelLabel":"Open Beholder","dockTitle":"Beholder","dockClose":"Close Beholder","resizeWindow":"Resize Beholder","layerColor":"Color","layerColorHint":"Color word annotation on chips","layerDamage":"Damage","layerDamageHint":"Damage-tier visuals + damage word","layerWounds":"Wounds","layerWoundsHint":"Wounds, bleeding, severity","layerBarLabel":"Detail layers","backfill":"Build state from history","backfillHint":"Build state from this chat's messages","backfillGroup":"Build state from the chat","backfillMore":"More build options","backfillMoreHint":"More build options","viewInspector":"Inspector","viewInspectorHint":"Inspector — the full round trip for a turn","viewCharacters":"Characters","viewCharactersHint":"Characters — hide, reorder, merge duplicates","toolsMore":"Beholder tools"}};
const BH_PACKAGE_VERSION = "1.3.9";

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

// ===== 11-garment-vocab.js =====
// AUTO-GENERATED from datagen shared/worn_coverage_map.json — DO NOT EDIT BY HAND.
//
// Regenerating: the source map is the extraction contract and lists every garment,
// including words that are ordinary English outside a wardrobe. This list is used for
// one thing only — deciding whether a passage even mentions clothing — so those words
// have to be left out of it, or the check fires on prose about nothing of the sort.
// Excluded on that ground: set ("she set the cup down"), shift ("he shifted his
// weight"), slip ("the glass slipped from her grip" — the phrasing our own Help offers
// as an example), top ("on top of the wall") and plate ("a plate of bread"). Each is a
// real garment and stays in the map; none of them belongs in this gate.
//
// Single-word garment names, used to tell whether a passage even describes something
// Beholder could extract. Measured on the register corpus the model was evaluated on:
// a passage carrying one of these words has physical state to find 49% of the time,
// against 15% for a passage carrying none. So their absence is why a turn produced
// nothing far more often than any failure is.
const BH_GARMENT_WORDS = [
  "aketon",
  "apron",
  "apron-dress",
  "armor",
  "armour",
  "backpack",
  "bathrobe",
  "bedgown",
  "bikini",
  "blazer",
  "blouse",
  "bodice",
  "bodysuit",
  "boot",
  "boots",
  "boxer",
  "boxershorts",
  "bracer",
  "bracers",
  "breaches",
  "breastplate",
  "breeches",
  "bustier",
  "button-down",
  "button-up",
  "buttonup",
  "cape",
  "cardigan",
  "cassock",
  "catsuit",
  "chainmail",
  "chinos",
  "chiton",
  "cloak",
  "coat",
  "converse",
  "corset",
  "crop-top",
  "cuffs",
  "cuirass",
  "cuisse",
  "doublet",
  "dress",
  "duster",
  "eyeliner",
  "fatigues",
  "flat",
  "frock",
  "gambeson",
  "gauntlet",
  "gilet",
  "glove",
  "gloves",
  "gown",
  "greatcoat",
  "greave",
  "greaves",
  "hakama",
  "handcuff",
  "harness",
  "heel",
  "heels",
  "henley",
  "hoodie",
  "hose",
  "hotpants",
  "jacket",
  "jeans",
  "jerkin",
  "jumper",
  "jumpsuit",
  "kilt",
  "kimono",
  "kohl",
  "leathers",
  "leggings",
  "leotard",
  "lingerie",
  "longcoat",
  "mail",
  "nightclothes",
  "nightgown",
  "nightshirt",
  "overalls",
  "overcoat",
  "padding",
  "pajamas",
  "pants",
  "pantyhose",
  "pauldron",
  "pauldrons",
  "plugsuit",
  "raincoat",
  "robe",
  "robes",
  "sandal",
  "sandals",
  "scrubs",
  "shawl",
  "shinguard",
  "shirt",
  "shoe",
  "shoes",
  "shorts",
  "silk",
  "skirt",
  "skirt-suit",
  "slacks",
  "slipper",
  "slippers",
  "smock",
  "sneaker",
  "sneakers",
  "sock",
  "socks",
  "stocking",
  "stockings",
  "suit",
  "sundress",
  "surcoat",
  "suspender",
  "suspenders",
  "sweater",
  "sweatpants",
  "sweats",
  "sweatshirt",
  "swimsuit",
  "t-shirt",
  "tabard",
  "tailcoat",
  "tanktop",
  "tee",
  "tee-shirt",
  "thermal",
  "tights",
  "toga",
  "tracksuit",
  "trenchcoat",
  "trouser",
  "trousers",
  "tshirt",
  "tunic",
  "under-shift",
  "under-trousers",
  "underclothes",
  "underdress",
  "undershirt",
  "uniform",
  "vambrace",
  "vest",
  "waistcoat",
  "wetsuit",
  "wife-beater",
];

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
      // The empty panel is the one screen every new user looks at, and the one where
      // "this is broken" gets decided, so the boundary is stated here to everyone
      // rather than left to a detector that cannot reliably recognise the prose it
      // applies to.
      //
      // Worded carefully, because an earlier draft got it backwards. Beholder tracks
      // many characters at once and is trained to keep them apart — attribution, the
      // right item on the right character, measures 0.95 across the supported
      // registers and 1.00 on several. What it needs is a point of view in the
      // writing. The limit is narration with no anchor at all, which is not the same
      // thing as a scene with several people in it.
      html: `${doll}<p class="bh-placeholder-note">Showing a <b>default human</b> — nothing's tracked yet. It fills in as the scene plays out.</p>
      <p class="bh-placeholder-scope">Beholder follows <b>every character in the scene</b> and keeps their
      clothes and injuries separate.<br>
      It works best when the writing follows <b>one person at a time</b>, so you can tell whose eyes the scene
      is seen through. It does not work well with writing that jumps between many people's thoughts in the same
      paragraph, or with film-script formatting.<br>
      The model is small on purpose, so it can run for free on your own computer.
      <button type="button" class="bh-scope-more">What it reads</button></p>`,
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

// ===== 40-ui.js =====
// ── Shared interface bits ────────────────────────────────────────────────────
// Toast, escaping, and the form controls the slot editor is built from. Markup and
// class names are the extension's, so style.css dresses them without changes.

const BH_DAMAGE_VALUES = ["pristine", "damaged", "broken"];
const BH_SEVERITY_VALUES = ["minor", "serious", "critical"];
const BH_COLOR_VALUES = [
  "",
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
const BH_HAND_SLOTS = new Set(["left_hand", "right_hand"]);

let bhToastTimer = null;
/** Brief status line. The panel is a floating surface, so this anchors to the body. */
BH.toast = function toast(message, ms = 2600) {
  let el = document.querySelector(".bh-toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "bh-toast";
    document.body.appendChild(el);
  }
  el.textContent = String(message);
  // bh-toast-in, which is the class the ported stylesheet actually styles. This used to
  // add "bh-toast-show", a name of our own that no rule matches — and since .bh-toast
  // rests at opacity 0 and only .bh-toast-in raises it, every toast this package has
  // ever raised was invisible. Nothing failed and nothing was logged; the messages
  // simply never appeared.
  el.classList.add("bh-toast-in");
  clearTimeout(bhToastTimer);
  bhToastTimer = setTimeout(() => el.classList.remove("bh-toast-in"), ms);
};

BH.selectHtml = function selectHtml(cls, values, current) {
  const options = values
    .map(
      (value) =>
        `<option value="${BH.escapeHtml(value)}" ${value === (current ?? "") ? "selected" : ""}>` +
        `${BH.escapeHtml(value || "— color —")}</option>`,
    )
    .join("");
  return `<select class="bh-select ${cls}">${options}</select>`;
};

BH.wornRowHtml = function wornRowHtml(worn = {}) {
  return `<div class="bh-editor-row bh-editor-row-worn">
        <input class="bh-input bhe-item" type="text" placeholder="item" value="${BH.escapeHtml(worn.item || "")}">
        ${BH.selectHtml("bhe-damage", BH_DAMAGE_VALUES, worn.damage || "pristine")}
        ${BH.selectHtml("bhe-color", BH_COLOR_VALUES, (worn.color || "").toLowerCase())}
        <button class="bh-editor-remove fa-solid fa-xmark" title="Remove"></button>
    </div>`;
};

BH.woundRowHtml = function woundRowHtml(wound = {}) {
  const text = typeof wound === "string" ? wound : wound.text || "";
  const severity = typeof wound === "object" && wound.severity ? String(wound.severity) : "serious";
  const bleeding = typeof wound === "object" && wound.bleeding === true;
  return `<div class="bh-editor-row bh-editor-row-wound">
        <input class="bh-input bhe-wtext" type="text" placeholder="wound" value="${BH.escapeHtml(text)}">
        ${BH.selectHtml("bhe-wsev", BH_SEVERITY_VALUES, severity)}
        <label class="bh-bleed-check" title="bleeding"><input type="checkbox" class="bhe-wbleed" ${bleeding ? "checked" : ""}>🩸</label>
        <button class="bh-editor-remove fa-solid fa-xmark" title="Remove"></button>
    </div>`;
};

/** The worn / holding / wounds / flags form, identical to the extension's. */
BH.editorFormHtml = function editorFormHtml(slotState, isHand) {
  const holding = slotState.holding
    ? typeof slotState.holding === "string"
      ? { item: slotState.holding }
      : slotState.holding
    : null;
  return `
        <div class="bh-editor-group-label">worn <span style="opacity:.5; letter-spacing:0; text-transform:none;">(outer → inner)</span></div>
        <div class="bhe-worn-list">${(slotState.worn || []).map(BH.wornRowHtml).join("")}</div>
        <button class="bh-editor-add bhe-add-worn"><i class="fa-solid fa-plus"></i> add worn item</button>
        ${
          isHand
            ? `
        <div class="bh-editor-group-label">holding</div>
        <div class="bh-editor-row bhe-holding-row">
            <input class="bh-input bhe-hitem" type="text" placeholder="nothing held" value="${BH.escapeHtml(holding?.item || "")}">
            ${BH.selectHtml("bhe-hdamage", BH_DAMAGE_VALUES, holding?.damage || "pristine")}
            ${BH.selectHtml("bhe-hcolor", BH_COLOR_VALUES, (holding?.color || "").toLowerCase())}
            <button class="bh-editor-remove bhe-drop fa-solid fa-hand-holding" title="Drop item"></button>
        </div>`
            : ""
        }
        <div class="bh-editor-group-label">wounds</div>
        <div class="bhe-wound-list">${(slotState.wounds || []).map(BH.woundRowHtml).join("")}</div>
        <button class="bh-editor-add bhe-add-wound"><i class="fa-solid fa-plus"></i> add wound</button>
        <div class="bh-editor-group-label">flags</div>
        <div class="bh-row-actions">
            <label class="bh-check"><input type="checkbox" class="bhe-bare" ${slotState.bare ? "checked" : ""}>
                <span>bare <small>confirmed uncovered — clears worn on apply</small></span></label>
            <label class="bh-check"><input type="checkbox" class="bhe-missing" ${slotState.missing ? "checked" : ""}>
                <span>missing <small>lost limb / feature — overrides everything</small></span></label>
        </div>`;
};

/** Wire the form's own controls. Adding and removing rows only stages an edit; Apply commits. */
BH.wireEditorForm = function wireEditorForm(scope) {
  scope.querySelector(".bhe-add-worn")?.addEventListener("click", () => {
    scope.querySelector(".bhe-worn-list")?.insertAdjacentHTML("beforeend", BH.wornRowHtml());
  });
  scope.querySelector(".bhe-add-wound")?.addEventListener("click", () => {
    scope.querySelector(".bhe-wound-list")?.insertAdjacentHTML("beforeend", BH.woundRowHtml());
  });
  scope.addEventListener("click", (event) => {
    const remove = event.target.closest(".bh-editor-remove:not(.bhe-drop)");
    if (!remove || !scope.contains(remove)) return;
    // Removing the row detaches this button, and a detached target reads as an
    // outside click to the close-on-outside handler — which would shut the editor
    // and lose the staged removal. Stop it here.
    event.stopPropagation();
    remove.closest(".bh-editor-row")?.remove();
  });
  scope.querySelector(".bhe-drop")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const held = scope.querySelector(".bhe-hitem");
    if (held) held.value = "";
    BH.toast("Item will be dropped on apply");
  });
  scope.querySelector(".bhe-missing")?.addEventListener("change", function onMissing() {
    scope.closest(".bh-editor-body")?.classList.toggle("bhe-missing-mode", this.checked);
    scope.classList.toggle("bhe-missing-mode", this.checked);
  });
};

/** Read the form back into a slot-state object — the apply payload. */
BH.collectEditorForm = function collectEditorForm(scope, isHand) {
  const next = {};
  if (scope.querySelector(".bhe-missing")?.checked) {
    next.missing = true;
    return next; // missing overrides everything on the slot
  }
  const worn = [];
  for (const row of scope.querySelectorAll(".bhe-worn-list .bh-editor-row")) {
    const item = row.querySelector(".bhe-item")?.value.trim();
    if (!item) continue;
    const entry = { item, damage: row.querySelector(".bhe-damage")?.value };
    const color = row.querySelector(".bhe-color")?.value;
    if (color) entry.color = color;
    worn.push(entry);
  }
  const bare = scope.querySelector(".bhe-bare")?.checked;
  if (bare) next.bare = true;
  else if (worn.length) next.worn = worn;

  if (isHand) {
    const item = scope.querySelector(".bhe-hitem")?.value.trim();
    if (item) {
      next.holding = { item, damage: scope.querySelector(".bhe-hdamage")?.value };
      const color = scope.querySelector(".bhe-hcolor")?.value;
      if (color) next.holding.color = color;
    }
  }

  const wounds = [];
  for (const row of scope.querySelectorAll(".bhe-wound-list .bh-editor-row")) {
    const text = row.querySelector(".bhe-wtext")?.value.trim();
    if (!text) continue;
    wounds.push({
      text,
      severity: row.querySelector(".bhe-wsev")?.value,
      bleeding: !!row.querySelector(".bhe-wbleed")?.checked,
    });
  }
  if (wounds.length) next.wounds = wounds;
  return next;
};

// ===== 50-editor.js =====
// ── Slot editor + locks ──────────────────────────────────────────────────────
// Clicking a slot card opens the extension's editor over it. Apply writes the
// change back to the agent run that holds the chat's physical state, so the edit
// is not merely cosmetic: the next turn's prompt is built from that same record,
// which is what makes a hand-set value stick instead of being narrated away.
//
// Locks are stored per chat alongside the state. A locked slot is left alone when
// an edit is applied, and is marked in the panel so it is obvious why.

BH.editor = {
  open: null, // { character, slot, element }

  /**
   * Persist an edited slot.
   *
   * Writes through the agent's own state endpoint, which updates the record the next
   * prompt is built from — so a hand-set slot carries forward instead of being
   * narrated away on the following turn.
   */
  async applySlotEdit(chatId, characterName, slotName, nextSlot) {
    const read = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!read.ok) throw new Error(`read ${read.status}`);
    const snapshot = await read.json();
    const state = { characters: [...(snapshot?.state?.characters ?? [])].map((c) => ({ ...c, body: { ...c.body } })) };

    let character = state.characters.find((entry) => entry?.name === characterName);
    if (!character) {
      character = { name: characterName, body: {} };
      state.characters.push(character);
    }
    if (Object.keys(nextSlot).length === 0) delete character.body[slotName];
    else character.body[slotName] = nextSlot;

    const write = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ state }),
    });
    if (!write.ok) {
      const detail =
        write.status === 404 ? "no extraction to correct yet — let one turn run first" : `save ${write.status}`;
      throw new Error(detail);
    }
    // Recorded only once the write succeeded, so a failed save never leaves a slot
    // claiming to hold the operator's value while it holds the extractor's.
    BH.locks.markEdited(characterName, slotName, chatId);
    return state;
  },

  close() {
    document.querySelector(".bh-editor")?.remove();
    if (this.dismissHandlers) {
      document.removeEventListener("click", this.dismissHandlers.click, true);
      document.removeEventListener("keydown", this.dismissHandlers.keydown, true);
      this.dismissHandlers = null;
    }
    this.open = null;
  },

  /**
   * Close on Escape or a click outside, the way the reference extension does.
   *
   * The detached-target guard matters: removing a worn row deletes the button that
   * was clicked, so by the time this runs the target has no ancestors and reads as
   * an outside click. Closing there would throw away the staged edit — the row would
   * come back and the operator would think the remove did not work.
   */
  wireDismiss(editor) {
    const onClick = (event) => {
      const target = event.target;
      if (!target || target.isConnected === false) return;
      if (target.closest?.(".bh-editor, .bh-slot-card")) return;
      this.close();
    };
    const onKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this.close();
    };
    this.dismissHandlers = { click: onClick, keydown: onKeydown };
    // Deferred: the click that opened the editor is still propagating.
    setTimeout(() => {
      if (!editor.isConnected) return;
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeydown, true);
    }, 0);
  },

  /** Open the editor over a slot card. */
  openFor(card) {
    const slotName = card.dataset.slot;
    if (!slotName) return;
    // Before the first extraction there is no character yet, and the panel is showing
    // its default-human placeholder. Editing a slot then is how someone sets a scene
    // up by hand, so fall back to the chat's persona rather than refusing the click.
    const characterName =
      BH.dock.activeName || BH.dock.props?.personaInfo?.name || BH.dock.props?.personaInfo?.persona?.name || "You";
    if (!characterName) return;
    const body = BH.dock.state?.[characterName]?.body ?? {};
    const slotState = body[slotName] && typeof body[slotName] === "object" ? body[slotName] : {};
    const isHand = BH_HAND_SLOTS.has(slotName);
    const locked = BH.locks.has(characterName, slotName);

    const slotLabel = card.querySelector(".bh-slot-name")?.textContent?.trim() || slotName.replace(/_/g, " ");

    this.close();
    const editor = document.createElement("div");
    editor.className = "bh-editor";
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-label", `Edit ${slotLabel}`);
    editor.innerHTML = `
      <div class="bh-editor-head">
        <span class="bh-editor-title">${BH.escapeHtml(characterName)}</span>
        <span class="bh-editor-slot">· ${BH.escapeHtml(slotLabel)}</span>
        <span class="bh-lock-toggle bh-editor-lock ${locked ? "bh-locked-on" : ""}" role="switch"
          tabindex="0" aria-checked="${locked ? "true" : "false"}"
          title="Locked slots ignore what the model reads — your value stays until you unlock it.">
          <i class="fa-solid ${locked ? "fa-lock" : "fa-lock-open"}" aria-hidden="true"></i><span>${locked ? "locked" : "lock"}</span>
        </span>
        <button class="bh-editor-close fa-solid fa-xmark" title="Close"></button>
      </div>
      <div class="bh-editor-body">${BH.editorFormHtml(slotState, isHand)}</div>
      <div class="bh-editor-foot">
        <button class="bh-btn bhe-cancel">Cancel</button>
        <button class="bh-btn bh-btn-primary bh-editor-apply"><i class="fa-solid fa-check"></i> Apply</button>
      </div>`;

    // Appended to the panel, not the document: .bh-editor is position:absolute and is
    // designed to be placed against the panel's own box. On the body it was laid out
    // against the page instead, so it drifted the moment anything scrolled.
    const panel = BH.dock.panel;
    (panel ?? document.body).appendChild(editor);
    this.open = { character: characterName, slot: slotName, element: editor };

    if (panel) {
      const panelRect = panel.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const width = Math.min(330, panelRect.width - 16);
      editor.style.width = `${width}px`;
      const left = Math.max(8, Math.min(cardRect.left - panelRect.left, panelRect.width - width - 8));
      let top = cardRect.bottom - panelRect.top + 6;
      // Flip above the card when it would fall off the bottom, rather than being
      // clamped to the edge half-visible.
      const height = editor.offsetHeight || 320;
      if (top + height > panelRect.height - 8) {
        top = Math.max(44, cardRect.top - panelRect.top - height - 6);
      }
      editor.style.left = `${left}px`;
      editor.style.top = `${top}px`;
    }

    // The editor is its own surface: a click inside it is never an outside click.
    editor.addEventListener("mousedown", (event) => event.stopPropagation());

    BH.wireEditorForm(editor);
    this.wireDismiss(editor);
    for (const dismiss of editor.querySelectorAll(".bh-editor-close, .bhe-cancel")) {
      dismiss.addEventListener("click", () => this.close());
    }
    // A switch rather than a checkbox, matching the reference extension: the state is
    // legible at a glance from the padlock instead of from a tick, and the label says
    // which state it is currently in rather than what the control is called.
    const lockToggle = editor.querySelector(".bh-lock-toggle");
    const toggleLock = () => {
      const on = !BH.locks.has(characterName, slotName);
      BH.locks.set(characterName, slotName, on);
      // Pin what the slot holds right now; that is what enforcement restores to.
      const current = BH.dock.state?.[characterName]?.body?.[slotName];
      BH.locks.remember(characterName, slotName, on ? (current ?? null) : undefined);
      lockToggle.classList.toggle("bh-locked-on", on);
      lockToggle.setAttribute("aria-checked", on ? "true" : "false");
      lockToggle.querySelector("i").className = `fa-solid ${on ? "fa-lock" : "fa-lock-open"}`;
      lockToggle.querySelector("span").textContent = on ? "locked" : "lock";
      BH.toast(on ? `${characterName} · ${slotLabel} locked — the story will not change it` : "Slot unlocked");
      BH.dock.render();
    };
    lockToggle.addEventListener("click", toggleLock);
    lockToggle.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleLock();
    });
    editor.querySelector(".bh-editor-apply").addEventListener("click", async () => {
      const next = BH.collectEditorForm(editor, isHand);
      const apply = editor.querySelector(".bh-editor-apply");
      apply.disabled = true;
      try {
        await this.applySlotEdit(BH.dock.chatId, characterName, slotName, next);
        // Re-pin so a locked slot holds what was just applied rather than the value
        // it was locked at — otherwise enforcement would undo the operator's own edit.
        if (BH.locks.has(characterName, slotName)) {
          BH.locks.remember(characterName, slotName, Object.keys(next).length ? next : null);
        }
        BH.toast("Saved");
        this.close();
        await BH.dock.refresh();
      } catch (error) {
        apply.disabled = false;
        BH.toast(`Could not save: ${error.message}`);
        console.warn("[beholder] slot edit failed", error);
      }
    });

    // Close on an outside click, but not on the click that opened it.
    setTimeout(() => {
      const onOutside = (event) => {
        if (event.target.closest(".bh-editor") || event.target.closest(".bh-slot-card")) return;
        document.removeEventListener("click", onOutside);
        this.close();
      };
      document.addEventListener("click", onOutside);
    }, 0);
  },
};

// ── Locks ────────────────────────────────────────────────────────────────────
// Per chat, per character+slot. A lock is a promise that the slot keeps the value
// the operator set, so it has to be enforced rather than merely drawn: the extractor
// does not read locks, and would happily overwrite a locked slot on the next turn.
//
// Enforcement runs after each refresh. When the stored state disagrees with a locked
// value, the locked value is written back through the same endpoint the editor uses,
// which is the record the next prompt is built from — so the correction survives
// instead of being re-narrated away every turn.
BH.locks = {
  key(chatId) {
    return `marinara.beholder.locks.${chatId}`;
  },
  all(chatId = BH.dock.chatId) {
    if (!chatId) return {};
    try {
      return JSON.parse(window.localStorage.getItem(this.key(chatId)) || "{}") || {};
    } catch {
      return {};
    }
  },
  has(character, slot, chatId = BH.dock.chatId) {
    return this.all(chatId)[`${character}::${slot}`] === true;
  },
  set(character, slot, locked, chatId = BH.dock.chatId) {
    if (!chatId) return;
    const map = this.all(chatId);
    if (locked) map[`${character}::${slot}`] = true;
    else delete map[`${character}::${slot}`];
    try {
      window.localStorage.setItem(this.key(chatId), JSON.stringify(map));
    } catch {
      // A blocked storage write costs the lock, not the session.
    }
  },
  /** The value a locked slot is pinned to, captured when the lock is set. */
  valueKey(chatId) {
    return `marinara.beholder.lockvalues.${chatId}`;
  },
  values(chatId = BH.dock.chatId) {
    if (!chatId) return {};
    try {
      return JSON.parse(window.localStorage.getItem(this.valueKey(chatId)) || "{}") || {};
    } catch {
      return {};
    }
  },
  remember(character, slot, value, chatId = BH.dock.chatId) {
    if (!chatId) return;
    const map = this.values(chatId);
    if (value === undefined) delete map[`${character}::${slot}`];
    else map[`${character}::${slot}`] = value;
    try {
      window.localStorage.setItem(this.valueKey(chatId), JSON.stringify(map));
    } catch {
      // Without the pinned value the lock can only be advisory; it still marks the slot.
    }
  },

  /**
   * Slots the operator set by hand, as opposed to slots the story produced.
   *
   * Separate from locks on purpose: they answer different questions. A lock says "do
   * not change this"; an edit mark says "this value is mine". Most hand-set values are
   * not locked — the operator fixes one detail and lets the story carry on — and
   * without the mark there is nothing distinguishing their correction from the
   * extractor's own output when they come back to it later.
   */
  editedKey(chatId) {
    return `marinara.beholder.edited.${chatId}`;
  },
  edited(chatId = BH.dock.chatId) {
    if (!chatId) return {};
    try {
      return JSON.parse(window.localStorage.getItem(this.editedKey(chatId)) || "{}") || {};
    } catch {
      return {};
    }
  },
  wasEdited(character, slot, chatId = BH.dock.chatId) {
    return this.edited(chatId)[`${character}::${slot}`] === true;
  },
  /**
   * Forget every per-chat choice attached to a state that no longer exists.
   *
   * The roster goes too. Hiding, ordering and merging are choices about particular
   * people, and once those people are gone a leftover alias would quietly fold the next
   * character of that name into a merge the operator made for someone else.
   *
   * What survives is anything not about this chat — the dismissed model update, for
   * one, which has nothing to do with who was being tracked here.
   */
  clearAll(chatId = BH.dock.chatId) {
    if (!chatId) return;
    for (const key of [this.key(chatId), this.valueKey(chatId), this.editedKey(chatId), BH.roster.key(chatId)]) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing to do; the state itself is already gone either way.
      }
    }
  },

  markEdited(character, slot, chatId = BH.dock.chatId) {
    if (!chatId) return;
    const map = this.edited(chatId);
    map[`${character}::${slot}`] = true;
    try {
      window.localStorage.setItem(this.editedKey(chatId), JSON.stringify(map));
    } catch {
      // Losing the mark costs a visual cue, never the edit itself.
    }
  },

  /**
   * Put locked slots back the way the operator left them.
   *
   * Returns true when it had to write, so the caller can refresh again and show the
   * restored value rather than the extractor's version.
   */
  async enforce(state, chatId = BH.dock.chatId) {
    if (!chatId) return false;
    const locked = this.all(chatId);
    const pinned = this.values(chatId);
    const keys = Object.keys(locked);
    if (keys.length === 0) return false;

    const next = { characters: [] };
    let changed = false;
    for (const [name, character] of Object.entries(state ?? {})) {
      next.characters.push({
        name,
        ...(character.species ? { species: character.species } : {}),
        body: { ...(character.body ?? {}) },
      });
    }
    for (const key of keys) {
      const [name, slot] = key.split("::");
      const want = pinned[key];
      let entry = next.characters.find((candidate) => candidate.name === name);
      if (!entry) {
        // The locked character is not in this turn's state. Skipping silently dropped
        // the lock — reachable since the editor started falling back to the persona
        // name, where an edit can be made before the extractor has ever named them.
        // A pin that only holds while the extractor happens to mention you is not a
        // lock, so re-create the row and enforce it.
        if (want === undefined || want === null) continue;
        entry = { name, body: {} };
        next.characters.push(entry);
      }
      const have = entry.body[slot];
      if (JSON.stringify(have ?? null) === JSON.stringify(want ?? null)) continue;
      if (want === undefined || want === null) delete entry.body[slot];
      else entry.body[slot] = want;
      changed = true;
    }
    if (!changed) return false;
    try {
      const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ state: next }),
      });
      if (!res.ok) return false;
      BH.toast("Locked slots restored");
      return true;
    } catch {
      return false;
    }
  },

  /** Mark locked slots in the rendered panel so the state is visible, not hidden. */
  decorate(panel, character) {
    if (!panel || !character) return;
    const map = this.all();
    for (const card of panel.querySelectorAll(".bh-slot-card[data-slot]")) {
      const locked = map[`${character}::${card.dataset.slot}`] === true;
      card.classList.toggle("bh-slot-locked", locked);
      // The reference extension's glyph: a small gold padlock inline after the slot
      // name. This used to be a corner pin of our own invention, which the ported
      // stylesheet had no rule for and which collided with the damage bar on small
      // cards. Same class as the reference, so the same style applies.
      if (locked && !card.querySelector(".bh-slot-lock-glyph")) {
        const mark = document.createElement("span");
        mark.className = "bh-slot-lock-glyph fa-solid fa-lock";
        mark.title = "Locked — the story will not change this slot";
        const name = card.querySelector(".bh-slot-name");
        if (name) name.after(mark);
        else card.appendChild(mark);
      } else if (!locked) {
        card.querySelector(".bh-slot-lock-glyph")?.remove();
      }
    }
  },
};

// ===== 52-sheet.js =====
// ── The slot sheet: pick a slot, then edit it ───────────────────────────────
//
// Tapping a card works on a mouse. On a phone the cards are small, and — more to the
// point — a slot with nothing in it may not be drawn at all, so there is no card to
// tap. Setting a scene up by hand means reaching empty slots, and the doll cannot
// offer them.
//
// So this is the other way in, ported from the reference extension: one sheet listing
// every slot the character can have, grouped by region, each with a summary of what is
// in it and whether it is locked or hand-edited. Tapping one swaps the sheet to the
// editor for that slot and back again, so several slots can be corrected without
// reopening anything.

const BH_PICKER_REGIONS = [
  { label: "Head & Face", slots: ["head", "face", "left_eye", "right_eye", "left_ear", "right_ear", "mouth", "neck"] },
  { label: "Torso", slots: ["left_shoulder", "right_shoulder", "chest", "back", "waist"] },
  { label: "Arms & Hands", slots: ["left_arm", "right_arm", "left_hand", "right_hand"] },
  { label: "Legs & Feet", slots: ["left_leg", "right_leg", "left_foot", "right_foot"] },
  { label: "Species", slots: ["tail", "hind_left_leg", "hind_right_leg", "hind_left_foot", "hind_right_foot"] },
];

/** Slots only some bodies have; shown when the species implies them or something is in them. */
const BH_SPECIES_CONDITIONAL = new Set([
  "tail",
  "hind_left_leg",
  "hind_right_leg",
  "hind_left_foot",
  "hind_right_foot",
]);

const BH_FAMILY_EXTRA = {
  centauroid: new Set(["tail", "hind_left_leg", "hind_right_leg", "hind_left_foot", "hind_right_foot"]),
  serpentine: new Set(["tail"]),
  digitigrade: new Set(["tail"]),
};

const BH_SLOT_LABELS = {
  head: "head",
  face: "face",
  neck: "neck",
  chest: "chest",
  back: "back",
  waist: "waist",
  mouth: "mouth",
  tail: "tail",
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
  hind_left_leg: "L. hind leg",
  hind_right_leg: "R. hind leg",
  hind_left_foot: "L. hind foot",
  hind_right_foot: "R. hind foot",
};

BH.sheet = {
  /** One line describing what is in a slot, for the picker rows. */
  summary(slotState) {
    if (!slotState) return { text: "empty", cls: "bh-pick-empty" };
    if (slotState.missing) return { text: "missing", cls: "bh-pick-missing" };
    const parts = (slotState.worn ?? []).map((item) => item?.item).filter(Boolean);
    if (slotState.holding) {
      parts.push(`✦ ${typeof slotState.holding === "string" ? slotState.holding : slotState.holding.item}`);
    }
    const wounds = (slotState.wounds ?? []).length;
    let text = parts.join(", ");
    if (wounds) text += `${text ? " · " : ""}${wounds} wound${wounds > 1 ? "s" : ""}`;
    if (!text) return slotState.bare ? { text: "bare", cls: "bh-pick-bare" } : { text: "empty", cls: "bh-pick-empty" };
    return { text, cls: "" };
  },

  close() {
    for (const node of document.querySelectorAll(".bh-edit-sheet, .bh-sheet-backdrop")) node.remove();
    if (this.onKeydown) {
      document.removeEventListener("keydown", this.onKeydown, true);
      this.onKeydown = null;
    }
  },

  characterName() {
    return BH.dock.activeName || BH.dock.props?.personaInfo?.name || BH.dock.props?.personaInfo?.persona?.name || "You";
  },

  open() {
    BH.editor.close();
    this.close();
    const panel = BH.dock.panel;
    if (!panel) return;

    const backdrop = document.createElement("div");
    backdrop.className = "bh-sheet-backdrop";
    const sheet = document.createElement("div");
    sheet.className = "bh-edit-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", "Edit slots");
    sheet.innerHTML = `
      <div class="bh-sheet-head">
        <button type="button" class="bh-sheet-back fa-solid fa-arrow-left" title="Back to slots" hidden></button>
        <span class="bh-sheet-title">Edit a slot</span>
        <button type="button" class="bh-sheet-close fa-solid fa-xmark" title="Close"></button>
      </div>
      <div class="bh-sheet-body"></div>`;
    panel.appendChild(backdrop);
    panel.appendChild(sheet);

    sheet.addEventListener("mousedown", (event) => event.stopPropagation());
    backdrop.addEventListener("click", () => this.close());
    sheet.querySelector(".bh-sheet-close").addEventListener("click", () => this.close());
    this.onKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this.close();
    };
    document.addEventListener("keydown", this.onKeydown, true);
    this.showPicker(sheet);
  },

  showPicker(sheet) {
    const character = this.characterName();
    const body = BH.dock.state?.[character]?.body ?? {};
    // familyOf / OFF_BODY_SLOTS come from the paperdoll module; every source file is
    // concatenated into one IIFE, so they are in scope here.
    const family = familyOf(BH.dock.state?.[character]?.species);
    const offBody = OFF_BODY_SLOTS[family] || OFF_BODY_SLOTS.humanoid || new Set();

    const groups = BH_PICKER_REGIONS.map((region) => {
      const slots = region.slots.filter((slot) => {
        if (offBody.has(slot)) return false;
        // A conditional slot is offered when the species implies it, or when something
        // is already in it — otherwise every human would be asked about their tail.
        if (BH_SPECIES_CONDITIONAL.has(slot)) return BH_FAMILY_EXTRA[family]?.has(slot) || body[slot] != null;
        return true;
      });
      if (!slots.length) return "";
      const rows = slots
        .map((slot) => {
          const summary = this.summary(body[slot]);
          const locked = BH.locks.has(character, slot);
          // Both marks, as the reference shows them. The lock and the pencil answer
          // different questions — "the story cannot change this" versus "this value is
          // mine" — and this list claimed to show both while only ever drawing the lock.
          const marks =
            (locked ? `<i class="fa-solid fa-lock bh-pick-mark bh-pick-lock"></i>` : "") +
            (BH.locks.wasEdited(character, slot)
              ? `<span class="bh-pick-mark bh-pick-edited" title="You set this by hand">✎</span>`
              : "");
          return `<button type="button" class="bh-pick-slot" data-slot="${BH.escapeHtml(slot)}">
            <span class="bh-pick-label">${BH.escapeHtml(BH_SLOT_LABELS[slot] || slot)}</span>
            <span class="bh-pick-summary ${summary.cls}">${BH.escapeHtml(summary.text)}</span>
            ${marks}
            <i class="fa-solid fa-chevron-right bh-pick-arrow"></i>
          </button>`;
        })
        .join("");
      return `<div class="bh-pick-region"><div class="bh-pick-region-head">${BH.escapeHtml(region.label)}</div>${rows}</div>`;
    }).join("");

    const back = sheet.querySelector(".bh-sheet-back");
    back.hidden = true;
    sheet.querySelector(".bh-sheet-title").textContent = `${character} — edit a slot`;
    const sheetBody = sheet.querySelector(".bh-sheet-body");
    sheetBody.scrollTop = 0;
    sheetBody.innerHTML = `<div class="bh-slot-picker">${groups}</div>`;
    for (const row of sheetBody.querySelectorAll(".bh-pick-slot")) {
      row.addEventListener("click", () => this.showEditor(sheet, row.dataset.slot));
    }
  },

  showEditor(sheet, slot) {
    const character = this.characterName();
    if (!character || !slot) return;
    const slotState = BH.dock.state?.[character]?.body?.[slot] ?? {};
    const isHand = slot === "left_hand" || slot === "right_hand";
    const label = BH_SLOT_LABELS[slot] || slot;
    const locked = BH.locks.has(character, slot);

    const back = sheet.querySelector(".bh-sheet-back");
    back.hidden = false;
    back.onclick = () => this.showPicker(sheet);
    sheet.querySelector(".bh-sheet-title").innerHTML =
      `${BH.escapeHtml(character)} <span style="opacity:.55">· ${BH.escapeHtml(label)}</span>`;

    const sheetBody = sheet.querySelector(".bh-sheet-body");
    sheetBody.scrollTop = 0;
    sheetBody.innerHTML = `
      <div class="bh-sheet-lockrow">
        <label class="bh-check bh-editor-lock" title="A locked slot is left alone when an edit is applied">
          <input type="checkbox" class="bhe-lock" ${locked ? "checked" : ""}><span>lock</span>
        </label>
      </div>
      <div class="bh-editor-body">${BH.editorFormHtml(slotState, isHand)}</div>
      <div class="bh-editor-foot">
        <button type="button" class="bh-btn bhe-back">Back</button>
        <button type="button" class="bh-btn bh-btn-primary bhe-apply"><i class="fa-solid fa-check"></i> Apply</button>
      </div>`;

    BH.wireEditorForm(sheetBody);
    if (slotState.missing) sheetBody.querySelector(".bh-editor-body")?.classList.add("bhe-missing-mode");

    sheetBody.querySelector(".bhe-lock").addEventListener("change", (event) => {
      BH.locks.set(character, slot, event.target.checked);
      const current = BH.dock.state?.[character]?.body?.[slot];
      BH.locks.remember(character, slot, event.target.checked ? (current ?? null) : undefined);
      BH.toast(event.target.checked ? "Slot locked" : "Slot unlocked");
      BH.dock.render();
    });
    sheetBody.querySelector(".bhe-back").addEventListener("click", () => this.showPicker(sheet));
    sheetBody.querySelector(".bhe-apply").addEventListener("click", async () => {
      const next = BH.collectEditorForm(sheetBody, isHand);
      const apply = sheetBody.querySelector(".bhe-apply");
      apply.disabled = true;
      try {
        await BH.editor.applySlotEdit(BH.dock.chatId, character, slot, next);
        if (BH.locks.has(character, slot)) {
          BH.locks.remember(character, slot, Object.keys(next).length ? next : null);
        }
        BH.toast(`${character} · ${label} updated`);
        // Back to the list rather than closing: correcting one slot usually means
        // correcting its neighbour too.
        this.showPicker(sheet);
      } catch (error) {
        BH.toast(`Could not save: ${error.message}`);
        apply.disabled = false;
      }
    });
  },
};

// ===== 54-roster.js =====
// ── The roster: who the panel shows, and in what order ──────────────────────
//
// A long scene accumulates people — a barman named once, a guard, someone's horse —
// and the panel gives each of them a tab whether or not anyone cares. The reference
// extension answers that with a characters view: hide the ones you are not tracking,
// drag the ones you are into the order you think in, and merge the duplicates the
// extractor spelled two ways.
//
// Scope worth being explicit about: this is presentation. Hiding someone does not stop
// the extractor tracking them, and merging two names here does not teach it they are
// the same person — it just stops the panel showing them twice. The view says so,
// because a control that looks like it changes extraction and does not is worse than
// no control.
//
// Stored per chat in localStorage, next to the locks, for the same reason: it is a
// per-operator display choice, not part of the state the next prompt is built from.

BH.roster = {
  key(chatId) {
    return `marinara.beholder.roster.${chatId}`;
  },

  all(chatId = BH.dock.chatId) {
    if (!chatId) return { hidden: [], order: [], aliases: {} };
    try {
      const parsed = JSON.parse(window.localStorage.getItem(this.key(chatId)) || "{}") || {};
      return {
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
        order: Array.isArray(parsed.order) ? parsed.order : [],
        aliases: parsed.aliases && typeof parsed.aliases === "object" ? parsed.aliases : {},
      };
    } catch {
      return { hidden: [], order: [], aliases: {} };
    }
  },

  save(next, chatId = BH.dock.chatId) {
    if (!chatId) return;
    try {
      window.localStorage.setItem(this.key(chatId), JSON.stringify(next));
    } catch {
      // A full or blocked store costs the preference, not the panel.
    }
  },

  setHidden(name, hidden) {
    const data = this.all();
    const set = new Set(data.hidden);
    if (hidden) set.add(name);
    else set.delete(name);
    data.hidden = [...set];
    this.save(data);
  },

  setOrder(order) {
    const data = this.all();
    data.order = order;
    this.save(data);
  },

  /** Merge `variant` into `canonical` for display. */
  addAlias(variant, canonical) {
    if (!variant || !canonical || variant.toLowerCase() === canonical.toLowerCase()) return;
    const data = this.all();
    data.aliases[variant] = canonical;
    this.save(data);
  },

  removeAlias(variant) {
    const data = this.all();
    delete data.aliases[variant];
    this.save(data);
  },

  /**
   * Names merged into this one.
   *
   * Compared without case, because the target can be typed by hand: someone merging a
   * stray "the guard" into "Rhys" may well type "rhys", and a case-sensitive match left
   * the alias recorded but invisible — the row stayed on screen and the merge looked
   * like it had failed.
   */
  variantsOf(name, data = this.all()) {
    const wanted = String(name).toLowerCase();
    return Object.entries(data.aliases)
      .filter(([, canonical]) => String(canonical).toLowerCase() === wanted)
      .map(([variant]) => variant);
  },

  /**
   * The names to show, in the operator's order, with hidden ones separated.
   *
   * Applied by the dock when it builds its character tabs, so every surface agrees on
   * who is on screen.
   */
  arrange(names) {
    const data = this.all();
    const hidden = new Set(data.hidden);
    // A merged variant is not its own row; it belongs to the name it was merged into.
    // Matched without case for the same reason variantsOf is: the canonical name may
    // have been typed rather than picked from the list.
    const tracked = new Map(names.map((name) => [name.toLowerCase(), name]));
    // Both ends folded. The canonical name was compared without case but the variant key
    // was not, so an alias recorded as "The Guard" never matched a tracked "the guard"
    // and the row it should have removed stayed on screen.
    const merged = new Set(
      Object.keys(data.aliases)
        .filter((variant) => tracked.has(String(data.aliases[variant]).toLowerCase()))
        .map((variant) => variant.toLowerCase()),
    );
    const remaining = names.filter((name) => !merged.has(name.toLowerCase()));
    const ordered = [
      ...data.order.filter((name) => remaining.includes(name)),
      ...remaining.filter((name) => !data.order.includes(name)),
    ];
    return {
      visible: ordered.filter((name) => !hidden.has(name)),
      hidden: ordered.filter((name) => hidden.has(name)),
    };
  },
};

// ===== 55-sidecar.js =====
// ── The local model slot ────────────────────────────────────────────────────
//
// Beholder can be answered by a purpose-trained model held in the engine's utility
// model slot, which is separate from the engine's own sidecar and never displaces it.
// When that slot is serving, it takes precedence over the agent's configured
// connection — so the operator needs to be told which one is actually answering,
// because the two need different prompts and the failure mode of getting it wrong
// looks like a bad model rather than a bad setting.
//
// Every call here degrades quietly: an engine without the utility slot returns 404,
// and the extension carries on as a normal agent-connection setup.

BH.sidecar = {
  /** The model this package installs, and the id the engine binds to this agent. */
  MODEL_ID: "beholder",
  REPO: "GetBeholder/Beholder-GGUF",
  FILE: "Beholder-Q8_0.gguf",

  available: true,

  async request(path, init) {
    if (!this.available) return null;
    try {
      const res = await fetch(`/api/utility-sidecar${path}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
        ...init,
        // After the spread, not before it: every one of these answers is about right
        // now — is the model loaded, which connection is answering, is there a newer
        // build — so a cached copy is a wrong answer and no caller may opt back in.
        cache: "no-store",
      });
      // A 404 on status means this engine has no utility slot at all. Stop asking.
      if (res.status === 404 && path === "/status") {
        this.available = false;
        return null;
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `${res.status}`);
      }
      return await res.json();
    } catch (error) {
      if (init?.rethrow) throw error;
      return null;
    }
  },

  status() {
    return this.request("/status");
  },

  /** Which connection will answer for this agent, decided server-side. */
  routing() {
    return this.request(`/routing/${this.MODEL_ID}`);
  },

  updateCheck() {
    return this.request(`/models/${this.MODEL_ID}/update-check`);
  },

  install() {
    return this.request("/models/install", {
      method: "POST",
      body: JSON.stringify({ modelId: this.MODEL_ID, repo: this.REPO, file: this.FILE }),
      rethrow: true,
    });
  },

  setActive(active) {
    return this.request("/active", {
      method: "PATCH",
      body: JSON.stringify({ modelId: active ? this.MODEL_ID : null }),
      rethrow: true,
    });
  },

  updateSettings(patch) {
    return this.request("/settings", { method: "PATCH", body: JSON.stringify(patch), rethrow: true });
  },

  /** A short, honest version label. Never claims "current" when it cannot tell. */
  versionLabel(model) {
    if (!model) return "not installed";
    if (!model.oid) return "version unknown";
    return model.oid.slice(0, 12);
  },
};

// ===== 56-banner.js =====
// ── Which model is answering ────────────────────────────────────────────────
//
// The engine's local model slot silently outranks the agent's configured connection,
// and until now the only place that said so was inside the Prompt view. So an operator
// with a local model installed could not tell it was in use, and one without it had no
// idea the option existed — the feature was invisible to the person it was built for.
//
// This is the strip the reference extension uses for the same job: a line in the panel,
// under the build-progress bar, that always names what will answer and offers the one
// action that makes sense from where you are.

BH.banner = {
  ensure() {
    const panel = BH.dock.panel;
    if (!panel) return null;
    let strip = panel.querySelector(".bh-no-model-banner");
    if (strip) return strip;
    strip = document.createElement("div");
    strip.className = "bh-no-model-banner";
    strip.hidden = true;
    strip.setAttribute("role", "status");
    strip.setAttribute("aria-live", "polite");
    // Directly under the build-progress strip, sharing its header-adjacent placement.
    const after = panel.querySelector(".beholder-backfill-status");
    if (after) after.after(strip);
    else panel.querySelector(".beholder-panel-header")?.after(strip);
    return strip;
  },

  /** Work out what to say from the slot's status and this agent's routing. */
  async describe() {
    const [status, routing] = await Promise.all([BH.sidecar.status(), BH.sidecar.routing()]);
    // An engine without the local model slot: nothing to offer, so say nothing.
    if (!status) return null;
    const installed = status.models?.[BH.sidecar.MODEL_ID] ?? null;

    if (routing?.source === "utility-sidecar") {
      return {
        variant: "bh-banner-calm",
        copy: `Answering: local Beholder model · version ${BH.sidecar.versionLabel(installed)}`,
        actions: [{ id: "manage", label: "Manage" }],
      };
    }
    if (installed) {
      return {
        variant: "bh-banner-calm",
        copy: "The local Beholder model is installed but not in use — this agent's connection is answering.",
        actions: [
          { id: "enable", label: "Use local model" },
          { id: "manage", label: "Manage" },
        ],
      };
    }
    if (!status.runtimeInstalled) {
      // Offering a download that cannot start is worse than not offering it.
      return {
        variant: "bh-banner-calm",
        copy: "Beholder is answering through this agent's connection. A local model needs the engine's local runtime first.",
        actions: [{ id: "manage", label: "Details" }],
      };
    }
    return {
      variant: "bh-banner-warn",
      copy: "Beholder is answering through this agent's connection. A small model trained for this job can run locally instead.",
      actions: [
        { id: "install", label: "Get the local model" },
        { id: "manage", label: "Details" },
      ],
    };
  },

  async refresh() {
    const strip = this.ensure();
    if (!strip) return;
    let info;
    try {
      info = await this.describe();
    } catch {
      // Never let a status probe take the panel down; the strip just stays hidden.
      info = null;
    }
    if (!info) {
      strip.hidden = true;
      strip.innerHTML = "";
      return;
    }
    strip.classList.remove("bh-banner-warn", "bh-banner-calm", "bh-banner-loading");
    strip.classList.add(info.variant);
    strip.hidden = false;
    strip.innerHTML = `
      <span class="bh-banner-copy">${BH.escapeHtml(info.copy)}</span>
      <span class="bh-banner-actions">${info.actions
        .map(
          (action) =>
            `<button type="button" class="bh-btn bh-banner-btn ${action.id === "install" || action.id === "enable" ? "bh-btn-primary" : ""}" data-action="${BH.escapeHtml(action.id)}">${BH.escapeHtml(action.label)}</button>`,
        )
        .join("")}</span>`;
    for (const button of strip.querySelectorAll(".bh-banner-btn")) {
      button.addEventListener("click", () => void this.act(button.dataset.action, button));
    }
  },

  /**
   * A newer build of the local model exists — offered once, dismissible.
   *
   * Only shown when the engine can actually tell. The update check compares the
   * installed file's object id against the published one and reports `indeterminate`
   * when it could not reach the repository; a banner that says "new model" because a
   * request failed would train people to ignore it.
   *
   * Dismissal is remembered per published version, not per session, so declining one
   * update does not silence the next one and accepting a nag every launch is not the
   * price of staying on an older build.
   */
  async refreshUpdate() {
    if (!BH.dock.panel) return;
    // Started without being awaited on every dock refresh, so two can be in flight at
    // once. Without this the older answer could land last and re-insert a strip the
    // newer one had just removed.
    const ticket = (this.updateTicket = (this.updateTicket ?? 0) + 1);
    let info;
    try {
      info = await BH.sidecar.updateCheck();
    } catch {
      return;
    }
    if (ticket !== this.updateTicket) return;
    // Re-read the panel AFTER the round trip rather than holding a reference across it.
    // If the dock replaces its panel while the check is in flight, a held reference
    // points at a detached element and the strip is inserted somewhere nobody can see,
    // with no error to show for it.
    const panel = BH.dock.panel;
    if (!panel || !panel.isConnected) return;
    const existing = panel.querySelector(".bh-update-banner");
    if (!info || info.indeterminate || !info.updateAvailable) {
      existing?.remove();
      return;
    }
    const target = String(info.availableOid ?? "");
    let dismissed = null;
    try {
      dismissed = localStorage.getItem("marinara.beholder.updateDismissed");
    } catch {
      // A blocked storage just means the banner is offered again; not worth failing.
    }
    if (dismissed === target) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const short = (oid) => (oid ? String(oid).slice(0, 12) : "?");
    const strip = document.createElement("div");
    strip.className = "bh-update-banner";
    strip.setAttribute("role", "status");
    strip.setAttribute("aria-live", "polite");
    strip.innerHTML = `
      <span class="bh-update-banner-copy"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        A newer Beholder model is available — <b>${BH.escapeHtml(short(info.installedOid))}</b> →
        <b>${BH.escapeHtml(short(info.availableOid))}</b>.</span>
      <span class="bh-update-banner-actions">
        <button type="button" class="bh-btn bh-btn-primary bh-update-now"><i class="fa-solid fa-download"></i>
          Update</button>
        <!-- Written out in full rather than built from the repository the engine reports.
             An interpolated host is a link the server can point anywhere, and this
             package is meant to reach exactly one place. -->
        <a class="bh-btn bh-update-gguf" href="https://huggingface.co/GetBeholder/Beholder-GGUF"
          target="_blank" rel="noopener noreferrer" title="Download the file yourself">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> File</a>
        <button type="button" class="bh-btn bh-update-later" title="Not now" aria-label="Not now">
          <i class="fa-solid fa-xmark"></i></button>
      </span>`;
    const after = panel.querySelector(".beholder-backfill-status") ?? panel.querySelector(".bh-no-model-banner");
    if (after) after.after(strip);
    else panel.querySelector(".beholder-panel-header")?.after(strip);

    strip.querySelector(".bh-update-later").addEventListener("click", () => {
      try {
        localStorage.setItem("marinara.beholder.updateDismissed", target);
      } catch {
        // Dismissal that cannot be remembered still closes the strip for now.
      }
      strip.remove();
    });
    strip.querySelector(".bh-update-now").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.innerHTML = `<i class="fa-solid fa-spinner bh-banner-spin"></i> Downloading…`;
      try {
        await BH.sidecar.install();
        strip.remove();
        // install() downloads the file; it does not decide which connection answers.
        // Routing is read back before saying anything about what is in use, because
        // "the new model is in use" was being claimed without checking.
        await this.refresh();
        let serving = false;
        try {
          serving = (await BH.sidecar.routing())?.source === "utility-sidecar";
        } catch {
          // Left as false: report the part that is certain rather than guess.
        }
        BH.toast(serving ? "Updated — the new model is answering" : "Updated — the new model is downloaded");
      } catch (error) {
        BH.toast(`Update failed: ${error.message}`);
        button.disabled = false;
        button.innerHTML = `<i class="fa-solid fa-download"></i> Update`;
      }
    });
  },

  async act(action, button) {
    // "Details" and "Manage" both land in the Prompt view, which is where the model
    // and the prompt are chosen together — they are one decision.
    if (action === "manage") {
      void BH.views.promptView();
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    try {
      if (action === "install") {
        button.textContent = "Downloading…";
        await BH.sidecar.install();
        await BH.sidecar.setActive(true);
        BH.toast("Local Beholder model installed and serving");
      } else if (action === "enable") {
        await BH.sidecar.setActive(true);
        BH.toast("Local Beholder model is now serving Beholder");
      }
    } catch (error) {
      BH.toast(`Could not complete: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = original;
      await this.refresh();
    }
  },
};

// ===== 58-inspector.js =====
// ── Inspector: the round trip, exactly as it happened ───────────────────────
//
// When an extraction reads a turn wrong, "it got it wrong" is not actionable. What is
// actionable is the prompt the model was given, the prose it read, and the characters
// it sent back — which is what the reference extension's Inspector shows.
//
// The reference can show the last turn from memory because extraction runs in the
// browser. Here it runs server-side and nothing is kept client-side afterwards, so the
// round trip has to be captured while it happens: the engine's own agent-run stream
// emits the request and the response when asked for debug output. So Inspector re-runs
// the turn with capture on and shows what came back.
//
// That re-run is a real model call, which is why it is a button and not something the
// view does on open.

BH.inspector = {
  /** Run the agent for this chat with debug on, and pull the round trip out of the stream. */
  async capture(chatId, messageId) {
    const res = await fetch("/api/generate/retry-agents", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        agentTypes: ["beholder"],
        debugMode: true,
        ...(messageId ? { forMessageId: messageId } : {}),
      }),
    });
    if (!res.ok) throw new Error(`run ${res.status}`);
    const body = await res.text();

    const passes = [];
    let warning = null;
    let current = null;
    for (const line of body.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      let event;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      const data = event?.data ?? {};
      if (event.type === "agent_warning" && !warning) warning = data.message ?? null;
      if (event.type !== "agent_debug" || data.agentType !== "beholder") continue;
      if (data.stage === "request") {
        // Each lane is its own request/response pair; the five arrive in order.
        current = {
          model: data.model ?? "",
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          system: (data.messages ?? []).find((m) => m.role === "system")?.content ?? "",
          user: (data.messages ?? []).find((m) => m.role === "user")?.content ?? "",
          raw: "",
          durationMs: null,
          finishReason: null,
        };
        passes.push(current);
      } else if (data.stage === "response") {
        // Responses can arrive out of order against requests when lanes overlap, so
        // fill the first pass still waiting rather than assuming the last one.
        // Tracked explicitly rather than inferred from `raw`: a lane that legitimately
        // answered with nothing left `raw` empty, so the next response overwrote it and
        // the lane that response belonged to was left blank instead.
        const target = passes.find((pass) => !pass.filled) ?? current;
        if (target) {
          target.filled = true;
          target.raw = data.response ?? data.responsePreview ?? "";
          target.durationMs = data.durationMs ?? null;
          target.finishReason = data.finishReason ?? null;
        }
      }
    }
    return { passes, warning };
  },

  /** A short name for a lane, read from its own system prompt. */
  laneName(pass) {
    const system = pass.system || "";
    if (/ONLY worn/i.test(system)) return "worn";
    if (/ONLY wounds/i.test(system)) return "wounds";
    if (/ONLY items HELD/i.test(system)) return "holding";
    if (/ONLY species/i.test(system)) return "species";
    if (/ONLY bare and missing/i.test(system)) return "flags";
    return "extraction";
  },

  passHtml(pass, index) {
    const seconds = pass.durationMs != null ? `${(pass.durationMs / 1000).toFixed(1)} s` : "—";
    const changed = /"changed"\s*:\s*true/.test(pass.raw || "");
    return `
      <details class="bh-vsection" ${index === 0 ? "open" : ""}>
        <summary><i class="fa-solid fa-robot"></i> ${BH.escapeHtml(this.laneName(pass))}
          <span class="bh-pane-meta">${changed ? "changed" : "no change"} · ${BH.escapeHtml(seconds)}</span></summary>
        <div class="bh-vsection-body">
          <details class="bh-vsection">
            <summary><i class="fa-solid fa-scroll"></i> System prompt
              <span class="bh-pane-meta">${(pass.system || "").length.toLocaleString()} chars</span></summary>
            <div class="bh-vsection-body"><pre class="bh-code">${BH.escapeHtml(pass.system || "")}</pre></div>
          </details>
          <details class="bh-vsection" open>
            <summary><i class="fa-solid fa-feather-pointed"></i> What the model read
              <span class="bh-pane-meta">prose + previous state</span></summary>
            <div class="bh-vsection-body"><pre class="bh-code">${BH.escapeHtml(pass.user || "")}</pre></div>
          </details>
          <details class="bh-vsection" open>
            <summary><i class="fa-solid fa-reply"></i> What it answered
              <span class="bh-pane-meta">${BH.escapeHtml(pass.finishReason || "")}</span></summary>
            <div class="bh-vsection-body"><pre class="bh-code">${BH.escapeHtml(pass.raw || "(nothing)")}</pre></div>
          </details>
        </div>
      </details>`;
  },
};

// ===== 59-report.js =====
// ── The diagnostic report ───────────────────────────────────────────────────
//
// When someone says "it isn't working", the useful reply is not a list of questions.
// It is one block of text they can paste, carrying everything that would otherwise
// take six exchanges to establish: which build, which model, which prompt, whether the
// agent is even on, what the panel is holding, and what the prose looks like.
//
// Two rules shape it. It is plain text, because it gets pasted into chat clients and
// issue trackers that mangle anything else. And it never includes the roleplay itself
// unless the person explicitly asks it to — the prose is theirs, and a support report
// is not a reason to hand it over. What goes in by default are shapes and counts.

BH.report = {
  /**
   * The setup facts, structured, with a severity for each.
   *
   * Doctor shows these as a grid and the report prints them as text. They are computed
   * here once because two renderings of "is this set up correctly" that disagree is
   * worse than either alone — the operator would paste one and be looking at the other.
   *
   * The reference extension's vitals also cover WebGPU, browser RAM and the in-browser
   * model. None of that is ported: this package does not run the model in the browser,
   * so those rows would be answering a question nobody here can ask.
   */
  async vitals() {
    const rows = [];
    const chatId = BH.dock.chatId ?? null;

    const agentOn = await BH.views.agentActive(chatId);
    rows.push({
      dot: agentOn === true ? "ok" : agentOn === false ? "bad" : "warn",
      label: "Agent",
      value: agentOn === null ? "could not read" : agentOn ? "on for this chat" : "OFF — nothing will be read",
    });

    let status = null;
    let routing = null;
    try {
      [status, routing] = await Promise.all([BH.sidecar.status(), BH.sidecar.routing()]);
    } catch {
      // Reported as unknown below rather than failing the whole panel.
    }
    const servedLocally = routing?.source === "utility-sidecar";
    rows.push({
      dot: "ok",
      label: "Reading with",
      value: servedLocally ? "local Beholder model" : "this agent's own connection",
    });

    if (status) {
      const installed = status.models?.[BH.sidecar.MODEL_ID] ?? null;
      rows.push({
        dot: installed ? "ok" : "warn",
        label: "Local model",
        value: installed ? BH.sidecar.versionLabel(installed) : "not installed",
      });
      if (!status.runtimeInstalled) rows.push({ dot: "bad", label: "Local runtime", value: "MISSING" });
      if (status.error) rows.push({ dot: "bad", label: "Local error", value: status.error });
      if (status.settings) {
        rows.push({
          dot: "ok",
          label: "Hardware",
          value: `ctx ${status.settings.contextSize} · gpuLayers ${status.settings.gpuLayers} · slots ${status.settings.maxParallelJobs}`,
        });
      }
    } else {
      rows.push({ dot: "warn", label: "Local model", value: "engine has no local model slot" });
    }
    if (!servedLocally && routing?.reason) rows.push({ dot: "warn", label: "Why not local", value: routing.reason });

    const live = await BH.views.liveTemplate(chatId, BH.dock.props ?? {});
    const fivePass = live.templateId === BH_FIVE_PASS_ID;
    rows.push({
      dot: "ok",
      label: "Prompt",
      value: fivePass ? "five short prompts (local model)" : "one prompt (large model)",
    });
    rows.push({
      dot: live.confirmed ? "ok" : "warn",
      label: "Prompt source",
      value: live.confirmed ? "read from the chat" : "could not confirm — using a cached copy",
    });
    // The pairing is the single most common silent misconfiguration: each half looks
    // fine on its own, and only the combination is wrong.
    if (servedLocally !== fivePass) {
      rows.push({
        dot: "bad",
        label: "Pairing",
        value: servedLocally
          ? "WRONG PAIR — local model with the single-prompt setting"
          : "WRONG PAIR — large model with the five-prompt setting",
      });
    }
    return rows;
  },

  /** Everything worth knowing, as plain text. */
  async build({ includeProse = false } = {}) {
    const lines = [];
    // Wide enough for the longest label, so the values line up when pasted into a
    // monospace box — which is where this always ends up.
    const add = (label, value) => lines.push(`${label.padEnd(24)} ${value}`);

    lines.push("BEHOLDER DIAGNOSTIC REPORT");
    lines.push("=".repeat(52));
    add("package", BH.dock.props?.packageVersion ?? BH_PACKAGE_VERSION ?? "unknown");
    add("generated", new Date().toISOString());

    // ── setup ────────────────────────────────────────────────────────────────
    // The same rows Doctor shows as a grid, so what gets pasted and what was on screen
    // are the same facts rather than two implementations of them.
    const chatId = BH.dock.chatId ?? null;
    lines.push("", "SETUP");
    add("chat", chatId ? `${chatId.slice(0, 8)}…` : "none open");
    for (const row of await this.vitals()) {
      add(row.label.toLowerCase(), row.value);
    }

    // ── what the panel holds ─────────────────────────────────────────────────
    lines.push("", "STATE");
    const state = BH.dock.state ?? {};
    const names = Object.keys(state);
    add("characters", names.length ? `${names.length} (${names.join(", ")})` : "none");
    let slots = 0;
    let worn = 0;
    let wounds = 0;
    let held = 0;
    for (const character of Object.values(state)) {
      for (const slot of Object.values(character?.body ?? {})) {
        if (!slot || typeof slot !== "object") continue;
        slots += 1;
        worn += (slot.worn ?? []).length;
        wounds += (slot.wounds ?? []).length;
        if (slot.holding) held += 1;
      }
    }
    add("slots filled", String(slots));
    add("worn/wounds/held", `${worn} / ${wounds} / ${held}`);
    const locks = Object.keys(BH.locks.all()).length;
    add("locked slots", String(locks));

    // ── the prose ────────────────────────────────────────────────────────────
    lines.push("", "PROSE");
    const sample = await BH.prose.sample(chatId);
    add("turns examined", String(sample.length));
    add("describes clothing", `${sample.filter((t) => BH.prose.describesState(t)).length} of ${sample.length}`);
    add("script-shaped", `${sample.filter((t) => BH.prose.isScript(t)).length} of ${sample.length}`);
    const words = sample.map((t) => t.trim().split(/\s+/).length);
    add(
      "turn length (words)",
      words.length
        ? `min ${Math.min(...words)} · median ${words.sort((a, b) => a - b)[Math.floor(words.length / 2)]} · max ${Math.max(...words)}`
        : "—",
    );
    const verdict = await BH.prose.assess(chatId, state);
    add("verdict", verdict ? verdict.verdict : "nothing flagged");
    if (verdict) lines.push("", `  ${verdict.copy}`);

    if (includeProse) {
      lines.push("", "RECENT TURNS (included at your request)");
      sample.slice(-3).forEach((text, index) => {
        lines.push("", `--- turn ${index + 1} ---`, text.slice(0, 1200));
      });
    } else {
      lines.push("", "(roleplay text not included — tick the box to add the last few turns)");
    }

    lines.push("", "=".repeat(52));
    return lines.join("\n");
  },

  /** Put it on the clipboard, falling back to a selectable box. */
  async copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      BH.toast("Report copied");
      return true;
    } catch {
      // A blocked clipboard is common in embedded contexts; select it instead so the
      // person can still copy by hand rather than being told it failed.
      const box = button?.closest(".bh-report-block")?.querySelector(".bh-report-text");
      if (box) {
        box.hidden = false;
        const range = document.createRange();
        range.selectNodeContents(box);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        BH.toast("Could not reach the clipboard — the report is selected, copy it");
      }
      return false;
    }
  },
};

// ===== 60-views.js =====
// ── Overlay views: Prompt, Doctor, Help ──────────────────────────────────────
// The extension's model-management view does not come across — in Marinara the
// extraction runs server-side through the operator's own connection, so there is no
// engine to download or probe here. What replaces it is prompt management, which is
// the part that actually decides whether extraction works: the trained model and a
// general model need DIFFERENT prompts, and feeding one the other's prompt degrades
// it badly. So the active prompt is stated plainly and is switchable.

const BH_FIVE_PASS_ID = "beholder-local-five-pass";
/** The trained extractor answers to a model id carrying its own name. */
const BH_LOOKS_TRAINED = (value) => /beholder/i.test(String(value || ""));

BH.views = {
  close() {
    document.querySelector(".bh-view")?.remove();
    if (this.onKeydown) {
      document.removeEventListener("keydown", this.onKeydown, true);
      this.onKeydown = null;
    }
    // Put the caret back where it was, or the keyboard user is dropped at the top.
    this.returnFocusTo?.focus?.();
    this.returnFocusTo = null;
  },

  /**
   * Open a view inside the panel.
   *
   * `.bh-view` is `position:absolute; inset:0` — it is built to fill the panel, the way
   * the reference extension does it, with a back arrow to the doll. This used to render
   * a full-viewport overlay instead, which dimmed the entire host app to show a legend:
   * heavier than the thing it was showing, and unlike every other surface here.
   */
  open(title, bodyHtml, onMount) {
    this.close();
    const panel = BH.dock.panel;
    const view = document.createElement("div");
    view.className = "bh-view";
    view.setAttribute("role", "dialog");
    view.setAttribute("aria-label", title);
    view.innerHTML = `
      <div class="bh-view-head">
        <button type="button" class="bh-view-back fa-solid fa-arrow-left" title="Back to the panel"
          aria-label="Back to the panel"></button>
        <span class="bh-view-title"><span class="bh-view-crumb">◉</span>${BH.escapeHtml(title)}</span>
        <button type="button" class="bh-view-close fa-solid fa-xmark" title="Close"></button>
      </div>
      <div class="bh-view-body">${bodyHtml}</div>`;
    (panel ?? document.body).appendChild(view);

    for (const dismiss of view.querySelectorAll(".bh-view-back, .bh-view-close")) {
      dismiss.addEventListener("click", () => this.close());
    }
    // The head doubles as the panel's drag grip while a view covers the header, so
    // only the scrollable body swallows mousedown.
    view.addEventListener("mousedown", (event) => {
      if (!event.target.closest(".bh-view-head")) event.stopPropagation();
    });
    this.onKeydown = (event) => {
      if (event.key !== "Escape") return;
      // A field can claim Escape for itself. This handler is on `document` with capture,
      // which means it runs before ANY listener on a descendant — capture travels from
      // the root down to the target — so a field cannot win this by listening harder.
      // It has to be decided here. Without it, pressing Escape to abandon a half-typed
      // name closed the whole view and lost the row being worked on.
      if (event.target?.closest?.("[data-bh-escape='self']")) return;
      event.stopPropagation();
      this.close();
    };
    document.addEventListener("keydown", this.onKeydown, true);
    this.returnFocusTo = document.activeElement;
    view.querySelector(".bh-view-back")?.focus?.();
    onMount?.(view.querySelector(".bh-view-body"));
    return view;
  },

  // ── Prompt ────────────────────────────────────────────────────────────────
  /** Which template this chat has selected, or null for the agent's default. */
  selectedTemplate(props) {
    const map = props?.metadata?.agentPromptTemplateIds;
    const value = map && typeof map === "object" ? map.beholder : null;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  },

  /**
   * The selection as the server has it.
   *
   * capabilityProps are a snapshot from the last time the host handed them over, so
   * a selection made since then would be reported stale — and reporting the wrong
   * prompt is precisely the mistake these views exist to prevent.
   */
  async liveTemplate(chatId, props) {
    // Reports whether the value came from the chat or from the snapshot fallback.
    // Callers that gate a lock on it need to know: locking on an unconfirmed snapshot
    // can pin the wrong prompt with no way to correct it.
    const fallback = { templateId: this.selectedTemplate(props), confirmed: false };
    if (!chatId) return fallback;
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return fallback;
      const chat = await res.json();
      return { templateId: this.selectedTemplate({ metadata: chat?.metadata }), confirmed: true };
    } catch {
      return fallback;
    }
  },

  /**
   * Persist the selection, then update the props snapshot the views read.
   *
   * capabilityProps are handed over by the host and are not refreshed on our
   * schedule, so without this a reopened view could report the previous selection —
   * the exact wrong-prompt confusion these views exist to prevent.
   */
  /**
   * Persist the selection for a named chat.
   *
   * The chat is passed in rather than resolved here. Resolving it at save time read
   * whichever chat was current *then*, so a view left open across a chat switch could
   * write the selection to the wrong one; and reading it from `props` alone missed the
   * `BH.dock.chatId` fallback and silently saved nothing. The caller resolves it once,
   * before it awaits anything, and the save is bound to that.
   */
  async setTemplate(props, templateId, chatId) {
    if (!chatId) throw new Error("no chat to save to");
    const existing = props?.metadata?.agentPromptTemplateIds;
    const next = { ...(existing && typeof existing === "object" ? existing : {}) };
    if (templateId) next.beholder = templateId;
    else delete next.beholder;
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ agentPromptTemplateIds: next }),
    });
    if (!res.ok) throw new Error(`save ${res.status}`);
    // Keep the snapshot in step with what was just persisted.
    if (props?.metadata && typeof props.metadata === "object") props.metadata.agentPromptTemplateIds = next;
    // Only when the dock is still on the chat this save targeted. A save for chat A
    // completing after a switch to B would otherwise stamp A's selection onto B's live
    // snapshot, and later views would read the wrong prompt for B until a refresh.
    const dockChatId = BH.dock?.props?.chatId ?? BH.dock?.chatId;
    if (dockChatId === chatId && BH.dock?.props?.metadata && typeof BH.dock.props.metadata === "object") {
      BH.dock.props.metadata.agentPromptTemplateIds = next;
    }
  },

  /**
   * Which connection is answering, stated plainly.
   *
   * The local slot silently outranks the agent's connection server-side, so without
   * this the operator has no way to know which model produced a bad extraction.
   */
  connectionBanner({ routing, servedLocally, model, installed }) {
    if (servedLocally) {
      const version = BH.sidecar.versionLabel(installed);
      return `<p class="bh-view-note bh-conn bh-conn-local">
        <i class="fa-solid fa-microchip"></i> Answering: <b>local Beholder model</b>
        <small>${BH.escapeHtml(installed?.file || BH.sidecar.FILE)} · version <code>${BH.escapeHtml(version)}</code></small>
        <small>The engine's model slot takes precedence over this agent's connection.</small></p>`;
    }
    if (routing && installed) {
      return `<p class="bh-view-note bh-conn">
        <i class="fa-solid fa-plug"></i> Answering: <b>agent connection</b>
        ${model ? `<code>${BH.escapeHtml(model)}</code>` : ""}
        <small>${BH.escapeHtml(routing.reason || "The local model slot is not serving this agent.")}</small></p>`;
    }
    return model
      ? `<p class="bh-view-note bh-conn"><i class="fa-solid fa-plug"></i> Answering:
         <b>agent connection</b> <code>${BH.escapeHtml(model)}</code></p>`
      : `<p class="bh-view-note bh-conn">No agent connection model detected.</p>`;
  },

  /**
   * Install, version and update for the local model — deliberately in the prompt view,
   * because choosing the model and choosing the prompt are the same decision.
   */
  modelSection({ sidecarStatus, installed, servedLocally }) {
    if (!sidecarStatus) return "";
    if (!installed) {
      return `<div class="bh-model-block">
        <p class="bh-view-note"><b>Local Beholder model</b> — not installed.</p>
        <p class="bh-view-note">Downloads ${BH.escapeHtml(BH.sidecar.FILE)} from
          <code>${BH.escapeHtml(BH.sidecar.REPO)}</code> into the engine's own model slot. This does not
          touch or replace the model your engine's sidecar is already running.</p>
        ${
          sidecarStatus.runtimeInstalled
            ? ""
            : `<p class="bh-view-warn"><i class="fa-solid fa-triangle-exclamation"></i>
               The local runtime is not installed yet. Set up the engine's sidecar first; this slot reuses
               that runtime and will not install it for you.</p>`
        }
        <button type="button" class="bh-btn" data-model-action="install">Download model</button>
      </div>`;
    }
    return `<div class="bh-model-block">
      <p class="bh-view-note"><b>Local Beholder model</b> installed —
        version <code>${BH.escapeHtml(BH.sidecar.versionLabel(installed))}</code>
        ${servedLocally ? `<span class="bh-pill-on">serving</span>` : `<span class="bh-pill-off">off</span>`}</p>
      <div class="bh-model-actions">
        <button type="button" class="bh-btn" data-model-action="${servedLocally ? "disable" : "enable"}">
          ${servedLocally ? "Stop using local model" : "Use local model"}</button>
        <button type="button" class="bh-btn" data-model-action="update-check">Check for updates</button>
      </div>
      <p class="bh-view-note bh-model-update"></p>
      ${this.hardwareSection(sidecarStatus.settings)}
    </div>`;
  },

  /**
   * The hardware choices, and only those.
   *
   * Sampling is not offered: the extractor is graded against a schema and was tuned
   * with fixed sampling, so a temperature dial here would only let someone quietly
   * break their own setup. How much of the machine to spend on it is genuinely theirs
   * to decide.
   */
  hardwareSection(settings) {
    if (!settings) return "";
    const offload = settings.gpuLayers === 0 ? "cpu" : settings.gpuLayers === -1 ? "gpu" : "custom";
    return `<details class="bh-hw">
      <summary>Hardware</summary>
      <p class="bh-view-note">How much of this machine the local model may use. Sampling is fixed to what the
        model was trained with and is not adjustable.</p>
      <label class="bh-hw-row"><span>Offload</span>
        <select data-hw="offload">
          <option value="cpu" ${offload === "cpu" ? "selected" : ""}>CPU only</option>
          <option value="gpu" ${offload === "gpu" ? "selected" : ""}>Maximum GPU</option>
          <option value="custom" ${offload === "custom" ? "selected" : ""}>Set GPU layers…</option>
        </select></label>
      <label class="bh-hw-row ${offload === "custom" ? "" : "bh-hw-hidden"}" data-hw-row="layers"><span>GPU layers</span>
        <input type="number" data-hw="gpuLayers" min="0" max="999"
          value="${offload === "custom" ? String(settings.gpuLayers) : "20"}"></label>
      <label class="bh-hw-row"><span>Context</span>
        <input type="number" data-hw="contextSize" min="512" max="131072" step="512"
          value="${String(settings.contextSize)}"></label>
      <label class="bh-hw-row"><span>Parallel slots</span>
        <input type="number" data-hw="maxParallelJobs" min="1" max="8" value="${String(settings.maxParallelJobs)}"></label>
      <button type="button" class="bh-btn" data-model-action="save-hardware">Save hardware settings</button>
      <p class="bh-view-note">Saving restarts the local model so the change takes effect. The engine's own
        sidecar is not affected.</p>
    </details>`;
  },

  wireModelSection(body, { installed }) {
    const note = body.querySelector(".bh-model-update");
    const say = (text, warn) => {
      if (!note) return;
      note.textContent = text;
      note.classList.toggle("bh-view-warn", !!warn);
    };
    const offloadSelect = body.querySelector('[data-hw="offload"]');
    if (offloadSelect) {
      offloadSelect.addEventListener("change", () => {
        const row = body.querySelector('[data-hw-row="layers"]');
        if (row) row.classList.toggle("bh-hw-hidden", offloadSelect.value !== "custom");
      });
    }
    for (const button of body.querySelectorAll("[data-model-action]")) {
      button.addEventListener("click", async () => {
        const action = button.getAttribute("data-model-action");
        const original = button.textContent;
        button.disabled = true;
        try {
          if (action === "install") {
            button.textContent = "Downloading…";
            await BH.sidecar.install();
            BH.toast("Model downloaded");
            await this.promptView();
            return;
          }
          if (action === "enable" || action === "disable") {
            await BH.sidecar.setActive(action === "enable");
            BH.toast(action === "enable" ? "Local model is now serving Beholder" : "Local model stopped");
            await this.promptView();
            return;
          }
          if (action === "save-hardware") {
            const read = (name) => Number(body.querySelector(`[data-hw="${name}"]`)?.value);
            const offload = body.querySelector('[data-hw="offload"]')?.value;
            const gpuLayers = offload === "cpu" ? 0 : offload === "gpu" ? -1 : read("gpuLayers");
            button.textContent = "Restarting…";
            await BH.sidecar.updateSettings({
              gpuLayers,
              contextSize: read("contextSize"),
              maxParallelJobs: read("maxParallelJobs"),
            });
            BH.toast("Hardware settings saved");
            await this.promptView();
            return;
          }
          if (action === "update-check") {
            button.textContent = "Checking…";
            const check = await BH.sidecar.updateCheck();
            if (!check) say("Could not reach the model repository.", true);
            else if (check.indeterminate) {
              // Never imply "current" when the comparison could not be made.
              say(
                "Could not tell whether a newer build exists. Re-downloading is safe but not confirmed needed.",
                true,
              );
            } else if (check.updateAvailable) {
              say(
                `A newer build is available (${String(check.availableOid || "").slice(0, 12)}). ` +
                  `Re-download to update; the extractor's accuracy depends on matching prompts and weights.`,
                true,
              );
            } else {
              say(`Up to date (version ${BH.sidecar.versionLabel(installed)}).`, false);
            }
          }
        } catch (error) {
          BH.toast(`Could not complete: ${error.message}`);
          say(error.message, true);
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      });
    }
  },

  async promptView() {
    // Drawn before the network work so the dock button gives immediate feedback; the
    // body is filled in once the answers arrive.
    const loading =
      document.querySelector(".bh-view") ??
      this.open("Prompt", `<p class="bh-view-lead">Checking which model will answer…</p>`);
    const props = BH.dock.props ?? {};
    // Resolved once, before anything is awaited, so every read and write below refers
    // to the chat this view is actually showing.
    const chatId = props?.chatId ?? BH.dock.chatId;
    const live = await this.liveTemplate(chatId, props);
    let usingFivePass = live.templateId === BH_FIVE_PASS_ID;
    // True once the value is known to match the saved chat, either because the read
    // succeeded or because we just wrote it.
    let confirmed = live.confirmed;

    // The local slot outranks the agent's connection, so ask the engine what will
    // actually answer rather than inferring it from the connection list.
    const routing = await BH.sidecar.routing();
    const sidecarStatus = await BH.sidecar.status();
    const servedLocally = routing?.source === "utility-sidecar";
    const installed = sidecarStatus?.models?.[BH.sidecar.MODEL_ID] ?? null;

    // When the trained model is answering, the five-pass prompt is the only correct
    // one. Select it rather than leaving the operator a way to break their own setup.
    let autoSelectFailed = false;
    if (servedLocally && !usingFivePass) {
      try {
        await this.setTemplate(props, BH_FIVE_PASS_ID, chatId);
        // Only after the save actually succeeded: claiming the switch happened when it
        // did not would show a locked picker over the wrong prompt.
        usingFivePass = true;
        confirmed = true;
      } catch {
        // The picker stays usable in this case. Locking it here would strand the
        // operator on the wrong prompt for a local model with no way to correct it.
        autoSelectFailed = true;
      }
    }
    // Locked only once the correct prompt is known to be the saved one. An unconfirmed
    // snapshot is not enough: it can disagree with the chat, and locking on it pins the
    // wrong prompt against a local model with no way to correct it.
    const lockPicker = servedLocally && usingFivePass && confirmed;
    // The model the agent will actually call, so a mismatch can be named rather
    // than left for the operator to discover through bad extractions.
    let model = "";
    try {
      const res = await fetch("/api/connections", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const rows = await res.json();
        const list = Array.isArray(rows) ? rows : (rows.connections ?? []);
        const forAgents = list.find((c) => c.defaultForAgents) ?? list.find((c) => c.isDefault) ?? list[0];
        model = forAgents?.model ?? "";
      }
    } catch {
      // Naming the model is a courtesy; the picker works without it.
    }
    // The requests are slower than a click. If the operator closed this view or opened
    // another one meanwhile, finishing would yank Prompt back over what they chose.
    if (!loading.isConnected) return;

    const trained = BH_LOOKS_TRAINED(model);
    // Only meaningful when the agent connection is what answers; the local slot's
    // prompt is decided for the operator.
    const mismatch = !servedLocally && model && trained !== usingFivePass;

    this.open(
      "Prompt",
      `
      <p class="bh-view-lead">These are not interchangeable. The trained Beholder model was taught five short
      per-lane prompts; a general model needs the single long prompt. Give either one the other's prompt and
      extraction degrades badly, so pick the one that matches the model you are pointing at.</p>
      ${BH.views.connectionBanner({ routing, servedLocally, model, installed })}
      ${
        autoSelectFailed
          ? `<p class="bh-view-warn"><i class="fa-solid fa-triangle-exclamation"></i> The local model is answering, but
             the five-pass prompt could not be saved. Select it below — the local model needs it.</p>`
          : ""
      }
      ${
        mismatch
          ? `<p class="bh-view-warn"><i class="fa-solid fa-triangle-exclamation"></i> This looks like a mismatch:
             ${trained ? "the model looks like the trained Beholder model, but the single-prompt template is selected." : "the model does not look like the trained Beholder model, but the five-pass template is selected."}</p>`
          : ""
      }
      <div class="bh-prompt-options">
        <label class="bh-prompt-option ${usingFivePass ? "" : "bh-prompt-active"}">
          <input type="radio" name="bh-prompt" value="" ${usingFivePass ? "" : "checked"}
            ${lockPicker ? "disabled" : ""}>
          <span><b>SOTA model — one prompt</b><small>One call covering every field. For a strong general model
          (GPT-5.5+, Claude Opus 4.8+, Kimi K3+).</small></span>
        </label>
        <label class="bh-prompt-option ${usingFivePass ? "bh-prompt-active" : ""}">
          <input type="radio" name="bh-prompt" value="${BH_FIVE_PASS_ID}" ${usingFivePass ? "checked" : ""}
            ${lockPicker ? "disabled" : ""}>
          <span><b>Local Beholder model — five passes</b><small>Five short per-lane calls, the prompts the
          model was trained on. For GetBeholder/Beholder-GGUF served locally.</small></span>
        </label>
      </div>
      <p class="bh-view-note bh-prompt-current">Currently selected:
        <b>${usingFivePass ? "Local Beholder model — five passes" : "SOTA model — one prompt"}</b>
        ${lockPicker ? `<span class="bh-prompt-locked">locked by the local model slot</span>` : ""}</p>
      ${BH.views.modelSection({ sidecarStatus, installed, servedLocally })}`,
      (body) => {
        BH.views.wireModelSection(body, { installed, servedLocally });
        for (const input of body.querySelectorAll('input[name="bh-prompt"]')) {
          input.addEventListener("change", async (event) => {
            try {
              await this.setTemplate(props, event.target.value || null, chatId);
              BH.toast("Prompt selection saved");
              this.close();
            } catch (error) {
              BH.toast(`Could not save: ${error.message}`);
            }
          });
        }
      },
    );
  },

  // ── Doctor ────────────────────────────────────────────────────────────────
  /**
   * Health checks, in the reference extension's sense: is this set up correctly?
   *
   * Distinct from the Inspector, which shows one round trip. Doctor answers "why is
   * nothing appearing" without the operator having to know which of the four things
   * that could be wrong to go and look at.
   */
  checkRow(state, label, detail) {
    const icon = state === "ok" ? "fa-circle-check" : state === "warn" ? "fa-triangle-exclamation" : "fa-circle-xmark";
    return `<div class="bh-vlog-row bh-vlog-${state}">
      <b><i class="fa-solid ${icon}" aria-hidden="true"></i> ${BH.escapeHtml(label)}</b>
      <span>${detail}</span>
    </div>`;
  },

  /** Whether Beholder is switched on for this chat, read from the chat itself. */
  async agentActive(chatId) {
    // The props snapshot does not carry the chat's agent list, so reading it there
    // reported the agent inactive while it was plainly running — a check that is wrong
    // in the healthy case is worse than no check.
    if (!chatId) return null;
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const meta = (await res.json())?.metadata ?? {};
      if (meta.enableAgents === false) return false;
      const active = meta.agentPromptTemplateIds ? Object.keys(meta.agentPromptTemplateIds) : [];
      const ids = Array.isArray(meta.activeAgentIds) ? meta.activeAgentIds : active;
      return ids.includes("beholder");
    } catch {
      return null;
    }
  },

  async healthChecks(chatId, chatProps, snapshot) {
    const rows = [];
    const agentOn = await this.agentActive(chatId);
    rows.push(
      agentOn === true
        ? this.checkRow("ok", "Agent", "Beholder is switched on for this chat.")
        : agentOn === false
          ? this.checkRow(
              "error",
              "Agent",
              "Beholder is turned off for this chat, so nothing will be read. Turn it on in the agents menu.",
            )
          : // Unknown is reported as unknown rather than guessed either way.
            this.checkRow("warn", "Agent", "Could not check whether Beholder is turned on for this chat."),
    );

    const routing = await BH.sidecar.routing();
    const status = await BH.sidecar.status();
    const servedLocally = routing?.source === "utility-sidecar";
    const installed = status?.models?.[BH.sidecar.MODEL_ID] ?? null;
    rows.push(
      servedLocally
        ? this.checkRow(
            "ok",
            "Model",
            `Reading with the local Beholder model · version <code>${BH.escapeHtml(BH.sidecar.versionLabel(installed))}</code>.`,
          )
        : this.checkRow(
            "warn",
            "Model",
            `Reading with this agent's own connection. ${BH.escapeHtml(routing?.reason ?? "")}`,
          ),
    );

    const selected = (await this.liveTemplate(chatId, chatProps)).templateId;
    const usingFivePass = selected === BH_FIVE_PASS_ID;
    // The pairing is the single most common way this ends up quietly broken.
    if (servedLocally) {
      rows.push(
        usingFivePass
          ? this.checkRow("ok", "Prompt", "Five short prompts — the ones the local model was trained with. Correct.")
          : this.checkRow(
              "error",
              "Prompt",
              "The local model is reading, but the single-prompt setting is chosen. These do not fit together, and results will be poor until you change it.",
            ),
      );
    } else {
      rows.push(
        usingFivePass
          ? this.checkRow(
              "warn",
              "Prompt",
              "The five-prompt setting is chosen, but a large model is reading. These do not fit together, and results will be poor.",
            )
          : this.checkRow("ok", "Prompt", "One prompt — what a large model needs. Correct."),
      );
    }

    // Prose last: it is the check that explains the others when they all look fine and
    // the doll is still empty.
    const prose = await BH.prose.assess(chatId, BH.dock.state);
    if (prose) {
      rows.push(
        this.checkRow(
          "warn",
          "Prose",
          `${BH.escapeHtml(prose.copy)}${prose.aside ? ` <small style="opacity:.75">${BH.escapeHtml(prose.aside)}</small>` : ""}`,
        ),
      );
    } else {
      rows.push(this.checkRow("ok", "Prose", "These turns look like writing Beholder can read."));
    }

    const characters = snapshot?.state?.characters ?? [];
    rows.push(
      characters.length
        ? this.checkRow("ok", "State", `${characters.length} character${characters.length === 1 ? "" : "s"} tracked.`)
        : this.checkRow(
            "warn",
            "State",
            "Nothing found yet. If this chat already has messages, use the clock button at the top to read them.",
          ),
    );
    return rows.join("");
  },

  /**
   * The setup facts as a scannable grid, above the prose of the checks.
   *
   * Same rows as the copyable report, from the same function, because a grid that says
   * one thing while the pasted report says another is worse than not having the grid.
   */
  async vitalsHtml() {
    let rows;
    try {
      rows = await BH.report.vitals();
    } catch {
      return "";
    }
    if (!rows.length) return "";
    return `<div class="bh-vitals">${rows
      .map(
        (row) => `<div class="bh-vital">
          <span class="bh-dot bh-dot-${BH.escapeHtml(row.dot)}"></span>
          <span class="bh-vital-label">${BH.escapeHtml(row.label)}</span>
          <span class="bh-vital-value">${BH.escapeHtml(String(row.value))}</span>
        </div>`,
      )
      .join("")}</div>`;
  },

  /**
   * What Beholder has actually been doing, most recent first.
   *
   * "It is not working" is usually one of three things — it never ran, it ran and
   * failed, or it ran fine and found nothing — and those look identical from the panel.
   * Timings and slot counts separate them without anyone having to describe symptoms.
   *
   * Failures are shown, not filtered: a run that errored is the most useful row here.
   */
  async recentRunsHtml(chatId) {
    if (!chatId) return "";
    let runs;
    try {
      const res = await fetch(`/api/agents/beholder-runs/${encodeURIComponent(chatId)}?limit=5`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return "";
      runs = await res.json();
    } catch {
      return "";
    }
    const body = runs.length
      ? runs
          .map((run) => {
            const when = run.createdAt ? new Date(run.createdAt).toLocaleTimeString() : "—";
            const took = typeof run.durationMs === "number" ? `${(run.durationMs / 1000).toFixed(1)} s` : "—";
            // A failed run applies nothing, so "no change" would be a lie — say so.
            const found = !run.success
              ? `<span class="bh-vlog-error">failed${run.error ? ` — ${BH.escapeHtml(String(run.error).slice(0, 80))}` : ""}</span>`
              : run.slots
                ? `${run.slots} slot${run.slots === 1 ? "" : "s"} · ${run.characters} character${run.characters === 1 ? "" : "s"}`
                : "nothing found";
            return `<tr><td>${BH.escapeHtml(when)}</td><td>${took}</td><td>${found}</td></tr>`;
          })
          .join("")
      : `<tr><td colspan="3" class="bh-turns-empty">Nothing read yet in this chat.</td></tr>`;
    return `<div class="bh-editor-group-label">recent reads</div>
      <table class="bh-turns">
        <thead><tr><th>when</th><th>took</th><th>found</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  },

  /** The last extraction, end to end, so a bad turn can be looked at rather than guessed at. */
  async doctorView() {
    this.open("Doctor", `<p class="bh-view-lead">Checking this chat's setup…</p>`, async (body) => {
      // Captured together, before the requests. Reading the chat again afterwards let
      // a chat switch pair one chat's extraction with another chat's prompt in the same
      // report — which is exactly the thing the operator opens Doctor to rule out.
      const chatId = BH.dock.chatId;
      const chatProps = BH.dock.props ?? {};
      const lines = [];
      try {
        const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const snapshot = res.ok ? await res.json() : null;
        const characters = snapshot?.state?.characters ?? [];
        const slots = characters.reduce((n, c) => n + Object.keys(c.body ?? {}).length, 0);
        const selected = (await this.liveTemplate(chatId, chatProps)).templateId;
        lines.push(await this.vitalsHtml());
        lines.push(`<div class="bh-vlog">${await this.healthChecks(chatId, chatProps, snapshot)}</div>`);
        lines.push(await this.recentRunsHtml(chatId));
        lines.push(
          `<dl class="bh-doctor-facts">
             <dt>Last extraction</dt><dd>${snapshot?.createdAt ? BH.escapeHtml(new Date(snapshot.createdAt).toLocaleString()) : "none yet"}</dd>
             <dt>From message</dt><dd><code>${BH.escapeHtml(snapshot?.messageId ?? "—")}</code></dd>
             <dt>Characters tracked</dt><dd>${characters.length}</dd>
             <dt>Slots filled</dt><dd>${slots}</dd>
             <dt>Prompt in use</dt><dd>${selected === BH_FIVE_PASS_ID ? "five passes (local model)" : "one prompt (SOTA model)"}</dd>
           </dl>`,
        );
        // The report comes before the raw state: it is the thing to hand over when
        // something is wrong, and burying it under a JSON dump is how it goes unused.
        lines.push(
          `<div class="bh-editor-group-label">report</div>
           <div class="bh-report-block">
             <p class="bh-view-note">If something looks wrong, copy this and send it to us. It contains the version,
             the model, the prompt and what the panel found, so we do not have to ask.</p>
             <label class="bh-check bh-report-prose">
               <input type="checkbox" class="bh-report-include-prose">
               <span>also include the last few turns of your story
                 <small>off by default. Your story is not included unless you tick this box.</small></span>
             </label>
             <div class="bh-model-actions">
               <button type="button" class="bh-btn bh-btn-primary bh-report-copy"><i class="fa-solid fa-copy"></i>
                 Copy report</button>
               <button type="button" class="bh-btn bh-report-show">Show it</button>
             </div>
             <pre class="bh-doctor-json bh-report-text" hidden></pre>
           </div>`,
        );
        lines.push(
          `<div class="bh-editor-group-label">state as stored</div>
           <pre class="bh-doctor-json">${BH.escapeHtml(JSON.stringify(snapshot?.state ?? {}, null, 2))}</pre>`,
        );
        // Last, and marked as destructive. When the state has gone badly wrong there is
        // otherwise no way back except editing every slot by hand, but this throws away
        // work, so it asks first and says exactly what it will take.
        lines.push(
          `<div class="bh-editor-group-label">start over</div>
           <p class="bh-view-note">Clearing removes everyone Beholder is tracking in this chat, along with your
           locks, hand-set values, and the order and merges you set for this chat. Your story is not touched.
           The next turn starts again from nothing.</p>
           <div class="bh-model-actions">
             <button type="button" class="bh-btn bh-btn-danger bh-clear-state"><i class="fa-solid fa-eraser"></i>
               Clear what Beholder tracks</button>
           </div>`,
        );
        if (characters.length === 0) {
          lines.push(
            `<p class="bh-view-note">Nothing tracked yet. Beholder reads a turn after it is generated, so the
             first state appears once the scene describes what someone is wearing, holding, or hurt by.</p>`,
          );
        }
      } catch (error) {
        lines.push(`<p class="bh-view-warn">Could not read the state: ${BH.escapeHtml(error.message)}</p>`);
      }
      body.innerHTML = lines.join("");

      const block = body.querySelector(".bh-report-block");
      if (block) {
        const includeProse = () => !!block.querySelector(".bh-report-include-prose")?.checked;
        const textBox = block.querySelector(".bh-report-text");
        block.querySelector(".bh-report-copy")?.addEventListener("click", async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          try {
            const text = await BH.report.build({ includeProse: includeProse() });
            textBox.textContent = text;
            await BH.report.copy(text, button);
          } catch (error) {
            BH.toast(`Could not build the report: ${error.message}`);
          } finally {
            button.disabled = false;
          }
        });
        block.querySelector(".bh-report-show")?.addEventListener("click", async () => {
          textBox.textContent = await BH.report.build({ includeProse: includeProse() });
          textBox.hidden = !textBox.hidden;
        });
      }

      // Two presses, not a dialog: the button becomes the confirmation, so the choice
      // is made where the consequence is written rather than in a box that covers it.
      const clear = body.querySelector(".bh-clear-state");
      let armed = false;
      clear?.addEventListener("click", async () => {
        if (!armed) {
          armed = true;
          clear.classList.add("bh-btn-armed");
          clear.innerHTML = `<i class="fa-solid fa-eraser"></i> Press again to clear`;
          // Disarms itself, so a stray click cannot sit there waiting to be completed.
          window.setTimeout(() => {
            armed = false;
            clear.classList.remove("bh-btn-armed");
            clear.innerHTML = `<i class="fa-solid fa-eraser"></i> Clear what Beholder tracks`;
          }, 5000);
          return;
        }
        clear.disabled = true;
        try {
          const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ state: { characters: [] } }),
          });
          if (!res.ok) throw new Error(`${res.status}`);
          // The locks and edit marks describe slots that no longer exist; leaving them
          // would restore the cleared values on the next turn.
          BH.locks.clearAll(chatId);
          await BH.dock.refresh();
          BH.dock.render();
          BH.toast("Cleared — Beholder starts again from the next turn");
          this.close();
        } catch (error) {
          BH.toast(`Could not clear: ${error.message}`);
          clear.disabled = false;
        }
      });
    });
  },

  // ── Characters ────────────────────────────────────────────────────────────
  /**
   * Who the panel shows, and in what order.
   *
   * Presentation only, and it says so: hiding someone does not stop the extractor
   * tracking them, and merging two names does not teach it they are the same person.
   * A control that looks like it changes extraction and does not would be worse than
   * having none.
   */
  charactersView() {
    const render = (body) => {
      const names = Object.keys(BH.dock.state ?? {});
      const data = BH.roster.all();
      const { visible, hidden } = BH.roster.arrange(names);
      const persona = BH.dock.props?.personaInfo?.name ?? null;

      const row = (name) => {
        const you = name === persona;
        const chips = BH.roster
          .variantsOf(name, data)
          .map(
            (variant) =>
              `<span class="bh-ch-alias" data-variant="${BH.escapeHtml(variant)}">${BH.escapeHtml(variant)}<i class="fa-solid fa-xmark" title="Unmerge"></i></span>`,
          )
          .join("");
        return `<li class="bh-ch${you ? " bh-ch-you" : ""}" draggable="true" data-name="${BH.escapeHtml(name)}">
          <i class="bh-ch-grip fa-solid fa-grip-vertical" title="Drag to reorder"></i>
          <span class="bh-ch-main">
            <span class="bh-ch-name">${you ? '<i class="fa-solid fa-star bh-ch-star" title="You"></i> ' : ""}${BH.escapeHtml(name)}</span>
            ${chips ? `<span class="bh-ch-aliases">${chips}</span>` : ""}
          </span>
          <span class="bh-ch-tools">
            <i class="bh-ch-merge fa-solid fa-link" title="Same person as another name"></i>
            <i class="bh-ch-hide fa-solid fa-eye" title="Hide from the panel"></i>
          </span>
        </li>`;
      };

      body.innerHTML = `
        <p class="bh-view-lead">Who this panel shows. This is display only — hiding someone does not stop
        Beholder tracking them, and merging two names does not tell it they are the same person.</p>
        <ul class="bh-ch-list">${visible.map(row).join("") || '<li class="bh-ch-empty">No one tracked yet.</li>'}</ul>
        ${
          hidden.length
            ? `<div class="bh-ch-tray"><span class="bh-ch-tray-cap">Hidden</span><ul class="bh-ch-list">${hidden
                .map(
                  (name) =>
                    `<li class="bh-ch bh-ch-hidden" data-name="${BH.escapeHtml(name)}">
                      <span class="bh-ch-main"><span class="bh-ch-name">${BH.escapeHtml(name)}</span></span>
                      <span class="bh-ch-tools"><i class="bh-ch-unhide fa-solid fa-eye-slash" title="Show"></i></span>
                    </li>`,
                )
                .join("")}</ul></div>`
            : ""
        }`;

      const again = () => {
        render(body);
        BH.dock.render();
      };

      for (const control of body.querySelectorAll(".bh-ch-hide")) {
        control.addEventListener("click", (event) => {
          event.stopPropagation();
          BH.roster.setHidden(control.closest(".bh-ch").dataset.name, true);
          again();
        });
      }
      for (const control of body.querySelectorAll(".bh-ch-unhide")) {
        control.addEventListener("click", (event) => {
          event.stopPropagation();
          BH.roster.setHidden(control.closest(".bh-ch").dataset.name, false);
          again();
        });
      }
      for (const chip of body.querySelectorAll(".bh-ch-alias .fa-xmark")) {
        chip.addEventListener("click", (event) => {
          event.stopPropagation();
          BH.roster.removeAlias(chip.closest(".bh-ch-alias").dataset.variant);
          again();
        });
      }
      for (const control of body.querySelectorAll(".bh-ch-merge")) {
        control.addEventListener("click", (event) => {
          event.stopPropagation();
          const rowElement = control.closest(".bh-ch");
          const existing = rowElement.querySelector(".bh-ch-pick");
          if (existing) {
            existing.remove();
            return;
          }
          const name = rowElement.dataset.name;
          const pick = document.createElement("div");
          pick.className = "bh-ch-pick";
          pick.innerHTML =
            `<span class="bh-ch-pick-lead">is</span>` +
            visible
              .filter((other) => other !== name)
              .map(
                (other) =>
                  `<button class="bh-ch-pill" type="button" data-target="${BH.escapeHtml(other)}">${BH.escapeHtml(other)}</button>`,
              )
              .join("") +
            // The pills only offer names currently on screen, and the name you want is
            // often not one of them: the extractor wrote "the guard" once and has since
            // settled on "Rhys", so the row to merge away has no partner to point at.
            `<input class="bh-ch-pick-input" type="text" placeholder="or type a name…"
               data-bh-escape="self"
               aria-label="Merge ${BH.escapeHtml(name)} into a name you type">`;
          rowElement.appendChild(pick);
          const mergeInto = (target) => {
            const clean = String(target ?? "").trim();
            if (!clean || clean.toLowerCase() === name.toLowerCase()) return;
            // This row's name becomes a variant of the one picked, so the panel stops
            // showing the same person twice.
            BH.roster.addAlias(name, clean);
            // Merging into a name nobody is being tracked under yet is allowed — it is
            // how you fix a name before the story settles on it — but there is no row to
            // fold into, so the panel does not visibly change. Without this the action
            // looks like it failed.
            if (!visible.some((other) => other.toLowerCase() === clean.toLowerCase())) {
              BH.toast(`Noted — ${name} will be shown as ${clean} once ${clean} appears`);
            }
            again();
          };
          for (const pill of pick.querySelectorAll(".bh-ch-pill")) {
            pill.addEventListener("click", () => mergeInto(pill.dataset.target));
          }
          const typed = pick.querySelector(".bh-ch-pick-input");
          // The field carries data-bh-escape="self", so the view leaves Escape alone
          // here and an ordinary listener is enough.
          typed.addEventListener("keydown", (keyEvent) => {
            if (keyEvent.key !== "Enter" && keyEvent.key !== "Escape") return;
            keyEvent.preventDefault();
            if (keyEvent.key === "Enter") mergeInto(typed.value);
            else pick.remove();
          });
          typed.focus();
        });
      }

      // Drag to reorder, persisted as the roster order.
      const list = body.querySelector(".bh-ch-list");
      let dragging = null;
      for (const item of body.querySelectorAll(".bh-ch[draggable]")) {
        item.addEventListener("dragstart", () => {
          dragging = item;
          item.classList.add("bh-ch-dragging");
        });
        item.addEventListener("dragend", () => {
          item.classList.remove("bh-ch-dragging");
          dragging = null;
          BH.roster.setOrder([...list.querySelectorAll(".bh-ch[draggable]")].map((row) => row.dataset.name));
          BH.dock.render();
        });
        item.addEventListener("dragover", (event) => {
          event.preventDefault();
          if (!dragging || dragging === item) return;
          const box = item.getBoundingClientRect();
          const after = event.clientY > box.top + box.height / 2;
          item.parentNode.insertBefore(dragging, after ? item.nextSibling : item);
        });
      }
    };

    this.open("Characters", `<p class="bh-view-lead">Reading the roster…</p>`, (body) => render(body));
  },

  // ── Inspector ─────────────────────────────────────────────────────────────
  /**
   * The most recent round trip, captured on demand.
   *
   * The engine does not keep the prompt and the reply after a run, so seeing them means
   * running the turn again with debug output on. That is a real model call, so it is a
   * button the operator presses rather than something that happens on open.
   */
  async inspectorView() {
    this.open(
      "Inspector",
      `<p class="bh-view-lead">The full round trip for a turn — the prompt each pass was given, the prose it
       read, and what it answered. Nothing is kept after a run, so this re-runs the turn with capture on.</p>
       <p class="bh-view-note">That is one model call per pass, against whichever model is answering.</p>
       <div class="bh-model-actions">
         <button type="button" class="bh-btn bh-btn-primary bh-inspect-run"><i class="fa-solid fa-play"></i>
           Capture this turn</button>
       </div>
       <div class="bh-inspect-out"></div>`,
      (body) => {
        const button = body.querySelector(".bh-inspect-run");
        const out = body.querySelector(".bh-inspect-out");
        button.addEventListener("click", async () => {
          const chatId = BH.dock.chatId;
          if (!chatId) {
            BH.toast("No chat open");
            return;
          }
          button.disabled = true;
          const original = button.innerHTML;
          button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Capturing…`;
          out.innerHTML = "";
          try {
            const { passes, warning } = await BH.inspector.capture(chatId, null);
            if (!passes.length) {
              out.innerHTML = `<p class="bh-view-warn">The run produced no debug output. If Beholder is not
                active in this chat there is nothing to capture.</p>`;
              return;
            }
            out.innerHTML =
              (warning ? `<p class="bh-view-note">${BH.escapeHtml(warning)}</p>` : "") +
              passes.map((pass, index) => BH.inspector.passHtml(pass, index)).join("");
          } catch (error) {
            out.innerHTML = `<p class="bh-view-warn">Could not capture: ${BH.escapeHtml(error.message)}</p>`;
          } finally {
            button.disabled = false;
            button.innerHTML = original;
          }
        });
      },
    );
  },

  // ── Help ──────────────────────────────────────────────────────────────────
  helpView() {
    this.open(
      "Help",
      `
      <p class="bh-view-lead">Beholder reads each turn of your story and remembers what it says about each
      character's body: what they are wearing on each part, what they are holding, their injuries, which parts
      are uncovered or lost, and their species.</p>

      <div class="bh-editor-group-label">reading the panel</div>
      <p class="bh-view-note">The colours on each body part mean this:</p>
      <div class="bh-legend-row"><span class="bh-legend-bar bh-tier-0"></span>in good condition</div>
      <div class="bh-legend-row"><span class="bh-legend-bar bh-tier-2"></span>damaged</div>
      <div class="bh-legend-row"><span class="bh-legend-bar bh-tier-4"></span>broken</div>
      <div class="bh-legend-row"><span class="bh-legend-bar bh-tier-holding"></span>something held in the hand</div>
      <div class="bh-legend-row"><span class="bh-legend-dot"></span>an injury to the body itself</div>
      <p class="bh-view-note">A ring <b>around</b> a body part is the state of what is worn on it. Colour
      <b>inside</b> the body part is the body itself. Click any part to change it, or to lock it so the story
      cannot change it back.</p>

      <div class="bh-editor-group-label">what it reads well</div>
      <p class="bh-view-note"><b>Scenes with several characters are fine.</b> This is what Beholder is made
      for. In testing it put the right item on the right person about <b>95% of the time</b>.</p>
      <p class="bh-view-note">It needs writing that <b>follows one person at a time</b>, so the reader can tell
      whose view the scene is told from. Both of these work:</p>
      <ul class="bh-help-list">
        <li>"I pulled off my coat."</li>
        <li>"She pulled off her coat."</li>
      </ul>
      <p class="bh-view-note">It was tested on five kinds of roleplay writing and works with all of them: chat
      roleplay, story fanfic, web serials, interactive fiction, and forum play-by-post.</p>

      <div class="bh-editor-group-label">what it does not read well</div>
      <ul class="bh-help-list">
        <li>Writing that moves between many people's thoughts in one paragraph, with no single person to
          follow.</li>
        <li>Film or play scripts — for example <code>INT. ROOM - NIGHT</code>, or names in capitals above
          their lines.</li>
      </ul>
      <p class="bh-view-note">This is not a bug. The model is very small on purpose, so it can run for free on
      your own computer and your story never leaves it.</p>
      <p class="bh-view-note">If that is how you write, a large model reads this kind of writing better. You
      can connect this agent to one in the Prompt view. We do not support that, and your story would then be
      sent to that model instead of staying on your computer.</p>
      <p class="bh-view-note">Doctor tells you when it sees writing it may not read well, so you do not have to
      guess from an empty panel.</p>

      <div class="bh-editor-group-label">how to read the picture</div>
      <ul class="bh-help-list">
        <li>A coloured <b>outline</b> on a body part — the worst damage of anything worn there.</li>
        <li>A <b>filled</b> body part — an injury to the body itself. The worse it is, the stronger the colour.</li>
        <li><b>✦</b> next to a hand — the character is holding something.</li>
        <li>A crossed-out part marked <b>MISSING</b> — the character has lost it. Everything below it counts as
        lost too.</li>
        <li><b>BARE</b> — the story said this part is uncovered. That is not the same as simply not knowing
        yet.</li>
      </ul>

      <div class="bh-editor-group-label">the three switches</div>
      <p>The Color, Damage and Wounds switches only change what you see. Turning one off hides that detail.
      Nothing is forgotten.</p>

      <div class="bh-editor-group-label">changing something</div>
      <ul class="bh-help-list">
        <li>Click any body part to correct it. <b>Apply</b> saves your change, so the next turn uses what you
        wrote instead of what the model guessed.</li>
        <li><b>Lock</b> a part when you have set it yourself and want Beholder to leave it alone.</li>
        <li>Ticking <b>bare</b> removes what is worn there. Ticking <b>missing</b> replaces everything for that
        part.</li>
      </ul>

      <div class="bh-editor-group-label">telling it something directly</div>
      <p class="bh-view-note">The box at the bottom of this panel sends a fact straight to Beholder, without
      writing it into the story. Say what <b>happened</b>, and name the person:</p>
      <ul class="bh-help-list">
        <li>"Maggie takes off her boots."</li>
        <li>"Maggie is now wearing black gloves."</li>
        <li>"Maggie has a deep cut on her left arm."</li>
      </ul>
      <p class="bh-view-note">For damage, say it as a thing the item has, not as a word in front of it.
      "Maggie wears a belt with a tear in it" works; "Maggie is wearing a torn belt" is read as the belt coming
      off. Slots you change this way are locked, so the next turn does not undo them.</p>

      <div class="bh-editor-group-label">writing so it reads well</div>
      <ul class="bh-tips">
        <li>Name the clothing and the person. "She pulls off <i>her</i> gloves" works. "They undress" does
        not.</li>
        <li>Put taking something off in its own sentence. When one sentence removes and adds clothing at the
        same time, Beholder often catches only half of it.</li>
        <li>Clothing that belongs to nobody is ignored on purpose, such as a cloak hanging on a hook.</li>
      </ul>

      <div class="bh-orn" aria-hidden="true"><span></span>◉<span></span></div>
      <p class="bh-help-sign">Out of sight, out of prompt. <span>Beholder doesn't blink.</span></p>`,
    );
  },
};

// ===== 70-backfill.js =====
// ── Building state from the chat ────────────────────────────────────────────
//
// The panel can only show what the extractor has been run over. Turn Beholder on
// halfway through a chat and the doll is empty until the next message, which reads as
// broken. The reference extension answers that with a backfill control: walk the
// messages already in the chat and extract from each.
//
// Here the extraction itself runs server-side, so a walk is a sequence of agent runs
// scoped to one message at a time via `forMessageId`. That is the whole difference
// from the reference — the shapes and the wording are the same.
//
// Every mode costs real model calls, one per message, against whichever connection is
// answering. So: the count is stated before anything runs, progress is live, and
// cancel takes effect at the next message boundary rather than being decorative.

BH.backfill = {
  running: false,
  cancelled: false,

  /** The assistant messages in this chat, oldest first. */
  async messages(chatId) {
    // Messages have their own route; the chat record does not include them. Reading
    // them off the chat returned an empty list every time, so a build always reported
    // "nothing to build from" no matter how long the chat was.
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`messages ${res.status}`);
    const payload = await res.json();
    const rows = Array.isArray(payload) ? payload : (payload?.messages ?? []);
    return rows.filter((row) => row && row.id && !row.isUser && row.role !== "user");
  },

  /** The message the stored state was last built from, or null. */
  async lastProcessed(chatId) {
    try {
      const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      return (await res.json())?.messageId ?? null;
    } catch {
      return null;
    }
  },

  /** Run the agent for one message. Without an id it runs the latest turn. */
  async runOne(chatId, messageId) {
    const res = await fetch("/api/generate/retry-agents", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        agentTypes: ["beholder"],
        ...(messageId ? { forMessageId: messageId } : {}),
      }),
    });
    if (!res.ok) throw new Error(`extract ${res.status}`);
    // The route streams; drain it so the run is finished before the next one starts.
    // Overlapping runs on one chat would race each other's state writes.
    await res.text();
  },

  /** Wipe the tracked state so a rebuild starts from nothing. */
  async clearState(chatId) {
    const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: { characters: [] } }),
    });
    // fetch resolves for 4xx and 5xx, so this used to report success for a wipe that
    // never happened — and the rebuild then read every message on top of the state it
    // was supposed to have replaced, keeping exactly the characters the operator asked
    // to be rid of.
    if (!res.ok) throw new Error(`could not clear the existing state (${res.status})`);
  },

  // ── progress strip ────────────────────────────────────────────────────────
  status() {
    return BH.dock.panel?.querySelector(".beholder-backfill-status") ?? null;
  },

  setProgress({ done, total, inFlight }) {
    const status = this.status();
    if (!status) return;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const label = inFlight
      ? `<i class="fa-solid fa-spinner fa-spin"></i> Building history — extracting <b>${done + 1}</b> / ${total}…`
      : `Building history: <b>${done}</b> / ${total}`;
    status.innerHTML = `
      <div class="bh-bf-progress" role="status" aria-live="polite">
        <span class="bh-bf-text">${label}</span>
        <span class="bh-bf-bar"><span class="bh-bf-bar-fill" style="width:${pct}%"></span></span>
        <button type="button" class="bh-btn bh-bf-cancel">Cancel</button>
      </div>`;
    status.hidden = false;
    status.querySelector(".bh-bf-cancel")?.addEventListener("click", () => {
      this.cancelled = true;
      const text = status.querySelector(".bh-bf-text");
      if (text) text.textContent = "Stopping after this message…";
    });
  },

  clearStatus() {
    const status = this.status();
    if (!status) return;
    status.innerHTML = "";
    status.hidden = true;
  },

  // ── modes ─────────────────────────────────────────────────────────────────
  /**
   * @param mode "turn" re-runs the latest message, "build" walks what has not been
   *   processed yet, "rebuild" clears the state and walks everything.
   */
  async run(mode) {
    if (this.running) {
      BH.toast("Already building — cancel that first");
      return;
    }
    const chatId = BH.dock.chatId;
    if (!chatId) {
      BH.toast("No chat open");
      return;
    }

    this.running = true;
    this.cancelled = false;
    try {
      if (mode === "turn") {
        this.setProgress({ done: 0, total: 1, inFlight: true });
        await this.runOne(chatId, null);
        BH.toast("Re-extracted this turn");
        return;
      }

      const all = await this.messages(chatId);
      let todo = all;
      if (mode === "build") {
        const last = await this.lastProcessed(chatId);
        const index = last ? all.findIndex((row) => row.id === last) : -1;
        todo = index >= 0 ? all.slice(index + 1) : all;
      }

      if (todo.length === 0) {
        BH.toast(mode === "build" ? "Already up to date" : "Nothing to build from");
        return;
      }
      // One model call per message, so the operator is told the size of the bill
      // before it is run rather than after.
      const what = mode === "rebuild" ? "Rebuild from scratch" : "Build from history";
      if (!window.confirm(`${what}: extract from ${todo.length} message${todo.length === 1 ? "" : "s"}?`)) return;

      if (mode === "rebuild") await this.clearState(chatId);

      for (let index = 0; index < todo.length; index += 1) {
        if (this.cancelled) {
          BH.toast(`Stopped after ${index} of ${todo.length}`);
          break;
        }
        this.setProgress({ done: index, total: todo.length, inFlight: true });
        try {
          await this.runOne(chatId, todo[index].id);
        } catch (error) {
          // One bad message should not throw away the work already done.
          BH.toast(`Message ${index + 1} failed: ${error.message}`);
        }
        BH.dock.refresh?.();
      }
      if (!this.cancelled) BH.toast(`Built state from ${todo.length} message${todo.length === 1 ? "" : "s"}`);
    } catch (error) {
      BH.toast(`Could not build: ${error.message}`);
    } finally {
      this.running = false;
      this.clearStatus();
      BH.dock.refresh?.();
    }
  },

  // ── the "more build options" menu ─────────────────────────────────────────
  closeMenu() {
    document.querySelector(".beholder-bf-menu")?.remove();
    BH.dock.panel?.querySelector(".beholder-backfill-group")?.classList.remove("bh-menu-open");
    if (this.menuDismiss) {
      document.removeEventListener("click", this.menuDismiss, true);
      this.menuDismiss = null;
    }
  },

  toggleMenu() {
    if (document.querySelector(".beholder-bf-menu")) {
      this.closeMenu();
      return;
    }
    const group = BH.dock.panel?.querySelector(".beholder-backfill-group");
    if (!group) return;
    group.classList.add("bh-menu-open");

    const menu = document.createElement("div");
    menu.className = "beholder-bf-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <button type="button" class="bh-bf-mode" data-mode="build" role="menuitem">
        <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
        <span class="bh-bf-mode-text">
          <span class="bh-bf-mode-title">Build from history</span>
          <span class="bh-bf-mode-sub">walk the messages this chat has not extracted yet</span>
        </span>
      </button>
      <button type="button" class="bh-bf-mode" data-mode="turn" role="menuitem">
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
        <span class="bh-bf-mode-text">
          <span class="bh-bf-mode-title">Re-extract this turn</span>
          <span class="bh-bf-mode-sub">run the latest message again — for when it read one turn wrong</span>
        </span>
      </button>
      <button type="button" class="bh-bf-mode bh-bf-mode-danger" data-mode="rebuild" role="menuitem">
        <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
        <span class="bh-bf-mode-text">
          <span class="bh-bf-mode-title">Rebuild from scratch</span>
          <span class="bh-bf-mode-sub">clear the tracked state and re-extract every message</span>
        </span>
      </button>`;

    // Rendered to the document, not inside the panel: the panel clips its overflow
    // and would cut the menu off.
    document.body.appendChild(menu);
    const anchor = group.getBoundingClientRect();
    const width = menu.offsetWidth || 280;
    const height = menu.offsetHeight || 180;
    let left = anchor.left + anchor.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = anchor.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, anchor.top - height - 6);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    for (const option of menu.querySelectorAll(".bh-bf-mode")) {
      option.addEventListener("click", () => {
        const mode = option.dataset.mode;
        this.closeMenu();
        void this.run(mode);
      });
    }
    this.menuDismiss = (event) => {
      if (event.target?.closest?.(".beholder-bf-menu, .beholder-backfill-group")) return;
      this.closeMenu();
    };
    setTimeout(() => document.addEventListener("click", this.menuDismiss, true), 0);
  },
};

// ===== 72-prose.js =====
// ── Is this prose something Beholder can read? ──────────────────────────────
//
// Beholder is a small model that anchors on a passage's POINT OF VIEW. Several
// characters in a scene is what it is for — keeping their things apart is trained and
// measured, at about 0.95 attribution across the supported registers. What costs it is
// narration with no anchor: the omniscient voice surveying four people's inner lives as
// equals, or a script. That is a property of the model, not a bug waiting to be fixed,
// and someone whose scenes read that way deserves to be told rather than left
// concluding the thing is broken.
//
// Two checks, and only two, because only two can be made honestly:
//
//   1. Script form. Measured against the register corpus the model was evaluated on:
//      96% of script passages caught, and zero false alarms in 200 passages of ordinary
//      roleplay. Worth stating outright.
//
//   2. Prose that describes bodies and yielded nothing anyway. Not a classification —
//      an observation, and a gated one.
//
//      The gate is vocabulary, because length is not: a long turn of pure dialogue has
//      nothing to extract, and warning that Beholder "found nothing" in it is noise. On
//      the register corpus a passage naming a garment or an injury has state to find
//      49% of the time against 15% for one that names neither, and across a window of
//      eight turns the gate is far sharper still: where three or more turns name
//      clothing or injuries, 97-100% of those windows genuinely contain something
//      extractable, on every in-scope register. So when the gate opens and the panel is
//      still empty, something really was missed — which is the only condition under
//      which saying so is fair.
//
// Detecting omniscient narration by shape was tried and abandoned: every feature —
// recurring names, attributed interiority, titles, sentence length — landed at chance
// against the same corpus, around one ordinary roleplay passage in five false-flagged
// for the same catch rate. A warning that wrong is worse than none.

/** Scene headings, camera directions and speaker cues — the shape of a script. */
const BH_SCRIPT_SLUG = /^[ \t]*(INT|EXT|INT\.\/EXT|I\/E)[.\s]/im;
const BH_SCRIPT_CAMERA =
  /\b(CLOSE ?UP|CUT TO|FADE (IN|OUT)|DISSOLVE TO|MONTAGE|ANGLE ON|PAN (TO|ACROSS)|V\.O\.|O\.S\.|SMASH CUT)\b/;
/** A speaker cue is a whole line in caps, optionally with a parenthetical. */
const BH_SCRIPT_CUE = /^[ \t]*[A-Z][A-Z0-9 .'-]{2,28}(\([^)]{1,20}\))?[ \t]*$/gm;

/** Injury words, the other half of "this passage describes a body". */
const BH_WOUND_RX =
  /\b(wound|cut|gash|bruise|burn|scar|blood|bleeding|broken|fracture|stab|slash|bite|graze|welt)\w*\b/i;
/** Built once from the generated vocabulary; 158 alternatives is not worth rebuilding. */
let BH_GARMENT_RX = null;

BH.prose = {
  /** True when a passage is written as a script rather than as prose. */
  isScript(text) {
    const body = typeof text === "string" ? text : "";
    if (body.trim().length < 40) return false;
    if (BH_SCRIPT_SLUG.test(body) || BH_SCRIPT_CAMERA.test(body)) return true;
    // One stray shouted line is not a script; two cues is a pattern.
    return (body.match(BH_SCRIPT_CUE) ?? []).length >= 2;
  },

  /**
   * Does this passage describe something Beholder could extract?
   *
   * Word count was the wrong gate — length says nothing about whether there is any
   * physical state in a passage, so it warned about dialogue-heavy turns that were
   * empty for the ordinary reason that nobody's clothes came up.
   */
  describesState(text) {
    const body = typeof text === "string" ? text : "";
    if (!BH_GARMENT_RX) {
      BH_GARMENT_RX = new RegExp(`\\b(?:${BH_GARMENT_WORDS.join("|")})s?\\b`, "i");
    }
    return BH_GARMENT_RX.test(body) || BH_WOUND_RX.test(body);
  },

  /**
   * Look at the recent turns and the state they produced.
   *
   * Returns null when there is nothing to say — the common case, and the panel should
   * stay quiet then rather than editorialise about someone's writing.
   */
  /** The recent assistant turns, as plain strings. Shared with the report. */
  async sample(chatId) {
    if (!chatId) return [];
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages?limit=12`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return [];
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : (payload?.messages ?? []);
      return rows
        .filter((row) => row && !row.isUser && row.role !== "user")
        .slice(-8)
        .map((row) => row.content ?? row.text ?? "")
        .filter(Boolean);
    } catch {
      return [];
    }
  },

  async assess(chatId, state) {
    if (!chatId) return null;
    // Through sample(), which already reads exactly these turns. This used to repeat
    // the same request with its own copy of the filtering, so opening Doctor fetched
    // the chat's messages twice and the two copies could drift apart.
    const bodies = await this.sample(chatId);
    if (!bodies.length) return null;
    const scripted = bodies.filter((body) => this.isScript(body)).length;
    const describing = bodies.filter((body) => this.describesState(body)).length;

    if (scripted >= 2 || (scripted === 1 && bodies.length === 1)) {
      return {
        verdict: "script",
        copy:
          "These turns are written as a script — scene headings, camera directions or speaker cues. " +
          "Beholder will not do well with that, sorry. It reads narrative prose told from someone's point " +
          "of view, and that is a limit of the small local model rather than something waiting to be fixed.",
      };
    }

    const tracked = Object.keys(state ?? {}).length;
    const slots = Object.values(state ?? {}).reduce(
      (total, character) => total + Object.keys(character?.body ?? {}).length,
      0,
    );
    // Three turns that describe clothing or injuries and still produced nothing. One
    // such turn proves little — roughly half of them have nothing to find even so — but
    // three in a row is unlikely to be the prose simply not mentioning anything.
    if (describing >= 3 && (tracked === 0 || slots <= 1)) {
      return {
        verdict: "described-but-unread",
        copy:
          `${describing} recent turns describe clothes or injuries, but Beholder found none of them. The ` +
          "checks above look fine, so this may be writing it cannot read well — for example, writing that " +
          "moves between many people's thoughts with no single person to follow. Having several characters " +
          "is fine. The problem is when there is no one person to follow.",
        aside:
          "A large model reads this kind of writing better. You can connect this agent to one, but we do " +
          "not support that, and your story would be sent to that model instead of staying on your computer.",
      };
    }
    return null;
  },
};

// ===== 74-notebox.js =====
// ── Telling Beholder something directly ─────────────────────────────────────
//
// Everything else here waits for the story to say it. Sometimes you just want to state
// a fact — the sword broke, she is barefoot now — without writing a paragraph to carry
// it. The reference extension puts a small text box above the chat input for exactly
// that, and this is the same thing.
//
// What you type is read by the extractor as if it were a line of the story, with the
// current state as context, so an unnamed item still attaches to whoever is actually
// wearing it. That happens server-side, through the ordinary agent path with the typed
// text standing in for the narration.
//
// Which means it reads a directive the way it reads a story, and phrasing carries.
// Measured against the local model:
//
//   "Maggie takes off her belt."            → removed          ✓
//   "Maggie is now wearing black gloves."   → added            ✓
//   "Maggie has a deep cut on her left arm."→ wound added      ✓
//   "Maggie wears a belt with a tear in it."→ damage: damaged  ✓
//   "Maggie is wearing a torn belt."        → belt REMOVED     ✗
//
// The last one is why the placeholder shows a phrasing that works: an adjective
// attached to the garment reads as an event to a model trained on events. Saying what
// happened beats describing how a thing looks.
//
// The slots it touches are then locked. A directive that the next turn quietly
// overwrote would be worse than no directive at all: you would state a fact, watch it
// take, and find it gone two messages later with nothing to explain it.

BH.notebox = {
  /**
   * Mounted in Beholder's own panel, not above the host's message box.
   *
   * The reference extension puts it above SillyTavern's send form, and its own comment
   * admits that placement is unverified and version-dependent. Checked here against the
   * running engine: the composer has no stable hook at all — every ancestor is a
   * Tailwind utility class, so anchoring to one would break on the next restyle of a
   * product this package does not own.
   *
   * The panel is a floating window beside the chat, so a box in its footer is as
   * reachable as one above the message field, and it cannot be broken by anybody else.
   */
  /**
   * Does this engine understand a typed directive?
   *
   * It matters because an engine that does not will accept the request and ignore the
   * field, re-running the turn against the story instead — so the box would look like
   * it worked and quietly do something else. There is no way to tell that apart from
   * the response, so this asks after a route that shipped alongside the directive: if
   * the engine has one it has the other, and if it 404s it predates both.
   *
   * Asked once per chat and remembered, because the answer is a property of the engine
   * rather than of the moment.
   */
  async supported(chatId) {
    if (typeof this.support === "boolean") return this.support;
    if (!chatId) return true;
    try {
      const res = await fetch(`/api/agents/beholder-runs/${encodeURIComponent(chatId)}?limit=1`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      this.support = res.status !== 404;
    } catch {
      // A failed probe is not evidence of an old engine; assume support and let the
      // send report a real error if there is one.
      this.support = true;
    }
    return this.support;
  },

  mount() {
    if (document.querySelector(".beholder-notebox")) return true;
    const panel = BH.dock.panel;
    const anchor = panel?.querySelector(".beholder-resize-handle") ?? null;
    if (!panel) return false;

    const wrap = document.createElement("div");
    wrap.className = "beholder-notebox";
    wrap.innerHTML = `
      <input type="text" class="beholder-notebox-input"
        placeholder="Tell Beholder: e.g. &quot;Maggie takes off her boots&quot;"
        aria-label="Tell Beholder something about the scene">
      <button type="button" class="beholder-notebox-btn bh-btn" title="Apply now">
        <i class="fa-solid fa-paper-plane"></i>
      </button>`;
    // Above the resize handle when there is one, otherwise last in the panel.
    if (anchor) panel.insertBefore(wrap, anchor);
    else panel.appendChild(wrap);

    const input = wrap.querySelector(".beholder-notebox-input");
    const button = wrap.querySelector(".beholder-notebox-btn");
    const send = () => void this.apply(input, button);
    button.addEventListener("click", send);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      // The host's composer listens for Enter too; this must not also send a message.
      event.preventDefault();
      event.stopPropagation();
      send();
    });

    // Shown, then disabled if the engine turns out to be too old. Hiding it outright
    // would leave someone reading about the box in Help and unable to find it.
    void this.supported(BH.dock.chatId).then((ok) => {
      if (ok) return;
      input.disabled = true;
      button.disabled = true;
      // Whatever was typed while the probe was in flight stays. Clearing it threw away
      // someone's sentence to tell them the feature is unavailable, which is a poor
      // trade for a message.
      input.placeholder = "Needs a newer version of Marinara";
      wrap.title =
        "This box asks Beholder to read a sentence you type. The version of Marinara you are running does not support that yet.";
    });
    return true;
  },

  unmount() {
    document.querySelector(".beholder-notebox")?.remove();
  },

  async apply(input, button) {
    const text = input.value.trim();
    if (!text) return;
    const chatId = BH.dock.chatId;
    if (!chatId) {
      BH.toast("Open a chat first");
      return;
    }

    input.disabled = true;
    button.disabled = true;
    const before = BH.dock.state ?? {};
    try {
      const res = await fetch("/api/generate/retry-agents", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, agentTypes: ["beholder"], beholderDirective: text }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await res.text(); // the route streams; wait for the run to finish

      await BH.dock.refresh();
      const changed = this.changedSlots(before, BH.dock.state ?? {});
      // Locked so the next turn does not quietly undo what was just stated.
      for (const [character, slot] of changed) {
        BH.locks.set(character, slot, true);
        BH.locks.remember(character, slot, BH.dock.state?.[character]?.body?.[slot] ?? null);
      }
      BH.dock.render();
      input.value = "";
      BH.toast(
        changed.length
          ? `Applied to ${changed.length} slot${changed.length === 1 ? "" : "s"}, and locked so the story does not undo it`
          : "Nothing changed — try naming the person and the item",
      );
    } catch (error) {
      BH.toast(`Could not apply: ${error.message}`);
    } finally {
      input.disabled = false;
      button.disabled = false;
      input.focus();
    }
  },

  /** Which character/slot pairs differ between two states. */
  changedSlots(before, after) {
    const changed = [];
    for (const [character, entry] of Object.entries(after)) {
      for (const [slot, value] of Object.entries(entry?.body ?? {})) {
        const previous = before?.[character]?.body?.[slot];
        if (JSON.stringify(previous ?? null) !== JSON.stringify(value ?? null)) changed.push([character, slot]);
      }
    }
    return changed;
  },
};

// ===== 76-onboard.js =====
// ── The first time you open it ──────────────────────────────────────────────
//
// A silhouette with coloured marks on it, a row of small buttons, and no explanation.
// Someone opening Beholder for the first time has no reason to know that the ring
// around an arm means the sleeve is torn rather than the arm, or that a slot can be
// clicked at all. The reference extension shows a short note beside the panel once, and
// this is the same note with this package's controls in it.
//
// Shown once per browser, then never again. It is the least intrusive thing that still
// answers "what is this?", and someone who dismissed it and wants it back has the Help
// view, which says all of this at length.
//
// The wording is deliberately plain: short sentences, common words, no idiom. A good
// share of the people reading it are not reading in their first language, and "the doll
// flips front-to-back" is a sentence you can only parse if you already know what it
// means.

BH.onboard = {
  KEY: "marinara.beholder.onboarded",

  seen() {
    try {
      return window.localStorage.getItem(this.KEY) === "true";
    } catch {
      // Storage blocked: better to skip it than to show it on every single open.
      return true;
    }
  },

  remember() {
    try {
      window.localStorage.setItem(this.KEY, "true");
    } catch {
      // Nothing to do; at worst it appears again next time.
    }
  },

  /** Show it beside the panel, once. */
  maybeShow() {
    if (this.seen()) return false;
    const panel = BH.dock.panel;
    if (!panel || panel.classList.contains("bh-collapsed")) return false;
    if (document.querySelector(".beholder-onboard")) return false;

    const tip = document.createElement("div");
    tip.className = "beholder-onboard";
    tip.setAttribute("role", "dialog");
    tip.setAttribute("aria-label", "About Beholder");
    tip.innerHTML = `
      <div class="bh-onboard-arrow"></div>
      <div class="bh-onboard-head">
        <span class="bh-onboard-title">◉ Beholder</span>
        <button type="button" class="bh-onboard-close fa-solid fa-xmark" title="Close"
          aria-label="Close"></button>
      </div>
      <div class="bh-onboard-body">
        Beholder reads each turn of your story. It keeps track of what every character is
        <b>wearing</b>, what they are <b>holding</b>, and any <b>injuries</b>. It updates itself after each
        reply.
        <ul class="bh-onboard-tips">
          <li>Colour <b>around</b> a body part is the state of the clothing there. Colour <b>inside</b> it is
            the body itself.</li>
          <li><b>Click a body part</b> to change what it says, or to lock it so the story cannot change it.</li>
          <li>The box at the bottom sends Beholder a fact directly, such as
            <i>"Maggie takes off her boots"</i>.</li>
          <li>More than one character gets a row of names at the top.</li>
        </ul>
      </div>
      <div class="bh-onboard-foot">
        <button type="button" class="bh-btn bh-btn-primary bh-onboard-dismiss">Got it</button>
      </div>`;
    document.body.appendChild(tip);
    this.place(tip, panel);

    const dismiss = () => {
      tip.remove();
      this.remember();
      window.removeEventListener("resize", reposition);
    };
    // Follows the panel: it is a draggable, resizable window, and a note pinned to where
    // the panel used to be is worse than no note.
    const reposition = () => this.place(tip, panel);
    window.addEventListener("resize", reposition);
    for (const control of tip.querySelectorAll(".bh-onboard-close, .bh-onboard-dismiss")) {
      control.addEventListener("click", dismiss);
    }
    tip.querySelector(".bh-onboard-dismiss")?.focus?.();
    return true;
  },

  /**
   * Beside the panel when there is room, over it when there is not.
   *
   * The reference always places it outside the panel, which is safe on a desktop where
   * the panel is a small window in a corner. Here the panel can fill a phone screen,
   * and "beside" would be off the edge — so below a certain width it sits on top,
   * centred, and the arrow is hidden because it would be pointing at nothing.
   */
  place(tip, panel) {
    const box = panel.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    tip.style.width = `${width}px`;
    const roomLeft = box.left >= width + 20;
    const roomRight = window.innerWidth - box.right >= width + 20;

    if (!roomLeft && !roomRight) {
      tip.dataset.side = "over";
      tip.style.left = `${Math.max(12, box.left + (box.width - width) / 2)}px`;
      tip.style.right = "auto";
      tip.style.top = `${Math.max(12, box.top + 12)}px`;
      return;
    }
    tip.dataset.side = roomLeft ? "right" : "left";
    tip.style.top = `${Math.max(12, box.top)}px`;
    if (roomLeft) {
      tip.style.right = `${window.innerWidth - box.left + 12}px`;
      tip.style.left = "auto";
    } else {
      tip.style.left = `${box.right + 12}px`;
      tip.style.right = "auto";
    }
  },
};

// ===== 78-badges.js =====
// ── What each message changed ───────────────────────────────────────────────
//
// The panel shows the state as it is now. The question it cannot answer is "which turn
// did that?" — and that is the question you have when something is wrong, because the
// turn that introduced it is the one you want to read again. The reference extension
// answers it with a small row of badges under each message, and this is that row.
//
// Two things make it possible here. The engine records every agent run against the
// message it read, and /api/agents/beholder-runs returns what each run CHANGED rather
// than everything it holds — a running total under every message would just be the same
// wall of text repeated down the page.
//
// About writing into the host's message list: this package does not own that DOM, and
// there is no per-message contribution slot in the host's contract, so these badges are
// appended to it from outside. That is only acceptable under strict rules, which the
// code below keeps:
//
//   - Append only. No host node is modified, moved or removed, so the host's own
//     reconciliation can never be handed a node that is not where it left it.
//   - Idempotent. Re-running is always safe; each pass replaces its own row and touches
//     nothing else.
//   - Self-healing. A re-render that drops the row puts it back on the next tick rather
//     than leaving a message permanently unlabelled.
//
// Measured before it was written: an appended node survives a chat switch, a scroll
// through the list and composer input, with no errors from the host.

BH.badges = {
  observer: null,
  timer: null,

  /** The newest run per message: a re-run supersedes what the earlier one reported. */
  async load(chatId) {
    if (!chatId) return new Map();
    try {
      const res = await fetch(`/api/agents/beholder-runs/${encodeURIComponent(chatId)}?limit=30`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      // Distinguished from "no runs": a transient failure must not be read as confirmed
      // absence, or a blip wipes every badge on screen.
      if (!res.ok) return null;
      const runs = await res.json();
      const byMessage = new Map();
      // Newest first, so the first one seen for a message is the one that counts.
      for (const run of Array.isArray(runs) ? runs : []) {
        if (!run?.messageId || byMessage.has(run.messageId)) continue;
        byMessage.set(run.messageId, run);
      }
      return byMessage;
    } catch {
      return null;
    }
  },

  /**
   * What kind of change a slot holds now, for the badge's colour.
   *
   * Read from the state on screen rather than from the run, because the run carries
   * which slots changed and not what they became. A slot that is now empty was cleared;
   * anything else is named by what is in it.
   */
  kindFor(character, slot) {
    const value = BH.dock.state?.[character]?.body?.[slot];
    if (!value || typeof value !== "object") return "clear";
    if ((value.wounds ?? []).length) return "wound";
    if (value.holding) return "hold";
    if ((value.worn ?? []).length) return "add";
    if (value.bare || value.missing) return "mod";
    return "clear";
  },

  row(run) {
    const row = document.createElement("div");
    row.className = "beholder-msg-badges";
    // `changes: null` means there was no earlier run to compare against. The first
    // extraction in a chat did not change a body, it established one, and badging every
    // slot on that message would bury it.
    const changes = run.changes;
    if (!changes) return null;
    if (!changes.length) {
      // Said out loud rather than left blank: silence looks like Beholder never ran,
      // which is the one thing this row exists to rule out.
      row.classList.add("beholder-msg-noop");
      row.textContent = "no change";
      return row;
    }
    for (const change of changes) {
      for (const slot of change.slots ?? []) {
        const badge = document.createElement("span");
        badge.className = `bh-msg-badge bh-msg-${this.kindFor(change.name, slot)}`;
        const who = document.createElement("span");
        who.className = "bh-msg-char";
        who.textContent = change.name;
        const what = document.createElement("span");
        what.className = "bh-msg-text";
        what.textContent = BH_SLOT_LABELS[slot] || slot.replace(/_/g, " ");
        badge.append(who, what);
        row.appendChild(badge);
      }
    }
    return row;
  },

  /** Put a row under every message that has a run, and leave everything else alone. */
  async refresh(chatId = BH.dock.chatId) {
    const byMessage = await this.load(chatId);
    // null means the read failed; leave whatever is on screen alone rather than treating
    // a blip as proof this chat has nothing.
    if (!byMessage) return 0;
    if (!byMessage.size) {
      // Cleared, not merely skipped. Host message nodes survive a chat switch, so
      // returning early left the previous chat's badges sitting under this chat's
      // messages, describing changes that happened somewhere else entirely.
      for (const row of document.querySelectorAll(".beholder-msg-badges")) row.remove();
      return 0;
    }
    let placed = 0;
    for (const message of document.querySelectorAll("[data-message-id]")) {
      const run = byMessage.get(message.dataset.messageId);
      if (!run) continue;
      const row = this.row(run);
      if (!row) continue;
      // Ours to replace; nothing else in the message is touched.
      message.querySelector(":scope .beholder-msg-badges")?.remove();
      (message.querySelector(".mari-message-body") ?? message).appendChild(row);
      placed += 1;
    }
    return placed;
  },

  /**
   * Keep the rows in place as the host re-renders.
   *
   * Debounced, and it never reacts to its own writes — appending a row is itself a
   * mutation, so an observer that did not filter them out would call itself forever.
   */
  watch() {
    if (this.observer) return;
    const list = document.querySelector(".mari-messages-scroll") ?? document.body;
    this.observer = new MutationObserver((records) => {
      const ours = records.every((record) =>
        [...record.addedNodes, ...record.removedNodes].every(
          (node) => node.nodeType === 1 && node.classList?.contains("beholder-msg-badges"),
        ),
      );
      if (ours) return;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.refresh(), 400);
    });
    this.observer.observe(list, { childList: true, subtree: true });
  },

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    window.clearTimeout(this.timer);
    for (const row of document.querySelectorAll(".beholder-msg-badges")) row.remove();
  },
};

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
  width:var(--bh-window-width,min(500px,calc(100% - 2rem))) !important; height:var(--bh-window-height,min(1040px,calc(100% - 2rem))) !important;
  min-width:0 !important; min-height:0 !important; max-width:none !important; max-height:none !important;
  border-color:var(--bh-window-accent) !important; border-radius:.75rem !important; transform:none !important; z-index:50; }
.beholder-panel.bh-detached{ position:fixed !important; inset:0 !important; width:100vw !important; height:100dvh !important; border-radius:0 !important; }
.beholder-panel.bh-collapsed{ display:none !important; }
.beholder-panel-body{ min-height:0; overflow:hidden; }
.beholder-panel.bh-content-scrolls .beholder-panel-body{ overflow-y:auto; }
.beholder-panel .beholder-close{ display:none !important; }
.beholder-panel .beholder-resize-handle{ display:block !important; left:auto; right:.25rem; bottom:.25rem; transform:none;
  width:1.5rem; height:1.5rem; border:0; border-radius:.25rem; background:transparent; color:var(--bh-window-accent);
  cursor:nwse-resize; opacity:.65; touch-action:none; }
.beholder-panel .beholder-resize-handle::after{ content:""; position:absolute; right:.25rem; bottom:.25rem; width:.625rem; height:.625rem;
  border-right:2px solid currentColor; border-bottom:2px solid currentColor; }
.beholder-panel .beholder-resize-handle:hover{ width:1.5rem; background:var(--bh-surface-2); color:var(--bh-window-accent); opacity:1; }
.beholder-panel-header{ touch-action:none; }
.beholder-panel-controls{ flex-wrap:nowrap; }
.beholder-panel-controls .bh-dock-close{ box-sizing:border-box; display:inline-flex; width:1.75rem; height:1.75rem; align-items:center; justify-content:center; border:0; border-radius:.375rem;
  padding:0; font-size:.875rem;
  background:transparent; color:var(--bh-window-accent); cursor:pointer; opacity:.8; }
.beholder-panel-controls .bh-dock-close:hover{ background:var(--bh-surface-2); color:var(--bh-window-accent); opacity:1; }
.beholder-panel-controls .bh-dock-close:focus-visible{ outline:2px solid var(--bh-window-accent); outline-offset:1px; }
.beholder-panel.bh-detached .beholder-resize-handle{ display:none !important; }
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
// How tall a panel OPENS. The body holds about 844px of doll plus 178px of chrome, so
// anything much under a thousand guarantees the shrink-to-fit path on first open — the
// old 620 opened every panel at roughly half size. Clamped to the chat area, so a short
// screen still gets a panel that fits; it just falls back to scrolling.
const BH_WINDOW_DEFAULT_HEIGHT = 1040;
// What counts as 100%, which is a separate question from how tall the panel opens. One
// constant answered both, so opening the panel taller would have redefined full size and
// scaled everything back down again.
const BH_SCALE_REFERENCE_WIDTH = 500;
const BH_SCALE_REFERENCE_HEIGHT = 620;
const BH_WINDOW_MIN_SCALE = 0.24;
// The floor for shrinking-to-fit, which is a different question from how small the
// WINDOW may get. Fitting the whole body into a short panel drove the interface to 52%
// at the default size — slot labels rendered at 6.4px against a designed 12.2px, which
// is not a smaller interface but an unreadable one. Below this the body scrolls instead,
// because a scrollbar costs less than text nobody can read.
const BH_CONTENT_MIN_SCALE = 0.85;
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
        <span class="beholder-panel-controls"><span class="beholder-backfill-group" role="group" aria-label="${say("backfillGroup", "Build state from the chat")}"><button type="button" class="beholder-backfill-btn fa-solid fa-clock-rotate-left" title="${say("backfillHint", "Build state from this chat's messages")}" aria-label="${say("backfill", "Build state from history")}"></button><button type="button" class="beholder-backfill-more fa-solid fa-caret-down" title="${say("backfillMoreHint", "More build options")}" aria-label="${say("backfillMore", "More build options")}"></button></span><span class="bh-header-sep" aria-hidden="true"></span><button type="button" class="beholder-tool-btn fa-solid fa-wand-magic-sparkles" data-view="prompt" title="${say("viewPromptHint", "Prompt — which prompt set this model needs")}" aria-label="${say("viewPrompt", "Prompt")}"></button><button type="button" class="beholder-tool-btn fa-solid fa-stethoscope" data-view="doctor" title="${say("viewDoctorHint", "Doctor — the last extraction, end to end")}" aria-label="${say("viewDoctor", "Doctor")}"></button><button type="button" class="beholder-tool-btn fa-solid fa-users" data-view="characters" title="${say("viewCharactersHint", "Characters — hide, reorder, merge duplicates")}" aria-label="${say("viewCharacters", "Characters")}"></button><button type="button" class="beholder-tool-btn fa-solid fa-magnifying-glass" data-view="inspector" title="${say("viewInspectorHint", "Inspector — the full round trip for a turn")}" aria-label="${say("viewInspector", "Inspector")}"></button><button type="button" class="beholder-tool-btn fa-solid fa-circle-question" data-view="help" title="${say("viewHelpHint", "Help — legend and writing tips")}" aria-label="${say("viewHelp", "Help")}"></button><button type="button" class="beholder-tools-more fa-solid fa-ellipsis-vertical" title="${say("toolsMore", "Beholder tools")}" aria-label="${say("toolsMore", "Beholder tools")}" aria-haspopup="menu"></button><button type="button" class="bh-dock-close fa-solid fa-xmark" title="${say("dockClose", "Close Beholder")}" aria-label="${say("dockClose", "Close Beholder")}"></button></span>
      </div>
      <div class="beholder-backfill-status" hidden></div>
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
    panel.querySelector(".beholder-backfill-btn").addEventListener("click", () => {
      void BH.backfill.run("build");
    });
    panel.querySelector(".beholder-backfill-more").addEventListener("click", (event) => {
      event.stopPropagation();
      BH.backfill.toggleMenu();
    });
    panel.querySelector(".beholder-tools-more").addEventListener("click", (event) => {
      event.stopPropagation();
      this.toggleToolsMenu();
    });
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
        return;
      }
      const tool = target.closest(".beholder-tool-btn[data-view]");
      if (tool) {
        const view = tool.dataset.view;
        this.openView(view);
        return;
      }
      // "Edit slots" opens the sheet: the list layout draws no cards to click, and a
      // slot with nothing in it has no card anywhere, so this is the only way to reach
      // an empty one.
      // From the empty-panel note straight to the full explanation.
      if (target.closest(".bh-scope-more")) {
        BH.views.helpView();
        return;
      }
      if (target.closest(".bh-digest-edit")) {
        BH.sheet.open();
        return;
      }
      // A slot card opens the editor for that slot on the active character.
      const card = target.closest(".bh-slot-card[data-slot]");
      if (card) BH.editor.openFor(card);
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
    // The note box lives beside the chat input, not in the panel, so it comes and goes
    // with the panel rather than sitting there when Beholder is closed.
    BH.notebox.mount();
    // Once per browser, and only with the panel actually on screen, so the note has
    // something to point at.
    BH.onboard.maybeShow();
    // Badges belong to the message list, not the panel, but they come and go with
    // Beholder: they are its output, and leaving them behind when it is closed would
    // be marking up someone's chat with a feature they turned off.
    BH.badges.watch();
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
    BH.notebox.unmount();
    BH.badges.stop();
    // Everything the dock opened outside its own box goes with it. The build menu in
    // particular lived on `document.body`, so its "Re-extract this turn" action could
    // still start an agent run after Beholder had been closed — a closed panel doing
    // work is the last thing anyone would look for.
    BH.backfill.closeMenu?.();
    this.closeToolsMenu?.();
    BH.views.close();
    BH.editor.close();
    BH.sheet.close?.();
    document.querySelector(".beholder-onboard")?.remove();
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
      Math.min(width / BH_SCALE_REFERENCE_WIDTH, height / BH_SCALE_REFERENCE_HEIGHT),
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
    const geometryScale = this.applyScale(rect.width, rect.height);
    let scale = geometryScale;
    for (let pass = 0; pass < 2; pass += 1) {
      const widthRatio = body.clientWidth / Math.max(body.scrollWidth, 1);
      const heightRatio = body.clientHeight / Math.max(body.scrollHeight, 1);
      const fit = Math.min(1, widthRatio, heightRatio);
      if (fit >= 0.995) break;
      // Never below the readability floor, and never above what the geometry allows.
      scale = clampWindowValue(scale * fit, Math.min(geometryScale, BH_CONTENT_MIN_SCALE), BH_WINDOW_MAX_SCALE);
      panel.style.setProperty("--bh-ui-scale", scale.toFixed(3));
    }
    // Whatever still does not fit is scrolled to. The body is overflow:hidden on the
    // desktop, so without this the floor above would clip the doll rather than shrink
    // it — trading unreadable for invisible.
    panel.classList.toggle("bh-content-scrolls", body.scrollHeight - body.clientHeight > 1);
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
    // Before the chat guard: which model answers does not depend on there being a
    // chat, and an empty panel is exactly when someone needs to be told why.
    void BH.banner.refresh();
    // Separate call: the update check reaches the model repository, so it must not be
    // able to delay or fail the strip that says which model is answering right now.
    void BH.banner.refreshUpdate();
    const chatId = this.chatId;
    if (!chatId) return;
    try {
      const next = await BH.fetchState(chatId);
      if (this.chatId !== chatId) return; // chat switched mid-flight
      this.adopt(next);
      // A lock promises the slot keeps its value; the extractor does not read locks,
      // so put back anything it overwrote and show the restored state.
      if (await BH.locks.enforce(next, chatId)) {
        const restored = await BH.fetchState(chatId);
        if (this.chatId === chatId) this.adopt(restored);
      }
    } catch (error) {
      // A read failure leaves the last known doll on screen; the next turn retries.
      console.warn("[beholder] state refresh failed", error);
    }
    // After the state, never before it. A badge is coloured by what the slot holds
    // NOW, so running this first read an empty state and painted every change as a
    // removal — the gloves a message had just added were shown as gloves taken off.
    void BH.badges.refresh(chatId);
  },

  /**
   * The tool row, as a menu.
   *
   * Not a nicety: below the narrow breakpoint the stylesheet hides every
   * `.beholder-tool-btn` and shows this trigger instead. Without it, Prompt, Doctor,
   * Inspector, Characters and Help are simply unreachable on a phone.
   */
  closeToolsMenu() {
    this.panel?.querySelector(".beholder-tools-menu")?.remove();
    this.panel?.querySelector(".beholder-tools-more")?.classList.remove("bh-more-open");
    if (this._toolsDismiss) {
      document.removeEventListener("click", this._toolsDismiss, true);
      document.removeEventListener("keydown", this._toolsKeydown, true);
      this._toolsDismiss = null;
      this._toolsKeydown = null;
    }
  },

  toggleToolsMenu() {
    const panel = this.panel;
    if (!panel) return;
    if (panel.querySelector(".beholder-tools-menu")) {
      this.closeToolsMenu();
      return;
    }
    // Built from the header's own buttons so the two can never drift apart.
    const tools = [...panel.querySelectorAll(".beholder-tool-btn[data-view]")].map((button) => ({
      view: button.dataset.view,
      icon: [...button.classList].find((name) => name.startsWith("fa-") && name !== "fa-solid") ?? "fa-circle",
      label: button.getAttribute("aria-label") || button.dataset.view,
    }));
    const menu = document.createElement("div");
    menu.className = "beholder-tools-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = tools
      .map(
        (tool) =>
          `<button type="button" class="beholder-tools-item" data-view="${BH.escapeHtml(tool.view)}" role="menuitem">
             <i class="fa-solid ${BH.escapeHtml(tool.icon)}"></i><span>${BH.escapeHtml(tool.label)}</span>
           </button>`,
      )
      .join("");
    panel.querySelector(".beholder-tools-more")?.classList.add("bh-more-open");
    panel.querySelector(".beholder-panel-header")?.appendChild(menu);
    menu.addEventListener("mousedown", (event) => event.stopPropagation());
    for (const item of menu.querySelectorAll(".beholder-tools-item")) {
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        const view = item.dataset.view;
        this.closeToolsMenu();
        this.openView(view);
      });
    }
    this._toolsDismiss = (event) => {
      if (event.target?.closest?.(".beholder-tools-menu, .beholder-tools-more")) return;
      this.closeToolsMenu();
    };
    this._toolsKeydown = (event) => {
      if (event.key === "Escape") this.closeToolsMenu();
    };
    setTimeout(() => {
      document.addEventListener("click", this._toolsDismiss, true);
      document.addEventListener("keydown", this._toolsKeydown, true);
    }, 0);
  },

  /** One place that maps a view name to its view, for the header and the menu alike. */
  openView(view) {
    if (view === "prompt") void BH.views.promptView();
    else if (view === "doctor") void BH.views.doctorView();
    else if (view === "characters") BH.views.charactersView();
    else if (view === "inspector") void BH.views.inspectorView();
    else if (view === "help") BH.views.helpView();
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
    // The operator's roster choices are applied here, so every surface that reads the
    // rendered panel agrees on who is on screen: hidden people are dropped and the
    // rest are put in the chosen order. Object key order is insertion order, which is
    // what the renderer walks to build its tabs.
    const arranged = BH.roster.arrange(Object.keys(this.state));
    const shownState = {};
    for (const name of arranged.visible) shownState[name] = this.state[name];
    // Hiding everyone would leave a panel with no way back, so fall through to the
    // full state and let the characters view be the way out.
    const stateForRender = arranged.visible.length ? shownState : this.state;
    if (this.activeName && !stateForRender[this.activeName]) this.activeName = null;
    const rendered = renderDollPanel(stateForRender, this.activeName, unviewedForRender, view);
    this.activeName = rendered.activeName;
    if (this.activeName) this.unviewed.delete(this.activeName);
    body.innerHTML = rendered.html || "";
    // Re-applied every render: the body is rebuilt wholesale, so lock marks would
    // otherwise vanish the first time anything else changes.
    BH.locks.decorate(panel, this.activeName);
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
