import { Loader2, RefreshCw, Trash2, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useDeleteNoodlerStageProfile,
  useNoodlerAccounts,
  useNoodlerFanActivityStatus,
  useSlurpImageConnections,
  useNoodlerReserveStatus,
  useRefreshNoodlerFanActivityNow,
  useSlurpConnections,
  useSlurpSettings,
  useUpdateNoodlerAutoPosting,
  useUpdateSlurpImageConnections,
  useUpdateSlurpSettings,
  type SlurpSettings,
} from "../../hooks/use-slurp";
import { showConfirmDialog } from "../../lib/app-dialogs";
import type { SlurpNavigationState } from "./slurp-navigation.types";

type SlurpSettingsProps = {
  navigation: Extract<SlurpNavigationState, { mode: "creator-settings" }>;
  onNavigate: (navigation: SlurpNavigationState) => void;
};

const archetypes = ["ordinary", "eccentric", "crossFandom", "raider", "organicDiscovery", "freeResource"] as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not update settings.";
}

function NumberSetting({ value, min, max, onSave }: { value: number; min: number; max: number; onSave: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (!Number.isInteger(next) || next < min || next > max) {
      setDraft(String(value));
      return;
    }
    onSave(next);
  };
  return <input type="number" min={min} max={max} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} className="h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-2 text-sm" />;
}

export function SlurpSettings({ navigation, onNavigate }: SlurpSettingsProps) {
  const { t } = useTranslation();
  const settingsQuery = useSlurpSettings();
  const updateSettings = useUpdateSlurpSettings();
  const settings = settingsQuery.data;
  const [generationGuidanceDraft, setGenerationGuidanceDraft] = useState("");
  const [imagePromptDraft, setImagePromptDraft] = useState("");
  useEffect(() => {
    if (settings) {
      setGenerationGuidanceDraft(settings.generationGuidance);
      setImagePromptDraft(settings.imageGenerationPrompt);
    }
  }, [settings?.generationGuidance, settings?.imageGenerationPrompt]);
  const section = navigation.section ?? "general";
  const save = (patch: Partial<SlurpSettings>) => updateSettings.mutate(patch, { onError: (error) => toast.error(errorMessage(error)) });
  const accountsQuery = useNoodlerAccounts(section === "creators");
  const imageSettingsQuery = useSlurpImageConnections(section === "general" || section === "creators");
  const fanStatusQuery = useNoodlerFanActivityStatus(section === "advanced");
  const reserveStatusQuery = useNoodlerReserveStatus(section === "creators");
  const updateAuto = useUpdateNoodlerAutoPosting();
  const refreshFans = useRefreshNoodlerFanActivityNow();
  const updateImages = useUpdateSlurpImageConnections();
  const deleteCreator = useDeleteNoodlerStageProfile();
  const connectionsQuery = useSlurpConnections(section === "general" || section === "creators");
  const imageConnections = (connectionsQuery.data ?? []).filter((connection) => connection.provider === "image_generation");
  const imageSettings = imageSettingsQuery.data;
  const update = (key: keyof SlurpSettings, value: unknown) => save({ [key]: value } as Partial<SlurpSettings>);

  if (settingsQuery.isError) return <main className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-[var(--muted-foreground)]"><p>{t("capabilities.actions.tryAgain")}</p><button type="button" onClick={() => void settingsQuery.refetch()} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--noodle-accent)]/40 px-3 font-semibold text-[var(--noodle-accent)]"><RefreshCw size={14} />{t("capabilities.actions.tryAgain")}</button></main>;
  if (settingsQuery.isLoading || !settings) return <main className="flex h-full items-center justify-center p-6 text-sm text-[var(--muted-foreground)]"><Loader2 size={18} className="animate-spin" />{t("capabilities.actions.loading")}</main>;

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-5 sm:p-8">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--noodle-accent)]">Slurp</p><h1 className="mt-1 text-2xl font-bold">Creator settings</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Configure creator posts, participants, images, and audience activity.</p></div>
        </header>
        <nav className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3" aria-label="Creator settings sections">
          {(["general", "creators", "participants", "advanced"] as const).map((item) => <button key={item} type="button" onClick={() => onNavigate({ ...navigation, section: item })} className={`rounded-md border px-3 py-2 text-sm ${section === item ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10" : "border-[var(--border)] hover:bg-[var(--accent)]"}`}>{item[0].toUpperCase() + item.slice(1)}</button>)}
        </nav>

         {section === "general" && <div className="space-y-5">
           <div className="grid gap-4 sm:grid-cols-2"><Field label="Automatic refreshes per day"><NumberSetting value={settings.refreshesPerDay} min={0} max={24} onSave={(value) => update("refreshesPerDay", value)} /></Field><Field label="Generated posts per refresh"><NumberSetting value={settings.maxGeneratedPostsPerRefresh} min={0} max={24} onSave={(value) => update("maxGeneratedPostsPerRefresh", value)} /></Field></div>
          <Field label="Generation guidance"><textarea value={generationGuidanceDraft} onChange={(event) => setGenerationGuidanceDraft(event.target.value)} onBlur={() => { if (generationGuidanceDraft !== settings.generationGuidance) update("generationGuidance", generationGuidanceDraft); }} className="min-h-40 w-full rounded-md border border-[var(--border)] bg-transparent p-3 text-sm" /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Generation connection"><select value={settings.generationConnectionId ?? ""} onChange={(event) => update("generationConnectionId", event.target.value || null)} className="h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-2 text-sm"><option value="">Default connection</option>{(connectionsQuery.data ?? []).filter((connection) => connection.provider !== "image_generation").map((connection) => <option key={connection.id} value={connection.id}>{connection.name ?? connection.model ?? connection.id}</option>)}</select></Field><Field label="Image generation connection"><select value={imageSettings?.defaultConnectionId ?? settings.imageGenerationConnectionId ?? ""} onChange={(event) => { const value = event.target.value || null; updateImages.mutate({ defaultConnectionId: value }, { onError: (error) => toast.error(errorMessage(error)) }); update("imageGenerationConnectionId", value); }} className="h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-2 text-sm"><option value="">Default image connection</option>{imageConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name ?? connection.model ?? connection.id}</option>)}</select></Field></div>
           <Field label="Image generation prompt"><textarea value={imagePromptDraft} onChange={(event) => setImagePromptDraft(event.target.value)} onBlur={() => { if (imagePromptDraft !== settings.imageGenerationPrompt) update("imageGenerationPrompt", imagePromptDraft); }} className="min-h-24 w-full rounded-md border border-[var(--border)] bg-transparent p-3 text-sm" /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Toggle label="Use avatar references" value={settings.imageGenerationUseAvatarReferences} onChange={(value) => update("imageGenerationUseAvatarReferences", value)} /><Toggle label="Include descriptions" value={settings.imageGenerationIncludeDescriptions} onChange={(value) => update("imageGenerationIncludeDescriptions", value)} /><Toggle label="Automatic posting schedule" value={settings.autoPostingScheduleEnabled} onChange={(value) => update("autoPostingScheduleEnabled", value)} /><Toggle label="Night quiet" value={settings.nightQuiet} onChange={(value) => update("nightQuiet", value)} /></div>
          <div className="grid gap-4 sm:grid-cols-3"><Field label="Posts per day"><NumberSetting value={settings.postsPerDay} min={1} max={24} onSave={(value) => update("postsPerDay", value)} /></Field><Field label="Max generated posts"><NumberSetting value={settings.maxGeneratedPostsPerRefresh} min={0} max={24} onSave={(value) => update("maxGeneratedPostsPerRefresh", value)} /></Field><Field label="Max images"><NumberSetting value={settings.maxImagesPerRefresh} min={0} max={24} onSave={(value) => update("maxImagesPerRefresh", value)} /></Field></div>
        </div>}

        {section === "creators" && <div className="space-y-2">{accountsQuery.data?.map((creator) => { const status = reserveStatusQuery.data?.creators.find((entry) => entry.accountId === creator.id); return <div key={creator.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-3"><button type="button" onClick={() => onNavigate({ mode: "creator", view: "profile", accountId: creator.id, returnToSettings: navigation })} className="min-w-48 flex-1 text-left"><span className="block text-sm font-semibold">{creator.displayName}</span><span className="block text-xs text-[var(--muted-foreground)]">@{creator.handle} · {status?.nextPreparedAt ? `Next ${new Date(status.nextPreparedAt).toLocaleString()}` : creator.sourceStatus.state}</span></button><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={creator.autoPosting.enabled} onChange={(event) => updateAuto.mutate({ accountId: creator.id, enabled: event.target.checked }, { onError: (error) => toast.error(errorMessage(error)) })} /> Auto-post</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={creator.autoPosting.imagesEnabled} onChange={(event) => updateAuto.mutate({ accountId: creator.id, imagesEnabled: event.target.checked }, { onError: (error) => toast.error(errorMessage(error)) })} /> Images</label><select value={imageSettings?.creatorConnectionIds[creator.id] ?? ""} onChange={(event) => updateImages.mutate({ creatorId: creator.id, connectionId: event.target.value || null }, { onError: (error) => toast.error(errorMessage(error)) })} className="h-8 min-w-36 rounded-md border border-[var(--border)] bg-transparent px-2 text-xs"><option value="">Default image connection</option>{imageConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name ?? connection.model ?? connection.id}</option>)}</select><button type="button" aria-label={`Delete ${creator.displayName}`} onClick={async () => { if (!(await showConfirmDialog({ title: "Delete Creator", message: `Delete ${creator.displayName}?`, confirmLabel: "Delete", tone: "destructive" }))) return; deleteCreator.mutate(creator.id, { onError: (error) => toast.error(errorMessage(error)) }); }} className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--destructive)]/40 text-[var(--destructive)]"><Trash2 size={15} /></button></div>; })}</div>}

        {section === "participants" && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-3"><Field label="Selection mode"><select value={settings.participantSelectionMode} onChange={(event) => update("participantSelectionMode", event.target.value)} className="h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-2 text-sm"><option value="all">All</option><option value="random">Random</option><option value="exact">Exact</option></select></Field><Field label="Minimum participants"><NumberSetting value={settings.participantMin} min={1} max={24} onSave={(value) => update("participantMin", value)} /></Field><Field label="Maximum participants"><NumberSetting value={settings.participantMax} min={1} max={24} onSave={(value) => update("participantMax", value)} /></Field></div><Field label="Invited character group IDs"><input value={settings.invitedCharacterGroupIds.join(", ")} onChange={(event) => update("invitedCharacterGroupIds", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} className="h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-2 text-sm" /></Field><div className="grid gap-4 sm:grid-cols-3"><Field label="Carryover modes"><select multiple value={settings.carryoverModes} onChange={(event) => update("carryoverModes", Array.from(event.target.selectedOptions, (option) => option.value))} className="min-h-24 w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-sm"><option value="conversation">Conversation</option><option value="roleplay">Roleplay</option><option value="game">Game</option></select></Field><Field label="Carryover hours"><NumberSetting value={settings.carryoverHours} min={1} max={8760} onSave={(value) => update("carryoverHours", value)} /></Field><Field label="Carryover max items"><NumberSetting value={settings.carryoverMaxItems} min={1} max={100} onSave={(value) => update("carryoverMaxItems", value)} /></Field></div><div className="grid gap-3 sm:grid-cols-2"><Toggle label="Allow random users" value={settings.allowRandomUsers} onChange={(value) => update("allowRandomUsers", value)} /><Toggle label="Allow Professor Mari" value={settings.allowProfessorMari} onChange={(value) => update("allowProfessorMari", value)} /><Toggle label="Enhanced timeline writing" value={settings.enableEnhancedTimelineWriting} onChange={(value) => update("enableEnhancedTimelineWriting", value)} /><Toggle label="Character schedules" value={settings.includeCharacterSchedules} onChange={(value) => update("includeCharacterSchedules", value)} /><Toggle label="Lorebook context" value={settings.enableLorebookContext} onChange={(value) => update("enableLorebookContext", value)} /><Toggle label="Gallery image attachments" value={settings.allowGalleryImageAttachments} onChange={(value) => update("allowGalleryImageAttachments", value)} /></div></div>}

         {section === "advanced" && <div className="space-y-5"><Toggle label="Image prompts" value={settings.enableImagePrompts} onChange={(value) => update("enableImagePrompts", value)} /><Toggle label="Enhanced timeline writing" value={settings.enableEnhancedTimelineWriting} onChange={(value) => update("enableEnhancedTimelineWriting", value)} /><Toggle label="Character schedules" value={settings.includeCharacterSchedules} onChange={(value) => update("includeCharacterSchedules", value)} /><Toggle label="Lorebook context" value={settings.enableLorebookContext} onChange={(value) => update("enableLorebookContext", value)} /><Toggle label="Gallery image attachments" value={settings.allowGalleryImageAttachments} onChange={(value) => update("allowGalleryImageAttachments", value)} /><Field label="Onboarding state"><select value={settings.onboarding} onChange={(event) => update("onboarding", event.target.value)} className="h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-2 text-sm"><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></Field><div className="grid gap-4 sm:grid-cols-3">{(["fanLikesPerRefresh", "fanRepliesPerRefresh", "fanRepostsPerRefresh"] as const).map((key) => <Field key={key} label={key}><NumberSetting value={settings[key]} min={0} max={key === "fanLikesPerRefresh" ? 24 : 12} onSave={(value) => update(key, value)} /></Field>)}</div><Toggle label="Fan activity enabled" value={settings.fanActivityEnabled} onChange={(value) => update("fanActivityEnabled", value)} /><Field label="Fan activity runs per day"><NumberSetting value={settings.fanActivityRunsPerDay} min={1} max={24} onSave={(value) => update("fanActivityRunsPerDay", value)} /></Field><div className="grid gap-4 sm:grid-cols-3">{archetypes.map((key) => <Field key={key} label={key}><NumberSetting value={settings.fanArchetypeWeights[key] ?? 0} min={0} max={100} onSave={(value) => { const next = { ...settings.fanArchetypeWeights, [key]: value }; if (!Object.values(next).some((weight) => weight > 0)) { toast.error("At least one fan type must remain enabled."); return; } update("fanArchetypeWeights", next); }} /></Field>)}</div><p className="text-xs text-[var(--muted-foreground)]">Fan runs today: {fanStatusQuery.data?.usedRuns ?? 0} / {fanStatusQuery.data?.runLimit ?? settings.fanActivityRunsPerDay}</p>{fanStatusQuery.data?.lastRun && <p className="text-xs text-[var(--muted-foreground)]">Last run: {fanStatusQuery.data.lastRun.status}</p>}<button type="button" disabled={refreshFans.isPending || !settings.fanActivityEnabled} onClick={() => refreshFans.mutate(undefined, { onSuccess: (result) => toast.success(`${result.created} audience actions created.`), onError: (error) => toast.error(errorMessage(error)) })} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"><UsersRound size={14} />{refreshFans.isPending ? "Running" : "Refresh audience now"}</button></div>}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1 text-xs font-semibold"><span className="block text-[var(--muted-foreground)]">{label}</span>{children}</label>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm"><span>{label}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--noodle-accent)]" /></label>; }
