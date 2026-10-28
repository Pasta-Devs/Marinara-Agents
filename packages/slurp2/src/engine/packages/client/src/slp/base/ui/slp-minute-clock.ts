import { useEffect, useState } from "react";

/** "Now", moved on once a minute, so time-based cutoffs (a Story's lifetime) expire on screen (R1-040). */
export function useSlpMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
