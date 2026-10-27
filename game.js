import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c9f5);
scene.fog = new THREE.Fog(0x87c9f5, 24, 70);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 120);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xd9efff, 0x6e563e, 2.0));
const sun = new THREE.DirectionalLight(0xfff2d1, 2.4);
sun.position.set(-18, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -24;
sun.shadow.camera.right = 24;
sun.shadow.camera.top = 24;
sun.shadow.camera.bottom = -24;
scene.add(sun);

const materials = {
  grass: new THREE.MeshLambertMaterial({ color: 0x69ad45 }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x8a5a35 }),
  stone: new THREE.MeshLambertMaterial({ color: 0x888d94 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x79502e }),
  leaves: new THREE.MeshLambertMaterial({ color: 0x347b38 })
};
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const blocks = new Map();
const blockMeshes = [];
const keyOf = (x, y, z) => `${x},${y},${z}`;
const blockPosition = (mesh) => mesh.userData.blockPos;

function addBlock(x, y, z, type) {
  const key = keyOf(x, y, z);
  if (blocks.has(key)) return false;
  const mesh = new THREE.Mesh(cubeGeometry, materials[type] || materials.grass);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { blockPos: { x, y, z }, type };
  scene.add(mesh);
  blocks.set(key, mesh);
  blockMeshes.push(mesh);
  return true;
}
function removeBlock(mesh) {
  const p = blockPosition(mesh);
  if (!p || p.y < 0) return;
  scene.remove(mesh);
  blocks.delete(keyOf(p.x, p.y, p.z));
  const i = blockMeshes.indexOf(mesh);
  if (i >= 0) blockMeshes.splice(i, 1);
}
function heightAt(x, z) {
  return Math.floor(2 + Math.sin(x * 0.42) * 1.2 + Math.cos(z * 0.38) * 1.1 + Math.sin((x + z) * 0.22) * 0.8);
}

// Generate a compact, gently rolling world.
for (let x = -16; x <= 16; x++) {
  for (let z = -16; z <= 16; z++) {
    const h = heightAt(x, z);
    for (let y = -2; y <= h; y++) {
      const type = y === h ? 'grass' : (y >= h - 2 ? 'dirt' : 'stone');
      addBlock(x, y, z, type);
    }
  }
}

// Add a few simple blocky trees away from the spawn point.
for (const [tx, tz] of [[-7, -5], [8, -8], [10, 5], [-10, 8], [3, 12]]) {
  const ground = heightAt(tx, tz);
  for (let y = 1; y <= 3; y++) addBlock(tx, ground + y, tz, 'wood');
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 2; dy <= 4; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 3) <= 4) {
          const p = keyOf(tx + dx, ground + dy, tz + dz);
          if (!blocks.has(p)) {
            const mesh = new THREE.Mesh(cubeGeometry, materials.leaves);
            mesh.position.set(tx + dx, ground + dy, tz + dz);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { blockPos: { x: tx + dx, y: ground + dy, z: tz + dz }, type: 'leaves' };
            scene.add(mesh);
            blocks.set(p, mesh);
            blockMeshes.push(mesh);
          }
        }
      }
    }
  }
}

// Player is represented by a camera with simple axis-aligned collision.
const player = { x: 0, y: heightAt(0, 0) + 0.51, z: 0, vy: 0, onGround: false };
const PLAYER_HEIGHT = 1.75;
const PLAYER_RADIUS = 0.28;
let yaw = 0;
let pitch = 0;
let selectedType = 'grass';
let pointerLocked = false;
const keys = new Set();
const raycaster = new THREE.Raycaster();
raycaster.far = 6;

function solidAt(x, y, z) {
  return blocks.has(keyOf(Math.floor(x + 0.5), Math.floor(y + 0.5), Math.floor(z + 0.5)));
}
function collidesAt(x, feetY, z) {
  const minX = x - PLAYER_RADIUS, maxX = x + PLAYER_RADIUS;
  const minZ = z - PLAYER_RADIUS, maxZ = z + PLAYER_RADIUS;
  const minY = feetY + 0.05, maxY = feetY + PLAYER_HEIGHT - 0.05;
  for (let bx = Math.floor(minX + 0.5); bx <= Math.floor(maxX + 0.5); bx++) {
    for (let bz = Math.floor(minZ + 0.5); bz <= Math.floor(maxZ + 0.5); bz++) {
      for (let by = Math.floor(minY + 0.5); by <= Math.floor(maxY + 0.5); by++) {
        if (blocks.has(keyOf(bx, by, bz))) return true;
      }
    }
  }
  return false;
}
function updateCamera() {
  camera.position.set(player.x, player.y + PLAYER_HEIGHT - 0.15, player.z);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}
function updateStatus() {
  document.querySelector('#status').textContent =
    `XYZ ${player.x.toFixed(1)}, ${player.y.toFixed(1)}, ${player.z.toFixed(1)} · ${blocks.size} blocks`;
}
function chooseBlock(type) {
  selectedType = type;
  document.querySelectorAll('.slot').forEach(slot => slot.classList.toggle('selected', slot.dataset.type === type));
}

document.querySelectorAll('.slot').forEach(slot => {
  slot.addEventListener('click', () => chooseBlock(slot.dataset.type));
});
renderer.domElement.addEventListener('click', () => {
  if (!pointerLocked) renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});
document.addEventListener('mousemove', event => {
  if (!pointerLocked) return;
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.0022;
  pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, pitch));
});
document.addEventListener('keydown', event => {
  keys.add(event.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'Digit1') chooseBlock('grass');
  if (event.code === 'Digit2') chooseBlock('dirt');
  if (event.code === 'Digit3') chooseBlock('stone');
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());
document.addEventListener('contextmenu', event => event.preventDefault());

function targetBlock() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(blockMeshes, false);
  return hits.length ? hits[0] : null;
}
renderer.domElement.addEventListener('mousedown', event => {
  if (!pointerLocked) return;
  if (event.button !== 0 && event.button !== 2) return;
  const hit = targetBlock();
  if (!hit) return;
  if (event.button === 0) {
    removeBlock(hit.object);
  } else {
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const p = blockPosition(hit.object);
    const x = p.x + Math.round(normal.x);
    const y = p.y + Math.round(normal.y);
    const z = p.z + Math.round(normal.z);
    if (!collidesAt(player.x, player.y, player.z) &&
        !playerIntersectsBlock(x, y, z)) {
      addBlock(x, y, z, selectedType);
    }
  }
});
function playerIntersectsBlock(x, y, z) {
  const overlapX = Math.abs(player.x - x) < PLAYER_RADIUS + 0.5;
  const overlapZ = Math.abs(player.z - z) < PLAYER_RADIUS + 0.5;
  const playerBottom = player.y, playerTop = player.y + PLAYER_HEIGHT;
  const overlapY = playerBottom < y + 0.5 && playerTop > y - 0.5;
  return overlapX && overlapY && overlapZ;
}

const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (pointerLocked) {
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const length = Math.hypot(forward, strafe) || 1;
    const speed = keys.has('ShiftLeft') ? 8 : 5;
    const moveX = (Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length * speed * dt;
    const moveZ = (-Math.cos(yaw) * forward + Math.sin(yaw) * strafe) / length * speed * dt;

    if (!collidesAt(player.x + moveX, player.y, player.z)) player.x += moveX;
    if (!collidesAt(player.x, player.y, player.z + moveZ)) player.z += moveZ;

    if (keys.has('Space') && player.onGround) {
      player.vy = 7.2;
      player.onGround = false;
    }
    player.vy -= 19 * dt;
    let nextY = player.y + player.vy * dt;
    if (player.vy <= 0 && collidesAt(player.x, nextY, player.z)) {
      player.vy = 0;
      player.onGround = true;
      while (collidesAt(player.x, player.y, player.z)) player.y += 0.03;
    } else if (player.vy > 0 && collidesAt(player.x, nextY, player.z)) {
      player.vy = 0;
    } else {
      player.y = nextY;
      player.onGround = false;
    }
    if (player.y < -10) {
      player.x = 0; player.z = 0; player.y = heightAt(0, 0) + 1;
      player.vy = 0;
    }
  }
  updateCamera();
  updateStatus();
  renderer.render(scene, camera);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
