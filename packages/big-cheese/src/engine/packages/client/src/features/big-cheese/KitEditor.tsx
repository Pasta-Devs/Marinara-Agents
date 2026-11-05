// ──────────────────────────────────────────────
// Big Cheese: the Kit editor (ui.md section 5.3, modules.md section 1)
// ──────────────────────────────────────────────
// Seven tabs over one kit. Saving goes to the server, which checks and fixes the kit like an import.
// A built-in kit opens as a copy: saving it makes a new saved kit.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorKey, getKit, saveKit } from "./api";

type Item = { id: string; name?: string; text?: string; [key: string]: unknown };
interface EditKit {
  name: string;
  premise: string;
  bossTitle: string;
  boss: { name: string; about: string };
  authority: string;
  storyteller: string;
  meters: Record<string, { label: string; start: number }>;
  extras?: { id: string; label: string; main: string; value: number }[];
  rooms: Item[];
  people: (Item & { role: string; deputy: boolean })[];
  houseRules?: (Item & { options: string[] })[];
  systems: { kind: string; name: string; text: string }[];
  layers: Record<string, number>;
  scenario?: { goal: string };
  [key: string]: unknown;
}

// Each key is a literal, so the locale validator finds it.
const TABS = [
  { id: "place", key: "ui.bigCheese.kitEditor.tab.place" },
  { id: "meters", key: "ui.bigCheese.kitEditor.tab.meters" },
  { id: "rooms", key: "ui.bigCheese.kitEditor.tab.rooms" },
  { id: "people", key: "ui.bigCheese.kitEditor.tab.people" },
  { id: "rules", key: "ui.bigCheese.kitEditor.tab.rules" },
  { id: "systems", key: "ui.bigCheese.kitEditor.tab.systems" },
  { id: "layers", key: "ui.bigCheese.kitEditor.tab.layers" },
] as const;
const METERS = [
  { id: "money", key: "ui.bigCheese.kitEditor.meter.money" },
  { id: "output", key: "ui.bigCheese.kitEditor.meter.output" },
  { id: "people", key: "ui.bigCheese.kitEditor.meter.people" },
  { id: "standing", key: "ui.bigCheese.kitEditor.meter.standing" },
] as const;
const LAYERS = [
  { id: "drama", key: "ui.bigCheese.kitEditor.layer.drama" },
  { id: "romance", key: "ui.bigCheese.kitEditor.layer.romance" },
  { id: "press", key: "ui.bigCheese.kitEditor.layer.press" },
  { id: "rivals", key: "ui.bigCheese.kitEditor.layer.rivals" },
  { id: "family", key: "ui.bigCheese.kitEditor.layer.family" },
] as const;
const KINDS = [
  { id: "project", key: "ui.bigCheese.kitEditor.kind.project" },
  { id: "event", key: "ui.bigCheese.kitEditor.kind.event" },
  { id: "season", key: "ui.bigCheese.kitEditor.kind.season" },
] as const;
const ROOM_KINDS = [
  { id: "work", key: "ui.bigCheese.kitEditor.roomKind.work" },
  { id: "social", key: "ui.bigCheese.kitEditor.roomKind.social" },
  { id: "outside", key: "ui.bigCheese.kitEditor.roomKind.outside" },
  { id: "private", key: "ui.bigCheese.kitEditor.roomKind.private" },
  { id: "hidden", key: "ui.bigCheese.kitEditor.roomKind.hidden" },
] as const;
const AUTHORITY = [
  { id: "manager", key: "ui.bigCheese.kitEditor.authority.manager" },
  { id: "strong_leader", key: "ui.bigCheese.kitEditor.authority.strong_leader" },
  { id: "absolute", key: "ui.bigCheese.kitEditor.authority.absolute" },
] as const;
const STORYTELLER = [
  { id: "calm", key: "ui.bigCheese.kitEditor.storyteller.calm" },
  { id: "classic", key: "ui.bigCheese.kitEditor.storyteller.classic" },
  { id: "chaos", key: "ui.bigCheese.kitEditor.storyteller.chaos" },
] as const;

const MAX_EXTRAS = 2;
const num = (v: string) => Math.min(100, Math.max(0, Math.round(Number(v)) || 0));

export function KitEditor({ kitId, onSaved, onBack }: { kitId: string; onSaved: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const [kit, setKit] = useState<EditKit | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("place");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    getKit(kitId)
      .then((k) => setKit(k as EditKit))
      .catch((error) => setFailure(errorKey(error)));
  }, [kitId]);
  useEffect(() => heading.current?.focus(), []);

  if (!kit)
    return (
      <div className="bc-root" aria-busy={!failure}>
        <main className="bc-main">
          <h1 className="bc-heading" tabIndex={-1} ref={heading}>
            {t("ui.bigCheese.kitEditor.title")}
          </h1>
          {failure ? (
            <p role="alert" className="bc-note">
              {t(failure)}
            </p>
          ) : (
            <p className="bc-skeleton">{t("ui.bigCheese.kitEditor.loading")}</p>
          )}
          <button type="button" className="bc-btn bc-btn-quiet" onClick={onBack}>
            {t("ui.bigCheese.kitEditor.back")}
          </button>
        </main>
      </div>
    );

  const patch = (p: Partial<EditKit>) => setKit({ ...kit, ...p });
  // Replace one list entry, or drop it when `next` is null.
  const edit = <K extends "rooms" | "people" | "houseRules" | "systems" | "extras">(
    key: K,
    i: number,
    next: object | null,
  ) => {
    const list = [...((kit[key] as object[] | undefined) ?? [])];
    if (next) list[i] = { ...list[i], ...next };
    else list.splice(i, 1);
    patch({ [key]: list } as Partial<EditKit>);
  };
  const add = (key: "rooms" | "people" | "houseRules" | "systems" | "extras", item: object) =>
    patch({ [key]: [...((kit[key] as object[] | undefined) ?? []), item] } as Partial<EditKit>);
  const field = (id: string, label: string, value: string, onChange: (v: string) => void, max = 200) => (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
    </>
  );
  const pick = (
    id: string,
    label: string,
    value: string,
    opts: readonly { id: string; key: string }[],
    onChange: (v: string) => void,
  ) => (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {t(o.key)}
          </option>
        ))}
      </select>
    </>
  );
  const numField = (id: string, label: string, value: number, onChange: (v: number) => void) => (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min={0} max={100} value={value} onChange={(e) => onChange(num(e.target.value))} />
    </>
  );
  const remove = (onClick: () => void, label: string) => (
    <button type="button" className="bc-btn bc-btn-quiet" onClick={onClick}>
      {t("ui.bigCheese.kitEditor.remove", { name: label })}
    </button>
  );

  async function save() {
    setBusy(true);
    setFailure(null);
    setReasons(null);
    try {
      await saveKit(kit);
      onSaved();
    } catch (error) {
      // ponytail: the server's reasons are English; localise them when they get codes.
      if (error instanceof Error && error.message) setReasons(error.message);
      else setFailure(errorKey(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bc-root" aria-busy={busy}>
      <header className="bc-top" />
      <main className="bc-main">
        <h1 className="bc-heading" tabIndex={-1} ref={heading}>
          {t("ui.bigCheese.kitEditor.title")}
        </h1>
        <div role="tablist" aria-label={t("ui.bigCheese.kitEditor.tabs")} className="bc-row-meta">
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              className="bc-btn bc-btn-quiet"
              onClick={() => setTab(x.id)}
            >
              {t(x.key)}
            </button>
          ))}
        </div>
        <section className="bc-section bc-form" role="tabpanel">
          {tab === "place" && (
            <>
              {field("kit-name", t("ui.bigCheese.kitEditor.name"), kit.name, (name) => patch({ name }), 80)}
              {field(
                "kit-premise",
                t("ui.bigCheese.kitEditor.premise"),
                kit.premise,
                (premise) => patch({ premise }),
                600,
              )}
              {field(
                "kit-boss-title",
                t("ui.bigCheese.kitEditor.bossTitle"),
                kit.bossTitle,
                (bossTitle) => patch({ bossTitle }),
                60,
              )}
              {field(
                "kit-boss-name",
                t("ui.bigCheese.kitEditor.bossName"),
                kit.boss.name,
                (name) => patch({ boss: { ...kit.boss, name } }),
                60,
              )}
              {field(
                "kit-boss-about",
                t("ui.bigCheese.kitEditor.bossAbout"),
                kit.boss.about,
                (about) => patch({ boss: { ...kit.boss, about } }),
                400,
              )}
              {pick(
                "kit-authority",
                t("ui.bigCheese.kitEditor.authorityLabel"),
                kit.authority,
                AUTHORITY,
                (authority) => patch({ authority }),
              )}
              {pick(
                "kit-storyteller",
                t("ui.bigCheese.kitEditor.storytellerLabel"),
                kit.storyteller,
                STORYTELLER,
                (storyteller) => patch({ storyteller }),
              )}
              <label htmlFor="kit-scenario">
                <input
                  id="kit-scenario"
                  type="checkbox"
                  checked={!!kit.scenario}
                  onChange={(e) => patch({ scenario: e.target.checked ? { goal: "" } : undefined })}
                />{" "}
                {t("ui.bigCheese.kitEditor.scenario")}
              </label>
              {kit.scenario && (
                <>
                  <p className="bc-muted">{t("ui.bigCheese.kitEditor.scenarioHelp")}</p>
                  {field(
                    "kit-goal",
                    t("ui.bigCheese.kitEditor.goal"),
                    kit.scenario.goal,
                    (goal) => patch({ scenario: { goal } }),
                    200,
                  )}
                </>
              )}
            </>
          )}
          {tab === "meters" && (
            <>
              {METERS.map((m) => (
                <div key={m.id}>
                  {field(
                    `kit-m-${m.id}`,
                    t(m.key),
                    kit.meters[m.id]?.label ?? "",
                    (label) => patch({ meters: { ...kit.meters, [m.id]: { ...kit.meters[m.id], label } } }),
                    40,
                  )}
                  {numField(
                    `kit-ms-${m.id}`,
                    t("ui.bigCheese.kitEditor.start"),
                    kit.meters[m.id]?.start ?? 50,
                    (start) => patch({ meters: { ...kit.meters, [m.id]: { ...kit.meters[m.id], start } } }),
                  )}
                </div>
              ))}
              <h2 className="bc-subhead">{t("ui.bigCheese.kitEditor.extras")}</h2>
              {(kit.extras ?? []).map((x, i) => (
                <div key={i}>
                  {field(
                    `kit-x-${i}`,
                    t("ui.bigCheese.kitEditor.extraName"),
                    x.label,
                    (label) => edit("extras", i, { label, id: label || x.id }),
                    40,
                  )}
                  {pick(`kit-xm-${i}`, t("ui.bigCheese.kitEditor.extraMain"), x.main, METERS, (main) =>
                    edit("extras", i, { main }),
                  )}
                  {numField(`kit-xv-${i}`, t("ui.bigCheese.kitEditor.start"), x.value, (value) =>
                    edit("extras", i, { value }),
                  )}
                  {remove(() => edit("extras", i, null), x.label)}
                </div>
              ))}
              {(kit.extras?.length ?? 0) < MAX_EXTRAS && (
                <button
                  type="button"
                  className="bc-btn"
                  onClick={() =>
                    add("extras", {
                      id: `extra-${(kit.extras?.length ?? 0) + 1}`,
                      label: "",
                      main: "standing",
                      value: 50,
                    })
                  }
                >
                  {t("ui.bigCheese.kitEditor.addExtra")}
                </button>
              )}
            </>
          )}
          {tab === "rooms" && (
            <>
              {kit.rooms.map((r, i) => (
                <div key={r.id}>
                  {field(
                    `kit-r-${i}`,
                    t("ui.bigCheese.kitEditor.roomName"),
                    String(r.name ?? ""),
                    (name) => edit("rooms", i, { name }),
                    60,
                  )}
                  {field(
                    `kit-rt-${i}`,
                    t("ui.bigCheese.kitEditor.roomText"),
                    String(r.text ?? ""),
                    (text) => edit("rooms", i, { text }),
                    200,
                  )}
                  {pick(
                    `kit-rk-${i}`,
                    t("ui.bigCheese.kitEditor.roomKindLabel"),
                    String(r.kind ?? "work"),
                    ROOM_KINDS,
                    (kind) => edit("rooms", i, { kind }),
                  )}
                  {remove(() => edit("rooms", i, null), String(r.name))}
                </div>
              ))}
              <button
                type="button"
                className="bc-btn"
                onClick={() =>
                  add("rooms", {
                    id: `room-${kit.rooms.length + 1}`,
                    name: t("ui.bigCheese.kitEditor.newRoom"),
                    kind: "work",
                    condition: 60,
                    text: "",
                  })
                }
              >
                {t("ui.bigCheese.kitEditor.addRoom")}
              </button>
            </>
          )}
          {tab === "people" && (
            <>
              {kit.people.map((p, i) => (
                <div key={p.id}>
                  {field(
                    `kit-p-${i}`,
                    t("ui.bigCheese.kitEditor.personName"),
                    String(p.name ?? ""),
                    (name) => edit("people", i, { name }),
                    60,
                  )}
                  {field(
                    `kit-pr-${i}`,
                    t("ui.bigCheese.kitEditor.personRole"),
                    p.role,
                    (role) => edit("people", i, { role }),
                    60,
                  )}
                  <label htmlFor={`kit-pd-${i}`}>
                    <input
                      id={`kit-pd-${i}`}
                      type="radio"
                      name="kit-deputy"
                      checked={p.deputy}
                      onChange={() => patch({ people: kit.people.map((x, j) => ({ ...x, deputy: i === j })) })}
                    />{" "}
                    {t("ui.bigCheese.kitEditor.deputy")}
                  </label>
                  {!p.deputy && remove(() => edit("people", i, null), String(p.name))}
                </div>
              ))}
              <button
                type="button"
                className="bc-btn"
                onClick={() =>
                  add("people", {
                    id: `person-${kit.people.length + 1}`,
                    name: t("ui.bigCheese.kitEditor.newPerson"),
                    role: "",
                    deputy: false,
                  })
                }
              >
                {t("ui.bigCheese.kitEditor.addPerson")}
              </button>
            </>
          )}
          {tab === "rules" && (
            <>
              {(kit.houseRules ?? []).map((r, i) => (
                <div key={r.id}>
                  {field(
                    `kit-hr-${i}`,
                    t("ui.bigCheese.kitEditor.ruleText"),
                    String(r.text ?? ""),
                    (text) => edit("houseRules", i, { text }),
                    200,
                  )}
                  {field(
                    `kit-ho-${i}`,
                    t("ui.bigCheese.kitEditor.ruleOptions"),
                    r.options.join(", "),
                    (v) =>
                      edit("houseRules", i, {
                        options: v
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }),
                    200,
                  )}
                  {remove(() => edit("houseRules", i, null), String(r.text))}
                </div>
              ))}
              <button
                type="button"
                className="bc-btn"
                onClick={() =>
                  add("houseRules", {
                    id: `rule-${(kit.houseRules?.length ?? 0) + 1}`,
                    text: "",
                    options: [],
                    touches: [],
                  })
                }
              >
                {t("ui.bigCheese.kitEditor.addRule")}
              </button>
            </>
          )}
          {tab === "systems" && (
            <>
              <p className="bc-muted">{t("ui.bigCheese.kitEditor.systemsHelp")}</p>
              {kit.systems.map((s, i) => (
                <div key={i}>
                  {pick(`kit-sk-${i}`, t("ui.bigCheese.kitEditor.systemKind"), s.kind, KINDS, (kind) =>
                    edit("systems", i, { kind }),
                  )}
                  {field(
                    `kit-sn-${i}`,
                    t("ui.bigCheese.kitEditor.systemName"),
                    s.name,
                    (name) => edit("systems", i, { name }),
                    40,
                  )}
                  {field(
                    `kit-st-${i}`,
                    t("ui.bigCheese.kitEditor.systemText"),
                    s.text,
                    (text) => edit("systems", i, { text }),
                    300,
                  )}
                  {remove(() => edit("systems", i, null), s.name)}
                </div>
              ))}
              <button
                type="button"
                className="bc-btn"
                onClick={() =>
                  add("systems", { kind: "project", name: t("ui.bigCheese.kitEditor.newSystem"), text: "" })
                }
              >
                {t("ui.bigCheese.kitEditor.addSystem")}
              </button>
            </>
          )}
          {tab === "layers" && (
            <>
              <p className="bc-muted">{t("ui.bigCheese.kitEditor.layersHelp")}</p>
              {LAYERS.map((l) =>
                numField(`kit-l-${l.id}`, t(l.key), kit.layers[l.id] ?? 0, (v) =>
                  patch({ layers: { ...kit.layers, [l.id]: v } }),
                ),
              )}
            </>
          )}
        </section>
        {failure && (
          <p role="alert" className="bc-note">
            {t(failure)}
          </p>
        )}
        {reasons && (
          <p role="alert" className="bc-note">
            {reasons}
          </p>
        )}
        <button type="button" className="bc-btn bc-btn-primary" disabled={busy} onClick={() => void save()}>
          {t("ui.bigCheese.kitEditor.save")}
        </button>
        <button type="button" className="bc-btn bc-btn-quiet" disabled={busy} onClick={onBack}>
          {t("ui.bigCheese.kitEditor.back")}
        </button>
      </main>
    </div>
  );
}
