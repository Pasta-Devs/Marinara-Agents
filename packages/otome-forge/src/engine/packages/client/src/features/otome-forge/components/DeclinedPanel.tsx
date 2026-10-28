// ──────────────────────────────────────────────
// Otome Forge: a scene (or chapter plan) that could not be written. A refusal is said honestly ("Your model declined
// this scene") with Ease off, Retry and Switch connection; any other failure says why, with Ease off (a scene), Retry,
// and Switch connection when no connection is set or the reply was malformed. Switching saves the story's connection
// for that job (Settings → Connections does the same) and tries again.
// ──────────────────────────────────────────────
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, Feather, PlugZap, RotateCcw, ShieldAlert } from "lucide-react";
import { otomeErrorCode, useOtomeApi } from "../api";
import { useConnections } from "../hooks/use-engine-resources";
import { useSaveSettings } from "../hooks/use-run";
import type { GenerationJob, RunView } from "../shared/api-types";

interface DeclinedPanelProps {
  error: unknown;
  run: RunView;
  /** The connection the failed write used: `narration` for beats, `structured` for chapter plans. */
  job: Extract<GenerationJob, "narration" | "structured">;
  onRetry: () => void;
  /** Ends the scene without it (beats only). */
  onEaseOff?: () => void;
}

export function DeclinedPanel({ error, run, job, onRetry, onEaseOff }: DeclinedPanelProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const code = otomeErrorCode(error);
  const declined = code === "declined";
  const [switching, setSwitching] = useState(false);
  const canSwitch = declined || code === "no-connection" || code === "bad-format";
  const Icon = declined ? ShieldAlert : CircleAlert;
  return (
    <section className="of-declined of-glass of-glass--strong" role="alert">
      <div className="of-declined-head">
        <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
        <h2 className="of-section-title">
          {declined ? t("ui.otomeForge.reader.declinedTitle") : t("ui.otomeForge.reader.failedTitle")}
        </h2>
      </div>
      <p className="of-body">{declined ? t("ui.otomeForge.reader.declinedText") : otome.errorMessage(error)}</p>
      <div className="of-inline-actions">
        {onEaseOff ? (
          <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onEaseOff}>
            <Feather size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.reader.easeOff")}
          </button>
        ) : null}
        <button
          type="button"
          className="of-button of-button--primary of-button--small"
          onClick={onRetry}
          data-autofocus=""
        >
          <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.common.retry")}
        </button>
        {canSwitch && !switching ? (
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            onClick={() => setSwitching(true)}
          >
            <PlugZap size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.reader.switchConnection")}
          </button>
        ) : null}
      </div>
      {switching ? <ConnectionSwitch run={run} job={job} onSwitched={onRetry} /> : null}
    </section>
  );
}

function ConnectionSwitch({
  run,
  job,
  onSwitched,
}: {
  run: RunView;
  job: DeclinedPanelProps["job"];
  onSwitched: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const connections = useConnections();
  const settings = useSaveSettings(run.runKey);
  const using = run.world.connections[job] ?? run.world.connections.narration;
  const [picked, setPicked] = useState("");
  const others = connections.text.filter((connection) => connection.id !== using);
  const save = async () => {
    if (!picked || settings.busy) return;
    const saved = await settings.save(
      { connections: { ...run.world.connections, [job]: picked } },
      t("ui.otomeForge.settings.saved"),
    );
    if (saved) onSwitched();
  };
  if (connections.isLoading) {
    return (
      <p className="of-hint" role="status">
        {t("ui.otomeForge.setup.loadingConnections")}
      </p>
    );
  }
  if (!others.length) return <p className="of-hint">{t("ui.otomeForge.reader.noOtherConnection")}</p>;
  return (
    <div className="of-field">
      <label className="of-label" htmlFor={id}>
        {job === "structured" ? t("ui.otomeForge.reader.switchPlanning") : t("ui.otomeForge.reader.switchStory")}
      </label>
      <div className="of-select-row">
        <select
          id={id}
          className="of-input of-select"
          value={picked}
          onChange={(event) => setPicked(event.target.value)}
        >
          <option value="">{t("ui.otomeForge.setup.chooseConnection")}</option>
          {others.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.model ? `${connection.name} · ${connection.model}` : connection.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="of-button of-button--primary of-button--small"
          aria-disabled={!picked || settings.busy}
          onClick={() => void save()}
        >
          {t("ui.otomeForge.reader.switchAndRetry")}
        </button>
      </div>
      {settings.status?.error ? (
        <p className="of-notice of-notice--error" role="alert">
          {settings.status.text}
        </p>
      ) : null}
    </div>
  );
}
