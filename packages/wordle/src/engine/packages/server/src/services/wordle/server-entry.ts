// ──────────────────────────────────────────────
// Wordle: server entry
// ──────────────────────────────────────────────
// Registers the Wordle engine and the [wordle] conversation command, and serves
// each chat's daily record at GET /api/wordle/:chatId/days/:day. The engine is
// registered through a wrapper that saves a seat's board after every accepted
// guess, human or bot, so the once-a-day record follows the real game.
import { clampWordleDay, wordleEngine } from "../../../../shared/src/features/turn-games/wordle/engine.js";
import { createWordleStore, type WordlePersistence, type WordleStore } from "./daily-store.js";

type Cleanup = () => void | Promise<void>;

interface WordleLogger {
  error(error: unknown, message: string, ...args: unknown[]): void;
}

interface WordleRequest {
  params: unknown;
}

interface WordleReply {
  status(code: number): WordleReply;
  send(payload: unknown): WordleReply;
}

interface WordleRouter {
  get(path: string, handler: (request: WordleRequest, reply: WordleReply) => Promise<unknown>): void;
}

// Structural: the server bundle may not import Engine storage, db or logger modules, only use api.runtime.
type ActivationContext = {
  api: {
    runtime: { persistence: WordlePersistence; logger: WordleLogger };
    registerTurnGameEngine(engine: typeof wordleEngine): Cleanup;
    registerConversationCommand(registration: { commandType: string; tags: string[] }): Cleanup;
    registerPrivilegedRoutes(
      routes: (router: WordleRouter) => Promise<void>,
      options: { prefix: string },
    ): Promise<Cleanup>;
  };
};

let activeStore: WordleStore | null = null;

function param(request: WordleRequest, key: string): string {
  const params = request.params;
  const value = params && typeof params === "object" ? (params as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value : "";
}

/** The engine with one addition: every accepted guess saves that seat's board to the chat's daily record. */
export function withDailyRecord(store: WordleStore, logger: WordleLogger): typeof wordleEngine {
  return {
    ...wordleEngine,
    applyMove(state, seatId, move) {
      const result = wordleEngine.applyMove(state, seatId, move);
      if (result.ok) {
        const board = result.state.boards[seatId];
        const { chatId, day } = result.state.config;
        if (board) {
          store
            .recordBoard(chatId, day, seatId, {
              name: result.state.seatNames[seatId] ?? seatId,
              status: board.status,
              guesses: board.guesses.length,
            })
            .catch((error) => logger.error(error, "Wordle could not save the result for chat %s", chatId));
        }
      }
      return result;
    },
  };
}

export async function activate({ api }: ActivationContext) {
  const store = createWordleStore(api.runtime.persistence);
  const cleanups: Cleanup[] = [];
  try {
    cleanups.push(api.registerTurnGameEngine(withDailyRecord(store, api.runtime.logger)));
    cleanups.push(api.registerConversationCommand({ commandType: "wordle", tags: ["wordle"] }));
    cleanups.push(
      await api.registerPrivilegedRoutes(
        async (router) => {
          router.get("/:chatId/days/:day", async (request, reply) => {
            const chatId = param(request, "chatId");
            if (!chatId || chatId.length > 200) return reply.status(400).send({ error: "Chat id is invalid." });
            try {
              return await store.getDaily(chatId, clampWordleDay(param(request, "day"), Date.now()));
            } catch (error) {
              api.runtime.logger.error(error, "Wordle could not read the record for chat %s", chatId);
              return reply.status(500).send({ error: "Wordle could not read today's results." });
            }
          });
        },
        { prefix: "/api/wordle" },
      ),
    );
  } catch (error) {
    for (const cleanup of cleanups.reverse()) await cleanup();
    throw error;
  }
  activeStore = store;
  return async () => {
    if (activeStore === store) activeStore = null;
    for (const cleanup of cleanups.reverse()) await cleanup();
  };
}

export async function selfCheck() {
  if (!activeStore) throw new Error("Wordle did not activate");
  // Reads the record of a chat that cannot exist, so a missing storage permission fails here instead of mid-game.
  await activeStore.getDaily("__marinara_capability_self_check__", clampWordleDay(null, Date.now()));
}
