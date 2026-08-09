export type IllustratorRetryTarget = "illustration" | "background";

const ILLUSTRATOR_RETRY_TARGETS = new Set<IllustratorRetryTarget>(["illustration", "background"]);

export function parseIllustratorRetryTargets(value: unknown): IllustratorRetryTarget[] | null | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) return null;

  const targets: IllustratorRetryTarget[] = [];
  for (const target of value) {
    if (typeof target !== "string" || !ILLUSTRATOR_RETRY_TARGETS.has(target as IllustratorRetryTarget)) return null;
    if (!targets.includes(target as IllustratorRetryTarget)) targets.push(target as IllustratorRetryTarget);
  }
  return targets;
}

export function shouldRetryIllustratorTarget(
  targets: IllustratorRetryTarget[] | undefined,
  target: IllustratorRetryTarget,
): boolean {
  return targets === undefined || targets.includes(target);
}

export function isExclusiveIllustratorRetryTarget(
  targets: IllustratorRetryTarget[] | undefined,
  target: IllustratorRetryTarget,
): boolean {
  return targets?.length === 1 && targets[0] === target;
}
