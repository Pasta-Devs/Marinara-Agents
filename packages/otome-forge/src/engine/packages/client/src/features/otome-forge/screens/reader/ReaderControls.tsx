// ──────────────────────────────────────────────
// Otome Forge: the reader's header. The way out, the chapter's title (the screen's heading) and scene count; Auto,
// Skip-read and the Backlog; then the scene's frame label and content tags, Hide UI, Rewrite beat (it says it costs a
// call) and Ease off, which is always in reach. A place that waits for "Ask before painting" (or failed) offers its
// paint beside its name, with its cost.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  EyeOff,
  FastForward,
  Feather,
  MapPin,
  Paintbrush,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import type { ChapterKind, ChapterView, MomentKind, NodeKind } from "../../shared/api-types";
import { tagLabelKey } from "./ContentTagsCard";

const KIND_KEYS: Record<Exclude<ChapterKind, "main">, string> = {
  route: "ui.otomeForge.story.kindRoute",
  repair: "ui.otomeForge.story.kindRepair",
  story: "ui.otomeForge.story.kindStory",
  date: "ui.otomeForge.story.kindDate",
};

/** A chapter's eyebrow: "Chapter 3", or its kind. */
export function chapterEyebrowKey(chapter: Pick<ChapterView, "kind" | "number">): [string, { number?: number }] {
  return chapter.kind === "main"
    ? ["ui.otomeForge.story.chapterNumber", { number: chapter.number ?? 1 }]
    : [KIND_KEYS[chapter.kind], {}];
}

const MOMENT_KEYS: Record<MomentKind, string> = {
  call: "ui.otomeForge.reader.momentCall",
  "read-him": "ui.otomeForge.reader.momentReadHim",
  date: "ui.otomeForge.reader.momentDate",
};

/** The small frame label a node's kind earns (moments and the Confrontation), or null for a plain beat. */
export function frameLabelKey(node: { kind: NodeKind; moment?: MomentKind } | null | undefined): string | null {
  if (!node) return null;
  if (node.kind === "confrontation") return "ui.otomeForge.reader.frameConfrontation";
  if (node.kind === "moment") return node.moment ? MOMENT_KEYS[node.moment] : "ui.otomeForge.reader.frameMoment";
  return null;
}

interface ToolProps {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}

function Tool({ label, Icon, onClick, pressed, disabled }: ToolProps) {
  return (
    <button
      type="button"
      className="of-icon-button of-glass of-reader-tool"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onClick();
      }}
    >
      <Icon size={17} strokeWidth={2} aria-hidden="true" fill={pressed ? "currentColor" : "none"} />
    </button>
  );
}

interface ReaderControlsProps {
  chapter: ChapterView | null;
  node: number | null;
  nodeCount: number;
  replay: boolean;
  /** Where the current line takes place. */
  place?: string;
  /** The place's picture waits for a tap (consent, or a retry after a failure). */
  placePaint?: { retry: boolean; busy: boolean; onPaint: () => void };
  tags: string[];
  /** The scene is showing (not loading, not the tags card or the end card). */
  reading: boolean;
  auto: boolean;
  onAuto: () => void;
  canSkip: boolean;
  onSkip: () => void;
  onLog: () => void;
  onHide: () => void;
  canRewrite: boolean;
  onRewrite: () => void;
  canEaseOff: boolean;
  onEaseOff: () => void;
  onExit: () => void;
  /** Faded under a story CG's pan: nothing in it can be focused or pressed. */
  inert?: boolean;
}

export function ReaderControls(props: ReaderControlsProps) {
  const { t } = useTranslation();
  const { chapter, node, nodeCount, replay, place, tags, reading } = props;
  const [eyebrowKey, eyebrowValues] = chapter ? chapterEyebrowKey(chapter) : ["ui.otomeForge.common.screenStory", {}];
  const frameKey = frameLabelKey(chapter && node !== null ? chapter.nodes[node] : null);
  const tagKeys = tags.flatMap((tag) => tagLabelKey(tag) ?? []);
  const exitLabel = t("ui.otomeForge.reader.exit");
  const rewriteLabel = t("ui.otomeForge.reader.rewriteLabel");
  return (
    <header className="of-reader-head" inert={props.inert} onClick={(event) => event.stopPropagation()}>
      <div className="of-reader-row">
        <button
          type="button"
          className="of-icon-button of-glass"
          aria-label={exitLabel}
          title={exitLabel}
          onClick={props.onExit}
        >
          <ChevronLeft className="of-back-icon" size={20} strokeWidth={2.1} aria-hidden="true" />
        </button>
        <h1 className="of-reader-title" tabIndex={-1}>
          <span className="of-reader-eyebrow">
            {t(eyebrowKey, eyebrowValues)}
            {node !== null && nodeCount ? (
              <span className="of-reader-scene-count">
                {" · "}
                {t("ui.otomeForge.reader.sceneOf", { number: node + 1, total: nodeCount })}
              </span>
            ) : null}
          </span>
          <span className="of-reader-name">
            {chapter ? chapter.title || t("ui.otomeForge.story.untitled") : t("ui.otomeForge.common.loading")}
          </span>
        </h1>
        <div className="of-reader-tools">
          <Tool
            label={t("ui.otomeForge.reader.auto")}
            Icon={props.auto ? Pause : Play}
            pressed={props.auto}
            disabled={!reading}
            onClick={props.onAuto}
          />
          <Tool
            label={t("ui.otomeForge.reader.skip")}
            Icon={FastForward}
            disabled={!reading || !props.canSkip}
            onClick={props.onSkip}
          />
          <Tool label={t("ui.otomeForge.reader.backlog")} Icon={ScrollText} onClick={props.onLog} />
        </div>
      </div>
      <div className="of-reader-row of-reader-row--sub">
        <ul className="of-reader-chips" aria-label={t("ui.otomeForge.reader.aboutScene")}>
          {replay ? (
            <li className="of-reader-chip of-reader-chip--replay">
              <Repeat size={12} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.reader.replay")}
            </li>
          ) : null}
          {place ? (
            <li key={place} className="of-reader-chip of-reader-chip--place">
              <MapPin size={12} strokeWidth={2.2} aria-hidden="true" />
              {place}
            </li>
          ) : null}
          {place && props.placePaint ? (
            <li className="of-reader-chip-slot">
              <button
                type="button"
                className="of-reader-chip of-reader-chip--paint"
                aria-disabled={props.placePaint.busy}
                aria-label={t(
                  props.placePaint.retry
                    ? "ui.otomeForge.reader.placeRetryLabel"
                    : "ui.otomeForge.reader.placePaintLabel",
                  { place },
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!props.placePaint?.busy) props.placePaint?.onPaint();
                }}
              >
                <Paintbrush size={12} strokeWidth={2.2} aria-hidden="true" />
                {t(props.placePaint.retry ? "ui.otomeForge.reader.placeRetry" : "ui.otomeForge.reader.placePaint")}
              </button>
            </li>
          ) : null}
          {frameKey ? <li className="of-reader-chip of-reader-chip--frame">{t(frameKey)}</li> : null}
          {tagKeys.map((key) => (
            <li key={key} className="of-reader-chip of-reader-chip--tag">
              {t(key)}
            </li>
          ))}
        </ul>
        <div className="of-reader-tools">
          <Tool label={t("ui.otomeForge.reader.hide")} Icon={EyeOff} disabled={!reading} onClick={props.onHide} />
          {props.canRewrite ? (
            <button
              type="button"
              className="of-reader-pill of-glass"
              aria-label={rewriteLabel}
              title={rewriteLabel}
              onClick={props.onRewrite}
            >
              <RefreshCw size={14} strokeWidth={2.1} aria-hidden="true" />
              {t("ui.otomeForge.reader.rewrite")}
            </button>
          ) : null}
          {props.canEaseOff ? (
            <button type="button" className="of-reader-pill of-reader-pill--ease of-glass" onClick={props.onEaseOff}>
              <Feather size={14} strokeWidth={2.1} aria-hidden="true" />
              {t("ui.otomeForge.reader.easeOff")}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
