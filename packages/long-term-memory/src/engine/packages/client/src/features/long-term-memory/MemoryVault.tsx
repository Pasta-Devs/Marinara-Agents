import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Braces,
  Check,
  ChevronRight,
  Ellipsis,
  FileText,
  Link2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type {
  LtmBulkNoteResult,
  LtmLink,
  LtmMode,
  LtmNote,
  LtmNoteType,
  LtmScope,
  LtmSourceDerivedMemoriesResponse,
  LtmStatus,
  LtmSubject,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { getLtmKeywordIntent, ltmKeywordKey } from "../../../../shared/src/features/agents/long-term-memory/keywords.js";
import {
  invalidateLtmQueries,
  queryKeys,
  request,
  requestAllNotes,
} from "./api";
import {
  Button,
  ClickSurface,
  IconButton,
  InfoPopover,
  inputClass,
  StatusSurface,
} from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";
import {
  humanizeLabel,
  labelKeys,
  localizedLabel,
  memoryLabel as formatMemoryLabel,
  noteTypeLabel as formatNoteTypeLabel,
  scopeTargetLabel as formatScopeTargetLabel,
} from "./display-labels";
import {
  selectLtmPluralForm,
  useLtmTranslation,
  type LtmTranslationFunction,
} from "./localization";
import { LtmWorkspace, type LtmWorkspacePane } from "./LtmWorkspace";
import {
  buildScopeIndexes,
  deriveScopeBranches,
  deriveScopeConversations,
  type ScopeTargets,
} from "./scope-targets";
import { TargetPicker, type PickerTarget } from "./TargetPicker";

const noteTypes: readonly LtmNoteType[] = [
  "timeline_event",
  "character",
  "relationship",
  "scene",
  "thread",
  "world",
  "tone",
];
const groupedNoteTypes: ReadonlyArray<{
  type: LtmNoteType;
  labelKey: string;
}> = [
  {
    type: "source",
    labelKey: "ui.longTermMemory.memoryvault.source",
  },
  {
    type: "timeline_event",
    labelKey: "ui.longTermMemory.memoryvault.timelineEvents",
  },
  {
    type: "character",
    labelKey: "ui.longTermMemory.memoryvault.characters",
  },
  {
    type: "relationship",
    labelKey: "ui.longTermMemory.memoryvault.relationships",
  },
  {
    type: "thread",
    labelKey: "ui.longTermMemory.memoryvault.threads",
  },
  {
    type: "scene",
    labelKey: "ui.longTermMemory.memoryvault.scenes",
  },
  {
    type: "world",
    labelKey: "ui.longTermMemory.memoryvault.world",
  },
  {
    type: "tone",
    labelKey: "ui.longTermMemory.memoryvault.tone",
  },
];

function detailScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}
const statuses: readonly LtmStatus[] = ["active", "resolved", "archived"];
const modes: readonly LtmMode[] = ["conversation", "roleplay", "game"];
const relations: LtmLink["relation"][] = [
  "occurred_in",
  "triggered_by",
  "resolved_in",
  "evidenced_by",
  "affects_relationship",
  "affects_character",
  "caused_by",
  "involves",
  "blocks",
  "planted_in",
  "paid_off_in",
  "extracted_from",
];
const prefixes: Record<LtmNoteType, string> = {
  source: "source",
  timeline_event: "timeline",
  character: "char",
  relationship: "rel",
  scene: "scene",
  thread: "thread",
  world: "world",
  tone: "tone",
};

type Target = { id: string; label: string; scope?: LtmScope };
type NoteResponse = { note: LtmNote };

const sessionTargets = new Map<string, Target>();
type NavigatorState = {
  search: string;
  statusFilter: LtmStatus | "all";
  typeFilter: LtmNoteType | "all";
  sourceFilter: boolean;
  availableEverywhereFilter: boolean;
  sort: "updated" | "title" | "created";
  scrollTop: number;
};
const navigatorStates = new Map<string, NavigatorState>();

function fingerprint(note: LtmNote | null) {
  return note ? JSON.stringify(note) : "";
}
function hasExplicitScope(scope: LtmScope) {
  return Boolean(
    scope.chatId ||
    scope.chatIds?.length ||
    scope.groupId ||
    scope.characterIds?.length ||
    scope.personaId,
  );
}
function availabilityEntries(
  scope: LtmScope,
  targets: ReadonlyArray<PickerTarget>,
) {
  const find = (kind: PickerTarget["kind"], id: string) =>
    targets.find((target) => target.kind === kind && target.id === id)?.label ?? id;
  const chatIds = new Set([
    ...(scope.chatId ? [scope.chatId] : []),
    ...(scope.chatIds ?? []),
  ]);
  return [
    ...[...chatIds].map((id) => ({ kind: "chat" as const, id, label: find("chat", id) })),
    ...(scope.groupId
      ? [{ kind: "group" as const, id: scope.groupId, label: find("group", scope.groupId) }]
      : []),
    ...(scope.characterIds ?? []).map((id) => ({ kind: "character" as const, id, label: find("character", id) })),
    ...(scope.personaId
      ? [{ kind: "persona" as const, id: scope.personaId, label: find("persona", scope.personaId) }]
      : []),
  ];
}
function list(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function searchable(note: LtmNote) {
  return [
    note.id,
    note.title,
    note.type,
    note.status,
    ...note.tags,
    ...note.keywords,
    ...Object.values(note.sections).map((section) => section.text),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}
function activeKeywordValues(note: LtmNote) {
  const intent = getLtmKeywordIntent(note);
  const suppressed = new Set(intent.suppressed.map(ltmKeywordKey));
  return [...intent.generated, ...intent.manual].filter(
    (keyword, index, values) =>
      !suppressed.has(ltmKeywordKey(keyword)) &&
      values.findIndex((value) => ltmKeywordKey(value) === ltmKeywordKey(keyword)) === index,
  );
}
function preview(
  note: LtmNote,
  search: string,
  localizeUi: LtmTranslationFunction,
) {
  const sections = Object.entries(note.sections).filter(([, section]) =>
    section.text.trim(),
  );
  const query = search.trim().toLocaleLowerCase();
  const selected =
    sections.find(([, candidate]) =>
      candidate.text.toLocaleLowerCase().includes(query),
    ) ?? sections[0];
  if (!selected) {
    const keyword = activeKeywordValues(note).find((value) =>
      value.toLocaleLowerCase().includes(query),
    );
    return keyword ? { label: localizeUi("ui.longTermMemory.memoryvault.keywordMatch"), text: keyword } : null;
  }
  const [key, section] = selected;
  const text = section.text.trim();
  const match = query ? text.toLocaleLowerCase().indexOf(query) : -1;
  const start = match > 60 ? match - 60 : 0;
  return {
    label: formatNoteTypeLabel(key, localizeUi),
    text: `${start ? "..." : ""}${text.slice(start, start + 180)}${start + 180 < text.length ? "..." : ""}`,
  };
}

function suggestedDetailKey(type: LtmNoteType) {
  return {
    timeline_event: "event",
    character: "facts",
    relationship: "state",
    scene: "summary",
    thread: "summary",
    world: "facts",
    tone: "observations",
    source: "content",
  }[type];
}
function newNote(scope: LtmScope, localizeUi: LtmTranslationFunction): LtmNote {
  const now = new Date().toISOString();
  return {
    id: `world_${randomId()}`,
    title: localizeUi("ui.longTermMemory.memoryvault.untitledMemory"),
    type: "world",
    status: "active",
    modes: ["roleplay"],
    scope,
    tags: [],
    keywords: [],
    createdAt: now,
    updatedAt: now,
    links: [],
    sections: {
      facts: {
        text: localizeUi("ui.longTermMemory.memoryvault.addDurableContextHere"),
        updatedAt: now,
      },
    },
    conflicts: [],
    version: 1,
  };
}

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function recoveredNote(
  handoff: NonNullable<LongTermMemoryDestinationProps["recoveryHandoff"]>,
  localizeUi: LtmTranslationFunction,
): LtmNote {
  const note = newNote(handoff.scope, localizeUi);
  const recovery = handoff.candidate.recovery;
  const type =
    recovery?.noteType && recovery.noteType !== "source"
      ? recovery.noteType
      : note.type;
  const id = `${prefixes[type]}_${randomId()}`;
  const sectionKey = recovery?.sectionKey ?? "facts";
  const suggestedTitle = (recovery?.noteId ?? id)
    .replace(new RegExp(`^${prefixes[type]}_?`), "")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
  const now = new Date().toISOString();
  return {
    ...note,
    id,
    title:
      suggestedTitle ||
      localizeUi("ui.longTermMemory.memoryvault.recoveredMemory"),
    type,
    status: recovery?.status ?? note.status,
    modes: handoff.modes,
    scope: handoff.scope,
    sections: {
      [sectionKey]: {
        text: handoff.candidate.snippet ?? handoff.candidate.message,
        updatedAt: now,
      },
    },
  };
}

function Pill({
  children,
  label,
  onRemove,
}: {
  children: ReactNode;
  label?: string;
  onRemove: () => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const removeLabel = localizeUi("ui.longTermMemory.pill.removeValue1", {
    value1: label ?? String(children),
  });
  return (
    <span className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-md bg-[var(--secondary)] px-2 text-xs text-[var(--foreground)]">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-[var(--accent)]"
      >
        <X aria-hidden="true" size="0.75rem" />
      </button>
    </span>
  );
}

function TokenEditor({
  label,
  values,
  placeholder,
  displayValue = (value) => value,
  help,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  displayValue?: (value: string) => string;
  help?: ReactNode;
  onChange: (next: string[]) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const [value, setValue] = useState("");
  const add = () => {
    const next = list(value).filter((item) => !values.includes(item));
    if (next.length) onChange([...values, ...next]);
    setValue("");
  };
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-1 text-xs font-medium">
        {label}
        {help ? <InfoPopover label={label} content={help} /> : null}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {values.map((item) => (
          <Pill
            key={item}
            label={displayValue(item)}
            onRemove={() => onChange(values.filter((value) => value !== item))}
          >
            {displayValue(item)}
          </Pill>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={label}
        />
        <Button onClick={add} disabled={!value.trim()}>
          <Plus aria-hidden="true" size="0.75rem" />
          {localizeUi("ui.longTermMemory.tokeneditor.add")}
        </Button>
      </div>
    </section>
  );
}

function MemoryAvailabilityWorkbench({
  note,
  isNew,
  targets,
  localizeUi,
  modeLabel,
  onSave,
  onCancel,
}: {
  note: LtmNote;
  isNew: boolean;
  targets: PickerTarget[];
  localizeUi: LtmTranslationFunction;
  modeLabel: (mode: string) => string;
  onSave: (scope: LtmScope, modes: LtmMode[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [scope, setScope] = useState<LtmScope>(() => structuredClone(note.scope));
  const [selectedModes, setSelectedModes] = useState<LtmMode[]>(() => [...note.modes]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const entries = availabilityEntries(scope, targets);
  const selectedIds = new Set(entries.map((entry) => `${entry.kind}:${entry.id}`));
  const remove = (kind: PickerTarget["kind"], id: string) => {
    if (entries.length <= 1) {
      setError(localizeUi("ui.longTermMemory.memoryvault.lastPlaceRequired"));
      return;
    }
    if (kind === "chat") {
      const chatIds = [...new Set([
        ...(scope.chatIds ?? []),
        ...(scope.chatId ? [scope.chatId] : []),
      ])].filter((value) => value !== id);
      setScope({
        ...scope,
        chatIds: chatIds.length ? chatIds : undefined,
        chatId: chatIds[0],
      });
    } else if (kind === "group") setScope({ ...scope, groupId: undefined });
    else if (kind === "character") {
      const characterIds = (scope.characterIds ?? []).filter((value) => value !== id);
      setScope({ ...scope, characterIds: characterIds.length ? characterIds : undefined });
    } else setScope({ ...scope, personaId: undefined });
    setError("");
  };
  const select = (target: PickerTarget) => {
    if (target.kind === "chat")
      setScope({
        ...scope,
        chatIds: [...new Set([...(scope.chatIds ?? []), scope.chatId, target.id].filter(Boolean))],
        chatId: scope.chatId ?? target.id,
      });
    else if (target.kind === "group") setScope({ ...scope, groupId: target.id });
    else if (target.kind === "character")
      setScope({ ...scope, characterIds: [...new Set([...(scope.characterIds ?? []), target.id])] });
    else setScope({ ...scope, personaId: target.id });
    setError("");
  };
  const toggleMode = (mode: LtmMode) => {
    if (selectedModes.includes(mode)) {
      if (selectedModes.length === 1) {
        setError(localizeUi("ui.longTermMemory.memoryvault.lastModeRequired"));
        return;
      }
      setSelectedModes(selectedModes.filter((value) => value !== mode));
    } else setSelectedModes([...selectedModes, mode]);
    setError("");
  };
  const save = async () => {
    if (!entries.length) {
      setError(localizeUi("ui.longTermMemory.memoryvault.availabilityPlaceRequired"));
      return;
    }
    if (!selectedModes.length) {
      setError(localizeUi("ui.longTermMemory.memoryvault.availabilityModeRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(scope, selectedModes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : localizeUi("ui.longTermMemory.memoryvault.couldNotSaveAvailability"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mari-editor-panel min-w-0 space-y-4 p-4" data-ltm-availability-workbench>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-base font-semibold">{localizeUi("ui.longTermMemory.memoryvault.memoryAvailability")}</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{note.title}</p>
        </div>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={onCancel}>{localizeUi("ui.longTermMemory.memoryvault.cancel")}</Button>
          <Button primary disabled={busy} onClick={() => void save()}>
            <Check aria-hidden="true" size="0.875rem" />
            {busy ? localizeUi("ui.longTermMemory.memoryvault.saving") : localizeUi("ui.longTermMemory.memoryvault.saveAvailability")}
          </Button>
        </div>
      </header>
      {error ? <div role="alert"><StatusSurface tone="danger">{error}</StatusSurface></div> : null}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{localizeUi("ui.longTermMemory.memoryvault.availableIn")}</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            {isNew
              ? localizeUi("ui.longTermMemory.memoryvault.newMemoryAvailabilityHelp")
              : localizeUi("ui.longTermMemory.memoryvault.availabilityHelp")}
          </p>
        </div>
        {!entries.length ? (
          <StatusSurface>
            {isNew
              ? localizeUi("ui.longTermMemory.memoryvault.availabilityPlaceRequired")
              : localizeUi("ui.longTermMemory.memoryvault.availableEverywhere")}
          </StatusSurface>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {entries.map((entry) => (
              <Pill key={`${entry.kind}:${entry.id}`} label={entry.label} onRemove={() => remove(entry.kind, entry.id)}>
                {entry.label}
              </Pill>
            ))}
          </div>
        )}
        <TargetPicker
          targets={targets}
          selectedIds={selectedIds}
          allowedKinds={new Set(["chat", "group", "character", "persona"])}
          placeholder={localizeUi("ui.longTermMemory.memoryvault.chooseScope")}
          emptyLabel={localizeUi("ui.longTermMemory.memoryvault.noScopeTargets")}
          clearLabel={localizeUi("ui.longTermMemory.memoryvault.clearTargetSearch")}
          groupLabels={{
            chat: localizeUi("ui.longTermMemory.memoryvault.chats"),
            group: localizeUi("ui.longTermMemory.memoryvault.groups"),
            character: localizeUi("ui.longTermMemory.memoryvault.characters"),
            persona: localizeUi("ui.longTermMemory.memoryvault.personas"),
          }}
          onSelect={select}
        />
      </section>
      <fieldset className="space-y-2 border-t border-[var(--border)] pt-4">
        <legend className="text-sm font-semibold">{localizeUi("ui.longTermMemory.memoryvault.chatModes")}</legend>
        <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("ui.longTermMemory.memoryvault.modesHelp")}</p>
        <div className="flex flex-wrap gap-3">
          {modes.map((mode) => (
            <label key={mode} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={selectedModes.includes(mode)} onChange={() => toggleMode(mode)} />
              {modeLabel(mode)}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function BulkAvailabilityWorkbench({
  notes,
  action,
  target,
  modes: selectedModes,
  localizeUi,
  modeLabel,
  onApply,
  onCancel,
}: {
  notes: LtmNote[];
  action: "add" | "remove";
  target: string;
  modes: LtmMode[];
  localizeUi: LtmTranslationFunction;
  modeLabel: (mode: string) => string;
  onApply: () => void;
  onCancel: () => void;
}) {
  const [kind, id] = target.split(":", 2);
  const outcomes = notes.map((note) => {
    const places = availabilityEntries(note.scope, []);
    const hasPlace = places.some((entry) => entry.kind === kind && entry.id === id);
    const matchingModes = selectedModes.filter((mode) => note.modes.includes(mode));
    const changes = action === "add"
      ? Boolean((id && !hasPlace) || selectedModes.some((mode) => !note.modes.includes(mode)))
      : Boolean((id && hasPlace) || matchingModes.length);
    const removesLastPlace = action === "remove" && id && hasPlace && places.length === 1;
    const removesLastMode = action === "remove" && matchingModes.length === note.modes.length;
    return {
      note,
      state: removesLastPlace || removesLastMode ? "invalid" : changes ? "ready" : "unchanged",
    };
  });
  const ready = outcomes.some((outcome) => outcome.state === "ready");
  return (
    <section className="mari-editor-panel min-w-0 space-y-4 p-4" data-ltm-bulk-availability-workbench>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-base font-semibold">{localizeUi("ui.longTermMemory.memoryvault.bulkMemoryAvailability")}</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {action === "add" ? localizeUi("ui.longTermMemory.memoryvault.addAvailability") : localizeUi("ui.longTermMemory.memoryvault.removeAvailability")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onCancel}>{localizeUi("ui.longTermMemory.memoryvault.cancel")}</Button>
          <Button primary disabled={!ready} onClick={onApply}>{localizeUi("ui.longTermMemory.memoryvault.apply")}</Button>
        </div>
      </header>
      <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {outcomes.map(({ note, state }) => (
          <div key={note.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate">{note.title}</span>
            <span className={state === "invalid" ? "text-xs text-[var(--destructive)]" : "text-xs text-[var(--muted-foreground)]"}>
              {state === "ready"
                ? localizeUi("ui.longTermMemory.memoryvault.ready")
                : state === "unchanged"
                  ? localizeUi("ui.longTermMemory.memoryvault.unchanged")
                  : localizeUi("ui.longTermMemory.memoryvault.wouldRemoveFinalAvailability")}
            </span>
          </div>
        ))}
      </div>
      {selectedModes.length ? (
        <p className="text-xs text-[var(--muted-foreground)]">{selectedModes.map(modeLabel).join(", ")}</p>
      ) : null}
    </section>
  );
}

export default function MemoryVault({
  props,
  onDirtyChange,
  onSaveRequest,
  onOpenReview,
  openedNoteId,
  createMemoryRequest,
  onCreateMemoryRequestHandled,
  recoveryHandoff,
  onOpenSources,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const untitledMemoryLabel = localizeUi(
    "ui.longTermMemory.memoryvault.untitledMemory",
  );
  const memoryLabel = (note: Pick<LtmNote, "title"> | null | undefined) =>
    formatMemoryLabel(note, untitledMemoryLabel);
  const noteTypeLabel = (type: string) =>
    formatNoteTypeLabel(type, localizeUi);
  const statusLabel = (status: string) =>
    localizedLabel(status, localizeUi, labelKeys.status);
  const modeLabel = (mode: string) =>
    localizedLabel(mode, localizeUi, labelKeys.mode);
  const relationLabel = (relation: string) =>
    localizedLabel(relation, localizeUi, labelKeys.relation);
  const scopeTargetLabel = (
    kind: "chat" | "character" | "group" | "persona",
    id: string,
    targets: ReadonlyArray<{ id: string; label: string }>,
    fallbackLabels: Partial<
      Record<"chat" | "character" | "group" | "persona", string>
    > = {},
  ) =>
    formatScopeTargetLabel(kind, id, targets, {
      chat: localizeUi("ui.longTermMemory.memoryvault.chat"),
      character: localizeUi("ui.longTermMemory.memoryvault.character"),
      group: localizeUi("ui.longTermMemory.memoryvault.branchGroup"),
      persona: localizeUi("ui.longTermMemory.memoryvault.persona"),
      ...fallbackLabels,
    });
  const client = useQueryClient();
  const statusInputId = useId();
  const vaultRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const contextKey = props.chatId ?? "__global__";
  const initialNavigatorState = navigatorStates.get(contextKey);
  const [search, setSearch] = useState(initialNavigatorState?.search ?? "");
  const [target, setTarget] = useState<Target | null>(
    () => sessionTargets.get(contextKey) ?? null,
  );
  const targetContextKey = useRef(contextKey);
  const [statusFilter, setStatusFilter] = useState<LtmStatus | "all">(initialNavigatorState?.statusFilter ?? "all");
  const [typeFilter, setTypeFilter] = useState<LtmNoteType | "all">(initialNavigatorState?.typeFilter ?? "all");
  const [sourceFilter, setSourceFilter] = useState(initialNavigatorState?.sourceFilter ?? false);
  const [availableEverywhereFilter, setAvailableEverywhereFilter] = useState(initialNavigatorState?.availableEverywhereFilter ?? false);
  const [sort, setSort] = useState<"updated" | "title" | "created">(initialNavigatorState?.sort ?? "updated");
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [mobilePane, setMobilePane] = useState<LtmWorkspacePane>("navigator");
  const [inspectorMount, setInspectorMount] = useState<HTMLDivElement | null>(
    null,
  );
  const navigatorScrollRef = useRef<HTMLElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draft, setDraft] = useState<LtmNote | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState<"single" | "bulk" | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  function setMobilePaneAndFocus(pane: LtmWorkspacePane) {
    setMobilePane(pane);
    requestAnimationFrame(() => {
      const workspace = vaultRef.current?.querySelector<HTMLElement>(
        "[data-ltm-workspace]",
      );
      const target = workspace?.querySelector<HTMLElement>(
        `[data-ltm-workspace-pane-tab="${pane}"], [data-ltm-workspace-pane="${pane}"] button, [data-ltm-workspace-pane="${pane}"] [tabindex]:not([tabindex="-1"]), [data-ltm-workspace-pane="${pane}"][tabindex]`,
      );
      target?.focus({ preventScroll: true });
    });
  }
  const [saved, setSaved] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recoverySuggestionId, setRecoverySuggestionId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<LtmStatus>("active");
  const [bulkModes, setBulkModes] = useState<LtmMode[]>(["roleplay"]);
  const [bulkAvailabilityModes, setBulkAvailabilityModes] = useState<LtmMode[]>([]);
  const [bulkAvailabilityTarget, setBulkAvailabilityTarget] = useState("");
  const [bulkAvailabilityAction, setBulkAvailabilityAction] = useState<"add" | "remove">("add");
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const [unsavedNavigation, setUnsavedNavigation] = useState<string | null>(null);
  const unsavedDialogRef = useRef<HTMLDialogElement>(null);
  const unsavedTriggerRef = useRef<HTMLElement | null>(null);
  const unsavedResolveRef = useRef<
    ((decision: "save" | "discard" | "stay") => void) | null
  >(null);
  const [openActionNoteId, setOpenActionNoteId] = useState<string | null>(null);
  const [retractExtracted, setRetractExtracted] = useState(false);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkRelation, setLinkRelation] =
    useState<LtmLink["relation"]>("involves");
  const [sectionKey, setSectionKey] = useState("");
  const [renamingSectionKey, setRenamingSectionKey] = useState<string | null>(null);
  const [renamedSectionKey, setRenamedSectionKey] = useState("");
  const [validation, setValidation] = useState<string[]>([]);
  const validationRef = useRef<HTMLDivElement>(null);
  const navigatorContextRef = useRef<string | null>(null);
  const editorSession = useRef(0);
  const noteLoadSession = useRef(0);

  useEffect(() => {
    if (navigatorContextRef.current !== contextKey) return;
    navigatorStates.set(contextKey, {
      search,
      statusFilter,
      typeFilter,
      sourceFilter,
      availableEverywhereFilter,
      sort,
      scrollTop: navigatorScrollRef.current?.scrollTop ?? initialNavigatorState?.scrollTop ?? 0,
    });
  }, [availableEverywhereFilter, contextKey, initialNavigatorState?.scrollTop, search, sort, sourceFilter, statusFilter, typeFilter]);
  useEffect(() => {
    navigatorContextRef.current = contextKey;
    const state = navigatorStates.get(contextKey) ?? {
      search: "",
      statusFilter: "all" as const,
      typeFilter: "all" as const,
      sourceFilter: false,
      availableEverywhereFilter: false,
      sort: "updated" as const,
      scrollTop: 0,
    };
    navigatorStates.set(contextKey, state);
    setSearch(state.search);
    setStatusFilter(state.statusFilter);
    setTypeFilter(state.typeFilter);
    setSourceFilter(state.sourceFilter);
    setAvailableEverywhereFilter(state.availableEverywhereFilter);
    setSort(state.sort);
    requestAnimationFrame(() => {
      if (navigatorScrollRef.current) navigatorScrollRef.current.scrollTop = state.scrollTop;
    });
  }, [contextKey]);
  useEffect(() => {
    if (!validation.length) return;
    requestAnimationFrame(() => validationRef.current?.focus({ preventScroll: true }));
  }, [validation.length]);
  useEffect(() => {
    onSaveRequest?.(save);
    return () => onSaveRequest?.(null);
  });

  const scopeTargets = useQuery({
    queryKey: queryKeys.scopeTargets(props.chatId),
    queryFn: () =>
      request<ScopeTargets>(
        `/scope-targets${props.chatId ? `?chatId=${encodeURIComponent(props.chatId)}` : ""}`,
      ),
  });
  useEffect(() => {
    if (!target && scopeTargets.isSuccess) {
      const currentChat = scopeTargets.data?.chats.find(
        (chat) => chat.id === props.chatId,
      );
      setTarget({
        id: currentChat ? `chat:${currentChat.id}` : "all",
        label: currentChat
          ? props.chatName ??
            localizeUi("ui.longTermMemory.memoryvault.currentChat")
          : localizeUi("ui.longTermMemory.memoryvault.allMemories"),
        ...(currentChat && scopeTargets.data?.currentScope
          ? { scope: scopeTargets.data.currentScope }
          : {}),
      });
    }
  }, [localizeUi, props.chatId, props.chatName, scopeTargets.data, scopeTargets.isSuccess, target]);
  useEffect(() => {
    if (
      target?.id === `chat:${props.chatId}` &&
      scopeTargets.isSuccess &&
      !scopeTargets.data?.chats.some((chat) => chat.id === props.chatId)
    )
      setTarget({
        id: "all",
        label: localizeUi("ui.longTermMemory.memoryvault.allMemories"),
      });
  }, [localizeUi, props.chatId, scopeTargets.data, scopeTargets.isSuccess, target?.id]);
  useEffect(() => {
    if (target && targetContextKey.current === contextKey)
      sessionTargets.set(contextKey, target);
  }, [contextKey, target]);
  useEffect(() => {
    setTarget((current) =>
      current?.id === `chat:${props.chatId}`
        ? {
            ...current,
            label:
              props.chatName ??
              localizeUi("ui.longTermMemory.memoryvault.currentChat"),
          }
        : current,
    );
  }, [localizeUi, props.chatId, props.chatName]);
  useEffect(() => {
    editorSession.current += 1;
    noteLoadSession.current += 1;
    targetContextKey.current = contextKey;
    setTarget(
      sessionTargets.get(contextKey) ??
        null,
    );
    setDraft(null);
    setAvailabilityOpen(null);
    setSaved("");
    setIsNew(false);
    setBusy("");
    setError("");
    setNotice("");
    setDeleteIds(null);
    setOpenActionNoteId(null);
    setRetractExtracted(false);
    setDetailsOpen(false);
    setLinkTarget("");
    setLinkRelation("involves");
    setSectionKey("");
    setChecked(new Set());
    setMobilePaneAndFocus("navigator");
    // Context switches are the only reset boundary. Dedicated effects above
    // update chat labels without discarding an open draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);
  useEffect(() => {
    if (
      target?.id === `chat:${props.chatId}` &&
      scopeTargets.data?.chats.some((chat) => chat.id === props.chatId) &&
      scopeTargets.data?.currentScope
    ) {
      setTarget((current) =>
        current
          ? { ...current, scope: scopeTargets.data!.currentScope! }
          : current,
      );
    }
  }, [props.chatId, scopeTargets.data, target?.id]);
  const notes = useQuery({
    queryKey: [...queryKeys.notes, contextKey, target?.id, target?.scope],
    enabled: Boolean(target) && targetContextKey.current === contextKey,
    queryFn: () =>
      requestAllNotes<LtmNote>(
        `/notes?${new URLSearchParams({
          ...(target?.scope?.chatIds?.length
            ? { scopeChatIds: target.scope.chatIds.join(",") }
            : {}),
          ...(target?.scope?.groupId
            ? { scopeGroupId: target.scope.groupId }
            : {}),
          ...(target?.scope?.characterIds?.length
            ? { scopeCharacterIds: target.scope.characterIds.join(",") }
            : {}),
          ...(target?.scope?.personaId
            ? { scopePersonaId: target.scope.personaId }
            : {}),
          ...(target?.scope ? { includeGlobal: "false" } : {}),
        })}`,
      ),
  });
  const allNotes = [...(notes.data ?? [])];
  const visible = allNotes.filter(
    (note) =>
      (statusFilter === "all" || note.status === statusFilter) &&
      (typeFilter === "all" || note.type === typeFilter) &&
      (sourceFilter ? note.type === "source" : note.type !== "source") &&
      (!availableEverywhereFilter || !hasExplicitScope(note.scope)) &&
      (!search.trim() ||
        searchable(note).includes(search.trim().toLocaleLowerCase())),
  ).sort((left, right) =>
    sort === "title"
      ? memoryLabel(left).localeCompare(memoryLabel(right))
      : sort === "created"
        ? right.createdAt.localeCompare(left.createdAt)
        : right.updatedAt.localeCompare(left.updatedAt),
  );
  const hiddenChecked = [...checked].filter(
    (id) => !visible.some((note) => note.id === id),
  ).length;
  const toggleVisibleSelection = (selected: boolean) =>
    setChecked((current) => {
      const visibleIds = visible
        .filter((note) => note.type !== "source")
        .map((note) => note.id);
      return selected
        ? new Set([...current, ...visibleIds])
        : new Set([...current].filter((id) => !visibleIds.includes(id)));
    });
  const dirty = Boolean(draft) && fingerprint(draft) !== saved;
  const sourceDerivedQuery = useQuery({
    queryKey: [...queryKeys.notes, "source-derived", draft?.id],
    enabled: draft?.type === "source" && !isNew,
    queryFn: () =>
      request<LtmSourceDerivedMemoriesResponse>(
        `/notes/${encodeURIComponent(draft!.id)}/derived`,
      ),
  });
  const sourceDerived = sourceDerivedQuery.data?.memories ?? [];
  const incomingLinks = draft
    ? allNotes.filter((note) => note.links.some((link) => link.target === draft.id))
    : [];
  const targets: Target[] = [
    {
      id: "all",
      label: localizeUi("ui.longTermMemory.memoryvault.allMemories"),
    },
    ...(props.chatId
      ? [
          {
            id: `chat:${props.chatId}`,
            label:
              props.chatName ??
              localizeUi("ui.longTermMemory.memoryvault.currentChat"),
            scope: { chatId: props.chatId, chatIds: [props.chatId] },
          },
        ]
      : []),
    ...(scopeTargets.data?.chats ?? []).map((chat) => ({
      id: `chat:${chat.id}`,
      label: chat.label,
      scope: { chatId: chat.id, chatIds: [chat.id] },
    })),
    ...(scopeTargets.data?.groups ?? []).map((group) => ({
      id: `group:${group.id}`,
      label: localizeUi("ui.longTermMemory.memoryvault.groupBranches", {
        group: group.label,
      }),
      scope: { groupId: group.id },
    })),
    ...(scopeTargets.data?.characters ?? []).map((character) => ({
      id: `character:${character.id}`,
      label:
        character.label === character.id
          ? localizeUi("ui.longTermMemory.memoryvault.character")
          : localizeUi("ui.longTermMemory.memoryvault.characterWithName", {
              character: character.label,
            }),
      scope: { characterIds: [character.id] },
    })),
    ...(scopeTargets.data?.personas ?? []).map((persona) => ({
      id: `persona:${persona.id}`,
      label: persona.label,
      scope: { personaId: persona.id },
    })),
  ].filter(
    (candidate, index, items) =>
      items.findIndex((item) => item.id === candidate.id) === index,
  );
  const scopeIndexes = useMemo(
    () => buildScopeIndexes(scopeTargets.data?.chats ?? []),
    [scopeTargets.data?.chats],
  );
  const selectedChat =
    target?.id.startsWith("chat:") && target.scope?.chatIds?.length === 1
      ? scopeIndexes.chatsById.get(target.scope.chatIds[0])
      : undefined;
  const selectedGroupId = target?.scope?.groupId ?? selectedChat?.groupId ?? "";
  const selectedCharacterId =
    target?.scope?.characterIds?.length === 1
      ? target.scope.characterIds[0]
      : (selectedChat?.characterIds[0] ?? "");
  const selectedConversationId = selectedGroupId
    ? `group:${selectedGroupId}`
    : selectedChat
      ? `chat:${selectedChat.id}`
      : "";
  const { conversations, branches, selectedConversation } = useMemo(() => {
    const conversations = deriveScopeConversations(
      scopeTargets.data?.chats ?? [],
      scopeTargets.data?.groups ?? [],
      selectedCharacterId,
      scopeIndexes,
      (group) =>
        localizeUi("ui.longTermMemory.memoryvault.groupBranches", {
          group: group.label,
        }),
    );
    return {
      conversations,
      selectedConversation: conversations.find(
        (item) => item.id === selectedConversationId,
      ),
      branches: deriveScopeBranches(
        conversations.find((item) => item.id === selectedConversationId),
        scopeIndexes,
      ),
    };
  }, [
    localizeUi,
    scopeIndexes,
    scopeTargets.data?.chats,
    scopeTargets.data?.groups,
    selectedCharacterId,
    selectedConversationId,
  ]);
  const pickerTargets = useMemo<PickerTarget[]>(
    () => [
      ...(scopeTargets.data?.chats ?? []).map((chat) => ({
        kind: "chat" as const,
        id: chat.id,
        label: chat.label,
      })),
      ...(scopeTargets.data?.groups ?? []).map((group) => ({
        kind: "group" as const,
        id: group.id,
        label: group.label,
      })),
      ...(scopeTargets.data?.characters ?? []).map((character) => ({
        kind: "character" as const,
        id: character.id,
        label: character.label,
        comment: character.comment,
      })),
      ...(scopeTargets.data?.personas ?? []).map((persona) => ({
        kind: "persona" as const,
        id: persona.id,
        label: persona.label,
        comment: persona.comment,
      })),
    ],
    [
      scopeTargets.data?.characters,
      scopeTargets.data?.chats,
      scopeTargets.data?.groups,
      scopeTargets.data?.personas,
    ],
  );
  const subjectLabel = (subject: LtmSubject) => {
    if (subject.ref)
      return scopeTargetLabel(subject.ref.kind, subject.ref.id, pickerTargets, {
        character: localizeUi("ui.longTermMemory.memoryvault.deletedCharacter"),
        persona: localizeUi("ui.longTermMemory.memoryvault.missingPersona"),
      });
    return localizeUi("ui.longTermMemory.memoryvault.unresolvedSubject");
  };
  const provenanceSourceLabel = () => {
    if (!draft?.provenance) return "";
    if (draft.provenance.kind === "character")
      return localizeUi("ui.longTermMemory.memoryvault.characterRecord", {
        name: scopeTargetLabel("character", draft.provenance.sourceId, targets),
      });
    if (draft.provenance.kind === "chat_summary")
      return localizeUi("ui.longTermMemory.memoryvault.chatSummary", {
        title: scopeTargetLabel("chat", draft.provenance.sourceId, targets),
      });
    return localizeUi("ui.longTermMemory.memoryvault.lorebook");
  };

  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!openedNoteId) return;
    const loadSession = ++noteLoadSession.current;
    const requestContext = contextKey;
    void request<LtmNote>(`/notes/${encodeURIComponent(openedNoteId)}`)
      .then((note) => {
        if (
          loadSession !== noteLoadSession.current ||
          requestContext !== targetContextKey.current
        )
          return;
        return openNote(note, requestContext);
      })
      .catch(() => {
        if (
          loadSession === noteLoadSession.current &&
          requestContext === targetContextKey.current
        )
          setError(
            localizeUi(
              "ui.longTermMemory.memoryvault.requestedMemoryUnavailable",
            ),
          );
      });
  }, [openedNoteId, contextKey]);
  useEffect(() => {
    if (!recoveryHandoff) return;
    const next = recoveredNote(recoveryHandoff, localizeUi);
    setDraft(next);
    setSaved("");
    setIsNew(true);
    setRecoverySuggestionId(recoveryHandoff.rejectedSuggestionId ?? null);
    setError("");
    setNotice(
      localizeUi("ui.longTermMemory.memoryvault.reviewRecoveredSuggestion"),
    );
    setDetailsOpen(false);
    setMobilePaneAndFocus("workbench");
  }, [recoveryHandoff?.key]);
  useEffect(() => {
    if (deleteIds) {
      const dialog = deleteDialogRef.current;
      if (!dialog) return;
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      dialog.querySelector<HTMLElement>("[data-ltm-delete-cancel]")?.focus();
      return;
    }
    if (busy) return;
    const trigger = deleteTriggerRef.current;
    if (!trigger) return;
    if (trigger.isConnected) trigger.focus();
    else detailRef.current?.focus();
    deleteTriggerRef.current = null;
  }, [busy, deleteIds]);
  useEffect(() => {
    if (!unsavedNavigation) return;
    const dialog = unsavedDialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    dialog.querySelector<HTMLElement>("[data-ltm-unsaved-stay]")?.focus();
  }, [unsavedNavigation]);
  useEffect(() => {
    if (unsavedNavigation) return;
    const trigger = unsavedTriggerRef.current;
    if (trigger?.isConnected) trigger.focus();
    unsavedTriggerRef.current = null;
  }, [unsavedNavigation]);
  function finishUnsavedDecision(decision: "save" | "discard" | "stay") {
    const resolve = unsavedResolveRef.current;
    unsavedResolveRef.current = null;
    setUnsavedNavigation(null);
    resolve?.(decision);
  }
  async function confirm(next: string) {
    if (!dirtyRef.current) return true;
    const decision = await new Promise<"save" | "discard" | "stay">((resolve) => {
      unsavedResolveRef.current = resolve;
      unsavedTriggerRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      setUnsavedNavigation(next);
    });
    if (decision === "save") return save();
    return decision === "discard";
  }
  async function selectTarget(next: Target) {
    if (
      !(await confirm(
        localizeUi("ui.longTermMemory.memoryvault.openingTarget", {
          target: next.label,
        }),
      ))
    )
      return;
    editorSession.current += 1;
    noteLoadSession.current += 1;
    setTarget(next);
    setDraft(null);
    setAvailabilityOpen(null);
    setChecked(new Set());
    setSaved("");
    setIsNew(false);
    setRecoverySuggestionId(null);
    setLinkTarget("");
    setLinkRelation("involves");
    setSectionKey("");
    setMobilePaneAndFocus("navigator");
  }
  async function openNote(
    note: LtmNote,
    expectedContextKey = targetContextKey.current,
  ) {
    if (expectedContextKey !== targetContextKey.current) return;
    if (
      !(await confirm(
        localizeUi("ui.longTermMemory.memoryvault.openingTarget", {
          target: memoryLabel(note),
        }),
      ))
    )
      return;
    if (expectedContextKey !== targetContextKey.current) return;
    const next = structuredClone(note);
    editorSession.current += 1;
    setDraft(next);
    setAvailabilityOpen(null);
    setSaved(fingerprint(next));
    setIsNew(false);
    setRecoverySuggestionId(null);
    setLinkTarget("");
    setLinkRelation("involves");
    setSectionKey("");
    setError("");
    setNotice("");
    setDetailsOpen(false);
    setMobilePaneAndFocus("workbench");
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({
        behavior: detailScrollBehavior(),
        block: "nearest",
      }),
    );
  }
  async function startNew() {
    if (
      !(await confirm(
        localizeUi("ui.longTermMemory.memoryvault.creatingNewMemory"),
      ))
    )
      return;
    const next = newNote(target?.scope ?? {}, localizeUi);
    next.modes = props.chatMode ? [props.chatMode] : [];
    editorSession.current += 1;
    setDraft(next);
    setAvailabilityOpen(null);
    setSaved("");
    setIsNew(true);
    setRecoverySuggestionId(null);
    setLinkTarget("");
    setLinkRelation("involves");
    setSectionKey("");
    setDetailsOpen(false);
    setMobilePaneAndFocus("workbench");
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({
        behavior: detailScrollBehavior(),
        block: "nearest",
      }),
    );
  }
  useEffect(() => {
    if (!createMemoryRequest) return;
    onCreateMemoryRequestHandled?.();
    void startNew();
  }, [createMemoryRequest]);
  async function closeDraft() {
    if (
      !(await confirm(
        localizeUi("ui.longTermMemory.memoryvault.closingThisMemory"),
      ))
    )
      return;
    editorSession.current += 1;
    setDraft(null);
    setAvailabilityOpen(null);
    setSaved("");
    setIsNew(false);
    setRecoverySuggestionId(null);
    setLinkTarget("");
    setLinkRelation("involves");
    setSectionKey("");
    setMobilePaneAndFocus("navigator");
  }
  async function invalidate() {
    await invalidateLtmQueries(client, [
      queryKeys.notes,
      queryKeys.status,
      queryKeys.activity,
    ]);
  }
  function openAvailability() {
    if (!draft) return;
    setAvailabilityOpen("single");
    setMobilePaneAndFocus("workbench");
  }
  async function saveAvailability(scope: LtmScope, modes: LtmMode[]) {
    if (!draft) return;
    if (isNew) {
      setDraft((current) => (current ? { ...current, scope, modes } : current));
      setAvailabilityOpen(null);
      setNotice(localizeUi("ui.longTermMemory.memoryvault.availabilityStaged"));
      return;
    }
    const response = await request<NoteResponse, Pick<LtmNote, "scope" | "modes">>(
      `/notes/${encodeURIComponent(draft.id)}`,
      "PATCH",
      { scope, modes },
    );
    const next = structuredClone(response.note);
    const editorWasDirty = fingerprint(draft) !== saved;
    setDraft((current) => current
      ? editorWasDirty
        ? { ...current, scope: next.scope, modes: next.modes, updatedAt: next.updatedAt, version: next.version }
        : next
      : current,
    );
    setSaved(fingerprint(next));
    setAvailabilityOpen(null);
    setNotice(localizeUi("ui.longTermMemory.memoryvault.availabilitySaved"));
    await invalidate();
  }
  async function save(): Promise<boolean> {
    if (!draft) return false;
    const errors: string[] = [];
    if (!draft.title?.trim()) errors.push(localizeUi("ui.longTermMemory.memoryvault.memoryTitleRequired"));
    if (!Object.keys(draft.sections).length) errors.push(localizeUi("ui.longTermMemory.memoryvault.detailRequired"));
    if (Object.values(draft.sections).some((section) => !section.text.trim()))
      errors.push(localizeUi("ui.longTermMemory.memoryvault.detailTextRequired"));
    if (draft.type === "character" && draft.subjects?.length !== 1)
      errors.push(localizeUi("ui.longTermMemory.memoryvault.characterSubjectRequired"));
    if (draft.type === "relationship" && draft.subjects?.length !== 2)
      errors.push(localizeUi("ui.longTermMemory.memoryvault.relationshipSubjectsRequired"));
    if (errors.length) {
      setValidation(errors);
      setError(errors[0]!);
      return false;
    }
    setValidation([]);
    if (isNew && !hasExplicitScope(draft.scope)) {
      setError(localizeUi("ui.longTermMemory.memoryvault.availabilityPlaceRequired"));
      return false;
    }
    if (isNew && !draft.modes.length) {
      setError(localizeUi("ui.longTermMemory.memoryvault.availabilityModeRequired"));
      return false;
    }
    const savedNote = saved ? (JSON.parse(saved) as LtmNote) : null;
    if (
      !isNew &&
      savedNote &&
      hasExplicitScope(savedNote.scope) &&
      !hasExplicitScope(draft.scope)
    ) {
      setError(
        localizeUi(
          "ui.longTermMemory.memoryvault.clearingEveryScopeWouldMakeGlobal",
        ),
      );
      return false;
    }
    const session = editorSession.current;
    const submittedFingerprint = fingerprint(draft);
    setBusy("save");
    setSaveState("saving");
    setError("");
    let succeeded = false;
    try {
      const response = isNew
        ? await request<
            NoteResponse,
            Omit<LtmNote, "createdAt" | "updatedAt" | "version">
          >(
            "/notes",
            "POST",
            (({ createdAt, updatedAt, version, ...note }) => note)(draft),
          )
        : await request<NoteResponse, Partial<LtmNote>>(
            `/notes/${encodeURIComponent(draft.id)}`,
            "PATCH",
            (({
              id,
              type,
              createdAt,
              updatedAt,
              version,
              provenance,
              extractionFingerprint,
              extracted,
              sections,
              ...note
            }) => (draft.type === "source" ? note : { ...note, sections }))(
              draft,
            ),
          );
      const next = structuredClone(response.note);
      if (session !== editorSession.current) return false;
      const recoveryComplete = fingerprint(draftRef.current) === submittedFingerprint;
      const savedCurrentDraft = fingerprint(draftRef.current) === submittedFingerprint;
      setDraft((current) => {
        if (session !== editorSession.current) return current;
        if (fingerprint(current) === submittedFingerprint) {
          setSaved(fingerprint(next));
          setIsNew(false);
           setNotice(localizeUi("ui.longTermMemory.memoryvault.memorySaved"));
           setSaveState("saved");
          return next;
        }
        setSaved(fingerprint(next));
        setIsNew(false);
         setNotice(
          localizeUi(
            "ui.longTermMemory.memoryvault.memorySavedNewerEditsUnsaved",
          ),
         );
         setSaveState("saved");
        return current
          ? {
              ...current,
              id: next.id,
              type: next.type,
              createdAt: next.createdAt,
              updatedAt: next.updatedAt,
              version: next.version,
              ...(next.provenance ? { provenance: next.provenance } : {}),
              ...(next.extractionFingerprint
                ? { extractionFingerprint: next.extractionFingerprint }
                : {}),
            }
          : current;
      });
      const rejectedId = recoverySuggestionId;
      if (rejectedId && recoveryComplete) {
        try {
          const cleanup = await request<{ deleted: boolean; id: string }>(
            `/rejected-suggestions/${encodeURIComponent(rejectedId)}`,
            "DELETE",
          );
          if (
            typeof cleanup?.deleted !== "boolean" ||
            cleanup.id !== rejectedId
          )
            throw new Error("Rejected suggestion cleanup returned the wrong ID.");
          setRecoverySuggestionId(null);
        } catch {
          setNotice(
            localizeUi(
              "ui.longTermMemory.memoryvault.savedButRejectedSuggestionCouldNotBeRemoved",
            ),
          );
        }
      }
      await invalidateLtmQueries(client, [
        queryKeys.notes,
        queryKeys.status,
        queryKeys.activity,
        ...(rejectedId && recoveryComplete ? [queryKeys.rejectedSuggestions] : []),
      ]).catch(() => {});
      succeeded = savedCurrentDraft;
    } catch (cause) {
      setSaveState("idle");
      if (session === editorSession.current)
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi("ui.longTermMemory.memoryvault.couldNotSaveMemory"),
        );
    } finally {
      if (session === editorSession.current) setBusy("");
    }
    return succeeded;
  }
  async function deleteSelected(ids: string[], retract = false) {
    const session = editorSession.current;
    setBusy("delete");
    try {
      const result = await request<{ deletedIds: string[] }>(
        "/notes/permanent-delete",
        "POST",
        { ids, retractExtracted: retract },
      );
      if (session !== editorSession.current) return;
      setChecked((current) => {
        const next = new Set(current);
        result.deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteIds(null);
      setOpenActionNoteId(null);
      if (draft && result.deletedIds.includes(draft.id)) {
        setDraft(null);
        setSaved("");
        setMobilePaneAndFocus("navigator");
      }
      setNotice(
        localizeUi(
          selectLtmPluralForm(locale, result.deletedIds.length) === "one"
            ? "ui.longTermMemory.memoryvault.memoryDeletedOne"
            : "ui.longTermMemory.memoryvault.memoryDeletedOther",
          { count: result.deletedIds.length },
        ),
      );
      await invalidate();
    } catch (cause) {
      if (session === editorSession.current)
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi(
                "ui.longTermMemory.memoryvault.couldNotUpdateMemories",
              ),
        );
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function deleteSection(key: string) {
    if (!draft || draft.type === "source" || Object.keys(draft.sections).length === 1) return;
    const session = editorSession.current;
    const noteId = draft.id;
    const unsavedWarning = dirty
      ? localizeUi("ui.longTermMemory.memoryvault.unsavedEditsWillAlsoBeLost")
      : "";
    const confirmed = props.confirmAction
      ? await props.confirmAction({
          title: localizeUi("ui.longTermMemory.memoryvault.deleteDetailTitle"),
          message: localizeUi("ui.longTermMemory.memoryvault.deleteDetailDescription", {
            unsavedWarning,
          }),
          confirmLabel: localizeUi("ui.longTermMemory.memoryvault.deleteDetail"),
          tone: "destructive",
        })
      : window.confirm(
          localizeUi("ui.longTermMemory.memoryvault.deleteDetailDescription", {
            unsavedWarning,
          }),
        );
    if (!confirmed) return;
    if (session !== editorSession.current) return;
    setBusy("delete-section");
    setError("");
    try {
      const result = await request<{ note: LtmNote }>(
        `/notes/${encodeURIComponent(noteId)}/sections/${encodeURIComponent(key)}`,
        "DELETE",
      );
      if (session !== editorSession.current) return;
      setDraft(result.note);
      setSaved(fingerprint(result.note));
      setNotice(localizeUi("ui.longTermMemory.memoryvault.detailDeleted"));
      await invalidate();
    } catch (cause) {
      if (session === editorSession.current)
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi("ui.longTermMemory.memoryvault.couldNotUpdateMemories"),
        );
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function renameSection() {
    if (!draft || !renamingSectionKey || draft.type === "source") return;
    const fromSectionKey = renamingSectionKey;
    const toSectionKey = renamedSectionKey.trim();
    if (!toSectionKey || toSectionKey === fromSectionKey) return;
    if (Object.hasOwn(draft.sections, toSectionKey)) {
      setError(localizeUi("ui.longTermMemory.memoryvault.detailNameAlreadyExists"));
      return;
    }
    const session = editorSession.current;
    const noteId = draft.id;
    setBusy("rename-section");
    setError("");
    try {
      const result = await request<{ note: LtmNote }>(
        `/notes/${encodeURIComponent(noteId)}/sections/rename`,
        "POST",
        { fromSectionKey, toSectionKey },
      );
      if (session !== editorSession.current) return;
      setDraft((current) => {
        if (!current || current.id !== noteId || !Object.hasOwn(current.sections, fromSectionKey))
          return result.note;
        const { [fromSectionKey]: section, ...sections } = current.sections;
        return { ...current, sections: { ...sections, [toSectionKey]: section! } };
      });
      setSaved(fingerprint(result.note));
      setRenamingSectionKey(null);
      setRenamedSectionKey("");
      setNotice(localizeUi("ui.longTermMemory.memoryvault.detailRenamed"));
      await invalidate();
    } catch (cause) {
      if (session === editorSession.current)
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi("ui.longTermMemory.memoryvault.couldNotUpdateMemories"),
        );
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function runBatchForIds(
    ids: string[],
    action: "status" | "modes" | "availability" | "remove-availability" | "archive" | "delete",
    options?: { preserveSelection?: boolean },
  ) {
    if (!ids.length) return;
    const session = editorSession.current;
    const includesSource = ids.some(
      (id) => allNotes.find((note) => note.id === id)?.type === "source",
    );
    if (action === "delete" && includesSource) {
      deleteTriggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setRetractExtracted(false);
      setDeleteIds(ids);
      return;
    }
    if (
      action === "delete" &&
      !(props.confirmAction
        ? await props.confirmAction({
            title: localizeUi(
              "ui.longTermMemory.memoryvault.permanentlyDeleteSelectedMemories",
            ),
            message: localizeUi(
              "ui.longTermMemory.memoryvault.thisCannotBeUndone",
            ),
            confirmLabel: localizeUi(
              "ui.longTermMemory.memoryvault.deletePermanently",
            ),
            tone: "destructive",
          })
        : window.confirm(
            localizeUi(
              "ui.longTermMemory.memoryvault.permanentlyDeleteSelectedMemories",
            ),
          ))
    )
      return;
    if (action === "delete") {
      await deleteSelected(ids);
      return;
    }
    setBusy(action);
    try {
      const [availabilityKind, availabilityId] = bulkAvailabilityTarget.split(":", 2);
      const addScope: Partial<LtmScope> | undefined =
        !availabilityId
          ? undefined
          : availabilityKind === "chat"
          ? { chatId: availabilityId, chatIds: [availabilityId!] }
          : availabilityKind === "group"
            ? { groupId: availabilityId }
            : availabilityKind === "character"
              ? { characterIds: [availabilityId!] }
              : availabilityKind === "persona"
                ? { personaId: availabilityId }
                : undefined;
      const result = await request<LtmBulkNoteResult>("/notes/batch", "POST", {
        noteIds: ids,
        ...(action === "archive" ? { archive: "notes_only" } : {}),
        ...(action === "status" ? { status: bulkStatus } : {}),
        ...(action === "modes" ? { modes: bulkModes } : {}),
        ...((action === "availability" || action === "remove-availability")
          ? {
              ...(addScope
                ? action === "availability"
                  ? { addScope }
                  : { removeScope: addScope }
                : {}),
              ...(bulkAvailabilityModes.length
                ? action === "availability"
                  ? { enableModes: bulkAvailabilityModes }
                  : { disableModes: bulkAvailabilityModes }
                : {}),
            }
          : {}),
      });
      if (session !== editorSession.current) return;
      const unresolved = new Set([
        ...result.skippedNoteIds,
        ...result.failedNoteIds,
      ]);
      if (options?.preserveSelection) {
        setChecked((current) => {
          const next = new Set(current);
          ids.forEach((id) => next.delete(id));
          unresolved.forEach((id) => next.add(id));
          return next;
        });
      } else {
        setChecked(unresolved);
      }
      const updatedForm = selectLtmPluralForm(
        locale,
        result.updatedNoteIds.length,
      );
      const message = localizeUi(
        unresolved.size
          ? updatedForm === "one"
            ? "ui.longTermMemory.memoryvault.batchUpdatedWithIssuesOne"
            : "ui.longTermMemory.memoryvault.batchUpdatedWithIssuesOther"
          : updatedForm === "one"
            ? "ui.longTermMemory.memoryvault.batchUpdatedOne"
            : "ui.longTermMemory.memoryvault.batchUpdatedOther",
        {
          updated: result.updatedNoteIds.length,
          skipped: result.skippedNoteIds.length,
          failed: result.failedNoteIds.length,
        },
      );
      setOpenActionNoteId(null);
      if (unresolved.size) {
        setNotice("");
        setError(message);
      } else {
        setNotice(message);
        setError("");
      }
      await invalidate();
    } catch (cause) {
      if (session === editorSession.current)
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi(
                "ui.longTermMemory.memoryvault.couldNotUpdateMemories",
              ),
        );
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function batch(action: "status" | "modes" | "availability" | "remove-availability" | "archive" | "delete") {
    await runBatchForIds([...checked], action);
  }
  function previewBulkAvailability(action: "add" | "remove") {
    if (!bulkAvailabilityTarget && !bulkAvailabilityModes.length) return;
    setBulkAvailabilityAction(action);
    setAvailabilityOpen("bulk");
    setMobilePaneAndFocus("workbench");
  }
  const runNoteAction = async (
    event: { preventDefault: () => void; stopPropagation: () => void },
    note: LtmNote,
    action: "archive" | "delete",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenActionNoteId(null);
    await runBatchForIds([note.id], action, { preserveSelection: true });
  };

  const toggleNoteActions = (
    event: { preventDefault: () => void; stopPropagation: () => void },
    noteId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenActionNoteId((current) => (current === noteId ? null : noteId));
  };
  const update = <K extends keyof LtmNote>(key: K, value: LtmNote[K]) => {
    setSaveState("idle");
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };
  const updateConflict = (index: number, text: string) => {
    if (!draft?.conflicts) return;
    update("conflicts", draft.conflicts.map((conflict, item) =>
      item === index ? { ...conflict, existing: text, resolution: "user_decided" } : conflict,
    ));
  };
  const beginRename = async (key: string) => {
    if (!draft || isNew) return;
    if (dirty) {
      const saveFirst = props.confirmAction
        ? await props.confirmAction({
            title: localizeUi("ui.longTermMemory.memoryvault.saveBeforeRenameTitle"),
            message: localizeUi("ui.longTermMemory.memoryvault.saveBeforeRenameDescription"),
            confirmLabel: localizeUi("ui.longTermMemory.memoryvault.save"),
          })
        : window.confirm(localizeUi("ui.longTermMemory.memoryvault.saveBeforeRenameDescription"));
      if (saveFirst) await save();
      return;
    }
    setRenamingSectionKey(key);
    setRenamedSectionKey(key);
  };
  const subjectSelectionIds = new Set(
    (draft?.subjects ?? []).map((subject) =>
      subject.ref ? `${subject.ref.kind}:${subject.ref.id}` : subject.key,
    ),
  );
  const subjectLimit = draft?.type === "character" ? 1 : 2;
  const subjectLimitReached =
    Boolean(draft) && (draft?.subjects?.length ?? 0) >= subjectLimit;
  const selectSubjectTarget = (target: PickerTarget) => {
    if (!draft || (draft.type !== "character" && draft.type !== "relationship")) return;
    if (target.kind !== "character" && target.kind !== "persona") return;
    if ((draft.subjects?.length ?? 0) >= subjectLimit) return;
    const ref = { kind: target.kind, id: target.id };
    const key = `${ref.kind}:${ref.id}`;
    if (subjectSelectionIds.has(key)) return;
    const subjects = [...(draft.subjects ?? []), { key, ref }].sort((left, right) =>
      left.key.localeCompare(right.key),
    );
    update("subjects", subjects);
  };
  const addSection = () => {
    const key = sectionKey
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!draft || !key || draft.sections[key]) return;
    update("sections", {
      ...draft.sections,
      [key]: {
        text: "",
        updatedAt: new Date().toISOString(),
      },
    });
    setSectionKey("");
  };
  const addLink = () => {
    if (
      !draft ||
      !linkTarget.trim() ||
      linkTarget.trim() === draft.id ||
      draft.links.some(
        (link) =>
          link.target === linkTarget.trim() && link.relation === linkRelation,
      )
    )
      return;
    update("links", [
      ...draft.links,
      { target: linkTarget.trim(), relation: linkRelation },
    ]);
    setLinkTarget("");
  };
  const openLinkedNote = async (noteId: string) => {
    try {
      const note =
        allNotes.find((candidate) => candidate.id === noteId) ??
        (await request<LtmNote>(`/notes/${encodeURIComponent(noteId)}`));
      await openNote(note);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi(
              "ui.longTermMemory.memoryvault.linkedMemoryCouldNotLoad",
            ),
      );
    }
  };
  return (
    <section
      ref={vaultRef}
      data-ltm-surface="vault"
      className="space-y-4"
      aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryVault")}
    >
      <LtmWorkspace
        activeMobilePane={mobilePane}
        onMobilePaneChange={setMobilePane}
        switcherLabel={localizeUi(
          "ui.longTermMemory.longtermmemorynavigation.workspacePanes",
        )}
        navigator={{
          label: localizeUi("ui.longTermMemory.longtermmemorynavigation.memories"),
          content: (
            <>
      <section
        data-ltm-browser-controls
        className="mari-editor-panel mari-editor-panel--soft grid grid-cols-2 gap-2 p-3"
      >
        <div className="col-span-2 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">
            {localizeUi("ui.longTermMemory.memoryvault.memoryVault")}
          </h2>
          <span className="text-xs text-[var(--muted-foreground)]">
            {visible.length} {localizeUi("ui.longTermMemory.memoryvault.shown")}
          </span>
        </div>
        <label className="relative col-span-2 block">
          <Search
            aria-hidden="true"
            size="0.875rem"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            className={`${inputClass} pl-9 pr-10`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizeUi(
              "ui.longTermMemory.memoryvault.searchMemories",
            )}
            aria-label={localizeUi(
              "ui.longTermMemory.memoryvault.searchMemories",
            )}
          />
          {search ? (
            <button
              type="button"
              aria-label={localizeUi(
                "ui.longTermMemory.memoryvault.clearMemorySearch",
              )}
              title={localizeUi(
                "ui.longTermMemory.memoryvault.clearMemorySearch",
              )}
              onClick={() => setSearch("")}
              className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
            >
              <X aria-hidden="true" size="0.875rem" />
            </button>
          ) : null}
        </label>
        <select className={inputClass} value={typeFilter} aria-label={localizeUi("ui.longTermMemory.memoryvault.filterByType")} onChange={(event) => setTypeFilter(event.target.value as LtmNoteType | "all")}>
          <option value="all">{localizeUi("ui.longTermMemory.memoryvault.allMemoryTypes")}</option>
          {noteTypes.map((type) => <option key={type} value={type}>{noteTypeLabel(type)}</option>)}
        </select>
        <select
          className={inputClass}
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as LtmStatus | "all")
          }
          aria-label={localizeUi(
            "ui.longTermMemory.memoryvault.filterByStatus",
          )}
        >
          <option value="all">
            {localizeUi("ui.longTermMemory.memoryvault.allStatuses")}
          </option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
        <select className={inputClass} value={sort} aria-label={localizeUi("ui.longTermMemory.memoryvault.sortMemories")} onChange={(event) => setSort(event.target.value as "updated" | "title" | "created")}>
          <option value="updated">{localizeUi("ui.longTermMemory.memoryvault.recentlyUpdated")}</option><option value="title">{localizeUi("ui.longTermMemory.memoryvault.sortTitle")}</option><option value="created">{localizeUi("ui.longTermMemory.memoryvault.sortCreated")}</option>
        </select>
        <div className="col-span-2 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-2">
          <Button onClick={() => { setSelectMode((value) => !value); setChecked(new Set()); }} data-ltm-select-mode>{selectMode ? localizeUi("ui.longTermMemory.memoryvault.done") : localizeUi("ui.longTermMemory.memoryvault.select")}</Button>
          <Button onClick={() => setSourceFilter((value) => !value)} aria-pressed={sourceFilter} data-ltm-source-filter><FileText aria-hidden="true" size="0.875rem" />{localizeUi("ui.longTermMemory.memoryvault.sources")}</Button>
          <button type="button" className="text-xs underline" aria-pressed={availableEverywhereFilter} onClick={() => setAvailableEverywhereFilter((value) => !value)}>{localizeUi("ui.longTermMemory.memoryvault.availableEverywhere")} ({allNotes.filter((note) => note.type !== "source" && !hasExplicitScope(note.scope)).length})</button>
          {selectMode ? <label className="flex min-h-9 items-center gap-2 text-xs"><input type="checkbox" checked={visible.filter((note) => note.type !== "source").length > 0 && visible.filter((note) => note.type !== "source").every((note) => checked.has(note.id))} onChange={(event) => toggleVisibleSelection(event.target.checked)} />{localizeUi("ui.longTermMemory.memoryvault.selectVisible")}</label> : null}
          <span
            data-ltm-selection-count
            id="ltm-selection-count"
            className="text-xs text-[var(--muted-foreground)]"
          >
            {checked.size}{" "}
            {localizeUi("ui.longTermMemory.memoryvault.selected")}
            {hiddenChecked
              ? localizeUi(
                  "ui.longTermMemory.memoryvault.value1HiddenByFilters",
                  { value1: hiddenChecked },
                )
              : ""}
          </span>
        </div>
      </section>
      {error || notice ? (
        <div data-ltm-vault-feedback className="contents">
          {error ? <StatusSurface tone="danger">{error}</StatusSurface> : null}
          {notice ? (
            <StatusSurface tone="success">{notice}</StatusSurface>
          ) : null}
        </div>
      ) : null}
      {checked.size ? (
        <section
          data-ltm-bulk-actions
          aria-labelledby="ltm-selection-count"
          className="mari-editor-panel flex flex-wrap items-center gap-2 p-3"
        >
          <>
            <select
              className={inputClass}
              value={bulkStatus}
              onChange={(event) =>
                setBulkStatus(event.target.value as LtmStatus)
              }
              aria-label={localizeUi("ui.longTermMemory.memoryvault.setStatus")}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void batch("status")}
            >
              {localizeUi("ui.longTermMemory.memoryvault.setStatus")}
            </Button>
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="sr-only">
                {localizeUi("ui.longTermMemory.memoryvault.setRetrievalModes")}
              </legend>
              {modes.map((mode) => (
                <label
                  key={mode}
                  className="flex min-h-8 items-center gap-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={bulkModes.includes(mode)}
                    onChange={() =>
                      setBulkModes((current) =>
                        current.includes(mode)
                          ? current.filter((item) => item !== mode)
                          : [...current, mode],
                      )
                    }
                  />
                  {modeLabel(mode)}
                </label>
              ))}
            </fieldset>
            <Button
              disabled={Boolean(busy) || !bulkModes.length}
              onClick={() => void batch("modes")}
            >
              {localizeUi("ui.longTermMemory.memoryvault.setModes")}
            </Button>
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="sr-only">
                {localizeUi("ui.longTermMemory.memoryvault.addAvailability")}
              </legend>
              <select
                className={inputClass}
                value={bulkAvailabilityTarget}
                aria-label={localizeUi("ui.longTermMemory.memoryvault.addPlace")}
                onChange={(event) => setBulkAvailabilityTarget(event.target.value)}
              >
                <option value="">
                  {localizeUi("ui.longTermMemory.memoryvault.addPlace")}
                </option>
                {pickerTargets.map((target) => (
                  <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>
                    {target.label}
                  </option>
                ))}
              </select>
              {modes.map((mode) => (
                <label key={`availability-${mode}`} className="flex min-h-8 items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={bulkAvailabilityModes.includes(mode)}
                    onChange={() =>
                      setBulkAvailabilityModes((current) =>
                        current.includes(mode)
                          ? current.filter((item) => item !== mode)
                          : [...current, mode],
                      )
                    }
                  />
                  {modeLabel(mode)}
                </label>
              ))}
              <Button
                disabled={Boolean(busy) || (!bulkAvailabilityTarget && !bulkAvailabilityModes.length)}
                onClick={() => previewBulkAvailability("add")}
              >
                {localizeUi("ui.longTermMemory.memoryvault.addAvailability")}
              </Button>
              <Button
                disabled={Boolean(busy) || (!bulkAvailabilityTarget && !bulkAvailabilityModes.length)}
                onClick={() => previewBulkAvailability("remove")}
              >
                {localizeUi("ui.longTermMemory.memoryvault.removeAvailability")}
              </Button>
            </fieldset>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void batch("archive")}
            >
              <Archive aria-hidden="true" size="0.875rem" />
              {localizeUi("ui.longTermMemory.memoryvault.archive")}
            </Button>
            <Button
              destructive
              disabled={Boolean(busy)}
              onClick={() => void batch("delete")}
            >
              <Trash2 aria-hidden="true" size="0.875rem" />
              {localizeUi("ui.longTermMemory.extractionprompttemplates.delete")}
            </Button>
          </>
        </section>
      ) : null}
      {unsavedNavigation ? (
        <dialog
          ref={unsavedDialogRef}
          aria-modal="true"
          aria-labelledby="ltm-unsaved-title"
          aria-describedby="ltm-unsaved-description"
          onCancel={(event) => {
            event.preventDefault();
            finishUnsavedDecision("stay");
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const focusable = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
              ),
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          className="fixed inset-0 z-50 m-0 grid h-full w-full place-items-center bg-black/50 p-4"
        >
          <section className="w-full max-w-md space-y-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-5 shadow-xl">
            <h3 id="ltm-unsaved-title" className="text-base font-semibold">
              {localizeUi("ui.longTermMemory.memoryvault.unsavedNavigationTitle")}
            </h3>
            <p id="ltm-unsaved-description" className="text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.memoryvault.unsavedNavigationDescription", { action: unsavedNavigation })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button data-ltm-unsaved-stay onClick={() => finishUnsavedDecision("stay")}>
                {localizeUi("ui.longTermMemory.memoryvault.stay")}
              </Button>
              <Button destructive onClick={() => finishUnsavedDecision("discard")}>
                {localizeUi("ui.longTermMemory.memoryvault.discardAndContinue")}
              </Button>
              <Button primary onClick={() => finishUnsavedDecision("save")}>
                {localizeUi("ui.longTermMemory.memoryvault.saveAndContinue")}
              </Button>
            </div>
          </section>
        </dialog>
      ) : null}
      {deleteIds ? (
        <dialog
          ref={deleteDialogRef}
          aria-modal="true"
          aria-labelledby="ltm-delete-title"
          aria-describedby="ltm-delete-description"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) setDeleteIds(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setDeleteIds(null);
              return;
            }
            if (event.key !== "Tab") return;
            const focusable = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
              ),
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          className="fixed inset-0 z-50 m-0 grid h-full w-full place-items-center bg-black/50 p-4"
        >
          <section className="w-full max-w-md space-y-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-5 shadow-xl">
            <div className="space-y-1">
              <h3 id="ltm-delete-title" className="text-base font-semibold">
                {localizeUi(
                  "ui.longTermMemory.memoryvault.permanentlyDeleteSelectedMemories",
                )}
              </h3>
              <p
                id="ltm-delete-description"
                className="text-sm text-[var(--muted-foreground)]"
              >
                {localizeUi("ui.longTermMemory.memoryvault.thisCannotBeUndone")}
              </p>
            </div>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                data-ltm-delete-extracted
                className="mt-1"
                checked={retractExtracted}
                onChange={(event) => setRetractExtracted(event.target.checked)}
              />
              <span>
                {localizeUi(
                  "ui.longTermMemory.memoryvault.alsoDeleteMemoriesExtractedFromTheSelectedSource",
                )}
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button
                data-ltm-delete-cancel
                disabled={Boolean(busy)}
                onClick={() => setDeleteIds(null)}
              >
                {localizeUi("ui.longTermMemory.memoryvault.cancel")}
              </Button>
              <Button
                destructive
                disabled={Boolean(busy)}
                onClick={() => void deleteSelected(deleteIds, retractExtracted)}
              >
                <Trash2 aria-hidden="true" size="0.875rem" />
                {localizeUi("ui.longTermMemory.memoryvault.deletePermanently")}
              </Button>
            </div>
          </section>
        </dialog>
      ) : null}
        <section
          ref={navigatorScrollRef}
          data-ltm-memory-list
          className="mari-editor-panel min-w-0"
          aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryList")}
          style={{ maxHeight: "calc(100vh - 12rem)", overflowY: "auto" }}
          onScroll={(event) => {
            const state = navigatorStates.get(contextKey);
            if (state) state.scrollTop = event.currentTarget.scrollTop;
          }}
        >
          {notes.isLoading ? (
            <StatusSurface busy>
              {localizeUi("ui.longTermMemory.memoryvault.loadingMemories")}
            </StatusSurface>
          ) : null}
          {notes.isError ? (
            <StatusSurface tone="danger">
              {localizeUi("ui.longTermMemory.memoryvault.memoriesCouldNotLoad")}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void notes.refetch()}
              >
                {localizeUi("ui.longTermMemory.activityview.retry")}
              </button>
            </StatusSurface>
          ) : null}
          {groupedNoteTypes.map(({ type, labelKey }) => {
            const group = visible.filter((note) => note.type === type);
            if (!group.length) return null;
            return (
              <details
                key={type}
                open={search.trim() ? true : undefined}
                className="group"
                data-ltm-memory-group={type}
              >
                <summary className="flex min-h-10 cursor-pointer items-center gap-2 border-b border-[var(--border)] bg-[var(--secondary)]/35 px-3 text-xs font-semibold">
                  <ChevronRight
                    aria-hidden="true"
                    size="0.875rem"
                    className="transition-transform group-open:rotate-90"
                  />
                  <span>{localizeUi(labelKey)}</span>
                  <span className="ml-auto text-[var(--muted-foreground)]">
                    {group.length}
                  </span>
                </summary>
                {group.map((note) => {
                  const notePreview = preview(note, search, localizeUi);
                  return (
                    <ClickSurface
                      key={note.id}
                      data-ltm-note-type={note.type}
                      data-ltm-note-source={note.type === "source" || undefined}
                      data-ltm-note-actions-open={
                        openActionNoteId === note.id || undefined
                      }
                      className={`group border-b border-[var(--border)]/70 p-2 ${draft?.id === note.id ? "bg-[var(--accent)]/55" : ""}`}
                    >
                      <div className="flex min-w-0 gap-2">
                        {selectMode && note.type !== "source" ? <label className="flex min-h-11 min-w-8 items-center justify-center">
                          <input
                            type="checkbox"
                            checked={checked.has(note.id)}
                            onChange={() =>
                              setChecked((current) => {
                                const next = new Set(current);
                                next.has(note.id)
                                  ? next.delete(note.id)
                                  : next.add(note.id);
                                return next;
                              })
                            }
                            aria-label={localizeUi(
                              "ui.longTermMemory.memoryvault.selectValue1",
                              { value1: memoryLabel(note) },
                            )}
                          />
                        </label> : null}
                        <button
                          type="button"
                          onClick={() => void openNote(note)}
                          className="min-h-14 min-w-0 flex-1 overflow-hidden rounded-md px-2 text-left hover:bg-[var(--accent)]"
                        >
                          <span className="flex items-center gap-2">
                            <strong className="truncate text-sm">
                              {memoryLabel(note)}
                            </strong>
                            <ChevronRight
                              aria-hidden="true"
                              size="0.875rem"
                              className="shrink-0"
                            />
                          </span>
                           <span className="mt-1 flex gap-1 text-xs">
                            <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5">
                              {noteTypeLabel(note.type)}
                            </span>
                            <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5">
                              {statusLabel(note.status)}
                            </span>
                          </span>
                          {notePreview ? (
                            <span className="mt-1 line-clamp-2 block break-words text-xs leading-5 text-[var(--muted-foreground)]">
                              <span className="font-medium text-[var(--foreground)]">
                                {notePreview.label}:
                              </span>{" "}
                              {notePreview.text}
                            </span>
                          ) : null}
                        </button>
                        {note.type !== "source" ? <div className="hidden flex-col items-start gap-1 pt-1 opacity-0 transition-opacity pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto group-hover:opacity-100 group-focus-within:opacity-100 md:flex">
                          <IconButton
                            icon={Archive}
                            label={localizeUi(
                              "ui.longTermMemory.memoryvault.archiveValue1",
                              { value1: memoryLabel(note) },
                            )}
                            disabled={Boolean(busy)}
                            onClick={(event) =>
                              void runNoteAction(event, note, "archive")
                            }
                          />
                          <IconButton
                            icon={Trash2}
                            label={localizeUi(
                              "ui.longTermMemory.memoryvault.deleteValue1",
                              { value1: memoryLabel(note) },
                            )}
                            destructive
                            disabled={Boolean(busy)}
                            onClick={(event) =>
                              void runNoteAction(event, note, "delete")
                            }
                          />
                        </div> : null}
                        {note.type !== "source" ? <div className="md:hidden">
                          <IconButton
                            icon={Ellipsis}
                            label={localizeUi(
                              "ui.longTermMemory.memoryvault.moreActionsForValue1",
                              { value1: memoryLabel(note) },
                            )}
                            aria-expanded={openActionNoteId === note.id}
                            aria-controls={
                              openActionNoteId === note.id
                                ? `ltm-note-actions-${note.id}`
                                : undefined
                            }
                            onClick={(event) =>
                              toggleNoteActions(event, note.id)
                            }
                          />
                        </div> : null}
                      </div>
                      {note.type !== "source" && openActionNoteId === note.id ? (
                        <div
                          id={`ltm-note-actions-${note.id}`}
                          className="flex gap-2 pl-10 pt-2 md:hidden"
                        >
                          <Button
                            className="flex-1"
                            disabled={Boolean(busy)}
                            onClick={(event) =>
                              void runNoteAction(event, note, "archive")
                            }
                          >
                            <Archive aria-hidden="true" size="0.875rem" />
                            {localizeUi(
                              "ui.longTermMemory.memoryvault.archive",
                            )}
                          </Button>
                          <Button
                            className="flex-1"
                            destructive
                            disabled={Boolean(busy)}
                            onClick={(event) =>
                              void runNoteAction(event, note, "delete")
                            }
                          >
                            <Trash2 aria-hidden="true" size="0.875rem" />
                            {localizeUi(
                              "ui.longTermMemory.extractionprompttemplates.delete",
                            )}
                          </Button>
                        </div>
                      ) : null}
                    </ClickSurface>
                  );
                })}
              </details>
            );
          })}
          {!notes.isLoading && !notes.isError && !visible.length ? (
            <div className="space-y-2 p-5 text-center text-xs text-[var(--muted-foreground)]">
              <p>
                {allNotes.length
                  ? localizeUi(
                      "ui.longTermMemory.memoryvault.noMemoriesMatchTheseFilters",
                    )
                  : localizeUi(
                      "ui.longTermMemory.memoryvault.noSavedMemoriesYetImportASourceOrCreate",
                    )}
              </p>
            </div>
          ) : null}
        </section>
            </>
          ),
        }}
        workbench={{
          label: localizeUi("ui.longTermMemory.memoryvault.memoryEditor"),
          disabled: !draft && availabilityOpen !== "bulk",
          content: (
        availabilityOpen === "single" && draft ? (
          <MemoryAvailabilityWorkbench
            note={draft}
            isNew={isNew}
            targets={pickerTargets}
            localizeUi={localizeUi}
            modeLabel={modeLabel}
            onSave={saveAvailability}
            onCancel={() => setAvailabilityOpen(null)}
          />
        ) : availabilityOpen === "bulk" ? (
          <BulkAvailabilityWorkbench
            notes={allNotes.filter((note) => checked.has(note.id))}
            action={bulkAvailabilityAction}
            target={bulkAvailabilityTarget}
            modes={bulkAvailabilityModes}
            localizeUi={localizeUi}
            modeLabel={modeLabel}
            onApply={() => {
              setAvailabilityOpen(null);
              void batch(bulkAvailabilityAction === "add" ? "availability" : "remove-availability");
            }}
            onCancel={() => setAvailabilityOpen(null)}
          />
        ) : <section
          ref={detailRef}
          tabIndex={-1}
          data-ltm-note-workbench
          className="mari-editor-panel min-w-0 scroll-mt-20 p-3"
          style={{
            containerName: "ltm-note-workbench",
            containerType: "inline-size",
          }}
          aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryEditor")}
        >
          {!draft ? (
            <div className="flex min-h-52 items-center justify-center text-center text-sm text-[var(--muted-foreground)]">
              {localizeUi(
                "ui.longTermMemory.memoryvault.openAMemoryForDetailsOrAddOne",
              )}
            </div>
          ) : draft.type === "source" ? (
            <div className="space-y-4" data-ltm-source-readonly>
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                <div className="min-w-0"><h3 className="text-sm font-semibold">{memoryLabel(draft)}</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">{provenanceSourceLabel()}</p></div>
                <Button onClick={() => void onOpenSources?.()}><FileText aria-hidden="true" size="0.875rem" />{localizeUi("ui.longTermMemory.memoryvault.openInSources")}</Button>
              </header>
              <section className="space-y-2"><h4 className="text-xs font-semibold">{localizeUi("ui.longTermMemory.memoryvault.importedContent")}</h4>{Object.entries(draft.sections).map(([key, section]) => <article key={key} className="border-b border-[var(--border)] pb-3"><h5 className="text-xs font-medium">{noteTypeLabel(key)}</h5><p className="mt-1 whitespace-pre-wrap text-sm">{section.text}</p></article>)}</section>
              <section className="space-y-2 border-t border-[var(--border)] pt-4"><h4 className="text-xs font-semibold">{localizeUi("ui.longTermMemory.memoryvault.memoriesCreatedFromThisSource")}</h4>{sourceDerived.map((note) => <button key={note.id} type="button" onClick={() => void openLinkedNote(note.id)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 text-left hover:bg-[var(--accent)]"><span className="truncate text-sm">{memoryLabel(note)}</span><ChevronRight aria-hidden="true" size="0.875rem" /></button>)}{sourceDerivedQuery.isSuccess && !sourceDerived.length ? <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("ui.longTermMemory.memoryvault.noSavedMemoriesLinkToThisSourceYet")}</p> : null}</section>
            </div>
          ) : (
            <div className="space-y-4">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    {isNew
                      ? localizeUi("ui.longTermMemory.memoryvault.newMemory")
                        : memoryLabel(draft)}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {!hasExplicitScope(draft.scope) ? <span className="rounded-full border border-[var(--marinara-editor-warning)]/40 px-2 py-1">{localizeUi("ui.longTermMemory.memoryvault.availableEverywhere")}</span> : null}
                    {draft.conflicts?.some((conflict) => conflict.resolution === "pending") ? <span className="rounded-full border border-[var(--destructive)]/40 px-2 py-1">{localizeUi("ui.longTermMemory.memoryvault.conflicts")}</span> : null}
                    {draft.status === "archived" ? <span className="rounded-full border border-[var(--marinara-editor-warning)]/40 px-2 py-1">{localizeUi("ui.longTermMemory.memoryvault.archived")}</span> : null}
                    {Object.values(draft.sections).some((section) => section.contributions?.some((contribution) => contribution.owner === "manual")) ? <span className="rounded-full border border-[var(--marinara-editor-accent)]/40 px-2 py-1">{localizeUi("ui.longTermMemory.memoryvault.editedManually")}</span> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                    <Button
                    aria-label={
                      detailsOpen
                        ? localizeUi("ui.longTermMemory.memoryvault.hideMemoryInfo")
                        : localizeUi(
                            "ui.longTermMemory.memoryvault.showMemoryInfo",
                          )
                    }
                    onClick={() => {
                      const next = !detailsOpen;
                      setDetailsOpen(next);
                      setMobilePaneAndFocus(next ? "inspector" : "workbench");
                    }}
                    aria-pressed={detailsOpen}
                    data-ltm-details-toggle
                    className="inline-flex min-h-11 items-center gap-2 aria-pressed:bg-[var(--accent)]"
                  >
                    <Braces aria-hidden="true" size="0.875rem" />
                      {localizeUi("ui.longTermMemory.memoryvault.memoryInfo")}
                  </Button>
                    <Button
                    primary
                    disabled={!dirty || busy === "save"}
                    onClick={() => void save()}
                  >
                    <Check aria-hidden="true" size="0.875rem" />
                      {saveState === "saving" ? localizeUi("ui.longTermMemory.memoryvault.saving") : saveState === "saved" ? localizeUi("ui.longTermMemory.memoryvault.saved") : localizeUi("ui.longTermMemory.memoryvault.save")}
                  </Button>
                  <Button onClick={() => void closeDraft()}>
                    {localizeUi("ui.longTermMemory.memoryvault.close")}
                  </Button>
                </div>
              </header>
              {validation.length ? <div ref={validationRef} tabIndex={-1} data-ltm-validation-summary><StatusSurface tone="danger">{validation[0]}</StatusSurface></div> : null}
              <div
                data-ltm-note-layout
                data-details-open={detailsOpen}
                className="min-w-0"
              >
                <div
                  data-ltm-note-editor
                  className="space-y-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 text-xs font-medium sm:col-span-2">
                      <span>{localizeUi("ui.longTermMemory.memoryvault.typeAndSubjects")}</span>
                      {isNew ? (
                        <select className={inputClass} value={draft.type} onChange={(event) => { const type = event.target.value as LtmNoteType; const key = suggestedDetailKey(type); const now = new Date().toISOString(); setDraft({ ...draft, type, id: `${prefixes[type]}_${randomId()}`, subjects: type === "character" || type === "relationship" ? draft.subjects : undefined, sections: Object.keys(draft.sections).length === 1 ? { [key]: { text: Object.values(draft.sections)[0]!.text, updatedAt: now } } : draft.sections }); }}>
                          {noteTypes.map((type) => <option key={type} value={type}>{noteTypeLabel(type)}</option>)}
                        </select>
                      ) : <p className="min-h-11 pt-3 text-sm text-[var(--muted-foreground)]">{noteTypeLabel(draft.type)}</p>}
                      {draft.type === "character" || draft.type === "relationship" ? <div className="space-y-2 pt-2"><span>{draft.type === "character" ? localizeUi("ui.longTermMemory.memoryvault.personThisMemoryDescribes") : localizeUi("ui.longTermMemory.memoryvault.peopleInThisRelationship")}</span><div className="flex flex-wrap gap-1.5">{(draft.subjects ?? []).map((subject, index) => <Pill key={subject.key} label={subjectLabel(subject)} onRemove={() => update("subjects", draft.subjects?.filter((_, item) => item !== index) ?? [])}>{subjectLabel(subject)}</Pill>)}</div>{!subjectLimitReached ? <TargetPicker targets={pickerTargets} selectedIds={subjectSelectionIds} allowedKinds={new Set(["character", "persona"])} placeholder={localizeUi("ui.longTermMemory.memoryvault.chooseSubject")} emptyLabel={localizeUi("ui.longTermMemory.memoryvault.noSubjectTargets")} clearLabel={localizeUi("ui.longTermMemory.memoryvault.clearTargetSearch")} onSelect={selectSubjectTarget} /> : null}</div> : null}
                    </div>
                    <label className="space-y-1 text-xs font-medium">
                      {localizeUi("ui.longTermMemory.memoryvault.title")}
                      <input
                        className={inputClass}
                        value={draft.title ?? ""}
                        aria-invalid={!draft.title?.trim()}
                        onChange={(event) =>
                          update("title", event.target.value)
                        }
                      />
                      {!draft.title?.trim() ? <p className="text-xs text-[var(--destructive)]">{localizeUi("ui.longTermMemory.memoryvault.memoryTitleRequired")}</p> : null}
                    </label>
                    <div className="space-y-1 text-xs font-medium">
                      <div className="flex items-center gap-1">
                        <label htmlFor={statusInputId}>
                          {localizeUi("ui.longTermMemory.memoryvault.status")}
                        </label>
                        <InfoPopover
                          label={localizeUi("ui.longTermMemory.memoryvault.status")}
                          content={localizeUi("ui.longTermMemory.memoryvault.statusHelp")}
                        />
                      </div>
                      <select
                        id={statusInputId}
                        className={inputClass}
                        value={draft.status}
                        onChange={(event) =>
                          update("status", event.target.value as LtmStatus)
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <h4 className="mr-auto text-xs font-medium">
                        {localizeUi(
                          "ui.longTermMemory.memoryvault.memorySections",
                        )}
                      </h4>
                      {draft.type !== "source" ? (
                        <>
                          <input
                            className={`${inputClass} w-40`}
                            value={sectionKey}
                            onChange={(event) =>
                              setSectionKey(event.target.value)
                            }
                            placeholder={localizeUi(
                              "ui.longTermMemory.memoryvault.newSection",
                            )}
                            aria-label={localizeUi(
                              "ui.longTermMemory.memoryvault.newSectionName",
                            )}
                          />
                          <Button
                            onClick={addSection}
                            disabled={!sectionKey.trim()}
                          >
                            {localizeUi(
                              "ui.longTermMemory.memoryvault.addSection",
                            )}
                          </Button>
                        </>
                      ) : null}
                    </div>
                    {Object.entries(draft.sections).map(([key, section]) => (
                      <article
                        key={key}
                        className="space-y-2 rounded-md border border-[var(--border)] p-3"
                      >
                        <div className="flex items-center justify-between">
                          {renamingSectionKey === key ? (
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                              <input
                                className={`${inputClass} h-8 min-h-8 w-40`}
                                value={renamedSectionKey}
                                aria-label={localizeUi("ui.longTermMemory.memoryvault.newSectionName")}
                                onChange={(event) => setRenamedSectionKey(event.target.value)}
                              />
                              <Button
                                disabled={Boolean(busy) || !renamedSectionKey.trim()}
                                onClick={() => void renameSection()}
                              >
                                {localizeUi("ui.longTermMemory.memoryvault.saveDetailName")}
                              </Button>
                              <Button
                                disabled={Boolean(busy)}
                                onClick={() => {
                                  setRenamingSectionKey(null);
                                  setRenamedSectionKey("");
                                }}
                              >
                                {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                              </Button>
                            </div>
                          ) : (
                            <label
                              htmlFor={`ltm-section-${key}`}
                              className="text-xs font-semibold"
                            >
                              {noteTypeLabel(key)}
                            </label>
                          )}
                          {draft.type !== "source" ? (
                            <div className="flex items-center gap-1">
                              {Object.keys(draft.sections).length > 1 ? (
                                <button
                                  type="button"
                                  disabled={Boolean(busy)}
                                  onClick={() => void deleteSection(key)}
                                  aria-label={localizeUi(
                                    "ui.longTermMemory.memoryvault.removeValue1Section",
                                    { value1: key },
                                  )}
                                  title={localizeUi(
                                    "ui.longTermMemory.memoryvault.removeValue1Section",
                                    { value1: key },
                                  )}
                                  className="grid h-8 w-8 place-items-center rounded text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                                >
                                  <Trash2 aria-hidden="true" size="0.75rem" />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <fieldset
                          disabled={draft.type === "source"}
                          className="space-y-2"
                        >
                          <textarea
                            id={`ltm-section-${key}`}
                            data-ltm-field="section"
                            className={`${inputClass} min-h-28 py-2`}
                            style={{ maxHeight: "16rem", overflowY: "auto" }}
                            value={section.text}
                            aria-invalid={!section.text.trim()}
                            onInput={(event) => {
                              const textarea = event.currentTarget;
                              textarea.style.height = "auto";
                              textarea.style.height = `${Math.min(textarea.scrollHeight, 256)}px`;
                            }}
                            onChange={(event) =>
                              update("sections", {
                                ...draft.sections,
                                [key]: {
                                  ...section,
                                  text: event.target.value,
                                  updatedAt: new Date().toISOString(),
                                },
                              })
                            }
                          />
                          {!section.text.trim() ? <p className="text-xs text-[var(--destructive)]">{localizeUi("ui.longTermMemory.memoryvault.detailTextRequired")}</p> : null}
                        </fieldset>
                        {draft.conflicts?.map((conflict, index) =>
                          conflict.resolution === "pending" && conflict.field.includes(key) ? (
                            <section key={`${conflict.field}-${index}`} className="space-y-2 border-t border-[var(--destructive)]/35 pt-2" data-ltm-detail-conflict>
                              <p className="text-xs font-semibold text-[var(--destructive)]">{localizeUi("ui.longTermMemory.memoryvault.conflictNeedsResolution")}</p>
                              <p className="text-xs text-[var(--muted-foreground)]">{conflict.proposed}</p>
                              <Button onClick={() => updateConflict(index, section.text)}>{localizeUi("ui.longTermMemory.memoryvault.resolve")}</Button>
                            </section>
                          ) : null,
                        )}
                      </article>
                    ))}
                  </section>
                  <section className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold">
                        {localizeUi("ui.longTermMemory.memoryvault.memoryAvailability")}
                      </h4>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {hasExplicitScope(draft.scope)
                          ? localizeUi("ui.longTermMemory.memoryvault.availabilitySummary", {
                              places: availabilityEntries(draft.scope, pickerTargets).length,
                              modes: draft.modes.length,
                            })
                          : localizeUi("ui.longTermMemory.memoryvault.availableEverywhere")}
                      </p>
                    </div>
                    <Button onClick={openAvailability}>
                      {hasExplicitScope(draft.scope)
                        ? localizeUi("ui.longTermMemory.memoryvault.editAvailability")
                        : localizeUi("ui.longTermMemory.memoryvault.chooseWhereUsed")}
                    </Button>
                  </section>
                </div>
                {inspectorMount
                  ? createPortal(
                      <aside
                  data-ltm-note-inspector
                  aria-label={localizeUi(
                    "ui.longTermMemory.memoryvault.memoryInspector",
                  )}
                  className="min-w-0"
                >
                  <details open data-ltm-memory-options>
                    <summary className="cursor-pointer text-sm font-semibold">{localizeUi("ui.longTermMemory.memoryvault.memoryOptions")}</summary>
                    <section data-ltm-keyword-editor className="space-y-2 border-t border-[var(--border)] pt-3">
                      <h4 className="text-xs font-medium">{localizeUi("ui.longTermMemory.memoryvault.keywords")}</h4>
                      <div className="flex flex-wrap gap-1.5">{activeKeywordValues(draft).map((keyword) => {
                        const generated = getLtmKeywordIntent(draft).generated.some((value) => ltmKeywordKey(value) === ltmKeywordKey(keyword));
                        return <Pill key={keyword} label={`${generated ? localizeUi("ui.longTermMemory.memoryvault.generated") : localizeUi("ui.longTermMemory.memoryvault.addedManually")}: ${keyword}`} onRemove={() => generated ? update("suppressedKeywords", [...(draft.suppressedKeywords ?? []), keyword]) : update("manualKeywords", (draft.manualKeywords ?? draft.keywords).filter((value) => ltmKeywordKey(value) !== ltmKeywordKey(keyword)))}><span className="font-medium">{generated ? localizeUi("ui.longTermMemory.memoryvault.generated") : localizeUi("ui.longTermMemory.memoryvault.addedManually")}</span>: {keyword}</Pill>;
                      })}</div>
                      <TokenEditor label={localizeUi("ui.longTermMemory.memoryvault.addKeyword")} values={draft.manualKeywords ?? draft.keywords} placeholder={localizeUi("ui.longTermMemory.memoryvault.addKeyword")} onChange={(values) => update("manualKeywords", values)} />
                    </section>
                    {(draft.type === "thread" || draft.type === "world" || draft.type === "tone") ? <section className="space-y-2 border-t border-[var(--border)] pt-3">{draft.type === "thread" ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.tags.includes("quest")} onChange={(event) => update("tags", event.target.checked ? [...draft.tags, "quest"] : draft.tags.filter((tag) => tag !== "quest"))} />{localizeUi("ui.longTermMemory.memoryvault.questMemory")}</label> : null}{draft.type !== "thread" ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.tags.includes("anchor")} onChange={(event) => update("tags", event.target.checked ? [...draft.tags, "anchor"] : draft.tags.filter((tag) => tag !== "anchor"))} />{localizeUi("ui.longTermMemory.memoryvault.recurringMemory")}</label> : null}</section> : null}
                    <details className="border-t border-[var(--border)] pt-3"><summary className="cursor-pointer text-xs font-medium">{localizeUi("ui.longTermMemory.memoryvault.renameDetails")}</summary><div className="mt-2 flex flex-wrap gap-2">{Object.keys(draft.sections).map((key) => <Button key={key} disabled={Boolean(busy) || isNew} onClick={() => void beginRename(key)}>{localizeUi("ui.longTermMemory.memoryvault.renameDetail")}: {noteTypeLabel(key)}</Button>)}</div></details>
                  <details className="space-y-2 border-t border-[var(--border)] pt-4" data-ltm-linked-memories>
                    <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium">
                      {localizeUi(
                        "ui.longTermMemory.memoryvault.linkedMemories",
                      )}
                      <InfoPopover
                        label={localizeUi(
                          "ui.longTermMemory.memoryvault.linkedMemories",
                        )}
                        content={localizeUi(
                          "ui.longTermMemory.memoryvault.explicitRelationshipsUsedToConnectThisMemoryToRelated",
                        )}
                      />
                    </summary>
                    <div className="flex flex-wrap gap-1.5">
                       {draft.links.filter((link) => link.relation !== "extracted_from").map((link, index) => (
                        <Pill
                          key={`${link.target}-${link.relation}-${index}`}
                          label={localizeUi(
                            "ui.longTermMemory.longtermmemorydetail.value1Value2",
                            {
                               value1: relationLabel(link.relation),
                              value2: memoryLabel(
                                allNotes.find(
                                  (note) => note.id === link.target,
                                ),
                              ),
                            },
                          )}
                          onRemove={() =>
                            update(
                              "links",
                              draft.links.filter((_, item) => item !== index),
                            )
                          }
                        >
                            {relationLabel(link.relation)}
                          {" -> "}
                          <button
                            type="button"
                            className="underline underline-offset-2"
                            onClick={() => void openLinkedNote(link.target)}
                          >
                            {memoryLabel(
                              allNotes.find((note) => note.id === link.target),
                            )}
                          </button>
                        </Pill>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("ui.longTermMemory.memoryvault.memoriesLinkingHere")}: {incomingLinks.length}</p>
                    {incomingLinks.map((note) => <button key={note.id} type="button" className="block text-left text-xs underline" onClick={() => void openLinkedNote(note.id)}>{memoryLabel(note)}</button>)}
                    <div
                      data-ltm-inspector-fields
                      className="grid gap-2"
                    >
                      <input
                        className={inputClass}
                        value={linkTarget}
                        aria-label={localizeUi(
                          "ui.longTermMemory.memoryvault.searchOrEnterAMemory",
                        )}
                        onChange={(event) => setLinkTarget(event.target.value)}
                        placeholder={localizeUi(
                          "ui.longTermMemory.memoryvault.searchOrEnterAMemory",
                        )}
                        list="ltm-linked-memories"
                      />
                      <datalist id="ltm-linked-memories">
                        {allNotes
                          .filter(
                            (note) =>
                              note.id !== draft.id &&
                              !draft.links.some(
                                (link) => link.target === note.id,
                              ),
                          )
                          .map((note) => (
                            <option key={note.id} value={note.id}>
                              {memoryLabel(note)}
                            </option>
                          ))}
                      </datalist>
                      <select
                        className={inputClass}
                        value={linkRelation}
                        aria-label={localizeUi(
                          "ui.longTermMemory.memorysettings.relationship",
                        )}
                        onChange={(event) =>
                          setLinkRelation(
                            event.target.value as LtmLink["relation"],
                          )
                        }
                      >
                        {relations.filter((relation) => relation !== "extracted_from").map((relation) => (
                          <option key={relation} value={relation}>
                            {relationLabel(relation)}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={addLink}
                        disabled={
                          !linkTarget.trim() || linkTarget.trim() === draft.id
                        }
                      >
                        <Link2 aria-hidden="true" size="0.75rem" />
                        {localizeUi("ui.longTermMemory.memoryvault.link")}
                      </Button>
                    </div>
                  </details>
                  </details>
                  <details className="border-t border-[var(--border)] pt-4" data-ltm-record-info>
                    <summary className="cursor-pointer text-sm font-semibold">{localizeUi("ui.longTermMemory.memoryvault.recordInfo")}</summary>
                  <dl className="mt-3 grid gap-3 text-xs text-[var(--muted-foreground)]">
                    {Object.entries(draft.sections).map(([key, section]) => <div key={key}><dt className="font-medium text-[var(--foreground)]">{noteTypeLabel(key)}</dt><dd>{section.contributions?.some((contribution) => contribution.owner === "manual") ? localizeUi("ui.longTermMemory.memoryvault.editedManually") : ""}</dd>{section.evidence?.length ? <dd>{localizeUi("ui.longTermMemory.memoryvault.evidence")}: {section.evidence.join("; ")}</dd> : null}{section.importance ? <dd>{localizeUi("ui.longTermMemory.memoryvault.extractionImportance")}: {localizedLabel(section.importance, localizeUi, labelKeys.importance)}</dd> : null}{section.confidence !== undefined ? <dd>{localizeUi("ui.longTermMemory.memoryvault.extractionConfidence")}: {Math.round(section.confidence * 100)}%</dd> : null}</div>)}
                    <div>
                      <dt className="font-medium text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.memoryvault.created")}
                      </dt>
                      <dd>
                        {new Date(draft.createdAt).toLocaleString(locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.memoryvault.updated")}
                      </dt>
                      <dd>
                        {new Date(draft.updatedAt).toLocaleString(locale)}
                      </dd>
                    </div>
                    {draft.provenance ? (
                      <div>
                        <dt className="flex items-center gap-1 font-medium text-[var(--foreground)]">
                          {localizeUi(
                            "ui.longTermMemory.memoryvault.provenance",
                          )}
                          <InfoPopover
                            label={localizeUi(
                              "ui.longTermMemory.memoryvault.provenance",
                            )}
                            content={localizeUi(
                              "ui.longTermMemory.memoryvault.provenanceHelp",
                            )}
                          />
                        </dt>
                        <dd className="break-words">
                          {localizeUi("ui.longTermMemory.memoryvault.importedFrom", {
                            source: provenanceSourceLabel(),
                          })}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  </details>
                      </aside>,
                      inspectorMount,
                    )
                  : null}
              </div>
            </div>
          )}
        </section>,
          ),
        }}
        inspector={
          draft && detailsOpen && !availabilityOpen
            ? {
                label: localizeUi(
                  "ui.longTermMemory.memoryvault.memoryDetails",
                ),
                content: <div ref={setInspectorMount} data-ltm-inspector-mount />,
              }
            : undefined
        }
      />
    </section>
  );
}
