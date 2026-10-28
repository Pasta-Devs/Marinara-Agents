import { ArrowLeft, X } from "lucide-react";
import { SlpStoryRingAvatar } from "../../modules/story/SlpStoryRing";
import { SlurpPromptDebugPanel, SlurpRelationshipPanel } from "./SlpMessageInsights";
import { SlpDeskCaseFile } from "../../modules/desk/SlpDeskCaseFile";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { SlurpMemoriesPanel } from "./SlpMemoriesPanel";
import { SlpYouTwo } from "../stir/slp-stir-contract";
import { SlurpThreadRequestsPanel } from "./SlpThreadRequestsPanel";
import { SlurpCommissionsPanel } from "./commissions/SlpCommissions";
import { Avatar, SLP_BAR_GLASS_CLASS, useSlpMediaQuery } from "../../base/chrome/SlpChrome";
import { cn } from "../../../lib/utils";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import type { SlurpThreadViewModel } from "./slp-thread-actions";

/**
 * Details, Memories, Commissions and the prompt. Phones and tablets get an SlpSheet; a desktop
 * docks it as a column beside the chat, so the conversation stays readable while it is open.
 */
export function SlpThreadDrawer({ model }: { model: SlurpThreadViewModel }) {
  const {
    closeDrawer,
    commissions,
    targetCreatorAccountId,
    drawerMode,
    headerAccount,
    headerProfileId,
    localizeUi,
    onOpenProfile,
    ownsCreator,
    personaId,
    promptDebug,
    promptDebugEnabled,
    relationship,
    setCommissionPrefill,
    setDrawerMode,
    setToolTab,
    setToolsOpen,
    threadId: threadIdProp,
    thread,
  } = model;
  const threadId = thread?.id ?? threadIdProp;
  const settings = model.settingsQuery.data;
  const deskOn = !settings || slpExtensionOn(settings, "supportDesk");
  const docked = useSlpMediaQuery("(min-width: 1280px)");
  const title =
    drawerMode === "prompt"
      ? localizeUi("ui.slurp.messages.promptDetails", { defaultValue: "Prompt details" })
      : drawerMode === "memories"
        ? localizeUi("ui.slurp.messages.memories", { defaultValue: "Memories" })
        : drawerMode === "commissions"
          ? localizeUi("ui.slurp.messages.commissionsTitle", { defaultValue: "Commissions" })
          : localizeUi("ui.slurp.messages.details", { defaultValue: "Details" });

  const body =
    drawerMode === "prompt" ? (
      <>
        <SlpButton variant="tertiary" onClick={() => setDrawerMode("memories")} className="ms-1 mt-1 text-[13px]">
          <ArrowLeft size={16} className="rtl:-scale-x-100" aria-hidden="true" />
          {localizeUi("ui.slurp.messages.backToMemories", { defaultValue: "Back to memories" })}
        </SlpButton>
        <SlurpPromptDebugPanel enabled={promptDebugEnabled} query={promptDebug} />
      </>
    ) : drawerMode === "memories" ? (
      <>
        <SlurpMemoriesPanel
          notes={relationship?.notes ?? []}
          scheduledFollowUps={relationship?.scheduledFollowUps}
          threadId={threadId}
          personaId={personaId}
          // The prompt route answers only on your own Creator's side of a conversation (R1-011).
          onOpenPrompt={threadId && ownsCreator ? () => setDrawerMode("prompt") : null}
        />
        {/* What the fan asked for and what was done about it. The fan's own side of the
            drawer never shows this. */}
        {ownsCreator && (
          <SlurpThreadRequestsPanel
            threadId={threadId}
            personaId={personaId}
            creatorAccountId={targetCreatorAccountId}
          />
        )}
      </>
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
          <section className="flex items-center gap-3 px-3 py-3">
            <SlpStoryRingAvatar creatorId={headerProfileId} name={headerAccount.displayName} standalone>
              <Avatar account={headerAccount} size="md" />
            </SlpStoryRingAvatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{headerAccount.displayName}</p>
              <p className="truncate text-xs text-[var(--slurp-muted)]">@{headerAccount.handle}</p>
            </div>
            {headerProfileId && (
              <SlpButton variant="quiet" onClick={() => onOpenProfile(headerProfileId)} className="px-4 text-[13px]">
                {localizeUi("ui.slurp.messages.viewProfile", { defaultValue: "View profile" })}
              </SlpButton>
            )}
          </section>
        )}
        {relationship?.desk && deskOn && (
          // Slurp Support's thread: where the Creator stands with Slurp, not a fan relationship.
          <div className="p-4">
            <SlpDeskCaseFile desk={relationship.desk} name={headerAccount?.displayName ?? ""} />
          </div>
        )}
        {/* The one she is with (or was): the two of them come first, before the fan standing. */}
        {relationship?.couple && !relationship.desk && (
          <SlpYouTwo
            couple={relationship.couple}
            name={headerAccount?.displayName ?? ""}
            creatorId={targetCreatorAccountId ?? undefined}
          />
        )}
        {relationship && !relationship.desk && (
          <SlurpRelationshipPanel
            key={threadId}
            relationship={relationship}
            threadId={threadId}
            personaId={personaId}
          />
        )}
      </>
    );

  if (!docked)
    return (
      <SlpSheet open={Boolean(drawerMode)} onClose={closeDrawer} title={title} width="max-w-lg">
        <div className="pb-2">{body}</div>
      </SlpSheet>
    );
  if (!drawerMode) return null;
  return (
    <aside
      aria-labelledby="slurp-conversation-drawer-title"
      className="flex w-[22rem] shrink-0 flex-col overflow-hidden border-s border-[var(--noodle-divider)] bg-[color-mix(in_srgb,var(--slurp-surface)_70%,transparent)]"
    >
      <header className={cn("flex min-h-14 shrink-0 items-center gap-2 ps-4 pe-1.5", SLP_BAR_GLASS_CLASS)}>
        <h2 id="slurp-conversation-drawer-title" className="min-w-0 flex-1 truncate text-[15px] font-bold">
          {title}
        </h2>
        <button
          type="button"
          onClick={closeDrawer}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--slurp-muted)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current"
          aria-label={localizeUi("ui.slurp.messages.closeDetails", { defaultValue: "Close details" })}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-4">{body}</div>
    </aside>
  );
}
