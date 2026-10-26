import type {
  SaucelingEvent,
  SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { useSaucelingsTranslation } from "./localization.js";

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

  if (!pet || events.length === 0) {
    return (
      <div className="sl-card" style={{ display: "grid", gap: "0.75rem", justifyItems: "center", padding: "2rem" }}>
        <span style={{ opacity: 0.75 }}>{t("saucelings.empty.title")}</span>
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
                    <span
                      style={{
                        padding: "0.05rem 0.4rem",
                        borderRadius: "999px",
                        background: "rgba(169,120,232,0.2)",
                        color: "#d8b4fe",
                      }}
                    >
                      {t("saucelings.journal.generated")}
                    </span>
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
