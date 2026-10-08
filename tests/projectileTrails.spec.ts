import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/Game.ts'))!.name;
    const { Game } = await import(path); const original = Game.prototype.start;
    Game.prototype.start = function(config: unknown) {
      original.call(this, config); this.stop(); Reflect.set(this, 'spawnSystem', null);
      Object.assign(window, { trailGame: this });
    };
  });
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
}

async function advance(page: Page, steps: number) {
  await page.evaluate(steps => {
    const game = Reflect.get(window, 'trailGame');
    for (let step = 0; step < steps; step++) Reflect.get(game, 'update').call(game, 1 / 60);
    Reflect.get(game, 'render').call(game, 0);
  }, steps);
}

async function inspect(page: Page) {
  return page.evaluate(() => {
    const game = Reflect.get(window, 'trailGame');
    const trails = Reflect.get(Reflect.get(game, 'renderer'), 'projectileTrails');
    return [...Reflect.get(trails, 'trails').entries()].map(([id, trail]: [string, object]) => ({ id, ...trail }));
  });
}

for (const [name, width, height] of [['desktop', 1280, 900], ['portrait', 390, 844], ['landscape', 844, 390]] as const) {
  test.describe(name, () => {
    test.use({ viewport: { width, height }, isMobile: name !== 'desktop', hasTouch: name !== 'desktop' });
    test(`all player weapons and enemy trails follow movement, freeze and clean up: ${name}`, async ({ page }) => {
      await start(page);
      await page.evaluate(async () => {
        const game = Reflect.get(window, 'trailGame'); const config = Reflect.get(game, 'configSnapshot');
        const { createShooter } = await import('/src/game/entities/Shooter.ts');
        game.getState().enemies.set('shooter', createShooter('shooter', 480, 100, config.shooter));
      });
      for (const key of ['Space', 'q', 'e']) await page.keyboard.down(key);
      await advance(page, 8);
      for (const key of ['Space', 'q', 'e']) await page.keyboard.up(key);
      const trails = await inspect(page);
      expect(trails).toHaveLength(8); // Front + 3 + 3 + enemy.
      expect(await page.evaluate(() => {
        const game = Reflect.get(window, 'trailGame'); const state = game.getState();
        const trails = Reflect.get(Reflect.get(Reflect.get(game, 'renderer'), 'projectileTrails'), 'trails');
        return [...state.projectiles.values()].every((projectile: { id: string; x: number; y: number; rotation: number }) => {
          const trail = trails.get(projectile.id);
          return Math.abs(trail.x - projectile.x) < 1e-8 && Math.abs(trail.y - projectile.y) < 1e-8
            && Math.abs((trail.x - trail.startX) * Math.cos(projectile.rotation)
              + (trail.y - trail.startY) * Math.sin(projectile.rotation)) < 1e-8;
        });
      })).toBe(true);
      await expect(page.locator('canvas')).toHaveScreenshot(`cannonball-trails-${name}.png`);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      const paused = await inspect(page);
      await advance(page, 120);
      expect(await inspect(page)).toEqual(paused);
      await page.evaluate(() => {
        const game = Reflect.get(window, 'trailGame'); game.resume(); game.stop();
        game.getState().enemies.clear();
      });
      await advance(page, 240); // All shots hit, expire or leave the arena; residual trails expire too.
      expect(await inspect(page)).toEqual([]);
      await page.keyboard.down('Space'); await advance(page, 2); await page.keyboard.up('Space');
      expect((await inspect(page)).length).toBeGreaterThan(0);
      await page.evaluate(() => {
        const trails = Reflect.get(Reflect.get(Reflect.get(window, 'trailGame'), 'renderer'), 'projectileTrails');
        Object.assign(window, { oldTrailGraphics: trails.graphics, oldTrails: Reflect.get(trails, 'trails') });
      });
      await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
      expect(await page.evaluate(() => Reflect.get(window, 'oldTrailGraphics').destroyed
        && Reflect.get(window, 'oldTrails').size === 0)).toBe(true);
      await page.getByRole('button', { name: 'Start Game', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
      expect(await inspect(page)).toEqual([]);
    });
  });
}

for (const coast of [0, 1]) test(`coastal impact ${coast} clips the trail to first contact and fades without extending onto land`, async ({ page }) => {
  await start(page);
  await page.evaluate(coast => {
    const game = Reflect.get(window, 'trailGame'); const player = game.getState().players.values().next().value;
    const island = game.getState().islands[coast];
    const direction = coast === 0 ? 1 : -1;
    const distance = island.colliders[0].radius + 122;
    player.x = island.x + direction * distance / Math.sqrt(2);
    player.y = island.y + direction * distance / Math.sqrt(2);
    player.rotation = Math.atan2(island.x - player.x, -(island.y - player.y));
  }, coast);
  await page.keyboard.down('Space'); await advance(page, 1); await page.keyboard.up('Space');
  await advance(page, 8);
  expect(await page.evaluate(() => Reflect.get(window, 'trailGame').getState().projectiles.size)).toBe(0);
  const trails = await inspect(page);
  expect(trails).toHaveLength(1);
  const center = coast === 0 ? { x: 60, y: 60, radius: 234 } : { x: 880, y: 650, radius: 260 };
  expect(Math.hypot(trails[0].x - center.x, trails[0].y - center.y)).toBeCloseTo(center.radius + 5, 5);
  expect(trails[0].distance).toBeLessThanOrEqual(72);
  await advance(page, 12);
  expect(await inspect(page)).toEqual([]);
});

test('trail memory is bounded and rendering alone does not age or recreate trails', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const game = Reflect.get(window, 'trailGame'); const renderer = Reflect.get(game, 'renderer');
    const trails = Reflect.get(renderer, 'projectileTrails');
    for (let id = 0; id < 300; id++) {
      renderer.trackProjectileMovement(String(id), 100, 100, 500, 100);
    }
    const records = Reflect.get(trails, 'trails'); const last = records.get('299');
    for (let frame = 0; frame < 10; frame++) Reflect.get(game, 'render').call(game, 0);
    return { count: records.size, reused: last === records.get('299'), remaining: last.remaining,
      length: last.x - last.startX };
  });
  expect(result).toEqual({ count: 256, reused: true, remaining: 0.18, length: 72 });
});
