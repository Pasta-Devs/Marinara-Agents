// ──────────────────────────────────────────────
// PokerSetup — game configuration modal (conversation mode)
// ──────────────────────────────────────────────
// Opened from the /poker command or the natural-language launcher. Lets the
// player pick which characters sit down as bots, an optional character to
// voice the dealer, and the table's starting stakes.
import { useEffect, useMemo, useState } from "react";
import { Spade } from "lucide-react";
import { DEFAULT_POKER_CONFIG } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { useCharacters } from "../../hooks/use-characters";
import { useChats } from "../../hooks/use-chats";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { useStartPoker } from "../../hooks/use-poker";
import { usePokerGameStore } from "../../stores/poker-game.store";

interface Props {
  chatId: string;
  open: boolean;
  onClose: () => void;
}

// 8 seats total (you + up to this many bots).
const MAX_BOTS = 7;

export function PokerSetup({ chatId, open, onClose }: Props) {
  const { data: chats } = useChats();
  const { data: characters } = useCharacters(open);
  const start = useStartPoker(chatId);

  // A game can start underneath the open modal — e.g. the user's "let's play
  // poker" message opens this setup AND a character accepts via [poker].
  // Finished games linger in the store, so exclude them or a rematch's setup
  // modal closes itself on the same frame it opens.
  const activeGame = usePokerGameStore((s) => s.current);
  useEffect(() => {
    if (open && activeGame?.chatId === chatId && activeGame.status !== "finished") onClose();
  }, [open, activeGame, chatId, onClose]);

  const chat = useMemo(() => (chats ?? []).find((c) => c.id === chatId), [chats, chatId]);
  const charIds = useMemo(() => getChatCharacterIds(chat), [chat]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters ?? []) {
      const item = c as { id?: string; data?: unknown; comment?: string | null };
      if (typeof item.id === "string") map.set(item.id, parseCharacterDisplayData({ data: item.data, comment: item.comment }).name);
    }
    return map;
  }, [characters]);

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [dealerCharacterId, setDealerCharacterId] = useState<string | null>(null);
  const [startingStack, setStartingStack] = useState(DEFAULT_POKER_CONFIG.startingStack);
  const [smallBlind, setSmallBlind] = useState(DEFAULT_POKER_CONFIG.smallBlind);
  const [blindIncreaseEveryHands, setBlindIncreaseEveryHands] = useState(DEFAULT_POKER_CONFIG.blindIncreaseEveryHands);
  const [handLimit, setHandLimit] = useState(DEFAULT_POKER_CONFIG.handLimit);

  // Default selection = every character in the chat, capped at the 7-bot seat
  // limit (recomputed lazily once ids are known).
  const selectedIds = selected ?? new Set(charIds.slice(0, MAX_BOTS));

  const toggleSelected = (id: string) =>
    // Derive from the updater's `current` (not the render-time `selectedIds`) so
    // batched toggles don't clobber each other; fall back to the capped default
    // only before the user's first selection (current === null).
    setSelected((current) => {
      const base = current ?? new Set(charIds.slice(0, MAX_BOTS));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_BOTS) next.add(id);
      return next;
    });

  const botCount = selectedIds.size;
  const canStart = botCount >= 1 && !start.isPending;
  const bigBlind = Math.max(1, Math.floor(smallBlind)) * 2;

  const startGame = () => {
    if (!canStart) return;
    start.mutate(
      {
        gameType: "poker",
        config: {
          startingStack,
          smallBlind,
          blindIncreaseEveryHands,
          handLimit,
          dealerCharacterId,
        },
        botCharacterIds: charIds.filter((id) => selectedIds.has(id)),
        humanFirst: true,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Start Poker" width="max-w-md">
      <div className="space-y-4 p-1">
        {/* Players */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Players</h3>
          {charIds.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Add at least one character to this chat to play.</p>
          ) : (
            <div className="space-y-1">
              {charIds.map((id) => {
                const checked = selectedIds.has(id);
                const capped = !checked && selectedIds.size >= MAX_BOTS;
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
                  </label>
                );
              })}
            </div>
          )}
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">8 seats max (you + up to {MAX_BOTS} characters).</p>
        </section>

        {/* Dealer */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Dealer</h3>
          <select
            value={dealerCharacterId ?? ""}
            onChange={(e) => setDealerCharacterId(e.target.value || null)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]"
          >
            <option value="">House dealer (silent)</option>
            {charIds.map((id) => (
              <option key={id} value={id}>
                {nameById.get(id) ?? id}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            A character dealer announces hands, flops and showdowns in their own voice. The house dealer deals silently.
            The cards are dealt fairly either way.
          </p>
        </section>

        {/* Stakes */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Stakes</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-[var(--foreground)]">
              Starting stack
              <input
                type="number"
                min={100}
                max={1_000_000}
                value={startingStack}
                onChange={(e) => setStartingStack(Math.max(100, Number(e.target.value) || DEFAULT_POKER_CONFIG.startingStack))}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="text-sm text-[var(--foreground)]">
              Small blind
              <input
                type="number"
                min={1}
                value={smallBlind}
                onChange={(e) => setSmallBlind(Math.max(1, Number(e.target.value) || DEFAULT_POKER_CONFIG.smallBlind))}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
              />
              <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">Big blind is double ({bigBlind}).</span>
            </label>
            <label className="text-sm text-[var(--foreground)]">
              Blinds double every
              <input
                type="number"
                min={0}
                value={blindIncreaseEveryHands}
                onChange={(e) => setBlindIncreaseEveryHands(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
              />
              <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">Hands (0 = never).</span>
            </label>
            <label className="text-sm text-[var(--foreground)]">
              Hand limit
              <input
                type="number"
                min={0}
                value={handLimit}
                onChange={(e) => setHandLimit(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
              />
              <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">0 = play until someone busts.</span>
            </label>
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
            <Spade className="h-4 w-4" />
            {start.isPending ? "Dealing…" : `Deal (${botCount + 1}p)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
