export function prioritizeFirstCallHaptic<T extends { mode: string; content: string }>(turns: T[]): T[] {
  const firstVoiceIndex = turns.findIndex((turn) => turn.mode === "voice" && turn.content.trim());
  if (firstVoiceIndex < 0) return turns;
  const firstHapticIndex = turns.findIndex(
    (turn) => turn.mode === "command" && /^\s*\[haptic(?:\s|:|\])/i.test(turn.content),
  );
  if (firstHapticIndex < firstVoiceIndex) return turns;
  if (firstHapticIndex < 0) return turns;
  return [
    ...turns.slice(0, firstVoiceIndex),
    turns[firstHapticIndex]!,
    ...turns.slice(firstVoiceIndex, firstHapticIndex),
    ...turns.slice(firstHapticIndex + 1),
  ];
}
