// ──────────────────────────────────────────────
// Otome Forge Settings → Debug: whether prompts are being logged, the story's ids and connections, the raw error of
// every step that failed (English, for logs and bug reports), with a copy button, and the story memory's status with
// its Retry (a failed summary is never retried by itself). Polls every 2 s while memory upkeep runs.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCopy, RotateCcw } from "lucide-react";
import { useOtomeApi } from "../../api";
import { useOtomeProps } from "../../props";
import type { MemoryStatus, RunView } from "../../shared/api-types";
import { Section } from "../setup/parts";

const MEMORY_PHASE_KEYS: Record<MemoryStatus["phase"], string> = {
  ready: "ui.otomeForge.settings.debugMemoryReady",
  pending: "ui.otomeForge.settings.debugMemoryPending",
  stale: "ui.otomeForge.settings.debugMemoryStale",
  error: "ui.otomeForge.settings.debugMemoryError",
  "context-unknown": "ui.otomeForge.settings.debugMemoryContextUnknown",
};

function MemorySection({ runKey }: { runKey: string }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const path = `/runs/${encodeURIComponent(runKey)}/memory`;
  const queryKey = ["otome-forge", "memory", runKey] as const;
  const memory = useQuery({
    queryKey,
    queryFn: async () => (await otome.get<{ status: MemoryStatus }>(`${path}/status`)).status,
    refetchInterval: (query) => (query.state.data?.phase === "pending" ? 2_000 : false),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = memory.data;

  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      queryClient.setQueryData(queryKey, (await otome.post<{ status: MemoryStatus }>(`${path}/retry`)).status);
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t("ui.otomeForge.settings.debugMemory")}>
      <p className="of-body" role="status">
        {status
          ? t(MEMORY_PHASE_KEYS[status.phase] ?? "ui.otomeForge.settings.debugMemoryStale")
          : memory.isError
            ? otome.errorMessage(memory.error)
            : t("ui.otomeForge.settings.debugMemoryLoading")}
      </p>
      {status ? (
        <dl className="of-review-list">
          <dt>{t("ui.otomeForge.settings.debugMemoryRecords")}</dt>
          <dd>
            <code>{status.recordCount ?? 0}</code>
          </dd>
          {status.reason ? (
            <>
              <dt>{t("ui.otomeForge.settings.debugMemoryReason")}</dt>
              <dd>
                <code>{status.reason}</code>
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {status && status.phase !== "pending" && status.phase !== "ready" ? (
        <div className="of-actions of-actions--start">
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) void retry();
            }}
          >
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.settings.debugMemoryRetry")}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="of-hint" role="alert">
          {error}
        </p>
      ) : null}
    </Section>
  );
}

export function DebugSettings({ run }: { run: RunView | null }) {
  const { t } = useTranslation();
  const { debugMode, timeZone, reviewImagePromptsBeforeSend } = useOtomeProps();
  const [copied, setCopied] = useState<boolean | null>(null);
  const diagnostics = {
    debugMode,
    timeZone,
    reviewImagePromptsBeforeSend,
    run: run
      ? {
          runKey: run.runKey,
          language: run.world.language,
          content: run.world.content,
          images: run.world.images,
          connections: run.world.connections,
          forge: run.forge,
        }
      : null,
  };
  const failed = run?.forge.steps.filter((step) => step.state === "failed") ?? [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="of-step-body">
      <Section title={t("ui.otomeForge.settings.debugLogging")}>
        <p className="of-body">
          {debugMode ? t("ui.otomeForge.settings.debugOn") : t("ui.otomeForge.settings.debugOff")}
        </p>
        <p className="of-hint">{t("ui.otomeForge.settings.debugHow")}</p>
      </Section>
      {run ? (
        <Section title={t("ui.otomeForge.settings.debugStory")}>
          <dl className="of-review-list">
            <dt>{t("ui.otomeForge.settings.debugRunKey")}</dt>
            <dd>
              <code>{run.runKey}</code>
            </dd>
            <dt>{t("ui.otomeForge.settings.debugTimeZone")}</dt>
            <dd>
              <code>{timeZone}</code>
            </dd>
          </dl>
          {failed.length ? (
            <ul className="of-debug-errors">
              {failed.map((step) => (
                <li key={step.id}>
                  <code>{step.id}</code>
                  <span>{step.error ?? t("ui.otomeForge.settings.debugNoDetail")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="of-hint">{t("ui.otomeForge.settings.debugNoErrors")}</p>
          )}
        </Section>
      ) : null}
      {run ? <MemorySection runKey={run.runKey} /> : null}
      <div className="of-actions of-actions--start">
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-button--small"
          onClick={() => void copy()}
        >
          <ClipboardCopy size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.settings.debugCopy")}
        </button>
      </div>
      <p className="of-hint" role="status" aria-live="polite">
        {copied === null
          ? ""
          : copied
            ? t("ui.otomeForge.settings.debugCopied")
            : t("ui.otomeForge.settings.debugCopyFailed")}
      </p>
    </div>
  );
}
