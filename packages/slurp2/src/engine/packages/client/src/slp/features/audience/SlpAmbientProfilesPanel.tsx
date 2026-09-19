// Ambient profiles panel, moved out of components/slurp/SlurpBackstageWorkflow.tsx in Slice 10.
// It drives the ambient-profile hooks, so Audience owns it.

import { Toggle } from "../../modules/settings/SlpSettingsControls";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useDeleteNoodlerStageProfile } from "../creators/slp-creators-contract";
import { Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useRerollAmbientProfiles,
  useSlurpAmbientProfiles,
  useUpdateAmbientProfile,
} from "./slp-ambient-profile-hooks";
import { toast } from "sonner";

export function AmbientProfilesPanel({
  allowRandomUsers,
  onAllowRandomUsersChange,
}: {
  allowRandomUsers: boolean;
  onAllowRandomUsersChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const profilesQuery = useSlurpAmbientProfiles();
  const reroll = useRerollAmbientProfiles();
  const update = useUpdateAmbientProfile();
  const remove = useDeleteNoodlerStageProfile();
  const profiles = profilesQuery.data?.items ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; displayName: string; handle: string; bio: string } | null>(null);

  const rerollIds = (accountIds: string[], id: string | null) => {
    if (accountIds.length === 0) return;
    setSelected(id);
    reroll.mutate(accountIds, {
      onSuccess: () => toast.success(t("ui.slurp.settings.ambient.rerolled", { count: accountIds.length })),
      onError: (error) => toast.error(errorMessage(error)),
      onSettled: () => setSelected(null),
    });
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">{t("ui.slurp.settings.ambient.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.ambient.detail")}</p>
        </div>
        <button
          type="button"
          disabled={reroll.isPending || profiles.length === 0}
          onClick={() =>
            rerollIds(
              profiles.map((profile) => profile.id),
              null,
            )
          }
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
        >
          <RefreshCw size={14} className={reroll.isPending && selected === null ? "animate-spin" : ""} />
          {t("ui.slurp.settings.ambient.rerollAll")}
        </button>
      </div>
      <Toggle
        label={t("ui.slurp.settings.ambient.enabled")}
        detail={t("ui.slurp.settings.ambient.enabledDetail")}
        value={allowRandomUsers}
        onChange={onAllowRandomUsersChange}
      />
      {profiles.length > 0 && (
        <ul className="space-y-2">
          {profiles.map((profile) =>
            editing?.id === profile.id ? (
              <li key={profile.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                {(["displayName", "handle", "bio"] as const).map((field) => (
                  <label key={field} className="block text-[0.7rem] font-semibold">
                    {t(`ui.slurp.settings.ambient.fields.${field}`)}
                    <input
                      value={editing[field]}
                      onChange={(event) => setEditing({ ...editing, [field]: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    />
                  </label>
                ))}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="inline-flex min-h-9 items-center rounded-lg border border-[var(--border)] px-2.5 text-[0.7rem] font-semibold hover:bg-[var(--accent)]"
                  >
                    {t("ui.slurp.settings.ambient.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={update.isPending || !editing.displayName.trim() || !editing.handle.trim()}
                    onClick={() =>
                      update.mutate(editing, {
                        onSuccess: () => setEditing(null),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-2.5 text-[0.7rem] font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
                  >
                    <Save size={12} />
                    {t("ui.slurp.settings.ambient.save")}
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={profile.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-semibold">
                    {profile.displayName} <span className="text-[var(--slurp-muted)]">@{profile.handle}</span>
                  </span>
                  <span className="truncate text-[0.7rem] text-[var(--slurp-muted)]">{profile.bio}</span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={reroll.isPending}
                    onClick={() => rerollIds([profile.id], profile.id)}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[0.7rem] font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={selected === profile.id ? "animate-spin" : ""} />
                    {t("ui.slurp.settings.ambient.reroll")}
                  </button>
                  <button
                    type="button"
                    aria-label={t("ui.slurp.settings.ambient.edit")}
                    title={t("ui.slurp.settings.ambient.edit")}
                    onClick={() =>
                      setEditing({
                        id: profile.id,
                        displayName: profile.displayName,
                        handle: profile.handle,
                        bio: profile.bio,
                      })
                    }
                    className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--accent)]"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("ui.slurp.settings.ambient.delete")}
                    title={t("ui.slurp.settings.ambient.delete")}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (!window.confirm(t("ui.slurp.settings.ambient.deleteConfirm", { name: profile.displayName })))
                        return;
                      remove.mutate(profile.id, {
                        onSuccess: () => void profilesQuery.refetch(),
                        onError: (error) => toast.error(errorMessage(error)),
                      });
                    }}
                    className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * A Creator's own message policy and prices.
 *
 * Only rendered for a persona-owned Creator: the routes require the operating persona, and a
 * character-sourced Creator has no owner to authorise the change.
 */
