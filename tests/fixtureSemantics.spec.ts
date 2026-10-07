import { test, expect, type Page } from '@playwright/test';
import type { MatchHistoryRecord } from '../src/api/matchContracts';
import type { RankingEntry } from '../src/api/rankingContracts';

async function readBaseline(page: Page, playerId = 'local-player'): Promise<{ history: MatchHistoryRecord[]; ranking: RankingEntry[] }> {
  return page.evaluate(async playerId => {
    const resources = performance.getEntriesByType('resource');
    const { httpClient } = await import(resources.find(e => e.name.includes('/src/api/client.ts'))!.name);
    const { DEFAULT_GAME_CONFIG } = await import(resources.find(e => e.name.includes('/src/config/gameConfig.ts'))!.name);
    const { getGameConfigKey } = await import(resources.find(e => e.name.includes('/src/config/gameConfigKey.ts'))!.name);
    const history = await httpClient.get('/history', { params: { playerId, pageSize: 100 } });
    const ranking = await httpClient.get('/ranking', { params: { configKey: getGameConfigKey(DEFAULT_GAME_CONFIG), pageSize: 100 } });
    return { history: history.data.items, ranking: ranking.data.items };
  }, playerId);
}

test('Success seeds local history and named competitors without exposing internal player IDs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ranking', exact: true }).waitFor();
  const baseline = await readBaseline(page);
  expect(baseline.history).toHaveLength(3);
  expect(baseline.history.every(record => record.playerId === 'local-player' && record.playerName === 'Captain')).toBe(true);
  expect(baseline.ranking).toHaveLength(11);
  const competitors = baseline.ranking.filter(record => record.playerId !== 'local-player');
  expect(competitors).toHaveLength(8);
  expect(competitors.every(record => record.playerId.startsWith('fixture-player-') && !record.playerName.includes('fixture'))).toBe(true);
  const otherHistory = (await readBaseline(page, 'fixture-player-1')).history;
  expect(otherHistory).toHaveLength(1);
  expect(otherHistory.every(record => record.playerId === 'fixture-player-1')).toBe(true);
  expect((await readBaseline(page, 'unknown-player')).history).toEqual([]);
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Blackbeard', exact: true })).toBeVisible();
  for (let index = 0; index < 3; index++) {
    expect(await page.locator('tbody').innerText()).not.toMatch(/fixture-player|local-player/);
    if (index < 2) await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  for (const details of await page.locator('tbody details').all()) await details.locator('summary').click();
  await expect(page.getByText('Player: Captain', { exact: true })).toHaveCount(3);
  expect(await page.locator('tbody').innerText()).not.toMatch(/fixture-player|fixture-match|local-player|Blackbeard/);
});

test('multiple-page fixtures remain response-only and Reset restores persisted Success baseline', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Development / demo network scenarios', { exact: true }).click();
  await page.getByLabel('Network scenario', { exact: true }).selectOption('multiple_pages');
  await expect(page.getByText('Scenario saved. Request sequences restarted.', { exact: true })).toBeVisible();
  const multiple = await readBaseline(page);
  expect(multiple.history).toHaveLength(18);
  expect(multiple.history.every(record => record.playerId === 'local-player')).toBe(true);
  expect(multiple.ranking).toHaveLength(26);
  expect(multiple.history.filter(record => record.matchId.startsWith('scenario-page-'))).toHaveLength(15);
  await page.getByLabel('Network scenario', { exact: true }).selectOption('success');
  await expect.poll(async () => (await readBaseline(page)).history.length).toBe(3);
  const success = await readBaseline(page);
  expect(success.ranking).toHaveLength(11);
  expect([...success.ranking, ...success.history].some(record => record.matchId.startsWith('scenario-page-'))).toBe(false);
  await page.getByLabel('Network scenario', { exact: true }).selectOption('multiple_pages');
  await expect.poll(async () => (await readBaseline(page)).history.length).toBe(18);
  await page.getByRole('button', { name: 'Reset network demo', exact: true }).click();
  await expect(page.getByText('Reset complete: initial fixtures restored; confirmed and pending matches cleared.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Network scenario', { exact: true })).toHaveValue('success');
  await expect(page.getByLabel('Target endpoint', { exact: true })).toHaveValue('all');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle:network-scenario:v1')!)))
    .toEqual({ version: 1, scenario: 'success', target: 'all' });
  await page.reload();
  const reset = await readBaseline(page);
  expect(reset.history).toEqual(success.history);
  expect(reset.ranking).toEqual(success.ranking);
});
