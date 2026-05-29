import { getState, setState, subscribe } from './state.js'

// Each tab applies a chart preset and shows its narrative panel. The chart
// remains fully interactive afterward — presets are a starting point, not a
// lock.
const PRESETS = {
  insights:  { pinnedId: null,  regionFilter: null, flow: 'both' },
  recent:    { pinnedId: null,  regionFilter: null, flow: 'both' },
  colombia:  { pinnedId: 'COL', regionFilter: null, flow: 'exports' },
  corridors: { pinnedId: null,  regionFilter: null, flow: 'imports' },
}

export function wireTabs() {
  const tabs = document.querySelectorAll('.story-tab')
  const panels = document.querySelectorAll('.narrative-panel')

  // Track the active tab so a language change can re-pick the matching panel
  // without resetting chart state.
  let currentTab = null

  function showPanels(name, lang) {
    for (const p of panels) {
      p.hidden = !(p.dataset.panel === name && p.dataset.lang === lang)
    }
  }

  function activate(name) {
    currentTab = name
    for (const t of tabs) {
      const active = t.dataset.tab === name
      t.setAttribute('aria-selected', String(active))
      t.classList.toggle('border-brand', active)
      t.classList.toggle('text-neutral-50', active)
      t.classList.toggle('text-neutral-400', !active)
    }
    const colombiaChart = document.getElementById('colombia-chart')
    if (colombiaChart) colombiaChart.hidden = name !== 'colombia'
    const brazilChart = document.getElementById('brazil-chart')
    if (brazilChart) brazilChart.hidden = name !== 'brazil'
    showPanels(name, getState().lang)
    const preset = PRESETS[name]
    if (preset) {
      const cur = getState()
      // Only setState for fields that actually change so subscribers don't
      // do redundant work (re-render, re-zoom, etc.).
      const patch = {}
      if (cur.pinnedId !== preset.pinnedId) patch.pinnedId = preset.pinnedId
      if (cur.regionFilter !== preset.regionFilter) patch.regionFilter = preset.regionFilter
      if (cur.flow !== preset.flow) patch.flow = preset.flow
      if (Object.keys(patch).length) setState(patch)
    }
  }

  for (const t of tabs) {
    t.addEventListener('click', () => activate(t.dataset.tab))
  }

  // Re-pick the visible panel when the user toggles EN/ES.
  subscribe((next, prev) => {
    if (next.lang !== prev.lang && currentTab) showPanels(currentTab, next.lang)
  })

  const initial = document.querySelector('.story-tab[aria-selected="true"]')
  if (initial) activate(initial.dataset.tab)
}
