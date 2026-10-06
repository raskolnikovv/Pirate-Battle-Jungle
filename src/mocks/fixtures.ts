import type { RankingEntry } from '@/types/domain';
import type { MatchHistoryRecord } from '@/api/matchContracts';
import { DEFAULT_GAME_CONFIG } from '@/config/gameConfig';
import { LOCAL_PLAYER } from '@/config/localPlayer';

export const RANKING_FIXTURE: RankingEntry[] = [
  { rank: 1, playerName: 'Blackbeard', highScore: 12500, matchesPlayed: 42 },
  { rank: 2, playerName: 'JackSparrow', highScore: 11200, matchesPlayed: 38 },
  { rank: 3, playerName: 'DavyJones', highScore: 9800, matchesPlayed: 21 },
  { rank: 4, playerName: 'Barbossa', highScore: 8400, matchesPlayed: 33 },
  { rank: 5, playerName: 'CaptainHook', highScore: 7100, matchesPlayed: 19 },
  { rank: 6, playerName: 'EdwardTeach', highScore: 6500, matchesPlayed: 15 },
  { rank: 7, playerName: 'MaryRead', highScore: 5900, matchesPlayed: 12 },
  { rank: 8, playerName: 'AnneBonny', highScore: 5300, matchesPlayed: 14 },
];

const fixtureIdentity = { playerId: LOCAL_PLAYER.id, playerName: LOCAL_PLAYER.name, config: DEFAULT_GAME_CONFIG };

export const HISTORY_FIXTURE: MatchHistoryRecord[] = [
  { ...fixtureIdentity, matchId: 'fixture-match-001', score: 12, enemiesDefeated: 12,
    endReason: 'time_expired', durationSeconds: 120, playerHealth: 40, completedAt: '2026-10-05T14:30:00Z' },
  { ...fixtureIdentity, matchId: 'fixture-match-002', score: 8, enemiesDefeated: 8,
    endReason: 'player_defeated', durationSeconds: 87, playerHealth: 0, completedAt: '2026-10-05T12:15:00Z' },
  { ...fixtureIdentity, matchId: 'fixture-match-003', score: 15, enemiesDefeated: 15,
    endReason: 'time_expired', durationSeconds: 120, playerHealth: 20, completedAt: '2026-10-04T20:00:00Z' },
];
