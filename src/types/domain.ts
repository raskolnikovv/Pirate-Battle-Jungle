export type EnemyType = 'chaser' | 'shooter';

export interface Player {
  id: string;
  x: number;
  y: number;
  rotation: number;
  collisionRadius: number;
  health: number;
  maxHealth: number;
}

interface EnemyBase {
  id: string;
  x: number;
  y: number;
  rotation: number;
  collisionRadius: number;
  speed: number;
  contactDamage: number;
  health: number;
  maxHealth: number;
}

export type Enemy = EnemyBase & (
  | { type: 'chaser' }
  | { type: 'shooter'; fireCooldownRemaining: number }
);

export interface Projectile {
  id: string;
  x: number;
  y: number;
  rotation: number;
  speed: number;
  damage: number;
  lifetime: number;
  collisionRadius: number;
  ownerId: string;
  isPlayerOwned: boolean;
}

export type MatchEndReason =
  | 'time_expired'
  | 'player_defeated'
  | 'quit';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
