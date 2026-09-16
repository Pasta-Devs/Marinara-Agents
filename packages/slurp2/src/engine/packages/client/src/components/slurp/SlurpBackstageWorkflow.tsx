/** Shared Backstage building blocks: prompt defaults, formatters, and the editors the pages reuse. */
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FileText,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Field, GuidanceBox, NumberSetting, SettingsGroup, Toggle } from "./SlurpSettingsControls";
import { type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatClockTime, formatDateTime } from "./SlurpDateTime";
import {
  useSlurpAmbientProfiles,
  useRerollAmbientProfiles,
  useUpdateAmbientProfile,
  useDeleteNoodlerStageProfile,
  useSetSlurpCreatorMessaging,
  useSetSlurpCreatorPrice,
  useSlurpCreatorMessagingSettings,
  type SlurpCreatorMessaging,
  useResetSlurpArcType,
  useGenerateSlurpArcType,
  type SlurpArcType,
  type SlurpReserveStatus,
  type SlurpScheduleSlot,
} from "../../hooks/use-slurp";
import { Modal } from "../ui/Modal";
import { SLURP_SETTINGS_SECTIONS } from "./slurp-navigation.types";
import { type NoodlerManagedStageProfile } from "@marinara-engine/shared";
import { Avatar, SLURP_ROW_ACTIVE_CLASS, SLURP_ROW_CLASS } from "./SlurpShell";

export const settingsSections = SLURP_SETTINGS_SECTIONS;
// Three shipped spice levels. Kept byte-identical to the server presets so the settings surface
// can tell which level is active and restore one exactly.
export const SLURP_GUIDANCE_PRESETS = {
  mild: "All Slurp creators and viewers are adults (18+). This is an adult creator page, but a restrained one: posts are flirty, teasing, and suggestive rather than graphic. Innuendo, charm, and anticipation do the work, and locked posts are teased instead of described. Do not write explicit sexual detail. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one flirts bluntly. Ordinary posts about their day, work, and mood stay just as important as the flirty ones.",
  steamy:
    "All Slurp creators and viewers are adults (18+). This is an adult creator page. Posts are normally sexually suggestive to outright NSFW. Creators will use Slurp to often excite their readers with their posts. The level of NSFW of a post is dependent on the creator's personality, a shy, innocent person will be suggestive, but still overall tame. On the other end of the spectrum, an outgoing personality who has no problems with sex, will often post very explicit material. When a post is explicit or shows nudity, always use thorough, graphic, horny descriptions. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, feels, and moves. Keep each creator's personality intact.",
  explicit:
    "All Slurp creators and viewers are adults (18+). This is an explicit adult creator page. Sexual content is the norm here rather than the exception, and creators describe it directly and in detail when it suits them. Tease the locked posts hard and answer flirty comments in kind. Always use thorough, graphic, horny descriptions for nudity and sex. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, feels, and moves. Keep each creator's personality intact: a shy creator is explicit shyly, a blunt one is explicit bluntly. Ordinary posts about their day, work, and mood still appear and keep the feed believable.",
} as const;
export const SLURP_GUIDANCE_LEVELS = ["mild", "steamy", "explicit"] as const;
export const DEFAULT_SLURP_GENERATION_GUIDANCE: string = SLURP_GUIDANCE_PRESETS.steamy;
export const DEFAULT_SLURP_IMAGE_GENERATION_PROMPT =
  "Create a polished social-media image for an adult Creator post. Match the creator's identity, personality, body, clothing, and established visual details. Follow the post's mood and subject. Describe the pose, expression, setting, lighting, camera angle, composition, and visible details clearly. Flirty, suggestive, sensual, or explicit imagery is allowed when it fits the post and creator, but do not force sexual content into ordinary updates. When the image shows nudity or sex, always use thorough, graphic descriptions. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, how it sits, how it catches the light. Keep the image coherent, intentional, and suitable for a public or locked Creator feed.";

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not update settings.";
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

// Same row, same highlight as every other Slurp destination.
export const sectionTabClass = (active: boolean) =>
  cn(SLURP_ROW_CLASS, active ? SLURP_ROW_ACTIVE_CLASS : "text-[var(--slurp-muted)]");

/** One labelled row of mutually exclusive buttons, the shape every Audience choice shares. */
export function ChoiceRow<T extends string>({
  title,
  detail,
  options,
  value,
  onChange,
  extra,
}: {
  title: string;
  detail: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: string;
  onChange: (value: T) => void;
  extra?: ReactNode;
}) {
  return (
    <fieldset className="space-y-3 pt-2">
      <legend className="text-sm font-bold">{title}</legend>
      <p className="text-xs leading-5 text-[var(--slurp-muted)]">{detail}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors",
              value === option.value
                ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]"
                : "border-[var(--border)] hover:bg-[var(--accent)]",
            )}
          >
            {option.label}
          </button>
        ))}
        {extra}
      </div>
    </fieldset>
  );
}

export function localDateTimeValue(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ScheduleSlotEditor({
  slot,
  pending,
  onSave,
}: {
  slot: SlurpScheduleSlot;
  pending: boolean;
  onSave: (publishAt: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState(() => localDateTimeValue(slot.publishAt));
  const parsed = Date.parse(draft);
  const unchanged = !Number.isNaN(parsed) && new Date(parsed).toISOString() === slot.publishAt;
  const valid = !Number.isNaN(parsed) && parsed > Date.now();
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
        <span>
          {slot.state === "prepared"
            ? t("ui.slurp.settings.creators.prepared")
            : t("ui.slurp.settings.creators.scheduled")}
        </span>
        <span>{formatDateTime(slot.publishAt, i18n.language)}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="datetime-local"
          aria-label={t("ui.slurp.settings.creators.publicationTime")}
          value={draft}
          min={localDateTimeValue(new Date(Date.now() + 60_000).toISOString())}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
        />
        <button
          type="button"
          disabled={pending || unchanged || !valid}
          onClick={() => void onSave(new Date(parsed).toISOString())}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-[var(--noodle-accent-foreground)] disabled:opacity-45"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {t("ui.slurp.settings.creators.saveTime")}
        </button>
      </div>
    </div>
  );
}

export function OverviewCard({
  icon,
  title,
  status,
  details,
  avatars,
  avatarTotal,
  onClick,
  tone,
  healthy,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  details: string[];
  avatars?: NoodlerManagedStageProfile[];
  avatarTotal?: number;
  onClick: () => void;
  tone: "pink" | "violet" | "blue" | "coral";
  healthy?: boolean;
}) {
  const toneClass =
    tone === "pink"
      ? "from-[var(--noodle-accent)] to-[#a51d61]"
      : tone === "violet"
        ? "from-[var(--slurp-violet)] to-[#7441a0]"
        : tone === "blue"
          ? "from-[#7777ef] to-[#5145bb]"
          : "from-[var(--slurp-coral)] to-[#b83f45]";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-36 rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-start shadow-[0_20px_48px_-38px_rgba(71,16,52,0.9)] ring-1 ring-inset ring-[var(--slurp-outline)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_6%,var(--slurp-surface-raised))] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span className="flex items-start gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${toneClass} text-white shadow-lg [&_svg]:!text-white`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-black">{title}</span>
            {healthy !== undefined &&
              (healthy ? (
                <CheckCircle2 size={15} className="shrink-0 text-[var(--slurp-success)]" aria-hidden="true" />
              ) : (
                <AlertTriangle size={15} className="shrink-0 text-[var(--slurp-warning)]" aria-hidden="true" />
              ))}
          </span>
          <span className="mt-2 block text-sm font-bold text-[var(--noodle-accent-foreground)]">{status}</span>
          {avatars && avatars.length > 0 && (
            <span className="mt-3 flex -space-x-2 rtl:space-x-reverse" aria-hidden="true">
              {avatars.map((creator) => (
                <span key={creator.id} className="rounded-full bg-[var(--slurp-surface-raised)] p-0.5">
                  <Avatar account={creator} size="sm" />
                </span>
              ))}
              {(avatarTotal ?? avatars.length) > avatars.length && (
                <span className="relative z-10 grid h-9 min-w-9 place-items-center rounded-full bg-[var(--slurp-canvas)] px-1.5 text-xs font-black tabular-nums text-[var(--slurp-text)] ring-2 ring-[var(--slurp-surface-raised)]">
                  +{(avatarTotal ?? avatars.length) - avatars.length}
                </span>
              )}
            </span>
          )}
          <span className="mt-2 block space-y-0.5">
            {details.map((detail) => (
              <span key={detail} className="block text-xs leading-4 text-[var(--slurp-muted)]">
                {detail}
              </span>
            ))}
          </span>
        </span>
        <ChevronRight
          size={18}
          className="mt-1 shrink-0 text-[var(--slurp-muted)] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

export function OverviewActivity({
  reserveStatus,
  reserveLoading,
  reserveError,
  fanStatus,
  refreshPending,
  onRetry,
}: {
  reserveStatus?: SlurpReserveStatus;
  reserveLoading: boolean;
  reserveError: boolean;
  fanStatus?: { usedRuns: number; runLimit: number; lastRun: { status: string; finishedAt: string | null } | null };
  refreshPending: boolean;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation();
  const formatTime = (value: string | null | undefined) =>
    value ? formatClockTime(value, i18n.language) : t("ui.slurp.settings.overview.activity.notAvailable");
  const usage = reserveStatus ? `${reserveStatus.textAttemptsUsed} / ${reserveStatus.postsPerDay}` : "--";
  const fanUsage = fanStatus ? `${fanStatus.usedRuns} / ${fanStatus.runLimit}` : "--";

  return (
    <section
      className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
      aria-labelledby="slurp-activity-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={17} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
          <h2 id="slurp-activity-title" className="text-sm font-black">
            {t("ui.slurp.settings.overview.activity.title")}
          </h2>
        </div>
        {(reserveError || fanStatus === undefined) && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--noodle-accent)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            <RefreshCw size={13} aria-hidden="true" />
            {t("capabilities.actions.tryAgain")}
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ActivityRow
          icon={
            refreshPending ? (
              <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <CheckCircle2 size={15} />
            )
          }
          label={t("ui.slurp.settings.overview.activity.current")}
          value={
            refreshPending
              ? t("ui.slurp.settings.overview.activity.generating")
              : t("ui.slurp.settings.overview.activity.idle")
          }
          tone={refreshPending ? "active" : "ready"}
        />
        <ActivityRow
          icon={<CalendarClock size={15} />}
          label={t("ui.slurp.settings.overview.activity.prepared")}
          value={reserveLoading ? "..." : reserveStatus ? `${reserveStatus.preparedCount}` : "--"}
          detail={
            reserveStatus?.preparedThrough
              ? t("ui.slurp.settings.overview.activity.through", { time: formatTime(reserveStatus.preparedThrough) })
              : undefined
          }
          tone="waiting"
        />
        <ActivityRow
          icon={<Sparkles size={15} />}
          label={t("ui.slurp.settings.overview.activity.textUsage")}
          value={usage}
          detail={t("ui.slurp.settings.overview.activity.today")}
          tone="active"
        />
        <ActivityRow
          icon={<Megaphone size={15} />}
          label={t("ui.slurp.settings.overview.activity.audience")}
          value={fanUsage}
          detail={
            fanStatus?.lastRun
              ? t("ui.slurp.settings.overview.activity.lastRun", { time: formatTime(fanStatus.lastRun.finishedAt) })
              : undefined
          }
          tone="ready"
        />
      </div>
    </section>
  );
}

export function ActivityRow({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: "active" | "ready" | "waiting";
}) {
  const toneClass =
    tone === "active"
      ? "text-[var(--noodle-accent)]"
      : tone === "waiting"
        ? "text-[var(--slurp-warning)]"
        : "text-[var(--slurp-success)]";
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-lg bg-[var(--slurp-canvas)] px-3 py-2 ring-1 ring-inset ring-[var(--slurp-outline)]">
      <span className={`shrink-0 ${toneClass}`} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[var(--slurp-muted)]">{label}</span>
        {detail && <span className="block truncate text-[0.68rem] text-[var(--slurp-muted)]">{detail}</span>}
      </span>
      <span className={`shrink-0 text-sm font-black ${toneClass}`}>{value}</span>
    </div>
  );
}

/**
 * Settings → Arcs library list. Deleting a built-in only hides it, so Reset can bring it back; a
 * custom type is removed. Running arcs hold their own copy and never see these edits.
 */
/** Mirrors `SLURP_MODIFIER_KINDS` on the server: the moods a chapter may start. */
export const ARC_MOODS = [
  "just_posted",
  "post_landed",
  "post_flopped",
  "afterglow",
  "overexposed",
  "paid_well",
  "goal_hit",
  "lapse_sting",
  "tipsy",
  "tired",
  "rattled",
] as const;

export function ArcLibraryEditor({
  library,
  tags,
  busy,
  creatorAccountId,
  personaId,
  onChange,
}: {
  library: SlurpArcType[];
  tags: string[];
  busy: boolean;
  creatorAccountId: string | null;
  personaId: string | null;
  onChange: (library: SlurpArcType[]) => void;
}) {
  const { t } = useTranslation();
  const reset = useResetSlurpArcType();
  const generate = useGenerateSlurpArcType();
  const [draft, setDraft] = useState<SlurpArcType | null>(null);
  const [brief, setBrief] = useState("");
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [reviewingGeneratedDraft, setReviewingGeneratedDraft] = useState(false);
  const importInputId = "slurp-arc-library-import";
  const input =
    "min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base sm:text-sm";
  const button =
    "min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-[var(--slurp-surface-raised)] disabled:opacity-50";
  const replace = (type: SlurpArcType) =>
    onChange(
      library.some((entry) => entry.id === type.id)
        ? library.map((entry) => (entry.id === type.id ? type : entry))
        : [...library, type],
    );
  const setChapter = (index: number, patch: Partial<SlurpArcType["chapters"][number]>) =>
    draft &&
    setDraft({
      ...draft,
      chapters: draft.chapters.map((chapter, at) => (at === index ? { ...chapter, ...patch } : chapter)),
    });
  const days = (value: string) => Math.min(90, Math.max(0, Math.floor(Number(value)) || 0));
  const setOption = (
    index: number,
    optionIndex: number,
    patch: Partial<NonNullable<SlurpArcType["chapters"][number]["choice"]>["options"][number]>,
  ) => {
    const choice = draft?.chapters[index]?.choice;
    if (choice)
      setChapter(index, {
        choice: {
          ...choice,
          options: choice.options.map((option, at) => (at === optionIndex ? { ...option, ...patch } : option)),
        },
      });
  };
  /** A choice without a question or two named options is dropped on save rather than refused. */
  const cleanChoice = (choice: NonNullable<SlurpArcType["chapters"][number]["choice"]>) => {
    const question = choice.question.trim();
    const options = choice.options
      .map((option) => ({
        label: option.label.trim(),
        chapters: option.chapters
          .filter((chapter) => chapter.label.trim())
          .map((chapter) => ({ ...chapter, label: chapter.label.trim() })),
      }))
      .filter((option) => option.label);
    return question && options.length >= 2 ? { question, options } : undefined;
  };

  const exportArc = (type: SlurpArcType) => {
    const href = URL.createObjectURL(
      new Blob([JSON.stringify({ ...type, id: undefined, builtin: false, hidden: false }, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${
      type.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "slurp-arc"
    }.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  const importArc = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        typeof (parsed as { name?: unknown }).name !== "string" ||
        typeof (parsed as { description?: unknown }).description !== "string" ||
        !Array.isArray((parsed as { chapters?: unknown }).chapters) ||
        !Array.isArray((parsed as { tags?: unknown }).tags)
      )
        throw new Error("This file is not a valid Slurp Arc.");
      const value = parsed as SlurpArcType;
      const imported: SlurpArcType = {
        ...value,
        id: `custom-${Date.now().toString(36)}`,
        name: value.name.trim().slice(0, 80),
        description: value.description.trim().slice(0, 2_000),
        tone: typeof value.tone === "string" ? value.tone.trim().slice(0, 80) : "",
        tags: value.tags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 30),
        chapters: value.chapters.slice(0, 12),
        enabled: true,
        builtin: false,
        hidden: false,
      };
      if (!imported.name) throw new Error("The imported Arc needs a name.");
      replace(imported);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import that Arc.");
    }
  };

  const generateDraft = async () => {
    if (!creatorAccountId || !personaId || !brief.trim()) return;
    const result = await generate.mutateAsync({ creatorAccountId, personaId, brief: brief.trim() });
    setDraft(result.type);
    setSelectedChapters(new Set(result.type.chapters.map((_, index) => index)));
    setReviewingGeneratedDraft(true);
    setBrief("");
  };

  if (draft) {
    return (
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          replace({
            ...draft,
            name: draft.name.trim(),
            description: draft.description.trim(),
            tone: draft.tone.trim(),
            chapters: (reviewingGeneratedDraft
              ? draft.chapters.filter((_, index) => selectedChapters.has(index))
              : draft.chapters
            )
              .filter((chapter) => chapter.label.trim())
              .map((chapter) => {
                const choice = chapter.choice && cleanChoice(chapter.choice);
                const effects = Object.fromEntries(
                  Object.entries(chapter.effects ?? {}).filter(([, pct]) => Number.isInteger(pct) && pct !== 0),
                );
                const bio = chapter.profile?.bio?.trim();
                const location = chapter.profile?.location?.trim();
                return {
                  label: chapter.label.trim(),
                  minDays: chapter.minDays,
                  maxDays: Math.max(chapter.minDays, chapter.maxDays),
                  ...(choice ? { choice } : {}),
                  ...(chapter.mood ? { mood: chapter.mood } : {}),
                  ...(Object.keys(effects).length ? { effects } : {}),
                  ...(bio || location
                    ? { profile: { ...(bio ? { bio } : {}), ...(location ? { location } : {}) } }
                    : {}),
                };
              }),
          });
          setDraft(null);
          setSelectedChapters(new Set());
          setReviewingGeneratedDraft(false);
        }}
      >
        <GuidanceBox
          title={t("ui.slurp.settings.arcLibrary.editorTitle", { defaultValue: "Build the arc in layers" })}
          detail={t("ui.slurp.settings.arcLibrary.editorDetail", {
            defaultValue:
              "Start with the story idea. Add chapters only when you want precise pacing, effects, profile changes, or fan choices.",
          })}
        />
        {draft.chapters.length > 0 && (
          <div className="rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">
                  {t("ui.slurp.settings.arcLibrary.chapterSelection", { defaultValue: "Choose the chapters to keep" })}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                  {t("ui.slurp.settings.arcLibrary.chapterSelectionDetail", {
                    defaultValue: "AI suggestions are editable. Uncheck any chapter you do not want in this arc.",
                  })}
                </p>
              </div>
              <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                {selectedChapters.size}/{draft.chapters.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {draft.chapters.map((chapter, index) => (
                <label
                  key={`${chapter.label}-${index}`}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold"
                >
                  <input
                    type="checkbox"
                    checked={selectedChapters.has(index)}
                    onChange={(event) =>
                      setSelectedChapters((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(index);
                        else next.delete(index);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 truncate">{chapter.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("ui.slurp.settings.arcLibrary.name")}
            detail={t("ui.slurp.settings.arcLibrary.nameDetail", {
              defaultValue: "A short name shown in the Arc Library.",
            })}
          >
            <input
              value={draft.name}
              maxLength={80}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className={input}
            />
          </Field>
          <Field
            label={t("ui.slurp.settings.arcLibrary.tone")}
            detail={t("ui.slurp.settings.arcLibrary.toneDetail", {
              defaultValue: "The feeling the Creator should bring to posts.",
            })}
          >
            <input
              value={draft.tone}
              maxLength={80}
              onChange={(event) => setDraft({ ...draft, tone: event.target.value })}
              className={input}
            />
          </Field>
        </div>
        <Field
          label={t("ui.slurp.settings.arcLibrary.description")}
          detail={t("ui.slurp.settings.arcLibrary.descriptionDetail", {
            defaultValue: "Give the model enough direction to make the arc feel specific.",
          })}
        >
          <textarea
            value={draft.description}
            maxLength={2000}
            rows={3}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            className={`${input} py-2`}
          />
        </Field>
        <div className="flex items-end justify-between gap-3 border-t border-[var(--slurp-outline)] pt-4">
          <div>
            <h3 className="text-sm font-bold">{t("ui.slurp.settings.arcLibrary.chapters")}</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.arcLibrary.chapterDetail", {
                defaultValue: "Each chapter can change the pace, mood, stats, profile, and fan choices.",
              })}
            </p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
            {draft.chapters.length}/12
          </span>
        </div>
        {draft.chapters.map((chapter, index) => (
          <fieldset
            key={index}
            className="space-y-4 rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-4"
          >
            <legend className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.arcLibrary.chapterNumber", {
                defaultValue: "Chapter {{number}}",
                number: index + 1,
              })}
            </legend>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:items-end">
              <Field label={t("ui.slurp.settings.arcLibrary.chapterLabel")}>
                <input
                  value={chapter.label}
                  maxLength={200}
                  onChange={(event) => setChapter(index, { label: event.target.value })}
                  className={input}
                />
              </Field>
              <Field label={t("ui.slurp.settings.arcLibrary.minDays")}>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={chapter.minDays}
                  onChange={(event) => setChapter(index, { minDays: days(event.target.value) })}
                  className={input}
                />
              </Field>
              <Field label={t("ui.slurp.settings.arcLibrary.maxDays")}>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={chapter.maxDays}
                  onChange={(event) => setChapter(index, { maxDays: days(event.target.value) })}
                  className={input}
                />
              </Field>
              <button
                type="button"
                className={`${button} text-red-600`}
                onClick={() => {
                  setDraft({ ...draft, chapters: draft.chapters.filter((_, at) => at !== index) });
                  setSelectedChapters((current) => {
                    const next = new Set<number>();
                    for (const at of current) {
                      if (at < index) next.add(at);
                      else if (at > index) next.add(at - 1);
                    }
                    return next;
                  });
                }}
              >
                {t("ui.slurp.settings.arcLibrary.removeChapter")}
              </button>
            </div>
            <details className="group rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-surface-raised,var(--background))]">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-bold text-[var(--muted-foreground)] [&::-webkit-details-marker]:hidden">
                <span>{t("ui.slurp.settings.arcLibrary.advanced", { defaultValue: "Advanced chapter options" })}</span>
                <ChevronRight size={15} className="transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <div className="space-y-4 border-t border-[var(--slurp-outline)] p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={t("ui.slurp.settings.arcLibrary.mood")}
                    detail={t("ui.slurp.settings.arcLibrary.moodDetail", {
                      defaultValue: "Set the mood when this chapter starts.",
                    })}
                  >
                    <select
                      value={chapter.mood ?? ""}
                      onChange={(event) => setChapter(index, { mood: event.target.value || undefined })}
                      className={input}
                    >
                      <option value="">{t("ui.slurp.settings.arcLibrary.noMood")}</option>
                      {ARC_MOODS.map((mood) => (
                        <option key={mood} value={mood}>
                          {mood.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t("ui.slurp.settings.arcLibrary.effects", { defaultValue: "Audience effects" })}
                    detail={t("ui.slurp.settings.arcLibrary.effectsDetail", {
                      defaultValue: "Optional changes to growth, earnings, and loyalty.",
                    })}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {(["growth", "earnings", "loyalty"] as const).map((stat) => (
                        <input
                          key={stat}
                          type="number"
                          aria-label={t(`ui.slurp.settings.arcLibrary.effect.${stat}`)}
                          min={-50}
                          max={50}
                          value={chapter.effects?.[stat] ?? ""}
                          onChange={(event) =>
                            setChapter(index, {
                              effects: {
                                ...chapter.effects,
                                [stat]:
                                  event.target.value === ""
                                    ? undefined
                                    : Math.max(-50, Math.min(50, Math.round(Number(event.target.value)) || 0)),
                              },
                            })
                          }
                          className={input}
                          placeholder={stat.slice(0, 3).toUpperCase()}
                        />
                      ))}
                    </div>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={t("ui.slurp.settings.arcLibrary.profileBio")}
                    detail={t("ui.slurp.settings.arcLibrary.profileBioDetail", {
                      defaultValue: "Optional bio change. Slurp asks before applying it.",
                    })}
                  >
                    <input
                      value={chapter.profile?.bio ?? ""}
                      maxLength={500}
                      onChange={(event) =>
                        setChapter(index, { profile: { ...chapter.profile, bio: event.target.value } })
                      }
                      className={input}
                    />
                  </Field>
                  <Field
                    label={t("ui.slurp.settings.arcLibrary.profileLocation")}
                    detail={t("ui.slurp.settings.arcLibrary.profileLocationDetail", {
                      defaultValue: "Optional location change. Slurp asks before applying it.",
                    })}
                  >
                    <input
                      value={chapter.profile?.location ?? ""}
                      maxLength={120}
                      onChange={(event) =>
                        setChapter(index, { profile: { ...chapter.profile, location: event.target.value } })
                      }
                      className={input}
                    />
                  </Field>
                </div>
                {chapter.choice ? (
                  <div className="basis-full space-y-2 border-l-2 border-[var(--slurp-outline)] pl-3">
                    <input
                      aria-label={t("ui.slurp.settings.arcLibrary.choiceQuestion")}
                      placeholder={t("ui.slurp.settings.arcLibrary.choiceQuestion")}
                      value={chapter.choice.question}
                      maxLength={240}
                      onChange={(event) =>
                        setChapter(index, { choice: { ...chapter.choice!, question: event.target.value } })
                      }
                      className={input}
                    />
                    {chapter.choice.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex flex-wrap items-start gap-2">
                        <input
                          aria-label={t("ui.slurp.settings.arcLibrary.choiceOption")}
                          placeholder={t("ui.slurp.settings.arcLibrary.choiceOption")}
                          value={option.label}
                          maxLength={120}
                          onChange={(event) => setOption(index, optionIndex, { label: event.target.value })}
                          className={`${input} min-w-0 flex-1`}
                        />
                        {/* One branch chapter per line; a line keeps its days while its label is unchanged. */}
                        <textarea
                          aria-label={t("ui.slurp.settings.arcLibrary.choiceBranch")}
                          placeholder={t("ui.slurp.settings.arcLibrary.choiceBranch")}
                          value={option.chapters.map((entry) => entry.label).join("\n")}
                          rows={2}
                          onChange={(event) =>
                            setOption(index, optionIndex, {
                              chapters: event.target.value
                                .split("\n")
                                .slice(0, 4)
                                .map((label) => {
                                  const known = option.chapters.find((entry) => entry.label === label);
                                  return { label, minDays: known?.minDays ?? 1, maxDays: known?.maxDays ?? 3 };
                                }),
                            })
                          }
                          className={`${input} min-w-0 flex-1 py-2`}
                        />
                        {chapter.choice!.options.length > 2 && (
                          <button
                            type="button"
                            className={button}
                            onClick={() =>
                              setChapter(index, {
                                choice: {
                                  ...chapter.choice!,
                                  options: chapter.choice!.options.filter((_, at) => at !== optionIndex),
                                },
                              })
                            }
                          >
                            {t("ui.slurp.settings.arcLibrary.removeOption")}
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      {chapter.choice.options.length < 4 && (
                        <button
                          type="button"
                          className={button}
                          onClick={() =>
                            setChapter(index, {
                              choice: {
                                ...chapter.choice!,
                                options: [...chapter.choice!.options, { label: "", chapters: [] }],
                              },
                            })
                          }
                        >
                          {t("ui.slurp.settings.arcLibrary.addOption")}
                        </button>
                      )}
                      <button type="button" className={button} onClick={() => setChapter(index, { choice: undefined })}>
                        {t("ui.slurp.settings.arcLibrary.removeChoice")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={button}
                    onClick={() =>
                      setChapter(index, {
                        choice: {
                          question: "",
                          options: [
                            { label: "", chapters: [] },
                            { label: "", chapters: [] },
                          ],
                        },
                      })
                    }
                  >
                    {t("ui.slurp.settings.arcLibrary.addChoice")}
                  </button>
                )}
              </div>
            </details>
          </fieldset>
        ))}
        {draft.chapters.length < 12 && (
          <button
            type="button"
            className={button}
            onClick={() => setDraft({ ...draft, chapters: [...draft.chapters, { label: "", minDays: 1, maxDays: 3 }] })}
          >
            {t("ui.slurp.settings.arcLibrary.addChapter")}
          </button>
        )}
        {draft.chapters.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.revertProfileAtEnd === true}
              onChange={(event) => setDraft({ ...draft, revertProfileAtEnd: event.target.checked })}
            />
            {t("ui.slurp.settings.arcLibrary.revertProfileAtEnd")}
          </label>
        )}
        {draft.chapters.length === 0 && (
          <label className="flex items-center gap-2 text-sm">
            {t("ui.slurp.settings.arcLibrary.durationDays")}
            <input
              type="number"
              min={1}
              max={365}
              value={draft.durationDays}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  durationDays: Math.min(365, Math.max(1, Math.floor(Number(event.target.value)) || 1)),
                })
              }
              className={`${input} w-24`}
            />
          </label>
        )}
        <p className="text-sm font-semibold">{t("ui.slurp.settings.arcLibrary.tags")}</p>
        <div className="flex flex-wrap gap-x-4">
          {[...new Set([...tags, ...draft.tags])].map((tag) => (
            <label key={tag} className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.tags.includes(tag)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    tags: event.target.checked ? [...draft.tags, tag] : draft.tags.filter((entry) => entry !== tag),
                  })
                }
              />
              {tag}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !draft.name.trim()}
            className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {t("ui.slurp.settings.arcLibrary.save")}
          </button>
          <button type="button" className={button} onClick={() => setDraft(null)}>
            {t("ui.slurp.settings.arcLibrary.cancel")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {library
          .filter((type) => !type.hidden || type.builtin)
          .map((type) => (
            <li
              key={type.id}
              className="rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-sm shadow-sm sm:p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-bold ${type.hidden ? "text-[var(--slurp-muted)] line-through" : ""}`}>
                      {type.name}
                    </span>
                    {type.builtin && (
                      <span className="rounded-full bg-[var(--noodle-accent)]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[var(--noodle-accent)]">
                        {t("ui.slurp.settings.arcLibrary.builtIn", { defaultValue: "Built in" })}
                      </span>
                    )}
                    {type.hidden && (
                      <span className="rounded-full bg-[var(--muted-foreground)]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[var(--muted-foreground)]">
                        {t("ui.slurp.settings.arcLibrary.hidden")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">
                    {type.description ||
                      t("ui.slurp.settings.arcLibrary.noDescription", { defaultValue: "No direction added." })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-[var(--muted-foreground)]">
                    <span>
                      {t("ui.slurp.settings.arcLibrary.chapterCount", {
                        defaultValue: "{{count}} chapters",
                        count: type.chapters.length,
                      })}
                    </span>
                    {type.tone && <span>{type.tone}</span>}
                    {type.tags.length > 0 && <span>{type.tags.join(", ")}</span>}
                  </div>
                </div>
                {!type.hidden && (
                  <label className="inline-flex min-h-10 shrink-0 items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={type.enabled}
                      disabled={busy}
                      onChange={(event) => replace({ ...type, enabled: event.target.checked })}
                    />
                    {t("ui.slurp.settings.arcLibrary.enabled")}
                  </label>
                )}
              </div>
              {!type.hidden && (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--slurp-outline)] pt-3">
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setReviewingGeneratedDraft(false);
                      setDraft(structuredClone(type));
                    }}
                  >
                    {t("ui.slurp.settings.arcLibrary.edit")}
                  </button>
                  <button type="button" className={button} disabled={busy} onClick={() => exportArc(type)}>
                    {t("ui.slurp.settings.arcLibrary.export", { defaultValue: "Export" })}
                  </button>
                  <button
                    type="button"
                    className={`${button} text-red-600`}
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(t("ui.slurp.settings.arcLibrary.deleteConfirm", { name: type.name }))) return;
                      onChange(
                        type.builtin
                          ? library.map((entry) =>
                              entry.id === type.id ? { ...entry, enabled: false, hidden: true } : entry,
                            )
                          : library.filter((entry) => entry.id !== type.id),
                      );
                    }}
                  >
                    {t("ui.slurp.settings.arcLibrary.delete")}
                  </button>
                </div>
              )}
              {type.hidden && type.builtin && (
                <button
                  type="button"
                  className={button}
                  disabled={busy || reset.isPending}
                  onClick={() => reset.mutate(type.id)}
                >
                  {t("ui.slurp.settings.arcLibrary.reset")}
                </button>
              )}
            </li>
          ))}
      </ul>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          id={importInputId}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importArc(file);
          }}
        />
        <label htmlFor={importInputId} className={`${button} cursor-pointer border border-[var(--slurp-outline)]`}>
          {t("ui.slurp.settings.arcLibrary.import", { defaultValue: "Import Arc" })}
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block space-y-2 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            {t("ui.slurp.settings.arcLibrary.aiBrief", { defaultValue: "Describe the arc to AI" })}
            <span
              title={t("ui.slurp.settings.arcLibrary.aiBriefDetail", {
                defaultValue: "AI creates an editable arc draft. Nothing is saved until you save it.",
              })}
              className="text-[var(--muted-foreground)]"
            >
              <CircleHelp size={14} aria-hidden="true" />
            </span>
          </span>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t("ui.slurp.settings.arcLibrary.aiBriefPlaceholder", {
              defaultValue: "For example: a summer road trip that starts badly and ends with a surprise collaboration.",
            })}
            className={`${input} py-2`}
          />
        </label>
        <button
          type="button"
          className="min-h-11 self-end rounded-lg border border-[var(--noodle-accent)] px-4 text-sm font-bold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
          disabled={busy || generate.isPending || !brief.trim() || !creatorAccountId || !personaId}
          onClick={() => void generateDraft()}
        >
          {generate.isPending
            ? t("ui.slurp.settings.arcLibrary.generating", { defaultValue: "Building draft..." })
            : t("ui.slurp.settings.arcLibrary.buildWithAi", { defaultValue: "Build with AI" })}
        </button>
      </div>
      {generate.error && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {generate.error.message}
        </p>
      )}
      <button
        type="button"
        className={button}
        disabled={busy}
        onClick={() => {
          setReviewingGeneratedDraft(false);
          setDraft({
            id: `custom-${Date.now().toString(36)}`,
            name: "",
            description: "",
            chapters: [],
            tags: [],
            tone: "",
            durationDays: 14,
            enabled: true,
            builtin: false,
            hidden: false,
          });
        }}
      >
        <Plus size={15} aria-hidden="true" />
        {t("ui.slurp.settings.arcLibrary.add")}
      </button>
    </div>
  );
}

export function PromptCard({
  title,
  value,
  isDefault,
  onEdit,
  onRestore,
  restoreLabel,
  disabled = false,
}: {
  title: string;
  value: string;
  isDefault: boolean;
  onEdit: () => void;
  onRestore: () => void;
  restoreLabel?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]">
          <FileText size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{title}</p>
            <span className="rounded-full border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/10 px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--noodle-accent)]">
              {isDefault ? t("ui.slurp.settings.prompts.default") : t("ui.slurp.settings.prompts.custom")}
            </span>
          </div>
          <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-5 text-[var(--muted-foreground)]">
            {value}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onRestore}
          disabled={disabled || isDefault}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--noodle-accent)]/35 px-3 text-xs font-semibold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 disabled:opacity-45"
        >
          <RotateCcw size={13} />
          {restoreLabel ?? t("ui.slurp.settings.prompts.restoreDefault")}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-45"
        >
          <Pencil size={14} className="text-[var(--noodle-accent)]" />
          {t("ui.slurp.settings.prompts.edit")}
        </button>
      </div>
    </div>
  );
}
export function PromptEditor({
  open,
  title,
  value,
  onChange,
  onClose,
  onSave,
  onRestore,
  pending,
  restoreLabel,
}: {
  open: boolean;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onRestore: () => void;
  pending: boolean;
  restoreLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-3xl" closeDisabled={pending}>
      <div className="space-y-4">
        <label className="block text-sm font-semibold">
          <span className="sr-only">{title}</span>
          <textarea
            aria-label={title}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-[22rem] w-full resize-y rounded-lg border border-[var(--border)] bg-transparent p-3 text-sm leading-6"
          />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onRestore}
            disabled={pending}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--noodle-accent)]/35 px-3 text-xs font-semibold text-[var(--noodle-accent)] disabled:opacity-45"
          >
            <RotateCcw size={13} />
            {restoreLabel ?? t("ui.slurp.settings.prompts.restoreDefault")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="min-h-10 flex-1 rounded-lg border border-[var(--border)] px-4 text-xs font-semibold sm:flex-none"
            >
              {t("ui.slurp.actions.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!value.trim() || pending}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-45"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {t("ui.slurp.settings.prompts.save")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The managed ambient crowd: the background profiles that fill a feed out so a Creator is not
 * talking into an empty room.
 *
 * Listing them is what seeds them, so opening this panel is also what creates the roster. Reroll
 * regenerates an identity in place; the account, and anything already attached to it, survives.
 */
export function AmbientProfilesPanel({
  allowRandomUsers,
  onAllowRandomUsersChange,
}: {
  allowRandomUsers: boolean;
  onAllowRandomUsersChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const profilesQuery = useSlurpAmbientProfiles();
  const reroll = useRerollAmbientProfiles();
  const update = useUpdateAmbientProfile();
  const remove = useDeleteNoodlerStageProfile();
  const profiles = profilesQuery.data?.items ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; displayName: string; handle: string; bio: string } | null>(null);

  const rerollIds = (accountIds: string[], id: string | null) => {
    if (accountIds.length === 0) return;
    setSelected(id);
    reroll.mutate(accountIds, {
      onSuccess: () => toast.success(t("ui.slurp.settings.ambient.rerolled", { count: accountIds.length })),
      onError: (error) => toast.error(errorMessage(error)),
      onSettled: () => setSelected(null),
    });
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">{t("ui.slurp.settings.ambient.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.ambient.detail")}</p>
        </div>
        <button
          type="button"
          disabled={reroll.isPending || profiles.length === 0}
          onClick={() =>
            rerollIds(
              profiles.map((profile) => profile.id),
              null,
            )
          }
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
        >
          <RefreshCw size={14} className={reroll.isPending && selected === null ? "animate-spin" : ""} />
          {t("ui.slurp.settings.ambient.rerollAll")}
        </button>
      </div>
      <Toggle
        label={t("ui.slurp.settings.ambient.enabled")}
        detail={t("ui.slurp.settings.ambient.enabledDetail")}
        value={allowRandomUsers}
        onChange={onAllowRandomUsersChange}
      />
      {profiles.length > 0 && (
        <ul className="space-y-2">
          {profiles.map((profile) =>
            editing?.id === profile.id ? (
              <li key={profile.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                {(["displayName", "handle", "bio"] as const).map((field) => (
                  <label key={field} className="block text-[0.7rem] font-semibold">
                    {t(`ui.slurp.settings.ambient.fields.${field}`)}
                    <input
                      value={editing[field]}
                      onChange={(event) => setEditing({ ...editing, [field]: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    />
                  </label>
                ))}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="inline-flex min-h-9 items-center rounded-lg border border-[var(--border)] px-2.5 text-[0.7rem] font-semibold hover:bg-[var(--accent)]"
                  >
                    {t("ui.slurp.settings.ambient.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={update.isPending || !editing.displayName.trim() || !editing.handle.trim()}
                    onClick={() =>
                      update.mutate(editing, {
                        onSuccess: () => setEditing(null),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-2.5 text-[0.7rem] font-bold text-zinc-950 disabled:opacity-50"
                  >
                    <Save size={12} />
                    {t("ui.slurp.settings.ambient.save")}
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={profile.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-semibold">
                    {profile.displayName} <span className="text-[var(--slurp-muted)]">@{profile.handle}</span>
                  </span>
                  <span className="truncate text-[0.7rem] text-[var(--slurp-muted)]">{profile.bio}</span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={reroll.isPending}
                    onClick={() => rerollIds([profile.id], profile.id)}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[0.7rem] font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={selected === profile.id ? "animate-spin" : ""} />
                    {t("ui.slurp.settings.ambient.reroll")}
                  </button>
                  <button
                    type="button"
                    aria-label={t("ui.slurp.settings.ambient.edit")}
                    title={t("ui.slurp.settings.ambient.edit")}
                    onClick={() =>
                      setEditing({
                        id: profile.id,
                        displayName: profile.displayName,
                        handle: profile.handle,
                        bio: profile.bio,
                      })
                    }
                    className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--accent)]"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("ui.slurp.settings.ambient.delete")}
                    title={t("ui.slurp.settings.ambient.delete")}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (!window.confirm(t("ui.slurp.settings.ambient.deleteConfirm", { name: profile.displayName })))
                        return;
                      remove.mutate(profile.id, {
                        onSuccess: () => void profilesQuery.refetch(),
                        onError: (error) => toast.error(errorMessage(error)),
                      });
                    }}
                    className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * A Creator's own message policy and prices.
 *
 * Only rendered for a persona-owned Creator: the routes require the operating persona, and a
 * character-sourced Creator has no owner to authorise the change.
 */
export function CreatorMessagingGroup({
  creatorId,
  personaId,
  setMessaging,
  setPrice,
  worldRulesAction,
}: {
  creatorId: string;
  personaId: string;
  setMessaging: ReturnType<typeof useSetSlurpCreatorMessaging>;
  setPrice: ReturnType<typeof useSetSlurpCreatorPrice>;
  /** Optional way back to the world defaults these values start from. */
  worldRulesAction?: ReactNode;
}) {
  const { t } = useTranslation();
  const query = useSlurpCreatorMessagingSettings(creatorId, personaId);
  const messaging = query.data?.messaging;
  const busy = setMessaging.isPending || setPrice.isPending;
  if (query.isLoading) {
    return (
      <div className="flex justify-center py-6 text-[var(--muted-foreground)]" role="status">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }
  if (query.isError || !messaging) {
    return (
      <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-xs">
        {t("ui.slurp.settings.creators.messagingLoadError")}
      </p>
    );
  }
  const patch = (input: Parameters<typeof setMessaging.mutate>[0]) =>
    setMessaging.mutate(input, { onError: (error) => toast.error(errorMessage(error)) });
  return (
    <SettingsGroup title={t("ui.slurp.settings.creators.messagingTitle")}>
      {worldRulesAction && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          <p className="min-w-0 flex-1">
            {t("ui.slurp.settings.creators.messagingInheritsWorld", {
              defaultValue: "Each value starts from the Slurp world default and stays there until you change it here.",
            })}
          </p>
          {worldRulesAction}
        </div>
      )}
      <Field label={t("ui.slurp.settings.creators.dmPolicy")} detail={t("ui.slurp.settings.creators.dmPolicyDetail")}>
        <select
          value={messaging.dmPolicy}
          disabled={busy}
          onChange={(event) =>
            patch({
              creatorAccountId: creatorId,
              personaId,
              dmPolicy: event.target.value as SlurpCreatorMessaging["dmPolicy"],
            })
          }
          className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
        >
          <option value="open">{t("ui.slurp.settings.creators.dmPolicyOpen")}</option>
          <option value="subscribers">{t("ui.slurp.settings.creators.dmPolicySubscribers")}</option>
          <option value="paid">{t("ui.slurp.settings.creators.dmPolicyPaid")}</option>
          <option value="closed">{t("ui.slurp.settings.creators.dmPolicyClosed")}</option>
        </select>
      </Field>
      {messaging.dmPolicy === "paid" && (
        <Field
          label={t("ui.slurp.settings.creators.requestFee")}
          detail={t("ui.slurp.settings.creators.requestFeeDetail")}
        >
          <NumberSetting
            value={messaging.requestFee}
            min={0}
            max={9999}
            onSave={(value) => patch({ creatorAccountId: creatorId, personaId, requestFee: value })}
          />
        </Field>
      )}
      <Toggle
        label={t("ui.slurp.settings.creators.proactiveMessages", { defaultValue: "Writes first" })}
        detail={t("ui.slurp.settings.creators.proactiveMessagesDetail", {
          defaultValue: "Off: this Creator only answers. No follow-ups and no unprompted direct messages.",
        })}
        value={messaging.proactiveMessages}
        onChange={(value) => patch({ creatorAccountId: creatorId, personaId, proactiveMessages: value })}
      />
      <Field label={t("ui.slurp.settings.creators.ppvPrice")} detail={t("ui.slurp.settings.creators.ppvPriceDetail")}>
        <NumberSetting
          value={messaging.ppvPrice}
          min={0}
          max={9999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, ppvPrice: value })}
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.subscriptionPrice")}
        detail={t("ui.slurp.settings.creators.subscriptionPriceDetail")}
      >
        <NumberSetting
          value={query.data?.subscriptionPrice ?? 0}
          min={0}
          max={9999}
          onSave={(value) =>
            setPrice.mutate(
              { accountId: creatorId, personaId, price: value },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.unlockPrice", { defaultValue: "Locked post price" })}
        detail={t("ui.slurp.settings.creators.unlockPriceDetail", {
          defaultValue: "Default price for this Creator's locked posts. Zero uses the Wallet default.",
        })}
      >
        <NumberSetting
          value={messaging.unlockPrice ?? 0}
          min={0}
          max={9999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, unlockPrice: value || null })}
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.commissionBase", { defaultValue: "Commission base price" })}
        detail={t("ui.slurp.settings.creators.commissionBaseDetail", {
          defaultValue:
            "Price for an average brief. A quick sketch quotes lower, a detailed scene or a set quotes higher.",
        })}
      >
        <NumberSetting
          value={messaging.commissionBase}
          min={1}
          max={99999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, commissionBase: value })}
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.commissionMin", { defaultValue: "Lowest commission price" })}
        detail={t("ui.slurp.settings.creators.commissionMinDetail", {
          defaultValue: "No quote goes below this, and haggling never meets a fan under it.",
        })}
      >
        <NumberSetting
          value={messaging.commissionMin}
          min={1}
          max={99999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, commissionMin: value })}
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.commissionMax", { defaultValue: "Highest commission price" })}
        detail={t("ui.slurp.settings.creators.commissionMaxDetail", {
          defaultValue: "No quote goes above this, however large the brief.",
        })}
      >
        <NumberSetting
          value={messaging.commissionMax}
          min={1}
          max={99999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, commissionMax: value })}
        />
      </Field>
      <Toggle
        label={t("ui.slurp.settings.creators.autoQuote", { defaultValue: "Quote audience commissions automatically" })}
        detail={t("ui.slurp.settings.creators.autoQuoteDetail", {
          defaultValue:
            "Audience briefs get a quote from the prices above. You still answer offers and your own fans by hand.",
        })}
        value={messaging.autoQuote}
        onChange={(value) => patch({ creatorAccountId: creatorId, personaId, autoQuote: value })}
      />
      {query.data?.suggested && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--accent)] p-3 text-xs">
          <span>
            {t("ui.slurp.settings.creators.suggestedPrices", {
              defaultValue:
                "Suggested for your audience: {{subscription}}/week · {{unlock}} per locked post · {{commission}} commission base",
              subscription: query.data.suggested.subscriptionPrice,
              unlock: query.data.suggested.unlockPrice,
              commission: query.data.suggested.commissionBase,
            })}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const suggested = query.data?.suggested;
              if (!suggested) return;
              patch({
                creatorAccountId: creatorId,
                personaId,
                unlockPrice: suggested.unlockPrice || null,
                commissionBase: suggested.commissionBase,
              });
              setPrice.mutate(
                { accountId: creatorId, personaId, price: suggested.subscriptionPrice },
                { onError: (error) => toast.error(errorMessage(error)) },
              );
            }}
            className="min-h-9 rounded-lg px-3 font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
          >
            {t("ui.slurp.settings.creators.useSuggestedPrices", { defaultValue: "Use suggestions" })}
          </button>
        </div>
      )}
    </SettingsGroup>
  );
}
