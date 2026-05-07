import '../../src/styles/main.css'
import * as d3 from 'd3'
import raw from './data/ipc.json'

const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

const GROUP_COLOR = {
  Alimentos: '#007A95',
  Vivienda: '#D8D600',
  Educación: '#F19B00',
  Salud: '#98BD1E',
  Vestuario: '#FFCF00',
  Diversión: '#2BABE3',
  Comunicaciones: '#6F6F6E',
  'Otros gastos': '#B6004B',
  Transporte: '#E2007A',
}
const GROUP_ORDER = [
  'Alimentos', 'Vivienda', 'Transporte', 'Salud', 'Educación',
  'Diversión', 'Comunicaciones', 'Vestuario', 'Otros gastos',
]
const GROUP_LABEL_EN = {
  Alimentos: 'Food',
  Vivienda: 'Housing',
  Educación: 'Education',
  Salud: 'Health',
  Vestuario: 'Clothing',
  Diversión: 'Recreation',
  Comunicaciones: 'Communications',
  'Otros gastos': 'Other expenses',
  Transporte: 'Transport',
}

const i18n = {
  en: { ofTotal: 'of total IPC weight', root: 'Total' },
  es: { ofTotal: 'del peso total del IPC', root: 'Total' },
}

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

function nodeLabel(d, lang) {
  if (!d.parent) return i18n[lang].root
  const top = topGroup(d)
  if (d.depth === 1 && lang === 'en' && GROUP_LABEL_EN[top]) return GROUP_LABEL_EN[top]
  return d.data.name
}

function topGroup(d) {
  let cur = d
  while (cur.parent && cur.parent.depth > 0) cur = cur.parent
  return cur.data.name
}

const chartEl = document.getElementById('chart')
const breadcrumbEl = document.getElementById('breadcrumb')
const legendEl = document.getElementById('legend')

let lang = detectLang()

const root = d3
  .hierarchy(raw)
  .sum((d) => d.size || 0)
  .sort((a, b) => b.value - a.value)

const totalValue = root.value

const size = 720
const ringWidth = size / 6

const partition = d3.partition().size([2 * Math.PI, root.height + 1])
partition(root)
root.each((d) => (d.current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 }))

const arc = d3
  .arc()
  .startAngle((d) => d.x0)
  .endAngle((d) => d.x1)
  .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
  .padRadius(ringWidth * 1.5)
  .innerRadius((d) => d.y0 * ringWidth)
  .outerRadius((d) => Math.max(d.y0 * ringWidth, d.y1 * ringWidth - 1))

const svg = d3
  .select(chartEl)
  .append('svg')
  .attr('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`)
  .attr('width', '100%')
  .attr('height', 'auto')
  .style('max-width', `${size}px`)
  .style('font', '11px ui-sans-serif, system-ui, sans-serif')

const g = svg.append('g')

const path = g
  .append('g')
  .selectAll('path')
  .data(root.descendants().slice(1))
  .join('path')
  .attr('fill', (d) => GROUP_COLOR[topGroup(d)] || '#888')
  .attr('fill-opacity', (d) => arcVisible(d.current) ? 1 / Math.max(1, d.depth) : 0)
  .attr('pointer-events', (d) => arcVisible(d.current) ? 'auto' : 'none')
  .attr('d', (d) => arc(d.current))
  .style('cursor', (d) => (d.children ? 'pointer' : 'default'))
  .on('mouseover', (event, d) => onHover(d))
  .on('mouseout', () => onLeave())

path
  .filter((d) => d.children)
  .on('click', (event, d) => zoomTo(d))

const label = g
  .append('g')
  .attr('pointer-events', 'none')
  .attr('text-anchor', 'middle')
  .style('user-select', 'none')
  .selectAll('text')
  .data(root.descendants().slice(1))
  .join('text')
  .attr('dy', '0.35em')
  .attr('fill', '#0a0a0a')
  .attr('fill-opacity', (d) => +labelVisible(d.current))
  .attr('transform', (d) => labelTransform(d.current))
  .text((d) => nodeLabel(d, lang))

const center = g
  .append('g')
  .style('cursor', 'pointer')
  .on('click', () => zoomTo(root))

center.append('circle').attr('r', ringWidth).attr('fill', '#0a0a0a').attr('stroke', '#262626')

const centerPct = center
  .append('text')
  .attr('text-anchor', 'middle')
  .attr('dy', '-0.2em')
  .attr('fill', '#ff6b35')
  .style('font-size', '24px')
  .style('font-weight', '700')
  .text('100%')

const centerLabel = center
  .append('text')
  .attr('text-anchor', 'middle')
  .attr('dy', '1.2em')
  .attr('fill', '#a3a3a3')
  .style('font-size', '11px')
  .text(i18n[lang].ofTotal)

const centerName = center
  .append('text')
  .attr('text-anchor', 'middle')
  .attr('dy', '2.6em')
  .attr('fill', '#e5e5e5')
  .style('font-size', '12px')
  .style('font-weight', '600')
  .text('')

let focused = root

function arcVisible(d) {
  return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0
}
function labelVisible(d) {
  return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.04
}
function labelTransform(d) {
  const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI
  const y = ((d.y0 + d.y1) / 2) * ringWidth
  return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`
}

function fmtPct(v) {
  const pct = (v / totalValue) * 100
  if (pct < 0.1) return '<0.1%'
  return pct.toPrecision(3) + '%'
}

function onHover(d) {
  const ancestors = d.ancestors().filter((n) => n.parent)
  path
    .transition('hl')
    .duration(120)
    .attr('fill-opacity', (n) => {
      if (!arcVisible(n.current)) return 0
      return ancestors.includes(n) ? 1 : 0.25
    })
  centerPct.text(fmtPct(d.value))
  centerName.text(nodeLabel(d, lang))
  renderBreadcrumb(ancestors)
}

function onLeave() {
  path
    .transition('hl')
    .duration(180)
    .attr('fill-opacity', (n) => arcVisible(n.current) ? 1 / Math.max(1, n.depth) : 0)
  centerPct.text(fmtPct(focused.value))
  centerName.text(focused === root ? '' : nodeLabel(focused, lang))
  renderBreadcrumb(focused === root ? [] : focused.ancestors().filter((n) => n.parent))
}

function renderBreadcrumb(nodes) {
  breadcrumbEl.replaceChildren()
  if (!nodes.length) return
  nodes.forEach((n, i) => {
    if (i > 0) {
      const sep = document.createElement('span')
      sep.className = 'text-neutral-700'
      sep.setAttribute('aria-hidden', 'true')
      sep.textContent = '›'
      breadcrumbEl.appendChild(sep)
    }
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className =
      'inline-flex items-center gap-2 px-2.5 py-1 rounded border border-neutral-800 bg-neutral-900 hover:border-neutral-600 cursor-pointer'
    const dot = document.createElement('span')
    dot.className = 'inline-block w-2 h-2 rounded-full'
    dot.style.background = GROUP_COLOR[topGroup(n)] || '#888'
    chip.appendChild(dot)
    const text = document.createElement('span')
    text.textContent = nodeLabel(n, lang)
    chip.appendChild(text)
    const pct = document.createElement('span')
    pct.className = 'text-neutral-400 tabular-nums'
    pct.textContent = fmtPct(n.value)
    chip.appendChild(pct)
    chip.addEventListener('click', () => zoomTo(n))
    breadcrumbEl.appendChild(chip)
  })
}

function zoomTo(p) {
  focused = p
  root.each(
    (d) =>
      (d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth),
      }),
  )

  const t = svg.transition().duration(700)

  path
    .transition(t)
    .tween('data', (d) => {
      const i = d3.interpolate(d.current, d.target)
      return (tt) => (d.current = i(tt))
    })
    .filter(function (d) {
      return +this.getAttribute('fill-opacity') || arcVisible(d.target)
    })
    .attr('fill-opacity', (d) => (arcVisible(d.target) ? 1 / Math.max(1, d.depth - p.depth) : 0))
    .attr('pointer-events', (d) => (arcVisible(d.target) ? 'auto' : 'none'))
    .attrTween('d', (d) => () => arc(d.current))

  label
    .filter(function (d) {
      return +this.getAttribute('fill-opacity') || labelVisible(d.target)
    })
    .transition(t)
    .attr('fill-opacity', (d) => +labelVisible(d.target))
    .attrTween('transform', (d) => () => labelTransform(d.current))

  centerPct.text(fmtPct(p.value))
  centerName.text(p === root ? '' : nodeLabel(p, lang))
  renderBreadcrumb(p === root ? [] : p.ancestors().filter((n) => n.parent))
}

function renderLegend() {
  legendEl.replaceChildren()
  for (const name of GROUP_ORDER) {
    const li = document.createElement('li')
    li.className = 'flex items-center gap-2 cursor-pointer hover:text-white'
    const dot = document.createElement('span')
    dot.className = 'inline-block w-3 h-3 rounded-sm flex-shrink-0'
    dot.style.background = GROUP_COLOR[name]
    li.appendChild(dot)
    const text = document.createElement('span')
    text.textContent = lang === 'en' ? GROUP_LABEL_EN[name] || name : name
    li.appendChild(text)
    li.addEventListener('click', () => {
      const node = root.children?.find((c) => c.data.name === name)
      if (node) zoomTo(node)
    })
    legendEl.appendChild(li)
  }
}

function relabel() {
  label.text((d) => nodeLabel(d, lang))
  centerLabel.text(i18n[lang].ofTotal)
  centerName.text(focused === root ? '' : nodeLabel(focused, lang))
  renderBreadcrumb(focused === root ? [] : focused.ancestors().filter((n) => n.parent))
  renderLegend()
}

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang
    applyLang(lang)
    relabel()
  })
})

applyLang(lang)
renderLegend()
