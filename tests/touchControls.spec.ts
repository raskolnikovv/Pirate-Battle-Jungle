import { test, expect, type Page, type CDPSession, type Locator } from '@playwright/test';

type Point = { id: number; x: number; y: number; radiusX: number; radiusY: number; force: number };
class Fingers {
  private points = new Map<number, Point>();
  constructor(private session: CDPSession, private page: Page) {}
  async down(id: number, target: Locator, dx = 0, dy = 0) {
    const rect = await target.boundingBox();
    if (!rect) throw new Error('Touch target not visible');
    this.points.set(id, { id, x: rect.x + rect.width / 2 + dx, y: rect.y + rect.height / 2 + dy, radiusX: 2, radiusY: 2, force: 1 });
    await this.session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [...this.points.values()] });
    await this.flush();
  }
  async move(id: number, dx: number, dy: number) {
    const point = this.points.get(id)!; point.x += dx; point.y += dy;
    await this.session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [...this.points.values()] });
    await this.flush();
  }
  async up(id: number) {
    const released = this.points.get(id)!;
    this.points.delete(id);
    await this.session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [released] });
    await this.flush();
  }
  private async flush() {
    await this.page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
  async cancel() {
    this.points.clear();
    await this.session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await this.flush();
  }
}
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).waitFor();
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').find(e => e.name.includes('/src/game/core/Game.ts'))!.name;
    const { Game } = await import(path);
    const original = Game.prototype.start;
    Game.prototype.start = function(config: unknown) {
      original.call(this, config); this.stop(); Object.assign(window, { touchGame: this });
    };
    // Preserve real pointer IDs for focused cancellation/capture tests.
    document.addEventListener('pointerdown', event => {
      const element = event.target as HTMLElement;
      const label = element.closest('button')?.getAttribute('aria-label');
      if (label) Object.assign(window, { [label]: event.pointerId });
    }, true);
  });
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await page.locator('canvas').waitFor();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
}
async function inspect(page: Page) {
  return page.evaluate(() => {
    const game = Reflect.get(window, 'touchGame');
    const state = game.getState(); const player = state.players.values().next().value;
    return { x: player.x, y: player.y, rotation: player.rotation, remaining: state.remainingSeconds,
      status: state.status, rotationSpeed: Reflect.get(game, 'configSnapshot').playerRotationSpeed,
      movementSpeed: Reflect.get(game, 'configSnapshot').playerMovementSpeed, inputs: Reflect.get(game, 'input').snapshot(),
      cooldowns: { ...state.weaponCooldowns }, nextProjectileId: state.nextProjectileId,
      projectiles: Array.from(state.projectiles.values(), (p: { rotation: number }) => p.rotation) };
  });
}
async function advance(page: Page, steps = 12) {
  await page.evaluate((steps) => {
    const game = Reflect.get(window, 'touchGame');
    for (let step = 0; step < steps; step++) Reflect.get(game, 'update').call(game, 1 / 60);
  }, steps);
}
function angleDifference(target: number, current: number) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}
async function placeShip(page: Page, rotation: number) {
  await page.evaluate(rotation => {
    const player = Reflect.get(window, 'touchGame').getState().players.values().next().value;
    // Keep the real simulation clear of the island while measuring steering.
    player.x = 480; player.y = 330; player.rotation = rotation;
  }, rotation);
}
const neutral = { touchDirection: null, forward: false, turnLeft: false, turnRight: false, fireFront: false, fireLeft: false, fireRight: false };

test.describe('mobile touch gameplay', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('landscape maximizes the arena with a compact semantic HUD and clean joystick', async ({ page }) => {
    await start(page);
    await expect(page.locator('#touch-instructions')).toHaveText('Drag to steer');
    await expect(page.locator('.joystick-directions')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Move and steer' })).toHaveText('');
    for (const viewport of [{ width: 1038, height: 487 }, { width: 844, height: 390 }, { width: 740, height: 360 },
      { width: 667, height: 375 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport);
      const canvas = (await page.locator('canvas').boundingBox())!;
      const header = (await page.locator('.game-header').boundingBox())!;
      expect(header.height).toBeLessThanOrEqual(52);
      expect(canvas.height).toBeGreaterThan(viewport.height * (viewport.width >= 700 ? 0.7 : 0.4));
      expect(canvas.width / canvas.height).toBeCloseTo(1.6, 1);
      if (viewport.width >= 700) {
        const joystickGroup = (await page.locator('.touch-movement').boundingBox())!;
        expect(Math.abs(joystickGroup.y + joystickGroup.height / 2 - canvas.y - canvas.height / 2)).toBeLessThanOrEqual(2);
      }
      for (const button of ['Move and steer', 'Front shot', 'Left broadside', 'Right broadside', 'Pause', 'Quit Match']) {
        const bounds = (await page.getByRole('button', { name: button, exact: true }).boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        if (!['Pause', 'Quit Match'].includes(button)) expect(bounds.y).toBeGreaterThanOrEqual(header.height);
        if (viewport.width >= 700 && button === 'Move and steer') {
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(canvas.x);
          expect(canvas.x - bounds.x - bounds.width).toBeLessThan(30);
        } else if (viewport.width >= 700 && ['Front shot', 'Left broadside', 'Right broadside'].includes(button)) {
          expect(bounds.x).toBeGreaterThanOrEqual(canvas.x + canvas.width);
          expect(bounds.x - canvas.x - canvas.width).toBeLessThan(30);
        } else if (!['Pause', 'Quit Match'].includes(button)) {
          expect(bounds.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
        }
      }
      const overflow = await page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth,
        y: document.documentElement.scrollHeight > innerHeight }));
      expect(overflow).toEqual({ x: false, y: false });
      await expect(page.locator('.match-hud').getByText('Health (HP)', { exact: true })).toHaveCount(1);
      await expect(page.locator('.match-hud').getByText('Score', { exact: true })).toHaveCount(1);
      await expect(page.locator('.match-hud').getByText('Remaining time', { exact: true })).toHaveCount(1);
      await expect(page.locator('.match-hud [role="status"]')).toHaveText('Playing');
    }
  });

  test('landscape side regions retain independent movement and attack pointers', async ({ page }) => {
    await page.setViewportSize({ width: 1038, height: 487 });
    await start(page);
    const fingers = new Fingers(await page.context().newCDPSession(page), page);
    await fingers.down(1, page.getByRole('button', { name: 'Move and steer', exact: true }), 25, -25);
    await fingers.down(2, page.getByRole('button', { name: 'Front shot', exact: true }));
    const before = await inspect(page);
    expect(before.inputs.touchDirection).not.toBeNull();
    expect(before.inputs.fireFront).toBe(true);
    await advance(page, 12);
    const moved = await inspect(page);
    expect(moved.rotation).toBeGreaterThan(before.rotation);
    expect(moved.y).toBeLessThan(before.y);
    expect(moved.nextProjectileId).toBeGreaterThan(before.nextProjectileId);
    await fingers.up(2);
    expect((await inspect(page)).inputs.fireFront).toBe(false);
    expect((await inspect(page)).inputs.touchDirection).not.toBeNull();
    await fingers.up(1);
    expect((await inspect(page)).inputs).toEqual(neutral);
  });

  for (const [label, angle] of [
    ['up', 0], ['upper-right', Math.PI / 4], ['right', Math.PI / 2], ['lower-right', 3 * Math.PI / 4],
    ['down', Math.PI], ['lower-left', -3 * Math.PI / 4], ['left', -Math.PI / 2], ['upper-left', -Math.PI / 4],
  ] as const) {
    test(`joystick ${label} gradually turns and sails forward toward the desired heading`, async ({ page }) => {
      await start(page);
      await placeShip(page, 0);
      const fingers = new Fingers(await page.context().newCDPSession(page), page);
      const joystick = page.getByRole('button', { name: 'Move and steer', exact: true });
      await fingers.down(1, joystick, Math.sin(angle) * 40, -Math.cos(angle) * 40);
      const pointed = await inspect(page);
      expect(pointed.rotation).toBe(0); // Pointer input alone cannot rotate the ship.
      expect(pointed.inputs.forward).toBe(false);
      const direction = pointed.inputs.touchDirection;
      const desired = Math.atan2(direction.x, -direction.y);
      expect(Math.abs(angleDifference(desired, angle))).toBeLessThan(0.04);
      await advance(page, 1);
      const firstStep = await inspect(page);
      expect(Math.abs(firstStep.rotation)).toBeLessThanOrEqual(firstStep.rotationSpeed / 60 + 1e-9);
      if (Math.abs(angle) > 0.1) expect(Math.abs(angleDifference(desired, firstStep.rotation))).toBeGreaterThan(0.1);
      await advance(page, 90);
      const aligned = await inspect(page);
      expect(Math.abs(angleDifference(desired, aligned.rotation))).toBeLessThanOrEqual(0.011);
      await advance(page, 6);
      const sailed = await inspect(page);
      const distance = aligned.movementSpeed * Math.hypot(direction.x, direction.y) / 10;
      expect(sailed.x - aligned.x).toBeCloseTo(Math.sin(aligned.rotation) * distance, 5);
      expect(sailed.y - aligned.y).toBeCloseTo(-Math.cos(aligned.rotation) * distance, 5);
      await fingers.up(1);
      const released = await inspect(page); await advance(page, 12);
      expect((await inspect(page)).inputs).toEqual(neutral);
      expect((await inspect(page)).x).toBe(released.x);
      expect((await inspect(page)).y).toBe(released.y);
      expect((await inspect(page)).rotation).toBe(released.rotation);
      await expect(joystick.locator('.joystick-thumb')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    });
  }

  test('radial dead zone, magnitude throttle, alignment tolerance and final bounded turn', async ({ page }) => {
    await start(page); await placeShip(page, 0);
    const fingers = new Fingers(await page.context().newCDPSession(page), page);
    const joystick = page.getByRole('button', { name: 'Move and steer', exact: true });
    const initial = await inspect(page);
    await fingers.down(1, joystick, 3, -3); await advance(page);
    expect((await inspect(page)).inputs).toEqual(neutral);
    expect((await inspect(page)).y).toBe(initial.y);
    await fingers.move(1, -3, -25);
    const half = await inspect(page); await advance(page, 12);
    expect(half.inputs.touchDirection.y).toBeLessThan(0);
    const throttle = Math.hypot(half.inputs.touchDirection.x, half.inputs.touchDirection.y);
    expect(throttle).toBeGreaterThan(0.22); expect(throttle).toBeLessThan(0.6);
    expect(half.y - (await inspect(page)).y).toBeCloseTo(half.movementSpeed * throttle * 0.2, 5);
    await placeShip(page, 0.004); await advance(page, 20);
    expect((await inspect(page)).rotation).toBe(0.004); // No jitter below ~0.57 degrees.
    await placeShip(page, -0.03); await advance(page, 1);
    expect((await inspect(page)).rotation).toBeCloseTo(0, 8); // Final correction cannot overshoot.
    await fingers.move(1, 0, -100);
    const full = (await inspect(page)).inputs.touchDirection;
    expect(Math.hypot(full.x, full.y)).toBeCloseTo(1);
    await fingers.up(1);
  });

  for (const [label, current, desired, sign] of [
    ['PI counterclockwise', -Math.PI + 0.1, Math.PI - 0.1, -1],
    ['PI clockwise', Math.PI - 0.1, -Math.PI + 0.1, 1],
    ['2PI clockwise', 2 * Math.PI - 0.1, 0.1, 1],
    ['2PI counterclockwise', 0.1, 2 * Math.PI - 0.1, -1],
  ] as const) {
    test(`shortest heading crosses ${label}`, async ({ page }) => {
      await start(page);
      await placeShip(page, current);
      const fingers = new Fingers(await page.context().newCDPSession(page), page);
      await fingers.down(1, page.getByRole('button', { name: 'Move and steer' }), Math.sin(desired) * 40, -Math.cos(desired) * 40);
      await advance(page, 1);
      const first = await inspect(page);
      expect(first.rotation - current).toBeCloseTo(sign * first.rotationSpeed / 60, 6);
      await advance(page, 10);
      const aligned = await inspect(page);
      const direction = aligned.inputs.touchDirection;
      expect(Math.abs(angleDifference(Math.atan2(direction.x, -direction.y), aligned.rotation))).toBeLessThan(0.011);
      await fingers.up(1);
    });
  }
  for (const [label, action, direction, count] of [
    ['Front shot', 'fireFront', 0, 1], ['Left broadside', 'fireLeft', -Math.PI / 2, 3], ['Right broadside', 'fireRight', Math.PI / 2, 3],
  ] as const) {
    test(`${label} maps to existing hold/cooldown semantics`, async ({ page }) => {
      await start(page); const fingers = new Fingers(await page.context().newCDPSession(page), page);
      const button = page.getByRole('button', { name: label, exact: true });
      await fingers.down(1, button); await expect(button).toHaveAttribute('data-pressed', 'true');
      expect((await inspect(page)).inputs[action]).toBe(true);
      await advance(page, 1); const fired = await inspect(page);
      expect(fired.projectiles).toHaveLength(count);
      for (const rotation of fired.projectiles) expect(rotation).toBeCloseTo(direction);
      await advance(page, 3); expect((await inspect(page)).nextProjectileId).toBe(fired.nextProjectileId);
      await advance(page, 70); expect((await inspect(page)).nextProjectileId).toBeGreaterThan(fired.nextProjectileId);
      await fingers.up(1); await expect(button).toHaveAttribute('data-pressed', 'false');
      const released = await inspect(page); await advance(page, 70);
      expect((await inspect(page)).nextProjectileId).toBe(released.nextProjectileId);
    });
  }

  test('independent fingers allow movement, steering and firing together', async ({ page }) => {
    await start(page); const fingers = new Fingers(await page.context().newCDPSession(page), page);
    await fingers.down(1, page.getByRole('button', { name: 'Move and steer' }), -25, -35);
    await fingers.down(2, page.getByRole('button', { name: 'Front shot', exact: true }));
    const before = await inspect(page); await advance(page);
    const combined = await inspect(page);
    expect(combined.y).toBeLessThan(before.y); expect(combined.rotation).toBeLessThan(before.rotation);
    expect(combined.nextProjectileId).toBeGreaterThan(before.nextProjectileId);
    await fingers.up(2);
    expect((await inspect(page)).inputs).toMatchObject({ forward: false, turnLeft: false, fireFront: false });
    expect((await inspect(page)).inputs.touchDirection).not.toBeNull();
    await fingers.down(3, page.getByRole('button', { name: 'Right broadside', exact: true }));
    await fingers.up(1);
    expect((await inspect(page)).inputs).toMatchObject({ touchDirection: null, forward: false, turnLeft: false, fireRight: true });
    await fingers.up(3); expect((await inspect(page)).inputs).toEqual(neutral);
  });

  test('pointercancel only clears affected input and lost capture releases joystick', async ({ page }) => {
    await start(page); const fingers = new Fingers(await page.context().newCDPSession(page), page);
    const joystick = page.getByRole('button', { name: 'Move and steer' });
    const attack = page.getByRole('button', { name: 'Front shot', exact: true });
    await fingers.down(1, joystick, 0, -35); await fingers.down(2, attack);
    const attackId = await page.evaluate(() => Reflect.get(window, 'Front shot'));
    await attack.dispatchEvent('pointercancel', { pointerId: attackId, pointerType: 'touch' });
    expect((await inspect(page)).inputs).toMatchObject({ forward: false, fireFront: false });
    expect((await inspect(page)).inputs.touchDirection).not.toBeNull();
    await fingers.move(1, 0, -12);
    await joystick.evaluate(button => button.releasePointerCapture(Reflect.get(window, 'Move and steer')));
    await fingers.move(1, 20, 0);
    expect((await inspect(page)).inputs).toEqual(neutral);
    await fingers.cancel();
  });

  test('pause freezes time and clears holds; resume needs a fresh touch', async ({ page }) => {
    await start(page); const fingers = new Fingers(await page.context().newCDPSession(page), page);
    await fingers.down(1, page.getByRole('button', { name: 'Move and steer' }), 0, -35);
    await fingers.down(2, page.getByRole('button', { name: 'Front shot', exact: true }));
    await advance(page);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const paused = await inspect(page); expect(paused.inputs).toEqual(neutral);
    await advance(page, 120); expect(await inspect(page)).toEqual(paused);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.evaluate(() => Reflect.get(window, 'touchGame').stop());
    const resumed = await inspect(page); await advance(page);
    expect((await inspect(page)).inputs).toEqual(neutral);
    expect((await inspect(page)).y).toBe(resumed.y);
    await fingers.move(1, 0, -20);
    expect((await inspect(page)).inputs).toEqual(neutral);
    await fingers.cancel();
    await fingers.down(3, page.getByRole('button', { name: 'Move and steer' }), 0, -35); await advance(page);
    expect((await inspect(page)).y).toBeLessThan(resumed.y); await fingers.up(3);
  });

  test('blur and hidden tab clear touch; leaving and restarting starts neutral', async ({ page }) => {
    await start(page); const fingers = new Fingers(await page.context().newCDPSession(page), page);
    await fingers.down(1, page.getByRole('button', { name: 'Move and steer' }), 0, -35);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('dialog')).toBeVisible(); expect((await inspect(page)).inputs).toEqual(neutral);
    await fingers.cancel(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.evaluate(() => Reflect.get(window, 'touchGame').stop());
    await fingers.down(2, page.getByRole('button', { name: 'Front shot', exact: true }));
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Reflect.deleteProperty(document, 'hidden');
    });
    await expect(page.getByRole('dialog')).toBeVisible(); expect((await inspect(page)).inputs).toEqual(neutral);
    await fingers.cancel(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByRole('button', { name: 'Quit Match', exact: true }).click();
    await page.getByRole('button', { name: 'Start Game', exact: true }).click(); await page.locator('canvas').waitFor();
    expect((await inspect(page)).inputs).toEqual(neutral);
  });

  test('portrait and landscape fit arena/HUD/buttons and orientation clears holds', async ({ page }) => {
    await start(page); const fingers = new Fingers(await page.context().newCDPSession(page), page);
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      for (const locator of [page.locator('canvas'), page.getByRole('region', { name: 'Match information' }),
        page.getByRole('button', { name: 'Move and steer' }), page.getByRole('button', { name: 'Front shot', exact: true }),
        page.getByRole('button', { name: 'Right broadside', exact: true }), page.getByRole('button', { name: 'Left broadside', exact: true })]) {
        const rect = await locator.boundingBox(); expect(rect).not.toBeNull();
        expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.y).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height + 1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await fingers.down(1, page.getByRole('button', { name: 'Move and steer' }), 0, -35);
    await page.setViewportSize({ width: 568, height: 320 });
    await expect.poll(async () => (await inspect(page)).inputs).toEqual(neutral); await fingers.cancel();
  });

  test('keyboard and touch sources combine without releasing each other', async ({ page }) => {
    await start(page); const fingers = new Fingers(await page.context().newCDPSession(page), page);
    await page.keyboard.down('w'); await fingers.down(1, page.getByRole('button', { name: 'Move and steer' }), 0, -35);
    await page.keyboard.up('w'); expect((await inspect(page)).inputs.forward).toBe(false);
    expect((await inspect(page)).inputs.touchDirection).not.toBeNull();
    await page.keyboard.down('ArrowUp'); await fingers.up(1); expect((await inspect(page)).inputs.forward).toBe(true);
    await page.keyboard.up('ArrowUp'); expect((await inspect(page)).inputs).toEqual(neutral);
    const left = page.getByRole('button', { name: 'Left broadside', exact: true });
    await left.focus(); await page.keyboard.down('Enter');
    expect((await inspect(page)).inputs).toMatchObject({ fireLeft: true, fireFront: false });
    await page.keyboard.up('Enter'); expect((await inspect(page)).inputs).toEqual(neutral);
  });
});

test('desktop hides touch UI and preserves all keyboard mappings', async ({ page }) => {
  await start(page);
  await expect(page.getByRole('button', { name: 'Move and steer' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Keyboard controls' })).toBeVisible();
  for (const [key, action] of [['w', 'forward'], ['ArrowUp', 'forward'], ['a', 'turnLeft'], ['ArrowLeft', 'turnLeft'],
    ['d', 'turnRight'], ['ArrowRight', 'turnRight'], ['Space', 'fireFront'], ['q', 'fireLeft'], ['e', 'fireRight']]) {
    await page.keyboard.down(key); expect((await inspect(page)).inputs[action]).toBe(true);
    await advance(page, 1); await page.keyboard.up(key); expect((await inspect(page)).inputs).toEqual(neutral);
  }
});

test('desktop W/A/D movement math and opposite steering remain unchanged', async ({ page }) => {
  await start(page); await placeShip(page, 0);
  const initial = await inspect(page);
  await page.keyboard.down('w'); await page.keyboard.down('a'); await advance(page, 1);
  const moved = await inspect(page);
  const rotation = -initial.rotationSpeed / 60;
  expect(moved.rotation).toBeCloseTo(rotation, 10);
  expect(moved.x).toBeCloseTo(initial.x + Math.sin(rotation) * initial.movementSpeed / 60, 10);
  expect(moved.y).toBeCloseTo(initial.y - Math.cos(rotation) * initial.movementSpeed / 60, 10);
  expect(moved.inputs.touchDirection).toBeNull();
  await page.keyboard.up('w'); await page.keyboard.up('a');
  await placeShip(page, 2 * Math.PI + 0.2);
  await page.keyboard.down('d'); await advance(page, 12);
  expect((await inspect(page)).rotation).toBeCloseTo(2 * Math.PI + 0.2 + initial.rotationSpeed / 5, 10);
  await page.keyboard.down('a'); const opposed = await inspect(page); await advance(page, 12);
  expect((await inspect(page)).rotation).toBe(opposed.rotation);
  await page.keyboard.up('a'); await page.keyboard.up('d');
  expect((await inspect(page)).inputs).toEqual(neutral);
});
