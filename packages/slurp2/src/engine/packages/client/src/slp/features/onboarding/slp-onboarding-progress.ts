// One progress model for the first-run wizard (design language, step 8): "Step 2 of 5" plus a short
// label that fits 390 px. The setup counts the steps of the lane the player picked.
import type { SetupLane, Step } from "./SlpOnboardingPanel";

export const SLP_SETUP_STEPS: Record<Exclude<SetupLane, null>, readonly { step: Step; label: string }[]> = {
  // The role-play sign-up counts its own moments (SlpSceneOnboarding), not wizard steps.
  scene: [],
  easy: [
    { step: 1, label: "who" },
    { step: 4, label: "review" },
  ],
  customize: [
    { step: 1, label: "who" },
    { step: 2, label: "identity" },
    { step: 3, label: "posting" },
    { step: 4, label: "pictures" },
  ],
};

export interface SlpOnboardingProgress {
  current: number;
  total: number;
  label: string;
}

/** Where the player is, or null on screens outside the count (the result). */
export function slpOnboardingProgress(state: { setupLane: SetupLane; step: Step }): SlpOnboardingProgress | null {
  if (state.setupLane === null) return null;
  const steps = SLP_SETUP_STEPS[state.setupLane];
  const index = steps.findIndex((entry) => entry.step === state.step);
  if (index === -1) return null;
  return { current: index + 1, total: steps.length, label: steps[index].label };
}
