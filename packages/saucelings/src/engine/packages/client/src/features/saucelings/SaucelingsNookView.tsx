import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type {
  SaucelingCharacterSummary,
  SaucelingStateResponse,
  SaucelingSpecialSpeciesId,
  SaucelingTendencyKey,
  SaucelingUnlocks,
  SaucelingUserAction,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { SAUCELING_GROWTH_MIN_HUNGER } from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  CARETAKER_SPEECH_KINDS,
  petKind,
  SPECIES_CATALOG,
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
  hatchDueAt,
  hatchPercent,
  useCaretakerAvatar,
  useCaretakerFigure,
  useCaretakerMotion,
  useCaretakerSprites,
  useForAMoment,
  useNow,
  usePanelAtLeast,
} from "./care-ui.js";
import { BackgroundPicker } from "./BackgroundPicker.js";
import { CaretakerBox } from "./CaretakerBox.js";
import { EvolveButton, UndoEvolution } from "./EvolveDialog.js";
import { caretakerCareAction, caretakerPose, standingCaretaker } from "./caretaker-look.js";
import { CaretakerFlip, FigurePainter, FormPainter, FormRepaint, PetFlip } from "./FormPainter.js";
import { HelpTip } from "./HelpTip.js";
import { mariPose, NookTour, tourSeen } from "./NookTour.js";
import { useSaucelingsTranslation } from "./localization.js";
import { SaucelingSprite, useSpriteReaction } from "./SaucelingSprite.js";
import { RareMark } from "./RareMark.js";
import { SaucelingStage, type SaucelingStageHandle } from "./SaucelingStage.js";

/** When the next new egg can come, in local time: one a UTC day (the server's `lastNewEggDay`), so null until one has
 *  come today. */
function nextEggTime(lastNewEggDay: string | null, nowMs: number): string | null {
  const now = new Date(nowMs);
  if (lastNewEggDay !== now.toISOString().slice(0, 10)) return null;
  now.setUTCHours(24, 0, 0, 0);
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Caretaker and the button that brings an egg; used for the first egg and for a swap. The egg has no
 *  name: the player names it once it hatches. */
function EggForm({
  characters,
  defaultCaretakerId,
  submitLabel,
  pending,
  readyAt,
  onSubmit,
  onCancel,
}: {
  characters: SaucelingCharacterSummary[];
  defaultCaretakerId: string;
  submitLabel: string;
  pending: boolean;
  /** Set while today's new egg has already come: the button waits and says when the next one is ready. */
  readyAt: string | null;
  onSubmit: (input: { characterId: string }) => void;
  onCancel?: () => void;
}) {
  const { t } = useSaucelingsTranslation();
  const [caretakerId, setCaretakerId] = useState(defaultCaretakerId);
  const caretaker = characters.find((ch) => ch.id === caretakerId);
  const avatar = useCaretakerAvatar(caretakerId, Boolean(caretaker));
  return (
    <div
      className="sl-egg-form"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.6rem",
        justifyContent: "center",
        alignItems: "center",
        marginTop: "0.5rem",
      }}
    >
      <CaretakerAvatar name={caretaker?.name ?? t("saucelings.empty.houseCaretaker")} src={avatar} />
      <select
        className="sl-select"
        value={caretakerId}
        onChange={(e) => setCaretakerId(e.target.value)}
        aria-label={t("saucelings.empty.pickCaretaker")}
      >
        {characters.length === 0 ? (
          <option value="caretaker">{t("saucelings.empty.houseCaretaker")}</option>
        ) : (
          characters.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))
        )}
      </select>
      <button
        type="button"
        className="sl-btn sl-btn--primary"
        disabled={pending || readyAt !== null}
        onClick={() => onSubmit({ characterId: caretakerId })}
      >
        {pending ? t("saucelings.empty.bringingEgg") : submitLabel}
      </button>
      {onCancel ? (
        <button type="button" className="sl-btn" onClick={onCancel}>
          {t("saucelings.common.cancel")}
        </button>
      ) : null}
      {readyAt ? (
        <p style={{ flexBasis: "100%", margin: 0, fontSize: "0.8rem", opacity: 0.7, textAlign: "center" }}>
          {t("saucelings.swap.wait", { time: readyAt })}
        </p>
      ) : null}
      {characters.length === 0 ? (
        <p style={{ flexBasis: "100%", margin: 0, fontSize: "0.8rem", opacity: 0.7, textAlign: "center" }}>
          {t("saucelings.empty.houseCaretakerNote")}
        </p>
      ) : null}
    </div>
  );
}

/** What a new egg may be: each special egg's milestone, and the Halloween ones. A closed section under the egg button,
 *  so a first visit sees only the button. */
function SpecialEggs({ unlocks }: { unlocks: SaucelingUnlocks }) {
  const { t } = useSaucelingsTranslation();
  const specials: SaucelingSpecialSpeciesId[] = ["prismite", "thundrake", "clockrit"];
  const have = specials.filter((id) => unlocks[id].done).length + (unlocks.halloween ? 1 : 0);
  return (
    <details className="sl-unlocks">
      <summary>{t("saucelings.unlocks.title", { have, total: specials.length + 1 })}</summary>
      <ul>
        {specials.map((id) => (
          <li key={id}>
            {unlocks[id].done
              ? t("saucelings.unlocks.done", { name: SPECIES_CATALOG[id].name })
              : t(`saucelings.unlocks.${id}`, { ...unlocks[id] })}
          </li>
        ))}
        <li>{unlocks.halloween ? t("saucelings.unlocks.halloweenNow") : t("saucelings.unlocks.halloween")}</li>
      </ul>
    </details>
  );
}

/** One meter in the strip under the stage: label and value on a line, the bar beneath; amber when it is a gap. Its
 *  name opens what it means. A `keepGap` note still shows on a phone, where the others leave it to the colour. */
function Meter({
  label,
  help,
  value,
  gapLabel,
  keepGap = false,
}: {
  label: string;
  help: string;
  value: number;
  gapLabel?: string | null;
  keepGap?: boolean;
}) {
  return (
    <div className={`sl-meter-box ${gapLabel ? "sl-meter-box--gap" : ""}`} title={gapLabel ?? undefined}>
      <div className="sl-meter-head">
        <HelpTip text={help} trigger={label} />
        <span className="sl-meter-value">{value}%</span>
      </div>
      <div className="sl-meter-bar">
        <div className={`sl-meter-fill ${gapLabel ? "sl-meter-fill--gap" : ""}`} style={{ width: `${value}%` }} />
      </div>
      {gapLabel ? <div className={`sl-meter-gap ${keepGap ? "sl-meter-gap--keep" : ""}`}>{gapLabel}</div> : null}
    </div>
  );
}

/** The caretaker care line whose effect the stage last played. It lives as long as the page, so you see their
 *  latest care when you open the Nook, and not again each time you come back to the tab. */
let lastShownCareId: string | null = null;
/** How long the caretaker looks happy after you fill a gap or good news lands. */
const CHEER_MS = 4_000;
/** The kinds of line that are good news. */
const NEWS_KINDS = ["hatch", "stage-up", "evolve-offer", "evolve"];

/** The panel width at which the care card moves beside the stage; the same as the styles' container query. */
const SIDE_BY_SIDE_REM = 48;

/** Everything that changes the nook behind one "⋯" button, so the stage bar holds a single control. */
function NookMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const away = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  return (
    <details
      ref={ref}
      className="sl-menu"
      data-sl-tour="menu"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        close();
        ref.current?.querySelector("summary")?.focus();
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest(".sl-menu-list button")) close();
      }}
    >
      <summary className="sl-btn sl-btn--small" aria-label={label} title={label}>
        ⋯
      </summary>
      <div className="sl-menu-list">{children}</div>
    </details>
  );
}

/** A panel the "⋯" menu opens under the nook. It takes focus as it opens, so it scrolls into view and a keyboard lands
 *  in it; ✕ or Escape closes it. */
function NookPanel({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <section
      ref={ref}
      className="sl-card sl-panel"
      tabIndex={-1}
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="sl-panel-head">
        <h3>{title}</h3>
        <button
          type="button"
          className="sl-btn sl-btn--small"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {children}
    </section>
  );
}

export function SaucelingsNookView({
  state,
  packageId,
  packageVersion,
  askVoice,
}: {
  state: SaucelingStateResponse;
  packageId?: string;
  packageVersion?: string | null;
  /** Offers to make a caretaker's own voice when they have none (see VoiceDialog.tsx). */
  askVoice: (characterId: string) => void;
}) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const pet = state.world.activePet;
  const characters = state.characters;
  const [confirmRetire, setConfirmRetire] = useState(false);
  // The caretaker picked in the Caretaker panel, waiting for Hand over; Cancel puts the select back.
  const [handOverTo, setHandOverTo] = useState<SaucelingCharacterSummary | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const [nudgePick, setNudgePick] = useState<SaucelingTendencyKey>("feedReliability");
  // Mari's tour; `then` runs as it closes (the voice offer after a first egg).
  const [tour, setTour] = useState<{ then?: () => void } | null>(null);
  const [reaction, playReaction] = useSpriteReaction();
  // A care has the pet come over to the caretaker first (see the stage director).
  const stageHandle = useRef<SaucelingStageHandle>(null);
  const [nowMs, refreshNow] = useNow(15_000);
  const assetUrl = (path: string) => packageAssetUrl(packageId, path, packageVersion);

  // A custom background is its own request, so the state stays small; it loads once per picture.
  const backgroundId = pet?.backgroundId ?? null;
  const backgroundQuery = useQuery({
    queryKey: ["saucelings", "background", backgroundId],
    queryFn: () => saucelingsRequest<{ image: string }>(`/background/${encodeURIComponent(backgroundId ?? "")}`),
    enabled: backgroundId !== null,
    staleTime: Infinity,
  });
  const backgroundSrc = backgroundId ? (backgroundQuery.data?.image ?? null) : null;
  // The panel the "⋯" menu opened, one at a time; choosing it again closes it.
  const [panel, setPanel] = useState<"background" | "caretaker" | "looks" | "egg" | null>(null);
  const togglePanel = (next: NonNullable<typeof panel>) => setPanel((open) => (open === next ? null : next));
  const closePanel = () => {
    setPanel(null);
    document.querySelector<HTMLElement>(".sl-nook .sl-menu > summary")?.focus();
  };

  // The player's own latest care line shows under the care buttons for a few seconds, then fades.
  const lastCare = pet?.journal.find((ev) => ev.kind === "user-care" || ev.kind === "nudge") ?? null;
  const careId = lastCare?.id;
  const careText = lastCare?.text;
  const seenCareId = useRef(careId);
  // A tap on a resting care button says when it is ready again in the same line.
  const [careNote, setCareNote] = useState({ text: "", shown: false });
  const noteTimer = useRef(0);
  const showNote = (text: string) => {
    setCareNote({ text, shown: true });
    window.clearTimeout(noteTimer.current);
    // The words stay while the line fades out.
    noteTimer.current = window.setTimeout(() => setCareNote((note) => ({ ...note, shown: false })), 6_000);
  };
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);
  useEffect(() => {
    if (!careId || careId === seenCareId.current) return;
    seenCareId.current = careId;
    showNote(careText ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careId, careText]);

  // Check in and Ask sit in the caretaker's box when the care card is beside the stage; on a narrower panel they
  // go under the care buttons, so the buttons stay near the pet.
  const [panelRef, sideBySide] = usePanelAtLeast(SIDE_BY_SIDE_REM);
  // The caretaker stands in the scene when the Engine has sprites for them.
  const caretakerSprites = useCaretakerSprites(
    pet?.caretakerId ?? "",
    characters.some((ch) => ch.id === pet?.caretakerId),
  );
  // A caretaker painted for the Nook stands as their pixel figure instead.
  const figureId = pet ? state.world.caretakerFigures[pet.caretakerId] : undefined;
  const figure = useCaretakerFigure(figureId);
  // They breathe as the pet does, and their eyes shut now and then when the figure's eyes can be found.
  const motion = useCaretakerMotion(figureId, figure);
  // Their newest line, once its words are in: the pet listens to it, and a line about their care plays it once.
  const newestLine = pet?.journal.find((ev) => CARETAKER_SPEECH_KINDS.includes(ev.kind)) ?? null;
  const heardLine = newestLine && !state.writing.includes(newestLine.id) ? newestLine : null;
  const careEffect = heardLine?.kind === "caretaker-care" ? caretakerCareAction(heardLine.outcome) : null;
  const careEffectId = careEffect ? (heardLine?.id ?? null) : null;
  // A painted caretaker turns to the pet for the care that plays: theirs, or yours. The pet comes over first.
  const [caring, showCaring] = useForAMoment<SaucelingUserAction>(CARE_POSE_MS);
  useEffect(() => {
    if (!careEffect || !careEffectId || careEffectId === lastShownCareId) return;
    lastShownCareId = careEffectId;
    void (stageHandle.current?.comeOver() ?? Promise.resolve()).then(() => {
      playReaction(careEffect);
      showCaring(careEffect);
    });
  }, [careEffect, careEffectId, playReaction, showCaring]);
  // They look happy for a moment after you fill a gap, and as good news lands while you watch.
  const [cheering, cheer] = useForAMoment<true>(CHEER_MS);
  const newsId = heardLine && NEWS_KINDS.includes(heardLine.kind) ? heardLine.id : null;
  const cheeredId = useRef(newsId);
  useEffect(() => {
    if (!newsId || newsId === cheeredId.current) return;
    cheeredId.current = newsId;
    cheer(true);
  }, [newsId, cheer]);
  // Their newest line types out in the box.
  const [typing, setTyping] = useState(false);
  // A cared-for egg hatches on the first state read after its wait, so read it then.
  const hatchDue = hatchDueAt(pet);
  useEffect(() => {
    if (hatchDue === null) return;
    const timer = window.setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: ["saucelings", "state"] }),
      Math.max(0, hatchDue - Date.now()) + 1_000,
    );
    return () => window.clearTimeout(timer);
  }, [hatchDue, queryClient]);

  const updateState = (next: SaucelingStateResponse) => {
    setFailure(null);
    queryClient.setQueryData(["saucelings", "state"], next);
  };
  const showError = (err: unknown) => setFailure(err ?? new Error(t("saucelings.error.request")));

  const adoptMutation = useMutation({
    mutationFn: (payload: { characterId: string; swap?: boolean }) =>
      saucelingsRequest<SaucelingStateResponse>("/adopt", "POST", payload),
    onSuccess: (next) => {
      setPanel(null);
      updateState(next);
    },
    onError: showError,
  });

  const actionMutation = useMutation({
    mutationFn: (action: SaucelingUserAction) =>
      saucelingsRequest<SaucelingStateResponse>("/action", "POST", { action }),
    // The pet sets off for the caretaker as you tap, and the care plays once it is there and the answer is in.
    onMutate: () => ({ arrived: stageHandle.current?.comeOver() ?? Promise.resolve() }),
    onSuccess: (next, action, context) => {
      updateState(next);
      refreshNow();
      void context.arrived.then(() => {
        playReaction(action);
        // They join in, except when you talk to the egg: they would seem to be the one talking.
        if (action !== "talk") showCaring(action);
      });
    },
    onError: showError,
  });

  const checkInMutation = useMutation({
    mutationFn: () => saucelingsRequest<SaucelingStateResponse>("/check-in", "POST", {}),
    onSuccess: updateState,
    onError: showError,
  });

  const nudgeMutation = useMutation({
    mutationFn: (tendency: SaucelingTendencyKey) =>
      saucelingsRequest<SaucelingStateResponse>("/nudge", "POST", { tendency }),
    onSuccess: (next) => {
      updateState(next);
      // A tick up to 15 s old would show a fresh ask as 49 hours left.
      refreshNow();
    },
    onError: showError,
  });

  const patchPetMutation = useMutation({
    mutationFn: (payload: { name?: string; caretakerId?: string; eggSpot?: { x: number; y: number } }) =>
      saucelingsRequest<SaucelingStateResponse>("/pet", "PATCH", payload),
    onSuccess: (data, payload) => {
      // Moving the egg must not discard a rename or a hand-over pick still being made.
      if (payload.name !== undefined) setEditingName(false);
      if (payload.caretakerId !== undefined) setHandOverTo(null);
      updateState(data);
      // A new caretaker with no voice of their own is offered one once they have said hello.
      if (payload.caretakerId) askVoice(payload.caretakerId);
    },
    onError: showError,
  });

  // Reads the caretaker's card again, so an edit to it reaches their care profile and their phrasebook.
  const refreshVoiceMutation = useMutation({
    mutationFn: ({ characterId, name }: { characterId: string; name: string }) =>
      saucelingsRequest<SaucelingStateResponse>("/voice", "POST", { characterId }).catch(() => {
        throw new Error(t("saucelings.voice.failed", { name }));
      }),
    onSuccess: updateState,
    onError: showError,
  });
  // The egg comes first; a caretaker with no voice of their own is offered one once it is in the nook, after Mari's
  // tour on a first egg.
  const adopt = (input: { characterId: string; swap?: boolean }) =>
    adoptMutation.mutate(input, {
      onSuccess: () => {
        const offerVoice = () => askVoice(input.characterId);
        if (input.swap || tourSeen()) offerVoice();
        else setTour({ then: offerVoice });
      },
    });

  const retireMutation = useMutation({
    mutationFn: () => saucelingsRequest<SaucelingStateResponse>("/retire", "POST", {}),
    onSuccess: (next) => {
      setConfirmRetire(false);
      updateState(next);
    },
    onError: showError,
  });

  if (!pet) {
    return (
      <div className="sl-card" style={{ display: "grid", gap: "1rem", textAlign: "center", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <SaucelingSprite
            species="rigamuffin"
            stage="egg"
            mood="content"
            assetUrl={assetUrl}
            alt={t("saucelings.empty.eggAlt")}
            scale={2}
          />
        </div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>{t("saucelings.empty.title")}</h2>
        <p style={{ fontSize: "0.85rem", opacity: 0.8, maxWidth: "32rem", margin: "0 auto" }}>
          {t("saucelings.empty.body")}
        </p>
        {tourSeen() ? null : (
          <div className="sl-mari-line">
            <img src={mariPose("wave")} alt="" onError={(event) => (event.currentTarget.hidden = true)} />
            <p>{t("saucelings.empty.mari")}</p>
          </div>
        )}
        <EggForm
          characters={characters}
          defaultCaretakerId={characters[0]?.id ?? "caretaker"}
          submitLabel={t("saucelings.empty.bringEgg")}
          pending={adoptMutation.isPending}
          readyAt={nextEggTime(state.world.lastNewEggDay, nowMs)}
          onSubmit={adopt}
        />
        <SpecialEggs unlocks={state.unlocks} />
        {failure ? (
          <p role="alert" className="sl-error" style={{ margin: 0 }}>
            <FriendlyError error={failure} />
          </p>
        ) : null}
      </div>
    );
  }

  const isEgg = pet.stage === "egg";
  const sp = petKind(pet);
  const temper = temperamentOf(pet);
  const sauce = temper?.sauce ?? null;
  // A hatchling keeps its kind's name until the player gives it one.
  const unnamed = pet.name === sp.name;
  const caretakerName = pet.careProfile.characterName;
  const isCharacter = characters.some((ch) => ch.id === pet.caretakerId);
  // Someone to hand over to, or a caretaker card to refresh, paint or flip.
  const caretakerControls = characters.length > 1 || isCharacter;
  const hatching = hatchPercent(pet, nowMs);
  // A hungry sauceling stops growing; the Hunger meter says so in its note.
  const growthPaused = !pet.lockedStage && pet.stage !== "elder" && pet.meters.hunger < SAUCELING_GROWTH_MIN_HUNGER;
  // A sauceling that is not pasta keeps the house colours.
  const sauceStyle = (
    sauce ? { "--sl-sauce-accent": sauce.accentColor, "--sl-sauce-bg": sauce.badgeBg } : {}
  ) as CSSProperties;
  const nudges: Array<{ tendency: SaucelingTendencyKey; label: string }> = isEgg
    ? [
        { tendency: "feedReliability", label: t("saucelings.nudge.warm") },
        { tendency: "affection", label: t("saucelings.nudge.talk") },
      ]
    : [
        { tendency: "feedReliability", label: t("saucelings.nudge.meals") },
        { tendency: "overfeeding", label: t("saucelings.nudge.portions") },
        { tendency: "playfulness", label: t("saucelings.nudge.play") },
        { tendency: "affection", label: t("saucelings.nudge.cuddles") },
      ];
  // The egg and the hatchling offer different asks; an ask the pet no longer has falls back to the first.
  const nudge = nudges.some((n) => n.tendency === nudgePick) ? nudgePick : nudges[0].tendency;
  // The asks still on, worded for what they help with now: an egg's "keep it warm" is "remember meals" once hatched.
  const asked = nudges.flatMap((option) => {
    const on = pet.nudges.find((n) => n.tendency === option.tendency && Date.parse(n.expiresAt) > nowMs);
    if (!on) return [];
    const hours = Math.ceil((Date.parse(on.expiresAt) - nowMs) / 3_600_000);
    return [t("saucelings.nudge.left", { ask: option.label, hours })];
  });
  const caretakerLines = pet.journal.filter((ev) => CARETAKER_SPEECH_KINDS.includes(ev.kind));
  // It follows how things are now, not an older line paged back to in the box.
  const pose = caretakerPose({
    gaps: state.gaps,
    line: newestLine,
    speaking: typing || (newestLine !== null && state.writing.includes(newestLine.id)),
    cheering: cheering !== null,
    caring,
  });
  // While a painted figure loads, nobody stands and the box leaves its picture out, so neither flashes before it.
  const standing = standingCaretaker(figure, caretakerSprites, pose, motion);

  const startRename = () => {
    setRenameValue(unnamed ? "" : pet.name);
    setEditingName(true);
  };

  // Check in and Ask: in the caretaker's box beside a wide panel's care card, under the care buttons otherwise.
  const talk = (
    <>
      <div className="sl-care-row" data-sl-tour="caretaker">
        <button
          type="button"
          className="sl-btn"
          disabled={checkInMutation.isPending}
          onClick={() => checkInMutation.mutate()}
        >
          {checkInMutation.isPending
            ? t("saucelings.checkIn.pending", { name: caretakerName })
            : `💬 ${t("saucelings.checkIn.button", { name: caretakerName })}`}
        </button>
      </div>

      <details className="sl-ask" data-sl-tour="caretaker">
        <summary>
          {t("saucelings.nudge.heading", { name: caretakerName })}…
          {asked.length > 0 ? (
            <span className="sl-care-note"> {t("saucelings.nudge.active", { asks: asked.join(", ") })}</span>
          ) : null}
        </summary>
        <div className="sl-care-row sl-ask-row">
          <select
            id="sl-nudge-pick"
            className="sl-select sl-select--small"
            aria-label={t("saucelings.nudge.heading", { name: caretakerName })}
            value={nudge}
            onChange={(e) => setNudgePick(e.target.value as SaucelingTendencyKey)}
          >
            {nudges.map((option) => (
              <option key={option.tendency} value={option.tendency}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="sl-btn sl-btn--small"
            disabled={nudgeMutation.isPending}
            onClick={() => nudgeMutation.mutate(nudge)}
          >
            {t("saucelings.nudge.ask")}
          </button>
          <span className="sl-care-note">{t("saucelings.nudge.note")}</span>
        </div>
      </details>
    </>
  );
  return (
    <div ref={panelRef} className="sl-nook" style={sauceStyle}>
      {failure ? (
        <div
          role="alert"
          className="sl-card"
          style={{ borderColor: "#ef4444", color: "#fca5a5", fontSize: "0.8125rem", padding: "0.65rem 1rem" }}
        >
          <FriendlyError error={failure} />
        </div>
      ) : null}

      {pet.retireReady ? (
        <div className="sl-card sl-retire">
          {confirmRetire ? (
            <>
              <span>{t("saucelings.retire.confirmNote", { name: pet.name })}</span>
              <button
                type="button"
                className="sl-btn sl-btn--primary"
                disabled={retireMutation.isPending}
                onClick={() => retireMutation.mutate()}
              >
                {t("saucelings.retire.confirm")}
              </button>
              <button type="button" className="sl-btn" onClick={() => setConfirmRetire(false)}>
                {t("saucelings.common.cancel")}
              </button>
            </>
          ) : (
            <>
              <span>{t("saucelings.retire.ready", { name: pet.name })}</span>
              <button type="button" className="sl-btn sl-btn--primary" onClick={() => setConfirmRetire(true)}>
                📖 {t("saucelings.retire.button")}
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* The stage card holds the name, the stage and the caretaker's box joined under it, with Check in and Ask;
          the care card, and under it an open Background, Caretaker, Looks or New egg panel, are beside it on a wide
          panel and under it on a phone. */}
      <div className="sl-nook-main">
        <div className="sl-card sl-stage-card">
          <div className="sl-stage-bar">
            {editingName ? (
              <div className="sl-rename">
                <input
                  className="sl-input"
                  style={{ flex: "1 1 8rem", width: "100%" }}
                  value={renameValue}
                  maxLength={40}
                  placeholder={t("saucelings.pet.namePlaceholder")}
                  aria-label={t("saucelings.pet.namePlaceholder")}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
                <button
                  type="button"
                  className="sl-btn sl-btn--primary"
                  disabled={!renameValue.trim() || patchPetMutation.isPending}
                  onClick={() => patchPetMutation.mutate({ name: renameValue })}
                >
                  {t("saucelings.common.save")}
                </button>
                <button type="button" className="sl-btn" onClick={() => setEditingName(false)}>
                  {t("saucelings.common.cancel")}
                </button>
              </div>
            ) : (
              <div className="sl-stage-title">
                <div className="sl-stage-name">
                  <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0, overflowWrap: "anywhere" }}>
                    {isEgg ? t("saucelings.egg.name") : pet.name}
                  </h2>
                  {isEgg ? null : <RareMark pet={pet} />}
                  {isEgg || !unnamed ? null : (
                    <button type="button" className="sl-btn sl-btn--small sl-btn--primary" onClick={startRename}>
                      {t("saucelings.pet.nameIt")}
                    </button>
                  )}
                </div>
                {isEgg ? null : (
                  <div className="sl-stage-sub" title={sauce ? `${sauce.origin} — ${sauce.readsAs}` : temper?.readsAs}>
                    {temper
                      ? `${sauce ? t("saucelings.pet.sauce", { sauce: sauce.name }) : t("saucelings.pet.temperament", { temperament: temper.name })} · `
                      : null}
                    {sp.name} ·{" "}
                    {pet.lockedStage
                      ? t("saucelings.pet.locked", { stage: t(`saucelings.stage.${pet.lockedStage}`) })
                      : t(`saucelings.stage.${pet.stage}`)}
                  </div>
                )}
              </div>
            )}
            {editingName ? null : (
              <NookMenu label={t("saucelings.nook.menu")}>
                {isEgg || unnamed ? null : (
                  <button type="button" className="sl-btn sl-btn--small" onClick={startRename}>
                    ✏️ {t("saucelings.pet.rename")}
                  </button>
                )}
                <button
                  type="button"
                  className="sl-btn sl-btn--small"
                  aria-expanded={panel === "background"}
                  onClick={() => togglePanel("background")}
                >
                  🖼 {t("saucelings.nook.background")}
                </button>
                {caretakerControls ? (
                  <button
                    type="button"
                    className="sl-btn sl-btn--small"
                    aria-expanded={panel === "caretaker"}
                    onClick={() => togglePanel("caretaker")}
                  >
                    👤 {t("saucelings.about.caretakerGroup")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="sl-btn sl-btn--small"
                  aria-expanded={panel === "looks"}
                  onClick={() => togglePanel("looks")}
                >
                  🎨 {t("saucelings.about.looksGroup")}
                </button>
                <button
                  type="button"
                  className="sl-btn sl-btn--small"
                  aria-expanded={panel === "egg"}
                  onClick={() => togglePanel("egg")}
                >
                  🥚 {t("saucelings.about.newEggGroup")}
                </button>
                <button type="button" className="sl-btn sl-btn--small" onClick={() => setTour({})}>
                  {t("saucelings.tour.link")}
                </button>
              </NookMenu>
            )}
          </div>

          <div className="sl-scene">
            <SaucelingStage
              pet={pet}
              reaction={reaction}
              assetUrl={assetUrl}
              backgroundSrc={backgroundSrc}
              caretaker={standing}
              caretakerFlipped={state.world.flippedCaretakers.includes(pet.caretakerId)}
              listenKey={heardLine?.id ?? null}
              handle={stageHandle}
              onMoveEgg={(eggSpot) => patchPetMutation.mutateAsync({ eggSpot })}
            />

            <CaretakerBox
              lines={caretakerLines}
              fallbackLine={
                isEgg ? t("saucelings.caretaker.idleEgg") : t("saucelings.caretaker.idle", { name: pet.name })
              }
              caretakerId={pet.caretakerId}
              caretakerName={caretakerName}
              isCharacter={isCharacter}
              meals={state.gaps.meals}
              isEgg={isEgg}
              writing={state.writing}
              standing={standing !== null || figure === undefined}
              onTyping={setTyping}
            >
              {sideBySide ? talk : null}
            </CaretakerBox>
          </div>
        </div>

        <div className="sl-nook-side">
          <div className="sl-card sl-care-card">
            <div className="sl-meters sl-meters--strip" data-sl-tour="meters">
              {isEgg ? (
                <>
                  <Meter
                    label={t("saucelings.meter.warmth")}
                    help={t("saucelings.meter.warmthHelp")}
                    value={eggWarmth(pet)}
                    gapLabel={state.gaps.warmth ? t("saucelings.meter.warmthGap") : null}
                  />
                  <Meter
                    label={t("saucelings.meter.hatching")}
                    help={t("saucelings.meter.hatchingHelp")}
                    value={hatching}
                    gapLabel={hatching >= 100 && pet.careActionCount < 1 ? t("saucelings.meter.hatchingGap") : null}
                  />
                </>
              ) : (
                <>
                  <Meter
                    label={t("saucelings.meter.hunger")}
                    help={t("saucelings.meter.hungerHelp")}
                    value={pet.meters.hunger}
                    gapLabel={
                      growthPaused
                        ? t("saucelings.pet.growthPaused")
                        : state.gaps.hunger
                          ? t("saucelings.meter.hungerGap")
                          : null
                    }
                    keepGap={growthPaused}
                  />
                  <Meter
                    label={t("saucelings.meter.mood")}
                    help={t("saucelings.meter.moodHelp")}
                    value={pet.meters.mood}
                    gapLabel={state.gaps.mood ? t("saucelings.meter.moodGap") : null}
                  />
                </>
              )}
              <Meter label={t("saucelings.meter.bond")} help={t("saucelings.meter.bondHelp")} value={pet.meters.bond} />
            </div>

            <div className="sl-actions" data-sl-tour="care">
              {actionsFor(pet).map((action) => {
                const wait = cooldownMinutes(pet, action, nowMs);
                // Filling a gap cheers the caretaker up for a moment.
                const fillsGap = actionCoversGap(action, state.gaps);
                return (
                  <button
                    key={action}
                    type="button"
                    className={`sl-btn ${fillsGap ? "sl-btn--gap" : ""}`}
                    disabled={actionMutation.isPending}
                    // A resting button stays tappable, so a tap (or a screen reader) hears when it is ready.
                    aria-disabled={wait > 0 || undefined}
                    onClick={() =>
                      wait > 0
                        ? showNote(
                            t("saucelings.action.resting", { action: t(ACTION_LABEL_KEYS[action]), minutes: wait }),
                          )
                        : actionMutation.mutate(action, {
                            onSuccess: () => {
                              if (fillsGap) cheer(true);
                            },
                          })
                    }
                  >
                    {ACTION_ICONS[action]} {t(ACTION_LABEL_KEYS[action])}
                    {wait > 0 ? ` · ${t("saucelings.action.wait", { minutes: wait })}` : ""}
                  </button>
                );
              })}
            </div>
            <p className={`sl-action-note ${careNote.shown ? "sl-action-note--shown" : ""}`} aria-live="polite">
              {careNote.text}
            </p>

            <FormPainter state={state} assetUrl={assetUrl} />
            <EvolveButton state={state} assetUrl={assetUrl} />
            {sideBySide ? null : talk}
          </div>

          {panel === "background" ? (
            <BackgroundPicker pet={pet} settings={state.world.settings} assetUrl={assetUrl} onClose={closePanel} />
          ) : null}

          {panel === "caretaker" && caretakerControls ? (
            <NookPanel
              title={t("saucelings.about.caretakerGroup")}
              closeLabel={t("saucelings.album.close")}
              onClose={closePanel}
            >
              {characters.length > 1 ? (
                <label className="sl-about-row">
                  <span>{isEgg ? t("saucelings.pet.eggCaretaker") : t("saucelings.pet.caretaker")}</span>
                  <select
                    className="sl-select sl-select--small"
                    aria-label={t("saucelings.empty.pickCaretaker")}
                    value={handOverTo?.id ?? pet.caretakerId}
                    onChange={(e) => setHandOverTo(characters.find((ch) => ch.id === e.target.value) ?? null)}
                  >
                    {characters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {handOverTo && handOverTo.id !== pet.caretakerId ? (
                <div className="sl-about-row" role="group">
                  <span>
                    {isEgg
                      ? t("saucelings.about.handOverEggNote", { caretaker: handOverTo.name })
                      : t("saucelings.about.handOverNote", { name: pet.name, caretaker: handOverTo.name })}
                  </span>
                  <button
                    type="button"
                    className="sl-btn sl-btn--primary"
                    disabled={patchPetMutation.isPending}
                    onClick={() => patchPetMutation.mutate({ caretakerId: handOverTo.id })}
                  >
                    {t("saucelings.about.handOver")}
                  </button>
                  <button type="button" className="sl-btn" onClick={() => setHandOverTo(null)}>
                    {t("saucelings.common.cancel")}
                  </button>
                </div>
              ) : null}

              {isCharacter ? (
                <div className="sl-about-row">
                  <HelpTip
                    text={t("saucelings.about.refreshVoiceNote")}
                    label={t("saucelings.help.label", {
                      action: t("saucelings.about.refreshVoice", { name: caretakerName }),
                    })}
                  >
                    <button
                      type="button"
                      className="sl-btn"
                      disabled={refreshVoiceMutation.isPending}
                      onClick={() => refreshVoiceMutation.mutate({ characterId: pet.caretakerId, name: caretakerName })}
                    >
                      {refreshVoiceMutation.isPending
                        ? t("saucelings.about.refreshingVoice", { name: caretakerName })
                        : `🔄 ${t("saucelings.about.refreshVoice", { name: caretakerName })}`}
                    </button>
                  </HelpTip>
                </div>
              ) : null}
              {isCharacter ? (
                <FigurePainter
                  state={state}
                  characterId={pet.caretakerId}
                  name={caretakerName}
                  sprites={caretakerSprites}
                />
              ) : null}
              {isCharacter ? <CaretakerFlip state={state} characterId={pet.caretakerId} name={caretakerName} /> : null}
            </NookPanel>
          ) : null}

          {panel === "looks" ? (
            <NookPanel
              title={t("saucelings.about.looksGroup")}
              closeLabel={t("saucelings.album.close")}
              onClose={closePanel}
            >
              <FormRepaint state={state} assetUrl={assetUrl} />
              <PetFlip state={state} />
              <UndoEvolution state={state} />
            </NookPanel>
          ) : null}

          {panel === "egg" ? (
            <NookPanel
              title={t("saucelings.about.newEggGroup")}
              closeLabel={t("saucelings.album.close")}
              onClose={closePanel}
            >
              <p>{isEgg ? t("saucelings.swap.noteEgg") : t("saucelings.swap.note", { name: pet.name })}</p>
              <EggForm
                characters={characters}
                defaultCaretakerId={isCharacter ? pet.caretakerId : (characters[0]?.id ?? "caretaker")}
                submitLabel={t("saucelings.swap.confirm")}
                pending={adoptMutation.isPending}
                readyAt={nextEggTime(state.world.lastNewEggDay, nowMs)}
                onSubmit={(input) => adopt({ ...input, swap: true })}
                onCancel={closePanel}
              />
              <SpecialEggs unlocks={state.unlocks} />
            </NookPanel>
          ) : null}
        </div>
      </div>

      <details className="sl-card sl-about">
        <summary>{isEgg ? t("saucelings.about.egg") : t("saucelings.about.summary", { name: pet.name })}</summary>
        <div className="sl-about-body">
          {isEgg ? (
            <p>{t("saucelings.egg.about")}</p>
          ) : (
            <>
              <p>
                {sp.look} — <em>{pet.quirk}</em>
              </p>
              <p>
                {sauce
                  ? t("saucelings.pet.sauceAbout", { sauce: sauce.name, readsAs: sauce.readsAs })
                  : temper && pet.ownTemperament
                    ? t("saucelings.pet.temperamentAbout", {
                        temperament: temper.name,
                        readsAs: temper.readsAs,
                        after: pet.ownTemperament.takesAfter.name,
                      })
                    : t("saucelings.pet.temperamentForming")}
              </p>
              {pet.evolution.look ? (
                <p title={pet.evolution.look.description}>
                  {t("saucelings.evolve.into", { form: pet.evolution.look.form })}
                </p>
              ) : null}
              {pet.evolution.look ? (
                <p>{t("saucelings.evolve.move", { move: t(`saucelings.evolve.moves.${pet.evolution.look.move}`) })}</p>
              ) : null}
              <div className="sl-traits">
                {pet.traits.map((trait) => (
                  <span key={trait} className="sl-trait">
                    #{trait}
                  </span>
                ))}
              </div>
            </>
          )}
          <p>{t("saucelings.menagerie.foundBy", { name: pet.finder.name })}</p>
        </div>
      </details>

      {tour ? (
        <NookTour
          caretaker={caretakerName}
          hatched={pet.stage !== "egg"}
          onClose={() => {
            setTour(null);
            tour.then?.();
          }}
        />
      ) : null}
    </div>
  );
}
