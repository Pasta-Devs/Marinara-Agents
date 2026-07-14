import { BUILT_IN_AGENT_MANIFESTS as GENERATED_AGENT_MANIFESTS } from "./agent-registry.generated.js";
/** Compatibility source used only by the one-time upgrade migration. */
export const BUNDLED_AGENT_MANIFESTS = GENERATED_AGENT_MANIFESTS;
/** Active runtime registry. Fresh installs populate it only from downloaded packages. */
export const BUILT_IN_AGENT_MANIFESTS = [];
export function replaceBuiltInAgentManifestRegistry(manifests) {
    BUILT_IN_AGENT_MANIFESTS.splice(0, BUILT_IN_AGENT_MANIFESTS.length, ...manifests);
}
export function getBuiltInAgentManifest(agentId) {
    return BUILT_IN_AGENT_MANIFESTS.find((agent) => agent.id === agentId) ?? null;
}
export function getBuiltInAgentDefaultPrompt(agentId) {
    return getBuiltInAgentManifest(agentId)?.defaultPromptTemplate ?? "";
}
export function isBuiltInAgentHiddenFromLibrary(agentId) {
    return getBuiltInAgentManifest(agentId)?.libraryHidden === true;
}
export function isBuiltInAgentRuntimeDisabled(agentId) {
    return getBuiltInAgentManifest(agentId)?.runtimeDisabled === true;
}
//# sourceMappingURL=agent-registry.js.map