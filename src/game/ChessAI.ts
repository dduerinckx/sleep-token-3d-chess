import { Chess, type Square } from "chess.js";

const VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -100000 : 100000;
  if (chess.isDraw()) return 0;

  const board = chess.board();
  let score = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      const v = VALUES[cell.type] ?? 0;
      score += cell.color === "w" ? v : -v;
    }
  }
  return chess.turn() === "w" ? score : -score;
}

export type AiMove = { from: Square; to: Square; promotion?: string };

export function pickComputerMove(fen: string, depth = 2): AiMove | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    chess.move(move);
    const score = -negamax(chess, depth - 1, -Infinity, Infinity);
    chess.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return {
    from: bestMove.from as Square,
    to: bestMove.to as Square,
    promotion: bestMove.promotion,
  };
}

function negamax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess);

  let best = -Infinity;
  for (const move of chess.moves({ verbose: true })) {
    chess.move(move);
    const score = -negamax(chess, depth - 1, -beta, -alpha);
    chess.undo();
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}