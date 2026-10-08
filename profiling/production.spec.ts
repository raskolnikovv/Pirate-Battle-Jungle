import { expect, test, type Page, type CDPSession } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';

const evidence = process.env.PROFILE_EVIDENCE_DIR ?? 'profiling-results';
const spawnSeconds = Number(process.env.PROFILE_SPAWN_SECONDS ?? 15);
async function readProfile(page: Page, method: string) {
  return page.evaluate(name => Reflect.get(window, 'pirateProfile')[name](), method);
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  // Asset decode / WebGL initialization is setup, excluded from the gameplay clock.
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 30_000 });
  await page.bringToFront();
  if (await page.getByRole('button', { name: 'Resume', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect.poll(async () => (await readProfile(page, 'snapshot'))?.status).toBe('running');
}
async function prepare(page: Page, interval = spawnSeconds) {
  await page.goto('/'); await page.bringToFront();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Game session time', { exact: true }).fill('180');
  await page.getByLabel('Enemy spawn time', { exact: true }).fill(String(interval));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(async () => (await fetch('/api/mock-status')).json())).toEqual({ service: 'pirate-battle-msw' });
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/src/')))).toBe(false);
}
async function sail(page: Page, seconds: number) {
  const begin = Date.now();
  while ((Date.now() - begin) / 1000 < seconds) {
    const alive = await page.evaluate(() => {
      const profile = Reflect.get(window, 'pirateProfile'); const state = profile.snapshot();
      if (state?.status !== 'running' || !state.player) return false;
      const player = state.player;
      // A clockwise water route; the real rotation limit and collision systems remain active.
      const angle = Math.atan2((player.y - 300) / 110, (player.x - 490) / 150) + 0.45;
      const dx = 490 + 150 * Math.cos(angle) - player.x;
      const dy = 300 + 110 * Math.sin(angle) - player.y;
      const nearest = state.enemyShips.reduce((best: { x: number; y: number } | null, enemy: { x: number; y: number }) =>
        !best || Math.hypot(enemy.x - player.x, enemy.y - player.y) < Math.hypot(best.x - player.x, best.y - player.y)
          ? enemy : best, null);
      // Aim through normal gradual joystick steering; approach slowly while firing.
      const aimX = nearest ? nearest.x - player.x : dx;
      const aimY = nearest ? nearest.y - player.y : dy;
      const length = Math.hypot(aimX, aimY); const throttle = nearest ? 0.2 : 1;
      profile.steer(aimX / length * throttle, aimY / length * throttle); return true;
    });
    if (!alive) break;
    await page.waitForTimeout(200); // Real wall time / input sampling, never simulation acceleration.
  }
  return (Date.now() - begin) / 1000;
}
function stats(intervals: number[]) {
  const sorted = [...intervals].sort((a, b) => a - b);
  const sum = intervals.reduce((a, b) => a + b, 0);
  const percentile = (q: number) => sorted[Math.ceil(q * sorted.length) - 1] ?? null;
  return { frameSamples: intervals.length, averageFps: intervals.length * 1000 / sum,
    p95FrameMs: percentile(0.95), p99FrameMs: percentile(0.99),
    low1PercentFps: 1000 / (percentile(0.99) ?? Infinity), minimumIntervalFps: 1000 / (sorted.at(-1) ?? Infinity) };
}
async function environment(page: Page, interval = spawnSeconds) {
  const browserCdp = await page.context().browser()!.newBrowserCDPSession();
  const graphics = await browserCdp.send('SystemInfo.getInfo'); await browserCdp.detach();
  const canvasRenderer = await page.locator('canvas').evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl!.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string : null;
  });
  if (process.env.PROFILE_REQUIRE_GPU === '1') {
    expect(canvasRenderer).toMatch(/AMD|NVIDIA|Intel/i);
    expect(canvasRenderer).not.toMatch(/SwiftShader|llvmpipe|Microsoft Basic/i);
    expect(graphics.gpu.featureStatus?.webgl).toBe('enabled');
    expect(graphics.gpu.featureStatus?.gpu_compositing).toBe('enabled');
  }
  const files = readdirSync('dist/assets').filter(name => name.endsWith('.js')).sort();
  const hash = createHash('sha256'); for (const file of files) hash.update(readFileSync(`dist/assets/${file}`));
  return { date: new Date().toISOString(), os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, ramBytes: os.totalmem(),
    browser: page.context().browser()?.version(), headless: process.env.PROFILE_HEADED !== '1', measurementKind: 'desktop browser automation (not physical mobile)',
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    gitStatus: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }), productionJsSha256: hash.digest('hex'),
    display: await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight },
      screen: { width: screen.width, height: screen.height }, devicePixelRatio })),
    command: 'npm run build:profile && npm run profile', spawnSeconds: interval,
    channel: process.env.PROFILE_CHANNEL ?? 'default headless shell', canvasRenderer,
    graphics: { devices: graphics.gpu.devices, auxAttributes: graphics.gpu.auxAttributes, featureStatus: graphics.gpu.featureStatus } };
}
function save(key: string, value: unknown) {
  mkdirSync(evidence, { recursive: true });
  writeFileSync(`${evidence}/${key}.json`, JSON.stringify(value, null, 2));
}
async function resourceSample(page: Page, cdp: CDPSession) {
  await cdp.send('HeapProfiler.collectGarbage');
  const metrics = await cdp.send('Performance.getMetrics');
  const counters = await cdp.send('Memory.getDOMCounters');
  const listeners: Record<string, number> = {};
  for (const target of ['window', 'document']) {
    const evaluated = await cdp.send('Runtime.evaluate', { expression: target, objectGroup: 'profile-resources' });
    const result = await cdp.send('DOMDebugger.getEventListeners', { objectId: evaluated.result.objectId! });
    listeners[target] = result.listeners.length;
  }
  await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'profile-resources' });
  return { resources: await readProfile(page, 'resources'), ...counters,
    jsHeapUsedBytes: metrics.metrics.find((metric: { name: string }) => metric.name === 'JSHeapUsedSize')?.value ?? null,
    inspectedListeners: listeners };
}
test(process.env.PROFILE_ALLOW_EARLY_EXIT === '1'
  ? 'real production combat workload (early death recorded)'
  : '180 seconds of real production gameplay', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await prepare(page); await start(page); const env = await environment(page);
  const pilotWallSeconds = await sail(page, 190);
  const result = await readProfile(page, 'report');
  const measuredWallSeconds = result.wallSeconds;
  const output = { environment: env, measuredWallSeconds, pilotWallSeconds, ...result, statistics: stats(result.intervalsMs),
    errors };
  save('session', output);
  expect(errors).toEqual([]);
  if (process.env.PROFILE_ALLOW_EARLY_EXIT !== '1') {
    expect(result.final?.finishReason, 'Early death is evidence of an incomplete run, never a profiling pass').toBe('time_expired');
    expect(result.final.elapsedSeconds).toBe(180);
    expect(measuredWallSeconds).toBeGreaterThanOrEqual(180);
  }
  expect(result.droppedSamples).toBe(0);
  expect(output.maximumEnemies).toBeGreaterThan(0); expect(output.maximumProjectiles).toBeGreaterThan(0);
  expect(result.final.enemiesDefeated).toBeGreaterThan(0);
});
test('five real start play exit cleanup cycles', async ({ page, context }) => {
  await prepare(page, 3); let env: Awaited<ReturnType<typeof environment>> | null = null;
  const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
  // Load audio through trusted Options gestures before the baseline; the shared cache is intentional.
  const cycles: object[] = []; let baseline: object | null = null;
  for (let cycle = 1; cycle <= 5; cycle++) {
    await start(page);
    if (!baseline) { env = await environment(page, 3); baseline = await resourceSample(page, cdp); }
    const wallSeconds = await sail(page, 10);
    const played = await readProfile(page, 'report'); const during = await resourceSample(page, cdp);
    await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
    await expect.poll(async () => (await readProfile(page, 'resources')).canvasCount).toBe(0);
    // Short UI sounds can finish after navigation; they are not retained game voices.
    await expect.poll(async () => (await readProfile(page, 'resources')).audioVoices).toBe(0);
    const after = await resourceSample(page, cdp);
    cycles.push({ cycle, wallSeconds, final: played.final, during, after });
    save('cycles', { environment: env, baseline, cycles });
    expect(after.resources).toMatchObject({ activeGames: 0, canvasCount: 0, pixiDisplayObjects: 0,
      ownedGameplayTextures: 0, audioVoices: 0, oceanVoices: 0,
      lastCleanup: { displayObjectsRetained: 0, texturesRetained: 0, gameStateCleared: true } });
    expect(played.final.shotsCreated).toBeGreaterThan(0);
  }
  await page.waitForTimeout(5000);
  const idleAfter = await resourceSample(page, cdp);
  save('cycles', { environment: env, baseline, cycles, idleAfter });
  await cdp.detach();
});
