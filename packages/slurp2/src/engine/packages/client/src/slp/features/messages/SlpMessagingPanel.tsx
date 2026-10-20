import { MessageCircle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  SLURP_COMMISSION_OPENERS,
  SLURP_CUSTOM_OPENER_MAX_LENGTH,
  SLURP_CUSTOM_OPENERS_MAX,
  SLURP_FAN_OPENERS,
} from "../../../../../shared/src/slp/slp-world.js";
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

const QUOTE_ANSWER_MINUTES = ["0", "60", "360", "1440"] as const;

/**
 * One editable list of first lines, one per line. It shows the built-in lines until the player
 * saves their own; saving the built-in lines unchanged (or nothing) keeps following the built-in ones.
 */
function OpenerListField({
  settingKey,
  label,
  detail,
  resetLabel,
  value,
  builtIn,
  disabled,
  onSave,
}: {
  settingKey: "messagesFanOpeners" | "messagesCommissionOpeners";
  label: string;
  detail: string;
  resetLabel: string;
  value: readonly string[];
  builtIn: readonly string[];
  disabled: boolean;
  onSave: (value: string[]) => void;
}) {
  const shown = (value.length > 0 ? value : builtIn).join("\n");
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const save = () => {
    const lines = [...new Set(draft.split("\n").map((line) => line.trim().slice(0, SLURP_CUSTOM_OPENER_MAX_LENGTH)))]
      .filter(Boolean)
      .slice(0, SLURP_CUSTOM_OPENERS_MAX);
    const next = lines.join("\n") === builtIn.join("\n") ? [] : lines;
    if (next.join("\n") !== value.join("\n")) onSave(next);
    else setDraft(shown);
  };
  return (
    <Field settingKey={settingKey} label={label} detail={detail} wide group>
      <div className="space-y-2">
        <textarea
          aria-label={label}
          value={draft}
          disabled={disabled}
          rows={Math.min(10, Math.max(4, builtIn.length))}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] p-3 text-base leading-6 ring-1 ring-inset ring-[var(--slurp-outline,var(--border))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus,var(--noodle-accent))] sm:text-sm"
        />
        {value.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSave([])}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
          >
            <RotateCcw size={13} aria-hidden="true" />
            {resetLabel}
          </button>
        )}
      </div>
    </Field>
  );
}

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
        <BackstagePageHeader detail={t("ui.slurp.settings.messaging.detail")} />
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
            stepper
            value={settings.messagesReplyBubbleLimit}
            min={1}
            max={4}
            onSave={(value) => update("messagesReplyBubbleLimit", value)}
          />
        </Field>
        <Toggle
          settingKey="messagesPauseFollowUpsUntilReply"
          label={t("ui.slurp.settings.messaging.pauseFollowUpsUntilReply")}
          detail={t("ui.slurp.settings.messaging.pauseFollowUpsUntilReplyDetail")}
          value={settings.messagesPauseFollowUpsUntilReply}
          onChange={(value) => update("messagesPauseFollowUpsUntilReply", value)}
        />
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
        <AdvancedGroup title={t("ui.slurp.settings.messaging.cooldownsTitle", { defaultValue: "Cooldowns" })} count={2}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              settingKey="messagesViewerImageCooldownMinutes"
              label={t("ui.slurp.settings.messaging.viewerImageCooldown", {
                defaultValue: "Wait between your pictures",
              })}
              detail={t("ui.slurp.settings.messaging.viewerImageCooldownDetail", {
                defaultValue: "Minutes before you can draw another picture into the same chat. 0 means no wait.",
              })}
            >
              <NumberSetting
                value={settings.messagesViewerImageCooldownMinutes}
                min={0}
                max={10080}
                onSave={(value) => update("messagesViewerImageCooldownMinutes", value)}
              />
            </Field>
            <Field
              settingKey="messagesCoolOffMinutes"
              label={t("ui.slurp.settings.messaging.coolOff", { defaultValue: "Time away after a fight" })}
              detail={t("ui.slurp.settings.messaging.coolOffDetail", {
                defaultValue:
                  "Minutes a Creator stays away when they have had enough. 0 means they stay in the chat. Two fights in two weeks still end the chat.",
              })}
            >
              <NumberSetting
                value={settings.messagesCoolOffMinutes}
                min={0}
                max={10080}
                onSave={(value) => update("messagesCoolOffMinutes", value)}
              />
            </Field>
          </div>
        </AdvancedGroup>
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.messaging.requestsTitle", { defaultValue: "Fan requests" })}>
        <ChoiceSetting
          settingKey="messagesQuoteAnswerMinutes"
          label={t("ui.slurp.settings.messaging.quoteAnswer", { defaultValue: "Time before fans answer a quote" })}
          detail={t("ui.slurp.settings.messaging.quoteAnswerDetail", {
            defaultValue:
              "How long a fan thinks about your price before they accept, bargain or say no. The answer comes on the next world tick after this time.",
          })}
          options={QUOTE_ANSWER_MINUTES.map((minutes) => ({
            value: minutes,
            label: t(`ui.slurp.settings.messaging.quoteAnswer${minutes}`),
          }))}
          value={
            QUOTE_ANSWER_MINUTES.find((minutes) => Number(minutes) === settings.messagesQuoteAnswerMinutes) ?? null
          }
          disabled={updateSettings.isPending}
          onChange={(minutes) => void update("messagesQuoteAnswerMinutes", Number(minutes))}
        />
        <AdvancedGroup
          title={t("ui.slurp.settings.messaging.openersTitle", { defaultValue: "Your own first lines" })}
          count={2}
        >
          <OpenerListField
            settingKey="messagesFanOpeners"
            label={t("ui.slurp.settings.messaging.fanOpeners", { defaultValue: "First messages from fans" })}
            detail={t("ui.slurp.settings.messaging.fanOpenersDetail", {
              defaultValue:
                "One message per line. A new fan starts a chat with one of these lines. When the AI budget allows rewrites, the model then writes it again in the fan's voice.",
            })}
            resetLabel={t("ui.slurp.settings.messaging.openersReset", { defaultValue: "Use the built-in lines" })}
            value={settings.messagesFanOpeners}
            builtIn={SLURP_FAN_OPENERS}
            disabled={updateSettings.isPending}
            onSave={(value) => void update("messagesFanOpeners", value)}
          />
          <OpenerListField
            settingKey="messagesCommissionOpeners"
            label={t("ui.slurp.settings.messaging.commissionOpeners", {
              defaultValue: "First words of commission requests",
            })}
            detail={t("ui.slurp.settings.messaging.commissionOpenersDetail", {
              defaultValue:
                "One opener per line. Each request starts with one of these, then says what the fan wants. When the AI budget allows rewrites, the model then writes the request again.",
            })}
            resetLabel={t("ui.slurp.settings.messaging.openersReset", { defaultValue: "Use the built-in lines" })}
            value={settings.messagesCommissionOpeners}
            builtIn={SLURP_COMMISSION_OPENERS}
            disabled={updateSettings.isPending}
            onSave={(value) => void update("messagesCommissionOpeners", value)}
          />
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
              stepper
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
