import type { LtmSubject } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export function subjectsEqual(left: readonly LtmSubject[] | undefined, right: readonly LtmSubject[] | undefined) {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((subject, index) => subject.key === right[index]?.key);
}
