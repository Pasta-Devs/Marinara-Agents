import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpDiscoveryGender } from "../../slp/base/state/slp-state-types";
import { useSlurpSettings } from "../../slp/features/settings/slp-settings-hooks";
import {
  groupSlurpDiscoveryTags,
  normalizeSlurpDiscoveryTag,
  normalizeSlurpDiscoveryTags,
  SLURP_DISCOVERY_MIN_TAGS,
  SLURP_DISCOVERY_TAG_LIMIT,
  SLURP_DISCOVERY_TAG_MAX_LENGTH,
} from "../../slp/features/discovery/slp-discovery";
import { cn } from "../../lib/utils";

export function SlurpDiscoveryProfileEditor({
  gender,
  tags,
  disabled,
  onChange,
}: {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
  disabled?: boolean;
  onChange: (patch: { gender?: SlurpDiscoveryGender | null; tags?: string[] }) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [search, setSearch] = useState("");
  const [customTag, setCustomTag] = useState("");
  const discoveryTags = useSlurpSettings().data?.discoveryTags;
  const normalizedSearch = normalizeSlurpDiscoveryTag(search).toLocaleLowerCase();
  const groups = useMemo(
    () =>
      groupSlurpDiscoveryTags(discoveryTags)
        .map((group) => ({
          ...group,
          tags: group.tags.filter((tag) =>
            localizeUi(`ui.slurp.tags.${tag}`, { defaultValue: tag }).toLocaleLowerCase().includes(normalizedSearch),
          ),
        }))
        .filter((group) => group.tags.length > 0),
    [discoveryTags, localizeUi, normalizedSearch],
  );
  const toggleTag = (tag: string) => {
    onChange({
      tags: tags.includes(tag) ? tags.filter((entry) => entry !== tag) : normalizeSlurpDiscoveryTags([...tags, tag]),
    });
  };
  const addCustomTag = () => {
    const tag = normalizeSlurpDiscoveryTag(customTag);
    if (!tag || tag.length > SLURP_DISCOVERY_TAG_MAX_LENGTH || tags.length >= SLURP_DISCOVERY_TAG_LIMIT) return;
    onChange({ tags: normalizeSlurpDiscoveryTags([...tags, tag]) });
    setCustomTag("");
  };

  return (
    <section
      className="space-y-4 rounded-xl border border-[var(--noodle-divider)] bg-[var(--accent)]/30 p-4"
      aria-labelledby="slurp-discovery-profile-heading"
    >
      <div>
        <h3 id="slurp-discovery-profile-heading" className="text-sm font-black">
          {localizeUi("ui.slurp.profile.discoveryProfile", { defaultValue: "Discovery profile" })}
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.profile.discoveryProfileDetail", {
            defaultValue: "Help the right people find this Creator. AI suggestions are always editable.",
          })}
        </p>
      </div>
      <label className="block space-y-1.5 text-xs font-bold">
        <span>{localizeUi("ui.slurp.discover.genderLabel", { defaultValue: "Gender" })}</span>
        <select
          value={gender ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ gender: (event.target.value || null) as SlurpDiscoveryGender | null })}
          className="mari-chrome-field h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--noodle-accent)]"
        >
          <option value="">
            {localizeUi("ui.slurp.discover.gender.unspecified", { defaultValue: "Not specified" })}
          </option>
          {(["male", "female", "other"] as const).map((value) => (
            <option key={value} value={value}>
              {localizeUi(`ui.slurp.discover.gender.${value}`, { defaultValue: value })}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold">
            {localizeUi("ui.slurp.discover.tagsLabel", { defaultValue: "Tags" })}
          </span>
          <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
            {tags.length}/{SLURP_DISCOVERY_TAG_LIMIT}
            {tags.length < SLURP_DISCOVERY_MIN_TAGS &&
              ` · ${localizeUi("ui.slurp.discover.minTags", { count: SLURP_DISCOVERY_MIN_TAGS })}`}
          </span>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                disabled={disabled}
                onClick={() => toggleTag(tag)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--noodle-accent)]/15 px-3 text-xs font-bold text-[var(--noodle-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50"
              >
                {localizeUi(`ui.slurp.tags.${tag}`, { defaultValue: tag })}
                <X size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-3 focus-within:border-[var(--noodle-accent)]">
          <Search size={15} className="text-[var(--muted-foreground)]" aria-hidden="true" />
          <span className="sr-only">{localizeUi("ui.slurp.discover.searchTags", { defaultValue: "Search tags" })}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
            placeholder={localizeUi("ui.slurp.discover.searchTags", { defaultValue: "Search tags" })}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div className="max-h-52 space-y-3 overflow-y-auto pr-1">
          {groups.map((group) => (
            <fieldset key={group.id}>
              <legend className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                {localizeUi(`ui.slurp.discover.tagGroup.${group.id}`, { defaultValue: group.id })}
              </legend>
              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled || (!selected && tags.length >= SLURP_DISCOVERY_TAG_LIMIT)}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-40",
                        selected
                          ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)] text-white"
                          : "border-[var(--noodle-divider)] bg-[var(--background)] hover:border-[var(--noodle-accent)]",
                      )}
                    >
                      {selected && <Check size={13} aria-hidden="true" />}
                      {localizeUi(`ui.slurp.tags.${tag}`, { defaultValue: tag })}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{localizeUi("ui.slurp.discover.customTag", { defaultValue: "Custom tag" })}</span>
            <input
              value={customTag}
              maxLength={SLURP_DISCOVERY_TAG_MAX_LENGTH}
              disabled={disabled || tags.length >= SLURP_DISCOVERY_TAG_LIMIT}
              onChange={(event) => setCustomTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder={localizeUi("ui.slurp.discover.customTag", { defaultValue: "Add a custom tag" })}
              className="mari-chrome-field h-10 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--noodle-accent)]"
            />
          </label>
          <button
            type="button"
            onClick={addCustomTag}
            disabled={disabled || !customTag.trim() || tags.length >= SLURP_DISCOVERY_TAG_LIMIT}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-40"
          >
            <Plus size={14} aria-hidden="true" />
            {localizeUi("ui.slurp.discover.addTag", { defaultValue: "Add" })}
          </button>
        </div>
      </div>
    </section>
  );
}
