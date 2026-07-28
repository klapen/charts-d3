// Three.js memory-space: each model is a glowing sprite at the height of the
// VRAM it needs; a translucent disc ("memory plane") tweens to the selected
// VRAM. Fallback to a static SVG when WebGL is unavailable or the user
// prefers reduced motion.

import * as THREE from 'three';
import { gsap } from 'gsap';

const ACCENT = new THREE.Color('#34d399');
const DIM    = new THREE.Color('#1d2a24');
const LOG_LO = Math.log(1.5);
const LOG_HI = Math.log(450);
const SPRITE_SCALE = 0.16;

const vramNorm = v => (Math.log(v) - LOG_LO) / (LOG_HI - LOG_LO); // 0 tiny … 1 huge
const yOf = v => -1.3 + vramNorm(v) * 2.6;

export function mountHeroScene(container, models, hwState) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !webglAvailable()) {
    renderStatic(container, models, hwState);
    return;
  }

  const W = () => container.clientWidth || 480;
  const H = () => container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 50);
  camera.position.set(0, 0.2, 4.4);

  const glowTex = makeGlowTexture();

  // model sprites
  const nodes = models.map(m => {
    const mat = new THREE.SpriteMaterial({
      map: glowTex, color: DIM.clone(), transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(SPRITE_SCALE);
    scene.add(sprite);
    return {
      m, sprite,
      angle: Math.random() * Math.PI * 2,
      radius: 0.5 + Math.random() * 0.65,
      speed: 0.1 + Math.random() * 0.15,
      y: yOf(m.vram_estimate_gb.q4),
      fit: false,
    };
  });

  // ambient dust
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(200 * 3);
  for (let i = 0; i < 200; i++) {
    dustPos[i * 3]     = (Math.random() - 0.5) * 5;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 3.4;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0x34d399, size: 0.015, transparent: true, opacity: 0.28, depthWrite: false,
  })));

  // memory plane (disc + edge ring)
  const plane = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 64),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.33, 1.37, 96),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  plane.add(disc, ring);
  plane.position.y = yOf(hwState.get());
  scene.add(plane);

  hwState.subscribe(v => {
    gsap.to(plane.position, { y: yOf(v), duration: 0.9, ease: 'power3.out' });
    nodes.forEach(n => {
      const fits = n.m.vram_estimate_gb.q4 <= v;
      if (fits && !n.fit) pulse(n.sprite);
      n.fit = fits;
    });
  });

  // hover tooltip + pointer parallax (fine pointers only)
  const tooltip = document.createElement('div');
  tooltip.className = 'hero-tooltip';
  container.appendChild(tooltip);
  let px = 0, py = 0;
  if (window.matchMedia('(pointer: fine)').matches) {
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const sprites = nodes.map(n => n.sprite); // stable set — hoisted out of the high-frequency pointermove
    renderer.domElement.addEventListener('pointermove', e => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      px = mouse.x / 2;
      py = -mouse.y / 2;
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(sprites);
      if (hits.length) {
        const n = nodes.find(nd => nd.sprite === hits[0].object);
        tooltip.textContent = `${n.m.name} · ${n.m.vram_estimate_gb.q4} GB at q4`;
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX - r.left + 12}px`;
        tooltip.style.top = `${e.clientY - r.top + 12}px`;
      } else {
        tooltip.style.display = 'none';
      }
    });
    renderer.domElement.addEventListener('pointerleave', () => { tooltip.style.display = 'none'; });
  }

  // pause render loop while off-screen
  let running = true;
  new IntersectionObserver(([entry]) => {
    const was = running;
    running = entry.isIntersecting;
    if (running && !was) tick();
  }).observe(container);

  new ResizeObserver(() => {
    renderer.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
  }).observe(container);

  const clock = new THREE.Clock();
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    // Cap dt: after the loop pauses off-screen, the first getDelta() on resume
    // returns the whole off-screen span — clamp it so orbits don't jump.
    const dt = Math.min(clock.getDelta(), 0.05);
    nodes.forEach(n => {
      n.angle += n.speed * dt;
      n.sprite.position.set(Math.cos(n.angle) * n.radius, n.y, Math.sin(n.angle) * n.radius);
      n.sprite.material.color.lerp(n.fit ? ACCENT : DIM, 0.08);
      n.sprite.material.opacity += ((n.fit ? 1 : 0.5) - n.sprite.material.opacity) * 0.08;
    });
    camera.position.x += (px * 0.5 - camera.position.x) * 0.04;
    camera.position.y += (0.2 - py * 0.4 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  tick();
}

function pulse(sprite) {
  gsap.fromTo(sprite.scale,
    { x: SPRITE_SCALE * 2.4, y: SPRITE_SCALE * 2.4 },
    { x: SPRITE_SCALE, y: SPRITE_SCALE, duration: 0.9, ease: 'power3.out' });
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// Static SVG fallback: same vertical mapping, deterministic horizontal spread.
function renderStatic(container, models, hwState) {
  hwState.subscribe(v => {
    const W = container.clientWidth || 480;
    const H = container.clientHeight || 420;
    const planeY = H - 30 - vramNorm(Math.max(1.5, Math.min(450, v))) * (H - 60);
    const dots = models.map((m, i) => {
      const cx = W / 2 + Math.cos((i / models.length) * Math.PI * 2) * W * 0.3;
      const cy = H - 30 - vramNorm(m.vram_estimate_gb.q4) * (H - 60);
      const fits = m.vram_estimate_gb.q4 <= v;
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5"
        fill="${fits ? '#34d399' : '#16201b'}" stroke="${fits ? 'none' : '#2a3833'}">
        <title>${m.name} · ${m.vram_estimate_gb.q4} GB at q4</title></circle>`;
    }).join('');
    container.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Models positioned by VRAM need; line marks your selected VRAM">
      <line x1="20" x2="${W - 20}" y1="${planeY}" y2="${planeY}"
        stroke="#34d399" stroke-dasharray="4 5" stroke-opacity="0.7"/>${dots}</svg>`;
  });
}
