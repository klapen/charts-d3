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
    // Always clear first so the lang-change re-label path can't stack
    // a second setInterval on top of the running one.
    clearInterval(playInterval)
    playInterval = null
    if (playing) {
      playInterval = setInterval(() => {
        const cur = +slider.value
        const next = (cur + 1) % meta.years.length
        slider.value = next
        slider.dispatchEvent(new Event('input', { bubbles: true }))
      }, YEAR_STEP_MS)
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

  // Flow toggles: each chip represents "this direction is included". Both on
  // is the 'both' default. Clicking a chip excludes that direction; clicking
  // the only-on chip is a no-op so we never end up with both off.
  const flowButtons = document.querySelectorAll('.flow-btn')
  function reflectFlow() {
    const flow = getState().flow
    for (const b of flowButtons) {
      const dir = b.dataset.flow  // 'exports' | 'imports'
      const on = flow === 'both' || flow === dir
      b.setAttribute('aria-pressed', String(on))
      b.classList.toggle('border-brand', on)
      b.classList.toggle('text-neutral-500', !on)
    }
  }
  for (const b of flowButtons) {
    b.addEventListener('click', () => {
      const flow = getState().flow
      const dir = b.dataset.flow  // 'exports' or 'imports'
      const other = dir === 'exports' ? 'imports' : 'exports'
      // If both are on, clicking this chip excludes the other direction
      // (i.e., flow becomes the clicked direction).
      if (flow === 'both') setState({ flow: dir })
      // If only this chip is on, restore both. (Don't turn the only-on chip off.)
      else if (flow === dir) setState({ flow: 'both' })
      // If only the OTHER chip is on, clicking this one brings it back to both.
      else if (flow === other) setState({ flow: 'both' })
    })
  }

  // React to state changes
  subscribe((next, prev) => {
    if (next.year !== prev.year) onYearChange(next.year)
    if (next.type !== prev.type) onTypeChange(next.type)
    if (next.tier !== prev.tier) { onTierChange(next.tier); reflectTier() }
    if (next.flow !== prev.flow) reflectFlow()
    if (next.lang !== prev.lang && next.playing) {
      // Re-label the play button to match new language
      setPlaying(true)
    }
  })

  reflectTier()
  reflectFlow()
}
