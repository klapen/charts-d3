// Breakpoint table, ordered widest-first so .find() picks the right one.
// minWidth is measured against the chart CONTAINER's clientWidth, not the
// viewport, because the chart lives in a 2/3 grid column on desktop.
export const BREAKPOINTS = [
  { name: 'lg', minWidth: 1000, w: 1280, h: 720 },
  { name: 'md', minWidth:  680, w: 1080, h: 660 },
  { name: 'sm', minWidth:  420, w:  720, h: 480 },
  { name: 'xs', minWidth:    0, w:  480, h: 420 },
]

export function pickBreakpoint(containerWidth) {
  return BREAKPOINTS.find(bp => containerWidth >= bp.minWidth)
}

export function debounce(fn, ms) {
  let t = null
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

// Calls onChange(next, prev) once at install and again every time the
// container crosses a breakpoint threshold. Returns a teardown.
export function observeBreakpoint(container, onChange) {
  let current = pickBreakpoint(container.clientWidth)
  onChange(current, null)
  const handler = debounce(() => {
    const next = pickBreakpoint(container.clientWidth)
    if (next.name === current.name) return
    const prev = current
    current = next
    onChange(next, prev)
  }, 150)
  const ro = new ResizeObserver(handler)
  ro.observe(container)
  return () => ro.disconnect()
}
