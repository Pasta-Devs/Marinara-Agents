import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, type CSSProperties } from "react";
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

/** The large widget's bar: a small picture and a thin unlabeled bar, read out by the tooltip and the meter role. */
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
      <div
        className="sl-widget"
        role="button"
        tabIndex={0}
        onClick={() => onOpenNoodle?.()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpenNoodle?.();
        }}
      >
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
            <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{t("saucelings.empty.title")}</div>
            <div style={{ fontSize: "0.72rem", opacity: 0.75 }}>{t("saucelings.widget.emptyHint")}</div>
          </div>
        </div>
      </div>
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

  const heading = (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "0.875rem" }}>{isEgg ? t("saucelings.egg.name") : pet.name}</strong>
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
      {state?.latestRemark}
    </p>
  );

  const openOnKey = (e: { key: string }) => {
    if (e.key === "Enter" || e.key === " ") onOpenNoodle?.();
  };

  if (compact) {
    return (
      <div
        className="sl-widget"
        style={sauceStyle}
        role="button"
        tabIndex={0}
        onClick={() => onOpenNoodle?.()}
        onKeyDown={openOnKey}
      >
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
      </div>
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
    <div
      className="sl-widget sl-widget--stage"
      style={sauceStyle}
      role="button"
      tabIndex={0}
      aria-label={isEgg ? t("saucelings.egg.name") : pet.name}
      onClick={() => onOpenNoodle?.()}
      onKeyDown={openOnKey}
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
          />
        </div>
        <div className="sl-widget-hud">
          <div className="sl-widget-bars">
            {bars.map((bar) => (
              <WidgetBar key={bar.key} icon={BAR_ICONS[bar.key]} label={bar.label} value={bar.value} gap={bar.gap} />
            ))}
          </div>
          <div className="sl-widget-acts" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {actionsFor(pet)
              .slice(0, 2)
              .map((action) => {
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
                    disabled={actionMutation.isPending || wait > 0}
                    onClick={() => actionMutation.mutate(action)}
                  >
                    <span aria-hidden="true">{ACTION_ICONS[action]}</span>
                  </button>
                );
              })}
            {actionMutation.error ? (
              <span role="alert" style={{ color: "#f87171", fontSize: "0.8rem" }}>
                {actionMutation.error.message}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
