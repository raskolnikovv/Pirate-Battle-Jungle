import { DEFAULT_GAME_CONFIG, SESSION_DURATION_LIMITS, type GameConfig } from '@/config/gameConfig';
import { createPlayer } from '../entities/Player';
import { createIsland } from '../entities/Island';
import { InputManager, type InputSnapshot } from '../input/InputManager';
import { GameRenderer } from '../rendering/GameRenderer';
import { MovementSystem } from '../systems/MovementSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { GameLoop } from './GameLoop';
import type { GameFinishReason, GameState } from './GameState';
import { createHudSnapshot, type GameHudSnapshot } from './GameHudSnapshot';
import type { CompletedMatch } from '@/types/completedMatch';
import { createMatchId } from './createMatchId';

const PLAYER_ID = 'player';

function copyConfig(config: GameConfig): GameConfig {
  return {
    ...config,
    weaponCooldowns: { ...config.weaponCooldowns },
    enemySpawnWeights: { ...config.enemySpawnWeights },
    enemyKillRewards: { ...config.enemyKillRewards },
    chaser: { ...config.chaser },
    shooter: { ...config.shooter },
  };
}

export class Game {
  private readonly loop: GameLoop;
  private readonly input = new InputManager();
  private readonly movementSystem = new MovementSystem();
  private readonly collisionSystem = new CollisionSystem();
  private readonly combatSystem: CombatSystem;
  private configSnapshot: GameConfig | null = null;
  private state: GameState | null = null;
  private spawnSystem: SpawnSystem | null = null;
  private lastHudSnapshot: GameHudSnapshot | null = null;
  private readonly handleBlur = () => this.pause();
  private readonly handleVisibilityChange = () => {
    if (document.hidden) this.pause();
  };

  constructor(
    private readonly renderer: GameRenderer,
    private readonly onHudChange?: (snapshot: GameHudSnapshot) => void,
    private readonly onMatchComplete?: (result: CompletedMatch) => void,
  ) {
    this.combatSystem = new CombatSystem((event) => this.renderer.emitCombatEffect(event));
    this.loop = new GameLoop({
      update: (deltaSeconds) => {
        this.update(deltaSeconds);
        this.publishHud();
      },
      render: (alpha) => this.render(alpha),
    });
  }

  getState(): GameState | null {
    return this.state;
  }

  setPointerInput(pointerId: number, intentions: Partial<InputSnapshot>): void {
    if (this.state?.status === 'running') this.input.setPointerInput(pointerId, intentions);
  }

  releasePointer(pointerId: number): void { this.input.releasePointer(pointerId); }

  start(config: GameConfig = DEFAULT_GAME_CONFIG): void {
    if (this.state?.status === 'paused'
      || (this.loop.isRunning() && this.state?.status === 'running')) return;
    if (!Number.isFinite(config.sessionDuration)
      || config.sessionDuration < SESSION_DURATION_LIMITS.min
      || config.sessionDuration > SESSION_DURATION_LIMITS.max) {
      throw new Error('Game session duration must be between 60 and 180 seconds.');
    }

    this.loop.stop();
    this.renderer.clearCombatEffects();
    this.configSnapshot = copyConfig(config);
    this.spawnSystem = new SpawnSystem(this.configSnapshot);
    this.state = this.createInitialState(this.configSnapshot);
    this.lastHudSnapshot = null;
    this.publishHud();
    this.input.attach();
    this.loop.start();
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    // Initialization may finish after the user has switched tabs/windows.
    if (document.hidden || !document.hasFocus()) this.pause();
  }

  pause(): void {
    if (this.state?.status !== 'running') return;
    this.state.status = 'paused';
    this.input.detach();
    this.loop.stop();
    this.render(0);
    this.publishHud();
  }

  resume(): void {
    if (this.state?.status !== 'paused' || document.hidden || !document.hasFocus()) return;
    this.state.status = 'running';
    this.input.attach();
    // start resets lastTime and accumulator, discarding the paused interval.
    this.loop.start();
    this.publishHud();
  }

  private detachPauseListeners(): void {
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  stop(): void {
    this.loop.stop();
  }

  destroy(): void {
    this.stop();
    this.renderer.clearCombatEffects();
    this.input.detach();
    this.detachPauseListeners();
    this.state = null;
    this.spawnSystem = null;
    this.lastHudSnapshot = null;
  }

  private publishHud(): void {
    if (!this.state || !this.onHudChange) return;
    const next = createHudSnapshot(this.state);
    const previous = this.lastHudSnapshot;
    if (previous && next.health === previous.health && next.maxHealth === previous.maxHealth
      && next.score === previous.score && next.remainingSeconds === previous.remainingSeconds
      && next.status === previous.status && next.finishReason === previous.finishReason) return;
    this.lastHudSnapshot = next;
    this.onHudChange(next);
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
      enemiesDefeated: 0,
      elapsedSeconds: 0,
      durationSeconds: config.sessionDuration,
      remainingSeconds: config.sessionDuration,
      status: 'running',
      finishReason: null,
    };
  }

  private update(deltaSeconds: number): void {
    if (this.state?.status !== 'running' || !this.configSnapshot) return;
    if (this.state.remainingSeconds <= 0) {
      this.state.remainingSeconds = 0;
      this.state.elapsedSeconds = this.state.durationSeconds;
      this.finishMatch('time_expired');
      return;
    }
    if (this.finishIfDefeated()) return;
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    // The final update simulates only the time still available in the match.
    const simulationSeconds = Math.min(deltaSeconds, this.state.remainingSeconds);

    const input = this.input.snapshot();
    // Small movement steps prevent crossing an entire collider between checks.
    const maxStepDistance = this.configSnapshot.playerCollisionRadius / 2;
    const steps = Math.max(1, Math.ceil(
      this.configSnapshot.playerMovementSpeed * simulationSeconds / maxStepDistance,
    ), ...Array.from(this.state.enemies.values(), (enemy) => Math.ceil(
      enemy.speed * simulationSeconds / (enemy.collisionRadius / 2),
    )));
    for (let step = 0; step < steps; step += 1) {
      const stepSeconds = Math.min(simulationSeconds / steps, this.state.remainingSeconds);
      this.renderer.updateCombatEffects(stepSeconds);
      // Account for this active step even if lethal damage ends it early.
      this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - stepSeconds);
      if (this.state.remainingSeconds <= 1e-9) this.state.remainingSeconds = 0;
      this.state.elapsedSeconds = this.state.durationSeconds - this.state.remainingSeconds;
      this.movementSystem.update(this.state, input, stepSeconds, this.configSnapshot);
      this.movementSystem.updateEnemies(this.state, stepSeconds, this.configSnapshot);
      this.collisionSystem.resolveShipsIslands(this.state);
      this.combatSystem.update(this.state, input, stepSeconds, this.configSnapshot);
      if (this.updateProjectiles(this.state, stepSeconds, this.configSnapshot)) return;
      // Resolve existing shots first: a Shooter killed this step cannot fire.
      // Newly fired enemy shots start moving on the next simulation step.
      this.combatSystem.updateShooters(this.state, stepSeconds, this.configSnapshot);
      for (const event of this.collisionSystem.chaserContacts(this.state)) {
        this.combatSystem.applyCollision(this.state, event, this.configSnapshot);
        if (this.finishIfDefeated()) return;
      }
      // New enemies begin AI/combat on the next step, preserving their validated spawn position.
      this.spawnSystem?.update(this.state, stepSeconds);
      if (this.state.remainingSeconds <= 0) {
        this.finishMatch('time_expired');
        return;
      }
    }
  }

  private finishIfDefeated(): boolean {
    const player = this.state?.players.values().next().value;
    if (!player || player.health > 0) return false;
    player.health = 0;
    this.finishMatch('defeated');
    return true;
  }

  private finishMatch(reason: GameFinishReason): void {
    if (this.state?.status !== 'running') return;
    this.state.status = 'finished';
    this.state.finishReason = reason;
    this.input.detach();
    this.detachPauseListeners();
    if (this.configSnapshot) {
      const config = copyConfig(this.configSnapshot);
      for (const value of Object.values(config)) {
        if (typeof value === 'object') Object.freeze(value);
      }
      this.onMatchComplete?.(Object.freeze({
        matchId: createMatchId(),
        completedAt: new Date().toISOString(),
        score: this.state.score,
        enemiesDefeated: this.state.enemiesDefeated,
        elapsedSeconds: this.state.elapsedSeconds,
        endReason: reason === 'defeated' ? 'player_defeated' : 'time_expired',
        playerHealth: this.state.players.values().next().value?.health ?? 0,
        config: Object.freeze(config),
        registrationStatus: 'not_submitted',
      }));
    }
  }

  private updateProjectiles(state: GameState, deltaSeconds: number, config: GameConfig): boolean {
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
        if (hit) this.renderer.emitCombatEffect({
          type: 'impact',
          x: projectile.x + (next.x - projectile.x) * hit.fraction,
          y: projectile.y + (next.y - projectile.y) * hit.fraction,
        });
        if (hit?.enemyId) {
          this.combatSystem.applyCollision(state, {
            type: 'projectile-enemy', sourceId: projectile.id,
            targetId: hit.enemyId, damage: projectile.damage,
            isPlayerOwned: projectile.isPlayerOwned,
          }, config);
        } else if (hit?.playerId) {
          this.combatSystem.applyCollision(state, {
            type: 'projectile-player', sourceId: projectile.id,
            targetId: hit.playerId, damage: projectile.damage,
          }, config);
          if (this.finishIfDefeated()) return true;
        }
      } else {
        projectile.x = next.x;
        projectile.y = next.y;
      }
    }
    return false;
  }

  private render(alpha: number): void {
    this.renderer.render(this.state, alpha);
  }
}
