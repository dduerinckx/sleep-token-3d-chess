import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Color } from "chess.js";

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF-Binary/ABeautifulGame.glb";

const PIECE_NODE: Record<string, Record<Color, string[]>> = {
  k: { w: ["King_W"], b: ["King_B"] },
  q: { w: ["Queen_W"], b: ["Queen_B"] },
  r: { w: ["Castle_W1"], b: ["Castle_B1"] },
  n: { w: ["Knight_W1"], b: ["Knight_B1"] },
  b: { w: ["Bishop_W1"], b: ["Bishop_B1"] },
  p: { w: ["Pawn_Body_W1", "Pawn_Top_W1"], b: ["Pawn_Body_B1", "Pawn_Top_B1"] },
};

export type LoadedChessAssets = {
  pieceScale: number;
  boardMesh: THREE.Object3D | null;
  createPiece: (type: string, color: Color) => THREE.Group;
};

export async function loadChessAssets(): Promise<LoadedChessAssets> {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const root = gltf.scene;
  const nodeMap = new Map<string, THREE.Object3D>();

  root.traverse((obj) => {
    if (obj.name) nodeMap.set(obj.name, obj);
  });

  const board = nodeMap.get("Chessboard") ?? null;
  let pieceScale = 0.42;

  if (board) {
    const box = new THREE.Box3().setFromObject(board);
    const size = box.getSize(new THREE.Vector3());
    pieceScale = 7.2 / Math.max(size.x, size.z);
    board.scale.multiplyScalar(pieceScale);
    board.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(pieceScale));
    board.position.y = 0;
  }

  const templates = new Map<string, THREE.Group>();

  root.updateWorldMatrix(true, true);

  for (const [type, colors] of Object.entries(PIECE_NODE)) {
    for (const [color, names] of Object.entries(colors)) {
      const group = new THREE.Group();
      let found = false;
      for (const name of names) {
        const src = nodeMap.get(name);
        if (!src) continue;
        const clone = src.clone(true);
        src.updateWorldMatrix(true, false);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        src.matrixWorld.decompose(pos, quat, scl);
        clone.position.copy(pos);
        clone.quaternion.copy(quat);
        clone.scale.copy(scl);
        clone.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        group.add(clone);
        found = true;
      }
      if (found) {
        group.scale.setScalar(pieceScale * 0.92);
        const gbox = new THREE.Box3().setFromObject(group);
        const center = gbox.getCenter(new THREE.Vector3());
        group.position.sub(center);
        group.position.y -= gbox.min.y - 0.02;
        templates.set(`${color}-${type}`, group);
      }
    }
  }

  return {
    pieceScale,
    boardMesh: board,
    createPiece(type: string, color: Color): THREE.Group {
      const key = `${color}-${type}`;
      const template = templates.get(key);
      if (!template) return new THREE.Group();
      const piece = template.clone(true);
      piece.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return piece;
    },
  };
}