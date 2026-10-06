import type { MatchHistoryRecord } from './matchContracts';
import type { RankingEntry } from './rankingContracts';
import type { PaginatedResponse } from '@/types/domain';
import { isCompletedMatch } from '@/storage/completedMatchStorage';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

export function isHistoryRecord(value: unknown): value is MatchHistoryRecord {
  return isRecord(value)
    && typeof value.playerId === 'string' && value.playerId.trim().length > 0
    && typeof value.playerName === 'string' && value.playerName.trim().length > 0
    && isCompletedMatch({
      ...value,
      elapsedSeconds: value.durationSeconds,
      registrationStatus: 'not_submitted',
    });
}

export function isRankingEntry(value: unknown): value is RankingEntry {
  return isHistoryRecord(value) && 'rank' in value && isInteger(value.rank, 1);
}

// HTTP generics only describe types; they never validate incoming server data.
export function readPaginatedResponse<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): PaginatedResponse<T> {
  if (!isRecord(value) || !Array.isArray(value.items)
    || !isInteger(value.page, 1) || !isInteger(value.pageSize, 1)
    || !isInteger(value.total, 0) || !isInteger(value.totalPages, 0)
    || value.totalPages !== Math.ceil(value.total / value.pageSize)
    || value.items.length > value.pageSize || value.items.length > value.total
    || !value.items.every(isItem)) {
    throw new Error('Invalid paginated API response. Expected match records and pagination metadata.');
  }
  return {
    items: value.items,
    page: value.page,
    pageSize: value.pageSize,
    total: value.total,
    totalPages: value.totalPages,
  };
}
