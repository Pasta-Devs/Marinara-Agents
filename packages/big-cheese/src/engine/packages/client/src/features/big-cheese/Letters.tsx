// ──────────────────────────────────────────────
// Big Cheese: Letters from the last boss, the guided first week (design.md §3.6)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { arrived } from "./Office";
import { dayKey, Face, nameOf, type Ctx } from "./parts";

// Where a letter's "screen" points. Screens that M1 does not have stay on the Office.
const OPEN_INBOX = { view: "inbox", key: "ui.bigCheese.letters.openInbox" };
const OPEN_PEOPLE = { view: "people", key: "ui.bigCheese.letters.openPeople" };
const SCREEN_VIEWS: Record<string, { view: string; key: string }> = {
  inbox: OPEN_INBOX,
  staff: OPEN_PEOPLE,
  people: OPEN_PEOPLE,
  place: { view: "place", key: "ui.bigCheese.letters.openPlace" },
};

export function Letters({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, busy, act, go } = ctx;
  const { drawer = [], equipment = [] } = run.game.things ?? {};
  const guided = Object.values(run.game.threads).find((thread) => thread.kind === "guided");

  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.letters.title")}
      </h1>
      <ul className="bc-list">
        {kit.letters.map((letter, index) => {
          if (!arrived(letter, run.game.clock)) return null;
          // A closed guided thread means every letter was read.
          const read = !guided || !!guided.beats[index]?.read;
          const to = SCREEN_VIEWS[letter.screen];
          return (
            <li key={index} className="bc-panel">
              <p className="bc-row">
                <Face kit={kit} id={letter.person} size="s" />
                <span className="bc-row-text">
                  <span className="bc-row-title">{nameOf(kit, letter.person)}</span>
                  <span className="bc-muted">{t(dayKey(letter.day))}</span>
                </span>
              </p>
              {read ? (
                <>
                  <p className="bc-quote">{letter.text}</p>
                  {to && (
                    <button type="button" className="bc-btn" onClick={() => go(to.view)}>
                      {t(to.key)}
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="bc-btn bc-btn-primary"
                  disabled={busy}
                  onClick={() => void act(`letters/${index}/read`)}
                >
                  {t("ui.bigCheese.letters.read")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {/* T2: the drawer holds keys, gifts, documents, evidence and artefacts */}
      <h2 className="bc-subhead">{t("ui.bigCheese.drawer.title")}</h2>
      {drawer.length === 0 ? (
        <p className="bc-muted">{t("ui.bigCheese.drawer.empty")}</p>
      ) : (
        <ul className="bc-list">
          {drawer.map((item) => (
            <li key={item.id} className="bc-row bc-row-flat">
              <span className="bc-row-text">
                <span className="bc-row-title">{item.name}</span>
                <span className="bc-muted">{t(`ui.bigCheese.drawer.kind_${item.kind}`)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {equipment.length > 0 && (
        <>
          <h2 className="bc-subhead">{t("ui.bigCheese.drawer.equipment")}</h2>
          <ul className="bc-list">
            {equipment.map((item) => (
              <li key={item.id} className="bc-row bc-row-flat">
                <span className="bc-row-text">
                  <span className="bc-row-title">{item.name}</span>
                  <span className="bc-muted">{t("ui.bigCheese.drawer.condition", { value: item.condition })}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
