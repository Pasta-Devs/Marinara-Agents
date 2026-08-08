import React from "react";
import { RotateCcw, Trophy } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { recordActivity, rememberWorldFact } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";

type Tile = "red" | "yellow" | "green" | "blue" | "pink";
type Progress = { board: Tile[]; score: number; best: number; streak: number; moves: number };
const SIZE = 6;
const COLORS: Tile[] = ["red", "yellow", "green", "blue", "pink"];
const randomTile = () => COLORS[Math.floor(Math.random() * COLORS.length)]!;
const newBoard = () => Array.from({ length: SIZE * SIZE }, randomTile);
const initial = (): Progress => ({ board: newBoard(), score: 0, best: 0, streak: 0, moves: 24 });

function matches(board: Tile[], index: number) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const found = new Set<number>([index]);
  for (const direction of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    let r = row + direction[0]!;
    let c = col + direction[1]!;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === board[index]) {
      found.add(r * SIZE + c); r += direction[0]!; c += direction[1]!;
    }
  }
  const horizontal = [...found].filter((entry) => Math.floor(entry / SIZE) === row).length;
  const vertical = [...found].filter((entry) => entry % SIZE === col).length;
  return horizontal >= 3 || vertical >= 3 ? found : new Set<number>();
}

export function PastasafariShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "pastasafari");
  const [game, setGame] = React.useState<Progress | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [notice, setNotice] = React.useState("");
  const persist = (next: Progress) => { setGame(next); void store.set("progress", next).catch(() => setNotice("Progress could not be saved.")); };
  React.useEffect(() => { void store.get("progress").then((value) => setGame(value && typeof value === "object" && Array.isArray((value as Progress).board) ? value as Progress : initial())).catch(() => setGame(initial())); }, [store]);

  const tap = (index: number) => {
    if (!game || game.moves <= 0) return;
    if (selected === null) return setSelected(index);
    if (selected === index) return setSelected(null);
    const adjacent = Math.abs(selected - index) === 1 || Math.abs(selected - index) === SIZE;
    if (!adjacent || (Math.floor(selected / SIZE) !== Math.floor(index / SIZE) && Math.abs(selected - index) === 1)) return setSelected(index);
    const board = [...game.board]; [board[selected], board[index]] = [board[index]!, board[selected]!];
    const group = matches(board, index);
    if (group.size < 3) return setSelected(index);
    const cleared = [...group];
    for (const entry of cleared) board[entry] = randomTile();
    const score = game.score + cleared.length * 10;
    const next = { ...game, board, score, best: Math.max(game.best, score), streak: game.streak + 1, moves: game.moves - 1 };
    persist(next); setSelected(null);
    if (next.streak % 3 === 0 || next.moves === 0) {
      void recordActivity(phoneId, `played Pastasafari and reached ${next.score} points`).catch(() => undefined);
      void rememberWorldFact(phoneId, `Pastasafari score: ${next.score} points, ${next.streak} matches in a row.`, "Pastasafari").catch(() => undefined);
    }
  };
  const reset = () => { persist(initial()); setSelected(null); setNotice(""); };

  return <section aria-labelledby="pastasafari-title" className="vp-appview">
    <PhoneAppHeader title="Pastasafari" titleId="pastasafari-title" closeLabel="Close Pastasafari" onBack={onBack} onClose={onClose} actions={[{ id: "reset", icon: "refresh", label: "New game", kind: "button" }]} onAction={reset} />
    <div className="vp-game-head"><span><strong>{game?.score ?? 0}</strong><small>score</small></span><span><strong>{game?.moves ?? 0}</strong><small>moves</small></span><span><Trophy size="1rem" aria-hidden="true" /><strong>{game?.best ?? 0}</strong><small>best</small></span></div>
    {notice ? <p role="alert" className="vp-muted-note">{notice}</p> : null}
    <div className="vp-pasta-board" role="grid" aria-label="Pastasafari game board">{(game?.board ?? Array(36).fill("red")).map((tile, index) => <button key={index} type="button" role="gridcell" aria-label={`${tile} pasta tile`} aria-pressed={selected === index} className={`vp-pasta-tile vp-pasta-tile--${tile}${selected === index ? " is-selected" : ""}`} onClick={() => tap(index)} />)}</div>
    <p className="vp-muted-note">Match three of the same pasta. Scores and streaks stay with this phone.</p>
    <button type="button" className="vp-surface-btn" onClick={reset}><RotateCcw size="0.9rem" aria-hidden="true" /> New game</button>
  </section>;
}
