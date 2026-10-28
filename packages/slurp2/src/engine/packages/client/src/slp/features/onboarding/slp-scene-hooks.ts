import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  SlpSceneKeepRequest,
  SlpSceneTurnRequest,
  SlpSceneTurnResponse,
} from "../../../../../shared/src/slp/slp-scene.js";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";

/** One exchange of the role-play sign-up: the next lines and a page patch. Nothing is saved. */
export function useSlpSceneTurn() {
  return useMutation({
    mutationFn: (input: SlpSceneTurnRequest) => {
      const controller = new AbortController();
      // ponytail: fixed 60s ceiling like the stage draft; raise if real turns routinely take longer.
      const timer = setTimeout(() => controller.abort(), 60_000);
      return api
        .post<SlpSceneTurnResponse>("/slurp2/slurp/onboarding/scene/turn", input, { signal: controller.signal })
        .finally(() => clearTimeout(timer));
    },
  });
}

/** Keep the sign-up chat as the new Creator's first DM thread with the player's persona. */
export function useSlpSceneKeep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SlpSceneKeepRequest) =>
      api.post<{ status: "kept"; threadId: string } | { status: "skipped" }>(
        "/slurp2/slurp/onboarding/scene/keep",
        input,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
