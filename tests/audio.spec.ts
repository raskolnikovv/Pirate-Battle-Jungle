import { expect, test, type Page } from '@playwright/test';

async function fakeAudio(page: Page) {
  await page.addInitScript(() => {
    const state = { contexts: 0, closed: 0, denied: false, sources: [] as object[] };
    Object.assign(window, { audioTest: state });
    class Context {
      state = 'suspended';
      destination = {};
      constructor() { state.contexts++; }
      resume() {
        if (state.denied) return Promise.reject(new Error('Gesture required'));
        this.state = 'running'; return Promise.resolve();
      }
      close() { this.state = 'closed'; state.closed++; return Promise.resolve(); }
      createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
      decodeAudioData(data: ArrayBuffer) { return Promise.resolve({ bytes: data.byteLength }); }
      createBufferSource() {
        const source = { buffer: null, loop: false, onended: null, started: false, stopped: false, disconnected: false,
          connect() {}, start() { this.started = true; }, stop() { this.stopped = true; },
          disconnect() { this.disconnected = true; } };
        state.sources.push(source); return source;
      }
    }
    Object.assign(window, { AudioContext: Context });
  });
}

async function expose(page: Page) {
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(entry => entry.name.includes('/src/audio/AudioManager.ts'))!.name;
    const { gameAudio } = await import(path);
    Object.assign(window, { manager: gameAudio });
  });
}

async function loaded(page: Page) {
  await expect.poll(() => page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'buffers').size)).toBe(12);
}

test('accessible audio controls persist mute and independent volumes after refresh', async ({ page }) => {
  await fakeAudio(page); await page.goto('/');
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByRole('button', { name: 'Mute audio', exact: true }).click();
  const effects = page.getByLabel('Sound effects volume', { exact: false });
  await effects.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  const ocean = page.getByLabel('Ocean ambience volume', { exact: false });
  await ocean.focus(); await page.keyboard.press('End');
  await expect(effects).toHaveValue('5'); await expect(ocean).toHaveValue('100');
  await page.reload(); await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute audio' })).toHaveAttribute('aria-pressed', 'true');
  await expect(effects).toHaveValue('5'); await expect(ocean).toHaveValue('100');
  await page.getByRole('button', { name: 'Unmute audio' }).click();
  await expect(page.getByRole('button', { name: 'Mute audio' })).toHaveAttribute('aria-pressed', 'false');
});

test('corrupt audio storage and unavailable localStorage do not block Options', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pirate-battle.audio.v1', '{broken'));
  await page.goto('/'); await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByLabel('Sound effects volume')).toHaveValue('60');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Unavailable'); }; });
  await page.getByRole('button', { name: 'Mute audio' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expect(page.getByRole('button', { name: 'Unmute audio' })).toBeVisible();
});

test('gesture unlock, overlap cap, buffer reuse, explicit resume and resource disposal', async ({ page }) => {
  await fakeAudio(page); await page.goto('/'); await expose(page);
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').contexts)).toBe(0);
  await page.evaluate(() => { Reflect.get(window, 'audioTest').denied = true; });
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await loaded(page);
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').contexts)).toBe(1);
  await page.evaluate(() => {
    const manager = Reflect.get(window, 'manager'); manager.start(); manager.play('front');
  });
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').sources.length)).toBe(0);
  await page.evaluate(() => { Reflect.get(window, 'audioTest').denied = false; });
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'audioTest').sources.length)).toBe(2);
  const overlap = await page.evaluate(() => {
    const manager = Reflect.get(window, 'manager');
    for (let shot = 0; shot < 30; shot++) manager.play('front');
    const voices = [...Reflect.get(manager, 'voices')];
    return { count: voices.length, shared: voices.slice(1).every(voice => Reflect.get(voice as object, 'source').buffer === Reflect.get(manager, 'buffers').get('front')) };
  });
  expect(overlap).toEqual({ count: 12, shared: true });
  await page.evaluate(() => Reflect.get(window, 'manager').pause());
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'ocean'))).toBeNull();
  const paused = await page.evaluate(() => Reflect.get(window, 'audioTest').sources.length);
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); Reflect.get(window, 'manager').play('front'); });
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').sources.length)).toBe(paused);
  await page.evaluate(() => Reflect.get(window, 'manager').resume());
  expect(await page.evaluate(() => Boolean(Reflect.get(Reflect.get(window, 'manager'), 'ocean')))).toBe(true);
  await page.evaluate(() => { const manager = Reflect.get(window, 'manager'); manager.start(); manager.leave(); });
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').sources.every((source: { stopped: boolean; disconnected: boolean }) => source.stopped && source.disconnected))).toBe(true);
  await page.evaluate(() => Reflect.get(window, 'manager').dispose());
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').closed)).toBe(1);
});

test('completion sound survives Result teardown, while restart stops its tail', async ({ page }) => {
  await fakeAudio(page); await page.goto('/'); await expose(page);
  await page.getByRole('button', { name: 'Options', exact: true }).click(); await loaded(page);
  const result = await page.evaluate(() => {
    const manager = Reflect.get(window, 'manager');
    manager.start(); manager.finish(false); manager.leave(true);
    const complete = [...Reflect.get(manager, 'voices')][0];
    const sound = Reflect.get(complete as object, 'source');
    const retained = sound.buffer === Reflect.get(manager, 'buffers').get('complete') && !sound.stopped;
    manager.start();
    const stopped = sound.stopped && sound.disconnected;
    manager.finish(true);
    const correctReason = [...Reflect.get(manager, 'voices')].some(voice =>
      Reflect.get(voice as object, 'source').buffer === Reflect.get(manager, 'buffers').get('over'));
    manager.leave();
    return { retained, stopped, correctReason, remaining: Reflect.get(manager, 'voices').size };
  });
  expect(result).toEqual({ retained: true, stopped: true, correctReason: true, remaining: 0 });
});

test('missing WAV is reported without blocking gameplay or causing unhandled errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  // Intercept at fetch: service-worker bypass requests may not reach page.route.
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = (input, init) => String(input).endsWith('/sounds/cannon_fire_1.wav')
      ? Promise.resolve(new Response('', { status: 503 })) : original(input, init);
  });
  await page.goto('/'); await expose(page);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'manager').getError())).toContain('could not load');
  await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Some sounds could not load');
  expect(errors).toEqual([]);
});

test('real keyboard combat routes one sound per cannon action, impacts and destruction', async ({ page }) => {
  await fakeAudio(page); await page.goto('/'); await expose(page);
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(entry => entry.name.includes('/src/game/core/Game.ts'))!.name;
    const { Game } = await import(path);
    const original = Game.prototype.start;
    Game.prototype.start = function(config: unknown) {
      original.call(this, config); this.stop(); Reflect.set(this, 'spawnSystem', null);
      Object.assign(window, { audioGame: this });
    };
    const manager = Reflect.get(window, 'manager'); const play = manager.play.bind(manager);
    const sounds: string[] = []; Object.assign(window, { sounds });
    manager.play = (name: string, session?: boolean) => { sounds.push(name); play(name, session); };
  });
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled(); await loaded(page);
  await page.evaluate(() => { Reflect.get(window, 'sounds').length = 0; });
  await page.keyboard.down('Space'); await page.keyboard.down('q'); await page.keyboard.down('e');
  await page.evaluate(() => {
    const game = Reflect.get(window, 'audioGame');
    for (let i = 0; i < 4; i++) Reflect.get(game, 'update').call(game, 1 / 60);
  });
  expect(await page.evaluate(() => Reflect.get(window, 'sounds'))).toEqual(['front', 'broadside', 'broadside']);
  await page.keyboard.up('Space'); await page.keyboard.up('q'); await page.keyboard.up('e');
  await page.evaluate(async () => {
    const game = Reflect.get(window, 'audioGame'); const state = game.getState();
    const config = Reflect.get(game, 'configSnapshot'); const combat = Reflect.get(game, 'combatSystem');
    const { createShooter } = await import('/src/game/entities/Shooter.ts');
    const { createChaser } = await import('/src/game/entities/Chaser.ts');
    state.projectiles.clear();
    const player = state.players.values().next().value; player.x = 480; player.y = 300;
    const shooter = createShooter('shooter', 480, 180, config.shooter); shooter.speed = 0;
    state.enemies.set(shooter.id, shooter);
    for (let i = 0; i < 25; i++) Reflect.get(game, 'update').call(game, 1 / 60);
    state.enemies.clear(); state.projectiles.clear();
    const chaser = createChaser('chaser', player.x, player.y, config.chaser);
    state.enemies.set(chaser.id, chaser);
    combat.applyCollision(state, { type: 'projectile-enemy', sourceId: 'test', targetId: chaser.id,
      damage: chaser.health, isPlayerOwned: true }, config);
    combat.applyCollision(state, { type: 'projectile-enemy', sourceId: 'test', targetId: chaser.id,
      damage: 100, isPlayerOwned: true }, config);
    const contact = createChaser('contact', player.x, player.y, config.chaser);
    state.enemies.set(contact.id, contact);
    Reflect.get(game, 'update').call(game, 1 / 60);
  });
  const sounds = await page.evaluate(() => Reflect.get(window, 'sounds'));
  expect(sounds.filter((name: string) => name === 'enemy')).toHaveLength(1);
  expect(sounds).toContain('impact');
  expect(sounds.filter((name: string) => name === 'explosion')).toHaveLength(2);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const before = await page.evaluate(() => Reflect.get(window, 'sounds').length);
  await page.evaluate(() => Reflect.get(Reflect.get(window, 'audioGame'), 'update').call(Reflect.get(window, 'audioGame'), 1));
  expect(await page.evaluate(() => Reflect.get(window, 'sounds').length)).toBe(before);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'voices').size)).toBe(0);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => Reflect.get(window, 'sounds').filter((name: string) => name === 'start').length)).toBe(1);
});

test('native Web Audio decodes official WAVs after gesture without duplicate Strict Mode context', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expose(page);
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'context'))).toBeNull();
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled(); await loaded(page);
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'context').state)).toBe('running');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'ocean'))).toBeNull();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'ocean').loop)).toBe(true);
  await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'voices').size)).toBe(0);
  expect(errors).toEqual([]);
});
