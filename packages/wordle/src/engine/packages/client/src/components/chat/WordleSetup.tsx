// ──────────────────────────────────────────────
// WordleSetup — today's Wordle (conversation mode)
// ──────────────────────────────────────────────
// Opened from the /wordle command or the natural-language launcher. Shows the
// chat's results and streaks for today and lets the player pick which
// characters race them for the word. Each chat has one word a day, and every
// seat gets one go at it.
import { useEffect, useMemo, useState } from "react";
import { Grid3x3 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useCharacters } from "../../hooks/use-characters";
import { useChats } from "../../hooks/use-chats";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { localWordleDay, useStartWordle, useWordleDaily, type WordleDailyResult } from "../../hooks/use-wordle";
import { useWordleGameStore } from "../../stores/wordle-game.store";
import { WORDLE_MAX_PLAYERS } from "../../../../shared/src/features/turn-games/wordle/types";

interface Props {
  chatId: string;
  open: boolean;
  onClose: () => void;
}

function resultLabel(result: WordleDailyResult): string {
  if (result.status === "solved") return `solved in ${result.guesses}`;
  if (result.status === "failed") return "missed it";
  return "gave up";
}

function untilMidnight(now: Date): string {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const minutes = Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function WordleSetup({ chatId, open, onClose }: Props) {
  const { data: chats } = useChats();
  const { data: characters } = useCharacters(open);
  const start = useStartWordle(chatId);
  const day = localWordleDay();
  const daily = useWordleDaily(chatId, day, open);

  // A game can start underneath the open modal. Finished games linger in the store, so this only closes for a live one.
  const activeGame = useWordleGameStore((s) => s.byChat[chatId] ?? null);
  useEffect(() => {
    if (open && activeGame && activeGame.status !== "finished") onClose();
  }, [open, activeGame, onClose]);

  const chat = useMemo(() => (chats ?? []).find((c) => c.id === chatId), [chats, chatId]);
  const charIds = useMemo(() => getChatCharacterIds(chat), [chat]);
  // The runner seats the human as the chat's persona, or "human" without one.
  const humanSeatId = (chat as { personaId?: string | null } | undefined)?.personaId || "human";

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters ?? []) {
      const item = c as { id?: string; data?: unknown; comment?: string | null };
      if (typeof item.id === "string")
        map.set(item.id, parseCharacterDisplayData({ data: item.data, comment: item.comment }).name);
    }
    return map;
  }, [characters]);

  const results = daily.data?.results ?? {};
  const standings = daily.data?.standings ?? {};
  const youPlayed = !!results[humanSeatId];
  const maxCharacters = WORDLE_MAX_PLAYERS - 1;
  const available = charIds.filter((id) => !results[id]);

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const defaultSelection = () => new Set(available.slice(0, maxCharacters));
  const selectedIds = new Set([...(selected ?? defaultSelection())].filter((id) => available.includes(id)));
  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set([...(current ?? defaultSelection())].filter((entry) => available.includes(entry)));
      if (next.has(id)) next.delete(id);
      else if (next.size < maxCharacters) next.add(id);
      return next;
    });

  const botCharacterIds = available.filter((id) => selectedIds.has(id)).slice(0, maxCharacters);
  const canStart = daily.isSuccess && !youPlayed && !start.isPending;

  const startGame = () => {
    if (!canStart) return;
    const streaks: Record<string, number> = {};
    for (const seatId of [humanSeatId, ...botCharacterIds]) streaks[seatId] = standings[seatId]?.before ?? 0;
    start.mutate(
      {
        gameType: "wordle",
        config: { day, chatId, streaks, players: botCharacterIds },
        botCharacterIds,
        humanFirst: true,
      },
      { onSuccess: () => onClose() },
    );
  };

  const streakOf = (seatId: string) => {
    const current = standings[seatId]?.current ?? 0;
    return current > 0 ? `${current}-day streak` : "";
  };
  const todayRows = Object.entries(results);

  return (
    <Modal open={open} onClose={onClose} title="Today's Wordle" width="max-w-md">
      <div className="space-y-4 p-1">
        <p className="text-sm text-[var(--muted-foreground)]">
          One word a day for this chat ({day}). Everyone guesses the same word on their own board, one guess per turn.
          The table sees your colors, never your letters. Fewest guesses wins.
        </p>

        {daily.isPending && <p className="text-sm text-[var(--muted-foreground)]">Checking today's results…</p>}
        {daily.isError && (
          <p className="text-sm text-red-600">Could not load today's results. Close this and try again.</p>
        )}

        {todayRows.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Today so far</h3>
            <ul className="space-y-0.5 text-sm text-[var(--foreground)]">
              {todayRows.map(([seatId, result]) => (
                <li key={seatId}>
                  {seatId === humanSeatId ? "You" : (nameById.get(seatId) ?? result.name)}: {resultLabel(result)}
                  {streakOf(seatId) && <span className="text-[var(--muted-foreground)]"> · {streakOf(seatId)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {daily.isSuccess && youPlayed ? (
          <p className="rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-center text-sm font-semibold text-[var(--primary)]">
            You've had your go at today's word. The next one unlocks in {untilMidnight(new Date())}.
          </p>
        ) : (
          daily.isSuccess && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Players</h3>
              {available.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  {charIds.length === 0
                    ? "Just you today. Add characters to this chat to race them."
                    : "Every character here has played today, so it's just you."}
                </p>
              ) : (
                <div className="space-y-1">
                  {available.map((id) => {
                    const checked = selectedIds.has(id);
                    const capped = !checked && selectedIds.size >= maxCharacters;
                    return (
                      <label
                        key={id}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--muted)] ${
                          capped ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={capped}
                          onChange={() => toggleSelected(id)}
                          className="accent-[var(--primary)]"
                        />
                        <span className="text-sm text-[var(--foreground)]">{nameById.get(id) ?? id}</span>
                        <span className="ml-auto text-xs text-[var(--muted-foreground)]">{streakOf(id)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                You plus up to {maxCharacters} characters. Once you've made a guess, ending the game early still uses
                your go for today.
              </p>
            </section>
          )
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            {youPlayed ? "Close" : "Cancel"}
          </button>
          {!youPlayed && (
            <button
              type="button"
              disabled={!canStart}
              onClick={startGame}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
            >
              <Grid3x3 className="h-4 w-4" />
              {start.isPending ? "Picking the word…" : `Play (${botCharacterIds.length + 1}p)`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
