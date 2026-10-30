// ──────────────────────────────────────────────
// Otome Forge: colour tokens for the two looks (Midnight, Pearl) and the rarity colours
// ──────────────────────────────────────────────
// The design's palette. styles.ts turns each look into `--of-*` custom properties under `.of-root[data-look=...]`, so
// every screen reads the same names and a look change is one attribute.

export const PALETTE = {
  midnight: "#15122B",
  pearl: "#F7F1EC",
  rose: "#E7A6B8",
  champagne: "#E6C98A",
  ink: "#2B2236",
} as const;

/** Item rarity: 3★ silver, 4★ violet, 5★ gold. */
export const RARITY = {
  silver: "#C9CFDA",
  violet: "#B79CF2",
  gold: "#E6C98A",
} as const;

export type Look = "midnight" | "pearl";

/** One look's custom properties, without the `--of-` prefix. */
export type LookTokens = Readonly<Record<string, string>>;

export const LOOK_TOKENS: Readonly<Record<Look, LookTokens>> = {
  midnight: {
    // The scene behind every screen; a screen with a place or CG overrides `--of-bg` on the stage.
    bg: [
      "radial-gradient(120% 65% at 12% -4%, rgb(231 166 184 / 0.34), transparent 62%)",
      "radial-gradient(85% 55% at 104% 38%, rgb(128 96 220 / 0.32), transparent 66%)",
      "radial-gradient(110% 60% at 40% 112%, rgb(230 201 138 / 0.22), transparent 62%)",
      `linear-gradient(180deg, #221c45 0%, ${PALETTE.midnight} 52%, #0f0c22 100%)`,
    ].join(", "),
    "backdrop-base": "#0b0918",
    "backdrop-veil": "rgb(10 8 24 / 0.3)",
    "backdrop-dim": "0.85",
    text: PALETTE.pearl,
    "text-soft": "rgb(247 241 236 / 0.74)",
    // Text tokens keep 4.5:1 (WCAG AA) where the night is brightest, under the rose glow at the top of the stage,
    // bare or on glass (tests/otome-forge-contrast.regression.ts): faint 0.71, not 0.5; rose, violet, danger paler.
    "text-faint": "rgb(247 241 236 / 0.71)",
    // Paler than the palette's rose, so it also holds on the rose tint of badges and chips.
    "accent-text": "#F0C6D2",
    "champagne-text": PALETTE.champagne,
    // Rarity as text and small marks (stars, pity rings): the rarity colours themselves on the night, violet paler.
    "rarity-silver-ink": RARITY.silver,
    "rarity-violet-ink": "#CCB9F6",
    "rarity-gold-ink": RARITY.gold,
    "on-accent": PALETTE.ink,
    surface: "rgb(40 33 74 / 0.5)",
    "surface-strong": "rgb(46 38 84 / 0.74)",
    "surface-solid": "rgb(33 27 62 / 0.96)",
    "surface-hover": "rgb(255 255 255 / 0.08)",
    border: "rgb(255 236 244 / 0.14)",
    "border-strong": "rgb(255 236 244 / 0.3)",
    highlight: "rgb(255 255 255 / 0.12)",
    "panel-shadow": "0 14px 36px rgb(4 2 18 / 0.38)",
    "stage-shadow": "0 30px 80px rgb(3 1 14 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.04)",
    "stage-ring": "rgb(230 201 138 / 0.22)",
    glow: "rgb(231 166 184 / 0.42)",
    "glow-soft": "rgb(231 166 184 / 0.18)",
    star: "rgb(255 246 230 / 0.95)",
    "star-opacity": "0.75",
    vignette: "rgb(6 4 18 / 0.55)",
    floor: "rgb(12 9 28 / 0.72)",
    "title-ink": `linear-gradient(100deg, ${PALETTE.champagne} 0%, #fbeee3 46%, ${PALETTE.rose} 100%)`,
    focus: PALETTE.champagne,
    "wish-ring": "rgb(255 244 228 / 0.85)",
    "wish-shadow": "rgb(6 3 20 / 0.55)",
    "wish-glow": "rgb(230 201 138 / 0.55)",
    "input-bg": "rgb(18 14 40 / 0.55)",
    "input-bg-focus": "rgb(26 20 56 / 0.78)",
    "option-bg": "#221c45",
    scrim: "rgb(8 6 22 / 0.6)",
    tint: "rgb(231 166 184 / 0.14)",
    "tint-strong": "rgb(231 166 184 / 0.24)",
    danger: "#F5AEC0",
  },
  pearl: {
    bg: [
      "radial-gradient(115% 60% at 10% -6%, rgb(231 166 184 / 0.5), transparent 62%)",
      "radial-gradient(80% 50% at 108% 34%, rgb(230 201 138 / 0.42), transparent 66%)",
      "radial-gradient(120% 60% at 30% 114%, rgb(190 170 240 / 0.42), transparent 64%)",
      `linear-gradient(180deg, #fdf8f4 0%, ${PALETTE.pearl} 50%, #f3e6ec 100%)`,
    ].join(", "),
    "backdrop-base": "#e9dde2",
    "backdrop-veil": "rgb(247 241 236 / 0.38)",
    "backdrop-dim": "0.94",
    text: PALETTE.ink,
    "text-soft": "rgb(43 34 54 / 0.74)",
    // 0.68, not 0.5: counters and placeholders stay at 4.5:1 or more on Pearl's glass.
    "text-faint": "rgb(43 34 54 / 0.68)",
    // A step darker, for 4.5:1 where Pearl's stage is darkest, under its glows (otome-forge-contrast.regression.ts).
    "accent-text": "#944763",
    "champagne-text": "#7C5A1D",
    // Darker on Pearl's glass, 4.5:1 or more like the text around them.
    "rarity-silver-ink": "#566070",
    "rarity-violet-ink": "#6447B0",
    "rarity-gold-ink": "#7A5A1C",
    "on-accent": PALETTE.ink,
    surface: "rgb(255 255 255 / 0.5)",
    "surface-strong": "rgb(255 255 255 / 0.74)",
    "surface-solid": "rgb(255 252 249 / 0.97)",
    "surface-hover": "rgb(255 255 255 / 0.55)",
    border: "rgb(160 77 107 / 0.16)",
    "border-strong": "rgb(160 77 107 / 0.36)",
    highlight: "rgb(255 255 255 / 0.85)",
    "panel-shadow": "0 12px 30px rgb(120 70 100 / 0.14)",
    "stage-shadow": "0 30px 70px rgb(90 50 80 / 0.28), 0 0 0 1px rgb(255 255 255 / 0.6)",
    "stage-ring": "rgb(255 255 255 / 0.8)",
    glow: "rgb(231 166 184 / 0.55)",
    "glow-soft": "rgb(231 166 184 / 0.28)",
    star: "rgb(255 255 255 / 0.95)",
    "star-opacity": "0.9",
    vignette: "rgb(214 170 190 / 0.32)",
    floor: "rgb(247 236 240 / 0.7)",
    "title-ink": `linear-gradient(100deg, #7d3c5b 0%, ${PALETTE.ink} 48%, #a04d6b 100%)`,
    focus: "#8E3F5E",
    "wish-ring": "rgb(255 255 255 / 0.95)",
    "wish-shadow": "rgb(140 80 110 / 0.32)",
    "wish-glow": "rgb(230 201 138 / 0.6)",
    "input-bg": "rgb(255 255 255 / 0.72)",
    "input-bg-focus": "rgb(255 255 255 / 0.92)",
    "option-bg": "#fffaf6",
    scrim: "rgb(60 32 54 / 0.38)",
    tint: "rgb(231 166 184 / 0.18)",
    "tint-strong": "rgb(231 166 184 / 0.3)",
    danger: "#A83759",
  },
};
