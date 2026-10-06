import type { GameState } from '../core/GameState';
import type { GameConfig } from '@/config/gameConfig';
import { SeededRandom } from '../core/SeededRandom';
import { createChaser } from '../entities/Chaser';
import { createShooter } from '../entities/Shooter';

function tooClose(x: number, y: number, targetX: number, targetY: number, distance: number): boolean {
  const dx = x - targetX;
  const dy = y - targetY;
  return dx * dx + dy * dy <= distance * distance;
}

export class SpawnSystem {
  private readonly random: SeededRandom;
  private remainingSeconds: number;
  private nextEnemyId = 1;

  constructor(private readonly config: GameConfig) {
    const weights = config.enemySpawnWeights;
    if (!Number.isFinite(config.enemySpawnInterval) || config.enemySpawnInterval <= 0
      || !Number.isInteger(config.enemySpawnMaxAttempts) || config.enemySpawnMaxAttempts <= 0
      || !Number.isFinite(weights.chaser) || weights.chaser < 0
      || !Number.isFinite(weights.shooter) || weights.shooter < 0
      || !Number.isFinite(weights.chaser + weights.shooter) || weights.chaser + weights.shooter <= 0
      || !Number.isInteger(config.enemySpawnSeed)
      || !Number.isFinite(config.enemySpawnMinimumDistance) || config.enemySpawnMinimumDistance < 0
      || !Number.isFinite(config.enemySpawnMargin) || config.enemySpawnMargin < 0) {
      throw new Error('Invalid enemy spawn configuration.');
    }
    this.random = new SeededRandom(config.enemySpawnSeed);
    this.remainingSeconds = config.enemySpawnInterval;
  }

  update(state: GameState, deltaSeconds: number): void {
    if (state.status !== 'running') return;
    this.remainingSeconds -= deltaSeconds;
    if (this.remainingSeconds > 1e-9) return;
    // One bounded attempt per interval; no backlog of spawns after a large update.
    this.remainingSeconds += this.config.enemySpawnInterval;
    // Preserve normal timestep overshoot, but never accumulate a burst of overdue spawns.
    if (this.remainingSeconds <= 0) this.remainingSeconds = this.config.enemySpawnInterval;
    const player = state.players.values().next().value;
    if (!player) return;

    const weights = this.config.enemySpawnWeights;
    const type = this.random.next() * (weights.chaser + weights.shooter) < weights.chaser
      ? 'chaser' : 'shooter';
    const radius = this.config[type].collisionRadius;
    const margin = Math.max(radius, this.config.enemySpawnMargin, this.config.enemyBoundaryPadding);
    const width = this.config.arenaWidth - margin * 2;
    const height = this.config.arenaHeight - margin * 2;
    if (width <= 0 || height <= 0) return;

    for (let attempt = 0; attempt < this.config.enemySpawnMaxAttempts; attempt += 1) {
      const x = margin + this.random.next() * width;
      const y = margin + this.random.next() * height;
      if (!this.isValidPosition(state, x, y, radius)) continue;
      const id = `enemy-${this.nextEnemyId++}`;
      const enemy = type === 'chaser'
        ? createChaser(id, x, y, this.config.chaser)
        : createShooter(id, x, y, this.config.shooter);
      enemy.rotation = Math.atan2(player.x - x, -(player.y - y));
      state.enemies.set(id, enemy);
      return;
    }
  }

  isValidPosition(state: GameState, x: number, y: number, radius: number): boolean {
    const margin = Math.max(radius, this.config.enemySpawnMargin, this.config.enemyBoundaryPadding);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0
      || x < margin || x > this.config.arenaWidth - margin
      || y < margin || y > this.config.arenaHeight - margin) return false;
    for (const player of state.players.values()) {
      const distance = Math.max(this.config.enemySpawnMinimumDistance, radius + player.collisionRadius);
      if (tooClose(x, y, player.x, player.y, distance)) return false;
    }
    for (const island of state.islands) {
      for (const collider of island.colliders) {
        if (tooClose(x, y, island.x + collider.x, island.y + collider.y, radius + collider.radius)) return false;
      }
    }
    for (const enemy of state.enemies.values()) {
      if (enemy.health > 0 && tooClose(x, y, enemy.x, enemy.y, radius + enemy.collisionRadius)) return false;
    }
    return true;
  }
}
