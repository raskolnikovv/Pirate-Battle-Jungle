import type { GameConfig } from '@/config/gameConfig';
import type { Player } from '@/types/domain';
import type { GameState } from '../core/GameState';
import { createProjectile } from '../entities/Projectile';
import type { InputSnapshot } from '../input/InputManager';
import type { CollisionEvent } from './CollisionSystem';

export class CombatSystem {
  applyCollision(state: GameState, event: CollisionEvent, config: GameConfig): void {
    if (state.status !== 'running') return;
    if (event.type === 'projectile-enemy') {
      const enemy = state.enemies.get(event.targetId);
      if (!enemy || enemy.health <= 0) return;
      enemy.health = Math.max(0, enemy.health - event.damage);
      if (enemy.health === 0) {
        state.enemies.delete(enemy.id);
        if (event.isPlayerOwned) state.score += config.enemyKillRewards[enemy.type];
      }
    } else if (event.type === 'projectile-player') {
      const player = state.players.get(event.targetId);
      if (player) player.health = Math.max(0, player.health - event.damage);
    } else if (event.type === 'enemy-player') {
      const enemy = state.enemies.get(event.sourceId);
      const player = state.players.get(event.targetId);
      if (!enemy || enemy.type !== 'chaser' || enemy.health <= 0 || !player) return;
      player.health = Math.max(0, player.health - event.damage);
      state.enemies.delete(enemy.id);
    }
  }

  updateShooters(state: GameState, deltaSeconds: number, config: GameConfig): void {
    const player = state.players.values().next().value;
    for (const enemy of state.enemies.values()) {
      if (enemy.type !== 'shooter' || enemy.health <= 0) continue;
      enemy.fireCooldownRemaining = Math.max(0, enemy.fireCooldownRemaining - deltaSeconds);
      if (!player) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (distance === 0 || distance > config.shooter.attackRange + 1e-9
        || enemy.fireCooldownRemaining > 1e-9) continue;
      const directionX = dx / distance;
      const directionY = dy / distance;
      const projectile = createProjectile({
        id: `projectile-${state.nextProjectileId++}`,
        x: enemy.x + directionX * config.shooter.projectileSpawnOffset,
        y: enemy.y + directionY * config.shooter.projectileSpawnOffset,
        rotation: Math.atan2(directionX, -directionY),
        ownerId: enemy.id,
        isPlayerOwned: false,
      }, config.shooter);
      state.projectiles.set(projectile.id, projectile);
      enemy.fireCooldownRemaining = config.shooter.fireCooldown;
    }
  }

  update(state: GameState, input: InputSnapshot, deltaSeconds: number, config: GameConfig): void {
    const cooldowns = state.weaponCooldowns;
    // Cooldowns advance only when the simulation advances.
    cooldowns.front = Math.max(0, cooldowns.front - deltaSeconds);
    cooldowns.left = Math.max(0, cooldowns.left - deltaSeconds);
    cooldowns.right = Math.max(0, cooldowns.right - deltaSeconds);
    const player = state.players.values().next().value;
    if (!player) return;

    // Ignore floating-point residue after subtracting fixed timesteps.
    if (input.fireFront && cooldowns.front <= 1e-9) {
      this.fire(state, player, player.rotation, config.frontShotOffset, 0, config);
      cooldowns.front = config.weaponCooldowns.primary;
    }
    if (input.fireLeft && cooldowns.left <= 1e-9) {
      this.fireBroadside(state, player, -1, config);
      cooldowns.left = config.weaponCooldowns.secondary;
    }
    if (input.fireRight && cooldowns.right <= 1e-9) {
      this.fireBroadside(state, player, 1, config);
      cooldowns.right = config.weaponCooldowns.secondary;
    }
  }

  private fireBroadside(state: GameState, player: Player, side: number, config: GameConfig): void {
    const rotation = player.rotation + side * Math.PI / 2;
    for (let index = 0; index < config.broadsideProjectileCount; index += 1) {
      const alongShip = (index - (config.broadsideProjectileCount - 1) / 2) * config.broadsideSpacing;
      this.fire(state, player, rotation, config.broadsideOffset, alongShip, config);
    }
  }

  private fire(
    state: GameState, player: Player, rotation: number,
    outwardOffset: number, alongShip: number, config: GameConfig,
  ): void {
    // Rotation zero faces up: forward = (sin(rotation), -cos(rotation)).
    const projectile = createProjectile({
      id: `projectile-${state.nextProjectileId++}`,
      x: player.x + Math.sin(rotation) * outwardOffset + Math.sin(player.rotation) * alongShip,
      y: player.y - Math.cos(rotation) * outwardOffset - Math.cos(player.rotation) * alongShip,
      rotation,
      ownerId: player.id,
      isPlayerOwned: true,
    }, config);
    state.projectiles.set(projectile.id, projectile);
  }
}
