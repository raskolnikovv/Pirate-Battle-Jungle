import type { GameConfig } from './gameConfig';

function canonicalize(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, nested]) => [key, canonicalize(nested)]));
}

// Compare the entire numeric configuration, including nested tuning values.
// Sorted keys make object construction order irrelevant; no lossy hash is used.
export function getGameConfigKey(config: Readonly<GameConfig>): string {
  return JSON.stringify(canonicalize(config));
}
