// ──────────────────────────────────────────────
// Otome Forge setup, step 5: connections. One text connection for the story, optional ones for planning, the phone
// and memory, and an optional image connection (the game is fully playable without one). "Edit" opens the Engine's
// own connection editor. The same controls serve Settings → Connections and Settings → Images. A text connection set
// to a context window under STORY_CONTEXT_MIN gets a warning (#2066): a story prompt carries the story's timeline and
// the previous chapter in full, so a smaller one soon runs out of room. It is never refused. The memory banner's way
// to Settings → Connections (components/MemoryBanner.tsx) opens More connections at the Memory connection, focused.
// ──────────────────────────────────────────────
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ImageOff, PlugZap } from "lucide-react";
import { CostHint } from "../../components/CostHint";
import { CheckAgain, RetryNotice } from "../../components/RetryNotice";
import { useConnections, type ConnectionOption } from "../../hooks/use-engine-resources";
import { useImageStyleProfiles } from "../../hooks/use-image-style-profiles";
import { IMAGE_STYLE_MAX } from "../../shared/content";
import { FACES_PER_LOOK, type DraftConnections, type DraftImages, type SetupDraft } from "./draft";
import { ConnectionSelect, Section, Switch, TextField } from "./parts";

/** The context window, in tokens, a story's text connections should have (#2066). */
const STORY_CONTEXT_MIN = 32_000;

interface ConnectionControlsProps {
  value: DraftConnections;
  onChange: (value: DraftConnections) => void;
  connections: readonly ConnectionOption[];
  /** Asks the Engine again, offered while there are none (the player adds one in its Connections panel). */
  onCheckAgain?: () => Promise<unknown>;
  /** Brings the player to the Memory connection: opens More connections and focuses it, then says so (once). */
  revealMemory?: boolean;
  onMemoryRevealed?: () => void;
}

export function ConnectionControls({
  value,
  onChange,
  connections,
  onCheckAgain,
  revealMemory = false,
  onMemoryRevealed,
}: ConnectionControlsProps) {
  const { t } = useTranslation();
  const same = t("ui.otomeForge.setup.sameAsStory");
  const more = useRef<HTMLDetailsElement>(null);
  const memory = useRef<HTMLSelectElement>(null);
  // The latest callback, so a parent's new one neither runs the reveal again nor cancels its frame.
  const revealed = useRef(onMemoryRevealed);
  useLayoutEffect(() => {
    revealed.current = onMemoryRevealed;
  });
  const listed = connections.length > 0;
  useEffect(() => {
    const [details, select] = [more.current, memory.current];
    // With no connections listed yet there is nothing to show: the reveal waits until they are, and runs then, not on
    // every render, so a More connections the player closed stays closed.
    if (!revealMemory || !listed || !details || !select) return;
    details.open = true;
    // A frame later: a screen just opened moves focus to its heading after this runs (OtomeForgeView).
    const frame = requestAnimationFrame(() => {
      select.focus();
      revealed.current?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [revealMemory, listed]);
  if (!listed) {
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
        minContext={STORY_CONTEXT_MIN}
        onChange={(narration) => onChange({ ...value, narration })}
      />
      <details ref={more} className="of-details">
        <summary className="of-summary">{t("ui.otomeForge.setup.connectionsMore")}</summary>
        <div className="of-details-body">
          <ConnectionSelect
            label={t("ui.otomeForge.setup.connectionStructured")}
            hint={t("ui.otomeForge.setup.connectionStructuredHint")}
            value={value.structured}
            connections={connections}
            emptyLabel={same}
            minContext={STORY_CONTEXT_MIN}
            onChange={(structured) => onChange({ ...value, structured })}
          />
          <ConnectionSelect
            label={t("ui.otomeForge.setup.connectionChat")}
            hint={t("ui.otomeForge.setup.connectionChatHint")}
            value={value.chat}
            connections={connections}
            emptyLabel={same}
            minContext={STORY_CONTEXT_MIN}
            onChange={(chat) => onChange({ ...value, chat })}
          />
          <ConnectionSelect
            label={t("ui.otomeForge.setup.connectionCompress")}
            hint={t("ui.otomeForge.setup.connectionCompressHint")}
            value={value.compress}
            connections={connections}
            emptyLabel={same}
            minContext={STORY_CONTEXT_MIN}
            selectRef={memory}
            onChange={(compress) => onChange({ ...value, compress })}
          />
        </div>
      </details>
    </>
  );
}

type ImageControlValue = Pick<DraftImages, "connectionId" | "ask" | "expressions" | "style" | "styleProfileId">;

interface ImageControlsProps {
  value: ImageControlValue;
  onChange: (value: ImageControlValue) => void;
  connections: readonly ConnectionOption[];
  /** How many love interests have looks, for the expression estimate. */
  lis: number;
}

/** Each Engine prompt mode in words: whether the profile writes sentences or tags. */
const PROMPT_MODE_KEYS: Record<string, string> = {
  natural: "ui.otomeForge.setup.imageProfileNatural",
  tagged: "ui.otomeForge.setup.imageProfileTagged",
  danbooru: "ui.otomeForge.setup.imageProfileDanbooru",
  hybrid: "ui.otomeForge.setup.imageProfileHybrid",
};

/**
 * The Engine image style profile the story's pictures follow ("" is the Engine's default): its art style, tags and
 * prompt mode. A tag profile writes tag prompts, which sentence models such as GPT Image read badly (2026-11-03).
 */
function StyleProfileSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const profiles = useImageStyleProfiles();
  const id = useId();
  const list = profiles.data?.profiles ?? [];
  const named = (profile: { name: string; promptMode: string }) =>
    PROMPT_MODE_KEYS[profile.promptMode]
      ? `${profile.name} · ${t(PROMPT_MODE_KEYS[profile.promptMode]!)}`
      : profile.name;
  const fallback = list.find((profile) => profile.id === profiles.data?.defaultProfileId) ?? list[0];
  const missing = !!value && !profiles.isLoading && !list.some((profile) => profile.id === value);
  return (
    <div className="of-field">
      <label className="of-label" htmlFor={id}>
        {t("ui.otomeForge.setup.imageProfileLabel")}
      </label>
      <select
        id={id}
        className="of-input of-select"
        value={value}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {fallback
            ? t("ui.otomeForge.setup.imageProfileDefaultNamed", { name: named(fallback) })
            : t("ui.otomeForge.setup.imageProfileDefault")}
        </option>
        {missing ? <option value={value}>{t("ui.otomeForge.setup.imageProfileMissing")}</option> : null}
        {list.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {named(profile)}
          </option>
        ))}
      </select>
      <p id={`${id}-hint`} className="of-hint">
        {t("ui.otomeForge.setup.imageProfileHint")}
      </p>
    </div>
  );
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
          <StyleProfileSelect
            value={value.styleProfileId}
            onChange={(styleProfileId) => onChange({ ...value, styleProfileId })}
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
