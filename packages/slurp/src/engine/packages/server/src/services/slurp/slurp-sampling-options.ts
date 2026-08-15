// Pure on purpose: no Engine imports, so the precedence rule stays testable.

// Package defaults and connection defaults are resolved per parameter: a value the
// user set on the connection wins, and the package default applies only where the
// user set nothing. Spreading the stored options over a package default did not do
// this — an unset stored parameter is present as undefined, so it overwrote the
// package value — and spreading the package default over the stored options threw
// the user's sampling settings away.
export function noodleSamplingOptions<
  T extends { temperature?: number; topP?: number },
>(stored: T, defaults: { temperature: number; topP: number }): T & {
  temperature: number;
  topP: number;
} {
  return {
    ...stored,
    temperature: stored.temperature ?? defaults.temperature,
    topP: stored.topP ?? defaults.topP,
  };
}
