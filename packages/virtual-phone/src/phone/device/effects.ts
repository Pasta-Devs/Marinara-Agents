export type ConditionEffect = "cracks" | "smudge" | "blood";

export function conditionOpacity(intensity: number, reduceDeviceEffects: boolean) {
  if (reduceDeviceEffects) return 0;
  return Math.max(0, Math.min(1, intensity / 3));
}

export function patternBackground(pattern: string, intensity: number) {
  const alpha = Math.max(0, Math.min(0.18, intensity * 0.05));
  if (pattern === "dots") return `radial-gradient(circle, rgb(0 0 0 / ${alpha}) 1px, transparent 1px)`;
  if (pattern === "grid") return `linear-gradient(rgb(0 0 0 / ${alpha}) 1px, transparent 1px), linear-gradient(90deg, rgb(0 0 0 / ${alpha}) 1px, transparent 1px)`;
  if (pattern === "waves") return `radial-gradient(ellipse at 0 50%, transparent 40%, rgb(0 0 0 / ${alpha}) 42%, transparent 44%)`;
  if (pattern === "noise") return `repeating-linear-gradient(135deg, rgb(0 0 0 / ${alpha}) 0 1px, transparent 1px 4px)`;
  return "none";
}
