// slicePlot.js — 2D contour plot of the wavefunction on a chosen plane
//
// Given an orbital and a slicing plane (e.g. z = 2), this module
// samples the wavefunction on a 2D grid in that plane and draws a
// filled contour plot using D3.
//
// Positive ψ regions are coloured blue, negative red. Nodes (ψ = 0)
// appear as the boundary between blue and red regions, or between
// coloured regions and the empty background.

import * as d3 from "d3";
import { psi, orbitalScale } from "./orbital.js";

// ----- Configuration -----
const GRID = 80;                       // 80×80 sampling resolution
const MARGIN = { top: 12, right: 12, bottom: 36, left: 36 };
const N_CONTOUR_LEVELS = 12;           // contour levels per phase
const POS_COLOR = "#5dc4ff";
const NEG_COLOR = "#ff5d5d";

// ----- Sample the wavefunction on a 2D grid in the chosen plane -----
function sampleSlice(n, l, m, axis, position, extent) {
  // axis: "x", "y", or "z" — the axis perpendicular to the slice
  // position: the value at which the slice is taken on that axis
  // The 2D grid spans [-extent, +extent] in the two remaining axes.
  const values = new Float32Array(GRID * GRID);
  let maxAbs = 0;
  for (let j = 0; j < GRID; j++) {
    const v = (j / (GRID - 1)) * 2 - 1;        // -1..+1
    const b = v * extent;                       // axis coordinate
    for (let i = 0; i < GRID; i++) {
      const u = (i / (GRID - 1)) * 2 - 1;
      const a = u * extent;
      let val;
      if      (axis === "x") val = psi(n, l, m, position, a, b);
      else if (axis === "y") val = psi(n, l, m, a, position, b);
      else                    val = psi(n, l, m, a, b, position);
      values[j * GRID + i] = val;
      const av = Math.abs(val);
      if (av > maxAbs) maxAbs = av;
    }
  }
  return { values, maxAbs };
}

// ----- The plot class -----
export class SlicePlot {
  constructor(containerSelector) {
    this.container = d3.select(containerSelector);

    this.svg = this.container
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("preserveAspectRatio", "none");

    this.g = this.svg.append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Background (transparent so the panel colour shows through)
    this.bg = this.g.append("rect")
      .attr("fill", "#0a0e1a")
      .attr("opacity", 0.3);

    // Contour groups (positive and negative phases)
    this.posG = this.g.append("g").attr("class", "pos-contours");
    this.negG = this.g.append("g").attr("class", "neg-contours");

    // Axes
    this.xAxisG = this.g.append("g").attr("class", "x-axis");
    this.yAxisG = this.g.append("g").attr("class", "y-axis");

    // Axis labels
    this.xLabel = this.svg.append("text")
      .attr("class", "axis-label")
      .attr("text-anchor", "middle")
      .attr("fill", "#8a92a5")
      .attr("font-size", 11);
    this.yLabel = this.svg.append("text")
      .attr("class", "axis-label")
      .attr("text-anchor", "middle")
      .attr("fill", "#8a92a5")
      .attr("font-size", 11);

    // Title
    this.title = this.svg.append("text")
      .attr("x", MARGIN.left)
      .attr("y", MARGIN.top - 2)
      .attr("fill", "#e8eaf0")
      .attr("font-size", 12)
      .attr("font-weight", 500)
      .text("Slice through ψ");
  }

  render(n, l, m, axis, position) {
    // 1. Size
    const rect = this.container.node().getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const width = rect.width - MARGIN.left - MARGIN.right;
    const height = rect.height - MARGIN.top - MARGIN.bottom;

    const extent = orbitalScale(n);

    // 2. Sample the slice
    const { values, maxAbs } = sampleSlice(n, l, m, axis, position, extent);

    if (maxAbs < 1e-9) {
      // Slice is essentially empty (very far from the orbital)
      this.posG.selectAll("*").remove();
      this.negG.selectAll("*").remove();
      this.title.text(`Slice ${axis} = ${position.toFixed(2)}  (empty)`);
      return;
    }

    // 3. Build contour levels
    // We compute contours of |ψ| from the SIGNED data by splitting it
    // into positive-only and negative-only fields.
    const posValues = new Float32Array(values.length);
    const negValues = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      posValues[i] = v > 0 ? v : 0;
      negValues[i] = v < 0 ? -v : 0;
    }

    const levels = d3.range(1, N_CONTOUR_LEVELS + 1).map(
      i => (i / N_CONTOUR_LEVELS) * maxAbs * 0.95
    );

    const contour = d3.contours()
      .size([GRID, GRID])
      .thresholds(levels);

    const posContours = contour(posValues);
    const negContours = contour(negValues);

    // 4. Scale contour coordinates from grid space to pixel space
    const xScale = d3.scaleLinear().domain([0, GRID - 1]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, GRID - 1]).range([height, 0]);

    // Manual path generator that maps grid coords to pixel coords
    function pathFromContour(geo) {
      let path = "";
      for (const poly of geo.coordinates) {
        for (const ring of poly) {
          if (ring.length === 0) continue;
          path += "M" + ring.map(([x, y]) =>
            `${xScale(x).toFixed(1)},${yScale(y).toFixed(1)}`
          ).join("L") + "Z";
        }
      }
      return path;
    }

    // 5. Draw positive contours
    const posSel = this.posG.selectAll("path").data(posContours);
    posSel.exit().remove();
    posSel.enter().append("path")
      .merge(posSel)
      .attr("d", d => pathFromContour(d))
      .attr("fill", POS_COLOR)
      .attr("fill-opacity", (d, i) => 0.08 + 0.06 * i)
      .attr("stroke", POS_COLOR)
      .attr("stroke-width", 0.7)
      .attr("stroke-opacity", 0.6);

    // 6. Draw negative contours
    const negSel = this.negG.selectAll("path").data(negContours);
    negSel.exit().remove();
    negSel.enter().append("path")
      .merge(negSel)
      .attr("d", d => pathFromContour(d))
      .attr("fill", NEG_COLOR)
      .attr("fill-opacity", (d, i) => 0.08 + 0.06 * i)
      .attr("stroke", NEG_COLOR)
      .attr("stroke-width", 0.7)
      .attr("stroke-opacity", 0.6);

    // 7. Background rect (for the axes to sit on)
    this.bg.attr("width", width).attr("height", height);

    // 8. Axes
    const dataScale = d3.scaleLinear().domain([-extent, extent]).range([0, width]);
    const dataScaleY = d3.scaleLinear().domain([-extent, extent]).range([height, 0]);

    this.xAxisG
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(dataScale).ticks(5).tickSizeOuter(0))
      .selectAll("text").attr("fill", "#8a92a5").attr("font-size", 10);

    this.yAxisG
      .call(d3.axisLeft(dataScaleY).ticks(5).tickSizeOuter(0))
      .selectAll("text").attr("fill", "#8a92a5").attr("font-size", 10);

    this.svg.selectAll(".x-axis path, .y-axis path, .x-axis line, .y-axis line")
      .attr("stroke", "#3a4258");

    // 9. Axis labels — depend on which axes are visible in the slice
    let xLabelText, yLabelText;
    if (axis === "x")      { xLabelText = "y"; yLabelText = "z"; }
    else if (axis === "y") { xLabelText = "x"; yLabelText = "z"; }
    else                    { xLabelText = "x"; yLabelText = "y"; }

    this.xLabel
      .attr("x", MARGIN.left + width / 2)
      .attr("y", rect.height - 8)
      .text(`${xLabelText}  (Bohr radii)`);

    this.yLabel
      .attr("x", 0).attr("y", 0)
      .attr("transform",
        `translate(12, ${MARGIN.top + height / 2}) rotate(-90)`)
      .text(`${yLabelText}  (Bohr radii)`);

    // 10. Title
    this.title.text(`Slice  ${axis} = ${position.toFixed(2)}  Bohr radii`);
  }
}