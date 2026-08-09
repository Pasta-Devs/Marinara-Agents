import type { ChatMode } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import type { CharacterCommand } from "../conversation/character-commands.js";
import { getCapabilityService } from "../capability-packages/capability-service-registry.service.js";

type ChatsStore = {
  getById(id: string): Promise<{ metadata?: unknown } | null>;
  createMessagesBatch(chatId: string, messages: Array<Record<string, unknown>>): Promise<unknown>;
};

export interface ConversationCallCommandArgs {
  command: CharacterCommand;
  characterId: string | null;
  chatId: string;
  chatMode: ChatMode;
  messageId?: string | null;
  db: DB;
  chats: ChatsStore;
  sendRingingEvent: (data: Record<string, unknown>) => void;
}

interface ConversationCallCommandService {
  handleConversationCallCommand(args: ConversationCallCommandArgs): Promise<boolean>;
}

/** Host integration point; the behavior itself is supplied by Conversation Calls. */
export async function handleConversationCallCommand(args: ConversationCallCommandArgs): Promise<boolean> {
  if (args.command.type !== "call") return false;
  const provider = getCapabilityService<ConversationCallCommandService>("conversation-calls:command");
  return provider ? provider.handleConversationCallCommand(args) : true;
}
