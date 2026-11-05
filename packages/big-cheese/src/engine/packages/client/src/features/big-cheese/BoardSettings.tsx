// ──────────────────────────────────────────────
// Big Cheese: the Board's settings groups (cheese-board.md section 3: Rules, Layers, Cast, Meta)
// ──────────────────────────────────────────────
// Each form builds one Set action and hands it to the Board, which previews and plays it.
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getRules, listCast, readCast, type CastItem, type RulesState } from "./api";
import type { Ctx } from "./parts";

export interface SettingAction {
  verb: string;
  input: Record<string, unknown>;
}

// Every key is a literal, so the locale validator finds it.
const LAYERS = [
  { id: "drama", key: "ui.bigCheese.board.m3.layer.drama" },
  { id: "romance", key: "ui.bigCheese.board.m3.layer.romance" },
  { id: "press", key: "ui.bigCheese.board.m3.layer.press" },
  { id: "rivals", key: "ui.bigCheese.board.m3.layer.rivals" },
  { id: "family", key: "ui.bigCheese.board.m3.layer.family" },
  { id: "crime", key: "ui.bigCheese.board.m4.layer.crime" },
  { id: "politics", key: "ui.bigCheese.board.m4.layer.politics" },
  { id: "mystery", key: "ui.bigCheese.board.m4.layer.mystery" },
  { id: "horror", key: "ui.bigCheese.board.m4.layer.horror" },
  { id: "legacy", key: "ui.bigCheese.board.m4.layer.legacy" },
  { id: "strange", key: "ui.bigCheese.board.m4.layer.strange" },
  { id: "horror", key: "ui.bigCheese.t7.layer.horror" },
  { id: "strange", key: "ui.bigCheese.t7.layer.strange" },
] as const;
// The M4 layers stay at 0 until the boss turns them on (core/layers.ts).
const OPT_IN = ["crime", "politics", "mystery", "horror", "legacy", "strange"];
const TIERS = [
  { id: "manager", key: "ui.bigCheese.board.m4.tier.manager" },
  { id: "strong_leader", key: "ui.bigCheese.board.m4.tier.strongLeader" },
  { id: "absolute", key: "ui.bigCheese.board.m4.tier.absolute" },
] as const;

const MUTATORS = [
  { id: "everyone_hates_you", key: "ui.bigCheese.board.m3.mutator.everyone_hates_you" },
  { id: "double_drama", key: "ui.bigCheese.board.m3.mutator.double_drama" },
  { id: "inherited_mess", key: "ui.bigCheese.board.m3.mutator.inherited_mess" },
  { id: "speed_run", key: "ui.bigCheese.board.m3.mutator.speed_run" },
  { id: "silent_boss", key: "ui.bigCheese.board.m3.mutator.silent_boss" },
] as const;
const DIFFICULTIES = [
  { id: "easy", key: "ui.bigCheese.board.m3.difficulty.easy" },
  { id: "normal", key: "ui.bigCheese.board.m3.difficulty.normal" },
  { id: "hard", key: "ui.bigCheese.board.m3.difficulty.hard" },
] as const;
const STORYTELLERS = [
  { id: "calm", key: "ui.bigCheese.kitEditor.storyteller.calm" },
  { id: "classic", key: "ui.bigCheese.kitEditor.storyteller.classic" },
  { id: "chaos", key: "ui.bigCheese.kitEditor.storyteller.chaos" },
] as const;
const MODES = [
  { id: "hire", key: "ui.bigCheese.board.m3.cast.hire" },
  { id: "visitor", key: "ui.bigCheese.board.m3.cast.visitor" },
] as const;

// The preview cards name layers and mutators with these.
export const LAYER_KEYS: Record<string, string> = Object.fromEntries(LAYERS.map((l) => [l.id, l.key]));
export const MUTATOR_KEYS: Record<string, string> = Object.fromEntries(MUTATORS.map((m) => [m.id, m.key]));

const POWER = [
  { k: "fear", key: "ui.bigCheese.board.m3.power.fear" },
  { k: "love", key: "ui.bigCheese.board.m3.power.love" },
  { k: "legitimacy", key: "ui.bigCheese.board.m3.power.legitimacy" },
] as const;

const num = (v: string) => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));

export function BoardSettings({
  ctx,
  onAdd,
  onEditKit,
  onError,
}: {
  ctx: Ctx;
  onAdd: (a: SettingAction) => void;
  onEditKit: () => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useTranslation();
  const { run, kit, busy } = ctx;
  const g = run.game;
  const [rules, setRules] = useState<RulesState | null>(null);
  const [cast, setCast] = useState<CastItem[]>([]);
  const [layer, setLayer] = useState<{ id: string; dial: string }>({ id: "romance", dial: "50" });
  const [system, setSystem] = useState({ id: "", on: "true" });
  const [rule, setRule] = useState({ id: "", option: "" });
  const [dials, setDials] = useState({ difficulty: g.difficulty ?? "normal", storyteller: g.storyteller ?? "classic" });
  const [mutator, setMutator] = useState("everyone_hates_you");
  const [power, setPower] = useState({ fear: "", love: "", legitimacy: "" });
  const [tier, setTier] = useState<string>(g.authority ?? "manager");
  const [adult, setAdult] = useState({ on: "true", confirm: false });
  const [card, setCard] = useState({ id: "", mode: "hire" });
  const [leaver, setLeaver] = useState("");

  useEffect(() => {
    getRules(run.id)
      .then(setRules)
      .catch(() => setRules(null));
    listCast()
      .then((r) => setCast(r.characters))
      .catch(() => setCast([]));
  }, [run.id]);

  const systems = Object.entries(g.systems ?? {});
  const chosenRule = rules?.rules.find((r) => r.id === rule.id);
  const library = kit.people.filter((p) => p.library && g.people[p.id]?.status === "active");
  const mutators = g.mutators ?? [];

  const group = (title: string, children: ReactNode) => (
    <section className="bc-section" aria-label={title}>
      <h3 className="bc-subhead">{title}</h3>
      {children}
    </section>
  );
  const field = (label: string, control: ReactNode) => (
    <label>
      <span>{label}</span>
      {control}
    </label>
  );
  const submit = (action: () => void | Promise<void>) => (event: React.FormEvent) => {
    event.preventDefault();
    void Promise.resolve(action()).catch(onError);
  };
  const add = (label: string, disabled = false) => (
    <button type="submit" className="bc-btn bc-btn-primary" disabled={busy || disabled}>
      {label}
    </button>
  );
  const select = (value: string, onChange: (v: string) => void, options: { id: string; label: string }[]) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const onOff = [
    { id: "true", label: t("ui.bigCheese.board.m3.on") },
    { id: "false", label: t("ui.bigCheese.board.m3.off") },
  ];

  return (
    <>
      {group(
        t("ui.bigCheese.board.m3.layers"),
        <form
          className="bc-form"
          onSubmit={submit(() => onAdd({ verb: "layer.set", input: { layer: layer.id, dial: num(layer.dial) } }))}
        >
          {field(
            t("ui.bigCheese.board.m3.layer"),
            select(
              layer.id,
              (id) => setLayer({ id, dial: String(g.layers?.[id] ?? (OPT_IN.includes(id) ? 0 : 50)) }),
              LAYERS.map((l) => ({ id: l.id, label: t(l.key) })),
            ),
          )}
          {field(
            t("ui.bigCheese.board.m3.dial"),
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={layer.dial}
              onChange={(e) => setLayer({ ...layer, dial: e.target.value })}
            />,
          )}
          {add(t("ui.bigCheese.board.m3.add"))}
        </form>,
      )}
      {systems.length > 0 &&
        group(
          t("ui.bigCheese.board.m3.systems"),
          <form
            className="bc-form"
            onSubmit={submit(() =>
              onAdd({ verb: "system.set", input: { system: system.id || systems[0]![0], on: system.on === "true" } }),
            )}
          >
            {field(
              t("ui.bigCheese.board.m3.system"),
              select(
                system.id || systems[0]![0],
                (id) => setSystem({ ...system, id }),
                systems.map(([id, s]) => ({
                  id,
                  label: `${(s as { name?: string }).name ?? id}${s.on ? "" : ` (${t("ui.bigCheese.board.m3.off")})`}`,
                })),
              ),
            )}
            {field(
              t("ui.bigCheese.board.m3.state"),
              select(system.on, (on) => setSystem({ ...system, on }), onOff),
            )}
            {add(t("ui.bigCheese.board.m3.add"))}
          </form>,
        )}
      {rules &&
        rules.rules.length > 0 &&
        group(
          t("ui.bigCheese.board.m3.rules"),
          <form
            className="bc-form"
            onSubmit={submit(() => {
              const r = rules.rules.find((x) => x.id === (rule.id || rules.rules[0]!.id))!;
              onAdd({
                verb: r.decree && g.authority === "absolute" ? "decree" : "rule.set",
                input: { rule: r.id, option: rule.option || r.options[0] },
              });
            })}
          >
            {field(
              t("ui.bigCheese.board.m3.rule"),
              select(
                rule.id || rules.rules[0]!.id,
                (id) => setRule({ id, option: "" }),
                rules.rules.map((r) => ({ id: r.id, label: r.text })),
              ),
            )}
            {field(
              t("ui.bigCheese.board.m3.option"),
              select(
                rule.option || (chosenRule ?? rules.rules[0]!).options[0]!,
                (option) => setRule({ ...rule, option }),
                (chosenRule ?? rules.rules[0]!).options.map((o) => ({ id: o, label: o })),
              ),
            )}
            <p className="bc-muted">{t("ui.bigCheese.board.m3.ruleFree")}</p>
            {add(t("ui.bigCheese.board.m3.add"))}
          </form>,
        )}
      {group(
        t("ui.bigCheese.board.m4.tierTitle"),
        <form className="bc-form" onSubmit={submit(() => onAdd({ verb: "authority.set", input: { tier } }))}>
          {field(
            t("ui.bigCheese.board.m4.tierField"),
            select(
              tier,
              setTier,
              TIERS.map((x) => ({ id: x.id, label: t(x.key) })),
            ),
          )}
          {add(t("ui.bigCheese.board.m3.add"), tier === g.authority)}
        </form>,
      )}
      {g.authority === "absolute" &&
        group(
          t("ui.bigCheese.board.m3.authority"),
          <form
            className="bc-form"
            onSubmit={submit(() =>
              onAdd({
                verb: "authority.set",
                input: Object.fromEntries(
                  Object.entries(power)
                    .filter(([, v]) => v.trim() !== "")
                    .map(([k, v]) => [k, num(v)]),
                ),
              }),
            )}
          >
            {POWER.map(({ k, key }) =>
              field(
                t(key),
                <input
                  key={k}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  placeholder={String(k === "legitimacy" ? (rules?.legitimacy ?? "") : (rules?.power[k] ?? ""))}
                  value={power[k]}
                  onChange={(e) => setPower({ ...power, [k]: e.target.value })}
                />,
              ),
            )}
            {add(
              t("ui.bigCheese.board.m3.add"),
              Object.values(power).every((v) => v.trim() === ""),
            )}
          </form>,
        )}
      {group(
        t("ui.bigCheese.board.m3.dials"),
        <form
          className="bc-form"
          onSubmit={submit(() =>
            onAdd({ verb: "dials.set", input: { difficulty: dials.difficulty, storyteller: dials.storyteller } }),
          )}
        >
          {field(
            t("ui.bigCheese.board.m3.difficulty"),
            select(
              dials.difficulty,
              (difficulty) => setDials({ ...dials, difficulty }),
              DIFFICULTIES.map((d) => ({ id: d.id, label: t(d.key) })),
            ),
          )}
          {field(
            t("ui.bigCheese.board.m3.storyteller"),
            select(
              dials.storyteller,
              (storyteller) => setDials({ ...dials, storyteller }),
              STORYTELLERS.map((d) => ({ id: d.id, label: t(d.key) })),
            ),
          )}
          {add(t("ui.bigCheese.board.m3.add"))}
        </form>,
      )}
      {group(
        t("ui.bigCheese.board.m3.mutators"),
        <form
          className="bc-form"
          onSubmit={submit(() => onAdd({ verb: "mutator.set", input: { mutator, on: !mutators.includes(mutator) } }))}
        >
          {field(
            t("ui.bigCheese.board.m3.mutator"),
            select(
              mutator,
              setMutator,
              MUTATORS.map((m) => ({
                id: m.id,
                label: `${t(m.key)} (${t(mutators.includes(m.id) ? "ui.bigCheese.board.m3.on" : "ui.bigCheese.board.m3.off")})`,
              })),
            ),
          )}
          {add(t(mutators.includes(mutator) ? "ui.bigCheese.board.m3.switchOff" : "ui.bigCheese.board.m3.switchOn"))}
        </form>,
      )}
      {group(
        t("ui.bigCheese.board.m3.adult"),
        <form
          className="bc-form"
          onSubmit={submit(() =>
            onAdd({
              verb: "adult.set",
              input: { on: adult.on === "true", confirm: adult.on === "true" ? adult.confirm : undefined },
            }),
          )}
        >
          <p className="bc-muted">{t("ui.bigCheese.adult.help")}</p>
          {field(
            t("ui.bigCheese.board.m3.state"),
            select(adult.on, (on) => setAdult({ ...adult, on }), onOff),
          )}
          {adult.on === "true" && !g.adult && (
            <label>
              <input
                type="checkbox"
                checked={adult.confirm}
                onChange={(e) => setAdult({ ...adult, confirm: e.target.checked })}
              />
              <span>{t("ui.bigCheese.board.m3.adultConfirm")}</span>
            </label>
          )}
          {add(t("ui.bigCheese.board.m3.add"), adult.on === "true" && !g.adult && !adult.confirm)}
        </form>,
      )}
      {group(
        t("ui.bigCheese.board.m3.cast"),
        <>
          <form
            className="bc-form"
            onSubmit={submit(async () => {
              const characterId = card.id || cast[0]?.id;
              if (!characterId) return;
              const read = await readCast(run.kitId, characterId);
              onAdd({ verb: "cast.insert", input: { engineId: characterId, mode: card.mode, sheet: read.sheet } });
            })}
          >
            {field(
              t("ui.bigCheese.board.m3.card"),
              select(
                card.id || cast[0]?.id || "",
                (id) => setCard({ ...card, id }),
                cast.map((c) => ({ id: c.id, label: c.name })),
              ),
            )}
            {field(
              t("ui.bigCheese.board.m3.castAs"),
              select(
                card.mode,
                (mode) => setCard({ ...card, mode }),
                MODES.map((m) => ({ id: m.id, label: t(m.key) })),
              ),
            )}
            {add(t("ui.bigCheese.board.m3.add"), cast.length === 0)}
          </form>
          {library.length > 0 && (
            <form
              className="bc-form"
              onSubmit={submit(() => onAdd({ verb: "cast.remove", input: { person: leaver || library[0]!.id } }))}
            >
              {field(
                t("ui.bigCheese.board.m3.leaver"),
                select(
                  leaver || library[0]!.id,
                  setLeaver,
                  library.map((p) => ({ id: p.id, label: p.name })),
                ),
              )}
              {add(t("ui.bigCheese.board.m3.remove"))}
            </form>
          )}
        </>,
      )}
      {group(
        t("ui.bigCheese.board.m3.meta"),
        <button type="button" className="bc-btn" disabled={busy} onClick={onEditKit}>
          {t("ui.bigCheese.preview.editKit")}
        </button>,
      )}
    </>
  );
}
