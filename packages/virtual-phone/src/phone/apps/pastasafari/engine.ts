export type Tile = "red" | "yellow" | "green" | "blue" | "pink";
type Cell = Tile | null;
export const SIZE = 6;
export const START_MOVES = 24;
const COLORS: Tile[] = ["red", "yellow", "green", "blue", "pink"];
export const randomTile = () => COLORS[Math.floor(Math.random() * COLORS.length)]!;
export const newBoard = () => Array.from({ length: SIZE * SIZE }, randomTile);

/** Every horizontal or vertical run of 3+ of the same tile. Overlapping triples cover longer runs. */
export function findMatches(board: Cell[]): Set<number> {
  const found = new Set<number>();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE - 2; c++) {
    const t = board[r * SIZE + c];
    if (t && t === board[r * SIZE + c + 1] && t === board[r * SIZE + c + 2]) { found.add(r * SIZE + c); found.add(r * SIZE + c + 1); found.add(r * SIZE + c + 2); }
  }
  for (let c = 0; c < SIZE; c++) for (let r = 0; r < SIZE - 2; r++) {
    const t = board[r * SIZE + c];
    if (t && t === board[(r + 1) * SIZE + c] && t === board[(r + 2) * SIZE + c]) { found.add(r * SIZE + c); found.add((r + 1) * SIZE + c); found.add((r + 2) * SIZE + c); }
  }
  return found;
}

/** Tiles fall into cleared gaps; new ones drop in from the top. */
export function applyGravity(board: Cell[]): Tile[] {
  const next = board.slice();
  for (let c = 0; c < SIZE; c++) {
    const stack: Tile[] = [];
    for (let r = SIZE - 1; r >= 0; r--) { const v = next[r * SIZE + c]; if (v) stack.push(v); }
    for (let r = SIZE - 1, i = 0; r >= 0; r--, i++) next[r * SIZE + c] = i < stack.length ? stack[i]! : randomTile();
  }
  return next as Tile[];
}

/** Clear all matches, collapse, repeat — so one swap can chain into a cascade. */
export function resolve(start: Cell[]): { board: Tile[]; cleared: number; cascades: number } {
  let board = start.slice();
  let cleared = 0;
  let cascades = 0;
  for (;;) {
    const m = findMatches(board);
    if (m.size === 0) break;
    cleared += m.size;
    cascades += 1;
    board = applyGravity(board.map((t, i) => (m.has(i) ? null : t)));
  }
  return { board: board as Tile[], cleared, cascades };
}

/** A board with no matches sitting on it, so the player starts at zero. */
export function freshBoard(): Tile[] {
  let board = newBoard();
  while (findMatches(board).size > 0) board = resolve(board).board;
  return board;
}

export const adjacent = (a: number, b: number) => {
  const ra = Math.floor(a / SIZE), ca = a % SIZE, rb = Math.floor(b / SIZE), cb = b % SIZE;
  return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
};
