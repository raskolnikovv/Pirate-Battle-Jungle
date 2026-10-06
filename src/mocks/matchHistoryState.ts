import type { MatchHistoryRecord } from '@/api/matchContracts';
import { HISTORY_FIXTURE, OTHER_PLAYER_MATCHES } from './fixtures';
import { getGameConfigKey } from '@/config/gameConfigKey';
import type { RankingEntry } from '@/api/rankingContracts';

// Confirmed records belong to the mock server, not React or gameplay state.
const confirmedMatches = new Map<string, MatchHistoryRecord>();

function getAllMatches(): MatchHistoryRecord[] {
  const matches = new Map([...HISTORY_FIXTURE, ...OTHER_PLAYER_MATCHES]
    .map((record) => [record.matchId, record]));
  for (const record of confirmedMatches.values()) matches.set(record.matchId, record);
  return [...matches.values()];
}

export function registerMockMatch(record: MatchHistoryRecord): MatchHistoryRecord {
  const existing = confirmedMatches.get(record.matchId)
    ?? getAllMatches().find((fixture) => fixture.matchId === record.matchId);
  if (existing) return existing;
  confirmedMatches.set(record.matchId, record);
  return record;
}

export function getMockHistory(playerId: string): MatchHistoryRecord[] {
  return getAllMatches()
    .filter((record) => record.playerId === playerId)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt) || a.matchId.localeCompare(b.matchId));
}

export function getMockRanking(configKey: string): RankingEntry[] {
  return getAllMatches()
    .filter((record) => getGameConfigKey(record.config) === configKey)
    .sort((a, b) => b.score - a.score
      || a.durationSeconds - b.durationSeconds
      || Date.parse(a.completedAt) - Date.parse(b.completedAt)
      || (a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0))
    .map((record, index) => ({ ...record, rank: index + 1 }));
}
