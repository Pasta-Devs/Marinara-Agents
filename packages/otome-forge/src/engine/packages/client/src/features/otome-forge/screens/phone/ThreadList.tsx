// ──────────────────────────────────────────────
// Otome Forge: the phone's threads, one private thread per love interest in his accent colour, newest first, with
// the last message (or "typing…" while his reply is being written) and how many are unread. Every love interest has
// a row, written to or not.
// ──────────────────────────────────────────────
import { type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Heart, RotateCcw, Smartphone } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { accentOf } from "../../lib/accent";
import { useOtomeProps } from "../../props";
import type { LiId, PhoneListView, PhoneMessage, RunView } from "../../shared/api-types";
import { FACE_LABEL_KEYS } from "../reader/FacePlate";
import { BUSY_POLL_MS, phonePath, phoneQueryKey } from "./PhoneScreen";

/** "14:05" for today, else a short date, in the player's zone. */
export function messageTime(at: string, locale: string, timeZone: string, now = new Date()): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const day = (value: Date) => value.toLocaleDateString("en-CA", { timeZone });
    const sameDay = day(date) === day(now);
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      ...(sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" }),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

interface ThreadListProps {
  runKey: string;
  view: RunView;
  onOpen: (li: LiId) => void;
  rowRef: (li: LiId, element: HTMLButtonElement | null) => void;
}

export function ThreadList({ runKey, view, onOpen, rowRef }: ThreadListProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const { localization, timeZone } = useOtomeProps();
  // Read again whenever the list opens, and while a reply is being written: one that lands after the player left its
  // thread (that page wrote nothing then) moves the preview.
  const threads = useQuery({
    queryKey: phoneQueryKey(runKey),
    queryFn: () => otome.get<PhoneListView>(phonePath(runKey)),
    refetchOnMount: "always",
    refetchInterval: (query) => (query.state.data?.threads.some((thread) => thread.busy) ? BUSY_POLL_MS : false),
  });
  const byLi = new Map((threads.data?.threads ?? []).map((thread) => [thread.li, thread]));
  const order = (id: LiId) => view.lis.findIndex((li) => li.id === id);
  const rows = [...view.lis].sort((a, b) => {
    const last = (id: LiId) => byLi.get(id)?.last?.at ?? "";
    return last(b.id).localeCompare(last(a.id)) || order(a.id) - order(b.id);
  });

  const preview = (name: string, last: PhoneMessage | null | undefined, busy: boolean) => {
    if (busy) return t("ui.otomeForge.phone.typing", { name });
    if (!last) return t("ui.otomeForge.phone.empty");
    const said = last.text.trim()
      ? last.text
      : last.sticker
        ? t("ui.otomeForge.phone.sticker", { face: t(FACE_LABEL_KEYS[last.sticker]) })
        : "";
    return last.who === "player" ? t("ui.otomeForge.phone.youSaid", { text: said }) : said;
  };

  return (
    <div className="of-page of-phone">
      <div className="of-page-head">
        <div className="of-emblem of-glass" aria-hidden="true">
          <Smartphone size={30} strokeWidth={1.6} />
        </div>
        <h1 className="of-title" tabIndex={-1}>
          {t("ui.otomeForge.common.screenPhone")}
        </h1>
        <p className="of-hand">{t("ui.otomeForge.phone.note")}</p>
      </div>
      {threads.isError && !threads.data ? (
        <div className="of-panel of-panel--center of-card of-glass" role="alert">
          <p className="of-error">{otome.errorMessage(threads.error, "ui.otomeForge.phone.loadFailed")}</p>
          <button type="button" className="of-button of-button--quiet of-glass" onClick={() => void threads.refetch()}>
            <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.common.retry")}
          </button>
        </div>
      ) : threads.isPending ? (
        <div className="of-center" role="status">
          <Heart className="of-pulse" size={26} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
          <p className="of-body">{t("ui.otomeForge.phone.loading")}</p>
        </div>
      ) : (
        <ul className="of-threads">
          {rows.map((li) => {
            const thread = byLi.get(li.id);
            const unread = thread?.unread ?? 0;
            const accent = accentOf(li);
            return (
              <li key={li.id}>
                <button
                  ref={(element) => rowRef(li.id, element)}
                  type="button"
                  className="of-thread-row of-glass"
                  data-unread={unread > 0 ? "true" : undefined}
                  style={{ "--of-li-accent": accent } as CSSProperties}
                  onClick={() => onOpen(li.id)}
                >
                  <Avatar name={li.name} url={li.portrait} accent={accent} size={48} />
                  <span className="of-thread-text">
                    <span className="of-thread-name">{li.name}</span>
                    <span className="of-thread-last">{preview(li.name, thread?.last, !!thread?.busy)}</span>
                  </span>
                  <span className="of-thread-meta">
                    {thread?.last ? (
                      <time className="of-thread-time" dateTime={thread.last.at}>
                        {messageTime(thread.last.at, localization.locale, timeZone)}
                      </time>
                    ) : null}
                    {unread > 0 ? (
                      <span className="of-home-badge">
                        <span aria-hidden="true">{unread}</span>
                        <span className="of-visually-hidden">{t("ui.otomeForge.phone.unread", { count: unread })}</span>
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
