export type SlurpCheatDirective =
  | { kind: "guidance"; text: string }
  | { kind: "coins"; coins: number }
  | { kind: "force_creator_photo"; guidance: string }
  | { kind: "force_ppv"; guidance: string }
  | { kind: "mood"; amount: number }
  | { kind: "rapport"; amount: number }
  | { kind: "availability"; minutes: number }
  | {
      kind: "follow_up";
      type: "reminder" | "promise_delivery" | "task_update" | "check_in" | "recurring";
      timing: string;
      reason: string;
    }
  | { kind: "invalid" };

export function parseSlurpCheatDirective(input: string): SlurpCheatDirective {
  const text = input.trim();
  if (!text) return { kind: "invalid" };
  const coins = /^coins\s+(\d+)$/iu.exec(text);
  if (coins) return { kind: "coins", coins: Number(coins[1]) };
  const photo = /^force\s+creator\s+photo(?:\s+([\s\S]*))?$/iu.exec(text);
  if (photo) return { kind: "force_creator_photo", guidance: photo[1]?.trim() ?? "" };
  const ppv = /^force\s+(?:ppv|paid\s+unlock)(?:\s+([\s\S]*))?$/iu.exec(text);
  if (ppv) return { kind: "force_ppv", guidance: ppv[1]?.trim() ?? "" };
  const mood = /^mood\s+([+-]?\d+(?:\.\d+)?)$/iu.exec(text);
  if (mood) return { kind: "mood", amount: Number(mood[1]) };
  const rapport = /^rapport\s+([+-]?\d+(?:\.\d+)?)$/iu.exec(text);
  if (rapport) return { kind: "rapport", amount: Number(rapport[1]) };
  const availability = /^availability\s+(\d+)$/iu.exec(text);
  if (availability) return { kind: "availability", minutes: Number(availability[1]) };
  const followUp =
    /^test\s+(follow-up|promise)\s+(?:(reminder|promise_delivery|task_update|check_in|recurring)\s+)?((?:\d+\s+(?:minutes?|hours?|mins?|hrs?)|tonight|tomorrow|soon))\s+(.+)$/iu.exec(
      text,
    );
  if (followUp) {
    const promise = followUp[1].toLowerCase() === "promise";
    return {
      kind: "follow_up",
      type: promise
        ? "promise_delivery"
        : ((followUp[2]?.toLowerCase().replace("-", "_") ?? "reminder") as
            "reminder" | "promise_delivery" | "task_update" | "check_in" | "recurring"),
      timing: followUp[3],
      reason: followUp[4].trim(),
    };
  }
  // Budget state is shared across all model jobs and has no safe public reset API. Keep these
  // words available for a clear server rejection instead of accidentally treating them as model
  // guidance.
  if (/^budget(?:\s+reset)?$/iu.test(text)) return { kind: "invalid" };
  return { kind: "guidance", text: text.slice(0, 2000) };
}
