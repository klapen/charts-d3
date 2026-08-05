export function mountModeToggle(el, store) {
  el.className = 'mode-toggle';
  el.innerHTML = `
    <button data-mode="model">I have a model →</button>
    <button data-mode="pc">← I have a PC</button>`;
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    store.set({ mode: b.dataset.mode });
  });
  store.subscribe(s => {
    el.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === s.mode));
  });
}
