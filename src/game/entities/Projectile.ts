import type { Projectile } from '@/types/domain';
import type { GameConfig } from '@/config/gameConfig';

export interface CreateProjectileOptions {
  id: string;
  x: number;
  y: number;
  rotation: number;
  ownerId: string;
  isPlayerOwned: boolean;
}

export function createProjectile(
  opts: CreateProjectileOptions,
  config: Pick<GameConfig, 'projectileSpeed' | 'projectileDamage' | 'projectileLifetime' | 'projectileCollisionRadius'>,
): Projectile {
  return {
    id: opts.id,
    x: opts.x,
    y: opts.y,
    rotation: opts.rotation,
    speed: config.projectileSpeed,
    damage: config.projectileDamage,
    lifetime: config.projectileLifetime,
    collisionRadius: config.projectileCollisionRadius,
    ownerId: opts.ownerId,
    isPlayerOwned: opts.isPlayerOwned,
  };
}
