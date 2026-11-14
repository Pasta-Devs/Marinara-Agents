import assert from "node:assert/strict";

import {
  LTM_SETUP_PROGRESS_KEY,
  LTM_TOUR_PROGRESS_KEY,
  LTM_WHATS_NEW_KEY,
  parseSetupProgress,
  parseTourProgress,
  readSetupProgress,
  readTourProgress,
  readWhatsNewSeen,
  writeSetupProgress,
  writeTourProgress,
  writeWhatsNewSeen,
  type LtmProgressStorage,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/onboarding/progress.js";

const memoryStorage = (entries: Record<string, string> = {}) => {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } satisfies LtmProgressStorage & { values: Map<string, string> };
};

// Existing users are read from the old guide's key: finished stays finished, an old step restarts at beat 1.
assert.equal(LTM_SETUP_PROGRESS_KEY, "marinara-long-term-memory-onboarding-v1", "setup keeps the old key");
assert.equal(parseSetupProgress("complete"), "done", "finishing the old guide counts as done");
for (const step of ["step:0", "step:3", "step:6", "step:12"]) {
  assert.equal(parseSetupProgress(step), 1, `${step} restarts at beat 1`);
}
assert.equal(parseSetupProgress("done"), "done");
for (const beat of [1, 2, 3, 4] as const) assert.equal(parseSetupProgress(`beat:${beat}`), beat);
for (const value of [null, "", "beat:0", "beat:5", "step:", "step:-1", "Complete", "tour:2"]) {
  assert.equal(parseSetupProgress(value), null, `${JSON.stringify(value)} reads as nothing saved`);
}

// Writes use the new values, and reads round-trip them.
const storage = memoryStorage({ [LTM_SETUP_PROGRESS_KEY]: "step:4" });
assert.equal(readSetupProgress(storage), 1);
writeSetupProgress(3, storage);
assert.equal(storage.values.get(LTM_SETUP_PROGRESS_KEY), "beat:3");
assert.equal(readSetupProgress(storage), 3);
writeSetupProgress("done", storage);
assert.equal(storage.values.get(LTM_SETUP_PROGRESS_KEY), "done");
assert.equal(readSetupProgress(storage), "done");

// The tour has its own key, so its progress never moves setup's and the reverse.
assert.notEqual(LTM_TOUR_PROGRESS_KEY, LTM_SETUP_PROGRESS_KEY);
const shared = memoryStorage();
writeSetupProgress(2, shared);
assert.equal(readTourProgress(shared), null, "setup progress is not tour progress");
writeTourProgress(5, shared);
assert.equal(shared.values.get(LTM_TOUR_PROGRESS_KEY), "tour:5");
assert.equal(readTourProgress(shared), 5);
assert.equal(readSetupProgress(shared), 2, "tour progress leaves setup where it was");
writeTourProgress("done", shared);
assert.equal(shared.values.get(LTM_TOUR_PROGRESS_KEY), "tour:done");
assert.equal(readTourProgress(shared), "done");
assert.equal(readSetupProgress(shared), 2);
for (const value of [null, "", "tour:0", "tour:9", "done", "beat:2"]) {
  assert.equal(parseTourProgress(value), null, `${JSON.stringify(value)} is no tour progress`);
}

// "What's new" is seen only once the 1.6 value is stored; it has its own key and leaves setup and the tour alone.
assert.equal(LTM_WHATS_NEW_KEY, "marinara-long-term-memory-whats-new-v1");
const news = memoryStorage({ [LTM_WHATS_NEW_KEY]: "1.5" });
assert.equal(readWhatsNewSeen(news), false, "an older value is not 1.6");
assert.equal(readWhatsNewSeen(memoryStorage()), false);
writeWhatsNewSeen(news);
assert.equal(news.values.get(LTM_WHATS_NEW_KEY), "1.6");
assert.equal(readWhatsNewSeen(news), true);
assert.equal(readSetupProgress(news), null);
assert.equal(readTourProgress(news), null);

// Missing, blocked or throwing storage reads as nothing saved (setup starts at beat 1) and drops writes quietly.
const throwing: LtmProgressStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};
for (const blocked of [throwing, null]) {
  assert.equal(readSetupProgress(blocked), null);
  assert.equal(readTourProgress(blocked), null);
  assert.doesNotThrow(() => writeSetupProgress(2, blocked));
  assert.doesNotThrow(() => writeTourProgress(3, blocked));
  assert.equal(readWhatsNewSeen(blocked), false);
  assert.doesNotThrow(() => writeWhatsNewSeen(blocked));
}
// Node has no localStorage, and a page whose localStorage getter throws must not crash either.
assert.equal(readSetupProgress(), null);
assert.doesNotThrow(() => writeSetupProgress("done"));
const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  get() {
    throw new Error("SecurityError");
  },
});
try {
  assert.equal(readSetupProgress(), null);
  assert.equal(readTourProgress(), null);
  assert.doesNotThrow(() => writeTourProgress(1));
  assert.equal(readWhatsNewSeen(), false);
  assert.doesNotThrow(() => writeWhatsNewSeen());
} finally {
  if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
}

console.log("long-term-memory onboarding progress regression OK");
