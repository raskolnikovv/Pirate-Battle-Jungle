import { Application, Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { GameAssets } from '../assets/gameAssets';
import type { GameState } from '../core/GameState';

export const SHOW_COLLISION_DEBUG = false;

export class GameRenderer {
  private app: Application | null = null;
  private stage: Container | null = null;
  private playerSprite: Sprite | null = null;
  private assets: GameAssets | null = null;
  private islandLayer: Container | null = null;
  private readonly islandViews = new Map<string, Container>();
  private projectileLayer: Container | null = null;
  private readonly projectileViews = new Map<string, Sprite>();
  private enemyLayer: Container | null = null;
  private readonly enemyViews = new Map<string, Sprite>();
  private collisionDebug: Graphics | null = null;

  constructor(
    private readonly arenaWidth: number,
    private readonly arenaHeight: number,
  ) {}

  attach(app: Application, assets: GameAssets): void {
    this.app = app;
    this.stage = app.stage;
    this.assets = assets;
    const water = new TilingSprite({
      texture: assets.water,
      width: this.arenaWidth,
      height: this.arenaHeight,
    });
    this.islandLayer = new Container();
    this.playerSprite = new Sprite(assets.playerShip);
    this.playerSprite.anchor.set(0.5);
    this.projectileLayer = new Container();
    this.enemyLayer = new Container();
    this.stage.addChild(water, this.islandLayer, this.enemyLayer, this.projectileLayer, this.playerSprite);
    if (import.meta.env.DEV && SHOW_COLLISION_DEBUG) {
      this.collisionDebug = new Graphics();
      this.stage.addChild(this.collisionDebug);
    }
  }

  render(state: GameState | null, _alpha: number): void {
    this.renderIslands(state);
    this.renderProjectiles(state);
    this.renderEnemies(state);
    if (this.playerSprite) {
      const player = state?.players.values().next().value;
      if (player) {
        this.playerSprite.visible = true;
        this.playerSprite.position.set(player.x, player.y);
        this.playerSprite.rotation = player.rotation;
      } else {
        this.playerSprite.visible = false;
      }
    }

    this.renderCollisionDebug(state);
    this.app?.render();
  }

  private renderIslands(state: GameState | null): void {
    if (!this.islandLayer || !this.assets) return;
    const activeIds = new Set(state?.islands.map((island) => island.id));
    for (const [id, view] of this.islandViews) {
      if (!activeIds.has(id)) {
        view.destroy({ children: true });
        this.islandViews.delete(id);
      }
    }
    for (const island of state?.islands ?? []) {
      let view = this.islandViews.get(island.id);
      if (!view) {
        view = new Container();
        for (const tile of island.tiles) {
          const sprite = new Sprite(this.assets[tile.asset]);
          sprite.position.set(tile.x, tile.y);
          view.addChild(sprite);
        }
        this.islandLayer.addChild(view);
        this.islandViews.set(island.id, view);
      }
      view.position.set(island.x, island.y);
    }
  }

  private renderCollisionDebug(state: GameState | null): void {
    if (!this.collisionDebug) return;
    this.collisionDebug.clear();
    for (const enemy of state?.enemies.values() ?? []) {
      this.collisionDebug.circle(enemy.x, enemy.y, enemy.collisionRadius)
        .stroke({ color: 0xffcc00, width: 2 });
    }
    for (const player of state?.players.values() ?? []) {
      this.collisionDebug.circle(player.x, player.y, player.collisionRadius)
        .stroke({ color: 0x00ff80, width: 2 });
    }
    for (const island of state?.islands ?? []) {
      for (const collider of island.colliders) {
        this.collisionDebug.circle(island.x + collider.x, island.y + collider.y, collider.radius)
          .stroke({ color: 0xff4466, width: 2 });
      }
    }
  }

  private renderProjectiles(state: GameState | null): void {
    if (!this.projectileLayer || !this.assets) return;
    for (const [id, sprite] of this.projectileViews) {
      if (!state?.projectiles.has(id)) {
        sprite.destroy();
        this.projectileViews.delete(id);
      }
    }
    for (const projectile of state?.projectiles.values() ?? []) {
      let sprite = this.projectileViews.get(projectile.id);
      if (!sprite) {
        sprite = new Sprite(this.assets.cannonBall);
        sprite.anchor.set(0.5);
        this.projectileLayer.addChild(sprite);
        this.projectileViews.set(projectile.id, sprite);
      }
      sprite.position.set(projectile.x, projectile.y);
    }
  }

  private renderEnemies(state: GameState | null): void {
    if (!this.enemyLayer || !this.assets) return;
    for (const [id, sprite] of this.enemyViews) {
      if (!state?.enemies.has(id)) {
        sprite.destroy();
        this.enemyViews.delete(id);
      }
    }
    for (const enemy of state?.enemies.values() ?? []) {
      let sprite = this.enemyViews.get(enemy.id);
      if (!sprite) {
        sprite = new Sprite(enemy.type === 'shooter' ? this.assets.shooterShip : this.assets.chaserShip);
        sprite.anchor.set(0.5);
        this.enemyLayer.addChild(sprite);
        this.enemyViews.set(enemy.id, sprite);
      }
      sprite.position.set(enemy.x, enemy.y);
      sprite.rotation = enemy.rotation;
    }
  }

  destroy(): void {
    this.stage?.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.islandViews.clear();
    this.projectileViews.clear();
    this.enemyViews.clear();
    this.enemyLayer = null;
    this.projectileLayer = null;
    this.islandLayer = null;
    this.collisionDebug = null;
    this.assets = null;
    this.app = null;
    this.stage = null;
    this.playerSprite = null;
  }
}
