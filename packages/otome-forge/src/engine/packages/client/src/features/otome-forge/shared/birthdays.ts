// ──────────────────────────────────────────────
// Otome Hearth: birthdays (#2153). A love interest's bible birthday ("MM-DD") in a given year, the days it can still be
// celebrated, and the key of the one-scene Character Story that celebrates it
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles: the server offers and checks a celebration (S/home/birthday.ts), Remind Me
// draws the calendar and the Celebrate card (C/screens/remind/RemindMe.tsx), and the Home note's birthday line falls on
// the same day (S/home/note.ts noteDay). The day is the player's own local day, as everywhere in Otome Hearth. A
// birthday no year has (02-30, 04-31: BIRTHDAY_PATTERN lets them through) is no birthday, and 02-29 falls on 02-28 in a
// common year. A birthday can be celebrated on the day and for BIRTHDAY_LATE_DAYS after it, once per birthday year:
// the scene's key carries that year, so an edited birthday never celebrates the same year twice.
import type { LiId } from "./api-types";
import { BIRTHDAY_PATTERN } from "./bible";
import { dayNumber } from "./wish";

/** How many days after the day a missed birthday can still be celebrated (the maintainer's, 2026-11-07). */
export const BIRTHDAY_LATE_DAYS = 7;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const leap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** True for an "MM-DD" some year has (02-29 included). */
export function realMonthDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    BIRTHDAY_PATTERN.test(value) &&
    Number(value.slice(3)) <= DAYS_IN_MONTH[Number(value.slice(0, 2)) - 1]!
  );
}

/** The day key of a yearly "MM-DD" in `year`; 02-29 falls on 02-28 when the year has none. */
export const birthdayIn = (md: string, year: number) => `${year}-${md === "02-29" && !leap(year) ? "02-28" : md}`;

/** A birthday's day in one year: its year, its day key and how many days ago it was. */
export interface BirthdayDay {
  year: number;
  day: string;
  daysLate: number;
}

/** The most recent day of the birthday `md` on or before `today` (a day key); null for a birthday no year has. */
export function lastBirthday(md: string, today: string): BirthdayDay | null {
  const now = dayNumber(today);
  if (!realMonthDay(md) || !Number.isFinite(now)) return null;
  const thisYear = Number(today.slice(0, 4));
  const year = dayNumber(birthdayIn(md, thisYear)) <= now ? thisYear : thisYear - 1;
  const day = birthdayIn(md, year);
  return { year, day, daysLate: now - dayNumber(day) };
}

/** The birthday it is, or was at most BIRTHDAY_LATE_DAYS ago, on `today`; null for none. */
export function birthdayWindow(md: string, today: string): BirthdayDay | null {
  const last = lastBirthday(md, today);
  return last && last.daysLate <= BIRTHDAY_LATE_DAYS ? last : null;
}

const SCENE = /^story-birthday-(li-[a-z0-9-]+)-(\d{4})$/;

/** The chapter key of a love interest's birthday scene in one year: a Character Story (`story-`), with no item behind it. */
export const birthdaySceneKey = (li: LiId, year: number) => `story-birthday-${li}-${year}`;

/** The love interest and year a birthday scene's key names, or null for any other chapter. */
export function birthdayOfKey(key: string): { li: LiId; year: number } | null {
  const match = SCENE.exec(key);
  return match ? { li: match[1]!, year: Number(match[2]) } : null;
}

/** A birthday that can be celebrated now (CalendarView `celebrate`). */
export interface BirthdayOffer {
  li: LiId;
  /** The birthday's day this year (or last year's, while it is still in its late days). */
  day: string;
  /** 0 on the day, up to BIRTHDAY_LATE_DAYS. */
  daysLate: number;
  /** Its scene is made but not read to its end yet: play it instead of celebrating again. */
  started: boolean;
}
