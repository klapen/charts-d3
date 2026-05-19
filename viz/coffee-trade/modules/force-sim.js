import * as d3 from 'd3'

export function buildSimulation(nodes, edges, { w, h }) {
  return d3.forceSimulation(nodes)
    .force('link',    d3.forceLink(edges).id(d => d.id)
                         .distance(d => 80 + 200 / Math.sqrt(Math.max(1, d.weight))))
    .force('charge',  d3.forceManyBody().strength(-300))
    .force('center',  d3.forceCenter(w / 2, h / 2))
    .force('collide', d3.forceCollide().radius(d => (d.radius || 6) + 4))
    .alphaTarget(0.01)   // gentle always-on drift
}
