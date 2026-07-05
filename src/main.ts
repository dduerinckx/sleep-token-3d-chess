import "./style.css";
import { ChessEngine } from "./game/ChessEngine";
import { MultiplayerSession, type NetMessage, type PlayerColor } from "./game/Multiplayer";
import { ChessScene, type MoveRequest } from "./three/ChessScene";
import type { Color, Square } from "chess.js";

type PlayMode = "solo" | "host" | "guest";

const engine = new ChessEngine();
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const scene = new ChessScene(canvas);
scene.bindEngine(engine);

const lobby = document.getElementById("lobby")!;
const hud = document.getElementById("hud")!;
const promotionModal = document.getElementById("promotion-modal")!;
const lobbyStatus = document.getElementById("lobby-status")!;
const roomDisplay = document.getElementById("room-display")!;
const roomCodeEl = document.getElementById("room-code")!;
const turnLabel = document.getElementById("turn-label")!;
const statusLabel = document.getElementById("status-label")!;
const hudMode = document.getElementById("hud-mode")!;

let mode: PlayMode | null = null;
let playerColor: PlayerColor | "both" = "both";
let pendingPromotion: { from: Square; to: Square } | null = null;
let multiplayer: MultiplayerSession | null = null;

const mp = new MultiplayerSession({
  onWaiting: (code) => {
    roomDisplay.classList.remove("hidden");
    roomCodeEl.textContent = code;
    setLobbyStatus("Awaiting a soul to join the chamber…");
  },
  onConnected: (color) => {
    if (mp.role === "host") {
      startGame("host", color);
      mp.send({ type: "sync", fen: engine.fen });
    }
    setLobbyStatus("Opponent connected.");
  },
  onDisconnected: () => {
    setStatus("Connection lost.");
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

function updateHud(): void {
  const state = engine.getState();
  const turnName = state.turn === "w" ? "White" : "Black";
  turnLabel.textContent = `${turnName} to move`;

  if (state.isCheckmate) {
    const winner = state.winner === "w" ? "White" : "Black";
    setStatus(`Checkmate — ${winner} ascends.`);
  } else if (state.isStalemate) {
    setStatus("Stalemate — the void claims both.");
  } else if (state.isDraw) {
    setStatus("Draw — balance in the ritual.");
  } else if (state.isCheck) {
    setStatus("Check.");
  } else {
    setStatus("");
  }

  const myTurn =
    mode === "solo" ||
    (mode === "host" && state.turn === playerColor) ||
    (mode === "guest" && state.turn === playerColor);
  scene.setInteraction(myTurn && !state.isGameOver);
}

function canMoveColor(color: Color): boolean {
  if (mode === "solo") return true;
  return color === playerColor;
}

function startGame(playMode: PlayMode, color: PlayerColor | "both" = "both"): void {
  mode = playMode;
  playerColor = color;
  engine.reset();
  scene.bindEngine(engine);
  scene.setOrientation(color === "b" ? "b" : "w");
  lobby.classList.add("hidden");
  hud.classList.remove("hidden");
  hudMode.textContent =
    playMode === "solo" ? "Solo" : playMode === "host" ? "Host · White" : "Guest · Black";
  updateHud();
}

function leaveGame(): void {
  multiplayer?.cleanup();
  multiplayer = null;
  mp.cleanup();
  mode = null;
  playerColor = "both";
  engine.reset();
  scene.bindEngine(engine);
  scene.setOrientation("w");
  hud.classList.add("hidden");
  lobby.classList.remove("hidden");
  roomDisplay.classList.add("hidden");
  setLobbyStatus("Choose your path.");
}

function applyMove(from: Square, to: Square, promotion = "q", broadcast = true): boolean {
  if (!canMoveColor(engine.turn)) return false;
  const move = engine.makeMove(from, to, promotion);
  if (!move) return false;

  scene.syncFromEngine();
  updateHud();

  if (broadcast && mode !== "solo") {
    mp.send({ type: "move", from, to, promotion });
  }
  return true;
}

function handleMoveRequest(req: MoveRequest): void {
  if (req.needsPromotion) {
    pendingPromotion = { from: req.from, to: req.to };
    promotionModal.classList.remove("hidden");
    return;
  }
  applyMove(req.from, req.to);
}

function handleNetMessage(msg: NetMessage): void {
  if (msg.type === "sync") {
    engine.loadFen(msg.fen);
    scene.syncFromEngine();
    updateHud();
    return;
  }

  if (msg.type === "move") {
    engine.makeMove(msg.from as Square, msg.to as Square, msg.promotion ?? "q");
    scene.syncFromEngine();
    updateHud();
  }
}

scene.setMoveHandler(handleMoveRequest);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    const id = tab.getAttribute("data-tab");
    document.getElementById(`tab-${id}`)?.classList.add("active");
  });
});

document.getElementById("btn-host")!.addEventListener("click", async () => {
  setLobbyStatus("Opening a chamber…");
  try {
    multiplayer = mp;
    await mp.host();
  } catch {
    setLobbyStatus("Failed to create game.");
  }
});

document.getElementById("btn-join")!.addEventListener("click", async () => {
  const code = (document.getElementById("join-code") as HTMLInputElement).value.trim().toUpperCase();
  if (!code) {
    setLobbyStatus("Enter a ritual code.");
    return;
  }
  setLobbyStatus("Crossing the veil…");
  try {
    multiplayer = mp;
    await mp.join(code);
    startGame("guest", "b");
  } catch {
    setLobbyStatus("Could not join — check the code and try again.");
  }
});

document.getElementById("btn-copy")!.addEventListener("click", async () => {
  const code = roomCodeEl.textContent ?? "";
  await navigator.clipboard.writeText(code);
  setLobbyStatus("Ritual code copied.");
});

document.getElementById("btn-solo")!.addEventListener("click", () => startGame("solo"));

document.getElementById("btn-flip")!.addEventListener("click", () => scene.flipBoard());
document.getElementById("btn-leave")!.addEventListener("click", () => leaveGame());

promotionModal.querySelectorAll("[data-piece]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!pendingPromotion) return;
    const piece = btn.getAttribute("data-piece") ?? "q";
    applyMove(pendingPromotion.from, pendingPromotion.to, piece);
    pendingPromotion = null;
    promotionModal.classList.add("hidden");
  });
});

updateHud();