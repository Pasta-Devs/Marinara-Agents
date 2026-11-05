// Big Cheese: out of the office (modules.md section 4). The evening invitation sits in the Office,
// the walk and the trip in the Place screen. The server (outside.ts) holds every rule.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getOutside, type OutsideState } from "./api";
import { nameOf, type Ctx } from "./parts";

/** The state from the server; it reloads when the run changes. */
function useOutside(ctx: Ctx) {
  const [data, setData] = useState<OutsideState | null>(null);
  useEffect(() => {
    getOutside(ctx.run.id)
      .then(setData)
      .catch(() => setData(null));
  }, [ctx.run.id, ctx.run.revision]);
  return data;
}

/** An evening invitation. Declining happens inside the scene and costs nothing. */
export function Invitation({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const inv = useOutside(ctx)?.invitation;
  if (!inv) return null;
  return (
    <section className="bc-section" aria-labelledby="bc-invitation">
      <h2 id="bc-invitation" className="bc-subhead">
        {t("ui.bigCheese.outside.invitation")}
      </h2>
      <p className="bc-muted">
        {t("ui.bigCheese.outside.invitationText", {
          host: nameOf(kit, inv.host),
          names: inv.people.map((id) => nameOf(kit, id)).join(", "),
        })}
      </p>
      <button
        type="button"
        className="bc-btn"
        disabled={busy || !!run.scene}
        onClick={() => void act("after-work", {})}
      >
        {t("ui.bigCheese.outside.invitationOpen")}
      </button>
    </section>
  );
}

/** A walk with one person who is in the room now. */
export function Walk({ ctx, room, here }: { ctx: Ctx; room: string; here: string[] }) {
  const { t } = useTranslation();
  const { kit, busy, act, run } = ctx;
  return (
    <>
      {here.map((id) => (
        <button
          key={id}
          type="button"
          className="bc-btn"
          disabled={busy || run.game.clock.hoursLeft < 1}
          onClick={() => void act("walk", { room, person: id })}
        >
          {t("ui.bigCheese.outside.walk", { name: nameOf(kit, id) })}
        </button>
      ))}
    </>
  );
}

/** Plan a trip: one outside room and up to 4 people, 2 hours, once a week. */
export function Trip({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const data = useOutside(ctx);
  const [room, setRoom] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  if (!data?.tripRooms.length) return null;
  const toggle = (id: string) =>
    setPeople((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length < 4 ? [...l, id] : l));
  const cur = room || data.tripRooms[0]!.id;
  return (
    <section className="bc-section" aria-labelledby="bc-trip">
      <h2 id="bc-trip" className="bc-subhead">
        {t("ui.bigCheese.outside.trip")}
      </h2>
      <p className="bc-muted">{t("ui.bigCheese.outside.tripHelp")}</p>
      <div role="group" aria-label={t("ui.bigCheese.outside.tripWhere")} className="bc-modes">
        {data.tripRooms.map((r) => (
          <button
            key={r.id}
            type="button"
            className="bc-btn bc-btn-quiet"
            aria-pressed={cur === r.id}
            onClick={() => setRoom(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>
      <div role="group" aria-label={t("ui.bigCheese.outside.tripWho")} className="bc-modes">
        {Object.keys(run.game.people).map((id) => (
          <button
            key={id}
            type="button"
            className="bc-btn bc-btn-quiet"
            aria-pressed={people.includes(id)}
            onClick={() => toggle(id)}
          >
            {nameOf(kit, id)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="bc-btn bc-btn-primary"
        disabled={busy || !people.length || data.tripUsed || run.game.clock.hoursLeft < 2}
        onClick={() => void act("trip", { room: cur, people })}
      >
        {t("ui.bigCheese.outside.tripGo")}
      </button>
      {data.tripUsed && <p className="bc-muted">{t("ui.bigCheese.outside.tripUsed")}</p>}
    </section>
  );
}
