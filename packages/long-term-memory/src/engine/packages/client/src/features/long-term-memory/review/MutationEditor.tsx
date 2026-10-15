import { useId } from "react";
import {
  type LtmDraftMutation,
  type LtmImportance,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { humanizeLabel, labelKeys, localizedLabel } from "../display-labels";
import { InfoPopover, inputClass } from "../shared-controls";
import { selectLtmPluralForm, useLtmTranslation } from "../localization";
import { MAX_APPEND_TEXT_LENGTH, MAX_SECTION_TEXT_LENGTH } from "./review-state";

const NEAR_TEXT_LIMIT_THRESHOLD = 500;

export const importanceOptions: LtmImportance[] = ["critical", "major", "moderate", "minor"];

function remainingCharacters(value: string, limit: number) {
  return limit - value.length;
}

function boundedTrim(value: string, max: number) {
  return value.trim().slice(0, max);
}

function ImportanceField({
  value,
  onChange,
  onBlur,
}: {
  value: LtmImportance | undefined;
  onChange: (value: LtmImportance | undefined) => void;
  onBlur?: () => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  return (
    <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
      <span className="flex items-center gap-1">
        {localizeUi("ui.longTermMemory.memoryvault.importance")}
        <InfoPopover
          label={localizeUi("ui.longTermMemory.memoryvault.importance")}
          content={localizeUi(
            "ui.longTermMemory.memoryvault.durabilityAndConsequenceCategoryCriticalMajorModerateOrMinor",
          )}
        />
      </span>
      <select
        aria-label={localizeUi("ui.longTermMemory.memoryvault.importance")}
        className={inputClass}
        value={value ?? ""}
        onChange={(event) => onChange((event.target.value || undefined) as LtmImportance | undefined)}
        onBlur={onBlur}
      >
        <option value="">{localizeUi("ui.longTermMemory.importancefield.notSpecified")}</option>
        {importanceOptions.map((importance) => (
          <option key={importance} value={importance}>
            {localizedLabel(importance, localizeUi, labelKeys.importance)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function MutationEditor({
  mutation,
  canEditTitle,
  onChange,
  onBlur,
}: {
  mutation: LtmDraftMutation;
  canEditTitle: boolean;
  onChange: (mutation: LtmDraftMutation) => void;
  onBlur?: () => void;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const counterId = useId();
  const renderCounter = (id: string, value: string, limit: number) => {
    const count = Math.max(0, remainingCharacters(value, limit));
    const key =
      selectLtmPluralForm(locale, count) === "one"
        ? "ui.longTermMemory.reviewqueue.charactersRemainingOne"
        : "ui.longTermMemory.reviewqueue.charactersRemainingOther";
    return (
      <>
        <span
          id={id}
          data-ltm-character-counter
          className={`block text-right text-[0.6875rem] font-normal ${
            count <= NEAR_TEXT_LIMIT_THRESHOLD ? "" : "text-[var(--muted-foreground)]"
          }`}
        >
          {localizeUi(key, { count })}
        </span>
        {count <= NEAR_TEXT_LIMIT_THRESHOLD ? (
          <span aria-live="polite" className="sr-only">
            {localizeUi(key, { count })}
          </span>
        ) : null}
      </>
    );
  };
  if (mutation.kind === "create_note") {
    return (
      <div data-ltm-mutation-editor className="space-y-3 pt-3">
        {canEditTitle ? (
          <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span>{localizeUi("ui.longTermMemory.mutationeditor.memoryTitle")}</span>
            <input
              className={inputClass}
              maxLength={240}
              value={mutation.note.title ?? ""}
              onChange={(event) =>
                onChange({
                  ...mutation,
                  note: {
                    ...mutation.note,
                    title: event.target.value.slice(0, 240) || undefined,
                  },
                })
              }
              onBlur={(event) => {
                onChange({
                  ...mutation,
                  note: {
                    ...mutation.note,
                    title: boundedTrim(event.target.value, 240) || undefined,
                  },
                });
                onBlur?.();
              }}
            />
          </label>
        ) : null}
        {Object.entries(mutation.note.sections).map(([sectionKey, section]) => (
          <div key={sectionKey} data-ltm-review-field-grid className="grid gap-2">
            <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span>{humanizeLabel(sectionKey)}</span>
              <textarea
                className={`${inputClass} min-h-24 py-2`}
                maxLength={MAX_SECTION_TEXT_LENGTH}
                aria-describedby={`${counterId}-${sectionKey}`}
                value={section.text}
                onChange={(event) =>
                  onChange({
                    ...mutation,
                    note: {
                      ...mutation.note,
                      sections: {
                        ...mutation.note.sections,
                        [sectionKey]: {
                          ...section,
                          text: event.target.value,
                        },
                      },
                    },
                  })
                }
                onBlur={(event) => {
                  onChange({
                    ...mutation,
                    note: {
                      ...mutation.note,
                      sections: {
                        ...mutation.note.sections,
                        [sectionKey]: {
                          ...section,
                          text: event.target.value.trim(),
                        },
                      },
                    },
                  });
                  onBlur?.();
                }}
              />
              {renderCounter(`${counterId}-${sectionKey}`, section.text, MAX_SECTION_TEXT_LENGTH)}
            </label>
            <ImportanceField
              value={section.importance}
              onChange={(importance) =>
                onChange({
                  ...mutation,
                  note: {
                    ...mutation.note,
                    sections: {
                      ...mutation.note.sections,
                      [sectionKey]: { ...section, importance },
                    },
                  },
                })
              }
              onBlur={onBlur}
            />
          </div>
        ))}
      </div>
    );
  }

  if (mutation.kind === "append_section") {
    return (
      <div data-ltm-mutation-editor data-ltm-review-field-grid className="grid gap-2 pt-3">
        <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span>
            {humanizeLabel(mutation.sectionKey)} {localizeUi("ui.longTermMemory.mutationeditor.text")}
          </span>
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            maxLength={MAX_APPEND_TEXT_LENGTH}
            aria-describedby={`${counterId}-text`}
            value={mutation.text}
            onChange={(event) =>
              onChange({
                ...mutation,
                text: event.target.value,
              })
            }
            onBlur={(event) => {
              onChange({
                ...mutation,
                text: event.target.value.trim(),
              });
              onBlur?.();
            }}
          />
          {renderCounter(`${counterId}-text`, mutation.text, MAX_APPEND_TEXT_LENGTH)}
        </label>
        <ImportanceField
          value={mutation.importance}
          onChange={(importance) => onChange({ ...mutation, importance })}
          onBlur={onBlur}
        />
      </div>
    );
  }

  if (mutation.kind === "update_section") {
    return (
      <div data-ltm-mutation-editor data-ltm-review-field-grid className="grid gap-2 pt-3">
        <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span>
            {humanizeLabel(mutation.sectionKey)} {localizeUi("ui.longTermMemory.mutationeditor.text")}
          </span>
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            maxLength={MAX_SECTION_TEXT_LENGTH}
            aria-describedby={`${counterId}-text`}
            value={mutation.section.text}
            onChange={(event) =>
              onChange({
                ...mutation,
                section: {
                  ...mutation.section,
                  text: event.target.value,
                },
              })
            }
            onBlur={(event) => {
              onChange({
                ...mutation,
                section: {
                  ...mutation.section,
                  text: event.target.value.trim(),
                },
              });
              onBlur?.();
            }}
          />
          {renderCounter(`${counterId}-text`, mutation.section.text, MAX_SECTION_TEXT_LENGTH)}
        </label>
        <ImportanceField
          value={mutation.section.importance}
          onChange={(importance) =>
            onChange({
              ...mutation,
              section: { ...mutation.section, importance },
            })
          }
          onBlur={onBlur}
        />
      </div>
    );
  }

  return null;
}
