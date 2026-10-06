import type { Enemy } from '@/types/domain';
import type { ChaserConfig } from '@/config/gameConfig';

export function createChaser(
  id: string,
  x: number,
  y: number,
  config: ChaserConfig,
): Enemy {
  return {
    id,
    type: 'chaser',
    x,
    y,
    rotation: 0,
    collisionRadius: config.collisionRadius,
    speed: config.speed,
    contactDamage: config.contactDamage,
    health: config.health,
    maxHealth: config.health,
  };
}
