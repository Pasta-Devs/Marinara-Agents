// ──────────────────────────────────────────────
// Big Cheese: meetings (design.md §7, ui.md §5.8). Board hearing prep is in here too; the hearing itself plays as a big scene.
// ──────────────────────────────────────────────
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MeetingItem } from "./api";
import { dayKey, Face, nameOf, person, stanceKey, type Ctx } from "./parts";

export function HearingPrep({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const { clock, hearing, hearingBody, closed } = run.game;
  if (!hearing) return null;
  const noHours = clock.hoursLeft === 0;
  const today = clock.week === hearing.week && clock.day >= hearing.day;
  const members = new Set(hearingBody.map((member) => member.id));
  const witnesses = kit.people.filter((who) => !members.has(who.id) && !hearing.witnesses.includes(who.id));
  const won = [
    ...closed.filter((thread) => thread.state === "won"),
    ...(run.game.things?.drawer ?? []).filter((t) => t.kind === "evidence"), // drawer evidence is accepted too
  ];
  const full = (list: string[]) => list.length >= 2;

  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.hearing.title")}
      </h1>
      <p>
        {t("ui.bigCheese.hearing.notice", {
          meter: kit.meters[hearing.meter]?.label ?? hearing.meter,
          day: t(dayKey(hearing.day)),
          week: hearing.week,
        })}
      </p>
      {today ? (
        <button
          type="button"
          className="bc-btn bc-btn-primary"
          disabled={busy}
          onClick={() => void act("hearing/start")}
        >
          {t("ui.bigCheese.hearing.start")}
        </button>
      ) : (
        <p className="bc-muted">{t("ui.bigCheese.hearing.prepHelp")}</p>
      )}
      {noHours && <p className="bc-note">{t("ui.bigCheese.card.noHours")}</p>}

      <section className="bc-section" aria-labelledby="bc-members">
        <h2 id="bc-members" className="bc-subhead">
          {t("ui.bigCheese.hearing.members")}
        </h2>
        <ul className="bc-list">
          {hearingBody.map((member) => (
            <li key={member.id} className="bc-row bc-row-flat">
              <Face kit={kit} id={member.id} size="s" />
              <span className="bc-row-text bc-row-title">{nameOf(kit, member.id)}</span>
              <button
                type="button"
                className="bc-btn"
                disabled={busy || noHours}
                onClick={() => void act("hearing/talk", { person: member.id })}
              >
                {t("ui.bigCheese.hearing.talk")}
                <span className="bc-sr"> {nameOf(kit, member.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bc-section" aria-labelledby="bc-witnesses">
        <h2 id="bc-witnesses" className="bc-subhead">
          {t("ui.bigCheese.hearing.witnesses", { n: hearing.witnesses.length })}
        </h2>
        <ul className="bc-plain">
          {hearing.witnesses.map((id) => (
            <li key={id}>{nameOf(kit, id)}</li>
          ))}
        </ul>
        {!full(hearing.witnesses) && (
          <ul className="bc-list">
            {witnesses.map((who) => (
              <li key={who.id} className="bc-row bc-row-flat">
                <Face kit={kit} id={who.id} size="s" />
                <span className="bc-row-text bc-row-title">{who.name}</span>
                <button
                  type="button"
                  className="bc-btn"
                  disabled={busy || noHours}
                  onClick={() => void act("hearing/witness", { person: who.id })}
                >
                  {t("ui.bigCheese.hearing.call")}
                  <span className="bc-sr"> {who.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bc-section" aria-labelledby="bc-evidence">
        <h2 id="bc-evidence" className="bc-subhead">
          {t("ui.bigCheese.hearing.evidence", { n: hearing.evidence.length })}
        </h2>
        {won.length === 0 && <p>{t("ui.bigCheese.hearing.noEvidence")}</p>}
        <ul className="bc-list">
          {won.map((thread, index) => {
            const used = hearing.evidence.includes(thread.id);
            return (
              <li key={thread.id} className="bc-row bc-row-flat">
                {/* shortcut: closed threads carry no title in the run document, so they are numbered; show titles once the server keeps them */}
                <span className="bc-row-text">{t("ui.bigCheese.hearing.wonThread", { n: index + 1 })}</span>
                {used ? (
                  <span className="bc-chip">{t("ui.bigCheese.hearing.used")}</span>
                ) : (
                  <button
                    type="button"
                    className="bc-btn"
                    disabled={busy || noHours || full(hearing.evidence)}
                    onClick={() => void act("hearing/evidence", { threadId: thread.id })}
                  >
                    {t("ui.bigCheese.hearing.use")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

// shortcut: the client does not know the boss's authority yet, so it offers the manager kit's meetings.
// Replace with a kinds list from the kit view when a second authority ships.
const KINDS = {
  board: "ui.bigCheese.meeting.kind.board",
  all_hands: "ui.bigCheese.meeting.kind.all_hands",
  union_talks: "ui.bigCheese.meeting.kind.union_talks",
  safety_audit: "ui.bigCheese.meeting.kind.safety_audit",
  investor_pitch: "ui.bigCheese.meeting.kind.investor_pitch",
  handover: "ui.bigCheese.meeting.kind.handover",
  outsiders: "ui.bigCheese.meeting.kind.outsiders",
} as const;

const SIDES = {
  for: { mark: "+", key: "ui.bigCheese.meeting.for" },
  open: { mark: "?", key: "ui.bigCheese.meeting.open" },
  against: { mark: "-", key: "ui.bigCheese.meeting.against" },
} as const;
const sideOf = (v: number) => (v > 0 ? "for" : v < 0 ? "against" : "open");

export function MeetingScreen({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const [own, setOwn] = useState("");
  const m = run.game.meeting;
  const noHours = run.game.clock.hoursLeft === 0;
  const items = m?.items ?? [];
  const current: MeetingItem | undefined = m && !m.done ? items.find((i) => i.chosen === undefined) : undefined;
  const closed = items.filter((i) => i.chosen !== undefined);
  // T5: an election item shows its candidates (the server keeps the backed one in `stakes`).
  const thread = current?.thread ? run.game.threads[current.thread] : undefined;
  const election = thread?.layer === "politics" && thread.stakes.startsWith("election") ? thread : undefined;
  const backed = election?.stakes.slice(9);

  const onOwn = (event: FormEvent) => {
    event.preventDefault();
    if (own.trim()) void act("meetings/choose", { text: own.trim() }).then((ok) => ok && setOwn(""));
  };

  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.meeting.title")}
      </h1>
      {m && closed.length > 0 && (
        <section className="bc-section" aria-labelledby="bc-meeting-done">
          <h2 id="bc-meeting-done" className="bc-subhead">
            {t("ui.bigCheese.meeting.closedItems")}
          </h2>
          <ul className="bc-list">
            {closed.map((item) => (
              <li key={item.id} className="bc-row bc-row-flat">
                <span className="bc-row-text bc-row-title">{item.title}</span>
                <span className="bc-chip">
                  {t(item.passed ? "ui.bigCheese.meeting.passed" : "ui.bigCheese.meeting.failed")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {m && current ? (
        <section className="bc-section" aria-labelledby="bc-meeting-item">
          <h2 id="bc-meeting-item" className="bc-subhead">
            {t("ui.bigCheese.meeting.item", { n: closed.length + 1, total: items.length })}
            {" · "}
            {current.title}
          </h2>
          <ul className="bc-plain" aria-live="polite">
            {current.lines.map((line, index) => (
              <li key={index}>
                <strong>{person(kit, line.who)?.name ?? ""}</strong> {line.text}
              </li>
            ))}
          </ul>
          <ul className="bc-list" aria-label={t("ui.bigCheese.meeting.support")}>
            {m.people.map((id) => {
              const side = sideOf(current.base[id] ?? 0);
              return (
                <li key={id} className="bc-row bc-row-flat">
                  <Face kit={kit} id={id} size="s" />
                  <span className="bc-row-text bc-row-title">{nameOf(kit, id)}</span>
                  <span className="bc-chip" aria-hidden="true">
                    {SIDES[side].mark}
                  </span>
                  <span className="bc-sr">{t(SIDES[side].key)}</span>
                </li>
              );
            })}
          </ul>
          <p className="bc-muted">
            {t("ui.bigCheese.meeting.tally", {
              for: m.people.filter((id) => sideOf(current.base[id] ?? 0) === "for").length,
              open: m.people.filter((id) => sideOf(current.base[id] ?? 0) === "open").length,
              against: m.people.filter((id) => sideOf(current.base[id] ?? 0) === "against").length,
            })}
          </p>
          {election && (
            <section className="bc-section" aria-labelledby="bc-candidates">
              <h3 id="bc-candidates" className="bc-subhead">
                {t("ui.bigCheese.politics.candidates")}
              </h3>
              {backed && <p className="bc-muted">{t("ui.bigCheese.politics.backed", { name: nameOf(kit, backed) })}</p>}
              <ul className="bc-list">
                {election.people.map((id) => (
                  <li key={id} className="bc-row bc-row-flat">
                    <Face kit={kit} id={id} size="s" />
                    <span className="bc-row-text bc-row-title">{nameOf(kit, id)}</span>
                    {!backed && (
                      <button
                        type="button"
                        className="bc-btn"
                        disabled={busy}
                        onClick={() => void act("politics/back", { thread: election.id, person: id })}
                      >
                        {t("ui.bigCheese.politics.back", { name: nameOf(kit, id) })}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {current.suggestions.length > 0 ? (
            <div className="bc-choice">
              <h3 className="bc-subhead">{t("ui.bigCheese.scene.choose")}</h3>
              <ul className="bc-list">
                {current.suggestions.map((entry) => (
                  <li key={entry.stance}>
                    <button
                      type="button"
                      className="bc-answer"
                      disabled={busy}
                      onClick={() => void act("meetings/choose", { stance: entry.stance })}
                    >
                      <span className="bc-pill">{t(stanceKey(entry.stance))}</span>
                      <span className="bc-said">{entry.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <form className="bc-form" onSubmit={onOwn}>
                <label htmlFor="bc-meeting-own">{t("ui.bigCheese.card.own")}</label>
                <textarea id="bc-meeting-own" rows={2} value={own} onChange={(event) => setOwn(event.target.value)} />
                <button type="submit" className="bc-btn" disabled={busy || !own.trim()}>
                  {t("ui.bigCheese.card.sayIt")}
                </button>
              </form>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="bc-section" aria-labelledby="bc-meeting-call">
          <h2 id="bc-meeting-call" className="bc-subhead">
            {m?.done
              ? t("ui.bigCheese.meeting.result", { n: items.filter((i) => i.passed).length, total: items.length })
              : t("ui.bigCheese.meeting.call")}
          </h2>
          <p className="bc-muted">{t("ui.bigCheese.meeting.callHelp")}</p>
          {noHours && <p className="bc-note">{t("ui.bigCheese.card.noHours")}</p>}
          <ul className="bc-list">
            {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((kind) => (
              <li key={kind}>
                <button
                  type="button"
                  className="bc-btn"
                  disabled={busy || noHours}
                  onClick={() => void act("meetings/start", { kind })}
                >
                  {t(KINDS[kind])}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
