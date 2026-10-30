// ──────────────────────────────────────────────
// Otome Forge: the reader's title, scene count, place and content tags. Desktop shows its tools inline; mobile keeps
// mute, fullscreen and the disclosure visible, with the secondary tools stacked below. Rewrite names its call cost.
// A place waiting for "Ask before painting" (or failed) offers its paint beside its name, with its cost.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  EyeOff,
  FastForward,
  Feather,
  MapPin,
  MoreHorizontal,
  Paintbrush,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  ScrollText,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import type { ChapterKind, ChapterView, MomentKind, NodeKind } from "../../shared/api-types";
import { FullscreenButton } from "../../components/Stage";
import { ImageDescription } from "../../components/ImageDescription";
import { useAudioSnapshot, useOtomeAudio } from "../../hooks/use-otome-audio";
import { tagLabelKey } from "./ContentTagsCard";

const KIND_KEYS: Record<Exclude<ChapterKind, "main">, string> = {
  prologue: "ui.otomeForge.prologue.title",
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

/** The small frame label a node's kind earns (moments, the Confrontation, the Closer), or null for a plain beat. */
export function frameLabelKey(node: { kind: NodeKind; moment?: MomentKind } | null | undefined): string | null {
  if (!node) return null;
  if (node.kind === "confrontation") return "ui.otomeForge.reader.frameConfrontation";
  if (node.kind === "closer") return "ui.otomeForge.reader.frameCloser";
  if (node.kind === "moment") return node.moment ? MOMENT_KEYS[node.moment] : "ui.otomeForge.reader.frameMoment";
  return null;
}

interface ToolProps {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
}

function Tool({ label, Icon, onClick, pressed, disabled, className = "" }: ToolProps) {
  return (
    <button
      type="button"
      className={`of-icon-button of-glass of-reader-tool ${className}`}
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
  /** Text for a picture that isn't painted (the place's, or a key image's); absent once it is. */
  imageDescription?: string;
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
  /** A rewrite paints the scene's key moment again by itself (its old image is let go). */
  rewritePaints?: boolean;
  onRewrite: () => void;
  canEaseOff: boolean;
  onEaseOff: () => void;
  onExit: () => void;
  /** Faded under a story CG's pan: nothing in it can be focused or pressed. */
  inert?: boolean;
}

export function ReaderControls(props: ReaderControlsProps) {
  const { t } = useTranslation();
  const audio = useOtomeAudio();
  useAudioSnapshot();
  const [expanded, setExpanded] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const secondaryId = useId();
  // The first tap outside the disclosure only dismisses it, including a tap on the story beneath it.
  useEffect(() => {
    if (!expanded) return;
    const disclosureVisible = () => !!moreRef.current?.getClientRects().length;
    const dismiss = (event: MouseEvent) => {
      if (!disclosureVisible()) {
        setExpanded(false);
        return;
      }
      const target = event.target as Element | null;
      if (target?.closest(".of-reader-primary, [role='dialog']")) return;
      if (target?.closest(".of-reader-stage, .of-reader-bottom")) {
        event.preventDefault();
        event.stopPropagation();
      }
      setExpanded(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        !disclosureVisible() ||
        (event.target as Element | null)?.closest("[role='dialog']")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setExpanded(false);
      moreRef.current?.focus();
    };
    document.addEventListener("click", dismiss, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("click", dismiss, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [expanded]);
  const { chapter, node, nodeCount, replay, place, tags, reading } = props;
  const [eyebrowKey, eyebrowValues] = chapter ? chapterEyebrowKey(chapter) : ["ui.otomeForge.common.screenStory", {}];
  const frameKey = frameLabelKey(chapter && node !== null ? chapter.nodes[node] : null);
  const tagKeys = tags.flatMap((tag) => tagLabelKey(tag) ?? []);
  const exitLabel = t("ui.otomeForge.reader.exit");
  const rewriteLabel = props.rewritePaints
    ? t("ui.otomeForge.reader.rewritePaintsLabel")
    : t("ui.otomeForge.reader.rewriteLabel");
  const auto = (
    <Tool
      label={t("ui.otomeForge.reader.auto")}
      Icon={props.auto ? Pause : Play}
      pressed={props.auto}
      disabled={!reading}
      onClick={props.onAuto}
    />
  );
  const skip = (
    <Tool
      label={t("ui.otomeForge.reader.skip")}
      Icon={FastForward}
      disabled={!reading || !props.canSkip}
      onClick={props.onSkip}
    />
  );
  const log = <Tool label={t("ui.otomeForge.reader.backlog")} Icon={ScrollText} onClick={props.onLog} />;
  const hide = <Tool label={t("ui.otomeForge.reader.hide")} Icon={EyeOff} disabled={!reading} onClick={props.onHide} />;
  const rewrite = props.canRewrite ? (
    <button
      type="button"
      className="of-reader-pill of-glass"
      aria-label={rewriteLabel}
      title={rewriteLabel}
      onClick={props.onRewrite}
    >
      <RefreshCw size={14} strokeWidth={2.1} aria-hidden="true" />
      <span>{t("ui.otomeForge.reader.rewrite")}</span>
    </button>
  ) : null;
  const ease = props.canEaseOff ? (
    <button
      type="button"
      className="of-reader-pill of-reader-pill--ease of-glass"
      aria-label={t("ui.otomeForge.reader.easeOff")}
      title={t("ui.otomeForge.reader.easeOff")}
      onClick={props.onEaseOff}
    >
      <Feather size={14} strokeWidth={2.1} aria-hidden="true" />
      <span>{t("ui.otomeForge.reader.easeOff")}</span>
    </button>
  ) : null;
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
        <div className="of-reader-tools of-reader-primary">
          <Tool
            className="of-reader-mobile"
            label={t(audio?.audioSettings.muted ? "ui.otomeForge.reader.unmute" : "ui.otomeForge.reader.mute")}
            Icon={audio?.audioSettings.muted ? VolumeX : Volume2}
            disabled={!audio}
            onClick={() => audio?.setMuted(!audio.audioSettings.muted)}
          />
          {/* Shared definitions keep the CSS-switched desktop and mobile copies in sync. */}
          <div className="of-reader-tools of-reader-desktop">
            {auto}
            {skip}
            {log}
          </div>
          <FullscreenButton className="of-reader-tool" />
          <button
            ref={moreRef}
            type="button"
            className="of-icon-button of-glass of-reader-tool of-reader-mobile"
            aria-label={t("ui.otomeForge.reader.moreControls")}
            title={t("ui.otomeForge.reader.moreControls")}
            aria-expanded={expanded}
            aria-controls={secondaryId}
            onClick={(event) => {
              event.currentTarget.focus();
              setExpanded(!expanded);
            }}
          >
            <MoreHorizontal size={17} strokeWidth={2} aria-hidden="true" />
          </button>
          <div id={secondaryId} className="of-reader-secondary" data-expanded={expanded}>
            {auto}
            {skip}
            {hide}
            {log}
            {rewrite}
            {ease}
          </div>
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
        <div className="of-reader-tools of-reader-desktop">
          {hide}
          {rewrite}
          {ease}
        </div>
      </div>
      <ImageDescription text={props.imageDescription} />
    </header>
  );
}
