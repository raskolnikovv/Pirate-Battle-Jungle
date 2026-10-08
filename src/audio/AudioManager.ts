import { AUDIO_ASSETS, type SoundName } from './audioAssets';
import { AUDIO_STORAGE_KEY, loadAudioPreferences, validAudioPreferences, type AudioPreferences } from './audioPreferences';

interface Voice { source: AudioBufferSourceNode; session: boolean }

// Shared across screens. No gameplay state, animation loop or queued combat sounds.
export class AudioManager {
  private context: AudioContext | null = null;
  private effects: GainNode | null = null;
  private ambience: GainNode | null = null;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly voices = new Set<Voice>();
  private ocean: AudioBufferSourceNode | null = null;
  private loading: Promise<void> | null = null;
  private loadController: AbortController | null = null;
  private pendingStart = false;
  private active = false;
  private preferences = loadAudioPreferences();
  private readonly listeners = new Set<() => void>();
  private error = '';

  // Read-only diagnostics; called only by the opt-in profiling collector.
  getResourceCounts() {
    return { audioContexts: Number(this.context !== null), audioContextState: this.context?.state ?? null,
      audioVoices: this.voices.size, oceanVoices: Number(this.ocean !== null), audioBuffers: this.buffers.size };
  }

  getPreferences = () => this.preferences;
  getError = () => this.error;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private notify(): void { for (const listener of this.listeners) listener(); }

  setPreferences(next: AudioPreferences): boolean {
    if (!validAudioPreferences(next)) return false;
    this.preferences = { ...next };
    let saved = true;
    try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(next)); }
    catch { saved = false; }
    if (next.muted || next.effectsVolume === 0) this.stopVoices();
    this.applyVolumes();
    this.syncOcean();
    this.notify();
    return saved;
  }

  attach(): () => void {
    const unlock = (event: Event) => { if (event.isTrusted) this.unlock(); };
    const silence = () => {
      this.stopVoices(); this.stopOcean();
      // The game itself owns automatic pause and explicit resume.
    };
    const visibility = () => { if (document.hidden) silence(); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('blur', silence);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('blur', silence);
      document.removeEventListener('visibilitychange', visibility);
      this.dispose();
    };
  }

  // Must be called synchronously inside a trusted user gesture, before async asset loading.
  unlock(): void {
    try {
      if (!this.context) {
        if (!window.AudioContext) {
          this.error = 'Audio is unavailable in this browser. Gameplay remains available.';
          this.notify(); return;
        }
        this.context = new AudioContext();
        this.effects = this.context.createGain();
        this.ambience = this.context.createGain();
        this.effects.connect(this.context.destination);
        this.ambience.connect(this.context.destination);
        this.applyVolumes();
      }
      const context = this.context;
      void context.resume().then(() => {
        if (this.context === context) { this.syncOcean(); this.playStart(); }
      }).catch(() => { /* Retry on the next user gesture; never queue effects. */ });
      this.load(context);
    } catch {
      this.error = 'Audio is unavailable in this browser. Gameplay remains available.';
      this.notify();
    }
  }

  private load(context: AudioContext): void {
    if (this.loading) return;
    const controller = new AbortController();
    this.loadController = controller;
    this.loading = Promise.allSettled(Object.entries(AUDIO_ASSETS).map(async ([name, path]) => {
      const response = await fetch(path, { signal: controller.signal });
      if (!response.ok) throw new Error('Audio asset unavailable');
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (this.context === context) this.buffers.set(name as SoundName, buffer);
    })).then(results => {
      if (this.context !== context) return;
      if (results.some(result => result.status === 'rejected')) {
        this.error = 'Some sounds could not load. Gameplay remains available.';
        this.notify();
      }
      this.syncOcean();
      this.playStart();
    });
  }

  private applyVolumes(): void {
    if (this.effects) this.effects.gain.value = this.preferences.muted ? 0 : this.preferences.effectsVolume;
    if (this.ambience) this.ambience.gain.value = this.preferences.muted ? 0 : this.preferences.ambienceVolume;
  }

  play(name: Exclude<SoundName, 'ocean'>, session = true): void {
    const context = this.context;
    const buffer = this.buffers.get(name);
    if (!context || context.state !== 'running' || !buffer || !this.effects
      || this.preferences.muted || this.preferences.effectsVolume === 0
      || document.hidden || !document.hasFocus() || (session && !this.active)) return;
    // Drop excess new sounds, retaining earlier cannon tails. Ambience is a separate voice.
    if (this.voices.size >= 12) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.effects);
    const voice = { source, session };
    this.voices.add(voice);
    source.onended = () => { source.disconnect(); this.voices.delete(voice); };
    source.start();
  }

  private playStart(): void {
    if (!this.active || !this.pendingStart || this.context?.state !== 'running' || !this.buffers.has('start')) return;
    this.pendingStart = false; this.play('start');
  }

  start(): void {
    this.stopVoices(); this.stopOcean(); this.active = true; this.pendingStart = true;
    this.syncOcean(); this.playStart();
  }
  pause(): void {
    this.active = false; this.pendingStart = false; this.stopVoices(); this.stopOcean(); this.play('pause', false);
  }
  resume(): void { this.active = true; this.syncOcean(); this.play('resume'); }
  finish(defeated: boolean): void {
    this.active = false; this.pendingStart = false; this.stopVoices(); this.stopOcean();
    if (defeated) this.play('explosion', false);
    this.play(defeated ? 'over' : 'complete', false);
  }
  leave(preserveCompletion = false): void {
    this.active = false; this.pendingStart = false;
    this.stopVoices(preserveCompletion); this.stopOcean();
  }

  private syncOcean(): void {
    if (!this.active || this.preferences.muted || this.preferences.ambienceVolume === 0
      || document.hidden || !document.hasFocus() || this.context?.state !== 'running') {
      this.stopOcean(); return;
    }
    const buffer = this.buffers.get('ocean');
    if (this.ocean || !buffer || !this.ambience) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer; source.loop = true; source.connect(this.ambience);
    this.ocean = source; source.start();
  }

  private stopOcean(): void {
    if (!this.ocean) return;
    this.ocean.stop(); this.ocean.disconnect(); this.ocean = null;
  }

  private stopVoices(sessionOnly = false): void {
    for (const voice of this.voices) {
      if (sessionOnly && !voice.session) continue;
      voice.source.onended = null;
      voice.source.stop(); voice.source.disconnect(); this.voices.delete(voice);
    }
  }

  dispose(): void {
    this.active = false; this.pendingStart = false; this.stopVoices(); this.stopOcean();
    this.loadController?.abort(); this.loadController = null;
    const context = this.context;
    this.context = null; this.effects?.disconnect(); this.ambience?.disconnect();
    this.effects = null; this.ambience = null; this.buffers.clear(); this.loading = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}

export const gameAudio = new AudioManager();
