import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";

import { AdvancedGroup, Field, NumberSetting, Toggle } from "../../modules/settings/SlpSettingsControls";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Coins and access: unlock and subscription pricing, rewards and revenue share. */
export function SlpWalletPanel(page: SlpBackstagePageProps) {
  const { t, settings, update } = page;

  return (
    <div className="space-y-5">
      <BackstagePageHeader
        title={t("ui.slurp.settings.wallet.title", { defaultValue: "SlurpCoins" })}
        detail={t("ui.slurp.settings.wallet.detail", {
          defaultValue: "Prices, earning, and the daily stipend.",
        })}
      />
      <div className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <p>
          {t("ui.slurp.settings.wallet.explainer", {
            defaultValue:
              "With SlurpCoins off, prices are decoration and nothing is ever charged. With them on, unlocking a post and subscribing to a creator both cost SlurpCoins, and running out has consequences: a subscription you cannot pay for lapses.",
          })}
        </p>
        <p className="mt-2">
          {t("ui.slurp.settings.wallet.explainerEarning", {
            defaultValue:
              "The daily stipend tops your balance up to a floor rather than adding to it, so a spender is never stranded and a hoarder is never paid to hoard. Ad and posting rewards are capped per day, so nothing here can be farmed.",
          })}
        </p>
      </div>
      <Toggle
        settingKey="walletEnabled"
        label={t("ui.slurp.settings.wallet.enabled", {
          defaultValue: "SlurpCoins actually cost something",
        })}
        detail={t("ui.slurp.settings.wallet.enabledDetail", {
          defaultValue: "Off keeps prices as decoration, which is how Slurp has always behaved.",
        })}
        value={settings.walletEnabled}
        onChange={(value) => update("walletEnabled", value)}
      />
      <Field
        settingKey="walletUnlockCost"
        label={t("ui.slurp.settings.wallet.unlockCost", { defaultValue: "Unlock a post" })}
        detail={t("ui.slurp.settings.wallet.unlockCostDetail", {
          defaultValue: "Default price for a locked post. A post keeps the price it was created with.",
        })}
      >
        <NumberSetting
          value={settings.walletUnlockCost}
          min={0}
          max={9999}
          onSave={(value) => update("walletUnlockCost", value)}
        />
      </Field>
      <Field
        settingKey="walletSubscriptionCost"
        label={t("ui.slurp.settings.wallet.subscriptionCost", { defaultValue: "Subscribe, per week" })}
        detail={t("ui.slurp.settings.wallet.subscriptionCostDetail", {
          defaultValue:
            "Default weekly price. A creator with its own price uses that instead. Subscriptions renew every seven days.",
        })}
      >
        <NumberSetting
          value={settings.walletSubscriptionCost}
          min={0}
          max={9999}
          onSave={(value) => update("walletSubscriptionCost", value)}
        />
      </Field>
      <Toggle
        settingKey="pricingDynamicCharacters"
        label={t("ui.slurp.settings.wallet.pricingDynamicCharacters", {
          defaultValue: "Character Creators set their own prices",
        })}
        detail={t("ui.slurp.settings.wallet.pricingDynamicCharactersDetail", {
          defaultValue:
            "Once a week, each character Creator moves its subscription, locked post, and commission prices with its popularity. Current subscribers keep their price.",
        })}
        value={settings.pricingDynamicCharacters}
        onChange={(value) => update("pricingDynamicCharacters", value)}
      />
      {settings.pricingDynamicCharacters && (
        <Field
          settingKey="pricingMaxWeeklyChangePercent"
          label={t("ui.slurp.settings.wallet.pricingMaxWeeklyChange", {
            defaultValue: "Largest weekly price change, %",
          })}
          detail={t("ui.slurp.settings.wallet.pricingMaxWeeklyChangeDetail", {
            defaultValue: "How far one weekly adjustment may move a price. Zero freezes prices.",
          })}
        >
          <NumberSetting
            value={settings.pricingMaxWeeklyChangePercent}
            min={0}
            max={100}
            onSave={(value) => update("pricingMaxWeeklyChangePercent", value)}
          />
        </Field>
      )}
      <AdvancedGroup
        title={t("ui.slurp.settings.backstage.landing.earningFineTune", {
          defaultValue: "Earning, stipend, and revenue share",
        })}
        count={7}
      >
        <Field
          settingKey="walletStipendFloor"
          label={t("ui.slurp.settings.wallet.stipendFloor", { defaultValue: "Daily top-up floor" })}
          detail={t("ui.slurp.settings.wallet.stipendFloorDetail", {
            defaultValue: "Once a day, a balance below this is topped up to it. Zero turns the stipend off entirely.",
          })}
        >
          <NumberSetting
            value={settings.walletStipendFloor}
            min={0}
            max={99_999}
            onSave={(value) => update("walletStipendFloor", value)}
          />
        </Field>
        <Field
          settingKey="walletDayStartHour"
          label={t("ui.slurp.settings.wallet.dayStartHour")}
          detail={t("ui.slurp.settings.wallet.dayStartHourDetail")}
        >
          <NumberSetting
            value={settings.walletDayStartHour}
            min={0}
            max={23}
            onSave={(value) => update("walletDayStartHour", value)}
          />
        </Field>
        <Field
          settingKey="walletAdReward"
          label={t("ui.slurp.settings.wallet.adReward", { defaultValue: "Paid per ad you act on" })}
          detail={t("ui.slurp.settings.wallet.adRewardDetail", {
            defaultValue: "Zero turns ad rewards off.",
          })}
        >
          <NumberSetting
            value={settings.walletAdReward}
            min={0}
            max={999}
            onSave={(value) => update("walletAdReward", value)}
          />
        </Field>
        <Field
          settingKey="walletAdDailyCap"
          label={t("ui.slurp.settings.wallet.adDailyCap", { defaultValue: "Most ad SlurpCoins per day" })}
          detail={t("ui.slurp.settings.wallet.adDailyCapDetail", {
            defaultValue: "The cap is what stops ad clicking from becoming a job.",
          })}
        >
          <NumberSetting
            value={settings.walletAdDailyCap}
            min={0}
            max={9999}
            onSave={(value) => update("walletAdDailyCap", value)}
          />
        </Field>
        <Field
          settingKey="walletEngagementReward"
          label={t("ui.slurp.settings.wallet.engagementReward", {
            defaultValue: "Paid per post or comment",
          })}
          detail={t("ui.slurp.settings.wallet.engagementRewardDetail", {
            defaultValue: "Zero turns posting rewards off.",
          })}
        >
          <NumberSetting
            value={settings.walletEngagementReward}
            min={0}
            max={999}
            onSave={(value) => update("walletEngagementReward", value)}
          />
        </Field>
        <Field
          settingKey="walletEngagementDailyCap"
          label={t("ui.slurp.settings.wallet.engagementDailyCap", {
            defaultValue: "Most posting SlurpCoins per day",
          })}
          detail={t("ui.slurp.settings.wallet.engagementDailyCapDetail", {
            defaultValue: "The cap is what stops posting from becoming a grind.",
          })}
        >
          <NumberSetting
            value={settings.walletEngagementDailyCap}
            min={0}
            max={9999}
            onSave={(value) => update("walletEngagementDailyCap", value)}
          />
        </Field>
        <Field
          settingKey="walletCreatorRevenueSharePercent"
          label={t("ui.slurp.settings.wallet.creatorShare", {
            defaultValue: "Creator keeps, in percent",
          })}
          detail={t("ui.slurp.settings.wallet.creatorShareDetail", {
            defaultValue:
              "When a fan pays one of your own creators, this share reaches your wallet. Zero means your creators earn nothing.",
          })}
        >
          <NumberSetting
            value={settings.walletCreatorRevenueSharePercent}
            min={0}
            max={100}
            onSave={(value) => update("walletCreatorRevenueSharePercent", value)}
          />
        </Field>
      </AdvancedGroup>
    </div>
  );
}
