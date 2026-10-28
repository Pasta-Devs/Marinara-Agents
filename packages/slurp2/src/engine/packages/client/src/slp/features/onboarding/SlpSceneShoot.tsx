// The friend's photo-shoot moment: pick the outfit and the place, then the real image pipeline
// takes the profile photo and the cover. Shown above the composer while the moment is on.
import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import type { SlpSceneModel } from "./slp-scene-model";

const firstLine = (value: string) =>
  value
    .split(/\n|\.\s/u)[0]
    ?.trim()
    .slice(0, 160) ?? "";

export function SlpSceneShoot({ model, onMissing }: { model: SlpSceneModel; onMissing: (missing: string[]) => void }) {
  const { t } = useUiTranslation();
  // The fields follow what the chat picks (the outfit talk fills wardrobe and places) until the
  // player types in them.
  const [typedOutfit, setOutfit] = useState<string | null>(null);
  const [typedPlace, setPlace] = useState<string | null>(null);
  const outfit = typedOutfit ?? firstLine(model.draft.wardrobe);
  const place = typedPlace ?? firstLine(model.draft.locations);
  const done = Boolean(model.photos.avatarUrl);
  // Once outfit and place are there, taking the photos is the lit-up next move.
  const TakeButton = !done && (outfit.trim() || place.trim()) ? SlpPrimaryButton : SlpButton;
  const input =
    "h-11 w-full min-w-0 rounded-xl bg-[var(--slurp-canvas)] sm:flex-1 px-3 text-base text-[var(--slurp-text)] outline-none ring-1 ring-inset ring-[var(--noodle-divider)] placeholder:text-[var(--slurp-muted)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-[13px]";
  return (
    <section
      aria-label={t("ui.slurp.scene.shoot.title")}
      className="mt-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]"
    >
      <p className={cn(SLP_TYPE.body, "flex items-center gap-1.5 font-semibold")}>
        <Camera size={15} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />
        {t("ui.slurp.scene.shoot.title")}
      </p>
      <div className="mt-2 flex gap-2 max-sm:flex-col">
        <input
          aria-label={t("ui.slurp.scene.shoot.outfit")}
          placeholder={t("ui.slurp.scene.shoot.outfit")}
          value={outfit}
          maxLength={400}
          onChange={(event) => setOutfit(event.target.value)}
          className={input}
        />
        <input
          aria-label={t("ui.slurp.scene.shoot.place")}
          placeholder={t("ui.slurp.scene.shoot.place")}
          value={place}
          maxLength={400}
          onChange={(event) => setPlace(event.target.value)}
          className={input}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p aria-live="polite" className={cn(SLP_TYPE.meta, "min-w-0 text-[var(--slurp-muted)]")}>
          {model.shooting ? t(`ui.slurp.scene.shoot.shooting.${model.shooting}`) : t("ui.slurp.scene.shoot.help")}
        </p>
        <TakeButton
          className="min-h-9 shrink-0 px-3.5 text-xs"
          disabled={model.busy || (!outfit.trim() && !place.trim())}
          onClick={async () => {
            const missing = await model.shoot(outfit, place);
            if (missing?.length) onMissing(missing);
          }}
        >
          {model.shooting ? <Loader2 size={14} aria-hidden="true" className="animate-spin" /> : <SlpUsesAiMark />}
          {done ? t("ui.slurp.scene.shoot.again") : t("ui.slurp.scene.shoot.take")}
        </TakeButton>
      </div>
    </section>
  );
}
