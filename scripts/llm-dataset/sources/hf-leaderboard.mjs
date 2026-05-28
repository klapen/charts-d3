// HuggingFace Open LLM Leaderboard adapter.
// Pulls academic-benchmark scores keyed by HF model id.

export const id = 'hf_leaderboard';
export const url = 'https://huggingface.co/datasets/open-llm-leaderboard/contents';

// HF datasets-server returns paginated JSON. We pull a single page large enough
// for our seed set; expand if record_count drops below expected.
const ENDPOINT = 'https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train&offset=0&length=100';

export async function fetch_() {
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`hf_leaderboard: HTTP ${res.status}`);
  const payload = await res.json();

  return (payload.rows || []).map(r => {
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
