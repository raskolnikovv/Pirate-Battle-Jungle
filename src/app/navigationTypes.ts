export type ScreenName =
  | 'main-menu'
  | 'options'
  | 'game'
  | 'result'
  | 'ranking'
  | 'match-history';

export interface GameResultPayload {
  score: number;
  enemiesDefeated: number;
  durationSeconds: number;
  endReason: 'time_expired' | 'player_defeated' | 'quit';
}
