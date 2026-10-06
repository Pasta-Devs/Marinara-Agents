import { useEffect, useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  SLP_STEERING_MOODS,
  SLP_STEERING_NUDGE_MAX,
  SLP_STEERING_NUDGES_MAX,
  SLP_RELATIONSHIP_STYLES,
  SLP_STEERING_PACES,
  SLP_STEERING_TEXT_MAX,
  type SlpSteeringMood,
  type SlpRelationshipStyle,
  type SlpSteeringPace,
  type SlpSteeringSupportNote,
} from "../../../../../shared/src/slp/slp-creator-steering.js";
import type { SlpSpiceStep } from "../../../../../shared/src/slp/slp-spice.js";
import { SlpSpiceLevelChoice } from "./SlpSpiceLevelChoice";
import { ChipListInput } from "../../modules/settings/SlpSettingsInputs";
import { Toggle } from "../../modules/settings/SlpSettingsControls";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { noteClass, selectClass } from "./slp-creator-classes";
import { SlpTextAssist } from "../assist/slp-assist-contract";
import { useSlurpCreatorSteering, useSlurpCreatorSteeringMutations, type SlpCreatorSpice } from "./slp-steering-hooks";
import { useSlurpSettings } from "../settings/slp-settings-contract";

const labelClass = "block text-xs font-semibold";

/**
 * One native radio group drawn as pills: `wrap` for a longer set (moods), `row` for a short scale
 * that must stay on one line at 390 px (pace). The kit's segmented control breaks a 5–7 option set
 * into uneven rows.
 */
function PillChoice<T extends string>({
  label,
  detail,
  options,
  value,
  onChange,
  layout,
}: {
  label: string;
  detail?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  layout: "wrap" | "row";
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className={labelClass}>{label}</legend>
      <div
        className={layout === "wrap" ? "flex flex-wrap gap-1.5" : "grid gap-1"}
        style={layout === "row" ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
      >
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-full text-center text-sm font-semibold ring-1 ring-inset transition-colors focus-within:ring-2 focus-within:ring-[var(--slurp-focus)] motion-reduce:transition-none ${layout === "row" ? "px-1" : "px-3.5"} ${checked ? "bg-[image:var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-canvas)] text-[var(--slurp-muted)] ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]"}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="truncate">{option.label}</span>
            </label>
          );
        })}
      </div>
      {detail && <p className="text-xs leading-5 text-[var(--slurp-muted)]">{detail}</p>}
    </fieldset>
  );
}

/** "After talking with Slurp Support: focus on travel" with Undo, until the player changes those fields. */
function SupportNote({
  note,
  pending,
  onUndo,
  onKeep,
}: {
  note: SlpSteeringSupportNote;
  pending: boolean;
  onUndo: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const parts = [
    note.mood && t("ui.slurp.steering.support.mood", { mood: t(`ui.slurp.steering.moods.${note.mood}`).toLowerCase() }),
    note.focus && t("ui.slurp.steering.support.focus", { focus: note.focus }),
    note.more && t("ui.slurp.steering.support.more", { topic: note.more }),
    note.less && t("ui.slurp.steering.support.less", { topic: note.less }),
    note.idea && t("ui.slurp.steering.support.idea", { idea: note.idea }),
    note.memory && t("ui.slurp.steering.support.memory"),
  ].filter(Boolean);
  return (
    <div
      data-slurp-steering-support
      className="space-y-3 rounded-xl bg-[var(--slurp-tint)] p-3 ring-1 ring-inset ring-[var(--noodle-accent)]/30"
    >
      <p className="text-sm leading-5 text-[var(--slurp-text)] [overflow-wrap:anywhere]">
        <span className="font-semibold">{t("ui.slurp.steering.support.title")}</span> {parts.join(" · ")}
      </p>
      <div className="flex gap-2">
        <SlpButton variant="quiet" disabled={pending} onClick={onUndo} className="min-h-11 flex-1 px-3.5 text-sm">
          {t("ui.slurp.steering.support.undo")}
        </SlpButton>
        <SlpButton variant="tertiary" disabled={pending} onClick={onKeep} className="min-h-11 flex-1 px-3.5 text-sm">
          {t("ui.slurp.steering.support.keep")}
        </SlpButton>
      </div>
    </div>
  );
}

/**
 * How spicy this Creator gets, what turns them on and their hard noes. Their level sits under the
 * Slurp-wide limit (Backstage › Spice); their own words decide how they do it.
 */
function SpiceBlock({
  name,
  spice,
  steering,
  save,
}: {
  name: string;
  spice: SlpCreatorSpice;
  steering: { turnOns: string[]; hardNoes: string[] };
  save: (patch: { spiceLevel?: SlpSpiceStep | null; turnOns?: string[]; hardNoes?: string[] }) => void;
}) {
  const { t } = useTranslation();
  return (
    <div data-slurp-spice className="space-y-4 border-t border-[var(--slurp-outline)] pt-4">
      {/* The same scale and control as Content rules and Settings › Spice (0.3.17). */}
      <SlpSpiceLevelChoice
        label={t("ui.slurp.spice.level", { name })}
        value={spice.own ? spice.level : null}
        inherited={spice.inherited ?? spice.level ?? "flirty"}
        max={spice.max}
        onChange={(spiceLevel) => save({ spiceLevel })}
      />
      <ChipListInput
        label={t("ui.slurp.spice.turnOns")}
        values={steering.turnOns}
        placeholder={t("ui.slurp.spice.turnOnsPlaceholder")}
        onChange={(turnOns) => save({ turnOns })}
      />
      <ChipListInput
        label={t("ui.slurp.spice.hardNoes")}
        values={steering.hardNoes}
        placeholder={t("ui.slurp.spice.hardNoesPlaceholder")}
        onChange={(hardNoes) => save({ hardNoes })}
      />
      {spice.leans.length > 0 && (
        <p className="text-xs leading-5 text-[var(--slurp-muted)]">
          {t("ui.slurp.spice.leans", { name, tastes: spice.leans.join(", ") })}
        </p>
      )}
    </div>
  );
}

/**
 * What the player steers about one Creator, in their own words: mood, what is going on in their
 * life, what they are into, topics to bring up or leave out, how often they post, and one-off ideas
 * for the next posts. The Creator's card and past posts decide how any of it comes out.
 */
export function SlpCreatorSteeringCard({
  creatorId,
  name,
  onPostNow,
  postNowPending = false,
}: {
  creatorId: string;
  name: string;
  /** Write the next post now (it takes the oldest idea). Absent where there is no such action. */
  onPostNow?: () => void;
  postNowPending?: boolean;
}) {
  const { t } = useTranslation();
  const query = useSlurpCreatorSteering(creatorId);
  const { patch, addIdea, removeIdea, rewritePrepared, undoSupport, keepSupport } =
    useSlurpCreatorSteeringMutations(creatorId);
  const steering = query.data?.steering;
  const spice = query.data?.spice ?? null;
  const polyamory = useSlurpSettings().data?.polyamory === true;
  const [lifePhase, setLifePhase] = useState("");
  const [focus, setFocus] = useState("");
  const [idea, setIdea] = useState("");
  const [story, setStory] = useState(false);
  // Posts already prepared under the old steering. Asked once per change; nothing runs unanswered.
  const [prepared, setPrepared] = useState<{ posts: number; calls: number } | null>(null);
  const ideaId = useId();
  const lifeId = useId();
  const focusId = useId();
  useEffect(() => {
    if (!steering) return;
    setLifePhase(steering.lifePhase);
    setFocus(steering.focus);
  }, [steering]);

  const onError = (error: unknown) => toast.error(errorMessage(error));
  const save = (next: Parameters<typeof patch.mutate>[0]) =>
    patch.mutate(next, { onError, onSuccess: (answer) => answer.prepared && setPrepared(answer.prepared) });
  const rewrite = () =>
    rewritePrepared.mutate(undefined, {
      onSuccess: ({ rewritten }) => {
        setPrepared(null);
        toast.success(t("ui.slurp.steering.rewriting", { count: rewritten }));
      },
      onError,
    });

  if (query.isError) return <p className={noteClass}>{t("ui.slurp.steering.loadFailed")}</p>;
  if (!steering) return <p className={noteClass}>{t("ui.slurp.settings.loading", { defaultValue: "Loading…" })}</p>;

  const full = steering.nudges.length >= SLP_STEERING_NUDGES_MAX;
  const submitIdea = () => {
    const text = idea.trim();
    if (!text || full) return;
    addIdea.mutate(
      { text, story },
      {
        onSuccess: () => {
          setIdea("");
          setStory(false);
        },
        onError,
      },
    );
  };

  return (
    <section data-slurp-steering className="space-y-4" aria-labelledby={`${lifeId}-title`}>
      <div>
        <h3 id={`${lifeId}-title`} className="text-[13px] font-semibold text-[var(--slurp-text)]">
          {t("ui.slurp.steering.title", { name })}
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.steering.intro", { name })}</p>
      </div>

      {steering.support && (
        <SupportNote
          note={steering.support}
          pending={undoSupport.isPending || keepSupport.isPending}
          onUndo={() =>
            undoSupport.mutate(undefined, {
              onSuccess: () => toast.success(t("ui.slurp.steering.support.undone", { name })),
              onError,
            })
          }
          onKeep={() => keepSupport.mutate(undefined, { onError })}
        />
      )}

      <PillChoice<SlpSteeringMood | "none">
        layout="wrap"
        label={t("ui.slurp.steering.mood")}
        options={[
          { value: "none", label: t("ui.slurp.steering.moods.none") },
          ...SLP_STEERING_MOODS.map((mood) => ({ value: mood, label: t(`ui.slurp.steering.moods.${mood}`) })),
        ]}
        value={steering.mood ?? "none"}
        onChange={(mood) => save({ mood: mood === "none" ? null : mood })}
      />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <label htmlFor={lifeId} className={labelClass}>
            {t("ui.slurp.steering.lifePhase")}
          </label>
          <SlpTextAssist
            field="life"
            value={lifePhase}
            accountId={creatorId}
            onApply={(text) => {
              setLifePhase(text);
              if (text.trim() !== steering.lifePhase) save({ lifePhase: text.trim() });
            }}
          />
        </div>
        <input
          id={lifeId}
          value={lifePhase}
          maxLength={SLP_STEERING_TEXT_MAX}
          placeholder={t("ui.slurp.steering.lifePhasePlaceholder")}
          onChange={(event) => setLifePhase(event.target.value)}
          onBlur={() => lifePhase.trim() !== steering.lifePhase && save({ lifePhase: lifePhase.trim() })}
          className={selectClass}
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <label htmlFor={focusId} className={labelClass}>
            {t("ui.slurp.steering.focus")}
          </label>
          <SlpTextAssist
            field="focus"
            value={focus}
            accountId={creatorId}
            onApply={(text) => {
              setFocus(text);
              if (text.trim() !== steering.focus) save({ focus: text.trim() });
            }}
          />
        </div>
        <input
          id={focusId}
          value={focus}
          maxLength={SLP_STEERING_TEXT_MAX}
          placeholder={t("ui.slurp.steering.focusPlaceholder")}
          onChange={(event) => setFocus(event.target.value)}
          onBlur={() => focus.trim() !== steering.focus && save({ focus: focus.trim() })}
          className={selectClass}
        />
      </div>

      <ChipListInput
        label={t("ui.slurp.steering.push")}
        values={steering.push}
        placeholder={t("ui.slurp.steering.pushPlaceholder")}
        onChange={(push) => save({ push })}
      />
      <ChipListInput
        label={t("ui.slurp.steering.avoid")}
        values={steering.avoid}
        placeholder={t("ui.slurp.steering.avoidPlaceholder")}
        onChange={(avoid) => save({ avoid })}
      />

      {spice && <SpiceBlock name={name} spice={spice} steering={steering} save={save} />}

      <div aria-live="polite">
        {prepared && (
          <div
            data-slurp-steering-rewrite
            className="space-y-3 rounded-xl bg-[var(--slurp-tint)] p-3 ring-1 ring-inset ring-[var(--noodle-accent)]/30"
          >
            <p className="text-sm leading-5 text-[var(--slurp-text)]">
              {t("ui.slurp.steering.preparedQuestion", {
                count: prepared.posts,
                calls: t("ui.slurp.steering.preparedCalls", { count: prepared.calls }),
              })}
            </p>
            <div className="flex gap-2">
              <SlpPrimaryButton
                disabled={rewritePrepared.isPending}
                onClick={rewrite}
                className="min-h-11 flex-1 px-3.5 text-sm"
              >
                {t("ui.slurp.steering.rewrite")}
              </SlpPrimaryButton>
              <SlpButton
                variant="quiet"
                disabled={rewritePrepared.isPending}
                onClick={() => setPrepared(null)}
                className="min-h-11 flex-1 px-3.5 text-sm"
              >
                {t("ui.slurp.steering.keep")}
              </SlpButton>
            </div>
          </div>
        )}
      </div>

      {polyamory && (
        // Polyamory (0.3.5): whether they can be with more than one person. "From their card" reads it.
        <PillChoice<SlpRelationshipStyle | "card">
          layout="row"
          label={t("ui.slurp.steering.relationshipStyle", { defaultValue: "Relationships" })}
          options={[
            {
              value: "card",
              label: t("ui.slurp.steering.relationshipStyles.card", { defaultValue: "From their card" }),
            },
            ...SLP_RELATIONSHIP_STYLES.map((style) => ({
              value: style,
              label: t(`ui.slurp.steering.relationshipStyles.${style}`, {
                defaultValue: style === "poly" ? "Polyamorous" : "Monogamous",
              }),
            })),
          ]}
          value={steering.relationshipStyle ?? "card"}
          onChange={(style) => save({ relationshipStyle: style === "card" ? null : style })}
        />
      )}

      <PillChoice<SlpSteeringPace>
        layout="row"
        label={t("ui.slurp.steering.pace")}
        detail={t(`ui.slurp.steering.paceDetail.${steering.pace}`, { name })}
        options={SLP_STEERING_PACES.map((pace) => ({ value: pace, label: t(`ui.slurp.steering.paces.${pace}`) }))}
        value={steering.pace}
        onChange={(pace) => save({ pace })}
      />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <p className={labelClass}>{t("ui.slurp.steering.ideas")}</p>
          {!full && (
            <SlpTextAssist
              field="idea"
              value={idea}
              accountId={creatorId}
              context={story ? "It is for a Story." : undefined}
              onApply={setIdea}
            />
          )}
        </div>
        <p className="text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.steering.ideasDetail", { name })}</p>
        {steering.nudges.length > 0 ? (
          <ol className="space-y-1.5">
            {steering.nudges.map((nudge, index) => (
              <li
                key={nudge.id}
                className="flex min-h-11 items-center gap-2 rounded-lg bg-[var(--slurp-canvas)] ps-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
              >
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--slurp-muted)]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{nudge.text}</span>
                {nudge.story && (
                  <span className="shrink-0 rounded-full bg-[var(--slurp-tint)] px-2 py-0.5 text-xs font-semibold">
                    {t("ui.slurp.steering.storyChip")}
                  </span>
                )}
                <button
                  type="button"
                  disabled={removeIdea.isPending}
                  onClick={() => removeIdea.mutate(nudge.id, { onError })}
                  aria-label={t("ui.slurp.steering.removeIdea", { text: nudge.text })}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-[var(--slurp-muted)]">{t("ui.slurp.steering.noIdeas")}</p>
        )}
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitIdea();
          }}
        >
          <label htmlFor={ideaId} className="sr-only">
            {t("ui.slurp.steering.ideaLabel")}
          </label>
          <input
            id={ideaId}
            value={idea}
            maxLength={SLP_STEERING_NUDGE_MAX}
            disabled={full}
            placeholder={full ? t("ui.slurp.steering.ideasFull") : t("ui.slurp.steering.ideaPlaceholder")}
            onChange={(event) => setIdea(event.target.value)}
            className={selectClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <Toggle compact label={t("ui.slurp.steering.asStory")} value={story} onChange={setStory} />
            </div>
            <SlpButton
              type="submit"
              variant="secondary"
              disabled={!idea.trim() || full || addIdea.isPending}
              className="min-h-11 px-3.5 text-xs"
            >
              <Plus size={14} aria-hidden="true" />
              {t("ui.slurp.steering.addIdea")}
            </SlpButton>
          </div>
        </form>
        {onPostNow && steering.nudges.length > 0 && (
          <SlpButton
            variant="quiet"
            disabled={postNowPending}
            onClick={onPostNow}
            className="min-h-11 w-full px-3.5 text-xs"
          >
            {postNowPending ? t("ui.noodle.stageprofileview.running") : t("ui.slurp.steering.postNow")}
            <SlpUsesAiMark />
          </SlpButton>
        )}
      </div>
    </section>
  );
}
