import { ChevronRight } from "lucide-react";
import { useSlurpUIStore } from "../../base/state/slp-package-store";

type Connection = { id: string; name?: string; model?: string; provider?: string };

const nativeClass =
  "min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm";

const connectionName = (connection: Connection) => connection.name ?? connection.model ?? connection.id;

/**
 * One saved-model choice. The Engine's shared picker does the choosing (`kind` is its filter:
 * `chat` = the Engine's chat models (the host excludes image, video and audio), `image` = image generation); null means the inherited
 * default and a cancelled picker writes nothing. An older Engine has no picker, so the native
 * select stays as the fallback. `connections` is already filtered to `kind` by the caller.
 */
export function SlpConnectionField({
  kind,
  value,
  connections,
  defaultLabel,
  title,
  disabled = false,
  unavailableLabel,
  onChange,
}: {
  kind: "chat" | "image";
  value: string | null | undefined;
  connections: Connection[];
  defaultLabel: string;
  title: string;
  disabled?: boolean;
  /** Shown when `value` is set but no longer in `connections`. */
  unavailableLabel?: string;
  onChange: (id: string | null) => void;
}) {
  const pickConnection = useSlurpUIStore((state) => state.pickConnection);
  const selected = connections.find((connection) => connection.id === value);
  const current = !value ? defaultLabel : selected ? connectionName(selected) : (unavailableLabel ?? value);
  if (pickConnection) {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={`${title}: ${current}`}
        aria-haspopup="dialog"
        onClick={() =>
          void pickConnection({ kind, value: value ?? null, title, defaultLabel }).then((result) => {
            if (result.status === "selected" && (result.value ?? null) !== (value ?? null)) onChange(result.value);
          })
        }
        className={`${nativeClass} flex items-center gap-2 text-start`}
      >
        <span className="min-w-0 flex-1 truncate">{current}</span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--slurp-muted)] rtl:rotate-180" />
      </button>
    );
  }
  return (
    <select
      aria-label={title}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
      className={nativeClass}
    >
      <option value="">{defaultLabel}</option>
      {value && !selected && (
        <option value={value} disabled>
          {unavailableLabel ?? value}
        </option>
      )}
      {connections.map((connection) => (
        <option key={connection.id} value={connection.id}>
          {connectionName(connection)}
        </option>
      ))}
    </select>
  );
}
