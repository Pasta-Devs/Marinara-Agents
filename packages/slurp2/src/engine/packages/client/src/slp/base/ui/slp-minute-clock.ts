import { useEffect, useState } from "react";

import { onSlurpWorldOffsetChange, slurpWorldNowMs } from "../../../../../shared/src/slp/slp-world-clock.js";
/** "Now", moved on once a minute, so time-based cutoffs (a Story's lifetime) expire on screen (R1-040). */
export function useSlpMinuteClock(): number {
  const [now, setNow] = useState(() => slurpWorldNowMs());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(slurpWorldNowMs()), 60_000);
    const stopOffset = onSlurpWorldOffsetChange(() => setNow(slurpWorldNowMs()));
    return () => {
      window.clearInterval(timer);
      stopOffset();
    };
  }, []);
  return now;
}
