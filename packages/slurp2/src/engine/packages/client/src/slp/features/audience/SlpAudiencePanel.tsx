import { ChevronRight, Loader2, RefreshCw, UsersRound } from "lucide-react";
import { BackstagePageHeader, BackstageWizard } from "../../modules/settings/SlpSettingsKit";

import { Field, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { SlurpSimulationSettings } from "./SlpSimulationPanel";
import { SlurpFanTypesSettings } from "./SlpFanTypesPanel";
import { SlurpAudienceConfigSettings } from "./SlpAudienceConfigPanel";

import { SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlurpAudienceCharacterGroup, SlurpAudienceCharacterSummary } from "./slp-audience-contract";

import type { SlurpSettings } from "../settings/slp-settings-contract";

import { SLURP_AUDIENCE_PRESETS, slurpAudiencePresetPatch } from "../../../../../shared/src/slp/slp-tuning.js";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { ChoiceSetting, StatusStrip } from "../../modules/settings/SlpSettingsInputs";
import { AmbientProfilesPanel } from "./SlpAmbientProfilesPanel";

/** Audience: crowd scale, tone, fan types, the reaction bank and simulation tuning. */
export function SlpAudiencePanel(page: SlpBackstagePageProps) {
  const {
    t,
    updateSettings,
    settings,
    reactionBankDraft,
    setReactionBankDraft,
    update,
    updatePatch,
    fanStatusQuery,
    refreshFans,
    connectionsQuery,
    audiencePreset,
    audienceWizardOpen,
    setAudienceWizardOpen,
    audienceDraft,
    setAudienceDraft,
    audienceCharacters,
    audienceCharacterGroups,
    audienceCharactersQuery,
    audienceCharacterGroupsQuery,
  } = page;

  const onOff = (value: boolean) => t(value ? "ui.slurp.settings.overview.on" : "ui.slurp.settings.overview.off");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BackstagePageHeader detail={t("ui.slurp.settings.audience.detail")} />
        <StatusStrip
          label={t("ui.slurp.settings.strip.label")}
          items={[
            {
              label: t("ui.slurp.settings.strip.fans"),
              value: onOff(settings.fanActivityEnabled),
              settingKey: "fanActivityEnabled",
            },
            {
              label: t("ui.slurp.settings.strip.scale"),
              value: t(`ui.slurp.settings.audience.scale.${settings.platformScale}`),
              settingKey: "platformScale",
            },
            {
              label: t("ui.slurp.settings.strip.tone"),
              value: t(`ui.slurp.settings.audience.tone.${settings.audienceTone}`),
              settingKey: "audienceTone",
            },
          ]}
        />
        <button
          type="button"
          onClick={() => refreshFans.mutate()}
          disabled={refreshFans.isPending || !settings.fanActivityEnabled}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshFans.isPending ? "animate-spin" : ""} />
          {t("ui.slurp.settings.audience.refresh")}
        </button>
        <button
          type="button"
          aria-expanded={audienceWizardOpen}
          onClick={() => {
            setAudienceDraft({
              preset: audiencePreset === "custom" ? "realistic" : audiencePreset,
              platformScale: settings.platformScale,
              audienceTone: settings.audienceTone,
            });
            setAudienceWizardOpen((open) => !open);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          <UsersRound size={14} aria-hidden="true" />
          {t("ui.slurp.settings.backstage.wizard.audienceTitle", { defaultValue: "Set up audience" })}
        </button>
      </div>
      {audienceWizardOpen &&
        audienceDraft &&
        (() => {
          const patch = {
            ...slurpAudiencePresetPatch(audienceDraft.preset, settings),
            platformScale: audienceDraft.platformScale,
            audienceTone: audienceDraft.audienceTone,
          } as Partial<SlurpSettings>;
          return (
            <BackstageWizard
              title={t("ui.slurp.settings.backstage.wizard.audienceTitle", { defaultValue: "Set up audience" })}
              preset={audienceDraft.preset}
              presetLabel={(preset) => t(`ui.slurp.settings.simulation.presets.${preset}`)}
              current={settings}
              proposed={{ ...settings, ...patch }}
              patch={patch}
              pending={updateSettings.isPending}
              onCancel={() => setAudienceWizardOpen(false)}
              onApply={(next) => {
                void updatePatch(next);
                setAudienceWizardOpen(false);
              }}
              steps={[
                {
                  id: "energy",
                  title: t("ui.slurp.settings.backstage.wizard.audienceEnergy", {
                    defaultValue: "Choose audience energy",
                  }),
                  content: (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SLURP_AUDIENCE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          aria-pressed={audienceDraft.preset === preset}
                          onClick={() => setAudienceDraft({ ...audienceDraft, preset })}
                          className={`min-h-14 rounded-lg p-3 text-start text-sm font-semibold ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${audienceDraft.preset === preset ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)]"}`}
                        >
                          {t(`ui.slurp.settings.simulation.presets.${preset}`)}
                        </button>
                      ))}
                    </div>
                  ),
                },
                {
                  id: "feel",
                  title: t("ui.slurp.settings.backstage.wizard.audienceFeel", {
                    defaultValue: "Choose size and tone",
                  }),
                  content: (
                    <div className="space-y-3">
                      <ChoiceSetting
                        label={t("ui.slurp.settings.audience.scaleTitle")}
                        detail={t("ui.slurp.settings.audience.scaleDetail")}
                        options={(["intimate", "normal", "large"] as const).map((value) => ({
                          value,
                          label: t(`ui.slurp.settings.audience.scale.${value}`),
                        }))}
                        value={audienceDraft.platformScale}
                        onChange={(platformScale) => setAudienceDraft({ ...audienceDraft, platformScale })}
                      />
                      <ChoiceSetting
                        label={t("ui.slurp.settings.audience.toneTitle")}
                        detail={t("ui.slurp.settings.audience.toneDetail")}
                        options={(["warm", "mixed", "unfiltered"] as const).map((value) => ({
                          value,
                          label: t(`ui.slurp.settings.audience.tone.${value}`),
                        }))}
                        value={audienceDraft.audienceTone}
                        onChange={(audienceTone) => setAudienceDraft({ ...audienceDraft, audienceTone })}
                      />
                    </div>
                  ),
                },
              ]}
            />
          );
        })()}
      <p className="text-xs text-[var(--muted-foreground)]" aria-live="polite">
        {fanStatusQuery.isError
          ? t("ui.slurp.settings.audience.statusError")
          : fanStatusQuery.data
            ? t("ui.slurp.settings.audience.statusUsed", {
                used: fanStatusQuery.data.usedRuns,
                limit: fanStatusQuery.data.runLimit,
              })
            : t("ui.slurp.settings.audience.statusLoading")}
      </p>
      <ChoiceSetting
        label={t("ui.slurp.settings.audience.presetTitle")}
        detail={
          audiencePreset === "custom"
            ? t("ui.slurp.settings.audience.presetCustom")
            : t(`ui.slurp.settings.simulation.presetDetail.${audiencePreset}`)
        }
        options={SLURP_AUDIENCE_PRESETS.map((preset) => ({
          value: preset,
          label: t(`ui.slurp.settings.simulation.presets.${preset}`),
        }))}
        value={audiencePreset === "custom" ? null : audiencePreset}
        onChange={(preset) => void updatePatch(slurpAudiencePresetPatch(preset, settings))}
      />
      <SettingAnchor settingKey="platformScale">
        <ChoiceSetting
          label={t("ui.slurp.settings.audience.scaleTitle")}
          detail={t("ui.slurp.settings.audience.scaleDetail")}
          options={(["intimate", "normal", "large"] as const).map((level) => ({
            value: level,
            label: t(`ui.slurp.settings.audience.scale.${level}`),
          }))}
          value={settings.platformScale}
          onChange={(level) => update("platformScale", level)}
        />
      </SettingAnchor>
      <SettingAnchor settingKey="audienceTone">
        <ChoiceSetting
          label={t("ui.slurp.settings.audience.toneTitle")}
          detail={t("ui.slurp.settings.audience.toneDetail")}
          options={(["warm", "mixed", "unfiltered"] as const).map((tone) => ({
            value: tone,
            label: t(`ui.slurp.settings.audience.tone.${tone}`),
          }))}
          value={settings.audienceTone}
          onChange={(tone) => update("audienceTone", tone)}
        />
      </SettingAnchor>

      <SettingsGroup
        title={t("ui.slurp.settings.audience.characterFansTitle", {
          defaultValue: "Character audience",
        })}
      >
        <div className="space-y-4">
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {t("ui.slurp.settings.audience.characterFansDetail", {
              defaultValue: "Invite your Engine characters to read posts and join the audience simulation.",
            })}
          </p>
          <Field
            settingKey="audienceCharacterLimit"
            label={t("ui.slurp.settings.audience.characterLimit", {
              defaultValue: "Character fans active at once",
            })}
            detail={t("ui.slurp.settings.audience.characterLimitDetail", {
              defaultValue: "This limits prompt cost. Invited characters rotate when the list is larger.",
            })}
          >
            <NumberSetting
              stepper
              value={settings.audienceCharacterLimit}
              min={0}
              max={10}
              onSave={(value) => void update("audienceCharacterLimit", value)}
            />
          </Field>

          {audienceCharactersQuery.isLoading || audienceCharacterGroupsQuery.isLoading ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.audience.characterLoading", { defaultValue: "Loading characters…" })}
            </p>
          ) : audienceCharactersQuery.isError || audienceCharacterGroupsQuery.isError ? (
            <p role="alert" className="text-xs text-[var(--destructive)]">
              {t("ui.slurp.settings.audience.characterError", { defaultValue: "Characters are unavailable." })}
            </p>
          ) : (
            <>
              <Field
                group
                settingKey="audienceCharacterGroupIds"
                label={t("ui.slurp.settings.audience.characterGroups", { defaultValue: "Invite character groups" })}
                detail={t("ui.slurp.settings.audience.characterGroupsDetail", {
                  defaultValue: "A group invites every member. A character override below can remove one.",
                })}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {audienceCharacterGroups.map((group: SlurpAudienceCharacterGroup) => {
                    const selected = settings.audienceCharacterGroupIds.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            void update(
                              "audienceCharacterGroupIds",
                              selected
                                ? settings.audienceCharacterGroupIds.filter((id: string) => id !== group.id)
                                : [...settings.audienceCharacterGroupIds, group.id],
                            )
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{group.name}</span>
                        <span className="text-xs text-[var(--muted-foreground)]">{group.characterIds.length}</span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              <Field
                settingKey="audienceCharacters"
                label={t("ui.slurp.settings.audience.characterOverrides", { defaultValue: "Character overrides" })}
                detail={t("ui.slurp.settings.audience.characterOverridesDetail", {
                  defaultValue: "Choose a Fan Type, or leave a character on automatic.",
                })}
              >
                <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-[var(--slurp-outline)] p-2">
                  {audienceCharacters.map((character: SlurpAudienceCharacterSummary) => {
                    const value = settings.audienceCharacters[character.id];
                    const inGroup = audienceCharacterGroups.some(
                      (group: SlurpAudienceCharacterGroup) =>
                        settings.audienceCharacterGroupIds.includes(group.id) &&
                        group.characterIds.includes(character.id),
                    );
                    const enabled = value !== false && (value !== undefined || inGroup);
                    return (
                      <div
                        key={character.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 hover:bg-[var(--accent)]/30"
                      >
                        <input
                          type="checkbox"
                          aria-label={character.name}
                          checked={enabled}
                          onChange={() =>
                            void update("audienceCharacters", {
                              ...settings.audienceCharacters,
                              [character.id]: enabled ? false : true,
                            })
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{character.name}</span>
                        <select
                          aria-label={t("ui.slurp.settings.audience.characterFanType", {
                            defaultValue: "Fan Type for {{name}}",
                            name: character.name,
                          })}
                          disabled={!enabled}
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) =>
                            void update("audienceCharacters", {
                              ...settings.audienceCharacters,
                              [character.id]: event.target.value || true,
                            })
                          }
                          className="min-h-9 max-w-44 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-surface)] px-2 text-xs disabled:opacity-50"
                        >
                          <option value="">
                            {t("ui.slurp.settings.audience.automatic", { defaultValue: "Automatic" })}
                          </option>
                          {settings.fanTypes
                            .filter((type) => type.enabled)
                            .map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                {audienceCharactersQuery.hasNextPage && (
                  <button
                    type="button"
                    disabled={audienceCharactersQuery.isFetchingNextPage}
                    onClick={() => void audienceCharactersQuery.fetchNextPage()}
                    className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] text-sm font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    {audienceCharactersQuery.isFetchingNextPage && <Loader2 size={15} className="animate-spin" />}
                    {audienceCharactersQuery.isFetchingNextPage
                      ? t("ui.slurp.settings.audience.characterLoadingMore", { defaultValue: "Loading more…" })
                      : t("ui.slurp.settings.audience.characterLoadMore", { defaultValue: "Load more characters" })}
                  </button>
                )}
              </Field>
            </>
          )}
        </div>
      </SettingsGroup>

      <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block">{t("ui.slurp.settings.audience.fanTypesTitle")}</span>
            <span className="block text-xs font-normal text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.audience.fanTypesSummary", {
                enabled: settings.fanTypes.filter((type) => type.enabled).length,
                count: settings.fanTypes.length,
              })}
            </span>
          </span>
          <ChevronRight
            size={17}
            className="transition-transform group-open:rotate-90 rtl:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
          <SettingAnchor settingKey="allowRandomUsers">
            <AmbientProfilesPanel
              allowRandomUsers={settings.allowRandomUsers}
              onAllowRandomUsersChange={(value) => update("allowRandomUsers", value)}
            />
          </SettingAnchor>
          <Field
            settingKey="audienceReactionBank"
            label={t("ui.slurp.settings.audience.reactionBank")}
            detail={t("ui.slurp.settings.audience.reactionBankDetail", {
              count: settings.audienceReactionBank.shared.length,
            })}
          >
            <textarea
              rows={6}
              value={reactionBankDraft ?? settings.audienceReactionBank.shared.join("\n")}
              onChange={(event) => setReactionBankDraft(event.target.value)}
              onBlur={() => {
                const draft = reactionBankDraft;
                setReactionBankDraft(null);
                if (draft === null) return;
                // Same rules the server applies, so what the box shows after a save is
                // what was actually stored rather than a list that silently lost rows.
                const seen = new Set<string>();
                const next: string[] = [];
                for (const line of draft.split("\n")) {
                  const body = line.trim().slice(0, 120);
                  const key = body.toLowerCase();
                  if (!body || seen.has(key) || next.length >= 400) continue;
                  seen.add(key);
                  next.push(body);
                }
                // The box edits the shared bank only; per-type banks have their own
                // editor in the Fan Types panel.
                if (next.join("\n") !== settings.audienceReactionBank.shared.join("\n"))
                  void update("audienceReactionBank", {
                    ...settings.audienceReactionBank,
                    shared: next,
                  });
              }}
              className="w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
            />
          </Field>
          <SettingAnchor settingKey="fanTypes">
            <SlurpFanTypesSettings
              fanTypes={settings.fanTypes}
              bankCounts={settings.audienceReactionBank.byType}
              crowdTone={settings.audienceTone}
              onSave={(fanTypes) => update("fanTypes", fanTypes)}
            />
          </SettingAnchor>
        </div>
      </details>

      <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block">{t("ui.slurp.settings.audience.aiTitle")}</span>
            <span className="block text-xs font-normal text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.audience.aiSummary")}
            </span>
          </span>
          <ChevronRight
            size={17}
            className="transition-transform group-open:rotate-90 rtl:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
          <SettingAnchor settingKey="modelBudget">
            <SlurpAudienceConfigSettings
              tuning={settings.simulationTuning}
              fanTypes={settings.fanTypes}
              budget={settings.modelBudget}
              connections={connectionsQuery.data ?? []}
              onSave={(patch) => updatePatch(patch)}
            />
          </SettingAnchor>
        </div>
      </details>

      <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block">{t("ui.slurp.settings.audience.advancedTitle")}</span>
            <span className="block text-xs font-normal text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.audience.advancedDetail")}
            </span>
          </span>
          <ChevronRight
            size={17}
            className="transition-transform group-open:rotate-90 rtl:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
          <Toggle
            settingKey="fanActivityEnabled"
            label={t("ui.slurp.settings.audience.enabled")}
            detail={t("ui.slurp.settings.audience.enabledDetail")}
            value={settings.fanActivityEnabled}
            onChange={(value) => update("fanActivityEnabled", value)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              settingKey="fanActivityRunsPerDay"
              label={t("ui.slurp.settings.audience.runsPerDay")}
              detail={t("ui.slurp.settings.audience.runsPerDayDetail")}
            >
              <NumberSetting
                value={settings.fanActivityRunsPerDay}
                min={1}
                max={96}
                onSave={(value) => update("fanActivityRunsPerDay", value)}
              />
            </Field>
            <Field settingKey="fanLikesPerRefresh" label={t("ui.slurp.settings.audience.likes")}>
              <NumberSetting
                value={settings.fanLikesPerRefresh}
                min={0}
                max={24}
                onSave={(value) => update("fanLikesPerRefresh", value)}
              />
            </Field>
            <Field settingKey="fanRepliesPerRefresh" label={t("ui.slurp.settings.audience.replies")}>
              <NumberSetting
                value={settings.fanRepliesPerRefresh}
                min={0}
                max={12}
                onSave={(value) => update("fanRepliesPerRefresh", value)}
              />
            </Field>
          </div>
          <SettingAnchor settingKey="worldActivity">
            <ChoiceSetting
              label={t("ui.slurp.settings.audience.activityTitle")}
              detail={t("ui.slurp.settings.audience.activityDetail")}
              options={(["off", "quiet", "normal", "busy"] as const).map((level) => ({
                value: level,
                label: t(`ui.slurp.settings.audience.activity.${level}`),
              }))}
              value={settings.worldActivity}
              onChange={(level) => update("worldActivity", level)}
            />
          </SettingAnchor>
          {/* ponytail: the global archetype mix stays a hidden stored field that the server still
                          reads; drop it together with the per-Creator archetype UI. */}
          {Object.values(settings.fanArchetypeWeights).some((weight) => weight !== 1) && (
            <SettingAnchor settingKey="fanArchetypeWeights">
              <div className="rounded-lg border border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)]">
                <p>{t("ui.slurp.settings.audience.legacyMix")}</p>
                <button
                  type="button"
                  onClick={() =>
                    void update(
                      "fanArchetypeWeights",
                      Object.fromEntries(Object.keys(settings.fanArchetypeWeights).map((key) => [key, 1])),
                    )
                  }
                  className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)]"
                >
                  {t("ui.slurp.settings.audience.legacyMixReset")}
                </button>
              </div>
            </SettingAnchor>
          )}
          {/* Every number the simulation runs on, in its own file. Keyed on the preset so an Activity click resets the local draft instead of saving stale tuning back. */}
          <SettingAnchor settingKey="simulationTuning">
            <SlurpSimulationSettings
              key={settings.simulationTuning.preset}
              tuning={settings.simulationTuning}
              onSave={(next) => void update("simulationTuning", next)}
            />
          </SettingAnchor>
        </div>
      </details>
    </div>
  );
}
