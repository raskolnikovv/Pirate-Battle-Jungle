import { useRef, useState, type FormEvent } from 'react';
import { PirateScreen } from '@/components/PirateScreen';
import { AudioControls } from '@/components/AudioControls';
import type { ScreenName } from '@/app/navigationTypes';
import { ENEMY_SPAWN_INTERVAL_LIMITS, SESSION_DURATION_LIMITS } from '@/config/gameConfig';
import { loadGameOptions, saveGameOptions, validateGameOptions, type GameOptionsErrors } from '@/config/gameOptions';

interface OptionsProps {
  onNavigate: (screen: ScreenName) => void;
}

export function Options({ onNavigate }: OptionsProps) {
  return <PirateScreen title="Options"><OptionsForm onBack={() => onNavigate('main-menu')} /></PirateScreen>;
}

export function OptionsForm({ onBack }: { onBack: () => void }) {
  const [draft, setDraft] = useState(() => {
    const saved = loadGameOptions();
    return { sessionDuration: String(saved.sessionDuration), enemySpawnInterval: String(saved.enemySpawnInterval) };
  });
  const [errors, setErrors] = useState<GameOptionsErrors>({});
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState('');
  const sessionRef = useRef<HTMLInputElement>(null);
  const spawnRef = useRef<HTMLInputElement>(null);

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const options = {
      sessionDuration: draft.sessionDuration.trim() ? Number(draft.sessionDuration) : NaN,
      enemySpawnInterval: draft.enemySpawnInterval.trim() ? Number(draft.enemySpawnInterval) : NaN,
    };
    const nextErrors = validateGameOptions(options);
    setErrors(nextErrors);
    setMessage('');
    setStorageError('');
    if (Object.keys(nextErrors).length > 0) {
      (nextErrors.sessionDuration ? sessionRef : spawnRef).current?.focus();
      return;
    }
    if (!saveGameOptions(options)) {
      setStorageError('Unable to save settings in this browser. Previous settings remain unchanged.');
      return;
    }
    setMessage('Settings saved. They will apply to new matches.');
  };

  return (
      <form className="options-form" noValidate onSubmit={handleSave}>
        <p>Times are in seconds. Saved settings apply only to new matches.</p>
        <div className="options-field">
          <label htmlFor="session-time">Game session time</label>
          <input ref={sessionRef} id="session-time" type="number" step="any"
            min={SESSION_DURATION_LIMITS.min} max={SESSION_DURATION_LIMITS.max} required
            value={draft.sessionDuration} aria-invalid={Boolean(errors.sessionDuration)}
            aria-describedby={`session-hint${errors.sessionDuration ? ' session-error' : ''}`}
            onChange={(event) => {
              setDraft({ ...draft, sessionDuration: event.target.value });
              setErrors({ ...errors, sessionDuration: undefined });
              setMessage(''); setStorageError('');
            }} />
          <p id="session-hint">Between {SESSION_DURATION_LIMITS.min} and {SESSION_DURATION_LIMITS.max} seconds.</p>
          {errors.sessionDuration && <p id="session-error" className="options-error" role="alert">{errors.sessionDuration}</p>}
        </div>
        <div className="options-field">
          <label htmlFor="spawn-time">Enemy spawn time</label>
          <input ref={spawnRef} id="spawn-time" type="number" step="any"
            min={ENEMY_SPAWN_INTERVAL_LIMITS.min} max={ENEMY_SPAWN_INTERVAL_LIMITS.max} required
            value={draft.enemySpawnInterval} aria-invalid={Boolean(errors.enemySpawnInterval)}
            aria-describedby={`spawn-hint${errors.enemySpawnInterval ? ' spawn-error' : ''}`}
            onChange={(event) => {
              setDraft({ ...draft, enemySpawnInterval: event.target.value });
              setErrors({ ...errors, enemySpawnInterval: undefined });
              setMessage(''); setStorageError('');
            }} />
          <p id="spawn-hint">Between {ENEMY_SPAWN_INTERVAL_LIMITS.min} and {ENEMY_SPAWN_INTERVAL_LIMITS.max} seconds. Lower values mean more frequent spawn attempts.</p>
          {errors.enemySpawnInterval && <p id="spawn-error" className="options-error" role="alert">{errors.enemySpawnInterval}</p>}
        </div>
        <AudioControls />
        <p role="status" aria-atomic="true">{message}</p>
        {storageError && <p className="options-error" role="alert">{storageError}</p>}
        <div className="options-actions">
          <button className="menu-button menu-button-primary" type="submit">Save</button>
          <button className="menu-button menu-button-secondary" type="button" onClick={onBack}>Back</button>
        </div>
      </form>
  );
}
