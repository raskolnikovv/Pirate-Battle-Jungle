import type { CompletedMatch } from '@/types/completedMatch';
import { LOCAL_PLAYER } from '@/config/localPlayer';

export interface MatchHistoryRecord extends Omit<CompletedMatch, 'elapsedSeconds' | 'registrationStatus'> {
  readonly playerId: string;
  readonly playerName: string;
  readonly durationSeconds: number;
}

export type SubmitMatchRequest = MatchHistoryRecord;

export type MatchRegistration =
  | { status: 'not_submitted' }
  | { status: 'submitting' }
  | { status: 'submitted'; record: MatchHistoryRecord }
  | { status: 'failed' };

export function toSubmitMatchRequest(match: CompletedMatch): SubmitMatchRequest {
  const { elapsedSeconds, registrationStatus: _status, ...result } = match;
  return { ...result, durationSeconds: elapsedSeconds, playerId: LOCAL_PLAYER.id, playerName: LOCAL_PLAYER.name };
}
