import type { NoodleAccount } from "@marinara-engine/shared";
import type { createSlurpStorage } from "../storage/slurp.storage.js";

/**
 * Seed copy for the ambient roster. The entity ids are the stable Engine ids
 * (AMBIENT_NOODLE_ENTITY_IDS); `legacyName`/`legacyBio` are the old carried-over copy, renamed in place.
 */
export const AMBIENT_NOODLE_PROFILES = [
  {
    entityId: "random_user:thread-countess",
    displayName: "Velvet Tab",
    bio: "Keeps a running tab of every creator she backs and tips like it is a competitive sport.",
    legacyName: "Thread Countess",
    legacyBio: "Chronically online textile hobbyist who treats every Noodle argument like court gossip.",
  },
  {
    entityId: "random_user:packet-soup",
    displayName: "Midnight Refresh",
    bio: "Refreshes the feed at 2am, saves favourite posts, and hypes new drops quietly.",
    legacyName: "Packet Soup",
    legacyBio: "Friendly lurker, recipe collector, and accidental drama amplifier.",
  },
  {
    entityId: "random_user:orbit-notice",
    displayName: "Lurk Supreme",
    bio: "Reads everything, comments rarely, and likes posts faster than anyone alive.",
    legacyName: "Orbit Notice",
    legacyBio: "Posts vague observations, likes too quickly, and follows anyone with interesting chaos.",
  },
  {
    entityId: "random_user:glass-bulletin",
    displayName: "Tip Jar Tessa",
    bio: "Friendly regular who knows every creator's posting schedule and reminds everyone else.",
    legacyName: "Glass Bulletin",
    legacyBio: "Local rumor account with polished manners and questionable sources.",
  },
  {
    entityId: "random_user:moth-hour",
    displayName: "Afterglow",
    bio: "Late-night commenter with warm replies and oddly specific compliments.",
    legacyName: "Moth Hour",
    legacyBio: "Night-scroller who replies with eerie encouragement and niche memes.",
  },
  {
    entityId: "random_user:brine-index",
    displayName: "Receipt Ranker",
    bio: "Ranks creators in a private spreadsheet and defends the rankings loudly.",
    legacyName: "Brine Index",
    legacyBio: "Overconfident commentator who keeps a spreadsheet of everyone else's scandals.",
  },
] as const;

const AMBIENT_NOODLE_ENTITY_ID_SET = new Set<string>(AMBIENT_NOODLE_PROFILES.map((profile) => profile.entityId));
let ambientSeedQueue: Promise<void> = Promise.resolve();

export function isAmbientNoodleAccount(account: Pick<NoodleAccount, "kind" | "entityId">): boolean {
  return account.kind === "random_user" && AMBIENT_NOODLE_ENTITY_ID_SET.has(account.entityId);
}

type AmbientSeedStorage = Pick<
  ReturnType<typeof createSlurpStorage>,
  | "getSettings"
  | "updateSettings"
  | "listAccounts"
  | "deleteAccountByEntity"
  | "getSlurpAccountForEntity"
  | "updateAccount"
  | "upsertAccountFromProfile"
>;

/** Remember a deleted ambient account so the seeder leaves it deleted. */
export async function dismissAmbientNoodleAccount(noodle: AmbientSeedStorage, entityId: string): Promise<void> {
  const settings = await noodle.getSettings();
  if (settings.dismissedAmbientProfileIds.includes(entityId)) return;
  await noodle.updateSettings({ dismissedAmbientProfileIds: [...settings.dismissedAmbientProfileIds, entityId] });
}

export async function ensureAmbientNoodleAccounts(noodle: AmbientSeedStorage, invited: boolean): Promise<NoodleAccount[]> {
  if (!invited) {
    const staleAmbient = (await noodle.listAccounts()).filter(isAmbientNoodleAccount);
    for (const account of staleAmbient) await noodle.deleteAccountByEntity("random_user", account.entityId);
    return [];
  }
  let resolveTurn!: () => void;
  const previousTurn = ambientSeedQueue;
  ambientSeedQueue = new Promise<void>((resolve) => {
    resolveTurn = resolve;
  });
  await previousTurn;
  const accounts: NoodleAccount[] = [];
  try {
    const dismissed = new Set((await noodle.getSettings()).dismissedAmbientProfileIds);
    for (const { legacyName, legacyBio, ...profile } of AMBIENT_NOODLE_PROFILES) {
      if (dismissed.has(profile.entityId)) continue;
      const existing = await noodle.getSlurpAccountForEntity("random_user", profile.entityId);
      // Only untouched legacy copy is renamed; an edited or rerolled account no longer carries the legacy name.
      if (existing && existing.displayName === legacyName && existing.settings.profile.profileManuallyEdited !== true) {
        const rename = {
          displayName: profile.displayName,
          ...((existing.bio === legacyBio || !existing.bio.trim()) && { bio: profile.bio }),
        };
        const renamed =
          (await noodle.updateAccount(existing.id, { ...rename, handle: profile.displayName }).catch(() => null)) ??
          (await noodle.updateAccount(existing.id, rename));
        if (renamed) {
          accounts.push(renamed);
          continue;
        }
      }
      accounts.push(await noodle.upsertAccountFromProfile({ kind: "random_user", ...profile, invited }));
    }
    return accounts;
  } finally {
    resolveTurn();
  }
}
