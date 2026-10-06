import type { GameState } from '../core/GameState';
import type { Projectile } from '@/types/domain';

export type CollisionEvent = {
  sourceId: string;
  targetId: string;
  damage: number;
} & (
  | { type: 'projectile-enemy'; isPlayerOwned: boolean }
  | { type: 'projectile-player' | 'enemy-player' }
);

interface ProjectileHit {
  fraction: number;
  enemyId?: string;
  playerId?: string;
}

// First intersection along a segment with a circle, including an overlapping origin.
function circleEntry(
  x: number, y: number, nextX: number, nextY: number,
  centerX: number, centerY: number, radius: number,
): number | null {
  const offsetX = x - centerX;
  const offsetY = y - centerY;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (c <= 0) return 0;
  const dx = nextX - x;
  const dy = nextY - y;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (offsetX * dx + offsetY * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  return fraction >= 0 && fraction <= 1 ? fraction : null;
}

export class CollisionSystem {
  firstProjectileHit(state: GameState, projectile: Projectile, nextX: number, nextY: number): ProjectileHit | null {
    let hit: ProjectileHit | null = null;
    for (const island of state.islands) {
      for (const collider of island.colliders) {
        const centerX = island.x + collider.x;
        const centerY = island.y + collider.y;
        const fraction = circleEntry(projectile.x, projectile.y, nextX, nextY,
          centerX, centerY, projectile.collisionRadius + collider.radius);
        if (fraction !== null && (!hit || fraction < hit.fraction)) hit = { fraction };
      }
    }
    if (projectile.isPlayerOwned) {
      for (const enemy of state.enemies.values()) {
        if (enemy.health <= 0) continue;
        const fraction = circleEntry(projectile.x, projectile.y, nextX, nextY,
          enemy.x, enemy.y, projectile.collisionRadius + enemy.collisionRadius);
        // Islands win ties; equal enemy hits follow stable Map insertion order.
        if (fraction !== null && (!hit || fraction < hit.fraction)) hit = { fraction, enemyId: enemy.id };
      }
    } else {
      for (const player of state.players.values()) {
        const fraction = circleEntry(projectile.x, projectile.y, nextX, nextY,
          player.x, player.y, projectile.collisionRadius + player.collisionRadius);
        if (fraction !== null && (!hit || fraction < hit.fraction)) hit = { fraction, playerId: player.id };
      }
    }
    return hit;
  }

  resolveShipsIslands(state: GameState): void {
    for (const player of [...state.players.values(), ...state.enemies.values()]) {
      for (const island of state.islands) {
        for (const collider of island.colliders) {
          const centerX = island.x + collider.x;
          const centerY = island.y + collider.y;
          const dx = player.x - centerX;
          const dy = player.y - centerY;
          const minimumDistance = player.collisionRadius + collider.radius;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared >= minimumDistance * minimumDistance) continue;

          const distance = Math.sqrt(distanceSquared);
          // At the exact center, choose an escape direction instead of dividing by zero.
          const normalX = distance > 0 ? dx / distance : 1;
          const normalY = distance > 0 ? dy / distance : 0;
          // A tiny gap avoids repeated floating-point penetration at contact.
          player.x = centerX + normalX * (minimumDistance + 0.001);
          player.y = centerY + normalY * (minimumDistance + 0.001);
        }
      }
    }
  }

  chaserContacts(state: GameState): CollisionEvent[] {
    const events: CollisionEvent[] = [];
    for (const enemy of state.enemies.values()) {
      if (enemy.type !== 'chaser' || enemy.health <= 0) continue;
      for (const player of state.players.values()) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const radius = enemy.collisionRadius + player.collisionRadius;
        if (dx * dx + dy * dy <= radius * radius) {
          events.push({ type: 'enemy-player', sourceId: enemy.id, targetId: player.id, damage: enemy.contactDamage });
          break;
        }
      }
    }
    return events;
  }
}
