// LMArena (Chatbot Arena) adapter — uses the daily-updated JSON snapshots
// at oolong-tea-2026/arena-ai-leaderboards (no auth, just a fetch).
// The repo does not have a single data/llm.json; instead it publishes
// per-leaderboard files under data/{date}/text.json.  We resolve the
// latest date via data/latest.json, then fetch the text (LLM) leaderboard.

export const id = 'lmarena';
export const url = 'https://raw.githubusercontent.com/oolong-tea-2026/arena-ai-leaderboards/main/data/latest.json';

const BASE = 'https://raw.githubusercontent.com/oolong-tea-2026/arena-ai-leaderboards/main/data';

export async function fetch_() {
  // Step 1: resolve the current snapshot date.
  const latestRes = await fetch(`${BASE}/latest.json`);
  if (!latestRes.ok) throw new Error(`lmarena: latest.json HTTP ${latestRes.status}`);
  const latest = await latestRes.json();
  const date = latest.date || latest.path;
  if (!date) throw new Error('lmarena: could not determine latest date from latest.json');

  // Step 2: fetch the text (LLM) leaderboard for that date.
  const endpoint = `${BASE}/${date}/text.json`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`lmarena: text.json HTTP ${res.status} (${endpoint})`);
  const payload = await res.json();

  // Shape: { models: [{ model, score, rank, vendor, ... }, ...] }
  // Fall back to top-level array if shape differs.
  const rows = Array.isArray(payload)
    ? payload
    : (payload.models || payload.leaderboard || payload.data || []);

  return rows.map(row => ({
    source_model_id: row.model || row.name || row.Model || '',
    fields: {
      'quality.arena_elo': numOrNull(row.score ?? row.elo ?? row.Arena_Elo),
    },
  })).filter(r => r.source_model_id);
}

export { fetch_ as fetch };

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
