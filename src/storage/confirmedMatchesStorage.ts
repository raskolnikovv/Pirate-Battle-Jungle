import type { MatchHistoryRecord } from '@/api/matchContracts';
import { isHistoryRecord } from '@/api/responseValidation';

export const CONFIRMED_MATCHES_STORAGE_KEY = 'pirate-battle:confirmed-matches:v1';

export function loadConfirmedMatches(): MatchHistoryRecord[] {
  try {
    const raw = localStorage.getItem(CONFIRMED_MATCHES_STORAGE_KEY);
    if (!raw) return [];
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)
      || !('version' in stored) || stored.version !== 1
      || !('records' in stored) || !Array.isArray(stored.records)
      || !stored.records.every(isHistoryRecord)) return [];
    const ids = new Set(stored.records.map((record) => record.matchId));
    // Reject an inconsistent dataset rather than guessing which duplicate wins.
    return ids.size === stored.records.length ? stored.records : [];
  } catch {
    return [];
  }
}

export function saveConfirmedMatches(records: MatchHistoryRecord[]): boolean {
  if (!records.every(isHistoryRecord)
    || new Set(records.map((record) => record.matchId)).size !== records.length) return false;
  try {
    localStorage.setItem(CONFIRMED_MATCHES_STORAGE_KEY, JSON.stringify({
      version: 1,
      records: [...records].sort((a, b) => a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearConfirmedMatches(): boolean {
  try {
    localStorage.removeItem(CONFIRMED_MATCHES_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
