import { Chess, type Color, type Move, type Square } from "chess.js";

export type GameResult = {
  fen: string;
  turn: Color;
  isGameOver: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  winner: Color | null;
  lastMove: Move | null;
};

export class ChessEngine {
  private chess = new Chess();

  reset(): void {
    this.chess = new Chess();
  }

  loadFen(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  get fen(): string {
    return this.chess.fen();
  }

  get turn(): Color {
    return this.chess.turn();
  }

  get history(): Move[] {
    return this.chess.history({ verbose: true });
  }

  getLastMove(): Move | null {
    const moves = this.history;
    return moves.length ? moves[moves.length - 1] : null;
  }

  getLegalMoves(square?: Square) {
    return square ? this.chess.moves({ square, verbose: true }) : this.chess.moves({ verbose: true });
  }

  isLegalMove(from: Square, to: Square, promotion?: string): boolean {
    const moves = this.getLegalMoves(from);
    return moves.some((m) => m.to === to && (!promotion || m.promotion === promotion));
  }

  makeMove(from: Square, to: Square, promotion = "q"): Move | null {
    try {
      return this.chess.move({ from, to, promotion });
    } catch {
      return null;
    }
  }

  undo(): Move | null {
    return this.chess.undo();
  }

  getState(): GameResult {
    return {
      fen: this.fen,
      turn: this.turn,
      isGameOver: this.chess.isGameOver(),
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
      winner: this.chess.isCheckmate() ? (this.turn === "w" ? "b" : "w") : null,
      lastMove: this.getLastMove(),
    };
  }
}