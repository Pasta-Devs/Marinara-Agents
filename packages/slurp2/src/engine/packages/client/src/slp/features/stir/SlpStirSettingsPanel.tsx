import { useTranslation } from "react-i18next";
import { AdvancedGroup, Field, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlpExtensionSwitch } from "../../modules/settings/SlpExtensionSwitch";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import {
  SLP_DESK_RATES,
  SLP_DESK_TICKET_PACES,
  type SlpSupportDeskSettings,
} from "../../../../../shared/src/slp/slp-support-desk.js";

/**
 * Settings › Support desk: how the Slurp Support desk plays (docs/SUPPORT-DESK.md). One stored object,
 * `supportDesk`; every control saves the whole object with its one field changed.
 */
export function SlpStirSettingsPanel(page: SlpBackstagePageProps) {
  const { settings, updateNow } = page;
  const { t } = useTranslation();
  const tx = (key: string, defaultValue: string) => t(`ui.slurp.stir.settings.${key}`, { defaultValue });
  return (
    <div className="space-y-5">
      <BackstagePageHeader
        detail={tx(
          "detail",
          "Slurp Support is Slurp's own staff. You write as Support to Creators you do not run: steer them, reward them, and play them. These settings decide how that game plays.",
        )}
      />
      {/* Two extensions share this page: Stir (the tab's levers) and the Support desk (the staff game). */}
      <SlpExtensionSwitch
        settingKey="extStir"
        label={t("ui.slurp.settings.ext.stir.label", { defaultValue: "Stir" })}
        detail={t("ui.slurp.settings.ext.stir.detail", {
          defaultValue: "The Stir tab: the planner, the lever deck and In play.",
        })}
        on={slpExtensionOn(settings, "stir")}
        onChange={(value) => void updateNow("extStir", value)}
      />
      <SlpExtensionSwitch
        settingKey="extSupportDesk"
        label={t("ui.slurp.settings.ext.supportDesk.label", { defaultValue: "Support desk" })}
        detail={t("ui.slurp.settings.ext.supportDesk.detail", {
          defaultValue: "The staff game: tickets, trust, suspicion, offers, perks, notices and Creators who leave.",
        })}
        on={slpExtensionOn(settings, "supportDesk")}
        onChange={(value) => void updateNow("extSupportDesk", value)}
      />
      {slpExtensionOn(settings, "supportDesk") && <SlpDeskSettings {...page} />}
    </div>
  );
}

function SlpDeskSettings({ settings, update, updateSettings }: SlpBackstagePageProps) {
  const { t } = useTranslation();
  const desk = settings.supportDesk;
  const set = <K extends keyof SlpSupportDeskSettings>(key: K, value: SlpSupportDeskSettings[K]) =>
    void update("supportDesk", { ...desk, [key]: value });
  const tx = (key: string, defaultValue: string) => t(`ui.slurp.stir.settings.${key}`, { defaultValue });
  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SettingsGroup title={tx("groupCreators", "What Creators do")}>
          <ChoiceSetting
            settingKey="supportDesk"
            label={tx("tickets", "Creators write in")}
            detail={tx(
              "ticketsDetail",
              "Creators open tickets with Support on their own: views dropped, a fan is too much, they want a badge. Each ticket ends with a rating that moves their trust.",
            )}
            options={SLP_DESK_TICKET_PACES.map((value) => ({
              value,
              label: tx(
                `ticketPace.${value}`,
                { off: "Off", rare: "Rarely", sometimes: "Sometimes", often: "Often" }[value],
              ),
            }))}
            value={desk.tickets}
            disabled={updateSettings.isPending}
            onChange={(value) => set("tickets", value)}
          />
          <Toggle
            label={tx("refusals", "Creators can say no")}
            detail={tx(
              "refusalsDetail",
              "Trust matters: a Creator who trusts Slurp little may turn an offer down or ask for more. Off, they always go along.",
            )}
            value={desk.refusals}
            onChange={(value) => set("refusals", value)}
          />
          <Toggle
            label={tx("leaving", "Creators can leave Slurp")}
            detail={tx(
              "leavingDetail",
              "At the bottom of trust a Creator warns they are leaving, and you get a few days to win them back. A Creator who leaves is paused, never deleted. Off, they only go quiet.",
            )}
            value={desk.leaving}
            onChange={(value) => set("leaving", value)}
          />
        </SettingsGroup>
        <SettingsGroup title={tx("groupYou", "What Support can do")}>
          <Toggle
            label={tx("shadyMoves", "Shady moves")}
            detail={tx(
              "shadyMovesDetail",
              "Quiet reach throttles, planted rumours and warnings without cause. Each one raises the Creator's suspicion, and a suspicious Creator may catch you.",
            )}
            value={desk.shadyMoves}
            onChange={(value) => set("shadyMoves", value)}
          />
          <Toggle
            label={tx("toYourCreators", "Support writes to your Creators")}
            detail={tx(
              "toYourCreatorsDetail",
              "The Creators you run get Slurp's notices, badges and offers too, and you answer them as the Creator.",
            )}
            value={desk.toYourCreators}
            onChange={(value) => set("toYourCreators", value)}
          />
          <Toggle
            label={tx("gamesWithYourCreators", "Slurp plays games with your Creators too")}
            detail={tx(
              "gamesWithYourCreatorsDetail",
              "Slurp may quietly throttle your Creators, plant rumours with them or warn them. Off, Slurp is always honest with you.",
            )}
            value={desk.gamesWithYourCreators}
            onChange={(value) => set("gamesWithYourCreators", value)}
            disabledReason={
              desk.toYourCreators ? null : tx("needsToYourCreators", "Needs Support to write to your Creators.")
            }
          />
        </SettingsGroup>
      </div>
      <SettingsGroup title={tx("groupNotices", "Slurp's notices")}>
        <Toggle
          label={tx("noticeMilestones", "Milestones")}
          detail={tx("noticeMilestonesDetail", "Follower and earnings milestones, badges given.")}
          value={desk.noticeMilestones}
          onChange={(value) => set("noticeMilestones", value)}
        />
        <Toggle
          label={tx("noticeTrending", "Trending posts")}
          detail={tx("noticeTrendingDetail", "A post that is doing much better than usual.")}
          value={desk.noticeTrending}
          onChange={(value) => set("noticeTrending", value)}
        />
        <Toggle
          label={tx("noticeResults", "Results")}
          detail={tx("noticeResultsDetail", "Challenges won or failed, contract weeks kept or broken.")}
          value={desk.noticeResults}
          onChange={(value) => set("noticeResults", value)}
        />
      </SettingsGroup>
      <AdvancedGroup title={t("ui.slurp.settings.advanced.group")} count={3}>
        <ChoiceSetting
          label={tx("trustRate", "How fast trust moves")}
          options={SLP_DESK_RATES.map((value) => ({
            value,
            label: tx(`rate.${value}`, { low: "Slow", normal: "Normal", high: "Fast" }[value]),
          }))}
          value={desk.trustRate}
          disabled={updateSettings.isPending}
          onChange={(value) => set("trustRate", value)}
        />
        <ChoiceSetting
          label={tx("suspicionRate", "How fast suspicion rises")}
          options={SLP_DESK_RATES.map((value) => ({
            value,
            label: tx(`rate.${value}`, { low: "Slow", normal: "Normal", high: "Fast" }[value]),
          }))}
          value={desk.suspicionRate}
          disabled={updateSettings.isPending}
          onChange={(value) => set("suspicionRate", value)}
        />
        <Field
          label={tx("winBackDays", "Days to win a Creator back")}
          detail={tx("winBackDaysDetail", "How long the leave warning lasts before the Creator goes.")}
          disabledReason={desk.leaving ? null : tx("needsLeaving", "Needs Creators can leave Slurp.")}
        >
          <NumberSetting
            label={tx("winBackDays", "Days to win a Creator back")}
            value={desk.winBackDays}
            min={1}
            max={14}
            stepper
            disabled={!desk.leaving || updateSettings.isPending}
            onSave={(value) => set("winBackDays", value)}
          />
        </Field>
      </AdvancedGroup>
    </>
  );
}
