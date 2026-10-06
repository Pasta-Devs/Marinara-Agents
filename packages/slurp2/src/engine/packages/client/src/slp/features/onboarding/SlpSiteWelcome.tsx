// Opening day (docs/OPENING-DAY.md): the owner's first run, drawn on the stage from the pure script in
// slp-site-welcome.ts. Support (the owner's staff) talks; the stage shows the Slurp bowl, the Pastapay
// license, then the owner's own Slurp as a phone that changes with every answer; big cards are the
// only input. Nothing is written before "Open the doors". A first run keeps its place per browser.
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Modal } from "../../../components/ui/Modal";
import { getSlpAccentStyle, SLP_PINK, SlpLogo } from "../../base/chrome/SlpChrome";
import { useSlpCountedValue } from "../../base/chrome/slp-motion";
import { SlpChip } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpPhonePreview } from "../../modules/preview/SlpPhonePreview";
import type { SlpPhonePreviewInput } from "../../modules/preview/slp-phone-preview";
import type { SlpChoice, SlpChoiceLayout } from "../../modules/stage/SlpChoiceCards";
import { SlpStage, SlpStageFloaters, type SlpStageLine } from "../../modules/stage/SlpStage";
import { SlurpAgeGate, SlurpConfetti } from "./SlpAgeGate";
import { leaveUnlessBackdrop } from "./SlpSplash";
import { useSlpRailContext, useSlpRailWrite } from "./slp-rail-hooks";
import { slpRailAnswerLabel, SlpRailFileRows } from "./SlpRailCards";
import {
  SLP_RAIL_STOPS,
  slpRailAnswers,
  slpRailCanSkipIntro,
  slpRailCleanAnswers,
  slpRailDefaults,
  slpRailFileRows,
  slpRailNext,
  slpRailSettle,
  slpRailStamp,
  slpRailSteps,
  slpRailStop,
  slpRailTranscript,
  type SlpRailAnswers,
  type SlpRailContext,
  type SlpRailEvent,
  type SlpRailQuestion,
  type SlpRailStamp,
  type SlpRailState,
  type SlpRailStep,
} from "./slp-site-welcome";

// Per browser, like the splash: opening day is a walk-through, not a setting, until the doors open.
const STORE_KEY = "slurp2:support-rail";
const EMPTY: SlpRailState = { answers: {}, events: [], seen: [] };
/** Steam before each Support line. */
const PACE_MS = 650;
const O = `ui.slurp.opening.`; // a template literal: the locale validator reads quoted keys whole

/** The emoji on each answer card. */
const GLYPH: Record<string, string> = {
  "who.watch": "👀",
  "who.run": "🎬",
  "who.both": "✨",
  "pace.manual": "🐢",
  "pace.occasional": "☕",
  "pace.lively": "✨",
  "pace.veryActive": "🔥",
  "pace.grows": "🌱",
  "pictures.yes": "🖼️",
  "pictures.no": "✍️",
  "spice.clean": "🫖",
  "spice.flirty": "😏",
  "spice.suggestive": "🌶️",
  "spice.explicit": "🔥",
  "names.hinted": "🎭",
  "names.open": "🪪",
  "nights.yes": "🌙",
  "nights.no": "🦉",
  "fun.sure": "🎛️",
  "fun.skip": "⏭️",
  "fans.warm": "🥰",
  "fans.mixed": "🙂",
  "fans.unfiltered": "😈",
  "size.intimate": "🏡",
  "size.normal": "🏙️",
  "size.large": "🌍",
  "drama.none": "🕊️",
  "drama.sometimes": "🍿",
  "drama.bringIt": "💥",
  "ads.none": "🚫",
  "ads.few": "📰",
  "ads.lots": "📢",
  "adTone.normal": "👔",
  "adTone.unhinged": "🤪",
  "pullStrings.fair": "😇",
  "pullStrings.platform": "🕴️",
};
/** Questions whose short answers fit three across a phone. */
const THREE = new Set<SlpRailQuestion>(["fans", "size", "drama", "ads"]);
/** How many fans walk in when the doors open, by size. */
const ARRIVALS = { intimate: 37, normal: 412, large: 1204 } as const;

function readSaved(): SlpRailState | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "null") as Partial<SlpRailState> | null;
    if (!raw || typeof raw.answers !== "object" || !Array.isArray(raw.events) || !Array.isArray(raw.seen)) return null;
    return {
      answers: slpRailCleanAnswers(raw.answers),
      events: raw.events,
      seen: raw.seen,
      skipIntro: raw.skipIntro === true,
    };
  } catch {
    return null;
  }
}

function save(state: SlpRailState | null) {
  try {
    if (state) window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Blocked storage: a reload starts opening day again, which is harmless.
  }
}

export function SlpSiteWelcome({
  open,
  opening,
  personaName,
  onLeave,
  onClose,
  onStamped,
  onFeed,
  onSignUp,
  onQuickLane,
}: {
  open: boolean;
  opening: SlpRailContext["opening"];
  personaName: string;
  /** Leaves Slurp: the way out of the license ("Not now", and X before it is confirmed). */
  onLeave?: () => void;
  /** Closes opening day after the license; a first run resumes where it was. */
  onClose: () => void;
  onStamped: (stamp: SlpRailStamp) => void;
  onFeed: () => void;
  onSignUp: () => void;
  onQuickLane: () => void;
}) {
  const { t } = useUiTranslation();
  const context = useSlpRailContext(opening, open);
  const writer = useSlpRailWrite();
  const [raw, setRaw] = useState<SlpRailState>(() => (opening === "first" ? readSaved() : null) ?? EMPTY);
  const [editing, setEditing] = useState<SlpRailQuestion | null>(null);
  const [fileOpen, setFileOpen] = useState(false);
  // What the phone shows last changed, and how to say it ("8 posts a day").
  const [change, setChange] = useState<{ key: string; callout: string } | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  // A resumed opening day shows what was said at once; only new lines get steam.
  const [resumed] = useState(() => raw !== EMPTY);
  const [history, setHistory] = useState<number | null>(null);

  const state = context ? slpRailSettle(raw, context) : raw;
  const update = (next: SlpRailState) => {
    const settled = context ? slpRailSettle(next, context) : next;
    setRaw(settled);
    // Once the doors are open, onboarding is complete on the server: nothing is left to resume.
    if (opening === "first") save(settled.events.includes("opened") ? null : settled);
  };
  const fire = (event: SlpRailEvent) => {
    if (!state.events.includes(event)) update({ ...state, events: [...state.events, event] });
  };
  const confirmed = opening === "again" || state.events.includes("ageConfirmed");
  const opened = state.events.includes("opened");
  const close = () => (confirmed ? onClose() : leaveUnlessBackdrop(onLeave));
  const changed = (key: string, callout: string) =>
    setChange((previous) => ({ key: `${key}:${(Number(previous?.key.split(":")[1]) || 0) + 1}`, callout }));

  useEffect(() => {
    if (!celebrate) return;
    const timer = window.setTimeout(() => setCelebrate(0), 1600);
    return () => window.clearTimeout(timer);
  }, [celebrate]);

  const lines: SlpStageLine[] = [];
  let cards:
    { choices: SlpChoice[]; layout?: SlpChoiceLayout; label: string; onSelect: (id: string) => void } | undefined;
  let next: SlpRailStep | null = null;
  let stage: ReactNode = null;
  let stageKey = "opening";
  let overlay: ReactNode = null;
  let preview: SlpPhonePreviewInput | null = null;

  if (context) {
    next = slpRailNext(state, context);
    const stop = slpRailStop(next);
    const answers = slpRailAnswers(state, context);
    const defaults = slpRailDefaults(context);
    const transcript = slpRailTranscript(state, context);
    const label = (id: SlpRailQuestion, value: string | undefined) => slpRailAnswerLabel(t, id, value, context);
    const hint = (id: SlpRailQuestion, value: string) =>
      t(`${O}hint.${id}.${value}`, { defaultValue: "" }) || undefined;

    // The phone shows what the owner chose; a fast lane or a rerun shows today's values too.
    const known = state.answers.lane === "recommended" || opening === "again";
    const shown = <K extends keyof SlpRailAnswers>(key: K): SlpRailAnswers[K] =>
      state.answers[key] ?? (known ? answers[key] : undefined);
    const nameOf = (list: SlpRailContext["textConnections"], id: string | undefined) =>
      list.find((connection) => connection.id === id)?.name;
    const funOn = answers.fun === "sure" || known;
    preview = {
      creators: opening === "again" || state.seen.includes("moveIn"),
      locked: opening === "first" && !state.events.includes("revealed"),
      pace: shown("pace"),
      pictures: shown("pictures"),
      spice: shown("spice"),
      names: shown("names"),
      nights: shown("nights"),
      fans: funOn ? shown("fans") : undefined,
      size: funOn ? shown("size") : undefined,
      drama: funOn ? shown("drama") : undefined,
      ads: funOn ? shown("ads") : undefined,
      adTone: funOn ? shown("adTone") : undefined,
      pullStrings: funOn ? shown("pullStrings") : undefined,
      connectionName: nameOf(context.textConnections, shown("connection")),
      imageConnectionName: nameOf(context.imageConnections, shown("imageConnection")),
    };

    const answer = (id: SlpRailQuestion, value: string) => {
      setEditing(null);
      changed(id, label(id, value));
      update({ ...state, answers: { ...state.answers, [id]: value } });
    };
    const choicesFor = (step: Extract<SlpRailStep, { kind: "ask" }>): SlpChoice[] => {
      const list = step.id === "connection" ? context.textConnections : context.imageConnections;
      const current = state.answers[step.id] ?? defaults[step.id];
      return step.options.map((value) => {
        const isConnection = step.id === "connection" || step.id === "imageConnection";
        const marked = isConnection && list.some((entry) => entry.id === value && entry.isDefault);
        return {
          id: value,
          glyph: GLYPH[`${step.id}.${value}`],
          label: marked ? t(`${O}a.connection.default`, { name: label(step.id, value) }) : label(step.id, value),
          hint: isConnection ? undefined : hint(step.id, value),
          primary: current === value,
        };
      });
    };
    const askCards = (step: Extract<SlpRailStep, { kind: "ask" }>) => {
      const choices = choicesFor(step);
      if (step.id === "who" && !editing)
        choices.push({ id: "recommended", glyph: "⚡", label: t(`${O}tap.recommended`), ghost: true });
      const layout: SlpChoiceLayout =
        step.id === "connection" || step.id === "imageConnection"
          ? "list"
          : THREE.has(step.id) || (step.id === "who" && editing)
            ? "three"
            : "two";
      cards = {
        choices,
        layout,
        label: t(`${O}q.${step.id}`),
        onSelect: (id) =>
          id === "recommended"
            ? update({ ...state, answers: { ...state.answers, lane: "recommended" } })
            : answer(step.id, id),
      };
    };

    // The talk shows the current scene only; earlier lines of the scene dim.
    const inScene = (step: SlpRailStep) => slpRailStop(step) === stop;
    const push = (line: SlpStageLine) => lines.push(line);
    for (const step of transcript.filter(inScene)) {
      if (step.kind === "say") push({ id: step.id, kind: step.small ? "aside" : "host", text: t(step.key) });
      if (step.kind === "ask") {
        push({ id: `q-${step.id}`, kind: "host", text: t(`${O}q.${step.id}`) });
        const lane = step.id === "who" && state.answers.lane && state.answers.who === undefined;
        push({
          id: `a-${step.id}`,
          kind: "mine",
          text: lane ? t(`${O}tap.recommended`) : label(step.id, answers[step.id]),
        });
      }
      if (step.kind === "wait" && step.id === "ageConfirmed")
        push({ id: "a-age", kind: "mine", text: t(`${O}tap.adult`) });
      if (step.kind === "wait" && step.id === "opened")
        push({ id: "a-open", kind: "mine", text: t(`${O}tap.${opening === "again" ? "save" : "open"}`) });
      if (step.kind !== "ask" && step.tap) push({ id: `tap-${step.id}`, kind: "mine", text: t(step.tap) });
    }
    if (next?.kind === "say") push({ id: next.id, kind: next.small ? "aside" : "host", text: t(next.key) });
    if (next?.kind === "ask") push({ id: `q-${next.id}`, kind: "host", text: t(`${O}q.${next.id}`) });
    if (editing) push({ id: `again-${editing}`, kind: "host", text: t(`${O}q.${editing}`) });
    const lastMine = lines.map((line) => line.kind).lastIndexOf("mine");
    lines.forEach((line, index) => (line.old = index < lastMine));
    if (history === null)
      setHistory(resumed ? lines.length - (next?.kind === "say" || next?.kind === "ask" ? 1 : 0) : 0);

    // Cards for the step the rail is on.
    const tapCard = (step: SlpRailStep & { tap?: string }) => {
      cards = {
        choices: [{ id: step.id, label: t(step.tap!), primary: true }],
        label: t(step.tap!),
        onSelect: () => (step.kind === "wait" ? fire(step.id) : update({ ...state, seen: [...state.seen, step.id] })),
      };
    };
    if (editing) {
      const step = slpRailSteps(context).find((entry) => entry.kind === "ask" && entry.id === editing);
      if (step?.kind === "ask") askCards(step);
    } else if (next?.kind === "ask") askCards(next);
    else if (next?.kind === "wait" && next.id === "ageConfirmed")
      cards = {
        choices: [
          { id: "adult", glyph: "🔞", label: t(`${O}tap.adult`), primary: true },
          { id: "leave", label: t("ui.noodle.agegate.notNow"), ghost: true },
        ],
        layout: "one",
        label: t(`${O}say.id1`),
        onSelect: (id) => (id === "adult" ? fire("ageConfirmed") : onLeave?.()),
      };
    else if (next?.kind === "wait" && next.id === "opened")
      cards = {
        choices: [
          { id: "open", glyph: "🚪", label: t(`${O}tap.${opening === "again" ? "save" : "open"}`), primary: true },
          { id: "change", glyph: "✏️", label: t(`${O}tap.change`), ghost: true },
        ],
        layout: "one",
        label: t(`${O}tap.open`),
        onSelect: (id) => (id === "change" ? setFileOpen(true) : void doors()),
      };
    else if (next?.tap) tapCard(next);
    else if (!next)
      cards =
        opening === "again"
          ? {
              choices: [{ id: "done", label: t(`${O}tap.done`), primary: true }],
              label: t(`${O}tap.done`),
              onSelect: onClose,
            }
          : answers.who === "watch"
            ? {
                choices: [{ id: "feed", label: t(`${O}tap.feed`), primary: true }],
                label: t(`${O}tap.feed`),
                onSelect: onFeed,
              }
            : {
                choices: [
                  { id: "signup", glyph: "✍️", label: t(`${O}tap.signUp`), primary: true },
                  { id: "list", glyph: "📋", label: t(`${O}tap.pickList`), ghost: true },
                ],
                label: t(`${O}tap.signUp`),
                onSelect: (id) => (id === "signup" ? onSignUp() : onQuickLane()),
              };

    // "Open the doors": the one write, then the doors slide open and the fans walk in.
    const doors = async () => {
      const result = slpRailStamp(state, context);
      try {
        await writer.write(result, state.answers.imageConnection !== undefined);
      } catch {
        toast.error(t("ui.slurp.onboarding.saveError"));
        return;
      }
      fire("opened");
      setCelebrate(Date.now());
      onStamped(result);
    };

    // The stage: one object per scene. The phone stays from "Your Slurp" to the doors.
    if (stop === "opening") {
      stage = (
        <>
          <SlpLogo className="slp-bob h-auto w-[min(52vw,240px)] drop-shadow-[0_18px_40px_color-mix(in_srgb,var(--noodle-accent)_45%,transparent)]" />
          <p className="slp-display text-center text-[clamp(28px,6vw,44px)] leading-none">
            {t(`${O}stop.slurp`)}
            <span className="mt-2 block text-sm font-semibold text-[var(--slurp-muted)]">{t(`${O}stop.opening`)}</span>
          </p>
        </>
      );
    } else if (stop === "license") {
      stageKey = "license";
      stage = <SlurpAgeGate personaName={personaName} done={confirmed} />;
    } else {
      stageKey = "phone";
      stage = (
        <SlpPhonePreview
          input={preview}
          doors={state.seen.includes("doors") ? (opened ? "open" : "shut") : "none"}
          changed={change?.key ?? null}
          callout={change?.callout ?? null}
          onUnlock={() => {
            fire("revealed");
            changed("locked", t(`${O}callout.unlocked`));
            setCelebrate(Date.now());
          }}
          className="h-full"
        />
      );
      if (next?.kind === "say" && next.id === "what2")
        overlay = <SlpStageFloaters glyphs={["❤️", "💬", "🪙", "❤️", "💬", "✨"]} />;
    }
  }

  // The change on Mari's move-in plays once, when her card lands.
  useEffect(() => {
    if (state.seen.includes("moveIn")) changed("creators", t(`${O}callout.moveIn`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seen.includes("moveIn")]);

  const stopIndex = SLP_RAIL_STOPS.indexOf(slpRailStop(next));
  const sizeAnswer = context ? slpRailAnswers(state, context).size : undefined;
  return (
    <Modal
      open={open}
      onClose={close}
      title={t(`${O}host`)}
      width="max-w-6xl"
      mobileFullscreen
      // The stage draws its own header (Support, the scene, the X), so the Modal's is hidden.
      panelClassName="sm:h-[min(52rem,92dvh)] [&>div:first-child]:hidden"
      contentClassName="flex flex-col !overflow-hidden !p-0"
      panelStyle={getSlpAccentStyle(SLP_PINK)}
      closeDisabled={!confirmed && !onLeave}
    >
      <div data-component="SlpSiteWelcome" className="flex min-h-0 flex-1 flex-col">
        <SlpStage
          host={{ mark: <SlpLogo className="h-6 w-auto" />, name: t(`${O}host`) }}
          scene={t(`${O}stop.${SLP_RAIL_STOPS[stopIndex]}`)}
          progress={{
            current: stopIndex + 1,
            total: SLP_RAIL_STOPS.length,
            label: t("ui.slurp.wizard.stepOf", { current: stopIndex + 1, total: SLP_RAIL_STOPS.length }),
          }}
          headerEnd={
            (confirmed || onLeave) && (
              <button
                type="button"
                onClick={close}
                aria-label={confirmed ? t(`${O}close`) : t("ui.slurp.ageGate.leave")}
                className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--slurp-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none [&_svg]:!text-current"
              >
                <X size={20} aria-hidden="true" />
              </button>
            )
          }
          actions={
            context && slpRailCanSkipIntro(state, context) ? (
              <SlpChip className="min-h-11 px-3" onClick={() => update({ ...state, skipIntro: true })}>
                {t(`${O}tap.skipIntro`)}
              </SlpChip>
            ) : undefined
          }
          stage={stage}
          stageKey={stageKey}
          stageOverlay={
            <>
              {overlay}
              {opened && (
                <FansArrive count={ARRIVALS[sizeAnswer ?? "normal"]} label={(count) => t(`${O}fansIn`, { count })} />
              )}
            </>
          }
          lines={lines}
          history={history ?? 0}
          cards={cards}
          pace={PACE_MS}
          labels={{ log: t(`${O}log`), typing: t(`${O}typing`) }}
        />
      </div>
      {celebrate > 0 && <SlurpConfetti fixed />}
      <SlpSheet open={fileOpen} onClose={() => setFileOpen(false)} title={t(`${O}change`)}>
        {context && (
          <SlpRailFileRows
            rows={slpRailFileRows(state, context)}
            state={state}
            context={context}
            onChange={(id) => {
              setFileOpen(false);
              setEditing(id);
            }}
          />
        )}
      </SlpSheet>
    </Modal>
  );
}

/** "+412 fans just walked in": counts up once the doors open. */
function FansArrive({ count, label }: { count: number; label: (count: number) => string }) {
  const [target, setTarget] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setTarget(count), 300);
    return () => window.clearTimeout(timer);
  }, [count]);
  const shown = useSlpCountedValue(target, 900) ?? 0;
  return (
    <div className="slp-line pointer-events-none absolute left-1/2 top-[40%] z-[7] -translate-x-1/2 rounded-[18px] bg-[color-mix(in_srgb,var(--slurp-surface)_88%,transparent)] px-5 py-3 text-center shadow-[0_12px_30px_rgb(0_0_0/0.6)]">
      <span className="slp-display block text-3xl leading-none">{label(shown)}</span>
    </div>
  );
}
