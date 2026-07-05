import * as THREE from "three";
import { createSleepTokenSkyTexture } from "../theme/textures";

export class SleepTokenEnvironment {
  readonly group = new THREE.Group();
  private particles: THREE.Points | null = null;
  private ring: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    const sky = createSleepTokenSkyTexture();
    scene.background = sky;

    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(45, 48, 48),
      new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, transparent: true, opacity: 0.65 })
    );
    this.group.add(nebula);

    this.buildSummoningFloor();
    this.buildArchSilhouettes();
    this.buildParticles();
    scene.add(this.group);
  }

  update(time: number): void {
    if (this.particles) this.particles.rotation.y = time * 0.015;
    if (this.ring) this.ring.rotation.z = time * 0.06;
  }

  private buildSummoningFloor(): void {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(16, 80),
      new THREE.MeshStandardMaterial({
        color: 0x1a1028,
        metalness: 0.55,
        roughness: 0.45,
        transparent: true,
        opacity: 0.9,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.55;
    floor.receiveShadow = true;
    this.group.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5.8, 6.6, 80),
      new THREE.MeshBasicMaterial({ color: 0xc9a962, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.48;
    this.ring = ring;
    this.group.add(ring);
  }

  private buildArchSilhouettes(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0x08040f, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 6; i++) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.14, 8, 32, Math.PI), mat);
      arch.position.set((i - 2.5) * 4.5, 1.8, -9 - i * 0.5);
      arch.rotation.y = (i - 2.5) * 0.12;
      this.group.add(arch);
    }
  }

  private buildParticles(): void {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 1] = Math.random() * 12 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffe8b0, size: 0.07, transparent: true, opacity: 0.75, depthWrite: false })
    );
    this.group.add(this.particles);
  }
}