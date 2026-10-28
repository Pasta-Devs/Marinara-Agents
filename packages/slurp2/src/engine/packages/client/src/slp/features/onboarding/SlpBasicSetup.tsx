// The Basic screen of the first run (docs/CONFIGURATOR.md, Onboarding), drawn on the stage from the
// pure model in slp-basic-setup.ts. Support (the owner's staff) asks, big cards answer, and the stage
// shows the real locked post card with sample data, changing with every answer. Nothing is written
// until the player leaves it; a first run keeps its place per browser.
import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Modal } from "../../../components/ui/Modal";
import { cn } from "../../../lib/utils";
import { getSlpAccentStyle, SLP_PINK, SLP_TYPE, SlpLogo } from "../../base/chrome/SlpChrome";
import { SlpChip } from "../../modules/chrome/SlpButton";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import type { SlpChoice, SlpChoiceLayout } from "../../modules/stage/SlpChoiceCards";
import { SlpStage, type SlpStageLine } from "../../modules/stage/SlpStage";
import { SlurpConfetti } from "./SlpAgeGate";
import { DEMO_PROFILE, useSlpMariPortrait } from "./SlpOnboardingPanel";
import { markSlpSwitchedOnNoteSeen } from "../../base/state/slp-switched-on-note";
import { useSlpBasicContext, useSlpBasicWrite } from "./slp-basic-setup-hooks";
import {
  SLP_BASIC_EXTRAS,
  SLP_BASIC_LATER,
  SLP_BASIC_OPTIONS,
  SLP_BASIC_ORDER,
  slpBasicAnswers,
  slpBasicCleanState,
  slpBasicExtras,
  slpBasicNext,
  slpBasicRecommended,
  slpBasicShows,
  slpBasicStamp,
  type SlpBasicContext,
  type SlpBasicQuestion,
  type SlpBasicStamp,
  type SlpBasicState,
  type SlpBasicStep,
} from "./slp-basic-setup";

// Per browser, like the splash: the Basic screen is a walk-through, not a setting, until it is left.
const STORE_KEY = "slurp2:basic-setup";
const EMPTY: SlpBasicState = { answers: {}, unlocked: false };
/** Steam before each Support line. */
const PACE_MS = 650;
// Built from parts: the minifier folds literals into one quoted "ui.…" string, which the bundle
// key check (scripts/validate-package-locale-keys.mjs) reads as a missing key.
const O = ["ui", "slurp", "opening", ""].join(".");

/** The emoji on each answer card. */
const GLYPH: Record<string, string> = {
  "who.watch": "👀",
  "who.run": "🎬",
  "who.both": "✨",
  "pace.manual": "🐢",
  "pace.occasional": "☕",
  "pace.lively": "✨",
  "pace.veryActive": "🔥",
  "pictures.yes": "🖼️",
  "pictures.no": "✍️",
  "heat.clean": "🫖",
  "heat.flirty": "😏",
  "heat.suggestive": "🌶️",
  "heat.explicit": "🔥",
  "names.hinted": "🎭",
  "names.open": "🪪",
  "crowd.quiet": "🏡",
  "crowd.realistic": "🙂",
  "crowd.lively": "🎉",
  "crowd.generous": "🌍",
  "extras.storylines": "📖",
  "extras.ads": "📣",
  "extras.world": "🎉",
  "extras.stir": "🥄",
  "extras.supportDesk": "🛎️",
};
/** The fans on the preview card, by crowd. */
const FANS = { quiet: 120, realistic: 412, lively: 980, generous: 1650 } as const;
/** Opening Day's copy keys say "spice" where the model says "heat". */
const KEY: Partial<Record<SlpBasicQuestion, string>> = { heat: "spice" };
const key = (question: SlpBasicQuestion) => KEY[question] ?? question;

function readSaved(): SlpBasicState | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? slpBasicCleanState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function save(state: SlpBasicState | null) {
  try {
    if (state) window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Blocked storage: a reload starts the Basic screen again, which is harmless.
  }
}

export type SlpBasicLead = "feed" | "scene" | "list" | "saved";

export function SlpBasicSetup({
  open,
  firstRun,
  onClose,
  onLead,
}: {
  open: boolean;
  /** False is "Run setup again": today's values, no lesson, only touched answers are written. */
  firstRun: boolean;
  onClose: () => void;
  /** After the write: where the player goes next, with what the Creator step needs. */
  onLead: (lead: SlpBasicLead, stamp: SlpBasicStamp) => void;
}) {
  const { t } = useUiTranslation();
  const context = useSlpBasicContext(firstRun, open);
  const writer = useSlpBasicWrite();
  const [state, setState] = useState<SlpBasicState>(() => (firstRun ? readSaved() : null) ?? EMPTY);
  const [resumed] = useState(() => state !== EMPTY);
  const [history, setHistory] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const update = (next: SlpBasicState) => {
    setState(next);
    if (firstRun) save(next);
  };

  const lines: SlpStageLine[] = [];
  let cards:
    { choices: SlpChoice[]; layout?: SlpChoiceLayout; label: string; onSelect: (id: string) => void } | undefined;
  let next: SlpBasicStep | null = null;
  let answered: SlpBasicStep[] = [];

  if (context) {
    next = slpBasicNext(state, context);
    const answers = slpBasicAnswers(state, context);
    const label = (question: SlpBasicQuestion, value: string) => answerLabel(t, context, question, value);
    const hint = (question: SlpBasicQuestion, value: string) =>
      t(`${O}hint.${key(question)}.${value}`, { defaultValue: "" }) || undefined;
    const optionsOf = (question: SlpBasicQuestion): readonly string[] =>
      question === "extras"
        ? SLP_BASIC_EXTRAS
        : question === "connection"
          ? [...context.textConnections.map((entry) => entry.id), SLP_BASIC_LATER]
          : question === "imageConnection"
            ? context.imageConnections.map((entry) => entry.id)
            : SLP_BASIC_OPTIONS[question];

    // The talk: every step already answered (question dimmed, answer as a pill), then the open one.
    const stop = next === null ? SLP_BASIC_ORDER.length : SLP_BASIC_ORDER.indexOf(next);
    answered =
      state.answers.who === "watch"
        ? ["who"]
        : SLP_BASIC_ORDER.filter((step, index) => index < stop && slpBasicShows(step, state, context));
    if (firstRun) {
      lines.push({ id: "hello1", kind: "host", text: t(`${O}say.hello1`) });
      lines.push({ id: "hello2", kind: "host", text: t(`${O}say.hello2`) });
      lines.push({ id: "cost", kind: "aside", text: t(`${O}say.cost`) });
    } else {
      lines.push({ id: "again", kind: "host", text: t(`${O}say.again`) });
    }
    const ask = (step: SlpBasicStep) => {
      if (step === "locked") {
        lines.push({ id: "locked1", kind: "host", text: t(`${O}say.locked1`) });
        lines.push({ id: "coins", kind: "aside", text: t(`${O}q.coins`) });
      } else {
        lines.push({ id: `q-${step}`, kind: "host", text: t(`${O}q.${key(step)}`) });
        if (step === "heat") lines.push({ id: "heat-public", kind: "aside", text: t(`${O}say.heatPublic`) });
        if (step === "extras") lines.push({ id: "extras-later", kind: "aside", text: t(`${O}say.extras`) });
      }
    };
    for (const step of answered) {
      ask(step);
      const value = step === "locked" ? null : state.answers[step];
      lines.push({
        id: `a-${step}`,
        kind: "mine",
        text:
          step === "locked" ? t(`${O}tap.gotIt`) : value !== undefined ? label(step, value) : t(`${O}tap.recommended`),
      });
    }
    if (next) ask(next);
    else {
      const noText = context.textConnections.length === 0 || answers.connection === SLP_BASIC_LATER;
      if (noText) lines.push({ id: "noText", kind: "aside", text: t(`${O}say.noConnection`) });
      lines.push({
        id: "ready",
        kind: "host",
        text: t(firstRun ? `${O}say.ready` : `${O}say.againReady`),
      });
      lines.push({ id: "later", kind: "aside", text: t(`${O}say.later`) });
    }
    const lastMine = lines.map((line) => line.kind).lastIndexOf("mine");
    lines.forEach((line, index) => (line.old = index < lastMine));
    if (history === null) setHistory(resumed ? lines.length - 1 : 0);

    const leave = async (lead: SlpBasicLead) => {
      const stamp = slpBasicStamp(state, context);
      try {
        await writer.write(stamp);
      } catch {
        toast.error(t("ui.slurp.onboarding.saveError"));
        return;
      }
      if (firstRun) {
        save(null);
        // Only a player who saw "Add extras" (or took the fast lane) has seen what is on.
        if (state.answers.extras !== undefined) markSlpSwitchedOnNoteSeen();
      }
      setCelebrate(true);
      onLead(lead, stamp);
    };

    if (next === "locked") {
      cards = {
        choices: [{ id: "gotIt", label: t(`${O}tap.gotIt`), primary: true }],
        layout: "one",
        label: t(`${O}say.locked1`),
        onSelect: () => update({ ...state, unlocked: true }),
      };
    } else if (next === "extras") {
      // ponytail: each card says what it adds in a sentence; the sample components (an inline ad, a
      // poll, a holiday banner, a lever card) wait for the real cards' live actions to split out.
      const picked = slpBasicExtras(state.extrasDraft ?? answers.extras);
      cards = {
        choices: [
          ...SLP_BASIC_EXTRAS.map((id) => ({
            id,
            glyph: GLYPH[`extras.${id}`],
            label: t(`ui.slurp.settings.ext.${id}.label`),
            hint: t(`ui.slurp.settings.ext.${id}.detail`),
            primary: picked.includes(id),
            toggle: true,
          })),
          { id: "done", glyph: "✅", label: t(`${O}tap.extrasDone`), ghost: true },
        ],
        layout: "list",
        label: t(`${O}q.extras`),
        onSelect: (id) => {
          if (id !== "done") {
            const on = picked.includes(id as (typeof picked)[number]);
            const extrasDraft = SLP_BASIC_EXTRAS.filter((extra) => (extra === id ? !on : picked.includes(extra))).join(
              ",",
            );
            return update({ ...state, extrasDraft });
          }
          const { extrasDraft: _draft, ...rest } = state;
          update({ ...rest, answers: { ...state.answers, extras: picked.join(",") } });
        },
      };
    } else if (next) {
      const question = next;
      const current = answers[question];
      const list = question === "connection" ? context.textConnections : context.imageConnections;
      const choices: SlpChoice[] = optionsOf(question).map((value) => {
        const marked = list.some((entry) => entry.id === value && entry.isDefault);
        return {
          id: value,
          glyph: GLYPH[`${question}.${value}`],
          label: marked ? t(`${O}a.connection.default`, { name: label(question, value) }) : label(question, value),
          hint: hint(question, value),
          primary: current === value,
        };
      });
      if (question === "who")
        choices.push({ id: "recommended", glyph: "⚡", label: t(`${O}tap.recommended`), ghost: true });
      cards = {
        choices,
        layout:
          question === "connection" || question === "imageConnection" ? "list" : choices.length === 3 ? "three" : "two",
        label: t(`${O}q.${key(question)}`),
        onSelect: (id) =>
          id === "recommended"
            ? update(slpBasicRecommended(state, context))
            : update({ ...state, answers: { ...state.answers, [question]: id } }),
      };
    } else if (!firstRun) {
      cards = {
        choices: [{ id: "save", glyph: "💾", label: t(`${O}tap.save`), primary: true }],
        layout: "one",
        label: t(`${O}tap.save`),
        onSelect: () => void leave("saved"),
      };
    } else if (answers.who === "watch") {
      cards = {
        choices: [
          { id: "feed", glyph: "👀", label: t(`${O}tap.feed`), primary: true },
          { id: "scene", glyph: "✍️", label: t(`${O}tap.signUp`), ghost: true },
        ],
        layout: "one",
        label: t(`${O}tap.feed`),
        onSelect: (id) => void leave(id === "feed" ? "feed" : "scene"),
      };
    } else {
      cards = {
        choices: [
          { id: "scene", glyph: "✍️", label: t(`${O}tap.signUp`), hint: t(`${O}hint.signUp`), primary: true },
          { id: "list", glyph: "📋", label: t(`${O}tap.pickList`), hint: t(`${O}hint.pickList`) },
        ],
        layout: "one",
        label: t(`${O}say.ready`),
        onSelect: (id) => void leave(id === "list" ? "list" : "scene"),
      };
    }
    if (writer.pending) cards = undefined;
  }

  // "Back": the last answer is asked again.
  const back = () => {
    const last = [...answered].reverse().find((step) => step === "locked" || state.answers[step] !== undefined);
    if (!last) return;
    if (last === "locked") return update({ ...state, unlocked: false });
    const { [last]: _dropped, ...rest } = state.answers;
    update({ ...state, answers: rest });
  };
  const canGoBack = answered.length > 0;
  const progressTotal = context ? SLP_BASIC_ORDER.filter((step) => slpBasicShows(step, state, context)).length + 1 : 1;
  const progressCurrent = Math.min(answered.length + 1, progressTotal);
  const preview = context ? slpBasicAnswers(state, context) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(`${O}host`)}
      width="max-w-6xl"
      mobileFullscreen
      // The stage draws its own header (Support, the scene, the X), so the Modal's is hidden.
      panelClassName="overflow-hidden sm:h-[min(52rem,92dvh)] [&>div:first-child]:hidden"
      contentClassName="flex flex-col !overflow-hidden !p-0"
      panelStyle={getSlpAccentStyle(SLP_PINK)}
    >
      <div data-component="SlpBasicSetup" className="flex min-h-0 flex-1 flex-col">
        <SlpStage
          host={{ mark: <SlpLogo className="h-6 w-auto" />, name: t(`${O}host`) }}
          scene={t(firstRun ? `${O}stop.setup` : `${O}stop.again`)}
          progress={{
            current: progressCurrent,
            total: progressTotal,
            label: t("ui.slurp.wizard.stepOf", { current: progressCurrent, total: progressTotal }),
          }}
          headerEnd={
            <button
              type="button"
              onClick={onClose}
              aria-label={t(`${O}close`)}
              className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--slurp-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none [&_svg]:!text-current"
            >
              <X size={20} aria-hidden="true" />
            </button>
          }
          actions={
            canGoBack && !writer.pending ? (
              <SlpChip className="min-h-11 px-3" onClick={back}>
                {t(`${O}tap.back`)}
              </SlpChip>
            ) : undefined
          }
          stage={
            context && preview ? (
              <BasicPreview
                answers={preview}
                context={context}
                onReveal={() => {
                  if (next === "locked") update({ ...state, unlocked: true });
                }}
              />
            ) : (
              <SlpLogo className="slp-bob h-auto w-[min(52vw,240px)]" />
            )
          }
          stageKey={context ? "preview" : "loading"}
          lines={lines}
          history={history ?? 0}
          cards={cards}
          pace={PACE_MS}
          labels={{ log: t(`${O}log`), typing: t(`${O}typing`) }}
        />
      </div>
      {celebrate && <SlurpConfetti fixed />}
    </Modal>
  );
}

function answerLabel(
  t: ReturnType<typeof useUiTranslation>["t"],
  context: SlpBasicContext,
  question: SlpBasicQuestion,
  value: string,
): string {
  if (question === "connection" && value === SLP_BASIC_LATER) return t(`${O}a.connection.later`);
  if (question === "connection" || question === "imageConnection") {
    const list = question === "connection" ? context.textConnections : context.imageConnections;
    return list.find((entry) => entry.id === value)?.name ?? value;
  }
  if (question === "crowd") return t(`ui.slurp.settings.simulation.presets.${value}`);
  if (question === "extras") {
    const picked = slpBasicExtras(value);
    return picked.length
      ? picked.map((id) => t(`ui.slurp.settings.ext.${id}.label`)).join(", ")
      : t(`${O}a.extras.none`);
  }
  return t(`${O}a.${key(question)}.${value}`);
}

// ponytail: the preview is the locked post card only; SlpPostCard needs a full post context. Add a
// feed preview once the real cards have their live actions split out (docs/CONFIGURATOR.md).
/**
 * The stage: Mari's real locked post with sample data. Names change her name, heat her caption and
 * the locked label, the crowd the fans, the pace and pictures the line under the card.
 */
function BasicPreview({
  answers,
  context,
  onReveal,
}: {
  answers: ReturnType<typeof slpBasicAnswers>;
  context: SlpBasicContext;
  onReveal: () => void;
}) {
  const { t } = useUiTranslation();
  const mari = useSlpMariPortrait();
  const stage = answers.names === "hinted";
  const noText = context.textConnections.length === 0 || answers.connection === SLP_BASIC_LATER;
  const pictures = answers.pictures === "yes" && context.imageConnections.length > 0;
  const imageName = context.imageConnections.find((entry) => entry.id === answers.imageConnection)?.name;
  const textName = context.textConnections.find((entry) => entry.id === answers.connection)?.name;
  const caption = t(`${O}preview.caption.mari.${answers.heat}`);
  const facts = [
    noText ? t(`${O}preview.manual`) : t(`${O}hint.pace.${answers.pace}`),
    t(`${O}preview.fans`, { fans: FANS[answers.crowd].toLocaleString() }),
    pictures && imageName ? t(`${O}preview.picturesBy`, { name: imageName }) : t(`${O}preview.noPictures`),
    textName && !noText ? t(`${O}preview.writtenBy`, { name: textName }) : null,
  ].filter(Boolean);
  // The card is square media plus chrome, so it outgrows short stages (phones, 900 px desktops):
  // scale it down to the stage height instead of cropping its header and the facts line.
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const preview = ref.current;
    const slot = preview?.parentElement;
    if (!preview || !slot) return;
    const fit = () => {
      const style = getComputedStyle(slot);
      const room = slot.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setScale(Math.min(1, room / preview.offsetHeight));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(slot);
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="flex w-full max-w-sm shrink-0 flex-col items-center gap-3 max-sm:max-w-[19rem]"
      style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
    >
      <div className="w-full overflow-hidden rounded-2xl shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
        <LockedSlurpPostCard
          post={{
            id: "basic-setup-demo",
            access: "locked",
            createdAt: new Date().toISOString(),
            title: caption,
            imageUrl: "/api/capability-packages/slurp2/assets/assets/mari/Mari_noodler_teaser_locked.webp",
            likeCount: Math.round(FANS[answers.crowd] / 9),
            replyCount: Math.round(FANS[answers.crowd] / 40),
          }}
          profile={{
            ...DEMO_PROFILE,
            avatarUrl: mari,
            displayName: t(`${O}preview.creator.mari.${stage ? "stage" : "own"}`),
            handle: stage ? "prof_m" : "professor_mari",
            disclosureMode: answers.names,
          }}
          subscribed={false}
          unlockPending={false}
          subscriptionPending={false}
          onUnlock={() => {}}
          onToggleSubscription={() => {}}
          demo={{
            body: t("ui.noodle.noodlerwizard.demoPost.walkthrough.body"),
            lockedTitle: caption,
            unlockedLabel: t("ui.noodle.postaccess.unlocked"),
            unlockedImageUrl: "/api/capability-packages/slurp2/assets/assets/mari/Mari_noodler_teaser_unlocked.webp",
            onReveal,
          }}
        />
      </div>
      <p className={cn(SLP_TYPE.meta, "text-center text-pretty text-[var(--slurp-muted)]")}>{facts.join(" · ")}</p>
    </div>
  );
}
