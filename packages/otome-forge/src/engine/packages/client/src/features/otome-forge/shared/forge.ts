// ──────────────────────────────────────────────
// Otome Forge: what each forge step waits for, shared by the server's forge job and the client's polling
// ──────────────────────────────────────────────
import type { ForgeStatus } from "./api-types";

/**
 * The step a forge step waits for: every bible and the protagonist's paint wait for the world plan, a love interest's
 * paint for his bible; the world plan waits for nothing (null).
 */
export function forgePrerequisite(stepId: string): string | null {
  if (stepId.startsWith("bible:") || stepId === "paint:player") return "world-plan";
  return stepId.startsWith("paint:") ? `bible:${stepId.slice("paint:".length)}` : null;
}

/**
 * True while some step can still move without the player, so the view keeps polling: one is running, or pending with
 * no failed step before it. A step held back by a failure waits for that step's Retry, whose answer patches the view
 * (and polling starts again).
 */
export function forgeIsWorking(forge: ForgeStatus): boolean {
  const states = new Map(forge.steps.map((step) => [step.id, step.state]));
  const blocked = (id: string) => {
    for (let before = forgePrerequisite(id); before; before = forgePrerequisite(before)) {
      if (states.get(before) === "failed") return true;
    }
    return false;
  };
  return forge.steps.some((step) => step.state === "running" || (step.state === "pending" && !blocked(step.id)));
}
