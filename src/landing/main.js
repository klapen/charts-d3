import '../styles/main.css'

const cards = document.querySelectorAll('[data-viz-card]')
const filterButtons = document.querySelectorAll('[data-filter]')
const searchInput = document.querySelector('#search')

let activeFilter = 'all'
let activeSearch = ''

function applyFilters() {
  cards.forEach((card) => {
    const tags = (card.dataset.tags || '').split(',')
    const title = (card.dataset.title || '').toLowerCase()
    const matchesFilter = activeFilter === 'all' || tags.includes(activeFilter)
    const matchesSearch = !activeSearch || title.includes(activeSearch)
    card.classList.toggle('hidden', !(matchesFilter && matchesSearch))
  })
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter
    filterButtons.forEach((b) => b.classList.toggle('bg-brand', b === btn))
    filterButtons.forEach((b) => b.classList.toggle('text-white', b === btn))
    applyFilters()
  })
})

searchInput?.addEventListener('input', (e) => {
  activeSearch = e.target.value.toLowerCase().trim()
  applyFilters()
})
