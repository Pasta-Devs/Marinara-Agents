export const OFFICIAL_PACKAGE_GUIDANCE = Object.freeze({
  "card-evolution-auditor": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Writer Agents for Roleplay mode.",
  },
  continuity: {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Writer Agents for Roleplay mode.",
  },
  "knowledge-retrieval": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Writer Agents for Roleplay mode.",
  },
  "knowledge-router": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Writer Agents for Roleplay mode.",
  },
  director: {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Writer Agents for Roleplay mode.",
  },
  "prose-guardian": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Writer Agents for Roleplay mode.",
  },
  background: {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay mode.",
  },
  "character-tracker": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay mode.",
  },
  "custom-tracker": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay mode.",
  },
  expression: {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay mode.",
  },
  "hierarchical-maps": {
    modes: ["roleplay", "game"],
    activation: "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay and Game modes.",
  },
  "persona-stats": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay mode.",
  },
  quest: {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay mode.",
  },
  "world-state": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay mode.",
  },
  eightball: {
    modes: ["conversation"],
    activation: "Add as a Command in Chat Settings → Agents → Commands for Conversation mode.",
  },
  chess: {
    modes: ["conversation"],
    activation: "Add as a Command in Chat Settings → Agents → Commands for Conversation mode.",
  },
  combat: {
    modes: ["roleplay"],
    activation: "Add as an Agent in Chat Settings → Agents → Misc Agents for Roleplay mode.",
  },
  "conversation-calls": {
    modes: ["conversation"],
    activation: "Add as both a Command and an Agent in Chat Settings → Agents → Commands/Calls for Conversation mode.",
  },
  cyoa: {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Misc Agents for Roleplay mode.",
  },
  "echo-chamber": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Misc Agents for Roleplay mode.",
  },
  haptic: {
    modes: ["conversation", "roleplay"],
    activation: "Add as both a Command and an Agent in Chat Settings → Agents → Commands/Misc Agents for Conversation and Roleplay modes.",
  },
  illustrator: {
    modes: ["conversation", "roleplay", "game"],
    activation: "Add as both a Command and an Agent in Chat Settings → Agents → Commands/Misc Agents/Illustrator for Conversation, Roleplay, and Game modes.",
  },
  html: {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Misc Agents for Roleplay mode.",
  },
  "lorebook-keeper": {
    modes: ["roleplay", "game"],
    activation: "Add the Agent in Chat Settings → Agents → Misc Agents/Lorebook Keeper for Roleplay and Game modes.",
  },
  spotify: {
    modes: ["conversation", "roleplay", "game"],
    activation: "Enable the music player in Settings → General. Add both as a Command and an Agent in Chat Settings → Agents → Commands/Misc Agents/Music DJ for Conversation, Roleplay, and Game modes.",
  },
  poker: {
    modes: ["conversation"],
    activation: "Add as a Command in Chat Settings → Agents → Commands for Conversation mode.",
  },
  "rock-paper-scissors": {
    modes: ["conversation"],
    activation: "Add as a Command in Chat Settings → Agents → Commands for Conversation mode.",
  },
  "tic-tac-toe": {
    modes: ["conversation"],
    activation: "Add as a Command in Chat Settings → Agents → Commands for Conversation mode.",
  },
  uno: {
    modes: ["conversation"],
    activation: "Add as a Command in Chat Settings → Agents → Commands for Conversation mode.",
  },
});

export function withPackageActivationGuidance(packageId, description) {
  const normalized = String(description || "").trim();
  const activation = OFFICIAL_PACKAGE_GUIDANCE[packageId]?.activation;
  if (!activation || normalized.endsWith(activation)) return normalized;
  return `${normalized} ${activation}`;
}
