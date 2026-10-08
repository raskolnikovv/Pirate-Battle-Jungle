import { test, expect, type Page } from '@playwright/test';

const pendingKey = 'pirate-battle:pending-matches:v1';
const confirmedKey = 'pirate-battle:confirmed-matches:v1';

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource')
      .find((entry) => entry.name.includes('/src/game/core/Game.ts'))?.name;
    if (!path) throw new Error('Game module not found.');
    const { Game } = await import(path);
    const start = Game.prototype.start;
    Game.prototype.start = function (config: unknown) {
      start.call(this, config);
      Object.assign(window, { testGame: this });
    };
  });
}

async function finishMatch(page: Page, score = 1) {
  await page.getByRole('button', { name: /^(Start Game|Play Again)$/ }).click();
  await page.locator('canvas').waitFor();
  await page.evaluate((points) => {
    const state = Reflect.get(window, 'testGame').getState();
    state.score = points;
    state.enemiesDefeated = points;
    state.remainingSeconds = 1 / 60;
  }, score);
  await expect(page.getByRole('heading', { name: 'Match Results', exact: true })).toBeVisible();
}

async function setPostScenario(page: Page, scenario: 'fail' | 'lost-response' | 'conflict' | 'slow-success' | 'wrong-receipt' | 'normal') {
  await page.evaluate(async (mode) => {
    const resources = performance.getEntriesByType('resource');
    const workerPath = resources.find((entry) => entry.name.includes('/src/mocks/browser.ts'))?.name;
    const mswPath = resources.find((entry) => entry.name.includes('/deps/msw.js'))?.name;
    const statePath = resources.find((entry) => entry.name.includes('/src/mocks/matchHistoryState.ts'))?.name;
    if (!workerPath || !mswPath || !statePath) throw new Error('Loaded mock modules not found.');
    const { worker } = await import(workerPath);
    if (mode === 'normal') { worker.resetHandlers(); return; }
    const { http, HttpResponse, delay } = await import(mswPath);
    const { registerMockMatch } = await import(statePath);
    worker.use(http.post('/api/matches', async ({ request }: { request: Request }) => {
      const payload = await request.json();
      const stored = JSON.parse(localStorage.getItem('pirate-battle:pending-matches:v1') ?? 'null');
      Object.assign(window, {
        pendingSavedBeforePost: stored?.records.some((record: { matchId: string }) => record.matchId === payload.matchId),
        testPostCount: (Reflect.get(window, 'testPostCount') ?? 0) + 1,
      });
      if (mode === 'fail') return HttpResponse.json({ message: 'Simulated failure' }, { status: 503 });
      if (mode === 'wrong-receipt') return HttpResponse.json({ ...payload, score: payload.score + 1 });
      if (mode === 'conflict') {
        registerMockMatch({ ...payload, score: payload.score + 1, enemiesDefeated: payload.enemiesDefeated + 1 });
        return HttpResponse.json({ message: 'Conflict' }, { status: 409 });
      }
      if (mode === 'slow-success') await delay(250);
      const result = registerMockMatch(payload);
      if (mode === 'lost-response') return HttpResponse.error();
      return HttpResponse.json(result.record, { status: result.status === 'created' ? 201 : 200 });
    }));
  }, scenario);
}

async function pendingRecords(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"records":[]}').records, pendingKey);
}

test('failed submission is saved before POST, survives refresh, and retries explicitly', async ({ page }) => {
  let posts = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/matches') && request.method() === 'POST') posts += 1; });
  await openApp(page);
  await setPostScenario(page, 'fail');
  await finishMatch(page);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, 'pendingSavedBeforePost'))).toBe(true);
  const records = await pendingRecords(page);
  expect(records).toHaveLength(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), confirmedKey)).toBeNull();
  await page.reload();
  await expect(page.getByText('Registration: Pending registration', { exact: true })).toBeVisible();
  expect(posts).toBe(1);
  expect(await pendingRecords(page)).toEqual(records);
  // Saved Options must never replace the pending match's original snapshot.
  await page.evaluate(() => localStorage.setItem('pirate-battle:options:v1', JSON.stringify({ version: 1, sessionDuration: 60, enemySpawnInterval: 4 })));
  await page.getByRole('button', { name: 'Retry registration', exact: true }).click();
  await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
  expect(await pendingRecords(page)).toEqual([]);
  const confirmed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).records, confirmedKey);
  expect(confirmed).toEqual(records);
  expect(posts).toBe(2);
});

test('already accepted match with lost response retries without duplication', async ({ page }) => {
  await openApp(page);
  await setPostScenario(page, 'lost-response');
  await finishMatch(page, 2);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  const records = await pendingRecords(page);
  expect(records).toHaveLength(1);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).records.length, confirmedKey)).toBe(1);
  await page.reload();
  await expect(page.getByText('Registration: Pending registration', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry registration', exact: true }).click();
  await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
  expect(await pendingRecords(page)).toEqual([]);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).records, confirmedKey)).toEqual(records);
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Page 1 of 3 · 12 results · 5 per page', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('Page 1 of 1 · 1 results · 5 per page', { exact: true })).toBeVisible();
});

test('multiple pending matches coexist and older ones can retry from Main Menu', async ({ page }) => {
  await openApp(page);
  await setPostScenario(page, 'fail');
  await finishMatch(page, 1);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  await finishMatch(page, 2);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  const records = await pendingRecords(page);
  expect(records).toHaveLength(2);
  expect(records[0].matchId).not.toBe(records[1].matchId);
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await expect(page.getByText('2 completed matches awaiting registration.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('2 completed matches awaiting registration.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry registration', exact: true }).first().click();
  await expect(page.getByText('1 completed match awaiting registration.', { exact: true })).toBeVisible();
  expect(await pendingRecords(page)).toEqual([records[1]]);
  await page.getByRole('button', { name: 'Retry registration', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pending match submissions' })).toHaveCount(0);
  expect(await pendingRecords(page)).toEqual([]);
});

test('a successful new match does not remove an older pending submission', async ({ page }) => {
  await openApp(page);
  await setPostScenario(page, 'fail');
  await finishMatch(page, 1);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  const older = await pendingRecords(page);
  await setPostScenario(page, 'normal');
  await finishMatch(page, 2);
  await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
  expect(await pendingRecords(page)).toEqual(older);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).records.length, confirmedKey)).toBe(1);
});

test('conflict keeps the original pending payload and exposes the reason', async ({ page }) => {
  await openApp(page);
  await setPostScenario(page, 'conflict');
  await finishMatch(page, 1);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  const records = await pendingRecords(page);
  await page.reload();
  await expect(page.getByText('Registration: Pending registration', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry registration', exact: true }).click();
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').first()).toContainText('conflicts with an existing record');
  expect(await pendingRecords(page)).toEqual(records);
});

test('repeated retry clicks share a single POST and clear pending on success', async ({ page }) => {
  await openApp(page);
  await setPostScenario(page, 'fail');
  await finishMatch(page);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  await page.evaluate(() => Object.assign(window, { testPostCount: 0 }));
  await setPostScenario(page, 'slow-success');
  await page.getByRole('button', { name: 'Retry registration', exact: true }).evaluate((button: HTMLButtonElement) => {
    button.click(); button.click(); button.click();
  });
  await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, 'testPostCount'))).toBe(1);
  expect(await pendingRecords(page)).toEqual([]);
});

test('a mismatched successful response does not remove the pending payload', async ({ page }) => {
  await openApp(page);
  await setPostScenario(page, 'wrong-receipt');
  await finishMatch(page);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  expect(await pendingRecords(page)).toHaveLength(1);
});

test('pending storage write failure stops POST and retains an explicit session warning', async ({ page }) => {
  let posts = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/matches') && request.method() === 'POST') posts += 1; });
  await openApp(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Denied', 'QuotaExceededError');
      original.call(this, name, value);
    };
  }, pendingKey);
  await finishMatch(page);
  await expect(page.getByText('Registration: Submission failed', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').first()).toContainText('Keep this page open and retry');
  expect(posts).toBe(0);
  await expect(page.getByRole('button', { name: 'Play Again', exact: true })).toBeEnabled();
});

test('failed pending cleanup keeps the confirmed payload retryable without duplication', async ({ page }) => {
  await openApp(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Object.assign(window, { originalPendingSetItem: original });
    Storage.prototype.setItem = function (name, value) {
      if (name === key && JSON.parse(value).records.length === 0) {
        throw new DOMException('Denied', 'QuotaExceededError');
      }
      original.call(this, name, value);
    };
  }, pendingKey);
  await finishMatch(page);
  await expect(page.getByText('Registration: Submitted', { exact: true })).toBeVisible();
  const records = await pendingRecords(page);
  expect(records).toHaveLength(1);
  await expect(page.getByText('Confirmed by the API; pending storage cleanup still needs retry.', { exact: true })).toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = Reflect.get(window, 'originalPendingSetItem'); });
  await page.getByRole('button', { name: 'Retry registration', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pending match submissions' })).toHaveCount(0);
  expect(await pendingRecords(page)).toEqual([]);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).records, confirmedKey)).toEqual(records);
});

test('abandoning a match never creates a pending entry', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await page.locator('canvas').waitFor();
  await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pirate Battle', exact: true })).toBeVisible();
  expect(await pendingRecords(page)).toEqual([]);
});

for (const raw of ['{broken', '{"version":99,"records":[]}', '{"version":1,"records":[{"matchId":"bad"}]}']) {
  test(`corrupt pending storage is safe: ${raw}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: pendingKey, value: raw });
    await openApp(page);
    await expect(page.getByRole('alert')).toContainText('No saved data was sent');
    await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}
