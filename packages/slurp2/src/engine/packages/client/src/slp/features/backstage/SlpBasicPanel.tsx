import { AlertTriangle, ChevronRight } from "lucide-react";
import { SLURP_AUDIENCE_PRESETS, slurpAudiencePresetPatch } from "../../../../../shared/src/slp/slp-tuning.js";
import { SLURP_PUBLISHING_PRESETS, slurpActivityPresetPatch } from "../../modules/creator/slp-activity-presets";
import { Field, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import { SLP_REPLY_SPEEDS, slpReplySpeedFor, slpReplySpeedPatch } from "../../modules/settings/slp-reply-speed";
import { focusRing } from "../../base/chrome/slp-focus";
import type { SlpBackstageSection, SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import type { SlpBackstagePageProps } from "./slp-backstage-contract";

const DM_POLICIES = ["open", "subscribers", "paid", "closed"] as const;
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Basic: the few choices the whole app needs, one group per part of it. Each group ends in
 * "More for …", which opens the full page with every setting of that part. Nothing here is a
 * second copy of a rule: the presets and the reply speed write the same fields those pages show.
 */
export function SlpBasicPanel(page: SlpBackstagePageProps) {
  const {
    t,
    navigation,
    onNavigate,
    settings,
    update,
    updatePatch,
    updateSettings,
    connectionsQuery,
    imageConnections,
    imageConnectionLabel,
    activityPreset,
    audiencePreset,
  } = page;
  const tx = (key: string, defaultValue: string, values?: Record<string, unknown>) =>
    t(`ui.slurp.settings.basic.${key}`, { defaultValue, ...values });
  const open = (target: SlpBackstageTarget, section: SlpBackstageSection = "basic") =>
    onNavigate({ ...navigation, section, target });
  const more = (target: SlpBackstageTarget, name: string, section?: SlpBackstageSection) => (
    <button
      type="button"
      onClick={() => open(target, section)}
      className={`flex min-h-11 w-full items-center gap-2 text-start text-sm font-semibold text-[var(--noodle-accent-foreground)] ${focusRing}`}
    >
      <span className="min-w-0 flex-1">{tx("more", "More for {{name}}", { name })}</span>
      <ChevronRight size={16} className="shrink-0 rtl:rotate-180" aria-hidden="true" />
    </button>
  );

  const textConnections = (connectionsQuery.data ?? []).filter(
    (connection) => connection.provider !== "image_generation",
  );
  const noText = connectionsQuery.isSuccess && textConnections.length === 0;
  const replySpeed = slpReplySpeedFor(settings);
  const pending = updateSettings.isPending;

  return (
    <div className="space-y-5">
      <BackstagePageHeader
        detail={tx(
          "detail",
          "Everything Slurp needs to run, in a few choices. Each part has a full page behind “More” when you want to fine-tune.",
        )}
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SettingsGroup title={tx("connections", "Connections")}>
          <div className="text-sm">
            {!connectionsQuery.isSuccess ? (
              <p className="text-[var(--slurp-muted)]">
                {connectionsQuery.isError
                  ? tx("connectionsError", "Could not load your connections.")
                  : tx("connectionsLoading", "Checking your connections…")}
              </p>
            ) : noText ? (
              <p role="alert" className="flex items-start gap-2 text-[var(--slurp-warning)]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {tx(
                  "noText",
                  "No text connection yet. Without one, Creators cannot post or answer, and Slurp only runs by hand.",
                )}
              </p>
            ) : (
              <p>
                {tx("textReady", "Text: {{count}} connections ready.", {
                  count: textConnections.length,
                })}
              </p>
            )}
            <p className="mt-1 text-[var(--slurp-muted)]">
              {imageConnections.length > 0
                ? tx("imagesReady", "Pictures: {{name}}", { name: imageConnectionLabel })
                : tx("imagesNone", "Pictures: none. Posts go out as text.")}
            </p>
          </div>
          {more("connections", tx("connections", "Connections"))}
        </SettingsGroup>

        <SettingsGroup title={tx("busy", "How busy")}>
          <ChoiceSetting
            settingKey="autoPostingScheduleEnabled"
            label={tx("pace", "Posting pace")}
            options={SLURP_PUBLISHING_PRESETS.map((preset) => ({
              value: preset,
              label: t(`ui.slurp.settings.presets.${preset}`),
            }))}
            value={activityPreset ?? null}
            disabled={pending}
            onChange={(preset) => void updatePatch(slurpActivityPresetPatch(preset))}
          />
          <Toggle
            settingKey="nightQuiet"
            label={t("ui.slurp.settings.quietHours")}
            value={settings.nightQuiet}
            onChange={(value) => update("nightQuiet", value)}
          />
          {more("general", tx("busy", "How busy"))}
        </SettingsGroup>

        <SettingsGroup title={tx("crowd", "Crowd")}>
          <ChoiceSetting
            label={tx("crowdLabel", "How many fans show up")}
            options={SLURP_AUDIENCE_PRESETS.map((preset) => ({
              value: preset,
              label: t(`ui.slurp.settings.simulation.presets.${preset}`),
            }))}
            value={audiencePreset === "custom" ? null : audiencePreset}
            disabled={pending}
            onChange={(preset) => void updatePatch(slurpAudiencePresetPatch(preset, settings))}
          />
          {more("audience", tx("crowd", "Crowd"))}
        </SettingsGroup>

        <SettingsGroup title={tx("pictures", "Pictures")}>
          <Toggle
            settingKey="autoPostingImagesEnabled"
            label={t("ui.slurp.settings.images.enableForNew")}
            value={settings.autoPostingImagesEnabled}
            onChange={(value) => update("autoPostingImagesEnabled", value)}
            disabledReason={imageConnections.length > 0 ? null : tx("needsImages", "Needs an image connection.")}
          />
          <Toggle
            settingKey="blurPictures"
            label={t("ui.slurp.settings.images.blurPictures")}
            value={settings.blurPictures}
            onChange={(value) => update("blurPictures", value)}
          />
          {more("images", tx("pictures", "Pictures"))}
        </SettingsGroup>

        <SettingsGroup title={tx("heat", "Heat")}>
          <p className="text-sm text-[var(--slurp-muted)]">
            {tx("heatDetail", "How explicit Slurp may get, for every Creator, and the tastes it leans into.")}
          </p>
          {more("spice", tx("heat", "Heat"), "spice")}
        </SettingsGroup>

        <SettingsGroup title={tx("messages", "Messages")}>
          {noText && (
            <p className="text-xs text-[var(--slurp-warning)]">
              {tx("messagesNoText", "Creators answer only once a text connection is set up.")}
            </p>
          )}
          <Toggle
            settingKey="messagesAwayRepliesEnabled"
            label={t("ui.slurp.settings.messaging.awayReplies")}
            detail={tx(
              "awayDetail",
              "Creators answer your messages while you are away. This is not about writing first: a Creator can still text you first either way. Off, promises, reminders and finished commissions still arrive.",
            )}
            value={settings.messagesAwayRepliesEnabled}
            onChange={(value) => update("messagesAwayRepliesEnabled", value)}
          />
          <ChoiceSetting
            label={tx("replySpeed", "How fast they answer")}
            options={SLP_REPLY_SPEEDS.map((speed) => ({
              value: speed,
              label: tx(
                `replySpeed.${speed}`,
                { instant: "At once", quick: "Quick", normal: "Normal", slow: "Slow" }[speed],
              ),
            }))}
            value={replySpeed}
            disabled={pending}
            onChange={(speed) => void updatePatch(slpReplySpeedPatch(speed))}
          />
          <ChoiceSetting
            settingKey="messagesDefaultDmPolicy"
            label={t("ui.slurp.settings.messaging.dmPolicy")}
            detail={tx(
              "dmPolicyDetail",
              "Who can start a new chat with a Creator who has no rule of their own. Subscribers and chats already running always get through.",
            )}
            options={DM_POLICIES.map((value) => ({
              value,
              label: t(`ui.slurp.settings.messaging.dmPolicy${cap(value)}`),
            }))}
            value={settings.messagesDefaultDmPolicy}
            disabled={pending}
            onChange={(value: SlurpSettings["messagesDefaultDmPolicy"]) => update("messagesDefaultDmPolicy", value)}
          />
          {more("messaging", tx("messages", "Messages"))}
        </SettingsGroup>

        <SettingsGroup title={tx("coins", "Coins")}>
          <Field settingKey="walletUnlockCost" label={t("ui.slurp.settings.wallet.unlockCost")}>
            <NumberSetting
              stepper
              value={settings.walletUnlockCost}
              min={0}
              max={9999}
              onSave={(value) => update("walletUnlockCost", value)}
            />
          </Field>
          <Field settingKey="walletSubscriptionCost" label={t("ui.slurp.settings.wallet.subscriptionCost")}>
            <NumberSetting
              stepper
              value={settings.walletSubscriptionCost}
              min={0}
              max={9999}
              onSave={(value) => update("walletSubscriptionCost", value)}
            />
          </Field>
          {more("wallet", tx("coins", "Coins"))}
        </SettingsGroup>

        <SettingsGroup title={tx("safety", "Safety net")}>
          <Toggle
            label={t("ui.slurp.settings.overview.pause.label")}
            detail={t("ui.slurp.settings.overview.pause.detail")}
            value={settings.paused}
            onChange={(value) => update("paused", value)}
          />
          {more("autopurge", t("ui.slurp.settings.backstage.targets.autopurge"))}
        </SettingsGroup>
      </div>
    </div>
  );
}
