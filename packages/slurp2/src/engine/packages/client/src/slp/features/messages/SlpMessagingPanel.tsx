import { MessageCircle } from "lucide-react";
import { BackstagePageHeader, BackstageWizard } from "../../modules/settings/SlpSettingsKit";

import {
  AdvancedGroup,
  Field,
  NumberSetting,
  RangePairField,
  SettingsGroup,
  Toggle,
} from "../../modules/settings/SlpSettingsControls";
import { ChoiceSetting, StatusStrip } from "../../modules/settings/SlpSettingsInputs";

import type { SlurpSettings } from "../settings/slp-settings-contract";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Messaging rules: DM policy, away replies, fees and reply timing. */
export function SlpMessagingPanel(page: SlpBackstagePageProps) {
  const {
    t,
    updateSettings,
    settings,
    update,
    updatePatch,
    messagingWizardOpen,
    setMessagingWizardOpen,
    messagingDraft,
    setMessagingDraft,
  } = page;

  const onOff = (value: boolean) => t(value ? "ui.slurp.settings.overview.on" : "ui.slurp.settings.overview.off");
  const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BackstagePageHeader
          title={t("ui.slurp.settings.messaging.title")}
          detail={t("ui.slurp.settings.messaging.detail")}
        />
        <StatusStrip
          label={t("ui.slurp.settings.strip.label")}
          items={[
            {
              label: t("ui.slurp.settings.strip.dms"),
              value: t(`ui.slurp.settings.messaging.dmPolicy${cap(settings.messagesDefaultDmPolicy)}`),
              settingKey: "messagesDefaultDmPolicy",
            },
            {
              label: t("ui.slurp.settings.strip.away"),
              value: onOff(settings.messagesAwayRepliesEnabled),
              settingKey: "messagesAwayRepliesEnabled",
            },
          ]}
        />
        <button
          type="button"
          aria-expanded={messagingWizardOpen}
          onClick={() => {
            setMessagingDraft({
              messagesAwayRepliesEnabled: settings.messagesAwayRepliesEnabled,
              messagesDefaultDmPolicy: settings.messagesDefaultDmPolicy,
              messagesReplyBubbleLimit: settings.messagesReplyBubbleLimit,
              messagesMaxReplyDelayMinutes: settings.messagesMaxReplyDelayMinutes,
            });
            setMessagingWizardOpen((open) => !open);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          <MessageCircle size={14} aria-hidden="true" />
          {t("ui.slurp.settings.backstage.wizard.messagingTitle", { defaultValue: "Set up messages" })}
        </button>
      </div>
      {messagingWizardOpen && messagingDraft && (
        <BackstageWizard
          title={t("ui.slurp.settings.backstage.wizard.messagingTitle", { defaultValue: "Set up messages" })}
          preset={null}
          current={settings}
          proposed={{ ...settings, ...messagingDraft }}
          patch={messagingDraft}
          pending={updateSettings.isPending}
          onCancel={() => setMessagingWizardOpen(false)}
          onApply={(patch) => {
            void updatePatch(patch);
            setMessagingWizardOpen(false);
          }}
          steps={[
            {
              id: "access",
              title: t("ui.slurp.settings.backstage.wizard.messagingAccess", {
                defaultValue: "Choose who can message",
              }),
              content: (
                <Field label={t("ui.slurp.settings.messaging.dmPolicy")}>
                  <select
                    value={messagingDraft.messagesDefaultDmPolicy}
                    onChange={(event) =>
                      setMessagingDraft({
                        ...messagingDraft,
                        messagesDefaultDmPolicy: event.target.value as SlurpSettings["messagesDefaultDmPolicy"],
                      })
                    }
                    className="min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm"
                  >
                    <option value="open">{t("ui.slurp.settings.messaging.dmPolicyOpen")}</option>
                    <option value="subscribers">{t("ui.slurp.settings.messaging.dmPolicySubscribers")}</option>
                    <option value="paid">{t("ui.slurp.settings.messaging.dmPolicyPaid")}</option>
                    <option value="closed">{t("ui.slurp.settings.messaging.dmPolicyClosed")}</option>
                  </select>
                </Field>
              ),
            },
            {
              id: "replies",
              title: t("ui.slurp.settings.backstage.wizard.messagingReplies", {
                defaultValue: "Choose reply behavior",
              }),
              content: (
                <div className="space-y-3">
                  <Toggle
                    label={t("ui.slurp.settings.messaging.awayReplies")}
                    detail={t("ui.slurp.settings.messaging.awayRepliesDetail")}
                    value={messagingDraft.messagesAwayRepliesEnabled}
                    onChange={(value) => setMessagingDraft({ ...messagingDraft, messagesAwayRepliesEnabled: value })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("ui.slurp.settings.messaging.bubbleLimit")}>
                      <NumberSetting
                        value={messagingDraft.messagesReplyBubbleLimit}
                        min={1}
                        max={4}
                        onSave={(value) => setMessagingDraft({ ...messagingDraft, messagesReplyBubbleLimit: value })}
                      />
                    </Field>
                    <Field label={t("ui.slurp.settings.messaging.maxReplyDelay")}>
                      <NumberSetting
                        value={messagingDraft.messagesMaxReplyDelayMinutes}
                        min={0}
                        max={1440}
                        onSave={(value) =>
                          setMessagingDraft({ ...messagingDraft, messagesMaxReplyDelayMinutes: value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              ),
            },
          ]}
        />
      )}
      <SettingsGroup title={t("ui.slurp.settings.messaging.repliesTitle")}>
        <Toggle
          settingKey="messagesAwayRepliesEnabled"
          label={t("ui.slurp.settings.messaging.awayReplies")}
          detail={t("ui.slurp.settings.messaging.awayRepliesDetail")}
          value={settings.messagesAwayRepliesEnabled}
          onChange={(value) => update("messagesAwayRepliesEnabled", value)}
        />
        <Field
          settingKey="messagesReplyBubbleLimit"
          label={t("ui.slurp.settings.messaging.bubbleLimit")}
          detail={t("ui.slurp.settings.messaging.bubbleLimitDetail")}
        >
          <NumberSetting
            value={settings.messagesReplyBubbleLimit}
            min={1}
            max={4}
            onSave={(value) => update("messagesReplyBubbleLimit", value)}
          />
        </Field>
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.messaging.delaysTitle")}>
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">
          {t("ui.slurp.settings.messaging.delaysDetail")}
        </p>
        <Toggle
          settingKey="messagesUnscheduledAlwaysReachable"
          label={t("ui.slurp.settings.messaging.unscheduledAlwaysReachable")}
          detail={t("ui.slurp.settings.messaging.unscheduledAlwaysReachableDetail")}
          value={settings.messagesUnscheduledAlwaysReachable}
          onChange={(value) => update("messagesUnscheduledAlwaysReachable", value)}
        />
        <AdvancedGroup
          title={t("ui.slurp.settings.backstage.landing.delayFineTune", { defaultValue: "Exact reply delays" })}
          count={6}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              settingKey="messagesUnknownReturnDelayMinutes"
              label={t("ui.slurp.settings.messaging.unknownReturnDelay")}
              detail={t("ui.slurp.settings.messaging.unknownReturnDelayDetail")}
            >
              <NumberSetting
                value={settings.messagesUnknownReturnDelayMinutes}
                min={0}
                max={1440}
                onSave={(value) => update("messagesUnknownReturnDelayMinutes", value)}
              />
            </Field>
            <Field
              settingKey="messagesMaxReplyDelayMinutes"
              label={t("ui.slurp.settings.messaging.maxReplyDelay")}
              detail={t("ui.slurp.settings.messaging.maxReplyDelayDetail")}
            >
              <NumberSetting
                value={settings.messagesMaxReplyDelayMinutes}
                min={0}
                max={1440}
                onSave={(value) => update("messagesMaxReplyDelayMinutes", value)}
              />
            </Field>
          </div>
          <div className="space-y-5">
            <RangePairField
              label={t("ui.slurp.settings.messaging.highRapportDelay")}
              unit={t("ui.slurp.settings.units.minutes")}
              bounds={[0, 1440]}
              min={{
                settingKey: "messagesHighRapportDelayMinMinutes",
                label: t("ui.slurp.settings.messaging.highRapportDelayMin"),
                value: settings.messagesHighRapportDelayMinMinutes,
                onSave: (value) => update("messagesHighRapportDelayMinMinutes", value),
              }}
              max={{
                settingKey: "messagesHighRapportDelayMaxMinutes",
                label: t("ui.slurp.settings.messaging.highRapportDelayMax"),
                value: settings.messagesHighRapportDelayMaxMinutes,
                onSave: (value) => update("messagesHighRapportDelayMaxMinutes", value),
              }}
            />
            <RangePairField
              label={t("ui.slurp.settings.messaging.mediumRapportDelay")}
              unit={t("ui.slurp.settings.units.minutes")}
              bounds={[0, 1440]}
              min={{
                settingKey: "messagesMediumRapportDelayMinMinutes",
                label: t("ui.slurp.settings.messaging.mediumRapportDelayMin"),
                value: settings.messagesMediumRapportDelayMinMinutes,
                onSave: (value) => update("messagesMediumRapportDelayMinMinutes", value),
              }}
              max={{
                settingKey: "messagesMediumRapportDelayMaxMinutes",
                label: t("ui.slurp.settings.messaging.mediumRapportDelayMax"),
                value: settings.messagesMediumRapportDelayMaxMinutes,
                onSave: (value) => update("messagesMediumRapportDelayMaxMinutes", value),
              }}
            />
            <RangePairField
              label={t("ui.slurp.settings.messaging.recentPostAway")}
              unit={t("ui.slurp.settings.units.minutes")}
              bounds={[0, 1440]}
              min={{
                settingKey: "messagesRecentPostAwayMinMinutes",
                label: t("ui.slurp.settings.messaging.recentPostAwayMin"),
                value: settings.messagesRecentPostAwayMinMinutes,
                onSave: (value) => update("messagesRecentPostAwayMinMinutes", value),
              }}
              max={{
                settingKey: "messagesRecentPostAwayMaxMinutes",
                label: t("ui.slurp.settings.messaging.recentPostAwayMax"),
                value: settings.messagesRecentPostAwayMaxMinutes,
                onSave: (value) => update("messagesRecentPostAwayMaxMinutes", value),
              }}
            />
            <RangePairField
              label={t("ui.slurp.settings.messaging.stalePostAway")}
              unit={t("ui.slurp.settings.units.minutes")}
              bounds={[0, 1440]}
              min={{
                settingKey: "messagesStalePostAwayMinMinutes",
                label: t("ui.slurp.settings.messaging.stalePostAwayMin"),
                value: settings.messagesStalePostAwayMinMinutes,
                onSave: (value) => update("messagesStalePostAwayMinMinutes", value),
              }}
              max={{
                settingKey: "messagesStalePostAwayMaxMinutes",
                label: t("ui.slurp.settings.messaging.stalePostAwayMax"),
                value: settings.messagesStalePostAwayMaxMinutes,
                onSave: (value) => update("messagesStalePostAwayMaxMinutes", value),
              }}
            />
          </div>
        </AdvancedGroup>
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.messaging.defaultsTitle")}>
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">
          {t("ui.slurp.settings.messaging.defaultsDetail")}
        </p>
        <ChoiceSetting
          settingKey="messagesDefaultDmPolicy"
          label={t("ui.slurp.settings.messaging.dmPolicy")}
          detail={t("ui.slurp.settings.messaging.dmPolicyDetail")}
          options={[
            { value: "open", label: t("ui.slurp.settings.messaging.dmPolicyOpen") },
            { value: "subscribers", label: t("ui.slurp.settings.messaging.dmPolicySubscribers") },
            { value: "paid", label: t("ui.slurp.settings.messaging.dmPolicyPaid") },
            { value: "closed", label: t("ui.slurp.settings.messaging.dmPolicyClosed") },
          ]}
          value={settings.messagesDefaultDmPolicy}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["messagesDefaultDmPolicy"]) => void update("messagesDefaultDmPolicy", value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            settingKey="messagesDefaultRequestFee"
            label={t("ui.slurp.settings.messaging.requestFee")}
            detail={t("ui.slurp.settings.messaging.requestFeeDetail")}
          >
            <NumberSetting
              value={settings.messagesDefaultRequestFee}
              min={0}
              max={9999}
              onSave={(value) => update("messagesDefaultRequestFee", value)}
            />
          </Field>
          <Field
            settingKey="messagesDefaultPpvPrice"
            label={t("ui.slurp.settings.messaging.ppvPrice")}
            detail={t("ui.slurp.settings.messaging.ppvPriceDetail")}
          >
            <NumberSetting
              value={settings.messagesDefaultPpvPrice}
              min={0}
              max={9999}
              onSave={(value) => update("messagesDefaultPpvPrice", value)}
            />
          </Field>
        </div>
      </SettingsGroup>
      <p className="text-xs leading-5 text-[var(--muted-foreground)]">{t("ui.slurp.settings.messaging.clearHint")}</p>
    </div>
  );
}
