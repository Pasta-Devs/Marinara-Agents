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
  beholder: {
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
  "inventory-tracker": {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay mode.",
  },
  "memory-nag": {
    modes: ["roleplay"],
    activation:
      "Add the Agent in Chat Settings → Agents → Tracker Agents for Roleplay mode. Once active, configure it in its standalone Memory Nag section.",
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
    activation:
      "Install to use /8ball manually in any Conversation chat. Add under Chat Settings → Agents → Commands only to let characters initiate it.",
  },
  chess: {
    modes: ["conversation"],
    activation:
      "Install to use /chess manually in any Conversation chat. Add under Chat Settings → Agents → Commands only to let characters initiate it.",
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
    modes: ["conversation", "roleplay", "game"],
    activation:
      "Add as both a Command and an Agent in Chat Settings → Agents → Commands/Misc Agents for Conversation, Roleplay, and Game modes.",
  },
  illustrator: {
    modes: ["conversation", "roleplay", "game"],
    activation:
      "Add as both a Command and an Agent in Chat Settings → Agents → Commands/Misc Agents/Illustrator for Conversation, Roleplay, and Game modes.",
  },
  storyboard: {
    modes: ["roleplay", "game"],
    activation: "Add the Agent in Chat Settings → Agents → Misc Agents/Storyboard for Roleplay and Game modes.",
  },
  html: {
    modes: ["roleplay"],
    activation: "Add the Agent in Chat Settings → Agents → Misc Agents for Roleplay mode.",
  },
  "lorebook-keeper": {
    modes: ["roleplay", "game"],
    activation: "Add the Agent in Chat Settings → Agents → Misc Agents/Lorebook Keeper for Roleplay and Game modes.",
  },
  "long-term-memory": {
    modes: ["conversation", "roleplay", "game"],
    activation:
      "Enable it per chat from Chat Settings → Agents → Long-Term Memory. In Roleplay and Game, you can also add it from Chat Settings → Agents → Misc Agents.",
  },
  noodle: {
    modes: ["conversation", "roleplay", "game"],
    activation: "Install it, restart Marinara Engine when prompted, then open Home → Noodle.",
  },
  slurp: {
    modes: ["conversation", "roleplay", "game"],
    activation: "Install it, restart Marinara Engine when prompted, then open Home → Slurp.",
  },
  "gacha-forge": {
    modes: ["conversation", "roleplay", "game"],
    activation: "Install it, restart Marinara Engine when prompted, then open Home → Gacha Forge.",
  },
  pixelforge: {
    modes: ["game"],
    activation: "Install it, then choose Pixelforge as the Experience when creating a Game Mode chat.",
  },
  spotify: {
    modes: ["conversation", "roleplay", "game"],
    activation:
      "Enable the music player in Settings → General. Add both as a Command and an Agent in Chat Settings → Agents → Commands/Misc Agents/Music DJ for Conversation, Roleplay, and Game modes.",
  },
  poker: {
    modes: ["conversation"],
    activation:
      "Install to use /poker manually in any Conversation chat. Add under Chat Settings → Agents → Commands only to let characters initiate it.",
  },
  "rock-paper-scissors": {
    modes: ["conversation"],
    activation:
      "Install to use /rps manually in any Conversation chat. Add under Chat Settings → Agents → Commands only to let characters initiate it.",
  },
  "tic-tac-toe": {
    modes: ["conversation"],
    activation:
      "Install to use /tictactoe manually in any Conversation chat. Add under Chat Settings → Agents → Commands only to let characters initiate it.",
  },
  uno: {
    modes: ["conversation"],
    activation:
      "Install to use /uno manually in any Conversation chat. Add under Chat Settings → Agents → Commands only to let characters initiate it.",
  },
});

export function withPackageActivationGuidance(packageId, description) {
  const normalized = String(description || "").trim();
  const activation = OFFICIAL_PACKAGE_GUIDANCE[packageId]?.activation;
  if (!activation || normalized.endsWith(activation)) return normalized;
  return `${normalized} ${activation}`;
}

export function withoutPackageActivationGuidance(packageId, description) {
  const normalized = String(description || "").trim();
  const activation = OFFICIAL_PACKAGE_GUIDANCE[packageId]?.activation;
  if (!activation || !normalized.endsWith(activation)) return normalized;
  return normalized.slice(0, -activation.length).trim();
}
