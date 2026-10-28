import { useLayoutEffect, useRef, type ComponentProps } from "react";

/**
 * A textarea that grows with its text (composer caption, post edit), so a long post is never cut
 * off in a two-line box. `field-sizing: content` does this in CSS, but Safari and Firefox do not
 * have it yet, so the height follows `scrollHeight` instead.
 */
export function SlpAutoGrowTextarea({ value, style, ...props }: ComponentProps<"textarea"> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} value={value} rows={3} {...props} style={{ ...style, overflow: "hidden" }} />;
}
