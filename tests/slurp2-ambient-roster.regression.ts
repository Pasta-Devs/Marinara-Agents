import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AMBIENT_NOODLE_PROFILES,
  dismissAmbientNoodleAccount,
  ensureAmbientNoodleAccounts,
  withoutHiddenAmbientAccounts,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-ambient-profiles.js";

// In-memory stand-in for the slurp storage methods the seeder uses. Existing rows are never
// overwritten by upsert, matching upsertAccountFromProfile.
type Row = {
  id: string;
  kind: "random_user";
  entityId: string;
  handle: string;
  displayName: string;
  bio: string;
  settings: { profile: { profileManuallyEdited?: boolean } };
};
function fakeStorage() {
  const rows = new Map<string, Row>();
  let settings = { dismissedAmbientProfileIds: [] as string[] };
  const store = {
    rows,
    getSettings: async () => settings,
    updateSettings: async (input: Partial<typeof settings>) => (settings = { ...settings, ...input }),
    listAccounts: async () => [...rows.values()],
    getSlurpAccountForEntity: async (_kind: string, entityId: string) => rows.get(entityId) ?? null,
    deleteAccountByEntity: async (_kind: string, entityId: string) => {
      const row = rows.get(entityId) ?? null;
      rows.delete(entityId);
      return row;
    },
    updateAccount: async (id: string, input: Partial<Row>) => {
      const row = [...rows.values()].find((entry) => entry.id === id);
      if (!row) return null;
      Object.assign(row, input);
      return row;
    },
    upsertAccountFromProfile: async (input: { entityId: string; displayName: string; bio: string }) => {
      const existing = rows.get(input.entityId);
      if (existing) return existing;
      const row: Row = {
        id: `acct-${input.entityId}`,
        kind: "random_user",
        entityId: input.entityId,
        handle: input.displayName.toLowerCase(),
        displayName: input.displayName,
        bio: input.bio,
        settings: { profile: {} },
      };
      rows.set(input.entityId, row);
      return row;
    },
  };
  return store;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seed = (store: ReturnType<typeof fakeStorage>) => ensureAmbientNoodleAccounts(store as any, true);

const [first, second, third] = AMBIENT_NOODLE_PROFILES;

async function main() {
  // ── Legacy roster is renamed in place, not duplicated ───────────────────────
  {
    const store = fakeStorage();
    store.rows.set(first.entityId, {
      id: "legacy-1",
      kind: "random_user",
      entityId: first.entityId,
      handle: "thread_countess",
      displayName: first.legacyName,
      bio: first.legacyBio,
      settings: { profile: {} },
    });
    await seed(store);
    const row = store.rows.get(first.entityId)!;
    assert.equal(row.id, "legacy-1");
    assert.equal(row.displayName, first.displayName);
    assert.equal(row.bio, first.bio);
    assert.equal(store.rows.size, AMBIENT_NOODLE_PROFILES.length);
  }

  // ── No carried-over names or Noodle text in the roster ──────────────────────
  for (const profile of AMBIENT_NOODLE_PROFILES) {
    assert.doesNotMatch(`${profile.displayName} ${profile.bio}`, /noodle/iu);
    assert.notEqual(profile.displayName, profile.legacyName);
  }
  assert.doesNotMatch(
    readFileSync(
      "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-ambient-profile-generation.service.ts",
      "utf8",
    ),
    /called Noodle/u,
  );

  // ── Edits and rerolls survive the next seed ─────────────────────────────────
  {
    const store = fakeStorage();
    await seed(store);
    Object.assign(store.rows.get(first.entityId)!, { displayName: "My Edit", bio: "mine" });
    // Kept the legacy name but edited the bio: the manual-edit flag must still win.
    Object.assign(store.rows.get(second.entityId)!, {
      displayName: second.legacyName,
      bio: "edited",
      settings: { profile: { profileManuallyEdited: true } },
    });
    await seed(store);
    assert.equal(store.rows.get(first.entityId)!.displayName, "My Edit");
    assert.equal(store.rows.get(first.entityId)!.bio, "mine");
    assert.equal(store.rows.get(second.entityId)!.displayName, second.legacyName);
    assert.equal(store.rows.get(second.entityId)!.bio, "edited");
  }

  // ── A deleted account is not recreated ──────────────────────────────────────
  {
    const store = fakeStorage();
    await seed(store);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await dismissAmbientNoodleAccount(store as any, third.entityId);
    store.rows.delete(third.entityId);
    const accounts = await seed(store);
    assert.equal(store.rows.has(third.entityId), false);
    assert.equal(accounts.length, AMBIENT_NOODLE_PROFILES.length - 1);
  }

  // ── Switching off hides the roster; switching on again keeps edits ──────────
  {
    const store = fakeStorage();
    await seed(store);
    Object.assign(store.rows.get(first.entityId)!, {
      displayName: "Kept Edit",
      bio: "kept",
      settings: { profile: { profileManuallyEdited: true } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const offAccounts = await ensureAmbientNoodleAccounts(store as any, false);
    assert.equal(store.rows.size, AMBIENT_NOODLE_PROFILES.length);
    assert.equal(offAccounts.length, AMBIENT_NOODLE_PROFILES.length, "settings panel still lists them");
    await seed(store);
    assert.equal(store.rows.size, AMBIENT_NOODLE_PROFILES.length);
    assert.equal(store.rows.get(first.entityId)!.displayName, "Kept Edit");
    assert.equal(store.rows.get(first.entityId)!.bio, "kept");

    const creator = { kind: "character" as const, entityId: "char-1" };
    const fan = { kind: "random_user" as const, entityId: "fan:generated" };
    const listed = [creator, fan, ...store.rows.values()];
    assert.deepEqual(withoutHiddenAmbientAccounts(listed, false), [creator, fan]);
    assert.equal(withoutHiddenAmbientAccounts(listed, true).length, listed.length);
  }

  // ── Switched off, nothing is seeded ─────────────────────────────────────────
  {
    const store = fakeStorage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.deepEqual(await ensureAmbientNoodleAccounts(store as any, false), []);
    assert.equal(store.rows.size, 0);
  }

  console.log("slurp2 ambient roster regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
