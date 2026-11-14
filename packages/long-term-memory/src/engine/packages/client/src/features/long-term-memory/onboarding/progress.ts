// Where setup and the tour stopped, kept in the browser's localStorage. Setup keeps the key the old seven-step
// guide used, so its users are read: "complete" counts as done and "step:N" restarts at beat 1, because the old
// steps do not map to beats. The tour has its own key. Storage that is missing, blocked or throwing reads as
// nothing saved and drops writes, so it can never break the page.

export const LTM_SETUP_PROGRESS_KEY = "marinara-long-term-memory-onboarding-v1";
export const LTM_TOUR_PROGRESS_KEY = "marinara-long-term-memory-tour-v1";
/** The one-time "What's new" dialog: stored once it was shown (or skipped for a new user), so it shows only once. */
export const LTM_WHATS_NEW_KEY = "marinara-long-term-memory-whats-new-v1";
const WHATS_NEW_RELEASE = "1.6";

export type LtmSetupBeat = 1 | 2 | 3 | 4;
/** Setup's saved place: a beat to resume at, or done. Nothing saved reads as null, and setup starts at beat 1. */
export type LtmSetupProgress = LtmSetupBeat | "done";
export type LtmTourStop = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/** The tour's saved stop, or done. */
export type LtmTourProgress = LtmTourStop | "done";

export type LtmProgressStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): LtmProgressStorage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readValue = (storage: LtmProgressStorage | null, key: string): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const writeValue = (storage: LtmProgressStorage | null, key: string, value: string) => {
  try {
    storage?.setItem(key, value);
  } catch {}
};

export function parseSetupProgress(value: string | null): LtmSetupProgress | null {
  if (value === "done" || value === "complete") return "done";
  const beat = /^beat:([1-4])$/u.exec(value ?? "");
  if (beat) return Number(beat[1]) as LtmSetupBeat;
  return value !== null && /^step:\d+$/u.test(value) ? 1 : null;
}

export function parseTourProgress(value: string | null): LtmTourProgress | null {
  if (value === "tour:done") return "done";
  const stop = /^tour:([1-8])$/u.exec(value ?? "");
  return stop ? (Number(stop[1]) as LtmTourStop) : null;
}

export const readSetupProgress = (storage = browserStorage()) =>
  parseSetupProgress(readValue(storage, LTM_SETUP_PROGRESS_KEY));

export const writeSetupProgress = (progress: LtmSetupProgress, storage = browserStorage()) =>
  writeValue(storage, LTM_SETUP_PROGRESS_KEY, progress === "done" ? "done" : `beat:${progress}`);

export const readTourProgress = (storage = browserStorage()) =>
  parseTourProgress(readValue(storage, LTM_TOUR_PROGRESS_KEY));

export const writeTourProgress = (progress: LtmTourProgress, storage = browserStorage()) =>
  writeValue(storage, LTM_TOUR_PROGRESS_KEY, `tour:${progress}`);

export const readWhatsNewSeen = (storage = browserStorage()) =>
  readValue(storage, LTM_WHATS_NEW_KEY) === WHATS_NEW_RELEASE;

export const writeWhatsNewSeen = (storage = browserStorage()) =>
  writeValue(storage, LTM_WHATS_NEW_KEY, WHATS_NEW_RELEASE);
