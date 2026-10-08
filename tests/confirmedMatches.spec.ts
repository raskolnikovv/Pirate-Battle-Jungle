import { test, expect, type Page } from '@playwright/test';
import type { MatchHistoryRecord } from '../src/api/matchContracts';

const storageKey = 'pirate-battle:confirmed-matches:v1';

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pirate Battle', exact: true })).toBeVisible();
}

async function sampleRecord(page: Page, matchId: string): Promise<MatchHistoryRecord> {
  return page.evaluate(async (id) => {
    const configPath = '/src/config/gameConfig.ts';
    const { DEFAULT_GAME_CONFIG } = await import(configPath);
    return {
      matchId: id, playerId: 'local-player', playerName: 'Captain',
      completedAt: '2026-10-06T12:00:00Z', score: 2, enemiesDefeated: 2,
      durationSeconds: 120, endReason: 'time_expired', playerHealth: 50,
      config: DEFAULT_GAME_CONFIG,
    };
  }, matchId);
}

async function postMatch(page: Page, record: MatchHistoryRecord) {
  return page.evaluate(async (payload) => {
    const path = performance.getEntriesByType('resource')
      .find((entry) => entry.name.includes('/src/api/client.ts'))?.name;
    if (!path) throw new Error('Loaded Axios client was not found.');
    const { httpClient } = await import(path);
    const response = await httpClient.post('/matches', payload, { validateStatus: () => true });
    return { status: response.status, data: response.data };
  }, record);
}

async function queryMatches(page: Page) {
  return page.evaluate(async () => {
    const path = performance.getEntriesByType('resource')
      .find((entry) => entry.name.includes('/src/api/endpoints.ts'))?.name;
    if (!path) throw new Error('Loaded API module was not found.');
    const { getHistory, getRanking } = await import(path);
    const configPath = '/src/config/gameConfig.ts';
    const keyPath = '/src/config/gameConfigKey.ts';
    const { DEFAULT_GAME_CONFIG } = await import(configPath);
    const { getGameConfigKey } = await import(keyPath);
    const history = await getHistory({ page: 1, pageSize: 100 });
    const ranking = await getRanking({ page: 1, pageSize: 100, configKey: getGameConfigKey(DEFAULT_GAME_CONFIG) });
    return { history, ranking };
  });
}

test('confirmed matches survive reload and duplicate submissions return the same record', async ({ page }) => {
  await openApp(page);
  const record = await sampleRecord(page, 'persistence-match');
  expect((await postMatch(page, record)).status).toBe(201);
  const duplicate = await postMatch(page, record);
  expect(duplicate.status).toBe(200);
  expect(duplicate.data).toEqual(record);
  const reorderedConfig = Object.fromEntries(Object.entries(record.config).reverse()) as unknown as MatchHistoryRecord['config'];
  expect((await postMatch(page, { ...record, config: reorderedConfig })).status).toBe(200);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pirate Battle', exact: true })).toBeVisible();
  const afterReload = await postMatch(page, record);
  expect(afterReload.status).toBe(200);
  expect(afterReload.data).toEqual(record);
  const { history, ranking } = await queryMatches(page);
  expect(history.total).toBe(1);
  expect(ranking.total).toBe(12);
  expect(history.items.filter((item: MatchHistoryRecord) => item.matchId === record.matchId)).toEqual([record]);
  expect(ranking.items.filter((item: MatchHistoryRecord) => item.matchId === record.matchId)).toHaveLength(1);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(stored).toEqual({ version: 1, records: [record] });
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Page 1 of 3 · 12 results · 5 per page', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('Page 1 of 1 · 1 results · 5 per page', { exact: true })).toBeVisible();
});

test('conflicting IDs return 409 without replacing accepted data, including after reload', async ({ page }) => {
  await openApp(page);
  const record = await sampleRecord(page, 'conflict-match');
  expect((await postMatch(page, record)).status).toBe(201);
  for (const reload of [false, true]) {
    if (reload) {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Pirate Battle', exact: true })).toBeVisible();
    }
    expect((await postMatch(page, { ...record, score: 3, enemiesDefeated: 3 })).status).toBe(409);
    expect((await postMatch(page, { ...record, config: { ...record.config, enemySpawnInterval: 4 } })).status).toBe(409);
    const { history } = await queryMatches(page);
    expect(history.items.find((item: MatchHistoryRecord) => item.matchId === record.matchId)).toEqual(record);
  }
});

test('reset removes confirmed records and preserves fixtures and saved options', async ({ page }) => {
  await openApp(page);
  const record = await sampleRecord(page, 'reset-match');
  expect((await postMatch(page, record)).status).toBe(201);
  await page.evaluate(() => localStorage.setItem('pirate-battle:options:v1', JSON.stringify({
    version: 1, sessionDuration: 60, enemySpawnInterval: 3,
  })));
  const reset = await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource')
      .find((entry) => entry.name.includes('/src/mocks/matchHistoryState.ts'))?.name;
    if (!path) throw new Error('Loaded mock state was not found.');
    const { resetConfirmedMockMatches } = await import(path);
    return resetConfirmedMockMatches();
  });
  expect(reset).toBe(true);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('pirate-battle:options:v1'))).not.toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pirate Battle', exact: true })).toBeVisible();
  const { history, ranking } = await queryMatches(page);
  expect(history.total).toBe(0);
  expect(ranking.total).toBe(11);
});

test('storage write failure does not confirm or add a match in memory', async ({ page }) => {
  await openApp(page);
  const record = await sampleRecord(page, 'storage-failure-match');
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage quota exceeded.', 'QuotaExceededError');
      original.call(this, name, value);
    };
  }, storageKey);
  expect((await postMatch(page, record)).status).toBe(503);
  const { history, ranking } = await queryMatches(page);
  expect(history.total).toBe(0);
  expect(ranking.total).toBe(11);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

test('unavailable confirmed storage does not prevent startup or fixture queries', async ({ page }) => {
  await page.addInitScript((key) => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (name === key) throw new DOMException('Storage access denied.', 'SecurityError');
      return original.call(this, name);
    };
  }, storageKey);
  await openApp(page);
  const { history, ranking } = await queryMatches(page);
  expect(history.total).toBe(0);
  expect(ranking.total).toBe(11);
});

for (const invalid of ['malformed JSON', 'wrong version', 'invalid record', 'duplicate IDs', 'fixture collision']) {
  test(`invalid confirmed storage falls back to fixtures: ${invalid}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openApp(page);
    const record = await sampleRecord(page, 'corrupt-match');
    const raw = invalid === 'malformed JSON' ? '{broken'
      : invalid === 'wrong version' ? JSON.stringify({ version: 99, records: [record] })
      : invalid === 'invalid record' ? JSON.stringify({ version: 1, records: [{ ...record, endReason: 'quit' }] })
      : invalid === 'duplicate IDs' ? JSON.stringify({ version: 1, records: [record, record] })
      : JSON.stringify({ version: 1, records: [{ ...record, matchId: 'fixture-match-001' }] });
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: raw });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Pirate Battle', exact: true })).toBeVisible();
    const { history, ranking } = await queryMatches(page);
    expect(history.total).toBe(0);
    expect(ranking.total).toBe(11);
    expect(errors).toEqual([]);
  });
}
