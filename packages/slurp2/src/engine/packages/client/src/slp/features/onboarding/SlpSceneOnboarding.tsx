// The role-play Creator sign-up (overnight plan item 7, staged in onboarding pass 3): the player
// casts themselves in a part, then plays the scene while a phone beside the chat shows the page
// building up chapter by chapter, until the page goes live. "Go live" is always there; the old
// wizard stays one tap away as "Quick setup".
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { ChevronRight, Headphones, Heart, Loader2, MessageCircle, Smartphone, Users, Zap } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlpScenePreset } from "../../../../../shared/src/slp/slp-scene.js";
import type { SlpAccount, SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_TYPE, useSlpMediaQuery } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { noteSlpAiUseOnce } from "../../modules/chrome/SlpAiMark";
import { playSlpBurst, playSlpPop, SlpTwinkle } from "../../modules/sparkle/SlpSparkle";
import { SlpButton, SlpPrimaryButton, SlpSegment } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpWizardFooter } from "../../modules/chrome/SlpWizardChrome";
import { useCreatorFollowers } from "../audience/slp-audience-contract";
import { useCreatorAccounts } from "../creators/slp-creators-contract";
import { useSlurpSettings } from "../settings/slp-settings-contract";
import { useCreatorFirstPostStatus } from "./slp-first-post-hooks";
import { SlpSceneActions } from "./SlpSceneActions";
import { SlpSceneChat } from "./SlpSceneChat";
import { SLP_SCENE_MOMENT_CHAPTER, slpSceneMissing, slpSceneProgress } from "./slp-scene-draft";
import { useSlpSceneModel, type SlpSceneModel, type SlpSceneSetup } from "./slp-scene-model";
import { SlpSceneChapterRail, SlpScenePhone, SlpScenePreview, type SlpSceneFirstPost } from "./SlpScenePreview";
import { SlpSceneShoot } from "./SlpSceneShoot";

/** The presets a player can pick today. */
export const SLP_SCENE_OFFERED: readonly SlpScenePreset[] = ["friend", "support", "seat"];

type SlpScenePerson = Pick<SlpAccount, "id" | "displayName" | "handle" | "avatarUrl">;
/** A part in the casting: one of the scenes, or no scene at all. */
type SlpSceneCast = SlpScenePreset | "quick";
/** The chosen card's picture carries this name into the scene (a native view transition). */
const CAST_TRANSITION = "slp-cast";

export function SlpSceneOnboarding({
  accounts,
  connectionId,
  defaultDisclosure = "hinted",
  defaultPreset,
  onBack,
  onQuickSetup,
  onFinished,
  onSeeFeed,
}: {
  accounts: readonly SlpAccount[];
  connectionId?: string;
  /** The page-name choice from the welcome, as the first pick. */
  defaultDisclosure?: SlpIdentityDisclosure;
  /** The part picked first (the Support ticket hands over to Support's own part). */
  defaultPreset?: SlpScenePreset;
  onBack: () => void;
  onQuickSetup: () => void;
  onFinished: () => void;
  onSeeFeed: () => void;
}) {
  const [setup, setSetup] = useState<SlpSceneSetup | null>(null);
  const [session, setSession] = useState(0);
  if (!setup) {
    return (
      <SceneSetup
        accounts={accounts}
        defaultDisclosure={defaultDisclosure}
        defaultPreset={defaultPreset}
        onBack={onBack}
        onQuickSetup={onQuickSetup}
        onStart={(next) => {
          setSetup({ ...next, ...(connectionId ? { connectionId } : {}) });
          setSession((value) => value + 1);
        }}
      />
    );
  }
  return (
    <SceneStage
      key={session}
      setup={setup}
      onBack={() => setSetup(null)}
      onQuickSetup={onQuickSetup}
      onFinished={onFinished}
      onSeeFeed={onSeeFeed}
      onAnother={() => setSetup(null)}
    />
  );
}

/**
 * The picture on a casting card and on the scene's goal bar: the newcomer with the part the player
 * plays pinned to them (a heart for the friend, the headset for Support, the helping Creator, a
 * bolt for Quick setup), with a few sparkles round it.
 */
function CastArt({
  cast,
  newcomer,
  helper,
  small = false,
  transition = false,
}: {
  cast: SlpSceneCast;
  newcomer: SlpScenePerson | null;
  helper: SlpScenePerson | null;
  small?: boolean;
  transition?: boolean;
}) {
  const badge = small ? "size-6" : "size-9";
  const icon = small ? 12 : 17;
  return (
    <span
      aria-hidden="true"
      style={transition ? ({ viewTransitionName: CAST_TRANSITION } as CSSProperties) : undefined}
      className={cn("relative grid shrink-0 place-items-center", small ? "size-12" : "size-20")}
    >
      {!small && <SlpTwinkle />}
      <Avatar
        account={newcomer ?? { displayName: "?", avatarUrl: null }}
        className={cn(small ? "h-10 w-10" : "h-14 w-14", "ring-2 ring-[var(--slurp-surface-raised)]")}
      />
      <span
        className={cn(
          badge,
          "absolute -bottom-0.5 -end-0.5 grid place-items-center overflow-hidden rounded-full bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] shadow-[var(--slurp-glow)] ring-2 ring-[var(--slurp-surface-raised)]",
        )}
      >
        {cast === "seat" && helper ? (
          <Avatar account={helper} className="h-full w-full" />
        ) : cast === "friend" ? (
          <Heart size={icon} aria-hidden="true" className="fill-current !text-current" />
        ) : cast === "support" ? (
          <Headphones size={icon} aria-hidden="true" className="!text-current" />
        ) : cast === "quick" ? (
          <Zap size={icon} aria-hidden="true" className="fill-current !text-current" />
        ) : (
          <Users size={icon} aria-hidden="true" className="!text-current" />
        )}
      </span>
    </span>
  );
}

function SceneSetup({
  accounts,
  defaultDisclosure,
  defaultPreset,
  onBack,
  onQuickSetup,
  onStart,
}: {
  accounts: readonly SlpAccount[];
  defaultDisclosure: SlpIdentityDisclosure;
  defaultPreset?: SlpScenePreset;
  onBack: () => void;
  onQuickSetup: () => void;
  onStart: (setup: Omit<SlpSceneSetup, "connectionId">) => void;
}) {
  const { t } = useUiTranslation();
  // The first character is cast already, so every card can name who it is about.
  const [sourceId, setSourceId] = useState<string | null>(accounts[0]?.id ?? null);
  const [preset, setPreset] = useState<SlpScenePreset>(defaultPreset ?? SLP_SCENE_OFFERED[0]);
  const [disclosure, setDisclosure] = useState<SlpIdentityDisclosure>(defaultDisclosure);
  const [helperId, setHelperId] = useState<string | null>(null);
  // The creator seat needs somebody already on Slurp to do the helping.
  const creators = useCreatorAccounts().data ?? [];
  const offered = SLP_SCENE_OFFERED.filter((option) => option !== "seat" || creators.length > 0);
  const casts: SlpSceneCast[] = [...offered, "quick"];
  const source = accounts.find((account) => account.id === sourceId) ?? null;
  // The first Creator helps unless the player picks another.
  const helperPick = helperId ?? creators[0]?.id ?? null;
  const helper = preset === "seat" ? (creators.find((creator) => creator.id === helperPick) ?? null) : null;
  const name = source?.displayName ?? t("ui.slurp.scene.cast.anyone");
  const reason = !source
    ? t("ui.slurp.scene.setup.pickOne")
    : preset === "seat" && !helper
      ? t("ui.slurp.scene.setup.pickHelper")
      : "";
  const pick = (cast: SlpSceneCast, card: HTMLElement) => {
    if (cast === "quick") return onQuickSetup();
    playSlpPop(card);
    // The AI note shows here, on the casting screen, not over the scene's first lines.
    noteSlpAiUseOnce(t);
    setPreset(cast);
  };
  const start = () => {
    if (!source || reason) return;
    const go = () => onStart({ preset, source, helper, disclosureMode: disclosure });
    const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
    // The chosen card's picture flies into the scene's goal bar; without view transitions it just opens.
    if (doc.startViewTransition && !slpPrefersReducedMotion()) doc.startViewTransition(() => flushSync(go));
    else go();
  };
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4 max-sm:py-2.5">
        <div>
          <h3 tabIndex={-1} data-autofocus className={cn(SLP_TYPE.screen, "text-balance outline-none")}>
            {t("ui.slurp.scene.setup.title")}
          </h3>
          <p className={cn(SLP_TYPE.body, "mt-1 text-pretty text-[var(--slurp-muted)]")}>
            {t("ui.slurp.scene.setup.help")}
          </p>
        </div>
        <PeopleStrip
          label={t("ui.slurp.scene.setup.who")}
          people={accounts}
          value={sourceId}
          onChange={setSourceId}
          empty={t("ui.slurp.scene.setup.nobody")}
        />
        <div>
          <p className={cn(SLP_TYPE.title, "mb-2")}>{t("ui.slurp.scene.cast.title", { name })}</p>
          <div
            role="radiogroup"
            aria-label={t("ui.slurp.scene.cast.title", { name })}
            className="grid gap-2.5 sm:grid-cols-2"
          >
            {casts.map((cast) => {
              const selected = cast === preset;
              const card = cast === "quick" ? "quick" : cast;
              return (
                <button
                  key={cast}
                  type="button"
                  role={cast === "quick" ? undefined : "radio"}
                  aria-checked={cast === "quick" ? undefined : selected}
                  onClick={(event) => pick(cast, event.currentTarget)}
                  className={cn(
                    "flex items-center gap-3.5 rounded-2xl p-3.5 text-start transition-[transform,background-color,box-shadow] duration-[var(--slurp-motion-fast)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transform-none sm:flex-col sm:items-start sm:p-4",
                    selected
                      ? "bg-[image:var(--slurp-nav-active)] shadow-[var(--slurp-glow),var(--slurp-highlight)] ring-2 ring-inset ring-[var(--noodle-accent)]"
                      : "bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] hover:bg-[var(--accent)]",
                  )}
                >
                  <CastArt
                    cast={cast}
                    newcomer={source}
                    helper={cast === "seat" ? (creators.find((creator) => creator.id === helperPick) ?? null) : null}
                    transition={selected && cast !== "quick"}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn(SLP_TYPE.title, "block text-balance")}>
                      {t(`ui.slurp.scene.cast.${card}.title`, { name })}
                    </span>
                    <span className={cn(SLP_TYPE.body, "mt-1 block text-pretty")}>
                      {t(`ui.slurp.scene.cast.${card}.you`, { name })}
                    </span>
                    <span
                      className={cn(
                        SLP_TYPE.meta,
                        "mt-1.5 flex items-start gap-1 text-pretty text-[var(--slurp-muted)]",
                      )}
                    >
                      <SlpSparkleGlyph
                        size={13}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-[var(--slurp-ink)]"
                      />
                      {t(`ui.slurp.scene.cast.${card}.get`, { name })}
                    </span>
                  </span>
                  {cast === "quick" && (
                    <ChevronRight size={16} aria-hidden="true" className="shrink-0 sm:hidden rtl:rotate-180" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {preset === "seat" && (
          <PeopleStrip
            label={t("ui.slurp.scene.setup.helper")}
            people={creators}
            value={helperPick}
            onChange={setHelperId}
            heading
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={cn(SLP_TYPE.body, "font-semibold")}>{t("ui.slurp.scene.setup.identity")}</p>
            <p className={cn(SLP_TYPE.meta, "text-pretty text-[var(--slurp-muted)]")}>
              {t(`ui.slurp.scene.setup.identity.${disclosure === "open" ? "open" : "hinted"}`)}
            </p>
          </div>
          <SlpSegment
            label={t("ui.slurp.scene.setup.identity")}
            value={disclosure === "open" ? "open" : "hinted"}
            onChange={setDisclosure}
            options={(["hinted", "open"] as const).map((option) => ({
              value: option,
              label: t(`ui.noodle.noodlerwizard.disclosure.${option}.title`),
            }))}
          />
        </div>
      </div>
      <SlpWizardFooter
        back={{ label: t("ui.noodle.noodlerwizard.back"), onClick: onBack }}
        primary={
          <SlpPrimaryButton disabled={Boolean(reason)} onClick={start}>
            {t("ui.slurp.scene.setup.start")}
            <ChevronRight size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
          </SlpPrimaryButton>
        }
        note={reason}
      />
    </>
  );
}

/** One pick out of a row of people (who signs up, who helps): head shots, like a casting sheet. */
function PeopleStrip({
  label,
  people,
  value,
  onChange,
  empty,
  heading = false,
}: {
  label: string;
  people: readonly SlpScenePerson[];
  value: string | null;
  onChange: (id: string) => void;
  empty?: string;
  heading?: boolean;
}) {
  return (
    <div>
      {heading && <p className={cn(SLP_TYPE.body, "mb-1.5 font-semibold")}>{label}</p>}
      {people.length === 0 && empty && <p className={cn(SLP_TYPE.body, "text-[var(--slurp-muted)]")}>{empty}</p>}
      <div
        role="radiogroup"
        aria-label={label}
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 pt-1 [scrollbar-width:none]"
      >
        {people.map((person) => {
          const checked = person.id === value;
          return (
            <button
              key={person.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(person.id)}
              className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <span
                className={cn(
                  "rounded-full p-0.5 transition-shadow duration-[var(--slurp-motion-fast)] motion-reduce:transition-none",
                  checked
                    ? "shadow-[var(--slurp-glow)] ring-2 ring-[var(--noodle-accent)]"
                    : "ring-1 ring-[var(--noodle-divider)]",
                )}
              >
                <Avatar account={person} className="h-14 w-14" />
              </span>
              <span
                className={cn(
                  SLP_TYPE.meta,
                  "w-full truncate text-center",
                  checked ? "font-semibold text-[var(--slurp-text)]" : "text-[var(--slurp-muted)]",
                )}
              >
                {person.displayName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SceneStage({
  setup,
  onBack,
  onQuickSetup,
  onFinished,
  onSeeFeed,
  onAnother,
}: {
  setup: SlpSceneSetup;
  onBack: () => void;
  onQuickSetup: () => void;
  onFinished: () => void;
  onSeeFeed: () => void;
  onAnother: () => void;
}) {
  const { t } = useUiTranslation();
  const settings = useSlurpSettings();
  const allowedTags = useMemo(
    () => settings.data?.discoveryTags.map((entry) => entry.tag) ?? [],
    [settings.data?.discoveryTags],
  );
  const hostName = setup.helper?.displayName ?? t(`ui.slurp.scene.host.${setup.preset}`);
  const model = useSlpSceneModel(setup, hostName);
  const [pageOpen, setPageOpen] = useState(false);
  const phone = useSlpMediaQuery("(max-width: 639px)");
  const [missingNote, setMissingNote] = useState("");
  const liveRef = useRef<HTMLDivElement | null>(null);
  // Closing the dialog after the photo shoot still finishes the page (step 10 answer): limits line,
  // first post, kept chat and the first run marked done. No half-registered Creators.
  const latest = useRef({ model, onFinished });
  latest.current = { model, onFinished };
  useEffect(
    () => () => {
      const { model: last, onFinished: done } = latest.current;
      if (!last.accountId || last.created || last.registering) return;
      void last.finishOnClose().then((finished) => finished && done());
    },
    [],
  );
  useEffect(() => {
    if (!model.created) return;
    // The page going live is the peak of the scene: a big Burst off the phone.
    if (liveRef.current) playSlpBurst(liveRef.current, 14);
    onFinished();
    // Once per page: onFinished marks the first run as done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.created]);

  const newcomerName = model.draft.displayName || setup.source.displayName;
  // After the photo shoot the page wears its new photo everywhere.
  const newcomerAvatar = model.photos.avatarUrl ?? setup.source.avatarUrl;
  const newcomer = { name: newcomerName, avatarUrl: newcomerAvatar, mine: false };
  const showMissing = (missing: string[]) => {
    setMissingNote(
      t("ui.slurp.scene.missing", {
        list: missing.map((field) => t(`ui.slurp.scene.field.${field}`)).join(", "),
      }),
    );
    if (phone) setPageOpen(true);
  };
  // In the seat the helper talks; the player only whispers, so both speakers sit on the left.
  const host = { name: hostName, avatarUrl: setup.helper?.avatarUrl ?? null, mine: setup.preset !== "seat" };
  const lastPatch = [...model.items].reverse().find((item) => item.kind === "patch");
  const recent =
    lastPatch?.kind === "patch" && !model.chips.find((chip) => chip.id === lastPatch.chipId)?.undone
      ? lastPatch.fields
      : [];
  const progress = slpSceneProgress(model.draft, Boolean(model.photos.avatarUrl));
  const fixed = setup.disclosureMode === "open" ? (["displayName", "handle"] as const) : [];
  const pageTitle = t(`ui.slurp.scene.page.title.${setup.preset === "support" ? "support" : "page"}`);
  const preview = (editOpen: boolean) => (
    <SlpScenePreview
      draft={model.draft}
      locked={model.locked}
      fixed={fixed}
      recent={recent}
      recentKey={lastPatch?.id}
      allowedTags={allowedTags}
      avatarUrl={newcomerAvatar}
      bannerUrl={model.photos.bannerUrl}
      editOpen={editOpen}
      onEdit={model.edit}
      onToggleLock={model.toggleLock}
    />
  );

  if (model.created) {
    return (
      <SceneLive
        model={model}
        name={model.created.displayName}
        avatarUrl={newcomerAvatar}
        phoneRef={liveRef}
        onSeeFeed={onSeeFeed}
        onAnother={onAnother}
      />
    );
  }

  const status = model.registering
    ? t("ui.slurp.scene.registering")
    : model.updating
      ? t("ui.slurp.scene.updating")
      : missingNote ||
        (progress.ready
          ? t("ui.slurp.scene.ready")
          : t("ui.slurp.scene.needs", {
              list: slpSceneMissing(model.draft)
                .map((field) => t(`ui.slurp.scene.field.${field}`))
                .join(", "),
            }));
  const finishLabel = (
    <>
      {model.registering && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
      {t("ui.slurp.scene.finish")}
    </>
  );
  const finish = async () => {
    setMissingNote("");
    const missing = await model.finish();
    if (missing?.length) showMissing(missing);
  };
  return (
    <>
      {/* The goal from the first second: whose page, the player's part, and the way to live. */}
      <div className="mb-2 rounded-2xl bg-[var(--slurp-surface-raised)] px-3 pb-2.5 pt-2 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] sm:px-4">
        <div className="flex min-h-12 items-center gap-3">
          <CastArt
            cast={setup.preset}
            newcomer={{ ...setup.source, displayName: newcomerName, avatarUrl: newcomerAvatar }}
            helper={setup.helper ?? null}
            small
            transition
          />
          <div className="min-w-0 flex-1">
            <h3 tabIndex={-1} data-autofocus className={cn(SLP_TYPE.title, "text-balance outline-none")}>
              {t("ui.slurp.scene.goal", { name: newcomerName })}
            </h3>
            <p className={cn(SLP_TYPE.meta, "line-clamp-2 text-pretty text-[var(--slurp-muted)]")}>
              {t(`ui.slurp.scene.role.${setup.preset}`, { name: setup.source.displayName, helper: hostName })}
            </p>
          </div>
          {/* Phones: the page lives in a sheet, one tap away. */}
          <button
            type="button"
            aria-label={pageTitle}
            title={pageTitle}
            onClick={() => setPageOpen(true)}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--slurp-tint)] text-[var(--slurp-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:hidden [&_svg]:!text-current"
          >
            <Smartphone size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-1.5">
          <SlpSceneChapterRail chapters={model.chapters} current={SLP_SCENE_MOMENT_CHAPTER[model.moment]} />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <SlpSceneChat
            model={model}
            host={host}
            newcomer={newcomer}
            placeholder={t(`ui.slurp.scene.composer.${setup.preset}`, { name: hostName })}
          >
            {model.moment === "shoot" && <SlpSceneShoot model={model} onMissing={showMissing} />}
            <SlpSceneActions model={model} />
          </SlpSceneChat>
        </div>
        <div className="min-h-0 overflow-y-auto pe-1 pt-1 max-sm:hidden">{preview(false)}</div>
      </div>
      <SlpSheet open={phone && pageOpen} onClose={() => setPageOpen(false)} title={pageTitle}>
        <div className="px-1 pb-4">{preview(true)}</div>
      </SlpSheet>
      <SlpWizardFooter
        // Once the page is saved (the photo shoot does that), leaving would strand a half-registered
        // Creator with no limits, first post or kept chat: from here the way out is Go live.
        back={
          model.accountId
            ? undefined
            : { label: t("ui.noodle.noodlerwizard.back"), onClick: onBack, disabled: model.registering }
        }
        skip={
          model.accountId
            ? undefined
            : { label: t("ui.slurp.scene.quick"), onClick: onQuickSetup, disabled: model.registering }
        }
        // Go live always works (it fills what is missing first); once the page has what it needs
        // it becomes the lit-up main button.
        primary={
          progress.ready ? (
            <SlpPrimaryButton disabled={model.busy} onClick={() => void finish()}>
              {finishLabel}
            </SlpPrimaryButton>
          ) : (
            <SlpButton disabled={model.busy} onClick={() => void finish()}>
              {finishLabel}
            </SlpButton>
          )
        }
        note={status}
      />
    </>
  );
}

/** A number that counts up from 0 once (the first fans arriving); reduced motion shows it at once. */
function useCountUp(target: number | null, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (slpPrefersReducedMotion()) return setValue(target);
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      // The first frame's own time is the start: a frame time can be older than "now" at mount.
      start ??= now;
      const share = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(Math.round(target * (1 - Math.pow(1 - share, 3))));
      if (share < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/**
 * The finale: the page goes live on the phone (LIVE mark, story ring, a Burst), then what that
 * means lands one line at a time, all of it real: the fans the page starts with (the follower
 * count its profile shows), the first post as it is written, and where the kept chat went.
 */
function SceneLive({
  model,
  name,
  avatarUrl,
  phoneRef,
  onSeeFeed,
  onAnother,
}: {
  model: SlpSceneModel;
  name: string;
  avatarUrl: string | null;
  phoneRef: React.Ref<HTMLDivElement>;
  onSeeFeed: () => void;
  onAnother: () => void;
}) {
  const { t } = useUiTranslation();
  const created = model.created!;
  const followers = useCreatorFollowers(created.id).data?.total ?? null;
  const fans = useCountUp(followers);
  // The first post is followed until its run is complete; then the poll stops.
  const [settled, setSettled] = useState(false);
  const run = useCreatorFirstPostStatus(model.firstPostRun, !settled);
  useEffect(() => {
    if (run.data?.complete) setSettled(true);
  }, [run.data?.complete]);
  const job = run.data?.jobs[0];
  const firstPost: SlpSceneFirstPost =
    job?.status === "generated"
      ? "posted"
      : job?.status === "failed" || job?.status === "skipped"
        ? "later"
        : "writing";
  const support = model.setup.preset === "support";
  const notices = [
    {
      id: "fans",
      icon: <Users size={16} aria-hidden="true" />,
      title: followers === null ? t("ui.slurp.scene.live.fansWaiting") : t("ui.slurp.scene.live.fans", { count: fans }),
      detail: t("ui.slurp.scene.live.fansHelp"),
    },
    {
      id: "post",
      icon:
        firstPost === "writing" ? (
          <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Heart size={16} aria-hidden="true" className={cn(firstPost === "posted" && "fill-current")} />
        ),
      title: t(`ui.slurp.scene.live.post.${firstPost}`),
      detail: t(`ui.slurp.scene.live.post.${firstPost}Help`, { name }),
    },
    ...(created.kept
      ? [
          {
            id: "chat",
            icon: <MessageCircle size={16} aria-hidden="true" />,
            title: t("ui.slurp.scene.live.chat"),
            detail: support ? t("ui.slurp.scene.done.keptSupport") : t("ui.slurp.scene.done.kept", { name }),
          },
        ]
      : []),
  ];
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto py-3 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
        <div className="slp-live-in w-full max-w-[15rem] shrink-0 max-sm:[zoom:0.74] sm:max-w-[18rem]">
          <SlpScenePhone
            draft={model.draft}
            recent={[]}
            avatarUrl={avatarUrl}
            bannerUrl={model.photos.bannerUrl}
            live
            large
            firstPost={firstPost}
            phoneRef={phoneRef}
          />
        </div>
        <div className="w-full max-w-sm">
          <h3
            tabIndex={-1}
            data-autofocus
            className={cn(SLP_TYPE.screen, "text-balance text-center outline-none sm:text-start")}
          >
            {t("ui.slurp.scene.done.title", { name })}
          </h3>
          <p className={cn(SLP_TYPE.body, "mt-1 text-pretty text-center text-[var(--slurp-muted)] sm:text-start")}>
            {t("ui.slurp.scene.done.help", { handle: created.handle })}
          </p>
          <ul aria-live="polite" className="mt-4 space-y-2">
            {notices.map((notice, index) => (
              <li
                key={notice.id}
                className="slp-notice-in flex items-start gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] px-3.5 py-3 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]"
                style={{ "--slp-notice-delay": `${500 + index * 450}ms` } as CSSProperties}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--slurp-tint)] text-[var(--slurp-ink)] [&_svg]:!text-current">
                  {notice.icon}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className={cn(SLP_TYPE.body, "block font-semibold tabular-nums")}>{notice.title}</span>
                  <span className={cn(SLP_TYPE.meta, "block text-pretty text-[var(--slurp-muted)]")}>
                    {notice.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SlpWizardFooter
        skip={{ label: t("ui.slurp.scene.done.another"), onClick: onAnother }}
        primary={<SlpPrimaryButton onClick={onSeeFeed}>{t("ui.slurp.scene.done.feed")}</SlpPrimaryButton>}
      />
    </>
  );
}
