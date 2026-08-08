import React from "react";
import { RotateCcw, Trophy } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { recordActivity, rememberWorldFact } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";
import { adjacent, findMatches, freshBoard, resolve, SIZE, START_MOVES, type Tile } from "./engine";

type Progress = { board: Tile[]; score: number; best: number; streak: number; moves: number };
const initial = (): Progress => ({ board: freshBoard(), score: 0, best: 0, streak: 0, moves: START_MOVES });

export function PastasafariShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "pastasafari");
  const [game, setGame] = React.useState<Progress | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [flash, setFlash] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const persist = (next: Progress) => { setGame(next); void store.set("progress", next).catch(() => setNotice("Progress could not be saved.")); };
  React.useEffect(() => { void store.get("progress").then((value) => setGame(value && typeof value === "object" && Array.isArray((value as Progress).board) && (value as Progress).board.length === SIZE * SIZE ? value as Progress : initial())).catch(() => setGame(initial())); }, [store]);

  const over = !!game && game.moves <= 0;

  const tap = (index: number) => {
    if (!game || over) return;
    if (selected === null) return setSelected(index);
    if (selected === index) return setSelected(null);
    if (!adjacent(selected, index)) return setSelected(index);
    const swapped = [...game.board];
    [swapped[selected], swapped[index]] = [swapped[index]!, swapped[selected]!];
    if (findMatches(swapped).size === 0) { setSelected(null); setFlash("No match there."); return; }
    const { board, cleared, cascades } = resolve(swapped);
    // Cascades pay more: a chain of 3 clears is worth more than three separate ones.
    const gained = cleared * 10 * cascades;
    const score = game.score + gained;
    const moves = game.moves - 1;
    const next: Progress = { board, score, best: Math.max(game.best, score), streak: game.streak + 1, moves };
    persist(next);
    setSelected(null);
    setFlash(cascades > 1 ? `Cascade ×${cascades}! +${gained}` : `+${gained}`);
    if (cascades >= 3 || cleared >= 8) void rememberWorldFact(phoneId, `Pulled off a ${cascades}-chain in Pastasafari for ${gained} points.`, "Pastasafari").catch(() => undefined);
    if (moves <= 0) {
      void recordActivity(phoneId, `played Pastasafari and finished with ${score} points`).catch(() => undefined);
      void rememberWorldFact(phoneId, `Pastasafari game: ${score} points${score >= next.best ? " (a personal best)" : ""}.`, "Pastasafari").catch(() => undefined);
    }
  };
  const reset = () => { persist({ ...initial(), best: game?.best ?? 0 }); setSelected(null); setFlash(""); setNotice(""); };

  return <section aria-labelledby="pastasafari-title" className="vp-appview">
    <PhoneAppHeader title="Pastasafari" titleId="pastasafari-title" closeLabel="Close Pastasafari" onBack={onBack} onClose={onClose} actions={[{ id: "reset", icon: "refresh", label: "New game", kind: "button" }]} onAction={reset} />
    <div className="vp-game-head"><span><strong>{game?.score ?? 0}</strong><small>score</small></span><span><strong>{game?.moves ?? 0}</strong><small>moves</small></span><span><Trophy size="1rem" aria-hidden="true" /><strong>{game?.best ?? 0}</strong><small>best</small></span></div>
    {notice ? <p role="alert" className="vp-muted-note">{notice}</p> : null}
    <div className="vp-pasta-stage">
      <div className="vp-pasta-board" role="grid" aria-label="Pastasafari game board">{(game?.board ?? Array(SIZE * SIZE).fill("red")).map((tile, index) => <button key={index} type="button" role="gridcell" aria-label={`${tile} pasta tile`} aria-pressed={selected === index} disabled={over} className={`vp-pasta-tile vp-pasta-tile--${tile}${selected === index ? " is-selected" : ""}`} onClick={() => tap(index)} />)}</div>
      {over ? <div className="vp-pasta-over" role="status"><strong>Out of moves</strong><span>{game?.score ?? 0} points</span><button type="button" className="vp-accent-btn" onClick={reset}>Play again</button></div> : null}
    </div>
    <p className="vp-pasta-flash" aria-live="polite">{over ? "" : flash || "Swap two neighbours to line up three. Chains score more."}</p>
    <button type="button" className="vp-surface-btn" onClick={reset}><RotateCcw size="0.9rem" aria-hidden="true" /> New game</button>
  </section>;
}
