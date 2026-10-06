import type { GameState } from './GameState';

export interface GameHudSnapshot {
  readonly health: number;
  readonly maxHealth: number;
  readonly score: number;
  // Rounded for presentation only; simulation retains fractional seconds.
  readonly remainingSeconds: number;
  readonly status: GameState['status'];
  readonly finishReason: GameState['finishReason'];
}

export function createHudSnapshot(state: GameState): GameHudSnapshot {
  const player = state.players.values().next().value;
  return Object.freeze({
    health: player?.health ?? 0,
    maxHealth: player?.maxHealth ?? 0,
    score: state.score,
    remainingSeconds: Math.max(0, Math.ceil(state.remainingSeconds - 1e-9)),
    status: state.status,
    finishReason: state.finishReason,
  });
}

export function formatRemainingTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
