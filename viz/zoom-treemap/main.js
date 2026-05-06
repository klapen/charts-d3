import '../../src/styles/main.css'
import * as d3 from 'd3'
import data from './data.json'

const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

const i18n = {
  en: { root: 'root', items: 'items', size: 'size' },
  es: { root: 'raíz', items: 'elementos', size: 'tamaño' },
}

const chartEl = document.getElementById('chart')
const breadcrumbEl = document.getElementById('breadcrumb')
const modeSelect = document.getElementById('value-mode')
const resetBtn = document.getElementById('reset-btn')

const margin = { top: 0, right: 0, bottom: 0, left: 0 }

let width = 0
let height = 0
let mode = 'size'
let lang = detectLang()
let root = null
let focus = null
let svg = null
let g = null
let valueFn = (d) => d.size ?? 0

function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored)) return stored
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return SUPPORTED.includes(nav) ? nav : 'en'
}

function applyLang(next) {
  lang = next
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
  updateBreadcrumb()
}

function dimensions() {
  width = Math.max(360, chartEl.clientWidth)
  const aspect = window.innerWidth < 640 ? 0.9 : 0.6
  height = Math.round(width * aspect)
}

const color = d3.scaleOrdinal(d3.schemeTableau10)

function buildHierarchy() {
  const h = d3.hierarchy(data).sum((d) => (mode === 'size' ? d.size ?? 0 : d.children ? 0 : 1))
    .sort((a, b) => b.value - a.value)
  d3.treemap().size([width, height]).paddingInner(1).round(true)(h)
  return h
}

function topGroup(node) {
  let n = node
  while (n.depth > 1) n = n.parent
  return n
}

function isVisible(d, scope) {
  return d.depth >= scope.depth && (d === scope || isAncestor(d, scope))
}

function isAncestor(d, scope) {
  let n = d
  while (n) {
    if (n === scope) return true
    n = n.parent
  }
  return false
}

function render() {
  dimensions()
  chartEl.replaceChildren()

  svg = d3.select(chartEl)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height)
    .style('display', 'block')
    .style('cursor', 'pointer')
    .on('click', (event) => {
      if (event.target.tagName === 'svg' || event.currentTarget === event.target) {
        zoomTo(root)
      }
    })

  g = svg.append('g')

  root = buildHierarchy()
  focus = root
  draw(false)
}

function draw(animate) {
  const leaves = root.leaves()
  const t = animate ? g.transition().duration(600).ease(d3.easeCubicInOut) : null

  const x = d3.scaleLinear().range([0, width]).domain([focus.x0, focus.x1])
  const y = d3.scaleLinear().range([0, height]).domain([focus.y0, focus.y1])

  const cells = g.selectAll('g.cell').data(leaves, (d) => d.data.name + '|' + d.ancestors().map((a) => a.data.name).join('/'))

  const cellsEnter = cells.enter().append('g')
    .attr('class', 'cell')
    .attr('transform', (d) => `translate(${x(d.x0)},${y(d.y0)})`)
    .on('click', (event, d) => {
      event.stopPropagation()
      const target = d.parent === focus ? topGroup(d) : d.parent ?? root
      zoomTo(target === focus ? root : target)
    })
    .style('cursor', 'pointer')

  cellsEnter.append('rect')
    .attr('width', (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr('height', (d) => Math.max(0, y(d.y1) - y(d.y0) - 1))
    .attr('fill', (d) => color(topGroup(d).data.name))
    .attr('fill-opacity', 0.85)
    .attr('stroke', '#0a0a0a')
    .attr('stroke-width', 1)
    .append('title')

  cellsEnter.append('text')
    .attr('x', 4)
    .attr('y', 14)
    .attr('fill', '#fff')
    .attr('font-size', 11)
    .attr('pointer-events', 'none')
    .style('font-family', 'ui-sans-serif, system-ui, sans-serif')
    .text((d) => d.data.name)

  const merged = cellsEnter.merge(cells)
  const target = animate ? merged.transition(t) : merged

  target.attr('transform', (d) => `translate(${x(d.x0)},${y(d.y0)})`)

  const rectSel = animate
    ? merged.select('rect').transition(t)
    : merged.select('rect')

  rectSel
    .attr('width', (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr('height', (d) => Math.max(0, y(d.y1) - y(d.y0) - 1))

  merged.select('rect title')
    .text((d) => `${d.ancestors().reverse().map((a) => a.data.name).join(' / ')}\n${i18n[lang].size}: ${(d.value ?? 0).toLocaleString()}`)

  const textSel = animate
    ? merged.select('text').transition(t)
    : merged.select('text')

  textSel
    .attr('opacity', (d) => {
      const w = x(d.x1) - x(d.x0)
      const h = y(d.y1) - y(d.y0)
      return w > 50 && h > 18 ? 1 : 0
    })

  cells.exit().remove()
  updateBreadcrumb()
}

function zoomTo(node) {
  focus = node
  draw(true)
}

function updateBreadcrumb() {
  if (!focus) return
  const parts = focus.ancestors().reverse().map((n, i) => {
    const name = i === 0 ? i18n[lang].root : n.data.name
    return `<button class="crumb hover:text-brand transition-colors cursor-pointer" data-depth="${n.depth}">${name}</button>`
  })
  breadcrumbEl.innerHTML = parts.join('<span class="text-neutral-700 mx-1">›</span>')
  breadcrumbEl.querySelectorAll('.crumb').forEach((el) => {
    el.addEventListener('click', () => {
      const depth = Number(el.dataset.depth)
      let target = focus
      while (target && target.depth > depth) target = target.parent
      if (target) zoomTo(target)
    })
  })
}

modeSelect.addEventListener('change', (e) => {
  mode = e.target.value
  render()
})

resetBtn.addEventListener('click', () => zoomTo(root))

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang))
})

window.addEventListener('resize', () => render())

applyLang(lang)
render()
