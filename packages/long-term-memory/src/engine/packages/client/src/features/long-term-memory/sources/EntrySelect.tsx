import { useEffect, useRef } from "react";
import type { LtmLorebookPreviewEntry } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { useLtmTranslation } from "../localization";
import { sourceCheckboxClass } from "./source-shared";

export function EntrySelect({
  entry,
  checked,
  indeterminate,
  onChange,
}: {
  entry: LtmLorebookPreviewEntry;
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={sourceCheckboxClass}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={localizeUi("ui.longTermMemory.memoryvault.selectValue1", {
        value1: entry.name,
      })}
      data-ltm-lorebook-entry-select={entry.id}
    />
  );
}
