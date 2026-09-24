import { AlertTriangle, CheckCircle2, Link2 } from "lucide-react";

import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import { Field } from "../../modules/settings/SlpSettingsControls";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

type Connection = { id: string; name?: string; model?: string; provider?: string };

export function SlpConnectionsPanel({ t, settings, update, connectionsQuery }: SlpBackstagePageProps) {
  const connections = (connectionsQuery.data ?? []) as Connection[];
  const textConnections = connections.filter((connection) => connection.provider !== "image_generation");
  const imageConnections = connections.filter((connection) => connection.provider === "image_generation");
  const label = (connection: Connection) => connection.name ?? connection.model ?? connection.id;
  const status = (selected: string | null, available: Connection[], fallback: string) => {
    if (!selected)
      return { kind: "fallback" as const, text: t("ui.slurp.settings.connections.usingDefault", { fallback }) };
    if (available.some((connection) => connection.id === selected)) {
      return { kind: "ok" as const, text: t("ui.slurp.settings.connections.configured") };
    }
    return {
      kind: "fallback" as const,
      text: t("ui.slurp.settings.connections.unavailableStatus", { fallback }),
    };
  };
  type Key =
    | "generationConnectionId"
    | "imageContextConnectionId"
    | "imageGenerationConnectionId"
    | "inlineAdsImageConnectionId";
  const saveKey = (key: Key) => (id: string | null) => update(key, id);
  const rows = [
    {
      key: "generationConnectionId" as const,
      label: t("ui.slurp.settings.connections.textGeneration"),
      connections: textConnections,
      value: settings.generationConnectionId,
      save: saveKey("generationConnectionId"),
      fallback: t("ui.slurp.settings.connections.defaultText"),
    },
    {
      key: "modelBudget" as const,
      label: t("ui.slurp.settings.connections.aiWriting"),
      connections: textConnections,
      value: settings.modelBudget.connectionId,
      // The server falls back to the text generation connection, not the Engine default.
      fallback: t("ui.slurp.settings.connections.textGenerationFallback"),
      save: (id: string | null) => update("modelBudget", { ...settings.modelBudget, connectionId: id }),
    },
    {
      key: "imageContextConnectionId" as const,
      label: t("ui.slurp.settings.connections.imageContext"),
      connections: textConnections,
      value: settings.imageContextConnectionId,
      save: saveKey("imageContextConnectionId"),
      fallback: t("ui.slurp.settings.connections.defaultText"),
    },
    {
      key: "imageGenerationConnectionId" as const,
      label: t("ui.slurp.settings.connections.imageGeneration"),
      connections: imageConnections,
      value: settings.imageGenerationConnectionId,
      save: saveKey("imageGenerationConnectionId"),
      fallback: t("ui.slurp.settings.connections.defaultImage"),
    },
    {
      key: "inlineAdsImageConnectionId" as const,
      label: t("ui.slurp.settings.connections.adImages"),
      connections: imageConnections,
      value: settings.inlineAdsImageConnectionId,
      save: saveKey("inlineAdsImageConnectionId"),
      fallback: t("ui.slurp.settings.connections.defaultImage"),
    },
  ];
  return (
    <div className="space-y-4">
      <BackstagePageHeader
        title={t("ui.slurp.settings.connections.title")}
        detail={t("ui.slurp.settings.connections.detail")}
        scope="all-slurp"
      />
      {connectionsQuery.isLoading ? (
        <p role="status" className="rounded-lg bg-[var(--slurp-surface-raised)] p-4 text-sm text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.connections.loading")}
        </p>
      ) : connectionsQuery.isError ? (
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => {
            const state = status(row.value, row.connections, row.fallback);
            const unavailableValue = row.value && !row.connections.some((connection) => connection.id === row.value);
            return (
              <Field key={row.key} label={row.label} detail={state.text}>
                <select
                  value={row.value ?? ""}
                  onChange={(event) => void row.save(event.target.value || null)}
                  className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm"
                >
                  <option value="">{t("ui.slurp.settings.connections.useDefault")}</option>
                  {unavailableValue && (
                    <option value={row.value!} disabled>
                      {t("ui.slurp.settings.connections.unavailableOption", { id: row.value })}
                    </option>
                  )}
                  {row.connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {label(connection)}
                    </option>
                  ))}
                </select>
                <p
                  className={`mt-2 inline-flex items-center gap-1 text-xs ${state.kind === "ok" ? "text-[var(--slurp-success)]" : "text-[var(--slurp-warning)]"}`}
                >
                  {state.kind === "ok" ? (
                    <CheckCircle2 size={13} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={13} aria-hidden="true" />
                  )}
                  {state.text}
                </p>
              </Field>
            );
          })}
        </div>
      )}
      <div className="flex items-start gap-3 rounded-lg bg-[var(--slurp-surface-raised)] p-4 text-xs text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <Link2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>{t("ui.slurp.settings.connections.missingSelectionDetail")}</p>
      </div>
    </div>
  );
}
