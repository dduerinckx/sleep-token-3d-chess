import * as THREE from "three";

export class SleepTokenEnvironment {
  readonly group = new THREE.Group();
  private particles: THREE.Points | null = null;
  private ring: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.buildSky(scene);
    this.buildSummoningFloor();
    this.buildArchSilhouettes();
    this.buildParticles();
    scene.add(this.group);
  }

  update(time: number): void {
    if (this.particles) {
      this.particles.rotation.y = time * 0.02;
    }
    if (this.ring) {
      this.ring.rotation.z = time * 0.08;
    }
  }

  private buildSky(scene: THREE.Scene): void {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#1a0a2e");
    grad.addColorStop(0.35, "#3d2068");
    grad.addColorStop(0.6, "#6b3fa0");
    grad.addColorStop(0.82, "#c9a962");
    grad.addColorStop(1, "#2a1548");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    for (let i = 0; i < 80; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 280;
      const r = Math.random() * 2 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 232, 180, ${Math.random() * 0.5 + 0.2})`;
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    scene.background = tex;

    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(40, 32, 32),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, transparent: true, opacity: 0.55 })
    );
    this.group.add(nebula);
  }

  private buildSummoningFloor(): void {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({
        color: 0x1a1028,
        metalness: 0.4,
        roughness: 0.6,
        transparent: true,
        opacity: 0.85,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.55;
    floor.receiveShadow = true;
    this.group.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5.5, 6.2, 64),
      new THREE.MeshBasicMaterial({ color: 0xc9a962, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.48;
    this.ring = ring;
    this.group.add(ring);

    const inner = ring.clone();
    inner.scale.setScalar(0.72);
    inner.material = new THREE.MeshBasicMaterial({ color: 0x6b3fa0, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
    this.group.add(inner);
  }

  private buildArchSilhouettes(): void {
    const archMat = new THREE.MeshBasicMaterial({ color: 0x0a0612, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 5; i++) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(2.5 + i * 0.3, 0.12, 8, 24, Math.PI), archMat);
      arch.position.set((i - 2) * 5, 1.5, -8 - i);
      arch.rotation.y = (i - 2) * 0.15;
      this.group.add(arch);
    }
  }

  private buildParticles(): void {
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = Math.random() * 10 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffe8b0, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false });
    this.particles = new THREE.Points(geo, mat);
    this.group.add(this.particles);
  }
}