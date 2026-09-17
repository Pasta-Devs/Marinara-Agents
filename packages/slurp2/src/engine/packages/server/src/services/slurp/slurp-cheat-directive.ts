export type SlurpCheatDirective =
  { kind: "guidance"; text: string } | { kind: "coins"; coins: number } | { kind: "invalid" };

export function parseSlurpCheatDirective(input: string): SlurpCheatDirective {
  const text = input.trim();
  if (!text) return { kind: "invalid" };
  const coins = /^coins\s+(\d+)$/iu.exec(text);
  if (coins) return { kind: "coins", coins: Number(coins[1]) };
  // Budget state is shared across all model jobs and has no safe public reset API. Keep these
  // words available for a clear server rejection instead of accidentally treating them as model
  // guidance.
  if (/^budget(?:\s+reset)?$/iu.test(text)) return { kind: "invalid" };
  return { kind: "guidance", text: text.slice(0, 2000) };
}
