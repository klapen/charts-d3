import '../../src/styles/main.css';
import { loadDataset } from '../llm-decision-dashboard/modules/data.js';
import { createHwState } from './modules/hw-state.js';
import { mountHeroControls } from './modules/hero-controls.js';
import { mountHeroScene } from './modules/hero-scene.js';
import { mountTradeoff } from './modules/story-tradeoff.js';
import { mountCoding } from './modules/story-coding.js';
import { mountPricing } from './modules/story-pricing.js';
import { initScrollUi } from './modules/scroll.js';

bootstrap();

async function bootstrap() {
  let data;
  try {
    data = await loadDataset();
  } catch (err) {
    console.error(err);
    document.getElementById('error-strip').hidden = false;
    initScrollUi();
    return;
  }
  const models = data.models;
  document.getElementById('sync-stamp').textContent =
    ` · synced ${new Date(data.syncedAt).toISOString().slice(0, 10)}`;
  const hwState = createHwState(24);
  mountHeroControls(models, hwState);
  mountHeroScene(document.getElementById('hero-scene'), models, hwState);
  mountTradeoff(models, hwState);
  mountCoding(models, hwState);
  mountPricing(models, hwState);
  initScrollUi();
}
