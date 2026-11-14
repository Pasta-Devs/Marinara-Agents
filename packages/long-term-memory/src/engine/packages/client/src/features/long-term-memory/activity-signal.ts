/**
 * What the Agent activity icon shows for Long-Term Memory (Capability API 1.820, `setPackageActivity`): it spins while
 * memory reads new messages and shows a dot when saving failed. Both come from the same facts the card draws, so the
 * icon and the card cannot disagree. Recall problems, set-up and left-out never light the icon: they are not news the
 * user must act on from the corner of the screen.
 */
export type ActivitySignal = { busy: boolean; alert: boolean };

export const activitySignalOf = (card: { reading: boolean; saveFailed: unknown }): ActivitySignal => ({
  busy: card.reading,
  alert: Boolean(card.saveFailed),
});

// "Try again" hides a failed-read line until a newer run fails. It is kept per chat, outside any one mount, so the
// card and the icon agree: a retry from the panel clears the dot the surface mount owns.
const retriedAt = new Map<string, number>();
const retriedListeners = new Set<() => void>();

export const retriedAtOf = (chatId: string | null | undefined) => (chatId ? (retriedAt.get(chatId) ?? 0) : 0);

export function markRetried(chatId: string, at = Date.now()) {
  retriedAt.set(chatId, at);
  retriedListeners.forEach((listener) => listener());
}

export function subscribeRetried(listener: () => void) {
  retriedListeners.add(listener);
  return () => void retriedListeners.delete(listener);
}

// How many mounts publish for a chat (the surface element, and the activity panel's card when it is open). Every mount
// reads the same cache and so publishes the same signal; the entry is cleared only when the last one leaves, because
// the Engine never clears a package's signal on its own.
const owners = new Map<string, number>();

/** Counts one more mount for the chat; the returned release says whether it was the last (the entry must be cleared). */
export function claimActivityOwner(chatId: string) {
  owners.set(chatId, (owners.get(chatId) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return false;
    released = true;
    const left = (owners.get(chatId) ?? 1) - 1;
    if (left > 0) {
      owners.set(chatId, left);
      return false;
    }
    owners.delete(chatId);
    return true;
  };
}
