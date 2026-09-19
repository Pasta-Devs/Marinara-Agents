import { SlurpFollowUpItem } from "./SlpThreadChrome";
import { SLURP_MEMORY_TIER_LIMIT } from "./SlpMessages";
import {
  ArrowDown,
  ArrowLeft,
  Brain,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  Info,
  Link,
  Loader2,
  Lock,
  MessageCircle,
  Megaphone,
  Moon,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { SlurpComposeTarget } from "../../features/messages/slp-messages-contract";
import { useOpenSlurpCreatorThread, useSlurpComposeTargets } from "../../features/messages/slp-messages-hooks";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import {
  CommissionRequest,
  CommissionRow,
  isCommissionRequest,
  SlurpCommissionsPanel,
} from "./commissions/SlpCommissions";
import { NoodleAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { getApiErrorMessage } from "../../../lib/api-client";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../base/chrome/SlpChrome";
import { SlurpEmptyArtwork } from "../../base/chrome/SlpEmptyArtwork";
import { formatTime } from "../../base/ui/slp-date-time";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import { useCreateSlurpCommission } from "../../features/messages/commissions/slp-commission-hooks";
import type { SlurpMessage, SlurpThread, SlurpThreadRelationship } from "../../features/messages/slp-messages-contract";
import {
  useBroadcastSlurpMessage,
  useCancelSlurpFollowUp,
  useDraftSlurpCreatorReply,
  useForceSlurpReply,
  useGenerateSlurpViewerImage,
  useReactToSlurpMessage,
  useRequestSlurpReply,
  useResetSlurpThread,
  useResolveSlurpMessageRequest,
  useSendSlurpCreatorImage,
  useSendSlurpCreatorPpv,
  useSendSlurpCreatorReply,
  useSendSlurpMessage,
  useSendSlurpViewerImage,
  useSetSlurpThreadNotes,
  useSlurpCheatDirective,
  useTipInSlurpThread,
  useUnlockSlurpMessage,
} from "../../features/messages/slp-message-action-hooks";
import {
  useSlurpCompose,
  useSlurpMessagePrompt,
  useSlurpOlderMessages,
  useSlurpThread,
  useSlurpThreads,
} from "../../features/messages/slp-messages-hooks";
import { useSlurpSettings, useUpdateSlurpSettings } from "../../features/settings/slp-settings-contract";
import {
  SlurpPromptDebugPanel,
  SlurpRapportBadge,
  SlurpRelationshipPanel,
  SlurpTierLadder,
  useDismissablePopover,
} from "./SlpMessageInsights";

// What a Creator remembers about the viewer, and the editor for one memory.

export function SlurpMemoriesPanel({
  notes,
  scheduledFollowUps,
  threadId,
  personaId,
  onOpenPrompt,
}: {
  notes: { id: string; text: string; tier: "working" | "longterm" }[];
  scheduledFollowUps?: Array<{
    id: string;
    scheduledAt: string;
    type: string;
    reason: string;
    context: string;
    sequenceNumber?: number;
    totalInSequence?: number;
  }>;
  threadId: string | null;
  personaId: string | null;
  onOpenPrompt: (() => void) | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const setNotes = useSetSlurpThreadNotes();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [addingTier, setAddingTier] = useState<"working" | "longterm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editable = Boolean(threadId && personaId);

  const write = (next: { id?: string; text: string; tier: "working" | "longterm" }[]) => {
    if (!threadId || !personaId) return;
    setError(null);
    setNotes
      .mutateAsync({ threadId, personaId, notes: next })
      .then(() => {
        setEditingId(null);
        setAddingTier(null);
        setDraft("");
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi("ui.slurp.messages.memoryFailed", { defaultValue: "Could not save that memory." }),
        ),
      );
  };

  const tierRows = (tier: "working" | "longterm") => notes.filter((note) => note.tier === tier);

  const section = (tier: "working" | "longterm", title: string, hint: string) => {
    const rows = tierRows(tier);
    return (
      <section className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-black">
            {title}{" "}
            <span className="font-normal text-[var(--muted-foreground)]">
              {rows.length}/{SLURP_MEMORY_TIER_LIMIT}
            </span>
          </h3>
          <button
            type="button"
            disabled={!editable || setNotes.isPending || rows.length >= SLURP_MEMORY_TIER_LIMIT}
            onClick={() => {
              setAddingTier(tier);
              setEditingId(null);
              setDraft("");
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[0.7rem] font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
          >
            <Plus size={13} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.memoryAdd", { defaultValue: "Add" })}
          </button>
        </div>
        <p className="mt-0.5 text-[0.65rem] text-[var(--muted-foreground)]">{hint}</p>
        <ul className="mt-2 space-y-1.5">
          {rows.length === 0 && addingTier !== tier && (
            <li className="text-[0.7rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.memoryNone", { defaultValue: "Nothing remembered here yet." })}
            </li>
          )}
          {rows.map((note) =>
            editingId === note.id ? (
              <li key={note.id}>
                <MemoryEditor
                  value={draft}
                  pending={setNotes.isPending}
                  onChange={setDraft}
                  onCancel={() => setEditingId(null)}
                  onSave={() =>
                    write(notes.map((entry) => (entry.id === note.id ? { ...entry, text: draft.trim() } : entry)))
                  }
                />
              </li>
            ) : (
              <li
                key={note.id}
                className="flex items-start gap-1.5 rounded-xl bg-[var(--slurp-surface)] px-2.5 py-1.5 text-xs leading-snug"
              >
                <span className="min-w-0 flex-1 break-words">{note.text}</span>
                <button
                  type="button"
                  disabled={!editable || setNotes.isPending}
                  onClick={() => {
                    setEditingId(note.id);
                    setAddingTier(null);
                    setDraft(note.text);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
                  aria-label={localizeUi("ui.slurp.messages.memoryEdit", { defaultValue: "Edit memory" })}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!editable || setNotes.isPending}
                  onClick={() => write(notes.filter((entry) => entry.id !== note.id))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40 dark:text-red-400"
                  aria-label={localizeUi("ui.slurp.messages.memoryDelete", { defaultValue: "Forget this" })}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            ),
          )}
          {addingTier === tier && (
            <li>
              <MemoryEditor
                value={draft}
                pending={setNotes.isPending}
                onChange={setDraft}
                onCancel={() => setAddingTier(null)}
                onSave={() => write([...notes, { text: draft.trim(), tier }])}
              />
            </li>
          )}
        </ul>
      </section>
    );
  };

  return (
    <div className="divide-y divide-[var(--noodle-divider)]">
      {error && (
        <p role="alert" className="px-4 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {section(
        "working",
        localizeUi("ui.slurp.messages.memoryWorking", { defaultValue: "Working memory" }),
        localizeUi("ui.slurp.messages.memoryWorkingHint", { defaultValue: "Recent. These change as you talk." }),
      )}
      {section(
        "longterm",
        localizeUi("ui.slurp.messages.memoryLongTerm", { defaultValue: "Long-term memory" }),
        localizeUi("ui.slurp.messages.memoryLongTermHint", {
          defaultValue: "The stable facts. These stay until something updates them.",
        }),
      )}
      {scheduledFollowUps && scheduledFollowUps.length > 0 && (
        <section className="px-4 py-3">
          <h3 className="pb-2 text-[0.65rem] font-black uppercase tracking-wider text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.scheduledFollowUps", { defaultValue: "Scheduled follow-ups" })}
          </h3>
          <p className="pb-2 text-[0.65rem] leading-snug text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.scheduledFollowUpsHint", {
              defaultValue: "Messages the Creator will send proactively.",
            })}
          </p>
          <ul className="space-y-1.5">
            {scheduledFollowUps.map((followUp) => (
              <SlurpFollowUpItem
                key={followUp.id}
                followUp={followUp}
                threadId={threadId}
                personaId={personaId}
                editable={editable}
              />
            ))}
          </ul>
        </section>
      )}
      {onOpenPrompt && (
        <section className="px-4 py-3">
          <button
            type="button"
            onClick={onOpenPrompt}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            <Search size={14} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.promptDetails", { defaultValue: "Prompt details" })}
          </button>
          <p className="mt-1.5 text-[0.65rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.promptPreviewHint", {
              defaultValue: "Exactly what is sent to the model for the next reply.",
            })}
          </p>
        </section>
      )}
    </div>
  );
}

/** One memory being written or corrected. Bounded here as well as on the server. */
export function MemoryEditor({
  value,
  pending,
  onChange,
  onCancel,
  onSave,
}: {
  value: string;
  pending: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-[var(--slurp-surface-raised)] p-2">
      <label className="sr-only" htmlFor="slurp-memory-text">
        {localizeUi("ui.slurp.messages.memoryText", { defaultValue: "Memory" })}
      </label>
      <textarea
        id="slurp-memory-text"
        autoFocus
        rows={2}
        maxLength={160}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={localizeUi("ui.slurp.messages.memoryPlaceholder", {
          defaultValue: "Something they know about you…",
        })}
        className="w-full resize-y rounded-lg bg-[var(--slurp-surface)] px-2.5 py-2 text-base outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-xs"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending || !value.trim()}
          onClick={onSave}
          className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-[0.7rem] font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-40"
        >
          {localizeUi("ui.slurp.messages.memorySave", { defaultValue: "Save" })}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 rounded-lg px-3 text-[0.7rem] font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]"
        >
          {localizeUi("ui.slurp.messages.memoryCancel", { defaultValue: "Cancel" })}
        </button>
      </div>
    </div>
  );
}

/** The Creator's avatar asleep: a slow breathing glow, a moon, and three rising motes. */
