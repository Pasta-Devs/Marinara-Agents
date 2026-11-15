// ──────────────────────────────────────────────
// Wordle: server entry
// ──────────────────────────────────────────────
// Registers the Wordle engine and the [wordle] conversation command, and serves
// each chat's daily record at GET /api/wordle/:chatId/days/:day. The engine is
// registered through a wrapper that saves a seat's board after every accepted
// guess, human or bot, so the once-a-day record follows the real game.
import { clampWordleDay, wordleEngine } from "../../../../shared/src/features/turn-games/wordle/engine.js";
import { WORDLE_MAX_PLAYERS, type WordleConfig } from "../../../../shared/src/features/turn-games/wordle/types.js";
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

/** What the Engine passes a command's start hook when a character's tag starts the game (Capability API 1.827). */
interface WordleTagStartContext {
  chatId: string;
  characterId: string | null;
  /** The characters the Engine would seat, the tagging character first. */
  botCharacterIds: string[];
  /** The player's seat: the chat's persona id, or "human" without one. */
  humanSeatId: string;
  /** The chat's IANA time zone, or null for the server's local time. */
  timeZone: string | null;
}

interface WordleTagStart {
  config: WordleConfig;
  botCharacterIds: string[];
}

// Structural: the server bundle may not import Engine storage, db or logger modules, only use api.runtime.
type ActivationContext = {
  api: {
    runtime: { persistence: WordlePersistence; logger: WordleLogger };
    registerTurnGameEngine(engine: typeof wordleEngine): Cleanup;
    registerConversationCommand(registration: {
      commandType: string;
      tags: string[];
      startConfig?: (context: WordleTagStartContext) => Promise<WordleTagStart | null>;
    }): Cleanup;
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

/** The calendar day (YYYY-MM-DD) in an IANA time zone, or in the server's local time without one. */
export function wordleDayIn(timeZone: string | null, now: number): string {
  if (timeZone) {
    try {
      // en-CA formats dates as YYYY-MM-DD.
      const formatted = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;
    } catch {
      // An unknown zone falls back to the server's local day.
    }
  }
  const date = new Date(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The game a character's [wordle] tag starts, or null when the player has had their go. See wordleTagStart. */
async function tagStartFor(store: WordleStore, context: WordleTagStartContext): Promise<WordleTagStart | null> {
  const now = Date.now();
  const day = clampWordleDay(wordleDayIn(context.timeZone, now), now);
  const daily = await store.getDaily(context.chatId, day);
  if (daily.results[context.humanSeatId]) return null;
  // /wordle goes by the browser's day. A chat whose own clock is set a day behind it can still be on yesterday here
  // after the player played today's word, and starting yesterday's word then would be a second go.
  const nextDay = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  if ((await store.getDaily(context.chatId, nextDay)).results[context.humanSeatId]) return null;
  const players = context.botCharacterIds.filter((id) => !daily.results[id]).slice(0, WORDLE_MAX_PLAYERS - 1);
  const streaks: Record<string, number> = {};
  for (const seatId of [context.humanSeatId, ...players]) streaks[seatId] = daily.standings[seatId]?.before ?? 0;
  return { config: { day, chatId: context.chatId, streaks, players }, botCharacterIds: players };
}

/**
 * The game a character's [wordle] tag starts (Capability API 1.827), built like the setup screen's: this chat, its
 * day, each seat's streak, and only the characters who haven't played today. Null when the player has had their go,
 * and null (logged) when the record cannot be read.
 */
export function wordleTagStart(store: WordleStore, logger: WordleLogger) {
  return async (context: WordleTagStartContext): Promise<WordleTagStart | null> => {
    try {
      return await tagStartFor(store, context);
    } catch (error) {
      // The Engine would also start nothing on a throw; this keeps the reason in the package's own log.
      logger.error(error, "Wordle could not read the record to start a game for chat %s", context.chatId);
      return null;
    }
  };
}

/**
 * The engine with two additions: every accepted guess saves that seat's board to the chat's daily record, and
 * character guesses are applied without a chat line each (`silentBotMoves`, Capability API 1.827; older Engines
 * ignore it and narrate every guess).
 */
export function withDailyRecord(
  store: WordleStore,
  logger: WordleLogger,
): typeof wordleEngine & { silentBotMoves: true } {
  return {
    ...wordleEngine,
    silentBotMoves: true,
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
    cleanups.push(
      api.registerConversationCommand({
        commandType: "wordle",
        tags: ["wordle"],
        startConfig: wordleTagStart(store, api.runtime.logger),
      }),
    );
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
