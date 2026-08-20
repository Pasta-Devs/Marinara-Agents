import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { NoodleAccount, NoodleSettings } from "@marinara-engine/shared";
import { chooseNoodleParticipantAccounts } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-participant-selection";

const account = (id: string, kind: "character" | "random_user" = "character") =>
  ({
    id,
    entityId: id,
    handle: id,
    kind,
    invited: kind === "character",
  }) as NoodleAccount;
const accounts = [account("a"), account("b"), account("c"), account("d")];
const settings = {
  participantSelectionMode: "all",
  participantMin: 1,
  participantMax: 2,
  allowProfessorMari: false,
  allowRandomUsers: false,
} as NoodleSettings;
const select = (overrides: Partial<Parameters<typeof chooseNoodleParticipantAccounts>[0]> = {}) =>
  chooseNoodleParticipantAccounts({
    accounts,
    settings,
    selectedGroupCharacterIds: new Set(),
    random: () => 0,
    ...overrides,
  });

assert.deepEqual(
  select({ accounts: accounts.slice(0, 2) }).map(({ id }) => id),
  ["b", "a"],
  "All mode includes the whole roster when it fits within participantMax",
);
assert.equal(select().length, 2, "All mode caps a large roster at participantMax");
assert.equal(
  select({ settings: { ...settings, participantMin: 4 } as NoodleSettings }).length,
  2,
  "All mode uses participantMax even when a previously saved participantMin is larger",
);
assert.deepEqual(
  select({ recentlyActiveAccountIdsByRun: [new Set(["a", "b"]), new Set(["c", "d"])] }).map(({ id }) => id),
  ["d", "c"],
  "All mode chooses the least recently selected cohort",
);
assert.deepEqual(
  select({ recentlyActiveAccountIdsByRun: [new Set(["c", "d"]), new Set(["a", "b"])] }).map(({ id }) => id),
  ["b", "a"],
  "The next completed run rotates back to the older cohort",
);
assert.deepEqual(
  select({
    priorityAccountIds: new Set(["a"]),
    recentlyActiveAccountIdsByRun: [new Set(["a", "b"]), new Set(["c", "d"])],
  }).map(({ id }) => id),
  ["a", "d"],
  "A priority account gets a slot while another slot continues the rotation",
);
assert.deepEqual(
  select({
    settings: { ...settings, participantMax: 1 } as NoodleSettings,
    priorityAccountIds: new Set(["a"]),
    recentlyActiveAccountIdsByRun: [new Set(["a"]), new Set(["b", "c", "d"])],
  }).map(({ id }) => id),
  ["a"],
  "A priority account wins the only slot when participantMax is one",
);

assert.equal(
  select({ settings: { ...settings, participantSelectionMode: "exact" } as NoodleSettings }).length,
  2,
  "Exact selection keeps using participantMax",
);
assert.equal(
  select({
    settings: {
      ...settings,
      participantSelectionMode: "random_range",
      participantMin: 1,
      participantMax: 3,
    } as NoodleSettings,
  }).length,
  1,
  "Random-range selection keeps using the sampled min/max range",
);

const generation = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-public-generation.service.ts",
  "utf8",
);
assert.match(
  generation,
  /listCompletedRefreshRunAccountIds\(settings\.participantSelectionMode === "all" \? 100 : 1\)/u,
  "All mode reads sufficient projected completed-run history for rotation",
);
const storage = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/storage/noodle.storage.ts",
  "utf8",
);
assert.match(
  storage,
  /listCompletedRefreshRunAccountIds[\s\S]*?select\(\{ activeAccountIds: noodleRefreshRuns\.activeAccountIds \}\)[\s\S]*?status, "completed"/u,
  "Rotation history fetches only active account IDs from completed runs",
);
assert.match(generation, /Return at least one activity permitted by the configured quotas/u);
assert.match(generation, /\[\] and an object whose activity collections are all empty are invalid/u);
assert.match(generation, /returned no timeline activity twice[\s\S]*No timeline changes were saved/u);
assert.ok(
  generation.indexOf("returned no timeline activity twice") < generation.indexOf("commitGeneratedNoodleActivity({"),
  "Two empty responses fail before timeline activity can be committed",
);

const home = readFileSync("packages/noodle/src/engine/packages/client/src/components/noodle/NoodleHome.tsx", "utf8");
assert.match(home, /participantSelectionMode === "all"[\s\S]*?accountsPerRefresh[\s\S]*?participantMax/u);
assert.match(home, /action:\s*\{[\s\S]*?capabilities\.actions\.tryAgain[\s\S]*?onClick: triggerRefresh/u);

console.log("Noodle All-invited reliability regressions passed.");
