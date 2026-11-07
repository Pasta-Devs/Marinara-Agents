// ──────────────────────────────────────────────
// Story Writer: the floating bars under the book (write, stop, continue, rewrite, fullscreen, word count; quick replies)
// ──────────────────────────────────────────────
import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCheck,
  Feather,
  Library,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  RotateCcw,
  Square,
  StepForward,
} from "lucide-react";
import type { GenerationStatus } from "../../hooks/use-story-generation";
import type { QuickReply } from "../../lib/story-writer/model";
import { useNumberFormat } from "./sidebar/fields";

export interface FullscreenControl {
  active: boolean;
  setActive(active: boolean): void;
  enterLabel: string;
  exitLabel: string;
}

export function ActionBar(props: {
  status: GenerationStatus;
  canWrite: boolean;
  hasConnection: boolean;
  chapterCount: number;
  /** The last chapter is a draft, so Write continues it. */
  lastChapterDraft: boolean;
  generatingChapterNumber: number | null;
  liveWords: number;
  totalWords: number;
  targetWords: number | null;
  fullscreen: FullscreenControl | null;
  onWrite(): void;
  onContinue(): void;
  onRewrite(): void;
  onStop(): void;
  onOpenLibrary(): void;
  /** Marks the draft last chapter finished and writes the next one. */
  onFinishChapter(): void;
}) {
  const { t } = useTranslation();
  const hintId = useId();
  const formatNumber = useNumberFormat();
  const words = (count: number) => t("actions.words", { count, formatted: formatNumber(count) });
  const busy = props.status !== "idle";
  const number = props.generatingChapterNumber ?? props.chapterCount;
  const primaryLabel = props.lastChapterDraft
    ? t("actions.continueDraft", { number: props.chapterCount })
    : t("actions.write");
  const statusLabel =
    props.status === "writing"
      ? t("actions.writingStatus", { number })
      : props.status === "summarizing"
        ? t("actions.summarizing")
        : t("actions.timeline");
  const target = props.targetWords;
  const percent = target ? Math.min(100, Math.round((props.totalWords / target) * 100)) : 0;
  const fullscreen = props.fullscreen;

  return (
    <div className="sw-actionbar" role="toolbar" aria-label={t("actions.label")}>
      {busy ? (
        <>
          <button
            type="button"
            className="sw-action-primary"
            data-stop="true"
            aria-label={t("actions.stop")}
            title={t("actions.stop")}
            onClick={props.onStop}
          >
            <Square size={15} fill="currentColor" aria-hidden="true" />
            <span className="sw-action-label-long">{t("actions.stop")}</span>
            <span className="sw-action-label-short">{t("actions.stop")}</span>
          </button>
          <span className="sw-action-status" aria-hidden="true">
            <Loader2 className="sw-spin" size={15} />
            {props.status === "writing" ? (
              <>
                <span className="sw-status-long">
                  {t("actions.writing", { number, words: words(props.liveWords) })}
                </span>
                <span className="sw-status-short">
                  {t("actions.writingShort", { number, words: formatNumber(props.liveWords) })}
                </span>
              </>
            ) : (
              <>
                <span className="sw-status-long">{statusLabel}</span>
                <span className="sw-status-short">{statusLabel}</span>
              </>
            )}
          </span>
          {/* Announced once per operation, not once per streamed word. */}
          <span className="sw-visually-hidden" role="status">
            {statusLabel}
          </span>
        </>
      ) : (
        <>
          <button
            type="button"
            className="sw-action-primary"
            disabled={!props.canWrite}
            aria-label={primaryLabel}
            aria-describedby={props.hasConnection ? undefined : hintId}
            title={props.hasConnection ? primaryLabel : t("actions.noConnection")}
            onClick={props.onWrite}
          >
            <Feather size={17} aria-hidden="true" />
            <span className="sw-action-label-long">{primaryLabel}</span>
            <span className="sw-action-label-short">
              {props.lastChapterDraft ? t("actions.continueShort") : t("actions.writeShort")}
            </span>
          </button>
          {props.hasConnection ? null : (
            <span id={hintId} className="sw-action-hint">
              {t("actions.noConnection")}
            </span>
          )}
          {props.lastChapterDraft ? (
            <button
              type="button"
              className="sw-action-icon"
              disabled={!props.canWrite}
              aria-label={t("actions.finishChapter", { number: props.chapterCount })}
              title={t("actions.finishChapter", { number: props.chapterCount })}
              onClick={props.onFinishChapter}
            >
              <CheckCheck size={19} aria-hidden="true" />
            </button>
          ) : null}
          {props.chapterCount > 0 && !props.lastChapterDraft ? (
            <button
              type="button"
              className="sw-action-icon"
              disabled={!props.canWrite}
              aria-label={t("actions.continueLast")}
              title={t("actions.continueLast")}
              onClick={props.onContinue}
            >
              <StepForward size={19} aria-hidden="true" />
            </button>
          ) : null}
          {props.chapterCount > 0 ? (
            <button
              type="button"
              className="sw-action-icon"
              disabled={!props.canWrite}
              aria-label={t("actions.rewriteLast")}
              title={t("actions.rewriteLast")}
              onClick={props.onRewrite}
            >
              <RotateCcw size={18} aria-hidden="true" />
            </button>
          ) : null}
        </>
      )}
      <span className="sw-action-divider" aria-hidden="true" />
      <button
        type="button"
        className="sw-action-icon"
        aria-label={t("actions.library")}
        title={t("actions.library")}
        onClick={props.onOpenLibrary}
      >
        <Library size={18} aria-hidden="true" />
      </button>
      {fullscreen ? (
        // A toggle keeps one name; aria-pressed says whether it is on, and the tooltip says what a click does.
        <button
          type="button"
          className="sw-action-icon"
          aria-pressed={fullscreen.active}
          aria-label={t("actions.fullscreen")}
          title={fullscreen.active ? fullscreen.exitLabel : fullscreen.enterLabel}
          onClick={() => fullscreen.setActive(!fullscreen.active)}
        >
          {fullscreen.active ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
        </button>
      ) : null}
      <span className="sw-action-divider" aria-hidden="true" />
      <div className="sw-wordcount">
        <span>
          {target
            ? t("actions.wordsOfTarget", { words: words(props.totalWords), target: formatNumber(target) })
            : words(props.totalWords)}
        </span>
        {target ? (
          <span
            className="sw-wordcount-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={t("actions.targetProgress", { percent })}
          >
            <span style={{ width: `${percent}%` }} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The saved quick replies: each one writes like the primary button, sending its instruction instead. */
export function QuickReplyBar(props: {
  replies: QuickReply[];
  canWrite: boolean;
  hasConnection: boolean;
  onSend(request: string): void;
  onEdit(): void;
}) {
  const { t } = useTranslation();
  return (
    <div className="sw-quickbar" role="toolbar" aria-label={t("quickReplies.label")}>
      <div
        className="sw-quickbar-list"
        // The row has no scrollbar: an ordinary mouse wheel scrolls it sideways.
        onWheel={(event) => {
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          // A wheel that counts lines (Firefox) or pages moves the row as far as one that counts pixels.
          const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? event.currentTarget.clientWidth : 1;
          event.currentTarget.scrollLeft += event.deltaY * unit;
        }}
      >
        {props.replies.map((reply) => (
          // The whole label is the button's name; CSS shortens what is shown.
          <button
            key={reply.id}
            type="button"
            className="sw-quick-reply"
            disabled={!props.canWrite}
            title={props.hasConnection ? reply.text : t("actions.noConnection")}
            onClick={() => props.onSend(reply.text)}
          >
            {reply.label || reply.text}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="sw-action-icon"
        aria-label={t("quickReplies.edit")}
        title={t("quickReplies.edit")}
        onClick={props.onEdit}
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
