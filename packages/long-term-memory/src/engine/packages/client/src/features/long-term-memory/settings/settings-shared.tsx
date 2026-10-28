import { useId, type ReactNode } from "react";
import { InfoPopover } from "../shared-controls";
import type { LongTermMemoryDestinationProps } from "../types";

export type SettingsRebuildOutcome = { status: "complete" | "deferred"; error?: string };

export async function confirm(
  props: LongTermMemoryDestinationProps["props"],
  title: string,
  message: string,
  confirmLabel: string,
  destructive = false,
) {
  if (props.confirmAction)
    return props.confirmAction({
      title,
      message,
      confirmLabel,
      tone: destructive ? "destructive" : "default",
    });
  return window.confirm(`${title}\n\n${message}`);
}

export function Toggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: ReactNode;
}) {
  const inputId = useId();
  return (
    <div className="flex min-h-11 items-end gap-2">
      <label
        htmlFor={inputId}
        className="mari-editor-panel mari-editor-panel--soft flex min-h-11 flex-1 cursor-pointer items-center gap-2 px-3 text-xs font-semibold text-[var(--foreground)]"
      >
        <input id={inputId} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
      {help ? <InfoPopover label={label} content={help} /> : null}
    </div>
  );
}
