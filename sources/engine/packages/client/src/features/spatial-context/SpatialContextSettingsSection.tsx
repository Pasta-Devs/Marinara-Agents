import type { CSSProperties } from "react";
import { AlertTriangle, ChevronRight, Map, MapPin } from "lucide-react";
import { ChatSettingsSection } from "../chat-settings/ChatSettingsSection";
import { useSpatialContext } from "../../hooks/use-spatial-context";

interface SpatialContextSettingsSectionProps {
  chatId: string;
  style?: CSSProperties;
  onOpenEditor: () => void;
}

export function SpatialContextSettingsSection({ chatId, style, onOpenEditor }: SpatialContextSettingsSectionProps) {
  const spatial = useSpatialContext(chatId);
  const definition = spatial.data?.definition ?? null;
  const activeCount = definition?.locations.filter((location) => location.status === "active").length ?? 0;
  const archivedCount = definition?.locations.filter((location) => location.status === "archived").length ?? 0;
  const breadcrumb = spatial.data?.breadcrumb.map((item) => item.name).join(" / ") ?? "";

  return (
    <ChatSettingsSection
      label="Hierarchical map"
      icon={<Map size="0.875rem" />}
      count={activeCount}
      help="Give the AI spatial orientation with nested locations. Only the current location context is active during a chat."
      style={style}
    >
      {spatial.isLoading ? (
        <div className="space-y-2" aria-label="Loading hierarchical map summary">
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
            <MapPin size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
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
              <p className="mt-1 truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                {breadcrumb || (activeCount > 0 ? "No current location" : "Create a starting location")}
              </p>
              <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
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
            {definition ? "Edit hierarchical map" : "Create hierarchical map"}
            <ChevronRight size="0.8125rem" />
          </button>
        </div>
      )}
    </ChatSettingsSection>
  );
}
