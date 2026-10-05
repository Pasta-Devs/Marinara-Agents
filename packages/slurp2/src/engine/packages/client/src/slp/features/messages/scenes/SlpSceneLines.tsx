/**
 * What a roleplay scene leaves in a DM thread (docs/SCENES.md): her invite, the recap with how far it
 * travels, a note when one ended without a recap, and the bar that stands in for the composer while
 * the thread is in a scene.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Clapperboard, Film } from "lucide-react";
import { getApiErrorMessage } from "../../../../lib/api-client";
import { cn } from "../../../../lib/utils";
import { readSlpSceneLine } from "../../../../../../shared/src/slp/slp-roleplay-scene";
import { SLP_TYPE } from "../../../base/chrome/SlpChrome";
import { useSlurpUIStore } from "../../../base/state/slp-package-store";
import { SlpButton, SlpPrimaryButton, slpTagClass } from "../../../modules/chrome/SlpButton";
import type { SlurpMessage } from "../slp-messages-contract";
import { useSlpDeclineSceneInvite, useSlpSceneReach } from "./slp-roleplay-scene-hooks";
import { SlpSceneReachPicker } from "./SlpSceneStartSheet";

export function isSlpSceneLine(message: Pick<SlurpMessage, "metadata">): boolean {
  return readSlpSceneLine(message.metadata as Record<string, unknown>) !== null;
}

const CARD =
  "flex w-full max-w-md flex-col gap-2 self-center rounded-2xl bg-[linear-gradient(160deg,var(--slurp-surface-raised),var(--slurp-surface))] p-4 shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]";

export function SlpSceneLineRow({
  message,
  personaId,
  creatorName,
  canStart,
}: {
  message: SlurpMessage;
  personaId: string | null;
  creatorName: string;
  /** Scenes run on this Engine and the thread is free: an open invite can be accepted. */
  canStart: boolean;
}) {
  const { t } = useTranslation();
  const reach = useSlpSceneReach();
  const decline = useSlpDeclineSceneInvite();
  const setSheet = useSlurpUIStore((state) => state.setSceneSheet);
  const [expanded, setExpanded] = useState(false);
  const line = readSlpSceneLine(message.metadata as Record<string, unknown>);
  if (!line) return null;

  if (line.kind === "ended")
    return (
      <p className={cn(SLP_TYPE.meta, "flex items-center gap-1.5 self-center px-3 py-1 text-[var(--slurp-muted)]")}>
        <Film size={13} aria-hidden="true" />
        {t(`ui.slurp.rpScene.ended.${line.outcome}`, { name: creatorName })}
      </p>
    );

  if (line.kind === "invite")
    return (
      <section aria-label={t("ui.slurp.rpScene.inviteLabel", { name: creatorName })} className={CARD}>
        <span className={slpTagClass(true)}>
          <Clapperboard size={12} aria-hidden="true" />
          {t("ui.slurp.rpScene.inviteTag")}
        </span>
        <p className={cn(SLP_TYPE.body, "whitespace-pre-wrap text-[var(--slurp-text)]")}>{line.pitch}</p>
        {line.state === "open" && personaId ? (
          <div className="flex flex-wrap justify-end gap-2">
            <SlpButton
              variant="tertiary"
              disabled={decline.isPending}
              onClick={() =>
                decline.mutate(
                  { threadId: message.threadId, messageId: message.id, personaId },
                  { onError: (error) => toast.error(getApiErrorMessage(error, t("ui.slurp.rpScene.declineFailed"))) },
                )
              }
            >
              {t("ui.slurp.rpScene.decline")}
            </SlpButton>
            {canStart && (
              <SlpPrimaryButton onClick={() => setSheet({ threadId: message.threadId, inviteMessageId: message.id })}>
                {t("ui.slurp.rpScene.accept")}
              </SlpPrimaryButton>
            )}
          </div>
        ) : (
          <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t(`ui.slurp.rpScene.invite.${line.state}`)}</p>
        )}
      </section>
    );

  // The recap: what happened, and how far it may travel. The reach can change here.
  const long = line.summary.length > 280;
  return (
    <section aria-label={t("ui.slurp.rpScene.recapLabel")} className={CARD}>
      <span className={slpTagClass(true)}>
        <Film size={12} aria-hidden="true" />
        {t("ui.slurp.rpScene.recapTag")}
      </span>
      {line.title && <h3 className={SLP_TYPE.title}>{line.title}</h3>}
      <p
        className={cn(
          SLP_TYPE.body,
          "whitespace-pre-wrap text-[var(--slurp-text)]",
          long && !expanded && "line-clamp-5",
        )}
      >
        {line.summary}
      </p>
      {long && (
        <SlpButton variant="tertiary" className="self-start px-0 text-xs" onClick={() => setExpanded((open) => !open)}>
          {expanded ? t("ui.slurp.rpScene.less") : t("ui.slurp.rpScene.more")}
        </SlpButton>
      )}
      {personaId && (
        <SlpSceneReachPicker
          value={line.reach}
          creatorName={creatorName}
          disabled={reach.isPending}
          onChange={(next) =>
            reach.mutate(
              { threadId: message.threadId, messageId: message.id, personaId, reach: next },
              { onError: (error) => toast.error(getApiErrorMessage(error, t("ui.slurp.rpScene.reachFailed"))) },
            )
          }
        />
      )}
    </section>
  );
}

/** In place of the composer while the thread is in a scene: where she is, and the way there. */
export function SlpSceneLockBar({ sceneChatId, creatorName }: { sceneChatId: string; creatorName: string }) {
  const { t } = useTranslation();
  const host = useSlurpUIStore((state) => state.sceneHost);
  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--slurp-tint)]">
        <Clapperboard size={18} aria-hidden="true" className="text-[var(--slurp-ink)]" />
      </span>
      <p className={cn(SLP_TYPE.body, "min-w-0 flex-1 text-[var(--slurp-text)]")}>
        <span className="block font-bold">{t("ui.slurp.rpScene.lockedTitle", { name: creatorName })}</span>
        <span className="block text-[var(--slurp-muted)]">{t("ui.slurp.rpScene.lockedHint")}</span>
      </p>
      {host && (
        <SlpPrimaryButton onClick={() => host.openChat(sceneChatId)}>
          {t("ui.slurp.rpScene.goToScene")}
        </SlpPrimaryButton>
      )}
    </div>
  );
}
