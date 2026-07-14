export interface CapabilityConversationCommandRegistration {
  commandType: string;
  tags: string[];
}

const tagToCommandType = new Map<string, string>();

export function registerCapabilityConversationCommand(
  registration: CapabilityConversationCommandRegistration,
): () => void {
  const commandType = registration.commandType.trim();
  if (!/^[a-z][a-z0-9_-]*$/.test(commandType)) throw new Error("Capability command type is invalid");
  const tags = registration.tags.map((tag) => tag.trim().toLocaleLowerCase());
  if (tags.length === 0 || tags.some((tag) => !/^[a-z][a-z0-9_-]*$/.test(tag))) {
    throw new Error("Capability command tag is invalid");
  }
  for (const tag of tags) {
    if (tagToCommandType.has(tag)) throw new Error(`Conversation command tag ${tag} is already registered`);
    tagToCommandType.set(tag, commandType);
  }
  return () => {
    for (const tag of tags) {
      if (tagToCommandType.get(tag) === commandType) tagToCommandType.delete(tag);
    }
  };
}

export function parseCapabilityConversationCommands(content: string) {
  const commands: Array<{ type: "capability"; commandType: string }> = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/\[([a-z][a-z0-9_-]*)(?::[^\]\r\n]*)?\]/gi)) {
    const commandType = tagToCommandType.get(match[1]!.toLocaleLowerCase());
    if (!commandType || seen.has(commandType)) continue;
    seen.add(commandType);
    commands.push({ type: "capability", commandType });
  }
  return commands;
}

export function stripCapabilityConversationCommands(content: string) {
  return content.replace(/\[([a-z][a-z0-9_-]*)(?::[^\]\r\n]*)?\]/gi, (match, tag: string) =>
    tagToCommandType.has(tag.toLocaleLowerCase()) ? "" : match,
  );
}
