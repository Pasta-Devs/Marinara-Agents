// ──────────────────────────────────────────────
// Big Cheese: the relationship map (modules.md section 4, ui.md section 10)
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRelations, type MapRelation } from "./api";
import { circleLayout, MAP_SIZE } from "./mapLayout";
import { initials, nameOf, tint, type Ctx } from "./parts";

/**
 * People on a circle, with a line for each relation the boss knows. Secrets the boss knows are
 * faint dashes. The server sends only known relations (place.ts), so a hidden one is never drawn.
 * Each line is also a button in the list below, so the map works with a keyboard and a screen reader.
 */
export function RelationMap({ ctx, ids, story }: { ctx: Ctx; ids: string[]; story: (r: MapRelation) => string }) {
  const { t } = useTranslation();
  const { run, kit } = ctx;
  const [lines, setLines] = useState<MapRelation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  // Each action makes a new revision, and an overheard line can add a relation.
  useEffect(() => {
    getRelations(run.id)
      .then((d) => {
        setLines(d.relations);
        setChosen(null); // the order can change between revisions
      })
      .catch(() => setFailed(true));
  }, [run.id, run.revision]);

  if (failed) return <p>{t("ui.bigCheese.map.error")}</p>;
  if (!lines) return <p aria-busy="true">{t("ui.bigCheese.map.loading")}</p>;

  const at = circleLayout(ids);
  const shown = lines.filter((r) => at[r.a] && at[r.b]);
  if (shown.length === 0) return <p>{t("ui.bigCheese.map.empty")}</p>;
  const pick = chosen !== null && shown[chosen] ? shown[chosen] : null;

  return (
    <section aria-label={t("ui.bigCheese.map.title")}>
      <svg
        viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
        className="bc-map"
        role="img"
        aria-label={t("ui.bigCheese.map.title")}
      >
        {shown.map((r, n) => (
          <g key={n} onClick={() => setChosen(n)}>
            <line
              x1={at[r.a].x}
              y1={at[r.a].y}
              x2={at[r.b].x}
              y2={at[r.b].y}
              className={`bc-map-line${r.secret ? " bc-map-secret" : ""}${chosen === n ? " bc-map-on" : ""}`}
            />
            {/* A wide invisible line, so a finger can hit it. */}
            <line x1={at[r.a].x} y1={at[r.a].y} x2={at[r.b].x} y2={at[r.b].y} className="bc-map-hit" />
          </g>
        ))}
        {ids.map((id) => (
          <g key={id} style={tint(kit.people.find((p) => p.id === id)?.hue)} aria-hidden="true">
            <circle cx={at[id].x} cy={at[id].y} r={22} className="bc-map-dot" />
            <text x={at[id].x} y={at[id].y + 5} textAnchor="middle" className="bc-map-text">
              {initials(nameOf(kit, id))}
            </text>
            <text x={at[id].x} y={at[id].y + 42} textAnchor="middle" className="bc-map-name">
              {nameOf(kit, id).split(" ")[0]}
            </text>
          </g>
        ))}
      </svg>
      <p role="status" className="bc-quote">
        {pick ? story(pick) : t("ui.bigCheese.map.hint")}
      </p>
      <ul className="bc-plain">
        {shown.map((r, n) => (
          <li key={n}>
            <button
              type="button"
              className="bc-btn bc-btn-quiet"
              aria-pressed={chosen === n}
              onClick={() => setChosen(n)}
            >
              {story(r)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
