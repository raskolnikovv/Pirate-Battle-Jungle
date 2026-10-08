import { expect, test, type Locator, type Page } from '@playwright/test';

async function reachable(page: Page, controls: Locator) {
  for (const control of await controls.all()) {
    await control.scrollIntoViewIfNeeded();
    // The associated label is the checkbox's full touch target.
    const box = await control.evaluate(el => {
      const target = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.closest('label')! : el;
      const bounds = target.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    });
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await control.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const [name, width, height] of [
  ['desktop', 1280, 900], ['portrait', 390, 844], ['landscape', 844, 390],
  ['small portrait', 320, 568], ['small landscape', 667, 375],
] as const) {
  test(`pirate screens preserve settings, pause, result and retry: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    const session = page.getByLabel('Game session time', { exact: true });
    const spawn = page.getByLabel('Enemy spawn time', { exact: true });
    await expect(session).toHaveValue('120');
    await expect(spawn).toHaveValue('3');
    await session.fill('59');
    await spawn.fill('0');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(session).toBeFocused();
    await expect(session).toHaveAttribute('aria-invalid', 'true');
    await expect(spawn).toHaveAttribute('aria-invalid', 'true');
    await session.fill('181');
    await spawn.fill('16');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(session).toHaveAttribute('aria-invalid', 'true');
    await expect(spawn).toHaveAttribute('aria-invalid', 'true');
    await session.fill('60');
    await spawn.fill('4');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Settings saved. They will apply to new matches.');
    await reachable(page, page.locator('.options-form input, .options-form button'));
    if (!name.startsWith('small')) await expect(page.locator('.pirate-screen-panel')).toHaveScreenshot(`options-${name}.png`);
    await page.reload();
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await expect(session).toHaveValue('60');
    await expect(spawn).toHaveValue('4');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByText('Development / demo network scenarios', { exact: true }).click();
    await page.getByLabel('Network scenario', { exact: true }).selectOption('http_5xx');
    await page.getByLabel('Target endpoint', { exact: true }).selectOption('matches');
    await page.evaluate(async () => {
      const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/Game.ts'))!.name;
      const { Game } = await import(path);
      const start = Game.prototype.start;
      Game.prototype.start = function(config: unknown) {
        start.call(this, config); Object.assign(window, { screenGame: this });
      };
    });
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Game Paused' });
    const resume = dialog.getByRole('button', { name: 'Resume', exact: true });
    await expect(resume).toBeFocused();
    const frozen = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'screenGame').getState(),
      (_key, value: unknown) => value instanceof Map ? [...value.entries()] : value));
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'screenGame').getState(),
      (_key, value: unknown) => value instanceof Map ? [...value.entries()] : value))).toBe(frozen);
    await reachable(page, resume);
    if (!name.startsWith('small')) await expect(dialog).toHaveScreenshot(`pause-${name}.png`);
    await resume.click();
    await expect(dialog).not.toBeVisible();
    await page.evaluate(() => {
      const game = Reflect.get(window, 'screenGame');
      const state = game.getState();
      state.score = 2; state.enemiesDefeated = 2; state.remainingSeconds = 1 / 60;
    });
    await expect(page.getByRole('heading', { name: 'Match Results', exact: true })).toBeVisible();
    await expect(page.getByText('Time Expired', { exact: true })).toBeVisible();
    await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
    await expect(page.getByText('The API confirmed this match in your history.')).toHaveCount(0);
    await expect(page.locator('.result-score-card')).toContainText('2');
    await expect(page.locator('.result-active-time')).toContainText('60s');
    await expect(page.locator('.result-details')).not.toHaveAttribute('open', '');
    await reachable(page, page.locator('.pirate-actions button, [aria-label="Pending match submissions"] button'));
    if (!name.startsWith('small')) await expect(page.locator('.pirate-screen-panel')).toHaveScreenshot(`result-${name}.png`, {
      mask: [page.locator('time:visible'), page.locator('[aria-label="Pending match submissions"] li > p')],
    });
    await page.locator('.result-details summary').click();
    await expect(page.locator('.result-details')).toContainText('Enemies Defeated: 2');
    await expect(page.locator('.result-details')).toContainText('Session time: 60s · Enemy spawn time: 4s');
    await page.locator('.result-details summary').click();
    await page.getByText('Development / demo network scenarios', { exact: true }).click();
    await page.getByLabel('Network scenario', { exact: true }).selectOption('success');
    await page.getByRole('button', { name: 'Retry registration', exact: true }).click();
    await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
    await expect(page.getByText('The API confirmed this match in your history.')).toBeVisible();
    await page.getByRole('button', { name: 'Play Again', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
    await page.goto('/#result');
    // App reads the saved-result hash at initialization, not on hash-only navigation.
    await page.reload();
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
  });
}
