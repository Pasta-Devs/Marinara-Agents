import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  SaucelingStateResponse,
  SaucelingUserAction,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  petKind,
  spriteStateForPet,
  temperamentOf,
} from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { packageAssetUrl, saucelingsRequest } from "./api.js";
import {
  ACTION_ICONS,
  ACTION_LABEL_KEYS,
  CARE_POSE_MS,
  CaretakerAvatar,
  FriendlyError,
  actionCoversGap,
  actionsFor,
  cooldownMinutes,
  eggWarmth,
  hatchPercent,
  useCaretakerAvatar,
  useCaretakerFigure,
  useCaretakerMotion,
  useCaretakerSprites,
  useForAMoment,
  useNow,
} from "./care-ui.js";
import { caretakerPose, standingCaretaker } from "./caretaker-look.js";
import { useSaucelingsTranslation } from "./localization.js";
import { PetSprite } from "./PetSprite.js";
import { SaucelingSprite, useSpriteReaction } from "./SaucelingSprite.js";
import { SaucelingStage, type SaucelingStageHandle } from "./SaucelingStage.js";
import { shownFace } from "./stage-beats.js";

function WidgetMeter({ label, value, gap }: { label: string; value: number; gap?: boolean }) {
  return (
    <div>
      <span>
        {label} {value}%
      </span>
      <div className="sl-meter-bar">
        <div className={`sl-meter-fill ${gap ? "sl-meter-fill--gap" : ""}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/** What each of the large widget's bars stands for, as a small picture beside it. */
const BAR_ICONS = { warmth: "🔥", hatching: "🥚", hunger: "🍝", mood: "😊", bond: "💛" } as const;

/** The large widget's bar: a small picture, the meter's name in small text and a thin bar, so a touch screen with no
 *  tooltip still says what each one is. */
function WidgetBar({ icon, label, value, gap }: { icon: string; label: string; value: number; gap?: boolean }) {
  return (
    <div
      className="sl-widget-bar-row"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      title={`${label} ${value}%`}
    >
      <span className="sl-widget-bar-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sl-widget-bar-name" aria-hidden="true">
        {label}
      </span>
      <div className="sl-widget-bar">
        <div className={`sl-meter-fill ${gap ? "sl-meter-fill--gap" : ""}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function SaucelingsWidgetView({
  active,
  compact,
  packageId,
  packageVersion,
  onOpenNoodle,
}: {
  active: boolean;
  compact: boolean;
  packageId?: string;
  packageVersion?: string | null;
  onOpenNoodle?: () => void;
}) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const [reaction, playReaction] = useSpriteReaction();
  // On the large widget's stage the pet comes over to the caretaker for a care, and they turn to it.
  const stageHandle = useRef<SaucelingStageHandle>(null);
  const [caring, showCaring] = useForAMoment<SaucelingUserAction>(CARE_POSE_MS);
  const [nowMs, refreshNow] = useNow(30_000);
  const assetUrl = (path: string) => packageAssetUrl(packageId, path, packageVersion);
  // A tap on a resting care button says when it is ready again, in the strip where the caretaker's line sits.
  const [restNote, setRestNote] = useState<string | null>(null);
  const restTimer = useRef(0);
  // The care buttons fold into one toggle in the card's corner.
  const [careOpen, setCareOpen] = useState(false);
  const careToggle = useRef<HTMLButtonElement>(null);
  const showRestNote = (text: string) => {
    setRestNote(text);
    window.clearTimeout(restTimer.current);
    restTimer.current = window.setTimeout(() => setRestNote(null), 6_000);
  };
  useEffect(() => () => window.clearTimeout(restTimer.current), []);

  const stateQuery = useQuery({
    queryKey: ["saucelings", "state"],
    queryFn: () => saucelingsRequest<SaucelingStateResponse>("/state"),
    enabled: active,
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchInterval: (query) => (active ? (query.state.data?.writing.length ? 2_000 : 30_000) : false),
    refetchIntervalInBackground: false,
  });

  const actionMutation = useMutation({
    mutationFn: (action: SaucelingUserAction) =>
      saucelingsRequest<SaucelingStateResponse>("/action", "POST", { action }),
    onMutate: () => ({ arrived: stageHandle.current?.comeOver() ?? Promise.resolve() }),
    onSuccess: (next, action, context) => {
      queryClient.setQueryData(["saucelings", "state"], next);
      refreshNow();
      void context.arrived.then(() => {
        playReaction(action);
        if (action !== "talk") showCaring(action);
      });
    },
  });

  const state = stateQuery.data;
  const pet = state?.world.activePet;
  const isCharacter = Boolean(pet && state?.characters.some((ch) => ch.id === pet.caretakerId));
  const avatar = useCaretakerAvatar(pet?.caretakerId ?? "", isCharacter);
  // The caretaker stands on the large widget's stage too, as in the Nook.
  const caretakerSprites = useCaretakerSprites(pet?.caretakerId ?? "", isCharacter && !compact);
  const figureId = pet && !compact ? state?.world.caretakerFigures[pet.caretakerId] : undefined;
  const figure = useCaretakerFigure(figureId);
  const motion = useCaretakerMotion(figureId, figure);
  // The large widget's stage shows the Nook's background, shared with the Nook under the same key.
  const backgroundId = pet?.backgroundId ?? null;
  const backgroundQuery = useQuery({
    queryKey: ["saucelings", "background", backgroundId],
    queryFn: () => saucelingsRequest<{ image: string }>(`/background/${encodeURIComponent(backgroundId ?? "")}`),
    enabled: active && !compact && backgroundId !== null,
    staleTime: Infinity,
  });
  const backgroundSrc = backgroundId ? (backgroundQuery.data?.image ?? null) : null;

  // Until the first answer there is no telling an empty nook from one that has not loaded.
  if (!state) {
    return (
      <div className="sl-widget" style={{ display: "grid", gap: "0.5rem", fontSize: "0.8rem" }}>
        <span style={{ opacity: 0.75 }}>
          {stateQuery.isError ? t("saucelings.error.load") : t("saucelings.loading")}
        </span>
        {stateQuery.isError ? (
          <div>
            <button type="button" className="sl-btn" onClick={() => void stateQuery.refetch()}>
              {t("saucelings.error.retry")}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!pet) {
    return (
      <section className="sl-widget" aria-label={t("saucelings.title")}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <SaucelingSprite
            species="rigamuffin"
            stage="egg"
            mood="content"
            assetUrl={assetUrl}
            alt={t("saucelings.empty.eggAlt")}
            scale={1}
            still={!active}
          />
          <div>
            <button
              type="button"
              className="sl-widget-open"
              style={{ fontWeight: 600, fontSize: "0.85rem" }}
              onClick={() => onOpenNoodle?.()}
            >
              {t("saucelings.empty.title")}
            </button>
            <div style={{ fontSize: "0.72rem", opacity: 0.75 }}>{t("saucelings.widget.emptyHint")}</div>
          </div>
        </div>
      </section>
    );
  }

  const isEgg = pet.stage === "egg";
  const kind = petKind(pet);
  const temper = temperamentOf(pet);
  const sauce = temper?.sauce ?? null;
  const sprite = spriteStateForPet(pet);
  const sauceStyle = (
    sauce ? { "--sl-sauce-accent": sauce.accentColor, "--sl-sauce-bg": sauce.badgeBg } : {}
  ) as CSSProperties;

  // The newest journal entry is the line both widgets show; the AI pill follows whether a model wrote it.
  const latest = pet.journal[0];
  const petName = isEgg ? t("saucelings.egg.name") : pet.name;
  const heading = (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "0.875rem" }}>
          {compact ? (
            <button
              type="button"
              className="sl-widget-open"
              aria-label={t("saucelings.widget.open", { name: petName })}
              onClick={() => onOpenNoodle?.()}
            >
              {petName}
            </button>
          ) : (
            petName
          )}
        </strong>
        {isEgg || !temper ? null : (
          <span className="sl-badge" style={{ fontSize: "0.65rem", padding: "0.1rem 0.45rem" }} title={temper.readsAs}>
            {sauce
              ? t("saucelings.pet.sauce", { sauce: sauce.name })
              : t("saucelings.pet.temperament", { temperament: temper.name })}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", marginTop: "0.15rem" }}>
        <CaretakerAvatar name={pet.careProfile.characterName} src={avatar} small />
        <span style={{ opacity: 0.75, minWidth: 0 }}>
          {isEgg
            ? `${t("saucelings.pet.eggCaretaker")} ${pet.careProfile.characterName}`
            : `${kind.name} · ${t("saucelings.pet.caretaker")} ${pet.careProfile.characterName}`}
        </span>
      </div>
    </div>
  );

  // Three meters
  const meters = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem", fontSize: "0.68rem" }}>
      {isEgg ? (
        <>
          <WidgetMeter label={t("saucelings.meter.warmth")} value={eggWarmth(pet)} gap={state?.gaps.warmth} />
          <WidgetMeter label={t("saucelings.meter.hatching")} value={hatchPercent(pet, nowMs)} />
        </>
      ) : (
        <>
          <WidgetMeter label={t("saucelings.meter.hunger")} value={pet.meters.hunger} gap={state?.gaps.hunger} />
          <WidgetMeter label={t("saucelings.meter.mood")} value={pet.meters.mood} gap={state?.gaps.mood} />
        </>
      )}
      <WidgetMeter label={t("saucelings.meter.bond")} value={pet.meters.bond} />
    </div>
  );

  const remark = (
    <p
      style={{
        margin: 0,
        fontSize: "0.75rem",
        opacity: 0.85,
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "-webkit-box",
        WebkitLineClamp: compact ? 1 : 2,
        WebkitBoxOrient: "vertical",
      }}
    >
      {latest?.generated ? (
        <span className="sl-pill sl-pill--ai" style={{ marginRight: "0.35rem" }}>
          {t("saucelings.journal.generated")}
        </span>
      ) : null}
      {state?.latestRemark}
    </p>
  );

  if (compact) {
    return (
      <section className="sl-widget" style={sauceStyle} aria-label={petName}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <PetSprite
            art={pet}
            species={pet.species}
            stage={sprite.stage}
            mood={shownFace(sprite.mood, reaction?.action ?? null, null)}
            assetUrl={assetUrl}
            alt={isEgg ? t("saucelings.egg.name") : pet.name}
            scale={1}
            still={!active}
            reaction={reaction}
          />
          {heading}
        </div>
        {meters}
        {remark}
      </section>
    );
  }

  // They look worried while a gap is open and turn to the pet for your care; their lines play out in the Nook.
  const standing = state
    ? standingCaretaker(
        figure,
        caretakerSprites,
        caretakerPose({ gaps: state.gaps, line: null, speaking: false, cheering: false, caring }),
        motion,
      )
    : null;

  // The large widget: the Nook's stage fills the card, with thin bars and the care buttons over it, walking only
  // while Home is the tab in view.
  const bars: { key: keyof typeof BAR_ICONS; label: string; value: number; gap?: boolean }[] = isEgg
    ? [
        { key: "warmth", label: t("saucelings.meter.warmth"), value: eggWarmth(pet), gap: state?.gaps.warmth },
        { key: "hatching", label: t("saucelings.meter.hatching"), value: hatchPercent(pet, nowMs), gap: false },
      ]
    : [
        { key: "hunger", label: t("saucelings.meter.hunger"), value: pet.meters.hunger, gap: state?.gaps.hunger },
        { key: "mood", label: t("saucelings.meter.mood"), value: pet.meters.mood, gap: state?.gaps.mood },
      ];
  bars.push({ key: "bond", label: t("saucelings.meter.bond"), value: pet.meters.bond, gap: false });

  return (
    // A tap on the card (an egg's stage, the bars, the strip) opens Saucelings for a pointer; the open button below
    // is the same step for a keyboard or screen reader.
    <section
      className="sl-widget sl-widget--stage"
      style={sauceStyle}
      aria-label={petName}
      onClick={() => onOpenNoodle?.()}
    >
      <div className="sl-widget-body">
        {/* A tap on a hatched pet calls it over instead of opening the Nook. */}
        <div
          className="sl-widget-stage"
          onClick={(e) => {
            if (!isEgg) e.stopPropagation();
          }}
        >
          <SaucelingStage
            pet={pet}
            reaction={reaction}
            assetUrl={assetUrl}
            backgroundSrc={backgroundSrc}
            paused={!active}
            caretaker={standing}
            caretakerFlipped={state?.world.flippedCaretakers.includes(pet.caretakerId)}
            handle={stageHandle}
            scaleByWidth
          />
        </div>
        <div className="sl-widget-remark" aria-live="polite">
          {restNote === null && latest?.generated ? (
            <span className="sl-pill sl-pill--ai">{t("saucelings.journal.generated")}</span>
          ) : null}
          <p>{restNote ?? state.latestRemark}</p>
        </div>
        <div className="sl-widget-hud">
          <div className="sl-widget-bars">
            {bars.map((bar) => (
              <WidgetBar key={bar.key} icon={BAR_ICONS[bar.key]} label={bar.label} value={bar.value} gap={bar.gap} />
            ))}
          </div>
          <div className="sl-widget-acts">
            <button
              type="button"
              className="sl-btn sl-widget-act"
              aria-label={t("saucelings.widget.open", { name: petName })}
              title={t("saucelings.widget.open", { name: petName })}
              onClick={() => onOpenNoodle?.()}
            >
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
        <div
          className="sl-widget-care"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape" && careOpen) {
              e.stopPropagation();
              setCareOpen(false);
              careToggle.current?.focus();
            }
          }}
        >
          {actionMutation.error ? (
            <span role="alert" className="sl-error sl-widget-care-error">
              <FriendlyError error={actionMutation.error} />
            </span>
          ) : null}
          <div className="sl-widget-care-row">
            {careOpen
              ? actionsFor(pet).map((action) => {
                  const wait = cooldownMinutes(pet, action, nowMs);
                  const label = t(ACTION_LABEL_KEYS[action]);
                  const text = wait > 0 ? `${label} · ${t("saucelings.action.wait", { minutes: wait })}` : label;
                  return (
                    <button
                      key={action}
                      type="button"
                      className={`sl-btn sl-widget-act ${state && actionCoversGap(action, state.gaps) ? "sl-btn--gap" : ""}`}
                      aria-label={text}
                      title={text}
                      disabled={actionMutation.isPending}
                      // A resting button stays tappable, so a tap (or a screen reader) hears when it is ready.
                      aria-disabled={wait > 0 || undefined}
                      onClick={() =>
                        wait > 0
                          ? showRestNote(t("saucelings.action.resting", { action: label, minutes: wait }))
                          : actionMutation.mutate(action)
                      }
                    >
                      <span aria-hidden="true">{ACTION_ICONS[action]}</span>
                      {/* A resting button has no room for words, so its minutes sit in the corner. */}
                      {wait > 0 ? (
                        <span className="sl-widget-act-wait" aria-hidden="true">
                          {wait}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              : null}
            {/* Closed, the toggle still points at a gap, so the player knows to open it. */}
            <button
              ref={careToggle}
              type="button"
              className={`sl-btn sl-widget-act ${!careOpen && state && actionsFor(pet).some((a) => actionCoversGap(a, state.gaps)) ? "sl-btn--gap" : ""}`}
              aria-expanded={careOpen}
              aria-label={t("saucelings.widget.care")}
              title={t("saucelings.widget.care")}
              onClick={() => setCareOpen((open) => !open)}
            >
              <span aria-hidden="true">{careOpen ? "✕" : "🤲"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
