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
    </>
  );
}
