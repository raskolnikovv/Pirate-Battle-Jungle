import { test, expect } from '@playwright/test';

test('application loads and shows main menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /pirate battle/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /start game/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /ranking/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /match history/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /options/i })).toBeVisible();
});

test('can navigate to game screen and back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /start game/i }).click();
  // Asset decode/WebGL setup precedes the gameplay-ready assertions.
  await page.locator('canvas').waitFor({ state: 'visible' });
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  // Profiling is opt-in and must never attach to the ordinary regression build.
  expect(await page.evaluate(() => Reflect.has(window, 'pirateProfile'))).toBe(false);
  expect(await page.evaluate(() => performance.getEntriesByType('resource')
    .some(entry => entry.name.includes('profileSession')))).toBe(false);
  await expect(page.getByRole('button', { name: /quit match/i })).toBeVisible();
  await page.getByRole('button', { name: /quit match/i }).click();
  await expect(page.getByRole('heading', { name: /pirate battle/i })).toBeVisible();
});
