// Host overlay for services/sidecar/sidecar-model.service.ts (Pasta-Devs/Marinara-Agents#1487). The vendored
// service read and rewrote sidecar-config.json on every start and kept its own copy of the Local Model
// settings. The Engine's Local Model provider applies the configured context size and parallel jobs
// itself, so the connection a package builds for it carries no limits of its own, the same as the
// Engine's api.runtime.languageModels does for the Local Model.
//
// ponytail: only getConfig() for the synthesized Local Model connection; the host runtime exposes no
// Local Model settings. Upgrade path: read them from a host member once the Engine offers one.
export const sidecarModelService = Object.freeze({
  getConfig(): { contextSize: number; maxParallelJobs: number } {
    return { contextSize: undefined as unknown as number, maxParallelJobs: 1 };
  },
});
