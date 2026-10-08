// Recent rendered-frame intervals, bounded independently of match duration.
// A future profiling collector can copy samples periodically; this is not a profiling report.
export class FrameCadence {
  private readonly samples = new Float64Array(600);
  private sampleCount = 0;
  private nextSample = 0;
  private lastTimestamp: number | null = null;
  private windowStart = 0;
  private windowFrames = 0;

  reset(): void {
    this.sampleCount = 0; this.nextSample = 0;
    this.lastTimestamp = null; this.windowStart = 0; this.windowFrames = 0;
  }

  record(timestamp: number): number | null {
    if (!Number.isFinite(timestamp)) return null;
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp; this.windowStart = timestamp; return null;
    }
    const elapsed = timestamp - this.lastTimestamp;
    if (elapsed <= 0) return null;
    this.lastTimestamp = timestamp;
    this.samples[this.nextSample] = elapsed;
    this.nextSample = (this.nextSample + 1) % this.samples.length;
    this.sampleCount = Math.min(this.sampleCount + 1, this.samples.length);
    this.windowFrames++;
    const windowMs = timestamp - this.windowStart;
    if (windowMs < 1000) return null;
    const fps = Math.round(this.windowFrames * 1000 / windowMs);
    this.windowStart = timestamp; this.windowFrames = 0;
    return fps;
  }

  getFrameTimes(): number[] {
    const start = (this.nextSample - this.sampleCount + this.samples.length) % this.samples.length;
    return Array.from({ length: this.sampleCount }, (_, i) => this.samples[(start + i) % this.samples.length]);
  }
}
