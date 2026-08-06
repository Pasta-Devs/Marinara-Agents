import type { PhoneBaselineTheme } from "./identity";

export interface PhoneThemeTokens {
  "--vp-bg": string;
  "--vp-surface": string;
  "--vp-text": string;
  "--vp-muted": string;
  "--vp-accent": string;
  "--vp-bezel": string;
  "--vp-radius": string;
}

const themes: Record<PhoneBaselineTheme, PhoneThemeTokens> = {
  system: {
    "--vp-bg": "#edf2f1",
    "--vp-surface": "#ffffff",
    "--vp-text": "#192321",
    "--vp-muted": "#5c6d69",
    "--vp-accent": "#2c8979",
    "--vp-bezel": "#11151d",
    "--vp-radius": "28px",
  },
  light: {
    "--vp-bg": "#f4f0e8",
    "--vp-surface": "#fffdf8",
    "--vp-text": "#25211b",
    "--vp-muted": "#766d60",
    "--vp-accent": "#a34d36",
    "--vp-bezel": "#29231e",
    "--vp-radius": "28px",
  },
  dark: {
    "--vp-bg": "#10151a",
    "--vp-surface": "#182128",
    "--vp-text": "#edf5f2",
    "--vp-muted": "#9aacaa",
    "--vp-accent": "#69c8b3",
    "--vp-bezel": "#050709",
    "--vp-radius": "28px",
  },
};

export function phoneThemeTokens(theme: PhoneBaselineTheme): PhoneThemeTokens {
  return { ...themes[theme] };
}
