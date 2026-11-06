// ──────────────────────────────────────────────
// Big Cheese: Place, the rooms and the grapevine (ui.md §5.11)
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Face, nameOf, type Ctx } from "./parts";
import { Ticker } from "./Ticker";
import { Adult } from "./Adult";
import { Build } from "./Build"; // M4 T16
import { Culture } from "./Culture";
import { Trip, Walk } from "./Outside";

// A room's condition shows as a word, never a number.
const STATES = [
  "ui.bigCheese.place.state.poor",
  "ui.bigCheese.place.state.worn",
  "ui.bigCheese.place.state.fair",
  "ui.bigCheese.place.state.good",
];
const stateKey = (condition: number) => STATES[condition < 30 ? 0 : condition < 50 ? 1 : condition < 70 ? 2 : 3];

export function Place({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, act, busy } = ctx;
  const { clock } = run.game;
  const [tab, setTab] = useState<"rooms" | "grapevine">("rooms");
  const [roomId, setRoomId] = useState<string | null>(null);

  // The server writes the morning lines once a day and the rumours once in the evening (place.ts).
  const day = (clock.week - 1) * 5 + clock.day;
  const place = run.text.place;
  const stale = !place || place.day !== day || (clock.hoursLeft <= 2 && place.evening !== day);
  useEffect(() => {
    if (stale) void act("rooms/refresh");
    // `act` changes on every render, so only a new day or slot starts a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, day]);

  const open = kit.rooms.find((room) => room.id === roomId);
  const peopleIn = (id: string) => run.game.rooms[id]?.people ?? [];

  if (open) {
    const here = peopleIn(open.id);
    const line = place?.morning.find((entry) => entry.room === open.id);
    const heard = place?.visit?.room === open.id ? place.visit.lines : [];
    return (
      <>
        <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setRoomId(null)}>
          {t("ui.bigCheese.place.back")}
        </button>
        <h1 className="bc-heading" tabIndex={-1} data-focus>
          {open.name}
        </h1>
        <p className="bc-muted">{open.text}</p>
        <p className="bc-row-meta">
          <span className="bc-chip">
            {t("ui.bigCheese.place.condition", { state: t(stateKey(run.game.rooms[open.id]?.condition ?? 50)) })}
          </span>
        </p>
        {here.length === 0 ? (
          <p>{t("ui.bigCheese.place.nobody", { room: open.name })}</p>
        ) : (
          <ul className="bc-plain">
            {here.map((id) => (
              <li key={id} className="bc-row bc-row-flat">
                <Face kit={kit} id={id} />
                <span className="bc-row-title">{nameOf(kit, id)}</span>
              </li>
            ))}
          </ul>
        )}
        {line && (
          <blockquote className="bc-quote">
            {nameOf(kit, line.person)}: {line.text}
          </blockquote>
        )}
        <button
          type="button"
          className="bc-btn bc-btn-primary"
          disabled={busy || clock.hoursLeft < 1 || here.length === 0}
          onClick={() => void act(`rooms/${open.id}/visit`)}
        >
          {t("ui.bigCheese.place.visit", { count: 1 })}
        </button>
        <Walk ctx={ctx} room={open.id} here={here} />
        <Build ctx={ctx} room={open.id} />
        {heard.length > 0 && (
          <section className="bc-section" aria-labelledby="bc-overheard">
            <h2 id="bc-overheard" className="bc-subhead">
              {t("ui.bigCheese.place.overheard")}
            </h2>
            <ul className="bc-plain">
              {heard.map((entry, index) => (
                <li key={index}>
                  {nameOf(kit, entry.person)}: {entry.text}
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  const rumours = [...run.game.grapevine].reverse().filter((id) => place?.grapevine[id]);
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.place.title")}
      </h1>
      <Ticker ctx={ctx} />
      <p className="bc-row-meta">
        <button type="button" className="bc-btn" aria-pressed={tab === "rooms"} onClick={() => setTab("rooms")}>
          {t("ui.bigCheese.place.rooms")}
        </button>
        <button type="button" className="bc-btn" aria-pressed={tab === "grapevine"} onClick={() => setTab("grapevine")}>
          {t("ui.bigCheese.place.grapevine")}
        </button>
      </p>
      {tab === "rooms" ? (
        <ul className="bc-list">
          {kit.rooms.map((room) => {
            const here = peopleIn(room.id);
            // A private room is a closed door unless the adult module is on.
            if (room.kind === "private" && !run.game.adult)
              return (
                <li key={room.id} className="bc-row bc-row-flat">
                  <span className="bc-row-text">
                    <span className="bc-row-title">{room.name}</span>
                    <span className="bc-muted">{t("ui.bigCheese.adult.door")}</span>
                  </span>
                </li>
              );
            // T2: a hidden room stays locked until its key is in the drawer.
            if (room.kind === "hidden" && !run.game.openedRooms?.includes(room.id))
              return (
                <li key={room.id} className="bc-row bc-row-flat">
                  <span className="bc-row-text">
                    <span className="bc-row-title">{room.name}</span>
                    <span className="bc-muted">{t("ui.bigCheese.place.locked")}</span>
                  </span>
                  <button
                    type="button"
                    className="bc-btn"
                    disabled={busy}
                    onClick={() => void act(`rooms/${room.id}/open`)}
                  >
                    {t("ui.bigCheese.place.openRoom")}
                  </button>
                </li>
              );
            return (
              <li key={room.id}>
                <button type="button" className="bc-row" onClick={() => setRoomId(room.id)}>
                  <span className="bc-row-text">
                    <span className="bc-row-title">{room.name}</span>
                    <span className="bc-muted">
                      {t("ui.bigCheese.place.condition", {
                        state: t(stateKey(run.game.rooms[room.id]?.condition ?? 50)),
                      })}
                    </span>
                    {here.length > 0 && (
                      <span className="bc-clamp">{here.map((id) => nameOf(kit, id)).join(", ")}</span>
                    )}
                  </span>
                  {here.slice(0, 3).map((id) => (
                    <Face key={id} kit={kit} id={id} size="s" />
                  ))}
                </button>
              </li>
            );
          })}
          <li>
            <Build ctx={ctx} />
          </li>
          <li>
            <Culture ctx={ctx} />
          </li>
          <li>
            <Trip ctx={ctx} />
          </li>
          <li>
            <Adult ctx={ctx} />
          </li>
        </ul>
      ) : rumours.length === 0 ? (
        <p>{t("ui.bigCheese.place.noRumours")}</p>
      ) : (
        <ul className="bc-plain">
          {rumours.map((id) => (
            <li key={id} className="bc-row bc-row-flat">
              <Face kit={kit} id={place!.grapevine[id].source} />
              <span className="bc-row-text">
                <span className="bc-muted">{nameOf(kit, place!.grapevine[id].source)}</span>
                <span>{place!.grapevine[id].text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
