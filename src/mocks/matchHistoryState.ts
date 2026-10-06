import type { MatchHistoryRecord } from '@/api/matchContracts';
import { HISTORY_FIXTURE } from './fixtures';

// Confirmed records belong to the mock server, not React or gameplay state.
const confirmedMatches = new Map<string, MatchHistoryRecord>();

export function registerMockMatch(record: MatchHistoryRecord): MatchHistoryRecord {
  const existing = confirmedMatches.get(record.matchId)
    ?? HISTORY_FIXTURE.find((fixture) => fixture.matchId === record.matchId);
  if (existing) return existing;
  confirmedMatches.set(record.matchId, record);
  return record;
}

export function getMockHistory(playerId: string): MatchHistoryRecord[] {
  return [...HISTORY_FIXTURE, ...confirmedMatches.values()]
    .filter((record) => record.playerId === playerId)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt) || a.matchId.localeCompare(b.matchId));
}
