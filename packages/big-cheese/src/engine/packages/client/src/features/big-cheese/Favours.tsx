// Big Cheese M4 T12: favours and leverage (modules.md section 4, design.md 7.2 and 7.4).
// The Staff file lists them. A meeting item and the hearing prep can spend them. An inbox card can use a secret.
import { useTranslation } from "react-i18next";
import { nameOf, type Ctx } from "./parts";
import type { Card } from "./api";

const owedBy = (ctx: Ctx, id: string) => ctx.run.game.favours?.some((f) => !f.used && f.from === id && !f.to);
const secretOf = (ctx: Ctx, id: string) =>
  (ctx.run.game.things?.drawer ?? []).find(
    (t) => t.kind === "evidence" && t.id.startsWith("secret-") && t.about === id,
  );
const leverageOf = (ctx: Ctx, id: string) => ctx.run.game.leverage?.find((l) => l.about === id);

/** On a person's file: what they owe, what you owe them, and the secret you hold. */
export function FavourList({ ctx, id }: { ctx: Ctx; id: string }) {
  const { t } = useTranslation();
  const mine = (ctx.run.game.favours ?? []).filter((f) => f.from === id || f.to === id);
  const secret = secretOf(ctx, id);
  const used = leverageOf(ctx, id);
  if (mine.length === 0 && !secret) return null;
  return (
    <section className="bc-section" aria-labelledby="bc-favours">
      <h2 id="bc-favours" className="bc-subhead">
        {t("ui.bigCheese.favours.title")}
      </h2>
      <ul className="bc-plain">
        {mine.map((f, i) => (
          <li key={i}>
            {t(f.to ? "ui.bigCheese.favours.youOwe" : "ui.bigCheese.favours.owedYou", { why: f.why })}{" "}
            {f.used && <span className="bc-chip">{t("ui.bigCheese.favours.used")}</span>}
          </li>
        ))}
        {secret && (
          <li>
            {t("ui.bigCheese.favours.secret", { name: secret.name })}{" "}
            {used && (
              <span className="bc-chip">
                {t(used.found ? "ui.bigCheese.favours.found" : "ui.bigCheese.favours.used")}
              </span>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}

/** In a meeting item or at the hearing prep: call in a favour from one of these people. */
export function CallFavour({ ctx, people, done }: { ctx: Ctx; people: string[]; done: boolean }) {
  const { t } = useTranslation();
  const rows = people.filter((id) => owedBy(ctx, id));
  if (rows.length === 0) return null;
  return (
    <ul className="bc-list" aria-label={t("ui.bigCheese.favours.title")}>
      {rows.map((id) => (
        <li key={id} className="bc-row bc-row-flat">
          <button
            type="button"
            className="bc-btn"
            disabled={ctx.busy || done}
            onClick={() => void ctx.act("favour", { person: id })}
          >
            {t("ui.bigCheese.favours.callFor", { name: nameOf(ctx.kit, id) })}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** In a meeting item: use a secret to swing one attendee. */
export function UseSecret({ ctx, people, done }: { ctx: Ctx; people: string[]; done: boolean }) {
  const { t } = useTranslation();
  const rows = people.filter((id) => secretOf(ctx, id) && !leverageOf(ctx, id));
  if (rows.length === 0) return null;
  return (
    <ul className="bc-list" aria-label={t("ui.bigCheese.favours.use")}>
      {rows.map((id) => (
        <li key={id} className="bc-row bc-row-flat">
          <button
            type="button"
            className="bc-btn"
            disabled={ctx.busy || done}
            onClick={() => void ctx.act("leverage", { person: id })}
          >
            {t("ui.bigCheese.favours.useOn", { name: nameOf(ctx.kit, id) })}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** On an inbox card: use what you know about the asker. The card closes as won (1 hour). */
export function CardSecret({ ctx, card, noHours }: { ctx: Ctx; card: Card; noHours: boolean }) {
  const { t } = useTranslation();
  if (!secretOf(ctx, card.asker) || leverageOf(ctx, card.asker)) return null;
  return (
    <button
      type="button"
      className="bc-btn bc-btn-quiet"
      disabled={ctx.busy || noHours}
      onClick={() =>
        void ctx.act("leverage", { person: card.asker, card: card.id }).then((ok) => ok && ctx.go("inbox"))
      }
    >
      {t("ui.bigCheese.favours.use")}
    </button>
  );
}
