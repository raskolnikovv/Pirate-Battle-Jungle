import { FrameCadence } from './FrameCadence';

export interface GameLoopCallbacks {
  update: (deltaSeconds: number) => void;
  render: (alpha: number) => void;
}

export class GameLoop {
  private readonly cadence = new FrameCadence();
  private fpsObserver?: (fps: number | null) => void;
  private running = false;
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedTimestep = 1 / 60;

  constructor(private readonly callbacks: GameLoopCallbacks) {}

  setFpsObserver(observer?: (fps: number | null) => void): void {
    this.fpsObserver = observer;
    this.cadence.reset();
    observer?.(null);
  }

  getFrameTimes(): number[] { return this.cadence.getFrameTimes(); }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.cadence.reset();
    this.fpsObserver?.(null);
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    this.cadence.reset();
    this.fpsObserver?.(null);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private scheduleFrame(): void {
    if (!this.running) return;
    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }

  private frame(currentTime: number): void {
    if (!this.running) return;

    let deltaMs = currentTime - this.lastTime;
    if (deltaMs > 250) deltaMs = 250;
    this.lastTime = currentTime;
    this.accumulator += deltaMs / 1000;

    while (this.accumulator >= this.fixedTimestep) {
      this.callbacks.update(this.fixedTimestep);
      this.accumulator -= this.fixedTimestep;
    }

    const alpha = this.accumulator / this.fixedTimestep;
    this.callbacks.render(alpha);
    // Observe completed render cadence, never the fixed simulation updates.
    if (this.fpsObserver) {
      const fps = this.cadence.record(performance.now());
      if (fps !== null) this.fpsObserver(fps);
    }

    this.scheduleFrame();
  }
}
