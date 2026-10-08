import { AUDIO_ASSETS } from '../src/audio/audioAssets';
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
          output: null as object | null, connect(output: object) { this.output = output; }, start() { this.started = true; }, stop() { this.stopped = true; },
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
  await expect.poll(() => page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'buffers').size)).toBe(Object.keys(AUDIO_ASSETS).length);
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
  expect(await page.evaluate(() => [...Reflect.get(Reflect.get(window, 'manager'), 'voices')].filter(voice => !voice.name.startsWith('ui')).length)).toBe(0);
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
  expect(await page.evaluate(() => [...Reflect.get(Reflect.get(window, 'manager'), 'voices')].filter(voice => !voice.name.startsWith('ui')).length)).toBe(0);
  expect(errors).toEqual([]);
});


async function uiNames(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const manager = Reflect.get(window, 'manager');
    return Reflect.get(window, 'audioTest').sources.filter((source: { started: boolean }) => source.started)
      .map((source: { buffer: object }) => [...Reflect.get(manager, 'buffers')]
        .find((entry: [string, object]) => entry[1] === source.buffer)?.[0])
      .filter((name: string | undefined) => name?.startsWith('ui'));
  });
}
async function clearUiObservations(page: Page) {
  await page.evaluate(() => {
    const state = Reflect.get(window, 'audioTest');
    for (const source of state.sources) source.onended?.();
    state.sources.length = 0;
  });
}

test('official UI feedback routes mouse, keyboard and details actions exactly once', async ({ page }) => {
  await fakeAudio(page); await page.goto('/'); await expose(page);
  await page.getByRole('button', { name: 'Options', exact: true }).click(); await loaded(page);
  await clearUiObservations(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  expect((await uiNames(page)).filter(name => name === 'uiBack')).toHaveLength(1);
  await clearUiObservations(page); await page.mouse.move(0, 0);
  const options = page.getByRole('button', { name: 'Options', exact: true });
  await options.hover();
  expect(await uiNames(page)).toEqual(['uiHover']);
  // Moving between children stays within the same button, without another hover cue.
  await options.evaluate(button => {
    const child = document.createElement('span'); child.setAttribute('aria-hidden', 'true'); button.append(child);
    child.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', relatedTarget: button }));
    child.remove();
  });
  expect(await uiNames(page)).toEqual(['uiHover']);
  await options.click();
  expect(await uiNames(page)).toEqual(['uiHover', 'uiOpen']);
  await clearUiObservations(page);
  await page.getByRole('button', { name: 'Back', exact: true }).focus(); await page.keyboard.press('Space');
  expect(await uiNames(page)).toEqual(['uiBack']);
  await clearUiObservations(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeFocused();
  expect(await uiNames(page)).toEqual(['uiHover']);
  await page.keyboard.press('Tab'); await expect(options).toBeFocused();
  expect(await uiNames(page)).toEqual(['uiHover', 'uiHover']);
  await page.keyboard.press('Enter');
  expect((await uiNames(page)).filter(name => name === 'uiOpen')).toHaveLength(1);
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await clearUiObservations(page);
  const summary = page.locator('summary').filter({ hasText: 'Development / demo network scenarios' });
  await summary.click(); await summary.click();
  const names = await uiNames(page);
  expect(names.filter(name => name === 'uiOpen')).toHaveLength(1);
  expect(names.filter(name => name === 'uiClose')).toHaveLength(1);
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').contexts)).toBe(1);
});

test('UI feedback respects autoplay, mute, effects volume, overlap and silent touch controls', async ({ page }) => {
  await fakeAudio(page); await page.goto('/'); await expose(page);
  await page.getByRole('button', { name: 'Options', exact: true }).hover();
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').contexts)).toBe(0);
  expect(await uiNames(page)).toEqual([]);
  await page.getByRole('button', { name: 'Options', exact: true }).click(); await loaded(page);
  await clearUiObservations(page);
  await page.getByRole('button', { name: 'Mute audio', exact: true }).click();
  await clearUiObservations(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await uiNames(page)).toEqual([]);
  await page.getByRole('button', { name: 'Unmute audio', exact: true }).click();
  expect(await uiNames(page)).toEqual(['uiClick']);
  expect(await page.evaluate(() => {
    const manager = Reflect.get(window, 'manager'); const gain = Reflect.get(manager, 'uiGain');
    return { gain: gain.gain.value, shared: Reflect.get(window, 'audioTest').sources.at(-1).output === gain };
  })).toEqual({ gain: 0.4, shared: true });
  const volume = page.getByLabel('Sound effects volume');
  await volume.focus(); await page.keyboard.press('Home'); await clearUiObservations(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await uiNames(page)).toEqual([]);
  await volume.focus(); await page.keyboard.press('ArrowRight'); await clearUiObservations(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await uiNames(page)).filter(name => name === 'uiClick')).toHaveLength(1);
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'effects').gain.value)).toBe(0.05);
  await clearUiObservations(page);
  const bounded = await page.evaluate(() => {
    const manager = Reflect.get(window, 'manager');
    for (let i = 0; i < 30; i++) manager.playUi('uiHover');
    const before = Reflect.get(manager, 'voices').size; manager.playUi('uiClick');
    return { before, after: Reflect.get(manager, 'voices').size,
      latest: [...Reflect.get(manager, 'voices')].at(-1).name };
  });
  expect(bounded).toEqual({ before: 2, after: 1, latest: 'uiClick' });
  await clearUiObservations(page);
  await page.evaluate(() => {
    const touch = document.createElement('section'); touch.className = 'touch-controls';
    const button = document.createElement('button'); touch.append(button); document.body.append(touch);
    button.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' })); button.click();
    touch.remove();
  });
  expect(await uiNames(page)).toEqual([]);
});

test('UI listener cleanup prevents duplicate callbacks after reattachment', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Options', exact: true }).waitFor();
  const result = await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(entry => entry.name.includes('/src/audio/uiSounds.ts'))!.name;
    const { attachUiSounds } = await import(path);
    const events: string[] = []; const audio = { playUi: (name: string) => events.push(name) };
    const button = document.createElement('button'); document.body.append(button);
    const detach = attachUiSounds(audio); button.click(); detach(); button.click();
    const afterDetach = events.length;
    const detachAgain = attachUiSounds(audio); button.click(); detachAgain(); button.click();
    button.remove();
    return { afterDetach, events };
  });
  expect(result).toEqual({ afterDetach: 1, events: ['uiClick', 'uiClick'] });
});


test.describe('touch UI feedback', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('tap navigation plays one cue without hover and preserves Pause Resume sounds', async ({ page }) => {
    await fakeAudio(page); await page.goto('/'); await expose(page);
    await page.getByRole('button', { name: 'Options', exact: true }).tap(); await loaded(page);
    await clearUiObservations(page);
    await page.getByRole('button', { name: 'Back', exact: true }).tap();
    expect(await uiNames(page)).toEqual(['uiBack']);
    await clearUiObservations(page);
    await page.getByRole('button', { name: 'Start Game', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    expect(await uiNames(page)).toEqual(['uiClick']);
    await clearUiObservations(page);
    await page.getByRole('button', { name: 'Pause', exact: true }).tap();
    expect(await uiNames(page)).toEqual([]);
    expect(await page.evaluate(() => {
      const manager = Reflect.get(window, 'manager');
      return Reflect.get(window, 'audioTest').sources.filter((source: { buffer: object }) =>
        source.buffer === Reflect.get(manager, 'buffers').get('pause')).length;
    })).toBe(1);
    await clearUiObservations(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Options', exact: true }).tap();
    expect(await uiNames(page)).toEqual(['uiOpen']);
    await clearUiObservations(page);
    await page.getByRole('button', { name: 'Back', exact: true }).tap();
    expect(await uiNames(page)).toEqual(['uiClose']);
    await clearUiObservations(page);
    await page.getByRole('button', { name: 'Resume', exact: true }).tap();
    await expect(page.locator('canvas')).toBeFocused();
    expect(await uiNames(page)).toEqual([]);
    expect(await page.evaluate(() => {
      const manager = Reflect.get(window, 'manager');
      return Reflect.get(window, 'audioTest').sources.filter((source: { buffer: object }) =>
        source.buffer === Reflect.get(manager, 'buffers').get('resume')).length;
    })).toBe(1);
    await page.getByRole('button', { name: 'Quit Match', exact: true }).tap();
    expect(await uiNames(page)).toEqual(['uiBack']);
  });
});


test('first trusted activation survives initial WAV loading exactly once; hover never queues', async ({ page }) => {
  await fakeAudio(page);
  await page.addInitScript(() => {
    const original = window.fetch;
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    Object.assign(window, { releaseAudio: release });
    window.fetch = async (input, init) => {
      if (String(input).includes('/sounds/')) await ready;
      return original(input, init);
    };
  });
  await page.goto('/'); await expose(page);
  await page.getByRole('button', { name: 'Options', exact: true }).hover();
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').contexts)).toBe(0);
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  expect(await uiNames(page)).toEqual([]);
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'pendingUi').name)).toBe('uiOpen');
  await page.evaluate(() => Reflect.get(window, 'releaseAudio')());
  await loaded(page);
  await expect.poll(() => uiNames(page)).toEqual(['uiOpen']);
  expect(await page.evaluate(() => Reflect.get(window, 'audioTest').contexts)).toBe(1);
  expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'pendingUi'))).toBeNull();
});

for (const cleanup of ['mute', 'blur', 'dispose'] as const) {
  test(`initial UI activation is discarded on ${cleanup} before decoding`, async ({ page }) => {
    await fakeAudio(page);
    await page.addInitScript(() => {
      const original = window.fetch;
      let release!: () => void;
      const ready = new Promise<void>(resolve => { release = resolve; });
      Object.assign(window, { releaseAudio: release });
      window.fetch = async (input, init) => {
        if (String(input).includes('/sounds/')) await ready;
        return original(input, init);
      };
    });
    await page.goto('/'); await expose(page);
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.evaluate(cleanup => {
      const manager = Reflect.get(window, 'manager');
      if (cleanup === 'mute') manager.setPreferences({ ...manager.getPreferences(), muted: true });
      else if (cleanup === 'blur') window.dispatchEvent(new Event('blur'));
      else manager.dispose();
      Reflect.get(window, 'releaseAudio')();
    }, cleanup);
    if (cleanup !== 'dispose') await loaded(page);
    expect(await uiNames(page)).toEqual([]);
    expect(await page.evaluate(() => Reflect.get(Reflect.get(window, 'manager'), 'pendingUi'))).toBeNull();
  });
}
