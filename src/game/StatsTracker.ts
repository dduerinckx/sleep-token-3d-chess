import type { Color } from "chess.js";
import type { PlayerId } from "../theme/players";
import { emptyMoveStats, type MoveQuality, type SessionMoveStats } from "./MoveAnalyzer";

export type CareerStats = {
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  killerMoves: number;
  goodMoves: number;
  badMoves: number;
  fuckUps: number;
};

export type GameOutcome = "win" | "loss" | "draw" | null;

export type SessionStats = {
  kimberly: SessionMoveStats;
  dorian: SessionMoveStats;
};

const STORAGE_KEY = "sleep-token-chess-career";

const DEFAULT_CAREER: CareerStats = {
  wins: 0,
  losses: 0,
  draws: 0,
  gamesPlayed: 0,
  killerMoves: 0,
  goodMoves: 0,
  badMoves: 0,
  fuckUps: 0,
};

export class StatsTracker {
  session: SessionStats = {
    kimberly: emptyMoveStats(),
    dorian: emptyMoveStats(),
  };

  resetSession(): void {
    this.session = { kimberly: emptyMoveStats(), dorian: emptyMoveStats() };
  }

  recordMove(color: Color, quality: MoveQuality): void {
    const key = color === "w" ? "kimberly" : "dorian";
    this.session[key][quality] += 1;
  }

  loadCareer(player: PlayerId): CareerStats {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CAREER };
      const all = JSON.parse(raw) as Record<PlayerId, CareerStats>;
      return { ...DEFAULT_CAREER, ...all[player] };
    } catch {
      return { ...DEFAULT_CAREER };
    }
  }

  saveCareer(player: PlayerId, stats: CareerStats): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: Partial<Record<PlayerId, CareerStats>> = raw ? JSON.parse(raw) : {};
    all[player] = stats;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  finalizeGame(winner: Color | null): { kimberly: CareerStats; dorian: CareerStats } {
    const kCareer = this.loadCareer("kimberly");
    const dCareer = this.loadCareer("dorian");

    kCareer.gamesPlayed += 1;
    dCareer.gamesPlayed += 1;
    kCareer.killerMoves += this.session.kimberly.killer;
    kCareer.goodMoves += this.session.kimberly.good;
    kCareer.badMoves += this.session.kimberly.bad;
    kCareer.fuckUps += this.session.kimberly.fuckup;
    dCareer.killerMoves += this.session.dorian.killer;
    dCareer.goodMoves += this.session.dorian.good;
    dCareer.badMoves += this.session.dorian.bad;
    dCareer.fuckUps += this.session.dorian.fuckup;

    if (!winner) {
      kCareer.draws += 1;
      dCareer.draws += 1;
    } else if (winner === "w") {
      kCareer.wins += 1;
      dCareer.losses += 1;
    } else {
      dCareer.wins += 1;
      kCareer.losses += 1;
    }

    this.saveCareer("kimberly", kCareer);
    this.saveCareer("dorian", dCareer);
    return { kimberly: kCareer, dorian: dCareer };
  }
}