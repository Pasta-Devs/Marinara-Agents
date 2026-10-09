/** Clips held while earlier speech is transcribed: the one being sent and two waiting after it. */
export const CALL_SPEECH_QUEUE_LIMIT = 3;

/**
 * Places for recorded call clips that are waiting to be transcribed. A clip recorded while an earlier
 * one is still being transcribed takes a place and waits its turn instead of being dropped. Once every
 * place is taken, new clips are dropped, so a long backlog cannot pile up behind a slow server.
 */
export function createCallSpeechQueue(limit = CALL_SPEECH_QUEUE_LIMIT) {
  let places = new Set<object>();
  return {
    /** Take a place for one clip. Returns the call that frees it, or null when every place is taken. */
    hold(): (() => void) | null {
      if (places.size >= limit) return null;
      const place = {};
      const owner = places;
      owner.add(place);
      return () => {
        owner.delete(place);
      };
    },
    /** Hang-up frees every place. A clip held before it frees nothing afterwards. */
    clear() {
      places = new Set();
    },
  };
}
