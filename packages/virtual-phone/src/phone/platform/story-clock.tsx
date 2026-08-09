import React from "react";
import { storyNow } from "../device/settings";

/**
 * Every timestamp the phone renders goes through here, so a scene set at 3am does not show the
 * user's real afternoon on the lock screen and in every thread. Stored times stay real; only the
 * display shifts. The offset comes from the selected phone's settings, so two characters in the
 * same chat can legitimately disagree about the time — a phone left on another timezone is a
 * story detail, not a bug.
 */
const StoryClockContext = React.createContext(0);

export const StoryClockProvider = StoryClockContext.Provider;

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const LONG_DATE: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };

export function useStoryClock() {
  const offsetMinutes = React.useContext(StoryClockContext);
  return React.useMemo(() => {
    const at = (value?: string | number | Date) => storyNow(offsetMinutes, value);
    return {
      offsetMinutes,
      at,
      /** 14:22 */
      time: (value?: string | number | Date) => at(value).toLocaleTimeString([], TIME),
      /** Mar 4 */
      shortDate: (value?: string | number | Date) => at(value).toLocaleDateString([], SHORT_DATE),
      /** Tuesday, March 4 */
      longDate: (value?: string | number | Date) => at(value).toLocaleDateString([], LONG_DATE),
      /** What a mail or thread list shows: the time today, the date before that. */
      stamp: (value: string | number | Date) => {
        const when = at(value);
        return when.toDateString() === at().toDateString()
          ? when.toLocaleTimeString([], TIME)
          : when.toLocaleDateString([], SHORT_DATE);
      },
    };
  }, [offsetMinutes]);
}
