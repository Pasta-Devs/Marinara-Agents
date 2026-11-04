// ──────────────────────────────────────────────
// Otome Forge Settings → Debug: whether prompts are being logged, the story's ids and connections, the raw error of
// every step that failed (English, for logs and bug reports), with a copy button, and the story memory's status with
// its Retry (a failed summary is never retried by itself) and the provider's whole message (Otome's own, on a line of
// its own and not as the connection's, when the memory model is too small). The status and Retry are
// hooks/use-memory.ts's, shared with the banner every screen of the story shows (components/MemoryBanner.tsx). The
// memory section is also under Settings → Connections, beside the connection that writes the summaries.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCopy, RotateCcw } from "lucide-react";
import { useOtomeApi } from "../../api";
import { useMemoryStatus } from "../../hooks/use-memory";
import { ownMessage } from "../../lib/memory-notice";
import { useOtomeProps } from "../../props";
import type { MemoryStatus, RunView } from "../../shared/api-types";
import { Section } from "../setup/parts";

const MEMORY_PHASE_KEYS: Record<MemoryStatus["phase"], string> = {
  ready: "ui.otomeForge.settings.debugMemoryReady",
  pending: "ui.otomeForge.settings.debugMemoryPending",
  stale: "ui.otomeForge.settings.debugMemoryStale",
  error: "ui.otomeForge.settings.debugMemoryError",
};

export function MemorySection({ runKey }: { runKey: string }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const memory = useMemoryStatus(runKey, { watching: true });
  const { status, busy, error } = memory;
  const noConnection = memory.notice?.kind === "no-connection";

  return (
    <Section title={t("ui.otomeForge.settings.debugMemory")}>
      <p className="of-body" role="status">
        {status
          ? t(
              noConnection
                ? "ui.otomeForge.memory.noConnection"
                : (MEMORY_PHASE_KEYS[status.phase] ?? "ui.otomeForge.settings.debugMemoryStale"),
            )
          : memory.query.isError
            ? otome.errorMessage(memory.query.error)
            : t("ui.otomeForge.settings.debugMemoryLoading")}
      </p>
      {status?.message && ownMessage(status) ? <p className="of-body">{status.message}</p> : null}
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
          {status.message && !ownMessage(status) ? (
            <>
              <dt>{t("ui.otomeForge.settings.debugMemoryMessage")}</dt>
              <dd>
                <code>{status.message}</code>
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {status && status.phase !== "pending" && status.phase !== "ready" && !noConnection ? (
        <div className="of-actions of-actions--start">
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            aria-disabled={busy}
            onClick={() => void memory.retry()}
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
