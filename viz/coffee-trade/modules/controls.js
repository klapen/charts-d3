import { getState, setState, subscribe } from './state.js'

const YEAR_STEP_MS = 1200  // play-mode tick

export function wireControls(meta, onYearChange, onTypeChange, onTierChange) {
  const slider = document.getElementById('year-slider')
  const label = document.getElementById('year-label')
  const play = document.getElementById('play-btn')
  const typeSelect = document.getElementById('type-select')
  const tierButtons = document.querySelectorAll('.tier-btn')

  slider.min = 0
  slider.max = meta.years.length - 1
  const initialIndex = meta.years.length - 1
  slider.value = initialIndex
  label.textContent = meta.years[initialIndex]

  let scrubTimer = null
  slider.addEventListener('input', e => {
    const idx = +e.target.value
    label.textContent = meta.years[idx]
    clearTimeout(scrubTimer)
    scrubTimer = setTimeout(() => {
      setState({ year: meta.years[idx] })
    }, 80)
  })

  let playInterval = null
  function setPlaying(playing) {
    setState({ playing })
    play.textContent = playing
      ? (getState().lang === 'es' ? 'Pausar' : 'Pause')
      : (getState().lang === 'es' ? 'Reproducir' : 'Play')
    if (playing) {
      playInterval = setInterval(() => {
        const cur = +slider.value
        const next = (cur + 1) % meta.years.length
        slider.value = next
        slider.dispatchEvent(new Event('input', { bubbles: true }))
      }, YEAR_STEP_MS)
    } else {
      clearInterval(playInterval)
      playInterval = null
    }
  }
  play.addEventListener('click', () => setPlaying(!getState().playing))

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
    if (e.code === 'Space') {
      e.preventDefault()
      setPlaying(!getState().playing)
    } else if (e.code === 'Escape') {
      setState({ pinnedId: null, hoveredId: null })
    }
  })

  typeSelect.addEventListener('change', e => setState({ type: e.target.value }))

  function reflectTier() {
    const tier = getState().tier
    for (const b of tierButtons) {
      const active = b.dataset.tier === tier
      b.setAttribute('aria-pressed', active)
      b.classList.toggle('border-brand', active)
    }
  }
  for (const b of tierButtons) {
    b.addEventListener('click', () => setState({ tier: b.dataset.tier }))
  }

  // React to state changes
  subscribe((next, prev) => {
    if (next.year !== prev.year) onYearChange(next.year)
    if (next.type !== prev.type) onTypeChange(next.type)
    if (next.tier !== prev.tier) { onTierChange(next.tier); reflectTier() }
    if (next.lang !== prev.lang && next.playing) {
      // Re-label the play button to match new language
      setPlaying(true)
    }
  })

  reflectTier()
}
