// ──────────────────────────────────────────────
// Otome Hearth: her friends write first, and ask her to hang out (#2458), Settings → Connections' two weekly numbers
// (world.friendMessages and world.friendInvites, 0 to DATE_INVITES_MAX; absent or 0, the default, is off)
// ──────────────────────────────────────────────
// The heartbeat (POST /runs/:run/phone/due) answers for both, by the date invitations' rule (S/phone/invite.ts and
// S/phone/daily.ts dailyDecision with `week`): a quota per local week from Monday (world.friendWeekly and
// world.friendInviteWeekly), attempts spread over the week (or over the number of friends, if that is smaller), each
// spent before any provider work and never retried. The limit counts friends: one who wrote this week is not picked
// again until the next.
// - Who may write: a friend whose grievance with her does not stand, whose thread is not open or busy and does not end
//   on her unanswered message; to ask her to hang out, also with no invitation of theirs still waiting.
// - The job (the background lane, on the Messages connection) writes P17 as that friend, first (S/phone/chat.ts
//   writeFirstMessage): a plain message, or (reason "hangout") one asking her to hang out, whose last message carries
//   the invitation (`invite.kind` "hangout"). She accepts it from Messages, where she chooses what to wear, which opens
//   the hangout with them, they choosing the place (POST /runs/:run/hangouts), or declines it.
import { forgeChatReplyBusy } from "@forge-kit/chat-continuity-server.mjs";
import { forgeWeekKey } from "@forge-kit/time-zone-server.mjs";
import type {
  LiId,
  PhoneDueResult,
  PhoneMessage,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { friendHeld } from "../../../../../client/src/features/otome-forge/shared/friends.js";
import { resolveConnectionId } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, worldId } from "../ids.js";
import { readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import { emptyThread, inThreadLock, inviteWaiting, openMessages, readThread, writeFirstMessage } from "./chat.js";
import { dailyDecision, noteOpenThread, openThread, type DailyDecision, type DailyDeps } from "./daily.js";

/** The two weekly things her friends do on their own. */
type FriendWeekly = "message" | "hangout";

const QUOTA = { message: "friendWeekly", hangout: "friendInviteWeekly" } as const;
const LIMIT = { message: "friendMessages", hangout: "friendInvites" } as const;

/** Each run's last heartbeat for each, and the runs whose heartbeat is being answered. */
const heartbeats = new Map<string, number>();
const answering = new Set<string>();

export const friendJobKey = (runId: string, kind: FriendWeekly) => `${runId}:friend-${kind}`;

/** The friends who may write now (see the header), in the order they joined. */
async function candidates(
  deps: Pick<DailyDeps, "store">,
  runId: string,
  run: RunDocuments,
  kind: FriendWeekly,
  wrote: readonly LiId[] = [],
): Promise<LiId[]> {
  if (run.world.forge.phase !== "ready" || run.state.ended) return [];
  const open = openThread(runId);
  const ids = (run.friends ?? [])
    .map((unit) => unit.id)
    .filter(
      (id) =>
        id !== open && !wrote.includes(id) && !forgeChatReplyBusy(runId, id) && !friendHeld(run.state.friends[id]),
    );
  const free = await Promise.all(
    ids.map(async (id) => {
      const thread = (await readThread(deps.store, runId, id)) ?? emptyThread(id);
      return openMessages(thread).at(-1)?.who !== "player" && (kind === "message" || !inviteWaiting(thread));
    }),
  );
  return ids.filter((_, index) => free[index]);
}

/** One heartbeat for `kind` (see the header): it may spend this week's next attempt and queue its job. */
export async function friendDue(
  deps: DailyDeps,
  runId: string,
  kind: FriendWeekly,
  {
    open,
    debugMode = false,
    now = Date.now(),
    random = Math.random,
  }: { open?: LiId | null; debugMode?: boolean; now?: number; random?: () => number } = {},
): Promise<NonNullable<PhoneDueResult["friend"]>> {
  if (open !== undefined) noteOpenThread(runId, open);
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
  const latest = run.world[QUOTA[kind]]?.last ?? null;
  const result = (status: PhoneDueResult["status"]) => ({ status, latest });
  const limit = run.world[LIMIT[kind]] ?? 0;
  const { background } = deps;
  if (!limit || !background || run.state.ended) return result("disabled");
  const connectionId = resolveConnectionId(run.world, "chat");
  if (!connectionId) return result("no-connection");
  const key = friendJobKey(runId, kind);
  const beat = `${runId}|${kind}`;
  if (answering.has(beat) || background.has(key)) return result("busy");
  answering.add(beat);
  try {
    const week = forgeWeekKey(now);
    const free = await candidates(deps, runId, run, kind, run.world[QUOTA[kind]]?.days[week]?.wrote);
    if (!free.length) return result("no-eligible");
    const seen = heartbeats.get(beat);
    heartbeats.set(beat, now);
    const spread = (setting: number) => Math.min(setting, (run.friends ?? []).length);
    const first = dailyDecision(run.world[QUOTA[kind]], { now, seen, limit: spread(limit), week: true });
    if (!("next" in first)) return result(first.status);
    let decided: DailyDecision = first;
    const saved = await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
      decided = dailyDecision(current[QUOTA[kind]], {
        now,
        seen,
        limit: spread(current[LIMIT[kind]] ?? 0),
        week: true,
      });
      return "next" in decided ? { ...current, [QUOTA[kind]]: decided.next } : current;
    });
    if (!saved) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
    if (decided.status !== "queued") return result(decided.status);
    const order = [...free].sort(() => random() - 0.5);
    background.ensure({
      key,
      connectionId,
      run: () => writeFriendFirst(deps, runId, kind, order, { connectionId, debugMode, week }),
    });
    return result("queued");
  } finally {
    answering.delete(beat);
  }
}

/** The job: the first friend still free writes; one attempt pays for one message at most. */
async function writeFriendFirst(
  deps: DailyDeps,
  runId: string,
  kind: FriendWeekly,
  order: readonly LiId[],
  { connectionId, debugMode, week }: { connectionId: string; debugMode: boolean; week: string },
): Promise<void> {
  for (const id of order) {
    if (openThread(runId) === id || forgeChatReplyBusy(runId, id)) continue;
    let sent: PhoneMessage[] | null;
    try {
      sent = await inThreadLock(runId, id, () =>
        writeFirstMessage(deps, runId, id, {
          connectionId,
          debugMode,
          ...(kind === "hangout" ? { reason: "hangout" as const } : {}),
        }),
      );
    } catch (error) {
      if (error instanceof OtomeForgeError && (error.code === "busy" || error.code === "locked")) continue;
      if (error instanceof OtomeForgeError && error.code === "conflict") {
        deps.runtime.logger.info("[otome-forge] A message from %s was dropped: %s", id, error.message);
        return;
      }
      throw error;
    }
    if (!sent?.length) continue;
    const at = sent.at(-1)!.at;
    await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
      const quota = current[QUOTA[kind]];
      const weeks = quota?.days ?? {};
      const thisWeek = weeks[week] ?? { attempts: 1 };
      const wrote = [...new Set([...(thisWeek.wrote ?? []), id])];
      return {
        ...current,
        [QUOTA[kind]]: { ...quota, days: { ...weeks, [week]: { ...thisWeek, wrote } }, last: { li: id, at } },
      };
    });
    return;
  }
}
