import type { Application, Container } from 'pixi.js';
import type { Game } from '../core/Game';
import type { GameAssets } from '../assets/gameAssets';
import type { GameConfig } from '@/config/gameConfig';
import { gameAudio } from '@/audio/AudioManager';

// This module is dynamically loaded only in an explicitly enabled optimized profiling build.
const intervals = new Float64Array(100_000);
const entities: object[] = [];
let count = 0; let dropped = 0; let last = 0; let started = 0; let nextEntitySample = 0;
let active: Game | null = null;
let resources: (() => object) | null = null;
let final: object | null = null;
let lastCleanup: object | null = null;
let configuration: GameConfig | null = null;
let renderFrames = 0; let ended = 0;
let maximumEnemies = 0; let maximumProjectiles = 0; let maximumTotalEntities = 0;
function nodes(container: Container): number {
  return 1 + container.children.reduce((sum, child) => sum + nodes(child), 0);
}
function snapshot() {
  const state = active?.getState(); const player = state?.players.values().next().value;
  return state ? { status: state.status, finishReason: state.finishReason, elapsedSeconds: state.elapsedSeconds,
    score: state.score, enemiesDefeated: state.enemiesDefeated, shotsCreated: state.nextProjectileId - 1,
    player: player ? { x: player.x, y: player.y, rotation: player.rotation, health: player.health } : null,
    enemyShips: Array.from(state.enemies.values(), enemy => ({ x: enemy.x, y: enemy.y, type: enemy.type })),
    enemies: state.enemies.size, projectiles: state.projectiles.size, islands: state.islands.length,
    totalEntities: state.players.size + state.enemies.size + state.projectiles.size + state.islands.length } : null;
}
function report() {
  return { wallSeconds: started ? ((ended || performance.now()) - started) / 1000 : 0, renderFrames,
    intervalsMs: Array.from(intervals.subarray(0, count)), droppedSamples: dropped,
    entitySamples: [...entities], maximumEnemies, maximumProjectiles, maximumTotalEntities, configuration, final: snapshot() ?? final };
}
Object.assign(window, { pirateProfile: {
  snapshot, report,
  resources: () => ({ activeGames: Number(active !== null), canvasCount: document.querySelectorAll('canvas').length,
    ...(resources?.() ?? { pixiDisplayObjects: 0, ownedGameplayTextures: 0 }), ...gameAudio.getResourceCounts(), lastCleanup }),
  // The same public input pathway used by the touch UI; no simulation state writes.
  steer: (x: number, y: number) => active?.setPointerInput(-100, {
    touchDirection: { x, y }, fireFront: true, fireLeft: true, fireRight: true }),
  release: () => active?.releasePointer(-100),
} });
export function attachProfile(game: Game, app: Application, assets: GameAssets, config: GameConfig): () => (() => void) {
  active = game; configuration = config; count = 0; dropped = 0; last = 0; started = performance.now();
  maximumEnemies = 0; maximumProjectiles = 0; maximumTotalEntities = 0;
  renderFrames = 0; ended = 0; nextEntitySample = 0; entities.length = 0; final = null; lastCleanup = null;
  resources = () => ({ pixiDisplayObjects: nodes(app.stage),
    ownedGameplayTextures: Object.values(assets).filter(texture => !texture.destroyed).length });
  game.setRenderObserver(timestamp => {
    renderFrames++;
    const state = game.getState();
    if (state) {
      maximumEnemies = Math.max(maximumEnemies, state.enemies.size);
      maximumProjectiles = Math.max(maximumProjectiles, state.projectiles.size);
      maximumTotalEntities = Math.max(maximumTotalEntities,
        state.players.size + state.enemies.size + state.projectiles.size + state.islands.length);
    }
    if (last) { if (count < intervals.length) intervals[count++] = timestamp - last; else dropped++; }
    last = timestamp;
    if (timestamp >= nextEntitySample && entities.length < 1000) {
      const sample = snapshot();
      entities.push({ wallSeconds: (timestamp - started) / 1000, ...sample });
      nextEntitySample = timestamp + 1000;
    }
  });
  return () => {
    // Hold references only within synchronous teardown, then retain scalar evidence.
    const displayObjects: Container[] = [];
    const visit = (container: Container) => {
      displayObjects.push(container); for (const child of container.children) visit(child);
    };
    visit(app.stage);
    const textures = Object.values(assets);
    ended = performance.now(); game.setRenderObserver(undefined); final = snapshot(); active = null; resources = null;
    return () => { lastCleanup = {
      displayObjectsRetained: displayObjects.filter(object => !object.destroyed).length,
      texturesRetained: textures.filter(texture => !texture.destroyed).length,
      gameStateCleared: game.getState() === null,
    }; };
  };
}
