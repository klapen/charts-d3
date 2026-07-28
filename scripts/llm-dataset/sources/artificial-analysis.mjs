// OpenRouter-backed pricing adapter (formerly Artificial Analysis via fboulnois CSV).
// fboulnois mirror dropped its AA CSV in 2025; switched to OpenRouter for pricing
// while keeping the source id `artificial_analysis` so downstream schemas/precedence
// stay stable. Latency/throughput aren't available from OpenRouter — left as null.

export const id = 'artificial_analysis';
export const url = 'https://openrouter.ai/api/v1/models';

const ENDPOINT = url;

export async function fetch_() {
  const res = await fetch(ENDPOINT, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`artificial_analysis (openrouter): HTTP ${res.status}`);
  const payload = await res.json();
  const list = Array.isArray(payload) ? payload : (payload.data || payload.models || []);

  return list.map(m => {
    const pricing = m.pricing || {};
    return {
      source_model_id: m.hugging_face_id || m.canonical_slug || m.id || '',
      fields: {
        'pricing_hosted.input_per_mtok_usd':  perMtok(pricing.prompt),
        'pricing_hosted.output_per_mtok_usd': perMtok(pricing.completion),
        'performance.latency_ttft_ms':        null,
        'performance.throughput_tok_s':       null,
      },
    };
  }).filter(r => r.source_model_id);
}

export { fetch_ as fetch };

// Convert "0.0000004" (USD/token) to a Number representing USD per 1M tokens.
function perMtok(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1_000_000 * 10000) / 10000;  // round to 4 decimals
}
