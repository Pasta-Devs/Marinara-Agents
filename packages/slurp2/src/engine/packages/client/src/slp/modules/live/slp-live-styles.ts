/** Entrances only; the LIVE dot is the one loop, and reduced motion stops all of it. */
export const SLP_LIVE_STYLES = `
@keyframes slp-live-pop { from { opacity: 0; transform: translateY(12px) scale(.9); } to { opacity: 1; transform: none; } }
@keyframes slp-live-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes slp-live-dot { 50% { opacity: .35; } }
.slp-live-pop { animation: slp-live-pop .45s cubic-bezier(.34,1.56,.64,1) both; }
.slp-live-fade { animation: slp-live-fade .4s ease-out both; }
.slp-live-dot { animation: slp-live-dot 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .slp-live-pop, .slp-live-fade, .slp-live-dot { animation: none; } }
`;
