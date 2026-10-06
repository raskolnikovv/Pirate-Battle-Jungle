export type ScreenName =
  | 'main-menu'
  | 'options'
  | 'game'
  | 'result'
  | 'ranking'
  | 'match-history';

export type GameResultPayload = import('@/types/completedMatch').CompletedMatch;
