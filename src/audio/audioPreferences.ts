export interface AudioPreferences {
  muted: boolean;
  effectsVolume: number;
  ambienceVolume: number;
}

export const AUDIO_STORAGE_KEY = 'pirate-battle.audio.v1';
export const DEFAULT_AUDIO_PREFERENCES: Readonly<AudioPreferences> = {
  muted: false, effectsVolume: 0.6, ambienceVolume: 0.25,
};

export function validAudioPreferences(value: unknown): value is AudioPreferences {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AudioPreferences>;
  return typeof item.muted === 'boolean'
    && [item.effectsVolume, item.ambienceVolume].every(volume =>
      typeof volume === 'number' && Number.isFinite(volume) && volume >= 0 && volume <= 1);
}

export function loadAudioPreferences(): AudioPreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) ?? 'null');
    if (validAudioPreferences(value)) return { ...value };
  } catch { /* Unavailable or corrupt storage must not prevent playing. */ }
  return { ...DEFAULT_AUDIO_PREFERENCES };
}
