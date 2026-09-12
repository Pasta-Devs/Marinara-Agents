import { cn } from "../../lib/utils";

/** Quiet Slurp branding for empty media surfaces. The paths read as waves or loose spaghetti. */
export function SlurpEmptyArtwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 220"
      aria-hidden="true"
      className={cn("pointer-events-none h-full w-full text-[var(--noodle-accent)]", className)}
      preserveAspectRatio="none"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M-30 54C60 8 92 110 178 62s116-2 188 16 116 20 174-18 88-25 160 12" strokeWidth="10" opacity=".2" />
        <path d="M-40 104c76-34 116 34 190 4s112-28 188 8 122 35 188-2 101-26 154 4" strokeWidth="7" opacity=".14" />
        <path d="M-24 158c82-28 118 30 190 0s122-20 190 10 112 22 176-10 93-16 144 10" strokeWidth="13" opacity=".11" />
        <path d="M40 195c32-22 58-18 82 0m326-8c30-26 60-23 94 2" strokeWidth="5" opacity=".16" />
      </g>
      <g fill="currentColor" opacity=".18">
        <circle cx="82" cy="32" r="7" />
        <circle cx="518" cy="42" r="5" />
        <circle cx="306" cy="184" r="6" />
      </g>
    </svg>
  );
}
