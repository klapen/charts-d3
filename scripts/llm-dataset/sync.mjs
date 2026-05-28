#!/usr/bin/env node
// Entry point for `npm run sync:llm`.
// Loads models.yaml + runs every source adapter + normalizes + ajv-validates + writes.

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import { normalize } from './normalize.mjs';
import * as hfLeaderboard       from './sources/hf-leaderboard.mjs';
import * as artificialAnalysis  from './sources/artificial-analysis.mjs';
import * as lmarena             from './sources/lmarena.mjs';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = join(__dirname, '..', '..');
const SCHEMA     = join(__dirname, 'schema.json');
const MODELS     = join(__dirname, 'models.yaml');
const OUT_DATA   = join(REPO_ROOT, 'src', 'public', 'ai-llm-dataset.json');
const OUT_SCHEMA = join(REPO_ROOT, 'src', 'public', 'ai-llm-dataset.schema.json');
const REPORT     = join(__dirname, 'sync-report.md');

const SOURCES = [hfLeaderboard, artificialAnalysis, lmarena];

async function main() {
  console.log('• loading models.yaml');
  const raw = await readFile(MODELS, 'utf8');
  // The YAML has a list of models + one entry with key `__licenses__`. Split them.
  const all = yaml.load(raw);
  const licensesEntry = all.find(x => x && x.__licenses__);
  const models = all.filter(x => x && x.model_id);
  const licenses = licensesEntry ? licensesEntry.__licenses__ : {};
  console.log(`  ${models.length} models · ${Object.keys(licenses).length} licenses`);

  const sourceResults = [];
  for (const src of SOURCES) {
    process.stdout.write(`• fetching ${src.id} ... `);
    const start = Date.now();
    try {
      const rows = await src.fetch();
      const took = Date.now() - start;
      console.log(`${rows.length} rows (${took}ms)`);
      sourceResults.push({ id: src.id, url: src.url, syncedAt: new Date().toISOString(), recordCount: rows.length, rows });
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      sourceResults.push({ id: src.id, url: src.url, syncedAt: new Date().toISOString(), recordCount: 0, rows: [], error: err.message });
    }
  }

  const allFailed = sourceResults.every(s => s.error);
  if (allFailed) {
    console.error('✗ all sources failed — aborting, existing JSON left in place');
    process.exit(2);
  }

  console.log('• normalizing');
  const { dataset, report } = normalize({ models, licenses }, sourceResults);

  console.log('• validating against schema.json');
  const schemaRaw = await readFile(SCHEMA, 'utf8');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(schemaRaw));
  if (!validate(dataset)) {
    console.error('✗ schema validation FAILED — aborting, existing JSON left in place');
    for (const e of validate.errors || []) console.error('  -', e.instancePath, e.message);
    process.exit(3);
  }

  console.log(`• writing ${OUT_DATA}`);
  await writeFile(OUT_DATA, JSON.stringify(dataset, null, 2));
  await copyFile(SCHEMA, OUT_SCHEMA);

  console.log(`• writing ${REPORT}`);
  await writeFile(REPORT, renderReport(dataset, report));

  console.log(`\n✓ sync complete — ${dataset.models.length} models, avg ${report.missing_field_avg} missing fields`);
}

function renderReport(ds, report) {
  const lines = [];
  lines.push(`# Sync report — ${ds.synced_at}`);
  lines.push('');
  lines.push(`Models: ${ds.models.length}`);
  lines.push(`Average missing fields per model: ${report.missing_field_avg}`);
  lines.push('');
  lines.push('## Sources');
  for (const s of report.sourceResults) {
    lines.push(`- **${s.id}** — ${s.recordCount} rows${s.error ? ` (ERROR: ${s.error})` : ''}`);
  }
  lines.push('');
  lines.push('## Conflicts (kept value vs. rejected source)');
  if (!report.conflicts.length) {
    lines.push('_None._');
  } else {
    for (const c of report.conflicts) {
      lines.push(`- ${c.model} · ${c.path}: kept ${c.kept}, rejected ${c.rejected} (from ${c.rejected_from})`);
    }
  }
  lines.push('');
  lines.push('## Per-model coverage');
  for (const m of ds.models) {
    lines.push(`- ${m.model_id}: sources=[${m.sources_used.join(',')}] missing=${m.missing_fields.length}`);
  }
  return lines.join('\n');
}

main().catch(err => { console.error(err); process.exit(1); });
