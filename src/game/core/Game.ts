import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/config/gameConfig';
import { createPlayer } from '../entities/Player';
import { createIsland } from '../entities/Island';
import { InputManager } from '../input/InputManager';
import { GameRenderer } from '../rendering/GameRenderer';
import { MovementSystem } from '../systems/MovementSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { GameLoop } from './GameLoop';
import type { GameState } from './GameState';

const PLAYER_ID = 'player';

function copyConfig(config: GameConfig): GameConfig {
  return {
    ...config,
    weaponCooldowns: { ...config.weaponCooldowns },
    enemySpawnWeights: { ...config.enemySpawnWeights },
    chaser: { ...config.chaser },
    shooter: { ...config.shooter },
  };
}

export class Game {
  private readonly loop: GameLoop;
  private readonly input = new InputManager();
  private readonly movementSystem = new MovementSystem();
  private readonly collisionSystem = new CollisionSystem();
  private readonly combatSystem = new CombatSystem();
  private configSnapshot: GameConfig | null = null;
  private state: GameState | null = null;
  private spawnSystem: SpawnSystem | null = null;

  constructor(private readonly renderer: GameRenderer) {
    this.loop = new GameLoop({
      update: (deltaSeconds) => this.update(deltaSeconds),
      render: (alpha) => this.render(alpha),
    });
  }

  getState(): GameState | null {
    return this.state;
  }

  start(config: GameConfig = DEFAULT_GAME_CONFIG): void {
    if (this.loop.isRunning()) return;

    this.configSnapshot = copyConfig(config);
    this.spawnSystem = new SpawnSystem(this.configSnapshot);
    this.state = this.createInitialState(this.configSnapshot);
    this.input.attach();
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  destroy(): void {
    this.stop();
    this.input.detach();
    this.state = null;
    this.spawnSystem = null;
  }

  private createInitialState(config: GameConfig): GameState {
    const { arenaWidth, arenaHeight } = config;
    const player = createPlayer(
      PLAYER_ID,
      arenaWidth / 2,
      arenaHeight / 2,
      config.playerHealth,
      config.playerCollisionRadius,
    );

    return {
      players: new Map([[player.id, player]]),
      islands: [createIsland('island-1', arenaWidth * 0.7, arenaHeight * 0.4, config.islandCollisionRadius)],
      enemies: new Map(),
      projectiles: new Map(),
      weaponCooldowns: { front: 0, left: 0, right: 0 },
      nextProjectileId: 1,
      score: 0,
      elapsedSeconds: 0,
      isRunning: true,
    };
  }

  private update(deltaSeconds: number): void {
    if (!this.state?.isRunning || !this.configSnapshot) return;

    const input = this.input.snapshot();
    // Small movement steps prevent crossing an entire collider between checks.
    const maxStepDistance = this.configSnapshot.playerCollisionRadius / 2;
    const steps = Math.max(1, Math.ceil(
      this.configSnapshot.playerMovementSpeed * deltaSeconds / maxStepDistance,
    ), ...Array.from(this.state.enemies.values(), (enemy) => Math.ceil(
      enemy.speed * deltaSeconds / (enemy.collisionRadius / 2),
    )));
    const stepSeconds = deltaSeconds / steps;
    for (let step = 0; step < steps; step += 1) {
      this.movementSystem.update(this.state, input, stepSeconds, this.configSnapshot);
      this.movementSystem.updateEnemies(this.state, stepSeconds, this.configSnapshot);
      this.collisionSystem.resolveShipsIslands(this.state);
      this.combatSystem.update(this.state, input, stepSeconds, this.configSnapshot);
      this.updateProjectiles(this.state, stepSeconds, this.configSnapshot);
      // Resolve existing shots first: a Shooter killed this step cannot fire.
      // Newly fired enemy shots start moving on the next simulation step.
      this.combatSystem.updateShooters(this.state, stepSeconds, this.configSnapshot);
      for (const event of this.collisionSystem.chaserContacts(this.state)) {
        this.combatSystem.applyCollision(this.state, event);
      }
      // New enemies begin AI/combat on the next step, preserving their validated spawn position.
      this.spawnSystem?.update(this.state, stepSeconds);
    }
  }

  private updateProjectiles(state: GameState, deltaSeconds: number, config: GameConfig): void {
    for (const projectile of state.projectiles.values()) {
      const next = this.movementSystem.nextProjectilePosition(projectile, deltaSeconds);
      const hit = projectile.lifetime > 0
        ? this.collisionSystem.firstProjectileHit(state, projectile, next.x, next.y)
        : null;
      projectile.lifetime -= deltaSeconds;
      const outside = next.x < 0 || next.x > config.arenaWidth || next.y < 0 || next.y > config.arenaHeight;
      if (hit || projectile.lifetime <= 0 || outside) {
        // Consume before applying damage so this projectile cannot hit a second target.
        state.projectiles.delete(projectile.id);
        if (hit?.enemyId) {
          this.combatSystem.applyCollision(state, {
            type: 'projectile-enemy', sourceId: projectile.id,
            targetId: hit.enemyId, damage: projectile.damage,
          });
        } else if (hit?.playerId) {
          this.combatSystem.applyCollision(state, {
            type: 'projectile-player', sourceId: projectile.id,
            targetId: hit.playerId, damage: projectile.damage,
          });
        }
      } else {
        projectile.x = next.x;
        projectile.y = next.y;
      }
    }
  }

  private render(alpha: number): void {
    this.renderer.render(this.state, alpha);
  }
}
