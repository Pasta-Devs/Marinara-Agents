// ──────────────────────────────────────────────
// Otome Forge Settings → Connections: the story's text connection for each job ("Same as story" by default), how many
// love interests may write first each day, each once (#2044, S/phone/daily.ts; 0, the default, is off), how many times
// a day they may squabble in the group chat on their own (#2154, S/phone/group.ts; 0, the default, is off), how many
// times a week one may ask her on a date (#2424, S/phone/invite.ts; 0, the default, is off), all three the setup's
// fields (setup/ConnectionsStep.tsx MessageNumbers), and the story
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
import { ConnectionControls, MessageNumbers } from "../setup/ConnectionsStep";
import { messageNumbersOf, savedConnections, type DraftConnections, type DraftMessages } from "../setup/draft";
import { ConnectionSelect } from "../setup/parts";
import { NoStory, SaveBar, storedKey } from "./ContentSettings";
import { embeddingOptions } from "../../lib/recall-choice";
import { MemorySection } from "./Debug";

const toForm = (connections: Connections): DraftConnections => ({
  narration: connections.narration,
  structured: connections.structured ?? "",
  chat: connections.chat ?? "",
  compress: connections.compress ?? "",
});

/** The story's three numbers, as the fields show them. */
const messagesOf = (world: RunView["world"]): DraftMessages => ({
  daily: String(world.dailyMessages ?? 0),
  squabbles: String(world.groupSquabbles ?? 0),
  invites: String(world.dateInvites ?? 0),
});

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
  const stored = messageNumbersOf(messagesOf(run.world))!;
  const [messagesText, setMessagesText] = useState(() => messagesOf(run.world));
  const numbers = messageNumbersOf(messagesText);
  const moved = (field: keyof typeof stored) => !!numbers && numbers[field] !== stored[field];
  const connectionsChanged =
    JSON.stringify(savedConnections(form, storedEmbeddings)) !==
    JSON.stringify(savedConnections(toForm(run.world.connections), storedEmbeddings));
  const embeddingsChanged = embeddings !== storedEmbeddings;
  const changed =
    connectionsChanged ||
    embeddingsChanged ||
    !numbers ||
    moved("dailyMessages") ||
    moved("groupSquabbles") ||
    moved("dateInvites");
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
      <MessageNumbers value={messagesText} onChange={setMessagesText} />
      <SaveBar
        changed={changed && !!form.narration && !!numbers}
        busy={settings.busy}
        status={settings.status}
        onSave={() => {
          if (!numbers) return;
          // The connections' note is about scenes; the embedding model and each number get their own.
          void settings.save(
            { connections: savedConnections(form, embeddings), ...numbers },
            t(
              connectionsChanged
                ? "ui.otomeForge.settings.saved"
                : embeddingsChanged
                  ? "ui.otomeForge.settings.embeddingsSaved"
                  : moved("dailyMessages")
                    ? "ui.otomeForge.settings.dailyMessagesSaved"
                    : moved("groupSquabbles")
                      ? "ui.otomeForge.settings.groupSquabblesSaved"
                      : "ui.otomeForge.settings.dateInvitesSaved",
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
