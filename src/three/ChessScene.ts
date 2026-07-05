import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Color, Square } from "chess.js";
import type { ChessEngine } from "../game/ChessEngine";
import { createCharacterPiece } from "./PieceFactory";
import { SleepTokenEnvironment } from "./Environment";

const BOARD_SIZE = 8;
const SQUARE_SIZE = 1;
const CLICK_THRESHOLD = 6;

type PieceMesh = {
  mesh: THREE.Group;
  square: Square;
  color: Color;
  type: string;
};

export type MoveRequest = {
  from: Square;
  to: Square;
  needsPromotion: boolean;
};

export class ChessScene {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private environment: SleepTokenEnvironment;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private boardGroup = new THREE.Group();
  private piecesGroup = new THREE.Group();
  private highlightsGroup = new THREE.Group();
  private squareMeshes = new Map<Square, THREE.Mesh>();
  private pieces = new Map<Square, PieceMesh>();
  private selected: Square | null = null;
  private orientation: Color = "w";
  private animationId = 0;
  private onMoveRequest: ((req: MoveRequest) => void) | null = null;
  private onBadAttempt: (() => void) | null = null;
  private canInteract = true;
  private engine: ChessEngine | null = null;
  private pointerDown = { x: 0, y: 0, active: false };
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    this.camera.position.set(5.5, 6.8, 7.5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 0.2, 0);

    this.environment = new SleepTokenEnvironment(this.scene);
    this.scene.add(this.boardGroup, this.piecesGroup, this.highlightsGroup);
    this.buildLights();
    this.buildBoard();
    this.buildPedestal();

    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);

    this.onResize();
    this.animate();
  }

  bindEngine(engine: ChessEngine): void {
    this.engine = engine;
    this.syncPieces(false);
  }

  setMoveHandler(handler: (req: MoveRequest) => void): void {
    this.onMoveRequest = handler;
  }

  setBadAttemptHandler(handler: () => void): void {
    this.onBadAttempt = handler;
  }

  setInteraction(enabled: boolean): void {
    this.canInteract = enabled;
    if (!enabled) this.clearSelection();
  }

  setOrientation(color: Color): void {
    this.orientation = color;
    const rot = color === "w" ? 0 : Math.PI;
    this.boardGroup.rotation.y = rot;
    this.piecesGroup.rotation.y = rot;
    this.highlightsGroup.rotation.y = rot;
  }

  flipBoard(): void {
    this.setOrientation(this.orientation === "w" ? "b" : "w");
  }

  syncFromEngine(animate = true): void {
    this.syncPieces(animate);
    const last = this.engine?.getLastMove();
    if (last) this.pulseSquare(last.to);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.controls.dispose();
    this.renderer.dispose();
  }

  private buildLights(): void {
    const ambient = new THREE.AmbientLight(0xfff0d8, 0.45);
    const key = new THREE.DirectionalLight(0xffe8c0, 1.35);
    key.position.set(6, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);

    const rim = new THREE.PointLight(0x9b6fd0, 1.8, 28);
    rim.position.set(-5, 4, -4);

    const gold = new THREE.PointLight(0xc9a962, 1.2, 22);
    gold.position.set(4, 3, 5);

    const fill = new THREE.DirectionalLight(0x6b3fa0, 0.35);
    fill.position.set(-4, 2, 6);

    this.scene.add(ambient, key, rim, gold, fill);
  }

  private buildPedestal(): void {
    const marble = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, metalness: 0.15, roughness: 0.55 });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 6, 0.4, 64), marble);
    pedestal.position.y = -0.22;
    pedestal.receiveShadow = true;
    this.boardGroup.add(pedestal);

    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.06, 12, 64),
      new THREE.MeshStandardMaterial({ color: 0xc9a962, metalness: 0.75, roughness: 0.25 })
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -0.02;
    this.boardGroup.add(trim);
  }

  private buildBoard(): void {
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, metalness: 0.08, roughness: 0.62 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0xa88868, metalness: 0.12, roughness: 0.68 });
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_SIZE + 0.6, 0.28, BOARD_SIZE + 0.6),
      new THREE.MeshStandardMaterial({ color: 0xd4b87a, metalness: 0.55, roughness: 0.35 })
    );
    frame.position.y = -0.06;
    frame.receiveShadow = true;
    this.boardGroup.add(frame);

    for (let file = 0; file < BOARD_SIZE; file++) {
      for (let rank = 0; rank < BOARD_SIZE; rank++) {
        const isLight = (file + rank) % 2 === 0;
        const square = this.coordsToSquare(file, rank);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(SQUARE_SIZE * 0.97, 0.14, SQUARE_SIZE * 0.97),
          isLight ? lightMat : darkMat
        );
        const { x, z } = this.squareToWorld(square);
        mesh.position.set(x, 0.04, z);
        mesh.receiveShadow = true;
        mesh.userData.square = square;
        this.squareMeshes.set(square, mesh);
        this.boardGroup.add(mesh);
      }
    }
  }

  private syncPieces(animate: boolean): void {
    if (!this.engine) return;

    const board = this.parseBoard(this.engine.fen);
    const lastMove = animate ? this.engine.getLastMove() : null;
    const moveFrom = lastMove?.from as Square | undefined;
    const moveTo = lastMove?.to as Square | undefined;
    const nextPieces = new Map<Square, PieceMesh>();
    const seen = new Set<Square>();

    for (const [square, data] of board) {
      seen.add(square);
      const kept = this.pieces.get(square);
      if (kept && kept.color === data.color && kept.type === data.type) {
        nextPieces.set(square, kept);
        continue;
      }

      let mesh: THREE.Group;
      let reused = false;

      if (square === moveTo && moveFrom && this.pieces.has(moveFrom) && !lastMove?.promotion) {
        const moving = this.pieces.get(moveFrom)!;
        mesh = moving.mesh;
        reused = true;
        moving.square = square;
        moving.color = data.color;
        moving.type = data.type;
        mesh.userData.square = square;
      } else {
        if (square === moveTo && moveFrom && this.pieces.has(moveFrom)) {
          this.piecesGroup.remove(this.pieces.get(moveFrom)!.mesh);
          this.pieces.delete(moveFrom);
        }
        mesh = createCharacterPiece(data.type, data.color);
        mesh.userData.square = square;
        this.piecesGroup.add(mesh);
      }

      const { x, z } = this.squareToWorld(square);
      if (reused && animate) this.tweenTo(mesh, x, z);
      else mesh.position.set(x, 0, z);

      nextPieces.set(square, { mesh, square, color: data.color, type: data.type });
    }

    for (const [square, piece] of this.pieces) {
      if (!seen.has(square) && !nextPieces.has(square)) {
        this.piecesGroup.remove(piece.mesh);
      }
    }

    this.pieces = nextPieces;
  }

  private tweenTo(mesh: THREE.Group, x: number, z: number): void {
    const start = { px: mesh.position.x, pz: mesh.position.z, py: mesh.position.y };
    const startTime = performance.now();
    const duration = 320;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      mesh.position.x = start.px + (x - start.px) * ease;
      mesh.position.z = start.pz + (z - start.pz) * ease;
      mesh.position.y = Math.sin(t * Math.PI) * 0.35;
      if (t < 1) requestAnimationFrame(step);
      else mesh.position.set(x, 0, z);
    };
    requestAnimationFrame(step);
  }

  private parseBoard(fen: string): Map<Square, { type: string; color: Color }> {
    const map = new Map<Square, { type: string; color: Color }>();
    const placement = fen.split(" ")[0];
    const ranks = placement.split("/");
    ranks.forEach((rankStr, rankIdx) => {
      let file = 0;
      for (const ch of rankStr) {
        if (/\d/.test(ch)) file += Number(ch);
        else {
          const square = `${String.fromCharCode(97 + file)}${8 - rankIdx}` as Square;
          map.set(square, { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? "w" : "b" });
          file += 1;
        }
      }
    });
    return map;
  }

  private onResize = (): void => {
    const { clientWidth, clientHeight } = this.canvas;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  };

  private onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY, active: true };
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerDown.active) return;
    this.pointerDown.active = false;
    const dx = event.clientX - this.pointerDown.x;
    const dy = event.clientY - this.pointerDown.y;
    if (Math.hypot(dx, dy) > CLICK_THRESHOLD) return;
    this.handleClick(event);
  };

  private handleClick(event: PointerEvent): void {
    if (!this.canInteract || !this.engine || !this.onMoveRequest) return;

    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const pieceMeshes = [...this.pieces.values()].map((p) => p.mesh);
    const hits = this.raycaster.intersectObjects([...this.squareMeshes.values(), ...pieceMeshes], true);
    if (!hits.length) return;

    let square: Square | undefined;
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (obj.userData.square) {
          square = obj.userData.square as Square;
          break;
        }
        obj = obj.parent;
      }
      if (square) break;
    }
    if (!square) return;

    const piece = this.pieces.get(square);
    const turn = this.engine.turn;

    if (!this.selected) {
      if (piece && piece.color === turn) this.selectSquare(square);
      return;
    }

    if (square === this.selected) {
      this.clearSelection();
      return;
    }

    if (piece && piece.color === turn) {
      this.selectSquare(square);
      return;
    }

    const legal = this.engine.getLegalMoves(this.selected);
    const targetMove = legal.find((m) => m.to === square);
    if (!targetMove) {
      this.onBadAttempt?.();
      this.clearSelection();
      return;
    }

    this.onMoveRequest({ from: this.selected, to: square, needsPromotion: targetMove.promotion !== undefined });
    this.clearSelection();
  }

  private selectSquare(square: Square): void {
    this.selected = square;
    this.renderHighlights(square);
  }

  private clearSelection(): void {
    this.selected = null;
    this.highlightsGroup.clear();
  }

  private renderHighlights(square: Square): void {
    this.highlightsGroup.clear();
    if (!this.engine) return;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.44, 40),
      new THREE.MeshBasicMaterial({ color: 0xc9a962, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    const { x, z } = this.squareToWorld(square);
    ring.position.set(x, 0.16, z);
    this.highlightsGroup.add(ring);

    for (const move of this.engine.getLegalMoves(square)) {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 24),
        new THREE.MeshBasicMaterial({ color: 0x6b3fa0, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
      );
      dot.rotation.x = -Math.PI / 2;
      const pos = this.squareToWorld(move.to as Square);
      dot.position.set(pos.x, 0.15, pos.z);
      this.highlightsGroup.add(dot);
    }
  }

  private pulseSquare(square: Square): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.5, 48),
      new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    const { x, z } = this.squareToWorld(square);
    ring.position.set(x, 0.17, z);
    this.highlightsGroup.add(ring);
    const start = performance.now();
    const fade = (time: number) => {
      const t = (time - start) / 900;
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
      ring.scale.setScalar(1 + t * 0.4);
      if (t < 1) requestAnimationFrame(fade);
      else this.highlightsGroup.remove(ring);
    };
    requestAnimationFrame(fade);
  }

  private squareToWorld(square: Square): { x: number; z: number } {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const offset = (BOARD_SIZE * SQUARE_SIZE) / 2 - SQUARE_SIZE / 2;
    return { x: file * SQUARE_SIZE - offset, z: rank * SQUARE_SIZE - offset };
  }

  private coordsToSquare(file: number, rank: number): Square {
    return `${String.fromCharCode(97 + file)}${rank + 1}` as Square;
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const t = performance.now() * 0.001;
    this.controls.update();
    this.environment.update(t);
    this.renderer.render(this.scene, this.camera);
  };
}