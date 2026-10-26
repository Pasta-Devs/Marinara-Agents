// ──────────────────────────────────────────────
// Story Writer: small form controls shared by the sidebar sections and the sticky note
// ──────────────────────────────────────────────
import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Search } from "lucide-react";

/**
 * Local text over a cached value. The cache notifies React asynchronously, so a field controlled by it straight away
 * would drop keystrokes; an outside change (another story, a cleared note) still replaces the draft. `normalize` is
 * what the store does to a value (e.g. trimming), so the stored form of the draft does not count as an outside change.
 */
export function useDraftText(
  value: string,
  onChange: (next: string) => void,
  normalize: (text: string) => string = (text) => text,
): [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [emitted, setEmitted] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== emitted && value !== normalize(emitted)) setDraft(value);
  }
  const update = (next: string) => {
    setDraft(next);
    setEmitted(next);
    onChange(next);
  };
  return [draft, update];
}

export function useNumberFormat(): (value: number) => string {
  const { i18n } = useTranslation();
  const format = useMemo(() => {
    try {
      return new Intl.NumberFormat(i18n.language);
    } catch {
      return new Intl.NumberFormat("en");
    }
  }, [i18n.language]);
  return useCallback((value: number) => format.format(value), [format]);
}

export function Section(props: {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  open: boolean;
  onToggle(): void;
  children: ReactNode;
  sectionId?: string;
}) {
  const id = useId();
  return (
    <section className="sw-section" data-section={props.sectionId}>
      <h3 className="sw-section-heading">
        <button
          type="button"
          id={`${id}-toggle`}
          className="sw-section-toggle"
          aria-expanded={props.open}
          aria-controls={`${id}-body`}
          onClick={props.onToggle}
        >
          <span className="sw-section-icon" aria-hidden="true">
            {props.icon}
          </span>
          <span>{props.title}</span>
          {props.badge ? <span className="sw-section-badge">{props.badge}</span> : null}
          <ChevronDown className="sw-section-chevron" size={18} aria-hidden="true" />
        </button>
      </h3>
      {props.open ? (
        <div id={`${id}-body`} className="sw-section-body" role="region" aria-labelledby={`${id}-toggle`}>
          {props.children}
        </div>
      ) : null}
    </section>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange(next: string): void;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  extra?: ReactNode;
  spellCheck?: boolean;
}) {
  const id = useId();
  const [draft, update] = useDraftText(props.value, props.onChange);
  const hintId = props.hint ? `${id}-hint` : undefined;
  const shared = {
    id,
    value: draft,
    placeholder: props.placeholder,
    maxLength: props.maxLength,
    spellCheck: props.spellCheck,
    "aria-describedby": hintId,
  };
  return (
    <div className="sw-field">
      <div className="sw-label-row">
        <label className="sw-label" htmlFor={id}>
          {props.label}
        </label>
        {props.extra}
      </div>
      {props.multiline ? (
        <textarea
          {...shared}
          className="sw-textarea"
          rows={props.rows ?? 3}
          onChange={(event) => update(event.target.value)}
        />
      ) : (
        <input {...shared} type="text" className="sw-input" onChange={(event) => update(event.target.value)} />
      )}
      {props.hint ? (
        <p id={hintId} className="sw-hint">
          {props.hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A whole-number field. While typing it saves only values inside [min, max]; on blur it clamps, so a half-typed
 * "15" on the way to "1500" never becomes the saved value.
 */
export function NumberField(props: {
  label: string;
  value: number | null;
  onCommit(next: number | null): void;
  min: number;
  max: number;
  step?: number;
  optional?: boolean;
  placeholder?: string;
  hint?: string;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  const { value, min, max, optional, onCommit } = props;
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [seen, setSeen] = useState(value);
  const [focused, setFocused] = useState(false);
  if (value !== seen) {
    setSeen(value);
    if (!focused) setDraft(value === null ? "" : String(value));
  }
  const parse = (text: string): number | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const number = Number(trimmed);
    return Number.isFinite(number) ? Math.round(number) : Number.NaN;
  };
  const hintId = props.hint ? `${id}-hint` : undefined;
  return (
    <div className="sw-field">
      <div className="sw-label-row">
        <label className="sw-label" htmlFor={id}>
          {props.label}
        </label>
        {props.extra}
      </div>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="sw-input"
        min={min}
        max={max}
        step={props.step ?? 1}
        value={draft}
        placeholder={props.placeholder}
        aria-describedby={hintId}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = parse(event.target.value);
          if (next === null) {
            if (optional && value !== null) onCommit(null);
          } else if (!Number.isNaN(next) && next >= min && next <= max && next !== value) {
            onCommit(next);
          }
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parse(draft);
          let next: number | null;
          if (parsed === null) next = optional ? null : value;
          else if (Number.isNaN(parsed)) next = value;
          else next = Math.min(max, Math.max(min, parsed));
          if (next !== value) onCommit(next);
          setDraft(next === null ? "" : String(next));
        }}
      />
      {props.children}
      {props.hint ? (
        <p id={hintId} className="sw-hint">
          {props.hint}
        </p>
      ) : null}
    </div>
  );
}

export function Toggle(props: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="sw-toggle"
      aria-pressed={props.checked}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    >
      <span className="sw-toggle-text">
        <span>{props.label}</span>
        {props.hint ? <small>{props.hint}</small> : null}
      </span>
      <span className="sw-switch" aria-hidden="true" />
    </button>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange(next: T): void;
}) {
  const id = useId();
  return (
    <div className="sw-field">
      <span className="sw-label" id={id}>
        {props.label}
      </span>
      <div className="sw-segmented" role="group" aria-labelledby={id}>
        {props.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="sw-segment"
            aria-pressed={option.value === props.value}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface ChecklistItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  detail: string;
}

export function Checklist(props: {
  label: string;
  hint?: string;
  searchLabel: string;
  emptyText: string;
  items: ChecklistItem[];
  isLoading: boolean;
  selected: string[];
  onChange(next: string[]): void;
  fallbackIcon?: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(props.selected), [props.selected]);
  const needle = query.trim().toLocaleLowerCase();
  const visible = needle
    ? props.items.filter((item) => `${item.name} ${item.detail}`.toLocaleLowerCase().includes(needle))
    : props.items;
  const count = props.items.filter((item) => selected.has(item.id)).length;
  const toggle = (itemId: string) =>
    props.onChange(selected.has(itemId) ? props.selected.filter((id) => id !== itemId) : [...props.selected, itemId]);
  return (
    <div className="sw-field" role="group" aria-labelledby={`${id}-label`}>
      <div className="sw-checklist-head">
        <span className="sw-label" id={`${id}-label`}>
          {props.label}
        </span>
        {count > 0 ? <span className="sw-label-extra">{t("cast.selected", { count })}</span> : null}
      </div>
      {props.hint ? <p className="sw-hint">{props.hint}</p> : null}
      {props.items.length > 6 ? (
        <div className="sw-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            className="sw-input"
            value={query}
            placeholder={props.searchLabel}
            aria-label={props.searchLabel}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      ) : null}
      {props.isLoading ? (
        <p className="sw-empty">{t("cast.loading")}</p>
      ) : props.items.length === 0 ? (
        <p className="sw-empty">{props.emptyText}</p>
      ) : visible.length === 0 ? (
        <p className="sw-empty">{t("cast.noMatches", { query: query.trim() })}</p>
      ) : (
        <ul className="sw-checklist">
          {visible.map((item) => (
            <li key={item.id}>
              <label className="sw-check-item">
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                {item.avatarUrl ? (
                  <img className="sw-avatar" src={item.avatarUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="sw-avatar" aria-hidden="true">
                    {props.fallbackIcon ?? (Array.from(item.name.trim())[0]?.toLocaleUpperCase() || "?")}
                  </span>
                )}
                <span className="sw-check-text">
                  <span className="sw-check-name">{item.name}</span>
                  {item.detail ? <span className="sw-check-detail">{item.detail}</span> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
