import {
  BookOpen,
  Check,
  ChevronLeft,
  Maximize2,
  MessageSquareQuote,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { MemoryNagVault } from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { memoryNagRequest } from "./api";
import { useMemoryNagTranslation } from "./localization";
import type { CapabilityProps, MemoryNagMemory, MemoryNagParticipant } from "./types";

type MemoryDraft = {
  id?: string;
  text: string;
  characterIds: string[];
};

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalDialog(active: boolean, onClose: () => void, restoreSelector?: string, restoreFocus = true) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusFrame = requestAnimationFrame(() => (dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog).focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (focusable[0] ?? dialog).focus();
        return;
      }
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      if (!restoreFocus) return;
      requestAnimationFrame(() => {
        const requestedTarget = restoreSelector ? document.querySelector<HTMLElement>(restoreSelector) : previousFocus;
        const restoreTarget =
          requestedTarget?.isConnected === true
            ? requestedTarget
            : document.querySelector<HTMLElement>('.mn-modal[role="dialog"]');
        restoreTarget?.focus();
      });
    };
  }, [active, restoreFocus, restoreSelector]);

  return dialogRef;
}

function MemoryEditor({
  chatId,
  participants,
  memory,
  onClose,
  onExpandedChange,
  onSaved,
}: {
  chatId: string;
  participants: MemoryNagParticipant[];
  memory: MemoryNagMemory | null;
  onClose: () => void;
  onExpandedChange: (expanded: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useMemoryNagTranslation();
  const [draft, setDraft] = useState<MemoryDraft>({
    id: memory?.id,
    text: memory?.text ?? "",
    characterIds: memory?.characterIds ?? [],
  });
  const [expanded, setExpanded] = useState(false);
  const [macrosOpen, setMacrosOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const expandedDialogRef = useModalDialog(expanded, () => setExpanded(false), "#mn-memory-nag-expand-button");

  useEffect(() => onExpandedChange(expanded), [expanded, onExpandedChange]);

  const insertMacro = (macro: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.text.length;
    const end = textarea?.selectionEnd ?? start;
    const text = `${draft.text.slice(0, start)}${macro}${draft.text.slice(end)}`;
    setDraft((current) => ({ ...current, text }));
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + macro.length, start + macro.length);
    });
  };

  const save = async () => {
    if (!draft.text.trim()) return;
    if (draft.characterIds.length === 0) {
      setMessage(t("memoryNag.vault.chooseCharacter"));
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const path = draft.id
        ? `/memories/${encodeURIComponent(chatId)}/${encodeURIComponent(draft.id)}`
        : `/memories/${encodeURIComponent(chatId)}`;
      await memoryNagRequest(path, draft.id ? "PATCH" : "POST", {
        text: draft.text,
        characterIds: draft.characterIds,
      });
      await onSaved();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const editor = (
    <div className="mn-stack">
      <div className="mn-row mn-between">
        <strong>{t(memory ? "memoryNag.vault.editorEdit" : "memoryNag.vault.editorNew")}</strong>
        <button
          type="button"
          className="mari-chrome-control mari-chrome-control--small mn-modal-close"
          onClick={onClose}
          aria-label={t("memoryNag.vault.cancel")}
        >
          <X className="mn-icon" aria-hidden="true" />
        </button>
      </div>
      <div className="mn-label">
        <span>{t("memoryNag.vault.memory")}</span>
        <div className="mn-prompt-field">
          <textarea
            ref={textareaRef}
            className="mari-chrome-field mn-field mn-textarea mn-vault-textarea"
            value={draft.text}
            maxLength={500}
            placeholder={t("memoryNag.vault.memoryPlaceholder")}
            onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
          />
          <div className="mn-prompt-tools">
            {!expanded ? (
              <button
                id="mn-memory-nag-expand-button"
                type="button"
                className="mn-prompt-tool"
                onClick={() => {
                  setMacrosOpen(false);
                  setExpanded(true);
                }}
                title={t("memoryNag.vault.expand")}
                aria-label={t("memoryNag.vault.expand")}
              >
                <Maximize2 className="mn-icon" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="mn-prompt-tool"
              onClick={() => setMacrosOpen((open) => !open)}
              title={t("memoryNag.vault.macros")}
              aria-label={t("memoryNag.vault.macros")}
              aria-expanded={macrosOpen}
            >
              <BookOpen className="mn-icon" aria-hidden="true" />
            </button>
          </div>
          {macrosOpen ? (
            <div className="mn-vault-macro-menu" aria-label={t("memoryNag.vault.macros")}>
              {["{{char}}", "{{user}}"].map((macro) => (
                <button
                  key={macro}
                  type="button"
                  className="mari-chrome-control mari-chrome-control--small"
                  onClick={() => {
                    insertMacro(macro);
                    setMacrosOpen(false);
                  }}
                >
                  {macro}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <fieldset className="mn-stack">
        <legend className="mn-muted">{t("memoryNag.vault.characters")}</legend>
        <div className="mn-checks">
          {participants.map((participant) => (
            <label className="mn-check" key={participant.id}>
              <input
                type="checkbox"
                checked={draft.characterIds.includes(participant.id)}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    characterIds: event.target.checked
                      ? [...new Set([...current.characterIds, participant.id])]
                      : current.characterIds.filter((id) => id !== participant.id),
                  }))
                }
              />
              <span>{participant.name}</span>
              {!participant.current ? <small>({t("memoryNag.vault.pastParticipant")})</small> : null}
            </label>
          ))}
        </div>
      </fieldset>
      {message ? (
        <div className="mn-status" role="alert">
          {message}
        </div>
      ) : null}
      <div className="mn-actions">
        <button
          type="button"
          className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--small"
          disabled={saving}
          onClick={() => void save()}
        >
          <Check className="mn-icon" aria-hidden="true" />
          {t("memoryNag.vault.save")}
        </button>
        <button
          type="button"
          className="mari-chrome-control mari-chrome-control--small"
          disabled={saving}
          onClick={onClose}
        >
          {t("memoryNag.vault.cancel")}
        </button>
      </div>
    </div>
  );

  if (!expanded) return <section className="mn-panel">{editor}</section>;
  return createPortal(
    <div
      className="mn-overlay mari-modal"
      role="presentation"
      data-chat-floating-panel
      onClick={() => setExpanded(false)}
    >
      <section
        ref={expandedDialogRef}
        className="mn-modal mn-shell mari-modal-panel marinara-chat-popover"
        role="dialog"
        aria-modal="true"
        aria-label={t("memoryNag.vault.expandedTitle")}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mn-modal-head marinara-chat-popover__header">
          <strong>{t("memoryNag.vault.expandedTitle")}</strong>
          <button
            type="button"
            className="mari-chrome-control mari-chrome-control--small"
            onClick={() => setExpanded(false)}
          >
            <ChevronLeft className="mn-icon" aria-hidden="true" />
            {t("memoryNag.vault.collapse")}
          </button>
        </div>
        <div className="mn-modal-body marinara-chat-popover__scroll">{editor}</div>
      </section>
    </div>,
    document.body,
  );
}

export function MemoryNagVaultModal({ props, onClose }: { props: CapabilityProps; onClose: () => void }) {
  const { t } = useMemoryNagTranslation();
  const chatId = props.chatId ?? "";
  const [status, setStatus] = useState<"active" | "resolved">("active");
  const [characterId, setCharacterId] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MemoryNagMemory | "new" | null>(null);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const vaultDialogRef = useModalDialog(!editorExpanded, onClose, undefined, false);

  useEffect(() => {
    const restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      requestAnimationFrame(() => {
        if (restoreTarget?.isConnected) restoreTarget.focus();
      });
    };
  }, []);
  const vault = useQuery({
    enabled: Boolean(chatId),
    queryKey: ["memory-nag", "vault", chatId],
    queryFn: () => memoryNagRequest<MemoryNagVault>(`/vault/${encodeURIComponent(chatId)}`),
  });
  const participantQuery = useQuery({
    enabled: Boolean(chatId),
    queryKey: ["memory-nag", "participants", chatId],
    queryFn: () => memoryNagRequest<MemoryNagParticipant[]>(`/participants/${encodeURIComponent(chatId)}`),
  });
  const participants = useMemo(
    () => participantQuery.data ?? vault.data?.participants ?? [],
    [participantQuery.data, vault.data?.participants],
  );
  const participantsById = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );
  const memories = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (vault.data?.memories ?? []).filter(
      (memory) =>
        memory.status === status &&
        (!characterId || memory.characterIds.includes(characterId)) &&
        (!needle || memory.text.toLocaleLowerCase().includes(needle)),
    );
  }, [characterId, search, status, vault.data?.memories]);

  const updateMemory = async (memory: MemoryNagMemory, patch: Record<string, unknown>) => {
    setMessage("");
    try {
      await memoryNagRequest(
        `/memories/${encodeURIComponent(chatId)}/${encodeURIComponent(memory.id)}`,
        "PATCH",
        patch,
      );
      await vault.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const removeMemory = async (memory: MemoryNagMemory) => {
    const confirmed = props.confirmAction
      ? await props.confirmAction({
          title: t("memoryNag.vault.deleteTitle"),
          message: t("memoryNag.vault.deleteMessage"),
          confirmLabel: t("memoryNag.vault.delete"),
          tone: "destructive",
        })
      : window.confirm(t("memoryNag.vault.deleteMessage"));
    if (!confirmed) return;
    setMessage("");
    try {
      await memoryNagRequest(`/memories/${encodeURIComponent(chatId)}/${encodeURIComponent(memory.id)}`, "DELETE");
      await vault.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return createPortal(
    <div className="mn-overlay mari-modal" role="presentation" data-chat-floating-panel>
      <section
        ref={vaultDialogRef}
        className="mn-modal mn-shell mari-modal-panel marinara-chat-popover"
        role={editorExpanded ? undefined : "dialog"}
        aria-modal={editorExpanded ? undefined : true}
        aria-hidden={editorExpanded || undefined}
        aria-label={editorExpanded ? undefined : t("memoryNag.vault.title")}
        tabIndex={editorExpanded ? undefined : -1}
      >
        <div className="mn-modal-head marinara-chat-popover__header">
          <div className="mn-row mn-modal-title marinara-chat-popover__title">
            <MessageSquareQuote className="mn-icon" aria-hidden="true" />
            <strong>{t("memoryNag.vault.title")}</strong>
          </div>
          <button
            type="button"
            className="mari-chrome-control mari-chrome-control--small mn-modal-close"
            onClick={onClose}
            aria-label={t("memoryNag.vault.close")}
          >
            <X className="mn-icon" aria-hidden="true" />
          </button>
        </div>
        <div className="mn-modal-body mn-stack marinara-chat-popover__scroll">
          <div className="mn-row mn-between">
            <div className="mn-tabs" role="tablist">
              {(["active", "resolved"] as const).map((tab) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={status === tab}
                  className="mari-chrome-control mari-chrome-control--small mn-tab"
                  key={tab}
                  onClick={() => setStatus(tab)}
                >
                  {t(`memoryNag.vault.${tab}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--small"
              onClick={() => setEditing("new")}
            >
              <Plus className="mn-icon" aria-hidden="true" />
              {t("memoryNag.vault.add")}
            </button>
          </div>
          <div className="mn-grid">
            <select
              className="mari-chrome-field mn-field"
              value={characterId}
              onChange={(event) => setCharacterId(event.target.value)}
            >
              <option value="">{t("memoryNag.vault.allCharacters")}</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                  {participant.current ? "" : ` (${t("memoryNag.vault.pastParticipant")})`}
                </option>
              ))}
            </select>
            <input
              type="search"
              className="mari-chrome-field mn-field"
              value={search}
              placeholder={t("memoryNag.vault.search")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {editing ? (
            <MemoryEditor
              key={editing === "new" ? "new" : editing.id}
              chatId={chatId}
              participants={participants}
              memory={editing === "new" ? null : editing}
              onClose={() => {
                setEditing(null);
                setEditorExpanded(false);
              }}
              onExpandedChange={setEditorExpanded}
              onSaved={async () => {
                await vault.refetch();
              }}
            />
          ) : null}
          {message ? (
            <div className="mn-status" role="alert">
              {message}
            </div>
          ) : null}
          {vault.isLoading ? <div className="mn-status">{t("memoryNag.vault.loading")}</div> : null}
          {!vault.isLoading && memories.length === 0 ? (
            <div className="mn-status">{t("memoryNag.vault.empty")}</div>
          ) : null}
          {memories.map((memory) => (
            <article className="mn-memory" key={memory.id}>
              <div className="mn-memory-text">{memory.text}</div>
              <div className="mn-tags">
                {memory.characterIds.map((id) => (
                  <span className="mn-tag" key={id}>
                    {participantsById.get(id)?.name ?? id}
                  </span>
                ))}
              </div>
              <div className="mn-actions">
                <button
                  type="button"
                  className="mari-chrome-control mari-chrome-control--small"
                  onClick={() => setEditing(memory)}
                >
                  <Pencil className="mn-icon" aria-hidden="true" />
                  {t("memoryNag.vault.edit")}
                </button>
                <button
                  type="button"
                  className="mari-chrome-control mari-chrome-control--small"
                  onClick={() =>
                    void updateMemory(memory, { status: memory.status === "active" ? "resolved" : "active" })
                  }
                >
                  {memory.status === "active" ? (
                    <Check className="mn-icon" aria-hidden="true" />
                  ) : (
                    <RotateCcw className="mn-icon" aria-hidden="true" />
                  )}
                  {t(memory.status === "active" ? "memoryNag.vault.resolve" : "memoryNag.vault.restore")}
                </button>
                <button
                  type="button"
                  className="mari-chrome-control mari-chrome-control--danger mari-chrome-control--small"
                  onClick={() => void removeMemory(memory)}
                >
                  <Trash2 className="mn-icon" aria-hidden="true" />
                  {t("memoryNag.vault.delete")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
