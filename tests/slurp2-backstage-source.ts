import { join } from "node:path";

import { slurp2Source } from "./slurp2-source";

/** Backstage settings used to be one file; static checks read the shell and its pages as one source. */
export const SLURP2_BACKSTAGE_FILES = [
  "SlurpSettings.tsx",
  "SlurpBackstageOverview.tsx",
  "SlurpBackstageCreators.tsx",
  "SlurpBackstageWorld.tsx",
  "SlurpBackstageAutomation.tsx",
  "SlurpBackstagePrompts.tsx",
  "SlurpBackstageMaintenance.tsx",
  "SlurpBackstageWorkflow.tsx",
];

export function slurp2BackstageSource(): string {
  const dir = join(import.meta.dirname, "../packages/slurp2/src/engine/packages/client/src/components/slurp");
  return SLURP2_BACKSTAGE_FILES.map((file) => slurp2Source(join(dir, file))).join("\n");
}
