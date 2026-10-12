import type { ChatMode, ConversationCallSession } from "@marinara-engine/shared";

/** What the Engine passes when a character's Conversation reply contains `[call]`. */
export interface CallCommandArgs {
  command: { type: string; reason?: string; greeting?: string };
  characterId: string | null;
  chatId: string;
  chatMode: ChatMode;
  messageId?: string | null;
  chats: {
    getById(id: string): Promise<{ metadata?: unknown } | null>;
    createMessagesBatch(chatId: string, messages: Array<Record<string, unknown>>): Promise<unknown>;
  };
  sendRingingEvent: (data: Record<string, unknown>) => void;
}

export interface CallCommandHost {
  calls: {
    getActiveForChat(chatId: string): Promise<ConversationCallSession | null>;
    getRingingForChat(chatId: string): Promise<ConversationCallSession | null>;
    createSession(input: {
      chatId: string;
      mode: "audio";
      initiator: "character";
      initiatorCharacterId: string | null;
      metadata: Record<string, unknown>;
    }): Promise<ConversationCallSession | null>;
  };
  readTtsSettings(): Promise<Record<string, unknown>>;
  log: { debug(message: string, ...args: unknown[]): void; info(message: string, ...args: unknown[]): void };
}

export function parseRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return parseRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Rings the user for a character's `[call]`, under the same rules as a character call started through
 * POST /start. Returns true once the command is handled, including when this chat does not allow it.
 */
export async function ringCharacterCall(args: CallCommandArgs, host: CallCommandHost): Promise<boolean> {
  if (args.command.type !== "call") return false;
  if (args.chatMode !== "conversation") return true;

  const metadata = parseRecord((await args.chats.getById(args.chatId))?.metadata);
  if (metadata.characterCommands === false || parseRecord(metadata.conversationCommandToggles).call === false) {
    host.log.debug("[calls] Ignored [call]: characters cannot call in chat %s", args.chatId);
    return true;
  }
  if ((await host.readTtsSettings()).callAudioEnabled !== true) {
    host.log.debug("[calls] Ignored [call]: call audio is turned off");
    return true;
  }

  const reason = args.command.reason ?? null;
  const greeting = args.command.greeting ?? null;
  const existing =
    (await host.calls.getActiveForChat(args.chatId)) ?? (await host.calls.getRingingForChat(args.chatId));
  const session =
    existing ??
    (await host.calls.createSession({
      chatId: args.chatId,
      mode: "audio",
      initiator: "character",
      initiatorCharacterId: args.characterId,
      metadata: { reason, greeting, sourceMessageId: args.messageId ?? null },
    }));
  if (!session) return true;

  if (!existing) {
    await args.chats.createMessagesBatch(args.chatId, [
      {
        role: "system",
        characterId: args.characterId,
        content: "Incoming call",
        extra: {
          displayText: null,
          isGenerated: true,
          tokenCount: null,
          generationInfo: null,
          conversationCallEvent: {
            callId: session.id,
            status: session.status,
            mode: session.mode,
            initiator: session.initiator,
            reason,
            greeting,
            sourceMessageId: args.messageId ?? null,
          },
        },
      },
    ]);
  }
  // A call already in progress is left alone; only a ringing one rings. It rings as the character who placed it,
  // since answering connects that call and plays its greeting, even when another character's [call] re-rings it.
  if (session.status === "ringing") {
    args.sendRingingEvent({
      session,
      reason: parseRecord(session.metadata).reason ?? null,
      characterId: session.initiatorCharacterId,
    });
    host.log.info("[calls] Character call ringing in chat %s", args.chatId);
  }
  return true;
}
