// src/js/main.js
import * as THREE from 'three';
import { createAudioController } from './audio.js';

// --- DOM References ---
const container = document.getElementById('canvas-container');
const audioPlayer = document.getElementById('audio-player');
const audioController = createAudioController(audioPlayer);

// Initialize Audio Context on Play
audioPlayer.addEventListener('play', () => {
  audioController.init();
});

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050508, 0.03); // Infinite distance depth effect

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// --- Modular Tunnel Ring Construction ---
const NUM_RINGS = 40;
const RING_SPACING = 3;
const rings = [];

// Base Ring Geometry & Wireframe Material
// Torus Arguments: (radius, tube, radialSegments, tubularSegments)
// tube: original: 0.05; max: 5 or 50
const ringGeometry = new THREE.TorusGeometry(3, 0.03, 33, 33); // 6 segments for hexagonal ring shape
const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0x0099ff,
  wireframe: true,
  transparent: true,
  opacity: 0.8
});

// Populate Tunnel Rings along -Z Axis
for (let i = 0; i < NUM_RINGS; i++) {
  const ring = new THREE.Mesh(ringGeometry, ringMaterial.clone());
  ring.position.z = -i * RING_SPACING;
  scene.add(ring);
  rings.push(ring);
}

// --- Window Resize Handler ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animation & Audio Reactor Loop ---
const SPEED = 0.15;

function animate() {
  requestAnimationFrame(animate);

  const freqData = audioController.getFrequencyData();
  const bassVal = freqData[2] ? freqData[2] / 255 : 0; // Sub-bass frequency intensity

  rings.forEach((ring, index) => {
    // 1. Move rings toward the camera
    ring.position.z += SPEED + bassVal * 0.1;

    // 2. Loop ring back to far plane when it passes the camera
    if (ring.position.z > 2) {
      ring.position.z = -((NUM_RINGS - 1) * RING_SPACING);
    }

    // 3. Audio Reactivity (Scale & Color)
    const binValue = freqData[index % freqData.length] || 0;
    const normalizedFreq = binValue / 255;

    // Scale ring based on its corresponding audio frequency bin
    const scale = 1 + normalizedFreq * 1.2;
    ring.scale.set(scale, scale, scale);

    // Rotate individual ring sections
    ring.rotation.z += 0.005 + (index % 2 === 0 ? 0.005 : -0.005);

    // Dynamic HSL Color Shift based on frequency energy
    // ring.material.color.setHSL(0.45 + normalizedFreq * 0.3, 1.0, 0.5); //wip
  });

  renderer.render(scene, camera);
}

animate();