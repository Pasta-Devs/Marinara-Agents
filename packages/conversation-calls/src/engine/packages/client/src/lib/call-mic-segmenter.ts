// Mic recording calls split speech into clips by loudness, checked every CALL_MIC_VAD_INTERVAL_MS.
// These values are unchanged since Calls first shipped (Marinara-Engine 73efb4e28).
export const CALL_MIC_VAD_INTERVAL_MS = 120;
export const CALL_MIC_MIN_SEGMENT_MS = 420;
export const CALL_MIC_SILENCE_MS = 3_000;
export const CALL_MIC_MAX_SEGMENT_MS = 60_000;
export const CALL_MIC_RMS_START = 0.022;
export const CALL_MIC_RMS_CONTINUE = 0.013;
export const CALL_MIC_CONFIRM_FRAMES = 2;
export const CALL_MIC_MIN_VOICED_MS = 180;
export const CALL_MIC_MIN_PEAK_RMS = 0.022;

/**
 * What one loudness check means for the recorded clip:
 * - start: no clip is open and speech began, so open one.
 * - speech: the open clip heard speech.
 * - split: the open clip reached its maximum length during speech, so close it and open the next.
 * - end: the open clip heard CALL_MIC_SILENCE_MS of quiet, or reached its maximum length in quiet.
 * - wait: nothing changes.
 */
export type CallMicStep = "start" | "speech" | "split" | "end" | "wait";

/** Decides when a mic recording clip starts and ends. Create one per recording. */
export function createCallMicSegmenter() {
  let lastCheckAt: number | null = null;
  let quietMs = 0;
  let speechFrames = 0;
  return {
    /**
     * Reads one loudness check. `clipStartedAt` is when the open clip started, or null when none is open.
     * `speechConfirmed` drives the speaking indicator and voice interruptions.
     */
    check(rms: number, now: number, clipStartedAt: number | null): { step: CallMicStep; speechConfirmed: boolean } {
      // Only quiet the mic measured counts. A late check (a hidden, covered or busy tab runs timers as
      // rarely as once a second) counts as at most two checks, so a few quiet samples taken a second
      // apart cannot end a clip in the middle of a sentence.
      const sinceLastCheck =
        lastCheckAt === null
          ? CALL_MIC_VAD_INTERVAL_MS
          : Math.min(Math.max(0, now - lastCheckAt), 2 * CALL_MIC_VAD_INTERVAL_MS);
      lastCheckAt = now;
      const open = clipStartedAt !== null;
      const speaking = rms >= (open ? CALL_MIC_RMS_CONTINUE : CALL_MIC_RMS_START);
      if (speaking) speechFrames += 1;
      else if (!open) speechFrames = 0;
      const speechConfirmed = open ? speaking : speechFrames >= CALL_MIC_CONFIRM_FRAMES;
      quietMs = speaking ? 0 : quietMs + sinceLastCheck;
      const result = (step: CallMicStep) => ({ step, speechConfirmed });

      if (open && now - clipStartedAt >= CALL_MIC_MAX_SEGMENT_MS) {
        if (speaking) speechFrames = CALL_MIC_CONFIRM_FRAMES;
        return result(speaking ? "split" : "end");
      }
      if (speaking) return result(open ? "speech" : "start");
      if (open && quietMs >= CALL_MIC_SILENCE_MS) {
        speechFrames = 0;
        return result("end");
      }
      return result("wait");
    },
  };
}
