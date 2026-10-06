import type { MatchHistoryEntry, RankingEntry } from '@/types/domain';

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

export const HISTORY_FIXTURE: MatchHistoryEntry[] = [
  {
    matchId: 'match-001',
    score: 2400,
    enemiesDefeated: 12,
    endReason: 'time_expired',
    durationSeconds: 120,
    completedAt: '2026-10-05T14:30:00Z',
  },
  {
    matchId: 'match-002',
    score: 1800,
    enemiesDefeated: 8,
    endReason: 'player_defeated',
    durationSeconds: 87,
    completedAt: '2026-10-05T12:15:00Z',
  },
  {
    matchId: 'match-003',
    score: 3100,
    enemiesDefeated: 15,
    endReason: 'time_expired',
    durationSeconds: 120,
    completedAt: '2026-10-04T20:00:00Z',
  },
  {
    matchId: 'match-004',
    score: 750,
    enemiesDefeated: 3,
    endReason: 'quit',
    durationSeconds: 22,
    completedAt: '2026-10-04T10:45:00Z',
  },
  {
    matchId: 'match-005',
    score: 2100,
    enemiesDefeated: 10,
    endReason: 'time_expired',
    durationSeconds: 120,
    completedAt: '2026-10-03T16:20:00Z',
  },
];
