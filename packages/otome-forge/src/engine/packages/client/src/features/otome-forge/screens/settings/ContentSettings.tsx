// ──────────────────────────────────────────────
// Otome Forge Settings → Content: the story's Heat, Darkness, Lines & Veils, language and how it's written, and the player's 18+
// confirmation (withdrawing it drops every story to SFW Heat, Angst and SFW images).
// ──────────────────────────────────────────────
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Save, ShieldCheck, ShieldOff } from "lucide-react";
import { useOtomeApi } from "../../api";
import { useAgeGate } from "../../components/AgeGateDialog";
import { Dialog } from "../../components/Dialog";
import { INDEX_QUERY_KEY } from "../../hooks/use-index";
import { useSaveSettings, type SaveSettings } from "../../hooks/use-run";
import { useOtomeProps } from "../../props";
import type { OtomeIndex, RunView } from "../../shared/api-types";
import { OWN_BANNED_PHRASES_MAX } from "../../shared/banned-phrases";
import type { ContentSettings as Content } from "../../shared/content";
import { ContentControls } from "../setup/ContentStep";
import { LANGUAGE_MAX, LANGUAGE_SUGGESTIONS } from "../setup/draft";
import { Section, TextField } from "../setup/parts";

/**
 * A key for a story form that changes with the stored values, so the form starts again from them when they change
 * elsewhere (a save, or withdrawing the 18+ confirmation, which lowers every story).
 */
export const storedKey = (...values: unknown[]) => JSON.stringify(values);

/** Shown on a story tab while there is no story. */
export function NoStory() {
  const { t } = useTranslation();
  return <p className="of-notice">{t("ui.otomeForge.settings.noStory")}</p>;
}

function GateStatus() {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const gate = useAgeGate();
  const { locale } = useOtomeProps().localization;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmedOn = gate.confirmedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(gate.confirmedAt))
    : "";

  const revoke = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { ageGate } = await otome.post<{ ageGate: OtomeIndex["ageGate"] }>("/age-gate/revoke");
      queryClient.setQueryData<OtomeIndex>(INDEX_QUERY_KEY, (index) => (index ? { ...index, ageGate } : index));
      void queryClient.invalidateQueries({ queryKey: ["otome-forge", "run"] });
      setConfirming(false);
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t("ui.otomeForge.gate.settingsTitle")}>
      {gate.confirmed ? (
        <>
          <p className="of-body">{t("ui.otomeForge.gate.confirmedOn", { date: confirmedOn })}</p>
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            onClick={() => setConfirming(true)}
          >
            <ShieldOff size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.gate.revoke")}
          </button>
        </>
      ) : (
        <>
          <p className="of-body">{t("ui.otomeForge.gate.lockedNote")}</p>
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            onClick={() => void gate.request()}
          >
            <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.gate.open")}
          </button>
        </>
      )}
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <Dialog
          title={t("ui.otomeForge.gate.revokeTitle")}
          onClose={busy ? undefined : () => setConfirming(false)}
          actions={
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                onClick={() => setConfirming(false)}
              >
                {t("ui.otomeForge.gate.revokeKeep")}
              </button>
              <button
                type="button"
                className="of-button of-button--primary"
                aria-disabled={busy}
                onClick={() => void revoke()}
              >
                {t("ui.otomeForge.gate.revokeConfirm")}
              </button>
            </>
          }
        >
          <p className="of-body">{t("ui.otomeForge.gate.revokeText")}</p>
        </Dialog>
      ) : null}
      {gate.dialog}
    </Section>
  );
}

function StoryContent({ run, settings }: { run: RunView; settings: SaveSettings }) {
  const { t } = useTranslation();
  const gate = useAgeGate();
  const [content, setContent] = useState<Content>(run.world.content);
  const [language, setLanguage] = useState(run.world.language);
  const [writingStyle, setWritingStyle] = useState(run.world.writingStyle ?? "");
  const [bannedPhrases, setBannedPhrases] = useState(run.world.bannedPhrases ?? "");
  const languagesId = useId();
  const styleChanged = writingStyle.trim() !== (run.world.writingStyle ?? "");
  const bannedChanged = bannedPhrases.trim() !== (run.world.bannedPhrases ?? "");
  const changed =
    JSON.stringify(content) !== JSON.stringify(run.world.content) ||
    language.trim() !== run.world.language ||
    styleChanged ||
    bannedChanged;
  return (
    <>
      <ContentControls content={content} gate={gate} onChange={setContent} />
      <TextField
        label={t("ui.otomeForge.setup.languageLabel")}
        hint={t("ui.otomeForge.settings.languageHint")}
        list={languagesId}
        max={LANGUAGE_MAX}
        value={language}
        onChange={setLanguage}
      />
      <datalist id={languagesId}>
        {LANGUAGE_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <TextField
        label={t("ui.otomeForge.setup.writingStyleLabel")}
        hint={t("ui.otomeForge.setup.writingStyleHint")}
        placeholder={t("ui.otomeForge.setup.writingStylePlaceholder")}
        rows={3}
        value={writingStyle}
        onChange={setWritingStyle}
      />
      <TextField
        label={t("ui.otomeForge.settings.bannedPhrasesLabel")}
        hint={t("ui.otomeForge.settings.bannedPhrasesHint")}
        placeholder={t("ui.otomeForge.settings.bannedPhrasesPlaceholder")}
        rows={3}
        max={OWN_BANNED_PHRASES_MAX}
        counter
        value={bannedPhrases}
        onChange={setBannedPhrases}
      />
      <SaveBar
        changed={changed && !!language.trim()}
        busy={settings.busy}
        status={settings.status}
        onSave={() =>
          void settings.save(
            {
              content,
              ...(language.trim() !== run.world.language ? { language: language.trim() } : {}),
              ...(styleChanged ? { writingStyle: writingStyle.trim() } : {}),
              ...(bannedChanged ? { bannedPhrases: bannedPhrases.trim() } : {}),
            },
            t("ui.otomeForge.settings.saved"),
          )
        }
      />
      {gate.dialog}
    </>
  );
}

/** The save row every story settings tab ends with. */
export function SaveBar({
  changed,
  busy,
  status,
  onSave,
}: {
  changed: boolean;
  busy: boolean;
  status: { error: boolean; text: string } | null;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="of-save-bar">
      <div className="of-live" role="status" aria-live="polite">
        {status ? <p className={status.error ? "of-notice of-notice--error" : "of-hint"}>{status.text}</p> : null}
      </div>
      <button
        type="button"
        className="of-button of-button--primary"
        aria-disabled={!changed || busy}
        onClick={() => {
          if (changed && !busy) onSave();
        }}
      >
        <Save size={16} strokeWidth={2} aria-hidden="true" />
        {busy ? t("ui.otomeForge.settings.saving") : t("ui.otomeForge.settings.save")}
      </button>
    </div>
  );
}

export function ContentSettings({ run }: { run: RunView | null }) {
  const settings = useSaveSettings(run?.runKey ?? null);
  return (
    <div className="of-step-body">
      <GateStatus />
      {run ? (
        <StoryContent
          key={storedKey(
            run.runKey,
            run.world.content,
            run.world.language,
            run.world.writingStyle ?? "",
            run.world.bannedPhrases ?? "",
          )}
          run={run}
          settings={settings}
        />
      ) : (
        <NoStory />
      )}
    </div>
  );
}
