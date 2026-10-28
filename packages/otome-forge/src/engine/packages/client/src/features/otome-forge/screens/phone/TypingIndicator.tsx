// ──────────────────────────────────────────────
// Otome Forge: three dots in his bubble while he "types" (lib/typing-delay.ts). Visual only: the thread's live region
// says "{name} is typing…". Under reduced motion the dots stay still.
// ──────────────────────────────────────────────
export function TypingIndicator() {
  return (
    <li className="of-bubble-row" data-who="li" aria-hidden="true">
      <span className="of-bubble of-typing">
        <span className="of-typing-dot" />
        <span className="of-typing-dot" />
        <span className="of-typing-dot" />
      </span>
    </li>
  );
}
