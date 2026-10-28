import React from "react";
import { HelpCircle, Lightbulb, RotateCcw, Trophy } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";
import { adjacent, findMatches, findMove, freshBoard, resolve, SIZE, START_MOVES, type Tile } from "./engine";

// Glyphs keep the board understandable without relying on colour alone.
const INGREDIENTS: Record<Tile, { glyph: string; name: string }> = {
  red: { glyph: "🍅", name: "tomato" },
  yellow: { glyph: "🧀", name: "cheese" },
  green: { glyph: "🌿", name: "basil" },
  blue: { glyph: "🫒", name: "olive" },
  pink: { glyph: "🍤", name: "shrimp" },
};

type Progress = {
  version: 2;
  board: Tile[];
  score: number;
  best: number;
  moves: number;
  gamesPlayed: number;
};

const initial = (best = 0, gamesPlayed = 0): Progress => ({
  version: 2,
  board: freshBoard(),
  score: 0,
  best,
  moves: START_MOVES,
  gamesPlayed,
});

function restoreProgress(value: unknown): Progress {
  if (!value || typeof value !== "object") return initial();
  const saved = value as Partial<Progress> & { board?: unknown };
  if (!Array.isArray(saved.board) || saved.board.length !== SIZE * SIZE) return initial();
  const validTiles = saved.board.every((tile) => typeof tile === "string" && tile in INGREDIENTS);
  if (!validTiles) return initial();
  const best = Number.isFinite(saved.best) ? Math.max(0, Number(saved.best)) : 0;
  const score = Number.isFinite(saved.score) ? Math.max(0, Number(saved.score)) : 0;
  const moves = Number.isFinite(saved.moves) ? Math.max(0, Math.min(START_MOVES, Number(saved.moves))) : START_MOVES;
  const gamesPlayed = Number.isFinite(saved.gamesPlayed) ? Math.max(0, Number(saved.gamesPlayed)) : 0;
  const board = saved.board as Tile[];
  // Older saves can contain a settled but unwinnable board. Resume with a fair board instead.
  return { version: 2, board: findMatches(board).size === 0 && findMove(board) ? board : freshBoard(), score, best, moves, gamesPlayed };
}

export function GameShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "game");
  const [game, setGame] = React.useState<Progress | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [hinted, setHinted] = React.useState<number[]>([]);
  const [message, setMessage] = React.useState("Swap neighbouring ingredients to match three.");
  const [saveError, setSaveError] = React.useState("");
  const [showRules, setShowRules] = React.useState(false);
  const [confirmNew, setConfirmNew] = React.useState(false);
  const pointerStart = React.useRef<{ index: number; x: number; y: number } | null>(null);
  const ignoreClick = React.useRef(false);

  const persist = React.useCallback((next: Progress) => {
    setGame(next);
    setSaveError("");
    void store.set("progress", next).catch(() => setSaveError("This game is playable, but progress could not be saved."));
  }, [store]);

  React.useEffect(() => {
    let active = true;
    void store.get("progress")
      .then((value) => { if (active) setGame(restoreProgress(value)); })
      .catch(() => { if (active) { setGame(initial()); setSaveError("Saved progress could not be loaded."); } });
    return () => { active = false; };
  }, [store]);

  const over = !!game && game.moves === 0;

  const attemptSwap = React.useCallback((from: number, to: number) => {
    if (!game || over || !adjacent(from, to)) return;
    setHinted([]);
    const swapped = game.board.slice();
    [swapped[from], swapped[to]] = [swapped[to]!, swapped[from]!];
    if (findMatches(swapped).size === 0) {
      setSelected(null);
      setMessage("That swap does not make a match.");
      return;
    }
    const result = resolve(swapped);
    const cascadeBonus = Math.max(0, result.cascades - 1) * 50;
    const gained = result.cleared * 10 + cascadeBonus;
    const score = game.score + gained;
    const moves = game.moves - 1;
    const finished = moves === 0;
    const playable = findMove(result.board);
    const board = playable || finished ? result.board : freshBoard();
    persist({
      ...game,
      board,
      score,
      best: Math.max(game.best, score),
      moves,
      gamesPlayed: game.gamesPlayed + (finished ? 1 : 0),
    });
    setSelected(null);
    setMessage(!playable && !finished
      ? `+${gained}. No swaps remained, so the board was shuffled.`
      : result.cascades > 1 ? `Chain ×${result.cascades} · +${gained}` : `Match · +${gained}`);
  }, [game, over, persist]);

  const tap = (index: number) => {
    if (!game || over) return;
    if (ignoreClick.current) { ignoreClick.current = false; return; }
    setHinted([]);
    if (selected === null) { setSelected(index); setMessage("Now choose a neighbouring ingredient."); return; }
    if (selected === index) { setSelected(null); setMessage("Selection cleared."); return; }
    if (!adjacent(selected, index)) { setSelected(index); setMessage("Choose one of its neighbours."); return; }
    attemptSwap(selected, index);
  };

  const hint = () => {
    if (!game || over) return;
    const move = findMove(game.board);
    if (!move) {
      persist({ ...game, board: freshBoard() });
      setMessage("No swaps remained, so the board was shuffled.");
      return;
    }
    setSelected(null);
    setHinted([move.from, move.to]);
    setMessage("Swap the two glowing ingredients.");
  };

  const startNew = () => {
    persist(initial(game?.best ?? 0, game?.gamesPlayed ?? 0));
    setSelected(null);
    setHinted([]);
    setMessage("New game. You have 24 moves.");
    setConfirmNew(false);
  };

  const requestNew = () => {
    if (game && game.score > 0 && !over) setConfirmNew(true);
    else startNew();
  };

  const finishSwipe = (event: React.PointerEvent<HTMLButtonElement>, index: number) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.index !== index || !game || over) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    const row = Math.floor(index / SIZE);
    const column = index % SIZE;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const targetRow = row + (horizontal ? 0 : dy > 0 ? 1 : -1);
    const targetColumn = column + (horizontal ? dx > 0 ? 1 : -1 : 0);
    if (targetRow < 0 || targetRow >= SIZE || targetColumn < 0 || targetColumn >= SIZE) return;
    ignoreClick.current = true;
    window.setTimeout(() => { ignoreClick.current = false; }, 0);
    attemptSwap(index, targetRow * SIZE + targetColumn);
  };

  return <section aria-labelledby="game-title" className="vp-appview vp-game" data-phone-app="game">
    <PhoneAppHeader title="Game" titleId="game-title" closeLabel="Close Game" onBack={onBack} onClose={onClose} actions={[{ id: "new", icon: "refresh", label: "New game", kind: "button" }]} onAction={requestNew} />

    {!game ? <div className="vp-game-loading" role="status">Loading game…</div> : <>
      <div className="vp-game-head" aria-label="Game status">
        <span><small>Score</small><strong>{game.score.toLocaleString()}</strong></span>
        <span className="vp-game-moves"><small>Moves</small><strong>{game.moves}</strong></span>
        <span><small>Best</small><strong><Trophy size="0.8rem" aria-hidden="true" />{game.best.toLocaleString()}</strong></span>
      </div>
      {saveError ? <p role="alert" className="vp-muted-note">{saveError}</p> : null}

      <div className="vp-pasta-stage">
        <div className="vp-pasta-board" role="grid" aria-label="Ingredient match board" aria-describedby="game-instructions">
          {game.board.map((tile, index) => <button
            key={index}
            type="button"
            role="gridcell"
            aria-rowindex={Math.floor(index / SIZE) + 1}
            aria-colindex={(index % SIZE) + 1}
            aria-label={`${INGREDIENTS[tile].name}${hinted.includes(index) ? ", suggested swap" : ""}`}
            aria-pressed={selected === index}
            disabled={over}
            className={`vp-pasta-tile vp-pasta-tile--${tile}${selected === index ? " is-selected" : ""}${hinted.includes(index) ? " is-hinted" : ""}`}
            onPointerDown={(event) => { pointerStart.current = { index, x: event.clientX, y: event.clientY }; }}
            onPointerUp={(event) => finishSwipe(event, index)}
            onPointerCancel={() => { pointerStart.current = null; }}
            onClick={() => tap(index)}
          ><span aria-hidden="true">{INGREDIENTS[tile].glyph}</span></button>)}
        </div>
        {over ? <div className="vp-pasta-over" role="status">
          <small>Game over</small>
          <strong>{game.score.toLocaleString()} points</strong>
          <span>Best: {game.best.toLocaleString()}</span>
          <button type="button" className="vp-accent-btn" onClick={startNew}>Play again</button>
        </div> : null}
      </div>

      <p id="game-instructions" className="vp-pasta-flash" aria-live="polite">{over ? "" : message}</p>
      <div className="vp-game-actions">
        <button type="button" className="vp-surface-btn" disabled={over} onClick={hint}><Lightbulb size="0.95rem" aria-hidden="true" />Hint</button>
        <button type="button" className="vp-surface-btn" onClick={() => setShowRules((shown) => !shown)} aria-expanded={showRules}><HelpCircle size="0.95rem" aria-hidden="true" />How to play</button>
      </div>
      {showRules ? <div className="vp-game-rules">
        <strong>Match ingredients</strong>
        <p>Swipe one ingredient over a neighbour, or tap both. Line up three or more. Cascades earn a bonus. The game ends after 24 successful swaps.</p>
        <small>Playing and scores stay private on this phone.</small>
      </div> : null}
      <p className="vp-game-history">Games played on this phone: {game.gamesPlayed}</p>
    </>}

    {confirmNew ? <div className="vp-game-dialog-backdrop" role="presentation" onClick={() => setConfirmNew(false)}>
      <div className="vp-game-dialog" role="alertdialog" aria-modal="true" aria-labelledby="game-new-title" onClick={(event) => event.stopPropagation()}>
        <strong id="game-new-title">Start a new game?</strong>
        <p>Your current score and remaining moves will be replaced. Your best score stays.</p>
        <div><button type="button" className="vp-surface-btn" onClick={() => setConfirmNew(false)}>Keep playing</button><button type="button" className="vp-accent-btn" onClick={startNew}><RotateCcw size="0.9rem" aria-hidden="true" />New game</button></div>
      </div>
    </div> : null}
  </section>;
}
