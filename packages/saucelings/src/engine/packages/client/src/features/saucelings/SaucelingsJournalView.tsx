import { useEffect, useState } from "react";
import type {
  SaucelingEvent,
  SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { useSaucelingsTranslation } from "./localization.js";

// ponytail: the newest entry this browser has shown, kept per browser rather than per Engine, so another browser
// counts everything as new once. A seen-time field in the world save is the upgrade.
const JOURNAL_SEEN_KEY = "saucelings-journal-seen";

function readJournalSeen(): string | null {
  try {
    return localStorage.getItem(JOURNAL_SEEN_KEY);
  } catch {
    return null;
  }
}

/** The events under one heading per local day, keeping the journal's newest-first order. */
function byDay(events: SaucelingEvent[]) {
  const days: { key: string; at: Date; events: SaucelingEvent[] }[] = [];
  for (const ev of events) {
    const at = new Date(ev.createdAt);
    const key = at.toDateString();
    const last = days[days.length - 1];
    if (last?.key === key) last.events.push(ev);
    else days.push({ key, at, events: [ev] });
  }
  return days;
}

export function SaucelingsJournalView({
  state,
  onOpenNook,
}: {
  state: SaucelingStateResponse;
  onOpenNook: () => void;
}) {
  const { t } = useSaucelingsTranslation();
  const pet = state.world.activePet;
  const events = pet?.journal ?? [];
  const newest = events[0]?.createdAt ?? null;
  // Read once on opening, so the note holds while the Journal is on screen and clears the next time.
  const [seenBefore] = useState(readJournalSeen);
  useEffect(() => {
    if (!newest) return;
    try {
      localStorage.setItem(JOURNAL_SEEN_KEY, newest);
    } catch {
      // Storage can be blocked; the note then just counts everything as new.
    }
  }, [newest]);
  const unread = seenBefore ? events.filter((ev) => ev.createdAt > seenBefore).length : 0;

  if (!pet || events.length === 0) {
    return (
      <div className="sl-card" style={{ display: "grid", gap: "0.75rem", justifyItems: "center", padding: "2rem" }}>
        <span style={{ opacity: 0.75 }}>
          {pet ? t("saucelings.journal.empty", { name: pet.name }) : t("saucelings.empty.title")}
        </span>
        {pet ? null : (
          <button type="button" className="sl-btn" onClick={onOpenNook}>
            {t("saucelings.journal.toNook")}
          </button>
        )}
      </div>
    );
  }

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      {unread > 0 ? (
        <p role="status" style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600 }}>
          {t("saucelings.journal.new", { count: unread })}
        </p>
      ) : null}
      {byDay(events).map((day) => (
        <section key={day.key} style={{ display: "grid", gap: "0.65rem" }}>
          <h3 style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", fontWeight: 600, opacity: 0.75 }}>
            {day.key === today
              ? t("saucelings.journal.today")
              : day.key === yesterday
                ? t("saucelings.journal.yesterday")
                : day.at.toLocaleDateString()}
          </h3>
          {day.events.map((ev) => (
            <div
              key={ev.id}
              className="sl-card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}
            >
              <div style={{ display: "grid", gap: "0.25rem" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.72rem", opacity: 0.7 }}
                >
                  <span style={{ textTransform: "uppercase", fontWeight: 600 }}>
                    {t(`saucelings.event.${ev.kind}`)}
                  </span>
                  {/* Lines the writing connection wrote are marked, so the player can tell them from built-in ones. */}
                  {ev.generated ? (
                    <span className="sl-pill sl-pill--ai">{t("saucelings.journal.generated")}</span>
                  ) : null}
                </div>
                <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.45 }}>
                  {ev.speaker ? <strong>{t("saucelings.journal.speaker", { name: ev.speaker })}</strong> : null}
                  {ev.speaker ? " " : null}
                  {ev.text}
                </p>
              </div>
              <time
                dateTime={ev.createdAt}
                title={new Date(ev.createdAt).toLocaleString()}
                style={{ fontSize: "0.72rem", opacity: 0.6, whiteSpace: "nowrap" }}
              >
                {new Date(ev.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </time>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
