import * as THREE from "three";
import type { Color } from "chess.js";
import { createCharacterPiece } from "./PieceFactory";

/** Instant-load Sleep Token character pieces (no 43MB GLB download). */
export type LoadedChessAssets = {
  pieceScale: number;
  boardMesh: THREE.Object3D | null;
  createPiece: (type: string, color: Color) => THREE.Group;
};

export function createLocalChessAssets(): LoadedChessAssets {
  return {
    pieceScale: 1,
    boardMesh: null,
    createPiece(type: string, color: Color) {
      return createCharacterPiece(type, color);
    },
  };
}