// R6 (docs/FEEDBACK-2026-10.md): an existing Creator's page, filled in through the role-play
// sign-up. Support asks only about what the page is missing; "Go live" saves it. Props in.
import { useState, type CSSProperties } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import type { SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { SLP_SCENE_FIELDS } from "../../../../../shared/src/slp/slp-scene.js";
import { Modal } from "../../../components/ui/Modal";
import { getSlpAccentStyle, SLP_PINK } from "../../base/chrome/SlpChrome";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { useSlurpCreatorSteering } from "../creators/slp-creators-contract";
import { useSlurpSettings } from "../settings/slp-settings-contract";
import { slpSceneUpdateState } from "./slp-scene-draft";
import { SlpSceneOnboarding } from "./SlpSceneOnboarding";

type SlpUpdatableCreator = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  bio: string;
  stagePersonality: string;
  appearance: string;
  wardrobe: string;
  locations: string;
  gender: "male" | "female" | "other" | null;
  tags: readonly string[];
  disclosureMode: SlpIdentityDisclosure | null;
  sourceAccountId: string | null;
};

/** "Fill in their page": how many fields are empty, and the scene that fills them. */
export function SlpSceneUpdate({ creator }: { creator: SlpUpdatableCreator }) {
  const { t } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const steering = useSlurpCreatorSteering(creator.id).data;
  const settings = useSlurpSettings().data;
  // Only from the loaded page and limits: an empty start would let the chat replace saved likes and noes.
  if (!steering) return null;
  const state = slpSceneUpdateState(creator, steering.steering, steering.spice);
  const missing = SLP_SCENE_FIELDS.length - state.locked.length;
  // The scene speaks for the Engine card the Creator came from; without it there is nobody to play.
  if (!creator.sourceAccountId || missing === 0) return null;
  const sourceAccountId = creator.sourceAccountId;
  return (
    <>
      <SlpButton variant="quiet" onClick={() => setOpen(true)} className="w-full justify-start">
        <MessageCircle size={16} aria-hidden="true" />
        {t("ui.slurp.scene.update.open", { count: missing })}
      </SlpButton>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("ui.slurp.scene.update.title", { name: creator.displayName })}
        width="max-w-4xl"
        mobileFullscreen
        contentClassName="max-sm:flex max-sm:flex-col max-sm:overflow-hidden max-sm:px-4 max-sm:py-2"
        panelStyle={getSlpAccentStyle(SLP_PINK, {
          "--background": "var(--slurp-surface)",
          "--foreground": "var(--slurp-text)",
          "--muted-foreground": "var(--slurp-muted)",
        } as CSSProperties)}
      >
        {open && (
          <div className="flex h-[min(78vh,46rem)] flex-col text-[var(--slurp-text)] max-sm:h-auto max-sm:flex-1">
            <SlpSceneOnboarding
              accounts={[]}
              connectionId={settings?.generationConnectionId || undefined}
              existing={{
                preset: "support",
                source: {
                  id: sourceAccountId,
                  displayName: creator.displayName,
                  handle: creator.handle,
                  avatarUrl: creator.avatarUrl,
                },
                disclosureMode: creator.disclosureMode ?? "hinted",
                existing: { accountId: creator.id, state },
              }}
              onBack={() => setOpen(false)}
              onQuickSetup={() => setOpen(false)}
              onFinished={() => {
                toast.success(t("ui.slurp.scene.update.saved", { name: creator.displayName }));
                setOpen(false);
              }}
              onSeeFeed={() => setOpen(false)}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
