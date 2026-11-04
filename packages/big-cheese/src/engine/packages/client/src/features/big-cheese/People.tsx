// ──────────────────────────────────────────────
// Big Cheese: People and one person's file (ui.md §5.10)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { Face, moodKey, stanceKey, trustKey, type Ctx } from "./parts";

/** The newest feeling line the Friday report wrote for this person. */
const feeling = (ctx: Ctx, id: string) => {
  const weeks = Object.keys(ctx.run.text.feelings).sort((a, b) => Number(b) - Number(a));
  for (const week of weeks) {
    const line = ctx.run.text.feelings[week].find((entry) => entry.person === id)?.line;
    if (line) return line;
  }
  return null;
};

export function People({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, go } = ctx;
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.people.title")}
      </h1>
      <ul className="bc-list">
        {kit.people.map((who) => {
          const state = run.game.people[who.id];
          return (
            <li key={who.id}>
              <button type="button" className="bc-row" onClick={() => go(`person:${who.id}`)}>
                <Face kit={kit} id={who.id} />
                <span className="bc-row-text">
                  <span className="bc-row-title">{who.name}</span>
                  <span className="bc-muted">{who.role}</span>
                  <span className="bc-clamp">{feeling(ctx, who.id) ?? (state && t(trustKey(state.trust)))}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
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
  const threadTitle = (threadId: string) => run.game.threads[threadId]?.title;
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
                  stance: t(stanceKey(memory.stance)),
                  thread: threadTitle(memory.thread) ?? t("ui.bigCheese.person.oldThread"),
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
              <li key={thread.id}>{thread.title}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
