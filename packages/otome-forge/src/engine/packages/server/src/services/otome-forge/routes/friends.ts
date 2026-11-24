// ──────────────────────────────────────────────
// Otome Hearth: friends (#2458) routes
// ──────────────────────────────────────────────
// GET  /runs/:run/friends/met                                   → {met: [{key, name, cardId?}], block}: the people she
//      has met who could become her friend, newest first, and why none may join now (SH/friends.ts friendBlock)
// POST /runs/:run/friends {source: "met"|"card"|"new", …}        → {friend: {id, name}}: writes one friend (S/story/
//      friends.ts addFriend), in the run's foreground queue so two taps write one. 409 `conflict` when none may join.
import { z } from "zod";
import { friendBlock } from "../../../../../client/src/features/otome-forge/shared/friends.js";
import { runForeground } from "../generation.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type RegisterRoutes } from "../http.js";
import { sideCastId } from "../ids.js";
import { normalizeSideCast } from "../schemas/side-cast.js";
import { readRun } from "../schemas/state.js";
import { addFriend, currentArc, metPeople } from "../story/friends.js";

const Pronouns = z.object({
  subject: z.string().trim().min(1).max(20),
  object: z.string().trim().min(1).max(20),
  possessive: z.string().trim().min(1).max(20),
});
const FriendBody = z.union([
  z.object({
    source: z.literal("met"),
    key: z.string().min(1).max(200),
    pronouns: Pronouns,
    cardId: z.string().min(1).max(200).optional(),
  }),
  z.object({ source: z.literal("card"), cardId: z.string().min(1).max(200), pronouns: Pronouns }),
  z.object({
    source: z.literal("new"),
    name: z.string().trim().min(1).max(80),
    pronouns: Pronouns,
    notes: z.string().max(500).optional(),
  }),
]);

export const registerFriendRoutes: RegisterRoutes = (router, deps) => {
  const { store, handle } = deps;

  router.get(
    "/runs/:run/friends/met",
    handle(async (request) => {
      const { runId } = runParam(request);
      const run = await readRun(store, runId);
      if (!run) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
      const sides = await store.readDoc(sideCastId(runId), normalizeSideCast);
      const taken = { player: run.player, units: [...run.units, ...(run.friends ?? [])] };
      return {
        met: metPeople(sides?.people ?? {}, taken).map((person) => ({
          key: person.key,
          name: person.name,
          ...(person.cardId ? { cardId: person.cardId } : {}),
        })),
        block: friendBlock(run.units.length, Object.values(run.state.friends), await currentArc(store, runId)),
      };
    }),
  );

  router.post(
    "/runs/:run/friends",
    handle(async (request) => {
      const body = parseBody(FriendBody, request.body);
      const { runId } = runParam(request);
      const debugMode = debugModeOf(request);
      const friend = await runForeground(runId, () => addFriend(deps, runId, body, { debugMode }));
      return { friend };
    }),
  );
};
