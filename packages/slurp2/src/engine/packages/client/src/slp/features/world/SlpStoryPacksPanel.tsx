import { ChevronDown, Download, PackageOpen, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { SlpArcBlueprint, SlpEventBlueprint } from "../../../../../shared/src/slp/slp-story-engine.js";
import type { SlurpArcType } from "../projects/slp-projects-contract.js";
import type { SlurpPlatformEvent } from "../../../../../shared/src/slp/slp-platform-events.js";
import { errorMessage } from "../../modules/settings/slp-backstage-format.js";
import {
  exportSlpStoryPack,
  useApplyStoryPack,
  usePreviewBundledStoryPack,
  usePreviewStoryPack,
  useSlpBundledStoryPacks,
  useSlpStoryTimeline,
  useSetStoryOccurrenceStatus,
  type SlpPackPreview,
} from "./slp-story-hooks.js";

const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm font-semibold hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50";

export function SlpStoryPacksPanel({ arcs, events }: { arcs: SlurpArcType[]; events: SlurpPlatformEvent[] }) {
  const packs = useSlpBundledStoryPacks();
  const timeline = useSlpStoryTimeline();
  const bundledPreview = usePreviewBundledStoryPack();
  const uploadPreview = usePreviewStoryPack();
  const apply = useApplyStoryPack();
  const setStatus = useSetStoryOccurrenceStatus();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<SlpPackPreview | null>(null);
  const [actions, setActions] = useState<Record<string, "copy" | "replace" | "skip">>({});
  const [enabledEntries, setEnabledEntries] = useState<Record<string, boolean>>({});
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});
  const [editedEntries, setEditedEntries] = useState<Record<string, SlpArcBlueprint | SlpEventBlueprint>>({});
  const showPreview = (next: SlpPackPreview) => {
    setPreview(next);
    setEditedEntries(
      Object.fromEntries(
        next.entries.flatMap((entry) => (entry.value ? [[entryKey(entry), structuredClone(entry.value)]] : [])),
      ),
    );
    setEnabledEntries(
      Object.fromEntries(next.entries.map((entry) => [entryKey(entry), Boolean(entry.value?.enabled)])),
    );
    setExpandedEntries({});
    setActions(
      Object.fromEntries(
        next.entries.map((entry) => [
          entryKey(entry),
          entry.status === "local-edit" ? "skip" : entry.status === "conflict" ? "copy" : "replace",
        ]),
      ),
    );
  };
  const entryKey = (entry: { kind: string; contentId: string }) => `${entry.kind}:${entry.contentId}`;
  const updateArc = (entry: SlpPackPreview["entries"][number], patch: Partial<SlpArcBlueprint>) => {
    if (entry.kind !== "arc") return;
    const key = entryKey(entry);
    const current = editedEntries[key];
    if (!current || !("chapters" in current)) return;
    setEditedEntries({ ...editedEntries, [key]: { ...current, ...patch } });
  };
  const updateChapter = (
    entry: SlpPackPreview["entries"][number],
    index: number,
    patch: Partial<SlpArcBlueprint["chapters"][number]>,
  ) => {
    if (entry.kind !== "arc") return;
    const key = entryKey(entry);
    const current = editedEntries[key];
    if (!current || !("chapters" in current)) return;
    setEditedEntries({
      ...editedEntries,
      [key]: {
        ...current,
        chapters: current.chapters.map((chapter, chapterIndex) =>
          chapterIndex === index ? { ...chapter, ...patch } : chapter,
        ),
      },
    });
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_048_576) return toast.error("Choose a story pack smaller than 1 MiB.");
    try {
      showPreview(await uploadPreview.mutateAsync(JSON.parse(await file.text())));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };
  const download = async () => {
    try {
      const pack = await exportSlpStoryPack({
        id: `slurp-export-${Date.now().toString(36)}`,
        name: "My Slurp stories",
        arcIds: arcs.map((item) => item.id),
        eventIds: events.map((item) => item.id),
      });
      const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "slurp-story-pack.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="slurp-story-packs-heading" className="space-y-4">
        <div>
          <h2 id="slurp-story-packs-heading" className="text-base font-black">
            Story packs
          </h2>
          <p className="mt-1 text-sm text-[var(--slurp-muted)]">
            Review reusable arcs and events before adding them. Imports start disabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            ref={uploadRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <button type="button" className={button} onClick={() => uploadRef.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            Import story pack
          </button>
          <button type="button" className={button} onClick={() => void download()}>
            <Download size={16} aria-hidden="true" />
            Export library
          </button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(packs.data?.packs ?? []).map((pack) => (
            <li
              key={pack.id}
              className="space-y-3 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
            >
              <div className="flex items-start gap-3">
                <PackageOpen size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--noodle-accent)]" />
                <div>
                  <h3 className="font-bold">{pack.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">{pack.description}</p>
                </div>
              </div>
              <p className="text-xs tabular-nums text-[var(--slurp-muted)]">
                {pack.arcCount} arcs · {pack.eventCount} events
              </p>
              <button
                type="button"
                className={button}
                disabled={bundledPreview.isPending}
                onClick={() =>
                  void bundledPreview
                    .mutateAsync(pack.id)
                    .then(showPreview)
                    .catch((error) => toast.error(errorMessage(error)))
                }
              >
                Review pack
              </button>
            </li>
          ))}
        </ul>
      </section>

      {preview && (
        <section
          aria-labelledby="slurp-pack-preview-heading"
          className="space-y-4 rounded-2xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
        >
          <div>
            <h2 id="slurp-pack-preview-heading" className="text-base font-black">
              Review {preview.pack.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--slurp-muted)]">
              Choose what happens to each item. Nothing changes until you apply the pack.
            </p>
          </div>
          <ul className="space-y-3">
            {preview.entries.map((entry) => (
              <li
                key={entryKey(entry)}
                className="grid gap-3 rounded-xl bg-[var(--slurp-canvas)] p-3 sm:grid-cols-[1fr_minmax(10rem,auto)] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{entry.name}</h3>
                      <p className="text-xs text-[var(--slurp-muted)]">
                        {entry.kind === "arc" ? "Storyline type" : "Event"} · {entry.status.replace("-", " ")}
                      </p>
                    </div>
                    {entry.kind === "arc" && (
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[var(--noodle-accent)] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                        aria-expanded={expandedEntries[entryKey(entry)] ?? false}
                        onClick={() =>
                          setExpandedEntries({
                            ...expandedEntries,
                            [entryKey(entry)]: !(expandedEntries[entryKey(entry)] ?? false),
                          })
                        }
                      >
                        Edit
                        <ChevronDown
                          size={14}
                          aria-hidden="true"
                          className={
                            expandedEntries[entryKey(entry)]
                              ? "rotate-180 transition-transform"
                              : "transition-transform"
                          }
                        />
                      </button>
                    )}
                  </div>
                  {entry.kind === "arc" &&
                  expandedEntries[entryKey(entry)] &&
                  editedEntries[entryKey(entry)] &&
                  "chapters" in editedEntries[entryKey(entry)]! ? (
                    <div className="grid gap-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs font-semibold">
                          Storyline type name
                          <input
                            className="min-h-10 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm"
                            value={(editedEntries[entryKey(entry)] as SlpArcBlueprint).name}
                            onChange={(event) => updateArc(entry, { name: event.target.value })}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold">
                          Tone
                          <input
                            className="min-h-10 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm"
                            value={(editedEntries[entryKey(entry)] as SlpArcBlueprint).tone}
                            onChange={(event) => updateArc(entry, { tone: event.target.value })}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1 text-xs font-semibold">
                        Direction
                        <textarea
                          className="min-h-20 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 py-2 text-sm"
                          value={(editedEntries[entryKey(entry)] as SlpArcBlueprint).description}
                          onChange={(event) => updateArc(entry, { description: event.target.value })}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold">
                        Duration (days)
                        <input
                          type="number"
                          min={1}
                          max={365}
                          className="min-h-10 w-40 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm"
                          value={(editedEntries[entryKey(entry)] as SlpArcBlueprint).durationDays}
                          onChange={(event) => updateArc(entry, { durationDays: Number(event.target.value) })}
                        />
                      </label>
                      <div className="grid gap-2">
                        <p className="text-xs font-semibold">Phases</p>
                        {(editedEntries[entryKey(entry)] as SlpArcBlueprint).chapters.map((chapter, index) => (
                          <div key={`${entryKey(entry)}:${index}`} className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem]">
                            <input
                              aria-label={`Phase ${index + 1} label`}
                              className="min-h-10 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm"
                              value={chapter.label}
                              onChange={(event) => updateChapter(entry, index, { label: event.target.value })}
                            />
                            <input
                              aria-label={`Phase ${index + 1} minimum days`}
                              type="number"
                              min={0}
                              max={90}
                              className="min-h-10 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm"
                              value={chapter.minDays}
                              onChange={(event) => updateChapter(entry, index, { minDays: Number(event.target.value) })}
                            />
                            <input
                              aria-label={`Phase ${index + 1} maximum days`}
                              type="number"
                              min={0}
                              max={90}
                              className="min-h-10 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm"
                              value={chapter.maxDays}
                              onChange={(event) => updateChapter(entry, index, { maxDays: Number(event.target.value) })}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {entry.warnings.map((warning) => (
                    <p key={warning} className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Warning: {warning}
                    </p>
                  ))}
                </div>
                <label className="grid gap-1 text-xs font-semibold">
                  Import action
                  <select
                    className="min-h-11 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
                    value={actions[entryKey(entry)]}
                    onChange={(event) =>
                      setActions({ ...actions, [entryKey(entry)]: event.target.value as "copy" | "replace" | "skip" })
                    }
                  >
                    <option value="replace">Use pack version</option>
                    <option value="copy">Import renamed copy</option>
                    <option value="skip">Keep local / skip</option>
                  </select>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-xs font-semibold sm:col-start-2">
                  <input
                    type="checkbox"
                    checked={enabledEntries[entryKey(entry)] ?? false}
                    onChange={(event) =>
                      setEnabledEntries({ ...enabledEntries, [entryKey(entry)]: event.target.checked })
                    }
                    className="size-4 accent-[var(--noodle-accent)]"
                  />
                  Enable after import
                </label>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--slurp-canvas)] p-3 shadow-lg ring-1 ring-inset ring-[var(--slurp-outline)]">
            <p role="status" className="text-sm font-semibold">
              {Object.values(actions).filter((action) => action !== "skip").length} items selected
            </p>
            <div className="flex gap-2">
              <button type="button" className={button} onClick={() => setPreview(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                disabled={apply.isPending}
                onClick={() =>
                  void apply
                    .mutateAsync({
                      previewId: preview.previewId,
                      choices: preview.entries.map((entry) => ({
                        kind: entry.kind,
                        contentId: entry.contentId,
                        action: actions[entryKey(entry)] ?? "skip",
                        enabled: enabledEntries[entryKey(entry)] ?? false,
                        automation: "inherit",
                        value: editedEntries[entryKey(entry)],
                      })),
                    })
                    .then(() => {
                      toast.success("Story pack applied");
                      setPreview(null);
                    })
                    .catch((error) => toast.error(errorMessage(error)))
                }
              >
                Apply pack
              </button>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="slurp-world-timeline-heading" className="space-y-3">
        <div>
          <h2 id="slurp-world-timeline-heading" className="text-base font-black">
            World timeline
          </h2>
          <p className="mt-1 text-sm text-[var(--slurp-muted)]">
            Suggestions, active events, and recent history keep their original participants and rules.
          </p>
        </div>
        {(timeline.data?.occurrences ?? []).length === 0 ? (
          <p className="text-sm text-[var(--slurp-muted)]">
            No event occurrences yet. Start a manual event or wait for a scheduled date.
          </p>
        ) : (
          <ul className="space-y-3">
            {timeline.data?.occurrences.map((occurrence) => (
              <li
                key={occurrence.id}
                className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{occurrence.blueprint.name}</h3>
                    <p className="mt-1 text-xs text-[var(--slurp-muted)]">
                      {occurrence.status} · {occurrence.participantIds.length} Creators · {occurrence.triggerEvidence}
                    </p>
                  </div>
                  {occurrence.status === "suggested" && (
                    <div className="flex gap-2">
                      <button
                        className={button}
                        type="button"
                        onClick={() => setStatus.mutate({ id: occurrence.id, status: "dismissed" })}
                      >
                        Dismiss
                      </button>
                      <button
                        className={button}
                        type="button"
                        onClick={() => setStatus.mutate({ id: occurrence.id, status: "active" })}
                      >
                        Start event
                      </button>
                    </div>
                  )}
                  {occurrence.status === "active" && (
                    <button
                      className={button}
                      type="button"
                      onClick={() => setStatus.mutate({ id: occurrence.id, status: "completed" })}
                    >
                      End event
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
