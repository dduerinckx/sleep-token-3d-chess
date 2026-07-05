import * as THREE from "three";
import type { Color, Square } from "chess.js";
import type { ChessEngine } from "../game/ChessEngine";

const BOARD_SIZE = 8;
const SQUARE_SIZE = 1;
const PIECE_HEIGHT = 0.35;

const PIECE_SHAPES: Record<string, (_color: Color, material: THREE.Material) => THREE.Group> = {
  p: (_color, mat) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.18, 24), mat);
    base.position.y = 0.09;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), mat);
    body.position.y = 0.34;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), mat);
    top.position.y = 0.52;
    g.add(base, body, top);
    return g;
  },
  r: (_color, mat) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.2, 24), mat);
    base.position.y = 0.1;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.42, 24), mat);
    body.position.y = 0.41;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), mat);
    crown.position.y = 0.74;
    g.add(base, body, crown);
    return g;
  },
  n: (_color, mat) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.2, 24), mat);
    base.position.y = 0.1;
    const neck = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 20), mat);
    neck.position.set(0.04, 0.48, 0);
    neck.rotation.z = -0.35;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat);
    head.position.set(0.14, 0.68, 0.04);
    g.add(base, neck, head);
    return g;
  },
  b: (_color, mat) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.2, 24), mat);
    base.position.y = 0.1;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 24), mat);
    body.position.y = 0.48;
    const mitre = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), mat);
    mitre.position.y = 0.82;
    g.add(base, body, mitre);
    return g;
  },
  q: (_color, mat) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.22, 28), mat);
    base.position.y = 0.11;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.5, 28), mat);
    body.position.y = 0.47;
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 10, 24), mat);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 0.8;
    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), mat);
    jewel.position.y = 0.92;
    g.add(base, body, crown, jewel);
    return g;
  },
  k: (_color, mat) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.22, 28), mat);
    base.position.y = 0.11;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.48, 28), mat);
    body.position.y = 0.46;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), mat);
    crossV.position.y = 0.86;
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), mat);
    crossH.position.y = 0.9;
    g.add(base, body, crossV, crossH);
    return g;
  },
};

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
  private canInteract = true;
  private engine: ChessEngine | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06040c, 0.045);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 7.5, 7.2);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(this.boardGroup, this.piecesGroup, this.highlightsGroup);
    this.buildLights();
    this.buildBoard();
    this.buildPedestal();

    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("pointerdown", this.onPointerDown);

    this.onResize();
    this.animate();
  }

  bindEngine(engine: ChessEngine): void {
    this.engine = engine;
    this.syncPieces();
  }

  setMoveHandler(handler: (req: MoveRequest) => void): void {
    this.onMoveRequest = handler;
  }

  setInteraction(enabled: boolean): void {
    this.canInteract = enabled;
    if (!enabled) this.clearSelection();
  }

  setOrientation(color: Color): void {
    this.orientation = color;
    this.boardGroup.rotation.y = color === "w" ? 0 : Math.PI;
    this.piecesGroup.rotation.y = color === "w" ? 0 : Math.PI;
    this.highlightsGroup.rotation.y = color === "w" ? 0 : Math.PI;
  }

  flipBoard(): void {
    this.setOrientation(this.orientation === "w" ? "b" : "w");
  }

  syncFromEngine(): void {
    this.syncPieces();
    const last = this.engine?.getLastMove();
    if (last) this.pulseSquare(last.to);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.dispose();
  }

  private buildLights(): void {
    const ambient = new THREE.AmbientLight(0x3a2858, 0.55);
    const key = new THREE.DirectionalLight(0xc9a962, 1.1);
    key.position.set(4, 9, 5);
    key.castShadow = true;

    const rim = new THREE.PointLight(0x6b3fa0, 2.2, 20);
    rim.position.set(-4, 3, -3);

    const fill = new THREE.PointLight(0x8a7340, 0.8, 16);
    fill.position.set(3, 2, -4);

    this.scene.add(ambient, key, rim, fill);
  }

  private buildPedestal(): void {
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.8, 0.35, 64),
      new THREE.MeshStandardMaterial({ color: 0x120a1f, metalness: 0.35, roughness: 0.75 })
    );
    pedestal.position.y = -0.2;
    pedestal.receiveShadow = true;
    this.boardGroup.add(pedestal);
  }

  private buildBoard(): void {
    const lightMat = new THREE.MeshStandardMaterial({ color: 0x2a1548, metalness: 0.2, roughness: 0.65 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x120a1f, metalness: 0.25, roughness: 0.7 });
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_SIZE + 0.5, 0.25, BOARD_SIZE + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a0f2e, metalness: 0.5, roughness: 0.45 })
    );
    frame.position.y = -0.08;
    frame.receiveShadow = true;
    this.boardGroup.add(frame);

    for (let file = 0; file < BOARD_SIZE; file++) {
      for (let rank = 0; rank < BOARD_SIZE; rank++) {
        const isLight = (file + rank) % 2 === 0;
        const square = this.coordsToSquare(file, rank);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(SQUARE_SIZE * 0.96, 0.12, SQUARE_SIZE * 0.96),
          isLight ? lightMat : darkMat
        );
        const { x, z } = this.squareToWorld(square);
        mesh.position.set(x, 0.02, z);
        mesh.receiveShadow = true;
        mesh.userData.square = square;
        this.squareMeshes.set(square, mesh);
        this.boardGroup.add(mesh);
      }
    }
  }

  private syncPieces(): void {
    if (!this.engine) return;

    const board = this.parseBoard(this.engine.fen);
    const seen = new Set<Square>();

    for (const [square, data] of board) {
      seen.add(square);
      const existing = this.pieces.get(square);
      if (existing && existing.color === data.color && existing.type === data.type) continue;

      if (existing) {
        this.piecesGroup.remove(existing.mesh);
        this.pieces.delete(square);
      }

      const mesh = this.createPieceMesh(data.type, data.color);
      const { x, z } = this.squareToWorld(square);
      mesh.position.set(x, PIECE_HEIGHT, z);
      mesh.castShadow = true;
      mesh.userData.square = square;
      this.piecesGroup.add(mesh);
      this.pieces.set(square, { mesh, square, color: data.color, type: data.type });
    }

    for (const [square, piece] of this.pieces) {
      if (!seen.has(square)) {
        this.piecesGroup.remove(piece.mesh);
        this.pieces.delete(square);
      }
    }

    this.reconcilePiecePositions(board);
  }

  private reconcilePiecePositions(board: Map<Square, { type: string; color: Color }>): void {
    const entries = [...this.pieces.entries()];
    for (const [square, piece] of entries) {
      const target = board.get(square);
      if (!target) continue;
      const duplicate = entries.find(
        ([sq, p]) => sq !== square && p.color === target.color && p.type === target.type && !board.has(sq)
      );
      if (duplicate) {
        this.pieces.delete(duplicate[0]);
        piece.square = square;
        piece.mesh.userData.square = square;
        this.pieces.set(square, piece);
      }
      const { x, z } = this.squareToWorld(square);
      piece.mesh.position.set(x, PIECE_HEIGHT, z);
    }
  }

  private parseBoard(fen: string): Map<Square, { type: string; color: Color }> {
    const map = new Map<Square, { type: string; color: Color }>();
    const placement = fen.split(" ")[0];
    const ranks = placement.split("/");
    ranks.forEach((rankStr, rankIdx) => {
      let file = 0;
      for (const ch of rankStr) {
        if (/\d/.test(ch)) {
          file += Number(ch);
        } else {
          const square = `${String.fromCharCode(97 + file)}${8 - rankIdx}` as Square;
          map.set(square, { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? "w" : "b" });
          file += 1;
        }
      }
    });
    return map;
  }

  private createPieceMesh(type: string, color: Color): THREE.Group {
    const isWhite = color === "w";
    const mat = new THREE.MeshStandardMaterial({
      color: isWhite ? 0xe8e0f4 : 0x1a0f2e,
      emissive: isWhite ? 0x2a1548 : 0x000000,
      emissiveIntensity: isWhite ? 0.08 : 0,
      metalness: isWhite ? 0.55 : 0.7,
      roughness: isWhite ? 0.35 : 0.4,
    });
    const builder = PIECE_SHAPES[type] ?? PIECE_SHAPES.p;
    const group = builder(color, mat);
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return group;
  }

  private onResize = (): void => {
    const { clientWidth, clientHeight } = this.canvas;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.canInteract || !this.engine || !this.onMoveRequest) return;

    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const targets = [...this.squareMeshes.values(), ...[...this.pieces.values()].map((p) => p.mesh)];
    const hits = this.raycaster.intersectObjects(targets, true);
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
      if (piece && piece.color === turn) {
        this.selectSquare(square);
      }
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
      this.clearSelection();
      return;
    }

    const needsPromotion = targetMove.promotion !== undefined;
    this.onMoveRequest({ from: this.selected, to: square, needsPromotion });
    this.clearSelection();
  };

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

    const selectRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.42, 32),
      new THREE.MeshBasicMaterial({ color: 0xc9a962, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    selectRing.rotation.x = -Math.PI / 2;
    const { x, z } = this.squareToWorld(square);
    selectRing.position.set(x, 0.14, z);
    this.highlightsGroup.add(selectRing);

    const moves = this.engine.getLegalMoves(square);
    for (const move of moves) {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.14, 20),
        new THREE.MeshBasicMaterial({
          color: 0x6b3fa0,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        })
      );
      dot.rotation.x = -Math.PI / 2;
      const pos = this.squareToWorld(move.to as Square);
      dot.position.set(pos.x, 0.13, pos.z);
      this.highlightsGroup.add(dot);
    }
  }

  private pulseSquare(square: Square): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.48, 40),
      new THREE.MeshBasicMaterial({ color: 0xc9a962, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    const { x, z } = this.squareToWorld(square);
    ring.position.set(x, 0.15, z);
    this.highlightsGroup.add(ring);

    const start = performance.now();
    const fade = (time: number) => {
      const t = (time - start) / 900;
      ring.material.opacity = 0.9 * (1 - t);
      ring.scale.setScalar(1 + t * 0.35);
      if (t < 1) requestAnimationFrame(fade);
      else this.highlightsGroup.remove(ring);
    };
    requestAnimationFrame(fade);
  }

  private squareToWorld(square: Square): { x: number; z: number } {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const offset = (BOARD_SIZE * SQUARE_SIZE) / 2 - SQUARE_SIZE / 2;
    return {
      x: file * SQUARE_SIZE - offset,
      z: rank * SQUARE_SIZE - offset,
    };
  }

  private coordsToSquare(file: number, rank: number): Square {
    return `${String.fromCharCode(97 + file)}${rank + 1}` as Square;
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const t = performance.now() * 0.00025;
    this.boardGroup.position.y = Math.sin(t) * 0.04;
    this.renderer.render(this.scene, this.camera);
  };
}