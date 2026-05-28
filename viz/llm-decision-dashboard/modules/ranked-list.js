// View 1 — Ranked list.
// Renders a sortable list. Click a row → toggle selection.

export function mountRankedList(container, store, { filtered, toggleSelection, isSelected, sortByForPreset }) {
  render();
  store.subscribe(s => ({ filters: s.filters, osi: s.osiOnly, sel: s.selectedIds, preset: s.activePreset }), render);

  function render() {
    const s = store.get();
    if (!s.data) return;
    const rows = filtered(s).slice();
    const sortKey = sortByForPreset(s.activePreset) || 'quality.composite_score';
    rows.sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity));

    const top = rows.slice(0, 25);
    const maxScore = Math.max(...top.map(r => r[sortKey] ?? 0), 0.01);

    container.innerHTML = `
      <div class="text-xs text-neutral-500 mb-2">View 1 — Ranked list · click row to select &amp; reveal details. Sorted by ${prettyPath(sortKey)}.</div>
      <div role="list">
        ${top.map((m, i) => rowHtml(m, i + 1, sortKey, maxScore)).join('')}
      </div>
      ${rows.length > 25 ? `<div class="text-xs text-neutral-600 mt-2">+ ${rows.length - 25} more</div>` : ''}
    `;

    container.querySelectorAll('[data-model-id]').forEach(el => {
      el.addEventListener('click', () => toggleSelection(el.dataset.modelId));
    });
  }

  function rowHtml(m, rank, sortKey, maxScore) {
    const score = m[sortKey];
    const barPct = score == null ? 0 : Math.round((score / maxScore) * 100);
    const sel = isSelected(m.model_id);
    return `
      <div class="ranked-row${sel ? ' selected' : ''}" role="listitem" data-model-id="${m.model_id}" tabindex="0">
        <span class="text-neutral-500">${rank}</span>
        <span class="${sel ? 'text-green-400' : ''}">${escape(m.name)}</span>
        <span class="chip">${escape(m['license.id'] || '')}</span>
        <span class="chip">${fmtCtx(m.context_window)}</span>
        <div class="bar" style="width: ${barPct}%"></div>
        <span class="text-right">${score == null ? '—' : score.toFixed(2)}</span>
      </div>`;
  }

  function fmtCtx(n) {
    if (!n) return '—';
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return String(n);
  }

  function prettyPath(p) { return p.split('.').slice(-1)[0].replace(/_/g, ' '); }
  function escape(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
}
