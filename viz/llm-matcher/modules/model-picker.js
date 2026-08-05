export function mountModelPicker(el, store, models) {
  el.className = 'model-picker';
  el.innerHTML = `<input class="mp-search" placeholder="search models…" />
    <ul class="mp-list"></ul>`;
  const search = el.querySelector('.mp-search'), list = el.querySelector('.mp-list');
  const render = (q='') => {
    const items = models
      .filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a,b) => a.params.total_b - b.params.total_b);
    list.innerHTML = items.map(m =>
      `<li data-id="${m.model_id}">${m.name} <span class="mp-sz">${m.params.total_b}B</span></li>`).join('');
  };
  search.addEventListener('input', () => render(search.value));
  list.addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    store.set({ selectedModelId: li.dataset.id, focusModelId: li.dataset.id });
  });
  store.subscribe(s => {
    list.querySelectorAll('li').forEach(li =>
      li.classList.toggle('active', li.dataset.id === s.selectedModelId));
  });
  render();
}
