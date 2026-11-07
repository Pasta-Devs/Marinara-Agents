// ──────────────────────────────────────────────
// Otome Forge: three dots in his bubble while he "types" (lib/typing-delay.ts). Visual only: the thread's live region
// says "{name} is typing…". Under reduced motion the dots stay still. In the group chat (#2154, `group`) the bubble
// sits beside the members' 24 px portrait gap, in line with theirs.
// ──────────────────────────────────────────────
export function TypingIndicator({ group = false }: { group?: boolean }) {
  const bubble = (
    <span className="of-bubble of-typing">
      <span className="of-typing-dot" />
      <span className="of-typing-dot" />
      <span className="of-typing-dot" />
    </span>
  );
  return (
    <li className="of-bubble-row" data-who="li" aria-hidden="true">
      {group ? (
        <div className="of-bubble-line">
          <span className="of-bubble-gap" />
          {bubble}
        </div>
      ) : (
        bubble
      )}
    </li>
  );
}
