// Pub/sub store. setState merges a partial patch; subscribers fire on every
// setState — they receive (next, prev) and are expected to diff the slices
// they care about before doing expensive work.
const listeners = new Set()
let state = Object.freeze({
  year: null,         // set from meta.years.at(-1) at boot
  type: 'all',        // 'all' | 'green' | 'roasted'
  tier: 'top',        // 'top' | 'full'
  playing: false,
  hoveredId: null,    // ISO3 of hovered node or null
  pinnedId: null,     // ISO3 of pinned node
  regionFilter: null, // 'South America' | 'Africa' | 'Asia' | 'Europe' | 'North America' | null
  flow: 'both',       // 'both' | 'exports' | 'imports' — narrows edges to outgoing/incoming relative to scope
  lang: 'en',         // 'en' | 'es'
})

export function getState() { return state }

export function setState(patch) {
  const prev = state
  state = Object.freeze({ ...state, ...patch })
  for (const fn of listeners) fn(state, prev)
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
