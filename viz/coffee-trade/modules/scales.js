import * as d3 from 'd3'

export const REGION_COLOR = {
  'South America': '#ff7a59',
  'Africa':        '#f5c451',
  'Asia':          '#5ac6c0',
  'Europe':        '#9b8cff',
  'North America': '#ff6ec7',
}
export const FALLBACK_COLOR = '#8b8b95'

export function colorFor(meta, iso3) {
  const c = meta.countries[iso3]
  return (c && REGION_COLOR[c.region]) || FALLBACK_COLOR
}

export function buildScales(nodes, edges, { w, h }) {
  const maxNodeTotal = d3.max(nodes, n => n.exports_usd + n.imports_usd) || 1
  const maxEdgeValue = d3.max(edges, e => e.value_usd) || 1
  return {
    nodeRadius: d3.scaleSqrt().domain([0, maxNodeTotal]).range([3, Math.min(w, h) / 18]),
    linkWidth:  d3.scaleSqrt().domain([0, maxEdgeValue]).range([0.5, 4]),
    particleR:  d3.scaleSqrt().domain([0, maxEdgeValue]).range([1.2, 2.5]),
  }
}
