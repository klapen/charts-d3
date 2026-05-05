import '../styles/main.css'

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
  document.querySelectorAll(`[data-${lang}-placeholder]`).forEach((el) => {
    el.placeholder = el.dataset[`${lang}Placeholder`]
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

const cards = document.querySelectorAll('[data-viz-card]')
const filterButtons = document.querySelectorAll('.filter-btn')
const searchInput = document.querySelector('#search')
const emptyState = document.querySelector('#empty-state')

let activeFilter = 'all'
let activeSearch = ''

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
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter
    filterButtons.forEach((b) => {
      const active = b === btn
      b.classList.toggle('bg-brand', active)
      b.classList.toggle('text-white', active)
      b.classList.toggle('bg-neutral-800', !active)
      b.setAttribute('aria-pressed', active)
    })
    applyFilters()
  })
})

searchInput?.addEventListener('input', (e) => {
  activeSearch = e.target.value.toLowerCase().trim()
  applyFilters()
})

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang))
})

applyLang(detectLang())
