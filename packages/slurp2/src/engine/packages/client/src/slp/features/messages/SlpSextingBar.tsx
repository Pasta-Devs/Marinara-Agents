import { useRef } from "react";
import { Flame } from "lucide-react";
import { useSlpMinuteClock } from "../../base/ui/slp-minute-clock";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { useStartSlurpSexting } from "./slp-message-action-hooks";
import { newRequestId, type SlurpThreadViewModel } from "./slp-thread-actions";

/** After a session, how long the thread still asks for a tip. */
const TIP_PROMPT_MINUTES = 30;

/**
 * Paid sexting sessions (docs/SPICY.md, item 2): the buy button, the time left while one runs, and a tip
 * prompt after it ends. The server sets the price and refuses a second session while one runs.
 */
export function SlpSextingBar({ model }: { model: SlurpThreadViewModel }) {
  const { thread, threadQuery, personaId, busy, holdTyping, setError, setStandaloneTip, setToolTab, setToolsOpen } =
    model;
  const { localizeUi } = model;
  const start = useStartSlurpSexting();
  const requestRef = useRef<string | null>(null);
  // The clock re-renders each minute; Date.now() keeps a fresh buy from reading "21 min left".
  const now = Math.max(useSlpMinuteClock(), Date.now());
  const price = threadQuery.data?.sextingPrice;
  if (!thread || !personaId || thread.state !== "active" || price == null) return null;
  const endsAt = thread.sexting ? Date.parse(thread.sexting.endsAt) : 0;
  const minutesLeft = Math.ceil((endsAt - now) / 60_000);
  const minutesOver = (now - endsAt) / 60_000;

  const buy = async () => {
    setError(null);
    requestRef.current ??= newRequestId();
    try {
      const result = await start.mutateAsync({ personaId, threadId: thread.id, requestId: requestRef.current });
      requestRef.current = null;
      setStandaloneTip(result.message);
      if (result.reply) holdTyping(result.typingMs ?? 0, result.reply.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.sexting.failed", { defaultValue: "Could not start the session." }),
      );
    }
  };

  const row = "mx-auto mt-2 flex w-full max-w-[45rem] shrink-0 items-center gap-2 px-3 text-xs";
  if (minutesLeft > 0) {
    return (
      <div className={row} role="status">
        <Flame size={14} className="text-[var(--slurp-warm)]" aria-hidden="true" />
        <span className="font-bold text-[var(--slurp-text)]">
          {localizeUi("ui.slurp.sexting.running", { defaultValue: "Sexting session" })}
        </span>
        <span className="tabular-nums text-[var(--slurp-muted)]">
          {localizeUi("ui.slurp.sexting.left", { defaultValue: "{{count}} min left", count: minutesLeft })}
        </span>
      </div>
    );
  }
  if (thread.sexting && minutesOver < TIP_PROMPT_MINUTES) {
    return (
      <div className={row}>
        <span className="min-w-0 flex-1 text-[var(--slurp-muted)]">
          {localizeUi("ui.slurp.sexting.over", { defaultValue: "Session over. Leave a tip?" })}
        </span>
        <SlpButton
          variant="quiet"
          onClick={() => {
            setToolTab("tip");
            setToolsOpen(true);
          }}
        >
          {localizeUi("ui.slurp.sexting.tip", { defaultValue: "Send a tip" })}
        </SlpButton>
      </div>
    );
  }
  return (
    <div className={row}>
      <SlpButton variant="quiet" disabled={busy || start.isPending} onClick={() => void buy()}>
        <Flame size={14} aria-hidden="true" />
        {localizeUi("ui.slurp.sexting.buy", { defaultValue: "Sext with me – 20 min" })}
        <SlurpCoinAmount amount={price} className="tabular-nums" />
      </SlpButton>
    </div>
  );
}
