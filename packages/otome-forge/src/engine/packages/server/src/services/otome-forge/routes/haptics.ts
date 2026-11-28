// ──────────────────────────────────────────────
// Otome Hearth: the haptics routes (0.34.0), over S/haptics.ts
// ──────────────────────────────────────────────
// GET  /runs/:run/haptics               → {haptics}: the Engine's Intiface connection, the connected toys, the loop
// POST /runs/:run/haptics/connect {url?} → {haptics}: connect (the story's address, or the Engine's); a failure says why
// POST /runs/:run/haptics/test           → {results}: every connected toy pulses at full strength for two seconds
// POST /runs/:run/haptics/play {cues}    → {}: the loop plays these cues from now on (409 while haptics are off here)
// POST /runs/:run/haptics/keep           → {kept}: the client's line or message is still on screen (S/haptics.ts)
// POST /runs/:run/haptics/stop           → {}: the loop ends and every toy stops, whatever the story's settings
// Connect and test work while the setting is off, so the player can set the toys up before turning it on.
import { z } from "zod";
import {
  hapticsOn,
  isHapticsUrl,
  normalizeHapticCues,
} from "../../../../../client/src/features/otome-forge/shared/haptics.js";
import { OtomeForgeError, parseBody, runParam, type RegisterRoutes } from "../http.js";
import { worldId } from "../ids.js";
import { normalizeWorld } from "../schemas/world.js";

const NoFields = z.object({});
const ConnectBody = z.object({ url: z.string().max(300).optional() });
const PlayBody = z.object({ cues: z.unknown() });

export const registerHapticsRoutes: RegisterRoutes = (router, { store, handle, haptics }) => {
  const toys = () => {
    if (!haptics) throw new OtomeForgeError(404, "Haptics are not running.", "not-found");
    return haptics;
  };

  router.get(
    "/runs/:run/haptics",
    handle(async (request) => {
      runParam(request);
      return { haptics: toys().view() };
    }),
  );

  router.post(
    "/runs/:run/haptics/connect",
    handle(async (request) => {
      const { url } = parseBody(ConnectBody, request.body);
      runParam(request);
      if (url && !isHapticsUrl(url)) {
        throw new OtomeForgeError(400, "Invalid request: url: a ws:// or wss:// address", "bad-request");
      }
      return { haptics: await toys().connect(url) };
    }),
  );

  router.post(
    "/runs/:run/haptics/test",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      runParam(request);
      return { results: await toys().test() };
    }),
  );

  router.post(
    "/runs/:run/haptics/play",
    handle(async (request) => {
      const { cues } = parseBody(PlayBody, request.body);
      const { runId } = runParam(request);
      const world = await store.readDoc(worldId(runId), normalizeWorld);
      if (!world) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
      if (!hapticsOn(world)) throw new OtomeForgeError(409, "Haptics are off in this story.", "conflict");
      await toys().play(runId, normalizeHapticCues(cues));
      return {};
    }),
  );

  router.post(
    "/runs/:run/haptics/keep",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return { kept: toys().keep(runId) };
    }),
  );

  router.post(
    "/runs/:run/haptics/stop",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      runParam(request);
      await toys().stop();
      return {};
    }),
  );
};
