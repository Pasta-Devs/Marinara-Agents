import type { LtmStoryTimeJump } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { selectLtmPluralForm, type LtmTranslationFunction } from "./localization";

/** Where a story date came from, as the Vault shows it. The key names match the server's `source` and a date's `origin`. */
export const STORY_DATE_SOURCE_KEYS: Record<string, string> = {
  manual: "ui.longTermMemory.storyDates.sourceManual",
  world_state: "ui.longTermMemory.storyDates.sourceWorldState",
  game_clock: "ui.longTermMemory.storyDates.sourceGameClock",
  message_time: "ui.longTermMemory.storyDates.sourceMessageTime",
  stated: "ui.longTermMemory.storyDates.sourceStated",
  counted: "ui.longTermMemory.storyDates.sourceCounted",
  unknown: "ui.longTermMemory.storyDates.sourceUnknown",
};

const JUMP_AMOUNT_KEYS = {
  day: {
    one: "ui.longTermMemory.storyDates.amountDayOne",
    other: "ui.longTermMemory.storyDates.amountDayOther",
    some: "ui.longTermMemory.storyDates.amountSomeDays",
  },
  week: {
    one: "ui.longTermMemory.storyDates.amountWeekOne",
    other: "ui.longTermMemory.storyDates.amountWeekOther",
    some: "ui.longTermMemory.storyDates.amountSomeWeeks",
  },
  month: {
    one: "ui.longTermMemory.storyDates.amountMonthOne",
    other: "ui.longTermMemory.storyDates.amountMonthOther",
    some: "ui.longTermMemory.storyDates.amountSomeMonths",
  },
  year: {
    one: "ui.longTermMemory.storyDates.amountYearOne",
    other: "ui.longTermMemory.storyDates.amountYearOther",
    some: "ui.longTermMemory.storyDates.amountSomeYears",
  },
} as const;

/**
 * One jump as the user reads it: `"quote" → +3 weeks`, `"quote" → + some weeks` for a vague amount, `"quote" → some
 * time later` for no length at all, with "(implied)" for a new morning the text implies. `reach` is where the story
 * stands after the jump ("Day 23 · Friday") and is left out when it is not worked out.
 */
export function describeStoryJump(
  jump: LtmStoryTimeJump,
  reach: string | null | undefined,
  locale: string,
  localizeUi: LtmTranslationFunction,
) {
  const keys = jump.unit === null ? null : JUMP_AMOUNT_KEYS[jump.unit];
  const amount =
    keys === null
      ? localizeUi("ui.longTermMemory.storyDates.amountSomeTime")
      : jump.amount === null
        ? localizeUi(keys.some)
        : localizeUi(selectLtmPluralForm(locale, jump.amount) === "one" ? keys.one : keys.other, {
            count: jump.amount,
          });
  const line = reach
    ? localizeUi("ui.longTermMemory.storyDates.jumpReach", { quote: jump.quote, amount, reach })
    : localizeUi("ui.longTermMemory.storyDates.jump", { quote: jump.quote, amount });
  return jump.implied ? `${line} ${localizeUi("ui.longTermMemory.storyDates.implied")}` : line;
}
