import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useBulkUpdateSlurpCreators,
  type SlurpCreatorBulkPatch,
  type SlurpDiscoveryGender,
} from "../../hooks/use-slurp";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { SLURP_DISCOVERY_TAG_LIMIT } from "../../lib/slurp-discovery";
import { cn } from "../../lib/utils";
import { Field, SettingsGroup } from "./SlurpSettingsControls";

type Choice = "keep" | "on" | "off";

const selectClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm";

function TagChoices({
  legend,
  tags,
  picked,
  limit,
  onChange,
}: {
  legend: string;
  tags: string[];
  picked: string[];
  limit?: number;
  onChange: (picked: string[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const on = picked.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              disabled={!on && limit !== undefined && picked.length >= limit}
              onClick={() => onChange(on ? picked.filter((entry) => entry !== tag) : [...picked, tag])}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-40",
                on
                  ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)] text-white"
                  : "border-[var(--border)] hover:border-[var(--noodle-accent)]",
              )}
            >
              {on && <Check size={13} aria-hidden="true" />}
              {t(`ui.slurp.tags.${tag}`, { defaultValue: tag })}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One set of changes for every selected Creator. Each field starts at "No change". */
export function SlurpCreatorBulkEdit({
  creators,
  tagOptions,
}: {
  creators: Array<{ id: string; tags?: string[] }>;
  tagOptions: string[];
}) {
  const { t } = useTranslation();
  const bulk = useBulkUpdateSlurpCreators();
  const [gender, setGender] = useState<"keep" | "" | SlurpDiscoveryGender>("keep");
  const [addTags, setAddTags] = useState<string[]>([]);
  const [removeTags, setRemoveTags] = useState<string[]>([]);
  const [autoPosting, setAutoPosting] = useState<Choice>("keep");
  const [images, setImages] = useState<Choice>("keep");

  const presentTags = [...new Set(creators.flatMap((creator) => creator.tags ?? []))].sort((a, b) =>
    a.localeCompare(b),
  );
  const patch: SlurpCreatorBulkPatch = {
    ...(gender !== "keep" && { gender: gender || null }),
    ...(addTags.length > 0 && { addTags }),
    ...(removeTags.length > 0 && { removeTags }),
    ...(autoPosting !== "keep" && { autoPosting: autoPosting === "on" }),
    ...(images !== "keep" && { imagesEnabled: images === "on" }),
  };
  const choiceOptions = (
    <>
      <option value="keep">{t("ui.slurp.settings.creators.bulk.keep")}</option>
      <option value="on">{t("ui.slurp.settings.creators.bulk.on")}</option>
      <option value="off">{t("ui.slurp.settings.creators.bulk.off")}</option>
    </>
  );

  const apply = async () => {
    const confirmed = await showConfirmDialog({
      title: t("ui.slurp.settings.creators.bulk.confirmTitle"),
      message: t("ui.slurp.settings.creators.bulk.confirm", { count: creators.length }),
      confirmLabel: t("ui.slurp.settings.creators.bulk.apply"),
      cancelLabel: t("ui.slurp.actions.cancel"),
    });
    if (!confirmed) return;
    bulk.mutate(
      { ids: creators.map((creator) => creator.id), patch },
      {
        onSuccess: (result) => {
          toast.success(t("ui.slurp.settings.creators.bulk.done", { count: result.updated }));
          if (result.skipped > 0)
            toast.warning(t("ui.slurp.settings.creators.bulk.skipped", { count: result.skipped }));
          if (result.tagLimitReached > 0) {
            toast.warning(t("ui.slurp.settings.creators.bulk.tagLimit", { count: result.tagLimitReached }));
          }
          setGender("keep");
          setAddTags([]);
          setRemoveTags([]);
          setAutoPosting("keep");
          setImages("keep");
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
      },
    );
  };

  return (
    <SettingsGroup title={t("ui.slurp.settings.creators.bulk.title", { count: creators.length })}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("ui.slurp.discover.genderLabel")}>
          <select
            value={gender}
            onChange={(event) => setGender(event.target.value as typeof gender)}
            className={selectClass}
          >
            <option value="keep">{t("ui.slurp.settings.creators.bulk.keep")}</option>
            <option value="">{t("ui.slurp.discover.gender.unspecified")}</option>
            {(["male", "female", "other"] as const).map((value) => (
              <option key={value} value={value}>
                {t(`ui.slurp.discover.gender.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t("ui.slurp.settings.creators.autoPost")}
          detail={t("ui.slurp.settings.creators.bulk.personaNote")}
        >
          <select
            value={autoPosting}
            onChange={(event) => setAutoPosting(event.target.value as Choice)}
            className={selectClass}
          >
            {choiceOptions}
          </select>
        </Field>
        <Field label={t("ui.slurp.settings.creators.images")}>
          <select value={images} onChange={(event) => setImages(event.target.value as Choice)} className={selectClass}>
            {choiceOptions}
          </select>
        </Field>
      </div>
      <TagChoices
        legend={t("ui.slurp.settings.creators.bulk.addTags")}
        tags={tagOptions}
        picked={addTags}
        limit={SLURP_DISCOVERY_TAG_LIMIT}
        onChange={setAddTags}
      />
      {presentTags.length > 0 ? (
        <TagChoices
          legend={t("ui.slurp.settings.creators.bulk.removeTags")}
          tags={presentTags}
          picked={removeTags}
          onChange={setRemoveTags}
        />
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">{t("ui.slurp.settings.creators.bulk.noTags")}</p>
      )}
      <button
        type="button"
        disabled={bulk.isPending || Object.keys(patch).length === 0}
        onClick={() => void apply()}
        className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 disabled:opacity-50"
      >
        {t("ui.slurp.settings.creators.bulk.apply")}
      </button>
    </SettingsGroup>
  );
}
