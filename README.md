# Hydrogen Orbital Visualiser

An interactive 3D visualisation of hydrogen atomic orbitals, built for students new to quantum chemistry.

**Live demo:** *(will be added after deployment)*

Built for COSC3000 Visualisation, Computer Graphics & Data Analysis at the University of Queensland, Semester 1, 2026.

## What it does

The tool lets you choose any hydrogen orbital up to n = 3 and view it three complementary ways:

- **Volume rendering** — a soft glowing probability cloud, ray-marched on the GPU
- **Isosurface** — a solid surface extracted with marching cubes at a chosen probability threshold
- **Point cloud** — Monte Carlo samples drawn from the probability density

Alongside the 3D view, two synchronised 2D plots show:

- The radial distribution function 4πr²|R(r)|², revealing the most probable radius and any radial nodes
- A 2D contour of the wavefunction on a chosen slicing plane, exposing angular nodes and phase boundaries

Positive and negative phase regions are coloured blue and red consistently across all views, so that the sign of the wavefunction — which governs chemical bonding — is visible at a glance.

## Running locally

Requires Node.js 20+ and npm.

\`\`\`bash
npm install
npm run dev
\`\`\`

Open the printed URL (typically `http://localhost:5173`) in any modern browser.

## Building for production

\`\`\`bash
npm run build
\`\`\`

The static site is emitted to `dist/`.

## Technologies

- [Three.js](https://threejs.org/) for the 3D scene, with custom GLSL shaders for the volume renderer
- [D3.js](https://d3js.org/) for the 2D plots
- [Vite](https://vitejs.dev/) for the dev server and production build
- Marching cubes (Lorensen & Cline, 1987) implemented from scratch

## Project structure

\`\`\`
src/
├── main.js           # entry point and UI wiring
├── orbital.js        # hydrogen wavefunctions for n = 1, 2, 3
├── marchingCubes.js  # isosurface extraction
├── volumeRender.js   # GPU volume renderer (Three.js + GLSL)
├── radialPlot.js     # radial distribution function plot
├── slicePlot.js      # 2D slice contour plot
├── slicePlane.js     # 3D slice plane indicator
├── axes.js           # labelled X/Y/Z axes
└── style.css         # layout and theming
\`\`\`

## Author

Manav Sachdeva — Software Engineering, University of Queensland.