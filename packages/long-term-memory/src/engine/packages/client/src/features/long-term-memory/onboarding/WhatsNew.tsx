import { useEffect, useId, useRef, useState } from "react";
import {
  Activity,
  ChevronRight,
  GitBranch,
  Link2,
  Network,
  RotateCcw,
  RotateCw,
  ScrollText,
  Search,
  Share2,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLtmTranslation } from "../localization";
import { Button, ModalDialog } from "../shared-controls";
import { ltmOnboardingSpriteUrl } from "./assets";
import { TidyWithAi, type LtmAiCheckKind } from "./TidyWithAi";
import { writeWhatsNewSeen } from "./progress";

export type LtmWhatsNewAction = "review" | "sources";

// Mari's cabinet gag: twelve 216x192 frames. The pause in ms before each next frame; the last frame holds.
const FRAME_WIDTH = 216;
const FRAME_HEIGHT = 192;
// The thumbs-up (5th) is the long beat; the tilt behind her back is short, the fall quick, the wreck lingers.
const HOLDS = [900, 450, 350, 700, 1100, 500, 300, 300, 220, 800, 900];
const LAST_FRAME = HOLDS.length;

// [icon, name, title key, text key]
const CHANGES: [LucideIcon, string, string, string][] = [
  [Network, "graph", "ui.longTermMemory.whatsnew.graphTitle", "ui.longTermMemory.whatsnew.graphText"],
  [Activity, "activity", "ui.longTermMemory.whatsnew.activityTitle", "ui.longTermMemory.whatsnew.activityText"],
  [GitBranch, "branches", "ui.longTermMemory.whatsnew.branchesTitle", "ui.longTermMemory.whatsnew.branchesText"],
  [Search, "recall", "ui.longTermMemory.whatsnew.recallTitle", "ui.longTermMemory.whatsnew.recallText"],
  [ScrollText, "extraction", "ui.longTermMemory.whatsnew.extractionTitle", "ui.longTermMemory.whatsnew.extractionText"],
  [Share2, "sharing", "ui.longTermMemory.whatsnew.sharingTitle", "ui.longTermMemory.whatsnew.sharingText"],
];
// The shorter lines behind "Everything else that changed": ui.longTermMemory.whatsnew.more1 … more9.
const MORE_COUNT = 9;
// The AI checks open their flow in this dialog: [kind, icon, title key, hint key]
const AI_CHECKS: [LtmAiCheckKind, LucideIcon, string, string][] = [
  ["tidy", Sparkles, "ui.longTermMemory.whatsnew.tidyTitle", "ui.longTermMemory.whatsnew.tidyText"],
  ["links", Link2, "ui.longTermMemory.whatsnew.linkTitle", "ui.longTermMemory.whatsnew.linkText"],
  ["people", Users, "ui.longTermMemory.whatsnew.peopleTitle", "ui.longTermMemory.whatsnew.peopleText"],
];
const ACTIONS: [LtmWhatsNewAction, LucideIcon, string, string][] = [
  ["review", Users, "ui.longTermMemory.whatsnew.mergeTitle", "ui.longTermMemory.whatsnew.mergeText"],
  ["sources", RotateCw, "ui.longTermMemory.whatsnew.rereadTitle", "ui.longTermMemory.whatsnew.rereadText"],
];

const STYLE = `
[data-ltm-whats-new-replay] {
  position: relative;
  display: block;
  flex: none;
  max-width: 100%;
  width: ${FRAME_WIDTH}px;
  height: ${FRAME_HEIGHT}px;
  min-height: ${FRAME_HEIGHT}px;
  padding: 0;
  border: 0;
  background-color: transparent;
  background-repeat: no-repeat;
  background-size: ${FRAME_WIDTH * (LAST_FRAME + 1)}px ${FRAME_HEIGHT}px;
  image-rendering: pixelated;
  cursor: pointer;
}
[data-ltm-whats-new-replay]:focus-visible {
  outline: 2px solid var(--marinara-editor-focus-ring);
  outline-offset: 2px;
}
[data-ltm-whats-new-action]:hover {
  background: var(--marinara-editor-control-bg-hover);
}
[data-ltm-whats-new-ai] {
  background: color-mix(in srgb, var(--marinara-editor-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--marinara-editor-accent) 40%, transparent);
}
[data-ltm-whats-new-ai]:hover {
  background: color-mix(in srgb, var(--marinara-editor-accent) 20%, transparent);
}
[data-ltm-whats-new-action]:focus-visible,
[data-ltm-whats-new-ai]:focus-visible {
  outline: 2px solid var(--marinara-editor-focus-ring);
  outline-offset: -2px;
}
[data-ltm-whats-new-replay-icon] {
  position: absolute;
  right: 0.25rem;
  bottom: 0.25rem;
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  background: var(--marinara-editor-bg);
  color: var(--marinara-editor-accent);
}
`;

/**
 * The one-time "What's new in 1.6" dialog. Mari plays her cabinet gag once and holds the last frame; clicking her
 * plays it again. Every way out writes the seen flag, so it opens by itself only once.
 */
export function WhatsNew({
  packageVersion,
  onClose,
  onTour,
  onAction,
}: {
  packageVersion?: string | null;
  onClose: () => void;
  onTour: () => void;
  onAction: (action: LtmWhatsNewAction) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const [reduceMotion] = useState(() => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const [frame, setFrame] = useState(reduceMotion ? LAST_FRAME : 0);
  useEffect(() => {
    if (frame >= LAST_FRAME) return;
    const timer = setTimeout(() => setFrame(frame + 1), HOLDS[frame]);
    return () => clearTimeout(timer);
  }, [frame]);
  const [check, setCheck] = useState<LtmAiCheckKind | null>(null);
  const checkRows = useRef<Partial<Record<LtmAiCheckKind, HTMLButtonElement | null>>>({});
  const returnedFrom = useRef<LtmAiCheckKind | null>(null);
  // Back from an AI check lands on its row again, as the row that opened it.
  useEffect(() => {
    if (!check && returnedFrom.current) checkRows.current[returnedFrom.current]?.focus({ preventScroll: true });
  }, [check]);
  const open = AI_CHECKS.find(([kind]) => kind === check);
  const leave = (then: () => void) => () => {
    writeWhatsNewSeen();
    then();
  };
  return (
    <ModalDialog
      titleId={titleId}
      descriptionId={descriptionId}
      initialFocus="[data-ltm-whats-new-close]"
      onCancel={leave(onClose)}
      panelClassName="max-w-lg max-h-full overflow-y-auto"
      data-ltm-whats-new
    >
      <style>{STYLE}</style>
      {check ? null : (
        <div className="flex justify-center">
          <button
            type="button"
            data-ltm-whats-new-replay
            data-ltm-whats-new-frame={frame}
            aria-label={localizeUi("ui.longTermMemory.whatsnew.replay")}
            onClick={() => {
              if (!reduceMotion) setFrame(0);
            }}
            style={{
              backgroundImage: `url("${ltmOnboardingSpriteUrl("whats-new-cabinet", packageVersion)}")`,
              backgroundPosition: `${-FRAME_WIDTH * frame}px 0`,
            }}
          >
            {frame === LAST_FRAME && !reduceMotion ? (
              <span data-ltm-whats-new-replay-icon aria-hidden="true">
                <RotateCcw aria-hidden="true" size="0.875rem" />
              </span>
            ) : null}
          </button>
        </div>
      )}
      <h2 id={titleId} className="text-base font-semibold text-[var(--foreground)]">
        {localizeUi(open ? open[2] : "ui.longTermMemory.whatsnew.title")}
      </h2>
      <p id={descriptionId} className="text-sm text-[var(--muted-foreground)]">
        {localizeUi(open ? open[3] : "ui.longTermMemory.whatsnew.intro")}
      </p>
      {check ? (
        <TidyWithAi
          kind={check}
          onBack={() => {
            returnedFrom.current = check;
            setCheck(null);
          }}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {CHANGES.map(([Icon, name, title, text]) => (
              <li key={name} data-ltm-whats-new-change={name} className="flex items-start gap-3">
                <Icon aria-hidden="true" size="1rem" className="mt-0.5 shrink-0 text-[var(--marinara-editor-accent)]" />
                <span className="min-w-0">
                  <strong className="block text-sm text-[var(--foreground)]">{localizeUi(title)}</strong>
                  <span className="block text-xs text-[var(--muted-foreground)]">{localizeUi(text)}</span>
                </span>
              </li>
            ))}
          </ul>
          <details data-ltm-whats-new-more>
            <summary className="cursor-pointer text-sm text-[var(--marinara-editor-accent)]">
              {localizeUi("ui.longTermMemory.whatsnew.moreHeading")}
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--muted-foreground)]">
              {Array.from({ length: MORE_COUNT }, (_, index) => (
                <li key={index}>{localizeUi(`ui.longTermMemory.whatsnew.more${index + 1}`)}</li>
              ))}
            </ul>
          </details>
          <div className="border-t border-[var(--marinara-editor-divider)] pt-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              {localizeUi("ui.longTermMemory.whatsnew.existingHeading")}
            </h3>
          </div>
          <div>
            {AI_CHECKS.map(([kind, Icon, title, text]) => (
              <button
                key={kind}
                ref={(node) => {
                  checkRows.current[kind] = node;
                }}
                type="button"
                data-ltm-whats-new-ai={kind}
                {...(kind === "tidy" ? { "data-ltm-whats-new-tidy": true } : {})}
                onClick={() => setCheck(kind)}
                className="mb-1 flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left"
              >
                <Icon aria-hidden="true" size="1rem" className="shrink-0 text-[var(--marinara-editor-accent)]" />
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm text-[var(--foreground)]">{localizeUi(title)}</strong>
                  <span className="block text-xs text-[var(--muted-foreground)]">{localizeUi(text)}</span>
                </span>
                <ChevronRight aria-hidden="true" size="1rem" className="shrink-0 text-[var(--muted-foreground)]" />
              </button>
            ))}
            {ACTIONS.map(([action, Icon, title, text]) => (
              <button
                key={action}
                type="button"
                data-ltm-whats-new-action={action}
                onClick={leave(() => onAction(action))}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left"
              >
                <Icon aria-hidden="true" size="1rem" className="shrink-0 text-[var(--marinara-editor-accent)]" />
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm text-[var(--foreground)]">{localizeUi(title)}</strong>
                  <span className="block text-xs text-[var(--muted-foreground)]">{localizeUi(text)}</span>
                </span>
                <ChevronRight aria-hidden="true" size="1rem" className="shrink-0 text-[var(--muted-foreground)]" />
              </button>
            ))}
          </div>
          <p data-ltm-whats-new-hint className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.whatsnew.reopenHint")}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button data-ltm-whats-new-close onClick={leave(onClose)}>
              {localizeUi("ui.longTermMemory.memoryvault.close")}
            </Button>
            <Button primary data-ltm-whats-new-tour onClick={leave(onTour)}>
              {localizeUi("ui.longTermMemory.tour.takeTour")}
            </Button>
          </div>
        </>
      )}
    </ModalDialog>
  );
}
