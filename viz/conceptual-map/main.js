import '../../src/styles/main.css'
import * as d3 from 'd3'
import raw from './data.json'

const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored)) return stored
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return SUPPORTED.includes(nav) ? nav : 'en'
}

function applyLang(lang) {
  document.documentElement.lang = lang
  document.querySelectorAll(`[data-${lang}]`).forEach((el) => {
    const text = el.dataset[lang]
    if (text != null) el.textContent = text
  })
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    const active = btn.dataset.lang === lang
    btn.setAttribute('aria-pressed', active)
    btn.classList.toggle('text-brand', active)
    btn.classList.toggle('font-semibold', active)
    btn.classList.toggle('text-neutral-500', !active)
  })
  localStorage.setItem(STORAGE_KEY, lang)
}

function buildGraph(data) {
  const nodes = new Map()
  const links = []
  for (const cat of data) {
    if (!nodes.has(cat.name)) nodes.set(cat.name, { id: cat.name, type: 'category' })
    for (const item of cat.imports) {
      if (!nodes.has(item)) nodes.set(item, { id: item, type: 'link' })
      links.push({ source: cat.name, target: item })
    }
  }
  return { nodes: Array.from(nodes.values()), links }
}

const chartEl = document.getElementById('chart')
const restartBtn = document.getElementById('restart-btn')

const COLOR = { category: '#ff6b35', link: '#38bdf8' }
const RADIUS = { category: 12, link: 6 }

let simulation = null
let dimensions = { width: 800, height: 540 }
let neighbors = new Map()
let lang = detectLang()

function buildNeighbors(links) {
  const map = new Map()
  for (const l of links) {
    const s = typeof l.source === 'object' ? l.source.id : l.source
    const t = typeof l.target === 'object' ? l.target.id : l.target
    if (!map.has(s)) map.set(s, new Set())
    if (!map.has(t)) map.set(t, new Set())
    map.get(s).add(t)
    map.get(t).add(s)
  }
  return map
}

function setSize() {
  dimensions.width = Math.max(360, chartEl.clientWidth)
  dimensions.height = Math.round(Math.min(640, dimensions.width * 0.6))
}

function render() {
  setSize()
  chartEl.replaceChildren()

  const { nodes, links } = buildGraph(raw)
  neighbors = buildNeighbors(links)

  const svg = d3.select(chartEl)
    .append('svg')
    .attr('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`)
    .attr('width', '100%')
    .attr('height', dimensions.height)
    .style('display', 'block')
    .style('font-family', 'ui-sans-serif, system-ui, sans-serif')

  if (simulation) simulation.stop()

  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(80).strength(0.6))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
    .force('collide', d3.forceCollide().radius((d) => RADIUS[d.type] + 6))

  const linkSel = svg.append('g')
    .attr('stroke', '#525252')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', 1.2)

  const nodeG = svg.append('g').selectAll('g')
    .data(nodes)
    .join('g')
    .style('cursor', 'grab')
    .call(drag(simulation))
    .on('mouseenter', (_, d) => highlight(d))
    .on('mouseleave', () => highlight(null))

  nodeG.append('circle')
    .attr('r', (d) => RADIUS[d.type])
    .attr('fill', (d) => COLOR[d.type])
    .attr('fill-opacity', 0.9)
    .attr('stroke', '#0a0a0a')
    .attr('stroke-width', 1.5)

  nodeG.append('text')
    .attr('dy', (d) => (d.type === 'category' ? '0.32em' : '0.32em'))
    .attr('dx', (d) => (d.type === 'category' ? 0 : RADIUS.link + 4))
    .attr('text-anchor', (d) => (d.type === 'category' ? 'middle' : 'start'))
    .attr('fill', (d) => (d.type === 'category' ? '#0a0a0a' : '#e5e5e5'))
    .attr('font-size', (d) => (d.type === 'category' ? 9 : 11))
    .attr('font-weight', (d) => (d.type === 'category' ? 700 : 400))
    .attr('paint-order', 'stroke')
    .attr('stroke', (d) => (d.type === 'link' ? '#0a0a0a' : 'none'))
    .attr('stroke-width', (d) => (d.type === 'link' ? 2.5 : 0))
    .text((d) => d.id)

  function highlight(focus) {
    if (!focus) {
      linkSel.attr('stroke-opacity', 0.6).attr('stroke', '#525252')
      nodeG.attr('opacity', 1)
      return
    }
    const reachable = neighbors.get(focus.id) ?? new Set()
    nodeG.attr('opacity', (d) => (d === focus || reachable.has(d.id) ? 1 : 0.18))
    linkSel
      .attr('stroke', (l) =>
        l.source === focus || l.target === focus ? '#ff6b35' : '#525252',
      )
      .attr('stroke-opacity', (l) =>
        l.source === focus || l.target === focus ? 0.95 : 0.08,
      )
  }

  simulation.on('tick', () => {
    linkSel
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y)
    nodeG.attr('transform', (d) => `translate(${d.x},${d.y})`)
  })
}

function drag(sim) {
  return d3.drag()
    .on('start', (event, d) => {
      if (!event.active) sim.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    })
    .on('drag', (event, d) => {
      d.fx = event.x
      d.fy = event.y
    })
    .on('end', (event, d) => {
      if (!event.active) sim.alphaTarget(0)
      d.fx = null
      d.fy = null
    })
}

restartBtn.addEventListener('click', () => render())

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang
    applyLang(lang)
  })
})

let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(render, 200)
})

applyLang(lang)
render()
