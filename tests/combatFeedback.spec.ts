import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/Game.ts'))!.name;
    const { Game } = await import(path);
    const original = Game.prototype.start;
    Game.prototype.start = function(config: unknown) {
      original.call(this, config);
      this.stop();
      // Isolate combat fixtures from unrelated random spawns; all combat rules run normally.
      Reflect.set(this, 'spawnSystem', null);
      Object.assign(window, { feedbackGame: this });
    };
  });
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
}

async function advance(page: Page, steps: number) {
  await page.evaluate(steps => {
    const game = Reflect.get(window, 'feedbackGame');
    for (let step = 0; step < steps; step++) Reflect.get(game, 'update').call(game, 1 / 60);
    Reflect.get(game, 'render').call(game, 0);
  }, steps);
}

async function inspect(page: Page) {
  return page.evaluate(() => {
    const game = Reflect.get(window, 'feedbackGame');
    const renderer = Reflect.get(game, 'renderer');
    const effects = Reflect.get(renderer, 'combatEffects');
    const assets = Reflect.get(renderer, 'assets');
    const state = game.getState();
    const player = state.players.values().next().value;
    const sprite = Reflect.get(renderer, 'playerSprite');
    const textureName = (texture: unknown) => Object.entries(assets).find(([, value]) => value === texture)?.[0];
    return {
      score: state.score, kills: state.enemiesDefeated, health: player.health,
      projectiles: state.projectiles.size, nextProjectileId: state.nextProjectileId,
      playerTexture: textureName(sprite.texture), playerTint: sprite.tint,
      enemies: Array.from(state.enemies.values(), (enemy: { id: string; health: number }) => ({
        id: enemy.id, health: enemy.health,
        texture: textureName(Reflect.get(renderer, 'enemyViews').get(enemy.id)?.texture),
        tint: Reflect.get(renderer, 'enemyViews').get(enemy.id)?.tint,
      })),
      effects: Reflect.get(effects, 'effects').map((effect: {
        type: string; age: number; sprite: { x: number; y: number; rotation: number; texture: unknown; alpha: number };
      }) => ({ type: effect.type, age: effect.age, x: effect.sprite.x, y: effect.sprite.y,
        rotation: effect.sprite.rotation, texture: textureName(effect.sprite.texture), alpha: effect.sprite.alpha })),
      views: effects.container.children.length,
    };
  });
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'mobile combat feedback' : 'desktop combat feedback', () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      isMobile: mobile, hasTouch: mobile });

    test('front and both broadsides show directional muzzle flashes, respect cooldowns and release textures safely', async ({ page }) => {
      await start(page);
      for (const [key, count, rotation] of [['Space', 1, 0], ['q', 3, -Math.PI / 2], ['e', 3, Math.PI / 2]] as const) {
        await page.keyboard.down(key);
        await advance(page, 1);
        const fired = await inspect(page);
        expect(fired.effects).toHaveLength(count);
        expect(fired.views).toBe(count);
        for (const effect of fired.effects) {
          expect(effect.type).toBe('fire');
          expect(effect.rotation).toBeCloseTo(rotation);
          expect(effect.texture).toBe('fireLarge');
        }
        await advance(page, 3);
        expect((await inspect(page)).nextProjectileId).toBe(fired.nextProjectileId);
        await page.keyboard.up(key);
        await advance(page, 3);
        for (const effect of (await inspect(page)).effects) expect(effect.texture).toBe('fireSmall');
        await page.evaluate(() => {
          const effects = Reflect.get(Reflect.get(Reflect.get(window, 'feedbackGame'), 'renderer'), 'combatEffects');
          Object.assign(window, { expiredViews: [...effects.container.children] });
        });
        await advance(page, 40);
        expect((await inspect(page)).effects).toHaveLength(0);
        expect((await inspect(page)).views).toBe(0);
        expect(await page.evaluate(() => Reflect.get(window, 'expiredViews').every((sprite: { destroyed: boolean }) => sprite.destroyed))).toBe(true);
        expect(await page.evaluate(() => {
          const assets = Reflect.get(Reflect.get(Reflect.get(window, 'feedbackGame'), 'renderer'), 'assets');
          return !assets.fireLarge.destroyed && !assets.fireSmall.destroyed;
        })).toBe(true);
      }
    });

    for (const enemyType of ['chaser', 'shooter'] as const) {
      test(`real player shots damage and destroy ${enemyType} with torn sails, one explosion and one point`, async ({ page }) => {
        await start(page);
        await page.evaluate(async enemyType => {
          const game = Reflect.get(window, 'feedbackGame');
          const player = game.getState().players.values().next().value;
          player.x = 300; player.y = 500;
          const path = enemyType === 'chaser' ? '/src/game/entities/Chaser.ts' : '/src/game/entities/Shooter.ts';
          const module = await import(path);
          const createEnemy = enemyType === 'chaser' ? module.createChaser : module.createShooter;
          game.getState().enemies.set('target', createEnemy('target', 300, 340, Reflect.get(game, 'configSnapshot')[enemyType]));
        }, enemyType);
        await page.keyboard.down('Space'); await advance(page, 1); await page.keyboard.up('Space');
        await advance(page, 10);
        const damaged = await inspect(page);
        expect(damaged.enemies[0]).toMatchObject({ health: 25, texture: `${enemyType}ShipDamaged`, tint: 0xff9878 });
        expect(damaged.effects.some((effect: { type: string }) => effect.type === 'impact')).toBe(true);
        expect(damaged.score).toBe(0);
        await advance(page, 12);
        await page.keyboard.down('Space'); await advance(page, 1); await page.keyboard.up('Space');
        await advance(page, 10);
        const destroyed = await inspect(page);
        expect(destroyed.enemies).toHaveLength(0);
        expect(destroyed.score).toBe(1);
        expect(destroyed.kills).toBe(1);
        expect(destroyed.effects.filter((effect: { type: string }) => effect.type === 'destroy')).toHaveLength(1);
        // Impact time differs with approaching Chasers and stationary Shooters.
        // Observe the animation across fixed steps instead of assuming a kill frame.
        const textures = new Set<string>();
        for (let step = 0; step < 18; step++) {
          await advance(page, 1);
          for (const effect of (await inspect(page)).effects) {
            if (effect.type === 'destroy') textures.add(effect.texture);
          }
        }
        expect(textures.has('explosionLarge')).toBe(true);
        expect(textures.size).toBeGreaterThan(1);
        await advance(page, 35);
        const finished = await inspect(page);
        expect(finished.effects).toHaveLength(0);
        expect(finished.score).toBe(1);
        expect(finished.playerTint).toBe(0xffffff);
      });
    }

    test('Chaser contact explodes, flashes player damage and never scores', async ({ page }) => {
      await start(page);
      await page.evaluate(async () => {
        const game = Reflect.get(window, 'feedbackGame'); const state = game.getState();
        const player = state.players.values().next().value;
        const path = '/src/game/entities/Chaser.ts'; const { createChaser } = await import(path);
        state.enemies.set('contact', createChaser('contact', player.x + 60, player.y,
          Reflect.get(game, 'configSnapshot').chaser));
      });
      await advance(page, 1);
      const contact = await inspect(page);
      expect(contact.health).toBe(80);
      expect(contact.playerTint).toBe(0xff9878);
      expect(contact.enemies).toHaveLength(0);
      expect(contact.effects.map((effect: { type: string }) => effect.type).sort()).toEqual(['destroy', 'impact']);
      expect(contact.score).toBe(0);
      await advance(page, 40);
      expect((await inspect(page)).effects).toHaveLength(0);
      expect((await inspect(page)).score).toBe(0);
    });

    test('Shooter fires visibly and damages player; deterioration preserves ship identity and geometry', async ({ page }) => {
      await start(page);
      await page.evaluate(async () => {
        const game = Reflect.get(window, 'feedbackGame'); const state = game.getState();
        const player = state.players.values().next().value; player.x = 300; player.y = 450;
        const path = '/src/game/entities/Shooter.ts'; const { createShooter } = await import(path);
        state.enemies.set('shooter', createShooter('shooter', 300, 200, Reflect.get(game, 'configSnapshot').shooter));
      });
      await advance(page, 1);
      const shot = await inspect(page);
      expect(shot.effects[0]).toMatchObject({ type: 'fire', x: 300, y: 262 });
      expect(Math.abs(shot.effects[0].rotation)).toBeCloseTo(Math.PI);
      await advance(page, 36);
      expect((await inspect(page)).health).toBe(90);
      expect((await inspect(page)).playerTint).toBe(0xff9878);
      await page.evaluate(async () => {
        const game = Reflect.get(window, 'feedbackGame'); game.getState().enemies.clear();
        const renderer = Reflect.get(game, 'renderer');
        Object.assign(window, { originalPlayerView: Reflect.get(renderer, 'playerSprite') });
        const path = '/src/game/entities/Projectile.ts';
        const { createProjectile } = await import(path);
        Object.assign(window, { hitPlayer: () => {
          const state = game.getState(); const player = state.players.values().next().value;
          const projectile = createProjectile({ id: `projectile-${state.nextProjectileId++}`,
            x: player.x, y: player.y, rotation: 0, ownerId: 'fixture-shooter', isPlayerOwned: false },
          Reflect.get(game, 'configSnapshot').shooter);
          state.projectiles.set(projectile.id, projectile);
          Reflect.get(game, 'update').call(game, 1 / 60); Reflect.get(game, 'render').call(game, 0);
        } });
      });
      await page.evaluate(() => { for (let i = 0; i < 3; i++) Reflect.get(window, 'hitPlayer')(); });
      expect((await inspect(page)).playerTexture).toBe('playerShipDamaged');
      await page.evaluate(() => { for (let i = 0; i < 3; i++) Reflect.get(window, 'hitPlayer')(); });
      expect((await inspect(page)).playerTexture).toBe('playerShipCritical');
      expect(await page.evaluate(() => {
        const sprite = Reflect.get(Reflect.get(Reflect.get(window, 'feedbackGame'), 'renderer'), 'playerSprite');
        return sprite === Reflect.get(window, 'originalPlayerView') && sprite.width === 66 && sprite.height === 113
          && sprite.anchor.x === 0.5 && sprite.anchor.y === 0.5;
      })).toBe(true);
      await advance(page, 15);
      expect((await inspect(page)).playerTint).toBe(0xffffff);
      expect((await inspect(page)).playerTexture).toBe('playerShipCritical');
    });

    test('island impact is placed at first contact and consumes the shot without damage or score', async ({ page }) => {
      await start(page);
      await page.evaluate(() => {
        const state = Reflect.get(window, 'feedbackGame').getState();
        const player = state.players.values().next().value;
        player.x = state.islands[0].x; player.y = 450;
      });
      await page.keyboard.down('Space'); await advance(page, 1); await page.keyboard.up('Space');
      await advance(page, 7);
      const hit = await inspect(page);
      expect(hit.projectiles).toBe(0);
      expect(hit.health).toBe(100);
      expect(hit.score).toBe(0);
      const impact = hit.effects.find((effect: { type: string }) => effect.type === 'impact');
      expect(impact).toBeDefined();
      expect(impact.x).toBeCloseTo(672);
      expect(impact.y).toBeCloseTo(349); // island radius 104 + projectile radius 5.
      await advance(page, 15);
      expect((await inspect(page)).effects).toHaveLength(0);
    });
  });
}

test('effects freeze with pause, expire after resume and release all views on navigation and restart', async ({ page }) => {
  await start(page);
  await page.keyboard.down('Space'); await advance(page, 1); await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await inspect(page);
  await advance(page, 120);
  expect(await inspect(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.evaluate(() => Reflect.get(window, 'feedbackGame').stop());
  await advance(page, 15);
  expect((await inspect(page)).effects).toHaveLength(0);
  await page.keyboard.down('q'); await advance(page, 1); await page.keyboard.up('q');
  await page.evaluate(() => {
    const renderer = Reflect.get(Reflect.get(window, 'feedbackGame'), 'renderer');
    const effects = Reflect.get(renderer, 'combatEffects');
    Object.assign(window, { oldEffects: effects, oldViews: [...effects.container.children], oldAssets: Reflect.get(renderer, 'assets') });
  });
  await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(window, 'oldEffects').container.destroyed
    && Reflect.get(window, 'oldViews').every((sprite: { destroyed: boolean }) => sprite.destroyed)
    && Object.values(Reflect.get(window, 'oldAssets')).every(texture => Reflect.get(texture as object, 'destroyed')))).toBe(true);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  expect((await inspect(page)).effects).toHaveLength(0);
  expect((await inspect(page)).playerTexture).toBe('playerShip');
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('missing combat texture prevents combat safely and a new attempt can load successfully', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
  // Route through the actual MSW transport: Service Worker requests bypass page.route.
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const workerPath = resources.find(entry => entry.name.includes('/src/mocks/browser.ts'))!.name;
    const mswPath = resources.find(entry => entry.name.includes('/deps/msw.js'))!.name;
    const { worker } = await import(workerPath);
    const { http, HttpResponse } = await import(mswPath);
    worker.use(http.get('/assets/png/default/effects/fire_1.png', () => HttpResponse.error()));
    Object.assign(window, { restoreAssetHandler: () => worker.resetHandlers() });
  });
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to load game assets');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
  await page.evaluate(() => Reflect.get(window, 'restoreAssetHandler')());
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('all three ship families reuse equal-size official textures at damage thresholds', async ({ page }) => {
  await start(page);
  const stages = await page.evaluate(async () => {
    const game = Reflect.get(window, 'feedbackGame'); const renderer = Reflect.get(game, 'renderer');
    const state = game.getState(); const config = Reflect.get(game, 'configSnapshot');
    const chaserPath = '/src/game/entities/Chaser.ts'; const shooterPath = '/src/game/entities/Shooter.ts';
    const { createChaser } = await import(chaserPath); const { createShooter } = await import(shooterPath);
    state.enemies.set('chaser', createChaser('chaser', 200, 200, config.chaser));
    state.enemies.set('shooter', createShooter('shooter', 800, 400, config.shooter));
    const assets = Reflect.get(renderer, 'assets');
    const textureName = (texture: unknown) => Object.entries(assets).find(([, value]) => value === texture)?.[0];
    const results = [];
    // This checks rendering thresholds, not combat: damage itself is exercised by other tests.
    for (const ratio of [1, 2 / 3, 1 / 3]) {
      for (const ship of [...state.players.values(), ...state.enemies.values()]) ship.health = ship.maxHealth * ratio;
      Reflect.get(game, 'render').call(game, 0);
      const sprites = [Reflect.get(renderer, 'playerSprite'), ...Reflect.get(renderer, 'enemyViews').values()];
      results.push(sprites.map(sprite => ({ texture: textureName(sprite.texture), width: sprite.width,
        height: sprite.height, anchorX: sprite.anchor.x, anchorY: sprite.anchor.y })));
    }
    return results;
  });
  expect(stages.map(stage => stage.map(ship => ship.texture))).toEqual([
    ['playerShip', 'chaserShip', 'shooterShip'],
    ['playerShipDamaged', 'chaserShipDamaged', 'shooterShipDamaged'],
    ['playerShipCritical', 'chaserShipCritical', 'shooterShipCritical'],
  ]);
  for (const stage of stages) for (const ship of stage) expect(ship).toMatchObject({ width: 66, height: 113, anchorX: 0.5, anchorY: 0.5 });
});

test('completion unmounts active effects and Play Again starts without residual feedback', async ({ page }) => {
  await start(page);
  await page.keyboard.down('Space'); await advance(page, 1); await page.keyboard.up('Space');
  await page.evaluate(() => {
    const game = Reflect.get(window, 'feedbackGame');
    const effects = Reflect.get(Reflect.get(game, 'renderer'), 'combatEffects');
    Object.assign(window, { finalEffects: effects, finalViews: [...effects.container.children] });
    game.getState().remainingSeconds = 1 / 60;
    Reflect.get(game, 'update').call(game, 1 / 60);
  });
  await expect(page.getByRole('heading', { name: 'Match Results', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'finalEffects').container.destroyed
    && Reflect.get(window, 'finalViews').every((sprite: { destroyed: boolean }) => sprite.destroyed))).toBe(true);
  await page.getByRole('button', { name: 'Play Again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  const fresh = await inspect(page);
  expect(fresh.effects).toHaveLength(0);
  expect(fresh.score).toBe(0);
  expect(fresh.health).toBe(100);
  expect(fresh.playerTint).toBe(0xffffff);
});
