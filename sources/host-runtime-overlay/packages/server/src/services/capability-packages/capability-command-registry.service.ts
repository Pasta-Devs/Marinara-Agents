// Host overlay for services/capability-packages/capability-command-registry.service.ts
// (Pasta-Devs/Marinara-Agents#1487). The vendored registry was a second, always-empty copy: commands other
// packages register with the Engine (games, [call]) were never recognised in package code. These read the
// Engine's registry (api.runtime.commands). An Engine without it has no commands to offer, which is what
// the empty copy answered too.
import { hostRuntime } from "../../lib/host-runtime.js";

export interface CapabilityConversationCommandRegistration {
  commandType: string;
  tags: string[];
}

export function parseCapabilityConversationCommands(
  content: string,
): Array<{ type: "capability"; commandType: string; payload?: string | null }> {
  return hostRuntime().commands?.parse(content) ?? [];
}

export function stripCapabilityConversationCommands(content: string): string {
  return hostRuntime().commands?.strip(content) ?? content;
}
