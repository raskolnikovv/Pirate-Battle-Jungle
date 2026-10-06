import {
  DEFAULT_GAME_CONFIG, ENEMY_SPAWN_INTERVAL_LIMITS, SESSION_DURATION_LIMITS,
  type GameConfig,
} from './gameConfig';

export type GameOptions = Pick<GameConfig, 'sessionDuration' | 'enemySpawnInterval'>;
export type GameOptionsErrors = Partial<Record<keyof GameOptions, string>>;
export const GAME_OPTIONS_STORAGE_KEY = 'pirate-battle:options:v1';

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function validateGameOptions(options: GameOptions): GameOptionsErrors {
  const errors: GameOptionsErrors = {};
  if (!inRange(options.sessionDuration, SESSION_DURATION_LIMITS.min, SESSION_DURATION_LIMITS.max)) {
    errors.sessionDuration = 'Game session time must be between 60 and 180 seconds.';
  }
  if (!inRange(options.enemySpawnInterval, ENEMY_SPAWN_INTERVAL_LIMITS.min, ENEMY_SPAWN_INTERVAL_LIMITS.max)) {
    errors.enemySpawnInterval = 'Enemy spawn time must be between 1 and 15 seconds.';
  }
  return errors;
}

export function loadGameOptions(): GameOptions {
  const defaults: GameOptions = {
    sessionDuration: DEFAULT_GAME_CONFIG.sessionDuration,
    enemySpawnInterval: DEFAULT_GAME_CONFIG.enemySpawnInterval,
  };
  try {
    const raw = localStorage.getItem(GAME_OPTIONS_STORAGE_KEY);
    if (!raw) return defaults;
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)
      || !('version' in stored) || stored.version !== 1) return defaults;
    return {
      sessionDuration: 'sessionDuration' in stored
        && inRange(stored.sessionDuration, SESSION_DURATION_LIMITS.min, SESSION_DURATION_LIMITS.max)
        ? stored.sessionDuration : defaults.sessionDuration,
      enemySpawnInterval: 'enemySpawnInterval' in stored
        && inRange(stored.enemySpawnInterval, ENEMY_SPAWN_INTERVAL_LIMITS.min, ENEMY_SPAWN_INTERVAL_LIMITS.max)
        ? stored.enemySpawnInterval : defaults.enemySpawnInterval,
    };
  } catch {
    // Missing access, malformed JSON, or unexpected data must not block a match.
    return defaults;
  }
}

export function saveGameOptions(options: GameOptions): boolean {
  if (Object.keys(validateGameOptions(options)).length > 0) return false;
  try {
    localStorage.setItem(GAME_OPTIONS_STORAGE_KEY, JSON.stringify({
      version: 1,
      sessionDuration: options.sessionDuration,
      enemySpawnInterval: options.enemySpawnInterval,
    }));
    return true;
  } catch {
    return false;
  }
}
