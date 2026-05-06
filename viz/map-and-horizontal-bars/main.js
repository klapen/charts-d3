import '../../src/styles/main.css'
import * as d3 from 'd3'
import csvText from './data/data.csv?raw'
import svgText from './data/colombia.svg?raw'

const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

const METRIC_META = {
  pop_density_2015: {
    color: '#ff6b35',
    en: 'Population density',
    es: 'Densidad de población',
    enUnit: 'pop/km²',
    esUnit: 'hab/km²',
    decimals: 1,
  },
  pib_corriente_2014pr: {
    color: '#fbbf24',
    en: 'GDP (current)',
    es: 'PIB corrientes',
    enUnit: 'B COP',
    esUnit: 'mM COP',
    decimals: 0,
  },
  pib_cons_2005_2014pr: {
    color: '#a3e635',
    en: 'GDP (constant 2005)',
    es: 'PIB constantes 2005',
    enUnit: 'B COP',
    esUnit: 'mM COP',
    decimals: 0,
  },
  expo_2015: {
    color: '#38bdf8',
    en: 'Exports',
    es: 'Exportaciones',
    enUnit: 'M USD',
    esUnit: 'millones USD',
    decimals: 1,
  },
  impo_2015: {
    color: '#a78bfa',
    en: 'Imports',
    es: 'Importaciones',
    enUnit: 'K USD',
    esUnit: 'miles USD',
    decimals: 1,
  },
}

function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored)) return stored
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return SUPPORTED.includes(nav) ? nav : 'es'
}

let lang = detectLang()
let metric = 'pop_density_2015'
let selectedDivipola = null

const data = d3.csvParse(csvText, (row) => ({
  name: row.name,
  divipola: row.divipola,
  pop_density_2015: +row.pop_density_2015,
  pib_corriente_2014pr: +row.pib_corriente_2014pr,
  pib_cons_2005_2014pr: +row.pib_cons_2005_2014pr,
  expo_2015: +row.expo_2015,
  impo_2015: +row.impo_2015,
}))
const byDivipola = new Map(data.map((d) => [d.divipola, d]))

const mapContainer = document.getElementById('map-container')
mapContainer.innerHTML = svgText
const mapSvg = d3.select(mapContainer).select('svg')
mapSvg
  .attr('width', null)
  .attr('height', null)
  .style('width', '100%')
  .style('height', 'auto')
  .style('max-height', '600px')

const paths = mapSvg.selectAll('path[id^="divi-"]')

paths
  .style('cursor', 'pointer')
  .style('transition', 'fill-opacity 0.3s, stroke 0.15s')
  .on('click', function () {
    const id = this.id.replace('divi-', '')
    selectedDivipola = selectedDivipola === id ? null : id
    render()
  })
  .on('mouseover', function () {
    d3.select(this).attr('stroke', '#fafafa').attr('stroke-width', 1.2)
  })
  .on('mouseout', function () {
    d3.select(this).attr('stroke', null)
  })

const tooltip = mapSvg.append('g').attr('class', 'mhb-tooltip').style('pointer-events', 'none')
tooltip.style('display', 'none')

paths.on('mousemove', function (event) {
  const id = this.id.replace('divi-', '')
  const d = byDivipola.get(id)
  if (!d) return
  const meta = METRIC_META[metric]
  const value = d[metric]
  const label = lang === 'en' ? meta.en : meta.es
  const unit = lang === 'en' ? meta.enUnit : meta.esUnit
  const formatted = `${value.toLocaleString(lang === 'en' ? 'en-US' : 'es-CO', {
    maximumFractionDigits: meta.decimals,
  })} ${unit}`

  tooltip.selectAll('*').remove()
  tooltip.style('display', null)
  const [x, y] = d3.pointer(event, mapSvg.node())
  const text = tooltip
    .append('text')
    .attr('x', x + 12)
    .attr('y', y - 8)
    .attr('fill', '#fafafa')
    .attr('font-size', 22)
    .attr('font-family', 'ui-sans-serif, system-ui, sans-serif')
    .style('paint-order', 'stroke')
    .attr('stroke', '#0a0a0a')
    .attr('stroke-width', 5)
    .attr('stroke-linejoin', 'round')
  text.append('tspan').attr('x', x + 12).attr('dy', 0).text(d.name)
  text.append('tspan').attr('x', x + 12).attr('dy', 26).attr('font-size', 18).attr('font-weight', 600).text(formatted)
  text.append('tspan').attr('x', x + 12).attr('dy', 22).attr('font-size', 14).attr('fill', '#a3a3a3').text(label)
})

paths.on('mouseleave', () => tooltip.style('display', 'none'))

function getOpacity(value, max, min) {
  if (max === min) return 0.6
  const t = (value - min) / (max - min)
  return 0.2 + t * 0.8
}

function colorMap(animate = true) {
  const meta = METRIC_META[metric]
  const values = data.map((d) => d[metric])
  const max = Math.max(...values)
  const min = Math.min(...values)

  function fillFor() {
    const id = this.id.replace('divi-', '')
    return byDivipola.has(id) ? meta.color : '#404040'
  }
  function opacityFor() {
    const id = this.id.replace('divi-', '')
    const d = byDivipola.get(id)
    if (!d) return 0.3
    if (selectedDivipola === id) return 1
    return getOpacity(d[metric], max, min)
  }

  const target = animate
    ? paths.transition().duration(750).ease(d3.easeCubicInOut)
    : paths

  target.style('fill', fillFor).style('fill-opacity', opacityFor)

  paths
    .style('stroke', function () {
      return selectedDivipola === this.id.replace('divi-', '')
        ? '#fafafa'
        : null
    })
    .style('stroke-width', function () {
      return selectedDivipola === this.id.replace('divi-', '') ? 1.5 : 0
    })
}

const barsEl = document.getElementById('bars-chart')

const BAR_MARGIN = { top: 8, right: 96, bottom: 24, left: 110 }
const BAR_ROW_HEIGHT = 16
let barSvg = null
let barInner = null

function ensureBarsSvg() {
  if (barSvg) return
  const width = Math.min(barsEl.clientWidth || 540, 640)
  const height = Math.max(420, data.length * BAR_ROW_HEIGHT)
  barSvg = d3
    .select(barsEl)
    .append('svg')
    .attr('width', width)
    .attr('height', height + BAR_MARGIN.top + BAR_MARGIN.bottom)
    .style('display', 'block')
    .style('font-family', 'ui-sans-serif, system-ui, sans-serif')

  barInner = barSvg
    .append('g')
    .attr('transform', `translate(${BAR_MARGIN.left},${BAR_MARGIN.top})`)
  barInner.append('g').attr('class', 'x-axis')
  barInner.append('g').attr('class', 'bars')
}

function getBarsDimensions() {
  const width = Math.min(barsEl.clientWidth || 540, 640)
  const innerWidth = width - BAR_MARGIN.left - BAR_MARGIN.right
  const innerHeight = data.length * BAR_ROW_HEIGHT
  return { width, innerWidth, innerHeight }
}

function renderBars(animate = true) {
  ensureBarsSvg()
  const meta = METRIC_META[metric]
  const sorted = [...data].sort((a, b) => b[metric] - a[metric])
  const { width, innerWidth, innerHeight } = getBarsDimensions()

  barSvg
    .attr('width', width)
    .attr('height', innerHeight + BAR_MARGIN.top + BAR_MARGIN.bottom)

  const xMax = d3.max(sorted, (d) => d[metric]) ?? 1
  const x = d3.scaleLinear().domain([0, xMax]).nice().range([0, innerWidth])
  const y = d3
    .scaleBand()
    .domain(sorted.map((d) => d.name))
    .range([0, innerHeight])
    .padding(0.18)

  const fmt = (v) =>
    v.toLocaleString(lang === 'en' ? 'en-US' : 'es-CO', {
      maximumFractionDigits: meta.decimals,
    })

  const t = animate
    ? d3.transition().duration(750).ease(d3.easeCubicInOut)
    : null

  // X axis
  const xAxisG = barInner.select('.x-axis')
  const axis = d3
    .axisTop(x)
    .ticks(4)
    .tickSize(-innerHeight - BAR_MARGIN.bottom)
    .tickFormat((v) => v.toLocaleString(lang === 'en' ? 'en-US' : 'es-CO'))
  ;(animate ? xAxisG.transition(t) : xAxisG).call(axis)
  xAxisG.selectAll('.domain').remove()
  xAxisG.selectAll('text').attr('fill', '#a3a3a3').attr('font-size', 10)
  xAxisG.selectAll('line').attr('stroke', '#262626')

  // Bars
  const barsG = barInner.select('.bars')
  const groups = barsG
    .selectAll('g.bar')
    .data(sorted, (d) => d.divipola)

  const enter = groups
    .enter()
    .append('g')
    .attr('class', 'bar')
    .attr('transform', (d) => `translate(0,${y(d.name)})`)
    .style('cursor', 'pointer')
    .on('click', (_, d) => {
      selectedDivipola = selectedDivipola === d.divipola ? null : d.divipola
      render()
    })

  enter
    .append('rect')
    .attr('x', 0)
    .attr('height', y.bandwidth())
    .attr('width', 0)
    .attr('fill', meta.color)
    .attr('fill-opacity', 0.7)

  enter
    .append('text')
    .attr('class', 'label')
    .attr('x', -6)
    .attr('y', y.bandwidth() / 2)
    .attr('dy', '.35em')
    .attr('text-anchor', 'end')
    .attr('fill', '#d4d4d4')
    .attr('font-size', 11)
    .text((d) => d.name)

  enter
    .append('text')
    .attr('class', 'value')
    .attr('y', y.bandwidth() / 2)
    .attr('dy', '.35em')
    .attr('fill', '#d4d4d4')
    .attr('font-size', 10)
    .attr('font-weight', 600)
    .attr('text-anchor', 'start')
    .text((d) => fmt(d[metric]))

  const merged = enter.merge(groups)

  ;(animate ? merged.transition(t) : merged)
    .attr('transform', (d) => `translate(0,${y(d.name)})`)

  ;(animate ? merged.select('rect').transition(t) : merged.select('rect'))
    .attr('width', (d) => x(d[metric]))
    .attr('height', y.bandwidth())
    .attr('fill', meta.color)
    .attr('fill-opacity', (d) => (selectedDivipola === d.divipola ? 1 : 0.7))

  merged
    .select('rect')
    .attr('stroke', (d) => (selectedDivipola === d.divipola ? '#fafafa' : null))
    .attr('stroke-width', (d) => (selectedDivipola === d.divipola ? 1.5 : 0))

  ;(animate ? merged.select('.value').transition(t) : merged.select('.value'))
    .attr('y', y.bandwidth() / 2)
    .attr('x', (d) => x(d[metric]) + 4)
    .tween('text', function (d) {
      const i = d3.interpolateNumber(this._lastValue ?? 0, d[metric])
      return (tt) => {
        this._lastValue = i(tt)
        this.textContent = fmt(this._lastValue)
      }
    })

  merged
    .select('.label')
    .attr('y', y.bandwidth() / 2)
    .text((d) => d.name)

  groups.exit().remove()
}

function updateMetricUI() {
  document.querySelectorAll('input[name="metric"]').forEach((input) => {
    const label = input.closest('label')
    const active = input.value === metric
    label.classList.toggle('border-brand', active)
    label.classList.toggle('border-neutral-800', !active)
    label.classList.toggle('bg-neutral-800', active)
    label.classList.toggle('bg-neutral-900', !active)
    input.checked = active
  })
  const meta = METRIC_META[metric]
  document.getElementById('bars-title').textContent =
    lang === 'en' ? meta.en : meta.es
}

function updateSelectedInfo() {
  const el = document.getElementById('selected-info')
  if (!selectedDivipola) {
    el.classList.add('text-center', 'border-dashed', 'text-neutral-500')
    el.classList.remove('text-left')
    el.textContent =
      lang === 'en'
        ? 'Click a department to see its value'
        : 'Haz clic en un departamento para ver su valor'
    return
  }
  const d = byDivipola.get(selectedDivipola)
  if (!d) return
  const meta = METRIC_META[metric]
  const unit = lang === 'en' ? meta.enUnit : meta.esUnit
  const label = lang === 'en' ? meta.en : meta.es
  const value = d[metric].toLocaleString(lang === 'en' ? 'en-US' : 'es-CO', {
    maximumFractionDigits: meta.decimals,
  })
  el.classList.remove('text-center', 'border-dashed', 'text-neutral-500')
  el.classList.add('text-left')
  el.innerHTML = `
    <div class="text-xs text-neutral-500">${label}</div>
    <div class="text-lg font-semibold text-neutral-100 mt-1">${d.name}</div>
    <div class="text-2xl font-bold text-brand mt-1 tabular-nums">${value}</div>
    <div class="text-xs text-neutral-500">${unit}</div>
  `
}

function render() {
  updateMetricUI()
  colorMap()
  renderBars()
  updateSelectedInfo()
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
  render()
}

document.querySelectorAll('input[name="metric"]').forEach((input) => {
  input.addEventListener('change', () => {
    metric = input.value
    render()
  })
})

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang))
})

let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => renderBars(false), 150)
})

applyLang(lang)
