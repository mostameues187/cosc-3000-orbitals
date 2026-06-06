import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./style.css";
import { psi, ORBITAL_LIST, orbitalScale } from "./orbital.js";
import { buildAxes } from "./axes.js";
import { RadialPlot } from "./radialPlot.js";
import { marchingCubes } from "./marchingCubes.js";
import { SlicePlot } from "./slicePlot.js";
import { SlicePlaneIndicator } from "./slicePlane.js";
import { VolumeRenderer } from "./volumeRender.js";

// ============================================================
// Configuration
// ============================================================
const POINT_COUNT = 20000;
const POINT_SIZE = 0.08;
const POSITIVE_COLOR = 0x5dc4ff;
const NEGATIVE_COLOR = 0xff5d5d;

// ============================================================
// Renderer, scene, camera
// ============================================================
const canvas = document.getElementById("scene");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e1a);

// Lighting for the isosurface
const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(5, 5, 8);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xaaccff, 0.4);
fillLight.position.set(-4, -3, 2);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffaacc, 0.3);
rimLight.position.set(0, -5, -5);
scene.add(rimLight);

const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 1000);
camera.up.set(0, 0, 1);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// ============================================================
// Reference axes
// ============================================================
let axesGroup = buildAxes(10);
scene.add(axesGroup);
const volumeRenderer = new VolumeRenderer(scene);

// ============================================================
// Point cloud sampling via rejection sampling on |psi|^2
// ============================================================
function samplePoints(n, l, m, count) {
  const extent = orbitalScale(n);

  let maxP = 0;
  for (let i = 0; i < 5000; i++) {
    const x = (Math.random() * 2 - 1) * extent;
    const y = (Math.random() * 2 - 1) * extent;
    const z = (Math.random() * 2 - 1) * extent;
    const v = psi(n, l, m, x, y, z);
    const p = v * v;
    if (p > maxP) maxP = p;
  }
  maxP *= 1.05;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const posColor = new THREE.Color(POSITIVE_COLOR);
  const negColor = new THREE.Color(NEGATIVE_COLOR);

  let i = 0;
  let attempts = 0;
  const maxAttempts = count * 500;

  while (i < count && attempts < maxAttempts) {
    attempts++;
    const x = (Math.random() * 2 - 1) * extent;
    const y = (Math.random() * 2 - 1) * extent;
    const z = (Math.random() * 2 - 1) * extent;
    const v = psi(n, l, m, x, y, z);
    const p = v * v;

    if (Math.random() * maxP < p) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const c = v >= 0 ? posColor : negColor;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      i++;
    }
  }

  console.log(`Sampled ${i} points in ${attempts} attempts (acceptance ${(100 * i / attempts).toFixed(1)}%)`);

  return {
    positions: positions.subarray(0, i * 3),
    colors: colors.subarray(0, i * 3),
    count: i,
    extent,
  };
}

// ============================================================
// Volume rendering mode
// ============================================================
function buildVolume(n, l, m) {
  clearOrbitalGeometry();
  const extent = volumeRenderer.build(n, l, m);

  const distance = extent * 2.4;
  camera.position.set(distance * 0.7, distance * 0.5, distance * 0.9);
  controls.target.set(0, 0, 0);
  controls.update();

  scene.remove(axesGroup);
  axesGroup = buildAxes(extent * 1.1);
  scene.add(axesGroup);
}

// ============================================================
// Build isosurface using marching cubes
// ============================================================
let isoMesh = null;

const ISO_GRID_SIZE = 48;       // 48^3 = ~110k samples. Bumps to 96 for quality.
const DEFAULT_ISO_FRACTION = 0.18;  // Threshold as fraction of |ψ|_max

function buildIsosurface(n, l, m, isoFraction = DEFAULT_ISO_FRACTION) {
  clearOrbitalGeometry();

  const extent = orbitalScale(n);

  // Find a reasonable threshold: a fraction of |ψ|_max.
  // We estimate |ψ|_max by random sampling, same trick as the point cloud.
  let maxAbs = 0;
  for (let i = 0; i < 4000; i++) {
    const x = (Math.random() * 2 - 1) * extent;
    const y = (Math.random() * 2 - 1) * extent;
    const z = (Math.random() * 2 - 1) * extent;
    const v = Math.abs(psi(n, l, m, x, y, z));
    if (v > maxAbs) maxAbs = v;
  }
  const threshold = maxAbs * isoFraction;

  // Run marching cubes
  const t0 = performance.now();
  const { positions, normals, signs } = marchingCubes({
    field: (x, y, z) => psi(n, l, m, x, y, z),
    size: ISO_GRID_SIZE,
    extent,
    threshold,
  });
  const elapsed = (performance.now() - t0).toFixed(0);
  console.log(`Isosurface: ${positions.length / 9} triangles in ${elapsed} ms`);

  if (positions.length === 0) {
    console.warn("Isosurface produced no geometry — threshold may be too high");
    return;
  }

  // Build vertex colours from the sign of the wavefunction
  const colors = new Float32Array(positions.length);
  const posColor = new THREE.Color(POSITIVE_COLOR);
  const negColor = new THREE.Color(NEGATIVE_COLOR);
  for (let i = 0; i < signs.length; i++) {
    const c = signs[i] > 0 ? posColor : negColor;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  // Build Three.js geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  // Material: a glossy plastic-look surface with phase colouring.
  // Side: DoubleSide so both inside and outside of the isosurface render.
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    shininess: 60,
    specular: 0x222222,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    flatShading: false,
  });

  isoMesh = new THREE.Mesh(geometry, material);
  scene.add(isoMesh);

  // Frame the camera to fit
  const distance = extent * 2.4;
  camera.position.set(distance * 0.7, distance * 0.5, distance * 0.9);
  controls.target.set(0, 0, 0);
  controls.update();

  // Rebuild axes
  scene.remove(axesGroup);
  axesGroup = buildAxes(extent * 1.1);
  scene.add(axesGroup);
}

// ============================================================
// Clear any existing orbital geometry from the scene.
// Called by both build functions before constructing new geometry.
// ============================================================
function clearOrbitalGeometry() {
  if (pointCloud) {
    scene.remove(pointCloud);
    pointCloud.geometry.dispose();
    pointCloud.material.dispose();
    pointCloud = null;
  }
  if (isoMesh) {
    scene.remove(isoMesh);
    isoMesh.geometry.dispose();
    isoMesh.material.dispose();
    isoMesh = null;
  }
  volumeRenderer.dispose();
}

// ============================================================
// Build the orbital
// ============================================================
let pointCloud = null;

function buildOrbital(n, l, m, sampleCount = POINT_COUNT) {
  clearOrbitalGeometry();

  const data = samplePoints(n, l, m, sampleCount);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));

  const material = new THREE.PointsMaterial({
    size: POINT_SIZE,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  pointCloud = new THREE.Points(geometry, material);
  scene.add(pointCloud);

  const distance = data.extent * 2.4;
  camera.position.set(distance * 0.7, distance * 0.5, distance * 0.9);
  controls.target.set(0, 0, 0);
  controls.update();

  // Rebuild axes for the new orbital scale
  scene.remove(axesGroup);
  axesGroup = buildAxes(data.extent * 1.1);
  scene.add(axesGroup);

}

// ============================================================
// UI wiring
// ============================================================
const orbitalSelect = document.getElementById("orbital-select");
const sampleSlider = document.getElementById("sample-count");
const sampleValue = document.getElementById("sample-count-value");
const readout = document.getElementById("readout");

ORBITAL_LIST.forEach((o, idx) => {
  const opt = document.createElement("option");
  opt.value = idx;
  opt.textContent = o.label;
  orbitalSelect.appendChild(opt);
});

// Create the radial distribution plot
const radialPlot = new RadialPlot("#plot-container");
const slicePlot = new SlicePlot("#slice-container");
const slicePlane = new SlicePlaneIndicator(scene);

let currentIdx = 2;
let currentSamples = 20000;
orbitalSelect.value = currentIdx;
let currentMode = "isosurface";     // "isosurface" or "points"
let currentIsoPercent = 18;          // 3 to 50 — used as a percentage
let sliceAxis = "z";          // perpendicular to the slice plane
let slicePositionT = 0;        // -1 to +1; multiplied by orbital extent
let compareIdx = -1;             // -1 means comparison is off
let compareIsoMesh = null;       // separate mesh for the comparison orbital
let comparePointCloud = null;

function updateReadout() {
  const o = ORBITAL_LIST[currentIdx];
  readout.textContent = `n=${o.n}, l=${o.l}, m=${o.m >= 0 ? " " + o.m : o.m}`;
}

// ----- Render mode toggle -----
const modeButtons = document.querySelectorAll("#mode-row .mode-btn");
const isoControls = document.getElementById("iso-controls");
const pointControls = document.getElementById("point-controls");
const isoSlider = document.getElementById("iso-threshold");
const isoValue = document.getElementById("iso-threshold-value");

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    if (mode === currentMode) return;

    currentMode = mode;

    // Update button styling
    modeButtons.forEach((b) => b.classList.toggle("active", b === btn));

    // Show/hide the appropriate sliders
    isoControls.style.display = mode === "isosurface" ? "" : "none";
    pointControls.style.display = mode === "points" ? "" : "none";

    rebuild();
  });
});

// ----- Slice axis buttons -----
const sliceAxisRow = document.getElementById("slice-axis-row");
sliceAxisRow.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    sliceAxis = btn.dataset.sliceAxis;
    sliceAxisRow.querySelectorAll(".mode-btn").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    updateSlice();
  });
});

// ----- Slice position slider -----
const sliceSlider = document.getElementById("slice-position");
const sliceValueDisplay = document.getElementById("slice-position-value");

sliceSlider.addEventListener("input", (e) => {
  slicePositionT = parseFloat(e.target.value);
  sliceValueDisplay.textContent = slicePositionT.toFixed(2);
  updateSlice();
});

// ----- Isosurface threshold slider -----
isoSlider.addEventListener("input", (e) => {
  currentIsoPercent = parseInt(e.target.value, 10);
  isoValue.textContent = currentIsoPercent + "%";
});

isoSlider.addEventListener("change", () => {
  if (currentMode === "isosurface") rebuild();
});

function rebuild() {
  const o = ORBITAL_LIST[currentIdx];
  if (currentMode === "isosurface") {
    buildIsosurface(o.n, o.l, o.m, currentIsoPercent / 100);
  } else if (currentMode === "volume") {
    buildVolume(o.n, o.l, o.m);
  } else {
    buildOrbital(o.n, o.l, o.m, currentSamples);
  }
  radialPlot.render(o.n, o.l);
  updateSlice();
  updateReadout();
}

function updateSlice() {
  const o = ORBITAL_LIST[currentIdx];
  const extent = orbitalScale(o.n);
  const position = slicePositionT * extent * 0.9;   // 90% so plane stays within the box
  slicePlot.render(o.n, o.l, o.m, sliceAxis, position);
  slicePlane.update(sliceAxis, position, extent * 0.9);
}

orbitalSelect.addEventListener("change", (e) => {
  currentIdx = parseInt(e.target.value, 10);
  rebuild();
});

sampleSlider.addEventListener("input", (e) => {
  currentSamples = parseInt(e.target.value, 10);
  sampleValue.textContent = currentSamples.toLocaleString();
});

sampleSlider.addEventListener("change", () => {
  rebuild();
});

rebuild();

// ============================================================
// Resize + animation loop
// ============================================================
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const o = ORBITAL_LIST[currentIdx];
    radialPlot.render(o.n, o.l);
    updateSlice();
  }
}

function tick() {
  resize();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// ============================================================
// Debug helpers
// ============================================================
window.buildOrbital = buildOrbital;
window.ORBITAL_LIST = ORBITAL_LIST;

console.log(" Orbital visualiser ready with UI");