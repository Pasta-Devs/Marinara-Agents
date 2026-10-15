import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { inputClass } from "../shared-controls";
import { type LtmTranslationFunction } from "../localization";
import { scopeKindCategories } from "../display-labels";
import { buildScopeMemoryPresence, uniqueById, type ScopeTargets } from "../scope-targets";
import { nextTabIndex } from "../tab-keys";
import type { Target } from "./vault-shared";

export function VaultScopePicker({
  targets,
  selectedId,
  currentIds,
  scopeTargets,
  localizeUi,
  onSelect,
  variant = "primary",
  allOptionLabel,
}: {
  targets: {
    all: Target;
    chat: Target[];
    branch: Target[];
    character: Target[];
    persona: Target[];
  };
  selectedId: string;
  currentIds: { chat?: string; branch?: string; character?: string; persona?: string };
  scopeTargets?: ScopeTargets;
  localizeUi: LtmTranslationFunction;
  onSelect: (target: Target) => void;
  variant?: "primary" | "secondary";
  allOptionLabel?: string;
}) {
  const categories = scopeKindCategories(localizeUi);
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<(typeof categories)[number][0]>("all");
  const flatTargets = uniqueById([
    targets.all,
    ...targets.chat,
    ...targets.branch,
    ...targets.character,
    ...targets.persona,
  ]);
  const activeTargets =
    activeKind === "all"
      ? flatTargets.filter((target) => target.id !== "all")
      : activeKind === "chat"
        ? targets.chat
        : activeKind === "branch"
          ? targets.branch
          : activeKind === "character"
            ? targets.character
            : targets.persona;
  const needle = query.trim().toLocaleLowerCase();
  const branchTargetIds = new Set(targets.branch.map((target) => target.id));
  const chatTargetIds = new Set(targets.chat.map((target) => target.id));
  const characterTargetIds = new Set(targets.character.map((target) => target.id));
  const targetKind = (target: Target, kind: (typeof categories)[number][0]) => {
    if (kind !== "all") return kind;
    if (branchTargetIds.has(target.id)) return "branch" as const;
    if (chatTargetIds.has(target.id)) return "chat" as const;
    if (characterTargetIds.has(target.id)) return "character" as const;
    return "persona" as const;
  };
  const targetFullName = (target: Target, kind: (typeof categories)[number][0]) => {
    const resolvedKind = targetKind(target, kind);
    const comment = target.comment?.trim();
    if (resolvedKind === "branch") {
      const chatName =
        target.chatName?.trim() ||
        scopeTargets?.chats.find((candidate) => candidate.id === target.scope?.chatIds?.[0])?.chatName?.trim();
      return chatName ? `${chatName} - ${target.label}` : target.label;
    }
    return resolvedKind === "persona" && comment ? `${target.label} - ${comment}` : target.label;
  };
  const targetSearchText = (target: Target, kind: (typeof categories)[number][0]) =>
    `${targetFullName(target, kind)} ${target.label} ${target.comment ?? ""}`.toLocaleLowerCase();
  const filteredTargets = activeTargets.filter((target) => targetSearchText(target, activeKind).includes(needle));
  const pickerId = useId();
  const currentTarget =
    activeKind === "all" ? undefined : activeTargets.find((target) => target.id === currentIds[activeKind]);
  const displayedTargets = filteredTargets.filter((target) => target.id !== currentTarget?.id);
  const options = [
    {
      key: "all",
      target: targets.all,
      label: allOptionLabel ?? localizeUi("ui.longTermMemory.sourcesworkspace.all"),
      kind: "all" as const,
    },
    ...(activeKind === "all"
      ? []
      : [
          {
            key: "current",
            target: currentTarget,
            label: localizeUi("ui.longTermMemory.memoryvault.current"),
            kind: activeKind,
          },
        ]),
  ];
  const regularTargets = displayedTargets;
  const memoryPresence = scopeTargets?.memoryPresence;
  const hasMemories = useMemo(
    () => (memoryPresence ? buildScopeMemoryPresence(memoryPresence) : null),
    [memoryPresence],
  );
  const targetsWithMemories = hasMemories ? regularTargets.filter((target) => hasMemories(target.scope)) : [];
  const targetsWithoutMemories = hasMemories ? regularTargets.filter((target) => !hasMemories(target.scope)) : [];
  const neutralTargets = hasMemories ? [] : regularTargets;
  const [noMemoriesOpen, setNoMemoriesOpen] = useState(false);
  const noMemoriesPreference = useRef(false);
  const wasSearching = useRef(false);
  useEffect(() => {
    if (needle) setNoMemoriesOpen(true);
    else if (wasSearching.current) setNoMemoriesOpen(noMemoriesPreference.current);
    wasSearching.current = Boolean(needle);
  }, [needle]);
  function selectKind(kind: (typeof categories)[number][0]) {
    setActiveKind(kind);
    setNoMemoriesOpen(false);
    noMemoriesPreference.current = false;
    wasSearching.current = false;
  }
  const radioTargets = [
    ...options.flatMap(({ target }) => (target ? [target] : [])),
    ...neutralTargets,
    ...targetsWithMemories,
    ...(noMemoriesOpen ? targetsWithoutMemories : []),
  ];
  const tabStopId = radioTargets.some((target) => target.id === selectedId) ? selectedId : radioTargets[0]?.id;
  const renderRegularTarget = (target: Target) => {
    const fullName = targetFullName(target, activeKind);
    const branchChatName =
      targetKind(target, activeKind) === "branch"
        ? target.chatName?.trim() ||
          scopeTargets?.chats.find((candidate) => candidate.id === target.scope?.chatIds?.[0])?.chatName?.trim()
        : undefined;
    return (
      <button
        key={target.id}
        type="button"
        data-ltm-vault-scope-target={target.id}
        title={fullName}
        role="radio"
        aria-checked={target.id === selectedId}
        tabIndex={target.id === tabStopId ? 0 : -1}
        data-selected={target.id === selectedId ? "true" : "false"}
        className={`mari-editor-action flex min-h-11 w-full min-w-0 items-center gap-3 rounded-none border-t-0 px-3 py-2 text-left text-sm last:border-b-0 ${target.id === selectedId ? "bg-[var(--primary)]/10" : ""}`}
        onClick={() => onSelect(target)}
      >
        <Check
          aria-hidden="true"
          size="0.875rem"
          className={target.id === selectedId ? "shrink-0 text-[var(--marinara-editor-accent)]" : "shrink-0 opacity-0"}
        />
        <span className="flex min-w-0 flex-1">
          {branchChatName ? (
            <>
              <span className="min-w-0 flex-1 truncate">{branchChatName}</span>
              <span className="shrink-0"> - </span>
              <span className="min-w-0 max-w-full shrink truncate">{target.label}</span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate">{fullName}</span>
          )}
        </span>
      </button>
    );
  };
  return (
    <div
      id={variant === "secondary" ? `${pickerId}-secondary-control` : "ltm-vault-scope-control"}
      data-ltm-vault-scope-control={variant === "primary" ? true : undefined}
      data-ltm-vault-scope-secondary-control={variant === "secondary" ? true : undefined}
      className="min-w-0 max-w-full space-y-3 p-3"
      style={{ containerType: "inline-size" }}
    >
      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
        <span className="min-w-0 truncate">{localizeUi("ui.longTermMemory.memoryvault.chooseScope")}</span>
      </div>
      <label className="relative block min-w-0">
        <Search
          aria-hidden="true"
          size="0.875rem"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          className={`${inputClass} min-w-0 max-w-full pl-9`}
          value={query}
          placeholder={localizeUi("ui.longTermMemory.sourcesworkspace.searchScopes")}
          aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.searchScopes")}
          data-ltm-vault-scope-search
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div
        role="tablist"
        aria-label={localizeUi("ui.longTermMemory.memoryvault.chooseScope")}
        data-ltm-vault-scope-tablist
        className="mari-editor-tab-rail grid w-full min-w-0 gap-1 rounded-lg border p-1"
      >
        <style>{`
          [data-ltm-vault-scope-tablist] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          [data-ltm-vault-scope-tab]:not([data-active="true"]):not(:hover) {
            background: var(--marinara-editor-control-bg);
          }
          @container (min-width: 16rem) {
            [data-ltm-vault-scope-tablist] {
              grid-template-columns: repeat(5, minmax(0, 1fr));
            }
          }
          @container (max-width: 15rem) {
            [data-ltm-vault-scope-tablist] {
              grid-template-columns: minmax(0, 1fr);
            }
          }
        `}</style>
        {categories.map(([kind, label], index) => (
          <button
            key={kind}
            type="button"
            role="tab"
            id={`${pickerId}-${kind}`}
            aria-controls={`${pickerId}-panel`}
            tabIndex={activeKind === kind ? 0 : -1}
            aria-selected={activeKind === kind}
            data-ltm-vault-scope-tab={kind}
            data-active={activeKind === kind}
            data-ltm-tab-focus
            className="mari-editor-tab min-h-11 min-w-0 rounded-md px-1 text-xs font-semibold"
            onClick={() => selectKind(kind)}
            onKeyDown={(event) => {
              const nextIndex = nextTabIndex(event.key, index, categories.length);
              if (nextIndex === null) return;
              event.preventDefault();
              const nextKind = categories[nextIndex]![0];
              selectKind(nextKind);
              document.getElementById(`${pickerId}-${nextKind}`)?.focus();
            }}
          >
            <span className="block truncate">{label}</span>
          </button>
        ))}
      </div>
      <div
        data-ltm-vault-scope-list
        id={`${pickerId}-panel`}
        role="tabpanel"
        aria-labelledby={`${pickerId}-${activeKind}`}
        className="min-w-0 max-h-52 overflow-y-auto overscroll-contain divide-y divide-[var(--border)] border-y border-[var(--border)]"
      >
        <div
          role="radiogroup"
          aria-labelledby={`${pickerId}-${activeKind}`}
          className="divide-y divide-[var(--border)]"
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
            const radios = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:enabled'),
            ).filter((radio) => !radio.closest("details:not([open])"));
            const index = radios.indexOf(event.target as HTMLButtonElement);
            if (index < 0 || radios.length < 2) return;
            event.preventDefault();
            const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
            const next = radios[(index + step + radios.length) % radios.length]!;
            next.focus();
            next.click();
          }}
        >
          {options.map(({ key, target: optionTarget, label, kind }) => {
            const selected = optionTarget?.id === selectedId;
            const fullName = optionTarget ? targetFullName(optionTarget, kind) : label;
            return (
              <button
                key={key}
                type="button"
                data-ltm-vault-scope-target={optionTarget?.id}
                data-ltm-vault-scope-current={key === "current" ? activeKind : undefined}
                data-ltm-vault-scope-pinned={key === "all" || key === "current" ? key : undefined}
                disabled={!optionTarget}
                title={key === "all" ? optionTarget?.label : fullName}
                role="radio"
                aria-checked={selected}
                tabIndex={optionTarget && optionTarget.id === tabStopId ? 0 : -1}
                data-selected={selected ? "true" : "false"}
                className={`mari-editor-action flex min-h-11 w-full min-w-0 items-center gap-3 rounded-none border-t-0 px-3 py-2 text-left text-sm last:border-b-0 ${selected ? "bg-[var(--primary)]/10" : ""}`}
                onClick={() => optionTarget && onSelect(optionTarget)}
              >
                <Check
                  aria-hidden="true"
                  size="0.875rem"
                  className={selected ? "shrink-0 text-[var(--marinara-editor-accent)]" : "shrink-0 opacity-0"}
                />
                <span className="min-w-0 flex-1 truncate">
                  {key === "all" ? label : fullName}
                  {key === "current" && optionTarget ? (
                    <span className="block truncate text-xs text-[var(--marinara-editor-muted)]">
                      {optionTarget.label}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
          {neutralTargets.map(renderRegularTarget)}
          {targetsWithMemories.length ? (
            <div data-ltm-vault-scope-presence="with-memories">
              <p className="border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.memoryvault.withMemories")}
              </p>
              {targetsWithMemories.map(renderRegularTarget)}
            </div>
          ) : null}
          {targetsWithoutMemories.length ? (
            <details
              open={noMemoriesOpen}
              onToggle={(event) => setNoMemoriesOpen(event.currentTarget.open)}
              data-ltm-vault-scope-presence="no-memories"
            >
              <summary
                onClick={() => {
                  noMemoriesPreference.current = !noMemoriesOpen;
                }}
                className="flex min-h-11 cursor-pointer list-none items-center border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] [&::-webkit-details-marker]:hidden"
              >
                {localizeUi("ui.longTermMemory.memoryvault.noMemories")}
              </summary>
              {targetsWithoutMemories.map(renderRegularTarget)}
            </details>
          ) : null}
        </div>
        {!filteredTargets.length && activeKind !== "all" ? (
          <p className="px-3 py-4 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.memoryvault.noScopeTargets")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
