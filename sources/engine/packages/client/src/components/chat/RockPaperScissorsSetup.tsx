// ──────────────────────────────────────────────
// RockPaperScissorsSetup — game configuration modal (conversation mode)
// ──────────────────────────────────────────────
// Opened from the /rps command or the natural-language launcher.
// Rock-paper-scissors is strictly one-on-one: pick a single opponent
// character and the match length.
import { useEffect, useMemo, useState } from "react";
import { Swords } from "lucide-react";
import type { RockPaperScissorsConfig } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { useCharacters } from "../../hooks/use-characters";
import { useChats } from "../../hooks/use-chats";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { useStartRockPaperScissors } from "../../hooks/use-rock-paper-scissors";
import { useRockPaperScissorsGameStore } from "../../stores/rock-paper-scissors-game.store";

interface Props {
  chatId: string;
  open: boolean;
  onClose: () => void;
}

const ROUNDS_OPTIONS: Array<{ value: RockPaperScissorsConfig["roundsToWin"]; label: string }> = [
  { value: 2, label: "Best of 3" },
  { value: 3, label: "Best of 5" },
  { value: 4, label: "Best of 7" },
];

export function RockPaperScissorsSetup({ chatId, open, onClose }: Props) {
  const { data: chats } = useChats();
  const { data: characters } = useCharacters(open);
  const start = useStartRockPaperScissors(chatId);

  // A game can start underneath the open modal — e.g. the user's "let's play
  // rock paper scissors" message opens this setup AND a character accepts via
  // [rock_paper_scissors]. Finished matches linger in the store, so exclude
  // them or a rematch's setup modal closes itself on the same frame it opens.
  const activeGame = useRockPaperScissorsGameStore((s) => s.current);
  useEffect(() => {
    if (open && activeGame?.chatId === chatId && activeGame.status !== "finished") onClose();
  }, [open, activeGame, chatId, onClose]);

  const chat = useMemo(() => (chats ?? []).find((c) => c.id === chatId), [chats, chatId]);
  const charIds = useMemo(() => getChatCharacterIds(chat), [chat]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters ?? []) {
      const item = c as { id?: string; data?: unknown; comment?: string | null };
      if (typeof item.id === "string")
        map.set(item.id, parseCharacterDisplayData({ data: item.data, comment: item.comment }).name);
    }
    return map;
  }, [characters]);

  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [roundsToWin, setRoundsToWin] = useState<RockPaperScissorsConfig["roundsToWin"]>(2);

  // Default opponent = the chat's first character (until the user picks one).
  const selectedOpponent = opponentId ?? charIds[0] ?? null;
  const canStart = !!selectedOpponent && !start.isPending;

  const startGame = () => {
    if (!selectedOpponent || !canStart) return;
    start.mutate(
      {
        gameType: "rock-paper-scissors",
        config: { roundsToWin },
        botCharacterIds: [selectedOpponent],
        humanFirst: true,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Start Rock-Paper-Scissors" width="max-w-md">
      <div className="space-y-4 p-1">
        {/* Opponent */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Opponent</h3>
          {charIds.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Add at least one character to this chat to play.</p>
          ) : (
            <div className="space-y-1">
              {charIds.map((id) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--muted)]"
                >
                  <input
                    type="radio"
                    name="rps-opponent"
                    checked={selectedOpponent === id}
                    onChange={() => setOpponentId(id)}
                    className="accent-[var(--primary)]"
                  />
                  <span className="text-sm text-[var(--foreground)]">{nameById.get(id) ?? id}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Match length */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Match length</h3>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
            {ROUNDS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRoundsToWin(opt.value)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                  roundsToWin === opt.value
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={startGame}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
          >
            <Swords className="h-4 w-4" />
            {start.isPending ? "Setting up…" : "Start match"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
