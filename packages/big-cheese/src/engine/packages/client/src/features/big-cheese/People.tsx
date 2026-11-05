// ──────────────────────────────────────────────
// Big Cheese: People and one person's file (ui.md §5.10)
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Hire } from "./Cast";
import { Face, initials, memoryKey, moodKey, nameOf, threadTitle, trustKey, type Ctx } from "./parts";

/** The newest feeling line the Friday report wrote for this person. */
const feeling = (ctx: Ctx, id: string) => {
  const weeks = Object.keys(ctx.run.text.feelings).sort((a, b) => Number(b) - Number(a));
  for (const week of weeks) {
    const line = ctx.run.text.feelings[week].find((entry) => entry.person === id)?.line;
    if (line) return line;
  }
  return null;
};

// A relation reads from the person's side. Crushes and affairs show only once the boss heard of them (place.ts).
const RELATIONS: Record<string, [string, string]> = {
  friend: ["ui.bigCheese.relation.friend", "ui.bigCheese.relation.friend"],
  rival: ["ui.bigCheese.relation.rival", "ui.bigCheese.relation.rival"],
  crush: ["ui.bigCheese.relation.crush", "ui.bigCheese.relation.crushBy"],
  couple: ["ui.bigCheese.relation.couple", "ui.bigCheese.relation.couple"],
  mentor: ["ui.bigCheese.relation.mentor", "ui.bigCheese.relation.mentorBy"],
  enemy: ["ui.bigCheese.relation.enemy", "ui.bigCheese.relation.enemy"],
  family: ["ui.bigCheese.relation.family", "ui.bigCheese.relation.family"],
  secret_affair: ["ui.bigCheese.relation.affair", "ui.bigCheese.relation.affair"],
};

/** The relations of one person the boss knows, as { key, other } for a translation line. */
const knownRelations = (ctx: Ctx, id: string) =>
  ctx.run.game.relations
    .filter((r) => (r.a === id || r.b === id) && RELATIONS[r.kind])
    .filter(
      (r) =>
        (r.kind !== "crush" && r.kind !== "secret_affair") ||
        ctx.run.text.place?.known.includes([r.a, r.b].sort().join("|")),
    )
    .map((r) => ({ key: RELATIONS[r.kind][r.a === id ? 0 : 1], other: r.a === id ? r.b : r.a }));

const whereLine = (t: (key: string, options?: Record<string, unknown>) => string, ctx: Ctx, id: string) => {
  const room = ctx.kit.rooms.find((r) => r.id === ctx.run.game.people[id]?.room);
  return room ? t("ui.bigCheese.people.in", { room: room.name }) : t("ui.bigCheese.people.home");
};

export function People({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, go } = ctx;
  const [hiring, setHiring] = useState(false);
  if (hiring) return <Hire ctx={ctx} onClose={() => setHiring(false)} />;
  // A visitor is gone once their last day has passed (dayIndex: 5 days a week).
  const today = (run.game.clock.week - 1) * 5 + run.game.clock.day;
  const until = (id: string) => run.cast?.people[id]?.until;
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.people.title")}
      </h1>
      {kit.boss && (
        <div className="bc-row bc-row-flat">
          <span className="bc-face bc-face-m" aria-hidden="true">
            {kit.boss.avatar ? <img src={kit.boss.avatar} alt="" /> : initials(kit.boss.name)}
          </span>
          <span className="bc-row-text">
            <span className="bc-row-title">{kit.boss.name}</span>
            <span className="bc-chip">{t("ui.bigCheese.cast.persona")}</span>
          </span>
        </div>
      )}
      <ul className="bc-list">
        {kit.people
          .filter((who) => (until(who.id) ?? today + 1) > today)
          .map((who) => {
            const state = run.game.people[who.id];
            return (
              <li key={who.id}>
                <button type="button" className="bc-row" onClick={() => go(`person:${who.id}`)}>
                  <Face kit={kit} id={who.id} />
                  <span className="bc-row-text">
                    <span className="bc-row-title">{who.name}</span>
                    <span className="bc-muted">{who.role}</span>
                    <span className="bc-muted">{whereLine(t, ctx, who.id)}</span>
                    {who.library && <span className="bc-chip">{t("ui.bigCheese.cast.badge")}</span>}
                    {until(who.id) !== undefined && <span className="bc-chip">{t("ui.bigCheese.people.visitor")}</span>}
                    <span className="bc-clamp">{feeling(ctx, who.id) ?? (state && t(trustKey(state.trust)))}</span>
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
      <button type="button" className="bc-btn" disabled={ctx.busy} onClick={() => setHiring(true)}>
        {t("ui.bigCheese.people.hire")}
      </button>
    </>
  );
}

export function PersonSheet({ ctx, id }: { ctx: Ctx; id: string }) {
  const { t } = useTranslation();
  const { run, kit } = ctx;
  const who = kit.people.find((entry) => entry.id === id);
  const state = run.game.people[id];
  const name = who?.name ?? id;
  const line = feeling(ctx, id);
  // A memory points at an open thread or, once it closed, at its entry in `closed`.
  const memoryThread = (threadId: string) => {
    const thread = run.game.threads[threadId] ?? run.game.closed.find((entry) => entry.id === threadId);
    return thread?.title ? threadTitle(t, kit, thread) : null;
  };
  const open = Object.values(run.game.threads).filter((thread) => thread.people.includes(id));

  return (
    <>
      <div className="bc-row bc-row-flat">
        <Face kit={kit} id={id} size="l" />
        <span className="bc-row-text">
          <h1 className="bc-heading" tabIndex={-1} data-focus>
            {name}
          </h1>
          <span className="bc-muted">{who?.role}</span>
          {who?.library && <span className="bc-chip">{t("ui.bigCheese.cast.badge")}</span>}
        </span>
      </div>
      {state && (
        <p className="bc-row-meta">
          <span className="bc-chip">{t("ui.bigCheese.person.mood", { mood: t(moodKey(state.mood)) })}</span>
          <span className="bc-chip">{t("ui.bigCheese.person.trust", { trust: t(trustKey(state.trust)) })}</span>
        </p>
      )}
      {line && <blockquote className="bc-quote">{line}</blockquote>}
      {who && who.traits.length > 0 && (
        <p className="bc-row-meta" aria-label={t("ui.bigCheese.person.traits")}>
          {who.traits.map((trait) => (
            <span key={trait} className="bc-chip">
              {trait}
            </span>
          ))}
        </p>
      )}

      {knownRelations(ctx, id).length > 0 && (
        <section className="bc-section" aria-labelledby="bc-knows">
          <h2 id="bc-knows" className="bc-subhead">
            {t("ui.bigCheese.person.knows")}
          </h2>
          <ul className="bc-plain">
            {knownRelations(ctx, id).map((relation) => (
              <li key={`${relation.key}${relation.other}`}>{t(relation.key, { name: nameOf(kit, relation.other) })}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="bc-section" aria-labelledby="bc-remembers">
        <h2 id="bc-remembers" className="bc-subhead">
          {t("ui.bigCheese.person.remembers")}
        </h2>
        {!state || state.memories.length === 0 ? (
          <p>{t("ui.bigCheese.person.noMemories", { name })}</p>
        ) : (
          <ul className="bc-plain">
            {state.memories.map((memory, index) => (
              <li key={index}>
                {t("ui.bigCheese.person.memory", {
                  week: memory.week,
                  stance: t(memoryKey(memory.stance)),
                  thread: memoryThread(memory.thread) ?? t("ui.bigCheese.person.oldThread"),
                })}
              </li>
            ))}
          </ul>
        )}
      </section>

      {open.length > 0 && (
        <section className="bc-section" aria-labelledby="bc-person-threads">
          <h2 id="bc-person-threads" className="bc-subhead">
            {t("ui.bigCheese.person.threads")}
          </h2>
          <ul className="bc-plain">
            {open.map((thread) => (
              <li key={thread.id}>{threadTitle(t, kit, thread)}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
