import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { Field, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

type Connection = { id: string; name?: string; model?: string; provider?: string };

/**
 * Every model Slurp uses, one row per job, and whether Engine chats remember Slurp. A row says
 * what the model does; the status under the picker only speaks up when a fallback is in use.
 */
export function SlpConnectionsPanel({
  t,
  settings,
  update,
  connectionsQuery,
  imageSettings,
  imageSettingsQuery,
  updateImages,
}: SlpBackstagePageProps) {
  const connections = (connectionsQuery.data ?? []) as Connection[];
  const textConnections = connections.filter((connection) => connection.provider !== "image_generation");
  const imageConnections = connections.filter((connection) => connection.provider === "image_generation");
  const label = (connection: Connection) => connection.name ?? connection.model ?? connection.id;
  const picker = ({
    value,
    available,
    fallback,
    emptyLabel,
    disabled = false,
    onChange,
  }: {
    value: string | null | undefined;
    available: Connection[];
    fallback: string;
    emptyLabel: string;
    disabled?: boolean;
    onChange: (id: string | null) => void;
  }) => {
    const missing = Boolean(value) && !available.some((connection) => connection.id === value);
    const note = !value
      ? t("ui.slurp.settings.connections.usingDefault", { fallback })
      : missing
        ? t("ui.slurp.settings.connections.unavailableStatus", { fallback })
        : null;
    return (
      <>
        <select
          value={value ?? ""}
          disabled={disabled || connectionsQuery.isLoading || connectionsQuery.isError}
          onChange={(event) => onChange(event.target.value || null)}
          className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
        >
          <option value="">{emptyLabel}</option>
          {missing && (
            <option value={value!} disabled>
              {t("ui.slurp.settings.connections.unavailableOption", { id: value })}
            </option>
          )}
          {available.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {label(connection)}
            </option>
          ))}
        </select>
        <span
          className={`mt-1.5 inline-flex items-center gap-1 text-xs font-normal ${note ? (missing ? "text-[var(--slurp-warning)]" : "text-[var(--slurp-muted)]") : "text-[var(--slurp-success)]"}`}
        >
          {note && missing ? (
            <AlertTriangle size={13} aria-hidden="true" />
          ) : (
            !note && <CheckCircle2 size={13} aria-hidden="true" />
          )}
          {note ?? t("ui.slurp.settings.connections.configured")}
        </span>
      </>
    );
  };
  const useDefault = t("ui.slurp.settings.connections.useDefault");
  return (
    <div className="space-y-4">
      <BackstagePageHeader detail={t("ui.slurp.settings.connections.detail")} />
      {connectionsQuery.isError && (
        <div
          role="alert"
          className="rounded-lg bg-[var(--slurp-surface-raised)] p-4 text-sm text-[var(--slurp-warning)] ring-1 ring-inset ring-[var(--slurp-outline)]"
        >
          <p>{t("ui.slurp.settings.connections.loadError")}</p>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-md border border-[var(--slurp-outline)] px-3"
            onClick={() => void connectionsQuery.refetch()}
          >
            {t("capabilities.actions.tryAgain")}
          </button>
        </div>
      )}
      <SettingsGroup title={t("ui.slurp.settings.connections.textGroup")}>
        <Field
          settingKey="generationConnectionId"
          label={t("ui.slurp.settings.connections.textGeneration")}
          detail={t("ui.slurp.settings.connections.textGenerationUse")}
        >
          {picker({
            value: settings.generationConnectionId,
            available: textConnections,
            fallback: t("ui.slurp.settings.connections.defaultText"),
            emptyLabel: useDefault,
            onChange: (id) => void update("generationConnectionId", id),
          })}
        </Field>
        <Field
          label={t("ui.slurp.settings.connections.aiWriting")}
          detail={t("ui.slurp.settings.connections.aiWritingUse")}
        >
          {picker({
            value: settings.modelBudget.connectionId,
            available: textConnections,
            // The server falls back to the text generation connection, not the Engine default.
            fallback: t("ui.slurp.settings.connections.textGenerationFallback"),
            emptyLabel: useDefault,
            onChange: (id) => void update("modelBudget", { ...settings.modelBudget, connectionId: id }),
          })}
        </Field>
        <Field
          label={t("ui.slurp.settings.connections.imageContext")}
          detail={t("ui.slurp.settings.connections.imageContextUse")}
        >
          {picker({
            value: settings.imageContextConnectionId,
            available: textConnections,
            fallback: t("ui.slurp.settings.connections.defaultText"),
            emptyLabel: useDefault,
            onChange: (id) => void update("imageContextConnectionId", id),
          })}
        </Field>
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.connections.imageGroup")}>
        <Field
          label={t("ui.slurp.settings.connections.imageGeneration")}
          detail={t("ui.slurp.settings.images.globalConnectionDetail")}
        >
          {picker({
            value: imageSettings?.defaultConnectionId,
            available: imageConnections,
            fallback: t("ui.slurp.settings.connections.defaultImage"),
            emptyLabel: t("ui.slurp.settings.images.engineDefault"),
            disabled: imageSettingsQuery.isLoading || imageSettingsQuery.isError || updateImages.isPending,
            onChange: (id) =>
              updateImages.mutate(
                { defaultConnectionId: id },
                { onError: (error) => toast.error(errorMessage(error)) },
              ),
          })}
        </Field>
        <Field
          label={t("ui.slurp.settings.connections.adImages")}
          detail={t("ui.slurp.settings.connections.adImagesUse")}
        >
          {picker({
            value: settings.inlineAdsImageConnectionId,
            available: imageConnections,
            fallback: t("ui.slurp.settings.connections.imageGeneration"),
            emptyLabel: useDefault,
            onChange: (id) => void update("inlineAdsImageConnectionId", id),
          })}
        </Field>
      </SettingsGroup>
      {/* Engine chats that remember what a character did on Slurp. Moved here from Publishing:
          it is about the link to Engine chats, not about posting. */}
      <SettingsGroup title={t("ui.slurp.settings.carryover.title")}>
        <p className="text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.carryover.detail")}</p>
        <SettingAnchor settingKey="carryoverModes">
          <div className="grid gap-x-8 sm:grid-cols-3">
            {(["conversation", "roleplay", "game"] as const).map((mode) => (
              <Toggle
                key={mode}
                compact
                label={t(`ui.slurp.settings.carryover.${mode}`)}
                value={settings.carryoverModes.includes(mode)}
                onChange={(value) =>
                  update(
                    "carryoverModes",
                    value
                      ? [...settings.carryoverModes.filter((entry) => entry !== mode), mode]
                      : settings.carryoverModes.filter((entry) => entry !== mode),
                  )
                }
              />
            ))}
          </div>
        </SettingAnchor>
        {settings.carryoverModes.length > 0 && (
          <>
            <Field
              settingKey="carryoverHours"
              label={t("ui.slurp.settings.carryover.hours")}
              detail={t("ui.slurp.settings.carryover.hoursDetail")}
            >
              <NumberSetting
                stepper
                value={settings.carryoverHours}
                min={1}
                max={24 * 365}
                onSave={(value) => update("carryoverHours", value)}
              />
            </Field>
            <Field
              settingKey="carryoverMaxItems"
              label={t("ui.slurp.settings.carryover.maxItems")}
              detail={t("ui.slurp.settings.carryover.maxItemsDetail")}
            >
              <NumberSetting
                stepper
                value={settings.carryoverMaxItems}
                min={1}
                max={100}
                onSave={(value) => update("carryoverMaxItems", value)}
              />
            </Field>
          </>
        )}
      </SettingsGroup>
    </div>
  );
}
