import React from "react";
import { emojiFor } from "./emoji";

export { emojiFor };

/** Grey placeholder box with a desaturated emoji. `size`: sm (inline) | md (tile) | lg (hero). */
export function EmojiThumb({ text, fallback, size = "md", className = "" }: { text: string; fallback?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span className={`vp-emoji-thumb vp-emoji-thumb--${size} ${className}`.trim()} aria-hidden="true">
      {emojiFor(text, fallback)}
    </span>
  );
}
