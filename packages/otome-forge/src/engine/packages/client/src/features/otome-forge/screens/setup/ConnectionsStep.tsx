// ──────────────────────────────────────────────
// Otome Forge setup, step 5: connections. One text connection for the story, optional ones for planning, the phone
// and memory, and an optional image connection (the game is fully playable without one). "Edit" opens the Engine's
// own connection editor. The same controls serve Settings → Connections and Settings → Images.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { ImageOff, PlugZap } from "lucide-react";
import { CostHint } from "../../components/CostHint";
import { CheckAgain, RetryNotice } from "../../components/RetryNotice";
import { useConnections, type ConnectionOption } from "../../hooks/use-engine-resources";
import { IMAGE_STYLE_MAX } from "../../shared/content";
import { FACES_PER_LOOK, type DraftConnections, type DraftImages, type SetupDraft } from "./draft";
import { ConnectionSelect, Section, Switch, TextField } from "./parts";

interface ConnectionControlsProps {
  value: DraftConnections;
  onChange: (value: DraftConnections) => void;
  connections: readonly ConnectionOption[];
  /** Asks the Engine again, offered while there are none (the player adds one in its Connections panel). */
  onCheckAgain?: () => Promise<unknown>;
}

export function ConnectionControls({ value, onChange, connections, onCheckAgain }: ConnectionControlsProps) {
  const { t } = useTranslation();
  const same = t("ui.otomeForge.setup.sameAsStory");
  if (connections.length === 0) {
    return (
      <div className="of-empty of-glass">
        <PlugZap size={22} strokeWidth={1.7} aria-hidden="true" />
        <p>{t("ui.otomeForge.setup.noTextConnections")}</p>
        {onCheckAgain ? <CheckAgain onCheck={onCheckAgain} /> : null}
      </div>
    );
  }
  return (
    <>
      <ConnectionSelect
        label={t("ui.otomeForge.setup.connectionNarration")}
        hint={t("ui.otomeForge.setup.connectionNarrationHint")}
        value={value.narration}
        connections={connections}
        onChange={(narration) => onChange({ ...value, narration })}
      />
      <details className="of-details">
        <summary className="of-summary">{t("ui.otomeForge.setup.connectionsMore")}</summary>
        <div className="of-details-body">
          <ConnectionSelect
            label={t("ui.otomeForge.setup.connectionStructured")}
            hint={t("ui.otomeForge.setup.connectionStructuredHint")}
            value={value.structured}
            connections={connections}
            emptyLabel={same}
            onChange={(structured) => onChange({ ...value, structured })}
          />
          <ConnectionSelect
            label={t("ui.otomeForge.setup.connectionChat")}
            hint={t("ui.otomeForge.setup.connectionChatHint")}
            value={value.chat}
            connections={connections}
            emptyLabel={same}
            onChange={(chat) => onChange({ ...value, chat })}
          />
          <ConnectionSelect
            label={t("ui.otomeForge.setup.connectionCompress")}
            hint={t("ui.otomeForge.setup.connectionCompressHint")}
            value={value.compress}
            connections={connections}
            emptyLabel={same}
            onChange={(compress) => onChange({ ...value, compress })}
          />
        </div>
      </details>
    </>
  );
}

interface ImageControlsProps {
  value: Pick<DraftImages, "connectionId" | "ask" | "expressions" | "style">;
  onChange: (value: Pick<DraftImages, "connectionId" | "ask" | "expressions" | "style">) => void;
  connections: readonly ConnectionOption[];
  /** How many love interests have looks, for the expression estimate. */
  lis: number;
}

export function ImageControls({ value, onChange, connections, lis }: ImageControlsProps) {
  const { t } = useTranslation();
  return (
    <>
      <ConnectionSelect
        label={t("ui.otomeForge.setup.connectionImage")}
        value={value.connectionId ?? ""}
        connections={connections}
        emptyLabel={t("ui.otomeForge.setup.noImages")}
        onChange={(connectionId) => onChange({ ...value, connectionId: connectionId || null })}
        hint={connections.length === 0 ? t("ui.otomeForge.setup.noImageConnections") : undefined}
      />
      {value.connectionId ? (
        <>
          <TextField
            label={t("ui.otomeForge.setup.imageStyleLabel")}
            hint={t("ui.otomeForge.setup.imageStyleHint")}
            placeholder={t("ui.otomeForge.setup.imageStylePlaceholder")}
            value={value.style}
            max={IMAGE_STYLE_MAX}
            onChange={(style) => onChange({ ...value, style })}
          />
          <Switch
            label={t("ui.otomeForge.setup.askLabel")}
            hint={t("ui.otomeForge.setup.askHint")}
            checked={value.ask}
            onChange={(ask) => onChange({ ...value, ask })}
          />
          <Switch
            label={t("ui.otomeForge.setup.expressionsLabel")}
            hint={
              <>
                {t("ui.otomeForge.setup.expressionsHint")}
                <CostHint
                  images={FACES_PER_LOOK * Math.max(1, lis)}
                  about
                  note={t("ui.otomeForge.setup.expressionsCostNote", { count: FACES_PER_LOOK })}
                />
              </>
            }
            checked={value.expressions}
            onChange={(expressions) => onChange({ ...value, expressions })}
          />
        </>
      ) : (
        <div className="of-empty">
          <ImageOff size={20} strokeWidth={1.7} aria-hidden="true" />
          <p>{t("ui.otomeForge.setup.withoutImages")}</p>
        </div>
      )}
    </>
  );
}

interface ConnectionsStepProps {
  draft: SetupDraft;
  update: (change: (draft: SetupDraft) => SetupDraft) => void;
}

export function ConnectionsStep({ draft, update }: ConnectionsStepProps) {
  const { t } = useTranslation();
  const connections = useConnections();
  if (connections.isLoading) {
    return (
      <div className="of-step-body">
        <p className="of-hint" role="status">
          {t("ui.otomeForge.setup.loadingConnections")}
        </p>
      </div>
    );
  }
  // A failed list is not an empty one: the player is not told to add connections they may already have.
  if (connections.isError && connections.text.length === 0) {
    return (
      <div className="of-step-body">
        <p className="of-hand of-step-note">{t("ui.otomeForge.setup.connectionsNote")}</p>
        <RetryNotice
          message={t("ui.otomeForge.setup.connectionsFailed")}
          onRetry={() => void connections.refetch()}
          retrying={connections.retrying}
        />
      </div>
    );
  }
  return (
    <div className="of-step-body">
      <p className="of-hand of-step-note">{t("ui.otomeForge.setup.connectionsNote")}</p>
      {connections.isError ? (
        <RetryNotice
          message={t("ui.otomeForge.setup.connectionsFailed")}
          onRetry={() => void connections.refetch()}
          retrying={connections.retrying}
        />
      ) : null}
      <Section title={t("ui.otomeForge.setup.textConnections")}>
        <ConnectionControls
          value={draft.connections}
          connections={connections.text}
          onChange={(value) => update((current) => ({ ...current, connections: value }))}
          onCheckAgain={connections.isError ? undefined : connections.refetch}
        />
      </Section>
      <Section title={t("ui.otomeForge.setup.imageConnections")} hint={t("ui.otomeForge.setup.imagesOptional")}>
        <ImageControls
          value={draft.images}
          connections={connections.image}
          lis={draft.lis.length}
          onChange={(value) => update((current) => ({ ...current, images: { ...current.images, ...value } }))}
        />
      </Section>
    </div>
  );
}
