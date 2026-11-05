// ──────────────────────────────────────────────
// Big Cheese: the cast screen between the title screen and the run start (cast.md section 8, M1).
// A persona can be the boss and up to 3 cards can replace staff. The skip button is always there.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorKey, listCast, readCast, type CastItem, type CastList, type CastRead, type StartBody } from "./api";
import { initials, type Ctx } from "./parts";

const MAX_STAFF = 3;
const SHOWN = 50;

interface Pick {
  item: CastItem;
  slots: CastRead["slots"];
  slot: string; // the kit person this card replaces
  traits: string[];
  tone: string;
  lines: string; // one voice line per row
  core: string;
}

const lineList = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim().slice(0, 160))
    .filter(Boolean)
    .slice(0, 3);

function Avatar({ item }: { item: CastItem }) {
  return (
    <span className="bc-face bc-face-s" aria-hidden="true">
      {item.avatar ? <img src={item.avatar} alt="" /> : initials(item.name)}
    </span>
  );
}

function Row({
  item,
  on,
  disabled,
  onClick,
}: {
  item: CastItem;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li>
      <button type="button" className="bc-row" aria-pressed={on} disabled={disabled} onClick={onClick}>
        <Avatar item={item} />
        <span className="bc-row-text">
          <span className="bc-row-title">{item.name}</span>
          <span className="bc-muted bc-clamp">{item.line}</span>
        </span>
        {on && <span className="bc-chip">{t("ui.bigCheese.cast.picked")}</span>}
      </button>
    </li>
  );
}

export function Cast({
  kitId,
  busy,
  failure,
  onStart,
  onSkip,
  onBack,
}: {
  kitId: string;
  busy: boolean;
  failure: string | null;
  onStart: (cast: StartBody) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [list, setList] = useState<CastList | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [boss, setBoss] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [reading, setReading] = useState<CastItem | null>(null);
  const [search, setSearch] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    listCast().then(setList, () => setNote("ui.bigCheese.cast.loadError"));
  }, []);

  async function choose(item: CastItem) {
    if (picks.some((p) => p.item.id === item.id)) return setPicks(picks.filter((p) => p.item.id !== item.id));
    if (reading || picks.length >= MAX_STAFF) return;
    setReading(item);
    setNote(null);
    try {
      const { slots, sheet } = await readCast(kitId, item.id);
      const taken = new Set(picks.map((p) => p.slot));
      const slot = slots.find((s) => s.role === sheet.role && !taken.has(s.id)) ?? slots.find((s) => !taken.has(s.id));
      if (!slot) return setNote("ui.bigCheese.cast.noRole");
      setPicks((now) => [
        ...now,
        {
          item,
          slots,
          slot: slot.id,
          traits: sheet.traits,
          tone: sheet.tone,
          lines: sheet.lines.join("\n"),
          core: sheet.core,
        },
      ]);
    } catch (error) {
      setNote(errorKey(error));
    } finally {
      setReading(null);
    }
  }

  const edit = (id: string, change: Partial<Pick>) =>
    setPicks((now) => now.map((p) => (p.item.id === id ? { ...p, ...change } : p)));
  const slots = picks.map((p) => p.slot);
  const ready =
    picks.every((p) => p.traits.length > 0 && lineList(p.lines).length > 0) && new Set(slots).size === slots.length;
  const shown = (list?.characters ?? [])
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, SHOWN);

  const start = () =>
    onStart({
      ...(boss && { boss }),
      staff: picks.map((p) => ({
        characterId: p.item.id,
        replaces: p.slot,
        sheet: {
          role: p.slots.find((s) => s.id === p.slot)?.role ?? "",
          traits: p.traits,
          tone: p.tone,
          lines: lineList(p.lines),
          core: p.core,
        },
      })),
    });

  const problem = note ?? failure;
  return (
    <div className="bc-root" aria-busy={busy || !list || !!reading}>
      <header className="bc-top" />
      <main className="bc-main">
        <h1 className="bc-heading" tabIndex={-1} ref={heading}>
          {t("ui.bigCheese.cast.title")}
        </h1>
        <p>{t("ui.bigCheese.cast.intro")}</p>
        {!list && !note && <p className="bc-skeleton">{t("ui.bigCheese.cast.loading")}</p>}
        {problem && (
          <p role="alert" className="bc-note">
            {t(problem)}
          </p>
        )}

        {list && (
          <>
            <section className="bc-section" aria-labelledby="bc-cast-boss">
              <h2 id="bc-cast-boss" className="bc-subhead">
                {t("ui.bigCheese.cast.bossTitle")}
              </h2>
              <p className="bc-muted">{t("ui.bigCheese.cast.bossHelp")}</p>
              {list.personas.length === 0 ? (
                <p>{t("ui.bigCheese.cast.noPersonas")}</p>
              ) : (
                <ul className="bc-list">
                  {list.personas.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      on={boss === item.id}
                      onClick={() => setBoss(boss === item.id ? null : item.id)}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section className="bc-section" aria-labelledby="bc-cast-staff">
              <h2 id="bc-cast-staff" className="bc-subhead">
                {t("ui.bigCheese.cast.staffTitle")}
              </h2>
              <p className="bc-muted">{t("ui.bigCheese.cast.staffHelp")}</p>
              {list.characters.length === 0 ? (
                <p>{t("ui.bigCheese.cast.noCharacters")}</p>
              ) : (
                <>
                  <div className="bc-form">
                    <label htmlFor="bc-cast-search">{t("ui.bigCheese.cast.search")}</label>
                    <input
                      id="bc-cast-search"
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <ul className="bc-list">
                    {shown.map((item) => {
                      const on = picks.some((p) => p.item.id === item.id);
                      return (
                        <Row
                          key={item.id}
                          item={item}
                          on={on}
                          disabled={!on && (!!reading || picks.length >= MAX_STAFF)}
                          onClick={() => void choose(item)}
                        />
                      );
                    })}
                  </ul>
                </>
              )}
              {reading && <p role="status">{t("ui.bigCheese.cast.reading", { name: reading.name })}</p>}
            </section>

            {picks.map((p) => (
              <section key={p.item.id} className="bc-panel" aria-labelledby={`bc-sheet-${p.item.id}`}>
                <h2 id={`bc-sheet-${p.item.id}`} className="bc-subhead">
                  {p.item.name}
                </h2>
                <span className="bc-chip">{t("ui.bigCheese.cast.badge")}</span>
                <p className="bc-muted">{t("ui.bigCheese.cast.role")}</p>
                <div className="bc-row-meta">
                  {p.slots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="bc-btn"
                      aria-pressed={p.slot === s.id}
                      disabled={p.slot !== s.id && slots.includes(s.id)}
                      onClick={() => edit(p.item.id, { slot: s.id })}
                    >
                      {s.role}
                    </button>
                  ))}
                </div>
                <p className="bc-muted">{t("ui.bigCheese.cast.traits")}</p>
                <div className="bc-row-meta">
                  {list.traits.map((trait) => {
                    const on = p.traits.includes(trait);
                    return (
                      <button
                        key={trait}
                        type="button"
                        className="bc-btn"
                        aria-pressed={on}
                        disabled={!on && p.traits.length >= 2}
                        onClick={() =>
                          edit(p.item.id, { traits: on ? p.traits.filter((x) => x !== trait) : [...p.traits, trait] })
                        }
                      >
                        {trait}
                      </button>
                    );
                  })}
                </div>
                <div className="bc-form">
                  <label htmlFor={`bc-tone-${p.item.id}`}>{t("ui.bigCheese.cast.tone")}</label>
                  <input
                    id={`bc-tone-${p.item.id}`}
                    maxLength={40}
                    value={p.tone}
                    onChange={(event) => edit(p.item.id, { tone: event.target.value })}
                  />
                  <label htmlFor={`bc-lines-${p.item.id}`}>{t("ui.bigCheese.cast.lines")}</label>
                  <textarea
                    id={`bc-lines-${p.item.id}`}
                    rows={3}
                    value={p.lines}
                    onChange={(event) => edit(p.item.id, { lines: event.target.value })}
                  />
                </div>
                <button type="button" className="bc-btn bc-btn-quiet" onClick={() => void choose(p.item)}>
                  {t("ui.bigCheese.cast.remove")}
                </button>
              </section>
            ))}
            {!ready && <p className="bc-muted">{t("ui.bigCheese.cast.fix")}</p>}
          </>
        )}

        <button
          type="button"
          className="bc-btn bc-btn-primary"
          disabled={busy || !ready || !!reading || (!boss && picks.length === 0)}
          onClick={start}
        >
          {busy ? t("ui.bigCheese.titleScreen.starting") : t("ui.bigCheese.cast.start")}
        </button>
        <button type="button" className="bc-btn" disabled={busy} onClick={onSkip}>
          {t("ui.bigCheese.cast.skip")}
        </button>
        <button type="button" className="bc-btn bc-btn-quiet" disabled={busy} onClick={onBack}>
          {t("ui.bigCheese.cast.back")}
        </button>
      </main>
    </div>
  );
}

interface HireSheet {
  role: string;
  traits: string[];
  tone: string;
  lines: string; // one voice line per row
  core: string;
}

/** Mid-run: take on one more character, for good or as a visitor (cast.md §9). */
export function Hire({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { t } = useTranslation();
  const [list, setList] = useState<CastList | null>(null);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pick, setPick] = useState<{ item: CastItem; sheet: HireSheet } | null>(null);
  const [visitor, setVisitor] = useState(false);
  const [days, setDays] = useState(3);
  const [story, setStory] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    listCast().then(setList, (error) => setNote(errorKey(error)));
  }, []);
  useEffect(() => heading.current?.focus(), [pick]);

  async function choose(item: CastItem) {
    if (reading) return;
    setReading(true);
    setNote(null);
    try {
      const { sheet } = await readCast(ctx.run.kitId, item.id);
      setPick({ item, sheet: { ...sheet, lines: sheet.lines.join("\n") } });
    } catch (error) {
      setNote(errorKey(error));
    } finally {
      setReading(false);
    }
  }

  const sheet = pick?.sheet;
  const set = (change: Partial<NonNullable<typeof sheet>>) =>
    sheet && pick && setPick({ ...pick, sheet: { ...sheet, ...change } });
  const ready = sheet && sheet.role.trim() && sheet.traits.length > 0 && lineList(sheet.lines).length > 0;
  async function submit() {
    if (!pick || !sheet) return;
    const body = {
      engineId: pick.item.id,
      mode: story ? "story" : visitor ? "visitor" : "hire",
      ...(story && { storyRole: story }),
      ...(visitor && { days }),
      sheet: { ...sheet, role: sheet.role.trim(), lines: lineList(sheet.lines) },
    };
    if (await ctx.act("cast", body)) onClose();
  }

  const shown = (list?.characters ?? [])
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, SHOWN);
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} ref={heading}>
        {t("ui.bigCheese.cast.hireTitle")}
      </h1>
      <p>{t("ui.bigCheese.cast.hireHelp")}</p>
      {note && (
        <p role="alert" className="bc-note">
          {t(note)}
        </p>
      )}
      {!pick || !sheet ? (
        <>
          <div className="bc-form">
            <label htmlFor="bc-hire-search">{t("ui.bigCheese.cast.search")}</label>
            <input
              id="bc-hire-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <ul className="bc-list">
            {shown.map((item) => (
              <Row key={item.id} item={item} on={false} disabled={reading} onClick={() => void choose(item)} />
            ))}
          </ul>
        </>
      ) : (
        <section className="bc-panel" aria-labelledby="bc-hire-name">
          <h2 id="bc-hire-name" className="bc-subhead">
            {pick.item.name}
          </h2>
          <div className="bc-form">
            <label htmlFor="bc-hire-role">{t("ui.bigCheese.cast.hireRole")}</label>
            <input
              id="bc-hire-role"
              maxLength={60}
              value={sheet.role}
              onChange={(event) => set({ role: event.target.value })}
            />
          </div>
          <p className="bc-muted">{t("ui.bigCheese.cast.traits")}</p>
          <div className="bc-row-meta">
            {(list?.traits ?? []).map((trait) => {
              const on = sheet.traits.includes(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  className="bc-btn"
                  aria-pressed={on}
                  disabled={!on && sheet.traits.length >= 2}
                  onClick={() =>
                    set({ traits: on ? sheet.traits.filter((x) => x !== trait) : [...sheet.traits, trait] })
                  }
                >
                  {trait}
                </button>
              );
            })}
          </div>
          <div className="bc-form">
            <label htmlFor="bc-hire-tone">{t("ui.bigCheese.cast.tone")}</label>
            <input
              id="bc-hire-tone"
              maxLength={40}
              value={sheet.tone}
              onChange={(event) => set({ tone: event.target.value })}
            />
            <label htmlFor="bc-hire-lines">{t("ui.bigCheese.cast.lines")}</label>
            <textarea
              id="bc-hire-lines"
              rows={3}
              value={sheet.lines}
              onChange={(event) => set({ lines: event.target.value })}
            />
          </div>
          <div className="bc-row-meta" role="group" aria-label={t("ui.bigCheese.cast.hireStay")}>
            <button
              type="button"
              className="bc-btn"
              aria-pressed={!visitor && !story}
              onClick={() => {
                setVisitor(false);
                setStory("");
              }}
            >
              {t("ui.bigCheese.cast.hireStays")}
            </button>
            <button
              type="button"
              className="bc-btn"
              aria-pressed={visitor && !story}
              onClick={() => {
                setVisitor(true);
                setStory("");
              }}
            >
              {t("ui.bigCheese.cast.hireVisits")}
            </button>
            {["old_flame", "rival_boss", "inspector"].map((role) => (
              <button
                key={role}
                type="button"
                className="bc-btn"
                aria-pressed={story === role}
                onClick={() => {
                  setVisitor(false);
                  setStory(role);
                }}
              >
                {t(`ui.bigCheese.cast.role.${role}`)}
              </button>
            ))}
          </div>
          {visitor && (
            <div className="bc-form">
              <label htmlFor="bc-hire-days">{t("ui.bigCheese.cast.hireDays")}</label>
              <input
                id="bc-hire-days"
                type="number"
                min={1}
                max={10}
                value={days}
                onChange={(event) => setDays(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
              />
            </div>
          )}
          <button
            type="button"
            className="bc-btn bc-btn-primary"
            disabled={ctx.busy || !ready}
            onClick={() => void submit()}
          >
            {visitor ? t("ui.bigCheese.cast.hireVisitGo") : t("ui.bigCheese.cast.hireGo")}
          </button>
        </section>
      )}
      <button type="button" className="bc-btn bc-btn-quiet" onClick={pick ? () => setPick(null) : onClose}>
        {t("ui.bigCheese.cast.hireBack")}
      </button>
    </>
  );
}
