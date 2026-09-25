import { Search, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useReplaceSlurpDiscoveryTag, useSlurpDiscoveryTagUsage } from "./slp-discovery-tag-hooks";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { groupSlurpDiscoveryTags, normalizeSlurpDiscoveryTag, SLURP_DISCOVERY_TAG_MAX_LENGTH } from "./slp-discovery";
import { cn } from "../../../lib/utils";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";

type DiscoveryTag = { tag: string; group: string };

const fieldClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm";
const key = (tag: string) => normalizeSlurpDiscoveryTag(tag).toLocaleLowerCase();

/** Tags grouped as chips. Clicking a chip opens its editor in place: rename (or merge), move group, delete. */
export function SlurpTagsSettings({
  tags,
  saving,
  onSave,
}: {
  tags: DiscoveryTag[];
  saving: boolean;
  onSave: (tags: DiscoveryTag[]) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const usage = useSlurpDiscoveryTagUsage(true);
  const replaceTag = useReplaceSlurpDiscoveryTag();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", group: "" });
  const [newTag, setNewTag] = useState({ tag: "", group: "" });

  const needle = key(filter);
  const groups = groupSlurpDiscoveryTags(tags)
    .map((group) => ({
      ...group,
      tags: group.tags.filter((tag) => key(tag).includes(needle) || key(group.id).includes(needle)),
    }))
    .filter((group) => group.tags.length > 0);
  const counts = (tag: string) => ({
    count: usage.data?.creators[tag.toLocaleLowerCase()] ?? 0,
    arcTypes: usage.data?.arcTypes[tag.toLocaleLowerCase()] ?? 0,
  });
  const current = tags.find((entry) => entry.tag === selected) ?? null;
  const draftName = normalizeSlurpDiscoveryTag(draft.name);
  const draftGroup = draft.group.trim() || current?.group || "";
  const mergeTarget =
    current && key(draftName) !== key(current.tag)
      ? tags.find((entry) => key(entry.tag) === key(draftName))
      : undefined;
  const busy = saving || replaceTag.isPending;
  const onError = (error: unknown) => toast.error(error instanceof Error ? error.message : String(error));

  const open = (entry: DiscoveryTag) => {
    if (selected === entry.tag) return setSelected(null);
    setSelected(entry.tag);
    setDraft({ name: entry.tag, group: entry.group });
  };

  const saveCurrent = async () => {
    if (!current || !draftName) return;
    if (
      draftGroup !== current.group &&
      !(await onSave(tags.map((entry) => (entry.tag === current.tag ? { ...entry, group: draftGroup } : entry))))
    )
      return;
    if (draftName === current.tag) return;
    replaceTag.mutate(
      { from: current.tag, to: draftName },
      { onSuccess: () => setSelected(mergeTarget?.tag ?? draftName), onError },
    );
  };

  const deleteCurrent = async () => {
    if (!current) return;
    const confirmed = await showConfirmDialog({
      title: t("ui.slurp.settings.tags.delete"),
      message: t("ui.slurp.settings.tags.deleteConfirm", { tag: current.tag, ...counts(current.tag) }),
      confirmLabel: t("ui.slurp.settings.tags.delete"),
      cancelLabel: t("ui.slurp.actions.cancel"),
    });
    if (confirmed) replaceTag.mutate({ from: current.tag, to: null }, { onSuccess: () => setSelected(null), onError });
  };

  const editor = current && (
    <div
      id="slurp-tag-editor"
      className="space-y-3 rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-surface-raised)] p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{current.tag}</p>
          <p className="text-xs text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.tags.usageDetail", counts(current.tag))}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-label={t("ui.slurp.settings.tags.close")}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold">
          {t("ui.slurp.settings.tags.name")}
          <input
            value={draft.name}
            maxLength={SLURP_DISCOVERY_TAG_MAX_LENGTH}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("ui.slurp.settings.tags.group")}
          <input
            value={draft.group}
            maxLength={40}
            list="slurp-discovery-tag-groups"
            onChange={(event) => setDraft({ ...draft, group: event.target.value })}
            className={fieldClass}
          />
        </label>
      </div>
      {mergeTarget && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          {t("ui.slurp.settings.tags.mergeHint", { tag: mergeTarget.tag })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !draftName || (draftName === current.tag && draftGroup === current.group)}
          onClick={() => void saveCurrent()}
          className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {t("ui.slurp.settings.tags.save")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void deleteCurrent()}
          className="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-[var(--slurp-canvas)] disabled:opacity-50"
        >
          {t("ui.slurp.settings.tags.delete")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <BackstagePageHeader detail={t("ui.slurp.settings.tags.detail")} />
      <label className="relative flex min-h-11 items-center gap-2 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 focus-within:ring-2 focus-within:ring-[var(--slurp-focus)]">
        <Search size={15} aria-hidden="true" className="text-[var(--slurp-muted)]" />
        <span className="sr-only">{t("ui.slurp.settings.tags.filter")}</span>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("ui.slurp.settings.tags.filter")}
          className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm"
        />
      </label>

      {groups.length === 0 ? (
        <p className="text-sm text-[var(--slurp-muted)]">{t("ui.slurp.settings.tags.empty")}</p>
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-labelledby={`slurp-tag-group-${group.id}`} className="space-y-2">
            <h3
              id={`slurp-tag-group-${group.id}`}
              className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--slurp-muted)]"
            >
              {group.id} <span className="tabular-nums">· {group.tags.length}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {group.tags.map((tag) => {
                const active = selected === tag;
                const { count } = counts(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-expanded={active}
                    aria-controls={active ? "slurp-tag-editor" : undefined}
                    onClick={() => open(tags.find((entry) => entry.tag === tag)!)}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]",
                      active
                        ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]"
                        : "border-[var(--slurp-outline)] hover:bg-[var(--slurp-surface-raised)]",
                    )}
                  >
                    {tag}
                    <span className="text-xs tabular-nums text-[var(--slurp-muted)]" aria-hidden="true">
                      {count}
                    </span>
                    <span className="sr-only">{t("ui.slurp.settings.tags.usage", { count })}</span>
                  </button>
                );
              })}
            </div>
            {current?.group === group.id && group.tags.includes(current.tag) && editor}
          </section>
        ))
      )}

      <form
        className="flex flex-wrap gap-2 border-t border-[var(--slurp-outline)] pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const tag = normalizeSlurpDiscoveryTag(newTag.tag);
          const group = newTag.group.trim() || "themes";
          if (!tag || tags.some((entry) => key(entry.tag) === key(tag))) return;
          void onSave([...tags, { tag, group }]).then((saved) => saved && setNewTag({ tag: "", group: "" }));
        }}
      >
        <input
          aria-label={t("ui.slurp.settings.tags.newTag")}
          placeholder={t("ui.slurp.settings.tags.newTag")}
          value={newTag.tag}
          maxLength={SLURP_DISCOVERY_TAG_MAX_LENGTH}
          onChange={(event) => setNewTag({ ...newTag, tag: event.target.value })}
          className={cn(fieldClass, "w-auto flex-1")}
        />
        <input
          aria-label={t("ui.slurp.settings.tags.group")}
          placeholder={t("ui.slurp.settings.tags.group")}
          value={newTag.group}
          maxLength={40}
          list="slurp-discovery-tag-groups"
          onChange={(event) => setNewTag({ ...newTag, group: event.target.value })}
          className={cn(fieldClass, "w-32")}
        />
        <datalist id="slurp-discovery-tag-groups">
          {[...new Set(tags.map((entry) => entry.group))].map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={saving || !newTag.tag.trim()}
          className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {t("ui.slurp.settings.tags.add")}
        </button>
      </form>
    </div>
  );
}
