import { Graphics } from 'pixi.js';

// Presentation only; the game supplies real movement segments and active time.
export const TRAIL_VISUALS = { duration: 0.18, maximumLength: 72, maximumCount: 256 } as const;

interface Trail {
  startX: number; startY: number; x: number; y: number;
  distance: number; remaining: number;
}

export class ProjectileTrails {
  readonly graphics = new Graphics();
  private readonly trails = new Map<string, Trail>();
  private dirty = false;

  record(id: string, fromX: number, fromY: number, x: number, y: number): void {
    const dx = x - fromX; const dy = y - fromY;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0) return;
    let trail = this.trails.get(id);
    if (!trail) {
      if (this.trails.size >= TRAIL_VISUALS.maximumCount) {
        const oldest = this.trails.keys().next().value;
        if (oldest !== undefined) this.trails.delete(oldest);
      }
      trail = { startX: fromX, startY: fromY, x, y, distance: 0, remaining: 0 };
      this.trails.set(id, trail);
    }
    trail.distance = Math.min(TRAIL_VISUALS.maximumLength, trail.distance + distance);
    trail.startX = x - dx / distance * trail.distance;
    trail.startY = y - dy / distance * trail.distance;
    trail.x = x; trail.y = y;
    trail.remaining = TRAIL_VISUALS.duration;
    this.dirty = true;
  }

  update(deltaSeconds: number): void {
    for (const [id, trail] of this.trails) {
      trail.remaining -= deltaSeconds;
      if (trail.remaining <= 0) this.trails.delete(id);
      this.dirty = true;
    }
  }

  render(): void {
    if (!this.dirty) return;
    this.graphics.clear();
    for (const trail of this.trails.values()) {
      this.graphics.moveTo(trail.startX, trail.startY).lineTo(trail.x, trail.y)
        .stroke({ color: 0xe6fcff, width: 2.4, alpha: 0.55 * trail.remaining / TRAIL_VISUALS.duration });
    }
    this.dirty = false;
  }

  clear(): void { this.trails.clear(); this.graphics.clear(); this.dirty = false; }
  destroy(): void { this.clear(); this.graphics.destroy(); }
}
