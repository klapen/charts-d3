import '../../src/styles/main.css'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import municipalities from './data/municipalities.geojson?url'
import department from './data/department.geojson?url'
import infoMpio from './data/info_mpio.json'

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

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang))
})

applyLang(lang)
init()
