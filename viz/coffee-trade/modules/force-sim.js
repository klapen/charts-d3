import * as d3 from 'd3'

// Read `d.radius`, which renderer-svg.update() writes onto each node before
// the simulation starts. Caller must run renderer.update() before this so
// forceCollide picks up the real per-node radius.
//
// TODO B11: gate the alphaTarget tick loop on Page Visibility so background
// tabs don't burn a core perpetually.
export function buildSimulation(nodes, edges, { w, h }) {
  return d3.forceSimulation(nodes)
    .force('link',    d3.forceLink(edges).id(d => d.id)
                         // log10 of value_usd compresses the $10³–$10¹⁰ flow
                         // range into a small weight so larger trades pull
                         // their nodes closer together.
                         .distance(d => 80 + 200 / Math.sqrt(Math.max(1, Math.log10((d.value_usd || 0) + 1)))))
    .force('charge',  d3.forceManyBody().strength(-300))
    .force('center',  d3.forceCenter(w / 2, h / 2))
    .force('collide', d3.forceCollide().radius(d => (d.radius || 6) + 4))
    .alphaTarget(0.01)   // gentle always-on drift
}
