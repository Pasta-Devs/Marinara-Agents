import { useState, type ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Radio } from "lucide-react";
import { Avatar } from "../../base/chrome/SlpChrome";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { useSlpStirDeck } from "../../base/state/slp-stir-sheet-store";
import { SlpButton, SlpChip, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { useSlurpSettings } from "../settings/slp-settings-contract";
import { useSlpLiveHost } from "./slp-live-hooks";

const LENGTHS = [15, 30, 60];

export type SlpLiveHostChoice = { id: string; name: string; avatarUrl: string | null; own: boolean };

/**
 * Go live (LIVE-V3-PLAN.md "The player hosts"). Without `hosts` the player hosts as their persona's own
 * Creator; with `hosts` (Stir) they pick their own Creator or a Creator to play.
 */
export function SlpLiveGoLive({
  hosts,
  className,
  trigger,
}: {
  hosts?: readonly SlpLiveHostChoice[];
  className?: string;
  /** Draws the opener (the Stir tile); the default is a small button. */
  trigger?: (open: () => void) => ReactNode;
}) {
  const { t } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(30);
  const host = useSlpLiveHost();
  const personaId = useSlurpUIStore((state) => state.viewerPersonaId);
  const navigation = useSlurpUIStore((state) => state.navigation);
  const setNavigation = useSlurpUIStore((state) => state.setNavigation);
  const choice = hosts?.find((entry) => entry.id === pick) ?? hosts?.find((entry) => entry.own) ?? null;
  const settings = useSlurpSettings().data;
  if (!personaId || !settings || !slpExtensionOn(settings, "live")) return null;
  const go = () =>
    host.mutate(
      { personaId, minutes, ...(choice && !choice.own ? { creatorId: choice.id } : {}) },
      {
        onSuccess: (view) => {
          setOpen(false);
          useSlpStirDeck.setState({ open: false }); // a go-live from a Stir action must not leave the deck over the show
          setNavigation({ mode: "creator", view: "live", showId: view.id, returnTo: navigation });
        },
      },
    );
  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <SlpButton variant="quiet" onClick={() => setOpen(true)} className={className ?? "min-h-10 px-3.5 text-xs"}>
          <Radio size={14} aria-hidden="true" />
          {t("ui.slurp.live.goLive")}
        </SlpButton>
      )}
      <SlpSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("ui.slurp.live.goLiveTitle")}
        closeDisabled={host.isPending}
        footer={
          <SlpPrimaryButton className="h-12 w-full" disabled={host.isPending} onClick={go}>
            {t("ui.slurp.live.goLiveStart", { minutes })}
          </SlpPrimaryButton>
        }
      >
        <div className="space-y-4 p-1">
          {hosts && hosts.length > 0 && (
            <div role="group" aria-label={t("ui.slurp.live.goLiveAs")} className="space-y-2">
              <p className="text-xs font-semibold text-[var(--slurp-muted)]">{t("ui.slurp.live.goLiveAs")}</p>
              <div className="flex flex-wrap gap-2">
                {hosts.map((entry) => (
                  <SlpChip key={entry.id} selected={entry.id === choice?.id} onClick={() => setPick(entry.id)}>
                    <Avatar account={{ displayName: entry.name, avatarUrl: entry.avatarUrl }} size="xs" />
                    {entry.own ? t("ui.slurp.live.goLiveOwn", { name: entry.name }) : entry.name}
                  </SlpChip>
                ))}
              </div>
            </div>
          )}
          <div role="group" aria-label={t("ui.slurp.live.goLiveLength")} className="space-y-2">
            <p className="text-xs font-semibold text-[var(--slurp-muted)]">{t("ui.slurp.live.goLiveLength")}</p>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((entry) => (
                <SlpChip key={entry} selected={entry === minutes} onClick={() => setMinutes(entry)}>
                  {t("ui.slurp.live.goLiveMinutes", { minutes: entry })}
                </SlpChip>
              ))}
            </div>
          </div>
          {host.isError && (
            <p role="alert" className="text-sm text-[var(--slurp-danger)]">
              {t("ui.slurp.live.goLiveFailed")}
            </p>
          )}
        </div>
      </SlpSheet>
    </>
  );
}
