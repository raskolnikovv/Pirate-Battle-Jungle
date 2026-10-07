import { test, expect } from '@playwright/test';

test('third and fourth completed matches remain visible after a worker interruption', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
  await page.evaluate(async () => {
    localStorage.setItem('pirate-battle:options:v1', JSON.stringify({
      version: 1, sessionDuration: 60, enemySpawnInterval: 3,
    }));
    const gamePath = performance.getEntriesByType('resource')
      .find((entry) => entry.name.includes('/src/game/core/Game.ts'))?.name;
    if (!gamePath) throw new Error('Loaded Game module not found.');
    const { Game } = await import(gamePath);
    const start = Game.prototype.start;
    Game.prototype.start = function (config: unknown) {
      start.call(this, config);
      Object.assign(window, { testGame: this });
    };
  });
  const session = await page.context().newCDPSession(page);
  await session.send('ServiceWorker.enable');
  for (let match = 1; match <= 4; match += 1) {
    if (match === 3) await session.send('ServiceWorker.stopAllWorkers');
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await page.locator('canvas').waitFor();
    await page.evaluate((matchNumber) => {
      const state = Reflect.get(window, 'testGame').getState();
      state.score = matchNumber;
      state.enemiesDefeated = matchNumber;
      if (matchNumber % 2 === 0) state.players.values().next().value.health = 0;
      else state.remainingSeconds = 1 / 60;
    }, match);
    await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ranking', exact: true }).click();
    await expect(page.getByText(`Page 1 of 1 · ${match} results · 5 per page`, { exact: true })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(match);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Match History', exact: true }).click();
    const total = match + 3;
    await expect(page.getByText(`Page 1 of ${Math.ceil(total / 5)} · ${total} results · 5 per page`, { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test('ranking can be reopened after history and pagination navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  for (let cycle = 0; cycle < 5; cycle += 1) {
    await page.getByRole('button', { name: 'Ranking', exact: true }).click();
    await expect(page.getByText('Page 1 of 3', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Page 2 of 3', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Match History', exact: true }).click();
    await expect(page.getByText('Page 1 of 1', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test('lost MSW interception is restored before ranking queries', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Page 1 of 3', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  // Reproduce a browser worker restart, without changing application mock state.
  const session = await page.context().newCDPSession(page);
  await session.send('ServiceWorker.enable');
  await session.send('ServiceWorker.stopAllWorkers');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Updating ranking...', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ranking', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Blackbeard/ })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pirate Battle', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('HTTP 200 HTML is rejected before it can become ranking data', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ranking', exact: true }).waitFor();
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const workerPath = resources.find((entry) => entry.name.includes('/src/mocks/browser.ts'))?.name;
    const mswPath = resources.find((entry) => entry.name.includes('/deps/msw.js'))?.name;
    if (!workerPath || !mswPath) throw new Error('Loaded MSW modules were not found.');
    const { worker } = await import(workerPath);
    const { http, HttpResponse } = await import(mswPath);
    worker.use(http.get('/api/ranking', () => HttpResponse.html('<html><body>SPA document</body></html>')));
  });
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Failed to load ranking');
  await expect(page.getByRole('heading', { name: 'Ranking', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  expect(errors).toEqual([]);
});

test('malformed JSON is a query error rather than a render exception', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ranking', exact: true }).waitFor();
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const workerPath = resources.find((entry) => entry.name.includes('/src/mocks/browser.ts'))?.name;
    const mswPath = resources.find((entry) => entry.name.includes('/deps/msw.js'))?.name;
    if (!workerPath || !mswPath) throw new Error('Loaded MSW modules were not found.');
    const { worker } = await import(workerPath);
    const { http, HttpResponse } = await import(mswPath);
    worker.use(http.get('/api/ranking', () => HttpResponse.json({
      items: [{ rank: 1, playerName: 'Invalid record' }],
      page: 1, pageSize: 5, total: 1, totalPages: 1,
    })));
  });
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Failed to load ranking');
  await expect(page.getByRole('heading', { name: 'Ranking', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  expect(errors).toEqual([]);
});
