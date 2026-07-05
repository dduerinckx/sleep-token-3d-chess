import * as THREE from "three";

export function createSleepTokenBoardTexture(light: boolean): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const base = light
    ? ctx.createLinearGradient(0, 0, size, size)
    : ctx.createLinearGradient(0, 0, size, size);
  if (light) {
    base.addColorStop(0, "#f0e4cc");
    base.addColorStop(0.5, "#e8d8b8");
    base.addColorStop(1, "#dcc8a0");
  } else {
    base.addColorStop(0, "#6b5040");
    base.addColorStop(0.5, "#5a4038");
    base.addColorStop(1, "#4a3028");
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = light ? "#c9a962" : "#2a1548";
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 20 + Math.random() * 80, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = light ? "#8b6fd0" : "#c9a962";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = light ? "#6b3fa0" : "#c9a962";
  ctx.font = "bold 120px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☍", size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSleepTokenSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, "#0a0614");
  grad.addColorStop(0.25, "#1a0a2e");
  grad.addColorStop(0.5, "#3d2068");
  grad.addColorStop(0.72, "#6b3fa0");
  grad.addColorStop(0.88, "#c9a962");
  grad.addColorStop(1, "#1a1028");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 1024);

  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 500;
    const r = Math.random() * 2.5 + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 232, 180, ${Math.random() * 0.6 + 0.15})`;
    ctx.fill();
  }

  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = "#c9a962";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(1024, 400 + i * 30, 500 + i * 60, 120, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#e8e0f4";
  ctx.beginPath();
  ctx.ellipse(1024, 700, 700, 200, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}