/**
 * Roleplay scenes from a DM thread (docs/SCENES.md): plan one, start it in the Engine, come back.
 */
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../lib/api-client";
import type {
  SlpSceneLine,
  SlpSceneReach,
  SlpScenePlanResponse,
  SlpSceneSettings,
} from "../../../../../../shared/src/slp/slp-roleplay-scene";
import { useSlurpUIStore } from "../../../base/state/slp-package-store";
import { messageKeys } from "../slp-message-keys";

const threadPath = (threadId: string) => `/slurp2/messages/threads/${encodeURIComponent(threadId)}`;

export function useSlpScenePlan() {
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string; idea: string; inviteMessageId?: string }) =>
      api.post<SlpScenePlanResponse>(`${threadPath(input.threadId)}/scene/plan`, {
        personaId: input.personaId,
        idea: input.idea,
        ...(input.inviteMessageId ? { inviteMessageId: input.inviteMessageId } : {}),
      }),
  });
}

/** Hand the planned scene to the Engine. It opens the scene chat; null when the player backed out. */
export async function startSlpScene(input: {
  threadId: string;
  planned: SlpScenePlanResponse;
  settings: SlpSceneSettings;
}): Promise<{ chatId: string } | null> {
  const host = useSlurpUIStore.getState().sceneHost;
  if (!host) return null;
  return host.startScene({
    originId: input.threadId,
    plan: input.planned.plan,
    data: input.settings,
    initiatorCharacterId: input.planned.initiatorCharacterId,
    initiatorName: input.planned.initiatorName,
  });
}

function useSceneLineMutation<T>(
  path: (input: T & { threadId: string; messageId: string }) => string,
  body: (input: T & { personaId: string }) => object,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: T & { threadId: string; messageId: string; personaId: string }) =>
      api.post<{ scene: SlpSceneLine }>(path(input), body(input)),
    onSettled: (_data, _error, input) =>
      qc.invalidateQueries({ queryKey: messageKeys.thread(input.threadId, input.personaId) }),
  });
}

export function useSlpSceneReach() {
  return useSceneLineMutation<{ reach: SlpSceneReach }>(
    (input) => `${threadPath(input.threadId)}/scene/recap/${encodeURIComponent(input.messageId)}/reach`,
    (input) => ({ personaId: input.personaId, reach: input.reach }),
  );
}

export function useSlpDeclineSceneInvite() {
  return useSceneLineMutation<object>(
    (input) => `${threadPath(input.threadId)}/scene/invite/${encodeURIComponent(input.messageId)}/decline`,
    (input) => ({ personaId: input.personaId }),
  );
}

/**
 * Back from a scene, the Engine names the thread it started in: open it for the persona that owns
 * it, then tell the host it was shown.
 */
export function useSlpSceneFocus() {
  const threadId = useSlurpUIStore((state) => state.sceneFocusThreadId);
  const handled = useSlurpUIStore((state) => state.sceneFocusHandled);
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    void api
      .get<{ personaId: string; creatorAccountId: string }>(`${threadPath(threadId)}/scene/origin`)
      .then((origin) => {
        if (cancelled) return;
        const store = useSlurpUIStore.getState();
        store.setViewerPersonaId(origin.personaId);
        store.setNavigation({ mode: "creator", view: "messages", creatorAccountId: origin.creatorAccountId });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) handled?.();
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, handled]);
}
