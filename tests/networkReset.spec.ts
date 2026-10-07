import { test, expect, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { networkInterfaces } from 'node:os';

const privateIp = Object.values(networkInterfaces()).flat().find(address => address?.family === 'IPv4'
  && !address.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address))?.address;
let server: ViteDevServer | undefined;
let lanUrl: string;
test.beforeAll(async () => {
  if (!privateIp) return;
  server = await createServer({ server: { host: '0.0.0.0', port: 0, https: undefined }, mode: 'test' });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('LAN test server has no port.');
  lanUrl = `http://${privateIp}:${address.port}`;
});
test.afterAll(async () => { await server?.close(); });

async function readState(page: Page) {
  return page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const moduleUrl = (path: string) => resources.find(entry => entry.name.includes(path))!.name;
    const { httpClient } = await import(moduleUrl('/src/api/client.ts'));
    const { DEFAULT_GAME_CONFIG } = await import(moduleUrl('/src/config/gameConfig.ts'));
    const { loadGameOptions } = await import(moduleUrl('/src/config/gameOptions.ts'));
    const { getGameConfigKey } = await import(moduleUrl('/src/config/gameConfigKey.ts'));
    const { getNetworkSelection } = await import(moduleUrl('/src/mocks/networkScenarios.ts'));
    const config = { ...DEFAULT_GAME_CONFIG, ...loadGameOptions() };
    const ranking = await httpClient.get('/ranking', { params: { pageSize: 100, configKey: getGameConfigKey(config) } });
    const history = await httpClient.get('/history', { params: { pageSize: 100, playerId: 'local-player' } });
    return { ranking: ranking.data, history: history.data, configKey: getGameConfigKey(config),
      fixtureConfigKey: getGameConfigKey(DEFAULT_GAME_CONFIG), selection: getNetworkSelection(),
      options: localStorage.getItem('pirate-battle:options:v1'),
      scenario: localStorage.getItem('pirate-battle:network-scenario:v1'),
      confirmed: localStorage.getItem('pirate-battle:confirmed-matches:v1'),
      pending: localStorage.getItem('pirate-battle:pending-matches:v1'),
      result: localStorage.getItem('pirate-battle:last-completed-match:v1') };
  });
}
async function reset(page: Page) {
  await page.getByText('Development / demo network scenarios', { exact: true }).click();
  await page.getByRole('button', { name: 'Reset network demo', exact: true }).click();
  await expect(page.getByText('Reset complete: initial fixtures restored; confirmed and pending matches cleared.', { exact: true })).toBeVisible();
}
async function finish(page: Page, score: number) {
  await page.getByRole('button', { name: /^(Start Game|Play Again)$/ }).click();
  await page.locator('canvas').waitFor();
  await page.evaluate(score => {
    const game = Reflect.get(window, 'resetGame');
    const state = game.getState(); state.score = score; state.enemiesDefeated = score; state.remainingSeconds = 0;
    Reflect.get(game, 'update').call(game, 1 / 60);
  }, score);
  await expect(page.getByRole('heading', { name: 'Match Results', exact: true })).toBeVisible();
}

for (const origin of ['desktop', 'phone LAN'] as const) {
  test.describe(origin, () => {
    if (origin === 'phone LAN') test.use({ viewport: { width: 1038, height: 487 }, isMobile: true, hasTouch: true });
    test('reset clears played matches from mock state and warm query caches while retaining baseline', async ({ page }) => {
      test.skip(origin === 'phone LAN' && !privateIp, 'Requires a real private LAN origin.');
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin === 'desktop' ? '/' : lanUrl);
      await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
      await page.evaluate(async (duration) => {
        localStorage.setItem('pirate-battle:options:v1', JSON.stringify({ version: 1, sessionDuration: duration, enemySpawnInterval: 3 }));
        const resources = performance.getEntriesByType('resource');
        const { Game } = await import(resources.find(entry => entry.name.includes('/src/game/core/Game.ts'))!.name);
        const original = Game.prototype.start;
        Game.prototype.start = function(config: unknown) { original.call(this, config); this.stop(); Object.assign(window, { resetGame: this }); };
        const { QueryClient } = await import(resources.find(entry => entry.name.includes('/deps/@tanstack_react-query'))!.name);
        const setData = QueryClient.prototype.setQueryData;
        QueryClient.prototype.setQueryData = function(...args: unknown[]) {
          Object.assign(window, { resetQueryClient: this }); return setData.apply(this, args);
        };
      }, origin === 'desktop' ? 60 : 120);
      await finish(page, 47);
      await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
      const before = await readState(page);
      const played = JSON.parse(before.confirmed!).records[0];
      await page.getByRole('button', { name: 'Ranking', exact: true }).click();
      await expect(page.getByRole('cell', { name: '47', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.getByRole('button', { name: 'Match History', exact: true }).click();
      await expect(page.locator('tbody tr').first().getByRole('cell', { name: '47', exact: true })).toHaveCount(2);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      // A second match fails, leaving both a genuine pending submission and a last local Result.
      await page.getByText('Development / demo network scenarios', { exact: true }).click();
      await page.getByLabel('Network scenario', { exact: true }).selectOption('unavailable');
      await page.getByLabel('Target endpoint', { exact: true }).selectOption('matches');
      await finish(page, 69);
      await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
      const beforeReset = await page.evaluate(() => ({ options: localStorage.getItem('pirate-battle:options:v1'),
        result: localStorage.getItem('pirate-battle:last-completed-match:v1'),
        pending: JSON.parse(localStorage.getItem('pirate-battle:pending-matches:v1')!).records }));
      expect(beforeReset.pending).toHaveLength(1);
      await reset(page);
      const after = await readState(page);
      expect(after.selection).toEqual({ scenario: 'success', target: 'all' });
      expect(JSON.parse(after.scenario!)).toEqual({ version: 1, scenario: 'success', target: 'all' });
      expect(after.confirmed).toBeNull();
      expect(JSON.parse(after.pending!).records).toEqual([]);
      expect(after.options).toBe(beforeReset.options);
      expect(after.result).toBe(beforeReset.result);
      expect(after.ranking.total).toBe(origin === 'desktop' ? 0 : 11);
      expect(after.history.total).toBe(3);
      expect([...after.ranking.items, ...after.history.items].map((record: { matchId: string }) => record.matchId)).not.toContain(played.matchId);
      const caches = await page.evaluate(() => {
        const client = Reflect.get(window, 'resetQueryClient');
        return { ranking: client.getQueriesData({ queryKey: ['ranking'] }), history: client.getQueriesData({ queryKey: ['history'] }) };
      });
      // Merely invalidating inactive queries retains pre-reset data until a successful fetch.
      expect(caches).toEqual({ ranking: [], history: [] });
      // If the first post-reset fetch fails, deleted rows must not survive on either screen.
      await page.getByLabel('Network scenario', { exact: true }).selectOption('http_5xx');
      await expect(page.getByText('Scenario saved. Request sequences restarted.', { exact: true })).toBeVisible();
      for (const screen of ['Ranking', 'Match History']) {
        await page.getByRole('button', { name: screen, exact: true }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('cell', { name: '47', exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Back', exact: true }).click();
      }
      await page.getByText('Development / demo network scenarios', { exact: true }).click();
      await page.getByLabel('Network scenario', { exact: true }).selectOption('success');
      await expect(page.getByText('Scenario saved. Request sequences restarted.', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Ranking', exact: true }).click();
      await expect(page.getByText(origin === 'desktop' ? 'No completed matches for these settings yet.' : 'Page 1 of 3 · 11 results · 5 per page', { exact: true })).toBeVisible();
      await expect(page.getByRole('cell', { name: '47', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.getByRole('button', { name: 'Match History', exact: true }).click();
      await expect(page.locator('tbody tr')).toHaveCount(3);
      await expect(page.getByRole('cell', { name: '47', exact: true })).toHaveCount(0);
      await page.reload();
      const reloaded = await readState(page);
      expect(reloaded.ranking).toEqual(after.ranking);
      expect(reloaded.history).toEqual(after.history);
      expect(errors).toEqual([]);
    });
  });
}

test('clean Success/All/default baseline is identical on localhost and actual HTTP LAN; custom Options explain fixture filtering', async ({ browser }) => {
  test.skip(!privateIp, 'Requires a real private LAN origin.');
  const desktop = await browser.newContext();
  const phone = await browser.newContext({ viewport: { width: 1038, height: 487 }, isMobile: true, hasTouch: true });
  try {
    const pc = await desktop.newPage(); const mobile = await phone.newPage();
    const port = new URL(lanUrl).port;
    await pc.goto(`http://localhost:${port}`); await mobile.goto(lanUrl);
    for (const page of [pc, mobile]) {
      await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
      await reset(page);
    }
    const pcState = await readState(pc); const phoneState = await readState(mobile);
    expect(pcState.selection).toEqual({ scenario: 'success', target: 'all' });
    expect(phoneState.selection).toEqual(pcState.selection);
    expect(pcState.configKey).toBe(pcState.fixtureConfigKey);
    expect(phoneState.configKey).toBe(pcState.configKey);
    expect(phoneState.ranking).toEqual(pcState.ranking);
    expect(phoneState.history).toEqual(pcState.history);
    expect(pcState.ranking.total).toBe(11); expect(pcState.history.total).toBe(3);
    await pc.evaluate(() => localStorage.setItem('pirate-battle:options:v1', JSON.stringify({ version: 1, sessionDuration: 60, enemySpawnInterval: 3 })));
    const custom = await readState(pc);
    expect(custom.configKey).not.toBe(pcState.fixtureConfigKey);
    expect(custom.ranking.total).toBe(0);
    expect((await readState(mobile)).ranking.total).toBe(11);
    expect(custom.history).toEqual(pcState.history);
  } finally { await desktop.close(); await phone.close(); }
});
