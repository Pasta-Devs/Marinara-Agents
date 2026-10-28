import { Modal } from "../../../components/ui/Modal";
import { getSlpAccentStyle } from "../../base/chrome/SlpChrome";
import { SlpPictureAssist } from "../../features/assist/slp-assist-contract";
import type { StageProfileViewModel } from "./slp-profile-view-model";

/**
 * The profile screen's "draw a profile picture / cover" dialog: the shared picture assist (type what
 * you want, Draw it, Retry / Use, Undo). Its automation dialog lives in the Creator settings.
 */
export function SlpProfileModals({ model }: { model: StageProfileViewModel }) {
  const { accent, artworkKind, localizeUi, profile, setArtworkKind } = model;
  const target = artworkKind === "banner" ? "cover" : "avatar";

  return (
    <Modal
      open={artworkKind !== null}
      onClose={() => setArtworkKind(null)}
      title={localizeUi(`ui.slurp.assist.drawTitle.${target}`)}
      width="max-w-lg"
      panelClassName="noodle-icon-scope"
      panelStyle={getSlpAccentStyle(accent, {
        "--background": "var(--slurp-surface)",
        "--foreground": "var(--slurp-text)",
        "--muted-foreground": "var(--slurp-muted)",
        "--border": "color-mix(in srgb, var(--noodle-accent) 24%, transparent)",
        "--accent": "color-mix(in srgb, var(--noodle-accent) 12%, transparent)",
      })}
    >
      {artworkKind && (
        <SlpPictureAssist
          key={artworkKind}
          accountId={profile.id}
          target={target}
          context={profile.bio}
          onDone={() => setArtworkKind(null)}
        />
      )}
    </Modal>
  );
}
