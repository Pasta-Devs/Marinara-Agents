/**
 * Situate the post in the character's own day.
 *
 * The clock was already supplied and nothing asked the model to use it, so every post read as
 * happening in the same undefined moment. A Creator with no Conversation Schedule has no other
 * situational anchor at all, which is one of the reasons an office worker posted from the same
 * desk every time.
 *
 * This is the cheap most of what a generated daily rhythm would give: the hour and the weekday are
 * already known, and the character card already says who this person is. Asking the model to put
 * the two together costs nothing. Build the stored rhythm only if this proves too vague.
 */
const DAY_PLACEMENT_INSTRUCTION =
  "Place this post inside the character's own day at that hour and weekday: what they have just been doing, where that puts them, what they are wearing or holding because of it. A Tuesday morning and a Saturday night are different posts from the same person.";

export function buildSlurpPostTimingContext(generatedAt: Date, publicationTime?: Date): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local timezone";
  const format = (value: Date) =>
    new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(value);
  if (publicationTime) {
    return `Current local date and time: ${format(generatedAt)} (${timeZone}). Expected publication date and time: ${format(publicationTime)} (${timeZone}). Write as if the post is being published at that expected time; do not describe later events as already having happened. ${DAY_PLACEMENT_INSTRUCTION}`;
  }
  return `Current local date and time: ${format(generatedAt)} (${timeZone}). Write for publication now. ${DAY_PLACEMENT_INSTRUCTION}`;
}
