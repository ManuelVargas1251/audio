// src/js/main.js
import * as THREE from 'three';
import { createAudioController } from './audio.js';

// --- DOM References ---
const container = document.getElementById('canvas-container');
const audioPlayer = document.getElementById('audio-player');
const loudnessEl = document.getElementById('hud-loudness');
const timerEl = document.getElementById('hud-timer');
const audioController = createAudioController(audioPlayer);

// Initialize Audio Context on Play
audioPlayer.addEventListener('play', () => {
  audioController.init();
});

// --- Three.js Setup ---
const scene = new THREE.Scene();
// scene.fog = new THREE.FogExp2(0x050508, 0.03); // Infinite distance depth effect
scene.fog = new THREE.FogExp2(0x050508, 0.015); // Infinite distance depth effect

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
  color: 0x112255,
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

// --- Theme Configuration ---
const THEMES = {
  ocean: { type: 'analogous', baseHue: 0.58, hueRange: 0.22, sat: 0.85 },
  sunset: { type: 'analogous', baseHue: 0.82, hueRange: 0.20, sat: 0.90 },
  cyberpunk: {
    type: 'palette',
    palette: [0.50, 0.85, 0.12],
    baseHue: 0.50,
    sat: 0.90
  },
  rainbow: {
    subIndex: 0,
    subs: [
      { name: 'vivid',   type: 'analogous', baseHue: 0.50, hueRange: 1.00, sat: 1.00, lightOffset: 0.0 }, // Classic full saturation
      { name: 'pastel',  type: 'analogous', baseHue: 0.50, hueRange: 1.00, sat: 0.45, lightOffset: 0.2 }, // Soft, desaturated pastel
      { name: 'neon',    type: 'analogous', baseHue: 0.50, hueRange: 1.00, sat: 0.90, lightOffset: 0.15 } // Bright high-lightness neon
    ]
  },
  october: {
    subIndex: 0,
    subs: [
      { name: 'autumn', type: 'analogous', baseHue: 0.08, hueRange: 0.16, sat: 0.90 },
      { name: 'halloween', type: 'palette', palette: [0.08, 0.33, 0.75], baseHue: 0.75, sat: 0.95 },
      { name: 'harvestMoon', type: 'palette', palette: [0.60, 0.13, 0.96], baseHue: 0.60, sat: 0.80 }
    ]
  }
};

let currentTheme = THEMES.rainbow;
let hueDriftOffset = 0;

function getActiveTheme() {
  if (currentTheme.subs) {
    return currentTheme.subs[currentTheme.subIndex];
  }
  return currentTheme;
}

window.addEventListener('keydown', (event) => {
  if (event.key === '1') currentTheme = THEMES.ocean;
  if (event.key === '2') currentTheme = THEMES.sunset;
  if (event.key === '3') currentTheme = THEMES.cyberpunk;
  if (event.key === '4') {
    if (currentTheme === THEMES.rainbow) {
      THEMES.rainbow.subIndex = (THEMES.rainbow.subIndex + 1) % THEMES.rainbow.subs.length;
    } else {
      currentTheme = THEMES.rainbow;
    }
  }
  if (event.key === '6') {
    if (currentTheme === THEMES.october) {
      THEMES.october.subIndex = (THEMES.october.subIndex + 1) % THEMES.october.subs.length;
    } else {
      currentTheme = THEMES.october;
    }
  }
});

let lastSubThemeSwitchTime = 0;
const SUB_THEME_MIN_COOLDOWN_MS = 15000;  // 15 seconds
const SUB_THEME_MAX_WAIT_MS = 30000;  // 30 seconds

function checkAudioSubThemeTrigger(averageLoudness) {
  if (!currentTheme.subs) return;

  const now = performance.now();
  const timeSinceLastSwitch = now - lastSubThemeSwitchTime;
  const lowThreshold = 0.120;
  const highThreshold = 0.320;

  const audioTriggered = (averageLoudness < lowThreshold || averageLoudness > highThreshold)
    && timeSinceLastSwitch >= SUB_THEME_MIN_COOLDOWN_MS;
  const timeTriggered = timeSinceLastSwitch >= SUB_THEME_MAX_WAIT_MS;

  if (audioTriggered || timeTriggered) {
    currentTheme.subIndex = (currentTheme.subIndex + 1) % currentTheme.subs.length;
    lastSubThemeSwitchTime = now;
  }
}

function frequencyToMidi(frequency) {
  if (frequency <= 0) return 0;
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

function getPitchColor(midiNote) {
  const active = getActiveTheme();

  if (midiNote <= 0) {
    const driftedBase = (active.baseHue + hueDriftOffset) % 1;
    return { h: driftedBase, s: active.sat * 0.5, l: 0.12 };
  }

  const pitchClass = midiNote % 12;
  const octave = Math.floor(midiNote / 12) - 1;

  let hue;
  if (active.type === 'palette') {
    const colorIndex = pitchClass % active.palette.length;
    hue = active.palette[colorIndex];
  } else {
    const normalizedPitch = pitchClass / 11;
    const hueOffset = (normalizedPitch - 0.5) * active.hueRange;
    hue = (active.baseHue + hueDriftOffset + hueOffset + 1) % 1;
  }

  const normalizedOctave = Math.max(1, Math.min(8, octave));
  const offset = active.lightOffset || 0.0;
  const lightness = Math.min(0.9, 0.22 + offset + ((normalizedOctave - 1) / 7) * 0.55);

  return { h: hue, s: active.sat, l: lightness };
}

function animate() {
  requestAnimationFrame(animate);

  const activeTheme = getActiveTheme();
  hueDriftOffset = (hueDriftOffset + 0.0015) % 1;

  const freqData = audioController.getFrequencyData();
  const averageLoudness = freqData.length
    ? freqData.reduce((total, value) => total + value, 0) / (freqData.length * 255)
    : 0;
  if (loudnessEl) loudnessEl.textContent = averageLoudness.toFixed(3);

  const cooldownRemaining = Math.max(
    0,
    (SUB_THEME_MIN_COOLDOWN_MS - (performance.now() - lastSubThemeSwitchTime)) / 1000
  );
  if (timerEl) timerEl.textContent = `${cooldownRemaining.toFixed(1)}s`;

  checkAudioSubThemeTrigger(averageLoudness);
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

    const targetColor = new THREE.Color();

    if (binEnergy > 0.1) {
      const frequency = binIndex * audioController.getBinWidth();
      const { h, s, l } = getPitchColor(frequencyToMidi(frequency));
      targetColor.setHSL(h, s, l * binEnergy);
    } else {
      targetColor.setHSL((activeTheme.baseHue + hueDriftOffset) % 1, activeTheme.sat * 0.5, 0.12);
    }

    ring.material.color.lerp(targetColor, 0.06);
  });

  renderer.render(scene, camera);
}

animate();