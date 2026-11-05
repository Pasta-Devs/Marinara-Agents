// ──────────────────────────────────────────────
// BlackjackSetup — game configuration modal (conversation mode)
// ──────────────────────────────────────────────
// Opened from the /blackjack command or the natural-language launcher. Lets
// the player pick which characters sit down to play, an optional character
// to deal for the house, and the table's stakes and house rules.
import { useEffect, useMemo, useState } from "react";
import { Club } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useCharacters } from "../../hooks/use-characters";
import { useChats } from "../../hooks/use-chats";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { useStartBlackjack } from "../../hooks/use-blackjack";
import { useBlackjackGameStore } from "../../stores/blackjack-game.store";
import {
  BLACKJACK_MAX_PLAYERS,
  DEFAULT_BLACKJACK_CONFIG,
} from "../../../../shared/src/features/turn-games/blackjack/types";

interface Props {
  chatId: string;
  open: boolean;
  onClose: () => void;
}

const DECK_CHOICES = [1, 2, 4, 6, 8];
/** An integer from a number field's text, held to [min, max]; blank or unreadable text falls back. */
function clampInput(raw: string, min: number, max: number, fallback: number): number {
  const value = Math.floor(Number(raw));
  return raw.trim() === "" || !Number.isFinite(value) ? fallback : Math.min(max, Math.max(min, value));
}

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]";

export function BlackjackSetup({ chatId, open, onClose }: Props) {
  const { data: chats } = useChats();
  const { data: characters } = useCharacters(open);
  const start = useStartBlackjack(chatId);

  // A game can start underneath the open modal (the user's "let's play blackjack" opens this setup while a
  // character may already be dealing). Finished games linger in the store, so a rematch's setup stays open.
  const activeGame = useBlackjackGameStore((s) => s.byChat[chatId] ?? null);
  useEffect(() => {
    if (open && activeGame && activeGame.status !== "finished") onClose();
  }, [open, activeGame, onClose]);

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

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [dealerCharacterId, setDealerCharacterId] = useState<string | null>(null);
  // Raw strings so a half-typed number survives; each is clamped to the engine's bounds on blur and on submit.
  const [bankrollInput, setBankrollInput] = useState(String(DEFAULT_BLACKJACK_CONFIG.startingBankroll));
  const [minBetInput, setMinBetInput] = useState(String(DEFAULT_BLACKJACK_CONFIG.minBet));
  const [decks, setDecks] = useState(DEFAULT_BLACKJACK_CONFIG.decks);
  const [roundLimitInput, setRoundLimitInput] = useState(String(DEFAULT_BLACKJACK_CONFIG.roundLimit));
  const [dealerHitsSoft17, setDealerHitsSoft17] = useState(DEFAULT_BLACKJACK_CONFIG.dealerHitsSoft17);

  // A character dealer takes one of the seven spots and plays no hand.
  const maxPlayers = BLACKJACK_MAX_PLAYERS - 1 - (dealerCharacterId ? 1 : 0);
  const playerIds = charIds.filter((id) => id !== dealerCharacterId);
  const defaultSelection = () => new Set(playerIds.slice(0, maxPlayers));
  const selectedIds = new Set([...(selected ?? defaultSelection())].filter((id) => playerIds.includes(id)));

  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set([...(current ?? defaultSelection())].filter((entry) => playerIds.includes(entry)));
      if (next.has(id)) next.delete(id);
      else if (next.size < maxPlayers) next.add(id);
      return next;
    });

  const botCharacterIds = [
    ...playerIds.filter((id) => selectedIds.has(id)).slice(0, maxPlayers),
    ...(dealerCharacterId ? [dealerCharacterId] : []),
  ];
  const playerCount = selectedIds.size + 1;
  const canStart = botCharacterIds.length >= 1 && !start.isPending;
  const startingBankroll = clampInput(bankrollInput, 100, 1_000_000, DEFAULT_BLACKJACK_CONFIG.startingBankroll);
  const minBetCap = Math.max(1, Math.floor(startingBankroll / 4));
  const minBet = clampInput(minBetInput, 1, minBetCap, Math.min(DEFAULT_BLACKJACK_CONFIG.minBet, minBetCap));
  const roundLimit = clampInput(roundLimitInput, 0, 1000, DEFAULT_BLACKJACK_CONFIG.roundLimit);

  const startGame = () => {
    if (!canStart) return;
    start.mutate(
      {
        gameType: "blackjack",
        config: {
          startingBankroll,
          minBet,
          decks,
          dealerHitsSoft17,
          roundLimit,
          dealerCharacterId,
        },
        botCharacterIds,
        humanFirst: true,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Start Blackjack" width="max-w-md">
      <div className="space-y-4 p-1">
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
            A character dealer runs the table for the house and calls each round in their own voice instead of playing.
            The cards are dealt fairly either way.
          </p>
        </section>

        {/* Players */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Players</h3>
          {playerIds.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              {charIds.length === 0
                ? "Add at least one character to this chat to play."
                : "Just you against the dealer."}
            </p>
          ) : (
            <div className="space-y-1">
              {playerIds.map((id) => {
                const checked = selectedIds.has(id);
                const capped = !checked && selectedIds.size >= maxPlayers;
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
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Seven spots at the table: you plus up to {maxPlayers} character{maxPlayers === 1 ? "" : "s"}.
          </p>
        </section>

        {/* Stakes and house rules */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Table</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-[var(--foreground)]">
              Starting chips
              <input
                type="number"
                min={100}
                max={1_000_000}
                value={bankrollInput}
                onChange={(e) => setBankrollInput(e.target.value)}
                onBlur={() => {
                  // The bet cap follows the chips, so settle the bet against the new cap too.
                  setBankrollInput(String(startingBankroll));
                  setMinBetInput(String(minBet));
                }}
                className={inputClass}
              />
            </label>
            <label className="text-sm text-[var(--foreground)]">
              Minimum bet
              <input
                type="number"
                min={1}
                max={minBetCap}
                value={minBetInput}
                onChange={(e) => setMinBetInput(e.target.value)}
                onBlur={() => setMinBetInput(String(minBet))}
                className={inputClass}
              />
              <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">Up to {minBetCap}.</span>
            </label>
            <label className="text-sm text-[var(--foreground)]">
              Decks in the shoe
              <select value={decks} onChange={(e) => setDecks(Number(e.target.value))} className={inputClass}>
                {DECK_CHOICES.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[var(--foreground)]">
              Round limit
              <input
                type="number"
                min={0}
                max={1000}
                value={roundLimitInput}
                onChange={(e) => setRoundLimitInput(e.target.value)}
                onBlur={() => setRoundLimitInput(String(roundLimit))}
                className={inputClass}
              />
              <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                0 = until you run out of chips.
              </span>
            </label>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={dealerHitsSoft17}
              onChange={(e) => setDealerHitsSoft17(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            Dealer hits soft 17
          </label>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Blackjack pays 3 to 2. Double on any two cards, split a pair once.
          </p>
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
            <Club className="h-4 w-4" />
            {start.isPending ? "Shuffling…" : `Deal (${playerCount}p)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
