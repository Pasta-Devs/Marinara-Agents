import { Database, LoaderCircle, Play, RotateCcw, Save, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  MEMORY_NAG_DEFAULT_VAULT_PROMPT,
  MEMORY_NAG_DEFAULTS,
  MEMORY_NAG_VAULT_PROMPT_MAX_LENGTH,
  type MemoryNagSettings,
  type MemoryNagVault,
} from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { memoryNagRequest } from "./api";
import { useMemoryNagTranslation } from "./localization";
import { MemoryNagVaultModal, useModalDialog } from "./MemoryNagVault";
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
  const { onDirtyChange } = props;
  const chatId = props.chatId ?? "";
  const [settings, setSettings] = useState<MemoryNagSettings>({ ...MEMORY_NAG_DEFAULTS });
  const [vaultOpen, setVaultOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [progress, setProgress] = useState<MemoryNagScanProgress | null>(null);
  const scanController = useRef<AbortController | null>(null);
  const hydratedChatId = useRef<string | null>(null);
  const scanDialogRef = useModalDialog(
    scanOpen,
    () => {
      if (!scanning) setScanOpen(false);
    },
    "#mn-memory-nag-create-button",
  );
  const vault = useQuery({
    enabled: Boolean(chatId),
    queryKey: ["memory-nag", "settings", chatId],
    queryFn: () => memoryNagRequest<MemoryNagVault>(`/vault/${encodeURIComponent(chatId)}`),
  });

  useEffect(() => {
    if (!vault.data || vault.data.chatId !== chatId || hydratedChatId.current === chatId) return;
    hydratedChatId.current = chatId;
    setSettings(vault.data.settings);
    onDirtyChange?.(false);
  }, [chatId, onDirtyChange, vault.data]);

  useEffect(() => () => scanController.current?.abort(), []);

  const updateSettings = (patch: Partial<MemoryNagSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    onDirtyChange?.(true);
  };

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
      onDirtyChange?.(false);
      if (showSuccess) setMessage(t("memoryNag.settings.saved"));
    } catch (error) {
      if (showSuccess) setMessage(error instanceof Error ? error.message : String(error));
      if (!showSuccess) throw error;
    } finally {
      setSaving(false);
    }
  };

  const scanChat = async () => {
    const controller = new AbortController();
    scanController.current = controller;
    setScanning(true);
    setScanOpen(true);
    setMessage("");
    setScanMessage("");
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
          setScanMessage(t("memoryNag.settings.complete"));
          break;
        }
        if (
          previousProgress?.checkpointMessageId === next.checkpointMessageId &&
          previousProgress.processed === next.processed
        ) {
          setScanMessage(t("memoryNag.settings.stalled"));
          break;
        }
        previousProgress = next;
      }
      await vault.refetch();
    } catch (error) {
      if (!controller.signal.aborted) setScanMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (scanController.current === controller) scanController.current = null;
      setScanning(false);
    }
  };

  const stopScan = () => {
    setScanMessage(t("memoryNag.settings.stopped"));
    scanController.current?.abort();
  };

  if (!chatId || props.chatMode !== "roleplay") return <div className="mn-status">{t("memoryNag.error.noChat")}</div>;

  return (
    <section className="mn-shell mn-stack">
      <label className="mn-label">
        <span>{t("memoryNag.settings.scanConnection")}</span>
        <select
          className="mari-chrome-field mn-field"
          disabled={saving || scanning}
          value={settings.scanConnectionId ?? ""}
          onChange={(event) => updateSettings({ scanConnectionId: event.target.value || null })}
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
      <div className="mn-label">
        <span className="mn-row mn-between">
          <label className="mn-label-title" htmlFor="mn-memory-nag-vault-prompt">
            {t("memoryNag.settings.vaultPrompt")}
          </label>
          <button
            type="button"
            className="mari-chrome-control mari-chrome-control--small mari-agent-settings-action mari-agent-settings-action--icon mn-icon-button"
            disabled={saving || scanning || settings.vaultPrompt === MEMORY_NAG_DEFAULT_VAULT_PROMPT}
            onClick={() => updateSettings({ vaultPrompt: MEMORY_NAG_DEFAULT_VAULT_PROMPT })}
            title={t("memoryNag.settings.resetPrompt")}
            aria-label={t("memoryNag.settings.resetPrompt")}
          >
            <RotateCcw className="mn-icon" aria-hidden="true" />
          </button>
        </span>
        <small>{t("memoryNag.settings.vaultPromptHelp")}</small>
        <textarea
          id="mn-memory-nag-vault-prompt"
          className="mari-chrome-field mn-field mn-textarea mn-prompt-textarea"
          disabled={saving || scanning}
          maxLength={MEMORY_NAG_VAULT_PROMPT_MAX_LENGTH}
          value={settings.vaultPrompt}
          onChange={(event) => updateSettings({ vaultPrompt: event.target.value })}
        />
      </div>
      <div className="mn-number-grid">
        {NUMBER_FIELDS.map((field) => (
          <label className="mn-number-field" key={field.key}>
            <span className="mn-number-copy">
              <strong>{t(field.label)}</strong>
              <small>{t(field.help)}</small>
            </span>
            <input
              className="mari-chrome-field mn-field mn-number-input"
              type="number"
              min={field.min}
              max={field.max}
              disabled={saving || scanning}
              value={settings[field.key]}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (!Number.isFinite(parsed)) return;
                updateSettings({ [field.key]: parsed });
              }}
              onBlur={() => setSettings((current) => clampSettings(current))}
            />
          </label>
        ))}
      </div>
      {message ? (
        <div className="mn-status" role="status">
          {message}
        </div>
      ) : null}
      <div className="mn-actions">
        <button
          type="button"
          className="mari-chrome-control mari-chrome-control--small mari-agent-settings-action mari-agent-settings-action--primary"
          disabled={saving || scanning}
          onClick={() => void saveSettings()}
        >
          <Save className="mn-icon" aria-hidden="true" />
          {t("memoryNag.settings.save")}
        </button>
        <button
          id="mn-memory-nag-create-button"
          type="button"
          className="mari-chrome-control mari-chrome-control--small mari-agent-settings-action"
          disabled={saving || scanning}
          onClick={() => void scanChat()}
        >
          <Play className="mn-icon" aria-hidden="true" />
          {t("memoryNag.settings.scan")}
        </button>
        <button
          type="button"
          className="mari-chrome-control mari-chrome-control--small mari-agent-settings-action"
          onClick={() => setVaultOpen(true)}
        >
          <Database className="mn-icon" aria-hidden="true" />
          {t("memoryNag.settings.vault")}
        </button>
      </div>
      {vaultOpen ? <MemoryNagVaultModal props={props} onClose={() => setVaultOpen(false)} /> : null}
      {scanOpen
        ? createPortal(
            <div className="mn-overlay" role="presentation">
              <section
                ref={scanDialogRef}
                className="mn-modal mn-progress-modal mn-shell"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mn-memory-nag-progress-title"
                tabIndex={-1}
              >
                <div className="mn-modal-head">
                  <div className="mn-row">
                    {scanning ? (
                      <LoaderCircle className="mn-icon mn-spin" aria-hidden="true" />
                    ) : (
                      <Database className="mn-icon" aria-hidden="true" />
                    )}
                    <strong id="mn-memory-nag-progress-title">{t("memoryNag.settings.progressTitle")}</strong>
                  </div>
                  {!scanning ? (
                    <button
                      type="button"
                      className="mari-chrome-control mari-chrome-control--small mari-agent-settings-action mari-agent-settings-action--icon mn-icon-button"
                      onClick={() => setScanOpen(false)}
                      aria-label={t("memoryNag.settings.closeProgress")}
                    >
                      <X className="mn-icon" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <div className="mn-modal-body mn-stack">
                  {progress ? (
                    <>
                      <progress
                        className="mn-progress"
                        max={Math.max(progress.total, 1)}
                        value={Math.min(progress.processed, progress.total)}
                      />
                      <div className="mn-status" role="status">
                        {t("memoryNag.settings.progress", {
                          processed: progress.processed,
                          total: progress.total,
                          created: progress.created,
                          resolved: progress.resolved,
                        })}
                      </div>
                    </>
                  ) : scanning ? (
                    <div className="mn-status" role="status">
                      {t("memoryNag.settings.preparing")}
                    </div>
                  ) : null}
                  {scanMessage ? (
                    <div className="mn-status" role="status">
                      {scanMessage}
                    </div>
                  ) : null}
                  <div className="mn-actions mn-actions-end">
                    {scanning ? (
                      <button
                        type="button"
                        className="mari-chrome-control mari-chrome-control--small mari-agent-settings-action"
                        onClick={stopScan}
                      >
                        <Square className="mn-icon" aria-hidden="true" />
                        {t("memoryNag.settings.stop")}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="mari-chrome-control mari-chrome-control--small mari-agent-settings-action"
                          onClick={() => setScanOpen(false)}
                        >
                          {t("memoryNag.settings.closeProgress")}
                        </button>
                        <button
                          type="button"
                          className="mari-chrome-control mari-chrome-control--small mari-agent-settings-action mari-agent-settings-action--primary"
                          onClick={() => {
                            setScanOpen(false);
                            setVaultOpen(true);
                          }}
                        >
                          <Database className="mn-icon" aria-hidden="true" />
                          {t("memoryNag.settings.vault")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
