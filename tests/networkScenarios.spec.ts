import { test, expect, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
  await page.getByText('Development / demo network scenarios', { exact: true }).click();
}
async function select(page: Page, scenario: string, target = 'all') {
  await page.getByLabel('Network scenario', { exact: true }).selectOption(scenario);
  await expect(page.getByRole('status').filter({ hasText: 'Scenario saved' })).toBeVisible();
  await page.getByLabel('Target endpoint', { exact: true }).selectOption(target);
}
async function request(page: Page, endpoint: 'ranking' | 'history') {
  return page.evaluate(async (endpoint) => {
    const resources = performance.getEntriesByType('resource');
    const clientPath = resources.find(e => e.name.includes('/src/api/client.ts'))!.name;
    const configPath = resources.find(e => e.name.includes('/src/config/gameConfig.ts'))!.name;
    const keyPath = resources.find(e => e.name.includes('/src/config/gameConfigKey.ts'))!.name;
    const { httpClient } = await import(clientPath);
    const { DEFAULT_GAME_CONFIG } = await import(configPath);
    const { getGameConfigKey } = await import(keyPath);
    try {
      const response = await httpClient.get('/' + endpoint, { params: { page: 1, pageSize: 5, configKey: getGameConfigKey(DEFAULT_GAME_CONFIG) } });
      return { status: response.status, total: response.data.total, pages: response.data.totalPages, code: '' };
    } catch (error) {
      return { status: Reflect.get(error as object, 'response')?.status ?? 0, code: Reflect.get(error as object, 'code'), total: -1, pages: -1 };
    }
  }, endpoint);
}
async function finish(page: Page) {
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/Game.ts'))!.name;
    const { Game } = await import(path);
    const start = Game.prototype.start;
    Game.prototype.start = function(config: unknown) { start.call(this, config); Object.assign(window, { scenarioGame: this }); };
  });
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await page.locator('canvas').waitFor();
  await page.evaluate(() => { Reflect.get(window, 'scenarioGame').getState().remainingSeconds = 1 / 60; });
  await expect(page.getByRole('heading', { name: 'Match Results', exact: true })).toBeVisible();
}
async function counts(page: Page) {
  return page.evaluate(() => ({
    pending: JSON.parse(localStorage.getItem('pirate-battle:pending-matches:v1') ?? '{"records":[]}').records.length,
    confirmed: JSON.parse(localStorage.getItem('pirate-battle:confirmed-matches:v1') ?? '{"records":[]}').records.length,
  }));
}

test('success, empty target, multi-page fixtures and scenario persistence', async ({ page }) => {
  await open(page);
  expect((await request(page, 'ranking')).total).toBe(11);
  expect((await request(page, 'history')).total).toBe(3);
  await select(page, 'empty', 'ranking');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('No completed matches for these settings yet.')).toBeVisible();
  expect((await request(page, 'history')).total).toBe(3);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByText('Development / demo network scenarios', { exact: true }).click();
  await select(page, 'empty');
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('No matches played yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByText('Development / demo network scenarios', { exact: true }).click();
  await select(page, 'multiple_pages');
  expect((await request(page, 'ranking')).pages).toBeGreaterThan(1);
  expect((await request(page, 'history')).pages).toBeGreaterThan(1);
  expect(await counts(page)).toEqual({ pending: 0, confirmed: 0 });
  await page.reload();
  await page.getByText('Development / demo network scenarios', { exact: true }).click();
  await expect(page.getByLabel('Network scenario', { exact: true })).toHaveValue('multiple_pages');
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('Page 1 of 4 · 18 results · 5 per page')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 4 · 18 results · 5 per page')).toBeVisible();
});

test('slow response exposes loading without blocking navigation', async ({ page }) => {
  await open(page); await select(page, 'slow');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Loading ranking...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeEnabled();
  await expect(page.getByRole('table')).toBeVisible();
});

test('variable sequence resets and out-of-order requests settle later-first', async ({ page }) => {
  await open(page); await select(page, 'variable_latency');
  const sequences = await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/mocks/networkScenarios.ts'))!.name;
    const { beginNetworkRequest, selectNetworkScenario } = await import(path);
    const first = Array.from({ length: 5 }, () => beginNetworkRequest('history').latency);
    selectNetworkScenario({ scenario: 'variable_latency', target: 'all' });
    return [first, Array.from({ length: 5 }, () => beginNetworkRequest('history').latency)];
  });
  expect(sequences).toEqual([[150, 700, 300, 100, 150], [150, 700, 300, 100, 150]]);
  await select(page, 'out_of_order');
  const order = await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/api/client.ts'))!.name;
    const { httpClient } = await import(path);
    const completed: number[] = [];
    await Promise.all([1, 2].map(page => httpClient.get('/history', { params: { page, pageSize: 1 } }).then(() => completed.push(page))));
    return completed;
  });
  expect(order).toEqual([2, 1]);
  // Actual query lifecycle: leave the slow first query and reopen for the fast second.
  await select(page, 'out_of_order');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Loading ranking...')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Page 1 of 3 · 11 results · 5 per page')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 3 · 11 results · 5 per page')).toBeVisible();
  await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('6');
});

for (const [scenario, status] of [['network_error', 0], ['http_4xx', 422], ['http_5xx', 500], ['ranking_failure', 503], ['history_failure', 503]] as const) {
  test(`${scenario} is distinct and safe in remote-data UI`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await open(page); await select(page, scenario);
    const endpoint = scenario === 'history_failure' ? 'history' : 'ranking';
    const response = await request(page, endpoint);
    expect(response.status).toBe(status);
    if (scenario === 'network_error') expect(response.code).toBe('ERR_NETWORK');
    if (scenario === 'ranking_failure') expect((await request(page, 'history')).status).toBe(200);
    if (scenario === 'history_failure') expect((await request(page, 'ranking')).status).toBe(200);
    await page.getByRole('button', { name: endpoint === 'history' ? 'Match History' : 'Ranking', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Failed to load');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}

for (const scenario of ['timeout', 'post_confirmation_timeout', 'unavailable']) {
  test(`${scenario} retains pending and recovers exactly once`, async ({ page }) => {
    await open(page); await select(page, scenario);
    // Shorten only the client test timeout; shared server scenario remains unchanged (11s).
    await page.evaluate(async () => {
      const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/api/client.ts'))!.name;
      const { httpClient } = await import(path); httpClient.defaults.timeout = 300;
    });
    await finish(page);
    await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
    expect(await counts(page)).toEqual({ pending: 1, confirmed: scenario === 'post_confirmation_timeout' ? 1 : 0 });
    await expect(page.getByRole('button', { name: 'Play Again', exact: true })).toBeEnabled();
    await page.getByText('Development / demo network scenarios', { exact: true }).click();
    await select(page, 'success');
    await page.getByRole('button', { name: 'Retry registration', exact: true }).click();
    await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
    expect(await counts(page)).toEqual({ pending: 0, confirmed: 1 });
    expect((await request(page, 'ranking')).total).toBe(12);
    expect((await request(page, 'history')).total).toBe(4);
    await page.getByRole('button', { name: 'Play Again', exact: true }).click();
    await page.locator('canvas').waitFor();
    await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
    expect(await counts(page)).toEqual({ pending: 0, confirmed: 1 });
  });
}

test('reset clears accepted and pending records, preserves Options, restores initial fixtures and counters', async ({ page }) => {
  await open(page); await select(page, 'post_confirmation_timeout');
  await page.evaluate(async () => {
    localStorage.setItem('pirate-battle:options:v1', JSON.stringify({ version: 1, sessionDuration: 60, enemySpawnInterval: 4 }));
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/api/client.ts'))!.name;
    const { httpClient } = await import(path); httpClient.defaults.timeout = 300;
  });
  await finish(page);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  await page.getByText('Development / demo network scenarios', { exact: true }).click();
  await page.getByRole('button', { name: 'Reset network demo', exact: true }).click();
  await expect(page.getByText('Reset complete: initial fixtures restored; confirmed and pending matches cleared.')).toBeVisible();
  expect(await counts(page)).toEqual({ pending: 0, confirmed: 0 });
  expect((await request(page, 'ranking')).total).toBe(11);
  expect((await request(page, 'history')).total).toBe(3);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle:options:v1')!).sessionDuration)).toBe(60);
  await expect(page.getByLabel('Network scenario', { exact: true })).toHaveValue('success');
  await expect(page.getByText('Registration: Not submitted in this session', { exact: true })).toBeVisible();
});

test('late ranking response cannot replace the newer empty scenario', async ({ page }) => {
  await open(page); await select(page, 'slow');
  const oldRequest = page.waitForRequest(request => request.url().includes('/api/ranking?'));
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await oldRequest;
  await expect(page.getByText('Loading ranking...')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByText('Development / demo network scenarios', { exact: true }).click();
  await select(page, 'empty', 'ranking');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('No completed matches for these settings yet.')).toBeVisible();
  // A full slow response completes after the old request's scheduled response.
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const scenarioPath = resources.find(e => e.name.includes('/src/mocks/networkScenarios.ts'))!.name;
    const clientPath = resources.find(e => e.name.includes('/src/api/client.ts'))!.name;
    const { selectNetworkScenario } = await import(scenarioPath);
    const { httpClient } = await import(clientPath);
    selectNetworkScenario({ scenario: 'slow', target: 'history' });
    await httpClient.get('/history');
  });
  await expect(page.getByText('No completed matches for these settings yet.')).toBeVisible();
});

test('empty and multi-page scenarios never delete or persist extra confirmed data', async ({ page }) => {
  await open(page); await finish(page);
  await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
  await page.getByText('Development / demo network scenarios', { exact: true }).click();
  await select(page, 'empty');
  expect((await request(page, 'history')).total).toBe(0);
  expect(await counts(page)).toEqual({ pending: 0, confirmed: 1 });
  await select(page, 'multiple_pages');
  expect((await request(page, 'history')).total).toBe(19);
  expect(await counts(page)).toEqual({ pending: 0, confirmed: 1 });
  await select(page, 'success');
  expect((await request(page, 'history')).total).toBe(4);
});

test('multiple-page ranking respects custom saved configuration', async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.setItem('pirate-battle:options:v1', JSON.stringify({ version: 1, sessionDuration: 60, enemySpawnInterval: 4 })));
  await select(page, 'multiple_pages');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Page 1 of 3 · 15 results · 5 per page')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 3 · 15 results · 5 per page')).toBeVisible();
});
