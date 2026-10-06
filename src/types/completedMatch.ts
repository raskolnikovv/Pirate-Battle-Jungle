import type { GameConfig } from '@/config/gameConfig';
import type { MatchEndReason } from './domain';

export interface CompletedMatch {
  readonly matchId: string;
  readonly completedAt: string;
  readonly score: number;
  readonly enemiesDefeated: number;
  readonly elapsedSeconds: number;
  readonly endReason: Exclude<MatchEndReason, 'quit'>;
  readonly playerHealth: number;
  readonly config: Readonly<GameConfig>;
  readonly registrationStatus: 'not_submitted';
}
