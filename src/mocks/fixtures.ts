import type { MatchHistoryRecord } from '@/api/matchContracts';
import { DEFAULT_GAME_CONFIG } from '@/config/gameConfig';
import { LOCAL_PLAYER } from '@/config/localPlayer';

// Other players also contribute completed matches, never unrelated aggregates.
export const OTHER_PLAYER_MATCHES: MatchHistoryRecord[] = [
  'Blackbeard', 'JackSparrow', 'DavyJones', 'Barbossa',
  'CaptainHook', 'EdwardTeach', 'MaryRead', 'AnneBonny',
].map((playerName, index) => ({
  matchId: `fixture-other-${index + 1}`,
  playerId: `fixture-player-${index + 1}`,
  playerName,
  config: DEFAULT_GAME_CONFIG,
  score: 18 - Math.floor(index / 2),
  enemiesDefeated: 18 - Math.floor(index / 2),
  endReason: 'time_expired',
  durationSeconds: DEFAULT_GAME_CONFIG.sessionDuration,
  playerHealth: 30,
  completedAt: `2026-10-04T12:0${index}:00Z`,
}));

const fixtureIdentity = { playerId: LOCAL_PLAYER.id, playerName: LOCAL_PLAYER.name, config: DEFAULT_GAME_CONFIG };

export const HISTORY_FIXTURE: MatchHistoryRecord[] = [
  { ...fixtureIdentity, matchId: 'fixture-match-001', score: 12, enemiesDefeated: 12,
    endReason: 'time_expired', durationSeconds: 120, playerHealth: 40, completedAt: '2026-10-05T14:30:00Z' },
  { ...fixtureIdentity, matchId: 'fixture-match-002', score: 8, enemiesDefeated: 8,
    endReason: 'player_defeated', durationSeconds: 87, playerHealth: 0, completedAt: '2026-10-05T12:15:00Z' },
  { ...fixtureIdentity, matchId: 'fixture-match-003', score: 15, enemiesDefeated: 15,
    endReason: 'time_expired', durationSeconds: 120, playerHealth: 20, completedAt: '2026-10-04T20:00:00Z' },
];
