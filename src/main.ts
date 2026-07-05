import "./style.css";
import { ChessEngine } from "./game/ChessEngine";
import { MultiplayerSession, type NetMessage, type PlayerColor } from "./game/Multiplayer";
import { analyzeMove, analyzeIllegalAttempt, type MoveQuality } from "./game/MoveAnalyzer";
import { StatsTracker, type CareerStats } from "./game/StatsTracker";
import type { SessionMoveStats } from "./game/MoveAnalyzer";
import { pickComputerMove } from "./game/ChessAI";
import { ChessScene, type MoveRequest } from "./three/ChessScene";
import { PLAYERS } from "./theme/players";
import { PROMOTION_LORE } from "./theme/pieceLore";
import type { Color, Square } from "chess.js";
import { AudioManager } from "./audio/AudioManager";

type PlayMode = "host" | "guest" | "solo";

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
const rematchBtn = document.getElementById("btn-rematch")!;
const rematchWait = document.getElementById("rematch-wait")!;

let mode: PlayMode | null = null;
let playerColor: PlayerColor | null = null;
let pendingPromotion: { from: Square; to: Square } | null = null;
let gameFinalized = false;
let computerThinking = false;

const mp = new MultiplayerSession({
  onWaiting: (code) => {
    roomDisplay.classList.remove("hidden");
    roomCodeEl.textContent = code;
    setLobbyStatus("Chamber open — send the ritual code to Kimberly.");
  },
  onConnected: (color) => {
    if (mp.role === "host") {
      startGame("host", color);
      mp.send({ type: "sync", fen: engine.fen });
    }
    setLobbyStatus("Kimberly has entered the chamber.");
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

function isDorianInitiator(): boolean {
  return mode === "host" || mode === "solo";
}

function updateRematchUI(): void {
  if (mode === "solo") {
    rematchBtn.textContent = "Play Again";
    rematchBtn.classList.remove("hidden");
    rematchWait.classList.add("hidden");
    return;
  }
  if (mode === "host") {
    rematchBtn.textContent = "New Game (Dorian)";
    rematchBtn.classList.remove("hidden");
    rematchWait.classList.add("hidden");
    return;
  }
  rematchBtn.classList.add("hidden");
  rematchWait.classList.toggle("hidden", mode !== "guest");
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
  const vsComputer = mode === "solo" ? " · vs Ritual Engine" : "";
  turnLabel.textContent = `${active.name}'s move${vsComputer}`;

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

  const myTurn =
    mode === "solo" ? playerColor === state.turn : mode !== null && playerColor === state.turn;
  scene.setInteraction(!!myTurn && !state.isGameOver && !computerThinking);
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
  updateRematchUI();
  void renderCareerPreview();
}

function startGame(playMode: PlayMode, color: PlayerColor): void {
  mode = playMode;
  playerColor = color;
  gameFinalized = false;
  computerThinking = false;
  stats.resetSession();
  engine.reset();
  scene.bindEngine(engine);
  scene.setOrientation(color);
  lobby.classList.add("hidden");
  hud.classList.remove("hidden");
  statsModal.classList.add("hidden");
  updateHud();
  if (playMode === "solo" && color === "b") maybeComputerMove();
}

function leaveGame(): void {
  mp.cleanup();
  mode = null;
  playerColor = null;
  gameFinalized = false;
  computerThinking = false;
  engine.reset();
  scene.bindEngine(engine);
  scene.setOrientation("w");
  hud.classList.add("hidden");
  statsModal.classList.add("hidden");
  lobby.classList.remove("hidden");
  roomDisplay.classList.add("hidden");
  setLobbyStatus("Dorian initiates. Kimberly joins with the ritual code.");
  void renderCareerPreview();
}

function recordQualityForMove(color: Color, quality: MoveQuality): void {
  stats.recordMove(color, quality);
}

function applyMove(
  from: Square,
  to: Square,
  promotion = "q",
  broadcast = true,
  moverColor?: Color
): boolean {
  const fenBefore = engine.getFenSnapshot();
  const movingColor = moverColor ?? engine.turn;

  if (mode === "host" || mode === "guest") {
    if (playerColor && movingColor !== playerColor && broadcast) return false;
  }

  const move = engine.makeMove(from, to, promotion);
  if (!move) return false;

  const state = engine.getState();
  const quality = analyzeMove(fenBefore, move, state.isCheckmate, state.isCheck);
  recordQualityForMove(movingColor, quality);
  audio.playMove(!!move.captured);
  if (state.isCheck) audio.playCheck();

  scene.syncFromEngine(true);
  updateHud();

  if (broadcast && (mode === "host" || mode === "guest")) {
    mp.send({ type: "move", from, to, promotion });
  }

  if (mode === "solo" && !state.isGameOver) maybeComputerMove();
  return true;
}

function maybeComputerMove(): void {
  if (mode !== "solo" || gameFinalized || computerThinking) return;
  if (engine.turn === playerColor) return;

  const pick = pickComputerMove(engine.fen);
  if (!pick) return;

  computerThinking = true;
  scene.setInteraction(false);

  window.setTimeout(() => {
    computerThinking = false;
    if (mode !== "solo" || gameFinalized) return;
    applyMove(pick.from, pick.to, pick.promotion ?? "q", false);
  }, 500);
}

function handleMoveRequest(req: MoveRequest): void {
  if (mode !== "solo" && playerColor !== engine.turn) return;

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
    if (msg.type === "rematch" && mode === "guest") setStatus("Dorian has begun a new ritual.");
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
  if (playerColor && (mode === "solo" || engine.turn === playerColor)) {
    recordQualityForMove(playerColor, analyzeIllegalAttempt());
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.getAttribute("data-tab")}`)?.classList.add("active");
  });
});

document.getElementById("btn-host")!.addEventListener("click", async () => {
  audio.startAmbient();
  setLobbyStatus("Dorian opens the summoning chamber…");
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
    setLobbyStatus("Kimberly must enter Dorian's ritual code.");
    return;
  }
  setLobbyStatus("Kimberly crosses the veil…");
  try {
    await mp.join(code);
    startGame("guest", "w");
  } catch {
    setLobbyStatus("Could not enter — verify the code with Dorian.");
  }
});

document.getElementById("btn-solo-kimberly")!.addEventListener("click", () => {
  audio.startAmbient();
  startGame("solo", "w");
});

document.getElementById("btn-solo-dorian")!.addEventListener("click", () => {
  audio.startAmbient();
  startGame("solo", "b");
});

document.getElementById("btn-copy")!.addEventListener("click", async () => {
  await navigator.clipboard.writeText(roomCodeEl.textContent ?? "");
  setLobbyStatus("Ritual code copied for Kimberly.");
});

document.getElementById("btn-flip")!.addEventListener("click", () => scene.flipBoard());
document.getElementById("btn-leave")!.addEventListener("click", () => leaveGame());

rematchBtn.addEventListener("click", () => {
  if (!isDorianInitiator()) return;
  gameFinalized = false;
  stats.resetSession();
  engine.reset();
  scene.bindEngine(engine);
  statsModal.classList.add("hidden");
  if (mode === "host") mp.send({ type: "rematch" });
  updateHud();
  if (mode === "solo" && playerColor === "b") maybeComputerMove();
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