import type { GameConfig } from '@/config/gameConfig';
import type { Enemy, Player, Projectile } from '@/types/domain';
import type { Island } from '../entities/Island';

export type GameFinishReason = 'time_expired' | 'defeated';

export interface GameState {
  players: Map<string, Player>;
  islands: Island[];
  enemies: Map<string, Enemy>;
  projectiles: Map<string, Projectile>;
  weaponCooldowns: { front: number; left: number; right: number };
  nextProjectileId: number;
  score: number;
  elapsedSeconds: number;
  durationSeconds: number;
  remainingSeconds: number;
  status: 'running' | 'finished';
  finishReason: GameFinishReason | null;
}

export interface GameCallbacks {
  onMatchEnd?: (reason: GameFinishReason) => void;
  onScoreChange?: (score: number) => void;
}

export interface GameDependencies {
  config: GameConfig;
  callbacks?: GameCallbacks;
}
