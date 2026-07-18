import { createHash } from "node:crypto";
import type {
  LtmMode,
  LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { nowIso } from "./ltm-utils.js";
import { LongTermMemoryStorage } from "./storage.js";

export type FinalizedTurnInput = {
  chatId: string;
  chatMode: string;
  messageId: string;
  swipeIndex: number;
  content: string;
  characterId: string | null;
  personaId?: string;
  regenerate: boolean;
  continuation: boolean;
};

function modeForChat(chatMode: string): LtmMode {
  return chatMode === "visual_novel" ? "roleplay" : chatMode as LtmMode;
}

function sourceNoteId(input: Pick<FinalizedTurnInput, "chatId" | "messageId" | "swipeIndex">) {
  const identity = `${input.chatId}\0${input.messageId}\0${input.swipeIndex}`;
  return `source_turn_${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`;
}

function sameCapture(current: LtmNote, next: LtmNote) {
  return current.title === next.title &&
    JSON.stringify(current.modes) === JSON.stringify(next.modes) &&
    JSON.stringify(current.scope) === JSON.stringify(next.scope) &&
    JSON.stringify(current.tags) === JSON.stringify(next.tags) &&
    JSON.stringify(current.sections) === JSON.stringify(next.sections);
}

function sourceSections(
  content: string,
  evidence: string[],
  current: LtmNote | null,
  timestamp: string,
) {
  const sections: LtmNote["sections"] = {};
  for (let offset = 0, index = 0; offset < content.length; offset += 24_000, index += 1) {
    const key = index === 0 ? "source" : `source_${index + 1}`;
    sections[key] = {
      text: content.slice(offset, offset + 24_000),
      updatedAt: current?.sections[key]?.updatedAt ?? timestamp,
      evidence,
    };
  }
  return sections;
}

export async function captureFinalizedLongTermMemoryTurn(
  input: FinalizedTurnInput,
  storage: LongTermMemoryStorage,
) {
  const content = input.content.trim();
  if (!content) return null;
  const id = sourceNoteId(input);
  return storage.projectNote(id, "source", (current) => {
    const timestamp = nowIso();
    const mode = modeForChat(input.chatMode);
    const evidence = [
      `chat:${input.chatId}`,
      `message:${input.messageId}`,
      `swipe:${input.swipeIndex}`,
    ];
    const note = {
      id,
      title: `Assistant turn ${input.messageId} swipe ${input.swipeIndex}`,
      type: "source" as const,
      status: "active" as const,
      modes: [mode],
      scope: {
        chatId: input.chatId,
        chatIds: [input.chatId],
        ...(input.characterId ? { characterIds: [input.characterId] } : {}),
        ...(input.personaId ? { personaId: input.personaId } : {}),
      },
      tags: ["captured_turn"],
      keywords: [],
      links: [],
      sections: sourceSections(content, evidence, current, timestamp),
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: current?.updatedAt ?? timestamp,
      version: current?.version ?? 1,
    } satisfies LtmNote;
    if (current && sameCapture(current, note)) return current;
    for (const section of Object.values(note.sections)) section.updatedAt = timestamp;
    note.updatedAt = timestamp;
    return note;
  });
}
