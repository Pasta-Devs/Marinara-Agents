// ──────────────────────────────────────────────
// Otome Forge: the form pieces the setup wizard, Settings and the bible editor share (text fields, choice cards,
// pronouns, switches, connection pickers)
// ──────────────────────────────────────────────
// Every control is a native input with its own label, so keyboard and screen readers work as they do anywhere:
// radio groups move with the arrow keys, switches toggle with Space.
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Lock, PencilLine, type LucideIcon } from "lucide-react";
import { useOtomeProps } from "../../props";
import type { ConnectionOption } from "../../hooks/use-engine-resources";
import { PRONOUN_MAX, type PronounChoice } from "./draft";

// ── Text ──

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  rows?: number;
  placeholder?: string;
  hint?: ReactNode;
  /** Shows "n / max" under the field. */
  counter?: boolean;
  list?: string;
  type?: "text" | "number";
  min?: number;
}

export function TextField({
  label,
  value,
  onChange,
  max,
  rows,
  placeholder,
  hint,
  counter,
  list,
  type,
  min,
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = hint || counter ? hintId : undefined;
  return (
    <div className="of-field">
      <label className="of-label" htmlFor={id}>
        {label}
      </label>
      {rows ? (
        <textarea
          id={id}
          className="of-input of-textarea"
          rows={rows}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className="of-input"
          type={type ?? "text"}
          min={min}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          list={list}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {describedBy ? (
        <p id={hintId} className="of-field-hint">
          {hint ? <span>{hint}</span> : <span />}
          {counter && max ? (
            <span className="of-counter">
              {value.length} / {max}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

// ── Choice cards (a radio group of large cards) ──

export interface Choice<T extends string> {
  value: T;
  title: string;
  description?: string;
  Icon?: LucideIcon;
  /** Shows the 18+ lock while the gate is not confirmed. */
  gated?: boolean;
}

interface ChoiceCardsProps<T extends string> {
  legend: string;
  hint?: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
  columns?: 1 | 3;
}

export function ChoiceCards<T extends string>({
  legend,
  hint,
  value,
  choices,
  onChange,
  columns = 3,
}: ChoiceCardsProps<T>) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <fieldset className="of-fieldset">
      <legend className="of-legend">{legend}</legend>
      {hint ? <p className="of-hint">{hint}</p> : null}
      <div className={columns === 1 ? "of-choices of-choices--list" : "of-choices"}>
        {choices.map(({ value: option, title, description, Icon, gated }) => (
          <label key={option} className="of-choice of-glass" data-checked={value === option}>
            <input
              className="of-visually-hidden"
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span className="of-choice-head">
              {Icon ? <Icon className="of-choice-icon" size={18} strokeWidth={1.8} aria-hidden="true" /> : null}
              <span className="of-choice-title">{title}</span>
              {gated ? (
                <span className="of-badge" title={t("ui.otomeForge.gate.badgeHint")}>
                  <Lock size={10} strokeWidth={2.4} aria-hidden="true" />
                  {t("ui.otomeForge.gate.badge")}
                </span>
              ) : null}
            </span>
            {description ? <span className="of-choice-text">{description}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ── Pills (a compact radio group) ──

interface PillsProps<T extends string> {
  legend: string;
  /** Visually hidden legend (the row already names it). */
  hideLegend?: boolean;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  small?: boolean;
}

export function Pills<T extends string>({
  legend,
  hideLegend,
  value,
  options,
  onChange,
  disabled,
  small,
}: PillsProps<T>) {
  const name = useId();
  return (
    <fieldset className="of-fieldset" disabled={disabled}>
      <legend className={hideLegend ? "of-visually-hidden" : "of-legend of-legend--small"}>{legend}</legend>
      <div className={small ? "of-pills of-pills--small" : "of-pills"}>
        {options.map((option) => (
          <label key={option.value} className="of-pill" data-checked={value === option.value}>
            <input
              className="of-visually-hidden"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ── Pronouns ──

const PRONOUN_LABEL_KEYS = {
  she: "ui.otomeForge.setup.pronounsShe",
  he: "ui.otomeForge.setup.pronounsHe",
  they: "ui.otomeForge.setup.pronounsThey",
  custom: "ui.otomeForge.setup.pronounsCustom",
} as const;

interface PronounPickerProps {
  legend: string;
  value: PronounChoice;
  onChange: (value: PronounChoice) => void;
}

export function PronounPicker({ legend, value, onChange }: PronounPickerProps) {
  const { t } = useTranslation();
  const options = (["she", "he", "they", "custom"] as const).map((preset) => ({
    value: preset,
    label: t(PRONOUN_LABEL_KEYS[preset]),
  }));
  const setCustom = (part: keyof PronounChoice["custom"], text: string) =>
    onChange({ ...value, custom: { ...value.custom, [part]: text } });
  return (
    <div className="of-pronouns">
      <Pills
        legend={legend}
        value={value.preset}
        options={options}
        onChange={(preset) => onChange({ ...value, preset })}
        small
      />
      {value.preset === "custom" ? (
        <div className="of-pronoun-custom">
          <TextField
            label={t("ui.otomeForge.setup.pronounSubject")}
            placeholder={t("ui.otomeForge.setup.pronounSubjectExample")}
            value={value.custom.subject}
            max={PRONOUN_MAX}
            onChange={(text) => setCustom("subject", text)}
          />
          <TextField
            label={t("ui.otomeForge.setup.pronounObject")}
            placeholder={t("ui.otomeForge.setup.pronounObjectExample")}
            value={value.custom.object}
            max={PRONOUN_MAX}
            onChange={(text) => setCustom("object", text)}
          />
          <TextField
            label={t("ui.otomeForge.setup.pronounPossessive")}
            placeholder={t("ui.otomeForge.setup.pronounPossessiveExample")}
            value={value.custom.possessive}
            max={PRONOUN_MAX}
            onChange={(text) => setCustom("possessive", text)}
          />
        </div>
      ) : null}
    </div>
  );
}

// ── Switch ──

interface SwitchProps {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ label, hint, checked, onChange, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="of-switch-row">
      <div className="of-switch-text">
        <label className="of-label" htmlFor={id}>
          {label}
        </label>
        {hint ? (
          <div id={`${id}-hint`} className="of-hint">
            {hint}
          </div>
        ) : null}
      </div>
      <input
        id={id}
        className="of-switch"
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

// ── Connection picker ──

interface ConnectionSelectProps {
  label: string;
  hint?: ReactNode;
  value: string;
  connections: readonly ConnectionOption[];
  onChange: (id: string) => void;
  /** The first option, for "" (e.g. "Same as story", "No images"). Omitted: a connection must be chosen. */
  emptyLabel?: string;
}

export function ConnectionSelect({ label, hint, value, connections, onChange, emptyLabel }: ConnectionSelectProps) {
  const { t } = useTranslation();
  const { openConnection } = useOtomeProps();
  const id = useId();
  const selected = connections.find((connection) => connection.id === value);
  // A stored id the Engine no longer lists (deleted, or the list failed to load) is shown as such, never as the empty
  // choice: what the select shows is what is saved, and picking the empty choice really clears it.
  const missing = !!value && !selected;
  const editLabel = selected ? t("ui.otomeForge.setup.editConnection", { name: selected.name }) : "";
  return (
    <div className="of-field">
      <label className="of-label" htmlFor={id}>
        {label}
      </label>
      <div className="of-select-row">
        <select
          id={id}
          className="of-input of-select"
          value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value)}
        >
          {emptyLabel !== undefined || !selected ? (
            <option value="">{emptyLabel ?? t("ui.otomeForge.setup.chooseConnection")}</option>
          ) : null}
          {missing ? <option value={value}>{t("ui.otomeForge.setup.missingConnection")}</option> : null}
          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.model ? `${connection.name} · ${connection.model}` : connection.name}
            </option>
          ))}
        </select>
        {selected && openConnection ? (
          <button
            type="button"
            className="of-icon-button of-glass"
            aria-label={editLabel}
            title={editLabel}
            onClick={() => openConnection(selected.id)}
          >
            <PencilLine size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="of-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A frosted section with a display-font heading. */
export function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <section className="of-section of-glass" aria-labelledby={id}>
      <h3 id={id} className="of-section-title">
        {title}
      </h3>
      {hint ? <p className="of-hint">{hint}</p> : null}
      {children}
    </section>
  );
}
