// ──────────────────────────────────────────────
// Big Cheese: the model call log (design.md route table, ui.md settings "AI")
// ──────────────────────────────────────────────
// Task name, what happened and how long it took. It never holds prompt text or model output.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getCalls, type CallEntry } from "./api";

export function Calls({ id }: { id: string }) {
  const { t } = useTranslation();
  const [calls, setCalls] = useState<CallEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  // The log loads when the player opens it, so a closed log costs nothing.
  const load = () =>
    getCalls(id)
      .then((r) => setCalls(r.calls))
      .catch(() => setFailed(true));

  return (
    <details onToggle={(e) => e.currentTarget.open && void load()}>
      <summary>{t("ui.bigCheese.calls.title")}</summary>
      {failed && <p role="alert">{t("ui.bigCheese.calls.error")}</p>}
      {calls && !calls.length && <p className="bc-muted">{t("ui.bigCheese.calls.empty")}</p>}
      {calls && calls.length > 0 && (
        <ul className="bc-plain">
          {calls.map((c, i) => (
            <li key={i}>
              {c.task}: {outcome(t, c.outcome)}, {c.ms} ms
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

// Each key is a literal, so the locale validator finds it.
const outcome = (t: (k: string) => string, o: CallEntry["outcome"]) =>
  o === "ok"
    ? t("ui.bigCheese.calls.ok")
    : o === "retry"
      ? t("ui.bigCheese.calls.retry")
      : o === "refusal"
        ? t("ui.bigCheese.calls.refusal")
        : t("ui.bigCheese.calls.lite");
