// Shared zoom/pan state for the chart. Renderers and the particle layer
// read `value()` each frame and apply the transform in their own drawing
// space (SVG <g transform>, or ctx.translate/scale on canvas). Animation
// is a per-frame lerp toward `target`, driven by an internal rAF so it
// works even when the simulation has settled.
//
// The transform maps a viewBox-space point (px, py) to
//   (scale * px + tx, scale * py + ty)
// which is the standard "translate then scale" affine.
const LERP = 0.18
const EPS  = 0.001
const MIN_SCALE = 0.5
const MAX_SCALE = 8

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi) }

export function createViewport() {
  let target  = { tx: 0, ty: 0, scale: 1 }
  const current = { tx: 0, ty: 0, scale: 1 }

  function setTarget(t) {
    target = {
      tx: t.tx,
      ty: t.ty,
      scale: clamp(t.scale, MIN_SCALE, MAX_SCALE),
    }
  }
  function value() { return current }
  function reset()  { setTarget({ tx: 0, ty: 0, scale: 1 }) }

  // Multiplicative zoom around a fixed viewBox-space point (vbX, vbY).
  // Math: the target maps p -> scale*p + t. After zooming by `factor`,
  // new scale = factor*scale, and we want T'(vbP) == T(vbP) so the cursor
  // stays anchored: new_t = t + scale*vbP*(1 - factor).
  function zoomBy(factor, vbX, vbY) {
    const newScale = clamp(target.scale * factor, MIN_SCALE, MAX_SCALE)
    const realFactor = newScale / target.scale  // <- accounts for clamp
    target = {
      tx: target.tx + target.scale * vbX * (1 - realFactor),
      ty: target.ty + target.scale * vbY * (1 - realFactor),
      scale: newScale,
    }
  }

  let running = true
  function frame() {
    if (!running) return
    current.tx    += (target.tx    - current.tx)    * LERP
    current.ty    += (target.ty    - current.ty)    * LERP
    current.scale += (target.scale - current.scale) * LERP
    if (Math.abs(target.tx    - current.tx)    < EPS) current.tx    = target.tx
    if (Math.abs(target.ty    - current.ty)    < EPS) current.ty    = target.ty
    if (Math.abs(target.scale - current.scale) < EPS) current.scale = target.scale
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  function destroy() { running = false }

  return { setTarget, value, reset, zoomBy, destroy }
}
