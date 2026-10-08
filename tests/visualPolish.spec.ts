import { expect, test, type Page } from '@playwright/test';

async function instrument(page: Page) {
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/Game.ts'))!.name;
    const { Game } = await import(path);
    const start = Game.prototype.start;
    Game.prototype.start = function(config: unknown) {
      start.call(this, config); Object.assign(window, { polishGame: this });
    };
  });
}

async function frozenState(page: Page) {
  return page.evaluate(() => JSON.stringify(Reflect.get(window, 'polishGame').getState(),
    (_key, value: unknown) => value instanceof Map ? [...value.entries()] : value));
}

for (const [name, width, height] of [['desktop', 1600, 1100], ['portrait', 390, 844], ['landscape', 844, 390]] as const) {
  test.describe(name, () => {
  test.use({ isMobile: name !== 'desktop', hasTouch: name !== 'desktop' });
  test(`pause Options preserves session and abandonment sends no match: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    let submissions = 0;
    page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/matches')) submissions++; });
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
    await instrument(page);
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    // Asset decode/WebGL setup precedes the gameplay-ready assertions.
    await page.locator('canvas').waitFor({ state: 'visible' });
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    const canvas = (await page.locator('canvas').boundingBox())!;
    expect(canvas.width / canvas.height).toBeCloseTo(1.6, 1);
    if (name === 'desktop') expect(canvas.width).toBeGreaterThan(960);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    // Freeze just the displayed timer for a stable visual; simulation is untouched.
    await page.locator('.match-hud-stat').nth(2).locator('strong').evaluate(el => { el.textContent = '02:00'; });
    await expect(page).toHaveScreenshot(`paused-arena-${name}.png`);
    await page.evaluate(() => Object.assign(window, { pausedGame: Reflect.get(window, 'polishGame'), pausedCanvas: document.querySelector('canvas') }));
    const config = await page.evaluate(() => JSON.stringify(Reflect.get(Reflect.get(window, 'polishGame'), 'configSnapshot')));
    const frozen = await frozenState(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Options', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Options' });
    await expect(dialog.getByLabel('Game session time', { exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel('Enemy spawn time', { exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel('Sound effects volume')).toBeFocused();
    await expect(dialog.getByLabel('Show FPS', { exact: true })).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    // Tab remains inside the native modal even while its form is displayed.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    expect(await frozenState(page)).toBe(frozen);
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(Reflect.get(window, 'polishGame'), 'configSnapshot')))).toBe(config);
    expect(await page.evaluate(() => Reflect.get(window, 'polishGame') === Reflect.get(window, 'pausedGame')
      && document.querySelector('canvas') === Reflect.get(window, 'pausedCanvas'))).toBe(true);
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(Reflect.get(window, 'polishGame'), 'configSnapshot')))).toBe(config);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Main Menu', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
    expect(submissions).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('pirate-battle:pending-matches:v1'))).toBeNull();
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.getByLabel('Game session time', { exact: true }).fill('60');
    await page.getByLabel('Enemy spawn time', { exact: true }).fill('4');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Settings saved. They will apply to new matches.');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    // Asset decode/WebGL setup precedes the gameplay-ready assertions.
    await page.locator('canvas').waitFor({ state: 'visible' });
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    const next = await page.evaluate(() => Reflect.get(Reflect.get(window, 'polishGame'), 'configSnapshot'));
    expect(next.sessionDuration).toBe(60);
    expect(next.enemySpawnInterval).toBe(4);
    await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
    expect(submissions).toBe(0);
  });

  test(`Captain's Log pagination and responsive tables: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByText('Development / demo network scenarios', { exact: true }).click();
    await page.getByLabel('Network scenario', { exact: true }).selectOption('multiple_pages');
    for (const screen of ['Ranking', 'Match History']) {
      await page.getByRole('button', { name: screen, exact: true }).click();
      await expect(page.locator('tbody tr')).toHaveCount(5);
      await expect(page.getByRole('table')).toHaveCount(1);
      await expect(page.getByRole('columnheader')).toHaveCount(screen === 'Ranking' ? 4 : 6);
      await expect(page.getByRole('cell')).toHaveCount(screen === 'Ranking' ? 20 : 30);
      await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
      const first = await page.locator('tbody tr').first().innerText();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
      expect(await page.locator('tbody tr').first().innerText()).not.toBe(first);
      if (screen === 'Ranking') await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText(/6/);
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
      if (screen === 'Match History') await page.locator('tbody summary').first().click();
      expect(await page.locator('tbody').innerText()).not.toMatch(/fixture-player|local-player/);
      for (const cell of await page.locator('tbody td').all()) {
        const box = (await cell.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(await cell.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.pirate-screen-panel')).toHaveScreenshot(`${screen.replaceAll(' ', '-')}-${name}.png`);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
    }
  });
  });
}
