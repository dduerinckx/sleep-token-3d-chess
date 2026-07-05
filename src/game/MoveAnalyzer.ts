import { Chess, type Color, type Move, type Square } from "chess.js";

export type MoveQuality = "killer" | "good" | "bad" | "fuckup";

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

function materialScore(chess: Chess, color: Color): number {
  const board = chess.board();
  let total = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell || cell.color !== color) continue;
      total += VALUES[cell.type] ?? 0;
    }
  }
  return total;
}

export function analyzeMove(fenBefore: string, move: Move, afterCheckmate: boolean, afterCheck: boolean): MoveQuality {
  const before = new Chess(fenBefore);
  const mover = before.turn();
  const matBefore = materialScore(before, mover);

  const captured = move.captured ? VALUES[move.captured] ?? 0 : 0;
  const after = new Chess(fenBefore);
  after.move({ from: move.from, to: move.to, promotion: move.promotion });
  const matAfter = materialScore(after, mover);
  const swing = matAfter - matBefore + captured;

  if (afterCheckmate) return "killer";
  if (move.promotion === "q" || captured >= 5) return "killer";
  if (afterCheck && captured >= 3) return "killer";
  if (afterCheck) return "good";
  if (captured >= 3) return "killer";
  if (swing <= -3) return "fuckup";
  if (swing < 0) return "bad";
  if (captured >= 1) return "good";
  return "good";
}

export function analyzeIllegalAttempt(): MoveQuality {
  return "fuckup";
}

export type SessionMoveStats = {
  killer: number;
  good: number;
  bad: number;
  fuckup: number;
};

export function emptyMoveStats(): SessionMoveStats {
  return { killer: 0, good: 0, bad: 0, fuckup: 0 };
}

export function recordQuality(stats: SessionMoveStats, quality: MoveQuality): void {
  stats[quality] += 1;
}

export function tryMove(fen: string, from: Square, to: Square, promotion = "q"): { move: Move | null; fenBefore: string } {
  const chess = new Chess(fen);
  const fenBefore = chess.fen();
  try {
    const move = chess.move({ from, to, promotion });
    return { move, fenBefore };
  } catch {
    return { move: null, fenBefore };
  }
}