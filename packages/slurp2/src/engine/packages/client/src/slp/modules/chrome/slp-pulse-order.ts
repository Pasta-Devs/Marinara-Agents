export type SlpPulseScheduledItem = {
  id: string;
  publishAt?: string | null;
  createdAt?: string;
};

/** Sort scheduled tasks by the next publish time, with stable fallbacks for incomplete records. */
export function sortSlpPulseScheduled<T extends SlpPulseScheduledItem>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftPublishAt = pulseTimestamp(left.publishAt);
    const rightPublishAt = pulseTimestamp(right.publishAt);
    if (leftPublishAt !== rightPublishAt) return leftPublishAt - rightPublishAt;
    const leftCreatedAt = pulseTimestamp(left.createdAt);
    const rightCreatedAt = pulseTimestamp(right.createdAt);
    if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;
    return left.id.localeCompare(right.id);
  });
}

function pulseTimestamp(value?: string | null): number {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}
