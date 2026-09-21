import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../components/ui/Modal";
import { getSlpAccentStyle } from "../../base/chrome/SlpChrome";
import { errorMessage } from "./SlpHomeHelpers";
import type { StageProfileViewModel } from "./slp-profile-view-model";

/** The profile screen's three dialogs: access, automation and the artwork/tip sheet. */
export function SlpProfileModals({ model }: { model: StageProfileViewModel }) {
  const {
    accent,
    artworkGuidance,
    artworkKind,
    automationOpen,
    autoPosting,
    generateProfileArtwork,
    globalSettings,
    localizeUi,
    onEdit,
    onRunNow,
    personaBackedCreator,
    profile,
    runNowPending,
    setArtworkGuidance,
    setArtworkKind,
    setAutomationOpen,
    updateAutoPosting,
    updateFanActivity,
  } = model;

  return (
    <>
      <Modal
        open={artworkKind !== null}
        onClose={() => setArtworkKind(null)}
        title={localizeUi(
          artworkKind === "banner" ? "ui.slurp.artwork.generateBanner" : "ui.slurp.artwork.generateAvatar",
        )}
        width="max-w-lg"
        closeDisabled={generateProfileArtwork.isPending}
        panelClassName="noodle-icon-scope"
        panelStyle={getSlpAccentStyle(accent, {
          "--background": "var(--slurp-surface)",
          "--foreground": "var(--slurp-text)",
          "--muted-foreground": "var(--slurp-muted)",
          "--border": "color-mix(in srgb, var(--noodle-accent) 24%, transparent)",
          "--accent": "color-mix(in srgb, var(--noodle-accent) 12%, transparent)",
        })}
      >
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-semibold">
            <span>{localizeUi("ui.slurp.artwork.guidanceLabel")}</span>
            <textarea
              value={artworkGuidance}
              onChange={(event) => setArtworkGuidance(event.target.value)}
              maxLength={2000}
              placeholder={
                artworkKind === "banner"
                  ? localizeUi("ui.slurp.artwork.bannerPlaceholder")
                  : localizeUi("ui.slurp.artwork.avatarPlaceholder")
              }
              className="min-h-32 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm font-normal outline-none focus:border-[var(--noodle-accent)]"
            />
          </label>
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.artwork.guidanceHelp")}
          </p>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              disabled={generateProfileArtwork.isPending}
              onClick={() => setArtworkKind(null)}
              className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-xs font-semibold"
            >
              {localizeUi("ui.slurp.artwork.cancel")}
            </button>
            <button
              type="button"
              disabled={generateProfileArtwork.isPending || !artworkKind}
              onClick={() => {
                if (!artworkKind) return;
                generateProfileArtwork.mutate(
                  { accountId: profile.id, kind: artworkKind, guidance: artworkGuidance.trim() || undefined },
                  {
                    onSuccess: () => {
                      toast.success(
                        localizeUi(
                          artworkKind === "banner"
                            ? "ui.slurp.artwork.bannerGenerated"
                            : "ui.slurp.artwork.avatarGenerated",
                        ),
                      );
                      setArtworkKind(null);
                    },
                    onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.artwork.generateError"))),
                  },
                );
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
            >
              {generateProfileArtwork.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {localizeUi("ui.slurp.artwork.generate")}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={automationOpen && !personaBackedCreator}
        onClose={() => setAutomationOpen(false)}
        title={localizeUi("ui.noodle.stageprofileview.automaticPosting")}
        width="max-w-md"
        panelStyle={getSlpAccentStyle(accent)}
      >
        <div className="space-y-4">
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.stageprofileview.whenOnThisCreatorPostsOnItsOwnWhile")}
          </p>
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.stageprofileview.automaticPostingProviderDisclosure")}
          </p>
          <button
            type="button"
            onClick={() => {
              setAutomationOpen(false);
              onEdit();
            }}
            className="h-9 w-full rounded-full border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
          >
            {localizeUi("ui.noodle.stageprofileview.editBioStageVoice")}
          </button>
          <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[var(--noodle-divider)] px-3 py-2">
            <span className="text-xs font-bold">
              {localizeUi("ui.noodle.stageprofileview.automaticPostingEnabled")}
            </span>
            <input
              type="checkbox"
              checked={autoPosting.enabled}
              disabled={updateAutoPosting.isPending}
              onChange={(event) =>
                updateAutoPosting.mutate(
                  { accountId: profile.id, enabled: event.target.checked },
                  {
                    onError: (error) =>
                      toast.error(
                        errorMessage(error, localizeUi("ui.noodle.stageprofileview.couldNotUpdateAutomaticPosting")),
                      ),
                  },
                )
              }
              className="h-5 w-5 accent-[var(--noodle-accent)]"
            />
          </label>
          <fieldset disabled={updateAutoPosting.isPending} className="space-y-2 disabled:opacity-50">
            <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[var(--noodle-divider)] px-3 py-2">
              <span className="text-xs font-bold">
                {localizeUi("ui.noodle.stageprofileview.generateAnImageWithPosts")}
              </span>
              <input
                type="checkbox"
                checked={autoPosting.imagesEnabled}
                onChange={(event) =>
                  updateAutoPosting.mutate(
                    { accountId: profile.id, imagesEnabled: event.target.checked },
                    {
                      onError: (error) =>
                        toast.error(
                          errorMessage(error, localizeUi("ui.noodle.stageprofileview.couldNotUpdateImageGeneration")),
                        ),
                    },
                  )
                }
                className="h-5 w-5 accent-[var(--noodle-accent)]"
              />
            </label>
          </fieldset>
          <fieldset disabled={updateFanActivity.isPending} className="space-y-3 disabled:opacity-50">
            <legend className="text-xs font-bold">{localizeUi("ui.noodle.noodlerfanactivity.creatorTitle")}</legend>
            <label className="block space-y-1 text-xs font-semibold">
              <span className="text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.noodlerfanactivity.creatorMode")}
              </span>
              <select
                value={
                  profile.fanActivity?.enabled === true
                    ? "on"
                    : profile.fanActivity?.enabled === false
                      ? "off"
                      : "inherit"
                }
                onChange={(event) => {
                  const mode = event.target.value;
                  updateFanActivity.mutate(
                    {
                      accountId: profile.id,
                      fanActivity: mode === "inherit" ? null : { ...profile.fanActivity, enabled: mode === "on" },
                    },
                    {
                      onError: (error) =>
                        toast.error(
                          errorMessage(error, localizeUi("ui.noodle.noodlerfanactivity.couldNotUpdateCreator")),
                        ),
                    },
                  );
                }}
                className="h-9 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-2"
              >
                {/* "Use global defaults" is meaningless without saying what that resolves to
                right now, which used to mean leaving the Creator to go and look. */}
                <option value="inherit">
                  {globalSettings
                    ? localizeUi("ui.noodle.noodlerfanactivity.inheritResolved", {
                        value: localizeUi(
                          globalSettings.fanActivityEnabled
                            ? "ui.noodle.noodlerfanactivity.on"
                            : "ui.noodle.noodlerfanactivity.off",
                        ),
                      })
                    : localizeUi("ui.noodle.noodlerfanactivity.inherit")}
                </option>
                <option value="on">{localizeUi("ui.noodle.noodlerfanactivity.on")}</option>
                <option value="off">{localizeUi("ui.noodle.noodlerfanactivity.off")}</option>
              </select>
            </label>
            {profile.fanActivity && globalSettings && (
              <div className="grid grid-cols-2 gap-2">
                {(["ordinary", "eccentric", "crossFandom", "raider", "organicDiscovery", "freeResource"] as const).map(
                  (archetype) => {
                    const override = profile.fanActivity?.archetypeWeights?.[archetype];
                    const globalValue = globalSettings.fanArchetypeWeights[archetype];
                    const current = override ?? globalValue;
                    return (
                      <label key={archetype} className="space-y-1 text-[0.68rem] font-semibold">
                        <span className="block text-[var(--muted-foreground)]">
                          {localizeUi(`ui.noodle.noodlerfanactivity.archetype.${archetype}`)}
                          {/* Without this an inherited value and a deliberate override that
                          happens to match look identical. */}
                          {override === undefined && (
                            <span className="ml-1 font-normal opacity-70">
                              {localizeUi("ui.noodle.noodlerfanactivity.inheritedValue")}
                            </span>
                          )}
                        </span>
                        <input
                          key={`${profile.id}-${archetype}-${current}`}
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={current}
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            if (!Number.isInteger(value) || value < 0 || value > 100) {
                              event.target.value = String(current);
                              return;
                            }
                            const archetypeWeights = {
                              ...globalSettings.fanArchetypeWeights,
                              ...profile.fanActivity?.archetypeWeights,
                              [archetype]: value,
                            };
                            if (!Object.values(archetypeWeights).some((weight) => weight > 0)) {
                              toast.error(localizeUi("ui.noodle.noodlerfanactivity.allWeightsZero"));
                              event.target.value = String(current);
                              return;
                            }
                            const archetypeOverrides = {
                              ...profile.fanActivity?.archetypeWeights,
                              [archetype]: value,
                            };
                            updateFanActivity.mutate(
                              {
                                accountId: profile.id,
                                fanActivity: { ...profile.fanActivity, archetypeWeights: archetypeOverrides },
                              },
                              {
                                onError: (error) => {
                                  toast.error(errorMessage(error, localizeUi("ui.slurp.creator.updateError")));
                                  event.target.value = String(current);
                                },
                              },
                            );
                          }}
                          className="h-9 w-full rounded-lg border border-[var(--noodle-divider)] bg-transparent px-2 text-sm"
                        />
                      </label>
                    );
                  },
                )}
              </div>
            )}
          </fieldset>
          <div className="space-y-1">
            <button
              type="button"
              disabled={runNowPending}
              onClick={() => onRunNow(profile.id)}
              className="h-9 w-full rounded-full border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {runNowPending
                ? localizeUi("ui.noodle.stageprofileview.running")
                : localizeUi("ui.noodle.stageprofileview.runNow")}
            </button>
            <p className="text-[0.68rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.noodle.stageprofileview.generatesOneAutomaticStylePostImmediatelySubscriberAccessThe")}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
