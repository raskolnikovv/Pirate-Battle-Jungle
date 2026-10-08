import type { GameConfig } from '@/config/gameConfig';
import type { GameState } from '../core/GameState';
import type { InputSnapshot } from '../input/InputManager';
import type { Projectile } from '@/types/domain';

// Input precision tolerance (~0.57 degrees), not a different rotation speed.
const TOUCH_HEADING_TOLERANCE = 0.01;

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
        let headingX = dx;
        let headingY = dy;
        // Detour around isolated land; keep existing coastal sliding unchanged.
        for (const island of state.islands) for (const collider of island.colliders) {
          const cx = island.x + collider.x;
          const cy = island.y + collider.y;
          const radius = collider.radius + enemy.collisionRadius + 8;
          const padding = config.enemyBoundaryPadding;
          if (cx - radius < padding || cy - radius < padding
            || cx + radius > config.arenaWidth - padding
            || cy + radius > config.arenaHeight - padding) continue;
          const t = Math.max(0, Math.min(1, ((cx - enemy.x) * dx + (cy - enemy.y) * dy) / (distance * distance)));
          if (Math.hypot(enemy.x + dx * t - cx, enemy.y + dy * t - cy) >= radius) continue;
          const nx = enemy.x - cx;
          const ny = enemy.y - cy;
          // A ship already inside the steering margin must be allowed to leave it.
          if (nx * dx + ny * dy >= 0) continue;
          const side = nx * (player.y - cy) - ny * (player.x - cx) >= 0 ? 1 : -1;
          const angle = Math.atan2(ny, nx) + side * 0.5;
          headingX = cx + Math.cos(angle) * radius - enemy.x;
          headingY = cy + Math.sin(angle) * radius - enemy.y;
        }
        const headingLength = Math.hypot(headingX, headingY);
        if (headingLength > 0 && movement > 0) {
          enemy.rotation = Math.atan2(headingX, -headingY);
          const step = Math.min(movement, headingLength);
          enemy.x += headingX / headingLength * step;
          enemy.y += headingY / headingLength * step;
        }
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

    const direction = input.touchDirection;
    const touchThrottle = direction ? Math.min(1, Math.hypot(direction.x, direction.y)) : 0;
    // Explicit keyboard steering wins on hybrid devices; keyboard-only math is unchanged.
    if (direction && touchThrottle > 0 && !input.turnLeft && !input.turnRight) {
      const desiredHeading = Math.atan2(direction.x, -direction.y);
      const difference = desiredHeading - player.rotation;
      const shortestAngle = Math.atan2(Math.sin(difference), Math.cos(difference));
      if (Math.abs(shortestAngle) > TOUCH_HEADING_TOLERANCE) {
        const turn = Math.min(Math.abs(shortestAngle), config.playerRotationSpeed * deltaSeconds);
        player.rotation += Math.sign(shortestAngle) * turn;
      }
    }

    const throttle = input.forward ? 1 : touchThrottle;
    if (throttle > 0) {
      player.x += Math.sin(player.rotation) * config.playerMovementSpeed * deltaSeconds * throttle;
      player.y -= Math.cos(player.rotation) * config.playerMovementSpeed * deltaSeconds * throttle;
    }

    const padding = config.playerBoundaryPadding;
    player.x = Math.max(padding, Math.min(config.arenaWidth - padding, player.x));
    player.y = Math.max(padding, Math.min(config.arenaHeight - padding, player.y));
  }
}
