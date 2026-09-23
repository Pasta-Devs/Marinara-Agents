import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../components/ui/Modal";
import { getSlpAccentStyle } from "../../base/chrome/SlpChrome";
import { errorMessage } from "./SlpHomeHelpers";
import type { StageProfileViewModel } from "./slp-profile-view-model";

/** The profile screen's artwork sheet. Its automation dialog now lives in the Creator settings. */
export function SlpProfileModals({ model }: { model: StageProfileViewModel }) {
  const {
    accent,
    artworkGuidance,
    artworkKind,
    generateProfileArtwork,
    localizeUi,
    profile,
    setArtworkGuidance,
    setArtworkKind,
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
    </>
  );
}
