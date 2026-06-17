// Single source of truth for the selected VRAM (GB). Subscribers fire
// immediately on subscribe (same convention as the dashboard store).

export function createHwState(initialVram = 24) {
  let vram = initialVram;
  const subs = new Set();
  return {
    get: () => vram,
    set(v) {
      if (v === vram) return;
      vram = v;
      subs.forEach(fn => fn(vram));
    },
    subscribe(fn) {
      subs.add(fn);
      fn(vram);
      return () => subs.delete(fn);
    },
  };
}
