// ──────────────────────────────────────────────
// Otome Forge Settings → Connections: the story's text connection for each job ("Same as story" by default)
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConnections } from "../../hooks/use-engine-resources";
import { useSaveSettings, type SaveSettings } from "../../hooks/use-run";
import type { Connections, RunView } from "../../shared/api-types";
import { ConnectionControls } from "../setup/ConnectionsStep";
import type { DraftConnections } from "../setup/draft";
import { NoStory, SaveBar, storedKey } from "./ContentSettings";

const toForm = (connections: Connections): DraftConnections => ({
  narration: connections.narration,
  structured: connections.structured ?? "",
  chat: connections.chat ?? "",
  compress: connections.compress ?? "",
});

function toConnections(form: DraftConnections): Connections {
  const own = (id: string) => (id && id !== form.narration ? id : undefined);
  return {
    narration: form.narration,
    ...(own(form.structured) ? { structured: form.structured } : {}),
    ...(own(form.chat) ? { chat: form.chat } : {}),
    ...(own(form.compress) ? { compress: form.compress } : {}),
  };
}

function StoryConnections({ run, settings }: { run: RunView; settings: SaveSettings }) {
  const { t } = useTranslation();
  const connections = useConnections();
  const [form, setForm] = useState(() => toForm(run.world.connections));
  const changed = JSON.stringify(toConnections(form)) !== JSON.stringify(toConnections(toForm(run.world.connections)));
  if (connections.isLoading) {
    return (
      <p className="of-hint" role="status">
        {t("ui.otomeForge.setup.loadingConnections")}
      </p>
    );
  }
  // A failed list is not an empty one: the player is not told to add a connection they already have.
  if (connections.isError && connections.text.length === 0) {
    return (
      <p className="of-notice of-notice--error" role="alert">
        {t("ui.otomeForge.setup.connectionsFailed")}
      </p>
    );
  }
  return (
    <>
      <ConnectionControls value={form} connections={connections.text} onChange={setForm} />
      <SaveBar
        changed={changed && !!form.narration}
        busy={settings.busy}
        status={settings.status}
        onSave={() => void settings.save({ connections: toConnections(form) }, t("ui.otomeForge.settings.saved"))}
      />
    </>
  );
}

export function ConnectionsSettings({ run }: { run: RunView | null }) {
  const { t } = useTranslation();
  const settings = useSaveSettings(run?.runKey ?? null);
  return (
    <div className="of-step-body">
      <p className="of-hint">{t("ui.otomeForge.settings.connectionsIntro")}</p>
      {run ? (
        <StoryConnections key={storedKey(run.runKey, run.world.connections)} run={run} settings={settings} />
      ) : (
        <NoStory />
      )}
    </div>
  );
}
