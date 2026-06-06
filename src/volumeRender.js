// volumeRender.js — GPU volume rendering of the wavefunction |ψ|²

import * as THREE from "three";
import { psi, orbitalScale } from "./orbital.js";

const GRID = 64;
const STEPS = 100;
const DENSITY_SCALE = 80000;

const VERTEX_SHADER = `
varying vec3 vOrigin;
varying vec3 vDirection;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vOrigin = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vDirection = position - vOrigin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
precision highp sampler3D;

uniform sampler3D uVolume;
uniform float uSteps;
uniform float uDensityScale;
uniform float uExtent;

varying vec3 vOrigin;
varying vec3 vDirection;

vec2 boxIntersect(vec3 ro, vec3 rd) {
  vec3 invRd = 1.0 / rd;
  vec3 t0 = (-0.5 - ro) * invRd;
  vec3 t1 = ( 0.5 - ro) * invRd;
  vec3 tMin3 = min(t0, t1);
  vec3 tMax3 = max(t0, t1);
  float tMin = max(max(tMin3.x, tMin3.y), tMin3.z);
  float tMax = min(min(tMax3.x, tMax3.y), tMax3.z);
  return vec2(tMin, tMax);
}

void main() {
  vec3 ro = vOrigin;
  vec3 rd = normalize(vDirection);

  vec2 tHit = boxIntersect(ro, rd);
  if (tHit.x >= tHit.y) {
    discard;
  }

  float tStart = max(tHit.x, 0.0);
  float tEnd   = tHit.y;
  float stepSize = (tEnd - tStart) / uSteps;

  vec4 colour = vec4(0.0);

  for (float i = 0.0; i < uSteps; i += 1.0) {
    if (colour.a >= 0.98) break;

    float t = tStart + (i + 0.5) * stepSize;
    vec3 pos = ro + t * rd;
    vec3 uvw = pos + 0.5;

    float raw = texture(uVolume, uvw).r;
    float val = raw * 2.0 - 1.0;
    float density = val * val;

    vec3 posColour = vec3(0.365, 0.769, 1.000);
    vec3 negColour = vec3(1.000, 0.365, 0.365);
    vec3 sampleColour = val >= 0.0 ? posColour : negColour;

    float sampleAlpha = clamp(density * uDensityScale * stepSize, 0.0, 1.0);
    colour.rgb += (1.0 - colour.a) * sampleColour * sampleAlpha;
    colour.a   += (1.0 - colour.a) * sampleAlpha;
  }

  if (colour.a < 0.01) discard;
  gl_FragColor = colour;
}
`;

export class VolumeRenderer {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.texture = null;
  }

  build(n, l, m) {
    this._dispose();

    const extent = orbitalScale(n);
    const t0 = performance.now();

    const data = new Float32Array(GRID * GRID * GRID);
    const step = (2 * extent) / GRID;

    for (let k = 0; k < GRID; k++) {
      const z = -extent + (k + 0.5) * step;
      for (let j = 0; j < GRID; j++) {
        const y = -extent + (j + 0.5) * step;
        for (let i = 0; i < GRID; i++) {
          const x = -extent + (i + 0.5) * step;
          const v = psi(n, l, m, x, y, z);
          data[i + j * GRID + k * GRID * GRID] = (v + 1.0) * 0.5;
        }
      }
    }

    console.log(`Volume grid: ${(performance.now() - t0).toFixed(0)} ms`);

    this.texture = new THREE.Data3DTexture(data, GRID, GRID, GRID);
    this.texture.format = THREE.RedFormat;
    this.texture.type = THREE.FloatType;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.unpackAlignment = 1;
    this.texture.needsUpdate = true;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uVolume:       { value: this.texture },
        uSteps:        { value: STEPS },
        uDensityScale: { value: DENSITY_SCALE },
        uExtent:       { value: extent },
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.scale.set(extent * 2, extent * 2, extent * 2);
    this.scene.add(this.mesh);

    return extent;
  }

  _dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }

  dispose() {
    this._dispose();
  }
}