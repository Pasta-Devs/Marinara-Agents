import type { PhoneBaselineTheme } from "./identity";

export interface PhoneThemeTokens {
  "--vp-bg": string;
  "--vp-surface": string;
  "--vp-text": string;
  "--vp-muted": string;
  "--vp-accent": string;
  "--vp-bezel": string;
  "--vp-radius": string;
  "--vp-border": string;
}

const themes: Record<PhoneBaselineTheme, PhoneThemeTokens> = {
  system: {
    "--vp-bg": "#f2f2f7",
    "--vp-surface": "#ffffff",
    "--vp-text": "#1c1c1e",
    "--vp-muted": "#6e6e73",
    "--vp-accent": "#007aff",
    "--vp-bezel": "#101216",
    "--vp-radius": "28px",
    "--vp-border": "rgb(28 28 30 / 0.1)",
  },
  light: {
    "--vp-bg": "#f5f1ea",
    "--vp-surface": "#fffdf9",
    "--vp-text": "#241f1a",
    "--vp-muted": "#7a7166",
    "--vp-accent": "#c2542f",
    "--vp-bezel": "#26211c",
    "--vp-radius": "28px",
    "--vp-border": "rgb(36 31 26 / 0.12)",
  },
  dark: {
    "--vp-bg": "#0c0d10",
    "--vp-surface": "#1b1d22",
    "--vp-text": "#f2f3f7",
    "--vp-muted": "#9a9aa2",
    "--vp-accent": "#0a84ff",
    "--vp-bezel": "#040507",
    "--vp-radius": "28px",
    "--vp-border": "rgb(242 243 247 / 0.12)",
  },
};

export function phoneThemeTokens(theme: PhoneBaselineTheme): PhoneThemeTokens {
  return { ...themes[theme] };
}
