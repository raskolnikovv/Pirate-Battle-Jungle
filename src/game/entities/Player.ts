import type { Player } from '@/types/domain';

export function createPlayer(
  id: string,
  x: number,
  y: number,
  health: number,
  collisionRadius: number,
): Player {
  return {
    id,
    x,
    y,
    rotation: 0,
    collisionRadius,
    health,
    maxHealth: health,
  };
}
