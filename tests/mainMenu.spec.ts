import { expect, test } from '@playwright/test';

test('menu preserves navigation and keyboard focus', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
  for (const name of ['Start Game', 'Options', 'Ranking', 'Match History']) {
    await page.keyboard.press('Tab');
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeFocused();
    expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  }
  for (const name of ['Options', 'Ranking', 'Match History']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
  }
});

for (const [name, width, height] of [
  ['desktop', 1280, 900], ['portrait', 390, 844],
  ['small portrait', 320, 568], ['landscape', 844, 390],
  ['small landscape', 667, 375],
] as const) {
  test(`menu controls remain reachable without overflow: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible();
    await expect(page.getByText('Move forward', { exact: true })).toBeVisible();
    await expect(page.getByText('Rotate left', { exact: true })).toBeVisible();
    await expect(page.getByText('Rotate right', { exact: true })).toBeVisible();
    await expect(page.locator('kbd')).toHaveText(['W', '↑', 'A', '←', 'D', '→', 'Space', 'Q', 'E']);
    for (const label of ['Start Game', 'Options', 'Ranking', 'Match History']) {
      const button = page.getByRole('button', { name: label, exact: true });
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
      const decoration = await button.evaluate(el => {
        const s = getComputedStyle(el, '::before');
        // border widths round to device pixels; explicit image widths retain fractions.
        const [y, x] = s.borderImageWidth.split(' ').map(parseFloat);
        return { slice: s.borderImageSlice, x, y,
          labelFits: el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight };
      });
      expect(decoration.slice).toBe('64 80 fill');
      // Equal source-to-display scale on both axes preserves circular bolts.
      expect(decoration.x / 40).toBeCloseTo(decoration.y / 32, 2);
      expect(decoration.labelFits).toBe(true);
      // Browser scroll positioning rounds fractional CSS pixels.
      expect(box.y).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
      expect(await button.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })).toBe(true);
    }
    await page.getByText('Development / demo network scenarios', { exact: true }).click();
    const selects = page.locator('.main-menu select');
    await expect(selects).toHaveCount(2);
    for (const select of await selects.all()) {
      await select.scrollIntoViewIfNeeded();
      const box = (await select.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await page.getByRole('button', { name: 'Reset network demo', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('.menu-navigation')).toHaveScreenshot(`buttons-${name.replaceAll(' ', '-')}.png`);
  });
}

test('official button hover and pressed images keep the same slicing', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Start Game', exact: true });
  await button.hover();
  await expect(button).toHaveScreenshot('primary-hover.png');
  expect(await button.evaluate(el => getComputedStyle(el, '::before').borderImageSource)).toContain('button_primary_hover.png');
  await page.mouse.down();
  await expect(button).toHaveScreenshot('primary-pressed.png');
  expect(await button.evaluate(el => getComputedStyle(el, '::before').borderImageSource)).toContain('button_primary_pressed.png');
  // Move away before releasing so this visual test does not start gameplay.
  await page.mouse.move(0, 0);
  await page.mouse.up();
  const secondary = page.getByRole('button', { name: 'Ranking', exact: true });
  await secondary.hover();
  await expect(secondary).toHaveScreenshot('secondary-hover.png');
  await page.mouse.down();
  await expect(secondary).toHaveScreenshot('secondary-pressed.png');
  expect(await secondary.evaluate(el => getComputedStyle(el, '::before').borderImageSource)).toContain('button_secondary_pressed.png');
  await page.mouse.move(0, 0);
  await page.mouse.up();
});
