import type { MapsConnectionRecord } from "../../../hooks/use-spatial-context";
import { useSpatialMapTranslation } from "../localization";

interface SpatialConnectionOverrideSelectProps {
  ariaLabel: string;
  className: string;
  connections: MapsConnectionRecord[];
  disabled: boolean;
  fallbackConnectionId?: string | null;
  fallbackLabel?: string;
  id?: string;
  onChange: (connectionId: string) => void;
  value: string;
}

function connectionLabel(connection: MapsConnectionRecord): string {
  const model = connection.model?.trim();
  const details = [
    model && model.toLocaleLowerCase() !== connection.name.trim().toLocaleLowerCase() ? model : null,
    connection.provider,
  ].filter((value): value is string => Boolean(value));
  return details.length > 0 ? `${connection.name} · ${details.join(" · ")}` : connection.name;
}

export function textGenerationConnections(connections: MapsConnectionRecord[]): MapsConnectionRecord[] {
  return connections.filter(
    (connection) => connection.provider !== "image_generation" && connection.provider !== "video_generation",
  );
}

export function SpatialConnectionOverrideSelect({
  ariaLabel,
  className,
  connections,
  disabled,
  fallbackConnectionId = null,
  fallbackLabel,
  id,
  onChange,
  value,
}: SpatialConnectionOverrideSelectProps) {
  const { t } = useSpatialMapTranslation();
  const availableConnections = textGenerationConnections(connections);
  const fallbackConnection = fallbackConnectionId
    ? availableConnections.find((connection) => connection.id === fallbackConnectionId)
    : null;

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={className}
    >
      <option value="">
        {fallbackConnection
          ? `${fallbackLabel ?? t("ui.worldMaps.connection.useChat")} · ${connectionLabel(fallbackConnection)}`
          : (fallbackLabel ?? t("ui.worldMaps.connection.useChat"))}
      </option>
      {value && !availableConnections.some((connection) => connection.id === value) && (
        <option value={value}>{t("ui.worldMaps.connection.savedUnavailable")}</option>
      )}
      {availableConnections.map((connection) => (
        <option key={connection.id} value={connection.id}>
          {connectionLabel(connection)}
        </option>
      ))}
    </select>
  );
}
