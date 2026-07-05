import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Color, Square } from "chess.js";
import type { ChessEngine } from "../game/ChessEngine";
import { createLocalChessAssets, type LoadedChessAssets } from "./ChessModelLoader";
import { SleepTokenEnvironment } from "./Environment";
import { createSleepTokenBoardTexture } from "../theme/textures";

const BOARD_SIZE = 8;
const SQUARE_SIZE = 1;
const PIECE_Y = 0.1;
const CLICK_THRESHOLD = 8;

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
  private assets: LoadedChessAssets | null = null;
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
  private onReady: (() => void) | null = null;
  private canInteract = true;
  private engine: ChessEngine | null = null;
  private pointerDown = { x: 0, y: 0, active: false, ctrl: false };
  private orbitActive = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    this.camera.position.set(5.5, 6.8, 7.5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enabled = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.target.set(0, 0.2, 0);

    this.environment = new SleepTokenEnvironment(this.scene);
    this.scene.add(this.boardGroup, this.piecesGroup, this.highlightsGroup);
    this.buildLights();

    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.onResize();
    this.animate();
    this.initAssets();
  }

  setReadyHandler(handler: () => void): void {
    this.onReady = handler;
  }

  private initAssets(): void {
    this.assets = createLocalChessAssets();
    this.buildBoard();
    if (this.engine) this.syncPieces(false);
    this.onReady?.();
  }

  bindEngine(engine: ChessEngine): void {
    this.engine = engine;
    if (this.assets) this.syncPieces(false);
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
    if (!this.assets) return;
    this.syncPieces(animate);
    const last = this.engine?.getLastMove();
    if (last) this.pulseSquare(last.to);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.controls.dispose();
    this.renderer.dispose();
  }

  private buildLights(): void {
    const ambient = new THREE.AmbientLight(0xfff0d8, 0.5);
    const key = new THREE.DirectionalLight(0xffe8c0, 1.4);
    key.position.set(6, 12, 8);
    key.castShadow = true;
    const rim = new THREE.PointLight(0x9b6fd0, 1.6, 28);
    rim.position.set(-5, 4, -4);
    const gold = new THREE.PointLight(0xc9a962, 1.1, 22);
    gold.position.set(4, 3, 5);
    this.scene.add(ambient, key, rim, gold);
  }

  private buildBoard(): void {
    if (!this.assets) return;

    const lightTex = createSleepTokenBoardTexture(true);
    const darkTex = createSleepTokenBoardTexture(false);
    const lightMat = new THREE.MeshStandardMaterial({ map: lightTex, metalness: 0.15, roughness: 0.55 });
    const darkMat = new THREE.MeshStandardMaterial({ map: darkTex, metalness: 0.18, roughness: 0.6 });

    if (this.assets.boardMesh) {
      const boardClone = this.assets.boardMesh.clone(true);
      boardClone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.receiveShadow = true;
          child.material = new THREE.MeshStandardMaterial({
            color: 0xd4b87a,
            metalness: 0.35,
            roughness: 0.4,
          });
        }
      });
      const box = new THREE.Box3().setFromObject(boardClone);
      const size = box.getSize(new THREE.Vector3());
      const scale = 8.2 / Math.max(size.x, size.z);
      boardClone.scale.multiplyScalar(scale);
      boardClone.position.y = -0.02;
      this.boardGroup.add(boardClone);
    }

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_SIZE + 0.7, 0.22, BOARD_SIZE + 0.7),
      new THREE.MeshStandardMaterial({ color: 0xc9a962, metalness: 0.65, roughness: 0.3 })
    );
    frame.position.y = -0.1;
    frame.receiveShadow = true;
    this.boardGroup.add(frame);

    for (let file = 0; file < BOARD_SIZE; file++) {
      for (let rank = 0; rank < BOARD_SIZE; rank++) {
        const isLight = (file + rank) % 2 === 0;
        const square = this.coordsToSquare(file, rank);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(SQUARE_SIZE * 0.98, 0.08, SQUARE_SIZE * 0.98),
          isLight ? lightMat : darkMat
        );
        const { x, z } = this.squareToWorld(square);
        mesh.position.set(x, 0.06, z);
        mesh.receiveShadow = true;
        mesh.userData.square = square;
        this.squareMeshes.set(square, mesh);
        this.boardGroup.add(mesh);
      }
    }
  }

  private clearAllPieces(): void {
    for (const piece of this.pieces.values()) {
      this.piecesGroup.remove(piece.mesh);
    }
    this.pieces.clear();
  }

  private syncPieces(animate: boolean): void {
    if (!this.engine || !this.assets) return;

    const board = this.parseBoard(this.engine.fen);

    if (!animate) {
      this.clearAllPieces();
      for (const [square, data] of board) {
        const mesh = this.assets.createPiece(data.type, data.color);
        mesh.userData.square = square;
        const { x, z } = this.squareToWorld(square);
        mesh.position.set(x, PIECE_Y, z);
        this.piecesGroup.add(mesh);
        this.pieces.set(square, { mesh, square, color: data.color, type: data.type });
      }
      return;
    }

    const lastMove = this.engine.getLastMove();
    const moveFrom = lastMove?.from as Square | undefined;
    const moveTo = lastMove?.to as Square | undefined;
    const nextPieces = new Map<Square, PieceMesh>();

    for (const [square, data] of board) {
      const existing = this.pieces.get(square);
      if (existing && existing.color === data.color && existing.type === data.type) {
        nextPieces.set(square, existing);
        continue;
      }

      let mesh: THREE.Group | null = null;
      let reused = false;

      if (square === moveTo && moveFrom && !lastMove?.promotion) {
        const fromPiece = this.pieces.get(moveFrom);
        if (fromPiece) {
          mesh = fromPiece.mesh;
          reused = true;
          mesh.userData.square = square;
        }
      }

      if (!mesh) {
        mesh = this.assets.createPiece(data.type, data.color);
        mesh.userData.square = square;
        this.piecesGroup.add(mesh);
      }

      const { x, z } = this.squareToWorld(square);
      if (reused) this.tweenTo(mesh, x, z);
      else mesh.position.set(x, PIECE_Y, z);

      nextPieces.set(square, { mesh, square, color: data.color, type: data.type });
    }

    const activeMeshes = new Set([...nextPieces.values()].map((p) => p.mesh));
    for (const piece of this.pieces.values()) {
      if (!activeMeshes.has(piece.mesh)) {
        this.piecesGroup.remove(piece.mesh);
      }
    }

    this.pieces = nextPieces;
  }

  private tweenTo(mesh: THREE.Group, x: number, z: number): void {
    const start = { px: mesh.position.x, pz: mesh.position.z };
    const startTime = performance.now();
    const duration = 280;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      mesh.position.x = start.px + (x - start.px) * ease;
      mesh.position.z = start.pz + (z - start.pz) * ease;
      mesh.position.y = Math.sin(t * Math.PI) * 0.28;
      if (t < 1) requestAnimationFrame(step);
      else mesh.position.set(x, PIECE_Y, z);
    };
    requestAnimationFrame(step);
  }

  private parseBoard(fen: string): Map<Square, { type: string; color: Color }> {
    const map = new Map<Square, { type: string; color: Color }>();
    fen.split(" ")[0].split("/").forEach((rankStr, rankIdx) => {
      let file = 0;
      for (const ch of rankStr) {
        if (/\d/.test(ch)) file += Number(ch);
        else {
          map.set(`${String.fromCharCode(97 + file)}${8 - rankIdx}` as Square, {
            type: ch.toLowerCase(),
            color: ch === ch.toUpperCase() ? "w" : "b",
          });
          file += 1;
        }
      }
    });
    return map;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Control") this.controls.enabled = this.orbitActive;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === "Control") this.controls.enabled = false;
  };

  private onResize = (): void => {
    const { clientWidth, clientHeight } = this.canvas;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDown = { x: e.clientX, y: e.clientY, active: true, ctrl: e.ctrlKey };
    if (e.ctrlKey) {
      this.orbitActive = true;
      this.controls.enabled = true;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown.active) return;
    if (e.ctrlKey && !this.controls.enabled) {
      this.controls.enabled = true;
      this.orbitActive = true;
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const wasCtrl = this.pointerDown.ctrl || e.ctrlKey;
    const dx = e.clientX - this.pointerDown.x;
    const dy = e.clientY - this.pointerDown.y;
    const dragged = Math.hypot(dx, dy) > CLICK_THRESHOLD;

    this.pointerDown.active = false;
    this.orbitActive = false;
    this.controls.enabled = false;

    if (!wasCtrl && !dragged) this.handleClick(e);
  };

  private handleClick(event: PointerEvent): void {
    if (!this.canInteract || !this.engine || !this.onMoveRequest || !this.assets) return;

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

  private clearHighlightMeshes(): void {
    while (this.highlightsGroup.children.length > 0) {
      this.highlightsGroup.remove(this.highlightsGroup.children[0]);
    }
  }

  private clearSelection(): void {
    this.selected = null;
    this.clearHighlightMeshes();
  }

  private renderHighlights(square: Square): void {
    this.clearHighlightMeshes();
    if (!this.engine) return;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.46, 40),
      new THREE.MeshBasicMaterial({ color: 0xc9a962, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    const { x, z } = this.squareToWorld(square);
    ring.position.set(x, 0.18, z);
    this.highlightsGroup.add(ring);

    for (const move of this.engine.getLegalMoves(square)) {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.16, 24),
        new THREE.MeshBasicMaterial({ color: 0x6b3fa0, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      dot.rotation.x = -Math.PI / 2;
      const pos = this.squareToWorld(move.to as Square);
      dot.position.set(pos.x, 0.17, pos.z);
      this.highlightsGroup.add(dot);
    }
  }

  private pulseSquare(square: Square): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.52, 48),
      new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    const { x, z } = this.squareToWorld(square);
    ring.position.set(x, 0.19, z);
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
    if (this.controls.enabled) this.controls.update();
    this.environment.update(performance.now() * 0.001);
    this.renderer.render(this.scene, this.camera);
  };
}