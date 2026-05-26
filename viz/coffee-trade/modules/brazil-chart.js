import * as d3 from 'd3'
import { getState, subscribe } from './state.js'
import { loadBrazilMonthly } from './data-loader.js'

const CATEGORIES = ['arabica_natural', 'robusta_medium', 'processed', 'arabica_diff', 'robusta_diff']
const COLORS = {
  arabica_natural: '#a16a3d',
  robusta_medium:  '#4a6878',
  processed:       '#737373',
  arabica_diff:    '#d4a96a',
  robusta_diff:    '#7ba6c4',
}
const LABELS = {
  en: {
    arabica_natural: 'Arabica natural',
    arabica_diff:    'Arabica differentiated',
    robusta_medium:  'Robusta medium',
    robusta_diff:    'Robusta differentiated',
    processed:       'Processed (soluble + R&G)',
    total:           'Total',
    bags:            'bags',
  },
  es: {
    arabica_natural: 'Arábica natural',
    arabica_diff:    'Arábica diferenciada',
    robusta_medium:  'Robusta media',
    robusta_diff:    'Robusta diferenciada',
    processed:       'Procesado (soluble + T&M)',
    total:           'Total',
    bags:            'sacas',
  },
}

const MARGIN = { top: 8, right: 8, bottom: 18, left: 48 }

function dims() {
  const w = root.clientWidth
  const h = root.clientHeight
  return {
    w,
    h,
    innerW: Math.max(0, w - MARGIN.left - MARGIN.right),
    innerH: Math.max(0, h - MARGIN.top - MARGIN.bottom),
  }
}

function stackedData() {
  const stack = d3.stack()
    .keys(CATEGORIES)
    .order(d3.stackOrderNone)
    .offset(viewMode === 'share' ? d3.stackOffsetExpand : d3.stackOffsetNone)
  return stack(data.months.map((_, i) => {
    const row = { i }
    for (const c of CATEGORIES) row[c] = data[c][i]
    return row
  }))
}

let root        // <div id="brazil-chart-canvas">
let data        // loaded JSON payload
let svg         // d3 selection of root <svg>
let hasBooted = false
let viewMode = 'bags'    // 'bags' | 'share'
let xScale, innerH, parsedMonths

export function wireBrazilChart() {
  root = document.getElementById('brazil-chart-canvas')
  if (!root) return

  const ro = new ResizeObserver(entries => {
    requestAnimationFrame(() => {
      const w = entries[0].contentRect.width
      if (!hasBooted && w > 0) {
        hasBooted = true
        boot()
      } else if (hasBooted) {
        render()
      }
    })
  })
  ro.observe(root)

  // Wire toggle buttons (in #brazil-chart-toggle, sibling of canvas).
  const toggle = document.getElementById('brazil-chart-toggle')
  if (toggle) {
    toggle.addEventListener('click', e => {
      const btn = e.target.closest('button[data-mode]')
      if (!btn) return
      const next = btn.dataset.mode
      if (next === viewMode) return
      viewMode = next
      for (const b of toggle.querySelectorAll('button[data-mode]')) {
        const active = b.dataset.mode === viewMode
        b.setAttribute('aria-pressed', active ? 'true' : 'false')
        b.classList.toggle('text-neutral-200', active)
        b.classList.toggle('text-neutral-400', !active)
      }
      if (hasBooted) render()
    })
  }

  subscribe((next, prev) => {
    if (!hasBooted) return
    if (next.year !== prev.year) updateBand()
  })
}

async function boot() {
  data = await loadBrazilMonthly()
  parsedMonths = data.months.map(s => {
    const [y, m] = s.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  render()
}

function render() {
  if (!data) return
  const { w, h, innerW, innerH: ih } = dims()
  if (innerW === 0 || ih === 0) return
  innerH = ih

  if (!svg) {
    svg = d3.select(root)
      .append('svg')
      .attr('class', 'block w-full h-full')
    svg.append('g').attr('class', 'plot')
       .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
    svg.append('g').attr('class', 'x-axis')
       .attr('transform', `translate(${MARGIN.left},${MARGIN.top + ih})`)
    svg.append('g').attr('class', 'y-axis')
       .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
  }
  svg.attr('viewBox', `0 0 ${w} ${h}`)

  xScale = d3.scaleTime()
    .domain(d3.extent(parsedMonths))
    .range([0, innerW])

  const stacked = stackedData()
  const yMax = d3.max(stacked, layer => d3.max(layer, d => d[1]))
  const yScale = d3.scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([ih, 0])

  const area = d3.area()
    .x((_, i) => xScale(parsedMonths[i]))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveMonotoneX)

  const plot = svg.select('g.plot')
  const layers = plot.selectAll('path.layer').data(stacked, d => d.key)
  layers.enter()
    .append('path')
    .attr('class', 'layer')
    .merge(layers)
    .attr('fill', d => COLORS[d.key])
    .attr('d', area)
  layers.exit().remove()

  renderLegend()

  const xAxis = d3.axisBottom(xScale)
    .ticks(d3.timeYear.every(1))
    .tickFormat(d3.timeFormat('%Y'))
    .tickSize(4)
  svg.select('g.x-axis')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top + ih})`)
    .call(xAxis)
    .call(g => g.selectAll('text').attr('fill', '#a3a3a3').attr('font-size', 10))
    .call(g => g.selectAll('line, path').attr('stroke', '#404040'))

  const yAxis = d3.axisLeft(yScale)
    .ticks(5)
    .tickFormat(viewMode === 'share'
      ? d3.format('.0%')
      : v => `${(v / 1e6).toFixed(1)}M`)
    .tickSize(4)
  svg.select('g.y-axis')
    .call(yAxis)
    .call(g => g.selectAll('text').attr('fill', '#a3a3a3').attr('font-size', 10))
    .call(g => g.selectAll('line, path').attr('stroke', '#404040'))

  updateBand()
  attachHover()
}

function renderLegend() {
  if (!root) return
  let legend = root.parentElement.querySelector('.brazil-legend')
  if (!legend) {
    legend = document.createElement('div')
    legend.className = 'brazil-legend flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-neutral-400'
    root.after(legend)
  }
  const lang = getState().lang || 'en'
  legend.innerHTML = CATEGORIES.slice().reverse().map(c => `
    <span class="inline-flex items-center gap-1.5">
      <span class="inline-block w-2.5 h-2.5" style="background:${COLORS[c]}"></span>
      ${LABELS[lang][c]}
    </span>`).join('')
}

function updateBand() {
  if (!svg || !data) return
  const plot = svg.select('g.plot')
  let band = plot.select('rect.year-band')
  if (band.empty()) {
    band = plot.insert('rect', ':first-child').attr('class', 'year-band')
  }

  const year = getState().year
  const startYear = Number(data.start_month.slice(0, 4))
  const endYear = Number(data.end_month.slice(0, 4))
  if (!year || year < startYear || year > endYear) {
    band.attr('display', 'none')
    return
  }
  const x0 = xScale(new Date(year, 0, 1))
  const x1 = xScale(new Date(year, 11, 31))
  band.attr('display', null)
    .attr('x', x0)
    .attr('y', 0)
    .attr('width', Math.max(0, x1 - x0))
    .attr('height', innerH)
    .attr('fill', 'var(--color-brand)')
    .attr('fill-opacity', 0.08)
    .attr('stroke', 'var(--color-brand)')
    .attr('stroke-dasharray', '2 3')
    .attr('stroke-opacity', 0.5)
}

function ensureTooltip() {
  let t = root.querySelector('.brazil-tooltip')
  if (!t) {
    t = document.createElement('div')
    t.className = 'brazil-tooltip absolute pointer-events-none hidden bg-neutral-900/95 border border-neutral-700 rounded p-2 text-[11px] text-neutral-200 shadow-lg'
    t.style.zIndex = '10'
    root.appendChild(t)
  }
  return t
}

function ensureGuide() {
  if (!svg) return null
  let g = svg.select('line.guide')
  if (g.empty()) {
    g = svg.append('line')
      .attr('class', 'guide pointer-events-none')
      .attr('stroke', '#e5e5e5')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', '2 3')
      .attr('display', 'none')
  }
  return g
}

function attachHover() {
  if (!svg) return
  const overlay = svg.selectAll('rect.hover-overlay').data([null])
  overlay.enter().append('rect')
    .attr('class', 'hover-overlay')
    .attr('fill', 'transparent')
    .merge(overlay)
    .attr('x', MARGIN.left)
    .attr('y', MARGIN.top)
    .attr('width', dims().innerW)
    .attr('height', innerH)
    .on('pointermove', onMove)
    .on('pointerleave', onLeave)
}

function onMove(event) {
  const [mx] = d3.pointer(event, svg.node())
  const xIn = mx - MARGIN.left
  if (xIn < 0 || xIn > dims().innerW) return onLeave()
  const t = xScale.invert(xIn)
  const idx = d3.leastIndex(parsedMonths, d => Math.abs(d - t))
  if (idx == null) return onLeave()

  const xAt = xScale(parsedMonths[idx]) + MARGIN.left
  ensureGuide()
    .attr('display', null)
    .attr('x1', xAt).attr('x2', xAt)
    .attr('y1', MARGIN.top).attr('y2', MARGIN.top + innerH)

  const tooltip = ensureTooltip()
  const lang = getState().lang || 'en'
  const L = LABELS[lang]
  const monthLabel = parsedMonths[idx].toLocaleDateString(
    lang === 'es' ? 'es-CO' : 'en-US',
    { month: 'short', year: 'numeric' })
  const total = CATEGORIES.reduce((s, c) => s + data[c][idx], 0)
  const fmt = (v) => viewMode === 'share'
    ? `${((v / total) * 100).toFixed(1)}%`
    : `${(v / 1000).toFixed(0)}k ${L.bags}`
  const rows = CATEGORIES.slice().reverse().map(c => `
    <div class="flex items-center gap-2">
      <span class="inline-block w-2 h-2" style="background:${COLORS[c]}"></span>
      <span class="flex-1">${L[c]}</span>
      <span class="tabular-nums">${fmt(data[c][idx])}</span>
    </div>`).join('')
  tooltip.innerHTML = `
    <div class="font-medium mb-1">${monthLabel}</div>
    ${rows}
    <div class="border-t border-neutral-700 mt-1 pt-1 flex items-center gap-2">
      <span class="flex-1">${L.total}</span>
      <span class="tabular-nums">${viewMode === 'share' ? '100%' : `${(total / 1000).toFixed(0)}k ${L.bags}`}</span>
    </div>`
  tooltip.classList.remove('hidden')

  // Position tooltip near pointer but constrained inside root.
  const rootRect = root.getBoundingClientRect()
  const tooltipW = tooltip.offsetWidth || 180
  const left = Math.min(Math.max(0, xAt - tooltipW / 2), rootRect.width - tooltipW)
  tooltip.style.left = `${left}px`
  tooltip.style.top = `${MARGIN.top}px`
}

function onLeave() {
  ensureGuide()?.attr('display', 'none')
  const t = root.querySelector('.brazil-tooltip')
  if (t) t.classList.add('hidden')
}
