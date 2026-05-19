export function createParticleLayer(container, { w, h, dpr }) {
  const canvas = document.createElement('canvas')
  canvas.style.pointerEvents = 'none'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  function resize(next) {
    canvas.width  = next.w * next.dpr
    canvas.height = next.h * next.dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(next.dpr, next.dpr)
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

    const cw = canvas.width / window.devicePixelRatio
    const ch = canvas.height / window.devicePixelRatio
    ctx.clearRect(0, 0, cw, ch)

    if (!reducedMotion && currentScales) {
      for (const p of particles) {
        const e = currentEdges[p.edgeIndex]
        const sx = e.source.x, sy = e.source.y
        const tx = e.target.x, ty = e.target.y
        if (sx == null || tx == null) continue
        p.t += p.speed * (dt / 16)
        if (p.t > 1) p.t -= 1
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
  }

  return { rebuild, resize, start, stop, destroy, setReducedMotion, canvas }
}
