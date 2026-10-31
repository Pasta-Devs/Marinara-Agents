// ──────────────────────────────────────────────
// Otome Forge: a love interest's character bible, behind a "Show spoilers" gate, readable and editable as a form.
// A card's canon wins over the bible; an edit steers the story from then on. The editor checks the bible's rules
// (SH/bible.ts: adults only, no school roles, a secret at stage 4…) before it saves, and names the one an edit breaks;
// the server checks every save again.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookLock, Eye, Heart, Info, PencilLine, Plus, RotateCcw, Save, Trash } from "lucide-react";
import { otomeErrorCode, useOtomeApi } from "../api";
import { Avatar } from "../components/Avatar";
import { RetryNotice } from "../components/RetryNotice";
import { useCharacterOptions } from "../hooks/use-engine-resources";
import { bibleQueryKey, patchRun, runQueryKey, useRun } from "../hooks/use-run";
import { accentOf } from "../lib/accent";
import type { ArcStageKey, Bible, BibleSecret, RevealStage, RunLiView } from "../shared/api-types";
import {
  bibleProblem,
  MASK_TELLS_MAX,
  MASK_TELLS_MIN,
  SECRET_TELLS_MAX,
  SECRETS_MAX,
  SECRETS_MIN,
  type BibleProblem,
} from "../shared/bible";
import { intimacyOpen } from "../shared/content";
import { TextField } from "./setup/parts";

type FieldKind = "text" | "long" | "lines" | "number" | "choice";

interface FieldSpec {
  path: string;
  labelKey: string;
  kind: FieldKind;
  /** For "choice": each value with its label key. */
  options?: Readonly<Record<string, string>>;
}

const PRESENTATION_KEYS = {
  man: "ui.otomeForge.setup.bibleLookMan",
  woman: "ui.otomeForge.setup.bibleLookWoman",
  person: "ui.otomeForge.setup.bibleLookPerson",
} as const;

const CHEAT_KEYS = {
  steady: "ui.otomeForge.setup.bibleCheatSteady",
  nudge: "ui.otomeForge.setup.bibleCheatNudge",
  extra: "ui.otomeForge.setup.bibleCheatExtra",
  freeze: "ui.otomeForge.setup.bibleCheatFreeze",
  calculate: "ui.otomeForge.setup.bibleCheatCalculate",
} as const;

const STAGE_KEYS: Record<ArcStageKey, string> = {
  "1": "ui.otomeForge.setup.stageMask",
  "2": "ui.otomeForge.setup.stageCrack",
  "3": "ui.otomeForge.setup.stagePull",
  "4": "ui.otomeForge.setup.stageWound",
  "5": "ui.otomeForge.setup.stageReckoning",
  "6": "ui.otomeForge.setup.stageBond",
};

const SECTIONS: readonly { titleKey: string; fields: readonly FieldSpec[] }[] = [
  {
    titleKey: "ui.otomeForge.setup.bibleBasics",
    fields: [
      { path: "age", labelKey: "ui.otomeForge.setup.bibleAge", kind: "number" },
      { path: "pronouns.subject", labelKey: "ui.otomeForge.setup.pronounSubject", kind: "text" },
      { path: "pronouns.object", labelKey: "ui.otomeForge.setup.pronounObject", kind: "text" },
      { path: "pronouns.possessive", labelKey: "ui.otomeForge.setup.pronounPossessive", kind: "text" },
      { path: "birthday", labelKey: "ui.otomeForge.setup.bibleBirthday", kind: "text" },
      { path: "role", labelKey: "ui.otomeForge.setup.bibleRole", kind: "text" },
      { path: "publicFace", labelKey: "ui.otomeForge.setup.biblePublicFace", kind: "long" },
      { path: "archetype", labelKey: "ui.otomeForge.setup.bibleArchetype", kind: "text" },
      { path: "subversion", labelKey: "ui.otomeForge.setup.bibleSubversion", kind: "long" },
    ],
  },
  {
    titleKey: "ui.otomeForge.setup.bibleHeart",
    fields: [
      { path: "wound", labelKey: "ui.otomeForge.setup.bibleWound", kind: "long" },
      { path: "ghost", labelKey: "ui.otomeForge.setup.bibleGhost", kind: "long" },
      { path: "lie", labelKey: "ui.otomeForge.setup.bibleLie", kind: "long" },
      { path: "want", labelKey: "ui.otomeForge.setup.bibleWant", kind: "long" },
      { path: "need", labelKey: "ui.otomeForge.setup.bibleNeed", kind: "long" },
      { path: "fear", labelKey: "ui.otomeForge.setup.bibleFear", kind: "long" },
    ],
  },
  {
    titleKey: "ui.otomeForge.setup.bibleMask",
    fields: [
      { path: "mask.presents", labelKey: "ui.otomeForge.setup.bibleMaskPresents", kind: "long" },
      { path: "mask.tells", labelKey: "ui.otomeForge.setup.bibleMaskTells", kind: "lines" },
      { path: "trueSelf.is", labelKey: "ui.otomeForge.setup.bibleTrueSelf", kind: "long" },
      { path: "trueSelf.showsWhen", labelKey: "ui.otomeForge.setup.bibleShowsWhen", kind: "lines" },
    ],
  },
  {
    titleKey: "ui.otomeForge.setup.bibleCharacter",
    fields: [
      { path: "flaws", labelKey: "ui.otomeForge.setup.bibleFlaws", kind: "lines" },
      { path: "virtues", labelKey: "ui.otomeForge.setup.bibleVirtues", kind: "lines" },
      { path: "contradictions", labelKey: "ui.otomeForge.setup.bibleContradictions", kind: "lines" },
      { path: "moralCode", labelKey: "ui.otomeForge.setup.bibleMoralCode", kind: "long" },
      { path: "redLines", labelKey: "ui.otomeForge.setup.bibleRedLines", kind: "lines" },
      { path: "darkness.kinds", labelKey: "ui.otomeForge.setup.bibleDarkness", kind: "lines" },
      { path: "likes", labelKey: "ui.otomeForge.setup.bibleLikes", kind: "lines" },
      { path: "dislikes", labelKey: "ui.otomeForge.setup.bibleDislikes", kind: "lines" },
    ],
  },
  {
    titleKey: "ui.otomeForge.setup.bibleVoice",
    fields: [
      { path: "voice.register", labelKey: "ui.otomeForge.setup.bibleRegister", kind: "long" },
      { path: "voice.tics", labelKey: "ui.otomeForge.setup.bibleTics", kind: "lines" },
      { path: "voice.never", labelKey: "ui.otomeForge.setup.bibleNever", kind: "lines" },
      { path: "voice.careLanguage", labelKey: "ui.otomeForge.setup.bibleCare", kind: "long" },
      { path: "voice.angerStyle", labelKey: "ui.otomeForge.setup.bibleAnger", kind: "long" },
      { path: "voice.jealousyStyle", labelKey: "ui.otomeForge.setup.bibleJealousy", kind: "long" },
      { path: "voice.samples.guarded", labelKey: "ui.otomeForge.setup.bibleSampleGuarded", kind: "long" },
      { path: "voice.samples.tender", labelKey: "ui.otomeForge.setup.bibleSampleTender", kind: "long" },
      { path: "voice.samples.angry", labelKey: "ui.otomeForge.setup.bibleSampleAngry", kind: "long" },
    ],
  },
  {
    titleKey: "ui.otomeForge.setup.bibleLook",
    fields: [
      { path: "look.identityLine", labelKey: "ui.otomeForge.setup.bibleIdentityLine", kind: "long" },
      { path: "look.outfitLine", labelKey: "ui.otomeForge.setup.bibleOutfitLine", kind: "long" },
      {
        path: "look.presentation",
        labelKey: "ui.otomeForge.setup.biblePresentation",
        kind: "choice",
        options: PRESENTATION_KEYS,
      },
      { path: "play.style", labelKey: "ui.otomeForge.setup.biblePlayStyle", kind: "text" },
      { path: "play.cheat", labelKey: "ui.otomeForge.setup.bibleCheat", kind: "choice", options: CHEAT_KEYS },
    ],
  },
];

/** His tastes in sex and intimacy (#1936): shown and edited only in a story with NSFW Heat that has the block. */
const INTIMACY_SECTION = {
  titleKey: "ui.otomeForge.setup.bibleIntimacy",
  fields: [
    { path: "intimacy.preferences", labelKey: "ui.otomeForge.setup.bibleIntimacyPreferences", kind: "lines" },
    { path: "intimacy.attractions", labelKey: "ui.otomeForge.setup.bibleIntimacyAttractions", kind: "lines" },
  ],
} as const satisfies { titleKey: string; fields: readonly FieldSpec[] };

/** Why a bible cannot be saved, one message per rule (literal keys). */
const PROBLEM_KEYS: Record<BibleProblem, string> = {
  age: "ui.otomeForge.setup.bibleAdult",
  pronouns: "ui.otomeForge.setup.bibleNeedPronouns",
  birthday: "ui.otomeForge.setup.bibleNeedBirthday",
  role: "ui.otomeForge.setup.bibleNoSchoolRole",
  maskTells: "ui.otomeForge.setup.bibleNeedMaskTells",
  secrets: "ui.otomeForge.setup.bibleNeedSecrets",
  secretTells: "ui.otomeForge.setup.bibleSecretTellsMax",
  woundSecret: "ui.otomeForge.setup.bibleNeedWoundSecret",
};
const PROBLEM_VALUES = {
  min: MASK_TELLS_MIN,
  max: MASK_TELLS_MAX,
  secretsMin: SECRETS_MIN,
  secretsMax: SECRETS_MAX,
  tellsMax: SECRET_TELLS_MAX,
};

type Json = Record<string, unknown>;

function getAt(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) => (current && typeof current === "object" ? (current as Json)[key] : undefined),
      value,
    );
}

function setAt<T>(value: T, path: string, next: unknown): T {
  const [key, ...rest] = path.split(".");
  const record = (value && typeof value === "object" ? value : {}) as Json;
  return { ...record, [key!]: rest.length ? setAt(record[key!], rest.join("."), next) : next } as T;
}

const toLines = (value: unknown) => (Array.isArray(value) ? value.join("\n") : "");
const fromLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function ReadValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return value.length ? (
      <ul className="of-bible-list">
        {value.map((item, index) => (
          <li key={index}>{String(item)}</li>
        ))}
      </ul>
    ) : (
      <span className="of-faint">—</span>
    );
  }
  const text = value === undefined || value === null ? "" : String(value);
  return text ? <span>{text}</span> : <span className="of-faint">—</span>;
}

function Field({
  spec,
  bible,
  editing,
  onChange,
}: {
  spec: FieldSpec;
  bible: Bible;
  editing: boolean;
  onChange: (bible: Bible) => void;
}) {
  const { t } = useTranslation();
  const value = getAt(bible, spec.path);
  const label = t(spec.labelKey);
  if (!editing) {
    return (
      <div className="of-bible-row">
        <dt>{label}</dt>
        <dd>
          <ReadValue
            value={
              spec.kind === "choice" && spec.options && typeof value === "string"
                ? t(spec.options[value] ?? value)
                : value
            }
          />
        </dd>
      </div>
    );
  }
  if (spec.kind === "choice" && spec.options) {
    return (
      <div className="of-field">
        <label className="of-label" htmlFor={`${spec.path}-select`}>
          {label}
        </label>
        <select
          id={`${spec.path}-select`}
          className="of-input of-select"
          value={String(value ?? "")}
          onChange={(event) => onChange(setAt(bible, spec.path, event.target.value))}
        >
          {Object.entries(spec.options).map(([option, key]) => (
            <option key={option} value={option}>
              {t(key)}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (spec.kind === "number") {
    return (
      <TextField
        label={label}
        type="number"
        min={18}
        value={String(value ?? "")}
        onChange={(text) => onChange(setAt(bible, spec.path, text === "" ? 0 : Number(text)))}
      />
    );
  }
  return (
    <TextField
      label={label}
      rows={spec.kind === "text" ? undefined : spec.kind === "lines" ? 4 : 3}
      hint={spec.kind === "lines" ? t("ui.otomeForge.setup.bibleOnePerLine") : undefined}
      value={spec.kind === "lines" ? toLines(value) : String(value ?? "")}
      onChange={(text) => onChange(setAt(bible, spec.path, spec.kind === "lines" ? text.split("\n") : text))}
    />
  );
}

/** Lines are kept as typed while editing (blank lines included) and trimmed when saved. */
function cleanLines(bible: Bible): Bible {
  let next = bible;
  for (const section of bible.intimacy ? [...SECTIONS, INTIMACY_SECTION] : SECTIONS) {
    for (const spec of section.fields) {
      if (spec.kind === "lines") next = setAt(next, spec.path, fromLines(toLines(getAt(next, spec.path))));
    }
  }
  return {
    ...next,
    secrets: next.secrets.map((secret) => ({ ...secret, tells: fromLines(toLines(secret.tells)) })),
  };
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="of-details of-glass" open>
      <summary className="of-summary">{title}</summary>
      <div className="of-details-body">{children}</div>
    </details>
  );
}

interface BibleViewProps {
  runKey: string;
  li: RunLiView;
  lis: RunLiView[];
}

function CardLink({ runKey, li, lis }: BibleViewProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const characters = useCharacterOptions();
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const saved = li.cardId ?? "";
  const value = draft ?? saved;
  const missing = !!value && !characters.items.some((card) => card.id === value);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await characters.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  const save = async () => {
    if (busy || value === saved) return;
    setBusy(true);
    setStatus(null);
    try {
      const { cardId } = await otome.post<{ cardId: string | null }>(
        `/runs/${encodeURIComponent(runKey)}/lis/${encodeURIComponent(li.id)}/card`,
        { cardId: value || null },
      );
      patchRun(queryClient, runKey, (view) => ({
        ...view,
        lis: view.lis.map((item) => (item.id === li.id ? { ...item, cardId: cardId ?? undefined } : item)),
      }));
      setDraft(null);
      setStatus({ error: false, text: t("ui.otomeForge.setup.cardLinkSaved") });
    } catch (failure) {
      setStatus({ error: true, text: otome.errorMessage(failure, "ui.otomeForge.setup.cardLinkFailed") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="of-section of-glass"
      aria-label={t("ui.otomeForge.setup.cardLink")}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="of-field">
        <label className="of-label" htmlFor={id}>
          {t("ui.otomeForge.setup.cardLink")}
        </label>
        <p id={`${id}-hint`} className="of-hint">
          {t("ui.otomeForge.setup.cardLinkHint")}
        </p>
        <select
          id={id}
          className="of-input of-select"
          value={value}
          disabled={busy || characters.isLoading}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            setDraft(event.target.value);
            setStatus(null);
          }}
        >
          <option value="">{t("ui.otomeForge.setup.cardLinkNone")}</option>
          {missing ? <option value={value}>{t("ui.otomeForge.setup.cardLinkMissing")}</option> : null}
          {characters.items.map((card) => (
            <option
              key={card.id}
              value={card.id}
              disabled={lis.some((other) => other.id !== li.id && other.cardId === card.id)}
            >
              {card.name}
            </option>
          ))}
        </select>
      </div>
      {characters.isError ? (
        <RetryNotice
          message={t("ui.otomeForge.setup.cardsFailed")}
          onRetry={() => void refresh()}
          retrying={refreshing}
        />
      ) : null}
      <div className="of-actions">
        <button
          type="submit"
          className="of-button of-button--primary of-button--small"
          aria-disabled={busy || value === saved}
        >
          {t(busy ? "ui.otomeForge.settings.saving" : "ui.otomeForge.setup.cardLinkSave")}
        </button>
        <button
          type="button"
          className="of-button of-button--text"
          aria-disabled={refreshing}
          onClick={() => void refresh()}
        >
          <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
          {t("ui.otomeForge.setup.cardLinkRefresh")}
        </button>
      </div>
      {status ? (
        <p className={status.error ? "of-error" : "of-hint"} role={status.error ? "alert" : "status"}>
          {status.text}
        </p>
      ) : null}
    </form>
  );
}

export function BibleView({ runKey, li, lis }: BibleViewProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const run = useRun(runKey);
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState<Bible | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const path = `/runs/${encodeURIComponent(runKey)}/lis/${encodeURIComponent(li.id)}/bible`;
  const queryKey = bibleQueryKey(runKey, li.id);
  const bible = useQuery({
    queryKey,
    enabled: revealed,
    queryFn: async () => (await otome.get<{ bible: Bible | null }>(path, { spoilers: 1 })).bible,
  });
  const accent = accentOf(li);
  const editing = draft !== null;
  const shown = draft ?? bible.data ?? null;
  // An SFW story never shows the block; a save there keeps one written before Heat was lowered (the server's rule).
  const sections =
    shown?.intimacy && run.data && intimacyOpen(run.data.world.content) ? [...SECTIONS, INTIMACY_SECTION] : SECTIONS;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // Edit, Cancel and Save replace themselves: focus goes to the toolbar's new first button, not to the page.
  const focusToolbar = useRef(false);
  useEffect(() => {
    if (!focusToolbar.current) return;
    focusToolbar.current = false;
    toolbarRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, [editing]);
  const setEditing = (next: Bible | null) => {
    focusToolbar.current = true;
    setDraft(next);
  };

  const save = async () => {
    if (!draft || busy) return;
    const bibleToSave = cleanLines(draft);
    const problem = bibleProblem(bibleToSave);
    if (problem) {
      setStatus({ error: true, text: t(PROBLEM_KEYS[problem], PROBLEM_VALUES) });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const saved = await otome.post<{ bible: Bible }>(path, { bible: bibleToSave });
      queryClient.setQueryData(queryKey, saved.bible);
      // The cast's "Add intimacy preferences" follows whether the block is there.
      void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      setEditing(null);
      setStatus({ error: false, text: t("ui.otomeForge.setup.bibleSaved") });
    } catch (failure) {
      // A rule the editor does not check (a field too long, too many entries in a list) is the bible's, not a retry's.
      setStatus({
        error: true,
        text:
          otomeErrorCode(failure) === "bad-request"
            ? t("ui.otomeForge.setup.bibleInvalid")
            : otome.errorMessage(failure, "ui.otomeForge.setup.bibleSaveFailed"),
      });
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string) => lis.find((other) => other.id === id)?.name ?? id;
  const updateSecret = (index: number, secret: BibleSecret) =>
    draft && setDraft({ ...draft, secrets: draft.secrets.map((other, at) => (at === index ? secret : other)) });

  return (
    <div className="of-page" style={{ ["--of-li-accent" as string]: accent }}>
      <div className="of-page-head">
        <Avatar name={li.name} url={li.portrait} accent={accent} size={72} className="of-avatar--hero" />
        <h1 ref={headingRef} className="of-title" tabIndex={-1}>
          {t("ui.otomeForge.setup.bibleTitle", { name: li.name })}
        </h1>
      </div>
      <CardLink key={li.id} runKey={runKey} li={li} lis={lis} />
      {!revealed ? (
        <section className="of-section of-glass of-spoiler">
          <BookLock size={26} strokeWidth={1.6} aria-hidden="true" />
          <p className="of-body">{t("ui.otomeForge.setup.bibleSpoilerText")}</p>
          <button
            type="button"
            className="of-button of-button--primary"
            onClick={() => {
              // The button leaves with the gate; the heading (which stays) keeps the focus.
              setRevealed(true);
              headingRef.current?.focus({ preventScroll: true });
            }}
          >
            <Eye size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.setup.bibleShowSpoilers")}
          </button>
        </section>
      ) : bible.isPending ? (
        <div className="of-center" role="status">
          <Heart className="of-pulse" size={26} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
          <p className="of-body">{t("ui.otomeForge.common.loading")}</p>
        </div>
      ) : bible.isError ? (
        <div className="of-panel of-panel--center of-card of-glass" role="alert">
          <p className="of-error">{otome.errorMessage(bible.error)}</p>
          <button type="button" className="of-button of-button--quiet of-glass" onClick={() => void bible.refetch()}>
            <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.common.retry")}
          </button>
        </div>
      ) : !shown ? (
        <p className="of-notice">{t("ui.otomeForge.setup.bibleNotYet")}</p>
      ) : (
        <>
          {li.source === "card" ? (
            <p className="of-notice">
              <Info size={15} strokeWidth={2} aria-hidden="true" />
              <span>
                <strong>{t("ui.otomeForge.setup.bibleCanonTitle")}</strong> {t("ui.otomeForge.setup.bibleCanonText")}
              </span>
            </p>
          ) : null}
          <div ref={toolbarRef} className="of-bible-toolbar">
            {editing ? (
              <>
                <button
                  type="button"
                  className="of-button of-button--quiet of-glass of-button--small"
                  onClick={() => {
                    setEditing(null);
                    setStatus(null);
                  }}
                >
                  {t("ui.otomeForge.setup.bibleCancel")}
                </button>
                <button
                  type="button"
                  className="of-button of-button--primary of-button--small"
                  aria-disabled={busy}
                  onClick={() => void save()}
                >
                  <Save size={15} strokeWidth={2} aria-hidden="true" />
                  {busy ? t("ui.otomeForge.setup.bibleSaving") : t("ui.otomeForge.setup.bibleSave")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="of-button of-button--quiet of-glass of-button--small"
                onClick={() => {
                  setEditing(shown);
                  setStatus(null);
                }}
              >
                <PencilLine size={15} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.setup.bibleEdit")}
              </button>
            )}
          </div>
          {editing ? <p className="of-hint">{t("ui.otomeForge.setup.bibleEditHint")}</p> : null}
          <div className="of-live" role="status" aria-live="polite">
            {status ? <p className={status.error ? "of-notice of-notice--error" : "of-notice"}>{status.text}</p> : null}
          </div>

          {sections.map((section) => (
            <Block key={section.titleKey} title={t(section.titleKey)}>
              {section === INTIMACY_SECTION ? (
                <p className="of-hint">{t("ui.otomeForge.setup.bibleIntimacyHint")}</p>
              ) : null}
              {editing ? (
                section.fields.map((spec) => (
                  <Field key={spec.path} spec={spec} bible={shown} editing onChange={setDraft} />
                ))
              ) : (
                <dl className="of-bible-fields">
                  {section.fields.map((spec) => (
                    <Field key={spec.path} spec={spec} bible={shown} editing={false} onChange={setDraft} />
                  ))}
                </dl>
              )}
            </Block>
          ))}

          <Block title={t("ui.otomeForge.setup.bibleSecrets")}>
            {shown.secrets.map((secret, index) =>
              editing ? (
                <div key={secret.id} className="of-bible-secret">
                  <TextField
                    label={t("ui.otomeForge.setup.bibleSecretTruth", { number: index + 1 })}
                    rows={3}
                    value={secret.truth}
                    onChange={(truth) => updateSecret(index, { ...secret, truth })}
                  />
                  <TextField
                    label={t("ui.otomeForge.setup.bibleSecretTells")}
                    hint={t("ui.otomeForge.setup.bibleOnePerLine")}
                    rows={3}
                    value={toLines(secret.tells)}
                    onChange={(text) => updateSecret(index, { ...secret, tells: text.split("\n") })}
                  />
                  <div className="of-select-row">
                    <label className="of-label" htmlFor={`${secret.id}-stage`}>
                      {t("ui.otomeForge.setup.bibleSecretStage")}
                    </label>
                    <select
                      id={`${secret.id}-stage`}
                      className="of-input of-select"
                      value={secret.revealAt.stage}
                      onChange={(event) =>
                        updateSecret(index, {
                          ...secret,
                          revealAt: { stage: Number(event.target.value) as RevealStage },
                        })
                      }
                    >
                      {([2, 3, 4, 5, 6] as const).map((stage) => (
                        <option key={stage} value={stage}>
                          {t("ui.otomeForge.setup.stageNumbered", {
                            number: stage,
                            name: t(STAGE_KEYS[String(stage) as ArcStageKey]),
                          })}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="of-icon-button of-glass"
                      aria-label={t("ui.otomeForge.setup.bibleSecretRemove", { number: index + 1 })}
                      title={t("ui.otomeForge.setup.bibleSecretRemove", { number: index + 1 })}
                      onClick={() =>
                        draft && setDraft({ ...draft, secrets: draft.secrets.filter((_, at) => at !== index) })
                      }
                    >
                      <Trash size={15} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                <dl key={secret.id} className="of-bible-fields of-bible-secret">
                  <div className="of-bible-row">
                    <dt>
                      {t("ui.otomeForge.setup.stageNumbered", {
                        number: secret.revealAt.stage,
                        name: t(STAGE_KEYS[String(secret.revealAt.stage) as ArcStageKey]),
                      })}
                    </dt>
                    <dd>{secret.truth}</dd>
                  </div>
                  <div className="of-bible-row">
                    <dt>{t("ui.otomeForge.setup.bibleSecretTells")}</dt>
                    <dd>
                      <ReadValue value={secret.tells} />
                    </dd>
                  </div>
                </dl>
              ),
            )}
            {editing && shown.secrets.length < SECRETS_MAX ? (
              <button
                type="button"
                className="of-button of-button--quiet of-glass of-button--small"
                onClick={() =>
                  draft &&
                  setDraft({
                    ...draft,
                    secrets: [
                      ...draft.secrets,
                      { id: `secret-${Date.now().toString(36)}`, truth: "", tells: [], revealAt: { stage: 4 } },
                    ],
                  })
                }
              >
                <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
                {t("ui.otomeForge.setup.bibleSecretAdd")}
              </button>
            ) : null}
          </Block>

          <Block title={t("ui.otomeForge.setup.bibleArc")}>
            {(["1", "2", "3", "4", "5", "6"] as const).map((stage) => {
              const title = t("ui.otomeForge.setup.stageNumbered", { number: stage, name: t(STAGE_KEYS[stage]) });
              const step = shown.arc[stage] ?? {};
              return editing ? (
                <fieldset key={stage} className="of-fieldset of-bible-stage">
                  <legend className="of-legend of-legend--small">{title}</legend>
                  <TextField
                    label={t("ui.otomeForge.setup.bibleWantsFromHer")}
                    rows={2}
                    value={step.wantsFromHer ?? ""}
                    onChange={(wantsFromHer) => setDraft(setAt(shown, `arc.${stage}.wantsFromHer`, wantsFromHer))}
                  />
                  <TextField
                    label={t("ui.otomeForge.setup.bibleSeed")}
                    rows={2}
                    value={step.seed ?? ""}
                    onChange={(seed) => setDraft(setAt(shown, `arc.${stage}.seed`, seed))}
                  />
                </fieldset>
              ) : (
                <dl key={stage} className="of-bible-fields">
                  <div className="of-bible-row">
                    <dt>{title}</dt>
                    <dd>
                      <ReadValue value={[step.wantsFromHer, step.seed].filter(Boolean)} />
                    </dd>
                  </div>
                </dl>
              );
            })}
          </Block>

          {Object.keys(shown.web).length ? (
            <Block title={t("ui.otomeForge.setup.bibleWeb")}>
              {Object.entries(shown.web).map(([other, row]) => (
                <fieldset key={other} className="of-fieldset of-bible-stage">
                  <legend className="of-legend of-legend--small">{nameOf(other)}</legend>
                  {(["history", "stance", "debt", "secret"] as const).map((key) =>
                    editing ? (
                      <TextField
                        key={key}
                        label={t(WEB_KEYS[key])}
                        rows={key === "stance" ? undefined : 2}
                        value={row[key] ?? ""}
                        onChange={(text) => setDraft(setAt(shown, `web.${other}.${key}`, text))}
                      />
                    ) : (
                      <dl key={key} className="of-bible-fields">
                        <div className="of-bible-row">
                          <dt>{t(WEB_KEYS[key])}</dt>
                          <dd>
                            <ReadValue value={row[key]} />
                          </dd>
                        </div>
                      </dl>
                    ),
                  )}
                </fieldset>
              ))}
            </Block>
          ) : null}
        </>
      )}
    </div>
  );
}

const WEB_KEYS = {
  history: "ui.otomeForge.setup.bibleWebHistory",
  stance: "ui.otomeForge.setup.bibleWebStance",
  debt: "ui.otomeForge.setup.bibleWebDebt",
  secret: "ui.otomeForge.setup.bibleWebSecret",
} as const;
