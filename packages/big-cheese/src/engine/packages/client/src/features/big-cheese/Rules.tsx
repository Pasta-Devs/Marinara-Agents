// ──────────────────────────────────────────────
// Big Cheese: the rules sheet (design.md section 16, content.md section 11)
// ──────────────────────────────────────────────
// A rule changes for 1 hour. What happens next depends on the tier: a proposal waits for the next
// meeting, a rule is set at once, a decree is set at once and costs Fear, Love or Legitimacy.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRules, type RulesState } from "./api";
import type { Ctx } from "./parts";

const NOTE_KEYS: Record<string, string> = {
  manager: "ui.bigCheese.rules.noteManager",
  strong_leader: "ui.bigCheese.rules.noteStrong",
  absolute: "ui.bigCheese.rules.noteAbsolute",
};

export function Rules({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, busy, act, go } = ctx;
  const [data, setData] = useState<RulesState | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    getRules(run.id)
      .then(setData)
      .catch(() => setFailed(true));
  }, [run.id]);
  // Each action changes the run, so the list reloads with the new revision.
  useEffect(load, [load, run.revision]);

  const noHours = run.game.clock.hoursLeft === 0;
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.rules.title")}
      </h1>
      {failed && <p role="alert">{t("ui.bigCheese.rules.error")}</p>}
      {data && (
        <>
          <p className="bc-muted">{t(NOTE_KEYS[data.authority] ?? NOTE_KEYS.manager!)}</p>
          {data.authority === "absolute" && (
            <p className="bc-row-meta">
              <span className="bc-chip">{t("ui.bigCheese.rules.fear", { n: data.power.fear })}</span>
              <span className="bc-chip">{t("ui.bigCheese.rules.love", { n: data.power.love })}</span>
              {data.legitimacy !== null && (
                <span className="bc-chip">{t("ui.bigCheese.rules.legitimacy", { n: data.legitimacy })}</span>
              )}
              {!data.enforcer && <span className="bc-chip bc-chip-warn">{t("ui.bigCheese.rules.noEnforcer")}</span>}
            </p>
          )}
          {data.rules.length === 0 && <p className="bc-empty">{t("ui.bigCheese.rules.none")}</p>}
          <ul className="bc-list">
            {data.rules.map((rule) => (
              <li key={rule.id} className="bc-panel">
                <p className="bc-row-title">{rule.text}</p>
                <div className="bc-row-meta" role="group" aria-label={rule.text}>
                  {rule.options.map((option) => {
                    const proposed = data.proposals.includes(`rule:${rule.id}:${option}`);
                    return (
                      <button
                        key={option}
                        type="button"
                        className="bc-btn"
                        aria-pressed={rule.current === option}
                        disabled={busy || noHours || rule.current === option || proposed}
                        onClick={() => void act("rule", { rule: rule.id, option })}
                      >
                        {option}
                        {proposed && ` · ${t("ui.bigCheese.rules.proposed")}`}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <p className="bc-muted">{t("ui.bigCheese.rules.hour")}</p>
        </>
      )}
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => go("office")}>
        {t("ui.bigCheese.rules.back")}
      </button>
    </>
  );
}
