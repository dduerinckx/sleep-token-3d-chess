import "./style.css";
import { ChessEngine } from "./game/ChessEngine";
import { MultiplayerSession, type NetMessage, type PlayerColor } from "./game/Multiplayer";
import { analyzeMove, analyzeIllegalAttempt, type MoveQuality } from "./game/MoveAnalyzer";
import { StatsTracker, type CareerStats } from "./game/StatsTracker";
import type { SessionMoveStats } from "./game/MoveAnalyzer";
import { ChessScene, type MoveRequest } from "./three/ChessScene";
import { PLAYERS } from "./theme/players";
import { PROMOTION_LORE } from "./theme/pieceLore";
import type { Color, Square } from "chess.js";
import { AudioManager } from "./audio/AudioManager";

type PlayMode = "host" | "guest";

const engine = new ChessEngine();
const stats = new StatsTracker();
const audio = new AudioManager();
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const loading = document.getElementById("loading")!;
const scene = new ChessScene(canvas);
scene.bindEngine(engine);
scene.setReadyHandler(() => loading.classList.add("hidden"));

const lobby = document.getElementById("lobby")!;
const hud = document.getElementById("hud")!;
const promotionModal = document.getElementById("promotion-modal")!;
const statsModal = document.getElementById("stats-modal")!;
const lobbyStatus = document.getElementById("lobby-status")!;
const roomDisplay = document.getElementById("room-display")!;
const roomCodeEl = document.getElementById("room-code")!;
const turnLabel = document.getElementById("turn-label")!;
const statusLabel = document.getElementById("status-label")!;
const chipKimberly = document.getElementById("chip-kimberly")!;
const chipDorian = document.getElementById("chip-dorian")!;

let mode: PlayMode | null = null;
let playerColor: PlayerColor | null = null;
let pendingPromotion: { from: Square; to: Square } | null = null;
let gameFinalized = false;

const mp = new MultiplayerSession({
  onWaiting: (code) => {
    roomDisplay.classList.remove("hidden");
    roomCodeEl.textContent = code;
    setLobbyStatus("Chamber open — send the ritual code to Dorian.");
  },
  onConnected: (color) => {
    if (mp.role === "host") {
      startGame("host", color);
      mp.send({ type: "sync", fen: engine.fen });
    }
    setLobbyStatus("Dorian has entered the chamber.");
  },
  onDisconnected: () => {
    setStatus("The veil tore — connection lost.");
    scene.setInteraction(false);
  },
  onMessage: handleNetMessage,
  onError: (msg) => setLobbyStatus(msg),
});

function setLobbyStatus(text: string): void {
  lobbyStatus.textContent = text;
}

function setStatus(text: string): void {
  statusLabel.textContent = text;
}

async function renderCareerPreview(): Promise<void> {
  const [k, d] = await Promise.all([stats.loadCareerCloud("kimberly"), stats.loadCareerCloud("dorian")]);
  document.getElementById("career-kimberly")!.textContent = formatCareerLine(k);
  document.getElementById("career-dorian")!.textContent = formatCareerLine(d);
}

function formatCareerLine(c: CareerStats): string {
  return `${c.wins}W · ${c.losses}L · ${c.draws}D · ${c.killerMoves} killers`;
}

function formatGameStats(s: SessionMoveStats): string {
  return `
    <div class="stat-row killer"><span>Killer moves</span><strong>${s.killer}</strong></div>
    <div class="stat-row good"><span>Good moves</span><strong>${s.good}</strong></div>
    <div class="stat-row bad"><span>Bad moves</span><strong>${s.bad}</strong></div>
    <div class="stat-row fuckup"><span>Total fuck ups</span><strong>${s.fuckup}</strong></div>
  `;
}

function formatCareerStats(c: CareerStats): string {
  return `
    <div class="stat-row"><span>Record</span><strong>${c.wins}W / ${c.losses}L / ${c.draws}D</strong></div>
    <div class="stat-row"><span>Games</span><strong>${c.gamesPlayed}</strong></div>
    <div class="stat-row killer"><span>Killer moves</span><strong>${c.killerMoves}</strong></div>
    <div class="stat-row good"><span>Good moves</span><strong>${c.goodMoves}</strong></div>
    <div class="stat-row bad"><span>Bad moves</span><strong>${c.badMoves}</strong></div>
    <div class="stat-row fuckup"><span>Total fuck ups</span><strong>${c.fuckUps}</strong></div>
  `;
}

function updateHud(): void {
  const state = engine.getState();
  const active = state.turn === "w" ? PLAYERS.kimberly : PLAYERS.dorian;
  turnLabel.textContent = `${active.name}'s move`;

  chipKimberly.classList.toggle("active", state.turn === "w" && !state.isGameOver);
  chipDorian.classList.toggle("active", state.turn === "b" && !state.isGameOver);

  if (state.isCheckmate) {
    const winner = state.winner === "w" ? "Kimberly" : "Dorian";
    setStatus(`Checkmate — ${winner} ascends.`);
    void maybeEndGame();
  } else if (state.isStalemate) {
    setStatus("Stalemate — the void claims both.");
    void maybeEndGame();
  } else if (state.isDraw) {
    setStatus("Draw — balance in the ritual.");
    void maybeEndGame();
  } else if (state.isCheck) {
    setStatus("Check — the mask tightens.");
  } else {
    setStatus("");
  }

  const myTurn = mode && playerColor === state.turn;
  scene.setInteraction(!!myTurn && !state.isGameOver);
}

async function maybeEndGame(): Promise<void> {
  if (gameFinalized) return;
  const state = engine.getState();
  if (!state.isGameOver) return;
  gameFinalized = true;
  scene.setInteraction(false);

  const careers = await stats.finalizeGame(state.winner);
  const winnerText = state.winner
    ? `${state.winner === "w" ? "Kimberly" : "Dorian"} claims the ritual.`
    : "Neither soul ascends — a draw in the void.";

  document.getElementById("stats-winner")!.textContent = winnerText;
  document.getElementById("stats-kimberly-game")!.innerHTML = formatGameStats(stats.session.kimberly);
  document.getElementById("stats-dorian-game")!.innerHTML = formatGameStats(stats.session.dorian);
  document.getElementById("stats-kimberly-career")!.innerHTML = formatCareerStats(careers.kimberly);
  document.getElementById("stats-dorian-career")!.innerHTML = formatCareerStats(careers.dorian);
  statsModal.classList.remove("hidden");
  void renderCareerPreview();
}

function startGame(playMode: PlayMode, color: PlayerColor): void {
  mode = playMode;
  playerColor = color;
  gameFinalized = false;
  stats.resetSession();
  engine.reset();
  scene.bindEngine(engine);
  scene.setOrientation(color);
  lobby.classList.add("hidden");
  hud.classList.remove("hidden");
  statsModal.classList.add("hidden");
  updateHud();
}

function leaveGame(): void {
  mp.cleanup();
  mode = null;
  playerColor = null;
  gameFinalized = false;
  engine.reset();
  scene.bindEngine(engine);
  scene.setOrientation("w");
  hud.classList.add("hidden");
  statsModal.classList.add("hidden");
  lobby.classList.remove("hidden");
  roomDisplay.classList.add("hidden");
  setLobbyStatus("Kimberly hosts. Dorian joins with the ritual code.");
  renderCareerPreview();
}

function recordQualityForMove(color: Color, quality: MoveQuality): void {
  stats.recordMove(color, quality);
}

function applyMove(from: Square, to: Square, promotion = "q", broadcast = true, moverColor?: Color): boolean {
  const fenBefore = engine.getFenSnapshot();
  const movingColor = moverColor ?? engine.turn;
  if (mode && playerColor && movingColor !== playerColor && broadcast) return false;

  const move = engine.makeMove(from, to, promotion);
  if (!move) return false;

  const state = engine.getState();
  const quality = analyzeMove(fenBefore, move, state.isCheckmate, state.isCheck);
  recordQualityForMove(movingColor, quality);
  audio.playMove(!!move.captured);
  if (state.isCheck) audio.playCheck();

  scene.syncFromEngine(true);
  updateHud();

  if (broadcast && mode) {
    mp.send({ type: "move", from, to, promotion });
  }
  return true;
}

function handleMoveRequest(req: MoveRequest): void {
  if (req.needsPromotion) {
    pendingPromotion = { from: req.from, to: req.to };
    const side = engine.turn === "w" ? "white" : "black";
    document.getElementById("promo-context")!.textContent =
      engine.turn === "w" ? "Kimberly's devotee ascends…" : "Dorian's lost soul transforms…";
    promotionModal.querySelectorAll("[data-piece]").forEach((btn) => {
      const piece = btn.getAttribute("data-piece")!;
      const lore = PROMOTION_LORE[piece];
      const label = btn.querySelector(".promo-lore");
      if (label && lore) label.textContent = lore[side];
    });
    promotionModal.classList.remove("hidden");
    return;
  }
  applyMove(req.from, req.to);
}

function handleNetMessage(msg: NetMessage): void {
  if (msg.type === "sync" || msg.type === "rematch") {
    gameFinalized = false;
    stats.resetSession();
    engine.reset();
    scene.bindEngine(engine);
    statsModal.classList.add("hidden");
    updateHud();
    return;
  }

  if (msg.type === "move") {
    const fenBefore = engine.getFenSnapshot();
    const turnBefore = engine.turn;
    const move = engine.makeMove(msg.from as Square, msg.to as Square, msg.promotion ?? "q");
    if (move) {
      const state = engine.getState();
      const quality = analyzeMove(fenBefore, move, state.isCheckmate, state.isCheck);
      recordQualityForMove(turnBefore, quality);
      audio.playMove(!!move.captured);
      if (state.isCheck) audio.playCheck();
    }
    scene.syncFromEngine(true);
    updateHud();
  }
}

scene.setMoveHandler(handleMoveRequest);
scene.setBadAttemptHandler(() => {
  if (playerColor) recordQualityForMove(playerColor, analyzeIllegalAttempt());
});

document.getElementById("btn-host")!.addEventListener("click", async () => {
  audio.startAmbient();
  setLobbyStatus("Kimberly opens the summoning chamber…");
  try {
    await mp.host();
  } catch {
    setLobbyStatus("The chamber failed to open — try again.");
  }
});

document.getElementById("btn-join")!.addEventListener("click", async () => {
  audio.startAmbient();
  const code = (document.getElementById("join-code") as HTMLInputElement).value.trim().toUpperCase();
  if (!code) {
    setLobbyStatus("Dorian must enter a ritual code.");
    return;
  }
  setLobbyStatus("Dorian crosses the veil…");
  try {
    await mp.join(code);
    startGame("guest", "b");
  } catch {
    setLobbyStatus("Could not enter — verify the code with Kimberly.");
  }
});

document.getElementById("btn-copy")!.addEventListener("click", async () => {
  await navigator.clipboard.writeText(roomCodeEl.textContent ?? "");
  setLobbyStatus("Ritual code copied for Dorian.");
});

document.getElementById("btn-flip")!.addEventListener("click", () => scene.flipBoard());
document.getElementById("btn-leave")!.addEventListener("click", () => leaveGame());

document.getElementById("btn-rematch")!.addEventListener("click", () => {
  gameFinalized = false;
  stats.resetSession();
  engine.reset();
  scene.bindEngine(engine);
  statsModal.classList.add("hidden");
  if (mode) mp.send({ type: "rematch" });
  updateHud();
});

document.getElementById("btn-stats-close")!.addEventListener("click", () => leaveGame());

promotionModal.querySelectorAll("[data-piece]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!pendingPromotion) return;
    applyMove(pendingPromotion.from, pendingPromotion.to, btn.getAttribute("data-piece") ?? "q");
    pendingPromotion = null;
    promotionModal.classList.add("hidden");
  });
});

void renderCareerPreview();
updateHud();

const volumeSlider = document.getElementById("volume-slider") as HTMLInputElement;
const muteBtn = document.getElementById("btn-mute")!;

volumeSlider.addEventListener("input", () => {
  audio.setVolume(Number(volumeSlider.value) / 100);
});

muteBtn.addEventListener("click", () => {
  const next = !audio.isMuted();
  audio.setMuted(next);
  muteBtn.textContent = next ? "Unmute" : "Mute";
  if (!next) audio.startAmbient();
});