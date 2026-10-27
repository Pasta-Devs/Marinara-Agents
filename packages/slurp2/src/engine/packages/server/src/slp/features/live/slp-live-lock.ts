/**
 * One writer per show at a time: the world tick, a player's tip and (later) beats all read, change and save
 * the same state row. ponytail: in-process chain, enough for the single Engine process; a cross-process
 * lease is needed only if Slurp ever runs in several processes.
 */
const chains = new Map<string, Promise<unknown>>();

export function withSlurpLiveShow<T>(showId: string, run: () => Promise<T>): Promise<T> {
  const previous = chains.get(showId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  chains.set(showId, next);
  void next
    .finally(() => {
      if (chains.get(showId) === next) chains.delete(showId);
    })
    .catch(() => undefined);
  return next;
}
