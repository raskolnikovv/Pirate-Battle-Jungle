import { Container, Sprite } from 'pixi.js';
import type { GameAssetKey, GameAssets } from '../assets/gameAssets';

// Presentation values only: these never affect damage, cooldowns or collisions.
export const COMBAT_VISUALS = {
  muzzleDuration: 0.16,
  impactDuration: 0.18,
  explosionDuration: 0.5,
  damageFlashDuration: 0.18,
  damagedHealthRatio: 2 / 3,
  criticalHealthRatio: 1 / 3,
} as const;

export type CombatVisualEvent =
  | { type: 'fire'; x: number; y: number; rotation: number }
  | { type: 'impact' | 'destroy'; x: number; y: number }
  | { type: 'damage'; shipId: string };

interface EffectView {
  sprite: Sprite;
  type: 'fire' | 'impact' | 'destroy';
  age: number;
  duration: number;
}

// The supplied explosions are differently sized drawings, not an atlas animation.
// Play small -> medium -> large -> medium -> small at their natural proportions.
const EXPLOSION_FRAMES: readonly GameAssetKey[] = [
  'explosionSmall', 'explosionMedium', 'explosionLarge', 'explosionMedium', 'explosionSmall',
];

export class CombatEffects {
  readonly container = new Container();
  private readonly effects: EffectView[] = [];
  private readonly damageFlashes = new Map<string, number>();

  constructor(private readonly assets: GameAssets) {}

  emit(event: CombatVisualEvent): void {
    if (event.type === 'damage') {
      this.damageFlashes.set(event.shipId, COMBAT_VISUALS.damageFlashDuration);
      return;
    }
    const sprite = new Sprite(event.type === 'fire' ? this.assets.fireLarge : this.assets.explosionSmall);
    sprite.anchor.set(0.5, event.type === 'fire' ? 1 : 0.5);
    sprite.position.set(event.x, event.y);
    if (event.type === 'fire') sprite.rotation = event.rotation;
    if (event.type === 'impact') sprite.scale.set(0.5);
    this.container.addChild(sprite);
    this.effects.push({
      sprite, type: event.type, age: 0,
      duration: event.type === 'fire' ? COMBAT_VISUALS.muzzleDuration
        : event.type === 'impact' ? COMBAT_VISUALS.impactDuration : COMBAT_VISUALS.explosionDuration,
    });
  }

  update(deltaSeconds: number): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.age += deltaSeconds;
      if (effect.age >= effect.duration) {
        // Destroy the view, never the shared texture used by other effects.
        effect.sprite.destroy();
        this.effects.splice(index, 1);
        continue;
      }
      const progress = effect.age / effect.duration;
      effect.sprite.texture = effect.type === 'fire'
        ? (progress < 0.5 ? this.assets.fireLarge : this.assets.fireSmall)
        : this.assets[EXPLOSION_FRAMES[Math.min(EXPLOSION_FRAMES.length - 1,
          Math.floor(progress * EXPLOSION_FRAMES.length))]];
      effect.sprite.alpha = 1 - progress * progress;
    }
    for (const [id, remaining] of this.damageFlashes) {
      const next = remaining - deltaSeconds;
      if (next <= 0) this.damageFlashes.delete(id);
      else this.damageFlashes.set(id, next);
    }
  }

  shipTint(id: string): number {
    return this.damageFlashes.has(id) ? 0xff9878 : 0xffffff;
  }

  clear(): void {
    for (const effect of this.effects) effect.sprite.destroy();
    this.effects.length = 0;
    this.damageFlashes.clear();
  }

  destroy(): void {
    this.clear();
    this.container.destroy();
  }
}
