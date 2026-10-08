import { useState, useSyncExternalStore } from 'react';
import { getShowFps, saveShowFps, subscribeDisplayPreferences } from '@/config/displayPreferences';

export function DisplayControls() {
  const enabled = useSyncExternalStore(subscribeDisplayPreferences, getShowFps);
  const [storageError, setStorageError] = useState(false);
  return <fieldset className="audio-controls display-controls">
    <legend>Display</legend>
    <label className="display-toggle">
      <input type="checkbox" checked={enabled} aria-describedby="fps-hint"
        onChange={event => setStorageError(!saveShowFps(event.target.checked))} />
      Show FPS
    </label>
    <p id="fps-hint">Show rendered frames per second during gameplay. Saved automatically.</p>
    {storageError && <p role="alert">Display preferences could not be saved. Changes apply for this visit only.</p>}
  </fieldset>;
}
