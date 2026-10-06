import type { MatchHistoryRecord } from '@/api/matchContracts';
import { isSameMatch } from '@/api/matchContracts';
import { HISTORY_FIXTURE, OTHER_PLAYER_MATCHES } from './fixtures';
import { getGameConfigKey } from '@/config/gameConfigKey';
import type { RankingEntry } from '@/api/rankingContracts';
import { clearConfirmedMatches, loadConfirmedMatches, saveConfirmedMatches } from '@/storage/confirmedMatchesStorage';

// Confirmed records belong to the mock server, not React or gameplay state.
const fixtures = [...HISTORY_FIXTURE, ...OTHER_PLAYER_MATCHES];
// Fixture IDs are reserved; persisted data cannot override the initial dataset.
const restored = loadConfirmedMatches();
const hasFixtureCollision = restored.some((record) => fixtures.some((fixture) => fixture.matchId === record.matchId));
const confirmedMatches = new Map<string, MatchHistoryRecord>(
  (hasFixtureCollision ? [] : restored).map((record) => [record.matchId, record]),
);

type RegistrationResult =
  | { status: 'created' | 'existing'; record: MatchHistoryRecord }
  | { status: 'conflict' }
  | { status: 'storage_unavailable' };

function getAllMatches(): MatchHistoryRecord[] {
  const matches = new Map(fixtures
    .map((record) => [record.matchId, record]));
  for (const record of confirmedMatches.values()) matches.set(record.matchId, record);
  return [...matches.values()];
}

export function registerMockMatch(record: MatchHistoryRecord): RegistrationResult {
  const existing = confirmedMatches.get(record.matchId)
    ?? getAllMatches().find((fixture) => fixture.matchId === record.matchId);
  if (existing) return isSameMatch(existing, record)
    ? { status: 'existing', record: existing } : { status: 'conflict' };
  // Persist acceptance before mutating memory or returning a successful POST.
  if (!saveConfirmedMatches([...confirmedMatches.values(), record])) return { status: 'storage_unavailable' };
  confirmedMatches.set(record.matchId, record);
  return { status: 'created', record };
}

export function resetConfirmedMockMatches(): boolean {
  if (!clearConfirmedMatches()) return false;
  confirmedMatches.clear();
  return true;
}

export function getMockHistory(playerId: string): MatchHistoryRecord[] {
  return getAllMatches()
    .filter((record) => record.playerId === playerId)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)
      || (a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0));
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
