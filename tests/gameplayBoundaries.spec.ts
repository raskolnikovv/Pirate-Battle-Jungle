import { expect, test, type Page } from '@playwright/test';

// Stop RAF only: each controlled step still runs Game.update and its real systems.
async function start(page: Page, options: { spawn?: number; slowProjectile?: boolean; toughShooter?: boolean } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
  await page.evaluate(async options => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/Game.ts'))!.name;
    const { Game } = await import(path);
    const original = Game.prototype.start;
    Game.prototype.start = function(config: object) {
      const snapshot = { ...config };
      if (options.spawn) Object.assign(snapshot, { enemySpawnInterval: options.spawn });
      if (options.slowProjectile) Object.assign(snapshot, { projectileSpeed: 1, projectileLifetime: 0.1 });
      if (options.toughShooter) Object.assign(snapshot, { shooter: { ...Reflect.get(config, 'shooter'), health: 100 } });
      original.call(this, snapshot); this.stop();
      if (!options.spawn) Reflect.set(this, 'spawnSystem', null);
      Object.assign(window, { boundaryGame: this, boundaryState: this.getState() });
    };
  }, options);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  // Clicked Start no longer exists, so gameplay has neutral focus.
}
async function advance(page: Page, steps: number) {
  await page.evaluate(steps => {
    const game = Reflect.get(window, 'boundaryGame');
    for (let i = 0; i < steps && game.getState()?.status === 'running'; i++) {
      Reflect.get(game, 'update').call(game, 1 / 60);
      Reflect.get(game, 'publishHud').call(game);
    }
    if (game.getState()) Reflect.get(game, 'render').call(game, 0);
  }, steps);
}
async function inspect(page: Page) {
  return page.evaluate(() => {
    const state = Reflect.get(window, 'boundaryState');
    const player = state.players.values().next().value;
    return { health: player.health, x: player.x, y: player.y, rotation: player.rotation, status: state.status,
      elapsed: state.elapsedSeconds, score: state.score, next: state.nextProjectileId,
      nextSpawn: Reflect.get(Reflect.get(window, 'boundaryGame'), 'spawnSystem')?.nextEnemyId,
      projectiles: Array.from(state.projectiles.values(), (p: { id: string; lifetime: number; isPlayerOwned: boolean }) => ({ id: p.id, lifetime: p.lifetime, isPlayerOwned: p.isPlayerOwned })),
      enemies: Array.from(state.enemies.values(), (e: { id: string; health: number }) => ({ id: e.id, health: e.health })) };
  });
}

test('Space activates Pause/Quit and Enter activates Resume without gameplay shots', async ({ page }) => {
  await start(page);
  const before = await inspect(page);
  await page.getByRole('button', { name: 'Pause', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await inspect(page)).next).toBe(before.next);
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  // Resume starts RAF; stop it for deterministic assertions again.
  await page.evaluate(() => Reflect.get(window, 'boundaryGame').stop());
  await page.getByRole('button', { name: 'Quit Match', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'Pirate Battle', exact: true })).toBeVisible();
});

test('editable controls keep keys, focus clears held input, and neutral gameplay retains W/A/D/Space', async ({ page }) => {
  await start(page);
  await page.keyboard.down('w'); await advance(page, 1);
  await page.evaluate(() => {
    const input = document.createElement('input'); input.setAttribute('aria-label', 'Keyboard regression field');
    document.body.append(input); input.focus();
  });
  const stopped = await inspect(page);
  await advance(page, 2);
  expect((await inspect(page)).elapsed).toBeGreaterThan(stopped.elapsed);
  const snapshot = await page.evaluate(() => Reflect.get(Reflect.get(window, 'boundaryGame'), 'input').snapshot());
  expect(snapshot.forward).toBe(false);
  await page.keyboard.up('w');
  await page.getByLabel('Keyboard regression field').pressSequentially('wasd qe ');
  await expect(page.getByLabel('Keyboard regression field')).toHaveValue('wasd qe ');
  await advance(page, 1); expect((await inspect(page)).next).toBe(stopped.next);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.down('w'); await page.keyboard.down('d'); await page.keyboard.down('Space');
  await advance(page, 1);
  const moved = await inspect(page);
  expect(moved.x).toBeGreaterThan(stopped.x); expect(moved.rotation).toBeGreaterThan(stopped.rotation);
  expect(moved.next).toBe(stopped.next + 1);
  await page.keyboard.up('w'); await page.keyboard.up('d'); await page.keyboard.up('Space');
  await page.keyboard.down('a'); await advance(page, 1); await page.keyboard.up('a');
  expect((await inspect(page)).rotation).toBeCloseTo(stopped.rotation);
});

test('native and ARIA controls keep initial and repeated gameplay keys uncanceled', async ({ page }) => {
  await start(page);
  const results = await page.evaluate(() => {
    const controls = ['<button><span>Action</span></button>', '<a href="#">Link</a>',
      '<textarea></textarea>', '<select><option>Option</option></select>', '<input type="range">',
      '<input type="number">', '<div contenteditable="true"></div>', '<div role="checkbox" tabindex="0"></div>'];
    return controls.map(html => {
      const wrapper = document.createElement('div'); wrapper.innerHTML = html; document.body.append(wrapper);
      const control = wrapper.firstElementChild as HTMLElement; control.focus();
      const target = control.firstElementChild ?? control;
      const prevented = [];
      for (const repeat of [false, true]) for (const key of [' ', 'Enter', 'w', 'ArrowUp', 'q']) {
        const event = new KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true });
        target.dispatchEvent(event); prevented.push(event.defaultPrevented);
        target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
      }
      wrapper.remove(); return prevented;
    });
  });
  expect(results).toHaveLength(8);
  for (const prevented of results) expect(prevented).toEqual(Array(10).fill(false));
  await advance(page, 1); expect((await inspect(page)).next).toBe(1);
});

for (const interval of [1, 4]) {
  test(`seeded spawns occur at configured ${interval}s boundary, not one step early`, async ({ page }) => {
    await start(page, { spawn: interval });
    await advance(page, interval * 60 - 1); expect((await inspect(page)).enemies).toHaveLength(0);
    await advance(page, 1); expect((await inspect(page)).enemies).toHaveLength(1);
    // The first Chaser can self-destruct before the second spawn. Count creations, not surviving enemies.
    await advance(page, interval * 60 - 1); expect((await inspect(page)).nextSpawn).toBe(2);
    await advance(page, 1); expect((await inspect(page)).nextSpawn).toBe(3);
    expect((await inspect(page)).enemies.some(enemy => enemy.id === 'enemy-2')).toBe(true);
  });
}
for (const [key, count, steps] of [['Space', 1, 18], ['q', 3, 60], ['e', 3, 60]] as const) {
  test(`${key} held input fires exactly at cooldown boundary`, async ({ page }) => {
    await start(page); await page.keyboard.down(key); await advance(page, 1);
    const first = await inspect(page);
    await advance(page, steps - 1); expect((await inspect(page)).next).toBe(first.next);
    await advance(page, 1); expect((await inspect(page)).next).toBe(first.next + count);
    await page.keyboard.up(key);
  });
}

test('a real shot expires at its configured lifetime without hitting anything', async ({ page }) => {
  await start(page, { slowProjectile: true });
  await page.keyboard.down('Space'); await advance(page, 1); await page.keyboard.up('Space');
  await advance(page, 4); expect((await inspect(page)).projectiles).toHaveLength(1);
  await advance(page, 2); expect((await inspect(page)).projectiles).toHaveLength(0);
  expect((await inspect(page)).score).toBe(0);
});

test('a real shot is removed at the arena edge while lifetime remains', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const player = Reflect.get(window, 'boundaryState').players.values().next().value;
    Object.assign(player, { x: 894, y: 300, rotation: Math.PI / 2 });
  });
  await page.keyboard.down('Space'); await advance(page, 1); await page.keyboard.up('Space');
  expect((await inspect(page)).projectiles).toHaveLength(0);
  expect((await inspect(page)).score).toBe(0);
  expect((await inspect(page)).next).toBe(2);
});

for (const [key, side] of [['q', -1], ['e', 1]] as const) {
  test(`${key} broadside applies three real projectile hits once`, async ({ page }) => {
    await start(page, { toughShooter: true });
    await page.evaluate(async side => {
      const game = Reflect.get(window, 'boundaryGame'); const state = game.getState();
      const player = state.players.values().next().value;
      Object.assign(player, { x: 480, y: 300 });
      const { createShooter } = await import('/src/game/entities/Shooter.ts');
      state.enemies.set('target', createShooter('target', 480 + side * 130, 300, Reflect.get(game, 'configSnapshot').shooter));
    }, side);
    await page.keyboard.down(key); await advance(page, 1); await page.keyboard.up(key);
    const shots = await inspect(page); expect(shots.projectiles.filter(p => p.isPlayerOwned)).toHaveLength(3);
    await advance(page, 20);
    expect((await inspect(page)).enemies).toEqual([{ id: 'target', health: 25 }]);
    await advance(page, 15);
    expect((await inspect(page)).enemies).toEqual([{ id: 'target', health: 25 }]);
    expect((await inspect(page)).score).toBe(0);
  });
}

test('real Shooter attacks kill a full-health player, freeze completed state and restart cleanly', async ({ page }) => {
  await start(page);
  await page.evaluate(async () => {
    const game = Reflect.get(window, 'boundaryGame'); const state = game.getState();
    Object.assign(state.players.values().next().value, { x: 480, y: 400 });
    const { createShooter } = await import('/src/game/entities/Shooter.ts');
    state.enemies.set('shooter', createShooter('shooter', 480, 150, Reflect.get(game, 'configSnapshot').shooter));
  });
  expect((await inspect(page)).health).toBe(100);
  await advance(page, 60); expect((await inspect(page)).health).toBe(90);
  await advance(page, 15 * 60);
  await expect(page.getByRole('heading', { name: 'Match Results', exact: true })).toBeVisible();
  await expect(page.getByText('Ship Destroyed', { exact: true })).toBeVisible();
  const finished = await inspect(page);
  expect(finished.health).toBe(0); expect(finished.status).toBe('finished');
  expect(finished.elapsed).toBeGreaterThan(10); expect(finished.elapsed).toBeLessThan(16);
  await advance(page, 120); expect(await inspect(page)).toEqual(finished);
  await page.getByRole('button', { name: 'Play Again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  expect(await inspect(page)).toMatchObject({ health: 100, score: 0, elapsed: 0, enemies: [], projectiles: [] });
});



for (const activation of ['click', 'Enter', 'Space'] as const) {
  test(`Resume via ${activation} restores arena focus and accepts immediate movement/fire`, async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const resume = page.getByRole('button', { name: 'Resume', exact: true });
    await expect(resume).toBeFocused();
    if (activation === 'click') await resume.click(); else await page.keyboard.press(activation);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('canvas')).toBeFocused();
    await page.evaluate(() => Reflect.get(window, 'boundaryGame').stop());
    const before = await inspect(page);
    await page.keyboard.down('w'); await page.keyboard.down('d'); await page.keyboard.down('Space');
    await advance(page, 1);
    const after = await inspect(page);
    expect(after.status).toBe('running');
    expect(after.y).toBeLessThan(before.y);
    expect(after.rotation).toBeGreaterThan(before.rotation);
    expect(after.next).toBe(before.next + 1);
    await page.keyboard.up('w'); await page.keyboard.up('d'); await page.keyboard.up('Space');
    // HUD buttons remain keyboard accessible when explicitly focused.
    await page.getByRole('button', { name: 'Pause', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}
