import { useState, useSyncExternalStore } from 'react';
import { gameAudio } from '@/audio/AudioManager';
import type { AudioPreferences } from '@/audio/audioPreferences';

export function AudioControls() {
  const preferences = useSyncExternalStore(gameAudio.subscribe, gameAudio.getPreferences);
  const error = useSyncExternalStore(gameAudio.subscribe, gameAudio.getError);
  const [storageError, setStorageError] = useState(false);
  const change = (next: Partial<AudioPreferences>) => {
    setStorageError(!gameAudio.setPreferences({ ...preferences, ...next }));
  };
  return <fieldset className="audio-controls">
    <legend>Audio</legend>
    <p>Audio changes apply immediately and are saved automatically.</p>
    <button type="button" className="menu-button menu-button-secondary"
      aria-pressed={preferences.muted} onClick={() => change({ muted: !preferences.muted })}>
      {preferences.muted ? 'Unmute audio' : 'Mute audio'}
    </button>
    <div className="options-field">
      <label htmlFor="effects-volume">Sound effects volume ({Math.round(preferences.effectsVolume * 100)}%)</label>
      <input id="effects-volume" type="range" min="0" max="100" step="5"
        value={preferences.effectsVolume * 100} onChange={event => change({ effectsVolume: Number(event.target.value) / 100 })} />
    </div>
    <div className="options-field">
      <label htmlFor="ambience-volume">Ocean ambience volume ({Math.round(preferences.ambienceVolume * 100)}%)</label>
      <input id="ambience-volume" type="range" min="0" max="100" step="5"
        value={preferences.ambienceVolume * 100} onChange={event => change({ ambienceVolume: Number(event.target.value) / 100 })} />
    </div>
    {storageError && <p role="alert">Audio preferences could not be saved. Changes apply for this visit only.</p>}
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
