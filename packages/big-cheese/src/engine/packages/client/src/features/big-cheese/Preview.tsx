// ──────────────────────────────────────────────
// Big Cheese: the Preview screen (ui.md §5.3). The place as it will start, with the cast
// the player picked. Systems can be renamed or taken out before "Take the job".
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorKey, previewKit, type DraftPart, type PreviewKit, type StartBody, type SystemEdit } from "./api";
import { Face } from "./parts";

const SHOWN = 5;

export function Preview({
  kitId,
  cast,
  busy,
  failure,
  onTake,
  onCast,
  onBack,
  onEdit,
  draft,
  rerolling,
  onReroll,
}: {
  kitId: string;
  cast?: StartBody;
  busy: boolean;
  failure: string | null;
  onTake: (body: StartBody) => void;
  onCast: () => void;
  onBack: () => void;
  onEdit?: () => void;
  // T3: a drafted place. It is shown as it is, and parts of it can be rerolled.
  draft?: PreviewKit;
  rerolling?: DraftPart | null;
  onReroll?: (part: DraftPart) => void;
}) {
  const { t } = useTranslation();
  const [kit, setKit] = useState<PreviewKit | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [edits, setEdits] = useState<SystemEdit[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setProblem(null);
    if (draft) return setKit(draft);
    previewKit(kitId, cast).then(setKit, (error) => setProblem(errorKey(error)));
  }, [kitId, cast, tries, draft]);
  useEffect(() => heading.current?.focus(), []);

  const editOf = (index: number) => edits.find((e) => e.index === index);
  const change = (index: number, patch: Partial<SystemEdit>) =>
    setEdits((now) => [...now.filter((e) => e.index !== index), { ...editOf(index), ...patch, index }]);
  // An emptied name is no rename.
  const take = () =>
    onTake({
      ...cast,
      systems: edits.map((e) => ({ ...e, name: e.name?.trim() || undefined })).filter((e) => e.name || e.remove),
    });

  const reroll = (part: DraftPart, label: string) =>
    onReroll && (
      <button
        type="button"
        className="bc-btn bc-btn-quiet"
        disabled={busy || !!rerolling}
        onClick={() => onReroll(part)}
      >
        {label}
      </button>
    );
  const skeleton = <p className="bc-skeleton">{t("ui.bigCheese.preview.rerolling")}</p>;

  const people = kit ? (all ? kit.people : kit.people.slice(0, SHOWN)) : [];
  return (
    <div className="bc-root" aria-busy={busy || (!kit && !problem)}>
      <header className="bc-top" />
      <main className="bc-main">
        <h1 className="bc-heading" tabIndex={-1} ref={heading}>
          {kit?.name ?? t("ui.bigCheese.title")}
        </h1>
        {!kit && !problem && <p className="bc-skeleton">{t("ui.bigCheese.preview.loading")}</p>}
        {problem && (
          <div role="alert" className="bc-note">
            <p>{t("ui.bigCheese.preview.loadError")}</p>
            <p>{t(problem)}</p>
            <button type="button" className="bc-btn" onClick={() => setTries((n) => n + 1)}>
              {t("ui.bigCheese.titleScreen.retry")}
            </button>
          </div>
        )}
        {kit && (
          <>
            <p>{rerolling === "name" || rerolling === "all" ? skeleton : kit.premise}</p>
            {reroll("name", t("ui.bigCheese.preview.rerollName"))}
            <p>
              {kit.boss
                ? t("ui.bigCheese.preview.youPlay", { name: kit.boss.name, title: kit.bossTitle })
                : t("ui.bigCheese.preview.youAre", { title: kit.bossTitle })}
            </p>

            <section className="bc-section" aria-labelledby="bc-pv-meters">
              <h2 id="bc-pv-meters" className="bc-subhead">
                {t("ui.bigCheese.preview.meters")}
              </h2>
              <p className="bc-row-meta">
                {Object.entries(kit.meters).map(([id, meter]) => (
                  <span key={id} className="bc-chip">
                    {meter.label}
                  </span>
                ))}
              </p>
            </section>

            <section className="bc-section" aria-labelledby="bc-pv-people">
              <h2 id="bc-pv-people" className="bc-subhead">
                {t("ui.bigCheese.preview.people")}
              </h2>
              {rerolling === "people" || rerolling === "all" ? (
                skeleton
              ) : (
                <ul className="bc-list">
                  {people.map((who) => (
                    <li key={who.id} className="bc-row bc-row-flat">
                      <Face kit={kit} id={who.id} />
                      <span className="bc-row-text">
                        <span className="bc-row-title">{who.name}</span>
                        <span className="bc-muted">{who.role}</span>
                        {who.library && <span className="bc-chip">{t("ui.bigCheese.cast.badge")}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {kit.people.length > SHOWN && (
                <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setAll(!all)}>
                  {all
                    ? t("ui.bigCheese.preview.fewer")
                    : t("ui.bigCheese.preview.seeAll", { count: kit.people.length })}
                </button>
              )}
              {draft ? (
                reroll("people", t("ui.bigCheese.preview.rerollPeople"))
              ) : (
                <button type="button" className="bc-btn" disabled={busy} onClick={onCast}>
                  {t("ui.bigCheese.preview.change")}
                </button>
              )}
            </section>

            <section className="bc-section" aria-labelledby="bc-pv-rooms">
              <h2 id="bc-pv-rooms" className="bc-subhead">
                {t("ui.bigCheese.preview.rooms")}
              </h2>
              {rerolling === "rooms" || rerolling === "all" ? (
                skeleton
              ) : (
                <p className="bc-muted">{kit.rooms.map((room) => room.name).join(", ")}</p>
              )}
              {reroll("rooms", t("ui.bigCheese.preview.rerollRooms"))}
            </section>

            {kit.systems.length > 0 && (
              <section className="bc-section" aria-labelledby="bc-pv-systems">
                <h2 id="bc-pv-systems" className="bc-subhead">
                  {t("ui.bigCheese.preview.systems")}
                </h2>
                <p className="bc-row-meta">
                  {kit.systems.map((system, index) => {
                    const edit = editOf(index);
                    const name = edit?.name?.trim() || system.name;
                    return (
                      <button
                        key={index}
                        type="button"
                        className="bc-btn"
                        aria-pressed={open === index}
                        onClick={() => setOpen(open === index ? null : index)}
                      >
                        {edit?.remove ? t("ui.bigCheese.preview.systemOut", { name }) : name}
                      </button>
                    );
                  })}
                </p>
                {open !== null && kit.systems[open] && (
                  <div className="bc-form">
                    <p className="bc-muted">{kit.systems[open].text}</p>
                    <label htmlFor="bc-pv-system-name">{t("ui.bigCheese.preview.systemName")}</label>
                    <input
                      id="bc-pv-system-name"
                      type="text"
                      maxLength={40}
                      disabled={editOf(open)?.remove}
                      value={editOf(open)?.name ?? kit.systems[open].name}
                      onChange={(event) => change(open, { name: event.target.value })}
                    />
                    <button
                      type="button"
                      className="bc-btn bc-btn-quiet"
                      onClick={() => change(open, { remove: editOf(open)?.remove ? undefined : true })}
                    >
                      {editOf(open)?.remove ? t("ui.bigCheese.preview.restore") : t("ui.bigCheese.preview.remove")}
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
        {failure && (
          <p role="alert" className="bc-note">
            {t(failure)}
          </p>
        )}
        {draft && reroll("all", t("ui.bigCheese.preview.rerollAll"))}
        <button type="button" className="bc-btn bc-btn-primary" disabled={busy || !kit} onClick={take}>
          {busy ? t("ui.bigCheese.titleScreen.starting") : t("ui.bigCheese.preview.take")}
        </button>
        <button type="button" className="bc-btn bc-btn-quiet" disabled={busy} onClick={onBack}>
          {t("ui.bigCheese.preview.back")}
        </button>
        {onEdit && (
          <button type="button" className="bc-btn bc-btn-quiet" disabled={busy} onClick={onEdit}>
            {t("ui.bigCheese.preview.editKit")}
          </button>
        )}
      </main>
    </div>
  );
}
