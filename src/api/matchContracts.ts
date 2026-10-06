import type { CompletedMatch } from '@/types/completedMatch';
import { LOCAL_PLAYER } from '@/config/localPlayer';
import { getGameConfigKey } from '@/config/gameConfigKey';

export interface MatchHistoryRecord extends Omit<CompletedMatch, 'elapsedSeconds' | 'registrationStatus'> {
  readonly playerId: string;
  readonly playerName: string;
  readonly durationSeconds: number;
}

export type SubmitMatchRequest = MatchHistoryRecord;

export type MatchRegistration =
  | { status: 'not_submitted' }
  | { status: 'pending' }
  | { status: 'submitting' }
  | { status: 'submitted'; record: MatchHistoryRecord }
  | { status: 'failed'; message: string };

export function isSameMatch(a: MatchHistoryRecord, b: MatchHistoryRecord): boolean {
  return a.matchId === b.matchId && a.playerId === b.playerId && a.playerName === b.playerName
    && a.completedAt === b.completedAt && a.score === b.score
    && a.enemiesDefeated === b.enemiesDefeated && a.durationSeconds === b.durationSeconds
    && a.endReason === b.endReason && a.playerHealth === b.playerHealth
    && getGameConfigKey(a.config) === getGameConfigKey(b.config);
}

export function toSubmitMatchRequest(match: CompletedMatch): SubmitMatchRequest {
  const { elapsedSeconds, registrationStatus: _status, ...result } = match;
  return { ...result, durationSeconds: elapsedSeconds, playerId: LOCAL_PLAYER.id, playerName: LOCAL_PLAYER.name };
}
