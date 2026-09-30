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
const ringGeometry = new THREE.TorusGeometry(3, 0.5, 33, 33); // 6 segments for hexagonal ring shape
const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0x00bb55,
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

function frequencyToMidi(frequency) {
  if (frequency <= 0) return 0;
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

function getPitchColor(midiNote) {
  if (midiNote <= 0) return { h: 0, s: 0, l: 0.2 };

  const pitchClass = midiNote % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  const normalizedOctave = Math.max(1, Math.min(8, octave));

  return {
    h: pitchClass / 12,
    s: 1,
    l: 0.2 + ((normalizedOctave - 1) / 7) * 0.6
  };
}

function animate() {
  requestAnimationFrame(animate);

  const freqData = audioController.getFrequencyData();
  const bassVal = freqData[2] ? freqData[2] / 255 : 0; // Sub-bass frequency intensity

  rings.forEach((ring, index) => {
    // 1. Move rings toward the camera
    ring.position.z += SPEED + bassVal * 0.13;

    // 2. Loop ring back to far plane when it passes the camera
    if (ring.position.z > 2) {
      ring.position.z = -((NUM_RINGS - 1) * RING_SPACING);
    }

    // 3. Audio Reactivity (Scale & Color)
    const binIndex = index % freqData.length;
    const binEnergy = (freqData[binIndex] || 0) / 255;

    // Scale ring based on its corresponding audio frequency bin
    const scale = 1 + binEnergy * 1.2;
    ring.scale.set(scale, scale, scale);

    // Rotate individual ring sections
    ring.rotation.z += 0.005 + (index % 2 === 0 ? 0.005 : -0.005);

    if (binEnergy > 0.1) {
      const frequency = binIndex * audioController.getBinWidth();
      const { h, s, l } = getPitchColor(frequencyToMidi(frequency));
      ring.material.color.setHSL(h, s, l * binEnergy);
    } else {
      ring.material.color.setHex(0x00bb55);
    }
  });

  renderer.render(scene, camera);
}

animate();