import { useSyncExternalStore } from 'react';
import { getPendingSnapshot, subscribePendingMatches } from '@/storage/pendingMatchesStorage';

export function usePendingMatches() {
  return useSyncExternalStore(subscribePendingMatches, getPendingSnapshot, getPendingSnapshot);
}
