import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { focusRing } from "../../base/chrome/slp-focus";
import type { SlpActionName } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpStirView } from "../../../../../shared/src/slp/slp-stir.js";
import { Choice, CreatorPicker } from "./SlpStirFormParts";
import { SLP_DESK_REWARDS, type SlpStirForm } from "./slp-stir-steps";

const inputClass = `min-h-11 w-full rounded-xl bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm ${focusRing}`;

/**
 * The form of a Support desk lever (docs/SUPPORT-DESK.md), under the Creator picker the play sheet
 * already shows. Chips for the numbers, a line of text where the lever needs words.
 */
export function SlpStirDeskFields({
  action,
  form,
  set,
  creators,
}: {
  action: SlpActionName;
  form: SlpStirForm;
  set: (patch: SlpStirForm) => void;
  creators: SlpStirView["creators"];
}) {
  const { t } = useTranslation();
  const id = useId();
  const tx = (key: string, defaultValue: string) => t(`ui.slurp.stir.desk.${key}`, { defaultValue });
  const value = (key: string, fallback: string) => String(form[key] ?? fallback);
  const text = (label: string, placeholder: string, key = "text", max = 160) => (
    <div key={key} className="space-y-2">
      <label htmlFor={`${id}-${key}`} className={cn(SLP_TYPE.meta, "font-semibold")}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        value={String(form[key] ?? "")}
        maxLength={max}
        placeholder={placeholder}
        onChange={(event) => set({ [key]: event.target.value })}
        className={inputClass}
      />
    </div>
  );
  const choice = (key: string, label: string, options: [string, string][], fallback: string) => (
    <Choice
      key={key}
      label={label}
      value={value(key, fallback)}
      onChange={(next) => set({ [key]: next })}
      options={options.map(([option, optionLabel]) => ({ value: option, label: optionLabel }))}
    />
  );
  const days = (options: number[], fallback: string) =>
    choice(
      "days",
      tx("days", "For how long"),
      options.map((count) => [
        String(count),
        t("ui.slurp.stir.desk.dayCount", { count, defaultValue: `${count} days` }),
      ]),
      fallback,
    );

  switch (action) {
    case "grant-perk":
      return (
        <>
          {choice(
            "perk",
            tx("perk", "The perk"),
            [
              ["feature", tx("perk.feature", "Discover feature")],
              ["badge", tx("perk.badge", "A badge")],
              ["coins", tx("perk.coins", "Coin bonus")],
            ],
            "",
          )}
          {form.perk === "badge" &&
            choice(
              "badge",
              tx("badge", "Which badge"),
              [
                ["rising", tx("badge.rising", "Rising")],
                ["verified", tx("badge.verified", "Verified")],
                ["partner", tx("badge.partner", "Slurp Partner")],
              ],
              "",
            )}
          {form.perk === "coins" &&
            choice(
              "coins",
              tx("coins", "How many coins"),
              ["50", "200", "500", "1000"].map((count) => [count, count]),
              "200",
            )}
          {form.perk === "feature" && days([1, 2, 3, 7], "2")}
        </>
      );
    case "set-challenge":
      return (
        <>
          {choice(
            "metric",
            tx("metric", "What counts"),
            [
              ["posts", tx("metric.posts", "Posts")],
              ["stories", tx("metric.stories", "Stories")],
            ],
            "",
          )}
          {choice(
            "count",
            tx("count", "How many"),
            ["1", "3", "5", "10"].map((count) => [count, count]),
            "3",
          )}
          {days([3, 7, 14], "7")}
          {choice(
            "reward",
            tx("reward", "The reward"),
            SLP_DESK_REWARDS.map((reward) => [
              reward,
              tx(
                `reward.${reward}`,
                {
                  feature: "2 days on Discover",
                  coins: "200 coins",
                  rising: "Rising badge",
                  verified: "Verified badge",
                }[reward],
              ),
            ]),
            "feature",
          )}
        </>
      );
    case "offer-contract":
      return (
        <>
          {choice(
            "count",
            tx("postsPerWeek", "Posts a week"),
            ["2", "3", "5", "7"].map((count) => [count, count]),
            "3",
          )}
          {choice(
            "weeks",
            tx("weeks", "How long"),
            ["2", "4", "8"].map((count) => [
              count,
              t("ui.slurp.stir.desk.weekCount", { count: Number(count), defaultValue: `${count} weeks` }),
            ]),
            "4",
          )}
          {choice(
            "coins",
            tx("weeklyBonus", "Coins a kept week"),
            ["0", "100", "300", "600"].map((count) => [count, count]),
            "100",
          )}
          {text(tx("themes", "Themes (optional, comma between)"), tx("themesPlaceholder", "gym, travel"), "title", 180)}
        </>
      );
    case "cash-favour":
      return text(tx("ask", "What Slurp asks for"), tx("askPlaceholder", "A post about the new Slurp Stories"));
    case "throttle-reach":
      return (
        <>
          {days([1, 2, 3, 7], "2")}
          {choice(
            "strength",
            tx("strength", "How hard"),
            [
              ["light", tx("strength.light", "A little")],
              ["heavy", tx("strength.heavy", "A lot")],
            ],
            "light",
          )}
        </>
      );
    case "plant-rumour":
      return (
        <>
          {text(
            tx("rumour", "The rumour"),
            tx("rumourPlaceholder", "I heard Kai is planning a collab with Lena"),
            "text",
            200,
          )}
          <CreatorPicker
            key="about"
            max={1}
            label={tx("about", "About (optional)")}
            creators={creators}
            picked={(form.about as string[] | undefined) ?? []}
            onPick={(ids) => set({ about: ids })}
          />
          {choice(
            "via",
            tx("via", "Who tells them"),
            [
              ["anonymous", tx("via.anonymous", "Nobody knows who")],
              ["support", tx("via.support", "Slurp Support")],
            ],
            "anonymous",
          )}
        </>
      );
    case "seed-trend":
      return (
        <>
          {text(tx("topic", "The topic"), tx("topicPlaceholder", "Autumn outfits"), "title", 80)}
          <CreatorPicker
            key="who"
            max={6}
            label={tx("trendWho", "Who hears it (up to 6)")}
            creators={creators.filter((creator) => creator.automatic)}
            picked={(form.who as string[] | undefined) ?? []}
            onPick={(ids) => set({ who: ids })}
          />
        </>
      );
    case "warn-creator":
      return (
        <>
          {text(
            tx("reason", "What Slurp says is wrong"),
            tx("reasonPlaceholder", "Your posts are off-brand lately"),
            "text",
            200,
          )}
          {text(tx("avoid", "A topic to leave alone (optional)"), tx("avoidPlaceholder", "politics"), "title", 60)}
          {choice(
            "cause",
            tx("cause", "Is there a real reason?"),
            [
              ["real", tx("cause.real", "Yes")],
              ["none", tx("cause.none", "No (shady)")],
            ],
            "real",
          )}
        </>
      );
    default:
      return null;
  }
}
