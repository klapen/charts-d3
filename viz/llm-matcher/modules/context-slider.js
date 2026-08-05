const STEPS = [2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144];
const fmt = n => n >= 1024 ? `${Math.round(n/1024)}K` : `${n}`;
export function mountContextSlider(el, store) {
  el.className = 'ctx-slider';
  el.innerHTML = `<label>context <output></output></label>
    <input type="range" min="0" max="${STEPS.length-1}" value="2" step="1">`;
  const input = el.querySelector('input'), out = el.querySelector('output');
  input.addEventListener('input', () => {
    const tokens = STEPS[+input.value];
    out.textContent = fmt(tokens);
    store.set({ contextTokens: tokens });
  });
  store.subscribe(s => { out.textContent = fmt(s.contextTokens); });
}
