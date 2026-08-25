import {
  extractNoodleMentionHandles,
  PROFESSOR_MARI_ID,
  type NoodleAccount,
  type NoodleInteraction,
  type NoodlePost,
  type NoodleSettings,
} from "@marinara-engine/shared";

type RandomSource = () => number;

function shuffleWith<T>(items: readonly T[], random: RandomSource): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const raw = random();
    const normalized = Number.isFinite(raw) ? Math.min(0.999_999, Math.max(0, raw)) : 0.5;
    const selected = Math.floor(normalized * (index + 1));
    [next[index], next[selected]] = [next[selected]!, next[index]!];
  }
  return next;
}

export function collectNoodlePriorityAccountIds(input: {
  accounts: NoodleAccount[];
  posts: NoodlePost[];
  interactions: NoodleInteraction[];
  personaAccount: NoodleAccount | null;
}): Set<string> {
  const priority = new Set<string>();
  if (!input.personaAccount) return priority;
  const accountByHandle = new Map(input.accounts.map((account) => [account.handle.toLowerCase(), account]));
  const interactionById = new Map(input.interactions.map((interaction) => [interaction.id, interaction]));
  const addMentionedAccounts = (content: string | null | undefined) => {
    for (const handle of extractNoodleMentionHandles(content ?? "")) {
      const account = accountByHandle.get(handle);
      if (account && account.kind !== "persona") priority.add(account.id);
    }
  };

  for (const post of input.posts) {
    if (post.authorAccountId === input.personaAccount.id) addMentionedAccounts(post.content);
  }
  for (const interaction of input.interactions) {
    if (interaction.actorAccountId === input.personaAccount.id) {
      addMentionedAccounts(interaction.content);
      const post = input.posts.find((candidate) => candidate.id === interaction.postId);
      if (post && post.authorAccountId !== input.personaAccount.id) priority.add(post.authorAccountId);
      const parent = interaction.parentInteractionId ? interactionById.get(interaction.parentInteractionId) : null;
      if (parent && parent.actorAccountId !== input.personaAccount.id) priority.add(parent.actorAccountId);
      continue;
    }
    if (extractNoodleMentionHandles(interaction.content ?? "").includes(input.personaAccount.handle.toLowerCase())) {
      priority.add(interaction.actorAccountId);
    }
  }
  return priority;
}

export function chooseNoodleParticipantAccounts(input: {
  accounts: NoodleAccount[];
  settings: NoodleSettings;
  selectedGroupCharacterIds: ReadonlySet<string>;
  followedAccountIds?: ReadonlySet<string>;
  recentlyActiveAccountIds?: ReadonlySet<string>;
  recentlyActiveAccountIdsByRun?: readonly ReadonlySet<string>[];
  priorityAccountIds?: ReadonlySet<string>;
  random?: RandomSource;
}): NoodleAccount[] {
  const random = input.random ?? Math.random;
  const followedAccountIds = input.followedAccountIds ?? new Set<string>();
  const recentlyActiveAccountIds = input.recentlyActiveAccountIds ?? new Set<string>();
  const priorityAccountIds = input.priorityAccountIds ?? new Set<string>();
  const candidates = input.accounts.filter((account) => {
    if (account.kind === "character") {
      if (account.entityId === PROFESSOR_MARI_ID && !input.settings.allowProfessorMari) return false;
      return account.invited || input.selectedGroupCharacterIds.has(account.entityId);
    }
    return account.kind === "random_user" && input.settings.allowRandomUsers;
  });
  const min = Math.min(input.settings.participantMin, input.settings.participantMax, candidates.length);
  const max = Math.min(Math.max(input.settings.participantMin, input.settings.participantMax), candidates.length);
  const count =
    input.settings.participantSelectionMode === "all"
      ? Math.min(input.settings.participantMax, candidates.length)
      : input.settings.participantSelectionMode === "exact"
        ? max
        : min + Math.floor(random() * Math.max(1, max - min + 1));

  const orderedForAll = (pool: NoodleAccount[]) => {
    const lastActiveRun = new Map<string, number>();
    input.recentlyActiveAccountIdsByRun?.forEach((accountIds, runIndex) => {
      for (const accountId of accountIds) {
        if (!lastActiveRun.has(accountId)) lastActiveRun.set(accountId, runIndex);
      }
    });
    const byAge = (accounts: NoodleAccount[]) => {
      const groups = new Map<number, NoodleAccount[]>();
      for (const account of accounts) {
        const age = lastActiveRun.get(account.id) ?? Number.POSITIVE_INFINITY;
        groups.set(age, [...(groups.get(age) ?? []), account]);
      }
      return [...groups.entries()]
        .sort(([left], [right]) => right - left)
        .flatMap(([, accounts]) => shuffleWith(accounts, random));
    };
    const priority = byAge(pool.filter((account) => priorityAccountIds.has(account.id)));
    const ordinary = byAge(pool.filter((account) => !priorityAccountIds.has(account.id)));
    if (priority.length === 0 || ordinary.length === 0) return byAge(pool);
    if (count === 1) return priority;

    // Keep current persona activity responsive without letting a permanently-priority account
    // consume the whole cohort forever. At least one character slot continues the rotation.
    const prioritySlots = Math.min(priority.length, count - 1);
    return [...priority.slice(0, prioritySlots), ...ordinary, ...priority.slice(prioritySlots)];
  };

  const ordered = (pool: NoodleAccount[]) => {
    const priority = pool.filter((account) => priorityAccountIds.has(account.id));
    const ordinary = pool.filter((account) => !priorityAccountIds.has(account.id));
    const inactiveFollowed = ordinary.filter(
      (account) => followedAccountIds.has(account.id) && !recentlyActiveAccountIds.has(account.id),
    );
    const inactiveOthers = ordinary.filter(
      (account) => !followedAccountIds.has(account.id) && !recentlyActiveAccountIds.has(account.id),
    );
    const recent = ordinary.filter((account) => recentlyActiveAccountIds.has(account.id));
    return [
      ...shuffleWith(priority, random),
      ...shuffleWith(inactiveOthers, random),
      ...shuffleWith(inactiveFollowed, random),
      ...shuffleWith(recent, random),
    ];
  };

  const order = input.settings.participantSelectionMode === "all" ? orderedForAll : ordered;
  const characters = order(candidates.filter((account) => account.kind === "character"));
  const randomUsers = order(candidates.filter((account) => account.kind === "random_user"));
  if (characters.length === 0) return randomUsers.slice(0, count);

  // Random users are supporting cast: include at most one in a minority of
  // refreshes, while leaving the remaining participant slots to characters.
  const includeRandomUser = randomUsers.length > 0 && count > 1 && random() < 0.25;
  const characterCount = Math.max(1, count - (includeRandomUser ? 1 : 0));
  const selected = characters.slice(0, characterCount);
  if (includeRandomUser) selected.push(randomUsers[0]!);
  if (selected.length < count) {
    selected.push(...characters.slice(characterCount, characterCount + (count - selected.length)));
  }
  if (selected.length < count) {
    const randomStart = includeRandomUser ? 1 : 0;
    selected.push(...randomUsers.slice(randomStart, randomStart + (count - selected.length)));
  }
  return selected.slice(0, count);
}
