import { getState } from './state.js'

export function createParticleLayer(container, meta, viewport, { w, h, dpr }) {
  const canvas = document.createElement('canvas')
  canvas.style.pointerEvents = 'none'
  // Always render on top of the marble renderer (SVG or Canvas) so particles
  // visibly flow over the nodes rather than under them.
  canvas.style.zIndex = '2'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  // Capture the buffer's true DPR so clearRect doesn't drift if the user
  // moves the window between displays mid-session.
  let currentDpr = dpr
  function resize(next) {
    canvas.width  = next.w * next.dpr
    canvas.height = next.h * next.dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(next.dpr, next.dpr)
    currentDpr = next.dpr
  }
  resize({ w, h, dpr })

  let particles = []  // [{ edgeIndex, t, speed }]
  let currentEdges = []
  let currentScales = null

  function rebuild(edges, scales) {
    currentEdges = edges
    currentScales = scales
    // ~3 particles per top-tier edge, capped
    const target = Math.min(edges.length * 3, 600)
    particles = new Array(target).fill(0).map((_, i) => {
      const edgeIndex = i % edges.length
      const e = edges[edgeIndex]
      // Speed proportional to flow magnitude; normalize to [0.0015, 0.012] per frame
      const norm = Math.sqrt(e.value_usd) / Math.sqrt(scales.maxEdgeValue || 1)
      return {
        edgeIndex,
        t: Math.random(),
        speed: 0.0015 + 0.0105 * norm,
      }
    })
  }

  let lastTime = 0
  let running = false
  let reducedMotion = false

  function setReducedMotion(v) { reducedMotion = v }

  function frame(now) {
    if (!running) return
    const dt = Math.min(50, now - lastTime) || 16
    lastTime = now

    const cw = canvas.width / currentDpr
    const ch = canvas.height / currentDpr
    // Clear without the zoom transform on the stack.
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(currentDpr, currentDpr)
    ctx.clearRect(0, 0, cw, ch)
    ctx.restore()

    if (!reducedMotion && currentScales) {
      const vp = viewport.value()
      ctx.save()
      ctx.translate(vp.tx, vp.ty)
      ctx.scale(vp.scale, vp.scale)
      const { pinnedId, regionFilter, flow } = getState()
      for (const p of particles) {
        const e = currentEdges[p.edgeIndex]
        const sx = e.source.x, sy = e.source.y
        const tx = e.target.x, ty = e.target.y
        if (sx == null || tx == null) continue
        p.t += p.speed * (dt / 16)
        if (p.t > 1) p.t -= 1
        const srcId = e.source.id || e.source
        const tgtId = e.target.id || e.target
        // Pin path: only animate incident edges, with optional flow narrowing.
        if (pinnedId) {
          if (srcId !== pinnedId && tgtId !== pinnedId) continue
          if (flow === 'exports' && srcId !== pinnedId) continue
          if (flow === 'imports' && tgtId !== pinnedId) continue
        } else {
          // No pin. Region filters in-scope endpoints; flow further narrows
          // by net trade role. e.source / e.target are node objects after the
          // first sim tick.
          const sExp = e.source?.exports_usd || 0
          const sImp = e.source?.imports_usd || 0
          const tExp = e.target?.exports_usd || 0
          const tImp = e.target?.imports_usd || 0
          const srcInRegion = !regionFilter || meta.countries[srcId]?.region === regionFilter
          const tgtInRegion = !regionFilter || meta.countries[tgtId]?.region === regionFilter
          if (flow === 'both') {
            // Region scope only — show particles touching the region; no role
            // narrowing. With no region this is the global default.
            if (regionFilter && !(srcInRegion || tgtInRegion)) continue
          } else if (flow === 'exports') {
            if (!(srcInRegion && sExp > sImp)) continue
          } else if (flow === 'imports') {
            if (!(tgtInRegion && tImp > tExp)) continue
          }
        }
        const x = sx + (tx - sx) * p.t
        const y = sy + (ty - sy) * p.t
        ctx.beginPath()
        ctx.fillStyle = e._color || '#ffffff'
        ctx.globalAlpha = 0.7
        const r = currentScales.particleR(e.value_usd)
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.restore()  // pop the zoom transform
    }
    requestAnimationFrame(frame)
  }

  function start() {
    if (running) return
    running = true
    lastTime = performance.now()
    requestAnimationFrame(frame)
  }

  function stop() { running = false }

  function destroy() {
    stop()
    canvas.remove()
    particles = []
    currentEdges = []
    currentScales = null
  }

  return { rebuild, resize, start, stop, destroy, setReducedMotion, canvas }
}
