import { test, expect } from '@playwright/test';

for (const [name, width, height] of [
  ['desktop', 1280, 900], ['portrait', 390, 844], ['landscape', 844, 390],
] as const) {
  test(`menu background and reachable Options actions: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    for (const screen of ['Options', 'Ranking', 'Match History']) {
      await page.getByRole('button', { name: screen, exact: true }).click();
      const main = page.locator('main.pirate-screen');
      expect(await main.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('/assets/main-menu-background.png');
      if (screen === 'Options') {
        if (name === 'desktop') {
          const save = (await page.getByRole('button', { name: 'Save', exact: true }).boundingBox())!;
          expect(save.y + save.height).toBeLessThanOrEqual(height + 1);
        }
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('Settings saved');
      }
      if (screen === 'Match History') {
        await expect(page.getByText('No matches played yet.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
      }
      const back = page.getByRole('button', { name: 'Back', exact: true });
      await back.scrollIntoViewIfNeeded();
      const bounds = (await back.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(-1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(-1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await back.click();
    }
  });
}


test('initial loading keeps menu hidden until required images decode', async ({ page }) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    Object.assign(window, { releaseMenuImages: release });
    HTMLImageElement.prototype.decode = async function() {
      if (this.src.endsWith('/assets/main-menu-background.png')) await gate;
      return decode.call(this);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Loading Pirate Battle...');
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toHaveCount(0);
  const bar = page.getByRole('progressbar', { name: 'Loading Pirate Battle...' });
  await expect.poll(async () => Number(await bar.getAttribute('value'))).toBeGreaterThan(0);
  expect(Number(await bar.getAttribute('value'))).toBeLessThan(1);
  expect(await page.locator('.menu-loader').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('/assets/main-menu-background.png');
  await page.screenshot({ path: test.info().outputPath('menu-loading.png') });
  await page.evaluate(() => Reflect.get(window, 'releaseMenuImages')());
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
  await expect(page.getByText('Loading Pirate Battle...')).toHaveCount(0);
});

test('menu image failure is accessible and retry restores navigation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    let fail = true;
    HTMLImageElement.prototype.decode = function() {
      if (fail && this.src.endsWith('/assets/main-menu-background.png')) {
        fail = false; return Promise.reject(new Error('Image unavailable'));
      }
      return decode.call(this);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Unable to load menu images');
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry loading' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Options', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});


test('arena loading reports decoded assets with the menu background before simulation starts', async ({ page }) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    Object.assign(window, { releaseArenaImages: release });
    HTMLImageElement.prototype.decode = async function() {
      if (this.src.endsWith('/ships/ship_2.png')) await gate;
      return decode.call(this);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  const bar = page.getByRole('progressbar', { name: 'Loading arena...' });
  await expect(bar).toBeVisible();
  await expect.poll(async () => Number(await bar.getAttribute('value'))).toBeGreaterThan(0);
  expect(Number(await bar.getAttribute('value'))).toBeLessThan(1);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.locator('.arena-loader').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('/assets/main-menu-background.png');
  await page.screenshot({ path: test.info().outputPath('arena-loading.png') });
  await page.evaluate(() => Reflect.get(window, 'releaseArenaImages')());
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await expect(bar).toHaveCount(0);
  await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
});
