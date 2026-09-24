import type { SlurpPostAxes } from "../../modules/feed/slp-content-axes.js";
import type { SlurpPostVariation } from "../../modules/feed/slp-post-variation.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";
import type { SlurpExplicitLevel, SlurpPostAccess } from "../../modules/feed/slp-post-guidance.js";
import type { SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { normalizeSlpImagePrompt } from "../../base/media/slp-image-prompt.js";
import { slurpImageBrief, slurpImageNegativePrompt } from "../../modules/feed/slp-image-brief.js";
import { slurpCameraSourcePhoto, type SlurpCameraSource } from "../../modules/feed/slp-camera-source.js";
import { slurpVisualBriefFromSituation } from "../../modules/feed/slp-visual-brief.js";
import { slurpPostSexualLevel } from "../../modules/feed/slp-post-guidance.js";
import {
  slurpEffortPhoto,
  slurpProductionPhoto,
  type SlurpPostEffort,
  type SlurpProductionStyle,
} from "../../modules/creators/slp-production-profile.js";
import { slurpArcImageLine } from "../../modules/projects/slp-arc-progress.js";
import { protectCreatorGeneratedIdentity } from "../../base/identity/slp-identity-protection.js";
import type { SlpSceneShot, SlpWardrobeLook, SlpWardrobeScene } from "../../../../../shared/src/slp/slp-wardrobe.js";

/**
 * The two pictures briefs for one post: the prose draft the image prompt is built from, and the
 * typed brief the renderer must preserve.
 *
 * They are assembled together because they describe the same photograph. Built apart, they drifted
 * — the prose said one thing about how far the picture goes and the typed `sexualLevel` said
 * another, and the renderer believes the typed one.
 */
export function slurpPostPictureBriefs(input: {
  project: Parameters<typeof slurpArcImageLine>[0];
  variation: SlurpPostVariation | null | undefined;
  camera: SlurpCameraSource | null | undefined;
  effort: SlurpPostEffort;
  productionStyle?: SlurpProductionStyle;
  shoot?: { place: string; company: string; brief?: string } | null;
  axes: Pick<SlurpPostAxes, "intent"> | null | undefined;
  story?: boolean;
  postImages: boolean;
  access: SlurpPostAccess;
  explicitLevel: SlurpExplicitLevel;
  /** The model's own idea, used only when there is no situation to brief from. */
  modelImagePrompt: string | null | undefined;
  /** This Creator's own look and life. See `SlpCreatorStageFacts`. */
  stageFacts?: { wardrobe?: string; locations?: string };
  scene?: SlpWardrobeScene | null;
  selectedWardrobe?: SlpWardrobeLook | null;
  disclosureMode: SlpIdentityDisclosure;
  publicIdentity: Parameters<typeof protectCreatorGeneratedIdentity>[2];
  /** A set's extra pictures, as the post model planned them. */
  shots?: readonly SlpSceneShot[];
}): {
  draftImagePrompt: string | null;
  visualBrief: SlurpVisualBrief | undefined;
  /** What the level and the one-person rule forbid, for the provider's negative prompt. */
  negativePrompt: string | undefined;
  /** One brief per planned extra picture, each complete on its own. */
  shotBriefs: { draftPrompt: string; visualBrief: SlurpVisualBrief | undefined }[];
} {
  const { variation, camera } = input;
  // Identity protection applies to the image prompt too, not only post text. The arc's chapter line
  // joins the prompt before protection, so a chapter naming a real place is redacted the same way.
  const arcImageLine = slurpArcImageLine(input.project);
  const sexualLevel = slurpPostSexualLevel({
    level: input.explicitLevel,
    access: input.access,
    intent: input.axes?.intent,
  });
  // Produce mode briefs the picture from the situation, never from the caption the model just
  // wrote. Identity protection still applies: the brief carries the Creator's own place and
  // company, so a Secret Creator's details must be redacted here exactly as they are in the text.
  const effortPhoto = `${slurpProductionPhoto(input.productionStyle ?? "homemade")}; ${slurpEffortPhoto(input.effort)}`;
  const imageDraft =
    // A post direction can ask the model for its own imagePrompt; a returned one is honoured.
    normalizeSlpImagePrompt(input.modelImagePrompt) ??
    (camera && variation
      ? slurpImageBrief({
          cameraPhoto: slurpCameraSourcePhoto(camera),
          variation,
          story: input.story,
          shoot: input.shoot,
          effortPhoto,
          sexualLevel,
          stageFacts: input.stageFacts,
          scene: input.scene,
          selectedWardrobe: input.selectedWardrobe,
        })
      : null);
  return {
    draftImagePrompt: input.postImages
      ? protectCreatorGeneratedIdentity(
          imageDraft && arcImageLine ? `${imageDraft}\n${arcImageLine}` : imageDraft,
          input.disclosureMode,
          input.publicIdentity,
        )
      : null,
    visualBrief:
      input.postImages && variation && camera
        ? slurpVisualBriefFromSituation({
            variation,
            axes: input.axes,
            cameraInstruction: slurpCameraSourcePhoto(camera),
            effortInstruction: effortPhoto,
            shoot: input.shoot,
            story: input.story,
            access: input.access,
            explicitLevel: input.explicitLevel,
            scene: input.scene,
            clothing: input.selectedWardrobe?.description ?? input.scene?.outfit ?? input.stageFacts?.wardrobe ?? null,
          })
        : undefined,
    negativePrompt: input.postImages && camera && variation ? slurpImageNegativePrompt(sexualLevel) : undefined,
    // Each extra picture is briefed exactly like the first, so it reaches the image model as a
    // complete picture. A shot that names its own outfit wears it; otherwise it keeps the chosen look.
    shotBriefs: (input.shots ?? []).flatMap((shot) => {
      const brief = slurpPostPictureBriefs({
        ...input,
        shots: undefined,
        modelImagePrompt: null,
        scene: shot,
        selectedWardrobe: shot.outfit?.trim() ? null : input.selectedWardrobe,
      });
      return brief.draftImagePrompt ? [{ draftPrompt: brief.draftImagePrompt, visualBrief: brief.visualBrief }] : [];
    }),
  };
}
