import * as THREE from "three";
import type { Color } from "chess.js";
import { getPieceLore } from "../theme/pieceLore";

function mat(color: number, emissive: number, metal = 0.45, rough = 0.38): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.22,
    metalness: metal,
    roughness: rough,
  });
}

function addAura(group: THREE.Group, color: number, y: number, radius: number): void {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.85, radius, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = y;
  group.add(ring);
}

function maskFace(group: THREE.Group, material: THREE.Material, y: number, scale = 1): void {
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), material);
  mask.position.y = y;
  mask.scale.set(1, 1.15, 0.75);
  group.add(mask);
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.04 * scale, 0.14 * scale, 8), material);
  hornL.position.set(-0.1 * scale, y + 0.12 * scale, 0);
  hornL.rotation.z = 0.5;
  const hornR = hornL.clone();
  hornR.position.x = 0.1 * scale;
  hornR.rotation.z = -0.5;
  group.add(hornL, hornR);
}

function buildSummoningPawn(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = mat(0xe8dcc8, 0xc9a962);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.42, 20), bodyMat);
  robe.position.y = 0.22;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 20), bodyMat);
  hood.position.y = 0.52;
  maskFace(g, bodyMat, 0.58, 0.9);
  g.add(robe, hood);
  addAura(g, 0xc9a962, 0.02, 0.34);
  return g;
}

function buildEdenPawn(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = mat(0x2a3d28, 0x4a6b40);
  const vineMat = mat(0x3d6b35, 0x1a4020, 0.2, 0.8);
  const soul = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.32, 8, 16), bodyMat);
  soul.position.y = 0.3;
  for (let i = 0; i < 4; i++) {
    const vine = new THREE.Mesh(new THREE.TorusGeometry(0.12 + i * 0.04, 0.025, 6, 12), vineMat);
    vine.rotation.x = Math.PI / 2;
    vine.position.y = 0.12 + i * 0.1;
    g.add(vine);
  }
  maskFace(g, mat(0x1a1a1a, 0x2a1018), 0.48, 0.75);
  g.add(soul);
  addAura(g, 0x5a8a4a, 0.02, 0.32);
  return g;
}

function buildSummoningKing(): THREE.Group {
  const g = new THREE.Group();
  const gold = mat(0xd4b87a, 0xffd080, 0.7, 0.28);
  const throne = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.42), mat(0x4a3058, 0x2a1548));
  throne.position.y = 0.14;
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 20), gold);
  seat.position.y = 0.52;
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 24), gold);
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 0.88;
  maskFace(g, gold, 0.78, 1.1);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), gold);
  staff.position.set(0.22, 0.55, 0);
  g.add(throne, seat, crown, staff);
  addAura(g, 0xffd080, 0.02, 0.42);
  return g;
}

function buildEdenKing(): THREE.Group {
  const g = new THREE.Group();
  const bark = mat(0x3d2818, 0x1a1008, 0.15, 0.85);
  const crimson = mat(0x6b2030, 0x3a0818, 0.35, 0.5);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.55, 16), bark);
  trunk.position.y = 0.3;
  const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), crimson);
  crown.position.y = 0.78;
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), mat(0x3a6b30, 0x1a4020, 0.1, 0.9));
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.2, 0.65, Math.sin(a) * 0.2);
    leaf.rotation.z = Math.cos(a) * 0.4;
    g.add(leaf);
  }
  maskFace(g, mat(0x101010, 0x4a1020), 0.72, 1);
  g.add(trunk, crown);
  addAura(g, 0x8b3a4a, 0.02, 0.4);
  return g;
}

function buildSummoningQueen(): THREE.Group {
  const g = new THREE.Group();
  const silk = mat(0xf0e6d8, 0xc9a962, 0.35, 0.45);
  const gown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.32, 0.62, 24), silk);
  gown.position.y = 0.36;
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.018, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0xffe8a0, emissive: 0xffc860, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.82;
  maskFace(g, silk, 0.72, 1.05);
  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), mat(0xffffff, 0xc9a962, 0.9, 0.1));
  jewel.position.y = 0.95;
  g.add(gown, halo, jewel);
  addAura(g, 0xe8c878, 0.02, 0.38);
  return g;
}

function buildEdenQueen(): THREE.Group {
  const g = new THREE.Group();
  const dress = mat(0x1a3020, 0x0a2010, 0.25, 0.65);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.34, 0.68, 24), dress);
  body.position.y = 0.38;
  const serpent = new THREE.Mesh(new THREE.TorusKnotGeometry(0.1, 0.025, 48, 8), mat(0x5a8040, 0x2a5020, 0.3, 0.6));
  serpent.position.y = 0.85;
  maskFace(g, mat(0x180810, 0x6b2040), 0.78, 1.1);
  g.add(body, serpent);
  addAura(g, 0x6b3a5a, 0.02, 0.38);
  return g;
}

function buildSummoningBishop(): THREE.Group {
  const g = new THREE.Group();
  const robe = mat(0xc8b8d8, 0x6b3fa0);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.2, 20), robe);
  base.position.y = 0.1;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 24), robe);
  body.position.y = 0.48;
  const censer = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), mat(0xffd080, 0xffa040, 0.8, 0.2));
  censer.position.set(0.18, 0.55, 0);
  maskFace(g, robe, 0.72, 1);
  g.add(base, body, censer);
  return g;
}

function buildEdenBishop(): THREE.Group {
  const g = new THREE.Group();
  const moss = mat(0x2a4a28, 0x143820, 0.15, 0.9);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.22, 16), moss);
  base.position.y = 0.11;
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 24), mat(0x4a7a38, 0x1a4020));
  coil.rotation.x = Math.PI / 2;
  coil.position.y = 0.55;
  maskFace(g, mat(0x101810, 0x3a6028), 0.68, 1);
  g.add(base, coil);
  return g;
}

function buildSummoningKnight(): THREE.Group {
  const g = new THREE.Group();
  const armor = mat(0xb8a8c8, 0x8060a0, 0.55, 0.35);
  const horse = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.38, 8, 20), armor);
  horse.rotation.z = -Math.PI / 2;
  horse.position.set(0.05, 0.38, 0);
  const rider = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.32, 12), armor);
  rider.position.set(-0.08, 0.62, 0);
  rider.rotation.z = 0.25;
  maskFace(g, armor, 0.78, 0.85);
  g.add(horse, rider);
  return g;
}

function buildEdenKnight(): THREE.Group {
  const g = new THREE.Group();
  const dark = mat(0x282018, 0x401810, 0.4, 0.55);
  const beast = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 8, 20), dark);
  beast.rotation.z = -Math.PI / 2;
  beast.position.set(0.06, 0.36, 0);
  const mane = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 12), mat(0x4a3020, 0x201008));
  mane.position.set(0.22, 0.48, 0);
  mane.rotation.z = -1.2;
  maskFace(g, mat(0x080808, 0x6b2030), 0.55, 0.9);
  g.add(beast, mane);
  return g;
}

function buildSummoningRook(): THREE.Group {
  const g = new THREE.Group();
  const stone = mat(0xd8ccb0, 0x8a7340, 0.2, 0.75);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.78, 16), stone);
  pillar.position.y = 0.42;
  for (let i = 0; i < 3; i++) {
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.06), mat(0xc9a962, 0xffd080, 0.7, 0.3));
    glyph.position.y = 0.22 + i * 0.22;
    g.add(glyph);
  }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44), stone);
  cap.position.y = 0.84;
  g.add(pillar, cap);
  return g;
}

function buildEdenRook(): THREE.Group {
  const g = new THREE.Group();
  const ruin = mat(0x5a5048, 0x2a2018, 0.15, 0.92);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.72, 14), ruin);
  pillar.position.y = 0.4;
  for (let i = 0; i < 5; i++) {
    const ivy = new THREE.Mesh(new THREE.TorusGeometry(0.14 + i * 0.03, 0.02, 6, 10), mat(0x3a6830, 0x1a3818, 0.1, 0.95));
    ivy.rotation.x = Math.PI / 2;
    ivy.position.y = 0.15 + i * 0.12;
    g.add(ivy);
  }
  g.add(pillar);
  return g;
}

const BUILDERS: Record<string, Record<"w" | "b", () => THREE.Group>> = {
  p: { w: buildSummoningPawn, b: buildEdenPawn },
  k: { w: buildSummoningKing, b: buildEdenKing },
  q: { w: buildSummoningQueen, b: buildEdenQueen },
  b: { w: buildSummoningBishop, b: buildEdenBishop },
  n: { w: buildSummoningKnight, b: buildEdenKnight },
  r: { w: buildSummoningRook, b: buildEdenRook },
};

export function createCharacterPiece(type: string, color: Color): THREE.Group {
  const builder = BUILDERS[type]?.[color] ?? BUILDERS.p[color];
  const group = builder();
  const lore = getPieceLore(type, color);
  group.userData.lore = lore;
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return group;
}