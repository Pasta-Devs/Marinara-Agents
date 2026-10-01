// The 18+ check as a card in the Support ticket (docs/ONBOARDING-RAIL.md, chapter 2): the Pastapay
// gag, then an explicit adult confirmation. Nothing in the rail runs before it; "Not now" leaves Slurp.
import { Check, CreditCard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton, SlpPrimaryButton, SlpSquareCheck } from "../../modules/chrome/SlpButton";

interface Props {
  personaName: string;
  onComplete: () => void;
  onLeave?: () => void;
  /** Already confirmed: the finished card, read only (the ticket's history after a reload). */
  done?: boolean;
}

// Skip the theatrics for reduced-motion users: land the card in its finished state immediately
// so nobody is trapped waiting on an animation to unlock the button.
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

export function SlurpAgeGate({ personaName, onComplete, onLeave, done = false }: Props) {
  const { t } = useUiTranslation();
  const tt = (key: string, fallback: string) => t(`ui.noodle.agegate.${key}`, fallback);
  const reducedMotion = usePrefersReducedMotion() || done;
  const displayName = personaName.trim() || tt("anonymousAdult", "A. Nonymous");

  const [typed, setTyped] = useState(reducedMotion ? CARD_NUMBER.length : 0);
  const [charged, setCharged] = useState(reducedMotion);
  const [confirmedAdult, setConfirmedAdult] = useState(done);
  const [chargeAmount, setChargeAmount] = useState("9.99");
  const [confetti, setConfetti] = useState(false);
  const chargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // The media query is live, so reduced motion can turn on after mount. Seeding the state was
    // not enough: returning early here would tear down the interval before it ever set `charged`,
    // leaving Enter disabled forever. Land the card in its finished state instead.
    if (reducedMotion) {
      setTyped(CARD_NUMBER.length);
      setCharged(true);
      return;
    }
    const interval = setInterval(() => {
      setTyped((n) => {
        if (n >= CARD_NUMBER.length) {
          clearInterval(interval);
          chargeTimer.current = setTimeout(() => setCharged(true), 900);
          return n;
        }
        return n + 1;
      });
    }, 90);
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

  // Enter is a one-way door: a second click during the confetti beat would complete the check twice.
  const entered = useRef(false);
  const enter = () => {
    if (!confirmedAdult || !charged || entered.current) return;
    entered.current = true;
    setConfetti(true);
    onComplete();
  };

  return (
    <div className="relative flex w-full max-w-sm flex-col gap-3 overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] p-3 text-[var(--slurp-text)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
      {confetti && <SlurpConfetti />}
      <div className="px-1">
        <h3 className={cn(SLP_TYPE.title, "text-balance")}>{tt("cardTitle", "Confirm that you are 18 or older")}</h3>
        <p className={cn(SLP_TYPE.body, "mt-1 text-pretty text-[var(--muted-foreground)]")}>
          {tt("cardSub", "This confirmation is required to enter Slurp. No payment information is collected.")}
        </p>
      </div>

      <div className="relative flex aspect-[1.586/1] w-full flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 text-zinc-100 shadow-[var(--slurp-shadow-floating),inset_0_1px_0_rgb(255_255_255/0.12)]">
        <div className="flex items-center justify-between">
          <CreditCard size={26} className="text-[var(--noodle-accent-foreground)]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            {tt("cardBrand", "Pastapay")}
          </span>
        </div>
        <p className="font-mono text-base tracking-[0.1em] tabular-nums sm:text-lg">{shownNumber}</p>
        <div className="flex items-end justify-between text-xs">
          <div>
            <p className="text-[11px] leading-[14px] uppercase text-zinc-400">{tt("cardHolder", "Card Holder")}</p>
            <p className="font-semibold uppercase">{displayName}</p>
          </div>
          <div>
            <p className="text-[11px] leading-[14px] uppercase text-zinc-400">{tt("cardExp", "Expires")}</p>
            <p className="font-semibold">12 / 34</p>
          </div>
          <div>
            <p className="text-[11px] leading-[14px] uppercase text-zinc-400">{tt("cardCvv", "CVV")}</p>
            <p className="font-semibold">🍆</p>
          </div>
        </div>
      </div>

      <p className={cn(SLP_TYPE.meta, "flex items-center gap-1.5 px-1 text-[var(--muted-foreground)]")}>
        {charged ? (
          <>
            <Check size={14} aria-hidden="true" className="text-[var(--slurp-success)]" />
            {tt("cardFree", "Charged $0.00. It's free, we can't afford servers.")}
          </>
        ) : (
          <>
            <Loader2 size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            {t("ui.noodle.agegate.cardCharging", {
              amount: chargeAmount,
              defaultValue: "Charging ${{amount}}...",
            })}
          </>
        )}
      </p>

      <label
        className={cn(
          SLP_TYPE.body,
          "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-[var(--slurp-tint)] px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--slurp-focus)]",
        )}
      >
        <input
          type="checkbox"
          checked={confirmedAdult}
          disabled={done}
          onChange={(event) => setConfirmedAdult(event.target.checked)}
          className="sr-only"
        />
        <SlpSquareCheck checked={confirmedAdult} />
        <span className="text-pretty">{tt("adultConfirmation", "I confirm that I am 18 years of age or older.")}</span>
      </label>

      {!done && (
        <div className="flex flex-col items-stretch gap-1">
          <SlpPrimaryButton onClick={enter} disabled={!charged || !confirmedAdult} className="h-12 text-[15px]">
            {tt("enter", "Enter Slurp")}
          </SlpPrimaryButton>
          {onLeave && (
            <SlpButton variant="tertiary" onClick={onLeave} className="self-center text-[var(--muted-foreground)]">
              {t("ui.slurp.site.tap.leave")}
            </SlpButton>
          )}
        </div>
      )}
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
