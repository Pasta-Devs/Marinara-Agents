// ──────────────────────────────────────────────
// Big Cheese M4 T13: eyes and ears (modules.md §4)
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { nameOf, type Ctx } from "./parts";

/** "Ask to keep an eye on...": one informant on a room or group, 1 hour. */
export function EyesAsk({ ctx, id }: { ctx: Ctx; id: string }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const places = [
    ...kit.rooms.map((r) => ({ key: `room:${r.id}`, name: r.name })),
    ...(kit.groups ?? []).map((g) => ({ key: `group:${g.id}`, name: g.name })),
  ];
  const [pick, setPick] = useState(places[0]?.key ?? "");
  const mine = run.game.informants?.find((i) => i.person === id);
  const label = (key: string) => places.find((p) => p.key === key)?.name ?? key;
  if (run.game.people[id]?.status !== "active" || places.length === 0) return null;
  return (
    <section className="bc-section" aria-labelledby="bc-eyes-ask">
      <h2 id="bc-eyes-ask" className="bc-subhead">
        {t("ui.bigCheese.eyes.title")}
      </h2>
      {mine && (
        <p className="bc-row-meta">
          {t("ui.bigCheese.eyes.watching", { place: label(`${mine.kind}:${mine.target}`) })}{" "}
          {t(mine.paid ? "ui.bigCheese.eyes.paid" : "ui.bigCheese.eyes.free")}
        </p>
      )}
      <select aria-label={t("ui.bigCheese.eyes.place")} value={pick} onChange={(e) => setPick(e.target.value)}>
        {places.map((p) => (
          <option key={p.key} value={p.key}>
            {p.name}
          </option>
        ))}
      </select>{" "}
      <button
        type="button"
        className="bc-btn"
        disabled={busy || !pick}
        onClick={() => {
          const [kind, target] = [pick.slice(0, pick.indexOf(":")), pick.slice(pick.indexOf(":") + 1)];
          void act("informant", { person: id, target, kind });
        }}
      >
        {t("ui.bigCheese.eyes.ask")}
      </button>
    </section>
  );
}

/** What the informants and rumours reported, newest last. */
export function EyesHeard({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const eyes = (ctx.run.game.eyes ?? []).slice(-4);
  if (eyes.length === 0) return null;
  return (
    <section className="bc-section" aria-labelledby="bc-eyes-heard">
      <h2 id="bc-eyes-heard" className="bc-subhead">
        {t("ui.bigCheese.eyes.heard")}
      </h2>
      <ul className="bc-plain">
        {eyes.map((e, i) => (
          <li key={i}>{t("ui.bigCheese.eyes.line", { week: e.week, text: e.text })}</li>
        ))}
      </ul>
    </section>
  );
}

/** "Plant a rumour": who tells it, who it is about, and the line, 1 hour. */
export function PlantRumour({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { kit, run, busy, act } = ctx;
  const people = kit.people.filter((p) => run.game.people[p.id]?.status === "active");
  const [open, setOpen] = useState(false);
  const [starter, setStarter] = useState(people[0]?.id ?? "");
  const [target, setTarget] = useState(people[1]?.id ?? "");
  const [line, setLine] = useState("");
  if (people.length < 2) return null;
  if (!open) {
    return (
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setOpen(true)}>
        {t("ui.bigCheese.eyes.plant")}
      </button>
    );
  }
  const who = (value: string, set: (v: string) => void, label: string) => (
    <label className="bc-muted">
      {label}{" "}
      <select value={value} onChange={(e) => set(e.target.value)}>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {nameOf(kit, p.id)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="bc-section" aria-label={t("ui.bigCheese.eyes.plant")}>
      {who(starter, setStarter, t("ui.bigCheese.eyes.starter"))} {who(target, setTarget, t("ui.bigCheese.eyes.about"))}
      <label className="bc-muted">
        {t("ui.bigCheese.eyes.rumour")} <input value={line} maxLength={160} onChange={(e) => setLine(e.target.value)} />
      </label>{" "}
      <button
        type="button"
        className="bc-btn"
        disabled={busy || !line.trim() || starter === target}
        onClick={() => void act("rumour", { starter, target, line }).then((ok) => ok && (setLine(""), setOpen(false)))}
      >
        {t("ui.bigCheese.eyes.send")}
      </button>
    </section>
  );
}
