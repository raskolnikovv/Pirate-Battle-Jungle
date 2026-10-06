import type { MatchHistoryRecord } from '@/api/matchContracts';
import { isHistoryRecord } from '@/api/responseValidation';
import { DEFAULT_GAME_CONFIG } from '@/config/gameConfig';
import { LOCAL_PLAYER } from '@/config/localPlayer';

// Temporary response-only fixtures; never written to confirmed storage.
export function createScenarioFixtures(configKey?: string): MatchHistoryRecord[] {
  let config = DEFAULT_GAME_CONFIG;
  if (configKey) {
    try { config = JSON.parse(configKey); } catch { return []; }
  }
  const records: MatchHistoryRecord[] = Array.from({ length: 15 }, (_, index) => ({
    matchId: `scenario-page-${index}`, ...{ playerId: LOCAL_PLAYER.id, playerName: LOCAL_PLAYER.name },
    config, score: 30 - index, enemiesDefeated: 30 - index,
    endReason: 'time_expired', durationSeconds: config?.sessionDuration,
    playerHealth: 0, completedAt: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
  }));
  return records.every(isHistoryRecord) ? records : [];
}
