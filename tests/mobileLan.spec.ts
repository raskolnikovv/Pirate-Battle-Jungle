import { test, expect, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { networkInterfaces } from 'node:os';

const lanAddress = Object.values(networkInterfaces()).flat().find(address => address?.family === 'IPv4'
  && !address.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address))?.address;

async function prepareGame(page: Page) {
  await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
  await page.evaluate(async () => {
    localStorage.setItem('pirate-battle:options:v1', JSON.stringify({ version: 1, sessionDuration: 60, enemySpawnInterval: 3 }));
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/Game.ts'))!.name;
    const { Game } = await import(path);
    const original = Game.prototype.start;
    Game.prototype.start = function(config: unknown) {
      original.call(this, config); this.stop(); Object.assign(window, { lanGame: this });
    };
  });
}

test.describe('real insecure LAN origin', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  let server: ViteDevServer;
  let url: string;
  test.beforeAll(async () => {
    test.skip(!lanAddress, 'Requires a private LAN IPv4 address to exercise an actual insecure origin.');
    server = await createServer({ server: { host: '0.0.0.0', port: 0, https: undefined }, mode: 'test' });
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === 'string') throw new Error('LAN test server has no port.');
    url = `http://${lanAddress}:${address.port}`;
  });
  test.afterAll(async () => { await server?.close(); });

  for (const reason of ['time_expired', 'player_defeated'] as const) {
    test(`local ${reason} opens Result and confirms through MSW fallback without Service Workers`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      // Do not mock these capabilities: HTTP LAN really lacks both APIs.
      expect(await page.evaluate(() => ({ secure: isSecureContext,
        uuid: typeof crypto.randomUUID, worker: typeof navigator.serviceWorker })))
        .toEqual({ secure: false, uuid: 'undefined', worker: 'undefined' });
      await prepareGame(page);
      await page.getByRole('button', { name: 'Start Game', exact: true }).click();
      await page.locator('canvas').waitFor();
      await page.evaluate(reason => {
        const game = Reflect.get(window, 'lanGame');
        if (reason === 'time_expired') game.getState().remainingSeconds = 0;
        else game.getState().players.values().next().value.health = 0;
        Reflect.get(game, 'update').call(game, 1 / 60);
      }, reason);
      await expect(page.getByRole('heading', { name: 'Match Results', exact: true })).toBeVisible();
      await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
      const confirmed = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle:confirmed-matches:v1')!).records);
      expect(confirmed).toHaveLength(1);
      expect(confirmed[0].matchId).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
      expect(confirmed[0].endReason).toBe(reason);
      const returned = await page.evaluate(async record => {
        const resources = performance.getEntriesByType('resource');
        const { httpClient } = await import(resources.find(e => e.name.includes('/src/api/client.ts'))!.name);
        const { getGameConfigKey } = await import(resources.find(e => e.name.includes('/src/config/gameConfigKey.ts'))!.name);
        const history = await httpClient.get('/history', { params: { playerId: record.playerId, pageSize: 100 } });
        const ranking = await httpClient.get('/ranking', { params: { configKey: getGameConfigKey(record.config), pageSize: 100 } });
        const incompatible = await httpClient.get('/ranking', { params: {
          configKey: getGameConfigKey({ ...record.config, sessionDuration: record.config.sessionDuration + 1 }), pageSize: 100,
        } });
        return { history: history.data.items.find((entry: { matchId: string }) => entry.matchId === record.matchId),
          ranking: ranking.data.items.find((entry: { matchId: string }) => entry.matchId === record.matchId),
          incompatibleIds: incompatible.data.items.map((entry: { matchId: string }) => entry.matchId) };
      }, confirmed[0]);
      expect(returned.history).toEqual(confirmed[0]);
      expect(returned.ranking).toMatchObject(confirmed[0]);
      expect(returned.incompatibleIds).not.toContain(confirmed[0].matchId);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Match Results', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Ranking', exact: true }).click();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expect(page.getByRole('cell', { name: /Captain/ }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.getByRole('button', { name: 'Match History', exact: true }).click();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      expect(errors).toEqual([]);
    });
  }

  test('Result and pending submission survive a genuine worker startup failure', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await prepareGame(page);
    await page.evaluate(async () => {
      const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/mocks/browser.ts'))!.name;
      const { worker } = await import(path);
      await worker.stop();
      worker.start = async () => { throw new Error('Worker startup unavailable for test.'); };
    });
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await page.locator('canvas').waitFor();
    await page.evaluate(() => {
      const game = Reflect.get(window, 'lanGame'); game.getState().remainingSeconds = 0;
      Reflect.get(game, 'update').call(game, 1 / 60);
    });
    await expect(page.getByRole('heading', { name: 'Match Results', exact: true })).toBeVisible();
    await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle:pending-matches:v1')!).records.length)).toBe(1);
    // Refresh restores the actual worker; it must not automatically retry the pending match.
    await page.reload();
    await expect(page.getByText('Registration: Pending registration', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test('submission, ranking and history requests remain on the current origin', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url()); });
  await page.goto('/');
  await prepareGame(page);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await page.locator('canvas').waitFor();
  await page.evaluate(() => {
    const game = Reflect.get(window, 'lanGame'); game.getState().remainingSeconds = 0;
    Reflect.get(game, 'update').call(game, 1 / 60);
  });
  await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  for (const path of ['/api/matches', '/api/ranking', '/api/history']) {
    expect(requests.some(url => new URL(url).pathname === path)).toBe(true);
  }
  expect(requests.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
});
