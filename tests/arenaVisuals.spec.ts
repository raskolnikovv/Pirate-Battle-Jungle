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
      Reflect.set(this, 'spawnSystem', null);
      Object.assign(window, { arenaGame: this });
    };
  });
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  // Asset decode/WebGL setup precedes the gameplay-ready assertions.
  await page.locator('canvas').waitFor({ state: 'visible' });
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const game = Reflect.get(window, 'arenaGame');
    Reflect.get(game, 'render').call(game, 0);
  });
}

for (const [name, width, height] of [['desktop', 1280, 900], ['portrait', 390, 844], ['landscape', 844, 390]] as const) {
  test.describe(name, () => {
    test.use({ viewport: { width, height }, isMobile: name !== 'desktop', hasTouch: name !== 'desktop' });
    test(`official arena preserves geometry, responsive layout and resource cleanup: ${name}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await start(page);
      const canvas = page.locator('canvas');
      await expect(canvas).toHaveCount(1); // Strict Mode must leave only one live canvas.
      const bounds = (await canvas.boundingBox())!;
      expect(bounds.width / bounds.height).toBeCloseTo(1.6, 1); // Existing canvas border and CSS rounding.
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const geometry = await page.evaluate(() => {
        const game = Reflect.get(window, 'arenaGame');
        const state = game.getState();
        const renderer = Reflect.get(game, 'renderer');
        const view = Reflect.get(renderer, 'islandViews').get('island-1');
        const assets = Reflect.get(renderer, 'assets');
        Object.assign(window, { islandView: view, islandSprites: [...view.children], arenaAssets: assets });
        for (let frame = 0; frame < 5; frame++) Reflect.get(game, 'render').call(game, 0);
        return { islands: state.islands.length, x: state.islands[0].x, y: state.islands[0].y,
          colliders: state.islands[0].colliders, tiles: view.children.length,
          reused: view === Reflect.get(renderer, 'islandViews').get('island-1')
            && view.children.every((sprite: unknown, i: number) => sprite === Reflect.get(window, 'islandSprites')[i]),
          shared: view.children.filter((sprite: object) => 'anchor' in sprite)
            .every((sprite: { texture: unknown }) => Object.values(assets).includes(sprite.texture)),
          fortInside: state.islands[0].tiles.filter((tile: { asset: string }) => tile.asset.startsWith('fort'))
            .every((tile: { x: number; y: number; scale: number }) => [[tile.x, tile.y], [tile.x + 64 * tile.scale, tile.y],
              [tile.x, tile.y + 64 * tile.scale], [tile.x + 64 * tile.scale, tile.y + 64 * tile.scale]]
              .every(([x, y]) => Math.hypot(x, y) <= 234)),
        };
      });
      expect(geometry).toMatchObject({ islands: 3, x: 60, y: 60,
        colliders: [{ x: 0, y: 0, radius: 234 }], tiles: 17, reused: true, shared: true, fortInside: true });
      await expect(canvas).toHaveScreenshot(`official-arena-${name}.png`);
      await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
      expect(await page.evaluate(() => Reflect.get(window, 'islandView').destroyed
        && Reflect.get(window, 'islandSprites').every((sprite: { destroyed: boolean }) => sprite.destroyed)
        && Object.values(Reflect.get(window, 'arenaAssets')).every(asset => Reflect.get(asset as object, 'destroyed')))).toBe(true);
      await page.getByRole('button', { name: 'Start Game', exact: true }).click();
      // Asset decode/WebGL setup precedes the gameplay-ready assertions.
      await page.locator('canvas').waitFor({ state: 'visible' });
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
      await expect(canvas).toHaveCount(1);
      expect(errors).toEqual([]);
    });
  });
}

test('player movement stays outside both coastal arcs and inside arena boundaries', async ({ page }) => {
  await start(page);
  for (let coast = 0; coast < 2; coast++) for (let direction = 0; direction < 5; direction++) {
    await page.evaluate(({ angle, coast }) => {
      const game = Reflect.get(window, 'arenaGame');
      const state = game.getState(); const player = state.players.values().next().value;
      const island = state.islands[coast];
      const distance = island.colliders[0].radius + player.collisionRadius + 4;
      player.x = island.x + Math.cos(angle) * distance;
      player.y = island.y + Math.sin(angle) * distance;
      player.rotation = Math.atan2(island.x - player.x, -(island.y - player.y));
    }, { coast, angle: coast === 0 ? 0.1 + direction * 0.3 : Math.PI + 0.5 + direction * 0.23 });
    await page.keyboard.down('w');
    const distances = await page.evaluate(coast => {
      const game = Reflect.get(window, 'arenaGame');
      const results: number[] = [];
      for (let step = 0; step < 30; step++) {
        Reflect.get(game, 'update').call(game, 1 / 60);
        const player = game.getState().players.values().next().value;
        const island = game.getState().islands[coast];
        if (player.x < 66 || player.x > 894 || player.y < 66 || player.y > 534) throw new Error('Ship escaped arena');
        results.push(Math.hypot(player.x - island.x, player.y - island.y));
      }
      return results;
    }, coast);
    await page.keyboard.up('w');
    const minimum = coast === 0 ? 266 : 292;
    for (const distance of distances) expect(distance).toBeGreaterThanOrEqual(minimum - 1e-6);
    expect(distances.at(-1)).toBeCloseTo(minimum, 2);
  }
});

test('arena leaves safe spawn space and enemy routes around cover', async ({ page }) => {
  await start(page);
  const results = await page.evaluate(async () => {
    const game = Reflect.get(window, 'arenaGame'); const state = game.getState();
    const config = Reflect.get(game, 'configSnapshot');
    const { SpawnSystem } = await import('/src/game/systems/SpawnSystem.ts');
    const { MovementSystem } = await import('/src/game/systems/MovementSystem.ts');
    const { CollisionSystem } = await import('/src/game/systems/CollisionSystem.ts');
    const { createChaser } = await import('/src/game/entities/Chaser.ts');
    const { createShooter } = await import('/src/game/entities/Shooter.ts');
    const spawn = new SpawnSystem(config); const movement = new MovementSystem(); const collision = new CollisionSystem();
    const player = state.players.values().next().value;
    const original = { x: player.x, y: player.y };
    let attempts = 0; let valid = 0; let baselineValid = 0; let unsafe = 0;
    for (let x = 66; x <= 894; x += 24) for (let y = 66; y <= 534; y += 24) {
      attempts++;
      if (Math.hypot(x - player.x, y - player.y) > 320) baselineValid++;
      if (!spawn.isValidPosition(state, x, y, 32)) continue;
      valid++;
      if (Math.hypot(x - player.x, y - player.y) <= 320
        || state.islands.some((island: { x: number; y: number; colliders: { radius: number }[] }) =>
          Math.hypot(x - island.x, y - island.y) <= island.colliders[0].radius + 32)) unsafe++;
    }
    for (let interval = 0; interval < 40; interval++) spawn.update(state, config.enemySpawnInterval);
    const types = [...new Set(Array.from(state.enemies.values(), (enemy: { type: string }) => enemy.type))];
    const spawnedSafe = [...state.enemies.values()].every((enemy: { x: number; y: number }) =>
      Math.hypot(enemy.x - player.x, enemy.y - player.y) > 320
      && state.islands.every((island: { x: number; y: number; colliders: { radius: number }[] }) =>
        Math.hypot(enemy.x - island.x, enemy.y - island.y) > island.colliders[0].radius + 32));
    state.enemies.clear();
    let routes = 0; let blocked = 0;
    // Test both directions along each coastal arc plus routes through open water.
    const points = [[480, 300], [66, 350], [360, 100], [360, 350], [894, 350], [600, 534], [600, 380], [800, 300], [350, 534]];
    for (const target of points) for (const origin of points) for (const type of ['chaser', 'shooter']) {
      if (origin === target) continue;
      player.x = target[0]; player.y = target[1];
      const enemy = type === 'chaser' ? createChaser('route', origin[0], origin[1], config.chaser)
        : createShooter('route', origin[0], origin[1], config.shooter);
      state.enemies.set(enemy.id, enemy);
      for (let step = 0; step < 720; step++) {
        movement.updateEnemies(state, 1 / 60, config);
        collision.resolveShipsIslands(state);
      }
      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      routes++;
      if (distance > (type === 'chaser' ? 65 : config.shooter.attackRange + 1)
        || enemy.x < 66 || enemy.x > 894 || enemy.y < 66 || enemy.y > 534) blocked++;
      state.enemies.clear();
    }
    player.x = original.x; player.y = original.y;
    return { attempts, valid, baselineValid, unsafe, types, spawnedSafe, routes, blocked };
  });
  expect(results.unsafe).toBe(0);
  expect(results.valid / results.attempts, JSON.stringify(results)).toBeGreaterThan(0.12);
  expect(results.valid / results.baselineValid, JSON.stringify(results)).toBeGreaterThan(0.4);
  expect(results.types.sort()).toEqual(['chaser', 'shooter']);
  expect(results.spawnedSafe).toBe(true);
  expect(results.routes).toBe(144);
  expect(results.blocked, JSON.stringify(results)).toBe(0);
});

test('isolated island allows full circumnavigation and enemy detours from every heading', async ({ page }) => {
  await start(page);
  const results = await page.evaluate(async () => {
    const game = Reflect.get(window, 'arenaGame'); const state = game.getState();
    const config = Reflect.get(game, 'configSnapshot');
    const { MovementSystem } = await import('/src/game/systems/MovementSystem.ts');
    const { CollisionSystem } = await import('/src/game/systems/CollisionSystem.ts');
    const { createChaser } = await import('/src/game/entities/Chaser.ts');
    const { createShooter } = await import('/src/game/entities/Shooter.ts');
    const movement = new MovementSystem(); const collision = new CollisionSystem();
    const island = state.islands[2]; const player = state.players.values().next().value;
    let blocked = 0; let penetrations = 0; let speedErrors = 0;
    for (let direction = 0; direction < 8; direction++) {
      const angle = direction * Math.PI / 4;
      // Both centers are navigable, including the narrow northern passage.
      player.x = island.x - Math.cos(angle) * 110;
      player.y = island.y - Math.sin(angle) * 110;
      for (const type of ['chaser', 'shooter']) {
        const enemy = type === 'chaser'
          ? createChaser('detour', island.x + Math.cos(angle) * 110, island.y + Math.sin(angle) * 110, config.chaser)
          : createShooter('detour', island.x + Math.cos(angle) * 110, island.y + Math.sin(angle) * 110, config.shooter);
        // Shooter must approach before it can fire; keep its configured range.
        if (type === 'shooter') {
          player.x = island.x - Math.cos(angle) * 330;
          player.y = island.y - Math.sin(angle) * 330;
          if (player.x < 66 || player.x > 894 || player.y < 66 || player.y > 534) continue;
          if (state.islands.some((land: { x: number; y: number; colliders: { radius: number }[] }) =>
            Math.hypot(player.x - land.x, player.y - land.y) < land.colliders[0].radius + player.collisionRadius)) continue;
        }
        state.enemies.set(enemy.id, enemy);
        for (let step = 0; step < 600; step++) {
          const x = enemy.x; const y = enemy.y;
          movement.updateEnemies(state, 1 / 60, config);
          if (Math.hypot(enemy.x - x, enemy.y - y) > enemy.speed / 60 + 0.0001) speedErrors++;
          collision.resolveShipsIslands(state);
          if (Math.hypot(enemy.x - island.x, enemy.y - island.y) < 84 - 0.001) penetrations++;
        }
        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) > (type === 'chaser' ? 1 : config.shooter.attackRange + 1)) blocked++;
        state.enemies.clear();
        player.x = island.x - Math.cos(angle) * 110;
        player.y = island.y - Math.sin(angle) * 110;
      }
    }
    return { blocked, penetrations, speedErrors, island: { x: island.x, y: island.y, radius: island.colliders[0].radius } };
  });
  expect(results).toEqual({ blocked: 0, penetrations: 0, speedErrors: 0, island: { x: 740, y: 190, radius: 52 } });
});

test('player sails around the island and cannot cross its coastline', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const game = Reflect.get(window, 'arenaGame'); const state = game.getState();
    const config = Reflect.get(game, 'configSnapshot');
    const { MovementSystem } = await import('/src/game/systems/MovementSystem.ts');
    const { CollisionSystem } = await import('/src/game/systems/CollisionSystem.ts');
    const movement = new MovementSystem(); const collision = new CollisionSystem();
    const player = state.players.values().next().value; const island = state.islands[2];
    const input = { forward: true, turnLeft: false, turnRight: false };
    player.x = island.x + 100; player.y = island.y;
    let angleTravelled = 0; let invalid = 0;
    for (let step = 0; angleTravelled < Math.PI * 2 && step < 500; step++) {
      const angle = Math.atan2(player.y - island.y, player.x - island.x);
      player.rotation = Math.atan2(-Math.sin(angle), -Math.cos(angle));
      movement.update(state, input, 1 / 60, config);
      collision.resolveShipsIslands(state);
      const nextAngle = Math.atan2(player.y - island.y, player.x - island.x);
      angleTravelled += Math.atan2(Math.sin(nextAngle - angle), Math.cos(nextAngle - angle));
      if (player.x < 66 || player.x > 894 || player.y < 66 || player.y > 534
        || Math.hypot(player.x - island.x, player.y - island.y) < 84) invalid++;
    }
    for (let direction = 0; direction < 8; direction++) {
      const angle = direction * Math.PI / 4;
      player.x = island.x + Math.cos(angle) * 88;
      player.y = island.y + Math.sin(angle) * 88;
      player.rotation = Math.atan2(island.x - player.x, -(island.y - player.y));
      for (let step = 0; step < 10; step++) {
        movement.update(state, input, 1 / 60, config);
        collision.resolveShipsIslands(state);
        if (Math.hypot(player.x - island.x, player.y - island.y) < 84 - 0.001) invalid++;
      }
    }
    return { completedLap: angleTravelled >= Math.PI * 2, invalid };
  });
  expect(result).toEqual({ completedLap: true, invalid: 0 });
});

for (const coast of [0, 1, 2]) test(`landmass ${coast} provides usable cover against real Shooter fire`, async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async coast => {
    const game = Reflect.get(window, 'arenaGame'); const state = game.getState();
    const config = Reflect.get(game, 'configSnapshot'); const renderer = Reflect.get(game, 'renderer');
    const { createShooter } = await import('/src/game/entities/Shooter.ts');
    const player = state.players.values().next().value;
    player.x = coast === 2 ? 885 : coast === 0 ? 66 : 600;
    player.y = coast === 2 ? 190 : coast === 0 ? 350 : 534;
    const shooter = createShooter('cover-shooter', coast === 2 ? 595 : coast === 0 ? 360 : 894,
      coast === 2 ? 190 : coast === 0 ? 100 : 350, config.shooter);
    state.enemies.set(shooter.id, shooter);
    let landImpacts = 0;
    const original = renderer.emitCombatEffect;
    renderer.emitCombatEffect = function(event: { type: string; x: number; y: number }) {
      if (event.type === 'impact') {
        const island = state.islands[coast];
        if (Math.abs(Math.hypot(event.x - island.x, event.y - island.y)
          - island.colliders[0].radius - config.shooter.projectileCollisionRadius) < 1e-5) landImpacts++;
      }
      original.call(this, event);
    };
    const radius = state.islands[coast].colliders[0].radius;
    const safeBefore = Math.hypot(player.x - state.islands[coast].x, player.y - state.islands[coast].y) > radius + player.collisionRadius;
    for (let step = 0; step < 300; step++) Reflect.get(game, 'update').call(game, 1 / 60);
    Reflect.get(game, 'render').call(game, 0);
    return { health: player.health, score: state.score, fired: state.nextProjectileId - 1, landImpacts, safeBefore };
  }, coast);
  expect(result.safeBefore).toBe(true);
  expect(result.fired, JSON.stringify(result)).toBeGreaterThan(0);
  expect(result.landImpacts, JSON.stringify(result)).toBeGreaterThan(0);
  expect(result.health).toBe(100);
  expect(result.score).toBe(0);
});
