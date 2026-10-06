/**
 * Start a roleplay scene from a DM thread (docs/SCENES.md): an optional idea, the Creator's plan,
 * this scene's two settings, then the Engine takes over.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, Eye, EyeOff, Lock, Megaphone, PhoneCall, RefreshCw } from "lucide-react";
import { getApiErrorMessage } from "../../../../lib/api-client";
import { cn } from "../../../../lib/utils";
import type {
  SlpScenePlanResponse,
  SlpSceneReach,
  SlpSceneSettings,
} from "../../../../../../shared/src/slp/slp-roleplay-scene";
import { SLP_TYPE } from "../../../base/chrome/SlpChrome";
import { useSlurpUIStore } from "../../../base/state/slp-package-store";
import { SlpAutoGrowTextarea } from "../../../base/ui/SlpAutoGrowTextarea";
import { SlpUsesAiMark } from "../../../modules/chrome/SlpAiMark";
import { SlpButton, SlpPrimaryButton } from "../../../modules/chrome/SlpButton";
import { SlpSheet } from "../../../modules/chrome/SlpSheet";
import { startSlpScene, useSlpScenePlan } from "./slp-roleplay-scene-hooks";

const REACH_ICONS: Record<SlpSceneReach, typeof Lock> = {
  none: EyeOff,
  private: Lock,
  hint: Eye,
  public: Megaphone,
};

export function SlpSceneStartSheet({ personaId, creatorName }: { personaId: string | null; creatorName: string }) {
  const { t } = useTranslation();
  const sheet = useSlurpUIStore((state) => state.sceneSheet);
  const setSheet = useSlurpUIStore((state) => state.setSceneSheet);
  const plan = useSlpScenePlan();
  const [idea, setIdea] = useState("");
  const [planned, setPlanned] = useState<SlpScenePlanResponse | null>(null);
  const [settings, setSettings] = useState<SlpSceneSettings>({ lock: true, reach: "private" });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const invited = Boolean(sheet?.inviteMessageId);

  // A fresh sheet for every thread or invite; an invite plans at once, her pitch is the idea.
  useEffect(() => {
    setIdea("");
    setPlanned(null);
    setError(null);
    if (sheet?.inviteMessageId) void write();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the sheet opens on a new target
  }, [sheet?.threadId, sheet?.inviteMessageId]);

  if (!sheet || !personaId) return null;
  const close = () => {
    if (!starting) setSheet(null);
  };

  async function write() {
    if (!sheet || !personaId) return;
    const target = sheet;
    const request = ++requestSequence.current;
    const isCurrent = () => request === requestSequence.current && useSlurpUIStore.getState().sceneSheet === target;
    setError(null);
    try {
      const next = await plan.mutateAsync({
        threadId: sheet.threadId,
        personaId,
        idea: sheet.inviteMessageId ? "" : idea,
        inviteMessageId: sheet.inviteMessageId,
      });
      if (!isCurrent()) return;
      setPlanned(next);
      setSettings(next.settings);
    } catch (cause) {
      if (isCurrent()) setError(getApiErrorMessage(cause, t("ui.slurp.rpScene.planFailed")));
    }
  }

  async function start() {
    if (!sheet || !planned) return;
    setStarting(true);
    setError(null);
    try {
      // The Engine opens the scene chat; Slurp leaves the screen with it.
      const started = await startSlpScene({ threadId: sheet.threadId, planned, settings });
      if (started) setSheet(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, t("ui.slurp.rpScene.startFailed")));
    } finally {
      setStarting(false);
    }
  }

  return (
    <SlpSheet
      open
      onClose={close}
      closeDisabled={starting}
      title={invited ? t("ui.slurp.rpScene.inviteTitle", { name: creatorName }) : t("ui.slurp.rpScene.startTitle")}
      footer={
        planned ? (
          <div className="flex items-center justify-end gap-2">
            <SlpButton variant="tertiary" disabled={plan.isPending || starting} onClick={() => void write()}>
              <RefreshCw size={15} aria-hidden="true" />
              {t("ui.slurp.rpScene.rewrite")}
            </SlpButton>
            <SlpPrimaryButton disabled={plan.isPending || starting} onClick={() => void start()}>
              <Clapperboard size={16} aria-hidden="true" />
              {starting ? t("ui.slurp.rpScene.starting") : t("ui.slurp.rpScene.start")}
            </SlpPrimaryButton>
          </div>
        ) : invited && !error ? null : (
          <div className="flex justify-end">
            <SlpPrimaryButton disabled={plan.isPending} onClick={() => void write()}>
              <Clapperboard size={16} aria-hidden="true" />
              {plan.isPending ? t("ui.slurp.rpScene.writing", { name: creatorName }) : t("ui.slurp.rpScene.write")}
              <SlpUsesAiMark />
            </SlpPrimaryButton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {!planned && !invited && (
          <label className="flex flex-col gap-1.5">
            <span className={cn(SLP_TYPE.body, "text-[var(--slurp-muted)]")}>
              {t("ui.slurp.rpScene.ideaLabel", { name: creatorName })}
            </span>
            <SlpAutoGrowTextarea
              value={idea}
              maxLength={600}
              onChange={(event) => setIdea(event.target.value)}
              placeholder={t("ui.slurp.rpScene.ideaPlaceholder")}
              className="w-full resize-none rounded-2xl bg-[var(--slurp-canvas)] px-4 py-3 text-[15px] leading-6 text-[var(--slurp-text)] ring-1 ring-inset ring-[var(--noodle-divider)] placeholder:text-[var(--slurp-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            />
          </label>
        )}
        {!planned && plan.isPending && (
          <p aria-live="polite" className={cn(SLP_TYPE.body, "text-center text-[var(--slurp-muted)]")}>
            {t("ui.slurp.rpScene.writing", { name: creatorName })}
          </p>
        )}
        {planned && (
          <>
            <article className="flex flex-col gap-2 rounded-2xl bg-[linear-gradient(160deg,var(--slurp-surface-raised),var(--slurp-surface))] p-4 shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]">
              <h3 className={SLP_TYPE.title}>{planned.plan.name.replace(/^Scene:\s*/u, "")}</h3>
              <p className={cn(SLP_TYPE.body, "italic text-[var(--slurp-text)]")}>{planned.plan.description}</p>
              {planned.plan.participationGuide && (
                <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{planned.plan.participationGuide}</p>
              )}
            </article>
            <fieldset className="flex flex-col gap-2">
              <legend className={cn(SLP_TYPE.meta, "mb-1 text-[var(--slurp-muted)]")}>
                {t("ui.slurp.rpScene.lockLegend")}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {([true, false] as const).map((lock) => {
                  const Icon = lock ? Lock : PhoneCall;
                  const checked = settings.lock === lock;
                  return (
                    <button
                      key={String(lock)}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => setSettings((current) => ({ ...current, lock }))}
                      className={cn(
                        "flex min-h-11 flex-col items-start gap-1 rounded-2xl p-3 text-left ring-1 ring-inset transition-colors duration-[var(--slurp-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                        checked
                          ? "bg-[image:var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45"
                          : "ring-[var(--noodle-divider)] hover:bg-[var(--accent)]",
                      )}
                    >
                      <Icon size={17} aria-hidden="true" className="text-[var(--slurp-ink)]" />
                      <span className={SLP_TYPE.title}>{t(`ui.slurp.rpScene.lock.${lock ? "on" : "off"}`)}</span>
                      <span className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
                        {t(`ui.slurp.rpScene.lock.${lock ? "on" : "off"}Hint`, { name: creatorName })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className={cn(SLP_TYPE.meta, "mb-1 text-[var(--slurp-muted)]")}>
                {t("ui.slurp.rpScene.reachLegend")}
              </legend>
              <SlpSceneReachPicker
                value={settings.reach}
                creatorName={creatorName}
                onChange={(reach) => setSettings((current) => ({ ...current, reach }))}
              />
            </fieldset>
          </>
        )}
        {error && (
          <p role="alert" className={cn(SLP_TYPE.meta, "text-[var(--slurp-danger)]")}>
            {error}
          </p>
        )}
      </div>
    </SlpSheet>
  );
}

/** How far a scene travels: four cards, the chosen one's meaning spelled out under them. */
export function SlpSceneReachPicker({
  value,
  creatorName,
  onChange,
  disabled = false,
}: {
  value: SlpSceneReach;
  creatorName: string;
  onChange: (reach: SlpSceneReach) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={t("ui.slurp.rpScene.reachLegend")} className="grid grid-cols-4 gap-1.5">
        {(["none", "private", "hint", "public"] as const).map((reach) => {
          const Icon = REACH_ICONS[reach];
          const checked = value === reach;
          return (
            <button
              key={reach}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={disabled}
              onClick={() => onChange(reach)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center ring-1 ring-inset transition-colors duration-[var(--slurp-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                checked
                  ? "bg-[image:var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45"
                  : "text-[var(--slurp-muted)] ring-[var(--noodle-divider)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)]",
              )}
            >
              <Icon size={17} aria-hidden="true" className={checked ? "text-[var(--slurp-ink)]" : undefined} />
              <span className={SLP_TYPE.caption}>{t(`ui.slurp.rpScene.reach.${reach}`)}</span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
        {t(`ui.slurp.rpScene.reach.${value}Hint`, { name: creatorName })}
      </p>
    </div>
  );
}
