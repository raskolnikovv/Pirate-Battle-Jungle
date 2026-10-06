import { DEFAULT_GAME_CONFIG, SESSION_DURATION_LIMITS } from '@/config/gameConfig';
import type { CompletedMatch } from '@/types/completedMatch';

export const LAST_COMPLETED_MATCH_KEY = 'pirate-battle:last-completed-match:v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

// Validate every persisted config field, including nested values, without merging defaults.
function matchesConfigShape(value: unknown, template: unknown): boolean {
  if (typeof template === 'number') return isNonnegativeNumber(value);
  if (!isRecord(value) || !isRecord(template)) return false;
  return Object.entries(template).every(([key, field]) => matchesConfigShape(value[key], field));
}

export function isCompletedMatch(value: unknown): value is CompletedMatch {
  if (!isRecord(value) || !isRecord(value.config)
    || !matchesConfigShape(value.config, DEFAULT_GAME_CONFIG)) return false;
  const duration = value.config.sessionDuration;
  const maxHealth = value.config.playerHealth;
  return typeof value.matchId === 'string' && value.matchId.trim().length > 0
    && typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt))
    && isNonnegativeNumber(value.score)
    && isNonnegativeNumber(value.enemiesDefeated) && Number.isInteger(value.enemiesDefeated)
    && isNonnegativeNumber(value.elapsedSeconds)
    && isNonnegativeNumber(duration) && duration >= SESSION_DURATION_LIMITS.min
    && duration <= SESSION_DURATION_LIMITS.max && value.elapsedSeconds <= duration
    && isNonnegativeNumber(value.config.enemySpawnInterval) && value.config.enemySpawnInterval > 0
    && isNonnegativeNumber(maxHealth) && maxHealth > 0
    && isNonnegativeNumber(value.playerHealth) && value.playerHealth <= maxHealth
    && (value.endReason === 'time_expired' || value.endReason === 'player_defeated')
    && (value.endReason !== 'time_expired' || value.elapsedSeconds === duration)
    && (value.endReason !== 'player_defeated' || value.playerHealth === 0)
    && value.registrationStatus === 'not_submitted';
}

export function loadLastCompletedMatch(): CompletedMatch | undefined {
  try {
    const raw = localStorage.getItem(LAST_COMPLETED_MATCH_KEY);
    if (!raw) return undefined;
    const stored: unknown = JSON.parse(raw);
    return isRecord(stored) && stored.version === 1 && isCompletedMatch(stored.result)
      ? stored.result : undefined;
  } catch {
    return undefined;
  }
}

export function saveLastCompletedMatch(result: CompletedMatch): boolean {
  if (!isCompletedMatch(result)) return false;
  try {
    localStorage.setItem(LAST_COMPLETED_MATCH_KEY, JSON.stringify({ version: 1, result }));
    return true;
  } catch {
    return false;
  }
}
