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
import {
  SlurpPromptDebugPanel,
  SlurpRapportBadge,
  SlurpRelationshipPanel,
  SlurpTierLadder,
  useDismissablePopover,
} from "./SlpMessageInsights";
import { SlurpMemoriesPanel } from "./SlpMemoriesPanel";
import { CommissionRequest, CommissionRow, isCommissionRequest, SlurpCommissionsPanel } from "./commissions/SlpCommissions";
import { Avatar } from "../../base/chrome/SlpChrome";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import type { SlurpThreadViewModel } from "./slp-thread-actions";

/** The conversation drawer: details, memories, commissions and the prompt. */
export function SlpThreadDrawer({ model }: { model: SlurpThreadViewModel }) {
  const {
    closeDrawer,
    commissions,
    drawerMode,
    drawerRef,
    headerAccount,
    headerProfileId,
    localizeUi,
    onOpenProfile,
    ownsCreator,
    personaId,
    promptDebug,
    promptDebugEnabled,
    relationship,
    resetThread,
    setCommissionPrefill,
    setDrawerMode,
    setError,
    setToolTab,
    setToolsOpen,
    thread,
    threadId,
  } = model;

  return (
    <>
  <dialog
    ref={drawerRef}
    onClose={closeDrawer}
    onCancel={(event) => {
      event.preventDefault();
      closeDrawer();
    }}
    onClick={(event) => {
      if (event.target === event.currentTarget) closeDrawer();
    }}
    aria-labelledby="slurp-conversation-drawer-title"
    className="fixed inset-x-0 bottom-0 top-auto m-0 ms-auto h-auto max-h-[82dvh] w-full max-w-none overflow-hidden rounded-t-2xl bg-[var(--slurp-canvas,var(--background))] p-0 text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] backdrop:bg-black/55 md:inset-y-0 md:end-0 md:start-auto md:h-full md:max-h-none md:w-[min(28rem,92vw)] md:rounded-none md:rounded-s-2xl"
  >
    <div className="flex max-h-[82dvh] min-h-0 flex-col overscroll-contain md:h-full md:max-h-none">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-[var(--noodle-divider)] px-4">
        {drawerMode === "prompt" && (
          <button
            type="button"
            onClick={() => setDrawerMode("memories")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            aria-label={localizeUi("ui.slurp.messages.backToMemories", { defaultValue: "Back to memories" })}
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" aria-hidden="true" />
          </button>
        )}
        <h2 id="slurp-conversation-drawer-title" className="min-w-0 flex-1 truncate text-sm font-black">
          {drawerMode === "prompt"
            ? localizeUi("ui.slurp.messages.promptDetails", { defaultValue: "Prompt details" })
            : drawerMode === "memories"
              ? localizeUi("ui.slurp.messages.memories", { defaultValue: "Memories" })
              : drawerMode === "commissions"
                ? localizeUi("ui.slurp.messages.commissionsTitle", { defaultValue: "Commissions" })
                : localizeUi("ui.slurp.messages.details", { defaultValue: "Details" })}
        </h2>
        <button
          type="button"
          onClick={closeDrawer}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
          aria-label={localizeUi("ui.slurp.messages.closeDetails", { defaultValue: "Close details" })}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        {drawerMode === "prompt" ? (
          <SlurpPromptDebugPanel enabled={promptDebugEnabled} query={promptDebug} />
        ) : drawerMode === "memories" ? (
          <SlurpMemoriesPanel
            notes={relationship?.notes ?? []}
            scheduledFollowUps={relationship?.scheduledFollowUps}
            threadId={threadId}
            personaId={personaId}
            onOpenPrompt={threadId ? () => setDrawerMode("prompt") : null}
          />
        ) : drawerMode === "commissions" ? (
          <SlurpCommissionsPanel
            commissions={commissions}
            personaId={personaId}
            ownsCreator={ownsCreator}
            onAskCommission={
              ownsCreator
                ? null
                : () => {
                    closeDrawer();
                    setCommissionPrefill("");
                    setToolsOpen(true);
                    setToolTab("commission");
                  }
            }
          />
        ) : (
          <>
            {headerAccount && (
              <section className="flex items-center gap-3 px-4 py-4">
                <Avatar account={headerAccount} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{headerAccount.displayName}</p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">@{headerAccount.handle}</p>
                  {thread && <SlurpRapportBadge rapport={thread.rapport} ownsCreator={ownsCreator} />}
                </div>
                {headerProfileId && (
                  <button
                    type="button"
                    onClick={() => onOpenProfile(headerProfileId)}
                    className="min-h-10 shrink-0 rounded-xl px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    {localizeUi("ui.slurp.messages.viewProfile", { defaultValue: "View profile" })}
                  </button>
                )}
              </section>
            )}
            {relationship && (
              <SlurpRelationshipPanel
                relationship={relationship}
                resetting={resetThread.isPending}
                onReset={
                  threadId && personaId
                    ? () => {
                        setError(null);
                        void showConfirmDialog({
                          title: localizeUi("ui.slurp.messages.resetTitle", {
                            defaultValue: "Clear this conversation?",
                          }),
                          message: localizeUi("ui.slurp.messages.resetDetail", {
                            defaultValue:
                              "Every message here is deleted, and any unfinished commission is closed. What they remember of you is kept, and so are coins, unlocks and finished commissions. This cannot be undone.",
                          }),
                          confirmLabel: localizeUi("ui.slurp.messages.resetConfirm", {
                            defaultValue: "Clear it",
                          }),
                        })
                          .then((confirmed) => {
                            if (confirmed) return resetThread.mutateAsync({ threadId, personaId });
                          })
                          .catch((cause: unknown) =>
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : localizeUi("ui.slurp.messages.resetFailed", {
                                    defaultValue: "Could not clear this conversation.",
                                  }),
                            ),
                          );
                      }
                    : null
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  </dialog>
    </>
  );
}
