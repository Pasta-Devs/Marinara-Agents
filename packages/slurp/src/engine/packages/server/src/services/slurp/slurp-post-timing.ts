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
    return `Current local date and time: ${format(generatedAt)} (${timeZone}). Expected publication date and time: ${format(publicationTime)} (${timeZone}). Write as if the post is being published at that expected time; do not describe later events as already having happened.`;
  }
  return `Current local date and time: ${format(generatedAt)} (${timeZone}). Write for publication now.`;
}
