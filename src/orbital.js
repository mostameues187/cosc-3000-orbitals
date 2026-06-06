// orbital.js — Hydrogen atom wavefunctions ψ_{n,l,m}(r, θ, φ)
//
// All values are in atomic units (Bohr radii). To convert to picometres,
// multiply distances by 52.9.
//
// We use REAL spherical harmonics, which give the familiar p_x / p_y / p_z
// and d_xy / d_xz / d_yz / d_x²-y² / d_z² orientations. The trade-off is
// that m here is not the true magnetic quantum number — it's a real linear
// combination of the complex ±m states, but it's the convention used in
// every chemistry textbook.

// ---------------------------------------------------------------
// Radial parts R_{n,l}(r) — hard-coded closed-form solutions
//
// Source: Griffiths, Introduction to Quantum Mechanics, 3rd ed., Table 4.7
// (with the normalisation that ∫|R|² r² dr = 1 over r ∈ [0, ∞))
// ---------------------------------------------------------------
export function radialPart(n, l, r) {
  // Each formula is the closed-form solution for that (n, l) pair.
  // Z = 1 (hydrogen). a_0 = 1 in atomic units.

  if (n === 1 && l === 0) {
    // 1s
    return 2 * Math.exp(-r);
  }
  if (n === 2 && l === 0) {
    // 2s — note the (2 - r) factor introduces one radial node at r = 2
    return (1 / Math.sqrt(8)) * (2 - r) * Math.exp(-r / 2);
  }
  if (n === 2 && l === 1) {
    // 2p
    return (1 / Math.sqrt(24)) * r * Math.exp(-r / 2);
  }
  if (n === 3 && l === 0) {
    // 3s — two radial nodes
    return (2 / (81 * Math.sqrt(3))) * (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3);
  }
  if (n === 3 && l === 1) {
    // 3p — one radial node at r = 6
    return (4 / (81 * Math.sqrt(6))) * r * (6 - r) * Math.exp(-r / 3);
  }
  if (n === 3 && l === 2) {
    // 3d — no radial nodes
    return (4 / (81 * Math.sqrt(30))) * r * r * Math.exp(-r / 3);
  }

  // Not implemented yet
  return 0;
}

// ---------------------------------------------------------------
// Real spherical harmonics Y_{l,m}(θ, φ)
//
// These give angular shapes. Note the trick: cos(θ) = z/r, so we can
// pass Cartesian components directly. Same for sin(θ)cos(φ) = x/r etc.
//
// Source: standard tesseral harmonics, see e.g. Wikipedia "Table of
// spherical harmonics → Real forms"
// ---------------------------------------------------------------
function angularPart(l, m, cosT, sinT, phi) {
  const PI = Math.PI;

  if (l === 0 && m === 0) {
    // s — perfectly spherical
    return 0.5 / Math.sqrt(PI);
  }

  if (l === 1) {
    if (m === 0)  return 0.5 * Math.sqrt(3 / PI) * cosT;                    // p_z
    if (m === 1)  return 0.5 * Math.sqrt(3 / PI) * sinT * Math.cos(phi);    // p_x
    if (m === -1) return 0.5 * Math.sqrt(3 / PI) * sinT * Math.sin(phi);    // p_y
  }

  if (l === 2) {
    if (m === 0)  return 0.25 * Math.sqrt(5 / PI) * (3 * cosT * cosT - 1);  // d_z²
    if (m === 1)  return 0.5 * Math.sqrt(15 / PI) * sinT * cosT * Math.cos(phi);     // d_xz
    if (m === -1) return 0.5 * Math.sqrt(15 / PI) * sinT * cosT * Math.sin(phi);     // d_yz
    if (m === 2)  return 0.25 * Math.sqrt(15 / PI) * sinT * sinT * Math.cos(2 * phi); // d_x²-y²
    if (m === -2) return 0.25 * Math.sqrt(15 / PI) * sinT * sinT * Math.sin(2 * phi); // d_xy
  }

  return 0;
}

// ---------------------------------------------------------------
// Main exported function: ψ_{n,l,m}(x, y, z)
//
// Returns a real number — positive or negative depending on the phase
// of the lobe. |psi|² gives probability density.
// ---------------------------------------------------------------
export function psi(n, l, m, x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-9) {
    // Origin singularity — only s orbitals are finite at r=0, and we can
    // safely return their limiting value. For l > 0, ψ = 0 at the origin.
    if (l === 0) return radialPart(n, l, 0) * angularPart(0, 0, 1, 0, 0);
    return 0;
  }

  const cosT = z / r;
  // Numerical safety: clamp cos(θ) into [-1, 1] in case of fp drift
  const cosTc = Math.max(-1, Math.min(1, cosT));
  const sinT = Math.sqrt(Math.max(0, 1 - cosTc * cosTc));
  const phi = Math.atan2(y, x);

  const R = radialPart(n, l, r);
  const Y = angularPart(l, m, cosTc, sinT, phi);

  return R * Y;
}

// ---------------------------------------------------------------
// Probability density |ψ|² — what we visualise
// ---------------------------------------------------------------
export function probabilityDensity(n, l, m, x, y, z) {
  const v = psi(n, l, m, x, y, z);
  return v * v;
}

// ---------------------------------------------------------------
// Typical extent of the orbital, used by the renderer to frame
// the camera and decide a sensible sampling volume.
//
// Mean radius of an electron in level n is roughly n² · a_0 (in atomic
// units, a_0 = 1). We multiply by ~4 to capture most of the tail.
// ---------------------------------------------------------------
export function orbitalScale(n) {
  return Math.max(6, n * n * 4);
}

// ---------------------------------------------------------------
// List of orbitals available in this module, for the UI dropdown.
// ---------------------------------------------------------------
export const ORBITAL_LIST = [
  { n: 1, l: 0, m:  0, label: "1s"        },
  { n: 2, l: 0, m:  0, label: "2s"        },
  { n: 2, l: 1, m:  0, label: "2p_z"      },
  { n: 2, l: 1, m:  1, label: "2p_x"      },
  { n: 2, l: 1, m: -1, label: "2p_y"      },
  { n: 3, l: 0, m:  0, label: "3s"        },
  { n: 3, l: 1, m:  0, label: "3p_z"      },
  { n: 3, l: 2, m:  0, label: "3d_z²"     },
  { n: 3, l: 2, m:  1, label: "3d_xz"     },
  { n: 3, l: 2, m: -1, label: "3d_yz"     },
  { n: 3, l: 2, m:  2, label: "3d_x²−y²" },
  { n: 3, l: 2, m: -2, label: "3d_xy"     },
];