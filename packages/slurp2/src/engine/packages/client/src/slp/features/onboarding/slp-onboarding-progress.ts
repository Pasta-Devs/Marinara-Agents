// One progress model for the Creator step of the wizard (design language, step 8): "Step 2 of 2" plus a
// short label that fits 390 px. The setup counts the steps of the lane the player picked, and the lane
// cards say that count before the choice. The Basic screen counts its own questions (SlpBasicSetup).
import type { SetupLane, Step } from "./SlpOnboardingPanel";

export const SLP_SETUP_STEPS: Record<Exclude<SetupLane, null>, readonly { step: Step; label: string }[]> = {
  // The role-play sign-up counts its own moments (SlpSceneOnboarding), not wizard steps.
  scene: [],
  easy: [
    { step: 1, label: "who" },
    { step: 4, label: "review" },
  ],
};

export interface SlpOnboardingProgress {
  current: number;
  total: number;
  label: string;
}

/** Where the player is, or null on screens outside the count (lane choice, the result). */
export function slpOnboardingProgress(state: { setupLane: SetupLane; step: Step }): SlpOnboardingProgress | null {
  if (state.setupLane === null) return null;
  const steps = SLP_SETUP_STEPS[state.setupLane];
  const index = steps.findIndex((entry) => entry.step === state.step);
  if (index === -1) return null;
  return { current: index + 1, total: steps.length, label: steps[index].label };
}
