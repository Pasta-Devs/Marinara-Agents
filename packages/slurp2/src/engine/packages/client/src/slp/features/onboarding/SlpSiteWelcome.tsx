// The player's join as one Slurp Support ticket (docs/ONBOARDING-RAIL.md), drawn on the shared chat
// shell from the pure script in slp-site-welcome.ts. Chips are the only input and nothing is written
// before "Stamp it". The first run keeps its place per browser, so a reload resumes the ticket.
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Modal } from "../../../components/ui/Modal";
import { cn } from "../../../lib/utils";
import { getSlpAccentStyle, SLP_PINK, SLP_TYPE, useSlpMediaQuery } from "../../base/chrome/SlpChrome";
import { SlpChip } from "../../modules/chrome/SlpButton";
import { SlpChatShell, type SlpChatChip, type SlpChatItem } from "../../modules/chrome/SlpChatShell";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpWizardProgress } from "../../modules/chrome/SlpWizardChrome";
import { SlurpAgeGate } from "./SlpAgeGate";
import { leaveUnlessBackdrop } from "./SlpSplash";
import { useSlpRailContext, useSlpRailWrite } from "./slp-rail-hooks";
import {
  slpRailAnswerLabel,
  SlpRailChangePill,
  SlpRailFileRows,
  SlpRailLockedDemo,
  SlpRailMemberFile,
  SlpRailSampleCreator,
  SlpRailStampCard,
} from "./SlpRailCards";
import {
  SLP_RAIL_STOPS,
  slpRailAnswers,
  slpRailCanSkipIntro,
  slpRailDefaults,
  slpRailFileRows,
  slpRailNext,
  slpRailSettle,
  slpRailStamp,
  slpRailSteps,
  slpRailStop,
  slpRailTranscript,
  type SlpRailContext,
  type SlpRailEvent,
  type SlpRailQuestion,
  type SlpRailStamp,
  type SlpRailState,
  type SlpRailStep,
} from "./slp-site-welcome";

// Per browser, like the splash: the ticket is a walk-through, not a setting, until it is stamped.
const STORE_KEY = "slurp2:support-rail";
const EMPTY: SlpRailState = { answers: {}, events: [], seen: [] };
/** Typing dots before each Support line. */
const PACE_MS = 700;
/** Answers that get a "set · Change" pill; the rest only steer the rail. */
const NO_PILL = new Set<SlpRailQuestion>(["coins", "fun", "rating"]);

function readSaved(): SlpRailState | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "null") as Partial<SlpRailState> | null;
    if (!raw || typeof raw.answers !== "object" || !Array.isArray(raw.events) || !Array.isArray(raw.seen)) return null;
    return { answers: raw.answers ?? {}, events: raw.events, seen: raw.seen, skipIntro: raw.skipIntro === true };
  } catch {
    return null;
  }
}

function save(state: SlpRailState | null) {
  try {
    if (state) window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Blocked storage: a reload starts the ticket again, which is harmless.
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
  /** Leaves Slurp: the way out of the age check ("Not now", and X before it is confirmed). */
  onLeave?: () => void;
  /** Closes the ticket after the age check; a first run resumes where it was. */
  onClose: () => void;
  onStamped: (stamp: SlpRailStamp) => void;
  onFeed: () => void;
  onSignUp: () => void;
  onQuickLane: () => void;
}) {
  const { t } = useUiTranslation();
  const context = useSlpRailContext(opening, open);
  const writer = useSlpRailWrite();
  const wide = useSlpMediaQuery("(min-width: 640px)");
  const [raw, setRaw] = useState<SlpRailState>(() => (opening === "first" ? readSaved() : null) ?? EMPTY);
  // A Change asks again at the bottom of the chat; the answer then shows there too.
  const [editing, setEditing] = useState<SlpRailQuestion | null>(null);
  const [edits, setEdits] = useState<{ id: SlpRailQuestion; key: number }[]>([]);
  const [recent, setRecent] = useState<SlpRailQuestion | null>(null);
  const [fileOpen, setFileOpen] = useState(false);
  // A resumed ticket shows what was already said at once; only new lines get typing dots.
  const [resumed] = useState(() => raw !== EMPTY);
  const [history, setHistory] = useState<number | null>(null);

  const state = context ? slpRailSettle(raw, context) : raw;
  const update = (next: SlpRailState) => {
    const settled = context ? slpRailSettle(next, context) : next;
    setRaw(settled);
    // A stamped ticket is done: onboarding is complete on the server, nothing is left to resume.
    if (opening === "first") save(settled.events.includes("stamped") ? null : settled);
  };
  const fire = (event: SlpRailEvent) => {
    if (!state.events.includes(event)) update({ ...state, events: [...state.events, event] });
  };
  const confirmed = opening === "again" || state.events.includes("ageConfirmed");
  const stamped = state.events.includes("stamped");
  const close = () => (confirmed ? onClose() : leaveUnlessBackdrop(onLeave));

  const support = { name: t("ui.slurp.scene.host.support"), avatarUrl: null };
  const items: SlpChatItem[] = [];
  const chips: SlpChatChip[] = [];
  let next: SlpRailStep | null = null;
  let rows: SlpRailQuestion[] = [];

  if (context) {
    next = slpRailNext(state, context);
    rows = slpRailFileRows(state, context);
    const answers = slpRailAnswers(state, context);
    const defaults = slpRailDefaults(context);
    const label = (id: SlpRailQuestion, value: string | undefined) => slpRailAnswerLabel(t, id, value, context);
    const options = (step: Extract<SlpRailStep, { kind: "ask" }>) =>
      step.options.map((value): SlpChatChip => {
        const connection = step.id === "connection" || step.id === "imageConnection";
        const marked = connection
          ? (step.id === "connection" ? context.textConnections : context.imageConnections).some(
              (entry) => entry.id === value && entry.isDefault,
            )
          : false;
        return {
          id: value,
          label: marked
            ? t("ui.slurp.site.a.connection.default", { name: label(step.id, value) })
            : label(step.id, value),
          ariaLabel: step.id === "rating" ? t("ui.slurp.site.a.rating", { count: Number(value) }) : undefined,
          primary: (state.answers[step.id] ?? defaults[step.id]) === value,
          onSelect: () => answer(step.id, value),
        };
      });
    const answer = (id: SlpRailQuestion, value: string) => {
      if (editing) setEdits((list) => [...list, { id, key: Date.now() }]);
      setEditing(null);
      setRecent(id);
      update({ ...state, answers: { ...state.answers, [id]: value } });
    };
    const change = (id: SlpRailQuestion) => {
      setEditing(id);
      setFileOpen(false);
    };
    const pill = (id: SlpRailQuestion, key: string) => {
      if (NO_PILL.has(id)) return;
      items.push({
        kind: "card",
        id: `pill-${key}`,
        align: "center",
        content: (
          <SlpRailChangePill
            label={t(`ui.slurp.site.label.${id}`)}
            recent={id === recent}
            onChange={stamped ? undefined : () => change(id)}
          />
        ),
      });
    };
    const mine = (id: string, text: string) => items.push({ kind: "bubble", id, text, mine: true });
    const card = (step: Extract<SlpRailStep, { kind: "card" }>) => {
      if (step.id === "pastapay")
        return (
          <SlurpAgeGate
            personaName={personaName}
            done={confirmed}
            onComplete={() => fire("ageConfirmed")}
            onLeave={onLeave}
          />
        );
      if (step.id === "sampleCreator") return <SlpRailSampleCreator />;
      if (step.id === "lockedDemo") return <SlpRailLockedDemo onReveal={() => fire("revealed")} />;
      if (step.id === "stamp") return <SlpRailStampCard />;
      return (
        <SlpRailMemberFile
          rows={rows}
          state={state}
          context={context}
          stamped={stamped}
          pending={writer.pending}
          onChange={change}
          onStamp={() => void stamp()}
        />
      );
    };
    const stamp = async () => {
      const result = slpRailStamp(state, context);
      try {
        await writer.write(result, state.answers.imageConnection !== undefined);
      } catch {
        toast.error(t("ui.slurp.onboarding.saveError"));
        return;
      }
      setEditing(null);
      fire("stamped");
      onStamped(result);
    };
    const render = (step: SlpRailStep, passed: boolean) => {
      if (step.kind === "say") items.push({ kind: "bubble", id: step.id, text: t(step.key) });
      if (step.kind === "card")
        items.push({
          kind: "card",
          id: step.id,
          align: step.id === "stamp" || step.id === "lockedDemo" ? "center" : "host",
          content: card(step),
        });
      if (step.kind === "ask") {
        items.push({ kind: "bubble", id: `q-${step.id}`, text: t(`ui.slurp.site.q.${step.id}`) });
        if (passed) {
          const lane = step.id === "who" && state.answers.lane && state.answers.who === undefined;
          mine(`a-${step.id}`, lane ? t("ui.slurp.site.tap.recommended") : label(step.id, answers[step.id]));
          if (!lane) pill(step.id, step.id);
        }
      }
      if (passed && step.kind !== "ask" && step.tap) mine(`tap-${step.id}`, t(step.tap));
    };
    for (const step of slpRailTranscript(state, context)) render(step, true);
    for (const edit of edits) {
      items.push({ kind: "bubble", id: `q-${edit.key}`, text: t(`ui.slurp.site.q.${edit.id}`) });
      mine(`a-${edit.key}`, label(edit.id, answers[edit.id]));
      pill(edit.id, String(edit.key));
    }
    if (history === null) setHistory(resumed ? items.length : 0);
    if (next && next.kind !== "wait") render(next, false);

    if (editing) {
      items.push({ kind: "bubble", id: `again-${editing}`, text: t(`ui.slurp.site.q.${editing}`) });
      const step = slpRailSteps(context).find((entry) => entry.kind === "ask" && entry.id === editing);
      if (step?.kind === "ask") chips.push(...options(step));
    } else if (next?.kind === "ask") {
      chips.push(...options(next));
      if (next.id === "who")
        chips.push({
          id: "recommended",
          label: t("ui.slurp.site.tap.recommended"),
          onSelect: () => update({ ...state, answers: { ...state.answers, lane: "recommended" } }),
        });
    } else if (next?.tap) {
      const step = next;
      chips.push({
        id: step.id,
        label: t(step.tap!),
        primary: true,
        onSelect: () => (step.kind === "wait" ? fire(step.id) : update({ ...state, seen: [...state.seen, step.id] })),
      });
    } else if (!next) {
      if (answers.who === "watch")
        chips.push({ id: "feed", label: t("ui.slurp.site.feed"), primary: true, onSelect: onFeed });
      else
        chips.push(
          { id: "signup", label: t("ui.slurp.site.signUp"), primary: true, onSelect: onSignUp },
          { id: "list", label: t("ui.slurp.site.tap.pickList"), onSelect: onQuickLane },
        );
    }
  }

  const stop = slpRailStop(next);
  const stopIndex = SLP_RAIL_STOPS.indexOf(stop);
  // "Your Slurp" has something to show from the questions on.
  const filed = context !== null && stopIndex >= SLP_RAIL_STOPS.indexOf("setup");
  const preview =
    context && filed ? <SlpRailFileRows rows={rows} state={state} context={context} recent={recent} /> : null;
  const headerButton =
    "grid size-11 shrink-0 place-items-center rounded-full text-[var(--slurp-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none [&_svg]:!text-current";

  return (
    <Modal
      open={open}
      onClose={close}
      title={t("ui.slurp.scene.host.support")}
      width="max-w-3xl"
      mobileFullscreen
      // The chat shell draws its own header (Support, the ticket, the X), so the Modal's is hidden.
      panelClassName="sm:h-[min(46rem,90dvh)] [&>div:first-child]:hidden"
      contentClassName="flex flex-col !overflow-hidden !p-0"
      panelStyle={getSlpAccentStyle(SLP_PINK)}
      closeDisabled={!confirmed && !onLeave}
    >
      <div data-component="SlpSiteWelcome" className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SlpChatShell
            host={support}
            status={t("ui.slurp.site.ticket", {
              status: t(stamped ? "ui.slurp.site.status.resolved" : "ui.slurp.site.status.open"),
            })}
            headerEnd={
              (confirmed || onLeave) && (
                <button
                  type="button"
                  onClick={close}
                  aria-label={confirmed ? t("ui.slurp.site.close") : t("ui.slurp.ageGate.leave")}
                  className={headerButton}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              )
            }
            // The ticket's own actions sit beside the progress, so the header keeps its name and status.
            subheader={
              <div className="flex shrink-0 items-center gap-2 px-3">
                <div className="min-w-0 flex-1 pt-3">
                  <SlpWizardProgress
                    current={stopIndex + 1}
                    total={SLP_RAIL_STOPS.length}
                    stepOf={t("ui.slurp.wizard.stepOf", { current: stopIndex + 1, total: SLP_RAIL_STOPS.length })}
                    label={t(`ui.slurp.site.stop.${stop}`)}
                  />
                </div>
                {context && slpRailCanSkipIntro(state, context) && (
                  <SlpChip className="min-h-11 shrink-0 px-3" onClick={() => update({ ...state, skipIntro: true })}>
                    {t("ui.slurp.site.tap.skipIntro")}
                  </SlpChip>
                )}
                {filed && !wide && (
                  <SlpChip className="min-h-11 shrink-0 px-3" onClick={() => setFileOpen(true)}>
                    {t("ui.slurp.site.preview")}
                  </SlpChip>
                )}
              </div>
            }
            items={items}
            history={history ?? 0}
            chips={chips}
            chipsLabel={t("ui.slurp.site.reply")}
            pace={PACE_MS}
            labels={{ log: t("ui.slurp.site.log"), typing: t("ui.slurp.site.typing") }}
          />
        </div>
        {wide && (
          <aside
            aria-label={t("ui.slurp.site.preview")}
            className="flex w-72 shrink-0 flex-col overflow-y-auto border-s border-[var(--noodle-divider)] p-3"
          >
            <h3 className={cn(SLP_TYPE.title, "flex min-h-11 items-center px-1")}>{t("ui.slurp.site.preview")}</h3>
            {preview ?? (
              <p className={cn(SLP_TYPE.body, "px-1 text-pretty text-[var(--slurp-muted)]")}>
                {t("ui.slurp.site.previewEmpty")}
              </p>
            )}
          </aside>
        )}
      </div>
      <SlpSheet open={fileOpen && !wide} onClose={() => setFileOpen(false)} title={t("ui.slurp.site.preview")}>
        {preview}
      </SlpSheet>
    </Modal>
  );
}
