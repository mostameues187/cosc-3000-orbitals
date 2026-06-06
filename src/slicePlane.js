// slicePlane.js — A semi-transparent rectangle that shows the
// position of the active slice in the 3D scene.

import * as THREE from "three";

const PLANE_COLOR = 0xffd966;  // soft amber so it stands out against blue/red orbitals

export class SlicePlaneIndicator {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
  }

  // axis: "x", "y", or "z" — the axis perpendicular to the plane
  // position: location along that axis
  // size: half-width of the plane in the other two axes
  update(axis, position, size) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    const geom = new THREE.PlaneGeometry(2 * size, 2 * size);
    const mat = new THREE.MeshBasicMaterial({
      color: PLANE_COLOR,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geom, mat);

    // Orient the plane to be perpendicular to the chosen axis
    if (axis === "x") {
      // YZ plane at x = position — rotate so its normal points along X
      this.mesh.rotation.y = Math.PI / 2;
      this.mesh.position.set(position, 0, 0);
    } else if (axis === "y") {
      // XZ plane at y = position — rotate so its normal points along Y
      this.mesh.rotation.x = Math.PI / 2;
      this.mesh.position.set(0, position, 0);
    } else {
      // XY plane at z = position — default PlaneGeometry orientation
      this.mesh.position.set(0, 0, position);
    }

    // Add a subtle border
    const edges = new THREE.EdgesGeometry(geom);
    const lineMat = new THREE.LineBasicMaterial({
      color: PLANE_COLOR,
      transparent: true,
      opacity: 0.7,
    });
    const border = new THREE.LineSegments(edges, lineMat);
    this.mesh.add(border);

    this.scene.add(this.mesh);
  }

  remove() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}