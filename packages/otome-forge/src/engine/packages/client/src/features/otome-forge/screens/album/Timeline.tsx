// ──────────────────────────────────────────────
// Otome Forge: the Love Timeline. Every dated first with each love interest (Snapshots and couple sets among them),
// oldest first, so it reads as the story so far; the pills narrow it to one of them.
// ──────────────────────────────────────────────
import { useId, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { CalendarHeart } from "lucide-react";
import { accentOf } from "../../lib/accent";
import type { LiId, RunView, TimelineEntry } from "../../shared/api-types";
import { useFormatAt } from "./CgViewer";

interface TimelineProps {
  view: RunView;
  entries: TimelineEntry[];
}

export function Timeline({ view, entries }: TimelineProps) {
  const { t } = useTranslation();
  const formatAt = useFormatAt();
  const group = useId();
  const [li, setLi] = useState<LiId | "all">("all");
  const people = view.lis.filter((person) => entries.some((entry) => entry.li === person.id));
  const shown = [...entries]
    .filter((entry) => li === "all" || entry.li === li)
    .sort((a, b) => a.at.localeCompare(b.at));

  if (!entries.length) {
    return (
      <p className="of-empty of-glass">
        <CalendarHeart size={20} strokeWidth={1.8} aria-hidden="true" />
        {t("ui.otomeForge.album.timelineEmpty")}
      </p>
    );
  }
  return (
    <div className="of-album-timeline of-glass">
      {people.length > 1 ? (
        <fieldset className="of-fieldset">
          <legend className="of-visually-hidden">{t("ui.otomeForge.album.timelineWho")}</legend>
          <div className="of-pills of-pills--small">
            {(["all", ...people.map((person) => person.id)] as const).map((value) => (
              <label key={value} className="of-pill" data-checked={li === value}>
                <input
                  type="radio"
                  className="of-visually-hidden"
                  name={group}
                  value={value}
                  checked={li === value}
                  onChange={() => setLi(value)}
                />
                {value === "all"
                  ? t("ui.otomeForge.album.everyone")
                  : (view.lis.find((person) => person.id === value)?.name ?? "")}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <ol className="of-love-line">
        {shown.map((entry, index) => {
          const person = view.lis.find((item) => item.id === entry.li) ?? null;
          return (
            <li
              key={`${entry.at}-${index}`}
              className="of-love-entry"
              style={person ? ({ "--of-li-accent": accentOf(person) } as CSSProperties) : undefined}
            >
              <span className="of-love-dot" aria-hidden="true" />
              <p className="of-love-when">
                <time dateTime={entry.at}>{formatAt(entry.at)}</time>
                {person ? <span className="of-love-who"> · {person.name}</span> : null}
              </p>
              <p className="of-love-text">{entry.text}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
