import type { Enemy } from '@/types/domain';
import type { ShooterConfig } from '@/config/gameConfig';

export function createShooter(
  id: string,
  x: number,
  y: number,
  config: ShooterConfig,
): Enemy {
  return {
    id,
    type: 'shooter',
    fireCooldownRemaining: 0,
    x,
    y,
    rotation: 0,
    collisionRadius: config.collisionRadius,
    speed: config.speed,
    contactDamage: 0,
    health: config.health,
    maxHealth: config.health,
  };
}
