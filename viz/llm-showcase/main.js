import '../../src/styles/main.css';
import { loadDataset } from '../llm-decision-dashboard/modules/data.js';

bootstrap();

async function bootstrap() {
  let data;
  try {
    data = await loadDataset();
  } catch (err) {
    console.error(err);
    document.getElementById('error-strip').hidden = false;
    return;
  }
  const models = data.models;
  console.log(`loaded ${models.length} models`);
  document.getElementById('sync-stamp').textContent =
    ` · synced ${new Date(data.syncedAt).toISOString().slice(0, 10)}`;
}
