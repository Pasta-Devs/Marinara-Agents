// ──────────────────────────────────────────────
// Otome Forge Settings → Debug: whether prompts are being logged, the story's ids and connections, and the raw error
// of every step that failed (English, for logs and bug reports), with a copy button.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCopy } from "lucide-react";
import { useOtomeProps } from "../../props";
import type { RunView } from "../../shared/api-types";
import { Section } from "../setup/parts";

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
