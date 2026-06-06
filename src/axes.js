// axes.js — Coloured X/Y/Z axes with text labels
//
// Three.js doesn't have built-in text rendering, so we draw each
// label on a 2D canvas, turn it into a texture, then put it on a
// flat "sprite" that always faces the camera.

import * as THREE from "three";

const COLORS = {
  x: 0xff5d5d,   // red
  y: 0x7dd87d,   // green
  z: 0x5dc4ff,   // blue
};

function makeLabel(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.font = "bold 80px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 1.5, 1);
  return sprite;
}

function makeAxisLine(start, end, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: false,
    opacity: 2,
  });
  return new THREE.Line(geometry, material);
}

export function buildAxes(length = 10) {
  const group = new THREE.Group();

  // X axis (red)
  group.add(makeAxisLine(
    new THREE.Vector3(-length, 0, 0),
    new THREE.Vector3( length, 0, 0),
    COLORS.x
  ));
  const labelX = makeLabel("X", COLORS.x);
  labelX.position.set(length + 0.8, 0, 0);
  group.add(labelX);

  // Y axis (green)
  group.add(makeAxisLine(
    new THREE.Vector3(0, -length, 0),
    new THREE.Vector3(0,  length, 0),
    COLORS.y
  ));
  const labelY = makeLabel("Y", COLORS.y);
  labelY.position.set(0, length + 0.8, 0);
  group.add(labelY);

  // Z axis (blue)
  group.add(makeAxisLine(
    new THREE.Vector3(0, 0, -length),
    new THREE.Vector3(0, 0,  length),
    COLORS.z
  ));
  const labelZ = makeLabel("Z", COLORS.z);
  labelZ.position.set(0, 0, length + 0.8);
  group.add(labelZ);

  return group;
}