import '../styles/main.css'

const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored)) return stored
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return SUPPORTED.includes(nav) ? nav : 'en'
}

const langButtons = document.querySelectorAll('.lang-btn')

function applyLang(lang) {
  document.documentElement.lang = lang
  document.querySelectorAll(`[data-${lang}]`).forEach((el) => {
    const text = el.dataset[lang]
    if (text != null) el.textContent = text
  })
  document.querySelectorAll(`[data-${lang}-placeholder]`).forEach((el) => {
    el.placeholder = el.dataset[`${lang}Placeholder`]
  })
  langButtons.forEach((btn) => {
    const active = btn.dataset.lang === lang
    btn.classList.toggle('active', active)
    btn.setAttribute('aria-pressed', String(active))
  })
  localStorage.setItem(STORAGE_KEY, lang)
}

const cards = document.querySelectorAll('[data-viz-card]')
const filterButtons = document.querySelectorAll('.side-filter')
const searchInput = document.querySelector('#search')
const emptyState = document.querySelector('#empty-state')
const visibleCount = document.querySelector('#visible-count')

let activeFilter = 'all'
let activeSearch = ''

document.querySelectorAll('[data-count]').forEach((el) => {
  const id = el.dataset.count
  el.textContent = id === 'all'
    ? cards.length
    : Array.from(cards).filter((c) => (c.dataset.tags || '').split(',').includes(id)).length
})

function applyFilters() {
  let visible = 0
  cards.forEach((card) => {
    const tags = (card.dataset.tags || '').split(',')
    const title = (card.dataset.title || '').toLowerCase()
    const matchesFilter = activeFilter === 'all' || tags.includes(activeFilter)
    const matchesSearch = !activeSearch || title.includes(activeSearch)
    const show = matchesFilter && matchesSearch
    card.classList.toggle('hidden', !show)
    if (show) visible++
  })
  emptyState?.classList.toggle('hidden', visible > 0)
  if (visibleCount) visibleCount.textContent = visible
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter
    filterButtons.forEach((b) => {
      const active = b === btn
      b.classList.toggle('active', active)
      b.setAttribute('aria-pressed', String(active))
    })
    applyFilters()
  })
})

searchInput?.addEventListener('input', (e) => {
  activeSearch = e.target.value.toLowerCase().trim()
  applyFilters()
})

langButtons.forEach((btn) => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang))
})

applyLang(detectLang())
applyFilters()
