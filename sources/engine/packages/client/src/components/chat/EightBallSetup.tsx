// ──────────────────────────────────────────────
// EightBallSetup — game configuration modal (conversation mode)
// ──────────────────────────────────────────────
// Opened from the /8ball (alias /pool) command or the natural-language
// launcher. 8-ball is strictly one-on-one like chess, but adds poker's
// "character announcer" idiom — the announcer only narrates and, unlike the
// opponent, may be any character in the chat (including a non-playing one).
import { useEffect, useMemo, useState } from "react";
import { CircleDot } from "lucide-react";
import { DEFAULT_EIGHTBALL_CONFIG, type EightBallConfig } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { useCharacters } from "../../hooks/use-characters";
import { useChats } from "../../hooks/use-chats";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { useStartEightBall } from "../../hooks/use-eightball";
import { useEightBallGameStore } from "../../stores/eightball-game.store";

interface Props {
  chatId: string;
  open: boolean;
  onClose: () => void;
}

const RACE_OPTIONS: Array<{ value: EightBallConfig["raceTo"]; label: string }> = [
  { value: 1, label: "Race to 1" },
  { value: 3, label: "Race to 3" },
  { value: 5, label: "Race to 5" },
];

const BREAK_OPTIONS: Array<{ value: EightBallConfig["humanBreaks"]; label: string }> = [
  { value: "you", label: "You" },
  { value: "random", label: "Random" },
  { value: "opponent", label: "Them" },
];

export function EightBallSetup({ chatId, open, onClose }: Props) {
  const { data: chats } = useChats();
  const { data: characters } = useCharacters(open);
  const start = useStartEightBall(chatId);

  // A game can start underneath the open modal — e.g. the user's "let's play
  // pool" message opens this setup AND a character accepts via [eightball].
  // Finished games linger in the store, so exclude them or a rematch's setup
  // modal closes itself on the same frame it opens.
  const activeGame = useEightBallGameStore((s) => s.current);
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
  const [announcerCharacterId, setAnnouncerCharacterId] = useState<string | null>(
    DEFAULT_EIGHTBALL_CONFIG.announcerCharacterId,
  );
  const [raceTo, setRaceTo] = useState<EightBallConfig["raceTo"]>(DEFAULT_EIGHTBALL_CONFIG.raceTo);
  const [humanBreaks, setHumanBreaks] = useState<EightBallConfig["humanBreaks"]>(DEFAULT_EIGHTBALL_CONFIG.humanBreaks);

  // Default opponent = the chat's first character (until the user picks one).
  const selectedOpponent = opponentId ?? charIds[0] ?? null;
  const canStart = !!selectedOpponent && !start.isPending;

  const startGame = () => {
    if (!selectedOpponent || !canStart) return;
    start.mutate(
      {
        gameType: "eightball",
        config: { raceTo, humanBreaks, announcerCharacterId },
        botCharacterIds: [selectedOpponent],
        humanFirst: true,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Start 8-Ball Pool" width="max-w-md">
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
                    name="eightball-opponent"
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

        {/* Announcer */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Announcer</h3>
          <select
            value={announcerCharacterId ?? ""}
            onChange={(e) => setAnnouncerCharacterId(e.target.value || null)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]"
          >
            <option value="">Silent (no announcer)</option>
            {charIds.map((id) => (
              <option key={id} value={id}>
                {nameById.get(id) ?? id}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            A character announcer calls the break, fouls and rack wins in their own voice — even the opponent, or a
            character not otherwise playing. Narration only; it never changes the rules.
          </p>
        </section>

        {/* Race to */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Match length</h3>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
            {RACE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRaceTo(opt.value)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                  raceTo === opt.value
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Who breaks */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Who breaks first</h3>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
            {BREAK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHumanBreaks(opt.value)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                  humanBreaks === opt.value
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Later racks alternate the break.</p>
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
            <CircleDot className="h-4 w-4" />
            {start.isPending ? "Racking up…" : "Start game"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
