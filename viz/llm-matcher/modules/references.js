const TIERS = [
  { max: 8,       emoji: '🎮', text: 'runs on a gaming laptop' },
  { max: 16,      emoji: '🖥️', text: 'a normal gaming PC (4060 Ti / 4070)' },
  { max: 24,      emoji: '🖥️', text: 'high-end desktop — one RTX 4090' },
  { max: 48,      emoji: '🧰', text: 'a workstation (RTX 6000 Ada / 2×4090)' },
  { max: 192,     emoji: '🖧', text: 'a small server (multi-GPU)' },
  { max: 1536,    emoji: '🏢', text: 'serious iron — a GPU cluster' },
  { max: Infinity,emoji: '🏭', text: 'you need a data center' },
];
export function referenceLabel(neededGb) {
  return TIERS.find(t => neededGb <= t.max);
}
