import { BookOpen, Database, LoaderCircle, Maximize2, Play, RotateCcw, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [promptMacrosOpen, setPromptMacrosOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [progress, setProgress] = useState<MemoryNagScanProgress | null>(null);
  const scanController = useRef<AbortController | null>(null);
  const hydratedChatId = useRef<string | null>(null);
  const settingsRef = useRef<MemoryNagSettings>({ ...MEMORY_NAG_DEFAULTS });
  const settingsVersionRef = useRef(0);
  const attemptedVersionRef = useRef(0);
  const failedVersionRef = useRef(0);
  const retryCountRef = useRef(0);
  const onDirtyChangeRef = useRef(onDirtyChange);
  const scanDialogRef = useModalDialog(
    scanOpen,
    () => {
      if (!scanning) setScanOpen(false);
    },
    "#mn-memory-nag-create-button",
  );
  const promptDialogRef = useModalDialog(
    promptExpanded,
    () => setPromptExpanded(false),
    "#mn-memory-nag-expand-prompt",
  );
  const macrosDialogRef = useModalDialog(
    promptMacrosOpen,
    () => setPromptMacrosOpen(false),
    "#mn-memory-nag-prompt-macros",
  );
  const vault = useQuery({
    enabled: Boolean(chatId),
    queryKey: ["memory-nag", "settings", chatId],
    queryFn: () => memoryNagRequest<MemoryNagVault>(`/vault/${encodeURIComponent(chatId)}`),
  });

  useEffect(() => {
    if (!vault.data || vault.data.chatId !== chatId || hydratedChatId.current === chatId) return;
    hydratedChatId.current = chatId;
    settingsRef.current = vault.data.settings;
    settingsVersionRef.current = 0;
    attemptedVersionRef.current = 0;
    failedVersionRef.current = 0;
    retryCountRef.current = 0;
    setSettings(vault.data.settings);
    onDirtyChange?.(false);
  }, [chatId, onDirtyChange, vault.data]);

  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);

  useEffect(() => {
    return () => {
      scanController.current?.abort();
      onDirtyChangeRef.current?.(false);
    };
  }, []);

  const updateSettings = (patch: Partial<MemoryNagSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    settingsVersionRef.current += 1;
    setSettings(next);
    setMessage("");
    onDirtyChange?.(true);
  };

  const saveSettings = useCallback(async () => {
    const saveChatId = chatId;
    const version = settingsVersionRef.current;
    const nextSettings = clampSettings(settingsRef.current);
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    setSaving(true);
    setMessage("");
    try {
      const saved = await memoryNagRequest<MemoryNagVault>(
        `/settings/${encodeURIComponent(saveChatId)}`,
        "PATCH",
        nextSettings,
      );
      if (hydratedChatId.current === saveChatId) {
        attemptedVersionRef.current = Math.max(attemptedVersionRef.current, version);
        failedVersionRef.current = 0;
        retryCountRef.current = 0;
      }
      if (hydratedChatId.current === saveChatId && settingsVersionRef.current === version) {
        settingsRef.current = saved.settings;
        setSettings(saved.settings);
        onDirtyChange?.(false);
      }
    } catch (error) {
      if (hydratedChatId.current === saveChatId && settingsVersionRef.current === version) {
        retryCountRef.current += 1;
        if (retryCountRef.current >= 2) failedVersionRef.current = version;
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }, [chatId, onDirtyChange]);

  useEffect(() => {
    const version = settingsVersionRef.current;
    if (
      !chatId ||
      hydratedChatId.current !== chatId ||
      saving ||
      scanning ||
      attemptedVersionRef.current >= version ||
      failedVersionRef.current >= version
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void saveSettings().catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [chatId, saveSettings, saving, scanning, settings]);

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
      await saveSettings();
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
          disabled={scanning}
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
        <label className="mn-label-title" htmlFor="mn-memory-nag-vault-prompt">
          {t("memoryNag.settings.vaultPrompt")}
        </label>
        <small>{t("memoryNag.settings.vaultPromptHelp")}</small>
        <div className="mn-prompt-field">
          <textarea
            id="mn-memory-nag-vault-prompt"
            className="mari-chrome-field mn-field mn-textarea mn-prompt-textarea"
            disabled={scanning}
            maxLength={MEMORY_NAG_VAULT_PROMPT_MAX_LENGTH}
            rows={3}
            value={settings.vaultPrompt}
            onChange={(event) => updateSettings({ vaultPrompt: event.target.value })}
          />
          <div className="mn-prompt-tools">
            <button
              id="mn-memory-nag-expand-prompt"
              type="button"
              className="mn-prompt-tool"
              onClick={() => setPromptExpanded(true)}
              title={t("memoryNag.settings.expandPrompt")}
              aria-label={t("memoryNag.settings.expandPrompt")}
            >
              <Maximize2 className="mn-icon" aria-hidden="true" />
            </button>
            <button
              id="mn-memory-nag-prompt-macros"
              type="button"
              className="mn-prompt-tool"
              onClick={() => setPromptMacrosOpen(true)}
              title={t("memoryNag.settings.macroReference")}
              aria-label={t("memoryNag.settings.macroReference")}
            >
              <BookOpen className="mn-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="mn-prompt-tool"
              disabled={scanning || settings.vaultPrompt === MEMORY_NAG_DEFAULT_VAULT_PROMPT}
              onClick={() => updateSettings({ vaultPrompt: MEMORY_NAG_DEFAULT_VAULT_PROMPT })}
              title={t("memoryNag.settings.resetPrompt")}
              aria-label={t("memoryNag.settings.resetPrompt")}
            >
              <RotateCcw className="mn-icon" aria-hidden="true" />
            </button>
          </div>
        </div>
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
              disabled={scanning}
              value={settings[field.key]}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (!Number.isFinite(parsed)) return;
                updateSettings({ [field.key]: parsed });
              }}
              onBlur={() => updateSettings({ [field.key]: clampSettings(settingsRef.current)[field.key] })}
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
          id="mn-memory-nag-create-button"
          type="button"
          className="mari-agent-settings-action"
          disabled={saving || scanning}
          onClick={() => void scanChat()}
        >
          <Play className="mn-icon" aria-hidden="true" />
          {t("memoryNag.settings.scan")}
        </button>
        <button type="button" className="mari-agent-settings-action" onClick={() => setVaultOpen(true)}>
          <Database className="mn-icon" aria-hidden="true" />
          {t("memoryNag.settings.vault")}
        </button>
      </div>
      {vaultOpen ? <MemoryNagVaultModal props={props} onClose={() => setVaultOpen(false)} /> : null}
      {promptExpanded
        ? createPortal(
            <div className="mn-overlay" role="presentation">
              <section
                ref={promptDialogRef}
                className="mn-modal mn-prompt-modal mn-shell"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mn-memory-nag-prompt-title"
                tabIndex={-1}
              >
                <div className="mn-modal-head">
                  <strong id="mn-memory-nag-prompt-title">{t("memoryNag.settings.vaultPrompt")}</strong>
                  <button
                    type="button"
                    className="mari-agent-settings-action mari-agent-settings-action--icon"
                    onClick={() => setPromptExpanded(false)}
                    aria-label={t("memoryNag.settings.closePrompt")}
                  >
                    <X className="mn-icon" aria-hidden="true" />
                  </button>
                </div>
                <div className="mn-modal-body">
                  <textarea
                    className="mari-chrome-field mn-field mn-expanded-prompt"
                    disabled={scanning}
                    maxLength={MEMORY_NAG_VAULT_PROMPT_MAX_LENGTH}
                    value={settings.vaultPrompt}
                    onChange={(event) => updateSettings({ vaultPrompt: event.target.value })}
                  />
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
      {promptMacrosOpen
        ? createPortal(
            <div className="mn-overlay" role="presentation">
              <section
                ref={macrosDialogRef}
                className="mn-modal mn-macro-modal mn-shell"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mn-memory-nag-macros-title"
                tabIndex={-1}
              >
                <div className="mn-modal-head">
                  <strong id="mn-memory-nag-macros-title">{t("memoryNag.settings.macroReference")}</strong>
                  <button
                    type="button"
                    className="mari-agent-settings-action mari-agent-settings-action--icon"
                    onClick={() => setPromptMacrosOpen(false)}
                    aria-label={t("memoryNag.settings.closeMacros")}
                  >
                    <X className="mn-icon" aria-hidden="true" />
                  </button>
                </div>
                <div className="mn-modal-body mn-stack">
                  <p className="mn-muted">{t("memoryNag.settings.macroReferenceHelp")}</p>
                  <div className="mn-macro-list">
                    {["{{user}}", "{{char}}", "{{characters}}", "{{input}}", "{{date}}", "{{time}}"].map((macro) => (
                      <code key={macro}>{macro}</code>
                    ))}
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
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
                      className="mari-agent-settings-action mari-agent-settings-action--icon mn-icon-button"
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
                      <button type="button" className="mari-agent-settings-action" onClick={stopScan}>
                        <Square className="mn-icon" aria-hidden="true" />
                        {t("memoryNag.settings.stop")}
                      </button>
                    ) : (
                      <>
                        <button type="button" className="mari-agent-settings-action" onClick={() => setScanOpen(false)}>
                          {t("memoryNag.settings.closeProgress")}
                        </button>
                        <button
                          type="button"
                          className="mari-agent-settings-action mari-agent-settings-action--primary"
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
