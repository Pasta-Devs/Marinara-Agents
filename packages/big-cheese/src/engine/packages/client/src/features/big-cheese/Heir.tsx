// ──────────────────────────────────────────────
// Big Cheese M4 T6: heir and legacy runs (modules.md section 2)
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { postAction } from "./api";
import { nameOf, type Ctx } from "./parts";

/** On a person's file, with the Legacy layer on: name this person as the heir. */
export function NameHeir({ ctx, id }: { ctx: Ctx; id: string }) {
  const { t } = useTranslation();
  const { run, busy, act } = ctx;
  const g = run.game;
  if (g.status !== "playing" || (g.layers?.legacy ?? 0) <= 0 || g.people[id]?.status !== "active") return null;
  if (g.legacy?.heir === id) return <p className="bc-chip">{t("ui.bigCheese.legacy.isHeir")}</p>;
  return (
    <button type="button" className="bc-btn" disabled={busy} onClick={() => void act("heir", { person: id })}>
      {t("ui.bigCheese.legacy.name")}
    </button>
  );
}

/** On the end screen: when an heir is named, start the next boss's run. */
export function PlayNext({ ctx, onOpen }: { ctx: Ctx; onOpen?: (id: string) => void }) {
  const { t } = useTranslation();
  const { run, busy } = ctx;
  const [failed, setFailed] = useState(false);
  const [wait, setWait] = useState(false);
  const heir = run.game.legacy?.heir;
  if (!heir || !onOpen) return null;
  return (
    <>
      <p className="bc-muted">{t("ui.bigCheese.legacy.heir", { name: nameOf(ctx.kit, heir) })}</p>
      {failed && <p role="alert">{t("ui.bigCheese.legacy.error")}</p>}
      <button
        type="button"
        className="bc-btn bc-btn-primary"
        disabled={busy || wait}
        onClick={() => {
          if (run.game.legacy?.next) return onOpen(run.game.legacy.next);
          setWait(true);
          setFailed(false);
          postAction(run, "legacy")
            .then((next) => onOpen(next.run.id))
            .catch(() => setFailed(true))
            .finally(() => setWait(false));
        }}
      >
        {t("ui.bigCheese.legacy.next")}
      </button>
    </>
  );
}
