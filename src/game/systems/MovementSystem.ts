import type { GameConfig } from '@/config/gameConfig';
import type { GameState } from '../core/GameState';
import type { InputSnapshot } from '../input/InputManager';
import type { Projectile } from '@/types/domain';

export class MovementSystem {
  nextProjectilePosition(projectile: Projectile, deltaSeconds: number): { x: number; y: number } {
    const travelTime = Math.min(deltaSeconds, Math.max(0, projectile.lifetime));
    return {
      x: projectile.x + Math.sin(projectile.rotation) * projectile.speed * travelTime,
      y: projectile.y - Math.cos(projectile.rotation) * projectile.speed * travelTime,
    };
  }

  updateEnemies(state: GameState, deltaSeconds: number, config: GameConfig): void {
    const player = state.players.values().next().value;
    if (!player) return;
    for (const enemy of state.enemies.values()) {
      if (enemy.health <= 0) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0) {
        // atan2(dx, -dy) matches ships that face up at rotation zero.
        enemy.rotation = Math.atan2(dx, -dy);
        const remainingApproach = enemy.type === 'shooter'
          ? Math.max(0, distance - config.shooter.attackRange)
          : distance;
        const movement = Math.min(enemy.speed * deltaSeconds, remainingApproach);
        enemy.x += dx / distance * movement;
        enemy.y += dy / distance * movement;
      }
      const padding = Math.max(config.enemyBoundaryPadding, enemy.collisionRadius);
      enemy.x = Math.max(padding, Math.min(config.arenaWidth - padding, enemy.x));
      enemy.y = Math.max(padding, Math.min(config.arenaHeight - padding, enemy.y));
    }
  }

  update(
    state: GameState,
    input: InputSnapshot,
    deltaSeconds: number,
    config: GameConfig,
  ): void {
    const player = state.players.values().next().value;
    if (!player) return;

    const rotationDirection = Number(input.turnRight) - Number(input.turnLeft);
    player.rotation += rotationDirection * config.playerRotationSpeed * deltaSeconds;

    if (input.forward) {
      player.x += Math.sin(player.rotation) * config.playerMovementSpeed * deltaSeconds;
      player.y -= Math.cos(player.rotation) * config.playerMovementSpeed * deltaSeconds;
    }

    const padding = config.playerBoundaryPadding;
    player.x = Math.max(padding, Math.min(config.arenaWidth - padding, player.x));
    player.y = Math.max(padding, Math.min(config.arenaHeight - padding, player.y));
  }
}
