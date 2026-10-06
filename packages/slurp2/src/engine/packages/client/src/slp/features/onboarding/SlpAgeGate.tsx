// The license scene of opening day (docs/OPENING-DAY.md): the Pastapay gag on the stage. The scene's
// answer cards hold the explicit 18+ confirm and "Not now, take me back" (leaves Slurp).
import { Check, CreditCard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";

// Skip the theatrics for reduced-motion users: land the card in its finished state immediately.
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const CARD_NUMBER = "5309 1312 4200 6969";

/**
 * The license scene's stage object: the Pastapay card swings in, types its number and "charges"
 * $0.00. The explicit 18+ confirm is the scene's answer card ("I'm 18 or older"), not this card.
 */
export function SlurpAgeGate({ personaName, done = false }: { personaName: string; done?: boolean }) {
  const { t } = useUiTranslation();
  const tt = (key: string, fallback: string) => t(`ui.noodle.agegate.${key}`, fallback);
  const reducedMotion = usePrefersReducedMotion() || done;
  const displayName = personaName.trim() || tt("anonymousAdult", "A. Nonymous");
  const [typed, setTyped] = useState(reducedMotion ? CARD_NUMBER.length : 0);
  const [charged, setCharged] = useState(reducedMotion);
  const [chargeAmount, setChargeAmount] = useState("9.99");
  const chargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setTyped(CARD_NUMBER.length);
      setCharged(true);
      return;
    }
    const interval = setInterval(() => {
      setTyped((n) => {
        if (n >= CARD_NUMBER.length) {
          clearInterval(interval);
          chargeTimer.current = setTimeout(() => setCharged(true), 700);
          return n;
        }
        return n + 1;
      });
    }, 70);
    return () => {
      clearInterval(interval);
      if (chargeTimer.current) clearTimeout(chargeTimer.current);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || charged) return;
    const interval = setInterval(() => {
      setChargeAmount((Math.floor(Math.random() * 99_999) + 1).toString().padStart(3, "0").replace(/(..)$/, ".$1"));
    }, 110);
    return () => clearInterval(interval);
  }, [charged, reducedMotion]);

  const shownNumber = CARD_NUMBER.slice(0, typed).padEnd(CARD_NUMBER.length, "•");
  return (
    <div
      className="flex w-full flex-col items-center gap-3.5"
      aria-label={tt("cardTitle", "Confirm that you are 18 or older")}
    >
      <div className="slp-pastapay relative flex aspect-[1.586/1] w-[min(80vw,330px)] flex-col justify-between overflow-hidden rounded-[18px] bg-gradient-to-br from-zinc-800 to-zinc-950 p-[18px] text-zinc-100 shadow-[0_30px_60px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.12)]">
        <div className="flex items-center justify-between">
          <CreditCard size={26} aria-hidden="true" className="text-[var(--noodle-accent-foreground)]" />
          <span className="text-xs font-bold tracking-widest text-zinc-400">{tt("cardBrand", "Pastapay")}</span>
        </div>
        <p className="font-mono text-[19px] tracking-[0.12em] tabular-nums">{shownNumber}</p>
        <div className="flex items-end justify-between text-xs">
          <div>
            <p className="text-[11px] leading-[14px] text-zinc-400">{tt("cardHolder", "Card Holder")}</p>
            <p className="font-semibold uppercase">{displayName}</p>
          </div>
          <div>
            <p className="text-[11px] leading-[14px] text-zinc-400">{tt("cardExp", "Expires")}</p>
            <p className="font-semibold">12 / 34</p>
          </div>
          <div>
            <p className="text-[11px] leading-[14px] text-zinc-400">{tt("cardCvv", "CVV")}</p>
            <p className="font-semibold">🍆</p>
          </div>
        </div>
      </div>
      <p
        className={cn(
          SLP_TYPE.meta,
          "flex items-center gap-1.5 rounded-full px-3 py-1.5",
          charged
            ? "bg-[color-mix(in_srgb,var(--slurp-success)_20%,transparent)] text-[var(--slurp-text)]"
            : "text-[var(--slurp-muted)]",
        )}
      >
        {charged ? (
          <>
            <Check size={14} aria-hidden="true" className="text-[var(--slurp-success)]" />
            {tt("cardFree", "Charged $0.00. It's free, we can't afford servers.")}
          </>
        ) : (
          <>
            <Loader2 size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            {t("ui.noodle.agegate.cardCharging", { amount: chargeAmount, defaultValue: "Charging ${{amount}}..." })}
          </>
        )}
      </p>
      <style>{`
        @keyframes slp-pastapay-in { from { opacity: 0; transform: rotateX(60deg) rotateZ(-14deg) translateY(60px); } }
        .slp-pastapay { transform: rotateX(16deg) rotateZ(-5deg); animation: slp-pastapay-in 1s cubic-bezier(.34,1.56,.64,1) both; }
        @media (prefers-reduced-motion: reduce) { .slp-pastapay { animation: none; } }
      `}</style>
    </div>
  );
}

export function SlurpConfetti({ fixed = false }: { fixed?: boolean }) {
  // Randomized positions computed in an effect (Math.random is impure — can't run during render).
  const [pieces, setPieces] = useState<Array<{ left: string; delay: string; hue: number }>>([]);
  useEffect(() => {
    setPieces(
      Array.from({ length: 24 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.3}s`,
        hue: (i * 37) % 360,
      })),
    );
  }, []);
  return (
    <>
      <GateStyles />
      <div
        className={`pointer-events-none inset-0 overflow-hidden ${fixed ? "fixed z-[100]" : "absolute z-10"}`}
        aria-hidden="true"
      >
        {pieces.map((p, i) => (
          <span
            key={i}
            className={`agegate-confetti${fixed ? " agegate-confetti-screen" : ""}`}
            style={{
              left: p.left,
              animationDelay: p.delay,
              background: `hsl(${p.hue} 90% 60%)`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// Component-scoped keyframes: no existing confetti animation in globals.css, and a confetti
// dependency would blow the bundle budget for a joke screen.
function GateStyles() {
  return (
    <style>{`
      .agegate-confetti {
        position: absolute; top: -10px; width: 8px; height: 8px; border-radius: 1px;
        animation: agegate-fall 1s ease-in forwards;
      }
      @keyframes agegate-fall {
        to { transform: translateY(360px) rotate(540deg); opacity: 0; }
      }
      .agegate-confetti-screen { animation-name: agegate-fall-screen; }
      @keyframes agegate-fall-screen {
        to { transform: translateY(100vh) rotate(540deg); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .agegate-confetti { animation: none; }
      }
    `}</style>
  );
}
