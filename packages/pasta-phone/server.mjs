// Pasta Phone is a client-only preview shell: the phone chrome renders entirely
// from hardcoded mock data, so there is no server behaviour to register yet.
// The Engine still loads a server entrypoint for every feature package, so this
// activates and cleans up as a no-op. Real routes arrive with real data wiring.
export function activate() {
  return () => {};
}
