// ──────────────────────────────────────────────
// Otome Forge Settings → Connections: the story's text connection for each job ("Same as story" by default), how many
// love interests may write first each day, each once (#2044, S/phone/daily.ts; 0, the default, is off), how many times
// a day they may squabble in the group chat on their own (#2154, S/phone/group.ts; 0, the default, is off), and the story
// memory's status with its Retry (Debug's MemorySection), next to the connection that writes the summaries. Opened by
// the memory banner for a failed summary, it shows that connection (Memory, under More connections), focused.
// Memory recall embeddings (0.19.0, S/memory/recall-index.ts): the model that indexes the chapter summaries for
// long-term recall, Built-in (local) by default, or a connection with an embedding model of its own, which only an
// Engine with capability API 1.818 offers (the index's status says); the server checks it on save. The index's status
// and Retry indexing are in the memory section.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RetryNotice } from "../../components/RetryNotice";
import { useConnections } from "../../hooks/use-engine-resources";
import { useRecallIndex } from "../../hooks/use-memory";
import { useSaveSettings, type SaveSettings } from "../../hooks/use-run";
import type { Connections, RunView } from "../../shared/api-types";
import { DAILY_MESSAGES_MAX } from "../../shared/home";
import { ConnectionControls } from "../setup/ConnectionsStep";
import type { DraftConnections } from "../setup/draft";
import { ConnectionSelect, TextField } from "../setup/parts";
import { NoStory, SaveBar, storedKey } from "./ContentSettings";
import { embeddingOptions } from "../../lib/recall-choice";
import { MemorySection } from "./Debug";

const toForm = (connections: Connections): DraftConnections => ({
  narration: connections.narration,
  structured: connections.structured ?? "",
  chat: connections.chat ?? "",
  compress: connections.compress ?? "",
});

/** The connections as saved; `embeddings` "" is the built-in embedding model. */
function toConnections(form: DraftConnections, embeddings: string): Connections {
  const own = (id: string) => (id && id !== form.narration ? id : undefined);
  return {
    narration: form.narration,
    ...(own(form.structured) ? { structured: form.structured } : {}),
    ...(own(form.chat) ? { chat: form.chat } : {}),
    ...(own(form.compress) ? { compress: form.compress } : {}),
    ...(embeddings ? { embeddings } : {}),
  };
}

/** A number a day as typed, when it is a whole number from 0 to DAILY_MESSAGES_MAX; otherwise null. */
function dailyOf(text: string): number | null {
  const value = text.trim() === "" ? Number.NaN : Number(text);
  return Number.isInteger(value) && value >= 0 && value <= DAILY_MESSAGES_MAX ? value : null;
}

/** Settings' way to the Memory connection (ConnectionControls revealMemory), shown once. */
interface RevealMemory {
  revealMemory?: boolean;
  onMemoryRevealed?: () => void;
}

function StoryConnections({
  run,
  settings,
  revealMemory,
  onMemoryRevealed,
}: { run: RunView; settings: SaveSettings } & RevealMemory) {
  const { t } = useTranslation();
  const connections = useConnections();
  const [form, setForm] = useState(() => toForm(run.world.connections));
  const storedEmbeddings = run.world.connections.embeddings ?? "";
  const [embeddings, setEmbeddings] = useState(storedEmbeddings);
  // An Engine before capability API 1.818 has only its built-in model to offer; until the recall status says which
  // this Engine is (loading, or failed to load), only the saved choice is listed (lib/recall-choice.ts).
  const recallStatus = useRecallIndex(run.runKey).status;
  const olderEngine = recallStatus?.choosable === false;
  const stored = run.world.dailyMessages ?? 0;
  const [dailyText, setDailyText] = useState(() => String(stored));
  const daily = dailyOf(dailyText);
  const storedSquabbles = run.world.groupSquabbles ?? 0;
  const [squabblesText, setSquabblesText] = useState(() => String(storedSquabbles));
  const squabbles = dailyOf(squabblesText);
  const connectionsChanged =
    JSON.stringify(toConnections(form, storedEmbeddings)) !==
    JSON.stringify(toConnections(toForm(run.world.connections), storedEmbeddings));
  const embeddingsChanged = embeddings !== storedEmbeddings;
  const changed = connectionsChanged || embeddingsChanged || daily !== stored || squabbles !== storedSquabbles;
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
      <RetryNotice
        message={t("ui.otomeForge.setup.connectionsFailed")}
        onRetry={() => void connections.refetch()}
        retrying={connections.retrying}
      />
    );
  }
  return (
    <>
      <ConnectionControls
        value={form}
        connections={connections.text}
        onChange={setForm}
        onCheckAgain={connections.refetch}
        revealMemory={revealMemory}
        onMemoryRevealed={onMemoryRevealed}
      />
      <ConnectionSelect
        label={t("ui.otomeForge.settings.embeddingsLabel")}
        hint={t(olderEngine ? "ui.otomeForge.settings.embeddingsOlderEngine" : "ui.otomeForge.settings.embeddingsHint")}
        value={embeddings}
        connections={embeddingOptions(recallStatus, connections.embeddings, storedEmbeddings)}
        emptyLabel={t("ui.otomeForge.settings.embeddingsBuiltIn")}
        onChange={setEmbeddings}
      />
      <TextField
        label={t("ui.otomeForge.settings.dailyMessages")}
        type="number"
        min={0}
        max={DAILY_MESSAGES_MAX}
        value={dailyText}
        onChange={setDailyText}
        invalid={daily === null}
        hint={t(
          daily === null ? "ui.otomeForge.settings.dailyMessagesInvalid" : "ui.otomeForge.settings.dailyMessagesHint",
          {
            max: DAILY_MESSAGES_MAX,
          },
        )}
      />
      <TextField
        label={t("ui.otomeForge.settings.groupSquabbles")}
        type="number"
        min={0}
        max={DAILY_MESSAGES_MAX}
        value={squabblesText}
        onChange={setSquabblesText}
        invalid={squabbles === null}
        hint={t(
          squabbles === null
            ? "ui.otomeForge.settings.dailyMessagesInvalid"
            : "ui.otomeForge.settings.groupSquabblesHint",
          { max: DAILY_MESSAGES_MAX },
        )}
      />
      <SaveBar
        changed={changed && !!form.narration && daily !== null && squabbles !== null}
        busy={settings.busy}
        status={settings.status}
        onSave={() => {
          if (daily === null || squabbles === null) return;
          // The connections' note is about scenes; the embedding model, the daily number and the squabbles get their own.
          void settings.save(
            { connections: toConnections(form, embeddings), dailyMessages: daily, groupSquabbles: squabbles },
            t(
              connectionsChanged
                ? "ui.otomeForge.settings.saved"
                : embeddingsChanged
                  ? "ui.otomeForge.settings.embeddingsSaved"
                  : daily !== stored
                    ? "ui.otomeForge.settings.dailyMessagesSaved"
                    : "ui.otomeForge.settings.groupSquabblesSaved",
            ),
          );
        }}
      />
    </>
  );
}

export function ConnectionsSettings({ run, ...reveal }: { run: RunView | null } & RevealMemory) {
  const { t } = useTranslation();
  const settings = useSaveSettings(run?.runKey ?? null);
  return (
    <div className="of-step-body">
      <p className="of-hint">{t("ui.otomeForge.settings.connectionsIntro")}</p>
      {run ? (
        <>
          <StoryConnections
            key={storedKey(run.runKey, run.world.connections)}
            run={run}
            settings={settings}
            {...reveal}
          />
          <MemorySection runKey={run.runKey} />
        </>
      ) : (
        <NoStory />
      )}
    </div>
  );
}
