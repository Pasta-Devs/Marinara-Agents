import { Database, Play, Save, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MEMORY_NAG_DEFAULTS,
  type MemoryNagSettings,
  type MemoryNagVault,
} from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { memoryNagRequest } from "./api";
import { useMemoryNagTranslation } from "./localization";
import { MemoryNagVaultModal } from "./MemoryNagVault";
import type { CapabilityProps, MemoryNagScanProgress } from "./types";

const NUMBER_FIELDS = [
  {
    key: "messagesPerBatch",
    label: "memoryNag.settings.messagesPerBatch",
    help: "memoryNag.settings.messagesPerBatchHelp",
    min: 5,
    max: 200,
  },
  {
    key: "memoriesPerCharacter",
    label: "memoryNag.settings.memoriesPerCharacter",
    help: "memoryNag.settings.memoriesPerCharacterHelp",
    min: 1,
    max: 50,
  },
  {
    key: "memoriesToConsider",
    label: "memoryNag.settings.memoriesToConsider",
    help: "memoryNag.settings.memoriesToConsiderHelp",
    min: 1,
    max: 50,
  },
  {
    key: "memoriesToInject",
    label: "memoryNag.settings.memoriesToInject",
    help: "memoryNag.settings.memoriesToInjectHelp",
    min: 1,
    max: 20,
  },
] as const;

function clampSettings(settings: MemoryNagSettings): MemoryNagSettings {
  const clamped = { ...settings };
  for (const field of NUMBER_FIELDS) {
    clamped[field.key] = Math.min(field.max, Math.max(field.min, Math.trunc(clamped[field.key])));
  }
  return clamped;
}

export function MemoryNagSettings({ props }: { props: CapabilityProps }) {
  const { t } = useMemoryNagTranslation();
  const chatId = props.chatId ?? "";
  const [settings, setSettings] = useState<MemoryNagSettings>({ ...MEMORY_NAG_DEFAULTS });
  const [vaultOpen, setVaultOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<MemoryNagScanProgress | null>(null);
  const scanController = useRef<AbortController | null>(null);
  const vault = useQuery({
    enabled: Boolean(chatId),
    queryKey: ["memory-nag", "settings", chatId],
    queryFn: () => memoryNagRequest<MemoryNagVault>(`/vault/${encodeURIComponent(chatId)}`),
  });

  useEffect(() => {
    if (vault.data) setSettings(vault.data.settings);
  }, [vault.data]);

  useEffect(() => () => scanController.current?.abort(), []);

  const saveSettings = async (showSuccess = true) => {
    setSaving(true);
    setMessage("");
    try {
      const nextSettings = clampSettings(settings);
      setSettings(nextSettings);
      const saved = await memoryNagRequest<MemoryNagVault>(
        `/settings/${encodeURIComponent(chatId)}`,
        "PATCH",
        nextSettings,
      );
      setSettings(saved.settings);
      if (showSuccess) setMessage(t("memoryNag.settings.saved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      if (!showSuccess) throw error;
    } finally {
      setSaving(false);
    }
  };

  const scanChat = async () => {
    const controller = new AbortController();
    scanController.current = controller;
    setScanning(true);
    setMessage("");
    setProgress(null);
    let created = 0;
    let resolved = 0;
    let previousProgress: Pick<MemoryNagScanProgress, "checkpointMessageId" | "processed"> | null = null;
    try {
      await saveSettings(false);
      while (!controller.signal.aborted) {
        const next = await memoryNagRequest<MemoryNagScanProgress>(
          `/scan/${encodeURIComponent(chatId)}`,
          "POST",
          undefined,
          controller.signal,
        );
        created += next.created;
        resolved += next.resolved;
        setProgress({ ...next, created, resolved });
        if (next.done) {
          setMessage(t("memoryNag.settings.complete"));
          break;
        }
        if (
          previousProgress?.checkpointMessageId === next.checkpointMessageId &&
          previousProgress.processed === next.processed
        ) {
          setMessage(t("memoryNag.settings.stalled"));
          break;
        }
        previousProgress = next;
      }
      await vault.refetch();
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (scanController.current === controller) scanController.current = null;
      setScanning(false);
    }
  };

  if (!chatId || props.chatMode !== "roleplay") return <div className="mn-status">{t("memoryNag.error.noChat")}</div>;

  return (
    <section className="mn-shell mn-panel mn-stack">
      <label className="mn-label">
        <span>{t("memoryNag.settings.scanConnection")}</span>
        <select
          className="mn-select"
          disabled={saving || scanning}
          value={settings.scanConnectionId ?? ""}
          onChange={(event) => setSettings((current) => ({ ...current, scanConnectionId: event.target.value || null }))}
        >
          <option value="">{t("memoryNag.settings.agentConnection")}</option>
          {(props.connections ?? []).map((connection) => (
            <option value={connection.id} key={connection.id}>
              {connection.name}
              {connection.model ? ` · ${connection.model}` : ""}
            </option>
          ))}
        </select>
        <small>{t("memoryNag.settings.connectionHelp")}</small>
      </label>
      <div className="mn-grid">
        {NUMBER_FIELDS.map((field) => (
          <label className="mn-label" key={field.key}>
            <span>{t(field.label)}</span>
            <input
              className="mn-input"
              type="number"
              min={field.min}
              max={field.max}
              disabled={saving || scanning}
              value={settings[field.key]}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (!Number.isFinite(parsed)) return;
                setSettings((current) => ({ ...current, [field.key]: parsed }));
              }}
              onBlur={() => setSettings((current) => clampSettings(current))}
            />
            <small>{t(field.help)}</small>
          </label>
        ))}
      </div>
      {progress ? (
        <div className="mn-status" role="status">
          {t("memoryNag.settings.progress", {
            processed: progress.processed,
            total: progress.total,
            created: progress.created,
            resolved: progress.resolved,
          })}
        </div>
      ) : null}
      {message ? (
        <div className="mn-status" role="status">
          {message}
        </div>
      ) : null}
      <div className="mn-actions">
        <button
          type="button"
          className="mn-button mn-button-primary"
          disabled={saving || scanning}
          onClick={() => void saveSettings()}
        >
          <Save className="mn-icon" aria-hidden="true" />
          {t("memoryNag.settings.save")}
        </button>
        <button type="button" className="mn-button" disabled={saving || scanning} onClick={() => void scanChat()}>
          <Play className="mn-icon" aria-hidden="true" />
          {scanning ? t("memoryNag.settings.scanning") : t("memoryNag.settings.scan")}
        </button>
        {scanning ? (
          <button type="button" className="mn-button" onClick={() => scanController.current?.abort()}>
            <Square className="mn-icon" aria-hidden="true" />
            {t("memoryNag.settings.stop")}
          </button>
        ) : null}
        <button type="button" className="mn-button" onClick={() => setVaultOpen(true)}>
          <Database className="mn-icon" aria-hidden="true" />
          {t("memoryNag.settings.vault")}
        </button>
      </div>
      {vaultOpen ? <MemoryNagVaultModal props={props} onClose={() => setVaultOpen(false)} /> : null}
    </section>
  );
}
