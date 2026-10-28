import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  markNoodleIntroSeen,
  NOODLE_INTRO_SEEN_KEY,
  noodleIntroSeen,
} from "../packages/noodle/src/engine/packages/client/src/components/noodle/noodle-intro-storage";

const root = "packages/noodle/src/engine/packages/client/src";

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
};
Object.defineProperty(globalThis, "localStorage", { value: fakeStorage, configurable: true });

assert.equal(noodleIntroSeen(), false, "a first visit must see the explainer");
markNoodleIntroSeen();
assert.equal(store.get(NOODLE_INTRO_SEEN_KEY), "true");
assert.equal(noodleIntroSeen(), true, "the explainer must not return on the next visit");

// Private browsing refuses storage; the timeline must still open.
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: () => {
      throw new Error("storage refused");
    },
    setItem: () => {
      throw new Error("storage refused");
    },
  },
  configurable: true,
});
assert.equal(noodleIntroSeen(), false);
assert.doesNotThrow(() => markNoodleIntroSeen());

const home = readFileSync(`${root}/components/noodle/NoodleHome.tsx`, "utf8");
assert.match(home, /<NoodleIntroDialog open=\{introOpen\} onClose=\{dismissIntro\} \/>/u);

const english = JSON.parse(readFileSync(`${root}/localization/locales/en.json`, "utf8")) as Record<string, string>;
for (const key of [
  "ui.noodle.noodleintro.title",
  "ui.noodle.noodleintro.lead",
  "ui.noodle.noodleintro.start",
  ...["cast", "refresh", "local"].flatMap((point) => [
    `ui.noodle.noodleintro.${point}.title`,
    `ui.noodle.noodleintro.${point}.detail`,
  ]),
]) {
  assert.equal(typeof english[key], "string", `the intro is missing the English string ${key}`);
}

console.log("Noodle intro dialog regressions passed.");
