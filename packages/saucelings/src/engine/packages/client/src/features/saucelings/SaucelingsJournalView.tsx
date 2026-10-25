import type { SaucelingStateResponse } from "../../../../shared/src/features/agents/saucelings/types.js";
import { useSaucelingsTranslation } from "./localization.js";

export function SaucelingsJournalView({ state }: { state: SaucelingStateResponse }) {
  const { t } = useSaucelingsTranslation();
  const pet = state.world.activePet;
  const events = pet?.journal ?? [];

  if (!pet || events.length === 0) {
    return (
      <div className="sl-card" style={{ textAlign: "center", padding: "2rem", opacity: 0.75 }}>
        {t("saucelings.empty.title")}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      {events.map((ev) => (
        <div
          key={ev.id}
          className="sl-card"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}
        >
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.72rem", opacity: 0.7 }}>
              <span style={{ textTransform: "uppercase", fontWeight: 600 }}>{t(`saucelings.event.${ev.kind}`)}</span>
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
          <time style={{ fontSize: "0.72rem", opacity: 0.6, whiteSpace: "nowrap" }}>
            {new Date(ev.createdAt).toLocaleString()}
          </time>
        </div>
      ))}
    </div>
  );
}
