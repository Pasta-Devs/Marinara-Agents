/** A host line: *actions* read dim and italic, "speech" reads bigger; everything else stays as it is. */
export function SlpLiveSpokenText({ text, speechClassName = "" }: { text: string; speechClassName?: string }) {
  // split() puts the captured *action* / "speech" pieces at the odd indices.
  return (
    <>
      {text.split(/(\*[^*\n]+\*|"[^"\n]+"|“[^”\n]+”)/).map((part, index) =>
        index % 2 === 0 ? (
          part
        ) : part.startsWith("*") ? (
          <em key={index} className="italic opacity-70">
            {part.slice(1, -1)}
          </em>
        ) : (
          <span key={index} className={`font-semibold not-italic ${speechClassName}`}>
            {part}
          </span>
        ),
      )}
    </>
  );
}
