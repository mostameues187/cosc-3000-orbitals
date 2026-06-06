// radialPlot.js — 2D radial distribution function plot
//
// Plots P(r) = 4πr²|R_{n,l}(r)|², the probability of finding the
// electron in a thin spherical shell at distance r from the nucleus.
//
// The peaks of this curve give the "most probable radii" (the
// quantum mechanical equivalent of Bohr's orbits). Zero-crossings
// of R(r) give radial nodes — spherical surfaces of zero probability.

import * as d3 from "d3";
import { radialPart, orbitalScale } from "./orbital.js";

// ----- Configuration -----
const SAMPLES = 400;          // Resolution of the curve
const MARGIN = { top: 12, right: 20, bottom: 36, left: 50 };

// ----- Compute the data -----
function computeRDF(n, l, rMax) {
  const points = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const r = (i / SAMPLES) * rMax;
    const R = radialPart(n, l, r);
    const P = 4 * Math.PI * r * r * R * R;
    points.push({ r, P, R });
  }
  return points;
}

// Find radial nodes: places where R changes sign (excluding r=0 for l>0)
function findRadialNodes(points, l) {
  const nodes = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].R;
    const b = points[i].R;
    // Look for sign change. Skip the trivial zero at r=0 for l>0 orbitals.
    if (a * b < 0 && points[i].r > 0.1) {
      // Linear interpolation to estimate node position
      const t = Math.abs(a) / (Math.abs(a) + Math.abs(b));
      const rNode = points[i - 1].r + t * (points[i].r - points[i - 1].r);
      nodes.push(rNode);
    }
  }
  return nodes;
}

// Find the peak of the RDF (most probable radius)
function findPeak(points) {
  let maxP = 0;
  let rPeak = 0;
  for (const p of points) {
    if (p.P > maxP) {
      maxP = p.P;
      rPeak = p.r;
    }
  }
  return { r: rPeak, P: maxP };
}

// ----- Build the chart -----
export class RadialPlot {
  constructor(containerSelector) {
    this.container = d3.select(containerSelector);

    // SVG that fills the container
    this.svg = this.container
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("preserveAspectRatio", "none");

    // Group for the chart, offset by margins
    this.g = this.svg.append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Axes groups (created once, updated on render)
    this.xAxisG = this.g.append("g").attr("class", "x-axis");
    this.yAxisG = this.g.append("g").attr("class", "y-axis");

    // Axis labels
    this.svg.append("text")
      .attr("class", "axis-label")
      .attr("text-anchor", "middle")
      .attr("fill", "#8a92a5")
      .attr("font-size", 11);

    this.svg.append("text")
      .attr("class", "axis-label y-axis-label")
      .attr("text-anchor", "middle")
      .attr("fill", "#8a92a5")
      .attr("font-size", 11);

    // Path for the curve
    this.curvePath = this.g.append("path")
      .attr("fill", "none")
      .attr("stroke", "#5dc4ff")
      .attr("stroke-width", 1.8);

    // Groups for nodes (vertical dashed lines) and peak marker
    this.nodesG = this.g.append("g").attr("class", "nodes");
    this.peakG = this.g.append("g").attr("class", "peak");

    // Title in the corner
    this.titleText = this.svg.append("text")
      .attr("x", MARGIN.left)
      .attr("y", MARGIN.top - 2)
      .attr("fill", "#e8eaf0")
      .attr("font-size", 12)
      .attr("font-weight", 500)
      .text("Radial distribution function");
  }

  render(n, l) {
    // 1. Compute data
    const rMax = orbitalScale(n) * 0.85;
    const points = computeRDF(n, l, rMax);
    const nodes = findRadialNodes(points, l);
    const peak = findPeak(points);

    // 2. Get current size of the container
    const rect = this.container.node().getBoundingClientRect();
    const width = rect.width - MARGIN.left - MARGIN.right;
    const height = rect.height - MARGIN.top - MARGIN.bottom;

    // 3. Scales
    const x = d3.scaleLinear()
      .domain([0, rMax])
      .range([0, width]);

    const yMax = d3.max(points, d => d.P) * 1.05;
    const y = d3.scaleLinear()
      .domain([0, yMax])
      .range([height, 0]);

    // 4. Axes
    this.xAxisG
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0))
      .selectAll("text")
      .attr("fill", "#8a92a5")
      .attr("font-size", 11);

    this.yAxisG
      .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0))
      .selectAll("text")
      .attr("fill", "#8a92a5")
      .attr("font-size", 11);

    // Style axis lines
    this.svg.selectAll(".x-axis path, .y-axis path, .x-axis line, .y-axis line")
      .attr("stroke", "#3a4258");

    // 5. Axis labels
    this.svg.select(".axis-label:not(.y-axis-label)")
      .attr("x", MARGIN.left + width / 2)
      .attr("y", rect.height - 8)
      .text("r  (Bohr radii)");

    this.svg.select(".y-axis-label")
      .attr("x", 0)
      .attr("y", 0)
      .attr("transform",
        `translate(14, ${MARGIN.top + height / 2}) rotate(-90)`)
      .text("4πr²|R(r)|²");

    // 6. Curve
    const line = d3.line()
      .x(d => x(d.r))
      .y(d => y(d.P));

    this.curvePath
      .datum(points)
      .attr("d", line);

    // 7. Radial nodes (vertical dashed lines)
    const nodeSel = this.nodesG.selectAll("line").data(nodes);
    nodeSel.exit().remove();
    const nodeEnter = nodeSel.enter().append("line");
    nodeEnter.merge(nodeSel)
      .attr("x1", d => x(d))
      .attr("x2", d => x(d))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#ff5d5d")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 3")
      .attr("opacity", 0.6);

    // Node labels
    const nodeLabelSel = this.nodesG.selectAll("text").data(nodes);
    nodeLabelSel.exit().remove();
    const nodeLabelEnter = nodeLabelSel.enter().append("text");
    nodeLabelEnter.merge(nodeLabelSel)
      .attr("x", d => x(d) + 4)
      .attr("y", 12)
      .attr("fill", "#ff5d5d")
      .attr("font-size", 10)
      .text(d => `node r=${d.toFixed(2)}`);

    // 8. Peak marker
    this.peakG.selectAll("*").remove();
    this.peakG.append("circle")
      .attr("cx", x(peak.r))
      .attr("cy", y(peak.P))
      .attr("r", 3.5)
      .attr("fill", "#5dc4ff");

    this.peakG.append("text")
      .attr("x", x(peak.r) + 8)
      .attr("y", y(peak.P) - 4)
      .attr("fill", "#5dc4ff")
      .attr("font-size", 10)
      .text(`peak r=${peak.r.toFixed(2)}`);
  }
}