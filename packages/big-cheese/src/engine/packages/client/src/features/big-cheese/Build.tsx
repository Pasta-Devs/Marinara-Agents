// ──────────────────────────────────────────────
// Big Cheese M4 T16: detailed building. Orders for work on one room (`room` set),
// or the open orders, the rooms you built and the new room form (no `room`).
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBuilding, type BuildingState, type Meter } from "./api";
import type { Ctx } from "./parts";

const METER_ORDER: Meter[] = ["money", "output", "people", "standing"];
type Kind = "upgrade" | "decor" | "new";
// Literal keys, so the locale validator finds each one.
const KIND_KEYS = {
  upgrade: "ui.bigCheese.building.kind.upgrade",
  decor: "ui.bigCheese.building.kind.decor",
  new: "ui.bigCheese.building.kind.new",
} as const;

export function Build({ ctx, room }: { ctx: Ctx; room?: string }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const [data, setData] = useState<BuildingState | null>(null);
  const [name, setName] = useState("");
  const [feeds, setFeeds] = useState<Meter | null>(null);
  const on = !!run.game.depth?.building;

  // Each order changes the run, so the rooms reload with the new revision.
  useEffect(() => {
    if (on)
      getBuilding(run.id)
        .then(setData)
        .catch(() => setData(null));
  }, [on, run.id, run.revision]);
  if (!on || !data) return null;

  const roomName = (id: string) =>
    kit.rooms.find((r) => r.id === id)?.name ?? data.rooms.find((r) => r.id === id)?.name ?? id;
  const full = data.open.length >= data.maxOpen;
  const price = (k: Kind) => data.prices[k] ?? 0;
  const afford = (k: Kind) => data.money >= price(k);
  const order = (kind: Kind, body: object = {}) => act("build", { kind, ...body });
  const cost = (k: Kind) => t("ui.bigCheese.building.cost", { price: price(k), weeks: data.weeks[k] });

  if (room) {
    const r = data.rooms.find((x) => x.id === room);
    if (!r) return null;
    return (
      <section className="bc-section" aria-labelledby="bc-build-room">
        <h2 id="bc-build-room" className="bc-subhead">
          {t("ui.bigCheese.building.title")}
        </h2>
        <p className="bc-muted">{t("ui.bigCheese.building.cond", { n: r.condition, cap: r.cap })}</p>
        <ul className="bc-list">
          <li className="bc-panel">
            <p className="bc-row-title">{t("ui.bigCheese.building.upgrade")}</p>
            <p className="bc-row-meta">
              {t("ui.bigCheese.building.upgradeHelp")}{" "}
              {t("ui.bigCheese.building.upgrades", { n: r.upgrades, max: data.maxUpgrades })}
            </p>
            <button
              type="button"
              className="bc-btn"
              disabled={busy || full || r.upgrades >= data.maxUpgrades || !afford("upgrade")}
              onClick={() => void order("upgrade", { room })}
            >
              {cost("upgrade")}
            </button>
          </li>
          <li className="bc-panel">
            <p className="bc-row-title">{t("ui.bigCheese.building.decor")}</p>
            <p className="bc-row-meta">
              {t(r.decor ? "ui.bigCheese.building.decorIn" : "ui.bigCheese.building.decorHelp")}
            </p>
            <button
              type="button"
              className="bc-btn"
              disabled={busy || full || r.decor || !afford("decor")}
              onClick={() => void order("decor", { room })}
            >
              {cost("decor")}
            </button>
          </li>
        </ul>
        {full && <p className="bc-muted">{t("ui.bigCheese.building.full")}</p>}
      </section>
    );
  }

  const built = data.rooms.filter((r) => r.name);
  return (
    <section className="bc-section" aria-labelledby="bc-build-all">
      <h2 id="bc-build-all" className="bc-subhead">
        {t("ui.bigCheese.building.title")}
      </h2>
      {data.open.length === 0 && <p className="bc-muted">{t("ui.bigCheese.building.none")}</p>}
      <ul className="bc-plain">
        {data.open.map((o) => (
          <li key={`${o.kind}-${o.room}`} className="bc-row-text">
            {t("ui.bigCheese.building.order", {
              what: t(KIND_KEYS[o.kind]),
              room: roomName(o.room),
              week: o.doneWeek,
            })}
          </li>
        ))}
      </ul>
      {built.length > 0 && (
        <>
          <h3 className="bc-subhead">{t("ui.bigCheese.building.built")}</h3>
          <ul className="bc-plain">
            {built.map((r) => (
              <li key={r.id} className="bc-row-text">
                {t("ui.bigCheese.building.builtRoom", { name: r.name, n: r.condition })}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="bc-form">
        <label htmlFor="bc-build-name">{t("ui.bigCheese.building.newName")}</label>
        <input
          id="bc-build-name"
          maxLength={40}
          value={name}
          style={{ minHeight: 44 }}
          onChange={(e) => setName(e.target.value)}
        />
        <div role="group" aria-label={t("ui.bigCheese.building.newFeeds")}>
          <span>{t("ui.bigCheese.building.newFeeds")}</span>
          <div className="bc-cards">
            {METER_ORDER.map((m) => (
              <button key={m} type="button" className="bc-btn" aria-pressed={feeds === m} onClick={() => setFeeds(m)}>
                {kit.meters[m]?.label ?? m}
              </button>
            ))}
          </div>
        </div>
        <p className="bc-muted">{t("ui.bigCheese.building.newHelp")}</p>
        <button
          type="button"
          className="bc-btn bc-btn-primary"
          disabled={busy || full || !name.trim() || !feeds || !afford("new")}
          onClick={() => void order("new", { name, feeds }).then((ok) => ok && (setName(""), setFeeds(null)))}
        >
          {t("ui.bigCheese.building.newOrder")}: {cost("new")}
        </button>
      </div>
    </section>
  );
}
