import { useTranslation } from "react-i18next";
import { SLP_DEFAULT_LIVE_SETTINGS, type SlpLiveSettings } from "../../../../../shared/src/slp/slp-live.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlpExtensionSwitch } from "../../modules/settings/SlpExtensionSwitch";
import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { AdvancedGroup, Field, NumberSetting, SettingsGroup } from "../../modules/settings/SlpSettingsControls";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";

/** Days between one Creator's shows, by name so the locale keys stay plain words. */
const HOW_OFTEN = { twiceDaily: 0.5, daily: 1, often: 1.5, fewDays: 3, weekly: 7 } as const;
const OFTEN_KEYS = Object.keys(HOW_OFTEN) as (keyof typeof HOW_OFTEN)[];
const LENGTHS = { short: [15, 30], normal: [30, 60], long: [60, 120] } as const;
const PACES = ["short", "normal", "long"] as const;
const PICTURES = ["off", "45", "60", "120", "300"] as const;
const PRIVATE_MINUTES = ["5", "10", "15", "30"] as const;

type Connection = { id: string; name?: string | null; model?: string | null; provider: string };

/**
 * Backstage > Live shows (LIVE-V3-PLAN.md "Settings"): the switch, how often Creators go live, the room's
 * pace, live pictures and private shows. Every control saves the whole `live` object with one field changed.
 */
export function SlpLiveSettingsPanel(page: SlpBackstagePageProps) {
  const { settings, updateNow } = page;
  const { t } = useTranslation();
  const tx = (key: string, defaultValue: string, values?: Record<string, unknown>) =>
    t(`ui.slurp.live.settings.${key}`, { defaultValue, ...values });
  const on = slpExtensionOn(settings, "live");
  return (
    <div className="space-y-5">
      <BackstagePageHeader
        detail={tx(
          "detail",
          "Creators stream live cam shows on their own: the room chats, tips and orders from the menu. You can watch, talk, tip and buy a private show, or go live yourself.",
        )}
      />
      <SlpExtensionSwitch
        settingKey="extLive"
        label={t("ui.slurp.settings.ext.live.label", { defaultValue: "Live shows" })}
        detail={t("ui.slurp.settings.ext.live.detail", {
          defaultValue: "Cam shows with a live room, tips, goals, live pictures and private shows.",
        })}
        on={on}
        onChange={(value) => void updateNow("extLive", value)}
      />
      {on && <SlpLiveSettings {...page} />}
    </div>
  );
}

function SlpLiveSettings({ settings, update, updateSettings, connectionsQuery }: SlpBackstagePageProps) {
  const { t } = useTranslation();
  const tx = (key: string, defaultValue: string, values?: Record<string, unknown>) =>
    t(`ui.slurp.live.settings.${key}`, { defaultValue, ...values });
  const live: SlpLiveSettings = { ...SLP_DEFAULT_LIVE_SETTINGS, ...settings.live };
  const set = (patch: Partial<SlpLiveSettings>) => update("live", { ...live, ...patch });
  const busy = updateSettings.isPending;
  const length = (Object.keys(LENGTHS) as (keyof typeof LENGTHS)[]).find(
    (key) => LENGTHS[key][0] === live.minMinutes && LENGTHS[key][1] === live.maxMinutes,
  );
  const picture = live.pictureMax === 0 ? "off" : String(live.pictureSeconds);
  const texts = ((connectionsQuery.data ?? []) as Connection[]).filter(
    (connection) => connection.provider !== "image_generation",
  );
  return (
    <SettingAnchor settingKey="live">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SettingsGroup title={tx("groupWhen", "When Creators go live")}>
          <ChoiceSetting
            label={tx("howOften", "How often")}
            detail={tx(
              "howOftenDetail",
              "How many days pass between one Creator's shows. Active Creators go live more.",
            )}
            options={OFTEN_KEYS.map((value) => ({ value, label: tx(`often_${value}`, value) }))}
            value={OFTEN_KEYS.find((value) => HOW_OFTEN[value] === live.everyDays) ?? null}
            disabled={busy}
            onChange={(value) => set({ everyDays: HOW_OFTEN[value] })}
          />
          <ChoiceSetting
            label={tx("length", "Show length")}
            options={PACES.map((value) => ({
              value,
              label: tx(`length_${value}`, `${LENGTHS[value][0]} to ${LENGTHS[value][1]} min`),
            }))}
            value={length ?? null}
            disabled={busy}
            onChange={(value) => set({ minMinutes: LENGTHS[value][0], maxMinutes: LENGTHS[value][1] })}
          />
        </SettingsGroup>
        <SettingsGroup title={tx("groupRoom", "In the room")}>
          <ChoiceSetting
            label={tx("pace", "Talk pace")}
            detail={tx(
              "paceDetail",
              "How much one model call writes while you watch. Shorter feels livelier and calls the model more often.",
            )}
            options={PACES.map((value) => ({ value, label: tx(`pace_${value}`, value) }))}
            value={live.beatLength}
            disabled={busy}
            onChange={(value) => set({ beatLength: value })}
          />
          <ChoiceSetting
            label={tx("pictures", "Live pictures")}
            detail={tx(
              "picturesDetail",
              "A new picture of the show while you watch. Each picture is one call to the image connection.",
            )}
            options={PICTURES.map((value) => ({ value, label: tx(`picture_${value}`, value) }))}
            value={PICTURES.find((value) => value === picture) ?? null}
            disabled={busy}
            onChange={(value) =>
              set(
                value === "off"
                  ? { pictureMax: 0 }
                  : {
                      pictureSeconds: Number(value),
                      pictureMax: live.pictureMax || SLP_DEFAULT_LIVE_SETTINGS.pictureMax,
                    },
              )
            }
          />
        </SettingsGroup>
        <SettingsGroup title={tx("groupPrivate", "Private shows")}>
          <ChoiceSetting
            label={tx("privateMinutes", "Private block")}
            detail={tx("privateMinutesDetail", "How long one private show lasts. You can extend it while it runs.")}
            options={PRIVATE_MINUTES.map((value) => ({
              value,
              label: tx("minutes", `${value} min`, { minutes: value }),
            }))}
            value={PRIVATE_MINUTES.find((value) => Number(value) === live.privateMinutes) ?? null}
            disabled={busy}
            onChange={(value) => set({ privateMinutes: Number(value) })}
          />
          <Field
            label={tx("privatePrice", "Private show price")}
            detail={tx("privatePriceDetail", "The coins one private block costs. They go to the Creator.")}
          >
            <NumberSetting
              value={live.privatePrice}
              min={10}
              max={99_999}
              disabled={busy}
              label={tx("privatePrice", "Private show price")}
              onSave={(value) => set({ privatePrice: value })}
            />
          </Field>
        </SettingsGroup>
      </div>
      <div className="mt-5">
        <AdvancedGroup title={t("ui.slurp.settings.advanced.group")} count={5}>
          <Field label={tx("everyDays", "Days between shows")}>
            <NumberSetting
              value={live.everyDays}
              min={0.25}
              max={14}
              integer={false}
              disabled={busy}
              label={tx("everyDays", "Days between shows")}
              onSave={(value) => set({ everyDays: value })}
            />
          </Field>
          <Field label={tx("minMinutes", "Shortest show (min)")}>
            <NumberSetting
              value={live.minMinutes}
              min={10}
              max={240}
              disabled={busy}
              label={tx("minMinutes", "Shortest show (min)")}
              onSave={(value) => set({ minMinutes: value, maxMinutes: Math.max(value, live.maxMinutes) })}
            />
          </Field>
          <Field label={tx("maxMinutes", "Longest show (min)")}>
            <NumberSetting
              value={live.maxMinutes}
              min={10}
              max={240}
              disabled={busy}
              label={tx("maxMinutes", "Longest show (min)")}
              onSave={(value) => set({ maxMinutes: value, minMinutes: Math.min(value, live.minMinutes) })}
            />
          </Field>
          <Field label={tx("pictureMax", "Pictures per show")}>
            <NumberSetting
              value={live.pictureMax}
              min={0}
              max={60}
              disabled={busy}
              label={tx("pictureMax", "Pictures per show")}
              onSave={(value) => set({ pictureMax: value })}
            />
          </Field>
          <Field
            label={tx("connection", "Text connection for shows")}
            detail={tx("connectionDetail", "Empty uses Slurp's text connection.")}
          >
            <select
              value={live.connectionId ?? ""}
              disabled={busy || connectionsQuery.isLoading}
              onChange={(event) => set({ connectionId: event.target.value || null })}
              className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base sm:text-sm"
            >
              <option value="">{t("ui.slurp.settings.connections.useDefault")}</option>
              {texts.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name ?? connection.model ?? connection.id}
                </option>
              ))}
            </select>
          </Field>
        </AdvancedGroup>
      </div>
    </SettingAnchor>
  );
}
