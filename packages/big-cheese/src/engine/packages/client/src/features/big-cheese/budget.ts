// Big Cheese M4 T15: budget sliders. Moving one share rescales the others, so the total stays 100.
export function rebalance<K extends string>(b: Record<K, number>, key: K, value: number): Record<K, number> {
  const others = (Object.keys(b) as K[]).filter((k) => k !== key);
  const mine = Math.max(0, Math.min(100, Math.round(value)));
  const rest = 100 - mine;
  const old = others.reduce((a, k) => a + b[k], 0);
  const out: Record<string, number> = { ...b, [key]: mine };
  for (const k of others) out[k] = Math.floor(old ? (b[k] * rest) / old : rest / others.length);
  let left = rest - others.reduce((a, k) => a + out[k]!, 0);
  for (let i = 0; left > 0; i = (i + 1) % others.length, left--) out[others[i]!]!++;
  return out as Record<K, number>;
}
