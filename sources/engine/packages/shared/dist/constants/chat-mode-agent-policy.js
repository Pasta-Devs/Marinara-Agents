// ──────────────────────────────────────────────
// Chat Mode Agent Policy
// ──────────────────────────────────────────────
// Shared rules for which built-in agents can run in each chat mode.
import { BUILT_IN_AGENTS, isRetiredBuiltInAgentId } from "../types/agent.js";
const CHAT_MODE_AGENT_POLICIES = {
    // Conversation mode's About Me profile and update_about_me tool are core
    // features, not downloadable agents. User-authored custom agents remain allowed.
    conversation: { kind: "allowlist", allowedAgentIds: [] },
    roleplay: { kind: "all" },
    // Music DJ is opt-in through the game music toggle, not enabled by default.
    game: { kind: "allowlist", allowedAgentIds: ["spotify"] },
};
export function isAgentManifestAvailableInChatMode(mode, agent) {
    if (isRetiredBuiltInAgentId(agent.id))
        return false;
    const policyMode = mode ?? "roleplay";
    if (agent.modeAllowlist?.length && !agent.modeAllowlist.includes(policyMode))
        return false;
    if (agent.execution === "feature" || agent.execution === "host")
        return true;
    const policy = CHAT_MODE_AGENT_POLICIES[policyMode] ?? CHAT_MODE_AGENT_POLICIES.roleplay;
    return policy.kind === "all" || policy.allowedAgentIds.includes(agent.id);
}
export function isAgentAvailableInChatMode(mode, agentId) {
    if (isRetiredBuiltInAgentId(agentId))
        return false;
    const builtIn = BUILT_IN_AGENTS.find((agent) => agent.id === agentId);
    return builtIn ? isAgentManifestAvailableInChatMode(mode, builtIn) : true;
}
//# sourceMappingURL=chat-mode-agent-policy.js.map