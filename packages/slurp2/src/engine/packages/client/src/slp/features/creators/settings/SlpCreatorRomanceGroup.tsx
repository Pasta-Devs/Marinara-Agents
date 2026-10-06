import { useTranslation } from "react-i18next";
import type { SlpCreatorManagedStageProfile } from "../../../../../../shared/src/slp/slp-social.types.js";
import { Avatar } from "../../../base/chrome/SlpChrome";
import { SettingsGroup, Toggle } from "../../../modules/settings/SlpSettingsControls";
import { noteClass } from "../slp-creator-classes";
import { useSlurpCreatorSteering, useSlurpCreatorSteeringMutations } from "../slp-steering-hooks";

/**
 * Romance with other Creators (0.3.17): off, or only with the Creators picked here (none picked =
 * anyone who fits their card), and never with others (R4). The world, storylines and dramas keep to
 * it; your own Stir set-up can still bring two together.
 */
export function SlpCreatorRomanceGroup({
  creator,
  creators,
}: {
  creator: SlpCreatorManagedStageProfile;
  creators: SlpCreatorManagedStageProfile[];
}) {
  const { t } = useTranslation();
  const steering = useSlurpCreatorSteering(creator.id);
  const { patch } = useSlurpCreatorSteeringMutations(creator.id);
  const romance = steering.data?.steering.romance ?? { off: false, only: [], never: [] };
  const never = romance.never ?? [];
  const others = creators.filter((entry) => entry.id !== creator.id);
  // Only from the loaded value: saving the fallback would wipe a saved list.
  const ready = Boolean(steering.data) && !patch.isPending;
  const save = (next: typeof romance) => ready && patch.mutate({ romance: next });
  // One Creator is on one list at most: "only" and "never" with the same person contradict.
  const pick = (id: string) =>
    save({
      ...romance,
      only: romance.only.includes(id) ? romance.only.filter((entry) => entry !== id) : [...romance.only, id],
      never: never.filter((entry) => entry !== id),
    });
  const block = (id: string) =>
    save({
      ...romance,
      only: romance.only.filter((entry) => entry !== id),
      never: never.includes(id) ? never.filter((entry) => entry !== id) : [...never, id],
    });
  const list = (note: string, chosen: readonly string[], toggle: (id: string) => void) => (
    <div className="space-y-1">
      <p className={noteClass}>{note}</p>
      {others.map((partner) => (
        <label key={partner.id} className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={chosen.includes(partner.id)}
            onChange={() => toggle(partner.id)}
            disabled={!ready}
            className="size-4 accent-[var(--noodle-accent)]"
          />
          <Avatar account={partner} size="sm" />
          <span className="min-w-0 flex-1 truncate">{partner.displayName}</span>
        </label>
      ))}
    </div>
  );
  return (
    <SettingsGroup title={t("ui.slurp.settings.creators.romanceGroup")}>
      <Toggle
        label={t("ui.slurp.settings.creators.romance", { name: creator.displayName })}
        detail={t("ui.slurp.settings.creators.romanceDetail")}
        value={!romance.off}
        onChange={(on) => save({ ...romance, off: !on })}
      />
      {!romance.off && others.length > 0 && (
        <>
          {list(t("ui.slurp.settings.creators.romanceOnly"), romance.only, pick)}
          {list(t("ui.slurp.settings.creators.romanceNever"), never, block)}
        </>
      )}
    </SettingsGroup>
  );
}
