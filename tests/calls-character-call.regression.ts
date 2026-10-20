import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ringCharacterCall,
  type CallCommandArgs,
  type CallCommandHost,
} from "../packages/conversation-calls/src/engine/packages/server/src/services/conversation/call-command.ts";

type Session = NonNullable<Awaited<ReturnType<CallCommandHost["calls"]["createSession"]>>>;

/** A Conversation chat whose character's reply contained a [call] command, as the Engine hands it over. */
function scenario(
  options: {
    metadata?: Record<string, unknown> | string;
    tts?: Record<string, unknown>;
    active?: Session | null;
    ringing?: Session | null;
    command?: CallCommandArgs["command"];
    chatMode?: CallCommandArgs["chatMode"];
  } = {},
) {
  const created: Session[] = [];
  const messages: Array<Record<string, unknown>> = [];
  const ringing: Array<Record<string, unknown>> = [];
  const args: CallCommandArgs = {
    command: options.command ?? { type: "call", reason: "miss you", greeting: "Hey, you picked up!" },
    characterId: "char-1",
    chatId: "chat-1",
    chatMode: options.chatMode ?? "conversation",
    messageId: "msg-1",
    chats: {
      getById: async (id) => (id === "chat-1" ? { metadata: options.metadata ?? JSON.stringify({}) } : null),
      createMessagesBatch: async (_chatId, batch) => {
        messages.push(...batch);
      },
    },
    sendRingingEvent: (data) => {
      ringing.push(data);
    },
  };
  const host: CallCommandHost = {
    calls: {
      getActiveForChat: async () => options.active ?? null,
      getRingingForChat: async () => options.ringing ?? null,
      createSession: async (input) => {
        const session = {
          id: `call-${created.length + 1}`,
          status: "ringing",
          startedAt: null,
          endedAt: null,
          summary: null,
          createdAt: "2026-10-12T00:00:00.000Z",
          updatedAt: "2026-10-12T00:00:00.000Z",
          ...input,
        } as Session;
        created.push(session);
        return session;
      },
    },
    readTtsSettings: async () => options.tts ?? { callAudioEnabled: true },
    log: { debug: () => {}, info: () => {} },
  };
  return { args, host, created, messages, ringing };
}

async function main() {
  // A character's [call] rings the user: a ringing call, an "Incoming call" line in the chat, and the ringing event.
  {
    const run = scenario();
    assert.equal(await ringCharacterCall(run.args, run.host), true);
    assert.equal(run.created.length, 1);
    assert.deepEqual(
      {
        status: run.created[0]!.status,
        initiator: run.created[0]!.initiator,
        initiatorCharacterId: run.created[0]!.initiatorCharacterId,
        metadata: run.created[0]!.metadata,
      },
      {
        status: "ringing",
        initiator: "character",
        initiatorCharacterId: "char-1",
        metadata: { reason: "miss you", greeting: "Hey, you picked up!", sourceMessageId: "msg-1" },
      },
    );
    assert.equal(run.messages.length, 1);
    assert.equal(run.messages[0]!.content, "Incoming call");
    assert.equal(run.messages[0]!.characterId, "char-1");
    assert.equal(
      (run.messages[0]!.extra as { conversationCallEvent: { callId: string } }).conversationCallEvent.callId,
      "call-1",
    );
    assert.deepEqual(run.ringing, [{ session: run.created[0], reason: "miss you", characterId: "char-1" }]);
  }

  // Metadata may arrive parsed; a bare [call] has no reason or greeting.
  {
    const run = scenario({ metadata: {}, command: { type: "call" } });
    assert.equal(await ringCharacterCall(run.args, run.host), true);
    assert.deepEqual(run.created[0]!.metadata, { reason: null, greeting: null, sourceMessageId: "msg-1" });
    assert.equal(run.ringing.length, 1);
  }

  // A call already ringing rings again without a second call or chat line, as the character who placed it: answering
  // connects that call and plays its greeting, even when another character's [call] re-rings it.
  {
    const old = {
      id: "call-old",
      status: "ringing",
      initiatorCharacterId: "char-2",
      metadata: { reason: "old reason", greeting: "Hi from char-2" },
    } as Session;
    const run = scenario({ ringing: old });
    assert.equal(await ringCharacterCall(run.args, run.host), true);
    assert.equal(run.created.length, 0);
    assert.equal(run.messages.length, 0);
    assert.deepEqual(run.ringing, [{ session: old, reason: "old reason", characterId: "char-2" }]);
  }

  // A call in progress is left alone.
  {
    const run = scenario({ active: { id: "call-live", status: "active" } as Session });
    assert.equal(await ringCharacterCall(run.args, run.host), true);
    assert.deepEqual([run.created.length, run.messages.length, run.ringing.length], [0, 0, 0]);
  }

  // The same rules as a character call through /start: commands on, the call command on, call audio on.
  for (const blocked of [
    scenario({ metadata: JSON.stringify({ characterCommands: false }) }),
    scenario({ metadata: JSON.stringify({ conversationCommandToggles: { call: false } }) }),
    scenario({ tts: { callAudioEnabled: false } }),
    scenario({ tts: {} }),
    scenario({ chatMode: "roleplay" }),
  ]) {
    assert.equal(await ringCharacterCall(blocked.args, blocked.host), true);
    assert.deepEqual([blocked.created.length, blocked.messages.length, blocked.ringing.length], [0, 0, 0]);
  }

  // Other commands are not this handler's.
  {
    const run = scenario({ command: { type: "selfie" } });
    assert.equal(await ringCharacterCall(run.args, run.host), false);
    assert.equal(run.created.length, 0);
  }

  // The built package registers the real handler. Calls 1.0.x-1.1.1 registered the Engine's host shim, which only
  // looked the [call] service up again in its own empty copy of the registry, so a character's call never rang.
  const server = await readFile(new URL("../packages/conversation-calls/server.mjs", import.meta.url), "utf8");
  // The shim names the service key a second time to look it up; the real handler only registers it.
  assert.deepEqual(
    [
      server.split('"conversation-calls:command"').length - 1,
      server.split('registerService("conversation-calls:command"').length - 1,
    ],
    [1, 1],
    "the built server.mjs must not register the host shim as the [call] service",
  );
  assert.ok(server.includes("[calls] Character call ringing in chat %s"), "the built server.mjs rings character calls");

  process.stdout.write("Calls character call regression passed.\n");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
