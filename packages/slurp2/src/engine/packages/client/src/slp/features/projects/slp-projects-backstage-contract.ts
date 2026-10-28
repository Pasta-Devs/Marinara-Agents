import { useCreateSlurpProject } from "./slp-projects-hooks";

export function useSlpProjectsBackstageState() {
  return { createPlan: useCreateSlurpProject() };
}

export type SlpProjectsBackstageState = ReturnType<typeof useSlpProjectsBackstageState>;
