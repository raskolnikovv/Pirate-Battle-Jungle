import { expect, test, type Page } from '@playwright/test';

async function openOptions(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Options', exact: true }).click();
}
async function instrument(page: Page) {
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/Game.ts'))!.name;
    const { Game } = await import(path); const start = Game.prototype.start;
    Game.prototype.start = function(config: unknown) { start.call(this, config); Object.assign(window, { fpsGame: this }); };
  });
}
async function frozen(page: Page) {
  return page.evaluate(() => JSON.stringify(Reflect.get(window, 'fpsGame').getState(),
    (_key, value: unknown) => value instanceof Map ? [...value.entries()] : value));
}

for (const [name, width, height] of [['desktop', 1280, 900], ['portrait', 390, 844], ['landscape', 844, 390]] as const) {
  test.describe(name, () => {
    test.use({ viewport: { width, height }, isMobile: name !== 'desktop', hasTouch: name !== 'desktop' });
    test('contextual Options, live FPS, pause and cleanup preserve gameplay', async ({ page }) => {
      await openOptions(page);
      await expect(page.getByLabel('Game session time', { exact: true })).toHaveValue('120');
      await expect(page.getByLabel('Enemy spawn time', { exact: true })).toHaveValue('3');
      await expect(page.getByLabel('Sound effects volume')).toBeVisible();
      await expect(page.getByLabel('Ocean ambience volume')).toBeVisible();
      const toggle = page.getByLabel('Show FPS', { exact: true });
      await expect(toggle).not.toBeChecked();
      await toggle.focus(); await page.keyboard.press('Space'); await expect(toggle).toBeChecked();
      await page.getByLabel('Game session time', { exact: true }).fill('90');
      await page.getByLabel('Enemy spawn time', { exact: true }).fill('4');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.locator('.fps-counter')).toHaveCount(0);
      await page.reload(); await page.getByRole('button', { name: 'Options', exact: true }).click();
      await expect(toggle).toBeChecked();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(page.locator('.fps-counter')).toHaveCount(0);
      await instrument(page);
      await page.getByRole('button', { name: 'Start Game', exact: true }).click();
      await page.locator('canvas').waitFor();
      await page.bringToFront();
      if (await page.getByRole('dialog').isVisible()) await page.getByRole('button', { name: 'Resume', exact: true }).click();
      const counter = page.locator('.fps-counter');
      await expect(counter).toHaveText(/^FPS: [1-9]\d*$/);
      await expect(counter).toHaveAttribute('aria-live', 'off');
      const rect = (await counter.boundingBox())!;
      const arena = (await page.locator('canvas').boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(arena.x); expect(rect.y).toBeGreaterThanOrEqual(arena.y);
      expect(rect.x + rect.width).toBeLessThanOrEqual(arena.x + arena.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(arena.y + arena.height);
      for (const control of await page.locator('.game-header, .touch-controls button').all()) {
        const box = await control.boundingBox(); if (!box) continue;
        expect(rect.x + rect.width <= box.x || box.x + box.width <= rect.x
          || rect.y + rect.height <= box.y || box.y + box.height <= rect.y).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      const before = await frozen(page);
      const config = await page.evaluate(() => JSON.stringify(Reflect.get(Reflect.get(window, 'fpsGame'), 'configSnapshot')));
      await page.getByRole('dialog').getByRole('button', { name: 'Options', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Options' });
      await expect(dialog.getByLabel('Game session time', { exact: true })).toHaveCount(0);
      await expect(dialog.getByLabel('Enemy spawn time', { exact: true })).toHaveCount(0);
      await expect(dialog.getByLabel('Sound effects volume')).toBeFocused();
      await dialog.getByRole('button', { name: 'Mute audio', exact: true }).click();
      await expect(dialog.getByRole('button', { name: 'Unmute audio', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await dialog.getByLabel('Sound effects volume').focus(); await page.keyboard.press('ArrowRight');
      await expect(dialog.getByLabel('Sound effects volume')).toHaveValue('65');
      await toggle.uncheck(); await expect(counter).toHaveCount(0);
      await toggle.check(); await expect(counter).toHaveText('FPS: --');
      await page.evaluate(() => {
        const game = Reflect.get(window, 'fpsGame');
        for (let i = 0; i < 120; i++) Reflect.get(game, 'update').call(game, 1 / 60);
      });
      expect(await frozen(page)).toBe(before);
      expect(await page.evaluate(() => JSON.stringify(Reflect.get(Reflect.get(window, 'fpsGame'), 'configSnapshot')))).toBe(config);
      await dialog.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Game Paused' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeFocused();
      expect(await frozen(page)).toBe(before);
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await expect(counter).toHaveText(/^FPS: [1-9]\d*$/);
      await page.evaluate(() => Object.assign(window, { oldFpsLoop: Reflect.get(Reflect.get(window, 'fpsGame'), 'loop') }));
      await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
      await expect(counter).toHaveCount(0);
      expect(await page.evaluate(() => {
        const loop = Reflect.get(window, 'oldFpsLoop');
        return { running: loop.isRunning(), observer: typeof Reflect.get(loop, 'fpsObserver'), samples: loop.getFrameTimes() };
      })).toEqual({ running: false, observer: 'undefined', samples: [] });
      await page.getByRole('button', { name: 'Start Game', exact: true }).click();
      await page.locator('canvas').waitFor(); await expect(counter).toBeVisible();
      expect(await page.locator('canvas').count()).toBe(1);
    });
  });
}

test('FPS defaults off during gameplay and corrupted storage falls back safely', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pirate-battle:display:v1', '{broken'));
  await openOptions(page); await expect(page.getByLabel('Show FPS', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await page.locator('canvas').waitFor(); await expect(page.locator('.fps-counter')).toHaveCount(0);
});

test('unavailable display storage reports failure but does not block Options', async ({ page }) => {
  await openOptions(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Unavailable'); }; });
  await page.getByLabel('Show FPS', { exact: true }).check();
  await expect(page.getByRole('alert')).toHaveText('Display preferences could not be saved. Changes apply for this visit only.');
  await expect(page.getByLabel('Show FPS', { exact: true })).toBeChecked();
});

test('render cadence differs from fixed simulation frequency and samples stay bounded', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
  const result = await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/GameLoop.ts'))!.name;
    const { GameLoop } = await import(path);
    const raf = window.requestAnimationFrame; const cancel = window.cancelAnimationFrame;
    const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    let timestamp = 0; let pending: FrameRequestCallback | null = null;
    window.requestAnimationFrame = callback => { pending = callback; return 1; };
    window.cancelAnimationFrame = () => { pending = null; };
    Object.defineProperty(performance, 'now', { configurable: true, value: () => timestamp });
    try {
      const run = (enabled: boolean) => {
        timestamp = 0; let updates = 0; let renders = 0; let elapsed = 0;
        const values: number[] = [];
        const loop = new GameLoop({ update: (delta: number) => { updates++; elapsed += delta; }, render: () => { renders++; } });
        if (enabled) loop.setFpsObserver((fps: number | null) => { if (fps !== null) values.push(fps); });
        loop.start();
        for (let frame = 0; frame < 720; frame++) {
          timestamp += 1000 / 30;
          const callback = pending!; pending = null; callback(timestamp);
        }
        const samples = loop.getFrameTimes(); loop.stop();
        return { updates, renders, elapsed, values, samples, stoppedSamples: loop.getFrameTimes(), scheduled: pending !== null };
      };
      return { disabled: run(false), enabled: run(true) };
    } finally {
      window.requestAnimationFrame = raf; window.cancelAnimationFrame = cancel;
      if (descriptor) Object.defineProperty(performance, 'now', descriptor);
      else Reflect.deleteProperty(performance, 'now');
    }
  });
  expect(result.enabled.updates).toBe(result.disabled.updates);
  expect(result.enabled.elapsed).toBe(result.disabled.elapsed);
  expect(result.enabled.elapsed).toBeCloseTo(24, 1);
  expect(result.enabled.renders).toBe(720);
  expect(result.enabled.values.length).toBeGreaterThan(20);
  expect(result.enabled.values.length).toBeLessThanOrEqual(24);
  expect(result.enabled.values.every((fps: number) => fps === 30)).toBe(true);
  expect(result.enabled.samples).toHaveLength(600);
  expect(result.enabled.samples.every((ms: number) => Math.abs(ms - 1000 / 30) < 1e-6)).toBe(true);
  expect(result.disabled.samples).toEqual([]);
  expect(result.enabled.stoppedSamples).toEqual([]);
  expect(result.enabled.scheduled).toBe(false);
});
