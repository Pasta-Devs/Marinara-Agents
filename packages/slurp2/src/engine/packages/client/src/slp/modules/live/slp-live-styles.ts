/** Entrances, the LIVE dot and the slow camera drift on the shot; reduced motion stops all of it. */
export const SLP_LIVE_STYLES = `
@keyframes slp-live-pop { from { opacity: 0; transform: translateY(12px) scale(.9); } to { opacity: 1; transform: none; } }
@keyframes slp-live-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes slp-live-dot { 50% { opacity: .35; } }
@keyframes slp-live-shot-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slp-live-drift { from { transform: scale(1.04) translate(0, 0); } to { transform: scale(1.14) translate(-2%, -1.5%); } }
.slp-live-pop { animation: slp-live-pop .45s cubic-bezier(.34,1.56,.64,1) both; }
.slp-live-fade { animation: slp-live-fade .4s ease-out both; }
.slp-live-dot { animation: slp-live-dot 1.4s ease-in-out infinite; }
.slp-live-shot { animation: slp-live-shot-in 1.2s ease-out both, slp-live-drift 24s ease-in-out infinite alternate; }
.slp-live-chat-fade { mask-image: linear-gradient(to bottom, transparent, #000 45%); -webkit-mask-image: linear-gradient(to bottom, transparent, #000 45%); }
@media (prefers-reduced-motion: reduce) { .slp-live-pop, .slp-live-fade, .slp-live-dot, .slp-live-shot { animation: none; } }
`;
