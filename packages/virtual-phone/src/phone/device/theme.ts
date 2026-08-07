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
  // "system" follows the device default, which is dark.
  system: {
    "--vp-bg": "#000000",
    "--vp-surface": "#1c1c1e",
    "--vp-text": "#f2f3f7",
    "--vp-muted": "#98989f",
    "--vp-accent": "#0a84ff",
    "--vp-bezel": "#040507",
    "--vp-radius": "28px",
    "--vp-border": "rgb(255 255 255 / 0.15)",
  },
  light: {
    "--vp-bg": "#f2f2f7",
    "--vp-surface": "#ffffff",
    "--vp-text": "#1c1c1e",
    "--vp-muted": "#6e6e73",
    "--vp-accent": "#007aff",
    "--vp-bezel": "#101216",
    "--vp-radius": "28px",
    "--vp-border": "rgb(28 28 30 / 0.1)",
  },
  dark: {
    "--vp-bg": "#000000",
    "--vp-surface": "#1c1c1e",
    "--vp-text": "#f2f3f7",
    "--vp-muted": "#98989f",
    "--vp-accent": "#0a84ff",
    "--vp-bezel": "#040507",
    "--vp-radius": "28px",
    "--vp-border": "rgb(255 255 255 / 0.15)",
  },
};

export function phoneThemeTokens(theme: PhoneBaselineTheme): PhoneThemeTokens {
  return { ...themes[theme] };
}
