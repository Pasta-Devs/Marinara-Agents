// ──────────────────────────────────────────────
// Otome Forge: the backlog. Every line read since the chapter opened, newest last, each speaker in their colour and
// thoughts in italics. A star keeps a line as a favourite (it goes to the Album's favourite lines).
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { Dialog } from "../../components/Dialog";
import type { LogEntry } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import { voiceOf } from "../../lib/reader-state";
import type { LiId, RunLiView } from "../../shared/api-types";

interface BacklogProps {
  entries: LogEntry[];
  lis: RunLiView[];
  protagonist: string;
  starred: ReadonlySet<string>;
  onStar: (entry: LogEntry, text: string, li: LiId | null) => Promise<void>;
  onClose: () => void;
}

export function Backlog({ entries, lis, protagonist, starred, onStar, onClose }: BacklogProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Opens on the newest line, once the dialog has laid out.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const star = async (entry: LogEntry, text: string, li: LiId | null) => {
    if (busy) return;
    setBusy(entry.key);
    setError(null);
    try {
      await onStar(entry, text, li);
    } catch {
      setError(t("ui.otomeForge.reader.favoriteFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      wide
      title={t("ui.otomeForge.reader.backlog")}
      onClose={onClose}
      initialFocus={closeRef}
      actions={
        <button ref={closeRef} type="button" className="of-button of-button--quiet of-glass" onClick={onClose}>
          {t("ui.otomeForge.reader.backlogClose")}
        </button>
      }
    >
      {entries.length ? (
        <ol ref={listRef} className="of-log" tabIndex={0} aria-label={t("ui.otomeForge.reader.backlog")}>
          {entries.map((entry) => {
            const { line } = entry;
            const aftermath = line.kind === "aftermath";
            const text = aftermath ? t("ui.otomeForge.reader.aftermath") : line.segment.text;
            const voice = voiceOf(line.segment, lis, protagonist);
            const thought = voice.kind !== "narration" && voice.thought;
            const who =
              voice.kind === "li"
                ? voice.li.name
                : voice.kind === "protagonist"
                  ? thought
                    ? t("ui.otomeForge.reader.yourThought")
                    : protagonist
                  : voice.kind === "other"
                    ? voice.name
                    : "";
            const li = voice.kind === "li" ? voice.li : null;
            const kept = starred.has(entry.ref);
            return (
              <li
                key={entry.key}
                className="of-log-line"
                data-voice={voice.kind}
                data-thought={thought}
                style={li ? ({ "--of-li-accent": accentOf(li) } as CSSProperties) : undefined}
              >
                <div className="of-log-text">
                  {who ? (
                    <span className="of-log-who">
                      {who}
                      {li && thought ? ` · ${t("ui.otomeForge.reader.thinking")}` : ""}
                    </span>
                  ) : null}
                  <span className="of-log-said">{text}</span>
                </div>
                {aftermath ? null : (
                  <button
                    type="button"
                    className="of-icon-button of-log-star"
                    aria-pressed={kept}
                    aria-disabled={busy !== null}
                    aria-label={t("ui.otomeForge.reader.favorite")}
                    title={kept ? t("ui.otomeForge.reader.favoriteKept") : t("ui.otomeForge.reader.favorite")}
                    onClick={() => void star(entry, text, li?.id ?? null)}
                  >
                    <Star size={16} strokeWidth={2} fill={kept ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="of-hint">{t("ui.otomeForge.reader.backlogEmpty")}</p>
      )}
      <div className="of-live" role="alert">
        {error ? <p className="of-notice of-notice--error">{error}</p> : null}
      </div>
    </Dialog>
  );
}
