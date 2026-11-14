import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LtmDuplicatePeopleApplyResponse,
  LtmDuplicatePeoplePreviewResponse,
  LtmRelationshipLinksApplyResponse,
  LtmRelationshipLinksPreviewResponse,
  LtmTidyApplyResponse,
  LtmTidyPreviewResponse,
  LtmAiCheckScopeResponse,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, invalidateLtmQueries, queryKeys, request } from "../api";
import { connectionLabel, languageConnectionsQueryOptions } from "../language-connections";
import { selectLtmPluralForm, useLtmTranslation } from "../localization";
import { Button, ModalDialog, Spinner, StatusSurface, lockedActionProps } from "../shared-controls";
import { sourceCheckboxClass } from "../sources/source-shared";

type Phase = "confirm" | "checking" | "results" | "empty" | "error" | "done";

/** The AI checks that share this flow. Each reads memories with the extraction model and changes only what is ticked. */
export type LtmAiCheckKind = "tidy" | "links" | "people";

type CheckItem = { id: string; label: string };
type CheckRow = { heading: string; keepLine: string | null; marker: string; items: CheckItem[] };
type CheckPreview = {
  checked: number;
  total: number;
  truncated: boolean;
  /** The position to carry on after when this batch stopped at the call limit; null when nothing is left. */
  next: string | null;
  failedChunks: number;
  rows: CheckRow[];
};
type CheckTranslate = (key: string, values?: Record<string, string | number>) => string;

type CheckConfig = {
  /** Read-only: how many memories the check will read and which connection it will use. */
  scopePath: string;
  scopeOneKey: string;
  scopeOtherKey: string;
  previewPath: string;
  applyPath: string;
  titleKey: string;
  textKey: string;
  confirmKey: string;
  checkingKey: string;
  emptyKey: string;
  failedKey: string;
  checkedKey: string;
  applyOneKey: string;
  applyOtherKey: string;
  doneOneKey: string;
  doneOtherKey: string;
  hintKey: string | null;
  /** Rows start ticked, except for checks whose changes are harder to undo. */
  tickAll: boolean;
  preview: (response: never, translate: CheckTranslate) => CheckPreview;
  /** The request body for the ticked item ids. */
  body: (ids: string[]) => unknown;
  /** How many changes the apply response reports. */
  changed: (response: never) => number;
  queries: readonly (readonly string[])[];
};

const TIDY_REASON_KEYS: Record<string, string> = {
  duplicate: "ui.longTermMemory.tidy.reasonDuplicate",
  covered: "ui.longTermMemory.tidy.reasonCovered",
  placeholder: "ui.longTermMemory.tidy.reasonPlaceholder",
};
const LINK_ORIGIN_KEYS: Record<string, string> = {
  name: "ui.longTermMemory.links.originName",
  model: "ui.longTermMemory.links.originModel",
};
// A pair has no id of its own: the checkbox carries both ids, split again when the ticked rows are sent.
const pairKey = (relationshipId: string, personId: string) => `${relationshipId}|${personId}`;
// A people group is one checkbox: "keep|merged,merged".
const groupKey = (keepId: string, mergeIds: string[]) => `${keepId}|${mergeIds.join(",")}`;

const CHECKS: Record<LtmAiCheckKind, CheckConfig> = {
  tidy: {
    scopePath: "/tidy/scope",
    scopeOneKey: "ui.longTermMemory.tidy.scopeOne",
    scopeOtherKey: "ui.longTermMemory.tidy.scopeOther",
    previewPath: "/tidy/preview",
    applyPath: "/tidy/apply",
    titleKey: "ui.longTermMemory.whatsnew.tidyTitle",
    textKey: "ui.longTermMemory.whatsnew.tidyText",
    confirmKey: "ui.longTermMemory.tidy.confirm",
    checkingKey: "ui.longTermMemory.tidy.checking",
    emptyKey: "ui.longTermMemory.tidy.empty",
    failedKey: "ui.longTermMemory.tidy.failed",
    checkedKey: "ui.longTermMemory.tidy.checked",
    applyOneKey: "ui.longTermMemory.tidy.applyOne",
    applyOtherKey: "ui.longTermMemory.tidy.applyOther",
    doneOneKey: "ui.longTermMemory.memoryvault.archiveSuccessOne",
    doneOtherKey: "ui.longTermMemory.memoryvault.archiveSuccessOther",
    hintKey: "ui.longTermMemory.tidy.restoreHint",
    tickAll: true,
    preview: (response: LtmTidyPreviewResponse, translate) => ({
      checked: response.checked,
      total: response.total,
      truncated: response.truncated,
      next: response.next,
      failedChunks: response.failedChunks,
      rows: response.suggestions.map((suggestion) => ({
        heading: translate(TIDY_REASON_KEYS[suggestion.reason]!),
        keepLine: suggestion.keep ? translate("ui.longTermMemory.tidy.keeps", { title: suggestion.keep.title }) : null,
        marker: suggestion.reason,
        items: suggestion.archive.map((memory) => ({ id: memory.id, label: memory.title })),
      })),
    }),
    body: (ids) => ({ noteIds: ids }),
    changed: (response: LtmTidyApplyResponse) => response.archived.length,
    queries: [queryKeys.notes, queryKeys.status, queryKeys.integrity, queryKeys.activity],
  },
  links: {
    scopePath: "/links/scope",
    scopeOneKey: "ui.longTermMemory.links.scopeOne",
    scopeOtherKey: "ui.longTermMemory.links.scopeOther",
    previewPath: "/links/preview",
    applyPath: "/links/apply",
    titleKey: "ui.longTermMemory.whatsnew.linkTitle",
    textKey: "ui.longTermMemory.whatsnew.linkText",
    confirmKey: "ui.longTermMemory.links.confirm",
    checkingKey: "ui.longTermMemory.links.checking",
    emptyKey: "ui.longTermMemory.links.empty",
    failedKey: "ui.longTermMemory.links.failed",
    checkedKey: "ui.longTermMemory.links.checked",
    applyOneKey: "ui.longTermMemory.links.applyOne",
    applyOtherKey: "ui.longTermMemory.links.applyOther",
    doneOneKey: "ui.longTermMemory.links.doneOne",
    doneOtherKey: "ui.longTermMemory.links.doneOther",
    hintKey: null,
    tickAll: true,
    preview: (response: LtmRelationshipLinksPreviewResponse, translate) => ({
      checked: response.checked,
      total: response.total,
      truncated: response.truncated,
      next: response.next,
      failedChunks: response.failedChunks,
      rows: response.suggestions.map((suggestion) => ({
        heading: translate(LINK_ORIGIN_KEYS[suggestion.origin]!),
        keepLine: null,
        marker: suggestion.origin,
        items: [
          {
            id: pairKey(suggestion.relationship.id, suggestion.person.id),
            label: translate("ui.longTermMemory.links.pair", {
              relationship: suggestion.relationship.title,
              person: suggestion.person.title,
            }),
          },
        ],
      })),
    }),
    body: (ids) => ({
      links: ids.map((id) => {
        const [relationshipId, personId] = id.split("|");
        return { relationshipId, personId };
      }),
    }),
    changed: (response: LtmRelationshipLinksApplyResponse) => response.linked.length,
    queries: [queryKeys.notes, queryKeys.status, queryKeys.integrity, queryKeys.activity],
  },
  people: {
    scopePath: "/people/scope",
    scopeOneKey: "ui.longTermMemory.people.scopeOne",
    scopeOtherKey: "ui.longTermMemory.people.scopeOther",
    previewPath: "/people/preview",
    applyPath: "/people/apply",
    titleKey: "ui.longTermMemory.whatsnew.peopleTitle",
    textKey: "ui.longTermMemory.whatsnew.peopleText",
    confirmKey: "ui.longTermMemory.people.confirm",
    checkingKey: "ui.longTermMemory.people.checking",
    emptyKey: "ui.longTermMemory.people.empty",
    failedKey: "ui.longTermMemory.people.failed",
    checkedKey: "ui.longTermMemory.people.checked",
    applyOneKey: "ui.longTermMemory.people.applyOne",
    applyOtherKey: "ui.longTermMemory.people.applyOther",
    doneOneKey: "ui.longTermMemory.people.doneOne",
    doneOtherKey: "ui.longTermMemory.people.doneOther",
    hintKey: "ui.longTermMemory.people.restoreHint",
    tickAll: false,
    preview: (response: LtmDuplicatePeoplePreviewResponse, translate) => ({
      checked: response.checked,
      total: response.total,
      truncated: response.truncated,
      next: response.next,
      failedChunks: response.failedChunks,
      rows: response.suggestions.map((suggestion) => ({
        heading: translate("ui.longTermMemory.people.heading"),
        keepLine: translate("ui.longTermMemory.tidy.keeps", { title: suggestion.keep.title }),
        marker: "people",
        items: [
          {
            id: groupKey(
              suggestion.keep.id,
              suggestion.merge.map((memory) => memory.id),
            ),
            label: translate("ui.longTermMemory.people.mergeIn", {
              titles: suggestion.merge.map((memory) => memory.title).join(", "),
            }),
          },
        ],
      })),
    }),
    body: (ids) => ({
      groups: ids.map((id) => {
        const [keepId, mergeIds] = id.split("|");
        return { keepId, mergeIds: mergeIds!.split(",") };
      }),
    }),
    changed: (response: LtmDuplicatePeopleApplyResponse) => response.merged.length,
    queries: [queryKeys.notes, queryKeys.status, queryKeys.integrity, queryKeys.activity, queryKeys.identityRepair],
  },
};

/**
 * An AI check over the vault: "Tidy with AI" archives repeats, "Link older relationships" adds links to people, "Find
 * duplicate people" merges one person saved under several names. The
 * extraction model reads the memories, and only the rows the user ticks are changed. Nothing is sent until Start; the
 * view lives inside whatever dialog or page renders it.
 */
export function TidyWithAi({ kind = "tidy", onBack }: { kind?: LtmAiCheckKind; onBack: () => void }) {
  const check = CHECKS[kind];
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [preview, setPreview] = useState<CheckPreview | null>(null);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [changedCount, setChangedCount] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  // The position the last run began after, so "Try again" after a failed next batch repeats that batch and not the first.
  const lastAfter = useRef<string | undefined>(undefined);
  // What Start will read and with which connection, fetched when the confirm view shows. A failed read shows nothing
  // extra: Start still works and reports a missing connection itself.
  const scope = useQuery({
    queryKey: [...queryKeys.root, "ai-check-scope", kind],
    queryFn: () => request<LtmAiCheckScopeResponse>(check.scopePath),
    enabled: phase === "confirm",
    retry: false,
    gcTime: 0,
  });
  const scopeConnectionId = scope.data?.connectionId ?? null;
  const connections = useQuery({ ...languageConnectionsQueryOptions, enabled: scopeConnectionId !== null });

  // Leaving while the model is reading (the dialog closes, or Back) drops the request.
  useEffect(() => () => controller.current?.abort(), []);
  // A new view takes focus: its first control, or Cancel while the model reads.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("[data-ltm-tidy-focus]")?.focus({ preventScroll: true });
  }, [phase]);

  // `after` is the position to begin after; Start begins at the first memory, "Check the next batch" after the last one read.
  const start = async (after?: string) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    lastAfter.current = after;
    setMessage("");
    setPhase("checking");
    try {
      const response = await request<never>(
        check.previewPath,
        "POST",
        after === undefined ? undefined : { after },
        current.signal,
      );
      if (current.signal.aborted) return;
      const next = check.preview(response, localizeUi);
      setPreview(next);
      setTicked(new Set(check.tickAll ? next.rows.flatMap((row) => row.items.map((item) => item.id)) : []));
      setPhase(next.rows.length ? "results" : "empty");
    } catch (error) {
      if (current.signal.aborted) return;
      setMessage(errorMessage(error, localizeUi(check.failedKey)));
      setPhase("error");
    }
  };
  const cancel = () => {
    controller.current?.abort();
    setPhase("confirm");
  };
  const apply = async () => {
    if (saving || !ticked.size) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await request<never>(check.applyPath, "POST", check.body([...ticked]));
      setChangedCount(check.changed(response));
      setPhase("done");
      await invalidateLtmQueries(queryClient, [...check.queries]);
    } catch (error) {
      setMessage(errorMessage(error, localizeUi(check.failedKey)));
    } finally {
      setSaving(false);
    }
  };
  const toggle = (id: string) =>
    setTicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const plural = (count: number, one: string, other: string) =>
    localizeUi(selectLtmPluralForm(locale, count) === "one" ? one : other, { count });
  // Wait for the connection list before naming a connection, so the line does not change its words once it shows.
  const scopeReady = scope.data && (scopeConnectionId === null || !connections.isPending);
  const scopeConnection = scopeConnectionId
    ? (connections.data?.find((connection) => connection.id === scopeConnectionId) ?? null)
    : null;
  const scopeName = scopeConnection ? connectionLabel(scopeConnection) : (scope.data?.model ?? null);
  const scopeLine = scopeReady
    ? [
        scopeName ? localizeUi("ui.longTermMemory.tidy.scopeUses", { connection: scopeName }) : null,
        plural(scope.data.count, check.scopeOneKey, check.scopeOtherKey),
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  // Offered after a check that stopped at its call limit, on the cut-short note and again once Apply is done.
  const nextAfter = preview?.next ?? null;
  const nextButton =
    nextAfter !== null ? (
      <Button
        data-ltm-tidy-next
        onClick={() => {
          if (!saving) void start(nextAfter);
        }}
        {...lockedActionProps(saving)}
      >
        {localizeUi("ui.longTermMemory.tidy.nextBatch")}
      </Button>
    ) : null;
  const checkedLine =
    preview && (preview.truncated || preview.failedChunks > 0) ? (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi(check.checkedKey, { checked: preview.checked, total: preview.total })}
        </p>
        {nextButton}
      </div>
    ) : null;
  const back = (
    <Button data-ltm-tidy-back onClick={onBack}>
      {localizeUi("ui.longTermMemory.longtermmemorydetail.back")}
    </Button>
  );
  const lock = lockedActionProps(saving);

  return (
    <div ref={root} data-ltm-ai-check={kind} data-ltm-tidy-state={phase} className="space-y-3">
      {phase === "confirm" ? (
        <>
          <p className="text-sm text-[var(--foreground)]">{localizeUi(check.confirmKey)}</p>
          {/* Always present, one line tall, so Start does not move when the line fills in. */}
          <p data-ltm-tidy-scope className="text-xs text-[var(--muted-foreground)]" style={{ minHeight: "1rem" }}>
            {scopeLine}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {back}
            <Button primary data-ltm-tidy-start data-ltm-tidy-focus onClick={() => void start()}>
              {localizeUi("ui.longTermMemory.tidy.start")}
            </Button>
          </div>
        </>
      ) : null}
      {phase === "checking" ? (
        <>
          <StatusSurface busy>{localizeUi(check.checkingKey)}</StatusSurface>
          <div className="flex justify-end">
            <Button data-ltm-tidy-cancel data-ltm-tidy-focus onClick={cancel}>
              {localizeUi("ui.longTermMemory.memoryvault.cancel")}
            </Button>
          </div>
        </>
      ) : null}
      {phase === "results" && preview ? (
        <>
          <ul data-ltm-tidy-list className="space-y-3 overflow-y-auto" style={{ maxHeight: "min(20rem, 40vh)" }}>
            {preview.rows.map((row, index) => (
              <li key={index} data-ltm-tidy-suggestion={row.marker} className="space-y-1">
                <p className="text-xs font-semibold text-[var(--marinara-editor-accent)]">{row.heading}</p>
                {row.keepLine ? (
                  <p className="break-words text-xs text-[var(--muted-foreground)]">{row.keepLine}</p>
                ) : null}
                {row.items.map((item) => (
                  <label key={item.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className={sourceCheckboxClass}
                      data-ltm-tidy-item={item.id}
                      {...(index === 0 && item === row.items[0] ? { "data-ltm-tidy-focus": true } : {})}
                      checked={ticked.has(item.id)}
                      onChange={() => {
                        if (!saving) toggle(item.id);
                      }}
                      {...lock}
                    />
                    <span className="min-w-0 break-words">{item.label}</span>
                  </label>
                ))}
              </li>
            ))}
          </ul>
          {checkedLine}
          {message ? <StatusSurface tone="danger">{message}</StatusSurface> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {back}
            <Button primary data-ltm-tidy-apply disabled={!ticked.size} onClick={() => void apply()} {...lock}>
              {saving ? <Spinner /> : null}
              {plural(ticked.size, check.applyOneKey, check.applyOtherKey)}
            </Button>
          </div>
        </>
      ) : null}
      {phase === "empty" ? (
        <>
          <p className="text-sm text-[var(--foreground)]">{localizeUi(check.emptyKey)}</p>
          {checkedLine}
          <div className="flex justify-end">
            <Button data-ltm-tidy-focus onClick={onBack}>
              {localizeUi("ui.longTermMemory.longtermmemorydetail.back")}
            </Button>
          </div>
        </>
      ) : null}
      {phase === "error" ? (
        <>
          <StatusSurface tone="danger">{message}</StatusSurface>
          <div className="flex flex-wrap justify-end gap-2">
            {back}
            <Button primary data-ltm-tidy-focus onClick={() => void start(lastAfter.current)}>
              {localizeUi("errors.tryAgain")}
            </Button>
          </div>
        </>
      ) : null}
      {phase === "done" ? (
        <>
          <StatusSurface tone="success">{plural(changedCount, check.doneOneKey, check.doneOtherKey)}</StatusSurface>
          {changedCount && check.hintKey ? (
            <p className="text-xs text-[var(--muted-foreground)]">{localizeUi(check.hintKey)}</p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            {nextButton}
            <Button primary data-ltm-tidy-focus onClick={onBack}>
              {localizeUi("ui.longTermMemory.memoryvault.done")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** An AI check as a dialog of its own, for the Memory Vault. */
export function TidyDialog({ kind = "tidy", onClose }: { kind?: LtmAiCheckKind; onClose: () => void }) {
  const check = CHECKS[kind];
  const { t: localizeUi } = useLtmTranslation();
  const titleId = useId();
  const descriptionId = useId();
  return (
    <ModalDialog
      titleId={titleId}
      descriptionId={descriptionId}
      initialFocus="[data-ltm-tidy-focus]"
      onCancel={onClose}
      panelClassName="max-w-lg max-h-full overflow-y-auto"
      data-ltm-tidy-dialog
      data-ltm-ai-check-dialog={kind}
    >
      <h2 id={titleId} className="text-base font-semibold text-[var(--foreground)]">
        {localizeUi(check.titleKey)}
      </h2>
      <p id={descriptionId} className="text-sm text-[var(--muted-foreground)]">
        {localizeUi(check.textKey)}
      </p>
      <TidyWithAi kind={kind} onBack={onClose} />
    </ModalDialog>
  );
}
