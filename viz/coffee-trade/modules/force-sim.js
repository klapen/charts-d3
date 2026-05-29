import * as d3 from 'd3'

// Pseudo-map layout: each node has `targetX`/`targetY` from the geo projection
// (set by main.js before this runs). forceX/forceY pull nodes toward those
// coordinates; forceCollide spreads overlapping neighbors so dense regions
// (Europe especially) settle as a cluster of touching marbles instead of
// stacked discs.
//
// Reads `d.radius`, which renderer-svg.update() writes onto each node first.
//
// TODO B11: gate the alphaTarget tick loop on Page Visibility so background
// tabs don't burn a core perpetually.
export function buildSimulation(nodes, edges) {
  return d3.forceSimulation(nodes)
    // strength(0) means this force doesn't actually move anything, but
    // d3.forceLink still hydrates edge.source/target from string IDs into
    // node references — which the renderer and particle layer need to draw
    // lines and animate flows.
    .force('link',    d3.forceLink(edges).id(d => d.id).strength(0))
    .force('x',       d3.forceX(d => d.targetX).strength(0.6))
    .force('y',       d3.forceY(d => d.targetY).strength(0.6))
    .force('collide', d3.forceCollide().radius(d => (d.radius || 6) + 1.5).strength(1))
    .alphaTarget(0.01)   // gentle always-on drift
}
