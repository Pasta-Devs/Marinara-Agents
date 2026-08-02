import { useState, type CSSProperties } from "react";
import { AlertTriangle, ChevronRight, MapPin } from "lucide-react";
import { useSpatialContext } from "../../hooks/use-spatial-context";

interface SpatialContextSettingsSectionProps {
  chatId: string;
  style?: CSSProperties;
  enabledForChat: boolean;
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
  onOpenEditor: () => void;
}

export function SpatialContextSettingsSection({
  chatId,
  style,
  enabledForChat,
  onEnabledForChatChange,
  onOpenEditor,
}: SpatialContextSettingsSectionProps) {
  const spatial = useSpatialContext(chatId);
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const definition = spatial.data?.definition ?? null;
  const activeCount = definition?.locations.filter((location) => location.status === "active").length ?? 0;
  const archivedCount = definition?.locations.filter((location) => location.status === "archived").length ?? 0;
  const breadcrumb = spatial.data?.breadcrumb.map((item) => item.name).join(" / ") ?? "";
  const toggleForChat = async () => {
    if (!onEnabledForChatChange || activationPending) return;
    setActivationPending(true);
    setActivationError(null);
    try {
      await onEnabledForChatChange(!enabledForChat);
    } catch (error) {
      setActivationError(error instanceof Error ? error.message : "World Maps could not be updated for this chat.");
    } finally {
      setActivationPending(false);
    }
  };

  return (
    <div className="px-3 py-3" style={style}>
      <div className="mb-3 space-y-2">
        <button
          type="button"
          role="switch"
          aria-checked={enabledForChat}
          disabled={!onEnabledForChatChange || activationPending}
          onClick={() => void toggleForChat()}
          className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 ${
            enabledForChat
              ? "bg-[var(--primary)]/10 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] ring-[var(--border)] hover:bg-[var(--accent)]"
          }`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-[var(--foreground)]">Enable World Maps</span>
            <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
              {enabledForChat
                ? "World Maps can provide location context during generation."
                : "Turn on Maps here before creating or editing this chat's map."}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${
              enabledForChat ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50"
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                enabledForChat ? "translate-x-3.5" : ""
              }`}
            />
          </span>
        </button>
        {activationPending && (
          <p role="status" aria-live="polite" className="px-1 text-[0.625rem] text-[var(--marinara-chat-chrome-accent)]">
            Updating World Maps…
          </p>
        )}
        {activationError && (
          <p role="alert" className="rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)]">
            {activationError}
          </p>
        )}
      </div>
      {!enabledForChat ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 px-3 py-4 text-center">
          <p className="text-xs font-medium text-[var(--foreground)]">Maps is ready to add</p>
          <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
            Turn on “Enable World Maps” above to create a map or return to an existing one.
          </p>
        </div>
      ) : spatial.isLoading ? (
        <div className="space-y-2" aria-label="Loading world map summary">
          <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-12 animate-pulse rounded-lg bg-[var(--muted)]" />
        </div>
      ) : spatial.isError ? (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300" role="alert">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size="0.8125rem" /> Map summary unavailable
          </div>
          <p className="mt-1 text-red-300/80">Open the editor to retry loading this chat&apos;s map.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-3">
            <MapPin size="0.875rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">
                  {!definition ? "Not set up" : definition.enabled ? "Map enabled" : "Map disabled"}
                </span>
                {definition && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.625rem] font-medium ${
                      definition.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"
                    }`}
                  >
                    {definition.enabled ? "Active" : "Off"}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-[0.6875rem] text-[var(--marinara-chat-chrome-accent)]">
                {breadcrumb || (activeCount > 0 ? "No current location" : "Create a starting location")}
              </p>
              <p className="mt-1 text-[0.625rem] text-[var(--marinara-chat-chrome-accent)]">
                {activeCount} active{archivedCount > 0 ? `, ${archivedCount} archived` : ""}
              </p>
            </div>
          </div>
          {(spatial.data?.warnings.length ?? 0) > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[0.6875rem] text-amber-400">
              <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0" />
              <span>{spatial.data!.warnings.length} map issue(s) need review.</span>
            </div>
          )}
          <button
            type="button"
            onClick={onOpenEditor}
            className="flex min-h-11 w-full items-center justify-between rounded-lg border border-[var(--border)] px-3 text-xs font-medium transition-colors duration-200 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {definition ? "Edit world map" : "Set up world map"}
            <ChevronRight size="0.8125rem" />
          </button>
        </div>
      )}
    </div>
  );
}
