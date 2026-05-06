import '../../src/styles/main.css'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import * as echarts from 'echarts'
import municipalities from './data/municipalities.geojson?url'
import department from './data/department.geojson?url'
import infoMpio from './data/info_mpio.json'
import deptPopulation from './data/pob_choco.json'

const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

const i18n = {
  en: {
    selectPrompt: 'Select a municipality on the map',
    notAvailable: 'No data available',
  },
  es: {
    selectPrompt: 'Selecciona un municipio en el mapa',
    notAvailable: 'Sin datos disponibles',
  },
}

const STAT_LABELS_ES = {
  Subregion: 'Subregión',
  'Total Poblacional (personas)': 'Población total',
  'Cabecera (personas)': 'Cabecera',
  'Resto (personas)': 'Resto',
  Hombres: 'Hombres',
  Mujeres: 'Mujeres',
  'Población Económicamente Activa (personas)': 'Población activa',
  'Población Inactiva (personas)': 'Población inactiva',
  Hogares: 'Hogares',
}

const STAT_LABELS_EN = {
  Subregion: 'Subregion',
  'Total Poblacional (personas)': 'Total population',
  'Cabecera (personas)': 'Urban',
  'Resto (personas)': 'Rural',
  Hombres: 'Men',
  Mujeres: 'Women',
  'Población Económicamente Activa (personas)': 'Active population',
  'Población Inactiva (personas)': 'Inactive population',
  Hogares: 'Households',
}

const PRIMARY_STATS = Object.keys(STAT_LABELS_ES)

let lang = detectLang()
let selectedFeature = null
let municipalityLayer = null
let map = null
const featureToLayer = new Map()

function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored)) return stored
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return SUPPORTED.includes(nav) ? nav : 'es'
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
  if (selectedFeature) populatePanel(selectedFeature)
  else showEmpty()
}

const STYLES = {
  base: {
    color: '#525252',
    weight: 0.8,
    fillColor: '#ff6b35',
    fillOpacity: 0.18,
  },
  hover: {
    color: '#fafafa',
    weight: 1.5,
    fillColor: '#ff6b35',
    fillOpacity: 0.42,
  },
  selected: {
    color: '#ff6b35',
    weight: 2.5,
    fillColor: '#ff6b35',
    fillOpacity: 0.6,
  },
}

async function init() {
  map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    scrollWheelZoom: false,
  })
  L.control.attribution({ prefix: false }).addTo(map)

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    },
  ).addTo(map)

  const [deptData, mpioData] = await Promise.all([
    fetch(department).then((r) => r.json()),
    fetch(municipalities).then((r) => r.json()),
  ])

  L.geoJSON(deptData, {
    style: {
      color: '#ff6b35',
      weight: 2,
      fill: false,
      dashArray: '4,4',
    },
  }).addTo(map)

  municipalityLayer = L.geoJSON(mpioData, {
    style: () => STYLES.base,
    onEachFeature: (feature, layer) => {
      featureToLayer.set(feature.properties.ID_ESPACIA, layer)
      const name = mpioName(feature)
      layer.bindTooltip(name, {
        sticky: true,
        className: 'choco-tooltip',
        direction: 'top',
      })
      layer.on('mouseover', () => {
        if (feature !== selectedFeature) layer.setStyle(STYLES.hover)
      })
      layer.on('mouseout', () => {
        if (feature !== selectedFeature) layer.setStyle(STYLES.base)
      })
      layer.on('click', () => selectFeature(feature, layer))
    },
  }).addTo(map)

  map.fitBounds(municipalityLayer.getBounds(), { padding: [12, 12] })
}

function mpioName(feature) {
  const id = feature.properties.ID_ESPACIA
  const fromInfo = infoMpio[id]?.name
  return fromInfo || titleCase(feature.properties.NOM_MUNICI || id)
}

function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/(^|\s|-)\w/g, (m) => m.toUpperCase())
}

function selectFeature(feature, layer) {
  if (selectedFeature) {
    const prev = featureToLayer.get(selectedFeature.properties.ID_ESPACIA)
    prev?.setStyle(STYLES.base)
  }
  selectedFeature = feature
  layer.setStyle(STYLES.selected)
  layer.bringToFront()
  populatePanel(feature)
}

function populatePanel(feature) {
  const id = feature.properties.ID_ESPACIA
  const info = infoMpio[id]
  const card = document.getElementById('mpio-card')
  const empty = document.getElementById('mpio-empty')
  const nameEl = document.getElementById('mpio-name')
  const statsEl = document.getElementById('mpio-stats')

  empty.classList.add('hidden')
  card.classList.remove('hidden')
  nameEl.textContent = mpioName(feature)

  if (!info) {
    statsEl.innerHTML = `<dd class="col-span-2 text-neutral-500 text-center">${i18n[lang].notAvailable}</dd>`
    return
  }

  const labels = lang === 'en' ? STAT_LABELS_EN : STAT_LABELS_ES
  const rows = info.data.population
    .filter((p) => PRIMARY_STATS.includes(p.name))
    .map((p) => {
      const label = labels[p.name] ?? p.name
      const value = formatValue(p.data)
      return `
        <dt class="text-neutral-400">${label}</dt>
        <dd class="text-right tabular-nums">${value}</dd>
      `
    })
    .join('')
  statsEl.innerHTML = rows
}

function formatValue(v) {
  if (typeof v === 'number') {
    return v.toLocaleString(lang === 'en' ? 'en-US' : 'es-CO')
  }
  return v
}

function showEmpty() {
  document.getElementById('mpio-card').classList.add('hidden')
  document.getElementById('mpio-empty').classList.remove('hidden')
}

// ============================================================================
// Department charts (ECharts)
// ============================================================================

const AGE_GROUPS = [
  '0-4', '5-9', '10-14', '15-19', '20-24', '25-29',
  '30-34', '35-39', '40-44', '45-49', '50-54', '55-59',
  '60-64', '65-69', '70-74', '75-79', '80 Y MÁS',
]

const populationByYear = new Map(deptPopulation.map((d) => [d.Year, d]))

const RADAR_INDICATORS = [
  { key: 'icv', es: 'ICV', en: 'Quality of life', value: 54.12 },
  { key: 'nbs', es: 'NBI (inv.)', en: 'NBI (inv.)', value: 100 - 79.84 },
  { key: 'salud', es: 'Cob. salud', en: 'Health cov.', value: 99.85 },
  { key: 'edu', es: 'Cob. educación', en: 'Education cov.', value: 43.35 },
  { key: 'agua', es: 'Cob. acueducto', en: 'Water cov.', value: 21.49 },
]

const LAND_USE = [
  { es: 'Área agrícola', en: 'Agricultural', value: 27.09 },
  { es: 'Bosques', en: 'Forests', value: 72.65 },
  { es: 'Otros usos', en: 'Other', value: 0.25 },
]

const INCOME = [
  { es: 'Ingresos corrientes', en: 'Current income', value: 5804.87 },
  { es: 'Ingresos de capital', en: 'Capital income', value: 72600.41 },
]

const SECURITY_YEARS = Array.from({ length: 32 }, (_, i) => 1984 + i)
const SECURITY_EXPELLED = [
  4047, 229, 306, 331, 259, 692, 798, 618, 867, 668,
  1124, 6399, 11226, 64906, 10450, 9923, 23432, 31344, 45946, 14188,
  17293, 16559, 12862, 18022, 16319, 10353, 7701, 12800, 18469, 16798,
  14593, 5244,
]
const SECURITY_RECEIVED = [
  154, 126, 118, 265, 174, 418, 209, 213, 403, 408,
  710, 4804, 4496, 19036, 5655, 6366, 15327, 21065, 33335, 9608,
  10089, 11735, 6324, 11036, 8877, 6965, 4377, 8187, 10618, 9162,
  7965, 3037,
]

const CHART_I18N = {
  en: {
    male: 'Men',
    female: 'Women',
    expelled: 'Expelled',
    received: 'Received',
    chocoVsScale: 'Chocó (0–100 scale)',
    landUseTitle: 'Land use (%)',
    incomeTitle: 'Total income (millions COP)',
    incomeTotal: 'Total: 78,405',
    incomePctOf: 'of total',
    pctOfTotal: '% of total',
  },
  es: {
    male: 'Hombres',
    female: 'Mujeres',
    expelled: 'Expulsados',
    received: 'Recibidos',
    chocoVsScale: 'Chocó (escala 0–100)',
    landUseTitle: 'Uso de la tierra (%)',
    incomeTitle: 'Ingresos totales (millones COP)',
    incomeTotal: 'Total: 78.405',
    incomePctOf: 'del total',
    pctOfTotal: '% del total',
  },
}

const baseChartTheme = {
  backgroundColor: 'transparent',
  textStyle: {
    color: '#a3a3a3',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
}

const charts = new Map()
const tabPanels = new Map()
let activeTab = 'poblacion'
let pyramidYear = 2015

function chartContainer(id) {
  return document.getElementById(id)
}

function ensureChart(id) {
  if (charts.has(id)) return charts.get(id)
  const el = chartContainer(id)
  if (!el) return null
  const inst = echarts.init(el, null, { renderer: 'svg' })
  charts.set(id, inst)
  return inst
}

function fmtNumber(n) {
  return Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO')
}

function pyramidOption() {
  const t = CHART_I18N[lang]
  const yearData = populationByYear.get(pyramidYear)
  if (!yearData) return {}
  const males = AGE_GROUPS.map((g) => -yearData.Hombres[g])
  const females = AGE_GROUPS.map((g) => yearData.Mujeres[g])
  const maxAbs = Math.max(...males.map(Math.abs), ...females)

  return {
    ...baseChartTheme,
    grid: { left: 80, right: 24, top: 24, bottom: 40 },
    legend: { textStyle: { color: '#d4d4d4' }, top: 0 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#171717',
      borderColor: '#404040',
      textStyle: { color: '#f5f5f5' },
      formatter: (params) => {
        const age = params[0].axisValue
        const lines = params.map(
          (p) =>
            `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${fmtNumber(Math.abs(p.value))}</b>`,
        )
        return `<div style="font-weight:600">${age}</div>${lines.join('<br/>')}`
      },
    },
    xAxis: {
      type: 'value',
      max: maxAbs,
      min: -maxAbs,
      axisLine: { lineStyle: { color: '#404040' } },
      splitLine: { lineStyle: { color: '#262626' } },
      axisLabel: {
        color: '#a3a3a3',
        formatter: (v) => fmtNumber(Math.abs(v)),
      },
    },
    yAxis: {
      type: 'category',
      data: AGE_GROUPS,
      axisLine: { lineStyle: { color: '#404040' } },
      axisTick: { show: false },
      axisLabel: { color: '#a3a3a3' },
    },
    series: [
      {
        name: t.male,
        type: 'bar',
        stack: 'population',
        data: males,
        itemStyle: { color: '#4f7cac' },
        emphasis: { itemStyle: { color: '#6e9bd1' } },
        barWidth: '85%',
      },
      {
        name: t.female,
        type: 'bar',
        stack: 'population',
        data: females,
        itemStyle: { color: '#c0392b' },
        emphasis: { itemStyle: { color: '#e15546' } },
        barWidth: '85%',
      },
    ],
  }
}

function radarOption() {
  const t = CHART_I18N[lang]
  return {
    ...baseChartTheme,
    tooltip: {
      backgroundColor: '#171717',
      borderColor: '#404040',
      textStyle: { color: '#f5f5f5' },
    },
    legend: { textStyle: { color: '#d4d4d4' }, bottom: 0 },
    radar: {
      indicator: RADAR_INDICATORS.map((d) => ({
        name: lang === 'en' ? d.en : d.es,
        max: 100,
      })),
      axisName: { color: '#d4d4d4', fontSize: 11 },
      splitLine: { lineStyle: { color: '#262626' } },
      splitArea: { areaStyle: { color: ['#0a0a0a', '#171717'] } },
      axisLine: { lineStyle: { color: '#404040' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            name: t.chocoVsScale,
            value: RADAR_INDICATORS.map((d) => d.value),
            lineStyle: { color: '#ff6b35', width: 2 },
            itemStyle: { color: '#ff6b35' },
            areaStyle: { color: 'rgba(255, 107, 53, 0.25)' },
          },
        ],
      },
    ],
  }
}

function donutOption(items, title) {
  const t = CHART_I18N[lang]
  const total = items.reduce((s, d) => s + d.value, 0)
  return {
    ...baseChartTheme,
    legend: { textStyle: { color: '#d4d4d4' }, bottom: 0 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#171717',
      borderColor: '#404040',
      textStyle: { color: '#f5f5f5' },
      formatter: (p) =>
        `<b>${p.name}</b><br/>${fmtNumber(p.value.toFixed(2))} (${(
          (p.value / total) *
          100
        ).toFixed(1)}${t.pctOfTotal})`,
    },
    color: ['#ff6b35', '#38bdf8', '#fbbf24', '#a3e635'],
    series: [
      {
        type: 'pie',
        radius: ['52%', '78%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: '#0a0a0a',
          borderWidth: 2,
        },
        label: {
          color: '#d4d4d4',
          formatter: (p) => `${p.name}\n${p.percent.toFixed(1)}%`,
        },
        labelLine: { lineStyle: { color: '#525252' } },
        data: items.map((d) => ({
          name: lang === 'en' ? d.en : d.es,
          value: d.value,
        })),
      },
    ],
    title: {
      text: title,
      left: 'center',
      top: 0,
      textStyle: { color: '#d4d4d4', fontSize: 13, fontWeight: 500 },
    },
  }
}

function securityOption() {
  const t = CHART_I18N[lang]
  return {
    ...baseChartTheme,
    grid: { left: 64, right: 24, top: 32, bottom: 56 },
    legend: { textStyle: { color: '#d4d4d4' }, top: 0 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#171717',
      borderColor: '#404040',
      textStyle: { color: '#f5f5f5' },
      formatter: (params) => {
        const year = params[0].axisValue
        const lines = params.map(
          (p) =>
            `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${fmtNumber(p.value)}</b>`,
        )
        return `<div style="font-weight:600">${year}</div>${lines.join('<br/>')}`
      },
    },
    xAxis: {
      type: 'category',
      data: SECURITY_YEARS,
      axisLine: { lineStyle: { color: '#404040' } },
      axisLabel: { color: '#a3a3a3' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#404040' } },
      splitLine: { lineStyle: { color: '#262626' } },
      axisLabel: {
        color: '#a3a3a3',
        formatter: (v) => fmtNumber(v),
      },
    },
    series: [
      {
        name: t.expelled,
        type: 'line',
        data: SECURITY_EXPELLED,
        smooth: 0.2,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#ff6b35', width: 2 },
        itemStyle: { color: '#ff6b35' },
        areaStyle: { color: 'rgba(255, 107, 53, 0.15)' },
      },
      {
        name: t.received,
        type: 'line',
        data: SECURITY_RECEIVED,
        smooth: 0.2,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#38bdf8', width: 2 },
        itemStyle: { color: '#38bdf8' },
        areaStyle: { color: 'rgba(56, 189, 248, 0.12)' },
      },
    ],
  }
}

const chartConfigs = {
  poblacion: { id: 'chart-pyramid', option: pyramidOption },
  socio: { id: 'chart-radar', option: radarOption },
  geo: {
    id: 'chart-area',
    option: () => donutOption(LAND_USE, CHART_I18N[lang].landUseTitle),
  },
  finance: {
    id: 'chart-finance',
    option: () => donutOption(INCOME, CHART_I18N[lang].incomeTitle),
  },
  security: { id: 'chart-security', option: securityOption },
}

function renderChart(tabKey) {
  const cfg = chartConfigs[tabKey]
  if (!cfg) return
  const inst = ensureChart(cfg.id)
  if (!inst) return
  inst.setOption(cfg.option(), true)
  inst.resize()
}

function activateTab(name) {
  activeTab = name
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const active = btn.dataset.tab === name
    btn.setAttribute('aria-selected', active)
    btn.classList.toggle('text-neutral-100', active)
    btn.classList.toggle('border-brand', active)
    btn.classList.toggle('text-neutral-400', !active)
    btn.classList.toggle('border-transparent', !active)
  })
  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    const active = panel.dataset.tabPanel === name
    panel.classList.toggle('hidden', !active)
  })
  renderChart(name)
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab))
    tabPanels.set(btn.dataset.tab, btn)
  })
  activateTab(activeTab)
}

function setupPyramidSlider() {
  const slider = document.getElementById('dept-year')
  const label = document.getElementById('dept-year-label')
  slider.addEventListener('input', (e) => {
    pyramidYear = Number(e.target.value)
    label.textContent = pyramidYear
    if (activeTab === 'poblacion') renderChart('poblacion')
  })
}

function refreshChartsForLang() {
  for (const tabKey of Object.keys(chartConfigs)) {
    if (charts.has(chartConfigs[tabKey].id)) renderChart(tabKey)
  }
}

let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    charts.forEach((inst) => inst.resize())
  }, 150)
})

function applyLangWithCharts(next) {
  applyLang(next)
  refreshChartsForLang()
}

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyLangWithCharts(btn.dataset.lang))
})

applyLang(lang)
setupTabs()
setupPyramidSlider()
init()
