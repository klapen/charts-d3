// 30-line pub/sub. setState merges partial; subscribe fires on every change.
const listeners = new Set()
let state = {
  year: null,         // set from meta.years.at(-1) at boot
  type: 'all',        // 'all' | 'green' | 'roasted'
  tier: 'top',        // 'top' | 'full'
  playing: false,
  hoveredId: null,    // ISO3 of hovered node or null
  pinnedId: null,     // ISO3 of pinned node
  lang: 'en',         // 'en' | 'es'
}

export function getState() { return state }

export function setState(patch) {
  const prev = state
  state = { ...state, ...patch }
  for (const fn of listeners) fn(state, prev)
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
