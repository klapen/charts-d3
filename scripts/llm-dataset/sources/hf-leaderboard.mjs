// HuggingFace Open LLM Leaderboard adapter.
// Pulls academic-benchmark scores keyed by HF model id.
// HF datasets-server caps length at 100 per request, so we paginate 10 pages.

export const id = 'hf_leaderboard';
export const url = 'https://huggingface.co/datasets/open-llm-leaderboard/contents';

export async function fetch_() {
  const out = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train&offset=${offset}&length=100`;
    const res = await fetch(url);
    if (!res.ok) {
      if (offset === 0) throw new Error(`hf_leaderboard: HTTP ${res.status}`);
      break;  // stop paginating on error after we have at least one page
    }
    const payload = await res.json();
    const page = payload.rows || [];
    if (page.length === 0) break;
    out.push(...page);
    if (page.length < 100) break;  // no more pages
  }
  return out.map(r => {
    const row = r.row || {};
    const id = row.fullname || row.eval_name || row.Model || '';
    return {
      source_model_id: String(id),
      fields: {
        'quality.reasoning.gpqa':         numOrNull(row['GPQA']),
        'quality.reasoning.mmlu_pro':     numOrNull(row['MMLU-PRO'] ?? row['MMLU_PRO']),
        'quality.coding.humaneval':       numOrNull(row['HumanEval']),
        'quality.coding.livecodebench':   numOrNull(row['LiveCodeBench']),
        'quality.coding.swe_bench':       numOrNull(row['SWE-Bench'] ?? row['SWE_Bench']),
        'quality.multilingual_score':     numOrNull(row['MMMLU'] ?? row['Multilingual']),
        'quality.reasoning.ifeval':       numOrNull(row['IFEval']),
        'quality.reasoning.bbh':          numOrNull(row['BBH']),
        'quality.reasoning.math':         numOrNull(row['MATH']),
      },
    };
  }).filter(r => r.source_model_id);
}

// Workaround: ESM doesn't allow `fetch` as an export name. Re-export.
export { fetch_ as fetch };

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? (n > 1 ? n / 100 : n) : null;  // normalize 0-100 -> 0-1
}
