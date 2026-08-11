import * as d3 from 'd3'
import { loadPanama } from './data-loader.js'

// Story tab chart (Spanish-only). Three views share one canvas via the toggle:
//   'fuentes'  — Panama's top import sources, green vs roasted (recent 3 yrs)
//   'precio'   — green suppliers ranked by unit value ($/kg): the quality
//                ladder that puts Colombia above the commodity tier
//   'colombia' — Colombia's coffee exports to Panama by year
// The SVG is rebuilt per render (small chart, infrequent renders) so the three
// very different axis layouts don't have to share cached selections.

const GREEN = '#5aa469'
const ROASTED = '#d98b4a'
const BRAND = '#ff6b35'
const COMMODITY = '#6b7280' // muted grey for below-average unit values

const NAME_ES = {
  BRA: 'Brasil', USA: 'EE. UU.', CHE: 'Suiza', HND: 'Honduras', VNM: 'Vietnam',
  NIC: 'Nicaragua', COL: 'Colombia', PER: 'Perú', UGA: 'Uganda', ITA: 'Italia',
  GTM: 'Guatemala', IDN: 'Indonesia', GBR: 'Reino Unido', ESP: 'España',
  SLV: 'El Salvador', CRI: 'Costa Rica', MEX: 'México', ETH: 'Etiopía', KEN: 'Kenia',
}
const nameOf = (iso) => NAME_ES[iso] || iso

const fmtUsd = (v) => {
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + ' M'
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + ' k'
  return '$' + Math.round(v)
}
const axisUsd = (v) => (v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : (v / 1e3).toFixed(0) + 'k')
const fmtKg = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + ' M kg' : (v / 1e3).toFixed(0) + ' k kg')
const fmtPerKg = (v) => '$' + v.toFixed(2).replace('.', ',') + '/kg'

const AXIS_TEXT = 'rgb(163 163 163)'
const AXIS_LINE = 'rgb(82 82 82)'

export function wirePanamaChart() {
  const root = document.getElementById('panama-chart-canvas')
  if (!root) return

  const tooltip = document.createElement('div')
  tooltip.className = 'absolute pointer-events-none rounded bg-neutral-900/95 ' +
    'border border-neutral-700 text-neutral-100 text-xs px-2 py-1 shadow-lg tabular-nums z-10'
  tooltip.style.display = 'none'
  root.appendChild(tooltip)

  let data = null
  let dims = { width: 0, height: 0 }
  let hasBooted = false
  let view = 'fuentes'
  let resizeRaf = 0

  const toggle = document.getElementById('panama-chart-toggle')
  if (toggle) {
    for (const btn of toggle.querySelectorAll('button')) {
      btn.addEventListener('click', () => {
        view = btn.dataset.view
        for (const b of toggle.querySelectorAll('button')) {
          const active = b === btn
          b.setAttribute('aria-pressed', String(active))
          b.classList.toggle('border-brand', active)
          b.classList.toggle('text-neutral-200', active)
          b.classList.toggle('text-neutral-400', !active)
        }
        render()
      })
    }
  }

  const ro = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect
    if (width === 0) return
    dims = { width, height }
    if (resizeRaf) cancelAnimationFrame(resizeRaf)
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      if (!hasBooted) {
        hasBooted = true
        loadPanama().then((d) => { data = d; render() })
      } else if (data) {
        render()
      }
    })
  })
  ro.observe(root)

  function newSvg() {
    d3.select(root).select('svg').remove()
    return d3.select(root).append('svg')
      .attr('width', '100%').attr('height', '100%')
      .attr('viewBox', `0 0 ${dims.width} ${dims.height}`)
      .style('display', 'block')
  }

  function showTip(html, x, y) {
    tooltip.innerHTML = html
    tooltip.style.display = 'block'
    const rect = root.getBoundingClientRect()
    const px = Math.min(rect.width - tooltip.offsetWidth - 8, Math.max(4, x))
    const py = Math.min(rect.height - tooltip.offsetHeight - 6, Math.max(4, y))
    tooltip.style.left = `${px}px`
    tooltip.style.top = `${py}px`
  }
  const hideTip = () => { tooltip.style.display = 'none' }

  function render() {
    if (!data || dims.width === 0) return
    if (view === 'fuentes') renderSources()
    else if (view === 'precio') renderPriceLadder()
    else renderColombia()
  }

  function renderSources() {
    const { width, height } = dims
    const M = { top: 6, right: 18, bottom: 22, left: 104 }
    const innerW = Math.max(0, width - M.left - M.right)
    const innerH = Math.max(0, height - M.top - M.bottom)

    const rows = data.sources
    const y = d3.scaleBand().domain(rows.map((d) => d.iso3)).range([0, innerH]).padding(0.28)
    const xMax = d3.max(rows, (d) => d.green + d.roasted) || 1
    const x = d3.scaleLinear().domain([0, xMax]).nice().range([0, innerW])

    const svg = newSvg()
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(axisUsd))
      .call((s) => s.selectAll('text').attr('fill', AXIS_TEXT))
      .call((s) => s.selectAll('line, path').attr('stroke', AXIS_LINE))

    for (const d of rows) {
      const yy = y(d.iso3)
      const isCol = d.iso3 === 'COL'
      g.append('rect').attr('x', 0).attr('y', yy).attr('height', y.bandwidth())
        .attr('width', x(d.green)).attr('fill', GREEN)
        .on('pointermove', (e) => tipSource(e, d, 'green'))
        .on('pointerleave', hideTip)
      g.append('rect').attr('x', x(d.green)).attr('y', yy).attr('height', y.bandwidth())
        .attr('width', x(d.roasted)).attr('fill', ROASTED)
        .on('pointermove', (e) => tipSource(e, d, 'roasted'))
        .on('pointerleave', hideTip)
      if (isCol) {
        g.append('rect').attr('x', -1).attr('y', yy - 1)
          .attr('width', x(d.green + d.roasted) + 2).attr('height', y.bandwidth() + 2)
          .attr('fill', 'none').attr('stroke', BRAND).attr('stroke-width', 1.5).attr('rx', 2)
      }
      g.append('text').attr('x', -8).attr('y', yy + y.bandwidth() / 2)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
        .attr('font-size', 11).attr('font-weight', isCol ? 700 : 400)
        .attr('fill', isCol ? BRAND : 'rgb(212 212 212)')
        .text(nameOf(d.iso3))
    }

    function tipSource(e, d, seg) {
      const val = seg === 'green' ? d.green : d.roasted
      const label = seg === 'green' ? 'Verde' : 'Tostado'
      showTip(
        `<div class="font-semibold">${nameOf(d.iso3)}</div>` +
        `<div>${label}: ${fmtUsd(val)}</div>` +
        `<div class="text-neutral-400">Total: ${fmtUsd(d.green + d.roasted)}</div>`,
        e.offsetX + 12, e.offsetY - 8,
      )
    }
  }

  function renderPriceLadder() {
    const { width, height } = dims
    const M = { top: 14, right: 44, bottom: 22, left: 104 }
    const innerW = Math.max(0, width - M.left - M.right)
    const innerH = Math.max(0, height - M.top - M.bottom)

    const rows = data.price_tiers
    const avg = data.unit_values.green_import // market average = tier boundary
    const y = d3.scaleBand().domain(rows.map((d) => d.iso3)).range([0, innerH]).padding(0.3)
    const xMax = d3.max(rows, (d) => d.usd_per_kg) || 1
    const x = d3.scaleLinear().domain([0, xMax]).nice().range([0, innerW])

    const svg = newSvg()
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat((v) => '$' + v))
      .call((s) => s.selectAll('text').attr('fill', AXIS_TEXT))
      .call((s) => s.selectAll('line, path').attr('stroke', AXIS_LINE))

    for (const d of rows) {
      const yy = y(d.iso3)
      const isCol = d.iso3 === 'COL'
      const premium = d.usd_per_kg >= avg
      g.append('rect').attr('x', 0).attr('y', yy).attr('height', y.bandwidth())
        .attr('width', x(d.usd_per_kg)).attr('rx', 2)
        .attr('fill', isCol ? BRAND : (premium ? GREEN : COMMODITY))
        .attr('opacity', isCol || premium ? 1 : 0.7)
        .on('pointermove', (e) => tipTier(e, d, premium))
        .on('pointerleave', hideTip)
      g.append('text').attr('x', -8).attr('y', yy + y.bandwidth() / 2)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
        .attr('font-size', 11).attr('font-weight', isCol ? 700 : 400)
        .attr('fill', isCol ? BRAND : 'rgb(212 212 212)')
        .text(nameOf(d.iso3))
      g.append('text').attr('x', x(d.usd_per_kg) + 5).attr('y', yy + y.bandwidth() / 2)
        .attr('dominant-baseline', 'central').attr('font-size', 10)
        .attr('fill', AXIS_TEXT).text(fmtPerKg(d.usd_per_kg))
    }

    // Market-average reference line = boundary between premium and commodity tiers.
    const ax = x(avg)
    g.append('line').attr('x1', ax).attr('x2', ax).attr('y1', -8).attr('y2', innerH)
      .attr('stroke', 'rgb(212 212 212)').attr('stroke-dasharray', '3 3').attr('stroke-width', 1)
    g.append('text').attr('x', ax).attr('y', -10).attr('text-anchor', 'middle')
      .attr('font-size', 9).attr('fill', AXIS_TEXT)
      .text(`Promedio ${fmtPerKg(avg)}`)

    function tipTier(e, d, premium) {
      showTip(
        `<div class="font-semibold">${nameOf(d.iso3)}</div>` +
        `<div>${fmtPerKg(d.usd_per_kg)} · ${premium ? 'premium' : 'comodín'}</div>` +
        `<div class="text-neutral-400">Volumen: ${fmtKg(d.kg)}</div>`,
        e.offsetX + 12, e.offsetY - 8,
      )
    }
  }

  function renderColombia() {
    const { width, height } = dims
    const M = { top: 6, right: 12, bottom: 22, left: 46 }
    const innerW = Math.max(0, width - M.left - M.right)
    const innerH = Math.max(0, height - M.top - M.bottom)

    const c = data.colombia
    const years = c.years
    const x = d3.scaleBand().domain(years).range([0, innerW]).padding(0.2)
    const yMax = d3.max(years, (_, i) => c.green[i] + c.roasted[i]) || 1
    const yS = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0])

    const svg = newSvg()
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((d) => `'${String(d).slice(2)}`))
      .call((s) => s.selectAll('text').attr('fill', AXIS_TEXT).attr('font-size', 10))
      .call((s) => s.selectAll('line, path').attr('stroke', AXIS_LINE))
    g.append('g')
      .call(d3.axisLeft(yS).ticks(4).tickFormat(axisUsd))
      .call((s) => s.selectAll('text').attr('fill', AXIS_TEXT))
      .call((s) => s.selectAll('line, path').attr('stroke', AXIS_LINE))

    years.forEach((yr, i) => {
      const xx = x(yr)
      const g0 = c.green[i]
      const r0 = c.roasted[i]
      g.append('rect').attr('x', xx).attr('width', x.bandwidth())
        .attr('y', yS(g0)).attr('height', innerH - yS(g0)).attr('fill', GREEN)
        .on('pointermove', (e) => tipCol(e, yr, 'Verde', g0, g0, r0))
        .on('pointerleave', hideTip)
      g.append('rect').attr('x', xx).attr('width', x.bandwidth())
        .attr('y', yS(g0 + r0)).attr('height', yS(g0) - yS(g0 + r0)).attr('fill', ROASTED)
        .on('pointermove', (e) => tipCol(e, yr, 'Tostado', r0, g0, r0))
        .on('pointerleave', hideTip)
    })

    function tipCol(e, yr, label, val, g0, r0) {
      showTip(
        `<div class="font-semibold">${yr}</div>` +
        `<div>${label}: ${fmtUsd(val)}</div>` +
        `<div class="text-neutral-400">Verde ${fmtUsd(g0)} · Tostado ${fmtUsd(r0)}</div>`,
        e.offsetX + 12, e.offsetY - 8,
      )
    }
  }
}
