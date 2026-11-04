// ──────────────────────────────────────────────
// Big Cheese: board hearing prep (design.md §7.4). The hearing itself plays as a big scene.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { dayKey, Face, nameOf, type Ctx } from "./parts";

export function HearingPrep({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const { clock, hearing, hearingBody, closed } = run.game;
  if (!hearing) return null;
  const noHours = clock.hoursLeft === 0;
  const today = clock.week === hearing.week && clock.day >= hearing.day;
  const members = new Set(hearingBody.map((member) => member.id));
  const witnesses = kit.people.filter((who) => !members.has(who.id) && !hearing.witnesses.includes(who.id));
  const won = closed.filter((thread) => thread.state === "won");
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
