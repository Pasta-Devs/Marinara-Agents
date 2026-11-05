// ──────────────────────────────────────────────
// Big Cheese: the New place screen (ui.md §5.2). One wish line, a few choices, then the Preview
// of the drafted place. Parts of the draft can be rerolled there.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  draftPlace,
  errorKey,
  listCast,
  type CastItem,
  type CastList,
  type DraftPart,
  type PreviewKit,
  type StartBody,
  type WishBody,
} from "./api";
import { Preview } from "./Preview";
import { BUNDLES } from "./bundles";

const MAX_STAFF = 3;

function Choice<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: [V, string][];
  onChange: (value: V) => void;
}) {
  return (
    <div role="group" aria-label={label} className="bc-form">
      <span>{label}</span>
      <div className="bc-cards">
        {options.map(([v, text]) => (
          <button key={v} type="button" className="bc-btn" aria-pressed={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Applies the picked bundle's dials to the drafted kit. */
const withBundle = (kit: unknown, id: string) => {
  const b = BUNDLES.find((x) => x.id === id);
  const k = kit as { layers?: Record<string, number> };
  return b ? { ...k, layers: { ...k.layers, ...b.layers } } : kit;
};

export function NewPlace({
  busy,
  failure,
  onTake,
  onBack,
}: {
  busy: boolean;
  failure: string | null;
  onTake: (kit: unknown, body: StartBody) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [wish, setWish] = useState("");
  const [size, setSize] = useState<WishBody["size"]>("medium");
  const [storyteller, setStoryteller] = useState<WishBody["storyteller"]>("classic");
  const [authority, setAuthority] = useState<WishBody["authority"]>("manager");
  const [boss, setBoss] = useState("");
  const [bundle, setBundle] = useState(""); // M4 T7: one-tap story mix, applied to the draft kit on take
  const [staff, setStaff] = useState<CastItem[]>([]);
  const [cast, setCast] = useState<CastList | null>(null);
  const [draft, setDraft] = useState<{ kit: unknown; view: PreviewKit } | null>(null);
  const [working, setWorking] = useState<DraftPart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => void listCast().then(setCast, () => setCast(null)), []);
  useEffect(() => heading.current?.focus(), [draft]);
  const picked = useMemo<StartBody | undefined>(() => (boss ? { boss } : undefined), [boss]);

  async function make(part: DraftPart) {
    setWorking(part);
    setError(null);
    try {
      const body: WishBody = { wish, size, storyteller, authority, fixed: staff.map((s) => s.name), part };
      if (part !== "all") body.kit = draft?.kit;
      setDraft(await draftPlace(body));
    } catch (e) {
      setError(errorKey(e)); // the wish stays in the form, and the old draft stays on screen
    } finally {
      setWorking(null);
    }
  }

  if (draft)
    return (
      <Preview
        kitId=""
        draft={draft.view}
        cast={picked}
        busy={busy || !!working}
        failure={error ? t(error) : failure}
        rerolling={working}
        onReroll={(part) => void make(part)}
        onTake={(body) => onTake(withBundle(draft.kit, bundle), body)}
        onCast={() => {}}
        onBack={() => setDraft(null)}
      />
    );

  const free = cast?.characters.filter((c) => !staff.some((s) => s.id === c.id)) ?? [];
  return (
    <div className="bc-root" aria-busy={!!working}>
      <header className="bc-top" />
      <main className="bc-main">
        <h1 className="bc-heading" tabIndex={-1} ref={heading}>
          {t("ui.bigCheese.newPlace.title")}
        </h1>
        <form
          className="bc-form"
          onSubmit={(event) => {
            event.preventDefault();
            void make("all");
          }}
        >
          <label htmlFor="bc-np-wish">{t("ui.bigCheese.newPlace.wish")}</label>
          <textarea
            id="bc-np-wish"
            maxLength={400}
            rows={3}
            value={wish}
            disabled={!!working}
            placeholder={t("ui.bigCheese.newPlace.wishHint")}
            onChange={(event) => setWish(event.target.value)}
          />
          <Choice
            label={t("ui.bigCheese.newPlace.size")}
            value={size}
            onChange={setSize}
            options={[
              ["small", t("ui.bigCheese.newPlace.sizeSmall")],
              ["medium", t("ui.bigCheese.newPlace.sizeMedium")],
              ["large", t("ui.bigCheese.newPlace.sizeLarge")],
            ]}
          />
          <Choice
            label={t("ui.bigCheese.newPlace.pace")}
            value={storyteller}
            onChange={setStoryteller}
            options={[
              ["classic", t("ui.bigCheese.newPlace.paceClassic")],
              ["calm", t("ui.bigCheese.newPlace.paceCalm")],
              ["chaos", t("ui.bigCheese.newPlace.paceChaos")],
            ]}
          />
          <label htmlFor="bc-np-boss">{t("ui.bigCheese.newPlace.boss")}</label>
          <select id="bc-np-boss" value={boss} disabled={!!working} onChange={(event) => setBoss(event.target.value)}>
            <option value="">{t("ui.bigCheese.newPlace.bossNone")}</option>
            {cast?.personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label htmlFor="bc-np-staff">{t("ui.bigCheese.newPlace.staff")}</label>
          <select
            id="bc-np-staff"
            value=""
            disabled={!!working || staff.length >= MAX_STAFF}
            onChange={(event) => {
              const item = free.find((c) => c.id === event.target.value);
              if (item) setStaff((now) => [...now, item]);
            }}
          >
            <option value="">{t("ui.bigCheese.newPlace.staffAdd")}</option>
            {free.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {staff.length > 0 && (
            <ul className="bc-cards">
              {staff.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="bc-btn bc-btn-quiet"
                    aria-label={t("ui.bigCheese.newPlace.staffRemove", { name: s.name })}
                    onClick={() => setStaff((now) => now.filter((x) => x.id !== s.id))}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary>{t("ui.bigCheese.newPlace.more")}</summary>
            <Choice
              label={t("ui.bigCheese.newPlace.authority")}
              value={authority}
              onChange={setAuthority}
              options={[
                ["manager", t("ui.bigCheese.newPlace.authorityManager")],
                ["strong_leader", t("ui.bigCheese.newPlace.authorityStrong")],
                ["absolute", t("ui.bigCheese.newPlace.authorityAbsolute")],
              ]}
            />
            <Choice
              label={t("ui.bigCheese.t7.bundles")}
              value={bundle}
              options={[
                ["", t("ui.bigCheese.t7.bundleNone")],
                ...BUNDLES.map((b): [string, string] => [b.id, t(b.key)]),
              ]}
              onChange={setBundle}
            />
          </details>
          {working && (
            <p role="status" className="bc-skeleton">
              {t("ui.bigCheese.newPlace.drawing")}
            </p>
          )}
          {error && (
            <p role="alert" className="bc-note">
              {t("ui.bigCheese.newPlace.failed")} {t(error)}
            </p>
          )}
          <button type="submit" className="bc-btn bc-btn-primary" disabled={!!working}>
            {t("ui.bigCheese.newPlace.show")}
          </button>
          <button type="button" className="bc-btn bc-btn-quiet" disabled={!!working} onClick={onBack}>
            {t("ui.bigCheese.newPlace.back")}
          </button>
        </form>
      </main>
    </div>
  );
}
