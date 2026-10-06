import { isSameMatch, type SubmitMatchRequest } from '@/api/matchContracts';
import { isHistoryRecord } from '@/api/responseValidation';

export const PENDING_MATCHES_STORAGE_KEY = 'pirate-battle:pending-matches:v1';

interface PendingSnapshot {
  readonly records: readonly SubmitMatchRequest[];
  readonly storageError: string | null;
}

function loadPendingMatches(): PendingSnapshot {
  try {
    const raw = localStorage.getItem(PENDING_MATCHES_STORAGE_KEY);
    if (!raw) return { records: [], storageError: null };
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)
      || !('version' in stored) || stored.version !== 1
      || !('records' in stored) || !Array.isArray(stored.records)
      || !stored.records.every(isHistoryRecord)
      || new Set(stored.records.map((record) => record.matchId)).size !== stored.records.length) {
      throw new Error('Invalid pending records.');
    }
    return { records: stored.records, storageError: null };
  } catch {
    return { records: [], storageError: 'Saved pending submissions could not be read. No saved data was sent.' };
  }
}

let snapshot = loadPendingMatches();
const listeners = new Set<() => void>();

export function getPendingSnapshot(): PendingSnapshot { return snapshot; }

export function subscribePendingMatches(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function persist(records: readonly SubmitMatchRequest[]): boolean {
  try {
    localStorage.setItem(PENDING_MATCHES_STORAGE_KEY, JSON.stringify({ version: 1, records }));
    snapshot = { records, storageError: null };
  } catch {
    // Keep the payload in this session, but clearly report that reload is unsafe.
    snapshot = { records: snapshot.records, storageError: 'Unable to save pending submissions. Keep this page open and retry.' };
    for (const listener of listeners) listener();
    return false;
  }
  for (const listener of listeners) listener();
  return true;
}

export function addPendingMatch(payload: SubmitMatchRequest): void {
  if (!isHistoryRecord(payload)) throw new Error('Invalid completed match submission.');
  const existing = snapshot.records.find((record) => record.matchId === payload.matchId);
  if (existing && !isSameMatch(existing, payload)) throw new Error('A different pending payload already uses this match ID.');
  if (!existing) {
    // Store an independent copy of the original config/data, never current Options.
    const copy: SubmitMatchRequest = JSON.parse(JSON.stringify(payload));
    snapshot = { ...snapshot, records: [...snapshot.records, copy] };
  }
  if (!persist(snapshot.records)) throw new Error(snapshot.storageError ?? 'Unable to persist pending submission.');
}

export function removePendingMatch(matchId: string): boolean {
  return persist(snapshot.records.filter((record) => record.matchId !== matchId));
}
