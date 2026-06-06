// marchingCubes.js — Lorensen & Cline (1987) marching cubes algorithm
//
// Given a 3D scalar field f(x,y,z) and a threshold value, this module
// extracts a triangle mesh approximating the surface where f = threshold.
//
// We use SIGNED values (positive vs negative), and extract the surface
// where |f| = threshold. This naturally handles the phase of the
// wavefunction: positive lobes and negative lobes both yield a surface,
// and we tag each triangle with the sign so we can colour them.
//
// References:
//   Lorensen & Cline (1987) "Marching Cubes: A High Resolution 3D
//   Surface Construction Algorithm". The 256-entry edge table and
//   triangle table below are the canonical ones from that paper.

// =================================================================
// Lookup tables (these are the heart of the algorithm)
// =================================================================

// EDGE_TABLE: for each of 256 corner configurations, a bitfield
// telling us which of the 12 cube edges are intersected by the surface.
// prettier-ignore
const EDGE_TABLE = new Uint16Array([
  0x0  , 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
  0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x99 , 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
  0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  0x230, 0x339, 0x33 , 0x13a, 0x636, 0x73f, 0x435, 0x53c,
  0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
  0x3a0, 0x2a9, 0x1a3, 0xaa , 0x7a6, 0x6af, 0x5a5, 0x4ac,
  0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
  0x460, 0x569, 0x663, 0x76a, 0x66 , 0x16f, 0x265, 0x36c,
  0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
  0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff , 0x3f5, 0x2fc,
  0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
  0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55 , 0x15c,
  0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc ,
  0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
  0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
  0xcc , 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
  0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
  0x15c, 0x55 , 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
  0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
  0x2fc, 0x3f5, 0xff , 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
  0x36c, 0x265, 0x16f, 0x66 , 0x76a, 0x663, 0x569, 0x460,
  0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
  0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa , 0x1a3, 0x2a9, 0x3a0,
  0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
  0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33 , 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
  0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99 , 0x190,
  0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
  0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0
]);

// TRI_TABLE: for each of 256 corner configurations, up to 16 entries
// giving edge indices to connect into triangles, terminated by -1.
// prettier-ignore
const TRI_TABLE = [
  [-1],[0,8,3,-1],[0,1,9,-1],[1,8,3,9,8,1,-1],
  [1,2,10,-1],[0,8,3,1,2,10,-1],[9,2,10,0,2,9,-1],[2,8,3,2,10,8,10,9,8,-1],
  [3,11,2,-1],[0,11,2,8,11,0,-1],[1,9,0,2,3,11,-1],[1,11,2,1,9,11,9,8,11,-1],
  [3,10,1,11,10,3,-1],[0,10,1,0,8,10,8,11,10,-1],[3,9,0,3,11,9,11,10,9,-1],[9,8,10,10,8,11,-1],
  [4,7,8,-1],[4,3,0,7,3,4,-1],[0,1,9,8,4,7,-1],[4,1,9,4,7,1,7,3,1,-1],
  [1,2,10,8,4,7,-1],[3,4,7,3,0,4,1,2,10,-1],[9,2,10,9,0,2,8,4,7,-1],[2,10,9,2,9,7,2,7,3,7,9,4,-1],
  [8,4,7,3,11,2,-1],[11,4,7,11,2,4,2,0,4,-1],[9,0,1,8,4,7,2,3,11,-1],[4,7,11,9,4,11,9,11,2,9,2,1,-1],
  [3,10,1,3,11,10,7,8,4,-1],[1,11,10,1,4,11,1,0,4,7,11,4,-1],[4,7,8,9,0,11,9,11,10,11,0,3,-1],[4,7,11,4,11,9,9,11,10,-1],
  [9,5,4,-1],[9,5,4,0,8,3,-1],[0,5,4,1,5,0,-1],[8,5,4,8,3,5,3,1,5,-1],
  [1,2,10,9,5,4,-1],[3,0,8,1,2,10,4,9,5,-1],[5,2,10,5,4,2,4,0,2,-1],[2,10,5,3,2,5,3,5,4,3,4,8,-1],
  [9,5,4,2,3,11,-1],[0,11,2,0,8,11,4,9,5,-1],[0,5,4,0,1,5,2,3,11,-1],[2,1,5,2,5,8,2,8,11,4,8,5,-1],
  [10,3,11,10,1,3,9,5,4,-1],[4,9,5,0,8,1,8,10,1,8,11,10,-1],[5,4,0,5,0,11,5,11,10,11,0,3,-1],[5,4,8,5,8,10,10,8,11,-1],
  [9,7,8,5,7,9,-1],[9,3,0,9,5,3,5,7,3,-1],[0,7,8,0,1,7,1,5,7,-1],[1,5,3,3,5,7,-1],
  [9,7,8,9,5,7,10,1,2,-1],[10,1,2,9,5,0,5,3,0,5,7,3,-1],[8,0,2,8,2,5,8,5,7,10,5,2,-1],[2,10,5,2,5,3,3,5,7,-1],
  [7,9,5,7,8,9,3,11,2,-1],[9,5,7,9,7,2,9,2,0,2,7,11,-1],[2,3,11,0,1,8,1,7,8,1,5,7,-1],[11,2,1,11,1,7,7,1,5,-1],
  [9,5,8,8,5,7,10,1,3,10,3,11,-1],[5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1],[11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1],[11,10,5,7,11,5,-1],
  [10,6,5,-1],[0,8,3,5,10,6,-1],[9,0,1,5,10,6,-1],[1,8,3,1,9,8,5,10,6,-1],
  [1,6,5,2,6,1,-1],[1,6,5,1,2,6,3,0,8,-1],[9,6,5,9,0,6,0,2,6,-1],[5,9,8,5,8,2,5,2,6,3,2,8,-1],
  [2,3,11,10,6,5,-1],[11,0,8,11,2,0,10,6,5,-1],[0,1,9,2,3,11,5,10,6,-1],[5,10,6,1,9,2,9,11,2,9,8,11,-1],
  [6,3,11,6,5,3,5,1,3,-1],[0,8,11,0,11,5,0,5,1,5,11,6,-1],[3,11,6,0,3,6,0,6,5,0,5,9,-1],[6,5,9,6,9,11,11,9,8,-1],
  [5,10,6,4,7,8,-1],[4,3,0,4,7,3,6,5,10,-1],[1,9,0,5,10,6,8,4,7,-1],[10,6,5,1,9,7,1,7,3,7,9,4,-1],
  [6,1,2,6,5,1,4,7,8,-1],[1,2,5,5,2,6,3,0,4,3,4,7,-1],[8,4,7,9,0,5,0,6,5,0,2,6,-1],[7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1],
  [3,11,2,7,8,4,10,6,5,-1],[5,10,6,4,7,2,4,2,0,2,7,11,-1],[0,1,9,4,7,8,2,3,11,5,10,6,-1],[9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1],
  [8,4,7,3,11,5,3,5,1,5,11,6,-1],[5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1],[0,5,9,0,6,5,0,3,6,11,6,3,8,4,7,-1],[6,5,9,6,9,11,4,7,9,7,11,9,-1],
  [10,4,9,6,4,10,-1],[4,10,6,4,9,10,0,8,3,-1],[10,0,1,10,6,0,6,4,0,-1],[8,3,1,8,1,6,8,6,4,6,1,10,-1],
  [1,4,9,1,2,4,2,6,4,-1],[3,0,8,1,2,9,2,4,9,2,6,4,-1],[0,2,4,4,2,6,-1],[8,3,2,8,2,4,4,2,6,-1],
  [10,4,9,10,6,4,11,2,3,-1],[0,8,2,2,8,11,4,9,10,4,10,6,-1],[3,11,2,0,1,6,0,6,4,6,1,10,-1],[6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1],
  [9,6,4,9,3,6,9,1,3,11,6,3,-1],[8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1],[3,11,6,3,6,0,0,6,4,-1],[6,4,8,11,6,8,-1],
  [7,10,6,7,8,10,8,9,10,-1],[0,7,3,0,10,7,0,9,10,6,7,10,-1],[10,6,7,1,10,7,1,7,8,1,8,0,-1],[10,6,7,10,7,1,1,7,3,-1],
  [1,2,6,1,6,8,1,8,9,8,6,7,-1],[2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1],[7,8,0,7,0,6,6,0,2,-1],[7,3,2,6,7,2,-1],
  [2,3,11,10,6,8,10,8,9,8,6,7,-1],[2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1],[1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1],[11,2,1,11,1,7,10,6,1,6,7,1,-1],
  [8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1],[0,9,1,11,6,7,-1],[7,8,0,7,0,6,3,11,0,11,6,0,-1],[7,11,6,-1],
  [7,6,11,-1],[3,0,8,11,7,6,-1],[0,1,9,11,7,6,-1],[8,1,9,8,3,1,11,7,6,-1],
  [10,1,2,6,11,7,-1],[1,2,10,3,0,8,6,11,7,-1],[2,9,0,2,10,9,6,11,7,-1],[6,11,7,2,10,3,10,8,3,10,9,8,-1],
  [7,2,3,6,2,7,-1],[7,0,8,7,6,0,6,2,0,-1],[2,7,6,2,3,7,0,1,9,-1],[1,6,2,1,8,6,1,9,8,8,7,6,-1],
  [10,7,6,10,1,7,1,3,7,-1],[10,7,6,1,7,10,1,8,7,1,0,8,-1],[0,3,7,0,7,10,0,10,9,6,10,7,-1],[7,6,10,7,10,8,8,10,9,-1],
  [6,8,4,11,8,6,-1],[3,6,11,3,0,6,0,4,6,-1],[8,6,11,8,4,6,9,0,1,-1],[9,4,6,9,6,3,9,3,1,11,3,6,-1],
  [6,8,4,6,11,8,2,10,1,-1],[1,2,10,3,0,11,0,6,11,0,4,6,-1],[4,11,8,4,6,11,0,2,9,2,10,9,-1],[10,9,3,10,3,2,9,4,3,11,3,6,4,6,3,-1],
  [8,2,3,8,4,2,4,6,2,-1],[0,4,2,4,6,2,-1],[1,9,0,2,3,4,2,4,6,4,3,8,-1],[1,9,4,1,4,2,2,4,6,-1],
  [8,1,3,8,6,1,8,4,6,6,10,1,-1],[10,1,0,10,0,6,6,0,4,-1],[4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1],[10,9,4,6,10,4,-1],
  [4,9,5,7,6,11,-1],[0,8,3,4,9,5,11,7,6,-1],[5,0,1,5,4,0,7,6,11,-1],[11,7,6,8,3,4,3,5,4,3,1,5,-1],
  [9,5,4,10,1,2,7,6,11,-1],[6,11,7,1,2,10,0,8,3,4,9,5,-1],[7,6,11,5,4,10,4,2,10,4,0,2,-1],[3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1],
  [7,2,3,7,6,2,5,4,9,-1],[9,5,4,0,8,6,0,6,2,6,8,7,-1],[3,6,2,3,7,6,1,5,0,5,4,0,-1],[6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1],
  [9,5,4,10,1,6,1,7,6,1,3,7,-1],[1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1],[4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,-1],[7,6,10,7,10,8,5,4,10,4,8,10,-1],
  [6,9,5,6,11,9,11,8,9,-1],[3,6,11,0,6,3,0,5,6,0,9,5,-1],[0,11,8,0,5,11,0,1,5,5,6,11,-1],[6,11,3,6,3,5,5,3,1,-1],
  [1,2,10,9,5,11,9,11,8,11,5,6,-1],[0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1],[11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1],[6,11,3,6,3,5,2,10,3,10,5,3,-1],
  [5,8,9,5,2,8,5,6,2,3,8,2,-1],[9,5,6,9,6,0,0,6,2,-1],[1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1],[1,5,6,2,1,6,-1],
  [1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1],[10,1,0,10,0,6,9,5,0,5,6,0,-1],[0,3,8,5,6,10,-1],[10,5,6,-1],
  [11,5,10,7,5,11,-1],[11,5,10,11,7,5,8,3,0,-1],[5,11,7,5,10,11,1,9,0,-1],[10,7,5,10,11,7,9,8,1,8,3,1,-1],
  [11,1,2,11,7,1,7,5,1,-1],[0,8,3,1,2,7,1,7,5,7,2,11,-1],[9,7,5,9,2,7,9,0,2,2,11,7,-1],[7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1],
  [2,5,10,2,3,5,3,7,5,-1],[8,2,0,8,5,2,8,7,5,10,2,5,-1],[9,0,1,5,10,3,5,3,7,3,10,2,-1],[9,8,2,9,2,1,8,7,2,10,2,5,7,5,2,-1],
  [1,3,5,3,7,5,-1],[0,8,7,0,7,1,1,7,5,-1],[9,0,3,9,3,5,5,3,7,-1],[9,8,7,5,9,7,-1],
  [5,8,4,5,10,8,10,11,8,-1],[5,0,4,5,11,0,5,10,11,11,3,0,-1],[0,1,9,8,4,10,8,10,11,10,4,5,-1],[10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1],
  [2,5,1,2,8,5,2,11,8,4,5,8,-1],[0,4,11,0,11,3,4,5,11,2,11,1,5,1,11,-1],[0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1],[9,4,5,2,11,3,-1],
  [2,5,10,3,5,2,3,4,5,3,8,4,-1],[5,10,2,5,2,4,4,2,0,-1],[3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1],[5,10,2,5,2,4,1,9,2,9,4,2,-1],
  [8,4,5,8,5,3,3,5,1,-1],[0,4,5,1,0,5,-1],[8,4,5,8,5,3,9,0,5,0,3,5,-1],[9,4,5,-1],
  [4,11,7,4,9,11,9,10,11,-1],[0,8,3,4,9,7,9,11,7,9,10,11,-1],[1,10,11,1,11,4,1,4,0,7,4,11,-1],[3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1],
  [4,11,7,9,11,4,9,2,11,9,1,2,-1],[9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1],[11,7,4,11,4,2,2,4,0,-1],[11,7,4,11,4,2,8,3,4,3,2,4,-1],
  [2,9,10,2,7,9,2,3,7,7,4,9,-1],[9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1],[3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1],[1,10,2,8,7,4,-1],
  [4,9,1,4,1,7,7,1,3,-1],[4,9,1,4,1,7,0,8,1,8,7,1,-1],[4,0,3,7,4,3,-1],[4,8,7,-1],
  [9,10,8,10,11,8,-1],[3,0,9,3,9,11,11,9,10,-1],[0,1,10,0,10,8,8,10,11,-1],[3,1,10,11,3,10,-1],
  [1,2,11,1,11,9,9,11,8,-1],[3,0,9,3,9,11,1,2,9,2,11,9,-1],[0,2,11,8,0,11,-1],[3,2,11,-1],
  [2,3,8,2,8,10,10,8,9,-1],[9,10,2,0,9,2,-1],[2,3,8,2,8,10,0,1,8,1,10,8,-1],[1,10,2,-1],
  [1,3,8,9,1,8,-1],[0,9,1,-1],[0,3,8,-1],[-1]
];

// =================================================================
// The algorithm
// =================================================================

/**
 * Run marching cubes on a 3D scalar field and produce a mesh.
 *
 * @param {Object} opts
 * @param {Function} opts.field  Function f(x,y,z) -> signed real value
 * @param {number} opts.size     Grid size per axis (e.g. 48 means 48^3)
 * @param {number} opts.extent   The field is sampled over [-extent, +extent] in each axis
 * @param {number} opts.threshold  |f| value defining the isosurface
 * @returns {Object}  { positions, normals, signs }
 *   positions: Float32Array of vertex positions (3 floats per vertex)
 *   normals:   Float32Array of vertex normals (3 floats per vertex)
 *   signs:     Float32Array of sign markers (1 float per vertex, +1 or -1)
 *              All three vertices of a triangle share the same sign.
 */
export function marchingCubes({ field, size, extent, threshold }) {
  const N = size;
  const step = (2 * extent) / N;

  // 1. Sample the field on the grid, storing signed values.
  //    samples[i + j*N + k*N*N] = f(x_i, y_j, z_k)
  const samples = new Float32Array(N * N * N);
  for (let k = 0; k < N; k++) {
    const z = -extent + k * step;
    for (let j = 0; j < N; j++) {
      const y = -extent + j * step;
      for (let i = 0; i < N; i++) {
        const x = -extent + i * step;
        samples[i + j * N + k * N * N] = field(x, y, z);
      }
    }
  }

  const positions = [];
  const signs = [];

  // Helper: linearly interpolate the position where the surface crosses an edge
  function vertexInterp(iso, p1, p2, v1, v2) {
    if (Math.abs(iso - v1) < 1e-6) return [p1[0], p1[1], p1[2]];
    if (Math.abs(iso - v2) < 1e-6) return [p2[0], p2[1], p2[2]];
    if (Math.abs(v1 - v2)  < 1e-6) return [p1[0], p1[1], p1[2]];
    const t = (iso - v1) / (v2 - v1);
    return [
      p1[0] + t * (p2[0] - p1[0]),
      p1[1] + t * (p2[1] - p1[1]),
      p1[2] + t * (p2[2] - p1[2]),
    ];
  }

  // For each cube, run marching cubes against BOTH +threshold and -threshold.
  // This catches positive lobes and negative lobes separately.
  function processCube(i, j, k, iso, sign) {
    const x0 = -extent + i * step;
    const y0 = -extent + j * step;
    const z0 = -extent + k * step;

    // 8 corner positions
    const corners = [
      [x0,        y0,        z0       ],
      [x0 + step, y0,        z0       ],
      [x0 + step, y0 + step, z0       ],
      [x0,        y0 + step, z0       ],
      [x0,        y0,        z0 + step],
      [x0 + step, y0,        z0 + step],
      [x0 + step, y0 + step, z0 + step],
      [x0,        y0 + step, z0 + step],
    ];

    // 8 corner values (multiplied by sign so we can compare against +iso)
    const idx = i + j * N + k * N * N;
    const stride = 1;
    const strideY = N;
    const strideZ = N * N;
    const v = [
      sign * samples[idx                              ],
      sign * samples[idx + stride                     ],
      sign * samples[idx + stride + strideY           ],
      sign * samples[idx          + strideY           ],
      sign * samples[idx                    + strideZ ],
      sign * samples[idx + stride           + strideZ ],
      sign * samples[idx + stride + strideY + strideZ ],
      sign * samples[idx          + strideY + strideZ ],
    ];

    // Build cube index from which corners are above iso
    let cubeIdx = 0;
    if (v[0] < iso) cubeIdx |= 1;
    if (v[1] < iso) cubeIdx |= 2;
    if (v[2] < iso) cubeIdx |= 4;
    if (v[3] < iso) cubeIdx |= 8;
    if (v[4] < iso) cubeIdx |= 16;
    if (v[5] < iso) cubeIdx |= 32;
    if (v[6] < iso) cubeIdx |= 64;
    if (v[7] < iso) cubeIdx |= 128;

    const edges = EDGE_TABLE[cubeIdx];
    if (edges === 0) return;

    // Find vertex positions on each intersected edge
    const vList = new Array(12);
    if (edges & 1)    vList[0]  = vertexInterp(iso, corners[0], corners[1], v[0], v[1]);
    if (edges & 2)    vList[1]  = vertexInterp(iso, corners[1], corners[2], v[1], v[2]);
    if (edges & 4)    vList[2]  = vertexInterp(iso, corners[2], corners[3], v[2], v[3]);
    if (edges & 8)    vList[3]  = vertexInterp(iso, corners[3], corners[0], v[3], v[0]);
    if (edges & 16)   vList[4]  = vertexInterp(iso, corners[4], corners[5], v[4], v[5]);
    if (edges & 32)   vList[5]  = vertexInterp(iso, corners[5], corners[6], v[5], v[6]);
    if (edges & 64)   vList[6]  = vertexInterp(iso, corners[6], corners[7], v[6], v[7]);
    if (edges & 128)  vList[7]  = vertexInterp(iso, corners[7], corners[4], v[7], v[4]);
    if (edges & 256)  vList[8]  = vertexInterp(iso, corners[0], corners[4], v[0], v[4]);
    if (edges & 512)  vList[9]  = vertexInterp(iso, corners[1], corners[5], v[1], v[5]);
    if (edges & 1024) vList[10] = vertexInterp(iso, corners[2], corners[6], v[2], v[6]);
    if (edges & 2048) vList[11] = vertexInterp(iso, corners[3], corners[7], v[3], v[7]);

    // Emit triangles using the triangle table
    const tri = TRI_TABLE[cubeIdx];
    for (let t = 0; t < tri.length; t += 3) {
      if (tri[t] === -1) break;
      const a = vList[tri[t]];
      const b = vList[tri[t + 1]];
      const c = vList[tri[t + 2]];
      positions.push(a[0], a[1], a[2],  b[0], b[1], b[2],  c[0], c[1], c[2]);
      signs.push(sign, sign, sign);
    }
  }

  // Iterate over every cube. The last cube ends at index N-2.
  for (let k = 0; k < N - 1; k++) {
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        processCube(i, j, k, threshold,  +1);  // positive lobes
        processCube(i, j, k, threshold,  -1);  // negative lobes
      }
    }
  }

  // 3. Compute per-vertex normals by computing the gradient of f at each vertex.
  //    We use central differences against the field directly (more accurate
  //    than averaging triangle face normals).
  const positionsArr = new Float32Array(positions);
  const signsArr = new Float32Array(signs);
  const normalsArr = new Float32Array(positionsArr.length);

  const h = step * 0.5;
  for (let v = 0; v < positionsArr.length; v += 3) {
    const x = positionsArr[v];
    const y = positionsArr[v + 1];
    const z = positionsArr[v + 2];
    const s = signsArr[v / 3];

    // Gradient of |f| points OUTWARD from the lobe interior.
    // For a positive lobe, gradient of f points outward (since f decreases away).
    // For a negative lobe, we want gradient of -f.
    // The sign factor handles this naturally.
    let gx = field(x + h, y, z) - field(x - h, y, z);
    let gy = field(x, y + h, z) - field(x, y - h, z);
    let gz = field(x, y, z + h) - field(x, y, z - h);
    gx *= s; gy *= s; gz *= s;

    // We want the outward normal — point AWAY from where the field is larger.
    // The gradient points toward increasing field; we negate it.
    const len = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    normalsArr[v]     = -gx / len;
    normalsArr[v + 1] = -gy / len;
    normalsArr[v + 2] = -gz / len;
  }

  return {
    positions: positionsArr,
    normals: normalsArr,
    signs: signsArr,
  };
}