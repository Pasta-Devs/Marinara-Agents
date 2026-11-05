// ──────────────────────────────────────────────
// Big Cheese M4 T11: delegation (modules.md section 4)
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Ctx } from "./parts";

/** On a person's file: give them an area (1 hour) and take back what they hold. */
export function DelegateArea({ ctx, id }: { ctx: Ctx; id: string }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const areas = [
    ...Object.keys(kit.meters).map((m) => ({ key: m, name: kit.meters[m as keyof typeof kit.meters]?.label ?? m })),
    ...kit.rooms.map((r) => ({ key: r.id, name: r.name })),
    ...(kit.groups ?? []).map((g) => ({ key: g.id, name: g.name })),
  ];
  const [pick, setPick] = useState(areas[0]?.key ?? "");
  const name = (key: string) => areas.find((a) => a.key === key)?.name ?? key;
  const held = Object.entries(run.game.delegated ?? {})
    .filter(([, who]) => who === id)
    .map(([key]) => key);
  if (run.game.people[id]?.status !== "active") return null;
  return (
    <section className="bc-section" aria-labelledby="bc-delegate">
      <h2 id="bc-delegate" className="bc-subhead">
        {t("ui.bigCheese.delegate.title")}
      </h2>
      {held.length > 0 && (
        <p className="bc-row-meta">{t("ui.bigCheese.delegate.holds", { areas: held.map(name).join(", ") })}</p>
      )}
      <select aria-label={t("ui.bigCheese.delegate.area")} value={pick} onChange={(e) => setPick(e.target.value)}>
        {areas.map((a) => (
          <option key={a.key} value={a.key}>
            {a.name}
          </option>
        ))}
      </select>{" "}
      <button
        type="button"
        className="bc-btn"
        disabled={busy || !pick}
        onClick={() => void act("delegate", { area: pick, person: id })}
      >
        {t("ui.bigCheese.delegate.give")}
      </button>
      {held.map((key) => (
        <button
          key={key}
          type="button"
          className="bc-btn"
          disabled={busy}
          onClick={() => void act("delegate/back", { area: key })}
        >
          {t("ui.bigCheese.delegate.back", { area: name(key) })}
        </button>
      ))}
    </section>
  );
}
